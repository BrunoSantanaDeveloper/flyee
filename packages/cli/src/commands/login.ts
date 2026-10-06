import { Client } from "../api/client.ts";
import { ApiError } from "../api/errors.ts";
import { loginWithBrowser, loginWithDeviceCode } from "../api/oauth.ts";
import type { Context } from "../context.ts";
import { loadCoreAssets } from "../core-assets.ts";
import { localeOf, t } from "../i18n.ts";
import { flushEvents, registerMachine } from "../registration.ts";
import { ensureConfig, writeConfig } from "../state/config.ts";
import { newLock, readLock, writeLock } from "../state/lock.ts";
import { applyAdapters } from "../install/adapters.ts";
import { flag, has, type ParsedArgs, type Result } from "./types.ts";

/**
 * `flyee login [--device] [--name <machine>] [--kind own|client]`
 * CLI-CONTRACT.md 2.1 and 2.2, then 4.2 to register the machine.
 */
export async function runLogin(ctx: Context, args: ParsedArgs): Promise<Result> {
  const client = new Client(ctx);
  const assets = loadCoreAssets();
  await client.ensureMinVersion();
  const config = ensureConfig(ctx, flag(args, "name"));

  const tokens = has(args, "device")
    ? await loginWithDeviceCode(ctx, config.device_id, (authorization) => {
        ctx.io.out(t(ctx, "login.device_code", { url: authorization.verification_uri, code: authorization.user_code }));
        ctx.io.out(t(ctx, "login.waiting"));
      })
    : await loginWithBrowser(ctx, config.device_id, async (url) => {
        ctx.io.out(t(ctx, "login.opening"));
        const opened = await ctx.io.openBrowser(url);
        if (!opened) ctx.io.out(t(ctx, "login.open_manually", { url }));
        else ctx.io.out(t(ctx, "login.open_manually", { url }));
      });
  client.storeTokens(tokens);

  const me = await client.me();
  const locale = localeOf(me.member.locale);
  if (locale !== config.locale) writeConfig(ctx, { ...config, locale });
  ctx.locale = locale;

  const kind = flag(args, "kind") === "client" ? "client" : flag(args, "kind") === "own" ? "own" : undefined;
  let registration: Awaited<ReturnType<typeof registerMachine>> | null = null;
  try {
    registration = await registerMachine(ctx, client, assets, { kind });
  } catch (error) {
    if (error instanceof ApiError && error.code === "device_limit_reached") {
      ctx.io.err(error.message);
      if (error.actionUrl) ctx.io.err(error.actionUrl);
      return { ok: false, error: error.code, message: error.message, action_url: error.actionUrl, limit: error.extra.limit, live_devices: error.extra.live_devices };
    }
    throw error;
  }

  // The project gets its harness even before the first app, so the AI already knows about /flyee.
  const lock = readLock(ctx) ?? newLock(ctx, assets.core.version);
  if (kind) lock.project_kind = kind;
  lock.locale = ctx.locale;
  applyAdapters(ctx, assets, lock);
  writeLock(ctx, lock);
  await flushEvents(ctx, client);

  const name = me.member.name ?? me.workspace.name ?? "—";
  const days = me.token.days_until_revalidation ?? 30;
  if (me.access.tier) ctx.io.out(t(ctx, "login.done", { name, tier: me.access.tier, days }));
  else ctx.io.out(t(ctx, "login.done_no_access", { name, link: me.links.billing }));

  return {
    ok: true,
    member: me.member,
    access: me.access,
    token: me.token,
    device: { device_id: config.device_id, name: config.device_name, registration: registration?.status ?? null },
    links: me.links,
  };
}
