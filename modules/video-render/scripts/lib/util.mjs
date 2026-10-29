// Dependency-free helpers: arguments, times, processes, files and output.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

export const WINDOWS = process.platform === "win32";
export const MAC = process.platform === "darwin";

/** An error with a stable code: other apps branch on `code`; the member reads `message` and `fix` (pt-BR). */
export class AppError extends Error {
  constructor(code, message, fix = "") {
    super(message);
    this.code = code;
    this.fix = fix;
  }
}

export const usage = (message, fix = "Rode o comando `help` para ver as opções.") => new AppError("usage", message, fix);

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
      if (equals > 0) throw usage(`A opção --${name} não recebe valor.`);
      values[name] = true;
    } else if (valued.has(name)) {
      const value = equals > 0 ? arg.slice(equals + 1) : argv[++i];
      if (value === undefined) throw usage(`A opção --${name} precisa de um valor.`);
      values[name] = value;
    } else {
      throw usage(`Opção desconhecida: --${name}.`);
    }
  }
  return { positionals, values };
}

/** Accepts 90, 90.5, 1:30, 01:02:03, 1m30s, 2h, 45s. Returns seconds. */
export function parseTime(text) {
  const t = String(text).trim().toLowerCase().replace(",", ".");
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  if (/^\d+(:\d{1,2}){1,2}(\.\d+)?$/.test(t)) return t.split(":").map(Number).reduce((total, part) => total * 60 + part, 0);
  const m = /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(t);
  if (m && (m[1] || m[2] || m[3])) return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  throw usage(`Tempo inválido: "${text}".`, "Use 90, 1:30, 01:02:03 ou 1m30s.");
}

/** A number option within a range, or the default. */
export function parseNumber(value, { name, min = -Infinity, max = Infinity, integer = false, fallback = null }) {
  if (value === undefined || value === null) return fallback;
  const n = Number(String(value).replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    throw usage(`Valor inválido para --${name}: ${value}.`, `Use um número${integer ? " inteiro" : ""} entre ${min} e ${max}.`);
  }
  return n;
}

/** "a,b, c" → ["a", "b", "c"]. */
export function parseList(text) {
  return String(text ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

/** 75 → "01:15"; above one hour → "1:01:15". */
export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) + 1e-6));
  const h = Math.floor(total / 3600);
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 12.3456 → 12.346 */
export const round = (value, digits = 3) => Math.round(Number(value) * 10 ** digits) / 10 ** digits;

export function shortHash(text, length = 8) {
  return createHash("sha256").update(String(text)).digest("hex").slice(0, length);
}

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
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

/** A file: URL for the browser, on every system. */
export function fileUrl(path) {
  const abs = resolve(path).replace(/\\/g, "/");
  return `file://${abs.startsWith("/") ? "" : "/"}${encodeURI(abs).replace(/[?#]/g, encodeURIComponent)}`;
}

export function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function isDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));
  } catch {
    return fallback;
  }
}

/** Reads a JSON file the AI passed; a clear error when it is missing or broken. */
export function requireJson(path, what) {
  if (!isFile(path)) throw new AppError("file_not_found", `Não encontrei ${what}: ${path}.`);
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));
  } catch (error) {
    throw new AppError("invalid_json", `${what} não é um JSON válido (${path}).`, String(error.message));
  }
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
  return path;
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

/** A fresh folder in the system's temporary directory (never inside the project: OneDrive and Dropbox would sync it). */
export function tempDir(prefix = "flyee-render-") {
  return mkdtempSync(join(tmpdir(), prefix));
}

/**
 * How long each program this app runs may take, in milliseconds. Generous on purpose: a limit
 * is only reached by a program that hangs, never by a slow machine doing real work.
 */
export const LIMITS = {
  // reading a file's header, a program's version or its list of filters takes seconds
  probe: 2 * 60 * 1000,
  // the least a call over media gets: a few frames take seconds, a short piece a few minutes on a slow machine
  media: 10 * 60 * 1000,
  // joining or muxing copies the picture at disk speed, and the sound encodes far faster than real time
  copy: 30 * 60 * 1000,
  // decoding only the sound runs hundreds of times faster than real time: hours of audio fit
  sound: 30 * 60 * 1000,
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

/** The error of a program that passed its limit: which one and for how long, and what the AI does next. */
export function toolTimeout(file, timeoutMs) {
  const name = basename(String(file)).replace(/\.(exe|com|cmd|bat)$/i, "");
  return new AppError(
    "tool_timeout",
    `O ${name} não terminou em ${formatLimit(timeoutMs)} e foi interrompido.`,
    "Tente de novo uma vez. Se travar de novo, divida o trabalho: um vídeo ou trecho mais curto, ou menos quadros por vez.",
  );
}

/**
 * Ends a program with every process it started and resolves once it is gone (a few seconds at
 * most, so a failure never waits on a process that will not die). On Windows taskkill ends the
 * tree; elsewhere `run` starts each program as the leader of its own process group, and one
 * signal to the group ends them all. A program outside a group of its own is ended alone.
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
 * Runs a program without a shell, so arguments arrive intact.
 * `onStdout` receives the output bytes; `onStderrLine` receives each error line;
 * `input` is written to stdin when given. Past `timeoutMs` (LIMITS.default when the
 * caller names none) the program is ended with everything it started, and the call
 * fails with `tool_timeout`.
 */
export function run(file, args, { cwd, env, onStdout, onStderrLine, input, stderrLimit = 256 * 1024, timeoutMs = LIMITS.default } = {}) {
  return new Promise((resolvePromise, reject) => {
    let child;
    try {
      // outside Windows the program leads its own process group, so killTree also ends what it starts
      child = spawn(file, args, { cwd, env, windowsHide: true, detached: !WINDOWS, stdio: [input !== undefined ? "pipe" : "ignore", "pipe", "pipe"] });
    } catch (error) {
      reject(error);
      return;
    }
    let timedOut = false;
    const timer =
      Number.isFinite(timeoutMs) && timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            killTree(child).then(() => reject(toolTimeout(file, timeoutMs)));
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
    if (input !== undefined) {
      child.stdin.on("error", () => {});
      child.stdin.end(input);
    }
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

export const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

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

/** Resolves a path the AI passed: relative to the current folder first, then to the project. */
export function resolveInput(root, path, { mustExist = true, what = "o arquivo" } = {}) {
  if (!path) throw usage(`Informe ${what}.`);
  const candidates = [resolve(process.cwd(), path), resolve(root, path)];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found && mustExist) throw new AppError("file_not_found", `Não encontrei ${what}: ${path}.`);
  return found ?? candidates[0];
}

/** A seeded random generator (mulberry32): the same seed gives the same sequence on every machine. */
export function seededRandom(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
