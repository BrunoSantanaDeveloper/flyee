#!/usr/bin/env node
// Video analysis: the commands the member's AI and other apps run.
//   node .flyee/modules/video-analysis/scripts/video.mjs <command> [options] [--json]
// The full interface is in references/interface.md.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readCaptions } from "./lib/captions.mjs";
import { buildPrompt, descriptionHeader, renderDescription } from "./lib/description.mjs";
import { buildGrids, extractFrames, gridLayout, measureSignals, mergeCuts, pickFrames, probe, stillChanges } from "./lib/frames.mjs";
import { DEFAULT_BASE_URL, DEFAULT_MODEL, generate, parseJsonReply, RESOLUTIONS, uploadFile, uploadStillValid, videoPart } from "./lib/gemini.mjs";
import { identifySource, looksLikeId, videoMime } from "./lib/source.mjs";
import {
  ANALYSES_DIR,
  ensureAnalysesDir,
  listDescriptions,
  lockAnalysis,
  measurementLines,
  newAnalysis,
  readAnalysis,
  saveAnalysis,
  sourceFromAnalysis,
  sourceSummary,
  writeIndex,
  writeTranscript,
} from "./lib/store.mjs";
import { checkTools, geminiKey, gridFont, installHints, keySetup } from "./lib/tools.mjs";
import {
  AppError,
  displayPath,
  fileTime,
  formatTime,
  parseArgs,
  parseTime,
  progress,
  projectRoot,
  readJson,
  removeDir,
  run,
  shortHash,
  slugify,
  toPosix,
  writeFileAtomic,
  writeJson,
} from "./lib/util.mjs";
import { downloadCaptions, downloadVideo, fetchMetadata, pickCaptionTrack, summarizeMetadata } from "./lib/ytdlp.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(SCRIPTS_DIR, "..");
const ROOT = projectRoot(SCRIPTS_DIR);
const MANIFEST = readJson(join(APP_DIR, "flyee.module.json"), {});
const APP = { name: MANIFEST.name ?? "video-analysis", version: MANIFEST.version ?? "0.0.0" };
const INTERFACE_VERSION = 1;
const FOCUSES = ["general", "editing", "content"];
const MODES = ["auto", "local", "gemini", "both"];
const DENSITIES = { low: 24, normal: 48, high: 96 };
const QUALITIES = [240, 360, 480, 720, 1080];
const NOT_PUBLIC = new Set(["unlisted", "private", "needs_auth", "subscriber_only", "premium_only"]);
const FALLBACK_CODES = new Set(["gemini_video_inaccessible", "gemini_quota", "gemini_unavailable", "gemini_too_long", "gemini_refused", "offline"]);
const UPLOAD_LIMIT = 2 * 1024 ** 3;
const SCRIPT_COMMAND = `node ${toPosix(ROOT, join(SCRIPTS_DIR, "video.mjs"))}`;
const ARG_SPEC = {
  flags: ["json", "refresh", "keep-video", "allow-upload"],
  options: [
    "focus", "question", "instructions", "name", "mode", "start", "end", "density", "max-frames", "quality",
    "threshold", "lang", "model", "fps", "resolution", "cookies-from-browser", "dir", "gemini-url",
  ],
};

const rel = (path) => toPosix(ROOT, path);
const round = (value) => Math.round(value * 1000) / 1000;
const usage = (message, fix = "Rode o comando `help` para ver as opções.") => new AppError("usage", message, fix);

function analysesDir(option) {
  return option ? resolve(ROOT, option) : join(ROOT, ANALYSES_DIR);
}

function projectLang() {
  return readJson(join(ROOT, ".flyee", "lock.json"))?.locale === "en" ? "en" : "pt-BR";
}

function installText(missing) {
  const hints = installHints();
  const lines = [...new Set(missing.map((name) => (name === "ffprobe" ? "ffmpeg" : name)))].map((name) => `${name}: ${hints[name]}`);
  return `Instale: ${lines.join("; ")}.${hints.note ? ` ${hints.note}` : ""}`;
}

/** How to get and save the Gemini key. The address is the one the app declares for its credential. */
function geminiSetup() {
  const credential = (MANIFEST.external_credentials ?? []).find((item) => item.env === "GEMINI_API_KEY");
  return { key_url: credential?.url ?? null, ...keySetup() };
}

function geminiSetupText() {
  const setup = geminiSetup();
  // Written for the member's AI, one step per line: it runs the command; the member only pastes the key in the browser.
  return [
    `O integrante cria a chave no Google AI Studio${setup.key_url ? ` (${setup.key_url})` : ""}, com a conta Google dele; o Google não cobra por ela no uso comum.`,
    "Para salvá-la, rode você mesmo:",
    `  ${setup.command}`,
    setup.how,
    setup.after,
    "Nunca cole a chave no chat.",
  ].join("\n");
}

function readInstructions(path) {
  const found = [resolve(process.cwd(), path), resolve(ROOT, path)].find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
  if (!found) throw new AppError("file_not_found", `Não encontrei o arquivo de instruções ${path}.`);
  const content = readFileSync(found, "utf8");
  if (content.length > 20000) throw usage("O arquivo de instruções passa de 20 mil caracteres.", "Resuma as instruções: elas entram em todo pedido.");
  return { path: found, content };
}

function outputName({ name, focus, question, instructions, start, end }) {
  if (name) return slugify(name, 60);
  let base = question ? `question-${shortHash(question, 6)}` : instructions ? `${focus}-${shortHash(instructions.content, 6)}` : focus;
  if (start !== null || end !== null) base += `-${fileTime(start ?? 0)}-${end !== null ? fileTime(end) : "end"}`;
  return base;
}

function analysisOptions(values) {
  const focus = values.focus ?? "general";
  if (!FOCUSES.includes(focus)) throw usage(`Foco desconhecido: ${focus}.`, `Use um destes: ${FOCUSES.join(", ")}.`);
  const mode = values.mode ?? "auto";
  if (!MODES.includes(mode)) throw usage(`Modo desconhecido: ${mode}.`, `Use um destes: ${MODES.join(", ")}.`);
  const lang = values.lang ?? projectLang();
  if (!["pt-BR", "en"].includes(lang)) throw usage(`Idioma não suportado: ${lang}.`, "Use pt-BR ou en.");
  const start = values.start !== undefined ? parseTime(values.start) : null;
  const end = values.end !== undefined ? parseTime(values.end) : null;
  if (start !== null && end !== null && end <= start) throw usage("--end precisa ser depois de --start.");
  let maxFrames = DENSITIES[values.density ?? "normal"];
  if (!maxFrames) throw usage(`Densidade desconhecida: ${values.density}.`, "Use low, normal ou high.");
  if (values["max-frames"] !== undefined) {
    maxFrames = Number(values["max-frames"]);
    if (!Number.isInteger(maxFrames) || maxFrames < 4 || maxFrames > 300) throw usage("--max-frames vai de 4 a 300.");
  }
  const quality = values.quality !== undefined ? Number(values.quality) : null;
  if (quality !== null && !QUALITIES.includes(quality)) throw usage(`Qualidade inválida: ${values.quality}.`, `Use ${QUALITIES.join(", ")}.`);
  const threshold = values.threshold !== undefined ? Number(values.threshold) : 0.3;
  if (!(threshold >= 0.05 && threshold <= 0.9)) throw usage("--threshold vai de 0.05 a 0.9 (menor encontra mais cortes).");
  const fps = values.fps !== undefined ? Number(values.fps) : null;
  if (fps !== null && !(fps > 0 && fps <= 10)) throw usage("--fps vai de 0.1 a 10.");
  const resolution = values.resolution ?? null;
  if (resolution && !RESOLUTIONS[resolution]) throw usage(`Resolução desconhecida: ${resolution}.`, "Use low, medium ou high.");
  const question = values.question?.trim() || null;
  const instructions = values.instructions ? readInstructions(values.instructions) : null;
  return {
    focus,
    mode,
    lang,
    start,
    end,
    maxFrames,
    quality,
    threshold,
    fps,
    resolution,
    question,
    instructions,
    name: outputName({ name: values.name, focus, question, instructions, start, end }),
    refresh: Boolean(values.refresh),
    keepVideo: Boolean(values["keep-video"]),
    allowUpload: Boolean(values["allow-upload"]),
    cookies: values["cookies-from-browser"] ?? null,
    model: values.model ?? DEFAULT_MODEL,
    baseUrl: values["gemini-url"] ?? DEFAULT_BASE_URL,
  };
}

function localPossible(source, tools) {
  return Boolean(tools.ffmpeg && tools.ffprobe && (source.type === "file" || tools.ytdlp));
}

/** Which halves run: the local preparation, the Gemini description, or both. */
function chooseMode(opts, source, tools, key) {
  const missing = [!tools.ffmpeg && "ffmpeg", !tools.ffprobe && "ffprobe", source.type !== "file" && !tools.ytdlp && "yt-dlp"].filter(Boolean);
  const toolsMissing = (list, extra = "") => new AppError("tools_missing", `Faltam programas para o modo local: ${list.join(", ")}.`, `${installText(list)}${extra}`);
  const noKey = () => new AppError("no_gemini_key", "O modo Gemini precisa da chave GEMINI_API_KEY.", `${geminiSetupText()}\nSem a chave, use o modo local.`);
  const consent = () =>
    new AppError(
      "upload_consent_required",
      "Para usar o Gemini com um arquivo local, o arquivo precisa ser enviado ao Google.",
      "Pergunte ao integrante. Se ele concordar, repita com --allow-upload (o Google apaga o arquivo em até 48 horas). Sem enviar, use --mode local.",
    );
  const reachable = source.type !== "url" || Boolean(tools.ytdlp); // another site's video has to be downloaded to be sent
  const needsConsent = source.type === "file" && !opts.allowUpload;
  if (opts.mode === "local") {
    if (missing.length) throw toolsMissing(missing);
    return { local: true, gemini: false, auto: false };
  }
  if (opts.mode === "gemini" || opts.mode === "both") {
    if (opts.mode === "both" && missing.length) throw toolsMissing(missing);
    if (!key) throw noKey();
    if (!reachable) throw toolsMissing(["yt-dlp"]);
    if (needsConsent) throw consent();
    return { local: opts.mode === "both", gemini: true, auto: false };
  }
  if (key && source.type === "youtube") return { local: false, gemini: true, auto: true };
  if (key && source.type === "file" && opts.allowUpload) return { local: false, gemini: true, auto: true };
  if (!missing.length) return { local: true, gemini: false, auto: true };
  if (key && source.type === "file") throw consent();
  if (key && reachable) return { local: false, gemini: true, auto: true };
  throw toolsMissing(missing, key ? "" : ` Ou ligue o modo Gemini: rode você mesmo \`${keySetup().command}\`, que abre a página da chave no navegador do integrante (o comando check explica).`);
}

const probedMetadata = (probed) => ({ width: probed.width, height: probed.height, fps: probed.fps, has_audio: probed.has_audio });

function findSidecarCaptions(videoPath) {
  const folder = dirname(videoPath);
  const base = basename(videoPath, extname(videoPath));
  let names;
  try {
    names = readdirSync(folder);
  } catch {
    return null;
  }
  const found = names.filter((name) => name.startsWith(`${base}.`) && /\.(srt|vtt)$/i.test(name)).sort((a, b) => a.length - b.length);
  return found.length ? join(folder, found[0]) : null;
}

/** Reads yt-dlp's metadata once per run, and the caption track when there is no transcript yet. */
async function ensureInfo(ctx) {
  if (ctx.infoPath) return;
  const { tools, source, media, analysis, opts } = ctx;
  if (!tools.ytdlp) throw new AppError("tools_missing", "Falta o yt-dlp para baixar o vídeo.", installText(["yt-dlp"]));
  progress("Lendo os dados do vídeo…");
  const { info, infoPath } = await fetchMetadata({ ytdlp: tools.ytdlp, url: source.url, dir: media, cookies: opts.cookies });
  ctx.infoPath = infoPath;
  ctx.cleanup.push(infoPath);
  // A field the site does not report must not erase what ffprobe measured.
  for (const [field, value] of Object.entries(summarizeMetadata(info))) if (value !== null && value !== undefined) analysis.metadata[field] = value;
  if (ctx.skipCaptions || (analysis.transcript && !opts.refresh)) return;
  const track = pickCaptionTrack(info);
  analysis.metadata.has_captions = Boolean(track);
  if (!track) {
    analysis.transcript = null;
    return;
  }
  progress("Baixando a legenda…");
  const file = await downloadCaptions({ ytdlp: tools.ytdlp, infoPath, dir: media, track, cookies: opts.cookies });
  if (!file) {
    ctx.warnings.push("Não consegui baixar a legenda do vídeo; segui sem transcrição.");
    return;
  }
  ctx.cleanup.push(file);
  try {
    analysis.transcript = { origin: track.origin, language: track.key.replace(/-orig$/, ""), file: "transcript.md", segments: readCaptions(file) };
  } catch {
    ctx.warnings.push("A legenda veio num formato que não consegui ler; segui sem transcrição.");
  }
}

async function collectMetadata(ctx) {
  const { source, tools, analysis, opts, plan } = ctx;
  if (source.type === "file") {
    if (!existsSync(source.path)) throw new AppError("file_not_found", `O arquivo ${source.path} não existe mais.`, "Confira se ele foi movido ou renomeado e passe o caminho novo.");
    analysis.metadata.title ??= basename(source.path);
    if (tools.ffprobe) {
      const probed = await probe(tools.ffprobe.path, source.path);
      analysis.metadata = { ...analysis.metadata, ...probedMetadata(probed), duration_s: probed.duration_s };
    }
    if (!analysis.transcript || opts.refresh) {
      const sidecar = findSidecarCaptions(source.path);
      if (sidecar) {
        try {
          analysis.transcript = { origin: "sidecar", language: null, file: "transcript.md", segments: readCaptions(sidecar) };
        } catch {
          ctx.warnings.push(`Não consegui ler a legenda ${basename(sidecar)}; segui sem transcrição.`);
        }
      }
    }
    return;
  }
  const missingCaptions = !analysis.transcript && analysis.metadata.has_captions !== false;
  if (!opts.refresh && analysis.metadata.title && !missingCaptions) return;
  if (!tools.ytdlp) {
    ctx.warnings.push("Sem o yt-dlp, a análise segue sem título, capítulos e transcrição do vídeo.");
    return;
  }
  try {
    await ensureInfo(ctx);
  } catch (error) {
    if (plan.local) throw error;
    ctx.warnings.push(`Não consegui ler os dados do vídeo pelo yt-dlp (${error.code ?? "erro"}); segui só com o Gemini.`);
  }
}

function prepParams(ctx) {
  const { opts, source, analysis } = ctx;
  const duration = analysis.metadata.duration_s ?? null;
  const quality = source.type === "file" ? null : (opts.quality ?? (duration && duration > 1800 ? 480 : 720));
  return { window: { start_s: opts.start ?? 0, end_s: opts.end }, max_frames: opts.maxFrames, quality, threshold: opts.threshold };
}

function prepCacheValid(ctx) {
  const prep = ctx.analysis.preparation;
  if (ctx.opts.refresh || !prep) return false;
  if (JSON.stringify(prep.params) !== JSON.stringify(prepParams(ctx))) return false;
  return ctx.analysis.grids.length > 0 && ctx.analysis.grids.every((grid) => existsSync(join(ctx.dir, grid.file)));
}

/** The video file to work on: the member's file, a video kept from before, or a fresh download. */
async function obtainVideo(ctx, quality) {
  const { source, analysis, dir, tools, opts, media } = ctx;
  if (source.type === "file") {
    if (!existsSync(source.path)) throw new AppError("file_not_found", `O arquivo ${source.path} não existe mais.`);
    return source.path;
  }
  if (ctx.downloaded && existsSync(ctx.downloaded)) return ctx.downloaded;
  if (analysis.kept_video && existsSync(join(dir, analysis.kept_video))) return join(dir, analysis.kept_video);
  await ensureInfo(ctx);
  progress(`Baixando o vídeo (até ${quality}p)…`);
  ctx.downloaded = await downloadVideo({ ytdlp: tools.ytdlp, infoPath: ctx.infoPath, dir: media, quality, ffmpeg: tools.ffmpeg?.path, cookies: opts.cookies });
  if (opts.keepVideo) analysis.kept_video = toPosix(dir, ctx.downloaded);
  return ctx.downloaded;
}

/** The local half: cuts, silences, frames, grids and the reading guide. No reasoning here. */
async function prepareLocal(ctx) {
  const { opts, tools, analysis, dir, media } = ctx;
  if (prepCacheValid(ctx)) {
    ctx.prepCached = true;
    return;
  }
  if (ctx.source.type !== "file" && !analysis.metadata.duration_s) await ensureInfo(ctx);
  const video = await obtainVideo(ctx, prepParams(ctx).quality ?? 720);
  const probed = await probe(tools.ffprobe.path, video);
  analysis.metadata = { ...analysis.metadata, ...probedMetadata(probed), duration_s: probed.duration_s || analysis.metadata.duration_s || 0 };
  const duration = analysis.metadata.duration_s;
  const start = Math.min(Math.max(0, opts.start ?? 0), duration);
  const end = Math.min(opts.end ?? duration, duration);
  if (end - start < 0.5) throw usage("O trecho pedido é curto demais ou fica fora do vídeo.", `O vídeo tem ${formatTime(duration)}.`);

  progress("Medindo cortes, silêncios e mudanças de imagem…");
  const signals = await measureSignals({
    ffmpeg: tools.ffmpeg.path, video, videoIndex: probed.video_index, hasAudio: probed.has_audio,
    start, duration: end - start, threshold: opts.threshold,
  });
  const cuts = mergeCuts(signals.cuts, stillChanges(signals.signatures, signals.rate, start));
  const picked = pickFrames({ start, end, cuts, signatures: signals.signatures, rate: signals.rate, maxFrames: opts.maxFrames });
  progress(`Extraindo ${picked.frames.length} frames…`);
  const framesDir = join(media, "frames");
  removeDir(framesDir);
  const frames = await extractFrames({ ffmpeg: tools.ffmpeg.path, video, videoIndex: probed.video_index, frames: picked.frames, dir: framesDir, landscape: probed.width >= probed.height });
  if (!frames.length) throw new AppError("ffmpeg_failed", "Não consegui extrair nenhum frame do vídeo.");
  const { grids, labeled } = await buildGrids({ ffmpeg: tools.ffmpeg.path, frames, dir: join(media, "grids"), layout: gridLayout(probed.width, probed.height), font: await gridFont(tools) });

  const extracted = new Set(frames.map((frame) => frame.n));
  analysis.preparation = { done_at: new Date().toISOString(), params: prepParams(ctx), window: { start_s: round(start), end_s: round(end) }, grid_labels: labeled };
  analysis.cuts_s = picked.cuts;
  analysis.shots = picked.shots.map((shot) => {
    const entry = { ...shot, frames: shot.frames.filter((n) => extracted.has(n)) };
    if (entry.same_as_frame && !extracted.has(entry.same_as_frame)) delete entry.same_as_frame;
    return entry;
  });
  analysis.frames = frames.map((frame) => ({ n: frame.n, time_s: frame.time_s, file: toPosix(dir, frame.path), grid: frame.grid, position: frame.position, shot: frame.shot }));
  analysis.grids = grids.map((grid) => ({ n: grid.n, file: toPosix(dir, grid.path), columns: grid.columns, rows: grid.rows, frames: grid.frames }));
  analysis.silences = signals.silences;
}

/** Big or high-resolution files are reduced to 720p before going to Gemini. */
async function shrinkForUpload(ctx, file) {
  const { tools, media } = ctx;
  const size = statSync(file).size;
  const tooBig = () =>
    new AppError("file_too_large", "O arquivo passa de 2 GB, o limite de envio ao Gemini.", `Rode você mesmo ${installHints().ffmpeg} para instalar o ffmpeg: com ele, o app reduz o vídeo para 720p antes de enviar.`);
  if (!tools.ffmpeg || !tools.ffprobe) {
    if (size > UPLOAD_LIMIT) throw tooBig();
    return file;
  }
  const probed = await probe(tools.ffprobe.path, file);
  if (size <= 200 * 1024 ** 2 && Math.min(probed.width, probed.height) <= 720) return file;
  progress("Reduzindo o vídeo para 720p antes de enviar…");
  const target = join(media, "upload.mp4");
  const scale = probed.width >= probed.height ? "scale=-2:'min(720,ih)'" : "scale='min(720,iw)':-2";
  const base = ["-hide_banner", "-loglevel", "error", "-nostdin", "-i", file, "-map", `0:v:${probed.video_index}`, "-map", "0:a:0?", "-vf", scale];
  for (const codec of [["-c:v", "libx264", "-preset", "veryfast", "-crf", "28"], ["-c:v", "mpeg4", "-q:v", "6"]]) {
    const { code } = await run(tools.ffmpeg.path, [...base, ...codec, "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", "-y", target]);
    if (code === 0 && existsSync(target)) {
      ctx.cleanup.push(target);
      return target;
    }
  }
  if (size > UPLOAD_LIMIT) throw tooBig();
  ctx.warnings.push("Não consegui reduzir o vídeo; enviei o arquivo original.");
  return file;
}

function defaultFps(focus, duration) {
  if (focus !== "editing" || !duration) return null;
  if (duration <= 120) return 3;
  if (duration <= 600) return 2;
  return null;
}

function windowText(opts, duration) {
  if (opts.start === null && opts.end === null) return "full";
  const withHours = (duration ?? 0) >= 3600;
  return `${formatTime(opts.start ?? 0, withHours)}-${opts.end !== null ? formatTime(opts.end, withHours) : "end"}`;
}

function headerFields(ctx, mode, model) {
  const { opts, analysis } = ctx;
  return {
    video: analysis.metadata.title ?? analysis.id,
    source: sourceLabel(analysis),
    id: analysis.id,
    name: opts.name,
    focus: opts.focus,
    mode,
    model,
    window: windowText(opts, analysis.metadata.duration_s),
    lang: opts.lang,
    question: opts.question,
    instructions: opts.instructions ? rel(opts.instructions.path) : null,
    generated_at: new Date().toISOString(),
  };
}

/** The Gemini half: the model watches the video and the script writes the description. */
async function describeWithGemini(ctx) {
  const { opts, source, key, analysis, dir } = ctx;
  const duration = analysis.metadata.duration_s ?? null;
  const fps = opts.fps ?? defaultFps(opts.focus, duration);
  const resolution = opts.resolution ?? (opts.focus === "content" ? "high" : null);
  let part;
  if (source.type === "youtube" && !NOT_PUBLIC.has(analysis.metadata.availability)) {
    part = videoPart({ uri: source.url, start: opts.start, end: opts.end, fps });
  } else {
    let upload = analysis.gemini?.upload ?? null;
    if (!(await uploadStillValid({ key, baseUrl: opts.baseUrl, upload }))) {
      const file = await shrinkForUpload(ctx, await obtainVideo(ctx, 720));
      upload = await uploadFile({ key, baseUrl: opts.baseUrl, path: file, mime: videoMime(file), displayName: analysis.metadata.title ?? source.id, onProgress: progress });
      analysis.gemini = { ...(analysis.gemini ?? {}), upload };
    }
    part = videoPart({ uri: upload.uri, mime: upload.mime, start: opts.start, end: opts.end, fps });
  }
  const from = opts.start ?? 0;
  const to = opts.end ?? Number.POSITIVE_INFINITY;
  const prompt = buildPrompt({
    focusGuide: readFileSync(join(APP_DIR, "references", "focus", `${opts.focus}.md`), "utf8"),
    instructions: opts.instructions,
    question: opts.question,
    context: analysis.metadata,
    window: { start: opts.start, end: opts.end },
    lang: opts.lang,
    cuts: (analysis.cuts_s ?? []).filter((cut) => cut >= from && cut <= to),
  });
  const config = { responseMimeType: "application/json" };
  if (resolution) config.mediaResolution = RESOLUTIONS[resolution];
  progress(`Pedindo a análise ao Gemini (${opts.model})…`);
  const reply = await generate({ key, baseUrl: opts.baseUrl, model: opts.model, parts: [part, { text: prompt }], config, onProgress: progress });
  const data = parseJsonReply(reply.text);
  writeJson(join(dir, "gemini", `${opts.name}.json`), {
    requested_at: new Date().toISOString(),
    model: reply.model,
    finish_reason: reply.finishReason,
    usage: reply.usage,
    reply: data ?? reply.text,
  });
  if (!data) ctx.warnings.push("O Gemini não devolveu JSON; a descrição guarda o texto como veio.");
  if (reply.finishReason === "MAX_TOKENS") ctx.warnings.push("A resposta do Gemini foi cortada por tamanho; para mais detalhe, analise por trechos com --start e --end.");
  const markdown = renderDescription({
    data,
    rawText: reply.text,
    header: headerFields(ctx, "gemini", reply.model),
    title: analysis.metadata.title ?? source.id,
    measurements: measurementLines(analysis, opts.lang),
    lang: opts.lang,
  });
  writeFileAtomic(join(dir, "descriptions", `${opts.name}.md`), markdown);
  const usage = reply.usage ?? {};
  return {
    model: reply.model,
    input_tokens: usage.promptTokenCount ?? null,
    output_tokens: usage.candidatesTokenCount ?? null,
    thinking_tokens: usage.thoughtsTokenCount ?? null,
  };
}

function cleanUp(ctx) {
  if (ctx.downloaded && !ctx.opts.keepVideo) ctx.cleanup.push(ctx.downloaded);
  for (const path of ctx.cleanup) rmSync(path, { force: true });
}

function filesOf(dir, analysis) {
  return {
    analysis: rel(join(dir, "analysis.json")),
    index: analysis.preparation ? rel(join(dir, "index.md")) : null,
    transcript: analysis.transcript?.segments?.length ? rel(join(dir, "transcript.md")) : null,
    grids: (analysis.grids ?? []).map((grid) => rel(join(dir, grid.file))),
  };
}

function sourceLabel(analysis) {
  return analysis.source?.url ?? displayPath(ROOT, analysis.source?.file);
}

function videoOf(analysis) {
  return { title: analysis.metadata?.title ?? null, duration_s: analysis.metadata?.duration_s ?? null, source: sourceLabel(analysis) };
}

/** A video address or file, or the id of an analysis already made (for follow-up questions). */
function resolveSource(input, dirOption) {
  if (looksLikeId(input)) {
    const analysis = readAnalysis(join(analysesDir(dirOption), input));
    if (analysis) return sourceFromAnalysis(analysis);
  }
  return identifySource(input);
}

async function analyze(input, values, { command = "analyze", forceMode = null } = {}) {
  const prepareOnly = command === "prepare";
  const opts = analysisOptions(forceMode ? { ...values, mode: forceMode } : values);
  const source = resolveSource(input, values.dir);
  const tools = await checkTools({ ytdlp: source.type !== "file" });
  const { key } = geminiKey();
  const plan = chooseMode(opts, source, tools, key);
  const root = analysesDir(values.dir);
  ensureAnalysesDir(root);
  const dir = join(root, source.id);
  const release = lockAnalysis(dir);
  const ctx = { opts, source, tools, key, plan, dir, media: join(dir, "media"), warnings: [], cleanup: [], infoPath: null, downloaded: null };
  try {
    ctx.analysis = readAnalysis(dir) ?? newAnalysis({ source, app: APP });
    const { analysis } = ctx;
    analysis.app = APP;
    analysis.source = sourceSummary(source);
    mkdirSync(ctx.media, { recursive: true });
    const descriptionPath = join(dir, "descriptions", `${opts.name}.md`);
    const cached = !prepareOnly && !opts.refresh && existsSync(descriptionPath);
    let gemini = null;
    if (!cached) {
      await collectMetadata(ctx);
      if (plan.local) await prepareLocal(ctx);
      if (plan.gemini && !prepareOnly) {
        try {
          gemini = await describeWithGemini(ctx);
        } catch (error) {
          const canFallBack = plan.auto && error instanceof AppError && FALLBACK_CODES.has(error.code) && localPossible(source, tools);
          if (!canFallBack) throw error;
          ctx.warnings.push(`O Gemini falhou (${error.code}): ${error.message} Segui no modo local.`);
          plan.gemini = false;
          plan.local = true;
          await prepareLocal(ctx);
        }
      }
    }
    if (analysis.transcript?.segments?.length) writeTranscript(dir, analysis);
    if (analysis.preparation) writeIndex({ dir, analysis, root: ROOT, scriptCommand: SCRIPT_COMMAND });
    saveAnalysis(dir, analysis);

    const base = { ok: true, command, interface_version: INTERFACE_VERSION, app: APP, id: analysis.id, dir: rel(dir), video: videoOf(analysis) };
    if (prepareOnly) {
      return { ...base, cached: Boolean(ctx.prepCached), files: filesOf(dir, analysis), measurements: measurementLines(analysis, opts.lang), warnings: ctx.warnings };
    }
    const ready = cached || Boolean(gemini) || (!opts.refresh && existsSync(descriptionPath));
    // Not every AI tool creates folders when it writes a file.
    if (!ready) mkdirSync(dirname(descriptionPath), { recursive: true });
    const nextStep = ready
      ? null
      : {
          who: "ai",
          task: "Leia o roteiro, veja as grades na ordem e escreva a descrição no arquivo indicado, no formato do guia, começando pelo cabeçalho dado.",
          read: [rel(join(dir, "index.md"))],
          grids: analysis.grids.map((grid) => rel(join(dir, grid.file))),
          guides: [
            rel(join(APP_DIR, "references", "description-format.md")),
            rel(join(APP_DIR, "references", "focus", `${opts.focus}.md`)),
            ...(opts.instructions ? [rel(opts.instructions.path)] : []),
          ],
          write: rel(descriptionPath),
          header: descriptionHeader(headerFields(ctx, "local-ai", "IA do integrante")),
          question: opts.question,
        };
    return {
      ...base,
      mode: plan.local && plan.gemini ? "both" : plan.gemini ? "gemini" : "local",
      focus: opts.focus,
      name: opts.name,
      ready,
      cached,
      description: ready ? rel(descriptionPath) : null,
      files: filesOf(dir, analysis),
      next_step: nextStep,
      gemini,
      warnings: ctx.warnings,
    };
  } finally {
    cleanUp(ctx);
    release();
  }
}

/** An analysis by id, or by the same address/file that created it. */
function openTarget(target, dirOption, { create = false } = {}) {
  const root = analysesDir(dirOption);
  if (looksLikeId(target) && existsSync(join(root, target, "analysis.json"))) {
    const dir = join(root, target);
    const analysis = readAnalysis(dir);
    if (!analysis) throw new AppError("not_found", `A análise ${target} foi feita por uma versão incompatível deste app.`, "Rode analyze de novo com --refresh.");
    return { dir, analysis, source: sourceFromAnalysis(analysis) };
  }
  let source;
  try {
    source = identifySource(target);
  } catch (error) {
    if (looksLikeId(target)) throw new AppError("not_found", `Não há análise com o id ${target}.`, "Rode o comando list para ver as análises.");
    throw error;
  }
  const dir = join(root, source.id);
  const analysis = readAnalysis(dir);
  if (!analysis && !create) throw new AppError("not_found", "Este vídeo ainda não foi analisado.", `Rode \`${SCRIPT_COMMAND} analyze ${target}\`.`);
  ensureAnalysesDir(root);
  return { dir, analysis: analysis ?? newAnalysis({ source, app: APP }), source };
}

async function frameCommand(positionals, values) {
  const [target, ...times] = positionals;
  if (!target || !times.length) throw usage("Use: frame <vídeo ou id> <tempo> [tempo…]");
  const seconds = times.map(parseTime);
  const { dir, analysis, source } = openTarget(target, values.dir, { create: true });
  const tools = await checkTools({ ytdlp: source.type !== "file" });
  if (!tools.ffmpeg || !tools.ffprobe) throw new AppError("tools_missing", "Extrair frames exige o ffmpeg.", installText(["ffmpeg"]));
  const release = lockAnalysis(dir);
  const opts = { keepVideo: Boolean(values["keep-video"]), cookies: values["cookies-from-browser"] ?? null, refresh: false };
  const ctx = { opts, source, tools, analysis, dir, media: join(dir, "media"), warnings: [], cleanup: [], infoPath: null, downloaded: null, skipCaptions: true };
  try {
    mkdirSync(ctx.media, { recursive: true });
    const video = await obtainVideo(ctx, 1080);
    const probed = await probe(tools.ffprobe.path, video);
    const requested = seconds.map((time) => ({ time_s: Math.max(0, Math.min(time, Math.max(0, probed.duration_s - 0.05))) }));
    const frames = await extractFrames({ ffmpeg: tools.ffmpeg.path, video, videoIndex: probed.video_index, frames: requested, dir: join(ctx.media, "extras"), maxSide: 1920, landscape: probed.width >= probed.height });
    analysis.metadata = { ...analysis.metadata, ...probedMetadata(probed), duration_s: analysis.metadata.duration_s ?? probed.duration_s };
    saveAnalysis(dir, analysis);
    const withHours = probed.duration_s >= 3600;
    return {
      ok: true,
      command: "frame",
      interface_version: INTERFACE_VERSION,
      id: analysis.id,
      frames: frames.map((frame) => ({ time: formatTime(frame.time_s, withHours), time_s: frame.time_s, file: rel(frame.path) })),
      warnings: ctx.warnings,
    };
  } finally {
    cleanUp(ctx);
    release();
  }
}

function showCommand(positionals, values) {
  const [target] = positionals;
  if (!target) throw usage("Use: show <vídeo ou id>");
  const { dir, analysis } = openTarget(target, values.dir);
  const m = analysis.metadata ?? {};
  return {
    ok: true,
    command: "show",
    interface_version: INTERFACE_VERSION,
    id: analysis.id,
    dir: rel(dir),
    video: { ...videoOf(analysis), channel: m.channel ?? null, published_at: m.published_at ?? null },
    files: filesOf(dir, analysis),
    descriptions: listDescriptions(dir).map((description) => ({ ...description, file: rel(join(dir, description.file)) })),
    measurements: measurementLines(analysis, values.lang === "en" ? "en" : projectLang()),
    updated_at: analysis.updated_at,
  };
}

function listCommand(values) {
  const root = analysesDir(values.dir);
  const entries = existsSync(root) ? readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()) : [];
  const analyses = entries
    .map((entry) => {
      const dir = join(root, entry.name);
      const analysis = readAnalysis(dir);
      if (!analysis) return null;
      return { id: analysis.id, dir: rel(dir), video: videoOf(analysis), descriptions: listDescriptions(dir).map((description) => description.name), updated_at: analysis.updated_at };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  return { ok: true, command: "list", interface_version: INTERFACE_VERSION, dir: rel(root), analyses };
}

async function checkCommand() {
  const tools = await checkTools({ versions: true });
  const { key: found, from } = geminiKey();
  const key = Boolean(found);
  const hints = installHints();
  const install = {};
  if (!tools.ffmpeg || !tools.ffprobe) install.ffmpeg = hints.ffmpeg;
  if (!tools.ytdlp) install["yt-dlp"] = hints["yt-dlp"];
  const local = Boolean(tools.ffmpeg && tools.ffprobe);
  return {
    ok: true,
    command: "check",
    interface_version: INTERFACE_VERSION,
    app: APP,
    project: ROOT,
    analyses_dir: rel(analysesDir()),
    node: process.version,
    tools: { ffmpeg: tools.ffmpeg?.version ?? null, ffprobe: tools.ffprobe?.version ?? null, "yt-dlp": tools.ytdlp?.version ?? null, grid_labels: Boolean(tools.font) },
    gemini_key: key,
    gemini_key_from: from,
    modes: {
      local: { files: local, web: local && Boolean(tools.ytdlp) },
      gemini: { youtube: key, files: key, web: key && Boolean(tools.ytdlp) },
    },
    install,
    install_note: Object.keys(install).length && hints.note ? hints.note : null,
    update_ytdlp: hints.update_ytdlp,
    gemini_setup: key ? null : geminiSetup(),
  };
}

const HELP = `Análise de vídeo: vê a imagem e ouve o som de um vídeo, não só a transcrição.

Uso: ${SCRIPT_COMMAND} <comando> [opções] [--json]

Comandos
  check                         O que esta máquina tem (ffmpeg, yt-dlp, chave do Gemini) e quais modos funcionam.
  analyze <vídeo ou id>         Descreve o vídeo. <vídeo> é um endereço do YouTube, de outro site ou um arquivo local;
                                o id de uma análise já feita serve para novas perguntas.
  prepare <vídeo>               Só a parte local: cortes, silêncios, frames, grades e roteiro de leitura.
  frame <vídeo ou id> <tempo>…  Extrai frames em alta resolução nos tempos pedidos (90, 1:30, 01:02:03, 1m30s).
  show <vídeo ou id>            Arquivos e descrições de uma análise.
  list                          Todas as análises deste projeto.
  help                          Esta ajuda.

Opções de analyze e prepare
  --focus general|editing|content   O que observar (padrão: general).
  --question "texto"                Uma pergunta sobre o vídeo; a resposta cita os tempos.
  --instructions <arquivo.md>       Instruções de outro app sobre o que observar.
  --name <rótulo>                   Nome do arquivo da descrição (padrão: o foco).
  --mode auto|local|gemini|both     Quem assiste ao vídeo (padrão: auto).
  --start <tempo> --end <tempo>     Analisa só um trecho.
  --density low|normal|high         Quantos frames no modo local (24, 48 ou 96); ou --max-frames N.
  --quality 240|360|480|720|1080    Resolução do download (padrão: 720; 480 acima de 30 minutos).
  --threshold <n>                   Sensibilidade a cortes, de 0.05 a 0.9 (padrão: 0.3; menor encontra mais).
  --lang pt-BR|en                   Idioma da descrição (padrão: o do projeto).
  --model <modelo>                  Modelo do Gemini (padrão: ${DEFAULT_MODEL}).
  --fps <n>                         Frames por segundo que o Gemini assiste.
  --resolution low|medium|high      Resolução da imagem para o Gemini.
  --allow-upload                    Autoriza enviar um arquivo local ao Gemini.
  --keep-video                      Mantém o vídeo baixado na pasta da análise.
  --refresh                         Refaz em vez de reaproveitar o que já existe.
  --cookies-from-browser <nav>      Usa a sessão do navegador no yt-dlp (vídeos com login).
  --dir <pasta>                     Outra pasta para as análises (padrão: ${ANALYSES_DIR}).
  --json                            Saída em JSON, para a IA e para outros apps.`;

function humanText(result) {
  if (!result.ok) return [`Erro (${result.error.code}): ${result.error.message}`, result.error.fix && `Como resolver: ${result.error.fix}`].filter(Boolean).join("\n");
  const warnings = (result.warnings ?? []).map((warning) => `Aviso: ${warning}`);
  switch (result.command) {
    case "help":
      return result.text;
    case "check": {
      const lines = [
        `Análise de vídeo ${result.app.version} · Node ${result.node}`,
        `ffmpeg: ${result.tools.ffmpeg ?? "não encontrado"} · yt-dlp: ${result.tools["yt-dlp"] ?? "não encontrado"} · chave do Gemini: ${result.gemini_key ? "definida" : "não definida"}`,
        `Modo local: ${result.modes.local.files ? `arquivos sim, endereços ${result.modes.local.web ? "sim" : "não (falta o yt-dlp)"}` : "indisponível (falta o ffmpeg)"}`,
        `Modo Gemini: ${result.gemini_key ? `disponível (chave ${result.gemini_key_from === "flyee" ? "salva no flyee" : "na variável de ambiente"})` : "desligado: falta a chave GEMINI_API_KEY"}`,
      ];
      for (const [name, command] of Object.entries(result.install)) lines.push(`Instalar ${name}: ${command}`);
      if (result.install_note) lines.push(result.install_note);
      if (result.gemini_setup) {
        const setup = result.gemini_setup;
        lines.push(
          `Para ligar o modo Gemini, o integrante cria a chave no Google AI Studio${setup.key_url ? ` (${setup.key_url})` : ""} e você a salva com:`,
          `  ${setup.command}`,
          setup.how,
          setup.after,
        );
      }
      return lines.join("\n");
    }
    case "analyze": {
      const lines = result.ready
        ? [`Descrição pronta${result.cached ? " (reaproveitada)" : ""}: ${result.description}`, `Modo: ${result.mode} · foco: ${result.focus} · pasta: ${result.dir}`]
        : [
            `Material preparado em ${result.dir}.`,
            `Próximo passo da IA: leia ${result.next_step.read[0]}, veja ${result.next_step.grids.length} grade(s) e escreva ${result.next_step.write} seguindo ${result.next_step.guides[0]}.`,
          ];
      return [...lines, ...warnings].join("\n");
    }
    case "prepare":
      return [`Preparado${result.cached ? " (reaproveitado)" : ""}: ${result.files.index}`, ...result.measurements, ...warnings].join("\n");
    case "frame":
      return [...result.frames.map((frame) => `${frame.time}: ${frame.file}`), ...warnings].join("\n");
    case "show":
      return [
        `${result.video.title ?? result.id} (${result.id}) em ${result.dir}`,
        ...result.descriptions.map((description) => `- ${description.name}: ${description.file}`),
        ...result.measurements,
      ].join("\n");
    case "list":
      return result.analyses.length
        ? result.analyses.map((item) => `${item.id} · ${item.video.title ?? "sem título"} · ${item.descriptions.join(", ") || "sem descrição"}`).join("\n")
        : `Nenhuma análise em ${result.dir}.`;
    default:
      return JSON.stringify(result, null, 2);
  }
}

async function main(argv) {
  const [command, ...rest] = argv;
  if (!command || ["help", "--help", "-h"].includes(command)) return { ok: true, command: "help", text: HELP };
  const { positionals, values } = parseArgs(rest, ARG_SPEC);
  switch (command) {
    case "check":
      return checkCommand();
    case "analyze":
    case "prepare":
      if (positionals.length !== 1) throw usage(`Informe um vídeo por vez: ${command} <endereço ou arquivo>.`);
      return analyze(positionals[0], values, { command, forceMode: command === "prepare" ? "local" : null });
    case "frame":
      return frameCommand(positionals, values);
    case "show":
      return showCommand(positionals, values);
    case "list":
      return listCommand(values);
    default:
      throw usage(`Comando desconhecido: ${command}.`, "Comandos: check, analyze, prepare, frame, show, list, help.");
  }
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
        fix: known ? error.fix : "Tente de novo; se repetir, rode o comando check e guarde esta mensagem.",
      },
    };
    process.stdout.write(`${json ? JSON.stringify(result, null, 2) : humanText(result)}\n`);
    process.exitCode = known && error.code === "usage" ? 2 : 1;
  });
