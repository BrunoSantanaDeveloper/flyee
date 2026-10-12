import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { CliError } from "../src/api/errors.ts";
import { projectFolder } from "../src/commands/new.ts";
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
  mkdirSync(join(sandbox, "marca-a"), { recursive: true });
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
  it("turns a bare name into a folder beside the project and keeps a path as written", () => {
    assert.equal(projectFolder(join(sandbox, "marca-a"), "cliente-x"), join(sandbox, "cliente-x"));
    assert.equal(projectFolder(join(sandbox, "marca-a"), "../outros/cliente-x"), join(sandbox, "outros", "cliente-x"));
    assert.equal(projectFolder(join(sandbox, "marca-a"), join(sandbox, "longe")), join(sandbox, "longe"));
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
    assert.ok(output.some((line) => line.includes("abra essa pasta na sua IA")));
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

  it("stay behind for a member", async () => {
    const result = await run(makeContext({ cwd: join(sandbox, "bancada"), dev: false }), ["new", "seenaly"]);
    assert.equal(result.ok, false);
    assert.equal(result.error, "nothing_to_install");
    assert.deepEqual(statuses(result), { "meu-video": "dev" });
    assert.equal(existsSync(join(sandbox, "seenaly")), false);
  });

  it("are remembered as projects of this machine", async () => {
    const result = await run(makeContext({ cwd: join(sandbox, "bancada"), dev: true }), ["projects"]);
    const names = (result.projects as { name: string; current: boolean }[]).map((project) => project.name);
    assert.ok(names.includes("bancada"));
  });
});
