// Sound synthesis for the loop-perfect music of `synth` and the effect types of `sfx`:
// oscillators, noise, envelopes, filters, a small reverb, a stereo bus, loudness as
// ITU BS.1770 measures it, the instruments and the effect generators. Pure functions
// over Float32Array at 48 000 Hz, no I/O; every random choice comes from a seeded
// generator, so the same inputs give the same samples on every machine.

import { clamp, seededRandom } from "../util.mjs";

export const RATE = 48000;
const TWO_PI = 2 * Math.PI;

export const dbToGain = (db) => 10 ** (db / 20);
export const gainToDb = (gain) => (gain > 0 ? 20 * Math.log10(gain) : -Infinity);
export const midiToFreq = (midi) => 440 * 2 ** ((midi - 69) / 12);
/** Seconds → whole samples (at least one). */
export const frames = (seconds) => Math.max(1, Math.round(seconds * RATE));

// ---------------------------------------------------------------------------
// Buffers
// ---------------------------------------------------------------------------

export function peak(samples) {
  let max = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > max) max = a;
  }
  return max;
}

/** Scales in place so the loudest sample sits at `target` (silence stays silent). */
export function normalize(samples, target = 1) {
  const max = peak(samples);
  if (max > 0) {
    const g = target / max;
    for (let i = 0; i < samples.length; i++) samples[i] *= g;
  }
  return samples;
}

export function multiply(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) a[i] *= b[i];
  return a;
}

/** ga·a + gb·b into a new buffer as long as the longer one. */
export function add(a, b, ga = 1, gb = 1) {
  const out = new Float32Array(Math.max(a.length, b.length));
  for (let i = 0; i < a.length; i++) out[i] += ga * a[i];
  for (let i = 0; i < b.length; i++) out[i] += gb * b[i];
  return out;
}

/** Linear fades in place (seconds); the last sample reaches zero. */
export function fadeEdges(samples, inSeconds = 0, outSeconds = 0) {
  const n = samples.length;
  const a = Math.min(n, frames(inSeconds));
  const r = Math.min(n, frames(outSeconds));
  if (inSeconds > 0) for (let i = 0; i < a; i++) samples[i] *= i / a;
  if (outSeconds > 0) for (let i = 0; i < r; i++) samples[n - 1 - i] *= i / r;
  return samples;
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/** PolyBLEP correction that rounds the jumps of saws and squares (band-limiting). */
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
 * An oscillator over `n` samples. `freq` is a number or a function of the sample index
 * (pitch sweeps). Waves: sine, triangle, saw, square (the last two band-limited).
 */
export function oscillator(n, wave, freq, { phase = 0, pulseWidth = 0.5 } = {}) {
  const out = new Float32Array(n);
  const f = typeof freq === "function" ? freq : () => freq;
  let p = ((phase % 1) + 1) % 1;
  for (let i = 0; i < n; i++) {
    const dt = Math.min(0.5, f(i) / RATE);
    let v;
    if (wave === "sine") v = Math.sin(TWO_PI * p);
    else if (wave === "triangle") v = 1 - 4 * Math.abs(p - 0.5);
    else if (wave === "square") {
      v = p < pulseWidth ? 1 : -1;
      v += polyBlep(p, dt);
      v -= polyBlep((p + 1 - pulseWidth) % 1, dt);
    } else {
      v = 2 * p - 1;
      v -= polyBlep(p, dt);
    }
    out[i] = v;
    p += dt;
    if (p >= 1) p -= 1;
  }
  return out;
}

export function noise(n, rng) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = rng() * 2 - 1;
  return out;
}

// ---------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------

/** A short ramp up, then an exponential decay that reaches −60 dB at `decay` seconds. */
export function decayEnv(n, decay, attack = 0.001) {
  const out = new Float32Array(n);
  const a = frames(attack);
  const k = 6.9078 / (decay * RATE);
  for (let i = 0; i < n; i++) out[i] = (i < a ? i / a : 1) * Math.exp(-k * i);
  return out;
}

/** Attack, decay to `sustain`, hold for `hold` seconds, then an exponential release. */
export function adsr(n, { attack = 0.005, decay = 0.05, sustain = 1, release = 0.1 }, hold) {
  const a = frames(attack);
  const d = frames(decay);
  const r = frames(release);
  const h = Math.max(a, frames(hold));
  const shape = (i) => (i < a ? i / a : i < a + d ? 1 - (1 - sustain) * ((i - a) / d) : sustain);
  const atGate = shape(h);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = i < h ? shape(i) : atGate * Math.exp((-5 * (i - h)) / r);
  return out;
}

// ---------------------------------------------------------------------------
// Filters, delay, reverb
// ---------------------------------------------------------------------------

export function onePoleLP(input, cutoff) {
  const out = new Float32Array(input.length);
  const a = 1 - Math.exp((-TWO_PI * cutoff) / RATE);
  let y = 0;
  for (let i = 0; i < input.length; i++) out[i] = y += a * (input[i] - y);
  return out;
}

export function onePoleHP(input, cutoff) {
  const low = onePoleLP(input, cutoff);
  for (let i = 0; i < low.length; i++) low[i] = input[i] - low[i];
  return low;
}

/** Direct-form biquad with normalized coefficients. */
export function iir(input, { b0, b1, b2, a1, a2 }) {
  const out = new Float32Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}

/** RBJ biquad with a fixed cutoff: lowpass, highpass, bandpass (0 dB peak), highshelf, peaking. */
export function biquad(input, { type, freq, q = 0.7071, gainDb = 0 }) {
  const w0 = (TWO_PI * Math.min(freq, RATE * 0.45)) / RATE;
  const cosw = Math.cos(w0);
  const sinw = Math.sin(w0);
  const alpha = sinw / (2 * q);
  const A = 10 ** (gainDb / 40);
  let c;
  if (type === "lowpass") c = [(1 - cosw) / 2, 1 - cosw, (1 - cosw) / 2, 1 + alpha, -2 * cosw, 1 - alpha];
  else if (type === "highpass") c = [(1 + cosw) / 2, -(1 + cosw), (1 + cosw) / 2, 1 + alpha, -2 * cosw, 1 - alpha];
  else if (type === "bandpass") c = [alpha, 0, -alpha, 1 + alpha, -2 * cosw, 1 - alpha];
  else if (type === "peaking") c = [1 + alpha * A, -2 * cosw, 1 - alpha * A, 1 + alpha / A, -2 * cosw, 1 - alpha / A];
  else if (type === "highshelf") {
    const s = 2 * Math.sqrt(A) * alpha;
    c = [
      A * (A + 1 + (A - 1) * cosw + s), -2 * A * (A - 1 + (A + 1) * cosw), A * (A + 1 + (A - 1) * cosw - s),
      A + 1 - (A - 1) * cosw + s, 2 * (A - 1 - (A + 1) * cosw), A + 1 - (A - 1) * cosw - s,
    ];
  } else throw new Error(`unknown filter type ${type}`);
  const [b0, b1, b2, a0, a1, a2] = c;
  return iir(input, { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 });
}

/** State-variable filter whose cutoff may move per sample (a number or a function of the index). */
export function svf(input, { cutoff, q = 0.7, mode = "low" }) {
  const n = input.length;
  const out = new Float32Array(n);
  const fc = typeof cutoff === "function" ? cutoff : () => cutoff;
  const damp = Math.min(1.9, 1 / Math.max(0.5, q));
  let low = 0;
  let band = 0;
  let high = 0;
  for (let i = 0; i < n; i++) {
    const f = 2 * Math.sin((Math.PI * clamp(fc(i), 20, 9000)) / (2 * RATE));
    const x = input[i];
    for (let k = 0; k < 2; k++) {
      high = x - low - damp * band;
      band += f * high;
      low += f * band;
    }
    out[i] = mode === "low" ? low : mode === "band" ? band : high;
  }
  return out;
}

/** A damped feedback delay; the output is as long as the input (pad the input for a tail). */
export function feedbackDelay(input, { time, feedback = 0.35, mix = 0.25, damp = 3500 }) {
  const n = input.length;
  const d = frames(time);
  const line = new Float32Array(n);
  const out = new Float32Array(n);
  const a = 1 - Math.exp((-TWO_PI * damp) / RATE);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const delayed = i >= d ? line[i - d] : 0;
    lp += a * (delayed - lp);
    line[i] = input[i] + lp * feedback;
    out[i] = input[i] + lp * mix;
  }
  return out;
}

/** A small Schroeder reverb (four combs, two allpasses); returns only the wet signal. */
export function reverbWet(input, { time = 1.4, damp = 0.35, predelay = 0.012 } = {}) {
  const n = input.length;
  const wet = new Float32Array(n);
  const pd = frames(predelay);
  for (const t of [0.0297, 0.0371, 0.0411, 0.0437]) {
    const d = frames(t);
    const g = 10 ** ((-3 * t) / time);
    const line = new Float32Array(n);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const x = i >= pd ? input[i - pd] : 0;
      const y = i >= d ? line[i - d] : 0;
      lp += (1 - damp) * (y - lp);
      line[i] = x + lp * g;
      wet[i] += y * 0.25;
    }
  }
  for (const t of [0.005, 0.0017]) {
    const d = frames(t);
    const g = 0.7;
    const line = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const back = i >= d ? line[i - d] : 0;
      const v = wet[i] + g * back;
      line[i] = v;
      wet[i] = back - g * v;
    }
  }
  return wet;
}

// ---------------------------------------------------------------------------
// Stereo bus, clipping, loudness, mastering
// ---------------------------------------------------------------------------

/** Two channels of `frames` samples; sounds are added at a sample position with gain and pan. */
export class Bus {
  constructor(frames) {
    this.frames = frames;
    this.L = new Float32Array(frames);
    this.R = new Float32Array(frames);
  }

  /** Adds a mono sound at sample `at` (may be negative: the start is cut) with equal-power pan −1…1. */
  add(mono, at, { gain = 1, pan = 0 } = {}) {
    const angle = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
    const gl = Math.cos(angle) * gain;
    const gr = Math.sin(angle) * gain;
    const start = Math.max(0, at);
    const end = Math.min(this.frames, at + mono.length);
    for (let i = start; i < end; i++) {
      const v = mono[i - at];
      this.L[i] += v * gl;
      this.R[i] += v * gr;
    }
  }

  addStereo(left, right, at = 0, gain = 1) {
    const start = Math.max(0, at);
    const end = Math.min(this.frames, at + left.length);
    for (let i = start; i < end; i++) {
      this.L[i] += left[i - at] * gain;
      this.R[i] += right[i - at] * gain;
    }
  }

  interleaved() {
    const out = new Float32Array(this.frames * 2);
    for (let i = 0, j = 0; i < this.frames; i++, j += 2) {
      out[j] = this.L[i];
      out[j + 1] = this.R[i];
    }
    return out;
  }
}

/** Linear below `knee`, then a tanh curve that never reaches ±1. */
export function softClip(x, knee = 0.8) {
  const a = Math.abs(x);
  if (a <= knee) return x;
  const y = knee + (1 - knee) * Math.tanh((a - knee) / (1 - knee));
  return x < 0 ? -y : y;
}

// ITU-R BS.1770 K-weighting at 48 kHz: a high shelf, then the RLB high-pass.
const K_SHELF = { b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285, a1: -1.69065929318241, a2: 0.73248077421585 };
const K_HIGHPASS = { b0: 1, b1: -2, b2: 1, a1: -1.99004745483398, a2: 0.99007225036621 };

/** Integrated loudness (LUFS) of one or more channels, gated as BS.1770 describes. */
export function loudnessLufs(channels) {
  const weighted = channels.map((ch) => iir(iir(ch, K_SHELF), K_HIGHPASS));
  const n = weighted[0].length;
  const block = Math.round(0.4 * RATE);
  const step = Math.round(0.1 * RATE);
  const measure = (start, length) => {
    let ms = 0;
    for (const ch of weighted) {
      let s = 0;
      for (let i = start; i < start + length; i++) s += ch[i] * ch[i];
      ms += s / length;
    }
    return ms;
  };
  const blocks = [];
  if (n < block) blocks.push(measure(0, n));
  else for (let start = 0; start + block <= n; start += step) blocks.push(measure(start, block));
  const lk = (ms) => -0.691 + 10 * Math.log10(ms);
  const absolute = blocks.filter((ms) => ms > 0 && lk(ms) > -70);
  if (!absolute.length) return -Infinity;
  const relative = lk(absolute.reduce((a, b) => a + b, 0) / absolute.length) - 10;
  const gated = absolute.filter((ms) => lk(ms) > relative);
  return lk(gated.reduce((a, b) => a + b, 0) / gated.length);
}

const TP_TAPS = 8;
const TP_PHASES = [0.25, 0.5, 0.75].map((phase) => {
  const coefficients = [];
  for (let k = -TP_TAPS + 1; k <= TP_TAPS; k++) {
    const t = k - phase;
    const sinc = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t);
    coefficients.push(sinc * (0.5 + 0.5 * Math.cos((Math.PI * t) / TP_TAPS)));
  }
  return coefficients;
});

/** True peak (dBTP) of one or more channels, through 4× sinc interpolation. */
export function truePeakDb(channels) {
  let max = 0;
  for (const ch of channels) {
    const n = ch.length;
    for (let i = 0; i < n; i++) {
      const a = Math.abs(ch[i]);
      if (a > max) max = a;
      for (const coefficients of TP_PHASES) {
        let v = 0;
        for (let k = -TP_TAPS + 1, c = 0; k <= TP_TAPS; k++, c++) {
          const j = i + k;
          if (j >= 0 && j < n) v += ch[j] * coefficients[c];
        }
        const b = Math.abs(v);
        if (b > max) max = b;
      }
    }
  }
  return gainToDb(max);
}

/**
 * Mastering in place: gain to the target loudness, a soft clip, then a cap on the true
 * peak. Returns what it did and the final numbers.
 */
export function master(channels, { targetLufs = -16, gainDb = 0, maxTruePeakDb = -1, knee = 0.85 } = {}) {
  const before = loudnessLufs(channels);
  let gain = Number.isFinite(before) ? dbToGain(targetLufs + gainDb - before) : 1;
  for (const ch of channels) for (let i = 0; i < ch.length; i++) ch[i] = softClip(ch[i] * gain, knee);
  const tp = truePeakDb(channels);
  if (tp > maxTruePeakDb) {
    const trim = dbToGain(maxTruePeakDb - tp);
    for (const ch of channels) for (let i = 0; i < ch.length; i++) ch[i] *= trim;
    gain *= trim;
  }
  return { gain_db: gainToDb(gain), lufs: loudnessLufs(channels), true_peak_dbtp: truePeakDb(channels) };
}

// ---------------------------------------------------------------------------
// Instruments (mono, peak-normalized; the arrangement sets the levels)
// ---------------------------------------------------------------------------

export function kick({ from = 170, to = 48, decay = 0.32, sweep = 0.045, click = 0.25, rng = null } = {}) {
  const n = frames(decay + 0.02);
  const body = oscillator(n, "sine", (i) => to + (from - to) * Math.exp(-i / (sweep * RATE)));
  const env = decayEnv(n, decay, 0.0005);
  const out = new Float32Array(n);
  const drive = Math.tanh(1.8);
  for (let i = 0; i < n; i++) out[i] = Math.tanh(1.8 * body[i] * env[i]) / drive;
  if (click > 0 && rng) {
    const c = biquad(noise(frames(0.004), rng), { type: "highpass", freq: 2500 });
    const ce = decayEnv(c.length, 0.004, 0.0002);
    for (let i = 0; i < c.length; i++) out[i] += click * c[i] * ce[i];
  }
  return normalize(out);
}

export function clap({ rng, decay = 0.16 } = {}) {
  const n = frames(decay + 0.04);
  const src = biquad(biquad(noise(n, rng), { type: "bandpass", freq: 1500, q: 0.9 }), { type: "highpass", freq: 600 });
  const env = new Float32Array(n);
  for (const [at, length, level] of [[0, 0.008, 1], [0.009, 0.008, 1], [0.019, 0.008, 1], [0.03, decay, 0.9]]) {
    const s = frames(at);
    const k = 6.9078 / (length * RATE);
    for (let i = s; i < n; i++) env[i] += level * Math.exp(-k * (i - s));
  }
  return normalize(multiply(src, env));
}

export function snare({ rng, decay = 0.18, tone = 185 } = {}) {
  const n = frames(decay + 0.02);
  const body = multiply(oscillator(n, "sine", (i) => tone + 60 * Math.exp(-i / (0.02 * RATE))), decayEnv(n, 0.1));
  const crack = multiply(biquad(noise(n, rng), { type: "highpass", freq: 1800 }), decayEnv(n, decay, 0.001));
  return normalize(add(body, crack, 0.8, 0.7));
}

export function rim({ rng } = {}) {
  const n = frames(0.05);
  const ping = multiply(oscillator(n, "sine", 1800), decayEnv(n, 0.012));
  const tick = multiply(biquad(noise(n, rng), { type: "bandpass", freq: 3200, q: 2 }), decayEnv(n, 0.025));
  return normalize(add(ping, tick, 0.5, 1));
}

export function hat({ rng, open = false, decay = open ? 0.28 : 0.045 } = {}) {
  const n = frames(decay + 0.01);
  const metal = new Float32Array(n);
  for (const f of [5200, 6700, 8900]) {
    const sq = oscillator(n, "square", f);
    for (let i = 0; i < n; i++) metal[i] += sq[i] / 3;
  }
  const src = biquad(biquad(add(noise(n, rng), metal, 1, 0.35), { type: "highpass", freq: 7000, q: 0.8 }), { type: "lowpass", freq: 16000 });
  return normalize(multiply(src, decayEnv(n, decay, 0.0005)));
}

export function shaker({ rng, decay = 0.09 } = {}) {
  const n = frames(decay + 0.02);
  return normalize(multiply(biquad(noise(n, rng), { type: "bandpass", freq: 6500, q: 1 }), decayEnv(n, decay, 0.012)));
}

export function subBass(freq, hold, { release = 0.08 } = {}) {
  const n = frames(hold + release);
  const sine = oscillator(n, "sine", freq);
  const second = oscillator(n, "sine", freq * 2);
  const env = adsr(n, { attack: 0.008, decay: 0.08, sustain: 0.85, release }, hold);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (sine[i] + 0.22 * second[i]) * env[i];
  return normalize(biquad(out, { type: "lowpass", freq: 260, q: 0.8 }));
}

/** A driving saw bass with a filter that closes after the attack. */
export function bassNote(freq, hold, { cutoff = 900, release = 0.06 } = {}) {
  const n = frames(hold + release);
  const filtered = svf(oscillator(n, "saw", freq), { cutoff: (i) => 150 + (cutoff - 150) * Math.exp(-i / (0.08 * RATE)), q: 1.1, mode: "low" });
  return normalize(multiply(filtered, adsr(n, { attack: 0.004, decay: 0.05, sustain: 0.8, release }, hold)));
}

/** A Karplus–Strong string: a short noise burst through a tuned loop that darkens as it rings. */
export function pluck(freq, hold, rng, { bright = 0.5, decay = 0.9 } = {}) {
  const n = frames(hold + 0.06);
  const period = RATE / freq;
  const p = Math.max(2, Math.round(period - 0.5));
  const exc = onePoleLP(noise(p + 1, rng), 1200 + bright * 7000);
  const ramp = Math.min(p, frames(0.0008));
  for (let i = 0; i < ramp; i++) exc[i] *= i / ramp;
  const g = 10 ** ((-3 * period) / (decay * RATE));
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const d = i - p;
    buf[i] = (i <= p ? exc[i] : 0) + (d >= 1 ? g * 0.5 * (buf[d] + buf[d - 1]) : 0);
  }
  const h = frames(hold);
  const r = frames(0.05);
  for (let i = h; i < n; i++) buf[i] *= Math.max(0, 1 - (i - h) / r);
  return normalize(biquad(buf, { type: "highpass", freq: 70 }));
}

/** An electric-piano note: sine with fading harmonics and a slow vibrato, muted by a low-pass. */
export function keys(freq, hold, { release = 0.35, vibrato = 5, depth = 0.003, cutoff = 2600 } = {}) {
  const n = frames(hold + release);
  const f = (i) => freq * (1 + depth * Math.sin((TWO_PI * vibrato * i) / RATE));
  const f1 = oscillator(n, "sine", f);
  const f2 = oscillator(n, "sine", (i) => 2 * f(i));
  const f3 = oscillator(n, "sine", (i) => 3 * f(i));
  const bright = decayEnv(n, 0.5);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = f1[i] + (0.45 * f2[i] + 0.18 * f3[i]) * bright[i];
  multiply(out, adsr(n, { attack: 0.004, decay: 0.6, sustain: 0.55, release }, hold));
  return normalize(biquad(out, { type: "lowpass", freq: cutoff, q: 0.7 }));
}

/** Detuned oscillators per note through a slowly moving low-pass, with a slow attack. */
export function pad(freqs, hold, { detune = 7, cutoff = 1000, attack = 0.35, release = 0.6, wave = "saw", drift = 0.3 } = {}) {
  const n = frames(hold + release);
  const sum = new Float32Array(n);
  freqs.forEach((freq, index) => {
    for (const cents of [-detune, detune]) {
      const osc = oscillator(n, wave, freq * 2 ** (cents / 1200), { phase: (index * 0.37 + (cents > 0 ? 0.5 : 0)) % 1 });
      for (let i = 0; i < n; i++) sum[i] += osc[i];
    }
  });
  const filtered = svf(sum, { cutoff: (i) => cutoff * (1 + drift * Math.sin((TWO_PI * 0.23 * i) / RATE)), q: 0.8, mode: "low" });
  return normalize(multiply(filtered, adsr(n, { attack, decay: 0.2, sustain: 0.9, release }, hold)));
}

/** One beat of filtered saw that ducks at the beat and swells back, the pumping of a tech bed. */
export function pulseNote(freq, beat, { cutoff = 1400 } = {}) {
  const n = frames(beat);
  const saws = add(oscillator(n, "saw", freq), oscillator(n, "saw", freq * 2 ** (5 / 1200), { phase: 0.5 }));
  const filtered = svf(saws, { cutoff: (i) => 200 + cutoff * (1 - Math.exp(-(i / n) / 0.25)), q: 1.2, mode: "low" });
  const attack = frames(0.002);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const dip = 1 - 0.8 * Math.exp(-t / 0.18);
    const tail = t > 0.85 ? (1 - t) / 0.15 : 1;
    filtered[i] *= dip * tail * (i < attack ? i / attack : 1);
  }
  return normalize(filtered);
}

/** A brushed noise bed whose level breathes on a slow LFO (`lfo` in Hz). */
export function noiseBed(n, rng, { freq = 700, q = 0.5, lfo = 0.17 } = {}) {
  const src = biquad(noise(n, rng), { type: "bandpass", freq, q });
  for (let i = 0; i < n; i++) src[i] *= 0.65 + 0.35 * Math.sin((TWO_PI * lfo * i) / RATE);
  return normalize(src);
}

/** Vinyl crackle (sparse clicks, `density` per second) with a little tape hiss. */
export function crackle(n, rng, { density = 40, hiss = 0.3 } = {}) {
  const out = new Float32Array(n);
  const p = density / RATE;
  for (let i = 0; i < n - 1; i++) {
    if (rng() < p) {
      const amp = rng() * 2 - 1;
      out[i] += amp;
      out[i + 1] -= amp * 0.6;
    }
  }
  const low = biquad(out, { type: "lowpass", freq: 4000 });
  const high = biquad(noise(n, rng), { type: "highpass", freq: 4500 });
  for (let i = 0; i < n; i++) low[i] += hiss * 0.08 * high[i];
  return normalize(low);
}

// ---------------------------------------------------------------------------
// Effect generators (mono, peak-normalized)
// ---------------------------------------------------------------------------

export function impact({ rng, length = 0.9, pitch = 1 } = {}) {
  const n = frames(length);
  const body = kick({ from: 160 * pitch, to: 42 * pitch, decay: Math.min(0.6, length * 0.6), sweep: 0.06, click: 0, rng });
  const burst = multiply(biquad(noise(n, rng), { type: "highpass", freq: 900 }), decayEnv(n, 0.09));
  const tail = multiply(biquad(noise(n, rng), { type: "lowpass", freq: 500 * pitch, q: 0.9 }), decayEnv(n, length * 0.85, 0.005));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (i < body.length ? body[i] : 0) + 0.5 * burst[i] + 0.6 * tail[i];
  return normalize(out);
}

export function click({ rng, length = 0.004, freq = 3200, q = 1 } = {}) {
  const n = frames(length + 0.004);
  return normalize(multiply(biquad(noise(n, rng), { type: "bandpass", freq, q }), decayEnv(n, length, 0.0002)));
}

export function pop({ length = 0.08, pitch = 1 } = {}) {
  const n = frames(length);
  const tone = oscillator(n, "sine", (i) => pitch * (320 + 700 * Math.min(1, i / (0.4 * n))));
  return normalize(multiply(tone, decayEnv(n, length, 0.002)));
}

export function whoosh({ rng, length = 0.35, pitch = 1, direction = "in", q = 1.6 } = {}) {
  const n = frames(length);
  const lo = 250 * pitch;
  const hi = 4200 * pitch;
  const sweep = (i) => {
    const x = i / n;
    return lo * (hi / lo) ** (direction === "out" ? 1 - x : x);
  };
  const src = svf(noise(n, rng), { cutoff: sweep, q, mode: "band" });
  for (let i = 0; i < n; i++) src[i] *= Math.sin(Math.PI * (i / n)) ** 0.8;
  return normalize(src);
}

export function riser({ rng, length = 1, pitch = 1 } = {}) {
  const n = frames(length);
  const air = svf(noise(n, rng), { cutoff: (i) => 300 * pitch * 20 ** (i / n), q: 1.2, mode: "band" });
  const tone = svf(oscillator(n, "saw", (i) => 110 * pitch * 4 ** (i / n)), { cutoff: (i) => 400 + 3000 * (i / n), q: 0.9, mode: "low" });
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (0.7 * air[i] + 0.4 * tone[i]) * (i / n) ** 2.2;
  fadeEdges(out, 0, 0.008);
  return normalize(out);
}

export function ding({ length = 1.2, pitch = 1 } = {}) {
  const n = frames(length);
  const f = 1760 * pitch;
  const out = new Float32Array(n);
  for (const [ratio, gain, decay] of [[1, 1, length], [2.76, 0.35, length * 0.45], [5.4, 0.15, length * 0.2]]) {
    const partial = multiply(oscillator(n, "sine", f * ratio), decayEnv(n, decay, 0.001));
    for (let i = 0; i < n; i++) out[i] += gain * partial[i];
  }
  return normalize(out);
}

export function shutter({ rng, length = 0.09, pitch = 1 } = {}) {
  const n = frames(length);
  const out = new Float32Array(n);
  const a = click({ rng, length: 0.003, freq: 2800 * pitch });
  const b = click({ rng, length: 0.004, freq: 2200 * pitch });
  const gap = frames(length * 0.65);
  for (let i = 0; i < a.length && i < n; i++) out[i] += a[i];
  for (let i = 0; i < b.length && gap + i < n; i++) out[gap + i] += 0.8 * b[i];
  const whir = multiply(biquad(noise(n, rng), { type: "lowpass", freq: 1500 }), decayEnv(n, length * 0.6, 0.004));
  for (let i = 0; i < n; i++) out[i] += 0.25 * whir[i];
  return normalize(out);
}

export function blip({ length = 0.06, pitch = 1 } = {}) {
  const n = frames(length);
  const out = biquad(oscillator(n, "square", 880 * pitch), { type: "lowpass", freq: 6000 });
  fadeEdges(out, 0.002, 0.006);
  return normalize(out);
}

/** The effect types of `sfx`: default length (s), level (dB) and the generator. `length` and `pitch` come from the event. */
export const SFX_TYPES = {
  kick: { length: 0.35, level: -4, make: (rng, o) => kick({ from: 180 * o.pitch, to: 50 * o.pitch, decay: o.length, rng }) },
  thump: { length: 0.5, level: -4, make: (rng, o) => kick({ from: 95 * o.pitch, to: 38 * o.pitch, decay: o.length, sweep: 0.08, click: 0.1, rng }) },
  impact: { length: 0.9, level: 0, make: (rng, o) => impact({ rng, length: o.length, pitch: o.pitch }) },
  click: { length: 0.004, level: -12, make: (rng, o) => click({ rng, length: o.length, freq: 3200 * o.pitch }) },
  tick: { length: 0.003, level: -15, make: (rng, o) => click({ rng, length: o.length, freq: 6500 * o.pitch, q: 2 }) },
  pop: { length: 0.08, level: -9, make: (rng, o) => pop({ length: o.length, pitch: o.pitch }) },
  whoosh: { length: 0.35, level: -7, make: (rng, o) => whoosh({ rng, length: o.length, pitch: o.pitch, direction: o.direction }) },
  swish: { length: 0.15, level: -10, make: (rng, o) => whoosh({ rng, length: o.length, pitch: 1.6 * o.pitch, direction: o.direction, q: 2.5 }) },
  riser: { length: 1, level: -7, make: (rng, o) => riser({ rng, length: o.length, pitch: o.pitch }) },
  ding: { length: 1.2, level: -9, make: (rng, o) => ding({ length: o.length, pitch: o.pitch }) },
  shutter: { length: 0.09, level: -9, make: (rng, o) => shutter({ rng, length: o.length, pitch: o.pitch }) },
  pluck: { length: 0.5, level: -9, make: (rng, o) => pluck(440 * o.pitch, o.length, rng, { bright: 0.6, decay: o.length }) },
  blip: { length: 0.06, level: -12, make: (rng, o) => blip({ length: o.length, pitch: o.pitch }) },
};
export const SFX_ALIASES = { swoosh: "swish" };
export const SFX_TYPE_NAMES = Object.keys(SFX_TYPES);

/**
 * Places validated events ({ t, type, gain_db, pan, length, pitch, direction }) on a stereo
 * timeline. Duration = `duration` or the end of the last event; the peak is capped at −1 dBFS.
 */
export function synthesizeSfx(events, { duration = null, seed = 1 } = {}) {
  const rng = seededRandom(seed);
  const prepared = events.map((event) => {
    const type = SFX_TYPES[SFX_ALIASES[event.type] ?? event.type];
    if (!type) throw new Error(`unknown sfx type ${event.type}`);
    const length = event.length ?? type.length;
    return { ...event, type, length, end: event.t + length + 0.05 };
  });
  const total = duration ?? Math.max(0.1, ...prepared.map((event) => event.end));
  const bus = new Bus(frames(total));
  for (const event of prepared) {
    const sound = event.type.make(rng, { length: event.length, pitch: event.pitch ?? 1, direction: event.direction ?? "in" });
    bus.add(sound, frames(event.t), { gain: dbToGain(event.type.level + (event.gain_db ?? 0)), pan: event.pan ?? 0 });
  }
  const cap = dbToGain(-1);
  const top = Math.max(peak(bus.L), peak(bus.R));
  if (top > cap) {
    const g = cap / top;
    for (let i = 0; i < bus.frames; i++) {
      bus.L[i] *= g;
      bus.R[i] *= g;
    }
  }
  return { samples: bus.interleaved(), duration: total, frames: bus.frames, peak_dbfs: gainToDb(Math.min(top, cap)) };
}
