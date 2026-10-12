// Beat grid from audio: tempo, first beat, downbeats and accents, found with an
// onset envelope (spectral flux over log-spaced bands) and autocorrelation.
// Deterministic and dependency-free.

import { AppError, clamp, round } from "../util.mjs";

const FRAME = 1024;
const HOP = 256;
const LOW_HZ = 160; // below this, onsets are kicks: they anchor the beat and the downbeat
const LOW_WEIGHT = 3; // how much more a low-band onset counts than the rest

// ---------------------------------------------------------------------------
// FFT (radix-2, in place)
// ---------------------------------------------------------------------------

const twiddles = new Map();

function twiddleFor(n) {
  if (!twiddles.has(n)) {
    const cos = new Float64Array(n / 2);
    const sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      cos[i] = Math.cos((-2 * Math.PI * i) / n);
      sin[i] = Math.sin((-2 * Math.PI * i) / n);
    }
    twiddles.set(n, { cos, sin });
  }
  return twiddles.get(n);
}

/** In-place complex FFT of power-of-two length. */
export function fft(re, im) {
  const n = re.length;
  if (n & (n - 1)) throw new AppError("usage", `FFT precisa de tamanho potência de 2, não ${n}.`);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  const { cos, sin } = twiddleFor(n);
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * step];
        const wi = sin[k * step];
        const a = start + k;
        const b = a + half;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Onset envelope
// ---------------------------------------------------------------------------

/** Log-spaced band edges (in bins) from 40 Hz to Nyquist; every band holds at least one bin. */
function bandEdges(rate, frame, count = 36) {
  const binHz = rate / frame;
  const edges = [Math.max(1, Math.floor(40 / binHz))];
  const top = frame / 2;
  for (let i = 1; i <= count; i++) {
    const hz = 40 * (rate / 2 / 40) ** (i / count);
    const bin = Math.min(top, Math.max(edges[edges.length - 1] + 1, Math.round(hz / binHz)));
    if (bin > edges[edges.length - 1]) edges.push(bin);
  }
  return edges;
}

/**
 * Spectral flux per hop: the rise of the log magnitude in each of ~36 log-spaced
 * bands, summed (a hi-hat spread over hundreds of bins no longer drowns a kick).
 * `low` holds the same for the bands under 160 Hz. Times are hop index × hopTime
 * + offsetTime, which is where a sharp onset peaks in this measure.
 */
export function onsetEnvelope(samples, rate, { frame = FRAME, hop = HOP } = {}) {
  // a sharp onset peaks in the flux when it sits three quarters into the window; padding
  // the start with that much silence lets the window slide onto an onset at t = 0 like
  // any other, and makes hop k mean time k × hopTime exactly
  const pad = Math.round(frame * 0.75);
  const frames = Math.max(1, Math.floor((samples.length + pad - frame) / hop) + 1);
  const window = new Float64Array(frame);
  for (let i = 0; i < frame; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frame - 1));
  const edges = bandEdges(rate, frame);
  const bands = edges.length - 1;
  const lowBands = Math.max(1, edges.findIndex((bin) => (bin * rate) / frame >= LOW_HZ));
  const re = new Float64Array(frame);
  const im = new Float64Array(frame);
  let previous = new Float64Array(bands);
  const flux = new Float32Array(frames);
  const low = new Float32Array(frames);
  for (let k = 0; k < frames; k++) {
    const start = k * hop - pad;
    for (let i = 0; i < frame; i++) {
      const j = start + i;
      re[i] = (j >= 0 && j < samples.length ? samples[j] : 0) * window[i];
      im[i] = 0;
    }
    fft(re, im);
    const current = new Float64Array(bands);
    let sum = 0;
    let lowSum = 0;
    for (let b = 0; b < bands; b++) {
      let energy = 0;
      for (let bin = edges[b]; bin < edges[b + 1]; bin++) energy += re[bin] * re[bin] + im[bin] * im[bin];
      current[b] = Math.log1p(20 * Math.sqrt(energy));
      const rise = current[b] - previous[b];
      if (rise > 0) {
        sum += rise;
        if (b < lowBands) lowSum += rise;
      }
    }
    flux[k] = sum;
    low[k] = lowSum;
    previous = current;
  }
  return { flux: smooth(flux), low: smooth(low), hopTime: hop / rate, frames, offsetTime: (frame * 0.75 - pad) / rate };
}

function smooth(values) {
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) out[i] = (values[i - 1] ?? values[i]) * 0.25 + values[i] * 0.5 + (values[i + 1] ?? values[i]) * 0.25;
  return out;
}

/** Removes the local mean (about half a second) and keeps only the positive part: a novelty curve. */
export function novelty(flux, hopTime) {
  const radius = Math.max(1, Math.round(0.5 / hopTime));
  const out = new Float32Array(flux.length);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < Math.min(flux.length, radius); i++) {
    sum += flux[i];
    count++;
  }
  for (let i = 0; i < flux.length; i++) {
    if (i + radius < flux.length) {
      sum += flux[i + radius];
      count++;
    }
    if (i - radius - 1 >= 0) {
      sum -= flux[i - radius - 1];
      count--;
    }
    out[i] = Math.max(0, flux[i] - sum / count);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tempo and phase
// ---------------------------------------------------------------------------

/** A mild preference for 100–140 BPM: 1 inside the band, falling with the distance in octaves. */
export function tempoPrior(bpm) {
  const distance = bpm < 100 ? Math.log2(100 / bpm) : bpm > 140 ? Math.log2(bpm / 140) : 0;
  return Math.exp(-0.5 * (distance / 0.7) ** 2);
}

const interpolate = (values, x) => {
  const i = Math.floor(x);
  if (i < 0 || i + 1 >= values.length) return i >= 0 && i < values.length ? values[i] : 0;
  const f = x - i;
  return values[i] * (1 - f) + values[i + 1] * f;
};

/** Mean of the curve sampled every `period` frames from `phase`. */
function gridMean(nov, period, phase) {
  let sum = 0;
  let count = 0;
  for (let t = phase; t < nov.length; t += period) {
    sum += interpolate(nov, t);
    count++;
  }
  return count ? sum / count : 0;
}

/** The phase (in frames, within one period) whose beat positions collect the most novelty, and that mean. */
export function bestPhase(nov, period) {
  let best = { phase: 0, score: -1 };
  for (let phase = 0; phase < period; phase += 0.25) {
    const score = gridMean(nov, period, phase);
    if (score > best.score) best = { phase, score };
  }
  return best;
}

/** Autocorrelation of the novelty curve over the lags of a BPM range. */
function autocorrelation(nov, lagMin, lagMax) {
  const n = nov.length;
  let energy = 0;
  for (let i = 0; i < n; i++) energy += nov[i] * nov[i];
  const ac = new Float64Array(lagMax + 1);
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < n; i++) sum += nov[i] * nov[i + lag];
    ac[lag] = energy ? sum / energy / (1 - lag / n) : 0;
  }
  return ac;
}

/**
 * Tempo estimate: autocorrelation peaks (with the prior) give candidates; each
 * candidate, its double and its half are refined by how well a beat grid at that
 * tempo lands on strong onsets; the best grid wins. When the midpoints between the
 * winner's beats carry onsets almost as strong as the beats, the tempo is doubled.
 */
export function estimateTempo(nov, hopTime, { bpmMin = 60, bpmMax = 200, forced = null } = {}) {
  const meanNovelty = nov.reduce((a, b) => a + b, 0) / Math.max(1, nov.length) || 1e-9;
  const refine = (bpm, spread) => {
    let best = null;
    const lo = bpm * (1 - spread);
    const hi = bpm * (1 + spread);
    const steps = Math.max(1, Math.round((hi - lo) / 0.1));
    for (let i = 0; i <= steps; i++) {
      const candidate = lo + ((hi - lo) * i) / steps;
      const period = 60 / candidate / hopTime;
      if (period < 2 || period > nov.length / 2) continue;
      const { phase, score } = bestPhase(nov, period);
      const value = score / meanNovelty;
      if (!best || value > best.value) best = { bpm: candidate, phase, value };
    }
    return best;
  };
  if (forced) {
    const best = refine(forced, 0.01) ?? { bpm: forced, phase: 0, value: 1 };
    return { bpm: best.bpm, phase: best.phase, alignment: best.value, confidence: clamp((best.value - 1) / 3), candidates: [round(best.bpm, 2)] };
  }
  const lagMin = Math.max(2, Math.floor(60 / bpmMax / hopTime));
  const lagMax = Math.min(Math.floor(nov.length / 2), Math.ceil(60 / bpmMin / hopTime));
  if (lagMax <= lagMin) throw new AppError("audio_too_short", "O áudio é curto demais para achar o andamento.", "Use um trecho com pelo menos alguns segundos de música.");
  const ac = autocorrelation(nov, lagMin, lagMax);
  const weighted = new Float64Array(lagMax + 1);
  let acMean = 0;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    weighted[lag] = ac[lag] * tempoPrior(60 / (lag * hopTime));
    acMean += weighted[lag];
  }
  acMean /= lagMax - lagMin + 1 || 1;
  const peaks = [];
  for (let lag = lagMin + 1; lag < lagMax; lag++) {
    if (weighted[lag] > weighted[lag - 1] && weighted[lag] >= weighted[lag + 1]) {
      const d = weighted[lag - 1] - weighted[lag + 1];
      const denom = weighted[lag - 1] - 2 * weighted[lag] + weighted[lag + 1];
      peaks.push({ lag: lag + (denom ? (0.5 * d) / denom : 0), value: weighted[lag] }); // parabolic refinement
    }
  }
  peaks.sort((a, b) => b.value - a.value);
  const seeds = new Set();
  for (const peak of peaks.slice(0, 5)) {
    const bpm = 60 / (peak.lag * hopTime);
    for (const factor of [1, 2, 0.5]) {
      const candidate = bpm * factor;
      if (candidate >= bpmMin && candidate <= bpmMax) seeds.add(round(candidate, 1));
    }
  }
  if (!seeds.size) seeds.add(120);
  let best = null;
  const candidates = [];
  for (const seed of seeds) {
    const refined = refine(seed, 0.03);
    if (!refined) continue;
    const score = refined.value * Math.sqrt(tempoPrior(refined.bpm));
    candidates.push(round(refined.bpm, 2));
    if (!best || score > best.score) best = { ...refined, score };
  }
  if (!best) throw new AppError("no_beats", "Não encontrei um andamento neste áudio.", "O arquivo pode ser silêncio ou fala sem ritmo.");
  // octave choice inside the winner's family (half, same, double): the member nearest
  // the usual range wins unless the onsets argue strongly for another reading —
  // halving needs clearly weaker alternate beats, doubling needs real onsets between beats
  const octavePrior = (bpm) => Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.6) ** 2);
  const family = [best];
  if (best.bpm / 2 >= bpmMin) {
    const slower = refine(best.bpm / 2, 0.02);
    if (slower && slower.value >= 1.2 * best.value) family.push(slower);
  }
  if (best.bpm * 2 <= bpmMax) {
    const faster = refine(best.bpm * 2, 0.02);
    if (faster && faster.value >= 0.55 * best.value) family.push(faster);
  }
  const chosen = family.reduce((a, b) => (b.value * octavePrior(b.bpm) > a.value * octavePrior(a.bpm) ? b : a));
  best = { ...chosen, score: best.score };
  const prominence = acMean > 0 ? (peaks[0]?.value ?? 0) / acMean : 0;
  const confidence = clamp(0.5 * clamp((best.value - 1) / 3) + 0.5 * clamp((prominence - 1) / 3));
  return { bpm: best.bpm, phase: best.phase, alignment: best.value, confidence, candidates };
}

// ---------------------------------------------------------------------------
// The analysis
// ---------------------------------------------------------------------------

/** Accents: peaks of the onset curve clearly above their surroundings, at most about four per second. */
export function pickHits(flux, hopTime, offsetTime, { minGap = 0.25 } = {}) {
  const radius = Math.max(1, Math.round(1 / hopTime));
  const gapFrames = Math.max(1, Math.round(minGap / hopTime));
  let max = 0;
  for (const value of flux) if (value > max) max = value;
  const hits = [];
  let lastIndex = -Infinity;
  for (let i = 1; i < flux.length - 1; i++) {
    if (flux[i] < flux[i - 1] || flux[i] < flux[i + 1]) continue;
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - radius); j < Math.min(flux.length, i + radius); j++) {
      sum += flux[j];
      count++;
    }
    if (flux[i] < (sum / count) * 1.5 + 0.1 * max) continue;
    if (i - lastIndex < gapFrames) {
      if (flux[i] > flux[lastIndex]) {
        hits[hits.length - 1] = i;
        lastIndex = i;
      }
      continue;
    }
    hits.push(i);
    lastIndex = i;
  }
  return hits.map((i) => round(Math.max(0, i * hopTime + offsetTime), 3));
}

/**
 * The beat grid of a mono signal: { bpm, offset, confidence, beats, downbeats,
 * hits, duration, method }. Pass `bpm` to force the tempo and only find the phase.
 */
export function analyzeBeats({ samples, rate }, { bpmMin = 60, bpmMax = 200, bpm = null } = {}) {
  if (!samples || samples.length < rate * 1) throw new AppError("audio_too_short", "O áudio tem menos de um segundo.", "Use um arquivo mais longo.");
  const duration = samples.length / rate;
  let energy = 0;
  for (let i = 0; i < samples.length; i++) energy += samples[i] * samples[i];
  if (Math.sqrt(energy / samples.length) < 1e-4) throw new AppError("silent_audio", "O áudio é silêncio.", "Confira se o arquivo tem som.");
  const { flux, low, hopTime, offsetTime } = onsetEnvelope(samples, rate);
  const wide = novelty(flux, hopTime);
  const lowNovelty = novelty(low, hopTime);
  // kicks anchor the pulse: the low band counts extra when choosing tempo and phase
  const nov = new Float32Array(wide.length);
  for (let i = 0; i < nov.length; i++) nov[i] = wide[i] + LOW_WEIGHT * lowNovelty[i];
  const tempo = estimateTempo(nov, hopTime, { bpmMin, bpmMax, forced: bpm });
  const period = 60 / tempo.bpm;
  let offset = tempo.phase * hopTime + offsetTime;
  while (offset - period >= -0.03) offset -= period; // a beat right at the start counts, within 30 ms
  offset = Math.max(0, offset);
  const beats = [];
  for (let t = offset; t < duration - 1e-6; t += period) beats.push(round(t, 3));
  // downbeats: the one of four phases whose beats carry the most onsets, kicks counting extra
  let bestPhaseIndex = 0;
  let bestLow = -1;
  for (let phase = 0; phase < 4; phase++) {
    let sum = 0;
    for (let k = phase; k < beats.length; k += 4) sum += interpolate(nov, (beats[k] - offsetTime) / hopTime);
    if (sum > bestLow) {
      bestLow = sum;
      bestPhaseIndex = phase;
    }
  }
  return {
    bpm: round(tempo.bpm, 2),
    offset: round(offset, 3),
    confidence: round(tempo.confidence, 2),
    beats,
    downbeats: beats.filter((_, k) => k % 4 === bestPhaseIndex),
    hits: pickHits(flux, hopTime, offsetTime),
    duration: round(duration, 3),
    method: "onset-autocorrelation",
    candidates: tempo.candidates,
  };
}
