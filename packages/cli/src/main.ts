import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { ApiError, CliError } from "./api/errors.ts";
import { runAdd } from "./commands/add.ts";
import { runDev } from "./commands/dev.ts";
import { runDoctor } from "./commands/doctor.ts";
import { runKey } from "./commands/key.ts";
import { runLogin } from "./commands/login.ts";
import { runLogout } from "./commands/logout.ts";
import { runNeed } from "./commands/need.ts";
import { runNew } from "./commands/new.ts";
import { runProjects } from "./commands/projects.ts";
import { runRemove } from "./commands/remove.ts";
import { runStatus } from "./commands/status.ts";
import { runTrack } from "./commands/track.ts";
import { runUpdate } from "./commands/update.ts";
import type { Fail, ParsedArgs, Result } from "./commands/types.ts";
import { type Context, createContext, detectLocale, type Locale } from "./context.ts";
import { t } from "./i18n.ts";
import { readConfig } from "./state/config.ts";
import { openBrowser } from "./util/os.ts";
import { confirmOnTerminal, readAllStdin, readSecretOnTerminal } from "./util/prompt.ts";
import { CLI_VERSION } from "./version.ts";

export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith("--")) {
      const [name, inline] = arg.slice(2).split("=", 2);
      if (inline !== undefined) flags[name] = inline;
      else if (index + 1 < argv.length && !argv[index + 1].startsWith("--") && !BOOLEAN_FLAGS.has(name)) {
        flags[name] = argv[index + 1];
        index += 1;
      } else flags[name] = true;
    } else positionals.push(arg);
  }
  const [command, ...rest] = positionals;
  return { command, positionals: rest, flags };
}

const BOOLEAN_FLAGS = new Set(["json", "yes", "device", "dry-run", "quiet", "help", "version", "stdin", "browser", "wait", "upgrade"]);

/**
 * `npx flyee` with no command. The member's AI is who reads it, so the line
 * that says how to run a command says it as an AI must: `--yes` for npx, which
 * asks before downloading in a terminal, and `@latest`, as /instalar.md does.
 */
export function helpText(locale: Locale): string {
  return locale === "en"
    ? `flyee ${CLI_VERSION}

Run it as: npx --yes flyee@latest <command> [options]. The member's AI runs the commands; the member only confirms in the conversation.

  login [--device] [--name <computer>] [--kind own|client]   connects this computer to the account (opens the browser; --device shows a code)
  add <app> | add receita:<name> [--dry-run] [--yes]   installs an app (or a recipe's apps) into this project
  update                       updates the apps and renews the connection
  status [--quiet]             the connection, the apps and the notices
  doctor                       checks the installation, the programs and the keys
  remove <app>                 takes an app out of this project
  new <folder> [--apps a,b] [--kind own|client]   another project with the apps of this one: one per brand or client
  projects                     the projects with flyee apps on this computer
  need <program…> [--upgrade] [--yes]   installs the programs an app uses, such as ffmpeg and yt-dlp
  key set <NAME> --browser | key list | key remove <NAME>   the apps' keys, pasted in a page in the browser
  track <event> [--module <app>] [--version <v>] [--from <v>] [--to <v>] [--reason <r>] [--origin <o>]
  logout                       disconnects this computer

--json on any command prints one JSON object at the end; --yes confirms without asking.
https://flyee.club`
    : `flyee ${CLI_VERSION}

Rode assim: npx --yes flyee@latest <comando> [opções]. A IA do integrante roda os comandos; o integrante só confirma na conversa.

  login [--device] [--name <computador>] [--kind own|client]   conecta este computador à conta (abre o navegador; --device mostra um código)
  add <app> | add receita:<nome> [--dry-run] [--yes]   instala um app (ou os apps de uma receita) neste projeto
  update                       atualiza os apps e renova a conexão
  status [--quiet]             a conexão, os apps e os avisos
  doctor                       confere a instalação, os programas e as chaves
  remove <app>                 tira um app deste projeto
  new <pasta> [--apps a,b] [--kind own|client]   outro projeto com os apps deste: um por marca ou cliente
  projects                     os projetos com apps do flyee neste computador
  need <programa…> [--upgrade] [--yes]   instala os programas que um app usa, como ffmpeg e yt-dlp
  key set <NOME> --browser | key list | key remove <NOME>   as chaves dos apps, coladas numa página do navegador
  track <evento> [--module <app>] [--version <v>] [--from <v>] [--to <v>] [--reason <r>] [--origin <o>]
  logout                       desconecta este computador

--json em qualquer comando imprime um objeto JSON no fim; --yes confirma sem perguntar.
https://flyee.club`;
}

/** Runs a command against a context; used by main() and by the tests. */
export async function runCommand(ctx: Context, args: ParsedArgs): Promise<Result> {
  switch (args.command) {
    case "login":
      return runLogin(ctx, args);
    case "logout":
      return runLogout(ctx);
    case "add":
      return runAdd(ctx, args);
    case "remove":
      return runRemove(ctx, args);
    case "update":
      return runUpdate(ctx);
    case "status":
      return runStatus(ctx);
    case "doctor":
      return runDoctor(ctx);
    case "key":
      return runKey(ctx, args);
    case "need":
      return runNeed(ctx, args);
    case "new":
      return runNew(ctx, args);
    case "projects":
      return runProjects(ctx);
    case "track":
      return runTrack(ctx, args);
    case "dev":
      return runDev(ctx, args);
    default:
      return { ok: false, error: "usage", message: helpText(ctx.locale) };
  }
}

/** Turns any failure into the contract's shape and a line the member can act on. */
export function describeFailure(ctx: Context, error: unknown): Fail {
  if (error instanceof ApiError) {
    return { ok: false, error: error.code, message: error.message, action_url: error.actionUrl, status: error.status, ...error.extra };
  }
  if (error instanceof CliError) {
    const message =
      error.code === "cli_outdated"
        ? t(ctx, "error.min_version", { current: CLI_VERSION, min: error.message })
        : error.code === "not_logged"
          ? t(ctx, "error.not_logged")
          : error.code === "relogin" || error.code === "login_denied"
            ? t(ctx, "error.relogin")
            : error.code === "login_timeout"
              ? t(ctx, "login.timeout")
              : error.code === "network"
                ? t(ctx, "error.network", { detail: error.message })
                : error.code.startsWith("package_") || error.code === "download_failed"
                  ? t(ctx, "error.package", { detail: error.message })
                  : error.message;
    return { ok: false, error: error.code, message, action_url: error.actionUrl };
  }
  return { ok: false, error: "unexpected", message: t(ctx, "error.unknown", { detail: error instanceof Error ? error.message : String(error) }) };
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const args = parseArgs(argv);
  if (args.flags.version) {
    process.stdout.write(`${CLI_VERSION}\n`);
    return 0;
  }
  if (!args.command || args.flags.help || args.command === "help") {
    process.stdout.write(`${helpText(readConfig(createContext())?.locale ?? detectLocale(process.env))}\n`);
    return args.command ? 0 : 2;
  }
  const json = args.flags.json === true;
  const yes = args.flags.yes === true;
  const lines: string[] = [];
  const ctx = createContext({
    json,
    yes,
    dryRun: args.flags["dry-run"] === true,
    quiet: args.flags.quiet === true,
    baseUrl: typeof args.flags.base === "string" ? args.flags.base : undefined,
    cliEntry: process.argv[1],
    io: {
      out: (line) => (json ? lines.push(line) : process.stdout.write(`${line}\n`)),
      err: (line) => (json ? lines.push(line) : process.stderr.write(`${line}\n`)),
      confirm: (question) => (yes ? Promise.resolve(true) : confirmOnTerminal(question, t(ctx, "common.yes_no"))),
      // Written now and flushed, ahead of the final result: under --json as one JSON line of its own.
      progress: (text, event) =>
        new Promise<void>((resolve) => {
          if (json) lines.push(text);
          process.stdout.write(`${json ? JSON.stringify(event) : text}\n`, () => resolve());
        }),
      openBrowser,
      secret: readSecretOnTerminal,
      stdin: readAllStdin,
    },
  });
  const saved = readConfig(ctx)?.locale;
  if (saved) ctx.locale = saved;

  let result: Result;
  try {
    result = await runCommand(ctx, args);
  } catch (error) {
    result = describeFailure(ctx, error);
    if (!json) {
      process.stderr.write(`${result.message}\n`);
      if (result.action_url) process.stderr.write(`${result.action_url}\n`);
    }
  }
  if (json) process.stdout.write(`${JSON.stringify({ ...result, output: lines }, null, 2)}\n`);
  else if (result.ok === false && result.error === "usage") process.stdout.write(`${result.message}\n`);
  return result.ok ? 0 : result.error === "usage" ? 2 : 1;
}

/**
 * Whether this module is the script Node was asked to run. npm starts the CLI
 * through a link on macOS and Linux (`node_modules/.bin/flyee` points to
 * `dist/flyee.js`), so the two paths are compared after resolving links. The
 * 1.0.0 compared file names, `flyee` against `flyee.js`, and on those systems
 * every command ended at once, printing nothing.
 */
export function isEntryScript(argv1: string | undefined, moduleUrl: string, platform: NodeJS.Platform = process.platform): boolean {
  if (!argv1) return false;
  try {
    const real = (path: string) => {
      const resolved = realpathSync(path);
      return platform === "win32" ? resolved.toLowerCase() : resolved;
    };
    return real(argv1) === real(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

const PROXY_VARIABLES = ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"] as const;
const LOOPBACK = ["127.0.0.1", "localhost", "[::1]"];

/** Whether this Node's fetch honors NODE_USE_ENV_PROXY: 22.21 or later on the 22 line, and every 24 or later (measured). */
export function nodeHonorsEnvProxy(version: string = process.versions.node): boolean {
  const [major, minor] = version.split(".").map(Number);
  return major >= 24 || (major === 22 && minor >= 21);
}

/**
 * The environment to start the CLI again with, when a proxy is set and Node's
 * fetch would ignore it; null otherwise. Node's fetch reads HTTPS_PROXY and
 * HTTP_PROXY only with NODE_USE_ENV_PROXY=1, and npm reads them on its own, so
 * in a Claude Code cloud session, where every request goes through a proxy, `npx`
 * downloaded the CLI and then every call to the platform failed. Never on a
 * Node that ignores the variable (a second process for nothing), never over a
 * NODE_USE_ENV_PROXY the person set, and never when a proxy value is not an
 * http(s) address: Node builds its proxy agents at startup and dies on a value
 * like `127.0.0.1:7890` or `socks5h://…`, which 1.0.0 simply ignored.
 */
export function proxyRelaunchEnv(env: Record<string, string | undefined>, nodeVersion: string = process.versions.node): Record<string, string | undefined> | null {
  const values = PROXY_VARIABLES.map((name) => env[name]).filter((value): value is string => Boolean(value));
  if (!values.length || env.NODE_USE_ENV_PROXY !== undefined || !nodeHonorsEnvProxy(nodeVersion)) return null;
  for (const value of values) {
    try {
      if (!["http:", "https:"].includes(new URL(value).protocol)) return null;
    } catch {
      return null;
    }
  }
  // Calls to this machine (a platform on 127.0.0.1, the key page) never go through the proxy.
  const withLoopback = (value: string | undefined) => [...new Set([...(value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean), ...LOOPBACK])].join(",");
  return { ...env, NODE_USE_ENV_PROXY: "1", NO_PROXY: withLoopback(env.NO_PROXY), no_proxy: withLoopback(env.no_proxy ?? env.NO_PROXY) };
}

const invokedDirectly = isEntryScript(process.argv[1], import.meta.url);

/**
 * Ends with the exit code, never with process.exit(): on Windows a process.exit()
 * right after a fetch aborts Node while it closes the request's handle
 * ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)"), and every command
 * that spoke to the platform came back as exit 127 after printing a good
 * result. A timer that keeps nothing alive still ends a process that something
 * else holds open, long after that handle closed.
 */
export function finish(code: number): NodeJS.Timeout {
  process.exitCode = code;
  return setTimeout(() => process.exit(code), 3000).unref();
}

function runHere(): void {
  main().then(finish, (error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    finish(1);
  });
}

if (invokedDirectly) {
  const relaunch = proxyRelaunchEnv(process.env);
  if (!relaunch) runHere();
  else {
    // The same command, in a child that honors the proxy; it shares this terminal, so a key typed with the echo off still works.
    // --disable-warning hides only Node's notice that its proxy agent is experimental, never a warning about certificates.
    const child = spawn(process.execPath, [...process.execArgv, "--disable-warning=UNDICI-EHPA", ...process.argv.slice(1)], { stdio: "inherit", env: relaunch, windowsHide: true });
    // This process waits for the child and passes signals on, so it is never left running alone. On Windows a
    // console Ctrl+C already reaches both, and a signal sent to the child by PID would only terminate it.
    const signals = process.platform === "win32" ? (["SIGINT"] as const) : (["SIGINT", "SIGTERM", "SIGHUP"] as const);
    const forward = (signal: NodeJS.Signals) => {
      if (process.platform !== "win32") child.kill(signal);
    };
    for (const signal of signals) process.on(signal, forward);
    const unhook = () => {
      for (const signal of signals) process.off(signal, forward);
    };
    let started = false;
    child.once("spawn", () => (started = true));
    child.once("error", () => {
      unhook();
      if (!started) runHere();
    });
    child.once("exit", (code, signal) => {
      unhook();
      finish(code ?? (signal ? 1 : 0));
    });
  }
}
