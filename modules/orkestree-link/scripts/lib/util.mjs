// Dependency-free helpers: arguments, files, the key, the project root and output.

import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

/** An error with a stable code: the AI branches on `code`; the member reads `message` and `fix` (pt-BR). */
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

export function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));
  } catch {
    return fallback;
  }
}

/** Writes through a temporary file and renames it, so a file is never left half-written. */
export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`);
  try {
    renameSync(temp, path);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
}

/** A relative path with forward slashes, for JSON and for the member. */
export function toPosix(base, path) {
  return (relative(base, path) || ".").split(sep).join("/");
}

/** The SHA-256 and the size of a file, read as a stream so a long video never sits in memory. */
export function fileDigest(path) {
  return new Promise((done, fail) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", fail);
    stream.on("end", () => done({ sha256: hash.digest("hex"), bytes: statSync(path).size }));
  });
}

/**
 * The member's project root. The script lives in <project>/.flyee/modules/<app>/scripts/;
 * outside that layout, the current folder.
 */
export function projectRoot(scriptsDir) {
  const appDir = resolve(scriptsDir, "..");
  const modulesDir = resolve(appDir, "..");
  const flyeeDir = resolve(modulesDir, "..");
  if (basename(modulesDir) === "modules" && basename(flyeeDir) === ".flyee") return resolve(flyeeDir, "..");
  return process.cwd();
}

export const KEY_NAME = "ORKESTREE_TOKEN";

/** Where `npx --yes flyee@latest key set` saves the member's keys: one file per machine, outside every project. */
export function keyStorePath(home = homedir()) {
  return join(home, ".flyee", "keys.json");
}

/**
 * The production token by the flyee rule for app keys: the environment variable first (one that
 * exists but is empty means "no token"), then the key saved with `key set`. Never printed or written.
 */
export function orkestreeToken(env = process.env, path = keyStorePath()) {
  const fromEnvironment = env[KEY_NAME];
  if (fromEnvironment !== undefined) return fromEnvironment.trim() ? { token: fromEnvironment.trim(), from: "environment" } : { token: null, from: null };
  const saved = readJson(path)?.keys?.[KEY_NAME];
  return typeof saved === "string" && saved.trim() ? { token: saved.trim(), from: "flyee" } : { token: null, from: null };
}

/** A campaign folder name the order may carry: lowercase letters, digits and single hyphens. */
export function safeCampaign(name) {
  return typeof name === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) && name.length <= 80;
}
