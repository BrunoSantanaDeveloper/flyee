import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { zipSync, type Zippable } from "fflate";

import { MANIFEST_FILE, shippableFiles } from "./files.ts";
import { type Manifest, readManifest, serializeManifest } from "./manifest.ts";
import { distRoot } from "./paths.ts";
import { type Report, validateModule } from "./validate.ts";

/**
 * Fixed timestamp so the same content always produces the same bytes and the
 * same SHA-256. ZIP stores DOS local time and fflate reads the Date with the
 * local getters, so the date is built in local time: the same wall-clock
 * value in every timezone gives the same bytes on the operator's machine and
 * in CI.
 */
const FIXED_MTIME = new Date(2000, 0, 1, 12, 0, 0);

export type BuiltPackage = {
  slug: string;
  version: string;
  manifest: Manifest;
  files: string[];
  bytes: Uint8Array;
  sha256: string;
  sizeBytes: number;
};

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Rewrites `files` in the manifest from what ships. The only way `files` is ever written. */
export function writeFilesToManifest(dir: string): string[] {
  const path = join(dir, MANIFEST_FILE);
  const { manifest, error } = readManifest(path);
  if (!manifest) throw new Error(`${basename(dir)}: ${error}`);
  const files = shippableFiles(dir);
  manifest.files = files;
  writeFileSync(path, serializeManifest(manifest), "utf8");
  return files;
}

/** Builds the deterministic ZIP of an app from its directory, in memory. */
export function buildPackage(dir: string): BuiltPackage {
  const { manifest, error } = readManifest(join(dir, MANIFEST_FILE));
  if (!manifest) throw new Error(`${basename(dir)}: ${error}`);
  const files = shippableFiles(dir);
  const complete: Manifest = { ...manifest, files };
  const entries: Zippable = {};
  entries[MANIFEST_FILE] = [new TextEncoder().encode(serializeManifest(complete)), { mtime: FIXED_MTIME, os: 0 }];
  for (const file of files) {
    entries[file] = [new Uint8Array(readFileSync(join(dir, ...file.split("/")))), { mtime: FIXED_MTIME, os: 0 }];
  }
  const bytes = zipSync(entries, { level: 6, mtime: FIXED_MTIME });
  return {
    slug: complete.name,
    version: complete.version,
    manifest: complete,
    files,
    bytes,
    sha256: sha256Hex(bytes),
    sizeBytes: bytes.byteLength,
  };
}

export type PackResult = { report: Report; built?: BuiltPackage; zipPath?: string; shaPath?: string };

/**
 * Regenerates `files`, validates and, when clean, writes
 * dist/modules/<slug>-<version>.zip and its .sha256.
 */
export function packModule(dir: string, outDir: string = join(distRoot, "modules")): PackResult {
  writeFilesToManifest(dir);
  const report = validateModule(dir);
  if (report.errors.length) return { report };
  const built = buildPackage(dir);
  mkdirSync(outDir, { recursive: true });
  const zipPath = join(outDir, `${built.slug}-${built.version}.zip`);
  const shaPath = `${zipPath}.sha256`;
  writeFileSync(zipPath, built.bytes);
  writeFileSync(shaPath, `${built.sha256}  ${basename(zipPath)}\n`, "utf8");
  return { report, built, zipPath, shaPath };
}
