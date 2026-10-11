#!/usr/bin/env node
// PostToolUse: the pt-BR writing check on text that reaches the member (the
// shipped `.md` files of an app and the core assets). Same rules as
// `validate`, from packages/module-tools/src/text-lint.mjs: hard findings block
// the turn so the file is fixed now, advisory ones are shown to be weighed.
// Never breaks a tool call: any unexpected failure exits silently.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { extractToolPaths, isCodexHook, normalizeToolPath } from "./lib/tool-paths.mjs";

function findRepoRoot(start) {
  let current = resolve(start);
  const root = parse(current).root;
  while (current !== root) {
    if (existsSync(join(current, "packages", "module-tools", "src", "text-lint.mjs"))) return current;
    current = dirname(current);
  }
  return null;
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", async () => {
  try {
    const input = JSON.parse(raw.replace(/^﻿/, "") || "{}");
    const root = findRepoRoot(input?.cwd ?? process.cwd());
    if (!root) process.exit(0);
    const { isMemberText, lintMemberText, teachesPatterns } = await import(pathToFileURL(join(root, "packages", "module-tools", "src", "text-lint.mjs")).href);

    const findings = [];
    for (const path of extractToolPaths(input)) {
      const absolute = resolve(input?.cwd ?? root, path);
      const rel = normalizeToolPath(relative(root, absolute));
      if (rel.startsWith("..") || !isMemberText(rel)) continue;
      let text;
      try {
        text = readFileSync(absolute, "utf8");
      } catch {
        continue; // moved or deleted between the write and the hook
      }
      const result = lintMemberText(text, { teachesPatterns: teachesPatterns(rel) });
      if (result.violations.length || result.advisories.length) findings.push({ rel, ...result });
    }
    if (!findings.length) process.exit(0);

    const hard = findings.filter((finding) => finding.violations.length);
    if (hard.length) {
      const reason = [
        "TEXTO PARA O INTEGRANTE: este arquivo chega ao integrante e quebra a regra de escrita em pt-BR. Corrija agora:",
        ...hard.flatMap(({ rel, violations, advisories }) => [
          rel,
          ...violations.map((violation, index) => `${index + 1}. ${violation}`),
          ...advisories.map((advisory) => `- também: ${advisory}`),
        ]),
        "Para reescrever trechos, use a skill humanizer-pt-br.",
      ].join("\n");
      process.stdout.write(JSON.stringify(isCodexHook(input) ? { systemMessage: reason } : { decision: "block", reason }));
      process.exit(0);
    }
    const context = [
      "TEXTO PARA O INTEGRANTE: avisos de escrita em pt-BR (confira e corrija se procede; citação entre aspas é ignorada):",
      ...findings.flatMap(({ rel, advisories }) => [rel, ...advisories.map((advisory) => `- ${advisory}`)]),
    ].join("\n");
    process.stdout.write(
      JSON.stringify(
        isCodexHook(input) ? { systemMessage: context } : { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: context } },
      ),
    );
    process.exit(0);
  } catch {
    process.exit(0);
  }
});
