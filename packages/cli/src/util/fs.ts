import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Copies a folder file by file. `fs.cpSync` is not used on purpose: on Node 24 for
 * Windows it writes a destination with accents ("C:\Users\João\…", common among
 * members) into a sibling folder with a garbled name and reports no error.
 */
export function copyDir(source: string, target: string): void {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else if (entry.isFile()) copyFileSync(from, to);
  }
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, "")) as T;
  } catch {
    return null;
  }
}

/** Writes through a temporary file and a rename, so a crash never leaves a half-written file. */
export function writeFileAtomic(path: string, content: string | Uint8Array, mode?: number): void {
  ensureDir(dirname(path));
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temp, content, mode === undefined ? undefined : { mode });
  try {
    renameSync(temp, path);
  } catch {
    // Windows refuses to rename over an open file; fall back to a direct write.
    writeFileSync(path, content, mode === undefined ? undefined : { mode });
    rmSync(temp, { force: true });
  }
}

export function writeJsonAtomic(path: string, value: unknown, mode?: number): void {
  writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`, mode);
}

export function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export function removeDir(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256File(path: string): string | null {
  try {
    return sha256Hex(new Uint8Array(readFileSync(path)));
  } catch {
    return null;
  }
}

/** Relative POSIX paths of every file under a directory. */
export function walkFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (absolute: string, relative: string) => {
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(join(absolute, entry.name), rel);
      else if (entry.isFile()) out.push(rel);
    }
  };
  if (existsSync(root) && statSync(root).isDirectory()) walk(root, "");
  return out.sort();
}

export function exists(path: string): boolean {
  return existsSync(path);
}
