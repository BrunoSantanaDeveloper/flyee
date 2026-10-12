// Dependency-free helpers: arguments, times, processes, files and output.

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
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

/** A whole number inside [min, max], or a usage error naming the option. */
export function intOption(values, name, fallback, min, max) {
  if (values[name] === undefined) return fallback;
  const value = Number(values[name]);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new AppError("usage", `--${name} precisa ser um número inteiro de ${min} a ${max}.`);
  }
  return value;
}

/** One of the allowed values, or a usage error listing them. */
export function choiceOption(values, name, fallback, allowed) {
  const value = values[name] ?? fallback;
  if (!allowed.includes(value)) throw new AppError("usage", `--${name} aceita: ${allowed.join(", ")}.`);
  return value;
}

/** 75 → "01:15"; with hours (or above one hour) → "1:01:15". */
export function formatTime(seconds, withHours = false) {
  const total = Math.max(0, Math.floor(Number(seconds) + 1e-6));
  const h = Math.floor(total / 3600);
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return h > 0 || withHours ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "Roteiro: o Guia & as Dicas!" → "roteiro-o-guia-as-dicas". */
export function slugify(text, max = 40) {
  const clean = String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
  return clean || "pesquisa";
}

/** "2026-10-10" for a Date (UTC). */
export function isoDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** A relative path with forward slashes, for JSON and Markdown. */
export function toPosix(base, path) {
  const rel = relative(base, path);
  return (rel || ".").split(sep).join("/");
}

export function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));
  } catch {
    return fallback;
  }
}

/** Age of a file in hours, or Infinity when it does not exist. */
export function ageHours(path, now = Date.now()) {
  try {
    return (now - statSync(path).mtimeMs) / 3.6e6;
  } catch {
    return Infinity;
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

/**
 * Runs a program without a shell, so arguments arrive intact (URLs with & included).
 * Returns the exit code, stdout as a Buffer and the tail of stderr.
 */
export function run(file, args, { cwd, env, stderrLimit = 256 * 1024 } = {}) {
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
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      tail = (tail + chunk).slice(-stderrLimit);
    });
    child.on("error", reject);
    child.on("close", (code) => resolvePromise({ code, stdout: Buffer.concat(stdout), stderr: tail }));
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
