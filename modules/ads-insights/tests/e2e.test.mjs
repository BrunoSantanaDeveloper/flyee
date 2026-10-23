// The script as the member's AI runs it, from the root of a project with the approved plan and
// the synthetic fixtures: what each command writes, what it answers, the stable error codes, and
// that no personal data ever reaches a file the app writes.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");
const SCRIPT = resolve(HERE, "..", "scripts", "insights.mjs");
const NAMES = "anuncios/black-friday-2026/entrega/nomes.json";

/** A project with the approved plan, the delivered names and the exports in the inbox. */
function project({ plan = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "ai-projeto-"));
  mkdirSync(join(root, "ads-insights", "entrada"), { recursive: true });
  mkdirSync(join(root, "anuncios", "black-friday-2026", "entrega"), { recursive: true });
  if (plan) {
    mkdirSync(join(root, "media-plan", "black-friday-2026"), { recursive: true });
    cpSync(join(FIXTURES, "plano-aprovado.json"), join(root, "media-plan", "black-friday-2026", "plano.json"));
  }
  for (const file of ["export-meta-pt.csv", "export-meta-en.csv", "export-meta-sem-video.csv", "export-google-termos-pt.csv", "export-meta-dia.csv", "leads.csv", "pagina-com-tags.html", "pagina-vazia.html"]) cpSync(join(FIXTURES, file), join(root, "ads-insights", "entrada", file));
  cpSync(join(FIXTURES, "nomes.json"), join(root, NAMES));
  return root;
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

const readAt = (root, file) => readFileSync(join(root, file), "utf8");

/** Fills the three required unknowns of the contract, as the AI does after asking. */
function settleContract(root) {
  const path = join(root, "ads-insights", "medicao.json");
  const data = JSON.parse(readAt(root, "ads-insights/medicao.json"));
  data.items.tipo_negocio = { value: "saas", status: "informado" };
  data.items.arbitro = { value: "assinaturas pagas novas, por origem", status: "informado" };
  data.items.campo_origem = { value: "utm_source e utm_campaign gravados no cadastro", status: "verificado" };
  writeFileSync(path, JSON.stringify(data, null, 2));
}

async function ready(root) {
  await run(root, ["contract"]);
  settleContract(root);
  return run(root, ["contract"]);
}

test("check on a fresh project points to the contract; help prints the commands", async () => {
  const root = project();
  const check = await run(root, ["check"]);
  assert.equal(check.status, 0, JSON.stringify(check.json));
  assert.equal(check.json.ready, true);
  assert.equal(check.json.contract, null);
  assert.equal(check.json.plan.plan, "black-friday-2026");
  assert.equal(check.json.next_step.action, "contract");
  const help = await run(root, ["help"], { json: false });
  assert.match(help.stdout, /weekly/);
  const unknown = await run(root, ["dance"]);
  assert.equal(unknown.json.error.code, "usage");
});

test("contract takes the plan's numbers, asks the three required unknowns in one go and closes when they are filled", async () => {
  const root = project();
  const first = await run(root, ["contract"]);
  assert.equal(first.status, 0, JSON.stringify(first.json));
  assert.equal(first.json.created, true);
  assert.deepEqual(first.json.required_unknown, ["tipo_negocio", "arbitro", "campo_origem"]);
  assert.equal(first.json.items.custo_permitido_brl.value, 40);
  assert.equal(first.json.next_step.action, "ask");
  assert.ok(first.json.questions.length <= 4);
  assert.equal("sal" in first.json.items, false, "the salt never comes back in the answer");
  settleContract(root);
  const second = await run(root, ["contract"]);
  assert.equal(second.json.ready, true);
  assert.equal(second.json.next_step.action, "tags");
  const check = await run(root, ["check"]);
  assert.equal(check.json.contract.ready, true);
  assert.equal(check.json.next_step.action, "import");
  const broken = JSON.parse(readAt(root, "ads-insights/medicao.json"));
  broken.items.meta.status = "talvez";
  writeFileSync(join(root, "ads-insights", "medicao.json"), JSON.stringify(broken));
  const refused = await run(root, ["contract"]);
  assert.equal(refused.status, 1);
  assert.equal(refused.json.error.code, "contract_invalid");
  assert.equal(refused.json.error.details.path, "items.meta.status");
});

test("tags reads a saved HTML and reports what is present; utm build and check follow the plan's rule; events writes the tracking plan", async () => {
  const root = project();
  await ready(root);
  const tags = await run(root, ["tags", "--html", "ads-insights/entrada/pagina-com-tags.html"]);
  assert.equal(tags.status, 0, JSON.stringify(tags.json));
  const by = Object.fromEntries(tags.json.tags.map((tag) => [tag.id, tag.status]));
  assert.equal(by.meta_pixel, "present");
  assert.equal(by.gtm, "present");
  assert.equal(by.tiktok, "absent");
  assert.equal(tags.json.cookie_notice, "present");
  assert.ok(existsSync(join(root, tags.json.file)));
  const empty = await run(root, ["tags", "--html", "ads-insights/entrada/pagina-vazia.html"]);
  assert.ok(empty.json.tags.every((tag) => tag.status === "absent"));
  const outside = await run(root, ["tags", "--html", "../fora.html"]);
  assert.equal(outside.json.error.code, "outside_project");

  const built = await run(root, ["utm", "build", "--source", "meta", "--medium", "cpc", "--content", "AL-BF26-presenca-cena-01", "--term", "frio", "--url", "https://exemplo.test/oferta", "--names", NAMES]);
  assert.equal(built.status, 0, JSON.stringify(built.json));
  assert.equal(built.json.values.utm_campaign, "black-friday-2026", "the campaign defaults to the plan");
  assert.equal(built.json.rule_from, "plano black-friday-2026");
  assert.equal(built.json.query, "utm_source=meta&utm_medium=cpc&utm_campaign=black-friday-2026&utm_content=AL-BF26-presenca-cena-01&utm_term=frio");
  assert.deepEqual(built.json.warnings, []);
  const invalid = await run(root, ["utm", "build", "--source", "meta", "--content", "x"]);
  assert.equal(invalid.status, 1);
  assert.equal(invalid.json.error.code, "utm_invalid");
  const checked = await run(root, ["utm", "check", "https://exemplo.test/oferta?utm_source=meta&utm_medium=cpc", "--names", NAMES]);
  assert.equal(checked.json.valid, false);
  assert.deepEqual(checked.json.missing, ["utm_campaign", "utm_content", "utm_term"]);
  assert.equal(checked.json.next_step.action, "fix");

  const events = await run(root, ["events"]);
  assert.equal(events.status, 0, JSON.stringify(events.json));
  const tracking = readAt(root, "ads-insights/rastreamento.md");
  assert.match(tracking, /## O plano de teste no Gerenciador de Eventos/);
  assert.match(tracking, /utm_source=<canal>/);
  assert.ok(!/[–—!]/.test(tracking));
});

test("the ledger writes pseudonyms, reads lists only from the inbox, drops personal columns and summarizes with the claim ratio", async () => {
  const root = project();
  await ready(root);
  const init = await run(root, ["ledger", "init"]);
  assert.equal(init.json.created, true);
  const add = await run(root, ["ledger", "add", "--date", "2026-11-02", "--stage", "compra", "--source", "meta", "--medium", "cpc", "--campaign", "black-friday-2026", "--content", "AL-BF26-presenca-cena-01", "--value", "149", "--qualified", "sim", "--email", "pessoa@exemplo.test"]);
  assert.equal(add.status, 0, JSON.stringify(add.json));
  assert.equal(add.json.row.pseudonimo.length, 16);
  const imported = await run(root, ["ledger", "import", "ads-insights/entrada/leads.csv"]);
  assert.equal(imported.status, 0, JSON.stringify(imported.json));
  assert.equal(imported.json.imported, 3, "4 lines with e-mail, one of them a duplicate");
  assert.equal(imported.json.duplicates, 1);
  assert.deepEqual(imported.json.personal_columns_dropped, ["Nome", "Telefone"]);
  const ledger = readAt(root, "ads-insights/origens.csv");
  assert.ok(!/exemplo\.test|Ana|Bruno|Carla|90000/.test(ledger), "no personal data in the ledger");
  assert.equal(ledger.trim().split("\n").length, 5, "header, one add, three imported");
  assert.ok(!/exemplo\.test/.test(JSON.stringify(imported.json)), "no e-mail in the answer either");
  const outside = await run(root, ["ledger", "import", "anuncios/black-friday-2026/entrega/nomes.json"]);
  assert.equal(outside.json.error.code, "outside_entrada");
  cpSync(join(FIXTURES, "origens-12.csv"), join(root, "ads-insights", "origens.csv"));
  const summary = await run(root, ["ledger", "summary", "--claimed", "13"]);
  assert.equal(summary.json.claim_ratio, 1.3);
  assert.equal(summary.json.by_stage.compra, 10);
  assert.match(summary.json.say, /dentro do normal/);
  const noContract = project();
  const refused = await run(noContract, ["ledger", "add", "--date", "2026-11-02", "--stage", "lead", "--email", "a@b.test"]);
  assert.equal(refused.json.error.code, "contract_missing");
});

test("import normalizes the Portuguese and the English export alike, link matches five names and leaves one unmatched, report judges", async () => {
  const root = project();
  await ready(root);
  const pt = await run(root, ["import", "ads-insights/entrada/export-meta-pt.csv", "--source", "meta", "--name", "meta-pt"]);
  assert.equal(pt.status, 0, JSON.stringify(pt.json));
  assert.equal(pt.json.rows, 6);
  assert.deepEqual(pt.json.period, { start: "2026-10-30", end: "2026-11-12" });
  assert.deepEqual(pt.json.missing, []);
  assert.equal(pt.json.next_step.action, "link");
  const en = await run(root, ["import", "ads-insights/entrada/export-meta-en.csv", "--source", "meta", "--name", "meta-en"]);
  assert.deepEqual(en.json.totals, pt.json.totals);
  const thin = await run(root, ["import", "ads-insights/entrada/export-meta-sem-video.csv", "--source", "meta", "--name", "meta-thin"]);
  assert.ok(thin.json.missing.includes("video_plays_3s"));
  assert.match(thin.json.next_step.say, /o export não traz/);
  const bad = await run(root, ["import", "anuncios/black-friday-2026/entrega/nomes.json", "--source", "meta"]);
  assert.equal(bad.json.error.code, "export_invalid");
  const noSource = await run(root, ["import", "ads-insights/entrada/export-meta-pt.csv"]);
  assert.equal(noSource.json.error.code, "usage");

  const link = await run(root, ["link", "meta-pt", "--names", NAMES]);
  assert.equal(link.status, 0, JSON.stringify(link.json));
  assert.equal(link.json.matched.length, 5);
  assert.deepEqual(link.json.unmatched, ["Anuncio antigo do perfil"]);
  assert.deepEqual(link.json.not_in_export, []);
  const badNames = await run(root, ["link", "meta-pt", "--names", "media-plan/black-friday-2026/plano.json"]);
  assert.equal(badNames.json.error.code, "names_invalid");
  const missing = await run(root, ["report", "outra-leitura"]);
  assert.equal(missing.json.error.code, "reading_missing");

  const report = await run(root, ["report", "meta-pt"]);
  assert.equal(report.status, 0, JSON.stringify(report.json));
  assert.equal(report.json.allowable_brl, 40);
  assert.equal(report.json.allowable_source, "contrato de medição");
  assert.deepEqual(report.json.counts, { escalar: 1, manter: 0, iterar: 2, cortar: 1, negativar: 0, dado_insuficiente: 2 });
  assert.equal(report.json.rows[0].name, "AL-BF26-presenca-cena-01");
  assert.equal(report.json.rows[0].verdict, "escalar");
  const reportJson = JSON.parse(readAt(root, "ads-insights/leituras/meta-pt/report.json"));
  assert.equal(reportJson.interface_version, 1);
  assert.equal(reportJson.rows.find((row) => row.name === "AL-BF26-tempo-pergunta-02").concept, "tempo");
  assert.equal(reportJson.rows.find((row) => row.name === "Anuncio antigo do perfil").concept, undefined);
  const markdown = readAt(root, "ads-insights/leituras/meta-pt/leitura.md");
  assert.match(markdown, /\| AL-BF26-presenca-cena-01 \(presenca\) \| R\$ 520 \|/);
  assert.match(markdown, /Não casaram com a entrega/);
  assert.ok(!/[–—!]/.test(markdown));
  const own = await run(root, ["report", "meta-pt", "--allowable", "10"]);
  assert.equal(own.json.allowable_source, "informado agora");
  assert.equal(own.json.counts.escalar, 0, "at R$ 10 nothing scales");
});

test("weekly crosses the readings with the ledger, proposes the moves and judges them after the member applies one; pulse speaks only of what broke", async () => {
  const root = project();
  await ready(root);
  const noReading = await run(root, ["weekly", "--today", "2026-11-13"]);
  assert.equal(noReading.json.error.code, "reading_missing");
  await run(root, ["import", "ads-insights/entrada/export-meta-pt.csv", "--source", "meta", "--name", "meta-testes"]);
  await run(root, ["link", "meta-testes", "--names", NAMES]);
  await run(root, ["report", "meta-testes"]);
  await run(root, ["import", "ads-insights/entrada/export-google-termos-pt.csv", "--source", "google", "--name", "google-termos"]);
  const terms = await run(root, ["report", "google-termos"]);
  assert.equal(terms.json.counts.negativar, 1);
  cpSync(join(FIXTURES, "origens-12.csv"), join(root, "ads-insights", "origens.csv"));

  const weekly = await run(root, ["weekly", "--today", "2026-11-13", "--reading", "meta-testes", "--google", "google-termos", "--claimed", "13"]);
  assert.equal(weekly.status, 0, JSON.stringify(weekly.json));
  assert.equal(weekly.json.claim_ratio, 1.3);
  assert.ok(weekly.json.in_short_words <= 150, `${weekly.json.in_short_words} words`);
  assert.equal(weekly.json.findings.length, 3);
  assert.deepEqual(weekly.json.proposed.map((move) => move.tipo), ["subir_verba", "nova_versao", "nova_versao", "pausar", "segurar", "segurar", "negativar"]);
  assert.equal(weekly.json.say.length, 3);
  assert.ok(existsSync(join(root, "ads-insights", "semanal", "2026-11-13.md")));
  assert.ok(existsSync(join(root, "ads-insights", "movimentos.json")));
  const markdown = readAt(root, "ads-insights/semanal/2026-11-13.md");
  assert.match(markdown, /## Em resumo/);
  assert.match(markdown, /Nada quebrado à vista/);
  assert.match(markdown, /Certeza: confirmado/);
  assert.ok(!/undefined/.test(markdown));
  assert.ok(!/[–—!]/.test(markdown));
  const weeklyJson = JSON.parse(readAt(root, "ads-insights/semanal/2026-11-13.json"));
  assert.equal(weeklyJson.interface_version, 1);
  assert.equal(weeklyJson.proposed.length, 7);

  const applied = await run(root, ["move", "applied", "M1", "--on", "2026-11-14"]);
  assert.equal(applied.status, 0, JSON.stringify(applied.json));
  assert.equal(applied.json.move.legivel_em, "2026-11-28");
  const missing = await run(root, ["move", "applied", "M42", "--on", "2026-11-14"]);
  assert.equal(missing.json.error.code, "move_missing");
  const later = await run(root, ["weekly", "--today", "2026-11-20", "--reading", "meta-testes", "--google", "google-termos", "--claimed", "13"]);
  assert.equal(later.status, 0, JSON.stringify(later.json));
  const since = later.json.since_last_time.find((line) => line.id === "M1");
  assert.equal(since.verdict, "cedo");
  assert.match(since.text, /28\/11/);
  assert.equal(later.json.proposed.length, 0, "open moves are not proposed twice");
  assert.ok(later.json.open_moves.some((move) => move.id === "M2"));
  const list = await run(root, ["move", "list"]);
  assert.equal(list.json.moves.length, 7);

  const pulse = await run(root, ["pulse", "--daily", "ads-insights/entrada/export-meta-dia.csv", "--source", "meta", "--today", "2026-11-20"]);
  assert.equal(pulse.status, 0, JSON.stringify(pulse.json));
  const codes = pulse.json.issues.map((issue) => issue.code);
  assert.ok(codes.includes("rejected"), codes.join(","));
  assert.ok(codes.includes("zero_results"));
  assert.ok(codes.includes("pacing"));
  assert.match(pulse.json.coverage, /^Vejo o export da Meta/);
  assert.ok(existsSync(join(root, "ads-insights", "pulso", "2026-11-20.md")));
  const quiet = await run(root, ["pulse", "--daily", "ads-insights/entrada/export-meta-dia.csv", "--source", "meta", "--today", "2026-12-20"]);
  assert.ok(!quiet.json.issues.some((issue) => issue.code === "pacing"), "no phase, no pacing issue");

  const listing = await run(root, ["list"]);
  assert.equal(listing.json.readings.length, 2);
  assert.deepEqual(listing.json.weeklies, ["2026-11-20", "2026-11-13"]);
  const text = await run(root, ["check"], { json: false });
  assert.match(text.stdout, /leituras: 2/);
});

test("without a plan the contract starts unknown, the report needs an allowable cost and the UTM rule is the app's default", async () => {
  const root = project({ plan: false });
  const contract = await run(root, ["contract"]);
  assert.equal(contract.json.plan, null);
  assert.equal(contract.json.items.custo_permitido_brl.status, "desconhecido");
  assert.ok(contract.json.required_unknown.includes("custo_permitido_brl"));
  const built = await run(root, ["utm", "build", "--source", "email", "--medium", "email", "--campaign", "acesso", "--content", "envio-1", "--term", "base"]);
  assert.equal(built.json.rule_from, "padrão do app");
  await run(root, ["import", "ads-insights/entrada/export-meta-pt.csv", "--source", "meta", "--name", "meta-pt"]);
  const report = await run(root, ["report", "meta-pt"]);
  assert.equal(report.json.allowable_brl, null);
  assert.equal(report.json.counts.escalar, 0);
  assert.equal(report.json.counts.cortar, 0);
  assert.equal(report.json.counts.iterar, 1, "only the hook floor can be read without an allowable cost");
  assert.match(report.json.say, /Sem custo permitido no contrato/);
});
