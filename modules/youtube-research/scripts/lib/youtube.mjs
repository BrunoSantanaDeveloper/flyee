// Talks to YouTube through yt-dlp: search, channel tabs, video details,
// captions and comments. No key: everything public, read like a visitor.

import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readCaptions } from "./captions.mjs";
import { installHints } from "./tools.mjs";
import { AppError, run } from "./util.mjs";

const YOUTUBE = "https://www.youtube.com";

/** YouTube's search filter codes (the `sp` parameter is a small protobuf). */
const WINDOW_CODES = { week: 3, month: 4, year: 5 };
const SORT_CODES = { relevance: 0, date: 2, views: 3 };
const LENGTH_CODES = { short: 1, long: 2, medium: 3 };

export const WINDOWS = ["week", "month", "year", "all"];
export const SORTS = Object.keys(SORT_CODES);

/** Shorts last up to 3 minutes; anything longer is long-form. */
export const SHORT_MAX_S = 180;

/**
 * The `sp` value of a search: optional sort (field 1), then the filters
 * message (field 2) with upload date (1), type = video (2) and length (3).
 */
export function searchParams({ window = "year", sort = "relevance", length = null } = {}) {
  const filters = [];
  if (window !== "all") filters.push(0x08, WINDOW_CODES[window]);
  filters.push(0x10, 0x01);
  if (length) filters.push(0x18, LENGTH_CODES[length]);
  const bytes = [];
  if (SORT_CODES[sort]) bytes.push(0x08, SORT_CODES[sort]);
  bytes.push(0x12, filters.length, ...filters);
  return Buffer.from(bytes).toString("base64");
}

export function searchUrl(query, options) {
  return `${YOUTUBE}/results?search_query=${encodeURIComponent(query)}&sp=${encodeURIComponent(searchParams(options))}`;
}

/** A video id from an id or any YouTube video address, or null. */
export function videoId(input) {
  const text = String(input ?? "").trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  if (host === "youtu.be") return /^\/([\w-]{11})/.exec(url.pathname)?.[1] ?? null;
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;
  const v = url.searchParams.get("v");
  if (v && /^[\w-]{11}$/.test(v)) return v;
  return /^\/(?:shorts|live|embed|v)\/([\w-]{11})/.exec(url.pathname)?.[1] ?? null;
}

export const watchUrl = (id) => `${YOUTUBE}/watch?v=${id}`;

/**
 * The base address of a channel from a handle (@name), a channel id (UC…) or
 * any channel address, without the tab (/videos, /shorts…). Null when it is not one.
 */
export function channelBase(input) {
  const text = String(input ?? "").trim();
  if (/^@[\w.-]+$/.test(text)) return `${YOUTUBE}/${text}`;
  if (/^UC[\w-]{22}$/.test(text)) return `${YOUTUBE}/channel/${text}`;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.hostname.replace(/^(www|m)\./, "") !== "youtube.com") return null;
  const m = /^\/(@[^/]+|channel\/UC[\w-]{22}|c\/[^/]+|user\/[^/]+)/.exec(decodeURIComponent(url.pathname));
  return m ? `${YOUTUBE}/${m[1]}` : null;
}

function commonArgs(ytdlp, lang) {
  const args = [...ytdlp.prefix, "--no-progress", "--encoding", "utf-8", "--ignore-no-formats-error"];
  if (lang) args.push("--extractor-args", `youtube:lang=${lang}`);
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
  if (/does not have a (\w+) tab/i.test(text)) {
    return new AppError("no_tab", "O canal não tem essa aba (por exemplo, nunca publicou Shorts).", "Use a outra aba: --tab videos ou --tab shorts.");
  }
  if (/confirm your age|age[- ]restricted|inappropriate for some users/i.test(text)) {
    return new AppError("age_restricted", "O vídeo tem restrição de idade e o YouTube exige uma conta para abri-lo.", "Escolha outro vídeo; este não pode ser lido sem login.");
  }
  if (/not a bot|Sign in to confirm/i.test(text)) {
    return new AppError("youtube_blocked", "O YouTube recusou a consulta automática (pediu para confirmar que não é um robô).", `Atualize o yt-dlp (${update}), espere alguns minutos e tente de novo com menos vídeos.`);
  }
  if (/private video|this video is private/i.test(text)) {
    return new AppError("private_video", "O vídeo é privado.", "Só o dono pode abrir.");
  }
  if (/members[- ]only|join this channel|channel's members/i.test(text)) {
    return new AppError("members_only", "O vídeo é exclusivo para membros do canal.", "Escolha outro vídeo.");
  }
  if (/HTTP Error 429|Too Many Requests/i.test(text)) {
    return new AppError("rate_limited", "O YouTube limitou os pedidos desta conexão por um tempo.", "Espere alguns minutos e tente de novo, com menos buscas ou canais.");
  }
  if (/This channel does not exist|channel.*(not found|does not exist)|HTTP Error 404/i.test(text)) {
    return new AppError("not_found", "O canal ou o vídeo não existe nesse endereço.", "Confira o endereço abrindo-o no navegador.");
  }
  if (/video unavailable|this video is unavailable|has been removed|does not exist/i.test(text)) {
    return new AppError("video_unavailable", "O vídeo não está disponível (removido, bloqueado no país ou endereço errado).", "Confira o endereço abrindo-o no navegador.");
  }
  if (/getaddrinfo|Unable to download (webpage|API page)|timed out|Connection(Reset|Refused)|Network is unreachable|Temporary failure/i.test(text)) {
    return new AppError("offline", "Não consegui falar com o YouTube.", "Confira a conexão com a internet e tente de novo.");
  }
  return new AppError("ytdlp_failed", "O yt-dlp não conseguiu ler o YouTube.", detail ? `Detalhe: ${detail}. Atualizar o yt-dlp costuma resolver: ${update}` : `Atualize o yt-dlp: ${update}`);
}

async function runJson(ytdlp, args) {
  const { code, stdout, stderr } = await run(ytdlp.file, args);
  if (code !== 0 && !stdout.length) throw classifyYtdlpError(stderr);
  try {
    return JSON.parse(stdout.toString("utf8"));
  } catch {
    throw classifyYtdlpError(stderr);
  }
}

const number = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/**
 * One search: up to `limit` videos, with exact views, length and channel.
 * Search results carry no date; `video` fills it in.
 */
export async function search(ytdlp, query, { window, sort, length, limit, lang }) {
  const args = [...commonArgs(ytdlp, lang), "--flat-playlist", "--playlist-end", String(limit), "-J", searchUrl(query, { window, sort, length })];
  const data = await runJson(ytdlp, args);
  return (data.entries ?? [])
    .filter((entry) => entry?.id && /^[\w-]{11}$/.test(entry.id) && entry.live_status !== "is_live" && entry.live_status !== "is_upcoming")
    .map((entry) => ({
      id: entry.id,
      url: watchUrl(entry.id),
      title: entry.title ?? null,
      channel: entry.channel ?? entry.uploader ?? null,
      channel_id: entry.channel_id ?? null,
      channel_url: entry.channel_url ?? (entry.channel_id ? `${YOUTUBE}/channel/${entry.channel_id}` : null),
      duration_s: number(entry.duration),
      views: number(entry.view_count),
    }));
}

/**
 * A channel's latest uploads from one tab (`videos` or `shorts`), newest first.
 * Views on a tab come rounded ("6.4K"). Without `lang` the page is read in
 * English, the only language whose rounded counts yt-dlp parses right
 * ("6,4 mil" in Portuguese comes back as 64); `lang` is for titles only.
 */
export async function channelTab(ytdlp, base, { tab = "videos", limit = 30, lang = null } = {}) {
  const args = [...commonArgs(ytdlp, lang), "--flat-playlist", "--playlist-end", String(limit), "-J", `${base}/${tab}`];
  const data = await runJson(ytdlp, args);
  return {
    channel: data.channel ?? data.uploader ?? null,
    channel_id: data.channel_id ?? null,
    handle: typeof data.uploader_id === "string" && data.uploader_id.startsWith("@") ? data.uploader_id : null,
    url: data.channel_url ?? base,
    subscribers: number(data.channel_follower_count),
    entries: (data.entries ?? [])
      .filter((entry) => entry?.id)
      .map((entry) => ({ id: entry.id, url: watchUrl(entry.id), title: entry.title ?? null, duration_s: number(entry.duration), views: number(entry.view_count) })),
  };
}

/** The full public data of one video; with `comments`, also the top comments (no replies). */
export async function videoInfo(ytdlp, id, { comments = 0, sort = "top" } = {}) {
  const args = [...commonArgs(ytdlp, null), "--skip-download", "--no-playlist", "-J"];
  if (comments > 0) args.push("--write-comments", "--extractor-args", `youtube:max_comments=${comments},${comments},0,0;comment_sort=${sort}`);
  args.push(watchUrl(id));
  const info = await runJson(ytdlp, args);
  if (info._type === "playlist") throw new AppError("usage", "O endereço é de uma playlist.", "Passe o endereço de um vídeo por vez.");
  return info;
}

const roundTo = (value, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * The parts viewers replayed most, from YouTube's heatmap: up to three peaks at
 * least a tenth of the video apart, skipping the start (always high).
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
      return { start_s: roundTo(before.start_time), end_s: roundTo(after.end_time), intensity: roundTo(point.value) };
    });
}

export function isoDate(uploadDate) {
  return /^\d{8}$/.test(uploadDate ?? "") ? `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}` : null;
}

/** The fields other apps read about a video. */
export function summarizeVideo(info, now = new Date()) {
  const published = isoDate(info.upload_date);
  const ageDays = published ? Math.max(0, Math.floor((now - new Date(`${published}T00:00:00Z`)) / 864e5)) : null;
  const duration = number(info.duration);
  const track = pickCaptionTrack(info);
  return {
    id: info.id,
    url: watchUrl(info.id),
    title: info.title ?? null,
    channel: info.channel ?? info.uploader ?? null,
    channel_id: info.channel_id ?? null,
    channel_url: info.channel_url ?? null,
    subscribers: number(info.channel_follower_count),
    published_at: published,
    age_days: ageDays,
    duration_s: duration,
    is_short: duration !== null && duration <= SHORT_MAX_S,
    views: number(info.view_count),
    likes: number(info.like_count),
    comments: number(info.comment_count),
    language: info.language ?? null,
    captions: track ? { track: track.key, origin: track.origin } : null,
    chapters: (info.chapters ?? []).map((chapter) => ({ start_s: chapter.start_time, end_s: chapter.end_time, title: chapter.title })),
    most_replayed: mostReplayed(info.heatmap, duration),
    tags: (info.tags ?? []).slice(0, 15),
    description: String(info.description ?? "").slice(0, 1500),
  };
}

function matchLanguage(keys, language) {
  if (!language) return null;
  const target = language.toLowerCase();
  const base = target.split("-")[0];
  return keys.find((key) => key.toLowerCase() === target) ?? keys.find((key) => key.toLowerCase() === base || key.toLowerCase().startsWith(`${base}-`)) ?? null;
}

/** The automatic track of the original speech for a language ("pt-BR" → "pt-BR-orig" or "pt-orig"), or null. */
function originalTrack(keys, language) {
  const target = language.toLowerCase();
  const base = target.split("-")[0];
  return keys.find((key) => key.toLowerCase() === `${target}-orig`) ?? keys.find((key) => key.toLowerCase() === `${base}-orig`) ?? null;
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
    // "pt-BR" as the language still has its original speech in "pt-orig"; plain "pt" is YouTube's translation, which often fails.
    const autoTrack = originalTrack(automatic, original) ?? matchLanguage(automatic, original);
    if (autoTrack) return { key: autoTrack, origin: "auto" };
  }
  for (const language of ["pt-BR", "pt", "en"]) {
    const track = matchLanguage(manual, language);
    if (track) return { key: track, origin: "manual" };
  }
  if (manual.length) return { key: manual[0], origin: "manual" };
  for (const language of ["pt-BR", "pt", "en"]) {
    const track = originalTrack(automatic, language) ?? matchLanguage(automatic, language);
    if (track) return { key: track, origin: "auto" };
  }
  return automatic.length ? { key: automatic[0], origin: "auto" } : null;
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Downloads only the chosen caption track and returns its timed segments,
 * or null when YouTube did not deliver it. Works in a temporary folder.
 */
export async function downloadCaptions(ytdlp, info, track) {
  const dir = mkdtempSync(join(tmpdir(), "youtube-research-"));
  try {
    const infoPath = join(dir, "video.info.json");
    writeFileSync(infoPath, JSON.stringify(info));
    const args = [
      ...ytdlp.prefix, "--no-progress", "--encoding", "utf-8",
      "--load-info-json", infoPath, "--skip-download",
      track.origin === "manual" ? "--write-subs" : "--write-auto-subs",
      "--sub-langs", `^${escapeRegex(track.key)}$`, "--sub-format", "json3/srt/vtt/best",
      "-o", join(dir, "video.%(ext)s").replace(/\\/g, "/"),
    ];
    const { code } = await run(ytdlp.file, args);
    if (code !== 0) return null;
    const file = readdirSync(dir).find((name) => name.startsWith(`video.${track.key}.`) && /\.(json3|srt|vtt)$/i.test(name));
    return file ? readCaptions(join(dir, file)) : null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
