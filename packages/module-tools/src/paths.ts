import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The monorepo root: packages/module-tools/src → ../../.. */
export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const modulesRoot = join(repoRoot, "modules");
export const distRoot = join(repoRoot, "dist");
export const schemaPath = join(repoRoot, "schemas", "flyee.module.schema.json");

/**
 * Every app directory under modules/: has a manifest and does not start with
 * `_` (the template) or `.`.
 */
export function listModuleDirs(root: string = modulesRoot): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith("."))
    .filter((entry) => existsSync(join(root, entry.name, "flyee.module.json")))
    .map((entry) => join(root, entry.name))
    .sort();
}
