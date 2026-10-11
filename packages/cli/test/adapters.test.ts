import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { createContext } from "../src/context.ts";
import { loadCoreAssets } from "../src/core-assets.ts";
import { applyAdapters, bridgeContent, ensurePointer, upsertManagedBlock } from "../src/install/adapters.ts";
import { newLock } from "../src/state/lock.ts";

const markers = { begin: "<!-- flyee:begin -->", end: "<!-- flyee:end -->" };
let dir: string;

before(() => {
  dir = mkdtempSync(join(tmpdir(), "flyee-adapters-"));
});
after(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("managed blocks never touch what the member wrote", () => {
  it("appends to an existing file, replaces its own block and reports unchanged when equal", () => {
    const path = join(dir, "AGENTS.md");
    writeFileSync(path, "# Meu projeto\n\nRegras minhas.\n");
    assert.equal(upsertManagedBlock(path, "bloco 1", markers), "updated");
    let content = readFileSync(path, "utf8");
    assert.ok(content.startsWith("# Meu projeto\n\nRegras minhas.\n"));
    assert.ok(content.includes("<!-- flyee:begin -->\nbloco 1\n<!-- flyee:end -->"));
    assert.equal(upsertManagedBlock(path, "bloco 1", markers), "unchanged");
    assert.equal(upsertManagedBlock(path, "bloco 2", markers), "updated");
    content = readFileSync(path, "utf8");
    assert.ok(content.includes("bloco 2") && !content.includes("bloco 1"));
    assert.equal(content.split("flyee:begin").length, 2, "one block only");
  });

  it("creates the file when it does not exist", () => {
    const path = join(dir, "fresh", "AGENTS.md");
    assert.equal(upsertManagedBlock(path, "x", markers), "created");
    assert.ok(readFileSync(path, "utf8").includes("x"));
  });

  it("adds a pointer only when the file lacks it", () => {
    const path = join(dir, "CLAUDE.md");
    writeFileSync(path, "# Instruções\n");
    assert.equal(ensurePointer(path, "@AGENTS.md", markers, "<!-- nota -->"), "updated");
    assert.ok(readFileSync(path, "utf8").includes("\n@AGENTS.md\n"));
    assert.equal(ensurePointer(path, "@AGENTS.md", markers, "<!-- nota -->"), "unchanged");
    const own = join(dir, "GEMINI.md");
    writeFileSync(own, "@./AGENTS.md\n");
    assert.equal(ensurePointer(own, "@./AGENTS.md", markers, "<!-- nota -->"), "unchanged");
  });
});

describe("adapters for detected tools", () => {
  it("writes whole blocks into .windsurfrules only when present, and the rest always", () => {
    const cwd = join(dir, "project");
    mkdirSync(cwd, { recursive: true });
    writeFileSync(join(cwd, ".windsurfrules"), "my rules\n");
    const ctx = createContext({ cwd, homeDir: dir, env: { PATH: "" }, locale: "en" });
    const assets = loadCoreAssets();
    const lock = newLock(ctx, assets.core.version);
    const report = applyAdapters(ctx, assets, lock);
    assert.ok(report.written.includes(".windsurfrules"));
    assert.ok(!existsSync(join(cwd, "CONVENTIONS.md")), "the Aider block is not written without Aider");
    const rules = readFileSync(join(cwd, ".windsurfrules"), "utf8");
    assert.ok(rules.startsWith("my rules\n") && rules.includes("flyee.club"));
    assert.ok(readFileSync(join(cwd, "AGENTS.md"), "utf8").includes("No app installed yet"));
    assert.ok(readFileSync(join(cwd, ".agents", "skills", "flyee", "SKILL.md"), "utf8").includes("name: flyee"));
    for (const dir of [".agents", ".claude"]) {
      assert.ok(readFileSync(join(cwd, dir, "skills", "texto-natural", "SKILL.md"), "utf8").includes("name: texto-natural"), `texto-natural in ${dir}`);
      assert.ok(readFileSync(join(cwd, dir, "skills", "texto-natural", "LICENSE"), "utf8").startsWith("MIT License"), `the MIT notice goes with the copy in ${dir}`);
    }
    assert.ok(readFileSync(join(cwd, "AGENTS.md"), "utf8").includes("texto-natural"));
    assert.ok(lock.managed_files.includes("AGENTS.md") && lock.managed_files.includes("CLAUDE.md"));
    const second = applyAdapters(ctx, assets, lock);
    assert.ok(second.unchanged.includes("AGENTS.md"), "idempotent on the second run");
  });
});

describe("bridges", () => {
  it("carry the original frontmatter and point at the canonical skill", () => {
    const ctx = createContext({ cwd: dir, homeDir: dir, env: { PATH: "" }, locale: "pt-BR" });
    const bridge = bridgeContent(ctx, "radar", { name: "radar-outliers", description: 'Diz "oi" e usa: dois pontos.', extra: { license: "MIT", unknown: "x" } });
    assert.ok(bridge.startsWith('---\nname: radar-outliers\ndescription: "Diz \\"oi\\" e usa: dois pontos."\nlicense: "MIT"\n---'));
    assert.ok(!bridge.includes("unknown"));
    assert.ok(bridge.includes("../../../.flyee/modules/radar/skills/radar-outliers/SKILL.md"));
  });
});
