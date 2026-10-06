import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const MANIFEST_FILE = "flyee.module.json";

/** Directories that never ship, at any depth. */
const EXCLUDED_DIRS = new Set(["tests", ".dev", "node_modules", "__pycache__", ".git", ".cache", "dist"]);
/** Files that never ship. */
const EXCLUDED_FILES = new Set([MANIFEST_FILE, ".DS_Store", "Thumbs.db", ".gitkeep"]);

export function isShippable(relativePath: string): boolean {
  const segments = relativePath.split("/");
  const name = segments[segments.length - 1];
  if (segments.slice(0, -1).some((segment) => EXCLUDED_DIRS.has(segment))) return false;
  if (EXCLUDED_FILES.has(name)) return false;
  if (name.endsWith(".dev.md")) return false;
  return true;
}

/**
 * Every file of an app directory that ships in the package, as sorted relative
 * POSIX paths. This is the only source of the manifest's `files`.
 */
export function shippableFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (absolute: string, relative: string) => {
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        walk(join(absolute, entry.name), rel);
      } else if (entry.isFile() && isShippable(rel)) {
        out.push(rel);
      }
    }
  };
  walk(dir, "");
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function totalSize(dir: string, files: string[]): number {
  return files.reduce((sum, file) => sum + statSync(join(dir, ...file.split("/"))).size, 0);
}
