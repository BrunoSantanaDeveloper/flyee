import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { copyDir } from "../src/util/fs.ts";

let dir: string;

before(() => {
  dir = mkdtempSync(join(tmpdir(), "flyee-fs-"));
});
after(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("copyDir", () => {
  it("copies a tree into a destination with accents and spaces, where it was asked to", () => {
    const source = join(dir, "origem");
    mkdirSync(join(source, "skills", "ação"), { recursive: true });
    writeFileSync(join(source, "flyee.module.json"), "{}");
    writeFileSync(join(source, "skills", "ação", "SKILL.md"), "# Ação\n");
    // A member's project folder often carries accents: on Node 24 for Windows, fs.cpSync
    // writes this destination into a sibling folder with a garbled name.
    const target = join(dir, "João Antônio", "módulo");
    copyDir(source, target);
    assert.equal(readFileSync(join(target, "flyee.module.json"), "utf8"), "{}");
    assert.equal(readFileSync(join(target, "skills", "ação", "SKILL.md"), "utf8"), "# Ação\n");
    assert.deepEqual(readdirSync(dir).sort(), ["João Antônio", "origem"], "nothing written next to the destination");
  });

  it("merges into an existing destination and overwrites files with the same name", () => {
    const source = join(dir, "novo");
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, "a.txt"), "novo");
    const target = join(dir, "destino");
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, "a.txt"), "antigo");
    writeFileSync(join(target, "b.txt"), "fica");
    copyDir(source, target);
    assert.equal(readFileSync(join(target, "a.txt"), "utf8"), "novo");
    assert.ok(existsSync(join(target, "b.txt")));
  });
});
