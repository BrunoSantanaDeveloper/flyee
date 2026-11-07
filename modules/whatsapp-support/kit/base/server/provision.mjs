// O que o servidor do projeto faz no Chatwoot e no OpenWA para cada cliente (cada conta do Chatwoot).
// Tudo é idempotente: recebe o estado que o projeto guardou, completa o que falta e devolve o estado novo,
// que o projeto grava de novo (os tokens são segredos: guarde cifrados, nunca em log).

import { randomBytes } from "node:crypto";

import { chatwootAccount, chatwootPlatform, chatwootProfile } from "./chatwoot.mjs";
import { ADAPTER_ID, adapterIngressUrl, openwaClient } from "./openwa.mjs";

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

export const ADAPTER_SUBSCRIPTIONS = ["message_created", "conversation_updated", "conversation_status_changed"];

export class ProvisionError extends Error {
  constructor(code, message, fix) {
    super(message);
    this.code = code;
    this.fix = fix;
  }
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
 * input: { name, locale, featuresOff, serviceEmail, botName, botUrl }
 */
export async function provisionAccount({ chatwootUrl, platformToken, state = {}, input, fetchImpl = fetch }) {
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
  return next;
}

/**
 * Uma pessoa da equipe do cliente: atendente (nunca administradora), membro de todas as caixas da conta,
 * com as preferências do painel lateral. person: { key, email, name }, key é o id da pessoa no projeto.
 */
export async function ensureStaffUser({ chatwootUrl, platformToken, state, person, uiSettings = DEFAULT_UI_SETTINGS, fetchImpl = fetch }) {
  const platform = chatwootPlatform({ url: chatwootUrl, token: platformToken, fetchImpl });
  const next = { staff: {}, ...state, staff: { ...(state.staff ?? {}) } };
  let userId = next.staff[person.key];
  if (!userId) {
    const user = await platform.createUser({ name: person.name, email: person.email, password: strongPassword() });
    userId = user.id;
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

  if (uiSettings) {
    const full = await platform.user(userId);
    if (full?.access_token) await chatwootProfile({ url: chatwootUrl, userToken: full.access_token, fetchImpl }).mergeUiSettings(uiSettings);
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
  const inbox = await account.createInbox({
    name: cloud.inboxName ?? "WhatsApp",
    channel: {
      type: "whatsapp",
      phone_number: cloud.phoneNumber,
      provider: "whatsapp_cloud",
      provider_config: { api_key: cloud.apiKey, phone_number_id: cloud.phoneNumberId, business_account_id: cloud.businessAccountId },
    },
  });
  await account.setAgentBot(inbox.id, state.bot_id);
  await addStaffToInbox(account, state, inbox.id);
  const next = { ...state, inboxes: [...(state.inboxes ?? []), { id: inbox.id, route: "oficial", phone: cloud.phoneNumber }] };
  return {
    state: next,
    inboxId: inbox.id,
    metaWebhook: { callbackUrl: inbox.callback_webhook_url ?? null, verifyToken: inbox.provider_config?.webhook_verify_token ?? null },
  };
}

/** Instala e liga o adaptador do Chatwoot no OpenWA, pelo catálogo (que traz o hash do pacote). */
export async function ensureAdapter({ openwa }) {
  const installed = (await openwa.plugins()).find((plugin) => plugin.id === ADAPTER_ID);
  if (!installed) {
    const entry = (await openwa.catalog()).find((plugin) => plugin.id === ADAPTER_ID);
    if (!entry?.download) throw new ProvisionError("adapter_missing", "O catálogo do OpenWA não trouxe o adaptador do Chatwoot.", "Instale o chatwoot-adapter pelo painel do OpenWA, em Plugins.");
    await openwa.installFromUrl(entry.download);
  }
  if (!installed?.enabled) await openwa.enablePlugin(ADAPTER_ID);
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
    const relay = await platform.createUser({ name: "Repasse WhatsApp", email: input.relayEmail, password: strongPassword() });
    await platform.addAccountUser(next.account_id, { user_id: relay.id, role: "agent" });
    next.relay_user_id = relay.id;
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
  const instance = await openwa.createInstance(ADAPTER_ID, {
    instanceId: input.sessionName,
    sessionScope: session.id,
    secret: webhook.secret,
    config: {
      baseUrl: input.chatwootPublicUrl,
      apiToken: next.relay_token,
      accountId: next.account_id,
      inboxId: inbox.id,
      relayGroups: false,
      relayMedia: true,
      relayOwnMessages: true,
      backfillLimit: 0,
    },
  });
  const given = (instance?.ingressUrls ?? []).find((item) => item.route === "chatwoot")?.url;
  if (given && /^https?:\/\//.test(given) && given !== ingress) await account.updateWebhook(webhook.id, { url: given });

  await account.setAgentBot(inbox.id, next.bot_id);
  next = {
    ...next,
    inboxes: [...(next.inboxes ?? []), { id: inbox.id, route: "nao_oficial", session_id: session.id, instance_id: input.sessionName, webhook_id: webhook.id }],
  };
  return { state: next, inboxId: inbox.id, sessionId: session.id };
}

/** Estado da sessão do OpenWA e, enquanto ela espera, o QR para a tela mostrar. */
export async function whatsappStatus({ openwaUrl, openwaApiKey, sessionId, fetchImpl = fetch }) {
  const openwa = openwaClient({ url: openwaUrl, apiKey: openwaApiKey, fetchImpl });
  const session = await openwa.session(sessionId);
  const status = session?.status ?? "unknown";
  if (status === "qr_ready") {
    try {
      const { qrCode } = await openwa.qr(sessionId);
      return { status, qrCode };
    } catch {
      return { status, qrCode: null };
    }
  }
  return { status, qrCode: null };
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
