import { Client } from "../api/client.ts";
import type { Context } from "../context.ts";
import { loadCoreAssets } from "../core-assets.ts";
import { t } from "../i18n.ts";
import { flushEvents } from "../registration.ts";
import { enqueueEvent, EVENT_NAMES, isEventName, PROPERTY_KEYS } from "../state/events.ts";
import { readLock } from "../state/lock.ts";
import { CLI_VERSION } from "../version.ts";
import { flag, type ParsedArgs, type Result } from "./types.ts";

/**
 * `flyee track <event> [--module x] [--version y] [--trail z] [--reason r] [--origin o] [--from a] [--to b]`
 * Only the contract's allowlist (CLI-CONTRACT.md 4.7); the queue is flushed when a connection exists.
 */
export async function runTrack(ctx: Context, args: ParsedArgs): Promise<Result> {
  const name = args.positionals[0] ?? "";
  if (!isEventName(name)) {
    const message = t(ctx, "track.unknown", { name, list: EVENT_NAMES.join(", ") });
    ctx.io.out(message);
    return { ok: false, error: "unknown_event", message };
  }
  const assets = loadCoreAssets();
  const lock = readLock(ctx);
  const module = flag(args, "module");
  const properties: Record<string, unknown> = {
    cli_version: CLI_VERSION,
    core_version: assets.core.version,
    project_kind: lock?.project_kind,
  };
  for (const key of PROPERTY_KEYS) {
    const value = flag(args, key) ?? (key === "from_version" ? flag(args, "from") : key === "to_version" ? flag(args, "to") : undefined);
    if (value) properties[key] = value;
  }
  if (module && lock?.modules[module]) {
    properties.module = module;
    properties.version = properties.version ?? lock.modules[module].version;
    properties.trail = properties.trail ?? lock.modules[module].trail;
  }
  const event = enqueueEvent(ctx, name, properties);
  ctx.io.out(t(ctx, "track.queued", { name }));
  const client = new Client(ctx);
  const flushed = await flushEvents(ctx, client);
  if (flushed.accepted) ctx.io.out(t(ctx, "track.sent", { count: flushed.accepted }));
  return { ok: true, event, sent: flushed.accepted, remaining: flushed.remaining };
}
