// Audio group: WAV I/O, the composer, the sfx, the beat grid and the commands.
// Pure tests run everywhere; the ones that need ffmpeg skip when it is missing.
// Generated files go to FLYEE_TEST_SCRATCH/audio (or the system temp folder), never into the repository.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { analyzeBeats, fft } from "../scripts/lib/audio/beats.mjs";
import { parseKey, planSections, STYLE_NAMES, synthesizeMusic } from "../scripts/lib/audio/music.mjs";
import { CUE_TYPES, normalizeCues, parseCueList, synthesizeSfx } from "../scripts/lib/audio/sfx.mjs";
import { adsr, decodeWav, echo, encodeWav, lowPass, peakDb, readWav, rms, softClip, stereoWidth, toMono, writeWav } from "../scripts/lib/audio/wav.mjs";
import { findExecutable } from "../scripts/lib/tools.mjs";
import { AppError } from "../scripts/lib/util.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "..", "scripts", "render.mjs");
const SCRATCH = join(process.env.FLYEE_TEST_SCRATCH ?? join(tmpdir(), "flyee-video-render-tests"), "audio");
mkdirSync(SCRATCH, { recursive: true });
const FFMPEG = findExecutable("ffmpeg");

const RATE = 48000;
const segmentRms = (stereo, from, to) => rms(stereo.subarray(Math.round(from * RATE) * 2, Math.round(to * RATE) * 2));
const sameBytes = (a, b) => a.length === b.length && Buffer.compare(Buffer.from(a.buffer, a.byteOffset, a.byteLength), Buffer.from(b.buffer, b.byteOffset, b.byteLength)) === 0;
const finite = (samples) => samples.every((x) => Number.isFinite(x));

/** Runs the app's CLI with --json and parses the result. */
function cli(...args) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args, "--json"], { encoding: "utf8", cwd: SCRATCH, windowsHide: true });
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Saída não é JSON (código ${result.status}): ${result.stdout}\n${result.stderr}`);
  }
  return parsed;
}

/** A click track: short 1 kHz blips every beat, louder on beat 1. */
function clickTrack({ bpm = 120, seconds = 8, rate = 22050, start = 0 } = {}) {
  const samples = new Float32Array(rate * seconds);
  const period = 60 / bpm;
  for (let b = 0; start + b * period < seconds - 0.1; b++) {
    const at = Math.round((start + b * period) * rate);
    for (let i = 0; i < 220 && at + i < samples.length; i++) samples[at + i] += Math.sin((2 * Math.PI * 1000 * i) / rate) * Math.exp(-i / 40) * (b % 4 === 0 ? 1 : 0.6);
  }
  return { samples, rate };
}

/** Stereo 48 kHz → mono 22.05 kHz by linear interpolation, as the beats command does. */
function monoForAnalysis(stereo) {
  const mono = toMono(stereo, 2);
  const length = Math.floor((mono.length * 22050) / RATE);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const x = (i * RATE) / 22050;
    const j = Math.floor(x);
    out[i] = mono[j] * (1 - (x - j)) + (mono[j + 1] ?? mono[j]) * (x - j);
  }
  return { samples: out, rate: 22050 };
}

// ---------------------------------------------------------------------------
// wav.mjs
// ---------------------------------------------------------------------------

test("WAV round-trip keeps rate, channels and samples within one quantization step", () => {
  const frames = 4800;
  const stereo = new Float32Array(frames * 2);
  for (let i = 0; i < frames; i++) {
    stereo[i * 2] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / RATE);
    stereo[i * 2 + 1] = 0.25 * Math.sin((2 * Math.PI * 220 * i) / RATE);
  }
  const decoded = decodeWav(encodeWav(stereo, { rate: RATE, channels: 2 }));
  assert.equal(decoded.rate, RATE);
  assert.equal(decoded.channels, 2);
  assert.equal(decoded.frames, frames);
  let worst = 0;
  for (let i = 0; i < stereo.length; i++) worst = Math.max(worst, Math.abs(decoded.samples[i] - stereo[i]));
  assert.ok(worst <= 1.01 / 32768, `erro máximo ${worst}`);
  const mono = decodeWav(encodeWav(new Float32Array([0, 0.5, -0.5, 1, -1]), { rate: 22050, channels: 1 }));
  assert.equal(mono.channels, 1);
  assert.equal(mono.frames, 5);
  assert.ok(Math.abs(mono.samples[1] - 0.5) < 1e-3);
  const file = join(SCRATCH, "roundtrip.wav");
  writeWav(file, stereo, { rate: RATE, channels: 2 });
  assert.equal(readWav(file).frames, frames);
  assert.throws(() => decodeWav(Buffer.from("not a wav file at all")), (error) => error instanceof AppError && error.code === "unreadable_media");
});

test("soft limiter, envelopes, filters, echo and width behave", () => {
  assert.equal(softClip(0.5), 0.5);
  assert.ok(softClip(5) <= 1 && softClip(5) > 0.95);
  assert.ok(softClip(-5) < -0.95 && softClip(-5) >= -1);
  assert.ok(softClip(0.9) < 0.9 && softClip(0.9) > 0.85, "acima do joelho a curva comprime");
  const envelope = adsr(RATE, { attack: 0.01, decay: 0.05, sustain: 0.5, release: 0.1 }, 0.2);
  assert.equal(envelope.length, Math.round(0.3 * RATE));
  assert.equal(envelope[envelope.length - 1], 0);
  assert.ok(Math.abs(envelope[Math.round(0.19 * RATE)] - 0.5) < 0.05);
  const high = new Float32Array(RATE / 10).map((_, i) => Math.sin((2 * Math.PI * 8000 * i) / RATE));
  assert.ok(rms(lowPass(high, RATE, 200)) < rms(high) * 0.1);
  const blip = new Float32Array(RATE / 10);
  blip[0] = 1;
  const echoed = echo(blip, RATE, { time: 0.05, feedback: 0.5, mix: 0.5 });
  assert.ok(echoed.length > blip.length);
  assert.ok(Math.abs(echoed[Math.round(0.05 * RATE)]) > 0.1, "a repetição aparece no tempo do delay");
  const wide = stereoWidth(new Float32Array([1, 0.5]), new Float32Array([0, 0.5]), 0);
  assert.deepEqual([...wide.left], [...wide.right]);
});

// ---------------------------------------------------------------------------
// music.mjs
// ---------------------------------------------------------------------------

test("planSections: whole bars, a tail before the end, the drop around the middle on long pieces", () => {
  const short = planSections({ duration: 8, bpm: 120 });
  assert.deepEqual(short.sections.map((s) => s.name), ["build", "tail"]);
  assert.equal(short.hitTime, 6);
  assert.equal(short.drop, 6);
  const long = planSections({ duration: 60, bpm: 120 });
  assert.deepEqual(long.sections.map((s) => s.name), ["intro", "build", "drop", "outro", "tail"]);
  assert.ok(long.drop / 60 >= 0.5 && long.drop / 60 <= 0.65, `virada em ${long.drop}`);
  assert.equal(long.drop % 2, 0, "a virada cai num início de compasso");
  const looped = planSections({ duration: 8, bpm: 120, loop: true });
  assert.equal(looped.hitTime, null);
  assert.ok(!looped.sections.some((s) => s.name === "tail"));
  assert.equal(looped.sections[looped.sections.length - 1].end, 8);
  assert.deepEqual(planSections({ duration: 20, bpm: 120, arc: "flat" }).sections.map((s) => s.name), ["bed", "tail"]);
});

test("parseKey reads the usual spellings", () => {
  assert.equal(parseKey("Am").name, "Am");
  assert.equal(parseKey("F#m").name, "F#m");
  assert.equal(parseKey("Bb").name, "Bb");
  assert.equal(parseKey("c").mode, "major");
  assert.equal(parseKey("auto"), null);
  assert.throws(() => parseKey("H"), (error) => error.code === "usage");
});

test("synthesizeMusic: exact length, grid on the tempo, sections cover the piece, level and tail are right", () => {
  const duration = 12;
  const music = synthesizeMusic({ duration, bpm: 120, style: "clean", seed: 1 });
  assert.equal(music.samples.length, 2 * Math.round(duration * RATE));
  assert.equal(music.rate, RATE);
  assert.ok(finite(music.samples), "sem NaN");
  const { beats } = music;
  assert.equal(beats.format_version, 1);
  assert.equal(beats.source, "synthesized");
  assert.equal(beats.offset, 0);
  assert.equal(beats.beats[0], 0);
  for (let i = 1; i < beats.beats.length; i++) assert.ok(Math.abs(beats.beats[i] - beats.beats[i - 1] - 0.5) < 1e-6);
  assert.deepEqual(beats.downbeats, beats.beats.filter((_, i) => i % 4 === 0));
  assert.ok(beats.downbeats.includes(beats.drop), "a virada cai num início de compasso");
  assert.ok(beats.hits.includes(beats.drop));
  const sections = music.sections;
  assert.equal(sections[0].start, 0);
  assert.equal(sections[sections.length - 1].end, duration);
  for (let i = 1; i < sections.length; i++) assert.equal(sections[i].start, sections[i - 1].end);
  assert.equal(sections[sections.length - 1].name, "tail");
  const peak = peakDb(music.samples);
  assert.ok(peak < 0 && peak > -3.5, `pico ${peak} dBFS`);
  assert.ok(rms(music.samples) > 0.05, "não é silêncio");
  // the hit on the last downbeat is the last event: the end is quiet and the final sample is zero
  const drop = sections.find((s) => s.name === "drop");
  assert.ok(segmentRms(music.samples, duration - 0.15, duration) < 0.15 * segmentRms(music.samples, drop.start, drop.end));
  assert.ok(music.samples[music.samples.length - 1] === 0 && music.samples[music.samples.length - 2] === 0, "o último quadro é zero");
});

test("synthesizeMusic is deterministic per seed and different across seeds, styles and keys", () => {
  const a = synthesizeMusic({ duration: 6, bpm: 120, style: "energetic", seed: 7 });
  const b = synthesizeMusic({ duration: 6, bpm: 120, style: "energetic", seed: 7 });
  const c = synthesizeMusic({ duration: 6, bpm: 120, style: "energetic", seed: 8 });
  assert.ok(sameBytes(a.samples, b.samples));
  assert.deepEqual(a.beats, b.beats);
  assert.ok(!sameBytes(a.samples, c.samples));
  const keyed = synthesizeMusic({ duration: 4, bpm: 120, style: "clean", seed: 1, key: "Am" });
  assert.equal(keyed.key, "Am");
  assert.throws(() => synthesizeMusic({ duration: 4, style: "jazz" }), (error) => error.code === "usage");
  assert.throws(() => synthesizeMusic({ duration: 0.5 }), (error) => error.code === "usage");
});

test("every style renders clean audio; flat and loop forms end as promised", () => {
  for (const style of STYLE_NAMES) {
    const music = synthesizeMusic({ duration: 6, bpm: 110, style, seed: 3 });
    assert.ok(finite(music.samples), `${style}: sem NaN`);
    const peak = peakDb(music.samples);
    assert.ok(peak < 0 && peak > -4, `${style}: pico ${peak}`);
    assert.ok(rms(music.samples) > 0.03, `${style}: não é silêncio`);
  }
  const flat = synthesizeMusic({ duration: 10, bpm: 120, style: "minimal", seed: 2, arc: "flat" });
  assert.deepEqual(flat.sections.map((s) => s.name), ["bed", "tail"]);
  assert.equal(flat.drop, null);
  const loop = synthesizeMusic({ duration: 8, bpm: 120, style: "clean", seed: 2, loop: true });
  assert.equal(loop.samples.length, 2 * 8 * RATE);
  assert.ok(!loop.sections.some((s) => s.name === "tail"));
  assert.equal(loop.beats.beats.length, 16, "the loop grid stops before the end");
  assert.ok(segmentRms(loop.samples, 7.8, 8) > 0.02, "a loop keeps playing to the end");
});

// ---------------------------------------------------------------------------
// sfx.mjs
// ---------------------------------------------------------------------------

test("synthesizeSfx places sound at the cues and nothing before the first", () => {
  const sfx = synthesizeSfx([{ t: 0.5, type: "click" }, { t: 1.2, type: "whoosh", pan: 1 }, { t: 2, type: "typing", text: "hello world" }], { duration: 3 });
  assert.equal(sfx.samples.length, 2 * 3 * RATE);
  assert.equal(segmentRms(sfx.samples, 0, 0.49), 0);
  assert.ok(segmentRms(sfx.samples, 0.5, 0.55) > 0.01, "o clique soa");
  assert.ok(segmentRms(sfx.samples, 1.2, 1.5) > 0.01, "o whoosh soa");
  assert.ok(segmentRms(sfx.samples, 2, 2.8) > 0.003, "a digitação soa");
  assert.equal(sfx.cues[2].count, 11);
  assert.ok(peakDb(sfx.samples) < 0);
  const open = synthesizeSfx([{ t: 1, type: "ding" }]);
  assert.ok(open.duration >= 2.4 && open.duration < 3, "sem duração, o arquivo termina depois da última cue");
});

test("cue parsing and validation", () => {
  assert.deepEqual(parseCueList("0.5:click, 1.2:whoosh"), [{ t: 0.5, type: "click" }, { t: 1.2, type: "whoosh" }]);
  assert.equal(CUE_TYPES.length, 12);
  assert.ok(CUE_TYPES.every((cue) => cue.type && cue.description.length > 10));
  assert.throws(() => normalizeCues([{ t: 0, type: "laser" }]), (error) => error.code === "cues_invalid");
  assert.throws(() => normalizeCues([{ type: "click" }]), (error) => error.code === "cues_invalid");
  assert.throws(() => normalizeCues([]), (error) => error.code === "cues_invalid");
  assert.throws(() => parseCueList("click"), (error) => error.code === "cues_invalid");
  assert.equal(normalizeCues({ cues: [{ t: "0:02", type: "pop", gain: -6 }] })[0].t, 2);
});

// ---------------------------------------------------------------------------
// beats.mjs
// ---------------------------------------------------------------------------

test("fft finds a pure tone in its bin", () => {
  const n = 64;
  const re = new Float64Array(n).map((_, i) => Math.cos((2 * Math.PI * 8 * i) / n));
  const im = new Float64Array(n);
  fft(re, im);
  const magnitude = Array.from(re, (r, i) => Math.hypot(r, im[i]));
  assert.equal(magnitude.indexOf(Math.max(...magnitude.slice(0, n / 2))), 8);
  assert.throws(() => fft(new Float64Array(6), new Float64Array(6)), (error) => error.code === "usage");
});

test("analyzeBeats reads a 120 BPM click track within 1 BPM, with the first beat and downbeat at the start", () => {
  const result = analyzeBeats(clickTrack({ bpm: 120, seconds: 8 }));
  assert.ok(Math.abs(result.bpm - 120) <= 1, `bpm ${result.bpm}`);
  assert.ok(result.offset <= 0.03, `offset ${result.offset}`);
  assert.ok(result.downbeats[0] <= 0.03, `primeiro compasso em ${result.downbeats[0]}`);
  assert.ok(result.confidence > 0.5);
  assert.equal(result.method, "onset-autocorrelation");
  assert.ok(result.hits.length >= 10 && result.hits.length <= 16, `${result.hits.length} acentos`);
  const late = analyzeBeats(clickTrack({ bpm: 100, seconds: 10, start: 0.2 }));
  assert.ok(Math.abs(late.bpm - 100) <= 1, `bpm ${late.bpm}`);
  assert.ok(Math.abs(late.offset - 0.2) <= 0.03, `offset ${late.offset}`);
  const forced = analyzeBeats(clickTrack({ bpm: 120, seconds: 8 }), { bpm: 120 });
  assert.ok(Math.abs(forced.bpm - 120) <= 1);
  assert.throws(() => analyzeBeats({ samples: new Float32Array(22050 * 4), rate: 22050 }), (error) => error.code === "silent_audio");
  assert.throws(() => analyzeBeats({ samples: new Float32Array(100), rate: 22050 }), (error) => error.code === "audio_too_short");
});

test("analyzeBeats recovers the tempo of synthesized music within 2 BPM", () => {
  for (const [style, bpm] of [["clean", 120], ["energetic", 128], ["playful", 96], ["warm", 120], ["minimal", 120], ["cinematic", 120]]) {
    const music = synthesizeMusic({ duration: 16, bpm, style, seed: 5 });
    const result = analyzeBeats(monoForAnalysis(music.samples));
    assert.ok(Math.abs(result.bpm - bpm) <= 2, `${style}: ${result.bpm} em vez de ${bpm}`);
    assert.ok(result.offset < 0.06 || Math.abs(result.offset - 60 / bpm) < 0.06, `${style}: primeira batida em ${result.offset}`);
  }
});

// ---------------------------------------------------------------------------
// commands (through the CLI)
// ---------------------------------------------------------------------------

test("music command writes the WAV and the beats.json", () => {
  const out = join(SCRATCH, "cli-music.wav");
  const result = cli("music", "--out", out, "--duration", "6", "--style", "playful", "--seed", "4", "--bpm", "100");
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.command, "music");
  assert.ok(existsSync(out));
  const beatsFile = join(SCRATCH, "cli-music.beats.json");
  assert.ok(existsSync(beatsFile));
  const grid = JSON.parse(readFileSync(beatsFile, "utf8"));
  assert.equal(grid.bpm, 100);
  assert.equal(grid.beats[1], 0.6);
  assert.equal(result.style, "playful");
  assert.ok(result.peak_dbfs < 0);
  const bad = cli("music", "--out", join(SCRATCH, "x.mp3"), "--duration", "6");
  assert.equal(bad.ok, false);
  assert.equal(bad.error.code, "usage");
  const noDuration = cli("music", "--out", out);
  assert.equal(noDuration.error.code, "usage");
});

test("sfx command accepts inline cues and a JSON file, and reports bad cues", () => {
  const out = join(SCRATCH, "cli-sfx.wav");
  const result = cli("sfx", "--cues", "0.2:click,0.8:success", "--out", out, "--duration", "2");
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.cues.length, 2);
  assert.equal(result.duration, 2);
  assert.ok(result.types.includes("whoosh"));
  assert.ok(existsSync(out));
  const bad = cli("sfx", "--cues", "0.2:laser", "--out", out);
  assert.equal(bad.ok, false);
  assert.equal(bad.error.code, "cues_invalid");
});

test("beats command reads a WAV without ffmpeg and writes the grid beside it", () => {
  const wav = join(SCRATCH, "cli-beats-source.wav");
  const music = synthesizeMusic({ duration: 10, bpm: 120, style: "energetic", seed: 2 });
  writeWav(wav, music.samples, { rate: RATE, channels: 2 });
  const result = cli("beats", wav);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.ok(Math.abs(result.bpm - 120) <= 2, `bpm ${result.bpm}`);
  assert.ok(existsSync(join(SCRATCH, "cli-beats-source.beats.json")));
  assert.equal(result.source, "analysis");
  assert.ok(result.downbeats.length >= 4);
});

test("mix command (ffmpeg) lands near -14 LUFS and loudness measures it", { skip: FFMPEG ? false : "ffmpeg não está nesta máquina" }, () => {
  const music = join(SCRATCH, "mix-music.wav");
  const sfx = join(SCRATCH, "mix-sfx.wav");
  writeWav(music, synthesizeMusic({ duration: 8, bpm: 120, style: "clean", seed: 9 }).samples, { rate: RATE, channels: 2 });
  writeWav(sfx, synthesizeSfx([{ t: 1, type: "click" }, { t: 3, type: "whoosh" }, { t: 5, type: "notify" }], { duration: 8 }).samples, { rate: RATE, channels: 2 });
  const out = join(SCRATCH, "mix-out.wav");
  const result = cli("mix", "--out", out, "--music", music, "--music-gain", "-6", "--sfx", sfx, "--sfx-gain", "-12", "--fade-out", "0.5");
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.ok(existsSync(out));
  assert.ok(Math.abs(result.loudness.integrated_lufs - -14) <= 1.5, `${result.loudness.integrated_lufs} LUFS`);
  assert.ok(result.loudness.true_peak_dbtp <= -0.8, `${result.loudness.true_peak_dbtp} dBTP`);
  assert.equal(result.duration, 8);
  const measured = cli("loudness", out);
  assert.equal(measured.ok, true);
  assert.ok(Math.abs(measured.integrated_lufs - result.loudness.integrated_lufs) < 0.2);
  const nothing = cli("mix", "--out", out);
  assert.equal(nothing.error.code, "usage");
});

test("beats command on a non-WAV file goes through ffmpeg", { skip: FFMPEG ? false : "ffmpeg não está nesta máquina" }, () => {
  const wav = join(SCRATCH, "beats-source.wav");
  writeWav(wav, synthesizeMusic({ duration: 8, bpm: 120, style: "energetic", seed: 3 }).samples, { rate: RATE, channels: 2 });
  const m4a = join(SCRATCH, "beats-source.m4a");
  const converted = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", wav, "-c:a", "aac", "-b:a", "160k", m4a], { windowsHide: true });
  assert.equal(converted.status, 0);
  const result = cli("beats", m4a, "--out", join(SCRATCH, "beats-m4a.json"));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.ok(Math.abs(result.bpm - 120) <= 2, `bpm ${result.bpm}`);
  assert.ok(existsSync(join(SCRATCH, "beats-m4a.json")));
});
