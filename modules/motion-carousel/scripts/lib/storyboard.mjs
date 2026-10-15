// The storyboard: the one file that describes a carousel (format, tempo, sound, slides and their
// events). Validation that names the field that is wrong, the timing math (beats and bars to
// seconds, the music offset of each slide) and the conversion of a slide's events into the sfx
// list the Motor de vídeo reads.

import { AppError, round, usage } from "./util.mjs";

export const STORYBOARD_VERSION = 1;

/** The formats a carousel slide can have: Instagram's feed sizes plus the vertical one. */
export const FORMATS = {
  "4:5": { width: 1080, height: 1350 },
  "3:4": { width: 1080, height: 1440 },
  "1:1": { width: 1080, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
};
export const ROLES = ["hook", "point", "cta"];
export const THEMES = ["noir", "cobalt", "paper", "forest", "mono"];
export const SOUND_STYLES = ["clean", "noir", "upbeat", "lofi", "pulse"];
export const EVENT_TYPES = ["kick", "thump", "impact", "click", "tick", "pop", "whoosh", "swish", "riser", "ding", "shutter", "pluck", "blip"];
export const LIMITS = {
  slides: [2, 20],
  bars: [1, 16],
  bpm: [60, 200],
  fps: [1, 120],
  intro_bars: [0, 8],
  duration: [3, 60],
  total_duration_warn: 90,
  track_bars: 64,
};

const HEX = /^#[0-9a-f]{6}$/i;

export const pad = (n) => String(n).padStart(2, "0");
export const slideFile = (n) => `slides/${pad(n)}.html`;

/** Every validation error carries the field path, so the AI fixes the right line. */
export const invalid = (path, message, fix = "Corrija o storyboard.json e repita.") =>
  new AppError("storyboard_invalid", `storyboard.json: ${path ? `${path} ` : ""}${message}`, fix);

const show = (value) => (value === undefined ? "nada" : JSON.stringify(value));

function number(value, path, { min = -Infinity, max = Infinity, integer = false, fallback = undefined } = {}) {
  if (value === undefined || value === null) {
    if (fallback !== undefined) return fallback;
    throw invalid(path, "está faltando.");
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw invalid(path, `precisa ser um número${integer ? " inteiro" : ""} entre ${min} e ${max} (veio ${show(value)}).`);
  }
  return value;
}

function text(value, path, { required = false, max = 500, fallback = "" } = {}) {
  if (value === undefined || value === null) {
    if (required) throw invalid(path, "está faltando.");
    return fallback;
  }
  if (typeof value !== "string") throw invalid(path, `precisa ser um texto (veio ${show(value)}).`);
  if (required && !value.trim()) throw invalid(path, "está vazio.");
  if (value.length > max) throw invalid(path, `passa de ${max} caracteres.`);
  return value;
}

function oneOf(value, path, list, fallback) {
  if (value === undefined || value === null) {
    if (fallback !== undefined) return fallback;
    throw invalid(path, `está faltando; use um de ${list.join(", ")}.`);
  }
  if (!list.includes(value)) throw invalid(path, `precisa ser um de ${list.join(", ")} (veio ${show(value)}).`);
  return value;
}

/** A file path inside the carousel folder: relative, forward slashes, never climbing out. */
export function relativeFile(value, path, { extension = null } = {}) {
  if (typeof value !== "string" || !value.trim()) throw invalid(path, `precisa ser um caminho relativo à pasta do carrossel (veio ${show(value)}).`);
  const clean = value.trim().replace(/\\/g, "/");
  if (clean.startsWith("/") || /^[A-Za-z]:/.test(clean) || clean.split("/").some((part) => part === ".." || part === "")) {
    throw invalid(path, `precisa ficar dentro da pasta do carrossel, sem "..", sem barra inicial e sem letra de unidade (veio ${show(value)}).`);
  }
  if (extension && !clean.toLowerCase().endsWith(extension)) throw invalid(path, `precisa terminar em ${extension} (veio ${show(value)}).`);
  return clean;
}

function validateTheme(value, path) {
  if (value === undefined || value === null) return "noir";
  if (typeof value === "string") return oneOf(value, path, THEMES);
  if (typeof value !== "object" || Array.isArray(value)) throw invalid(path, `precisa ser um dos temas (${THEMES.join(", ")}) ou um objeto { bg, ink, muted, accent }.`);
  const theme = {};
  for (const key of ["bg", "ink", "muted", "accent"]) {
    if (typeof value[key] !== "string" || !HEX.test(value[key])) throw invalid(`${path}.${key}`, `precisa ser uma cor hexadecimal como #0C0C0E (veio ${show(value[key])}).`);
    theme[key] = value[key];
  }
  if (value.accent2 !== undefined && value.accent2 !== null) {
    if (typeof value.accent2 !== "string" || !HEX.test(value.accent2)) throw invalid(`${path}.accent2`, `precisa ser uma cor hexadecimal (veio ${show(value.accent2)}).`);
    theme.accent2 = value.accent2;
  }
  if (value.grain !== undefined && value.grain !== null) {
    if (typeof value.grain !== "boolean") throw invalid(`${path}.grain`, `precisa ser true ou false (veio ${show(value.grain)}).`);
    theme.grain = value.grain;
  }
  return theme;
}

function validateEvent(value, path, { beats }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid(path, 'precisa ser um objeto { "beat", "type" }.');
  if (!EVENT_TYPES.includes(value.type)) throw invalid(`${path}.type`, `precisa ser um de ${EVENT_TYPES.join(", ")} (veio ${show(value.type)}).`);
  const beat = number(value.beat, `${path}.beat`, { min: 0, max: beats });
  if (beat >= beats) throw invalid(`${path}.beat`, `precisa ficar antes do fim do slide, que tem ${beats} tempos (veio ${show(value.beat)}).`);
  const event = { beat, type: value.type };
  // the same ranges the Motor de vídeo accepts in its events, so a valid storyboard never fails there
  if (value.gain_db !== undefined && value.gain_db !== null) event.gain_db = number(value.gain_db, `${path}.gain_db`, { min: -40, max: 12 });
  if (value.pan !== undefined && value.pan !== null) event.pan = number(value.pan, `${path}.pan`, { min: -1, max: 1 });
  if (value.length !== undefined && value.length !== null) event.length = number(value.length, `${path}.length`, { min: 0.01, max: 10 });
  if (value.pitch !== undefined && value.pitch !== null) event.pitch = number(value.pitch, `${path}.pitch`, { min: 0.1, max: 8 });
  if (value.direction !== undefined && value.direction !== null) event.direction = oneOf(value.direction, `${path}.direction`, ["in", "out"]);
  return event;
}

function validateSound(value, path, { seed }) {
  const raw = value === undefined || value === null ? {} : value;
  if (typeof raw !== "object" || Array.isArray(raw)) throw invalid(path, "precisa ser um objeto { style, seed, intro_bars, file }.");
  return {
    style: oneOf(raw.style, `${path}.style`, SOUND_STYLES, "noir"),
    seed: number(raw.seed, `${path}.seed`, { min: 0, max: 2147483647, integer: true, fallback: seed }),
    intro_bars: number(raw.intro_bars, `${path}.intro_bars`, { min: LIMITS.intro_bars[0], max: LIMITS.intro_bars[1], integer: true, fallback: 0 }),
    file: raw.file === undefined || raw.file === null ? null : relativeFile(raw.file, `${path}.file`),
  };
}

/**
 * Validates a storyboard object and returns a normalized copy with the defaults filled in.
 * Throws `storyboard_invalid` with the field path in the message.
 */
export function validateStoryboard(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw invalid("", "precisa ser um objeto JSON com title, format, bpm, sound, theme, seed e slides.");
  const version = raw.version === undefined || raw.version === null ? STORYBOARD_VERSION : raw.version;
  if (version !== STORYBOARD_VERSION) throw invalid("version", `precisa ser ${STORYBOARD_VERSION} (veio ${show(raw.version)}).`);
  const seed = number(raw.seed, "seed", { min: 0, max: 2147483647, integer: true, fallback: 7 });
  const storyboard = {
    version,
    title: text(raw.title, "title", { required: true, max: 200 }),
    format: oneOf(raw.format, "format", Object.keys(FORMATS), "4:5"),
    fps: number(raw.fps, "fps", { min: LIMITS.fps[0], max: LIMITS.fps[1], integer: true, fallback: 30 }),
    bpm: number(raw.bpm, "bpm", { min: LIMITS.bpm[0], max: LIMITS.bpm[1], fallback: 120 }),
    beats_per_bar: oneOf(raw.beats_per_bar, "beats_per_bar", [3, 4], 4),
    sound: validateSound(raw.sound, "sound", { seed }),
    theme: validateTheme(raw.theme, "theme"),
    seed,
    slides: [],
  };
  if (!Array.isArray(raw.slides)) throw invalid("slides", `precisa ser uma lista de ${LIMITS.slides[0]} a ${LIMITS.slides[1]} slides (veio ${show(raw.slides)}).`);
  if (raw.slides.length < LIMITS.slides[0] || raw.slides.length > LIMITS.slides[1]) {
    throw invalid("slides", `precisa ter de ${LIMITS.slides[0]} a ${LIMITS.slides[1]} slides (tem ${raw.slides.length}).`);
  }
  const barSeconds = (60 / storyboard.bpm) * storyboard.beats_per_bar;
  const minBars = Math.max(LIMITS.bars[0], Math.ceil(LIMITS.duration[0] / barSeconds - 1e-9));
  const maxBars = Math.min(LIMITS.bars[1], Math.floor(LIMITS.duration[1] / barSeconds + 1e-9));
  const files = new Map();
  raw.slides.forEach((item, index) => {
    const path = `slides[${index}]`;
    const n = index + 1;
    if (!item || typeof item !== "object" || Array.isArray(item)) throw invalid(path, "precisa ser um objeto { n, role, bars, file, title, events }.");
    if (item.n !== undefined && item.n !== null && item.n !== n) throw invalid(`${path}.n`, `precisa ser ${n}, a posição do slide na lista (veio ${show(item.n)}).`);
    if (!ROLES.includes(item.role)) throw invalid(`${path}.role`, `precisa ser um de ${ROLES.join(", ")} (veio ${show(item.role)}).`);
    const bars = number(item.bars, `${path}.bars`, { min: LIMITS.bars[0], max: LIMITS.bars[1], integer: true });
    const duration = bars * barSeconds;
    if (duration < LIMITS.duration[0] - 1e-9 || duration > LIMITS.duration[1] + 1e-9) {
      throw invalid(`${path}.bars`, `dá ${round(duration, 3)} s, e cada slide precisa ter de ${LIMITS.duration[0]} a ${LIMITS.duration[1]} s: a ${storyboard.bpm} BPM, use de ${minBars} a ${maxBars} compassos.`);
    }
    const file = item.file === undefined || item.file === null ? slideFile(n) : relativeFile(item.file, `${path}.file`, { extension: ".html" });
    if (files.has(file)) throw invalid(`${path}.file`, `repete o arquivo do slide ${files.get(file)} (${file}).`);
    files.set(file, n);
    const beats = bars * storyboard.beats_per_bar;
    const rawEvents = item.events === undefined || item.events === null ? [] : item.events;
    if (!Array.isArray(rawEvents)) throw invalid(`${path}.events`, `precisa ser uma lista (veio ${show(item.events)}).`);
    storyboard.slides.push({
      n,
      role: item.role,
      bars,
      file,
      title: text(item.title, `${path}.title`, { max: 300 }),
      events: rawEvents.map((event, i) => validateEvent(event, `${path}.events[${i}]`, { beats })),
      notes: text(item.notes, `${path}.notes`, { max: 2000 }),
    });
  });
  // the generated track has the limits of the Motor de vídeo's synth: up to 64 bars, an intro shorter than the track
  const totalBars = storyboard.slides.reduce((sum, slide) => sum + slide.bars, 0);
  if (!storyboard.sound.file && totalBars > LIMITS.track_bars) {
    throw invalid("slides", `somam ${totalBars} compassos, e a trilha gerada tem até ${LIMITS.track_bars}: corte compassos ou slides, ou use uma música sua em sound.file.`);
  }
  if (storyboard.sound.intro_bars >= totalBars) {
    throw invalid("sound.intro_bars", `precisa ser menor que o total de compassos do carrossel (${totalBars}); veio ${storyboard.sound.intro_bars}.`);
  }
  return storyboard;
}

/** Beats and bars in seconds, the duration of each slide and where its music starts in the single track. */
export function timing(storyboard) {
  const beatSeconds = 60 / storyboard.bpm;
  const barSeconds = beatSeconds * storyboard.beats_per_bar;
  let offsetBars = 0;
  const slides = storyboard.slides.map((slide) => {
    const entry = {
      n: slide.n,
      role: slide.role,
      bars: slide.bars,
      beats: slide.bars * storyboard.beats_per_bar,
      duration: round(slide.bars * barSeconds, 6),
      offset_bars: offsetBars,
      offset_beats: offsetBars * storyboard.beats_per_bar,
      music_offset: round(offsetBars * barSeconds, 6),
    };
    offsetBars += slide.bars;
    return entry;
  });
  return {
    bpm: storyboard.bpm,
    beats_per_bar: storyboard.beats_per_bar,
    beat_s: round(beatSeconds, 6),
    bar_s: round(barSeconds, 6),
    total_bars: offsetBars,
    total_beats: offsetBars * storyboard.beats_per_bar,
    total_duration: round(offsetBars * barSeconds, 6),
    slides,
  };
}

/**
 * Whether a measured tempo fits the storyboard's: the same within 1.5 BPM, or the double or the
 * half (beat trackers often hear a track at twice or half its tempo; the grid still lines up).
 */
export function tempoMatches(detected, bpm) {
  const d = Number(detected);
  const b = Number(bpm);
  if (!Number.isFinite(d) || !Number.isFinite(b) || d <= 0 || b <= 0) return false;
  return Math.abs(d - b) <= 1.5 || Math.abs(d - 2 * b) <= 3 || Math.abs(d - b / 2) <= 1;
}

/** A slide's events (in beats from the slide start) as the Motor's sfx list (in seconds). */
export function eventsToSfx(slide, times) {
  const slot = times.slides.find((entry) => entry.n === slide.n);
  if (!slot) throw invalid(`slides[${slide.n - 1}]`, "não está na linha do tempo.");
  const beatSeconds = 60 / times.bpm;
  const events = slide.events.map((event) => {
    const out = { t: round(event.beat * beatSeconds, 4), type: event.type };
    for (const key of ["gain_db", "pan", "length", "pitch", "direction"]) if (event[key] !== undefined) out[key] = event[key];
    return out;
  });
  return { duration: slot.duration, events };
}

/** `--slides 1,3` (or `2-4`) → sorted slide numbers within 1..count; nothing → every slide. */
export function parseSlideSelection(value, count) {
  const all = Array.from({ length: count }, (_, index) => index + 1);
  const textValue = value === undefined || value === null ? "" : String(value).trim();
  if (!textValue || textValue === "all") return all;
  const picked = new Set();
  for (const item of textValue.split(",")) {
    const part = item.trim();
    if (!part) continue;
    const range = /^(\d+)-(\d+)$/.exec(part);
    const list = range ? Array.from({ length: Number(range[2]) - Number(range[1]) + 1 }, (_, index) => Number(range[1]) + index) : [Number(part)];
    if (!list.length) throw usage(`Intervalo inválido em --slides: ${part}.`, `Use números de 1 a ${count}, separados por vírgula (por exemplo 1,3) ou um intervalo (2-4).`);
    for (const n of list) {
      if (!Number.isInteger(n) || n < 1 || n > count) throw usage(`Slide inválido em --slides: ${part}.`, `Use números de 1 a ${count}, separados por vírgula (por exemplo 1,3).`);
      picked.add(n);
    }
  }
  if (!picked.size) throw usage("A opção --slides está vazia.", `Use números de 1 a ${count}, separados por vírgula.`);
  return [...picked].sort((a, b) => a - b);
}

/** hook, point…, cta for a given count of slides. */
export function defaultRoles(count) {
  const n = Math.max(2, count);
  return ["hook", ...Array.from({ length: n - 2 }, () => "point"), "cta"];
}

/** A storyboard from the `new` command's choices; validated before it is written. */
export function buildStoryboard({ title, format = "4:5", fps = 30, bpm = 120, beatsPerBar = 4, style = "noir", seed = 7, introBars = 0, theme = "noir", slides }) {
  const list = slides.map((slide, index) => ({
    n: index + 1,
    role: slide.role,
    bars: slide.bars,
    file: slideFile(index + 1),
    title: slide.title ?? "",
    events: slide.events ?? [],
    notes: slide.notes ?? "",
  }));
  return validateStoryboard({
    version: STORYBOARD_VERSION,
    title,
    format,
    fps,
    bpm,
    beats_per_bar: beatsPerBar,
    sound: { style, seed, intro_bars: introBars, file: null },
    theme,
    seed,
    slides: list,
  });
}
