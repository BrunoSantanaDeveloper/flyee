import { unzipSync } from "fflate";

import { CliError } from "../api/errors.ts";
import type { CatalogCredential, CatalogPermission, Localized } from "../api/types.ts";
import { sha256Hex } from "../util/fs.ts";

export const MANIFEST_FILE = "flyee.module.json";
const MAX_ENTRIES = 2001;
const MAX_UNCOMPRESSED = 200 * 1024 * 1024;

/** The parts of the manifest the CLI uses (CLI-CONTRACT.md, section 6). Unknown keys are ignored. */
export type Manifest = {
  manifest_version: number;
  name: string;
  version: string;
  type: string;
  trail: string;
  title: Localized;
  summary: Localized;
  compatible_ais?: string[];
  min_core?: string;
  entry: string;
  files: string[];
  external_credentials?: CatalogCredential[];
  permissions?: CatalogPermission[];
  changelog?: Localized;
  license?: string;
};

export type InspectedPackage = { manifest: Manifest; files: string[]; entries: Record<string, Uint8Array> };

/** CLI-CONTRACT.md section 6: relative, forward slashes, no `.`/`..`, no drive letter, no control characters. */
export function isSafePackagePath(value: string): boolean {
  if (!value || value.length > 240) return false;
  if (value.startsWith("/") || value.includes("\\") || value.includes(":")) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  return value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

/**
 * Checks everything before anything is written: the bytes against the size and
 * SHA-256 the platform announced, every entry path, the manifest, and the
 * archive's file list against `files` in both directions (CLI-CONTRACT.md 4.5
 * and section 7). Any mismatch refuses the whole package.
 */
export function inspectPackage(
  bytes: Uint8Array,
  expected: { sha256: string; size_bytes: number; slug: string; version?: string },
): InspectedPackage {
  if (bytes.byteLength !== expected.size_bytes) {
    throw new CliError("package_size", `size ${bytes.byteLength}, expected ${expected.size_bytes}`);
  }
  const actual = sha256Hex(bytes);
  if (actual !== expected.sha256.toLowerCase()) throw new CliError("package_checksum", `sha256 ${actual}, expected ${expected.sha256}`);

  let count = 0;
  let uncompressed = 0;
  const unsafe: string[] = [];
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, {
      filter(file) {
        count += 1;
        uncompressed += file.originalSize;
        if (file.name.endsWith("/")) return false;
        if (!isSafePackagePath(file.name)) {
          unsafe.push(file.name);
          return false;
        }
        return true;
      },
    });
  } catch {
    throw new CliError("package_zip", "not a valid ZIP archive");
  }
  if (unsafe.length) throw new CliError("package_path", `unsafe entry: ${unsafe[0]}`);
  if (count > MAX_ENTRIES) throw new CliError("package_limits", `${count} entries`);
  if (uncompressed > MAX_UNCOMPRESSED) throw new CliError("package_limits", "too large once extracted");

  const manifestBytes = entries[MANIFEST_FILE];
  if (!manifestBytes) throw new CliError("package_manifest", `${MANIFEST_FILE} missing from the root`);
  let manifest: Manifest;
  try {
    manifest = JSON.parse(new TextDecoder("utf-8").decode(manifestBytes).replace(/^﻿/, "")) as Manifest;
  } catch {
    throw new CliError("package_manifest", `${MANIFEST_FILE} is not valid JSON`);
  }
  if (manifest.manifest_version !== 1) throw new CliError("package_manifest", `manifest_version ${String(manifest.manifest_version)} is not supported`);
  if (manifest.name !== expected.slug) throw new CliError("package_manifest", `name "${manifest.name}" is not "${expected.slug}"`);
  if (expected.version && manifest.version !== expected.version) {
    throw new CliError("package_manifest", `version "${manifest.version}" is not "${expected.version}"`);
  }
  if (!Array.isArray(manifest.files) || typeof manifest.entry !== "string") throw new CliError("package_manifest", "files or entry missing");

  const inArchive = Object.keys(entries).filter((name) => name !== MANIFEST_FILE).sort();
  const declared = [...manifest.files].sort();
  if (inArchive.length !== declared.length || inArchive.some((file, index) => file !== declared[index])) {
    throw new CliError("package_files", "the archive and the manifest's files disagree");
  }
  if (!manifest.files.includes(manifest.entry)) throw new CliError("package_files", "entry is not among files");

  return { manifest, files: inArchive, entries };
}
