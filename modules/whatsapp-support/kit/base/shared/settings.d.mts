export type Mode = "auto" | "sugestao" | "desligado";
export type Model = "por-cliente" | "plataforma";
export type Scope = "plataforma" | "cliente";
export type Day = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom";
export type PermissionGroup = "apresentacao" | "instrucoes" | "conhecimento" | "horario" | "mensagens" | "transferencia" | "consultas" | "modo" | "grupos" | "midia";
export type GroupMode = "fora" | "equipe" | "chamado";

/** O que o robô lê do que a pessoa manda (D28). */
export interface MediaSettings {
  images: boolean;
  audio: boolean;
  video: boolean;
  /** PDF, planilha (XLSX, ODS), CSV e documento de texto (DOCX, ODT, TXT). Ausente numa configuração antiga: ligado. */
  documents?: boolean;
  /** A transcrição do áudio e da fala do vídeo também como nota interna para a equipe. */
  transcription_note: boolean;
}

/** Grupos do WhatsApp (só na rota não oficial). */
export interface GroupSettings {
  mode: GroupMode;
  /** No modo chamado, as palavras que chamam o robô no grupo, comparadas sem acento e como palavra inteira. */
  call_words: string[];
  /** O time do Chatwoot que recebe as conversas de grupo; null deixa para a equipe toda. */
  team_id: number | null;
}

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
  /**
   * "project": o projeto transcreve áudio e a fala do vídeo pela rota transcribe do contrato do robô, e o
   * contêiner do robô fica sem chave de IA. Sem o campo, transcreve a chave do Gemini ou da OpenAI do robô.
   */
  transcription?: "project" | null;
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
  /** Ausente nas camadas gravadas antes dos grupos: vale "fora". */
  groups?: GroupSettings;
  /** Imagem, áudio e vídeo que a pessoa manda; ausente, tudo ligado. */
  media?: MediaSettings;
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
export const GROUP_MODES: GroupMode[];
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
  state: { bot_token?: string; bot_secret?: string; relay_user_id?: number } | null | undefined;
  tools?: ToolDeclaration[];
  ai?: Partial<AiSettings>;
  tenantName?: string;
}): Record<string, unknown>;
export function groupSettings(input: {
  model?: Model;
  platform: Partial<PlatformSettings> | null | undefined;
  client?: Partial<BotSettings> | null;
}): GroupSettings;
export function knowledgeOwner(model: Model, platform: Partial<PlatformSettings> | null | undefined): Scope;
export function canEnterPanel(
  model: Model,
  person: { isSuperadmin?: boolean; canConfigure?: boolean; isSupportStaff?: boolean } | null | undefined,
): boolean;
