// Base de contatos e CRM, the pure pieces: the inventory (columns, normalization, duplicates,
// groups, counts only), the legal basis file, the segments and the sequence with its dates and
// its re-permission rule.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildInventory, classify, cleanHeader, cleanLines, GROUPS, mapColumns, normalizePhone, parseDate, readClean, readExport } from "../scripts/lib/inventory.mjs";
import { legalQuestions, legalTemplate, parseLegal } from "../scripts/lib/legal.mjs";
import { inventorySay, renderSequences } from "../scripts/lib/report.mjs";
import { offerFor, segmentBase } from "../scripts/lib/segments.mjs";
import { anchorsFor, buildSequence, linkFor } from "../scripts/lib/sequence.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");
const read = (name) => readFileSync(join(HERE, "fixtures", name), "utf8");
const THRESHOLDS = JSON.parse(readFileSync(join(APP, "references", "limiares.json"), "utf8"));
const PLAN = { slug: "black-friday-2026", file: "media-plan/black-friday-2026/plano.json", data: JSON.parse(read("plano-aprovado.json")) };
const TODAY = "2026-10-23";

const exportsOf = () => [{ ...readExport(read("contatos-sinteticos.csv"), { file: "a.csv" }), file: "a.csv" }, { ...readExport(read("contatos-en.csv"), { file: "b.csv" }), file: "b.csv" }];
const inventoryOf = () => buildInventory(exportsOf(), { today: TODAY, thresholds: THRESHOLDS });

/** base-legal.md with every field of every group filled, as the AI writes it after asking. */
function filledLegal(inventory) {
  const fill = { "Como entrou": "pelo cadastro no site", "Texto aceito": "Quero receber novidades por e-mail", "Dados presentes": "e-mail, telefone, nome, datas de uso", "Último contato e descadastros": "fevereiro de 2026; 1 pediu para sair", "Onde está guardada": "na planilha do projeto", "Base legal": "legitimo-interesse", "Teto de contatos": "até 3 por semana", "Retenção": "12 meses sem resposta e sai" };
  return legalTemplate({ inventory, today: TODAY })
    .split("\n")
    .map((line) => {
      for (const [label, value] of Object.entries(fill)) if (line.startsWith(`- ${label} (`) && line.trim().endsWith(":")) return `${line} ${value}`;
      return line;
    })
    .join("\n");
}

// ---------------------------------------------------------------- inventory

test("phones get the country code and the area code; a number without the area code is refused with the reason; dates are read in three shapes", () => {
  assert.deepEqual(normalizePhone("11 99999-0001"), { value: "5511999990001", problem: null });
  assert.deepEqual(normalizePhone("+55 (21) 99999-0002"), { value: "5521999990002", problem: null });
  assert.deepEqual(normalizePhone("5531999990004"), { value: "5531999990004", problem: null });
  assert.deepEqual(normalizePhone("011 99999-0005"), { value: "5511999990005", problem: null });
  assert.deepEqual(normalizePhone("99999-0003"), { value: null, problem: "sem DDD" });
  assert.deepEqual(normalizePhone(""), { value: null, problem: null });
  assert.equal(parseDate("2026-02-10"), "2026-02-10");
  assert.equal(parseDate("10/02/2026"), "2026-02-10");
  assert.equal(parseDate("2026-02-10T12:00:00Z"), "2026-02-10");
  assert.equal(parseDate("ontem"), null);
});

test("columns are read by synonyms in Portuguese and English; a patient column refuses the file; documents are dropped", () => {
  const pt = mapColumns(["Nome", "E-mail", "Telefone", "Data de cadastro", "Último acesso", "CPF"]);
  assert.equal(pt.map.email, "E-mail");
  assert.equal(pt.map.last_active, "Último acesso");
  assert.deepEqual(pt.sensitive, ["CPF"]);
  const en = mapColumns(["Name", "Email address", "Mobile", "Created at", "Last login", "Plan"]);
  assert.equal(en.map.phone, "Mobile");
  assert.equal(en.map.status, "Plan");
  assert.throws(() => mapColumns(["Nome", "E-mail", "Paciente"]), (error) => error.code === "patient_data" && error.details.columns.includes("Paciente"));
  assert.throws(() => readExport(read("contatos-pacientes.csv")), { code: "patient_data" });
  assert.throws(() => readExport("Nome,Cidade\nAna,SP\n"), { code: "csv_invalid" });
  assert.throws(() => readExport(""), { code: "csv_invalid" });
});

test("the inventory removes duplicates by e-mail and phone, counts invalid e-mails and phones without area code, groups by payment and use, and carries no person", () => {
  const { clean, inventory, problems } = inventoryOf();
  assert.equal(inventory.counts.rows, 17);
  assert.equal(inventory.counts.total, 16, "Ana twice by e-mail and phone");
  assert.equal(inventory.counts.duplicates, 1);
  assert.equal(inventory.counts.invalid_emails, 2);
  assert.equal(inventory.counts.phones_without_area_code, 1);
  assert.equal(inventory.counts.unsubscribed, 2);
  assert.equal(inventory.counts.valid, 14);
  assert.deepEqual(inventory.groups.clientes, { total: 5, marketable: 5, stale: 2 });
  assert.deepEqual(inventory.groups["ex-clientes"], { total: 3, marketable: 2, stale: 2 });
  assert.equal(inventory.activity.ativos, 5);
  assert.equal(inventory.by_source.site, 9);
  assert.equal(inventory.created_between.first, "2024-12-01");
  const text = JSON.stringify(inventory);
  assert.ok(!/exemplo\.test|Exemplo|99999|000\.000/.test(text), "no name, e-mail, phone or document in the inventory");
  assert.equal(problems.length, 3);
  const ana = clean.find((contact) => contact.email === "ana@exemplo.test");
  assert.equal(ana.last_active, "2026-10-21", "the newer date of the duplicate wins");
  assert.equal(ana.group, "clientes");
  const bruno = clean.find((contact) => contact.email === "bruno@exemplo.test");
  assert.equal(bruno.stale, true, "last contact in February, 8 months ago");
  const say = inventorySay(inventory);
  assert.equal(say.length, 3);
  assert.match(say[0], /16 pessoa\(s\) depois de tirar 1 duplicada/);
  assert.ok(!/[–—!]/.test(say.join(" ")));
});

test("the clean base writes and reads back the same people and groups", () => {
  const { clean } = inventoryOf();
  const text = `${cleanHeader()}\n${cleanLines(clean).join("\n")}\n`;
  const back = readClean(text);
  assert.equal(back.length, clean.length);
  assert.equal(back[0].email, clean[0].email);
  assert.equal(back[0].group, clean[0].group);
  assert.equal(back.find((contact) => contact.email === "bruno@exemplo.test").stale, true);
  assert.equal(back.find((contact) => contact.email === "fabio@exemplo.test").unsubscribed, true);
  assert.throws(() => readClean("id,email\n1,a@b.test\n"), { code: "clean_invalid" });
});

test("classify: a paying contact is a customer, a canceled one a former customer, a user who never logged in never activated; six months without contact is stale", () => {
  const thresholds = THRESHOLDS;
  assert.equal(classify({ paid: true, last_active: "2026-10-20", last_contact: "2026-10-01" }, { today: TODAY, thresholds }).group, "clientes");
  assert.equal(classify({ paid: false, canceled: "2026-03-02", orders: 2, last_active: "2026-03-02" }, { today: TODAY, thresholds }).group, "ex-clientes");
  assert.equal(classify({ paid: null, last_active: "2026-07-10", orders: 0 }, { today: TODAY, thresholds }).group, "testaram");
  assert.equal(classify({ paid: null, last_active: null, orders: 0 }, { today: TODAY, thresholds }).group, "nunca-ativaram");
  const stale = classify({ paid: true, last_active: "2026-10-01", last_contact: "2026-04-01" }, { today: TODAY, thresholds });
  assert.equal(stale.stale, true);
  assert.equal(stale.activity, "ativos");
  assert.equal(classify({ last_active: "2026-01-01" }, { today: TODAY, thresholds }).activity, "inativos");
});

// ---------------------------------------------------------------- legal

test("the legal file starts with every field empty and pending; filled, every group is complete and marketing is allowed", () => {
  const { inventory } = inventoryOf();
  const template = legalTemplate({ inventory, today: TODAY });
  assert.ok(!/[–—!]/.test(template));
  const empty = parseLegal(template);
  for (const group of GROUPS) {
    assert.equal(empty[group].status, "pendente");
    assert.equal(empty[group].missing.length, 8);
    assert.equal(empty[group].marketing_allowed, false);
  }
  const questions = legalQuestions(empty, "testaram");
  assert.equal(questions.length, 4);
  assert.equal(questions[0].key, "base_legal");
  assert.equal(questions[0].suggestion, "legitimo-interesse");
  const full = parseLegal(filledLegal(inventory));
  for (const group of GROUPS) {
    assert.equal(full[group].status, "completo", `${group}: ${full[group].missing.join(",")}`);
    assert.equal(full[group].basis, "legitimo-interesse");
    assert.equal(full[group].marketing_allowed, true);
  }
  const contract = filledLegal(inventory).replace("- Base legal (consentimento, legítimo interesse (cliente ou quem testou, com a expectativa de receber) ou execução de contrato (só o transacional). Sugestão: legitimo-interesse.): legitimo-interesse", "- Base legal (consentimento, legítimo interesse (cliente ou quem testou, com a expectativa de receber) ou execução de contrato (só o transacional). Sugestão: legitimo-interesse.): execucao-de-contrato");
  const parsed = parseLegal(contract);
  assert.equal(parsed.clientes.basis, "execucao-de-contrato");
  assert.equal(parsed.clientes.marketing_allowed, false, "a contract basis carries only transactional messages");
});

// ---------------------------------------------------------------- segments

test("segments count by use and purchases, never by opens, and the ladder keeps customers from paying more than newcomers", () => {
  const { clean } = inventoryOf();
  const { summary, members } = segmentBase(clean, { today: TODAY, thresholds: THRESHOLDS, plan: PLAN.data });
  assert.equal(summary.people, 14);
  assert.equal(summary.counts["engajados-30"], 5);
  assert.equal(summary.counts["sem-contato-6-meses"], 10);
  assert.equal(summary.counts.recorrentes, 4);
  assert.equal(summary.counts.vip, 1);
  assert.equal(summary.vip_cut_brl, 1788);
  assert.equal(summary.rfm.scored, 14);
  assert.equal(summary.caps.min_hours_between_marketing, 16);
  assert.equal(members.vip.length, 1);
  assert.ok(summary.priority.some((line) => /Transacional/.test(line)));
  assert.match(summary.ladder.clientes.offer.label, /Acesso antecipado/);
  assert.match(summary.ladder.testaram.offer.label, /^Anual pelo preço de 10 meses/);
  assert.equal(offerFor("clientes", null), null);
  assert.ok(!/exemplo\.test/.test(JSON.stringify(summary)), "no person in segmentos.json");
  assert.ok(!/[–—!]/.test(summary.say));
});

// ---------------------------------------------------------------- sequence

test("anchors come from the plan's phases, else from a target date; without either the sequence has nowhere to hang", () => {
  const fromPlan = anchorsFor({ plan: PLAN, today: TODAY });
  assert.deepEqual(fromPlan.aquecimento, { start: "2026-11-20", end: "2026-11-26" });
  assert.deepEqual(fromPlan.pico, { start: "2026-11-27", end: "2026-11-30" });
  assert.equal(fromPlan.source, "plano");
  const fromTarget = anchorsFor({ plan: null, target: "2026-12-15", today: TODAY });
  assert.deepEqual(fromTarget.aquecimento, { start: "2026-12-08", end: "2026-12-14" });
  assert.deepEqual(fromTarget.pico, { start: "2026-12-15", end: "2026-12-18" });
  assert.throws(() => anchorsFor({ plan: null, today: TODAY }), { code: "target_missing" });
  assert.throws(() => anchorsFor({ plan: null, target: "15/12/2026", today: TODAY }), { code: "usage" });
});

test("a stale group starts with the re-permission, twice, and refuses any other first message; the dates fall inside the plan's phases", () => {
  const { inventory } = inventoryOf();
  const legal = parseLegal(filledLegal(inventory));
  const anchors = anchorsFor({ plan: PLAN, today: TODAY });
  const sequence = buildSequence("ex-clientes", { anchors, legal: legal["ex-clientes"], counts: inventory.groups["ex-clientes"], thresholds: THRESHOLDS, plan: PLAN.data, brand: "Agenda Leve", page: "https://exemplo.test/oferta", today: TODAY });
  assert.equal(sequence.state, "pronta");
  assert.equal(sequence.steps[0].id, "repermissao");
  assert.equal(sequence.steps[1].id, "repermissao-2");
  assert.equal(sequence.steps[1].date, "2026-11-09", "five days after the first");
  assert.ok(sequence.steps.every((step) => step.subject.length <= 45), sequence.steps.map((step) => step.subject).join(" | "));
  const early = sequence.steps.find((step) => step.id === "acesso-antecipado");
  assert.equal(early.date, anchors.aquecimento.start);
  assert.equal(sequence.steps.find((step) => step.id === "abertura").date, anchors.pico.start);
  assert.equal(sequence.steps.find((step) => step.id === "ultimo-dia").date, anchors.pico.end);
  for (const step of sequence.steps.filter((item) => !item.id.startsWith("repermissao"))) assert.ok(step.date >= "2026-11-10" && step.date <= anchors.pico.end, `${step.id} ${step.date}`);
  assert.match(early.link, /^https:\/\/exemplo\.test\/oferta\?utm_source=email&utm_medium=email&utm_campaign=black-friday-2026&utm_content=acesso-antecipado&utm_term=ex-clientes$/);
  assert.throws(() => buildSequence("ex-clientes", { anchors, legal: legal["ex-clientes"], counts: inventory.groups["ex-clientes"], thresholds: THRESHOLDS, today: TODAY, first: "novidade" }), (error) => error.code === "repermission_required" && error.details.stale === 2);
  assert.ok(!/[–—!]/.test(renderSequences({ groups: { "ex-clientes": sequence } }, { brand: "Agenda Leve" })));
});

test("a group without a legal basis gets a pending sequence; a group nobody is stale in skips the re-permission; the invitation goes only to the groups that need it", () => {
  const { inventory } = inventoryOf();
  const anchors = anchorsFor({ plan: PLAN, today: TODAY });
  const pending = buildSequence("clientes", { anchors, legal: null, counts: inventory.groups.clientes, thresholds: THRESHOLDS, today: TODAY });
  assert.equal(pending.state, "pendente");
  assert.match(pending.pending_why, /campos vazios/);
  const fresh = buildSequence("clientes", { anchors, legal: parseLegal(filledLegal(inventory)).clientes, counts: { total: 5, marketable: 5, stale: 0 }, thresholds: THRESHOLDS, today: TODAY });
  assert.equal(fresh.state, "pronta");
  assert.ok(!fresh.steps.some((step) => step.id.startsWith("repermissao")));
  assert.ok(!fresh.steps.some((step) => step.id === "convite-teste"), "customers are not invited to try");
  const never = buildSequence("nunca-ativaram", { anchors, legal: null, counts: { total: 3, marketable: 2, stale: 0 }, thresholds: THRESHOLDS, today: TODAY });
  assert.ok(never.steps.some((step) => step.id === "convite-teste"));
  assert.equal(never.steps.find((step) => step.id === "convite-teste").subject, "Vale testar: o primeiro passo decidido");
});

test("a sequence anchored on a date already close compresses: past dates enter today with a warning, and two messages never share a day", () => {
  const anchors = anchorsFor({ plan: null, target: "2026-10-30", today: TODAY });
  const sequence = buildSequence("testaram", { anchors, legal: null, counts: { total: 5, marketable: 5, stale: 4 }, thresholds: THRESHOLDS, today: TODAY });
  assert.ok(sequence.warnings.some((warning) => warning.code === "past_date"));
  const dates = sequence.steps.map((step) => step.date);
  assert.equal(new Set(dates).size, dates.length, "one message per day at most");
  assert.ok(dates.every((date) => date >= TODAY));
  assert.equal(sequence.steps[sequence.steps.length - 1].id, "ultimo-dia");
  assert.equal(sequence.steps[sequence.steps.length - 1].date, "2026-11-02");
  assert.deepEqual(linkFor({ page: null, rule: undefined, campaign: "Black Friday 2026", step: "lista", group: "testaram" }), { query: "utm_source=email&utm_medium=email&utm_campaign=black-friday-2026&utm_content=lista&utm_term=testaram", url: null });
});
