import { Client } from "../api/client.ts";
import { ApiError, CliError } from "../api/errors.ts";
import type { Catalog, Me } from "../api/types.ts";
import type { Context } from "../context.ts";
import { loadCoreAssets } from "../core-assets.ts";
import { t } from "../i18n.ts";
import { compareSemver } from "../semver.ts";
import { daysUntilRefreshExpiry } from "../state/credentials.ts";
import { readLock } from "../state/lock.ts";
import { CLI_VERSION } from "../version.ts";
import type { Result } from "./types.ts";

const REVALIDATION_WARNING_DAYS = 5;

/**
 * `flyee status [--quiet]`: the connection, the apps and their distance to
 * what the account may install, and the platform's notices. `--quiet` prints
 * one line only when something needs doing, for session-start hooks.
 */
export async function runStatus(ctx: Context): Promise<Result> {
  const client = new Client(ctx);
  const assets = loadCoreAssets();
  const lock = readLock(ctx);
  const credentials = client.credentials();
  let me: Me | null = null;
  let catalog: Catalog | null = null;
  let connectionError: string | null = null;
  let deprecations: unknown[] = [];

  if (credentials) {
    try {
      me = await client.me();
      deprecations = me.cli?.deprecations ?? [];
      if (lock && Object.keys(lock.modules).length) catalog = await client.catalog(ctx.locale);
    } catch (error) {
      if (error instanceof CliError && error.code === "relogin") connectionError = "relogin";
      else if (error instanceof ApiError) connectionError = error.code;
      else if (error instanceof CliError) connectionError = error.code;
      else throw error;
    }
  }

  const days = me?.token.days_until_revalidation ?? (credentials ? daysUntilRefreshExpiry(credentials, ctx.now()) : null);
  const apps = Object.entries(lock?.modules ?? {}).map(([slug, module]) => {
    const entry = catalog?.modules.find((candidate) => candidate.slug === slug) ?? null;
    const latest = entry?.latest?.version ?? null;
    const newest = entry?.newest?.version ?? null;
    return {
      slug,
      version: module.version,
      latest,
      newest,
      entitled: entry?.entitled ?? null,
      update_available: Boolean(latest && !module.dev && compareSemver(latest, module.version) > 0),
      dev: Boolean(module.dev),
    };
  });
  const updates = apps.filter((app) => app.update_available).length;
  const needsAttention = !credentials || connectionError !== null || (days !== null && days <= REVALIDATION_WARNING_DAYS) || updates > 0;

  if (ctx.quiet) {
    if (needsAttention) {
      if (!credentials || connectionError) ctx.io.out(t(ctx, "status.not_logged"));
      else if (days !== null && days <= REVALIDATION_WARNING_DAYS) ctx.io.out(t(ctx, "status.revalidate_soon", { days }));
      else ctx.io.out(`${updates} update(s): npx flyee update`);
    }
  } else {
    if (!credentials || connectionError === "relogin") ctx.io.out(t(ctx, "status.not_logged"));
    else if (me) {
      const name = me.member.name ?? me.workspace.name ?? "—";
      ctx.io.out(me.access.tier ? t(ctx, "status.header", { name, tier: me.access.tier, days: days ?? "—" }) : t(ctx, "status.no_access", { name }));
      if (days !== null && days <= REVALIDATION_WARNING_DAYS) ctx.io.out(t(ctx, "status.revalidate_soon", { days }));
    } else if (connectionError) ctx.io.out(t(ctx, "error.network", { detail: connectionError }));
    if (apps.length === 0) ctx.io.out(t(ctx, "status.no_apps"));
    else {
      ctx.io.out(t(ctx, "status.apps"));
      for (const app of apps) {
        const available = app.update_available && app.latest ? t(ctx, "status.app_available", { latest: app.latest }) : "";
        ctx.io.out(t(ctx, "status.app_line", { slug: app.slug, version: app.version + (app.dev ? " (dev)" : ""), available }));
      }
    }
    for (const notice of deprecations) if (typeof notice === "string") ctx.io.out(t(ctx, "status.deprecation", { text: notice }));
  }

  return {
    ok: true,
    connected: Boolean(credentials) && connectionError === null,
    connection_error: connectionError,
    member: me?.member ?? null,
    access: me?.access ?? null,
    token: me ? me.token : credentials ? { days_until_revalidation: days } : null,
    device: me?.device ?? null,
    links: me?.links ?? null,
    revalidate_url: me?.revalidate_url ?? null,
    cli_version: CLI_VERSION,
    core_version: lock?.core_version ?? assets.core.version,
    project_kind: lock?.project_kind ?? null,
    apps,
    updates_available: updates,
    deprecations,
    needs_attention: needsAttention,
  };
}
