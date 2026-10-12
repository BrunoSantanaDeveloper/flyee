import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { modulesRoot, repoRoot } from "./paths.ts";
import { isInsideRepo, readWorkspaceLock, workspaceState, type WorkspaceState } from "./workspace.ts";

/**
 * The operator's projects: one folder per brand or client, where apps from
 * modules/ are installed as a member would have them and real work is
 * produced. A project is a folder, here as in the product: each keeps its own
 * apps, the voice and the brand an app learns, and what the apps deliver, so
 * a video for one brand never lands beside another's.
 *
 * They live OUTSIDE this repository and outside the code repositories of the
 * brands: those have a generated AGENTS.md of their own, which the member's
 * harness would fight with. The workspace (workspace.ts) stays the test bench.
 */

export function projectsRoot(env: Record<string, string | undefined> = process.env): string {
  return resolve(env.FLYEE_PROJECTS?.trim() || join(repoRoot, "..", "conteudo"));
}

const PROJECT_NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;

export function isProjectName(name: string): boolean {
  return PROJECT_NAME.test(name);
}

/** The folder of a project, by name. Throws on a name that is not lowercase kebab-case or a root inside this repository. */
export function projectDir(name: string, env: Record<string, string | undefined> = process.env): string {
  if (!isProjectName(name)) throw new Error(`"${name}" is not a project name: lowercase letters, digits and hyphens, up to 40 characters (medchina, flyee-club)`);
  const root = projectsRoot(env);
  if (isInsideRepo(root)) throw new Error(`the projects folder ${root} is inside the product repository; set FLYEE_PROJECTS to a folder outside it`);
  return join(root, name);
}

/** `orphan`: installed in the project, gone from modules/. */
export type ProjectAppState = Exclude<WorkspaceState, "absent"> | "orphan";
export type ProjectApp = { slug: string; version: string; state: ProjectAppState };
export type Project = { name: string; path: string; apps: ProjectApp[] };

export function readProject(name: string, env: Record<string, string | undefined> = process.env, root: string = modulesRoot): Project | null {
  const path = projectDir(name, env);
  if (!existsSync(path)) return null;
  const lock = readWorkspaceLock(path);
  const apps = Object.entries(lock?.modules ?? {})
    .map(([slug, module]): ProjectApp => {
      const source = join(root, slug);
      const state = existsSync(join(source, "flyee.module.json")) ? workspaceState(lock, slug, source) : "orphan";
      return { slug, version: module.version, state: state === "absent" ? "orphan" : state };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
  return { name, path, apps };
}

/** Every project folder, with the apps installed there and whether each copy still matches modules/. */
export function listProjects(env: Record<string, string | undefined> = process.env, root: string = modulesRoot): Project[] {
  const folder = projectsRoot(env);
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isProjectName(entry.name))
    .map((entry) => readProject(entry.name, env, root)!)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function createProject(name: string, env: Record<string, string | undefined> = process.env): { path: string; created: boolean } {
  const path = projectDir(name, env);
  const created = !existsSync(path);
  mkdirSync(path, { recursive: true });
  return { path, created };
}

/**
 * The apps to install so the named ones work: each of them and, before it,
 * the apps it calls (relations.ts), all the way down. An app that calls
 * another is useless in a project that lacks the other.
 */
export function withUsedApps(slugs: string[], uses: (slug: string) => string[]): string[] {
  const ordered: string[] = [];
  const visit = (slug: string, trail: string[]) => {
    if (ordered.includes(slug) || trail.includes(slug)) return;
    for (const used of uses(slug)) visit(used, [...trail, slug]);
    ordered.push(slug);
  };
  for (const slug of slugs) visit(slug, []);
  return ordered;
}
