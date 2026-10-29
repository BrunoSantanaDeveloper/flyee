import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Context } from "../context.ts";
import { type Lock, moduleDir } from "../state/lock.ts";

/**
 * Who uses whom among the apps of a project, read from what they shipped and
 * never declared: an app uses another when one of its text files names the
 * other's installed path, `.flyee/modules/<slug>/`, which is how a skill or a
 * script calls a tool app. The operator's catalog reads the apps' sources with
 * this same rule (packages/module-tools/src/relations.ts); it is written again
 * here because the CLI ships with no dependencies. When the manifest v2 brings
 * `requires` (CLI-CONTRACT.md section 9, planned), these relations become its value.
 */
const TEXT_FILE = /\.(md|mjs|cjs|js|ts|py|sh|ps1|json|txt|ya?ml)$/i;
const REFERENCE = /\.flyee\/modules\/([a-z0-9][a-z0-9-]{1,59})\//g;

/** The other apps an installed app names in the text files it shipped (the lock's `files`), sorted. */
export function appsUsedBy(ctx: Context, slug: string, files: string[]): string[] {
  const found = new Set<string>();
  for (const file of files) {
    if (!TEXT_FILE.test(file)) continue;
    let text: string;
    try {
      text = readFileSync(join(moduleDir(ctx, slug), ...file.split("/")), "utf8");
    } catch {
      continue;
    }
    for (const match of text.matchAll(REFERENCE)) if (match[1] !== slug) found.add(match[1]);
  }
  return [...found].sort();
}

/** The apps installed in this project that use `slug`, sorted. */
export function dependentsOf(ctx: Context, lock: Lock, slug: string): string[] {
  return Object.entries(lock.modules)
    .filter(([other, module]) => other !== slug && appsUsedBy(ctx, other, (module.files ?? []).map((file) => file.path)).includes(slug))
    .map(([other]) => other)
    .sort();
}
