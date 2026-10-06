import { join } from "node:path";

import type { Context } from "../context.ts";
import { readJson, writeJsonAtomic } from "../util/fs.ts";

/**
 * `~/.flyee/keys.json`: the external keys the member saves for apps, the
 * `external_credentials` of the manifest (CLI-CONTRACT.md 6: "chaves que o
 * integrante fornece; `env` em `^[A-Z][A-Z0-9_]{1,63}$`"). One file per
 * machine, outside every project, so a key never sits where the AI reads, git
 * commits or a synced folder copies. Mode 0600 where the file system honors
 * modes; on Windows the profile ACL protects it, as with credentials.json.
 * Nothing in it ever leaves the machine.
 *
 * Apps read it themselves (it is a plain JSON file) after the environment
 * variable of the same name, which wins when set.
 */
export type KeyStore = { version: 1; keys: Record<string, string> };

export const KEY_NAME = /^[A-Z][A-Z0-9_]{1,63}$/;

export function keysPath(ctx: Context): string {
  return join(ctx.flyeeHome, "keys.json");
}

export function readKeys(ctx: Context): KeyStore {
  const stored = readJson<{ keys?: Record<string, unknown> }>(keysPath(ctx));
  const keys: Record<string, string> = {};
  for (const [name, value] of Object.entries(stored?.keys ?? {})) {
    if (KEY_NAME.test(name) && typeof value === "string" && value.trim()) keys[name] = value;
  }
  return { version: 1, keys };
}

export function writeKeys(ctx: Context, store: KeyStore): void {
  const sorted = Object.fromEntries(Object.entries(store.keys).sort(([a], [b]) => a.localeCompare(b)));
  writeJsonAtomic(keysPath(ctx), { version: 1, keys: sorted }, 0o600);
}

export type KeySource = "environment" | "flyee";

/**
 * Where a key is available. The environment variable wins; one that exists
 * but is empty means "no key" and stops the search, the same rule the apps follow.
 */
export function keySource(ctx: Context, name: string): KeySource | null {
  const fromEnvironment = ctx.env[name];
  if (fromEnvironment !== undefined) return fromEnvironment.trim() ? "environment" : null;
  return readKeys(ctx).keys[name] ? "flyee" : null;
}
