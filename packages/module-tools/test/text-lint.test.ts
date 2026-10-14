import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

import { unzipSync } from "fflate";

import { readManifest } from "../src/manifest.ts";
import { modulesRoot, repoRoot } from "../src/paths.ts";
import { scriptStrings } from "../src/script-text.ts";
import { copyBreaks, isMemberText, lintMemberText, proseOf, storeBreaks, teachesPatterns } from "../src/text-lint.mjs";

const rules = (text: string) => lintMemberText(text).violations.map((violation) => violation.slice(1, violation.indexOf("]")));

describe("the platform's copy rules", () => {
  it("refuse any dash, in prose, in a range and in code alike", () => {
    assert.deepEqual(rules("O app faz isso—e mais."), ["travessao"]);
    assert.deepEqual(rules("O app faz isso — e mais."), ["travessao"]);
    assert.deepEqual(rules("Entre 3–4 segundos."), ["travessao"], "the platform refuses the en dash of a range too");
    assert.deepEqual(rules("Rode `a—b` no código."), ["travessao"]);
    assert.deepEqual(rules("```\nisso—aquilo\n```\n"), ["travessao"]);
    assert.deepEqual(rules("Entre 3 a 4 segundos, de 0 a 1, com `3-4` e −16 LUFS."), [], "a hyphen and a minus sign are not dashes");
  });

  it("refuse an emoji but keep © and →, and the check marks", () => {
    assert.deepEqual(rules("Feito ✅"), ["emoji"]);
    assert.deepEqual(rules("Lançamos 🚀"), ["emoji"]);
    assert.deepEqual(rules("© 2026 · Ver planos → ✓ passou · ✗ reprovou · △ aviso · ○ não medido"), []);
  });

  it("refuse the exclamation mark in prose, never in code", () => {
    assert.deepEqual(rules("E-mail enviado!"), ["exclamacao"]);
    assert.deepEqual(rules("Compare com `a !== b` e `<!doctype html>`.\n\n```js\nif (!ok) throw x;\n```\n"), []);
    assert.deepEqual(rules("![logo](https://flyee.club/logo.png)"), [], "image syntax is not an exclamation");
  });

  it("refuse the banned words in both languages, as prefixes, quoted or not", () => {
    assert.deepEqual(rules("Desbloqueie seu acesso."), ["palavra"]);
    assert.deepEqual(rules("Potencialize o negócio sem esforço."), ["palavra"]);
    assert.deepEqual(rules("Um motor robusto."), ["palavra"]);
    assert.deepEqual(rules('Evite "robusto" e "seamless".'), ["palavra"], "the platform has no exception for a citation");
    assert.deepEqual(rules("It’s not just a tool; it unlocks everything."), ["palavra"]);
    assert.deepEqual(rules("Bloqueie o acesso e libere depois."), []);
  });

  it("add, for what the store shows, the free offer and the name of FlyeeClub Pro", () => {
    assert.equal(storeBreaks("Crie a sua conta grátis.").length, 1);
    assert.equal(storeBreaks("Use the free plan.").length, 1);
    assert.deepEqual(storeBreaks("Entram no seu acesso sem custo extra, para freelancers."), []);
    assert.equal(storeBreaks("Só no FlyeeClub Pro.").length, 1);
    assert.deepEqual(storeBreaks("Só no FlyeeClub Pro.", { pro: false }), [], "a guide is read inside the member area");
    assert.deepEqual(storeBreaks("Exporta em ProRes e roda no GoPro."), []);
  });

  it("say on which line the first break is", () => {
    const [violation] = copyBreaks("linha um\nlinha dois\nlinha — três");
    assert.ok(violation.includes("(linha 3)"), violation);
  });
});

describe("the pt-BR style advisories", () => {
  it("warn on AI vocabulary and formulas, but not on quoted citations", () => {
    const warned = lintMemberText("Uma ferramenta poderosa. Não é só um app, é um sistema de verdade.");
    assert.ok(warned.advisories.some((advisory) => advisory.startsWith("[vocabulario-ia]")));
    assert.ok(warned.advisories.some((advisory) => advisory.startsWith("[formula-ia]")));
    const cited = lintMemberText('Evite fórmulas como "não é só X, é Y" e palavras como "poderoso".');
    assert.deepEqual(cited.advisories, []);
  });

  it("warn on a paragraph that opens with a decorative connector", () => {
    assert.ok(lintMemberText("Além disso, o app grava.").advisories.some((advisory) => advisory.startsWith("[conector]")));
  });

  it("skip the text that teaches the patterns, whose copy rules still hold", () => {
    assert.equal(teachesPatterns("packages/core/assets/skills/texto-natural/SKILL.md"), true);
    assert.equal(teachesPatterns("modules/youtube-script/references/voz.md"), false);
    const catalog = "**Palavras de alerta:** crucial, vibrante. Isso muda tudo.";
    assert.deepEqual(lintMemberText(catalog, { teachesPatterns: true }).advisories, []);
    assert.equal(lintMemberText("Lista—colada", { teachesPatterns: true }).violations.length, 1);
  });
});

describe("prose and member text", () => {
  it("keeps prose only, line by line", () => {
    const prose = proseOf("---\nname: x\n---\nTexto `code` [link](https://a.b/c)\n<!-- nota -->\n```\nx\n```\nFim");
    assert.equal(prose.split("\n").length, 9, "one line of prose per line of the file");
    assert.equal(prose.includes("code") || prose.includes("nota") || prose.includes("name: x"), false);
    assert.ok(prose.split("\n")[8].includes("Fim"));
  });

  it("knows which files reach the member", () => {
    assert.equal(isMemberText("modules/video-render/README.md"), true);
    assert.equal(isMemberText("modules/video-render/guides/pt-BR/usar.md"), true);
    assert.equal(isMemberText("packages/core/assets/skills/texto-natural/SKILL.md"), true);
    assert.equal(isMemberText("modules/video-render/tests/fixtures/x.md"), false);
    assert.equal(isMemberText("modules/video-studio/.dev/SPEC.md"), false);
    assert.equal(isMemberText("modules/x/notes.dev.md"), false);
    assert.equal(isMemberText("modules/_template/README.md"), false);
    assert.equal(isMemberText("modules/x/scripts/run.mjs"), false);
    assert.equal(isMemberText("docs/PLANO.md"), false);
  });

  it("reads the strings a script prints, never its comments or regular expressions", () => {
    const found = scriptStrings('// um comentário — fora\nconst a = "um — dois";\nconst b = `x ${a} — y`;\nconst c = /[—–]/;\n');
    assert.deepEqual(found.map((item) => item.line), [2, 3, 3]);
    assert.ok(found.every((item) => !item.text.includes("comentário")));
  });
});

/**
 * The rule that keeps the check honest: no hard finding on any text members
 * receive today, nor in the package of each app's current version. A ZIP of
 * an older version is frozen history (a released version never changes), so
 * only the current one is read.
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

  it("have no hard finding in the package of each current version", () => {
    let zips: string[] = [];
    try {
      zips = readdirSync(join(repoRoot, "dist", "modules")).filter((name) => name.endsWith(".zip"));
    } catch {
      return; // nothing packed on this machine
    }
    const current = new Set(
      readdirSync(modulesRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
        .map((entry) => readManifest(join(modulesRoot, entry.name, "flyee.module.json")).manifest)
        .filter((manifest) => manifest !== null)
        .map((manifest) => `${manifest!.name}-${manifest!.version}.zip`),
    );
    const hard: string[] = [];
    for (const zip of zips.filter((name) => current.has(name))) {
      const entries = unzipSync(new Uint8Array(readFileSync(join(repoRoot, "dist", "modules", zip))));
      for (const [name, bytes] of Object.entries(entries)) {
        if (!name.endsWith(".md")) continue;
        for (const violation of lintMemberText(new TextDecoder().decode(bytes)).violations) hard.push(`${zip}/${name}: ${violation}`);
      }
    }
    assert.deepEqual(hard, []);
  });
});
