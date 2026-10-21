// Criativos para anúncios, the pure pieces: the budget math (D10), the briefing, the evidence
// readings and their thresholds (D12), the concepts with the computed confidence (D11) and the
// ad names (D21), the check of the ad text and the page templates. No process, no Motor.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { acceptSummary } from "../scripts/ads.mjs";
import { brl, learningBudget, LEARNING } from "../scripts/lib/budget.mjs";
import { briefingTemplate, checkBriefing, DEFAULT_NAME_PATTERN, normalizePattern, parseBriefing, parseMoney } from "../scripts/lib/campaign.mjs";
import { adName, checkConcepts, confidenceOf } from "../scripts/lib/concepts.mjs";
import { checkCopy, forbiddenIn, personalIn, promiseIn } from "../scripts/lib/copy.mjs";
import { adCardsToItems, applyTags, datesIn, declaredToItems, mergeItems, parseCount, parseMetric, parseRunDates, parseVariations, readEvidence, summarize } from "../scripts/lib/evidence.mjs";
import { campaignLinks, competitorLink, keywordUrl } from "../scripts/lib/links.mjs";
import { beatGrid, checkPiece, checkPoster, draftPiece, eventsOf, listParts, pageHtml, paletteFrom, contrast, posterOf, screenTexts, sentences } from "../scripts/lib/pieces.mjs";
import { BRIEFING, COLLECTED_AT, concepts as conceptsFixture, READING_AGENDA, READING_DECLARED, READING_NORTE, TAGS } from "./fixtures/campanha.mjs";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LABELS = JSON.parse(readFileSync(join(APP_DIR, "references", "etiquetas.json"), "utf8"));
const META = JSON.parse(readFileSync(join(APP_DIR, "references", "meta-anuncios.json"), "utf8"));
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

/** A campaign folder with the screenshots the fixture readings cite. */
function scratchCampaign() {
  const root = mkdtempSync(join(tmpdir(), "anuncios-unit-"));
  const dir = join(root, "anuncios", "lotus-rodada-0");
  for (const reading of [READING_NORTE, READING_AGENDA]) {
    for (const item of reading.items) {
      mkdirSync(dirname(join(dir, item.capture)), { recursive: true });
      writeFileSync(join(dir, item.capture), PNG);
    }
  }
  mkdirSync(join(dir, "materiais"), { recursive: true });
  return { root, dir };
}

function evidenceFor(project) {
  const evidence = readEvidence(join(project.dir, "evidencias.json"), "lotus-rodada-0");
  const options = { root: project.root, campaignDir: project.dir, labels: LABELS, today: "2026-10-21" };
  mergeItems(evidence, adCardsToItems(READING_NORTE, { ...options, file: "pesquisa/leituras/norte.json" }));
  mergeItems(evidence, adCardsToItems(READING_AGENDA, { ...options, file: "pesquisa/leituras/agenda.json" }));
  mergeItems(evidence, declaredToItems(READING_DECLARED, { ...options, file: "pesquisa/leituras/dito.json" }));
  return { evidence, options };
}

const brief = () => checkBriefing(BRIEFING).brief;

describe("budget (D10)", () => {
  test("R$ 45 per event and R$ 500 a day: a floor of R$ 322 per set and 1 set", () => {
    const result = learningBudget({ daily: 500, cost: 45, event: "compra" });
    assert.equal(result.floor_per_set, 322);
    assert.equal(result.sets, 1);
    assert.equal(result.viable, true);
    assert.deepEqual(result.exits, []);
    assert.deepEqual([LEARNING.events, LEARNING.days], [50, 7]);
  });

  test("R$ 200 a day: not viable, with the three ways out", () => {
    const result = learningBudget({ daily: 200, cost: 45, event: "compra" });
    assert.equal(result.viable, false);
    assert.equal(result.sets, 0);
    assert.deepEqual(result.exits.map((exit) => exit.id), ["earlier_event", "more_budget", "start_anyway"]);
    assert.match(result.exits[1].text, /R\$ 322 por dia/);
    assert.match(result.say, /aprendizado limitado/);
  });

  test("without the cost per event: the most an event can cost, and a question", () => {
    const result = learningBudget({ daily: 50, event: "compra" });
    assert.equal(result.viable, null);
    assert.equal(result.max_cost_per_event, 7);
    assert.match(result.say, /até R\$ 7/);
    assert.ok(result.ask);
  });

  test("money in pt-BR", () => {
    assert.equal(brl(1500), "R$ 1.500");
    assert.equal(brl(321.43), "R$ 321,43");
    assert.deepEqual(["R$ 50", "R$ 1.500,00", "50 reais", "45,90", "1.500", "R$50 por dia", "abc", ""].map(parseMoney), [50, 1500, 50, 45.9, 1500, 50, null, null]);
  });
});

describe("briefing", () => {
  test("the template parses with every required field missing", () => {
    const result = checkBriefing(briefingTemplate("teste"));
    assert.equal(result.complete, false);
    assert.deepEqual(result.missing.map((entry) => entry.field).sort(), ["concorrentes", "evento", "marca", "nome_lido", "oferta", "pagina", "produto", "publico", "termos_proibidos", "verba"].sort());
    for (const entry of result.missing) assert.ok(entry.question.endsWith("?") || entry.question.endsWith("."), entry.field);
  });

  test("a filled briefing is complete and read the way the script uses it", () => {
    const result = checkBriefing(BRIEFING);
    assert.equal(result.complete, true, JSON.stringify(result.missing.concat(result.problems)));
    assert.equal(result.brief.verba_diaria, 50);
    assert.equal(result.brief.custo_por_evento, null);
    assert.equal(result.brief.le_nome, true);
    assert.equal(result.brief.padrao, "<angulo>-<formato>-<gancho>-v<n>");
    assert.deepEqual(result.brief.angulos_site, ["presenca", "memoria", "confianca", "mtc"]);
    assert.deepEqual(result.brief.termos, ["diagnóstico", "cura garantida"]);
    assert.equal(result.brief.pais, "BR");
  });

  test("a site that reads the name needs the pattern; a site that does not gets the app's", () => {
    const withoutPattern = checkBriefing(BRIEFING.replace(/- Padrão do nome:.*\n/, "- Padrão do nome:\n"));
    assert.ok(withoutPattern.missing.some((entry) => entry.field === "padrao_nome"));
    const notRead = checkBriefing(BRIEFING.replace("lê o nome do anúncio: sim", "lê o nome do anúncio: não"));
    assert.equal(notRead.brief.padrao, DEFAULT_NAME_PATTERN);
    assert.equal(normalizePattern("<Ângulo>-<formato>-v<n>").pattern, "<angulo>-<formato>-v<n>");
    assert.equal(normalizePattern("<publico>-v<n>").ok, false);
    assert.ok(parseBriefing("- Termos proibidos: nenhum").fields.termos_proibidos);
    assert.deepEqual(checkBriefing(BRIEFING.replace("diagnóstico, cura garantida", "nenhum")).brief.termos, []);
  });

  test("a value that cannot be read is a problem, not a guess", () => {
    const result = checkBriefing(BRIEFING.replace("- Verba diária: R$ 50", "- Verba diária: uns cinquenta"));
    assert.ok(result.problems.some((problem) => problem.field === "verba"));
    assert.equal(result.complete, false);
  });
});

describe("evidence (D12)", () => {
  test("dates and numbers as the Ad Library and Instagram write them", () => {
    assert.deepEqual(parseRunDates("Veiculação iniciada em 3 de jul de 2026"), { start: "2026-07-03", end: null });
    assert.deepEqual(parseRunDates("Started running on Jul 3, 2026"), { start: "2026-07-03", end: null });
    assert.deepEqual(parseRunDates("Veiculado de 3 de jul de 2026 a 10 de ago de 2026"), { start: "2026-07-03", end: "2026-08-10" });
    assert.deepEqual(parseRunDates("Veiculação iniciada em 03/07/2026"), { start: "2026-07-03", end: null });
    assert.equal(parseRunDates("Veiculação iniciada em 3 de jul"), null, "without the year there is no date");
    assert.deepEqual(datesIn("31 de fev de 2026"), [], "an impossible day is not a date");
    assert.equal(parseVariations("3 anúncios usam esse criativo e esse texto"), 3);
    assert.equal(parseVariations("2 ads use this creative and text"), 2);
    assert.equal(parseVariations("Este anúncio tem várias versões"), null);
    assert.deepEqual(["12,3 mil", "1,2 mi", "4.512", "1.2K", "59", "abc"].map(parseCount), [12300, 1200000, 4512, 1200, 59, null]);
  });

  test("a test Reels' statistics as Instagram shows them, durations in seconds", () => {
    const read = ["1.204", "1,2%", "R$ 45,90", "12,3 mil", "6 s", "6s", "6,4 s", "8 seg", "0:06", "1:05", "1 min 5 s", "1h 2min", "5x", "10:7"].map(parseMetric);
    assert.deepEqual(read, [1204, 1.2, 45.9, 12300, 6, 6, 6.4, 8, 6, 65, 65, 3720, null, null]);
  });

  test("a card's start becomes started_at and days_active, counted to collected_at", () => {
    const project = scratchCampaign();
    const { evidence } = evidenceFor(project);
    const first = evidence.items.find((item) => item.id === "ad-clinica-norte-digital-2003332460391183");
    assert.equal(first.data.started_at, "2026-05-07");
    assert.equal(first.data.days_active, 158);
    assert.equal(first.data.variations, 3);
    assert.equal(first.data.active, true);
    assert.equal(first.source.type, "screenshot");
    assert.equal(first.source.collected_at, COLLECTED_AT);
    assert.equal(first.source.ref, "anuncios/lotus-rodada-0/pesquisa/capturas/clinica-norte-digital/01.png");
    assert.equal(evidence.items.find((item) => item.id === "ad-clinica-norte-digital-20261012-c02").data.variations, 1, "no versions line is one ad");
  });

  test("a card without its screenshot is refused, with the path of the field", () => {
    const project = scratchCampaign();
    const reading = structuredClone(READING_NORTE);
    reading.items[1].capture = "pesquisa/capturas/clinica-norte-digital/99.png";
    assert.throws(() => adCardsToItems(reading, { root: project.root, campaignDir: project.dir, labels: LABELS, today: "2026-10-21", file: "x.json" }), (error) => error.code === "reading_invalid" && /items\[1\]\.capture/.test(error.message));
    delete reading.items[1].capture;
    reading.source.ref = "pesquisa/capturas/nao-existe/";
    assert.throws(() => adCardsToItems(reading, { root: project.root, campaignDir: project.dir, labels: LABELS, today: "2026-10-21", file: "x.json" }), /items\[1\]\.capture/);
  });

  test("a date the script does not understand is refused, never guessed", () => {
    const project = scratchCampaign();
    const reading = structuredClone(READING_NORTE);
    reading.items[0].started_text = "Veiculação iniciada há três meses";
    assert.throws(() => adCardsToItems(reading, { root: project.root, campaignDir: project.dir, labels: LABELS, today: "2026-10-21", file: "x.json" }), (error) => error.code === "reading_invalid" && /items\[0\]\.started_text/.test(error.message));
    const future = structuredClone(READING_NORTE);
    future.collected_at = "2027-01-01";
    assert.throws(() => adCardsToItems(future, { root: project.root, campaignDir: project.dir, labels: LABELS, today: "2026-10-21", file: "x.json" }), /collected_at/);
  });

  test("a tag outside the app's lists is refused", () => {
    const project = scratchCampaign();
    const reading = structuredClone(READING_NORTE);
    reading.items[0].tags = { hook_family: "polemica" };
    assert.throws(() => adCardsToItems(reading, { root: project.root, campaignDir: project.dir, labels: LABELS, today: "2026-10-21", file: "x.json" }), /items\[0\]\.tags\.hook_family/);
  });

  test("the summary: ordered by time running, kept ads, patterns in two competitors, indications", () => {
    const project = scratchCampaign();
    const { evidence, options } = evidenceFor(project);
    const summary = summarize(evidence, { labels: LABELS });
    const norte = summary.competitors.find((entry) => entry.who === "Clínica Norte Digital");
    const agenda = summary.competitors.find((entry) => entry.who === "Agenda Viva");
    assert.equal(norte.active, 3);
    assert.equal(norte.kept, 1);
    assert.equal(norte.max_days, 158);
    assert.equal(norte.indication, false);
    assert.equal(agenda.active, 2);
    assert.equal(agenda.indication, true, "a competitor with 2 active ads is an indication");
    assert.deepEqual(norte.top.map((ad) => ad.days_active), [158, 14, 2]);
    assert.deepEqual(summary.kept.map((ad) => ad.days_active), [158]);
    assert.deepEqual(summary.patterns.map((pattern) => `${pattern.dimension}:${pattern.value}`).sort(), ["angle:presenca", "hook_family:contraste"]);
    assert.ok(summary.warnings.some((warning) => /Agenda Viva tem só 2/.test(warning)));
    assert.deepEqual(summary.families.sort(), ["anuncio", "organico", "publico"]);
    // tags set later, and an ad taken out of the analysis
    applyTags(TAGS, evidence, { ...options, file: "pesquisa/leituras/etiquetas.json" });
    const after = summarize(evidence, { labels: LABELS });
    assert.equal(after.counts.excluded, 1);
    assert.equal(after.competitors.find((entry) => entry.who === "Agenda Viva").active, 1);
    assert.throws(() => applyTags({ version: 1, kind: "tags", items: [{ id: "ad-nao-existe" }] }, evidence, { ...options, file: "t.json" }), /items\[0\]\.id/);
  });

  test("a reference ad's analysis is linked by its path in the project, never by a path outside it", () => {
    const project = scratchCampaign();
    const { evidence, options } = evidenceFor(project);
    const description = join(project.root, "video-analyses", "abc123", "descriptions", "ad-creatives.md");
    mkdirSync(dirname(description), { recursive: true });
    writeFileSync(description, "# Descrição\n");
    const id = evidence.items.find((item) => item.kind === "competitor_ad").id;
    applyTags({ version: 1, kind: "tags", items: [{ id, analysis: "video-analyses/abc123/descriptions/ad-creatives.md" }] }, evidence, { ...options, file: "t.json" });
    assert.equal(evidence.items.find((item) => item.id === id).data.analysis, "video-analyses/abc123/descriptions/ad-creatives.md");
    for (const path of ["video-analyses/abc123/descriptions/outro.md", "../fora.md"]) {
      assert.throws(() => applyTags({ version: 1, kind: "tags", items: [{ id, analysis: path }] }, evidence, { ...options, file: "t.json" }), (error) => error.code === "reading_invalid" && /items\[0\]\.analysis/.test(error.message));
    }
  });

  test("declared items: the multiplier is computed, the pattern needs n", () => {
    const project = scratchCampaign();
    const { evidence } = evidenceFor(project);
    const post = evidence.items.find((item) => item.id === "org-reels-3-set");
    assert.equal(post.data.plays, 2645);
    assert.equal(post.data.baseline, 59);
    assert.equal(post.data.multiplier, 44.83);
    const broken = structuredClone(READING_DECLARED);
    delete broken.items[2].n;
    assert.throws(() => declaredToItems(broken, { root: project.root, campaignDir: project.dir, labels: LABELS, today: "2026-10-21", file: "d.json" }), /items\[2\]\.n/);
  });
});

describe("concepts (D11, D21)", () => {
  const check = (data, project, extra = {}) => {
    const { evidence } = evidenceFor(project);
    return checkConcepts(data, { evidence, labels: LABELS, brief: brief(), root: project.root, campaignDir: project.dir, ...extra });
  };

  test("confidence by the kinds of source; a written confidence is overwritten", () => {
    const project = scratchCampaign();
    const { concepts, warnings } = check(conceptsFixture(), project);
    assert.deepEqual(concepts.map((concept) => [concept.key, concept.confidence]), [["memoria", "alta"], ["confianca", "baixa"], ["mtc", "aposta"]]);
    assert.deepEqual(concepts[0].confidence_basis.families, ["anuncio", "organico", "publico"]);
    assert.ok(warnings.some((warning) => /mtc: sem evidência, sai como aposta/.test(warning)));
    assert.deepEqual(["aposta", "baixa", "media", "alta", "alta"], [0, 1, 2, 3, 4].map((n) => confidenceOf(Array.from({ length: n }, (_, i) => String(i)))));
  });

  test("the ad names follow the site's pattern and start with the angle", () => {
    const project = scratchCampaign();
    const { concepts } = check(conceptsFixture(), project);
    assert.deepEqual(concepts.map((concept) => concept.ad_name), ["memoria-reels-lembra-v1", "confianca-reels-branco-v1", "mtc-reels-pulso-v1"]);
    assert.equal(adName("<conceito>-<formato>-<gancho>-v<n>", { concept: { key: "a", angle: "b", hook: { tag: "c" } }, placement: "vertical", version: 2 }), "a-reels-c-v2");
  });

  test("without formats, the vertical video, the 4:5 video and the 4:5 image, each file named by its placement", () => {
    const project = scratchCampaign();
    const data = conceptsFixture();
    for (const concept of data.concepts) delete concept.formats;
    const { concepts } = check(data, project);
    assert.deepEqual(concepts[0].formats, ["vertical", "feed", "imagem"]);
    assert.equal(concepts[0].ad_name, "memoria-reels-lembra-v1");
    assert.deepEqual(concepts[0].ad_names, { vertical: "memoria-reels-lembra-v1", feed: "memoria-feed-lembra-v1", imagem: "memoria-imagem-lembra-v1" });
  });

  test("a site pattern without <formato> names the ad once and each piece's file after it", () => {
    const project = scratchCampaign();
    const data = conceptsFixture();
    for (const concept of data.concepts) delete concept.formats;
    const { concepts } = check(data, project, { brief: { ...brief(), padrao: "<angulo>-<gancho>-v<n>" } });
    assert.equal(concepts[0].ad_name, "memoria-lembra-v1");
    assert.deepEqual(concepts[0].ad_names, { vertical: "memoria-lembra-v1", feed: "memoria-lembra-v1-feed", imagem: "memoria-lembra-v1-imagem" });
  });

  test("an id that does not exist is refused with the path of the field", () => {
    const project = scratchCampaign();
    const data = conceptsFixture();
    data.concepts[1].evidence = ["ad-clinica-norte-digital-20261012-c03", "ad-inventado"];
    assert.throws(() => check(data, project), (error) => error.code === "concepts_invalid" && /concepts\[1\]\.evidence\[1\]/.test(error.message));
  });

  test("a testimonial, a before and after or a real person needs the member's file in materiais/", () => {
    const project = scratchCampaign();
    const data = conceptsFixture();
    data.concepts[0].proof = { type: "depoimento", text: "Uma acupunturista conta como usa." };
    assert.throws(() => check(data, project), (error) => error.code === "concepts_invalid" && /concepts\[0\]\.proof\.material/.test(error.message));
    writeFileSync(join(project.dir, "materiais", "depoimento-ana.mp4"), "video");
    data.concepts[0].proof.material = "materiais/depoimento-ana.mp4";
    assert.equal(check(data, project).concepts[0].proof.material, "anuncios/lotus-rodada-0/materiais/depoimento-ana.mp4");
    data.concepts[0].proof.material = "../fora.mp4";
    assert.throws(() => check(data, project), /proof\.material/);
  });

  test("two concepts with the same visual style and the same hook family are refused", () => {
    const project = scratchCampaign();
    const data = conceptsFixture();
    data.concepts[2].visual = "frase-que-some";
    data.concepts[2].hook.family = "pergunta";
    assert.throws(() => check(data, project), (error) => error.code === "concepts_invalid" && /mesmo estilo visual/.test(error.message));
  });

  test("an angle the site does not read is refused; a promise in the card is refused", () => {
    const project = scratchCampaign();
    const data = conceptsFixture();
    data.concepts[0].angle = "economia";
    assert.throws(() => check(data, project), /concepts\[0\]\.angle/);
    const promising = conceptsFixture();
    promising.concepts[1].success_criterion = "Dobrar as vendas no primeiro mês e vender mais.";
    assert.doesNotThrow(() => check(promising, project), "the goal of the test is not a promise to the audience");
    promising.concepts[1].success_criterion = "Resultado garantido na primeira semana.";
    assert.throws(() => check(promising, project), (error) => /concepts\[1\]\.success_criterion/.test(error.message));
    const four = conceptsFixture();
    four.concepts.push({ ...four.concepts[0], key: "quarto" });
    assert.throws(() => check(four, project), /no máximo 3/);
  });
});

describe("copy", () => {
  const concept = (copy) => ({ key: "x", copy, proof: { type: "demonstracao" } });

  test("a promise of result, a forbidden term and a personal attribute block", () => {
    assert.equal(promiseIn("Venda garantida em 7 dias").rule, "guaranteed_result");
    assert.equal(promiseIn("Você vai vender o dobro").rule, "will_sell");
    assert.equal(promiseIn("Aumente suas vendas agora").rule, "grow_sales");
    assert.equal(promiseIn("ROAS de 5x garantido").rule, "return_metric");
    assert.equal(promiseIn("30% mais pacientes no mês").rule, "result_number");
    assert.equal(promiseIn("Garantia de 30 dias ou o seu dinheiro de volta"), null, "a money back guarantee is an offer, not a promise of result");
    assert.equal(personalIn("Você sofre de ansiedade?").rule, "suffers_from");
    assert.equal(personalIn("Suas dívidas não param de crescer?").rule, "your_condition");
    assert.equal(personalIn("Você está acima do peso?").rule, "you_are");
    assert.equal(personalIn("Ela contou no começo da consulta. No fim, você ainda lembrava?"), null);
    assert.equal(forbiddenIn("Faz o DIAGNOSTICO por você", ["diagnóstico"]), "diagnóstico");
    assert.equal(forbiddenIn("diagnósticos", ["diagnóstico"]), null, "whole words only");
    const result = checkCopy(concept({ primary_text: "Você sofre de dor nas costas? Cura garantida.", headline: "Venda garantida", cta: "Assinar" }), { limits: META, terms: ["cura garantida"] });
    assert.equal(result.passed, false);
    assert.deepEqual(result.problems.map((problem) => problem.rule).sort(), ["forbidden_term", "guaranteed_result", "guaranteed_result", "suffers_from"].sort());
  });

  test("lengths and the button only warn, with the cut shown", () => {
    const long = "A".repeat(130);
    const result = checkCopy(concept({ primary_text: long, headline: "Um título bem mais longo que o limite", cta: "Clique já" }), { limits: META });
    assert.equal(result.passed, true);
    assert.deepEqual(result.warnings.map((warning) => warning.rule), ["primary_cut", "reels_cut", "headline_cut", "cta_unknown"]);
    assert.equal(META.text.primary_text.visible_chars, 125);
    assert.equal(META.text.headline.max_chars, 27);
  });

  test("the texts on screen are checked too", () => {
    const result = checkCopy(concept({ primary_text: "Texto", headline: "Título", cta: "Saiba mais" }), { limits: META, screenTexts: ["Você vai faturar mais"] });
    assert.equal(result.passed, false);
    assert.equal(result.problems[0].field, "tela[0]");
  });
});

describe("pieces and their pages", () => {
  const conceptOf = (key) => {
    const data = conceptsFixture().concepts.find((concept) => concept.key === key);
    return { ...data, copy: data.copy };
  };
  const brandOf = () => ({ name: "Prontuário Lótus", logo: null, colors: paletteFrom({ primary: "#177D82", background: "#F6F4EE", text: "#33302B" }), fonts: [] });

  test("each template drafts a piece that passes the check, with the hook in frame 0 and cuts on the beat", () => {
    const dir = mkdtempSync(join(tmpdir(), "peca-"));
    mkdirSync(join(dir, "imagens"));
    writeFileSync(join(dir, "imagens", "tela-1.png"), PNG);
    const image = { src: "imagens/tela-1.png", tall: false };
    for (const [key, template] of [["memoria", "problema-mecanismo"], ["confianca", "produto-em-uso"], ["mtc", "lista"]]) {
      const { piece, todo } = draftPiece({ ...conceptOf(key), template }, { brand: brandOf(), images: [image] });
      const checked = checkPiece(piece, { pieceDir: dir });
      assert.equal(checked.template, template, key);
      assert.equal(checked.duration, 15);
      for (const scene of checked.scenes) assert.equal((scene.from * checked.bpm) / 60 % 0.5, 0, `${key}: cut at ${scene.from}`);
      assert.ok(screenTexts(checked).some((text) => text.t === 0 && text.scene === 1), `${key}: text in frame 0`);
      assert.deepEqual(todo, [], key);
    }
    const list = draftPiece(conceptOf("mtc"), { brand: brandOf(), images: [image] }).piece;
    assert.deepEqual(list.scenes[0].items[0].items, ["Língua.", "Pulso.", "Zang-Fu.", "Pontos.", "Tudo no lugar."]);
  });

  test("without a screen, produto-em-uso falls back and says what is missing", () => {
    const { piece, todo } = draftPiece({ ...conceptOf("confianca"), template: "produto-em-uso" }, { brand: brandOf(), images: [] });
    assert.equal(piece.template, "problema-mecanismo");
    assert.equal(todo.length, 2);
  });

  test("the check refuses a cut off the beat, a gap, a frame 0 without text and an image outside the piece", () => {
    const dir = mkdtempSync(join(tmpdir(), "peca-"));
    const good = draftPiece(conceptOf("memoria"), { brand: brandOf(), images: [] }).piece;
    const offBeat = structuredClone(good);
    offBeat.scenes[0].to = 3.2;
    offBeat.scenes[1].from = 3.2;
    assert.throws(() => checkPiece(offBeat, { pieceDir: dir }), (error) => error.code === "piece_invalid" && /scenes\[1\]\.from/.test(error.message));
    const gap = structuredClone(good);
    gap.scenes[1].from = 3.5;
    assert.throws(() => checkPiece(gap, { pieceDir: dir }), /sem buraco/);
    const noCover = structuredClone(good);
    noCover.scenes[0].items = noCover.scenes[0].items.map((item) => ({ ...item, at: 0.5 }));
    assert.throws(() => checkPiece(noCover, { pieceDir: dir }), /primeiro quadro não tem texto/);
    const outside = structuredClone(good);
    outside.scenes[2].items.push({ type: "screen", src: "../tela.png", at: 8 });
    assert.throws(() => checkPiece(outside, { pieceDir: dir }), /fora da pasta da peça/);
    const long = structuredClone(good);
    long.duration = 20;
    assert.throws(() => checkPiece(long, { pieceDir: dir }), /duration/);
  });

  test("the grid, the effects and the page", () => {
    const dir = mkdtempSync(join(tmpdir(), "peca-"));
    const piece = checkPiece(draftPiece(conceptOf("mtc"), { brand: brandOf(), images: [] }).piece, { pieceDir: dir });
    const grid = beatGrid(piece);
    assert.equal(grid.beats.length, 30);
    assert.equal(grid.beats[29], 14.5);
    const events = eventsOf(piece);
    assert.deepEqual(events.events.filter((event) => ["whoosh", "impact"].includes(event.type)).map((event) => [event.t, event.type]), [[4, "whoosh"], [7, "whoosh"], [12, "impact"]]);
    assert.ok(events.events.filter((event) => event.type === "pop").length >= 4);
    const hostile = structuredClone(piece);
    hostile.title = "</script><script>alert(1)</script>";
    hostile.scenes[0].items[0].items[0] = "</script>";
    const html = pageHtml(hostile, { zones: { "9:16": { top: 270, bottom: 672, left: 65, right: 140 } } });
    assert.equal((html.match(/<\/script>/g) ?? []).length, 5, "only the page's own script tags close");
    assert.match(html, /--destaque: #177D82/);
  });

  test("the feed image comes from the scenes, and a written poster is checked like the video", () => {
    const dir = mkdtempSync(join(tmpdir(), "peca-"));
    mkdirSync(join(dir, "imagens"));
    writeFileSync(join(dir, "imagens", "tela-agenda.png"), PNG);
    const drafted = draftPiece({ ...conceptOf("confianca"), template: "produto-em-uso" }, { brand: brandOf(), images: [{ src: "imagens/tela-agenda.png", tall: false }] }).piece;
    const piece = checkPiece(drafted, { pieceDir: dir });
    const drawn = checkPoster(posterOf(piece), { pieceDir: dir, brand: piece.brand });
    const items = drawn.scenes[0].items;
    assert.equal(drawn.format, "4:5");
    assert.equal(items[0].type, "title", "the hook first");
    assert.ok(items.some((item) => item.type === "screen"), "the product's screen as the proof");
    assert.equal(items[items.length - 1].type, "pill", "the button last");
    assert.ok(items.every((item) => item.at < 0), "everything on screen at once");
    // the example of references/pagina-anuncio.md
    const example = { format: "1:1", scenes: [{ items: [
      { type: "title", text: "No fim da consulta, você ainda lembrava?", accent: "ainda lembrava?" },
      { type: "screen", src: "imagens/tela-agenda.png", motion: "parado", height: 0.42 },
      { type: "logo" },
      { type: "pill", text: "Assinar" },
    ] }] };
    assert.equal(checkPoster(posterOf({ ...piece, poster: example }), { pieceDir: dir, brand: piece.brand }).format, "1:1");
    const silent = { format: "4:5", scenes: [{ items: [{ type: "logo" }] }] };
    assert.throws(() => checkPoster(posterOf({ ...piece, poster: silent }), { pieceDir: dir, brand: piece.brand }), (error) => error.code === "piece_invalid" && /um texto/.test(error.message));
    const wide = { format: "16:9", scenes: [{ items: [{ type: "title", text: "Uma frase." }] }] };
    assert.throws(() => checkPoster(posterOf({ ...piece, poster: wide }), { pieceDir: dir, brand: piece.brand }), (error) => /poster\.format/.test(error.message));
  });

  test("the palette keeps the brand's colours only where they read", () => {
    const light = paletteFrom({ primary: "#FFCC12", background: "#FFFFFF", text: "#313131" });
    assert.equal(light.accent, "#313131", "a yellow accent on white does not read: the text colour takes its place");
    const dark = paletteFrom({ primary: "#FFCC12", background: "#313131" });
    assert.equal(dark.accent, "#FFCC12");
    assert.ok(contrast(dark.text, dark.background) >= 4.5);
    assert.equal(paletteFrom({}).background, "#F6F4EE");
    assert.deepEqual(sentences("Ela contou. No fim, você lembrava?"), ["Ela contou.", "No fim, você lembrava?"]);
    assert.equal(listParts("Uma frase só."), null);
  });
});

describe("links and the Motor's verdict", () => {
  test("the Ad Library links come filtered by country, active ads and every type", () => {
    const url = new URL(keywordUrl("acupunturistas"));
    assert.equal(url.searchParams.get("active_status"), "active");
    assert.equal(url.searchParams.get("country"), "BR");
    assert.equal(url.searchParams.get("ad_type"), "all");
    assert.equal(url.searchParams.get("q"), "acupunturistas");
    assert.equal(new URL(competitorLink("123456789012").url).searchParams.get("view_all_page_id"), "123456789012");
    assert.equal(competitorLink("@agendaviva").kind, "name");
    const links = campaignLinks(brief());
    assert.equal(links.competitors.length, 3);
    assert.equal(links.searches.length, 2);
    assert.equal(links.script.length, 5);
  });

  test("a page without boxes never counts as checked (invariant 14)", () => {
    const skipped = { passed: true, checks: [{ name: "page", status: "pass" }, { name: "first_frame_readable", status: "skip" }, { name: "safe_area", status: "skip" }], warnings: ["A página não define window.boxes(t): a capa não foi conferida."] };
    const summary = acceptSummary(skipped, null);
    assert.equal(summary.passed, false);
    assert.equal(summary.failed[0].name, "boxes");
    assert.equal(acceptSummary({ passed: true, checks: [{ name: "safe_area", status: "pass" }] }, null).passed, true);
  });
});
