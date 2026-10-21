// File helpers this app needs beyond util.mjs (which is a byte copy shared with other apps):
// existence checks, folders, hashes and copies. Dependency-free.

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

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

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
  return path;
}

export function removeDir(path) {
  rmSync(path, { recursive: true, force: true });
}

/** Copies one file, creating the target folder. Never a recursive copy: Windows paths stay safe. */
export function copyFile(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

/** The files right inside a folder (no subfolders), sorted; empty when the folder does not exist. */
export function filesIn(dir, pattern = null) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && (!pattern || pattern.test(entry.name)))
    .map((entry) => join(dir, entry.name))
    .sort();
}

/** The subfolders right inside a folder, sorted by name. */
export function dirsIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** A short, stable signature of any JSON value (keys sorted), for "did this change?". */
export function hashJson(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex").slice(0, 16);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}
