// Dependency-free helpers shared by the Carrossel animado scripts: arguments, files, hashes and
// output. A trimmed copy of the Motor de vídeo's util.mjs with the same names, so the two apps read alike.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

export const WINDOWS = process.platform === "win32";
export const MAC = process.platform === "darwin";

/** An error with a stable code: the AI branches on `code`; the member reads `message` and `fix` (pt-BR). */
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

/** 12.3456 → 12.346 */
export const round = (value, digits = 3) => Math.round(Number(value) * 10 ** digits) / 10 ** digits;

export function shortHash(text, length = 8) {
  return createHash("sha256").update(String(text)).digest("hex").slice(0, length);
}

export function sha256Text(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** "Academia em Fevereiro!" → "academia-em-fevereiro". */
export function slugify(text, max = 40) {
  const clean = String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
  return clean || "carrossel";
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
export function tempDir(prefix = "flyee-carousel-") {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** Progress goes to stderr: stdout stays clean for the JSON the AI reads. */
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
