import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

export class AppError extends Error {
  constructor(code, message, fix = "") {
    super(message);
    this.code = code;
    this.fix = fix;
  }
}

export function parseArgs(argv, { flags = [], options = [] } = {}) {
  const positionals = [];
  const values = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const [name, inline] = arg.slice(2).split(/=(.*)/s);
    if (flags.includes(name)) values[name] = true;
    else if (options.includes(name)) {
      const value = inline ?? argv[++index];
      if (value === undefined) throw new AppError("usage", `Falta o valor de --${name}.`, "Rode help para ver os comandos.");
      values[name] = value;
    } else throw new AppError("usage", `Opção desconhecida: --${name}.`, "Rode help para ver os comandos.");
  }
  return { positionals, values };
}

export function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));
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

export function writeJson(path, value) {
  writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

export function toPosix(path) {
  return path.split(sep).join("/");
}

export function userAppsDir(env = process.env) {
  return resolve(env.FLYEE_USER_APPS?.trim() || join(homedir(), ".flyee", "user-apps"));
}

function samePath(a, b) {
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/**
 * O projeto em que o kit trabalha. Instalado num projeto flyee, é a pasta que contém .flyee/.
 * Instalado para o usuário (fora de qualquer projeto), é a pasta aberta na sessão: nada vai para a pasta de apps.
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

/** Um destino dentro do projeto; nunca fora dele. */
export function insideProject(root, path) {
  const target = resolve(root, path);
  const rel = relative(root, target);
  if (rel.startsWith("..") || resolve(rel) === rel) {
    throw new AppError("outside_project", `O destino ${path} fica fora do projeto aberto.`, "Escolha uma pasta dentro do projeto.");
  }
  return target;
}

export const exists = existsSync;
