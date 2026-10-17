import { Client } from "../api/client.ts";
import { ApiError, CliError } from "../api/errors.ts";
import type { Catalog, Me } from "../api/types.ts";
import type { Context } from "../context.ts";
import { loadCoreAssets } from "../core-assets.ts";
import { describeFailure } from "../failure.ts";
import { t } from "../i18n.ts";
import { compareSemver } from "../semver.ts";
import { daysUntilRefreshExpiry } from "../state/credentials.ts";
import { readLock } from "../state/lock.ts";
import { CLI_VERSION } from "../version.ts";
import type { Result } from "./types.ts";

const REVALIDATION_WARNING_DAYS = 5;

/**
 * What the account has today, by the name the panel uses. With no rung bought, an
 * active account installs the entry version of each app (CLI-CONTRACT.md 4.3); an
 * inactive one (a payment past its grace) or a suspended one installs nothing.
 */
function accessLabel(ctx: Context, me: Me): string {
  if (me.access.tier) return me.access.tier_name ?? me.access.tier;
  if (me.access.suspended) return t(ctx, "status.suspended");
  if (!me.access.active) return t(ctx, "status.no_access");
  return t(ctx, "status.entry");
}

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
  let connectionMessage: string | null = null;
  let connectionHost: string | null = null;
  let deprecations: unknown[] = [];

  if (credentials) {
    try {
      me = await client.me();
      deprecations = me.cli?.deprecations ?? [];
      if (lock && Object.keys(lock.modules).length) catalog = await client.catalog(ctx.locale);
    } catch (error) {
      if (error instanceof CliError && error.code === "relogin") connectionError = "relogin";
      else if (error instanceof ApiError || error instanceof CliError) {
        // The reason travels whole: a host the network refused carries its one-time step, not just a code.
        const failure = describeFailure(ctx, error);
        connectionError = failure.error;
        connectionMessage = failure.message;
        if (typeof failure.host === "string" && failure.host) connectionHost = failure.host;
      } else throw error;
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
  const inactive = Boolean(me && !me.access.tier && (me.access.suspended || !me.access.active));
  const needsAttention = !credentials || connectionError !== null || inactive || (days !== null && days <= REVALIDATION_WARNING_DAYS) || updates > 0;

  if (ctx.quiet) {
    if (needsAttention) {
      if (!credentials || connectionError === "relogin") ctx.io.out(t(ctx, "status.not_logged"));
      else if (connectionMessage) ctx.io.out(connectionMessage);
      else if (me && inactive) ctx.io.out(accessLabel(ctx, me));
      else if (days !== null && days <= REVALIDATION_WARNING_DAYS) ctx.io.out(t(ctx, "status.revalidate_soon", { days }));
      else ctx.io.out(t(ctx, "status.quiet_updates", { count: updates }));
    }
  } else {
    if (!credentials || connectionError === "relogin") ctx.io.out(t(ctx, "status.not_logged"));
    else if (me) {
      const name = me.member.name ?? me.workspace.name;
      const parts = [t(ctx, "status.connected", { as: name ? t(ctx, "common.as", { name }) : "" })];
      parts.push(accessLabel(ctx, me));
      if (days !== null) parts.push(t(ctx, "status.days", { days }));
      ctx.io.out(parts.join(" · "));
      if (days !== null && days <= REVALIDATION_WARNING_DAYS) ctx.io.out(t(ctx, "status.revalidate_soon", { days }));
    } else if (connectionMessage) ctx.io.out(connectionMessage);
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
    connection_message: connectionMessage,
    connection_host: connectionHost,
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
