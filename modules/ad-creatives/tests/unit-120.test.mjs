// Criativos para anúncios 1.2.0, the pure pieces: the briefing filled from the plan (with the
// origin of each field), the creative matrix, the Google Search text ads and the landing page
// audit. No process, no Motor.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { briefingTemplate, checkBriefing } from "../scripts/lib/campaign.mjs";
import { ANGLES, checkMatrix, FORMATS, matrixFromConcepts, matrixMarkdown, PIECES } from "../scripts/lib/matrix.mjs";
import { auditPage, pageBriefMarkdown } from "../scripts/lib/page.mjs";
import { applyPlanToBriefing, briefFromPlan, phaseFor } from "../scripts/lib/plan.mjs";
import { checkSearch, searchMarkdown } from "../scripts/lib/search.mjs";
import { concepts as conceptsFixture } from "./fixtures/campanha.mjs";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = join(APP_DIR, "tests", "fixtures");
const json = (name) => JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));
const LABELS = JSON.parse(readFileSync(join(APP_DIR, "references", "etiquetas.json"), "utf8"));
const GOOGLE = JSON.parse(readFileSync(join(APP_DIR, "references", "google-busca.json"), "utf8"));
const plan = () => ({ slug: "black-friday-2026", file: join("media-plan", "black-friday-2026", "plano.json"), data: json("plano.json") });

/** The concepts of the fixture as checkConcepts would hand them on (names included). */
function fixtureConcepts() {
  return conceptsFixture().concepts.map((concept) => ({ ...concept, ad_name: `${concept.angle}-reels-${concept.hook.tag}-v1` }));
}

// ---------------------------------------------------------------- the plan in the briefing

test("briefFromPlan takes eleven fields from the approved plan, each marked plano, and the budget is the phase's daily amount", () => {
  const { fields, sources, plan: info } = briefFromPlan(plan(), { today: "2026-11-02" });
  assert.ok(Object.keys(fields).length >= 9, `${Object.keys(fields).length} fields`);
  assert.ok(Object.values(sources).every((source) => source === "plano"));
  assert.equal(fields.marca, "Prontuário Lótus");
  assert.equal(fields.oferta, "anual pelo preço de 10 meses, parcelado, com a migração dos dados incluída");
  assert.equal(fields.preco, "R$ 1.990 por ano");
  assert.equal(fields.pagina, "https://www.prontuariolotus.com.br/assinar");
  assert.equal(fields.evento, "Lead");
  assert.equal(fields.verba, "R$ 101", "the daily amount of the phase that holds today, nothing else on the line");
  assert.equal(fields.custo_evento, "R$ 238,80", "a lead event takes the allowable cost per lead");
  assert.match(fields.datas, /testes de 30\/10 a 12\/11/);
  assert.match(fields.parametros_url, /^utm_source=/);
  assert.equal(info.plan, "black-friday-2026");
  assert.equal(phaseFor(plan().data, "2026-11-25").phase, "aquecimento");
  assert.equal(phaseFor(plan().data, "2026-10-01").phase, "testes", "before the paid phases, the first one");
  assert.deepEqual(briefFromPlan(null, { today: "2026-11-02" }), { fields: {}, sources: {}, plan: null });
});

test("applyPlanToBriefing fills only the empty lines, keeps what the member wrote and parses back without problems", () => {
  const { fields } = briefFromPlan(plan(), { today: "2026-11-02" });
  const template = briefingTemplate("lotus").replace("- Botão (Saiba mais, Assinar, Comprar agora…):", "- Botão (Saiba mais, Assinar, Comprar agora…): Assinar").replace("- Marca (o nome, como aparece no anúncio):", "- Marca (o nome, como aparece no anúncio): Lótus");
  const { text, filled } = applyPlanToBriefing(template, fields);
  assert.ok(filled.length >= 9, filled.join(","));
  assert.ok(!filled.includes("marca"), "a line the member filled is not overwritten");
  assert.match(text, /- Marca \(o nome, como aparece no anúncio\): Lótus/);
  assert.match(text, /- Verba diária \(em reais\): R\$ 101/);
  assert.match(text, /- Datas \(as fases da campanha, do plano quando houver\): preparacao de 23\/10/);
  const checked = checkBriefing(text);
  assert.deepEqual(checked.problems, []);
  assert.equal(checked.brief.verba_diaria, 101);
  assert.equal(checked.brief.custo_por_evento, 238.8);
  assert.equal(checked.brief.pagina, "https://www.prontuariolotus.com.br/assinar");
  const older = briefingTemplate("lotus").split("\n").filter((line) => !line.startsWith("- Datas")).join("\n");
  const again = applyPlanToBriefing(older, fields);
  assert.match(again.text, /- Datas: preparacao/, "a briefing from an older version gets the line added under Campanha");
});

// ---------------------------------------------------------------- the matrix

test("matrix: the fixture passes with four angles and ten pieces, one of them to be recorded", () => {
  const checked = checkMatrix(json("matriz.json"), { labels: LABELS });
  assert.equal(checked.counts.angles, 4);
  assert.equal(checked.counts.pieces, 10);
  assert.equal(checked.counts.needs_recording, 1);
  assert.equal(checked.pieces.find((piece) => piece.format === "fundador").needs_recording, true);
  assert.equal(checked.pieces.find((piece) => piece.format === "reels").needs_recording, false);
  assert.ok(checked.warnings.some((warning) => /pedem gravação/.test(warning)));
  const markdown = matrixMarkdown(checked, { campaign: "lotus" });
  assert.match(markdown, /4 ângulos, 10 peças/);
  assert.match(markdown, /1 \(gravar\)/);
  assert.ok(!/[–—!]/.test(markdown));
  assert.deepEqual([ANGLES.min, ANGLES.max, PIECES.min, PIECES.max], [3, 4, 8, 12]);
  assert.equal(Object.keys(FORMATS).length, 6);
});

test("matrix: seven pieces are refused, two angles that differ in one dimension only are refused, and the three concepts are the minimum case", () => {
  const thin = json("matriz.json");
  thin.pieces = thin.pieces.slice(0, 7);
  assert.throws(() => checkMatrix(thin, { labels: LABELS }), (error) => error.code === "matrix_invalid" && error.details.path === "pieces");
  const close = json("matriz.json");
  close.angles[1] = { ...close.angles[0], key: "memoria-b", hook_family: "cena" };
  assert.throws(() => checkMatrix(close, { labels: LABELS }), (error) => error.code === "matrix_invalid" && error.details.path === "angles[1]" && /diferem só em hook_family/.test(error.message));
  const two = json("matriz.json");
  two.angles = two.angles.slice(0, 2);
  two.pieces = two.pieces.filter((piece) => ["memoria", "confianca"].includes(piece.angle));
  assert.throws(() => checkMatrix(two, { labels: LABELS }), (error) => error.details.path === "angles");
  const badFormat = json("matriz.json");
  badFormat.pieces[0].format = "stories";
  assert.throws(() => checkMatrix(badFormat, { labels: LABELS }), (error) => error.details.path === "pieces[0].format");
  const derived = matrixFromConcepts(fixtureConcepts(), LABELS);
  const checked = checkMatrix(derived, { labels: LABELS });
  assert.equal(checked.counts.angles, 3);
  assert.equal(checked.counts.pieces, 9);
  assert.equal(checked.counts.needs_recording, 0);
});

// ---------------------------------------------------------------- the Search

test("search: the fixture passes with two campaigns; a 31-character headline, an exclamation mark, a promise and a bad pin are refused", () => {
  const ok = checkSearch(json("busca.json"), { limits: GOOGLE, terms: ["diagnóstico", "cura garantida"] });
  assert.equal(ok.passed, true, JSON.stringify(ok.problems));
  assert.equal(ok.counts.campaigns, 2);
  assert.equal(ok.counts.headlines, 20);
  assert.ok(ok.warnings.every((warning) => warning.rule !== "no_brand_campaign"));
  const markdown = searchMarkdown(ok, { campaign: "lotus" });
  assert.match(markdown, /\| Prontuário Lótus \| 16 \| 1 \|/);
  assert.ok(!/[–—!]/.test(markdown));

  const long = json("busca.json");
  long.campaigns[0].ad_groups[0].ads[0].headlines[1] = "Prontuário para acupunturistas x";
  const refused = checkSearch(long, { limits: GOOGLE });
  assert.equal(refused.passed, false);
  assert.ok(refused.problems.some((problem) => problem.rule === "too_long" && problem.path.endsWith("headlines[1]")));

  const bang = json("busca.json");
  bang.campaigns[0].ad_groups[0].ads[0].headlines[2] = "Comece hoje mesmo!";
  assert.ok(checkSearch(bang, { limits: GOOGLE }).problems.some((problem) => problem.rule === "exclamation"));

  const promise = json("busca.json");
  promise.campaigns[0].ad_groups[0].ads[0].descriptions[1] = "Dobre suas vendas em 30 dias com o prontuário certo.";
  assert.ok(checkSearch(promise, { limits: GOOGLE }).problems.some((problem) => problem.rule === "grow_sales"));

  const forbidden = json("busca.json");
  forbidden.campaigns[0].ad_groups[0].ads[0].headlines[3] = "Diagnóstico pela IA";
  assert.ok(checkSearch(forbidden, { limits: GOOGLE, terms: ["diagnóstico"] }).problems.some((problem) => problem.rule === "forbidden_term"));

  const pin = json("busca.json");
  pin.campaigns[0].ad_groups[0].ads[0].headlines[0] = { text: "Prontuário Lótus", pin: 4 };
  assert.ok(checkSearch(pin, { limits: GOOGLE }).problems.some((problem) => problem.rule === "pin_position"));

  const few = json("busca.json");
  few.campaigns[0].ad_groups[0].ads[0].headlines = few.campaigns[0].ad_groups[0].ads[0].headlines.slice(0, 2);
  assert.ok(checkSearch(few, { limits: GOOGLE }).problems.some((problem) => problem.rule === "headline_count"));
  assert.throws(() => checkSearch({ version: 1, campaigns: [{ name: "x", kind: "loja", ad_groups: [] }] }, { limits: GOOGLE }), (error) => error.code === "search_invalid" && error.details.path === "campaigns[0].kind");
});

// ---------------------------------------------------------------- the page

test("page audit: the capture fixture confirms the call above the fold, the words in common, the price, the deadline and the legal lines, and leaves the UTM unchecked", () => {
  const audit = auditPage({ capture: json("captura.json"), brief: { preco: "R$ 1.990 por ano" }, concepts: fixtureConcepts(), plan: plan().data });
  const by = Object.fromEntries(audit.items.map((item) => [item.id, item.status]));
  assert.equal(by.chamado_acima_da_dobra, "ok");
  assert.equal(by.titulo_em_comum_memoria, "ok", "contou is in both");
  assert.equal(by.precos, "ok");
  assert.equal(by.prazo, "ok");
  assert.equal(by.arrependimento_7_dias, "ok");
  assert.equal(by.politica_de_privacidade, "ok");
  assert.equal(by.cookies, "ok");
  assert.equal(by.preco_de_referencia, "ok");
  assert.equal(by.utm_preservada, "nao_conferido");
  assert.equal(audit.counts.nao_conferido, 1);
  assert.match(audit.say, /não deu para conferir pela captura/);
  assert.ok(!/[–—!]/.test(JSON.stringify(audit.items.map((item) => item.text))));
});

test("page audit: a capture without text or positions says nao_conferido, never a failure; a different price and a missing deadline ask for attention", () => {
  const bare = auditPage({ capture: { brand: {}, raw: {} }, brief: {}, concepts: [], plan: plan().data });
  assert.ok(bare.items.every((item) => item.status === "nao_conferido"), JSON.stringify(bare.items.map((item) => [item.id, item.status])));
  const off = json("captura.json");
  off.brand.prices = [{ text: "R$ 2.490", value: 2490 }];
  off.raw.text_excerpt = "Assine o prontuário até 30/11. Política de privacidade.";
  const audit = auditPage({ capture: off, brief: {}, concepts: fixtureConcepts(), plan: plan().data });
  const by = Object.fromEntries(audit.items.map((item) => [item.id, item.status]));
  assert.equal(by.precos, "atencao");
  assert.equal(by.prazo, "atencao", "the page says 30/11, the plan ends 27/11");
  assert.equal(by.arrependimento_7_dias, "atencao");
  assert.ok(audit.counts.atencao >= 3);
  const far = json("captura.json");
  far.raw.cta = [{ text: "Assinar", y: 1500 }];
  assert.equal(auditPage({ capture: far, brief: {}, concepts: [], plan: null }).items.find((item) => item.id === "chamado_acima_da_dobra").status, "atencao");
});

test("page brief: the markdown carries the continuity per concept, the plan's price and deadline, and marks what is still to decide", () => {
  const markdown = pageBriefMarkdown({ campaign: "lotus", brief: { botao: "Assinar", termos: ["diagnóstico"], le_nome: true, padrao: "<angulo>-<formato>-<gancho>-v<n>", angulos_site: ["memoria", "confianca"] }, concepts: fixtureConcepts(), plan: plan().data, planPage: "media-plan/black-friday-2026/pagina.md", generatedAt: "2026-10-29T12:00:00.000Z" });
  assert.match(markdown, /Ângulo memoria \(anúncio memoria-reels-lembra-v1\)/);
  assert.match(markdown, /Preço de referência verdadeiro: R\$ 1\.990; a oferta "Anual pelo preço de 10 meses, parcelado" a R\$ 1\.658,33/);
  assert.match(markdown, /até 27\/11\/2026, com a hora/);
  assert.match(markdown, /O que não pode ser dito: diagnóstico/);
  assert.match(markdown, /media-plan\/black-friday-2026\/pagina\.md/);
  assert.ok((markdown.match(/\[a decidir\]/g) ?? []).length >= 5);
  assert.ok(!/[–—!]/.test(markdown));
});
