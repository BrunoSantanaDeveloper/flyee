import { Client } from "../api/client.ts";
import { ApiError } from "../api/errors.ts";
import { loginWithBrowser, loginWithDeviceCode } from "../api/oauth.ts";
import type { Context } from "../context.ts";
import { loadCoreAssets } from "../core-assets.ts";
import { localeOf, t } from "../i18n.ts";
import { flushEvents, registerMachine } from "../registration.ts";
import { ensureConfig, machineName, writeConfig } from "../state/config.ts";
import { newLock, readLock, writeLock } from "../state/lock.ts";
import { applyAdapters } from "../install/adapters.ts";
import { flag, has, type ParsedArgs, type Result } from "./types.ts";

/**
 * `flyee login [--device] [--name <machine>] [--kind own|client]`
 * CLI-CONTRACT.md 2.1 and 2.2, then 4.2 to register the machine.
 *
 * Both logins wait for the member (up to 5 and 10 minutes), and the member's
 * AI often reads the output only as it arrives: the address, and the code of
 * --device, go out at once and flushed, on lines of their own, and under
 * --json as one JSON line ahead of the final result.
 */
export async function runLogin(ctx: Context, args: ParsedArgs): Promise<Result> {
  const client = new Client(ctx);
  const assets = loadCoreAssets();
  await client.ensureMinVersion();
  const config = ensureConfig(ctx, machineName(flag(args, "name")));

  const tokens = has(args, "device")
    ? await loginWithDeviceCode(ctx, config.device_id, async (authorization) => {
        const url = authorization.verification_uri_complete ?? authorization.verification_uri;
        await ctx.io.progress(t(ctx, "login.device_code", { url, code: authorization.user_code, minutes: Math.round(authorization.expires_in / 60) }), {
          event: "device_code",
          verification_uri: authorization.verification_uri,
          verification_uri_complete: authorization.verification_uri_complete ?? null,
          user_code: authorization.user_code,
          expires_in: authorization.expires_in,
        });
      })
    : await loginWithBrowser(ctx, config.device_id, async (url) => {
        await ctx.io.openBrowser(url);
        await ctx.io.progress(t(ctx, "login.browser", { url }), { event: "browser_login", url });
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

  const name = me.member.name ?? me.workspace.name;
  const as = name ? t(ctx, "common.as", { name }) : "";
  const days = me.token.days_until_revalidation ?? 30;
  // `tier_name` is what the CLI shows (CLI-CONTRACT.md 4.1, since 2026-10-08); `tier` is the code's value.
  const tierName = me.access.tier_name ?? me.access.tier;
  if (me.access.tier) ctx.io.out(t(ctx, "login.done", { as, tier: tierName ?? "", days }));
  else ctx.io.out(t(ctx, "login.done_no_access", { as, link: me.links.billing }));

  return {
    ok: true,
    member: me.member,
    access: me.access,
    token: me.token,
    device: { device_id: config.device_id, name: config.device_name, registration: registration?.status ?? null },
    links: me.links,
  };
}
