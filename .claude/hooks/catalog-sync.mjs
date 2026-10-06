#!/usr/bin/env node
// PostToolUse: after any change under modules/<slug>/, regenerate the
// operator's apps catalog (.claude/rules/catalogo.md and docs/CATALOGO.md),
// which also refreshes the Codex mirror. The AI working in this repository
// therefore always knows which apps exist, what they deliver and who calls
// whom. Never blocks a tool call; reports only a failure.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";

import { extractToolPaths, isCodexHook, normalizeToolPath } from "./lib/tool-paths.mjs";

function findRepoRoot(start) {
  let current = resolve(start);
  const root = parse(current).root;
  while (current !== root) {
    if (existsSync(join(current, "packages", "module-tools", "src", "cli.ts"))) return current;
    current = dirname(current);
  }
  return null;
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(raw || "{}");
    const root = findRepoRoot(input?.cwd ?? process.cwd());
    if (!root) process.exit(0);
    const rootNormalized = normalizeToolPath(root);

    const touchesApp = extractToolPaths(input).some((path) => {
      const absolute = normalizeToolPath(resolve(input?.cwd ?? root, path));
      const relative = absolute.startsWith(`${rootNormalized}/`) ? absolute.slice(rootNormalized.length + 1) : normalizeToolPath(path);
      return /^modules\/(?!_)[^/]+\//.test(relative);
    });
    if (!touchesApp) process.exit(0);

    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--no-warnings", join(root, "packages", "module-tools", "src", "cli.ts"), "catalog"],
      { cwd: root, encoding: "utf8" },
    );
    if (result.status === 0) process.exit(0);

    const message = `APPS CATALOG failed to refresh: ${result.stderr || result.stdout || `exit ${result.status}`}`.trim();
    process.stdout.write(
      JSON.stringify(
        isCodexHook(input)
          ? { systemMessage: message }
          : { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: message } },
      ),
    );
  } catch {
    process.exit(0);
  }
});
