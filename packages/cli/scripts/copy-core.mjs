#!/usr/bin/env node
// Copies packages/core/assets into packages/cli/dist/core so the bundle finds
// the harness content next to it (src/core-assets.ts).
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// File by file: fs.cpSync on Node 24 for Windows garbles a destination path with accents.
function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.isDirectory()) copyDir(join(from, entry.name), join(to, entry.name));
    else if (entry.isFile()) copyFileSync(join(from, entry.name), join(to, entry.name));
  }
}

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(cliRoot, "..", "core", "assets");
const target = join(cliRoot, "dist", "core");

if (!existsSync(source)) {
  console.error(`Core assets not found at ${source}`);
  process.exit(1);
}
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
copyDir(source, target);
console.log(`Core assets copied to ${target}`);
