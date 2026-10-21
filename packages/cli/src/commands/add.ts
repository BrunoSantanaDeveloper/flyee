import { readdirSync } from "node:fs";
import { join } from "node:path";

import { Client } from "../api/client.ts";
import { ApiError } from "../api/errors.ts";
import type { CatalogModule, Recipe } from "../api/types.ts";
import type { Context } from "../context.ts";
import { type CoreAssets, loadCoreAssets } from "../core-assets.ts";
import { t } from "../i18n.ts";
import { downloadBytes } from "../install/download.ts";
import { cloudNetwork } from "../install/hosts.ts";
import { installBytes, keepCatalog } from "../install/installer.ts";
import { flushEvents, registerMachine } from "../registration.ts";
import { compareSemver } from "../semver.ts";
import { enqueueEvent } from "../state/events.ts";
import { keySource } from "../state/keys.ts";
import { programsDeclared } from "../programs.ts";
import { ensurePrograms, isPresent, specsForApp } from "./need.ts";
import { catalogSnapshot, readLock, writeLock } from "../state/lock.ts";
import { projectsIn } from "../state/projects.ts";
import { writeFileAtomic } from "../util/fs.ts";
import { CLI_VERSION } from "../version.ts";
import { askOrExplain } from "./confirm.ts";
import { flag, type ParsedArgs, type Result } from "./types.ts";

function localized(value: Record<string, string | undefined> | undefined, locale: string): string {
  if (!value) return "";
  return value[locale] ?? value["pt-BR"] ?? "";
}

/** The review the member sees before anything is downloaded (declared permissions, keys, checksum). */
/** The programs an app declares and whether each is already here, from the catalog's permissions. */
function programsOfModule(ctx: Context, assets: CoreAssets, module: CatalogModule): { name: string; label: string; present: boolean }[] {
  return specsForApp(assets, programsDeclared(assets.programs, module.latest?.permissions)).map((spec) => ({
    name: spec.name,
    label: spec.label,
    present: isPresent(ctx, spec),
  }));
}

export function printReview(ctx: Context, module: CatalogModule, assets: CoreAssets): void {
  const latest = module.latest!;
  const programs = programsOfModule(ctx, assets, module);
  if (programs.length) {
    const list = programs.map((program) => (program.present ? t(ctx, "add.program_present", { label: program.label }) : t(ctx, "add.program_missing", { label: program.label }))).join(", ");
    ctx.io.out(t(ctx, "add.programs", { list }));
  }
  ctx.io.out(t(ctx, "add.review", { title: module.name, slug: module.slug, version: latest.version }));
  ctx.io.out(t(ctx, "add.permissions"));
  if (latest.permissions.length === 0) ctx.io.out(t(ctx, "add.no_permissions"));
  for (const permission of latest.permissions) {
    ctx.io.out(t(ctx, "add.permission_line", { kind: permission.kind, scope: permission.scope, reason: localized(permission.reason, ctx.locale) }));
  }
  if (module.external_credentials.length) {
    ctx.io.out(t(ctx, "add.credentials"));
    for (const credential of module.external_credentials) {
      ctx.io.out(
        t(ctx, "add.credential_line", {
          name: credential.name,
          env: credential.env,
          required: credential.required ? " *" : "",
          purpose: localized(credential.purpose, ctx.locale),
        }),
      );
    }
  }
}

/** Downloads, verifies and installs one app into `ctx.cwd`; `new` calls it with another project's folder. */
export async function installModule(ctx: Context, client: Client, assets: CoreAssets, module: CatalogModule, kind?: "own" | "client") {
  const latest = module.latest!;
  const download = await client.download(module.slug, latest.version);
  const bytes = await downloadBytes(ctx, download.url);
  const result = installBytes(ctx, assets, bytes, { sha256: download.sha256, size_bytes: download.size_bytes, slug: module.slug, version: latest.version }, download.license);
  const lock = readLock(ctx)!;
  if (kind) {
    lock.project_kind = kind;
    writeLock(ctx, lock);
  }
  enqueueEvent(ctx, "module.installed", {
    module: module.slug,
    version: latest.version,
    trail: module.trail,
    cli_version: CLI_VERSION,
    core_version: assets.core.version,
    project_kind: lock.project_kind ?? "",
  });
  ctx.io.out(t(ctx, "add.checksum", { sha: download.sha256, size: download.size_bytes, url: download.verify_url }));
  const skills = result.module.skills.length ? ` ${t(ctx, "add.skills", { skills: result.module.skills.join(", ") })}` : "";
  ctx.io.out(`${t(ctx, "add.installed", { slug: module.slug, version: latest.version })}${skills}`);
  // The member approved the app, and with it the programs it declares: install what is missing now.
  const programs = ensurePrograms(ctx, specsForApp(assets, result.module.programs)).map(({ name, label, status, reason, member_step, detail }) => ({
    name,
    label,
    status,
    ...(reason ? { reason } : {}),
    ...(member_step ? { member_step } : {}),
    ...(detail ? { detail } : {}),
  }));
  for (const credential of result.module.external_credentials) {
    if (credential.required && !keySource(ctx, credential.env)) {
      const where = credential.url ? t(ctx, "add.where", { url: credential.url }) : "";
      ctx.io.out(t(ctx, "add.missing_env", { env: credential.env, name: credential.name, where }));
    }
  }
  // In the result too, not only in the lines: an app installs even when a program could not, and the AI must see which.
  return { ...result, programs };
}

export async function billingLink(client: Client): Promise<string | undefined> {
  try {
    return (await client.me()).links.billing;
  } catch {
    return undefined;
  }
}

/** `flyee add <slug>` and `flyee add receita:<slug>`: CLI-CONTRACT.md 4.3, 4.5, 4.6, 4.7. */
export async function runAdd(ctx: Context, args: ParsedArgs): Promise<Result> {
  const target = args.positionals[0];
  if (!target) return { ok: false, error: "usage", message: "flyee add <app> | flyee add receita:<nome>" };
  // A folder that holds the brands' projects and has no apps of its own: an app goes into a brand's project.
  const projects = projectsIn(ctx.cwd, ctx.flyeeHome);
  if (projects.length && !Object.keys(readLock(ctx)?.modules ?? {}).length) {
    const message = t(ctx, "add.projects_folder", { list: projects.join(", ") });
    ctx.io.out(message);
    return { ok: false, error: "projects_folder", message, projects };
  }
  const client = new Client(ctx);
  const assets = loadCoreAssets();
  const recipeMatch = /^(?:receita|recipe):(.+)$/.exec(target);
  const slug = recipeMatch ? recipeMatch[1] : target;
  const kind = flag(args, "kind") === "client" ? "client" : flag(args, "kind") === "own" ? "own" : undefined;

  if (!client.hasCredentials()) {
    // The funnel moment: the member copied the command from a video and has no account yet.
    let link: string | undefined;
    try {
      const info = await client.version();
      // The page in the reader's language when the platform serves it (CLI-CONTRACT.md 4.9, since 2026-10-08).
      const template = (ctx.locale === "en" ? info.links?.module_page_en : undefined) ?? info.links?.module_page;
      link = template?.replace("{slug}", encodeURIComponent(slug));
    } catch {
      link = undefined;
    }
    ctx.io.out(t(ctx, "add.not_logged", { slug }));
    ctx.io.out(t(ctx, "add.not_logged_link", { url: link ?? ctx.baseUrl }));
    return { ok: false, error: "not_logged", message: t(ctx, "add.not_logged", { slug }), action_url: link ?? ctx.baseUrl };
  }

  await client.ensureMinVersion();
  client.onDeviceUnknown(async () => {
    await registerMachine(ctx, client, assets, { kind });
  });

  if (recipeMatch) return runAddRecipe(ctx, client, assets, slug, kind, args);

  const catalog = await client.catalog(ctx.locale);
  const module = catalog.modules.find((candidate) => candidate.slug === slug);
  if (!module || !module.latest) {
    ctx.io.out(t(ctx, "add.not_found", { slug }));
    return { ok: false, error: "not_found", message: t(ctx, "add.not_found", { slug }) };
  }
  if (!module.entitled) {
    const url = await billingLink(client);
    ctx.io.out(t(ctx, "add.locked", { slug }));
    if (url) ctx.io.out(url);
    return { ok: false, error: "denied_entitlement", message: t(ctx, "add.locked", { slug }), action_url: url };
  }
  const installed = readLock(ctx)?.modules[slug];
  if (installed && !installed.dev && compareSemver(installed.version, module.latest.version) >= 0) {
    ctx.io.out(t(ctx, "add.already", { slug, version: installed.version }));
    return { ok: true, slug, version: installed.version, changed: false };
  }
  if (module.type === "framework") {
    const entries = readdirSync(ctx.cwd).filter((name) => name !== ".flyee");
    if (entries.length > 0) {
      ctx.io.out(t(ctx, "add.framework", { slug }));
      return { ok: false, error: "framework_needs_empty_folder", message: t(ctx, "add.framework", { slug }) };
    }
  }

  printReview(ctx, module, assets);
  if (ctx.dryRun) {
    ctx.io.out(t(ctx, "add.dry_run"));
    return {
      ok: true,
      slug,
      version: module.latest.version,
      dry_run: true,
      permissions: module.latest.permissions,
      external_credentials: module.external_credentials,
      programs: programsOfModule(ctx, assets, module),
    };
  }
  const answer = await askOrExplain(ctx, t(ctx, "add.confirm"), args);
  if (answer !== true) {
    if (answer !== false) return answer;
    ctx.io.out(t(ctx, "add.cancelled"));
    return { ok: false, error: "cancelled", message: t(ctx, "add.cancelled") };
  }

  const result = await installModule(ctx, client, assets, module, kind);
  // The catalog just read refreshes what the block lists besides the apps installed.
  keepCatalog(ctx, assets, catalogSnapshot(catalog, ctx.now()));
  try {
    await registerMachine(ctx, client, assets, { kind });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  }
  await flushEvents(ctx, client);
  // The skills' folder only for an app that has skills: the AI reads its SKILL.md and goes on.
  ctx.io.out(t(ctx, result.module.skills.length ? "add.next" : "add.next_guide", { slug }));
  // In a cloud session, the hosts the app needs and the session does not reach, asked for once.
  const network = await cloudNetwork(ctx, [slug]);
  return { ok: true, slug, version: result.module.version, changed: true, skills: result.module.skills, written: result.written, programs: result.programs, ...(network ? { network } : {}) };
}

async function runAddRecipe(ctx: Context, client: Client, assets: CoreAssets, slug: string, kind: "own" | "client" | undefined, args: ParsedArgs): Promise<Result> {
  let recipe: Recipe;
  try {
    recipe = await client.recipe(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      ctx.io.out(t(ctx, "add.not_found", { slug }));
      return { ok: false, error: "not_found", message: t(ctx, "add.not_found", { slug }) };
    }
    throw error;
  }
  if (!recipe.entitled) {
    const url = recipe.upgrade_url ?? (await billingLink(client));
    ctx.io.out(t(ctx, "recipe.locked", { slug, url: url ?? "" }));
    return { ok: false, error: "denied_entitlement", message: t(ctx, "recipe.locked", { slug, url: url ?? "" }), action_url: url };
  }
  const installable = recipe.modules.filter((module) => module.entitled && module.latest);
  for (const module of installable) printReview(ctx, module, assets);
  if (ctx.dryRun) return { ok: true, recipe: slug, modules: installable.map((module) => module.slug), dry_run: true };
  const answer = await askOrExplain(ctx, t(ctx, "add.confirm"), args);
  if (answer !== true) {
    if (answer !== false) return answer;
    ctx.io.out(t(ctx, "add.cancelled"));
    return { ok: false, error: "cancelled", message: t(ctx, "add.cancelled") };
  }
  const installed: string[] = [];
  const programs = new Map<string, Awaited<ReturnType<typeof installModule>>["programs"][number]>();
  for (const module of installable) {
    const current = readLock(ctx)?.modules[module.slug];
    if (current && !current.dev && compareSemver(current.version, module.latest!.version) >= 0) {
      installed.push(module.slug);
      continue;
    }
    for (const program of (await installModule(ctx, client, assets, module, kind)).programs) programs.set(program.name, program);
    installed.push(module.slug);
  }
  const lock = readLock(ctx);
  if (lock) {
    if (recipe.workflow) writeFileAtomic(join(ctx.cwd, ".flyee", "recipes", slug, "workflow.md"), recipe.workflow);
    lock.recipes[slug] = { modules: installed, installed_at: new Date(ctx.now()).toISOString() };
    writeLock(ctx, lock);
  }
  enqueueEvent(ctx, "recipe.installed", { module: installed[0] ?? "", cli_version: CLI_VERSION, core_version: assets.core.version });
  try {
    await registerMachine(ctx, client, assets, { kind });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  }
  await flushEvents(ctx, client);
  ctx.io.out(t(ctx, "recipe.installed", { slug, count: installed.length }));
  const network = await cloudNetwork(ctx, installed);
  return { ok: true, recipe: slug, modules: installed, workflow: Boolean(recipe.workflow), programs: [...programs.values()], ...(network ? { network } : {}) };
}
