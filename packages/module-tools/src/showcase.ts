import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { copyBreaks, storeBreaks } from "./text-lint.mjs";

/**
 * The store's example of an app answering a request (CLI-CONTRACT.md 10.1,
 * `showcase`, since 2026-10-17): the home, /catalogo and the app page show it
 * in place of the command that installs the app. It lives only in the index,
 * beside the name and the summary, never in `flyee.module.json` (manifest v1
 * has no such field, and CLI 1.x and the platform's inspection read the
 * manifest). Each app keeps its example in `.dev/showcase.json`, which never
 * ships: a file inside the package would change the ZIP of versions already
 * released, and versions are immutable.
 */

export const SHOWCASE_FILE = ".dev/showcase.json";
export const SHOWCASE_LOCALES = ["pt-BR", "en"] as const;

export type ShowcaseLine = { label?: string; text: string };
export type ShowcaseLocale = { request: string; reply: ShowcaseLine[]; saved?: string };
/** `null` takes that language off the catalog on the next import; a language left out keeps the catalog's (10.1, since 2026-10-20). */
export type Showcase = Partial<Record<(typeof SHOWCASE_LOCALES)[number], ShowcaseLocale | null>>;

/** The contract's limits (10.1), in characters. */
const LIMITS = { request: 400, text: 280, label: 40, saved: 160, linesMin: 1, linesMax: 8 };

export function showcasePath(dir: string): string {
  return join(dir, ...SHOWCASE_FILE.split("/"));
}

/** The app's example, or null when it has none; `error` when the file exists and is not JSON. */
export function readShowcase(dir: string): { showcase: Showcase | null; error?: string } {
  const path = showcasePath(dir);
  if (!existsSync(path)) return { showcase: null };
  try {
    return { showcase: JSON.parse(readFileSync(path, "utf8")) as Showcase };
  } catch (error) {
    return { showcase: null, error: `${SHOWCASE_FILE}: not valid JSON (${(error as Error).message})` };
  }
}

/** A string within the limit, and every rule of the store's copy (the platform drops a language that breaks one). */
function textProblems(where: string, value: unknown, max: number, required: boolean): string[] {
  if (value === undefined && !required) return [];
  if (typeof value !== "string" || value.trim() === "") return [`${where}: needs a text`];
  const problems: string[] = [];
  if ([...value].length > max) problems.push(`${where}: ${[...value].length} characters, the limit is ${max}`);
  for (const broken of [...copyBreaks(value), ...storeBreaks(value)]) problems.push(`${where}: ${broken}`);
  return problems;
}

/**
 * Everything the platform's import would drop with a warning (10.1): the shape,
 * the limits and the copy rules, per language. An unknown key is an error too,
 * so a typo never hides a line the store would miss.
 */
export function showcaseErrors(showcase: unknown): string[] {
  if (showcase === null || typeof showcase !== "object" || Array.isArray(showcase)) return [`${SHOWCASE_FILE}: must be an object keyed by language (pt-BR, en)`];
  const errors: string[] = [];
  for (const [locale, value] of Object.entries(showcase as Record<string, unknown>)) {
    const where = `${SHOWCASE_FILE} ${locale}`;
    if (!(SHOWCASE_LOCALES as readonly string[]).includes(locale)) {
      errors.push(`${where}: unknown language; the store takes ${SHOWCASE_LOCALES.join(" and ")}`);
      continue;
    }
    if (value === null) continue;
    if (typeof value !== "object" || Array.isArray(value)) {
      errors.push(`${where}: must be an object with request, reply and, if you like, saved, or null to take the language off the store`);
      continue;
    }
    const entry = value as Record<string, unknown>;
    for (const key of Object.keys(entry)) if (!["request", "reply", "saved"].includes(key)) errors.push(`${where}: unknown key "${key}"`);
    errors.push(...textProblems(`${where} request`, entry.request, LIMITS.request, true));
    errors.push(...textProblems(`${where} saved`, entry.saved, LIMITS.saved, false));
    if (!Array.isArray(entry.reply) || entry.reply.length < LIMITS.linesMin || entry.reply.length > LIMITS.linesMax) {
      errors.push(`${where} reply: ${LIMITS.linesMin} to ${LIMITS.linesMax} lines`);
      continue;
    }
    entry.reply.forEach((line, index) => {
      const at = `${where} reply[${index}]`;
      if (line === null || typeof line !== "object" || Array.isArray(line)) {
        errors.push(`${at}: must be an object with text and, if you like, label`);
        return;
      }
      const record = line as Record<string, unknown>;
      for (const key of Object.keys(record)) if (!["text", "label"].includes(key)) errors.push(`${at}: unknown key "${key}"`);
      errors.push(...textProblems(`${at} text`, record.text, LIMITS.text, true));
      errors.push(...textProblems(`${at} label`, record.label, LIMITS.label, false));
    });
  }
  return errors;
}
