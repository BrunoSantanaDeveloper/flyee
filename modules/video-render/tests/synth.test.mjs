// The loop-perfect `synth`, the event-shaped `sfx`, `beats` on a synthesized track and
// `mix --music-offset`: in-process checks on the samples, then the commands through render.mjs.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { decodeAudio } from "../scripts/lib/ffmpeg.mjs";
import { run } from "../scripts/lib/util.mjs";
import { STYLE_NAMES, synthesizeMusic } from "../scripts/lib/audio/styles.mjs";
import { dbToGain, loudnessLufs, SFX_TYPE_NAMES, synthesizeSfx, truePeakDb } from "../scripts/lib/audio/synth.mjs";
import { checkTools } from "../scripts/lib/tools.mjs";
import { decodeWav, encodeWav, readWav, writeWav } from "../scripts/lib/audio/wav.mjs";

const APP_DIR = join(import.meta.dirname, "..");
const RENDER = join(APP_DIR, "scripts", "render.mjs");
const SCRATCH = join(tmpdir(), "flyee-video-render-synth-tests");
mkdirSync(SCRATCH, { recursive: true });
const RATE = 48000;

/** Runs render.mjs with --json from the scratch folder and parses the JSON on stdout. */
function cli(args) {
  const result = spawnSync(process.execPath, [RENDER, ...args, "--json"], { cwd: SCRATCH, encoding: "utf8", windowsHide: true });
  let json = null;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    // not JSON: the caller inspects stdout
  }
  return { ...result, json };
}

const rendered = new Map();
function loop(style, bars = 2, seed = 1) {
  const key = `${style}/${bars}/${seed}`;
  if (!rendered.has(key)) rendered.set(key, synthesizeMusic({ bpm: 120, bars, style, seed }));
  return rendered.get(key);
}

function channel(samples, c) {
  const n = samples.length / 2;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = samples[2 * i + c];
  return out;
}

function seamStats(ch) {
  const n = ch.length;
  const window = Math.round(0.05 * RATE);
  let maxStep = 0;
  for (let i = n - window; i < n; i++) maxStep = Math.max(maxStep, Math.abs(ch[i] - ch[i - 1]));
  for (let i = 1; i < window; i++) maxStep = Math.max(maxStep, Math.abs(ch[i] - ch[i - 1]));
  return { seam: Math.abs(ch[0] - ch[n - 1]), maxStep };
}

function rms(ch, from, to) {
  const a = Math.round(from * RATE);
  const b = Math.min(ch.length, Math.round(to * RATE));
  let sum = 0;
  for (let i = a; i < b; i++) sum += ch[i] * ch[i];
  return Math.sqrt(sum / Math.max(1, b - a));
}

test("wav: 16-bit stereo header, exact sample count and a round trip", () => {
  const music = loop("clean");
  assert.equal(music.frames, 192000, "2 compassos de 4 tempos a 120 BPM = 4 s = 192 000 quadros");
  assert.equal(music.samples.length, 192000 * 2);
  const bytes = encodeWav(music.samples, { rate: RATE, channels: 2 });
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
  assert.equal(bytes.readUInt16LE(22), 2, "canais");
  assert.equal(bytes.readUInt32LE(24), RATE, "taxa");
  assert.equal(bytes.readUInt16LE(34), 16, "bits");
  assert.equal(bytes.readUInt32LE(40), 192000 * 4, "bytes de dados");
  assert.equal(bytes.length, 44 + 192000 * 4);
  const decoded = decodeWav(bytes);
  assert.equal(decoded.frames, 192000);
  assert.ok(Math.abs(decoded.samples[1000] - music.samples[1000]) < 1 / 32000);
  const file = join(SCRATCH, "roundtrip.wav");
  writeWav(file, music.samples, { rate: RATE, channels: 2 });
  assert.equal(readWav(file).frames, 192000);
});

test("synth is deterministic: same seed, same bytes; another seed, other bytes", () => {
  const a = synthesizeMusic({ bpm: 120, bars: 1, style: "upbeat", seed: 3 });
  const b = synthesizeMusic({ bpm: 120, bars: 1, style: "upbeat", seed: 3 });
  const c = synthesizeMusic({ bpm: 120, bars: 1, style: "upbeat", seed: 4 });
  assert.equal(Buffer.compare(Buffer.from(a.samples.buffer), Buffer.from(b.samples.buffer)), 0);
  assert.notEqual(Buffer.compare(Buffer.from(a.samples.buffer), Buffer.from(c.samples.buffer)), 0);
});

test("every style: 2 bars in a few seconds, peak under -1 dBFS, about -16 LUFS, seamless loop", () => {
  for (const style of STYLE_NAMES) {
    const started = Date.now();
    const music = loop(style);
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 8000, `${style}: ${elapsed} ms`);
    assert.equal(music.frames, 192000, style);
    const left = channel(music.samples, 0);
    const right = channel(music.samples, 1);
    const cap = dbToGain(-1);
    for (const ch of [left, right]) for (let i = 0; i < ch.length; i++) assert.ok(Math.abs(ch[i]) <= cap, `${style}: amostra acima de -1 dBFS`);
    assert.ok(truePeakDb([left, right]) <= -1 + 0.01, `${style}: pico real`);
    const lufs = loudnessLufs([left, right]);
    assert.ok(Math.abs(lufs + 16) < 1, `${style}: ${lufs} LUFS`);
    for (const [name, ch] of [["L", left], ["R", right]]) {
      const { seam, maxStep } = seamStats(ch);
      assert.ok(seam < 0.02, `${style} ${name}: emenda ${seam}`);
      assert.ok(seam <= maxStep + 1e-6, `${style} ${name}: degrau na emenda ${seam} maior que o maior degrau vizinho ${maxStep}`);
    }
    assert.deepEqual(music.beats.slice(0, 3), [0, 0.5, 1]);
    assert.deepEqual(music.downbeats, [0, 2]);
  }
});

test("intro bars play only the bed: quieter start, same length", () => {
  const full = synthesizeMusic({ bpm: 120, bars: 2, style: "clean", seed: 1 });
  const intro = synthesizeMusic({ bpm: 120, bars: 2, style: "clean", seed: 1, introBars: 1 });
  assert.equal(intro.frames, full.frames);
  const fullFirst = rms(channel(full.samples, 0), 0, 2);
  const fullSecond = rms(channel(full.samples, 0), 2, 4);
  const introFirst = rms(channel(intro.samples, 0), 0, 2);
  const introSecond = rms(channel(intro.samples, 0), 2, 4);
  assert.ok(introFirst / introSecond < fullFirst / fullSecond, "o primeiro compasso da versão com intro é mais vazio");
});

test("sfx puts energy at each event and nothing before the first", () => {
  const sfx = synthesizeSfx([{ t: 0.5, type: "whoosh" }, { t: 2, type: "impact" }, { t: 3, type: "tick" }], { duration: 4 });
  assert.equal(sfx.frames, 4 * RATE);
  const left = channel(sfx.samples, 0);
  assert.ok(rms(left, 0, 0.49) < 1e-5, "silêncio antes do primeiro evento");
  assert.ok(rms(left, 0.5, 0.85) > 0.01, "whoosh em 0,5 s");
  assert.ok(rms(left, 1.3, 1.95) < 0.003, "quase nada entre os eventos");
  assert.ok(rms(left, 2, 2.3) > 0.05, "impacto em 2 s");
  assert.ok(rms(left, 3, 3.01) > 0.002, "tique em 3 s");
  let peakLeft = 0;
  for (const x of left) peakLeft = Math.max(peakLeft, Math.abs(x));
  assert.ok(Math.abs(left[0]) < 1e-6 && peakLeft <= dbToGain(-1) + 1e-6);
  assert.throws(() => synthesizeSfx([{ t: 0, type: "laser" }]), /unknown sfx type/);
  assert.ok(SFX_TYPE_NAMES.includes("whoosh") && SFX_TYPE_NAMES.includes("riser") && SFX_TYPE_NAMES.includes("pluck"));
});

test("render.mjs loads the group: synth writes the WAV and the beats.json, help lists it, bytes repeat", () => {
  const out = join(SCRATCH, "loader.wav");
  const first = cli(["synth", "--out", out, "--bpm", "120", "--bars", "2", "--style", "noir"]);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const result = first.json;
  assert.equal(result.ok, true);
  assert.equal(result.command, "synth");
  assert.equal(result.interface_version, 1);
  for (const field of ["file", "beats_file", "bpm", "bars", "beats_per_bar", "beat_s", "bar_s", "duration", "style", "seed", "intro_bars", "sample_rate", "channels", "lufs", "true_peak_dbtp", "beats", "downbeats", "warnings"]) {
    assert.ok(field in result, `campo ${field}`);
  }
  assert.equal(result.duration, 4);
  assert.equal(result.beat_s, 0.5);
  assert.equal(result.bar_s, 2);
  assert.equal(result.sample_rate, 48000);
  assert.ok(existsSync(out));
  assert.equal(readWav(out).frames, 192000);
  const grid = JSON.parse(readFileSync(join(SCRATCH, "loader.beats.json"), "utf8"));
  assert.equal(grid.bpm, 120);
  assert.equal(grid.offset, 0);
  assert.equal(grid.beats_per_bar, 4);
  assert.equal(grid.bars, 2);
  assert.equal(grid.duration, 4);
  assert.deepEqual(grid.beats, [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
  assert.deepEqual(grid.downbeats, [0, 2]);
  const again = cli(["synth", "--out", join(SCRATCH, "loader-2.wav"), "--bpm", "120", "--bars", "2", "--style", "noir"]);
  assert.equal(again.status, 0);
  assert.equal(Buffer.compare(readFileSync(out), readFileSync(join(SCRATCH, "loader-2.wav"))), 0, "os mesmos bytes em outro processo");
  const help = spawnSync(process.execPath, [RENDER, "help"], { encoding: "utf8", windowsHide: true }).stdout;
  for (const name of ["synth", "sfx", "beats", "mix", "loudness"]) assert.ok(new RegExp(`^  ${name} `, "m").test(help), `help lista ${name}`);
  const bad = cli(["synth", "--out", join(SCRATCH, "bad.wav"), "--bpm", "120", "--bars", "2", "--style", "disco"]);
  assert.equal(bad.status, 2);
  assert.equal(bad.json.error.code, "usage");
});

test("sfx through render.mjs: an events file, an inline list, dropped late events, unknown types", () => {
  const events = join(SCRATCH, "events.json");
  writeFileSync(events, JSON.stringify({ duration: 3, events: [{ t: 0.5, type: "whoosh", gain_db: -6, pan: -0.3, direction: "out" }, { t: 1, type: "pop" }, { t: 5, type: "ding" }] }));
  const out = join(SCRATCH, "events.wav");
  const result = cli(["sfx", "--out", out, "--events", events]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.json.events, 2);
  assert.deepEqual(result.json.types, ["whoosh", "pop"]);
  assert.equal(result.json.duration, 3);
  assert.equal(result.json.warnings.length, 1);
  assert.equal(readWav(out).frames, 3 * RATE);
  const inline = cli(["sfx", "--out", join(SCRATCH, "inline.wav"), "--event", "whoosh@0.5,impact@2", "--duration", "6"]);
  assert.equal(inline.status, 0, inline.stdout + inline.stderr);
  assert.equal(inline.json.events, 2);
  assert.equal(inline.json.duration, 6);
  const unknown = cli(["sfx", "--out", join(SCRATCH, "unknown.wav"), "--event", "laser@1"]);
  assert.equal(unknown.status, 2);
  assert.equal(unknown.json.error.code, "usage");
  assert.ok(unknown.json.error.fix.includes("whoosh"), "a mensagem lista os tipos");
});

test("beats on a synthesized 120 BPM clean track finds the tempo and the phase (needs ffmpeg)", { timeout: 120000 }, async (t) => {
  const tools = await checkTools();
  if (!tools.ffmpeg || !tools.ffprobe) {
    t.skip("sem ffmpeg nesta máquina");
    return;
  }
  const track = join(SCRATCH, "eight.wav");
  const synth = cli(["synth", "--out", track, "--bpm", "120", "--bars", "8", "--style", "clean"]);
  assert.equal(synth.status, 0, synth.stdout + synth.stderr);
  assert.ok(Math.abs(synth.json.lufs + 16) < 1.5, `volume medido pelo ffmpeg: ${synth.json.lufs}`);
  assert.ok(synth.json.true_peak_dbtp <= -1 + 0.2, `pico real medido: ${synth.json.true_peak_dbtp}`);
  const beats = cli(["beats", track, "--out", join(SCRATCH, "eight.detected.json")]);
  assert.equal(beats.status, 0, beats.stdout + beats.stderr);
  const grid = beats.json;
  assert.ok(Math.abs(grid.bpm - 120) <= 1, `bpm ${grid.bpm}`);
  const phase = grid.offset % 0.5;
  assert.ok(Math.min(phase, 0.5 - phase) < 0.03, `offset ${grid.offset}`);
  assert.equal(grid.beats_per_bar, 4);
  assert.ok(grid.bars >= 7);
  assert.ok(Array.isArray(grid.beats) && grid.beats.length >= 30);
  assert.ok(Array.isArray(grid.downbeats) && grid.downbeats.length >= 7);
  assert.ok(existsSync(join(SCRATCH, "eight.detected.json")));
});

test("mix --music-offset under a tiny video: the video's duration, -14 LUFS, a warning when the music ends early (needs ffmpeg)", { timeout: 180000 }, async (t) => {
  const tools = await checkTools();
  if (!tools.ffmpeg || !tools.ffprobe) {
    t.skip("sem ffmpeg nesta máquina");
    return;
  }
  const video = join(SCRATCH, "color.mp4");
  const made = await run(tools.ffmpeg.path, ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=black:s=64x64:r=10:d=2", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "ultrafast", video]);
  assert.equal(made.code, 0, made.stderr);
  const track = join(SCRATCH, "mix-music.wav");
  assert.equal(cli(["synth", "--out", track, "--bpm", "120", "--bars", "4", "--style", "upbeat"]).status, 0);
  const outA = join(SCRATCH, "mixed-0.mp4");
  const outB = join(SCRATCH, "mixed-4.mp4");
  const a = cli(["mix", "--video", video, "--out", outA, "--music", track]);
  assert.equal(a.status, 0, a.stdout + a.stderr);
  const b = cli(["mix", "--video", video, "--out", outB, "--music", track, "--music-offset", "4", "--fade-out", "0"]);
  assert.equal(b.status, 0, b.stdout + b.stderr);
  for (const result of [a.json, b.json]) {
    assert.ok(Math.abs(result.duration - 2) < 0.15, `duração ${result.duration}`);
    assert.ok(Math.abs(result.loudness.integrated_lufs + 14) <= 1.5, `volume ${result.loudness.integrated_lufs}`);
    assert.ok("sources" in result && "music_offset" in result.sources);
  }
  assert.equal(a.json.sources.music_offset, 0);
  assert.equal(b.json.sources.music_offset, 4);
  assert.deepEqual(b.json.warnings, []);
  const decodedA = await decodeAudio(tools.ffmpeg.path, outA, { rate: 8000 });
  const decodedB = await decodeAudio(tools.ffmpeg.path, outB, { rate: 8000 });
  assert.notEqual(Buffer.compare(Buffer.from(decodedA.samples.buffer, decodedA.samples.byteOffset, decodedA.samples.byteLength), Buffer.from(decodedB.samples.buffer, decodedB.samples.byteOffset, decodedB.samples.byteLength)), 0, "outro trecho da música");
  const late = cli(["mix", "--video", video, "--out", join(SCRATCH, "mixed-late.mp4"), "--music", track, "--music-offset", "7.5"]);
  assert.equal(late.status, 0, late.stdout + late.stderr);
  assert.ok(late.json.warnings.some((warning) => /acaba antes do fim/.test(warning)), "avisa que a música acaba antes do fim");
  const negative = cli(["mix", "--video", video, "--out", join(SCRATCH, "mixed-neg.mp4"), "--music", track, "--music-offset", "-1"]);
  assert.equal(negative.status, 2);
});
