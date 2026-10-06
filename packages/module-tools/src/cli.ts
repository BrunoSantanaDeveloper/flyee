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
//   npm run apps -- link <slug...> | --all
//   npm run apps -- unlink <slug...>
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
import { type Report, validateAll } from "./validate.ts";
import { ensureCliBundle, ensureWorkspace, readWorkspaceLock, runCliInWorkspace, workspaceDir } from "./workspace.ts";

const argv = process.argv.slice(2);
const command = argv[0];
const VALUE_FLAGS = new Set(["out", "type", "trail", "title", "title-en", "summary"]);
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
  const lines = [`Workspace: ${status.workspace}`, ""];
  if (status.apps.length === 0) lines.push("No app yet. Create one: npm run apps -- new <slug> --type <type> --trail <trail>");
  for (const app of status.apps) {
    const flagsLine = [
      app.valid ? "valid" : `${app.errors.length} error(s)`,
      app.warnings.length ? `${app.warnings.length} warning(s)` : "",
      app.last_tag ? `last tag ${app.last_tag}` : "never tagged",
      app.unreleased ? `${app.version} not tagged` : "",
      `workspace ${app.workspace}`,
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
  const slugs = flags.all === true ? listModuleDirs().map((dir) => dir.split(/[\\/]/).pop()!) : positionals;
  if (slugs.length === 0) fail(`Usage: npm run apps -- ${command} <slug...>${command === "link" ? " | --all" : ""}`);
  const workspace = workspaceDir();
  try {
    ensureWorkspace(workspace);
    ensureCliBundle();
  } catch (error) {
    fail((error as Error).message);
  }
  const results = slugs.map((slug): { slug: string; ok: boolean; message?: unknown; error?: unknown } => {
    if (command === "link") {
      const dir = join(modulesRoot, slug);
      if (!existsSync(join(dir, "flyee.module.json"))) return { slug, ok: false, message: `No app named "${slug}" under modules/.` };
      return { slug, ...runCliInWorkspace(workspace, ["dev", "link", dir]) };
    }
    return { slug, ...runCliInWorkspace(workspace, ["remove", slug]) };
  });
  const failed = results.filter((result) => !result.ok);
  emit(
    { ok: failed.length === 0, workspace, results },
    [
      `Workspace: ${workspace}`,
      ...results.map((result) => `${result.ok ? "OK  " : "FAIL"} ${command} ${result.slug}${result.ok ? "" : `: ${String(result.message ?? result.error)}`}`),
      command === "link" ? "Run an app's commands with the workspace as the working directory, or open the AI in the workspace." : "",
    ].filter(Boolean),
  );
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
  console.error("Usage: cli.ts <validate|pack|index|list|new|bump|link|unlink|catalog|workspace> …");
  process.exit(2);
}
