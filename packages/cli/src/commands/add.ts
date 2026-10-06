import { readdirSync } from "node:fs";
import { join } from "node:path";

import { Client } from "../api/client.ts";
import { ApiError } from "../api/errors.ts";
import type { CatalogModule, Recipe } from "../api/types.ts";
import type { Context } from "../context.ts";
import { type CoreAssets, loadCoreAssets } from "../core-assets.ts";
import { t } from "../i18n.ts";
import { downloadBytes } from "../install/download.ts";
import { installBytes } from "../install/installer.ts";
import { flushEvents, registerMachine } from "../registration.ts";
import { compareSemver } from "../semver.ts";
import { enqueueEvent } from "../state/events.ts";
import { readLock, writeLock } from "../state/lock.ts";
import { writeFileAtomic } from "../util/fs.ts";
import { CLI_VERSION } from "../version.ts";
import { flag, type ParsedArgs, type Result } from "./types.ts";

function localized(value: Record<string, string | undefined> | undefined, locale: string): string {
  if (!value) return "";
  return value[locale] ?? value["pt-BR"] ?? "";
}

/** The review the member sees before anything is downloaded (declared permissions, keys, checksum). */
function printReview(ctx: Context, module: CatalogModule): void {
  const latest = module.latest!;
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

async function installModule(ctx: Context, client: Client, assets: CoreAssets, module: CatalogModule, kind?: "own" | "client") {
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
  ctx.io.out(t(ctx, "add.installed", { slug: module.slug, version: latest.version, skills: result.module.skills.join(", ") || "—" }));
  for (const credential of result.module.external_credentials) {
    if (credential.required && !ctx.env[credential.env]) {
      ctx.io.out(t(ctx, "add.missing_env", { env: credential.env, name: credential.name, url: credential.url ?? "" }));
    }
  }
  return result;
}

async function billingLink(client: Client): Promise<string | undefined> {
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
      link = info.links?.module_page?.replace("{slug}", encodeURIComponent(slug));
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

  if (recipeMatch) return runAddRecipe(ctx, client, assets, slug, kind);

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

  printReview(ctx, module);
  if (ctx.dryRun) {
    ctx.io.out(t(ctx, "add.dry_run"));
    return { ok: true, slug, version: module.latest.version, dry_run: true, permissions: module.latest.permissions, external_credentials: module.external_credentials };
  }
  if (!ctx.yes && !(await ctx.io.confirm(t(ctx, "add.confirm")))) {
    ctx.io.out(t(ctx, "add.cancelled"));
    return { ok: false, error: "cancelled", message: t(ctx, "add.cancelled") };
  }

  const result = await installModule(ctx, client, assets, module, kind);
  try {
    await registerMachine(ctx, client, assets, { kind });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  }
  await flushEvents(ctx, client);
  ctx.io.out(t(ctx, "add.next", { slug }));
  return { ok: true, slug, version: result.module.version, changed: true, skills: result.module.skills, written: result.written };
}

async function runAddRecipe(ctx: Context, client: Client, assets: CoreAssets, slug: string, kind?: "own" | "client"): Promise<Result> {
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
  for (const module of installable) printReview(ctx, module);
  if (ctx.dryRun) return { ok: true, recipe: slug, modules: installable.map((module) => module.slug), dry_run: true };
  if (!ctx.yes && !(await ctx.io.confirm(t(ctx, "add.confirm")))) {
    ctx.io.out(t(ctx, "add.cancelled"));
    return { ok: false, error: "cancelled", message: t(ctx, "add.cancelled") };
  }
  const installed: string[] = [];
  for (const module of installable) {
    const current = readLock(ctx)?.modules[module.slug];
    if (current && !current.dev && compareSemver(current.version, module.latest!.version) >= 0) {
      installed.push(module.slug);
      continue;
    }
    await installModule(ctx, client, assets, module, kind);
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
  return { ok: true, recipe: slug, modules: installed, workflow: Boolean(recipe.workflow) };
}
