import { join, resolve } from "node:path";

import type { Context } from "../context.ts";
import { readJson, writeJsonAtomic } from "../util/fs.ts";
import { compareSemver } from "../semver.ts";
import { installedModules, type Lock } from "./lock.ts";

/**
 * `~/.flyee/projects.json`: the projects this machine has installed apps into.
 * The contract reports `installed_modules` per machine (CLI-CONTRACT.md 4.2),
 * so the CLI reports the union across known projects, highest version per app.
 */
export type KnownProject = { path: string; kind?: "own" | "client"; seen_at: string };

export function projectsPath(ctx: Context): string {
  return join(ctx.flyeeHome, "projects.json");
}

export function readProjects(ctx: Context): KnownProject[] {
  return readJson<KnownProject[]>(projectsPath(ctx)) ?? [];
}

export function rememberProject(ctx: Context, kind?: "own" | "client"): void {
  const path = resolve(ctx.cwd);
  const projects = readProjects(ctx).filter((project) => project.path !== path);
  projects.push({ path, kind, seen_at: new Date(ctx.now()).toISOString() });
  writeJsonAtomic(projectsPath(ctx), projects.slice(-200));
}

export function installedAcrossProjects(ctx: Context, current: Lock | null): { slug: string; version: string }[] {
  const best = new Map<string, string>();
  const consider = (lock: Lock | null) => {
    for (const { slug, version } of installedModules(lock)) {
      const known = best.get(slug);
      if (!known || compareSemver(version, known) > 0) best.set(slug, version);
    }
  };
  consider(current);
  for (const project of readProjects(ctx)) {
    if (project.path === resolve(ctx.cwd)) continue;
    const lock = readJson<Lock>(join(project.path, ".flyee", "lock.json"));
    if (lock?.lock_version === 1) consider(lock);
  }
  return [...best.entries()].map(([slug, version]) => ({ slug, version })).sort((a, b) => a.slug.localeCompare(b.slug));
}
