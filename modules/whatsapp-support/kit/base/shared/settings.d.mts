export type Mode = "auto" | "sugestao" | "desligado";
export type Day = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom";

export interface KnowledgeItem {
  q: string;
  a: string;
}

export interface Hours {
  timezone: string;
  days: Partial<Record<Day, Array<[string, string]>>>;
  holidays: string[];
}

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
  ai?: Partial<AiSettings>;
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
export const DAYS: Day[];
export const LIMITS: Record<string, number>;
export function defaultSettings(brand?: string): BotSettings;
export function validateSettings(settings: unknown, options?: { declaredTools?: string[] }): Problem[];
export function botConfig(input: {
  settings: Partial<BotSettings> | null | undefined;
  state: { bot_token?: string; bot_secret?: string } | null | undefined;
  tools?: ToolDeclaration[];
  ai?: Partial<AiSettings>;
}): Record<string, unknown>;
