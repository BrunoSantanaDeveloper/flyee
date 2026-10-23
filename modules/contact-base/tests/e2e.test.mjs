// The script as the member's AI runs it, from the root of a project: the inventory from the
// synthetic exports, the legal file, the segments and the sequences, with the stable error codes,
// and never a person's data in a file another app reads.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");
const SCRIPT = resolve(HERE, "..", "scripts", "contacts.mjs");
const TODAY = "--today=2026-10-23";

function project({ plan = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "cb-projeto-"));
  mkdirSync(join(root, "contatos", "entrada"), { recursive: true });
  for (const file of ["contatos-sinteticos.csv", "contatos-en.csv", "contatos-pacientes.csv"]) cpSync(join(FIXTURES, file), join(root, "contatos", "entrada", file));
  if (plan) {
    mkdirSync(join(root, "media-plan", "black-friday-2026"), { recursive: true });
    cpSync(join(FIXTURES, "plano-aprovado.json"), join(root, "media-plan", "black-friday-2026", "plano.json"));
  }
  return root;
}

function run(root, args, { json = true } = {}) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [SCRIPT, ...args, ...(json ? ["--json"] : [])], { cwd: root, env: { ...process.env }, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", fail);
    child.on("close", (status) => {
      if (!json) return done({ status, stdout, stderr });
      try {
        done({ status, json: JSON.parse(stdout), stderr });
      } catch {
        fail(new Error(`no JSON from ${args.join(" ")}: ${stdout} ${stderr}`));
      }
    });
  });
}

const readAt = (root, file) => readFileSync(join(root, "contatos", file), "utf8");

/** Fills every field of base-legal.md as the AI does after asking the member. */
function fillLegal(root, basis = "legitimo-interesse") {
  const fill = { "Como entrou": "pelo cadastro no site", "Texto aceito": "Quero receber novidades por e-mail", "Dados presentes": "e-mail, telefone, nome, datas de uso", "Último contato e descadastros": "fevereiro de 2026; 1 pediu para sair", "Onde está guardada": "na planilha do projeto", "Base legal": basis, "Teto de contatos": "até 3 por semana", "Retenção": "12 meses sem resposta e sai" };
  const text = readAt(root, "base-legal.md")
    .split("\n")
    .map((line) => {
      for (const [label, value] of Object.entries(fill)) if (line.startsWith(`- ${label} (`) && line.trim().endsWith(":")) return `${line} ${value}`;
      return line;
    })
    .join("\n");
  writeFileSync(join(root, "contatos", "base-legal.md"), text);
}

test("check on a fresh project points to the inventory; help prints the commands; an unknown command is usage", async () => {
  const root = project();
  const check = await run(root, ["check", TODAY]);
  assert.equal(check.status, 0, JSON.stringify(check.json));
  assert.equal(check.json.inventory, null);
  assert.equal(check.json.plan.plan, "black-friday-2026");
  assert.equal(check.json.next_step.action, "inventory");
  const help = await run(root, ["help"], { json: false });
  assert.match(help.stdout, /sequence <grupo>/);
  assert.equal((await run(root, ["dance"])).json.error.code, "usage");
  rmSync(root, { recursive: true, force: true });
});

test("inventory reads two exports in two languages, refuses a patient list, counts right and keeps every person out of inventario.json", async () => {
  const root = project();
  const refused = await run(root, ["inventory", "contatos/entrada/contatos-pacientes.csv", TODAY]);
  assert.equal(refused.status, 1);
  assert.equal(refused.json.error.code, "patient_data");
  assert.deepEqual(refused.json.error.details.columns, ["Paciente", "Diagnóstico"]);
  const outside = await run(root, ["inventory", "../fora.csv", TODAY]);
  assert.equal(outside.json.error.code, "outside_project");
  const inventory = await run(root, ["inventory", "contatos/entrada/contatos-sinteticos.csv", "contatos/entrada/contatos-en.csv", TODAY]);
  assert.equal(inventory.status, 0, JSON.stringify(inventory.json));
  assert.equal(inventory.json.counts.rows, 17);
  assert.equal(inventory.json.counts.total, 16);
  assert.equal(inventory.json.counts.duplicates, 1);
  assert.equal(inventory.json.counts.invalid_emails, 2);
  assert.equal(inventory.json.counts.phones_without_area_code, 1);
  assert.equal(inventory.json.counts.valid, 14);
  assert.equal(inventory.json.groups.clientes.total, 5);
  assert.deepEqual(inventory.json.columns[0].sensitive_dropped, ["CPF"]);
  assert.equal(inventory.json.say.length, 3);
  assert.match(inventory.json.next_step.say, /CPF ficaram de fora/);
  const file = readAt(root, "inventario.json");
  assert.ok(!/exemplo\.test|Exemplo|99999/.test(file), "no person in the inventory file");
  assert.ok(!/exemplo\.test|Exemplo|99999/.test(JSON.stringify(inventory.json)), "no person in the answer");
  const clean = readAt(root, "base-limpa.csv");
  assert.match(clean, /ana@exemplo\.test,5511999990001/);
  assert.equal(clean.trim().split("\n").length, 17, "header plus 16 people");
  assert.ok(!/000\.000\.000/.test(clean), "the document column is not in the clean base");
  const noInventory = project();
  const missing = await run(noInventory, ["segments", TODAY]);
  assert.equal(missing.json.error.code, "inventory_missing");
  rmSync(root, { recursive: true, force: true });
  rmSync(noInventory, { recursive: true, force: true });
});

test("legal creates the file, asks at most four questions with suggestions, and reads the groups back as complete once filled", async () => {
  const root = project();
  await run(root, ["inventory", "contatos/entrada/contatos-sinteticos.csv", TODAY]);
  const first = await run(root, ["legal", TODAY]);
  assert.equal(first.status, 0, JSON.stringify(first.json));
  assert.equal(first.json.created, true);
  assert.equal(first.json.pending.length, 4);
  assert.ok(first.json.questions.length <= 4);
  assert.equal(first.json.questions[0].key, "base_legal");
  assert.equal(first.json.questions[0].suggestion, "legitimo-interesse");
  assert.equal(first.json.next_step.action, "ask");
  assert.ok(existsSync(join(root, "contatos", "base-legal.md")));
  const one = await run(root, ["legal", "--group", "clientes", TODAY]);
  assert.deepEqual(Object.keys(one.json.groups), ["clientes"]);
  const unknown = await run(root, ["legal", "--group", "vips", TODAY]);
  assert.equal(unknown.json.error.code, "group_unknown");
  fillLegal(root);
  const second = await run(root, ["legal", TODAY]);
  assert.deepEqual(second.json.pending, []);
  assert.equal(second.json.groups.testaram.status, "completo");
  assert.equal(second.json.groups.testaram.marketing_allowed, true);
  assert.equal(second.json.next_step.action, "segments");
  rmSync(root, { recursive: true, force: true });
});

test("segments writes only counts and rules; sequence writes the group's sequence anchored on the plan, pending until the legal basis is complete", async () => {
  const root = project();
  await run(root, ["inventory", "contatos/entrada/contatos-sinteticos.csv", "contatos/entrada/contatos-en.csv", TODAY]);
  const segments = await run(root, ["segments", TODAY]);
  assert.equal(segments.status, 0, JSON.stringify(segments.json));
  assert.equal(segments.json.people, 14);
  assert.equal(segments.json.counts["sem-contato-6-meses"], 10);
  assert.ok(!/exemplo\.test/.test(readAt(root, "segmentos.json")));

  const pending = await run(root, ["sequence", "ex-clientes", TODAY]);
  assert.equal(pending.status, 0, JSON.stringify(pending.json));
  assert.equal(pending.json.state, "pendente");
  assert.equal(pending.json.steps[0].id, "repermissao");
  assert.equal(pending.json.anchors.source, "plano");
  assert.equal(pending.json.next_step.action, "ask");
  assert.ok(pending.json.questions.length > 0);
  assert.ok(existsSync(join(root, "contatos", "regua.md")));
  const refused = await run(root, ["sequence", "ex-clientes", "--first", "novidade", TODAY]);
  assert.equal(refused.status, 1);
  assert.equal(refused.json.error.code, "repermission_required");
  const unknown = await run(root, ["sequence", "vips", TODAY]);
  assert.equal(unknown.json.error.code, "group_unknown");

  fillLegal(root);
  const ready = await run(root, ["sequence", "clientes", TODAY]);
  assert.equal(ready.json.state, "pronta", JSON.stringify(ready.json.pending_why));
  assert.equal(ready.json.next_step.action, "write");
  const early = ready.json.steps.find((step) => step.id === "acesso-antecipado");
  assert.equal(early.date, "2026-11-20");
  assert.equal(ready.json.steps.find((step) => step.id === "ultimo-dia").date, "2026-11-30");
  assert.match(early.link, /utm_source=email&utm_medium=email&utm_campaign=black-friday-2026&utm_content=acesso-antecipado&utm_term=clientes/);
  const store = JSON.parse(readAt(root, "regua.json"));
  assert.deepEqual(Object.keys(store.groups).sort(), ["clientes", "ex-clientes"]);
  assert.equal(store.groups["ex-clientes"].state, "pendente", "the earlier group keeps its own state until rerun");
  const markdown = readAt(root, "regua.md");
  assert.match(markdown, /## Clientes \(pagam hoje\)/);
  assert.match(markdown, /Estado: \*\*pronta\*\*/);
  assert.ok(!/[–—!]/.test(markdown));
  assert.ok(!/exemplo\.test/.test(markdown));
  const check = await run(root, ["check", TODAY]);
  assert.equal(check.json.sequences.clientes, "pronta");
  assert.equal(check.json.next_step.action, "sequence");
  rmSync(root, { recursive: true, force: true });
});

test("without a plan the sequence needs a target date and anchors on it", async () => {
  const root = project({ plan: false });
  await run(root, ["inventory", "contatos/entrada/contatos-sinteticos.csv", TODAY]);
  const missing = await run(root, ["sequence", "testaram", TODAY]);
  assert.equal(missing.json.error.code, "target_missing");
  const anchored = await run(root, ["sequence", "testaram", "--target", "2026-12-15", TODAY]);
  assert.equal(anchored.status, 0, JSON.stringify(anchored.json));
  assert.equal(anchored.json.anchors.source, "data-alvo");
  assert.deepEqual(anchored.json.anchors.pico, { start: "2026-12-15", end: "2026-12-18" });
  assert.ok(anchored.json.steps.some((step) => step.id === "convite-teste"));
  assert.match(anchored.json.steps[0].link, /^\[página\]\?utm_source=email/);
  rmSync(root, { recursive: true, force: true });
});
