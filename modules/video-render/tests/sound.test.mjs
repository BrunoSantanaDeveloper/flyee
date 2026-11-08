// What the sound guide promises, measured: a whoosh that peaks on its cut, music that yields
// under an impact (and a mix that comes out the same every time), and a music peak placed on
// the film's biggest moment.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { planSections, STYLE_NAMES, synthesizeMusic } from "../scripts/lib/audio/music.mjs";
import { synthesizeSfx as cueSfx } from "../scripts/lib/audio/sfx.mjs";
import { synthesizeSfx as eventSfx } from "../scripts/lib/audio/synth.mjs";
import { readWav, rms, toMono, writeWav } from "../scripts/lib/audio/wav.mjs";
import { findExecutable } from "../scripts/lib/tools.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "..", "scripts", "render.mjs");
const SCRATCH = join(process.env.FLYEE_TEST_SCRATCH ?? join(tmpdir(), "flyee-video-render-tests"), "sound");
mkdirSync(SCRATCH, { recursive: true });
const FFMPEG = findExecutable("ffmpeg");
const NEEDS_FFMPEG = { skip: FFMPEG ? false : "ffmpeg não está nesta máquina" };

const RATE = 48000;
const FRAME = 1 / 30;
const mono = (stereo) => toMono(stereo, 2);
const part = (samples, from, to) => samples.subarray(Math.round(from * RATE), Math.round(to * RATE));

/** The centre of the loudest 10 ms window. */
function peakTime(samples) {
  const size = 480;
  let best = -1;
  let at = 0;
  for (let i = 0; i + size <= samples.length; i += size) {
    const level = rms(samples.subarray(i, i + size));
    if (level > best) {
      best = level;
      at = (i + size / 2) / RATE;
    }
  }
  return at;
}

/** The first and last instants with any real sound. */
function soundSpan(samples) {
  let first = null;
  let last = null;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) > 1e-4) {
      first ??= i / RATE;
      last = i / RATE;
    }
  }
  return { first, last };
}

/** The level of one frequency in a stretch (Goertzel), in dB: it reads the music's tone apart from the effects. */
function toneDb(samples, freq, from, to) {
  const stretch = part(samples, from, to);
  const w = (2 * Math.PI * freq) / RATE;
  const c = 2 * Math.cos(w);
  let a = 0;
  let b = 0;
  for (const x of stretch) {
    const next = x + c * a - b;
    b = a;
    a = next;
  }
  const power = a * a + b * b - c * a * b;
  return 20 * Math.log10((2 * Math.sqrt(Math.max(power, 1e-20))) / stretch.length);
}

function cli(...args) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args, "--json"], { encoding: "utf8", cwd: SCRATCH, windowsHide: true });
  return JSON.parse(result.stdout);
}

function sine(file, freq, seconds, amplitude = 0.3) {
  const samples = new Float32Array(Math.round(seconds * RATE) * 2);
  for (let i = 0; i < samples.length / 2; i++) {
    const v = amplitude * Math.sin((2 * Math.PI * freq * i) / RATE);
    samples[i * 2] = v;
    samples[i * 2 + 1] = v;
  }
  writeWav(file, samples, { rate: RATE, channels: 2 });
  return file;
}

// ---------------------------------------------------------------------------
// anchor: where a sound's loudest moment lands
// ---------------------------------------------------------------------------

test("sfx --events: anchor peak puts a whoosh's loudest moment on its t; without it the sound still starts there", () => {
  for (const type of ["whoosh", "swish"]) {
    const placed = mono(eventSfx([{ t: 1, type, anchor: "peak" }], { duration: 3 }).samples);
    assert.ok(Math.abs(peakTime(placed) - 1) <= FRAME, `${type} com o pico em ${peakTime(placed)} s`);
    assert.ok(soundSpan(placed).first < 1, `${type} começa antes do corte`);
    const plain = mono(eventSfx([{ t: 1, type }], { duration: 3 }).samples);
    assert.ok(soundSpan(plain).first >= 1, `${type} sem anchor começa no t`);
  }
  const late = mono(eventSfx([{ t: 1, type: "whoosh" }], { duration: 3 }).samples);
  assert.ok(peakTime(late) - 1 > 3 * FRAME, "sem anchor o pico continua depois do t, como o carrossel conta");
});

test("sfx --events: anchor peak ends a riser on its t, leaves a sound that peaks at once alone, and survives a cut start", () => {
  const riser = soundSpan(mono(eventSfx([{ t: 2, type: "riser", length: 1, anchor: "peak" }], { duration: 3 }).samples));
  assert.ok(Math.abs(riser.first - 1) < 0.2, `o riser começa em ${riser.first} s`);
  assert.ok(riser.last <= 2 + FRAME, `o riser termina em ${riser.last} s`);
  const withAnchor = eventSfx([{ t: 1, type: "impact", anchor: "peak" }], { duration: 3, seed: 5 }).samples;
  const without = eventSfx([{ t: 1, type: "impact" }], { duration: 3, seed: 5 }).samples;
  assert.deepEqual(withAnchor, without);
  const early = mono(eventSfx([{ t: 0.05, type: "whoosh", anchor: "peak" }], { duration: 1 }).samples);
  assert.ok(soundSpan(early).first < 0.01, "um whoosh perto do começo perde só o início");
  assert.ok(Math.abs(peakTime(early) - 0.05) <= FRAME);
});

test("sfx cues: anchor peak works in the other list too, and a wrong value is refused", () => {
  for (const type of ["whoosh", "swoosh"]) {
    const placed = mono(cueSfx([{ t: 1, type, anchor: "peak" }], { duration: 3 }).samples);
    assert.ok(Math.abs(peakTime(placed) - 1) <= FRAME, `${type} com o pico em ${peakTime(placed)} s`);
    assert.ok(soundSpan(mono(cueSfx([{ t: 1, type }], { duration: 3 }).samples)).first >= 1);
  }
  const riser = soundSpan(mono(cueSfx([{ t: 2, type: "riser", duration: 1, anchor: "peak" }], { duration: 3 }).samples));
  assert.ok(riser.last <= 2.01, `o riser termina em ${riser.last} s`);
  assert.throws(() => cueSfx([{ t: 1, type: "whoosh", anchor: "meio" }]), (error) => error.code === "cues_invalid");
  const early = mono(cueSfx([{ t: 0.05, type: "whoosh", anchor: "peak", pan: 0.5 }], { duration: 1 }).samples);
  assert.ok(soundSpan(early).first < 0.01);
});

test("sfx command: anchor goes through the events file, and a wrong value is a usage error", () => {
  const events = join(SCRATCH, "anchor.json");
  writeFileSync(events, JSON.stringify({ duration: 3, events: [{ t: 1, type: "whoosh", anchor: "peak" }] }));
  const out = join(SCRATCH, "anchor.wav");
  const result = cli("sfx", "--out", out, "--events", events);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.ok(Math.abs(peakTime(mono(readWav(out).samples)) - 1) <= FRAME);
  writeFileSync(events, JSON.stringify({ duration: 3, events: [{ t: 1, type: "whoosh", anchor: "meio" }] }));
  const wrong = cli("sfx", "--out", out, "--events", events);
  assert.equal(wrong.error.code, "usage");
});

// ---------------------------------------------------------------------------
// mix: the music yields under an impact
// ---------------------------------------------------------------------------

test("mix: the music yields under an impact, ignores a tick and comes back", NEEDS_FFMPEG, () => {
  const music = sine(join(SCRATCH, "duck-music.wav"), 8000, 6);
  const sfx = join(SCRATCH, "duck-sfx.wav");
  writeWav(sfx, eventSfx([{ t: 2, type: "impact" }, { t: 4, type: "tick" }], { duration: 6 }).samples, { rate: RATE, channels: 2 });
  const out = join(SCRATCH, "duck-out.wav");
  const result = cli("mix", "--out", out, "--music", music, "--sfx", sfx);
  assert.equal(result.ok, true, JSON.stringify(result));
  const mixed = mono(readWav(out).samples);
  const before = toneDb(mixed, 8000, 1, 1.8);
  const under = toneDb(mixed, 8000, 2.1, 2.25);
  assert.ok(before - under >= 3, `sob o impacto a música cede ${(before - under).toFixed(1)} dB`);
  const tick = toneDb(mixed, 8000, 4.02, 4.2);
  assert.ok(Math.abs(before - tick) <= 1, `um tique não mexe na música: ${(before - tick).toFixed(1)} dB`);
  const back = toneDb(mixed, 8000, 5.2, 5.9);
  assert.ok(Math.abs(before - back) <= 1, `a música volta: ${(before - back).toFixed(1)} dB`);
  assert.equal(result.settings.sfx_duck, 8);
});

test("mix: --sfx-duck 0 leaves the music alone", NEEDS_FFMPEG, () => {
  const music = sine(join(SCRATCH, "noduck-music.wav"), 8000, 6);
  const sfx = join(SCRATCH, "noduck-sfx.wav");
  writeWav(sfx, eventSfx([{ t: 2, type: "impact" }], { duration: 6 }).samples, { rate: RATE, channels: 2 });
  const out = join(SCRATCH, "noduck-out.wav");
  const result = cli("mix", "--out", out, "--music", music, "--sfx", sfx, "--sfx-duck", "0");
  assert.equal(result.ok, true, JSON.stringify(result));
  const mixed = mono(readWav(out).samples);
  const drop = toneDb(mixed, 8000, 1, 1.8) - toneDb(mixed, 8000, 2.1, 2.25);
  assert.ok(Math.abs(drop) <= 0.7, `sem cessão a música fica igual: ${drop.toFixed(1)} dB`);
});

test("mix: a short effects file does not end the music", NEEDS_FFMPEG, () => {
  const music = sine(join(SCRATCH, "short-music.wav"), 8000, 6);
  const sfx = join(SCRATCH, "short-sfx.wav");
  writeWav(sfx, eventSfx([{ t: 1, type: "impact" }], { duration: 2 }).samples, { rate: RATE, channels: 2 });
  const out = join(SCRATCH, "short-out.wav");
  const result = cli("mix", "--out", out, "--music", music, "--sfx", sfx);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.duration, 6);
  const mixed = mono(readWav(out).samples);
  assert.ok(toneDb(mixed, 8000, 5, 5.9) > -40, "a música segue até o fim");
});

// sidechaincompress ended with whichever input ended first, and which one changed from run to
// run: the same files gave 4 different mixes in 10 runs (2026-11-08, ffmpeg 9.0.2)
test("mix: the same files give the same bytes every time", NEEDS_FFMPEG, () => {
  const music = sine(join(SCRATCH, "same-music.wav"), 8000, 6);
  const sfx = join(SCRATCH, "same-sfx.wav");
  writeWav(sfx, eventSfx([{ t: 2, type: "impact" }, { t: 4, type: "tick" }], { duration: 6 }).samples, { rate: RATE, channels: 2 });
  const hashes = new Set();
  for (let run = 0; run < 5; run++) {
    const out = join(SCRATCH, "same-out.wav");
    assert.equal(cli("mix", "--out", out, "--music", music, "--sfx", sfx).ok, true);
    hashes.add(createHash("sha256").update(readFileSync(out)).digest("hex"));
  }
  assert.equal(hashes.size, 1, `${hashes.size} mixagens diferentes em 5 rodadas`);
});

test("mix: a voice shorter than the music does not end it", NEEDS_FFMPEG, () => {
  const music = sine(join(SCRATCH, "voice-music.wav"), 8000, 10);
  const voice = sine(join(SCRATCH, "voice-voice.wav"), 300, 6);
  const out = join(SCRATCH, "voice-out.wav");
  const result = cli("mix", "--out", out, "--music", music, "--voice", voice);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.duration, 10);
  const mixed = mono(readWav(out).samples);
  const under = toneDb(mixed, 8000, 1, 5);
  for (let t = 6.5; t < 10; t += 0.5) {
    const level = toneDb(mixed, 8000, t, t + 0.5);
    assert.ok(level > -40, `a música aos ${t} s está em ${level.toFixed(1)} dB`);
    if (t >= 7) assert.ok(level > under, `depois da voz a música volta: ${level.toFixed(1)} contra ${under.toFixed(1)} dB sob ela`);
  }
});

// ---------------------------------------------------------------------------
// music: the peak on the film's biggest moment
// ---------------------------------------------------------------------------

test("planSections: dropAt places the drop on the nearest bar and the sections still cover every bar", () => {
  const plain = planSections({ duration: 15, bpm: 128 });
  assert.deepEqual(planSections({ duration: 15, bpm: 128, dropAt: null }), plain, "sem pedido nada muda");
  const bar = (60 / 128) * 4;
  for (const [wanted, expected] of [[11.25, 6], [11.6, 6], [3.75, 2], [bar, 1], [0, 1], [99, 6]]) {
    const plan = planSections({ duration: 15, bpm: 128, dropAt: wanted });
    assert.ok(Math.abs(plan.drop - expected * bar) < 1e-3, `pedido ${wanted} s: pico em ${plan.drop} s`);
    const musical = plan.sections.filter((section) => section.name !== "tail");
    assert.equal(musical.reduce((sum, section) => sum + section.bars, 0), plan.bars, `pedido ${wanted} s: todos os compassos`);
    assert.ok(musical.some((section) => section.name === "drop" && section.bars >= 1), `pedido ${wanted} s: há um trecho de pico`);
  }
  assert.equal(planSections({ duration: 20, bpm: 120, arc: "flat", dropAt: 8 }).drop, null, "uma cama constante não tem pico");
  const tiny = planSections({ duration: 6, bpm: 120, dropAt: 2 });
  assert.equal(tiny.drop, 2, "uma peça curta também aceita");
  const looped = planSections({ duration: 16, bpm: 120, loop: true, dropAt: 12 });
  assert.equal(looped.drop, 12);
});

test("synthesizeMusic: every style composes with the peak where it was asked, and says when it had to move it", () => {
  for (const style of STYLE_NAMES) {
    const music = synthesizeMusic({ duration: 15, bpm: 128, style, seed: 3, dropAt: 11.25 });
    assert.equal(music.drop, 11.25, style);
    assert.ok(music.beats.hits.includes(11.25), `${style}: o pico entra nos hits`);
    assert.ok(music.samples.every((x) => Number.isFinite(x)), style);
    assert.deepEqual(music.warnings.filter((warning) => /pico/.test(warning)), [], style);
  }
  const moved = synthesizeMusic({ duration: 15, bpm: 128, style: "clean", seed: 3, dropAt: 11.6 });
  assert.equal(moved.drop, 11.25);
  assert.ok(moved.warnings.some((warning) => /pico/.test(warning) && /11,25/.test(warning)), moved.warnings.join(" | "));
  const flat = synthesizeMusic({ duration: 15, bpm: 128, style: "clean", seed: 3, arc: "flat", dropAt: 8 });
  assert.ok(flat.warnings.some((warning) => /pico/.test(warning)), "a cama constante avisa que não tem pico");
});

test("synthesizeMusic: the peak is really louder than what comes before it, and the same request gives the same music", () => {
  const music = synthesizeMusic({ duration: 15, bpm: 128, style: "energetic", seed: 3, dropAt: 11.25 });
  const samples = mono(music.samples);
  const before = rms(part(samples, 1.875, 3.75));
  const peak = rms(part(samples, 11.25, 13.125));
  assert.ok(peak > before, `pico ${peak.toFixed(3)} contra ${before.toFixed(3)} antes`);
  const again = synthesizeMusic({ duration: 15, bpm: 128, style: "energetic", seed: 3, dropAt: 11.25 });
  assert.deepEqual(again.samples, music.samples);
});

test("music command: --drop-at moves the peak and reports it; a wrong value is a usage error", () => {
  const out = join(SCRATCH, "drop.wav");
  const result = cli("music", "--out", out, "--duration", "15", "--bpm", "128", "--style", "clean", "--seed", "3", "--drop-at", "11.25");
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.drop, 11.25);
  const wrong = cli("music", "--out", out, "--duration", "15", "--drop-at", "agora");
  assert.equal(wrong.error.code, "usage");
});

test("the guides tell the anchor, the yield and the peak", () => {
  const help = spawnSync(process.execPath, [SCRIPT, "help"], { encoding: "utf8", windowsHide: true }).stdout;
  for (const option of ["--drop-at", "--sfx-duck", "anchor"]) assert.ok(help.includes(option), `a ajuda cita ${option}`);
  const references = join(HERE, "..", "references");
  const interfaceText = readFileSync(join(references, "interface.md"), "utf8");
  for (const option of ["--drop-at", "--sfx-duck", "`anchor`", "`sfx_duck`"]) assert.ok(interfaceText.includes(option), `interface.md cita ${option}`);
  const guide = readFileSync(join(references, "som.md"), "utf8");
  for (const option of ["--drop-at", "--sfx-duck", '"anchor": "peak"']) assert.ok(guide.includes(option), `som.md cita ${option}`);
});
