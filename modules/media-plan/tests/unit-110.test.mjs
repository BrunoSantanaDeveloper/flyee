// 1.1.0: the channel decision by the six lenses, the structure against the learning floor, the
// decision rules with the measurement app's numbers, and the replan from a weekly read.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildCalendar } from "../scripts/lib/calendar.mjs";
import { decideChannels } from "../scripts/lib/channels.mjs";
import { computeEconomics } from "../scripts/lib/economics.mjs";
import { assessOffer } from "../scripts/lib/offer.mjs";
import { changesFrom, changesMarkdown, readWeekly } from "../scripts/lib/replan.mjs";
import { budgetByPhase, buildPlan } from "../scripts/lib/report.mjs";
import { buildRules } from "../scripts/lib/rules.mjs";
import { buildStructure } from "../scripts/lib/structure.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const REFS = json(join(APP, "references", "referencias.json"));
const HOLIDAYS = json(join(APP, "references", "feriados.json"));
const CHANNELS = json(join(APP, "references", "canais.json"));
const READING = json(join(APP, "references", "regras.json"));
const fixture = () => json(join(HERE, "fixtures", "premissas-agenda-leve.json"));
const weekly = () => json(join(HERE, "fixtures", "semanal-ads-insights.json"));

const TODAY = "2026-10-23";
const TARGET = "2026-11-27";

function context(data) {
  const calendar = buildCalendar({ today: TODAY, targetDate: TARGET, holidays: HOLIDAYS, peak: true });
  const days = calendar.phases.filter((phase) => ["testes", "escala", "aquecimento", "pico"].includes(phase.id)).reduce((sum, phase) => sum + phase.days, 0);
  const economics = computeEconomics(data, REFS, { days, peak: true });
  const offer = assessOffer(data, { targetDate: TARGET });
  return { calendar, economics, offer };
}

// ---------------------------------------------------------------- channels

test("channels: a small budget with a base runs e-mail, tests Meta and Search, leaves TikTok and YouTube for later and keeps LinkedIn out", () => {
  const data = fixture();
  const { calendar, economics } = context(data);
  const result = decideChannels(data, { refs: CHANNELS, economics, calendar, evidence: { campaigns: 0, inventory: false } });
  const verdict = Object.fromEntries(result.rows.map((row) => [row.channel, row]));
  assert.equal(verdict.email.verdict, "run");
  assert.equal(verdict.email.confidence, "evidencia");
  assert.equal(verdict.meta.verdict, "test");
  assert.equal(verdict.meta.lens, "economia");
  assert.match(verdict.meta.reason, /piso de aprendizado/);
  assert.equal(verdict.google_search.verdict, "test");
  assert.equal(verdict.tiktok.verdict, "later");
  assert.equal(verdict.youtube.verdict, "later");
  assert.equal(verdict.linkedin.verdict, "no");
  assert.equal(verdict.parceiros.verdict, "later");
  for (const row of result.rows) {
    assert.ok(row.lens, row.channel);
    assert.ok(row.reason.length > 20, row.channel);
    assert.ok(["evidencia", "julgamento"].includes(row.confidence), row.channel);
    if (row.verdict !== "no") assert.ok(row.flip, `${row.channel} says what would flip it`);
  }
  assert.match(result.say, /Rodam: E-mail/);
  assert.ok(result.hours.asked > 0);
});

test("channels: the member's exclusions win, hours are capped, and a B2B audience opens LinkedIn only with the budget", () => {
  const data = fixture();
  data.channels = { meta: false, google_search: false, whatsapp: false };
  const { calendar, economics } = context(data);
  const result = decideChannels(data, { refs: CHANNELS, economics, calendar, hoursPerWeek: 2 });
  const verdict = Object.fromEntries(result.rows.map((row) => [row.channel, row]));
  assert.equal(verdict.meta.verdict, "no");
  assert.equal(verdict.meta.confidence, "evidencia");
  assert.equal(verdict.google_search.verdict, "no");
  assert.equal(verdict.whatsapp.verdict, "no");
  assert.equal(verdict.whatsapp.hours_per_week, 0);
  assert.equal(result.hours.available, 2);

  const b2b = fixture();
  b2b.premises.publico.value = "Gestores de clínicas e diretores de redes de consultórios, empresas de 10 a 200 pessoas.";
  b2b.premises.verba.total_brl = 60000;
  const big = decideChannels(b2b, { refs: CHANNELS, economics: context(b2b).economics, calendar: context(b2b).calendar });
  const bigVerdict = Object.fromEntries(big.rows.map((row) => [row.channel, row]));
  assert.equal(bigVerdict.linkedin.verdict, "test");
  assert.equal(bigVerdict.tiktok.verdict, "no");
  const small = decideChannels(Object.assign(fixture(), { premises: { ...fixture().premises, publico: b2b.premises.publico } }), { refs: CHANNELS, economics, calendar });
  assert.equal(small.rows.find((row) => row.channel === "linkedin").verdict, "later");
});

test("channels: without a budget every paid channel waits, and the project's campaigns turn Meta's judgment into evidence", () => {
  const data = fixture();
  data.premises.verba.total_brl = null;
  const { calendar, economics } = context(data);
  const result = decideChannels(data, { refs: CHANNELS, economics, calendar });
  const verdict = Object.fromEntries(result.rows.map((row) => [row.channel, row]));
  assert.equal(verdict.meta.verdict, "later");
  assert.equal(verdict.google_search.verdict, "later");
  assert.equal(verdict.tiktok.verdict, "later");

  const rich = fixture();
  rich.premises.verba.total_brl = 20000;
  rich.premises.evento.cost_brl = 20;
  const richContext = context(rich);
  const evidence = decideChannels(rich, { refs: CHANNELS, economics: richContext.economics, calendar: richContext.calendar, evidence: { campaigns: 2, inventory: true } });
  const meta = evidence.rows.find((row) => row.channel === "meta");
  assert.equal(meta.verdict, "run");
  assert.equal(meta.confidence, "evidencia");
  assert.match(meta.evidence, /2 campanha/);
});

// ---------------------------------------------------------------- structure

test("structure: refuses an ad set below the learning floor unless the plan accepts it, and then warns", () => {
  const data = fixture();
  data.premises.evento.cost_brl = 30;
  const { calendar, economics, offer } = context(data);
  const channels = decideChannels(data, { refs: CHANNELS, economics, calendar });
  const plan = { budget: { by_phase: budgetByPhase({ economics, calendar }) } };
  assert.throws(() => buildStructure(data, { channels, economics, calendar, plan, offer }), (error) => {
    assert.equal(error.code, "structure_invalid");
    assert.equal(error.details.floor_daily_brl, economics.learning_floor.floor_daily_brl);
    assert.ok(error.details.floor_daily_brl >= 214 && error.details.floor_daily_brl <= 215, "50 events in 7 days at R$ 30");
    assert.equal(error.details.exits.length, 3);
    assert.match(error.fix, /--accept-floor/);
    return true;
  });
  const accepted = buildStructure(data, { channels, economics, calendar, plan, offer, acceptFloor: true });
  assert.equal(accepted.channels.meta.ad_sets.length, 1);
  assert.equal(accepted.channels.meta.ad_sets[0].clears_floor, false);
  assert.equal(accepted.warnings[0].code, "below_floor");
  assert.equal(accepted.channels.meta.objective, "Cadastros (leads)");
  assert.equal(accepted.channels.meta.remarketing.length, 4);
  assert.ok(accepted.channels.meta.ad_sets[0].exclusions.some((item) => /clientes atuais/.test(item)));
  assert.equal(accepted.channels.google_search.campaigns.length, 2);
  assert.ok(accepted.channels.google_search.campaigns[1].negatives.includes("agenda leve"));
  assert.match(accepted.channels.google_search.campaigns[0].when, /pico/);
  assert.deepEqual(accepted.channels.owned.map((item) => item.channel), ["email", "whatsapp"]);
  assert.match(accepted.say, /abaixo do piso, aceito/);
});

test("structure: with the budget for two floors Meta gets two ad sets, a purchase event asks the Sales objective, and a base of 1.000 makes the lookalike", () => {
  const data = fixture();
  data.premises.verba.total_brl = 40000;
  data.premises.evento.cost_brl = 20;
  data.premises.evento.value = "Compra: a assinatura paga.";
  data.premises.evento.event = "Purchase";
  data.premises.base.contacts = 1200;
  const { calendar, economics, offer } = context(data);
  const channels = decideChannels(data, { refs: CHANNELS, economics, calendar });
  const structure = buildStructure(data, { channels, economics, calendar, plan: { budget: { by_phase: budgetByPhase({ economics, calendar }) } }, offer });
  assert.equal(structure.channels.meta.ad_sets.length, 2);
  assert.equal(structure.channels.meta.ad_sets[1].name, "black-friday-2026-frio-interesses");
  assert.equal(structure.channels.meta.objective, "Vendas");
  assert.match(structure.channels.meta.lookalike.source, /1%/);
  assert.equal(structure.channels.meta.budget_by_phase.length, 4);
  assert.equal(structure.warnings.length, 0);
});

// ---------------------------------------------------------------- rules

test("rules: the sample, the cuts and the scale steps are the measurement app's numbers, and the five triggers carry a plan B", () => {
  const data = fixture();
  const { calendar, economics } = context(data);
  const { rules, triggers, say } = buildRules(data, { refs: { reading: READING }, economics, calendar });
  assert.deepEqual([rules.sample.impressions, rules.sample.link_clicks, rules.sample.results], [1000, 30, 30]);
  assert.equal(rules.checked_on, READING.checked_on);
  assert.equal(rules.allowable_cost_brl, economics.funnel.allowable_cpl_brl);
  assert.equal(rules.pause_when.length, 3);
  assert.match(rules.pause_when[0], /3 vezes o custo permitido/);
  assert.match(rules.scale_when[0], /20 a 30% por semana/);
  assert.match(rules.swap_when[0], /35%/);
  assert.equal(Object.keys(rules.indicators_by_phase).length, 6);
  assert.match(rules.cadence.decision_point, /^\d{4}-\d{2}-\d{2}/);
  assert.equal(triggers.length, 5);
  for (const trigger of triggers) assert.ok(trigger.risk && trigger.read_in && trigger.plan_b, trigger.id);
  assert.match(say, /1000 impressões e 30 cliques/);
});

// ---------------------------------------------------------------- replan

test("replan: a weekly read becomes changes with their certainty, a premise update and the proposed moves as decisions; the goal never changes alone", () => {
  const data = fixture();
  const { calendar, economics, offer } = context(data);
  const built = buildPlan({ data, economics, offer, calendar, generatedAt: "2026-10-23T12:00:00.000Z", refs: REFS });
  const read = readWeekly(weekly(), "semanal.json");
  const replan = changesFrom(read, { plan: built.plan, economics });
  assert.equal(replan.changes.filter((change) => change.kind === "achado").length, 3);
  assert.equal(replan.changes.filter((change) => change.kind === "movimento").length, 1);
  assert.equal(replan.changes.find((change) => change.kind === "movimento").verdict, "funcionou");
  assert.equal(replan.changes.filter((change) => change.kind === "proposta").length, 1);
  assert.equal(replan.changes.filter((change) => change.kind === "lacuna").length, 1);
  assert.equal(replan.triggers_fired.length, 0, "a claim ratio of 1,3 is normal");
  assert.equal(replan.premise_updates[0].key, "meta_data");
  assert.match(replan.premise_updates[0].text, /10 de 30 assinaturas/);
  assert.deepEqual(replan.moves.map((move) => move.id), ["M3", "M4"]);
  assert.equal(replan.read.week_of, "2026-11-13");

  const markdown = changesMarkdown({ ...replan }, { version: 2, from: "ads-insights/semanal/2026-11-13.json" });
  assert.match(markdown, /^## O que mudou e por quê \(versão 2, da leitura de 13\/11\/2026\)/);
  assert.match(markdown, /mover verba/);
  assert.ok(!/[–—!]/.test(markdown));

  const bad = { ...weekly(), ledger: { ...weekly().ledger, claim_ratio: 0.6 } };
  const fired = changesFrom(bad, { plan: built.plan, economics });
  assert.equal(fired.triggers_fired[0].id, "rastreamento");
  assert.match(fired.triggers_fired[0].text, /0,6/);

  assert.throws(() => readWeekly({ interface_version: 1 }, "x.json"), (error) => error.code === "weekly_invalid");
  assert.throws(() => readWeekly(null, "x.json"), (error) => error.code === "weekly_invalid");
});

test("buildPlan: channels, structure and rules enter the plan and its sections; the summary still fits", () => {
  const data = fixture();
  data.premises.evento.cost_brl = 30;
  const { calendar, economics, offer } = context(data);
  const channels = decideChannels(data, { refs: CHANNELS, economics, calendar });
  const structure = buildStructure(data, { channels, economics, calendar, plan: { budget: { by_phase: budgetByPhase({ economics, calendar }) } }, offer, acceptFloor: true });
  const rules = buildRules(data, { refs: { reading: READING }, economics, calendar });
  const built = buildPlan({ data, economics, offer, calendar, generatedAt: "2026-10-23T12:00:00.000Z", refs: REFS, channels, structure, rules });
  assert.equal(built.plan.channels_decision.rows.length, channels.rows.length);
  assert.equal(built.plan.structure.meta.ad_sets.length, 1);
  assert.equal(built.plan.rules.sample.results, 30);
  assert.equal(built.plan.triggers.length, 5);
  assert.equal(built.plan.replan, null);
  for (const heading of ["## Canais", "## Estrutura", "## Regras de decisão"]) assert.ok(built.markdown.includes(heading), heading);
  assert.ok(built.plan.could_not_check.some((item) => /abaixo do piso/.test(item)));
  assert.ok(built.in_short_words <= 150);
  assert.ok(!/[–—!]/.test(built.markdown));
  const sections = built.markdown.split("\n## ").map((section) => section.split("\n")[0]);
  assert.ok(sections.indexOf("Canais") < sections.indexOf("O que fazer"));
});
