#!/usr/bin/env node
// Operator tooling over modules/*. Runs straight from TypeScript:
//   node --experimental-strip-types packages/module-tools/src/cli.ts validate [slug...]
//   node --experimental-strip-types packages/module-tools/src/cli.ts pack [slug...] [--out dir]
//   node --experimental-strip-types packages/module-tools/src/cli.ts index [--out dir]

import { existsSync } from "node:fs";
import { join, relative } from "node:path";

import { writeIndex } from "./index-build.ts";
import { packModule } from "./pack.ts";
import { distRoot, listModuleDirs, modulesRoot, repoRoot } from "./paths.ts";
import { type Report, validateAll } from "./validate.ts";

const args = process.argv.slice(2);
const command = args[0];
const option = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const slugs = args.slice(1).filter((arg, index, all) => !arg.startsWith("--") && all[index - 1] !== "--out");

function selectDirs(): string[] {
  if (slugs.length === 0) return listModuleDirs();
  return slugs.map((slug) => {
    const dir = join(modulesRoot, slug);
    if (!existsSync(join(dir, "flyee.module.json"))) {
      console.error(`No app named "${slug}" under modules/.`);
      process.exit(2);
    }
    return dir;
  });
}

function printReport(report: Report): void {
  const label = relative(repoRoot, report.dir).replace(/\\/g, "/");
  if (report.errors.length === 0) {
    console.log(`OK   ${label}${report.manifest ? ` ${report.manifest.version}` : ""} (${report.files.length} files, ${report.skills.length} skills)`);
  } else {
    console.log(`FAIL ${label}`);
    for (const error of report.errors) console.log(`     error: ${error}`);
  }
  for (const warning of report.warnings) console.log(`     warning: ${warning}`);
}

if (command === "validate") {
  const dirs = selectDirs();
  if (dirs.length === 0) {
    console.log("No apps under modules/ yet (modules/_template is skipped).");
    process.exit(0);
  }
  const reports = validateAll(dirs);
  reports.forEach(printReport);
  const failed = reports.filter((report) => report.errors.length).length;
  console.log(failed ? `${failed} of ${reports.length} apps failed.` : `${reports.length} apps valid.`);
  process.exit(failed ? 1 : 0);
} else if (command === "pack") {
  const dirs = selectDirs();
  if (dirs.length === 0) {
    console.log("No apps under modules/ yet (modules/_template is skipped).");
    process.exit(0);
  }
  const outDir = option("out") ?? join(distRoot, "modules");
  let failed = 0;
  for (const dir of dirs) {
    const result = packModule(dir, outDir);
    printReport(result.report);
    if (result.built && result.zipPath) {
      console.log(`     ${relative(repoRoot, result.zipPath).replace(/\\/g, "/")}  ${result.built.sizeBytes} bytes`);
      console.log(`     sha256 ${result.built.sha256}`);
    } else {
      failed += 1;
    }
  }
  process.exit(failed ? 1 : 0);
} else if (command === "index") {
  const dirs = listModuleDirs();
  const path = writeIndex(dirs, option("out") ?? distRoot);
  console.log(`${relative(repoRoot, path).replace(/\\/g, "/")} written with ${dirs.length} apps.`);
} else {
  console.error("Usage: cli.ts <validate|pack|index> [slug...] [--out dir]");
  process.exit(2);
}
