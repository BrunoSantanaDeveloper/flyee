import type { Context } from "../context.ts";
import { t } from "../i18n.ts";
import { KEY_NAME, keySource, keysPath, readKeys, writeKeys } from "../state/keys.ts";
import { readLock } from "../state/lock.ts";
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

/**
 * `flyee key set <NAME>`: the value is typed in the member's own terminal with
 * the echo off. It is never accepted as an argument (it would stay in the
 * shell history and in the AI's view) and never printed back, not even in --json.
 */
async function setKey(ctx: Context, args: ParsedArgs, name: string | undefined, extra: string[]): Promise<Result> {
  if (!name || !KEY_NAME.test(name)) return { ok: false, error: "usage", message: t(ctx, "key.bad_name", { name: name ?? "" }) };
  if (extra.length) return refuse(ctx, "key_in_arguments", t(ctx, "key.in_arguments", { name }));
  const raw = has(args, "stdin") ? await ctx.io.stdin() : await ctx.io.secret(t(ctx, "key.prompt", { name }));
  if (raw === null) return refuse(ctx, "key_needs_terminal", t(ctx, "key.needs_terminal", { name }));
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
async function removeKey(ctx: Context, name: string | undefined): Promise<Result> {
  if (!name || !KEY_NAME.test(name)) return { ok: false, error: "usage", message: t(ctx, "key.bad_name", { name: name ?? "" }) };
  const store = readKeys(ctx);
  if (!(name in store.keys)) {
    ctx.io.out(t(ctx, "key.not_saved", { name }));
    return { ok: true, name, removed: false };
  }
  if (!ctx.yes && !(await ctx.io.confirm(t(ctx, "key.confirm_remove", { name })))) {
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
    case "list":
    case undefined:
      return listKeys(ctx);
    case "remove":
      return removeKey(ctx, name);
    default:
      return usage(ctx);
  }
}
