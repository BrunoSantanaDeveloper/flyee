import type { InboxState, SupportState } from "./provision.mjs";

export type HealthLevel = "ok" | "atencao" | "fora";

export interface HealthFinding {
  level: HealthLevel;
  code: string;
  detail: string;
  fix: string;
  /** "quem_conecta" resolve na tela ou na Meta; "tecnico" é o servidor, de quem cuida da implantação. */
  fixBy: "quem_conecta" | "tecnico";
}

export interface InboxHealth {
  inbox_id: number;
  route: "oficial" | "nao_oficial";
  phone: string | null;
  level: HealthLevel;
  findings: HealthFinding[];
}

export interface HealthReport {
  checked_at: string;
  level: HealthLevel;
  inboxes: InboxHealth[];
}

/** A memória da conferência, guardada no campo health do estado do cliente. */
export interface HealthMemory {
  level: HealthLevel;
  codes: string[];
  since: string;
  notified_at: string | null;
  /** Já avisou que há problema e ainda não avisou que voltou. */
  open: boolean;
}

export interface WhatsappAlert {
  inbox_id: number;
  route: "oficial" | "nao_oficial";
  phone: string | null;
  level: HealthLevel;
  /** novo: parou, mudou ou pede atenção. lembrete: continua fora. voltou: normal de novo. */
  kind: "novo" | "lembrete" | "voltou";
  since: string;
  fixBy: "quem_conecta" | "tecnico";
  title: string;
  /** Pronto para enviar: o que se viu e o que fazer, sem segredo. */
  text: string;
  findings: HealthFinding[];
}

export const LEVELS: HealthLevel[];

export function worstLevel(levels: HealthLevel[]): HealthLevel;

export function currentInbox(state: SupportState | null | undefined): InboxState | null;

export function classifySession(session: Record<string, unknown> | null): HealthFinding[];

export function classifyCloudHealth(input?: { health?: Record<string, unknown> | null; error?: { type?: string; message?: string } | null }): HealthFinding[];

export function openwaFailure(error: unknown): HealthFinding;

export function checkWhatsappHealth(input: {
  chatwootUrl: string;
  state: SupportState;
  openwa?: { url: string; apiKey: string } | null;
  inboxes?: InboxState[] | null;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<HealthReport>;

export function healthAlerts(input: {
  previous?: Record<string, HealthMemory> | null;
  report: HealthReport;
  now?: Date;
  remindHours?: number;
}): { alerts: WhatsappAlert[]; health: Record<string, HealthMemory> };
