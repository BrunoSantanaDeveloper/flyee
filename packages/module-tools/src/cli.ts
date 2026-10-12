#!/usr/bin/env node
// Operator tooling over modules/*. Runs straight from TypeScript (npm scripts
// `validate`, `pack`, `index` and `apps`). Flags go after `--`:
//
//   npm run validate [slug...]
//   npm run pack [slug...] [-- --out dir]
//   npm run index
//   npm run apps -- list [--json]
//   npm run apps -- new <slug> --type <skill|workflow|tool|framework> --trail <trail> [--title "…"] [--title-en "…"] [--summary "…"]
//   npm run apps -- bump <slug> <patch|minor|major|x.y.z>
//   npm run apps -- link <slug...> | --all [--project <name>]     (also links the apps they call)
//   npm run apps -- unlink <slug...> [--project <name>]
//   npm run apps -- project list | new <name> [slug...] | sync [name...]
//   npm run apps -- catalog [--check]
//   npm run apps -- workspace
//
// Every `apps` subcommand accepts --json and then prints one JSON object.

import { existsSync } from "node:fs";
import { join, relative } from "node:path";

import { writeCatalog } from "./catalog.ts";
import { writeIndex } from "./index-build.ts";
import { packModule } from "./pack.ts";
import { distRoot, listModuleDirs, modulesRoot, repoRoot } from "./paths.ts";
import { bumpApp, scaffoldApp } from "./scaffold.ts";
import { appsStatus } from "./status.ts";
import { createProject, listProjects, projectDir, projectsRoot, readProject, withUsedApps } from "./projects.ts";
import { referencedApps } from "./relations.ts";
import { type Report, validateAll } from "./validate.ts";
import { ensureCliBundle, ensureWorkspace, readWorkspaceLock, runCliInWorkspace, workspaceDir } from "./workspace.ts";

const argv = process.argv.slice(2);
const command = argv[0];
const VALUE_FLAGS = new Set(["out", "type", "trail", "title", "title-en", "summary", "project"]);
const flags: Record<string, string | boolean> = {};
const positionals: string[] = [];
for (let index = 1; index < argv.length; index += 1) {
  const arg = argv[index];
  if (arg.startsWith("--")) {
    const name = arg.slice(2);
    if (VALUE_FLAGS.has(name) && index + 1 < argv.length) {
      flags[name] = argv[index + 1];
      index += 1;
    } else flags[name] = true;
  } else positionals.push(arg);
}
const json = flags.json === true;
const rel = (path: string) => relative(repoRoot, path).replace(/\\/g, "/");
const value = (name: string) => (typeof flags[name] === "string" ? (flags[name] as string) : undefined);

function emit(result: Record<string, unknown>, lines: string[] = []): never {
  if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else for (const line of lines) console.log(line);
  process.exit(result.ok === false ? 1 : 0);
}

function fail(message: string, extra: Record<string, unknown> = {}): never {
  if (json) process.stdout.write(`${JSON.stringify({ ok: false, message, ...extra }, null, 2)}\n`);
  else console.error(message);
  process.exit(1);
}

function selectDirs(slugs: string[]): string[] {
  if (slugs.length === 0) return listModuleDirs();
  return slugs.map((slug) => {
    const dir = join(modulesRoot, slug);
    if (!existsSync(join(dir, "flyee.module.json"))) fail(`No app named "${slug}" under modules/.`);
    return dir;
  });
}

function printReport(report: Report): void {
  const label = rel(report.dir);
  if (report.errors.length === 0) {
    console.log(`OK   ${label}${report.manifest ? ` ${report.manifest.version}` : ""} (${report.files.length} files, ${report.skills.length} skills)`);
  } else {
    console.log(`FAIL ${label}`);
    for (const error of report.errors) console.log(`     error: ${error}`);
  }
  for (const warning of report.warnings) console.log(`     warning: ${warning}`);
}

function refreshCatalog(): string[] {
  return writeCatalog().written.map(rel);
}

const slugOf = (dir: string) => dir.split(/[\\/]/).pop()!;
const isApp = (slug: string) => existsSync(join(modulesRoot, slug, "flyee.module.json"));

/** Runs a step whose failure is the operator's to read, and exits with its message. */
function guard<T>(work: () => T): T {
  try {
    return work();
  } catch (error) {
    fail((error as Error).message);
  }
}

/** Where an app command acts: the project named by --project, or the workspace (the test bench). */
function targetFolder(create: boolean): { path: string; project: string | null } {
  const project = value("project");
  if (!project) {
    const workspace = workspaceDir();
    guard(() => ensureWorkspace(workspace));
    return { path: workspace, project: null };
  }
  if (create) return { path: guard(() => createProject(project)).path, project };
  const path = guard(() => projectDir(project));
  if (!existsSync(path)) fail(`No project named "${project}" in ${projectsRoot()}. Create it: npm run apps -- project new ${project} [slug...]`);
  return { path, project };
}

type LinkResult = { slug: string; ok: boolean; needed_by?: string[]; message?: unknown; error?: unknown };

/**
 * Links apps from modules/ into a folder through the built CLI. With
 * `withUsed`, the apps they call come first (relations.ts): an app is useless
 * in a folder that lacks the app it calls.
 */
function linkApps(folder: string, slugs: string[], options: { withUsed?: boolean } = {}): LinkResult[] {
  const missing = slugs.filter((slug) => !isApp(slug));
  if (missing.length) fail(`No app named ${missing.map((slug) => `"${slug}"`).join(", ")} under modules/.`);
  const uses = (slug: string) => (isApp(slug) ? referencedApps(join(modulesRoot, slug)).filter(isApp) : []);
  const ordered = options.withUsed === false ? slugs : withUsedApps(slugs, uses);
  guard(() => ensureCliBundle());
  return ordered.map((slug) => ({
    slug,
    ...(slugs.includes(slug) ? {} : { needed_by: ordered.filter((other) => uses(other).includes(slug)) }),
    ...runCliInWorkspace(folder, ["dev", "link", join(modulesRoot, slug)]),
  }));
}

const resultLine = (verb: string) => (result: LinkResult) =>
  `${result.ok ? "OK  " : "FAIL"} ${verb} ${result.slug}${result.needed_by ? ` (used by ${result.needed_by.join(", ")})` : ""}${result.ok ? "" : `: ${String(result.message ?? result.error)}`}`;

if (command === "validate") {
  const dirs = selectDirs(positionals);
  if (dirs.length === 0) {
    console.log("No apps under modules/ yet (modules/_template is skipped).");
    process.exit(0);
  }
  const reports = validateAll(dirs);
  reports.forEach(printReport);
  const failed = reports.filter((report) => report.errors.length).length;
  console.log(failed ? `${failed} of ${reports.length} apps failed.` : `${reports.length} apps valid.`);
  process.exit(failed ? 1 : 0);
} else if (command === "pack") {
  const dirs = selectDirs(positionals);
  if (dirs.length === 0) {
    console.log("No apps under modules/ yet (modules/_template is skipped).");
    process.exit(0);
  }
  const outDir = value("out") ?? join(distRoot, "modules");
  let failed = 0;
  for (const dir of dirs) {
    const result = packModule(dir, outDir);
    printReport(result.report);
    if (result.built && result.zipPath) {
      console.log(`     ${rel(result.zipPath)}  ${result.built.sizeBytes} bytes`);
      console.log(`     sha256 ${result.built.sha256}`);
    } else {
      failed += 1;
    }
  }
  refreshCatalog();
  process.exit(failed ? 1 : 0);
} else if (command === "index") {
  const dirs = listModuleDirs();
  const path = writeIndex(dirs, value("out") ?? distRoot);
  console.log(`${rel(path)} written with ${dirs.length} apps.`);
} else if (command === "list") {
  const status = appsStatus();
  const lines = [`Workspace: ${status.workspace}`, `Projects: ${status.projects_root} (${status.projects.map((project) => project.name).join(", ") || "none yet"})`, ""];
  if (status.apps.length === 0) lines.push("No app yet. Create one: npm run apps -- new <slug> --type <type> --trail <trail>");
  for (const app of status.apps) {
    const flagsLine = [
      app.valid ? "valid" : `${app.errors.length} error(s)`,
      app.warnings.length ? `${app.warnings.length} warning(s)` : "",
      app.last_tag ? `last tag ${app.last_tag}` : "never tagged",
      app.unreleased ? `${app.version} not tagged` : "",
      `workspace ${app.workspace}`,
      Object.keys(app.projects).length
        ? `projects ${Object.entries(app.projects).map(([project, state]) => (state === "current" ? project : `${project} (${state})`)).join(", ")}`
        : "",
    ].filter(Boolean);
    lines.push(`${app.slug} ${app.version} · ${app.type} · ${app.trail} — ${app.title}`);
    lines.push(`   ${flagsLine.join(" · ")}`);
    if (app.uses.length || app.used_by.length) lines.push(`   uses ${app.uses.join(", ") || "—"} · used by ${app.used_by.join(", ") || "—"}`);
    for (const error of app.errors) lines.push(`   error: ${error}`);
  }
  emit({ ok: true, ...status }, lines);
} else if (command === "new") {
  const slug = positionals[0];
  if (!slug) fail("Usage: npm run apps -- new <slug> --type <skill|workflow|tool|framework> --trail <trail> [--title \"…\"]");
  let result;
  try {
    result = scaffoldApp({
      slug,
      type: value("type") ?? "",
      trail: value("trail") ?? "",
      title: value("title"),
      titleEn: value("title-en"),
      summary: value("summary"),
    });
  } catch (error) {
    fail((error as Error).message);
  }
  const catalog = refreshCatalog();
  emit(
    { ok: true, slug, dir: rel(result.dir), files: result.files, placeholders: result.placeholders, catalog },
    [
      `Created ${rel(result.dir)} (${result.manifest.type} · ${result.manifest.trail}).`,
      `Still to write ([PREENCHER]): ${result.placeholders.join(", ") || "nothing"}`,
      "Next: write the README, the skill and tests/eval.json; then npm run validate " + slug,
    ],
  );
} else if (command === "bump") {
  const [slug, bump] = positionals;
  if (!slug || !bump) fail("Usage: npm run apps -- bump <slug> <patch|minor|major|x.y.z>");
  if (!existsSync(join(modulesRoot, slug, "flyee.module.json"))) fail(`No app named "${slug}" under modules/.`);
  let result;
  try {
    result = bumpApp(slug, bump);
  } catch (error) {
    fail((error as Error).message);
  }
  const catalog = refreshCatalog();
  emit(
    { ok: true, slug, ...result, changelog: "placeholder", catalog },
    [`${slug}: ${result.from} → ${result.to}. Write the changelog in modules/${slug}/flyee.module.json (it is [PREENCHER] now) and the README's "O que há de novo".`],
  );
} else if (command === "link" || command === "unlink") {
  const slugs = flags.all === true ? listModuleDirs().map(slugOf) : positionals;
  if (slugs.length === 0) fail(`Usage: npm run apps -- ${command} <slug...>${command === "link" ? " | --all" : ""} [--project <name>]`);
  const target = targetFolder(command === "link");
  const results = command === "link" ? linkApps(target.path, slugs) : slugs.map((slug) => ({ slug, ...runCliInWorkspace(target.path, ["remove", slug]) }));
  const failed = results.filter((result) => !result.ok);
  emit(
    { ok: failed.length === 0, target: target.path, project: target.project, ...(target.project ? {} : { workspace: target.path }), results },
    [
      `${target.project ? `Project ${target.project}` : "Workspace"}: ${target.path}`,
      ...results.map(resultLine(command)),
      command === "link" ? `Run an app's commands with ${target.project ? "the project" : "the workspace"} as the working directory, or open the AI there.` : "",
    ].filter(Boolean),
  );
} else if (command === "project") {
  const [sub = "list", ...rest] = positionals;
  if (sub === "list") {
    const projects = guard(() => listProjects());
    emit({ ok: true, root: projectsRoot(), projects }, [
      `Projects: ${projectsRoot()}`,
      ...(projects.length
        ? projects.flatMap((project) => [
            `${project.name}  ${project.path}`,
            `   ${project.apps.map((app) => `${app.slug} ${app.version}${app.state === "current" ? "" : ` (${app.state})`}`).join(", ") || "no apps"}`,
          ])
        : ["No project yet. Create one: npm run apps -- project new <name> [slug...]"]),
    ]);
  } else if (sub === "new") {
    const [name, ...named] = rest;
    if (!name) fail("Usage: npm run apps -- project new <name> [slug...]");
    const created = guard(() => createProject(name));
    // Without names, every app that validates: a half-built app stays out of a project where real work is made.
    const reports = named.length ? [] : validateAll(listModuleDirs());
    const slugs = named.length ? named : reports.filter((report) => report.errors.length === 0).map((report) => report.slug);
    const skipped = reports.filter((report) => report.errors.length > 0).map((report) => report.slug);
    const results = linkApps(created.path, slugs);
    const failed = results.filter((result) => !result.ok);
    emit({ ok: failed.length === 0, project: name, path: created.path, created: created.created, skipped_invalid: skipped, results }, [
      `Project ${name}: ${created.path}${created.created ? " (new)" : ""}`,
      ...results.map(resultLine("link")),
      ...skipped.map((slug) => `SKIP ${slug}: does not validate yet`),
      `Open ${created.path} in the AI to work for ${name}: each project keeps its own apps, voice, brand and deliveries.`,
    ]);
  } else if (sub === "sync") {
    const names = rest.length ? rest : guard(() => listProjects()).map((project) => project.name);
    const synced = names.map((name) => {
      const project = guard(() => readProject(name));
      if (!project) fail(`No project named "${name}" in ${projectsRoot()}.`);
      // Only stale copies are relinked; an orphan (its app left modules/) keeps working until the operator removes it.
      const stale = project.apps.filter((app) => app.state === "stale").map((app) => app.slug);
      const results = stale.length ? linkApps(project.path, stale, { withUsed: false }) : [];
      return { name, path: project.path, results, orphans: project.apps.filter((app) => app.state === "orphan").map((app) => app.slug) };
    });
    const failed = synced.flatMap((project) => project.results).filter((result) => !result.ok);
    emit({ ok: failed.length === 0, projects: synced }, [
      ...synced.flatMap((project) => [
        `${project.name}: ${project.results.length ? `${project.results.length} stale cop${project.results.length === 1 ? "y" : "ies"} relinked` : "up to date"}`,
        ...project.results.map(resultLine("link")),
        ...project.orphans.map((slug) => `   ${slug}: no longer in modules/; remove it with npm run apps -- unlink ${slug} --project ${project.name}`),
      ]),
      synced.length ? "" : "No project yet.",
    ].filter(Boolean));
  } else fail("Usage: npm run apps -- project list | new <name> [slug...] | sync [name...]");
} else if (command === "catalog") {
  const result = writeCatalog({ check: flags.check === true });
  if (flags.check === true && result.stale.length) {
    fail(`The apps catalog is out of date: ${result.stale.map(rel).join(", ")}. Run \`npm run apps -- catalog\`.`, { stale: result.stale.map(rel) });
  }
  emit(
    { ok: true, stale: result.stale.map(rel), written: result.written.map(rel) },
    [flags.check === true ? "The apps catalog is up to date." : result.written.length ? `Catalog written: ${result.written.map(rel).join(", ")}` : "The apps catalog is up to date."],
  );
} else if (command === "workspace") {
  const workspace = workspaceDir();
  const lock = readWorkspaceLock(workspace);
  const apps = Object.entries(lock?.modules ?? {}).map(([slug, module]) => ({ slug, version: module.version, dev: Boolean(module.dev) }));
  emit({ ok: true, workspace, exists: existsSync(workspace), apps }, [`Workspace: ${workspace}`, ...apps.map((app) => `  ${app.slug} ${app.version}${app.dev ? " (dev)" : ""}`)]);
} else {
  console.error("Usage: cli.ts <validate|pack|index|list|new|bump|link|unlink|project|catalog|workspace> …");
  process.exit(2);
}
