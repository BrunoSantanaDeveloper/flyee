// Dependency-free helpers: arguments, times, processes, files and output.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";

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
 * Runs a program without a shell, so arguments arrive intact (URLs with & included).
 * `onStdout` receives the output bytes; `onStderrLine` receives each error line.
 */
export function run(file, args, { cwd, env, onStdout, onStderrLine, stderrLimit = 256 * 1024 } = {}) {
  return new Promise((resolvePromise, reject) => {
    let child;
    try {
      child = spawn(file, args, { cwd, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
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
