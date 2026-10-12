import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { buildCatalog, type CatalogEntry } from "./catalog.ts";
import { modulesRoot, repoRoot } from "./paths.ts";
import { listProjects, type Project, type ProjectAppState, projectsRoot } from "./projects.ts";
import { compareSemver, isSemver } from "./semver.ts";
import { validateAll } from "./validate.ts";
import { readWorkspaceLock, workspaceDir, workspaceState, type WorkspaceState } from "./workspace.ts";

/**
 * `npm run apps -- list`: the catalog plus what changes from day to day and
 * therefore stays out of the generated files: validation, the git tags that
 * mark released versions, the workspace copy and the copies in the projects.
 */
export type AppStatus = CatalogEntry & {
  valid: boolean;
  errors: string[];
  warnings: string[];
  tags: string[];
  last_tag: string | null;
  /** The manifest version has no tag yet: it was never released. */
  unreleased: boolean;
  workspace: WorkspaceState;
  /** The projects that have this app, each with whether its copy still matches modules/. */
  projects: Record<string, ProjectAppState>;
};

function tagsFor(slug: string): string[] {
  const result = spawnSync("git", ["tag", "--list", `${slug}@*`], { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim().slice(slug.length + 1))
    .filter(isSemver)
    .sort(compareSemver);
}

export function appsStatus(root: string = modulesRoot): { workspace: string; projects_root: string; projects: Project[]; apps: AppStatus[] } {
  const catalog = buildCatalog(root);
  const reports = new Map(validateAll(catalog.map((entry) => join(root, entry.slug))).map((report) => [report.slug, report]));
  const workspace = workspaceDir();
  const lock = readWorkspaceLock(workspace);
  const projects = listProjects(process.env, root);
  const apps = catalog.map((entry) => {
    const report = reports.get(entry.slug);
    const tags = tagsFor(entry.slug);
    return {
      ...entry,
      valid: (report?.errors.length ?? 1) === 0,
      errors: report?.errors ?? [],
      warnings: report?.warnings ?? [],
      tags,
      last_tag: tags.length ? tags[tags.length - 1] : null,
      unreleased: !tags.includes(entry.version),
      workspace: workspaceState(lock, entry.slug, join(root, entry.slug)),
      projects: Object.fromEntries(
        projects.flatMap((project) => project.apps.filter((app) => app.slug === entry.slug).map((app) => [project.name, app.state] as const)),
      ),
    };
  });
  return { workspace, projects_root: projectsRoot(), projects, apps };
}
