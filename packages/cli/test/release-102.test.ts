// What 1.0.2 changes, from the first installs in the Claude Code desktop app and in a cloud session: an
// account with nothing bought was told it had no access to the apps, when it installs the entry version of
// each app (CLI-CONTRACT.md 4.3); and a cloud session whose environment does not allow flyee.club got
// "fetch failed (Request was cancelled.)", which its AI read as a site that does not exist.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { CliError, fetchFailure } from "../src/api/errors.ts";
import { loginWithDeviceCode } from "../src/api/oauth.ts";
import { proxyIgnored, reach, refusalOf, refusedResponse } from "../src/api/network.ts";
import { type Context, createContext } from "../src/context.ts";
import { describeFailure, nodeHonorsEnvProxy, parseArgs, runCommand } from "../src/main.ts";
import { type FakePlatform, startFakePlatform } from "./fake-platform.ts";

let sandbox: string;
let entry: FakePlatform;
let output: string[] = [];

function makeContext(platform: FakePlatform, home: string, env: Record<string, string> = {}): Context {
  return createContext({
    baseUrl: platform.baseUrl,
    homeDir: join(sandbox, home),
    cwd: join(sandbox, "project"),
    yes: true,
    locale: "pt-BR",
    env: { PATH: "", ...env },
    io: { out: (line) => output.push(line), err: (line) => output.push(line), confirm: async () => true, openBrowser: async () => true },
  });
}

async function run(ctx: Context, argv: string[]) {
  output = [];
  return runCommand(ctx, parseArgs(argv));
}

/** The shapes Node's fetch threw in the measurements of 2026-10-17 (Node 22.21, 22.23, 24.14, 24.22). */
const measured = {
  tunnelRefused: (status = 403) =>
    new TypeError("fetch failed", {
      cause: Object.assign(new Error("Request was cancelled."), {
        name: "AbortError",
        code: 0,
        cause: Object.assign(new Error(`Proxy response (${status}) !== 200 when HTTP Tunneling`), { name: "AbortError", code: "UND_ERR_ABORTED" }),
      }),
    }),
  certificate: (code: string) => new TypeError("fetch failed", { cause: Object.assign(new Error("self-signed certificate; if the root CA is installed locally, try running Node.js with --use-system-ca"), { code }) }),
  dns: () => new TypeError("fetch failed", { cause: Object.assign(new Error("getaddrinfo ENOTFOUND flyee.invalid"), { code: "ENOTFOUND" }) }),
  refusedBoth: () =>
    new TypeError("fetch failed", {
      cause: Object.assign(new AggregateError([Object.assign(new Error("connect ECONNREFUSED ::1:9"), { code: "ECONNREFUSED" }), Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:9"), { code: "ECONNREFUSED" })]), { code: "ECONNREFUSED" }),
    }),
};

before(async () => {
  sandbox = mkdtempSync(join(tmpdir(), "flyee-102-"));
  mkdirSync(join(sandbox, "project"), { recursive: true });
  entry = await startFakePlatform({ tier: null, modules: [], recipes: [] });
});

after(async () => {
  await entry.close();
  rmSync(sandbox, { recursive: true, force: true });
});

describe("an account with nothing bought installs the entry version of each app", () => {
  it("is told so at login, with what the paid access adds, and never that it has no access", async () => {
    const result = await run(makeContext(entry, "home-entry"), ["login", "--device"]);
    assert.equal(result.ok, true, JSON.stringify(result));
    const told = output.join("\n");
    assert.match(told, /versão de entrada de cada app/);
    assert.match(told, /libera a versão atual e as próximas/);
    assert.doesNotMatch(told, /não tem acesso|sem acesso/);
  });

  it("status names the entry version where a paid account shows its rung, with the days of the connection", async () => {
    await run(makeContext(entry, "home-entry"), ["status"]);
    const line = output.find((text) => text.startsWith("Conectado")) ?? "";
    assert.match(line, /versão de entrada de cada app/);
    assert.match(line, /a conexão vale por mais \d+ dias/);
    assert.doesNotMatch(output.join("\n"), /sem acesso/);
  });
});

describe("a refusal by the network is told apart from an ordinary failure", () => {
  it("finds a tunnel answered 403 two causes deep, where the 403 and its headers never reach the caller", () => {
    assert.deepEqual(refusalOf(measured.tunnelRefused()), { kind: "proxy", status: 403 });
    assert.equal(refusalOf(measured.tunnelRefused(407)), null, "407 asks for credentials, it is not a refusal of the host");
    assert.equal(refusalOf(measured.tunnelRefused(502)), null, "502 means the proxy could not reach the host");
  });

  it("names a certificate by its code, never by its message", () => {
    for (const code of ["DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "ERR_TLS_CERT_ALTNAME_INVALID", "CERT_HAS_EXPIRED"]) {
      const cause = code === "CERT_HAS_EXPIRED" ? "clock" : code === "ERR_TLS_CERT_ALTNAME_INVALID" ? "name" : "untrusted";
      assert.deepEqual(refusalOf(measured.certificate(code)), { kind: "certificate", code, cause });
    }
  });

  it("never fires for a name that does not resolve, a refused connection or a timeout", () => {
    assert.equal(refusalOf(measured.dns()), null);
    assert.equal(refusalOf(measured.refusedBoth()), null);
    assert.equal(refusalOf(Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError", code: 23 })), null);
  });

  it("reads a response a proxy wrote in place of the platform's", () => {
    assert.equal(refusedResponse(new Response("Host not allowed", { status: 403, headers: { "x-deny-reason": "host_not_allowed" } })), "host_not_allowed");
    assert.equal(refusedResponse(new Response("{}", { status: 403 })), null, "the platform's own 403 carries no x-deny-reason");
    assert.equal(refusedResponse(new Response("ok", { status: 200, headers: { "x-deny-reason": "x" } })), null);
  });

  it("walks the whole chain for the detail of an ordinary failure", () => {
    assert.equal(fetchFailure(measured.tunnelRefused(407)), "fetch failed (Request was cancelled.; UND_ERR_ABORTED: Proxy response (407) !== 200 when HTTP Tunneling)");
    assert.match(fetchFailure(measured.refusedBoth()), /ECONNREFUSED/);
  });
});

describe("a host out of reach becomes one answer the AI can act on", () => {
  const tunnel = (async () => {
    throw measured.tunnelRefused();
  }) as typeof fetch;

  function context(env: Record<string, string>, fetcher: typeof fetch, deadline?: number) {
    return createContext({ baseUrl: "https://flyee.club", homeDir: join(sandbox, "home-net"), cwd: join(sandbox, "project"), env: { PATH: "", ...env }, locale: "pt-BR", fetch: fetcher, headersDeadlineMs: deadline, io: { out: (line) => output.push(line), err: (line) => output.push(line) } });
  }

  async function failureOf(ctx: Context, url: string) {
    try {
      await reach(ctx, url);
    } catch (error) {
      return describeFailure(ctx, error);
    }
    throw new Error("reach did not fail");
  }

  it("in a cloud session, names the host and the one-time step on the session's environment", async () => {
    const failure = await failureOf(context({ CLAUDE_CODE_REMOTE: "true" }, tunnel), "https://flyee.club/api/cli/version");
    assert.equal(failure.error, "host_not_allowed");
    assert.equal(failure.host, "flyee.club");
    assert.equal(failure.cloud, true);
    // The labels of claude.ai's screen in Portuguese, from the operator's screenshots of 2026-10-20.
    for (const words of ["flyee.club", "Editar ambiente de nuvem", "Acesso à rede", "Limitado", "Domínios permitidos", "Permitir gerenciadores de pacotes", "Salvar alterações", "cerca de um minuto"]) {
      assert.ok(failure.message.includes(words), `${words} missing in: ${failure.message}`);
    }
    // In English, the documented labels; the level's name differs between the documentation and the screen.
    const english = describeFailure(createContext({ baseUrl: "https://flyee.club", homeDir: join(sandbox, "home-net"), cwd: join(sandbox, "project"), env: { PATH: "", CLAUDE_CODE_REMOTE: "true" }, locale: "en", io: { out: () => undefined, err: () => undefined } }), new CliError("host_not_allowed", "refused", undefined, { host: "flyee.club", cloud: true }));
    for (const words of ["flyee.club", "Edit cloud environment", "Network access", "Custom or Limited", "Allowed domains", "package managers", "Save changes"]) {
      assert.ok(english.message.includes(words), `${words} missing in: ${english.message}`);
    }
  });

  it("names the host of a package URL the platform gave, not the platform's", async () => {
    const failure = await failureOf(context({ CLAUDE_CODE_REMOTE: "true" }, tunnel), "https://projeto.supabase.co/storage/v1/object/sign/modules/x.zip?token=t");
    assert.equal(failure.host, "projeto.supabase.co");
    assert.match(failure.message, /projeto\.supabase\.co/);
  });

  it("outside the cloud, says a proxy of this network refused the host", async () => {
    const failure = await failureOf(context({}, tunnel), "https://flyee.club/api/cli/version");
    assert.equal(failure.error, "host_not_allowed");
    assert.equal(failure.cloud, false);
    assert.match(failure.message, /proxy desta rede recusou a conexão com flyee\.club/);
  });

  it("reads the refusal of a proxy that inspects TLS, written as a response", async () => {
    const written = (async () => new Response("Host not allowed", { status: 403, headers: { "x-deny-reason": "host_not_allowed" } })) as typeof fetch;
    const failure = await failureOf(context({ CLAUDE_CODE_REMOTE: "true" }, written), "https://flyee.club/api/cli/version");
    assert.equal(failure.error, "host_not_allowed");
    assert.equal(failure.reason, "host_not_allowed");
  });

  it("a certificate is the proxy in a cloud session, and the network's inspection elsewhere", async () => {
    const swapped = (async () => {
      throw measured.certificate("SELF_SIGNED_CERT_IN_CHAIN");
    }) as typeof fetch;
    assert.equal((await failureOf(context({ CLAUDE_CODE_REMOTE: "true" }, swapped), "https://flyee.club/x")).error, "host_not_allowed");
    const local = await failureOf(context({}, swapped), "https://flyee.club/x");
    assert.equal(local.error, "certificate");
    assert.match(local.message, /SELF_SIGNED_CERT_IN_CHAIN/);
  });

  it("gives up on a host that never answers, instead of waiting forever", async () => {
    const silent = ((_: unknown, init?: RequestInit) =>
      new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("This operation was aborted", "AbortError"))))) as typeof fetch;
    const started = Date.now();
    const local = await failureOf(context({}, silent, 50), "https://flyee.club/api/cli/version");
    assert.ok(Date.now() - started < 5000);
    assert.equal(local.error, "network");
    assert.match(local.message, /flyee\.club não respondeu em 1 s/);
    const cloud = await failureOf(context({ CLAUDE_CODE_REMOTE: "true" }, silent, 50), "https://flyee.club/api/cli/version");
    assert.equal(cloud.error, "host_not_allowed", "in a cloud session the proxy is the likeliest cause");
    assert.equal(cloud.reason, "no_answer");
  });

  it("doctor answers with the code, the message and the host", async () => {
    output = [];
    const result = await runCommand(context({ CLAUDE_CODE_REMOTE: "true" }, tunnel), parseArgs(["doctor", "--json"]));
    const platform = result.platform as { reachable: boolean; error?: string; message?: string; host?: string };
    assert.equal(platform.reachable, false);
    assert.equal(platform.error, "host_not_allowed");
    assert.equal(platform.host, "flyee.club");
    assert.match(String(platform.message), /Domínios permitidos/);
    assert.ok(output.some((line) => line.includes("Domínios permitidos")));
  });
});

describe("a cloud session's computer", () => {
  it("is named for what it is, not for the VM's throwaway host name", async () => {
    const platform = await startFakePlatform({ tier: "kit", modules: [], recipes: [] });
    try {
      const result = await run(makeContext(platform, "home-cloud", { CLAUDE_CODE_REMOTE: "true" }), ["login", "--device"]);
      assert.equal(result.ok, true, JSON.stringify(result));
      const reported = platform.state.installs.at(-1) as { name: string };
      assert.equal(reported.name, "Claude Code na nuvem");
    } finally {
      await platform.close();
    }
  });

  it("explains, past the platform's own message, that each cloud session counts as a computer today", async () => {
    const platform = await startFakePlatform({ tier: "kit", deviceLimit: 0, modules: [], recipes: [] });
    try {
      const result = await run(makeContext(platform, "home-cloud-full", { CLAUDE_CODE_REMOTE: "true" }), ["login", "--device"]);
      assert.equal(result.error, "device_limit_reached");
      assert.equal(result.cloud, true);
      assert.ok(output.some((line) => line.includes("cada sessão conta como um computador")), output.join("\n"));
    } finally {
      await platform.close();
    }
  });
});

describe("what the adversarial review of 1.0.2 asked for", () => {
  function context(env: Record<string, string>, fetcher: typeof fetch, home = "home-review") {
    return createContext({ baseUrl: "https://flyee.club", homeDir: join(sandbox, home), cwd: join(sandbox, "project"), env: { PATH: "", ...env }, locale: "pt-BR", fetch: fetcher, headersDeadlineMs: 50, io: { out: (line) => output.push(line), err: (line) => output.push(line) } });
  }
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  const silentOrAnswer = (answer: () => Response) => {
    let calls = 0;
    return ((_: unknown, init?: RequestInit) => {
      calls += 1;
      if (calls === 1) return Promise.resolve(answer());
      return new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    }) as typeof fetch;
  };

  it("in a cloud session, a host that already answered and then goes silent is not the allowlist", async () => {
    const ctx = context({ CLAUDE_CODE_REMOTE: "true" }, silentOrAnswer(() => json({ ok: true })));
    await reach(ctx, "https://flyee.club/api/cli/version");
    const failure = await reach(ctx, "https://flyee.club/api/cli/me").then(() => null, (error) => describeFailure(ctx, error));
    assert.equal(failure?.error, "network");
    assert.equal(failure?.reason, "no_answer");
  });

  it("a certificate out of its dates is this computer's clock, in a cloud session too", async () => {
    const ctx = context({ CLAUDE_CODE_REMOTE: "true" }, (async () => {
      throw measured.certificate("CERT_HAS_EXPIRED");
    }) as typeof fetch);
    const failure = await reach(ctx, "https://flyee.club/x").then(() => null, (error) => describeFailure(ctx, error));
    assert.equal(failure?.error, "certificate");
    assert.match(String(failure?.message), /relógio do computador/);
    assert.match(String(failure?.detail), /use-system-ca/, "Node's own text stays in the result");
  });

  it("a proxy that refuses for another reason is not told to allow the host", async () => {
    const ctx = context({ CLAUDE_CODE_REMOTE: "true" }, (async () => new Response("no", { status: 403, headers: { "x-deny-reason": "method_not_allowed" } })) as typeof fetch);
    const failure = await reach(ctx, "https://flyee.club/x").then(() => null, (error) => describeFailure(ctx, error));
    assert.equal(failure?.error, "network");
    assert.match(String(failure?.message), /method_not_allowed/);
  });

  it("a connection cut after the headers is a network error with the host, not an unexpected one", async () => {
    const cut = (async () => new Response(new ReadableStream({ start: (controller) => controller.error(new TypeError("terminated")) }))) as typeof fetch;
    const ctx = createContext({ baseUrl: "https://flyee.club", homeDir: join(sandbox, "home-cut"), cwd: join(sandbox, "project"), env: { PATH: "" }, locale: "pt-BR", fetch: cut, io: { out: () => undefined, err: () => undefined } });
    output = [];
    const result = await runCommand(ctx, parseArgs(["doctor", "--json"]));
    const platform = result.platform as { error?: string; host?: string };
    assert.equal(platform.error, "network");
    assert.equal(platform.host, "flyee.club");
  });

  it("a package URL that does not parse never puts its token in a message", async () => {
    const ctx = context({}, (async () => json({})) as typeof fetch);
    const failure = await reach(ctx, "not a url?token=segredo").then(() => null, (error) => describeFailure(ctx, error));
    assert.equal(failure?.error, "network");
    assert.doesNotMatch(JSON.stringify(failure), /segredo/);
  });

  it("names a proxy this Node goes around (before 22.21)", () => {
    assert.equal(proxyIgnored({ HTTPS_PROXY: "http://proxy:3128" }, "20.19.5"), true);
    assert.equal(proxyIgnored({ HTTPS_PROXY: "http://proxy:3128" }, "22.23.3"), false);
    assert.equal(proxyIgnored({}, "20.19.5"), false);
  });

  it("the login by code goes on after one poll the network lost", async () => {
    let polls = 0;
    const fetcher = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/api/oauth/device")) return json({ device_code: "d", user_code: "ABCD-EFGH", verification_uri: "https://flyee.club/ativar", expires_in: 600, interval: 1 });
      polls += 1;
      if (polls === 1) throw new TypeError("fetch failed", { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }) });
      return json({ access_token: "a", refresh_token: "r", token_type: "Bearer", expires_in: 3600, refresh_token_expires_in: 2592000, scope: "" });
    }) as typeof fetch;
    const tokens = await loginWithDeviceCode(context({}, fetcher), "device", () => undefined, async () => undefined);
    assert.equal(tokens.access_token, "a");
    assert.equal(polls, 2);
  });
});

describe("status tells what is wrong and what the account has", () => {
  it("shows the whole message of a refused host, with the host, and --quiet does not say it is disconnected", async () => {
    const platform = await startFakePlatform({ tier: "kit", modules: [], recipes: [] });
    try {
      const home = "home-status-blocked";
      assert.equal((await run(makeContext(platform, home), ["login", "--device"])).ok, true);
      const blocked = createContext({ baseUrl: platform.baseUrl, homeDir: join(sandbox, home), cwd: join(sandbox, "project"), env: { PATH: "", CLAUDE_CODE_REMOTE: "true" }, locale: "pt-BR", fetch: (async () => {
        throw measured.tunnelRefused();
      }) as typeof fetch, io: { out: (line) => output.push(line), err: (line) => output.push(line) } });
      output = [];
      const result = await runCommand(blocked, parseArgs(["status"]));
      assert.equal(result.connection_error, "host_not_allowed");
      assert.ok(String(result.connection_host).startsWith("127.0.0.1"));
      assert.match(String(result.connection_message), /Domínios permitidos/);
      assert.ok(output.some((line) => line.includes("Domínios permitidos")));
      output = [];
      await runCommand(Object.assign(blocked, { quiet: true }), parseArgs(["status", "--quiet"]));
      assert.ok(output.some((line) => line.includes("Domínios permitidos")), output.join("\n"));
      assert.ok(!output.some((line) => line.includes("não está conectado")));
    } finally {
      await platform.close();
    }
  });

  it("an inactive or suspended account with nothing bought is not told it installs the entry version", async () => {
    for (const [options, label] of [[{ accessActive: false }, "sem plano ativo"], [{ accessActive: false, suspended: true }, "conta suspensa"]] as const) {
      const platform = await startFakePlatform({ tier: null, modules: [], recipes: [], ...options });
      try {
        const home = `home-status-${label.replace(/\s/g, "-")}`;
        await run(makeContext(platform, home), ["login", "--device"]);
        const result = await run(makeContext(platform, home), ["status"]);
        const line = output.find((text) => text.startsWith("Conectado")) ?? "";
        assert.match(line, new RegExp(label));
        assert.doesNotMatch(line, /versão de entrada/);
        assert.equal(result.needs_attention, true);
      } finally {
        await platform.close();
      }
    }
  });
});

describe("a cloud computer's name", () => {
  it("never replaces a name the member gave", async () => {
    const platform = await startFakePlatform({ tier: "kit", modules: [], recipes: [] });
    try {
      const home = "home-cloud-named";
      assert.equal((await run(makeContext(platform, home, { CLAUDE_CODE_REMOTE: "true" }), ["login", "--device", "--name", "Estúdio"])).ok, true);
      assert.equal((await run(makeContext(platform, home, { CLAUDE_CODE_REMOTE: "true" }), ["login", "--device"])).ok, true);
      assert.equal((platform.state.installs.at(-1) as { name: string }).name, "Estúdio");
    } finally {
      await platform.close();
    }
  });
});

describe("through a real proxy that refuses the tunnel, as the cloud's does", () => {
  let proxy: Server;
  let port = 0;
  before(async () => {
    proxy = createServer((_, response) => response.writeHead(403, { "x-deny-reason": "host_not_allowed" }).end("Host not allowed"));
    proxy.on("connect", (_, socket) => socket.end("HTTP/1.1 403 Forbidden\r\nx-deny-reason: host_not_allowed\r\ncontent-length: 0\r\n\r\n"));
    await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
    port = (proxy.address() as { port: number }).port;
  });
  after(() => new Promise<void>((resolve) => proxy.close(() => resolve())));

  function cli(args: string[], env: Record<string, string>) {
    const main = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "main.ts");
    const home = join(sandbox, `home-proxy-${args[0]}-${Object.keys(env).join("-")}`);
    mkdirSync(home, { recursive: true });
    const base: Record<string, string | undefined> = { ...process.env, HOME: home, USERPROFILE: home, FLYEE_LOCALE: "pt-BR", HTTPS_PROXY: `http://127.0.0.1:${port}`, HTTP_PROXY: `http://127.0.0.1:${port}`, ...env };
    for (const name of ["NODE_USE_ENV_PROXY", "NO_PROXY", "no_proxy", "https_proxy", "http_proxy", "FLYEE_BASE_URL", "CLAUDE_CODE_REMOTE"]) if (!(name in env)) delete base[name];
    return new Promise<{ status: number; result: Record<string, unknown> }>((resolve, reject) => {
      execFile(process.execPath, ["--experimental-strip-types", "--no-warnings", main, ...args, "--json"], { cwd: join(sandbox, "project"), env: base, encoding: "utf8", timeout: 60_000 }, (error, stdout) => {
        try {
          // The final result is the last object that opens at the start of a line (progress lines come first).
          const text = stdout.trim();
          const start = text.lastIndexOf("\n{");
          resolve({ status: error ? Number((error as { code?: number }).code ?? 1) : 0, result: JSON.parse(start >= 0 ? text.slice(start + 1) : text) });
        } catch (cause) {
          reject(new Error(`not JSON: ${stdout}`, { cause }));
        }
      });
    });
  }

  it("doctor names flyee.club and the step on the environment", { skip: !nodeHonorsEnvProxy() && "this Node cannot route fetch through HTTPS_PROXY" }, async () => {
    const { result } = await cli(["doctor"], { CLAUDE_CODE_REMOTE: "true" });
    const platform = result.platform as { reachable: boolean; error?: string; host?: string; message?: string };
    assert.equal(platform.reachable, false);
    assert.equal(platform.error, "host_not_allowed");
    assert.equal(platform.host, "flyee.club");
    assert.match(String(platform.message), /Domínios permitidos/);
  });

  it("login --device stops at once with the same answer, instead of 'fetch failed (Request was cancelled.)'", { skip: !nodeHonorsEnvProxy() && "this Node cannot route fetch through HTTPS_PROXY" }, async () => {
    const { status, result } = await cli(["login", "--device"], { CLAUDE_CODE_REMOTE: "true" });
    assert.equal(status, 1);
    assert.equal(result.error, "host_not_allowed");
    assert.equal(result.host, "flyee.club");
    assert.doesNotMatch(String(result.message), /Request was cancelled/);
  });
});
