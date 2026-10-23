// The pieces of the measurement app, one by one: the CSV reader, the export normalizer, the UTM
// rule, the tag detector, the ledger, the contract, the verdicts, the moves and the documents.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { detectSeparator, parseCsv, parseNumber, parseTable } from "../scripts/lib/csv.mjs";
import { contractTemplate, contractValues, validateContract } from "../scripts/lib/contract.mjs";
import { aggregateByName, normalizeExport, parseExportDay } from "../scripts/lib/exports.mjs";
import { importRows, pseudonym, readLedger, rowFrom, summarize } from "../scripts/lib/ledger.mjs";
import { applyMove, emptyMoves, judgeMoves, proposeMoves } from "../scripts/lib/moves.mjs";
import { renderReading, renderTracking, renderWeekly, words } from "../scripts/lib/report.mjs";
import { detectTags } from "../scripts/lib/tags.mjs";
import { buildUtm, checkUtm, utmValue } from "../scripts/lib/utm.mjs";
import { judgeRow, judgeTable, metricsOf, times } from "../scripts/lib/verdict.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");
const read = (name) => readFileSync(join(HERE, "fixtures", name), "utf8");
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const COLUMNS = json(join(APP, "references", "colunas.json"));
const RULES = json(join(APP, "references", "leitura.json"));
const PLAN = json(join(HERE, "fixtures", "plano-aprovado.json"));
const metaPt = () => normalizeExport(read("export-meta-pt.csv"), { source: "meta", columns: COLUMNS });
const metaEn = () => normalizeExport(read("export-meta-en.csv"), { source: "meta", columns: COLUMNS });
const google = () => normalizeExport(read("export-google-termos-pt.csv"), { source: "google", columns: COLUMNS });

// ---------------------------------------------------------------- csv

test("csv: numbers as the exports write them, in both languages; an empty cell is null, never zero", () => {
  const cases = { "1.234,56": 1234.56, "1,234.56": 1234.56, "26.000": 26000, "26,000": 26000, "1,50%": 1.5, "1.50%": 1.5, "R$ 1,80": 1.8, "14.44": 14.44, "1,041": 1041, "0,40%": 0.4, "12,5": 12.5, "520,00": 520, "7": 7 };
  for (const [text, value] of Object.entries(cases)) assert.equal(parseNumber(text), value, text);
  for (const text of ["", "—", "-", "n/a", "abc", null, undefined]) assert.equal(parseNumber(text), null, String(text));
});

test("csv: the separator is read from the header, quotes and BOM are handled", () => {
  assert.equal(detectSeparator("a;b;c\n1;2;3"), ";");
  assert.equal(detectSeparator('a,"b,c",d\n1,2,3'), ",");
  const { rows } = parseCsv('﻿a,b\n"x, y","he said ""hi"""\n');
  assert.deepEqual(rows, [["a", "b"], ["x, y", 'he said "hi"']]);
  const table = parseTable("Nome;Valor\nA;1\n\nB;2\n");
  assert.deepEqual(table.header, ["Nome", "Valor"]);
  assert.equal(table.records.length, 2);
});

// ---------------------------------------------------------------- exports

test("exports: the Portuguese export with semicolons and the English one with commas give the same table", () => {
  const pt = metaPt();
  const en = metaEn();
  assert.equal(pt.level, "ad");
  assert.equal(pt.rows.length, 6, "the totals line is dropped");
  assert.deepEqual(pt.period, { start: "2026-10-30", end: "2026-11-12" });
  assert.deepEqual(en.period, pt.period);
  assert.deepEqual(pt.missing, []);
  const pick = (rows) => rows.map((row) => [row.name, row.spend, row.impressions, row.link_clicks, row.landing_page_views, row.video_plays_3s, row.thruplays, row.results]);
  assert.deepEqual(pick(en.rows), pick(pt.rows));
  assert.deepEqual(pt.totals, en.totals);
  assert.equal(pt.totals.spend, 1530);
  assert.equal(pt.rows[2].cost_per_result, null, "a dash is not a zero");
  assert.equal(pt.separator, ";");
  assert.equal(en.separator, ",");
});

test("exports: a column the export does not carry goes to missing and never becomes zero", () => {
  const thin = normalizeExport(read("export-meta-sem-video.csv"), { source: "meta", columns: COLUMNS });
  assert.deepEqual(thin.missing, ["reach", "frequency", "landing_page_views", "video_plays_3s", "thruplays"]);
  assert.equal(thin.rows[0].video_plays_3s, undefined);
  const metrics = metricsOf(thin.rows[0], { source: "meta", fields: thin.fields });
  assert.equal(metrics.hook_rate, null);
  assert.equal(metrics.visits_from, "link_clicks");
  assert.equal(metrics.results, 36);
  assert.throws(() => normalizeExport("Coluna estranha;Outra\n1;2\n", { source: "meta", columns: COLUMNS }), { code: "export_invalid" });
  assert.throws(() => normalizeExport("", { source: "meta", columns: COLUMNS }), { code: "export_invalid" });
});

test("exports: the Google search-terms export is read at the search_term level with Brazilian numbers", () => {
  const terms = google();
  assert.equal(terms.level, "search_term");
  assert.equal(terms.rows.length, 4, "the Total line is dropped");
  assert.equal(terms.rows[2].name, "curso de nutrição gratis");
  assert.equal(terms.rows[2].conversions, 0);
  assert.equal(terms.rows[2].spend, 48);
  assert.equal(terms.rows[0].avg_cpc, 1.8);
  assert.equal(terms.totals.spend, 256.5);
});

test("exports: daily lines of the same ad are summed and the ratios recomputed; export dates are read in both orders", () => {
  const daily = normalizeExport(read("export-meta-dia.csv"), { source: "meta", columns: COLUMNS });
  const twice = aggregateByName([...daily.rows, ...daily.rows]);
  const first = twice.find((row) => row.name === "AL-BF26-presenca-cena-01");
  assert.equal(first.spend, 420);
  assert.equal(first.impressions, 18000);
  assert.equal(Math.round(first.link_ctr * 1000) / 1000, 0.667);
  assert.equal(parseExportDay("27/11/2026"), "2026-11-27");
  assert.equal(parseExportDay("11/27/2026"), "2026-11-27");
  assert.equal(parseExportDay("2026-11-27"), "2026-11-27");
  assert.equal(parseExportDay("ontem"), null);
});

// ---------------------------------------------------------------- utm

test("utm: build gives the exact query, keeps the ad name as written and refuses a missing field", () => {
  const built = buildUtm({ source: "Meta", medium: "cpc", campaign: "Black Friday 2026", content: "AL-BF26-presenca-cena-01", term: "frio", url: "https://exemplo.test/oferta?x=1" });
  assert.equal(built.query, "utm_source=meta&utm_medium=cpc&utm_campaign=black-friday-2026&utm_content=AL-BF26-presenca-cena-01&utm_term=frio");
  assert.equal(built.url, "https://exemplo.test/oferta?x=1&utm_source=meta&utm_medium=cpc&utm_campaign=black-friday-2026&utm_content=AL-BF26-presenca-cena-01&utm_term=frio");
  assert.throws(() => buildUtm({ source: "meta", medium: "cpc", content: "x", term: "y" }), (error) => error.code === "utm_invalid" && error.details.missing.includes("utm_campaign"));
  assert.equal(utmValue("Público Frio, SP"), "publico-frio-sp");
});

test("utm: check lists what is present and missing, and compares utm_content with the delivered names", () => {
  const names = json(join(HERE, "fixtures", "nomes.json")).ads.map((ad) => ad.ad_name);
  const bad = checkUtm("https://exemplo.test/oferta?utm_source=meta&utm_medium=cpc");
  assert.equal(bad.valid, false);
  assert.deepEqual(bad.missing, ["utm_campaign", "utm_content", "utm_term"]);
  const good = checkUtm("https://exemplo.test/oferta?utm_source=meta&utm_medium=cpc&utm_campaign=bf&utm_content=AL-BF26-presenca-cena-01&utm_term=frio", { names });
  assert.equal(good.valid, true);
  assert.equal(good.name_match, "exact");
  const off = checkUtm("https://exemplo.test/oferta?utm_source=Meta&utm_medium=cpc&utm_campaign=bf&utm_content=al-bf26-presenca-cena-01&utm_term=frio", { names });
  assert.equal(off.name_match, "case_differs");
  assert.ok(off.warnings.some((warning) => warning.code === "value_not_normalized"));
  assert.throws(() => checkUtm("not a url"), { code: "usage" });
});

// ---------------------------------------------------------------- tags

test("tags: a page with Pixel, GA4, GTM and the Google Ads tag reports each as present with its id; an empty page reports absent", () => {
  const found = detectTags(read("pagina-com-tags.html"));
  const by = Object.fromEntries(found.tags.map((tag) => [tag.id, tag]));
  assert.equal(by.meta_pixel.status, "present");
  assert.deepEqual(by.meta_pixel.ids, ["123456789012345"]);
  assert.equal(by.ga4.status, "present");
  assert.deepEqual(by.ga4.ids, ["G-ABC123DEF4"]);
  assert.equal(by.gtm.status, "present");
  assert.deepEqual(by.gtm.ids, ["GTM-ABCD12"]);
  assert.equal(by.google_ads.status, "present");
  assert.equal(by.tiktok.status, "absent");
  assert.equal(by.linkedin.status, "absent");
  assert.equal(found.cookie_notice, "present");
  assert.match(found.say, /HTML servido/);
  const empty = detectTags(read("pagina-vazia.html"));
  assert.ok(empty.tags.every((tag) => tag.status === "absent"));
  assert.equal(empty.cookie_notice, "absent");
  assert.match(empty.say, /Nenhuma tag/);
  assert.equal(detectTags("<!-- fbq('init','1') -->").tags[0].status, "absent", "a commented tag is not live");
});

// ---------------------------------------------------------------- ledger

test("ledger: the pseudonym depends on the salt and the normalized e-mail, and never carries the e-mail", () => {
  const a = pseudonym("Ana@Exemplo.test", "sal-1");
  assert.equal(a, pseudonym("  ana@exemplo.test ", "sal-1"));
  assert.notEqual(a, pseudonym("ana@exemplo.test", "sal-2"));
  assert.equal(a.length, 16);
  assert.ok(!a.includes("exemplo"));
  assert.throws(() => pseudonym("x@y.test", null), { code: "contract_missing" });
});

test("ledger: a row refuses a bad date, a bad stage and a bad value, with the path", () => {
  const row = rowFrom({ date: "2026-11-02", stage: "Compra", source: "Meta", medium: "cpc", campaign: "bf", content: "AL-1", value: "149,90", qualified: "sim", email: "a@b.test" }, "sal");
  assert.equal(row.etapa, "compra");
  assert.equal(row.origem, "meta");
  assert.equal(row.valor_brl, 149.9);
  assert.equal(row.qualificado, "sim");
  assert.throws(() => rowFrom({ date: "02/11/2026", stage: "lead", email: "a@b.test" }, "sal"), (error) => error.code === "ledger_invalid" && error.details.path === "data");
  assert.throws(() => rowFrom({ date: "2026-11-02", stage: "visita", email: "a@b.test" }, "sal"), (error) => error.details.path === "etapa");
  assert.throws(() => rowFrom({ date: "2026-11-02", stage: "lead", value: "muito", email: "a@b.test" }, "sal"), (error) => error.details.path === "valor_brl");
});

test("ledger: importing a list keeps only the origin columns, writes the pseudonym and drops name, e-mail and phone", () => {
  const result = importRows(read("leads.csv"), { salt: "sal", defaultStage: "lead" });
  assert.equal(result.rows.length, 4, "the line without an e-mail stays out");
  assert.deepEqual(result.personal_columns_dropped, ["Nome", "Telefone"]);
  assert.deepEqual(result.problems, [{ line: 5, problem: "sem e-mail" }]);
  const text = JSON.stringify(result.rows);
  assert.ok(!/exemplo\.test|Ana|Bruno|90000/.test(text), "no personal data in the rows");
  assert.equal(result.rows[0].pseudonimo, result.rows[3].pseudonimo, "the same person twice gives the same pseudonym");
  assert.equal(result.rows[1].pseudonimo, pseudonym("bruno@exemplo.test", "sal"), "the e-mail is normalized before hashing");
  assert.equal(result.rows[2].data, "2026-11-03", "a Brazilian date is read");
  assert.equal(result.rows[0].conteudo, "AL-BF26-presenca-cena-01");
  assert.throws(() => importRows("Nome,Telefone\nA,1\n", { salt: "sal" }), { code: "import_invalid" });
});

test("ledger: the summary of 12 lines counts by origin and stage and gives the claim ratio 1,3 for 13 claimed purchases", () => {
  const rows = readLedger(read("origens-12.csv"));
  assert.equal(rows.length, 12);
  const summary = summarize(rows, { claimedPurchases: 13 });
  assert.equal(summary.by_stage.compra, 10);
  assert.equal(summary.by_stage.lead, 2);
  assert.equal(summary.by_origin.meta.compra, 6);
  assert.equal(summary.by_origin.email.valor_brl, 4470);
  assert.equal(summary.revenue_brl, 5513);
  assert.equal(summary.claim_ratio, 1.3);
  assert.equal(summary.rates.meta.lead_to_compra_pct, 0, "the two leads did not buy");
  assert.match(summary.say, /1,3 compra\(s\) para cada compra real, dentro do normal/);
  assert.equal(summarize(rows, { claimedPurchases: 20 }).say.includes("alguém conta duas vezes"), true);
  assert.equal(summarize(rows, {}).claim_ratio, null);
});

// ---------------------------------------------------------------- contract

test("contract: the template takes the allowable cost, the event, the margin and the channels from the approved plan", () => {
  const data = contractTemplate({ plan: "black-friday-2026", planData: PLAN, today: "2026-10-23" });
  assert.equal(data.items.custo_permitido_brl.value, 40);
  assert.equal(data.items.custo_permitido_brl.status, "informado");
  assert.equal(data.items.margem_pct.value, 80);
  assert.equal(data.items.mer_equilibrio.value, 1.25);
  assert.deepEqual(data.items.canais.value, ["meta", "google_search", "owned"]);
  assert.match(data.items.evento_otimizacao.value, /^Lead/);
  assert.equal(data.items.sal.value.length, 32);
  const validity = validateContract(data);
  assert.deepEqual(validity.required_unknown, ["tipo_negocio", "arbitro", "campo_origem"]);
  assert.equal(validity.ready, false);
  assert.equal(validity.questions.length, 4);
  assert.ok(validity.questions.every((question) => question.question));
  const values = contractValues(data);
  assert.equal(values.allowable, 40);
  assert.equal(values.type, null);
});

test("contract: a bad status, an unknown item, a non-numeric allowable cost and an unknown business type are refused with the path", () => {
  const data = contractTemplate({ plan: null, planData: null, today: "2026-10-23" });
  assert.equal(data.items.custo_permitido_brl.status, "desconhecido");
  const bad = structuredClone(data);
  bad.items.meta.status = "talvez";
  assert.throws(() => validateContract(bad), (error) => error.code === "contract_invalid" && error.details.path === "items.meta.status");
  const extra = structuredClone(data);
  extra.items.outro = { value: 1, status: "informado" };
  assert.throws(() => validateContract(extra), (error) => error.details.path === "items.outro");
  const text = structuredClone(data);
  text.items.custo_permitido_brl = { value: "quarenta", status: "informado" };
  assert.throws(() => validateContract(text), (error) => error.details.path === "items.custo_permitido_brl.value");
  const type = structuredClone(data);
  type.items.tipo_negocio = { value: "banca", status: "informado" };
  assert.throws(() => validateContract(type), (error) => error.details.path === "items.tipo_negocio.value");
  const filled = structuredClone(data);
  filled.items.tipo_negocio = { value: "saas", status: "informado" };
  assert.equal(validateContract(filled).questions.find((question) => question.key === "arbitro").suggestion.includes("contas pagas"), true);
});

// ---------------------------------------------------------------- verdicts

test("verdicts: the six ads of the fixture get escalar, iterar (gancho), iterar (página), cortar and two dado insuficiente, ranked by spend", () => {
  const table = judgeTable(metaPt(), { event: "lead", allowable: 40, rules: RULES });
  const by = Object.fromEntries(table.rows.map((row) => [row.name, row]));
  assert.deepEqual(table.rows.map((row) => row.name), ["AL-BF26-presenca-cena-01", "AL-BF26-tempo-pergunta-02", "AL-BF26-presenca-contraste-05", "AL-BF26-economia-numero-03", "Anuncio antigo do perfil", "AL-BF26-confianca-confissao-04"]);
  assert.equal(by["AL-BF26-presenca-cena-01"].verdict, "escalar");
  assert.equal(by["AL-BF26-presenca-cena-01"].certainty, "confirmado");
  assert.equal(by["AL-BF26-tempo-pergunta-02"].verdict, "iterar");
  assert.equal(by["AL-BF26-tempo-pergunta-02"].where_it_fails, "gancho");
  assert.equal(by["AL-BF26-presenca-contraste-05"].verdict, "iterar");
  assert.equal(by["AL-BF26-presenca-contraste-05"].where_it_fails, "pagina");
  assert.equal(by["AL-BF26-economia-numero-03"].verdict, "cortar");
  assert.equal(by["AL-BF26-economia-numero-03"].certainty, "provavel");
  assert.equal(by["AL-BF26-confianca-confissao-04"].verdict, "dado_insuficiente");
  assert.equal(by["Anuncio antigo do perfil"].verdict, "dado_insuficiente");
  assert.deepEqual(table.counts, { escalar: 1, manter: 0, iterar: 2, cortar: 1, negativar: 0, dado_insuficiente: 2 });
  assert.equal(table.median_visit_to_result_pct, 2.83, "the median of the six visit-to-result rates, the zero included");
  assert.ok(table.rows.filter((row) => row.certainty === "confirmado").every((row) => row.legible.cost), "confirmado only with the sample");
});

test("verdicts: one synthetic table per verdict word, and a piece below the minimum sample is always dado insuficiente", () => {
  const row = (over) => ({ name: "x", spend: 0, impressions: 0, link_clicks: 0, landing_page_views: 0, video_plays_3s: 0, thruplays: 0, results: 0, ...over });
  const opts = { source: "meta", level: "ad", event: "lead", fields: ["ad_name", "spend", "impressions", "link_clicks", "landing_page_views", "video_plays_3s", "thruplays", "results"], allowable: 40, rules: RULES, medianConversion: 3 };
  assert.equal(judgeRow(row({ spend: 1500, impressions: 60000, link_clicks: 900, landing_page_views: 800, video_plays_3s: 18000, results: 32 }), opts).verdict, "manter");
  const near = judgeRow(row({ spend: 560, impressions: 20000, link_clicks: 300, landing_page_views: 250, video_plays_3s: 6000, results: 12 }), opts);
  assert.equal(near.verdict, "manter");
  assert.equal(near.certainty, "provavel");
  assert.ok(near.readings, "a near-threshold call shows both readings");
  assert.match(near.readings.hold, /incerteza é de cerca de/);
  assert.equal(judgeRow(row({ spend: 900, impressions: 40000, link_clicks: 600, landing_page_views: 500, video_plays_3s: 12000, results: 10 }), opts).verdict, "cortar", "R$ 90 per result, 2.25 times, after 22 times the allowable");
  assert.equal(judgeRow(row({ spend: 125, impressions: 6000, link_clicks: 20, landing_page_views: 15, video_plays_3s: 1800, results: 0 }), opts).verdict, "cortar", "zero results after 3 times");
  assert.equal(judgeRow(row({ spend: 200, impressions: 8000, link_clicks: 30, landing_page_views: 25, video_plays_3s: 1000, results: 3 }), opts).verdict, "iterar", "hook below the floor");
  for (const tiny of [row({ spend: 30, impressions: 500, link_clicks: 10, landing_page_views: 8, video_plays_3s: 200, results: 2 }), row({ spend: 39, impressions: 1200, link_clicks: 40, landing_page_views: 30, video_plays_3s: 400, results: 1 })]) {
    assert.equal(judgeRow(tiny, opts).verdict, "dado_insuficiente");
    assert.notEqual(judgeRow(tiny, opts).certainty, "confirmado");
  }
  const noAllowable = judgeRow(row({ spend: 1500, impressions: 60000, link_clicks: 900, landing_page_views: 800, video_plays_3s: 18000, results: 32 }), { ...opts, allowable: null });
  assert.equal(noAllowable.verdict, "dado_insuficiente");
  assert.match(noAllowable.reasons[0], /sem o custo permitido/);
  const terms = judgeTable(google(), { allowable: 40, rules: RULES });
  assert.equal(terms.rows.find((item) => item.name === "curso de nutrição gratis").verdict, "negativar");
  assert.equal(terms.counts.negativar, 1);
  assert.equal(times(3.75), "3,75 vezes");
  assert.equal(times(1), "1 vez");
});

// ---------------------------------------------------------------- moves

test("moves: the judged table proposes a raise, two new versions, a pause and holds; applying a move on a Wednesday makes it readable 14 days later", () => {
  const table = { ...judgeTable(metaPt(), { event: "lead", allowable: 40, rules: RULES }), level: "ad" };
  const { moves, proposed } = proposeMoves(emptyMoves(), table, { today: "2026-11-13", rules: RULES, allowable: 40, reading: "meta-testes", claimRatio: 1.3 });
  assert.deepEqual(proposed.map((move) => move.tipo), ["subir_verba", "nova_versao", "nova_versao", "pausar", "segurar", "segurar"]);
  assert.equal(proposed[0].objeto, "AL-BF26-frio-amplo", "the raise goes to the ad set");
  assert.equal(proposed[0].id, "M1");
  assert.ok(proposed.every((move) => move.porque && move.certeza && move.conferir_em));
  const again = proposeMoves({ version: 1, moves }, table, { today: "2026-11-14", rules: RULES, allowable: 40, reading: "meta-testes" });
  assert.equal(again.proposed.length, 0, "open moves are not proposed twice");
  const tracking = proposeMoves(emptyMoves(), table, { today: "2026-11-13", rules: RULES, allowable: 40, claimRatio: 1.8 });
  assert.ok(tracking.proposed.some((move) => move.tipo === "conferir_rastreamento"));
  const store = { version: 1, moves };
  const applied = applyMove(store, "M1", "2026-11-18", RULES);
  assert.equal(applied.legivel_em, "2026-12-02");
  assert.equal(applyMove(store, "M99", "2026-11-18", RULES), null);
});

test("moves: too early before the readable date, cannot tell on a collision or without readings, worked with before and after windows", () => {
  const rowFor = (name, spend, results) => ({ name, adset: "AL-BF26-frio-amplo", metrics: { spend, results, cost_per_result_brl: results ? spend / results : null, link_ctr_pct: 1.5 } });
  const store = { version: 1, moves: [{ id: "M1", tipo: "subir_verba", objeto: "AL-BF26-frio-amplo", nivel: "adset", texto: "Subir a verba.", proposto_em: "2026-11-13", aplicado_em: "2026-11-14", legivel_em: "2026-11-28", veredito: null }] };
  const early = judgeMoves(structuredClone(store), [], { today: "2026-11-20", rules: RULES, allowable: 40 });
  assert.equal(early[0].verdict, "cedo");
  assert.match(early[0].text, /28\/11/);
  const noReadings = judgeMoves(structuredClone(store), [], { today: "2026-11-29", rules: RULES, allowable: 40 });
  assert.equal(noReadings[0].verdict, "nao_da_para_dizer");
  const collided = structuredClone(store);
  collided.moves.push({ id: "M2", tipo: "pausar", objeto: "AL-BF26-frio-amplo", nivel: "adset", texto: "Pausar.", proposto_em: "2026-11-13", aplicado_em: "2026-11-20", legivel_em: "2026-12-04", veredito: null });
  assert.equal(judgeMoves(collided, [], { today: "2026-11-29", rules: RULES, allowable: 40 })[0].verdict, "nao_da_para_dizer");
  const readings = [
    { id: "antes", source: "meta", period: { start: "2026-11-06", end: "2026-11-12" }, rows: [rowFor("AL-BF26-presenca-cena-01", 280, 14)] },
    { id: "depois", source: "meta", period: { start: "2026-11-18", end: "2026-11-24" }, rows: [rowFor("AL-BF26-presenca-cena-01", 490, 28)] },
  ];
  const worked = judgeMoves(structuredClone(store), readings, { today: "2026-11-29", rules: RULES, allowable: 40 });
  assert.equal(worked[0].verdict, "funcionou");
  assert.match(worked[0].text, /de 2 para 4 resultados por dia/);
  const flat = structuredClone(readings);
  flat[1].rows = [rowFor("AL-BF26-presenca-cena-01", 490, 7)];
  assert.equal(judgeMoves(structuredClone(store), flat, { today: "2026-11-29", rules: RULES, allowable: 40 })[0].verdict, "nao_funcionou");
});

// ---------------------------------------------------------------- documents

test("documents: the reading, the weekly read and the tracking plan follow the copy rules and the weekly summary fits 150 words", () => {
  const normalized = metaPt();
  const table = { ...judgeTable(normalized, { event: "lead", allowable: 40, rules: RULES }), source: "meta", level: "ad", rules_label: RULES.sample.label };
  const reading = renderReading({ id: "meta-testes", normalized, table, allowableSource: "contrato", unmatched: ["Anuncio antigo do perfil"] });
  for (const heading of ["## Por peça, em ordem de gasto", "## Por que cada veredito", "## Não casaram com a entrega", "## Regras usadas"]) assert.ok(reading.includes(heading), heading);
  assert.ok(!/[–—!]/.test(reading));
  assert.match(reading, /3,75 vezes/);
  const ledger = summarize(readLedger(read("origens-12.csv")), { claimedPurchases: 13 });
  const { proposed } = proposeMoves(emptyMoves(), table, { today: "2026-11-13", rules: RULES, allowable: 40, reading: "meta-testes" });
  const weekly = renderWeekly({ today: "2026-11-13", contract: { goal: "30 assinaturas." }, plan: { plan: "black-friday-2026", version: 1, state: "aprovado" }, metaReading: { id: "meta-testes", normalized, table, allowable: 40 }, googleReading: null, ledger, claimRatio: 1.3, moveLines: [], proposed, openMoves: [], coverage: [{ label: "E-mail", measured: false, send: "o relatório de envios" }], notChecked: ["E-mail: usado, não medido (mande o relatório de envios)."] });
  assert.ok(weekly.in_short_words <= 150, `${weekly.in_short_words} words`);
  assert.equal(weekly.findings.length, 3);
  for (const heading of ["## Em resumo", "## Decisões para você", "### Desde a última vez", "### Encanamento", "### A verdade do negócio", "## O que fazer nesta semana", "## O que não vamos fazer", "## O que não conseguimos conferir", "## Fontes"]) assert.ok(weekly.markdown.includes(heading), heading);
  assert.match(weekly.markdown, /Certeza: confirmado/);
  assert.match(weekly.markdown, /Não medido: E-mail\./);
  assert.ok(!/undefined|\[object/.test(weekly.markdown));
  assert.ok(!/[–—!]/.test(weekly.markdown));
  assert.equal(words("um dois  três\n quatro"), 4);
  const contract = contractTemplate({ plan: "black-friday-2026", planData: PLAN, today: "2026-10-23" });
  const tracking = renderTracking({ contract, plan: { plan: "black-friday-2026" }, utmRule: PLAN.tracking.utm_rule });
  assert.match(tracking, /## Deduplicação/);
  assert.match(tracking, /A Busca do Google mede com a tag do Google Ads/);
  assert.ok(!/[–—!]/.test(tracking));
});
