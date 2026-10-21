import { Client } from "../api/client.ts";
import { ApiError, CliError } from "../api/errors.ts";
import { loginWithBrowser, loginWithDeviceCode } from "../api/oauth.ts";
import type { TokenResponse } from "../api/types.ts";
import type { Context } from "../context.ts";
import { loadCoreAssets } from "../core-assets.ts";
import { localeOf, t } from "../i18n.ts";
import { flushEvents, registerMachine } from "../registration.ts";
import { ensureConfig, machineName, readConfig, writeConfig } from "../state/config.ts";
import { catalogSnapshot, newLock, readLock, writeLock } from "../state/lock.ts";
import { applyAdapters } from "../install/adapters.ts";
import { isCloudSession } from "../api/network.ts";
import { noBrowserReason } from "../util/os.ts";
import { commandLine } from "./confirm.ts";
import { flag, has, type ParsedArgs, type Result } from "./types.ts";

type NoBrowser = NonNullable<ReturnType<typeof noBrowserReason>> | "no_opener";

/** The answer when the browser login cannot reach the person: the same command, with --device. */
function useDeviceLogin(ctx: Context, args: ParsedArgs, reason: NoBrowser): Result {
  const command = `npx --yes flyee@latest ${commandLine(args)} --device`;
  const message =
    reason === "no_opener" ? t(ctx, "login.no_opener", { command }) : t(ctx, "login.no_browser", { where: t(ctx, `login.no_browser.${reason}`), command });
  ctx.io.err(message);
  return { ok: false, error: "no_browser", reason, message, fix: command };
}

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
  // The browser login waits for a redirect to 127.0.0.1 of this machine. With no browser in front of the
  // person (a cloud session, SSH, a server) it could only wait out its 5 minutes: it answers now instead,
  // with the login by code (CLI-CONTRACT.md 2.2, "device authorization for machines without a browser").
  const noBrowser = has(args, "device") ? null : noBrowserReason(ctx.env);
  if (noBrowser) return useDeviceLogin(ctx, args, noBrowser);
  const client = new Client(ctx);
  const assets = loadCoreAssets();
  await client.ensureMinVersion();
  // A cloud VM has a throwaway host name; the panel lists this connection by what it is instead.
  const cloud = isCloudSession(ctx);
  const named = machineName(flag(args, "name"));
  const fresh = !readConfig(ctx);
  const config = ensureConfig(ctx, named, cloud ? t(ctx, "login.cloud_device_name") : undefined);

  let tokens: TokenResponse;
  try {
    tokens = has(args, "device")
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
          // No browser opened (no opener on this system, or it gave up at once): the login by code, now.
          if (!(await ctx.io.openBrowser(url))) return false;
          await ctx.io.progress(t(ctx, "login.browser", { url }), { event: "browser_login", url });
          return true;
        });
  } catch (error) {
    if (error instanceof CliError && error.code === "no_browser") return useDeviceLogin(ctx, args, "no_opener");
    throw error;
  }
  client.storeTokens(tokens);

  const me = await client.me();
  const locale = localeOf(me.member.locale);
  if (locale !== config.locale) writeConfig(ctx, { ...config, locale });
  ctx.locale = locale;
  // A cloud computer this login created is named in the account's language, known only now; a --name stays.
  if (cloud && fresh && !named) {
    const current = readConfig(ctx);
    const name = t(ctx, "login.cloud_device_name");
    if (current && current.device_name !== name) writeConfig(ctx, { ...current, device_name: name });
  }

  const kind = flag(args, "kind") === "client" ? "client" : flag(args, "kind") === "own" ? "own" : undefined;
  let registration: Awaited<ReturnType<typeof registerMachine>> | null = null;
  try {
    registration = await registerMachine(ctx, client, assets, { kind });
  } catch (error) {
    if (error instanceof ApiError && error.code === "device_limit_reached") {
      ctx.io.err(error.message);
      if (error.actionUrl) ctx.io.err(error.actionUrl);
      // Every cloud session starts on a new VM and registers as a new computer of the plan.
      if (cloud) ctx.io.err(t(ctx, "login.device_limit_cloud"));
      return { ok: false, error: error.code, message: error.message, action_url: error.actionUrl, limit: error.extra.limit, live_devices: error.extra.live_devices, ...(cloud ? { cloud: true } : {}) };
    }
    throw error;
  }

  // The project gets its harness even before the first app, so the AI already knows about /flyee and,
  // from the catalog (CLI-CONTRACT.md 4.3), which apps it can install when a request is the work of one.
  const lock = readLock(ctx) ?? newLock(ctx, assets.core.version);
  if (kind) lock.project_kind = kind;
  lock.locale = ctx.locale;
  try {
    lock.catalog = catalogSnapshot(await client.catalog(ctx.locale), ctx.now());
  } catch (error) {
    // The connection is made; the list comes with the next add or update.
    if (!(error instanceof ApiError) && !(error instanceof CliError)) throw error;
  }
  applyAdapters(ctx, assets, lock);
  writeLock(ctx, lock);
  await flushEvents(ctx, client);

  const name = me.member.name ?? me.workspace.name;
  const as = name ? t(ctx, "common.as", { name }) : "";
  const days = me.token.days_until_revalidation ?? 30;
  // `tier_name` is what the CLI shows (CLI-CONTRACT.md 4.1, since 2026-10-08); `tier` is the code's value.
  const tierName = me.access.tier_name ?? me.access.tier;
  if (me.access.tier) ctx.io.out(t(ctx, "login.done", { as, tier: tierName ?? "", days }));
  // No rung bought is not "no access": the account installs the entry version of each app (CLI-CONTRACT.md 4.3).
  else ctx.io.out(t(ctx, "login.done_entry", { as, days, link: me.links.billing }));

  return {
    ok: true,
    member: me.member,
    access: me.access,
    token: me.token,
    device: { device_id: config.device_id, name: config.device_name, registration: registration?.status ?? null },
    links: me.links,
  };
}
