import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { type Context, createContext } from "../src/context.ts";
import { parseArgs, runCommand } from "../src/main.ts";
import { readLock } from "../src/state/lock.ts";
import { buildModuleZip, type FakeModule, type FakePlatform, startFakePlatform } from "./fake-platform.ts";

/**
 * `remove` and the apps that use the one removed. An app uses another when what
 * it shipped names the other's installed path (`.flyee/modules/<slug>/`), the
 * rule the operator's catalog reads from the sources. Removing an app that
 * others use undoes itself, because their skills install it again: the member
 * hears it first, `--yes` confirms, and with no terminal and no `--yes` the
 * member's AI gets `has_dependents` and the command that confirms.
 */

let sandbox: string;
let platform: FakePlatform;
let output: string[] = [];
let questions: string[] = [];

function makeContext(overrides: Partial<Parameters<typeof createContext>[0]> = {}): Context {
  return createContext({
    baseUrl: platform.baseUrl,
    homeDir: join(sandbox, "home"),
    cwd: join(sandbox, "project"),
    yes: true,
    locale: "pt-BR",
    env: { PATH: "" },
    io: { out: (line) => output.push(line), err: (line) => output.push(line), confirm: async () => true, openBrowser: async () => true },
    ...overrides,
  });
}

/** No --yes, and someone (or nobody, with null) answers the question. */
function asking(answer: boolean | null): Context {
  return makeContext({
    yes: false,
    io: {
      out: (line) => output.push(line),
      err: (line) => output.push(line),
      confirm: async (question) => {
        questions.push(question);
        return answer;
      },
    },
  });
}

async function run(ctx: Context, argv: string[]) {
  output = [];
  questions = [];
  return runCommand(ctx, parseArgs(argv));
}

const installed = (slug: string) => existsSync(join(sandbox, "project", ".flyee", "modules", slug)) && Boolean(readLock(makeContext())?.modules[slug]);

function app(version: ReturnType<typeof buildModuleZip>, name: string): FakeModule {
  const manifest = version.manifest as { name: string; type: string };
  return { slug: manifest.name, trail: "divulgar", type: manifest.type, name, summary: `${name}.`, entitled: true, versions: [version] };
}

const motor = buildModuleZip({
  slug: "motor",
  version: "1.0.0",
  type: "tool",
  title: { "pt-BR": "Motor de vídeo", en: "Video engine" },
  skills: [{ name: "motor", description: "Renderiza um vídeo. Use quando pedirem um vídeo.", body: "Rode `node .flyee/modules/motor/scripts/render.mjs render --json`.\n" }],
  files: { "scripts/render.mjs": "console.log('render');\n", "references/interface.md": "# Interface\n" },
});
// Uses the engine from a skill.
const estudio = buildModuleZip({
  slug: "estudio",
  version: "1.0.0",
  type: "workflow",
  title: { "pt-BR": "Estúdio de vídeo" },
  skills: [{ name: "estudio", description: "Cria vídeos. Use quando pedirem um Reels.", body: "Para renderizar, siga `.flyee/modules/motor/references/interface.md`.\n" }],
});
// Uses the engine from a script.
const carrossel = buildModuleZip({
  slug: "carrossel",
  version: "1.0.0",
  title: { "pt-BR": "Carrossel animado" },
  files: { "scripts/carousel.mjs": 'const engine = ".flyee/modules/motor/scripts/render.mjs";\n' },
});
// Uses nobody: a placeholder names no app, and a picture is not text.
const avulso = buildModuleZip({
  slug: "avulso",
  version: "1.0.0",
  title: { "pt-BR": "Pesquisa avulsa" },
  skills: [{ name: "avulso", description: "Pesquisa. Use quando pedirem uma pesquisa.", body: "Outro app se usa pelo guia em `.flyee/modules/<app>/references/interface.md`.\n" }],
  files: { "assets/capa.png": ".flyee/modules/motor/scripts/render.mjs" },
});

before(async () => {
  sandbox = mkdtempSync(join(tmpdir(), "flyee-remove-"));
  mkdirSync(join(sandbox, "project"), { recursive: true });
  platform = await startFakePlatform({
    tier: "kit",
    modules: [app(motor, "Motor de vídeo"), app(estudio, "Estúdio de vídeo"), app(carrossel, "Carrossel animado"), app(avulso, "Pesquisa avulsa")],
    recipes: [],
  });
  const login = await run(makeContext(), ["login", "--device"]);
  assert.equal(login.ok, true, JSON.stringify(login));
  for (const slug of ["motor", "estudio", "carrossel", "avulso"]) {
    const added = await run(makeContext(), ["add", slug]);
    assert.equal(added.ok, true, JSON.stringify(added));
  }
});

after(async () => {
  await platform.close();
  rmSync(sandbox, { recursive: true, force: true });
});

describe("remove, when other apps use the app", () => {
  it("refuses with has_dependents when no terminal can ask and --yes did not come, naming the apps and the command that confirms", async () => {
    const result = await run(asking(null), ["remove", "motor", "--json"]);
    assert.equal(result.ok, false);
    assert.equal(result.error, "has_dependents");
    assert.deepEqual(result.dependents, ["carrossel", "estudio"], "a placeholder and a picture use nobody");
    assert.equal(result.confirm_with, "npx --yes flyee@latest remove motor --yes --json");
    assert.equal(result.plan_with, undefined);
    const message = String(result.message);
    assert.match(message, /O app Motor de vídeo é usado por Carrossel animado e Estúdio de vídeo\. Sem ele, esses apps vão pedir para instalar de novo\./);
    assert.match(message, /--yes/);
    assert.ok(output.includes(message), "the AI reads the same message in the output");
    assert.ok(installed("motor"), "nothing was removed");
  });

  it("asks on a terminal, naming the apps, and a no keeps the app", async () => {
    const result = await run(asking(false), ["remove", "motor"]);
    assert.equal(questions.length, 1);
    assert.match(questions[0], /Carrossel animado e Estúdio de vídeo.*Remover mesmo assim\?$/);
    assert.equal(result.error, "cancelled");
    assert.deepEqual(result.dependents, ["carrossel", "estudio"]);
    assert.ok(installed("motor"));
  });

  it("removes an app no other app uses as before: no question, even with no terminal", async () => {
    const result = await run(asking(null), ["remove", "avulso"]);
    assert.deepEqual(result, { ok: true, slug: "avulso", removed: true });
    assert.deepEqual(questions, []);
    assert.deepEqual(output, ["avulso removido deste projeto."]);
    assert.ok(!installed("avulso"));
  });

  it("with --yes removes it and reports the apps that used it", async () => {
    const result = await run(makeContext({ json: true }), ["remove", "motor", "--yes", "--json"]);
    assert.deepEqual(result, { ok: true, slug: "motor", removed: true, dependents: ["carrossel", "estudio"] });
    assert.deepEqual(questions, []);
    assert.ok(output.includes("motor removido deste projeto."), output.join("\n"));
    assert.ok(output.some((line) => /Motor de vídeo era usado por Carrossel animado e Estúdio de vídeo, que vão pedir para instalar de novo/.test(line)), output.join("\n"));
    assert.ok(!installed("motor"));
    assert.ok(installed("estudio") && installed("carrossel"), "the apps that used it stay");
    const last = platform.state.installs[platform.state.installs.length - 1] as { installed_modules: { slug: string }[] };
    assert.deepEqual(last.installed_modules.map((module) => module.slug).sort(), ["carrossel", "estudio"]);
  });
});
