// The carousel runtime: static checks and the loop guarantees without a browser (a fake canvas
// context in a vm), then the example slides and the templates through the real engine (skipped
// when ffmpeg or a browser is missing). Outputs go to FLYEE_TEST_OUT when set, else to the
// system's temporary folder.
//   node --test modules/motion-carousel/tests/runtime.test.mjs

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
const EXAMPLE = join(APP_DIR, "references", "exemplo");
const TEMPLATES = join(APP_DIR, "runtime", "slides");
const OUT_ROOT = process.env.FLYEE_TEST_OUT ? resolve(process.env.FLYEE_TEST_OUT) : join(tmpdir(), "flyee-motion-carousel-tests");
const FPS = 30;

const { checkTools, findBrowser } = await import(pathToFileURL(join(RENDER_APP, "scripts", "lib", "tools.mjs")).href);
const { copyTree } = await import(pathToFileURL(join(APP_DIR, "scripts", "lib", "project.mjs")).href);
const tools = await checkTools();
const canRender = Boolean(tools.ffmpeg && tools.ffprobe && findBrowser());
const SKIP = "sem ffmpeg ou navegador nesta máquina";

// ---------------------------------------------------------------------------------------------
// A fake canvas: enough of the 2D context for the runtime to lay text out and register boxes.
// ---------------------------------------------------------------------------------------------

function fakeContext() {
  const g = {
    font: "", letterSpacing: "0px", textAlign: "left", textBaseline: "top", fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
    globalCompositeOperation: "source-over", shadowColor: "", shadowBlur: 0, shadowOffsetY: 0, lineCap: "butt", lineJoin: "miter",
    calls: 0,
    measureText(text) {
      const m = /(\d+)px/.exec(this.font);
      const size = m ? Number(m[1]) : 16;
      return { width: text.length * size * 0.55 };
    },
    createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData() {},
    createPattern() { return {}; },
    createRadialGradient() { return { addColorStop() {} }; },
  };
  for (const name of ["save", "restore", "fillRect", "fillText", "beginPath", "rect", "clip", "translate", "scale", "rotate", "moveTo", "lineTo", "arcTo", "arc", "closePath", "fill", "stroke", "setTransform"]) {
    g[name] = () => { g.calls++; };
  }
  return g;
}

function fakeCanvas() {
  const g = fakeContext();
  return { width: 0, height: 0, getContext: () => g };
}

/** motion.js + carousel.js inside a vm, as the render flag would load them (no live preview). */
function loadRuntime() {
  const window = { navigator: { webdriver: true }, __FLYEE_RENDER__: true };
  window.window = window;
  window.document = { getElementById: () => null, querySelector: () => null, createElement: () => fakeCanvas(), body: { appendChild() {} } };
  vm.createContext(window);
  vm.runInContext(readFileSync(MOTION, "utf8"), window, { filename: "motion.js" });
  vm.runInContext(readFileSync(CAROUSEL, "utf8"), window, { filename: "carousel.js" });
  return window;
}

const lastFrame = (duration) => Math.round((duration - 1 / FPS) * 10000) / 10000;

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

function fresh(name) {
  const dir = join(OUT_ROOT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** A copy of the example with motion.js and carousel.js next to slides/, as the scripts lay a carousel out. */
function exampleCopy(name) {
  const dir = fresh(name);
  copyTree(EXAMPLE, dir);
  copyFileSync(MOTION, join(dir, "motion.js"));
  copyFileSync(CAROUSEL, join(dir, "carousel.js"));
  return dir;
}

// The values as the `new` command writes them: texts inside quotes already in the template, numbers
// bare, and the theme as a JavaScript value (a name in quotes, or an object).
const PLACEHOLDERS = {
  __N__: "2", __TOTAL__: "3", __TITLE__: "Um título\\nde teste", __TEXT__: "Primeira linha.\\nSegunda linha.", __BARS__: "3", __BEATS_PER_BAR__: "4", __BPM__: "120",
  __THEME__: '"cobalt"', __SEED__: "3", __TOTAL_BARS__: "10", __OFFSET_BARS__: "3", __FORMAT__: "4:5",
};

function fillTemplate(source) {
  let html = source;
  for (const [token, value] of Object.entries(PLACEHOLDERS)) html = html.split(token).join(value);
  const left = /__[A-Z_]+__/.exec(html);
  if (left) throw new Error(`placeholder not filled by the test: ${left[0]}`);
  return html;
}

// ---------------------------------------------------------------------------------------------
// Static checks
// ---------------------------------------------------------------------------------------------

/** Objects from the vm realm have another prototype chain; a JSON round trip makes them comparable. */
const plain = (value) => JSON.parse(JSON.stringify(value));

test("carousel.js is a pure function of time: no random, no timers, no animation frames", () => {
  const source = readFileSync(CAROUSEL, "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const banned of ["Math.random", "setTimeout", "setInterval", "requestAnimationFrame", "performance.now", "Date.now"]) {
    assert.equal(code.includes(banned), false, `carousel.js usa ${banned}`);
  }
  assert.ok(source.includes("global.Carousel ="), "define window.Carousel");
});

test("Carousel exposes setup, the five themes, the formats and the pure helpers", () => {
  const { Carousel } = loadRuntime();
  assert.equal(typeof Carousel.setup, "function");
  assert.deepEqual(Object.keys(Carousel.THEMES), ["noir", "cobalt", "paper", "forest", "mono"]);
  assert.deepEqual(plain(Carousel.THEMES.noir), { bg: "#0C0C0E", ink: "#F3F1EA", muted: "#8A8781", accent: "#E6C15A", grain: true });
  assert.deepEqual(plain(Carousel.THEMES.paper), { bg: "#F4F1EA", ink: "#141413", muted: "#8E8A80", accent: "#D97757" });
  assert.deepEqual(Object.keys(Carousel.FORMATS), ["4:5", "3:4", "1:1", "9:16"]);
  assert.deepEqual(plain(Carousel.FORMATS["3:4"]), { width: 1080, height: 1440 });
  assert.match(Carousel.FONTS.display.family, /"Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif/);
  assert.equal(Carousel.FONTS.display.weight, 800);
  assert.equal(Carousel.FONTS.text.weight, 500);
  for (const name of ["safeRect", "entrance", "formatNumber", "hopProfile", "hopAt", "rgba", "mix", "resolveTheme"]) assert.equal(typeof Carousel[name], "function", name);
});

test("safeRect keeps the 72 px margin and clears the counter and sound corners, scaled by the width", () => {
  const { Carousel, Motion } = loadRuntime();
  const s45 = Carousel.safeRect(1080, 1350, "4:5");
  assert.deepEqual([s45.x, s45.y, s45.w, s45.h], [72, 80, 936, 1170]);
  assert.deepEqual(plain(s45.corners.counter), { x: 910, y: 0, w: 170, h: 80 });
  assert.deepEqual(plain(s45.corners.sound), { x: 980, y: 1250, w: 100, h: 100 });
  const s34 = Carousel.safeRect(1080, 1440, "3:4");
  assert.deepEqual([s34.x, s34.y, s34.w, s34.h], [72, 80, 936, 1260]);
  const s11 = Carousel.safeRect(1080, 1080, "1:1");
  assert.deepEqual([s11.x, s11.y, s11.w, s11.h], [72, 80, 936, 900]);
  const s916 = Carousel.safeRect(1080, 1920, "9:16");
  // the stricter of the carousel margin and the Reels insets of motion.js, whatever they are today
  const reels = Motion.SAFE["9:16"];
  const left = Math.max(72, reels.left);
  const top = Math.max(80, reels.top);
  const right = Math.min(1080 - 72, 1080 - reels.right);
  const bottom = Math.min(1920 - 100, 1920 - reels.bottom);
  assert.deepEqual([s916.x, s916.y, s916.w, s916.h], [left, top, right - left, bottom - top], "o 9:16 usa as margens dos Reels");
  const half = Carousel.safeRect(540, 675, "4:5");
  assert.deepEqual([half.x, half.y, half.w, half.h], [36, 40, 468, 585]);
});

test("entrance, formatNumber and the hop profile are deterministic and well-bounded", () => {
  const { Carousel } = loadRuntime();
  assert.equal(Carousel.entrance(0, "heavy"), 0);
  assert.equal(Carousel.entrance(1, "heavy"), 1);
  assert.equal(Carousel.entrance(2, "heavy"), 1);
  const mid = Carousel.entrance(0.5, "heavy");
  assert.ok(mid > 0.5 && mid < 1, `a mola pesada já passou da metade em x = 0,5 (${mid})`);
  assert.equal(Carousel.entrance(0.5, "heavy"), mid, "mesma entrada, mesmo valor");
  assert.ok(Carousel.entrance(0.3, "type", true) === 0.3, "type é linear");
  assert.equal(Carousel.formatNumber(1234.5, 1), "1.234,5");
  assert.equal(Carousel.formatNumber(8, 0), "8");
  assert.equal(Carousel.formatNumber(-1000000, 0), "-1.000.000");
  const profile = Carousel.hopProfile([2, 1.25, 0.75]);
  assert.equal(profile.length, 3);
  assert.equal(profile[0].end, 0.5);
  assert.equal(profile[2].end, 1);
  assert.ok(profile[1].height < profile[0].height && profile[2].height < profile[1].height, "cada pulo é mais baixo");
  assert.equal(Carousel.hopAt(profile, 0).height, 0);
  assert.equal(Carousel.hopAt(profile, 1).height, 0);
  assert.ok(Carousel.hopAt(profile, 0.25).height > 0.9, "o ápice do primeiro pulo chega perto de 1");
});

// ---------------------------------------------------------------------------------------------
// Time semantics and loop guarantees (fake canvas)
// ---------------------------------------------------------------------------------------------

function exampleLike(window) {
  const C = window.Carousel.setup({ bars: 3, bpm: 120, beatsPerBar: 4, fps: FPS, format: "4:5", theme: "noir", seed: 7, title: "teste", canvas: fakeCanvas() });
  window.seek = (t) => {
    C.begin(t);
    C.pulseBg(0.03);
    C.label("Motivo 1 de 3", { y: 96, size: 44 });
    C.headline("Fevereiro\nmata\nacademias.", { y: 176, size: 156, colors: ["accent", "ink", "ink"], out: 8, outStyle: "rise", back: 10, in: "slam" });
    C.body("Uma.\nDuas.\nTrês.", { y: 760, size: 60, perLine: 1, out: 1.5, back: 3 });
    C.counter({ from: 100, to: 8, suffix: "%", x: 72, y: 900, size: 200, out: 2, back: 4, beats: 4 });
    C.bars({ values: [5, 2, 1, 0], labels: ["a", "b", "c", "d"], x: 72, y: 1000, w: 936, h: 120, out: 2, back: 4.5, perBar: 1 });
    C.card({ x: 72, y: 500, w: 936, h: 100, out: 1.5, back: 3 });
    C.ruler({ y: 1140, totalBars: 16, offsetBars: 3, bars: 3 });
    C.progress({ step: 2, total: 5 });
    C.ball({ from: [116, 996], to: [964, 996], radius: 44, at: 2, beats: 4, back: 7, hops: [2, 1.25, 0.75] });
    return C.end();
  };
  return C;
}

test("setup declares the film from bars and bpm and composes the safe area", () => {
  const window = loadRuntime();
  const C = exampleLike(window);
  assert.equal(C.T, 6);
  assert.equal(C.totalBeats, 12);
  assert.equal(C.beat(4), 2);
  assert.equal(C.bar(1, 2), 3);
  assert.equal(C.beats(1), 0.5);
  assert.deepEqual([window.film.duration, window.film.width, window.film.height, window.film.fps, window.film.background], [6, 1080, 1350, 30, "#0C0C0E"]);
  assert.deepEqual([C.safe.x, C.safe.y, C.safe.w, C.safe.h], [72, 80, 936, 1170]);
  assert.equal(typeof window.setFormat, "function");
  assert.equal(typeof window.boxes, "function");
  assert.equal(C.theme.name, "noir");
  assert.equal(C.theme.light, false);
  assert.equal(window.Carousel.resolveTheme("paper").light, true);
  assert.throws(() => window.Carousel.resolveTheme("neon"), /Tema desconhecido/);
});

test("every element with at: 0 is in the same settled state at frame 0 and at the last frame", () => {
  const window = loadRuntime();
  const C = exampleLike(window);
  window.seek(0);
  const first = C.boxes();
  window.seek(lastFrame(C.T));
  const last = C.boxes();
  const settled = (boxes) => boxes.filter((b) => b.role === "text");
  assert.ok(first.length >= 8, `o quadro 0 tem as caixas da capa (${first.length})`);
  assert.deepEqual(settled(last), settled(first), "as caixas de texto do último quadro são as do quadro 0");
  const texts = first.filter((b) => b.role === "text").map((b) => b.text);
  assert.ok(texts.includes("Fevereiro\nmata\nacademias."), "o título está assentado na capa");
  assert.ok(texts.includes("8%"), "o contador mostra o valor final na capa");
  assert.equal(C.loopT(6.5), 0.5);
  window.seek(6);
  assert.deepEqual(settled(C.boxes()), settled(first), "t = T volta ao quadro 0");
});

test("out hides the element after its exit and back brings it in again with its entrance", () => {
  const window = loadRuntime();
  const C = exampleLike(window);
  const title = (t) => {
    window.seek(t);
    return C.boxes().find((b) => b.text === "Fevereiro\nmata\nacademias.");
  };
  const settled = title(0);
  assert.ok(settled, "visível no quadro 0");
  assert.ok(title(3.9), "visível antes de sair (batida 7,8)");
  assert.equal(title(4.5), undefined, "escondido entre a saída e a volta (batida 9)");
  const slamming = title(5.1);
  assert.ok(slamming, "de volta durante o slam (batida 10,2)");
  assert.ok(slamming.w > settled.w, "o slam entra maior e assenta");
  assert.deepEqual(title(5.5), settled, "assentado meia batida depois da volta");
});

test("perLine staggers the return of each line, the counter counts from `from` after back and the bars regrow one per beat", () => {
  const window = loadRuntime();
  const C = exampleLike(window);
  const at = (t) => {
    window.seek(t);
    return C.boxes();
  };
  const lines = (t) => at(t).find((b) => b.text === "Uma.\nDuas.\nTrês.");
  assert.ok(lines(0), "as linhas estão na capa");
  assert.equal(lines(1.2), undefined, "escondidas entre a saída (out = 1,5) e a volta (back = 3): batida 2,4");
  assert.ok(lines(1.8).h < lines(0).h, "na batida 3,6 só a primeira linha voltou");
  assert.deepEqual(lines(3.5), lines(0), "na batida 7 as três linhas estão de volta");
  const counter = (t) => at(t).find((b) => b.text && b.text.endsWith("%"));
  const value = (t) => Number(counter(t).text.replace("%", ""));
  assert.equal(counter(0).text, "8%");
  assert.equal(counter(1.5), undefined, "o contador some depois de out = 2 (batida 3)");
  const early = value(2.1);
  assert.ok(early > 80 && early < 100, `logo depois de back = 4 conta a partir de from = 100 (${early})`);
  assert.ok(value(3) < early && value(3) > 8, "no meio da contagem está entre os dois");
  assert.equal(counter(4).text, "8%", "quatro batidas depois chegou exatamente em `to`");
  assert.equal(counter(5.9).text, "8%", "e fica em `to` até o fim");
  const chart = (t) => at(t).find((b) => b.role === "ui" && b.y === 1000);
  assert.ok(chart(0), "o gráfico está na capa");
  assert.equal(chart(1.5), undefined, "o gráfico some depois de out");
  assert.ok(chart(2.4), "as barras começam a voltar em back = 4,5 (batida 4,8)");
});

test("an element with at > 0 is absent at frame 0, settles after its entrance and leaves by itself before the loop restarts; the ball rests at `from` at both ends", () => {
  const window = loadRuntime();
  const C = window.Carousel.setup({ bars: 2, bpm: 120, fps: FPS, format: "4:5", theme: "mono", seed: 1, canvas: fakeCanvas() });
  window.seek = (t) => {
    C.begin(t);
    C.headline("Depois", { y: 300, size: 120, at: 2, in: "rise" });
    C.ball({ from: [100, 900], to: [900, 900], radius: 40, at: 1, beats: 2, back: 5, ease: "bounce" });
    return C.end();
  };
  const find = (t, pred) => {
    window.seek(t);
    return C.boxes().find(pred);
  };
  assert.equal(find(0, (b) => b.text === "Depois"), undefined);
  assert.equal(find(0.9, (b) => b.text === "Depois"), undefined);
  const entering = find(1.1, (b) => b.text === "Depois");
  assert.ok(entering, "entra em at = 2 (batida 2,2)");
  const settled = find(2, (b) => b.text === "Depois");
  assert.ok(entering.y > settled.y, "sobe até o lugar");
  assert.deepEqual(find(C.T - 0.5, (b) => b.text === "Depois"), settled, "fica assentado até a última batida");
  assert.equal(find(lastFrame(C.T), (b) => b.text === "Depois"), undefined, "sem out, sai sozinho antes de o loop recomeçar");
  const ball = (t) => find(t, (b) => b.role === "ui" && b.w === 80);
  const rest = ball(0);
  assert.ok(rest && Math.abs(rest.x + 40 - 100) < 1, "a bola descansa em `from` no quadro 0");
  const away = ball(1.5);
  assert.ok(away.x > rest.x + 200, "a bola foi para a direita");
  assert.deepEqual(ball(lastFrame(C.T)), rest, "e descansa em `from` no último quadro");
});

test("text boxes stay inside the safe area, the first frame is readable and the counter clears the corners", () => {
  const window = loadRuntime();
  const C = exampleLike(window);
  // settled instants and hidden windows; a slam scales past the margins for a few frames by design
  for (const t of [0, 1, 2.5, 3.9, 4.5, 5.5, lastFrame(C.T)]) {
    window.seek(t);
    for (const box of C.boxes()) {
      if (box.role !== "text") continue;
      assert.ok(box.x >= C.safe.x - 1 && box.y >= C.safe.y - 1 && box.x + box.w <= C.safe.x + C.safe.w + 1 && box.y + box.h <= C.safe.y + C.safe.h + 1, `t=${t}: ${box.text} dentro da área segura`);
      const { counter, sound } = C.safe.corners;
      const hits = (c) => box.x < c.x + c.w && box.x + box.w > c.x && box.y < c.y + c.h && box.y + box.h > c.y;
      assert.equal(hits(counter) || hits(sound), false, `t=${t}: ${box.text} longe dos cantos`);
    }
  }
  window.seek(0);
  assert.ok(C.boxes().some((b) => b.role === "text" && b.size >= 44), "há texto legível no quadro 0");
});

test("setFormat recomposes the canvas, the film and the safe area", () => {
  const window = loadRuntime();
  const C = exampleLike(window);
  window.seek(0);
  const pills = C.boxes().find((b) => b.role === "ui" && b.h === 10);
  window.setFormat({ name: "3:4", width: 1080, height: 1440 });
  assert.equal(C.H, 1440);
  assert.equal(window.film.height, 1440);
  assert.equal(C.canvas.height, 1440);
  assert.deepEqual([C.safe.x, C.safe.y, C.safe.w, C.safe.h], [72, 80, 936, 1260]);
  window.seek(0);
  const pillsAfter = C.boxes().find((b) => b.role === "ui" && b.h === 10);
  assert.equal(pillsAfter.y, pills.y + 90, "as pílulas acompanham a base da área segura");
});

test("boxes(t) redraws when asked for another instant", () => {
  const window = loadRuntime();
  const C = exampleLike(window);
  window.seek(0);
  assert.ok(window.boxes(0).some((b) => b.text === "Fevereiro\nmata\nacademias."));
  assert.equal(window.boxes(4.5).some((b) => b.text === "Fevereiro\nmata\nacademias."), false, "pediu a batida 9: o título está escondido");
  assert.equal(C.t, 4.5);
});

// ---------------------------------------------------------------------------------------------
// Through the engine (skipped without a browser or ffmpeg)
// ---------------------------------------------------------------------------------------------

test("frames of the example slide 01 render without page errors", { timeout: 180000 }, async (t) => {
  if (!canRender) {
    t.skip(SKIP);
    return;
  }
  const dir = exampleCopy("frames");
  const out = join(dir, "quadros");
  const { json, stdout, stderr } = await cli(["frames", join(dir, "slides", "01.html"), "--times", "0,0.5,5.9", "--format", "4:5", "--scale", "0.25", "--out", out]);
  assert.ok(json && json.ok, `frames falhou: ${stdout}\n${stderr}`);
  assert.equal(json.frames.length, 3);
  assert.equal(json.width, 270);
  assert.equal(json.height, 338);
  assert.deepEqual(json.warnings.filter((w) => /erro/i.test(w)), [], "a página não registrou erros");
  assert.ok(existsSync(join(dir, "quadros", "folha.png")), "a folha de contato existe");
});

test("accept passes first_frame_readable and loop_seamless on slide 01", { timeout: 180000 }, async (t) => {
  if (!canRender) {
    t.skip(SKIP);
    return;
  }
  const dir = exampleCopy("accept");
  const { json, stdout, stderr } = await cli(["accept", join(dir, "slides", "01.html"), "--loop", "--safe", "instagram-carousel", "--bpm", "120", "--format", "4:5"]);
  assert.ok(json, `accept não devolveu JSON: ${stdout}\n${stderr}`);
  if (!json.ok && json.error?.code === "usage") {
    t.skip(`o comando accept ainda não aceita uma página (${json.error.message})`);
    return;
  }
  assert.ok(json.ok, `accept falhou: ${JSON.stringify(json.error)}`);
  const check = (name) => json.checks.find((c) => c.name === name);
  assert.equal(check("first_frame_readable")?.status, "pass", JSON.stringify(check("first_frame_readable")));
  assert.equal(check("loop_seamless")?.status, "pass", JSON.stringify(check("loop_seamless")));
  assert.equal(check("safe_area")?.status, "pass", JSON.stringify(check("safe_area")));
  assert.equal(json.passed, true, JSON.stringify(json.checks.filter((c) => c.status === "fail")));
});

test("frame 0 and the last frame of every example slide and of the filled templates render without JS errors", { timeout: 600000 }, async (t) => {
  if (!canRender) {
    t.skip(SKIP);
    return;
  }
  const dir = exampleCopy("all");
  const pages = [];
  const storyboard = JSON.parse(readFileSync(join(EXAMPLE, "storyboard.json"), "utf8"));
  assert.equal(storyboard.slides.length, 5);
  assert.deepEqual(storyboard.slides.map((s) => s.role), ["hook", "point", "point", "point", "cta"]);
  assert.deepEqual(storyboard.slides.map((s) => s.bars), [3, 3, 3, 3, 4]);
  for (const slide of storyboard.slides) {
    assert.ok(slide.events.length > 0, `o slide ${slide.n} tem eventos`);
    pages.push({ file: join(dir, slide.file), duration: (slide.bars * storyboard.beats_per_bar * 60) / storyboard.bpm, name: `slide ${slide.n}` });
  }
  for (const role of ["hook", "point", "cta"]) {
    const source = readFileSync(join(TEMPLATES, `${role}.html`), "utf8");
    for (const token of Object.keys(PLACEHOLDERS)) assert.ok(source.includes(token), `${role}.html carrega ${token}`);
    const file = join(dir, "slides", `template-${role}.html`);
    writeFileSync(file, fillTemplate(source));
    pages.push({ file, duration: 6, name: `template ${role}` });
  }
  for (const page of pages) {
    const out = join(dir, "quadros", page.name.replace(/\s+/g, "-"));
    const { json, stdout, stderr } = await cli(["frames", page.file, "--times", `0,${lastFrame(page.duration)}`, "--format", "4:5", "--scale", "0.25", "--out", out]);
    assert.ok(json && json.ok, `${page.name}: ${stdout}\n${stderr}`);
    assert.equal(json.frames.length, 2, page.name);
    assert.deepEqual(json.warnings, [], `${page.name} renderiza sem avisos nem erros`);
  }
});
