// The reading of a campaign that already ran, as a member asks for it with no contract and no
// plan: the script hands out the questions, the AI asks them in one message, and the test counts
// the rounds. It also checks that a column is asked only when it changes a verdict, and that two
// numbers from the member's system stand in for the sign-up list in the weekly read.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { columnAsks, eventStage, exportKind, intakeQuestions } from "../scripts/lib/intake.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");
const SCRIPT = resolve(HERE, "..", "scripts", "insights.mjs");
const COLUMNS = JSON.parse(await import("node:fs").then((fs) => fs.readFileSync(resolve(HERE, "..", "references", "colunas.json"), "utf8")));
const COLUMN_WORDS = /coluna|Cliques no link|Reprodu|ThruPlay|Impress|Valor usado|CTR|Frequ/i;

function run(root, args) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [SCRIPT, ...args, "--json"], { cwd: root, env: { ...process.env }, windowsHide: true });
    let stdout = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.on("error", fail);
    child.on("close", (status) => {
      try {
        done({ status, json: JSON.parse(stdout) });
      } catch {
        fail(new Error(`no JSON from ${args.join(" ")}: ${stdout}`));
      }
    });
  });
}

/** A project like a member's after a first campaign: the ad creatives' budget sum, no plan, no contract. */
function memberProject() {
  const root = mkdtempSync(join(tmpdir(), "ai-intake-"));
  mkdirSync(join(root, ".flyee"), { recursive: true });
  mkdirSync(join(root, "anuncios", "pre-venda"), { recursive: true });
  writeFileSync(join(root, "anuncios", "pre-venda", "verba.json"), JSON.stringify({ daily: 60, event: "Compra", cost_per_event: 40, computed_at: "2026-10-24T12:00:00.000Z" }));
  return root;
}

test("a reading with no contract and no plan takes one round: the export, the two numbers and the allowable with its suggestion", async () => {
  const root = memberProject();
  let rounds = 0;

  // Round 1: what the AI asks before anything.
  const first = await run(root, ["intake"]);
  assert.equal(first.status, 0, JSON.stringify(first.json));
  assert.equal(first.json.found.stage, "compra");
  assert.deepEqual(first.json.questions.map((item) => item.key), ["export", "counts", "allowable"]);
  assert.ok(first.json.questions.length <= 4);
  for (const item of first.json.questions) assert.doesNotMatch(item.question, COLUMN_WORDS, `no column list in the question: ${item.question}`);
  const allowable = first.json.questions.find((item) => item.key === "allowable");
  assert.equal(allowable.suggestion, 40);
  assert.equal(allowable.yes_accepts, true);
  assert.equal(first.json.next_step.action, "ask");
  rounds += 1;

  // The member answers in one message: saves the export, says "sim" and gives the two numbers.
  cpSync(join(FIXTURES, "export-meta-pt.csv"), join(root, "ads-insights", "entrada", "export-meta-pt.csv"));
  const yes = await run(root, ["intake", "--allowable", "40"]);
  assert.deepEqual(yes.json.recorded, ["allowable"]);
  assert.equal(yes.json.next_step.action, "import", "the export in the inbox is imported before anything else is asked");
  // The command as the script wrote it: node <script> import <file> --source meta --json.
  const imported = await run(root, [...yes.json.next_step.command.split(" ").slice(2, -1)]);
  assert.equal(imported.status, 0, JSON.stringify(imported.json));
  const numbers = await run(root, ["intake", "--total", "14", "--from-ads", "6"]);
  assert.deepEqual(numbers.json.recorded, ["counts"]);
  assert.deepEqual(numbers.json.found.counts.period, { start: "2026-10-30", end: "2026-11-12" }, "the numbers take the period of the export");
  assert.equal(numbers.json.questions.length, 0, "nothing comes back as a question once answered");
  assert.equal(numbers.json.next_step.action, "report");

  const report = await run(root, ["report", imported.json.reading]);
  assert.equal(report.status, 0, JSON.stringify(report.json));
  assert.equal(report.json.allowable_brl, 40);
  assert.deepEqual(report.json.asks, [], "a full export asks for no column");
  assert.equal(rounds, 1, "the whole reading asked the member once");
});

test("the weekly read runs without a contract and sets the platform's claim against the two numbers", async () => {
  const root = memberProject();
  mkdirSync(join(root, "ads-insights", "entrada"), { recursive: true });
  writeFileSync(join(root, "ads-insights", "entrada", "compras.csv"), "Nome do anúncio;Valor usado (BRL);Impressões;Cliques no link;Visualizações da página de destino;Reproduções de vídeo de 3 segundos;Compras\npeca-a-v1;400,00;20.000;300;250;6.000;9\npeca-b-v1;200,00;9.000;120;100;2.500;3\n");
  const imported = await run(root, ["import", "ads-insights/entrada/compras.csv", "--source", "meta", "--period", "2026-10-26..2026-11-03"]);
  assert.equal(imported.status, 0, JSON.stringify(imported.json));
  await run(root, ["intake", "--allowable", "40", "--total", "14", "--from-ads", "6"]);
  await run(root, ["report", imported.json.reading]);
  const weekly = await run(root, ["weekly", "--today", "2026-11-16"]);
  assert.equal(weekly.status, 0, JSON.stringify(weekly.json));
  assert.equal(weekly.json.claim_ratio, 2, "12 purchases claimed against 6 from the ads");
  assert.ok(weekly.json.not_checked.some((line) => /dois números informados/.test(line)));
  assert.ok(!weekly.json.not_checked.some((line) => /planilha de origem está vazia/.test(line)));
});

test("a column is asked only when its absence changes a verdict of the table", async () => {
  const root = memberProject();
  mkdirSync(join(root, "ads-insights", "entrada"), { recursive: true });
  await run(root, ["intake", "--allowable", "40"]);
  // Link CTR of 0,3%: with the 3-second plays the reading could say whether the hook or the middle fails.
  writeFileSync(join(root, "ads-insights", "entrada", "sem-video.csv"), "Nome do anúncio;Valor usado (BRL);Impressões;Cliques no link;Resultados\npeca-a-v1;300,00;20.000;60;2\n");
  const thin = await run(root, ["import", "ads-insights/entrada/sem-video.csv", "--source", "meta", "--name", "sem-video"]);
  const judged = await run(root, ["report", thin.json.reading]);
  assert.equal(judged.json.rows[0].verdict, "iterar");
  assert.deepEqual(judged.json.asks.map((ask) => ask.field), ["video_plays_3s"]);
  assert.match(judged.json.asks[0].where, /Personalizar colunas/);
  assert.equal(judged.json.next_step.action, "ask");

  // Same columns, but the piece sells within the allowable: the 3-second plays change nothing.
  writeFileSync(join(root, "ads-insights", "entrada", "sem-video-bom.csv"), "Nome do anúncio;Valor usado (BRL);Impressões;Cliques no link;Resultados\npeca-b-v1;520,00;26.000;390;36\n");
  const good = await run(root, ["import", "ads-insights/entrada/sem-video-bom.csv", "--source", "meta", "--name", "sem-video-bom"]);
  const fine = await run(root, ["report", good.json.reading]);
  assert.deepEqual(fine.json.asks, []);
  assert.equal(fine.json.next_step.action, "weekly");
});

test("intake pieces: the event's stage, the export detector reads the header only, at most three questions", () => {
  assert.equal(eventStage("Compra da assinatura"), "compra");
  assert.equal(eventStage("Cadastro concluído"), "cadastro");
  assert.equal(eventStage("Lead: a entrada na lista de espera"), "lead");
  assert.equal(eventStage(null), null);
  assert.equal(exportKind("e-mail;data;origem\nana@exemplo.test;2026-11-01;meta\n", COLUMNS), null, "a sign-up list is not an export");
  assert.equal(exportKind("Nome do anúncio;Valor usado (BRL);Impressões\n", COLUMNS).level, "ad");
  const all = intakeQuestions({ exportFound: false, reading: null, stage: "cadastro", counts: null, allowable: null, allowableSuggestion: null, period: { start: "2026-10-26", end: "2026-11-03" } });
  assert.equal(all.length, 3);
  assert.match(all[1].question, /de 26\/10\/2026 a 03\/11\/2026/);
  assert.equal(all[2].yes_accepts, false, "with no suggestion, a yes accepts nothing");
  const none = intakeQuestions({ exportFound: true, reading: null, stage: null, counts: null, allowable: 40, allowableSuggestion: null, period: null });
  assert.deepEqual(none, []);
  const asks = columnAsks({ source: "meta", fields: ["ad_name", "spend", "impressions"], rows: [], event: "Compra" });
  assert.deepEqual(asks.map((ask) => ask.field), ["purchases", "link_clicks"], "the event's own column, then the clicks");
});
