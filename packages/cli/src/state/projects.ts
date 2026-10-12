import { basename, join, resolve } from "node:path";

import type { Context } from "../context.ts";
import { readJson, writeJsonAtomic } from "../util/fs.ts";
import { compareSemver } from "../semver.ts";
import { installedModules, type Lock } from "./lock.ts";

/**
 * `~/.flyee/projects.json`: the projects this machine has installed apps into.
 * The contract reports `installed_modules` per machine (CLI-CONTRACT.md 4.2),
 * so the CLI reports the union across known projects, highest version per app.
 *
 * A project is a folder: its apps, the voice and the brand an app learns and
 * everything the apps deliver live under it, so one brand or client per
 * folder keeps work apart (`flyee new`, `flyee projects`). The list never
 * leaves the machine: paths and project names are not telemetry.
 */
export type KnownProject = { path: string; kind?: "own" | "client"; seen_at: string };

export function projectsPath(ctx: Context): string {
  return join(ctx.flyeeHome, "projects.json");
}

/** The same folder, however it was spelled: Windows hands out `c:\` and `C:\` for one drive. */
export function samePath(a: string, b: string): boolean {
  const [left, right] = [resolve(a), resolve(b)];
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}

export function readProjects(ctx: Context): KnownProject[] {
  return readJson<KnownProject[]>(projectsPath(ctx)) ?? [];
}

export function rememberProject(ctx: Context, kind?: "own" | "client"): void {
  const path = resolve(ctx.cwd);
  const projects = readProjects(ctx).filter((project) => !samePath(project.path, path));
  projects.push({ path, kind, seen_at: new Date(ctx.now()).toISOString() });
  writeJsonAtomic(projectsPath(ctx), projects.slice(-200));
}

function lockOf(path: string): Lock | null {
  const lock = readJson<Lock>(join(path, ".flyee", "lock.json"));
  return lock?.lock_version === 1 ? lock : null;
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
    if (samePath(project.path, ctx.cwd)) continue;
    consider(lockOf(project.path));
  }
  return [...best.entries()].map(([slug, version]) => ({ slug, version })).sort((a, b) => a.slug.localeCompare(b.slug));
}

export type ProjectView = {
  name: string;
  path: string;
  current: boolean;
  kind: "own" | "client" | null;
  apps: { slug: string; version: string; dev: boolean }[];
};

/**
 * The known projects that still exist, plus the current folder when it is one
 * (a project installed into before it was ever reported is still a project).
 */
export function projectViews(ctx: Context): ProjectView[] {
  const paths: string[] = [];
  const kinds = new Map<string, "own" | "client" | undefined>();
  for (const project of [...readProjects(ctx), { path: resolve(ctx.cwd), kind: undefined }]) {
    if (paths.some((known) => samePath(known, project.path))) continue;
    paths.push(project.path);
    kinds.set(project.path, project.kind);
  }
  const views: ProjectView[] = [];
  for (const path of paths) {
    const lock = lockOf(path);
    if (!lock) continue;
    views.push({
      name: basename(path),
      path,
      current: samePath(path, ctx.cwd),
      kind: lock.project_kind ?? kinds.get(path) ?? null,
      apps: Object.entries(lock.modules)
        .map(([slug, module]) => ({ slug, version: module.version, dev: Boolean(module.dev) }))
        .sort((a, b) => a.slug.localeCompare(b.slug)),
    });
  }
  return views.sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path));
}
