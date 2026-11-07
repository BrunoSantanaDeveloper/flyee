import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";

import { parseFrontmatter } from "../src/frontmatter.ts";
import { repoRoot } from "../src/paths.ts";
import {
  bridgeFrontmatter,
  bridgeMark,
  claudeSkillsDir,
  type InstalledApp,
  linkUserBridges,
  markerLine,
  planUserLink,
  planUserUnlink,
  unlinkUserBridges,
  userAppsDir,
  userBridge,
} from "../src/user-apps.ts";

let sandbox: string;

before(() => {
  sandbox = mkdtempSync(join(tmpdir(), "flyee-user-apps-"));
});
after(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

/** A canonical skill with what a bridge copies (a folded description, allowed-tools) and what it leaves out (metadata). */
const ALPHA = [
  "---",
  "name: alpha",
  "description: >",
  "  Faz a primeira coisa: descreve o pedido",
  "  em duas linhas.",
  "metadata:",
  "  owner: flyee",
  "allowed-tools: Read, Bash",
  "---",
  "",
  "# Alpha",
  "",
  "Rode `node ../../scripts/alpha.mjs` a partir desta pasta.",
  "",
].join("\n");

const skill = (name: string, description = `Faz ${name}.`) => `---\nname: ${name}\ndescription: "${description}"\n---\n\n# ${name}\n`;

/** Installs an app into the user folder the way `dev link` leaves it: the whole app folder replaced. */
function install(userDir: string, slug: string, version: string, skills: Record<string, string>): void {
  const dir = join(userDir, ".flyee", "modules", slug);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "flyee.module.json"), JSON.stringify({ name: slug, version }));
  for (const [folder, source] of Object.entries(skills)) {
    mkdirSync(join(dir, "skills", folder), { recursive: true });
    writeFileSync(join(dir, "skills", folder, "SKILL.md"), source);
  }
}

function put(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

/** Every file under a folder with its bytes, to tell "left as it was" from "rewritten the same". */
function snapshot(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const name of readdirSync(dir, { recursive: true, encoding: "utf8" }).sort()) {
    const path = join(dir, name);
    try {
      files[name] = readFileSync(path).toString("base64");
    } catch {
      files[name] = "<dir>";
    }
  }
  return files;
}

const OWN_SKILL = "---\nname: beta\ndescription: A skill the operator wrote by hand.\n---\n\nMine.\r\n";

describe("the places of an install for the user", () => {
  it("are the user's own folders, or the ones FLYEE_USER_APPS and CLAUDE_CONFIG_DIR name", () => {
    const home = join(sandbox, "home");
    assert.equal(claudeSkillsDir({}, home), join(home, ".claude", "skills"));
    assert.equal(claudeSkillsDir({ CLAUDE_CONFIG_DIR: `  ${join(sandbox, "claude")}  ` }, home), join(sandbox, "claude", "skills"));
    assert.equal(userAppsDir({}, home), join(home, ".flyee", "user-apps"));
    assert.equal(existsSync(join(home, ".flyee", "user-apps")), true, "created when missing");
    assert.equal(userAppsDir({ FLYEE_USER_APPS: ` ${join(sandbox, "apps")} ` }, home), join(sandbox, "apps"));
    assert.equal(existsSync(join(sandbox, "apps")), true);
  });

  it("never put the packages inside this repository, nor in a folder that holds it or the home folder", () => {
    const home = join(sandbox, "home");
    const inside = join(repoRoot, "tmp-user-apps-never-created");
    assert.throws(() => userAppsDir({ FLYEE_USER_APPS: inside }, home), /inside the product repository/);
    assert.equal(existsSync(inside), false, "refused before anything is created");
    assert.throws(() => userAppsDir({ FLYEE_USER_APPS: dirname(repoRoot) }, home), /holds this repository/);
    assert.throws(() => userAppsDir({ FLYEE_USER_APPS: home }, home), /holds the home folder/);
  });
});

describe("the bridge of a skill installed for the user", () => {
  const userDir = join(sandbox, "Pasta do usuario", "apps");
  const abs = userDir.replace(/\\/g, "/");
  const bridge = () =>
    userBridge({ slug: "alpha", version: "1.2.0", skill: "alpha", folder: "alpha", frontmatter: bridgeFrontmatter(ALPHA)!, userDir, repo: join(sandbox, "repo") });

  it("carries the canonical frontmatter as written, then the mark", () => {
    assert.equal(bridgeFrontmatter(ALPHA), "name: alpha\ndescription: >\n  Faz a primeira coisa: descreve o pedido\n  em duas linhas.\nallowed-tools: Read, Bash");
    assert.ok(bridge().startsWith(`---\n${bridgeFrontmatter(ALPHA)}\n---\n<!-- flyee:user-link alpha@1.2.0 -->\n`));
    assert.equal(bridge().includes("metadata"), false);
    const parsed = parseFrontmatter(bridge())!;
    const canonical = parseFrontmatter(ALPHA)!;
    assert.equal(parsed.data.name, canonical.data.name);
    assert.equal(parsed.data.description, canonical.data.description);
    assert.equal(bridgeFrontmatter(skill("x", 'Usa \\"aspas\\" e dois-pontos: assim.')), 'name: x\ndescription: "Usa \\"aspas\\" e dois-pontos: assim."');
    assert.equal(bridgeFrontmatter("---\nname: x\n---\n"), null, "no description, no bridge");
  });

  it("points at the package by absolute paths and keeps what the app writes in the open project", () => {
    const text = bridge();
    assert.ok(text.includes(`installed for this user at \`${abs}/.flyee/modules/alpha/\``));
    assert.ok(text.includes(`Read \`${abs}/.flyee/modules/alpha/skills/alpha/SKILL.md\``));
    assert.ok(text.includes(`Wherever it says \`.flyee/modules/<app>/\`, use \`${abs}/.flyee/modules/<app>/\``));
    assert.ok(text.includes(`such as \`texto-natural\`, are in \`${abs}/.claude/skills/\``), "the core skills the apps call");
    assert.ok(text.includes(`relative references resolve from \`${abs}/.flyee/modules/alpha/skills/alpha/\``));
    assert.ok(text.includes(`everything the app writes goes to that project, never to \`${abs}/\``));
    assert.ok(/^[A-Za-z]:\/|^\//.test(abs), "absolute");
    assert.equal(text.includes("\\"), false, "forward slashes only");
  });

  it("is told from someone's own skill by the mark right after the frontmatter", () => {
    assert.deepEqual(bridgeMark(bridge()), { slug: "alpha", version: "1.2.0" });
    assert.deepEqual(bridgeMark(bridge().replace(/\n/g, "\r\n")), { slug: "alpha", version: "1.2.0" });
    assert.equal(bridgeMark(OWN_SKILL), null);
    assert.equal(bridgeMark(`---\nname: notas\ndescription: x\n---\n\nO marcador:\n${markerLine("alpha", "1.0.0")}\n`), null, "quoting the mark is not carrying it");
    assert.equal(bridgeMark(`${markerLine("alpha", "1.0.0")}\n`), null);
    assert.equal(bridgeMark(null), null);
  });
});

describe("link --user", () => {
  const userDir = () => join(sandbox, "link", "apps");
  const skillsDir = () => join(sandbox, "link", "claude", "skills");

  before(() => {
    install(userDir(), "alpha", "1.2.0", { alpha: ALPHA, "alpha-extra": skill("alpha-extra") });
    install(userDir(), "beta", "2.0.0", { beta: skill("beta") });
    const old = (name: string, slug: string, version: string) => `---\nname: ${name}\ndescription: x\n---\n${markerLine(slug, version)}\n\nold\n`;
    put(join(skillsDir(), "alpha", "SKILL.md"), old("alpha", "alpha", "1.1.0"));
    put(join(skillsDir(), "alpha-old", "SKILL.md"), old("alpha-old", "alpha", "1.1.0"));
    put(join(skillsDir(), "gamma", "SKILL.md"), old("gamma", "gamma", "1.0.0"));
    put(join(skillsDir(), "beta", "SKILL.md"), OWN_SKILL);
    put(join(skillsDir(), "beta", "notas.txt"), "minhas notas");
  });

  it("writes a bridge per skill, rewrites marked ones, refuses an unmarked folder and leaves it byte for byte", () => {
    const own = snapshot(join(skillsDir(), "beta"));
    const gamma = snapshot(join(skillsDir(), "gamma"));
    const result = linkUserBridges(userDir(), skillsDir());

    assert.deepEqual(
      result.bridges.map((bridge) => [bridge.skill, bridge.slug, bridge.version, bridge.state]),
      [
        ["alpha", "alpha", "1.2.0", "updated"],
        ["alpha-extra", "alpha", "1.2.0", "created"],
      ],
    );
    assert.deepEqual(
      result.refused.map((refusal) => [refusal.code, refusal.skill, refusal.slug]),
      [["user_skill_exists", "beta", "beta"]],
    );
    assert.deepEqual(snapshot(join(skillsDir(), "beta")), own, "the operator's own skill is untouched");
    assert.deepEqual(snapshot(join(skillsDir(), "gamma")), gamma, "a bridge of an app not installed here is not this link's");

    const alpha = readFileSync(join(skillsDir(), "alpha", "SKILL.md"), "utf8");
    assert.deepEqual(bridgeMark(alpha), { slug: "alpha", version: "1.2.0" });
    assert.ok(alpha.includes(`${userDir().replace(/\\/g, "/")}/.flyee/modules/alpha/skills/alpha/SKILL.md`));
    assert.deepEqual(bridgeMark(readFileSync(join(skillsDir(), "alpha-extra", "SKILL.md"), "utf8")), { slug: "alpha", version: "1.2.0" });

    assert.deepEqual(
      result.removed.map((bridge) => [bridge.skill, bridge.slug, bridge.removed, bridge.left]),
      [["alpha-old", "alpha", true, []]],
      "alpha 1.2.0 no longer has the skill its old bridge pointed at",
    );
    assert.equal(existsSync(join(skillsDir(), "alpha-old")), false);
  });

  it("changes nothing the second time", () => {
    const was = snapshot(skillsDir());
    const result = linkUserBridges(userDir(), skillsDir());
    assert.deepEqual(result.bridges.map((bridge) => bridge.state), ["unchanged", "unchanged"]);
    assert.deepEqual(result.refused.map((refusal) => refusal.code), ["user_skill_exists"]);
    assert.deepEqual(result.removed, []);
    assert.deepEqual(snapshot(skillsDir()), was);
  });

  it("is undone by unlink --user only where the folder carries that app's mark", () => {
    put(join(skillsDir(), "alpha-extra", "rascunho.md"), "something the operator dropped here");
    const own = snapshot(join(skillsDir(), "beta"));
    const gamma = snapshot(join(skillsDir(), "gamma"));

    assert.deepEqual(unlinkUserBridges(["beta"], skillsDir()), [], "beta's folder has no mark: nothing to take away");
    const removed = unlinkUserBridges(["alpha"], skillsDir());
    assert.deepEqual(
      removed.map((bridge) => [bridge.skill, bridge.removed, bridge.left]),
      [
        ["alpha", true, []],
        ["alpha-extra", true, ["rascunho.md"]],
      ],
    );
    assert.equal(existsSync(join(skillsDir(), "alpha")), false);
    assert.deepEqual(readdirSync(join(skillsDir(), "alpha-extra")), ["rascunho.md"], "only the bridge goes; what flyee did not write stays");
    assert.deepEqual(snapshot(join(skillsDir(), "beta")), own);
    assert.deepEqual(snapshot(join(skillsDir(), "gamma")), gamma);
  });
});

describe("the plan of link --user", () => {
  const places = { userDir: join(sandbox, "plan", "apps"), skillsDir: join(sandbox, "plan", "skills"), repo: join(sandbox, "repo") };
  const app = (slug: string, skills: Record<string, string>): InstalledApp => ({
    slug,
    version: "1.0.0",
    skills: Object.entries(skills).map(([folder, source]) => ({ folder, source })),
  });

  it("gives a skill name to the first app by slug, and refuses the other", () => {
    const plan = planUserLink([app("zeta", { shared: skill("shared") }), app("eta", { shared: skill("shared") })], new Map(), places);
    assert.deepEqual(plan.writes.map((write) => [write.skill, write.slug, write.state]), [["shared", "eta", "created"]]);
    assert.deepEqual(plan.refused.map((refusal) => [refusal.code, refusal.slug]), [["skill_name_clash", "zeta"]]);
  });

  it("refuses a folder with no SKILL.md, or the same name in other case, as someone's own", () => {
    const listing = new Map<string, string | null>([
      ["Shared", OWN_SKILL],
      ["vazia", null],
    ]);
    const plan = planUserLink([app("eta", { shared: skill("shared"), vazia: skill("vazia") })], listing, places);
    assert.deepEqual(plan.writes, []);
    assert.deepEqual(plan.refused.map((refusal) => [refusal.code, refusal.skill]), [
      ["user_skill_exists", "shared"],
      ["user_skill_exists", "vazia"],
    ]);
  });

  it("writes no bridge for a skill without a name and a description, and keeps its old bridge", () => {
    const listing = new Map<string, string | null>([["quebrada", `---\nname: quebrada\ndescription: x\n---\n${markerLine("eta", "0.9.0")}\n`]]);
    const plan = planUserLink([app("eta", { quebrada: "---\nname: quebrada\n---\n" })], listing, places);
    assert.deepEqual(plan.refused.map((refusal) => [refusal.code, refusal.skill]), [["skill_invalid", "quebrada"]]);
    assert.deepEqual(plan.writes, []);
    assert.deepEqual(plan.removals, []);
  });

  it("takes away, on unlink, only the bridges marked for the apps named", () => {
    const listing = new Map<string, string | null>([
      ["a", `---\nname: a\ndescription: x\n---\n${markerLine("eta", "1.0.0")}\n`],
      ["b", `---\nname: b\ndescription: x\n---\n${markerLine("zeta", "1.0.0")}\n`],
      ["c", OWN_SKILL],
      ["d", null],
    ]);
    assert.deepEqual(planUserUnlink(["eta"], listing, places.skillsDir).map((removal) => [removal.skill, removal.slug, removal.dir]), [
      ["a", "eta", join(places.skillsDir, "a")],
    ]);
  });
});
