// 1.1.0, the pure pieces: the deliverability check with a fake resolver, the hashed audience, the
// WhatsApp sequence, the voice reading and the support template.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { audienceCsv, buildAudience, hashEmail, hashPhone, META_MIN_AUDIENCE, uploadSteps } from "../scripts/lib/audience.mjs";
import { batchPlan, checkDomain, txtOf } from "../scripts/lib/deliverability.mjs";
import { buildInventory, readExport } from "../scripts/lib/inventory.mjs";
import { legalTemplate, parseLegal } from "../scripts/lib/legal.mjs";
import { renderAudience, renderDeliverability, renderSequences } from "../scripts/lib/report.mjs";
import { anchorsFor, buildSequence, CHANNELS, linkFor } from "../scripts/lib/sequence.mjs";
import { supportTemplate, voiceReading, voiceTemplate } from "../scripts/lib/support.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");
const read = (name) => readFileSync(join(HERE, "fixtures", name), "utf8");
const THRESHOLDS = JSON.parse(readFileSync(join(APP, "references", "limiares.json"), "utf8"));
const PLAN = { slug: "black-friday-2026", file: "media-plan/black-friday-2026/plano.json", data: JSON.parse(read("plano-aprovado.json")) };
const TODAY = "2026-10-23";
const HEX = /^[0-9a-f]{64}$/;

function legalWith(acceptedText) {
  const inventory = buildInventory([{ ...readExport(read("contatos-sinteticos.csv"), { file: "a.csv" }), file: "a.csv" }], { today: TODAY, thresholds: THRESHOLDS }).inventory;
  const fill = { "Como entrou": "pelo cadastro no site", "Texto aceito": acceptedText, "Dados presentes": "e-mail, telefone, nome, datas de uso", "Último contato e descadastros": "fevereiro de 2026; 1 pediu para sair", "Onde está guardada": "na planilha do projeto", "Base legal": "legitimo-interesse", "Teto de contatos": "até 3 por semana", "Retenção": "12 meses sem resposta e sai" };
  const text = legalTemplate({ inventory, today: TODAY })
    .split("\n")
    .map((line) => {
      for (const [label, value] of Object.entries(fill)) if (line.startsWith(`- ${label} (`) && line.trim().endsWith(":")) return `${line} ${value}`;
      return line;
    })
    .join("\n");
  return { parsed: parseLegal(text), inventory };
}

/** A DNS resolver that answers from a table; a name not in it is NXDOMAIN, "boom" fails. */
function fakeResolver(table) {
  return {
    async resolveTxt(name) {
      if (name === "boom.test" || name.endsWith(".boom.test")) throw Object.assign(new Error("timeout"), { code: "ETIMEOUT" });
      if (!(name in table)) throw Object.assign(new Error("not found"), { code: "ENOTFOUND" });
      return table[name].map((record) => [record]);
    },
  };
}

// ---------------------------------------------------------------- deliverability

test("deliverability: SPF, DMARC and DKIM are read from DNS, each with a state and a fix; missing blocks, a DNS failure is unknown, never green by assumption", async () => {
  const full = fakeResolver({
    "marca.test": ["v=spf1 include:_spf.ferramenta.test ~all", "google-site-verification=abc"],
    "_dmarc.marca.test": ["v=DMARC1; p=quarantine; rua=mailto:dmarc@marca.test"],
    "k1._domainkey.marca.test": ["v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ"],
  });
  const ok = await checkDomain("https://marca.test/pagina", { dkimSelector: "k1", resolver: full });
  assert.equal(ok.domain, "marca.test");
  const by = Object.fromEntries(ok.items.map((item) => [item.id, item]));
  assert.equal(by.spf.status, "ok");
  assert.deepEqual(by.spf.evidence.includes, ["_spf.ferramenta.test"]);
  assert.equal(by.dmarc.status, "ok");
  assert.equal(by.dmarc.evidence.policy, "quarantine");
  assert.equal(by.dkim.status, "ok");
  assert.equal(by.unsubscribe_one_click.status, "unknown");
  assert.equal(ok.overall, "ok");
  assert.match(ok.say, /sem falta no DNS/);
  assert.equal(ok.batches.steps.length, 4);

  const bare = await checkDomain("nova.test", { resolver: fakeResolver({ "nova.test": ["v=spf1 include:x.test"] }) });
  const bareBy = Object.fromEntries(bare.items.map((item) => [item.id, item]));
  assert.equal(bareBy.spf.status, "attention");
  assert.equal(bareBy.dmarc.status, "missing");
  assert.match(bareBy.dmarc.fix, /_dmarc\.nova\.test/);
  assert.equal(bareBy.dkim.status, "unknown", "no selector, no DKIM lookup");
  assert.equal(bare.overall, "bloqueado");
  assert.match(bare.say, /DMARC/);

  const two = await checkDomain("dupla.test", { dkimSelector: "s1", resolver: fakeResolver({ "dupla.test": ["v=spf1 ~all", "v=spf1 -all"], "_dmarc.dupla.test": ["v=DMARC1; p=none"], "s1._domainkey.dupla.test": ["v=DKIM1; p="] }) });
  const twoBy = Object.fromEntries(two.items.map((item) => [item.id, item]));
  assert.equal(twoBy.spf.status, "attention");
  assert.match(twoBy.spf.text, /2 registros/);
  assert.equal(twoBy.dmarc.status, "ok");
  assert.equal(twoBy.dkim.status, "attention", "an empty key is a revoked key");

  const down = await checkDomain("boom.test", { dkimSelector: "k1", resolver: fakeResolver({}) });
  assert.ok(down.items.filter((item) => ["spf", "dmarc", "dkim"].includes(item.id)).every((item) => item.status === "unknown"));
  assert.equal(down.overall, "ok", "unknown is not a blocker, and the next step says to retry");
  assert.deepEqual(await txtOf("missing.test", fakeResolver({})), []);
  assert.equal(await txtOf("boom.test", fakeResolver({})), null);

  const markdown = renderDeliverability(bare, { today: TODAY });
  assert.match(markdown, /\| dmarc \| falta \|/);
  assert.match(markdown, /Dia 1: os engajados/);
  assert.ok(!/[–—!]/.test(markdown));
  assert.match(batchPlan().stop_when, /0,1%/);
});

// ---------------------------------------------------------------- audience

test("audience: only hashes leave, unsubscribed and no-basis people stay out, the exclusion list holds the customers, and a small list is told so", () => {
  const { parsed } = legalWith("Quero receber novidades por e-mail");
  const people = Array.from({ length: 130 }, (_, index) => ({ id: index + 1, email: index % 10 === 0 ? null : `pessoa${index}@exemplo.test`, phone: index % 7 === 0 ? null : `55119999${String(index).padStart(5, "0")}`, group: index % 4 === 0 ? "nunca-ativaram" : "testaram", unsubscribed: index % 13 === 0 }));
  const customers = [{ id: 900, email: "cliente@exemplo.test", phone: "5511999990001", group: "clientes" }, { id: 901, email: null, phone: null, group: "clientes" }];
  const audience = buildAudience(people, { legal: parsed, customers, today: TODAY });
  assert.equal(audience.counts.people, 130);
  assert.equal(audience.counts.unsubscribed, people.filter((person) => person.unsubscribed).length);
  assert.equal(audience.counts.no_legal_basis, 0, "every group has a marketing basis here");
  assert.ok(audience.counts.no_reach >= 1);
  assert.equal(audience.counts.included + audience.counts.unsubscribed + audience.counts.no_reach, 130);
  for (const row of audience.rows) {
    assert.ok(row.email === "" || HEX.test(row.email), "email is a hash or empty");
    assert.ok(row.phone === "" || HEX.test(row.phone), "phone is a hash or empty");
    assert.equal(row.country, "br");
  }
  assert.equal(audience.exclusion.length, 1, "a customer with no reach is not on the list");
  assert.equal(audience.exclusion[0].email, hashEmail("Cliente@exemplo.test "), "e-mail hash is case and space insensitive");
  assert.equal(hashPhone("+55 (11) 99999-0001"), hashPhone("5511999990001"));
  assert.ok(audience.rows.length >= META_MIN_AUDIENCE.upload);
  assert.equal(audience.warnings[0]?.code, "small");
  const csv = audienceCsv(audience.rows);
  assert.match(csv.split("\n")[0], /^email,phone,country$/);
  assert.ok(!/@|exemplo/.test(csv), "nothing readable in the CSV");

  const noBasis = buildAudience(people.slice(0, 20), { legal: { testaram: { marketing_allowed: false }, "nunca-ativaram": null }, customers: [], today: TODAY });
  assert.equal(noBasis.counts.included, 0);
  assert.equal(noBasis.counts.no_legal_basis, 20 - people.slice(0, 20).filter((person) => person.unsubscribed).length);
  assert.equal(noBasis.warnings[0].code, "too_small");

  const steps = uploadSteps({ name: "Agenda Leve: testaram", file: "contatos/publicos/testaram.csv", exclusionFile: "contatos/publicos/exclusao-clientes.csv" });
  assert.equal(steps.length, 5);
  assert.match(steps[1], /hash/);
  const markdown = renderAudience(audience, { segment: "testaram", steps });
  assert.match(markdown, /\| Entram no público \| \d+ \|/);
  assert.ok(!/[–—!]/.test(markdown));
});

// ---------------------------------------------------------------- whatsapp

test("sequence by WhatsApp: four touches, templates approved two days before, the re-permission one to one, the link says the channel, and pending without a WhatsApp opt-in", () => {
  const anchors = anchorsFor({ plan: PLAN, today: TODAY });
  const emailOnly = legalWith("Quero receber novidades por e-mail");
  const counts = emailOnly.inventory.groups.testaram;
  assert.deepEqual(CHANNELS, ["email", "whatsapp"]);
  const pending = buildSequence("testaram", { anchors, legal: emailOnly.parsed.testaram, counts, thresholds: THRESHOLDS, plan: PLAN.data, brand: "Agenda Leve", page: "https://agendaleve.test/oferta", campaign: "black-friday-2026", today: TODAY, channel: "whatsapp" });
  assert.equal(pending.channel, "whatsapp");
  assert.equal(pending.state, "pendente");
  assert.match(pending.pending_why, /aceitar e-mail não é aceitar WhatsApp/);
  assert.deepEqual(pending.steps.map((step) => step.id), counts.stale > 0 ? ["repermissao", "acesso-antecipado", "abertura", "ultimo-dia"] : ["acesso-antecipado", "abertura", "ultimo-dia"]);
  assert.ok(pending.steps.every((step) => step.template_category === "marketing" && step.max_chars === 300 && step.approve_by < step.date));
  assert.ok(pending.steps.every((step) => /utm_source=whatsapp/.test(step.link) && /utm_medium=message/.test(step.link)));
  if (counts.stale > 0) {
    assert.match(pending.steps[0].audience, /um a um/);
    assert.ok(!pending.steps.some((step) => step.id === "repermissao-2"), "no second re-permission on WhatsApp");
  }
  assert.match(pending.rules.api_only, /API oficial/);
  assert.match(pending.rules.exit, /SAIR/);

  const both = legalWith("Quero receber novidades por e-mail e WhatsApp");
  const ready = buildSequence("testaram", { anchors, legal: both.parsed.testaram, counts, thresholds: THRESHOLDS, plan: PLAN.data, today: TODAY, channel: "whatsapp" });
  assert.equal(ready.state, "pronta");
  assert.match(ready.say, /de WhatsApp/);

  const email = buildSequence("testaram", { anchors, legal: both.parsed.testaram, counts, thresholds: THRESHOLDS, plan: PLAN.data, today: TODAY });
  assert.equal(email.channel, "email");
  assert.ok(email.steps.length > ready.steps.length, "the e-mail sequence is the long one");
  assert.ok(email.steps.every((step) => step.template_category === undefined));
  assert.throws(() => buildSequence("testaram", { anchors, counts, thresholds: THRESHOLDS, today: TODAY, channel: "sms" }), (error) => error.code === "usage");
  assert.match(linkFor({ page: "https://x.test/", rule: null, campaign: "c", step: "abertura", group: "clientes", channel: "whatsapp" }).url, /utm_medium=message/);

  const store = { version: 1, groups: { testaram: email, "testaram@whatsapp": ready } };
  const markdown = renderSequences(store, { brand: "Agenda Leve" });
  assert.match(markdown, /## Testaram \(usaram sem pagar\)\n/);
  assert.match(markdown, /## Testaram \(usaram sem pagar\), por WhatsApp/);
  assert.match(markdown, /Modelo aprovado até/);
  assert.ok(!/[–—!]/.test(markdown));
});

// ---------------------------------------------------------------- voice and support

test("voice: the template names the brand and the product, the reading is declared with at most a first name, and the support template carries the peak and the holidays", () => {
  const template = voiceTemplate({ brand: "Agenda Leve", product: "a agenda com prontuário", today: TODAY });
  assert.match(template, /# A voz do cliente: Agenda Leve/);
  assert.match(template, /quando procurou a agenda com prontu.rio?/);
  assert.ok(!/[–—!]/.test(template));
  const reading = voiceReading([{ who: "Mariana, nutricionista", text: "Eu perdia uma hora por dia só remarcando.", where: "conversa" }, { text: "   " }, { who: "", text: "Quase não assinei porque achei que ia perder os dados." }], { today: TODAY });
  assert.equal(reading.kind, "declared");
  assert.equal(reading.items.length, 2);
  assert.equal(reading.items[0].kind, "audience_comment");
  assert.equal(reading.items[0].id, "voz-01");
  assert.equal(reading.items[1].who, "cliente");
  assert.equal(reading.source.type, "declared");

  const support = supportTemplate({ brand: "Agenda Leve", peak: { start: "2026-11-27", end: "2026-11-30" }, holidays: [{ date: "2026-11-20", name: "Consciência Negra" }], today: TODAY });
  assert.match(support, /# O atendimento do pico: Agenda Leve/);
  assert.match(support, /de 2026-11-27 a 2026-11-30/);
  assert.match(support, /Feriado em 2026-11-20/);
  assert.match(support, /O preço anual pode ser parcelado: \[a decidir\]/);
  assert.ok(!/[–—!]/.test(support));
});
