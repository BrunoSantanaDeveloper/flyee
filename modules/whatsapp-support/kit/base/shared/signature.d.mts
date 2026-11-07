export const TOLERANCE_SECONDS: number;
export type Verification = { ok: true } | { ok: false; code: "no_secret" | "no_signature" | "stale" | "bad_signature" };
export function hmacHex(secret: string, content: string): string;
export function verifyChatwoot(input: { secret: string; timestamp?: string | null; signature?: string | null; rawBody: string; now?: number }): Verification;
export function signProjectRequest(input: { secret: string; method: string; pathWithQuery: string; body?: string; now?: number }): Record<string, string>;
export function verifyProjectRequest(input: {
  secret: string;
  method: string;
  pathWithQuery: string;
  body?: string;
  timestamp?: string | null;
  signature?: string | null;
  now?: number;
}): Verification;
