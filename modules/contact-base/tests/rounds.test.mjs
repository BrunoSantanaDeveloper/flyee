// 1.2.0: what the member answers about the legal basis, walked round by round as the AI does it.
// Before this version the file took 32 answers, four per message: eight rounds for one spreadsheet.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildInventory, GROUPS, readExport } from "../scripts/lib/inventory.mjs";
import { knownValues, legalQuestions, legalRound, legalTemplate, parseLegal, upgradeLegal } from "../scripts/lib/legal.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");
const SCRIPT = resolve(HERE, "..", "scripts", "contacts.mjs");
const THRESHOLDS = JSON.parse(readFileSync(join(HERE, "..", "references", "limiares.json"), "utf8"));
const TODAY = "2026-10-23";
const read = (name) => readFileSync(join(FIXTURES, name), "utf8");
const inventoryOf = (name = "contatos-sinteticos.csv") => buildInventory([{ ...readExport(read(name), { file: name }), file: name }], { today: TODAY, thresholds: THRESHOLDS }).inventory;

/** Writes an answer the way the skill says: on the shared line, or on each group's line for the basis. */
function answer(text, question) {
  const label = { como_entrou: "Como entrou", texto_aceito: "Texto aceito", onde_guardada: "Onde está guardada", dados_presentes: "Dados presentes", ultimo_contato: "Último contato e descadastros", teto_contatos: "Teto de contatos", retencao: "Retenção", base_legal: "Base legal" }[question.key];
  const lines = text.split("\n");
  let section = null;
  return lines
    .map((line) => {
      if (line.startsWith("## ")) section = line;
      if (!line.startsWith(`- ${label} (`) || !line.trim().endsWith(":")) return line;
      if (question.key === "base_legal") return `${line} legitimo-interesse`;
      return section === "## Todos os grupos" ? `${line} resposta` : line;
    })
    .join("\n");
}

function walk(text, groups = GROUPS) {
  const rounds = [];
  for (let guard = 0; guard < 12; guard++) {
    const { questions } = legalRound(parseLegal(text), groups);
    if (!questions.length) break;
    rounds.push(questions);
    for (const question of questions) text = answer(text, question);
  }
  return { rounds, text };
}

test("the whole base legal closes in two rounds, not eight, and the basis comes after what decides it", () => {
  const inventory = inventoryOf();
  const { rounds, text } = walk(legalTemplate({ inventory, today: TODAY }));
  assert.equal(rounds.length, 2, JSON.stringify(rounds.map((round) => round.map((question) => question.key))));
  assert.deepEqual(rounds[0].map((question) => question.key), ["como_entrou", "texto_aceito", "onde_guardada", "teto_contatos"]);
  assert.deepEqual(rounds[1].map((question) => question.key), ["retencao", "base_legal"]);
  assert.ok(rounds.flat().length <= 6, "six answers instead of 32");
  const parsed = parseLegal(text);
  for (const group of GROUPS) {
    assert.equal(parsed[group].status, "completo", `${group}: ${parsed[group].missing.join(",")}`);
    assert.equal(parsed[group].fields.como_entrou, "resposta", "the shared answer reaches every group");
    assert.equal(parsed[group].marketing_allowed, true);
  }
});

test("a suggestion is accepted by a yes; the legal basis is a rights decision and needs its own answer", () => {
  const inventory = inventoryOf();
  const parsed = parseLegal(legalTemplate({ inventory, today: TODAY }));
  const first = legalRound(parsed, GROUPS);
  const teto = first.questions.find((question) => question.key === "teto_contatos");
  assert.equal(teto.yes_accepts, true);
  assert.equal(teto.write_to, "Todos os grupos");
  assert.ok(teto.suggestion);
  assert.equal(first.questions.find((question) => question.key === "como_entrou").yes_accepts, false, "only the member knows how people came in");
  assert.deepEqual(first.waiting, [{ key: "base_legal", after: ["como_entrou", "texto_aceito"] }]);
  assert.equal(first.more_pending, 2);

  const filled = walk(legalTemplate({ inventory, today: TODAY })).rounds[1].find((question) => question.key === "base_legal");
  assert.equal(filled.own_answer, true);
  assert.equal(filled.yes_accepts, false);
  assert.deepEqual(filled.groups, GROUPS);
  assert.match(filled.suggestion, /Nunca ativaram: consentimento/);
  assert.match(filled.suggestion, /Clientes: legitimo-interesse/);
});

test("a group that is different keeps its own line; the shared line never overrides it", () => {
  const inventory = inventoryOf();
  let text = legalTemplate({ inventory, today: TODAY });
  text = text.replace(/(## Clientes[\s\S]*?- Como entrou \([^\n]*:)\n/, "$1 pela compra\n");
  text = text.replace(/(## Todos os grupos[\s\S]*?- Como entrou \([^\n]*:)\n/, "$1 pelo cadastro no site\n");
  const parsed = parseLegal(text);
  assert.equal(parsed.clientes.fields.como_entrou, "pela compra");
  assert.equal(parsed.testaram.fields.como_entrou, "pelo cadastro no site");
});

test("what the inventory knows is never asked: the data present and, with the column, the last contact", () => {
  const inventory = inventoryOf();
  assert.equal(typeof inventory.groups.clientes.unsubscribed, "number");
  assert.match(inventory.groups.clientes.last_contact, /^\d{4}-\d{2}-\d{2}$/);
  const known = knownValues(inventory);
  assert.match(known.shared.dados_presentes, /e-mail, telefone, nome/);
  assert.match(known.groups.clientes.ultimo_contato, /última mensagem em \d{2}\/\d{2}\/\d{4}/);
  assert.match(known.groups.clientes.ultimo_contato, /do inventário/);
  const parsed = parseLegal(legalTemplate({ inventory, today: TODAY }));
  for (const group of GROUPS) {
    assert.ok(!parsed[group].missing.includes("dados_presentes"), group);
    assert.ok(!parsed[group].missing.includes("ultimo_contato"), group);
  }
  // Without the column, the last contact is asked once, for everyone.
  const bare = JSON.parse(JSON.stringify(inventory));
  for (const file of bare.files) delete file.columns_used.last_contact;
  for (const group of GROUPS) bare.groups[group].last_contact = null;
  const rounds = walk(legalTemplate({ inventory: bare, today: TODAY })).rounds.flat();
  assert.equal(rounds.filter((question) => question.key === "ultimo_contato").length, 1);
  assert.ok(!JSON.stringify(known).includes("exemplo.test"), "no person in what the file receives");
});

test("a file written by an older version gains the shared section and keeps every answer", () => {
  const inventory = inventoryOf();
  const old = legalTemplate({ inventory, today: TODAY }).replace(/## Todos os grupos[\s\S]*?(?=## Clientes)/, "").replace(/- Dados presentes \(([^\n]*)\): .*\n/g, "- Dados presentes ($1):\n").replace(/(## Clientes[\s\S]*?- Retenção \([^\n]*:)\n/, "$1 12 meses\n");
  assert.ok(!old.includes("## Todos os grupos"));
  const upgraded = upgradeLegal(old, inventory);
  assert.ok(upgraded.includes("## Todos os grupos"));
  assert.ok(upgraded.indexOf("## Todos os grupos") < upgraded.indexOf("## Clientes"));
  assert.equal(parseLegal(upgraded).clientes.fields.retencao, "12 meses");
  assert.ok(!parseLegal(upgraded).clientes.missing.includes("dados_presentes"));
  assert.equal(upgradeLegal(upgraded, inventory), upgraded, "running it twice changes nothing");
  assert.equal(parseLegal(old).clientes.fields.retencao, "12 meses", "the old format still reads");
});

test("asked about one group, the question names it and the answer goes on its line", () => {
  const inventory = inventoryOf();
  const parsed = parseLegal(legalTemplate({ inventory, today: TODAY }));
  const questions = legalQuestions(parsed, "testaram");
  assert.equal(questions[0].key, "como_entrou");
  assert.match(questions[0].question, /^Testaram \(usaram sem pagar\): como entrou/);
  assert.equal(questions[0].write_to, "Testaram (usaram sem pagar)");
});

// ---------------------------------------------------------------- as the member's AI runs it

function run(root, args) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [SCRIPT, ...args, "--json"], { cwd: root, env: { ...process.env }, windowsHide: true });
    let stdout = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.on("error", fail);
    child.on("close", (status) => {
      try {
        done({ status, json: JSON.parse(stdout) });
      } catch {
        fail(new Error(`no JSON from ${args.join(" ")}: ${stdout}`));
      }
    });
  });
}

test("legal hands out the rounds, skips a group with nobody in it, and the check agrees", async () => {
  const root = mkdtempSync(join(tmpdir(), "cb-rounds-"));
  mkdirSync(join(root, "contatos", "entrada"), { recursive: true });
  // Only paying customers: the other three groups have nobody to write to.
  writeFileSync(join(root, "contatos", "entrada", "so-clientes.csv"), "E-mail,Status,Último contato\nana@exemplo.test,ativo,2026-10-01\nbia@exemplo.test,ativo,2026-09-15\n");
  cpSync(join(FIXTURES, "contatos-sinteticos.csv"), join(root, "contatos", "entrada", "base.csv"));
  const inventory = await run(root, ["inventory", "contatos/entrada/so-clientes.csv", "--today=2026-10-23"]);
  assert.equal(inventory.status, 0, JSON.stringify(inventory.json));
  const first = await run(root, ["legal", "--today=2026-10-23"]);
  assert.equal(first.status, 0, JSON.stringify(first.json));
  const used = Object.entries(inventory.json.groups).filter(([, counts]) => counts.total > 0).map(([group]) => group);
  assert.deepEqual(first.json.pending, used, "a group with nobody in it asks nothing");
  assert.ok(first.json.questions.length <= 4);
  assert.ok(first.json.questions.every((question) => question.write_to));
  assert.match(first.json.next_step.say, /um sim aceit/);
  assert.match(first.json.next_step.say, /questionario/);
  assert.ok(!JSON.stringify(first.json).includes("exemplo.test"), "no person in the answer");
  const text = readFileSync(join(root, "contatos", "base-legal.md"), "utf8");
  assert.ok(text.includes("## Todos os grupos"));
  assert.ok(!/[–—!]/.test(text));
  rmSync(root, { recursive: true, force: true });
});
