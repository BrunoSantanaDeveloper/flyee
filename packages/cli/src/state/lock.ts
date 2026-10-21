import { join } from "node:path";

import type { Catalog } from "../api/types.ts";
import type { Context, Locale } from "../context.ts";
import { readJson, writeJsonAtomic } from "../util/fs.ts";

/**
 * `./.flyee/lock.json`: what is installed in this project, enough to update,
 * remove and verify without asking the platform. Never edited by hand.
 */
export type LockFile = { path: string; sha256: string };

export type LockModule = {
  version: string;
  type: string;
  trail: string;
  title: string;
  summary: string;
  sha256: string;
  installed_at: string;
  skills: string[];
  files: LockFile[];
  bridges: string[];
  external_credentials: { name: string; env: string; url?: string; required: boolean }[];
  /** Programs the app declares in its `shell` permissions and the CLI installs (`programs.json`). */
  programs?: string[];
  /** Installed from a local directory by the operator (`dev link`); never came from the platform. */
  dev?: boolean;
  source_dir?: string;
  /** Planned (contract section 9): the platform-signed license path. */
  license?: string;
};

/** One app of the catalog as the AGENTS.md block lists it: enough for the AI to match a request to it. */
export type CatalogApp = { slug: string; name: string; summary: string; entitled: boolean };

/** The catalog as the platform last served it to this project (CLI-CONTRACT.md 4.3). */
export type CatalogSnapshot = { fetched_at: string; channel: string; apps: CatalogApp[] };

export type Lock = {
  lock_version: 1;
  core_version: string;
  locale: Locale;
  project_kind?: "own" | "client";
  /** The project sits in a folder of projects, as `new` made it: the next brand goes beside it, never inside. */
  in_projects_folder?: boolean;
  managed_files: string[];
  modules: Record<string, LockModule>;
  recipes: Record<string, { modules: string[]; installed_at: string }>;
  /** What the catalog offers, kept by login, add, update and new for the AGENTS.md block; absent before the first. */
  catalog?: CatalogSnapshot;
};

/** The apps of a catalog response, in a stable order: an app with no version for anyone has nothing to install. */
export function catalogSnapshot(catalog: Catalog, now: number): CatalogSnapshot {
  return {
    fetched_at: new Date(now).toISOString(),
    channel: catalog.channel,
    apps: catalog.modules
      .filter((module) => module.latest)
      .map((module) => ({ slug: module.slug, name: module.name, summary: (module.summary ?? "").replace(/\s+/g, " ").trim(), entitled: module.entitled }))
      .sort((a, b) => a.slug.localeCompare(b.slug)),
  };
}

export function flyeeDir(ctx: Context): string {
  return join(ctx.cwd, ".flyee");
}

export function lockPath(ctx: Context): string {
  return join(flyeeDir(ctx), "lock.json");
}

export function modulesDir(ctx: Context): string {
  return join(flyeeDir(ctx), "modules");
}

export function moduleDir(ctx: Context, slug: string): string {
  return join(modulesDir(ctx), slug);
}

export function readLock(ctx: Context): Lock | null {
  const lock = readJson<Lock>(lockPath(ctx));
  return lock?.lock_version === 1 ? lock : null;
}

export function newLock(ctx: Context, coreVersion: string): Lock {
  return {
    lock_version: 1,
    core_version: coreVersion,
    locale: ctx.locale,
    managed_files: [],
    modules: {},
    recipes: {},
  };
}

export function writeLock(ctx: Context, lock: Lock): void {
  writeJsonAtomic(lockPath(ctx), lock);
}

export function installedModules(lock: Lock | null): { slug: string; version: string }[] {
  if (!lock) return [];
  return Object.entries(lock.modules)
    .filter(([, module]) => !module.dev)
    .map(([slug, module]) => ({ slug, version: module.version }));
}
