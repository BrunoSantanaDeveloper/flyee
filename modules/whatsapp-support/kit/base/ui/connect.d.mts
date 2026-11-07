export type ConnectStep =
  | "escolher"
  | "formulario_oficial"
  | "aviso_nao_oficial"
  | "pronto_para_criar"
  | "conectando"
  | "configurar_meta"
  | "aguardando_qr"
  | "mostrar_qr"
  | "conectado"
  | "erro";

export interface ConnectState {
  step: ConnectStep;
  route: "oficial" | "nao_oficial" | null;
  error: string | null;
  qrCode: string | null;
  status: string | null;
  metaWebhook: { callbackUrl: string | null; verifyToken: string | null } | null;
  accepted: boolean;
}

export type ConnectEvent =
  | { type: "escolher_rota"; route: "oficial" | "nao_oficial" }
  | { type: "aceitar_risco" }
  | { type: "enviar" }
  | { type: "conectou_oficial"; metaWebhook: ConnectState["metaWebhook"] }
  | { type: "criou_sessao" }
  | { type: "estado"; status: string; qrCode?: string | null }
  | { type: "erro"; message?: string }
  | { type: "voltar" };

export const UNOFFICIAL_RISK: string[];
export const OFFICIAL_FIELDS: Array<{ name: string; label: string; hint: string; secret?: boolean }>;
export const initialConnectState: ConnectState;
export function validateOfficial(values: Record<string, string>): Record<string, string>;
export function connectReducer(state: ConnectState, event: ConnectEvent): ConnectState;
export function pollingDelay(step: ConnectStep): number | null;
