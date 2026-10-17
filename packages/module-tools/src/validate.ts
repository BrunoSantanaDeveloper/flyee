import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { MANIFEST_FILE, shippableFiles, totalSize } from "./files.ts";
import { parseFrontmatter } from "./frontmatter.ts";
import { crossFieldErrors, MAX_UNCOMPRESSED_BYTES, type Manifest, readManifest, schemaErrors } from "./manifest.ts";
import { listModuleDirs } from "./paths.ts";
import { PLACEHOLDER, placeholdersIn } from "./placeholders.ts";
import { referencedApps } from "./relations.ts";
import { guideErrors } from "./guides.ts";
import { scriptTextErrors } from "./script-text.ts";
import { readShowcase, showcaseErrors } from "./showcase.ts";
import { copyBreaks, DASH, EMOJI, lintMemberText, storeBreaks } from "./text-lint.mjs";

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
/** Install commands written for a person to type: the AI installs through `npx flyee need` instead. */
const MEMBER_INSTALL = /\b(?:winget|brew|choco|scoop)\s+(?:install|upgrade)\b|\bapt(?:-get)?\s+install\b|\bpip3?\s+install\b|\bpython3?\s+-m\s+pip\s+install\b/i;
/** Text that sends the member to a terminal. */
const MEMBER_TERMINAL = /\bno seu terminal\b|\babra o terminal\b|\bin your (?:own )?terminal\b|\bopen (?:a|the|your) terminal\b/i;
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
  let text: string;
  try {
    text = readFileSync(path, "utf8");
    raw = JSON.parse(text);
  } catch {
    errors.push("tests/eval.json: not valid JSON");
    return;
  }
  if (text.includes(PLACEHOLDER)) errors.push(`tests/eval.json: ${PLACEHOLDER} still to be written`);
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
  // The member never opens a terminal: their AI installs programs (`npx flyee need`) and opens the key page.
  for (const file of files.filter((candidate) => candidate.endsWith(".md"))) {
    const text = safeRead(join(dir, ...file.split("/")));
    // The platform's copy rules and the pt-BR style checks (text-lint.mjs, shared with the PostToolUse hook):
    // the copy rules are errors, the style one warning per file.
    const writing = lintMemberText(text);
    for (const violation of writing.violations) report.errors.push(`${file}: ${violation}`);
    if (writing.advisories.length) report.warnings.push(`${file}: ${writing.advisories.join(" ")}`);
    if (MEMBER_INSTALL.test(text)) {
      report.errors.push(`${file}: tells someone to install a program by hand; the AI installs it with \`npx flyee need <program> --yes --json\``);
    }
    if (MEMBER_TERMINAL.test(text)) {
      report.errors.push(`${file}: sends the member to the terminal; the AI runs every command (keys go through \`npx flyee key set\`, which opens a page in the browser)`);
    }
  }
  // What the manifest says reaches the member too: the app page, the review before installing, the changelog.
  for (const [field, value] of manifestTexts(manifest)) {
    for (const problem of copyBreaks(value)) report.errors.push(`${MANIFEST_FILE} ${field}: ${problem}`);
  }
  // What the store shows answers to two more rules (the platform's catalog import): the title and the
  // summary, and the README, which becomes the store's description; a guide only to "grátis".
  for (const [field, value] of manifestTexts(manifest).filter(([field]) => /^(title|summary)\./.test(field))) {
    for (const problem of storeBreaks(value)) report.errors.push(`${MANIFEST_FILE} ${field}: ${problem}`);
  }
  if (actual.has("README.md")) {
    for (const problem of storeBreaks(safeRead(join(dir, "README.md")).replace(/^\s*#\s[^\n]*\n/u, ""))) report.errors.push(`README.md: ${problem}`);
  }
  for (const file of files.filter((candidate) => candidate.startsWith("guides/") && candidate.endsWith(".md"))) {
    for (const problem of storeBreaks(safeRead(join(dir, ...file.split("/"))), { pro: false })) report.errors.push(`${file}: ${problem}`);
  }
  // The store's example of the app answering a request (CLI-CONTRACT.md 10.1), kept outside the package.
  const example = readShowcase(dir);
  if (example.error) report.errors.push(example.error);
  else if (example.showcase) report.errors.push(...showcaseErrors(example.showcase));
  // Other text the package carries (pages, data, styles): no dash or emoji anywhere.
  for (const file of files.filter((candidate) => TEXT_ASSET.test(candidate))) {
    const text = safeRead(join(dir, ...file.split("/")));
    if (DASH.test(text) || EMOJI.test(text)) report.errors.push(`${file}: travessão (— ou –) ou emoji; a regra de texto do flyee.club não aceita`);
  }
  report.errors.push(...scriptTextErrors(dir, files));
  report.errors.push(...guideErrors(dir, files));
  const unfilled = placeholdersIn(dir, files);
  if (unfilled.length) report.errors.push(`${PLACEHOLDER} still to be written in: ${unfilled.join(", ")}`);
  validateEval(dir, slug, report.errors);
  return report;
}

/** Text files of a package other than Markdown and scripts. */
const TEXT_ASSET = /.(?:html?|css|json|txt|svg|ya?ml)$/i;

/** Every human-readable string of the manifest, as [field, text]: titles, summaries, reasons, purposes, changelog. */
function manifestTexts(manifest: Manifest): [string, string][] {
  const found: [string, string][] = [];
  const localized = (field: string, value: unknown) => {
    if (value && typeof value === "object") {
      for (const [locale, text] of Object.entries(value as Record<string, unknown>)) {
        if (typeof text === "string") found.push([`${field}.${locale}`, text]);
      }
    }
  };
  localized("title", manifest.title);
  localized("summary", manifest.summary);
  localized("changelog", manifest.changelog);
  (manifest.permissions ?? []).forEach((permission, index) => localized(`permissions[${index}].reason`, permission.reason));
  (manifest.external_credentials ?? []).forEach((credential, index) => {
    found.push([`external_credentials[${index}].name`, credential.name]);
    localized(`external_credentials[${index}].purpose`, credential.purpose);
  });
  return found;
}

function safeRead(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

/**
 * An app that calls another (`.flyee/modules/<other>/` in what it ships)
 * needs that app to exist, and the other app should ship the guide for
 * callers. The member must learn about the dependency from the README.
 */
function validateRelations(report: Report): void {
  const root = dirname(report.dir);
  for (const other of referencedApps(report.dir)) {
    const otherDir = join(root, other);
    if (!existsSync(join(otherDir, "flyee.module.json"))) {
      report.errors.push(`uses: names .flyee/modules/${other}/ but no app "${other}" exists in modules/`);
      continue;
    }
    if (!existsSync(join(otherDir, "references", "interface.md"))) {
      report.warnings.push(`uses: "${other}" has no references/interface.md, the guide for apps that call it`);
    }
    const readme = safeRead(join(report.dir, "README.md"));
    const otherTitle = readManifest(join(otherDir, "flyee.module.json")).manifest?.title?.["pt-BR"] ?? "";
    if (!readme.includes(other) && !(otherTitle && readme.includes(otherTitle))) {
      report.warnings.push(`README.md: tell the member this app uses "${other}" and that it installs with \`npx flyee add ${other}\``);
    }
  }
}

/** Validates every app and the rules that span apps (a skill name must be unique across the catalog). */
export function validateAll(dirs: string[] = listModuleDirs()): Report[] {
  const reports = dirs.map(validateModule);
  for (const report of reports) if (report.manifest) validateRelations(report);
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
