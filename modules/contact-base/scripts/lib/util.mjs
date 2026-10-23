// Dependency-free helpers: arguments, dates, money, files and output.

import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";

/** An error with a stable code: other apps branch on `code`; the member reads `message` and `fix` (pt-BR). */
export class AppError extends Error {
  constructor(code, message, fix = "", details = undefined) {
    super(message);
    this.code = code;
    this.fix = fix;
    if (details !== undefined) this.details = details;
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

/** "Plano: Black Friday 2026" → "plano-black-friday-2026". */
export function slugify(text, max = 40) {
  const clean = String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
  return clean || "plano";
}

/** Accents off, lowercase, single spaces: the labels of a "Campo: valor" line. */
export function fold(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** The calendar day where the member is (not UTC: late at night in Brazil, UTC is already tomorrow). */
export function isoDay(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-11-27" → a Date at noon UTC (no daylight-saving surprises), or null. */
export function parseDay(text) {
  const match = ISO_DATE.exec(String(text ?? "").trim());
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  if (Number.isNaN(date.getTime()) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) return null;
  return date;
}

export function dayString(date) {
  return date.toISOString().slice(0, 10);
}

/** "2026-11-27" + 3 → "2026-11-30". */
export function addDays(day, days) {
  const date = parseDay(day);
  if (!date) throw new AppError("usage", `Data inválida: ${day}. Use o formato AAAA-MM-DD.`);
  date.setUTCDate(date.getUTCDate() + days);
  return dayString(date);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from, to) {
  const a = parseDay(from);
  const b = parseDay(to);
  if (!a || !b) throw new AppError("usage", `Data inválida: ${!a ? from : to}. Use o formato AAAA-MM-DD.`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export function weekday(day) {
  const date = parseDay(day);
  return date ? WEEKDAYS[date.getUTCDay()] : "";
}

/** "27/11" for a day; with the year when asked. */
export function brDay(day, withYear = false) {
  const date = parseDay(day);
  if (!date) return String(day ?? "");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return withYear ? `${dd}/${mm}/${date.getUTCFullYear()}` : `${dd}/${mm}`;
}

/** R$ 1.500 · R$ 321,43 */
export function brl(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  const fixed = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  const [whole, decimals] = fixed.split(".");
  return `R$ ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${decimals ? `,${decimals}` : ""}`;
}

/** 12.5 → "12,5%" */
export function pct(value, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  const text = Number.isInteger(value) ? String(value) : value.toFixed(digits).replace(/\.?0+$/, "");
  return `${text.replace(".", ",")}%`;
}

/** "R$ 1.500,00", "50 reais", "R$50", "1500.5" → a number; null when it is not one. */
export function parseMoney(text) {
  if (typeof text === "number") return Number.isFinite(text) ? text : null;
  const clean = String(text ?? "")
    .replace(/r\$|reais|real|brl|por dia|\/dia|ao dia|por semana|\/semana|por mes|por mês|\/mes|\/mês|ao mes|ao mês|por ano|\/ano|ao ano/gi, "")
    .replace(/\s+/g, "")
    .trim();
  if (!/^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$|^\d+(?:[.,]\d{1,2})?$/.test(clean)) return null;
  const normalized = /,\d{1,2}$/.test(clean) || /^\d{1,3}(?:\.\d{3})+$/.test(clean) ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export const round2 = (value) => Math.round(value * 100) / 100;

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

export function readText(path) {
  try {
    return readFileSync(path, "utf8").replace(/^﻿/, "");
  } catch {
    return null;
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
