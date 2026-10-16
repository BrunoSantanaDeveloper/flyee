// The roteiro: the one file that describes a video (tempo, look, brand and the scenes on a beat
// grid). Here are the validation that names the scene and the field that are wrong, the timing
// (beats and bars to seconds, cuts, event times), the first draft written from the brief and the
// brand kit, the list of effects the Motor de vídeo synthesizes and the texts that go on screen.
// Everything is a pure function: the same brief always gives the same roteiro.

import { fontsFor, hostOf, paletteFor, parseNumberText } from "./brand.mjs";
import { AppError, round, shortHash } from "./util.mjs";

export const ROTEIRO_VERSION = 1;
export const FORMAT = { name: "9:16", width: 1080, height: 1920 };
export const EVENT_TYPES = ["impact", "kick", "thump", "whoosh", "swish", "riser", "click", "tick", "pop", "ding", "shutter", "pluck", "blip"];
export const MUSIC_MODES = ["music", "synth", "file", "none"];
export const MUSIC_STYLES = ["clean", "energetic", "warm", "minimal", "cinematic", "playful"];
export const SYNTH_STYLES = ["clean", "noir", "upbeat", "lofi", "pulse"];
/** The looping track (`synth`) that matches each composed style. */
export const SYNTH_FOR = { clean: "clean", energetic: "upbeat", warm: "lofi", minimal: "pulse", cinematic: "noir", playful: "upbeat" };
export const STYLE_IDS = ["interface-narra", "interface-que-se-transforma", "limpo", "tipografia-cinetica", "vitrine"];
export const LIMITS = {
  duration: [6, 20],
  duration_slack: 0.5,
  bpm: [60, 200],
  solver_bpm: [100, 140],
  fps: [24, 60],
  seed: [0, 2147483647],
  title: 120,
  source: 160,
  affix: 12,
};
const BEATS_PER_BAR = 4;
const PALETTE_KEYS = ["background", "surface", "text", "accent", "muted"];
const OPTIONAL_PALETTE_KEYS = ["surface", "muted"];
const IMAGE = /\.(png|jpe?g|webp|svg|gif|avif)$/i;
const ROLE_NAMES = {
  gancho: "gancho", produto: "produto", ponto: "ponto", prova: "prova", fechamento: "fechamento",
  abertura: "abertura", estado: "estado", preco: "preço", prazo: "prazo", item: "item", passo: "passo", resultado: "resultado",
};
const MEMBER_SOURCES = ["pedido", "resposta"];

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const words = (value) => clean(value).split(" ").filter(Boolean);
const fold = (value) => String(value ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const show = (value) => (value === undefined ? "nada" : JSON.stringify(value));
const sum = (list) => list.reduce((total, n) => total + n, 0);
const decimal = (value, digits = 2) => String(round(value, digits)).replace(".", ",");

/** "#abc", "#AABBCC" or "#AABBCCFF" (the alpha is dropped) as "#AABBCC"; anything else is null. */
function hexColor(value) {
  const text = typeof value === "string" ? value.trim() : "";
  const short = /^#([0-9a-f]{3})$/i.exec(text);
  if (short) return `#${[...short[1]].map((digit) => digit + digit).join("")}`.toUpperCase();
  const long = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(text);
  return long ? `#${long[1]}`.toUpperCase() : null;
}

/** Words that carry meaning: a lone dash or bullet is not a word. */
export const countWords = (value) => words(value).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

/** 12000 → "12.000"; 4.9 → "4,9". */
export function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  const [whole, fraction] = String(Math.abs(round(n, 2))).split(".");
  return `${n < 0 ? "-" : ""}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${fraction ? `,${fraction}` : ""}`;
}

/** 199 → "R$ 199"; 89.9 → "R$ 89,90". A text is shown as it is. */
export function formatPrice(value) {
  if (typeof value === "string") return clean(value);
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const [whole, fraction] = round(n, 2).toFixed(2).split(".");
  return `R$ ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${fraction === "00" ? "" : `,${fraction}`}`;
}

// ---------------------------------------------------------------------------
// The template specs (references/roteiros.json)
// ---------------------------------------------------------------------------

const specsOf = (templates) => templates?.templates ?? templates ?? {};
const limitsOf = (templates, role) => templates?.limits?.[role] ?? {};
const slotsOf = (spec) => (spec.slots ?? []).map((slot) => ({ name: String(slot).replace(/\?$/, ""), required: !String(slot).endsWith("?") }));
const repeatOf = (spec) => (Array.isArray(spec.repeat) ? spec.repeat : spec.optional ? [0, 1] : [1, 1]);
const describeOrder = (template) =>
  template.scenes
    .map((spec) => {
      const [min, max] = repeatOf(spec);
      return spec.repeat ? `${spec.role} (de ${min} a ${max})` : spec.optional ? `${spec.role} (opcional)` : spec.role;
    })
    .join(", ");

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/**
 * Whole bars and a tempo for a duration: integer `bars` and `bpm` from 100 to 140 so that
 * `bars × 4 × 60 / bpm` is the duration within 0.01 s, with the tempo closest to 120 (a tie goes
 * to the faster one: 15 s is 8 bars at 128). When no pair does it, the duration becomes the
 * nearest whole bar at 120 BPM and `exact` is false. The same rule the brief uses.
 */
export function solveTiming(seconds) {
  const wanted = Number(seconds);
  const [low, high] = LIMITS.solver_bpm;
  let best = null;
  if (Number.isFinite(wanted) && wanted > 0) {
    for (let bars = 1; bars <= 64; bars++) {
      const ideal = (bars * BEATS_PER_BAR * 60) / wanted;
      for (const bpm of new Set([Math.floor(ideal), Math.ceil(ideal)])) {
        if (bpm < low || bpm > high) continue;
        const duration = (bars * BEATS_PER_BAR * 60) / bpm;
        if (Math.abs(duration - wanted) > 0.01 + 1e-9) continue;
        const distance = Math.abs(bpm - 120);
        if (!best || distance < best.distance || (distance === best.distance && bars > best.bars)) best = { bars, bpm, distance };
      }
    }
  }
  const exact = Boolean(best);
  const bars = best ? best.bars : Math.max(1, Math.round((Number.isFinite(wanted) ? wanted : 15) / 2));
  const bpm = best ? best.bpm : 120;
  return {
    bars,
    bpm,
    duration: round((bars * BEATS_PER_BAR * 60) / bpm, 4),
    beat_s: round(60 / bpm, 6),
    bar_s: round((BEATS_PER_BAR * 60) / bpm, 6),
    exact,
  };
}

/**
 * Scene starts and ends, cuts and absolute event times. A scene lasts `bars × bar_s`; scene k
 * starts at the sum of the ones before; the cuts are the starts of scenes 2…n; an event sounds at
 * `start + beat × beat_s`.
 */
export function timeline(roteiro) {
  const bpm = Number(roteiro.bpm);
  const beatsPerBar = Number(roteiro.beats_per_bar ?? BEATS_PER_BAR);
  const beat = 60 / bpm;
  const bar = beat * beatsPerBar;
  let offset = 0;
  const scenes = (roteiro.scenes ?? []).map((scene, index) => {
    const bars = Number(scene.bars);
    const start = round(offset * bar, 4);
    const end = round((offset + bars) * bar, 4);
    const entry = {
      n: index + 1,
      role: scene.role,
      bars,
      beats: round(bars * beatsPerBar, 4),
      offset_bars: round(offset, 4),
      start,
      end,
      duration: round(end - start, 4),
      text: scene.text ?? null,
      events: (scene.events ?? []).map((event) => ({ ...event, t: round(start + Number(event.beat) * beat, 4) })),
    };
    offset = round(offset + bars, 4);
    return entry;
  });
  return {
    bpm,
    beats_per_bar: beatsPerBar,
    beat_s: round(beat, 6),
    bar_s: round(bar, 6),
    bars: offset,
    beats: round(offset * beatsPerBar, 4),
    duration: round(offset * bar, 4),
    cuts: scenes.slice(1).map((scene) => scene.start),
    scenes,
  };
}

/** The beat grid of the film itself, in the shape the Motor's `frames --beats` and `accept --beats` read. */
export function beatGrid(roteiro) {
  const times = timeline(roteiro);
  const total = Math.round(times.beats + 1e-6);
  const beats = Array.from({ length: Math.max(1, total) }, (_, index) => round((index * 60) / times.bpm, 4)).filter((t) => t < times.duration - 1e-6);
  return {
    format_version: 1,
    source: "roteiro",
    bpm: times.bpm,
    offset: 0,
    beats_per_bar: times.beats_per_bar,
    bars: times.bars,
    duration: times.duration,
    beats,
    downbeats: beats.filter((_, index) => index % times.beats_per_bar === 0),
  };
}

/** The effects of the whole film as the Motor's `sfx --events` reads them: `{ duration, events: [{ t, type, … }] }`. */
export function eventsFile(roteiro) {
  const times = timeline(roteiro);
  const events = [];
  for (const scene of times.scenes) {
    for (const event of scene.events) {
      if (event.t >= times.duration - 1e-6) continue;
      const out = { t: event.t, type: event.type };
      for (const key of ["gain_db", "pan", "length", "pitch", "direction"]) if (event[key] !== undefined && event[key] !== null) out[key] = event[key];
      events.push(out);
    }
  }
  events.sort((a, b) => a.t - b.t);
  return { duration: times.duration, events };
}

/** One line per scene, for the result of `build`: when it plays and what it says. */
export function sceneSummary(roteiro) {
  return timeline(roteiro).scenes.map((scene, index) => {
    const source = roteiro.scenes[index];
    const entry = { n: scene.n, role: scene.role, bars: scene.bars, start: scene.start, end: scene.end, text: scene.text };
    for (const key of ["detail", "kind", "value", "old_value", "source", "screen", "image"]) if (source[key] !== undefined && source[key] !== null) entry[key] = source[key];
    return entry;
  });
}

/**
 * Every string the video shows, with the scene, its time and, for a number, where it came from.
 * This is what the member reads before saying yes to the preview.
 */
export function onScreenTexts(roteiro) {
  const times = timeline(roteiro);
  const list = [];
  const push = (scene, field, text, source = null) => {
    const value = clean(text);
    if (value) list.push({ n: scene.n, role: scene.role, start: scene.start, end: scene.end, field, text: value, source });
  };
  times.scenes.forEach((slot, index) => {
    const scene = roteiro.scenes[index];
    if (scene.role === "prova") {
      push(slot, "value", `${scene.prefix ?? ""}${formatNumber(scene.value)}${scene.suffix ?? ""}`, clean(scene.source) || null);
      push(slot, "text", scene.text, clean(scene.source) || null);
      return;
    }
    if (scene.role === "preco") {
      if (scene.old_value !== undefined && scene.old_value !== null) push(slot, "old_value", formatPrice(scene.old_value));
      push(slot, "value", formatPrice(scene.value));
      push(slot, "text", scene.text);
      return;
    }
    push(slot, "text", scene.text);
    push(slot, "detail", scene.detail);
    if (scene.role === "estado" && scene.value !== undefined && scene.value !== null) push(slot, "value", typeof scene.value === "number" ? formatNumber(scene.value) : scene.value);
    if (scene.logo && !roteiro.brand?.logo) push(slot, "brand", roteiro.brand?.name);
  });
  return list;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Every validation error carries the field path, so the AI fixes the right line. */
export const invalid = (path, message, fix = "Corrija o roteiro.json e rode build de novo.") =>
  new AppError("roteiro_invalid", `roteiro.json: ${path ? `${path} ` : ""}${message}`, fix);

function numberAt(value, path, { min = -Infinity, max = Infinity, integer = false, fallback = undefined } = {}) {
  if (value === undefined || value === null) {
    if (fallback !== undefined) return fallback;
    throw invalid(path, "está faltando.");
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw invalid(path, `precisa ser um número${integer ? " inteiro" : ""} entre ${min} e ${max} (veio ${show(value)}).`);
  }
  return value;
}

function textAt(value, path, { required = false, max = 300, fallback = null } = {}) {
  if (value === undefined || value === null) {
    if (required) throw invalid(path, "está faltando.");
    return fallback;
  }
  if (typeof value !== "string") throw invalid(path, `precisa ser um texto (veio ${show(value)}).`);
  const text = clean(value);
  if (required && !text) throw invalid(path, "está vazio.");
  if (text.length > max) throw invalid(path, `passa de ${max} caracteres.`);
  return text;
}

function oneOf(value, path, list, fallback) {
  if (value === undefined || value === null) {
    if (fallback !== undefined) return fallback;
    throw invalid(path, `está faltando; use um de ${list.join(", ")}.`);
  }
  if (!list.includes(value)) throw invalid(path, `precisa ser um de ${list.join(", ")} (veio ${show(value)}).`);
  return value;
}

/** A file path of the roteiro: relative, forward slashes, never climbing out; an image. */
function assetAt(value, path) {
  if (typeof value !== "string" || !value.trim()) throw invalid(path, `precisa ser o caminho de uma imagem, como assets/mobile.png (veio ${show(value)}).`);
  const file = value.trim().replace(/\\/g, "/");
  if (file.split("/").some((part) => part === "..")) throw invalid(path, `não pode sair da pasta com ".." (veio ${show(value)}).`);
  if (!IMAGE.test(file)) throw invalid(path, `precisa ser uma imagem PNG, JPG, WebP, SVG, GIF ou AVIF (veio ${show(value)}).`);
  return file;
}

function fontAt(value, path, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string" || !value.trim()) throw invalid(path, `precisa ser uma lista de fontes, como "Inter, Arial, sans-serif" (veio ${show(value)}).`);
  if (value.length > 200 || /[<>{};]/.test(value)) throw invalid(path, "tem caracteres que não cabem numa lista de fontes (sem < > { } ;) ou passa de 200 caracteres.");
  return value.trim();
}

function validateEvent(value, path, beats) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid(path, 'precisa ser um objeto { "beat", "type" }.');
  if (!EVENT_TYPES.includes(value.type)) throw invalid(`${path}.type`, `precisa ser um de ${EVENT_TYPES.join(", ")} (veio ${show(value.type)}).`);
  const beat = numberAt(value.beat, `${path}.beat`, { min: 0, max: beats });
  if (beat >= beats) throw invalid(`${path}.beat`, `precisa ficar antes do fim da cena, que tem ${beats} tempos: use de 0 a ${round(beats - 0.25, 2)} (veio ${show(value.beat)}).`);
  const event = { beat, type: value.type };
  if (value.gain_db !== undefined && value.gain_db !== null) event.gain_db = numberAt(value.gain_db, `${path}.gain_db`, { min: -40, max: 12 });
  if (value.pan !== undefined && value.pan !== null) event.pan = numberAt(value.pan, `${path}.pan`, { min: -1, max: 1 });
  if (value.length !== undefined && value.length !== null) event.length = numberAt(value.length, `${path}.length`, { min: 0.01, max: 10 });
  if (value.pitch !== undefined && value.pitch !== null) event.pitch = numberAt(value.pitch, `${path}.pitch`, { min: 0.1, max: 8 });
  if (value.direction !== undefined && value.direction !== null) event.direction = oneOf(value.direction, `${path}.direction`, ["in", "out"]);
  return event;
}

function validateScene(raw, index, spec, template, templates, notes = []) {
  const path = `scenes[${index}]`;
  const role = spec.role;
  const label = `cena ${index + 1}, ${ROLE_NAMES[role] ?? role}`;
  const [minBars, maxBars] = spec.bars;
  const bars = raw.bars;
  if (typeof bars !== "number" || !Number.isFinite(bars) || bars < minBars || bars > maxBars || Math.abs(bars * 4 - Math.round(bars * 4)) > 1e-9) {
    const range = minBars === maxBars ? `${decimal(minBars)} compasso(s)` : `de ${decimal(minBars)} a ${decimal(maxBars)} compassos`;
    throw invalid(`${path}.bars`, `(${label}) precisa ser ${range}, em múltiplos de 0,25 (veio ${show(bars)}).`);
  }
  const scene = { ...raw, n: index + 1, role, bars };
  const limits = limitsOf(templates, role);
  for (const slot of slotsOf(spec)) {
    const field = `${path}.${slot.name}`;
    const value = raw[slot.name];
    const absent = value === undefined || value === null || (typeof value === "string" && !value.trim());
    if (absent) {
      if (slot.required) throw invalid(field, `(${label}) está faltando: essa cena precisa de ${slot.name}.`);
      delete scene[slot.name];
      continue;
    }
    switch (slot.name) {
      case "text":
      case "detail": {
        const text = textAt(value, field, { max: 200 });
        const limit = limits[`${slot.name}_words`];
        const count = countWords(text);
        if (limit && count > limit) {
          throw invalid(field, `(${label}) tem ${count} palavras e o limite é ${limit}: "${text}".`, `Reescreva em até ${limit} palavras (por exemplo: "${trimWords(text, limit).text}") e rode build de novo.`);
        }
        scene[slot.name] = text;
        break;
      }
      case "source":
        scene.source = textAt(value, field, { max: LIMITS.source });
        break;
      case "screen":
      case "image":
        scene[slot.name] = assetAt(value, field);
        break;
      case "value":
      case "old_value":
        if (typeof value === "number" && Number.isFinite(value) && value >= 0) scene[slot.name] = value;
        else if (role !== "prova" && typeof value === "string" && clean(value).length <= 24) scene[slot.name] = clean(value);
        else throw invalid(field, `(${label}) precisa ser um número${role === "prova" ? "" : " ou um texto curto"} (veio ${show(value)}).`);
        break;
      case "prefix":
      case "suffix":
        if (typeof value !== "string" || value.length > LIMITS.affix) throw invalid(field, `(${label}) precisa ser um texto de até ${LIMITS.affix} caracteres (veio ${show(value)}).`);
        scene[slot.name] = value;
        break;
      case "logo":
        if (typeof value !== "boolean") throw invalid(field, `(${label}) precisa ser true ou false (veio ${show(value)}).`);
        scene.logo = value;
        break;
      case "kind":
        scene.kind = oneOf(value, field, template.kinds ?? [], undefined);
        break;
      case "emphasis":
        // the words of the scene's own text that get the highlight, the number of a word (0 = the first), or false for none
        if (value === false || (typeof value === "number" && Number.isInteger(value) && value >= 0)) scene.emphasis = value;
        else if (typeof value === "string" && clean(value).length <= 60) {
          scene.emphasis = clean(value);
          if (scene.text && !fold(scene.text).includes(fold(scene.emphasis))) notes.push(`${field} ("${scene.emphasis}") não está no texto da cena ${index + 1} ("${scene.text}"): a página destaca outra palavra.`);
        } else throw invalid(field, `(${label}) precisa ser as palavras do texto a destacar, o número da palavra (0 = a primeira) ou false (veio ${show(value)}).`);
        break;
      case "scroll":
        // where the page shows the screen: 0 is the top of the captured page, 1 its end
        scene.scroll = numberAt(value, field, { min: 0, max: 1 });
        break;
      default:
        scene[slot.name] = value;
    }
  }
  const beats = round(bars * BEATS_PER_BAR, 4);
  const events = raw.events === undefined || raw.events === null ? [] : raw.events;
  if (!Array.isArray(events)) throw invalid(`${path}.events`, `precisa ser uma lista (veio ${show(raw.events)}).`);
  scene.events = events.map((event, i) => validateEvent(event, `${path}.events[${i}]`, beats));
  return scene;
}

/**
 * Validates a roteiro against the template specs and returns a normalized copy: scene numbers in
 * order, `bars` and `duration` recomputed from the scenes and the tempo. Throws `roteiro_invalid`
 * with the scene and the field in the message. `notes` receives what was normalized.
 */
export function validateRoteiro(raw, templates, { notes = [] } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw invalid("", "precisa ser um objeto JSON com template, bpm, music, palette, fonts, brand e scenes.");
  const specs = specsOf(templates);
  const version = raw.format_version ?? ROTEIRO_VERSION;
  if (version !== ROTEIRO_VERSION) throw invalid("format_version", `precisa ser ${ROTEIRO_VERSION} (veio ${show(raw.format_version)}).`);
  const templateId = oneOf(raw.template, "template", Object.keys(specs));
  const template = specs[templateId];
  const style = oneOf(raw.style, "style", STYLE_IDS, STYLE_IDS.includes(template.default_style) ? template.default_style : STYLE_IDS[0]);
  if ((raw.format ?? FORMAT.name) !== FORMAT.name || (raw.width ?? FORMAT.width) !== FORMAT.width || (raw.height ?? FORMAT.height) !== FORMAT.height) {
    throw invalid("format", `nesta versão o vídeo é sempre ${FORMAT.name}, ${FORMAT.width}×${FORMAT.height} (veio ${show(raw.format)}, ${show(raw.width)}×${show(raw.height)}).`, "Volte format para \"9:16\", width para 1080 e height para 1920.");
  }
  const fps = numberAt(raw.fps, "fps", { min: LIMITS.fps[0], max: LIMITS.fps[1], integer: true, fallback: 30 });
  const bpm = numberAt(raw.bpm, "bpm", { min: LIMITS.bpm[0], max: LIMITS.bpm[1] });
  if ((raw.beats_per_bar ?? BEATS_PER_BAR) !== BEATS_PER_BAR) throw invalid("beats_per_bar", `precisa ser ${BEATS_PER_BAR} nesta versão (veio ${show(raw.beats_per_bar)}).`);

  const rawMusic = raw.music === undefined || raw.music === null ? {} : raw.music;
  if (typeof rawMusic !== "object" || Array.isArray(rawMusic)) throw invalid("music", "precisa ser um objeto { mode, style, seed, file }.");
  const mode = oneOf(rawMusic.mode, "music.mode", MUSIC_MODES, "music");
  const styles = mode === "synth" ? [...new Set([...MUSIC_STYLES, ...SYNTH_STYLES])] : MUSIC_STYLES;
  const music = {
    mode,
    style: oneOf(rawMusic.style, "music.style", styles, MUSIC_STYLES.includes(template.music_style) ? template.music_style : "clean"),
    seed: numberAt(rawMusic.seed, "music.seed", { min: LIMITS.seed[0], max: LIMITS.seed[1], integer: true, fallback: 7 }),
    file: rawMusic.file === undefined || rawMusic.file === null ? null : textAt(rawMusic.file, "music.file", { required: true, max: 400 }),
  };

  if (!raw.palette || typeof raw.palette !== "object" || Array.isArray(raw.palette)) throw invalid("palette", "precisa ser um objeto { background, text, accent, surface?, muted? }.");
  // background, text and accent are the brand's; surface and muted, when absent, are derived by the page
  const palette = {};
  for (const key of PALETTE_KEYS) {
    const value = raw.palette[key];
    if ((value === undefined || value === null) && OPTIONAL_PALETTE_KEYS.includes(key)) continue;
    const hex = hexColor(value);
    if (!hex) throw invalid(`palette.${key}`, `precisa ser uma cor hexadecimal como #0F0F10 (veio ${show(value)}).`);
    if (hex !== String(value).toUpperCase()) notes.push(`palette.${key} passou de ${show(value)} para ${hex}.`);
    palette[key] = hex;
  }
  const defaults = fontsFor(null);
  const rawFonts = raw.fonts === undefined || raw.fonts === null ? {} : raw.fonts;
  if (typeof rawFonts !== "object" || Array.isArray(rawFonts)) throw invalid("fonts", "precisa ser um objeto { headline, body }.");
  const fonts = { headline: fontAt(rawFonts.headline, "fonts.headline", defaults.headline), body: fontAt(rawFonts.body, "fonts.body", defaults.body) };

  if (!raw.brand || typeof raw.brand !== "object" || Array.isArray(raw.brand)) throw invalid("brand", "precisa ser um objeto { name, site, handle, logo }.");
  // a video "sem marca" carries name null; an empty name is a mistake
  if (raw.brand.name !== null && raw.brand.name !== undefined) textAt(raw.brand.name, "brand.name", { required: true, max: 80 });
  const brand = {
    ...raw.brand,
    name: textAt(raw.brand.name, "brand.name", { max: 80 }),
    site: textAt(raw.brand.site, "brand.site", { max: 120 }),
    handle: textAt(raw.brand.handle, "brand.handle", { max: 60 }),
    logo: raw.brand.logo === undefined || raw.brand.logo === null || raw.brand.logo === "" ? null : assetAt(raw.brand.logo, "brand.logo"),
  };

  if (!Array.isArray(raw.scenes) || !raw.scenes.length) throw invalid("scenes", `precisa ser a lista de cenas do roteiro ${template.label ?? templateId} (${describeOrder(template)}).`);
  const roles = template.scenes.map((spec) => spec.role);
  raw.scenes.forEach((scene, index) => {
    if (!scene || typeof scene !== "object" || Array.isArray(scene)) throw invalid(`scenes[${index}]`, "precisa ser um objeto { role, bars, … }.");
    if (!roles.includes(scene.role)) throw invalid(`scenes[${index}].role`, `precisa ser um de ${roles.join(", ")} no roteiro ${template.label ?? templateId} (veio ${show(scene.role)}).`);
  });
  const scenes = [];
  const order = `A ordem do roteiro ${template.label ?? templateId} é: ${describeOrder(template)}.`;
  /** A scene in the wrong place: too many of a role, or a role out of order. */
  const misplaced = (index) => {
    const role = raw.scenes[index].role;
    const spec = template.scenes.find((item) => item.role === role);
    const [, max] = repeatOf(spec);
    const already = scenes.filter((scene) => scene.role === role).length;
    return already >= max ? `o roteiro aceita no máximo ${max} cena(s) "${role}"` : null;
  };
  let at = 0;
  for (const spec of template.scenes) {
    const [min, max] = repeatOf(spec);
    let count = 0;
    while (at < raw.scenes.length && raw.scenes[at].role === spec.role && count < max) {
      scenes.push(validateScene(raw.scenes[at], at, spec, template, templates, notes));
      at++;
      count++;
    }
    if (count < min) {
      if (at < raw.scenes.length) {
        const tooMany = misplaced(at);
        throw invalid(`scenes[${at}].role`, `${tooMany ?? `veio ${show(raw.scenes[at].role)}, e nesta posição o roteiro espera "${spec.role}"${spec.repeat ? ` (tem ${count}, precisa de pelo menos ${min})` : ""}`}. ${order}`);
      }
      throw invalid("scenes", `faltam cenas: o roteiro precisa de ${spec.repeat ? `pelo menos ${min} cenas` : "uma cena"} "${spec.role}" (tem ${count}). ${order}`);
    }
  }
  if (at < raw.scenes.length) throw invalid(`scenes[${at}].role`, `${misplaced(at) ?? `"${raw.scenes[at].role}" não vem nesta posição`}. ${order}`);

  const bars = round(sum(scenes.map((scene) => scene.bars)), 4);
  const duration = round((bars * BEATS_PER_BAR * 60) / bpm, 4);
  const barSeconds = (BEATS_PER_BAR * 60) / bpm;
  const [shortest, longest] = LIMITS.duration;
  if (duration < shortest - LIMITS.duration_slack || duration > longest + LIMITS.duration_slack) {
    const over = duration > longest;
    const change = Math.max(0.25, Math.ceil(((over ? duration - longest : shortest - duration) / barSeconds) * 4) / 4);
    throw invalid(
      "scenes",
      `somam ${decimal(bars)} compassos, que a ${decimal(bpm)} BPM dão ${decimal(duration)} s; nesta versão o vídeo tem de ${shortest} a ${longest} s.`,
      `${over ? "Tire" : "Acrescente"} pelo menos ${decimal(change)} compasso(s) das cenas (cada compasso dura ${decimal(barSeconds)} s), ou mude bpm, e rode build de novo.`,
    );
  }
  if (raw.bars !== undefined && raw.bars !== null && Math.abs(Number(raw.bars) - bars) > 1e-6) notes.push(`bars passou de ${show(raw.bars)} para ${decimal(bars)}: é a soma dos compassos das cenas.`);
  if (raw.duration !== undefined && raw.duration !== null && Math.abs(Number(raw.duration) - duration) > 0.011) notes.push(`duration passou de ${show(raw.duration)} para ${decimal(duration)} s: ${decimal(bars)} compassos a ${decimal(bpm)} BPM.`);

  const rest = { ...raw };
  for (const key of ["format_version", "title", "template", "style", "format", "width", "height", "fps", "bpm", "beats_per_bar", "bars", "duration", "music", "palette", "fonts", "brand", "scenes", "loop"]) delete rest[key];
  if (raw.loop !== undefined && raw.loop !== null && typeof raw.loop !== "boolean") throw invalid("loop", `precisa ser true ou false (veio ${show(raw.loop)}).`);
  return {
    format_version: ROTEIRO_VERSION,
    title: textAt(raw.title, "title", { max: LIMITS.title, fallback: `${brand.name ?? "Vídeo animado"} · ${String(template.label ?? templateId).toLowerCase()}` }),
    template: templateId,
    style,
    format: FORMAT.name,
    width: FORMAT.width,
    height: FORMAT.height,
    fps,
    bpm,
    beats_per_bar: BEATS_PER_BAR,
    bars,
    duration,
    music,
    palette,
    fonts,
    brand,
    scenes,
    loop: Boolean(raw.loop),
    ...rest,
  };
}

// ---------------------------------------------------------------------------
// Texts
// ---------------------------------------------------------------------------

const DANGLING = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas", "para", "pra", "por", "com", "a", "o", "as", "os", "um", "uma", "que", "ao", "aos", "sem", "sob", "sobre", "ou",
  "seu", "sua", "seus", "suas", "the", "of", "and", "to", "for", "with", "in", "on", "an",
]);

const ARTICLES = new Set(["a", "o", "as", "os"]);
const POSSESSIVES = new Set(["meu", "minha", "meus", "minhas", "teu", "tua", "teus", "tuas", "seu", "sua", "seus", "suas", "nosso", "nossa", "nossos", "nossas"]);

/** "A sua IA" → "Sua IA", "para a sua loja" → "para sua loja": the article before a possessive can go without changing the sense. */
function dropArticlesBeforePossessives(list) {
  const out = [];
  let capitalizeNext = false;
  for (let i = 0; i < list.length; i++) {
    const next = i + 1 < list.length ? fold(list[i + 1]).replace(/[^a-z]/g, "") : "";
    if (ARTICLES.has(fold(list[i])) && POSSESSIVES.has(next)) {
      capitalizeNext = /^\p{Lu}/u.test(list[i]);
      continue;
    }
    out.push(capitalizeNext ? list[i].charAt(0).toLocaleUpperCase("pt-BR") + list[i].slice(1) : list[i]);
    capitalizeNext = false;
  }
  return out;
}

/**
 * A text cut to a word limit without cutting a word: first the articles a possessive makes
 * unnecessary go, then it ends at a clause that closes inside the limit when there is one, and
 * never on a dangling article or preposition.
 */
export function trimWords(text, limit) {
  let list = words(text);
  if (countWords(text) <= limit) return { text: list.join(" "), cut: false };
  list = dropArticlesBeforePossessives(list);
  if (countWords(list.join(" ")) <= limit) return { text: list.join(" "), cut: true };
  let kept = [];
  let counted = 0;
  for (const word of list) {
    if (/[\p{L}\p{N}]/u.test(word)) {
      if (counted === limit) break;
      counted++;
    }
    kept.push(word);
  }
  // a whole sentence that fits beats a cut one; a clause (comma, colon) only when it keeps half the words
  const sentence = kept.findLastIndex((word, index) => index >= 1 && index < kept.length - 1 && /[.!?…]$/.test(word));
  const clause = kept.findLastIndex((word, index) => index >= 1 && index < kept.length - 1 && /[.!?…:;,]$/.test(word));
  if (sentence >= 1) kept = kept.slice(0, sentence + 1);
  else if (clause >= Math.ceil(limit / 2) - 1) kept = kept.slice(0, clause + 1);
  while (kept.length > 1 && (!/[\p{L}\p{N}]/u.test(kept[kept.length - 1]) || DANGLING.has(fold(kept[kept.length - 1]).replace(/[^a-z]/g, "")))) kept.pop();
  return { text: kept.join(" ").replace(/[,;:]+$/, ""), cut: true };
}

const KINDS = [
  ["botao", /\b(botao|botoes|clicar|clique|clica|toque|tocar|apertar|aperte)\b/],
  ["campo", /\b(digitar|digite|digita|e-?mail|campo|preencher|preenche|escrever|escreva)\b/],
  ["carregando", /\b(carregando|carregar|carrega|aguarde|processando)\b/],
  ["sucesso", /\b(pronto|pronta|feito|feita|sucesso|concluido|concluida|confirmado|confirmada|aprovado|aprovada)\b/],
  ["grafico", /\b(grafico|graficos|resultado|resultados|vendas|relatorio|relatorios|metricas|crescimento)\b/],
  ["lista", /\b(lista|listas|tarefas|tarefa|checklist)\b/],
  ["aviso", /\b(aviso|avisos|notificacao|notificacoes|lembrete|lembretes|alerta|alertas)\b/],
  ["busca", /\b(buscar|busca|pesquisar|pesquisa|procurar)\b/],
];

/** The state of the interface a point describes: a button, a field, a loading, a result… or a card. */
export function kindFor(text, kinds = null) {
  const folded = fold(text);
  const found = KINDS.find(([, pattern]) => pattern.test(folded))?.[0] ?? "cartao";
  if (Array.isArray(kinds) && kinds.length && !kinds.includes(found)) return kinds.includes("cartao") ? "cartao" : kinds[0];
  return found;
}

/** How long a state of the interface deserves to stay: results and cards longer than taps and loadings. */
const KIND_WEIGHT = { grafico: 3, lista: 3, cartao: 2, sucesso: 2, aviso: 2, busca: 1, campo: 1, botao: 0, carregando: 0 };
const KIND_EVENT = { botao: "click", campo: "tick", carregando: "blip", sucesso: "ding", cartao: "pop", grafico: "swish", lista: "pop", aviso: "pluck", busca: "click" };

/** The default effects of a scene, by role, kept inside the scene's own beats. */
export function defaultEvents(role, bars, { kind = null } = {}) {
  const beats = bars * BEATS_PER_BAR;
  const list = {
    gancho: [{ beat: 0, type: "impact" }],
    abertura: [{ beat: 0, type: "impact" }],
    produto: [{ beat: 0, type: "whoosh" }],
    ponto: [{ beat: 0, type: "pop" }, { beat: 2, type: "click" }],
    item: [{ beat: 0, type: "pop" }, { beat: 2, type: "click" }],
    // the path reaches the step on 0 (the swish) and its key word lands on 2 (the pop), as the page reads them
    passo: [{ beat: 0, type: "swish" }, { beat: 2, type: "pop" }],
    resultado: [{ beat: 0, type: "ding" }],
    estado: [{ beat: 0, type: KIND_EVENT[kind] ?? "click" }],
    prova: [{ beat: 0, type: "tick" }, { beat: 1, type: "tick" }, { beat: 2, type: "tick" }, { beat: 3, type: "impact" }],
    preco: [{ beat: 0, type: "impact" }],
    prazo: [{ beat: 0, type: "tick" }, { beat: 2, type: "tick" }],
    fechamento: [{ beat: 0, type: "impact" }],
  }[role] ?? [];
  return list.filter((event) => event.beat < beats);
}

// ---------------------------------------------------------------------------
// Bars
// ---------------------------------------------------------------------------

const PRIORITY = ["produto", "preco", "fechamento"];
const quarters = (bars) => Math.round(bars * 4);

/**
 * Bars per scene so the total is exact, each within its `[min, max]`: scenes of a repeated role
 * get the same length (a state of the interface is the exception: results stay longer than taps),
 * whole bars come before halves, every state gets a full bar before anything grows, and the bars
 * left go first to `produto`, `preco` and `fechamento`, then to the hook. `entries` are
 * `{ role, min, max, repeat, weight }` in scene order. Null when the total does not fit.
 */
export function allocateBars(entries, totalBars) {
  const total = quarters(totalBars);
  if (Math.abs(totalBars * 4 - total) > 1e-6) return null;
  const mins = entries.map((entry) => quarters(entry.min));
  const maxs = entries.map((entry) => quarters(entry.max));
  if (total < sum(mins) || total > sum(maxs)) return null;
  // variables: a single scene, the scenes of a repeated role (one shared length), or a pool of states
  const variables = [];
  entries.forEach((entry, index) => {
    const fractional = quarters(entry.min) % 4 !== 0;
    const last = variables[variables.length - 1];
    if (entry.repeat && last && last.role === entry.role && last.repeat) last.indexes.push(index);
    else variables.push({ role: entry.role, repeat: Boolean(entry.repeat), pool: Boolean(entry.repeat) && fractional, fractional, indexes: [index], min: mins[index], max: maxs[index] });
  });
  const extra = (bars, role) => sum(entries.map((entry, index) => (entry.role === role ? bars[index] - mins[index] : 0)));
  const score = (bars) => {
    const halves = entries.filter((entry, index) => quarters(entry.min) % 4 === 0 && bars[index] % 4 !== 0).length;
    const odd = bars.filter((value) => value % 2 !== 0).length;
    const comfortable = variables.filter((variable) => variable.pool).reduce((count, variable) => count + variable.indexes.filter((index) => bars[index] >= 4).length, 0);
    const uniform = sum(variables.filter((variable) => variable.repeat && !variable.pool).map((variable) => sum(variable.indexes.map((index) => bars[index] - mins[index]))));
    return [odd, halves, -comfortable, ...PRIORITY.map((role) => -extra(bars, role)), -uniform, -extra(bars, "gancho"), -extra(bars, "abertura")];
  };
  const better = (a, b) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
    return false;
  };
  for (const step of [2, 1]) {
    let best = null;
    const bars = new Array(entries.length).fill(0);
    const visit = (at, left) => {
      if (at === variables.length) {
        if (left !== 0) return;
        const candidate = score(bars);
        if (!best || better(candidate, best.score)) best = { score: candidate, bars: [...bars] };
        return;
      }
      const variable = variables[at];
      const count = variable.indexes.length;
      if (variable.pool) {
        // a pool of states: every state at its minimum, then the heavier kinds get the next step first
        const order = [...variable.indexes].sort((a, b) => (entries[b].weight ?? 0) - (entries[a].weight ?? 0) || a - b);
        const room = (variable.max - variable.min) / step;
        for (let given = 0; given <= count * room; given++) {
          const cost = count * variable.min + given * step;
          if (cost > left) break;
          for (const index of variable.indexes) bars[index] = variable.min;
          for (let k = 0; k < given; k++) bars[order[k % count]] += step;
          visit(at + 1, left - cost);
        }
        return;
      }
      for (let value = variable.min; value <= variable.max; value += step) {
        if (value * count > left) break;
        for (const index of variable.indexes) bars[index] = value;
        visit(at + 1, left - value * count);
      }
    };
    visit(0, total);
    if (best) return best.bars.map((value) => value / 4);
  }
  return null;
}

// ---------------------------------------------------------------------------
// The first draft
// ---------------------------------------------------------------------------

/** The names the page's images get in assets/, from the brand kit and the member's materials. */
export function assetTargets({ kit = null, materials = null } = {}) {
  const ext = (file, fallback = ".png") => /\.([a-z0-9]{2,5})$/i.exec(String(file ?? ""))?.[0].toLowerCase() ?? fallback;
  const list = [];
  const logo = materials?.logo ?? kit?.logo?.file ?? null;
  if (logo) list.push({ key: "logo", source: logo, target: `assets/logo${ext(logo)}`, from: materials?.logo ? "materiais" : "captura" });
  if (kit?.screens?.mobile) list.push({ key: "mobile", source: kit.screens.mobile, target: `assets/mobile${ext(kit.screens.mobile)}`, from: "captura" });
  if (kit?.screens?.mobile_full) list.push({ key: "mobile-full", source: kit.screens.mobile_full, target: `assets/mobile-full${ext(kit.screens.mobile_full)}`, from: "captura" });
  if (kit?.screens?.desktop) list.push({ key: "desktop", source: kit.screens.desktop, target: `assets/desktop${ext(kit.screens.desktop)}`, from: "captura" });
  (materials?.screens ?? []).forEach((file, index) => list.push({ key: `tela-${index + 1}`, source: file, target: `assets/tela-${index + 1}${ext(file)}`, from: "materiais" }));
  (materials?.images ?? []).forEach((file, index) => list.push({ key: `produto-${index + 1}`, source: file, target: `assets/produto-${index + 1}${ext(file)}`, from: "materiais" }));
  return list;
}

const PRICE = /R\$\s?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|R\$\s?\d+(?:,\d{1,2})?/;

/** "R$ 1.299,90" → 1299.9. */
export function parsePrice(text) {
  const match = /R\$\s?([\d.]+)(?:,(\d{1,2}))?/.exec(String(text ?? ""));
  if (!match) return null;
  const whole = Number(match[1].replace(/\./g, ""));
  if (!Number.isFinite(whole)) return null;
  return round(whole + (match[2] ? Number(match[2].padEnd(2, "0")) / 100 : 0), 2);
}

/** The price of an offer: what the member wrote ("de R$ 299 por R$ 199"), else the site's price of the product named. Never a guess. */
export function offerFrom({ texts = [], subject = "", kit = null } = {}) {
  const said = texts.map((text) => String(text ?? "")).filter(Boolean);
  for (const text of said) {
    const pair = new RegExp(`\\bde\\s+(${PRICE.source})\\s+por\\s+(${PRICE.source})`, "i").exec(text);
    if (pair) return { value: parsePrice(pair[2]), old_value: parsePrice(pair[1]), terms: termsAfter(text, pair.index + pair[0].length), source: "pedido" };
  }
  for (const text of said) {
    const one = PRICE.exec(text);
    if (one) return { value: parsePrice(one[0]), old_value: null, terms: termsAfter(text, one.index + one[0].length), source: "pedido" };
  }
  const wanted = fold(subject);
  if (wanted.length >= 4) {
    for (const product of kit?.products ?? []) {
      const name = fold(product?.name);
      const value = Number.isFinite(product?.value) ? product.value : parsePrice(product?.price);
      if (name.length >= 4 && value && (wanted.includes(name) || name.includes(wanted))) return { value, old_value: null, terms: null, source: "captura", product: product.name };
    }
  }
  return null;
}

function termsAfter(text, index) {
  const match = /^\s*(à vista|a vista|no pix|em até \d+x(?: sem juros)?|\d+x sem juros|por mês|ao mês|mensais)/i.exec(String(text).slice(index));
  return match ? clean(match[1]) : null;
}

const WEEKDAY = "domingo|segunda(?:-feira)?|terça(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sábado|sabado";
const DEADLINES = [
  new RegExp(`\\b(?:só\\s+|somente\\s+)?até\\s+(?:amanhã|hoje|${WEEKDAY}|o\\s+fim\\s+d[oa]\\s+(?:mês|semana|ano)|(?:o\\s+)?dia\\s+\\d{1,2}(?:\\/\\d{1,2})?(?:\\s+de\\s+[\\p{L}]+)?|\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?|\\d{1,2}\\s+de\\s+[\\p{L}]+)`, "iu"),
  /\b(?:só|somente)\s+(?:hoje|amanhã|esta\s+semana|essa\s+semana|neste\s+fim\s+de\s+semana|nesse\s+fim\s+de\s+semana)/iu,
  /\b(?:últimos\s+dias|última\s+semana|últimas\s+unidades|por\s+tempo\s+limitado|enquanto\s+dura(?:r|rem)\s+o(?:s)?\s+estoque(?:s)?)/iu,
];

/** The deadline of an offer in the member's own words ("até domingo"), or null: a deadline is never made up. */
export function deadlineFrom(texts = []) {
  for (const text of texts.map((item) => String(item ?? "")).filter(Boolean)) {
    for (const pattern of DEADLINES) {
      const match = pattern.exec(text);
      if (match) {
        const found = clean(match[0]);
        return found.charAt(0).toUpperCase() + found.slice(1);
      }
    }
  }
  return null;
}

/** What is on offer, without the price, the payment terms and the deadline said with it: "Casaco de lã por R$ 199 até domingo" → "Casaco de lã". */
export function productText(subject) {
  let text = String(subject ?? "");
  text = text.replace(new RegExp(`(?:\\bde\\s+${PRICE.source}\\s+)?(?:\\b(?:por apenas|por só|por|a partir de|a|com|custa|sai por)\\s+)?${PRICE.source}(?:\\s*(?:à vista|a vista|no pix|em até \\d+x(?: sem juros)?|\\d+x sem juros|por mês|ao mês|mensais))?`, "gi"), " ");
  for (const pattern of DEADLINES) text = text.replace(pattern, " ");
  const list = words(text.replace(/\s+[,;:.]/g, " "));
  while (list.length > 1 && (!/[\p{L}\p{N}]/u.test(list[list.length - 1]) || DANGLING.has(fold(list[list.length - 1]).replace(/[^a-z]/g, "")))) list.pop();
  return clean(list.join(" ")).replace(/[\s,;:.–—-]+$/, "");
}

/** A line that tells how the story goes ("Abre com…", "Fecha com o logo e o site", "Gancho: …"), folded. */
const STORY_DIRECTION = /^(?:(?:abr[ae]|abrir|abrindo|comec[ae]|comecar|inici[ae]|fech[ae]|fechar|fechando|termin[ae]|terminar|encerr[ae]|finaliz[ae])\s+(?:o video\s+)?com\b|(?:gancho|abertura|fechamento|assinatura|chamada final|cta|final)\s*[:–—-])/;

const pointText = (point) => clean(typeof point === "string" ? point : (point?.text ?? point?.title ?? point?.label ?? ""));
const pointDetail = (point) => clean(typeof point === "object" && point ? (point.detail ?? point.description ?? "") : "");

/** A stable seed from the video's name: the same video always gets the same music. */
export const seedFor = (slug) => (parseInt(shortHash(String(slug ?? "video"), 8), 16) % 9973) + 1;

const TEMPLATE_BY_OBJECTIVE = { vender: "oferta", explicar: "passos" };

/**
 * The first roteiro of a video, from the brief (`state.fields`), the brand kit and the template
 * specs. Options: `warnings` and `origins` (arrays this function fills: what was shortened, left
 * out or replaced, and where each text came from), `materials` (the member's files, as
 * `scanMaterials` returns them) or `assets` (the files already copied, as `assetTargets` names
 * them), `solveTiming` (the brief's own solver), `bpm` (the tempo of the member's own music, which
 * the cuts then follow) and `preferBpm` (a tempo the request asked for).
 */
/**
 * The `scroll` (0 = top of the captured page, 1 = its end, at the middle of the visible part)
 * that brings the section of a point into view: the heading that matches the point's words sits
 * near the top of the screen, with its content below. Null when no heading matches.
 */
export function scrollToHeading(layout, text) {
  if (!layout || !Array.isArray(layout.headings) || !layout.headings.length || !(layout.full_height > 0)) return null;
  const words = (value) => fold(value).split(/[^a-z0-9]+/).filter((word) => word.length > 2);
  const wanted = words(text);
  if (!wanted.length) return null;
  let best = null;
  for (const heading of layout.headings) {
    const have = words(heading.text);
    if (!have.length) continue;
    const shared = wanted.filter((word) => have.includes(word)).length;
    const score = fold(heading.text) === fold(text) ? 2 : shared / Math.max(wanted.length, have.length);
    if (score >= 0.5 && (!best || score > best.score)) best = { score, y: heading.y };
  }
  if (!best) return null;
  const viewport = layout.viewport_height > 0 ? layout.viewport_height : 844;
  return Math.round(Math.min(1, Math.max(0, (best.y + 0.35 * viewport) / layout.full_height)) * 1000) / 1000;
}

export function draftRoteiro(state, kit, templates, options = {}) {
  const warnings = options.warnings ?? [];
  const origins = options.origins ?? [];
  const solve = options.solveTiming ?? solveTiming;
  const specs = specsOf(templates);
  const fields = state?.fields ?? {};
  const get = (name) => fields[name]?.value;
  const from = (name) => fields[name]?.source ?? null;
  const byMember = (name) => MEMBER_SOURCES.includes(from(name));

  // the brand; "sem marca" (the brief says so, with every part of the brand empty) is a neutral video
  const brandField = get("brand") && typeof get("brand") === "object" ? get("brand") : {};
  const noBrand = Boolean(fields.brand) && !kit && !clean(brandField.name) && !clean(brandField.site) && !clean(brandField.handle);
  const host = kit?.host ?? hostOf(brandField.site);
  const handleText = clean(kit?.handle ?? brandField.handle);
  const handle = handleText ? (handleText.startsWith("@") ? handleText : `@${handleText}`) : null;
  const said = clean(brandField.name);
  const name = noBrand ? "" : (byMember("brand") && said) || clean(kit?.name) || said || (handle ? handle.slice(1) : "") || (host ? host.split(".")[0] : "");
  const nameOrigin = byMember("brand") && said ? from("brand") : clean(kit?.name) ? "captura" : from("brand");
  if (!name && !noBrand) {
    throw new AppError("brand_unknown", "Não sei de qual marca é este vídeo.", "Pergunte ao integrante o nome, o @ ou o site da marca e registre com o comando answer (pergunta marca); depois repita.");
  }
  const assets = options.assets ?? assetTargets({ kit, materials: options.materials ?? null });
  const asset = (key) => assets.find((item) => item.key === key)?.target ?? null;
  const photos = assets.filter((item) => item.key.startsWith("produto-")).map((item) => item.target);
  // the member's own screenshots (the product behind a login) come first; then the whole page of the
  // site, which the page scrolls from point to point; the first screen of the site only when that is all
  const memberScreens = assets.filter((item) => item.key.startsWith("tela-")).map((item) => item.target);
  const screen = memberScreens[0] ?? asset("mobile-full") ?? asset("mobile") ?? null;

  // the look
  const look = paletteFor(kit, null);
  warnings.push(...look.warnings);
  const styleField = get("style");
  // a subject that is only the brief's default ("marca em geral") is not something to put on screen
  const subject = from("subject") === "padrao" ? "" : clean(typeof get("subject") === "string" ? get("subject") : "");
  const objective = typeof get("objective") === "string" ? get("objective") : null;
  const hookField = clean(typeof get("hook") === "string" ? get("hook") : "");
  // a line of the story that slipped into the points ("Abre com…", "Fecha com o logo") is not a thing to show
  const listed = (Array.isArray(get("points")) ? get("points") : []).filter((point) => pointText(point));
  const points = listed.filter((point) => !STORY_DIRECTION.test(fold(pointText(point))) && !(hookField && fold(pointText(point)) === fold(hookField)));
  if (points.length < listed.length) {
    const left = listed.filter((point) => !points.includes(point)).map((point) => `"${pointText(point)}"`).join(", ");
    warnings.push(`Ficou de fora dos pontos o que é instrução da história, não algo a mostrar: ${left}.`);
  }
  const memberTexts = [subject, state?.request, ...points.map(pointText)];

  // the texts every template may use
  const limit = (role, key = "text_words") => limitsOf(templates, role)[key] ?? 6;
  const short = (text, role, what, key = "text_words") => {
    const result = trimWords(text, limit(role, key));
    if (result.cut) warnings.push(`${what} passou de ${limit(role, key)} palavras e foi encurtado: "${clean(text)}" virou "${result.text}". Reescreva no roteiro.json se a frase ficou quebrada.`);
    return result.text;
  };
  const hookText = hookField || clean(kit?.headline) || subject || name || "Vídeo animado";
  const hookOrigin = hookField ? from("hook") : clean(kit?.headline) ? "captura" : subject ? from("subject") : nameOrigin;
  const closing = get("closing") && typeof get("closing") === "object" ? get("closing") : {};
  const closingText =
    clean(closing.text) ||
    { site: host, perfil: handle, whatsapp: kit?.social?.whatsapp ? "Chama no WhatsApp" : null, bio: "Link na bio" }[closing.kind] ||
    host ||
    handle ||
    name ||
    "Link na bio";

  /** One scene per point, for the roles that repeat. */
  const repeated = (template, spec, list, build) => {
    const [, max] = repeatOf(spec);
    if (list.length > max) {
      const left = list.slice(max).map((point) => `"${pointText(point)}"`).join(", ");
      warnings.push(`O roteiro ${template.label} mostra até ${max} cenas "${spec.role}"; ficou de fora: ${left}.`);
    }
    return list.slice(0, max).map((point, index) => ({ scene: build(point, index), spec, member: byMember("points"), source: from("points") }));
  };

  let templateId = typeof get("template") === "string" && specs[get("template")] ? get("template") : (TEMPLATE_BY_OBJECTIVE[objective] ?? "lancamento");
  if (typeof get("template") === "string" && get("template") && !specs[get("template")]) warnings.push(`O roteiro "${get("template")}" não existe nesta versão: usei ${specs[templateId]?.label ?? templateId}.`);
  if (!specs[templateId]) templateId = Object.keys(specs)[0];

  /** The scenes of a template, in its order; or the template to fall back to when the brief cannot fill it. */
  const compose = (id) => {
    const template = specs[id];
    const entries = [];
    for (const spec of template.scenes) {
      switch (spec.role) {
        case "gancho":
          entries.push({ scene: { role: "gancho", text: short(hookText, "gancho", "O gancho") }, spec, member: true, source: hookOrigin });
          break;
        case "abertura": {
          const scene = { role: "abertura" };
          const text = name || productText(subject);
          if (text) scene.text = short(text, "abertura", name ? "O nome da marca" : "O assunto");
          scene.logo = !noBrand;
          entries.push({ scene, spec, member: true, source: name ? nameOrigin : from("subject") });
          break;
        }
        case "produto": {
          const scene = { role: "produto" };
          if (screen) scene.screen = screen;
          const text = id === "oferta" ? productText(subject) || name : name || productText(subject);
          if (text) scene.text = short(text, "produto", "O texto do produto");
          if (id === "oferta" && photos[0]) scene.image = photos[0];
          entries.push({ scene, spec, member: true, source: (id === "oferta" || !name) && productText(subject) ? from("subject") : nameOrigin });
          break;
        }
        case "ponto":
        case "item":
        case "passo": {
          const [min] = repeatOf(spec);
          const noun = { item: ["O item", "o item"], passo: ["O passo", "o passo"] }[spec.role] ?? ["O ponto", "o ponto"];
          if (points.length < min) {
            if (id === "lista" && points.length >= 2 && specs.lancamento) {
              return { fallback: "lancamento", reason: `O roteiro Lista pede de ${min} a ${repeatOf(spec)[1]} itens e o briefing tem ${points.length}: usei o roteiro Lançamento.` };
            }
            throw Object.assign(
              new AppError(
                "roteiro_invalid",
                `Faltam os ${spec.role === "passo" ? "passos" : "pontos"} do vídeo: o roteiro ${template.label} precisa de pelo menos ${min} e o briefing tem ${points.length}.`,
                spec.role === "passo"
                  ? "Pergunte ao integrante os passos, na ordem, e registre com o comando answer (pergunta pontos, os passos separados por ponto e vírgula); depois repita o build."
                  : "Pergunte ao integrante o que o vídeo deve mostrar e registre com o comando answer (pergunta pontos, os textos separados por ponto e vírgula); depois repita o build.",
              ),
              { ask: "pontos" },
            );
          }
          entries.push(
            ...repeated(template, spec, points, (point, index) => {
              const label = `${noun[0]} ${index + 1}`;
              let text = pointText(point);
              let detail = pointDetail(point);
              const split = /^(.{2,60}?)\s*(?::|\s[–—-]\s)\s*(.{3,})$/.exec(text);
              if (!detail && split && countWords(split[1]) <= limit(spec.role)) {
                text = clean(split[1]);
                detail = clean(split[2]);
              }
              const scene = { role: spec.role, text: short(text, spec.role, label) };
              if (detail) scene.detail = short(detail, spec.role, `O detalhe d${noun[1]} ${index + 1}`, "detail_words");
              // each point shows the member's next screenshot or photo, when there is one; else the page keeps the product's screen
              if (spec.role === "ponto" && memberScreens[index + 1]) scene.screen = memberScreens[index + 1];
              if (spec.role === "ponto" && photos[index]) scene.image = photos[index];
              // on the site's whole page, scroll to the section whose heading matches the point
              if (spec.role === "ponto" && !scene.screen && !scene.image && screen === asset("mobile-full")) {
                const scroll = scrollToHeading(kit?.layout, pointText(point));
                if (scroll !== null) scene.scroll = scroll;
              }
              return scene;
            }),
          );
          break;
        }
        case "estado": {
          const [min] = repeatOf(spec);
          const states = points.map((point) => ({ text: pointText(point), detail: pointDetail(point), member: byMember("points"), source: from("points") }));
          // an interface needs at least four states: the brand's own button opens it and a result closes it
          const button = clean(kit?.cta?.[0]);
          if (states.length < min) states.unshift({ text: button || "Começar", kind: "botao", member: false, source: button ? "captura" : "padrao" });
          if (states.length < min) states.push({ text: "Pronto", kind: "sucesso", member: false, source: "padrao" });
          if (states.length < min) states.splice(1, 0, { text: "Carregando", kind: "carregando", member: false, source: "padrao" });
          if (states.length < min) {
            throw Object.assign(
              new AppError(
                "roteiro_invalid",
                `Faltam os passos do vídeo: o roteiro ${template.label} precisa de pelo menos ${min} estados e o briefing tem ${points.length} ponto(s).`,
                "Pergunte ao integrante o que acontece na tela, passo a passo, e registre com o comando answer (pergunta pontos, os textos separados por ponto e vírgula); depois repita o build.",
              ),
              { ask: "pontos" },
            );
          }
          const [, max] = repeatOf(spec);
          if (states.length > max) warnings.push(`O roteiro ${template.label} mostra até ${max} estados; ficou de fora: ${states.slice(max).map((item) => `"${item.text}"`).join(", ")}.`);
          states.slice(0, max).forEach((item, index) => {
            const kind = item.kind ?? kindFor(item.text, template.kinds);
            const scene = { role: "estado", kind, text: short(item.text, "estado", `O estado ${index + 1}`) };
            if (item.detail) scene.detail = short(item.detail, "estado", `O detalhe do estado ${index + 1}`, "detail_words");
            entries.push({ scene, spec, member: item.member, source: item.source, weight: KIND_WEIGHT[kind] ?? 1 });
          });
          break;
        }
        case "prova": {
          const proof = get("proof");
          if (!proof || typeof proof !== "object") break;
          const text = clean(proof.text);
          const parsed = parseNumberText(text);
          const value = Number.isFinite(proof.value) ? proof.value : (parsed?.value ?? null);
          if (value === null) break;
          const source = clean(proof.source) || (byMember("proof") ? "informado pelo integrante" : "");
          if (!source) {
            warnings.push(`O número "${text || value}" não tem origem (a página onde está publicado, ou a palavra do integrante): a cena de prova ficou de fora.`);
            break;
          }
          const caption = parsed?.label || parsed?.before || "";
          if (!caption) {
            warnings.push(`O número "${text || value}" não diz o que conta: a cena de prova ficou de fora. Escreva o que ele mede (por exemplo "clientes") e repita.`);
            break;
          }
          if (parsed?.before && parsed.label) warnings.push(`O número da prova veio do meio de uma frase ("${text}"): confira a legenda da cena de prova no roteiro.json.`);
          const scene = { role: "prova", value };
          if (parsed?.prefix) scene.prefix = parsed.prefix;
          if (parsed?.suffix) scene.suffix = parsed.suffix;
          scene.text = short(caption, "prova", "A legenda do número");
          scene.source = source.slice(0, LIMITS.source);
          entries.push({ scene, spec, member: byMember("proof"), source: from("proof"), optional: true });
          break;
        }
        case "preco": {
          const offer = offerFrom({ texts: memberTexts, subject, kit });
          if (!offer) {
            return { fallback: "lancamento", reason: "O roteiro Oferta precisa de um preço real e não há nenhum no pedido nem no site: usei o roteiro Lançamento. Para a oferta, peça o preço ao integrante e registre com o comando answer (pergunta assunto, com o preço no texto)." };
          }
          const scene = { role: "preco", value: offer.value };
          if (offer.old_value) scene.old_value = offer.old_value;
          if (offer.terms) scene.text = short(offer.terms, "preco", "A condição do preço");
          entries.push({ scene, spec, member: offer.source === "pedido", source: offer.source === "pedido" ? "pedido" : "captura" });
          break;
        }
        case "prazo": {
          const deadline = deadlineFrom(memberTexts);
          if (deadline) entries.push({ scene: { role: "prazo", text: short(deadline, "prazo", "O prazo") }, spec, member: true, source: "pedido", optional: true });
          break;
        }
        case "fechamento":
          entries.push({ scene: { role: "fechamento", text: short(closingText, "fechamento", "O fechamento"), logo: !noBrand }, spec, member: true, source: clean(closing.text) ? from("closing") : "marca" });
          break;
        default:
          if (!spec.optional && !spec.repeat) {
            throw new AppError("runtime_missing", `O roteiro ${template.label} tem uma cena que esta versão do app não sabe escrever: ${spec.role}.`, "Reinstale o app: npx --yes flyee@latest add video-studio --yes --json, depois repita.");
          }
      }
    }
    return { entries };
  };

  let composed = compose(templateId);
  for (let guard = 0; composed.fallback && guard < 3; guard++) {
    warnings.push(composed.reason);
    templateId = composed.fallback;
    composed = compose(templateId);
  }
  if (composed.fallback) throw new AppError("roteiro_invalid", composed.reason, "Complete o briefing com o comando answer e repita o build.");
  const template = specs[templateId];
  let entries = composed.entries;
  // with no hook of the member's and no headline captured, the opening falls back to the name the next scene shows
  const hookScene = entries.find((entry) => entry.scene.role === "gancho")?.scene;
  const nameScene = entries.find((entry) => ["produto", "abertura"].includes(entry.scene.role))?.scene;
  if (hookScene?.text && nameScene?.text && fold(hookScene.text) === fold(nameScene.text)) {
    warnings.push(`A abertura repete o que a cena seguinte mostra ("${hookScene.text}"): escreva no roteiro.json uma abertura de até ${limit("gancho")} palavras com o que o integrante disse (o assunto, os pontos), sem número, preço ou prazo que ele não deu.`);
  }

  // the tempo and the bars
  const askedSeconds = Number(get("duration")) || 15;
  const wanted = Math.min(LIMITS.duration[1], Math.max(LIMITS.duration[0], askedSeconds));
  if (wanted !== askedSeconds) warnings.push(`Nesta versão o vídeo tem de ${LIMITS.duration[0]} a ${LIMITS.duration[1]} segundos: usei ${decimal(wanted, 1)} s no lugar de ${decimal(askedSeconds, 1)} s.`);
  const base = options.bpm ? null : solve(wanted);
  const minOf = (list) => sum(list.map((entry) => entry.spec.bars[0]));
  const maxOf = (list) => sum(list.map((entry) => entry.spec.bars[1]));
  const baseBars = base ? base.bars : Math.max(1, Math.round((wanted * options.bpm) / (BEATS_PER_BAR * 60)));
  // too many scenes for the bars: what the member did not ask for leaves first (the proof, then extra points)
  const droppable = (list) => {
    const optional = list.findLastIndex((entry) => entry.optional && !entry.member);
    if (optional >= 0) return optional;
    for (const spec of template.scenes) {
      if (!spec.repeat) continue;
      const same = list.map((entry, index) => ({ entry, index })).filter((item) => item.entry.spec === spec);
      if (same.length > repeatOf(spec)[0] && !same[same.length - 1].entry.member) return same[same.length - 1].index;
    }
    return -1;
  };
  while (Math.ceil(minOf(entries)) > baseBars) {
    const at = droppable(entries);
    if (at < 0) break;
    const [gone] = entries.splice(at, 1);
    warnings.push(`A cena "${gone.scene.role}"${gone.scene.text ? ` ("${gone.scene.text}")` : ""} não coube em ${decimal(wanted)} s e ficou de fora; para mostrá-la, peça um vídeo mais longo.`);
  }
  const allocation = (bars) => allocateBars(entries.map((entry) => ({ role: entry.scene.role, min: entry.spec.bars[0], max: entry.spec.bars[1], repeat: Boolean(entry.spec.repeat), weight: entry.weight ?? 0 })), bars);
  const [slowest, fastest] = LIMITS.solver_bpm;
  // a tempo the member asked for ("música a 120 BPM") becomes the centre of the choice instead of 120
  const asked = Number(options.preferBpm);
  const preferred = Number.isFinite(asked) && asked >= slowest && asked <= fastest ? asked : null;
  const centre = preferred ?? 120;
  const candidates = [];
  const consider = (bars, bpm, isBase) => {
    const duration = (bars * BEATS_PER_BAR * 60) / bpm;
    if (duration < LIMITS.duration[0] - LIMITS.duration_slack || duration > LIMITS.duration[1] + LIMITS.duration_slack) return;
    const given = allocation(bars);
    if (!given) return;
    const entriesInfo = entries.map((entry, index) => ({ whole: quarters(entry.spec.bars[0]) % 4 === 0, bars: given[index] }));
    const uneven = entriesInfo.filter((item) => item.whole && !Number.isInteger(item.bars)).length;
    // a tenth of a second is nobody's difference: inside it, even scenes and a natural tempo decide
    const off = Math.abs(duration - wanted);
    candidates.push({ bars, bpm, duration, given, key: [off <= 0.1 ? 0 : round(off, 1), uneven, isBase && !preferred ? 0 : 1, Math.abs(bpm - centre), -bars] });
  };
  if (options.bpm) {
    for (let bars = Math.ceil(minOf(entries)); bars <= Math.floor(maxOf(entries)); bars++) consider(bars, options.bpm, false);
  } else {
    consider(base.bars, base.bpm, true);
    for (let bars = Math.ceil(minOf(entries)); bars <= Math.floor(maxOf(entries)); bars++) {
      const ideal = (bars * BEATS_PER_BAR * 60) / wanted;
      for (const bpm of new Set([Math.floor(ideal), Math.ceil(ideal), slowest, fastest])) if (bpm >= slowest && bpm <= fastest) consider(bars, bpm, false);
    }
  }
  candidates.sort((a, b) => {
    for (let i = 0; i < a.key.length; i++) if (a.key[i] !== b.key[i]) return a.key[i] - b.key[i];
    return 0;
  });
  const chosen = candidates[0];
  if (!chosen) {
    throw new AppError(
      "roteiro_invalid",
      `O roteiro ${template.label} com ${entries.length} cenas não cabe entre ${LIMITS.duration[0]} e ${LIMITS.duration[1]} s${options.bpm ? ` no andamento da música (${decimal(options.bpm)} BPM)` : ""}.`,
      "Reduza os pontos do briefing com o comando answer (pergunta pontos), ou escolha outro roteiro, e repita o build.",
    );
  }
  const duration = round(chosen.duration, 4);
  // the brief's own solver says when a duration does not close in whole bars; its words hold only for the tempo it chose
  const solverSaid = Boolean(base?.warning) && chosen.bars === base.bars && chosen.bpm === base.bpm;
  if (solverSaid) warnings.push(base.warning);
  if (!solverSaid && Math.abs(duration - wanted) > 0.1) {
    const why = options.bpm
      ? `é o número inteiro de compassos mais próximo no andamento da música (${decimal(options.bpm)} BPM)`
      : chosen.bars > (base?.bars ?? 0)
        ? `o roteiro ${template.label} com ${entries.length} cenas precisa de ${decimal(chosen.bars)} compassos`
        : `é o que as ${entries.length} cenas do roteiro ${template.label} ocupam sem esticar nenhuma além do limite`;
    warnings.push(`O vídeo ficou com ${decimal(duration, 1)} s em vez de ${decimal(wanted, 1)} s: ${why}.`);
  }
  if (preferred && Math.abs(chosen.bpm - preferred) > 1) {
    warnings.push(`O pedido fala em ${decimal(preferred, 0)} BPM; para fechar ${decimal(duration, 1)} s em compassos inteiros, a trilha ficou em ${decimal(chosen.bpm, 1)} BPM.`);
  }

  // "sem som" in the brief: no music and no effects either
  const musicField = get("music") && typeof get("music") === "object" ? get("music") : {};
  const silent = musicField.effects === false;
  const scenes = entries.map((entry, index) => {
    const bars = chosen.given[index];
    const scene = { n: index + 1, role: entry.scene.role, bars };
    for (const [key, value] of Object.entries(entry.scene)) if (key !== "role") scene[key] = value;
    scene.events = silent ? [] : defaultEvents(scene.role, bars, { kind: scene.kind });
    for (const field of ["text", "detail", "value", "old_value"]) {
      if (scene[field] !== undefined && scene[field] !== null) origins.push({ scene: index + 1, role: scene.role, field, text: String(scene[field]), source: entry.source ?? null });
    }
    return scene;
  });

  // the sound
  const mode = MUSIC_MODES.includes(musicField.mode) ? musicField.mode : "music";
  const wantedStyle = typeof musicField.style === "string" ? musicField.style : null;
  const fallbackStyle = MUSIC_STYLES.includes(template.music_style) ? template.music_style : "clean";
  const musicStyle = MUSIC_STYLES.includes(wantedStyle) || (mode === "synth" && SYNTH_STYLES.includes(wantedStyle)) ? wantedStyle : fallbackStyle;
  if (wantedStyle && wantedStyle !== musicStyle) warnings.push(`O estilo de trilha "${wantedStyle}" não existe: usei ${musicStyle}.`);

  const style = typeof styleField === "string" && STYLE_IDS.includes(styleField) ? styleField : STYLE_IDS.includes(template.default_style) ? template.default_style : STYLE_IDS[0];
  return {
    format_version: ROTEIRO_VERSION,
    title: `${name || productText(subject) || "Vídeo animado"} · ${String(template.label ?? templateId).toLowerCase()}`.slice(0, LIMITS.title),
    template: templateId,
    style,
    format: FORMAT.name,
    width: FORMAT.width,
    height: FORMAT.height,
    fps: 30,
    bpm: chosen.bpm,
    beats_per_bar: BEATS_PER_BAR,
    bars: chosen.bars,
    duration,
    music: { mode, style: musicStyle, seed: seedFor(state?.slug), file: mode === "file" && clean(musicField.file) ? clean(musicField.file) : null },
    palette: look.palette,
    fonts: fontsFor(kit),
    brand: { name: name || null, site: host ?? null, handle, logo: noBrand ? null : asset("logo") },
    scenes,
    loop: mode === "synth",
  };
}
