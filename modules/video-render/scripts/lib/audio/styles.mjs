// The five music styles of `synth`: each one is a 4-bar phrase arranged on a loop-perfect
// timeline (the pattern is rendered with an extra tail that folds onto the beginning, so
// the file repeats without a click), with velocities and small choices drawn from the
// seed, then mastered to about −16 LUFS. Pure functions, no I/O.

import {
  bassNote,
  biquad,
  Bus,
  clap,
  crackle,
  frames,
  hat,
  keys,
  kick,
  master,
  midiToFreq,
  noiseBed,
  pad,
  pluck,
  pulseNote,
  RATE,
  reverbWet,
  rim,
  shaker,
  snare,
  subBass,
} from "./synth.mjs";
import { clamp, round, seededRandom } from "../util.mjs";

export const STYLE_DESCRIPTIONS = {
  clean: "Bumbo macio no 1 e no 3, palmas no 2 e no 4, chimbal em colcheias, grave sub e um arpejo de corda esparso.",
  noir: "Pad escuro de serras desafinadas, bumbo no 1, aro no 3, chimbal baixinho, cama de ruído e baixo longo em acordes menores.",
  upbeat: "Bumbo em todo tempo, chimbal aberto no contratempo, palmas no 2 e no 4, baixo em colcheias e melodia brilhante de corda.",
  lofi: "Chimbal com balanço, bumbo e caixa boom-bap, teclas abafadas com vibrato, chiado de vinil e um corte suave de agudos.",
  pulse: "Um pulso de serra filtrada por tempo, com respiração de sidechain, pad aéreo e percussão mínima: ritmo de produto.",
};
export const STYLE_NAMES = Object.keys(STYLE_DESCRIPTIONS);

// ---------------------------------------------------------------------------
// Harmony
// ---------------------------------------------------------------------------

const INTERVALS = { maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7] };

/** Chords as [semitones above the key root, quality]; one chord per bar of the 4-bar phrase. */
const PROGRESSIONS = {
  clean: [
    [[0, "maj"], [7, "maj"], [9, "min"], [5, "maj"]],
    [[9, "min"], [5, "maj"], [0, "maj"], [7, "maj"]],
    [[0, "maj"], [5, "maj"], [9, "min"], [7, "sus4"]],
  ],
  noir: [
    [[0, "min"], [8, "maj"], [5, "min"], [7, "maj"]],
    [[0, "min"], [10, "maj"], [8, "maj"], [7, "min"]],
    [[0, "min"], [5, "min"], [8, "maj"], [3, "maj"]],
  ],
  upbeat: [[[0, "maj"], [7, "maj"], [9, "min"], [5, "maj"]]],
  lofi: [
    [[2, "min7"], [7, "dom7"], [0, "maj7"], [9, "min7"]],
    [[0, "maj7"], [9, "min7"], [2, "min7"], [7, "dom7"]],
    [[5, "maj7"], [4, "min7"], [9, "min7"], [2, "min7"]],
  ],
  pulse: [
    [[0, "min"], [8, "maj"], [3, "maj"], [10, "maj"]],
    [[0, "min"], [5, "min"], [8, "maj"], [10, "maj"]],
    [[0, "sus2"], [8, "maj7"], [0, "sus2"], [10, "maj"]],
  ],
};

/** A chord as MIDI notes folded into [low, low + 16): a close voicing that stays in one register. */
function voice(rootPc, [offset, quality], low) {
  const root = low + ((rootPc + offset) % 12);
  return INTERVALS[quality]
    .map((interval) => {
      let note = root + interval;
      while (note >= low + 16) note -= 12;
      return note;
    })
    .sort((a, b) => a - b);
}

const bassMidi = (rootPc, [offset], low = 36) => low + ((rootPc + offset) % 12);

/** "x" = full hit, "o" = soft hit, "." = rest; 16 steps per 4/4 bar, cut to `steps`. */
function hits(pattern, steps) {
  const out = [];
  for (let step = 0; step < Math.min(steps, pattern.length); step++) {
    if (pattern[step] === "x") out.push({ step, vel: 1 });
    else if (pattern[step] === "o") out.push({ step, vel: 0.6 });
  }
  return out;
}

const pick = (rng, list) => list[Math.floor(rng() * list.length)];

// ---------------------------------------------------------------------------
// Styles: each schedules its sounds and may return mastering hints
// ---------------------------------------------------------------------------

const STYLES = {
  clean(c) {
    const kicks = hits("x.......x.......", c.steps);
    const claps = hits("....x.......x...", c.steps);
    const hats = hits("o.x.o.x.o.x.o.x.", c.steps);
    const arps = [[2, 6, 12], [0, 6, 10, 14], [4, 10, 14], [2, 8, 12]];
    for (let bar = 0; bar < c.bars; bar++) {
      const chord = c.chordAt(bar);
      const notes = voice(c.rootPc, chord, 60);
      const bass = bassMidi(c.rootPc, chord);
      c.place(subBass(midiToFreq(bass), c.beat * 1.7), c.t(bar, 0), { gain: 0.55 });
      if (c.steps >= 12) c.place(subBass(midiToFreq(bass + 7), c.beat * 1.6), c.t(bar, 8), { gain: 0.45 });
      if (c.full(bar)) {
        for (const h of kicks) c.place(kick({ rng: c.rng }), c.t(bar, h.step), { gain: 0.85 * h.vel * c.vary(0.08) });
        for (const h of claps) c.place(clap({ rng: c.rng }), c.t(bar, h.step), { gain: 0.38 * h.vel * c.vary(0.1), pan: 0.1, wet: 0.5 });
        for (const h of hats) c.place(hat({ rng: c.rng }), c.t(bar, h.step), { gain: 0.2 * h.vel * c.vary(0.25), pan: -0.15 });
      }
      const arp = pick(c.rng, arps);
      arp.forEach((step, index) => {
        if (step >= c.steps) return;
        const note = notes[(index + bar) % notes.length] + (index === 2 ? 12 : 0);
        c.place(pluck(midiToFreq(note), c.beat * 1.2, c.rng, { bright: 0.45, decay: 1.1 }), c.t(bar, step), { gain: 0.28 * c.vary(0.2), pan: index % 2 ? 0.35 : -0.35, wet: 0.6 });
      });
    }
    return { reverb: 1.4 };
  },

  noir(c) {
    const hats = hits("xoxoxoxoxoxoxoxo", c.steps);
    const lfo = Math.max(1, Math.round(0.15 * c.loopSeconds)) / c.loopSeconds;
    c.bus.add(noiseBed(c.N + c.tail, c.rng, { freq: 600, q: 0.6, lfo }), 0, { gain: 0.045 });
    for (let bar = 0; bar < c.bars; bar++) {
      const chord = c.chordAt(bar);
      const notes = voice(c.rootPc, chord, 48).map(midiToFreq);
      c.place(pad(notes, c.barLen * 0.98, { cutoff: 650, attack: 0.5, release: 0.7, detune: 9 }), c.t(bar, 0) - 0.35, { gain: 0.32, wet: 0.7 });
      c.place(subBass(midiToFreq(bassMidi(c.rootPc, chord)), c.barLen * 0.9, { release: 0.2 }), c.t(bar, 0), { gain: 0.5 });
      if (c.full(bar)) {
        c.place(kick({ from: 120, to: 45, decay: 0.4, click: 0.1, rng: c.rng }), c.t(bar, 0), { gain: 0.8 * c.vary(0.06) });
        if (c.steps >= 12) c.place(rim({ rng: c.rng }), c.t(bar, 8), { gain: 0.3 * c.vary(0.1), pan: 0.2, wet: 0.6 });
        for (const h of hats) c.place(hat({ rng: c.rng, decay: 0.035 }), c.t(bar, h.step), { gain: 0.07 * h.vel * c.vary(0.35), pan: -0.2 });
      }
    }
    return { reverb: 2.2 };
  },

  upbeat(c) {
    const kicks = hits("x...x...x...x...", c.steps);
    const claps = hits("....x.......x...", c.steps);
    const opens = hits("..x...x...x...x.", c.steps);
    const closed = hits("x...x...x...x...", c.steps);
    const rhythms = ["x.x...x.x...x...", "x...x.x...x.x.x.", "x.x.x...x...x.x.", "..x.x...x.x...x."];
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19].map((s) => 60 + c.rootPc + s);
    let index = 2 + Math.floor(c.rng() * 3);
    for (let bar = 0; bar < c.bars; bar++) {
      const chord = c.chordAt(bar);
      const chordPcs = new Set(voice(c.rootPc, chord, 60).map((n) => n % 12));
      const bass = bassMidi(c.rootPc, chord);
      c.place(pad(voice(c.rootPc, chord, 55).map(midiToFreq), c.barLen * 0.98, { cutoff: 1500, attack: 0.25, release: 0.5 }), c.t(bar, 0) - 0.2, { gain: 0.14, wet: 0.5 });
      if (c.full(bar)) {
        for (const h of kicks) c.place(kick({ rng: c.rng }), c.t(bar, h.step), { gain: 0.9 * h.vel * c.vary(0.06) });
        for (const h of claps) c.place(clap({ rng: c.rng }), c.t(bar, h.step), { gain: 0.42 * h.vel * c.vary(0.1), pan: 0.1, wet: 0.4 });
        for (const h of opens) c.place(hat({ rng: c.rng, open: true }), c.t(bar, h.step), { gain: 0.16 * c.vary(0.2), pan: 0.2 });
        for (const h of closed) c.place(hat({ rng: c.rng }), c.t(bar, h.step), { gain: 0.08 * c.vary(0.2), pan: -0.2 });
        for (let step = 0; step < c.steps; step += 2) {
          const note = bass + ((step / 2) % 4 === 3 ? 12 : 0);
          c.place(bassNote(midiToFreq(note), c.stepLen * 1.6), c.t(bar, step), { gain: (step % 4 === 0 ? 0.5 : 0.4) * c.vary(0.1) });
        }
      }
      const rhythm = pick(c.rng, rhythms);
      let voiceIndex = 0;
      for (let step = 0; step < c.steps; step++) {
        if (rhythm[step] !== "x") continue;
        index = clamp(index + pick(c.rng, [-2, -1, 0, 1, 1, 2]), 0, scale.length - 1);
        if (step === 0 && !chordPcs.has(scale[index] % 12)) {
          const near = scale.map((n, i) => [Math.abs(i - index), i]).filter(([, i]) => chordPcs.has(scale[i] % 12)).sort((a, b) => a[0] - b[0]);
          if (near.length) index = near[0][1];
        }
        c.place(pluck(midiToFreq(scale[index]), c.beat * 0.9, c.rng, { bright: 0.7, decay: 0.8 }), c.t(bar, step), { gain: 0.3 * c.vary(0.2), pan: voiceIndex++ % 2 ? 0.25 : -0.25, wet: 0.5 });
      }
    }
    return { reverb: 1.2 };
  },

  lofi(c) {
    c.swing = 0.58;
    const kicks = hits("x..x....x.x.....", c.steps);
    const snares = hits("....x.......x...", c.steps);
    const hats = hits("x.x.x.x.x.x.x.x.", c.steps);
    c.bus.add(crackle(c.N + c.tail, c.rng, { density: 35, hiss: 0.35 }), 0, { gain: 0.07 });
    for (let bar = 0; bar < c.bars; bar++) {
      const chord = c.chordAt(bar);
      const notes = voice(c.rootPc, chord, 55);
      const bass = bassMidi(c.rootPc, chord);
      notes.forEach((note, i) => c.place(keys(midiToFreq(note), c.barLen * 0.8, { release: 0.4 }), c.t(bar, 0) + i * 0.012, { gain: (0.5 / notes.length) * c.vary(0.1), pan: (i - (notes.length - 1) / 2) * 0.2, wet: 0.3 }));
      if (c.steps >= 12 && c.rng() < 0.6) notes.forEach((note, i) => c.place(keys(midiToFreq(note), c.beat * 0.6, { release: 0.25 }), c.t(bar, 10) + i * 0.01, { gain: (0.32 / notes.length) * c.vary(0.1), pan: (i - (notes.length - 1) / 2) * 0.2, wet: 0.3 }));
      if (c.full(bar)) {
        c.place(subBass(midiToFreq(bass), c.beat * 1.4, { release: 0.1 }), c.t(bar, 0), { gain: 0.5 });
        if (c.rng() < 0.8) c.place(subBass(midiToFreq(bass), c.beat * 0.8, { release: 0.1 }), c.t(bar, 6), { gain: 0.42 });
        for (const h of kicks) c.place(kick({ from: 150, to: 50, decay: 0.28, click: 0.15, rng: c.rng }), c.t(bar, h.step), { gain: 0.8 * h.vel * c.vary(0.12) });
        for (const h of snares) c.place(snare({ rng: c.rng }), c.t(bar, h.step), { gain: 0.4 * h.vel * c.vary(0.1), pan: 0.05, wet: 0.4 });
        for (const h of hats) c.place(hat({ rng: c.rng, decay: 0.05 }), c.t(bar, h.step), { gain: 0.15 * (h.step % 4 === 0 ? 1 : 0.7) * c.vary(0.35), pan: -0.25 });
      }
    }
    return { reverb: 1, lowpass: 6500 };
  },

  pulse(c) {
    for (let bar = 0; bar < c.bars; bar++) {
      const chord = c.chordAt(bar);
      const bass = bassMidi(c.rootPc, chord, 36);
      c.place(pad(voice(c.rootPc, chord, 67).map(midiToFreq), c.barLen * 0.98, { wave: "triangle", cutoff: 2500, attack: 0.5, release: 0.8, detune: 5 }), c.t(bar, 0) - 0.4, { gain: 0.16, wet: 0.8 });
      if (c.full(bar)) {
        for (let b = 0; b < c.beatsPerBar; b++) {
          c.place(pulseNote(midiToFreq(bass), c.beat), c.t(bar, b * 4), { gain: 0.42 * c.vary(0.05) });
          c.place(pulseNote(midiToFreq(bass + 12), c.beat, { cutoff: 2200 }), c.t(bar, b * 4), { gain: 0.2 * c.vary(0.05), pan: 0.1 });
        }
        c.place(kick({ from: 110, to: 45, decay: 0.3, click: 0, rng: c.rng }), c.t(bar, 0), { gain: 0.6 });
        for (const step of [4, 12]) if (step < c.steps) c.place(rim({ rng: c.rng }), c.t(bar, step), { gain: 0.12 * c.vary(0.2), pan: 0.3, wet: 0.5 });
        for (const step of [2, 6, 10, 14]) if (step < c.steps) c.place(shaker({ rng: c.rng }), c.t(bar, step), { gain: 0.06 * c.vary(0.3), pan: -0.3 });
      }
    }
    return { reverb: 1.8 };
  },
};

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

/**
 * Renders `bars` bars of a style as a seamless loop: stereo interleaved samples at 48 kHz,
 * exactly bars × beatsPerBar × 60 / bpm seconds (rounded to whole samples), plus the beat
 * grid. `introBars` first bars play only the sustained layers.
 */
export function synthesizeMusic({ bpm = 120, bars = 4, beatsPerBar = 4, style = "clean", seed = 1, introBars = 0, gainDb = 0 } = {}) {
  if (!STYLES[style]) throw new Error(`unknown style ${style}`);
  const rng = seededRandom(seed);
  const beat = 60 / bpm;
  const barLen = beat * beatsPerBar;
  const stepLen = beat / 4;
  const steps = beatsPerBar * 4;
  const loopSeconds = bars * barLen;
  const N = Math.round(loopSeconds * RATE);
  const tail = Math.max(frames(barLen), frames(2));
  const bus = new Bus(N + tail);
  const wet = new Bus(N + tail);
  const rootPc = Math.floor(rng() * 12);
  const prog = pick(rng, PROGRESSIONS[style]);
  const c = {
    rng, bpm, beat, barLen, stepLen, steps, bars, beatsPerBar, N, tail, loopSeconds, bus, rootPc, prog,
    swing: 0.5,
    full: (bar) => bar >= introBars,
    chordAt: (bar) => prog[bar % prog.length],
    vary: (amount) => 1 - amount * rng(),
    t(bar, step) {
      return bar * barLen + step * stepLen + (step % 4 === 2 ? (this.swing - 0.5) * beat : 0);
    },
    /** A sound at `time` seconds; a negative time (pre-roll) starts near the end and folds onto the beginning. */
    place(sound, time, { gain = 1, pan = 0, wet: send = 0 } = {}) {
      let at = Math.round(time * RATE);
      if (at < 0) at += N;
      bus.add(sound, at, { gain, pan });
      if (send > 0) wet.add(sound, at, { gain: gain * send, pan });
    },
  };
  const post = STYLES[style](c) ?? {};
  const wetL = reverbWet(wet.L, { time: post.reverb ?? 1.4 });
  const wetR = reverbWet(wet.R, { time: post.reverb ?? 1.4 });
  let left = bus.L;
  let right = bus.R;
  for (let i = 0; i < left.length; i++) {
    left[i] += 0.35 * wetL[i];
    right[i] += 0.35 * wetR[i];
  }
  if (post.lowpass) {
    left = biquad(left, { type: "lowpass", freq: post.lowpass, q: 0.6 });
    right = biquad(right, { type: "lowpass", freq: post.lowpass, q: 0.6 });
  }
  // fold the tail onto the beginning: whatever still rings past the loop end belongs to its start
  const fade = Math.min(tail, frames(0.1));
  for (let i = N; i < N + tail; i++) {
    const w = i >= N + tail - fade ? (N + tail - i) / fade : 1;
    left[i % N] += left[i] * w;
    right[i % N] += right[i] * w;
  }
  const loopL = left.subarray(0, N);
  const loopR = right.subarray(0, N);
  const mastered = master([loopL, loopR], { targetLufs: -16, gainDb, maxTruePeakDb: -1 });
  const samples = new Float32Array(N * 2);
  for (let i = 0, j = 0; i < N; i++, j += 2) {
    samples[j] = loopL[i];
    samples[j + 1] = loopR[i];
  }
  const beats = [];
  for (let n = 0; n < bars * beatsPerBar; n++) beats.push(round(n * beat, 4));
  const downbeats = [];
  for (let b = 0; b < bars; b++) downbeats.push(round(b * barLen, 4));
  return {
    samples,
    rate: RATE,
    channels: 2,
    frames: N,
    duration: N / RATE,
    beats,
    downbeats,
    bpm,
    bars,
    beats_per_bar: beatsPerBar,
    beat_s: beat,
    bar_s: barLen,
    style,
    seed,
    intro_bars: introBars,
    key: rootPc,
    progression: prog,
    master: mastered,
  };
}
