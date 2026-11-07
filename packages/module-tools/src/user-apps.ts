import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { parseFrontmatter } from "./frontmatter.ts";
import { repoRoot } from "./paths.ts";
import { isInsideRepo } from "./workspace.ts";

/**
 * The operator's apps installed once for the user (docs/PLANO-PAGINAS.md, D1),
 * so they work in any code repository without installing anything inside it: a
 * code repository has a generated AGENTS.md of its own, which the member's
 * harness would fight with. The packages go through the CLI's `dev link` into a
 * member-like folder outside every repository, and each skill gets a bridge in
 * Claude Code's personal skills folder, which every session loads.
 *
 * A bridge carries `<!-- flyee:user-link <slug>@<version> -->` on the line right
 * after its frontmatter. A folder of the skills folder without that mark is the
 * user's own work: never overwritten, never deleted (invariant 4).
 */

type Env = Record<string, string | undefined>;

/** `path` is `parent` or inside it. */
function within(path: string, parent: string): boolean {
  const rel = relative(resolve(parent), resolve(path));
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

/** The member-like folder that holds the apps installed for the user: `FLYEE_USER_APPS`, or `~/.flyee/user-apps`. Created when missing. */
export function userAppsDir(env: Env = process.env, home: string = homedir()): string {
  const path = resolve(env.FLYEE_USER_APPS?.trim() || join(home, ".flyee", "user-apps"));
  if (isInsideRepo(path)) throw new Error(`the user apps folder ${path} is inside the product repository; set FLYEE_USER_APPS to a folder outside it`);
  // `dev link` writes AGENTS.md and CLAUDE.md into the folder, and Claude Code reads CLAUDE.md from every folder above a session's.
  for (const [what, inner] of [["this repository", repoRoot], ["the home folder", home]]) {
    if (within(inner, path)) {
      throw new Error(`the user apps folder ${path} holds ${what}: dev link writes AGENTS.md and CLAUDE.md into it, and Claude Code reads CLAUDE.md from every folder above a session's. Set FLYEE_USER_APPS to a folder of its own (by default ~/.flyee/user-apps)`);
    }
  }
  mkdirSync(path, { recursive: true });
  return path;
}

/** Claude Code's personal skills folder: `$CLAUDE_CONFIG_DIR/skills`, or `~/.claude/skills`. */
export function claudeSkillsDir(env: Env = process.env, home: string = homedir()): string {
  const config = env.CLAUDE_CONFIG_DIR?.trim();
  return config ? resolve(config, "skills") : resolve(home, ".claude", "skills");
}

const MARKER = /^<!-- flyee:user-link ([a-z0-9][a-z0-9-]*)@(\S*) -->$/;

export function markerLine(slug: string, version: string): string {
  return `<!-- flyee:user-link ${slug}@${version} -->`;
}

/** The app a bridge belongs to, from the mark on the line right after its frontmatter; null for anything else. */
export function bridgeMark(content: string | null | undefined): { slug: string; version: string } | null {
  if (content == null) return null;
  const text = content.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---", 4);
  const next = end < 0 ? -1 : text.indexOf("\n", end + 4);
  if (next < 0) return null;
  const match = MARKER.exec(text.slice(next + 1).split("\n", 1)[0].trimEnd());
  return match ? { slug: match[1], version: match[2] } : null;
}

/** The frontmatter keys a bridge carries: the ones the CLI's project bridges carry (packages/cli/src/install/adapters.ts). */
const BRIDGE_KEYS = ["name", "description", "license", "compatibility", "allowed-tools", "disable-model-invocation"];

/**
 * The lines of the keys a bridge carries, copied as the canonical SKILL.md
 * writes them (quotes and block scalars included); null without a name and a
 * description.
 */
export function bridgeFrontmatter(source: string): string | null {
  const parsed = parseFrontmatter(source);
  if (!parsed?.data.name?.trim() || !parsed.data.description?.trim()) return null;
  const text = source.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const kept: string[] = [];
  let keep = false;
  for (const line of text.slice(4, text.indexOf("\n---", 4)).split("\n")) {
    // A key starts at column 0; indented, blank and list lines belong to the key above.
    const key = /^([A-Za-z0-9_-]+):/.exec(line);
    if (key) keep = BRIDGE_KEYS.includes(key[1]);
    if (keep) kept.push(line);
  }
  while (kept.length && !kept[kept.length - 1].trim()) kept.pop();
  return kept.join("\n");
}

const posix = (path: string) => path.replace(/\\/g, "/").replace(/\/+$/, "");

export type BridgeInput = {
  slug: string;
  version: string;
  /** The skill's name, which is also the bridge's folder. */
  skill: string;
  /** The skill's folder inside the package (`skills/<folder>/SKILL.md`). */
  folder: string;
  /** From `bridgeFrontmatter`. */
  frontmatter: string;
  userDir: string;
  /** The product repository, where `apps link --user` runs. */
  repo?: string;
};

/**
 * The bridge Claude Code loads in every session: the canonical frontmatter, the
 * mark, and absolute paths, because the session runs in a project that has no
 * `.flyee/` of its own. Forward slashes work in every shell and tool on Windows.
 */
export function userBridge(input: BridgeInput): string {
  const root = posix(input.userDir);
  const modules = `${root}/.flyee/modules`;
  const app = `${modules}/${input.slug}`;
  const folder = `${app}/skills/${input.folder}`;
  const repo = posix(input.repo ?? repoRoot);
  return [
    "---",
    input.frontmatter,
    "---",
    markerLine(input.slug, input.version),
    `<!-- flyee: generated bridge. Do not edit; \`npm run apps -- link ${input.slug} --user\` in ${repo} rewrites it and \`unlink ${input.slug} --user\` removes it. -->`,
    "",
    `# Skill \`${input.skill}\` of the flyee app \`${input.slug}\``,
    "",
    `This skill belongs to the flyee app \`${input.slug}\` ${input.version}, installed for this user at \`${app}/\`, outside every project.`,
    "",
    `1. Read \`${folder}/SKILL.md\` completely before acting and follow it as the source.`,
    `2. Wherever it says \`.flyee/modules/<app>/\`, use \`${modules}/<app>/\`. The apps it calls are installed there too, and the skills that come with flyee, such as \`texto-natural\`, are in \`${root}/.claude/skills/\`.`,
    `3. Its relative references resolve from \`${folder}/\`.`,
    `4. Run its commands from the root of the project open in this session: everything the app writes goes to that project, never to \`${root}/\`.`,
    `5. Never run \`npx --yes flyee@latest add\`, \`update\`, \`remove\`, \`new\` or \`login\` in this project: they write flyee's own files into the folder they run in. When the skill asks to install or update an app, run \`npm run apps -- link <app> --user\` in \`${repo}\` instead. \`need\` and \`key set\` act on the machine and can run from here.`,
    "",
  ].join("\n");
}

export type InstalledSkill = { folder: string; source: string };
export type InstalledApp = { slug: string; version: string; skills: InstalledSkill[] };

/** Every app under `<userDir>/.flyee/modules/`, with the SKILL.md of each of its skills, by slug. */
export function readInstalledApps(userDir: string): InstalledApp[] {
  const root = join(userDir, ".flyee", "modules");
  if (!existsSync(root)) return [];
  const apps: InstalledApp[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    // `.tmp-<slug>-…` is an install the CLI has not swapped into place yet.
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const dir = join(root, entry.name);
    let manifest: { version?: unknown };
    try {
      manifest = JSON.parse(readFileSync(join(dir, "flyee.module.json"), "utf8").replace(/^﻿/, "")) as { version?: unknown };
    } catch {
      continue;
    }
    const skills: InstalledSkill[] = [];
    const skillsRoot = join(dir, "skills");
    const folders = existsSync(skillsRoot) ? readdirSync(skillsRoot, { withFileTypes: true }).filter((skill) => skill.isDirectory()) : [];
    for (const skill of folders) {
      try {
        skills.push({ folder: skill.name, source: readFileSync(join(skillsRoot, skill.name, "SKILL.md"), "utf8") });
      } catch {
        // a folder without SKILL.md is not a skill
      }
    }
    apps.push({ slug: entry.name, version: typeof manifest.version === "string" ? manifest.version : "", skills });
  }
  return apps.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** The Claude Code skills folder as found: each entry with its SKILL.md, or null when it has none. */
export type SkillsListing = Map<string, string | null>;

export function listSkills(skillsDir: string): SkillsListing {
  const listing: SkillsListing = new Map();
  let entries: string[];
  try {
    entries = readdirSync(skillsDir);
  } catch {
    return listing;
  }
  for (const entry of entries.sort()) {
    let content: string | null = null;
    try {
      content = readFileSync(join(skillsDir, entry, "SKILL.md"), "utf8");
    } catch {
      // a file, or a folder without SKILL.md
    }
    listing.set(entry, content);
  }
  return listing;
}

export type BridgeWrite = { skill: string; slug: string; version: string; dir: string; content: string; state: "created" | "updated" | "unchanged" };
export type BridgeRemoval = { skill: string; slug: string; version: string; dir: string };
export type BridgeRefusal = { code: "user_skill_exists" | "skill_name_clash" | "skill_invalid"; skill: string; slug: string; dir: string; message: string };
export type UserLinkPlan = { writes: BridgeWrite[]; removals: BridgeRemoval[]; refused: BridgeRefusal[] };

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * What linking for the user does to the skills folder, decided from what is
 * installed and what is there, before anything is written:
 * - a bridge per skill of every installed app, created, or rewritten when the
 *   folder already carries the mark;
 * - `user_skill_exists` for a folder without the mark, which stays as it is
 *   (on Windows and macOS `Foo` is the folder `foo`, so the match ignores case);
 * - `skill_name_clash` when two apps have a skill of the same name: the first
 *   by slug keeps the bridge;
 * - the removal of a bridge whose app is installed but no longer has the skill.
 */
export function planUserLink(apps: InstalledApp[], listing: SkillsListing, places: { userDir: string; skillsDir: string; repo?: string }): UserLinkPlan {
  const plan: UserLinkPlan = { writes: [], removals: [], refused: [] };
  const owners = new Map<string, string>();
  const seen = new Set<string>();
  for (const app of [...apps].sort((a, b) => a.slug.localeCompare(b.slug))) {
    for (const skill of [...app.skills].sort((a, b) => a.folder.localeCompare(b.folder))) {
      const name = parseFrontmatter(skill.source)?.data.name?.trim() || skill.folder;
      seen.add(name.toLowerCase()).add(skill.folder.toLowerCase());
      const frontmatter = bridgeFrontmatter(skill.source);
      const dir = join(places.skillsDir, name);
      if (!frontmatter || !SKILL_NAME.test(name) || name.length > 64) {
        plan.refused.push({
          code: "skill_invalid",
          skill: name,
          slug: app.slug,
          dir,
          message: `skills/${skill.folder}/SKILL.md of ${app.slug} needs a frontmatter with a name and a description, and a name of lowercase letters, digits and single hyphens (up to 64): no bridge`,
        });
        continue;
      }
      const owner = owners.get(name);
      if (owner) {
        plan.refused.push({ code: "skill_name_clash", skill: name, slug: app.slug, dir, message: `${owner} has a skill named ${name} too; the bridge stays with ${owner}` });
        continue;
      }
      owners.set(name, app.slug);
      const found = [...listing].filter(([entry]) => entry.toLowerCase() === name);
      if (found.some(([, current]) => !bridgeMark(current))) {
        plan.refused.push({
          code: "user_skill_exists",
          skill: name,
          slug: app.slug,
          dir: join(places.skillsDir, found[0][0]),
          message: `${join(places.skillsDir, found[0][0])} has no flyee:user-link mark, so it is someone's own skill and stays as it is; the skill ${name} of the app ${app.slug} gets no bridge while that folder is there`,
        });
        continue;
      }
      const content = userBridge({ slug: app.slug, version: app.version, skill: name, folder: skill.folder, frontmatter, userDir: places.userDir, repo: places.repo });
      const current = listing.get(name) ?? found[0]?.[1];
      const state = found.length === 0 ? "created" : current === content ? "unchanged" : "updated";
      plan.writes.push({ skill: name, slug: app.slug, version: app.version, dir, content, state });
    }
  }
  const installed = new Set(apps.map((app) => app.slug));
  for (const [entry, content] of listing) {
    const mark = bridgeMark(content);
    if (mark && installed.has(mark.slug) && !seen.has(entry.toLowerCase())) {
      plan.removals.push({ skill: entry, slug: mark.slug, version: mark.version, dir: join(places.skillsDir, entry) });
    }
  }
  return plan;
}

/** The bridges `unlink --user` takes away: only the folders marked for one of these apps. */
export function planUserUnlink(slugs: string[], listing: SkillsListing, skillsDir: string): BridgeRemoval[] {
  const removals: BridgeRemoval[] = [];
  for (const [entry, content] of listing) {
    const mark = bridgeMark(content);
    if (mark && slugs.includes(mark.slug)) removals.push({ skill: entry, slug: mark.slug, version: mark.version, dir: join(skillsDir, entry) });
  }
  return removals;
}

export type RemovedBridge = BridgeRemoval & { removed: boolean; left: string[] };

/**
 * Takes a bridge away: its SKILL.md, after reading the mark again, then the
 * folder when nothing else is inside. Whatever else is there stays and is named.
 */
function removeBridge(removal: BridgeRemoval): RemovedBridge {
  const file = join(removal.dir, "SKILL.md");
  let current: string | null = null;
  try {
    current = readFileSync(file, "utf8");
  } catch {
    // gone already
  }
  if (bridgeMark(current)?.slug !== removal.slug) return { ...removal, removed: false, left: [] };
  rmSync(file, { force: true });
  try {
    rmdirSync(removal.dir);
    return { ...removal, removed: true, left: [] };
  } catch {
    return { ...removal, removed: true, left: existsSync(removal.dir) ? readdirSync(removal.dir).sort() : [] };
  }
}

export type UserLinkResult = { bridges: Omit<BridgeWrite, "content">[]; removed: RemovedBridge[]; refused: BridgeRefusal[] };

/** Writes the bridges of every app installed in the user folder, after `dev link` put them there. */
export function linkUserBridges(userDir: string, skillsDir: string, repo: string = repoRoot): UserLinkResult {
  const plan = planUserLink(readInstalledApps(userDir), listSkills(skillsDir), { userDir, skillsDir, repo });
  for (const write of plan.writes) {
    if (write.state === "unchanged") continue;
    mkdirSync(write.dir, { recursive: true });
    writeFileSync(join(write.dir, "SKILL.md"), write.content);
  }
  return {
    bridges: plan.writes.map(({ content: _content, ...write }) => write),
    removed: plan.removals.map(removeBridge),
    refused: plan.refused,
  };
}

/** Takes away the bridges marked for these apps; `remove` in the user folder takes the packages. */
export function unlinkUserBridges(slugs: string[], skillsDir: string): RemovedBridge[] {
  return planUserUnlink(slugs, listSkills(skillsDir), skillsDir).map(removeBridge);
}

/** The console's lines for what happened to the bridges. */
export function bridgeLines(result: { bridges?: UserLinkResult["bridges"]; removed: RemovedBridge[]; refused?: BridgeRefusal[] }): string[] {
  return [
    ...(result.bridges ?? []).map((bridge) => `OK   bridge ${bridge.skill} (${bridge.slug} ${bridge.version}): ${bridge.state}`),
    ...result.removed.map((bridge) =>
      bridge.removed
        ? `OK   bridge ${bridge.skill} (${bridge.slug} ${bridge.version}): removed${bridge.left.length ? `; the folder keeps ${bridge.left.join(", ")}, which flyee did not write` : ""}`
        : `SKIP bridge ${bridge.skill}: it no longer carries the mark of ${bridge.slug}`,
    ),
    ...(result.refused ?? []).map((refusal) => `FAIL bridge ${refusal.skill} (${refusal.slug}): ${refusal.code}, ${refusal.message}`),
  ];
}
