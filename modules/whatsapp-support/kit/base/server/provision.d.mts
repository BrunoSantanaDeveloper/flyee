import type { HealthFinding, HealthLevel, HealthMemory } from "./health.mjs";

export interface InboxState {
  id: number;
  route: "oficial" | "nao_oficial";
  phone?: string;
  session_id?: string;
  instance_id?: string;
  webhook_id?: number;
}

/** Um grupo da equipe: uma caixa interna com uma conversa fixa, vista só pelos membros. */
export interface TeamGroupState {
  inbox_id: number;
  contact_id: number;
  conversation_id: number;
  name: string;
  /** As chaves (Person.key) de quem está no grupo. */
  members: string[];
  labels: string[];
  archived: boolean;
}

/** O que o projeto guarda por cliente. Os campos *_token e bot_secret são segredos: guarde cifrados. */
export interface SupportState {
  account_id?: number;
  service_user_id?: number;
  service_token?: string;
  bot_id?: number;
  bot_token?: string;
  bot_secret?: string;
  relay_user_id?: number;
  relay_token?: string;
  inboxes?: InboxState[];
  staff?: Record<string, number>;
  features_off?: string[];
  /** A memória da conferência do número, por caixa (healthAlerts). */
  health?: Record<string, HealthMemory>;
  /** As etiquetas do kit já criadas na conta (KIT_LABELS). */
  labels?: string[];
  /** O nome já gravado na pessoa de repasse (RELAY_NAME). */
  relay_name?: string;
  /** Os minutos de resolução automática já gravados na conta; null quando desligada. */
  auto_resolve_after?: number | null;
  /** Os grupos da equipe, pela chave que o projeto deu a cada um. Fora de inboxes, que são as caixas do WhatsApp. */
  team_groups?: Record<string, TeamGroupState>;
}

type FetchImpl = typeof fetch;

export const NEVER_OFF: string[];
export const DEFAULT_UI_SETTINGS: Record<string, unknown>;
/** Gravadas só quando a pessoa entra na equipe: a lista de conversas abre em todas, não só nas abertas. */
export const INITIAL_UI_SETTINGS: Record<string, unknown>;
export const ADAPTER_SUBSCRIPTIONS: string[];
export const KIT_LABELS: Array<{ title: string; description: string; color: string }>;
export const RELAY_NAME: string;

export class ProvisionError extends Error {
  code: string;
  fix: string;
}

export function featureMap(featuresOff?: string[]): Record<string, boolean>;

export function provisionAccount(input: {
  chatwootUrl: string;
  platformToken: string;
  state?: SupportState;
  input: {
    name: string;
    locale?: string;
    featuresOff?: string[];
    serviceEmail?: string;
    serviceName?: string;
    botName?: string;
    botUrl?: string;
    /** Horas sem atividade até a conversa aberta ser resolvida e voltar ao robô; padrão 8, 0 desliga. */
    autoResolveHours?: number | null;
  };
  fetchImpl?: FetchImpl;
}): Promise<SupportState>;

export const AUTO_RESOLVE_HOURS: number;
/** Os minutos que o Chatwoot grava, ou null para desligar; lança auto_resolve_invalid fora de 1 a 720 horas. */
export function autoResolveMinutes(hours?: number | null): number | null;

export function ensureStaffUser(input: {
  chatwootUrl: string;
  platformToken: string;
  state: SupportState;
  person: { key: string; email: string; name: string };
  /** Mescladas ao perfil a cada chamada. */
  uiSettings?: Record<string, unknown> | null;
  /** Mescladas só na primeira vez da pessoa na equipe, para não desfazer a escolha dela. */
  initialUiSettings?: Record<string, unknown> | null;
  fetchImpl?: FetchImpl;
}): Promise<{ state: SupportState; userId: number }>;

export function removeStaffUser(input: {
  chatwootUrl: string;
  platformToken: string;
  state: SupportState;
  personKey: string;
  fetchImpl?: FetchImpl;
}): Promise<{ state: SupportState; removed: number | null }>;

export function syncStaff(input: {
  chatwootUrl: string;
  platformToken: string;
  state: SupportState;
  keepKeys: string[];
  allowEmpty?: boolean;
  fetchImpl?: FetchImpl;
}): Promise<{
  state: SupportState;
  removed: Array<{ key: string; user_id: number }>;
  unknown: Array<{ user_id: number; role: string | null }>;
  skipped: "no_account" | "empty_list" | null;
}>;

export function ssoUrl(input: { chatwootUrl: string; platformToken: string; userId: number; fetchImpl?: FetchImpl }): Promise<string>;

export function connectCloudApi(input: {
  chatwootUrl: string;
  state: SupportState;
  cloud: { phoneNumber: string; phoneNumberId: string; businessAccountId: string; apiKey: string; inboxName?: string };
  fetchImpl?: FetchImpl;
}): Promise<{ state: SupportState; inboxId: number; metaWebhook: { callbackUrl: string | null; verifyToken: string | null } }>;

export function connectOpenWA(input: {
  chatwootUrl: string;
  platformToken: string;
  state: SupportState;
  input: {
    sessionName: string;
    inboxName?: string;
    relayEmail?: string;
    chatwootPublicUrl: string;
    openwaUrl: string;
    openwaPublicUrl: string;
    openwaApiKey: string;
    /** Repassar os grupos do WhatsApp ao painel: o modo dos grupos não é "fora" (groupSettings). Padrão false. */
    relayGroups?: boolean;
  };
  fetchImpl?: FetchImpl;
}): Promise<{ state: SupportState; inboxId: number; sessionId: string }>;

export function groupContactName(subject: string): string;

/** Liga ou desliga o repasse dos grupos e dá aos grupos o nome do WhatsApp no painel. */
export function syncOpenWAGroups(input: {
  chatwootUrl: string;
  state: SupportState;
  openwaUrl: string;
  openwaApiKey: string;
  relay: boolean;
  fetchImpl?: FetchImpl;
}): Promise<{ sessions: number; changed: number; renamed: number; unread: number }>;

export function updateCloudApi(input: {
  chatwootUrl: string;
  state: SupportState;
  inboxId: number;
  cloud: { apiKey: string; phoneNumberId?: string; businessAccountId?: string };
  fetchImpl?: FetchImpl;
}): Promise<{ state: SupportState; inboxId: number; metaWebhook: { callbackUrl: string | null; verifyToken: string | null } }>;

export function whatsappStatus(input: { openwaUrl: string; openwaApiKey: string; sessionId: string; fetchImpl?: FetchImpl }): Promise<{
  status: string;
  qrCode: string | null;
  level: HealthLevel;
  findings: HealthFinding[];
}>;

export function reconnectOpenWA(input: { openwaUrl: string; openwaApiKey: string; sessionId: string; fetchImpl?: FetchImpl }): Promise<{ status: string; started: boolean }>;

export function conversationHistory(input: {
  chatwootUrl: string;
  state: SupportState;
  conversationId: number;
  limit?: number;
  fetchImpl?: FetchImpl;
}): Promise<Array<{ role: "cliente" | "robo" | "equipe"; text: string; at: string }>>;

export function ensureAdapter(input: { openwa: unknown }): Promise<void>;
/** Liga o adaptador depois da instância e exige que fique saudável; lança adapter_config, adapter_enable ou adapter_unhealthy. */
export function startAdapter(input: { openwa: unknown; config: Record<string, unknown> }): Promise<{ started: boolean }>;

export const TEAM_GROUP_PREFIX: string;
export interface TeamGroupInput {
  key: string;
  name: string;
  members: string[];
  labels?: string[];
}
export function teamGroupInput(group: unknown): { key: string; name: string; members: string[]; labels: string[] };
export function saveTeamGroup(input: {
  chatwootUrl: string;
  state: SupportState;
  group: TeamGroupInput;
  fetchImpl?: FetchImpl;
}): Promise<{ state: SupportState; missing: string[] }>;
export function archiveTeamGroup(input: { chatwootUrl: string; state: SupportState; key: string; fetchImpl?: FetchImpl }): Promise<{ state: SupportState; archived: boolean }>;
export function syncTeamGroups(input: { chatwootUrl: string; state: SupportState; fetchImpl?: FetchImpl }): Promise<{ state: SupportState; reopened: string[]; pruned: string[] }>;

export function ensureDashboardApp(input: {
  chatwootUrl: string;
  state: SupportState;
  title: string;
  url: string;
  fetchImpl?: FetchImpl;
}): Promise<{ id: number; title: string }>;
