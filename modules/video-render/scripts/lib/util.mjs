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
 * Runs a program without a shell, so arguments arrive intact.
 * `onStdout` receives the output bytes; `onStderrLine` receives each error line;
 * `input` is written to stdin when given.
 */
export function run(file, args, { cwd, env, onStdout, onStderrLine, input, stderrLimit = 256 * 1024 } = {}) {
  return new Promise((resolvePromise, reject) => {
    let child;
    try {
      child = spawn(file, args, { cwd, env, windowsHide: true, stdio: [input !== undefined ? "pipe" : "ignore", "pipe", "pipe"] });
    } catch (error) {
      reject(error);
      return;
    }
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
    child.on("error", reject);
    child.on("close", (code) => {
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
