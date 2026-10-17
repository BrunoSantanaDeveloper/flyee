import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { CliError } from "../src/api/errors.ts";
import { projectFolder, projectsHome } from "../src/commands/new.ts";
import { type Context, createContext } from "../src/context.ts";
import { parseArgs, runCommand } from "../src/main.ts";
import { type Lock, readLock } from "../src/state/lock.ts";
import { readProjects, samePath } from "../src/state/projects.ts";
import { buildModuleZip, type FakePlatform, startFakePlatform } from "./fake-platform.ts";

let sandbox: string;
let platform: FakePlatform;
let output: string[] = [];

function makeContext(overrides: Partial<Parameters<typeof createContext>[0]> = {}): Context {
  return createContext({
    baseUrl: platform.baseUrl,
    homeDir: join(sandbox, "home"),
    cwd: join(sandbox, "marca-a"),
    yes: true,
    locale: "pt-BR",
    env: { PATH: "" },
    io: { out: (line) => output.push(line), err: (line) => output.push(line), confirm: async () => true, openBrowser: async () => true },
    ...overrides,
  });
}

async function run(ctx: Context, argv: string[]) {
  output = [];
  return runCommand(ctx, parseArgs(argv));
}

const lockAt = (folder: string) => JSON.parse(readFileSync(join(sandbox, folder, ".flyee", "lock.json"), "utf8")) as Lock;
const statuses = (result: Record<string, unknown>) => Object.fromEntries((result.apps as { slug: string; status: string }[]).map((app) => [app.slug, app.status]));

before(async () => {
  sandbox = mkdtempSync(join(tmpdir(), "flyee-projects-"));
  // marca-a is a code repository: a project made from it goes beside it, never inside.
  mkdirSync(join(sandbox, "marca-a", ".git"), { recursive: true });
  const takes = buildModuleZip({ slug: "takes", version: "1.0.0", permissions: [{ kind: "network", scope: "api.exemplo.com", reason: { "pt-BR": "Busca os dados." } }] });
  platform = await startFakePlatform({
    tier: "kit",
    modules: [
      { slug: "radar", trail: "divulgar", type: "skill", name: "Radar", summary: "Mostra o que funciona.", entitled: true, versions: [buildModuleZip({ slug: "radar", version: "1.0.0" })] },
      { slug: "copy-lp", trail: "vender", type: "skill", name: "Copy LP", summary: "Copy.", entitled: true, versions: [buildModuleZip({ slug: "copy-lp", version: "1.0.0" })] },
      { slug: "takes", trail: "divulgar", type: "skill", name: "Takes", summary: "Takes.", entitled: true, versions: [takes] },
    ],
    recipes: [],
  });
  const ctx = makeContext();
  assert.equal((await run(ctx, ["login", "--device", "--name", "notebook"])).ok, true);
  assert.equal((await run(ctx, ["add", "radar"])).ok, true);
  assert.equal((await run(ctx, ["add", "copy-lp"])).ok, true);
});

after(async () => {
  await platform.close();
  rmSync(sandbox, { recursive: true, force: true });
});

describe("one project per brand or client", () => {
  it("puts a project beside a code repository, and keeps a path as written", () => {
    const home = projectsHome(join(sandbox, "marca-a"), readLock(makeContext()), join(sandbox, "home", ".flyee"));
    assert.equal(home, sandbox, "marca-a is a repository: never filled with brands");
    assert.equal(projectFolder(join(sandbox, "marca-a"), "cliente-x", home), join(sandbox, "cliente-x"));
    assert.equal(projectFolder(join(sandbox, "marca-a"), "../outros/cliente-x", home), join(sandbox, "outros", "cliente-x"));
    assert.equal(projectFolder(join(sandbox, "marca-a"), join(sandbox, "longe"), home), join(sandbox, "longe"));
  });

  it("creates another project with the same apps, through the platform's gates, and leaves this one alone", async () => {
    const before = readFileSync(join(sandbox, "marca-a", ".flyee", "lock.json"), "utf8");
    const downloads = platform.state.downloads.length;
    const result = await run(makeContext(), ["new", "cliente-x", "--kind", "client"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.path, join(sandbox, "cliente-x"));
    assert.equal(result.created, true);
    assert.deepEqual(statuses(result), { radar: "installed", "copy-lp": "installed" });
    const lock = lockAt("cliente-x");
    assert.deepEqual(Object.keys(lock.modules).sort(), ["copy-lp", "radar"]);
    assert.equal(lock.project_kind, "client");
    assert.ok(existsSync(join(sandbox, "cliente-x", ".flyee", "modules", "radar", "skills", "radar", "SKILL.md")));
    assert.ok(existsSync(join(sandbox, "cliente-x", ".claude", "skills", "radar", "SKILL.md")));
    assert.ok(existsSync(join(sandbox, "cliente-x", ".agents", "skills", "flyee", "SKILL.md")), "the new project has the menu skill");
    assert.ok(readFileSync(join(sandbox, "cliente-x", "AGENTS.md"), "utf8").includes("`radar` 1.0.0"));
    assert.equal(readFileSync(join(sandbox, "marca-a", ".flyee", "lock.json"), "utf8"), before, "the project it came from is untouched");
    assert.equal(platform.state.downloads.length, downloads + 2, "each app was downloaded and verified again");
    assert.ok(readProjects(makeContext()).some((project) => samePath(project.path, join(sandbox, "cliente-x"))));
    const last = platform.state.installs[platform.state.installs.length - 1] as { project_kind?: string; installed_modules: { slug: string }[] };
    assert.equal(last.project_kind, "client");
    assert.deepEqual(last.installed_modules.map((module) => module.slug), ["copy-lp", "radar"]);
    assert.equal(result.next_step, "open_folder", "beside a repository, outside the folder the command ran in");
    assert.ok(output.some((line) => line.includes("fora da pasta onde este comando rodou")));
  });

  it("does nothing the second time", async () => {
    const downloads = platform.state.downloads.length;
    const result = await run(makeContext(), ["new", "cliente-x"]);
    assert.equal(result.ok, true);
    assert.equal(result.created, false);
    assert.deepEqual(statuses(result), { radar: "already", "copy-lp": "already" });
    assert.equal(platform.state.downloads.length, downloads);
  });

  it("never puts a project inside another", async () => {
    for (const folder of ["./dentro", ".", "..", join(sandbox, "marca-a", "a", "b")]) {
      const result = await run(makeContext(), ["new", folder]);
      assert.equal(result.ok, false, folder);
      assert.equal(result.error, "nested_project", folder);
    }
    assert.equal(existsSync(join(sandbox, "marca-a", "dentro")), false);
  });

  it("leaves out an app the account no longer unlocks and says so", async () => {
    platform.module("copy-lp")!.entitled = false;
    try {
      const result = await run(makeContext(), ["new", "cliente-y"]);
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.deepEqual(statuses(result), { radar: "installed", "copy-lp": "locked" });
      assert.deepEqual(Object.keys(lockAt("cliente-y").modules), ["radar"]);
      assert.ok(output.some((line) => line.includes("copy-lp") && line.includes("fica de fora")));
      assert.ok(readLock(makeContext())!.modules["copy-lp"], "the app keeps working where it was installed");

      const none = await run(makeContext(), ["new", "cliente-w", "--apps", "copy-lp"]);
      assert.equal(none.ok, false);
      assert.equal(none.error, "nothing_to_install");
      assert.ok(String(none.action_url).includes("billing"));
      assert.equal(existsSync(join(sandbox, "cliente-w")), false, "no empty folder is left behind");
    } finally {
      platform.module("copy-lp")!.entitled = true;
    }
  });

  it("takes only the named apps, shows what a new one asks for, and creates nothing on a dry run", async () => {
    const dry = await run(makeContext({ dryRun: true }), ["new", "cliente-v", "--apps", "radar,takes"]);
    assert.equal(dry.ok, true);
    assert.equal(dry.dry_run, true);
    assert.equal(existsSync(join(sandbox, "cliente-v")), false);
    assert.ok(output.some((line) => line.includes("api.exemplo.com")), "permissions of an app this project does not have");
    assert.ok(!output.some((line) => line.includes("Instalar radar")), "an app already approved here is not reviewed again");

    const result = await run(makeContext(), ["new", "cliente-v", "--apps", "radar,takes"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(Object.keys(lockAt("cliente-v").modules).sort(), ["radar", "takes"]);
  });

  it("asks for a login before anything when the machine is not connected", async () => {
    await assert.rejects(
      run(makeContext({ homeDir: join(sandbox, "outra-casa") }), ["new", "cliente-u"]),
      (error: unknown) => error instanceof CliError && error.code === "not_logged",
    );
    assert.equal(existsSync(join(sandbox, "cliente-u")), false);
  });

  it("lists the projects of this machine with their apps", async () => {
    const result = await run(makeContext(), ["projects"]);
    assert.equal(result.ok, true);
    const projects = result.projects as { name: string; current: boolean; kind: string | null; apps: { slug: string }[] }[];
    assert.deepEqual(projects.map((project) => project.name), ["cliente-v", "cliente-x", "cliente-y", "marca-a"]);
    assert.deepEqual(projects.filter((project) => project.current).map((project) => project.name), ["marca-a"]);
    assert.equal(projects.find((project) => project.name === "cliente-x")!.kind, "client");
    assert.deepEqual(projects.find((project) => project.name === "cliente-y")!.apps.map((app) => app.slug), ["radar"]);
    assert.ok(output.some((line) => line.includes("marca-a (este)")));
    assert.equal(platform.state.requests.filter((request) => request.path.includes("/projects")).length, 0, "the list never leaves the machine");
  });

  it("treats two spellings of one Windows folder as the same project", { skip: process.platform !== "win32" }, () => {
    assert.equal(samePath("C:\\Conteudo\\Marca", "c:\\conteudo\\marca"), true);
    assert.equal(samePath("C:\\Conteudo\\Marca", "C:\\Conteudo\\Outra"), false);
  });
});

describe("the operator's linked apps", () => {
  const appDir = () => join(sandbox, "src-app", "meu-video");

  before(async () => {
    const dir = appDir();
    mkdirSync(join(dir, "skills", "meu-video"), { recursive: true });
    writeFileSync(join(dir, "flyee.module.json"), JSON.stringify({ manifest_version: 1, name: "meu-video", version: "0.1.0", type: "workflow", trail: "divulgar", title: { "pt-BR": "Meu vídeo" }, summary: { "pt-BR": "Edita." }, compatible_ais: ["claude_code"], entry: "skills/meu-video/SKILL.md", files: [], changelog: { "pt-BR": "x" } }));
    writeFileSync(join(dir, "README.md"), "# Meu vídeo\n");
    writeFileSync(join(dir, "skills", "meu-video", "SKILL.md"), "---\nname: meu-video\ndescription: Edita vídeo.\n---\n# x\n");
    mkdirSync(join(sandbox, "bancada"), { recursive: true });
    const linked = await run(makeContext({ cwd: join(sandbox, "bancada"), dev: true }), ["dev", "link", dir]);
    assert.equal(linked.ok, true, JSON.stringify(linked));
  });

  it("go along in development mode, without the platform", async () => {
    const calls = platform.state.requests.length;
    const result = await run(makeContext({ cwd: join(sandbox, "bancada"), dev: true, homeDir: join(sandbox, "casa-do-operador") }), ["new", "medchina"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(statuses(result), { "meu-video": "installed" });
    assert.equal(lockAt("medchina").modules["meu-video"].dev, true);
    assert.equal(platform.state.requests.length, calls, "nothing was asked of the platform");
  });

  it("stay behind for a member, who still gets the project, with no apps and the reason", async () => {
    const dry = await run(makeContext({ cwd: join(sandbox, "bancada"), dev: false, dryRun: true }), ["new", "seenaly", "--dry-run"]);
    assert.deepEqual(statuses(dry), { "meu-video": "dev" }, "a dry run gives the reason the real run gives");
    assert.equal(existsSync(join(String(dry.path), ".flyee")), false);
    const result = await run(makeContext({ cwd: join(sandbox, "bancada"), dev: false }), ["new", "seenaly"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(statuses(result), { "meu-video": "dev" });
    assert.ok(existsSync(join(String(result.path), ".flyee", "lock.json")), "an empty project, ready for add");
    const explicit = await run(makeContext({ cwd: join(sandbox, "bancada"), dev: false }), ["new", "outra", "--apps", "meu-video"]);
    assert.equal(explicit.error, "nothing_to_install", "with --apps, nothing to install is still a refusal");
  });

  it("are remembered as projects of this machine", async () => {
    const result = await run(makeContext({ cwd: join(sandbox, "bancada"), dev: true }), ["projects"]);
    const names = (result.projects as { name: string; current: boolean }[]).map((project) => project.name);
    assert.ok(names.includes("bancada"));
  });
});

describe("a flyee folder that holds the projects, one subfolder per brand", () => {
  // The member's own layout, from the first desktop test (2026-10-17): flyee installed in one folder and each
  // brand or client as a subfolder of it. 1.0.1 put a new project beside the folder and refused one inside it.
  const home = () => join(sandbox, "membro", "flyee-workspace");
  const flyeeHome = () => join(sandbox, "home", ".flyee");

  it("is the folder with no apps: a brand becomes a subfolder, ready for apps, and the work goes on in the same conversation", async () => {
    mkdirSync(home(), { recursive: true });
    assert.equal((await run(makeContext({ cwd: home() }), ["login", "--device"])).ok, true);
    const result = await run(makeContext({ cwd: home() }), ["new", "medchina"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.path, join(home(), "medchina"));
    assert.deepEqual(result.apps, []);
    assert.equal(result.next_step, "work_in_folder");
    assert.ok(existsSync(join(home(), "medchina", ".flyee", "lock.json")), "a project: add can run in it next");
    assert.ok(existsSync(join(home(), "medchina", "AGENTS.md")));
    assert.ok(output.some((line) => line.includes("ainda sem apps")));
    assert.ok(output.some((line) => line.includes("Siga nesta conversa")));
  });

  it("takes the apps named into the subfolder", async () => {
    const result = await run(makeContext({ cwd: home() }), ["new", "seenaly", "--apps", "radar"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.path, join(home(), "seenaly"));
    assert.deepEqual(statuses(result), { radar: "installed" });
  });

  it("from inside a brand's project, puts the next brand beside it, in the same folder of projects", async () => {
    const result = await run(makeContext({ cwd: join(home(), "seenaly") }), ["new", "cliente-y"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.path, join(home(), "cliente-y"));
    assert.deepEqual(statuses(result), { radar: "installed" }, "with the apps of the project it came from");
  });

  it("stays the folder of projects with apps of its own at the root", () => {
    assert.equal(projectsHome(home(), { modules: { radar: {} as never } }, flyeeHome()), home());
  });

  it("never puts a project inside a brand's project, nor makes the folder of projects one", async () => {
    for (const folder of [join("medchina", "campanha"), join(home(), "seenaly", "dentro"), "."]) {
      const result = await run(makeContext({ cwd: home() }), ["new", folder]);
      assert.equal(result.error, "nested_project", folder);
    }
    assert.equal(existsSync(join(home(), "medchina", "campanha")), false);
  });
});

describe("the folder of projects, after the adversarial review of 1.0.2", () => {
  const base = () => join(sandbox, "revisao");
  const flyeeHome = () => join(sandbox, "home", ".flyee");
  const at = (...parts: string[]) => join(base(), ...parts);

  before(async () => {
    mkdirSync(at("F"), { recursive: true });
    assert.equal((await run(makeContext({ cwd: at("F") }), ["login", "--device"])).ok, true);
    assert.equal((await run(makeContext({ cwd: at("F") }), ["new", "medchina", "--apps", "radar"])).ok, true);
  });

  it("from a delivery folder of a brand, puts the next brand in the folder of projects, with the brand's apps", async () => {
    mkdirSync(at("F", "medchina", "estudio-de-video"), { recursive: true });
    const result = await run(makeContext({ cwd: at("F", "medchina", "estudio-de-video") }), ["new", "seenaly"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.path, at("F", "seenaly"));
    assert.deepEqual(statuses(result), { radar: "installed" });
  });

  it("keeps the brands inside the folder where flyee was installed even with an app at its root, and takes an existing subfolder as it is", async () => {
    mkdirSync(at("G"), { recursive: true });
    assert.equal((await run(makeContext({ cwd: at("G") }), ["login", "--device"])).ok, true);
    assert.equal((await run(makeContext({ cwd: at("G") }), ["add", "radar"])).ok, true);
    mkdirSync(at("G", "medchina"), { recursive: true });
    writeFileSync(join(at("G", "medchina"), "briefing.txt"), "o que a marca já tinha");
    const result = await run(makeContext({ cwd: at("G") }), ["new", "medchina"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.path, at("G", "medchina"), "the existing subfolder, not a copy beside G");
    assert.equal(result.existing_folder, true);
    assert.equal(readFileSync(join(at("G", "medchina"), "briefing.txt"), "utf8"), "o que a marca já tinha");
    assert.ok(output.some((line) => line.includes("já existe e tem arquivos")));
  });

  it("marks a project it makes, so the next brand goes beside it even with no flyee folder above", async () => {
    mkdirSync(at("H"), { recursive: true });
    const first = await run(makeContext({ cwd: at("H") }), ["new", "marca-um"]);
    assert.equal(first.path, at("H", "marca-um"));
    assert.equal(lockAt(join("revisao", "H", "marca-um")).in_projects_folder, true);
    const second = await run(makeContext({ cwd: at("H", "marca-um") }), ["new", "marca-dois"]);
    assert.equal(second.path, at("H", "marca-dois"), "beside marca-um, not inside it");
  });

  it("never counts the machine's ~/.flyee as a folder of projects", () => {
    const machine = join(sandbox, "maquina");
    mkdirSync(join(machine, ".flyee"), { recursive: true });
    writeFileSync(join(machine, ".flyee", "lock.json"), "{}");
    mkdirSync(join(machine, "projeto"), { recursive: true });
    assert.equal(projectsHome(join(machine, "projeto"), null, join(machine, ".flyee")), join(machine, "projeto"));
  });

  it("says the apps a brand already has when it runs again with none to take", async () => {
    const result = await run(makeContext({ cwd: at("H") }), ["new", "marca-um", "--apps", "radar"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    const again = await run(makeContext({ cwd: at("H") }), ["new", "marca-um"]);
    assert.equal(again.created, false);
    assert.deepEqual(statuses(again), { radar: "already" });
  });

  it("never takes over a code repository with the brand's name", async () => {
    mkdirSync(at("F", "repo-da-marca", ".git"), { recursive: true });
    const result = await run(makeContext({ cwd: at("F") }), ["new", "repo-da-marca"]);
    assert.equal(result.error, "target_is_repository");
    assert.equal(existsSync(at("F", "repo-da-marca", ".flyee")), false);
  });

  it("refuses a name a Windows program cannot open", async () => {
    for (const name of ["marca.", "con", "marca:dois"]) {
      const result = await run(makeContext({ cwd: at("F") }), ["new", name]);
      assert.equal(result.error, "invalid_name", name);
    }
    const trimmed = await run(makeContext({ cwd: at("F"), dryRun: true }), ["new", "  espaços  ", "--dry-run"]);
    assert.equal(trimmed.path, at("F", "espaços"), "spaces around the name are dropped");
  });

  it("lists the apps a dry run would install as planned", async () => {
    const result = await run(makeContext({ cwd: at("F"), dryRun: true }), ["new", "planejada", "--apps", "radar", "--dry-run"]);
    assert.equal(result.dry_run, true);
    assert.deepEqual(statuses(result), { radar: "planned" });
  });
});

describe("the folder of projects, after the second review", () => {
  const at = (...parts: string[]) => join(sandbox, "revisao2", ...parts);
  const flyeeHome = () => join(sandbox, "home", ".flyee");

  it("in a Claude Code cloud session, the repository is the member's folder: brands go inside it", () => {
    mkdirSync(at("repo", ".git"), { recursive: true });
    assert.equal(projectsHome(at("repo"), null, flyeeHome(), true), at("repo"));
    assert.equal(projectsHome(at("repo"), null, flyeeHome(), false), at(), "on a computer, a repository is never filled with brands");
  });

  it("a folder that already holds projects stays the folder of projects, apps at its root and brands beside it or not", async () => {
    mkdirSync(at("W"), { recursive: true });
    assert.equal((await run(makeContext({ cwd: at("W") }), ["login", "--device"])).ok, true);
    assert.equal((await run(makeContext({ cwd: at("W") }), ["add", "copy-lp"])).ok, true, "an app at the root, installed before any brand");
    assert.equal((await run(makeContext({ cwd: at("W") }), ["new", "medchina", "--apps", "radar"])).ok, true);
    mkdirSync(at("vizinha"), { recursive: true });
    assert.equal((await run(makeContext({ cwd: at("vizinha") }), ["new", "outra-marca", "--apps", "radar"])).ok, true);
    const result = await run(makeContext({ cwd: at("W") }), ["new", "seenaly", "--apps", "radar"]);
    assert.equal(result.path, at("W", "seenaly"));
  });

  it("says where a project went when it is outside the folder the command ran in", async () => {
    const result = await run(makeContext({ cwd: at("W", "medchina") }), ["new", "cliente-z", "--apps", "radar"]);
    assert.equal(result.path, at("W", "cliente-z"));
    assert.equal(result.next_step, "open_folder");
    assert.ok(output.some((line) => line.includes("fora da pasta onde este comando rodou")));
  });

  it("sends an app to a brand's project when it is asked for in the folder that holds them, with no apps of its own", async () => {
    mkdirSync(at("Z"), { recursive: true });
    assert.equal((await run(makeContext({ cwd: at("Z") }), ["login", "--device"])).ok, true);
    assert.equal((await run(makeContext({ cwd: at("Z") }), ["new", "medchina"])).ok, true);
    const result = await run(makeContext({ cwd: at("Z") }), ["add", "radar"]);
    assert.equal(result.error, "projects_folder");
    assert.deepEqual(result.projects, ["medchina"]);
    assert.ok(String(result.message).includes("pasta da marca"));
  });
});
