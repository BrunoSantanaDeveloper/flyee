// The acceptance group. `accept` measures what a piece must meet before it is published: a
// page (a carousel slide, a loop, a film) the way the renderer opens it, a finished video
// against the networks table, or both at once. `networks` lists that table. A failed check
// is data (`ok: true`, `passed: false`); only a broken call is an error.

import { writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";

import {
  beatsFromBpm,
  beatsFromData,
  checkLine,
  cutsOnBeat,
  cutsStatus,
  deadTime,
  DEFAULTS,
  defaultPreset,
  durationCheck,
  firstFrameReadable,
  fixLine,
  flashes,
  formatName,
  formatSupport,
  groupViolations,
  loopStatus,
  loudnessCheck,
  makeCheck,
  MARKS,
  mergeLocalChange,
  minTextFor,
  parseLocalChange,
  parseSsim,
  PRESETS,
  safeAreaViolations,
  safeFor,
  sameRatio,
  sampleTimes,
  scoreOf,
  STILL_BY,
  summarize,
  textSizes,
} from "../lib/accept.mjs";
import { Browser } from "../lib/browser.mjs";
import { detectCuts, frameStats, measureLoudness, probe } from "../lib/ffmpeg.mjs";
import { defaultNetworks, listNetworks, loadNetworks, resolveNetworks } from "../lib/networks.mjs";
import { FORMATS, inspectPage, parseFormat } from "../lib/renderer.mjs";
import { checkTools, installHints } from "../lib/tools.mjs";
import { AppError, fileUrl, LIMITS, mediaLimit, parseList, parseNumber, removeDir, requireJson, resolveInput, round, run, tempDir, usage, writeJson } from "../lib/util.mjs";

export const argSpec = {
  flags: ["loop"],
  options: ["page", "video", "networks", "safe", "margin", "min-text", "bpm", "tolerance", "min-on-beat", "max-flashes", "max-still", "still-by", "lufs"],
};

const PAGE_EXTENSIONS = [".html", ".htm"];
const VIDEO_EXTENSIONS = [".mp4", ".m4v", ".mov", ".webm"];

/** Errors of the page itself become a failed `page` check; anything else (browser, files) is an error. */
const PAGE_FAILURES = new Set(["page_no_seek", "page_error", "page_load_failed", "page_no_duration", "format_unsupported", "browser_timeout"]);

const EDGE = { left: "à esquerda", right: "à direita", top: "em cima", bottom: "embaixo" };
const ROLE = { text: "texto", logo: "logo", face: "rosto" };
const CORNER = { counter: "sobre o contador 1/N", sound: "sobre o botão de som" };

const FIX = {
  first_frame_readable: (minText) => `O quadro 0 é a capa: deixe o título já no lugar e no tamanho final em t = 0 (uma entrada animada que começa ali deixa a capa vazia), com pelo menos ${minText} px.`,
  safe_area: {
    "instagram-carousel": "Mantenha texto, logo e rosto dentro de safe.rect e longe do contador 1/N (canto superior direito) e do botão de som (canto inferior direito).",
    networks: "Mantenha texto, logo e rosto dentro de safe.rect: fora dele a interface das redes cobre o vídeo (barras em cima, nome e legenda embaixo, botões à direita).",
    other: "Mantenha texto, logo e rosto dentro de safe.rect; o fundo e as formas decorativas podem sangrar.",
  },
  text_size: (minText) => `Aumente a fonte até pelo menos ${minText} px ou mostre menos texto por vez (Motion.fitText ajusta o tamanho à largura).`,
  cuts_on_beat: "Mova cada corte para grid.beat(n) da grade de batidas e arredonde ao quadro com Motion.toFrame(t, fps); um corte fora da batida por escolha pede --min-on-beat menor.",
  loop_seamless: "Faça o último quadro preparar o primeiro: Motion.loopT(t, duração), toda mola assentada antes do fim e cada elemento de volta à posição de t = 0.",
  flashes: "Menos alternância claro-escuro por segundo: transições pela cor, não pelo branco, e sem estrobo.",
  dead_time: "Dê vida ao trecho parado: uma deriva de fundo, um pulso na batida, um elemento que entra; o movimento precisa mudar pixels de verdade.",
};

const NO_PAGE = "Sem a página (--page)";
const NO_VIDEO = "Sem --video: passe o vídeo renderizado para medir.";

/** The boxes a page returned, as numbers; anything else is dropped. */
function normalizeBoxes(list) {
  const out = [];
  for (const item of Array.isArray(list) ? list : []) {
    if (!item || typeof item !== "object") continue;
    const size = Number(item.size);
    const box = {
      role: String(item.role ?? "").toLowerCase(),
      x: Number(item.x),
      y: Number(item.y),
      w: Number(item.w),
      h: Number(item.h),
      size: Number.isFinite(size) && size > 0 ? size : null,
      text: typeof item.text === "string" ? item.text.slice(0, 80) : null,
    };
    if ([box.x, box.y, box.w, box.h].every(Number.isFinite)) out.push(box);
  }
  return out;
}

function describeViolation(violation) {
  const parts = [...violation.edges.map((edge) => `${violation.overflow[edge]} px ${EDGE[edge]}`), ...violation.corners.map((name) => CORNER[name] ?? name)];
  const text = violation.text ? ` "${violation.text.slice(0, 30)}"` : "";
  const when = violation.until > violation.time ? `de ${violation.time} s a ${violation.until} s` : `em ${violation.time} s`;
  return `${ROLE[violation.role] ?? violation.role}${text} ${when} (${parts.join(", ")})`;
}

/** The safe area in words, for the summary of a pass. */
function describeSafe(safe, labels) {
  if (safe.preset === "instagram-carousel") return `margem de ${safe.margin} px, contador 1/N e botão de som livres`;
  if (safe.preset === "networks" && safe.networks.length) {
    const names = safe.networks.map((id) => labels[id] ?? id).join(", ");
    return `a mais estrita entre ${names}: ${safe.insets.top} px em cima, ${safe.insets.bottom} embaixo, ${safe.insets.left} à esquerda, ${safe.insets.right} à direita`;
  }
  return `${safe.rect.w}×${safe.rect.h} a partir de ${safe.rect.x},${safe.rect.y}`;
}

/** SSIM between two PNG files through ffmpeg; its summary goes to stderr at the info level. */
async function ssimBetween(ffmpegPath, first, last) {
  const result = await run(ffmpegPath, ["-hide_banner", "-nostats", "-i", first, "-i", last, "-lavfi", "ssim", "-f", "null", "-"], { timeoutMs: LIMITS.media });
  return { ssim: result.code === 0 ? parseSsim(result.stderr) : null, stderr: result.stderr };
}

/**
 * The largest change of one region of the picture from each frame to the next, for the dead time:
 * the difference of two frames is scaled down to DEFAULTS.localWidth pixels wide, so each pixel is
 * the mean change of a block, and its brightest pixel (0-255) is the frame's value. Returns
 * [{ time, value }] (none for the first frame), or null when ffmpeg could not measure it.
 */
async function localChange(ffmpegPath, video, { fps = null, timeoutMs } = {}) {
  const vf = `${fps ? `fps=${fps},` : ""}tblend=all_mode=difference,scale=${DEFAULTS.localWidth}:-2:flags=area,signalstats,metadata=print:key=lavfi.signalstats.YMAX:file=-`;
  const result = await run(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-i", video, "-an", "-vf", vf, "-f", "null", "-"], { timeoutMs });
  return result.code === 0 ? parseLocalChange(result.stdout.toString("utf8")) : null;
}

/**
 * How alike the two ends of a loop are. `frames` holds the two PNGs the page gave
 * ({ first, last }); without it, the first and the last frame are taken from the video.
 */
async function loopSsim(ffmpegPath, { frames = null, video = null }) {
  const dir = tempDir("flyee-accept-");
  try {
    const first = join(dir, "primeiro.png");
    const last = join(dir, "ultimo.png");
    if (frames) {
      writeFileSync(first, frames.first);
      writeFileSync(last, frames.last);
    } else {
      const quiet = ["-hide_banner", "-loglevel", "error", "-y"];
      // one frame each: seconds of work, so the least limit of a call over media
      const head = await run(ffmpegPath, [...quiet, "-i", video, "-map", "0:v:0", "-frames:v", "1", first], { timeoutMs: LIMITS.media });
      // the last three seconds are decoded and each frame overwrites the file: what stays is the last one
      const tail = await run(ffmpegPath, [...quiet, "-sseof", "-3", "-i", video, "-map", "0:v:0", "-update", "1", last], { timeoutMs: LIMITS.media });
      if (head.code !== 0 || tail.code !== 0) return { ssim: null, stderr: `${head.stderr}${tail.stderr}` };
    }
    return await ssimBetween(ffmpegPath, first, last);
  } finally {
    removeDir(dir);
  }
}

/**
 * Closes the browser and lets go of it. Browser.close() asks the browser to leave and kills
 * it, but a killed browser takes from a moment to minutes to disappear when the machine is
 * busy, and Node stays alive for every child process it still references: the result would
 * be printed and the command would hang around until the browser was really gone.
 * Unreferencing the process and its pipes lets this command end as soon as its result is
 * written; the browser ends by itself once its pipe closes. Never rejects.
 */
export function releaseBrowser(browser) {
  const child = browser.child;
  const closing = browser.close().catch(() => {});
  child?.unref?.();
  for (const stream of child?.stdio ?? []) stream?.unref?.();
  return closing;
}

/** Reads and validates the command line; nothing here opens a program. */
function parseCall(positionals, values, ctx) {
  if (positionals.length !== 1) {
    throw usage("Informe uma página ou um vídeo: accept <pagina.html | video.mp4> [--page pagina.html | --video video.mp4] [--networks reels,tiktok] [--beats beats.json | --bpm 120] [--loop].");
  }
  const first = resolveInput(ctx.root, positionals[0], { what: "a página HTML ou o vídeo" });
  const extension = extname(first).toLowerCase();
  const mode = PAGE_EXTENSIONS.includes(extension) ? "page" : VIDEO_EXTENSIONS.includes(extension) ? "video" : null;
  if (!mode) throw usage(`O primeiro argumento precisa ser uma página .html ou um vídeo .mp4, .mov ou .webm: ${positionals[0]}.`);
  if (mode === "page" && values.page !== undefined) throw usage("A página já é o primeiro argumento; --page acompanha um vídeo.", "Use accept <pagina.html> --video <video>, ou accept <video> --page <pagina.html>.");
  if (mode === "video" && values.video !== undefined) throw usage("O vídeo já é o primeiro argumento; --video acompanha uma página.", "Use accept <video> --page <pagina.html>, ou accept <pagina.html> --video <video>.");
  const page = mode === "page" ? first : values.page !== undefined ? resolveInput(ctx.root, values.page, { what: "a página HTML" }) : null;
  if (page && !PAGE_EXTENSIONS.includes(extname(page).toLowerCase())) throw usage(`A página precisa ser um arquivo .html: ${values.page}.`);
  const video = mode === "video" ? first : values.video !== undefined ? resolveInput(ctx.root, values.video, { what: "o vídeo" }) : null;

  const format = parseFormat(values.format);
  if (values.safe !== undefined && !PRESETS.includes(values.safe)) throw usage(`Área segura desconhecida: ${values.safe}.`, `Use ${PRESETS.join(", ")}.`);
  if (values["still-by"] !== undefined && !STILL_BY.includes(values["still-by"])) throw usage(`Medida do tempo parado desconhecida: ${values["still-by"]}.`, "Use regions (o padrão: qualquer região do quadro que muda conta como movimento) ou mean (só a mudança média do quadro inteiro).");
  const networkNames = values.networks !== undefined ? parseList(values.networks) : null;
  if (networkNames && !networkNames.length) throw usage("A opção --networks precisa de pelo menos uma rede.", "O comando networks lista as redes conhecidas.");
  const bpm = parseNumber(values.bpm, { name: "bpm", min: 30, max: 300, fallback: null });
  if (values.beats !== undefined && bpm !== null) throw usage("Use --beats ou --bpm, não os dois.");
  const beatsFile = values.beats !== undefined ? resolveInput(ctx.root, values.beats, { what: "o beats.json" }) : null;
  const fileBeats = beatsFile ? beatsFromData(requireJson(beatsFile, "o arquivo de batidas")) : null;
  if (fileBeats && !fileBeats.length) throw usage(`O beats.json não tem batidas: ${values.beats}.`, "Gere as batidas com synth ou beats, ou passe --bpm.");
  const report = mode === "video" ? ctx.outputPath(values, { fallback: join(dirname(video), `${basename(video, extname(video))}.aceite.json`) }) : ctx.outputPath(values, { required: false });
  return {
    mode,
    page,
    video,
    format,
    networkNames,
    safe: values.safe ?? null,
    margin: parseNumber(values.margin, { name: "margin", min: 0, max: 2000, fallback: null }),
    minText: parseNumber(values["min-text"], { name: "min-text", min: 8, max: 400, fallback: DEFAULTS.minText }),
    every: parseNumber(values.every, { name: "every", min: 0.05, max: 60, fallback: DEFAULTS.every }),
    bpm,
    beatsFile,
    fileBeats,
    fps: parseNumber(values.fps, { name: "fps", min: 1, max: 120, fallback: null }),
    tolerance: parseNumber(values.tolerance, { name: "tolerance", min: 0, max: 30, fallback: null }),
    minOnBeat: parseNumber(values["min-on-beat"], { name: "min-on-beat", min: 0, max: 1, fallback: null }),
    maxFlashes: parseNumber(values["max-flashes"], { name: "max-flashes", min: 0, max: 60, fallback: DEFAULTS.flashMax }),
    maxStill: parseNumber(values["max-still"], { name: "max-still", min: 0.1, max: 3600, fallback: DEFAULTS.stillSeconds }),
    stillBy: values["still-by"] ?? DEFAULTS.stillBy,
    lufs: parseNumber(values.lufs, { name: "lufs", min: -40, max: 0, fallback: DEFAULTS.lufs }),
    loop: Boolean(values.loop),
    browser: values.browser ?? null,
    report,
  };
}

/**
 * The size a page is laid out at when the call names no format and brings a video: the
 * video's shape when the page can recompose into it, the page's own size otherwise.
 * Returns the format to pass to window.setFormat, or null to keep the page's own.
 */
function layoutFromVideo(film, media, warnings) {
  const own = { width: film.width ?? 1080, height: film.height ?? 1920 };
  if (sameRatio(media, own)) return null;
  const name = media.format;
  if (!film.has_set_format) {
    warnings.push(`O vídeo tem ${media.width}×${media.height} (${name}) e a página ${own.width}×${own.height}, sem window.setFormat: as caixas foram lidas no tamanho da página. Confira se é o render desta página.`);
    return null;
  }
  if (FORMATS[name]) return { name, ...FORMATS[name] };
  warnings.push(`O vídeo tem um tamanho sem nome (${media.width}×${media.height}): a página foi recomposta nesse tamanho. Se ele veio de --scale, passe --format com o tamanho inteiro.`);
  return { name, width: media.width, height: media.height };
}

/**
 * Opens the page the way the renderer does and reads everything the checks need from it: the
 * film, the two frames of the loop and the boxes, instant by instant. Returns { failure }
 * with a failed `page` check when the page itself is broken. The browser is let go before
 * this returns, so nothing after it waits for it.
 */
async function readPage({ call, media, tools, beatsFor, warnings, progress, rel }) {
  const { format } = call;
  const url = fileUrl(call.page);
  progress(`Abrindo ${rel(call.page)}`);
  const viewport = { width: format?.width ?? 1080, height: format?.height ?? 1920 };
  const browser = await Browser.launch({ path: call.browser, ...viewport });
  let released = false;
  const release = () => {
    released = true;
    return releaseBrowser(browser);
  };
  try {
    const tab = await browser.newPage(viewport);
    const resize = async (width, height) => {
      if (viewport.width === width && viewport.height === height) return;
      await tab.setViewport(width, height, 1);
      Object.assign(viewport, { width, height });
    };

    // the page: loads, seeks, declares a duration, takes the format; otherwise nothing else can be measured
    let film;
    let layout = format;
    try {
      film = await inspectPage(tab, url);
      // a --format that is the page's own size needs no recomposition
      const ownSize = Boolean(format && film.width === format.width && film.height === format.height);
      if (ownSize) layout = null;
      if (format && !ownSize && !film.has_set_format) throw new AppError("format_unsupported", `A página não aceita o formato ${format.name}.`, "Defina window.setFormat({ name, width, height }) na página, ou confira no tamanho dela.");
      if (!format && media) layout = layoutFromVideo(film, media, warnings);
      if (layout) {
        await resize(layout.width, layout.height);
        await tab.evaluate(`window.setFormat(${JSON.stringify({ name: layout.name, width: layout.width, height: layout.height })})`);
      }
      if (!film.duration) throw new AppError("page_no_duration", "A página não diz a duração (window.film.duration).", "Declare o filme com Motion.setup({ duration, width, height, fps }).");
    } catch (error) {
      if (!(error instanceof AppError) || !PAGE_FAILURES.has(error.code)) throw error;
      release(); // in the background: the verdict does not wait for the browser to leave
      return { failure: makeCheck("page", "fail", error.message, [{ code: error.code, fix: error.fix }], error.fix) };
    }
    const width = layout?.width ?? film.width ?? 1080;
    const height = layout?.height ?? film.height ?? 1920;
    await resize(width, height);
    const fps = call.fps ?? film.fps ?? 30;
    const duration = film.duration;
    const cuts = (Array.isArray(film.cuts) ? film.cuts : []).map(Number).filter((t) => Number.isFinite(t));
    const beats = beatsFor(duration);

    // the two frames of the loop check, from the same tab
    let loopFrames = null;
    if (call.loop && tools.ffmpeg) {
      const lastTime = round(Math.max(0, duration - 1 / fps), 6);
      progress("Fotografando o primeiro e o último quadro");
      await tab.evaluate("window.__flyee.seek(0)", { timeoutMs: 30000 });
      const first = await tab.screenshot({ format: "png" });
      await tab.evaluate(`window.__flyee.seek(${lastTime})`, { timeoutMs: 30000 });
      const last = await tab.screenshot({ format: "png" });
      loopFrames = { first, last, lastTime };
    }

    // the boxes, instant by instant
    const sampling = sampleTimes({ duration, every: call.every, beats: beats ?? [], fps });
    if (sampling.thinned) warnings.push(`Página longa: as caixas foram lidas em ${sampling.times.length} instantes em vez de a cada ${call.every} s.`);
    let samples = null;
    if (film.has_boxes) {
      samples = [];
      progress(`Lendo as caixas em ${sampling.times.length} instante(s)`);
      for (const t of sampling.times) {
        const list = await tab.evaluate(`(async () => { await window.__flyee.seek(${t}); const b = window.boxes(${t}); return JSON.parse(JSON.stringify(Array.isArray(b) ? b : [])); })()`, { timeoutMs: 30000 });
        samples.push({ time: t, boxes: normalizeBoxes(list) });
      }
    } else warnings.push("A página não define window.boxes(t): a capa, o tamanho do texto e a área segura não foram conferidos. Devolva as caixas de texto, logo e rosto (ou Motion.domBoxes() numa página DOM).");
    const pageErrors = [...new Set([...tab.errors, ...tab.console])];
    if (pageErrors.length) warnings.push(`A página registrou erros durante a conferência: ${pageErrors.slice(0, 3).join(" | ")}`);
    release();
    return { film, width, height, fps, duration, cuts, beats, samples, loopFrames };
  } finally {
    if (!released) await releaseBrowser(browser);
  }
}

export const help = `Opções de accept
  accept <pagina.html> [--video <video>]   Confere a página (um slide de carrossel, um loop, um filme) e, com --video, o vídeo renderizado.
  accept <video> [--page <pagina.html>]    Confere um vídeo pronto contra as redes; com --page, também as caixas e os cortes exatos.
  --format 9:16|4:5|3:4|1:1|16:9|WxH  Tamanho conferido (padrão: o do vídeo quando há vídeo, senão o da página; outro tamanho pede window.setFormat).
  --networks reels,tiktok,shorts Redes de destino: formato aceito e duração de cada uma (o comando networks lista todas).
                                 Padrão: com o vídeo primeiro, as habituais do formato (9:16 → reels, tiktok, shorts; 4:5 e 1:1 → feed; 16:9 → youtube); com a página primeiro, nenhuma.
  --safe instagram-carousel|instagram-feed|networks|margin|none
                                 Área segura (padrão: networks quando há redes; senão instagram-carousel em 4:5 e 3:4, instagram-feed nos demais).
  --margin <px>                  Margem uniforme: vira a área segura margin, ou troca os 72 px do instagram-carousel.
  --min-text <px>                Menor texto legível a 1080 px de largura (padrão: 44; escala com a largura).
  --every <s>                    De quanto em quanto ler as caixas (padrão: 0.25); cada batida também é lida.
  --beats <beats.json> | --bpm <n>  As batidas: cortes na batida e instantes lidos.
  --tolerance <quadros>          Quanto um corte pode ficar da batida (padrão: 1 quadro nos cortes de film.cuts; 2 nos cortes achados no vídeo).
  --min-on-beat <0 a 1>          Fração mínima de cortes na batida (padrão: 1 nos cortes de film.cuts; 0.7 nos achados no vídeo).
  --loop                         Compara o último quadro com o primeiro (SSIM pelo ffmpeg).
  --max-flashes <n>              Mudanças bruscas de luz toleradas em 1 s (padrão: 3).
  --max-still <s>                Trecho parado a partir do qual avisa (padrão: 1.5).
  --still-by regions|mean        Como o tempo parado é medido: regions (padrão) conta qualquer região que muda, como um texto sendo digitado ou um zoom lento;
                                 mean conta só a mudança média do quadro inteiro, e um enfeite pequeno que se mexe sempre não segura o trecho.
  --lufs <n>                     Volume alvo em LUFS (padrão: -14, com 1.5 LU de folga e pico real até -1 dBTP).
  --fps <n>                      Taxa de quadros da tolerância e do último quadro (padrão: a da página, ou a do vídeo).
  --out <relatorio.json>         Grava o relatório (padrão: <video>.aceite.json ao lado do vídeo quando ele vem primeiro; com a página primeiro, só com --out).
  --browser <caminho>            Outro navegador (Edge, Chrome ou Chromium).

Opções de networks
  (sem opções)                   A tabela vem de references/redes.json, com a data da última conferência.`;

export const commands = {
  accept: {
    summary: "Confere uma página, um vídeo pronto ou os dois: capa, área segura, texto, cortes na batida, loop, piscadas, tempo parado, volume e, por rede, formato e duração.",
    help,
    async run(positionals, values, ctx) {
      const call = parseCall(positionals, values, ctx);
      let loaded = null;
      const table = () => (loaded ??= loadNetworks(ctx.appDir)); // read only by the calls that need the networks
      // unknown_network comes out here, before any program opens
      const named = call.networkNames ? resolveNetworks(call.networkNames, null, table()) : null;
      const tools = call.mode === "video" ? await ctx.requireTools({ browser: Boolean(call.page) }) : await checkTools();
      if (call.page && !tools.browser) await ctx.requireTools(); // throws tools_missing with the install steps
      const canMeasure = Boolean(tools.ffmpeg && tools.ffprobe);
      const hints = installHints();
      const noFfmpeg = `Sem ffmpeg nesta máquina; instale com ${hints.ffmpeg}. ${hints.note}`;
      const warnings = [];
      const checks = [];
      const info = {
        mode: call.mode,
        page: call.page ? ctx.rel(call.page) : null,
        video: call.video ? ctx.rel(call.video) : null,
        format: call.format?.name ?? null,
        width: call.format?.width ?? null,
        height: call.format?.height ?? null,
        duration: null,
        fps: call.fps,
        safe: null,
        min_text: null,
        beats: null,
        samples: 0,
        cuts: 0,
        cuts_source: null,
        media: null,
        networks: [],
        network_labels: {},
        networks_default: false,
        limits: null,
      };
      const finish = () => {
        const { passed, counts } = summarize(checks);
        const result = {
          ...info,
          passed,
          counts,
          score: scoreOf(checks),
          checks,
          report: call.report ? ctx.rel(call.report) : null,
          guide: ctx.rel(join(ctx.appDir, "references", "aceite.md")),
          warnings: [...new Set(warnings)],
        };
        if (call.report) writeJson(call.report, { app: ctx.app, interface_version: ctx.interfaceVersion, command: "accept", ...result });
        return result;
      };

      // the video: what it is, before anything is measured on it
      let media = null;
      if (call.video && canMeasure) {
        ctx.progress(`Lendo ${ctx.rel(call.video)}`);
        const probed = await probe(tools.ffprobe.path, call.video);
        if (!probed.width || !probed.height) throw new AppError("no_video_stream", `O arquivo não tem imagem: ${ctx.rel(call.video)}.`, "Passe o vídeo renderizado (.mp4, .mov ou .webm).");
        media = {
          format: formatName(probed.width, probed.height),
          width: probed.width,
          height: probed.height,
          duration: round(probed.duration),
          fps: probed.fps || null,
          has_audio: probed.has_audio,
          size_mb: probed.size ? round(probed.size / (1024 * 1024), 2) : null,
        };
        info.media = media;
      } else if (call.video) warnings.push(noFfmpeg);

      // the page: the film, the frames of the loop and the boxes
      const beatsFor = (duration) => call.fileBeats ?? (call.bpm !== null ? beatsFromBpm(call.bpm, duration) : null);
      let page = null;
      if (call.page) {
        page = await readPage({ call, media, tools, beatsFor, warnings, progress: ctx.progress, rel: ctx.rel });
        if (page.failure) {
          checks.push(page.failure);
          return finish();
        }
      }

      // the frame every check reasons about: the page's layout when there is a page, the video's pixels otherwise
      const width = page ? page.width : media.width;
      const height = page ? page.height : media.height;
      const duration = page ? page.duration : media.duration;
      const fps = page ? page.fps : (call.fps ?? media.fps ?? 30);
      const frameFormat = page || !call.format ? formatName(width, height) : formatName(call.format.width, call.format.height);
      // the format the piece is published in: the one asked for, the video's, or the page's
      const publishFormat = call.format ? formatName(call.format.width, call.format.height) : media ? media.format : frameFormat;
      if (media && call.format && !sameRatio(media, call.format)) {
        warnings.push(`O vídeo tem ${media.width}×${media.height} (${media.format}), mas --format pediu ${call.format.name}; a conferência seguiu ${call.format.name}.`);
      }
      if (media && page && Math.abs(media.duration - duration) > 0.5) warnings.push(`O vídeo dura ${round(media.duration, 2)} s e a página ${round(duration)} s: confira se é o render desta página.`);

      // the destinations: the ones named, or the usual ones of the format when a video comes first
      const networkList = named ?? (call.mode === "video" ? defaultNetworks(publishFormat, table()) : []);
      const labels = Object.fromEntries(networkList.map((network) => [network.id, network.label]));
      if (call.mode === "video" && !named && !networkList.length) warnings.push(`Nenhuma rede habitual para o formato ${publishFormat}: passe --networks para conferir formato e duração por rede.`);

      const beats = page ? page.beats : beatsFor(duration);
      const minText = minTextFor(width, call.minText);
      const safePreset = call.safe ?? (call.margin !== null ? "margin" : defaultPreset(frameFormat, networkList.length > 0));
      const safe = safeFor({ preset: safePreset, width, height, margin: call.margin, networks: networkList, format: frameFormat });
      if (safe.rect && (safe.rect.w <= 0 || safe.rect.h <= 0)) throw usage(`A margem de ${call.margin} px não deixa área útil em ${width}×${height}.`);
      if (call.margin !== null && ["instagram-feed", "networks", "none"].includes(safePreset)) warnings.push(`--margin não se aplica à área segura ${safePreset}; foi ignorado.`);
      if (safePreset === "networks" && !networkList.length) warnings.push("--safe networks sem redes de destino: valeu a zona do próprio formato. Passe --networks para usar a das redes.");
      if (safePreset !== "none" && FORMATS[safe.format] && safe.format !== frameFormat) warnings.push(`Tamanho sem nome (${width}×${height}): a área segura veio do formato mais próximo, ${safe.format}.`);

      // the cuts: exact from the page; found in the video only when there is no page to declare them
      let cuts = page ? page.cuts : [];
      let cutsSource = page ? "page" : null;
      if (!page && media && beats) {
        ctx.progress("Procurando os cortes no vídeo");
        cuts = (await detectCuts(tools.ffmpeg.path, call.video, { timeoutMs: mediaLimit(media.duration) })).map((t) => round(t, 3));
        cutsSource = "video";
      }
      const detected = cutsSource === "video";
      const toleranceFrames = call.tolerance ?? (detected ? DEFAULTS.detectedToleranceFrames : DEFAULTS.toleranceFrames);
      const minOnBeat = call.minOnBeat ?? (detected ? DEFAULTS.detectedMinOnBeat : DEFAULTS.minOnBeat);

      Object.assign(info, {
        format: call.format?.name ?? frameFormat,
        width,
        height,
        duration: round(duration),
        fps,
        safe: { preset: safePreset, rect: safe.rect, corners: safe.corners, margin: safe.margin, networks: safe.networks, insets: safe.insets },
        min_text: minText,
        beats: beats ? { source: call.fileBeats ? "file" : "bpm", file: call.beatsFile ? ctx.rel(call.beatsFile) : null, bpm: call.bpm ?? null, count: beats.length } : null,
        samples: page?.samples ? page.samples.length : 0,
        cuts: cuts.length,
        cuts_source: cutsSource,
        networks: networkList.map((network) => network.id),
        network_labels: labels,
        networks_default: call.mode === "video" && !named,
        limits: {
          min_text: minText,
          tolerance_frames: toleranceFrames,
          tolerance_s: round(toleranceFrames / fps, 4),
          min_on_beat: minOnBeat,
          max_flashes: call.maxFlashes,
          max_still: call.maxStill,
          still_by: call.stillBy,
          still_mean: DEFAULTS.stillYdif,
          still_local: call.stillBy === "regions" ? DEFAULTS.stillLocal : null,
          lufs: call.lufs,
          lufs_tolerance: DEFAULTS.lufsTolerance,
          true_peak: DEFAULTS.truePeak,
        },
      });

      // 1. the page
      const samples = page?.samples ?? null;
      const noBoxes = "Sem window.boxes(t) na página.";
      if (!page) checks.push(makeCheck("page", "skip", `${NO_PAGE}: só o vídeo foi medido. Com ela entram a capa, a área segura, o tamanho do texto e os cortes exatos.`));
      else {
        const film = page.film;
        checks.push(makeCheck("page", "pass", `Carrega, define seek(t) e dura ${round(duration)} s${cuts.length ? `, com ${cuts.length} corte(s) declarado(s)` : ""}${film.has_boxes ? "" : ", mas não define window.boxes(t)"}.`));
      }

      // 2. the cover: frame 0 must carry a readable text
      if (!page) checks.push(makeCheck("first_frame_readable", "skip", `${NO_PAGE}: não dá para saber o que está escrito no quadro 0.`));
      else if (!samples) checks.push(makeCheck("first_frame_readable", "skip", `${noBoxes} Não dá para saber o que está escrito no quadro 0.`));
      else {
        const at0 = samples[0].boxes;
        const first = firstFrameReadable(at0, minText);
        const details = at0.filter((box) => box.role === "text" && box.size).sort((a, b) => b.size - a.size).slice(0, 5).map((box) => ({ time: 0, size: round(box.size, 1), text: box.text }));
        const summary = first.readable
          ? `Texto de ${first.largest} px no quadro 0 (mínimo ${minText} px).`
          : first.count
            ? `O maior texto do quadro 0 tem ${first.largest} px; o mínimo é ${minText} px.`
            : "O quadro 0 não tem texto: a capa precisa ser lida parada.";
        checks.push(makeCheck("first_frame_readable", first.readable ? "pass" : "fail", summary, details, FIX.first_frame_readable(minText)));
      }

      // 3. the safe area
      if (safePreset === "none") checks.push(makeCheck("safe_area", "skip", "Área segura desligada (--safe none)."));
      else if (!page) checks.push(makeCheck("safe_area", "skip", `${NO_PAGE}: não dá para saber onde o texto, o logo e o rosto ficam.`));
      else if (!samples) checks.push(makeCheck("safe_area", "skip", `${noBoxes} Não dá para saber onde o texto, o logo e o rosto ficam.`));
      else {
        const violations = safeAreaViolations(samples, safe);
        const offenders = groupViolations(violations);
        const instants = new Set(violations.map((item) => item.time)).size;
        const summary = offenders.length
          ? `${offenders.length} caixa(s) fora da área segura ${safePreset} em ${instants} de ${samples.length} instantes; pior: ${describeViolation(offenders[0])}.`
          : `Texto, logo e rosto dentro da área segura ${safePreset} (${describeSafe(safe, labels)}) em ${samples.length} instantes.`;
        checks.push(makeCheck("safe_area", offenders.length ? "fail" : "pass", summary, offenders.slice(0, 8), FIX.safe_area[safePreset] ?? FIX.safe_area.other));
      }

      // 4. the text size over every instant
      if (!page) checks.push(makeCheck("text_size", "skip", `${NO_PAGE}: não dá para medir o texto.`));
      else if (!samples) checks.push(makeCheck("text_size", "skip", `${noBoxes} Não dá para medir o texto.`));
      else {
        const sizes = textSizes(samples, minText);
        const smallList = sizes.small.slice(0, 3).map((item) => `${item.size} px em ${item.time} s${item.text ? ` ("${item.text.slice(0, 30)}")` : ""}`).join(", ");
        const summary =
          sizes.status === "skip"
            ? sizes.unsized ? "As caixas de texto não trazem o tamanho da fonte (size)." : "Nenhuma caixa de texto nos instantes lidos."
            : sizes.status === "pass"
              ? `Menor texto: ${sizes.smallest} px (mínimo ${minText} px).`
              : sizes.status === "warn"
                ? `Menor texto: ${sizes.smallest} px, abaixo do mínimo de ${minText} px (reprova abaixo de ${sizes.fail_below} px): ${smallList}.`
                : `Texto de ${sizes.smallest} px, abaixo de ${sizes.fail_below} px (mínimo ${minText} px): ${smallList}.`;
        checks.push(makeCheck("text_size", sizes.status, summary, sizes.small.slice(0, 8), FIX.text_size(minText)));
      }

      // 5. cuts on the beat
      if (page && !cuts.length) checks.push(makeCheck("cuts_on_beat", "skip", "A página não declara cortes (film.cuts)."));
      else if (!beats) checks.push(makeCheck("cuts_on_beat", "skip", page ? "Sem batidas: passe --beats beats.json ou --bpm para conferir os cortes." : `Sem batidas: passe --beats beats.json ou --bpm para conferir os cortes do vídeo. ${NO_PAGE}: com ela, os cortes vêm exatos de film.cuts.`));
      else if (!cuts.length) checks.push(makeCheck("cuts_on_beat", "skip", `Nenhum corte encontrado no vídeo. ${NO_PAGE}: com ela, os cortes vêm exatos de film.cuts.`));
      else {
        const onBeat = cutsOnBeat(cuts, beats, fps, { frames: toleranceFrames });
        const status = cutsStatus(onBeat, minOnBeat);
        const misses = onBeat.off.slice(0, 4).map((miss) => `${miss.cut} s (batida mais próxima em ${miss.nearest} s)`).join(", ");
        const tolerance = `tolerância de ${toleranceFrames} quadro${toleranceFrames === 1 ? "" : "s"} = ${onBeat.tolerance} s`;
        const origin = detected ? "achado(s) no vídeo" : "de film.cuts";
        const share = minOnBeat < 1 ? `; ${Math.round(onBeat.ratio * 100)}% na batida, mínimo ${Math.round(minOnBeat * 100)}%` : "";
        const summary = onBeat.off.length
          ? `${onBeat.off.length} de ${onBeat.total} corte(s) ${origin} fora da batida (${tolerance}${share}): ${misses}${onBeat.off.length > 4 ? "…" : ""}.`
          : `${onBeat.on.length} de ${onBeat.total} corte(s) ${origin} caem numa batida (${tolerance}).`;
        const fix = detected ? `${FIX.cuts_on_beat} Com --page, os cortes vêm exatos de film.cuts.` : FIX.cuts_on_beat;
        checks.push(makeCheck("cuts_on_beat", status, summary, onBeat.off, fix));
      }

      // the frames of the video, measured once for the loop, the flashes and the dead time
      let frames = null;
      if (media) {
        ctx.progress(`Medindo os quadros de ${ctx.rel(call.video)}`);
        const rate = media.fps > DEFAULTS.statsFps ? { fps: DEFAULTS.statsFps } : {};
        // each pass decodes the whole video: its limit grows with the duration
        const pass = { ...rate, timeoutMs: mediaLimit(media.duration) };
        frames = await frameStats(tools.ffmpeg.path, call.video, pass);
        const local = call.stillBy === "regions" ? await localChange(tools.ffmpeg.path, call.video, pass) : null;
        if (local?.length) frames = mergeLocalChange(frames, local);
        else if (call.stillBy === "regions" && frames.length > 1) warnings.push("Não consegui medir a mudança por região do quadro: o tempo parado usou só a mudança média, que não vê um texto sendo digitado nem um zoom lento.");
      }

      // 6. the loop: the last frame against the first, from the page when there is one
      if (!call.loop) checks.push(makeCheck("loop_seamless", "skip", "Não pedido; passe --loop num vídeo que repete."));
      else if (!tools.ffmpeg) {
        checks.push(makeCheck("loop_seamless", "skip", "Sem ffmpeg para comparar o último quadro com o primeiro."));
        warnings.push(noFfmpeg);
      } else {
        ctx.progress("Comparando o último quadro com o primeiro");
        const source = page ? "page" : "video";
        const lastTime = page ? page.loopFrames.lastTime : round(frames?.length ? frames[frames.length - 1].time : Math.max(0, media.duration - 1 / fps), 6);
        const { ssim, stderr } = await loopSsim(tools.ffmpeg.path, page ? { frames: page.loopFrames } : { video: call.video });
        const status = loopStatus(ssim);
        if (status === "skip") {
          checks.push(makeCheck("loop_seamless", "skip", "Não consegui medir a semelhança entre o último quadro e o primeiro."));
          warnings.push(`O ffmpeg não devolveu o SSIM: ${stderr.trim().split("\n").slice(-2).join(" ")}`);
        } else {
          const verdict = status === "pass" ? "emenda limpa" : status === "warn" ? "quase igual, pode saltar" : "salto visível";
          const where = page ? "" : " do vídeo";
          checks.push(makeCheck("loop_seamless", status, `SSIM ${round(ssim, 4)} entre o último quadro${where} (${lastTime} s) e o primeiro: ${verdict} (passa de ${DEFAULTS.ssimPass}, avisa de ${DEFAULTS.ssimWarn}).`, [{ ssim: round(ssim, 4), first: 0, last: lastTime, source }], FIX.loop_seamless));
        }
      }

      // 7. flashes and dead time, measured on the video
      if (!call.video) {
        checks.push(makeCheck("flashes", "skip", NO_VIDEO));
        checks.push(makeCheck("dead_time", "skip", NO_VIDEO));
      } else if (!media) {
        checks.push(makeCheck("flashes", "skip", "Sem ffmpeg para medir os quadros do vídeo."));
        checks.push(makeCheck("dead_time", "skip", "Sem ffmpeg para medir os quadros do vídeo."));
      } else if (!frames.length) {
        checks.push(makeCheck("flashes", "skip", "O ffmpeg não devolveu quadros do vídeo."));
        checks.push(makeCheck("dead_time", "skip", "O ffmpeg não devolveu quadros do vídeo."));
      } else {
        const strobe = flashes(frames, { max: call.maxFlashes });
        const flashSummary = strobe.over
          ? `${strobe.worst.count} mudanças bruscas de luz em 1 s perto de ${strobe.worst.at} s (limite ${strobe.max}).`
          : strobe.transitions
            ? `No máximo ${strobe.worst.count} mudança(s) brusca(s) de luz por segundo (limite ${strobe.max}).`
            : "Nenhuma mudança brusca de luz.";
        checks.push(makeCheck("flashes", strobe.over ? "warn" : "pass", flashSummary, strobe.windows.slice(0, 8), FIX.flashes));
        const still = deadTime(frames, { min: call.maxStill });
        const stillSummary = still.over
          ? `A tela fica parada ${still.longest.seconds} s, de ${still.longest.from} s a ${still.longest.to} s (limite ${still.min} s).`
          : still.longest
            ? `Maior trecho parado: ${still.longest.seconds} s (limite ${still.min} s).`
            : "A tela muda em todos os quadros.";
        checks.push(makeCheck("dead_time", still.over ? "warn" : "pass", stillSummary, still.runs.slice(0, 8), FIX.dead_time));
      }

      // 8. the loudness of the video's sound
      if (!call.video) checks.push(makeCheck("loudness", "skip", NO_VIDEO));
      else if (!media) checks.push(makeCheck("loudness", "skip", "Sem ffmpeg para medir o volume do vídeo."));
      else if (!media.has_audio) checks.push(makeCheck("loudness", "skip", "O vídeo não tem áudio."));
      else {
        ctx.progress("Medindo o volume");
        const loud = loudnessCheck(await measureLoudness(tools.ffmpeg.path, call.video), { target: call.lufs });
        const details = loud.integrated === null ? [] : [{ integrated_lufs: loud.integrated, true_peak_dbtp: loud.true_peak, offset_lu: loud.offset, target_lufs: loud.target, tolerance_lu: loud.tolerance, true_peak_limit_dbtp: loud.true_peak_limit }];
        checks.push(makeCheck("loudness", loud.status, loud.summary, details, loud.fix));
      }

      // 9. each destination: does it take this format, does the duration fit
      if (networkList.length) {
        const published = media ?? { width, height, duration };
        for (const item of formatSupport(publishFormat, networkList, { width: published.width, height: published.height })) checks.push(makeCheck("format_supported", item.status, item.summary, item.details, item.fix, item.network));
        for (const item of durationCheck(published.duration, networkList)) checks.push(makeCheck("duration", item.status, item.summary, item.details, item.fix, item.network));
        for (const network of networkList) {
          if (!media?.size_mb || !network.max_file_mb || media.size_mb <= network.max_file_mb) continue;
          warnings.push(`O arquivo tem ${media.size_mb} MB e ${network.label} aceita até ${network.max_file_mb} MB: renderize com --crf 20 ou 23, que encolhe o arquivo quase sem mudar a imagem.`);
        }
      }
      return finish();
    },
    text(result) {
      const score = result.score;
      const subject = result.mode === "video" ? `${result.video}${result.page ? ` com ${result.page}` : ""}` : `${result.page}${result.video ? ` com ${result.video}` : ""}`;
      const size = result.width && result.height ? `${result.format}, ${result.width}×${result.height}` : "tamanho desconhecido";
      const lines = [`Aceite de ${subject} (${size}, ${result.duration ?? "?"} s, ${result.fps ?? "?"} fps): ${result.passed ? "APROVADO" : "REPROVADO"} · ${score.passed} ${MARKS.pass} · ${score.failed} ${MARKS.fail} · ${score.warned} ${MARKS.warn} · ${score.skipped} ${MARKS.skip}`];
      if (result.networks.length) lines.push(`Redes: ${result.networks.map((id) => result.network_labels[id] ?? id).join(", ")}${result.networks_default ? " (as habituais do formato)" : ""}`);
      for (const check of result.checks) {
        lines.push(checkLine(check, result.network_labels));
        const fix = fixLine(check);
        if (fix) lines.push(fix);
      }
      for (const warning of result.warnings) lines.push(`Aviso: ${warning}`);
      if (result.report) lines.push(`Relatório: ${result.report}`);
      return lines.join("\n");
    },
  },

  networks: {
    summary: "Lista as redes que o accept conhece: formatos, durações, zonas seguras e legendas.",
    help: "  (sem opções)                   A tabela vem de references/redes.json, com a data da última conferência.",
    async run(_positionals, _values, ctx) {
      const table = loadNetworks(ctx.appDir);
      return {
        checked_on: table.checked_on,
        note: table.note,
        loudness_note: table.loudness_note,
        formats: table.formats,
        defaults_by_format: table.defaults_by_format,
        networks: listNetworks(table).map((network) => ({ ...network, safe_zone: table.networks[network.id].safe_zone })),
        table: ctx.rel(join(ctx.appDir, "references", "redes.json")),
        guide: ctx.rel(join(ctx.appDir, "references", "aceite.md")),
      };
    },
    text(result) {
      const lines = [`Redes conhecidas (conferidas em ${result.checked_on}):`];
      for (const network of result.networks) {
        const max = network.max_duration_s === null ? "sem limite" : `${network.max_duration_s} s`;
        const recommended = network.recommended_duration_s === null ? "" : ` · recomendado ${network.recommended_duration_s} s`;
        lines.push(`  ${network.id.padEnd(16)} ${network.label} · ${network.formats.join(", ")} (melhor ${network.recommended_format}) · até ${max}${recommended}`);
      }
      lines.push(`Tabela: ${result.table} · Guia: ${result.guide}`);
      return lines.join("\n");
    },
  },
};
