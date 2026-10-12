// A generative composer: a short, clean, modern piece under a product video, built
// from oscillators, envelopes and filters with no samples. The same seed gives the
// same bytes everywhere. The piece follows an arc (intro → build → drop → outro,
// with a final hit on the last downbeat and a tail that dies before the end) and
// ships its own beat grid, so cuts and motion can land on the music.

import { AppError, clamp, round, seededRandom } from "../util.mjs";
import {
  addInto,
  addMono,
  addStereo,
  adsr,
  dbToGain,
  decayEnvelope,
  echo,
  highPass,
  interleave,
  lowPass,
  multiply,
  noise,
  oscillator,
  peak,
  rms,
  softClip,
  stereoBus,
  svf,
} from "./wav.mjs";

export const RATE = 48000;
const STEPS = 16; // 16th notes per bar
const BEATS_PER_BAR = 4;

// ---------------------------------------------------------------------------
// Theory: keys, scales, chords
// ---------------------------------------------------------------------------

const NOTE_INDEX = { C: 0, "C#": 1, DB: 1, D: 2, "D#": 3, EB: 3, E: 4, F: 5, "F#": 6, GB: 6, G: 7, "G#": 8, AB: 8, A: 9, "A#": 10, BB: 10, B: 11 };
const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const ROMAN = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };

/** "C", "Am", "F#m", "Bb" → { root, mode, name }; "auto" → null. */
export function parseKey(text) {
  if (text === undefined || text === null || String(text).toLowerCase() === "auto") return null;
  const m = /^([A-Ga-g][#b]?)(m|min|minor|M|maj|major)?$/.exec(String(text).trim());
  const root = m ? NOTE_INDEX[m[1].toUpperCase()] : undefined;
  if (!m || root === undefined) throw new AppError("usage", `Tom inválido: ${text}.`, "Use C, Am, F#m, Bb, Ebm… ou auto.");
  const mode = m[2] && /^m(in|inor)?$/.test(m[2]) ? "minor" : "major";
  return keyOf(root, mode);
}

export const keyOf = (root, mode) => ({ root, mode, name: `${NOTE_NAMES[root]}${mode === "minor" ? "m" : ""}` });

/** A roman numeral ("vi", "VII", "i") → { degree, quality } in the key's scale. */
function parseRoman(numeral) {
  const quality = numeral === numeral.toUpperCase() ? "maj" : "min";
  return { degree: ROMAN[numeral.toUpperCase()], quality };
}

/** Triad (or seventh chord) of a degree as MIDI notes near `octave` (C4 = 60). */
export function chordNotes(key, numeral, { octave = 4, seventh = false } = {}) {
  const scale = key.mode === "minor" ? MINOR : MAJOR;
  const { degree, quality } = parseRoman(numeral);
  const rootMidi = 12 * (octave + 1) + key.root + scale[degree];
  const notes = [rootMidi, rootMidi + (quality === "maj" ? 4 : 3), rootMidi + 7];
  if (seventh) notes.push(rootMidi + (quality === "maj" && degree !== 4 ? 11 : 10)); // V gets a dominant 7th
  return notes;
}

/** The key's pentatonic, for melodies that never clash with the chords. */
export function pentatonic(key, octave = 5) {
  const steps = key.mode === "minor" ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
  return steps.map((s) => 12 * (octave + 1) + key.root + s);
}

export const midiToFreq = (midi) => 440 * 2 ** ((midi - 69) / 12);

/** Moves a MIDI note into [low, low + 12). */
const intoOctave = (midi, low) => ((((midi - low) % 12) + 12) % 12) + low;

// ---------------------------------------------------------------------------
// Styles: palette, patterns and harmony
// ---------------------------------------------------------------------------

export const STYLES = {
  clean: { description: "Filme de interface: bumbo macio, chimbal, grave sub, pad quente e arpejos de corda.", minorChance: 0.5, swing: 0, pump: 0.35, major: [["I", "V", "vi", "IV"], ["vi", "IV", "I", "V"], ["I", "iii", "vi", "IV"]], minor: [["i", "VI", "III", "VII"], ["i", "VII", "VI", "VII"]] },
  energetic: { description: "Showreel: bumbo em todo tempo, palmas no 2 e 4, baixo puxado e acordes de sintetizador.", minorChance: 0.45, swing: 0, pump: 0.5, major: [["I", "V", "vi", "IV"], ["vi", "IV", "I", "V"]], minor: [["i", "VI", "III", "VII"], ["i", "iv", "VI", "V"]] },
  warm: { description: "Lo-fi: bateria leve com balanço, acordes macios de piano elétrico e um chiado gentil.", minorChance: 0.5, swing: 0.14, pump: 0.12, major: [["I", "vi", "ii", "V"], ["IV", "iii", "vi", "I"]], minor: [["i", "iv", "VII", "III"], ["i", "VI", "iv", "v"]] },
  minimal: { description: "Muito esparso: um pulso, um pad e poucas notas, com bastante ar.", minorChance: 0.5, swing: 0, pump: 0.2, major: [["I", "vi", "IV", "I"], ["I", "IV", "vi", "IV"]], minor: [["i", "VI", "i", "VII"], ["i", "iv", "VI", "i"]] },
  cinematic: { description: "Trailer: ondas lentas, subida de tensão, pancada grave na virada, sem batida dançante.", minorChance: 0.85, swing: 0, pump: 0, major: [["I", "V", "vi", "IV"]], minor: [["i", "VI", "III", "VII"], ["i", "iv", "i", "VI"], ["i", "VII", "VI", "v"]] },
  playful: { description: "Leve e saltitante: baixo pulado, melodia de corda brilhante e percussão miúda.", minorChance: 0.1, swing: 0.06, pump: 0.3, major: [["I", "IV", "V", "IV"], ["I", "vi", "IV", "V"], ["I", "V", "IV", "V"]], minor: [["i", "VI", "VII", "VI"]] },
};

export const STYLE_NAMES = Object.keys(STYLES);

/** Step patterns per style and section role: "x" = hit, "o" = soft, "." = rest; 16 steps per bar. */
const PATTERNS = {
  clean: {
    intro: { kick: "x...............", hat: "..o...o...o...o." },
    build: { kick: "x.......x.......", hat: "x.o.x.o.x.o.x.o." },
    drop: { kick: "x...x...x...x...", hat: "o.x.o.x.o.x.o.x.", tick: "....x.......x...", open: "..............x." },
    outro: { kick: "x...............", hat: "..o...o...o...o." },
    bed: { kick: "x.......x.......", hat: "o.x.o.x.o.x.o.x." },
  },
  energetic: {
    intro: { kick: "x.......x.......", hat: "..o...o...o...o." },
    build: { kick: "x...x...x...x...", clap: "....x.......x...", hat: "x.o.x.o.x.o.x.o." },
    drop: { kick: "x...x...x...x...", clap: "....x.......x...", hat: "xoxoxoxoxoxoxoxo", open: "..x...x...x...x." },
    outro: { kick: "x.......x.......", hat: "..o...o...o...o." },
    bed: { kick: "x...x...x...x...", clap: "....x.......x...", hat: "x.o.x.o.x.o.x.o." },
  },
  warm: {
    intro: {},
    build: { kick: "x......x..x.....", snare: "....x.......x...", hat: "o.o.o.o.o.o.o.o." },
    drop: { kick: "x......x..x.....", snare: "....x.......x...", hat: "x.o.x.o.x.o.x.oo" },
    outro: { kick: "x...............", hat: "..o...o...o...o." },
    bed: { kick: "x......x..x.....", snare: "....x.......x...", hat: "o.o.o.o.o.o.o.o." },
  },
  minimal: {
    intro: { pulse: "x.......x......." },
    build: { pulse: "x...x...x...x..." },
    drop: { pulse: "x...x...x...x...", hat: "..o...o...o...o." },
    outro: { pulse: "x..............." },
    bed: { pulse: "x...x...x...x...", hat: "..o...o...o...o." },
  },
  cinematic: {
    intro: { tick: "x.x.x.x.x.x.x.x." },
    build: { tick: "x.x.x.x.x.x.x.x.", tom: "x.......x......." },
    drop: { tom: "x.......x.....x.", tick: "x.o.x.o.x.o.x.o." },
    outro: { tom: "x...............", tick: "x...x...x...x..." },
    bed: { tick: "x.x.x.x.x.x.x.x.", tom: "x.......x......." },
  },
  playful: {
    intro: { shaker: "..o...o...o...o." },
    build: { kick: "x.......x.......", rim: "....x.......x...", shaker: "x.o.x.o.x.o.x.o." },
    drop: { kick: "x...x...x...x...", rim: "....x.......x...", shaker: "xoxoxoxoxoxoxoxo" },
    outro: { shaker: "x.o.x.o.x.o.x.o." },
    bed: { kick: "x.......x.......", rim: "....x.......x...", shaker: "x.o.x.o.x.o.x.o." },
  },
};

const BASS_STEPS = { clean: "x.......x.......", energetic: "x.x.x.x.x.x.x.x.", warm: "x......x........", minimal: "x...............", cinematic: "x...............", playful: "x..x..x.x..x..x." };

// ---------------------------------------------------------------------------
// Form: bars per section, times of the drop and the final hit
// ---------------------------------------------------------------------------

/**
 * Whole-bar sections for a duration. Without a loop the piece ends with a hit on
 * the last downbeat that still leaves a tail (≥ 0.5 s) before `duration`; with a
 * loop the grid fills the whole duration and the last bar leads back to the first.
 */
export function planSections({ duration, bpm, arc = "auto", loop = false }) {
  const beatLen = 60 / bpm;
  const barLen = beatLen * BEATS_PER_BAR;
  const bars = loop ? Math.max(1, Math.round(duration / barLen)) : Math.floor((duration - 0.5) / barLen);
  const hitTime = loop ? null : bars * barLen;
  const end = loop ? duration : hitTime;
  const at = (bar) => round(Math.min(bar * barLen, end), 4);
  const sections = [];
  const push = (name, fromBar, toBar) => {
    if (toBar > fromBar) sections.push({ name, start: at(fromBar), end: at(toBar), bars: toBar - fromBar, startBar: fromBar });
  };
  let drop = null;
  if (arc === "flat") push("bed", 0, bars);
  else if (bars <= 4) {
    push("build", 0, bars);
    drop = hitTime;
  } else {
    // the drop lands around 45% of the bars on short pieces and 60% on long ones
    const fraction = 0.45 + 0.15 * clamp((bars - 10) / 14);
    const dropBar = Math.round(bars * fraction);
    const outro = bars > 10 ? Math.max(1, Math.round(bars * 0.12)) : 1;
    const intro = Math.max(1, Math.floor(dropBar / 2));
    const build = Math.max(1, dropBar - intro);
    push("intro", 0, intro);
    push("build", intro, intro + build);
    push("drop", intro + build, bars - outro);
    push("outro", bars - outro, bars);
    drop = at(intro + build);
  }
  if (!loop) sections.push({ name: "tail", start: round(hitTime, 4), end: round(duration, 4), bars: 0, startBar: bars });
  return { beatLen, barLen, bars, hitTime, drop, sections };
}

// ---------------------------------------------------------------------------
// Instruments (mono buffers, 48 kHz; pads and risers are stereo pairs)
// ---------------------------------------------------------------------------

const seconds = (s) => Math.max(1, Math.round(s * RATE));

/** A sine whose pitch falls from `from` to `to` Hz: kicks, toms, impacts. */
function pitchDrop(length, from, to, tau) {
  return oscillator(RATE, { wave: "sine", length, freq: (i) => to + (from - to) * Math.exp(-i / RATE / tau) });
}

export function kick({ soft = false, pitch = 48, decay = 0.38, click = 0.6, rng }) {
  const length = seconds(decay + 0.05);
  const body = multiply(pitchDrop(length, soft ? 110 : 170, pitch, soft ? 0.02 : 0.028), decayEnvelope(RATE, decay + 0.05, { curve: 7.5 }));
  const transient = multiply(highPass(noise(seconds(0.004), rng), RATE, 2000), decayEnvelope(RATE, 0.004));
  addInto(body, transient, 0, click * (soft ? 0.25 : 0.6));
  return softClipBuffer(body, 1.4);
}

export function snare({ rng, decay = 0.18, lofi = false }) {
  const length = seconds(decay + 0.02);
  const tone = multiply(pitchDrop(length, 260, 180, 0.03), decayEnvelope(RATE, 0.09));
  let hiss = multiply(highPass(noise(length, rng), RATE, lofi ? 900 : 1500), decayEnvelope(RATE, decay + 0.02));
  if (lofi) hiss = lowPass(hiss, RATE, 4500);
  addInto(tone, hiss, 0, 0.9);
  return tone;
}

export function clap({ rng }) {
  const out = new Float32Array(seconds(0.22));
  for (let i = 0; i < 3; i++) addInto(out, multiply(noise(seconds(0.012), rng), decayEnvelope(RATE, 0.012)), seconds(0.011 * i), 0.7);
  addInto(out, multiply(noise(seconds(0.18), rng), decayEnvelope(RATE, 0.18)), seconds(0.03), 0.6);
  return svf(out, RATE, { cutoff: 1400, resonance: 0.55, mode: "band" }).map((x) => x * 2.4);
}

export function hat({ rng, open = false, decay = open ? 0.28 : 0.045 }) {
  const body = svf(noise(seconds(decay), rng), RATE, { cutoff: 7500, resonance: 0.2, mode: "high" });
  return multiply(body, decayEnvelope(RATE, decay, { curve: open ? 5 : 8 }));
}

export function shaker({ rng }) {
  const body = svf(noise(seconds(0.07), rng), RATE, { cutoff: 6000, resonance: 0.5, mode: "band" });
  const env = decayEnvelope(RATE, 0.07, { curve: 5 });
  for (let i = 0; i < Math.min(200, env.length); i++) env[i] *= i / 200; // soft attack: a shaker, not a click
  return multiply(body, env).map((x) => x * 1.5);
}

/** Short tonal taps: "tick" (high, dry), "rim" (woody), "pulse" (a round, soft thump). */
export function tap({ kind, rng }) {
  if (kind === "pulse") return multiply(pitchDrop(seconds(0.16), 90, 55, 0.02), decayEnvelope(RATE, 0.16)).map((x) => x * 0.9);
  const freq = kind === "rim" ? 820 : 2600;
  const body = multiply(oscillator(RATE, { wave: "sine", freq, length: seconds(0.035) }), decayEnvelope(RATE, 0.035));
  const transient = multiply(highPass(noise(seconds(0.006), rng), RATE, 3000), decayEnvelope(RATE, 0.006));
  addInto(body, transient, 0, kind === "rim" ? 0.5 : 0.3);
  return body;
}

export function tom({ rng }) {
  const body = multiply(pitchDrop(seconds(0.55), 95, 52, 0.06), decayEnvelope(RATE, 0.55, { curve: 6 }));
  addInto(body, multiply(lowPass(noise(seconds(0.05), rng), RATE, 600), decayEnvelope(RATE, 0.05)), 0, 0.8);
  return softClipBuffer(body, 1.3);
}

/** A big low hit: sub boom, a noise crack and a cymbal-like wash that decays over `tail` seconds. */
export function impact({ rng, tail = 1.6, size = 1 }) {
  const length = seconds(tail);
  const sub = multiply(pitchDrop(length, 70, 36, 0.09), decayEnvelope(RATE, tail, { curve: 6 }));
  const crack = multiply(svf(noise(seconds(0.12), rng), RATE, { cutoff: (p) => 3500 * (1 - p) + 150, resonance: 0.3 }), decayEnvelope(RATE, 0.12, { curve: 5 }));
  const wash = multiply(highPass(noise(length, rng), RATE, 5000), decayEnvelope(RATE, tail, { curve: 7 }));
  addInto(sub, crack, 0, 0.9 * size);
  addInto(sub, wash, 0, 0.22 * size);
  return softClipBuffer(sub, 1.2);
}

/** Noise and a pitched sweep rising into the drop; stereo, growing from silence. */
export function riser({ rng, length, octaves = 1.5, baseFreq = 110 }) {
  const n = seconds(length);
  const side = () => {
    const sweep = svf(noise(n, rng), RATE, { cutoff: (p) => 250 * 2 ** (p * 5.3), resonance: 0.45, mode: "band" });
    const tone = oscillator(RATE, { wave: "saw", length: n, freq: (i) => baseFreq * 2 ** ((i / n) * octaves) });
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = i / n;
      out[i] = (sweep[i] * 1.6 + tone[i] * 0.25 * (0.5 + 0.5 * p)) * p * p;
    }
    return out;
  };
  return { left: side(), right: side() };
}

/** Sub bass: sine with a little triangle for presence. */
export function subBass(freq, hold) {
  const env = adsr(RATE, { attack: 0.012, decay: 0.1, sustain: 0.85, release: 0.09 }, hold);
  const sine = oscillator(RATE, { wave: "sine", freq, length: env.length });
  const tri = oscillator(RATE, { wave: "triangle", freq, length: env.length });
  for (let i = 0; i < sine.length; i++) sine[i] = (sine[i] + 0.22 * tri[i]) * env[i];
  return sine;
}

/** Driving saw bass with a filter that opens on the attack. */
export function drivingBass(freq, hold) {
  const env = adsr(RATE, { attack: 0.004, decay: 0.16, sustain: 0.5, release: 0.06 }, hold);
  const saw = oscillator(RATE, { wave: "saw", freq, length: env.length });
  const sub = oscillator(RATE, { wave: "sine", freq, length: env.length });
  const filtered = svf(saw, RATE, { cutoff: (p) => 300 + 1400 * Math.exp(-p * 7), resonance: 0.35 });
  for (let i = 0; i < filtered.length; i++) filtered[i] = (filtered[i] * 0.8 + sub[i] * 0.5) * env[i];
  return filtered;
}

/** Bouncy square bass, short and round. */
export function bouncyBass(freq, hold) {
  const env = adsr(RATE, { attack: 0.004, decay: 0.12, sustain: 0.35, release: 0.05 }, hold);
  const square = oscillator(RATE, { wave: "square", freq, length: env.length });
  const sub = oscillator(RATE, { wave: "sine", freq, length: env.length });
  const filtered = svf(square, RATE, { cutoff: (p) => 250 + 1100 * Math.exp(-p * 9), resonance: 0.3 });
  for (let i = 0; i < filtered.length; i++) filtered[i] = (filtered[i] * 0.6 + sub[i] * 0.55) * env[i];
  return filtered;
}

/** Round lo-fi bass: triangle and sine, low-passed. */
export function roundBass(freq, hold) {
  const env = adsr(RATE, { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.12 }, hold);
  const tri = oscillator(RATE, { wave: "triangle", freq, length: env.length });
  const sine = oscillator(RATE, { wave: "sine", freq, length: env.length });
  const filtered = lowPass(tri, RATE, 420);
  for (let i = 0; i < filtered.length; i++) filtered[i] = (filtered[i] * 0.9 + sine[i] * 0.5) * env[i];
  return filtered;
}

/** Karplus-Strong pluck: a seeded noise burst in a feedback loop; `bright` 0..1 sets the tone. */
export function pluck(freq, hold, rng, { bright = 0.5, release = 0.6 } = {}) {
  const period = Math.max(2, Math.round(RATE / freq));
  const length = seconds(hold + release);
  const out = new Float32Array(length);
  const burst = lowPass(noise(period, rng), RATE, 1500 + bright * 7000);
  for (let i = 0; i < period; i++) out[i] = burst[i] * 2;
  const blend = 0.35 + bright * 0.14; // closer to 0.5 keeps the string ringing longer and brighter
  const damp = 0.996;
  for (let i = period; i < length; i++) out[i] = damp * (out[i - period] * blend + out[i - period + 1] * (1 - blend));
  return multiply(out, decayEnvelope(RATE, hold + release, { curve: 4 }));
}

/** Bell: a sine with two inharmonic partials that die faster than the fundamental. */
export function bell(freq, length = 1.4) {
  const n = seconds(length);
  const f = oscillator(RATE, { wave: "sine", freq, length: n });
  const p1 = multiply(oscillator(RATE, { wave: "sine", freq: freq * 2.76, length: n }), decayEnvelope(RATE, length * 0.35));
  const p2 = multiply(oscillator(RATE, { wave: "sine", freq: freq * 5.4, length: n }), decayEnvelope(RATE, length * 0.18));
  const env = decayEnvelope(RATE, length, { curve: 5 });
  for (let i = 0; i < n; i++) f[i] = (f[i] + 0.45 * (i < p1.length ? p1[i] : 0) + 0.2 * (i < p2.length ? p2[i] : 0)) * env[i] * 0.6;
  return f;
}

/** Electric-piano note: sine plus a soft second partial and a gentle vibrato. */
export function epNote(freq, hold) {
  const env = adsr(RATE, { attack: 0.015, decay: 0.7, sustain: 0.35, release: 0.45 }, hold);
  const n = env.length;
  const vib = (i) => freq * (1 + 0.0025 * Math.sin((2 * Math.PI * 5.2 * i) / RATE));
  const f = oscillator(RATE, { wave: "sine", length: n, freq: vib });
  const p = multiply(oscillator(RATE, { wave: "sine", length: n, freq: (i) => vib(i) * 2 }), decayEnvelope(RATE, n / RATE, { curve: 3 }));
  for (let i = 0; i < n; i++) f[i] = (f[i] + 0.35 * p[i]) * env[i];
  return f;
}

/**
 * A pad chord as a stereo pair: each note is two detuned saws (or triangles), one
 * per side, through a slow low-pass; the attack and release come from the caller.
 */
export function pad(freqs, hold, { wave = "saw", cutoff = 1200, attack = 0.5, release = 0.6, detune = 7, level = 1 } = {}) {
  const env = adsr(RATE, { attack, decay: 0.3, sustain: 0.9, release }, hold);
  const n = env.length;
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  freqs.forEach((freq, index) => {
    const cents = detune * (1 + 0.3 * index);
    const a = oscillator(RATE, { wave, freq: freq * 2 ** (-cents / 1200), length: n, phase: 0.13 * index });
    const b = oscillator(RATE, { wave, freq: freq * 2 ** (cents / 1200), length: n, phase: 0.61 * index });
    addInto(index % 2 ? left : right, a, 0, 1);
    addInto(index % 2 ? right : left, b, 0, 1);
  });
  const shape = (buf) => multiply(svf(buf, RATE, { cutoff: (p) => cutoff * (0.6 + 0.4 * Math.min(1, p * 3)), resonance: 0.15 }), env);
  const gain = level / Math.sqrt(freqs.length * 2);
  return { left: shape(left).map((x) => x * gain), right: shape(right).map((x) => x * gain) };
}

/** Bright saw stab: a chord with a fast filter envelope, for accents in the drop. */
export function stab(freqs, hold) {
  const env = adsr(RATE, { attack: 0.003, decay: 0.14, sustain: 0.25, release: 0.08 }, hold);
  const n = env.length;
  const sum = new Float32Array(n);
  freqs.forEach((freq, index) => {
    addInto(sum, oscillator(RATE, { wave: "saw", freq: freq * 2 ** (-5 / 1200), length: n, phase: 0.2 * index }), 0, 0.5);
    addInto(sum, oscillator(RATE, { wave: "saw", freq: freq * 2 ** (5 / 1200), length: n, phase: 0.7 * index }), 0, 0.5);
  });
  return multiply(svf(sum, RATE, { cutoff: (p) => 600 + 3200 * Math.exp(-p * 10), resonance: 0.3 }), env).map((x) => x / Math.sqrt(freqs.length));
}

/** Vinyl crackle and hiss for the lo-fi bed, as a stereo pair. */
export function crackle(frames, rng) {
  const side = () => {
    const out = lowPass(noise(frames, rng, { color: "pink" }), RATE, 2500).map((x) => x * 0.35);
    for (let i = 0; i < frames; i++) if (rng() < 0.00025) out[i] += (rng() * 2 - 1) * 0.8;
    return lowPass(out, RATE, 5000);
  };
  return { left: side(), right: side() };
}

function softClipBuffer(samples, drive) {
  for (let i = 0; i < samples.length; i++) samples[i] = softClip(samples[i] * drive, 0.7);
  return samples;
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

const VELOCITY = { x: 1, o: 0.5 };
const LEVELS = { kick: 0.9, snare: 0.6, clap: 0.5, hat: 0.2, open: 0.26, tick: 0.22, rim: 0.4, shaker: 0.28, pulse: 0.6, tom: 0.7, bass: 0.55, pad: 0.5, arp: 0.34, stab: 0.3, melody: 0.4, bell: 0.3, crackle: 0.12, riser: 0.5, impact: 0.9 };
const IMPACT_SIZE = { clean: 0.45, energetic: 0.65, warm: 0.3, minimal: 0.25, cinematic: 1, playful: 0.3 };

/** Sidechain-style pump: a gain curve that dips after every kick and recovers exponentially. */
function pumpFor(kickTimes, depth, tau) {
  const times = Float64Array.from(kickTimes).sort();
  return (buffer, startSample) => {
    if (!depth || !times.length) return buffer;
    const out = Float32Array.from(buffer);
    const t0 = startSample / RATE;
    let k = 0;
    while (k < times.length && times[k] <= t0) k++;
    k -= 1; // the last kick at or before the start, or -1
    for (let i = 0; i < out.length; i++) {
      const t = t0 + i / RATE;
      while (k + 1 < times.length && times[k + 1] <= t) k++;
      if (k >= 0) {
        const since = t - times[k];
        if (since < 1) out[i] *= 1 - depth * Math.exp(-since / tau);
      }
    }
    return out;
  };
}

/** A seeded two-bar melodic motif on the pentatonic: a rhythm mask and a random walk of pitches. */
function makeMotif(rng, key, density) {
  const scale = [...pentatonic(key, 5), ...pentatonic(key, 6)];
  const steps = [];
  let degree = 2;
  for (let step = 0; step < 2 * STEPS; step++) {
    const onBeat = step % 4 === 0;
    const chance = onBeat ? density * 1.6 : step % 2 === 0 ? density : density * 0.35;
    if (rng() >= chance) continue;
    const move = rng();
    degree += move < 0.35 ? -1 : move < 0.7 ? 1 : move < 0.85 ? 0 : rng() < 0.5 ? -2 : 3;
    degree = clamp(degree, 0, scale.length - 1);
    steps.push({ step, midi: scale[degree] });
  }
  if (!steps.length) steps.push({ step: 0, midi: scale[2] }, { step: 12, midi: scale[4] });
  const variation = steps.map((note) => (rng() < 0.3 ? { ...note, midi: scale[clamp(scale.indexOf(note.midi) + (rng() < 0.5 ? -1 : 1), 0, scale.length - 1)] } : note));
  return { a: steps, b: variation };
}

/**
 * The composer. Options: duration (s), bpm, style, seed, arc ("auto" or "flat"),
 * key ("auto", "C", "Am"…), loop. Returns interleaved stereo samples at 48 kHz,
 * the beat grid (beats.json content) and what was chosen.
 */
export function synthesizeMusic({ duration, bpm = 120, style = "clean", seed = 1, arc = "auto", key = "auto", loop = false } = {}) {
  if (!(duration >= 1 && duration <= 600)) throw new AppError("usage", `Duração inválida: ${duration}.`, "Use entre 1 e 600 segundos.");
  if (!(bpm >= 40 && bpm <= 220)) throw new AppError("usage", `BPM inválido: ${bpm}.`, "Use entre 40 e 220.");
  if (!STYLES[style]) throw new AppError("usage", `Estilo desconhecido: ${style}.`, `Estilos: ${STYLE_NAMES.join(", ")}.`);
  if (!["auto", "flat"].includes(arc)) throw new AppError("usage", `Arco desconhecido: ${arc}.`, "Use auto ou flat.");
  const profile = STYLES[style];
  const rng = seededRandom(seed * 7 + STYLE_NAMES.indexOf(style) * 1013); // each style has its own key and motifs for the same seed
  const theKey = parseKey(key) ?? keyOf(Math.floor(rng() * 12), rng() < profile.minorChance ? "minor" : "major");
  const progressions = profile[theKey.mode];
  const progression = progressions[Math.floor(rng() * progressions.length)];
  const plan = planSections({ duration, bpm, arc, loop });
  const { beatLen, barLen, hitTime } = plan;
  const stepLen = beatLen / 4;
  const frames = Math.round(duration * RATE);
  const bus = stereoBus(frames);
  const arpBus = stereoBus(frames);
  const cache = new Map();
  const memo = (name, make) => {
    if (!cache.has(name)) cache.set(name, make());
    return cache.get(name);
  };
  const drum = (kind) => memo(kind, () => {
    const r = seededRandom(seed * 31 + kind.length * 7 + kind.charCodeAt(0));
    switch (kind) {
      case "kick": return kick({ rng: r, soft: style === "clean" || style === "minimal" || style === "playful" });
      case "snare": return snare({ rng: r, lofi: style === "warm" });
      case "clap": return clap({ rng: r });
      case "hat": return hat({ rng: r });
      case "open": return hat({ rng: r, open: true });
      case "shaker": return shaker({ rng: r });
      case "tom": return tom({ rng: r });
      default: return tap({ kind, rng: r });
    }
  });
  const stepTime = (bar, step) => bar * barLen + step * stepLen + (step % 2 ? profile.swing * stepLen : 0);
  const at = (t) => Math.round(t * RATE);
  const play = (mono, t, { gain = 1, pan = 0, target = bus } = {}) => addMono(target, mono, at(t), { gain, pan, wrap: loop });
  const playStereo = (pair, t, gain = 1) => addStereo(bus, pair, at(t), { gain, wrap: loop });
  const musical = plan.sections.filter((section) => section.bars > 0);
  const roleOf = (section) => section.name;

  // pass 1: where the kicks fall, so pads and bass can pump against them
  const kickTimes = [];
  for (const section of musical) {
    for (let b = 0; b < section.bars; b++) {
      const pattern = PATTERNS[style][roleOf(section)]?.kick;
      if (!pattern) continue;
      for (let step = 0; step < STEPS; step++) if (pattern[step] !== ".") kickTimes.push(stepTime(section.startBar + b, step));
    }
  }
  const pump = pumpFor(kickTimes, profile.pump, Math.max(0.1, beatLen * 0.4));
  const pumped = (mono, t) => pump(mono, at(t));

  const motif = style === "playful" || style === "warm" ? makeMotif(rng, theKey, style === "playful" ? 0.42 : 0.28) : null;
  const buildBars = musical.find((section) => section.name === "build")?.bars ?? 0;
  const dropTime = plan.drop;
  const warnings = [];

  for (const section of musical) {
    const role = roleOf(section);
    const patterns = PATTERNS[style][role] ?? {};
    for (let b = 0; b < section.bars; b++) {
      const bar = section.startBar + b;
      const barStart = bar * barLen;
      const progressInSection = section.bars > 1 ? b / (section.bars - 1) : 1;
      const numeral = progression[bar % progression.length];
      const triad = chordNotes(theKey, numeral, { octave: 4, seventh: style === "warm" });
      const voicing = triad.map((n) => intoOctave(n, 60)).sort((x, y) => x - y);
      const rootMidi = intoOctave(triad[0], 36);
      const lastBuildBar = role === "build" && b === section.bars - 1;
      const layer = { pad: role === "intro" ? 0.7 : role === "outro" ? 0.75 : role === "build" ? 0.85 : 1, drums: role === "intro" ? 0.7 : 1 };

      // drums
      for (const [kind, pattern] of Object.entries(patterns)) {
        for (let step = 0; step < STEPS; step++) {
          const velocity = VELOCITY[pattern[step]];
          if (!velocity) continue;
          if (lastBuildBar && step >= 8 && ["hat", "tick", "shaker"].includes(kind)) continue; // the fill takes over
          play(drum(kind), stepTime(bar, step), { gain: LEVELS[kind] * velocity * layer.drums, pan: kind === "hat" || kind === "shaker" ? 0.15 : 0 });
        }
      }
      if (lastBuildBar && style !== "warm" && style !== "minimal") {
        // the fill: a roll that grows into the drop
        const roll = style === "energetic" ? "snare" : style === "cinematic" ? "tom" : style === "playful" ? "shaker" : "hat";
        const stride = style === "cinematic" ? 2 : 1;
        for (let step = 8; step < STEPS; step += stride) play(drum(roll), stepTime(bar, step), { gain: LEVELS[roll] * (0.35 + 0.65 * ((step - 8) / 7)) });
      }

      // pad or electric piano chords
      if (style === "warm") {
        for (const step of [0, 8]) voicing.forEach((midi, index) => play(epNote(midiToFreq(midi), beatLen * 1.9), stepTime(bar, step), { gain: LEVELS.pad * 0.6 * layer.pad, pan: (index - 1.5) * 0.25 }));
      } else {
        const options = { clean: { cutoff: 1100, attack: 0.5 }, energetic: { cutoff: 1800, attack: 0.3 }, minimal: { wave: "triangle", cutoff: 900, attack: 1, level: 0.9 }, cinematic: { cutoff: 500 + 1300 * (role === "build" ? progressInSection : role === "intro" ? 0 : 1), attack: 1.2 }, playful: { wave: "triangle", cutoff: 1500, attack: 0.2, level: 0.55 } }[style];
        const notes = style === "cinematic" ? [rootMidi, ...voicing] : voicing;
        const chord = pad(notes.map(midiToFreq), barLen - 0.02, { ...options, release: 0.5 });
        const swell = style === "cinematic" && role === "build" ? 0.6 + 0.4 * progressInSection : 1;
        playStereo({ left: pumped(chord.left, barStart), right: pumped(chord.right, barStart) }, barStart, LEVELS.pad * layer.pad * swell);
      }

      // bass
      const bassOn = role === "drop" || role === "bed" || (role === "build" && (b >= Math.floor(section.bars / 2) || section.bars <= 2));
      if (bassOn || style === "cinematic") {
        const pattern = BASS_STEPS[style];
        const voice = { clean: subBass, minimal: subBass, cinematic: subBass, energetic: drivingBass, playful: bouncyBass, warm: roundBass }[style];
        for (let step = 0; step < STEPS; step++) {
          if (pattern[step] === ".") continue;
          let midi = rootMidi;
          if (style === "energetic" && (step === 6 || step === 14)) midi += 12;
          if (style === "playful" && [6, 11].includes(step)) midi += 7;
          if (style === "playful" && step === 14) midi += 12;
          if (style === "warm" && step === 7) midi += rng() < 0.5 ? 7 : 12;
          const nextOn = pattern.indexOf("x", step + 1);
          const holdSteps = nextOn > 0 ? nextOn - step : STEPS - step;
          const hold = style === "cinematic" ? barLen - 0.05 : Math.min(holdSteps, style === "energetic" ? 1.6 : 3) * stepLen;
          const note = memo(`bass:${midi}:${hold.toFixed(4)}`, () => voice(midiToFreq(midi), hold));
          play(pumped(note, stepTime(bar, step)), stepTime(bar, step), { gain: LEVELS.bass * (style === "cinematic" && role === "intro" ? 0.6 : 1) });
        }
      }

      // arpeggios, plucks and stabs
      const chordTones = [voicing[0], voicing[1], voicing[2], voicing[0] + 12, voicing[0] + 14].map((n) => n + 12);
      if (style === "clean" && role !== "outro" && role !== "intro") {
        const sixteenths = role === "drop";
        const order = sixteenths ? [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 3, 2, 1, 0, 1] : [0, 1, 2, 3, 4, 3, 2, 1];
        for (let i = 0; i < order.length; i++) {
          const step = sixteenths ? i : i * 2;
          const midi = chordTones[order[i]];
          const note = memo(`pluck:${midi}`, () => pluck(midiToFreq(midi), stepLen * 1.5, seededRandom(seed + midi), { bright: 0.45 }));
          play(note, stepTime(bar, step), { gain: LEVELS.arp * (role === "build" ? 0.7 : 1) * (step % 4 === 0 ? 1 : 0.8), pan: i % 2 ? 0.35 : -0.35, target: arpBus });
        }
      }
      if (style === "energetic" && (role === "intro" || role === "build" || role === "bed")) {
        for (let i = 0; i < 8; i++) {
          const midi = chordTones[[0, 2, 1, 3, 2, 4, 3, 2][i]];
          const note = memo(`pluck:${midi}`, () => pluck(midiToFreq(midi), stepLen * 1.2, seededRandom(seed + midi), { bright: 0.8 }));
          play(note, stepTime(bar, i * 2), { gain: LEVELS.arp * (role === "intro" ? 0.6 : 0.9), pan: i % 2 ? 0.4 : -0.4, target: arpBus });
        }
      }
      if (style === "energetic" && (role === "drop" || role === "bed")) {
        const hits = b % 2 ? [0, 3, 6, 10, 12, 14] : [0, 3, 6, 10, 12];
        const chord = memo(`stab:${voicing.join("-")}`, () => stab(voicing.map(midiToFreq), stepLen * 0.9));
        for (const step of hits) play(pumped(chord, stepTime(bar, step)), stepTime(bar, step), { gain: LEVELS.stab * (step % 4 === 0 ? 1 : 0.8), pan: step % 2 ? 0.2 : -0.2 });
      }
      if (style === "minimal" && role !== "intro" && role !== "outro") {
        const count = role === "build" ? 1 : 2 + (rng() < 0.4 ? 1 : 0);
        for (let i = 0; i < count; i++) {
          const step = Math.floor(rng() * STEPS);
          const midi = chordTones[Math.floor(rng() * chordTones.length)];
          const note = memo(`pluck:${midi}`, () => pluck(midiToFreq(midi), stepLen * 2, seededRandom(seed + midi), { bright: 0.35, release: 1 }));
          play(note, stepTime(bar, step), { gain: LEVELS.arp * 1.1, pan: rng() < 0.5 ? -0.4 : 0.4, target: arpBus });
        }
      }
      if (motif && role !== "outro" && !(style === "warm" && role === "intro")) {
        const phrase = Math.floor(bar / 2) % 2 ? motif.b : motif.a;
        const half = bar % 2;
        for (const { step, midi } of phrase) {
          if (Math.floor(step / STEPS) !== half) continue;
          const s = step % STEPS;
          const note = style === "playful"
            ? memo(`melody:${midi}`, () => pluck(midiToFreq(midi), stepLen * 1.5, seededRandom(seed + midi), { bright: 0.85 }))
            : memo(`melody:${midi}`, () => epNote(midiToFreq(midi), stepLen * 2.5));
          play(note, stepTime(bar, s), { gain: LEVELS.melody * (role === "intro" ? 0.55 : role === "build" ? 0.75 : 1), pan: 0.1, target: style === "playful" ? arpBus : bus });
        }
      }
      if (style === "playful" && (role === "drop" || role === "bed")) {
        for (const step of [2, 6, 10, 14]) voicing.forEach((midi, index) => play(memo(`pluck:${midi + 12}`, () => pluck(midiToFreq(midi + 12), stepLen, seededRandom(seed + midi + 12), { bright: 0.6 })), stepTime(bar, step), { gain: LEVELS.arp * 0.55, pan: (index - 1) * 0.3, target: arpBus }));
      }
      // the one accent color of the clean style: a bell on the first downbeats
      if (style === "clean" && ((role === "intro" && b === 0) || (role === "drop" && b % 4 === 0))) play(memo(`bell:${voicing[0]}`, () => bell(midiToFreq(voicing[0] + 24))), barStart, { gain: LEVELS.bell, target: arpBus });
    }
  }

  // the riser into the drop (or into the final hit on very short pieces) and the hit itself
  const riseInto = dropTime ?? null;
  if (riseInto !== null && arc !== "flat") {
    const length = Math.min(4, Math.max(barLen * Math.min(2, Math.max(1, buildBars)), beatLen * 2), riseInto);
    if (length > 0.3) playStereo(riser({ rng: seededRandom(seed + 99), length, octaves: style === "cinematic" ? 2 : 1.5 }), riseInto - length, LEVELS.riser * (style === "cinematic" ? 1.3 : style === "warm" ? 0.5 : style === "minimal" ? 0.5 : 1));
    if (dropTime !== hitTime) {
      play(impact({ rng: seededRandom(seed + 7), tail: style === "cinematic" ? 2 : 1, size: IMPACT_SIZE[style] }), dropTime, { gain: LEVELS.impact * (0.5 + 0.5 * IMPACT_SIZE[style]) });
      if (PATTERNS[style].drop.hat || PATTERNS[style].drop.shaker) play(drum("open"), dropTime, { gain: LEVELS.open * 1.2 });
    }
  }
  if (style === "warm") playStereo(crackle(frames, seededRandom(seed + 3)), 0, LEVELS.crackle);

  // the arpeggio bus gets one ping-pong echo for the whole piece
  const echoed = { left: echo(arpBus.left, RATE, { time: beatLen * 0.75, feedback: style === "minimal" ? 0.45 : 0.3, mix: 0.3 }), right: echo(arpBus.right, RATE, { time: beatLen * 0.5, feedback: style === "minimal" ? 0.45 : 0.3, mix: 0.3 }) };
  playStereo(echoed, 0, 1);

  // the final hit on the last downbeat, with a tail that dies before the end
  if (!loop) {
    const tail = duration - hitTime;
    const lastNumeral = progression[(plan.bars - 1 + 1) % progression.length];
    const finalChord = chordNotes(theKey, arc === "flat" ? progression[0] : lastNumeral, { octave: 4 }).map((n) => intoOctave(n, 60)).sort((x, y) => x - y);
    const chord = pad([intoOctave(finalChord[0], 36), ...finalChord].map(midiToFreq), 0.25, { wave: style === "minimal" || style === "playful" ? "triangle" : "saw", cutoff: 1000, attack: 0.01, release: Math.max(0.3, tail * 0.75) });
    playStereo(chord, hitTime, LEVELS.pad * (arc === "flat" ? 0.6 : 0.9));
    play(impact({ rng: seededRandom(seed + 11), tail: Math.max(0.3, Math.min(2.4, tail - 0.05)), size: IMPACT_SIZE[style] * (arc === "flat" ? 0.5 : 1) }), hitTime, { gain: LEVELS.impact });
    if (style === "clean" || style === "minimal") play(bell(midiToFreq(finalChord[0] + 24), Math.min(1.6, tail)), hitTime, { gain: LEVELS.bell });
  }

  const samples = master(bus, { fadeOut: loop ? 0 : 0.03 });
  const beats = [];
  for (let k = 0; ; k++) {
    const t = round(k * beatLen, 4);
    if (loop ? t >= duration - 1e-6 : t > hitTime + 1e-6) break;
    beats.push(t);
  }
  const hits = [...new Set([dropTime, hitTime].filter((t) => t !== null && t !== undefined).map((t) => round(t, 4)))].sort((x, y) => x - y);
  const sections = plan.sections.map(({ name, start, end }) => ({ name, start, end }));
  return {
    samples,
    rate: RATE,
    channels: 2,
    duration,
    bpm,
    style,
    seed,
    key: theKey.name,
    arc,
    loop,
    progression: progression.join("-"),
    sections,
    drop: dropTime !== null && dropTime !== undefined ? round(dropTime, 4) : null,
    beats: { format_version: 1, source: "synthesized", bpm, offset: 0, duration, beats, downbeats: beats.filter((_, i) => i % 4 === 0), hits, sections, drop: dropTime !== null && dropTime !== undefined ? round(dropTime, 4) : null },
    peak_dbfs: round(20 * Math.log10(Math.max(peak(samples), 1e-9)), 2),
    warnings,
  };
}

/**
 * The master: peak at -3 dBFS, then a little drive into the soft limiter when the
 * mix is too quiet for a modern level, then back to -3 dBFS, and a short guard fade
 * so the last sample is zero.
 */
function master(bus, { fadeOut = 0.03 } = {}) {
  const { left, right } = bus;
  const target = dbToGain(-3);
  const normalize = () => {
    const pk = Math.max(peak(left), peak(right));
    if (pk > 0) {
      const g = target / pk;
      for (let i = 0; i < left.length; i++) {
        left[i] *= g;
        right[i] *= g;
      }
    }
  };
  normalize();
  // a few passes of gentle drive into the limiter, until the body of the mix sits
  // around -16 dBFS RMS (about -15 LUFS) with the peaks still at -3 dBFS
  let driven = 0;
  for (let pass = 0; pass < 4 && driven < 12; pass++) {
    const level = 20 * Math.log10(Math.max(1e-9, (rms(left) + rms(right)) / 2));
    if (level >= -16) break;
    const db = Math.min(4, -16 - level + 1);
    const drive = dbToGain(db);
    driven += db;
    for (let i = 0; i < left.length; i++) {
      left[i] = softClip(left[i] * drive, 0.6);
      right[i] = softClip(right[i] * drive, 0.6);
    }
    normalize();
  }
  const guard = Math.min(left.length, Math.round(fadeOut * RATE));
  for (let i = 0; i < guard; i++) {
    const g = i / guard;
    left[left.length - 1 - i] *= g;
    right[right.length - 1 - i] *= g;
  }
  return interleave(left, right);
}
