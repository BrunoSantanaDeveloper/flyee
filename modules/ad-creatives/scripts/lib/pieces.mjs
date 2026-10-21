// The piece of a concept: peca.json (the scenes, written from a template and edited by the AI),
// the page the Motor de vídeo renders (pagina.html, with ad.js beside it), the beat grid the
// cuts are checked against and the sound effects of the scenes. No pixel is drawn here.

import { readFileSync } from "node:fs";
import { extname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";

import { isFile } from "./files.mjs";
import { AppError } from "./util.mjs";

export const PIECE_VERSION = 1;
export const BPM = 120;
export const DURATION = { min: 6, max: 15, fallback: 15 };
export const MUSIC_STYLES = ["clean", "energetic", "warm", "minimal", "cinematic", "playful"];
export const ITEM_TYPES = ["title", "caption", "quote", "list", "card", "screen", "stamp", "pill", "logo"];
export const LIMITS = { title: 90, caption: 140, quote: 120, when: 30, pill: 30, stamp: 40, list_item: 28, list_items: 6, card_fields: 4, field_label: 28, field_value: 48, chip: 28, scene_items: 6, scenes: 6 };
const TEXT_TYPES = ["title", "caption", "quote", "list", "stamp", "pill"];
const MOTIONS = ["zoom", "rolar", "parado"];
/** The character of the music by the concept's visual style. */
const MUSIC_FOR = { "tipografia-cinetica": "energetic", "frase-que-some": "clean", interface: "clean", "tela-do-produto": "clean", "foto-do-produto": "warm", animacao: "playful", ugc: "warm", carrossel: "clean", "pessoa-falando": "minimal" };
export const NEUTRAL = { background: "#F6F4EE", text: "#2B2A27", accent: "#1F6F78", surface: "#FFFFFF", muted: "#5E5A53" };

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const round = (value, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;
const invalid = (path, problem, fix) => new AppError("piece_invalid", `peca.json tem um problema em ${path}: ${problem}`, fix ?? "Corrija o peca.json e rode piece de novo; o guia está em references/pagina-anuncio.md.");

// ---------------------------------------------------------------- the templates

/** "Ela contou no começo. No fim, você lembrava?" → ["Ela contou no começo.", "No fim, você lembrava?"] */
export function sentences(text) {
  return String(text ?? "")
    .split(/(?<=[.?:;])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** "Língua. Pulso. Zang-Fu. Pontos. Tudo no lugar." → the five parts; null when it is not a list. */
export function listParts(text) {
  const parts = String(text ?? "")
    .split(/(?<=\.)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 3 || parts.length > LIMITS.list_items || parts.some((part) => part.length > LIMITS.list_item)) return null;
  return parts;
}

/**
 * A sentence in two lines that enter one after the other: two sentences, or one cut at its last
 * comma (or colon, or semicolon) when both halves keep three words or more.
 */
export function twoParts(text) {
  const clean = String(text ?? "").trim();
  const parts = sentences(clean);
  if (parts.length >= 2) return [parts[0], parts.slice(1).join(" ")];
  const cut = Math.max(clean.lastIndexOf(", "), clean.lastIndexOf(": "), clean.lastIndexOf("; "));
  if (cut > 0) {
    const first = clean.slice(0, cut + 1).trim();
    const second = clean.slice(cut + 1).trim();
    if (first.split(/\s+/).length >= 3 && second.split(/\s+/).length >= 3) return [first, second];
  }
  return [clean];
}

/** The last third of a sentence, the part that takes the accent when the sentence is one line. */
export function accentTail(text) {
  const words = String(text ?? "").trim().split(/\s+/);
  if (words.length < 4) return true;
  return words.slice(-Math.ceil(words.length / 3)).join(" ");
}

/**
 * The hook, in the large title size: the first line is the cover (on screen in frame 0, the
 * thumbnail), the second enters on the 2nd beat.
 */
function hookItems(text) {
  const parts = twoParts(text);
  const big = parts.every((part) => part.length <= 60);
  if (parts.length === 2) return [{ type: "title", text: parts[0], at: -1, big }, { type: "title", text: parts[1], at: 1, accent: true, big }];
  return [{ type: "title", text: parts[0], at: -1, big, accent: accentTail(parts[0]), sweep_at: 1 }];
}

/**
 * A statement in two lines, 1,5 s apart, the second in the accent colour; one sentence keeps its
 * last third in the accent, swept later, so the scene does not sit still. Short is a title.
 */
function statementItems(text, from) {
  const parts = twoParts(text);
  const type = String(text).trim().length <= LIMITS.title ? "title" : "caption";
  if (parts.length === 2) return [{ type, text: parts[0], at: from }, { type, text: parts[1], at: round(from + 1.5), accent: true }];
  return [{ type, text: parts[0], at: from, accent: accentTail(parts[0]), sweep_at: round(from + 1.6) }];
}

function ctaItems(concept, from) {
  return [
    { type: "logo", at: from },
    { type: "title", text: concept.copy.headline, at: round(from + 0.2), accent: true },
    { type: "pill", text: concept.copy.cta || "Saiba mais", at: round(from + 0.8) },
  ];
}

const screenItem = (image, at, height) => ({ type: "screen", src: image.src, at, motion: image.tall ? "rolar" : "zoom", height });

function mechanismItems(concept, image, from) {
  if (image) return [{ type: "caption", text: concept.proof.text, at: from }, screenItem(image, round(from + 0.5), 0.55)];
  const items = statementItems(concept.proof.text, from);
  if (concept.copy.description) items.push({ type: "stamp", text: concept.copy.description, at: round(from + 3) });
  return items;
}

/**
 * A first peca.json for a concept, from its template: the hook in the first 3 seconds (visible
 * in frame 0, the cover), the barrier or the product, the mechanism and the call with the brand.
 * Only the concept's own texts and the member's images go in; what the template cannot know
 * (a card with the product's real fields) is the AI's to write, and `todo` says so.
 */
export function draftPiece(concept, { brand, images = [], title }) {
  const image = images[0] ?? null;
  const todo = [];
  let template = concept.template;
  if (template === "produto-em-uso" && !image) {
    todo.push("O modelo produto-em-uso precisa de uma tela do produto: sem nenhuma em materiais/ nem no site capturado, a peça saiu no modelo problema-mecanismo.");
    template = "problema-mecanismo";
  }
  let scenes;
  if (template === "produto-em-uso") {
    scenes = [
      { from: 0, to: 3, role: "gancho", items: hookItems(concept.hook.text) },
      { from: 3, to: 11, role: "produto", items: [{ type: "caption", text: concept.proof.text, at: 3 }, screenItem(image, 3.5, 0.62)] },
      { from: 11, to: 15, role: "chamada", align: "center", items: ctaItems(concept, 11) },
    ];
  } else if (template === "lista") {
    const parts = listParts(concept.hook.text);
    const opening = parts
      ? [{ type: "list", items: parts, times: parts.map((_, index) => (index === 0 ? -1 : round(index * 0.5))), accent_last: true, at: -1 }]
      : hookItems(concept.hook.text);
    if (!parts) todo.push("O gancho não é uma lista curta (de 3 a 6 partes terminadas em ponto, cada uma com até 28 caracteres): a abertura saiu como título.");
    scenes = [
      { from: 0, to: 4, role: "gancho", items: opening },
      { from: 4, to: 7, role: "contraste", items: statementItems(concept.driver.text, 4) },
      { from: 7, to: 12, role: "mecanismo", items: mechanismItems(concept, image, 7) },
      { from: 12, to: 15, role: "chamada", align: "center", items: ctaItems(concept, 12) },
    ];
  } else {
    scenes = [
      { from: 0, to: 3, role: "gancho", items: hookItems(concept.hook.text) },
      { from: 3, to: 7, role: "problema", items: statementItems(concept.driver.text, 3) },
      { from: 7, to: 12, role: "mecanismo", items: mechanismItems(concept, image, 7) },
      { from: 12, to: 15, role: "chamada", align: "center", items: ctaItems(concept, 12) },
    ];
  }
  if (!image && template !== "produto-em-uso") todo.push("A cena do mecanismo não tem imagem do produto: ponha uma tela em materiais/ (ou capture o site) e rode piece com --force, ou escreva em peca.json um cartão (card) com os campos reais do produto.");
  const seed = [...concept.key].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 97 + 1;
  return {
    piece: {
      version: PIECE_VERSION,
      concept: concept.key,
      title: title ?? concept.key,
      template,
      format: "9:16",
      duration: DURATION.fallback,
      bpm: BPM,
      music: { style: MUSIC_FOR[concept.visual] ?? "clean", seed },
      brand,
      scenes,
    },
    todo,
  };
}

// ---------------------------------------------------------------- the check

const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const onBeat = (t, bpm) => Math.abs((t * bpm) / 60 - Math.round((t * bpm) / 60)) < 1e-6;

function checkText(path, value, max) {
  if (typeof value !== "string" || !value.trim()) throw invalid(path, "falta o texto.");
  if (value.length > max) throw invalid(path, `${value.length} caracteres; o máximo aqui é ${max}, para o texto caber na zona segura com letra legível.`, "Encurte o texto: num anúncio, cada cena diz uma coisa só.");
}

/** A file of the piece, inside its folder ("imagens/tela-1.png"). */
function pieceFile(pieceDir, path, at) {
  if (typeof path !== "string" || !path.trim() || isAbsolute(path) || /^[a-z]+:/i.test(path)) throw invalid(at, "o arquivo precisa ser um caminho dentro da pasta da peça, como imagens/tela-1.png.");
  const full = resolve(pieceDir, normalize(path));
  const inside = relative(pieceDir, full);
  if (inside.startsWith("..") || isAbsolute(inside)) throw invalid(at, `${path} fica fora da pasta da peça.`);
  if (!isFile(full)) throw invalid(at, `não encontrei ${path} na pasta da peça.`, "Rode piece de novo: ele copia o logo e as telas para imagens/.");
  return inside.split(sep).join("/");
}

/**
 * Checks peca.json: scenes back to back from 0 to the duration, every cut on the beat, the
 * first frame with text (the cover), known items with texts that fit, files inside the piece.
 * Returns the piece with defaults filled in.
 */
export function checkPiece(piece, { pieceDir }) {
  if (!piece || typeof piece !== "object") throw invalid("(raiz)", "o arquivo não é um objeto JSON.");
  if (piece.version !== PIECE_VERSION) throw invalid("version", `a versão precisa ser ${PIECE_VERSION}.`);
  if (piece.format !== "9:16") throw invalid("format", "a peça é desenhada em 9:16; os outros formatos saem dela.");
  const bpm = piece.bpm ?? BPM;
  if (!isNumber(bpm) || bpm < 80 || bpm > 160) throw invalid("bpm", "o andamento vai de 80 a 160 batidas por minuto.");
  const duration = piece.duration;
  if (!isNumber(duration) || duration < DURATION.min || duration > DURATION.max) throw invalid("duration", `a duração vai de ${DURATION.min} a ${DURATION.max} segundos: a Meta recomenda até 15 nos Reels e nos Stories.`);
  if (!onBeat(duration, bpm)) throw invalid("duration", `${duration} s não cai numa batida de ${bpm} BPM.`, `Use um múltiplo de ${round(60 / bpm)} s.`);
  const music = { style: piece.music?.style ?? "clean", seed: piece.music?.seed ?? 1 };
  if (!MUSIC_STYLES.includes(music.style)) throw invalid("music.style", `o estilo da trilha é um de: ${MUSIC_STYLES.join(", ")}.`);
  if (!Number.isInteger(music.seed) || music.seed < 1) throw invalid("music.seed", "a semente é um número inteiro a partir de 1.");
  const brand = piece.brand ?? {};
  const colors = { ...NEUTRAL, ...(brand.colors ?? {}) };
  for (const [key, value] of Object.entries(colors)) if (!HEX.test(String(value))) throw invalid(`brand.colors.${key}`, `"${value}" não é uma cor em hexadecimal, como #1F6F78.`);
  const logo = brand.logo ? pieceFile(pieceDir, brand.logo, "brand.logo") : null;
  const fonts = (brand.fonts ?? []).map((font, index) => ({ file: pieceFile(pieceDir, font.file, `brand.fonts[${index}].file`), weight: font.weight === 700 ? 700 : 500 }));
  if (!Array.isArray(piece.scenes) || piece.scenes.length < 2 || piece.scenes.length > LIMITS.scenes) throw invalid("scenes", `a peça tem de 2 a ${LIMITS.scenes} cenas.`);
  let cursor = 0;
  const scenes = piece.scenes.map((scene, index) => {
    const at = (field) => `scenes[${index}]${field ? `.${field}` : ""}`;
    if (!scene || !isNumber(scene.from) || !isNumber(scene.to)) throw invalid(at(), "cada cena tem from e to, em segundos.");
    if (Math.abs(scene.from - cursor) > 1e-6) throw invalid(at("from"), `a cena começa em ${scene.from} s e a anterior termina em ${cursor} s: as cenas vão em sequência, sem buraco.`);
    if (!onBeat(scene.from, bpm)) throw invalid(at("from"), `o corte em ${scene.from} s não cai numa batida de ${bpm} BPM.`, `Os cortes ficam em múltiplos de ${round(60 / bpm)} s.`);
    if (scene.to - scene.from < 1 - 1e-6) throw invalid(at("to"), "cada cena dura pelo menos 1 s.");
    cursor = scene.to;
    if (!Array.isArray(scene.items) || !scene.items.length || scene.items.length > LIMITS.scene_items) throw invalid(at("items"), `cada cena tem de 1 a ${LIMITS.scene_items} itens.`);
    const items = scene.items.map((item, itemIndex) => checkItem(item, { path: `${at(`items[${itemIndex}]`)}`, scene, first: index === 0, pieceDir, logo }));
    return { from: scene.from, to: scene.to, role: typeof scene.role === "string" ? scene.role : null, align: scene.align === "center" ? "center" : "start", items };
  });
  if (Math.abs(cursor - duration) > 1e-6) throw invalid("scenes", `a última cena termina em ${cursor} s e a peça dura ${duration} s.`);
  const cover = scenes[0].items.some((item) => TEXT_TYPES.includes(item.type) && itemTimes(item)[0] <= -FADE);
  if (!cover) throw invalid("scenes[0]", "o primeiro quadro não tem texto: a capa do anúncio é o quadro 0, e o gancho precisa estar nele.", 'Dê "at": -1 ao primeiro título da primeira cena.');
  return { ...piece, bpm, music, brand: { name: String(brand.name ?? ""), logo, colors, fonts }, scenes };
}

const FADE = 0.22;

function checkItem(item, { path, scene, first, pieceDir, logo }) {
  if (!item || !ITEM_TYPES.includes(item.type)) throw invalid(`${path}.type`, `o item precisa ser um de: ${ITEM_TYPES.join(", ")}.`);
  const at = item.at ?? scene.from;
  if (!isNumber(at)) throw invalid(`${path}.at`, "o instante é um número de segundos.");
  if (at >= scene.to) throw invalid(`${path}.at`, `o item aparece em ${at} s, depois do fim da cena (${scene.to} s).`);
  if (at < scene.from && !first) throw invalid(`${path}.at`, "só os itens da primeira cena podem estar na tela antes do começo dela (a capa).");
  for (const key of ["sweep_at", "tap_at"]) if (item[key] !== undefined && !isNumber(item[key])) throw invalid(`${path}.${key}`, "é um instante, em segundos.");
  const out = { ...item, at };
  switch (item.type) {
    case "title":
    case "caption":
      checkText(`${path}.text`, item.text, LIMITS[item.type]);
      break;
    case "quote":
      checkText(`${path}.text`, item.text, LIMITS.quote);
      if (item.when !== undefined) checkText(`${path}.when`, item.when, LIMITS.when);
      break;
    case "stamp":
    case "pill":
      checkText(`${path}.text`, item.text, LIMITS[item.type]);
      break;
    case "list": {
      if (!Array.isArray(item.items) || item.items.length < 2 || item.items.length > LIMITS.list_items) throw invalid(`${path}.items`, `a lista tem de 2 a ${LIMITS.list_items} partes.`);
      item.items.forEach((text, index) => checkText(`${path}.items[${index}]`, text, LIMITS.list_item));
      if (item.times !== undefined) {
        if (!Array.isArray(item.times) || item.times.length !== item.items.length || !item.times.every(isNumber)) throw invalid(`${path}.times`, "times tem um instante por parte da lista.");
        if (item.times.some((t) => t >= scene.to)) throw invalid(`${path}.times`, "uma parte da lista aparece depois do fim da cena.");
      }
      break;
    }
    case "card": {
      if (item.title !== undefined) checkText(`${path}.title`, item.title, LIMITS.field_label);
      if (!Array.isArray(item.fields) || !item.fields.length || item.fields.length > LIMITS.card_fields) throw invalid(`${path}.fields`, `o cartão tem de 1 a ${LIMITS.card_fields} campos.`);
      item.fields.forEach((field, index) => {
        checkText(`${path}.fields[${index}].label`, field?.label, LIMITS.field_label);
        checkText(`${path}.fields[${index}].value`, field?.value, LIMITS.field_value);
        if (field.chip !== undefined) checkText(`${path}.fields[${index}].chip`, field.chip, LIMITS.chip);
      });
      break;
    }
    case "screen":
      out.src = pieceFile(pieceDir, item.src, `${path}.src`);
      if (item.motion !== undefined && !MOTIONS.includes(item.motion)) throw invalid(`${path}.motion`, `o movimento da tela é um de: ${MOTIONS.join(", ")}.`);
      if (item.height !== undefined && (!isNumber(item.height) || item.height < 0.25 || item.height > 0.8)) throw invalid(`${path}.height`, "a altura da tela é uma fração da zona, de 0,25 a 0,8.");
      break;
    case "logo":
      if (!logo) out.brand_text = true;
      break;
    default:
      break;
  }
  return out;
}

// ---------------------------------------------------------------- the still image

export const POSTER_FORMATS = ["4:5", "1:1"];

/**
 * The still image of a piece (kind "poster"), for the feed: the hook, the proof of the mechanism
 * (the product's screen or card, else its statement), the logo and the button, all on screen at
 * once. The AI can write its own in peca.json (`poster`); without it, it comes from the scenes.
 */
export function posterOf(piece) {
  if (piece.poster && typeof piece.poster === "object") return { version: PIECE_VERSION, ...piece.poster, kind: "poster", duration: 1, brand: piece.poster.brand ?? piece.brand, concept: piece.concept };
  const first = piece.scenes[0];
  const items = [];
  const list = first.items.find((item) => item.type === "list");
  const titles = first.items.filter((item) => item.type === "title" || item.type === "caption");
  if (list) items.push({ type: "title", text: list.items.join(" "), accent: list.items[list.items.length - 1], at: -1 });
  else titles.slice(0, 2).forEach((item, index) => items.push({ type: "title", text: item.text, accent: index === 1 ? true : item.accent, at: -1 }));
  const middle = piece.scenes.slice(1, -1).flatMap((scene) => scene.items);
  const visual = middle.find((item) => item.type === "screen" || item.type === "card");
  if (visual?.type === "screen") items.push({ type: "screen", src: visual.src, motion: "parado", height: 0.42, at: -1 });
  else if (visual?.type === "card") items.push({ type: "card", title: visual.title, fields: visual.fields.slice(0, 2).map((field) => ({ ...field, at: -10 })), at: -1 });
  else {
    const statement = middle.find((item) => item.type === "title" || item.type === "caption");
    if (statement && items.length < 2) items.push({ type: "caption", text: statement.text, at: -1 });
  }
  const closing = piece.scenes[piece.scenes.length - 1].items;
  if (closing.some((item) => item.type === "logo")) items.push({ type: "logo", scale: 0.8, at: -1 });
  const pill = closing.find((item) => item.type === "pill");
  if (pill) items.push({ type: "pill", text: pill.text, at: -1 });
  return { version: PIECE_VERSION, kind: "poster", concept: piece.concept, title: `${piece.title} imagem`, format: "4:5", duration: 1, bpm: piece.bpm, brand: piece.brand, scenes: [{ from: 0, to: 1, role: "imagem", align: "start", items }] };
}

/** Checks a still image: known items with texts that fit, a text on it, files inside the piece. */
export function checkPoster(poster, { pieceDir, brand }) {
  if (!poster || poster.kind !== "poster") throw invalid("poster", "a imagem precisa ser um objeto com kind poster.");
  if (!POSTER_FORMATS.includes(poster.format)) throw invalid("poster.format", `a imagem é desenhada em ${POSTER_FORMATS.join(" ou ")}.`);
  const scene = Array.isArray(poster.scenes) && poster.scenes.length === 1 ? poster.scenes[0] : null;
  if (!scene || !Array.isArray(scene.items) || !scene.items.length || scene.items.length > LIMITS.scene_items) throw invalid("poster.scenes", `a imagem tem uma cena só, com de 1 a ${LIMITS.scene_items} itens.`);
  const box = { from: 0, to: 1 };
  const items = scene.items.map((item, index) => checkItem({ ...item, at: item.at ?? -1 }, { path: `poster.scenes[0].items[${index}]`, scene: box, first: true, pieceDir, logo: brand.logo }));
  if (!items.some((item) => TEXT_TYPES.includes(item.type))) throw invalid("poster", "a imagem precisa de um texto: ela é lida parada no feed.");
  return { ...poster, version: PIECE_VERSION, duration: 1, brand, scenes: [{ from: 0, to: 1, role: "imagem", align: scene.align === "center" ? "center" : "start", items }] };
}

/** When each part of an item appears: one instant, or one per part of a list. */
export function itemTimes(item) {
  if (item.type === "list") return item.times ?? item.items.map((_, index) => round(item.at + index * (item.every ?? 0.5)));
  return [item.at];
}

// ---------------------------------------------------------------- what the piece shows and plays

/** Every text the piece shows, with its scene and instant: the member reads this before the yes. */
export function screenTexts(piece) {
  const out = [];
  piece.scenes.forEach((scene, index) => {
    for (const item of scene.items) {
      const t = Math.max(0, itemTimes(item)[0]);
      if (item.type === "list") item.items.forEach((text, part) => out.push({ scene: index + 1, role: scene.role, t: Math.max(0, itemTimes(item)[part]), text }));
      else if (item.type === "quote") out.push({ scene: index + 1, role: scene.role, t, text: item.when ? `${item.when}: ${item.text}` : item.text });
      else if (item.type === "card") item.fields.forEach((field) => out.push({ scene: index + 1, role: scene.role, t, text: `${field.label}: ${field.value}`, ui: true }));
      else if (item.type === "logo") out.push({ scene: index + 1, role: scene.role, t, text: piece.brand?.logo ? "(logo)" : piece.brand?.name ?? "", logo: true });
      else if (item.text) out.push({ scene: index + 1, role: scene.role, t, text: item.text });
    }
  });
  return out;
}

/** The beat grid of the piece, as the Motor's accept reads it (--beats). */
export function beatGrid(piece) {
  const step = 60 / piece.bpm;
  const beats = [];
  for (let index = 0; index * step < piece.duration - 1e-6; index++) beats.push(round(index * step, 4));
  return { format_version: 1, source: "peca", bpm: piece.bpm, offset: 0, beats_per_bar: 4, duration: piece.duration, beats, downbeats: beats.filter((_, index) => index % 4 === 0) };
}

/** The effects under the cuts and the gestures of the screen, as the Motor's `sfx --events` reads them. */
export function eventsOf(piece) {
  const events = [];
  const last = piece.scenes.length - 1;
  piece.scenes.forEach((scene, index) => {
    if (index > 0) events.push({ t: scene.from, type: index === last ? "impact" : "whoosh", gain_db: index === last ? -3 : -6 });
    for (const item of scene.items) {
      if (item.type === "list") itemTimes(item).forEach((t) => t > 0 && events.push({ t, type: "pop", gain_db: -8 }));
      if (item.type === "card") item.fields.forEach((field, fieldIndex) => events.push({ t: typeof field.at === "number" ? field.at : round(item.at + 0.6 + fieldIndex * 1.2), type: "click", gain_db: -8 }));
      if (item.type === "stamp") events.push({ t: item.at, type: "ding", gain_db: -10 });
    }
  });
  const kept = events.filter((event) => event.t > 0 && event.t < piece.duration - 0.05).sort((a, b) => a.t - b.t);
  return { duration: piece.duration, events: kept };
}

// ---------------------------------------------------------------- the page

const htmlText = (text) => String(text ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
const jsonInHtml = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

/** The page the Motor renders: the piece and the safe zones as data, ad.js and motion.js beside it. */
export function pageHtml(piece, { zones }) {
  const c = piece.brand.colors;
  const fonts = piece.brand.fonts ?? [];
  const faces = fonts.map((font) => `@font-face { font-family: "Marca"; src: url("${font.file}"); font-weight: ${font.weight}; }`).join("\n");
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${htmlText(piece.title)}</title>
<link rel="stylesheet" href="ad.css">
<style>
${faces}
:root { --fundo: ${c.background}; --texto: ${c.text}; --destaque: ${c.accent}; --destaque-suave: ${translucent(c.accent, 0.28)}; --superficie: ${c.surface}; --suave: ${c.muted};${fonts.length ? ' --fonte: "Marca", "Segoe UI", Arial, sans-serif;' : ""} }
</style>
</head>
<body>
<div id="stage"></div>
<script id="peca" type="application/json">${jsonInHtml(piece)}</script>
<script id="zonas" type="application/json">${jsonInHtml(zones)}</script>
<script src="motion.js"></script>
<script src="ad.js"></script>
<script>Ad.start(JSON.parse(document.getElementById("peca").textContent), JSON.parse(document.getElementById("zonas").textContent));</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------- the brand

function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function expandHex(hex) {
  const clean = String(hex ?? "").trim();
  if (!HEX.test(clean)) return null;
  return clean.length === 4 ? `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`.toUpperCase() : clean.toUpperCase();
}

export function luminance(hex) {
  const full = expandHex(hex);
  if (!full) return null;
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(full.slice(index, index + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return 0;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** "#1F6F78" at 28% → "rgba(31, 111, 120, 0.28)". */
export function translucent(hex, alpha) {
  const full = expandHex(hex) ?? NEUTRAL.accent;
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(full.slice(index, index + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mix(a, b, amount) {
  const pa = expandHex(a);
  const pb = expandHex(b);
  const parts = [1, 3, 5].map((index) => Math.round(parseInt(pa.slice(index, index + 2), 16) * (1 - amount) + parseInt(pb.slice(index, index + 2), 16) * amount));
  return `#${parts.map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/**
 * The page's colours from the brand's own (the capture of the site), never a "similar" one: a
 * colour that would not read on the background is replaced by the text colour, and a missing
 * one by the neutral palette.
 */
export function paletteFrom(colors = {}) {
  const background = expandHex(colors.background) ?? NEUTRAL.background;
  const dark = luminance(background) < 0.3;
  const ownText = expandHex(colors.text);
  const text = ownText && contrast(ownText, background) >= 4.5 ? ownText : dark ? "#F4F1EA" : "#1E1D1B";
  const ownAccent = expandHex(colors.primary ?? colors.accent);
  const accent = ownAccent && contrast(ownAccent, background) >= 2.6 ? ownAccent : text;
  const surface = dark ? mix(background, "#FFFFFF", 0.08) : "#FFFFFF";
  return { background, text, accent, surface, muted: mix(text, background, 0.3) };
}

// ---------------------------------------------------------------- images

/** Width and height of a PNG or JPEG file; null for other files or a broken header. */
export function imageSize(path) {
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch {
    return null;
  }
  if (bytes.length > 24 && bytes.readUInt32BE(0) === 0x89504e47) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
      offset += 2 + length;
    }
  }
  return null;
}

export const IMAGE_FILE = /\.(?:png|jpe?g|webp|svg)$/i;
export const FONT_FILE = /\.(?:otf|ttf|woff2?)$/i;

/** A font file's weight from its name: bold and heavier are 700, the rest 500. */
export const fontWeight = (name) => (/bold|black|heavy|semibold|700|800|900/i.test(name) ? 700 : 500);

/** An image name inside the piece's imagens/ folder: "tela-1.png". */
export const imageTarget = (prefix, index, source) => join("imagens", `${prefix}${index === null ? "" : `-${index + 1}`}${extname(source).toLowerCase()}`);
