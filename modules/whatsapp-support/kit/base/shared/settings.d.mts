export type Mode = "auto" | "sugestao" | "desligado";
export type Model = "por-cliente" | "plataforma";
export type Scope = "plataforma" | "cliente";
export type Day = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom";
export type PermissionGroup = "apresentacao" | "instrucoes" | "conhecimento" | "horario" | "mensagens" | "transferencia" | "consultas" | "modo";

export interface KnowledgeItem {
  q: string;
  a: string;
}

export interface Hours {
  timezone: string;
  days: Partial<Record<Day, Array<[string, string]>>>;
  holidays: string[];
}

export interface AiSettings {
  provider: "anthropic" | "openai" | "gemini" | "project";
  model: string | null;
  effort: string | null;
  base_url: string | null;
  key_env: string | null;
  json: "schema" | "object" | "none";
  fallbacks: boolean;
  max_tokens: number;
  cache_ttl: "5m" | "1h";
}

/** A camada do cliente (ou a base da camada da plataforma). */
export interface BotSettings {
  mode: Mode;
  brand: string;
  persona: string;
  instructions: string;
  knowledge: KnowledgeItem[];
  hours: Hours | null;
  messages: { handoff?: string; handoff_fora_do_horario?: string; erro?: string; anexo?: string; desligado?: string };
  handoff: { keywords: string[] | null; max_bot_turns: number; team_id: number | null };
  tools_enabled: string[];
  suggest_on_open: boolean;
  share_contact_name: boolean;
}

/** A camada da plataforma, que só o superadmin edita. */
export interface PlatformSettings extends BotSettings {
  client_permissions: Record<PermissionGroup, boolean>;
  /** As consultas que a plataforma oferece aos clientes; null oferece todas as declaradas. */
  tools_available: string[] | null;
  learning: { enabled: boolean };
  report: { enabled: boolean };
  ai?: Partial<AiSettings>;
}

export interface ToolDeclaration {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface Problem {
  field: string;
  message: string;
}

export const MODES: Mode[];
export const MODELS: Model[];
export const DAYS: Day[];
export const PERMISSION_GROUPS: PermissionGroup[];
export const LIMITS: Record<string, number>;
export function defaultSettings(brand?: string): BotSettings;
export function defaultPlatformSettings(brand?: string): PlatformSettings;
export function clientPermissions(model: Model, platform: Partial<PlatformSettings> | null | undefined): Record<PermissionGroup, boolean>;
export function editableGroups(scope: Scope, model: Model, platform: Partial<PlatformSettings> | null | undefined): string[];
export function applyClientEdits(current: Partial<BotSettings> | null | undefined, incoming: Partial<BotSettings> | null | undefined, permissions: Record<PermissionGroup, boolean>): BotSettings;
export function validateSettings(settings: unknown, options?: { declaredTools?: string[]; scope?: Scope }): Problem[];
export function botConfig(input: {
  model?: Model;
  platform: Partial<PlatformSettings> | null | undefined;
  client?: Partial<BotSettings> | null;
  state: { bot_token?: string; bot_secret?: string } | null | undefined;
  tools?: ToolDeclaration[];
  ai?: Partial<AiSettings>;
  tenantName?: string;
}): Record<string, unknown>;
export function knowledgeOwner(model: Model, platform: Partial<PlatformSettings> | null | undefined): Scope;
export function canEnterPanel(
  model: Model,
  person: { isSuperadmin?: boolean; canConfigure?: boolean; isSupportStaff?: boolean } | null | undefined,
): boolean;
