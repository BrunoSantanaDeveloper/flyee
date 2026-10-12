import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** File by file: fs.cpSync on Node 24 for Windows writes a destination with accents into a garbled sibling folder. */
export function copyDir(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.isDirectory()) copyDir(join(from, entry.name), join(to, entry.name));
    else if (entry.isFile()) copyFileSync(join(from, entry.name), join(to, entry.name));
  }
}

import { MANIFEST_FILE } from "./files.ts";
import { type Manifest, MODULE_TYPES, readManifest, serializeManifest, TRAILS } from "./manifest.ts";
import { writeFilesToManifest } from "./pack.ts";
import { modulesRoot } from "./paths.ts";
import { PLACEHOLDER, placeholdersIn } from "./placeholders.ts";
import { compareSemver, isSemver } from "./semver.ts";

/**
 * Creating and versioning apps from the chat. Every text the operator still
 * has to write is marked with PLACEHOLDER, and `validate` refuses an app
 * that still carries one, so a scaffold or a version bump can never be packed
 * half-written.
 */
export const TEMPLATE_SLUG = "meu-app";
const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;

export type NewAppInput = {
  slug: string;
  type: string;
  trail: string;
  title?: string;
  titleEn?: string;
  summary?: string;
  root?: string;
};

export type NewAppResult = { dir: string; manifest: Manifest; files: string[]; placeholders: string[] };

function replaceInFile(path: string, pairs: [string | RegExp, string][]): void {
  let text = readFileSync(path, "utf8");
  for (const [from, to] of pairs) text = text.split(from as string).join(to);
  writeFileSync(path, text, "utf8");
}

/** Copies modules/_template into modules/<slug> with the names, type and trail filled in. */
export function scaffoldApp(input: NewAppInput): NewAppResult {
  const root = input.root ?? modulesRoot;
  if (!SLUG.test(input.slug)) throw new Error(`"${input.slug}" is not a valid slug: lowercase letters, digits and hyphens, 2 to 60 characters`);
  if (!(MODULE_TYPES as readonly string[]).includes(input.type)) throw new Error(`type must be one of ${MODULE_TYPES.join(", ")}`);
  if (!(TRAILS as readonly string[]).includes(input.trail)) throw new Error(`trail must be one of ${TRAILS.join(", ")}`);
  const dir = join(root, input.slug);
  if (existsSync(dir)) throw new Error(`modules/${input.slug} already exists`);
  const template = join(root, "_template");
  if (!existsSync(join(template, MANIFEST_FILE))) throw new Error("modules/_template is missing");

  copyDir(template, dir);
  renameSync(join(dir, "skills", TEMPLATE_SLUG), join(dir, "skills", input.slug));

  const title = input.title?.trim() || `${PLACEHOLDER} nome do app`;
  const { manifest } = readManifest(join(dir, MANIFEST_FILE));
  if (!manifest) throw new Error("the template manifest is unreadable");
  manifest.name = input.slug;
  manifest.version = "1.0.0";
  manifest.type = input.type as Manifest["type"];
  manifest.trail = input.trail;
  manifest.entry = `skills/${input.slug}/SKILL.md`;
  manifest.title = input.titleEn?.trim() ? { "pt-BR": title, en: input.titleEn.trim() } : { "pt-BR": title };
  manifest.summary = input.summary?.trim() ? { "pt-BR": input.summary.trim() } : { "pt-BR": `${PLACEHOLDER} uma frase do que o app entrega, pelo resultado` };
  manifest.changelog = { "pt-BR": "Primeira versão." };
  writeFileSync(join(dir, MANIFEST_FILE), serializeManifest(manifest), "utf8");

  const skillPath = join(dir, "skills", input.slug, "SKILL.md");
  replaceInFile(skillPath, [
    [`name: ${TEMPLATE_SLUG}`, `name: ${input.slug}`],
    ["# Meu app", `# ${title}`],
    [`--module ${TEMPLATE_SLUG}`, `--module ${input.slug}`],
  ]);
  replaceInFile(join(dir, "README.md"), [["# Meu app", `# ${title}`]]);
  replaceInFile(join(dir, "tests", "eval.json"), [[`"${TEMPLATE_SLUG}"`, `"${input.slug}"`]]);

  const files = writeFilesToManifest(dir);
  const { manifest: written } = readManifest(join(dir, MANIFEST_FILE));
  return { dir, manifest: written!, files, placeholders: placeholdersIn(dir) };
}

export type BumpKind = "patch" | "minor" | "major";

export function nextVersion(current: string, bump: string): string {
  if (isSemver(bump)) return bump;
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(current);
  if (!match) throw new Error(`current version "${current}" is not MAJOR.MINOR.PATCH`);
  const [major, minor, patch] = match.slice(1).map(Number);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`"${bump}" is not patch, minor, major or a version`);
}

/**
 * Raises the version and replaces the changelog with placeholders in every
 * language the app has, so the new version cannot be packed until the
 * operator says what changed.
 */
export function bumpApp(slug: string, bump: string, root: string = modulesRoot): { from: string; to: string } {
  const dir = join(root, slug);
  const { manifest, error } = readManifest(join(dir, MANIFEST_FILE));
  if (!manifest) throw new Error(`modules/${slug}: ${error}`);
  const to = nextVersion(manifest.version, bump);
  if (compareSemver(to, manifest.version) <= 0) throw new Error(`${to} is not greater than ${manifest.version}`);
  const from = manifest.version;
  manifest.version = to;
  manifest.changelog = manifest.changelog?.en
    ? { "pt-BR": `${PLACEHOLDER} o que mudou na ${to}`, en: `${PLACEHOLDER} what changed in ${to}` }
    : { "pt-BR": `${PLACEHOLDER} o que mudou na ${to}` };
  writeFileSync(join(dir, MANIFEST_FILE), serializeManifest(manifest), "utf8");
  return { from, to };
}
