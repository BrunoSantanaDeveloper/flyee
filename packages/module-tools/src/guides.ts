import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The written guides of an app (CLI-CONTRACT.md §7, re-implemented from the
 * platform's `@flyee/catalog/guides`): one Markdown file per language and
 * depth, at a fixed path, listed in `files` like any other file. The app's
 * page in the member area reads only these four paths: "usar" for every
 * member, "abrir o capô" (how it works inside) for FlyeeClub Pro.
 *
 * The platform refuses a package with any other name under `guides/`, a guide
 * above 200,000 bytes and an empty one; it renders GitHub Markdown without raw
 * HTML and without resolving paths relative to the package. Here every app
 * also carries "usar" in both languages, and "abrir o capô" comes in pairs.
 */

export const GUIDE_LOCALES = ["pt-BR", "en"] as const;
export const GUIDE_DEPTHS = ["usar", "abrir-o-capo"] as const;
export const GUIDE_DIR = "guides/";
export const MAX_GUIDE_BYTES = 200_000;
const GUIDE_PATH = /^guides\/(pt-BR|en)\/(usar|abrir-o-capo)\.md$/;

export function guideOf(path: string): { locale: (typeof GUIDE_LOCALES)[number]; depth: (typeof GUIDE_DEPTHS)[number] } | null {
  const match = GUIDE_PATH.exec(path);
  return match ? { locale: match[1] as (typeof GUIDE_LOCALES)[number], depth: match[2] as (typeof GUIDE_DEPTHS)[number] } : null;
}

export function guidePath(locale: (typeof GUIDE_LOCALES)[number], depth: (typeof GUIDE_DEPTHS)[number]): string {
  return `${GUIDE_DIR}${locale}/${depth}.md`;
}

/** A link or image the panel cannot follow: not absolute, not an anchor, not mail. */
const RELATIVE_TARGET = /!?\[[^\]\n]*\]\((?!https?:\/\/|mailto:|#)([^)\s]+)/g;
/** A command for someone to run: guides say what to ask the AI, never what to type. */
const COMMAND = /(?<![\p{L}\p{N}])(?:npx|npm (?:run|install|i)|node \.flyee\/|python3? |winget |brew |apt(?:-get)? )/u;

/** Errors of the guides of one app, as `path: problem`. */
export function guideErrors(dir: string, files: string[]): string[] {
  const errors: string[] = [];
  const guides = files.filter((file) => file.startsWith(GUIDE_DIR));
  for (const file of guides) {
    if (!guideOf(file)) {
      errors.push(`${file}: a guide is guides/<pt-BR|en>/<usar|abrir-o-capo>.md; the platform refuses any other name under guides/`);
      continue;
    }
    const bytes = readFileSync(join(dir, ...file.split("/")));
    if (bytes.byteLength > MAX_GUIDE_BYTES) errors.push(`${file}: ${bytes.byteLength} bytes; a guide is at most ${MAX_GUIDE_BYTES}`);
    const text = bytes.toString("utf8").replace(/^﻿/, "");
    if (!text.trim()) errors.push(`${file}: empty; the platform refuses an empty guide`);
    for (const match of text.matchAll(RELATIVE_TARGET)) {
      errors.push(`${file}: "${match[1]}" is relative; the panel resolves no path inside the package, use an absolute https:// address`);
    }
    if (COMMAND.test(text)) errors.push(`${file}: shows a command; a guide says what to ask the AI, which runs every command`);
  }
  for (const locale of GUIDE_LOCALES) {
    if (!files.includes(guidePath(locale, "usar"))) errors.push(`${guidePath(locale, "usar")}: missing; every app carries the "usar" guide in pt-BR and en`);
  }
  const deep = GUIDE_LOCALES.filter((locale) => files.includes(guidePath(locale, "abrir-o-capo")));
  if (deep.length === 1) {
    const other = GUIDE_LOCALES.find((locale) => locale !== deep[0])!;
    errors.push(`${guidePath(other, "abrir-o-capo")}: missing; "abrir o capô" comes in both languages or in none`);
  }
  return errors;
}
