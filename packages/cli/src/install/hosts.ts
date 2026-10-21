import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CliError } from "../api/errors.ts";
import { isCloudSession, reach } from "../api/network.ts";
import type { Context } from "../context.ts";
import { t } from "../i18n.ts";
import { moduleDir, readLock } from "../state/lock.ts";
import { MANIFEST_FILE } from "./zip.ts";

/** A name a cloud environment's allowed domains take: dot-separated labels, optionally after `*.`. */
const HOST = /^(\*\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

/** How long a probed host has to answer: a refusal of the cloud's proxy comes at once. */
const PROBE_DEADLINE_MS = 8_000;

type Permission = { kind?: string; scope?: unknown };

/**
 * The hosts an app declares in its `network` permissions, apart from the words a person reads
 * there. A scope is written for the member ("youtube.com, googlevideo.com e o site do vídeo que
 * você indicar"): the names are hosts, and what is not a name stays a note, such as the site of a
 * brand the request will give.
 */
export function declaredNetwork(permissions: Permission[]): { hosts: string[]; notes: string[] } {
  const hosts = new Set<string>();
  const notes: string[] = [];
  for (const permission of permissions) {
    if (permission.kind !== "network" || typeof permission.scope !== "string") continue;
    const parts = permission.scope.split(/,|;|\s+e\s+|\s+and\s+/).map((part) => part.trim()).filter(Boolean);
    const words = parts.filter((part) => !HOST.test(part.toLowerCase()));
    for (const part of parts) if (HOST.test(part.toLowerCase())) hosts.add(part.toLowerCase());
    // A scope with no host at all stays as written; a mixed one keeps only its words.
    if (words.length) notes.push(words.length === parts.length ? permission.scope.trim() : words.join(", "));
  }
  return { hosts: [...hosts], notes };
}

/**
 * What a person adds to a cloud environment's allowed domains for a host. A domain of two labels
 * (youtube.com) also takes its subdomains (www., the servers of its videos); a longer name
 * (api.apify.com) is the API itself.
 */
export function allowlistEntries(host: string): string[] {
  if (host.startsWith("*.")) return [host];
  return host.split(".").length === 2 ? [host, `*.${host}`] : [host];
}

/** The entries of these hosts the session's network refuses, probed through `reach` (api/network.ts). */
export async function refusedHosts(ctx: Context, hosts: string[]): Promise<string[]> {
  const probe: Context = { ...ctx, headersDeadlineMs: Math.min(ctx.headersDeadlineMs ?? PROBE_DEADLINE_MS, PROBE_DEADLINE_MS) };
  const refused = await Promise.all(
    hosts.map(async (host) => {
      if (host.startsWith("*.")) return [];
      const targets = host.split(".").length === 2 ? [host, `www.${host}`] : [host];
      for (const target of targets) {
        try {
          const response = await reach(probe, `https://${target}/`, { method: "HEAD", redirect: "manual" });
          await response.body?.cancel().catch(() => undefined);
        } catch (error) {
          if (error instanceof CliError && error.code === "host_not_allowed") return allowlistEntries(host);
        }
      }
      return [];
    }),
  );
  return [...new Set(refused.flat())];
}

export type CloudNetwork = { blocked: string[]; notes: string[]; message?: string };

function listed(ctx: Context, items: string[]): string {
  const and = ctx.locale === "en" ? "and" : "e";
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

/**
 * In a Claude Code cloud session, the network the installed apps need and this session does not
 * reach: the entries to add to the environment's allowed domains, with one message for the member,
 * so the AI asks once instead of finding each refusal in the middle of the work. Null outside a
 * cloud session, and when no app of the list declares a host or a note.
 */
export async function cloudNetwork(ctx: Context, slugs: string[]): Promise<CloudNetwork | null> {
  if (!isCloudSession(ctx)) return null;
  const lock = readLock(ctx);
  const hosts = new Map<string, Set<string>>();
  const notes: string[] = [];
  for (const slug of slugs) {
    let permissions: Permission[] = [];
    try {
      const manifest = JSON.parse(readFileSync(join(moduleDir(ctx, slug), MANIFEST_FILE), "utf8").replace(/^﻿/, "")) as { permissions?: Permission[] };
      permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
    } catch {
      continue;
    }
    const declared = declaredNetwork(permissions);
    const title = lock?.modules[slug]?.title || slug;
    for (const host of declared.hosts) hosts.set(host, (hosts.get(host) ?? new Set()).add(title));
    notes.push(...declared.notes);
  }
  if (hosts.size === 0 && notes.length === 0) return null;
  const blocked = await refusedHosts(ctx, [...hosts.keys()]);
  if (blocked.length === 0) return { blocked, notes };
  const apps = [...new Set([...hosts.entries()].filter(([host]) => blocked.includes(host)).flatMap(([, titles]) => [...titles]))];
  const head = t(ctx, apps.length > 1 ? "network.cloud_blocked_many" : "network.cloud_blocked_one", {
    hosts: listed(ctx, blocked.map((host) => `\`${host}\``)),
    apps: listed(ctx, apps),
  });
  const message = `${head} ${t(ctx, "network.cloud_steps")}`;
  ctx.io.out(message);
  return { blocked, notes, message };
}
