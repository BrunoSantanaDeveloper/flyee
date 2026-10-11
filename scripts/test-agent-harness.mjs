#!/usr/bin/env node
// Exercises the hooks the way Claude Code and Codex call them.

import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
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

// The irreversible-command guard: denies publishing and history rewrites, never a quoted mention.
const guard = (command, codex = false) => {
  const result = spawnSync(process.execPath, [join(hooksRoot, "release-guard.mjs")], {
    cwd: repoRoot,
    encoding: "utf8",
    input: JSON.stringify({ cwd: repoRoot, hook_event_name: "PreToolUse", tool_input: { command }, ...(codex ? { model: "codex-harness-test" } : {}) }),
  });
  return { status: result.status, out: result.stdout, err: result.stderr };
};
assert(guard("npm publish -w flyee --access public").out.includes('"deny"'), "release guard let npm publish through");
assert(guard("git push origin main --force").out.includes('"deny"'), "release guard let a force push through");
assert(guard("git commit --no-verify -m x").out.includes('"deny"'), "release guard let --no-verify through");
assert(guard('git commit -m "a CI faz o npm publish"').out === "", "release guard denied a quoted mention");
assert(guard("git push origin cli-v1.0.0").out === "", "release guard denied pushing one release tag");
assert(guard("npm run check:tarball").out === "", "release guard denied a harmless command");
assert(guard("git commit -F - <<'EOF'\nnega o npm publish e o --no-verify\nEOF\ngit log -1").out === "", "release guard denied a heredoc commit message");
assert(guard("git commit -F - @'\nnega o npm publish\n'@").out === "", "release guard denied a PowerShell here-string message");
assert(guard("git commit -F - <<'EOF'\nmensagem\nEOF\nnpm publish").out.includes('"deny"'), "release guard missed a command after a heredoc");
assert(guard('bash -c "npm publish"').out.includes('"deny"'), "release guard let a command inside bash -c through");
assert(guard('Start-Process cmd.exe -ArgumentList "/c","npm publish"').out.includes('"deny"'), "release guard let a command inside cmd /c through");
assert(guard("node - <<'EOF'\nrequire('child_process').execSync('npm publish')\nEOF").out.includes('"deny"'), "release guard let a script fed to node through");
const codexDenied = guard("npm publish", true);
assert(codexDenied.status === 2 && codexDenied.err.includes("npm"), "release guard did not block for Codex");
const withBom = spawnSync(process.execPath, [join(hooksRoot, "release-guard.mjs")], {
  cwd: repoRoot,
  encoding: "utf8",
  input: `﻿${JSON.stringify({ cwd: repoRoot, tool_input: { command: "npm publish" } })}`,
});
assert(withBom.stdout.includes('"deny"'), "release guard allowed everything when the input carried a byte-order mark");

// The pt-BR text check: blocks a glued em dash in member text, ignores operator material.
const textProbe = "modules/_template/README.md";
const textHook = (file_path, content) =>
  runHook("text-lint.mjs", { cwd: repoRoot, hook_event_name: "PostToolUse", tool_input: { file_path: join(repoRoot, file_path), content } });
assert(textHook(textProbe, "") === null, "text check fired on the template, which is not member text");
assert(textHook("packages/cli/src/main.ts", "") === null, "text check fired on CLI source");
const coreText = textHook("packages/core/assets/agents/pt-BR.md", "");
assert(coreText === null || !coreText.decision, "text check blocked the core's own AGENTS block");
assert(textHook("packages/core/assets/skills/texto-natural/SKILL.md", "") === null, "text check flagged the skill that teaches the patterns");
const probeDir = join(repoRoot, "modules", "zz-harness-probe");
try {
  mkdirSync(probeDir, { recursive: true });
  writeFileSync(join(probeDir, "README.md"), "# Sonda\n\nO app faz isso—e mais aquilo.\n");
  const blocked = textHook("modules/zz-harness-probe/README.md", "");
  assert(blocked?.decision === "block" && blocked.reason.includes("travessao-colado"), "text check did not block a glued em dash");
  writeFileSync(join(probeDir, "README.md"), '# Sonda\n\nA faixa vai de 3–4 segundos. O guia cita "não é só X, é Y" como fórmula a evitar.\n');
  assert(textHook("modules/zz-harness-probe/README.md", "") === null, "text check flagged a number range or a quoted citation");
} finally {
  rmSync(probeDir, { recursive: true, force: true });
}

const harnessSync = runHook("harness-sync.mjs", {
  ...codexBase,
  hook_event_name: "PostToolUse",
  tool_input: { command: "*** Begin Patch\n*** Update File: CLAUDE.md\n*** End Patch" },
});
assert(harnessSync === null, "Shared harness synchronization failed");

console.log("Claude/Codex harness tests passed.");
