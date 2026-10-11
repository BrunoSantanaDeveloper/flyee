import { existsSync, rmdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

import type { Context } from "../context.ts";
import type { CoreAssets, ToolEntry } from "../core-assets.ts";
import type { Lock } from "../state/lock.ts";
import { ensureDir, readText, writeFileAtomic } from "../util/fs.ts";
import { hasBinary } from "../util/os.ts";

/**
 * The adapters: what makes an installed app visible to every AI tool. One
 * canonical AGENTS.md block, one-line pointers for the tools that read their
 * own file, bridges for every skill in the two skill directories, and whole
 * blocks for the tools that only read their own instructions file.
 */

export type DetectedTool = { id: string; label: string; tier: "tested" | "standard"; detected: boolean; reasons: string[] };

export function detectTools(ctx: Context, tools: ToolEntry[]): DetectedTool[] {
  return tools.map((tool) => {
    const reasons: string[] = [];
    for (const dir of tool.detect.projectDirs ?? []) if (existsSync(join(ctx.cwd, dir))) reasons.push(dir);
    for (const file of tool.detect.projectFiles ?? []) if (existsSync(join(ctx.cwd, file))) reasons.push(file);
    for (const binary of tool.detect.binaries ?? []) if (hasBinary(binary, ctx.env)) reasons.push(`${binary} on PATH`);
    return { id: tool.id, label: tool.label, tier: tool.tier, detected: reasons.length > 0, reasons };
  });
}

/** The `ai_tool` the contract accepts: the first tested tool detected, else `other`. */
export function reportedAiTool(detected: DetectedTool[]): string {
  const tested = detected.find((tool) => tool.detected && tool.tier === "tested");
  return tested ? tested.id : "other";
}

export function detectedToolDetail(detected: DetectedTool[]): string | undefined {
  return detected.find((tool) => tool.detected && tool.tier === "standard")?.id;
}

export type BlockResult = "created" | "updated" | "unchanged";

/** Replaces the managed block of a file, appends it to a file we did not write, or creates the file. */
export function upsertManagedBlock(path: string, block: string, markers: { begin: string; end: string }): BlockResult {
  const wrapped = `${markers.begin}\n${block.trim()}\n${markers.end}\n`;
  const current = readText(path);
  if (current === null) {
    writeFileAtomic(path, wrapped);
    return "created";
  }
  const start = current.indexOf(markers.begin);
  const end = current.indexOf(markers.end, start + markers.begin.length);
  let next: string;
  if (start >= 0 && end >= 0) {
    next = `${current.slice(0, start)}${wrapped}${current.slice(end + markers.end.length).replace(/^\r?\n/, "")}`;
  } else {
    next = `${current.replace(/\s*$/, "")}\n\n${wrapped}`;
  }
  if (next === current) return "unchanged";
  writeFileAtomic(path, next);
  return "updated";
}

/** `CLAUDE.md` → `@AGENTS.md`, `GEMINI.md` → `@./AGENTS.md`: created with the pointer, or a block appended. */
export function ensurePointer(path: string, pointer: string, markers: { begin: string; end: string }, note: string): BlockResult {
  const current = readText(path);
  if (current !== null && current.split(/\r?\n/).some((line) => line.trim() === pointer)) return "unchanged";
  return upsertManagedBlock(path, `${note}\n${pointer}`, markers);
}

export type SkillInfo = { name: string; description: string; extra: Record<string, string> };

const BRIDGE_KEYS = ["license", "compatibility", "allowed-tools", "disable-model-invocation"];

export function bridgeContent(ctx: Context, slug: string, skill: SkillInfo): string {
  const lines = [`name: ${skill.name}`, `description: ${JSON.stringify(skill.description)}`];
  for (const key of BRIDGE_KEYS) if (skill.extra[key]) lines.push(`${key}: ${JSON.stringify(skill.extra[key])}`);
  const canonical = `../../../.flyee/modules/${slug}/skills/${skill.name}/SKILL.md`;
  const body =
    ctx.locale === "en"
      ? `<!-- flyee: generated bridge. Do not edit; \`npx flyee update\` rewrites it. -->\n\n# Skill \`${skill.name}\` of the app \`${slug}\`\n\nThe canonical instructions live at \`${canonical}\`. Read that file completely before acting, resolve its relative references from its own folder, and follow it as the source.\n`
      : `<!-- flyee: ponte gerada. Não edite; \`npx flyee update\` a reescreve. -->\n\n# Skill \`${skill.name}\` do app \`${slug}\`\n\nAs instruções canônicas estão em \`${canonical}\`. Leia esse arquivo por completo antes de agir, resolva as referências relativas a partir da pasta dele e siga-o como fonte.\n`;
  return `---\n${lines.join("\n")}\n---\n\n${body}`;
}

function openaiYaml(skill: SkillInfo): string {
  const display = skill.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const short = skill.description.length > 120 ? `${skill.description.slice(0, 117)}…` : skill.description;
  return `interface:\n  display_name: ${JSON.stringify(display)}\n  short_description: ${JSON.stringify(short)}\n`;
}

/** Writes one bridge per skill into every skill directory; returns the project-relative paths written. */
export function writeSkillBridges(ctx: Context, assets: CoreAssets, slug: string, skills: SkillInfo[]): string[] {
  const written: string[] = [];
  const wantsOpenai = assets.tools.tools.some((tool) => tool.skills.openaiYaml);
  for (const dir of assets.tools.always.skillDirs) {
    for (const skill of skills) {
      const relative = `${dir}/${skill.name}/SKILL.md`;
      writeFileAtomic(join(ctx.cwd, ...relative.split("/")), bridgeContent(ctx, slug, skill));
      written.push(relative);
      if (wantsOpenai && dir === ".agents/skills") {
        const yamlPath = `${dir}/${skill.name}/agents/openai.yaml`;
        writeFileAtomic(join(ctx.cwd, ...yamlPath.split("/")), openaiYaml(skill));
        written.push(yamlPath);
      }
    }
  }
  return written;
}

export function removeBridges(ctx: Context, paths: string[]): void {
  for (const relative of paths) {
    const absolute = join(ctx.cwd, ...relative.split("/"));
    rmSync(absolute, { force: true });
    // The skill folder (and `agents/` under it) goes only when nothing else is inside.
    for (const parent of [dirname(absolute), dirname(dirname(absolute))]) {
      try {
        rmdirSync(parent);
      } catch {
        // not empty, or already gone
      }
    }
  }
}

/**
 * The core's own skills (the `/flyee` menu, `texto-natural`…) in both skill
 * directories, each with every file of its folder, a LICENSE included.
 */
export function writeCoreSkills(ctx: Context, assets: CoreAssets): string[] {
  const written: string[] = [];
  for (const skill of assets.coreSkills(ctx.locale)) {
    for (const dir of assets.tools.always.skillDirs) {
      for (const [file, content] of Object.entries(skill.files)) {
        const relative = `${dir}/${skill.name}/${file}`;
        writeFileAtomic(join(ctx.cwd, ...relative.split("/")), content);
        written.push(relative);
      }
    }
  }
  return written;
}

export function renderAgentsBlock(ctx: Context, assets: CoreAssets, lock: Lock): string {
  const template = assets.agentsTemplate(ctx.locale);
  const entries = Object.entries(lock.modules).sort(([a], [b]) => a.localeCompare(b));
  const apps = entries.length
    ? entries
        .map(([slug, module]) => {
          const skills = module.skills.length ? module.skills.join(", ") : "—";
          const guide = `.flyee/modules/${slug}/README.md`;
          return ctx.locale === "en"
            ? `- **${module.title}** (\`${slug}\` ${module.version}): ${module.summary} Skills: ${skills}. Guide: \`${guide}\``
            : `- **${module.title}** (\`${slug}\` ${module.version}): ${module.summary} Skills: ${skills}. Guia: \`${guide}\``;
        })
        .join("\n")
    : ctx.locale === "en"
      ? "_No app installed yet. `npx flyee add <app>` installs one._"
      : "_Nenhum app instalado ainda. `npx flyee add <app>` instala um._";
  return template
    .replace("{{apps}}", apps)
    .replace("{{core_version}}", assets.core.version)
    .replace("{{site}}", ctx.baseUrl);
}

export type AdapterReport = { written: string[]; unchanged: string[]; detected: DetectedTool[] };

/**
 * Writes everything that is not an app: the AGENTS.md block, the pointers, the
 * `/flyee` skill, and whole blocks for detected tools that only read their own
 * file. Idempotent; never touches a line the member wrote.
 */
export function applyAdapters(ctx: Context, assets: CoreAssets, lock: Lock): AdapterReport {
  const markers = assets.core.markers;
  const written: string[] = [];
  const unchanged: string[] = [];
  const record = (relative: string, result: BlockResult) => (result === "unchanged" ? unchanged : written).push(relative);
  const block = renderAgentsBlock(ctx, assets, lock);
  const canonical = assets.tools.always.canonical;
  record(canonical, upsertManagedBlock(join(ctx.cwd, canonical), block, markers));

  const detected = detectTools(ctx, assets.tools.tools);
  const note = ctx.locale === "en" ? "<!-- flyee: imports the canonical AGENTS.md -->" : "<!-- flyee: importa o AGENTS.md canônico -->";
  for (const tool of assets.tools.tools) {
    const instructions = tool.instructions;
    if (instructions.mode === "pointer" && instructions.file && instructions.pointer) {
      record(instructions.file, ensurePointer(join(ctx.cwd, instructions.file), instructions.pointer, markers, note));
    } else if (instructions.mode === "block" && instructions.file) {
      const isDetected = detected.find((candidate) => candidate.id === tool.id)?.detected;
      if (isDetected || existsSync(join(ctx.cwd, instructions.file))) {
        record(instructions.file, upsertManagedBlock(join(ctx.cwd, instructions.file), block, markers));
      }
    }
  }
  for (const relative of writeCoreSkills(ctx, assets)) written.push(relative);

  const managed = new Set(lock.managed_files);
  for (const path of [...written, ...unchanged]) managed.add(path);
  lock.managed_files = [...managed].sort();
  ensureDir(join(ctx.cwd, ".flyee"));
  return { written, unchanged, detected };
}
