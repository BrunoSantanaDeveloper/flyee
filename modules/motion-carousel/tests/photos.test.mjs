// Photo slides (version 1.1): the image helpers of carousel.js without a browser (a fake canvas in a
// vm), then the photo template and the photo example through the real engine (skipped when ffmpeg
// or a browser is missing).
//   node --test modules/motion-carousel/tests/photos.test.mjs

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const APP_DIR = resolve(fileURLToPath(new URL("..", import.meta.url)));
const REPO = resolve(APP_DIR, "..", "..");
const RENDER_APP = join(REPO, "modules", "video-render");
const RENDER = join(RENDER_APP, "scripts", "render.mjs");
const MOTION = join(RENDER_APP, "runtime", "motion.js");
const CAROUSEL = join(APP_DIR, "runtime", "carousel.js");
const PHOTO_TEMPLATE = join(APP_DIR, "runtime", "slides", "photo.html");
const PHOTO_EXAMPLE = join(APP_DIR, "references", "exemplo-foto");

const { checkTools, findBrowser } = await import(pathToFileURL(join(RENDER_APP, "scripts", "lib", "tools.mjs")).href);
const { copyTree } = await import(pathToFileURL(join(APP_DIR, "scripts", "lib", "project.mjs")).href);
const tools = await checkTools();
const canRender = Boolean(tools.ffmpeg && tools.ffprobe && findBrowser());
const SKIP = "sem ffmpeg ou navegador nesta máquina";

// ---------------------------------------------------------------------------------------------
// A fake canvas that records the images drawn
// ---------------------------------------------------------------------------------------------

function fakeContext() {
  const g = {
    font: "", letterSpacing: "0px", textAlign: "left", textBaseline: "top", fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
    globalCompositeOperation: "source-over", shadowColor: "", shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, lineCap: "butt", lineJoin: "miter",
    drawn: [],
    fills: 0,
    measureText(text) {
      const m = /(\d+)px/.exec(this.font);
      const size = m ? Number(m[1]) : 16;
      return { width: text.length * size * 0.55 };
    },
    createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData() {},
    createPattern() { return {}; },
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
    drawImage(image, x, y, w, h) { this.drawn.push({ image, x, y, w, h, alpha: this.globalAlpha }); },
    fillRect() { this.fills++; },
  };
  for (const name of ["save", "restore", "fillText", "beginPath", "rect", "clip", "translate", "scale", "rotate", "moveTo", "lineTo", "arcTo", "arc", "closePath", "fill", "stroke", "setTransform"]) g[name] = () => {};
  return g;
}

function fakeCanvas() {
  const g = fakeContext();
  return { width: 0, height: 0, getContext: () => g };
}

/** motion.js + carousel.js inside a vm; `Image` loads by the name of the file ("broken" fails). */
function loadRuntime() {
  const window = { navigator: { webdriver: true }, __FLYEE_RENDER__: true, warnings: [] };
  window.window = window;
  window.console = { warn: (text) => window.warnings.push(String(text)), error() {}, log() {} };
  window.document = { getElementById: () => null, querySelector: () => null, createElement: () => fakeCanvas(), body: { appendChild() {} } };
  window.Image = class {
    constructor() {
      this.naturalWidth = 0;
      this.naturalHeight = 0;
    }
    set src(value) {
      this._src = value;
      queueMicrotask(() => {
        if (/broken/.test(value)) this.onerror?.();
        else {
          this.naturalWidth = /retrato/.test(value) ? 800 : 1600;
          this.naturalHeight = /retrato/.test(value) ? 1000 : 900;
          this.onload?.();
        }
      });
    }
    get src() { return this._src; }
    decode() { return Promise.resolve(); }
  };
  vm.createContext(window);
  vm.runInContext(readFileSync(MOTION, "utf8"), window, { filename: "motion.js" });
  vm.runInContext(readFileSync(CAROUSEL, "utf8"), window, { filename: "carousel.js" });
  return window;
}

function setupPhoto(window) {
  const canvas = fakeCanvas();
  const C = window.Carousel.setup({ bars: 3, bpm: 120, fps: 30, format: "4:5", theme: "noir", seed: 3, canvas });
  return { C, g: canvas.getContext() };
}

const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// ---------------------------------------------------------------------------------------------
// The helpers
// ---------------------------------------------------------------------------------------------

test("the runtime exports the photo helpers and reports version 2", () => {
  const window = loadRuntime();
  const { C } = setupPhoto(window);
  assert.equal(window.Carousel.version, 2);
  for (const name of ["loadImages", "image", "layers", "scrim"]) assert.equal(typeof C[name], "function", name);
  const source = readFileSync(CAROUSEL, "utf8");
  assert.doesNotMatch(source, /Math\.random\s*\(/, "nenhuma chamada a Math.random");
  assert.doesNotMatch(source, /\b(setTimeout|setInterval)\s*\(/, "nenhum timer");
});

test("loadImages resolves with every alias, a broken file becomes null with a warning, and the slide still draws", async () => {
  const window = loadRuntime();
  const { C, g } = setupPhoto(window);
  const images = await C.loadImages({ fundo: "../assets/fundo.jpg", assunto: "../assets/broken.png" });
  assert.equal(images.fundo.naturalWidth, 1600);
  assert.equal(images.assunto, null);
  assert.ok(window.warnings.some((text) => /assunto/.test(text) && /broken\.png/.test(text)));
  C.begin(0);
  const missing = C.image("assunto", { x: 0.5, y: 0.4, w: 0.4, h: 0.4, fit: "contain" });
  assert.equal(missing.loaded, false);
  assert.equal(g.drawn.length, 0, "nothing is drawn for a missing picture");
  const unknown = C.image("nunca-carregada", { x: 0.5, y: 0.4, w: 0.4, h: 0.4 });
  assert.equal(unknown.loaded, false);
});

test("cover fills the frame and its edge never shows while it drifts; contain sits at its anchor", async () => {
  const window = loadRuntime();
  const { C, g } = setupPhoto(window);
  await C.loadImages({ fundo: "fundo.jpg", objeto: "retrato.png" });
  for (const t of [0, 1.5, 3, 4.5, 5.9]) {
    g.drawn.length = 0;
    C.begin(t);
    C.image("fundo", { depth: 1 });
    const d = g.drawn[0];
    assert.ok(d.x <= 0.001 && d.y <= 0.001, `t=${t}: começa fora do quadro (${d.x}, ${d.y})`);
    assert.ok(d.x + d.w >= C.W - 0.001 && d.y + d.h >= C.H - 0.001, `t=${t}: cobre até a borda`);
  }
  g.drawn.length = 0;
  C.begin(0);
  const box = C.image("objeto", { x: 100, y: 200, w: 600, h: 600, fit: "contain", anchor: "bottom-right" });
  const d = g.drawn[0];
  assert.ok(close(d.w, 480) && close(d.h, 600), `contém sem cortar: ${d.w}×${d.h}`);
  assert.ok(close(d.x + d.w, 700) && close(d.y + d.h, 800), "encosta no canto de baixo à direita");
  assert.ok(close(box.x, 220) && close(box.w, 480), "devolve a caixa desenhada");
});

test("parallax is a closed loop: the same drawing at t = 0 and at the end, a different one in the middle", async () => {
  const window = loadRuntime();
  const { C, g } = setupPhoto(window);
  await C.loadImages({ fundo: "fundo.jpg" });
  const at = (t) => {
    g.drawn.length = 0;
    C.begin(t);
    C.image("fundo", { depth: 0.8 });
    return g.drawn[0];
  };
  const first = at(0);
  const last = at(C.T);
  const middle = at(C.T / 2);
  for (const key of ["x", "y", "w", "h"]) assert.ok(close(first[key], last[key], 1e-6), `${key}: ${first[key]} e ${last[key]}`);
  assert.ok(Math.abs(middle.x - first.x) + Math.abs(middle.w - first.w) > 1, "no meio do slide a imagem andou");
  const still = (t) => {
    g.drawn.length = 0;
    C.begin(t);
    C.image("fundo", { depth: 0 });
    return g.drawn[0];
  };
  assert.deepEqual({ ...still(0) }, { ...still(C.T / 2) }, "depth 0 não mexe");
});

test("images follow the time rules: at > 0 enters, out/back leave and return, and only a role registers a box", async () => {
  const window = loadRuntime();
  const { C, g } = setupPhoto(window);
  await C.loadImages({ objeto: "retrato.png", logo: "logo.png" });
  const drawnAt = (t, options) => {
    g.drawn.length = 0;
    C.begin(t);
    C.image("objeto", options);
    return g.drawn.length;
  };
  assert.equal(drawnAt(0, { x: 0.5, y: 0.5, w: 0.3, h: 0.3, fit: "contain", at: 2 }), 0, "antes de at não aparece");
  assert.equal(drawnAt(1.25, { x: 0.5, y: 0.5, w: 0.3, h: 0.3, fit: "contain", at: 2 }), 1, "entra em at");
  assert.equal(drawnAt(2, { x: 0.5, y: 0.5, w: 0.3, h: 0.3, fit: "contain", out: 2, back: 6 }), 0, "fora entre out e back");
  assert.equal(drawnAt(0, { x: 0.5, y: 0.5, w: 0.3, h: 0.3, fit: "contain", out: 2, back: 6 }), 1, "assentado no quadro 0");
  C.begin(0);
  C.image("objeto", { x: 0.5, y: 0.5, w: 0.3, h: 0.3, fit: "contain" });
  assert.equal(C.boxes().length, 0, "sem role, a imagem não entra na conferência");
  C.begin(0);
  C.image("logo", { x: 72, y: 96, w: 220, h: 80, fit: "contain", anchor: "left", role: "logo" });
  const boxes = C.boxes();
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0].role, "logo");
});

test("layers stack from far to near with growing depth, and scrim paints without registering anything", async () => {
  const window = loadRuntime();
  const { C, g } = setupPhoto(window);
  await C.loadImages({ fundo: "fundo.jpg", objeto: "retrato.png" });
  C.begin(C.T / 2);
  const boxes = C.layers([{ src: "fundo" }, { src: "objeto", x: 0.5, y: 0.4, w: 0.4, h: 0.5, fit: "contain" }]);
  assert.equal(boxes.length, 2);
  assert.equal(g.drawn.length, 2);
  const fills = g.fills;
  for (const side of ["top", "bottom", "left", "right", "full"]) C.scrim({ side, size: 0.5, alpha: 0.8 });
  assert.ok(g.fills >= fills + 5);
  assert.equal(C.boxes().length, 0);
});

// ---------------------------------------------------------------------------------------------
// Through the real engine
// ---------------------------------------------------------------------------------------------

function engine(args, cwd) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [RENDER, ...args, "--json"], { cwd, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => {
      let json = null;
      try {
        json = JSON.parse(stdout);
      } catch {
        // the assertions show the output
      }
      done({ code, json, stdout, stderr });
    });
  });
}

function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), "flyee-carousel-photos-"));
  t.after(() => {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch {
      // the system cleans its temporary folder
    }
  });
  return dir;
}

/** A carousel folder as `new` makes it: motion.js and carousel.js next to slides/ and assets/. */
function carouselFolder(t, { withAssets = true } = {}) {
  const dir = scratch(t);
  mkdirSync(join(dir, "slides"), { recursive: true });
  copyFileSync(MOTION, join(dir, "motion.js"));
  copyFileSync(CAROUSEL, join(dir, "carousel.js"));
  copyTree(join(PHOTO_EXAMPLE, "slides"), join(dir, "slides"));
  if (withAssets) copyTree(join(PHOTO_EXAMPLE, "assets"), join(dir, "assets"));
  return dir;
}

test("the photo example passes the carousel checks: readable cover, safe area, seamless loop", { timeout: 240000 }, async (t) => {
  if (!canRender) {
    t.skip(SKIP);
    return;
  }
  assert.ok(existsSync(join(PHOTO_EXAMPLE, "assets", "fundo.jpg")) && existsSync(join(PHOTO_EXAMPLE, "assets", "halter.webp")), "o exemplo traz as duas imagens");
  const dir = carouselFolder(t);
  for (const slide of ["01.html", "02.html", "03.html"]) {
    const result = await engine(["accept", join(dir, "slides", slide), "--format", "4:5", "--safe", "instagram-carousel", "--loop", "--bpm", "120", "--min-text", "44"], dir);
    assert.equal(result.code, 0, result.stdout + result.stderr);
    const status = Object.fromEntries(result.json.checks.map((check) => [check.name, check.status]));
    for (const name of ["page", "first_frame_readable", "safe_area", "loop_seamless"]) assert.equal(status[name], "pass", `${slide} ${name}: ${JSON.stringify(result.json.checks.find((check) => check.name === name))}`);
    assert.ok(!result.json.warnings.some((warning) => /não consegui carregar a imagem/.test(warning)), `${slide}: ${result.json.warnings.join(" | ")}`);
  }
});

test("the photo template renders with its pictures and still renders when they are missing", { timeout: 240000 }, async (t) => {
  if (!canRender) {
    t.skip(SKIP);
    return;
  }
  const html = readFileSync(PHOTO_TEMPLATE, "utf8")
    .replaceAll("__N__", "2").replaceAll("__TOTAL__", "3").replaceAll("__BARS__", "3").replaceAll("__BEATS_PER_BAR__", "4").replaceAll("__BPM__", "120").replaceAll("__SEED__", "5")
    .replaceAll("__TOTAL_BARS__", "10").replaceAll("__OFFSET_BARS__", "3").replaceAll("__TITLE__", "Uma ideia só").replaceAll("__TEXT__", "Linha um.\\nLinha dois.")
    .replaceAll("__THEME__", '"noir"').replaceAll("__FORMAT__", "4:5");
  assert.doesNotMatch(html, /__[A-Z_]+__/, "every placeholder is filled");
  for (const withAssets of [true, false]) {
    const dir = carouselFolder(t, { withAssets });
    const page = join(dir, "slides", "foto.html");
    writeFileSync(page, withAssets ? html.replace("../assets/assunto.png", "../assets/halter.webp") : html);
    const result = await engine(["frames", page, "--times", "0,3,5.9", "--format", "4:5", "--scale", "0.25", "--out", join(dir, "quadros")], dir);
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.equal(result.json.frames.length, 3);
    const missingWarned = result.json.warnings.some((warning) => /não consegui carregar a imagem/.test(warning));
    if (withAssets) assert.ok(!missingWarned, result.json.warnings.join(" | "));
  }
});
