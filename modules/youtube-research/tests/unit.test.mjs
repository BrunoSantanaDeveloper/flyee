import assert from "node:assert/strict";
import { test } from "node:test";

import { parseJson3, parseVtt, speechStats } from "../scripts/lib/captions.mjs";
import { compact, outliersCsv } from "../scripts/lib/report.mjs";
import {
  band,
  chooseBase,
  engagementWeight,
  freshnessWeight,
  median,
  pickForDetails,
  rank,
  sampleMedians,
  scoreVideo,
} from "../scripts/lib/score.mjs";
import { AppError, choiceOption, intOption, parseArgs, slugify } from "../scripts/lib/util.mjs";
import {
  channelBase,
  classifyYtdlpError,
  isoDate,
  pickCaptionTrack,
  searchParams,
  searchUrl,
  summarizeVideo,
  videoId,
} from "../scripts/lib/youtube.mjs";

test("searchParams encodes YouTube's search filters", () => {
  // Known values from YouTube's own filter links.
  assert.equal(searchParams({ window: "all" }), "EgIQAQ==");
  assert.equal(searchParams({ window: "year" }), "EgQIBRAB");
  assert.equal(searchParams({ window: "all", sort: "views" }), "CAMSAhAB");
  assert.equal(Buffer.from(searchParams({ window: "month", length: "short" }), "base64").toString("hex"), "1206080410011801");
  assert.match(searchUrl("roteiro & retenção", { window: "year" }), /search_query=roteiro%20%26%20reten%C3%A7%C3%A3o&sp=EgQIBRAB$/);
});

test("videoId reads ids and every YouTube video address", () => {
  assert.equal(videoId("NB_BgdAWqBk"), "NB_BgdAWqBk");
  assert.equal(videoId("https://www.youtube.com/watch?v=NB_BgdAWqBk&t=30s"), "NB_BgdAWqBk");
  assert.equal(videoId("youtu.be/NB_BgdAWqBk?si=x"), "NB_BgdAWqBk");
  assert.equal(videoId("https://m.youtube.com/shorts/NB_BgdAWqBk"), "NB_BgdAWqBk");
  assert.equal(videoId("https://www.youtube.com/live/NB_BgdAWqBk"), "NB_BgdAWqBk");
  assert.equal(videoId("https://vimeo.com/123"), null);
  assert.equal(videoId("roteiro"), null);
});

test("channelBase accepts handles, ids and addresses, without the tab", () => {
  assert.equal(channelBase("@alexhenriquepro"), "https://www.youtube.com/@alexhenriquepro");
  assert.equal(channelBase("UCAG5v-MKWxcy3ytM5fP1fEw"), "https://www.youtube.com/channel/UCAG5v-MKWxcy3ytM5fP1fEw");
  assert.equal(channelBase("https://www.youtube.com/@alexhenriquepro/videos"), "https://www.youtube.com/@alexhenriquepro");
  assert.equal(channelBase("youtube.com/channel/UCAG5v-MKWxcy3ytM5fP1fEw/shorts"), "https://www.youtube.com/channel/UCAG5v-MKWxcy3ytM5fP1fEw");
  assert.equal(channelBase("https://www.youtube.com/watch?v=NB_BgdAWqBk"), null);
});

test("median, bands and weights follow the methodology", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([null, undefined]), null);
  assert.equal(band(12, "channel"), "explosive");
  assert.equal(band(3, "channel"), "outlier");
  assert.equal(band(1.5, "sample"), "above");
  assert.equal(band(0.4, "channel"), "weak");
  assert.equal(band(4, "subscribers"), "above");
  assert.equal(band(null, "channel"), null);
  assert.equal(freshnessWeight(10), 1.25);
  assert.equal(freshnessWeight(400), 0.85);
  assert.equal(freshnessWeight(null), 1);
  assert.equal(engagementWeight(0.2), 1.5);
  assert.equal(engagementWeight(0.05), 1.25);
  assert.equal(engagementWeight(null), 1);
});

test("chooseBase prefers the channel, then the sample, then subscribers with a floor", () => {
  assert.deepEqual(chooseBase({ channelMedian: 7000, sampleMedian: 100, subscribers: 1e6 }), { kind: "channel", value: 7000 });
  assert.deepEqual(chooseBase({ sampleMedian: 100, subscribers: 1e6 }), { kind: "sample", value: 100 });
  assert.deepEqual(chooseBase({ subscribers: 120 }), { kind: "subscribers", value: 500 });
  assert.equal(chooseBase({}), null);
});

test("scoreVideo computes multiplier, velocity, engagement, index and flags", () => {
  const scored = scoreVideo({ views: 70000, likes: 6000, comments: 1000, age_days: 20, duration_s: 900, subscribers: 3000 }, { kind: "channel", value: 7000 });
  assert.equal(scored.multiplier, 10);
  assert.equal(scored.band, "explosive");
  assert.equal(scored.views_per_day, 3500);
  assert.equal(scored.engagement, 0.1);
  assert.equal(scored.index, 18.75); // 10 × 1.5 × 1.25 × 1.0
  assert.deepEqual(scored.flags, ["small_channel"]);
  const proxy = scoreVideo({ views: 100, age_days: 3, duration_s: 50 }, { kind: "subscribers", value: 500 });
  assert.deepEqual(proxy.flags, ["no_baseline", "maturing", "short"]);
  assert.equal(proxy.confidence, 0.6);
  const capped = scoreVideo({ views: 1e6 }, { kind: "channel", value: 1000 });
  assert.equal(capped.multiplier, 1000);
  assert.equal(capped.index, 25);
  assert.equal(scoreVideo({ views: 10 }, null).multiplier, null);
});

test("sampleMedians needs three videos of a channel", () => {
  const medians = sampleMedians([
    { channel_id: "a", views: 10 }, { channel_id: "a", views: 30 }, { channel_id: "a", views: 20 },
    { channel_id: "b", views: 5 }, { channel_id: "b", views: 7 },
  ]);
  assert.equal(medians.get("a"), 20);
  assert.equal(medians.has("b"), false);
});

test("rank puts missing metrics last and pickForDetails keeps room for unmeasured videos", () => {
  const items = [
    { id: "a", multiplier: 2, views: 10 }, { id: "b", multiplier: null, views: 900 }, { id: "c", multiplier: 8, views: 5 },
    { id: "d", multiplier: null, views: 50 }, { id: "e", multiplier: 1, views: 1 }, { id: "f", multiplier: 3, views: 1 },
  ];
  assert.deepEqual(rank(items, "multiplier").map((item) => item.id), ["c", "f", "a", "e", "b", "d"]);
  assert.deepEqual(pickForDetails(items, 3).map((item) => item.id), ["c", "f", "b"]);
  assert.deepEqual(pickForDetails(items.filter((item) => item.multiplier === null), 3).map((item) => item.id), ["b", "d"]);
});

test("classifyYtdlpError gives stable codes", () => {
  assert.equal(classifyYtdlpError("ERROR: [youtube:tab] UC1: This channel does not have a shorts tab").code, "no_tab");
  assert.equal(classifyYtdlpError("ERROR: Sign in to confirm you're not a bot").code, "youtube_blocked");
  assert.equal(classifyYtdlpError("ERROR: HTTP Error 429: Too Many Requests").code, "rate_limited");
  assert.equal(classifyYtdlpError("ERROR: [youtube] x: Video unavailable").code, "video_unavailable");
  assert.equal(classifyYtdlpError("ERROR: Unable to download webpage: <urlopen error [Errno 11001] getaddrinfo failed>").code, "offline");
  const generic = classifyYtdlpError("ERROR: something new");
  assert.equal(generic.code, "ytdlp_failed");
  assert.match(generic.fix, /npx --yes flyee@latest need yt-dlp --upgrade --yes --json/);
});

test("summarizeVideo reads the fields other apps use", () => {
  const info = {
    id: "NB_BgdAWqBk", title: "O roteiro", channel: "Canal", channel_id: "UC1", upload_date: "20251110", duration: 846,
    view_count: 33591, like_count: 3196, comment_count: 171, channel_follower_count: 376000, language: "pt-BR",
    automatic_captions: { "pt-orig": [], en: [] }, chapters: [{ start_time: 0, end_time: 60, title: "Intro" }],
  };
  const video = summarizeVideo(info, new Date("2025-11-20T12:00:00Z"));
  assert.equal(video.published_at, "2025-11-10");
  assert.equal(video.age_days, 10);
  assert.equal(video.is_short, false);
  assert.deepEqual(video.captions, { track: "pt-orig", origin: "auto" });
  assert.equal(video.chapters[0].title, "Intro");
  assert.equal(isoDate("2025111"), null);
});

test("pickCaptionTrack prefers the original language, manual first", () => {
  assert.deepEqual(pickCaptionTrack({ language: "en", subtitles: { "en-US": [] }, automatic_captions: { "en-orig": [] } }), { key: "en-US", origin: "manual" });
  assert.deepEqual(pickCaptionTrack({ automatic_captions: { "pt-orig": [], pt: [], en: [] } }), { key: "pt-orig", origin: "auto" });
  assert.equal(pickCaptionTrack({}), null);
  // A regional language still finds the original speech, never the translated track.
  assert.deepEqual(pickCaptionTrack({ language: "pt-BR", automatic_captions: { pt: [], "pt-orig": [], en: [] } }), { key: "pt-orig", origin: "auto" });
  assert.deepEqual(pickCaptionTrack({ language: "en-US", automatic_captions: { en: [], "en-orig": [] } }), { key: "en-orig", origin: "auto" });
  assert.deepEqual(pickCaptionTrack({ automatic_captions: { en: [], "pt-orig": [] } }), { key: "pt-orig", origin: "auto" });
});

test("captions parse and speechStats measures the pace", () => {
  const json3 = JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: "olá pessoal" }] }, { tStartMs: 60000, dDurationMs: 1000, segs: [{ utf8: "[Música] tchau" }] }] });
  const segments = parseJson3(json3);
  assert.equal(segments.length, 2);
  const stats = speechStats(segments);
  assert.equal(stats.words, 3);
  assert.equal(stats.speech_s, 61);
  assert.equal(stats.words_per_minute, 3);
  assert.equal(speechStats([{ start_s: 0, end_s: 5, text: "curto" }]).words_per_minute, null);
  const vtt = "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\num\n\n00:00:02.000 --> 00:00:04.000\num\ndois\n";
  assert.deepEqual(parseVtt(vtt).map((segment) => segment.text), ["um", "dois"]);
});

test("the CSV opens in a Portuguese spreadsheet and numbers read compact", () => {
  const csv = outliersCsv([{ band: "outlier", multiplier: 4.42, index: 5.1, title: 'Roteiro; "viral"', channel: "C", views: 33591, base: { kind: "channel", value: 7600 }, flags: ["old"], queries: ["a", "b"], duration_s: 846, url: "u" }]);
  assert.ok(csv.startsWith("﻿#;Faixa;Multiplicador"));
  const row = csv.split("\r\n")[1];
  assert.match(row, /^1;outlier;4,42;5,1;"Roteiro; ""viral""";C;33591;7600;mediana do canal;/);
  assert.match(row, /14:06;;a \| b;mais de 1 ano;u$/);
  assert.equal(compact(1234567), "1,2 mi");
  assert.equal(compact(6400), "6,4 mil");
  assert.equal(compact(950), "950");
});

test("reports leave a missing value empty or say it in words, never with a dash", async () => {
  const { channelMarkdown, outliersMarkdown, transcriptMarkdown } = await import("../scripts/lib/report.mjs");
  const { titlesMarkdown, traitTable } = await import("../scripts/lib/titles.mjs");
  const DASH = /[–—]/u;
  const outliers = outliersMarkdown({
    created_at: "2026-10-14T12:00:00Z",
    queries: ["airfryer"],
    params: { window: "year", format: "long", rank: "index" },
    sample: { collected: 1, kept: 1, channels: 1, channels_measured: 0, detailed: 0 },
    items: [{ id: "x", url: "u", title: null, channel: null, band: null, multiplier: null, views: 900, views_per_day: null, engagement: null, duration_s: null, published_at: null, flags: ["no_baseline"] }],
  });
  assert.doesNotMatch(outliers, DASH);
  assert.match(outliers, /\| 1 \|  \|  \| 900 \|  \|  \| \[sem título\]\(u\) \|  \|  \|  \| sem a mediana do canal \|/);
  assert.match(outliers, /Célula vazia/);
  const channel = channelMarkdown({ channel: { name: "C", url: "u" }, tab: "videos", sample: 0, median_views: null, created_at: "2026-10-14T12:00:00Z", items: [] });
  assert.match(channel, /normal \(mediana\): sem dado\./);
  const transcript = transcriptMarkdown({ id: "x", url: "u" }, { origin: "auto", track: "pt-orig", words: 3, words_per_minute: null, segments: [] });
  assert.match(transcript, /3 palavras\. Tempos/);
  const titles = titlesMarkdown({ ...traitTable([], { tools: ["Airfryer"] }), queries: ["a"], suggested_tools: [] });
  assert.doesNotMatch(titles, DASH);
  assert.match(titles, /\| tem número \| \(n=0\) \| \(n=0\) \|/);
  assert.match(titles, /\n\nO limite da plataforma/);
});

test("options are validated with messages for the member", () => {
  const { positionals, values } = parseArgs(["a b", "--window", "month", "--json"], { flags: ["json"], options: ["window"] });
  assert.deepEqual(positionals, ["a b"]);
  assert.equal(choiceOption(values, "window", "year", ["week", "month", "year", "all"]), "month");
  assert.throws(() => choiceOption({ window: "decade" }, "window", "year", ["year"]), AppError);
  assert.equal(intOption({}, "details", 15, 0, 50), 15);
  assert.throws(() => intOption({ details: "99" }, "details", 15, 0, 50), (error) => error.code === "usage");
  assert.equal(slugify("Roteiro: o Guia & as Dicas!"), "roteiro-o-guia-as-dicas");
});

test("titleLanguage tells Portuguese, Spanish and English titles apart", async () => {
  const { baseLanguage, titleLanguage } = await import("../scripts/lib/language.mjs");
  assert.equal(titleLanguage("O roteiro que transforma qualquer vídeo em viral."), "pt");
  assert.equal(titleLanguage("GANCHO CRIATIVO que atrai o CLIENTE IDEAL!"), "pt");
  assert.equal(titleLanguage("A neurociência da narrativa viciante (e como dominá-la)"), "pt");
  assert.equal(titleLanguage("Cómo convertirte en un maestro del Storytelling"), "es");
  assert.equal(titleLanguage("Dame 15 Minutos y Te Enseñaré a Dominar el Storytelling en YouTube"), "es");
  assert.equal(titleLanguage("How to Become a Storytelling Genius (Dopamine Ladders)"), "en");
  assert.equal(titleLanguage("Video Pitch Gancho Magnético"), null);
  assert.equal(baseLanguage("pt-BR"), "pt");
  assert.equal(baseLanguage(null), null);
});

test("titles measures each trait against the multiplier, with the size of each group", async () => {
  const { readFileSync } = await import("node:fs");
  const { suggestTools, titlesMarkdown, traitTable } = await import("../scripts/lib/titles.mjs");
  const data = JSON.parse(readFileSync(new URL("./fixtures/outliers-titulos.json", import.meta.url), "utf8"));
  const table = traitTable(data.items, { tools: ["Airfryer", "Tramontina"], minN: 3 });
  assert.equal(table.sample.measured, 11);
  const row = (key) => table.traits.find((trait) => trait.trait === key);
  assert.deepEqual([row("starts_how").with.n, row("starts_how").without.n], [3, 8]);
  assert.equal(row("starts_how").with.median, 5);
  assert.deepEqual([row("tool").with.n, row("tool").with.median], [3, 4]);
  assert.equal(row("brackets").with.n, 2);
  assert.equal(row("brackets").small_n, true);
  assert.equal(row("question").with.n, 1);
  assert.deepEqual([row("first_person").with.n, row("concrete_result").with.n, row("without").with.n, row("caps_word").with.n], [4, 3, 2, 1]);
  assert.equal(row("number").with.n, 3);
  const noTools = traitTable(data.items, { minN: 3 });
  assert.equal(noTools.traits.find((trait) => trait.trait === "tool").skipped, true);
  assert.equal(traitTable(data.items, { base: "channel" }).sample.measured, 8);
  assert.ok(table.length.median_all > 20);
  assert.equal(table.length.outliers_n, 4);
  assert.ok(suggestTools(data.items.map((item) => item.title)).some((tool) => tool.name === "Airfryer"));
  const md = titlesMarkdown({ ...table, queries: data.queries, suggested_tools: [] });
  assert.match(md, /\| começa com "Como" \| 5× \(n=3\) \|/);
  assert.match(md, /não a causa/);
});
