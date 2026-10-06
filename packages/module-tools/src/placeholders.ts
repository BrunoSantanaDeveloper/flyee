import { readFileSync } from "node:fs";
import { join } from "node:path";

import { MANIFEST_FILE } from "./files.ts";
import { readManifest } from "./manifest.ts";

/**
 * The marker the template and `apps bump` leave in every text the operator
 * still has to write. `validate` refuses an app that carries one, so nothing
 * half-written can be packed.
 */
export const PLACEHOLDER = "[PREENCHER]";

/** Shipped files and manifest fields that still carry the marker, as `path` or `manifest.field`. */
export function placeholdersIn(dir: string, files?: string[]): string[] {
  const found: string[] = [];
  const { manifest } = readManifest(join(dir, MANIFEST_FILE));
  if (manifest) {
    const walk = (value: unknown, path: string) => {
      if (typeof value === "string" && value.includes(PLACEHOLDER)) found.push(path);
      else if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${path}.${index}`));
      else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) walk(item, `${path}.${key}`);
    };
    walk(manifest, "manifest");
  }
  for (const file of files ?? manifest?.files ?? []) {
    try {
      if (readFileSync(join(dir, ...file.split("/")), "utf8").includes(PLACEHOLDER)) found.push(file);
    } catch {
      // a missing file is reported by validate on its own
    }
  }
  return found;
}
