import { Client } from "../api/client.ts";
import { CliError } from "../api/errors.ts";
import type { Context } from "../context.ts";
import { loadCoreAssets } from "../core-assets.ts";
import { t } from "../i18n.ts";
import { registerMachine } from "../registration.ts";
import { compareSemver } from "../semver.ts";
import { readLock } from "../state/lock.ts";
import type { Result } from "./types.ts";

/**
 * `flyee catalog`: every app of the catalog this account can install, with the
 * version its channel gives and what this project already has
 * (CLI-CONTRACT.md 4.3). The member's AI reads it to match a request to an app
 * it can install; nothing changes on disk. `entry_versions` says outright that
 * an account with nothing bought installs the entry version of each app, so the
 * AI never tells the member an app may be out of reach.
 */
export async function runCatalog(ctx: Context): Promise<Result> {
  const client = new Client(ctx);
  const assets = loadCoreAssets();
  if (!client.hasCredentials()) throw new CliError("not_logged", "no credentials");
  await client.ensureMinVersion();
  client.onDeviceUnknown(async () => {
    await registerMachine(ctx, client, assets);
  });
  const catalog = await client.catalog(ctx.locale);
  const lock = readLock(ctx);
  const apps = catalog.modules
    .filter((module) => module.latest)
    .map((module) => {
      const version = module.latest!.version;
      const mine = lock?.modules[module.slug];
      return {
        slug: module.slug,
        name: module.name,
        summary: (module.summary ?? "").trim(),
        type: module.type,
        trail: module.trail,
        version,
        entitled: module.entitled,
        installed: mine?.version ?? null,
        update_available: Boolean(mine && !mine.dev && module.entitled && compareSemver(version, mine.version) > 0),
        external_credentials: module.external_credentials.map(({ name, env, required }) => ({ name, env, required: Boolean(required) })),
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const entry = catalog.channel === "free";
  if (entry) ctx.io.out(t(ctx, "catalog.entry"));
  if (apps.length === 0) ctx.io.out(t(ctx, "catalog.empty"));
  for (const app of apps) {
    const state = !app.entitled
      ? t(ctx, "catalog.locked")
      : app.installed === null
        ? ""
        : app.update_available
          ? t(ctx, "catalog.installed_older", { installed: app.installed })
          : t(ctx, "catalog.installed");
    ctx.io.out(t(ctx, "catalog.line", { name: app.name, slug: app.slug, version: app.version, state, summary: app.summary ? `: ${app.summary}` : "" }));
  }
  return {
    ok: true,
    channel: catalog.channel,
    entry_versions: entry,
    apps,
    recipes: catalog.recipes.map(({ slug, name, summary, modules }) => ({ slug, name, summary, modules })),
  };
}
