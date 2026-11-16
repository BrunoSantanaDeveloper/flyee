// The commands as the member's AI runs them, in a project folder made for the test.
// The rounds are counted: how many times the member is asked something on the way to a document.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "..");
const FIXTURES = join(HERE, "fixtures");

/** A project with the app installed where the CLI puts it. */
function project() {
  const root = mkdtempSync(join(tmpdir(), "sales-copilot-"));
  const installed = join(root, ".flyee", "modules", "sales-copilot");
  mkdirSync(installed, { recursive: true });
  for (const part of ["flyee.module.json", "scripts", "references"]) cpSync(join(APP, part), join(installed, part), { recursive: true });
  cpSync(join(FIXTURES, "call-clinica.txt"), join(root, "call.txt"));
  const run = (...args) => {
    const result = spawnSync(process.execPath, [join(installed, "scripts", "copilot.mjs"), ...args, "--json"], { cwd: root, encoding: "utf8", env: { ...process.env, OPENROUTER_API_KEY: "", GEMINI_API_KEY: "" }, timeout: 60_000 });
    let output;
    try {
      output = JSON.parse(result.stdout);
    } catch {
      throw new Error(`not JSON (${args.join(" ")}): ${result.stdout}\n${result.stderr}`);
    }
    return { ...output, status: result.status };
  };
  return { root, run, done: () => rmSync(root, { recursive: true, force: true }) };
}

test("a transcript becomes a document, with one question to the member", () => {
  const { root, run, done } = project();
  try {
    let asked = 0; // what only the member can answer on this path

    const check = run("check");
    assert.equal(check.interface_version, 1);
    assert.deepEqual(check.modes, { review: true, practice: true, live: false });
    assert.equal(check.openrouter_key, false);
    assert.equal(check.gemini_key, false);
    assert.equal(check.live_audio, null);
    assert.match(check.gemini_setup.command, /key set GEMINI_API_KEY --browser --json$/);
    assert.match(check.openrouter_setup.command, /^npx --yes flyee@latest key set OPENROUTER_API_KEY --browser --json$/);

    const first = run("call", "new", "call.txt");
    assert.equal(first.created, false);
    assert.equal(first.needs, "seller");
    assert.equal(first.ask, "Quem é o vendedor nesta call?");
    asked += 1;
    assert.equal(existsSync(join(root, "copiloto-de-vendas")), false, "nothing is written before the app knows who sells");

    const created = run("call", "new", "call.txt", "--seller", "Rafael", "--name", "Clínica Movimento", "--date", "2026-11-10");
    assert.equal(created.created, true);
    assert.match(created.id, /^2026-11-10-clinica-movimento-[0-9a-f]{4}$/);
    assert.equal(created.to_read, 15);
    assert.match(created.then, /^node \.flyee\/modules\/sales-copilot\/scripts\/copilot\.mjs call questions /);

    const questions = run("call", "questions", "last", "--batch", "10");
    assert.equal(questions.pending, 15);
    assert.equal(questions.batch.length, 10);
    assert.equal(questions.guide, ".flyee/modules/sales-copilot/references/perguntas.json");
    assert.ok(existsSync(join(root, questions.guide)));
    assert.deepEqual(questions.batch[1].needs, ["stage", "scores", "move"]);
    assert.deepEqual(questions.optional.map((turn) => turn.text), ["Pode."]);
    assert.equal(questions.write, `copiloto-de-vendas/calls/${created.id}/respostas.json`);

    const all = JSON.parse(readFileSync(join(FIXTURES, "respostas-clinica.json"), "utf8")).turns;
    const write = (turns) => writeFileSync(join(root, questions.write), JSON.stringify({ turns }));

    write([{ ...all[1], stage: "descoberta" }]);
    const refused = run("call", "answer", "last", "--file", questions.write);
    assert.equal(refused.ok, false);
    assert.equal(refused.error.code, "invalid_answer");
    assert.match(refused.error.message, /^turns\[0\]\.stage: /);
    assert.equal(refused.status, 1);

    write(all.filter((turn) => turn.i <= 10));
    const half = run("call", "answer", "last", "--file", questions.write);
    assert.equal(half.done, false);
    assert.equal(half.pending, 5);

    const rest = run("call", "questions", "last");
    assert.deepEqual(rest.batch.map((turn) => turn.i), [11, 12, 13, 14, 15]);
    assert.equal(rest.context.length, 6);

    write(all.filter((turn) => turn.i > 10));
    const finished = run("call", "answer", "last", "--file", questions.write);
    assert.equal(finished.done, true);
    assert.equal(finished.signal, 63.7);
    assert.equal(finished.say.length, 3);
    assert.equal(finished.playbook_from, "model");
    for (const file of Object.values(finished.files)) assert.ok(existsSync(join(root, file)), file);
    const report = readFileSync(join(root, finished.files.report), "utf8");
    assert.match(report, /^# Leitura da call: Clínica Movimento/);
    assert.match(report, /Data: 2026-11-10/);
    assert.match(report, /Origem das falas: transcrição trazida pelo integrante \(call\.txt\)/);

    assert.equal(asked, 1, "one question on the whole path: who the seller is");

    assert.equal(run("call", "outcome", "last", "won").outcome, "won");
    const summary = run("summary");
    assert.equal(summary.with_outcome, 1);
    assert.equal(summary.comparison.confidence, "indício");
    assert.equal(run("call", "list").calls[0].signal, 63.7);
    assert.equal(run("call", "report", "nope").error.code, "call_not_found");
    assert.equal(run("call", "new", "nao-existe.txt").error.code, "file_not_found");
    const unknown = run("call", "new", "call.txt", "--speed", "2");
    assert.equal(unknown.error.code, "usage");
    assert.equal(unknown.status, 2);
  } finally {
    done();
  }
});

test("the playbook of the business: one round, then the project's own weights", () => {
  const { root, run, done } = project();
  try {
    const init = run("playbook", "init");
    assert.equal(init.created, true);
    assert.equal(init.file, "copiloto-de-vendas/playbook.json");
    assert.equal(init.questions.length, 4, "everything fits one message");
    assert.deepEqual(init.waiting, []);
    assert.equal(run("playbook", "init").created, false, "a playbook the member has is never overwritten");

    const file = join(root, init.file);
    const playbook = JSON.parse(readFileSync(file, "utf8"));
    playbook.business.offer = { value: "Agenda com confirmação automática para clínicas", origin: "site do projeto", date: "2026-11-15" };
    playbook.business.price = { value: "R$ 1.200 por mês", origin: "o integrante disse na conversa", date: "2026-11-15" };
    playbook.business.next_step = { value: "Uma segunda conversa com dia e hora marcados.", origin: "sugestão aceita pelo integrante", date: "2026-11-15" };
    playbook.business.alternatives = { unknown: true };
    playbook.moves.find((move) => move.id === "state_the_price").lines = ["O plano é R$ 1.200 por mês, com a implantação incluída. Como isso bate com o que você esperava?"];
    writeFileSync(file, JSON.stringify(playbook, null, 2));
    const checked = run("playbook", "check");
    assert.equal(checked.ready, true);
    assert.deepEqual(checked.questions, [], "a second round has nothing left to ask");

    playbook.moves[0].lines.push("Nove em cada dez clínicas reduzem as faltas em 40 por cento.");
    writeFileSync(file, JSON.stringify(playbook, null, 2));
    const invented = run("playbook", "check");
    assert.equal(invented.ready, false);
    assert.equal(invented.problems.length, 1);
    const blocked = run("call", "new", "call.txt", "--seller", "Rafael");
    assert.equal(blocked.error.code, "invalid_playbook");
    playbook.moves[0].lines.pop();
    writeFileSync(file, JSON.stringify(playbook, null, 2));

    run("call", "new", "call.txt", "--seller", "Rafael");
    const answers = join(root, "respostas.json");
    cpSync(join(FIXTURES, "respostas-clinica.json"), answers);
    const before = run("call", "answer", "last", "--file", "respostas.json");
    assert.equal(before.playbook_from, "project");
    writeFileSync(join(root, "copiloto-de-vendas", "pesos.json"), JSON.stringify({ weights: { next_step_set: { points: 30 } } }));
    const after = run("call", "report", "last");
    assert.ok(after.signal > before.signal, "the reading is redone with the project's weights");
    assert.match(readFileSync(join(root, after.files.report), "utf8"), /com os ajustes do arquivo de pesos deste projeto/);
    writeFileSync(join(root, "copiloto-de-vendas", "pesos.json"), JSON.stringify({ weights: { charm: { points: 30 } } }));
    assert.equal(run("call", "report", "last").error.code, "invalid_weights");
  } finally {
    done();
  }
});

test("practice: the AI plays the client and each round returns the reading", () => {
  const { root, run, done } = project();
  try {
    const start = run("practice", "start", "--name", "treino de preço");
    assert.match(start.then, /practice add /);
    const round = (turns) => {
      writeFileSync(join(root, start.write), JSON.stringify({ turns }));
      return run("practice", "add", start.id, "--file", start.write);
    };
    const one = round(start.format.turns);
    assert.equal(one.turns, 2);
    assert.match(one.say[0], /^Sinal: /);
    assert.equal(one.now.move.id, "size_the_impact");
    const two = round([
      { speaker: "seller", text: "O plano custa mil reais por mês.", stage: "price", facts: { money_discussed: 1 } },
      { speaker: "client", text: "Achei caro para o que eu preciso agora.", stage: "objection", signals: { objection: 0.9 }, objection_kind: "price", scores: { tone: 1, participation: 1, urgency: 0 }, move: "answer_price_objection" },
    ]);
    assert.equal(two.turns, 4);
    assert.ok(two.now.signal < one.now.signal);
    assert.match(two.say.join(" "), /Objeção em aberto: preço/);
    const bad = round([{ speaker: "narrator", text: "..." }]);
    assert.match(bad.error.message, /^turns\[0\]\.speaker: /);
    const end = run("practice", "end", start.id);
    assert.ok(existsSync(join(root, end.files.report)));
    assert.deepEqual(end.decisions, [], "a practice call has no outcome to report");
    assert.equal(run("summary").calls, 0, "practice stays out of the comparison");
  } finally {
    done();
  }
});
