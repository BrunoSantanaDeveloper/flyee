// The video pages of the Estúdio de vídeo: the four templates and runtime/studio.js.
// Without a browser: the structure of every template, the fixture roteiros against references/roteiros.json,
// studio.js's pure helpers in a vm, and every template drawing every fixture on a fake canvas (any instant,
// deterministic, a readable cover, text inside the safe area, in 9:16 and in the other formats).
// With a browser and ffmpeg (skipped otherwise): each template through the real Motor — accept passes and two
// renders of the same second give the same frames_hash. Outputs go to FLYEE_TEST_OUT when set, else to the
// system's temporary folder.
//   node --test modules/video-studio/tests/templates.test.mjs

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { deflateSync } from "node:zlib";

const APP_DIR = resolve(fileURLToPath(new URL("..", import.meta.url)));
const REPO = resolve(APP_DIR, "..", "..");
const RENDER = join(REPO, "modules", "video-render", "scripts", "render.mjs");
const MOTION = join(REPO, "modules", "video-render", "runtime", "motion.js");
const STUDIO = join(APP_DIR, "runtime", "studio.js");
const TEMPLATE_DIR = join(APP_DIR, "runtime", "templates");
const FIXTURES = join(APP_DIR, "tests", "fixtures", "roteiros");
const SPECS = JSON.parse(readFileSync(join(APP_DIR, "references", "roteiros.json"), "utf8"));
const TEMPLATES = ["lancamento", "interface", "oferta", "lista"];
const STYLE_IDS = ["interface-narra", "interface-que-se-transforma", "limpo", "tipografia-cinetica", "vitrine"];
const EVENT_TYPES = ["impact", "kick", "thump", "whoosh", "swish", "riser", "click", "tick", "pop", "ding", "shutter", "pluck", "blip"];
const OUT_ROOT = process.env.FLYEE_TEST_OUT ? resolve(process.env.FLYEE_TEST_OUT) : join(tmpdir(), "flyee-video-studio-templates");
const FPS = 30;
const SAFE_9x16 = { x: 70, y: 250, w: 830, h: 1170 };

const fixtures = readdirSync(FIXTURES)
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) => ({ name: file.slice(0, -5), roteiro: JSON.parse(readFileSync(join(FIXTURES, file), "utf8")) }));

/** Objects from the vm realm have other prototypes; a JSON round trip makes them comparable. */
const plain = (value) => JSON.parse(JSON.stringify(value));
const words = (text) => String(text ?? "").trim().split(/\s+/).filter(Boolean).length;
const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// ---------------------------------------------------------------------------------------------
// The roteiro against the template specs (the rules of references/roteiros.json)
// ---------------------------------------------------------------------------------------------

function validateFixture(roteiro) {
  const errors = [];
  const spec = SPECS.templates[roteiro.template];
  if (!spec) return [`template desconhecido: ${roteiro.template}`];
  if (!STYLE_IDS.includes(roteiro.style)) errors.push(`estilo desconhecido: ${roteiro.style}`);
  if (!(roteiro.bpm >= 100 && roteiro.bpm <= 140)) errors.push(`bpm fora de 100–140: ${roteiro.bpm}`);
  const per = roteiro.beats_per_bar ?? 4;
  const scenes = roteiro.scenes ?? [];
  let i = 0;
  for (const scene of spec.scenes) {
    const [min, max] = scene.repeat ?? (scene.optional ? [0, 1] : [1, 1]);
    let count = 0;
    while (i < scenes.length && scenes[i].role === scene.role) {
      const s = scenes[i];
      const where = `cena ${i + 1} (${s.role})`;
      const [lo, hi] = scene.bars;
      if (!(s.bars >= lo && s.bars <= hi) || Math.abs(s.bars * 4 - Math.round(s.bars * 4)) > 1e-9) errors.push(`${where}: bars ${s.bars} fora de [${lo}, ${hi}]`);
      for (const slot of scene.slots) {
        const name = slot.replace(/\?$/, "");
        const required = !slot.endsWith("?");
        const value = s[name];
        const absent = value === undefined || value === null || (typeof value === "string" && !value.trim());
        if (required && absent) errors.push(`${where}: falta ${name}`);
      }
      if (s.role === "estado" && !spec.kinds.includes(s.kind)) errors.push(`${where}: kind ${s.kind}`);
      const limit = SPECS.limits[s.role] ?? {};
      if (limit.text_words && words(s.text) > limit.text_words) errors.push(`${where}: texto com ${words(s.text)} palavras (limite ${limit.text_words})`);
      if (limit.detail_words && words(s.detail) > limit.detail_words) errors.push(`${where}: detalhe com ${words(s.detail)} palavras (limite ${limit.detail_words})`);
      for (const event of s.events ?? []) {
        if (!EVENT_TYPES.includes(event.type)) errors.push(`${where}: evento ${event.type}`);
        if (!(event.beat >= 0 && event.beat < s.bars * per)) errors.push(`${where}: evento na batida ${event.beat}`);
      }
      count++;
      i++;
    }
    if (count < min || count > max) errors.push(`${scene.role}: ${count} cena(s), esperado de ${min} a ${max}`);
  }
  if (i < scenes.length) errors.push(`cena ${i + 1} (${scenes[i].role}) fora da ordem do roteiro`);
  const bars = scenes.reduce((sum, s) => sum + s.bars, 0);
  if (!close(bars, roteiro.bars)) errors.push(`a soma dos compassos (${bars}) difere de bars (${roteiro.bars})`);
  const duration = (roteiro.bars * per * 60) / roteiro.bpm;
  if (!close(duration, roteiro.duration, 0.01)) errors.push(`duration ${roteiro.duration} difere de ${duration}`);
  if (duration < 6 - 0.01 || duration > 20 + 0.01) errors.push(`duração ${duration} fora de 6–20 s`);
  return errors;
}

// ---------------------------------------------------------------------------------------------
// A fake 2D canvas: enough for the runtime to lay text out, draw and declare its boxes
// ---------------------------------------------------------------------------------------------

function fakeContext() {
  const sizeOf = (font) => {
    const m = /(\d+(?:\.\d+)?)px/.exec(font);
    return m ? Number(m[1]) : 16;
  };
  const g = {
    font: "10px sans-serif", letterSpacing: "0px", textAlign: "left", textBaseline: "alphabetic", fillStyle: "#000", strokeStyle: "#000",
    lineWidth: 1, lineCap: "butt", lineJoin: "miter", globalAlpha: 1, globalCompositeOperation: "source-over", imageSmoothingEnabled: true,
    imageSmoothingQuality: "low", shadowColor: "rgba(0,0,0,0)", shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, filter: "none",
    measureText(text) {
      const size = sizeOf(this.font);
      const value = String(text);
      let width = 0;
      for (const ch of value) width += ch === " " ? 0.28 : /[A-ZÁÀÂÃÉÊÍÓÔÕÚÇMW0-9]/.test(ch) ? 0.66 : 0.54;
      const accent = /[ÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(value);
      const tall = /[A-ZÁÀÂÃÉÊÍÓÔÕÚÇbdfhklt0-9]/.test(value);
      return {
        width: width * size,
        actualBoundingBoxAscent: (accent ? 0.94 : tall ? 0.72 : 0.52) * size,
        actualBoundingBoxDescent: (/[gjpqyç,;]/.test(value) ? 0.21 : 0) * size,
      };
    },
    arcTo(x1, y1, x2, y2, r) {
      if (r < 0) throw new Error(`IndexSizeError: radius ${r}`);
    },
    arc(x, y, r) {
      if (r < 0) throw new Error(`IndexSizeError: radius ${r}`);
    },
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  };
  for (const name of ["save", "restore", "fillRect", "strokeRect", "clearRect", "strokeText", "beginPath", "rect", "clip", "translate", "scale", "rotate", "moveTo", "lineTo", "quadraticCurveTo", "bezierCurveTo", "closePath", "fill", "stroke", "setTransform", "drawImage"]) {
    g[name] = () => {};
  }
  g.written = [];
  g.fillText = (text, x, y) => g.written.push([String(text), g.font, g.letterSpacing, Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
  return g;
}

function fakeCanvas(width = 1080, height = 1920) {
  const g = fakeContext();
  return { width, height, getContext: () => g };
}

/** motion.js + studio.js inside a vm, as the render flag loads them (no live preview). */
function runtime(extra = {}) {
  const window = { navigator: { webdriver: true }, __FLYEE_RENDER__: true, console };
  window.window = window;
  window.document = { getElementById: () => null, createElement: () => fakeCanvas(), body: { style: {} } };
  Object.assign(window, extra);
  vm.createContext(window);
  vm.runInContext(readFileSync(MOTION, "utf8"), window, { filename: "motion.js" });
  vm.runInContext(readFileSync(STUDIO, "utf8"), window, { filename: "studio.js" });
  return window;
}

/** The inline script of a template (the one without src or id). */
function pageScript(template) {
  const html = readFileSync(join(TEMPLATE_DIR, `${template}.html`), "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.equal(scripts.length, 1, `${template}.html tem um script da página`);
  return scripts[0];
}

/** The test images the fixtures name, with their sizes; any other path fails to load. */
const IMAGE_SIZES = { "assets/logo.svg": [120, 120], "assets/tela.png": [390, 1600], "assets/produto.png": [480, 600], "assets/logo-pequeno.png": [64, 64], "assets/logo-largo.png": [400, 120] };

/** An Image that "loads" the known test images on the next tick (the page draws them through the fake canvas). */
class FakeImage {
  constructor() {
    this.naturalWidth = 0;
    this.naturalHeight = 0;
  }
  set src(value) {
    this._src = value;
    const size = IMAGE_SIZES[value];
    Promise.resolve().then(() => {
      if (size) {
        [this.naturalWidth, this.naturalHeight] = size;
        if (this.onload) this.onload();
      } else if (this.onerror) this.onerror();
    });
  }
  get src() {
    return this._src;
  }
}

/** A template running in a vm with a roteiro, on a fake canvas; the fixture images load, any other path falls back. */
async function page(roteiro) {
  const canvas = fakeCanvas(roteiro.width, roteiro.height);
  const data = { textContent: JSON.stringify(roteiro) };
  const window = runtime({ Image: FakeImage });
  window.document = { getElementById: (id) => (id === "roteiro" ? data : id === "c" ? canvas : null), createElement: () => fakeCanvas(), body: { style: {} } };
  vm.runInContext(pageScript(roteiro.template), window, { filename: `${roteiro.template}.html` });
  await window.Studio.loading;
  window.__ctx = canvas.getContext("2d");
  return window;
}

/** What one instant writes on the canvas (each text with its font), drawn on the page as it is now. */
function written(window, t) {
  window.__ctx.written = [];
  window.seek(t);
  return plain(window.__ctx.written);
}

/** Instants worth reading: every quarter second, both sides of every cut and the last frame. */
function instants(roteiro, cuts) {
  const last = Math.round((roteiro.duration - 1 / FPS) * 1000) / 1000;
  const set = new Set([0, last]);
  for (let t = 0; t <= last; t += 0.25) set.add(Math.round(t * 1000) / 1000);
  for (const cut of cuts) for (const d of [-2, -1, 0, 1, 2]) set.add(Math.max(0, Math.min(last, Math.round((cut + d / FPS) * 1000) / 1000)));
  return [...set].sort((a, b) => a - b);
}

function outside(box, rect, tolerance = 2) {
  return box.x < rect.x - tolerance || box.y < rect.y - tolerance || box.x + box.w > rect.x + rect.w + tolerance || box.y + box.h > rect.y + rect.h + tolerance;
}

// ---------------------------------------------------------------------------------------------
// Test images, generated (no binary files in the repository)
// ---------------------------------------------------------------------------------------------

const CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** A truecolor PNG from a pixel function (x, y) → [r, g, b]. */
function png(width, height, pixel) {
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      const i = y * stride + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const inside = (x, y, r) => x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3];

/** A tall phone screenshot of a made-up site: header, hero with a button, cards and a dark band. */
function screenPng() {
  const W = 390, H = 1600;
  const blocks = [
    [[0, 0, W, 70], [255, 255, 255]], [[300, 16, 74, 38], [124, 58, 237]], [[20, 22, 26, 26], [124, 58, 237]],
    [[0, 70, W, 520], [245, 243, 255]], [[24, 150, 300, 30], [31, 41, 55]], [[24, 192, 220, 30], [31, 41, 55]], [[24, 250, 330, 12], [107, 114, 128]],
    [[24, 272, 300, 12], [107, 114, 128]], [[24, 330, 220, 52], [124, 58, 237]], [[24, 396, 180, 52], [37, 211, 102]],
    [[24, 640, 342, 200], [243, 244, 246]], [[44, 670, 200, 22], [31, 41, 55]], [[44, 710, 280, 10], [107, 114, 128]], [[44, 730, 240, 10], [107, 114, 128]],
    [[24, 870, 342, 200], [243, 244, 246]], [[44, 900, 220, 22], [31, 41, 55]], [[44, 940, 260, 10], [107, 114, 128]], [[44, 960, 230, 10], [107, 114, 128]],
    [[0, 1110, W, 330], [17, 24, 39]], [[110, 1170, 170, 50], [196, 181, 253]], [[120, 1240, 150, 12], [209, 213, 219]], [[110, 1300, 170, 50], [196, 181, 253]],
  ];
  return png(W, H, (x, y) => {
    for (let i = blocks.length - 1; i >= 0; i--) if (inside(x, y, blocks[i][0])) return blocks[i][1];
    return [255, 255, 255];
  });
}

/** A product photo: a warm backdrop, a floor and a dark rounded object with a highlight. */
function photoPng() {
  const W = 480, H = 600;
  return png(W, H, (x, y) => {
    const dx = (x - W / 2) / 130, dy = (y - H * 0.48) / 190;
    if (dx * dx + dy * dy < 1) return dx < -0.4 && dy < 0 ? [190, 96, 70] : [150, 62, 44];
    const floor = y > H * 0.74;
    const k = y / H;
    return floor ? [200 - 30 * k, 180 - 30 * k, 160 - 30 * k] : [236 - 20 * k, 226 - 24 * k, 212 - 26 * k].map(Math.round);
  });
}

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="#7C3AED"/><path d="M34 66c10 22 42 22 52 0" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" fill="none"/></svg>`;

/** The page folder the script builds: pagina.html with the roteiro, motion.js, studio.js and assets/. */
function buildPage(dir, roteiro) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, "assets"), { recursive: true });
  const template = readFileSync(join(TEMPLATE_DIR, `${roteiro.template}.html`), "utf8");
  const json = JSON.stringify(roteiro).replace(/<\//g, "<\\/");
  writeFileSync(join(dir, "pagina.html"), template.replace("__ROTEIRO__", () => json));
  copyFileSync(MOTION, join(dir, "motion.js"));
  copyFileSync(STUDIO, join(dir, "studio.js"));
  writeFileSync(join(dir, "assets", "tela.png"), screenPng());
  writeFileSync(join(dir, "assets", "produto.png"), photoPng());
  writeFileSync(join(dir, "assets", "logo.svg"), LOGO_SVG);
  return join(dir, "pagina.html");
}

/** Runs render.mjs as the member's AI would: from the repo root, with --json. */
function cli(args) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [RENDER, ...args, "--json"], { cwd: REPO, windowsHide: true });
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

const engineCheck = existsSync(RENDER) && !process.env.FLYEE_TEST_SKIP_ENGINE ? await cli(["check"]) : null;
const canRender = !process.env.FLYEE_TEST_SKIP_ENGINE && Boolean(engineCheck?.json?.ok && engineCheck.json.modes?.render);
const SKIP = existsSync(RENDER) ? "sem ffmpeg ou navegador nesta máquina" : "o Motor de vídeo não está neste repositório";

// ---------------------------------------------------------------------------------------------
// Static checks
// ---------------------------------------------------------------------------------------------

test("every template is a full page with motion.js, studio.js, one data block and one __ROTEIRO__ token", () => {
  for (const template of TEMPLATES) {
    const html = readFileSync(join(TEMPLATE_DIR, `${template}.html`), "utf8");
    assert.match(html, /^<!doctype html>/i, `${template}.html começa com o doctype`);
    assert.equal(html.split('<script src="motion.js"></script>').length, 2, `${template}.html inclui motion.js uma vez`);
    assert.equal(html.split('<script src="studio.js"></script>').length, 2, `${template}.html inclui studio.js uma vez`);
    assert.equal(html.split('<script id="roteiro" type="application/json">__ROTEIRO__</script>').length, 2, `${template}.html tem o bloco de dados`);
    assert.equal(html.split("__ROTEIRO__").length, 2, `${template}.html tem o marcador exatamente uma vez`);
    assert.ok(html.indexOf("motion.js") < html.indexOf("studio.js") && html.indexOf("studio.js") < html.indexOf("__ROTEIRO__"), `${template}.html carrega na ordem certa`);
    assert.match(html, /<canvas id="c"/, `${template}.html tem o canvas`);
    const script = pageScript(template);
    for (const hook of ["window.seek", "window.setFormat", "window.boxes", "film.cuts"]) assert.ok(script.includes(hook), `${template}.html define ${hook}`);
    const code = script.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const banned of ["Math.random", "setTimeout", "setInterval", "requestAnimationFrame", "performance.now", "Date.now"]) assert.equal(code.includes(banned), false, `${template}.html usa ${banned}`);
  }
});

test("studio.js is a pure function of time: no random, no timers, no animation frames, no clock", () => {
  const code = readFileSync(STUDIO, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const banned of ["Math.random", "setTimeout", "setInterval", "requestAnimationFrame", "performance.now", "Date.now", "new Date"]) {
    assert.equal(code.includes(banned), false, `studio.js usa ${banned}`);
  }
});

test("the fixtures cover every template, short and long, with and without assets, and are valid roteiros", () => {
  assert.ok(fixtures.length >= 8, "pelo menos duas por roteiro");
  for (const template of TEMPLATES) {
    const own = fixtures.filter((f) => f.roteiro.template === template);
    assert.ok(own.length >= 2, `${template}: duas amostras`);
    const durations = own.map((f) => f.roteiro.duration);
    assert.ok(Math.min(...durations) < 10 && Math.max(...durations) >= 19.99, `${template}: uma curta e uma de 20 s (${durations.join(", ")})`);
    const withAssets = own.filter((f) => f.roteiro.brand.logo || f.roteiro.scenes.some((s) => s.screen || s.image));
    assert.ok(withAssets.length >= 1 && withAssets.length < own.length, `${template}: uma com imagens ou logo e uma sem nada`);
  }
  for (const { name, roteiro } of fixtures) assert.deepEqual(validateFixture(roteiro), [], `${name} é um roteiro válido`);
});

test("the fixture validator catches what references/roteiros.json forbids", () => {
  const base = fixtures.find((f) => f.name === "lista-tres").roteiro;
  const broken = (change) => {
    const copy = JSON.parse(JSON.stringify(base));
    change(copy);
    return validateFixture(copy);
  };
  assert.match(broken((r) => r.scenes.splice(1, 1)).join(" "), /item: 2 cena/);
  assert.match(broken((r) => (r.scenes[0].text = "um gancho longo demais com sete palavras")).join(" "), /palavras/);
  assert.match(broken((r) => (r.scenes[1].bars = 3)).join(" "), /bars 3/);
  assert.match(broken((r) => (r.bpm = 150)).join(" "), /bpm/);
  assert.match(broken((r) => (r.scenes[4].events = [{ beat: 9, type: "impact" }])).join(" "), /batida 9/);
});

// ---------------------------------------------------------------------------------------------
// studio.js's pure helpers (vm)
// ---------------------------------------------------------------------------------------------

test("Studio exposes the loader, the stage, the components and the five styles", () => {
  const { Studio } = runtime();
  for (const name of ["load", "image", "stage", "background", "drift", "born", "text", "headline", "body", "label", "chip", "device", "card", "cursor", "counter", "price", "listItem", "rail", "button", "logo", "lockup", "dive", "flood", "whip", "check", "bars", "skeleton", "roundRect"]) {
    assert.equal(typeof Studio[name], "function", `Studio.${name}`);
  }
  assert.deepEqual(plain(Studio.STYLE_IDS), STYLE_IDS);
  assert.deepEqual(Object.keys(Studio.STYLES).sort(), [...STYLE_IDS].sort());
  const looks = STYLE_IDS.map((id) => Studio.STYLES[id]);
  assert.ok(new Set(looks.map((s) => s.world)).size >= 2, "mundos escuros e claros");
  assert.ok(new Set(looks.map((s) => s.frame)).size >= 3, "molduras diferentes (aparelho, cartão, de lado a lado)");
  assert.equal(new Set(looks.map((s) => s.visual)).size, 5, "cada estilo dá um peso diferente às imagens");
  assert.ok(new Set(looks.map((s) => s.cursor)).size === 2 && new Set(looks.map((s) => s.chips)).size === 2, "cursor e etiquetas ligados em uns, desligados em outros");
  assert.ok(new Set(looks.map((s) => s.between)).size >= 3, "transições diferentes");
  assert.ok(new Set(looks.map((s) => s.type.scale)).size >= 4, "escalas de tipo diferentes");
  for (const s of looks) assert.ok(s.drift <= 0.03, `${s.id}: deriva até 3%`);
  assert.equal(Studio.styleFor("nao-existe", "oferta").id, "vitrine", "estilo desconhecido cai no padrão do roteiro");
  assert.equal(Studio.styleFor({ reference: "https://exemplo" }, "lista").id, "tipografia-cinetica");
  for (const [template, spec] of Object.entries(SPECS.templates)) assert.equal(Studio.styleFor(null, template).id, spec.default_style, `${template}: o estilo padrão é o de roteiros.json`);
});

test("the timeline puts scene starts, ends, cuts and events on the beat grid", () => {
  const { Studio } = runtime();
  const tl = Studio.computeTimeline({ bpm: 128, beats_per_bar: 4, scenes: [
    { role: "gancho", bars: 1, events: [{ beat: 0, type: "impact" }, { beat: 1, type: "pop" }] },
    { role: "produto", bars: 2, events: [{ beat: 0.5, type: "whoosh" }] },
    { role: "ponto", bars: 0.5 },
  ] });
  const beat = 60 / 128;
  assert.ok(close(tl.beat_s, beat) && close(tl.bar_s, 4 * beat));
  assert.ok(close(tl.duration, 3.5 * 4 * beat, 1e-5));
  assert.deepEqual(plain(tl.scenes.map((s) => [s.start, s.end, s.beats])), plain([[0, 1.875, 4], [1.875, 5.625, 8], [5.625, 6.5625, 2]]));
  assert.deepEqual(plain(tl.cuts), [1.875, 5.625]);
  assert.ok(close(tl.scenes[0].events[1].t, beat, 1e-5));
  assert.ok(close(tl.scenes[1].events[0].t, 1.875 + 0.5 * beat, 1e-5));
  for (const { roteiro } of fixtures) {
    const t = Studio.computeTimeline(roteiro);
    assert.ok(close(t.duration, roteiro.duration, 0.01), `${roteiro.title}: duração`);
    for (const cut of t.cuts) assert.ok(close(cut / t.beat_s, Math.round(cut / t.beat_s), 1e-4), `${roteiro.title}: corte ${cut} na batida`);
  }
});

test("numbers are written the Brazilian way and prices are read as they are written", () => {
  const { Studio } = runtime();
  assert.equal(Studio.formatNumber(1234.5), "1.234,5");
  assert.equal(Studio.formatNumber(12000), "12.000");
  assert.equal(Studio.formatNumber(199.9, 2), "199,90");
  assert.equal(Studio.formatNumber(-1000000), "-1.000.000");
  assert.equal(Studio.formatNumber(4.9), "4,9");
  assert.deepEqual(plain(Studio.parseAmount("12x de R$ 49,90")), { prefix: "12x de R$ ", value: 49.9, decimals: 2, suffix: "", text: "12x de R$ 49,90" });
  assert.equal(Studio.parseAmount("R$ 1.299").value, 1299);
  assert.equal(Studio.parseAmount("R$ 1.299").decimals, 0);
  assert.deepEqual(plain(Studio.parseAmount("10% OFF")), { prefix: "", value: 10, decimals: 0, suffix: "% OFF", text: "10% OFF" });
  assert.deepEqual(plain(Studio.parseAmount(49.9)), { prefix: "", value: 49.9, decimals: 2, suffix: "", text: null });
  assert.equal(Studio.parseAmount("Grátis").value, null, "sem número: o texto como veio");
  assert.equal(Studio.parsePtNumber("2.000").value, 2000);
  assert.equal(Studio.parsePtNumber("1.5").value, 1.5);
});

test("palettes keep text readable in both worlds, fill what is missing and replace an ink that fails", () => {
  const { Studio } = runtime();
  assert.ok(close(Studio.contrast("#FFFFFF", "#000000"), 21, 1e-9));
  assert.ok(close(Studio.contrast("#777777", "#777777"), 1, 1e-9));
  const cases = [
    { background: "#FFFFFF", text: "#1F2937", accent: "#7C3AED" },
    { background: "#0F0F10", text: "#F4F1EA", accent: "#E8473C" },
    { background: "#F2B705", text: "#F7F3EA", accent: "#111111" },
    { background: "#7C3AED", text: "#7C3AED", accent: "#FFFFFF" },
    { background: "#336699" },
    {},
  ];
  for (const input of cases) {
    for (const prefer of ["dark", "light", "native"]) {
      const p = Studio.derivePalette(input, prefer);
      for (const world of [p.worlds.main, p.worlds.alt]) {
        const label = `${JSON.stringify(input)} ${prefer} ${world.name}`;
        assert.ok(Studio.contrast(world.ink, world.bg) >= 4.5, `${label}: texto legível`);
        assert.ok(Studio.contrast(world.muted, world.bg) >= 4.5, `${label}: rótulo legível`);
        assert.ok(Studio.contrast(world.onAccent, world.accent) >= 4.5, `${label}: texto sobre o acento`);
        assert.ok(Studio.contrast(world.accentText, world.bg) >= 3, `${label}: acento usado como texto grande`);
        assert.match(world.surface, /^#[0-9A-F]{6}$/, `${label}: superfície derivada`);
      }
    }
  }
  const dark = Studio.derivePalette({ background: "#FFFFFF", text: "#1F2937", accent: "#7C3AED" }, "dark");
  assert.equal(dark.worlds.main.light, false, "o estilo escuro inverte uma marca clara");
  assert.equal(dark.worlds.alt.bg, "#FFFFFF", "e guarda o mundo nativo como o outro");
  assert.equal(Studio.readableOn("#FFFFFF", ["#FFFF00", "#222222"]), "#222222");
});

test("text fitting finds the largest size that fits, balances the lines and never overflows", () => {
  const { Studio } = runtime();
  const measure = (text, size) => String(text).length * size * 0.55;
  const fit = Studio.fitText(measure, "Seu sorriso novo em 90 dias", { size: 200, minSize: 60, maxWidth: 790, maxHeight: 700, maxLines: 3, lineHeight: 1.05 });
  assert.ok(fit.fits);
  assert.ok(fit.lines.length <= 3 && fit.lines.every((l) => l.width <= 790 + 0.5));
  assert.ok(fit.height <= 700);
  assert.ok(measure("Seu sorriso novo em 90 dias", fit.size + 2) * (1 / 3) > 0, "o tamanho é o maior que cabe");
  const bigger = Studio.fitText(measure, "Seu sorriso novo em 90 dias", { size: fit.size + 2, minSize: fit.size + 2, maxWidth: 790, maxHeight: 700, maxLines: 3, lineHeight: 1.05 });
  assert.equal(bigger.fits, false, "dois pixels a mais já não cabem");
  const widths = fit.lines.map((l) => l.width);
  assert.ok(Math.max(...widths) - Math.min(...widths) < 790 * 0.6, "linhas equilibradas");
  assert.deepEqual(plain(Studio.balanceBreaks([100, 100, 100, 100], 10, 2, 1000)), [0, 2], "quatro palavras iguais em duas linhas: duas e duas");
  assert.equal(Studio.balanceBreaks([600, 600], 10, 1, 1000), null, "não cabe numa linha");
  const forced = Studio.fitText(measure, "primeira\nsegunda", { size: 100, minSize: 40, maxWidth: 2000, maxLines: 3 });
  assert.equal(forced.lines.length, 2, "\\n força a quebra");
  const url = Studio.fitText(measure, "www.minhalojadetreinofitness.com.br/colecao-de-inverno", { size: 100, minSize: 44, maxWidth: 790, maxLines: 2 });
  assert.ok(url.lines.every((l) => l.width <= 790 + 0.5), "um endereço longo é partido nos pontos e barras");
  assert.equal(url.size, 44);
});

test("the emphasis falls on a number with its unit, on the given words or on the last content word", () => {
  const { Studio } = runtime();
  const pick = (text, hint) => plain(Studio.pickEmphasis(Studio.splitWords(text), hint));
  assert.deepEqual(pick("Seu sorriso novo em 90 dias"), { from: 4, to: 5 });
  assert.deepEqual(pick("Casaco de lã por R$ 199"), { from: 4, to: 5 });
  assert.deepEqual(pick("Roupa de treino que dura"), { from: 4, to: 4 });
  assert.deepEqual(pick("Frio chegou. A lã também.", "lã"), { from: 3, to: 3 });
  assert.deepEqual(pick("Pagamento pelo celular", "pelo celular"), { from: 1, to: 2 });
  assert.equal(Studio.pickEmphasis(Studio.splitWords("Sem destaque"), false), null);
});

test("safe areas match the Motor's for every format, scaled to the frame", () => {
  const { Studio, Motion } = runtime();
  assert.deepEqual(plain(Studio.safeRect(1080, 1920)), { x: 70, y: 250, w: 830, h: 1170, format: "9:16" });
  for (const name of ["9:16", "4:5", "1:1", "16:9"]) {
    const s = Motion.SAFE[name];
    const rect = Studio.safeRect(s.width, s.height);
    const want = Motion.safeArea(name);
    assert.deepEqual([rect.x, rect.y, rect.w, rect.h, rect.format], [want.x, want.y, want.w, want.h, name], name);
  }
  const half = Studio.safeRect(540, 960);
  assert.deepEqual([half.x, half.y, half.w, half.h], [35, 125, 415, 585], "metade do tamanho, metade das margens");
  assert.equal(Studio.frameFor({ ok: true, w: 780, h: 9000 }).kind, "phone");
  assert.equal(Studio.frameFor({ ok: true, w: 780, h: 9000 }).scrollable, true);
  assert.equal(Studio.frameFor({ ok: true, w: 1440, h: 900 }).kind, "window");
  assert.equal(Studio.frameFor(null).kind, "phone", "sem imagem: o celular da marca");
  // a tela começa em y 500 e a parte visível vai até 1420: o meio da página precisa cair em y 960
  const scroll = Studio.scrollFor({ ok: true, w: 780, h: 7800 }, { x: 0, y: 500, w: 780, h: 1600 }, 0.5, { y: 250, h: 1170 });
  const pageY = scroll * (7800 - 1600) + (960 - 500);
  assert.ok(Math.abs(pageY - 3900) < 1, `o meio da página fica no meio da parte visível (${scroll})`);
  assert.equal(Studio.scrollFor({ ok: true, w: 780, h: 7800 }, { x: 0, y: 500, w: 780, h: 1600 }, 0, { y: 250, h: 1170 }), 0, "o topo não rola para cima");
});

// ---------------------------------------------------------------------------------------------
// Every template drawing every fixture (vm, fake canvas)
// ---------------------------------------------------------------------------------------------

test("every template draws every fixture at any instant: deterministic, a readable cover, text and logo inside the safe area", async () => {
  for (const { name, roteiro } of fixtures) {
    const window = await page(roteiro);
    const { film, Studio } = window;
    assert.ok(close(film.duration, roteiro.duration, 0.01), `${name}: film.duration`);
    assert.deepEqual([film.width, film.height, film.fps], [1080, 1920, 30], `${name}: o filme é 1080×1920 a 30 fps`);
    assert.deepEqual(plain(film.cuts), plain(Studio.timeline.scenes.slice(1).map((s) => s.start)), `${name}: os cortes são os inícios das cenas`);
    assert.equal(typeof window.seek, "function");
    assert.equal(typeof window.setFormat, "function");
    assert.equal(typeof window.boxes, "function");
    const times = instants(roteiro, film.cuts);
    const seen = new Map();
    for (const t of times) {
      assert.doesNotThrow(() => window.seek(t), `${name}: seek(${t})`);
      const boxes = plain(window.boxes(t));
      seen.set(t, boxes);
      for (const box of boxes) {
        assert.ok([box.x, box.y, box.w, box.h].every(Number.isFinite), `${name} em ${t} s: caixa com números`);
        if (box.role !== "text" && box.role !== "logo") continue;
        assert.equal(outside(box, SAFE_9x16), false, `${name} em ${t} s: ${box.role} "${box.text ?? ""}" fora da área segura ${JSON.stringify(box)}`);
        if (box.role === "text") assert.ok(box.size >= 44, `${name} em ${t} s: "${box.text}" com ${box.size} px`);
      }
    }
    const cover = seen.get(0).filter((b) => b.role === "text" && b.size >= 44);
    assert.ok(cover.length > 0, `${name}: o quadro 0 tem texto legível`);
    // the same instant gives the same frame, whatever was drawn before
    for (const t of [times[times.length - 1], 0, times[Math.floor(times.length / 2)]]) assert.deepEqual(plain(window.boxes(t)), seen.get(t), `${name}: boxes(${t}) é determinístico`);
    // the closing is still on screen in the last frame
    const last = seen.get(times[times.length - 1]);
    assert.ok(last.some((b) => b.role === "text" || b.role === "logo"), `${name}: o último quadro segura a assinatura`);
  }
});

test("an instant draws the same texts with the same fonts whether it is the first frame of a page or not", async () => {
  // a render split between browsers starts each part in the middle of the film: its first frame must be like any other
  for (const { name, roteiro } of fixtures) {
    const warm = await page(roteiro);
    const times = instants(roteiro, warm.film.cuts);
    const picks = [times[times.length - 1], ...warm.film.cuts.map((cut) => Math.round((cut + 0.6) * 1000) / 1000), times[Math.floor(times.length / 2)]].filter((t) => t < roteiro.duration);
    for (const t of times) written(warm, t);
    for (const t of picks) {
      const cold = await page(roteiro);
      assert.deepEqual(written(cold, t), written(warm, t), `${name}: o quadro de ${t} s sai igual quando é o primeiro desenho da página`);
    }
  }
});

test("setFormat recomposes every template for 4:5, 1:1 and 16:9 without breaking and keeps text inside the safe area", async () => {
  const sizes = { "4:5": [1080, 1350], "1:1": [1080, 1080], "16:9": [1920, 1080] };
  for (const { name, roteiro } of fixtures) {
    for (const [format, [width, height]] of Object.entries(sizes)) {
      const window = await page(roteiro);
      window.setFormat({ name: format, width, height });
      assert.deepEqual([window.film.width, window.film.height], [width, height], `${name} ${format}: o filme muda de tamanho`);
      const safe = window.Motion.safeArea(format);
      const min = Math.ceil((44 * width) / 1080);
      for (const t of instants(roteiro, window.film.cuts).filter((_, i) => i % 3 === 0)) {
        assert.doesNotThrow(() => window.seek(t), `${name} ${format}: seek(${t})`);
        for (const box of plain(window.boxes(t))) {
          if (box.role !== "text" && box.role !== "logo") continue;
          assert.equal(outside(box, safe), false, `${name} ${format} em ${t} s: ${box.role} "${box.text ?? ""}" fora da área segura ${JSON.stringify(box)}`);
          if (box.role === "text") assert.ok(box.size >= min, `${name} ${format} em ${t} s: "${box.text}" com ${box.size} px`);
        }
      }
      assert.ok(plain(window.boxes(0)).some((b) => b.role === "text" && b.size >= min), `${name} ${format}: capa legível`);
    }
  }
});

test("a raster logo is never blown up into blur: a tiny one gives way to the brand name, a small one grows at most 25%", async () => {
  const base = fixtures.find((f) => f.name === "lancamento-tela").roteiro;
  const end = Math.round((base.duration - 1 / FPS) * 1000) / 1000;
  const tiny = await page({ ...base, brand: { ...base.brand, logo: "assets/logo-pequeno.png" } });
  assert.equal(tiny.Studio.logoImage, null);
  assert.equal(tiny.Studio.logoNote, "pequeno");
  const named = plain(tiny.boxes(end));
  assert.ok(named.some((b) => b.role === "text" && b.text === base.brand.name), "o nome da marca no lugar do logo");
  assert.equal(named.some((b) => b.role === "logo"), false);
  const wide = await page({ ...base, brand: { ...base.brand, logo: "assets/logo-largo.png" } });
  const box = plain(wide.boxes(end)).find((b) => b.role === "logo");
  assert.ok(box, "o logo de pixels aparece");
  assert.ok(box.h >= 100 - 0.5 && box.h <= 120 * 1.25 * 1.04 + 0.5, `altura entre 100 px e 125% da original (${box.h})`);
  const vector = await page(base);
  assert.ok(plain(vector.boxes(end)).find((b) => b.role === "logo").h > 150, "o logo vetorial cresce à vontade");
});

test("a page without its roteiro says so instead of drawing garbage", () => {
  const window = runtime();
  window.document = { getElementById: (id) => (id === "roteiro" ? { textContent: "__ROTEIRO__" } : null), createElement: () => fakeCanvas(), body: { style: {} } };
  assert.throws(() => window.Studio.load(), /ainda não recebeu o roteiro/);
  window.document.getElementById = (id) => (id === "roteiro" ? { textContent: "{ não é json" } : null);
  assert.throws(() => window.Studio.load(), /não é um JSON válido/);
});

// ---------------------------------------------------------------------------------------------
// Through the real Motor (skipped without a browser or ffmpeg)
// ---------------------------------------------------------------------------------------------

const ENGINE_CASES = { lancamento: "lancamento-tela", interface: "interface-completo", oferta: "oferta-foto", lista: "lista-tres" };
/** A second in the middle of the film, starting in the scene that has the most to draw (the proof, a state, the call, an item). */
const MID_SCENE = { lancamento: "prova", interface: "estado", oferta: "fechamento", lista: "item" };
function midSecond(roteiro, role) {
  const bar = (roteiro.beats_per_bar * 60) / roteiro.bpm;
  let start = 0;
  for (const scene of roteiro.scenes) {
    if (scene.role === role) return Math.round(start * bar * 1000) / 1000;
    start += scene.bars;
  }
  return 0;
}

test("each template passes the Motor's accept and renders the same frames twice, with one or two browsers", { timeout: 900000, skip: canRender ? false : SKIP }, async (t) => {
  await Promise.all(
    Object.entries(ENGINE_CASES).map(([template, fixture]) =>
      t.test(template, { timeout: 900000 }, async () => {
        const { roteiro } = fixtures.find((f) => f.name === fixture);
        const dir = join(OUT_ROOT, fixture);
        const pagePath = buildPage(dir, roteiro);
        const accept = await cli(["accept", pagePath, "--format", "9:16", "--safe", "instagram-feed", "--bpm", String(roteiro.bpm)]);
        assert.ok(accept.json?.ok, `accept falhou: ${accept.stdout}\n${accept.stderr}`);
        const status = Object.fromEntries(accept.json.checks.map((c) => [c.name, c]));
        for (const name of ["page", "first_frame_readable", "safe_area", "text_size", "cuts_on_beat"]) {
          assert.equal(status[name]?.status, "pass", `${fixture}: ${name} — ${JSON.stringify(status[name])}`);
        }
        assert.deepEqual(accept.json.warnings.filter((w) => /erro/i.test(w)), [], `${fixture}: a página não registrou erros`);
        const first = await cli(["render", pagePath, "--end", "1", "--scale", "0.25", "--parallel", "1", "--out", join(dir, "a.mp4")]);
        const second = await cli(["render", pagePath, "--end", "1", "--scale", "0.25", "--parallel", "1", "--out", join(dir, "b.mp4")]);
        assert.ok(first.json?.ok && second.json?.ok, `render falhou: ${first.stdout}${first.stderr}\n${second.stdout}${second.stderr}`);
        assert.equal(first.json.frames, 30, `${fixture}: 1 s a 30 fps`);
        assert.match(first.json.frames_hash, /^[0-9a-f]{64}$/);
        assert.equal(first.json.frames_hash, second.json.frames_hash, `${fixture}: o mesmo segundo dá os mesmos quadros`);
        // the same second in the middle of the film, by one browser and split between two
        const from = midSecond(roteiro, MID_SCENE[template]);
        const span = ["--start", String(from), "--end", String(Math.min(roteiro.duration, from + 1)), "--scale", "0.25"];
        const one = await cli(["render", pagePath, ...span, "--parallel", "1", "--out", join(dir, "c.mp4")]);
        const two = await cli(["render", pagePath, ...span, "--parallel", "2", "--out", join(dir, "d.mp4")]);
        assert.ok(one.json?.ok && two.json?.ok, `render falhou: ${one.stdout}${one.stderr}\n${two.stdout}${two.stderr}`);
        assert.equal(two.json.workers, 2, "o segundo render foi dividido entre dois navegadores");
        assert.equal(one.json.frames_hash, two.json.frames_hash, `${fixture}: o trecho de ${from} s sai igual com um ou dois navegadores`);
        assert.deepEqual(first.json.warnings.filter((w) => /erro/i.test(w)), [], `${fixture}: o render não registrou erros`);
      }),
    ),
  );
});
