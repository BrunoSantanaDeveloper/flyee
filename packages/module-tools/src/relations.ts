import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { shippableFiles } from "./files.ts";

/**
 * How apps relate, read from what they ship, never declared twice. An app uses
 * another when one of its shipped text files names the other's installed path
 * (`.flyee/modules/<slug>/`), which is exactly how a consumer calls a tool app
 * (docs/COMO-CRIAR-UM-APP.md, §9). When the manifest v2 brings `requires`,
 * these relations become its value.
 */

const TEXT_FILE = /\.(md|mjs|cjs|js|ts|py|sh|ps1|json|txt|ya?ml)$/i;
const REFERENCE = /\.flyee\/modules\/([a-z0-9][a-z0-9-]{1,59})\//g;

/** The slugs of the other apps this app calls, sorted. */
export function referencedApps(dir: string): string[] {
  const self = basename(dir);
  const found = new Set<string>();
  for (const file of shippableFiles(dir)) {
    if (!TEXT_FILE.test(file)) continue;
    let text: string;
    try {
      text = readFileSync(join(dir, ...file.split("/")), "utf8");
    } catch {
      continue;
    }
    for (const match of text.matchAll(REFERENCE)) if (match[1] !== self) found.add(match[1]);
  }
  return [...found].sort();
}

export type InterfaceInfo = {
  /** The `interface_version` the guide documents, when it states one. */
  version: number | null;
  /** The script other apps run, relative to the app (`scripts/video.mjs`). */
  entry: string | null;
  /** The subcommands the guide shows in its examples. */
  commands: string[];
};

/**
 * An app serves others when it ships `references/interface.md`, the guide
 * written for the AI that runs another app (COMO-CRIAR-UM-APP.md, §9).
 */
export function readInterface(dir: string): InterfaceInfo | null {
  const path = join(dir, "references", "interface.md");
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  const version = /(?:vers[aã]o da interface|interface version)\s*:?\s*\**\s*(\d+)/i.exec(text);
  const slug = basename(dir);
  const entryPattern = new RegExp(`node \\.flyee/modules/${slug}/(scripts/[^\\s\`]+)`);
  const entry = entryPattern.exec(text);
  const commands = new Set<string>();
  const commandPattern = new RegExp(`node \\.flyee/modules/${slug}/scripts/[^\\s\`]+\\s+([a-z][a-z0-9-]*)`, "g");
  for (const match of text.matchAll(commandPattern)) commands.add(match[1]);
  return { version: version ? Number(version[1]) : null, entry: entry ? entry[1] : null, commands: [...commands].sort() };
}
