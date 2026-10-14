import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { CliError } from "../src/api/errors.ts";
import { type Context, createContext } from "../src/context.ts";
import { describeFailure, parseArgs, runCommand } from "../src/main.ts";
import { readCredentials } from "../src/state/credentials.ts";
import { readLock } from "../src/state/lock.ts";
import { buildModuleZip, type FakePlatform, startFakePlatform } from "./fake-platform.ts";

let sandbox: string;
let platform: FakePlatform;
let output: string[] = [];
/** The refresh token that `update` rotated away; a later test reuses it to prove the family is revoked. */
let rotatedRefresh = "";

function makeContext(overrides: Partial<Parameters<typeof createContext>[0]> = {}): Context {
  return createContext({
    baseUrl: platform.baseUrl,
    homeDir: join(sandbox, "home"),
    cwd: join(sandbox, "project"),
    yes: true,
    locale: "pt-BR",
    env: { PATH: "", FLYEE_DEV: "1" },
    dev: true,
    io: { out: (line) => output.push(line), err: (line) => output.push(line), confirm: async () => true, openBrowser: async () => true },
    ...overrides,
  });
}

async function run(ctx: Context, argv: string[]) {
  output = [];
  return runCommand(ctx, parseArgs(argv));
}

const radar100 = buildModuleZip({
  slug: "radar",
  version: "1.0.0",
  skills: [
    { name: "radar-outliers", description: "Encontra conteúdo outlier. Use quando pedirem radar." },
    { name: "radar-instagram", description: "Radar do Instagram. Use quando pedirem reels que bombaram." },
  ],
  files: { "scripts/score.py": "print('score')\n", "skills/radar-outliers/references/metodologia.md": "# Metodologia\n" },
  permissions: [{ kind: "shell", scope: "python scripts/score.py", reason: { "pt-BR": "Calcula o score." } }],
  external_credentials: [{ name: "Apify", env: "APIFY_TOKEN", url: "https://console.apify.com/", required: true, purpose: { "pt-BR": "Coleta." } }],
});
const pauta100 = buildModuleZip({ slug: "pauta", version: "1.0.0" });
const copy100 = buildModuleZip({ slug: "copy-lp", version: "1.0.0" });
const evil100 = buildModuleZip({ slug: "evil", version: "1.0.0", rawEntries: { "../escape.md": "fora" } });

before(async () => {
  sandbox = mkdtempSync(join(tmpdir(), "flyee-cli-"));
  mkdirSync(join(sandbox, "project"), { recursive: true });
  platform = await startFakePlatform({
    tier: "kit",
    links: { module_page: "{base}/catalogo/{slug}?origem=cli" },
    deprecations: ["Aviso de teste."],
    modules: [
      { slug: "radar", trail: "divulgar", type: "skill", name: "Radar", summary: "Mostra o que funciona.", entitled: true, external_credentials: [{ name: "Apify", env: "APIFY_TOKEN", url: "https://console.apify.com/", required: true, purpose: { "pt-BR": "Coleta." } }], versions: [radar100] },
      { slug: "pauta", trail: "divulgar", type: "skill", name: "Pauta", summary: "Pautas.", entitled: false, versions: [pauta100] },
      { slug: "copy-lp", trail: "vender", type: "skill", name: "Copy LP", summary: "Copy.", entitled: true, versions: [copy100] },
      { slug: "evil", trail: "divulgar", type: "skill", name: "Evil", summary: "Zip malicioso.", entitled: true, versions: [evil100] },
      { slug: "takes", trail: "divulgar", type: "skill", name: "Takes", summary: "Takes.", entitled: true, newest: "2.0.0", versions: [buildModuleZip({ slug: "takes", version: "1.0.0" })] },
    ],
    recipes: [{ slug: "video-semanal", name: "Vídeo semanal", entitled: true, workflow: "# Workflow\n1. radar\n2. copy-lp\n", modules: ["radar", "copy-lp"] }],
  });
  platform.options.links = { module_page: `${platform.baseUrl}/catalogo/{slug}?origem=cli` };
});

after(async () => {
  await platform.close();
  rmSync(sandbox, { recursive: true, force: true });
});

describe("the member's journey against the contract", () => {
  it("explains the funnel when add runs before any login", async () => {
    const ctx = makeContext();
    const result = await run(ctx, ["add", "radar"]);
    assert.equal(result.ok, false);
    assert.equal(result.error, "not_logged");
    assert.equal(result.action_url, `${platform.baseUrl}/catalogo/radar?origem=cli`);
    assert.ok(output.some((line) => line.includes("faz parte do acesso")));
  });

  it("logs in with a device code, registers the machine and writes the harness", async () => {
    const ctx = makeContext();
    const result = await run(ctx, ["login", "--device", "--name", "notebook", "--kind", "own"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    const credentials = readCredentials(ctx);
    assert.ok(credentials?.access_token.startsWith("mcat_"));
    assert.equal(platform.state.installs.length, 1);
    assert.equal(platform.state.installs[0].name, "notebook");
    assert.equal(platform.state.installs[0].project_kind, "own");
    const agents = readFileSync(join(ctx.cwd, "AGENTS.md"), "utf8");
    assert.ok(agents.includes("<!-- flyee:begin -->") && agents.includes("Nenhum app instalado"));
    assert.ok(readFileSync(join(ctx.cwd, "CLAUDE.md"), "utf8").includes("@AGENTS.md"));
    assert.ok(readFileSync(join(ctx.cwd, "GEMINI.md"), "utf8").includes("@./AGENTS.md"));
    assert.ok(existsSync(join(ctx.cwd, ".claude", "skills", "flyee", "SKILL.md")));
    assert.ok(existsSync(join(ctx.cwd, ".agents", "skills", "flyee", "SKILL.md")));
    assert.ok(output.some((line) => line.includes("Conectado como Ana")));
  });

  it("installs an app after verifying it, writes bridges and reports the install", async () => {
    const ctx = makeContext();
    const result = await run(ctx, ["add", "radar"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.ok(existsSync(join(ctx.cwd, ".flyee", "modules", "radar", "skills", "radar-outliers", "SKILL.md")));
    assert.ok(existsSync(join(ctx.cwd, ".flyee", "modules", "radar", "scripts", "score.py")));
    const bridge = readFileSync(join(ctx.cwd, ".agents", "skills", "radar-outliers", "SKILL.md"), "utf8");
    assert.ok(bridge.startsWith("---\nname: radar-outliers\n"));
    assert.ok(bridge.includes("../../../.flyee/modules/radar/skills/radar-outliers/SKILL.md"));
    assert.ok(existsSync(join(ctx.cwd, ".claude", "skills", "radar-instagram", "SKILL.md")));
    assert.ok(existsSync(join(ctx.cwd, ".agents", "skills", "radar-outliers", "agents", "openai.yaml")));
    const lock = readLock(ctx)!;
    assert.equal(lock.modules.radar.version, "1.0.0");
    assert.deepEqual(lock.modules.radar.skills, ["radar-instagram", "radar-outliers"]);
    assert.ok(readFileSync(join(ctx.cwd, "AGENTS.md"), "utf8").includes("`radar` 1.0.0"));
    assert.ok(output.some((line) => line.includes("python scripts/score.py")), "permissions were shown");
    assert.ok(output.some((line) => line.includes("APIFY_TOKEN")), "missing credential was pointed out");
    const installed = platform.state.events.find((event) => event.name === "module.installed");
    assert.ok(installed, "module.installed reached the platform");
    assert.equal((installed!.properties as Record<string, string>).module, "radar");
    const last = platform.state.installs[platform.state.installs.length - 1] as { installed_modules: { slug: string; version: string }[] };
    assert.deepEqual(last.installed_modules, [{ slug: "radar", version: "1.0.0" }]);
  });

  it("does nothing when the same version is already installed", async () => {
    const ctx = makeContext();
    const result = await run(ctx, ["add", "radar"]);
    assert.equal(result.ok, true);
    assert.equal(result.changed, false);
  });

  it("saves an app key typed with the echo off, outside the project, and never prints it", async () => {
    const asked: string[] = [];
    const ctx = makeContext({ io: { out: (line) => output.push(line), secret: async (question) => (asked.push(question), "  apify-segredo-123  ") } });
    const result = await run(ctx, ["key", "set", "APIFY_TOKEN"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(result.used_by, ["radar"]);
    assert.ok(asked[0].includes("APIFY_TOKEN"));
    const file = join(sandbox, "home", ".flyee", "keys.json");
    assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), { version: 1, keys: { APIFY_TOKEN: "apify-segredo-123" } });
    assert.ok(!existsSync(join(ctx.cwd, ".flyee", "keys.json")), "never inside the project");
    assert.ok(!JSON.stringify(result).includes("apify-segredo-123") && !output.join("\n").includes("apify-segredo-123"), "the value is never printed");

    const doctor = await run(ctx, ["doctor"]);
    assert.deepEqual((doctor.credentials as { env: string; source: string }[]).map(({ env, source }) => ({ env, source })), [{ env: "APIFY_TOKEN", source: "flyee" }]);
    const listed = await run(ctx, ["key", "list"]);
    assert.deepEqual(listed.keys, [{ name: "APIFY_TOKEN", source: "flyee", saved: true, apps: ["radar"], required: true, url: "https://console.apify.com/" }]);
    assert.ok(!output.join("\n").includes("apify-segredo-123"));
  });

  it("lets the environment variable win, and an empty one means no key", async () => {
    const withVariable = makeContext({ env: { PATH: "", APIFY_TOKEN: "do-ambiente" } });
    assert.equal(((await run(withVariable, ["key", "list"])).keys as { source: string }[])[0].source, "environment");
    const emptyVariable = makeContext({ env: { PATH: "", APIFY_TOKEN: "" } });
    assert.equal(((await run(emptyVariable, ["key", "list"])).keys as { source: string | null }[])[0].source, null);
  });

  it("refuses a key passed as an argument, and without a terminal takes it through a page in the browser", async () => {
    const ctx = makeContext();
    const inArguments = await run(ctx, ["key", "set", "APIFY_TOKEN", "apify-no-historico"]);
    assert.equal(inArguments.ok, false);
    assert.equal(inArguments.error, "key_in_arguments");
    assert.ok(!readFileSync(join(sandbox, "home", ".flyee", "keys.json"), "utf8").includes("apify-no-historico"));

    // The member's AI runs `key set` (no terminal): the CLI opens a page; the member pastes the key there.
    const statuses: number[] = [];
    let form = "";
    const form_ = { "Content-Type": "application/x-www-form-urlencoded" };
    const viaBrowser = makeContext({
      io: {
        out: (line) => output.push(line),
        openBrowser: async (url) => {
          const page = await fetch(url);
          statuses.push(page.status);
          form = await page.text();
          statuses.push((await fetch(url.replace(/\/k\/[^/]+$/, "/k/outro-token-qualquer"))).status);
          statuses.push((await fetch(url, { method: "POST", headers: form_, body: "value=" })).status);
          statuses.push((await fetch(url, { method: "POST", headers: form_, body: "value=apify-pela-pagina" })).status);
          return true;
        },
      },
    });
    const saved = await run(viaBrowser, ["key", "set", "APIFY_TOKEN"]);
    assert.equal(saved.ok, true, JSON.stringify(saved));
    assert.equal(saved.via, "browser");
    assert.deepEqual(statuses, [200, 404, 400, 200]);
    assert.ok(form.includes("APIFY_TOKEN") && form.includes('type="password"') && form.includes("https://console.apify.com/"));
    assert.equal(JSON.parse(readFileSync(join(sandbox, "home", ".flyee", "keys.json"), "utf8")).keys.APIFY_TOKEN, "apify-pela-pagina");
    assert.ok(!JSON.stringify(saved).includes("apify-pela-pagina") && !output.join("\n").includes("apify-pela-pagina"), "the value is never printed");

    const badName = await run(ctx, ["key", "set", "apify-token"]);
    assert.equal(badName.error, "usage");
  });

  it("reads a piped key with --stdin and removes a key on request", async () => {
    const ctx = makeContext({ io: { out: (line) => output.push(line), stdin: async () => "chave-via-pipe\n" } });
    const piped = await run(ctx, ["key", "set", "OUTRA_CHAVE", "--stdin"]);
    assert.equal(piped.ok, true, JSON.stringify(piped));
    assert.equal(piped.replaced, false);
    const removed = await run(ctx, ["key", "remove", "OUTRA_CHAVE"]);
    assert.equal(removed.removed, true);
    const keys = JSON.parse(readFileSync(join(sandbox, "home", ".flyee", "keys.json"), "utf8")).keys;
    assert.deepEqual(Object.keys(keys), ["APIFY_TOKEN"]);
  });

  it("refuses an app the account does not unlock, with the upgrade link", async () => {
    const ctx = makeContext();
    const result = await run(ctx, ["add", "pauta"]);
    assert.equal(result.ok, false);
    assert.equal(result.error, "denied_entitlement");
    assert.equal(result.action_url, `${platform.baseUrl}/settings/billing?source=cli`);
    assert.ok(!existsSync(join(ctx.cwd, ".flyee", "modules", "pauta")));
  });

  it("updates to a new version, rotates the refresh token and reports updated: true", async () => {
    const ctx = makeContext();
    const before = readCredentials(ctx)!;
    platform.publish("radar", buildModuleZip({ slug: "radar", version: "1.1.0", skills: [{ name: "radar-outliers", description: "Radar 1.1." }] }));
    const result = await run(ctx, ["update"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.updated, 1);
    assert.equal(readLock(ctx)!.modules.radar.version, "1.1.0");
    assert.ok(readFileSync(join(ctx.cwd, "AGENTS.md"), "utf8").includes("`radar` 1.1.0"));
    assert.ok(!existsSync(join(ctx.cwd, ".claude", "skills", "radar-instagram")), "a skill that left the app loses its bridge");
    const after = readCredentials(ctx)!;
    assert.notEqual(after.refresh_token, before.refresh_token);
    const updatedEvent = platform.state.events.find((event) => event.name === "module.updated");
    assert.deepEqual(
      [(updatedEvent!.properties as Record<string, string>).from_version, (updatedEvent!.properties as Record<string, string>).to_version],
      ["1.0.0", "1.1.0"],
    );
    const last = platform.state.installs[platform.state.installs.length - 1] as { updated?: boolean };
    assert.equal(last.updated, true);
    assert.ok(output.some((line) => line.includes("Aviso de teste.")));
    rotatedRefresh = before.refresh_token;
  });

  it("loses the connection when a rotated refresh token is reused, and recovers with a new login", async () => {
    const ctx = makeContext();
    // A stolen, already rotated token: the contract revokes the whole family of this machine (2.3).
    const reuse = await fetch(`${platform.baseUrl}/api/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", client_id: "flyee-cli", refresh_token: rotatedRefresh }).toString(),
    });
    assert.equal(reuse.status, 400);
    assert.equal(((await reuse.json()) as { error: string }).error, "invalid_grant");
    const broken = await run(ctx, ["status"]);
    assert.equal(broken.connected, false);
    assert.equal(broken.connection_error, "relogin");
    assert.ok(output.some((line) => line.includes("npx --yes flyee@latest login")), "the command is written as an AI must run it");
    const login = await run(ctx, ["login", "--device"]);
    assert.equal(login.ok, true, JSON.stringify(login));
    const recovered = await run(ctx, ["status"]);
    assert.equal(recovered.connected, true);
    assert.equal(readLock(ctx)!.modules.radar.version, "1.1.0", "installed apps survive a re-login untouched");
  });

  it("shows the distance to the newest version when the catalog sends it", async () => {
    const ctx = makeContext();
    await run(ctx, ["add", "takes"]);
    await run(ctx, ["update"]);
    assert.ok(output.some((line) => line.includes("2.0.0")), output.join("\n"));
  });

  it("refuses a package whose bytes do not match the announced checksum", async () => {
    const ctx = makeContext();
    platform.options.corruptDownload = true;
    try {
      await assert.rejects(run(ctx, ["add", "copy-lp"]), (error: unknown) => error instanceof CliError && error.code === "package_checksum");
    } finally {
      platform.options.corruptDownload = false;
    }
    assert.ok(!existsSync(join(ctx.cwd, ".flyee", "modules", "copy-lp")));
    const failure = describeFailure(ctx, new CliError("package_checksum", "x"));
    assert.ok(failure.message.includes("Nada foi instalado"));
  });

  it("refuses a package with an entry that escapes its folder", async () => {
    const ctx = makeContext();
    await assert.rejects(run(ctx, ["add", "evil"]), (error: unknown) => error instanceof CliError && error.code === "package_path");
    assert.ok(!existsSync(join(ctx.cwd, ".flyee", "modules", "evil")));
  });

  it("installs a recipe's apps and keeps its workflow", async () => {
    const ctx = makeContext();
    const result = await run(ctx, ["add", "receita:video-semanal"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(result.modules, ["radar", "copy-lp"]);
    assert.ok(readFileSync(join(ctx.cwd, ".flyee", "recipes", "video-semanal", "workflow.md"), "utf8").includes("Workflow"));
    assert.ok(platform.state.events.some((event) => event.name === "recipe.installed"));
  });

  it("answers status as JSON with the apps and the connection", async () => {
    const ctx = makeContext();
    const result = await run(ctx, ["status"]);
    assert.equal(result.ok, true);
    assert.equal(result.connected, true);
    const apps = result.apps as { slug: string; version: string }[];
    assert.ok(apps.some((app) => app.slug === "radar" && app.version === "1.1.0"));
    assert.deepEqual(result.deprecations, ["Aviso de teste."]);
  });

  it("queues and sends a usage event with allowlisted properties only", async () => {
    const ctx = makeContext();
    const result = await run(ctx, ["track", "tool.executed", "--module", "radar", "--reason", "x", "--prompt", "segredo"]);
    assert.equal(result.ok, true);
    const event = platform.state.events.filter((candidate) => candidate.name === "tool.executed").pop()!;
    const properties = event.properties as Record<string, string>;
    assert.equal(properties.module, "radar");
    assert.equal(properties.version, "1.1.0");
    assert.equal(properties.trail, "divulgar");
    assert.equal("prompt" in properties, false);
    const unknown = await run(ctx, ["track", "something.else"]);
    assert.equal(unknown.ok, false);
  });

  it("removes an app with its bridges and reports the machine again", async () => {
    const ctx = makeContext();
    const result = await run(ctx, ["remove", "radar"]);
    assert.equal(result.ok, true);
    assert.ok(!existsSync(join(ctx.cwd, ".flyee", "modules", "radar")));
    assert.ok(!existsSync(join(ctx.cwd, ".agents", "skills", "radar-outliers")));
    assert.ok(!readFileSync(join(ctx.cwd, "AGENTS.md"), "utf8").includes("`radar`"));
    const last = platform.state.installs[platform.state.installs.length - 1] as { installed_modules: { slug: string }[] };
    assert.ok(!last.installed_modules.some((module) => module.slug === "radar"));
  });

  it("links an app from a local directory in development mode and leaves it alone on update", async () => {
    const ctx = makeContext();
    const dir = join(sandbox, "src-app", "meu-video");
    mkdirSync(join(dir, "skills", "meu-video"), { recursive: true });
    mkdirSync(join(dir, "tests"), { recursive: true });
    writeFileSync(join(dir, "flyee.module.json"), JSON.stringify({ manifest_version: 1, name: "meu-video", version: "0.1.0", type: "workflow", trail: "divulgar", title: { "pt-BR": "Meu vídeo" }, summary: { "pt-BR": "Edita." }, compatible_ais: ["claude_code"], entry: "skills/meu-video/SKILL.md", files: [], changelog: { "pt-BR": "x" } }));
    writeFileSync(join(dir, "README.md"), "# Meu vídeo\n");
    writeFileSync(join(dir, "skills", "meu-video", "SKILL.md"), "---\nname: meu-video\ndescription: Edita vídeo.\n---\n# x\n");
    writeFileSync(join(dir, "tests", "eval.json"), "{}");
    const result = await run(ctx, ["dev", "link", dir]);
    assert.equal(result.ok, true, JSON.stringify(result));
    const lock = readLock(ctx)!;
    assert.equal(lock.modules["meu-video"].dev, true);
    assert.ok(!existsSync(join(ctx.cwd, ".flyee", "modules", "meu-video", "tests")), "tests never ship, even in dev mode");
    const update = await run(ctx, ["update"]);
    const line = (update.apps as { slug: string; status: string }[]).find((app) => app.slug === "meu-video");
    assert.equal(line?.status, "dev");
    const disabled = await run(makeContext({ dev: false, env: { PATH: "" } }), ["dev", "link", dir]);
    assert.equal(disabled.ok, false);
  });

  it("logs out by revoking the family and clearing the credentials", async () => {
    const ctx = makeContext();
    const refresh = readCredentials(ctx)!.refresh_token;
    const result = await run(ctx, ["logout"]);
    assert.equal(result.ok, true);
    assert.equal(readCredentials(ctx), null);
    assert.ok(platform.state.revoked.includes(refresh));
    const status = await run(ctx, ["status"]);
    assert.equal(status.connected, false);
  });
});

describe("the platform's floor", () => {
  it("stops before any other call when the CLI is below min_cli_version", async () => {
    const strict = await startFakePlatform({ minCliVersion: "99.0.0" });
    try {
      const home = mkdtempSync(join(tmpdir(), "flyee-strict-"));
      const ctx = makeContext({ baseUrl: strict.baseUrl, homeDir: home, cwd: home });
      await assert.rejects(run(ctx, ["login", "--device"]), (error: unknown) => error instanceof CliError && error.code === "cli_outdated");
      const failure = describeFailure(ctx, new CliError("cli_outdated", "99.0.0"));
      assert.ok(failure.message.includes("99.0.0"));
      assert.ok(strict.state.requests.every((request) => request.path === "/api/cli/version"));
      rmSync(home, { recursive: true, force: true });
    } finally {
      await strict.close();
    }
  });
});
