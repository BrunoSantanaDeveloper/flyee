// 1.1.1: the rounds, walked as the AI walks them. A premise whose answer depends on one still open
// waits for the next round, a suggestion is accepted by a yes, and an "I don't know" closes a question.

import assert from "node:assert/strict";
import test from "node:test";

import { PREMISES, premisesTemplate, questionsFor, validatePremises } from "../scripts/lib/premises.mjs";

function answer(data, key, value = "respondido", source = "informado") {
  data.premises[key].value = value;
  data.premises[key].source = source;
}

function walk(data, reply = (key) => answer(data, key)) {
  const rounds = [];
  for (let guard = 0; guard < 12; guard++) {
    const { questions } = questionsFor(data, 4);
    if (!questions.length) break;
    rounds.push(questions.map((question) => question.key));
    for (const question of questions) reply(question.key);
  }
  return rounds;
}

test("the event never shares a round with the price it depends on", () => {
  const data = premisesTemplate("plano");
  const rounds = walk(data);
  assert.deepEqual(rounds, [
    ["produto_oferta", "publico", "meta_data", "verba"],
    ["preco_planos", "base", "prontidao", "capacidade"],
    ["evento", "contas_rastreamento"],
  ]);
  assert.deepEqual(rounds.flat().sort(), PREMISES.map((premise) => premise.key).sort(), "every premise is asked, once");
  assert.deepEqual(validatePremises(data).blocking_pending, []);
});

test("waiting says what a premise waits for, and more_pending counts it", () => {
  const data = premisesTemplate("plano");
  const first = questionsFor(data, 4);
  assert.deepEqual(first.waiting, [{ key: "evento", after: ["preco_planos"] }]);
  assert.equal(first.more_pending, PREMISES.length - 4);
  answer(data, "preco_planos");
  const next = questionsFor(data, 4);
  assert.deepEqual(next.waiting, []);
});

test("an I don't know closes the price, so the event is never stuck behind it", () => {
  const data = premisesTemplate("plano");
  answer(data, "preco_planos", "não sei ainda");
  validatePremises(data);
  assert.deepEqual(questionsFor(data, 10).waiting, []);
  assert.ok(questionsFor(data, 10).questions.some((question) => question.key === "evento"));
});

test("a pending suggestion does not release what depends on it: the member has not said yes", () => {
  const data = premisesTemplate("plano");
  data.premises.preco_planos.value = "R$ 149 por mês";
  data.premises.preco_planos.source = "sugerido-pendente";
  data.premises.preco_planos.if_different = "A conta do custo permitido muda.";
  assert.deepEqual(questionsFor(data, 10).waiting, [{ key: "evento", after: ["preco_planos"] }]);
});

test("a suggestion says a yes accepts it; a question with none does not", () => {
  const data = premisesTemplate("plano");
  data.premises.verba.value = "R$ 4.000 no total";
  data.premises.verba.source = "sugerido-pendente";
  data.premises.verba.if_different = "Com menos verba a fase de testes encolhe.";
  const { questions } = questionsFor(data, 4);
  assert.equal(questions.find((question) => question.key === "verba").yes_accepts, true);
  assert.equal(questions.find((question) => question.key === "publico").yes_accepts, false);
});
