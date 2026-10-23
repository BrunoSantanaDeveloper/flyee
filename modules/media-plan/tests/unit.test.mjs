// The arithmetic and the rules of the plan, piece by piece: the calendar worked backwards, the
// offer and its collision, the premises and their origins, the economics, the narrative check.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildCalendar, DEADLINES, PHASES } from "../scripts/lib/calendar.mjs";
import { computeEconomics } from "../scripts/lib/economics.mjs";
import { lookProject, parseFacts } from "../scripts/lib/look.mjs";
import { assessOffer } from "../scripts/lib/offer.mjs";
import { PREMISES, premisesTemplate, questionsFor, validatePremises } from "../scripts/lib/premises.mjs";
import { buildPlan, checkNarrative, IN_SHORT_MAX_WORDS } from "../scripts/lib/report.mjs";
import { addDays, brl, daysBetween, parseMoney, slugify } from "../scripts/lib/util.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const REFS = json(join(APP, "references", "referencias.json"));
const HOLIDAYS = json(join(APP, "references", "feriados.json"));
const fixture = () => json(join(HERE, "fixtures", "premissas-agenda-leve.json"));
const narrative = () => json(join(HERE, "fixtures", "narrativa-agenda-leve.json"));

const TODAY = "2026-10-23";
const TARGET = "2026-11-27";

// ---------------------------------------------------------------- util

test("dates: addDays and daysBetween work on UTC days, and slugify keeps a plan name short", () => {
  assert.equal(addDays("2026-10-30", -7), "2026-10-23");
  assert.equal(daysBetween("2026-11-03", TARGET), 24);
  assert.equal(slugify("Black Friday 2026"), "black-friday-2026");
  assert.equal(brl(1430.4), "R$ 1.430,40");
  assert.equal(parseMoney("R$ 1.490,00 por ano"), 1490);
  assert.equal(parseMoney("149"), 149);
});

// ---------------------------------------------------------------- calendar

test("calendar: 35 days to Black Friday give the six phases, two learning windows and the decision point 14 days before", () => {
  const calendar = buildCalendar({ today: TODAY, targetDate: TARGET, holidays: HOLIDAYS });
  assert.deepEqual(calendar.phases.map((phase) => phase.id), PHASES);
  const by = Object.fromEntries(calendar.phases.map((phase) => [phase.id, [phase.start, phase.end]]));
  assert.deepEqual(by.preparacao, ["2026-10-23", "2026-10-29"]);
  assert.deepEqual(by.testes, ["2026-10-30", "2026-11-12"]);
  assert.deepEqual(by.escala, ["2026-11-13", "2026-11-19"]);
  assert.deepEqual(by.aquecimento, ["2026-11-20", "2026-11-26"]);
  assert.deepEqual(by.pico, ["2026-11-27", "2026-11-30"]);
  assert.equal(calendar.learning_windows, 2);
  assert.equal(calendar.decision_point.date, "2026-11-13");
  assert.equal(calendar.total_days, 35);
  assert.equal(calendar.short, false);
  assert.equal(calendar.target_weekday, "sexta-feira");
});

test("calendar: the fixed deadlines count back from the target and none is past on 2026-10-23", () => {
  const calendar = buildCalendar({ today: TODAY, targetDate: TARGET, holidays: HOLIDAYS });
  const dates = Object.fromEntries(calendar.deadlines.map((deadline) => [deadline.id, deadline.date]));
  assert.deepEqual(dates, { regua_escrita: "2026-11-13", pagina_pronta: "2026-11-17", rastreamento_e_oferta: "2026-11-20", criativos_em_revisao: "2026-11-24", subida_programada: "2026-11-25" });
  assert.equal(calendar.deadlines.filter((deadline) => deadline.past).length, 0);
  assert.equal(DEADLINES.length, 5);
  const late = buildCalendar({ today: "2026-11-20", targetDate: TARGET, holidays: HOLIDAYS });
  assert.ok(late.deadlines.find((deadline) => deadline.id === "regua_escrita").past);
  assert.ok(late.warnings.some((warning) => warning.code === "deadline_past"));
});

test("calendar: the national holidays inside the window carry their phase, and one in the warm-up warns", () => {
  const calendar = buildCalendar({ today: TODAY, targetDate: TARGET, holidays: HOLIDAYS });
  assert.deepEqual(calendar.holidays.map((holiday) => holiday.date), ["2026-11-02", "2026-11-15", "2026-11-20"]);
  assert.equal(calendar.holidays.find((holiday) => holiday.date === "2026-11-20").phase, "aquecimento");
  assert.ok(calendar.warnings.some((warning) => warning.code === "holiday_in_peak" && warning.text.includes("20/11")));
  assert.equal(calendar.holidays_checked_on, HOLIDAYS.checked_on);
  assert.match(calendar.say, /35 dias até 27\/11/);
});

test("calendar: a short window drops the scale phase and warns; a launch has a one-day peak; a past date is an error", () => {
  const short = buildCalendar({ today: "2026-11-10", targetDate: TARGET, holidays: HOLIDAYS });
  assert.equal(short.short, true);
  assert.ok(!short.phases.some((phase) => phase.id === "escala"));
  assert.ok(short.warnings.some((warning) => warning.code === "short_window"));
  const tiny = buildCalendar({ today: "2026-11-22", targetDate: TARGET, holidays: HOLIDAYS });
  assert.ok(tiny.warnings.some((warning) => warning.code === "no_runway"));
  assert.deepEqual(tiny.phases.map((phase) => phase.id), ["preparacao", "aquecimento", "pico", "depois"]);
  const launch = buildCalendar({ today: TODAY, targetDate: TARGET, holidays: HOLIDAYS, peak: false });
  assert.equal(launch.phases.find((phase) => phase.id === "pico").days, 1);
  assert.equal(buildCalendar({ today: TODAY, targetDate: "2026-10-01", holidays: HOLIDAYS }).error, "target_past");
});

// ---------------------------------------------------------------- offer

test("offer: a monthly price gives the annual at ten months, the bonus with no discount and three tiers", () => {
  const offer = assessOffer(fixture(), { targetDate: TARGET });
  const ids = offer.options.map((option) => option.id);
  assert.deepEqual(ids, ["anual-10-meses", "anual-com-bonus", "mensal-15", "mensal-25", "mensal-35"]);
  assert.equal(offer.options[0].price_brl, 1490);
  assert.equal(offer.options[1].discount_pct, 0);
  assert.equal(offer.options[4].price_brl, 96.85);
  assert.equal(offer.never.length, 3);
  assert.equal(offer.checks.filter((check) => check.status === "pendente").length, 5);
  assert.equal(offer.checks.find((check) => check.id === "sem_vitalicio").status, "ok");
});

test("offer: a promotion ending 24 days before the peak is a collision; one ending after it is an overlap; no price, no options", () => {
  const offer = assessOffer(fixture(), { targetDate: TARGET });
  assert.equal(offer.collision.kind, "colisao");
  assert.equal(offer.collision.gap_days, 24);
  assert.equal(offer.collision.current_discount_pct, 33.56);
  assert.ok(offer.warnings.some((warning) => warning.code === "colisao"));
  const data = fixture();
  data.current_offer.until = "2026-12-05";
  assert.equal(assessOffer(data, { targetDate: TARGET }).collision.kind, "sobreposicao");
  data.current_offer.until = "2026-10-20";
  assert.equal(assessOffer(data, { targetDate: TARGET }).collision, null);
  const noPrice = fixture();
  noPrice.premises.preco_planos = { value: "", source: null };
  const bare = assessOffer(noPrice, { targetDate: TARGET });
  assert.equal(bare.options.length, 0);
  assert.ok(bare.warnings.some((warning) => warning.code === "no_price"));
});

test("offer: a note that mentions a lifetime plan or a first-month-only discount turns the check to attention", () => {
  const data = fixture();
  data.current_offer.note = "plano vitalício por R$ 999, desconto só no primeiro mês";
  const checks = Object.fromEntries(assessOffer(data, { targetDate: TARGET }).checks.map((check) => [check.id, check.status]));
  assert.equal(checks.sem_vitalicio, "atencao");
  assert.equal(checks.sem_so_primeiro_mes, "atencao");
});

// ---------------------------------------------------------------- premises

test("premises: the template carries the ten premises, every value empty, and nothing settled", () => {
  const data = premisesTemplate("black-friday-2026", "Agenda Leve");
  assert.equal(Object.keys(data.premises).length, PREMISES.length);
  const result = validatePremises(data);
  assert.equal(result.settled.length, 0);
  assert.deepEqual(result.blocking_pending, PREMISES.filter((premise) => premise.blocking).map((premise) => premise.key));
  assert.equal(result.blocking_pending.length, 5);
});

test("premises: the fixture settles seven and leaves the three suggestions pending, all of them blocking", () => {
  const result = validatePremises(fixture());
  assert.deepEqual(result.blocking_pending, ["produto_oferta", "verba", "evento"]);
  assert.deepEqual(result.pending, ["produto_oferta", "verba", "evento"]);
  assert.equal(result.settled.length, 7);
});

test("premises: a suggestion without if_different, a found value without where, an unknown key and a bad date are refused with the path", () => {
  const noIf = fixture();
  noIf.premises.verba.if_different = "";
  assert.throws(() => validatePremises(noIf), (error) => error.code === "premises_invalid" && error.details.path === "premises.verba.if_different");
  const noWhere = fixture();
  noWhere.premises.publico.source = "encontrado";
  assert.throws(() => validatePremises(noWhere), (error) => error.details.path === "premises.publico.where");
  const unknown = fixture();
  unknown.premises.canal = { value: "TikTok", source: "informado" };
  assert.throws(() => validatePremises(unknown), (error) => error.details.path === "premises.canal");
  const extra = fixture();
  extra.extra = 1;
  assert.throws(() => validatePremises(extra), (error) => error.details.path === "extra");
  const badDate = fixture();
  badDate.target_date = "27/11/2026";
  assert.throws(() => validatePremises(badDate), (error) => error.details.path === "target_date");
  const badRate = fixture();
  badRate.rates.known_to_customer_pct.value = 140;
  assert.throws(() => validatePremises(badRate), (error) => error.details.path === "rates.known_to_customer_pct.value");
  const badField = fixture();
  badField.premises.verba.total_brl = "quatro mil";
  assert.throws(() => validatePremises(badField), (error) => error.details.path === "premises.verba.total_brl");
});

test("premises: the questions come in the order that decides the plan, at most four, each with the suggestion when there is one", () => {
  const { questions, more_pending } = questionsFor(fixture(), 4);
  assert.deepEqual(questions.map((question) => question.key), ["produto_oferta", "verba", "evento"]);
  assert.equal(more_pending, 0);
  assert.ok(questions[0].suggestion.startsWith("Agenda Leve"));
  assert.ok(questions[0].if_different.length > 10);
  assert.equal(questions.every((question) => question.blocking), true);
  const template = questionsFor(premisesTemplate("x"), 4);
  assert.equal(template.questions.length, 4);
  assert.equal(template.more_pending, PREMISES.length - 4);
  assert.deepEqual(template.questions.map((question) => question.key), ["produto_oferta", "publico", "meta_data", "verba"]);
  assert.equal(template.questions[0].suggestion, null);
});

// ---------------------------------------------------------------- economics

test("economics: with the member's own margin and retention, a customer may cost 12 months of payback and the third cap stays out", () => {
  const result = computeEconomics(fixture(), REFS, { days: 32, peak: true });
  assert.equal(result.economics.allowable_cac_brl, 1430.4);
  assert.equal(result.economics.allowable_cac_bound, "payback");
  assert.equal(result.economics.breakeven_cac_brl, 1668.8);
  assert.deepEqual(result.economics.bounds.map((bound) => bound.id), ["payback"]);
  assert.equal(result.economics.margin_source, "informado");
  assert.ok(!result.assumptions.some((assumption) => assumption.key === "margin_pct"));
});

test("economics: a margin from the rule of thumb brings the third-of-first-year cap and a labelled assumption", () => {
  const data = fixture();
  delete data.premises.preco_planos.margin_pct;
  delete data.premises.preco_planos.retention_months;
  const result = computeEconomics(data, REFS, { days: 32 });
  assert.deepEqual(result.economics.bounds.map((bound) => bound.id), ["payback", "terco"]);
  assert.equal(result.economics.margin_source, "regra de bolso");
  const margin = result.assumptions.find((assumption) => assumption.key === "margin_pct");
  assert.equal(margin.format, "pct");
  assert.equal(margin.source, REFS.rules_of_thumb.margin_pct.source);
  assert.ok(result.assumptions.some((assumption) => assumption.key === "payback_months"));
});

test("economics: the funnel splits the goal between the base and cold traffic and works the leads and visits backwards", () => {
  const { funnel } = computeEconomics(fixture(), REFS, { days: 32 });
  assert.equal(funnel.from_known, 19);
  assert.equal(funnel.cold_goal, 11);
  assert.equal(funnel.known_rate.value, 4);
  assert.equal(funnel.leads_needed, 74);
  assert.equal(funnel.allowable_cpl_brl, 214.56);
  assert.equal(funnel.capacity_cap, 68);
  assert.match(funnel.say, /19 podem vir de quem já conhece a marca/);
  const noBase = fixture();
  noBase.premises.publico.known_people = false;
  assert.equal(computeEconomics(noBase, REFS, { days: 32 }).funnel.from_known, 0);
});

test("economics: three scenarios say what the goal costs and what the budget buys, flagging the capacity cap", () => {
  const { scenarios, budget } = computeEconomics(fixture(), REFS, { days: 32 });
  assert.deepEqual(scenarios.map((scenario) => scenario.id), ["conservador", "esperado", "otimista"]);
  assert.equal(budget.total_brl, 4000);
  assert.equal(budget.daily_brl, 125);
  const expected = scenarios.find((scenario) => scenario.id === "esperado");
  assert.equal(expected.cost_per_lead_brl, REFS.rules_of_thumb.cost_per_lead_brl.mid);
  assert.equal(expected.leads_for_goal, 74);
  assert.equal(expected.budget_needed_brl, 1480);
  assert.equal(expected.leads_bought, 200);
  assert.equal(expected.customers_bought, 49);
  assert.equal(expected.meets_goal, true);
  const optimistic = scenarios.find((scenario) => scenario.id === "otimista");
  assert.equal(optimistic.over_capacity, true);
  assert.equal(scenarios.find((scenario) => scenario.id === "conservador").meets_goal, false);
});

test("economics: the learning floor uses the expected cost per event, never the allowable ceiling, and says the three ways out", () => {
  const { learning_floor, warnings } = computeEconomics(fixture(), REFS, { days: 32 });
  assert.equal(learning_floor.daily_brl, 125);
  assert.equal(learning_floor.max_cost_per_event_brl, 17.5);
  assert.equal(learning_floor.cost_per_event_brl, REFS.rules_of_thumb.cost_per_lead_brl.mid);
  assert.equal(learning_floor.floor_daily_brl, 143);
  assert.equal(learning_floor.viable, false);
  assert.match(learning_floor.say, /Saídas: um evento mais cedo no funil/);
  assert.ok(warnings.some((warning) => warning.code === "learning_floor"));
  const informed = fixture();
  informed.premises.evento.cost_brl = 12;
  const own = computeEconomics(informed, REFS, { days: 32 }).learning_floor;
  assert.equal(own.cost_source, "informado");
  assert.equal(own.viable, true);
});

test("economics: a small base would see the ad too many times a week, so the plan sends it to e-mail and messages", () => {
  const { frequency, assumptions } = computeEconomics(fixture(), REFS, { days: 32, peak: true });
  assert.equal(frequency.reach, 480);
  assert.ok(frequency.per_person_per_week > frequency.cap);
  assert.equal(frequency.too_high, true);
  assert.match(frequency.say, /e-mail e mensagem/);
  assert.ok(assumptions.some((assumption) => assumption.key === "cpm_brl" && /pico/.test(assumption.label)));
});

test("economics: without a price there is no allowable cost, and without days the window defaults to 30 as a labelled assumption", () => {
  const data = fixture();
  data.premises.preco_planos = { value: "", source: null };
  const result = computeEconomics(data, REFS, {});
  assert.equal(result.economics, null);
  assert.ok(result.warnings.some((warning) => warning.code === "no_price"));
  assert.equal(result.budget.days, 30);
  assert.ok(result.assumptions.some((assumption) => assumption.key === "days" && assumption.value === 30));
});

// ---------------------------------------------------------------- narrative and plan

test("narrative: the fixture passes; a promise, a dash, an exclamation mark, a wrong certainty and an unknown field are refused", () => {
  assert.deepEqual(checkNarrative(narrative()), []);
  const bad = narrative();
  bad.findings[0].text = "Com este plano você vai vender 30 assinaturas — garantido!";
  bad.findings[1].certainty = "certeza";
  bad.extra = true;
  const problems = checkNarrative(bad);
  assert.ok(problems.some((problem) => /promete resultado/.test(problem)));
  assert.ok(problems.some((problem) => /travessão/.test(problem)));
  assert.ok(problems.some((problem) => /exclamação/.test(problem)));
  assert.ok(problems.some((problem) => /findings\[1\]\.certainty/.test(problem)));
  assert.ok(problems.some((problem) => /extra: campo desconhecido/.test(problem)));
  assert.ok(checkNarrative({ findings: [] }).some((problem) => /de 1 a 3 achados/.test(problem)));
});

test("plan: the draft carries the premises with their origin, the budget by phase with the peak doubled, the moves and the UTM rule", () => {
  const data = fixture();
  const calendar = buildCalendar({ today: TODAY, targetDate: TARGET, holidays: HOLIDAYS });
  const economics = computeEconomics(data, REFS, { days: 32, peak: true });
  const offer = assessOffer(data, { targetDate: TARGET });
  const built = buildPlan({ data, economics, offer, calendar, narrative: narrative(), generatedAt: "2026-10-23T12:00:00.000Z", refs: REFS });
  assert.equal(built.warnings.length, 0);
  assert.ok(built.in_short_words <= IN_SHORT_MAX_WORDS, `${built.in_short_words} words`);
  assert.equal(built.plan.state, "rascunho");
  assert.equal(built.plan.version, 1);
  assert.equal(built.plan.interface_version, 1);
  assert.deepEqual(built.plan.blocking_pending, ["produto_oferta", "verba", "evento"]);
  const byPhase = Object.fromEntries(built.plan.budget.by_phase.map((phase) => [phase.phase, phase]));
  assert.equal(Object.keys(byPhase).length, 4);
  assert.equal(built.plan.budget.by_phase.reduce((sum, phase) => sum + phase.budget_brl, 0) >= 3998, true);
  assert.ok(byPhase.pico.daily_brl > byPhase.testes.daily_brl * 1.9);
  assert.equal(built.plan.moves[0].what, narrative().first_move);
  assert.ok(built.plan.moves.length <= 6);
  assert.match(built.plan.tracking.utm_rule, /^utm_source=<canal>&utm_medium=<meio>&utm_campaign=<plano>/);
  assert.equal(built.plan.premises.verba.source, "sugerido-pendente");
  assert.equal(built.plan.premises.publico.source, "informado");
  for (const heading of ["## Em resumo", "## Decisões para você", "## A história", "## O que fazer", "## O que não vamos fazer", "## O que não conseguimos conferir", "## Premissas", "## Fontes"]) assert.ok(built.markdown.includes(heading), heading);
  assert.ok(!/[–—!]/.test(built.markdown), "the member's document follows the copy rules");
  assert.equal(built.say.length, 3);
});

test("plan: without a narrative the script's own findings fit the summary and a draft always comes out", () => {
  const data = fixture();
  const built = buildPlan({ data, economics: computeEconomics(data, REFS, { days: 32, peak: true }), offer: assessOffer(data, { targetDate: TARGET }), calendar: buildCalendar({ today: TODAY, targetDate: TARGET, holidays: HOLIDAYS }), generatedAt: "2026-10-23T12:00:00.000Z", refs: REFS });
  assert.equal(built.warnings.length, 0);
  assert.ok(built.in_short_words <= IN_SHORT_MAX_WORDS, `${built.in_short_words} words`);
  assert.equal(built.plan.findings.length, 0);
  assert.match(built.markdown, /1\. Um cliente pode custar até R\$ 1\.430,40; da meta de 30 assinaturas, 19 podem vir/);
  assert.match(built.markdown, /2\. Com R\$ 20 por evento, um conjunto precisa de R\$ 143 por dia/);
  assert.match(built.markdown, /3\. A promoção de agora termina 24 dias antes/);
  const empty = premisesTemplate("vazio");
  const nothing = buildPlan({ data: empty, economics: computeEconomics(empty, REFS, {}), offer: assessOffer(empty, {}), calendar: null, generatedAt: "2026-10-23T12:00:00.000Z", refs: REFS });
  assert.equal(nothing.warnings.length, 0);
  assert.match(nothing.markdown, /as premissas vêm primeiro/);
  assert.equal(nothing.plan.blocking_pending.length, 5);
});

test("plan: findings too long for the summary come back as in_short_long", () => {
  const data = fixture();
  const long = narrative();
  long.findings = long.findings.map((finding) => ({ ...finding, text: `${finding.text} ${"palavra ".repeat(60).trim()}.` }));
  const built = buildPlan({ data, economics: computeEconomics(data, REFS, { days: 32 }), offer: assessOffer(data, { targetDate: TARGET }), calendar: buildCalendar({ today: TODAY, targetDate: TARGET, holidays: HOLIDAYS }), narrative: long, generatedAt: "2026-10-23T12:00:00.000Z", refs: REFS });
  const warning = built.warnings.find((item) => item.code === "in_short_long");
  assert.ok(warning);
  assert.ok(warning.words > IN_SHORT_MAX_WORDS);
});

// ---------------------------------------------------------------- look

test("look: parseFacts reads the lines of a briefing by their label, with or without accents", () => {
  const facts = parseFacts("# Briefing\n\n- Oferta: anual pelo preço de 10 meses\n- Preço: R$ 149 por mês\n- Público: nutricionistas\n- Verba diária: R$ 125\n- Evento de otimização: Lead\n");
  assert.equal(facts.oferta, "anual pelo preço de 10 meses");
  assert.equal(facts.preco, "R$ 149 por mês");
  assert.equal(facts.publico, "nutricionistas");
  assert.equal(facts.verba, "R$ 125");
  assert.equal(facts.evento, "Lead");
});

test("look: an empty project has nothing found and says what it looked at", () => {
  const look = lookProject(join(HERE, "fixtures"));
  assert.equal(look.found.length, 0);
  assert.equal(look.has_brand_file, false);
  assert.deepEqual(look.looked.map((item) => item.what), ["marca.md", "anuncios/*/briefing.md", "capturas/*/captura.json", "instagram-research/profiles", "contatos/inventario.json", "media-plan/*/premissas.json"]);
});
