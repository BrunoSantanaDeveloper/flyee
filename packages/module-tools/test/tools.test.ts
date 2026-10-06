import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { unzipSync } from "fflate";

import { parseFrontmatter } from "../src/frontmatter.ts";
import { buildPackage, packModule, writeFilesToManifest } from "../src/pack.ts";
import { repoRoot } from "../src/paths.ts";
import { isSafePackagePath } from "../src/safe-path.ts";
import { compareSemver, isSemver, minimumOfRange } from "../src/semver.ts";
import { validateAll, validateModule } from "../src/validate.ts";

const template = join(repoRoot, "modules", "_template");
let sandbox: string;

/** A fresh copy of the template renamed to a real slug, with `files` regenerated. */
function makeApp(slug: string): string {
  const dir = join(sandbox, slug);
  cpSync(template, dir, { recursive: true });
  const manifestPath = join(dir, "flyee.module.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.name = slug;
  manifest.entry = `skills/${slug}/SKILL.md`;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  cpSync(join(dir, "skills", "meu-app"), join(dir, "skills", slug), { recursive: true });
  rmSync(join(dir, "skills", "meu-app"), { recursive: true });
  const skillPath = join(dir, "skills", slug, "SKILL.md");
  writeFileSync(skillPath, readFileSync(skillPath, "utf8").replace("name: meu-app", `name: ${slug}`));
  const evalPath = join(dir, "tests", "eval.json");
  writeFileSync(evalPath, readFileSync(evalPath, "utf8").replace('"meu-app"', `"${slug}"`));
  writeFilesToManifest(dir);
  return dir;
}

before(() => {
  sandbox = mkdtempSync(join(tmpdir(), "flyee-tools-"));
});
after(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe("semver, as the catalog orders it", () => {
  it("accepts and refuses what the contract says", () => {
    for (const ok of ["0.0.1", "1.2.3", "1.0.0-beta.1", "99999.0.0"]) assert.equal(isSemver(ok), true, ok);
    for (const bad of ["1.2", "01.2.3", "1.2.3+build", "v1.2.3", "100000.0.0"]) assert.equal(isSemver(bad), false, bad);
  });
  it("orders releases after their prereleases", () => {
    assert.ok(compareSemver("1.0.0-beta.1", "1.0.0") < 0);
    assert.ok(compareSemver("1.2.0", "1.10.0") < 0);
    assert.equal(compareSemver("1.0.0", "1.0.0"), 0);
  });
  it("reads the minimum of a min_core comparator", () => {
    assert.equal(minimumOfRange(">=1.2.0"), "1.2.0");
    assert.equal(minimumOfRange("^1.0.0"), "1.0.0");
    assert.equal(minimumOfRange("x"), null);
  });
});

describe("safe package paths", () => {
  it("refuses escapes", () => {
    for (const bad of ["../x", "a/../b", "/abs", "C:\\x", "a\\b", "", "a/./b"]) assert.equal(isSafePackagePath(bad), false, bad);
    for (const ok of ["SKILL.md", "skills/a/SKILL.md", "scripts/score.py"]) assert.equal(isSafePackagePath(ok), true, ok);
  });
});

describe("frontmatter", () => {
  it("reads plain, quoted and folded values", () => {
    const parsed = parseFrontmatter(`---\nname: radar\ndescription: >\n  Finds outliers.\n  Use when asked.\nlicense: "MIT"\n---\n# Body\n`);
    assert.ok(parsed);
    assert.equal(parsed.data.name, "radar");
    assert.equal(parsed.data.description, "Finds outliers. Use when asked.");
    assert.equal(parsed.data.license, "MIT");
    assert.equal(parsed.body.trim(), "# Body");
  });
  it("returns null without a frontmatter", () => {
    assert.equal(parseFrontmatter("# no frontmatter"), null);
  });
});

describe("validate", () => {
  it("accepts the template renamed to a real slug", () => {
    const report = validateModule(makeApp("radar"));
    assert.deepEqual(report.errors, []);
    assert.equal(report.skills.length, 1);
    assert.ok(report.files.includes("README.md"));
    assert.ok(!report.files.some((file) => file.startsWith("tests/")), "tests never ship");
  });

  it("refuses a stale files list, an unsafe entry and a missing eval", () => {
    const dir = makeApp("pauta");
    writeFileSync(join(dir, "extra.md"), "novo arquivo");
    rmSync(join(dir, "tests"), { recursive: true });
    const manifestPath = join(dir, "flyee.module.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.entry = "../escape.md";
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const report = validateModule(dir);
    assert.ok(report.errors.some((error) => error.startsWith("files: out of date")), report.errors.join("\n"));
    assert.ok(report.errors.some((error) => error.startsWith("entry:")));
    assert.ok(report.errors.some((error) => error.startsWith("tests/eval.json: missing")));
  });

  it("refuses a manifest that drifts from the schema and a skill whose name differs from its folder", () => {
    const dir = makeApp("copy-lp");
    const manifestPath = join(dir, "flyee.module.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.trail = "video";
    manifest.unknown = true;
    writeFileSync(manifestPath, JSON.stringify(manifest));
    let report = validateModule(dir);
    assert.ok(report.errors.some((error) => error.includes('unknown key "unknown"')), report.errors.join("\n"));

    delete manifest.unknown;
    manifest.trail = "divulgar";
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const skillPath = join(dir, "skills", "copy-lp", "SKILL.md");
    writeFileSync(skillPath, readFileSync(skillPath, "utf8").replace("name: copy-lp", "name: outro"));
    report = validateModule(dir);
    assert.ok(report.errors.some((error) => error.includes('must equal the folder')), report.errors.join("\n"));
  });

  it("refuses the same skill name in two apps", () => {
    const a = makeApp("app-a");
    const b = makeApp("app-b");
    for (const dir of [a, b]) {
      cpSync(join(dir, "skills", dir === a ? "app-a" : "app-b"), join(dir, "skills", "shared"), { recursive: true });
      const shared = join(dir, "skills", "shared", "SKILL.md");
      writeFileSync(shared, readFileSync(shared, "utf8").replace(/name: app-[ab]/, "name: shared"));
      writeFilesToManifest(dir);
    }
    const reports = validateAll([a, b]);
    for (const report of reports) {
      assert.ok(report.errors.some((error) => error.includes('"shared" is also used by')), report.errors.join("\n"));
    }
  });
});

describe("pack", () => {
  it("is deterministic and matches the manifest in both directions", () => {
    const dir = makeApp("takes");
    const first = buildPackage(dir);
    const second = buildPackage(dir);
    assert.equal(first.sha256, second.sha256);
    const entries = unzipSync(first.bytes);
    const names = Object.keys(entries).filter((name) => !name.endsWith("/")).sort();
    assert.deepEqual(names, ["flyee.module.json", ...first.files].sort());
    const packed = JSON.parse(new TextDecoder().decode(entries["flyee.module.json"]));
    assert.deepEqual(packed.files, first.files);
    assert.ok(!names.some((name) => name.startsWith("tests/")));
  });

  it("writes the zip and the checksum file", () => {
    const dir = makeApp("roteiro");
    const out = join(sandbox, "dist");
    const result = packModule(dir, out);
    assert.deepEqual(result.report.errors, []);
    assert.ok(result.zipPath?.endsWith("roteiro-1.0.0.zip"));
    const sha = readFileSync(result.shaPath!, "utf8");
    assert.ok(sha.startsWith(result.built!.sha256));
  });
});
