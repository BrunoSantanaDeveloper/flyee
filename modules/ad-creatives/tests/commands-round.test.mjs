// 1.2.0 as the member's AI runs it: `round next` turns the measurement app's report into own
// results and the proposal of the next round; `sequence` dates the four pieces of the target date
// by the plan. Neither needs the Motor.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { BRIEFING, concepts as conceptsFixture, READING_AGENDA, READING_DECLARED, READING_NORTE, TAGS } from "./fixtures/campanha.mjs";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(TESTS_DIR, "fixtures");
const SCRIPT = resolve(TESTS_DIR, "..", "scripts", "ads.mjs");
const CAMPAIGN = "lotus-bf26";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

function project(t, { plan = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "anuncios-round-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  if (plan) {
    mkdirSync(join(root, "media-plan", "black-friday-2026"), { recursive: true });
    cpSync(join(FIXTURES, "plano.json"), join(root, "media-plan", "black-friday-2026", "plano.json"));
  }
  return root;
}

function run(root, args) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [SCRIPT, ...args, "--json"], { cwd: root, env: { ...process.env, APIFY_TOKEN: "" }, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", fail);
    child.on("close", (status) => {
      try {
        done({ status, json: JSON.parse(stdout), stderr });
      } catch {
        fail(new Error(`no JSON from ${args.join(" ")}: ${stdout} ${stderr}`));
      }
    });
  });
}

async function ok(root, args) {
  const result = await run(root, args);
  assert.equal(result.status, 0, `${args.join(" ")} → ${JSON.stringify(result.json)}`);
  return result.json;
}

async function refused(root, args, code) {
  const result = await run(root, args);
  assert.notEqual(result.status, 0, `${args.join(" ")} should fail`);
  assert.equal(result.json.error.code, code, JSON.stringify(result.json.error));
  return result.json.error;
}

const campaignFile = (root, name) => join(root, "anuncios", CAMPAIGN, name);

/** The campaign with its briefing, the readings the member brought and the approved concepts. */
async function approvedCampaign(root) {
  await ok(root, ["new", CAMPAIGN]);
  const dir = join(root, "anuncios", CAMPAIGN);
  writeFileSync(join(dir, "briefing.md"), BRIEFING);
  for (const reading of [READING_NORTE, READING_AGENDA]) {
    for (const item of reading.items) {
      mkdirSync(dirname(join(dir, item.capture)), { recursive: true });
      writeFileSync(join(dir, item.capture), PNG);
    }
  }
  const readings = { norte: READING_NORTE, agenda: READING_AGENDA, dito: READING_DECLARED, etiquetas: TAGS };
  for (const [name, data] of Object.entries(readings)) writeFileSync(join(dir, "pesquisa", "leituras", `${name}.json`), JSON.stringify(data, null, 2));
  for (const name of Object.keys(readings)) await ok(root, ["import", CAMPAIGN, `pesquisa/leituras/${name}.json`]);
  writeFileSync(join(dir, "conceitos.json"), JSON.stringify(conceptsFixture(), null, 2));
  await ok(root, ["concepts", CAMPAIGN]);
  await ok(root, ["approve", CAMPAIGN, "concepts"]);
}

function placeReport(root, name = "meta-testes") {
  const dir = join(root, "ads-insights", "leituras", name);
  mkdirSync(dir, { recursive: true });
  cpSync(join(FIXTURES, "report.json"), join(dir, "report.json"));
  return `ads-insights/leituras/${name}/report.json`;
}

test("round next reads the newest report, adds the own results to the evidence, journals them and proposes round 2 with -v2 names", async (t) => {
  const root = project(t);
  await approvedCampaign(root);
  await refused(root, ["round", "next", CAMPAIGN], "report_missing");
  await refused(root, ["round", CAMPAIGN], "usage");
  const file = placeReport(root);
  const round = await ok(root, ["round", "next", CAMPAIGN]);
  assert.equal(round.report, file);
  assert.equal(round.round, 2);
  assert.equal(round.added.length, 3, JSON.stringify(round.added));
  assert.ok(round.added.every((id) => id.startsWith("res-")), JSON.stringify(round.added));
  assert.equal(round.keep[0].concept, "memoria");
  assert.equal(round.keep[0].result_id, round.result_ids["memoria-reels-lembra-v1"]);
  assert.ok(round.added.includes(round.keep[0].result_id), "the proposal cites the id the evidence holds");
  assert.equal(round.iterate[0].where_it_fails, "gancho");
  assert.equal(round.cut[0].concept, "mtc");
  for (const entry of [...round.keep, ...round.iterate, ...round.cut]) assert.match(entry.next_name, /-v2$/);
  assert.equal(round.next_step.action, "write_concepts");
  assert.match(round.next_step.say, /-v2/);
  assert.ok(existsSync(campaignFile(root, "rodada.json")));
  const markdown = readFileSync(campaignFile(root, "rodada.md"), "utf8");
  assert.match(markdown, /# A rodada 2: lotus-bf26/);
  assert.ok(!/[–—!]/.test(markdown));
  const evidence = JSON.parse(readFileSync(campaignFile(root, "evidencias.json"), "utf8"));
  const own = evidence.items.filter((item) => item.kind === "own_result");
  assert.equal(own.length, 3);
  assert.equal(own[0].source.type, "declared");
  assert.equal(own[0].source.collected_at, "2026-10-15");
  assert.ok(own[0].data.metrics.some((metric) => metric.name === "custo_por_resultado" && metric.value === 14.44));
  const journal = JSON.parse(readFileSync(campaignFile(root, "diario.json"), "utf8"));
  const results = journal.entries.filter((entry) => entry.type === "results");
  assert.equal(results.length, 1);
  assert.equal(results[0].reading, "meta-testes");
  assert.equal(results[0].rows.length, 3);
  assert.equal(results[0].rows[2].verdict, "cortar");
  const state = JSON.parse(readFileSync(campaignFile(root, "estado.json"), "utf8"));
  assert.equal(state.next_round.round, 2);

  // The same reading again replaces, never duplicates; the summary shows the own results in the evidence.
  const again = await ok(root, ["round", "next", CAMPAIGN, "--report", file]);
  assert.equal(again.added.length, 0);
  assert.equal(again.replaced.length, 3);
  const evidenceAgain = JSON.parse(readFileSync(campaignFile(root, "evidencias.json"), "utf8"));
  assert.equal(evidenceAgain.items.filter((item) => item.kind === "own_result").length, 3);
  const summary = await ok(root, ["evidence", CAMPAIGN]);
  assert.ok(summary.items.some((item) => item.kind === "own_result"));

  // A concept of round 2 may cite the own result as its evidence.
  const data = conceptsFixture();
  data.concepts[0].evidence = [...data.concepts[0].evidence, round.keep[0].result_id];
  writeFileSync(campaignFile(root, "conceitos.json"), JSON.stringify(data, null, 2));
  const concepts = await ok(root, ["concepts", CAMPAIGN]);
  assert.equal(concepts.concepts[0].confidence, "alta");
  assert.ok(JSON.parse(readFileSync(campaignFile(root, "conceitos.json"), "utf8")).concepts[0].evidence.includes(round.keep[0].result_id), "the own result is accepted as evidence of the concept");

  await refused(root, ["round", "next", CAMPAIGN, "--report", "nao-existe.json"], "not_found");
  writeFileSync(join(root, "anuncios", CAMPAIGN, "errado.json"), JSON.stringify({ interface_version: 1, rows: "x" }));
  await refused(root, ["round", "next", CAMPAIGN, "--report", "anuncios/lotus-bf26/errado.json"], "report_invalid");
  const unmatched = JSON.parse(readFileSync(join(FIXTURES, "report.json"), "utf8"));
  unmatched.rows = unmatched.rows.map((row) => ({ ...row, name: `x-${row.name}`, concept: undefined }));
  writeFileSync(join(root, "anuncios", CAMPAIGN, "outro.json"), JSON.stringify(unmatched));
  await refused(root, ["round", "next", CAMPAIGN, "--report", "anuncios/lotus-bf26/outro.json"], "report_unmatched");
});

test("sequence dates the four pieces of the target date by the plan and refuses without a plan", async (t) => {
  const root = project(t);
  await ok(root, ["new", CAMPAIGN]);
  writeFileSync(campaignFile(root, "briefing.md"), BRIEFING);
  const sequence = await ok(root, ["sequence", CAMPAIGN]);
  assert.equal(sequence.plan_slug, "black-friday-2026");
  assert.equal(sequence.pieces.length, 4);
  assert.equal(sequence.pieces[1].date, "2026-11-27");
  assert.equal(sequence.pieces[3].date, "2026-11-30");
  assert.ok(sequence.pieces.every((piece) => piece.copy_check.passed), JSON.stringify(sequence.pieces.map((piece) => piece.copy_check.problems)));
  assert.equal(sequence.pieces[0].formats["4:5"].network, "ads_meta_feed");
  assert.ok(existsSync(join(root, sequence.files.json)));
  const markdown = readFileSync(join(root, sequence.files.markdown), "utf8");
  assert.match(markdown, /# A sequência da data alvo: lotus-bf26/);
  assert.ok(!/[–—!]/.test(markdown));
  assert.equal(sequence.next_step.action, "pieces");

  const bare = project(t, { plan: false });
  await ok(bare, ["new", CAMPAIGN]);
  writeFileSync(join(bare, "anuncios", CAMPAIGN, "briefing.md"), BRIEFING);
  await refused(bare, ["sequence", CAMPAIGN], "plan_missing");
  const help = await run(root, ["help"]);
  assert.ok(help.json.text.includes("round next <campanha>") && help.json.text.includes("sequence <campanha>"));
});
