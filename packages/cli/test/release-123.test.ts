import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadCoreAssets } from "../src/core-assets.ts";
import { compareSemver } from "../src/semver.ts";

/**
 * CLI 1.2.3, core 1.10.0: a plan, a report or a reading of results is the one
 * case where "keep it simple" would hurt. The chat stays short and the full
 * document goes to the app's file, questions come in one message with a
 * suggestion each, and a request for a plan is routed to the planning app,
 * not to the creatives briefing.
 */
describe("the core knows what to do with a plan or a report", () => {
  const assets = loadCoreAssets();

  it("is core 1.10.0 or later", () => {
    assert.ok(compareSemver(assets.core.version, "1.10.0") >= 0, assets.core.version);
  });

  for (const locale of ["pt-BR", "en"] as const) {
    it(`in ${locale}, the block carries the exception, the questions rule and the routing`, () => {
      const block = assets.agentsTemplate(locale);
      const exception = locale === "en" ? /The exception is a plan, a report or a reading of results/ : /A exceção é um plano, um relatório ou uma leitura de resultados/;
      const file = locale === "en" ? /full document goes to the app's file/ : /documento completo vai para o arquivo do app/;
      const questions = locale === "en" ? /Questions go in one message, four at most, each with your suggestion/ : /Perguntas vão numa mensagem só, até quatro, cada uma com a sua sugestão/;
      const routing = locale === "en" ? /work of the planning app, not of the creatives briefing/ : /trabalho do app de plano, não do briefing de criativos/;
      for (const rule of [exception, file, questions, routing]) assert.match(block, rule);
      // The short-chat rule itself stays: the exception is an exception.
      assert.match(block, locale === "en" ? /Keep it simple/ : /Fale simples/);
    });
  }
});
