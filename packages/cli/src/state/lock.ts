import { join } from "node:path";

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
  /** Installed from a local directory by the operator (`dev link`); never came from the platform. */
  dev?: boolean;
  source_dir?: string;
  /** Planned (contract section 9): the platform-signed license path. */
  license?: string;
};

export type Lock = {
  lock_version: 1;
  core_version: string;
  locale: Locale;
  project_kind?: "own" | "client";
  managed_files: string[];
  modules: Record<string, LockModule>;
  recipes: Record<string, { modules: string[]; installed_at: string }>;
};

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
