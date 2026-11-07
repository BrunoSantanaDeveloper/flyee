import type { GapGroup } from "../shared/report.mjs";
import type { BotSettings, Model, PlatformSettings, Problem, Scope } from "../shared/settings.mjs";

export class SupportApiError extends Error {
  code: string;
  problems: Problem[] | null;
}

export interface WhatsappStatus {
  connected: boolean;
  route: "oficial" | "nao_oficial" | null;
  status: string | null;
  qrCode: string | null;
}

export interface SettingsResponse {
  model: Model;
  scope: Scope;
  settings: BotSettings | PlatformSettings;
  /** Os grupos que esta pessoa pode editar nesta camada. */
  editable: string[];
  tools: Array<{ name: string; description: string }>;
}

export interface Suggestion {
  id: string;
  q: string;
  a: string;
  why: string;
  at: string;
  tenant: string | null;
}

export function supportApi(options?: { base?: string; fetchImpl?: typeof fetch }): {
  enter(): Promise<{ url: string }>;
  settings(escopo?: Scope): Promise<SettingsResponse>;
  saveSettings(settings: BotSettings | PlatformSettings, escopo?: Scope): Promise<{ ok: true }>;
  whatsappStatus(): Promise<WhatsappStatus>;
  connectOfficial(values: Record<string, string>): Promise<{ metaWebhook: { callbackUrl: string | null; verifyToken: string | null } }>;
  connectUnofficial(): Promise<{ ok: true }>;
  suggestions(escopo?: Scope): Promise<{ suggestions: Suggestion[] }>;
  decideSuggestion(id: string, decisao: "aprovar" | "descartar", values?: { q?: string; a?: string }): Promise<{ ok: true }>;
  gaps(escopo?: Scope, dias?: number): Promise<{ groups: GapGroup[]; categories: Record<string, string> }>;
};
