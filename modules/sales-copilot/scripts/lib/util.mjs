// Dependency-free helpers: arguments, errors, files, the key reader and the project root.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

/** An error with a stable code: other apps branch on `code`; the member's AI reads `message` and `fix` (pt-BR). */
export class AppError extends Error {
  constructor(code, message, fix = "", extra = {}) {
    super(message);
    this.code = code;
    this.fix = fix;
    this.extra = extra;
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

/** Accepts 90, 90.5, 1:30, 01:02:03. Returns seconds, or null when the text is not a time. */
export function parseClock(text) {
  const t = String(text).trim().replace(",", ".");
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  if (/^\d+(:\d{1,2}){1,2}(\.\d+)?$/.test(t)) return t.split(":").map(Number).reduce((total, part) => total * 60 + part, 0);
  return null;
}

/** 75 → "01:15"; above one hour → "1:01:15". */
export function formatClock(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) + 1e-6));
  const h = Math.floor(total / 3600);
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function shortHash(text, length = 6) {
  return createHash("sha256").update(String(text)).digest("hex").slice(0, length);
}

/** "Call com a Ana: proposta" → "call-com-a-ana-proposta". */
export function slugify(text, max = 40) {
  const clean = String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
  return clean || "call";
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

/** Reads a JSON file the AI wrote; a broken one is refused with where it breaks. */
export function readJsonStrict(path, what) {
  let text;
  try {
    text = readFileSync(path, "utf8").replace(/^﻿/, "");
  } catch {
    throw new AppError("file_not_found", `Não encontrei ${what}: ${path}.`, "Confira o caminho, a partir da raiz do projeto.");
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new AppError("invalid_json", `${what} não é um JSON válido: ${error.message}.`, "Corrija o arquivo e repita o comando.");
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

/** Progress goes to stderr: stdout stays clean for the JSON other apps read. */
export function progress(text) {
  process.stderr.write(`${text}\n`);
}

/**
 * The member's project root. The script lives in <project>/.flyee/modules/<app>/scripts/;
 * outside that layout (an app installed for the user), the current folder.
 */
export function projectRoot(scriptsDir) {
  const appDir = resolve(scriptsDir, "..");
  const modulesDir = resolve(appDir, "..");
  const flyeeDir = resolve(modulesDir, "..");
  if (basename(modulesDir) === "modules" && basename(flyeeDir) === ".flyee") return resolve(flyeeDir, "..");
  return process.cwd();
}

/**
 * A key the member saved: the environment variable first (an empty one means "no key"),
 * then ~/.flyee/keys.json, read on every run. The value is never printed or written.
 */
export function appKey(name) {
  const fromEnvironment = process.env[name];
  if (fromEnvironment !== undefined) return fromEnvironment.trim() || null;
  try {
    const saved = JSON.parse(readFileSync(join(homedir(), ".flyee", "keys.json"), "utf8")).keys?.[name];
    return typeof saved === "string" && saved.trim() ? saved.trim() : null;
  } catch {
    return null;
  }
}

export const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
export const round = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

/** Words of a spoken turn. */
export function wordCount(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

/** "2026-11-15" for today, in local time. */
export function today(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 0.5 → "0,50": money and decimals as the member reads them. */
export function decimal(value, digits = 2) {
  return Number(value).toFixed(digits).replace(".", ",");
}
