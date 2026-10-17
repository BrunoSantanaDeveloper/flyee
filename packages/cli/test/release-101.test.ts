// What 1.0.1 fixes, one test per defect found by running the published 1.0.0 outside Windows and in the
// cloud: the CLI silent on macOS and Linux (npm starts it through a link), the browser login cut at the first
// `&` on Windows, the cloud's proxy ignored by Node's fetch, the browser paths offered where no browser is in
// front of the person, apt with empty package lists, and AI tools never detected by their binary.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, describe, it } from "node:test";

import { fetchFailure } from "../src/api/errors.ts";
import { createContext } from "../src/context.ts";
import { loadCoreAssets } from "../src/core-assets.ts";
import { isEntryScript, nodeHonorsEnvProxy, parseArgs, proxyRelaunchEnv, runCommand } from "../src/main.ts";
import { ensureProgram, type RunResult } from "../src/programs.ts";
import { BROWSER_SPAWN_OPTIONS, browserCommand, hasBinary, isWsl, noBrowserReason, openBrowser } from "../src/util/os.ts";

let sandbox: string;
before(() => {
  sandbox = mkdtempSync(join(tmpdir(), "flyee-101-"));
});
after(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe("the CLI runs when npm starts it through a link (macOS and Linux)", () => {
  it("compares the real paths, so .bin/flyee pointing to dist/flyee.js is the entry", (t) => {
    const real = join(sandbox, "pkg", "dist", "flyee.js");
    mkdirSync(join(sandbox, "pkg", "dist"), { recursive: true });
    mkdirSync(join(sandbox, "bin"), { recursive: true });
    writeFileSync(real, "// the bundle\n");
    const link = join(sandbox, "bin", "flyee");
    try {
      symlinkSync(real, link, "file");
    } catch {
      // Windows without the privilege to create links: npm uses a .cmd shim there, which passes the real path.
      t.skip("no permission to create a symbolic link on this machine");
      return;
    }
    const moduleUrl = pathToFileURL(real).href;
    assert.equal(isEntryScript(link, moduleUrl), true, "the link npm creates is the entry");
    assert.equal(isEntryScript(real, moduleUrl), true, "the real path too");
    assert.equal(isEntryScript(join(sandbox, "bin", "outro"), moduleUrl), false, "a path that does not exist is not");
    assert.equal(isEntryScript(undefined, moduleUrl), false);
  });

  it("is not the entry when a test imports it", () => {
    const self = join(sandbox, "teste.mjs");
    writeFileSync(self, "");
    assert.equal(isEntryScript(self, pathToFileURL(join(sandbox, "pkg", "dist", "flyee.js")).href), false);
  });
});

describe("the browser opens the whole address on Windows", () => {
  const url = "https://flyee.club/oauth/authorize?response_type=code&client_id=flyee-cli&redirect_uri=http%3A%2F%2F127.0.0.1%3A5123%2Fcallback&state=abc";

  it("never goes through cmd, which reads every & as the end of a command", () => {
    const windows = browserCommand(url, "win32");
    assert.equal(windows.file, "rundll32");
    assert.deepEqual(windows.args, ["url.dll,FileProtocolHandler", url], "the URL travels whole, as one argument");
    assert.notEqual(windows.file.toLowerCase(), "cmd");
    assert.deepEqual(browserCommand(url, "darwin"), { file: "open", args: [url] });
    assert.deepEqual(browserCommand(url, "linux", { PATH: "" }), { file: "xdg-open", args: [url] });
  });

  it("reaches a program spawned the same way with every parameter (the 1.0.0 lost all but the first)", async () => {
    const echoed = await new Promise<string>((resolve, reject) => {
      execFile(process.execPath, ["-e", "process.stdout.write(process.argv[1])", url], (error, stdout) => (error ? reject(error) : resolve(stdout)));
    });
    assert.equal(echoed, url);
  });

  it("starts the browser without a hidden window, which a browser not yet open would keep for its first window", () => {
    assert.equal("windowsHide" in BROWSER_SPAWN_OPTIONS, false);
    assert.equal(BROWSER_SPAWN_OPTIONS.detached, true);
  });

  it("hands only web addresses to the system's URL handler", async () => {
    assert.equal(await openBrowser("file:///C:/Windows/System32/notepad.exe"), false);
    assert.equal(await openBrowser("javascript:alert(1)"), false);
  });

  it("in WSL opens the Windows browser, which is the one in front of the person", (t) => {
    const wsl = { WSL_DISTRO_NAME: "Ubuntu", PATH: "" };
    assert.equal(isWsl(wsl, "linux"), true);
    assert.equal(isWsl({ WSL_INTEROP: "/run/WSL/1_interop" }, "linux"), true);
    assert.equal(isWsl(wsl, "win32"), false);
    assert.equal(isWsl({}, "linux"), false);
    assert.deepEqual(browserCommand(url, "linux", wsl), { file: "rundll32.exe", args: ["url.dll,FileProtocolHandler", url] }, "through Windows interop");
    if (process.platform === "win32") {
      t.skip("a Linux PATH of real folders cannot be written on Windows");
      return;
    }
    const dir = join(sandbox, "wsl-bin");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "wslview"), "");
    assert.deepEqual(browserCommand(url, "linux", { WSL_DISTRO_NAME: "Ubuntu", PATH: dir }), { file: "wslview", args: [url] });
  });
});

describe("no browser in front of the person: a cloud session, SSH, a Linux with no screen", () => {
  it("is told apart from a desktop", () => {
    assert.equal(noBrowserReason({ CLAUDE_CODE_REMOTE: "true" }, "linux"), "cloud");
    assert.equal(noBrowserReason({ CLAUDE_CODE_REMOTE: "true", DISPLAY: ":0" }, "linux"), "cloud");
    assert.equal(noBrowserReason({ SSH_CONNECTION: "10.0.0.2 51000 10.0.0.1 22" }, "darwin"), "ssh");
    assert.equal(noBrowserReason({ SSH_TTY: "/dev/pts/0" }, "win32"), "ssh");
    assert.equal(noBrowserReason({}, "linux"), "no_display");
    assert.equal(noBrowserReason({ DISPLAY: ":0" }, "linux"), null);
    assert.equal(noBrowserReason({ WAYLAND_DISPLAY: "wayland-0" }, "linux"), null);
    assert.equal(noBrowserReason({}, "win32"), null);
    assert.equal(noBrowserReason({}, "darwin"), null);
    assert.equal(noBrowserReason({ CLAUDE_CODE_REMOTE: "false" }, "win32"), null);
  });

  it("counts WSL as a desktop with no display variable, unless it is reached by SSH or runs in the cloud", () => {
    assert.equal(noBrowserReason({ WSL_DISTRO_NAME: "Ubuntu" }, "linux"), null, "the Windows browser reaches WSL's 127.0.0.1");
    assert.equal(noBrowserReason({ WSL_INTEROP: "/run/WSL/1_interop" }, "linux"), null);
    assert.equal(noBrowserReason({ WSL_DISTRO_NAME: "Ubuntu", SSH_CONNECTION: "10.0.0.2 51000 10.0.0.1 22" }, "linux"), "ssh");
    assert.equal(noBrowserReason({ WSL_DISTRO_NAME: "Ubuntu", CLAUDE_CODE_REMOTE: "true" }, "linux"), "cloud");
  });

  type Fetch = typeof fetch;
  const offline: (calls: string[]) => Fetch = (calls) =>
    (async (input: string | URL | Request) => {
      calls.push(String(input));
      throw new Error("offline in this test");
    }) as Fetch;

  function remoteContext(env: Record<string, string>, lines: string[], calls: string[], options: { fetch?: Fetch; opened?: boolean } = {}) {
    return createContext({
      baseUrl: "https://flyee.invalid",
      homeDir: join(sandbox, "home"),
      cwd: join(sandbox, "project"),
      env: { PATH: "", ...env },
      locale: "pt-BR",
      fetch: options.fetch ?? offline(calls),
      io: { out: (line) => lines.push(line), err: (line) => lines.push(line), openBrowser: async () => options.opened ?? true },
    });
  }

  it("login without --device answers at once with the login by code, before any call", async () => {
    const lines: string[] = [];
    const calls: string[] = [];
    const result = await runCommand(remoteContext({ CLAUDE_CODE_REMOTE: "true" }, lines, calls), parseArgs(["login"]));
    assert.equal(result.ok, false);
    assert.equal(result.error, "no_browser");
    assert.equal(result.reason, "cloud");
    assert.equal(result.fix, "npx --yes flyee@latest login --device");
    assert.match(String(result.message), /`npx --yes flyee@latest login --device`/);
    assert.match(String(result.message), /sessão na nuvem/);
    assert.deepEqual(calls, [], "no 5 minute wait, no call to the platform");
  });

  it("keeps the options the AI passed in the command it offers", async () => {
    const result = await runCommand(remoteContext({ SSH_TTY: "/dev/pts/0" }, [], []), parseArgs(["login", "--name", "notebook do estúdio", "--kind", "client", "--json"]));
    assert.equal(result.reason, "ssh");
    assert.equal(result.fix, 'npx --yes flyee@latest login --name "notebook do estúdio" --kind client --device');
  });

  it("login --device still runs there (it reaches the platform)", async () => {
    const lines: string[] = [];
    const calls: string[] = [];
    await assert.rejects(runCommand(remoteContext({ CLAUDE_CODE_REMOTE: "true" }, lines, calls), parseArgs(["login", "--device"])));
    assert.ok(calls.some((url) => url.includes("/api/cli/version")), "past the browser check, into the version check");
  });

  it("login ends at once with the login by code when the browser does not open, instead of waiting 5 minutes", async () => {
    const lines: string[] = [];
    const calls: string[] = [];
    const platform = (async (input: string | URL | Request) => {
      calls.push(String(input));
      if (String(input).endsWith("/api/cli/version")) {
        return new Response(JSON.stringify({ min_cli_version: "0.1.0", latest_core_version: null, deprecations: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`unexpected call ${String(input)}`);
    }) as Fetch;
    const started = Date.now();
    const result = await runCommand(remoteContext({ DISPLAY: ":0" }, lines, calls, { fetch: platform, opened: false }), parseArgs(["login"]));
    assert.equal(result.ok, false);
    assert.equal(result.error, "no_browser");
    assert.equal(result.reason, "no_opener");
    assert.equal(result.fix, "npx --yes flyee@latest login --device");
    assert.match(String(result.message), /navegador não abriu/);
    assert.ok(Date.now() - started < 30_000);
    assert.ok(!calls.some((url) => url.includes("/api/oauth/")), "no token was asked for");
    assert.ok(!lines.some((line) => line.includes("/oauth/authorize")), "no address printed for a browser that did not open");
  });

  it("key set --browser says no page can reach the person, instead of reporting a page that opened for no one", async () => {
    const lines: string[] = [];
    const calls: string[] = [];
    const result = await runCommand(remoteContext({ SSH_CONNECTION: "10.0.0.2 51000 10.0.0.1 22" }, lines, calls), parseArgs(["key", "set", "GEMINI_API_KEY", "--browser", "--json"]));
    assert.equal(result.ok, false);
    assert.equal(result.error, "no_browser");
    assert.equal(result.reason, "ssh");
    assert.match(String(result.message), /variável de ambiente GEMINI_API_KEY/);
    assert.match(String(result.message), /computador com navegador/);
    assert.ok(!("url" in result), "no 127.0.0.1 address for someone who cannot open it");
  });

  it("key set gives the address, without claiming it opened, when the browser does not open", async () => {
    const lines: string[] = [];
    const ctx = createContext({
      baseUrl: "https://flyee.invalid",
      homeDir: join(sandbox, "home-key"),
      cwd: join(sandbox, "project-key"),
      env: { PATH: "", DISPLAY: ":0" },
      locale: "pt-BR",
      io: {
        out: (line) => lines.push(line),
        err: (line) => lines.push(line),
        // The person opens the address by hand and pastes the key.
        openBrowser: async (url) => {
          setTimeout(() => void fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "value=chave-colada-a-mao" }), 10);
          return false;
        },
      },
    });
    const result = await runCommand(ctx, parseArgs(["key", "set", "GEMINI_API_KEY", "--browser", "--wait"]));
    assert.equal(result.ok, true, JSON.stringify(result));
    const told = lines.join("\n");
    assert.match(told, /não abriu sozinho/);
    assert.ok(told.includes(String(result.url)), "the address goes to the person");
    assert.ok(!told.includes("Abri uma página"), "it does not say it opened a page");
    assert.ok(!told.includes("chave-colada-a-mao"), "the value is never printed");
  });
});

describe("a proxy in HTTPS_PROXY (every request of a Claude Code cloud session goes through one)", () => {
  const recent = "22.23.3";

  it("starts the CLI again with NODE_USE_ENV_PROXY=1, once", () => {
    const relaunch = proxyRelaunchEnv({ HTTPS_PROXY: "http://proxy:3128", PATH: "/usr/bin" }, recent);
    assert.equal(relaunch?.NODE_USE_ENV_PROXY, "1");
    assert.equal(relaunch?.HTTPS_PROXY, "http://proxy:3128");
    assert.equal(relaunch?.PATH, "/usr/bin");
    assert.equal(relaunch?.NODE_NO_WARNINGS, undefined, "warnings stay on, a certificate warning among them");
    assert.equal(proxyRelaunchEnv(relaunch!, recent), null, "the child does not start another one");
    assert.equal(proxyRelaunchEnv({ https_proxy: "http://proxy:3128" }, recent)?.NODE_USE_ENV_PROXY, "1");
    assert.equal(proxyRelaunchEnv({ HTTP_PROXY: "http://proxy:3128" }, recent)?.NODE_USE_ENV_PROXY, "1");
    assert.equal(proxyRelaunchEnv({ HTTPS_PROXY: "https://user:secret@proxy:3128" }, recent)?.NODE_USE_ENV_PROXY, "1");
    assert.equal(proxyRelaunchEnv({ PATH: "/usr/bin" }, recent), null, "no proxy, nothing to do");
    assert.equal(proxyRelaunchEnv({ HTTPS_PROXY: "" }, recent), null);
    assert.equal(proxyRelaunchEnv({ HTTPS_PROXY: "http://proxy:3128", NODE_USE_ENV_PROXY: "0" }, recent), null, "the person's own choice stays");
  });

  it("only on a Node whose fetch honors the variable (22.21 or later, every 24 or later)", () => {
    assert.equal(nodeHonorsEnvProxy("20.19.5"), false);
    assert.equal(nodeHonorsEnvProxy("22.20.0"), false);
    assert.equal(nodeHonorsEnvProxy("22.21.0"), true);
    assert.equal(nodeHonorsEnvProxy("23.11.1"), false);
    assert.equal(nodeHonorsEnvProxy("24.0.0"), true);
    assert.equal(nodeHonorsEnvProxy("25.1.0"), true);
    assert.equal(proxyRelaunchEnv({ HTTPS_PROXY: "http://proxy:3128" }, "20.19.5"), null, "a second process for nothing");
  });

  it("never with a value Node would die on at startup, which 1.0.0 simply ignored", () => {
    for (const value of ["127.0.0.1:7890", "localhost:7890", "proxy.local", "socks5h://127.0.0.1:1080", "socks5://proxy:1080", '"http://proxy:3128"']) {
      assert.equal(proxyRelaunchEnv({ HTTPS_PROXY: value }, recent), null, value);
    }
    assert.equal(proxyRelaunchEnv({ HTTPS_PROXY: "http://proxy:3128", HTTP_PROXY: "socks5://proxy:1080" }, recent), null, "one bad value is enough");
  });

  it("keeps calls to this machine out of the proxy, next to the person's own exceptions", () => {
    const relaunch = proxyRelaunchEnv({ HTTPS_PROXY: "http://proxy:3128", NO_PROXY: "intranet.local, 127.0.0.1" }, recent);
    assert.deepEqual(relaunch?.NO_PROXY?.split(","), ["intranet.local", "127.0.0.1", "localhost", "[::1]"]);
    assert.deepEqual(relaunch?.no_proxy?.split(","), ["intranet.local", "127.0.0.1", "localhost", "[::1]"]);
    assert.deepEqual(proxyRelaunchEnv({ HTTPS_PROXY: "http://proxy:3128" }, recent)?.NO_PROXY?.split(","), ["127.0.0.1", "localhost", "[::1]"]);
  });
});

describe("a platform out of reach says why (a cloud session needs it to tell a refused domain from a certificate)", () => {
  const failed = (code: string, message: string) => new TypeError("fetch failed", { cause: Object.assign(new Error(message), { code }) });

  it("keeps the cause Node hides behind fetch failed", () => {
    assert.equal(
      fetchFailure(failed("UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "unable to get local issuer certificate")),
      "fetch failed (UNABLE_TO_GET_ISSUER_CERT_LOCALLY: unable to get local issuer certificate)",
    );
    assert.equal(fetchFailure(new TypeError("fetch failed")), "fetch failed");
    assert.equal(fetchFailure(new Error("offline in this test")), "offline in this test");
    assert.ok(fetchFailure(failed("X", "y".repeat(500))).length <= 300);
  });

  it("doctor answers reachable false with the reason, in the JSON and in the line it prints", async () => {
    const lines: string[] = [];
    const ctx = createContext({
      baseUrl: "https://flyee.invalid",
      homeDir: join(sandbox, "home-doctor"),
      cwd: join(sandbox, "project-doctor"),
      env: { PATH: "" },
      locale: "pt-BR",
      fetch: (async () => {
        throw failed("ENOTFOUND", "getaddrinfo ENOTFOUND flyee.invalid");
      }) as typeof fetch,
      io: { out: (line) => lines.push(line), err: (line) => lines.push(line) },
    });
    mkdirSync(join(sandbox, "project-doctor"), { recursive: true });
    const result = await runCommand(ctx, parseArgs(["doctor", "--json"]));
    const platform = result.platform as { reachable: boolean; error?: string };
    assert.equal(platform.reachable, false);
    assert.match(String(platform.error), /ENOTFOUND/);
    assert.ok(lines.some((line) => line.includes("não alcançável") && line.includes("ENOTFOUND")), lines.join("\n"));
  });
});

describe("apt on a fresh image, with empty package lists", () => {
  const ffmpeg = loadCoreAssets().programs.get("ffmpeg")!;
  const managers = () => new Map<string, string>([["apt-get", "/usr/bin/apt-get"], ["sudo", "/usr/bin/sudo"]]);

  /** apt that knows no package until a refresh; `refresh` is what the refresh answers. */
  function aptMachine(refresh: RunResult, options: { installsAfterRefresh?: boolean; firstAnswer?: string } = {}) {
    const found = managers();
    const calls: { args: string[]; env?: Record<string, string> }[] = [];
    let listed = false;
    const run = (file: string, args: string[], env?: Record<string, string>): RunResult => {
      calls.push({ args: [file, ...args], env });
      if (args.includes("update")) {
        listed = true;
        return refresh;
      }
      if (!listed || options.installsAfterRefresh === false) return { status: 100, stdout: "Reading package lists...", stderr: options.firstAnswer ?? "E: Unable to locate package ffmpeg" };
      found.set("ffmpeg", "/usr/bin/ffmpeg");
      found.set("ffprobe", "/usr/bin/ffprobe");
      return { status: 0, stdout: "Setting up ffmpeg", stderr: "" };
    };
    return { find: (binary: string) => found.get(binary) ?? null, run, calls };
  }

  it("refreshes the lists once and installs", () => {
    const machine = aptMachine({ status: 0, stdout: "", stderr: "" });
    const result = ensureProgram(ffmpeg, { os: "linux", ...machine });
    assert.equal(result.status, "installed", JSON.stringify(result));
    assert.equal(machine.calls.length, 3);
    const [first, refresh, again] = machine.calls.map((call) => call.args);
    assert.ok(first.includes("install") && again.includes("install"), JSON.stringify(machine.calls));
    assert.ok(refresh.includes("update") && !refresh.includes("install"), "the refresh is apt-get update, the same way as the install");
    assert.equal(refresh[0], first[0], "as root or through sudo, like the install");
  });

  it("runs apt in the C locale, so its answer reads the same on a machine in Portuguese", () => {
    const machine = aptMachine({ status: 0, stdout: "", stderr: "" });
    ensureProgram(ffmpeg, { os: "linux", ...machine });
    for (const call of machine.calls) {
      assert.equal(call.env?.LC_ALL, "C");
      assert.equal(call.env?.DEBIAN_FRONTEND, "noninteractive");
    }
  });

  it("also refreshes when apt asks for it, with archives that moved", () => {
    const machine = aptMachine({ status: 0, stdout: "", stderr: "" }, { firstAnswer: "E: Unable to fetch some archives, maybe run apt-get update or try with --fix-missing?" });
    assert.equal(ensureProgram(ffmpeg, { os: "linux", ...machine }).status, "installed");
    assert.equal(machine.calls.length, 3);
  });

  it("installs again when the refresh fails on one source, since the others were read", () => {
    const machine = aptMachine({ status: 100, stdout: "", stderr: "E: The repository 'https://ppa.example/ubuntu noble Release' does not have a Release file." });
    const result = ensureProgram(ffmpeg, { os: "linux", ...machine });
    assert.equal(result.status, "installed", JSON.stringify(result));
    assert.equal(machine.calls.length, 3);
  });

  it("says what the refresh refused when the install still fails", () => {
    const machine = aptMachine({ status: 100, stdout: "", stderr: "W: Some index files failed to download.\nE: Failed to fetch http://archive.ubuntu.com/ubuntu/dists/noble/InRelease  Could not resolve 'archive.ubuntu.com'" }, { installsAfterRefresh: false });
    const result = ensureProgram(ffmpeg, { os: "linux", ...machine });
    assert.equal(result.status, "failed");
    assert.match(String(result.detail), /Unable to locate package ffmpeg/);
    assert.match(String(result.detail), /Could not resolve 'archive\.ubuntu\.com'/);
  });

  it("does not refresh for any other failure", () => {
    const calls: string[][] = [];
    const run = (file: string, args: string[]): RunResult => {
      calls.push([file, ...args]);
      return { status: 100, stdout: "", stderr: "E: Could not get lock /var/lib/dpkg/lock-frontend" };
    };
    const found = managers();
    const result = ensureProgram(ffmpeg, { os: "linux", find: (binary) => found.get(binary) ?? null, run });
    assert.equal(result.status, "failed");
    assert.ok(!calls.some((call) => call.includes("update")));
  });
});

describe("AI tools are detected by their binary on PATH", () => {
  const windows = process.platform === "win32";

  it("finds a file in a PATH folder (the 1.0.0 bundle never did: require() threw in ESM)", () => {
    const dir = join(sandbox, "path-bin");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, windows ? "claude.cmd" : "claude"), "");
    const env = windows ? { Path: dir, PATHEXT: ".EXE;.CMD" } : { PATH: dir };
    assert.equal(hasBinary("claude", env), true);
    assert.equal(hasBinary("codex", env), false);
    assert.equal(hasBinary("claude", { PATH: "" }), false);
  });

  it("reads a quoted PATH entry and never takes a folder for a program, like findProgram", () => {
    const dir = join(sandbox, "path-quoted");
    mkdirSync(join(dir, windows ? "codex.cmd" : "codex"), { recursive: true });
    writeFileSync(join(dir, windows ? "gemini.cmd" : "gemini"), "");
    const quoted = `"${dir}"`;
    const env = windows ? { Path: quoted, PATHEXT: ".EXE;.CMD" } : { PATH: quoted };
    assert.equal(hasBinary("gemini", env), true, "Windows keeps quotes around a PATH folder with a separator inside");
    assert.equal(hasBinary("codex", env), false, "a folder with the program's name is not the program");
  });
});
