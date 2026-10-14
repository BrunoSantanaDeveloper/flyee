// Carrossel animado scripts: the pure pieces (storyboard, timing, events, templates, preview,
// engine parsing) with synthetic data; the CLI in a scratch project without the Motor; `new` with
// a stand-in runtime; the whole render/accept orchestration against a stand-in Motor that speaks
// the interface (stub files, spec-shaped answers, a call log); and one end-to-end run through the
// real Motor de vídeo, skipped when ffmpeg, a browser, the app's runtime files or the Motor's
// synth/mix/accept commands are not there yet.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { engineArgs, findVideoRender, parseEngineOutput, runEngine } from "../scripts/lib/engine.mjs";
import { injectPreview, previewData } from "../scripts/lib/preview.mjs";
import { briefTemplate, carouselDir, copyTree, fillTemplate, missingRuntime, slideValues, slugOf } from "../scripts/lib/project.mjs";
import { buildStoryboard, defaultRoles, eventsToSfx, parseSlideSelection, ROLES, tempoMatches, timing, validateStoryboard } from "../scripts/lib/storyboard.mjs";
import { AppError, parseArgs, slugify } from "../scripts/lib/util.mjs";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(TESTS_DIR, "..");
const MODULES_DIR = resolve(APP_DIR, "..");
const VIDEO_RENDER_DIR = join(MODULES_DIR, "video-render");
const ENGINE_SCRIPT = "node .flyee/modules/motion-carousel/scripts/carousel.mjs";

/** The storyboard of the worked example, as the interface describes it. */
const EXAMPLE = {
  version: 1,
  title: "Por que todo mundo desiste da academia em fevereiro",
  format: "4:5",
  fps: 30,
  bpm: 120,
  beats_per_bar: 4,
  sound: { style: "noir", seed: 7, intro_bars: 0, file: null },
  theme: "noir",
  seed: 7,
  slides: [
    { n: 1, role: "hook", bars: 3, file: "slides/01.html", title: "Fevereiro mata academias.", events: [{ beat: 0.5, type: "impact" }, { beat: 8, type: "whoosh", direction: "out" }, { beat: 10, type: "impact" }], notes: "" },
    { n: 2, role: "point", bars: 3, file: "slides/02.html", title: "Meta errada", events: [{ beat: 2, type: "tick" }], notes: "" },
    { n: 3, role: "point", bars: 3, file: "slides/03.html", title: "Dor sem placar", events: [], notes: "" },
    { n: 4, role: "point", bars: 3, file: "slides/04.html", title: "A regra dos 2 minutos", events: [{ beat: 1, type: "pop" }, { beat: 2, type: "pop" }], notes: "" },
    { n: 5, role: "cta", bars: 4, file: "slides/05.html", title: "Comente TREINO e eu te mando o plano", events: [{ beat: 0, type: "ding" }], notes: "" },
  ],
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const patch = (value, change) => {
  const copy = clone(value);
  change(copy);
  return copy;
};

function scratch(t, prefix = "flyee-carousel-test-") {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  // best effort: on Windows a scanner or a child that has just exited can hold the folder for a moment
  t.after(() => {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch {
      // the system cleans its temporary folder
    }
  });
  return dir;
}

/* ---------- storyboard ---------- */

test("validateStoryboard accepts the example and fills the defaults", () => {
  const storyboard = validateStoryboard(EXAMPLE);
  assert.equal(storyboard.slides.length, 5);
  assert.equal(storyboard.slides[0].events[1].direction, "out");
  assert.equal(storyboard.sound.seed, 7);
  const minimal = validateStoryboard({ title: "T", slides: [{ role: "hook", bars: 2 }, { role: "cta", bars: 2 }] });
  assert.equal(minimal.version, 1);
  assert.equal(minimal.format, "4:5");
  assert.equal(minimal.fps, 30);
  assert.equal(minimal.bpm, 120);
  assert.equal(minimal.beats_per_bar, 4);
  assert.deepEqual(minimal.sound, { style: "noir", seed: 7, intro_bars: 0, file: null });
  assert.equal(minimal.theme, "noir");
  assert.equal(minimal.seed, 7);
  assert.deepEqual(minimal.slides[0], { n: 1, role: "hook", bars: 2, file: "slides/01.html", title: "", events: [], notes: "" });
  const custom = validateStoryboard({ ...EXAMPLE, theme: { bg: "#0C0C0E", ink: "#F3F1EA", muted: "#8A8781", accent: "#E6C15A", grain: true }, sound: { style: "lofi", file: "assets\\trilha.wav" } });
  assert.deepEqual(custom.theme, { bg: "#0C0C0E", ink: "#F3F1EA", muted: "#8A8781", accent: "#E6C15A", grain: true });
  assert.equal(custom.sound.file, "assets/trilha.wav");
  assert.equal(custom.sound.seed, 7, "sound.seed defaults to the storyboard seed");
});

test("validateStoryboard names the field that is wrong with code storyboard_invalid", () => {
  const cases = [
    [{ ...EXAMPLE, slides: EXAMPLE.slides.slice(0, 1) }, /^storyboard\.json: slides .*2 a 20/],
    [patch(EXAMPLE, (s) => { s.slides[1].bars = 20; }), /slides\[1\]\.bars/],
    [patch(EXAMPLE, (s) => { s.slides[1].bars = 1; }), /slides\[1\]\.bars dá 2 s/],
    [patch(EXAMPLE, (s) => { s.slides[2].role = "intro"; }), /slides\[2\]\.role/],
    [patch(EXAMPLE, (s) => { s.slides[0].events[0].type = "boom"; }), /slides\[0\]\.events\[0\]\.type/],
    [patch(EXAMPLE, (s) => { s.slides[0].events[0].beat = 12; }), /slides\[0\]\.events\[0\]\.beat/],
    [patch(EXAMPLE, (s) => { s.slides[0].events[0].pan = 2; }), /slides\[0\]\.events\[0\]\.pan/],
    [patch(EXAMPLE, (s) => { s.slides[0].events[0].gain_db = -50; }), /slides\[0\]\.events\[0\]\.gain_db/],
    [patch(EXAMPLE, (s) => { s.slides[0].events[0].pitch = 9; }), /slides\[0\]\.events\[0\]\.pitch/],
    [{ ...EXAMPLE, slides: Array.from({ length: 5 }, (_, i) => ({ role: i === 4 ? "cta" : "point", bars: 16, events: [] })) }, /trilha gerada tem até 64/],
    [patch(EXAMPLE, (s) => { s.slides[0].file = "../fora.html"; }), /slides\[0\]\.file/],
    [patch(EXAMPLE, (s) => { s.slides[0].file = "slides/01.txt"; }), /slides\[0\]\.file .*\.html/],
    [patch(EXAMPLE, (s) => { s.slides[1].file = "slides/01.html"; }), /slides\[1\]\.file repete/],
    [patch(EXAMPLE, (s) => { s.slides[1].n = 5; }), /slides\[1\]\.n/],
    [{ ...EXAMPLE, bpm: 300 }, /^storyboard\.json: bpm/],
    [{ ...EXAMPLE, format: "16:9" }, /^storyboard\.json: format/],
    [{ ...EXAMPLE, title: "" }, /^storyboard\.json: title/],
    [{ ...EXAMPLE, version: 2 }, /^storyboard\.json: version/],
    [{ ...EXAMPLE, beats_per_bar: 5 }, /beats_per_bar/],
    [{ ...EXAMPLE, sound: { style: "jazz" } }, /sound\.style/],
    [{ ...EXAMPLE, sound: { file: "C:/musica.wav" } }, /sound\.file/],
    [{ ...EXAMPLE, sound: { intro_bars: 9 } }, /sound\.intro_bars/],
    [{ ...EXAMPLE, theme: { bg: "#000" } }, /theme\.bg/],
    [{ ...EXAMPLE, theme: "neon" }, /^storyboard\.json: theme/],
    [{ ...EXAMPLE, slides: "nope" }, /^storyboard\.json: slides/],
    [null, /precisa ser um objeto/],
  ];
  for (const [input, pattern] of cases) {
    assert.throws(
      () => validateStoryboard(input),
      (error) => error instanceof AppError && error.code === "storyboard_invalid" && pattern.test(error.message),
      `esperava ${pattern} para ${JSON.stringify(input).slice(0, 80)}`,
    );
  }
});

test("tempoMatches: the same tempo within 1.5 BPM, the double or the half; anything else is another tempo", () => {
  assert.equal(tempoMatches(120, 120), true);
  assert.equal(tempoMatches(121.2, 120), true);
  assert.equal(tempoMatches(240.5, 120), true);
  assert.equal(tempoMatches(60.4, 120), true);
  assert.equal(tempoMatches(117, 120), false);
  assert.equal(tempoMatches(100, 120), false);
  assert.equal(tempoMatches(null, 120), false);
  const long = validateStoryboard({ ...EXAMPLE, sound: { file: "assets/minha.wav" }, slides: Array.from({ length: 5 }, (_, i) => ({ role: i === 4 ? "cta" : "point", bars: 16 })) });
  assert.equal(timing(long).total_bars, 80, "a track of the member's own has no 64-bar limit");
  assert.throws(() => validateStoryboard({ ...EXAMPLE, sound: { intro_bars: 8 }, slides: [{ role: "hook", bars: 4 }, { role: "cta", bars: 4 }] }), (error) => /sound\.intro_bars/.test(error.message));
});

test("timing: beats, bars, durations and music offsets", () => {
  const times = timing(validateStoryboard(EXAMPLE));
  assert.equal(times.beat_s, 0.5);
  assert.equal(times.bar_s, 2);
  assert.equal(times.total_bars, 16);
  assert.equal(times.total_beats, 64);
  assert.equal(times.total_duration, 32);
  assert.deepEqual(times.slides.map((slot) => slot.duration), [6, 6, 6, 6, 8]);
  assert.deepEqual(times.slides.map((slot) => slot.music_offset), [0, 6, 12, 18, 24]);
  assert.deepEqual(times.slides.map((slot) => slot.offset_bars), [0, 3, 6, 9, 12]);
  assert.deepEqual(times.slides.map((slot) => slot.beats), [12, 12, 12, 12, 16]);
  const waltz = timing(validateStoryboard({ title: "T", bpm: 100, beats_per_bar: 3, slides: [{ role: "hook", bars: 2 }, { role: "cta", bars: 4 }] }));
  assert.equal(waltz.beat_s, 0.6);
  assert.equal(waltz.bar_s, 1.8);
  assert.deepEqual(waltz.slides.map((slot) => slot.duration), [3.6, 7.2]);
  assert.deepEqual(waltz.slides.map((slot) => slot.music_offset), [0, 3.6]);
  assert.equal(waltz.total_duration, 10.8);
});

test("eventsToSfx converts beats to seconds and keeps the options", () => {
  const storyboard = validateStoryboard(EXAMPLE);
  const times = timing(storyboard);
  assert.deepEqual(eventsToSfx(storyboard.slides[0], times), { duration: 6, events: [{ t: 0.25, type: "impact" }, { t: 4, type: "whoosh", direction: "out" }, { t: 5, type: "impact" }] });
  assert.deepEqual(eventsToSfx(storyboard.slides[2], times), { duration: 6, events: [] });
  const detailed = validateStoryboard(patch(EXAMPLE, (s) => { s.slides[1].events = [{ beat: 1.5, type: "pop", gain_db: -6, pan: 0.3, length: 0.2, pitch: 1.5 }]; }));
  assert.deepEqual(eventsToSfx(detailed.slides[1], timing(detailed)).events, [{ t: 0.75, type: "pop", gain_db: -6, pan: 0.3, length: 0.2, pitch: 1.5 }]);
});

test("parseSlideSelection, defaultRoles and buildStoryboard", () => {
  assert.deepEqual(parseSlideSelection(undefined, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseSlideSelection("1,3", 5), [1, 3]);
  assert.deepEqual(parseSlideSelection("3, 1,1", 5), [1, 3]);
  assert.deepEqual(parseSlideSelection("2-4", 5), [2, 3, 4]);
  for (const bad of ["0", "6", "a", "1,x"]) assert.throws(() => parseSlideSelection(bad, 5), (error) => error.code === "usage", bad);
  assert.deepEqual(defaultRoles(5), ["hook", "point", "point", "point", "cta"]);
  assert.deepEqual(defaultRoles(2), ["hook", "cta"]);
  const built = buildStoryboard({ title: "Lançamento", theme: "cobalt", style: "upbeat", slides: [{ role: "hook", bars: 3, title: "Chegou" }, { role: "point", bars: 3 }, { role: "cta", bars: 4, title: "Comente FOTO" }] });
  assert.equal(built.slides[1].file, "slides/02.html");
  assert.equal(built.sound.style, "upbeat");
  assert.equal(built.theme, "cobalt");
  assert.deepEqual(built.slides.map((slide) => slide.events), [[], [], []]);
  assert.throws(() => buildStoryboard({ title: "x", slides: [{ role: "hook", bars: 1 }, { role: "cta", bars: 4 }] }), (error) => error.code === "storyboard_invalid" && /slides\[0\]\.bars/.test(error.message));
});

/* ---------- templates, brief, preview ---------- */

test("fillTemplate replaces every placeholder and keeps the JavaScript valid", () => {
  const template = 'window.SLIDE = { title: "__TITLE__", text: "__TEXT__", bars: __BARS__, beatsPerBar: __BEATS_PER_BAR__, bpm: __BPM__, theme: __THEME__, seed: __SEED__, n: __N__, total: __TOTAL__, totalBars: __TOTAL_BARS__, offsetBars: __OFFSET_BARS__, format: "__FORMAT__" };';
  const storyboard = validateStoryboard(EXAMPLE);
  const times = timing(storyboard);
  const values = slideValues({ storyboard, times, slide: { ...storyboard.slides[3], title: 'Ele disse "não"\nduas linhas </script>' }, text: "Apoio" });
  const html = fillTemplate(template, values);
  assert.ok(!/__[A-Z_]+__/.test(html), html);
  assert.ok(!html.includes("</script>"));
  const sandbox = {};
  new Function("window", html)(sandbox);
  assert.equal(sandbox.SLIDE.title, 'Ele disse "não"\nduas linhas </script>');
  assert.equal(sandbox.SLIDE.text, "Apoio");
  assert.equal(sandbox.SLIDE.bars, 3);
  assert.equal(sandbox.SLIDE.beatsPerBar, 4);
  assert.equal(sandbox.SLIDE.bpm, 120);
  assert.equal(sandbox.SLIDE.theme, "noir");
  assert.equal(sandbox.SLIDE.seed, 7);
  assert.equal(sandbox.SLIDE.n, 4);
  assert.equal(sandbox.SLIDE.total, 5);
  assert.equal(sandbox.SLIDE.totalBars, 16);
  assert.equal(sandbox.SLIDE.offsetBars, 9);
  assert.equal(sandbox.SLIDE.format, "4:5");
  assert.equal(fillTemplate("a __X__ b", { __Y__: 1 }), "a __X__ b", "unknown tokens stay");
  const custom = validateStoryboard({ ...EXAMPLE, beats_per_bar: 3, bpm: 90, theme: { bg: "#101820", ink: "#F2F2F2", muted: "#8A9099", accent: "#FEE715" }, slides: [{ role: "hook", bars: 2 }, { role: "cta", bars: 3 }] });
  const customHtml = fillTemplate(template, slideValues({ storyboard: custom, times: timing(custom), slide: custom.slides[0], text: "" }));
  const box = {};
  new Function("window", customHtml)(box);
  assert.equal(box.SLIDE.beatsPerBar, 3);
  assert.equal(box.SLIDE.theme.bg, "#101820");
  assert.equal(box.SLIDE.theme.accent, "#FEE715");
});

test("briefTemplate carries the headings and the structure", () => {
  const storyboard = validateStoryboard(EXAMPLE);
  const brief = briefTemplate({ title: storyboard.title, storyboard, times: timing(storyboard) });
  for (const heading of ["## Tema", "## Para quem", "## Promessa", "## Tom", "## Estrutura dos slides", "## Chamada final"]) assert.ok(brief.includes(heading), heading);
  assert.ok(brief.includes("1. Gancho (3 compassos, 6 s): Fevereiro mata academias."));
  assert.ok(brief.includes("5. Chamada final (4 compassos, 8 s): Comente TREINO"));
  assert.ok(!brief.includes("[PREENCHER]"));
});

test("injectPreview puts the carousel JSON where the token is", () => {
  const storyboard = validateStoryboard(EXAMPLE);
  const data = previewData({ storyboard, times: timing(storyboard), mode: "final", files: { 1: { file: "out/01.mp4", rendered: true } } });
  assert.equal(data.title, "Por que todo mundo desiste da academia em fevereiro");
  assert.deepEqual(data.format, { name: "4:5", width: 1080, height: 1350 });
  assert.equal(data.mode, "final");
  assert.equal(data.slides.length, 5);
  assert.deepEqual(data.slides[0], { n: 1, file: "out/01.mp4", duration: 6, role: "hook", title: "Fevereiro mata academias.", rendered: true });
  assert.deepEqual(data.slides[4], { n: 5, file: "out/05.mp4", duration: 8, role: "cta", title: "Comente TREINO e eu te mando o plano", rendered: false });
  const tricky = { ...data, title: "A </script> B" };
  for (const template of [
    "<script>const CAROUSEL = /*__CAROUSEL__*/;</script>",
    "<script>const CAROUSEL = /*__CAROUSEL__*/ null;</script>",
    "<script>const CAROUSEL = /*__CAROUSEL__*/{};</script>",
    "<script>const CAROUSEL = [/*__CAROUSEL__*/][0] || { slides: [] };</script>",
  ]) {
    const html = injectPreview(template, tricky);
    assert.ok(!html.includes("A </script>"), "the closing tag inside a string is escaped");
    const value = new Function(`${html.replace(/<\/?script>/g, "")}; return CAROUSEL;`)();
    assert.deepEqual(value, tricky);
  }
  assert.throws(() => injectPreview("<html></html>", data), (error) => error.code === "runtime_missing");
});

/* ---------- engine ---------- */

test("engineArgs builds the Motor's command lines exactly", () => {
  assert.deepEqual(engineArgs.check(), ["check"]);
  assert.deepEqual(
    engineArgs.synth({ out: "carrosseis/demo/audio/music.wav", bpm: 120, bars: 16, style: "noir", seed: 7, introBars: 0 }),
    ["synth", "--out", "carrosseis/demo/audio/music.wav", "--bpm", "120", "--bars", "16", "--style", "noir", "--seed", "7", "--intro-bars", "0"],
  );
  assert.deepEqual(engineArgs.synth({ out: "m.wav", bpm: 100, bars: 4, style: "clean", seed: 1, introBars: 1, beatsPerBar: 3 }).slice(-2), ["--beats-per-bar", "3"]);
  assert.deepEqual(engineArgs.beats({ input: "carrosseis/demo/trilha.mp3", out: "carrosseis/demo/audio/music.beats.json", bpm: 120 }), ["beats", "carrosseis/demo/trilha.mp3", "--out", "carrosseis/demo/audio/music.beats.json", "--bpm", "120"]);
  assert.deepEqual(engineArgs.sfx({ out: "carrosseis/demo/audio/01-sfx.wav", events: "C:/tmp/01-events.json" }), ["sfx", "--out", "carrosseis/demo/audio/01-sfx.wav", "--events", "C:/tmp/01-events.json"]);
  assert.deepEqual(engineArgs.render({ page: "carrosseis/demo/slides/01.html", out: "carrosseis/demo/renders/01.mp4", format: "4:5", fps: 30, sub: 2 }), ["render", "carrosseis/demo/slides/01.html", "--out", "carrosseis/demo/renders/01.mp4", "--format", "4:5", "--fps", "30", "--sub", "2"]);
  assert.deepEqual(engineArgs.render({ page: "p.html", out: "previa/01-video.mp4", format: "4:5", fps: 30, sub: 2, preview: true }), ["preview", "p.html", "--out", "previa/01-video.mp4", "--format", "4:5", "--fps", "30"]);
  assert.deepEqual(
    engineArgs.mix({ video: "carrosseis/demo/renders/01.mp4", out: "carrosseis/demo/out/01.mp4", music: "carrosseis/demo/audio/music.wav", musicOffset: 6, sfx: "carrosseis/demo/audio/01-sfx.wav" }),
    ["mix", "--video", "carrosseis/demo/renders/01.mp4", "--out", "carrosseis/demo/out/01.mp4", "--music", "carrosseis/demo/audio/music.wav", "--music-offset", "6", "--sfx", "carrosseis/demo/audio/01-sfx.wav", "--fade-out", "0"],
  );
  assert.deepEqual(engineArgs.mix({ video: "v.mp4", out: "o.mp4", music: "m.wav", musicOffset: 0 }), ["mix", "--video", "v.mp4", "--out", "o.mp4", "--music", "m.wav", "--music-offset", "0", "--fade-out", "0"]);
  assert.deepEqual(
    engineArgs.accept({ page: "carrosseis/demo/slides/01.html", format: "4:5", beats: "carrosseis/demo/audio/music.beats.json", video: "carrosseis/demo/out/01.mp4" }),
    ["accept", "carrosseis/demo/slides/01.html", "--format", "4:5", "--safe", "instagram-carousel", "--loop", "--beats", "carrosseis/demo/audio/music.beats.json", "--min-text", "44", "--video", "carrosseis/demo/out/01.mp4", "--still-by", "mean"],
  );
  assert.deepEqual(engineArgs.accept({ page: "p.html", format: "3:4", bpm: 120 }), ["accept", "p.html", "--format", "3:4", "--safe", "instagram-carousel", "--loop", "--bpm", "120", "--min-text", "44"]);
});

test("parseEngineOutput reads the JSON and turns the Motor's failures into AppErrors", () => {
  assert.deepEqual(parseEngineOutput('{"ok":true,"command":"check","modes":{"render":true}}\n', ""), { ok: true, command: "check", modes: { render: true } });
  assert.equal(parseEngineOutput('ruído antes\n{"ok":true,"file":"x"}', "").file, "x", "text before the JSON is ignored");
  assert.throws(
    () => parseEngineOutput('{"ok":false,"command":"render","error":{"code":"page_error","message":"A página deu erro.","fix":"Corrija."}}', ""),
    (error) => error instanceof AppError && error.code === "page_error" && error.message === "A página deu erro." && error.fix === "Corrija.",
  );
  assert.throws(() => parseEngineOutput("", "TypeError: boom\n    at x", { code: 1, command: "synth" }), (error) => error.code === "video_render_failed" && /synth/.test(error.message) && /boom/.test(error.fix));
  assert.throws(() => parseEngineOutput("{not json", "", { code: 0 }), (error) => error.code === "video_render_failed");
});

test("runEngine runs the Motor, passes its progress through and propagates its errors", async (t) => {
  const dir = scratch(t);
  const ok = join(dir, "ok.mjs");
  writeFileSync(ok, 'process.stderr.write("Render: 1/2\\nRender: 2/2\\n"); process.stdout.write(JSON.stringify({ ok: true, command: process.argv[2], args: process.argv.slice(3), cwd: process.cwd() }) + "\\n");');
  const lines = [];
  const result = await runEngine({ script: ok }, ["render", "p.html", "--out", "x.mp4"], { root: dir, onLine: (line) => lines.push(line) });
  assert.deepEqual(result.args, ["p.html", "--out", "x.mp4", "--json"], "--json is appended");
  assert.equal(resolve(result.cwd), resolve(dir), "runs from the project root");
  assert.deepEqual(lines, ["Render: 1/2", "Render: 2/2"]);
  const bad = join(dir, "bad.mjs");
  writeFileSync(bad, 'process.stdout.write(JSON.stringify({ ok: false, command: "render", error: { code: "page_error", message: "A página deu erro.", fix: "Corrija." } })); process.exit(1);');
  await assert.rejects(runEngine({ script: bad }, ["render"], { root: dir, onLine: () => {} }), (error) => error instanceof AppError && error.code === "page_error" && error.fix === "Corrija.");
  const crash = join(dir, "crash.mjs");
  writeFileSync(crash, 'process.stderr.write("TypeError: boom\\n"); process.exit(1);');
  await assert.rejects(runEngine({ script: crash }, ["check"], { root: dir, onLine: () => {} }), (error) => error.code === "video_render_failed" && /boom/.test(error.fix));
});

test("findVideoRender, slugOf and carouselDir", (t) => {
  const root = scratch(t);
  assert.equal(findVideoRender(root).installed, false);
  const dir = join(root, ".flyee", "modules", "video-render");
  mkdirSync(join(dir, "scripts"), { recursive: true });
  writeFileSync(join(dir, "scripts", "render.mjs"), "");
  writeFileSync(join(dir, "flyee.module.json"), JSON.stringify({ name: "video-render", version: "1.2.3" }));
  const found = findVideoRender(root);
  assert.equal(found.installed, true);
  assert.equal(found.version, "1.2.3");
  assert.equal(found.command, "node .flyee/modules/video-render/scripts/render.mjs");
  assert.equal(slugOf("carrosseis/Academia em Fevereiro/"), "academia-em-fevereiro");
  assert.equal(slugify("???"), "carrossel");
  assert.throws(() => slugOf(""), (error) => error.code === "usage");
  assert.deepEqual(carouselDir(root, "demo"), { dir: join(root, "carrosseis", "demo"), slug: "demo" });
  mkdirSync(join(root, "carrosseis", "feito"), { recursive: true });
  writeFileSync(join(root, "carrosseis", "feito", "storyboard.json"), "{}");
  assert.deepEqual(carouselDir(root, "carrosseis/feito"), { dir: resolve(root, "carrosseis", "feito"), slug: "feito" });
  assert.deepEqual(parseArgs(["demo", "--slides", "1,3", "--preview"], { flags: ["preview"], options: ["slides"] }), { positionals: ["demo"], values: { slides: "1,3", preview: true } });
});

/* ---------- scratch projects ---------- */

function copyModule(source, target) {
  copyTree(source, target, (name, path) => ["tests", ".dev", "node_modules"].includes(name) || path.endsWith(".dev.md"));
}

/** Stand-in runtime files, so `new` can be tested without the real templates. */
function writeFakeRuntime(appDir) {
  const slide = (role) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body><canvas id="c"></canvas>
<script src="../motion.js"></script><script src="../carousel.js"></script>
<script>
window.SLIDE = { role: "${role}", title: "__TITLE__", text: "__TEXT__", bars: __BARS__, beatsPerBar: __BEATS_PER_BAR__, bpm: __BPM__, theme: __THEME__, seed: __SEED__, n: __N__, total: __TOTAL__, totalBars: __TOTAL_BARS__, offsetBars: __OFFSET_BARS__, format: "__FORMAT__" };
</script></body></html>
`;
  mkdirSync(join(appDir, "runtime", "slides"), { recursive: true });
  for (const role of ROLES) writeFileSync(join(appDir, "runtime", "slides", `${role}.html`), slide(role));
  writeFileSync(join(appDir, "runtime", "carousel.js"), "// stand-in carousel.js\n");
  writeFileSync(join(appDir, "runtime", "preview.html"), "<!doctype html><html><body><script>const CAROUSEL = /*__CAROUSEL__*/ null;</script></body></html>\n");
}

/**
 * A stand-in Motor de vídeo: the interface's command lines, stub files where the real ones
 * would go, spec-shaped answers and a log of every call (engine-log.json in the project root).
 * A page with "QUEBRA" fails to render like a page with a JavaScript error; one with "SEM_CAPA"
 * fails first_frame_readable; a track whose name has "lento" is measured 3 BPM under the hint.
 */
const STAND_IN_ENGINE = `
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const [command = "help", ...rest] = process.argv.slice(2);
const values = {};
const positionals = [];
for (let i = 0; i < rest.length; i++) {
  const arg = rest[i];
  if (!arg.startsWith("--")) { positionals.push(arg); continue; }
  const name = arg.slice(2);
  const next = rest[i + 1];
  if (next === undefined || next.startsWith("--")) values[name] = true;
  else { values[name] = next; i++; }
}
const write = (file, content) => { mkdirSync(dirname(resolve(file)), { recursive: true }); writeFileSync(file, content); };
const logFile = "engine-log.json";
const log = existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : [];
log.push([command, ...rest.filter((arg) => arg !== "--json")]);
writeFileSync(logFile, JSON.stringify(log, null, 2));
const fail = (code, message, fix = "") => { process.stdout.write(JSON.stringify({ ok: false, command, error: { code, message, fix } })); process.exit(code === "usage" ? 2 : 1); };
const pageDuration = (page) => {
  const html = readFileSync(page, "utf8");
  const bars = Number(/bars: (\\d+)/.exec(html)?.[1] ?? 3);
  const bpm = Number(/bpm: (\\d+)/.exec(html)?.[1] ?? 120);
  return (bars * 4 * 60) / bpm;
};
const requirePage = () => {
  const page = positionals[0];
  if (!page || !existsSync(page)) fail("file_not_found", "Não encontrei a página HTML: " + page + ".");
  return page;
};
process.stderr.write("stand-in " + command + "\\n");
let result;
switch (command) {
  case "check":
    result = { modes: { render: true, alpha: true, sheets: true }, tools: { ffmpeg: "stand-in", ffprobe: "stand-in", browser: { name: "stand-in", path: "stand-in" } }, install: {}, install_note: null };
    break;
  case "synth": {
    const bpm = Number(values.bpm); const bars = Number(values.bars); const bpb = Number(values["beats-per-bar"] ?? 4);
    if (!values.out || !bpm || !bars) fail("usage", "Informe --out, --bpm e --bars.");
    const beatS = 60 / bpm; const duration = bars * bpb * beatS;
    const beats = Array.from({ length: bars * bpb }, (_, i) => i * beatS); const downbeats = beats.filter((_, i) => i % bpb === 0);
    write(values.out, "RIFF stand-in");
    const beatsFile = values.out.replace(/\\.wav$/i, ".beats.json");
    write(beatsFile, JSON.stringify({ bpm, offset: 0, beats_per_bar: bpb, bars, duration, beats, downbeats }));
    result = { file: values.out, beats_file: beatsFile, bpm, bars, beats_per_bar: bpb, beat_s: beatS, bar_s: beatS * bpb, duration, style: values.style, seed: Number(values.seed ?? 1), intro_bars: Number(values["intro-bars"] ?? 0), sample_rate: 48000, channels: 2, lufs: -16, true_peak_dbtp: -1.2, beats, downbeats, warnings: [] };
    break;
  }
  case "beats": {
    const file = positionals[0];
    if (!file || !existsSync(file)) fail("file_not_found", "Não encontrei o áudio: " + file + ".");
    const hint = Number(values.bpm ?? 120); const bpm = /lent[ao]/.test(file) ? hint - 3 : hint; const beatS = 60 / bpm; const offset = 0.25; const duration = 60;
    const beats = []; for (let t = offset; t < duration; t += beatS) beats.push(Math.round(t * 1000) / 1000);
    const downbeats = beats.filter((_, i) => i % 4 === 0);
    const grid = { bpm, offset, beats_per_bar: 4, bars: downbeats.length, duration, beats, downbeats, confidence: 0.8, source: file };
    write(values.out, JSON.stringify(grid));
    result = { file: values.out, ...grid };
    break;
  }
  case "sfx": {
    if (!values.events || !existsSync(values.events)) fail("usage", "Informe --events.");
    const events = JSON.parse(readFileSync(values.events, "utf8"));
    write(values.out, "RIFF stand-in");
    write(values.out + ".received.json", JSON.stringify(events));
    result = { file: values.out, duration: events.duration, events: events.events.length, types: [...new Set(events.events.map((event) => event.type))], warnings: [] };
    break;
  }
  case "render":
  case "preview": {
    const page = requirePage();
    const html = readFileSync(page, "utf8");
    if (html.includes("QUEBRA")) fail("page_error", "A página deu erro ao carregar: ReferenceError: quebra", "Corrija o JavaScript da página e renderize de novo.");
    const duration = pageDuration(page); const fps = Number(values.fps ?? 30); const preview = command === "preview";
    write(values.out, "MP4 stand-in " + command + " " + page);
    result = { page, file: values.out, width: preview ? 540 : 1080, height: preview ? 675 : 1350, fps, subframes: Number(values.sub ?? 1), frames: Math.round(duration * fps), duration, format: values.format, frames_hash: createHash("sha256").update(html).digest("hex"), film: { duration, fps }, warnings: [] };
    break;
  }
  case "mix": {
    if (!values.video || !existsSync(values.video)) fail("file_not_found", "Não encontrei o vídeo: " + values.video + ".");
    if (!values.music || !existsSync(values.music)) fail("file_not_found", "Não encontrei a música: " + values.music + ".");
    if (values.sfx && !existsSync(values.sfx)) fail("file_not_found", "Não encontrei os efeitos: " + values.sfx + ".");
    write(values.out, "MP4 stand-in mix " + values.video + " @" + values["music-offset"]);
    result = { file: values.out, duration: 6, loudness: { integrated_lufs: -14.1, true_peak_dbtp: -1.1, range_lu: 3.2 }, sources: { music: values.music, music_offset: Number(values["music-offset"] ?? 0), sfx: values.sfx ?? null }, warnings: [] };
    break;
  }
  case "accept": {
    const page = requirePage();
    const html = readFileSync(page, "utf8");
    const duration = pageDuration(page);
    const withVideo = values.video ? "pass" : "skip";
    const checks = [
      { name: "page", status: "pass", summary: "A página carrega e define seek.", details: [] },
      { name: "first_frame_readable", status: html.includes("SEM_CAPA") ? "fail" : "pass", summary: html.includes("SEM_CAPA") ? "Nenhum texto legível no quadro 0." : "O quadro 0 tem texto legível.", details: [] },
      { name: "safe_area", status: "pass", summary: "Tudo dentro da área segura.", details: [] },
      { name: "text_size", status: "pass", summary: "Texto acima do mínimo.", details: [] },
      { name: "cuts_on_beat", status: "skip", summary: "A página não declara cortes.", details: [] },
      { name: "loop_seamless", status: "pass", summary: "O último quadro emenda com o primeiro.", details: [] },
      { name: "flashes", status: withVideo, summary: withVideo === "pass" ? "Sem piscadas." : "Sem --video.", details: [] },
      { name: "dead_time", status: withVideo, summary: withVideo === "pass" ? "Sempre algo se mexe." : "Sem --video.", details: [] },
    ];
    result = { page, format: values.format, width: 1080, height: 1350, duration, fps: 30, safe: values.safe, min_text: Number(values["min-text"] ?? 44), beats: values.beats ?? null, bpm: values.bpm ?? null, video: values.video ?? null, passed: !checks.some((check) => check.status === "fail"), checks, warnings: [] };
    break;
  }
  default:
    fail("usage", "Comando desconhecido: " + command + ".");
}
process.stdout.write(JSON.stringify({ ok: true, command, interface_version: 1, app: { name: "video-render", version: "9.9.9" }, ...result }, null, 2) + "\\n");
`;

function writeStandInEngine(root) {
  const dir = join(root, ".flyee", "modules", "video-render");
  mkdirSync(join(dir, "scripts"), { recursive: true });
  mkdirSync(join(dir, "runtime"), { recursive: true });
  writeFileSync(join(dir, "scripts", "render.mjs"), STAND_IN_ENGINE);
  writeFileSync(join(dir, "runtime", "motion.js"), "// stand-in motion.js\n");
  writeFileSync(join(dir, "flyee.module.json"), JSON.stringify({ name: "video-render", version: "9.9.9" }));
}

/** A project as a member would have it: .flyee/modules/{video-render,motion-carousel}. */
function makeProject(t, { engine = "copy", runtime = "fake" } = {}) {
  const root = scratch(t);
  const modules = join(root, ".flyee", "modules");
  if (engine === "copy") copyModule(VIDEO_RENDER_DIR, join(modules, "video-render"));
  else if (engine === "stand-in") writeStandInEngine(root);
  const appDir = join(modules, "motion-carousel");
  mkdirSync(appDir, { recursive: true });
  copyTree(join(APP_DIR, "scripts"), join(appDir, "scripts"));
  copyFileSync(join(APP_DIR, "flyee.module.json"), join(appDir, "flyee.module.json"));
  if (runtime === "real") {
    copyTree(join(APP_DIR, "runtime"), join(appDir, "runtime"));
    copyTree(join(APP_DIR, "references"), join(appDir, "references"));
  } else writeFakeRuntime(appDir);
  const logFile = join(root, "engine-log.json");
  return {
    root,
    appDir,
    script: join(appDir, "scripts", "carousel.mjs"),
    dirOf: (slug) => join(root, "carrosseis", slug),
    readLog: () => (existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : []),
    clearLog: () => rmSync(logFile, { force: true }),
  };
}

/** Runs a script as the member's AI would, with --json, from the project root. */
function runJson(project, script, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [script, ...args, "--json"], { cwd: project.root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => {
      let json = null;
      try {
        json = JSON.parse(stdout);
      } catch {
        // not JSON: the assertions show stdout and stderr
      }
      resolvePromise({ code, json, stdout, stderr });
    });
  });
}

const cli = (project, args) => runJson(project, project.script, args);
const readJsonFile = (path) => JSON.parse(readFileSync(path, "utf8"));

test("the CLI without the Motor: check says so, new refuses, bad input exits 2", { timeout: 60000 }, async (t) => {
  const project = makeProject(t, { engine: "none", runtime: "fake" });
  const checked = await cli(project, ["check"]);
  assert.equal(checked.code, 0, checked.stdout + checked.stderr);
  assert.equal(checked.json.ok, true);
  assert.equal(checked.json.command, "check");
  assert.equal(checked.json.video_render.installed, false);
  // first what the Motor declares, then, with the member's yes, the install itself
  assert.equal(checked.json.video_render.install_dry_run, "npx --yes flyee@latest add video-render --dry-run --json");
  assert.equal(checked.json.video_render.install, "npx --yes flyee@latest add video-render --yes --json");
  assert.equal(checked.json.modes.render, false);
  assert.equal(checked.json.guides.storyboard, ".flyee/modules/motion-carousel/references/storyboard.md");
  assert.equal(checked.json.guides.example, ".flyee/modules/motion-carousel/references/exemplo");
  const made = await cli(project, ["new", "demo"]);
  assert.equal(made.code, 1);
  assert.equal(made.json.ok, false);
  assert.equal(made.json.error.code, "video_render_missing");
  assert.match(made.json.error.fix, /npx --yes flyee@latest add video-render --dry-run --json/);
  assert.match(made.json.error.fix, /npx --yes flyee@latest add video-render --yes --json/);
  const unknown = await cli(project, ["dance"]);
  assert.equal(unknown.code, 2);
  assert.equal(unknown.json.error.code, "usage");
  const noName = await cli(project, ["render"]);
  assert.equal(noName.code, 2);
  const missing = await cli(project, ["render", "nope"]);
  assert.equal(missing.code, 1);
  assert.equal(missing.json.error.code, "carousel_not_found");
  const opened = await cli(project, ["open", "nope"]);
  assert.equal(opened.json.error.code, "carousel_not_found");
  const help = await cli(project, ["help"]);
  assert.equal(help.code, 0);
  assert.equal(help.json.command, "help");
  assert.match(help.json.text, /Comandos/);
  assert.doesNotMatch(help.json.text, /no seu terminal|winget install|brew install|apt install/i);
});

test("new creates the folder, copies the runtimes, fills the templates, refuses to overwrite", { timeout: 120000 }, async (t) => {
  const project = makeProject(t, { engine: "copy", runtime: "fake" });
  const checked = await cli(project, ["check"]);
  assert.equal(checked.code, 0, checked.stdout + checked.stderr);
  assert.equal(checked.json.video_render.installed, true);
  assert.equal(checked.json.video_render.version, "1.0.0");
  assert.equal(checked.json.video_render.check?.command, "check");
  assert.equal(typeof checked.json.modes.render, "boolean");
  assert.equal(checked.json.runtime.complete, false, "the stand-in runtime has no example");

  const made = await cli(project, ["new", "Academia em Fevereiro", "--slides", "3", "--title", "Fevereiro mata academias.", "--theme", "cobalt", "--style", "upbeat"]);
  assert.equal(made.code, 0, made.stdout + made.stderr);
  const r = made.json;
  assert.equal(r.ok, true);
  assert.equal(r.slug, "academia-em-fevereiro");
  assert.equal(r.dir, "carrosseis/academia-em-fevereiro");
  assert.equal(r.storyboard, "carrosseis/academia-em-fevereiro/storyboard.json");
  assert.equal(r.brief, "carrosseis/academia-em-fevereiro/brief.md");
  assert.equal(r.slides.length, 3);
  assert.equal(r.total_bars, 10);
  assert.equal(r.total_duration, 20);
  assert.deepEqual(r.next, [`${ENGINE_SCRIPT} render academia-em-fevereiro --preview --json`, `${ENGINE_SCRIPT} accept academia-em-fevereiro --json`]);
  const dir = project.dirOf("academia-em-fevereiro");
  for (const file of ["storyboard.json", "brief.md", "motion.js", "carousel.js", "slides/01.html", "slides/02.html", "slides/03.html"]) assert.ok(existsSync(join(dir, file)), file);
  for (const sub of ["assets", "audio", "renders", "out", "previa"]) assert.ok(existsSync(join(dir, sub)), sub);
  const storyboard = validateStoryboard(readJsonFile(join(dir, "storyboard.json")));
  assert.deepEqual(storyboard.slides.map((slide) => slide.role), ["hook", "point", "cta"]);
  assert.deepEqual(storyboard.slides.map((slide) => slide.bars), [3, 3, 4]);
  assert.equal(storyboard.theme, "cobalt");
  assert.equal(storyboard.sound.style, "upbeat");
  assert.equal(storyboard.title, "Fevereiro mata academias.");
  assert.equal(storyboard.slides[0].title, "Fevereiro mata academias.");
  const html = readFileSync(join(dir, "slides", "02.html"), "utf8");
  assert.ok(!/__[A-Z_]+__/.test(html), "every placeholder is filled");
  assert.ok(html.includes("n: 2") && html.includes("total: 3") && html.includes("totalBars: 10") && html.includes("offsetBars: 3") && html.includes('theme: "cobalt"') && html.includes('format: "4:5"'), html);
  assert.equal(readFileSync(join(dir, "motion.js"), "utf8"), readFileSync(join(VIDEO_RENDER_DIR, "runtime", "motion.js"), "utf8"), "motion.js comes from the Motor");
  const brief = readFileSync(join(dir, "brief.md"), "utf8");
  assert.ok(brief.startsWith("# Fevereiro mata academias."));
  assert.ok(brief.includes("## Estrutura dos slides"));

  const again = await cli(project, ["new", "academia-em-fevereiro"]);
  assert.equal(again.code, 1);
  assert.equal(again.json.error.code, "exists");
  const forced = await cli(project, ["new", "academia-em-fevereiro", "--force", "--slides", "2"]);
  assert.equal(forced.code, 0, forced.stdout + forced.stderr);
  assert.equal(forced.json.slides.length, 2);
  assert.equal(forced.json.title, "Academia em fevereiro");
  const tooShort = await cli(project, ["new", "curto", "--bars", "1"]);
  assert.equal(tooShort.code, 1);
  assert.equal(tooShort.json.error.code, "storyboard_invalid");
  assert.match(tooShort.json.error.message, /slides\[0\]\.bars/);
  const mismatch = await cli(project, ["new", "x", "--roles", "hook,cta", "--slides", "3"]);
  assert.equal(mismatch.code, 2);
  assert.equal(mismatch.json.error.code, "usage");
  const badRole = await cli(project, ["new", "x", "--roles", "hook,intro,cta"]);
  assert.equal(badRole.json.error.code, "usage");
  const noPreview = await cli(project, ["open", "academia-em-fevereiro"]);
  assert.equal(noPreview.json.error.code, "preview_missing");
});

test("new with the real templates and --from-example with the worked example (needs the runtime files)", { timeout: 120000 }, async (t) => {
  const missing = missingRuntime(APP_DIR, ["carousel", "templates", "example"]);
  if (missing.length) {
    t.skip(`faltam arquivos do runtime do motion-carousel: ${missing.join(", ")}`);
    return;
  }
  const project = makeProject(t, { engine: "copy", runtime: "real" });
  const made = await cli(project, ["new", "modelo", "--slides", "3", "--title", "Título com \"aspas\""]);
  assert.equal(made.code, 0, made.stdout + made.stderr);
  for (const slide of made.json.slides) {
    const html = readFileSync(join(project.root, slide.file), "utf8");
    assert.ok(!/__[A-Z_]+__/.test(html), `${slide.file} still has a placeholder`);
    assert.ok(html.includes("../motion.js") && html.includes("../carousel.js"), `${slide.file} loads the runtimes`);
  }
  assert.ok(readFileSync(join(project.root, made.json.slides[0].file), "utf8").includes('Título com \\"aspas\\"'));

  const example = await cli(project, ["new", "exemplo", "--from-example"]);
  assert.equal(example.code, 0, example.stdout + example.stderr);
  assert.equal(example.json.from_example, true);
  assert.ok(example.json.slides.length >= 2);
  const dir = project.dirOf("exemplo");
  assert.ok(existsSync(join(dir, "brief.md")));
  for (const slide of example.json.slides) assert.ok(existsSync(join(project.root, slide.file)), slide.file);
  const storyboard = validateStoryboard(readJsonFile(join(dir, "storyboard.json")));
  assert.equal(storyboard.slides.length, example.json.slides.length);
  const two = await cli(project, ["new", "dois", "--from-example", "--slides", "2"]);
  assert.equal(two.code, 0, two.stdout + two.stderr);
  assert.equal(two.json.slides.length, 2);
  assert.ok(two.json.warnings.some((warning) => /cortado/.test(warning)));
});

/* ---------- render and accept against the stand-in Motor ---------- */

test("render with the stand-in Motor: music, slides, mix, preview, state and reuse", { timeout: 180000 }, async (t) => {
  const project = makeProject(t, { engine: "stand-in", runtime: "fake" });
  const checked = await cli(project, ["check"]);
  assert.equal(checked.code, 0, checked.stdout + checked.stderr);
  assert.equal(checked.json.modes.render, true);
  assert.equal(checked.json.video_render.version, "9.9.9");
  const made = await cli(project, ["new", "demo", "--slides", "3", "--title", "Demo", "--style", "pulse", "--seed", "3"]);
  assert.equal(made.code, 0, made.stdout + made.stderr);
  const dir = project.dirOf("demo");
  project.clearLog();

  // 1. the preview of every slide
  const first = await cli(project, ["render", "demo", "--preview"]);
  assert.equal(first.code, 0, first.stdout + first.stderr);
  const r = first.json;
  assert.equal(r.ok, true);
  assert.equal(r.mode, "previa");
  assert.deepEqual(r.rendered, [1, 2, 3]);
  assert.deepEqual(r.reused, []);
  assert.deepEqual(r.pending, []);
  assert.equal(r.total_bars, 10);
  assert.equal(r.total_duration, 20);
  assert.deepEqual(r.slides.map((slide) => slide.music_offset), [0, 6, 12]);
  assert.deepEqual(r.slides.map((slide) => slide.file), ["carrosseis/demo/previa/01.mp4", "carrosseis/demo/previa/02.mp4", "carrosseis/demo/previa/03.mp4"]);
  assert.deepEqual(r.slides.map((slide) => slide.duration), [6, 6, 8]);
  assert.deepEqual(r.slides.map((slide) => slide.status), ["rendered", "rendered", "rendered"]);
  assert.equal(r.slides[0].loudness.integrated_lufs, -14.1);
  assert.equal(r.music.source, "synth");
  assert.equal(r.music.style, "pulse");
  assert.equal(r.music.seed, 3);
  assert.equal(r.music.bars, 10);
  assert.equal(r.music.start, 0);
  assert.equal(r.music.reused, false);
  assert.equal(r.music.file, "carrosseis/demo/audio/music.wav");
  assert.equal(r.preview, "carrosseis/demo/preview.html");
  assert.equal(r.state, "carrosseis/demo/carousel.json");
  assert.equal(r.next, `${ENGINE_SCRIPT} accept demo --json`);
  assert.equal(typeof r.elapsed_s, "number");
  const log = project.readLog();
  assert.deepEqual(log[0], ["synth", "--out", "carrosseis/demo/audio/music.wav", "--bpm", "120", "--bars", "10", "--style", "pulse", "--seed", "3", "--intro-bars", "0"]);
  assert.deepEqual(log[1], ["preview", "carrosseis/demo/slides/01.html", "--out", "carrosseis/demo/previa/01-video.mp4", "--format", "4:5", "--fps", "30"]);
  assert.deepEqual(log[2], ["mix", "--video", "carrosseis/demo/previa/01-video.mp4", "--out", "carrosseis/demo/previa/01.mp4", "--music", "carrosseis/demo/audio/music.wav", "--music-offset", "0", "--fade-out", "0"]);
  assert.deepEqual(log[4], ["mix", "--video", "carrosseis/demo/previa/02-video.mp4", "--out", "carrosseis/demo/previa/02.mp4", "--music", "carrosseis/demo/audio/music.wav", "--music-offset", "6", "--fade-out", "0"]);
  assert.equal(log.length, 7, "synth + 3 × (preview, mix); no sfx without events");
  for (const file of ["audio/music.wav", "audio/music.beats.json", "previa/01-video.mp4", "previa/01.mp4", "previa/03.mp4", "preview.html", "carousel.json"]) assert.ok(existsSync(join(dir, file)), file);
  const preview = readFileSync(join(dir, "preview.html"), "utf8");
  assert.ok(preview.includes('"mode":"previa"') && preview.includes("previa/02.mp4") && !preview.includes("/*__CAROUSEL__*/"), "preview.html carries the carousel data");
  const state = readJsonFile(join(dir, "carousel.json"));
  assert.equal(state.mode, "previa");
  assert.equal(state.previa.length, 3);
  assert.deepEqual(state.slides, []);
  assert.equal(state.music.hash, r.music.hash);
  assert.equal(state.title, "Demo");

  // 2. nothing changed: everything is reused and the Motor is not called
  project.clearLog();
  const second = await cli(project, ["render", "demo", "--preview"]);
  assert.equal(second.code, 0, second.stdout + second.stderr);
  assert.deepEqual(second.json.reused, [1, 2, 3]);
  assert.deepEqual(second.json.rendered, []);
  assert.equal(second.json.music.reused, true);
  assert.deepEqual(project.readLog(), [], "no engine call when nothing changed");

  // 3. one page changes: it is pending until it is selected, and only it is rendered
  appendFileSync(join(dir, "slides", "02.html"), "\n<!-- mudou -->\n");
  const partial = await cli(project, ["render", "demo", "--preview", "--slides", "1"]);
  assert.equal(partial.code, 0, partial.stdout + partial.stderr);
  assert.deepEqual(partial.json.reused, [1]);
  assert.deepEqual(partial.json.rendered, []);
  assert.deepEqual(partial.json.pending, [2]);
  assert.equal(partial.json.slides[1].status, "kept");
  assert.equal(partial.json.slides[1].stale, true);
  assert.equal(partial.json.slides[2].status, "kept");
  assert.equal(partial.json.slides[2].stale, false);
  assert.ok(partial.json.warnings.some((warning) => /--slides 2/.test(warning)), JSON.stringify(partial.json.warnings));
  project.clearLog();
  const fixed = await cli(project, ["render", "demo", "--preview", "--slides", "2"]);
  assert.equal(fixed.code, 0, fixed.stdout + fixed.stderr);
  assert.deepEqual(fixed.json.rendered, [2]);
  assert.deepEqual(fixed.json.pending, []);
  assert.deepEqual(project.readLog().map((call) => call[0]), ["preview", "mix"]);

  // 4. events: the sfx is synthesized from beats in seconds and mixed in; the unchanged page is not rendered again
  const storyboard = readJsonFile(join(dir, "storyboard.json"));
  storyboard.slides[0].events = [{ beat: 0.5, type: "impact" }, { beat: 8, type: "whoosh", direction: "out", gain_db: -6 }];
  writeFileSync(join(dir, "storyboard.json"), JSON.stringify(storyboard, null, 2));
  project.clearLog();
  const withEvents = await cli(project, ["render", "demo", "--preview", "--slides", "1"]);
  assert.equal(withEvents.code, 0, withEvents.stdout + withEvents.stderr);
  assert.deepEqual(withEvents.json.rendered, [1]);
  assert.equal(withEvents.json.slides[0].render_reused, true, "the page did not change: only the sound is redone");
  assert.equal(withEvents.json.slides[0].sfx, "carrosseis/demo/audio/01-sfx.wav");
  assert.equal(withEvents.json.slides[0].events, 2);
  const calls = project.readLog();
  assert.deepEqual(calls.map((call) => call[0]), ["sfx", "mix"]);
  assert.equal(calls[0][2], "carrosseis/demo/audio/01-sfx.wav");
  assert.ok(existsSync(calls[0][4]) === false, "the temporary events file is removed afterwards");
  const received = readJsonFile(join(dir, "audio", "01-sfx.wav.received.json"));
  assert.deepEqual(received, { duration: 6, events: [{ t: 0.25, type: "impact" }, { t: 4, type: "whoosh", gain_db: -6, direction: "out" }] });
  assert.equal(calls[1][calls[1].indexOf("--sfx") + 1], "carrosseis/demo/audio/01-sfx.wav");

  // 5. the final render keeps the preview cache, uses renders/ and out/, passes --sub, reuses the music
  project.clearLog();
  const final = await cli(project, ["render", "demo", "--sub", "2"]);
  assert.equal(final.code, 0, final.stdout + final.stderr);
  assert.equal(final.json.mode, "final");
  assert.deepEqual(final.json.rendered, [1, 2, 3]);
  assert.deepEqual(final.json.slides.map((slide) => slide.file), ["carrosseis/demo/out/01.mp4", "carrosseis/demo/out/02.mp4", "carrosseis/demo/out/03.mp4"]);
  assert.deepEqual(final.json.slides.map((slide) => slide.video), ["carrosseis/demo/renders/01.mp4", "carrosseis/demo/renders/02.mp4", "carrosseis/demo/renders/03.mp4"]);
  const finalCalls = project.readLog();
  assert.deepEqual(finalCalls[0], ["render", "carrosseis/demo/slides/01.html", "--out", "carrosseis/demo/renders/01.mp4", "--format", "4:5", "--fps", "30", "--sub", "2"]);
  assert.equal(finalCalls.filter((call) => call[0] === "synth").length, 0, "the music is shared between the preview and the final");
  assert.ok(existsSync(join(dir, "out", "03.mp4")) && existsSync(join(dir, "renders", "03.mp4")));
  const after = readJsonFile(join(dir, "carousel.json"));
  assert.equal(after.mode, "final");
  assert.equal(after.slides.length, 3);
  assert.equal(after.previa.length, 3, "the preview cache survives a final render");
  assert.ok(readFileSync(join(dir, "preview.html"), "utf8").includes("out/01.mp4"));

  // 6. --refresh redoes the music and every slide
  project.clearLog();
  const refreshed = await cli(project, ["render", "demo", "--refresh"]);
  assert.equal(refreshed.code, 0, refreshed.stdout + refreshed.stderr);
  assert.deepEqual(refreshed.json.rendered, [1, 2, 3]);
  assert.equal(project.readLog()[0][0], "synth");

  // 7. a page the Motor cannot render fails with the Motor's own code, message and fix
  appendFileSync(join(dir, "slides", "03.html"), "\n<!-- QUEBRA -->\n");
  const broken = await cli(project, ["render", "demo", "--slides", "3"]);
  assert.equal(broken.code, 1);
  assert.equal(broken.json.error.code, "page_error");
  assert.match(broken.json.error.fix, /Corrija/);

  // 8. the preview exists now; `open` itself is not run here, because it would open a window on this machine
  assert.ok(existsSync(join(dir, "preview.html")));
});

test("accept with the stand-in Motor: per-slide checks, the set's checks and the report", { timeout: 180000 }, async (t) => {
  const project = makeProject(t, { engine: "stand-in", runtime: "fake" });
  const made = await cli(project, ["new", "demo", "--slides", "3"]);
  assert.equal(made.code, 0, made.stdout + made.stderr);
  const dir = project.dirOf("demo");
  project.clearLog();

  // before any render: the grid comes from --bpm, as it always does (each slide starts on a bar)
  const early = await cli(project, ["accept", "demo"]);
  assert.equal(early.code, 0, early.stdout + early.stderr);
  assert.equal(early.json.passed, true);
  assert.deepEqual(project.readLog()[0], ["accept", "carrosseis/demo/slides/01.html", "--format", "4:5", "--safe", "instagram-carousel", "--loop", "--bpm", "120", "--min-text", "44"]);
  assert.deepEqual(early.json.checks.map((check) => check.name), ["slide_count", "durations", "whole_bars", "same_format", "hook_first_frame", "cta_present", "total_duration"]);
  assert.ok(early.json.checks.every((check) => check.status === "pass"), JSON.stringify(early.json.checks));
  assert.equal(early.json.slides.length, 3);
  assert.equal(early.json.slides[0].checks.length, 8);
  assert.deepEqual(early.json.slides[0].failed, []);
  assert.equal(early.json.slides[0].page, "carrosseis/demo/slides/01.html");
  assert.equal(early.json.slides[0].video, null);
  assert.equal(early.json.report, "carrosseis/demo/relatorio.json");
  const report = readJsonFile(join(dir, "relatorio.json"));
  assert.equal(report.passed, true);
  assert.equal(report.slides.length, 3);

  // after a final render: the beats and the video are passed, and only the selected slides run
  const rendered = await cli(project, ["render", "demo"]);
  assert.equal(rendered.code, 0, rendered.stdout + rendered.stderr);
  project.clearLog();
  const full = await cli(project, ["accept", "demo", "--slides", "2,3"]);
  assert.equal(full.code, 0, full.stdout + full.stderr);
  assert.deepEqual(project.readLog()[0], ["accept", "carrosseis/demo/slides/02.html", "--format", "4:5", "--safe", "instagram-carousel", "--loop", "--bpm", "120", "--min-text", "44", "--video", "carrosseis/demo/out/02.mp4", "--still-by", "mean"]);
  assert.equal(full.json.slides.length, 2);
  assert.equal(full.json.checks.find((check) => check.name === "hook_first_frame").status, "skip");
  assert.deepEqual(full.json.warnings, []);
  assert.equal(full.json.slides[0].checks.find((check) => check.name === "flashes").status, "pass", "with the video the frame checks run");

  // a hook whose first frame is not readable fails the set; failed checks are data, not errors
  appendFileSync(join(dir, "slides", "01.html"), "\n<!-- SEM_CAPA -->\n");
  const failed = await cli(project, ["accept", "demo", "--slides", "1"]);
  assert.equal(failed.code, 0, failed.stdout + failed.stderr);
  assert.equal(failed.json.passed, false);
  assert.equal(failed.json.checks.find((check) => check.name === "hook_first_frame").status, "fail");
  assert.deepEqual(failed.json.slides[0].failed, ["first_frame_readable"]);
  assert.equal(failed.json.slides[0].passed, false);
  assert.equal(readJsonFile(join(dir, "relatorio.json")).passed, false);

  // a set that does not end on a call to action only warns; a page longer than its bars fails whole_bars
  const storyboard = readJsonFile(join(dir, "storyboard.json"));
  storyboard.slides[2].role = "point";
  writeFileSync(join(dir, "storyboard.json"), JSON.stringify(storyboard));
  const noCta = await cli(project, ["accept", "demo", "--slides", "2"]);
  assert.equal(noCta.code, 0, noCta.stdout + noCta.stderr);
  assert.equal(noCta.json.checks.find((check) => check.name === "cta_present").status, "warn");
  assert.equal(noCta.json.passed, true);
  storyboard.slides[1].bars = 4;
  writeFileSync(join(dir, "storyboard.json"), JSON.stringify(storyboard));
  const mismatch = await cli(project, ["accept", "demo", "--slides", "2"]);
  assert.equal(mismatch.code, 0, mismatch.stdout + mismatch.stderr);
  const wholeBars = mismatch.json.checks.find((check) => check.name === "whole_bars");
  assert.equal(wholeBars.status, "fail");
  assert.match(wholeBars.details[0], /slide 02/);
  assert.equal(mismatch.json.passed, false);

  // a broken storyboard is refused with the field path
  storyboard.slides[1].bars = 99;
  writeFileSync(join(dir, "storyboard.json"), JSON.stringify(storyboard));
  const invalid = await cli(project, ["accept", "demo"]);
  assert.equal(invalid.code, 1);
  assert.equal(invalid.json.error.code, "storyboard_invalid");
  assert.match(invalid.json.error.message, /slides\[1\]\.bars/);
});

test("render with the member's own track: a free tempo measurement, a warning when it differs, offsets from the first downbeat, measured once", { timeout: 120000 }, async (t) => {
  const project = makeProject(t, { engine: "stand-in", runtime: "fake" });
  const made = await cli(project, ["new", "demo", "--slides", "2"]);
  assert.equal(made.code, 0, made.stdout + made.stderr);
  const dir = project.dirOf("demo");
  const storyboard = readJsonFile(join(dir, "storyboard.json"));
  storyboard.sound.file = "assets/trilha-lenta.wav";
  writeFileSync(join(dir, "storyboard.json"), JSON.stringify(storyboard));
  const missing = await cli(project, ["render", "demo", "--preview"]);
  assert.equal(missing.code, 1);
  assert.equal(missing.json.error.code, "file_not_found");
  assert.match(missing.json.error.message, /sound\.file/);
  writeFileSync(join(dir, "assets", "trilha-lenta.wav"), "RIFF member");
  project.clearLog();
  const r = await cli(project, ["render", "demo", "--preview"]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const log = project.readLog();
  assert.deepEqual(log[0], ["beats", "carrosseis/demo/assets/trilha-lenta.wav", "--out", "carrosseis/demo/audio/music.beats.json"], "the first pass measures freely");
  assert.equal(log.filter((call) => call[0] === "beats").length, 1, "another tempo: no second pass");
  assert.equal(r.json.music.tempo_matches, false);
  assert.equal(r.json.music.source, "file");
  assert.equal(r.json.music.file, "carrosseis/demo/assets/trilha-lenta.wav");
  assert.equal(r.json.music.beats_file, "carrosseis/demo/audio/music.beats.json");
  assert.equal(r.json.music.bpm_detected, 117);
  assert.equal(r.json.music.start, 0.25);
  assert.equal(r.json.music.style, null);
  assert.deepEqual(r.json.slides.map((slide) => slide.music_offset), [0.25, 6.25]);
  assert.ok(r.json.warnings.some((warning) => /117 BPM/.test(warning)), JSON.stringify(r.json.warnings));
  const mix = log.find((call) => call[0] === "mix");
  assert.equal(mix[mix.indexOf("--music") + 1], "carrosseis/demo/assets/trilha-lenta.wav");
  assert.equal(mix[mix.indexOf("--music-offset") + 1], "0.25");
  project.clearLog();
  const again = await cli(project, ["render", "demo", "--preview"]);
  assert.equal(again.code, 0, again.stdout + again.stderr);
  assert.equal(again.json.music.reused, true, "the beats are measured once");
  assert.deepEqual(project.readLog(), []);

  // a track at the storyboard's tempo: the free pass agrees, a second pass locks the grid, no warning
  writeFileSync(join(dir, "assets", "trilha-certa.wav"), "RIFF member");
  const fitting = readJsonFile(join(dir, "storyboard.json"));
  fitting.sound.file = "assets/trilha-certa.wav";
  writeFileSync(join(dir, "storyboard.json"), JSON.stringify(fitting));
  project.clearLog();
  const locked = await cli(project, ["render", "demo", "--preview"]);
  assert.equal(locked.code, 0, locked.stdout + locked.stderr);
  const passes = project.readLog().filter((call) => call[0] === "beats");
  assert.deepEqual(passes.map((call) => call.slice(-2)), [["--out", "carrosseis/demo/audio/music.beats.json"], ["--bpm", "120"]]);
  assert.equal(locked.json.music.tempo_matches, true);
  assert.equal(locked.json.music.bpm_detected, 120);
  assert.ok(!locked.json.warnings.some((warning) => /BPM e o storyboard/.test(warning)), JSON.stringify(locked.json.warnings));
});

test("new: \\n in --title breaks the hook's title into lines and the carousel's title stays on one line", { timeout: 60000 }, async (t) => {
  const project = makeProject(t, { engine: "stand-in", runtime: "fake" });
  const made = await cli(project, ["new", "linhas", "--slides", "2", "--title", "Fevereiro\\nmata academias."]);
  assert.equal(made.code, 0, made.stdout + made.stderr);
  const storyboard = readJsonFile(join(project.dirOf("linhas"), "storyboard.json"));
  assert.equal(storyboard.title, "Fevereiro mata academias.");
  assert.equal(storyboard.slides[0].title, "Fevereiro\nmata academias.");
  const page = readFileSync(join(project.dirOf("linhas"), "slides", "01.html"), "utf8");
  assert.ok(page.includes('title: "Fevereiro\\nmata academias."'), page.slice(0, 400));
});

/* ---------- end to end through the real Motor ---------- */

/** What the installed Motor still lacks for a carousel, read from its own help text. */
async function engineGaps(project) {
  const script = join(project.root, ".flyee", "modules", "video-render", "scripts", "render.mjs");
  const help = await runJson(project, script, ["help"]);
  const text = help.json?.text ?? "";
  const gaps = [];
  if (!/\bsynth\b/.test(text)) gaps.push("synth");
  if (!/music-offset/.test(text)) gaps.push("mix --music-offset");
  if (!/instagram-carousel/.test(text)) gaps.push("accept --safe instagram-carousel");
  return gaps;
}

test("integration: new --from-example, render --preview, accept through the real Motor (needs ffmpeg, a browser, the runtime and the Motor's synth, mix and accept)", { timeout: 300000 }, async (t) => {
  const { checkTools, findBrowser } = await import(new URL("../../video-render/scripts/lib/tools.mjs", import.meta.url));
  const tools = await checkTools();
  if (!tools.ffmpeg || !tools.ffprobe || !findBrowser()) {
    t.skip("sem ffmpeg ou navegador nesta máquina");
    return;
  }
  const missing = missingRuntime(APP_DIR, ["carousel", "preview", "templates", "example"]);
  if (missing.length) {
    t.skip(`faltam arquivos do runtime do motion-carousel: ${missing.join(", ")}`);
    return;
  }
  const project = makeProject(t, { engine: "copy", runtime: "real" });
  const gaps = await engineGaps(project);
  if (gaps.length) {
    t.skip(`o Motor de vídeo instalado ainda não tem: ${gaps.join(", ")}`);
    return;
  }
  const made = await cli(project, ["new", "demo", "--from-example", "--slides", "2"]);
  assert.equal(made.code, 0, made.stdout + made.stderr);
  assert.equal(made.json.slides.length, 2);
  const dir = project.dirOf("demo");

  const rendered = await cli(project, ["render", "demo", "--preview", "--slides", "1"]);
  assert.equal(rendered.code, 0, rendered.stdout + rendered.stderr);
  const r = rendered.json;
  assert.equal(r.ok, true);
  assert.equal(r.mode, "previa");
  assert.deepEqual(r.rendered, [1]);
  assert.deepEqual(r.reused, []);
  assert.deepEqual(r.pending, [2]);
  assert.equal(r.slides.length, 2);
  assert.equal(r.slides[0].file, "carrosseis/demo/previa/01.mp4");
  assert.equal(r.slides[0].status, "rendered");
  assert.equal(r.slides[0].music_offset, 0);
  assert.match(r.slides[0].frames_hash ?? "", /^[0-9a-f]{64}$/);
  assert.equal(r.slides[1].status, "missing");
  assert.equal(r.music.file, "carrosseis/demo/audio/music.wav");
  assert.equal(r.music.beats_file, "carrosseis/demo/audio/music.beats.json");
  assert.equal(r.music.bars, r.total_bars);
  assert.equal(r.preview, "carrosseis/demo/preview.html");
  for (const file of ["previa/01-video.mp4", "previa/01.mp4", "audio/music.wav", "audio/music.beats.json", "preview.html", "carousel.json"]) assert.ok(existsSync(join(dir, file)), file);
  const preview = readFileSync(join(dir, "preview.html"), "utf8");
  assert.ok(preview.includes("previa/01.mp4") && !preview.includes("/*__CAROUSEL__*/"), "preview.html carries the carousel data");
  const state = readJsonFile(join(dir, "carousel.json"));
  assert.equal(state.mode, "previa");
  assert.equal(state.previa[0].n, 1);
  assert.equal(state.music.hash, r.music.hash);
  assert.ok(r.warnings.every((warning) => !/erro/i.test(warning)), `a página do slide 1 não pode registrar erros: ${JSON.stringify(r.warnings)}`);

  const accepted = await cli(project, ["accept", "demo", "--slides", "1"]);
  assert.equal(accepted.code, 0, accepted.stdout + accepted.stderr);
  const a = accepted.json;
  assert.equal(a.ok, true);
  assert.equal(typeof a.passed, "boolean");
  assert.equal(a.slides.length, 1);
  assert.equal(a.slides[0].n, 1);
  assert.equal(a.slides[0].page, "carrosseis/demo/slides/01.html");
  assert.ok(Array.isArray(a.slides[0].checks) && a.slides[0].checks.length > 0, "the Motor's checks come through");
  for (const item of a.slides[0].checks) assert.ok(["pass", "fail", "warn", "skip"].includes(item.status), JSON.stringify(item));
  assert.deepEqual(a.checks.map((item) => item.name), ["slide_count", "durations", "whole_bars", "same_format", "hook_first_frame", "cta_present", "total_duration"]);
  assert.equal(a.checks.find((item) => item.name === "slide_count").status, "pass");
  assert.equal(a.checks.find((item) => item.name === "durations").status, "pass");
  assert.equal(a.checks.find((item) => item.name === "whole_bars").status, "pass", JSON.stringify(a.checks));
  assert.equal(a.checks.find((item) => item.name === "cta_present").status, "warn", "the example cut to two slides ends on a point");
  assert.equal(a.report, "carrosseis/demo/relatorio.json");
  assert.ok(existsSync(join(dir, "relatorio.json")));

  const again = await cli(project, ["render", "demo", "--preview", "--slides", "1"]);
  assert.equal(again.code, 0, again.stdout + again.stderr);
  assert.deepEqual(again.json.reused, [1], "an unchanged slide is not rendered twice");
  assert.equal(again.json.music.reused, true);
});

test("copyTree copies a folder file by file into a destination with accents (fs.cpSync loses it on Windows)", (t) => {
  const root = scratch(t);
  const source = join(root, "origem");
  mkdirSync(join(source, "sub"), { recursive: true });
  writeFileSync(join(source, "fundo.jpg"), "a");
  writeFileSync(join(source, "sub", "pessoa.png"), "b");
  const target = join(root, "João ação", "assets");
  copyTree(source, target, (name) => name === "pular.txt");
  assert.equal(readFileSync(join(target, "fundo.jpg"), "utf8"), "a");
  assert.equal(readFileSync(join(target, "sub", "pessoa.png"), "utf8"), "b");
});
