import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { MANIFEST_FILE, shippableFiles, totalSize } from "./files.ts";
import { parseFrontmatter } from "./frontmatter.ts";
import { crossFieldErrors, MAX_UNCOMPRESSED_BYTES, type Manifest, readManifest, schemaErrors } from "./manifest.ts";
import { listModuleDirs } from "./paths.ts";

export type Report = {
  slug: string;
  dir: string;
  manifest: Manifest | null;
  files: string[];
  skills: { name: string; description: string }[];
  errors: string[];
  warnings: string[];
};

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KNOWN_FRONTMATTER = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
  "disable-model-invocation",
]);
/** A description enters the context of every session: above this the app pays for it in every turn. */
export const DESCRIPTION_SOFT_LIMIT = 400;
export const DESCRIPTION_HARD_LIMIT = 1024;

function validateEval(dir: string, slug: string, errors: string[]): void {
  const path = join(dir, "tests", "eval.json");
  if (!existsSync(path)) {
    errors.push("tests/eval.json: missing; every app ships with at least one evaluation case");
    return;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    errors.push("tests/eval.json: not valid JSON");
    return;
  }
  const evalFile = raw as { app?: unknown; cases?: unknown };
  if (evalFile.app !== slug) errors.push(`tests/eval.json: "app" must be "${slug}"`);
  if (!Array.isArray(evalFile.cases) || evalFile.cases.length === 0) {
    errors.push("tests/eval.json: at least one case");
    return;
  }
  evalFile.cases.forEach((item, index) => {
    const testCase = item as { name?: unknown; prompt?: unknown };
    if (typeof testCase.name !== "string" || !testCase.name.trim()) errors.push(`tests/eval.json: case ${index} needs a name`);
    if (typeof testCase.prompt !== "string" || !testCase.prompt.trim()) {
      errors.push(`tests/eval.json: case ${index} needs a prompt`);
    }
  });
}

function validateSkills(dir: string, files: string[], report: Report): void {
  const skillFiles = files.filter((file) => /^skills\/[^/]+\/SKILL\.md$/.test(file));
  for (const file of skillFiles) {
    const folder = file.split("/")[1];
    const parsed = parseFrontmatter(readFileSync(join(dir, ...file.split("/")), "utf8"));
    if (!parsed) {
      report.errors.push(`${file}: missing YAML frontmatter`);
      continue;
    }
    const { data, keys } = parsed;
    const name = data.name ?? "";
    const description = data.description ?? "";
    if (!name) report.errors.push(`${file}: frontmatter needs "name"`);
    else if (name !== folder) report.errors.push(`${file}: name "${name}" must equal the folder "${folder}"`);
    else if (!SKILL_NAME.test(name) || name.length > 64) {
      report.errors.push(`${file}: name must be lowercase letters, digits and single hyphens, at most 64 characters`);
    }
    if (!description.trim()) report.errors.push(`${file}: frontmatter needs "description"`);
    else if (description.length > DESCRIPTION_HARD_LIMIT) {
      report.errors.push(`${file}: description has ${description.length} characters, the limit is ${DESCRIPTION_HARD_LIMIT}`);
    } else if (description.length > DESCRIPTION_SOFT_LIMIT) {
      report.warnings.push(
        `${file}: description has ${description.length} characters; aim below ${DESCRIPTION_SOFT_LIMIT}, it enters every session`,
      );
    }
    for (const key of keys) {
      if (!KNOWN_FRONTMATTER.has(key)) report.warnings.push(`${file}: frontmatter key "${key}" is not part of the Agent Skills standard`);
    }
    report.skills.push({ name, description });
  }
  const names = report.skills.map((skill) => skill.name);
  for (const name of new Set(names.filter((candidate, index) => names.indexOf(candidate) !== index))) {
    report.errors.push(`skills: the name "${name}" is used by more than one skill`);
  }
}

/** Validates one app directory. `files` in the manifest must equal what ships. */
export function validateModule(dir: string): Report {
  const slug = basename(dir);
  const report: Report = { slug, dir, manifest: null, files: [], skills: [], errors: [], warnings: [] };

  const { manifest, error } = readManifest(join(dir, MANIFEST_FILE));
  if (!manifest) {
    report.errors.push(error ?? `${MANIFEST_FILE} is unreadable`);
    return report;
  }
  report.manifest = manifest;

  const shape = schemaErrors(manifest);
  report.errors.push(...shape);
  if (shape.length) return report;

  if (manifest.name !== slug) report.errors.push(`name: "${manifest.name}" must equal the directory "${slug}"`);
  report.errors.push(...crossFieldErrors(manifest));

  const files = shippableFiles(dir);
  report.files = files;
  const declared = new Set(manifest.files);
  const actual = new Set(files);
  const missing = manifest.files.filter((file) => !actual.has(file));
  const extra = files.filter((file) => !declared.has(file));
  if (missing.length || extra.length) {
    const parts: string[] = [];
    if (missing.length) parts.push(`listed but not on disk: ${missing.join(", ")}`);
    if (extra.length) parts.push(`on disk but not listed: ${extra.join(", ")}`);
    report.errors.push(`files: out of date (${parts.join("; ")}). Run \`npm run pack ${slug}\`, which regenerates it.`);
  }

  if (!actual.has("README.md")) report.errors.push("README.md: missing; it is the member's guide and the app page");
  if (!existsSync(join(dir, ...manifest.entry.split("/")))) report.errors.push(`entry: "${manifest.entry}" does not exist`);

  validateSkills(dir, files, report);
  if ((manifest.type === "skill" || manifest.type === "workflow") && report.skills.length === 0) {
    report.errors.push(`type ${manifest.type}: needs at least one skills/<name>/SKILL.md`);
  }

  const hasScripts = files.some((file) => file.startsWith("scripts/"));
  const hasShell = (manifest.permissions ?? []).some((permission) => permission.kind === "shell");
  if (hasScripts && !hasShell) report.warnings.push("scripts/ exists but no `shell` permission is declared");
  if ((manifest.external_credentials ?? []).length && !/sem a chave|without the key/i.test(safeRead(join(dir, "README.md")))) {
    report.warnings.push("README.md: an app with external credentials should describe what it does without the key");
  }

  if (files.length && totalSize(dir, files) > MAX_UNCOMPRESSED_BYTES) report.errors.push("the package exceeds 200 MB uncompressed");
  validateEval(dir, slug, report.errors);
  return report;
}

function safeRead(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

/** Validates every app and the rules that span apps (a skill name must be unique across the catalog). */
export function validateAll(dirs: string[] = listModuleDirs()): Report[] {
  const reports = dirs.map(validateModule);
  const owners = new Map<string, string[]>();
  for (const report of reports) {
    for (const skill of report.skills) owners.set(skill.name, [...(owners.get(skill.name) ?? []), report.slug]);
  }
  for (const [name, slugs] of owners) {
    if (slugs.length > 1) {
      for (const report of reports.filter((candidate) => slugs.includes(candidate.slug))) {
        report.errors.push(`skills: the name "${name}" is also used by ${slugs.filter((s) => s !== report.slug).join(", ")}`);
      }
    }
  }
  return reports;
}
