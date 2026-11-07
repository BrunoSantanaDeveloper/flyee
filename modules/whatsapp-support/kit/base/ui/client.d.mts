import type { BotSettings, Problem } from "../shared/settings.mjs";

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

export function supportApi(options?: { base?: string; fetchImpl?: typeof fetch }): {
  enter(): Promise<{ url: string }>;
  settings(): Promise<{ settings: BotSettings; tools: Array<{ name: string; description: string }> }>;
  saveSettings(settings: BotSettings): Promise<{ ok: true }>;
  whatsappStatus(): Promise<WhatsappStatus>;
  connectOfficial(values: Record<string, string>): Promise<{ metaWebhook: { callbackUrl: string | null; verifyToken: string | null } }>;
  connectUnofficial(): Promise<{ ok: true }>;
};
