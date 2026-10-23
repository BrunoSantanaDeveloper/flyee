// 1.1.0 as the member's AI runs it: the WhatsApp sequence beside the e-mail one, the hashed
// audience from the clean base, the voice and support files, and the deliverability usage check.
// DNS is not touched here; the check itself is tested with a fake resolver in unit-110.

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
const HEX = /^[0-9a-f]{64}$/;

function project() {
  const root = mkdtempSync(join(tmpdir(), "cb-110-"));
  mkdirSync(join(root, "contatos", "entrada"), { recursive: true });
  for (const file of ["contatos-sinteticos.csv", "contatos-en.csv"]) cpSync(join(FIXTURES, file), join(root, "contatos", "entrada", file));
  mkdirSync(join(root, "media-plan", "black-friday-2026"), { recursive: true });
  cpSync(join(FIXTURES, "plano-aprovado.json"), join(root, "media-plan", "black-friday-2026", "plano.json"));
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

function fillLegal(root, acceptedText = "Quero receber novidades por e-mail") {
  const fill = { "Como entrou": "pelo cadastro no site", "Texto aceito": acceptedText, "Dados presentes": "e-mail, telefone, nome, datas de uso", "Último contato e descadastros": "fevereiro de 2026; 1 pediu para sair", "Onde está guardada": "na planilha do projeto", "Base legal": "legitimo-interesse", "Teto de contatos": "até 3 por semana", "Retenção": "12 meses sem resposta e sai" };
  const text = readAt(root, "base-legal.md")
    .split("\n")
    .map((line) => {
      for (const [label, value] of Object.entries(fill)) if (line.startsWith(`- ${label} (`)) return `${line.replace(/\):.*$/, "):")} ${value}`;
      return line;
    })
    .join("\n");
  writeFileSync(join(root, "contatos", "base-legal.md"), text);
}

async function prepared(acceptedText) {
  const root = project();
  const inventory = await run(root, ["inventory", "contatos/entrada/contatos-sinteticos.csv", "contatos/entrada/contatos-en.csv", TODAY]);
  assert.equal(inventory.status, 0, JSON.stringify(inventory.json));
  await run(root, ["legal", TODAY]);
  fillLegal(root, acceptedText);
  return root;
}

test("sequence --channel whatsapp writes the group's WhatsApp sequence beside the e-mail one, pending until the accepted text names WhatsApp", async () => {
  const root = await prepared();
  const email = await run(root, ["sequence", "testaram", TODAY]);
  assert.equal(email.status, 0, JSON.stringify(email.json));
  assert.equal(email.json.channel, "email");
  const pending = await run(root, ["sequence", "testaram", "--channel", "whatsapp", TODAY]);
  assert.equal(pending.status, 0, JSON.stringify(pending.json));
  assert.equal(pending.json.channel, "whatsapp");
  assert.equal(pending.json.state, "pendente");
  assert.match(pending.json.pending_why, /WhatsApp/);
  assert.equal(pending.json.next_step.action, "ask");
  const store = JSON.parse(readAt(root, "regua.json"));
  assert.ok(store.groups.testaram && store.groups["testaram@whatsapp"], "both channels kept");
  assert.equal(store.groups.testaram.channel, "email");
  assert.ok(store.groups["testaram@whatsapp"].steps.every((step) => step.approve_by && step.max_chars === 300));
  fillLegal(root, "Quero receber novidades por e-mail e WhatsApp");
  const ready = await run(root, ["sequence", "testaram", "--channel", "whatsapp", TODAY]);
  assert.equal(ready.json.state, "pronta");
  assert.equal(ready.json.next_step.action, "write");
  assert.match(ready.json.next_step.say, /API oficial/);
  const markdown = readAt(root, "regua.md");
  assert.match(markdown, /, por WhatsApp/);
  assert.match(markdown, /Modelo aprovado até/);
  assert.ok(!/[–—!]/.test(markdown));
  const bad = await run(root, ["sequence", "testaram", "--channel", "sms", TODAY]);
  assert.equal(bad.json.error.code, "usage");
  rmSync(root, { recursive: true, force: true });
});

test("audience writes hashes only, the exclusion list of customers, and says when a list is too small for Meta", async () => {
  const root = await prepared();
  const noSegment = await run(root, ["audience", "fantasmas", TODAY]);
  assert.equal(noSegment.json.error.code, "segment_unknown");
  const audience = await run(root, ["audience", "testaram", TODAY]);
  assert.equal(audience.status, 0, JSON.stringify(audience.json));
  assert.equal(audience.json.files.csv, null, "a handful of people never becomes an upload");
  assert.equal(audience.json.warnings[0].code, "too_small");
  assert.equal(audience.json.next_step.action, "owned");
  assert.ok(existsSync(join(root, audience.json.files.json)));
  assert.ok(existsSync(join(root, audience.json.files.markdown)));
  assert.ok(audience.json.files.exclusion, "the customers' exclusion list is written");
  const exclusion = readAt(root, join("publicos", "exclusao-clientes.csv")).trim().split("\n");
  assert.equal(exclusion[0], "email,phone,country");
  for (const line of exclusion.slice(1)) {
    const [email, phone, country] = line.split(",");
    assert.ok(email === "" || HEX.test(email), line);
    assert.ok(phone === "" || HEX.test(phone), line);
    assert.equal(country, "br");
  }
  assert.ok(!/exemplo\.test|Exemplo|99999/.test(JSON.stringify(audience.json)), "no person in the answer");
  assert.ok(!/exemplo\.test|Exemplo|99999/.test(readAt(root, join("publicos", "testaram.md"))), "no person in the document");
  const group = await run(root, ["audience", "clientes", TODAY]);
  assert.equal(group.status, 0);
  assert.equal(group.json.counts.exclusion_list, group.json.counts.people - group.json.counts.unsubscribed, "customers are their own exclusion list");
  rmSync(root, { recursive: true, force: true });
});

test("voice creates the questionnaire once and turns the answers into a declared reading of at least five; support carries the plan's peak", async () => {
  const root = project();
  const voice = await run(root, ["voice", TODAY]);
  assert.equal(voice.status, 0, JSON.stringify(voice.json));
  assert.equal(voice.json.created, true);
  assert.match(readAt(root, "voz-do-cliente.md"), /# A voz do cliente: Agenda Leve/);
  assert.equal((await run(root, ["voice", TODAY])).json.created, false);
  writeFileSync(join(root, "contatos", "voz-respostas.json"), JSON.stringify([{ who: "Mariana", text: "Perdia uma hora por dia remarcando." }, { who: "Paulo", text: "Achei que ia perder os dados." }]));
  const few = await run(root, ["voice", "--quotes", "contatos/voz-respostas.json", TODAY]);
  assert.equal(few.json.error.code, "quotes_few");
  writeFileSync(join(root, "contatos", "voz-respostas.json"), JSON.stringify(Array.from({ length: 6 }, (_, index) => ({ who: `Pessoa ${index}`, text: `Frase ${index} como foi dita.` }))));
  const reading = await run(root, ["voice", "--quotes", "contatos/voz-respostas.json", TODAY]);
  assert.equal(reading.status, 0, JSON.stringify(reading.json));
  assert.equal(reading.json.reading.items, 6);
  const file = JSON.parse(readAt(root, "voz-leitura.json"));
  assert.equal(file.kind, "declared");
  assert.equal(file.items[0].kind, "audience_comment");
  writeFileSync(join(root, "contatos", "errado.json"), JSON.stringify({ a: 1 }));
  assert.equal((await run(root, ["voice", "--quotes", "contatos/errado.json", TODAY])).json.error.code, "quotes_invalid");
  assert.equal((await run(root, ["voice", "--quotes", "../fora.json", TODAY])).json.error.code, "outside_project");

  const support = await run(root, ["support", TODAY]);
  assert.equal(support.status, 0, JSON.stringify(support.json));
  assert.equal(support.json.created, true);
  assert.ok(support.json.peak?.start, "the peak comes from the plan");
  const text = readAt(root, "atendimento.md");
  assert.match(text, /# O atendimento do pico: Agenda Leve/);
  assert.match(text, new RegExp(`de ${support.json.peak.start} a ${support.json.peak.end}`));
  assert.ok(!/[–—!]/.test(text));
  assert.equal((await run(root, ["support", TODAY])).json.created, false);
  rmSync(root, { recursive: true, force: true });
});

test("deliverability refuses a bad domain as usage, and help names the five new commands", async () => {
  const root = project();
  const bad = await run(root, ["deliverability", "nao e dominio", TODAY]);
  assert.equal(bad.json.error.code, "usage");
  const none = await run(root, ["deliverability", TODAY]);
  assert.equal(none.json.error.code, "usage");
  const help = await run(root, ["help"], { json: false });
  for (const word of ["deliverability <dominio>", "audience <grupo|segmento>", "voice [--quotes", "support", "--channel email|whatsapp"]) assert.ok(help.stdout.includes(word), word);
  rmSync(root, { recursive: true, force: true });
});
