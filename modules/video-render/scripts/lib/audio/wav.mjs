// 16-bit PCM WAV in and out, plus the small DSP toolkit the synthesizers share:
// soft limiter, levels, mixing at offsets, filters, echo, stereo width, envelopes,
// band-limited oscillators and seeded noise. Everything is deterministic: the same
// input gives the same bytes on every machine.

import { readFileSync } from "node:fs";

import { AppError, writeFileAtomic } from "../util.mjs";

export const DEFAULT_RATE = 48000;

export const dbToGain = (db) => 10 ** (db / 20);
export const gainToDb = (gain) => (gain > 0 ? 20 * Math.log10(gain) : -Infinity);

/** Soft limiter: linear below `knee`, then a tanh curve that never exceeds ±1. */
export function softClip(x, knee = 0.8) {
  const a = Math.abs(x);
  if (a <= knee) return x;
  const y = knee + (1 - knee) * Math.tanh((a - knee) / (1 - knee));
  return x < 0 ? -y : y;
}

// ---------------------------------------------------------------------------
// PCM encoding
// ---------------------------------------------------------------------------

/**
 * Interleaved float samples → a WAV file as a Buffer. Samples above the knee are
 * soft-limited before quantization, so a hot mix distorts gently instead of wrapping.
 */
export function encodeWav(samples, { rate = DEFAULT_RATE, channels = 2, knee = 0.9 } = {}) {
  if (!Number.isInteger(channels) || channels < 1 || channels > 8) throw new AppError("usage", `Número de canais inválido: ${channels}.`);
  const frames = Math.floor(samples.length / channels);
  const dataBytes = frames * channels * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * channels * 2, 28);
  buffer.writeUInt16LE(channels * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);
  let offset = 44;
  const total = frames * channels;
  for (let i = 0; i < total; i++) {
    const x = softClip(samples[i] || 0, knee);
    const q = Math.max(-32768, Math.min(32767, Math.round(x * 32767)));
    buffer.writeInt16LE(q, offset);
    offset += 2;
  }
  return buffer;
}

/** A WAV file (PCM 8/16/24/32-bit or float 32/64-bit) → { rate, channels, frames, samples (interleaved floats) }. */
export function decodeWav(buffer) {
  const bad = (why) => new AppError("unreadable_media", "O arquivo não é um WAV que eu consiga ler.", why);
  if (buffer.length < 12 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") throw bad("Faltam os cabeçalhos RIFF/WAVE.");
  let fmt = null;
  let data = null;
  let pos = 12;
  while (pos + 8 <= buffer.length) {
    const id = buffer.toString("ascii", pos, pos + 4);
    const size = buffer.readUInt32LE(pos + 4);
    const start = pos + 8;
    if (id === "fmt ") {
      let format = buffer.readUInt16LE(start);
      const channels = buffer.readUInt16LE(start + 2);
      const rate = buffer.readUInt32LE(start + 4);
      const bits = buffer.readUInt16LE(start + 14);
      if (format === 0xfffe && size >= 26) format = buffer.readUInt16LE(start + 24); // WAVE_FORMAT_EXTENSIBLE: the real format is in the sub-format GUID
      fmt = { format, channels, rate, bits };
    } else if (id === "data") {
      data = { start, size: Math.min(size, buffer.length - start) };
    }
    pos = start + size + (size % 2); // chunks are word-aligned
  }
  if (!fmt || !data) throw bad("Faltam os blocos fmt ou data.");
  const { format, channels, rate, bits } = fmt;
  if (!channels || !rate) throw bad("Cabeçalho fmt sem canais ou taxa.");
  const bytesPerSample = bits / 8;
  const frames = Math.floor(data.size / (bytesPerSample * channels));
  const samples = new Float32Array(frames * channels);
  let read;
  if (format === 1 && bits === 16) read = (o) => buffer.readInt16LE(o) / 32768;
  else if (format === 1 && bits === 24) read = (o) => ((buffer[o] | (buffer[o + 1] << 8) | (buffer[o + 2] << 16)) << 8 >> 8) / 8388608;
  else if (format === 1 && bits === 32) read = (o) => buffer.readInt32LE(o) / 2147483648;
  else if (format === 1 && bits === 8) read = (o) => (buffer[o] - 128) / 128;
  else if (format === 3 && bits === 32) read = (o) => buffer.readFloatLE(o);
  else if (format === 3 && bits === 64) read = (o) => buffer.readDoubleLE(o);
  else throw bad(`Formato ${format} com ${bits} bits não é suportado.`);
  let offset = data.start;
  for (let i = 0; i < samples.length; i++) {
    samples[i] = read(offset);
    offset += bytesPerSample;
  }
  return { rate, channels, frames, samples };
}

export function readWav(path) {
  let buffer;
  try {
    buffer = readFileSync(path);
  } catch (error) {
    throw new AppError("file_not_found", `Não encontrei o áudio: ${path}.`, String(error.message));
  }
  return decodeWav(buffer);
}

export function writeWav(path, samples, options = {}) {
  writeFileAtomic(path, encodeWav(samples, options));
}

// ---------------------------------------------------------------------------
// Channels and levels
// ---------------------------------------------------------------------------

export function interleave(left, right) {
  const out = new Float32Array(left.length * 2);
  for (let i = 0, j = 0; i < left.length; i++, j += 2) {
    out[j] = left[i];
    out[j + 1] = right[i];
  }
  return out;
}

export function deinterleave(samples, channels) {
  const frames = Math.floor(samples.length / channels);
  const out = Array.from({ length: channels }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) for (let c = 0; c < channels; c++) out[c][i] = samples[i * channels + c];
  return out;
}

/** Interleaved multichannel → mono average. */
export function toMono(samples, channels) {
  if (channels === 1) return Float32Array.from(samples);
  const frames = Math.floor(samples.length / channels);
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += samples[i * channels + c];
    out[i] = sum / channels;
  }
  return out;
}

export function peak(samples) {
  let max = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > max) max = a;
  }
  return max;
}

export const peakDb = (samples) => gainToDb(peak(samples));

export function rms(samples) {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

export const rmsDb = (samples) => gainToDb(rms(samples));

export function applyGain(samples, gain) {
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return samples;
}

/** Scales in place so the loudest sample sits at `targetDb` (default -3 dBFS). Silence stays silent. */
export function normalizePeak(samples, targetDb = -3) {
  const max = peak(samples);
  if (max > 0) applyGain(samples, dbToGain(targetDb) / max);
  return samples;
}

/** Linear fades in place, in seconds; the end of the buffer reaches exactly zero. */
export function fade(samples, rate, { inSeconds = 0, outSeconds = 0, channels = 1 } = {}) {
  const frames = Math.floor(samples.length / channels);
  const inFrames = Math.min(frames, Math.round(inSeconds * rate));
  const outFrames = Math.min(frames, Math.round(outSeconds * rate));
  for (let i = 0; i < inFrames; i++) {
    const g = i / inFrames;
    for (let c = 0; c < channels; c++) samples[i * channels + c] *= g;
  }
  for (let i = 0; i < outFrames; i++) {
    const g = i / outFrames;
    const frame = frames - 1 - i;
    for (let c = 0; c < channels; c++) samples[frame * channels + c] *= g;
  }
  return samples;
}

// ---------------------------------------------------------------------------
// Mixing
// ---------------------------------------------------------------------------

/**
 * Adds `source` into `target` starting at sample `offset`, scaled by `gain`.
 * With `wrap`, samples past the end continue at the start (seamless loops); otherwise they are dropped.
 */
export function addInto(target, source, offset = 0, gain = 1, { wrap = false } = {}) {
  const n = target.length;
  if (!n) return target;
  for (let i = 0; i < source.length; i++) {
    let j = offset + i;
    if (j < 0) continue;
    if (j >= n) {
      if (!wrap) break;
      j %= n;
    }
    target[j] += source[i] * gain;
  }
  return target;
}

/** Equal-power pan: -1 = left, 0 = center, 1 = right → [leftGain, rightGain]. */
export function panGains(pan = 0) {
  const angle = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  return [Math.cos(angle), Math.sin(angle)];
}

/** A mono buffer into a stereo bus ({ left, right }) at `offset`, with gain and pan. */
export function addMono(bus, source, offset, { gain = 1, pan = 0, wrap = false } = {}) {
  const [l, r] = panGains(pan);
  addInto(bus.left, source, offset, gain * l, { wrap });
  addInto(bus.right, source, offset, gain * r, { wrap });
  return bus;
}

/** A stereo pair into a stereo bus. */
export function addStereo(bus, source, offset, { gain = 1, wrap = false } = {}) {
  addInto(bus.left, source.left, offset, gain, { wrap });
  addInto(bus.right, source.right, offset, gain, { wrap });
  return bus;
}

export const stereoBus = (frames) => ({ left: new Float32Array(frames), right: new Float32Array(frames) });

/** Mid/side width: 0 = mono, 1 = as is, 2 = twice as wide. Returns a new pair. */
export function stereoWidth(left, right, width = 1) {
  const outL = new Float32Array(left.length);
  const outR = new Float32Array(right.length);
  for (let i = 0; i < left.length; i++) {
    const mid = (left[i] + right[i]) / 2;
    const side = ((left[i] - right[i]) / 2) * width;
    outL[i] = mid + side;
    outR[i] = mid - side;
  }
  return { left: outL, right: outR };
}

// ---------------------------------------------------------------------------
// Filters and effects
// ---------------------------------------------------------------------------

/** One-pole low-pass (6 dB/oct). Returns a new buffer. */
export function lowPass(samples, rate, cutoff) {
  const out = new Float32Array(samples.length);
  const a = 1 - Math.exp((-2 * Math.PI * Math.min(cutoff, rate / 2 - 1)) / rate);
  let y = 0;
  for (let i = 0; i < samples.length; i++) {
    y += a * (samples[i] - y);
    out[i] = y;
  }
  return out;
}

/** One-pole high-pass: the input minus its low-passed copy. Returns a new buffer. */
export function highPass(samples, rate, cutoff) {
  const low = lowPass(samples, rate, cutoff);
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] - low[i];
  return out;
}

/**
 * State-variable filter (12 dB/oct, stable at any cutoff below Nyquist) with an
 * optional cutoff sweep: `cutoff` is a number or a function (0..1 of the buffer) → Hz.
 * `resonance` goes from 0 (gentle) to 1 (ringing). `mode`: low, band or high.
 */
export function svf(samples, rate, { cutoff, resonance = 0.3, mode = "low" } = {}) {
  const out = new Float32Array(samples.length);
  const n = samples.length;
  const nyquist = rate / 2 - 100;
  const k = 2 - 1.9 * Math.max(0, Math.min(1, resonance));
  const fixed = typeof cutoff === "number";
  let ic1 = 0;
  let ic2 = 0;
  let g = fixed ? Math.tan((Math.PI * Math.min(Math.max(cutoff, 10), nyquist)) / rate) : 0;
  for (let i = 0; i < n; i++) {
    if (!fixed && (i % 32 === 0 || i === 0)) g = Math.tan((Math.PI * Math.min(Math.max(cutoff(i / n), 10), nyquist)) / rate);
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const v0 = samples[i];
    const v3 = v0 - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + g * a2 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    out[i] = mode === "low" ? v2 : mode === "band" ? v1 : v0 - k * v1 - v2;
  }
  return out;
}

/**
 * Feedback echo with a damped (low-passed) repeat. Returns a longer buffer whose
 * tail holds every repeat above -60 dB, so a note never ends abruptly.
 */
export function echo(samples, rate, { time = 0.375, feedback = 0.35, mix = 0.3, damping = 4000 } = {}) {
  const delay = Math.max(1, Math.round(time * rate));
  const fb = Math.max(0, Math.min(0.9, feedback));
  const repeats = fb > 0 ? Math.ceil(Math.log(0.001) / Math.log(fb)) : 1;
  const length = samples.length + delay * repeats;
  const wet = new Float32Array(length);
  const out = new Float32Array(length);
  const a = 1 - Math.exp((-2 * Math.PI * damping) / rate);
  let low = 0;
  for (let i = 0; i < length; i++) {
    if (i >= delay) {
      // the delay line is fed with the dry signal plus its own damped output
      const input = (i - delay < samples.length ? samples[i - delay] : 0) + fb * wet[i - delay];
      low += a * (input - low);
      wet[i] = low;
    }
    out[i] = (i < samples.length ? samples[i] : 0) + mix * wet[i];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Envelopes, oscillators, noise
// ---------------------------------------------------------------------------

/**
 * ADSR envelope for a note held `hold` seconds: attack and decay inside the hold,
 * release after it. Returns a buffer of (hold + release) seconds; curves are
 * exponential, so the tail dies naturally and ends at zero.
 */
export function adsr(rate, { attack = 0.005, decay = 0.1, sustain = 0.7, release = 0.2 } = {}, hold = 0.5) {
  const holdN = Math.max(1, Math.round(hold * rate));
  const releaseN = Math.max(1, Math.round(release * rate));
  const out = new Float32Array(holdN + releaseN);
  const attackN = Math.max(1, Math.round(attack * rate));
  const decayN = Math.max(1, Math.round(decay * rate));
  let level = 0;
  for (let i = 0; i < holdN; i++) {
    if (i < attackN) level = i / attackN;
    else {
      const t = (i - attackN) / decayN;
      level = sustain + (1 - sustain) * Math.exp(-4 * t);
    }
    out[i] = level;
  }
  for (let i = 0; i < releaseN; i++) {
    const t = releaseN > 1 ? i / (releaseN - 1) : 1;
    out[holdN + i] = level * Math.exp(-6 * t) * (1 - t);
  }
  return out;
}

export function multiply(samples, envelope) {
  const n = Math.min(samples.length, envelope.length);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = samples[i] * envelope[i];
  return out;
}

function polyBlep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

/**
 * A band-limited oscillator: `wave` is sine, triangle, saw or square; `freq` is a
 * number or a function (sample index → Hz) for sweeps and vibrato. Saw and square
 * use polyBLEP edges, so they stay clean without a heavy filter.
 */
export function oscillator(rate, { wave = "sine", freq = 440, length, phase = 0 }) {
  const out = new Float32Array(length);
  const fixed = typeof freq === "number";
  let p = phase % 1;
  for (let i = 0; i < length; i++) {
    const f = fixed ? freq : freq(i);
    const dt = f / rate;
    let y;
    switch (wave) {
      case "triangle":
        y = 1 - 4 * Math.abs(p - 0.5);
        break;
      case "saw":
        y = 2 * p - 1 - polyBlep(p, dt);
        break;
      case "square":
        y = (p < 0.5 ? 1 : -1) + polyBlep(p, dt) - polyBlep((p + 0.5) % 1, dt);
        break;
      default:
        y = Math.sin(2 * Math.PI * p);
    }
    out[i] = y;
    p += dt;
    if (p >= 1) p -= 1;
  }
  return out;
}

/** Seeded noise: white, or pink (-3 dB/oct, softer) through Kellet's filter. */
export function noise(length, rng, { color = "white" } = {}) {
  const out = new Float32Array(length);
  if (color === "pink") {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const w = rng() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    return out;
  }
  for (let i = 0; i < length; i++) out[i] = rng() * 2 - 1;
  return out;
}

/** An exponential decay envelope reaching -60 dB at `seconds` (and exactly zero at the end). */
export function decayEnvelope(rate, seconds, { curve = 6.9 } = {}) {
  const n = Math.max(1, Math.round(seconds * rate));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 1;
    out[i] = Math.exp(-curve * t) * (1 - t);
  }
  return out;
}
