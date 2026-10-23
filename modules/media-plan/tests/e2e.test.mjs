// The script as the member's AI runs it, from the root of a project: what each command writes,
// what it answers, which errors come back with a stable code, and that only JSON reaches stdout.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, "..", "scripts", "plan.mjs");
const PREMISES = readFileSync(join(HERE, "fixtures", "premissas-agenda-leve.json"), "utf8");
const NARRATIVE = readFileSync(join(HERE, "fixtures", "narrativa-agenda-leve.json"), "utf8");
const PLAN = "black-friday-2026";
const TODAY = "--today=2026-10-23";

function project() {
  return mkdtempSync(join(tmpdir(), "mp-projeto-"));
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
const writePremises = (root, mutate = null) => {
  const data = JSON.parse(PREMISES);
  if (mutate) mutate(data);
  writeFileSync(join(planDir(root), "premissas.json"), JSON.stringify(data, null, 2));
};
const settle = (data) => {
  for (const key of ["produto_oferta", "verba", "evento"]) data.premises[key].source = "confirmado";
};

test("check and list on an empty project point to new; help prints the commands", async () => {
  const root = project();
  const check = await run(root, ["check"]);
  assert.equal(check.status, 0);
  assert.equal(check.json.ok, true);
  assert.equal(check.json.ready, true);
  assert.deepEqual(check.json.plans, []);
  assert.equal(check.json.next_step.action, "new");
  assert.equal(check.json.app.name, "media-plan");
  const list = await run(root, ["list"]);
  assert.deepEqual(list.json.plans, []);
  const help = await run(root, ["help"], { json: false });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /approve <plano> --by/);
});

test("new creates the plan folder, the premises template, the decisions file and the brand file once", async () => {
  const root = project();
  const { status, json } = await run(root, ["new", "Black Friday 2026", "--brand", "Agenda Leve", "--target", "2026-11-27"]);
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.plan, PLAN);
  assert.equal(json.brand_file_created, true);
  assert.equal(json.target_date, "2026-11-27");
  assert.equal(json.next_step.action, "look");
  for (const file of Object.values(json.files)) assert.ok(existsSync(join(root, file)), file);
  const premises = JSON.parse(read(root, "premissas.json"));
  assert.equal(premises.brand, "Agenda Leve");
  assert.equal(premises.target_date, "2026-11-27");
  assert.equal(Object.keys(premises.premises).length, 10);
  const again = await run(root, ["new", PLAN]);
  assert.equal(again.status, 1);
  assert.equal(again.json.error.code, "plan_exists");
  const other = await run(root, ["new", "lancamento"]);
  assert.equal(other.json.brand_file_created, false);
  assert.equal(other.json.target_date, null);
  const list = await run(root, ["list"]);
  assert.deepEqual(list.json.plans.map((plan) => plan.plan), [PLAN, "lancamento"]);
});

test("look on a fresh project finds nothing, leaves the four blocking questions and names the premises file", async () => {
  const root = project();
  await run(root, ["new", PLAN, "--target", "2026-11-27"]);
  const { status, json } = await run(root, ["look", PLAN]);
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.found.length, 0);
  assert.deepEqual(json.questions.map((question) => question.key), ["produto_oferta", "publico", "meta_data", "verba"]);
  assert.equal(json.more_pending, 6);
  assert.equal(json.next_step.action, "fill_premises");
  assert.match(json.next_step.say, /4 pergunta\(s\)/);
  assert.ok(json.looked.length >= 5);
});

test("look reads a creatives briefing and a capture, so those premises are answered by the project", async () => {
  const root = project();
  await run(root, ["new", PLAN, "--target", "2026-11-27"]);
  mkdirSync(join(root, "anuncios", "pre-lancamento"), { recursive: true });
  writeFileSync(join(root, "anuncios", "pre-lancamento", "briefing.md"), "# Briefing\n\n- Oferta: anual pelo preço de 10 meses\n- Preço: R$ 149 por mês\n- Público: nutricionistas de consultório\n- Página: https://exemplo.test/oferta\n- Verba diária: R$ 125\n- Evento de otimização: Lead\n");
  mkdirSync(join(root, "capturas", "oferta"), { recursive: true });
  writeFileSync(join(root, "capturas", "oferta", "captura.json"), JSON.stringify({ url: "https://exemplo.test/oferta", captured_at: "2026-10-20", raw: { prices: ["R$ 149"], headings: [{ tag: "h1", text: "Agenda Leve" }], cta: "Começar" } }));
  const { json } = await run(root, ["look", PLAN]);
  assert.ok(json.found.length >= 6);
  assert.ok(json.hints.produto_oferta.some((hint) => hint.value === "anual pelo preço de 10 meses" && hint.where === "anuncios/pre-lancamento/briefing.md"));
  assert.equal(json.hints.preco_planos[0].price_brl, 149);
  assert.equal(json.hints.verba[0].daily_brl, 125);
  assert.ok(json.hints.prontidao.some((hint) => hint.value === "https://exemplo.test/oferta"));
  assert.deepEqual(json.answered_by_project, ["produto_oferta", "publico", "verba"]);
  assert.deepEqual(json.questions.map((question) => question.key), ["meta_data"]);
});

test("premises tells what is settled and pending, with the suggestions, and asks in one message", async () => {
  const root = project();
  await run(root, ["new", PLAN, "--target", "2026-11-27"]);
  writePremises(root);
  const { status, json } = await run(root, ["premises", PLAN]);
  assert.equal(status, 0, JSON.stringify(json));
  assert.deepEqual(json.blocking_pending, ["produto_oferta", "verba", "evento"]);
  assert.equal(json.settled.length, 7);
  assert.equal(json.next_step.action, "ask");
  assert.match(json.next_step.say, /numa mensagem só, cada pergunta com a sua sugestão/);
  assert.ok(json.questions.every((question) => question.suggestion && question.if_different));
  writePremises(root, settle);
  const settled = await run(root, ["premises", PLAN]);
  assert.deepEqual(settled.json.blocking_pending, []);
  assert.equal(settled.json.next_step.action, "funnel");
});

test("a broken premises file is refused with the path, not a stack", async () => {
  const root = project();
  await run(root, ["new", PLAN]);
  writePremises(root, (data) => {
    data.premises.verba.if_different = "";
  });
  const { status, json } = await run(root, ["premises", PLAN]);
  assert.equal(status, 1);
  assert.equal(json.error.code, "premises_invalid");
  assert.equal(json.error.details.path, "premises.verba.if_different");
  writeFileSync(join(planDir(root), "premissas.json"), "{ not json");
  const broken = await run(root, ["premises", PLAN]);
  assert.equal(broken.json.error.code, "premises_invalid");
});

test("funnel, offer and calendar write their files and answer with the numbers of the Agenda Leve case", async () => {
  const root = project();
  await run(root, ["new", PLAN, "--target", "2026-11-27"]);
  writePremises(root);
  const funnel = await run(root, ["funnel", PLAN, TODAY]);
  assert.equal(funnel.status, 0, JSON.stringify(funnel.json));
  assert.equal(funnel.json.economics.allowable_cac_brl, 1430.4);
  assert.equal(funnel.json.funnel.from_known, 19);
  assert.equal(funnel.json.funnel.cold_goal, 11);
  assert.equal(funnel.json.budget.days, 32);
  assert.equal(funnel.json.budget.daily_brl, 125);
  assert.equal(funnel.json.learning_floor.viable, false);
  assert.equal(funnel.json.learning_floor.max_cost_per_event_brl, 17.5);
  assert.match(funnel.json.say, /Um cliente pode custar até R\$ 1\.430,40/);
  assert.ok(existsSync(join(planDir(root), "cenarios.json")));
  assert.equal(funnel.json.next_step.action, "offer");

  const offer = await run(root, ["offer", PLAN]);
  assert.equal(offer.status, 0);
  assert.equal(offer.json.collision.kind, "colisao");
  assert.equal(offer.json.collision.gap_days, 24);
  assert.equal(offer.json.options[0].id, "anual-10-meses");
  assert.ok(existsSync(join(planDir(root), "oferta.json")));
  assert.equal(offer.json.next_step.action, "calendar");

  const calendar = await run(root, ["calendar", PLAN, TODAY]);
  assert.equal(calendar.status, 0);
  assert.deepEqual(calendar.json.phases.map((phase) => phase.id), ["preparacao", "testes", "escala", "aquecimento", "pico", "depois"]);
  assert.equal(calendar.json.decision_point.date, "2026-11-13");
  assert.deepEqual(calendar.json.holidays.map((holiday) => holiday.date), ["2026-11-02", "2026-11-15", "2026-11-20"]);
  assert.equal(JSON.parse(read(root, "calendario.json")).plan, PLAN);
  assert.equal(calendar.json.next_step.action, "channels");

  const launch = await run(root, ["calendar", PLAN, TODAY, "--launch"]);
  assert.equal(launch.json.peak, false);
  assert.equal(launch.json.phases.find((phase) => phase.id === "pico").days, 1);
});

test("calendar without a target date and commands on a missing plan come back as stable codes", async () => {
  const root = project();
  await run(root, ["new", PLAN]);
  writePremises(root, (data) => {
    data.target_date = null;
  });
  const calendar = await run(root, ["calendar", PLAN, TODAY]);
  assert.equal(calendar.status, 1);
  assert.equal(calendar.json.error.code, "target_missing");
  const missing = await run(root, ["look", "outro-plano"]);
  assert.equal(missing.json.error.code, "plan_missing");
  const unknown = await run(root, ["dance", PLAN]);
  assert.equal(unknown.json.error.code, "usage");
  const noName = await run(root, ["status"]);
  assert.equal(noName.json.error.code, "usage");
  const funnel = await run(root, ["funnel", PLAN]);
  assert.equal(funnel.status, 0, "the funnel works without a date: the window defaults to 30 days");
  assert.equal(funnel.json.budget.days, 30);
});

test("plan builds the draft with or without a narrative, keeps the summary short and refuses a narrative that promises", async () => {
  const root = project();
  await run(root, ["new", PLAN, "--target", "2026-11-27"]);
  writePremises(root);
  const bare = await run(root, ["plan", PLAN, TODAY]);
  assert.equal(bare.status, 0, JSON.stringify(bare.json));
  assert.equal(bare.json.state, "rascunho");
  assert.equal(bare.json.version, 1);
  assert.deepEqual(bare.json.blocking_pending, ["produto_oferta", "verba", "evento"]);
  assert.equal(bare.json.next_step.action, "ask");
  assert.ok(existsSync(join(planDir(root), "plano.md")));
  assert.ok(existsSync(join(planDir(root), "plano.json")));

  writeFileSync(join(planDir(root), "narrativa.json"), NARRATIVE);
  const told = await run(root, ["plan", PLAN, TODAY]);
  assert.equal(told.status, 0, JSON.stringify(told.json));
  assert.ok(told.json.in_short_words <= 150);
  assert.equal(told.json.say.length, 3);
  const markdown = read(root, "plano.md");
  assert.match(markdown, /## Em resumo/);
  assert.match(markdown, /rascunho/);
  assert.ok(!/[–—!]/.test(markdown));
  const plan = JSON.parse(read(root, "plano.json"));
  assert.equal(plan.interface_version, 1);
  assert.equal(plan.moves[0].what, JSON.parse(NARRATIVE).first_move);
  assert.equal(plan.offer.collision.kind, "colisao");
  assert.equal(plan.calendar.decision_point.date, "2026-11-13");

  const bad = JSON.parse(NARRATIVE);
  bad.findings[0].text = "Resultado garantido: a meta vai vender sozinha.";
  writeFileSync(join(planDir(root), "narrativa.json"), JSON.stringify(bad));
  const refused = await run(root, ["plan", PLAN, TODAY]);
  assert.equal(refused.status, 1);
  assert.equal(refused.json.error.code, "narrative_invalid");
  assert.ok(refused.json.error.details.problems.some((problem) => /promete resultado/.test(problem)));

  const long = JSON.parse(NARRATIVE);
  long.findings = long.findings.map((finding) => ({ ...finding, text: `${finding.text} ${"palavra ".repeat(60).trim()}.` }));
  writeFileSync(join(planDir(root), "narrativa.json"), JSON.stringify(long));
  const tooLong = await run(root, ["plan", PLAN, TODAY]);
  assert.equal(tooLong.json.error.code, "in_short_long");
  assert.ok(tooLong.json.error.details.words > 150);
});

test("approve needs the member's sentence and settled blocking premises; it freezes the version and logs the decision", async () => {
  const root = project();
  await run(root, ["new", PLAN, "--target", "2026-11-27"]);
  writePremises(root);
  writeFileSync(join(planDir(root), "narrativa.json"), NARRATIVE);
  const early = await run(root, ["approve", PLAN, "--by", "Pode aprovar."]);
  assert.equal(early.json.error.code, "plan_not_built");
  await run(root, ["plan", PLAN, TODAY]);
  const noPhrase = await run(root, ["approve", PLAN]);
  assert.equal(noPhrase.json.error.code, "usage");
  const pending = await run(root, ["approve", PLAN, "--by", "Pode aprovar."]);
  assert.equal(pending.status, 1);
  assert.equal(pending.json.error.code, "premises_pending");
  assert.deepEqual(pending.json.error.details.pending, ["produto_oferta", "verba", "evento"]);

  writePremises(root, settle);
  const rebuilt = await run(root, ["plan", PLAN, TODAY]);
  assert.equal(rebuilt.json.next_step.action, "approve");
  const status = await run(root, ["status", PLAN]);
  assert.equal(status.json.stage, "pronto");
  const approved = await run(root, ["approve", PLAN, "--by", "Aprovado, pode seguir com a oferta anual."]);
  assert.equal(approved.status, 0, JSON.stringify(approved.json));
  assert.equal(approved.json.state, "aprovado");
  assert.equal(approved.json.version, 1);
  assert.equal(approved.json.next_step.action, "handoff");
  assert.ok(existsSync(join(planDir(root), "plano-v1.json")));
  assert.ok(existsSync(join(planDir(root), "plano-v1.md")));
  assert.match(read(root, "decisoes.md"), /versão 1 aprovada\. Frase do integrante: "Aprovado, pode seguir com a oferta anual\."/);
  assert.match(read(root, "plano.md"), /aprovado em \d{4}-\d{2}-\d{2}/);
  assert.equal(JSON.parse(read(root, "plano.json")).approved_by, "Aprovado, pode seguir com a oferta anual.");

  const twice = await run(root, ["approve", PLAN, "--by", "De novo."]);
  assert.equal(twice.json.error.code, "already_approved");
  const after = await run(root, ["status", PLAN]);
  assert.equal(after.json.stage, "aprovado");
  const next = await run(root, ["plan", PLAN, TODAY]);
  assert.equal(next.json.version, 2);
  assert.equal(next.json.state, "rascunho");
  assert.equal(JSON.parse(read(root, "plano-v1.json")).state, "aprovado", "the frozen version does not move");
  const list = await run(root, ["list"]);
  assert.equal(list.json.plans[0].version, 2);
});

test("status follows the stages: novo, premissas, contas, rascunho", async () => {
  const root = project();
  await run(root, ["new", PLAN, "--target", "2026-11-27"]);
  assert.equal((await run(root, ["status", PLAN])).json.stage, "novo");
  writePremises(root);
  assert.equal((await run(root, ["status", PLAN])).json.stage, "premissas");
  await run(root, ["funnel", PLAN, TODAY]);
  assert.equal((await run(root, ["status", PLAN])).json.stage, "contas");
  await run(root, ["plan", PLAN, TODAY]);
  const draft = await run(root, ["status", PLAN]);
  assert.equal(draft.json.stage, "rascunho");
  assert.equal(draft.json.next_step.action, "ask");
  const text = await run(root, ["status", PLAN], { json: false });
  assert.match(text.stdout, /etapa rascunho/);
  assert.match(text.stdout, /Próximo passo:/);
});

test("the files the script writes carry no dash and no exclamation mark, as the store's copy rules ask", async () => {
  const root = project();
  await run(root, ["new", PLAN, "--target", "2026-11-27"]);
  writePremises(root, settle);
  writeFileSync(join(planDir(root), "narrativa.json"), NARRATIVE);
  await run(root, ["plan", PLAN, TODAY]);
  for (const file of ["plano.md", "decisoes.md"]) assert.ok(!/[–—!]/.test(read(root, file)), file);
  assert.ok(!/[–—!]/.test(readFileSync(join(root, "media-plan", "marca.md"), "utf8")));
});
