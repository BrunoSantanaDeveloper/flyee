// Ligação do kit de atendimento com este projeto (modelo para Next.js App Router).
// Este arquivo é do projeto: a IA o copia uma vez e adapta o armazenamento, a sessão e as consultas.
// Os arquivos da base (pasta base/ do kit) não se editam; ajuste só os caminhos de import.
//
// Dois modelos (escolhas.json, campo "modelo"):
//   "plataforma"   o sistema atende os próprios clientes (suporte da plataforma). Uma conta no Chatwoot;
//                  a equipe é a do sistema; o contexto do robô é só do superadmin.
//   "por-cliente"  cada cliente do sistema atende os clientes dele. Uma conta por cliente; o superadmin
//                  define as regras da plataforma e o que cada cliente pode mudar no robô dele.

import { summarizeGaps, GAP_CATEGORIES } from "../atendimento/base/shared/report.mjs";
import {
  applyClientEdits,
  botConfig,
  canEnterPanel,
  clientPermissions,
  defaultPlatformSettings,
  defaultSettings,
  editableGroups,
  groupSettings,
  knowledgeOwner,
  validateSettings,
  type BotSettings,
  type Model,
  type PlatformSettings,
  type Scope,
} from "../atendimento/base/shared/settings.mjs";
import {
  createToolRunner,
  handleBotRequest,
  mediaSupport,
  type BotRequest,
  type GapEventPayload,
  type ProjectTool,
} from "../atendimento/base/server/bot-contract.mjs";
import { checkWhatsappHealth, currentInbox, healthAlerts, type WhatsappAlert } from "../atendimento/base/server/health.mjs";
import {
  archiveTeamGroup,
  connectCloudApi,
  connectOpenWA,
  conversationHistory,
  ensureStaffUser,
  provisionAccount,
  reconnectOpenWA,
  removeStaffUser,
  saveTeamGroup,
  ssoUrl,
  syncOpenWAGroups,
  syncStaff,
  syncTeamGroups,
  updateCloudApi,
  whatsappStatus,
  type SupportState,
} from "../atendimento/base/server/provision.mjs";
import { brPhoneVariants, contactPhone, samePhone } from "../atendimento/base/shared/phone.mjs";
import escolhas from "../atendimento/escolhas.json";

export const MODEL: Model = escolhas.modelo === "plataforma" ? "plataforma" : "por-cliente";
/** No modelo plataforma, o "cliente" do atendimento é o próprio sistema. */
export const PLATFORM_TENANT = "plataforma";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta a variável de ambiente ${name} do atendimento.`);
  return value;
}

/** Lidas na hora do uso, para o build não exigir os segredos. */
export const env = {
  chatwootUrl: () => required("CHATWOOT_URL"),
  chatwootPublicUrl: () => required("CHATWOOT_PUBLIC_URL"),
  platformToken: () => required("CHATWOOT_PLATFORM_TOKEN"),
  botPublicUrl: () => required("SUPPORT_BOT_PUBLIC_URL"),
  botSecret: () => required("SUPPORT_BOT_SECRET"),
  serviceEmailDomain: () => required("SUPPORT_SERVICE_EMAIL_DOMAIN"),
  openwaUrl: () => required("OPENWA_URL"),
  openwaPublicUrl: () => required("OPENWA_PUBLIC_URL"),
  openwaApiKey: () => required("OPENWA_API_KEY"),
};

/** A pessoa logada no projeto, do jeito que este projeto sabe. */
export interface Person {
  /** O cliente da pessoa; no modelo plataforma, ignorado. */
  tenantId: string;
  key: string;
  email: string;
  name: string;
  /** Superadmin do sistema: edita a camada da plataforma, vê todas as sugestões e lacunas. */
  isSuperadmin: boolean;
  /** Administrador do cliente (modelo por-cliente): edita o que a plataforma liberou, conecta o número e atende. */
  canConfigure: boolean;
  /**
   * Atende no painel. No modelo plataforma, a equipe de suporte do sistema; no por-cliente, quem o cliente
   * marcou como equipe de atendimento. Quem não tem esta marca nem canConfigure não entra no painel.
   */
  isSupportStaff: boolean;
}

export interface StoredSuggestion {
  id: string;
  tenantId: string;
  owner: Scope;
  conversationId: number;
  q: string;
  a: string;
  why: string;
  at: string;
}

/** Onde o projeto guarda o atendimento. ADAPTE: use o banco e a sessão do projeto. */
export interface SupportStore {
  currentPerson(request: Request): Promise<Person | null>;
  tenantName(tenantId: string): Promise<string>;
  /** Contém tokens: grave cifrado, nunca em log. */
  loadState(tenantId: string): Promise<SupportState | null>;
  saveState(tenantId: string, state: SupportState): Promise<void>;
  tenantByAccount(accountId: number): Promise<string | null>;
  /**
   * As chaves (Person.key) de quem pode atender neste cliente hoje, com a mesma regra de canEnterPanel.
   * No modelo plataforma, tenantId é PLATFORM_TENANT. A conferência diária tira do Chatwoot quem saiu da lista.
   */
  listPanelPeople(tenantId: string): Promise<string[]>;
  /**
   * As mesmas pessoas de listPanelPeople, com nome e e-mail, para escolher quem entra num grupo da equipe.
   * Quem ainda não entrou no painel entra na equipe do Chatwoot quando é posto num grupo.
   */
  teamPeople(tenantId: string): Promise<Array<{ key: string; name: string; email: string }>>;
  /**
   * Avisa que o WhatsApp do atendimento parou, pede atenção ou voltou, pelo canal que o projeto já tem
   * (e-mail, notificação no sistema). Cada aviso traz title e text prontos, sem segredo. Mande para quem
   * conecta o número (no modelo plataforma, o superadmin; no por-cliente, quem administra o cliente) e,
   * quando fixBy for "tecnico", também para quem cuida do servidor. Se lançar erro, o aviso volta na próxima
   * conferência.
   */
  alertWhatsapp(tenantId: string, alerts: WhatsappAlert[]): Promise<void>;
  /** A camada da plataforma (uma só no sistema), editada pelo superadmin. */
  loadPlatformSettings(): Promise<PlatformSettings | null>;
  savePlatformSettings(settings: PlatformSettings): Promise<void>;
  /** A camada de cada cliente (modelo por-cliente). */
  loadSettings(tenantId: string): Promise<BotSettings | null>;
  saveSettings(tenantId: string, settings: BotSettings): Promise<void>;
  addSuggestions(items: Omit<StoredSuggestion, "id">[]): Promise<void>;
  listSuggestions(filter: { owner: Scope; tenantId?: string }): Promise<StoredSuggestion[]>;
  /** Tira a sugestão da fila e a devolve (aprovada ou descartada). */
  takeSuggestion(id: string): Promise<StoredSuggestion | null>;
  addEvent(tenantId: string, event: GapEventPayload): Promise<void>;
  listEvents(filter: { tenantId?: string; since: string }): Promise<GapEventPayload[]>;
}

const adapt = (what: string) => async (): Promise<never> => {
  throw new Error(`ADAPTE: ${what}.`);
};

export const store: SupportStore = {
  currentPerson: adapt("devolva a pessoa logada pela sessão do projeto"),
  tenantName: adapt("devolva o nome do cliente"),
  loadState: adapt("leia o estado do atendimento do cliente"),
  saveState: adapt("grave o estado do atendimento do cliente, cifrado"),
  tenantByAccount: adapt("encontre o cliente pela conta do Chatwoot (account_id do estado)"),
  listPanelPeople: adapt("liste as chaves de quem pode atender neste cliente hoje"),
  teamPeople: adapt("liste quem pode atender neste cliente hoje, com chave, nome e e-mail"),
  alertWhatsapp: adapt("avise quem conecta o número e, quando fixBy for tecnico, quem cuida do servidor"),
  loadPlatformSettings: adapt("leia a camada da plataforma"),
  savePlatformSettings: adapt("grave a camada da plataforma"),
  loadSettings: adapt("leia a camada do cliente"),
  saveSettings: adapt("grave a camada do cliente"),
  addSuggestions: adapt("guarde as sugestões de conhecimento"),
  listSuggestions: adapt("liste as sugestões de conhecimento"),
  takeSuggestion: adapt("tire uma sugestão da fila"),
  addEvent: adapt("guarde a passagem para a equipe"),
  listEvents: adapt("liste as passagens para a equipe"),
};

/**
 * As consultas que o robô pode fazer aos dados do projeto. Cada uma decide o que devolve e para quem:
 * só dados da pessoa da conversa, achada pelo telefone (ou por outra confirmação que o projeto exigir).
 * ADAPTE: troque o exemplo pelas consultas reais. O superadmin escolhe quais oferecer; no modelo
 * por-cliente, cada cliente liga as dele, se a plataforma deixar.
 */
export const tools: ProjectTool[] = [
  {
    name: "consultar_pedido",
    description: "Situação de um pedido da própria pessoa: recebido, em preparo, enviado ou entregue.",
    input_schema: { type: "object", properties: { numero: { type: "string", description: "Número do pedido" } }, required: ["numero"] },
    async run({ contact, input }) {
      const phones = brPhoneVariants(contactPhone(contact));
      if (!phones.length) return { ok: false, code: "sem_telefone", message: "Não deu para confirmar quem é a pessoa." };
      // ADAPTE: busque o pedido input.numero cujo cliente tem um dos telefones em phones.
      void input;
      return { ok: false, code: "nao_implementado" };
    },
  },
];

const declaredTools = tools.map((tool) => tool.name);

/**
 * O provedor de IA padrão do projeto; o superadmin pode trocar na camada da plataforma (ai). Um projeto
 * que não põe chave de IA no robô usa provider "project" e transcription "project", e implementa as rotas
 * generate e transcribe em botHandler (references/contratos.md, "Rotas que o projeto expõe ao robô").
 */
export const defaultAi = { provider: "anthropic", model: "claude-opus-5-5", effort: "low" } as const;

async function platformSettings(): Promise<PlatformSettings> {
  return (await store.loadPlatformSettings()) ?? defaultPlatformSettings("Nome do sistema");
}

function tenantOf(person: Person): string {
  return MODEL === "plataforma" ? PLATFORM_TENANT : person.tenantId;
}

/** Quem pode o quê em cada camada. */
function canEdit(person: Person | null, scope: Scope): boolean {
  if (!person) return false;
  if (scope === "plataforma") return person.isSuperadmin;
  return MODEL === "por-cliente" && person.canConfigure;
}

function canConnect(person: Person | null): boolean {
  if (!person) return false;
  return MODEL === "plataforma" ? person.isSuperadmin : person.canConfigure || person.isSuperadmin;
}

/** Cria, se faltar, a conta no Chatwoot, a conta de serviço e o robô. */
export async function ensureAccount(tenantId: string): Promise<SupportState> {
  const current = (await store.loadState(tenantId)) ?? {};
  const next = await provisionAccount({
    chatwootUrl: env.chatwootUrl(),
    platformToken: env.platformToken(),
    state: current,
    input: {
      name: MODEL === "plataforma" ? (await platformSettings()).brand || "Suporte" : await store.tenantName(tenantId),
      locale: "pt_BR",
      featuresOff: escolhas.chatwoot.features_off,
      // Conversa parada volta ao robô depois deste tempo (padrão 8 horas, 0 desliga).
      autoResolveHours: (escolhas.chatwoot as { resolver_apos_horas?: number | null }).resolver_apos_horas,
      serviceEmail: `atendimento+${tenantId}@${env.serviceEmailDomain()}`,
      botName: escolhas.robo?.nome ?? "Assistente virtual",
      botUrl: env.botPublicUrl(),
    },
  });
  if (JSON.stringify(next) !== JSON.stringify(current)) await store.saveState(tenantId, next);
  return next;
}

export type EnterResult = { ok: true; url: string } | { ok: false; code: "unauthenticated" | "not_support_staff" };

/** O link de entrada no painel para a pessoa logada (vale 5 minutos e uma vez só). */
export async function enterPanel(request: Request): Promise<EnterResult> {
  const person = await store.currentPerson(request);
  if (!person) return { ok: false, code: "unauthenticated" };
  const tenantId = tenantOf(person);
  if (!canEnterPanel(MODEL, person)) {
    // Quem perdeu a permissão e ainda estava na equipe sai do Chatwoot aqui também. Se o Chatwoot não
    // responder, a recusa continua valendo e a conferência diária (syncPanelStaff) tira a pessoa depois.
    await removeFromPanel(tenantId, person.key).catch(() => false);
    return { ok: false, code: "not_support_staff" };
  }
  const state = await ensureAccount(tenantId);
  const { state: next, userId } = await ensureStaffUser({
    chatwootUrl: env.chatwootUrl(),
    platformToken: env.platformToken(),
    state,
    person: { key: person.key, email: person.email, name: person.name },
  });
  await store.saveState(tenantId, next);
  return { ok: true, url: await ssoUrl({ chatwootUrl: env.chatwootUrl(), platformToken: env.platformToken(), userId }) };
}

/**
 * Tira a pessoa da equipe deste cliente no Chatwoot. ADAPTE: chame no ponto em que o projeto tira a
 * permissão de atendimento, desativa ou apaga a pessoa. As conversas atribuídas a ela voltam para a fila.
 */
export async function removeFromPanel(tenantId: string, personKey: string): Promise<boolean> {
  const state = await store.loadState(tenantId);
  if (!state?.staff?.[personKey]) return false;
  const { state: next, removed } = await removeStaffUser({ chatwootUrl: env.chatwootUrl(), platformToken: env.platformToken(), state, personKey });
  await store.saveState(tenantId, next);
  return removed !== null;
}

/**
 * Conferência da equipe: tira do Chatwoot quem saiu da lista do projeto e aponta quem está na conta sem
 * ter sido posto pelo kit. ADAPTE: rode numa rotina diária do projeto, para cada cliente com atendimento
 * (no modelo plataforma, só PLATFORM_TENANT).
 */
export async function syncPanelStaff(tenantId: string) {
  const state = await store.loadState(tenantId);
  if (!state?.account_id) return { removed: [], unknown: [], skipped: "no_account" as const };
  const result = await syncStaff({
    chatwootUrl: env.chatwootUrl(),
    platformToken: env.platformToken(),
    state,
    keepKeys: await store.listPanelPeople(tenantId),
  });
  if (result.removed.length) await store.saveState(tenantId, result.state);
  return { removed: result.removed, unknown: result.unknown, skipped: result.skipped };
}

/**
 * Conferência do número: lê a sessão do OpenWA, ou a saúde que o Chatwoot consulta na Meta, e avisa pelo
 * alertWhatsapp quando o número para, pede atenção ou volta. Enquanto estiver parado, lembra uma vez por dia.
 * ADAPTE: rode a cada 15 minutos numa rotina do projeto, para cada cliente com atendimento (no modelo
 * plataforma, só PLATFORM_TENANT), em uma réplica só do servidor: duas ao mesmo tempo avisam duas vezes.
 * Sem ela, um número que cai só aparece quando um cliente reclama.
 */
export async function checkWhatsapp(tenantId: string) {
  const state = await store.loadState(tenantId);
  const inbox = currentInbox(state);
  if (!state?.account_id || !inbox) return { skipped: "no_inbox" as const, report: null, alerts: [] };
  const report = await checkWhatsappHealth({
    chatwootUrl: env.chatwootUrl(),
    state,
    openwa: inbox.route === "nao_oficial" ? { url: env.openwaUrl(), apiKey: env.openwaApiKey() } : null,
  });
  const { alerts, health } = healthAlerts({ previous: state.health, report });
  // Avisa antes de gravar: se o canal falhar, o aviso volta na próxima conferência.
  if (alerts.length) await store.alertWhatsapp(tenantId, alerts);
  if (JSON.stringify(health) !== JSON.stringify(state.health ?? {})) await store.saveState(tenantId, { ...state, health });
  return { skipped: null, report, alerts };
}

/** O que vale para os grupos do WhatsApp deste cliente: a camada dele, se liberada, senão a da plataforma. */
async function groupsFor(tenantId: string) {
  const platform = await platformSettings();
  const client = MODEL === "por-cliente" ? await store.loadSettings(tenantId) : null;
  return groupSettings({ model: MODEL, platform, client });
}

/**
 * Grupos do WhatsApp (só na rota não oficial): liga ou desliga o repasse dos grupos no OpenWA conforme a
 * configuração do robô e dá a cada grupo no painel o nome que ele tem no WhatsApp. Já roda ao salvar a
 * configuração. ADAPTE: rode na mesma rotina de checkWhatsapp, para cada cliente com atendimento: é ela que
 * leva ao número de cada cliente uma mudança feita na camada da plataforma e nomeia os grupos novos.
 */
export async function syncWhatsappGroups(tenantId: string) {
  const state = await store.loadState(tenantId);
  if (!state?.account_id || !(state.inboxes ?? []).some((inbox) => inbox.route === "nao_oficial")) return { skipped: "no_unofficial" as const };
  const groups = await groupsFor(tenantId);
  const result = await syncOpenWAGroups({
    chatwootUrl: env.chatwootUrl(),
    state,
    openwaUrl: env.openwaUrl(),
    openwaApiKey: env.openwaApiKey(),
    relay: groups.mode !== "fora",
  });
  return { skipped: null, mode: groups.mode, ...result };
}

/** Quem cria e muda os grupos da equipe (D26): o superadmin no modelo plataforma, quem administra o cliente no por-cliente. */
function canManageGroups(person: Person | null): boolean {
  if (!person) return false;
  return MODEL === "plataforma" ? person.isSuperadmin : person.canConfigure;
}

/** Os grupos da equipe deste cliente e as pessoas que podem entrar neles, para a tela GruposEquipe. */
export async function teamGroups(request: Request) {
  const person = await store.currentPerson(request);
  if (!canManageGroups(person)) return null;
  const tenantId = tenantOf(person!);
  const [state, people] = await Promise.all([store.loadState(tenantId), store.teamPeople(tenantId)]);
  return {
    grupos: Object.entries(state?.team_groups ?? {}).map(([chave, group]) => ({
      chave,
      nome: group.name,
      membros: group.members,
      etiquetas: group.labels,
      arquivado: group.archived,
    })),
    pessoas: people.map(({ key, name }) => ({ chave: key, nome: name })),
  };
}

/** Cria ou muda um grupo da equipe. Sem chave, cria um grupo novo. */
export async function saveTeamGroupFor(request: Request, body: { chave?: string; nome?: string; membros?: string[]; etiquetas?: string[] }) {
  const person = await store.currentPerson(request);
  if (!canManageGroups(person)) return { status: 403, body: { code: "forbidden", message: "Você não pode mudar os grupos da equipe." } };
  const tenantId = tenantOf(person!);
  const people = new Map((await store.teamPeople(tenantId)).map((item) => [item.key, item]));
  // Só entra num grupo quem pode atender neste cliente (canEnterPanel, pela lista do projeto).
  const members = (body.membros ?? []).filter((key) => people.has(key));
  let state = await ensureAccount(tenantId);
  for (const key of members) {
    if (state.staff?.[key]) continue;
    const item = people.get(key)!;
    state = (await ensureStaffUser({ chatwootUrl: env.chatwootUrl(), platformToken: env.platformToken(), state, person: { key, email: item.email, name: item.name } })).state;
  }
  await store.saveState(tenantId, state);
  const chave = body.chave?.trim() || `g-${crypto.randomUUID().slice(0, 8)}`;
  const result = await saveTeamGroup({ chatwootUrl: env.chatwootUrl(), state, group: { key: chave, name: body.nome ?? "", members, labels: body.etiquetas ?? [] } });
  await store.saveState(tenantId, result.state);
  return { status: 200, body: { ok: true, chave, fora: result.missing } };
}

/** Arquiva um grupo: todos saem dele e o histórico fica guardado. */
export async function archiveTeamGroupFor(request: Request, chave: string) {
  const person = await store.currentPerson(request);
  if (!canManageGroups(person)) return { status: 403, body: { code: "forbidden", message: "Você não pode mudar os grupos da equipe." } };
  const tenantId = tenantOf(person!);
  const state = await store.loadState(tenantId);
  if (!state?.team_groups?.[chave]) return { status: 404, body: { code: "not_found", message: "Este grupo não existe." } };
  const result = await archiveTeamGroup({ chatwootUrl: env.chatwootUrl(), state, key: chave });
  await store.saveState(tenantId, result.state);
  return { status: 200, body: { ok: true } };
}

/**
 * A rotina dos grupos da equipe: reabre o grupo que a resolução automática fechou e tira da lista quem saiu
 * da equipe. ADAPTE: rode na mesma rotina de checkWhatsapp, a cada 15 minutos, para cada cliente com atendimento.
 */
export async function syncTeamGroupsFor(tenantId: string) {
  const state = await store.loadState(tenantId);
  if (!state?.team_groups || !state.account_id) return { skipped: "no_groups" as const, reopened: [], pruned: [] };
  const result = await syncTeamGroups({ chatwootUrl: env.chatwootUrl(), state });
  if (result.pruned.length) await store.saveState(tenantId, result.state);
  return { skipped: null, reopened: result.reopened, pruned: result.pruned };
}

/** Depois de salvar uma mudança nos grupos: aplica na hora; se o OpenWA não responder, a rotina aplica depois. */
async function applyGroups(tenantId: string): Promise<string | null> {
  try {
    await syncWhatsappGroups(tenantId);
    return null;
  } catch {
    return "A configuração foi salva. A mudança nos grupos vale na próxima conferência, porque o WhatsApp não respondeu agora.";
  }
}

export async function readSettings(request: Request, scope: Scope) {
  const person = await store.currentPerson(request);
  if (!canEdit(person, scope)) return null;
  const platform = await platformSettings();
  const settings = scope === "plataforma" ? platform : (await store.loadSettings(person!.tenantId)) ?? defaultSettings(await store.tenantName(person!.tenantId));
  const offered = Array.isArray(platform.tools_available) ? platform.tools_available : declaredTools;
  const visibleTools = scope === "plataforma" ? tools : tools.filter((tool) => offered.includes(tool.name));
  const editable = editableGroups(scope, MODEL, platform);
  // A tela esconde "Ouvir áudios" quando o robô não tem quem transcreva (o /health dele e ai.transcription).
  const media = editable.includes("midia")
    ? await mediaSupport({ ai: { ...defaultAi, ...(platform.ai ?? {}) }, botUrl: env.botPublicUrl() })
    : { audio: null };
  return {
    model: MODEL,
    scope,
    settings,
    editable,
    tools: visibleTools.map(({ name, description }) => ({ name, description })),
    media,
  };
}

export async function writeSettings(request: Request, scope: Scope, incoming: unknown) {
  const person = await store.currentPerson(request);
  if (!canEdit(person, scope)) return { status: 403, body: { code: "forbidden", message: "Você não pode mudar esta parte do robô." } };
  if (scope === "plataforma") {
    const problems = validateSettings(incoming, { declaredTools, scope });
    if (problems.length) return { status: 422, body: { code: "invalid", message: "Confira os campos marcados.", problems } };
    const before = await platformSettings();
    await store.savePlatformSettings(incoming as PlatformSettings);
    // No por-cliente, a mudança chega ao número de cada cliente pela rotina (syncWhatsappGroups).
    const changed = JSON.stringify(before.groups ?? null) !== JSON.stringify((incoming as PlatformSettings).groups ?? null);
    const aviso = changed && MODEL === "plataforma" ? await applyGroups(PLATFORM_TENANT) : null;
    return { status: 200, body: { ok: true, ...(aviso ? { aviso } : {}) } };
  }
  const platform = await platformSettings();
  const current = await store.loadSettings(person!.tenantId);
  const next = applyClientEdits(current, incoming as Partial<BotSettings>, clientPermissions(MODEL, platform));
  const problems = validateSettings(next, { declaredTools, scope });
  if (problems.length) return { status: 422, body: { code: "invalid", message: "Confira os campos marcados.", problems } };
  await store.saveSettings(person!.tenantId, next);
  const aviso = JSON.stringify(current?.groups ?? null) !== JSON.stringify(next.groups ?? null) ? await applyGroups(person!.tenantId) : null;
  return { status: 200, body: { ok: true, ...(aviso ? { aviso } : {}) } };
}

/** As sugestões de conhecimento que esta pessoa revisa. */
export async function listSuggestionsFor(request: Request, scope: Scope) {
  const person = await store.currentPerson(request);
  if (!canEdit(person, scope)) return null;
  const items = await store.listSuggestions(scope === "plataforma" ? { owner: "plataforma" } : { owner: "cliente", tenantId: person!.tenantId });
  return { suggestions: items.map(({ id, q, a, why, at, tenantId }) => ({ id, q, a, why, at, tenant: scope === "plataforma" ? tenantId : null })) };
}

/** Aprovar põe a pergunta e a resposta (com as edições da pessoa) no conhecimento da camada dona. */
export async function decideSuggestion(request: Request, id: string, body: { decisao?: string; q?: string; a?: string }) {
  const person = await store.currentPerson(request);
  const pending = (await store.listSuggestions({ owner: "plataforma" })).concat(person ? await store.listSuggestions({ owner: "cliente", tenantId: person.tenantId }) : []);
  const item = pending.find((suggestion) => suggestion.id === id);
  if (!item || !canEdit(person, item.owner)) return { status: 404, body: { code: "not_found", message: "Esta sugestão não existe mais." } };
  if (body.decisao === "aprovar") {
    const entry = { q: String(body.q ?? item.q).trim(), a: String(body.a ?? item.a).trim() };
    if (!entry.q || !entry.a) return { status: 422, body: { code: "invalid", message: "A pergunta e a resposta precisam de texto." } };
    if (item.owner === "plataforma") {
      const platform = await platformSettings();
      await store.savePlatformSettings({ ...platform, knowledge: [...(platform.knowledge ?? []), entry] });
    } else {
      const current = (await store.loadSettings(item.tenantId)) ?? defaultSettings(await store.tenantName(item.tenantId));
      await store.saveSettings(item.tenantId, { ...current, knowledge: [...(current.knowledge ?? []), entry] });
    }
  }
  await store.takeSuggestion(id);
  return { status: 200, body: { ok: true } };
}

/** O relatório das lacunas: o superadmin vê todos os clientes; o administrador do cliente, só o dele. */
export async function gapsFor(request: Request, scope: Scope, days: number) {
  const person = await store.currentPerson(request);
  if (!canEdit(person, scope)) return null;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const events = await store.listEvents(scope === "plataforma" ? { since } : { since, tenantId: person!.tenantId });
  return { groups: summarizeGaps(events, { days }), categories: GAP_CATEGORIES };
}

export async function whatsapp(request: Request) {
  const person = await store.currentPerson(request);
  if (!canConnect(person)) return null;
  const state = (await store.loadState(tenantOf(person!))) ?? {};
  const inbox = currentInbox(state);
  if (!inbox) return { connected: false, route: null, status: null, qrCode: null, level: null, findings: [] };
  if (inbox.route === "oficial") {
    const current = (await checkWhatsappHealth({ chatwootUrl: env.chatwootUrl(), state })).inboxes[0];
    return { connected: current.level !== "fora", route: "oficial", status: null, qrCode: null, level: current.level, findings: current.findings };
  }
  const status = await whatsappStatus({ openwaUrl: env.openwaUrl(), openwaApiKey: env.openwaApiKey(), sessionId: inbox.session_id! });
  return { connected: status.status === "ready", route: "nao_oficial", ...status };
}

/** Ler o QR de novo: retoma a sessão que a caixa já tem, sem criar outra caixa. */
export async function reconnectWhatsapp(request: Request) {
  const person = await store.currentPerson(request);
  if (!canConnect(person)) return { status: 403, body: { code: "forbidden", message: "Você não pode conectar o número." } };
  const inbox = currentInbox(await store.loadState(tenantOf(person!)));
  if (inbox?.route !== "nao_oficial" || !inbox.session_id) return { status: 409, body: { code: "no_session", message: "Não há conexão pelo WhatsApp Web para retomar." } };
  const result = await reconnectOpenWA({ openwaUrl: env.openwaUrl(), openwaApiKey: env.openwaApiKey(), sessionId: inbox.session_id });
  return { status: 200, body: { ok: true, status: result.status } };
}

export async function connectWhatsapp(request: Request, body: Record<string, string>) {
  const person = await store.currentPerson(request);
  if (!canConnect(person)) return { status: 403, body: { code: "forbidden", message: "Você não pode conectar o número." } };
  const tenantId = tenantOf(person!);
  const state = await ensureAccount(tenantId);
  if (body.route === "oficial") {
    const cloud = { phoneNumber: body.phoneNumber, phoneNumberId: body.phoneNumberId, businessAccountId: body.businessAccountId, apiKey: body.apiKey };
    // O mesmo número de novo é a troca do token: o Chatwoot aceita cada número uma vez só.
    const existing = (state.inboxes ?? []).find((inbox) => inbox.route === "oficial" && samePhone(inbox.phone ?? "", cloud.phoneNumber));
    const result = existing
      ? await updateCloudApi({ chatwootUrl: env.chatwootUrl(), state, inboxId: existing.id, cloud })
      : await connectCloudApi({ chatwootUrl: env.chatwootUrl(), state, cloud });
    await store.saveState(tenantId, result.state);
    return { status: 200, body: { metaWebhook: result.metaWebhook } };
  }
  const result = await connectOpenWA({
    chatwootUrl: env.chatwootUrl(),
    platformToken: env.platformToken(),
    state,
    input: {
      sessionName: `atendimento-${tenantId}`.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 50),
      relayEmail: `repasse+${tenantId}@${env.serviceEmailDomain()}`,
      chatwootPublicUrl: env.chatwootPublicUrl(),
      openwaUrl: env.openwaUrl(),
      openwaPublicUrl: env.openwaPublicUrl(),
      openwaApiKey: env.openwaApiKey(),
      relayGroups: (await groupsFor(tenantId)).mode !== "fora",
    },
  });
  await store.saveState(tenantId, result.state);
  return { status: 200, body: { ok: true } };
}

/** A configuração que o robô recebe para uma conta, juntando as camadas. */
async function configFor(accountId: number) {
  const tenantId = await store.tenantByAccount(accountId);
  if (!tenantId) return null;
  const [state, platform, client] = await Promise.all([
    store.loadState(tenantId),
    platformSettings(),
    MODEL === "por-cliente" ? store.loadSettings(tenantId) : Promise.resolve(null),
  ]);
  if (!state?.bot_token) return null;
  const tenantName = MODEL === "por-cliente" ? await store.tenantName(tenantId) : "";
  return { tenantId, platform, config: botConfig({ model: MODEL, platform, client, state, tools, ai: defaultAi, tenantName }) };
}

const runTool = createToolRunner(tools, {
  isEnabled: async (accountId, name) => {
    const found = await configFor(accountId);
    return Boolean((found?.config.tools as Array<{ name: string }> | undefined)?.some((tool) => tool.name === name));
  },
});

/** As rotas que o robô chama (config, tools, history, events, suggestions), conferidas pela assinatura. */
export async function botHandler(request: BotRequest) {
  return handleBotRequest(request, {
    secret: env.botSecret(),
    async getConfig(accountId) {
      return (await configFor(accountId))?.config ?? null;
    },
    runTool,
    async getHistory(accountId, conversationId, limit) {
      const tenantId = await store.tenantByAccount(accountId);
      const state = tenantId ? await store.loadState(tenantId) : null;
      if (!state) return [];
      return conversationHistory({ chatwootUrl: env.chatwootUrl(), state, conversationId, limit });
    },
    async saveEvent(accountId, event) {
      const tenantId = await store.tenantByAccount(accountId);
      if (tenantId) await store.addEvent(tenantId, event);
    },
    async saveSuggestions(accountId, payload) {
      const found = await configFor(accountId);
      if (!found) return;
      const owner = knowledgeOwner(MODEL, found.platform);
      await store.addSuggestions(
        payload.suggestions.map((suggestion) => ({ tenantId: found.tenantId, owner, conversationId: payload.conversation_id, ...suggestion, at: payload.at })),
      );
    },
  });
}
