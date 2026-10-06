import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { groupSpeech, parseJson3, parseSrt, parseVtt, speechBetween } from "../scripts/lib/captions.mjs";
import { buildPrompt, descriptionHeader, readHeader, renderDescription } from "../scripts/lib/description.mjs";
import { escapeFilterPath, gridLayout, mergeCuts, pickFrames, similar, stillChanges } from "../scripts/lib/frames.mjs";
import { classifyGeminiError, parseJsonReply, videoPart } from "../scripts/lib/gemini.mjs";
import { identifySource, looksLikeId, youtubeId } from "../scripts/lib/source.mjs";
import { measurementLines } from "../scripts/lib/store.mjs";
import { geminiKey, keySetup, keyStorePath, readSavedKey } from "../scripts/lib/tools.mjs";
import { AppError, displayPath, fileTime, formatTime, parseArgs, parseTime, slugify } from "../scripts/lib/util.mjs";
import { classifyYtdlpError, mostReplayed, pickCaptionTrack, summarizeMetadata } from "../scripts/lib/ytdlp.mjs";

test("parseTime accepts seconds, clock and unit forms", () => {
  assert.equal(parseTime("90"), 90);
  assert.equal(parseTime("90.5"), 90.5);
  assert.equal(parseTime("1:30"), 90);
  assert.equal(parseTime("01:02:03"), 3723);
  assert.equal(parseTime("1m30s"), 90);
  assert.equal(parseTime("2h"), 7200);
  assert.equal(parseTime("1,5"), 1.5);
  assert.throws(() => parseTime("abc"), AppError);
});

test("formatTime and fileTime", () => {
  assert.equal(formatTime(75), "01:15");
  assert.equal(formatTime(3723), "1:02:03");
  assert.equal(formatTime(75, true), "0:01:15");
  assert.equal(fileTime(75), "01m15s");
  assert.equal(fileTime(3723), "1h02m03s");
});

test("parseArgs separates flags, options and positionals and rejects unknown options", () => {
  const { positionals, values } = parseArgs(["video.mp4", "--focus", "editing", "--json", "--name=meu-app"], { flags: ["json"], options: ["focus", "name"] });
  assert.deepEqual(positionals, ["video.mp4"]);
  assert.deepEqual(values, { focus: "editing", json: true, name: "meu-app" });
  assert.throws(() => parseArgs(["--foco", "x"], { flags: [], options: ["focus"] }), (error) => error.code === "usage");
  assert.throws(() => parseArgs(["--focus"], { flags: [], options: ["focus"] }), (error) => error.code === "usage");
});

test("slugify and displayPath", () => {
  assert.equal(slugify("Aula 3: Cortes & Ritmo!"), "aula-3-cortes-ritmo");
  assert.equal(slugify("???"), "video");
  assert.equal(displayPath(join("C:", "proj"), join("C:", "proj", "a", "b.mp4")), "a/b.mp4");
});

test("youtubeId reads every common address form", () => {
  const id = "dQw4w9WgXcQ";
  for (const url of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&list=PL123&t=42`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?t=3`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}`,
    `https://www.youtube.com/embed/${id}`,
  ]) {
    assert.equal(youtubeId(url), id, url);
  }
  assert.equal(youtubeId("https://www.youtube.com/playlist?list=PL123"), null);
  assert.equal(youtubeId("https://vimeo.com/123"), null);
  assert.equal(youtubeId("not a url"), null);
});

test("identifySource gives stable ids for YouTube, other sites and files", () => {
  const yt = identifySource("https://youtu.be/dQw4w9WgXcQ");
  assert.equal(yt.type, "youtube");
  assert.equal(yt.id, "yt-dQw4w9WgXcQ");
  assert.equal(yt.url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const web = identifySource("https://vimeo.com/76979871");
  assert.equal(web.type, "url");
  assert.match(web.id, /^url-vimeo-com-[0-9a-f]{8}$/);
  assert.equal(identifySource("https://vimeo.com/76979871").id, web.id);
  const dir = mkdtempSync(join(tmpdir(), "va-source-"));
  try {
    writeFileSync(join(dir, "Minha Aula.mp4"), "x");
    const file = identifySource("Minha Aula.mp4", { cwd: dir });
    assert.equal(file.type, "file");
    assert.match(file.id, /^file-minha-aula-[0-9a-f]{8}$/);
    assert.ok(looksLikeId(file.id));
    assert.throws(() => identifySource("nao-existe.mp4", { cwd: dir }), (error) => error.code === "file_not_found");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("parseVtt keeps only new lines of YouTube's rolling automatic captions", () => {
  const vtt = [
    "WEBVTT",
    "Kind: captions",
    "Language: en",
    "",
    "00:00:00.040 --> 00:00:02.869 align:start position:0%",
    " ",
    "in<00:00:00.320><c> this</c><00:00:00.640><c> video</c>",
    "",
    "00:00:02.869 --> 00:00:02.879 align:start position:0%",
    "in this video",
    " ",
    "",
    "00:00:02.879 --> 00:00:05.000 align:start position:0%",
    "in this video",
    "we<00:00:03.100><c> cut</c><00:00:03.400><c> fast</c>",
    "",
  ].join("\n");
  const segments = parseVtt(vtt);
  assert.deepEqual(
    segments.map((segment) => segment.text),
    ["in this video", "we cut fast"],
  );
  assert.equal(segments[0].start_s, 0.04);
  assert.equal(segments[1].start_s, 2.879);
});

test("parseSrt and parseJson3", () => {
  const srt = "1\n00:00:01,000 --> 00:00:02,500\nOlá <i>mundo</i>\n\n2\n00:00:03,000 --> 00:00:04,000\nTchau &amp; até\n";
  assert.deepEqual(parseSrt(srt), [
    { start_s: 1, end_s: 2.5, text: "Olá mundo" },
    { start_s: 3, end_s: 4, text: "Tchau & até" },
  ]);
  const json3 = JSON.stringify({ events: [{ tStartMs: 500, dDurationMs: 1000, segs: [{ utf8: "Oi" }, { utf8: " gente" }] }, { tStartMs: 2000, segs: [{ utf8: "\n" }] }] });
  assert.deepEqual(parseJson3(json3), [{ start_s: 0.5, end_s: 1.5, text: "Oi gente" }]);
});

test("groupSpeech and speechBetween", () => {
  const segments = [
    { start_s: 0, end_s: 2, text: "Um" },
    { start_s: 2, end_s: 4, text: "dois." },
    { start_s: 10, end_s: 12, text: "Três" },
    { start_s: 20, end_s: 22, text: "quatro" },
  ];
  const blocks = groupSpeech(segments, { maxSeconds: 12 });
  assert.equal(blocks[0].text, "Um dois.");
  assert.equal(speechBetween(segments, 0, 10), "Um dois.");
  assert.equal(speechBetween(segments, 10, 30), "Três quatro");
});

function signature(value, size = 576) {
  return Buffer.alloc(size, value);
}

test("pickFrames: one frame per shot, repeats folded, budget respected", () => {
  const rate = 2;
  // 20 s: shots 0–5 (A), 5–8 (B), 8–12 (C), 12–15 (B again), 15–20 (D)
  const valueAt = (t) => (t < 5 ? 10 : t < 8 ? 120 : t < 12 ? 200 : t < 15 ? 120 : 60);
  const signatures = Array.from({ length: 40 }, (_, i) => signature(valueAt(i / rate)));
  const picked = pickFrames({ start: 0, end: 20, cuts: [5, 8, 12, 15], signatures, rate, maxFrames: 48 });
  assert.deepEqual(picked.cuts, [5, 8, 12, 15]);
  assert.equal(picked.shots.length, 5);
  const shotB2 = picked.shots[3];
  assert.deepEqual(shotB2.frames, []);
  assert.equal(shotB2.same_as_frame, picked.frames.find((frame) => frame.shot === 2).n);
  // A static 5 s shot keeps a single frame: its two candidates are identical.
  assert.equal(picked.shots[0].frames.length, 1);

  const many = pickFrames({ start: 0, end: 600, cuts: Array.from({ length: 299 }, (_, i) => (i + 1) * 2), signatures: [], rate, maxFrames: 24 });
  assert.equal(many.frames.length, 24);
  assert.ok(many.frames[0].time_s < 5 && many.frames.at(-1).time_s > 590);

  const clean = pickFrames({ start: 0, end: 10, cuts: [0.1, 3, 3.1, 9.9], signatures: [], rate, maxFrames: 10 });
  assert.deepEqual(clean.cuts, [3]);
});

test("stillChanges finds a change between two still pictures and ignores constant motion", () => {
  const rate = 2;
  // A slide (value 60) for 3 s, then another slide (value 75) for 3 s.
  const slides = Array.from({ length: 12 }, (_, i) => signature(i < 6 ? 60 : 75));
  assert.deepEqual(stillChanges(slides, rate, 10), [12.75]);
  // A picture that changes every sample (someone talking and moving) has no still change.
  const moving = Array.from({ length: 12 }, (_, i) => signature(40 + i * 10));
  assert.deepEqual(stillChanges(moving, rate), []);
  assert.deepEqual(mergeCuts([5, 10.1], [4.9, 10.75, 20]), [5, 10.1, 20]);
});

test("similar is conservative: a small text change is not a repeat", () => {
  const base = signature(100);
  const noisy = Buffer.from(base.map((value, index) => value + (index % 2)));
  assert.ok(similar(base, noisy));
  const text = Buffer.from(base);
  for (let i = 200; i < 230; i++) text[i] = 160;
  assert.ok(!similar(base, text));
});

test("gridLayout fits common proportions", () => {
  assert.deepEqual(gridLayout(1280, 720), { tileWidth: 480, tileHeight: 270, columns: 3, rows: 3, perGrid: 9 });
  const portrait = gridLayout(720, 1280);
  assert.equal(portrait.tileHeight, 480);
  assert.ok(portrait.columns * portrait.tileWidth <= 1568 && portrait.rows * portrait.tileHeight <= 1568);
  assert.equal(gridLayout(320, 240).perGrid, 6);
});

test("escapeFilterPath escapes the drive colon for ffmpeg filters", () => {
  assert.equal(escapeFilterPath("C:\\Windows\\Fonts\\arial.ttf"), "C\\:/Windows/Fonts/arial.ttf");
});

test("mostReplayed ignores short videos and picks spaced peaks", () => {
  const heatmap = (length, duration, peaks) =>
    Array.from({ length }, (_, i) => ({ start_time: (i * duration) / length, end_time: ((i + 1) * duration) / length, value: peaks[i] ?? 0.2 }));
  assert.deepEqual(mostReplayed(heatmap(100, 19, { 1: 1 }), 19), []);
  const peaks = mostReplayed(heatmap(100, 600, { 0: 1, 30: 0.9, 31: 0.95, 70: 0.8 }), 600);
  assert.equal(peaks.length, 2);
  assert.equal(peaks[0].start_s, 180);
  assert.equal(peaks[1].intensity, 0.8);
});

test("pickCaptionTrack prefers the original language, manual before automatic", () => {
  assert.deepEqual(pickCaptionTrack({ language: "pt", subtitles: { en: [] }, automatic_captions: { "pt-orig": [], en: [] } }), { key: "pt-orig", origin: "auto" });
  assert.deepEqual(pickCaptionTrack({ language: "en", subtitles: { en: [], de: [] }, automatic_captions: { en: [] } }), { key: "en", origin: "manual" });
  assert.deepEqual(pickCaptionTrack({ subtitles: { de: [], en: [] }, automatic_captions: {} }), { key: "en", origin: "manual" });
  assert.deepEqual(pickCaptionTrack({ subtitles: { live_chat: [] }, automatic_captions: { fr: [] } }), { key: "fr", origin: "auto" });
  assert.equal(pickCaptionTrack({ subtitles: {}, automatic_captions: {} }), null);
});

test("geminiKey follows the flyee rule: the variable, then the key saved with `flyee key set`", () => {
  const home = mkdtempSync(join(tmpdir(), "va-keys-"));
  try {
    const path = keyStorePath(home);
    assert.equal(path, join(home, ".flyee", "keys.json"));
    assert.deepEqual(geminiKey({}, path), { key: null, from: null }, "no file yet");
    mkdirSync(join(home, ".flyee"), { recursive: true });
    writeFileSync(path, JSON.stringify({ version: 1, keys: { GEMINI_API_KEY: "  salva-123  ", OUTRA: "x" } }));
    assert.deepEqual(geminiKey({}, path), { key: "salva-123", from: "flyee" });
    assert.deepEqual(geminiKey({ GEMINI_API_KEY: "da-variavel" }, path), { key: "da-variavel", from: "environment" });
    assert.deepEqual(geminiKey({ GEMINI_API_KEY: "" }, path), { key: null, from: null }, "an empty variable means no key");
    assert.equal(readSavedKey("OUTRA", path), "x");
    writeFileSync(path, "{ quebrado");
    assert.equal(readSavedKey("GEMINI_API_KEY", path), null);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("keySetup gives one command, the same on every system", () => {
  const setup = keySetup();
  assert.equal(setup.command, "npx flyee key set GEMINI_API_KEY");
  assert.match(setup.how, /fora do chat/);
  assert.ok(setup.after);
});

test("summarizeMetadata formats the date and keeps the useful fields", () => {
  const meta = summarizeMetadata({ title: "T", channel: "C", upload_date: "20050424", duration: 19, availability: "public", chapters: [{ start_time: 0, end_time: 5, title: "Intro" }] });
  assert.equal(meta.published_at, "2005-04-24");
  assert.deepEqual(meta.chapters, [{ start_s: 0, end_s: 5, title: "Intro" }]);
  assert.deepEqual(meta.most_replayed, []);
});

test("classifyYtdlpError maps YouTube's refusals to stable codes", () => {
  const code = (stderr) => classifyYtdlpError(stderr).code;
  assert.equal(code("ERROR: [youtube] x: Sign in to confirm you’re not a bot."), "youtube_blocked");
  assert.equal(code("ERROR: [youtube] x: Sign in to confirm your age."), "age_restricted");
  assert.equal(code("ERROR: [youtube] x: Private video. Sign in if you've been granted access"), "private_video");
  assert.equal(code("ERROR: [youtube] x: Video unavailable"), "video_unavailable");
  assert.equal(code("ERROR: Unsupported URL: https://example.com"), "unsupported_url");
  assert.equal(code("ERROR: Requested format is not available"), "no_formats");
  assert.equal(code("something else"), "download_failed");
});

test("classifyGeminiError maps API failures to stable codes", () => {
  const body = (message, extra = {}) => JSON.stringify({ error: { message, ...extra } });
  assert.equal(classifyGeminiError(400, body("API key not valid. Please pass a valid API key.")).code, "gemini_invalid_key");
  assert.equal(classifyGeminiError(429, body("Resource exhausted")).code, "gemini_quota");
  assert.equal(classifyGeminiError(404, body("models/x is not found")).code, "gemini_model_not_found");
  assert.equal(classifyGeminiError(503, body("overloaded")).code, "gemini_unavailable");
  assert.equal(classifyGeminiError(400, body("Cannot fetch content from the provided YouTube URL")).code, "gemini_video_inaccessible");
  assert.equal(classifyGeminiError(400, body("The input token count exceeds the maximum")).code, "gemini_too_long");
});

test("videoPart carries window and fps only when asked", () => {
  assert.deepEqual(videoPart({ uri: "https://www.youtube.com/watch?v=x" }), { fileData: { fileUri: "https://www.youtube.com/watch?v=x" } });
  assert.deepEqual(videoPart({ uri: "u", mime: "video/mp4", start: 40, end: 80, fps: 2 }), {
    fileData: { fileUri: "u", mimeType: "video/mp4" },
    videoMetadata: { startOffset: "40.0s", endOffset: "80.0s", fps: 2 },
  });
});

test("parseJsonReply reads plain, fenced and padded JSON", () => {
  assert.deepEqual(parseJsonReply('{"a":1}'), { a: 1 });
  assert.deepEqual(parseJsonReply('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonReply('Aqui está: {"a":1} pronto'), { a: 1 });
  assert.equal(parseJsonReply("sem json"), null);
});

test("buildPrompt carries the focus, the question, the window and the measured cuts", () => {
  const prompt = buildPrompt({
    focusGuide: "# Foco: edição",
    question: "O que aparece aos 10 s?",
    context: { title: "Vídeo", duration_s: 120 },
    window: { start: 30, end: 60 },
    lang: "pt-BR",
    cuts: [31.5, 40],
  });
  assert.match(prompt, /# Foco: edição/);
  assert.match(prompt, /O que aparece aos 10 s\?/);
  assert.match(prompt, /from 00:30 to 01:00/);
  assert.match(prompt, /31\.50, 40\.00/);
  assert.match(prompt, /Brazilian Portuguese/);
});

test("renderDescription writes the shared format and the header round-trips", () => {
  const header = { video: "Me: at the zoo", source: "https://youtu.be/x", id: "yt-x", focus: "general", mode: "gemini", window: "full", lang: "pt-BR" };
  const markdown = renderDescription({
    data: {
      summary: "Um homem fala na frente dos elefantes.",
      timeline: [{ start: "00:00", end: "00:05", visual: "Homem diante do cercado", speech: "Apresenta os elefantes", on_screen_text: "" }],
      visual_only: [{ time: "00:04", description: "Ele se vira para os elefantes." }],
      shots: [{ start: "00:00", end: "00:19", framing: "médio", movement: "câmera na mão", description: "plano | único" }],
      focus_sections: [{ title: "Como reproduzir", content: "- Um plano só." }],
      uncertainties: [],
    },
    header,
    title: "Me at the zoo",
    measurements: ["- Nenhum corte detectado em 00:19: um plano contínuo."],
  });
  assert.deepEqual(readHeader(markdown), header);
  for (const heading of ["## Resumo", "## Linha do tempo", "### 00:00–00:05", "## Só na imagem", "## Planos", "## Como reproduzir", "## Medições", "## Incertezas"]) {
    assert.ok(markdown.includes(heading), heading);
  }
  assert.ok(markdown.includes("plano \\| único"));
  assert.ok(markdown.includes("Nenhuma registrada."));
  const english = renderDescription({ data: { summary: "x" }, header, title: "T", lang: "en" });
  assert.ok(english.includes("## Summary") && english.includes("## Only in the picture"));
  const raw = renderDescription({ data: null, rawText: "texto livre", header, title: "T" });
  assert.ok(raw.includes("texto livre"));
  assert.ok(descriptionHeader({ a: "1", b: null }).includes('a: "1"') && !descriptionHeader({ a: "1", b: null }).includes("b:"));
});

test("measurementLines summarizes cuts, silences and replayed parts", () => {
  const analysis = {
    metadata: { duration_s: 180, has_audio: true, most_replayed: [{ start_s: 60, end_s: 66, intensity: 1 }] },
    preparation: { window: { start_s: 0, end_s: 180 } },
    cuts_s: [10, 70, 75, 130],
    shots: new Array(5).fill({}),
    silences: [{ start_s: 20, end_s: 22.5 }, { start_s: 30, end_s: 30.5 }],
  };
  const lines = measurementLines(analysis);
  assert.ok(lines[0].includes("Cortes detectados: 4 em 03:00; um plano a cada 36,0 s"));
  assert.ok(lines[1].includes("00:00 1 · 01:00 2 · 02:00 1"));
  assert.ok(lines[2].includes("00:20–00:22") && !lines[2].includes("00:30"));
  assert.ok(lines[3].includes("01:00–01:06"));
  assert.ok(measurementLines({ ...analysis, cuts_s: [], shots: [{}] })[0].includes("Nenhum corte"));
  assert.ok(measurementLines(analysis, "en")[0].startsWith("- Cuts detected"));
});
