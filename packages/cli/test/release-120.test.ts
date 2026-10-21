import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { type Context, createContext } from "../src/context.ts";
import { allowlistEntries, declaredNetwork } from "../src/install/hosts.ts";
import { parseArgs, runCommand } from "../src/main.ts";
import { buildModuleZip, type FakePlatform, startFakePlatform } from "./fake-platform.ts";

/**
 * CLI 1.2.0, from the operator's cloud session of 2026-10-21: the ads app found, in the middle of
 * the work, that the session reached only flyee.club, and the member asked whether environment
 * variables would fix it. They do not: the network does. Now, in a Claude Code cloud session,
 * `add` and `doctor` probe the hosts the apps declare and bring, at once, the entries to allow and
 * one message for the member; a key's page that cannot open there points to the environment.
 */

let sandbox: string;
let platform: FakePlatform;
let output: string[] = [];
let probed: string[] = [];

/** A tunnel the cloud's proxy refused, as Node's fetch reports it (measured 2026-10-17). */
const tunnelRefused = () =>
  new TypeError("fetch failed", {
    cause: Object.assign(new Error("Request was cancelled."), {
      name: "AbortError",
      code: 0,
      cause: Object.assign(new Error("Proxy response (403) !== 200 when HTTP Tunneling"), { name: "AbortError", code: "UND_ERR_ABORTED" }),
    }),
  });

/** The platform answers for real; any other host is the cloud's proxy: refused unless allowed. */
function cloudFetch(allowed: string[]): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.origin === new URL(platform.baseUrl).origin) return fetch(input, init);
    probed.push(url.host);
    if (allowed.includes(url.host)) return new Response(null, { status: 200 });
    throw tunnelRefused();
  }) as typeof fetch;
}

function context(name: string, env: Record<string, string>, fetcher?: typeof fetch): Context {
  const cwd = join(sandbox, name);
  mkdirSync(cwd, { recursive: true });
  return createContext({
    baseUrl: platform.baseUrl,
    homeDir: join(sandbox, "home"),
    cwd,
    yes: true,
    locale: "pt-BR",
    env: { PATH: "", ...env },
    ...(fetcher ? { fetch: fetcher } : {}),
    io: { out: (line) => output.push(line), err: (line) => output.push(line), confirm: async () => true, openBrowser: async () => true },
  });
}

async function run(ctx: Context, argv: string[]) {
  output = [];
  return runCommand(ctx, parseArgs(argv));
}

const reason = { "pt-BR": "Busca os dados." };

before(async () => {
  sandbox = mkdtempSync(join(tmpdir(), "flyee-120-"));
  const ads = buildModuleZip({
    slug: "anuncios",
    version: "1.0.0",
    permissions: [
      { kind: "network", scope: "o site da marca que você indicar", reason },
      { kind: "network", scope: "api.coletor.com", reason },
    ],
    external_credentials: [{ name: "Coletor", env: "COLETOR_TOKEN", required: false }],
  });
  const videos = buildModuleZip({ slug: "videos", version: "1.0.0", permissions: [{ kind: "network", scope: "videos.com, cdn.videos.com e o site do vídeo que você indicar", reason }] });
  const offline = buildModuleZip({ slug: "roteiro", version: "1.0.0" });
  platform = await startFakePlatform({
    tier: "kit",
    modules: [
      { slug: "anuncios", trail: "divulgar", type: "skill", name: "Criativos", summary: "Anúncios.", entitled: true, versions: [ads] },
      { slug: "videos", trail: "planejar", type: "tool", name: "Vídeos", summary: "Vídeos.", entitled: true, versions: [videos] },
      { slug: "roteiro", trail: "divulgar", type: "skill", name: "Roteiro", summary: "Roteiro.", entitled: true, versions: [offline] },
    ],
    recipes: [],
  });
  const ctx = context("login", {});
  assert.equal((await run(ctx, ["login", "--device", "--name", "notebook"])).ok, true);
});

after(async () => {
  await platform.close();
  rmSync(sandbox, { recursive: true, force: true });
});

describe("the hosts an app declares, apart from the words a person reads", () => {
  it("takes the names and keeps the rest as a note", () => {
    const declared = declaredNetwork([
      { kind: "network", scope: "youtube.com, googlevideo.com e o site do vídeo que você indicar" },
      { kind: "network", scope: "generativelanguage.googleapis.com" },
      { kind: "network", scope: "o site que você pedir para capturar e as imagens dele (só no comando capture)" },
      { kind: "shell", scope: "ffmpeg, ffprobe" },
    ]);
    assert.deepEqual(declared.hosts, ["youtube.com", "googlevideo.com", "generativelanguage.googleapis.com"]);
    assert.deepEqual(declared.notes, ["o site do vídeo que você indicar", "o site que você pedir para capturar e as imagens dele (só no comando capture)"]);
  });

  it("asks for a domain's subdomains too, and for an API's host alone", () => {
    assert.deepEqual(allowlistEntries("youtube.com"), ["youtube.com", "*.youtube.com"]);
    assert.deepEqual(allowlistEntries("api.apify.com"), ["api.apify.com"]);
    assert.deepEqual(allowlistEntries("*.example.com"), ["*.example.com"]);
  });
});

describe("in a Claude Code cloud session, the network an app needs comes at install, in one message", () => {
  it("add brings the refused hosts, the notes and the one-time step, speaking to the member", async () => {
    probed = [];
    const result = await run(context("nuvem", { CLAUDE_CODE_REMOTE: "true" }, cloudFetch([])), ["add", "anuncios", "--yes", "--json"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    const network = result.network as { blocked: string[]; notes: string[]; message: string };
    assert.deepEqual(network.blocked, ["api.coletor.com"]);
    assert.deepEqual(network.notes, ["o site da marca que você indicar"]);
    for (const words of ["`api.coletor.com`", "o app anuncios usa", "Editar ambiente de nuvem", "Domínios permitidos", "avise na conversa"]) {
      assert.ok(network.message.includes(words), `${words} missing in: ${network.message}`);
    }
    assert.doesNotMatch(network.message, /a pessoa|à pessoa/);
    assert.ok(output.includes(network.message), "the message also goes to the screen");
  });

  it("a domain's www and subdomains go in with it, and a host already allowed stays out", async () => {
    probed = [];
    const result = await run(context("nuvem-videos", { CLAUDE_CODE_REMOTE: "true" }, cloudFetch(["cdn.videos.com"])), ["add", "videos", "--yes", "--json"]);
    const network = result.network as { blocked: string[]; notes: string[] };
    assert.deepEqual(network.blocked, ["videos.com", "*.videos.com"]);
    assert.deepEqual(network.notes, ["o site do vídeo que você indicar"]);
    assert.ok(probed.includes("cdn.videos.com") && probed.includes("videos.com"));
  });

  it("with every host reachable, nothing is asked: only the notes remain", async () => {
    const result = await run(context("nuvem-aberta", { CLAUDE_CODE_REMOTE: "true" }, cloudFetch(["api.coletor.com"])), ["add", "anuncios", "--yes", "--json"]);
    assert.deepEqual(result.network, { blocked: [], notes: ["o site da marca que você indicar"] });
  });

  it("an app that declares no network adds nothing", async () => {
    const result = await run(context("nuvem-roteiro", { CLAUDE_CODE_REMOTE: "true" }, cloudFetch([])), ["add", "roteiro", "--yes", "--json"]);
    assert.equal(result.ok, true);
    assert.equal(result.network, undefined);
  });

  it("doctor, at the start of a session, says what the installed apps still need", async () => {
    const result = await run(context("nuvem", { CLAUDE_CODE_REMOTE: "true" }, cloudFetch([])), ["doctor", "--json"]);
    const network = result.network as { blocked: string[]; message: string };
    assert.deepEqual(network.blocked, ["api.coletor.com"]);
    assert.match(network.message, /Domínios permitidos/);
  });

  it("outside a cloud session, nothing is probed and nothing is added", async () => {
    probed = [];
    const result = await run(context("computador", {}, cloudFetch([])), ["add", "anuncios", "--yes", "--json"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.network, undefined);
    assert.deepEqual(probed, []);
  });
});

describe("a key's page in a cloud session points to the environment", () => {
  it("names the network secret for an app that accepts it, and the environment variable", async () => {
    const result = await run(context("nuvem", { CLAUDE_CODE_REMOTE: "true" }), ["key", "set", "COLETOR_TOKEN", "--browser", "--json"]);
    assert.equal(result.ok, false);
    assert.equal(result.error, "no_browser");
    for (const words of ["segredo de rede do ambiente", "sem vê-la", "COLETOR_TOKEN=<a chave>", "Editar ambiente de nuvem", "Nunca peça a chave na conversa"]) {
      assert.ok(String(result.message).includes(words), `${words} missing in: ${result.message}`);
    }
  });
});
