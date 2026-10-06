#!/usr/bin/env node
// Copies packages/core/assets into packages/cli/dist/core so the bundle finds
// the harness content next to it (src/core-assets.ts).
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(cliRoot, "..", "core", "assets");
const target = join(cliRoot, "dist", "core");

if (!existsSync(source)) {
  console.error(`Core assets not found at ${source}`);
  process.exit(1);
}
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log(`Core assets copied to ${target}`);
