// Criativos para anúncios, the commands as the member's AI runs them: a scratch project with the
// app in .flyee/modules/ad-creatives and a stand-in Motor de vídeo that logs every call
// (tests/fixtures/engine). One campaign goes from the briefing to the journal; the other tests
// break one thing each: an approval voided by an edit, an outdated Motor, a page without boxes.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { BRIEFING, concepts as conceptsFixture, READING_AGENDA, READING_DECLARED, READING_NORTE, TAGS } from "./fixtures/campanha.mjs";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(TESTS_DIR, "..");
const ENGINE_DIR = join(APP_DIR, "..", "video-render");
const CAMPAIGN = "lotus-rodada-0";
const KEYS = ["memoria", "confianca", "mtc"];
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const source = join(from, entry);
    if (statSync(source).isDirectory()) copyDir(source, join(to, entry));
    else copyFileSync(source, join(to, entry));
  }
}

/** A member's project with this app and, unless told otherwise, the stand-in Motor. */
function makeProject(t, { engine = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "anuncios-projeto-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const appDir = join(root, ".flyee", "modules", "ad-creatives");
  for (const dir of ["scripts", "runtime", "references"]) copyDir(join(APP_DIR, dir), join(appDir, dir));
  copyFileSync(join(APP_DIR, "flyee.module.json"), join(appDir, "flyee.module.json"));
  const engineDir = join(root, ".flyee", "modules", "video-render");
  if (engine) {
    mkdirSync(join(engineDir, "scripts"), { recursive: true });
    mkdirSync(join(engineDir, "runtime"), { recursive: true });
    copyFileSync(join(TESTS_DIR, "fixtures", "engine", "render.mjs"), join(engineDir, "scripts", "render.mjs"));
    copyFileSync(join(ENGINE_DIR, "runtime", "motion.js"), join(engineDir, "runtime", "motion.js"));
    writeFileSync(join(engineDir, "flyee.module.json"), JSON.stringify({ name: "video-render", version: "9.9.9" }));
  }
  const log = join(engineDir, "calls.json");
  return {
    root,
    script: join(appDir, "scripts", "ads.mjs"),
    dir: join(root, "anuncios", CAMPAIGN),
    calls: () => (existsSync(log) ? JSON.parse(readFileSync(log, "utf8")) : []),
    clearCalls: () => rmSync(log, { force: true }),
    configure: (settings) => writeFileSync(join(engineDir, "fake.json"), JSON.stringify(settings)),
  };
}

/**
 * The member's AI runs the script from the project root. The test machine's own keys never reach
 * it: its own home folder, and APIFY_TOKEN empty, which the app reads as "no key".
 */
function cli(project, args, { json = true } = {}) {
  const home = join(project.root, "home");
  mkdirSync(home, { recursive: true });
  const env = { ...process.env, HOME: home, USERPROFILE: home, APIFY_TOKEN: "" };
  return new Promise((done) => {
    const child = spawn(process.execPath, [project.script, ...args, ...(json ? ["--json"] : [])], { cwd: project.root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => {
      let parsed = null;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        // plain text: the assertions show stdout and stderr
      }
      done({ code, json: parsed, stdout, stderr });
    });
  });
}

async function ok(project, args) {
  const run = await cli(project, args);
  assert.equal(run.code, 0, `${args.join(" ")} → ${run.stdout}${run.stderr}`);
  assert.equal(run.json.ok, true);
  return run.json;
}

async function refused(project, args, code) {
  const run = await cli(project, args);
  assert.notEqual(run.code, 0, `${args.join(" ")} should fail → ${run.stdout}`);
  assert.equal(run.json.ok, false);
  assert.equal(run.json.error.code, code, JSON.stringify(run.json.error));
  return run.json.error;
}

/** The campaign with its briefing, the screenshots and readings the member brought, and the concepts. */
async function readyCampaign(project) {
  await ok(project, ["new", CAMPAIGN]);
  writeFileSync(join(project.dir, "briefing.md"), BRIEFING);
  for (const reading of [READING_NORTE, READING_AGENDA]) {
    for (const item of reading.items) {
      mkdirSync(dirname(join(project.dir, item.capture)), { recursive: true });
      writeFileSync(join(project.dir, item.capture), PNG);
    }
  }
  const readings = { norte: READING_NORTE, agenda: READING_AGENDA, dito: READING_DECLARED, etiquetas: TAGS };
  for (const [name, data] of Object.entries(readings)) writeFileSync(join(project.dir, "pesquisa", "leituras", `${name}.json`), JSON.stringify(data, null, 2));
  for (const name of Object.keys(readings)) await ok(project, ["import", CAMPAIGN, `pesquisa/leituras/${name}.json`]);
  writeFileSync(join(project.dir, "conceitos.json"), JSON.stringify(conceptsFixture(), null, 2));
}

async function approvedCampaign(project) {
  await readyCampaign(project);
  await ok(project, ["concepts", CAMPAIGN]);
  await ok(project, ["approve", CAMPAIGN, "concepts"]);
}

async function finished(project, key) {
  await ok(project, ["piece", CAMPAIGN, key]);
  await ok(project, ["preview", CAMPAIGN, key]);
  await ok(project, ["approve", CAMPAIGN, "preview", key]);
  return ok(project, ["final", CAMPAIGN, key]);
}

describe("the round, from the briefing to the journal", () => {
  test("check before the Motor: research works, pieces wait for the install", async (t) => {
    const project = makeProject(t, { engine: false });
    const check = await ok(project, ["check"]);
    assert.equal(check.engine.installed, false);
    assert.equal(check.ready, false);
    assert.deepEqual(check.modes, { research: true, apify: false, concepts: true, pieces: false });
    assert.equal(check.apify_key, false);
    assert.equal(check.apify_setup.command, "npx --yes flyee@latest key set APIFY_TOKEN --browser --json");
    assert.deepEqual(Object.keys(check.partners).sort(), ["instagram-research", "video-analysis", "youtube-research"]);
    assert.equal(check.partners["instagram-research"].installed, false);
    assert.equal(check.install.command, "npx --yes flyee@latest add video-render --yes --json");
    assert.doesNotMatch(check.install.how, /dry-run|com o sim/, "the core's rule since 1.8.0: one sentence, then the install");
    await readyCampaign(project);
    assert.equal((await ok(project, ["concepts", CAMPAIGN])).concepts.length, 3);
    await ok(project, ["approve", CAMPAIGN, "concepts"]);
    const missing = await refused(project, ["piece", CAMPAIGN, "memoria"], "video_render_missing");
    assert.match(missing.fix, /add video-render --yes --json/);
  });

  test("every command, in order, as the member's AI runs them", { timeout: 300000 }, async (t) => {
    const project = makeProject(t);
    const check = await ok(project, ["check"]);
    assert.equal(check.ready, true);
    assert.equal(check.next_step.action, "new");

    const created = await ok(project, ["new", CAMPAIGN]);
    assert.equal(created.created, true);
    assert.equal(created.dir, `anuncios/${CAMPAIGN}`);
    for (const folder of ["materiais", "pesquisa/capturas", "pesquisa/leituras", "pecas"]) assert.ok(existsSync(join(project.dir, folder)), folder);
    assert.equal(JSON.parse(readFileSync(join(project.dir, "diario.json"), "utf8")).entries[0].type, "created");

    const empty = await ok(project, ["brief", CAMPAIGN]);
    assert.equal(empty.complete, false);
    assert.equal(empty.questions.length, empty.missing.length);
    assert.equal(empty.next_step.action, "ask");

    writeFileSync(join(project.dir, "briefing.md"), BRIEFING);
    const brief = await ok(project, ["brief", CAMPAIGN]);
    assert.equal(brief.complete, true);
    assert.equal(brief.fields.verba_diaria, 50);
    assert.equal(brief.budget.max_cost_per_event, 7, "the budget shows before production (round zero, rule 14)");
    assert.equal(brief.next_step.action, "capture");

    const captured = await ok(project, ["capture", CAMPAIGN]);
    assert.equal(captured.captured, true);
    assert.equal(captured.dir, "capturas/prontuariolotus-com-br");
    assert.equal(captured.brand.logo, true);

    const budget = await ok(project, ["budget", CAMPAIGN]);
    assert.equal(budget.viable, null);
    assert.equal(budget.max_cost_per_event, 7);
    const viable = await ok(project, ["budget", CAMPAIGN, "--cost", "45", "--daily", "500"]);
    assert.deepEqual([viable.floor_per_set, viable.sets, viable.viable], [322, 1, true]);
    const short = await ok(project, ["budget", CAMPAIGN, "--cost", "45", "--daily", "200"]);
    assert.equal(short.viable, false);
    assert.equal(short.exits.length, 3);
    assert.ok(existsSync(join(project.dir, "verba.json")));

    const links = await ok(project, ["links", CAMPAIGN]);
    assert.equal(links.competitors.length, 3);
    assert.equal(links.searches.length, 2);
    assert.equal(links.script.length, 5);
    assert.ok(existsSync(join(project.dir, "pesquisa", "links.md")));
    for (const folder of ["clinica-norte-digital", "agenda-viva", "nota-clara"]) assert.ok(existsSync(join(project.dir, "pesquisa", "capturas", folder)), folder);

    for (const reading of [READING_NORTE, READING_AGENDA]) {
      for (const item of reading.items) writeFileSync(join(project.dir, item.capture), PNG);
    }
    writeFileSync(join(project.dir, "pesquisa", "leituras", "norte.json"), JSON.stringify(READING_NORTE));
    const imported = await ok(project, ["import", CAMPAIGN, "pesquisa/leituras/norte.json"]);
    assert.equal(imported.added.length, 3);
    assert.equal(imported.next_step.action, "tag", "an ad without tags is flagged");
    writeFileSync(join(project.dir, "pesquisa", "leituras", "agenda.json"), JSON.stringify(READING_AGENDA));
    writeFileSync(join(project.dir, "pesquisa", "leituras", "dito.json"), JSON.stringify(READING_DECLARED));
    writeFileSync(join(project.dir, "pesquisa", "leituras", "etiquetas.json"), JSON.stringify(TAGS));
    await ok(project, ["import", CAMPAIGN, "pesquisa/leituras/agenda.json"]);
    assert.equal((await ok(project, ["import", CAMPAIGN, "pesquisa/leituras/dito.json"])).added.length, 3);
    const again = await ok(project, ["import", CAMPAIGN, "pesquisa/leituras/norte.json"]);
    assert.deepEqual([again.added.length, again.replaced.length], [0, 3], "the same reading twice replaces, never duplicates");
    assert.equal((await ok(project, ["import", CAMPAIGN, "pesquisa/leituras/etiquetas.json"])).tagged.length, 2);

    const evidence = await ok(project, ["evidence", CAMPAIGN]);
    assert.equal(evidence.counts.items, 8);
    assert.equal(evidence.counts.excluded, 1);
    assert.equal(evidence.counts.competitor_ads, 4, "the ad taken out of the analysis does not count");
    assert.equal(evidence.kept[0].days_active, 158);
    assert.ok(evidence.patterns.some((pattern) => pattern.value === "presenca"));
    assert.match(readFileSync(join(project.dir, "evidencias.md"), "utf8"), /## Anúncios no ar há 30 dias ou mais/);

    writeFileSync(join(project.dir, "conceitos.json"), JSON.stringify(conceptsFixture(), null, 2));
    const concepts = await ok(project, ["concepts", CAMPAIGN]);
    assert.deepEqual(concepts.concepts.map((concept) => concept.confidence), ["alta", "baixa", "aposta"]);
    assert.equal(concepts.approval.current, false);
    assert.equal(concepts.next_step.action, "approve");
    const written = JSON.parse(readFileSync(join(project.dir, "conceitos.json"), "utf8"));
    assert.equal(written.concepts[0].confidence, "alta", "the confidence written by hand was overwritten by the computation");
    const cards = readFileSync(join(project.dir, "conceitos.md"), "utf8");
    assert.match(cards, /## 1\. memoria · confiança alta/);
    assert.match(cards, /Clínica Norte Digital, no ar há 158 dias, 3 versões/);
    assert.match(cards, /nenhuma evidência: é uma aposta/);

    await refused(project, ["piece", CAMPAIGN, "memoria"], "concepts_not_approved");
    const approved = await ok(project, ["approve", CAMPAIGN, "concepts"]);
    assert.deepEqual(approved.keys, KEYS);
    assert.match(readFileSync(join(project.dir, "conceitos.md"), "utf8"), /Aprovados pelo integrante em/);

    project.clearCalls();
    const piece = await ok(project, ["piece", CAMPAIGN, "memoria"]);
    assert.deepEqual(project.calls().map((call) => call[0]), ["networks"]);
    assert.equal(piece.template, "problema-mecanismo");
    assert.deepEqual(piece.zone, { top: 270, bottom: 672, left: 65, right: 140 }, "the ad zone comes from the Motor's table");
    assert.equal(piece.brand.logo, "imagens/logo.svg");
    assert.equal(piece.brand.colors.accent, "#7C3AED");
    assert.equal(piece.brand.name, "Prontuário Lótus");
    for (const file of ["pagina.html", "peca.json", "ad.js", "ad.css", "motion.js", "imagens/logo.svg", "imagens/tela-1.png"]) assert.ok(existsSync(join(project.dir, "pecas", "memoria", file)), file);
    const page = readFileSync(join(project.dir, "pecas", "memoria", "pagina.html"), "utf8");
    assert.match(page, /"9:16":\{"top":270,"bottom":672,"left":65,"right":140\}/);
    assert.equal(piece.texts[0].t, 0);

    project.clearCalls();
    const preview = await ok(project, ["preview", CAMPAIGN, "memoria"]);
    assert.deepEqual(project.calls().map((call) => call[0]), ["music", "sfx", "preview", "mix", "frames", "accept"]);
    const accept = project.calls().find((call) => call[0] === "accept");
    assert.ok(accept.includes("--networks") && accept.includes("ads_meta"), accept.join(" "));
    assert.equal(accept[accept.indexOf("--safe") + 1], "networks");
    assert.equal(preview.accept.passed, true);
    assert.equal(preview.next_step.action, "show_preview");
    project.clearCalls();
    assert.equal((await ok(project, ["preview", CAMPAIGN, "memoria"])).reused, true, "nothing changed: nothing rendered again");
    assert.deepEqual(project.calls(), []);

    await refused(project, ["final", CAMPAIGN, "memoria"], "preview_not_approved");
    await ok(project, ["approve", CAMPAIGN, "preview", "memoria"]);
    project.clearCalls();
    const final = await ok(project, ["final", CAMPAIGN, "memoria"]);
    assert.deepEqual(project.calls().map((call) => call[0]), ["render", "mix", "frames", "accept", "probe"], "the music and the effects of the approved preview are reused");
    const render = project.calls()[0];
    assert.equal(render[render.indexOf("--sub") + 1], "2");
    assert.equal(final.file, `anuncios/${CAMPAIGN}/pecas/memoria/final/memoria-reels-lembra-v1.mp4`);
    assert.equal(final.accept.passed, true);
    assert.deepEqual([final.media.width, final.media.height, final.media.has_audio], [1080, 1920, true]);

    const blocked = await refused(project, ["deliver", CAMPAIGN], "deliver_blocked");
    assert.deepEqual(blocked.details.blockers.map((blocker) => blocker.what), ["copy", "confianca", "mtc"]);

    for (const key of ["confianca", "mtc"]) assert.equal((await finished(project, key)).accept.passed, true, key);
    const mtc = JSON.parse(readFileSync(join(project.dir, "pecas", "mtc", "peca.json"), "utf8"));
    assert.equal(mtc.scenes[0].items[0].type, "list");

    const copy = await ok(project, ["copy", CAMPAIGN]);
    assert.equal(copy.passed, true, JSON.stringify(copy.results.map((result) => result.problems)));
    assert.ok(copy.results[0].warnings.some((warning) => warning.rule === "primary_cut"));

    const delivered = await ok(project, ["deliver", CAMPAIGN]);
    assert.deepEqual(delivered.files.map((file) => file.file), ["memoria-reels-lembra-v1.mp4", "confianca-reels-branco-v1.mp4", "mtc-reels-pulso-v1.mp4"]);
    for (const file of ["memoria-reels-lembra-v1.mp4", "memoria-reels-lembra-v1-capa.png", "nomes.json", "textos.md"]) assert.ok(existsSync(join(project.dir, "entrega", file)), file);
    const names = JSON.parse(readFileSync(join(project.dir, "entrega", "nomes.json"), "utf8"));
    assert.deepEqual(names.ads.map((ad) => ad.ad_name), ["memoria-reels-lembra-v1", "confianca-reels-branco-v1", "mtc-reels-pulso-v1"]);
    assert.deepEqual(names.ads[0].files, [{ file: "memoria-reels-lembra-v1.mp4", placement: "vertical", format: "9:16", kind: "video" }]);
    const texts = readFileSync(join(project.dir, "entrega", "textos.md"), "utf8");
    assert.match(texts, /https:\/\/www\.prontuariolotus\.com\.br\/assinar\?utm_content=memoria-reels-lembra-v1/);
    assert.match(texts, /utm_content=\{\{ad\.name\}\}/);
    const launch = readFileSync(join(project.dir, "lancamento.md"), "utf8");
    assert.match(launch, /cada evento precisa custar até R\$ 7/);
    assert.match(launch, /Uma campanha, um conjunto, 3 anúncio\(s\)/);
    const report = JSON.parse(readFileSync(join(project.dir, "relatorio.json"), "utf8"));
    assert.equal(report.concepts.length, 3);
    assert.ok(delivered.pending.some((item) => /custo por evento/.test(item)));

    const journal = await ok(project, ["journal", CAMPAIGN]);
    assert.equal(journal.entry.type, "round");
    assert.equal(journal.entry.round, 1);
    assert.deepEqual(journal.entry.hypotheses.map((hypothesis) => hypothesis.confidence), ["alta", "baixa", "aposta"]);
    assert.equal(journal.next_step.command, "npx --yes flyee@latest track tool.executed --module ad-creatives");
    const launched = await ok(project, ["journal", CAMPAIGN, "--kind", "launched", "--note", "A estrutura coube no Gerenciador."]);
    assert.equal(launched.entry.type, "launched");
    const status = await ok(project, ["status", CAMPAIGN]);
    assert.equal(status.stage, "pronta");
    assert.equal(status.round, 1);
    assert.equal((await ok(project, ["list"])).campaigns[0].stage, "pronta");
  });
});

describe("the three pieces of an ad: vertical video, 4:5 video and image", () => {
  test("piece writes the image page, preview shows the feed versions, final makes and checks each one", { timeout: 300000 }, async (t) => {
    const project = makeProject(t);
    await readyCampaign(project);
    const data = conceptsFixture();
    for (const concept of data.concepts) concept.formats = ["vertical", "feed", "imagem"];
    data.concepts[2].formats = ["vertical", "quadrado"];
    writeFileSync(join(project.dir, "conceitos.json"), JSON.stringify(data, null, 2));
    const concepts = await ok(project, ["concepts", CAMPAIGN]);
    assert.ok(concepts.concepts.every((concept) => concept.ad_name.includes("-reels-")), "the ad's name is the vertical video's");
    await ok(project, ["approve", CAMPAIGN, "concepts"]);

    const piece = await ok(project, ["piece", CAMPAIGN, "memoria"]);
    assert.equal(piece.image_page, `anuncios/${CAMPAIGN}/pecas/memoria/imagem.html`);
    assert.ok(piece.image_texts.includes("Ela contou no começo da consulta."), "the image carries the hook");
    const poster = readFileSync(join(project.dir, "pecas", "memoria", "imagem.html"), "utf8");
    assert.match(poster, /"kind":"poster"/);

    project.clearCalls();
    const preview = await ok(project, ["preview", CAMPAIGN, "memoria"]);
    const calls = project.calls();
    assert.deepEqual(calls.map((call) => call[0]), ["music", "sfx", "preview", "mix", "frames", "accept", "frames", "accept", "frames", "accept"]);
    const feedAccept = calls[7];
    assert.equal(feedAccept[feedAccept.indexOf("--format") + 1], "4:5");
    assert.equal(feedAccept[feedAccept.indexOf("--safe") + 1], "instagram-feed", "a 4:5 page is never checked as a carousel slide");
    assert.ok(calls[8][1].endsWith("imagem.html") && calls[9][1].endsWith("imagem.html"));
    assert.deepEqual(preview.placements.map((entry) => [entry.id, entry.passed]), [["feed", true], ["imagem", true]]);
    assert.equal(preview.passed, true);

    await ok(project, ["approve", CAMPAIGN, "preview", "memoria"]);
    project.clearCalls();
    const final = await ok(project, ["final", CAMPAIGN, "memoria"]);
    assert.deepEqual(project.calls().map((call) => call[0]), ["render", "mix", "frames", "accept", "probe", "render", "mix", "accept", "probe", "frames", "accept"]);
    const feedRender = project.calls()[5];
    assert.equal(feedRender[feedRender.indexOf("--format") + 1], "4:5");
    const feedCheck = project.calls()[7];
    assert.equal(feedCheck[feedCheck.indexOf("--networks") + 1], "feed", "no ad zone for the feed in the Motor's table: checked against the feed, and the report says so");
    assert.deepEqual(final.files.map((file) => [file.placement, file.file.split("/").pop(), file.passed]), [
      ["vertical", "memoria-reels-lembra-v1.mp4", true],
      ["feed", "memoria-feed-lembra-v1.mp4", true],
      ["imagem", "memoria-imagem-lembra-v1.png", true],
    ]);
    assert.match(JSON.parse(readFileSync(join(project.dir, "pecas", "memoria", "final", "aceite-feed.json"), "utf8")).zone_note, /não tem a zona de anúncio do feed/);

    for (const key of ["confianca", "mtc"]) assert.equal((await finished(project, key)).passed, true, key);
    await ok(project, ["copy", CAMPAIGN]);
    const delivered = await ok(project, ["deliver", CAMPAIGN]);
    assert.deepEqual(delivered.files.map((file) => file.file), [
      "memoria-reels-lembra-v1.mp4", "memoria-feed-lembra-v1.mp4", "memoria-imagem-lembra-v1.png",
      "confianca-reels-branco-v1.mp4", "confianca-feed-branco-v1.mp4", "confianca-imagem-branco-v1.png",
      "mtc-reels-pulso-v1.mp4", "mtc-quadrado-pulso-v1.png",
    ]);
    const names = JSON.parse(readFileSync(join(project.dir, "entrega", "nomes.json"), "utf8"));
    assert.deepEqual(names.ads[2].files.map((file) => file.placement), ["vertical", "quadrado"]);
    const launch = readFileSync(join(project.dir, "lancamento.md"), "utf8");
    assert.match(launch, /personalizar a peça por posicionamento/);
    assert.match(launch, /Reels de teste/);
  });
});

describe("what voids, blocks or refuses", () => {
  test("an edit of the piece after the preview needs a new preview and a new yes", { timeout: 120000 }, async (t) => {
    const project = makeProject(t);
    await approvedCampaign(project);
    await ok(project, ["piece", CAMPAIGN, "memoria"]);
    await ok(project, ["preview", CAMPAIGN, "memoria"]);
    await ok(project, ["approve", CAMPAIGN, "preview", "memoria"]);
    const path = join(project.dir, "pecas", "memoria", "peca.json");
    const piece = JSON.parse(readFileSync(path, "utf8"));
    piece.scenes[1].items[0].text = "Digitando, você não ouve direito.";
    writeFileSync(path, JSON.stringify(piece, null, 2));
    await refused(project, ["approve", CAMPAIGN, "preview", "memoria"], "preview_outdated");
    const preview = await ok(project, ["preview", CAMPAIGN, "memoria"]);
    assert.equal(preview.reused, false);
    assert.ok(preview.warnings.some((warning) => /peca\.json mudou/.test(warning)));
    assert.ok(preview.texts.some((text) => text.text === "Digitando, você não ouve direito."));
    assert.equal(preview.approved, false, "the yes given to the old preview does not carry over");
    await refused(project, ["final", CAMPAIGN, "memoria"], "preview_not_approved");
    await ok(project, ["approve", CAMPAIGN, "preview", "memoria"]);
    await ok(project, ["final", CAMPAIGN, "memoria"]);
  });

  test("a change in an approved concept asks for the yes again; new evidence only tells", { timeout: 120000 }, async (t) => {
    const project = makeProject(t);
    await approvedCampaign(project);
    const reading = { version: 1, kind: "declared", collected_at: "2026-10-12", source: { type: "declared", ref: "conversa" }, items: [{ id: "reclama da ficha", kind: "audience_comment", text: "Minha ficha não tem campo para o pulso." }] };
    writeFileSync(join(project.dir, "pesquisa", "leituras", "nova.json"), JSON.stringify(reading));
    await ok(project, ["import", CAMPAIGN, "pesquisa/leituras/nova.json"]);
    const data = JSON.parse(readFileSync(join(project.dir, "conceitos.json"), "utf8"));
    data.concepts[2].evidence = ["fala-reclama-da-ficha"];
    writeFileSync(join(project.dir, "conceitos.json"), JSON.stringify(data, null, 2));
    const told = await ok(project, ["concepts", CAMPAIGN]);
    assert.equal(told.approval.current, true, "evidence that arrives later does not reopen the approval");
    assert.deepEqual(told.approval.confidence_changes, [{ key: "mtc", from: "aposta", to: "baixa" }]);
    data.concepts[2].copy.headline = "Outro título";
    writeFileSync(join(project.dir, "conceitos.json"), JSON.stringify(data, null, 2));
    assert.equal((await ok(project, ["concepts", CAMPAIGN])).approval.current, false);
    await refused(project, ["piece", CAMPAIGN, "mtc"], "concepts_not_approved");
  });

  test("an outdated Motor without the ad zone is named, never worked around", async (t) => {
    const project = makeProject(t);
    await approvedCampaign(project);
    project.configure({ networks: "old" });
    const error = await refused(project, ["piece", CAMPAIGN, "memoria"], "video_render_outdated");
    assert.match(error.fix, /npx --yes flyee@latest update --yes --json/);
  });

  test("a page without boxes fails the preview (invariant 14)", { timeout: 120000 }, async (t) => {
    const project = makeProject(t);
    await approvedCampaign(project);
    await ok(project, ["piece", CAMPAIGN, "memoria"]);
    const path = join(project.dir, "pecas", "memoria", "peca.json");
    const piece = JSON.parse(readFileSync(path, "utf8"));
    piece.scenes[1].items[0].text = "SEM_CAIXAS";
    writeFileSync(path, JSON.stringify(piece, null, 2));
    const preview = await ok(project, ["preview", CAMPAIGN, "memoria"]);
    assert.equal(preview.accept.passed, false);
    assert.ok(preview.accept.failed.some((item) => item.name === "boxes"));
    await refused(project, ["approve", CAMPAIGN, "preview", "memoria"], "preview_failed");
  });

  test("copy blocks a promise and a forbidden term, and the delivery waits for it", async (t) => {
    const project = makeProject(t);
    await readyCampaign(project);
    const data = conceptsFixture();
    data.concepts[0].copy.primary_text = "Faça o diagnóstico em minutos e venda garantida.";
    writeFileSync(join(project.dir, "conceitos.json"), JSON.stringify(data, null, 2));
    const copy = await ok(project, ["copy", CAMPAIGN]);
    assert.equal(copy.passed, false);
    assert.deepEqual(copy.results[0].problems.map((problem) => problem.rule).sort(), ["forbidden_term", "guaranteed_result"]);
    assert.equal(copy.next_step.action, "fix");
  });

  test("a capture that fails leaves the pieces with the member's files and a neutral palette", { timeout: 120000 }, async (t) => {
    const project = makeProject(t);
    await approvedCampaign(project);
    const blocked = await ok(project, ["capture", CAMPAIGN, "--url", "https://bloqueado.com.br"]);
    assert.equal(blocked.captured, false);
    assert.equal(blocked.error.code, "site_blocked");
    writeFileSync(join(project.dir, "materiais", "logo.png"), PNG);
    writeFileSync(join(project.dir, "materiais", "tela-anamnese.png"), PNG);
    const piece = await ok(project, ["piece", CAMPAIGN, "confianca", "--template", "produto-em-uso"]);
    assert.equal(piece.template, "produto-em-uso");
    assert.equal(piece.brand.logo, "imagens/logo.png");
    assert.equal(piece.brand.colors.background, "#F6F4EE");
    assert.deepEqual(piece.brand.sources.screens, ["materiais"]);
  });

  test("a reading without its screenshot is refused with the field's path", async (t) => {
    const project = makeProject(t);
    await ok(project, ["new", CAMPAIGN]);
    writeFileSync(join(project.dir, "briefing.md"), BRIEFING);
    writeFileSync(join(project.dir, "pesquisa", "leituras", "norte.json"), JSON.stringify(READING_NORTE));
    const error = await refused(project, ["import", CAMPAIGN, "pesquisa/leituras/norte.json"], "reading_invalid");
    assert.match(error.message, /items\[0\]\.capture/);
    await refused(project, ["brief", "nao-existe"], "campaign_not_found");
    await refused(project, ["concepts", CAMPAIGN], "concepts_missing");
    assert.equal((await cli(project, ["budget"])).json.error.code, "usage");
  });

  test("the text a person reads without --json, in plain pt-BR", { timeout: 120000 }, async (t) => {
    const project = makeProject(t);
    await approvedCampaign(project);
    const human = async (args) => {
      const run = await cli(project, args, { json: false });
      assert.equal(run.code, 0, `${args.join(" ")} → ${run.stdout}${run.stderr}`);
      assert.throws(() => JSON.parse(run.stdout));
      assert.doesNotMatch(run.stdout, /undefined|\[object Object\]|NaN/, args.join(" "));
      return run.stdout;
    };
    assert.match(await human(["check"]), /^Criativos para anúncios 1\.\d+\.\d+ · Node /);
    assert.match(await human(["brief", CAMPAIGN]), /^Briefing completo: /);
    assert.match(await human(["budget", CAMPAIGN, "--cost", "45", "--daily", "200"]), /\n {2}1\. Otimizar por um evento mais cedo no funil/);
    assert.match(await human(["evidence", CAMPAIGN]), /^Evidência: \d+ item\(ns\)/);
    assert.match(await human(["concepts", CAMPAIGN]), /\n {2}memoria: confiança alta · memoria-reels-lembra-v1/);
    assert.match(await human(["piece", CAMPAIGN, "memoria"]), /^Peça memoria: anuncios\/lotus-rodada-0\/pecas\/memoria\/pagina\.html/);
    assert.match(await human(["preview", CAMPAIGN, "memoria"]), /\nConferência: APROVADA/);
    assert.match(await human(["status", CAMPAIGN]), /^Campanha lotus-rodada-0/);
    assert.match(await human(["help"]), /^Criativos para anúncios: /);
  });
});
