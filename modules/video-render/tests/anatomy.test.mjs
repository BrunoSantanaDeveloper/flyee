// The page anatomy of the capture (1.1.0): the pure helpers without a browser, then the offer
// fixture through the real browser (skipped when none is installed), then the same page saved as
// .mhtml by the browser itself and captured through the command, as the member's AI runs it.
// Outputs go to FLYEE_TEST_OUT when set, else to the system's temporary folder.
//   node --test modules/video-render/tests/anatomy.test.mjs

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { Browser } from "../scripts/lib/browser.mjs";
import {
  aboveFold,
  anatomyCounts,
  buildAnatomy,
  captureSite,
  countdownsFrom,
  finishAnatomy,
  fixedEdge,
  iframeProvider,
  inputKind,
  isDeclineText,
  looksLikeTimer,
  matchMobileCtas,
  mergeFixed,
  normalizeUrl,
  PAGE_TEXT_MAX,
  pageText,
  priceContext,
  SECTION_TEXT_MAX,
  windowsOpenedByWarmUp,
} from "../scripts/lib/capture.mjs";
import { checkTools, findBrowser } from "../scripts/lib/tools.mjs";
import { fileUrl } from "../scripts/lib/util.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/render.mjs", import.meta.url));
const OFFER = fileURLToPath(new URL("./fixtures/oferta/index.html", import.meta.url));
const WINDOW_PAGE = fileURLToPath(new URL("./fixtures/janela/index.html", import.meta.url));
const OUT_ROOT = process.env.FLYEE_TEST_OUT ? resolve(process.env.FLYEE_TEST_OUT) : join(tmpdir(), "flyee-video-render-tests", "anatomy");
const browser = findBrowser();
const noBrowser = browser ? false : "no browser (Edge, Chrome or Chromium) on this machine";
const tools = await checkTools();
/** The headings of the offer fixture, section 0 first (the text before the first heading). */
const OFFER_HEADINGS = [null, "Leve o Guia de Receitas com 60% de desconto", "O que vem no guia", "Escolha os adicionais", "Perguntas frequentes"];

function fresh(name) {
  const dir = join(OUT_ROOT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Runs render.mjs as the member's AI would: from the repo root, with --json. */
function cli(args, { cwd = resolve(fileURLToPath(new URL("../../..", import.meta.url))) } = {}) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [SCRIPT, ...args, "--json"], { cwd, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => {
      let json = null;
      try {
        json = JSON.parse(stdout);
      } catch {
        // not JSON: the assertion shows stdout and stderr
      }
      done({ code, json, stdout, stderr });
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------------------------

test("isDeclineText finds the links that decline or skip an offer and leaves skip-to-content links out", () => {
  for (const text of ["Não, obrigado", "nao obrigada", "NÃO, OBRIGADO", "Pular oferta", "Pular", "Agora não", "Dispensar", "Continuar sem o bônus", "Não quero o desconto", "No thanks", "No, thanks", "No thank you", "Skip", "Skip this offer", "Not now", "Maybe later", "Decline"]) {
    assert.equal(isDeclineText(text), true, text);
  }
  for (const text of ["Sim, quero o guia", "Comprar agora", "Obrigado pela compra", "Pularam de alegria", "Skipper", "Pular para o conteúdo", "Skip to main content", "Ir para o conteúdo", "", null]) {
    assert.equal(isDeclineText(text), false, String(text));
  }
});

test("looksLikeTimer reads clock and unit timers and leaves prices, ratios, years and durations out", () => {
  for (const text of ["00:12:34", "12:34", "Termina em 00:14:59", "1:02:03:04", "00 : 12 : 34", "2d 14h 33m", "02 dias 14 horas 33 minutos", "14h 33m 12s", "33 min 12 s", "2 DIAS 3 HORAS"]) {
    assert.equal(looksLikeTimer(text), true, text);
  }
  for (const text of ["R$ 49,99", "16:9", "2026", "Aula de 2 horas", "3 dias de garantia", "10h", "12 meses", "", null]) {
    assert.equal(looksLikeTimer(text), false, String(text));
  }
});

test("aboveFold uses the element's center, and fixedEdge says which edge a fixed element holds", () => {
  assert.equal(aboveFold({ y: 228, height: 60 }, 900), true);
  assert.equal(aboveFold({ y: 860, height: 60 }, 900), true, "the center is still on the first screen");
  assert.equal(aboveFold({ y: 880, height: 60 }, 900), false, "more than half below the fold");
  assert.equal(aboveFold({ y: 1342, height: 44 }, 844), false);
  assert.equal(aboveFold({ y: -80, height: 40 }, 900), false, "above the page");
  assert.equal(aboveFold({ y: 10, height: 10 }, null), null, "no viewport, no answer");
  assert.equal(fixedEdge({ top: 0, bottom: 37 }, 900), "top");
  assert.equal(fixedEdge({ top: 60, bottom: 100 }, 900), "top", "a second bar under the header");
  assert.equal(fixedEdge({ top: 832, bottom: 900 }, 900), "bottom");
  assert.equal(fixedEdge({ top: 760, bottom: 820 }, 844), "bottom", "a floating button near the bottom");
  assert.equal(fixedEdge({ top: 0, bottom: 900 }, 900), "other", "an overlay over the whole screen");
  assert.equal(fixedEdge({ top: 400, bottom: 460 }, 900), "other", "a button in the middle of the side");
  assert.equal(fixedEdge({ top: 0, bottom: 37 }, undefined), "other");
});

test("matchMobileCtas pairs each desktop call with the mobile one of the same text, in order", () => {
  const desktop = [{ text: "Comprar agora" }, { text: "Pular oferta" }, { text: "Comprar agora" }, { text: "Só no computador" }];
  const mobile = [{ text: "COMPRAR AGORA", y: 300, height: 50 }, { text: "Pular oferta", y: 900, height: 20 }, { text: "comprar  agora", y: 2400, height: 50 }];
  assert.deepEqual(matchMobileCtas(desktop, mobile, 844), [true, false, false, null]);
  assert.deepEqual(matchMobileCtas(desktop, null, 844), [null, null, null, null], "without a mobile reading the answer is null, never false");
  assert.deepEqual(matchMobileCtas([], [], 844), []);
});

test("matchMobileCtas pairs the same element first, so a menu button hidden on the phone does not take the place of the page's button", () => {
  const desktop = [
    { path: "header:1>a:1", text: "Comece grátis" },
    { path: "main:1>section:1>a:1", text: "Comece grátis" },
    { path: "main:1>section:1>a:2", text: "Agendar uma demonstração" },
  ];
  const mobile = [
    { path: "main:1>section:1>a:1", text: "Comece grátis", y: 560, height: 48 },
    { path: "main:1>section:1>a:2", text: "Agendar uma demonstração", y: 620, height: 48 },
  ];
  assert.deepEqual(matchMobileCtas(desktop, mobile, 844), [null, true, true]);
  const rebuilt = mobile.map(({ path, ...rest }) => ({ ...rest, path: `div:1>${path}` }));
  assert.deepEqual(matchMobileCtas(desktop, rebuilt, 844), [true, null, true], "a phone page built differently falls back to the text in order");
});

test("mergeFixed keeps what was on screen at the top and marks what showed up only after the scroll", () => {
  const strip = { id: 1, position: "sticky", top: 0, bottom: 37, height: 37, text: "Oferta disponível só nesta página", ctas: [] };
  const bar = { id: 7, position: "fixed", top: 832, bottom: 900, height: 68, text: "Guia por R$ 19,99 Quero o guia", ctas: ["Quero o guia"] };
  assert.deepEqual(mergeFixed([strip], [strip, bar], { pass: "desktop", viewportHeight: 900 }), [
    { pass: "desktop", position: "sticky", edge: "top", text: "Oferta disponível só nesta página", height: 37, ctas: [], appeared_after_scroll: false },
    { pass: "desktop", position: "fixed", edge: "bottom", text: "Guia por R$ 19,99 Quero o guia", height: 68, ctas: ["Quero o guia"], appeared_after_scroll: true },
  ]);
  const hides = mergeFixed([{ id: 3, position: "fixed", top: 0, bottom: 50, height: 50, text: "x".repeat(400), ctas: ["Comprar"] }], [], { pass: "mobile", viewportHeight: 844 });
  assert.equal(hides[0].appeared_after_scroll, false, "a bar that hides on scroll was still there at the top");
  assert.equal(hides[0].text.length, 280);
  const many = Array.from({ length: 15 }, (_, i) => ({ id: i + 1, position: "fixed", top: 0, bottom: 40, height: 40, text: "", ctas: [] }));
  assert.equal(mergeFixed(many, [], { pass: "desktop", viewportHeight: 900 }).length, 10, "ten per pass, twenty in all");
});

test("with the arrival reading, a window opened by the warm-up scroll counts as appeared after the scroll", () => {
  const header = { id: 1, position: "sticky", top: 0, bottom: 60, height: 60, text: "Sistema Exemplo Agendar demonstração", ctas: ["Agendar demonstração"] };
  const modal = { id: 9, position: "fixed", top: 0, bottom: 900, height: 900, text: "Oferta de fim de ano Ver a oferta Agora não", ctas: ["Ver a oferta", "Agora não"] };
  const merged = mergeFixed([header, modal], [header, modal], { pass: "desktop", viewportHeight: 900, arrival: [header] });
  assert.deepEqual(merged.map((f) => [f.edge, f.appeared_after_scroll]), [["top", false], ["other", true]]);
  assert.equal(mergeFixed([header, modal], [], { pass: "desktop", viewportHeight: 900 })[1].appeared_after_scroll, false, "without the arrival reading, the old rule stands");
  assert.deepEqual(windowsOpenedByWarmUp([header, modal], [header], 900).map((f) => f.id), [9]);
  assert.deepEqual(windowsOpenedByWarmUp([header, modal], [header, modal], 900), [], "a window open on arrival was not opened by the warm-up");
  assert.deepEqual(windowsOpenedByWarmUp([header, modal], null, 900), [], "no arrival reading, no claim");
});

test("inputKind, normalizeUrl for pages saved as .mhtml or .mht, and iframeProvider", () => {
  const dir = fresh("entradas");
  const saved = join(dir, "pagina salva.mhtml");
  const old = join(dir, "antiga.MHT");
  writeFileSync(saved, "MIME-Version: 1.0\r\n");
  writeFileSync(old, "MIME-Version: 1.0\r\n");
  const url = normalizeUrl(saved);
  assert.match(url, /^file:\/\/\/.*pagina%20salva\.mhtml$/);
  assert.equal(inputKind(url), "mhtml");
  assert.equal(inputKind(normalizeUrl(old)), "mhtml");
  assert.equal(inputKind(fileUrl(saved)), "mhtml", "a file: address as well as a path");
  assert.equal(inputKind(normalizeUrl(OFFER)), "html");
  assert.equal(inputKind("https://www.exemplo.com.br/oferta"), "url");
  assert.equal(inputKind("https://www.exemplo.com.br/pagina.mhtml"), "url", "a saved page on a server is still a site");
  assert.equal(inputKind("nada"), "url");
  assert.throws(() => normalizeUrl(join(dir, "nao-existe.mhtml")), (error) => error.code === "invalid_url" && /mhtml/.test(error.fix));
  assert.equal(iframeProvider("https://www.youtube.com/embed/abc"), "youtube");
  assert.equal(iframeProvider("https://www.youtube-nocookie.com/embed/abc"), "youtube");
  assert.equal(iframeProvider("https://player.vimeo.com/video/1"), "vimeo");
  assert.equal(iframeProvider("https://player.pandavideo.com.br/embed/?v=x"), "other");
  assert.equal(iframeProvider("not a url"), "other");
});

test("countdownsFrom keeps only the timers that changed between the two reads", () => {
  const first = [{ id: 1, text: "00:15:00", section: 1 }, { id: 2, text: "Aberto das 08:00 às 18:00", section: 4 }, { id: 3, text: "2d 14h 33m", section: 2 }, { id: 4, text: "12:00", section: 0 }];
  const second = [{ id: 1, text: "00:14:59" }, { id: 2, text: "Aberto das 08:00 às 18:00" }, { id: 3, text: "2d 14h 32m" }, { id: 4, text: "Esgotado" }];
  assert.deepEqual(countdownsFrom(first, second), [{ text: "00:14:59", section: 1 }, { text: "2d 14h 32m", section: 2 }]);
  assert.deepEqual(countdownsFrom(first, null), []);
  assert.deepEqual(countdownsFrom([], second), []);
});

test("priceContext gives the sentence around a price in at most 120 characters", () => {
  assert.equal(priceContext("De R$ 49,99 por R$ 19,99", 3), "De R$ 49,99 por R$ 19,99");
  assert.equal(priceContext("Primeira frase. Por R$ 9,90 por mês. Última frase.", 20), "Por R$ 9,90 por mês.");
  const long = `${"Texto antes do preço sem nenhuma pausa ".repeat(6)}por apenas R$ 19,99 no Pix ${"e mais texto depois do preço ".repeat(6)}`;
  const context = priceContext(long, long.indexOf("R$ 19,99"));
  assert.ok(context.length <= 120, `${context.length}: ${context}`);
  assert.match(context, /R\$ 19,99/);
  assert.equal(priceContext("", 0), null);
});

test("pageText writes texto.md by section and cuts at 60,000 characters with a line that says so", () => {
  const sections = [
    { heading: null, text: "Oferta disponível só nesta página" },
    { heading: { tag: "h1", text: "Leve o guia" }, text: "De R$ 49,99 por R$ 19,99\nSim, quero o guia" },
    { heading: { tag: "h2", text: "Sem texto" }, text: "" },
    { heading: { tag: "h2", text: "Perguntas frequentes" }, text: "Recebo quando?" },
  ];
  const { text, truncated } = pageText(sections);
  assert.equal(truncated, false);
  assert.equal(text, "Oferta disponível só nesta página\n\n## Leve o guia\n\nDe R$ 49,99 por R$ 19,99\nSim, quero o guia\n\n## Sem texto\n\n## Perguntas frequentes\n\nRecebo quando?\n");
  const big = pageText([{ heading: { tag: "h2", text: "Longa" }, text: "palavra ".repeat(20000) }]);
  assert.equal(big.truncated, true);
  assert.ok(big.text.length <= PAGE_TEXT_MAX, String(big.text.length));
  assert.match(big.text, /^## Longa\n\npalavra palavra/);
  assert.match(big.text, /palavra\n\n\[texto cortado em 60\.000 caracteres\]\n$/, "cut between words");
  assert.equal(pageText([{ heading: null, text: "curto" }], { truncated: true }).text, "curto\n\n[texto cortado em 60.000 caracteres]\n", "a text the page reading already cut says so too");
  assert.equal(pageText([]).text, "");
});

/** Page readings as anatomyInPage returns them, for a small offer page. */
function readings() {
  return {
    desktop: {
      top: {
        errors: [],
        viewport: { width: 1440, height: 900, scroll_y: 0 },
        sections: {
          list: [
            { index: 0, heading: null, y: 0, height: 92, text: "Topo", words: 1 },
            { index: 1, heading: { tag: "h1", text: "Leve o guia" }, y: 92, height: 300, text: "x".repeat(5000), words: 1 },
          ],
          truncated: false,
        },
        ctas: [
          { kind: "link", text: "Sim, quero", href: "https://x/#a", x: 10, y: 228, width: 300, height: 60, in_fixed: false, section: 1, disabled: false },
          { kind: "link", text: "Pular oferta", href: "https://x/#b", x: 10, y: 1000, width: 100, height: 20, in_fixed: false, section: 1, disabled: false },
        ],
        fixed: [{ id: 1, position: "sticky", top: 0, bottom: 37, height: 37, text: "Faixa", ctas: [] }],
        forms: [{ type: "checkbox", label: "Incluir por R$ 9,90", checked: true, required: false, name: "adicional", price_text: "R$ 9,90", section: 1, y: 1155 }],
        prices: [{ text: "R$ 49,99", struck: true, block: "De R$ 49,99 por R$ 19,99", at: 3, section: 1, y: 186 }],
        media: {
          videos: [{ src: "https://x/v.mp4", poster: "https://x/p.png", autoplay: true, muted: true, loop: true, playsinline: true, controls: false, width: 640, height: 360, duration_s: null, section: 1 }],
          iframes: [{ src: "https://www.youtube.com/embed/x", section: 1 }],
          images: { count: 2, without_alt: 1 },
        },
        motion: { keyframes: ["pulso"], transitions: 1, reduced_motion_rules: 1, smooth_scroll: true, scroll_snap: 0, stylesheets_unread: 0 },
        timers: [{ id: 9, text: "00:15:00", section: 1 }],
      },
      end: {
        errors: [],
        viewport: { width: 1440, height: 900, scroll_y: 1500 },
        fixed: [
          { id: 1, position: "sticky", top: 0, bottom: 37, height: 37, text: "Faixa", ctas: [] },
          { id: 5, position: "fixed", top: 832, bottom: 900, height: 68, text: "Barra", ctas: ["Quero"] },
        ],
        running: [{ kind: "css-animation", name: "pulso", duration_ms: 1200, iterations: "infinite", target: "a.btn" }],
      },
      again: { errors: [], timer_texts: [{ id: 9, text: "00:14:59" }] },
    },
    mobile: {
      top: { errors: [], viewport: { width: 390, height: 844, scroll_y: 0 }, cta_positions: [{ text: "Sim, quero", y: 400, height: 56 }], fixed: [] },
      end: { errors: [], viewport: { width: 390, height: 844, scroll_y: 2000 }, fixed: [{ id: 2, position: "fixed", top: 752, bottom: 844, height: 92, text: "Barra", ctas: ["Quero"] }] },
    },
  };
}

test("buildAnatomy assembles the documented shape from the page readings", () => {
  const { desktop, mobile } = readings();
  const anatomy = buildAnatomy({ desktop, mobile });
  assert.deepEqual(Object.keys(anatomy), ["format_version", "viewports", "sections", "ctas", "fixed", "forms", "prices", "media", "motion", "countdowns", "quality"]);
  assert.equal(anatomy.format_version, 1);
  assert.deepEqual(anatomy.viewports, { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } });
  assert.deepEqual(Object.keys(anatomy.sections[0]), ["index", "heading", "y", "height", "text", "words"]);
  assert.equal(anatomy.sections[1].text.length, SECTION_TEXT_MAX);
  assert.deepEqual(Object.keys(anatomy.ctas[0]), ["index", "kind", "text", "href", "x", "y", "width", "height", "above_fold", "in_fixed", "section", "disabled"]);
  assert.deepEqual(anatomy.ctas[0].above_fold, { desktop: true, mobile: true });
  assert.deepEqual(anatomy.ctas[1].above_fold, { desktop: false, mobile: null }, "no such call on the phone");
  assert.deepEqual(anatomy.fixed.map((f) => [f.pass, f.edge, f.appeared_after_scroll]), [["desktop", "top", false], ["desktop", "bottom", true], ["mobile", "bottom", true]]);
  assert.deepEqual(anatomy.forms[0], { type: "checkbox", label: "Incluir por R$ 9,90", checked: true, required: false, name: "adicional", price_text: "R$ 9,90", section: 1, y: 1155 });
  assert.deepEqual(anatomy.prices[0], { text: "R$ 49,99", value: 49.99, struck: true, context: "De R$ 49,99 por R$ 19,99", section: 1, y: 186 });
  assert.equal(anatomy.media.iframes[0].provider, "youtube");
  assert.deepEqual(anatomy.media.images, { count: 2, without_alt: 1 });
  assert.deepEqual(Object.keys(anatomy.motion), ["running", "keyframes", "transitions", "reduced_motion_rules", "smooth_scroll", "scroll_snap", "stylesheets_unread"]);
  assert.equal(anatomy.motion.running[0].name, "pulso");
  assert.deepEqual(anatomy.countdowns, [{ text: "00:14:59", section: 1 }]);
  assert.deepEqual(anatomyCounts(anatomy), { sections: 2, ctas: 2, fixed: 3, forms: 1, prices: 1, videos: 1, animations: 1 });
  assert.equal(anatomyCounts(null), null);
});

test("finishAnatomy: a failed reading leaves anatomy null with a warning, and texto.md still comes from what was read", () => {
  const ok = finishAnatomy({ ...readings(), rawText: "ignorado" });
  assert.ok(ok.anatomy);
  assert.deepEqual(ok.warnings, []);
  assert.match(ok.text.text, /^Topo\n\n## Leve o guia\n\nx{5000}\n$/, "texto.md keeps the whole section, captura.json the first 4,000 characters");

  const broken = readings();
  broken.desktop.top.errors.push("forms: boom");
  const failed = finishAnatomy({ ...broken, rawText: "ignorado" });
  assert.equal(failed.anatomy, null);
  assert.match(failed.warnings[0], /anatomia da página falhou \(forms: boom\)/);
  assert.match(failed.text.text, /## Leve o guia/, "the sections were read, so texto.md keeps them");

  const thrown = finishAnatomy({ failure: "O navegador não respondeu a Runtime.evaluate em 60 s.", rawText: "Texto da página inteira" });
  assert.equal(thrown.anatomy, null);
  assert.match(thrown.warnings[0], /Runtime\.evaluate/);
  assert.equal(thrown.text.text, "Texto da página inteira\n", "without sections, texto.md comes from the text of the brand reading");

  assert.equal(finishAnatomy({ desktop: readings().desktop }).anatomy, null, "half a reading is no reading");
  assert.equal(finishAnatomy({}).text, null);
});

// ---------------------------------------------------------------------------------------------
// The offer fixture through the real browser
// ---------------------------------------------------------------------------------------------

test("captureSite reads the anatomy of an offer page and writes texto.md", { skip: noBrowser, timeout: 240000 }, async () => {
  const dir = fresh("oferta");
  const capture = await captureSite({ url: OFFER, outDir: dir, tools, scrollSeconds: 0, assets: false });
  const saved = JSON.parse(readFileSync(join(dir, "captura.json"), "utf8"));
  assert.equal(saved.format_version, 1);
  assert.equal(saved.input_kind, "html");
  assert.deepEqual(saved.anatomy, capture.anatomy, "captura.json carries the anatomy");
  assert.ok(!capture.warnings.some((warning) => /anatomia/.test(warning)), capture.warnings.join("\n"));
  const a = capture.anatomy;
  assert.ok(a, "anatomy");
  assert.equal(a.format_version, 1);
  assert.deepEqual(a.viewports, { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } });

  // sections, in page order, section 0 before the first heading
  assert.deepEqual(a.sections.map((s) => s.heading?.text ?? null), OFFER_HEADINGS);
  assert.deepEqual(a.sections.map((s) => s.heading?.tag ?? null), [null, "h1", "h2", "h2", "h2"]);
  assert.deepEqual(a.sections.map((s) => s.index), [0, 1, 2, 3, 4]);
  assert.ok(a.sections.every((s, i) => i === 0 || s.y > a.sections[i - 1].y), "sections in page order");
  assert.ok(a.sections.every((s) => s.words > 0 && s.text.length <= SECTION_TEXT_MAX && s.height > 0), JSON.stringify(a.sections.map((s) => [s.words, s.height])));
  assert.match(a.sections[0].text, /Pedido confirmado/);
  assert.match(a.sections[4].text, /Recebo quando\?/);

  // calls to action: the main button first, in the first screen on both sizes; the decline link found
  const [first] = a.ctas;
  assert.equal(first.text, "Sim, quero o guia por R$ 19,99");
  assert.equal(first.kind, "link");
  assert.deepEqual(first.above_fold, { desktop: true, mobile: true });
  assert.equal(first.section, 1);
  assert.equal(first.in_fixed, false);
  assert.equal(first.disabled, false);
  assert.match(first.href, /#confirmar$/);
  const decline = a.ctas.find((c) => c.text === "Pular oferta");
  assert.ok(decline, `the decline link is a call to action: ${a.ctas.map((c) => c.text).join(" | ")}`);
  assert.equal(decline.kind, "link");
  assert.ok(a.ctas.some((c) => c.text === "Agora não" && c.kind === "link"), "a decline link with an accent, read in the page itself");
  assert.ok(a.ctas.every((c, i) => c.index === i && Number.isFinite(c.y) && typeof c.above_fold.desktop === "boolean"));

  // fixed: the strip is there from the start; the bar shows up only after the scroll, on both sizes
  const bar = a.fixed.find((f) => f.pass === "desktop" && f.appeared_after_scroll);
  assert.ok(bar, JSON.stringify(a.fixed));
  assert.equal(bar.position, "fixed");
  assert.equal(bar.edge, "bottom");
  assert.deepEqual(bar.ctas, ["Quero o guia", "Agora não"]);
  assert.ok(a.fixed.some((f) => f.pass === "mobile" && f.appeared_after_scroll && f.edge === "bottom"), "the bar shows up on the phone too");
  const strip = a.fixed.find((f) => f.pass === "desktop" && f.position === "sticky");
  assert.ok(strip && strip.edge === "top" && strip.appeared_after_scroll === false, JSON.stringify(a.fixed));

  // forms: the paid add-on comes checked
  const box = a.forms.find((f) => f.type === "checkbox");
  assert.equal(box.checked, true);
  assert.equal(box.price_text, "R$ 9,90");
  assert.equal(box.name, "adicional");
  assert.match(box.label, /Caderno de Compras/);
  assert.equal(box.section, 3);
  assert.ok(Number.isFinite(box.y), "the checkbox has its place on the page");
  assert.deepEqual(a.forms.filter((f) => f.type === "radio").map((f) => [f.label, f.checked]), [["Pix", true], ["Cartão no mesmo pedido", false]]);

  // prices: the reference price is struck, the offer price is not
  const struck = a.prices.filter((p) => p.struck);
  assert.deepEqual(struck.map((p) => [p.text, p.value]), [["R$ 49,99", 49.99]]);
  assert.match(struck[0].context, /De R\$ 49,99 por R\$ 19,99/);
  assert.ok(a.prices.some((p) => !p.struck && p.value === 19.99), "the offer price");
  assert.ok(a.prices.every((p) => Number.isFinite(p.y) && p.context.length <= 120), JSON.stringify(a.prices));
  assert.equal(a.prices.find((p) => /Sim, quero/.test(p.context))?.text, "R$ 19,99", "the button's price keeps the button's words");

  // media: the four attributes and the poster
  assert.equal(a.media.videos.length, 1);
  const video = a.media.videos[0];
  assert.deepEqual([video.autoplay, video.muted, video.loop, video.playsinline, video.controls], [true, true, true, true, false]);
  assert.match(video.poster, /capa\.png$/);
  assert.match(video.src, /video-inexistente\.mp4$/);
  assert.equal(video.section, 2);
  assert.deepEqual(a.media.iframes, []);
  assert.deepEqual(a.media.images, { count: 2, without_alt: 1 });

  // motion
  assert.deepEqual(a.motion.running.find((r) => r.name === "pulso"), { kind: "css-animation", name: "pulso", duration_ms: 1200, iterations: "infinite", target: "a.btn" });
  assert.ok(a.motion.reduced_motion_rules >= 1);
  assert.deepEqual(a.motion.keyframes, ["pulso"]);
  assert.ok(a.motion.transitions >= 1);
  assert.equal(a.motion.smooth_scroll, true);
  assert.equal(a.motion.scroll_snap, 0);
  assert.equal(a.motion.stylesheets_unread, 0);

  // countdowns: the timer changed between the two reads
  assert.equal(a.countdowns.length, 1, JSON.stringify(a.countdowns));
  assert.match(a.countdowns[0].text, /^00:1[45]:\d{2}$/);
  assert.equal(a.countdowns[0].section, 1);

  // texto.md: the whole text in order, the headings as headings
  assert.equal(capture.files.text, "texto.md");
  const text = readFileSync(join(dir, "texto.md"), "utf8");
  assert.match(text, /^Oferta disponível só nesta página\n/);
  for (const heading of OFFER_HEADINGS.slice(1)) assert.ok(text.includes(`## ${heading}\n`), heading);
  assert.match(text, /## Perguntas frequentes\n\nRecebo quando\?/, "the last section, title and text");
  assert.match(text, /Como falo com o suporte\?/);
  assert.ok(text.indexOf("## O que vem no guia") < text.indexOf("## Perguntas frequentes"), "in page order");
});

// ---------------------------------------------------------------------------------------------
// A page saved by the browser, through the command
// ---------------------------------------------------------------------------------------------

test("captureSite: a window that opens halfway down the page is read as appeared after the scroll, on both sizes", { skip: noBrowser, timeout: 240000 }, async () => {
  const dir = fresh("janela");
  const capture = await captureSite({ url: WINDOW_PAGE, outDir: dir, tools, scrollSeconds: 0, assets: false });
  const windows = capture.anatomy.fixed.filter((f) => f.edge === "other" && f.ctas.includes("Agora não"));
  assert.deepEqual(windows.map((f) => [f.pass, f.appeared_after_scroll]).sort(), [["desktop", true], ["mobile", true]], JSON.stringify(capture.anatomy.fixed));
  const header = capture.anatomy.fixed.find((f) => f.pass === "desktop" && f.edge === "top");
  assert.ok(header && header.appeared_after_scroll === false, "the header was there on arrival");
  // the header's button is hidden on the phone: it must not take the place of the page's button
  const [menuButton, pageButton] = capture.anatomy.ctas.filter((c) => c.text === "Agendar demonstração");
  assert.equal(menuButton.in_fixed, true);
  assert.deepEqual(menuButton.above_fold, { desktop: true, mobile: null });
  assert.deepEqual(pageButton.above_fold, { desktop: true, mobile: true });
  assert.ok(capture.warnings.some((w) => /Uma janela que abre com a rolagem estava aberta nas fotos/.test(w)), capture.warnings.join(" | "));
});

test("a page the browser saved as .mhtml goes through the command with input_kind mhtml and the same headings", { skip: noBrowser, timeout: 240000 }, async () => {
  const dir = fresh("oferta-mhtml");
  const mhtml = join(dir, "oferta salva.mhtml");
  const engine = await Browser.launch({ width: 1440, height: 900 });
  try {
    const page = await engine.newPage({ width: 1440, height: 900 });
    await page.goto(fileUrl(OFFER));
    const { data } = await page.send("Page.captureSnapshot", { format: "mhtml" }, 60000);
    writeFileSync(mhtml, data);
  } finally {
    await engine.close();
  }

  const out = join(dir, "captura");
  const result = await cli(["capture", mhtml, "--out", out, "--scroll", "0", "--no-assets"]);
  assert.equal(result.code, 0, result.stdout + result.stderr);
  const r = result.json;
  assert.equal(r.ok, true);
  assert.equal(r.input_kind, "mhtml");
  assert.equal(r.site, "oferta salva.mhtml");
  assert.match(r.final_url, /oferta%20salva\.mhtml$/, "the saved file, never the address the page came from");
  assert.equal(r.files.text, "texto.md");
  assert.deepEqual(Object.keys(r.anatomy_counts ?? {}), ["sections", "ctas", "fixed", "forms", "prices", "videos", "animations"], JSON.stringify(r.warnings));
  assert.equal(r.anatomy_counts.sections, OFFER_HEADINGS.length);
  assert.equal(r.anatomy, undefined, "the whole anatomy stays in captura.json");

  const saved = JSON.parse(readFileSync(join(out, "captura.json"), "utf8"));
  assert.equal(saved.input_kind, "mhtml");
  assert.deepEqual(saved.anatomy.sections.map((s) => s.heading?.text ?? null), OFFER_HEADINGS);
  assert.ok(saved.anatomy.forms.some((f) => f.checked && f.price_text === "R$ 9,90"), "the saved page keeps the add-on checked");
  assert.ok(saved.anatomy.prices.some((p) => p.struck && p.value === 49.99), "and the struck reference price");
  assert.match(readFileSync(join(out, "texto.md"), "utf8"), /## Perguntas frequentes\n/);
});
