import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

import { Client } from "../api/client.ts";
import { ApiError, CliError } from "../api/errors.ts";
import { isCloudSession } from "../api/network.ts";
import type { Catalog, CatalogModule } from "../api/types.ts";
import type { Context } from "../context.ts";
import { loadCoreAssets } from "../core-assets.ts";
import { t } from "../i18n.ts";
import { applyAdapters } from "../install/adapters.ts";
import { installFromDirectory, keepCatalog } from "../install/installer.ts";
import { flushEvents, registerMachine } from "../registration.ts";
import { compareSemver } from "../semver.ts";
import { type CatalogSnapshot, catalogSnapshot, type Lock, newLock, readLock, writeLock } from "../state/lock.ts";
import { isFlyeeFolder, projectsIn, rememberProject, samePath } from "../state/projects.ts";
import { billingLink, installModule, printReview } from "./add.ts";
import { askOrExplain } from "./confirm.ts";
import { productRepoAbove } from "./dev.ts";
import { ensurePrograms, specsForApp } from "./need.ts";
import { flag, type ParsedArgs, type Result } from "./types.ts";

export type NewLine = {
  slug: string;
  version: string | null;
  status: "installed" | "already" | "planned" | "locked" | "unavailable" | "framework" | "dev";
};

/**
 * The project this command runs in: the nearest folder at or above the working
 * directory where flyee is installed, or the working directory itself. The AI
 * may be in a delivery folder of a brand (`medchina/estudio-de-video`), and the
 * next brand must still go next to the brand, never inside it.
 */
export function projectRoot(cwd: string, flyeeHome: string): string {
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    if (isFlyeeFolder(dir, flyeeHome)) return dir;
    if (dirname(dir) === dir) return resolve(cwd);
  }
}

/** Whether the project in a folder has apps installed. */
function hasAppsIn(dir: string): boolean {
  try {
    const lock = JSON.parse(readFileSync(join(dir, ".flyee", "lock.json"), "utf8")) as { modules?: Record<string, unknown> };
    return Object.keys(lock.modules ?? {}).length > 0;
  } catch {
    return false;
  }
}

/**
 * Brand projects already beside this one, the side-by-side layout of 1.0.1, kept
 * as it is. Only projects with apps count: a folder of projects next to another
 * one (a member's two flyee folders) is not a brand.
 */
function siblingProjects(here: string, flyeeHome: string): boolean {
  const above = dirname(here);
  try {
    return readdirSync(above, { withFileTypes: true }).some((entry) => {
      const dir = join(above, entry.name);
      return (entry.isDirectory() || entry.isSymbolicLink()) && !entry.name.startsWith(".") && !samePath(dir, here) && isFlyeeFolder(dir, flyeeHome) && hasAppsIn(dir);
    });
  } catch {
    return false;
  }
}

/**
 * The folder that holds the projects, where a new one goes. A member keeps every
 * brand inside the folder where flyee was installed and expects each one as a
 * subfolder of it; with 1.0.1, which put the next brand beside the folder, the
 * AI had to ask where a brand's work went.
 * - The folder above, for a code repository (a `.git` here), never filled with
 *   brands; except in a Claude Code cloud session, where the repository is the
 *   member's folder and a project beside it would be lost with the VM.
 * - This folder, when it already holds projects.
 * - The folder above, when flyee is installed there, or when `new` made this
 *   project (its lock says it sits in a folder of projects), or for a project
 *   with apps that already has projects with apps beside it (the 1.0.1 layout).
 * - This folder otherwise: it is the folder of projects, apps at its root or not.
 */
export function projectsHome(here: string, lock: Pick<Lock, "modules" | "in_projects_folder"> | null, flyeeHome: string, cloud = false): string {
  const above = dirname(here);
  if (above === here) return here;
  if (!cloud && existsSync(join(here, ".git"))) return above;
  if (projectsIn(here, flyeeHome).length) return here;
  if (isFlyeeFolder(above, flyeeHome) || lock?.in_projects_folder) return above;
  const hasApps = Object.keys(lock?.modules ?? {}).length > 0;
  if (hasApps && siblingProjects(here, flyeeHome)) return above;
  return here;
}

/** A bare name becomes a folder in the folder of projects; anything with a path is taken as written. */
export function projectFolder(cwd: string, arg: string, home: string): string {
  const bare = !isAbsolute(arg) && !/[\\/]/.test(arg) && arg !== "." && arg !== "..";
  return bare ? join(home, arg) : resolve(cwd, arg);
}

/**
 * How the AI goes on: in this conversation when the project sits inside the
 * folder the command ran in; otherwise the line says where it went, and the AI
 * goes on only if its conversation was opened in a folder that holds it.
 */
function goOn(ctx: Context, target: string): { next_step: "work_in_folder" | "open_folder" } {
  if (contains(resolve(ctx.cwd), target)) {
    ctx.io.out(t(ctx, "new.open"));
    return { next_step: "work_in_folder" };
  }
  ctx.io.out(t(ctx, "new.open_outside", { path: target }));
  return { next_step: "open_folder" };
}

function contains(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/**
 * A project never sits inside another one, nor holds the folder this command
 * runs in. The folder of projects is the one flyee folder a project may sit in;
 * any other above the target refuses it.
 */
export function nestedProject(target: string, here: string, home: string, flyeeHome: string): boolean {
  if (contains(target, here)) return true;
  for (let dir = dirname(target); ; dir = dirname(dir)) {
    if (!samePath(dir, home) && isFlyeeFolder(dir, flyeeHome)) return true;
    if (dirname(dir) === dir) return false;
  }
}

const RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** A folder name every system takes: Windows refuses a final dot or space, these characters and device names. */
function invalidFolderName(name: string): boolean {
  return name === "" || /[. ]$/.test(name) || /[<>:"|?*\u0000-\u001f]/.test(name) || RESERVED_NAME.test(name);
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
  const arg = args.positionals[0]?.trim();
  if (!arg) return { ok: false, error: "usage", message: t(ctx, "new.usage") };
  const here = projectRoot(ctx.cwd, ctx.flyeeHome);
  const sourceCtx: Context = { ...ctx, cwd: here };
  const source = readLock(sourceCtx);
  const home = projectsHome(here, source, ctx.flyeeHome, isCloudSession(ctx));
  const target = projectFolder(resolve(ctx.cwd), arg, home);
  if (invalidFolderName(basename(target))) {
    const message = t(ctx, "new.invalid_name", { name: basename(target) });
    ctx.io.out(message);
    return { ok: false, error: "invalid_name", message };
  }
  if (nestedProject(target, here, home, ctx.flyeeHome)) {
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

  const requested = [...new Set((flag(args, "apps")?.split(",") ?? Object.keys(source?.modules ?? {})).map((slug) => slug.trim()).filter(Boolean))];
  const kind = flag(args, "kind") === "client" ? "client" : flag(args, "kind") === "own" ? "own" : undefined;
  const assets = loadCoreAssets();
  const targetCtx: Context = { ...ctx, cwd: target };
  const there = readLock(targetCtx);
  // A folder with that name that is not a project: a code repository is never taken over; other files stay.
  let adopted = false;
  if (!there && existsSync(target)) {
    if (existsSync(join(target, ".git"))) {
      const message = t(ctx, "new.repository", { path: target });
      ctx.io.out(message);
      return { ok: false, error: "target_is_repository", message, path: target };
    }
    adopted = readdirSync(target).length > 0;
    if (adopted) ctx.io.out(t(ctx, "new.existing_folder", { path: target }));
  }
  if (requested.length === 0) {
    // The brand's project is already there, with apps: say so, as for a second run with apps to take.
    const installed = Object.entries(there?.modules ?? {});
    if (installed.length) {
      const apps = installed.map(([slug, module]): NewLine => ({ slug, version: module.version, status: "already" }));
      ctx.io.out(t(ctx, "new.done", { path: target, count: apps.length }));
      return { ok: true, path: target, created: false, apps, ...goOn(ctx, target) };
    }
    return createEmptyProject(ctx, targetCtx, args, kind, adopted, source?.catalog);
  }

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
      if (ctx.dev && mine.source_dir && existsSync(mine.source_dir)) {
        line.status = "planned";
        links.push({ line, dir: mine.source_dir });
      }
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
      } else {
        line.status = "planned";
        installs.push({ line, module });
      }
    }
  }

  const coming = [...installs.map((item) => item.line), ...links.map((item) => item.line)];
  for (const line of lines) {
    if (coming.includes(line)) continue;
    ctx.io.out(t(ctx, `new.skip.${line.status}` as "new.skip.locked", { slug: line.slug, version: line.version ?? "" }));
  }
  if (coming.length === 0 && !lines.some((line) => line.status === "already")) {
    const url = client && lines.some((line) => line.status === "locked") ? await billingLink(client) : undefined;
    // With no --apps, a project whose apps cannot come (locked, or linked outside dev mode) still gets
    // its folder, as a folder with no apps does; the lines above said why each app stays behind.
    if (!flag(args, "apps")) {
      const listed = catalog ? catalogSnapshot(catalog, ctx.now()) : source?.catalog;
      return createEmptyProject(ctx, targetCtx, args, kind, adopted, listed, { apps: lines, ...(url ? { action_url: url } : {}) });
    }
    const message = t(ctx, "new.nothing", { path: target });
    ctx.io.out(message);
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
  // The new project knows it sits in a folder of projects: the next brand made from it goes beside it.
  const lock = readLock(targetCtx);
  if (lock && ((kind && lock.project_kind !== kind) || !lock.in_projects_folder)) {
    if (kind) lock.project_kind = kind;
    lock.in_projects_folder = true;
    writeLock(targetCtx, lock);
  }
  // The brand's block lists what else the catalog offers: the list just read, or the one of the project it came from.
  const listed = catalog ? catalogSnapshot(catalog, ctx.now()) : source?.catalog;
  if (listed) keepCatalog(targetCtx, assets, listed);
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
  return { ok: true, path: target, created: !existed, apps: lines, recipes_not_copied: recipes, ...goOn(ctx, target), ...(adopted ? { existing_folder: true } : {}) };
}

/**
 * A project with no apps yet: the folder of projects had none to take and no
 * `--apps` came. The folder gets what the AI needs in a project (the AGENTS.md
 * block with what the catalog offers, the pointers, the core skills, the lock),
 * so `add` can run in it next.
 */
async function createEmptyProject(
  ctx: Context,
  targetCtx: Context,
  args: ParsedArgs,
  kind: "own" | "client" | undefined,
  adopted: boolean,
  catalog: CatalogSnapshot | undefined,
  extra: Record<string, unknown> = {},
): Promise<Result> {
  const target = targetCtx.cwd;
  ctx.io.out(t(ctx, "new.review_empty", { path: target }));
  if (ctx.dryRun) {
    ctx.io.out(t(ctx, "add.dry_run"));
    return { ok: true, dry_run: true, path: target, apps: [], ...extra };
  }
  const answer = await askOrExplain(ctx, t(ctx, "new.confirm"), args);
  if (answer !== true) {
    if (answer !== false) return answer;
    ctx.io.out(t(ctx, "add.cancelled"));
    return { ok: false, error: "cancelled", message: t(ctx, "add.cancelled") };
  }
  const existed = existsSync(target);
  mkdirSync(target, { recursive: true });
  const assets = loadCoreAssets();
  const lock = readLock(targetCtx) ?? newLock(targetCtx, assets.core.version);
  if (kind) lock.project_kind = kind;
  lock.in_projects_folder = true;
  lock.locale = ctx.locale;
  if (catalog) lock.catalog = catalog;
  applyAdapters(targetCtx, assets, lock);
  writeLock(targetCtx, lock);
  rememberProject(targetCtx, kind);
  ctx.io.out(t(ctx, "new.done_empty", { path: target }));
  return { ok: true, path: target, created: !existed, apps: [], ...extra, ...goOn(ctx, target), ...(adopted ? { existing_folder: true } : {}) };
}
