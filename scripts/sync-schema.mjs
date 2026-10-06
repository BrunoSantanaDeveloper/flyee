#!/usr/bin/env node
// Refreshes schemas/flyee.module.schema.json from a running platform
// (GET /api/cli/schema/module, public) and reports whether it changed.
//
//   node scripts/sync-schema.mjs [--base https://flyee.club] [--check]
//
// `--check` exits 1 when the pinned copy differs from the platform's, so CI can
// catch drift once the platform is deployed. Until then the pinned copy was
// generated from the platform repository's `@flyee/catalog` package.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const base = option("base", process.env.FLYEE_BASE_URL ?? "https://flyee.club").replace(/\/$/, "");
const checkOnly = args.includes("--check");
const target = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "schemas", "flyee.module.schema.json");

const response = await fetch(`${base}/api/cli/schema/module`);
if (!response.ok) {
  console.error(`The platform answered ${response.status} for the module schema.`);
  process.exit(1);
}
const remote = `${JSON.stringify(await response.json(), null, 2)}\n`;
let current = null;
try {
  current = readFileSync(target, "utf8");
} catch {
  current = null;
}

if (current === remote) {
  console.log("Schema is up to date.");
  process.exit(0);
}
if (checkOnly) {
  console.error("schemas/flyee.module.schema.json differs from the platform. Run `npm run schema:sync`.");
  process.exit(1);
}
writeFileSync(target, remote, "utf8");
console.log("Schema updated from the platform.");
