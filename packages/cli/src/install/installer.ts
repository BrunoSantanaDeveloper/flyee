import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { basename, join } from "node:path";

import { CliError } from "../api/errors.ts";
import type { Context } from "../context.ts";
import type { CoreAssets } from "../core-assets.ts";
import { localeOf } from "../i18n.ts";
import { programsDeclared } from "../programs.ts";
import { type CatalogSnapshot, type Lock, type LockModule, moduleDir, modulesDir, newLock, readLock, writeLock } from "../state/lock.ts";
import { copyDir, ensureDir, removeDir, sha256Hex, walkFiles, writeFileAtomic } from "../util/fs.ts";
import { applyAdapters, removeBridges, type SkillInfo, writeSkillBridges } from "./adapters.ts";
import { parseFrontmatter } from "./frontmatter.ts";
import { type InspectedPackage, inspectPackage, isSafePackagePath, type Manifest, MANIFEST_FILE } from "./zip.ts";

function text(localized: Record<string, string | undefined> | undefined, locale: string): string {
  if (!localized) return "";
  return (localized[locale] ?? localized["pt-BR"] ?? Object.values(localized)[0] ?? "").trim();
}

/** The skills a package carries: skills/<name>/SKILL.md with a frontmatter. */
export function skillsOf(files: string[], read: (file: string) => string): SkillInfo[] {
  const skills: SkillInfo[] = [];
  for (const file of files) {
    const match = /^skills\/([^/]+)\/SKILL\.md$/.exec(file);
    if (!match) continue;
    const parsed = parseFrontmatter(read(file));
    if (!parsed) continue;
    const name = parsed.data.name?.trim() || match[1];
    const description = parsed.data.description?.trim() || "";
    const extra: Record<string, string> = {};
    for (const key of parsed.keys) if (!["name", "description"].includes(key)) extra[key] = parsed.data[key];
    skills.push({ name, description, extra });
  }
  return skills;
}

function lockEntry(ctx: Context, manifest: Manifest, files: { path: string; sha256: string }[], skills: SkillInfo[], sha256: string, bridges: string[]): LockModule {
  const locale = localeOf(ctx.locale);
  return {
    version: manifest.version,
    type: manifest.type,
    trail: manifest.trail,
    title: text(manifest.title, locale),
    summary: text(manifest.summary, locale),
    sha256,
    installed_at: new Date(ctx.now()).toISOString(),
    skills: skills.map((skill) => skill.name),
    files,
    bridges,
    external_credentials: (manifest.external_credentials ?? []).map((credential) => ({
      name: credential.name,
      env: credential.env,
      url: credential.url,
      required: Boolean(credential.required),
    })),
  };
}

/** Writes the entries into a temporary folder and swaps it into place, so a failure never leaves a half-installed app. */
function placeFiles(ctx: Context, slug: string, writeInto: (dir: string) => void): void {
  ensureDir(modulesDir(ctx));
  const temp = join(modulesDir(ctx), `.tmp-${slug}-${randomBytes(4).toString("hex")}`);
  removeDir(temp);
  try {
    writeInto(temp);
    const target = moduleDir(ctx, slug);
    removeDir(target);
    try {
      renameSync(temp, target);
    } catch {
      // a rename can fail (another volume, a file held open by an antivirus): copy instead, file by file
      copyDir(temp, target);
      removeDir(temp);
    }
  } catch (error) {
    removeDir(temp);
    throw error;
  }
}

export type InstallResult = { slug: string; module: LockModule; lock: Lock; written: string[] };

/** Installs a verified package: files, bridges, lock, adapters. */
export function installInspected(ctx: Context, assets: CoreAssets, inspected: InspectedPackage, packageSha: string, license?: string): InstallResult {
  const { manifest, files, entries } = inspected;
  const slug = manifest.name;
  const previous = readLock(ctx)?.modules[slug];
  if (previous) removeBridges(ctx, previous.bridges);

  const fileShas: { path: string; sha256: string }[] = [];
  placeFiles(ctx, slug, (dir) => {
    writeFileAtomic(join(dir, MANIFEST_FILE), entries[MANIFEST_FILE]);
    for (const file of files) {
      writeFileAtomic(join(dir, ...file.split("/")), entries[file]);
      fileShas.push({ path: file, sha256: sha256Hex(entries[file]) });
    }
  });

  const skills = skillsOf(files, (file) => new TextDecoder("utf-8").decode(entries[file]));
  const bridges = writeSkillBridges(ctx, assets, slug, skills);
  const lock = readLock(ctx) ?? newLock(ctx, assets.core.version);
  lock.locale = ctx.locale;
  const module = lockEntry(ctx, manifest, fileShas, skills, packageSha, bridges);
  module.programs = programsDeclared(assets.programs, manifest.permissions);
  if (license) {
    const licensePath = join(ctx.cwd, ".flyee", "licenses", `${slug}.jwt`);
    writeFileAtomic(licensePath, license);
    module.license = `.flyee/licenses/${slug}.jwt`;
  }
  lock.modules[slug] = module;
  const adapters = applyAdapters(ctx, assets, lock);
  lock.core_version = assets.core.version;
  writeLock(ctx, lock);
  return { slug, module, lock, written: [...bridges, ...adapters.written] };
}

export function installBytes(
  ctx: Context,
  assets: CoreAssets,
  bytes: Uint8Array,
  expected: { sha256: string; size_bytes: number; slug: string; version?: string },
  license?: string,
): InstallResult {
  const inspected = inspectPackage(bytes, expected);
  return installInspected(ctx, assets, inspected, expected.sha256.toLowerCase(), license);
}

/** Keeps what the catalog offers in this project's lock and AGENTS.md block, after a command that read it. */
export function keepCatalog(ctx: Context, assets: CoreAssets, snapshot: CatalogSnapshot): void {
  const lock = readLock(ctx);
  if (!lock) return;
  lock.catalog = snapshot;
  applyAdapters(ctx, assets, lock);
  writeLock(ctx, lock);
}

export function removeModule(ctx: Context, assets: CoreAssets, slug: string): { removed: boolean; lock: Lock | null } {
  const lock = readLock(ctx);
  const module = lock?.modules[slug];
  if (!lock || !module) return { removed: false, lock };
  removeBridges(ctx, module.bridges);
  removeDir(moduleDir(ctx, slug));
  if (module.license) removeDir(join(ctx.cwd, module.license));
  delete lock.modules[slug];
  for (const [recipe, entry] of Object.entries(lock.recipes)) {
    entry.modules = entry.modules.filter((candidate) => candidate !== slug);
    if (entry.modules.length === 0) delete lock.recipes[recipe];
  }
  applyAdapters(ctx, assets, lock);
  writeLock(ctx, lock);
  return { removed: true, lock };
}

const DEV_EXCLUDED_DIRS = new Set(["tests", ".dev", "node_modules", "__pycache__", ".git", ".cache", "dist"]);

/**
 * The operator's path: installs an app straight from a directory of the
 * product repository, with the same layout a package would have, so a new app
 * can be tried in a scratch project before it exists on the platform.
 */
export function installFromDirectory(ctx: Context, assets: CoreAssets, dir: string): InstallResult {
  const manifestPath = join(dir, MANIFEST_FILE);
  if (!existsSync(manifestPath)) throw new CliError("dev_manifest", `${MANIFEST_FILE} not found in ${dir}`);
  let manifest: Manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8").replace(/^﻿/, "")) as Manifest;
  } catch {
    throw new CliError("dev_manifest", `${MANIFEST_FILE} is not valid JSON`);
  }
  if (manifest.name !== basename(dir)) throw new CliError("dev_manifest", `name "${manifest.name}" differs from the folder "${basename(dir)}"`);
  const files = walkFiles(dir).filter((file) => {
    const segments = file.split("/");
    if (segments.slice(0, -1).some((segment) => DEV_EXCLUDED_DIRS.has(segment))) return false;
    const name = segments[segments.length - 1];
    return name !== MANIFEST_FILE && !name.endsWith(".dev.md") && name !== ".DS_Store" && name !== "Thumbs.db";
  });
  for (const file of files) if (!isSafePackagePath(file)) throw new CliError("dev_manifest", `unsafe path ${file}`);
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) entries[file] = new Uint8Array(readFileSync(join(dir, ...file.split("/"))));
  const complete: Manifest = { ...manifest, files };
  entries[MANIFEST_FILE] = new TextEncoder().encode(`${JSON.stringify(complete, null, 2)}\n`);
  const result = installInspected(ctx, assets, { manifest: complete, files, entries }, "dev");
  const lock = readLock(ctx)!;
  lock.modules[result.slug] = { ...lock.modules[result.slug], dev: true, source_dir: dir };
  writeLock(ctx, lock);
  return { ...result, module: lock.modules[result.slug], lock };
}
