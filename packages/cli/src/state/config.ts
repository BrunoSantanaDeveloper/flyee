import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { join } from "node:path";

import type { Context, Locale } from "../context.ts";
import { readJson, writeJsonAtomic } from "../util/fs.ts";

/**
 * `~/.flyee/config.json`: the identity of this installation. `device_id` is
 * generated once and never changes (CLI-CONTRACT.md, section 1); it identifies
 * the installation, not the hardware.
 */
export type Config = {
  device_id: string;
  device_name: string;
  locale?: Locale;
  created_at: string;
};

export function configPath(ctx: Context): string {
  return join(ctx.flyeeHome, "config.json");
}

export function readConfig(ctx: Context): Config | null {
  return readJson<Config>(configPath(ctx));
}

export function writeConfig(ctx: Context, config: Config): void {
  writeJsonAtomic(configPath(ctx), config);
}

export function ensureConfig(ctx: Context, deviceName?: string): Config {
  const current = readConfig(ctx);
  if (current?.device_id) {
    if (deviceName && deviceName !== current.device_name) {
      const updated = { ...current, device_name: deviceName };
      writeConfig(ctx, updated);
      return updated;
    }
    return current;
  }
  const config: Config = {
    device_id: randomUUID(),
    device_name: (deviceName ?? hostname()).slice(0, 80),
    locale: ctx.locale,
    created_at: new Date(ctx.now()).toISOString(),
  };
  writeConfig(ctx, config);
  return config;
}
