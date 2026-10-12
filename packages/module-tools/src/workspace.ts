import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { shippableFiles } from "./files.ts";
import { repoRoot } from "./paths.ts";

/**
 * The operator's workspace: a folder OUTSIDE this repository where apps from
 * modules/ are installed exactly as a member would have them, through the
 * CLI's `dev link`. It is where apps are tried and used while other apps are
 * built. Installing into this repository would write the member's harness
 * over the operator's one, so the workspace can never live inside it.
 */

export const CLI_BUNDLE = join(repoRoot, "packages", "cli", "dist", "flyee.js");

export function workspaceDir(env: Record<string, string | undefined> = process.env): string {
  return resolve(env.FLYEE_WORKSPACE?.trim() || join(repoRoot, "..", "flyee-workspace"));
}

export function isInsideRepo(path: string): boolean {
  const rel = relative(repoRoot, resolve(path));
  return rel === "" || (!rel.startsWith("..") && !/^[a-zA-Z]:/.test(rel));
}

function newestMtime(dir: string): number {
  let newest = 0;
  const walk = (path: string) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) walk(full);
      else newest = Math.max(newest, statSync(full).mtimeMs);
    }
  };
  if (existsSync(dir)) walk(dir);
  return newest;
}

/** Rebuilds the CLI bundle when its sources or the core assets are newer than it. */
export function ensureCliBundle(): { built: boolean } {
  const sources = Math.max(newestMtime(join(repoRoot, "packages", "cli", "src")), newestMtime(join(repoRoot, "packages", "core", "assets")));
  if (existsSync(CLI_BUNDLE) && statSync(CLI_BUNDLE).mtimeMs >= sources) return { built: false };
  const args = ["run", "build", "-w", "flyee"];
  const result = process.env.npm_execpath
    ? spawnSync(process.execPath, [process.env.npm_execpath, ...args], { cwd: repoRoot, encoding: "utf8" })
    : spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, { cwd: repoRoot, encoding: "utf8", shell: process.platform === "win32" });
  if (result.status !== 0) throw new Error(`could not build the CLI:\n${result.stderr || result.stdout}`);
  return { built: true };
}

type CliResult = { ok: boolean; [key: string]: unknown };

/** Runs the CLI bundle in the workspace, or in a project folder, with the operator's development mode on. */
export function runCliInWorkspace(workspace: string, args: string[]): CliResult {
  const result = spawnSync(process.execPath, [CLI_BUNDLE, ...args, "--json", "--yes"], {
    cwd: workspace,
    encoding: "utf8",
    env: { ...process.env, FLYEE_DEV: "1" },
  });
  try {
    return JSON.parse(result.stdout) as CliResult;
  } catch {
    return { ok: false, error: "cli_failed", message: (result.stderr || result.stdout || `exit ${result.status}`).trim() };
  }
}

export function ensureWorkspace(workspace: string): void {
  if (isInsideRepo(workspace)) {
    throw new Error(`the workspace ${workspace} is inside the product repository; set FLYEE_WORKSPACE to a folder outside it`);
  }
  mkdirSync(workspace, { recursive: true });
}

type WorkspaceLock = {
  modules?: Record<string, { version: string; dev?: boolean; files?: { path: string; sha256: string }[] }>;
};

export function readWorkspaceLock(workspace: string): WorkspaceLock | null {
  try {
    return JSON.parse(readFileSync(join(workspace, ".flyee", "lock.json"), "utf8")) as WorkspaceLock;
  } catch {
    return null;
  }
}

export type WorkspaceState = "absent" | "current" | "stale";

/** Whether the workspace copy of an app still matches its source in modules/. */
export function workspaceState(lock: WorkspaceLock | null, slug: string, dir: string): WorkspaceState {
  const installed = lock?.modules?.[slug];
  if (!installed) return "absent";
  const source = shippableFiles(dir);
  const recorded = new Map((installed.files ?? []).map((file) => [file.path, file.sha256]));
  if (recorded.size !== source.length) return "stale";
  for (const file of source) {
    const sha = createHash("sha256").update(readFileSync(join(dir, ...file.split("/")))).digest("hex");
    if (recorded.get(file) !== sha) return "stale";
  }
  return "current";
}
