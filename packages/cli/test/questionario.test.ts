import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadCoreAssets } from "../src/core-assets.ts";
import { compareSemver } from "../src/semver.ts";

/**
 * Core 1.11.0: how the member's AI asks, for every app, present or future. It finds what it can
 * find, asks only what can be answered now, writes the suggestion inside the question so "sim"
 * accepts it, and sends what another person knows through the `questionario` skill.
 */
describe("the core says how to ask, and what to do when the answer is with someone else", () => {
  const assets = loadCoreAssets();

  it("is core 1.11.0 or later", () => {
    assert.ok(compareSemver(assets.core.version, "1.11.0") >= 0, assets.core.version);
  });

  for (const locale of ["pt-BR", "en"] as const) {
    it(`in ${locale}, the block carries the rule and names the skill`, () => {
      const block = assets.agentsTemplate(locale);
      const rules =
        locale === "en"
          ? [/How to ask/, /media-plan\/marca\.md/, /depends on one still open waits for the next round/, /"yes" accepts it/, /needs its own answer/, /`questionario`/]
          : [/Como perguntar/, /media-plan\/marca\.md/, /depende de outra ainda em aberto fica para a rodada seguinte/, /"sim" a aceite/, /pede resposta própria/, /`questionario`/];
      for (const rule of rules) assert.match(block, rule);
      assert.ok(block.split("\n").filter((line) => /`questionario`/.test(line)).length === 1, "one rule, in one place");
    });
  }

  it("ships the skill with its license, in both languages' installs", () => {
    for (const locale of ["pt-BR", "en"] as const) {
      const skill = assets.coreSkills(locale).find((candidate) => candidate.name === "questionario");
      assert.ok(skill, `questionario for ${locale}`);
      assert.match(skill.files["SKILL.md"] ?? "", /^---\nname: questionario\n/);
      assert.ok((skill.files.LICENSE ?? "").startsWith("MIT License"));
      assert.match(skill.files.LICENSE ?? "", /Matt Pocock/);
    }
  });

  it("keeps the description short enough for every session, and the send out of the document", () => {
    const skill = assets.coreSkills("pt-BR").find((candidate) => candidate.name === "questionario");
    const text = skill?.files["SKILL.md"] ?? "";
    const description = /^description: (.*)$/m.exec(text)?.[1] ?? "";
    assert.ok(description.length > 0 && description.length < 400, `${description.length} characters`);
    assert.match(text, /questionarios\/<assunto>\.md/, "the project is the folder");
    assert.match(text, /Lista de contatos, nome de cliente da marca, chave e senha ficam de fora/);
    assert.match(text, /Quem envia é ele/);
  });
});
