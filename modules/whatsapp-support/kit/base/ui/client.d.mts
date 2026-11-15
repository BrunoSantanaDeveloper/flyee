import type { HealthFinding, HealthLevel } from "../server/health.mjs";
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
  /** O que a conferência do número viu; null antes de conectar. */
  level: HealthLevel | null;
  findings: HealthFinding[];
}

export interface SettingsResponse {
  model: Model;
  scope: Scope;
  settings: BotSettings | PlatformSettings;
  /** Os grupos que esta pessoa pode editar nesta camada. */
  editable: string[];
  tools: Array<{ name: string; description: string }>;
  /** audio false: o robô não tem quem transcreva, e a tela esconde "Ouvir áudios"; null: não se sabe. */
  media?: { audio: boolean | null };
}

export interface Suggestion {
  id: string;
  q: string;
  a: string;
  why: string;
  at: string;
  tenant: string | null;
}

export interface TeamGroup {
  chave: string;
  nome: string;
  /** As chaves (Person.key) de quem está no grupo. */
  membros: string[];
  etiquetas: string[];
  arquivado: boolean;
}

export function supportApi(options?: { base?: string; fetchImpl?: typeof fetch }): {
  enter(): Promise<{ url: string }>;
  settings(escopo?: Scope): Promise<SettingsResponse>;
  /** aviso: salvo, mas a mudança nos grupos fica para a próxima conferência (o WhatsApp não respondeu). */
  saveSettings(settings: BotSettings | PlatformSettings, escopo?: Scope): Promise<{ ok: true; aviso?: string }>;
  whatsappStatus(): Promise<WhatsappStatus>;
  connectOfficial(values: Record<string, string>): Promise<{ metaWebhook: { callbackUrl: string | null; verifyToken: string | null } }>;
  connectUnofficial(): Promise<{ ok: true }>;
  reconnect(): Promise<{ ok: true; status: string }>;
  suggestions(escopo?: Scope): Promise<{ suggestions: Suggestion[] }>;
  decideSuggestion(id: string, decisao: "aprovar" | "descartar", values?: { q?: string; a?: string }): Promise<{ ok: true }>;
  teamGroups(): Promise<{ grupos: TeamGroup[]; pessoas: Array<{ chave: string; nome: string }> }>;
  /** fora: quem foi escolhido e não pôde entrar (fora da equipe do painel). */
  saveTeamGroup(grupo: { chave?: string; nome: string; membros: string[]; etiquetas: string[] }): Promise<{ ok: true; chave: string; fora: string[] }>;
  archiveTeamGroup(chave: string): Promise<{ ok: true }>;
  gaps(escopo?: Scope, dias?: number): Promise<{ groups: GapGroup[]; categories: Record<string, string> }>;
};
