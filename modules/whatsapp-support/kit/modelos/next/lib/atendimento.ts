// Ligação do kit de atendimento com este projeto (modelo para Next.js App Router).
// Este arquivo é do projeto: a IA o copia uma vez e adapta o armazenamento, a sessão e as consultas.
// Os arquivos da base (pasta base/ do kit) não se editam; ajuste só o caminho BASE abaixo.

import { botConfig, defaultSettings, validateSettings, type BotSettings } from "../atendimento/base/shared/settings.mjs";
import { createToolRunner, handleBotRequest, type BotRequest, type ProjectTool } from "../atendimento/base/server/bot-contract.mjs";
import {
  connectCloudApi,
  connectOpenWA,
  conversationHistory,
  ensureStaffUser,
  provisionAccount,
  ssoUrl,
  whatsappStatus,
  type SupportState,
} from "../atendimento/base/server/provision.mjs";
import { brPhoneVariants, contactPhone } from "../atendimento/base/shared/phone.mjs";
import escolhas from "../atendimento/escolhas.json";

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
  tenantId: string;
  key: string;
  email: string;
  name: string;
  /** Quem configura o robô e conecta o número do cliente (no projeto, não no Chatwoot). */
  canConfigure: boolean;
}

/** Onde o projeto guarda o atendimento de cada cliente. ADAPTE: use o banco e a sessão do projeto. */
export interface SupportStore {
  currentPerson(request: Request): Promise<Person | null>;
  tenantName(tenantId: string): Promise<string>;
  /** Contém tokens: grave cifrado, nunca em log. */
  loadState(tenantId: string): Promise<SupportState | null>;
  saveState(tenantId: string, state: SupportState): Promise<void>;
  tenantByAccount(accountId: number): Promise<string | null>;
  loadSettings(tenantId: string): Promise<BotSettings | null>;
  saveSettings(tenantId: string, settings: BotSettings): Promise<void>;
}

export const store: SupportStore = {
  async currentPerson() {
    throw new Error("ADAPTE: devolva a pessoa logada pela sessão do projeto.");
  },
  async tenantName() {
    throw new Error("ADAPTE: devolva o nome do cliente.");
  },
  async loadState() {
    throw new Error("ADAPTE: leia o estado do atendimento do cliente.");
  },
  async saveState() {
    throw new Error("ADAPTE: grave o estado do atendimento do cliente, cifrado.");
  },
  async tenantByAccount() {
    throw new Error("ADAPTE: encontre o cliente pela conta do Chatwoot (account_id do estado).");
  },
  async loadSettings() {
    throw new Error("ADAPTE: leia as configurações do robô do cliente.");
  },
  async saveSettings() {
    throw new Error("ADAPTE: grave as configurações do robô do cliente.");
  },
};

/**
 * As consultas que o robô pode fazer aos dados do projeto. Cada uma decide o que devolve e para quem:
 * só dados da pessoa da conversa, achada pelo telefone (ou por outra confirmação que o projeto exigir).
 * ADAPTE: troque o exemplo pelas consultas reais; o cliente liga cada uma na tela do robô.
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

const runTool = createToolRunner(tools, {
  isEnabled: async (accountId, name) => {
    const tenantId = await store.tenantByAccount(accountId);
    const settings = tenantId ? await store.loadSettings(tenantId) : null;
    return Boolean(settings?.tools_enabled?.includes(name));
  },
});

/** O provedor de IA padrão do projeto; o cliente não escolhe (as chaves ficam no ambiente do robô). */
export const defaultAi = { provider: "anthropic", model: "claude-opus-5-5", effort: "low" } as const;

/** Cria, se faltar, a conta do cliente no Chatwoot, a conta de serviço e o robô. */
export async function ensureAccount(tenantId: string): Promise<SupportState> {
  const current = (await store.loadState(tenantId)) ?? {};
  const next = await provisionAccount({
    chatwootUrl: env.chatwootUrl(),
    platformToken: env.platformToken(),
    state: current,
    input: {
      name: await store.tenantName(tenantId),
      locale: "pt_BR",
      featuresOff: escolhas.chatwoot.features_off,
      serviceEmail: `atendimento+${tenantId}@${env.serviceEmailDomain()}`,
      botName: escolhas.robo?.nome ?? "Assistente virtual",
      botUrl: env.botPublicUrl(),
    },
  });
  if (JSON.stringify(next) !== JSON.stringify(current)) await store.saveState(tenantId, next);
  return next;
}

/** O link de entrada no painel para a pessoa logada (vale 5 minutos e uma vez só). */
export async function enterPanel(request: Request): Promise<string | null> {
  const person = await store.currentPerson(request);
  if (!person) return null;
  const state = await ensureAccount(person.tenantId);
  const { state: next, userId } = await ensureStaffUser({
    chatwootUrl: env.chatwootUrl(),
    platformToken: env.platformToken(),
    state,
    person: { key: person.key, email: person.email, name: person.name },
  });
  await store.saveState(person.tenantId, next);
  return ssoUrl({ chatwootUrl: env.chatwootUrl(), platformToken: env.platformToken(), userId });
}

export async function readSettings(request: Request) {
  const person = await store.currentPerson(request);
  if (!person?.canConfigure) return null;
  const settings = (await store.loadSettings(person.tenantId)) ?? defaultSettings(await store.tenantName(person.tenantId));
  return { settings, tools: tools.map(({ name, description }) => ({ name, description })) };
}

export async function writeSettings(request: Request, settings: BotSettings) {
  const person = await store.currentPerson(request);
  if (!person?.canConfigure) return { status: 403 as const, body: { code: "forbidden", message: "Só quem administra o atendimento muda o robô." } };
  const problems = validateSettings(settings, { declaredTools: tools.map((tool) => tool.name) });
  if (problems.length) return { status: 422 as const, body: { code: "invalid", message: "Confira os campos marcados.", problems } };
  await store.saveSettings(person.tenantId, settings);
  return { status: 200 as const, body: { ok: true } };
}

export async function whatsapp(request: Request) {
  const person = await store.currentPerson(request);
  if (!person?.canConfigure) return null;
  const state = (await store.loadState(person.tenantId)) ?? {};
  const inbox = state.inboxes?.[state.inboxes.length - 1];
  if (!inbox) return { connected: false, route: null, status: null, qrCode: null };
  if (inbox.route === "oficial") return { connected: true, route: "oficial", status: "ready", qrCode: null };
  const status = await whatsappStatus({ openwaUrl: env.openwaUrl(), openwaApiKey: env.openwaApiKey(), sessionId: inbox.session_id! });
  return { connected: status.status === "ready", route: "nao_oficial", ...status };
}

export async function connectWhatsapp(request: Request, body: Record<string, string>) {
  const person = await store.currentPerson(request);
  if (!person?.canConfigure) return { status: 403, body: { code: "forbidden", message: "Só quem administra o atendimento conecta o número." } };
  const state = await ensureAccount(person.tenantId);
  if (body.route === "oficial") {
    const result = await connectCloudApi({
      chatwootUrl: env.chatwootUrl(),
      state,
      cloud: { phoneNumber: body.phoneNumber, phoneNumberId: body.phoneNumberId, businessAccountId: body.businessAccountId, apiKey: body.apiKey },
    });
    await store.saveState(person.tenantId, result.state);
    return { status: 200, body: { metaWebhook: result.metaWebhook } };
  }
  const result = await connectOpenWA({
    chatwootUrl: env.chatwootUrl(),
    platformToken: env.platformToken(),
    state,
    input: {
      sessionName: `cliente-${person.tenantId}`.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 50),
      relayEmail: `repasse+${person.tenantId}@${env.serviceEmailDomain()}`,
      chatwootPublicUrl: env.chatwootPublicUrl(),
      openwaUrl: env.openwaUrl(),
      openwaPublicUrl: env.openwaPublicUrl(),
      openwaApiKey: env.openwaApiKey(),
    },
  });
  await store.saveState(person.tenantId, result.state);
  return { status: 200, body: { ok: true } };
}

/** As rotas que o robô chama (config, tools, history), conferidas pela assinatura. */
export async function botHandler(request: BotRequest) {
  return handleBotRequest(request, {
    secret: env.botSecret(),
    async getConfig(accountId) {
      const tenantId = await store.tenantByAccount(accountId);
      if (!tenantId) return null;
      const [state, settings] = await Promise.all([store.loadState(tenantId), store.loadSettings(tenantId)]);
      if (!state?.bot_token) return null;
      return botConfig({ settings: settings ?? defaultSettings(await store.tenantName(tenantId)), state, tools, ai: defaultAi });
    },
    runTool,
    async getHistory(accountId, conversationId, limit) {
      const tenantId = await store.tenantByAccount(accountId);
      const state = tenantId ? await store.loadState(tenantId) : null;
      if (!state) return [];
      return conversationHistory({ chatwootUrl: env.chatwootUrl(), state, conversationId, limit });
    },
  });
}
