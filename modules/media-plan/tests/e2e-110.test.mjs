// 1.1.0 as the member's AI runs it: channels, structure, rules, the plan with their sections, and
// the replan from the measurement app's weekly read.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, "..", "scripts", "plan.mjs");
const PREMISES = readFileSync(join(HERE, "fixtures", "premissas-agenda-leve.json"), "utf8");
const WEEKLY = join(HERE, "fixtures", "semanal-ads-insights.json");
const PLAN = "black-friday-2026";
const TODAY = "--today=2026-10-23";

function project() {
  return mkdtempSync(join(tmpdir(), "mp-110-"));
}

function run(root, args, { json = true } = {}) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [SCRIPT, ...args, ...(json ? ["--json"] : [])], { cwd: root, env: { ...process.env }, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", fail);
    child.on("close", (status) => {
      if (!json) return done({ status, stdout, stderr });
      try {
        done({ status, json: JSON.parse(stdout), stderr });
      } catch {
        fail(new Error(`no JSON from ${args.join(" ")}: ${stdout} ${stderr}`));
      }
    });
  });
}

const planDir = (root) => join(root, "media-plan", PLAN);
const read = (root, file) => readFileSync(join(planDir(root), file), "utf8");

async function settledPlan(mutate = null) {
  const root = project();
  await run(root, ["new", PLAN, "--brand", "Agenda Leve", "--target", "2026-11-27"]);
  const data = JSON.parse(PREMISES);
  for (const key of ["produto_oferta", "verba", "evento"]) data.premises[key].source = "confirmado";
  if (mutate) mutate(data);
  writeFileSync(join(planDir(root), "premissas.json"), JSON.stringify(data, null, 2));
  return root;
}

test("channels, structure and rules write their files, chain their next steps and enter the plan as sections", async () => {
  const root = await settledPlan((data) => (data.premises.evento.cost_brl = 30));
  const channels = await run(root, ["channels", PLAN, TODAY, "--hours", "10"]);
  assert.equal(channels.status, 0, JSON.stringify(channels.json));
  assert.equal(channels.json.next_step.action, "structure");
  assert.equal(channels.json.hours.available, 10);
  assert.ok(existsSync(join(root, channels.json.file)));
  assert.equal(channels.json.rows.find((row) => row.channel === "email").verdict, "run");

  const refused = await run(root, ["structure", PLAN, TODAY]);
  assert.equal(refused.status, 1);
  assert.equal(refused.json.error.code, "structure_invalid");
  assert.equal(refused.json.error.details.exits.length, 3);

  const structure = await run(root, ["structure", PLAN, TODAY, "--accept-floor"]);
  assert.equal(structure.status, 0, JSON.stringify(structure.json));
  assert.equal(structure.json.next_step.action, "rules");
  assert.equal(structure.json.channels.meta.ad_sets[0].clears_floor, false);
  assert.ok(existsSync(join(planDir(root), "estrutura.json")));

  const rules = await run(root, ["rules", PLAN, TODAY]);
  assert.equal(rules.status, 0);
  assert.equal(rules.json.next_step.action, "plan");
  assert.equal(rules.json.triggers.length, 5);
  assert.ok(existsSync(join(planDir(root), "regras.json")));

  const plan = await run(root, ["plan", PLAN, TODAY]);
  assert.equal(plan.status, 0, JSON.stringify(plan.json));
  assert.ok(plan.json.files.channels && plan.json.files.structure && plan.json.files.rules);
  const markdown = read(root, "plano.md");
  for (const heading of ["## Canais", "## Estrutura", "## Regras de decisão"]) assert.ok(markdown.includes(heading), heading);
  const written = JSON.parse(read(root, "plano.json"));
  assert.equal(written.structure.meta.objective, "Cadastros (leads)");
  assert.equal(written.rules.sample.results, 30);
  assert.equal(written.triggers.length, 5);
  assert.ok(written.channels_decision.rows.length >= 8);
  assert.ok(plan.json.in_short_words <= 150);

  const bad = await run(root, ["channels", PLAN, TODAY, "--hours", "zero"]);
  assert.equal(bad.json.error.code, "usage");
});

test("the calendar now points to the channels, and structure without channels decides them inline", async () => {
  const root = await settledPlan();
  const calendar = await run(root, ["calendar", PLAN, TODAY]);
  assert.equal(calendar.json.next_step.action, "channels");
  const structure = await run(root, ["structure", PLAN, TODAY, "--accept-floor"]);
  assert.equal(structure.status, 0, JSON.stringify(structure.json));
  assert.ok(structure.json.channels.meta);
  assert.ok(!existsSync(join(planDir(root), "canais.json")), "structure does not write the channels file for channels");
});

test("replan reads the weekly file, raises the version as a draft with what changed on top, freezes nothing approved and logs the decision", async () => {
  const root = await settledPlan();
  const built = await run(root, ["plan", PLAN, TODAY]);
  assert.equal(built.status, 0);
  const approved = await run(root, ["approve", PLAN, "--by", "Aprovado, pode seguir."]);
  assert.equal(approved.status, 0, JSON.stringify(approved.json));
  const frozen = read(root, "plano-v1.md");

  const missing = await run(root, ["replan", PLAN, "--from", "ads-insights/semanal/2026-11-13.json", "--today=2026-11-16"]);
  assert.equal(missing.json.error.code, "weekly_missing");
  const noFrom = await run(root, ["replan", PLAN]);
  assert.equal(noFrom.json.error.code, "usage");
  writeFileSync(join(root, "nao-e-semanal.json"), JSON.stringify({ interface_version: 1, findings: "x" }));
  const invalid = await run(root, ["replan", PLAN, "--from", "nao-e-semanal.json"]);
  assert.equal(invalid.json.error.code, "weekly_invalid");

  const replan = await run(root, ["replan", PLAN, "--from", WEEKLY, "--today=2026-11-16"]);
  assert.equal(replan.status, 0, JSON.stringify(replan.json));
  assert.equal(replan.json.version, 2);
  assert.equal(replan.json.state, "rascunho");
  assert.equal(replan.json.week_of, "2026-11-13");
  assert.ok(replan.json.changes.length >= 4);
  assert.equal(replan.json.say.length, 3);
  assert.equal(replan.json.next_step.action, "approve");
  const version2 = read(root, "plano-v2.md");
  assert.match(version2, /## O que mudou e por quê \(versão 2, da leitura de 13\/11\/2026\)/);
  assert.match(version2, /Versão 2, rascunho/);
  assert.equal(read(root, "plano-v1.md"), frozen, "the approved version stays as it was");
  const plan = JSON.parse(read(root, "plano.json"));
  assert.equal(plan.version, 2);
  assert.equal(plan.state, "rascunho");
  assert.equal(plan.replan.previous_version, 1);
  assert.equal(plan.replan.previous_state, "aprovado");
  assert.match(read(root, "decisoes.md"), /versão 2 nasce como rascunho da leitura semanal de 13\/11\/2026/);

  // Building the draft again keeps the "what changed" section until it is approved.
  const again = await run(root, ["plan", PLAN, "--today=2026-11-16"]);
  assert.equal(again.json.version, 2);
  assert.match(read(root, "plano.md"), /## O que mudou e por quê/);
  const approvedAgain = await run(root, ["approve", PLAN, "--by", "Sim, versão 2 aprovada."]);
  assert.equal(approvedAgain.json.version, 2);
  assert.match(read(root, "plano-v2.md"), /aprovado em 20\d\d-\d\d-\d\d/);
  const status = await run(root, ["status", PLAN]);
  assert.equal(status.json.stage, "aprovado");
});

test("the 1.1.0 files carry no dash and no exclamation mark, and help names the new commands", async () => {
  const root = await settledPlan((data) => (data.premises.evento.cost_brl = 30));
  await run(root, ["channels", PLAN, TODAY]);
  await run(root, ["structure", PLAN, TODAY, "--accept-floor"]);
  await run(root, ["rules", PLAN, TODAY]);
  await run(root, ["plan", PLAN, TODAY]);
  await run(root, ["replan", PLAN, "--from", WEEKLY, "--today=2026-11-16"]);
  for (const file of ["plano.md", "plano-v2.md", "decisoes.md"]) {
    const text = read(root, file);
    assert.ok(!/[–—]/.test(text), `${file} has a dash`);
    assert.ok(!/!/.test(text), `${file} has an exclamation mark`);
  }
  for (const file of ["canais.json", "estrutura.json", "regras.json", "plano.json"]) {
    const text = read(root, file);
    assert.ok(!/[–—]/.test(text), `${file} has a dash`);
  }
  const help = await run(root, ["help"], { json: false });
  for (const word of ["channels <plano>", "structure <plano> [--accept-floor]", "rules <plano>", "replan <plano> --from"]) assert.ok(help.stdout.includes(word), word);
});
