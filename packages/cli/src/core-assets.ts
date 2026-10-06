import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Locale } from "./context.ts";
import { type ProgramSpec, programsRegistry, type ProgramsRegistry } from "./programs.ts";

/**
 * The harness content the CLI writes into member projects. In the published
 * bundle it sits in dist/core (copied at build time); when running from the
 * sources it is read straight from packages/core/assets.
 */

export type ToolEntry = {
  id: string;
  label: string;
  tier: "tested" | "standard";
  detect: { projectDirs?: string[]; projectFiles?: string[]; binaries?: string[] };
  instructions: { mode: "canonical" | "pointer" | "block"; file?: string; pointer?: string };
  skills: { standard: boolean; claude: boolean; openaiYaml?: boolean };
};

export type ToolsRegistry = {
  always: { canonical: string; skillDirs: string[] };
  tools: ToolEntry[];
};

export type CoreInfo = {
  version: string;
  manifest_versions: number[];
  markers: { begin: string; end: string };
};

export type CoreAssets = {
  root: string;
  core: CoreInfo;
  tools: ToolsRegistry;
  /** Programs the CLI installs for apps (`programs.json`). */
  programs: Map<string, ProgramSpec>;
  agentsTemplate: (locale: Locale) => string;
  flyeeSkill: (locale: Locale) => string;
};

function resolveRoot(): string {
  const candidates = [new URL("./core/", import.meta.url), new URL("../../core/assets/", import.meta.url)];
  for (const candidate of candidates) {
    const path = fileURLToPath(candidate);
    if (existsSync(path)) return path.replace(/[\\/]+$/, "");
  }
  throw new Error("flyee: core assets not found next to the CLI");
}

let cached: CoreAssets | null = null;

export function loadCoreAssets(): CoreAssets {
  if (cached) return cached;
  const root = resolveRoot();
  const read = (relative: string) => readFileSync(`${root}/${relative}`, "utf8");
  cached = {
    root,
    core: JSON.parse(read("core.json")) as CoreInfo,
    tools: JSON.parse(read("tools.json")) as ToolsRegistry,
    programs: programsRegistry(JSON.parse(read("programs.json")) as ProgramsRegistry),
    agentsTemplate: (locale) => read(`agents/${locale === "en" ? "en" : "pt-BR"}.md`),
    flyeeSkill: (locale) => read(`skills/flyee/${locale === "en" ? "en" : "pt-BR"}/SKILL.md`),
  };
  return cached;
}
