// Small helpers shared by the commands. Messages are pt-BR for the member's AI; identifiers stay English.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

export class AppError extends Error {
  constructor(code, message, fix = "", details = undefined) {
    super(message);
    this.code = code;
    this.fix = fix;
    if (details !== undefined) this.details = details;
  }
}

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
      throw new AppError("usage", `Opção desconhecida: --${name}.`, "Rode o comando help para ver as opções.");
    }
  }
  return { positionals, values };
}

/** Lowercase without accents, for comparisons. */
export function fold(text) {
  return String(text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function isPageName(name) {
  return typeof name === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) && name.length <= 60;
}

export function isoDay(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function clip(text, max = 80) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

/** A price as written on a page or in pagina.json ("R$ 1.234,56", "24,99", 24.99) to a number, or null. */
export function parsePrice(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  const match = String(value).match(/\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?/);
  if (!match) return null;
  let digits = match[0].replace(/\s/g, "");
  if (digits.includes(",")) digits = digits.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(?:\.\d{3})+$/.test(digits)) digits = digits.replace(/\./g, "");
  const number = Number(digits);
  return Number.isFinite(number) ? number : null;
}

export function samePrice(a, b) {
  return typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 0.005;
}

export function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeFileAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, content);
  renameSync(temp, path);
}

export function writeJson(path, data) {
  writeFileAtomic(path, `${JSON.stringify(data, null, 2)}\n`);
}

export function toPosix(base, path) {
  return relative(base, path).split(sep).join("/");
}

export function progress(text) {
  process.stderr.write(`${text}\n`);
}

/** Where the operator's console installs apps for the user (outside every project). */
export function userAppsDir(env = process.env) {
  return resolve(env.FLYEE_USER_APPS?.trim() || join(homedir(), ".flyee", "user-apps"));
}

function samePath(a, b) {
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/**
 * The project the app works on. Installed in a project, it is the folder that holds `.flyee/`.
 * Installed for the user, `.flyee/` lives in the user's apps folder, and the project is the
 * folder open in the session (the working directory): nothing is ever written to the apps folder.
 */
export function projectRoot(scriptsDir, { env = process.env, cwd = process.cwd() } = {}) {
  const appDir = resolve(scriptsDir, "..");
  const modulesDir = resolve(appDir, "..");
  const flyeeDir = resolve(modulesDir, "..");
  if (basename(modulesDir) === "modules" && basename(flyeeDir) === ".flyee") {
    const root = resolve(flyeeDir, "..");
    if (samePath(root, userAppsDir(env))) return resolve(cwd);
    return root;
  }
  return resolve(cwd);
}

/** The Video engine's script: installed in the project, or next to this app (installed for the user, or in the repository). */
export function findEngine(root, appDir) {
  const candidates = [
    join(root, ".flyee", "modules", "video-render", "scripts", "render.mjs"),
    resolve(appDir, "..", "video-render", "scripts", "render.mjs"),
  ];
  const script = candidates.find((path) => existsSync(path)) ?? null;
  if (!script) return null;
  const manifest = readJson(resolve(dirname(script), "..", "flyee.module.json"), {});
  return { script, version: manifest.version ?? null };
}

export function versionAtLeast(version, minimum) {
  const parse = (text) => String(text ?? "0.0.0").split(/[.+-]/).slice(0, 3).map((n) => Number.parseInt(n, 10) || 0);
  const [a, b] = [parse(version), parse(minimum)];
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}

function killTree(child) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      try {
        child.kill("SIGKILL");
      } catch {}
    }
  }
}

/** Runs `node <script> <args>` with a time limit; past it, ends the whole process tree. */
export function runNode(script, args, { cwd, timeoutMs, label }) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd, detached: process.platform !== "win32", windowsHide: true });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new AppError("tool_failed", `Não consegui rodar ${label}: ${error.message}.`, "Confira se o Node está instalado e tente de novo."));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new AppError("tool_timeout", `${label} passou de ${Math.round(timeoutMs / 1000)} s e foi encerrado.`, "Confira se a página abre no navegador e tente de novo; uma página que não termina de carregar não pode ser conferida."));
        return;
      }
      resolvePromise({ code, stdout, stderr });
    });
  });
}
