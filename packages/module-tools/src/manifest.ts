import { readFileSync } from "node:fs";

import { Ajv2020 } from "ajv/dist/2020.js";

import { MANIFEST_FILE } from "./files.ts";
import { schemaPath } from "./paths.ts";
import { isSafePackagePath } from "./safe-path.ts";

export const TRAILS = ["planejar", "construir", "publicar", "divulgar", "vender", "escalar", "manter"] as const;
export const MODULE_TYPES = ["skill", "workflow", "framework", "tool"] as const;
export const MAX_FILES = 2000;
export const MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;

export type Localized = { "pt-BR": string; en?: string };

export type Manifest = {
  manifest_version: number;
  name: string;
  version: string;
  type: (typeof MODULE_TYPES)[number];
  trail: string;
  title: Localized;
  summary: Localized;
  compatible_ais: string[];
  min_core?: string;
  entry: string;
  files: string[];
  external_credentials?: { name: string; env: string; url?: string; required: boolean; purpose: Localized }[];
  permissions?: { kind: string; scope: string; reason: Localized }[];
  lessons?: Record<string, unknown>;
  changelog?: Localized;
  license?: string;
};

const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as Record<string, unknown>;
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateShape = ajv.compile(schema);

/** Errors from the pinned JSON Schema, one line each, as `path: message`. */
export function schemaErrors(raw: unknown): string[] {
  if (validateShape(raw)) return [];
  return (validateShape.errors ?? []).map((error) => {
    const path = error.instancePath.replace(/^\//, "").replace(/\//g, ".");
    const detail =
      error.keyword === "additionalProperties"
        ? `unknown key "${(error.params as { additionalProperty?: string }).additionalProperty}"`
        : error.message ?? error.keyword;
    return path ? `${path}: ${detail}` : detail;
  });
}

/** The rules the schema cannot express (CLI-CONTRACT.md, section 6). */
export function crossFieldErrors(manifest: Manifest): string[] {
  const errors: string[] = [];
  if (!manifest.files.includes(manifest.entry)) errors.push("entry: must be one of `files`");
  if (new Set(manifest.files).size !== manifest.files.length) errors.push("files: must not repeat a path");
  if (manifest.files.includes(MANIFEST_FILE)) errors.push(`files: must not list ${MANIFEST_FILE} itself`);
  for (const file of manifest.files) {
    if (!isSafePackagePath(file)) errors.push(`files: "${file}" is not a safe relative path`);
  }
  if (!isSafePackagePath(manifest.entry)) errors.push(`entry: "${manifest.entry}" is not a safe relative path`);
  if (new Set(manifest.compatible_ais).size !== manifest.compatible_ais.length) {
    errors.push("compatible_ais: must not repeat a tool");
  }
  const envs = (manifest.external_credentials ?? []).map((credential) => credential.env);
  if (new Set(envs).size !== envs.length) errors.push("external_credentials: must not repeat an env name");
  if (!(TRAILS as readonly string[]).includes(manifest.trail)) {
    errors.push(`trail: "${manifest.trail}" is not one of ${TRAILS.join(", ")}`);
  }
  if (!manifest.changelog?.["pt-BR"]?.trim()) errors.push("changelog: pt-BR text is required for every version");
  if (manifest.files.length > MAX_FILES) errors.push(`files: at most ${MAX_FILES} files`);
  return errors;
}

export function readManifest(path: string): { manifest: Manifest | null; error: string | null } {
  let text: string;
  try {
    text = readFileSync(path, "utf8").replace(/^﻿/, "");
  } catch {
    return { manifest: null, error: `${MANIFEST_FILE} is missing` };
  }
  try {
    return { manifest: JSON.parse(text) as Manifest, error: null };
  } catch {
    return { manifest: null, error: `${MANIFEST_FILE} is not valid JSON` };
  }
}

export function serializeManifest(manifest: Manifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
