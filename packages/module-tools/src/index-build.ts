import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildPackage } from "./pack.ts";
import { distRoot, listModuleDirs } from "./paths.ts";

export type IndexEntry = {
  slug: string;
  version: string;
  trail: string;
  type: string;
  title: Record<string, string>;
  summary: Record<string, string>;
  description_md: string;
  compatible_ais: string[];
  external_credentials: unknown[];
  permissions: unknown[];
  lessons: unknown;
  changelog: Record<string, string> | null;
  license: string;
  sha256: string;
  size_bytes: number;
  package: string;
};

/**
 * dist/index.json: what the platform needs to create or update each module
 * (CLI-CONTRACT.md section 9, planned import). The README is the module's
 * description; the checksum is the one the platform will recompute.
 */
export function buildIndex(dirs: string[] = listModuleDirs()): { generated_at: string; apps: IndexEntry[] } {
  const apps = dirs.map((dir) => {
    const built = buildPackage(dir);
    const readme = readFileSync(join(dir, "README.md"), "utf8");
    return {
      slug: built.slug,
      version: built.version,
      trail: built.manifest.trail,
      type: built.manifest.type,
      title: built.manifest.title,
      summary: built.manifest.summary,
      description_md: readme,
      compatible_ais: built.manifest.compatible_ais,
      external_credentials: built.manifest.external_credentials ?? [],
      permissions: built.manifest.permissions ?? [],
      lessons: built.manifest.lessons ?? null,
      changelog: built.manifest.changelog ?? null,
      license: built.manifest.license ?? "member",
      sha256: built.sha256,
      size_bytes: built.sizeBytes,
      package: `modules/${built.slug}-${built.version}.zip`,
    };
  });
  return { generated_at: new Date().toISOString(), apps };
}

export function writeIndex(dirs?: string[], outDir: string = distRoot): string {
  const index = buildIndex(dirs);
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, "index.json");
  writeFileSync(path, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  return path;
}
