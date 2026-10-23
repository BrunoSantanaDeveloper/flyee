// Criativos para anúncios 1.2.0, the commands that need no Motor: the briefing filled from the
// approved plan, the matrix, the Google Search ads and the landing page, run as the member's AI
// runs them from a project root.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { hostOf } from "../scripts/lib/campaign.mjs";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(TESTS_DIR, "fixtures");
const SCRIPT = resolve(TESTS_DIR, "..", "scripts", "ads.mjs");
const CAMPAIGN = "lotus-bf26";

function project(t, { plan = true, capture = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "anuncios-120-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  if (plan) {
    mkdirSync(join(root, "media-plan", "black-friday-2026"), { recursive: true });
    cpSync(join(FIXTURES, "plano.json"), join(root, "media-plan", "black-friday-2026", "plano.json"));
    writeFileSync(join(root, "media-plan", "black-friday-2026", "pagina.md"), "# O briefing da página de destino\n\nGuia do plano.\n");
  }
  if (capture) {
    const dir = join(root, "capturas", hostOf("https://www.prontuariolotus.com.br/assinar").replace(/\./g, "-"));
    mkdirSync(dir, { recursive: true });
    cpSync(join(FIXTURES, "captura.json"), join(dir, "captura.json"));
  }
  return root;
}

function run(root, args) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [SCRIPT, ...args, "--json"], { cwd: root, env: { ...process.env }, windowsHide: true });
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

const campaignFile = (root, name) => join(root, "anuncios", CAMPAIGN, name);

test("brief fills the briefing from the approved plan and says which fields came from it", async (t) => {
  const root = project(t);
  await run(root, ["new", CAMPAIGN]);
  const brief = await run(root, ["brief", CAMPAIGN]);
  assert.equal(brief.status, 0, JSON.stringify(brief.json));
  assert.equal(brief.json.plan.plan, "black-friday-2026");
  assert.ok(brief.json.filled_from_plan.length >= 9, brief.json.filled_from_plan.join(","));
  for (const key of ["marca", "oferta", "preco", "pagina", "evento", "verba", "custo_evento", "publico", "datas", "parametros_url"]) assert.equal(brief.json.sources[key], "plano", key);
  assert.deepEqual(brief.json.problems, []);
  assert.equal(brief.json.fields.custo_por_evento, 238.8);
  assert.equal(brief.json.complete, false, "the plan does not answer the competitors or the name rule");
  assert.match(brief.json.next_step.say, /vieram do plano black-friday-2026/);
  const text = readFileSync(campaignFile(root, "briefing.md"), "utf8");
  assert.match(text, /- Verba diária \(em reais\): R\$ 101/);
  assert.match(text, /- Página de destino \(o endereço completo para onde o anúncio leva\): https:\/\/www\.prontuariolotus\.com\.br\/assinar/);
  const again = await run(root, ["brief", CAMPAIGN]);
  assert.deepEqual(again.json.filled_now, [], "the second run fills nothing new");
  assert.equal(again.json.sources.marca, "plano", "the origin is remembered");
  const state = JSON.parse(readFileSync(campaignFile(root, "estado.json"), "utf8"));
  assert.equal(state.brief_sources.verba, "plano");
});

test("without a plan, brief asks as before and marks every present field as the member's", async (t) => {
  const root = project(t, { plan: false, capture: false });
  await run(root, ["new", CAMPAIGN]);
  const brief = await run(root, ["brief", CAMPAIGN]);
  assert.equal(brief.json.plan, null);
  assert.deepEqual(brief.json.filled_from_plan, []);
  assert.match(brief.json.next_step.say, /app de plano/);
});

test("matrix checks matriz.json, writes the table and refuses seven pieces with the path", async (t) => {
  const root = project(t);
  await run(root, ["new", CAMPAIGN]);
  cpSync(join(FIXTURES, "matriz.json"), campaignFile(root, "matriz.json"));
  const matrix = await run(root, ["matrix", CAMPAIGN]);
  assert.equal(matrix.status, 0, JSON.stringify(matrix.json));
  assert.equal(matrix.json.counts.angles, 4);
  assert.equal(matrix.json.counts.pieces, 10);
  assert.equal(matrix.json.counts.needs_recording, 1);
  assert.ok(existsSync(campaignFile(root, "matriz.md")));
  assert.match(matrix.json.next_step.say, /1 a gravar pelo integrante/);
  const thin = JSON.parse(readFileSync(join(FIXTURES, "matriz.json"), "utf8"));
  thin.pieces = thin.pieces.slice(0, 7);
  writeFileSync(campaignFile(root, "matriz.json"), JSON.stringify(thin));
  const refused = await run(root, ["matrix", CAMPAIGN]);
  assert.equal(refused.status, 1);
  assert.equal(refused.json.error.code, "matrix_invalid");
  assert.equal(refused.json.error.details.path, "pieces");
  const noConcepts = project(t, { capture: false });
  await run(noConcepts, ["new", CAMPAIGN]);
  const missing = await run(noConcepts, ["matrix", CAMPAIGN]);
  assert.equal(missing.json.error.code, "concepts_missing", "without matriz.json the matrix comes from the concepts, and there are none yet");
});

test("search checks busca.json against the limits and the briefing's forbidden terms, and writes what the member pastes", async (t) => {
  const root = project(t);
  await run(root, ["new", CAMPAIGN]);
  const missing = await run(root, ["search", CAMPAIGN]);
  assert.equal(missing.json.error.code, "search_missing");
  cpSync(join(FIXTURES, "busca.json"), campaignFile(root, "busca.json"));
  const search = await run(root, ["search", CAMPAIGN]);
  assert.equal(search.status, 0, JSON.stringify(search.json));
  assert.equal(search.json.passed, true, JSON.stringify(search.json.problems));
  assert.equal(search.json.counts.ads, 2);
  assert.ok(existsSync(campaignFile(root, "busca.md")));
  assert.ok(existsSync(campaignFile(root, "busca-conferida.json")));
  const long = JSON.parse(readFileSync(join(FIXTURES, "busca.json"), "utf8"));
  long.campaigns[0].ad_groups[0].ads[0].headlines[1] = "Prontuário para acupunturistas x";
  writeFileSync(campaignFile(root, "busca.json"), JSON.stringify(long));
  const refused = await run(root, ["search", CAMPAIGN]);
  assert.equal(refused.json.passed, false);
  assert.ok(refused.json.problems.some((problem) => problem.rule === "too_long"));
  assert.equal(refused.json.next_step.action, "fix");
  let text = readFileSync(campaignFile(root, "briefing.md"), "utf8");
  text = text.replace("- Termos proibidos (palavras e promessas, separadas por vírgula; ou nenhum):", "- Termos proibidos (palavras e promessas, separadas por vírgula; ou nenhum): migração");
  writeFileSync(campaignFile(root, "briefing.md"), text);
  cpSync(join(FIXTURES, "busca.json"), campaignFile(root, "busca.json"));
  const forbidden = await run(root, ["search", CAMPAIGN]);
  assert.ok(forbidden.json.problems.some((problem) => problem.rule === "forbidden_term" && problem.quote === "migração"));
});

test("page brief writes the briefing of the landing page from the plan; page audit reads the capture, or asks for one", async (t) => {
  const root = project(t);
  await run(root, ["new", CAMPAIGN]);
  await run(root, ["brief", CAMPAIGN]);
  const brief = await run(root, ["page", "brief", CAMPAIGN]);
  assert.equal(brief.status, 0, JSON.stringify(brief.json));
  assert.equal(brief.json.plan.plan, "black-friday-2026");
  assert.ok(brief.json.open_decisions >= 5);
  const markdown = readFileSync(campaignFile(root, "pagina-briefing.md"), "utf8");
  assert.match(markdown, /Preço de referência verdadeiro: R\$ 1\.990/);
  assert.match(markdown, /media-plan\/black-friday-2026\/pagina\.md/);
  const audit = await run(root, ["page", "audit", CAMPAIGN]);
  assert.equal(audit.status, 0, JSON.stringify(audit.json));
  const by = Object.fromEntries(audit.json.items.map((item) => [item.id, item.status]));
  assert.equal(by.chamado_acima_da_dobra, "ok");
  assert.equal(by.precos, "ok");
  assert.equal(by.prazo, "ok");
  assert.equal(by.titulo_em_comum, "nao_conferido", "no concepts yet");
  assert.equal(by.utm_preservada, "nao_conferido");
  assert.ok(existsSync(campaignFile(root, "pagina-conferida.json")));
  const bad = await run(root, ["page", "fix", CAMPAIGN]);
  assert.equal(bad.json.error.code, "usage");
  const noCapture = project(t, { capture: false });
  await run(noCapture, ["new", CAMPAIGN]);
  await run(noCapture, ["brief", CAMPAIGN]);
  const refused = await run(noCapture, ["page", "audit", CAMPAIGN]);
  assert.equal(refused.json.error.code, "capture_missing");
});
