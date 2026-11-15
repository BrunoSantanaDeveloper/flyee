// The demonstration, the defaults and what the finished page measures (the round of 2026-11-08):
// the rules over small anatomies, then the Video engine's own pages through the real command.
//   node --test modules/conversion-pages/tests/quality.test.mjs

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { audit, claimHasOrigin, findClaims, installmentsIn, stacksIn } from "../scripts/lib/checks.mjs";
import { missingFacts, newFacts, renderPlan } from "../scripts/lib/plan.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, "..");
const script = join(app, "scripts", "pages.mjs");
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const TYPES = read(join(app, "references", "tipos.json"));
const CHECKS = read(join(app, "references", "checks.json"));
const type = (id) => TYPES.types.find((t) => t.id === id);

const QUALITY = {
  desktop: {
    contrast: { checked: 12, unknown: {}, failing: [] },
    controls: { checked: 4, problems: [] },
    demos: [],
    figures: [],
    cards: [],
    defaults: { found: {}, counts: {}, mono_share: 0 },
    errors: [],
  },
  mobile: {
    overflow: { viewport_width: 390, inner_width: 390, scroll_width: 390, cut: 0, offenders: [] },
    small_text: { total_chars: 1000, small_chars: 100, share: 0.1, min_px: 11, samples: [{ text: "Rodapé", px: 11 }], key: [] },
    tap_targets: { checked: 12, small: 0, undersized: 0, samples: [] },
    controls: { checked: 4, problems: [] },
    images: { count: 3, heavy: [], oversized: [] },
    weight: { total_bytes: 500000, by_type: { Image: 300000 } },
    errors: [],
  },
};

function page({ quality = {}, anatomy = {}, brand = null } = {}) {
  return {
    final_url: "https://exemplo.com.br/",
    input_kind: "url",
    viewports: { desktop: { width: 1440, height: 900, full_height: 2000 }, mobile: { width: 390, height: 844, full_height: 2000 } },
    brand,
    anatomy: {
      viewports: { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } },
      sections: [{ index: 1, heading: { tag: "h1", text: "O seu escritório em um só lugar" }, y: 100, height: 800, text: "Agendar demonstração", words: 2 }],
      ctas: [],
      fixed: [],
      forms: [],
      prices: [],
      media: { videos: [], iframes: [], images: { count: 0, without_alt: 0 } },
      motion: { running: [], keyframes: [], transitions: 0, reduced_motion_rules: 1, smooth_scroll: false, scroll_snap: 0, stylesheets_unread: 0 },
      countdowns: [],
      quality: {
        desktop: { ...QUALITY.desktop, ...quality.desktop },
        mobile: { ...QUALITY.mobile, ...quality.mobile },
      },
      ...anatomy,
    },
  };
}

const facts = (over = {}) => ({ ...newFacts({ name: "vendas", type: "landing", today: "2026-11-08" }), ...over });
const run = (capture, over = {}, { text = "Agendar demonstração", film = null, id = "landing" } = {}) => audit({ type: type(id), capture, facts: facts(over), definitions: CHECKS, text, film });
const item = (result, id) => result.items.find((entry) => entry.id === id) ?? { status: "skipped", detail: "" };

test("every playbook lists the checks its type runs", () => {
  for (const t of TYPES.types) {
    const body = readFileSync(join(app, "references", t.file), "utf8");
    const section = /## O que a conferência olha\s+([^\n]+)/.exec(body)?.[1] ?? "";
    const listed = [...section.matchAll(/`([a-z0-9_]+)`/g)].map((match) => match[1]);
    assert.deepEqual([...listed].sort(), [...t.checks].sort(), t.id);
  }
});

test("the types that show the product have a demonstration in the plan, and the others do not", () => {
  assert.deepEqual(TYPES.types.filter((t) => t.demo).map((t) => t.id), ["upsell", "landing", "curso", "api"]);
  for (const t of TYPES.types.filter((candidate) => candidate.demo)) {
    assert.ok(t.facts.includes("demo.kind"), t.id);
    assert.ok(t.checks.includes("demo_honest") && t.checks.includes("demo_film"), t.id);
  }
  const f = newFacts({ name: "x", type: "landing", today: "2026-11-08" });
  const landing = renderPlan({ facts: f, type: type("landing"), checks: CHECKS, models: [], today: "2026-11-08" });
  assert.match(landing, /## A direção visual/);
  assert.match(landing, /## A figura principal/);
  assert.match(landing, /## O título/);
  assert.match(landing, /## As figuras/);
  assert.match(landing, /## Os números e as urgências/);
  assert.doesNotMatch(landing, /[–—!]/);
  assert.doesNotMatch(renderPlan({ facts: f, type: type("obrigado"), checks: CHECKS, models: [], today: "2026-11-08" }), /## A figura principal/);
  assert.doesNotMatch(renderPlan({ facts: f, type: type("planos"), checks: CHECKS, models: [], today: "2026-11-08" }), /## As figuras/);
  assert.deepEqual(missingFacts(f, type("planos")).filter((path) => path.startsWith("visual")), ["visual.direction"]);
  const filled = renderPlan({
    facts: { ...f, visual: { direction: "Um painel escuro, como o do sistema", chosen: ["texto_degrade"] }, brand: { colors: ["#0F62FE"], fonts: ["Inter"], source: "tailwind.config.ts" }, demo: { ...f.demo, kind: "componentes", action: "criar um prazo" }, claims: [{ text: "+500 escritórios", origin: "painel de clientes, outubro de 2026" }] },
    type: type("landing"),
    checks: CHECKS,
    models: [],
    today: "2026-11-08",
  });
  assert.match(filled, /Um painel escuro/);
  assert.match(filled, /#0F62FE; Inter \(de tailwind\.config\.ts\)/);
  assert.match(filled, /Escolhido de propósito da lista de vícios: texto_degrade/);
  assert.match(filled, /\| a única ação \| criar um prazo \|/);
  assert.match(filled, /\| \+500 escritórios \| painel de clientes, outubro de 2026 \|/);
});

test("the landing plan asks for the title and for what each section shows, before any code", () => {
  const f = newFacts({ name: "x", type: "landing", today: "2026-11-08" });
  const missing = missingFacts(f, type("landing"));
  assert.ok(missing.includes("headline.chosen"), missing.join(" "));
  assert.ok(missing.includes("figures"), "an empty list of figures is still missing");
  const filled = {
    ...f,
    headline: { chosen: "Chega de paciente que marca e não aparece", options: ["Chega de paciente que marca e não aparece", "Sua agenda cheia, sem ninguém no telefone"] },
    figures: [{ name: "atendimento", section: "A dor", object: "telefone com a conversa", says: "a paciente pergunta, e a resposta já chegou" }],
  };
  assert.ok(!missingFacts(filled, type("landing")).includes("figures"));
  const plan = renderPlan({ facts: filled, type: type("landing"), checks: CHECKS, models: [], today: "2026-11-08" });
  assert.match(plan, /Escolhido: Chega de paciente/);
  assert.match(plan, /- Sua agenda cheia/);
  assert.match(plan, /\| A dor \| telefone com a conversa \| a paciente pergunta, e a resposta já chegou \| `data-figura="atendimento"` \|/);
});

test("the guide puts the drawing first and never tells anyone to strip a chosen look", () => {
  const guide = readFileSync(join(app, "references", "demonstracao.md"), "utf8");
  assert.ok(guide.indexOf("| 1 | `replica`") > 0 && guide.indexOf("| 1 | `replica`") < guide.indexOf("| 3 | `componentes`"));
  assert.match(guide, /files\.no_letters/);
  const list = readFileSync(join(app, "references", "vicios.md"), "utf8");
  assert.match(list, /nada sai por causa desta lista sem o integrante pedir/);
  assert.doesNotMatch(CHECKS.checks.ai_defaults.fix, /sai da página/);
  for (const model of ["juridiq-pagina-de-vendas", "jurichat-pagina-de-vendas"]) {
    const body = readFileSync(join(app, "references", "modelos", `${model}.md`), "utf8");
    assert.match(body, /## As figuras, seção por seção/, model);
    assert.match(body, /`visual\.chosen`/, model);
  }
});

test("a title that opens with the category is pointed out, and one that speaks to whoever arrived is not", () => {
  const titled = (text) => page({ anatomy: { sections: [{ index: 1, heading: { tag: "h1", text }, y: 100, height: 800, text: "", words: 2 }] } });
  for (const text of ["Automação com IA no contencioso de massa, do primeiro contato ao protocolo", "Plataforma de gestão para clínicas", "O sistema de agenda mais completo do Brasil", "Soluções em tecnologia para o varejo"]) {
    assert.equal(item(run(titled(text)), "title_promises").status, "atencao", text);
  }
  for (const text of ["Seu escritório inteiro em um só lugar", "Sistema de agenda que enche a sua semana", "Chega de paciente que marca e não aparece", "Revolucione o atendimento do seu escritório", "Sistemática de vendas sem planilha"]) {
    assert.equal(item(run(titled(text)), "title_promises").status, "ok", text);
  }
  assert.equal(item(run(page({ anatomy: { sections: [] } })), "title_promises").status, "nao_conferido");
});

// What the Video engine read on real pages on 2026-11-08: the cards that are neither a quote, a question nor a plan.
const MEASURED = {
  juridiq: [{ read_words: 25, height: 252, hole: 0.13 }, { read_words: 17, height: 228, hole: 0.14 }, { read_words: 16, height: 238, hole: 0.2 }, { read_words: 12, height: 92, hole: 0.51 }],
  jurichat: [{ read_words: 31, height: 583, hole: 0.08, picture_share: 0.62 }, { read_words: 19, height: 326, hole: 0.31, picture_share: 0.59 }, { read_words: 19, height: 280, hole: 0.22 }, { read_words: 15, height: 93, hole: 0.54 }],
  one_anterior: [{ read_words: 27, height: 157, hole: 0.05 }, { read_words: 23, height: 194, hole: 0.14 }, { read_words: 19, height: 199, hole: 0.16 }],
  one_com_o_erro: [{ read_words: 55, height: 414, hole: 0.24 }, { read_words: 40, height: 362, hole: 0.15 }, { read_words: 22, height: 362, hole: 0.31 }, { read_words: 20, height: 414, hole: 0.46 }],
};

test("the limits of the cards separate the pages they were measured on", () => {
  const read = (name) => run(page({ quality: { desktop: { cards: MEASURED[name].map((card, index) => ({ text: `cartão ${index}`, kind: "card", ...card })) } } }));
  for (const name of ["juridiq", "jurichat", "one_anterior"]) {
    assert.equal(item(read(name), "cards_short").status, "ok", name);
    assert.equal(item(read(name), "cards_no_holes").status, "ok", name);
  }
  const wrong = read("one_com_o_erro");
  assert.equal(item(wrong, "cards_short").status, "atencao");
  assert.match(item(wrong, "cards_short").detail, /55 palavras, e mais 1 passa de 32/);
  assert.equal(item(wrong, "cards_no_holes").status, "atencao");
  assert.match(item(wrong, "cards_no_holes").detail, /46% da altura vazia, e mais 1/);
});

test("the cards meant to be read are left out, and a page with no cards says nothing", () => {
  const long = { read_words: 80, height: 400, hole: 0.5, text: "um texto longo" };
  for (const kind of ["quote", "faq", "priced", "form", "code"]) {
    const result = run(page({ quality: { desktop: { cards: [{ ...long, kind }] } } }));
    assert.equal(item(result, "cards_short").status, "skipped", kind);
    assert.equal(item(result, "cards_no_holes").status, "skipped", kind);
  }
  assert.equal(item(run(page()), "cards_short").status, "skipped");
  const old = run(page({ quality: { desktop: { cards: undefined, figures: undefined } } }));
  assert.equal(item(old, "cards_short").status, "nao_conferido");
  assert.equal(item(old, "figures_seen").status, "nao_conferido");
});

test("a figure that asks to be read is pointed out, and so is a planned figure the page does not mark", () => {
  const figure = (over) => ({ name: "atendimento", mark: "figura", width: 400, height: 300, words: 10, read_words: 0, longest: 3, blocks: 4, picture_share: 0, ...over });
  const planned = { figures: [{ name: "atendimento", section: "A dor", object: "telefone", says: "x" }, { name: "prazos", section: "Prazos", object: "calendário", says: "y" }] };
  const seen = (figures, over = planned) => item(run(page({ quality: { desktop: { figures } } }), over), "figures_seen");

  assert.equal(seen([figure({}), figure({ name: "prazos" })]).status, "ok");
  assert.match(seen([figure({})]).detail, /"prazos"/);
  assert.match(seen([figure({ longest: 34, read_words: 34 }), figure({ name: "prazos" })]).detail, /"atendimento" pede a leitura de 34 palavras, com uma frase de 34/);
  assert.equal(seen([figure({ longest: 14, read_words: 40 }), figure({ name: "prazos" })]).status, "atencao");
  assert.equal(seen([figure({ longest: 15, read_words: 30 }), figure({ name: "prazos" })]).status, "ok");
  assert.equal(seen([], {}).status, "nao_conferido");
});

test("a pagina.json written before this round still plans, without showing rows for fields it never had", () => {
  const old = { name: "antiga", type: "planos", created_at: "2026-11-07", product: { name: "Sistema" }, offer: {}, payment: {}, api: {} };
  const plan = renderPlan({ facts: old, type: type("planos"), checks: CHECKS, models: [], today: "2026-11-08" });
  assert.match(plan, /## A direção visual/);
  assert.doesNotMatch(plan, /o endereço da documentação/);
});

test("findClaims finds what the page states as a fact, and leaves prices, dates and offers out", () => {
  const text = [
    "+10.000 clientes",
    "99,9% de disponibilidade",
    "10x mais rápido",
    "4,9/5 de nota",
    "mais de 500 mil processos",
    "10.000 créditos de IA / mês",
    "Você + 9 usuários",
    "Até 1.000 clientes no plano",
    "Feito 100% para advocacia",
    "40%",
    "OFF no PIX",
    "1,2 mi+ processos · 1.500 escritórios",
    "0+",
    "escritórios em todo o Brasil",
    "Últimas vagas",
    "Só 3 vagas",
    "27 pessoas vendo agora",
    "Desde 2018",
    "R$ 1.234,56 por mês",
    "40% OFF no anual",
    "30% de desconto no cartão",
    "12x sem juros",
    "CNPJ: 12.345.678/0001-90",
    "Oferta válida até 31/12",
    "Rua das Flores, 1000",
    "Passo 1",
    "CEP 01.310-100",
  ].join("\n");
  assert.deepEqual(findClaims(text), ["+10.000", "99,9%", "10x", "4,9/5", "mais de 500 mil", "1,2 mi+", "1.500 escritórios", "Últimas vagas", "Só 3 vagas", "27 pessoas vendo", "Desde 2018"]);
  assert.deepEqual(findClaims("Agendar demonstração\nTeste por 7 dias"), []);
  assert.equal(claimHasOrigin("+10.000", [{ text: "+10.000 clientes", origin: "painel, outubro" }]), true);
  assert.equal(claimHasOrigin("+10.000", [{ text: "+10.000 clientes", origin: "" }]), false, "no origin, no pass");
  assert.equal(claimHasOrigin("99,9%", [{ text: "+10.000 clientes", origin: "painel" }]), false);
  assert.equal(claimHasOrigin("Últimas vagas", [{ text: "últimas vagas", origin: "agenda" }]), true);
  assert.equal(claimHasOrigin("+1", null), false);
});

test("what the page states needs an origin; without any statement there is nothing to say", () => {
  const capture = page();
  assert.equal(item(run(capture), "claims_have_origin").status, "skipped");
  const open = item(run(capture, {}, { text: "+10.000 clientes\n99,9% de disponibilidade" }), "claims_have_origin");
  assert.equal(open.status, "atencao");
  assert.match(open.detail, /"\+10\.000"/);
  assert.equal(open.fix, CHECKS.checks.claims_have_origin.fix);
  const covered = run(capture, { claims: [{ text: "+10.000 clientes", origin: "painel" }, { text: "99,9%", origin: "página de status" }] }, { text: "+10.000 clientes\n99,9% de disponibilidade" });
  assert.equal(item(covered, "claims_have_origin").status, "ok");
});

test("a sample name forgotten on the page is flagged, and the product's own name is not", () => {
  const capture = page();
  assert.equal(item(run(capture, {}, { text: "João pediu o prazo" }), "placeholder_data").status, "ok");
  assert.equal(item(run(capture, {}, { text: "Lorem ipsum dolor" }), "placeholder_data").status, "atencao");
  assert.equal(item(run(capture, {}, { text: "john doe, cliente" }), "placeholder_data").status, "atencao");
  assert.equal(item(run(capture, { product: { name: "Acme Gestão" } }, { text: "A Acme cuida disso" }), "placeholder_data").status, "ok");
});

test("the demonstration is marked, named, without headings, and labelled when its data is invented", () => {
  const scene = (over) => ({ name: "topo", x: 0, y: 0, width: 500, height: 300, section: 1, headings: 0, has_name: true, label_near: true, ...over });
  const withScene = (over) => page({ quality: { desktop: { demos: [scene(over)] } } });
  const declared = (over) => ({ demo: { kind: "componentes", sample_data: true, ...over } });
  assert.equal(item(run(page()), "demo_honest").status, "skipped", "no demonstration, nothing to say");
  assert.equal(item(run(page(), declared()), "demo_honest").status, "atencao", "declared and not marked on the page");
  assert.equal(item(run(withScene({}), declared()), "demo_honest").status, "ok");
  assert.match(item(run(withScene({ headings: 2 }), declared()), "demo_honest").detail, /sumário da página/);
  assert.match(item(run(withScene({ has_name: false }), declared()), "demo_honest").detail, /texto alternativo/);
  assert.match(item(run(withScene({ label_near: false }), declared()), "demo_honest").detail, /etiqueta/);
  assert.equal(item(run(withScene({ label_near: false }), declared({ sample_data: false })), "demo_honest").status, "ok", "real data needs no label");
  assert.match(item(run(withScene({}), declared({ sample_data: null })), "demo_honest").detail, /demo\.sample_data/);
});

test("the filmed scene: not filmed is not a failure, and moving against the request for less motion is", () => {
  const capture = page();
  const pass = (over) => ({ visible: true, frames: 16, changes: 8, ...over });
  const moving = { passes: { desktop: pass(), mobile: pass(), reduced: pass({ frames: 3, changes: 0 }) } };
  assert.equal(item(run(capture), "demo_film").status, "skipped");
  assert.equal(item(run(capture, { demo: { kind: "tela" } }), "demo_film").status, "nao_conferido");
  assert.equal(item(run(capture, { demo: { kind: "tela", selector: "[data-demo]" } }), "demo_film").status, "nao_conferido");
  assert.equal(item(run(capture, { demo: { selector: "[data-demo]" } }, { film: { error: "A cena não foi filmada: sem navegador." } }), "demo_film").detail, "A cena não foi filmada: sem navegador.");
  assert.equal(item(run(capture, { demo: { selector: "[data-demo]" } }, { film: moving }), "demo_film").status, "ok");
  const calm = item(run(capture, { demo: { selector: "[data-demo]" } }, { film: { passes: { ...moving.passes, reduced: pass({ frames: 3, changes: 2 }) } } }), "demo_film");
  assert.match(calm.detail, /menos movimento/);
  assert.match(item(run(capture, { demo: { selector: "[data-demo]" } }, { film: { passes: { ...moving.passes, mobile: pass({ visible: false }) } } }), "demo_film").detail, /não aparece no celular/);
  const still = { passes: { ...moving.passes, desktop: pass({ changes: 0 }) } };
  assert.match(item(run(capture, { demo: { selector: "[data-demo]" } }, { film: still }), "demo_film").detail, /não se mexeu/);
  assert.equal(item(run(capture, { demo: { selector: "[data-demo]", animated: false } }, { film: still }), "demo_film").status, "ok", "a still scene may stand still");
  const saved = { ...capture, input_kind: "mhtml" };
  assert.match(item(run(saved, { demo: { selector: "[data-demo]" } }), "demo_film").detail, /página salva/);
});

test("the defaults are named, and what the plan chose on purpose stops being pointed at", () => {
  const defaults = { found: { gradient_text: ["O título"], equal_cards: ["O que dá para fazer"], status_dots: ["respondendo agora"] }, counts: { gradient_text: 1, equal_cards: 1, status_dots: 1 }, mono_share: 0.4 };
  const capture = page({ quality: { desktop: { defaults } }, anatomy: { motion: { running: [{ iterations: "infinite" }, { iterations: "infinite" }, { iterations: 1 }] } } });
  const text = "Revolucione o seu escritório\n01 / Recursos\nRole para baixo";
  const flagged = item(run(capture, {}, { text }), "ai_defaults");
  assert.equal(flagged.status, "atencao");
  for (const name of ["texto_degrade", "tres_cartoes_iguais", "ponto_de_status", "movimento_sem_fim", "tudo_mono", "numero_na_secao", "aviso_de_rolagem", "verbos_de_enchimento"]) assert.match(flagged.detail, new RegExp(name), name);
  const chosen = item(run(capture, { visual: { direction: "x", chosen: ["texto_degrade", "tudo_mono"] } }, { text }), "ai_defaults");
  assert.doesNotMatch(chosen.detail, /texto_degrade|tudo_mono/);
  const clean = item(run(page()), "ai_defaults");
  assert.equal(clean.status, "ok");
  const all = item(run(capture, { visual: { chosen: ["texto_degrade", "tres_cartoes_iguais", "ponto_de_status", "movimento_sem_fim", "tudo_mono", "numero_na_secao", "aviso_de_rolagem", "verbos_de_enchimento"] } }, { text }), "ai_defaults");
  assert.equal(all.status, "ok");
  assert.match(all.detail, /de propósito/);
});

test("a section numbered in the ordinary way is not a default, and a step list is not either", () => {
  const capture = page();
  assert.equal(item(run(capture, {}, { text: "1. Escolha o plano\n2. Crie a conta\nPasso 3" }), "ai_defaults").status, "ok");
  assert.equal(item(run(capture, {}, { text: "Eleve a sua operação" }), "ai_defaults").status, "atencao");
  assert.equal(item(run(capture, {}, { text: "Uma elevação de prazo" }), "ai_defaults").status, "ok");
});

test("the same request under many names is flagged; plan buttons and the menu do not count", () => {
  const cta = (text, over = {}) => ({ text, section: 1, in_fixed: false, href: null, ...over });
  const three = page({ anatomy: { ctas: [cta("Agendar demonstração"), cta("Testar agora"), cta("Criar conta"), cta("Abrir menu")] } });
  assert.match(item(run(three), "cta_consistent").detail, /3 textos/);
  const two = page({ anatomy: { ctas: [cta("Agendar demonstração"), cta("Testar agora"), cta("agendar demonstração")] } });
  assert.equal(item(run(two), "cta_consistent").status, "ok");
  const plans = page({ anatomy: { ctas: [cta("Agendar demonstração"), cta("Testar agora"), cta("Assinar Essencial", { section: 2 }), cta("Assinar Sociedade", { section: 2 })], prices: [{ text: "R$ 10", value: 10, struck: false, section: 2, y: 10 }] } });
  assert.equal(item(run(plans), "cta_consistent").status, "ok", "each plan card has its own button");
});

test("colors and letters off the brand are flagged; neutrals and generic fonts are not; nothing registered is not checked", () => {
  const capture = page({ brand: { colors: { primary: "#7C3AED", palette: [{ hex: "#FFFFFF", share: 0.8 }, { hex: "#111827", share: 0.1 }, { hex: "#0F62FE", share: 0.08 }, { hex: "#00FF00", share: 0.01 }] }, fonts: { headline: "Fraunces", body: "Inter" } } });
  assert.equal(item(run(capture), "off_brand").status, "nao_conferido");
  const off = item(run(capture, { brand: { colors: ["#0F62FE"], fonts: ["Inter"], source: "x" } }), "off_brand");
  assert.equal(off.status, "atencao");
  assert.match(off.detail, /#7C3AED/);
  assert.doesNotMatch(off.detail, /#111827|#FFFFFF|#00FF00|#0F62FE/, "neutrals, a tiny share and the brand's own color stay out");
  assert.match(off.detail, /Fraunces/);
  const onBrand = page({ brand: { colors: { primary: "#0F62FF", palette: [{ hex: "#0F62FE", share: 0.5 }] }, fonts: { headline: "Inter Variable", body: "system-ui" } } });
  assert.equal(item(run(onBrand, { brand: { colors: ["#0F62FE"], fonts: ["Inter"] } }), "off_brand").status, "ok");
});

test("the finished page's measurements: the width, the text, the touch, the contrast, the buttons and the images", () => {
  const healthy = run(page());
  for (const id of ["mobile_fits", "text_legible", "tap_targets", "contrast_ok", "controls_fit", "images_light"]) assert.equal(item(healthy, id).status, "ok", id);

  const wide = page({ quality: { mobile: { overflow: { viewport_width: 390, inner_width: 724, scroll_width: 724, cut: 2, offenders: [{ tag: "div", text: "Um bloco largo", right: 724, width: 700 }] } } } });
  assert.match(item(run(wide), "mobile_fits").detail, /"Um bloco largo" vai até 724 px numa tela de 390 px, e mais 1 elementos/);
  const sideways = page({ quality: { mobile: { overflow: { viewport_width: 390, inner_width: 390, scroll_width: 500, cut: 0, offenders: [] } } } });
  assert.match(item(run(sideways), "mobile_fits").detail, /rola de lado/);

  const smallPrice = page({ quality: { mobile: { small_text: { total_chars: 1000, small_chars: 10, share: 0.01, min_px: 10, samples: [], key: [{ text: "R$ 19,90", px: 10 }] } } } });
  assert.match(item(run(smallPrice), "text_legible").detail, /"R\$ 19,90" aparece com 10 px/);
  const smallShare = page({ quality: { mobile: { small_text: { total_chars: 1000, small_chars: 500, share: 0.5, min_px: 10, samples: [{ text: "letras pequenas", px: 10 }], key: [] } } } });
  assert.match(item(run(smallShare), "text_legible").detail, /50% do texto/);
  const smallFooter = page({ quality: { mobile: { small_text: { total_chars: 1000, small_chars: 300, share: 0.3, min_px: 10, samples: [], key: [] } } } });
  assert.equal(item(run(smallFooter), "text_legible").status, "ok", "the Lighthouse line is 40%");

  const tiny = page({ quality: { mobile: { tap_targets: { checked: 5, small: 3, undersized: 3, samples: [{ text: "1", width: 16, height: 16 }] } } } });
  assert.match(item(run(tiny), "tap_targets").detail, /3 alvos de toque têm menos de 24 px/);

  const pale = page({ quality: { desktop: { contrast: { checked: 4, unknown: {}, failing: [{ role: "cta", text: "Ver os planos", ratio: 1.19, required: 4.5, color: "#D1D5DB", background: "#E5E7EB" }] } } } });
  assert.match(item(run(pale), "contrast_ok").detail, /1,19 para 1 \(#D1D5DB sobre #E5E7EB\), e o mínimo é 4,5 para 1/);
  const partial = page({ quality: { desktop: { contrast: { checked: 3, unknown: { imagem: 2 }, failing: [] } } } });
  assert.match(item(run(partial), "contrast_ok").detail, /2 ficaram de fora/);
  const none = page({ quality: { desktop: { contrast: { checked: 0, unknown: { imagem: 5 }, failing: [] } } } });
  assert.equal(item(run(none), "contrast_ok").status, "nao_conferido", "nothing measured is not a pass");

  const cut = page({ quality: { mobile: { controls: { checked: 2, problems: [{ text: "Quero contratar", reason: "cortado", width: 70, height: 40 }] } } } });
  assert.match(item(run(cut), "controls_fit").detail, /"Quero contratar" é cortado no celular/);

  const heavy = page({ quality: { mobile: { images: { count: 2, heavy: [{ src: "https://a/foto.png?v=2", bytes: 900 * 1024 }], oversized: [] } } } });
  assert.match(item(run(heavy), "images_light").detail, /foto\.png pesa 900 KB/);
  const big = page({ quality: { mobile: { images: { count: 2, heavy: [], oversized: [{ src: "https://a/foto.png", natural_width: 3000, shown_width: 300, oversize: 5, bytes: 200000 }] } } } });
  assert.match(item(run(big), "images_light").detail, /tem 3000 px e aparece com 300 px/);
  assert.equal(item(run(page({ quality: { mobile: { images: { count: 0, heavy: [], oversized: [] } } } })), "images_light").status, "skipped");
});

test("a capture from before these measurements is not checked, never failed", () => {
  const old = page();
  delete old.anatomy.quality;
  const result = run(old);
  for (const id of ["mobile_fits", "text_legible", "tap_targets", "contrast_ok", "controls_fit", "images_light", "ai_defaults"]) {
    assert.equal(item(result, id).status, "nao_conferido", id);
    assert.match(item(result, id).detail, /atualize o Motor de vídeo/, id);
  }
  const half = page();
  half.anatomy.quality = { desktop: null, mobile: null };
  assert.equal(item(run(half), "contrast_ok").status, "nao_conferido");
});

test("audit through the Video engine: a page with defects on purpose, and the scene filmed", { timeout: 280000 }, () => {
  const fixtures = resolve(app, "..", "video-render", "tests", "fixtures");
  const defects = join(fixtures, "qualidade", "index.html");
  const scene = join(fixtures, "filme", "index.html");
  if (!existsSync(defects) || !existsSync(scene)) return;
  const project = mkdtempSync(join(tmpdir(), "conversion-pages-quality-"));
  const cli = (...args) => JSON.parse(spawnSync(process.execPath, [script, ...args, "--json"], { cwd: project, encoding: "utf8", timeout: 200000 }).stdout.trim());
  const statusOf = (result, id) => result.items.find((entry) => entry.id === id)?.status ?? "skipped";
  try {
    cli("new", "defeitos", "--type", "landing");
    const result = cli("audit", "defeitos", "--url", defects);
    if (!result.ok && /browser|navegador/i.test(`${result.error?.code} ${result.error?.message}`)) return; // no browser on this machine
    assert.equal(result.ok, true, JSON.stringify(result.error));
    for (const id of ["mobile_fits", "text_legible", "tap_targets", "contrast_ok", "controls_fit", "images_light", "ai_defaults"]) assert.equal(statusOf(result, id), "atencao", id);
    assert.equal(statusOf(result, "off_brand"), "nao_conferido");
    assert.equal(result.film, null);
    assert.equal(result.files.photos.length, 2);
    assert.ok(result.files.photos.every((file) => existsSync(join(project, file))), result.files.photos.join(" "));
    assert.equal(result.files.no_letters.length, 2);
    assert.ok(result.files.no_letters.every((file) => existsSync(join(project, file))), result.files.no_letters.join(" "));
    assert.match(result.next_step, /files\.no_letters/);
    assert.match(result.not_checked, /não vê se a página se entende/);
    assert.equal(result.files.before, null);
    assert.match(read(join(project, "paginas", "defeitos", "conferencia.json")).not_checked, /não vê se a página se entende/);

    // The photo of before stays apart, and the next audit shows it next to the new one.
    const before = cli("audit", "defeitos", "--url", defects, "--before");
    assert.equal(before.ok, true, JSON.stringify(before.error));
    assert.equal(before.before, true);
    assert.ok(before.files.no_letters.every((file) => /\/antes\//.test(file) && existsSync(join(project, file))), before.files.no_letters.join(" "));
    const compared = cli("audit", "defeitos", "--url", defects);
    assert.deepEqual(compared.files.before.no_letters, before.files.no_letters);
    assert.match(compared.next_step, /files\.before/);

    // The photos stay out of the project's commits.
    for (const folder of ["captura", "antes"]) assert.equal(readFileSync(join(project, "paginas", "defeitos", folder, ".gitignore"), "utf8"), "*\n", folder);

    cli("new", "cena", "--type", "landing");
    const file = join(project, "paginas", "cena", "pagina.json");
    const saved = read(file);
    saved.demo = { ...saved.demo, kind: "componentes", sample_data: true, selector: "[data-demo]" };
    writeFileSync(file, JSON.stringify(saved));
    const filmed = cli("audit", "cena", "--url", scene);
    assert.equal(filmed.ok, true, JSON.stringify(filmed.error));
    assert.equal(statusOf(filmed, "demo_honest"), "ok", JSON.stringify(filmed.items.find((entry) => entry.id === "demo_honest")));
    assert.equal(statusOf(filmed, "demo_film"), "ok", JSON.stringify(filmed.items.find((entry) => entry.id === "demo_film")));
    assert.equal(filmed.film.mode, "real_time");
    assert.equal(filmed.film.sheets.length, 3);
    assert.ok(filmed.film.sheets.every((sheet) => existsSync(join(project, sheet))), filmed.film.sheets.join(" "));
    assert.match(filmed.next_step, /film\.sheets/);
    assert.deepEqual(read(join(project, "paginas", "cena", "conferencia.json")).film.sheets, filmed.film.sheets);
    assert.equal(readFileSync(join(project, "paginas", "cena", "filme", ".gitignore"), "utf8"), "*\n");

    const missing = read(file);
    missing.demo.selector = "[data-nada]";
    writeFileSync(file, JSON.stringify(missing));
    const lost = cli("audit", "cena", "--url", scene);
    assert.equal(lost.ok, true, "a film that fails does not fail the audit");
    assert.equal(statusOf(lost, "demo_film"), "nao_conferido");
    assert.match(lost.film.error, /data-nada/);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});

// ----- the course sales page (1.3.0), measured on the Subido AI pages -----

test("installments alone are pointed out, and installments next to the cash price or the total are not", () => {
  const offer = "40% OFF\nDe R$ 16.200,00\npor 12x de\nR$\n797\nOferta da Black, sem previsão de nova turma.";
  assert.deepEqual(installmentsIn(offer).map((i) => [i.count, i.value, i.cash_near]), [[12, 797, false]]);
  const bare = item(run(page(), {}, { text: offer, id: "curso" }), "cash_price_shown");
  assert.equal(bare.status, "atencao");
  assert.match(bare.detail, /12x de R\$ 797/);
  for (const text of [
    "R$ 9.720 à vista\nou 12x de R$ 810",
    "12x de R$ 810\nou R$ 9.720 no PIX",
    "12x de R$ 81,00 sem juros\nTotal a prazo: R$ 972,00",
    "À vista: R$ 9.720\n12x R$ 810",
    // From a page built in the proof: the cash price and the total sit a few words away from the number.
    "Como posso pagar?\nÀ vista no PIX, por R$ 897, ou em 12x de R$ 89,70 no cartão. No cartão, o total é R$ 1.076,40, com os juros da operadora.",
  ]) assert.equal(item(run(page(), {}, { text, id: "curso" }), "cash_price_shown").status, "ok", text);
  assert.equal(item(run(page(), {}, { text: "Cartão em até 12x, boleto ou PIX.", id: "curso" }), "cash_price_shown").status, "skipped", "a payment option is not a price");
});

test("the value list adds up to its total, and an item without a value of its own stays out", () => {
  const list = (total) => `## Tudo o que você recebe\n\nFormação\nR$ 5.964\n25 soluções\nR$ 12.425\nR$ 497/cada\nConsultor\nN/A\nComunidade\nR$ 600\nR$ 50/mês\nTotal\n${total}\nO que vale de verdade`;
  assert.deepEqual(stacksIn(list("R$ 18.989")).map((s) => [s.items.length, s.sum, s.total]), [[3, 18989, 18989]]);
  assert.equal(item(run(page(), {}, { text: list("R$ 18.989"), id: "curso" }), "stack_sum").status, "ok");
  const wrong = item(run(page(), {}, { text: list("R$ 19.492"), id: "curso" }), "stack_sum");
  assert.equal(wrong.status, "atencao");
  assert.match(wrong.detail, /somam R\$ 18\.989,00, e o total escrito é R\$ 19\.492,00/);
  assert.equal(item(run(page(), {}, { text: "Plano anual\nR$ 1.200\nTotal no cartão R$ 1.200", id: "curso" }), "stack_sum").status, "skipped", "a plan's total is not a list");
});

test("a discount over installments counts the installments, not one of them", () => {
  const offer = (installment) => page({ anatomy: { prices: [
    { text: "R$ 16.200,00", value: 16200, struck: true, context: "40% OFF De R$ 16.200,00 por 12x de R$ 797", section: 1, y: 100 },
    { text: `R$ ${installment}`, value: Number(installment), struck: false, context: `40% OFF De R$ 16.200,00 por 12x de R$ ${installment}`, section: 1, y: 140 },
  ] } });
  const off = item(run(offer("797"), {}, { id: "curso" }), "discount_math");
  assert.equal(off.status, "atencao");
  assert.match(off.detail, /12x de R\$ 797 somam R\$ 9\.564,00, e 40% de desconto sobre R\$ 16\.200,00 dá R\$ 9\.720,00/);
  assert.equal(item(run(offer("810"), {}, { id: "curso" }), "discount_math").status, "ok");
});

test("a sample name inside a labelled sample is on purpose, and a loose one is still flagged", () => {
  const certificate = "Modelo de certificado\nSeu nome aqui\nexemplo de formação concluída\nEmitido por\nViver de IA\nPrévia ilustrativa · sem validade";
  assert.equal(item(run(page(), {}, { text: certificate }), "placeholder_data").status, "ok");
  assert.equal(item(run(page(), {}, { text: `${certificate}\n\n${"Texto da página. ".repeat(10).trim().replace(/\. /g, ".\n")}\nSeu nome aqui` }), "placeholder_data").status, "atencao");
});

test("a top button that scrolls to the offer counts as the first screen's call", () => {
  const ctas = (anchorOnTop) => [
    { index: 0, kind: "link", text: "Quero faturar com IA", href: anchorOnTop ? "https://exemplo.com.br/#oferta" : "https://exemplo.com.br/sobre", y: 600, above_fold: { desktop: true, mobile: true }, in_fixed: false, section: 1 },
    { index: 1, kind: "link", text: "Quero garantir a vaga", href: "https://pagamento.exemplo.com.br/", y: 20000, above_fold: { desktop: false, mobile: false }, in_fixed: false, section: 9 },
  ];
  const scrolls = item(run(page({ anatomy: { ctas: ctas(true) } }), { cta_text: "Quero garantir a vaga" }, { id: "curso" }), "cta_first_screen");
  assert.equal(scrolls.status, "ok");
  assert.match(scrolls.detail, /Confira que esse ponto é a oferta/);
  assert.equal(item(run(page({ anatomy: { ctas: ctas(false) } }), { cta_text: "Quero garantir a vaga" }, { id: "curso" }), "cta_first_screen").status, "atencao");
});

test("with the request for less motion, a loop that keeps going is pointed out even when the rule exists", () => {
  const motion = (over) => page({ anatomy: { motion: { running: [{ kind: "css-animation", name: "letreiro", iterations: "infinite" }], keyframes: [], transitions: 0, reduced_motion_rules: 1, smooth_scroll: false, scroll_snap: 0, stylesheets_unread: 0, ...over } } });
  const still = item(run(motion({ reduced_still_running: 49, reduced_still_names: ["marq em div.tape-track"] })), "reduced_motion");
  assert.equal(still.status, "atencao");
  assert.match(still.detail, /49 animações continuam se mexendo sozinhas/);
  assert.equal(item(run(motion({ reduced_still_running: 0, reduced_still_names: [] })), "reduced_motion").status, "ok");
  assert.match(item(run(motion({})), "reduced_motion").detail, /tem a regra de menos movimento/, "an older capture still reads the rule");
});

test("a claim's origin counts under the names the AIs wrote in the proof, and never without an origin", () => {
  assert.equal(claimHasOrigin("1.200 alunos", [{ text: "1.200 alunos em turmas presenciais", origin: "planilha" }]), true);
  assert.equal(claimHasOrigin("1.200 alunos", [{ text: "1.200 alunos", source: "PRODUTO.md" }]), true);
  assert.equal(claimHasOrigin("Desde 2019", [{ claim: "1.200 alunos, desde 2019", source: "PRODUTO.md" }]), true);
  assert.equal(claimHasOrigin("1.200 alunos", [{ claim: "1.200 alunos", source: "" }]), false);
  assert.equal(claimHasOrigin("1.200 alunos", [{ text: "outro número", origin: "planilha" }]), false);
});
