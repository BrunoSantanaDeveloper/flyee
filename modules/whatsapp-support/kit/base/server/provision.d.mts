import type { HealthFinding, HealthLevel, HealthMemory } from "./health.mjs";

export interface InboxState {
  id: number;
  route: "oficial" | "nao_oficial";
  phone?: string;
  session_id?: string;
  instance_id?: string;
  webhook_id?: number;
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
}

type FetchImpl = typeof fetch;

export const NEVER_OFF: string[];
export const DEFAULT_UI_SETTINGS: Record<string, boolean>;
export const ADAPTER_SUBSCRIPTIONS: string[];

export class ProvisionError extends Error {
  code: string;
  fix: string;
}

export function featureMap(featuresOff?: string[]): Record<string, boolean>;

export function provisionAccount(input: {
  chatwootUrl: string;
  platformToken: string;
  state?: SupportState;
  input: { name: string; locale?: string; featuresOff?: string[]; serviceEmail?: string; serviceName?: string; botName?: string; botUrl?: string };
  fetchImpl?: FetchImpl;
}): Promise<SupportState>;

export function ensureStaffUser(input: {
  chatwootUrl: string;
  platformToken: string;
  state: SupportState;
  person: { key: string; email: string; name: string };
  uiSettings?: Record<string, boolean> | null;
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
  };
  fetchImpl?: FetchImpl;
}): Promise<{ state: SupportState; inboxId: number; sessionId: string }>;

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

export function ensureDashboardApp(input: {
  chatwootUrl: string;
  state: SupportState;
  title: string;
  url: string;
  fetchImpl?: FetchImpl;
}): Promise<{ id: number; title: string }>;
