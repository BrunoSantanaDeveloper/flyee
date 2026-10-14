#!/usr/bin/env node
// Motor de vídeo: the commands the member's AI and other apps run.
//   node .flyee/modules/video-render/scripts/render.mjs <command> [options] [--json]
// The full interface is in references/interface.md; the page contract in references/pagina.md.

import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { contactSheet, frameStrip, phoneSheet, probe, tileImages } from "./lib/ffmpeg.mjs";
import { captureFrames, FORMATS, parseFormat, renderPage } from "./lib/renderer.mjs";
import { checkTools, ffmpegEncoders, ffmpegFilters, findFont, installHints } from "./lib/tools.mjs";
import {
  AppError,
  displayPath,
  ensureDir,
  formatTime,
  isDir,
  isFile,
  MAC,
  parseArgs,
  parseList,
  parseNumber,
  parseTime,
  progress,
  projectRoot,
  readJson,
  requireJson,
  resolveInput,
  round,
  toPosix,
  usage,
  WINDOWS,
} from "./lib/util.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(SCRIPTS_DIR, "..");
const RUNTIME_DIR = join(APP_DIR, "runtime");
const ROOT = projectRoot(SCRIPTS_DIR);
const MANIFEST = readJson(join(APP_DIR, "flyee.module.json"), {});
const APP = { name: MANIFEST.name ?? "video-render", version: MANIFEST.version ?? "0.0.0" };
const INTERFACE_VERSION = 1;
const SCRIPT_COMMAND = `node ${toPosix(ROOT, join(SCRIPTS_DIR, "render.mjs"))}`;
const ARG_SPEC = {
  flags: ["json", "alpha", "force", "phone", "downbeats"],
  options: [
    "out", "fps", "sub", "format", "scale", "start", "end", "frame-format", "quality", "crf", "parallel", "audio", "browser",
    "times", "every", "beats", "sheet", "cols", "strip", "tile-width", "duration", "name",
  ],
};

const rel = (path) => displayPath(ROOT, path);

/**
 * Command groups beyond the core live in scripts/commands/<group>.mjs and export
 * `argSpec` ({ flags, options }), `commands` ({ name: { summary, help, run(positionals, values, ctx), text(result) } })
 * and, optionally, `help` (a block for the help text). A missing file is skipped.
 */
const EXTRA_GROUPS = ["audio", "capture", "accept"];

async function loadExtras() {
  const groups = [];
  for (const name of EXTRA_GROUPS) {
    const file = join(SCRIPTS_DIR, "commands", `${name}.mjs`);
    if (!isFile(file)) continue;
    groups.push({ name, ...(await import(pathToFileURL(file).href)) });
  }
  return groups;
}

function mergedArgSpec(groups) {
  const flags = new Set(ARG_SPEC.flags);
  const options = new Set(ARG_SPEC.options);
  for (const group of groups) {
    for (const flag of group.argSpec?.flags ?? []) flags.add(flag);
    for (const option of group.argSpec?.options ?? []) options.add(option);
  }
  return { flags: [...flags], options: [...options] };
}

/** The programs this machine has; `strict` lists what a render needs and fails when something is missing. */
async function requireTools({ browser = true } = {}) {
  const tools = await checkTools();
  const missing = [];
  if (!tools.ffmpeg) missing.push("ffmpeg");
  if (!tools.ffprobe) missing.push("ffprobe");
  if (browser && !tools.browser) missing.push("navegador");
  if (missing.length) {
    const hints = installHints();
    const steps = [];
    if (missing.includes("ffmpeg") || missing.includes("ffprobe")) steps.push(`ffmpeg: ${hints.ffmpeg}`);
    if (missing.includes("navegador")) steps.push(WINDOWS ? "navegador: o Microsoft Edge vem com o Windows; confira se está instalado" : `navegador: ${hints.browser}`);
    throw new AppError("tools_missing", `Falta nesta máquina: ${missing.join(", ")}.`, `${steps.join("; ")}. ${hints.note}`);
  }
  return tools;
}

function outputPath(values, { required = true, fallback = null } = {}) {
  const out = values.out ?? fallback;
  if (!out) {
    if (required) throw usage("Informe o arquivo de saída com --out.");
    return null;
  }
  const abs = resolve(process.cwd(), out);
  ensureDir(dirname(abs));
  return abs;
}

function pageInput(positionals) {
  const page = resolveInput(ROOT, positionals[0], { what: "a página HTML" });
  if (!isFile(page) || ![".html", ".htm"].includes(extname(page).toLowerCase())) throw usage(`A página precisa ser um arquivo .html: ${positionals[0]}.`);
  return page;
}

function renderOptions(values, { preview = false } = {}) {
  const format = parseFormat(values.format);
  // null lets the page's own film.fps decide; the renderer falls back to 30 when the page says nothing
  const fps = parseNumber(values.fps, { name: "fps", min: 1, max: 120, fallback: null });
  const sub = parseNumber(values.sub, { name: "sub", min: 1, max: 8, integer: true, fallback: 1 });
  const scale = parseNumber(values.scale, { name: "scale", min: 0.1, max: 1, fallback: preview ? 0.5 : 1 });
  const crf = parseNumber(values.crf, { name: "crf", min: 0, max: 51, integer: true, fallback: preview ? 23 : 16 });
  const quality = parseNumber(values.quality, { name: "quality", min: 30, max: 100, integer: true, fallback: 92 });
  const parallel = parseNumber(values.parallel, { name: "parallel", min: 1, max: 8, integer: true, fallback: null });
  const frameFormat = values["frame-format"] ?? (preview && !values.alpha ? "jpeg" : "png");
  if (!["png", "jpeg"].includes(frameFormat)) throw usage(`Formato de quadro desconhecido: ${frameFormat}.`, "Use png ou jpeg.");
  if (values.alpha && frameFormat === "jpeg") throw usage("Quadros JPEG não guardam transparência.", "Use --frame-format png com --alpha.");
  const start = values.start !== undefined ? parseTime(values.start) : 0;
  const end = values.end !== undefined ? parseTime(values.end) : null;
  const audio = values.audio ? resolveInput(ROOT, values.audio, { what: "o arquivo de áudio" }) : null;
  const browserPath = values.browser ?? null;
  return { format, fps, sub, scale, crf, quality, parallel, frameFormat, alpha: Boolean(values.alpha), start, end, audio, browserPath };
}

function progressBar(label) {
  let lastShown = -1;
  return (done, total) => {
    const pct = Math.floor((done / total) * 100);
    if (pct === lastShown || (pct % 5 && done !== total)) return;
    lastShown = pct;
    progress(`${label}: ${done}/${total} quadros (${pct}%)`);
  };
}

async function checkCommand() {
  const tools = await checkTools({ versions: true });
  const hints = installHints();
  const install = {};
  if (!tools.ffmpeg || !tools.ffprobe) install.ffmpeg = hints.ffmpeg;
  if (!tools.browser && hints.browser) install.browser = hints.browser;
  const filters = tools.ffmpeg ? await ffmpegFilters(tools.ffmpeg.path) : new Set();
  const available = tools.ffmpeg ? await ffmpegEncoders(tools.ffmpeg.path) : new Set();
  const encoders = { h264: available.has("libx264"), prores: available.has("prores_ks"), vp9: available.has("libvpx-vp9"), aac: available.has("aac"), opus: available.has("libopus") };
  return {
    ok: true,
    command: "check",
    interface_version: INTERFACE_VERSION,
    app: APP,
    project: ROOT,
    node: process.version,
    cores: cpus().length,
    tools: {
      ffmpeg: tools.ffmpeg?.version ?? null,
      ffprobe: tools.ffprobe?.version ?? null,
      browser: tools.browser ? { name: tools.browser.name, path: tools.browser.path } : null,
      drawtext: filters.has("drawtext") && Boolean(findFont()),
      encoders,
    },
    modes: {
      render: Boolean(tools.ffmpeg && tools.browser),
      alpha: Boolean(tools.ffmpeg && tools.browser),
      sheets: Boolean(tools.ffmpeg),
    },
    formats: Object.fromEntries(Object.entries(FORMATS).map(([name, size]) => [name, `${size.width}x${size.height}`])),
    install,
    install_note: Object.keys(install).length ? hints.note : null,
    runtime: toPosix(ROOT, join(RUNTIME_DIR, "motion.js")),
    guides: {
      page: toPosix(ROOT, join(APP_DIR, "references", "pagina.md")),
      interface: toPosix(ROOT, join(APP_DIR, "references", "interface.md")),
    },
  };
}

/** A starter page plus motion.js in a folder, ready to edit and render. */
function scaffoldCommand(positionals, values) {
  if (!positionals[0]) throw usage("Informe a pasta: scaffold <pasta>.");
  const dir = resolve(process.cwd(), positionals[0]);
  const format = parseFormat(values.format) ?? { name: "9:16", ...FORMATS["9:16"] };
  const duration = parseNumber(values.duration, { name: "duration", min: 1, max: 600, fallback: 6 });
  const name = values.name ?? "Página inicial";
  mkdirSync(dir, { recursive: true });
  const page = join(dir, "pagina.html");
  const runtime = join(dir, "motion.js");
  if (isFile(page) && !values.force) throw new AppError("exists", `Já existe ${rel(page)}.`, "Use --force para sobrescrever, ou outra pasta.");
  copyFileSync(join(RUNTIME_DIR, "motion.js"), runtime);
  let html = readFileSync(join(RUNTIME_DIR, "exemplo.html"), "utf8");
  html = html
    .replace('<canvas id="c" width="1080" height="1920"></canvas>', `<canvas id="c" width="${format.width}" height="${format.height}"></canvas>`)
    .replace('title: "Página inicial", duration: 6, width: 1080, height: 1920', `title: ${JSON.stringify(name)}, duration: ${duration}, width: ${format.width}, height: ${format.height}`);
  writeFileSync(page, html);
  return {
    ok: true,
    command: "scaffold",
    interface_version: INTERFACE_VERSION,
    app: APP,
    dir: rel(dir),
    page: rel(page),
    runtime: rel(runtime),
    format: format.name,
    duration,
    next: `${SCRIPT_COMMAND} preview ${rel(page)} --out ${rel(join(dir, "previa.mp4"))} --json`,
    guide: toPosix(ROOT, join(APP_DIR, "references", "pagina.md")),
  };
}

async function renderCommand(positionals, values, { preview = false } = {}) {
  const page = pageInput(positionals);
  const options = renderOptions(values, { preview });
  const defaultOut = join(dirname(page), preview ? "previa.mp4" : `${basename(page, extname(page))}.mp4`);
  const out = outputPath(values, { fallback: defaultOut });
  if (options.alpha && ![".mov", ".webm"].includes(extname(out).toLowerCase())) throw new AppError("alpha_needs_mov", "A camada transparente precisa de um arquivo .mov ou .webm.", `Use --out ${basename(out, extname(out))}.mov.`);
  const tools = await requireTools();
  progress(`${preview ? "Prévia" : "Render"} de ${rel(page)} → ${rel(out)}`);
  const result = await renderPage({
    pagePath: page,
    out,
    tools,
    fps: options.fps,
    sub: preview ? 1 : options.sub,
    start: options.start,
    end: options.end,
    format: options.format,
    scale: options.scale,
    alpha: options.alpha,
    frameFormat: options.frameFormat,
    quality: options.quality,
    crf: options.crf,
    parallel: options.parallel,
    audio: options.audio,
    browserPath: options.browserPath,
    onProgress: progressBar(preview ? "Prévia" : "Render"),
  });
  const info = await probe(tools.ffprobe.path, out).catch(() => null);
  return {
    ok: true,
    command: preview ? "preview" : "render",
    interface_version: INTERFACE_VERSION,
    app: APP,
    page: rel(page),
    file: rel(out),
    width: result.width,
    height: result.height,
    fps: result.fps,
    subframes: result.subframes,
    frames: result.frames,
    duration: result.duration,
    start: result.start,
    end: result.end,
    format: result.format,
    alpha: result.alpha,
    audio: options.audio ? rel(options.audio) : null,
    size_bytes: info?.size ?? null,
    workers: result.workers,
    elapsed_s: round(result.elapsed_ms / 1000, 1),
    frames_hash: result.frames_hash,
    film: result.film,
    warnings: result.warnings,
  };
}

function frameTimes(values, film) {
  if (values.times) return parseList(values.times).map(parseTime);
  if (values.beats) {
    const beats = requireJson(resolveInput(ROOT, values.beats, { what: "o beats.json" }), "o arquivo de batidas");
    const list = values.downbeats ? beats.downbeats ?? [] : beats.beats ?? [];
    if (!list.length) throw usage("O beats.json não tem batidas.");
    return list.filter((t) => film.duration === null || t < film.duration).map((t) => round(t, 3));
  }
  const every = parseNumber(values.every, { name: "every", min: 0.05, max: 60, fallback: 0.5 });
  const duration = film.duration ?? 15;
  const times = [];
  for (let t = 0; t < duration - 1e-6; t += every) times.push(round(t, 3));
  return times;
}

async function framesCommand(positionals, values) {
  const page = pageInput(positionals);
  const tools = await requireTools();
  const out = values.out ? resolve(process.cwd(), values.out) : join(dirname(page), "quadros");
  ensureDir(out);
  const format = parseFormat(values.format);
  const scale = parseNumber(values.scale, { name: "scale", min: 0.1, max: 1, fallback: 1 });
  const cols = parseNumber(values.cols, { name: "cols", min: 1, max: 12, integer: true, fallback: 6 });
  const tileWidth = parseNumber(values["tile-width"], { name: "tile-width", min: 80, max: 1080, integer: true, fallback: 270 });
  // one quick pass reads the film; the times may depend on its duration
  const first = await captureFrames({ pagePath: page, times: [0], tools, format, scale, alpha: Boolean(values.alpha), browserPath: values.browser ?? null });
  const times = frameTimes(values, first.film);
  if (times.length > 400) throw usage(`São ${times.length} quadros; o máximo é 400.`, "Aumente --every ou passe --times.");
  progress(`Fotografando ${times.length} quadro(s) de ${rel(page)}`);
  const captured = await captureFrames({ pagePath: page, times, tools, format, scale, alpha: Boolean(values.alpha), browserPath: values.browser ?? null });
  for (const file of readdirSync(out)) if (/^quadro-\d{4}\.png$/.test(file)) rmSync(join(out, file), { force: true });
  const files = captured.frames.map((frame, index) => {
    const file = join(out, `quadro-${String(index + 1).padStart(4, "0")}.png`);
    writeFileSync(file, frame.data);
    return { time: frame.time, label: formatTime(frame.time), file: rel(file) };
  });
  const sheetPath = values.sheet ? resolve(process.cwd(), values.sheet) : join(out, "folha.png");
  await tileImages(tools.ffmpeg.path, join(out, "quadro-%04d.png"), sheetPath, { cols, count: files.length, tileWidth });
  const sheet = rel(sheetPath);
  return {
    ok: true,
    command: "frames",
    interface_version: INTERFACE_VERSION,
    app: APP,
    page: rel(page),
    dir: rel(out),
    width: captured.width,
    height: captured.height,
    frames: files,
    sheet,
    sheet_cols: cols,
    warnings: captured.errors.length ? [`A página registrou erros: ${captured.errors.slice(0, 2).join(" | ")}`] : [],
  };
}

async function sheetCommand(positionals, values) {
  const video = resolveInput(ROOT, positionals[0], { what: "o vídeo" });
  const tools = await requireTools({ browser: false });
  const info = await probe(tools.ffprobe.path, video);
  const out = outputPath(values, { fallback: join(dirname(video), `${basename(video, extname(video))}-folha.png`) });
  const fps = parseNumber(values.fps, { name: "fps", min: 0.1, max: 30, fallback: 2 });
  const cols = parseNumber(values.cols, { name: "cols", min: 1, max: 12, integer: true, fallback: 6 });
  const tileWidth = parseNumber(values["tile-width"], { name: "tile-width", min: 80, max: 1080, integer: true, fallback: 270 });
  const filters = await ffmpegFilters(tools.ffmpeg.path);
  const font = filters.has("drawtext") ? findFont() : null;
  const sheet = await contactSheet(tools.ffmpeg.path, video, out, { fps, cols, tileWidth, font, duration: info.duration });
  const result = {
    ok: true,
    command: "sheet",
    interface_version: INTERFACE_VERSION,
    app: APP,
    video: rel(video),
    duration: round(info.duration),
    sheet: rel(out),
    sheet_layout: { ...sheet, stamped: Boolean(font) },
    strip: null,
    phone: null,
  };
  if (values.strip !== undefined) {
    const at = parseTime(values.strip);
    const stripPath = join(dirname(out), `${basename(out, ".png")}-tira-${String(at).replace(".", "_")}.png`);
    const strip = await frameStrip(tools.ffmpeg.path, video, stripPath, { at, count: 12, fps: info.fps || 30 });
    result.strip = { file: rel(stripPath), ...strip };
  }
  if (values.phone) {
    const phonePath = join(dirname(out), `${basename(out, ".png")}-celular.png`);
    const phone = await phoneSheet(tools.ffmpeg.path, video, phonePath, { duration: info.duration });
    result.phone = { file: rel(phonePath), ...phone, width: 360 };
  }
  return result;
}

async function probeCommand(positionals) {
  const file = resolveInput(ROOT, positionals[0], { what: "o arquivo" });
  const tools = await requireTools({ browser: false });
  const info = await probe(tools.ffprobe.path, file);
  return { ok: true, command: "probe", interface_version: INTERFACE_VERSION, app: APP, ...info, file: rel(file), duration: round(info.duration) };
}

/** Opens a file in the member's own player or viewer. */
function openCommand(positionals) {
  const file = resolveInput(ROOT, positionals[0], { what: "o arquivo" });
  const child = WINDOWS
    ? spawn("cmd", ["/c", "start", "", file], { detached: true, stdio: "ignore", windowsHide: true })
    : spawn(MAC ? "open" : "xdg-open", [file], { detached: true, stdio: "ignore" });
  child.on("error", () => {});
  child.unref();
  return { ok: true, command: "open", interface_version: INTERFACE_VERSION, app: APP, file: rel(file) };
}

const HELP = `Motor de vídeo: transforma uma página animada (HTML com window.seek) em vídeo.

Uso: ${SCRIPT_COMMAND} <comando> [opções] [--json]

Comandos
  check                          O que esta máquina tem (ffmpeg, navegador) e o que o Motor consegue fazer.
  scaffold <pasta>               Cria pagina.html e motion.js prontos para editar e renderizar.
  render <pagina.html>           Renderiza a página em vídeo (--out video.mp4; .mov ou .webm com --alpha).
  preview <pagina.html>          Render rápido em metade do tamanho, para conferir.
  frames <pagina.html>           Fotografa instantes da página (--times, --every ou --beats) e monta a folha.
  sheet <video>                  Folha de contato de um vídeo pronto; --strip <tempo> e --phone acrescentam a tira e o teste de celular.
  probe <arquivo>                Duração, tamanho, quadros por segundo e áudio de um arquivo de mídia.
  open <arquivo>                 Abre o arquivo no player ou visualizador do integrante.
  help                           Esta ajuda.

Opções de render e preview
  --out <arquivo>                Saída (.mp4, .mov, .webm). Padrão: ao lado da página.
  --fps <n>                      Quadros por segundo (padrão: o film.fps da página, ou 30).
  --sub <n>                      Subquadros misturados em desfoque de movimento (1, 2 ou 4; padrão: 1).
  --format 9:16|4:5|3:4|1:1|16:9|WxH Tamanho do quadro; a página precisa de window.setFormat quando difere do dela.
  --scale <0.1 a 1>              Fração do tamanho (preview usa 0.5).
  --start <t> --end <t>          Só um trecho.
  --alpha                        Camada transparente (fundo transparente na página; saída .mov ou .webm).
  --frame-format png|jpeg        Como cada quadro é fotografado (padrão: png; preview usa jpeg).
  --crf <n>                      Qualidade do H.264 (padrão: 16; preview 23).
  --parallel <n>                 Navegadores em paralelo (padrão: automático pelos núcleos).
  --audio <arquivo>              Junta este áudio ao vídeo final.
  --browser <caminho>            Outro navegador (Edge, Chrome ou Chromium).

Opções de frames
  --times 0.5,1.2,3              Instantes; ou --every 0.5 (padrão); ou --beats beats.json [--downbeats].
  --out <pasta>                  Onde gravar os PNG (padrão: pasta quadros/ ao lado da página).
  --sheet <png> --cols <n>       A folha de contato (padrão: folha.png na pasta, 6 colunas).

Opções de sheet
  --fps <n> --cols <n> --tile-width <px>   Quadros por segundo da folha (2), colunas (6) e largura do quadrinho (270).
  --strip <tempo>                Tira de 12 quadros seguidos em volta do instante.
  --phone                        Teste de leitura a 360 px de largura, um quadro por segundo.

Formatos: ${Object.entries(FORMATS).map(([name, size]) => `${name} = ${size.width}x${size.height}`).join(" · ")}.`;

function helpText(groups) {
  const extraLines = groups.flatMap((group) => Object.entries(group.commands ?? {}).map(([name, command]) => `  ${name.padEnd(30)} ${command.summary ?? ""}`));
  const blocks = groups.map((group) => group.help).filter(Boolean);
  if (!extraLines.length) return HELP;
  return HELP.replace("  help                           Esta ajuda.", `${extraLines.join("\n")}\n  help                           Esta ajuda.`) + (blocks.length ? `\n\n${blocks.join("\n\n")}` : "");
}

function humanText(result, groups = []) {
  if (!result.ok) return [`Erro (${result.error.code}): ${result.error.message}`, result.error.fix && `Como resolver: ${result.error.fix}`].filter(Boolean).join("\n");
  for (const group of groups) {
    const command = group.commands?.[result.command];
    if (command?.text) return command.text(result);
  }
  const warnings = (result.warnings ?? []).map((warning) => `Aviso: ${warning}`);
  switch (result.command) {
    case "help":
      return result.text;
    case "check": {
      const lines = [
        `Motor de vídeo ${result.app.version} · Node ${result.node} · ${result.cores} núcleos`,
        `ffmpeg: ${result.tools.ffmpeg ?? "não encontrado"} · navegador: ${result.tools.browser ? `${result.tools.browser.name} (${result.tools.browser.path})` : "não encontrado"}`,
        `Render: ${result.modes.render ? "disponível" : "indisponível"} · folhas: ${result.modes.sheets ? "sim" : "não"} · carimbo de tempo: ${result.tools.drawtext ? "sim" : "não"}`,
      ];
      for (const [name, command] of Object.entries(result.install)) lines.push(`Instalar ${name}: ${command}`);
      if (result.install_note) lines.push(result.install_note);
      return lines.join("\n");
    }
    case "scaffold":
      return [`Criado: ${result.page} e ${result.runtime} (${result.format}, ${result.duration} s).`, `Próximo passo: ${result.next}`, `Guia da página: ${result.guide}`].join("\n");
    case "render":
    case "preview":
      return [
        `${result.command === "preview" ? "Prévia" : "Vídeo"} pronto: ${result.file} (${result.width}×${result.height}, ${result.fps} fps, ${result.frames} quadros, ${result.duration} s) em ${result.elapsed_s} s com ${result.workers} navegador(es).`,
        ...warnings,
      ].join("\n");
    case "frames":
      return [`${result.frames.length} quadro(s) em ${result.dir}${result.sheet ? `; folha: ${result.sheet}` : ""}.`, ...warnings].join("\n");
    case "sheet":
      return [`Folha: ${result.sheet}`, result.strip && `Tira: ${result.strip.file}`, result.phone && `Celular: ${result.phone.file}`].filter(Boolean).join("\n");
    case "probe":
      return `${result.file}: ${result.duration} s, ${result.width ?? "?"}×${result.height ?? "?"}, ${result.fps ?? "?"} fps, ${result.has_audio ? `áudio ${result.audio_codec}` : "sem áudio"}${result.has_alpha ? ", com transparência" : ""}.`;
    case "open":
      return `Aberto: ${result.file}`;
    default:
      return JSON.stringify(result, null, 2);
  }
}

async function main(argv, groups) {
  const [command, ...rest] = argv;
  if (!command || ["help", "--help", "-h"].includes(command)) return { ok: true, command: "help", text: helpText(groups) };
  const { positionals, values } = parseArgs(rest, mergedArgSpec(groups));
  for (const group of groups) {
    const extra = group.commands?.[command];
    if (extra) {
      const ctx = { root: ROOT, app: APP, appDir: APP_DIR, interfaceVersion: INTERFACE_VERSION, scriptCommand: SCRIPT_COMMAND, rel, requireTools, outputPath, progress };
      const result = await extra.run(positionals, values, ctx);
      return { ok: true, command, interface_version: INTERFACE_VERSION, app: APP, ...result };
    }
  }
  switch (command) {
    case "check":
      return checkCommand();
    case "scaffold":
      return scaffoldCommand(positionals, values);
    case "render":
      if (positionals.length !== 1) throw usage("Informe uma página: render <pagina.html> --out <video>.");
      return renderCommand(positionals, values);
    case "preview":
      if (positionals.length !== 1) throw usage("Informe uma página: preview <pagina.html> --out <video>.");
      return renderCommand(positionals, values, { preview: true });
    case "frames":
      if (positionals.length !== 1) throw usage("Informe uma página: frames <pagina.html> [--times …].");
      return framesCommand(positionals, values);
    case "sheet":
      if (positionals.length !== 1) throw usage("Informe um vídeo: sheet <video> --out <png>.");
      return sheetCommand(positionals, values);
    case "probe":
      if (positionals.length !== 1) throw usage("Informe um arquivo: probe <arquivo>.");
      return probeCommand(positionals);
    case "open":
      if (positionals.length !== 1) throw usage("Informe um arquivo: open <arquivo>.");
      return openCommand(positionals);
    default: {
      const names = ["check", "scaffold", "render", "preview", "frames", "sheet", "probe", "open", ...groups.flatMap((group) => Object.keys(group.commands ?? {})), "help"];
      throw usage(`Comando desconhecido: ${command}.`, `Comandos: ${names.join(", ")}.`);
    }
  }
}

const json = process.argv.includes("--json");
let loadedGroups = [];
loadExtras()
  .then((groups) => {
    loadedGroups = groups;
    return main(process.argv.slice(2), groups);
  })
  .then((result) => process.stdout.write(`${json ? JSON.stringify(result, null, 2) : humanText(result, loadedGroups)}\n`))
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
    // No process.exit() here: right after an HTTPS fetch (a capture error comes right after one) it
    // aborts Node 24 on Windows with a libuv assertion and exit code 127. The code is set and the
    // process ends on its own; the unref'd timer only acts if something still holds it after 3 s.
    process.exitCode = result.error.code === "usage" ? 2 : 1;
    setTimeout(() => process.exit(process.exitCode), 3000).unref();
  });
