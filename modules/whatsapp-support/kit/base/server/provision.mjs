// O que o servidor do projeto faz no Chatwoot e no OpenWA para cada cliente (cada conta do Chatwoot).
// Tudo é idempotente: recebe o estado que o projeto guardou, completa o que falta e devolve o estado novo,
// que o projeto grava de novo (os tokens são segredos: guarde cifrados, nunca em log).

import { randomBytes } from "node:crypto";

import { chatwootAccount, chatwootPlatform, chatwootProfile } from "./chatwoot.mjs";
import { classifySession, openwaFailure, worstLevel } from "./health.mjs";
import { ADAPTER_ID, adapterEnabled, adapterIngressUrl, openwaClient } from "./openwa.mjs";

/** Funções que o atendimento usa e que nunca se desligam numa conta. */
export const NEVER_OFF = ["api_and_webhooks", "agent_bots", "inbox_management", "agent_management", "labels"];

/** Preferências do painel lateral da conversa que o kit grava para cada pessoa da equipe (ela pode mudar depois). */
export const DEFAULT_UI_SETTINGS = {
  is_contact_attributes_open: true,
  is_conv_actions_open: true,
  is_conv_details_open: false,
  is_previous_conv_open: true,
  is_conv_participants_open: false,
  is_macro_open: false,
  is_contact_notes_open: false,
  is_shared_files_open: false,
};

/**
 * Gravadas só quando a pessoa entra na equipe, para não desfazer o que ela escolher depois. A lista de
 * conversas do Chatwoot abre em "abertas" sem esta escolha (ChatList.vue), e com o robô respondendo sozinho
 * as conversas ficam pendentes: o painel parecia vazio (achado da Atrupe, 2026-11-11).
 */
export const INITIAL_UI_SETTINGS = {
  conversations_filter_by: { status: "all", order_by: "last_activity_at_desc" },
};

export const ADAPTER_SUBSCRIPTIONS = ["message_created", "conversation_updated", "conversation_status_changed"];

/**
 * As etiquetas que o robô põe nas conversas. O painel só mostra numa conversa a etiqueta que existe na conta
 * (app/javascript/dashboard/components-next/Conversation/ConversationCard/CardLabels.vue), então o
 * provisionamento as cria; com show_on_sidebar, a equipe filtra por elas no menu.
 */
export const KIT_LABELS = [
  { title: "robo-passou", description: "O robô passou a conversa para a equipe", color: "#64748B" },
  { title: "grupo", description: "Conversa de um grupo do WhatsApp", color: "#0EA5E9" },
  { title: "celular", description: "Alguém respondeu pelo celular do número", color: "#F59E0B" },
];

/**
 * O nome da pessoa de repasse do OpenWA. O adaptador põe no painel, com ela, o que foi escrito no celular do
 * número, e o painel mostra esse nome em cada uma dessas mensagens.
 */
export const RELAY_NAME = "Celular do WhatsApp";

/** Horas sem atividade até o Chatwoot resolver sozinho uma conversa aberta (decisão do operador, D25). */
export const AUTO_RESOLVE_HOURS = 8;

/** Os minutos que o Chatwoot grava; 0 desliga. O Chatwoot não aceita menos de 10 minutos (Limits.auto_resolve_min_minutes). */
export function autoResolveMinutes(hours = AUTO_RESOLVE_HOURS) {
  const value = hours === undefined || hours === null ? AUTO_RESOLVE_HOURS : Number(hours);
  if (value === 0) return null;
  if (!Number.isFinite(value) || value < 1 || value > 720) {
    throw new ProvisionError("auto_resolve_invalid", "O tempo para resolver sozinha uma conversa parada vai de 1 a 720 horas, ou 0 para desligar.", "Ajuste chatwoot.resolver_apos_horas em escolhas.json.");
  }
  return Math.round(value * 60);
}

/**
 * Conversa aberta e parada há o tempo escolhido é resolvida pelo Chatwoot, e a próxima mensagem do cliente a
 * reabre como pendente, com o robô (message.rb, reopen_resolved_conversation). auto_resolve_ignore_waiting
 * deixa de fora a conversa em que o cliente espera resposta (waiting_since), para ninguém sem resposta sumir
 * da fila; sem mensagem ao cliente ao resolver. Uma falha fica para a próxima vez que a conta for conferida.
 */
async function ensureAutoResolve(account, next, minutes) {
  if (next.auto_resolve_after === minutes) return;
  try {
    await account.updateSettings({ auto_resolve_after: minutes, auto_resolve_ignore_waiting: true, auto_resolve_message: "" });
    next.auto_resolve_after = minutes;
  } catch {
    // tenta de novo na próxima vez
  }
}

/** Quem implantou antes tem a pessoa de repasse com o nome antigo; o nome é ajuda, uma falha fica para depois. */
async function ensureRelayName(platform, next) {
  if (!next.relay_user_id || next.relay_name === RELAY_NAME) return;
  try {
    await platform.updateUser(next.relay_user_id, { name: RELAY_NAME, display_name: RELAY_NAME });
    next.relay_name = RELAY_NAME;
  } catch {
    // tenta de novo na próxima vez que a conta for conferida
  }
}

/** O nome do contato de um grupo no painel; o adaptador o cria como "Group <id>@g.us" e nunca o renomeia. */
export function groupContactName(subject) {
  return `Grupo: ${String(subject ?? "").trim().slice(0, 200)}`;
}

/** Cria as etiquetas que faltam. Etiqueta é ajuda para a equipe: uma falha fica para a próxima vez. */
async function ensureLabels(account, next) {
  const done = new Set(next.labels ?? []);
  const missing = KIT_LABELS.filter((label) => !done.has(label.title));
  if (!missing.length) return;
  try {
    const existing = new Set((await account.labels()).map((label) => label.title));
    for (const label of missing) {
      if (!existing.has(label.title)) await account.createLabel({ ...label, show_on_sidebar: true });
      done.add(label.title);
    }
  } catch {
    // tenta de novo na próxima vez que a conta for conferida
  }
  if (done.size) next.labels = [...done];
}

export class ProvisionError extends Error {
  constructor(code, message, fix) {
    super(message);
    this.code = code;
    this.fix = fix;
  }
}

/** O Chatwoot responde 422 quando a Meta não aceita os dados ou quando o número já está em outra caixa. */
function rejectedByChatwoot(error) {
  if (error?.code !== "http_422") throw error;
  throw new ProvisionError("meta_rejected", "O Chatwoot recusou os dados do número.", "Confira o token permanente e os IDs no WhatsApp Manager da Meta, e se este número já está ligado a outro cliente.");
}

function strongPassword() {
  // Senha que ninguém digita: a entrada é sempre pelo login único. Letras, dígitos e símbolos que o Chatwoot exige.
  return `${randomBytes(24).toString("base64url")}Aa1!`;
}

/** O mapa de funções para a API de plataforma: as escolhidas desligadas, as do atendimento sempre ligadas. */
export function featureMap(featuresOff = []) {
  const refused = featuresOff.filter((name) => NEVER_OFF.includes(name));
  if (refused.length) {
    throw new ProvisionError("feature_required", `Estas funções sustentam o atendimento e não podem ser desligadas: ${refused.join(", ")}.`, "Tire-as de chatwoot.features_off em escolhas.json.");
  }
  const map = Object.fromEntries(featuresOff.map((name) => [name, false]));
  for (const name of NEVER_OFF) map[name] = true;
  return map;
}

/**
 * Conta, conta de serviço (administradora) e robô da conta.
 * input: { name, locale, featuresOff, serviceEmail, botName, botUrl, autoResolveHours }
 * autoResolveHours: horas sem atividade até a conversa aberta voltar ao robô; padrão 8, 0 desliga.
 */
export async function provisionAccount({ chatwootUrl, platformToken, state = {}, input, fetchImpl = fetch }) {
  // Confere a escolha antes de criar qualquer coisa: um erro no fim perderia o estado do que foi criado.
  const autoResolve = autoResolveMinutes(input.autoResolveHours);
  const platform = chatwootPlatform({ url: chatwootUrl, token: platformToken, fetchImpl });
  const next = { inboxes: [], staff: {}, ...state };
  if (!next.account_id) {
    const account = await platform.createAccount({ name: input.name, locale: input.locale ?? "pt_BR", features: featureMap(input.featuresOff ?? []) });
    next.account_id = account.id;
  } else if (input.featuresOff) {
    await platform.updateAccount(next.account_id, { features: featureMap(input.featuresOff) });
  }
  next.features_off = input.featuresOff ?? next.features_off ?? [];

  if (!next.service_user_id || !next.service_token) {
    if (!input.serviceEmail) throw new ProvisionError("service_email_missing", "Falta o e-mail da conta de serviço desta conta.", "Passe input.serviceEmail, um endereço do domínio do projeto que ninguém usa para entrar.");
    const user = await platform.createUser({ name: input.serviceName ?? "Sistema de atendimento", email: input.serviceEmail, password: strongPassword() });
    await platform.addAccountUser(next.account_id, { user_id: user.id, role: "administrator" });
    const full = await platform.user(user.id);
    next.service_user_id = user.id;
    next.service_token = full.access_token;
  }

  const account = chatwootAccount({ url: chatwootUrl, token: next.service_token, accountId: next.account_id, fetchImpl });
  if (!next.bot_id || !next.bot_token || !next.bot_secret) {
    if (!input.botUrl) throw new ProvisionError("bot_url_missing", "Falta o endereço público do robô.", "Passe input.botUrl, por exemplo https://atendimento.seudominio.com.br/robo/chatwoot.");
    const bot = await account.createAgentBot({ name: input.botName ?? "Assistente virtual", description: "Robô de atendimento", outgoing_url: input.botUrl });
    if (!bot?.access_token || !bot?.secret) {
      throw new ProvisionError("bot_secret_hidden", "O Chatwoot não devolveu o token e o segredo do robô.", "A conta de serviço precisa ser administradora da conta.");
    }
    next.bot_id = bot.id;
    next.bot_token = bot.access_token;
    next.bot_secret = bot.secret;
  } else if (input.botUrl) {
    await account.updateAgentBot(next.bot_id, { outgoing_url: input.botUrl });
  }
  await ensureLabels(account, next);
  await ensureRelayName(platform, next);
  await ensureAutoResolve(account, next, autoResolve);
  return next;
}

/**
 * Uma pessoa da equipe do cliente: atendente (nunca administradora), membro de todas as caixas da conta,
 * com as preferências do painel lateral. person: { key, email, name }, key é o id da pessoa no projeto.
 * initialUiSettings vale só na primeira vez da pessoa na equipe; uiSettings, a cada chamada.
 */
export async function ensureStaffUser({ chatwootUrl, platformToken, state, person, uiSettings = DEFAULT_UI_SETTINGS, initialUiSettings = INITIAL_UI_SETTINGS, fetchImpl = fetch }) {
  const platform = chatwootPlatform({ url: chatwootUrl, token: platformToken, fetchImpl });
  const next = { staff: {}, ...state, staff: { ...(state.staff ?? {}) } };
  let userId = next.staff[person.key];
  const joining = !userId;
  let full = null;
  if (joining) {
    // O Chatwoot acha a pessoa existente pelo e-mail. Se for de quem administra outra conta, como o super
    // administrador criado na instalação, ela viraria atendente aqui e o login único cairia na outra conta.
    const user = await platform.createUser({ name: person.name, email: person.email, password: strongPassword() });
    userId = user.id;
    full = await platform.user(userId);
    const adminElsewhere = (full?.accounts ?? []).some((item) => Number(item.id) !== Number(next.account_id) && item.role === "administrator");
    if (adminElsewhere) {
      throw new ProvisionError("staff_email_is_admin", "Este e-mail é de quem administra outra conta do Chatwoot, como o super administrador.", "Dê ao super administrador um e-mail que ninguém da equipe usa, ou use outro e-mail para esta pessoa.");
    }
    next.staff[person.key] = userId;
  } else {
    await platform.updateUser(userId, { name: person.name, email: person.email });
  }
  if (userId === next.service_user_id || userId === next.relay_user_id) {
    throw new ProvisionError("reserved_user", "Este e-mail é o da conta de serviço ou de repasse.", "Use o e-mail da pessoa da equipe.");
  }
  // find_or_initialize_by + update no Chatwoot: chamar de novo corrige o papel para atendente.
  await platform.addAccountUser(next.account_id, { user_id: userId, role: "agent" });

  const account = chatwootAccount({ url: chatwootUrl, token: next.service_token, accountId: next.account_id, fetchImpl });
  for (const inbox of next.inboxes ?? []) await account.addInboxMembers(inbox.id, [userId]);

  const settings = { ...(uiSettings ?? {}), ...(joining && initialUiSettings ? initialUiSettings : {}) };
  if (Object.keys(settings).length) {
    full = full ?? (await platform.user(userId));
    if (full?.access_token) await chatwootProfile({ url: chatwootUrl, userToken: full.access_token, fetchImpl }).mergeUiSettings(settings);
  }
  return { state: next, userId };
}

/**
 * Tira uma pessoa da equipe da conta: ela sai da conta no Chatwoot e do estado. Chame quando o projeto tira
 * a permissão de atendimento ou desativa a pessoa: a sessão do Chatwoot dura até 2 meses, e quem saiu da
 * equipe continuaria abrindo o painel num navegador em que já entrou. A conta de serviço e a pessoa de
 * repasse nunca saem por aqui.
 */
export async function removeStaffUser({ chatwootUrl, platformToken, state, personKey, fetchImpl = fetch }) {
  const userId = state?.staff?.[personKey];
  if (!userId) return { state, removed: null };
  if (userId === state.service_user_id || userId === state.relay_user_id) {
    throw new ProvisionError("reserved_user", "Esta pessoa é a conta de serviço ou a de repasse.", "Confira a chave da pessoa no estado do atendimento.");
  }
  await chatwootPlatform({ url: chatwootUrl, token: platformToken, fetchImpl }).removeAccountUser(state.account_id, userId);
  const staff = { ...state.staff };
  delete staff[personKey];
  return { state: { ...state, staff }, removed: userId };
}

/**
 * Confere a equipe da conta com a lista do projeto (keepKeys: as chaves de quem ainda pode atender) e tira
 * quem o kit pôs e não está mais na lista. Quem está na conta sem ter sido posto pelo kit só volta em
 * unknown, para alguém decidir. Lista vazia com gente na equipe não tira ninguém (skipped: "empty_list"),
 * porque costuma ser falha na leitura da lista; para esvaziar a equipe de propósito, passe allowEmpty.
 */
export async function syncStaff({ chatwootUrl, platformToken, state, keepKeys, allowEmpty = false, fetchImpl = fetch }) {
  if (!Array.isArray(keepKeys)) throw new ProvisionError("staff_list_invalid", "A lista de quem atende precisa ser uma lista de chaves.", "Passe as chaves das pessoas que ainda podem atender neste cliente.");
  if (!state?.account_id) return { state, removed: [], unknown: [], skipped: "no_account" };
  const keep = new Set(keepKeys.map(String));
  const current = Object.keys(state.staff ?? {});
  if (!keep.size && current.length && !allowEmpty) return { state, removed: [], unknown: [], skipped: "empty_list" };
  let next = state;
  const removed = [];
  for (const key of current) {
    if (keep.has(key)) continue;
    const result = await removeStaffUser({ chatwootUrl, platformToken, state: next, personKey: key, fetchImpl });
    next = result.state;
    if (result.removed) removed.push({ key, user_id: result.removed });
  }
  const members = (await chatwootPlatform({ url: chatwootUrl, token: platformToken, fetchImpl }).accountUsers(next.account_id)) ?? [];
  const known = new Set([next.service_user_id, next.relay_user_id, ...Object.values(next.staff ?? {})].filter(Boolean).map(Number));
  const unknown = (Array.isArray(members) ? members : [])
    .filter((member) => !known.has(Number(member.user_id)))
    .map((member) => ({ user_id: Number(member.user_id), role: member.role ?? null }));
  return { state: next, removed, unknown, skipped: null };
}

/** O link que leva a pessoa já logada ao painel: o projeto chama isto quando ela clica em "Atendimento". */
export async function ssoUrl({ chatwootUrl, platformToken, userId, fetchImpl = fetch }) {
  const url = await chatwootPlatform({ url: chatwootUrl, token: platformToken, fetchImpl }).ssoLink(userId);
  if (!url) throw new ProvisionError("sso_failed", "O Chatwoot não devolveu o link de entrada.", "Confira se a pessoa foi criada por este Platform App.");
  return url;
}

async function addStaffToInbox(account, state, inboxId) {
  const ids = Object.values(state.staff ?? {});
  if (ids.length) await account.addInboxMembers(inboxId, ids);
}

/**
 * Rota oficial: caixa WhatsApp Cloud nativa do Chatwoot com as credenciais do cliente na Meta.
 * cloud: { phoneNumber (E.164), phoneNumberId, businessAccountId, apiKey (token permanente), inboxName }
 * Devolve a URL de retorno e o token de verificação para configurar no app da Meta.
 */
export async function connectCloudApi({ chatwootUrl, state, cloud, fetchImpl = fetch }) {
  const account = chatwootAccount({ url: chatwootUrl, token: state.service_token, accountId: state.account_id, fetchImpl });
  const inbox = await account
    .createInbox({
      name: cloud.inboxName ?? "WhatsApp",
      channel: {
        type: "whatsapp",
        phone_number: cloud.phoneNumber,
        provider: "whatsapp_cloud",
        provider_config: { api_key: cloud.apiKey, phone_number_id: cloud.phoneNumberId, business_account_id: cloud.businessAccountId },
      },
    })
    .catch(rejectedByChatwoot);
  await account.setAgentBot(inbox.id, state.bot_id);
  await addStaffToInbox(account, state, inbox.id);
  const next = { ...state, inboxes: [...(state.inboxes ?? []), { id: inbox.id, route: "oficial", phone: cloud.phoneNumber }] };
  return {
    state: next,
    inboxId: inbox.id,
    metaWebhook: { callbackUrl: inbox.callback_webhook_url ?? null, verifyToken: inbox.provider_config?.webhook_verify_token ?? null },
  };
}

/**
 * Troca o token (e os IDs, se vierem) de uma caixa oficial que já existe, sem criar outra: o Chatwoot aceita
 * cada número uma vez só e confere os dados novos com a Meta antes de gravar. O token de verificação do
 * retorno continua o mesmo, por isso a configuração atual da caixa é lida antes de gravar.
 */
export async function updateCloudApi({ chatwootUrl, state, inboxId, cloud, fetchImpl = fetch }) {
  const account = chatwootAccount({ url: chatwootUrl, token: state.service_token, accountId: state.account_id, fetchImpl });
  const current = await account.inbox(inboxId);
  const providerConfig = {
    ...(current?.provider_config ?? {}),
    api_key: cloud.apiKey,
    ...(cloud.phoneNumberId ? { phone_number_id: cloud.phoneNumberId } : {}),
    ...(cloud.businessAccountId ? { business_account_id: cloud.businessAccountId } : {}),
  };
  const updated = await account.updateInbox(inboxId, { channel: { provider_config: providerConfig } }).catch(rejectedByChatwoot);
  return {
    state,
    inboxId,
    metaWebhook: { callbackUrl: updated?.callback_webhook_url ?? current?.callback_webhook_url ?? null, verifyToken: providerConfig.webhook_verify_token ?? null },
  };
}

/** Instala e liga o adaptador do Chatwoot no OpenWA, pelo catálogo (que traz o hash do pacote). */
/** Instala o adaptador pelo catálogo, se faltar. O catálogo entrega a versão mais nova, não a de versoes.json. */
export async function ensureAdapter({ openwa }) {
  const installed = (await openwa.plugins()).find((plugin) => plugin.id === ADAPTER_ID);
  if (installed) return;
  const entry = (await openwa.catalog()).find((plugin) => plugin.id === ADAPTER_ID);
  if (!entry?.download) throw new ProvisionError("adapter_missing", "O catálogo do OpenWA não trouxe o adaptador do Chatwoot.", "Instale o chatwoot-adapter pelo painel do OpenWA, em Plugins.");
  await openwa.installFromUrl(entry.download);
}

/**
 * Liga o adaptador depois de a instância existir, e só aceita quando ele está saudável. O chatwoot-adapter
 * 0.9.17 confere a configuração base ao ligar, e a da instância não basta: ligado antes, ele fica em erro
 * ("missing/invalid config") e nenhuma mensagem passa, com o número conectado (achado da Atrupe, 2026-11-11).
 * A configuração base recebe a desta conexão só quando o adaptador ainda não está saudável; cada instância
 * continua com a sua. O OpenWA devolve o apiToken mascarado em toda leitura: ele vem do estado, nunca de lá.
 */
export async function startAdapter({ openwa, config }) {
  const plugin = (await openwa.plugins()).find((item) => item.id === ADAPTER_ID);
  const before = await openwa.pluginHealth(ADAPTER_ID).catch(() => null);
  if (adapterEnabled(plugin) && before?.healthy === true) return { started: false };
  const updated = await openwa.setPluginConfig(ADAPTER_ID, config);
  if (updated?.success === false) throw new ProvisionError("adapter_config", `O OpenWA recusou a configuração do adaptador: ${updated.message ?? "sem motivo"}.`, "Confira os logs do OpenWA e o endereço público do Chatwoot.");
  const enabled = await openwa.enablePlugin(ADAPTER_ID);
  if (enabled?.success === false) throw new ProvisionError("adapter_enable", `O OpenWA não ligou o adaptador: ${enabled.message ?? "sem motivo"}.`, "Confira os logs do OpenWA (chatwoot-adapter).");
  const health = await openwa.pluginHealth(ADAPTER_ID);
  if (health?.healthy !== true) {
    throw new ProvisionError("adapter_unhealthy", `O adaptador do Chatwoot ligou, mas não está saudável: ${health?.message ?? "sem resposta"}.`, "Confira os logs do OpenWA (chatwoot-adapter) e se o Chatwoot responde pelo endereço público.");
  }
  return { started: true };
}

/**
 * Rota não oficial: caixa API no Chatwoot, pessoa de repasse (atendente), webhook da conta com o segredo
 * gerado pelo Chatwoot, sessão do OpenWA e instância do adaptador com esse mesmo segredo, nessa ordem
 * (o segredo só nasce no Chatwoot; o README do adaptador manda criar a instância pela API com ele).
 * input: { sessionName, inboxName, relayEmail, chatwootPublicUrl, openwaUrl, openwaPublicUrl, openwaApiKey }
 */
export async function connectOpenWA({ chatwootUrl, platformToken, state, input, fetchImpl = fetch }) {
  if (!/^[a-zA-Z0-9-]{3,50}$/.test(String(input.sessionName ?? ""))) {
    throw new ProvisionError("session_name_invalid", "O nome da sessão do OpenWA aceita letras, números e hífen, de 3 a 50.", "Use algo como cliente-123.");
  }
  if (!/^https:\/\//.test(String(input.chatwootPublicUrl ?? "")) || !/^https:\/\//.test(String(input.openwaPublicUrl ?? ""))) {
    throw new ProvisionError("public_https_required", "O adaptador só fala com endereços públicos https.", "Configure CHATWOOT_PUBLIC_URL e OPENWA_PUBLIC_URL com https e domínio público.");
  }
  const platform = chatwootPlatform({ url: chatwootUrl, token: platformToken, fetchImpl });
  const account = chatwootAccount({ url: chatwootUrl, token: state.service_token, accountId: state.account_id, fetchImpl });
  const openwa = openwaClient({ url: input.openwaUrl, apiKey: input.openwaApiKey, fetchImpl });
  let next = { ...state };

  if (!next.relay_user_id || !next.relay_token) {
    if (!input.relayEmail) throw new ProvisionError("relay_email_missing", "Falta o e-mail da pessoa de repasse do OpenWA.", "Passe input.relayEmail, um endereço do domínio do projeto que ninguém usa para entrar.");
    const relay = await platform.createUser({ name: RELAY_NAME, display_name: RELAY_NAME, email: input.relayEmail, password: strongPassword() });
    await platform.addAccountUser(next.account_id, { user_id: relay.id, role: "agent" });
    next.relay_user_id = relay.id;
    next.relay_name = RELAY_NAME;
    next.relay_token = (await platform.user(relay.id)).access_token;
  }

  const inbox = await account.createInbox({ name: input.inboxName ?? "WhatsApp", channel: { type: "api" } });
  await account.addInboxMembers(inbox.id, [next.relay_user_id, ...Object.values(next.staff ?? {})]);

  const ingress = adapterIngressUrl(input.openwaPublicUrl, input.sessionName);
  const webhook = await account.createWebhook({ url: ingress, subscriptions: ADAPTER_SUBSCRIPTIONS });
  if (!webhook?.secret) throw new ProvisionError("webhook_secret_missing", "O Chatwoot não devolveu o segredo do webhook.", "Use Chatwoot 4.12 ou mais novo; a versão do kit é a 4.19.1.");

  await ensureAdapter({ openwa });
  const session = await openwa.createSession(input.sessionName);
  await openwa.startSession(session.id);
  const adapterConfig = {
    baseUrl: input.chatwootPublicUrl,
    apiToken: next.relay_token,
    accountId: next.account_id,
    inboxId: inbox.id,
    // Grupos só entram quando a configuração do robô pede (D23); syncOpenWAGroups muda depois.
    relayGroups: input.relayGroups === true,
    relayMedia: true,
    relayOwnMessages: true,
    backfillLimit: 0,
  };
  const instance = await openwa.createInstance(ADAPTER_ID, {
    instanceId: input.sessionName,
    sessionScope: session.id,
    secret: webhook.secret,
    config: adapterConfig,
  });
  const given = (instance?.ingressUrls ?? []).find((item) => item.route === "chatwoot")?.url;
  if (given && /^https?:\/\//.test(given) && given !== ingress) await account.updateWebhook(webhook.id, { url: given });
  await startAdapter({ openwa, config: adapterConfig });

  await account.setAgentBot(inbox.id, next.bot_id);
  next = {
    ...next,
    inboxes: [...(next.inboxes ?? []), { id: inbox.id, route: "nao_oficial", session_id: session.id, instance_id: input.sessionName, webhook_id: webhook.id }],
  };
  return { state: next, inboxId: inbox.id, sessionId: session.id };
}

/**
 * Estado da sessão do OpenWA, o que a conferência acha dele e, enquanto ela espera, o QR para a tela mostrar.
 * Com o OpenWA fora do ar, não lança: devolve o estado unknown com o achado.
 */
export async function whatsappStatus({ openwaUrl, openwaApiKey, sessionId, fetchImpl = fetch }) {
  const openwa = openwaClient({ url: openwaUrl, apiKey: openwaApiKey, fetchImpl });
  let session;
  try {
    session = await openwa.session(sessionId);
  } catch (error) {
    const failure = openwaFailure(error);
    return { status: "unknown", qrCode: null, level: failure.level, findings: [failure] };
  }
  const status = session?.status ?? "unknown";
  const findings = classifySession(session);
  const level = worstLevel(findings.map((item) => item.level));
  if (status === "qr_ready") {
    try {
      const { qrCode } = await openwa.qr(sessionId);
      return { status, qrCode, level, findings };
    } catch {
      return { status, qrCode: null, level, findings };
    }
  }
  return { status, qrCode: null, level, findings };
}

/**
 * Ler o QR de novo: retoma a sessão que a caixa já tem, sem criar outra caixa nem outra sessão. Sessão parada
 * (sem o motor carregado) recebe o pedido de início; com o motor carregado, o OpenWA já está tentando ou já
 * mostra o QR, e o início responderia 400. Depois, a tela acompanha pelo whatsappStatus.
 */
export async function reconnectOpenWA({ openwaUrl, openwaApiKey, sessionId, fetchImpl = fetch }) {
  const openwa = openwaClient({ url: openwaUrl, apiKey: openwaApiKey, fetchImpl });
  let session;
  try {
    session = await openwa.session(sessionId);
  } catch (error) {
    if (error?.code === "http_404") throw new ProvisionError("session_missing", "A sessão do OpenWA desta caixa não existe mais.", "Use Conectar outro número na tela Conectar WhatsApp.");
    throw error;
  }
  if (session?.status === "ready" || session?.engineLoaded === true) return { status: session.status, started: false };
  try {
    await openwa.startSession(sessionId);
  } catch (error) {
    if (error?.code !== "http_400") throw error;
    return { status: session?.status ?? "unknown", started: false };
  }
  return { status: "initializing", started: true };
}

/**
 * Grupos do WhatsApp na rota não oficial (D23). Liga ou desliga o repasse dos grupos no adaptador de cada
 * caixa não oficial da conta (relay: o modo dos grupos não é "fora", de groupSettings) e, com eles ligados,
 * dá a cada grupo no painel o nome que ele tem no WhatsApp, porque o adaptador cria o contato do grupo com o
 * identificador no lugar do nome e nunca o renomeia (chatwoot-adapter 0.9.15, inbound.ts e relay.ts).
 * Pode rodar de novo sem mudar nada. Uma sessão que não lista os grupos (celular desconectado) fica para a
 * próxima vez, em unread. A mudança do repasse vale a partir da próxima mensagem: o histórico não entra.
 */
export async function syncOpenWAGroups({ chatwootUrl, state, openwaUrl, openwaApiKey, relay, fetchImpl = fetch }) {
  const inboxes = (state?.inboxes ?? []).filter((inbox) => inbox.route === "nao_oficial" && inbox.instance_id);
  const result = { sessions: inboxes.length, changed: 0, renamed: 0, unread: 0 };
  if (!inboxes.length) return result;
  const openwa = openwaClient({ url: openwaUrl, apiKey: openwaApiKey, fetchImpl });
  const names = new Map();
  for (const inbox of inboxes) {
    const instance = await openwa.instance(ADAPTER_ID, inbox.instance_id);
    const config = instance?.config ?? {};
    // O adaptador trata o campo ausente como ligado (index.ts: raw.relayGroups !== false).
    if ((config.relayGroups !== false) !== (relay === true)) {
      await openwa.updateInstance(ADAPTER_ID, inbox.instance_id, { config: { ...config, relayGroups: relay === true } });
      result.changed += 1;
    }
    if (relay !== true || !inbox.session_id) continue;
    try {
      for (const group of await openwa.groups(inbox.session_id)) {
        if (group?.id && String(group.name ?? "").trim()) names.set(group.id, group.name);
      }
    } catch {
      result.unread += 1;
    }
  }
  if (!names.size) return result;
  const account = chatwootAccount({ url: chatwootUrl, token: state.service_token, accountId: state.account_id, fetchImpl });
  for (let page = 1; page <= 100; page += 1) {
    const { contacts, more } = await account.searchContacts("@g.us", page);
    for (const contact of contacts) {
      const subject = names.get(contact.identifier);
      if (!subject) continue;
      const wanted = groupContactName(subject);
      if (contact.name !== wanted) {
        await account.updateContact(contact.id, { name: wanted });
        result.renamed += 1;
      }
    }
    if (!more) break;
  }
  return result;
}

/**
 * Grupos da equipe (D26): cada grupo é uma caixa interna da conta (canal API, sem número, sem robô, sem
 * endereço de retorno) com uma conversa fixa, onde os membros escrevem e se mencionam nas notas. Só os
 * membros da caixa a veem (invariante 17), e nada escrito nela sai do painel (invariante 16). Os grupos
 * moram em state.team_groups, nunca em state.inboxes, que é a lista das caixas do WhatsApp.
 */
export const TEAM_GROUP_PREFIX = "Equipe: ";
const TEAM_GROUP_KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;
const LABEL_TITLE = /^[\p{L}\p{N}_-]{1,40}$/u;

/** Confere o grupo antes de mexer no Chatwoot; members são as chaves (Person.key) das pessoas. */
export function teamGroupInput(group) {
  const key = String(group?.key ?? "").trim();
  if (!TEAM_GROUP_KEY.test(key)) throw new ProvisionError("team_group_key", "A chave do grupo aceita letras minúsculas, números e hífen, até 40.", "Gere a chave no projeto, por exemplo g-1a2b3c4d.");
  const name = String(group?.name ?? "").trim().replace(/\s+/g, " ");
  if (!name || name.length > 60) throw new ProvisionError("team_group_name", "O nome do grupo precisa de texto, com até 60 caracteres.", "Use algo como Comercial ou Suporte noturno.");
  const labels = [...new Set((Array.isArray(group?.labels) ? group.labels : []).map((label) => String(label).trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean))];
  const invalid = labels.find((label) => !LABEL_TITLE.test(label));
  if (invalid) throw new ProvisionError("team_group_label", `A etiqueta ${invalid} usa caractere que o painel não aceita.`, "Use letras, números, hífen e sublinhado.");
  if (labels.length > 10) throw new ProvisionError("team_group_label", "São no máximo 10 etiquetas por grupo.", "Tire as que se repetem.");
  const members = [...new Set((Array.isArray(group?.members) ? group.members : []).map(String))];
  if (!members.length) throw new ProvisionError("team_group_members", "O grupo precisa de pelo menos uma pessoa.", "Escolha quem participa.");
  return { key, name, labels, members };
}

async function ensureAccountLabels(account, titles) {
  if (!titles.length) return;
  const existing = new Set((await account.labels()).map((label) => label.title));
  for (const title of titles) {
    if (!existing.has(title)) await account.createLabel({ title, description: "Etiqueta de grupo da equipe", color: "#6366F1", show_on_sidebar: true });
  }
}

/**
 * Cria ou muda um grupo da equipe. As pessoas precisam já estar na equipe da conta (state.staff, por
 * ensureStaffUser); as que não estão voltam em missing e ficam fora. Arquivado, o grupo volta a valer.
 * Devolve { state, missing } para o projeto gravar.
 */
export async function saveTeamGroup({ chatwootUrl, state, group, fetchImpl = fetch }) {
  const input = teamGroupInput(group);
  const staff = state?.staff ?? {};
  const present = input.members.filter((key) => staff[key]);
  const missing = input.members.filter((key) => !staff[key]);
  if (!present.length) throw new ProvisionError("team_group_members", "Nenhuma pessoa escolhida está na equipe do painel ainda.", "Peça para a pessoa entrar uma vez no atendimento, ou crie a pessoa na equipe antes.");
  const userIds = present.map((key) => staff[key]);
  const account = chatwootAccount({ url: chatwootUrl, token: state.service_token, accountId: state.account_id, fetchImpl });
  const groups = { ...(state.team_groups ?? {}) };
  const title = `${TEAM_GROUP_PREFIX}${input.name}`;
  let current = groups[input.key];

  if (!current) {
    // Sem atribuição automática: o grupo é de todos os membros, não de quem o rodízio escolher.
    const inbox = await account.createInbox({ name: title, channel: { type: "api" }, enable_auto_assignment: false });
    const contact = await account.createContact({ inbox_id: inbox.id, name: title, identifier: `equipe:${input.key}` });
    if (!contact?.id) throw new ProvisionError("team_group_contact", "O Chatwoot não devolveu o contato do grupo.", "Confira se a conta de serviço é administradora.");
    const conversation = await account.createConversation({ inbox_id: inbox.id, contact_id: contact.id, status: "open" });
    current = { inbox_id: inbox.id, contact_id: contact.id, conversation_id: conversation.id };
  } else if (current.name !== input.name) {
    await account.updateInbox(current.inbox_id, { name: title });
    await account.updateContact(current.contact_id, { name: title });
  }

  await account.setInboxMembers(current.inbox_id, userIds);
  await account.setParticipants(current.conversation_id, userIds);
  await ensureAccountLabels(account, input.labels);
  await account.setConversationLabels(current.conversation_id, input.labels);
  if (current.archived) await account.setConversationStatus(current.conversation_id, "open");

  groups[input.key] = {
    inbox_id: current.inbox_id,
    contact_id: current.contact_id,
    conversation_id: current.conversation_id,
    name: input.name,
    members: present,
    labels: input.labels,
    archived: false,
  };
  return { state: { ...state, team_groups: groups }, missing };
}

/**
 * Arquiva um grupo: todos saem da caixa e da conversa, e o histórico fica guardado na conta. Salvar de novo
 * com a mesma chave traz o grupo de volta.
 */
export async function archiveTeamGroup({ chatwootUrl, state, key, fetchImpl = fetch }) {
  const current = state?.team_groups?.[key];
  if (!current || current.archived) return { state, archived: false };
  const account = chatwootAccount({ url: chatwootUrl, token: state.service_token, accountId: state.account_id, fetchImpl });
  const userIds = (current.members ?? []).map((member) => state.staff?.[member]).filter(Boolean);
  if (userIds.length) {
    await account.removeParticipants(current.conversation_id, userIds);
    await account.removeInboxMembers(current.inbox_id, userIds);
  }
  await account.setConversationStatus(current.conversation_id, "resolved");
  return { state: { ...state, team_groups: { ...state.team_groups, [key]: { ...current, members: [], archived: true } } }, archived: true };
}

/**
 * A rotina dos grupos da equipe. Reabre a conversa de um grupo que a resolução automática fechou, porque a
 * mensagem de quem é da equipe não reabre conversa no Chatwoot (message.rb, reopen_conversation só olha a
 * mensagem recebida). Tira da lista de membros quem já saiu da equipe (syncStaff a tira da conta, e com ela
 * das caixas). Devolve { state, reopened, pruned }; grave o estado quando pruned não for vazio.
 */
export async function syncTeamGroups({ chatwootUrl, state, fetchImpl = fetch }) {
  const groups = state?.team_groups ?? {};
  const active = Object.entries(groups).filter(([, group]) => !group.archived);
  const result = { state, reopened: [], pruned: [] };
  if (!active.length) return result;
  const account = chatwootAccount({ url: chatwootUrl, token: state.service_token, accountId: state.account_id, fetchImpl });
  const next = { ...groups };
  for (const [key, group] of active) {
    const conversation = await account.conversation(group.conversation_id);
    if (conversation?.status && conversation.status !== "open") {
      await account.setConversationStatus(group.conversation_id, "open");
      result.reopened.push(key);
    }
    const members = (group.members ?? []).filter((member) => state.staff?.[member]);
    if (members.length !== (group.members ?? []).length) {
      next[key] = { ...group, members };
      result.pruned.push(key);
    }
  }
  if (result.pruned.length) result.state = { ...state, team_groups: next };
  return result;
}

/** Uma página do projeto como aba dentro de cada conversa da conta (Dashboard App), sem repetir. */
export async function ensureDashboardApp({ chatwootUrl, state, title, url, fetchImpl = fetch }) {
  if (!/^https:\/\//.test(String(url ?? ""))) throw new ProvisionError("dashboard_app_url", "A página da aba precisa de endereço https.", "Use uma página do sistema, por exemplo a ficha do cliente.");
  const account = chatwootAccount({ url: chatwootUrl, token: state.service_token, accountId: state.account_id, fetchImpl });
  const existing = (await account.dashboardApps()).find((app) => app.title === title);
  if (existing) return existing;
  return account.createDashboardApp({ title, url });
}

/** O histórico que a rota history devolve ao robô, no formato da memória dele. */
export async function conversationHistory({ chatwootUrl, state, conversationId, limit = 20, fetchImpl = fetch }) {
  const account = chatwootAccount({ url: chatwootUrl, token: state.service_token, accountId: state.account_id, fetchImpl });
  const messages = await account.messages(conversationId);
  return messages
    .filter((message) => !message.private && [0, 1].includes(Number(message.message_type)) && String(message.content ?? "").trim())
    .map((message) => ({
      role: Number(message.message_type) === 0 ? "cliente" : message.sender?.type === "agent_bot" ? "robo" : "equipe",
      text: String(message.content),
      at: new Date(Number(message.created_at) * 1000).toISOString(),
    }))
    .slice(-Math.max(1, Math.min(Number(limit) || 20, 50)));
}
