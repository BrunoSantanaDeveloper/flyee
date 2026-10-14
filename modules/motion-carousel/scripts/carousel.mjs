#!/usr/bin/env node
// Carrossel animado: the commands the member's AI runs.
//   node .flyee/modules/motion-carousel/scripts/carousel.mjs <command> [options] [--json]
// This script plans the carousel (storyboard, timing, files) and asks the Motor de vídeo
// (video-render) to render, synthesize, mix and check each slide. Only JSON goes to stdout
// with --json; progress goes to stderr; every failure is an error with a stable code.

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { engineArgs, findVideoRender, INSTALL_VIDEO_RENDER, INSTALL_VIDEO_RENDER_DRY_RUN, INSTALL_VIDEO_RENDER_STEPS, requireVideoRender, runEngine } from "./lib/engine.mjs";
import { ASPECTS, generateImage, imageStatus, KEY_DEFAULTS, PROVIDERS } from "./lib/images.mjs";
import { previewData, writePreview } from "./lib/preview.mjs";
import {
  CAROUSELS_DIR,
  carouselDir,
  createCarousel,
  INSTALL_SELF,
  layout,
  loadExample,
  missingRuntime,
  pad,
  readCarousel,
  readState,
  requireRuntime,
  runtimeFiles,
  slugOf,
  writeState,
} from "./lib/project.mjs";
import { buildStoryboard, defaultRoles, eventsToSfx, FORMATS, LIMITS, parseSlideSelection, ROLES, SOUND_STYLES, tempoMatches, THEMES, validateStoryboard } from "./lib/storyboard.mjs";
import {
  AppError,
  displayPath,
  isDir,
  isFile,
  MAC,
  parseArgs,
  parseList,
  parseNumber,
  progress,
  projectRoot,
  readJson,
  removeDir,
  resolveInput,
  round,
  sha256File,
  sha256Text,
  tempDir,
  toPosix,
  usage,
  WINDOWS,
  writeJson,
} from "./lib/util.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(SCRIPTS_DIR, "..");
const ROOT = projectRoot(SCRIPTS_DIR);
const MANIFEST = readJson(join(APP_DIR, "flyee.module.json"), {});
const APP = { name: MANIFEST.name ?? "motion-carousel", version: MANIFEST.version ?? "0.0.0" };
const SCRIPT_COMMAND = `node ${toPosix(ROOT, join(SCRIPTS_DIR, "carousel.mjs"))}`;
const ARG_SPEC = {
  flags: ["json", "preview", "refresh", "force", "from-example", "from-photo-example", "cutout"],
  options: [
    "title", "slides", "roles", "bars", "cta-bars", "bpm", "theme", "style", "format", "seed", "sub",
    "prompt", "out", "provider", "aspect", "reference", "model", "key-color", "key-similarity", "key-blend", "key-mode",
  ],
};
const GUIDES = {
  storyboard: toPosix(ROOT, join(APP_DIR, "references", "storyboard.md")),
  slide_page: toPosix(ROOT, join(APP_DIR, "references", "slide-page.md")),
  design_rules: toPosix(ROOT, join(APP_DIR, "references", "design-rules.md")),
  sound: toPosix(ROOT, join(APP_DIR, "references", "sound.md")),
  images: toPosix(ROOT, join(APP_DIR, "references", "images.md")),
  example: toPosix(ROOT, join(APP_DIR, "references", "exemplo")),
  example_photo: toPosix(ROOT, join(APP_DIR, "references", "exemplo-foto")),
};
const MIN_TEXT = 44;
/** One mark per status in the human output: ✓ passou · ✗ reprovou · △ aviso · ○ não medido (the same as the Motor's). */
const MARKS = { pass: "✓", fail: "✗", warn: "△", skip: "○" };

const rel = (path) => displayPath(ROOT, path);
const engineCall = (engine, args) => runEngine(engine, args, { root: ROOT });

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

async function checkCommand() {
  const engine = findVideoRender(ROOT);
  const warnings = [];
  let check = null;
  if (engine.installed) {
    try {
      check = await engineCall(engine, engineArgs.check());
    } catch (error) {
      warnings.push(`O Motor de vídeo não respondeu ao check: ${error.message}${error.fix ? ` ${error.fix}` : ""}`);
    }
  }
  const missing = missingRuntime(APP_DIR, ["carousel", "preview", "templates", "example", "example-photo"]);
  const missingCore = missingRuntime(APP_DIR, ["carousel", "preview", "templates"]);
  if (missing.length) warnings.push(`Faltam arquivos do app Carrossel animado: ${missing.join(", ")}. Reinstale: rode você mesmo ${INSTALL_SELF}, com tempo limite de 10 minutos.`);
  return {
    project: ROOT,
    video_render: {
      installed: engine.installed,
      path: engine.installed ? rel(engine.script) : null,
      version: engine.version,
      check,
      install_dry_run: INSTALL_VIDEO_RENDER_DRY_RUN,
      install: INSTALL_VIDEO_RENDER,
    },
    modes: { render: Boolean(engine.installed && check?.modes?.render && !missingCore.length) },
    install: { ...(check?.install ?? {}) },
    install_note: check?.install_note ?? null,
    runtime: { complete: missing.length === 0, missing },
    formats: Object.fromEntries(Object.entries(FORMATS).map(([name, size]) => [name, `${size.width}x${size.height}`])),
    images: await imageStatus(),
    guides: GUIDES,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// new
// ---------------------------------------------------------------------------

const titleFromSlug = (slug) => {
  const words = slug.replace(/-+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Carrossel";
};

/** The sample texts of a template slide; the AI replaces them when it writes the slides. */
function sampleTexts(role, { title, hookTitle = title, point }) {
  if (role === "hook") return { title: hookTitle, text: "" };
  if (role === "cta") return { title: "Comente PALAVRA e eu te mando", text: "Salve para rever depois." };
  if (role === "photo") return { title: `Ponto ${point}: uma ideia só`, text: "Uma linha curta.\nOutra linha curta." };
  return { title: `Ponto ${point}: uma ideia só`, text: "Duas linhas curtas que explicam a ideia." };
}

function newCommand(positionals, values) {
  const slug = slugOf(positionals[0]);
  const engine = requireVideoRender(ROOT);
  const photoExample = Boolean(values["from-photo-example"]);
  const fromExample = Boolean(values["from-example"]) || photoExample;
  requireRuntime(APP_DIR, fromExample ? ["carousel", photoExample ? "example-photo" : "example"] : ["carousel", "templates"]);
  const dir = join(ROOT, CAROUSELS_DIR, slug);
  const paths = layout(dir);
  if (isFile(paths.storyboard) && !values.force) {
    throw new AppError("exists", `Já existe o carrossel "${slug}" em ${rel(dir)}.`, "Use outro nome, ou --force para recriar por cima (o storyboard e os slides atuais serão sobrescritos).");
  }
  const warnings = [];
  const count = parseNumber(values.slides, { name: "slides", min: LIMITS.slides[0], max: LIMITS.slides[1], integer: true, fallback: null });
  // `\n` typed in --title breaks the hook's title into lines; the carousel's own title stays on one line
  const titleLines = values.title?.trim() ? values.title.trim().replace(/\\n/g, "\n") : null;
  const title = titleLines ? titleLines.replace(/\s*\n\s*/g, " ") : null;
  let storyboard;
  const texts = {};
  let exampleDir = null;
  if (fromExample) {
    for (const option of ["roles", "bars", "cta-bars", "bpm", "theme", "style", "format", "seed"]) {
      if (values[option] !== undefined) warnings.push(`A opção --${option} é ignorada com --from-example: o exemplo traz os próprios valores.`);
    }
    const example = loadExample(APP_DIR, photoExample ? "photo" : "default");
    exampleDir = example.dir;
    storyboard = example.storyboard;
    if (count !== null && count > storyboard.slides.length) {
      throw usage(`O exemplo tem ${storyboard.slides.length} slides; com --from-example, --slides não pode passar disso.`, `Use --slides de 2 a ${storyboard.slides.length}, ou crie sem --from-example.`);
    }
    if (count !== null && count < storyboard.slides.length) {
      storyboard = validateStoryboard({ ...storyboard, slides: storyboard.slides.slice(0, count) });
      warnings.push(`O exemplo foi cortado nos ${count} primeiros slides; os contadores dentro das páginas ainda dizem ${example.storyboard.slides.length}.`);
    }
    if (title) storyboard = validateStoryboard({ ...storyboard, title });
  } else {
    const roles = values.roles !== undefined ? parseList(values.roles) : defaultRoles(count ?? 5);
    for (const role of roles) if (!ROLES.includes(role)) throw usage(`Papel desconhecido em --roles: ${role}.`, `Use ${ROLES.join(", ")}, na ordem dos slides.`);
    if (count !== null && roles.length !== count) throw usage(`--slides diz ${count} e --roles lista ${roles.length} papéis.`, "Passe só um dos dois, ou os dois com o mesmo número.");
    if (roles.length < LIMITS.slides[0] || roles.length > LIMITS.slides[1]) {
      throw usage(`São ${roles.length} papéis em --roles; um carrossel tem de ${LIMITS.slides[0]} a ${LIMITS.slides[1]} slides.`);
    }
    const bars = parseNumber(values.bars, { name: "bars", min: LIMITS.bars[0], max: LIMITS.bars[1], integer: true, fallback: 3 });
    const ctaBars = parseNumber(values["cta-bars"], { name: "cta-bars", min: LIMITS.bars[0], max: LIMITS.bars[1], integer: true, fallback: 4 });
    const bpm = parseNumber(values.bpm, { name: "bpm", min: LIMITS.bpm[0], max: LIMITS.bpm[1], fallback: 120 });
    const seed = parseNumber(values.seed, { name: "seed", min: 0, max: 2147483647, integer: true, fallback: 7 });
    const theme = values.theme ?? "noir";
    if (!THEMES.includes(theme)) throw usage(`Tema desconhecido: ${theme}.`, `Use ${THEMES.join(", ")}.`);
    const style = values.style ?? "noir";
    if (!SOUND_STYLES.includes(style)) throw usage(`Estilo de trilha desconhecido: ${style}.`, `Use ${SOUND_STYLES.join(", ")}.`);
    const format = values.format ?? "4:5";
    if (!FORMATS[format]) throw usage(`Formato desconhecido: ${format}.`, `Use ${Object.keys(FORMATS).join(", ")}.`);
    const carouselTitle = title ?? titleFromSlug(slug);
    let point = 0;
    const slides = roles.map((role, index) => {
      if (role === "point" || role === "photo") point++;
      const sample = sampleTexts(role, { title: carouselTitle, hookTitle: titleLines ?? carouselTitle, point });
      texts[index + 1] = sample.text;
      return { role, bars: role === "cta" ? ctaBars : bars, title: sample.title };
    });
    storyboard = buildStoryboard({ title: carouselTitle, format, bpm, style, seed, theme, slides });
  }
  const created = createCarousel({ dir, appDir: APP_DIR, engine, storyboard, texts, fromExample, exampleDir, force: Boolean(values.force) });
  return {
    dir: rel(dir),
    slug,
    title: storyboard.title,
    format: storyboard.format,
    bpm: storyboard.bpm,
    beats_per_bar: storyboard.beats_per_bar,
    theme: storyboard.theme,
    style: storyboard.sound.style,
    seed: storyboard.seed,
    from_example: fromExample,
    total_bars: created.times.total_bars,
    total_duration: created.times.total_duration,
    storyboard: rel(created.paths.storyboard),
    brief: rel(created.paths.brief),
    runtime: { motion: rel(created.paths.motion), carousel: rel(created.paths.carousel) },
    slides: created.slides.map((slide) => ({ ...slide, file: rel(slide.file) })),
    next: [`${SCRIPT_COMMAND} render ${slug} --preview --json`, `${SCRIPT_COMMAND} accept ${slug} --json`],
    guides: GUIDES,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

/** The single music track of the carousel: synthesized by the Motor, or the member's own file measured once. */
async function ensureMusic({ carousel, engine, refresh, state, warnings }) {
  const { dir, paths, storyboard, times } = carousel;
  const sound = storyboard.sound;
  const beatsFile = join(paths.audio, "music.beats.json");
  const params = {
    source: sound.file ? "file" : "synth",
    file: sound.file,
    bpm: storyboard.bpm,
    beats_per_bar: storyboard.beats_per_bar,
    bars: times.total_bars,
    style: sound.style,
    seed: sound.seed,
    intro_bars: sound.intro_bars,
  };
  let musicFile;
  let sourceHash = "";
  if (sound.file) {
    musicFile = join(dir, sound.file);
    if (!isFile(musicFile)) {
      throw new AppError("file_not_found", `Não encontrei a música do storyboard (sound.file): ${rel(musicFile)}.`, "Coloque o arquivo na pasta do carrossel e ajuste sound.file no storyboard.json, ou deixe sound.file como null para a trilha sintetizada.");
    }
    sourceHash = sha256File(musicFile);
  } else {
    musicFile = join(paths.audio, "music.wav");
  }
  const hash = sha256Text(JSON.stringify({ ...params, sourceHash, engine: engine.version }));
  const previous = state?.music ?? null;
  const fresh = !refresh && previous?.hash === hash && isFile(musicFile) && isFile(beatsFile);
  let result = null;
  let detected = previous?.bpm_detected ?? null;
  if (!fresh) {
    if (sound.file) {
      // first a free measurement, so a track at another tempo is caught; when it matches (or is
      // the double or the half), a second pass locks the grid on the storyboard's tempo
      progress(`Trilha: medindo o andamento de ${rel(musicFile)}`);
      result = await engineCall(engine, engineArgs.beats({ input: rel(musicFile), out: rel(beatsFile) }));
      detected = Number(result.bpm) || null;
      if (detected !== null && tempoMatches(detected, storyboard.bpm)) {
        progress(`Trilha: ${detected} BPM combina com ${storyboard.bpm}; alinhando as batidas`);
        result = await engineCall(engine, engineArgs.beats({ input: rel(musicFile), out: rel(beatsFile), bpm: storyboard.bpm }));
      }
    } else {
      progress(`Trilha: sintetizando ${times.total_bars} compassos a ${storyboard.bpm} BPM (${sound.style}, semente ${sound.seed})`);
      result = await engineCall(engine, engineArgs.synth({ out: rel(musicFile), bpm: storyboard.bpm, bars: times.total_bars, style: sound.style, seed: sound.seed, introBars: sound.intro_bars, beatsPerBar: storyboard.beats_per_bar }));
    }
    for (const warning of result.warnings ?? []) warnings.push(`Trilha: ${warning}`);
  }
  const beats = readJson(beatsFile, null);
  if (!beats || !Array.isArray(beats.beats)) {
    throw new AppError("video_render_failed", `O Motor de vídeo não gravou as batidas em ${rel(beatsFile)}.`, "Rode de novo com --refresh; se repetir, mostre esta mensagem ao integrante.");
  }
  const start = round(Number(beats.downbeats?.[0] ?? beats.offset ?? 0) || 0, 4);
  const music = {
    file: rel(musicFile),
    beats_file: rel(beatsFile),
    source: params.source,
    bpm: storyboard.bpm,
    beats_per_bar: storyboard.beats_per_bar,
    bars: times.total_bars,
    style: sound.file ? null : sound.style,
    seed: sound.file ? null : sound.seed,
    intro_bars: sound.file ? null : sound.intro_bars,
    start,
    duration: Number(beats.duration ?? result?.duration ?? 0) || null,
    bpm_detected: sound.file ? detected : null,
    tempo_matches: sound.file ? (detected === null ? null : tempoMatches(detected, storyboard.bpm)) : null,
    confidence: sound.file ? (beats.confidence ?? null) : null,
    lufs: result?.lufs ?? previous?.lufs ?? null,
    true_peak_dbtp: result?.true_peak_dbtp ?? previous?.true_peak_dbtp ?? null,
    hash,
    reused: fresh,
  };
  if (sound.file) {
    if (music.tempo_matches === false) {
      warnings.push(`A música tem ${music.bpm_detected} BPM e o storyboard diz ${storyboard.bpm}: os slides vão sair da batida. Ponha bpm: ${Math.round(music.bpm_detected)} no storyboard.json (e nos blocos SLIDE das páginas) ou troque a música.`);
    }
    if (music.confidence !== null && music.confidence < 0.5) warnings.push(`A batida da música não é clara (confiança ${music.confidence}); confira os tempos na prévia ou escolha outra música.`);
    if (music.duration && music.duration < start + times.total_duration - 0.01) {
      warnings.push(`A música termina em ${round(music.duration, 1)} s e o carrossel dura ${round(times.total_duration, 1)} s a partir de ${start} s: os últimos slides ficam sem trilha.`);
    }
  }
  return music;
}

/** The pictures a page loads from the carousel's assets folder, by content: a changed picture renders the slide again. */
function assetsFingerprint(dir, page) {
  let html = "";
  try {
    html = readFileSync(page, "utf8");
  } catch {
    return [];
  }
  const names = new Set();
  for (const match of html.matchAll(/assets\/([^"'`)\s]+)/g)) names.add(match[1]);
  return [...names].sort().map((name) => {
    const file = join(dir, "assets", name);
    return [name, isFile(file) ? sha256File(file) : null];
  });
}

/** What a slide's video depends on: the page, the pictures it loads, the format, the frame rate, the mode and the engine. */
function renderHashOf({ dir, page, storyboard, sub, mode, engine }) {
  return sha256Text(JSON.stringify({ page: sha256File(page), assets: assetsFingerprint(dir, page), format: storyboard.format, fps: storyboard.fps, sub, mode, engine: engine.version }));
}

/** The entry of a slide that was not selected this run: what the previous run left, flagged when its inputs changed. */
function keptEntry({ previous, slide, slot, page, out, video, renderHash, outputHash }) {
  const base = {
    n: slide.n,
    role: slide.role,
    title: slide.title,
    page: rel(page),
    file: rel(out),
    video: rel(video),
    duration: slot.duration,
    bars: slide.bars,
    music_offset: null,
    frames_hash: null,
    events: slide.events.length,
    sfx: null,
    loudness: null,
    render_hash: null,
    output_hash: null,
    status: "missing",
    stale: true,
  };
  if (previous && isFile(out)) {
    return { ...base, ...previous, status: "kept", stale: previous.render_hash !== renderHash || previous.output_hash !== outputHash };
  }
  return base;
}

async function renderSlide({ carousel, engine, slide, slot, mode, sub, refresh, music, previous, temp, warnings }) {
  const { dir, paths, storyboard, times } = carousel;
  const nn = pad(slide.n);
  const preview = mode === "previa";
  const page = join(dir, slide.file);
  const video = preview ? join(paths.previa, `${nn}-video.mp4`) : join(paths.renders, `${nn}.mp4`);
  const out = preview ? join(paths.previa, `${nn}.mp4`) : join(paths.out, `${nn}.mp4`);
  const sfxFile = join(paths.audio, `${nn}-sfx.wav`);
  const musicOffset = round(music.start + slot.music_offset, 4);
  const renderHash = renderHashOf({ dir, page, storyboard, sub: preview ? 1 : sub, mode, engine });
  const outputHash = sha256Text(JSON.stringify({ renderHash, events: slide.events, music: music.hash, offset: musicOffset, duration: slot.duration }));
  const entry = {
    n: slide.n,
    role: slide.role,
    title: slide.title,
    page: rel(page),
    file: rel(out),
    video: rel(video),
    duration: slot.duration,
    bars: slide.bars,
    music_offset: musicOffset,
    frames_hash: previous?.frames_hash ?? null,
    events: slide.events.length,
    sfx: null,
    loudness: previous?.loudness ?? null,
    render_hash: renderHash,
    output_hash: outputHash,
    status: "rendered",
    render_reused: false,
    stale: false,
  };
  const keepRender = !refresh && previous?.render_hash === renderHash && Boolean(previous?.frames_hash) && isFile(video);
  if (keepRender) {
    entry.render_reused = true;
    progress(`Slide ${nn}: render reaproveitado (${rel(video)})`);
  } else {
    progress(`Slide ${nn}: ${preview ? "prévia" : "render"} de ${rel(page)} (${slot.duration} s, ${storyboard.format})`);
    const result = await engineCall(engine, engineArgs.render({ page: rel(page), out: rel(video), format: storyboard.format, fps: storyboard.fps, sub, preview }));
    entry.frames_hash = result.frames_hash ?? null;
    for (const warning of result.warnings ?? []) warnings.push(`Slide ${nn}: ${warning}`);
    const declared = Number(result.film?.duration ?? result.duration);
    if (Number.isFinite(declared) && Math.abs(declared - slot.duration) > 1 / storyboard.fps + 1e-6) {
      warnings.push(`Slide ${nn}: a página dura ${declared} s e o storyboard diz ${slot.duration} s (${slide.bars} compassos de ${times.bar_s} s); ajuste bars no storyboard.json ou o bloco SLIDE da página.`);
    }
  }
  if (keepRender && !refresh && previous?.output_hash === outputHash && isFile(out)) {
    entry.status = "reused";
    entry.sfx = previous.sfx ?? null;
    progress(`Slide ${nn}: mixagem reaproveitada (${rel(out)})`);
    return entry;
  }
  let sfx = null;
  if (slide.events.length) {
    const eventsFile = join(temp, `${nn}-events.json`);
    writeJson(eventsFile, eventsToSfx(slide, times));
    progress(`Slide ${nn}: ${slide.events.length} efeito(s) na batida`);
    const result = await engineCall(engine, engineArgs.sfx({ out: rel(sfxFile), events: eventsFile }));
    for (const warning of result.warnings ?? []) warnings.push(`Slide ${nn}: ${warning}`);
    sfx = sfxFile;
  }
  progress(`Slide ${nn}: mixando a trilha${sfx ? " e os efeitos" : ""} (música a partir de ${musicOffset} s)`);
  const mixed = await engineCall(engine, engineArgs.mix({ video: rel(video), out: rel(out), music: music.file, musicOffset, sfx: sfx ? rel(sfx) : null }));
  for (const warning of mixed.warnings ?? []) warnings.push(`Slide ${nn}: ${warning}`);
  entry.sfx = sfx ? rel(sfx) : null;
  entry.loudness = mixed.loudness ?? null;
  return entry;
}

async function renderCommand(positionals, values) {
  const started = Date.now();
  const carousel = readCarousel(ROOT, positionals[0], { scriptCommand: SCRIPT_COMMAND });
  const engine = requireVideoRender(ROOT);
  requireRuntime(APP_DIR, ["preview"]);
  const { storyboard, times, paths, dir, slug } = carousel;
  const mode = values.preview ? "previa" : "final";
  const refresh = Boolean(values.refresh);
  const sub = parseNumber(values.sub, { name: "sub", min: 1, max: 8, integer: true, fallback: 1 });
  const selected = parseSlideSelection(values.slides, storyboard.slides.length);
  const warnings = [];
  const state = readState(dir);
  const previousEntries = new Map(((mode === "final" ? state?.slides : state?.previa) ?? []).filter((entry) => entry && typeof entry === "object").map((entry) => [entry.n, entry]));
  for (const slide of storyboard.slides) {
    const page = join(dir, slide.file);
    if (!isFile(page)) {
      throw new AppError("file_not_found", `Não encontrei a página do slide ${slide.n}: ${rel(page)}.`, `Confira slides[${slide.n - 1}].file em ${rel(paths.storyboard)} ou escreva a página.`);
    }
  }
  const music = await ensureMusic({ carousel, engine, refresh, state, warnings });
  const temp = tempDir();
  const entries = [];
  // progress is saved slide by slide: a run that is cut off keeps every slide it finished. The slide
  // about to be made leaves the saved state first, so a half-written video is never taken as done.
  const saveProgress = (pending = null) => {
    const done = new Map(entries.map((entry) => [entry.n, entry]));
    const merged = storyboard.slides.map((slide) => (slide.n === pending ? null : (done.get(slide.n) ?? previousEntries.get(slide.n) ?? null))).filter(Boolean);
    writeState(dir, {
      app: APP,
      video_render: engine.version,
      title: storyboard.title,
      format: storyboard.format,
      fps: storyboard.fps,
      bpm: storyboard.bpm,
      beats_per_bar: storyboard.beats_per_bar,
      total_bars: times.total_bars,
      total_duration: times.total_duration,
      music,
      generated_at: new Date().toISOString(),
      mode,
      partial: true,
      slides: mode === "final" ? merged : (state?.slides ?? []),
      previa: mode === "previa" ? merged : (state?.previa ?? []),
    });
  };
  try {
    for (const slide of storyboard.slides) {
      const slot = times.slides[slide.n - 1];
      const previous = previousEntries.get(slide.n) ?? null;
      if (selected.includes(slide.n)) {
        saveProgress(slide.n);
        entries.push(await renderSlide({ carousel, engine, slide, slot, mode, sub, refresh, music, previous, temp, warnings }));
        saveProgress();
        continue;
      }
      const nn = pad(slide.n);
      const preview = mode === "previa";
      const page = join(dir, slide.file);
      const video = preview ? join(paths.previa, `${nn}-video.mp4`) : join(paths.renders, `${nn}.mp4`);
      const out = preview ? join(paths.previa, `${nn}.mp4`) : join(paths.out, `${nn}.mp4`);
      const musicOffset = round(music.start + slot.music_offset, 4);
      const renderHash = renderHashOf({ dir, page, storyboard, sub: preview ? 1 : sub, mode, engine });
      const outputHash = sha256Text(JSON.stringify({ renderHash, events: slide.events, music: music.hash, offset: musicOffset, duration: slot.duration }));
      entries.push(keptEntry({ previous, slide, slot, page, out, video, renderHash, outputHash }));
    }
  } finally {
    removeDir(temp);
  }
  const files = Object.fromEntries(entries.map((entry) => {
    const absolute = resolve(ROOT, entry.file);
    return [entry.n, { file: toPosix(dir, absolute), rendered: isFile(absolute) }];
  }));
  writePreview({ template: runtimeFiles(APP_DIR).preview, out: paths.preview, data: previewData({ storyboard, times, mode, files }) });
  const generatedAt = new Date().toISOString();
  const summary = {
    title: storyboard.title,
    format: storyboard.format,
    fps: storyboard.fps,
    bpm: storyboard.bpm,
    beats_per_bar: storyboard.beats_per_bar,
    total_bars: times.total_bars,
    total_duration: times.total_duration,
    music,
    generated_at: generatedAt,
  };
  writeState(dir, {
    app: APP,
    video_render: engine.version,
    ...summary,
    mode,
    slides: mode === "final" ? entries : (state?.slides ?? []),
    previa: mode === "previa" ? entries : (state?.previa ?? []),
  });
  const rendered = entries.filter((entry) => entry.status === "rendered").map((entry) => entry.n);
  const reused = entries.filter((entry) => entry.status === "reused").map((entry) => entry.n);
  const pending = entries.filter((entry) => entry.status === "missing" || (entry.status === "kept" && entry.stale)).map((entry) => entry.n);
  if (pending.length) {
    warnings.push(`Slides que ainda precisam de render${mode === "previa" ? " (prévia)" : ""}: ${pending.join(", ")}. Rode ${SCRIPT_COMMAND} render ${slug}${mode === "previa" ? " --preview" : ""} --slides ${pending.join(",")} --json.`);
  }
  return {
    dir: rel(dir),
    slug,
    mode,
    ...summary,
    slides: entries,
    rendered,
    reused,
    pending,
    preview: rel(paths.preview),
    state: rel(paths.state),
    next: `${SCRIPT_COMMAND} accept ${slug} --json`,
    warnings,
    elapsed_s: round((Date.now() - started) / 1000, 1),
  };
}

// ---------------------------------------------------------------------------
// accept
// ---------------------------------------------------------------------------

const check = (name, status, summary, details = []) => ({ name, status, summary, details });

/** The checks of the set, beyond what the Motor measures in each slide. */
function carouselChecks({ storyboard, times, slides }) {
  const count = storyboard.slides.length;
  const list = [];
  list.push(
    count >= LIMITS.slides[0] && count <= LIMITS.slides[1]
      ? check("slide_count", "pass", `${count} slides; o Instagram aceita de ${LIMITS.slides[0]} a ${LIMITS.slides[1]}.`)
      : check("slide_count", "fail", `${count} slides; o Instagram aceita de ${LIMITS.slides[0]} a ${LIMITS.slides[1]}.`),
  );
  const outside = times.slides.filter((slot) => slot.duration < LIMITS.duration[0] - 1e-9 || slot.duration > LIMITS.duration[1] + 1e-9);
  const durations = times.slides.map((slot) => `slide ${pad(slot.n)}: ${slot.duration} s (${slot.bars} compassos)`);
  list.push(
    outside.length
      ? check("durations", "fail", `${outside.length} slide(s) fora de ${LIMITS.duration[0]} a ${LIMITS.duration[1]} s.`, outside.map((slot) => `slide ${pad(slot.n)}: ${slot.duration} s`))
      : check("durations", "pass", `Cada slide dura de ${LIMITS.duration[0]} a ${LIMITS.duration[1]} s.`, durations),
  );
  const mismatches = slides.filter((slide) => slide.duration !== null && Math.abs(slide.duration - slide.expected_duration) > 1 / storyboard.fps + 1e-6);
  if (!slides.length) list.push(check("whole_bars", "skip", "Nenhum slide conferido nesta rodada."));
  else if (mismatches.length) {
    list.push(check("whole_bars", "fail", `${mismatches.length} página(s) com duração diferente dos compassos do storyboard.`, mismatches.map((slide) => `slide ${pad(slide.n)}: a página dura ${slide.duration} s; o storyboard diz ${slide.expected_duration} s (${slide.bars} compassos de ${times.bar_s} s)`)));
  } else list.push(check("whole_bars", "pass", `Todo slide conferido dura compassos inteiros (${times.bar_s} s por compasso a ${storyboard.bpm} BPM).`));
  const size = FORMATS[storyboard.format];
  const measured = slides.filter((slide) => slide.width || slide.height);
  const wrong = measured.filter((slide) => (slide.width && slide.width !== size.width) || (slide.height && slide.height !== size.height));
  if (!measured.length) list.push(check("same_format", "skip", "O Motor não informou o tamanho dos slides."));
  else if (wrong.length) {
    list.push(check("same_format", "fail", `${wrong.length} slide(s) fora do formato ${storyboard.format} (${size.width}×${size.height}).`, wrong.map((slide) => `slide ${pad(slide.n)}: ${slide.width}×${slide.height}`)));
  } else list.push(check("same_format", "pass", `Todos os slides conferidos estão em ${storyboard.format} (${size.width}×${size.height}).`));
  const first = slides.find((slide) => slide.n === 1);
  if (!first) list.push(check("hook_first_frame", "skip", "O slide 1 não foi conferido nesta rodada."));
  else {
    const readable = first.checks.find((item) => (item.name ?? item.id) === "first_frame_readable");
    if (!readable) list.push(check("hook_first_frame", "skip", "O Motor não informou first_frame_readable para o slide 1."));
    else if (readable.status === "pass") list.push(check("hook_first_frame", "pass", "O primeiro quadro do slide 1 é legível: a capa do carrossel está pronta.", readable.details ?? []));
    else list.push(check("hook_first_frame", readable.status === "fail" ? "fail" : readable.status === "warn" ? "warn" : "skip", `O primeiro quadro do slide 1 (a capa): ${readable.summary ?? readable.detail ?? readable.status}`, readable.details ?? []));
  }
  const last = storyboard.slides[count - 1];
  list.push(
    last.role === "cta"
      ? check("cta_present", "pass", `O último slide (${pad(last.n)}) é a chamada final.`)
      : check("cta_present", "warn", `O último slide (${pad(last.n)}) é "${last.role}", não uma chamada final (cta): o carrossel termina sem pedir nada.`),
  );
  list.push(
    times.total_duration <= LIMITS.total_duration_warn
      ? check("total_duration", "pass", `${times.total_duration} s no total (${times.total_bars} compassos).`)
      : check("total_duration", "warn", `${times.total_duration} s no total: acima de ${LIMITS.total_duration_warn} s poucos chegam ao fim; corte compassos ou slides.`),
  );
  return list;
}

async function acceptCommand(positionals, values) {
  const carousel = readCarousel(ROOT, positionals[0], { scriptCommand: SCRIPT_COMMAND });
  const engine = requireVideoRender(ROOT);
  const { storyboard, times, paths, dir, slug } = carousel;
  const selected = parseSlideSelection(values.slides, storyboard.slides.length);
  // every slide starts on a bar of the track, so inside a slide the beats are the storyboard's grid from
  // zero: --bpm is exact for each page, while the track's own beats.json is in the track's time
  const warnings = [];
  const slides = [];
  for (const slide of storyboard.slides) {
    if (!selected.includes(slide.n)) continue;
    const nn = pad(slide.n);
    const page = join(dir, slide.file);
    if (!isFile(page)) throw new AppError("file_not_found", `Não encontrei a página do slide ${slide.n}: ${rel(page)}.`, `Confira slides[${slide.n - 1}].file em ${rel(paths.storyboard)} ou escreva a página.`);
    const video = join(paths.out, `${nn}.mp4`);
    const hasVideo = isFile(video);
    progress(`Slide ${nn}: conferindo ${rel(page)}${hasVideo ? ` e ${rel(video)}` : ""}`);
    const result = await engineCall(engine, engineArgs.accept({ page: rel(page), format: storyboard.format, bpm: storyboard.bpm, video: hasVideo ? rel(video) : null, minText: MIN_TEXT }));
    const checks = Array.isArray(result.checks) ? result.checks : [];
    const failed = checks.filter((item) => item.status === "fail").map((item) => item.name ?? item.id);
    slides.push({
      n: slide.n,
      role: slide.role,
      title: slide.title,
      page: rel(page),
      video: hasVideo ? rel(video) : null,
      passed: result.passed !== undefined && result.passed !== null ? Boolean(result.passed) : failed.length === 0,
      format: result.format ?? null,
      width: result.width ?? null,
      height: result.height ?? null,
      duration: result.duration ?? null,
      expected_duration: times.slides[slide.n - 1].duration,
      bars: slide.bars,
      fps: result.fps ?? null,
      checks,
      failed,
      warnings: result.warnings ?? [],
    });
    for (const warning of result.warnings ?? []) warnings.push(`Slide ${nn}: ${warning}`);
  }
  const checks = carouselChecks({ storyboard, times, slides });
  const passed = slides.every((slide) => slide.passed) && !checks.some((item) => item.status === "fail");
  const report = { app: APP, command: "accept", generated_at: new Date().toISOString(), slug, dir: rel(dir), passed, slides, checks, warnings };
  writeJson(paths.report, report);
  return { dir: rel(dir), slug, passed, slides, checks, report: rel(paths.report), warnings };
}

// ---------------------------------------------------------------------------
// images
// ---------------------------------------------------------------------------

/**
 * One image for a carousel, into its assets folder. Who generates it follows the app's order:
 * the Codex CLI with the member's ChatGPT login, then the Gemini API with the member's optional
 * key. The member's own AI, when it generates images itself, never needs this command.
 */
async function imagesCommand(positionals, values) {
  const carousel = readCarousel(ROOT, positionals[0], { scriptCommand: SCRIPT_COMMAND });
  const { dir, slug, storyboard, paths } = carousel;
  const prompt = values.prompt?.trim();
  if (!prompt) throw usage("Descreva a imagem com --prompt.", 'Por exemplo: --prompt "empty gym at dawn, moody window light, no people" (em inglês os modelos entendem melhor).');
  if (!values.out) throw usage("Diga onde gravar com --out, dentro da pasta assets do carrossel.", "Por exemplo: --out assets/fundo.jpg (ou .png / .webp para um recorte).");
  const out = resolve(dir, values.out);
  const inside = toPosix(paths.assets, out);
  if (inside.startsWith("..") || /^[A-Za-z]:/.test(inside) || inside === ".") {
    throw usage(`A imagem precisa ficar na pasta assets do carrossel: ${values.out}.`, "Use --out assets/<nome>.jpg (ou .png / .webp para um recorte).");
  }
  const aspect = values.aspect ?? (ASPECTS.includes(storyboard.format) ? storyboard.format : "4:5");
  const key = {
    color: String(values["key-color"] ?? KEY_DEFAULTS.color).replace(/^#/, "").toUpperCase(),
    similarity: parseNumber(values["key-similarity"], { name: "key-similarity", min: 0.01, max: 1, fallback: KEY_DEFAULTS.similarity }),
    blend: parseNumber(values["key-blend"], { name: "key-blend", min: 0, max: 1, fallback: KEY_DEFAULTS.blend }),
    mode: values["key-mode"] ?? KEY_DEFAULTS.mode,
  };
  if (!/^[0-9A-F]{6}$/.test(key.color)) throw usage(`Cor inválida em --key-color: ${values["key-color"]}.`, "Use seis dígitos hexadecimais, por exemplo 00FF00 (verde) ou 0000FF (azul).");
  if (!["colorkey", "chromakey"].includes(key.mode)) throw usage(`Modo desconhecido em --key-mode: ${key.mode}.`, "Use colorkey ou chromakey.");
  const reference = values.reference ? resolveInput(ROOT, values.reference, { what: "a imagem de referência" }) : null;
  const result = await generateImage({
    out,
    prompt,
    aspect,
    provider: values.provider ?? "auto",
    model: values.model ?? null,
    reference,
    cutout: Boolean(values.cutout),
    key,
    refresh: Boolean(values.refresh),
    onProgress: progress,
  });
  return { dir: rel(dir), slug, file: rel(out), page_path: `../${toPosix(dir, out)}`, prompt, ...result };
}

// ---------------------------------------------------------------------------
// open
// ---------------------------------------------------------------------------

function openCommand(positionals) {
  const { dir, slug } = carouselDir(ROOT, positionals[0]);
  if (!isDir(dir)) throw new AppError("carousel_not_found", `Não encontrei o carrossel "${slug}" (${rel(dir)}).`, `Confira o nome na pasta ${CAROUSELS_DIR}/ do projeto, ou crie-o: ${SCRIPT_COMMAND} new ${slug} --json.`);
  const file = layout(dir).preview;
  if (!isFile(file)) {
    throw new AppError("preview_missing", `Ainda não existe a prévia do carrossel "${slug}" (${rel(file)}).`, `Rode ${SCRIPT_COMMAND} render ${slug} --preview --json (ou sem --preview, para o final) e depois open de novo.`);
  }
  const child = WINDOWS
    ? spawn("cmd", ["/c", "start", "", file], { detached: true, stdio: "ignore", windowsHide: true })
    : spawn(MAC ? "open" : "xdg-open", [file], { detached: true, stdio: "ignore" });
  child.on("error", () => {});
  child.unref();
  return { slug, file: rel(file) };
}

// ---------------------------------------------------------------------------
// help, text and main
// ---------------------------------------------------------------------------

const HELP = `Carrossel animado: carrosséis para o Instagram em que cada slide é um vídeo curto em loop, com movimento e som na batida.

Uso: ${SCRIPT_COMMAND} <comando> [opções] [--json]

Comandos
  check                          O que esta máquina tem (o Motor de vídeo, o ffmpeg, o navegador) e onde estão os guias.
  new <nome>                     Cria carrosseis/<nome>/ com o briefing, o roteiro (storyboard.json) e um slide por papel, prontos para editar.
  render <nome>                  Gera a trilha, renderiza cada slide, mixa o som e monta a prévia (previa/ com --preview; out/ no final).
  accept <nome>                  Confere cada slide (capa legível, zona segura, texto, loop, batida) e o conjunto; grava relatorio.json.
  images <nome>                  Gera uma imagem em assets/ do carrossel: pelo Codex do integrante (conta do ChatGPT) ou pela chave do Gemini.
  open <nome>                    Abre a prévia (preview.html) no navegador do integrante.
  help                           Esta ajuda.

Opções de new
  --title "…"                    O título do carrossel (e a frase do gancho).
  --slides <n>                   Quantos slides, de ${LIMITS.slides[0]} a ${LIMITS.slides[1]} (padrão: 5); com --from-example, fica com os n primeiros do exemplo.
  --roles hook,point,photo,cta   O papel de cada slide, na ordem (padrão: hook, point…, cta); photo é o slide com foto.
  --bars <n> --cta-bars <n>      Compassos por slide (padrão: 3) e do slide final (padrão: 4).
  --bpm <n>                      O andamento, de ${LIMITS.bpm[0]} a ${LIMITS.bpm[1]} (padrão: 120).
  --theme ${THEMES.join("|")}   As cores (padrão: noir).
  --style ${SOUND_STYLES.join("|")}  O caráter da trilha (padrão: noir).
  --format ${Object.keys(FORMATS).join("|")}      O formato (padrão: 4:5).
  --seed <n>                     A semente da textura e da trilha (padrão: 7).
  --from-example                 Copia o exemplo completo (5 slides, tema noir) em vez dos modelos.
  --from-photo-example           Copia o exemplo com fotos (3 slides, com as imagens em assets/).
  --force                        Recria por cima de um carrossel que já existe.

Opções de render
  --slides 1,3 ou 2-4            Só estes slides (padrão: todos); os outros ficam como estavam.
  --preview                      Render rápido em metade do tamanho, em previa/.
  --refresh                      Refaz tudo, inclusive a trilha e os slides que não mudaram.
  --sub <n>                      Subquadros de desfoque de movimento no render final (1, 2 ou 4; padrão: 1).

Opções de accept
  --slides 1,3 ou 2-4            Só estes slides (o conjunto é conferido sempre).

Opções de images
  --prompt "…"                   A descrição da imagem (em inglês os modelos entendem melhor).
  --out assets/<arquivo>         Onde gravar, dentro de assets/ do carrossel: .jpg, .png ou .webp.
  --cutout                       Recorte com fundo transparente (saída .png ou .webp).
  --aspect <proporção>           ${ASPECTS.join(", ")} (padrão: a do carrossel).
  --provider ${PROVIDERS.join("|")}   Quem gera (padrão: auto, que tenta o Codex conectado à conta do ChatGPT e depois a chave do Gemini;
                                 o Codex conectado por chave de API só entra com --provider codex).
  --reference <arquivo>          Uma imagem de referência de assunto ou de estilo.
  --model <modelo>               Outro modelo de imagem do Gemini (padrão: gemini-3.1-flash-image).
  --refresh                      Gera de novo em vez de devolver o arquivo que já existe.
  --key-similarity <0.01 a 1> --key-blend <0 a 1> --key-color <hex> --key-mode colorkey|chromakey
                                 Ajustes do recorte quando quem gera é o Gemini (padrão: 0.35, 0.1, 00FF00, colorkey).

Cada slide dura compassos inteiros: a 120 BPM, 3 compassos são 6 s e 4 compassos, 8 s. A trilha é uma só e é cortada nos compassos, de slide em slide.`;

function slideLine(slide) {
  const note = {
    rendered: "",
    reused: "  (reaproveitado)",
    kept: slide.stale ? "  (do render anterior; mudou desde então)" : "  (do render anterior)",
    missing: "  (ainda não renderizado)",
  }[slide.status] ?? "";
  return `  ${pad(slide.n)} ${String(slide.role).padEnd(5)} ${String(slide.duration).padStart(5)} s  ${slide.file}${note}`;
}

function humanText(result) {
  if (!result.ok) return [`Erro (${result.error.code}): ${result.error.message}`, result.error.fix && `Como resolver: ${result.error.fix}`].filter(Boolean).join("\n");
  const warnings = (result.warnings ?? []).map((warning) => `Aviso: ${warning}`);
  switch (result.command) {
    case "help":
      return result.text;
    case "check": {
      const engine = result.video_render;
      const lines = [`Carrossel animado ${result.app.version}`];
      if (engine.installed) {
        lines.push(`Motor de vídeo ${engine.version ?? "?"}: instalado (${engine.path}) · render ${result.modes.render ? "disponível" : "indisponível"}`);
        if (engine.check?.tools) lines.push(`ffmpeg: ${engine.check.tools.ffmpeg ?? "não encontrado"} · navegador: ${engine.check.tools.browser ? `${engine.check.tools.browser.name} (${engine.check.tools.browser.path})` : "não encontrado"}`);
      } else lines.push(`Motor de vídeo: não instalado. Para instalá-lo, ${INSTALL_VIDEO_RENDER_STEPS}.`);
      for (const [name, command] of Object.entries(result.install)) lines.push(`Instalar ${name}: ${command}`);
      if (result.install_note) lines.push(result.install_note);
      if (result.images) {
        const images = result.images;
        const codex = !images.codex.installed
          ? "sem Codex"
          : !images.codex.logged_in
            ? "Codex instalado, sem conta conectada"
            : images.codex.auth === "api_key"
              ? "Codex conectado por chave de API (fora da ordem automática: cada imagem seria cobrada na chave)"
              : "Codex conectado à conta do ChatGPT";
        const gemini = images.gemini_key ? `chave do Gemini salva (${images.gemini_key_from === "environment" ? "variável de ambiente" : "no flyee"})` : "sem chave do Gemini";
        const order = images.available.length ? `o comando images usa, nesta ordem: ${images.available.join(", ")}` : "o comando images não tem quem gere imagens aqui; veja o guia de imagens";
        lines.push(`Imagens: ${codex} · ${gemini} · ${order}. Se você mesmo gera imagens, use a sua ferramenta antes de tudo.`);
      }
      lines.push(`Guias: ${Object.values(result.guides).join(" · ")}`);
      return [...lines, ...warnings].join("\n");
    }
    case "new":
      return [
        `Carrossel criado em ${result.dir}: "${result.title}", ${result.slides.length} slides (${result.slides.map((slide) => slide.role).join(", ")}), ${result.format}, ${result.bpm} BPM, ${result.total_bars} compassos (${result.total_duration} s).`,
        `Edite ${result.brief}, ${result.storyboard} e as páginas em ${result.dir}/slides/.`,
        `Depois: ${result.next[0]}`,
        `E então: ${result.next[1]}`,
        ...warnings,
      ].join("\n");
    case "render": {
      const lines = [
        `Carrossel "${result.title}" (${result.mode === "previa" ? "prévia" : "final"}): ${result.rendered.length} renderizado(s), ${result.reused.length} reaproveitado(s) · ${result.total_duration} s no total (${result.total_bars} compassos a ${result.bpm} BPM) em ${result.elapsed_s} s.`,
        ...result.slides.map(slideLine),
        `Trilha: ${result.music.file}${result.music.source === "synth" ? ` (${result.music.style}, semente ${result.music.seed})` : " (música do integrante)"} · batidas: ${result.music.beats_file}`,
        `Prévia: ${result.preview}`,
        `Próximo passo: ${result.next}`,
      ];
      return [...lines, ...warnings].join("\n");
    }
    case "accept": {
      const lines = [`Conferência de "${result.slug}": ${result.passed ? "APROVADO" : "REPROVADO"}`];
      for (const slide of result.slides) {
        lines.push(`Slide ${pad(slide.n)} (${slide.role}): ${slide.passed ? "✓" : "✗"} ${slide.page}`);
        for (const item of slide.checks) lines.push(`  ${MARKS[item.status] ?? "?"} ${item.name ?? item.id}: ${item.summary ?? item.detail ?? ""}`);
      }
      lines.push("Conjunto:");
      for (const item of result.checks) lines.push(`  ${MARKS[item.status] ?? "?"} ${item.name}: ${item.summary}`);
      lines.push(`Relatório: ${result.report}`);
      return [...lines, ...warnings].join("\n");
    }
    case "images": {
      const cut = result.cutout ? ` · recorte com ${Math.round((result.cutout.transparent_ratio ?? 0) * 100)}% de transparência` : "";
      return [`Imagem ${result.cached ? "reaproveitada" : "pronta"}: ${result.file} (${result.width}×${result.height}, por ${result.provider === "codex" ? "Codex" : "Gemini"}${cut}). Na página: ${result.page_path}`, ...warnings].join("\n");
    }
    case "open":
      return `Aberto: ${result.file}`;
    default:
      return JSON.stringify(result, null, 2);
  }
}

async function main(argv) {
  const [command, ...rest] = argv;
  if (!command || ["help", "--help", "-h"].includes(command)) return { ok: true, command: "help", app: APP, text: HELP };
  const { positionals, values } = parseArgs(rest, ARG_SPEC);
  let result;
  switch (command) {
    case "check":
      result = await checkCommand();
      break;
    case "new":
      if (positionals.length !== 1) throw usage("Informe o nome: new <nome> [--title …] [--slides 5].", "O nome vira a pasta carrosseis/<nome>/.");
      result = newCommand(positionals, values);
      break;
    case "render":
      if (positionals.length !== 1) throw usage("Informe o carrossel: render <nome> [--preview] [--slides 1,3].");
      result = await renderCommand(positionals, values);
      break;
    case "accept":
      if (positionals.length !== 1) throw usage("Informe o carrossel: accept <nome> [--slides 1,3].");
      result = await acceptCommand(positionals, values);
      break;
    case "images":
      if (positionals.length !== 1) throw usage('Informe o carrossel: images <nome> --prompt "…" --out assets/<arquivo>.');
      result = await imagesCommand(positionals, values);
      break;
    case "open":
      if (positionals.length !== 1) throw usage("Informe o carrossel: open <nome>.");
      result = openCommand(positionals);
      break;
    default:
      throw usage(`Comando desconhecido: ${command}.`, "Comandos: check, new, render, accept, images, open, help.");
  }
  return { ok: true, command, app: APP, ...result };
}

const json = process.argv.includes("--json");
main(process.argv.slice(2))
  .then((result) => process.stdout.write(`${json ? JSON.stringify(result, null, 2) : humanText(result)}\n`))
  .catch((error) => {
    const known = error instanceof AppError;
    const result = {
      ok: false,
      command: process.argv[2] ?? null,
      error: {
        code: known ? error.code : "unexpected",
        message: known ? error.message : `Erro inesperado: ${error?.message ?? error}`,
        fix: known ? error.fix : "Tente de novo; se repetir, mostre esta mensagem ao integrante.",
      },
    };
    process.stdout.write(`${json ? JSON.stringify(result, null, 2) : humanText(result)}\n`);
    // exitCode, not process.exit(): on Windows with Node 24, exiting right after an HTTPS fetch (the
    // Gemini request in lib/images.mjs) aborts Node on a libuv assertion with exit code 127. The process
    // ends on its own; the unref'd timer only ends one that something unexpected keeps alive.
    process.exitCode = result.error.code === "usage" ? 2 : 1;
    setTimeout(() => process.exit(process.exitCode), 3000).unref();
  });
