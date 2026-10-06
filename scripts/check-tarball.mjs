#!/usr/bin/env node
// The boundary gate: what `npm pack` would publish for packages/cli must be
// only the bundle, the core assets, the README, the LICENSE and package.json.
// Anything else (docs, harness, modules, tests, sources) fails the build.

import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliRoot = join(repoRoot, "packages", "cli");

// Under `npm run`, npm_execpath points at npm's own entry script, so npm runs
// through the current Node without a shell (Windows needs a shell for npm.cmd).
const packArgs = ["pack", "--dry-run", "--json", "--ignore-scripts"];
const result = process.env.npm_execpath
  ? spawnSync(process.execPath, [process.env.npm_execpath, ...packArgs], { cwd: cliRoot, encoding: "utf8" })
  : spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", packArgs, { cwd: cliRoot, encoding: "utf8", shell: process.platform === "win32" });
if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(1);
}

const jsonStart = result.stdout.indexOf("[");
const report = JSON.parse(result.stdout.slice(jsonStart));
const files = report[0]?.files?.map((file) => file.path) ?? [];
const allowed = (path) =>
  path === "package.json" || path === "README.md" || path === "LICENSE" || path.startsWith("dist/");
const forbidden = files.filter((path) => !allowed(path));
const required = ["package.json", "README.md", "LICENSE", "dist/flyee.js", "dist/core/core.json", "dist/core/tools.json"];
const missing = required.filter((path) => !files.includes(path));

if (forbidden.length || missing.length) {
  if (forbidden.length) console.error(`Files that must not be published:\n  ${forbidden.join("\n  ")}`);
  if (missing.length) console.error(`Files missing from the package (run npm run build):\n  ${missing.join("\n  ")}`);
  process.exit(1);
}
console.log(`Tarball is clean: ${files.length} files, all under dist/ plus package.json, README.md and LICENSE.`);
