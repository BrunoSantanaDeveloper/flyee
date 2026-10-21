import { Client } from "../api/client.ts";
import { ApiError, CliError } from "../api/errors.ts";
import type { Context } from "../context.ts";
import { loadCoreAssets } from "../core-assets.ts";
import { t } from "../i18n.ts";
import { applyAdapters } from "../install/adapters.ts";
import { downloadBytes } from "../install/download.ts";
import { installBytes } from "../install/installer.ts";
import { flushEvents, registerMachine } from "../registration.ts";
import { compareSemver } from "../semver.ts";
import { enqueueEvent } from "../state/events.ts";
import { catalogSnapshot, readLock, writeLock } from "../state/lock.ts";
import { CLI_VERSION } from "../version.ts";
import { ensurePrograms, specsForApp } from "./need.ts";
import type { Result } from "./types.ts";

export type UpdateLine = { slug: string; from: string; to: string | null; status: "updated" | "unchanged" | "locked" | "unavailable" | "dev"; newest?: string | null };

/**
 * `flyee update`: renews the connection first (CLI-CONTRACT.md 2.3), then
 * brings every installed app to the version the account's channel offers,
 * refreshes the core, and reports the machine with `updated: true` (4.2).
 */
export async function runUpdate(ctx: Context): Promise<Result> {
  const client = new Client(ctx);
  const assets = loadCoreAssets();
  if (!client.hasCredentials()) throw new CliError("not_logged", "no credentials");
  await client.ensureMinVersion();
  await client.refresh();
  ctx.io.out(t(ctx, "update.renewed"));
  client.onDeviceUnknown(async () => {
    await registerMachine(ctx, client, assets);
  });

  const lock = readLock(ctx);
  const lines: UpdateLine[] = [];
  let billing: string | undefined;
  // Read in any flyee project, with apps or not: it also renews what the AGENTS.md block lists besides them.
  const catalog = lock ? await client.catalog(ctx.locale) : null;
  if (lock && catalog && Object.keys(lock.modules).length > 0) {
    for (const [slug, installed] of Object.entries(lock.modules)) {
      if (installed.dev) {
        lines.push({ slug, from: installed.version, to: null, status: "dev" });
        continue;
      }
      const module = catalog.modules.find((candidate) => candidate.slug === slug);
      if (!module || !module.latest) {
        lines.push({ slug, from: installed.version, to: null, status: "unavailable" });
        continue;
      }
      const newest = module.newest?.version ?? null;
      if (!module.entitled) {
        lines.push({ slug, from: installed.version, to: null, status: "locked", newest });
        continue;
      }
      if (compareSemver(module.latest.version, installed.version) > 0) {
        const download = await client.download(slug, module.latest.version);
        const bytes = await downloadBytes(ctx, download.url);
        const fresh = installBytes(ctx, assets, bytes, { sha256: download.sha256, size_bytes: download.size_bytes, slug, version: module.latest.version }, download.license);
        // A new version may use a program the previous one did not: install it, as `add` does.
        ensurePrograms(ctx, specsForApp(assets, fresh.module.programs));
        enqueueEvent(ctx, "module.updated", {
          module: slug,
          from_version: installed.version,
          to_version: module.latest.version,
          trail: module.trail,
          cli_version: CLI_VERSION,
          core_version: assets.core.version,
        });
        lines.push({ slug, from: installed.version, to: module.latest.version, status: "updated", newest });
        ctx.io.out(t(ctx, "update.updated", { slug, from: installed.version, to: module.latest.version }));
      } else {
        lines.push({ slug, from: installed.version, to: installed.version, status: "unchanged", newest });
        ctx.io.out(t(ctx, "update.unchanged", { slug, version: installed.version }));
      }
      if (newest && compareSemver(newest, module.latest.version) > 0) {
        billing = billing ?? (await client.me().then((me) => me.links.billing).catch(() => undefined));
        ctx.io.out(t(ctx, "update.behind_newest", { slug, latest: module.latest.version, newest, url: billing ?? "" }));
      }
    }
  } else {
    ctx.io.out(t(ctx, "update.nothing"));
  }

  // The core: the AGENTS.md block, pointers and the /flyee skill follow the CLI's bundled version.
  const current = readLock(ctx);
  if (current) {
    const coreChanged = current.core_version !== assets.core.version;
    current.locale = ctx.locale;
    if (catalog) current.catalog = catalogSnapshot(catalog, ctx.now());
    applyAdapters(ctx, assets, current);
    current.core_version = assets.core.version;
    writeLock(ctx, current);
    if (coreChanged) ctx.io.out(t(ctx, "update.core", { version: assets.core.version }));
  }

  try {
    await registerMachine(ctx, client, assets, { updated: true });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  }
  await flushEvents(ctx, client);
  const info = await client.version();
  for (const notice of info.deprecations) if (typeof notice === "string") ctx.io.out(t(ctx, "status.deprecation", { text: notice }));
  const updated = lines.filter((line) => line.status === "updated").length;
  if (lines.length && updated === 0) ctx.io.out(t(ctx, "update.up_to_date", { count: lines.filter((line) => line.status === "unchanged").length }));
  return { ok: true, updated, apps: lines, core_version: assets.core.version, deprecations: info.deprecations };
}
