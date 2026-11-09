// The measurements of the finished page and the filming of a scene: the pure helpers without a
// browser, then a page with defects on purpose and a scene through the real browser (skipped when
// none is installed). Outputs go to FLYEE_TEST_OUT when set, else to the system's temporary folder.
//   node --test modules/video-render/tests/quality.test.mjs

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { Browser } from "../scripts/lib/browser.mjs";
import { alphaOf, buildQuality, captureSite, compositeStack, contrastFrom, contrastRatio, imagesFrom, pageWeight } from "../scripts/lib/capture.mjs";
import { filmStats, sheetLayout } from "../scripts/lib/film.mjs";
import { findBrowser } from "../scripts/lib/tools.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/render.mjs", import.meta.url));
const QUALITY_PAGE = fileURLToPath(new URL("./fixtures/qualidade/index.html", import.meta.url));
const FILM_PAGE = fileURLToPath(new URL("./fixtures/filme/index.html", import.meta.url));
const CARDS_PAGE = fileURLToPath(new URL("./fixtures/cartoes/index.html", import.meta.url));
const OUT_ROOT = process.env.FLYEE_TEST_OUT ? resolve(process.env.FLYEE_TEST_OUT) : join(tmpdir(), "flyee-video-render-tests", "quality");
const browser = findBrowser();
const noBrowser = browser ? false : "no browser (Edge, Chrome or Chromium) on this machine";

function fresh(name) {
  const dir = join(OUT_ROOT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cli(args) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [SCRIPT, ...args, "--json"], { cwd: resolve(fileURLToPath(new URL("../../..", import.meta.url))), windowsHide: true });
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

test("alphaOf reads the transparency of the color forms a browser reports", () => {
  assert.equal(alphaOf("rgb(1, 2, 3)"), 1);
  assert.equal(alphaOf("rgba(1, 2, 3, 0.5)"), 0.5);
  assert.equal(alphaOf("rgb(1 2 3 / 25%)"), 0.25);
  assert.equal(alphaOf("oklch(0.5 0.1 200 / 0.4)"), 0.4);
  assert.equal(alphaOf("oklch(0.5 0.1 200)"), 1);
  assert.equal(alphaOf("transparent"), 0);
  assert.equal(alphaOf(null), 0);
});

test("compositeStack lays the backgrounds over each other, over the white page", () => {
  assert.deepEqual(compositeStack([]), [255, 255, 255]);
  assert.deepEqual(compositeStack(["rgb(0, 0, 0)"]), [0, 0, 0]);
  assert.deepEqual(compositeStack(["rgba(0, 0, 0, 0.5)", "rgb(255, 255, 255)"]).map(Math.round), [128, 128, 128]);
});

test("contrastRatio gives the WCAG numbers", () => {
  assert.equal(Math.round(contrastRatio([0, 0, 0], [255, 255, 255])), 21);
  assert.equal(contrastRatio([255, 255, 255], [255, 255, 255]), 1);
  // #767676 on white is the classic 4.5:1 boundary.
  assert.ok(Math.abs(contrastRatio([118, 118, 118], [255, 255, 255]) - 4.54) < 0.01);
});

test("contrastFrom judges each pair by its size and keeps apart what it cannot measure", () => {
  const sample = (over) => ({ role: "text", text: "um texto", color: "rgb(150, 150, 150)", stack: ["rgb(255, 255, 255)"], font_px: 16, bold: false, unknown: null, ...over });
  const result = contrastFrom({
    samples: [
      sample({}),
      sample({ role: "title", font_px: 40 }),
      sample({ role: "title", font_px: 40, color: "rgb(210, 210, 210)" }),
      sample({ font_px: 20, bold: true }),
      sample({ color: "rgb(0, 0, 0)" }),
      sample({ unknown: "imagem" }),
      sample({ unknown: "degrade" }),
      // Nearly invisible: most likely a background layer the reading did not see, so it is doubted, not failed.
      sample({ color: "rgb(250, 250, 250)" }),
    ],
  });
  assert.equal(result.checked, 5);
  assert.deepEqual(result.unknown, { imagem: 1, degrade: 1, camada: 1 });
  // #969696 on white is about 2.96:1: it fails even as large text, and the title comes first.
  assert.equal(result.failing.length, 4);
  assert.equal(result.failing[0].role, "title");
  assert.equal(result.failing[0].required, 3);
  const body = result.failing.find((pair) => pair.required === 4.5);
  assert.equal(body.role, "text");
  assert.equal(body.color, "#969696");
  assert.equal(body.background, "#FFFFFF");
  // 20 px in bold counts as large text, and needs 3:1.
  assert.equal(result.failing.find((pair) => pair.font_px === 20).required, 3);
  assert.equal(contrastFrom(null), null);
});

test("pageWeight and imagesFrom name the heavy images and those served far larger than they appear", () => {
  const resources = new Map([
    [1, { url: "https://a/grande.png", type: "Image", bytes: 900 * 1024 }],
    [2, { url: "https://a/certa.png", type: "Image", bytes: 40 * 1024 }],
    [3, { url: "https://a/app.js", type: "Script", bytes: 100 }],
  ]);
  const weight = pageWeight(resources);
  assert.equal(weight.total_bytes, 940 * 1024 + 100);
  assert.equal(weight.by_type.Script, 100);
  const images = imagesFrom({ scale: 2, list: [
    { src: "https://a/grande.png", natural_width: 3000, shown_width: 300 },
    { src: "https://a/certa.png", natural_width: 3000, shown_width: 300 },
    { src: "https://a/justa.png", natural_width: 600, shown_width: 300 },
  ] }, weight);
  assert.equal(images.count, 3);
  assert.deepEqual(images.heavy.map((image) => image.src), ["https://a/grande.png"]);
  // certa.png is large on screen terms and light in bytes: only what weighs enough counts as oversized.
  assert.deepEqual(images.oversized.map((image) => image.src), ["https://a/grande.png"]);
  assert.equal(images.oversized[0].oversize, 5);
  assert.equal(imagesFrom(null, weight), null);
});

test("a measurement that did not run stays null, never a clean page", () => {
  const quality = buildQuality();
  assert.deepEqual(quality, { desktop: null, mobile: null });
  const partial = buildQuality({ mobile: { small_text: { total_chars: 100, small_chars: 40 }, errors: ["x"] } });
  assert.equal(partial.mobile.small_text.share, 0.4);
  assert.equal(partial.mobile.overflow, null);
  assert.deepEqual(partial.mobile.errors, ["x"]);
  const desktop = buildQuality({ desktop: { errors: [], cards: [{ text: "a" }] } }).desktop;
  assert.deepEqual(desktop.cards, [{ text: "a" }]);
  assert.equal(desktop.figures, null);
});

test("filmStats counts the changes, the longest still and the return to the first frame", () => {
  const frames = (hashes) => hashes.map((hash, index) => ({ hash, t: index }));
  assert.deepEqual(filmStats(frames(["a", "b", "c", "a", "b"]), 1), { changes: 4, distinct: 3, longest_still_s: 0, returns_to_first_at_s: 3 });
  assert.deepEqual(filmStats(frames(["a", "a", "a"]), 1), { changes: 0, distinct: 1, longest_still_s: 2, returns_to_first_at_s: null });
  assert.deepEqual(filmStats(frames(["a", "b", "b", "b", "c"]), 0.5), { changes: 2, distinct: 3, longest_still_s: 1, returns_to_first_at_s: null });
  assert.deepEqual(filmStats([], 1), { changes: 0, distinct: 0, longest_still_s: 0, returns_to_first_at_s: null });
});

test("sheetLayout fits the frames across the sheet at a readable size", () => {
  assert.deepEqual(sheetLayout(1440, 16), { cell: 540, cols: 3 });
  assert.deepEqual(sheetLayout(358, 16), { cell: 358, cols: 4 });
  assert.deepEqual(sheetLayout(358, 3), { cell: 358, cols: 3 });
  assert.deepEqual(sheetLayout(200, 1), { cell: 200, cols: 1 });
});

// ---------------------------------------------------------------------------------------------
// Through the real browser
// ---------------------------------------------------------------------------------------------

test("a system set to reduce motion does not change what a page shows, unless asked", { skip: noBrowser }, async () => {
  const instance = await Browser.launch({ path: browser?.path, width: 800, height: 600, extraFlags: ["--force-prefers-reduced-motion"] });
  try {
    const page = await instance.newPage({ width: 800, height: 600 });
    const asks = () => page.evaluate('window.matchMedia("(prefers-reduced-motion: reduce)").matches', { awaitPromise: false });
    await page.goto("about:blank");
    assert.equal(await asks(), false);
    await page.setReducedMotion(true);
    assert.equal(await asks(), true);
    await page.setReducedMotion(false);
    assert.equal(await asks(), false);
    // Without the emulation this browser answers reduce, which is what a Windows Server does.
    await page.send("Emulation.setEmulatedMedia", { features: [] });
    assert.equal(await asks(), true);
  } finally {
    await instance.close();
  }
});

test("captureSite measures a page with defects on purpose", { skip: noBrowser }, async () => {
  const capture = await captureSite({ url: QUALITY_PAGE, outDir: fresh("qualidade"), scrollSeconds: 0, assets: false });
  const { desktop, mobile } = capture.anatomy.quality;

  // The width of the phone
  assert.ok(mobile.overflow.scroll_width > 390, `scroll_width ${mobile.overflow.scroll_width}`);
  assert.ok(mobile.overflow.cut >= 1);
  assert.match(mobile.overflow.offenders[0].text, /700 pixels/);

  // Small text: the footer is most of the page, and the price in 10 px is named.
  assert.ok(mobile.small_text.share >= 0.4, `share ${mobile.small_text.share}`);
  assert.equal(mobile.small_text.min_px, 10);
  assert.ok(mobile.small_text.key.some((entry) => /19,90/.test(entry.text)));

  // Three small links side by side crowd each other; the link inside a sentence is not a target to measure.
  assert.equal(mobile.tap_targets.undersized, 3);
  assert.ok(!mobile.tap_targets.samples.some((sample) => /ajuda/.test(sample.text)));

  // The button that cuts its text, on both passes
  assert.ok(mobile.controls.problems.some((problem) => problem.reason === "cortado" && /Quero contratar/.test(problem.text)));
  assert.ok(desktop.controls.problems.some((problem) => problem.reason === "cortado"));

  // The image served far larger than it appears; a drawing in vector weighs the same at any size.
  assert.equal(mobile.images.count, 2);
  assert.equal(mobile.images.oversized.length, 1);
  assert.equal(mobile.images.oversized[0].natural_width, 1200);
  assert.ok(mobile.weight.total_bytes > 0);

  // Contrast: the pale text and the pale button fail, the dark block passes, the gradient stays unmeasured.
  const failing = desktop.contrast.failing.map((pair) => pair.text);
  assert.ok(failing.some((text) => /cinza muito claro/.test(text)), failing.join(" | "));
  assert.ok(failing.some((text) => /Ver os planos/.test(text)), failing.join(" | "));
  assert.ok(!failing.some((text) => /desligado|enfeite/.test(text)), "a disabled button and decoration are left out");
  assert.ok(!failing.some((text) => /fundo escuro/.test(text)), failing.join(" | "));
  assert.ok(!failing.some((text) => /degradê/.test(text)), failing.join(" | "));
  assert.ok((desktop.contrast.unknown.imagem ?? 0) >= 1);
  assert.ok((desktop.contrast.unknown.degrade ?? 0) >= 1);

  // The scene
  assert.equal(desktop.demos.length, 1);
  assert.equal(desktop.demos[0].name, "topo");
  assert.equal(desktop.demos[0].headings, 1);
  assert.equal(desktop.demos[0].has_name, false);
  assert.equal(desktop.demos[0].label_near, false);

  // The defaults
  const { counts, found } = desktop.defaults;
  assert.ok(counts.gradient_text >= 1);
  assert.ok(counts.glass >= 1);
  assert.ok(counts.glow >= 1);
  assert.ok(counts.blobs >= 1);
  assert.equal(counts.equal_cards, 1);
  assert.match(found.equal_cards[0], /O que dá para fazer/);
  assert.equal(counts.status_dots, 1);
  assert.equal(desktop.defaults.mono_share, 0);
});

test("captureSite reads the cards and the figures, and photographs the page with no letters", { skip: noBrowser }, async () => {
  const out = fresh("cartoes");
  const capture = await captureSite({ url: CARDS_PAGE, outDir: out, scrollSeconds: 0, assets: false, noLetters: true });
  const { cards, figures, contrast, defaults } = capture.anatomy.quality.desktop;
  const card = (text) => cards.find((entry) => entry.text.startsWith(text));

  // A long card asks to be read; each kind that is meant to be read says so; text for screen readers does not count.
  assert.equal(card("Um cartão longo").kind, "card");
  assert.ok(card("Um cartão longo").read_words >= 40, `read_words ${card("Um cartão longo").read_words}`);
  assert.equal(card("Um depoimento").kind, "quote");
  assert.equal(card("Plano Essencial").kind, "priced");
  assert.equal(card("Um cartão curto").read_words, 0);
  assert.ok(card("Um cartão curto").words <= 10, `words ${card("Um cartão curto").words}`);

  // The hole between the text at the top and the icon at the bottom
  assert.ok(card("Um cartão com buraco").hole >= 0.5, `hole ${card("Um cartão com buraco").hole}`);
  assert.ok(card("Um cartão curto").hole < 0.3, `hole ${card("Um cartão curto").hole}`);

  // A figure with a sentence and a figure made of short labels and a picture
  const figure = (name) => figures.find((entry) => entry.name === name);
  assert.equal(figures.length, 3);
  assert.equal(figure("conversa").mark, "figura");
  assert.ok(figure("conversa").longest >= 20, `longest ${figure("conversa").longest}`);
  assert.equal(figure("calendario").read_words, 0);
  assert.ok(figure("calendario").picture_share >= 0.3, `share ${figure("calendario").picture_share}`);
  assert.equal(figure("topo").mark, "demo");

  // The sheets are there, and the readings after them saw the page as it was.
  assert.equal(capture.files.no_letters_desktop, "sem-letras.jpg");
  assert.equal(capture.files.no_letters_mobile, "sem-letras-celular.jpg");
  assert.ok(existsSync(join(out, "sem-letras.jpg")));
  assert.ok(existsSync(join(out, "sem-letras-celular.jpg")));
  assert.equal(defaults.counts.gradient_text, 1);
  assert.ok((contrast.unknown.degrade ?? 0) >= 1, JSON.stringify(contrast.unknown));

  // Where the black text was, the sheet is white; the same area of the plain photo is not.
  const instance = await Browser.launch({ path: browser?.path, width: 800, height: 600 });
  try {
    const page = await instance.newPage({ width: 800, height: 600 });
    await page.goto("about:blank");
    const darkShare = async (file, area) => {
      const src = `data:image/${file.endsWith("png") ? "png" : "jpeg"};base64,${readFileSync(join(out, file)).toString("base64")}`;
      return page.evaluate(`new Promise((done, fail) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const paint = canvas.getContext("2d");
          paint.drawImage(img, 0, 0);
          const a = ${JSON.stringify(area)};
          const data = paint.getImageData(a.x, a.y, a.width, a.height).data;
          let dark = 0;
          for (let i = 0; i < data.length; i += 4) if (data[i] < 90 && data[i + 1] < 90 && data[i + 2] < 90) dark++;
          done(dark / (data.length / 4));
        };
        img.onerror = () => fail(new Error("the image did not open"));
        img.src = ${JSON.stringify(src)};
      })`, { timeoutMs: 30000 });
    };
    // The first band of the sheet starts after its title, shown at 540/1440 of its size; the stamp sits in its top corner.
    const noLetters = await darkShare("sem-letras.jpg", { x: 120, y: 60, width: 400, height: 60 });
    const plain = await darkShare("desktop.png", { x: 24, y: 40, width: 1000, height: 170 });
    assert.ok(plain > 0.03, `plain ${plain}`);
    assert.ok(noLetters < 0.002, `no letters ${noLetters}`);
  } finally {
    await instance.close();
  }
});

test("a capture does not photograph the page with no letters unless asked", { skip: noBrowser }, async () => {
  const capture = await captureSite({ url: CARDS_PAGE, outDir: fresh("cartoes-sem-pedido"), scrollSeconds: 0, assets: false });
  assert.equal(capture.files.no_letters_desktop, null);
  assert.equal(capture.files.no_letters_mobile, null);
});

test("the anatomy survives a measurement that fails", () => {
  const quality = buildQuality({ desktop: { errors: ["contrast: quebrou"], contrast: null }, mobile: null });
  assert.equal(quality.desktop.contrast, null);
  assert.deepEqual(quality.desktop.errors, ["contrast: quebrou"]);
});

test("film films a scene on desktop, on a phone and with less motion", { skip: noBrowser }, async () => {
  const out = fresh("filme");
  const { json, code, stdout, stderr } = await cli(["film", FILM_PAGE, "--select", "[data-demo]", "--every", "0.5", "--count", "6", "--out", out]);
  assert.equal(code, 0, `${stdout}\n${stderr}`);
  assert.equal(json.ok, true);
  assert.equal(json.mode, "real_time");
  const { desktop, mobile, reduced } = json.passes;
  assert.equal(desktop.frames, 6);
  assert.equal(mobile.frames, 6);
  assert.equal(reduced.frames, 3);
  // The scene moves for whoever did not ask for less motion, and stands still for whoever did.
  assert.ok(desktop.changes >= 3, `desktop changes ${desktop.changes}`);
  assert.ok(mobile.changes >= 3, `mobile changes ${mobile.changes}`);
  assert.equal(reduced.changes, 0);
  assert.equal(reduced.distinct, 1);
  for (const pass of [desktop, mobile, reduced]) {
    assert.ok(existsSync(join(out, pass.sheet)), pass.sheet);
    assert.ok(existsSync(join(out, pass.files[0])), pass.files[0]);
    assert.ok(readFileSync(join(out, pass.sheet)).length > 1000);
  }
  // Photographed where it is, at its own size: 520 px on desktop, the column's width on the phone.
  assert.equal(desktop.size.width, 520);
  assert.equal(mobile.size.width, 342);
  const saved = JSON.parse(readFileSync(join(out, "filme.json"), "utf8"));
  assert.equal(saved.select, "[data-demo]");
  assert.deepEqual(saved.sheets, ["desktop.jpg", "mobile.jpg", "reduced.jpg"]);
});

test("film says when the scene is not on the page, and when a part is only on one size", { skip: noBrowser }, async () => {
  const missing = await cli(["film", FILM_PAGE, "--select", "[data-nada]", "--count", "1", "--out", fresh("sem-cena")]);
  assert.equal(missing.code, 1);
  assert.equal(missing.json.error.code, "film_target_missing");
  const partial = await cli(["film", FILM_PAGE, "--select", "#so-computador", "--every", "0.25", "--count", "2", "--out", fresh("so-computador")]);
  assert.equal(partial.code, 0, partial.stdout);
  assert.equal(partial.json.passes.desktop.visible, true);
  assert.equal(partial.json.passes.mobile.visible, false);
  assert.ok(partial.json.warnings.some((warning) => /não aparece no celular/.test(warning)));
});

test("film refuses a saved page, which runs no script", async () => {
  const dir = fresh("salva");
  const saved = join(dir, "pagina.mhtml");
  writeFileSync(saved, "MIME-Version: 1.0\n");
  const { code, json } = await cli(["film", saved, "--out", join(dir, "saida")]);
  assert.equal(code, 1);
  assert.equal(json.error.code, "film_saved_page");
});
