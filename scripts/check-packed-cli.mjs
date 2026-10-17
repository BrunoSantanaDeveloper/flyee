#!/usr/bin/env node
// Runs the CLI the way a member gets it: packed by npm, installed, and started
// through what npm puts in front of it (`node_modules/.bin/flyee`, the path npx
// takes, and the global bin). The 1.0.0 passed every test and still did
// nothing on macOS and Linux, where that is a symbolic link; only running it
// through npm's link shows that. It also starts it with a proxy in HTTPS_PROXY
// (the relaunch must hand the output back and end) and with a value Node
// cannot use as a proxy (it must not crash). Run after `npm run build`.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliRoot = join(repoRoot, "packages", "cli");
const version = JSON.parse(readFileSync(join(cliRoot, "package.json"), "utf8")).version;
const windows = process.platform === "win32";

if (!existsSync(join(cliRoot, "dist", "flyee.js"))) {
  console.error("packages/cli/dist/flyee.js is missing: run npm run build first.");
  process.exit(1);
}

// Under `npm run`, npm_execpath points at npm's own entry script, so npm runs
// through the current Node without a shell (Windows needs a shell for npm.cmd).
function npm(args, cwd) {
  const options = { cwd, encoding: "utf8" };
  const result = process.env.npm_execpath
    ? spawnSync(process.execPath, [process.env.npm_execpath, ...args], options)
    : spawnSync(windows ? "npm.cmd" : "npm", args, { ...options, shell: windows });
  if (result.status !== 0) {
    console.error(`npm ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
    process.exit(1);
  }
  return result.stdout;
}

const work = mkdtempSync(join(tmpdir(), "flyee-packed-"));
const failures = [];
try {
  const packed = JSON.parse(npm(["pack", "--json", "--ignore-scripts", "--pack-destination", work], cliRoot).replace(/^[^[]*/, ""));
  const tarball = join(work, packed[0].filename);

  // The npx path: a project folder with the package installed, started through node_modules/.bin.
  const project = join(work, "project");
  mkdirSync(project);
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "packed-cli-check", private: true }));
  npm(["install", "--no-audit", "--no-fund", "--ignore-scripts", tarball], project);
  // The global path, under a prefix of its own so this machine's global folder is never touched.
  const prefix = join(work, "global");
  npm(["install", "-g", "--no-audit", "--no-fund", "--ignore-scripts", "--prefix", prefix, tarball], work);

  const bins = windows
    ? { ".bin": join(project, "node_modules", ".bin", "flyee.cmd"), global: join(prefix, "flyee.cmd") }
    : { ".bin": join(project, "node_modules", ".bin", "flyee"), global: join(prefix, "bin", "flyee") };

  const environment = { ...process.env };
  delete environment.NODE_USE_ENV_PROXY;
  for (const name of ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"]) delete environment[name];
  const cases = [
    { label: "no proxy", env: environment },
    { label: "a proxy in HTTPS_PROXY", env: { ...environment, HTTPS_PROXY: "http://127.0.0.1:9" } },
    { label: "a proxy value Node cannot use", env: { ...environment, HTTPS_PROXY: "127.0.0.1:7890" } },
  ];
  for (const [where, bin] of Object.entries(bins)) {
    if (!existsSync(bin)) {
      failures.push(`${where}: npm did not create ${bin}`);
      continue;
    }
    for (const { label, env } of cases) {
      // npm's Windows shim is a .cmd, which only a shell runs; the whole line goes as one string.
      const run = windows
        ? spawnSync(`"${bin}" --version`, { cwd: project, encoding: "utf8", env, shell: true, timeout: 60_000 })
        : spawnSync(bin, ["--version"], { cwd: project, encoding: "utf8", env, timeout: 60_000 });
      const printed = (run.stdout ?? "").trim();
      if (run.status !== 0 || printed !== version) {
        failures.push(`${where}, ${label}: exit ${run.status}, printed ${JSON.stringify(printed)} (expected ${version})${run.stderr ? `\n    ${run.stderr.trim()}` : ""}`);
      }
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`The packed CLI did not run through npm's links:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`Packed CLI ${version} runs through node_modules/.bin and the global bin, with and without a proxy.`);
