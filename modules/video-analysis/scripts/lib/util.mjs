// Dependency-free helpers: arguments, times, processes, files and output.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

const WINDOWS = process.platform === "win32";

/** An error with a stable code: other apps branch on `code`; the member reads `message` and `fix` (pt-BR). */
export class AppError extends Error {
  constructor(code, message, fix = "") {
    super(message);
    this.code = code;
    this.fix = fix;
  }
}

/** `--option value`, `--option=value` and boolean `--flag`. An unknown option is a usage error. */
export function parseArgs(argv, { flags = [], options = [] } = {}) {
  const booleans = new Set(flags);
  const valued = new Set(options);
  const positionals = [];
  const values = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const equals = arg.indexOf("=");
    const name = equals > 0 ? arg.slice(2, equals) : arg.slice(2);
    if (booleans.has(name)) {
      if (equals > 0) throw new AppError("usage", `A opção --${name} não recebe valor.`);
      values[name] = true;
    } else if (valued.has(name)) {
      const value = equals > 0 ? arg.slice(equals + 1) : argv[++i];
      if (value === undefined) throw new AppError("usage", `A opção --${name} precisa de um valor.`);
      values[name] = value;
    } else {
      throw new AppError("usage", `Opção desconhecida: --${name}.`, "Rode o comando `help` para ver as opções.");
    }
  }
  return { positionals, values };
}

/** Accepts 90, 90.5, 1:30, 01:02:03, 1m30s, 2h, 45s. Returns seconds. */
export function parseTime(text) {
  const t = String(text).trim().toLowerCase().replace(",", ".");
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  if (/^\d+(:\d{1,2}){1,2}(\.\d+)?$/.test(t)) {
    return t.split(":").map(Number).reduce((total, part) => total * 60 + part, 0);
  }
  const m = /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(t);
  if (m && (m[1] || m[2] || m[3])) return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  throw new AppError("usage", `Tempo inválido: "${text}".`, "Use 90, 1:30, 01:02:03 ou 1m30s.");
}

/** 75 → "01:15"; with hours (or above one hour) → "1:01:15". */
export function formatTime(seconds, withHours = false) {
  const total = Math.max(0, Math.floor(Number(seconds) + 1e-6));
  const h = Math.floor(total / 3600);
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return h > 0 || withHours ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 75 → "01m15s"; 3723 → "1h02m03s". Safe in a file name on every system. */
export function fileTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) + 1e-6));
  const h = Math.floor(total / 3600);
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${h > 0 ? `${h}h` : ""}${mm}m${ss}s`;
}

export function shortHash(text, length = 8) {
  return createHash("sha256").update(String(text)).digest("hex").slice(0, length);
}

/** "Aula 3: Cortes & Ritmo!" → "aula-3-cortes-ritmo". */
export function slugify(text, max = 40) {
  const clean = String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
  return clean || "video";
}

/** A relative path with forward slashes, for JSON and Markdown. */
export function toPosix(base, path) {
  const rel = relative(base, path);
  return (rel || ".").split(sep).join("/");
}

/** A file inside the project shows as a project path; outside it, as given. */
export function displayPath(root, path) {
  if (!path) return null;
  const rel = toPosix(root, path);
  return rel.startsWith("..") || /^[A-Za-z]:/.test(rel) ? path : rel;
}

export function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));
  } catch {
    return fallback;
  }
}

/** Writes through a temporary file and renames it, so a file is never left half-written. */
export function writeFileAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, content);
  try {
    renameSync(temp, path);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
}

export function writeJson(path, data) {
  writeFileAtomic(path, `${JSON.stringify(data, null, 2)}\n`);
}

export function removeDir(path) {
  rmSync(path, { recursive: true, force: true });
}

/**
 * How long each program this app runs may take, in milliseconds. Generous on purpose: a limit
 * is only reached by a program that hangs, never by a slow machine or connection doing real work.
 */
export const LIMITS = {
  // reading a file's header or a program's version takes seconds
  probe: 2 * 60 * 1000,
  // the least a call over media gets: one frame or one grid takes seconds, a short piece a few minutes on a slow machine
  media: 10 * 60 * 1000,
  // yt-dlp reads a video's page and its captions in seconds, and retries a slow site by itself
  metadata: 10 * 60 * 1000,
  // a download depends on the connection: three hours fit a long video on a slow line, and yt-dlp gives up on a dead one by itself
  download: 3 * 60 * 60 * 1000,
  // a call nobody sized, or media of unknown length: longer than any job of this app
  default: 60 * 60 * 1000,
};

// decoding runs faster than real time even on a weak machine: six times the duration is room to spare
const MEDIA_FACTOR = 6;

// setTimeout fires at once past 2^31 - 1 ms (24.8 days): a longer limit waits that long instead
const MAX_TIMER = 2 ** 31 - 1;

/** The limit of a call that decodes or encodes `seconds` of media: max(10 min, 6 × the duration); unknown length gets the default. */
export function mediaLimit(seconds) {
  const length = Number(seconds);
  if (!(length > 0)) return LIMITS.default;
  return Math.max(LIMITS.media, Math.ceil(length * 1000 * MEDIA_FACTOR));
}

/** 500 → "0,5 s"; 600000 → "10 min"; 10800000 → "3 h". */
export function formatLimit(ms) {
  const seconds = ms / 1000;
  if (seconds < 120) return `${String(Math.round(seconds * 10) / 10).replace(".", ",")} s`;
  const minutes = seconds / 60;
  if (minutes < 120) return `${Math.round(minutes)} min`;
  return `${String(Math.round(minutes / 6) / 10).replace(".", ",")} h`;
}

/** "ffmpeg" for C:\…\ffmpeg.exe; "yt-dlp" for python -m yt_dlp. */
function programName(file, args = []) {
  const module = args.indexOf("-m");
  if (module >= 0 && args[module + 1]) return String(args[module + 1]).replace(/_/g, "-");
  return basename(String(file)).replace(/\.(exe|com|cmd|bat)$/i, "");
}

/** The error of a program that passed its limit: which one and for how long, and what the AI does next. */
export function toolTimeout(file, timeoutMs, args = []) {
  return new AppError(
    "tool_timeout",
    `O ${programName(file, args)} não terminou em ${formatLimit(timeoutMs)} e foi interrompido.`,
    "Tente de novo uma vez. Se travar de novo, reduza o trabalho: um trecho mais curto (--start e --end), menos frames (--max-frames) ou, num download, uma qualidade menor (--quality 480).",
  );
}

/**
 * Ends a program with every process it started and resolves once it is gone (a few seconds at
 * most, so a failure never waits on a process that will not die). On Windows taskkill ends the
 * tree; elsewhere `run` starts each program as the leader of its own process group, and one
 * signal to the group ends them all (yt-dlp with the ffmpeg it opened to join picture and sound).
 */
export function killTree(child, { waitMs = 5000 } = {}) {
  return new Promise((resolvePromise) => {
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null) {
      resolvePromise();
      return;
    }
    let timer = null;
    const finish = () => {
      clearTimeout(timer);
      child.removeListener("exit", finish);
      resolvePromise();
    };
    timer = setTimeout(finish, waitMs);
    child.once("exit", finish);
    const alone = () => {
      try {
        child.kill("SIGKILL");
      } catch {
        // already gone
      }
    };
    if (WINDOWS) {
      try {
        const taskkill = spawn(join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe"), ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
        taskkill.once("error", alone);
        taskkill.once("exit", (code) => {
          if (code !== 0) alone();
        });
      } catch {
        alone();
      }
      return;
    }
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      alone();
    }
  });
}

/**
 * Runs a program without a shell, so arguments arrive intact (URLs with & included).
 * `onStdout` receives the output bytes; `onStderrLine` receives each error line. Past
 * `timeoutMs` (LIMITS.default when the caller names none) the program is ended with
 * everything it started, and the call fails with `tool_timeout`.
 */
export function run(file, args, { cwd, env, onStdout, onStderrLine, stderrLimit = 256 * 1024, timeoutMs = LIMITS.default } = {}) {
  return new Promise((resolvePromise, reject) => {
    let child;
    try {
      // outside Windows the program leads its own process group, so killTree also ends what it starts
      child = spawn(file, args, { cwd, env, windowsHide: true, detached: !WINDOWS, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      reject(error);
      return;
    }
    let timedOut = false;
    const timer =
      Number.isFinite(timeoutMs) && timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            killTree(child).then(() => reject(toolTimeout(file, timeoutMs, args)));
          }, Math.min(timeoutMs, MAX_TIMER))
        : null;
    const stdout = [];
    let tail = "";
    let pending = "";
    child.stdout.on("data", (chunk) => (onStdout ? onStdout(chunk) : stdout.push(chunk)));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      tail = (tail + chunk).slice(-stderrLimit);
      if (!onStderrLine) return;
      pending += chunk;
      const lines = pending.split(/\r?\n|\r/);
      pending = lines.pop() ?? "";
      for (const line of lines) onStderrLine(line);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      // past the limit the timer settles the call, once the program is gone
      if (timedOut) return;
      if (onStderrLine && pending) onStderrLine(pending);
      resolvePromise({ code, stdout: Buffer.concat(stdout), stderr: tail });
    });
  });
}

/** Runs `fn` over the items with at most `limit` at a time, keeping the result order. */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Progress goes to stderr: stdout stays clean for the JSON other apps read. */
export function progress(text) {
  process.stderr.write(`${text}\n`);
}

/**
 * The member's project root. The script lives in
 * <project>/.flyee/modules/<app>/scripts/; outside that layout, the current folder.
 */
export function projectRoot(scriptsDir) {
  const appDir = resolve(scriptsDir, "..");
  const modulesDir = resolve(appDir, "..");
  const flyeeDir = resolve(modulesDir, "..");
  if (basename(modulesDir) === "modules" && basename(flyeeDir) === ".flyee") return resolve(flyeeDir, "..");
  return process.cwd();
}
