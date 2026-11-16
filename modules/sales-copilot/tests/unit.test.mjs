// The pure parts: reading a transcript, checking answers, the arithmetic of the reading, the playbook rules.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { isShortReply, parseAiAnswer, parseModelAnswer, readCall, snapshot } from "../scripts/lib/engine.mjs";
import { buildQuestions, buildState, decisionsUrl } from "../scripts/lib/judge.mjs";
import { checkPlaybook } from "../scripts/lib/playbook.mjs";
import { chatSummary, compareOutcomes, renderReport } from "../scripts/lib/report.mjs";
import { assignRoles, mergeTurns, parseTranscript, speakersOf } from "../scripts/lib/transcript.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "..");
const json = (path) => JSON.parse(readFileSync(join(APP, path), "utf8"));
const bank = json("references/perguntas.json");
const weights = json("references/pesos.json");
const playbook = json("references/playbook-modelo.json");
const method = { bank, weights, playbook, weightsFrom: "app", playbookFrom: "model" };
const fixture = (name) => readFileSync(join(HERE, "fixtures", name), "utf8");

function clinic() {
  const pieces = parseTranscript(fixture("call-clinica.txt"), "call-clinica.txt");
  const turns = mergeTurns(pieces, assignRoles(pieces, "Rafael"));
  const answers = {};
  for (const raw of JSON.parse(fixture("respostas-clinica.json")).turns) answers[raw.i] = parseAiAnswer(raw, turns[raw.i], method);
  return { turns, answers };
}
const read = (turns, answers, extra = {}) => readCall({ turns, answers, bank, weights, playbook, ...extra });
const code = (fn) => {
  try {
    fn();
  } catch (error) {
    return { code: error.code, message: error.message };
  }
  return null;
};

test("a text transcript: names, times and who is who", () => {
  const pieces = parseTranscript(fixture("call-clinica.txt"), "call-clinica.txt");
  assert.equal(pieces.length, 16);
  assert.deepEqual(speakersOf(pieces).map((speaker) => speaker.label), ["Rafael", "Carla"]);
  assert.equal(assignRoles(pieces), null, "two first names do not say who sells: the app asks");
  const turns = mergeTurns(pieces, assignRoles(pieces, "rafael"));
  assert.equal(turns[0].speaker, "seller");
  assert.equal(turns[1].speaker, "client");
  assert.equal(turns[3].t, 38);
  assert.equal(code(() => assignRoles(pieces, "Marina")).code, "unknown_speaker");
});

test("a word followed by a colon is not a person", () => {
  const pieces = parseTranscript("Vendedor: Oi, tudo bem?\nCliente: Tudo.\nVendedor: Então me conta.\nResumindo: são dois problemas.\nCliente: Isso.", "c.txt");
  assert.equal(pieces.length, 4);
  assert.match(pieces[2].text, /Resumindo: são dois problemas\.$/);
  const roles = assignRoles(pieces);
  assert.equal(roles.get("vendedor"), "seller");
  assert.equal(roles.get("cliente"), "client");
});

test("captions: cues of the same person become one turn", () => {
  const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<v Ana Souza>Oi, obrigada pelo tempo.\n\n00:00:03.500 --> 00:00:05.000\n<v Ana Souza>Como funciona hoje?\n\n00:01:10.000 --> 00:01:14.000\n<v Bruno>Hoje é manual.\n";
  const pieces = parseTranscript(vtt, "call.vtt");
  const turns = mergeTurns(pieces, assignRoles(pieces, "Ana Souza"));
  assert.equal(turns.length, 2);
  assert.equal(turns[0].text, "Oi, obrigada pelo tempo. Como funciona hoje?");
  assert.equal(turns[1].t, 70);
});

test("a JSON transcript, and one with nobody named", () => {
  const pieces = parseTranscript(JSON.stringify([{ speaker: "Vendedor", text: "Oi", start: "0:05" }, { speaker: "Cliente", text: "Olá", start: 9 }]), "c.json");
  assert.deepEqual(pieces.map((piece) => piece.t), [5, 9]);
  assert.equal(code(() => parseTranscript("um texto corrido sem nomes\nnem falas marcadas", "c.txt")).code, "no_speakers");
  assert.equal(code(() => assignRoles(parseTranscript("Vendedor: oi\nVendedor: tudo bem", "c.txt"), "Vendedor")).code, "no_client");
});

test("an answer is refused with the path of the wrong field", () => {
  const { turns } = clinic();
  const client = turns[1];
  const good = { i: 1, stage: "discovery", scores: { tone: 1, participation: 2, urgency: 1 }, move: "size_the_impact" };
  assert.ok(parseAiAnswer(good, client, method));
  const bad = (change, path = "turns[1]") => code(() => parseAiAnswer({ ...good, ...change }, client, method, path));
  assert.match(bad({ stage: "pitch" }).message, /^turns\[1\]\.stage: /);
  assert.match(bad({ signals: { objection: 1.4 } }).message, /^turns\[1\]\.signals\.objection: /);
  assert.match(bad({ signals: { happy: 1 } }).message, /signals\.happy: id desconhecido/);
  assert.match(bad({ scores: { tone: 1, participation: 3, urgency: 1 } }).message, /scores\.participation: esperado um inteiro de 0 a 2/);
  assert.match(bad({ scores: { tone: 1, urgency: 1 } }).message, /scores\.participation: falta a nota/);
  assert.match(bad({ move: undefined }).message, /move: falta a jogada/);
  assert.match(bad({ move: "close_hard" }).message, /move: esperado o id de uma jogada/);
  assert.match(bad({ signals: { objection: 0.9 } }).message, /objection_kind: a fala levanta uma objeção/);
  assert.match(bad({ verdict: "boa call" }).message, /verdict: campo desconhecido/);
  // a signal of the other side is dropped and told, never counted
  const seller = parseAiAnswer({ i: 0, stage: "opening", signals: { interest: 0.9, open_question: 1 } }, turns[0], method);
  assert.deepEqual(seller.signals, { open_question: 1 });
  assert.deepEqual(seller.ignored, ["interest"]);
});

test("the reading of the clinic call", () => {
  const { turns, answers } = clinic();
  const { steps, summary } = read(turns, answers);
  assert.equal(steps.length, 16);
  assert.equal(summary.coverage.judged, 15);
  assert.equal(summary.coverage.short, 1, '"Pode." is too short to judge');
  assert.equal(summary.signal.final, 63.7);
  assert.equal(summary.signal.label, "Regra de bolso");
  assert.deepEqual(summary.objections.map((item) => [item.kind, item.how, item.closed_at]), [["price", "resolved", 13], ["authority", "resolved", 15]]);
  assert.deepEqual(summary.pending.map((item) => item.label), ["Cliente mostrou interesse", "Prazo"]);
  assert.equal(summary.facts.find((fact) => fact.id === "next_step_set").at_turn, 15);
  assert.deepEqual(summary.notes.map((note) => note.code), ["seller_talked_most", "monologues"]);
  assert.equal(summary.drops[0].i, 11);
  // the movers of a moment add up to its points
  for (const moment of [...summary.drops, ...summary.rises]) {
    assert.ok(moment.movers.length, `turn ${moment.i} names what moved`);
    assert.ok(moment.movers.every((mover) => Math.sign(mover.points) === Math.sign(moment.points)));
  }
  assert.equal(steps[11].line, "Faz sentido olhar com cuidado. Posso comparar com o que você disse que isso te custa hoje?");
  const now = snapshot({ steps, summary }, turns, playbook);
  assert.equal(now.signal, 63.7);
  assert.equal(now.objection, null);
});

test("the same answers with other weights give another number, and nothing is asked again", () => {
  const { turns, answers } = clinic();
  const heavier = structuredClone(weights);
  heavier.weights.objection_open.points = -30;
  const before = read(turns, answers).summary;
  const after = read(turns, answers, { weights: heavier }).summary;
  assert.ok(after.signal.curve[12] < before.signal.curve[12], "the open objection weighs more");
  assert.equal(after.signal.curve[5], before.signal.curve[5], "before the objection nothing changes");
  assert.deepEqual(after.objections, before.objections);
});

test("an objection nobody returns to is left, and the price before the impact is noted", () => {
  const turns = [];
  const answers = {};
  const add = (speaker, text, answer) => {
    const turn = { i: turns.length, speaker, name: speaker, text, t: null };
    turns.push(turn);
    if (answer) answers[turn.i] = parseAiAnswer({ i: turn.i, ...answer }, turn, method);
  };
  const scores = { tone: 1, participation: 1, urgency: 0 };
  add("seller", "O plano custa trezentos reais por mês para a sua loja.", { stage: "price", facts: { money_discussed: 1 } });
  add("client", "Agora não é um bom momento para a gente mexer nisso.", { stage: "objection", signals: { objection: 0.9 }, objection_kind: "timing", scores, move: "answer_timing_objection" });
  for (let n = 0; n < 5; n++) {
    add("seller", "Deixa eu te mostrar mais uma parte do sistema que pode ajudar.", { stage: "presentation", signals: { feature_dump: 0.9 } });
    add("client", "Certo, pode mostrar essa parte então.", { stage: "presentation", scores, move: "stop_and_ask" });
  }
  const { summary } = read(turns, answers);
  assert.deepEqual(summary.objections.map((item) => [item.kind, item.how]), [["timing", "left"]]);
  const codes = summary.notes.map((note) => note.code);
  for (const expected of ["price_before_impact", "objection_left", "no_next_step", "decider_unknown"]) assert.ok(codes.includes(expected), expected);
});

test("a turn nobody answered keeps the number where it was", () => {
  const { turns, answers } = clinic();
  delete answers[12];
  const { steps, summary } = read(turns, answers);
  assert.equal(steps[12].judged, false);
  assert.equal(steps[12].signal, steps[11].signal);
  assert.equal(summary.coverage.not_judged, 1);
  assert.equal(isShortReply(turns[7], weights), true);
  assert.equal(isShortReply({ i: 3, text: "Quanto custa?" }, weights), false, "a question is never skipped");
});

test("the playbook: one round of questions, and no number the member did not give", () => {
  const first = checkPlaybook(playbook, bank);
  assert.deepEqual(first.problems, []);
  assert.deepEqual(first.questions.map((question) => [question.key, question.kind]), [["offer", "find"], ["price", "fact"], ["next_step", "decision"], ["alternatives", "fact"]]);
  assert.ok(first.questions.find((question) => question.key === "next_step").suggestion, "a decision carries its suggestion");
  assert.equal(first.questions.find((question) => question.key === "price").suggestion, undefined, "a fact only the member knows has none");

  const own = structuredClone(playbook);
  own.moves.find((move) => move.id === "state_the_price").lines[0] = "O plano é R$ 1.200 por mês, com a implantação incluída.";
  const invented = checkPlaybook(own, bank);
  assert.equal(invented.problems.length, 1);
  assert.match(invented.problems[0].path, /^moves\[\d+\]\.lines\[0\]$/);
  assert.match(invented.problems[0].message, /1\.200/);

  own.business.price = { value: "R$ 1.200 por mês", origin: "o integrante disse na conversa", date: "2026-11-15" };
  own.business.offer = { value: "Agenda com confirmação automática para clínicas", origin: "site do projeto", date: "2026-11-15" };
  own.business.next_step = { value: "Uma segunda conversa com dia e hora marcados.", origin: "sugestão aceita pelo integrante", date: "2026-11-15" };
  own.business.alternatives = { unknown: true };
  const done = checkPlaybook(own, bank);
  assert.deepEqual(done.problems, []);
  assert.deepEqual(done.questions, []);

  own.business.offer.origin = "";
  assert.match(checkPlaybook(own, bank).problems[0].path, /business\.offer\.origin/);
  own.moves.push({ ...own.moves[0] });
  assert.ok(checkPlaybook(own, bank).problems.some((problem) => /aparece duas vezes/.test(problem.message)));
});

test("the document and the chat lines carry no judgement of their own", () => {
  const { turns, answers } = clinic();
  const call = { id: "x", name: "Clínica Movimento", mode: "review", judge: "ai", date: "2026-11-15", turns, source: { origin: "transcrição trazida pelo integrante", file: "call.txt" }, outcome: null };
  const reading = read(turns, answers);
  const text = renderReport(call, reading, method);
  assert.match(text, /regra de bolso/);
  assert.match(text, /Uma call sozinha é um indício/);
  assert.match(text, /playbook modelo do app/);
  assert.doesNotMatch(text, /probabilidade|vai fechar|previs[ãa]o de/i);
  assert.doesNotMatch(text, /[–—!]/u);
  const chat = chatSummary(call, reading);
  assert.equal(chat.say.length, 3);
  assert.equal(chat.decisions.length, 1);
});

test("comparing calls by outcome is an indication below the minimum sample", () => {
  const calls = [{ outcome: "won", final_signal: 70 }, { outcome: "won", final_signal: 60 }, { outcome: "lost", final_signal: 30 }, { outcome: null, final_signal: 50 }];
  const result = compareOutcomes(calls, 10);
  assert.equal(result.confidence, "indício");
  assert.equal(result.won.mean_signal, 65);
  assert.match(result.text, /pelo menos 10 calls de cada lado/);
  assert.match(compareOutcomes([], 10).text, /Ainda não há calls/);
});

test("the live judge: questions by speaker, facts not asked twice, a refusal counts as not answered", () => {
  const { turns, answers } = clinic();
  const partial = Object.fromEntries(Object.entries(answers).filter(([i]) => Number(i) < 4));
  const reading = read(turns.slice(0, 4), partial);
  const forSeller = buildQuestions(turns[4], reading, method);
  const forClient = buildQuestions(turns[5], reading, method);
  assert.ok(forSeller.s_open_question && !forSeller.s_objection && !forSeller.objection_kind);
  assert.ok(forClient.s_objection && forClient.objection_kind && !forClient.s_open_question);
  assert.equal(forClient.f_problem_named, undefined, "already established");
  assert.ok(forClient.f_value_stated);
  assert.equal(Object.keys(forClient.move.criteria).length, playbook.moves.length);
  const state = buildState(turns, 5, reading, method);
  assert.equal(state.latest_turn.who, "client");
  assert.ok(state.call.established.includes("impact_sized"));

  const parsed = parseModelAnswer(
    {
      s_objection: { type: "noul", noul: 0.91 },
      s_interest: { type: "refusal" },
      c_participation: { type: "score", score: 1.6, confidence: 0.7 },
      stage: { type: "choice", choice: "price", confidence: 0.8 },
      objection_kind: { type: "choice", choice: "price", confidence: 0.9 },
      move: { type: "choice", choice: "not_a_move", confidence: 0.9 },
    },
    turns[11],
    method,
  );
  assert.equal(parsed.signals.objection, 0.91);
  assert.equal(parsed.signals.interest, undefined);
  assert.equal(parsed.move, null);
  assert.equal(parsed.stage, "price");
  assert.ok(parsed.unanswered > 0);
});

test("the model address can only be moved to this machine", () => {
  const keep = process.env.SALES_COPILOT_DECISIONS_URL;
  process.env.SALES_COPILOT_DECISIONS_URL = "https://example.com/steal";
  assert.equal(decisionsUrl(), "https://openrouter.ai/api/alpha/decisions");
  process.env.SALES_COPILOT_DECISIONS_URL = "http://127.0.0.1:9/x";
  assert.equal(decisionsUrl(), "http://127.0.0.1:9/x");
  if (keep === undefined) delete process.env.SALES_COPILOT_DECISIONS_URL;
  else process.env.SALES_COPILOT_DECISIONS_URL = keep;
});
