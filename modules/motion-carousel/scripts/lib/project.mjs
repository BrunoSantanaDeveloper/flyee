// A carousel in the member's project: the folder layout under carrosseis/<slug>/, the files the
// `new` command writes (storyboard, brief, slides from the templates or the worked example, the
// two runtimes), and the state the `render` command keeps to reuse what has not changed.

import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { pad, timing, validateStoryboard } from "./storyboard.mjs";
import { AppError, displayPath, ensureDir, isDir, isFile, readJson, requireJson, round, slugify, toPosix, usage, writeFileAtomic, writeJson } from "./util.mjs";

export const CAROUSELS_DIR = "carrosseis";
export const FILES = {
  brief: "brief.md",
  storyboard: "storyboard.json",
  motion: "motion.js",
  carousel: "carousel.js",
  preview: "preview.html",
  report: "relatorio.json",
  state: "carousel.json",
};
export const DIRS = ["slides", "assets", "audio", "renders", "out", "previa"];
export const PLACEHOLDERS = ["__TITLE__", "__TEXT__", "__BARS__", "__BEATS_PER_BAR__", "__BPM__", "__THEME__", "__SEED__", "__N__", "__TOTAL__", "__TOTAL_BARS__", "__OFFSET_BARS__", "__FORMAT__"];
export const INSTALL_SELF = "npx flyee add motion-carousel --yes --json";

/**
 * Copies a folder file by file. fs.cpSync with `recursive` writes into a folder with a corrupted
 * name on Windows when the destination has accents (a project under C:\\Users\\João…), and says nothing.
 * `skip(name, path)` leaves an entry out.
 */
export function copyTree(from, to, skip = () => false) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (skip(entry.name, source)) continue;
    if (entry.isDirectory()) copyTree(source, target, skip);
    else if (entry.isFile()) copyFileSync(source, target);
  }
}

const ROLE_NAMES = { hook: "Gancho", point: "Ponto", photo: "Foto", cta: "Chamada final" };

/** The files this app ships that the commands copy or fill. */
export function runtimeFiles(appDir) {
  return {
    carousel: join(appDir, "runtime", "carousel.js"),
    preview: join(appDir, "runtime", "preview.html"),
    templates: {
      hook: join(appDir, "runtime", "slides", "hook.html"),
      point: join(appDir, "runtime", "slides", "point.html"),
      photo: join(appDir, "runtime", "slides", "photo.html"),
      cta: join(appDir, "runtime", "slides", "cta.html"),
    },
    example: join(appDir, "references", "exemplo"),
    examplePhoto: join(appDir, "references", "exemplo-foto"),
  };
}

/** Which of the app's own files are missing, by part: carousel, preview, templates, example. */
export function missingRuntime(appDir, parts = ["carousel", "preview", "templates"]) {
  const files = runtimeFiles(appDir);
  const wanted = [];
  for (const part of parts) {
    if (part === "carousel") wanted.push(files.carousel);
    else if (part === "preview") wanted.push(files.preview);
    else if (part === "templates") wanted.push(...Object.values(files.templates));
    else if (part === "example") wanted.push(join(files.example, "brief.md"), join(files.example, "storyboard.json"));
    else if (part === "example-photo") wanted.push(join(files.examplePhoto, "brief.md"), join(files.examplePhoto, "storyboard.json"));
  }
  return wanted.filter((file) => !isFile(file)).map((file) => toPosix(appDir, file));
}

export function requireRuntime(appDir, parts) {
  const missing = missingRuntime(appDir, parts);
  if (missing.length) {
    throw new AppError("runtime_missing", `Faltam arquivos do app Carrossel animado: ${missing.join(", ")}.`, `Reinstale o app: ${INSTALL_SELF}, depois repita.`);
  }
}

/** "carrosseis/Academia em Fevereiro/" → "academia-em-fevereiro". */
export function slugOf(arg) {
  if (typeof arg !== "string" || !arg.trim()) throw usage("Informe o nome do carrossel.", "Por exemplo: new academia-fevereiro --json.");
  return slugify(basename(arg.trim().replace(/[\\/]+$/, "")), 60);
}

/** The folder of a carousel: a folder with a storyboard.json when a path is given, else carrosseis/<slug>. */
export function carouselDir(root, arg) {
  const slug = slugOf(arg);
  const direct = [resolve(process.cwd(), arg), resolve(root, arg)].find((candidate) => isFile(join(candidate, FILES.storyboard)));
  if (direct) return { dir: direct, slug: basename(direct) };
  return { dir: join(root, CAROUSELS_DIR, slug), slug };
}

export function layout(dir) {
  const paths = { dir };
  for (const [key, name] of Object.entries(FILES)) paths[key] = join(dir, name);
  for (const name of DIRS) paths[name] = join(dir, name);
  return paths;
}

/** The carousel's storyboard, validated, with its timing and paths. */
export function readCarousel(root, arg, { scriptCommand = "" } = {}) {
  const { dir, slug } = carouselDir(root, arg);
  const paths = layout(dir);
  if (!isFile(paths.storyboard)) {
    const create = scriptCommand ? `${scriptCommand} new ${slug} --json` : "o comando new";
    throw new AppError(
      "carousel_not_found",
      `Não encontrei o carrossel "${slug}": não existe ${displayPath(root, paths.storyboard)}.`,
      `Confira o nome na pasta ${CAROUSELS_DIR}/ do projeto, ou crie-o: ${create}.`,
    );
  }
  const storyboard = validateStoryboard(requireJson(paths.storyboard, "o storyboard.json"));
  return { dir, slug, paths, storyboard, times: timing(storyboard) };
}

export function readState(dir) {
  const state = readJson(join(dir, FILES.state), null);
  return state && typeof state === "object" ? state : null;
}

export function writeState(dir, state) {
  writeJson(join(dir, FILES.state), state);
}

/** A value inside a double-quoted JavaScript string in a template. */
const escapeJs = (value) => String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "").replace(/\n/g, "\\n").replace(/<\//g, "<\\/");

/**
 * Replaces the templates' placeholders: numbers bare, texts escaped for a JavaScript string, and
 * `{ json: value }` written as a JavaScript literal (a theme may be a name or an object).
 */
export function fillTemplate(html, values) {
  let out = html;
  for (const [token, value] of Object.entries(values)) {
    let replacement;
    if (typeof value === "number") replacement = String(value);
    else if (value && typeof value === "object" && "json" in value) replacement = JSON.stringify(value.json).replace(/<\//g, "<\\/");
    else replacement = escapeJs(value ?? "");
    out = out.split(token).join(replacement);
  }
  return out;
}

/** The placeholder values of one slide page. */
export function slideValues({ storyboard, times, slide, text = "" }) {
  const slot = times.slides.find((entry) => entry.n === slide.n);
  return {
    __TITLE__: slide.title,
    __TEXT__: text,
    __BARS__: slide.bars,
    __BEATS_PER_BAR__: storyboard.beats_per_bar,
    __BPM__: storyboard.bpm,
    __THEME__: { json: storyboard.theme ?? "noir" },
    __SEED__: storyboard.seed,
    __N__: slide.n,
    __TOTAL__: storyboard.slides.length,
    __TOTAL_BARS__: times.total_bars,
    __OFFSET_BARS__: slot ? slot.offset_bars : 0,
    __FORMAT__: storyboard.format,
  };
}

/** The brief the member's AI fills before writing the slides (pt-BR). */
export function briefTemplate({ title, storyboard, times }) {
  const structure = storyboard.slides
    .map((slide) => {
      const slot = times.slides.find((entry) => entry.n === slide.n);
      return `${slide.n}. ${ROLE_NAMES[slide.role]} (${slide.bars} compassos, ${round(slot.duration, 2)} s): ${slide.title || "…"}`;
    })
    .join("\n");
  return `# ${title}

Briefing do carrossel. Uma linha por item basta: o roteiro (storyboard.json) e os slides nascem daqui.

## Tema
O assunto em uma frase e o ângulo que ninguém está usando.

## Para quem
Quem vai parar o dedo neste carrossel: o momento de vida, a dor, o que já tentou.

## Promessa
O que a pessoa leva ao chegar no último slide.

## Tom
Direto, bem-humorado, provocador ou acolhedor: escolha um e mantenha em todos os slides.

## Estrutura dos slides
${structure}

## Chamada final
A palavra que a pessoa comenta e o que ela recebe em troca.
`;
}

/** A worked example the app ships (`default`: type and shapes; `photo`: with pictures), validated; a packaging error when it is incomplete. */
export function loadExample(appDir, which = "default") {
  const dir = which === "photo" ? runtimeFiles(appDir).examplePhoto : runtimeFiles(appDir).example;
  const reinstall = `Reinstale o app: ${INSTALL_SELF}, depois repita.`;
  const raw = readJson(join(dir, "storyboard.json"), null);
  if (!raw) throw new AppError("runtime_missing", "O exemplo do app não tem um storyboard.json legível.", reinstall);
  let storyboard;
  try {
    storyboard = validateStoryboard(raw);
  } catch (error) {
    throw new AppError("runtime_missing", `O storyboard do exemplo do app está inválido: ${error.message}`, reinstall);
  }
  const missing = [join(dir, "brief.md"), ...storyboard.slides.map((slide) => join(dir, slide.file))].filter((file) => !isFile(file));
  if (missing.length) throw new AppError("runtime_missing", `Faltam arquivos do exemplo do app: ${missing.map((file) => toPosix(appDir, file)).join(", ")}.`, reinstall);
  return { dir, storyboard };
}

/**
 * Writes a carousel folder: the sub-folders, the two runtimes, the storyboard, the brief and the
 * slide pages (from the templates, with the placeholders filled, or copied from the example).
 * `texts` maps a slide number to the body text of its template.
 */
export function createCarousel({ dir, appDir, engine, storyboard, texts = {}, fromExample = false, exampleDir = null, force = false }) {
  const paths = layout(dir);
  const times = timing(storyboard);
  ensureDir(dir);
  for (const name of DIRS) ensureDir(paths[name]);
  if (force) {
    for (const file of [paths.state, paths.report]) rmSync(file, { force: true });
  }
  copyFileSync(engine.runtime, paths.motion);
  const runtime = runtimeFiles(appDir);
  copyFileSync(runtime.carousel, paths.carousel);
  if (fromExample) {
    const source = exampleDir ?? runtime.example;
    copyFileSync(join(source, "brief.md"), paths.brief);
    for (const slide of storyboard.slides) {
      const target = join(dir, slide.file);
      ensureDir(join(target, ".."));
      copyFileSync(join(source, slide.file), target);
    }
    // an example with pictures brings them along
    if (isDir(join(source, "assets"))) copyTree(join(source, "assets"), paths.assets);
  } else {
    writeFileAtomic(paths.brief, briefTemplate({ title: storyboard.title, storyboard, times }));
    for (const slide of storyboard.slides) {
      const template = readFileSync(runtime.templates[slide.role], "utf8");
      const target = join(dir, slide.file);
      ensureDir(join(target, ".."));
      writeFileAtomic(target, fillTemplate(template, slideValues({ storyboard, times, slide, text: texts[slide.n] ?? "" })));
    }
  }
  writeJson(paths.storyboard, storyboard);
  return { paths, times, slides: storyboard.slides.map((slide) => ({ n: slide.n, role: slide.role, bars: slide.bars, title: slide.title, file: join(dir, slide.file) })) };
}

export { pad };
