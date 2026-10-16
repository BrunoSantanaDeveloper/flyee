#!/usr/bin/env node
// YouTube research: the commands the member's AI and other apps run.
//   node .flyee/modules/youtube-research/scripts/research.mjs <command> [options] [--json]
// The full interface is in references/interface.md.

import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { speechStats } from "./lib/captions.mjs";
import { baseLanguage, titleLanguage } from "./lib/language.mjs";
import { channelMarkdown, commentsMarkdown, outliersCsv, outliersMarkdown, transcriptMarkdown } from "./lib/report.mjs";
import { chooseBase, median, MIN_CHANNEL_SAMPLE, pickForDetails, rank, RANKS, sampleMedians, scoreVideo } from "./lib/score.mjs";
import { suggestTools, titlesMarkdown, traitTable } from "./lib/titles.mjs";
import { findYtdlp, installHints } from "./lib/tools.mjs";
import {
  AppError,
  ageHours,
  choiceOption,
  intOption,
  isoDay,
  mapLimit,
  parseArgs,
  progress,
  projectRoot,
  readJson,
  slugify,
  toPosix,
  writeFileAtomic,
  writeJson,
} from "./lib/util.mjs";
import {
  channelBase,
  channelTab,
  downloadCaptions,
  pickCaptionTrack,
  search,
  SHORT_MAX_S,
  SORTS,
  summarizeVideo,
  videoId,
  videoInfo,
  WINDOWS,
} from "./lib/youtube.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(SCRIPTS_DIR, "..");
const ROOT = projectRoot(SCRIPTS_DIR);
const MANIFEST = readJson(join(APP_DIR, "flyee.module.json"), {});
const APP = { name: MANIFEST.name ?? "youtube-research", version: MANIFEST.version ?? "0.0.0" };
const INTERFACE_VERSION = 1;
const RESEARCH_DIR = "youtube-research";
const SCRIPT_COMMAND = `node ${toPosix(ROOT, join(SCRIPTS_DIR, "research.mjs"))}`;
const FORMATS = ["long", "short", "any"];
/** How long each kind of saved answer stays fresh, in hours. */
const FRESH = { baseline: 7 * 24, video: 24, comments: 7 * 24 };
const ARG_SPEC = {
  flags: ["json", "refresh", "any-language"],
  options: ["window", "sort", "format", "per-query", "max-channels", "details", "min-views", "lang", "rank", "name", "tab", "limit", "max", "dir", "tools", "min-n", "base", "exclude"],
};

const rel = (path) => toPosix(ROOT, path);
const usage = (message, fix = "Rode o comando `help` para ver as opções.") => new AppError("usage", message, fix);

function researchDir(option) {
  return option ? resolve(ROOT, option) : join(ROOT, RESEARCH_DIR);
}

/** The language YouTube shows titles in: the project's, Portuguese by default. */
function defaultLang() {
  return readJson(join(ROOT, ".flyee", "lock.json"))?.locale === "en" ? "en" : "pt";
}

async function requireYtdlp() {
  const ytdlp = await findYtdlp();
  if (ytdlp) return ytdlp;
  const hints = installHints();
  throw new AppError("tools_missing", "Falta o yt-dlp, o programa que lê o YouTube.", `Instale com: ${hints["yt-dlp"]} (${hints.note})`);
}

function errorOf(error) {
  const known = error instanceof AppError;
  return {
    code: known ? error.code : "unexpected",
    message: known ? error.message : `Erro inesperado: ${error?.message ?? error}`,
    fix: known ? error.fix : "Tente de novo; se repetir, rode o comando check e guarde esta mensagem.",
  };
}

// ---------------------------------------------------------------- cache

function videoDir(base, id) {
  return join(base, "videos", id);
}

function baselinePath(base, channelId, tab) {
  return join(base, "cache", "channels", `${channelId}-${tab}.json`);
}

/** A channel's normal: the median views of its latest uploads on one tab, cached for a week. */
async function channelBaseline(ytdlp, base, { channelId, url, tab, refresh }) {
  const cachePath = channelId ? baselinePath(base, channelId, tab) : null;
  if (cachePath && !refresh && ageHours(cachePath) < FRESH.baseline) {
    const cached = readJson(cachePath);
    if (cached) return { ...cached, cached: true };
  }
  const data = await channelTab(ytdlp, url ?? channelBase(channelId), { tab, limit: 30 });
  const views = data.entries.map((entry) => entry.views).filter((value) => typeof value === "number");
  const result = {
    channel_id: data.channel_id ?? channelId,
    channel: data.channel,
    handle: data.handle,
    url: data.url,
    tab,
    sample: views.length,
    median_views: views.length >= MIN_CHANNEL_SAMPLE ? median(views) : null,
    views,
    fetched_at: new Date().toISOString(),
  };
  if (result.channel_id) writeJson(baselinePath(base, result.channel_id, tab), result);
  return { ...result, cached: false };
}

/** The public data of a video, cached for a day (views keep moving). */
async function cachedVideo(ytdlp, base, id, { refresh = false } = {}) {
  const path = join(videoDir(base, id), "video.json");
  if (!refresh && ageHours(path) < FRESH.video) {
    const cached = readJson(path);
    if (cached?.id) return { video: cached, cached: true };
  }
  const video = summarizeVideo(await videoInfo(ytdlp, id));
  writeJson(path, { ...video, fetched_at: new Date().toISOString() });
  return { video, cached: false };
}

function videoIds(positionals, command) {
  if (!positionals.length) throw usage(`Informe um ou mais vídeos: ${command} <endereço ou id>…`);
  if (positionals.length > 20) throw usage("No máximo 20 vídeos por comando.");
  return positionals.map((input) => {
    const id = videoId(input);
    if (!id) throw new AppError("not_youtube", `"${input}" não é um vídeo do YouTube.`, "Passe o endereço do vídeo (youtube.com/watch?v=…, youtu.be/…, /shorts/…) ou o id de 11 caracteres.");
    return id;
  });
}

// ---------------------------------------------------------------- outliers

function outlierOptions(values) {
  return {
    window: choiceOption(values, "window", "year", WINDOWS),
    sort: choiceOption(values, "sort", "relevance", SORTS),
    format: choiceOption(values, "format", "long", FORMATS),
    per_query: intOption(values, "per-query", 40, 5, 100),
    max_channels: intOption(values, "max-channels", 60, 0, 150),
    details: intOption(values, "details", 15, 0, 50),
    min_views: intOption(values, "min-views", 500, 0, 1e9),
    rank: choiceOption(values, "rank", "index", RANKS),
    lang: values.lang ?? defaultLang(),
    only_language: values["any-language"] ? null : baseLanguage(values.lang ?? defaultLang()),
  };
}

const formatMatches = (format, duration) =>
  format === "any" || duration === null || (format === "short" ? duration <= SHORT_MAX_S : duration > SHORT_MAX_S);

async function outliersCommand(positionals, values) {
  const queries = [...new Set(positionals.map((query) => query.trim()).filter(Boolean))];
  if (!queries.length) throw usage('Informe de 1 a 8 buscas: outliers "busca 1" "busca 2" …', "Use de 3 a 6 variações do tema: termo técnico, termo do dia a dia, a dor do público, a pergunta que ele digitaria.");
  if (queries.length > 8) throw usage("No máximo 8 buscas por pesquisa.");
  const params = outlierOptions(values);
  const refresh = Boolean(values.refresh);
  const ytdlp = await requireYtdlp();
  const base = researchDir(values.dir);
  const name = values.name ? slugify(values.name, 60) : `${slugify(queries[0])}-${isoDay()}`;
  const dir = join(base, "outliers", name);
  const warnings = [];

  // 1. Search, every query, merged by video.
  progress(`Buscando no YouTube: ${queries.length} busca(s), até ${params.per_query} vídeos cada…`);
  const searches = await mapLimit(queries, 3, async (query) => {
    try {
      return { query, videos: await search(ytdlp, query, { window: params.window, sort: params.sort, length: params.format === "short" ? "short" : null, limit: params.per_query, lang: params.lang }) };
    } catch (error) {
      return { query, error };
    }
  });
  const failed = searches.filter((entry) => entry.error);
  if (failed.length === searches.length) throw failed[0].error;
  for (const entry of failed) warnings.push(`A busca "${entry.query}" falhou: ${errorOf(entry.error).message}`);
  const byId = new Map();
  for (const { query, videos } of searches.filter((entry) => !entry.error)) {
    for (const video of videos) {
      if (!byId.has(video.id)) byId.set(video.id, { ...video, title_language: titleLanguage(video.title), queries: [] });
      byId.get(video.id).queries.push(query);
    }
  }
  const collected = [...byId.values()];
  // Search mixes languages: keep the project's (and titles too short to tell) unless --any-language.
  const languageMatches = (video) => !params.only_language || !video.title_language || video.title_language === params.only_language;
  const otherLanguage = collected.filter((video) => !languageMatches(video)).length;
  const kept = collected.filter((video) => languageMatches(video) && formatMatches(params.format, video.duration_s) && (video.views ?? 0) >= params.min_views);
  writeJson(join(dir, "raw.json"), { format_version: 1, created_at: new Date().toISOString(), queries, params, videos: collected });

  // 2. Each channel's normal, from its latest uploads.
  const tabOf = (video) => (video.duration_s !== null && video.duration_s <= SHORT_MAX_S ? "shorts" : "videos");
  const pairs = new Map();
  for (const video of kept) {
    if (!video.channel_id) continue;
    const key = `${video.channel_id}-${tabOf(video)}`;
    if (!pairs.has(key)) pairs.set(key, { channelId: video.channel_id, url: channelBase(video.channel_id), tab: tabOf(video), count: 0, top: 0 });
    const pair = pairs.get(key);
    pair.count += 1;
    pair.top = Math.max(pair.top, video.views ?? 0);
  }
  const ordered = [...pairs.values()].sort((a, b) => b.count - a.count || b.top - a.top);
  const toMeasure = ordered.slice(0, params.max_channels);
  if (ordered.length > toMeasure.length) {
    warnings.push(`${ordered.length - toMeasure.length} canal(is) ficaram sem o normal medido (limite --max-channels ${params.max_channels}); os vídeos deles usam a mediana na amostra ou os inscritos.`);
  }
  if (toMeasure.length) progress(`Medindo o normal de ${toMeasure.length} canal(is) pelos últimos envios…`);
  const baselines = new Map();
  let channelFailures = 0;
  await mapLimit(toMeasure, 4, async (pair) => {
    try {
      const baseline = await channelBaseline(ytdlp, base, { ...pair, refresh });
      baselines.set(`${pair.channelId}-${pair.tab}`, baseline);
    } catch {
      channelFailures += 1;
    }
  });
  if (channelFailures) warnings.push(`Não consegui medir ${channelFailures} canal(is); os vídeos deles usam a mediana na amostra ou os inscritos.`);

  // 3. A first score, then the details of the most promising videos.
  const samples = sampleMedians(kept);
  const baseFor = (video) =>
    chooseBase({ channelMedian: baselines.get(`${video.channel_id}-${tabOf(video)}`)?.median_views, sampleMedian: samples.get(video.channel_id), subscribers: video.subscribers });
  let items = kept.map((video) => ({ ...video, ...scoreVideo(video, baseFor(video), { shortMax: SHORT_MAX_S }) }));
  // Search shows foreign titles translated into the project's language; only the
  // details pass has the original title and the video's own language. A video
  // found to be in another language leaves, and the next candidate takes its place.
  const foreign = (video) => {
    if (!params.only_language) return false;
    const language = baseLanguage(video.language) ?? titleLanguage(video.title);
    return Boolean(language) && language !== params.only_language;
  };
  const detailed = new Map();
  const lateLanguage = new Set();
  const tried = new Set();
  let detailFailures = 0;
  let attempts = 0;
  let toDetail = pickForDetails(items, params.details);
  if (toDetail.length) progress(`Lendo data, curtidas e comentários dos ${toDetail.length} vídeos mais acima do normal…`);
  while (toDetail.length && attempts < 3) {
    attempts += 1;
    for (const item of toDetail) tried.add(item.id);
    await mapLimit(toDetail, 4, async (item) => {
      try {
        const { video } = await cachedVideo(ytdlp, base, item.id, { refresh });
        if (foreign(video)) lateLanguage.add(item.id);
        else detailed.set(item.id, video);
      } catch {
        detailFailures += 1;
      }
    });
    const missing = params.details - detailed.size - detailFailures;
    const remaining = items.filter((item) => !tried.has(item.id));
    toDetail = missing > 0 ? pickForDetails(remaining, missing) : [];
    items = items.filter((item) => !lateLanguage.has(item.id));
  }
  if (detailFailures) warnings.push(`Não consegui ler os detalhes de ${detailFailures} vídeo(s); eles ficam sem data e sem engajamento.`);

  // 4. The final score and ranking.
  items = items.map((item) => {
    const video = detailed.get(item.id);
    const merged = video
      ? {
          ...item,
          title: video.title ?? item.title,
          views: video.views ?? item.views,
          likes: video.likes,
          comments: video.comments,
          subscribers: video.subscribers,
          published_at: video.published_at,
          age_days: video.age_days,
          language: video.language,
          has_captions: Boolean(video.captions),
          most_replayed: video.most_replayed,
          chapters: video.chapters.length,
          detailed: true,
        }
      : { ...item, likes: null, comments: null, subscribers: null, published_at: null, age_days: null, detailed: false };
    return { ...merged, ...scoreVideo(merged, baseFor(merged), { shortMax: SHORT_MAX_S }) };
  });
  if (otherLanguage + lateLanguage.size) {
    warnings.push(
      `${otherLanguage + lateLanguage.size} vídeo(s) em outros idiomas ficaram de fora; --any-language inclui todos. Os vídeos sem detalhes (detailed: false) não tiveram o idioma conferido: o YouTube traduz títulos estrangeiros na busca.`,
    );
  }
  items = rank(items, params.rank);

  if (items.length < 60) warnings.push(`Amostra pequena (${items.length} vídeos): trate os padrões como indício. Mais buscas ou uma janela maior ampliam a amostra.`);
  if (params.window === "all") warnings.push("Sem filtro de data: vídeos antigos são comparados com o normal de hoje do canal. Confira views/dia antes de concluir.");
  const sample = {
    queries: queries.length,
    collected: collected.length,
    kept: items.length,
    other_language: otherLanguage + lateLanguage.size,
    channels: pairs.size,
    channels_measured: [...baselines.values()].filter((baseline) => baseline.median_views !== null).length,
    detailed: detailed.size,
    by_base: Object.fromEntries(["channel", "sample", "subscribers", "none"].map((kind) => [kind, items.filter((item) => (item.base?.kind ?? "none") === kind).length])),
    by_band: Object.fromEntries(["explosive", "outlier", "above", "normal", "weak"].map((name) => [name, items.filter((item) => item.band === name).length])),
  };
  const result = { format_version: 1, created_at: new Date().toISOString(), queries, params, sample, warnings, items };
  writeJson(join(dir, "outliers.json"), result);
  writeFileAtomic(join(dir, "outliers.md"), outliersMarkdown(result));
  writeFileAtomic(join(dir, "outliers.csv"), outliersCsv(items));
  return {
    ok: true,
    command: "outliers",
    interface_version: INTERFACE_VERSION,
    id: name,
    dir: rel(dir),
    files: { json: rel(join(dir, "outliers.json")), md: rel(join(dir, "outliers.md")), csv: rel(join(dir, "outliers.csv")), raw: rel(join(dir, "raw.json")) },
    params,
    sample,
    top: items.slice(0, 10).map((item) => ({
      id: item.id,
      title: item.title,
      channel: item.channel,
      views: item.views,
      multiplier: item.multiplier,
      band: item.band,
      base: item.base?.kind ?? null,
      views_per_day: item.views_per_day,
      published_at: item.published_at,
      flags: item.flags,
      url: item.url,
    })),
    warnings,
  };
}

// ---------------------------------------------------------------- channel

async function resolveChannel(ytdlp, input) {
  const base = channelBase(input);
  if (base) return base;
  const id = videoId(input);
  if (id) {
    const info = await videoInfo(ytdlp, id);
    if (info.channel_id) return channelBase(info.channel_id);
  }
  throw new AppError("not_youtube", `"${input}" não é um canal do YouTube.`, "Passe o @ do canal, o endereço dele ou o endereço de um vídeo do canal.");
}

async function channelCommand(positionals, values) {
  if (positionals.length !== 1) throw usage("Informe um canal: channel <@canal, endereço do canal ou de um vídeo dele>.");
  const tab = choiceOption(values, "tab", "videos", ["videos", "shorts"]);
  const limit = intOption(values, "limit", 30, 5, 100);
  const lang = values.lang ?? defaultLang();
  const ytdlp = await requireYtdlp();
  const base = researchDir(values.dir);
  const url = await resolveChannel(ytdlp, positionals[0]);
  progress(`Lendo os últimos ${limit} envios do canal…`);
  // Views from the English page (the only one whose rounded counts parse right); titles in the project's language.
  const [byViews, byTitles] = await Promise.all([
    channelTab(ytdlp, url, { tab, limit }),
    lang.startsWith("en") ? null : channelTab(ytdlp, url, { tab, limit, lang }).catch(() => null),
  ]);
  const titles = new Map((byTitles?.entries ?? []).map((entry) => [entry.id, entry.title]));
  const views = byViews.entries.map((entry) => entry.views).filter((value) => typeof value === "number");
  const medianViews = views.length ? median(views) : null;
  let subscribers = byViews.subscribers;
  let latest = null;
  if (byViews.entries[0]) {
    try {
      latest = (await cachedVideo(ytdlp, base, byViews.entries[0].id)).video;
      subscribers ??= latest.subscribers;
    } catch {
      // the list is enough without the latest video's details
    }
  }
  const items = byViews.entries.map((entry) => {
    const multiplier = medianViews && typeof entry.views === "number" ? Math.round((entry.views / medianViews) * 100) / 100 : null;
    return { id: entry.id, url: entry.url, title: titles.get(entry.id) ?? entry.title, duration_s: entry.duration_s, views: entry.views, multiplier, band: multiplier === null ? null : scoreVideo(entry, { kind: "channel", value: medianViews }).band };
  });
  const channel = { id: byViews.channel_id, name: byViews.channel, handle: byViews.handle, url: byViews.url, subscribers, latest_published_at: latest?.published_at ?? null };
  if (channel.id && views.length >= MIN_CHANNEL_SAMPLE) {
    writeJson(baselinePath(base, channel.id, tab), { channel_id: channel.id, channel: channel.name, handle: channel.handle, url: channel.url, tab, sample: views.length, median_views: medianViews, views, fetched_at: new Date().toISOString() });
  }
  const dir = join(base, "channels", slugify(channel.handle ?? channel.id ?? channel.name ?? "canal", 60));
  const result = {
    ok: true,
    command: "channel",
    interface_version: INTERFACE_VERSION,
    created_at: new Date().toISOString(),
    channel,
    tab,
    sample: items.length,
    median_views: medianViews,
    views_rounded: true,
    items,
    top: [...items].filter((item) => item.multiplier !== null).sort((a, b) => b.multiplier - a.multiplier).slice(0, 5),
    dir: rel(dir),
    files: { json: rel(join(dir, "channel.json")), md: rel(join(dir, "channel.md")) },
    warnings: items.length < MIN_CHANNEL_SAMPLE ? ["O canal tem poucos envios nesta aba: a mediana diz pouco."] : [],
  };
  writeJson(join(dir, "channel.json"), result);
  writeFileAtomic(join(dir, "channel.md"), channelMarkdown(result));
  return result;
}

// ---------------------------------------------------------------- video, transcript, comments

async function videoCommand(positionals, values) {
  const ids = videoIds(positionals, "video");
  const ytdlp = await requireYtdlp();
  const base = researchDir(values.dir);
  const items = await mapLimit(ids, 3, async (id) => {
    try {
      const { video, cached } = await cachedVideo(ytdlp, base, id, { refresh: Boolean(values.refresh) });
      return { ok: true, id, cached, video, files: { json: rel(join(videoDir(base, id), "video.json")) } };
    } catch (error) {
      return { ok: false, id, error: errorOf(error) };
    }
  });
  return { ok: true, command: "video", interface_version: INTERFACE_VERSION, items };
}

async function transcriptOne(ytdlp, base, id, refresh) {
  const dir = videoDir(base, id);
  const jsonPath = join(dir, "transcript.json");
  const files = { md: rel(join(dir, "transcript.md")), json: rel(jsonPath) };
  const saved = !refresh && readJson(jsonPath);
  if (saved?.segments) {
    const { segments, ...rest } = saved;
    return { ok: true, id, cached: true, ...rest, files };
  }
  const info = await videoInfo(ytdlp, id);
  const video = summarizeVideo(info);
  writeJson(join(dir, "video.json"), { ...video, fetched_at: new Date().toISOString() });
  const track = pickCaptionTrack(info);
  if (!track) throw new AppError("no_captions", "O vídeo não tem legenda, nem a automática do YouTube.", "Sem legenda não há transcrição por aqui. Para ouvir o áudio, use o app Análise de vídeo, se estiver instalado.");
  const segments = await downloadCaptions(ytdlp, info, track);
  if (!segments?.length) throw new AppError("captions_unavailable", "A legenda deste vídeo chegou vazia.", "Tente de novo em alguns minutos.");
  const transcript = {
    format_version: 1,
    id,
    title: video.title,
    channel: video.channel,
    url: video.url,
    language: video.language ?? track.key.replace(/-orig$/, ""),
    origin: track.origin,
    track: track.key,
    duration_s: video.duration_s,
    ...speechStats(segments),
    segments,
  };
  writeJson(jsonPath, transcript);
  writeFileAtomic(join(dir, "transcript.md"), transcriptMarkdown(video, transcript));
  const { segments: _, ...rest } = transcript;
  return { ok: true, id, cached: false, ...rest, files };
}

async function transcriptCommand(positionals, values) {
  const ids = videoIds(positionals, "transcript");
  const ytdlp = await requireYtdlp();
  const base = researchDir(values.dir);
  if (ids.length > 1) progress(`Buscando a legenda de ${ids.length} vídeos…`);
  const items = await mapLimit(ids, 3, async (id) => {
    try {
      return await transcriptOne(ytdlp, base, id, Boolean(values.refresh));
    } catch (error) {
      return { ok: false, id, error: errorOf(error) };
    }
  });
  return { ok: true, command: "transcript", interface_version: INTERFACE_VERSION, items };
}

async function commentsOne(ytdlp, base, id, { max, sort, refresh }) {
  const dir = videoDir(base, id);
  const jsonPath = join(dir, "comments.json");
  const files = { md: rel(join(dir, "comments.md")), json: rel(jsonPath) };
  const saved = readJson(jsonPath);
  if (!refresh && saved?.sort === sort && saved.comments?.length >= Math.min(max, saved.available ?? max) && ageHours(jsonPath) < FRESH.comments) {
    return { ok: true, id, cached: true, count: saved.comments.length, sort, files };
  }
  const info = await videoInfo(ytdlp, id, { comments: max, sort });
  const video = summarizeVideo(info);
  writeJson(join(dir, "video.json"), { ...video, fetched_at: new Date().toISOString() });
  const comments = (info.comments ?? [])
    .filter((comment) => comment.parent === "root" || !comment.parent)
    .slice(0, max)
    .map((comment) => ({
      text: String(comment.text ?? "").trim(),
      likes: typeof comment.like_count === "number" ? comment.like_count : 0,
      pinned: Boolean(comment.is_pinned),
      by_creator: Boolean(comment.author_is_uploader),
      when: comment._time_text ?? null,
    }))
    .filter((comment) => comment.text);
  writeJson(jsonPath, { format_version: 1, id, title: video.title, url: video.url, sort, available: video.comments, fetched_at: new Date().toISOString(), comments });
  writeFileAtomic(join(dir, "comments.md"), commentsMarkdown(video, comments, sort));
  return { ok: true, id, cached: false, count: comments.length, sort, files };
}

async function commentsCommand(positionals, values) {
  const ids = videoIds(positionals, "comments");
  const max = intOption(values, "max", 100, 10, 500);
  const sort = choiceOption(values, "sort", "top", ["top", "new"]);
  const ytdlp = await requireYtdlp();
  const base = researchDir(values.dir);
  progress(`Lendo até ${max} comentários de ${ids.length} vídeo(s)…`);
  const items = await mapLimit(ids, 2, async (id) => {
    try {
      return await commentsOne(ytdlp, base, id, { max, sort, refresh: Boolean(values.refresh) });
    } catch (error) {
      return { ok: false, id, error: errorOf(error) };
    }
  });
  return { ok: true, command: "comments", interface_version: INTERFACE_VERSION, items };
}

// ---------------------------------------------------------------- check, list, help

async function checkCommand(values) {
  const ytdlp = await findYtdlp({ version: true });
  const hints = installHints();
  const install = ytdlp ? {} : { "yt-dlp": hints["yt-dlp"] };
  return {
    ok: true,
    command: "check",
    interface_version: INTERFACE_VERSION,
    app: APP,
    project: ROOT,
    research_dir: rel(researchDir(values.dir)),
    node: process.version,
    tools: { "yt-dlp": ytdlp?.version ?? null },
    ready: Boolean(ytdlp),
    install,
    install_note: ytdlp ? null : hints.note,
    update_ytdlp: hints.update_ytdlp,
  };
}

/** An outliers research by its id (the folder name) or by the path of its outliers.json. */
function resolveOutliers(input, dirOption) {
  if (!input) throw usage("Informe a pesquisa: titles <id da pesquisa de outliers>.", "O id é o nome da pasta em youtube-research/outliers/ (o campo id que o outliers devolveu).");
  const candidates = [join(researchDir(dirOption), "outliers", input, "outliers.json"), resolve(ROOT, input), join(resolve(ROOT, input), "outliers.json")];
  const file = candidates.find((path) => existsSync(path) && path.endsWith(".json"));
  const data = file ? readJson(file) : null;
  if (!data?.items) throw new AppError("not_found", `Não encontrei a pesquisa "${input}".`, "Rode outliers antes, ou passe o id que ele devolveu.");
  return { file, data };
}

function titlesCommand(positionals, values) {
  const { file, data } = resolveOutliers(positionals[0], values.dir);
  const minN = intOption(values, "min-n", 5, 2, 50);
  const base = choiceOption(values, "base", "any", ["any", "channel"]);
  const tools = String(values.tools ?? "").split(",").map((tool) => tool.trim()).filter(Boolean);
  // Off-topic videos (another meaning of the search words, a neighbouring niche) skew every trait.
  const exclude = new Set(String(values.exclude ?? "").split(",").map((id) => id.trim()).filter(Boolean));
  const items = data.items.filter((item) => !exclude.has(item.id));
  const excluded = data.items.filter((item) => exclude.has(item.id)).map((item) => ({ id: item.id, title: item.title ?? null }));
  const unknown = [...exclude].filter((id) => !data.items.some((item) => item.id === id));
  const table = traitTable(items, { tools, minN, base });
  const suggested = suggestTools(items.map((item) => item.title ?? ""));
  const dir = dirname(file);
  const result = {
    ok: true,
    command: "titles",
    interface_version: INTERFACE_VERSION,
    id: data.params?.name ?? positionals[0],
    queries: data.queries ?? [],
    ...table,
    suggested_tools: suggested,
    excluded,
    files: { json: rel(join(dir, "titulos.json")), md: rel(join(dir, "titulos.md")) },
    warnings: [
      ...(table.sample.measured < 30 ? [`Só ${table.sample.measured} títulos com multiplicador: trate tudo como indício.`] : []),
      ...(unknown.length ? [`Não achei na pesquisa: ${unknown.join(", ")}. Use os ids de outliers.json.`] : []),
    ],
  };
  writeJson(join(dir, "titulos.json"), result);
  writeFileAtomic(join(dir, "titulos.md"), titlesMarkdown(result));
  return result;
}

function listCommand(values) {
  const base = researchDir(values.dir);
  const folder = (name) => (existsSync(join(base, name)) ? readdirSync(join(base, name)) : []);
  const outliers = folder("outliers").map((id) => {
    const data = readJson(join(base, "outliers", id, "outliers.json"));
    return { id, queries: data?.queries ?? [], created_at: data?.created_at ?? null, kept: data?.sample?.kept ?? null, md: rel(join(base, "outliers", id, "outliers.md")) };
  });
  const channels = folder("channels").map((id) => {
    const data = readJson(join(base, "channels", id, "channel.json"));
    return { id, name: data?.channel?.name ?? null, median_views: data?.median_views ?? null, md: rel(join(base, "channels", id, "channel.md")) };
  });
  const videos = folder("videos").map((id) => {
    const files = readdirSync(join(base, "videos", id));
    const data = readJson(join(base, "videos", id, "video.json"));
    return { id, title: data?.title ?? null, transcript: files.includes("transcript.md"), comments: files.includes("comments.md") };
  });
  return { ok: true, command: "list", dir: rel(base), outliers, channels, videos };
}

const HELP = `Pesquisa no YouTube: o que performou acima do normal de cada canal, transcrições, comentários e canais. Sem chave.

Uso: ${SCRIPT_COMMAND} <comando> [opções] [--json]

Comandos
  check                          O yt-dlp está instalado? Mostra a versão e como instalar.
  outliers "busca" ["busca"…]    Busca vídeos de um tema (1 a 8 buscas), mede o normal de cada canal e ranqueia.
  channel <canal>                Os últimos envios de um canal (@nome, endereço do canal ou de um vídeo dele), com a mediana.
  video <vídeo>…                 Os dados públicos de um ou mais vídeos: data, views, curtidas, capítulos, trechos mais revistos.
  transcript <vídeo>…            A fala com tempos, pela legenda do YouTube, sem baixar o vídeo; palavras por minuto.
  comments <vídeo>…              Os comentários mais relevantes (ou os mais novos), sem respostas e sem nomes.
  titles <pesquisa>              Os traços de título (número, ferramenta, parênteses, "Como", primeira pessoa…) contra o multiplicador.
  list                           O que já foi pesquisado neste projeto.
  help                           Esta ajuda.

Opções de outliers
  --window week|month|year|all   Janela de publicação (padrão: year).
  --format long|short|any        Vídeos longos, Shorts (até 3 min) ou todos (padrão: long).
  --per-query N                  Vídeos por busca, de 5 a 100 (padrão: 40).
  --max-channels N               Canais medidos pelos últimos envios, de 0 a 150 (padrão: 60).
  --details N                    Vídeos do topo com data, curtidas e comentários, de 0 a 50 (padrão: 15).
  --min-views N                  Ignora vídeos com menos views (padrão: 500).
  --sort relevance|views|date    Ordem da busca no YouTube (padrão: relevance).
  --rank index|multiplier|velocity|views   Ordem do resultado (padrão: index).
  --lang pt|en|…                 Idioma dos vídeos e dos títulos (padrão: o do projeto).
  --any-language                 Inclui vídeos em outros idiomas (a busca do YouTube mistura idiomas).
  --name <nome>                  Nome da pasta do resultado (padrão: a primeira busca e a data).

Outras opções
  --tab videos|shorts --limit N  (channel) A aba e quantos envios ler (padrão: videos, 30).
  --max N --sort top|new         (comments) Quantos comentários, de 10 a 500 (padrão: 100, top).
  --tools "A,B" --min-n N --base any|channel   (titles) Nomes de ferramentas ou marcas do tema; tamanho mínimo de grupo (padrão: 5); só a base do canal.
  --exclude id,id                (titles) Os vídeos fora do tema, que saem da conta.
  --refresh                      Busca de novo em vez de reaproveitar o que já foi lido.
  --dir <pasta>                  Outra pasta para a pesquisa (padrão: ${RESEARCH_DIR}).
  --json                         Saída em JSON, para a IA e para outros apps.`;

function humanText(result) {
  if (!result.ok) return [`Erro (${result.error.code}): ${result.error.message}`, result.error.fix && `Como resolver: ${result.error.fix}`].filter(Boolean).join("\n");
  const warnings = (result.warnings ?? []).map((warning) => `Aviso: ${warning}`);
  const itemLine = (item, ok) => (item.ok ? ok(item) : `${item.id}: erro (${item.error.code}) ${item.error.message}`);
  // A missing number is left out of the line instead of standing in for a dash.
  const known = (value) => typeof value === "number" && Number.isFinite(value);
  const times = (value) => (known(value) ? `${value}× ` : "");
  switch (result.command) {
    case "help":
      return result.text;
    case "check":
      return [
        `Pesquisa no YouTube ${result.app.version} · Node ${result.node}`,
        `yt-dlp: ${result.tools["yt-dlp"] ?? "não encontrado"}`,
        ...Object.entries(result.install).map(([name, command]) => `Instalar ${name}: ${command}`),
        result.install_note,
      ].filter(Boolean).join("\n");
    case "outliers":
      return [
        `${result.sample.kept} vídeos analisados de ${result.sample.channels} canais (${result.sample.channels_measured} com o normal medido). Resultado: ${result.files.md}`,
        ...result.top.map((item, i) => `${i + 1}. ${times(item.multiplier)}${item.title} (${item.channel})`),
        ...warnings,
      ].join("\n");
    case "channel": {
      const normal = known(result.median_views)
        ? `mediana de ${result.median_views} views nos últimos ${result.sample} envios`
        : `últimos ${result.sample} envios, sem views para calcular a mediana`;
      return [`${result.channel.name}: ${normal}. Resultado: ${result.files.md}`, ...warnings].join("\n");
    }
    case "video":
      return result.items
        .map((item) => itemLine(item, (ok) => [`${ok.id}: ${ok.video.title}`, known(ok.video.views) && `${ok.video.views} views`, ok.video.published_at ?? "sem data"].filter(Boolean).join(" · ")))
        .join("\n");
    case "transcript":
      return result.items.map((item) => itemLine(item, (ok) => `${ok.id}: ${ok.words} palavras${known(ok.words_per_minute) ? `, ${ok.words_per_minute} por minuto` : ""} → ${ok.files.md}`)).join("\n");
    case "comments":
      return result.items.map((item) => itemLine(item, (ok) => `${ok.id}: ${ok.count} comentários → ${ok.files.md}`)).join("\n");
    case "titles":
      return [
        `${result.sample.measured} títulos com multiplicador. Relatório: ${result.files.md}`,
        ...result.traits.map((row) => (row.skipped ? `- ${row.label}: ${row.note}` : `- ${row.label}: ${times(row.with.median)}com (n=${row.with.n}) contra ${times(row.without.median)}sem (n=${row.without.n})${row.small_n ? " · grupo pequeno" : ""}`)),
        ...warnings,
      ].join("\n");
    case "list":
      return [
        `Pesquisas de outliers: ${result.outliers.length} · canais: ${result.channels.length} · vídeos: ${result.videos.length} (em ${result.dir})`,
        ...result.outliers.map((item) => `- ${item.id}: ${item.queries.join(" · ")}`),
      ].join("\n");
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
      return checkCommand(values);
    case "outliers":
      return outliersCommand(positionals, values);
    case "channel":
      return channelCommand(positionals, values);
    case "video":
      return videoCommand(positionals, values);
    case "transcript":
      return transcriptCommand(positionals, values);
    case "comments":
      return commentsCommand(positionals, values);
    case "titles":
      return titlesCommand(positionals, values);
    case "list":
      return listCommand(values);
    default:
      throw usage(`Comando desconhecido: ${command}.`, "Comandos: check, outliers, channel, video, transcript, comments, titles, list, help.");
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const json = process.argv.includes("--json");
  main(process.argv.slice(2))
    .then((result) => process.stdout.write(`${json ? JSON.stringify(result, null, 2) : humanText(result)}\n`))
    .catch((error) => {
      const result = { ok: false, command: process.argv[2] ?? null, error: errorOf(error) };
      process.stdout.write(`${json ? JSON.stringify(result, null, 2) : humanText(result)}\n`);
      process.exitCode = error instanceof AppError && error.code === "usage" ? 2 : 1;
    });
}
