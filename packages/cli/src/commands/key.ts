import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

import type { Context } from "../context.ts";
import { freePort, KEY_PAGE_TTL_MS, type KeyPageInfo, serveKeyPage, waitForPort } from "../key-page.ts";
import { t } from "../i18n.ts";
import { KEY_NAME, keySource, keysPath, readKeys, writeKeys } from "../state/keys.ts";
import { readLock } from "../state/lock.ts";
import { askOrExplain } from "./confirm.ts";
import { has, type ParsedArgs, type Result } from "./types.ts";

/** The apps of this project that declare a key, from the lock (manifest `external_credentials`). */
function declaredKeys(ctx: Context): Map<string, { apps: string[]; required: boolean; name: string; url?: string }> {
  const declared = new Map<string, { apps: string[]; required: boolean; name: string; url?: string }>();
  for (const [slug, module] of Object.entries(readLock(ctx)?.modules ?? {})) {
    for (const credential of module.external_credentials) {
      const entry = declared.get(credential.env) ?? { apps: [], required: false, name: credential.name, url: credential.url };
      entry.apps.push(slug);
      entry.required ||= credential.required;
      declared.set(credential.env, entry);
    }
  }
  return declared;
}

function usage(ctx: Context): Result {
  return { ok: false, error: "usage", message: t(ctx, "key.usage") };
}

/** A refusal the member must read: main() prints only usage errors on its own. */
function refuse(ctx: Context, error: string, message: string): Result {
  ctx.io.err(message);
  return { ok: false, error, message };
}

/** What the key page shows about a key: where to get it and which apps of this project use it. */
function pageInfo(ctx: Context, name: string): KeyPageInfo {
  const entry = declaredKeys(ctx).get(name);
  return entry ? { label: entry.name, url: entry.url, apps: entry.apps } : {};
}

/**
 * The browser path, the one the member's AI uses: a page on 127.0.0.1 where the
 * member pastes the key. By default the page is served by a detached process
 * and this command returns at once (an AI's command has a short time limit);
 * `--wait` serves it here and returns when the key is saved.
 */
async function setKeyInBrowser(ctx: Context, args: ParsedArgs, name: string): Promise<Result> {
  const token = randomBytes(24).toString("base64url");
  const info = pageInfo(ctx, name);
  const announce = async (url: string) => {
    const opened = await ctx.io.openBrowser(url);
    ctx.io.out(t(ctx, "key.browser_opened", { name }));
    if (!opened) ctx.io.out(t(ctx, "key.browser_url", { url }));
  };

  if (has(args, "wait") || !ctx.cliEntry) {
    let url = "";
    let announced: Promise<void> = Promise.resolve();
    const saved = await serveKeyPage(ctx, name, {
      port: 0,
      token,
      info,
      onListening: (address) => {
        url = address;
        announced = announce(address);
      },
    });
    await announced;
    if (!saved.saved) return refuse(ctx, "key_page_expired", t(ctx, "key.browser_timeout", { name }));
    ctx.io.out(t(ctx, "key.saved", { name, length: saved.length ?? 0, file: keysPath(ctx) }));
    return { ok: true, name, saved: true, via: "browser", url, file: keysPath(ctx) };
  }

  const port = await freePort();
  const child = spawn(process.execPath, [...process.execArgv, ctx.cliEntry, "key", "serve", name], {
    cwd: ctx.cwd,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: { ...process.env, FLYEE_KEY_PORT: String(port), FLYEE_KEY_TOKEN: token, FLYEE_KEY_INFO: JSON.stringify(info), FLYEE_LOCALE: ctx.locale },
  });
  child.unref();
  if (!(await waitForPort(port))) return refuse(ctx, "key_page_failed", t(ctx, "key.browser_failed"));
  const url = `http://127.0.0.1:${port}/k/${token}`;
  await announce(url);
  return { ok: true, name, waiting: true, via: "browser", url, expires_in: KEY_PAGE_TTL_MS / 1000, check: "npx --yes flyee@latest key list --json" };
}

/** `flyee key serve <NAME>`: the detached process behind the page; not for people. */
async function serveKey(ctx: Context, name: string | undefined): Promise<Result> {
  const port = Number(ctx.env.FLYEE_KEY_PORT);
  const token = ctx.env.FLYEE_KEY_TOKEN ?? "";
  if (!name || !KEY_NAME.test(name) || !Number.isInteger(port) || port <= 0 || token.length < 16) return usage(ctx);
  let info: KeyPageInfo = {};
  try {
    info = JSON.parse(ctx.env.FLYEE_KEY_INFO ?? "{}") as KeyPageInfo;
  } catch {
    info = {};
  }
  const result = await serveKeyPage(ctx, name, { port, token, info });
  if (!result.saved) return { ok: false, error: "key_page_expired", message: t(ctx, "key.browser_timeout", { name }), name };
  return { ok: true, name, saved: true };
}

/**
 * `flyee key set <NAME>`: run by the member's AI, it opens the key page in the
 * member's browser; run by the member in a terminal, it asks with the echo
 * off. The value is never accepted as an argument (it would stay in the shell
 * history and in the AI's view) and never printed back, not even in --json.
 */
async function setKey(ctx: Context, args: ParsedArgs, name: string | undefined, extra: string[]): Promise<Result> {
  if (!name || !KEY_NAME.test(name)) return { ok: false, error: "usage", message: t(ctx, "key.bad_name", { name: name ?? "" }) };
  if (extra.length) return refuse(ctx, "key_in_arguments", t(ctx, "key.in_arguments", { name }));
  if (has(args, "browser")) return setKeyInBrowser(ctx, args, name);
  const raw = has(args, "stdin") ? await ctx.io.stdin() : await ctx.io.secret(t(ctx, "key.prompt", { name }));
  // No terminal to type on: the AI ran it. The member pastes the key in the browser instead.
  if (raw === null) return setKeyInBrowser(ctx, args, name);
  const value = raw.trim();
  if (!value) return refuse(ctx, "key_empty", t(ctx, "key.empty"));
  if (/[\r\n]/.test(value)) return refuse(ctx, "key_invalid", t(ctx, "key.multiline"));

  const store = readKeys(ctx);
  const replaced = name in store.keys;
  store.keys[name] = value;
  writeKeys(ctx, store);
  ctx.io.out(t(ctx, replaced ? "key.replaced" : "key.saved", { name, length: value.length, file: keysPath(ctx) }));
  const apps = declaredKeys(ctx).get(name)?.apps ?? [];
  if (apps.length) ctx.io.out(t(ctx, "key.used_by", { apps: apps.join(", ") }));
  const shadowed = ctx.env[name] !== undefined;
  if (shadowed) ctx.io.out(t(ctx, "key.environment_wins", { name }));
  return { ok: true, name, replaced, file: keysPath(ctx), used_by: apps, environment_wins: shadowed };
}

/** `flyee key list`: names, where each key is and which apps use it. Never a value. */
function listKeys(ctx: Context): Result {
  const store = readKeys(ctx);
  const declared = declaredKeys(ctx);
  const names = [...new Set([...Object.keys(store.keys), ...declared.keys()])].sort();
  const keys = names.map((name) => {
    const entry = declared.get(name);
    return { name, source: keySource(ctx, name), saved: name in store.keys, apps: entry?.apps ?? [], required: entry?.required ?? false, url: entry?.url ?? null };
  });
  ctx.io.out(t(ctx, "key.list_header", { file: keysPath(ctx) }));
  if (!keys.length) ctx.io.out(t(ctx, "key.list_empty"));
  for (const key of keys) {
    const where = key.source === "environment" ? t(ctx, "key.where_environment") : key.source === "flyee" ? t(ctx, "key.where_saved") : t(ctx, key.required ? "key.where_missing_required" : "key.where_missing");
    const apps = key.apps.length ? t(ctx, "key.list_apps", { apps: key.apps.join(", ") }) : "";
    const url = !key.source && key.url ? t(ctx, "key.list_url", { url: key.url }) : "";
    ctx.io.out(`  - ${key.name}: ${where}${apps}${url}`);
  }
  return { ok: true, file: keysPath(ctx), keys };
}

/** `flyee key remove <NAME>`: asks first, unless --yes. */
async function removeKey(ctx: Context, name: string | undefined, args: ParsedArgs): Promise<Result> {
  if (!name || !KEY_NAME.test(name)) return { ok: false, error: "usage", message: t(ctx, "key.bad_name", { name: name ?? "" }) };
  const store = readKeys(ctx);
  if (!(name in store.keys)) {
    ctx.io.out(t(ctx, "key.not_saved", { name }));
    return { ok: true, name, removed: false };
  }
  const answer = await askOrExplain(ctx, t(ctx, "key.confirm_remove", { name }), args, { plan: false });
  if (answer !== true) {
    if (answer !== false) return answer;
    ctx.io.out(t(ctx, "key.kept", { name }));
    return { ok: true, name, removed: false };
  }
  delete store.keys[name];
  writeKeys(ctx, store);
  ctx.io.out(t(ctx, "key.removed", { name }));
  return { ok: true, name, removed: true };
}

export async function runKey(ctx: Context, args: ParsedArgs): Promise<Result> {
  const [action, name, ...extra] = args.positionals;
  switch (action) {
    case "set":
      return setKey(ctx, args, name, extra);
    case "serve":
      return serveKey(ctx, name);
    case "list":
    case undefined:
      return listKeys(ctx);
    case "remove":
      return removeKey(ctx, name, args);
    default:
      return usage(ctx);
  }
}
