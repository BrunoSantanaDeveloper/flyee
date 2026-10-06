import { rmSync } from "node:fs";
import { join } from "node:path";

import type { Context } from "../context.ts";
import { readJson, writeJsonAtomic } from "../util/fs.ts";

/**
 * `~/.flyee/credentials.json`, mode 0600 where the file system honors modes.
 * The refresh token rotates on every use (CLI-CONTRACT.md 2.3), so this file
 * is rewritten after every refresh.
 */
export type Credentials = {
  base_url: string;
  access_token: string;
  access_expires_at: string;
  refresh_token: string;
  refresh_expires_at: string;
  scope: string;
  obtained_at: string;
};

export function credentialsPath(ctx: Context): string {
  return join(ctx.flyeeHome, "credentials.json");
}

export function readCredentials(ctx: Context): Credentials | null {
  const credentials = readJson<Credentials>(credentialsPath(ctx));
  if (!credentials?.access_token || !credentials.refresh_token) return null;
  if (credentials.base_url && credentials.base_url !== ctx.baseUrl) return null;
  return credentials;
}

export function writeCredentials(ctx: Context, credentials: Credentials): void {
  writeJsonAtomic(credentialsPath(ctx), credentials, 0o600);
}

export function clearCredentials(ctx: Context): void {
  rmSync(credentialsPath(ctx), { force: true });
}

export function accessExpired(credentials: Credentials, now: number, skewMs = 30_000): boolean {
  const expires = Date.parse(credentials.access_expires_at);
  return !Number.isFinite(expires) || expires - skewMs <= now;
}

export function daysUntilRefreshExpiry(credentials: Credentials, now: number): number | null {
  const expires = Date.parse(credentials.refresh_expires_at);
  if (!Number.isFinite(expires)) return null;
  return Math.max(0, Math.ceil((expires - now) / 86_400_000));
}
