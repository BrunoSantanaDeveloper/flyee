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
  visual: { direction: "A oferta no visual do painel da Hostinger", chosen: [] },
  demo: { ...newFacts({ name: "x", type: "upsell", today: "2026-11-07" }).demo, kind: "tela" },
};

/** The checks of the first rounds, whose fixtures have no measurements of the finished page. */
const FROM_MEASUREMENTS = new Set(["claims_have_origin", "placeholder_data", "demo_honest", "demo_film", "ai_defaults", "off_brand", "mobile_fits", "text_legible", "tap_targets", "contrast_ok", "controls_fit", "images_light"]);
const firstRounds = (result) => {
  const items = result.items.filter((item) => !FROM_MEASUREMENTS.has(item.id));
  const summary = { ok: 0, atencao: 0, nao_conferido: 0 };
  for (const item of items) summary[item.status] += 1;
  return { items, summary };
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
  const first = firstRounds(result);
  assert.deepEqual(first.summary, { ok: 14, atencao: 1, nao_conferido: 0 });
  assert.equal(first.items.find((item) => item.status === "atencao").id, "proof_about_offer");
  // Statements of fact come first among what needs attention, because the law weighs more.
  assert.equal(status(result, "placeholder_data"), "ok");
  assert.ok(result.say.some((line) => /A prova fala do produto/.test(line)));
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

test("the checks that need the plan's facts ask for them", () => {
  const capture = read(join(here, "fixtures", "captura-upsell.json"));
  const result = audit({ type: type("upsell"), capture, facts: newFacts({ name: "x", type: "upsell", today: "2026-11-08" }), definitions: CHECKS });
  assert.equal(status(result, "off_brand"), "nao_conferido");
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

// ---------------------------------------------------------------------------------------------
// Pages that sell a product, a plan or an API (1.1.0). The anatomy below follows the structure of
// the Juridiq models (a promotion, two calls, plan cards with annual math, a window after the
// scroll) with an invented brand: no text of the models is copied here.
// ---------------------------------------------------------------------------------------------

const PRICES = [
  { text: "R$ 4.618,80", value: 4618.8, struck: true, context: "R$ 4.618,80 /ano", section: 2, y: 1200 },
  { text: "R$ 269,43", value: 269.43, struck: false, context: "R$ 269,43 /média mensal", section: 2, y: 1220 },
  { text: "R$ 3.233,16", value: 3233.16, struck: false, context: "R$ 3.233,16 /ano", section: 2, y: 1260 },
  { text: "R$ 1.385,64", value: 1385.64, struck: false, context: "Economize R$ 1.385,64 no ano", section: 2, y: 1300 },
  { text: "R$ 2.771,28", value: 2771.28, struck: false, context: "ou R$ 2.771,28 /ano à vista no PIX (40% OFF)", section: 2, y: 1330 },
  { text: "R$ 2.998,80", value: 2998.8, struck: true, context: "R$ 2.998,80 /ano", section: 2, y: 1200 },
  { text: "R$ 174,93", value: 174.93, struck: false, context: "R$ 174,93 /média mensal", section: 2, y: 1220 },
  { text: "R$ 2.099,16", value: 2099.16, struck: false, context: "R$ 2.099,16 /ano", section: 2, y: 1260 },
  { text: "R$ 899,64", value: 899.64, struck: false, context: "Economize R$ 899,64 no ano", section: 2, y: 1300 },
  // the comparison table repeats a monthly price further down: it is not part of the last card
  { text: "R$ 269,43", value: 269.43, struck: false, context: "R$ 269,43 /mês cobrado anualmente", section: 3, y: 1950 },
];

function salesPage({ anatomy = {}, text = null } = {}) {
  const base = {
    format_version: 1,
    viewports: { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } },
    sections: [
      { index: 0, heading: null, y: 0, height: 200, text: "Oferta de fim de ano: 30% no anual. Termina em 3d 10h 20m 05s", words: 12 },
      { index: 1, heading: { tag: "h1", text: "O seu escritório em um só lugar" }, y: 200, height: 800, text: "Agendar demonstração\nTestar grátis\n30 minutos · online", words: 20 },
      { index: 2, heading: { tag: "h2", text: "Quem usa o Sistema Exemplo" }, y: 1000, height: 900, text: "0+\nescritórios atendidos\nRecomendado\nPlano Essencial\nPlano Sociedade", words: 30 },
      { index: 3, heading: { tag: "h2", text: "Perguntas frequentes" }, y: 1900, height: 900, text: "Existe fidelidade? Não, cancele quando quiser.\nOferta válida até 31/12 para novos clientes.\nSistema Exemplo Ltda. CNPJ: 12.345.678/0001-90. Avenida Central, 1000, São Paulo. contato@exemplo.com.br\nPolítica de Privacidade · Termos de Uso", words: 60 },
    ],
    ctas: [
      { index: 0, kind: "button", text: "Agendar demo", href: null, x: 1200, y: 50, width: 150, height: 40, above_fold: { desktop: true, mobile: true }, in_fixed: true, section: 0, disabled: false },
      { index: 1, kind: "button", text: "Agendar demonstração", href: null, x: 400, y: 445, width: 300, height: 56, above_fold: { desktop: true, mobile: true }, in_fixed: false, section: 1, disabled: false },
      { index: 2, kind: "button", text: "Testar grátis", href: null, x: 720, y: 444, width: 160, height: 56, above_fold: { desktop: true, mobile: null }, in_fixed: false, section: 1, disabled: false },
      { index: 3, kind: "link", text: "Garantir desconto", href: "https://exemplo.com.br/planos", x: 600, y: 1500, width: 200, height: 48, above_fold: { desktop: false, mobile: false }, in_fixed: false, section: 2, disabled: false },
    ],
    fixed: [
      { pass: "desktop", position: "fixed", edge: "top", text: "Agendar demo", height: 80, ctas: ["Agendar demo"], appeared_after_scroll: false },
      { pass: "mobile", position: "fixed", edge: "top", text: "", height: 76, ctas: ["Abrir menu"], appeared_after_scroll: false },
      { pass: "desktop", position: "fixed", edge: "other", text: "Oferta de fim de ano Ver planos com desconto Agora não", height: 900, ctas: ["Ver planos com desconto", "Agora não"], appeared_after_scroll: true },
    ],
    forms: [],
    prices: PRICES,
    media: { videos: [], iframes: [], images: { count: 20, without_alt: 0 } },
    motion: { running: [{ kind: "css-animation", name: "faixa", duration_ms: 40000, iterations: "infinite", target: "div.flex" }], keyframes: ["faixa"], transitions: 3, reduced_motion_rules: 2, smooth_scroll: true, scroll_snap: 0, stylesheets_unread: 0 },
    countdowns: [{ text: "3d 10h 20m 05s", section: 0 }],
  };
  const capture = {
    final_url: "https://exemplo.com.br/",
    input_kind: "url",
    viewports: { desktop: { width: 1440, height: 900, full_height: 8000 }, mobile: { width: 390, height: 844, full_height: 8000 } },
    anatomy: { ...base, ...anatomy },
  };
  return { capture, text };
}

const landingFacts = { ...newFacts({ name: "vendas", type: "landing", today: "2026-11-07" }), product: { name: "Sistema Exemplo", what: "gestão de escritórios" }, audience: "escritórios de advocacia" };
const run = (id, page, facts = landingFacts) => audit({ type: type(id), capture: page.capture, facts, definitions: CHECKS, text: page.text });

test("in lead mode the main call is the page's first button, preferring one the phone shows", () => {
  const { capture } = salesPage();
  assert.equal(mainCta(capture.anatomy, {}, capture.final_url, "lead").text, "Agendar demonstração");
  assert.equal(mainCta(capture.anatomy, {}, capture.final_url).text, "Garantir desconto", "an offer page still looks for a purchase word");
  assert.equal(mainCta(capture.anatomy, { cta_text: "Testar grátis" }, capture.final_url, "lead").text, "Testar grátis", "the declared text wins");
});

test("a sales page: every discount adds up, the window comes after the scroll with a way out, the seller is named", () => {
  const result = run("landing", salesPage());
  assert.equal(status(result, "discount_math"), "ok");
  assert.match(result.items.find((i) => i.id === "discount_math").detail, /As 5 contas/);
  for (const id of ["cta_first_screen", "h1_present", "promo_terms_shown", "popup_dismissable", "popup_on_arrival", "cancel_terms_shown", "supplier_identified", "legal_lines", "reduced_motion", "images_alt"]) assert.equal(status(result, id), "ok", id);
  assert.equal(status(result, "trial_terms"), "atencao", "a trial without its length");
  assert.equal(status(result, "numbers_not_zero"), "atencao", "a counter read before its animation");
  // the phone has only a menu button fixed, and the window is not a bar
  assert.equal(status(result, "sticky_cta_long_page"), "atencao");
  assert.match(result.items.find((i) => i.id === "sticky_cta_long_page").detail, /computador, mas não no celular/);
  assert.equal(status(result, "countdown_real"), "atencao", "a countdown without the deadline registered");
});

test("a window that covers the page on arrival, with no way out, is flagged twice", () => {
  const page = salesPage({ anatomy: { fixed: [{ pass: "mobile", position: "fixed", edge: "other", text: "Oferta de fim de ano Ver planos", height: 844, ctas: ["Ver planos com desconto"], appeared_after_scroll: false }] } });
  const result = run("landing", page);
  assert.equal(status(result, "popup_on_arrival"), "atencao");
  assert.match(result.items.find((i) => i.id === "popup_on_arrival").detail, /no celular logo na chegada/);
  assert.equal(status(result, "popup_dismissable"), "atencao");
  assert.equal(status(run("landing", salesPage({ anatomy: { fixed: [] } })), "popup_on_arrival"), "skipped", "no window, nothing to say");
});

test("discount math that does not add up is caught: the savings, the percentage and the monthly average", () => {
  const wrong = (index, change) => PRICES.map((p, i) => (i === index ? { ...p, ...change } : p));
  const savings = run("landing", salesPage({ anatomy: { prices: wrong(3, { text: "R$ 1.400,00", value: 1400, context: "Economize R$ 1.400,00 no ano" }) } }));
  assert.equal(status(savings, "discount_math"), "atencao");
  assert.match(savings.items.find((i) => i.id === "discount_math").detail, /economia de R\$ 1\.400,00/);
  const percent = run("landing", salesPage({ anatomy: { prices: wrong(4, { text: "R$ 2.800,00", value: 2800, context: "ou R$ 2.800,00 /ano à vista no PIX (40% OFF)" }) } }));
  assert.match(percent.items.find((i) => i.id === "discount_math").detail, /40% de desconto sobre R\$ 4\.618,80 dá R\$ 2\.771,28/);
  const average = run("landing", salesPage({ anatomy: { prices: wrong(1, { text: "R$ 299,00", value: 299, context: "R$ 299,00 /média mensal" }) } }));
  assert.match(average.items.find((i) => i.id === "discount_math").detail, /média mensal/);
  assert.equal(status(run("landing", salesPage({ anatomy: { prices: PRICES.filter((p) => !p.struck) } })), "discount_math"), "skipped", "no struck price, no math to check");
});

test("the trial says its length, and the page text beats the sections for the footer", () => {
  const sevenDays = salesPage({ text: "Teste gratuitamente por 7 dias, sem cartão de crédito.\nCNPJ: 12.345.678/0001-90\nRua das Flores, 10\ncontato@exemplo.com.br\nOferta válida até 31/12" });
  assert.equal(status(run("landing", sevenDays), "trial_terms"), "ok");
  assert.equal(status(run("landing", sevenDays, { ...landingFacts, offer: { ...landingFacts.offer, trial_days: 14 } }), "trial_terms"), "atencao", "the page and pagina.json disagree");
  const noCnpj = salesPage({ text: "Testar grátis\nRua das Flores, 10\ncontato@exemplo.com.br" });
  const result = run("landing", noCnpj);
  assert.equal(status(result, "supplier_identified"), "atencao");
  assert.match(result.items.find((i) => i.id === "supplier_identified").detail, /o CNPJ ou o CPF/);
  assert.equal(status(result, "cancel_terms_shown"), "atencao", "prices and no word about cancelling");
});

test("a plans page: prices on the first screen, a highlighted plan, and the h1 that is missing", () => {
  const plans = salesPage({ anatomy: {
    sections: [
      { index: 0, heading: null, y: 0, height: 1300, text: "Escolha o plano\nMensal\nAnual\nRecomendado\nPlano Essencial", words: 40 },
      { index: 1, heading: { tag: "h3", text: "Comparação completa" }, y: 1300, height: 1600, text: "Existe fidelidade? Não, cancele quando quiser. CNPJ: 12.345.678/0001-90. Avenida Central, 1000. contato@exemplo.com.br Política de Privacidade Termos", words: 30 },
    ],
    prices: PRICES.map((p) => ({ ...p, section: p.section === 3 ? 1 : 0, y: p.y - 600 })),
  } });
  const result = run("planos", plans);
  assert.equal(status(result, "prices_first_screen"), "ok");
  assert.equal(status(result, "plan_highlighted"), "ok");
  assert.equal(status(result, "discount_math"), "ok");
  assert.equal(status(result, "h1_present"), "atencao");
  const noBadge = salesPage({ anatomy: { sections: plans.capture.anatomy.sections.map((s) => ({ ...s, text: s.text.replace("Recomendado\n", "") })), prices: plans.capture.anatomy.prices } });
  assert.equal(status(run("planos", noBadge), "plan_highlighted"), "atencao");
});

test("an API page: the documentation on the first screen, a request example, the usage limits in numbers", () => {
  const api = salesPage({
    anatomy: { ctas: [{ index: 0, kind: "link", text: "Ler a documentação", href: "https://docs.exemplo.com.br/", x: 300, y: 580, width: 220, height: 48, above_fold: { desktop: true, mobile: true }, in_fixed: false, section: 1, disabled: false }] },
    text: "A operação, agora programável.\ncurl https://api.exemplo.com.br/v1/processos -H 'Authorization: Bearer $CHAVE'\nPlano Base R$ 98,90/mês\nCNPJ: 12.345.678/0001-90 Avenida Central, 1000 contato@exemplo.com.br Política de Privacidade Termos cancele quando quiser",
  });
  const result = run("api", api, { ...landingFacts, offer: { ...landingFacts.offer, price: "R$ 98,90" } });
  assert.equal(status(result, "docs_first_screen"), "ok");
  assert.equal(status(result, "code_sample"), "ok");
  assert.equal(status(result, "rate_limits_shown"), "atencao");
  const limited = salesPage({ anatomy: api.capture.anatomy, text: `${api.text}\nAté 60 requisições por minuto e 100 mil por mês.` });
  assert.equal(status(run("api", limited), "rate_limits_shown"), "ok");
});

test("the new types plan their own facts", () => {
  const facts = newFacts({ name: "planos", type: "planos", today: "2026-11-07" });
  for (const key of ["audience", "secondary_cta_text"]) assert.ok(key in facts, key);
  for (const key of ["plans", "recommended_plan", "trial_days", "cancellation"]) assert.ok(key in facts.offer, key);
  assert.deepEqual(Object.keys(facts.api), ["docs_url", "rate_limit"]);
  assert.deepEqual(missingFacts(facts, type("planos")), ["product.name", "offer.plans", "offer.recurrence", "offer.cancellation", "cta_text", "visual.direction"]);
  const plan = renderPlan({ facts, type: type("planos"), checks: CHECKS, models: MODELS.models.filter((m) => m.types.includes("planos")), today: "2026-11-07" });
  assert.match(plan, /O seletor mensal ou anual/);
  assert.match(plan, /Juridiq: a página de planos/);
  assert.match(plan, /Um plano em destaque \(`plan_highlighted`\)/);
  for (const id of ["landing", "planos", "api"]) assert.equal(type(id).cta, "lead", id);
});

test("audit of a sales page through the Video engine: the window after the scroll and the menu button the phone hides", { timeout: 240000 }, () => {
  const engineFixture = resolve(app, "..", "video-render", "tests", "fixtures", "janela", "index.html");
  if (!existsSync(engineFixture)) return;
  const project = mkdtempSync(join(tmpdir(), "conversion-pages-landing-"));
  const cli = (...args) => JSON.parse(spawnSync(process.execPath, [script, ...args, "--json"], { cwd: project, encoding: "utf8", timeout: 230000 }).stdout.trim());
  try {
    cli("new", "vendas", "--type", "landing");
    const result = cli("audit", "vendas", "--url", engineFixture);
    if (!result.ok && /browser|navegador/i.test(`${result.error?.code} ${result.error?.message}`)) return; // no browser on this machine
    assert.equal(result.ok, true, JSON.stringify(result.error));
    assert.equal(status(result, "popup_on_arrival"), "ok");
    assert.equal(status(result, "popup_dismissable"), "ok");
    assert.equal(status(result, "promo_terms_shown"), "ok");
    assert.equal(status(result, "cta_first_screen"), "ok", JSON.stringify(result.items.find((i) => i.id === "cta_first_screen")));
    assert.equal(status(result, "supplier_identified"), "atencao", "the fixture's footer has no CNPJ");
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
    assert.deepEqual(firstRounds(result).summary, { ok: 14, atencao: 1, nao_conferido: 0 });
    assert.ok(existsSync(join(project, "paginas", "upsell-agente", "conferencia.json")));
    assert.equal(run("new", "upsell-agente", "--type", "upsell").error.code, "page_exists");
    assert.equal(run("audit", "nao-existe").error.code, "page_not_found");
    mkdirSync(join(project, "docs"));
    assert.equal(run("new", "obrigado", "--type", "obrigado").dir, "docs/paginas/obrigado");
    assert.equal(run("list").pages.length, 2);
    assert.deepEqual(run("types").types.map((t) => t.id), ["upsell", "order-bump", "downsell", "cross-sell", "obrigado", "landing", "planos", "api"]);
    assert.deepEqual(run("models", "--type", "planos").models.map((m) => m.id), ["juridiq-planos", "jurichat-pagina-de-vendas"]);
    assert.deepEqual(run("models", "--type", "api").models.map((m) => m.id), ["juridiq-api"]);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});
