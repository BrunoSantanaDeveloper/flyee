// Synthesized interface and motion sounds: short, clean cues placed on a timeline.
// Nothing here is sampled; every cue comes from oscillators, noise and envelopes,
// so the same list of cues gives the same file on every machine.

import { AppError, clamp, parseTime, seededRandom } from "../util.mjs";
import { addInto, addMono, adsr, dbToGain, decayEnvelope, highPass, interleave, lowPass, multiply, noise, oscillator, stereoBus, svf } from "./wav.mjs";
import { bell, impact } from "./music.mjs";

export const RATE = 48000;

/** Every cue type with a one-line description for help and documents. */
export const CUE_TYPES = [
  { type: "click", description: "Clique de interface, seco e curto (cerca de 50 ms)." },
  { type: "tick", description: "Tique leve, mais fino que o clique." },
  { type: "pop", description: "Estouro de bolha, redondo e curto." },
  { type: "whoosh", description: "Varredura de ar (cerca de 300 ms); pan dá a direção, de um lado ao outro." },
  { type: "swoosh", description: "Varredura mais leve e rápida que o whoosh." },
  { type: "thump", description: "Batida grave e seca." },
  { type: "impact", description: "Impacto grande, com grave e ruído." },
  { type: "ding", description: "Sino curto e claro." },
  { type: "riser", description: "Subida de tensão (ruído e tom subindo) ao longo de duration; padrão 1 s." },
  { type: "typing", description: "Rajada de teclas suaves ao longo de duration; count (ou o tamanho de text) dá o número de teclas." },
  { type: "success", description: "Duas notas de sino em acorde maior." },
  { type: "notify", description: "Um toque suave de aviso." },
];

const TYPE_SET = new Set(CUE_TYPES.map((cue) => cue.type));
const seconds = (s) => Math.max(1, Math.round(s * RATE));
const semitones = (pitch) => 2 ** ((pitch || 0) / 12);

/** `"0.5:click,1.2:whoosh"` → cues. Inline, the time is in seconds (the colon separates it from the type). */
export function parseCueList(text) {
  return String(text ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [t, type, ...rest] = item.split(":").map((part) => part.trim());
      if (!t || !type) throw new AppError("cues_invalid", `Cue inválida: "${item}".`, "Use tempo:tipo, por exemplo 0.5:click,1.2:whoosh.");
      if (rest.length) throw new AppError("cues_invalid", `Cue inválida: "${item}".`, "Na lista em linha, o tempo vai em segundos (por exemplo 75.5:click), porque os dois-pontos separam o tempo do tipo; mm:ss só vale no arquivo de cues.");
      return { t: parseTime(t), type };
    });
}

/** Validates a list of cues (from JSON or inline) and fills the defaults. */
export function normalizeCues(input) {
  const list = Array.isArray(input) ? input : Array.isArray(input?.cues) ? input.cues : null;
  if (!list) throw new AppError("cues_invalid", "A lista de cues precisa ser um array (ou um objeto com a chave cues).", 'Exemplo: [{ "t": 0.5, "type": "click" }].');
  if (!list.length) throw new AppError("cues_invalid", "A lista de cues está vazia.");
  return list.map((cue, index) => {
    if (!cue || typeof cue !== "object") throw new AppError("cues_invalid", `A cue ${index + 1} não é um objeto.`);
    const t = typeof cue.t === "number" ? cue.t : cue.t !== undefined ? parseTime(cue.t) : NaN;
    if (!Number.isFinite(t) || t < 0) throw new AppError("cues_invalid", `A cue ${index + 1} precisa de um tempo t em segundos.`);
    if (!TYPE_SET.has(cue.type)) throw new AppError("cues_invalid", `Tipo de cue desconhecido na cue ${index + 1}: ${cue.type}.`, `Tipos: ${CUE_TYPES.map((c) => c.type).join(", ")}.`);
    const num = (value, name, fallback, min, max) => {
      if (value === undefined || value === null) return fallback;
      const n = Number(value);
      if (!Number.isFinite(n) || n < min || n > max) throw new AppError("cues_invalid", `Valor inválido de ${name} na cue ${index + 1}: ${value}.`, `Use um número entre ${min} e ${max}.`);
      return n;
    };
    const count = cue.count !== undefined ? num(cue.count, "count", null, 1, 400) : typeof cue.text === "string" ? clamp(cue.text.length, 1, 400) : null;
    return {
      t,
      type: cue.type,
      gain: num(cue.gain, "gain", 0, -60, 12),
      pitch: num(cue.pitch, "pitch", 0, -24, 24),
      duration: cue.duration !== undefined ? num(cue.duration, "duration", null, 0.05, 30) : null,
      pan: num(cue.pan, "pan", 0, -1, 1),
      count,
    };
  });
}

/** The length in seconds a cue occupies, used to size the output when no duration is given. */
export function cueLength(cue) {
  switch (cue.type) {
    case "riser": return cue.duration ?? 1;
    case "typing": return cue.duration ?? Math.min(8, 0.08 * (cue.count ?? 12));
    case "whoosh": return cue.duration ?? 0.32;
    case "swoosh": return cue.duration ?? 0.2;
    case "impact": return 1.4;
    case "ding": return 1.2;
    case "success": return 1.3;
    case "notify": return 0.9;
    case "thump": return 0.35;
    default: return 0.1;
  }
}

// ---------------------------------------------------------------------------
// The sounds (mono unless noted)
// ---------------------------------------------------------------------------

function click(rng, pitch) {
  const body = multiply(oscillator(RATE, { wave: "sine", freq: 1800 * semitones(pitch), length: seconds(0.05) }), decayEnvelope(RATE, 0.05, { curve: 8 }));
  const transient = multiply(highPass(noise(seconds(0.004), rng), RATE, 3000), decayEnvelope(RATE, 0.004));
  addInto(body, transient, 0, 0.6);
  return body;
}

function tick(rng, pitch) {
  const body = multiply(oscillator(RATE, { wave: "sine", freq: 3200 * semitones(pitch), length: seconds(0.025) }), decayEnvelope(RATE, 0.025, { curve: 9 }));
  addInto(body, multiply(highPass(noise(seconds(0.002), rng), RATE, 5000), decayEnvelope(RATE, 0.002)), 0, 0.35);
  return body.map((x) => x * 0.7);
}

function pop(pitch) {
  const n = seconds(0.09);
  const base = 420 * semitones(pitch);
  const tone = oscillator(RATE, { wave: "sine", length: n, freq: (i) => base * (1 + 1.2 * Math.exp(-i / RATE / 0.012)) });
  return multiply(tone, decayEnvelope(RATE, 0.09, { curve: 7 }));
}

/** Noise through a band-pass that sweeps up then down; the pan slides from -pan to +pan. */
function whoosh(rng, { duration = 0.32, pitch = 0, light = false }) {
  const n = seconds(duration);
  const centre = (light ? 2400 : 1200) * semitones(pitch);
  const swept = svf(noise(n, rng, { color: light ? "white" : "pink" }), RATE, { cutoff: (p) => centre * 2 ** (1.5 * Math.sin(Math.PI * p)), resonance: 0.6, mode: "band" });
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i / n;
    out[i] = swept[i] * Math.sin(Math.PI * p) ** (light ? 1.4 : 0.9) * (light ? 2.2 : 3);
  }
  return out;
}

function thump(pitch) {
  const n = seconds(0.35);
  const base = 55 * semitones(pitch);
  const tone = oscillator(RATE, { wave: "sine", length: n, freq: (i) => base + 90 * Math.exp(-i / RATE / 0.03) });
  return multiply(tone, decayEnvelope(RATE, 0.35, { curve: 7 }));
}

function ding(pitch) {
  return bell(1760 * semitones(pitch), 1.2).map((x) => x * 1.2);
}

function riser(rng, { duration = 1, pitch = 0 }) {
  const n = seconds(duration);
  const sweep = svf(noise(n, rng), RATE, { cutoff: (p) => 300 * 2 ** (p * 5), resonance: 0.5, mode: "band" });
  const base = 110 * semitones(pitch);
  const tone = oscillator(RATE, { wave: "saw", length: n, freq: (i) => base * 2 ** ((i / n) * 2) });
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i / n;
    out[i] = (sweep[i] * 1.8 + tone[i] * 0.3 * p) * p * p;
  }
  // a short release so the end does not click when nothing follows
  const release = Math.min(n, seconds(0.02));
  for (let i = 0; i < release; i++) out[n - 1 - i] *= i / release;
  return out;
}

/** Soft key presses at slightly irregular intervals, each a filtered click with its own pitch. */
function typing(rng, { duration, count }) {
  const keys = count ?? 12;
  const total = duration ?? Math.min(8, 0.08 * keys);
  const out = new Float32Array(seconds(total + 0.08));
  const step = total / keys;
  for (let k = 0; k < keys; k++) {
    const t = Math.min(total, k * step + (rng() - 0.5) * step * 0.6);
    const key = multiply(lowPass(highPass(noise(seconds(0.03), rng), RATE, 800), RATE, 4000 + rng() * 3000), decayEnvelope(RATE, 0.03, { curve: 8 }));
    const thock = multiply(oscillator(RATE, { wave: "sine", freq: 180 + rng() * 80, length: seconds(0.03) }), decayEnvelope(RATE, 0.03));
    addInto(out, key, seconds(t), 0.8 + rng() * 0.4);
    addInto(out, thock, seconds(t), 0.3);
  }
  return out;
}

function chime(freqs, spacing, length) {
  const out = new Float32Array(seconds(length + spacing * (freqs.length - 1)));
  freqs.forEach((freq, index) => {
    const env = adsr(RATE, { attack: 0.004, decay: 0.3, sustain: 0.25, release: length - 0.3 }, 0.3);
    const tone = oscillator(RATE, { wave: "sine", freq, length: env.length });
    const shine = oscillator(RATE, { wave: "sine", freq: freq * 3, length: env.length });
    const note = new Float32Array(env.length);
    for (let i = 0; i < env.length; i++) note[i] = (tone[i] + 0.18 * shine[i] * Math.exp(-i / RATE / 0.15)) * env[i];
    addInto(out, note, seconds(spacing * index), 0.55);
  });
  return out;
}

const success = (pitch) => chime([659.25 * semitones(pitch), 987.77 * semitones(pitch)], 0.14, 1);
const notify = (pitch) => chime([880 * semitones(pitch)], 0, 0.8);

function render(cue, rng) {
  switch (cue.type) {
    case "click": return click(rng, cue.pitch);
    case "tick": return tick(rng, cue.pitch);
    case "pop": return pop(cue.pitch);
    case "whoosh": return whoosh(rng, { duration: cue.duration ?? 0.32, pitch: cue.pitch });
    case "swoosh": return whoosh(rng, { duration: cue.duration ?? 0.2, pitch: cue.pitch, light: true });
    case "thump": return thump(cue.pitch);
    case "impact": return impact({ rng, tail: 1.4, size: 1 });
    case "ding": return ding(cue.pitch);
    case "riser": return riser(rng, { duration: cue.duration ?? 1, pitch: cue.pitch });
    case "typing": return typing(rng, { duration: cue.duration, count: cue.count });
    case "success": return success(cue.pitch);
    case "notify": return notify(cue.pitch);
    default: throw new AppError("cues_invalid", `Tipo de cue desconhecido: ${cue.type}.`);
  }
}

/**
 * Renders cues onto a stereo timeline. `duration` fixes the length (cues past it
 * are cut); without it the file ends 0.3 s after the last cue. Overlapping cues
 * sum; the level is kept clip-safe by the soft limiter when the file is written.
 */
export function synthesizeSfx(cues, { duration = null, seed = 1 } = {}) {
  const list = normalizeCues(cues);
  const total = duration ?? Math.max(...list.map((cue) => cue.t + cueLength(cue))) + 0.3;
  const frames = seconds(total);
  const bus = stereoBus(frames);
  list.forEach((cue, index) => {
    const rng = seededRandom(seed * 101 + index * 17 + cue.type.length);
    const mono = render(cue, rng);
    const gain = dbToGain(cue.gain) * 0.8;
    const start = Math.round(cue.t * RATE);
    if (cue.type === "whoosh" || cue.type === "swoosh") {
      // a moving pan: the sound travels from -pan to +pan across its length
      const from = -cue.pan;
      const to = cue.pan;
      for (let i = 0; i < mono.length; i++) {
        const j = start + i;
        if (j >= frames) break;
        const pan = from + (to - from) * (i / mono.length);
        const angle = ((pan + 1) * Math.PI) / 4;
        bus.left[j] += mono[i] * gain * Math.cos(angle);
        bus.right[j] += mono[i] * gain * Math.sin(angle);
      }
    } else addMono(bus, mono, start, { gain, pan: cue.pan });
  });
  return { samples: interleave(bus.left, bus.right), rate: RATE, channels: 2, duration: frames / RATE, cues: list };
}
