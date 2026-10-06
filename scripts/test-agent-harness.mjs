#!/usr/bin/env node
// Exercises the hooks the way Claude Code and Codex call them.

import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hooksRoot = join(repoRoot, ".claude", "hooks");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runHook(name, input) {
  const result = spawnSync(process.execPath, [join(hooksRoot, name)], {
    cwd: repoRoot,
    encoding: "utf8",
    input: JSON.stringify(input),
  });
  assert(result.status === 0, `${name} exited with ${result.status}: ${result.stderr}`);
  return result.stdout ? JSON.parse(result.stdout) : null;
}

const codexBase = { cwd: repoRoot, hook_event_name: "PreToolUse", model: "codex-harness-test" };

const appCodex = runHook("app-guard.mjs", {
  ...codexBase,
  tool_input: { command: "*** Begin Patch\n*** Update File: modules/radar/skills/radar/SKILL.md\n*** End Patch" },
});
assert(appCodex?.systemMessage?.includes("app-author"), "Codex app guard did not fire for an app file");

const appClaude = runHook("app-guard.mjs", {
  cwd: repoRoot,
  hook_event_name: "PreToolUse",
  tool_input: { file_path: join(repoRoot, "modules/radar/README.md") },
});
assert(appClaude?.hookSpecificOutput?.additionalContext?.includes("ships to members"), "Claude app guard failed");

const testClaude = runHook("app-guard.mjs", {
  cwd: repoRoot,
  hook_event_name: "PreToolUse",
  tool_input: { file_path: join(repoRoot, "modules/radar/tests/eval.json") },
});
assert(
  testClaude?.hookSpecificOutput?.additionalContext?.includes("operator-only") &&
    !testClaude.hookSpecificOutput.additionalContext.includes("APP (ships"),
  "App guard treated an eval file as shipped content",
);

const coreClaude = runHook("app-guard.mjs", {
  cwd: repoRoot,
  hook_event_name: "PreToolUse",
  tool_input: { file_path: join(repoRoot, "packages/core/assets/agents/pt-BR.md") },
});
assert(coreClaude?.hookSpecificOutput?.additionalContext?.includes("CORE ASSETS"), "Core guard did not fire");

const unrelated = runHook("app-guard.mjs", {
  ...codexBase,
  tool_input: { command: "*** Begin Patch\n*** Update File: packages/cli/src/main.ts\n*** End Patch" },
});
assert(unrelated === null, "App guard fired for CLI source");

const catalogGuard = runHook("app-guard.mjs", {
  cwd: repoRoot,
  hook_event_name: "PreToolUse",
  tool_input: { file_path: join(repoRoot, ".claude/rules/catalogo.md") },
});
assert(catalogGuard?.hookSpecificOutput?.additionalContext?.includes("GENERATED CATALOG"), "Editing the generated catalog was not flagged");

const catalogUnrelated = runHook("catalog-sync.mjs", {
  ...codexBase,
  hook_event_name: "PostToolUse",
  tool_input: { command: "*** Begin Patch\n*** Update File: packages/cli/src/main.ts\n*** End Patch" },
});
assert(catalogUnrelated === null, "Catalog sync fired for a file outside modules/");

const catalogTemplate = runHook("catalog-sync.mjs", {
  cwd: repoRoot,
  hook_event_name: "PostToolUse",
  tool_input: { file_path: join(repoRoot, "modules/_template/README.md") },
});
assert(catalogTemplate === null, "Catalog sync fired for the template");

const catalogApp = runHook("catalog-sync.mjs", {
  cwd: repoRoot,
  hook_event_name: "PostToolUse",
  tool_input: { file_path: join(repoRoot, "modules/video-analysis/README.md") },
});
assert(catalogApp === null, `Catalog refresh failed: ${JSON.stringify(catalogApp)}`);

const harnessSync = runHook("harness-sync.mjs", {
  ...codexBase,
  hook_event_name: "PostToolUse",
  tool_input: { command: "*** Begin Patch\n*** Update File: CLAUDE.md\n*** End Patch" },
});
assert(harnessSync === null, "Shared harness synchronization failed");

console.log("Claude/Codex harness tests passed.");
