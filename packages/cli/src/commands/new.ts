import { existsSync, mkdirSync, readdirSync, rmdirSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { Client } from "../api/client.ts";
import { ApiError, CliError } from "../api/errors.ts";
import type { Catalog, CatalogModule } from "../api/types.ts";
import type { Context } from "../context.ts";
import { loadCoreAssets } from "../core-assets.ts";
import { t } from "../i18n.ts";
import { installFromDirectory } from "../install/installer.ts";
import { flushEvents, registerMachine } from "../registration.ts";
import { compareSemver } from "../semver.ts";
import { readLock, writeLock } from "../state/lock.ts";
import { rememberProject } from "../state/projects.ts";
import { billingLink, installModule, printReview } from "./add.ts";
import { askOrExplain } from "./confirm.ts";
import { productRepoAbove } from "./dev.ts";
import { ensurePrograms, specsForApp } from "./need.ts";
import { flag, type ParsedArgs, type Result } from "./types.ts";

export type NewLine = {
  slug: string;
  version: string | null;
  status: "installed" | "already" | "locked" | "unavailable" | "framework" | "dev";
};

/** A bare name becomes a folder beside this project; anything with a path is taken as written. */
export function projectFolder(cwd: string, arg: string): string {
  const bare = !isAbsolute(arg) && !/[\\/]/.test(arg) && arg !== "." && arg !== "..";
  return bare ? join(dirname(resolve(cwd)), arg) : resolve(cwd, arg);
}

function contains(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/**
 * `flyee new <folder> [--apps a,b] [--kind own|client]`: another project with
 * the apps of this one. A project is a folder: each keeps its own apps, the
 * voice and the brand an app learns, and what the apps deliver, so one brand
 * or client per folder keeps work apart. Nothing new on the wire: every app
 * goes through the same gates as `add` (CLI-CONTRACT.md 4.3 catalog, 4.5
 * download), and the machine is reported once at the end (4.2).
 */
export async function runNew(ctx: Context, args: ParsedArgs): Promise<Result> {
  const arg = args.positionals[0];
  if (!arg) return { ok: false, error: "usage", message: t(ctx, "new.usage") };
  const here = resolve(ctx.cwd);
  const target = projectFolder(here, arg);
  if (contains(here, target) || contains(target, here)) {
    const message = t(ctx, "new.nested", { path: target });
    ctx.io.out(message);
    return { ok: false, error: "nested_project", message };
  }
  const repo = productRepoAbove(target);
  if (repo) {
    const message = t(ctx, "new.inside_repo", { path: target, root: repo });
    ctx.io.out(message);
    return { ok: false, error: "inside_product_repo", message };
  }

  const source = readLock(ctx);
  const requested = [...new Set((flag(args, "apps")?.split(",") ?? Object.keys(source?.modules ?? {})).map((slug) => slug.trim()).filter(Boolean))];
  if (requested.length === 0) {
    ctx.io.out(t(ctx, "new.no_apps"));
    return { ok: false, error: "no_apps", message: t(ctx, "new.no_apps") };
  }
  const kind = flag(args, "kind") === "client" ? "client" : flag(args, "kind") === "own" ? "own" : undefined;
  const assets = loadCoreAssets();
  const targetCtx: Context = { ...ctx, cwd: target };
  const there = readLock(targetCtx);

  // Apps the operator linked from a directory never came from the platform; the rest pass its gates again.
  const fromPlatform = requested.filter((slug) => !source?.modules[slug]?.dev);
  let client: Client | null = null;
  let catalog: Catalog | null = null;
  if (fromPlatform.length) {
    client = new Client(ctx);
    if (!client.hasCredentials()) throw new CliError("not_logged", "no credentials");
    await client.ensureMinVersion();
    const reporter = client;
    client.onDeviceUnknown(async () => {
      await registerMachine(ctx, reporter, assets, { kind });
    });
    catalog = await client.catalog(ctx.locale);
  }

  const lines: NewLine[] = [];
  const installs: { line: NewLine; module: CatalogModule }[] = [];
  const links: { line: NewLine; dir: string }[] = [];
  for (const slug of requested) {
    const mine = source?.modules[slug];
    if (mine?.dev) {
      const line: NewLine = { slug, version: mine.version, status: "dev" };
      if (ctx.dev && mine.source_dir && existsSync(mine.source_dir)) links.push({ line, dir: mine.source_dir });
      lines.push(line);
      continue;
    }
    const module = catalog?.modules.find((candidate) => candidate.slug === slug);
    const line: NewLine = { slug, version: module?.latest?.version ?? null, status: "unavailable" };
    lines.push(line);
    if (!module || !module.latest) continue;
    if (!module.entitled) line.status = "locked";
    else if (module.type === "framework") line.status = "framework";
    else {
      const installed = there?.modules[slug];
      if (installed && !installed.dev && compareSemver(installed.version, module.latest.version) >= 0) {
        line.status = "already";
        line.version = installed.version;
      } else installs.push({ line, module });
    }
  }

  const coming = [...installs.map((item) => item.line), ...links.map((item) => item.line)];
  for (const line of lines) {
    if (coming.includes(line)) continue;
    ctx.io.out(t(ctx, `new.skip.${line.status}` as "new.skip.locked", { slug: line.slug, version: line.version ?? "" }));
  }
  if (coming.length === 0 && !lines.some((line) => line.status === "already")) {
    const message = t(ctx, "new.nothing", { path: target });
    ctx.io.out(message);
    const url = client && lines.some((line) => line.status === "locked") ? await billingLink(client) : undefined;
    if (url) ctx.io.out(url);
    return { ok: false, error: "nothing_to_install", message, action_url: url, path: target, apps: lines };
  }
  ctx.io.out(t(ctx, "new.review", { path: target, list: coming.map((line) => `${line.slug} ${line.version ?? ""}`.trim()).join(", ") }));
  // An app this project does not have is new to the member: show what it asks for, as `add` does.
  for (const item of installs) if (!source?.modules[item.line.slug]) printReview(ctx, item.module, assets);

  if (ctx.dryRun) {
    ctx.io.out(t(ctx, "add.dry_run"));
    return { ok: true, dry_run: true, path: target, apps: lines };
  }
  const answer = await askOrExplain(ctx, t(ctx, "new.confirm"), args);
  if (answer !== true) {
    if (answer !== false) return answer;
    ctx.io.out(t(ctx, "add.cancelled"));
    return { ok: false, error: "cancelled", message: t(ctx, "add.cancelled") };
  }

  const existed = existsSync(target);
  mkdirSync(target, { recursive: true });
  try {
    for (const { line, module } of installs) {
      await installModule(targetCtx, client!, assets, module, kind);
      line.status = "installed";
    }
    for (const { line, dir } of links) {
      const linked = installFromDirectory(targetCtx, assets, dir);
      ensurePrograms(targetCtx, specsForApp(assets, linked.module.programs));
      line.status = "installed";
    }
  } finally {
    // A folder this command created and left empty is not a project.
    if (!existed && existsSync(target) && readdirSync(target).length === 0) rmdirSync(target);
  }
  const lock = readLock(targetCtx);
  if (lock && kind && lock.project_kind !== kind) {
    lock.project_kind = kind;
    writeLock(targetCtx, lock);
  }
  if (client) {
    try {
      await registerMachine(targetCtx, client, assets, { kind });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
    await flushEvents(ctx, client);
  } else rememberProject(targetCtx, kind);

  const recipes = Object.keys(source?.recipes ?? {});
  ctx.io.out(t(ctx, "new.done", { path: target, count: lines.filter((line) => line.status === "installed" || line.status === "already").length }));
  if (recipes.length) ctx.io.out(t(ctx, "new.recipes", { list: recipes.join(", ") }));
  ctx.io.out(t(ctx, "new.open"));
  return { ok: true, path: target, created: !existed, apps: lines, recipes_not_copied: recipes, next_step: "open_folder" };
}
