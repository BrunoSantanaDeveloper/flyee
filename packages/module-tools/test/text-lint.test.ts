import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

import { unzipSync } from "fflate";

import { repoRoot } from "../src/paths.ts";
import { isMemberText, lintMemberText, proseOf, teachesPatterns } from "../src/text-lint.mjs";

describe("the pt-BR writing check", () => {
  it("blocks only an em dash glued between words", () => {
    assert.deepEqual(lintMemberText("O app faz isso—e mais.").violations.length, 1);
    assert.equal(lintMemberText("O app faz isso — e mais.").violations.length, 0);
    assert.equal(lintMemberText("Entre 3–4 segundos, de 0–1 e 64–100 px.").violations.length, 0, "a range is correct typography");
    assert.equal(lintMemberText("Rode `a—b` no código.").violations.length, 0, "inline code is not prose");
    assert.equal(lintMemberText("```\nisso—aquilo\n```\n").violations.length, 0, "fenced code is not prose");
  });

  it("warns on dashes, AI vocabulary and formulas, but not on quoted citations", () => {
    const warned = lintMemberText("Uma ferramenta poderosa. Não é só um app, é um sistema — de verdade.");
    assert.ok(warned.advisories.some((advisory) => advisory.startsWith("[vocabulario-ia]")));
    assert.ok(warned.advisories.some((advisory) => advisory.startsWith("[formula-ia]")));
    assert.ok(warned.advisories.some((advisory) => advisory.startsWith("[travessao]")));
    const cited = lintMemberText('Evite fórmulas como "não é só X, é Y" e palavras como "poderoso".');
    assert.deepEqual(cited.advisories, []);
  });

  it("warns on a paragraph that opens with a decorative connector", () => {
    assert.ok(lintMemberText("Além disso, o app grava.").advisories.some((advisory) => advisory.startsWith("[conector]")));
  });

  it("applies only the hard rule to the text that teaches the patterns", () => {
    assert.equal(teachesPatterns("packages/core/assets/skills/texto-natural/SKILL.md"), true);
    assert.equal(teachesPatterns("modules/youtube-script/references/voz.md"), false);
    const catalog = "**Palavras de alerta:** crucial, vibrante. Isso muda tudo — e mais.";
    assert.deepEqual(lintMemberText(catalog, { teachesPatterns: true }).advisories, []);
    assert.equal(lintMemberText("Lista—colada", { teachesPatterns: true }).violations.length, 1);
  });

  it("keeps prose only", () => {
    assert.equal(proseOf("---\nname: x\n---\nTexto `code` [link](https://a.b/c—d)").includes("code"), false);
    assert.equal(proseOf("<!-- nota—interna -->\nTexto").includes("nota"), false);
  });

  it("knows which files reach the member", () => {
    assert.equal(isMemberText("modules/video-render/README.md"), true);
    assert.equal(isMemberText("modules/video-render/references/som.md"), true);
    assert.equal(isMemberText("packages/core/assets/skills/texto-natural/SKILL.md"), true);
    assert.equal(isMemberText("modules/video-render/tests/fixtures/x.md"), false);
    assert.equal(isMemberText("modules/video-studio/.dev/SPEC.md"), false);
    assert.equal(isMemberText("modules/x/notes.dev.md"), false);
    assert.equal(isMemberText("modules/_template/README.md"), false);
    assert.equal(isMemberText("modules/x/scripts/run.mjs"), false);
    assert.equal(isMemberText("docs/PLANO.md"), false);
  });
});

/**
 * The rule that keeps the check honest: no hard finding on any text members
 * receive today, the packed ZIPs in dist/ included (a free version is rebuilt
 * from its ZIP, not from modules/). A new hard rule that fails here is a false
 * positive until proven otherwise.
 */
describe("the existing member texts", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") walk(path);
      } else files.push(path);
    }
  };
  walk(join(repoRoot, "modules"));
  walk(join(repoRoot, "packages", "core", "assets"));

  it("have no hard finding", () => {
    const hard = files
      .map((path) => relative(repoRoot, path).replace(/\\/g, "/"))
      .filter(isMemberText)
      .flatMap((rel) => lintMemberText(readFileSync(join(repoRoot, rel), "utf8")).violations.map((violation) => `${rel}: ${violation}`));
    assert.deepEqual(hard, []);
  });

  it("have no hard finding in the packed apps either", () => {
    let zips: string[] = [];
    try {
      zips = readdirSync(join(repoRoot, "dist", "modules")).filter((name) => name.endsWith(".zip"));
    } catch {
      return; // nothing packed on this machine
    }
    const hard: string[] = [];
    for (const zip of zips) {
      const entries = unzipSync(new Uint8Array(readFileSync(join(repoRoot, "dist", "modules", zip))));
      for (const [name, bytes] of Object.entries(entries)) {
        if (!name.endsWith(".md")) continue;
        for (const violation of lintMemberText(new TextDecoder().decode(bytes)).violations) hard.push(`${zip}/${name}: ${violation}`);
      }
    }
    assert.deepEqual(hard, []);
  });
});
