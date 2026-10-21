// What 1.1.0 changes, from the operator's cloud session of 2026-10-21: asked for ad creatives in a project
// with flyee and no app yet, the member's AI wrote everything itself, because nothing in its context said
// which apps exist; and it told the member that a catalog app might not be included in an account with
// nothing bought, which installs the entry version of each app (CLI-CONTRACT.md 4.3). The AGENTS.md block
// now lists the catalog's other apps, kept by login, add, update and new, and `flyee catalog` lists them on
// demand, so the AI can match a request to an app and install it without the member naming one.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { CliError } from "../src/api/errors.ts";
import { type Context, createContext } from "../src/context.ts";
import { loadCoreAssets } from "../src/core-assets.ts";
import { renderAgentsBlock } from "../src/install/adapters.ts";
import { parseArgs, runCommand } from "../src/main.ts";
import { compareSemver } from "../src/semver.ts";
import { type CatalogApp, type Lock, newLock, readLock } from "../src/state/lock.ts";
import { buildModuleZip, type FakeModule, type FakePlatform, startFakePlatform } from "./fake-platform.ts";

let sandbox: string;
let platform: FakePlatform;
let output: string[] = [];

function makeContext(overrides: Partial<Parameters<typeof createContext>[0]> = {}): Context {
  return createContext({
    baseUrl: platform.baseUrl,
    homeDir: join(sandbox, "home"),
    cwd: join(sandbox, "flyee"),
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

const agents = (folder: string) => readFileSync(join(folder, "AGENTS.md"), "utf8");
/** The block's list of what else the catalog offers: from its heading to the core's line. */
const listIn = (block: string) => /## Outros apps do catálogo\n\n([\s\S]*?)\n\nCore flyee/.exec(block)?.[1] ?? "";
const others = (folder = join(sandbox, "flyee")) => listIn(agents(folder));

function app(slug: string, name: string, summary: string, entitled = true): FakeModule {
  return { slug, trail: "divulgar", type: "skill", name, summary, entitled, versions: [buildModuleZip({ slug, version: "1.0.0" })] };
}

before(async () => {
  sandbox = mkdtempSync(join(tmpdir(), "flyee-110-"));
  mkdirSync(join(sandbox, "flyee"), { recursive: true });
  mkdirSync(join(sandbox, "vazio"), { recursive: true });
  platform = await startFakePlatform({
    tier: null,
    modules: [
      app("pesquisa", "Pesquisa do Instagram", "Mostra os posts que passaram muito do normal do perfil. Sem chave, lê capturas de tela."),
      app("carrossel", "Carrossel animado", "Cria carrosséis em vídeo para o Instagram."),
      app("planilha", "Planilha de custos", "Monta a planilha de custos da campanha.", false),
    ],
    recipes: [],
  });
});

after(async () => {
  await platform.close();
  rmSync(sandbox, { recursive: true, force: true });
});

describe("the AI knows which apps exist before anyone names one", () => {
  it("login writes the catalog's other apps into the AGENTS.md block, marking the one this account does not include", async () => {
    const result = await run(makeContext(), ["login", "--device"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    const list = others();
    assert.match(list, /^- \*\*Carrossel animado\*\* \(`carrossel`\): Cria carrosséis em vídeo para o Instagram\.$/m);
    assert.match(list, /^- \*\*Pesquisa do Instagram\*\* \(`pesquisa`\): Mostra os posts que passaram muito do normal do perfil\. Sem chave, lê capturas de tela\.$/m);
    assert.match(list, /^- \*\*Planilha de custos\*\* \(`planilha`\): .*fora do acesso desta conta/m);
    const lock = readLock(makeContext())!;
    assert.equal(lock.catalog?.channel, "free");
    assert.deepEqual(lock.catalog?.apps.map((entry) => entry.slug), ["carrossel", "pesquisa", "planilha"]);
  });

  it("moves an installed app to the installed ones, and back to the list when it is removed", async () => {
    assert.equal((await run(makeContext(), ["add", "pesquisa"])).ok, true);
    assert.doesNotMatch(others(), /`pesquisa`/);
    assert.match(agents(join(sandbox, "flyee")), /## Apps instalados\n\n- \*\*pesquisa\*\* \(`pesquisa` 1\.0\.0\)/);
    assert.equal((await run(makeContext(), ["remove", "pesquisa"])).ok, true);
    assert.match(others(), /`pesquisa`/);
  });

  it("brings an app published after the login with the next update, even in a project with no apps", async () => {
    platform.options.modules!.push(app("roteiro", "Roteiro do YouTube", "Escreve roteiros para o YouTube."));
    assert.equal((await run(makeContext(), ["update"])).ok, true);
    assert.match(others(), /^- \*\*Roteiro do YouTube\*\* \(`roteiro`\)/m);
  });
});

describe("flyee catalog", () => {
  it("lists every app with the version this account installs and what this project has, and writes nothing", async () => {
    assert.equal((await run(makeContext(), ["add", "carrossel"])).ok, true);
    const before = agents(join(sandbox, "flyee"));
    const result = await run(makeContext({ json: true }), ["catalog", "--json"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.channel, "free");
    assert.equal(result.entry_versions, true, "an account with nothing bought installs the entry version of each app");
    const apps = result.apps as { slug: string; version: string; entitled: boolean; installed: string | null; update_available: boolean }[];
    assert.deepEqual(
      apps.map((entry) => entry.slug),
      ["carrossel", "pesquisa", "planilha", "roteiro"],
    );
    assert.equal(apps.find((entry) => entry.slug === "carrossel")?.installed, "1.0.0");
    assert.equal(apps.find((entry) => entry.slug === "pesquisa")?.installed, null);
    assert.equal(apps.find((entry) => entry.slug === "planilha")?.entitled, false);
    assert.ok(apps.every((entry) => entry.version === "1.0.0" && entry.update_available === false));
    assert.match(output.join("\n"), /versão de entrada de cada app/);
    assert.match(output.join("\n"), /Carrossel animado \(carrossel 1\.0\.0\), instalado neste projeto: Cria carrosséis/);
    assert.equal(agents(join(sandbox, "flyee")), before, "the block stays as it was");
  });

  it("asks a computer with no connection to connect first", async () => {
    await assert.rejects(run(makeContext({ homeDir: join(sandbox, "sem-conexao") }), ["catalog"]), (error) => error instanceof CliError && error.code === "not_logged");
  });
});

describe("a brand's project made by new", () => {
  it("lists what the catalog offers besides the apps it takes", async () => {
    const result = await run(makeContext(), ["new", "cliente"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    const list = others(result.path as string);
    assert.doesNotMatch(list, /`carrossel`/, "carrossel went with the project");
    assert.match(list, /`pesquisa`/);
  });

  it("starts with the same list when it takes no apps, without asking the platform", async () => {
    assert.equal((await run(makeContext({ cwd: join(sandbox, "vazio") }), ["login", "--device"])).ok, true);
    const calls = platform.state.requests.length;
    const result = await run(makeContext({ cwd: join(sandbox, "vazio") }), ["new", "outra"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(platform.state.requests.length, calls, "nothing was asked of the platform");
    assert.equal(others(result.path as string), others(join(sandbox, "vazio")));
  });
});

describe("the core tells the AI to use the app a request calls for", () => {
  const assets = loadCoreAssets();

  it("is a new core version, so members receive it on update", () => {
    assert.ok(compareSemver(assets.core.version, "1.8.0") >= 0, assets.core.version);
  });

  for (const locale of ["pt-BR", "en"] as const) {
    it(`in ${locale}, in the AGENTS.md block and in the /flyee skill`, () => {
      const block = assets.agentsTemplate(locale);
      const skill = assets.flyeeSkill(locale);
      const en = locale === "en";
      assert.match(block, en ? /use the app, even if they do not name it/ : /use o app, mesmo que ele não diga o nome/);
      assert.match(block, /run `npx --yes flyee@latest add <app> --yes --json`|rode `npx --yes flyee@latest add <app> --yes --json`/, "installed at once, after one plain sentence");
      assert.match(block, en ? /research comes before creation/ : /a pesquisa vem antes da criação/);
      assert.match(block, en ? /never say an app may not be included/ : /nunca diga que um app pode não estar liberado/);
      assert.match(block, en ? /an installed app only reaches the next one through a commit/ : /um app instalado só chega à próxima pelo commit/);
      assert.match(block, /\{\{catalog\}\}/);
      assert.doesNotMatch(block, /--dry-run/, "no plan shown and no yes awaited before an app comes in");
      assert.match(skill, /`npx --yes flyee@latest catalog --json`/);
      assert.doesNotMatch(skill, /add <app> --json --dry-run/);
    });
  }
});

describe("the list in the block", () => {
  const assets = loadCoreAssets();
  const context = (locale: "pt-BR" | "en" = "pt-BR") => createContext({ cwd: tmpdir(), homeDir: tmpdir(), env: { PATH: "" }, locale });
  const withApps = (locale: "pt-BR" | "en", apps: CatalogApp[], installed: string[] = []): Lock => {
    const lock = newLock(context(locale), assets.core.version);
    lock.catalog = { fetched_at: "2026-10-21T12:00:00.000Z", channel: "latest", apps };
    for (const slug of installed) {
      lock.modules[slug] = { version: "1.0.0", type: "skill", trail: "divulgar", title: slug, summary: "", sha256: "x", installed_at: "", skills: [], files: [], bridges: [], external_credentials: [] };
    }
    return lock;
  };

  it("says how to see the catalog when no list came yet, and leaves no placeholder behind", () => {
    for (const locale of ["pt-BR", "en"] as const) {
      const block = renderAgentsBlock(context(locale), assets, newLock(context(locale), assets.core.version));
      assert.match(block, /`npx --yes flyee@latest catalog --json`/, locale);
      assert.doesNotMatch(block, /\{\{\w+\}\}/, locale);
    }
  });

  it("keeps a summary's dollar signs as written", () => {
    const block = renderAgentsBlock(context(), assets, withApps("pt-BR", [{ slug: "custos", name: "Custos", summary: "Custa US$ 5, e $& ou $1 ficam como estão.", entitled: true }]));
    assert.match(listIn(block), /Custa US\$ 5, e \$& ou \$1 ficam como estão\./);
  });

  it("says so when every app of the catalog is already here", () => {
    const block = renderAgentsBlock(context(), assets, withApps("pt-BR", [{ slug: "radar", name: "Radar", summary: "Mostra.", entitled: true }], ["radar"]));
    assert.match(listIn(block), /Todos os apps do catálogo já estão neste projeto/);
  });

  it("stays within its size with a large catalog, keeping a line for every app", () => {
    const sentence = "Uma frase longa que conta o que o app faz pela marca e para quem. ";
    const many = Array.from({ length: 60 }, (_, index) => ({ slug: `app-${index}`, name: `App ${index}`, summary: `${sentence.repeat(3)}Fim.`, entitled: true }));
    const list = listIn(renderAgentsBlock(context(), assets, withApps("pt-BR", many)));
    assert.ok(list.length <= 6000, `${list.length} characters`);
    assert.equal(list.split("\n").length, 60);
    assert.match(list, /^- \*\*App 0\*\* \(`app-0`\): Uma frase longa que conta o que o app faz pela marca e para quem\.$/m, "the first sentence stays");
  });

  it("writes the English block with its own heading", () => {
    const block = renderAgentsBlock(context("en"), assets, withApps("en", [{ slug: "radar", name: "Radar", summary: "Shows what works.", entitled: false }]));
    assert.match(block, /## Other apps in the catalog\n\n- \*\*Radar\*\* \(`radar`\): Shows what works\. \(not in this account's access\)/);
  });
});
