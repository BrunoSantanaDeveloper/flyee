// 1.2.0, the pure pieces of the next round and the sequence of the target date: the measurement
// report as own results, the proposal that never brings a cut concept back the same, the four
// dated pieces checked by the same copy rules.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { checkBriefing } from "../scripts/lib/campaign.mjs";
import { adName } from "../scripts/lib/concepts.mjs";
import { proposeNextRound, reportToOwnResults, roundMarkdown, VERDICTS } from "../scripts/lib/round.mjs";
import { CDC_LINES, sequenceMarkdown, targetSequence, ZONES } from "../scripts/lib/sequence.mjs";
import { BRIEFING, concepts as conceptsFixture } from "./fixtures/campanha.mjs";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(TESTS_DIR, "..");
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const REPORT = () => json(join(TESTS_DIR, "fixtures", "report.json"));
const PLAN = () => json(join(TESTS_DIR, "fixtures", "plano.json"));
const META = json(join(APP_DIR, "references", "meta-anuncios.json"));

/** The concepts with the names the app computes, as conceitos.json holds them after `concepts`. */
function namedConcepts(brief) {
  return conceptsFixture().concepts.map((concept) => ({ ...concept, ad_name: adName(brief.padrao, { concept, placement: "vertical", version: 1 }) }));
}

test("the report becomes own results: one declared item per ad that matched a concept, with the verdict, the metrics as text and the reading as source", () => {
  const brief = checkBriefing(BRIEFING).brief;
  const concepts = namedConcepts(brief);
  assert.deepEqual(concepts.map((concept) => concept.ad_name), ["memoria-reels-lembra-v1", "confianca-reels-branco-v1", "mtc-reels-pulso-v1"]);
  const reading = reportToOwnResults(REPORT(), { concepts });
  assert.equal(reading.kind, "declared");
  assert.equal(reading.collected_at, "2026-10-15");
  assert.equal(reading.items.length, 3, "the row without a concept is left out");
  const first = reading.items[0];
  assert.equal(first.kind, "own_result");
  assert.equal(first.ad_name, "memoria-reels-lembra-v1");
  assert.equal(first.id, "meta-testes-memoria-reels-lembra-v1");
  assert.match(first.text, /veredito escalar, confirmado em 2026-10-02 a 2026-10-15/);
  assert.deepEqual(first.metrics.map((metric) => metric.name), ["resultados", "custo_por_resultado", "ctr_link", "gancho", "gasto"]);
  assert.equal(first.metrics[1].value_text, "R$ 14,44");
  assert.equal(first.metrics[3].value_text, "30%");
  assert.equal(first.verdict, "escalar");
  const cut = reading.items[2];
  assert.equal(cut.where_it_fails, "anuncio");
  assert.ok(!cut.metrics.some((metric) => metric.name === "custo_por_resultado"), "no cost with zero results");
  assert.match(reading.source.ref, /leitura meta-testes do app de medição/);
  assert.throws(() => reportToOwnResults({ interface_version: 1 }, { concepts }), (error) => error.code === "report_invalid");
  assert.throws(() => reportToOwnResults(null, { concepts }), (error) => error.code === "report_invalid");
  assert.ok(VERDICTS.includes("dado_insuficiente"));
});

test("the next round keeps what scaled, iterates only where it fails, cuts without coming back the same, and names everything -v2", () => {
  const brief = checkBriefing(BRIEFING).brief;
  const concepts = namedConcepts(brief);
  const ids = { "memoria-reels-lembra-v1": "res-meta-testes-memoria-reels-lembra-v" };
  const proposal = proposeNextRound(REPORT(), { concepts, brief, round: 1, resultIds: ids });
  assert.equal(proposal.round, 2);
  assert.equal(proposal.keep.length, 1);
  assert.equal(proposal.keep[0].concept, "memoria");
  assert.equal(proposal.keep[0].result_id, ids["memoria-reels-lembra-v1"], "the id the evidence gave wins");
  assert.match(proposal.keep[0].do, /duas variações do mesmo gancho/);
  assert.equal(proposal.iterate.length, 1);
  assert.equal(proposal.iterate[0].where_it_fails, "gancho");
  assert.match(proposal.iterate[0].do, /3 primeiros segundos/);
  assert.match(proposal.iterate[0].result_id, /^res-meta-testes-confianca/);
  assert.equal(proposal.cut.length, 1);
  assert.equal(proposal.cut[0].concept, "mtc");
  assert.match(proposal.cut[0].rule, /não volta igual/);
  assert.equal(proposal.unread.length, 0, "the unmatched row is nobody's");
  assert.equal(proposal.new_concepts_needed, 1);
  for (const entry of [...proposal.keep, ...proposal.iterate, ...proposal.cut]) assert.match(entry.next_name, /-v2$/, entry.next_name);
  assert.equal(proposal.keep[0].next_name, "memoria-reels-lembra-v2");
  assert.match(proposal.say, /^Rodada 2: 1 para manter, 1 para iterar, 1 cortado\(s\), 0 sem veredito; 1 conceito\(s\) novo\(s\)/);
  const markdown = roundMarkdown(proposal, { campaign: "lotus-bf26", report: "ads-insights/leituras/meta-testes/report.json" });
  assert.match(markdown, /\| mtc \| mtc-reels-pulso-v1 \| cortar \| provavel \| .* \| não volta igual \|/);
  assert.match(markdown, /Conceitos novos para a leva: 1\./);
  assert.ok(!/[–—!]/.test(markdown));
});

test("the sequence of the target date: four pieces dated by the plan, scheduled two days before, each format on its network, the copy passing the same checks", () => {
  const brief = checkBriefing(BRIEFING).brief;
  const plan = PLAN();
  const sequence = targetSequence({ plan, brief, limits: META, today: "2026-10-23" });
  const warm = plan.calendar.phases.find((phase) => phase.id === "aquecimento");
  const peak = plan.calendar.phases.find((phase) => phase.id === "pico");
  assert.deepEqual(sequence.pieces.map((piece) => piece.id), ["abertura-lista", "oferta-no-ar", "contagem-regressiva", "ultimo-dia"]);
  assert.equal(sequence.pieces[0].date, "2026-11-18", "two days before the warm-up opens the list");
  assert.ok(sequence.pieces[0].date < warm.start);
  assert.equal(sequence.pieces[1].date, peak.start);
  assert.equal(sequence.pieces[3].date, peak.end);
  assert.ok(sequence.pieces[2].date > peak.start && sequence.pieces[2].date < peak.end);
  for (const piece of sequence.pieces) {
    assert.equal(piece.schedule_on < piece.date, true);
    assert.equal(piece.formats["9:16"].network, "ads_meta");
    assert.equal(piece.formats["4:5"].network, "ads_meta_feed");
    assert.equal(piece.formats["1:1"].network, "ads_meta_feed");
    assert.equal(piece.copy_check.passed, true, JSON.stringify(piece.copy_check.problems));
    assert.deepEqual(piece.offer.cdc, CDC_LINES);
    assert.equal(piece.past, false);
  }
  assert.match(sequence.pieces[1].copy.primary_text, /até 30\/11 às 23h59/);
  assert.match(sequence.pieces[1].copy.primary_text, /R\$ 1\.658,33/, "the price is the plan offer option, ten months for the year");
  assert.equal(sequence.warnings.length, 0, JSON.stringify(sequence.warnings));
  assert.equal(sequence.deadline, peak.end);
  assert.deepEqual(ZONES, { "9:16": "ads_meta", "4:5": "ads_meta_feed", "1:1": "ads_meta_feed" });
  const markdown = sequenceMarkdown(sequence, { campaign: "lotus-bf26" });
  assert.match(markdown, /\| 27\/11 \| Oferta no ar \|/);
  assert.match(markdown, /## O que a lei pede em cada peça/);
  assert.ok(!/[–—!]/.test(markdown));

  const late = targetSequence({ plan, brief, limits: META, today: "2026-11-28" });
  assert.ok(late.warnings.some((warning) => warning.code === "past_date"));
  const noPhases = { ...plan, calendar: { phases: [] }, budget: { ...plan.budget, by_phase: [] } };
  assert.throws(() => targetSequence({ plan: noPhases, brief, limits: META }), (error) => error.code === "plan_incomplete");
  const budgetOnly = { ...plan, calendar: undefined };
  assert.equal(targetSequence({ plan: budgetOnly, brief, limits: META, today: "2026-10-23" }).pieces.length, 4, "the budget phases date the pieces when the calendar is missing");
});
