import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { type Context, createContext } from "../src/context.ts";
import { allMessages } from "../src/i18n.ts";
import { finish, helpText, parseArgs, runCommand } from "../src/main.ts";
import { readConfig } from "../src/state/config.ts";
import { readLock } from "../src/state/lock.ts";
import { buildModuleZip, type FakePlatform, startFakePlatform } from "./fake-platform.ts";

/**
 * What the platform expects from CLI 1.0.0 on the day the store opens
 * (CLI-CONTRACT.md 4.1, 4.2, 4.9, 8.2): the access by its name, the app page
 * in the reader's language, a machine name cut as the platform cuts it, the
 * device code before the wait, a confirmation an AI can give, and messages
 * that follow the platform's copy rules.
 */

let sandbox: string;
let platform: FakePlatform;
let output: string[] = [];
let progress: { text: string; event: Record<string, unknown>; tokenPolls: number }[] = [];

const tokenPolls = () => platform.state.requests.filter((request) => request.path === "/api/oauth/token").length;

function makeContext(overrides: Partial<Parameters<typeof createContext>[0]> = {}): Context {
  return createContext({
    baseUrl: platform.baseUrl,
    homeDir: join(sandbox, "home"),
    cwd: join(sandbox, "project"),
    yes: true,
    locale: "pt-BR",
    env: { PATH: "" },
    io: {
      out: (line) => output.push(line),
      err: (line) => output.push(line),
      confirm: async () => true,
      openBrowser: async () => true,
      progress: async (text, event) => {
        progress.push({ text, event, tokenPolls: tokenPolls() });
        output.push(text);
      },
    },
    ...overrides,
  });
}

async function run(ctx: Context, argv: string[]) {
  output = [];
  return runCommand(ctx, parseArgs(argv));
}

before(async () => {
  sandbox = mkdtempSync(join(tmpdir(), "flyee-opening-"));
  mkdirSync(join(sandbox, "project"), { recursive: true });
  platform = await startFakePlatform({
    tier: "pro",
    modules: [{ slug: "radar", trail: "divulgar", type: "skill", name: "Radar", summary: "Mostra o que funciona.", entitled: true, versions: [buildModuleZip({ slug: "radar", version: "1.0.0" })] }],
    recipes: [],
  });
  platform.options.links = {
    module_page: `${platform.baseUrl}/catalogo/{slug}?origem=cli`,
    module_page_en: `${platform.baseUrl}/en/catalog/{slug}?origem=cli`,
  };
});

after(async () => {
  await platform.close();
  rmSync(sandbox, { recursive: true, force: true });
});

describe("the login an AI can follow", () => {
  it("hands over the address and the code before the wait, and cuts the machine name as the platform does", async () => {
    progress = [];
    const before = tokenPolls();
    const name = `  ${"Notebook do estúdio de vídeo ".repeat(5)}  `;
    const result = await run(makeContext(), ["login", "--device", "--name", name]);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(progress.length, 1);
    const [code] = progress;
    assert.equal(code.tokenPolls, before, "the code went out before the first poll");
    assert.equal(code.event.event, "device_code");
    assert.equal(code.event.user_code, "ABCD-EFGH");
    assert.equal(code.event.verification_uri, `${platform.baseUrl}/ativar`);
    assert.equal(code.event.verification_uri_complete, `${platform.baseUrl}/ativar?code=ABCD-EFGH`);
    const lines = code.text.split("\n");
    assert.ok(lines.includes(`${platform.baseUrl}/ativar?code=ABCD-EFGH`), "the address on a line of its own");
    assert.ok(lines.includes("Código: ABCD-EFGH"), "the code on a line of its own");

    const kept = readConfig(makeContext())!.device_name;
    assert.equal(kept, name.trim().slice(0, 80));
    assert.equal(kept.length, 80);
    const reported = platform.state.installs[platform.state.installs.length - 1] as { name: string };
    assert.equal(reported.name, kept, "the panel shows the name this machine keeps");
  });

  it("names the access by tier_name, in login and in status", async () => {
    const status = await run(makeContext(), ["status"]);
    assert.equal(status.connected, true);
    assert.ok(output.some((line) => line.includes("FlyeeClub Pro")), output.join("\n"));
    assert.ok(!output.some((line) => /\bpro\b/.test(line)), "never the code's value");
  });

  it("writes the first line of --json as JSON, before the final result", async () => {
    const home = join(sandbox, "home-json");
    mkdirSync(home, { recursive: true });
    const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "main.ts");
    // Asynchronous on purpose: the fake platform answers from this very process, which a spawnSync would freeze.
    const child = await new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve) => {
      execFile(
        process.execPath,
        ["--experimental-strip-types", "--no-warnings", cli, "login", "--device", "--json"],
        {
          cwd: join(sandbox, "project"),
          encoding: "utf8",
          timeout: 120_000,
          env: { ...process.env, FLYEE_BASE_URL: platform.baseUrl, USERPROFILE: home, HOME: home, FLYEE_LOCALE: "en" },
        },
        (error, stdout, stderr) => resolve({ status: error ? ((error as { code?: number }).code ?? 1) : 0, stdout, stderr }),
      );
    });
    assert.equal(child.status, 0, child.stderr || child.stdout);
    const [first, ...rest] = child.stdout.split("\n");
    const code = JSON.parse(first) as Record<string, unknown>;
    assert.equal(code.event, "device_code");
    assert.equal(code.user_code, "ABCD-EFGH");
    assert.equal(code.verification_uri, `${platform.baseUrl}/ativar`);
    const final = JSON.parse(rest.join("\n")) as { ok: boolean; output: string[] };
    assert.equal(final.ok, true);
    assert.ok(final.output.some((line) => line.includes("Code: ABCD-EFGH")));
  });
});

describe("the end of a command", () => {
  it("hands the exit code to Node instead of calling process.exit, which aborts on Windows after an HTTPS fetch", () => {
    const exit = process.exit;
    const previous = process.exitCode;
    let called = false;
    process.exit = (() => {
      called = true;
    }) as typeof process.exit;
    try {
      const timer = finish(3);
      assert.equal(process.exitCode, 3);
      assert.equal(called, false, "no process.exit while the request's handles may still be closing");
      assert.equal(timer.hasRef(), false, "the fallback timer keeps nothing alive");
      clearTimeout(timer);
    } finally {
      process.exit = exit;
      process.exitCode = previous;
    }
  });
});

describe("the app page in the reader's language", () => {
  it("uses module_page_en for an English reader without a connection, module_page for a Portuguese one", async () => {
    const english = await run(makeContext({ homeDir: join(sandbox, "home-en"), locale: "en" }), ["add", "radar"]);
    assert.equal(english.error, "not_logged");
    assert.equal(english.action_url, `${platform.baseUrl}/en/catalog/radar?origem=cli`);
    const portuguese = await run(makeContext({ homeDir: join(sandbox, "home-pt") }), ["add", "radar"]);
    assert.equal(portuguese.action_url, `${platform.baseUrl}/catalogo/radar?origem=cli`);
  });
});

describe("a confirmation without a terminal", () => {
  it("is not a no: add says how to confirm with the flags and installs nothing", async () => {
    const ctx = makeContext({ yes: false, io: { out: (line) => output.push(line), confirm: async () => null } });
    const result = await run(ctx, ["add", "radar", "--kind", "own"]);
    assert.equal(result.ok, false);
    assert.equal(result.error, "confirmation_required");
    assert.equal(result.plan_with, "npx --yes flyee@latest add radar --kind own --dry-run --json");
    assert.equal(result.confirm_with, "npx --yes flyee@latest add radar --kind own --yes --json");
    assert.ok(String(result.message).includes("--dry-run") && String(result.message).includes("--yes"));
    assert.equal(readLock(ctx)?.modules.radar, undefined, "nothing was installed");
  });

  it("stays a no when someone answered no on a terminal", async () => {
    const ctx = makeContext({ yes: false, io: { out: (line) => output.push(line), confirm: async () => false } });
    const result = await run(ctx, ["add", "radar"]);
    assert.equal(result.error, "cancelled");
  });

  it("does the same for need, which has no plan to show", async () => {
    const ctx = makeContext({ yes: false, system: { find: () => null, run: () => ({ status: 1, stdout: "", stderr: "" }) }, io: { out: (line) => output.push(line), confirm: async () => null } });
    const result = await run(ctx, ["need", "ffmpeg"]);
    assert.equal(result.error, "confirmation_required");
    assert.equal(result.confirm_with, "npx --yes flyee@latest need ffmpeg --yes --json");
    assert.equal(result.plan_with, undefined);
    assert.deepEqual(result.missing, ["ffmpeg"]);
  });
});

/** The platform's copy rules (flyee-club apps/web/src/lib/i18n/copy-rules.test.ts), re-implemented here. */
const DASH = /[–—]/u;
const EMOJI = /(?![©→])\p{Extended_Pictographic}/u;
const BANNED = /(?<![\p{L}\p{N}])(?:desbloque|potencializ|sem esforço|soluç(?:ão|ões) inovadora|unlock|elevat|empower|seamless|robust|supercharg|game-changing|it['’]s not just)/iu;
const FREE = /(?<![\p{L}\p{N}])(?:gr[aá]tis|gratuit|free(?![\p{L}\p{N}])|sem custo(?! extra)|no cost|at no charge)/iu;
const TERMINAL = /no seu terminal|abra o terminal|in your (?:own )?terminal|open (?:a|the|your) terminal|PowerShell|Prompt de Comando|Command Prompt/i;

describe("every line the CLI prints follows the platform's copy rules", () => {
  const texts = (["pt-BR", "en"] as const).flatMap((locale) => [
    ...Object.entries(allMessages(locale)).map(([key, text]) => [`${locale} ${key}`, text] as const),
    [`${locale} help`, helpText(locale)] as const,
  ]);

  it("knows each mark it promises to catch", () => {
    assert.ok(DASH.test("Pronto — feito") && DASH.test("10–12"));
    assert.ok(EMOJI.test("Feito ✅") && !EMOJI.test("Ver planos →") && !EMOJI.test("✓ passou"));
    assert.ok(BANNED.test("Desbloqueie") && BANNED.test("unlocks") && !BANNED.test("bloqueie"));
  });

  it("no dash, exclamation mark, emoji, banned word, free offer or terminal for the member, in either language", () => {
    const found: string[] = [];
    for (const [where, text] of texts) {
      if (DASH.test(text)) found.push(`${where}: dash`);
      if (text.includes("!")) found.push(`${where}: exclamation mark`);
      if (EMOJI.test(text)) found.push(`${where}: emoji`);
      if (BANNED.test(text)) found.push(`${where}: banned word`);
      if (FREE.test(text)) found.push(`${where}: free`);
      if (TERMINAL.test(text)) found.push(`${where}: sends someone to a terminal`);
    }
    assert.deepEqual(found, []);
  });

  it("writes every command the way an AI must run it", () => {
    const found: string[] = [];
    for (const [where, text] of texts) {
      for (const match of text.matchAll(/npx\s+([^\s`]+)(?:\s+([^\s`]+))?/g)) {
        if (!(match[1] === "--yes" && match[2] === "flyee@latest")) found.push(`${where}: "${match[0]}"`);
      }
      for (const match of text.matchAll(/key set\s+\S+([^`\n]*)/g)) {
        if (!match[1].includes("--browser")) found.push(`${where}: "${match[0]}" without --browser`);
      }
    }
    assert.deepEqual(found, []);
  });

  it("keeps the two languages in step", () => {
    assert.deepEqual(Object.keys(allMessages("en")).sort(), Object.keys(allMessages("pt-BR")).sort());
  });
});

// Keep the reader of this file aware of what the login wrote.
export const opened = () => readFileSync(join(sandbox, "project", "AGENTS.md"), "utf8");
