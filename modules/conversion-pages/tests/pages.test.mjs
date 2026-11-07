import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { audit, DECLINE, mainCta, RULE_IDS, SHAMING } from "../scripts/lib/checks.mjs";
import { missingFacts, newFacts, renderPlan } from "../scripts/lib/plan.mjs";
import { parsePrice, projectRoot } from "../scripts/lib/util.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, "..");
const script = join(app, "scripts", "pages.mjs");
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const TYPES = read(join(app, "references", "tipos.json"));
const CHECKS = read(join(app, "references", "checks.json"));
const MODELS = read(join(app, "references", "modelos.json"));
const type = (id) => TYPES.types.find((t) => t.id === id);
const status = (result, id) => result.items.find((item) => item.id === id)?.status ?? "skipped";

const upsellFacts = {
  ...newFacts({ name: "upsell-agente", type: "upsell", today: "2026-11-07" }),
  product: { name: "Agente da Hostinger", what: "sete agentes de IA" },
  main_purchase: "domínio",
  cta_text: "Adicionar ao meu pedido",
  decline_text: "Pular oferta",
  offer: { price: "R$ 24,99", reference_price: "R$ 49,99", recurrence: "mensal", renewal_price: "R$ 49,99", guarantee_days: 30, deadline: null },
  payment: { one_click: true, provider: null },
};

test("references agree with each other and with the code", () => {
  for (const t of TYPES.types) {
    assert.ok(existsSync(join(app, "references", t.file)), `${t.file} exists`);
    for (const id of t.checks) {
      assert.ok(CHECKS.checks[id], `${id} is defined in checks.json`);
      assert.ok(RULE_IDS.includes(id), `${id} has a rule`);
    }
    for (const model of t.models) assert.ok(MODELS.models.some((m) => m.id === model), `${model} is in modelos.json`);
  }
  for (const m of MODELS.models) {
    assert.ok(existsSync(join(app, "references", m.file)), `${m.file} exists`);
    for (const t of m.types) assert.ok(type(t), `${t} is a type`);
  }
  for (const id of Object.keys(CHECKS.checks)) assert.ok(RULE_IDS.includes(id), `${id} has a rule`);
});

test("parsePrice reads Brazilian and plain prices", () => {
  assert.equal(parsePrice("R$ 1.234,56"), 1234.56);
  assert.equal(parsePrice("24,99"), 24.99);
  assert.equal(parsePrice("R$ 49,99/mês"), 49.99);
  assert.equal(parsePrice(24.99), 24.99);
  assert.equal(parsePrice("1.234"), 1234);
  assert.equal(parsePrice("sem preço"), null);
  assert.equal(parsePrice(null), null);
});

test("decline patterns: neutral words pass, shaming words are caught", () => {
  for (const text of ["Pular oferta", "Não, obrigado", "Agora não", "Continuar sem a mentoria", "No thanks"]) assert.ok(DECLINE.test(text), text);
  assert.ok(!DECLINE.test("Adicionar ao meu pedido"));
  for (const text of ["Não, prefiro pagar mais caro", "Não quero economizar"]) assert.ok(SHAMING.test(text), text);
  assert.ok(!SHAMING.test("Pular oferta"));
});

test("the main call to action skips anchors, declines and sticky copies", () => {
  const capture = read(join(here, "fixtures", "captura-upsell.json"));
  const cta = mainCta(capture.anatomy, {}, capture.final_url);
  assert.equal(cta.text, "Adicionar ao meu pedido");
  assert.equal(cta.in_fixed, false);
});

test("a Hostinger-like upsell: only the testimonials need attention", () => {
  const capture = read(join(here, "fixtures", "captura-upsell.json"));
  const result = audit({ type: type("upsell"), capture, facts: upsellFacts, definitions: CHECKS });
  assert.equal(result.anatomy, true);
  assert.equal(status(result, "proof_about_offer"), "atencao");
  for (const id of ["cta_first_screen", "single_offer", "decline_visible", "decline_honest", "price_shown", "reference_price_true", "renewal_shown", "guarantee_near_cta", "charge_clear", "sticky_cta_long_page", "video_autoplay_ok", "reduced_motion", "legal_lines", "images_alt"]) {
    assert.equal(status(result, id), "ok", id);
  }
  assert.equal(status(result, "countdown_real"), "skipped");
  assert.deepEqual(result.summary, { ok: 14, atencao: 1, nao_conferido: 0 });
  assert.equal(result.items[0].id, "proof_about_offer");
  assert.equal(result.say.length, 1);
});

test("the upsell audit without facts asks for them instead of failing", () => {
  const capture = read(join(here, "fixtures", "captura-upsell.json"));
  const result = audit({ type: type("upsell"), capture, facts: newFacts({ name: "x", type: "upsell", today: "2026-11-07" }), definitions: CHECKS });
  assert.equal(status(result, "price_shown"), "nao_conferido");
  assert.equal(status(result, "charge_clear"), "nao_conferido");
  assert.equal(status(result, "reference_price_true"), "atencao");
});

test("an order bump that comes checked is flagged, with the countdown and the missing alt", () => {
  const capture = read(join(here, "fixtures", "captura-bump.json"));
  const facts = { ...newFacts({ name: "bump", type: "order-bump", today: "2026-11-07" }), offer: { price: "R$ 19,90" }, cta_text: "Finalizar compra" };
  const result = audit({ type: type("order-bump"), capture, facts, definitions: CHECKS });
  assert.equal(status(result, "no_prechecked"), "atencao");
  assert.equal(status(result, "bump_near_pay"), "ok");
  assert.equal(status(result, "price_shown"), "ok");
  assert.equal(status(result, "countdown_real"), "atencao");
  assert.equal(status(result, "images_alt"), "atencao");
  assert.equal(status(result, "legal_lines"), "ok");
  assert.equal(status(result, "reduced_motion"), "skipped");
  assert.equal(result.items[0].weight, "lei");
});

test("a bump below the pay button is flagged", () => {
  const capture = read(join(here, "fixtures", "captura-bump.json"));
  capture.anatomy.forms[0].y = 1600;
  const result = audit({ type: type("order-bump"), capture, facts: { cta_text: "Finalizar compra" }, definitions: CHECKS });
  assert.equal(status(result, "bump_near_pay"), "atencao");
});

test("a saved page (mhtml) runs no script: countdown and scroll bar are not checked, never failed", () => {
  const capture = read(join(here, "fixtures", "captura-upsell.json"));
  capture.input_kind = "mhtml";
  capture.anatomy.fixed = [];
  const result = audit({ type: type("upsell"), capture, facts: upsellFacts, definitions: CHECKS });
  assert.equal(status(result, "sticky_cta_long_page"), "nao_conferido");
  assert.equal(status(result, "countdown_real"), "nao_conferido");
  const live = read(join(here, "fixtures", "captura-upsell.json"));
  live.anatomy.fixed = [];
  const liveResult = audit({ type: type("upsell"), capture: live, facts: upsellFacts, definitions: CHECKS });
  assert.equal(status(liveResult, "sticky_cta_long_page"), "atencao");
  assert.equal(status(liveResult, "countdown_real"), "skipped");
});

test("a capture without the full reading is never a failure", () => {
  const result = audit({ type: type("upsell"), capture: { url: "http://localhost:3000" }, facts: upsellFacts, definitions: CHECKS });
  assert.equal(result.anatomy, false);
  assert.equal(result.summary.atencao, 0);
  assert.equal(result.summary.nao_conferido, type("upsell").checks.length);
});

test("plano.md lists the facts still open and the checks of the type", () => {
  const facts = newFacts({ name: "upsell-agente", type: "upsell", today: "2026-11-07" });
  assert.deepEqual(missingFacts(facts, type("upsell")), type("upsell").facts);
  assert.deepEqual(missingFacts(upsellFacts, type("upsell")), []);
  const plan = renderPlan({ facts, type: type("upsell"), checks: CHECKS, models: MODELS.models, today: "2026-11-07" });
  assert.match(plan, /# Plano da página upsell-agente: Upsell/);
  assert.match(plan, /\[a decidir\]/);
  assert.match(plan, /`proof_about_offer`/);
  assert.doesNotMatch(plan, /[–—!]/);
});

test("installed for the user, the project is the open folder", () => {
  const base = mkdtempSync(join(tmpdir(), "conversion-pages-root-"));
  try {
    const userApps = join(base, "user-apps");
    const repo = join(base, "repo");
    const userScripts = join(userApps, ".flyee", "modules", "conversion-pages", "scripts");
    assert.equal(projectRoot(userScripts, { env: { FLYEE_USER_APPS: userApps }, cwd: repo }), resolve(repo));
    const projectScripts = join(base, "projeto", ".flyee", "modules", "conversion-pages", "scripts");
    assert.equal(projectRoot(projectScripts, { env: { FLYEE_USER_APPS: userApps }, cwd: repo }), resolve(base, "projeto"));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("audit captures a real page through the Video engine", { timeout: 240000 }, () => {
  const engineFixture = resolve(app, "..", "video-render", "tests", "fixtures", "oferta", "index.html");
  if (!existsSync(engineFixture)) return;
  const project = mkdtempSync(join(tmpdir(), "conversion-pages-real-"));
  const run = (...args) => {
    const out = spawnSync(process.execPath, [script, ...args, "--json"], { cwd: project, encoding: "utf8", timeout: 230000 });
    return JSON.parse(out.stdout.trim());
  };
  try {
    run("new", "oferta-guia", "--type", "upsell");
    const facts = { ...upsellFacts, name: "oferta-guia", product: { name: "Guia de Receitas", what: null }, cta_text: "Sim, quero o guia", offer: { price: "R$ 19,99", reference_price: "R$ 49,99", recurrence: null, renewal_price: null, guarantee_days: null, deadline: null } };
    writeFileSync(join(project, "paginas", "oferta-guia", "pagina.json"), JSON.stringify(facts));
    const result = run("audit", "oferta-guia", "--url", engineFixture);
    if (!result.ok && /browser|navegador/i.test(`${result.error?.code} ${result.error?.message}`)) return; // no browser on this machine
    assert.equal(result.ok, true, JSON.stringify(result.error));
    assert.equal(result.full_reading, true);
    assert.equal(status(result, "price_shown"), "ok");
    assert.equal(status(result, "reference_price_true"), "ok");
    assert.equal(status(result, "countdown_real"), "atencao");
    assert.ok(existsSync(join(project, "paginas", "oferta-guia", "captura", "texto.md")));
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});

test("the command creates a page, plans it and audits a saved capture", () => {
  const project = mkdtempSync(join(tmpdir(), "conversion-pages-cli-"));
  const run = (...args) => {
    const out = spawnSync(process.execPath, [script, ...args, "--json"], { cwd: project, encoding: "utf8" });
    return JSON.parse(out.stdout.trim());
  };
  try {
    const created = run("new", "upsell-agente", "--type", "upsell");
    assert.equal(created.ok, true);
    assert.equal(created.dir, "paginas/upsell-agente");
    assert.ok(created.missing.length > 0);
    writeFileSync(join(project, "paginas", "upsell-agente", "pagina.json"), JSON.stringify(upsellFacts));
    assert.equal(run("plan", "upsell-agente").missing.length, 0);
    const result = run("audit", "upsell-agente", "--capture", join(here, "fixtures", "captura-upsell.json"));
    assert.equal(result.ok, true);
    assert.deepEqual(result.summary, { ok: 14, atencao: 1, nao_conferido: 0 });
    assert.ok(existsSync(join(project, "paginas", "upsell-agente", "conferencia.json")));
    assert.equal(run("new", "upsell-agente", "--type", "upsell").error.code, "page_exists");
    assert.equal(run("audit", "nao-existe").error.code, "page_not_found");
    mkdirSync(join(project, "docs"));
    assert.equal(run("new", "obrigado", "--type", "obrigado").dir, "docs/paginas/obrigado");
    assert.equal(run("list").pages.length, 2);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});
