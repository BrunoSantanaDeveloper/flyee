// Talks to yt-dlp: metadata, captions and the video at an analysis resolution.
// Works for YouTube and for the other sites yt-dlp supports.

import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { installHints } from "./tools.mjs";
import { AppError, LIMITS, readJson, run } from "./util.mjs";

const roundTo = (value, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;

function template(dir) {
  return join(dir, "video.%(ext)s").replace(/\\/g, "/");
}

function commonArgs(ytdlp, cookies) {
  const args = [...ytdlp.prefix, "--no-progress", "--encoding", "utf-8"];
  if (cookies) args.push("--cookies-from-browser", cookies);
  return args;
}

function errorLine(stderr) {
  const lines = String(stderr ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.filter((line) => line.startsWith("ERROR")).pop() ?? lines.slice(-2).join(" | ");
}

/** Turns yt-dlp's error output into a stable code and guidance for the member. */
export function classifyYtdlpError(stderr) {
  const text = String(stderr ?? "");
  const detail = errorLine(text);
  const update = installHints().update_ytdlp;
  if (/confirm your age|age[- ]restricted|inappropriate for some users/i.test(text)) {
    return new AppError("age_restricted", "O vídeo tem restrição de idade e o YouTube exige uma conta para abri-lo.", "Peça o arquivo do vídeo ao integrante; ou, se ele pedir, repita com --cookies-from-browser e o navegador em que ele está logado.");
  }
  if (/not a bot|Sign in to confirm/i.test(text)) {
    return new AppError(
      "youtube_blocked",
      "O YouTube recusou o download automático (pediu para confirmar que não é um robô).",
      `Rode você mesmo ${update} para atualizar o yt-dlp e tente de novo. Se continuar: use o modo Gemini, que lê o vídeo público sem baixar; ou peça o arquivo do vídeo ao integrante; ou, só se ele pedir, repita com --cookies-from-browser (o YouTube pode marcar a conta usada).`,
    );
  }
  if (/private video|this video is private/i.test(text)) {
    return new AppError("private_video", "O vídeo é privado.", "Só o dono pode abrir. Se ele for seu, baixe o arquivo pelo YouTube Studio e analise o arquivo local.");
  }
  if (/members[- ]only|join this channel|channel's members/i.test(text)) {
    return new AppError("members_only", "O vídeo é exclusivo para membros do canal.", "Peça o arquivo do vídeo ao integrante; ou, se ele pedir, repita com --cookies-from-browser e o navegador de uma conta que tenha acesso.");
  }
  if (/HTTP Error 429|Too Many Requests/i.test(text)) {
    return new AppError("rate_limited", "O site limitou os pedidos desta conexão por um tempo.", "Espere alguns minutos e tente de novo, ou use o modo Gemini.");
  }
  if (/is live|live event will begin|premieres in/i.test(text)) {
    return new AppError("live_video", "O vídeo é uma transmissão ao vivo ou estreia que ainda não terminou.", "Analise depois que a transmissão acabar.");
  }
  if (/video unavailable|this video is unavailable|has been removed|does not exist|HTTP Error 404/i.test(text)) {
    return new AppError("video_unavailable", "O vídeo não está disponível (removido, bloqueado no país ou endereço errado).", "Confira o endereço abrindo-o no navegador.");
  }
  if (/Unsupported URL/i.test(text)) {
    return new AppError("unsupported_url", "Este endereço não é de um site de vídeo que o yt-dlp saiba abrir.", "Passe o endereço da página do vídeo, ou baixe o arquivo e analise localmente.");
  }
  if (/Requested format is not available|No video formats found/i.test(text)) {
    return new AppError("no_formats", "O site não entregou nenhum formato de vídeo para baixar.", `Rode você mesmo ${update} para atualizar o yt-dlp; se continuar, use o modo Gemini ou o arquivo do vídeo.`);
  }
  if (/getaddrinfo|Unable to download webpage|timed out|Connection(Reset|Refused)|Network is unreachable|Temporary failure/i.test(text)) {
    return new AppError("offline", "Não consegui falar com o site do vídeo.", "Confira a conexão com a internet e tente de novo.");
  }
  if (/ffmpeg.*(not found|not installed)/i.test(text)) {
    return new AppError("tools_missing", "O yt-dlp precisa do ffmpeg para juntar imagem e som.", `Rode você mesmo ${installHints().ffmpeg} para instalar o ffmpeg e repita.`);
  }
  return new AppError(
    "download_failed",
    "O yt-dlp não conseguiu baixar o vídeo.",
    `${detail ? `Detalhe: ${detail}. ` : ""}Atualizar o yt-dlp costuma resolver: rode você mesmo ${update} e tente de novo.`,
  );
}

/** Writes `video.info.json` (UTF-8 on disk, whatever the console encoding) and returns it. */
export async function fetchMetadata({ ytdlp, url, dir, cookies }) {
  const args = [
    ...commonArgs(ytdlp, cookies),
    "--skip-download", "--write-info-json", "--no-playlist", "--flat-playlist", "--ignore-no-formats-error",
    "-o", template(dir), url,
  ];
  const { code, stderr } = await run(ytdlp.file, args, { timeoutMs: LIMITS.metadata });
  const infoPath = join(dir, "video.info.json");
  if (code !== 0 || !existsSync(infoPath)) throw classifyYtdlpError(stderr);
  const info = readJson(infoPath);
  if (!info) throw new AppError("download_failed", "Não consegui ler os dados do vídeo devolvidos pelo yt-dlp.");
  if (info._type === "playlist") throw new AppError("playlist_not_supported", "O endereço é de uma playlist.", "Passe o endereço de um vídeo por vez.");
  if (info.live_status === "is_live" || info.live_status === "is_upcoming") {
    throw new AppError("live_video", "O vídeo é uma transmissão ao vivo ou estreia que ainda não terminou.", "Analise depois que a transmissão acabar.");
  }
  return { info, infoPath };
}

/**
 * The parts viewers replayed most, from YouTube's heatmap: up to three peaks at
 * least a tenth of the video apart, skipping the start (always high). Short
 * videos have no meaningful heatmap.
 */
export function mostReplayed(heatmap, duration, count = 3) {
  if (!Array.isArray(heatmap) || heatmap.length < 10 || !(duration >= 60)) return [];
  const from = Math.max(3, duration * 0.05);
  const gap = Math.max(2, Math.round(heatmap.length / 10));
  const candidates = heatmap
    .map((point, index) => ({ ...point, index }))
    .filter((point) => point.start_time >= from && point.value >= 0.5)
    .sort((a, b) => b.value - a.value);
  const chosen = [];
  for (const point of candidates) {
    if (chosen.length >= count) break;
    if (chosen.some((picked) => Math.abs(picked.index - point.index) < gap)) continue;
    chosen.push(point);
  }
  return chosen
    .sort((a, b) => a.start_time - b.start_time)
    .map((point) => {
      const before = heatmap[point.index - 1] ?? point;
      const after = heatmap[point.index + 1] ?? point;
      return { start_s: roundTo(before.start_time, 2), end_s: roundTo(after.end_time, 2), intensity: roundTo(point.value, 2) };
    });
}

export function summarizeMetadata(info) {
  const date = /^\d{8}$/.test(info.upload_date ?? "") ? `${info.upload_date.slice(0, 4)}-${info.upload_date.slice(4, 6)}-${info.upload_date.slice(6, 8)}` : null;
  return {
    title: info.title ?? null,
    channel: info.channel ?? info.uploader ?? null,
    published_at: date,
    duration_s: typeof info.duration === "number" ? info.duration : null,
    views: info.view_count ?? null,
    likes: info.like_count ?? null,
    comments: info.comment_count ?? null,
    language: info.language ?? null,
    availability: info.availability ?? null,
    url: info.webpage_url ?? null,
    description: String(info.description ?? "").slice(0, 3000),
    tags: (info.tags ?? []).slice(0, 20),
    chapters: (info.chapters ?? []).map((chapter) => ({ start_s: chapter.start_time, end_s: chapter.end_time, title: chapter.title })),
    most_replayed: mostReplayed(info.heatmap, info.duration),
  };
}

function matchLanguage(keys, language) {
  if (!language) return null;
  const target = language.toLowerCase();
  const base = target.split("-")[0];
  return keys.find((key) => key.toLowerCase() === target) ?? keys.find((key) => key.toLowerCase() === base || key.toLowerCase().startsWith(`${base}-`)) ?? null;
}

/**
 * The caption track most faithful to the speech: the original language
 * (manual before automatic); with no known language, Portuguese, then English.
 */
export function pickCaptionTrack(info) {
  const manual = Object.keys(info.subtitles ?? {}).filter((key) => key !== "live_chat");
  const automatic = Object.keys(info.automatic_captions ?? {});
  const original = info.language || automatic.find((key) => key.endsWith("-orig"))?.replace(/-orig$/, "") || null;
  if (original) {
    const manualTrack = matchLanguage(manual, original);
    if (manualTrack) return { key: manualTrack, origin: "manual" };
    const autoTrack = automatic.find((key) => key === `${original}-orig`) ?? matchLanguage(automatic, original);
    if (autoTrack) return { key: autoTrack, origin: "auto" };
  }
  for (const language of ["pt-BR", "pt", "en"]) {
    const track = matchLanguage(manual, language);
    if (track) return { key: track, origin: "manual" };
  }
  if (manual.length) return { key: manual[0], origin: "manual" };
  for (const language of ["pt-BR", "pt", "en"]) {
    const track = matchLanguage(automatic, language);
    if (track) return { key: track, origin: "auto" };
  }
  return automatic.length ? { key: automatic[0], origin: "auto" } : null;
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Downloads only the chosen caption track. A failure here does not stop the analysis: returns null. */
export async function downloadCaptions({ ytdlp, infoPath, dir, track, cookies }) {
  const args = [
    ...commonArgs(ytdlp, cookies),
    "--load-info-json", infoPath, "--skip-download",
    track.origin === "manual" ? "--write-subs" : "--write-auto-subs",
    "--sub-langs", `^${escapeRegex(track.key)}$`, "--sub-format", "json3/srt/vtt/best",
    "-o", template(dir),
  ];
  // a caption download that hangs is a failure like any other: the analysis goes on without it
  const { code } = await run(ytdlp.file, args, { timeoutMs: LIMITS.metadata }).catch((error) => {
    if (error?.code === "tool_timeout") return { code: null };
    throw error;
  });
  if (code !== 0) return null;
  const file = readdirSync(dir).find((name) => name.startsWith(`video.${track.key}.`) && /\.(json3|srt|vtt)$/i.test(name));
  return file ? join(dir, file) : null;
}

/** Downloads the video with the shorter side up to `quality` px, preferring H.264 (faster to decode). */
export async function downloadVideo({ ytdlp, infoPath, dir, quality = 720, ffmpeg, cookies }) {
  const format = ffmpeg
    ? [`bv*[height<=${quality}][vcodec^=avc1]+ba[ext=m4a]`, `bv*[height<=${quality}]+ba`, `b[height<=${quality}]`, "bv*+ba", "b"].join("/")
    : [`b[height<=${quality}]`, "b"].join("/"); // without ffmpeg, only files that need no merging
  const args = [...commonArgs(ytdlp, cookies), "--load-info-json", infoPath, "-f", format, "-o", template(dir)];
  if (ffmpeg) args.push("--merge-output-format", "mp4", "--ffmpeg-location", dirname(ffmpeg));
  const { code, stderr } = await run(ytdlp.file, args, { timeoutMs: LIMITS.download });
  if (code !== 0) throw classifyYtdlpError(stderr);
  const file = readdirSync(dir).find((name) => /^video\.(mp4|mkv|webm|mov)$/i.test(name));
  if (!file) throw new AppError("download_failed", "O download terminou, mas o arquivo de vídeo não apareceu.", errorLine(stderr));
  return join(dir, file);
}
