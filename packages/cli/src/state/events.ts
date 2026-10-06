import { appendFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import type { Context } from "../context.ts";
import { ensureDir, writeFileAtomic } from "../util/fs.ts";

/**
 * The telemetry queue, `~/.flyee/events.jsonl`: one JSON object per line,
 * readable by the member. Only the names and property keys of the contract's
 * allowlist (CLI-CONTRACT.md 4.7) are ever written; values are short tokens.
 */
export const EVENT_NAMES = ["module.installed", "module.activated", "module.updated", "tool.executed", "recipe.installed"] as const;
export const PROPERTY_KEYS = [
  "module",
  "trail",
  "version",
  "from_version",
  "to_version",
  "os",
  "ai_tool",
  "cli_version",
  "core_version",
  "project_kind",
  "reason",
  "origin",
  "days_since_update",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];
export type QueuedEvent = { name: EventName; properties: Record<string, string>; occurred_at: string };

const MAX_BATCH = 50;
const WINDOW_MS = 7 * 86_400_000;

export function isEventName(value: string): value is EventName {
  return (EVENT_NAMES as readonly string[]).includes(value);
}

/** Keeps only allowlisted keys with short string values. */
export function sanitizeProperties(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of PROPERTY_KEYS) {
    const value = input[key];
    if (typeof value === "string" && value.trim() && value.length <= 80) out[key] = value.trim();
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = String(value);
  }
  return out;
}

export function queuePath(ctx: Context): string {
  return join(ctx.flyeeHome, "events.jsonl");
}

export function enqueueEvent(ctx: Context, name: EventName, properties: Record<string, unknown>): QueuedEvent {
  const event: QueuedEvent = {
    name,
    properties: sanitizeProperties(properties),
    occurred_at: new Date(ctx.now()).toISOString(),
  };
  ensureDir(ctx.flyeeHome);
  appendFileSync(queuePath(ctx), `${JSON.stringify(event)}\n`, "utf8");
  return event;
}

export function readQueue(ctx: Context): QueuedEvent[] {
  let text: string;
  try {
    text = readFileSync(queuePath(ctx), "utf8");
  } catch {
    return [];
  }
  const events: QueuedEvent[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as QueuedEvent;
      if (isEventName(parsed.name)) events.push(parsed);
    } catch {
      // a damaged line is dropped, never a reason to fail a command
    }
  }
  return events;
}

export function writeQueue(ctx: Context, events: QueuedEvent[]): void {
  if (events.length === 0) {
    rmSync(queuePath(ctx), { force: true });
    return;
  }
  writeFileAtomic(queuePath(ctx), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`);
}

/** Drops events outside the 7-day window the server accepts, then returns the next batch and the rest. */
export function nextBatch(ctx: Context): { batch: QueuedEvent[]; rest: QueuedEvent[]; dropped: number } {
  const all = readQueue(ctx);
  const cutoff = ctx.now() - WINDOW_MS;
  const fresh = all.filter((event) => Date.parse(event.occurred_at) >= cutoff);
  return { batch: fresh.slice(0, MAX_BATCH), rest: fresh.slice(MAX_BATCH), dropped: all.length - fresh.length };
}
