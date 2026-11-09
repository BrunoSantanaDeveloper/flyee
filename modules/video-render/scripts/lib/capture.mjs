// Site capture: opens a site in the headless browser, photographs it at desktop and phone sizes,
// records a scroll, reads the brand from the DOM (logo, colors, fonts, texts, numbers, prices,
// social links) and saves everything into one folder with captura.json.
//
// The pure helpers at the top run in Node and have unit tests; the `*InPage` functions are
// serialized with `toString()` and run inside the page, so they use only DOM APIs and never
// reference anything from this module.

import { readFileSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Browser } from "./browser.mjs";
import { writeSheet } from "./sheet.mjs";
import { startEncoder } from "./ffmpeg.mjs";
import { AppError, clamp, ensureDir, fileUrl, isFile, mapLimit, round, sleep, slugify, writeFileAtomic, writeJson } from "./util.mjs";

export const CAPTURE_FORMAT_VERSION = 1;
export const DESKTOP_HEIGHT = 900;
export const MOBILE_HEIGHT = 844;
export const MOBILE_SCALE = 2;
/** CSS pixels of the full-page screenshot; beyond this the file stops being useful and the browser gets slow. */
export const MAX_FULL_HEIGHT = 8000;
/** Device pixels the browser can paint into one screenshot. */
const MAX_DEVICE_HEIGHT = 16000;
/** CSS pixels the scroll recording travels at most. */
export const MAX_SCROLL = 4000;
const NETWORK_QUIET_MS = 2000;
const ASSET_TIMEOUT_MS = 20000;
const ASSET_MAX_BYTES = 10 * 1024 * 1024;
const MAX_LOGO_DOWNLOADS = 4;
export const MOBILE_USER_AGENT ="Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const DESKTOP_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
export const ACCEPT_LANGUAGE = "pt-BR,pt;q=0.9,en;q=0.8";

// ---------------------------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------------------------

const NAMED_COLORS = {
  white: "#FFFFFF", black: "#000000", red: "#FF0000", blue: "#0000FF", green: "#008000", yellow: "#FFFF00", orange: "#FFA500",
  purple: "#800080", pink: "#FFC0CB", gray: "#808080", grey: "#808080", silver: "#C0C0C0", navy: "#000080", teal: "#008080",
};

const to255 = (value) => Math.max(0, Math.min(255, Math.round(value)));
const hexOf = (r, g, b) => `#${[r, g, b].map((v) => to255(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
const gamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const degamma = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** A channel given as a number or a percentage, scaled to `scale` at 100%. */
function channel(text, scale) {
  if (text === undefined || text === "none") return 0;
  if (text.endsWith("%")) return (parseFloat(text) / 100) * scale;
  return parseFloat(text);
}

function parseAlpha(text) {
  if (text === undefined || text === null || text === "") return 1;
  const t = String(text).trim();
  const value = t.endsWith("%") ? parseFloat(t) / 100 : parseFloat(t);
  return Number.isFinite(value) ? value : 1;
}

function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function linearToRgb(r, g, b) {
  return [r, g, b].map((c) => gamma(Math.max(0, Math.min(1, c))) * 255);
}

function oklabToRgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return linearToRgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
}

function xyzToRgb(x, y, z) {
  return linearToRgb(3.2404542 * x - 1.5371385 * y - 0.4985314 * z, -0.969266 * x + 1.8760108 * y + 0.041556 * z, 0.0556434 * x - 0.2040259 * y + 1.0572252 * z);
}

function labToRgb(L, a, b) {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inv = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  return xyzToRgb(inv(fx) * 0.95047, inv(fy) * 1.0, inv(fz) * 1.08883);
}

function p3ToRgb(r, g, b) {
  const [lr, lg, lb] = [r, g, b].map(degamma);
  const x = 0.4865709 * lr + 0.2656677 * lg + 0.1982173 * lb;
  const y = 0.2289746 * lr + 0.6917385 * lg + 0.0792869 * lb;
  const z = 0.0 * lr + 0.0451134 * lg + 1.0439444 * lb;
  return xyzToRgb(x, y, z);
}

/**
 * Any CSS color the browser may report → "#RRGGBB", or null when it is (nearly) transparent
 * or unreadable. Handles hex, rgb/rgba, hsl, oklch/oklab, lab/lch and color(srgb|display-p3).
 */
export function toHex(color) {
  if (typeof color !== "string") return null;
  const text = color.trim().toLowerCase();
  if (!text || ["transparent", "none", "currentcolor", "inherit", "initial", "unset"].includes(text)) return null;
  if (NAMED_COLORS[text]) return NAMED_COLORS[text];
  let m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text);
  if (m) {
    let hex = m[1];
    if (hex.length <= 4) hex = hex.split("").map((c) => c + c).join("");
    if (hex.length === 8) {
      if (parseInt(hex.slice(6, 8), 16) < 6) return null;
      hex = hex.slice(0, 6);
    }
    return `#${hex}`.toUpperCase();
  }
  m = /^(rgba?|hsla?|oklch|oklab|lab|lch|color)\((.*)\)$/.exec(text);
  if (!m) return null;
  const fn = m[1];
  let inner = m[2].trim();
  let alpha = 1;
  const slash = inner.indexOf("/");
  if (slash >= 0) {
    alpha = parseAlpha(inner.slice(slash + 1));
    inner = inner.slice(0, slash);
  }
  const parts = inner.split(/[\s,]+/).filter(Boolean);
  let space = "srgb";
  if (fn === "color") space = parts.shift() ?? "srgb";
  if (slash < 0 && parts.length === 4) alpha = parseAlpha(parts.pop());
  if (alpha <= 0.02) return null;
  if (parts.length < 3) return null;
  const [a, b, c] = parts;
  let rgb;
  switch (fn) {
    case "rgb":
    case "rgba":
      rgb = [channel(a, 255), channel(b, 255), channel(c, 255)];
      break;
    case "hsl":
    case "hsla":
      rgb = hslToRgb(parseFloat(a) || 0, channel(b, 1), channel(c, 1));
      break;
    case "oklch": {
      const L = channel(a, 1);
      const C = channel(b, 0.4);
      const h = ((parseFloat(c) || 0) * Math.PI) / 180;
      rgb = oklabToRgb(L, C * Math.cos(h), C * Math.sin(h));
      break;
    }
    case "oklab":
      rgb = oklabToRgb(channel(a, 1), channel(b, 0.4), channel(c, 0.4));
      break;
    case "lab":
      rgb = labToRgb(channel(a, 100), channel(b, 125), channel(c, 125));
      break;
    case "lch": {
      const h = ((parseFloat(c) || 0) * Math.PI) / 180;
      const C = channel(b, 150);
      rgb = labToRgb(channel(a, 100), C * Math.cos(h), C * Math.sin(h));
      break;
    }
    case "color":
      if (space === "display-p3") rgb = p3ToRgb(channel(a, 1), channel(b, 1), channel(c, 1));
      else if (space === "srgb-linear") rgb = linearToRgb(channel(a, 1), channel(b, 1), channel(c, 1));
      else rgb = [channel(a, 1) * 255, channel(b, 1) * 255, channel(c, 1) * 255];
      break;
    default:
      return null;
  }
  if (rgb.some((v) => !Number.isFinite(v))) return null;
  return hexOf(...rgb);
}

/** Hue (0–360), saturation and lightness (0–1) of a "#RRGGBB". */
export function hslOf(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? "");
  if (!m) return null;
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => parseInt(v, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h: round(h, 1), s: round(s, 3), l: round(l, 3) };
}

/** Merges computed-color tallies into hex entries, summing areas of colors that map to the same hex. */
export function colorTally(entries, { top = 10 } = {}) {
  const totals = new Map();
  for (const entry of entries ?? []) {
    const hex = toHex(entry.color);
    if (!hex) continue;
    totals.set(hex, (totals.get(hex) ?? 0) + Number(entry.area ?? 0));
  }
  const list = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([hex, area]) => ({ hex, area: Math.round(area) }));
  const total = list.reduce((sum, item) => sum + item.area, 0) || 1;
  return list.slice(0, top).map((item) => ({ ...item, share: round(item.area / total, 3) }));
}

/**
 * A color a brand could own: enough chroma (saturation alone is high in near-blacks like
 * #111827) and neither near-white nor near-black.
 */
export function isAccent(hex) {
  const hsl = hslOf(hex);
  if (!hsl) return false;
  const chroma = hsl.s * (1 - Math.abs(2 * hsl.l - 1));
  return chroma >= 0.15 && hsl.l >= 0.08 && hsl.l <= 0.92;
}

/**
 * The brand's primary color: the saturated accent that buttons use most, then link colors,
 * the declared theme-color and the palette. Null when the site has no accent at all.
 */
export function pickPrimary({ cta = [], links = [], themeColor = null, palette = [] } = {}) {
  const scores = new Map();
  const add = (hex, weight) => {
    if (!hex || !isAccent(hex)) return;
    scores.set(hex, (scores.get(hex) ?? 0) + weight * (0.5 + hslOf(hex).s));
  };
  for (const hex of cta) add(hex, 3);
  for (const hex of links) add(hex, 1.5);
  add(themeColor, 2);
  for (const entry of palette) add(entry.hex, 0.5 + entry.share * 4);
  let best = null;
  for (const [hex, score] of scores) if (!best || score > best.score) best = { hex, score };
  return best?.hex ?? null;
}

// ---------------------------------------------------------------------------------------------
// Text: numbers, prices, sectors, language
// ---------------------------------------------------------------------------------------------

const COUNT_WORDS = "clientes|alunos|alunas|anos|projetos|vendas|lojas|cidades|países|paises|avaliações|avaliacoes|pacientes|empresas|membros|usuários|usuarios|seguidores|horas|aulas|unidades|procedimentos|atendimentos|estrelas|marcas|profissionais|parceiros";
/** "+2.000 clientes", "97%", "5 mil", "10k", "+300", "15 anos". Not years, phones or prices. */
export const NUMBER_PATTERN = new RegExp(`(?:[+±]\\s?)?\\d[\\d.,]*\\s*(?:%|mil\\b|k\\b|\\+|(?:${COUNT_WORDS})\\b)|[+±]\\s?\\d[\\d.,]*`, "gi");

/** "2.000" → 2000 (pt-BR thousands), "1,5" → 1.5, "5" + "mil" → 5000. */
export function numericValue(digits, unit = "") {
  let s = String(digits ?? "").trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  s = s.replace(/[.,]$/, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return /^(mil|k)$/i.test(unit) ? n * 1000 : n;
}

function sentenceAround(line, index, { max = 160 } = {}) {
  let start = 0;
  let end = line.length;
  const breaks = /[.!?;]\s+/g;
  let m;
  while ((m = breaks.exec(line))) {
    const cut = m.index + m[0].length;
    if (cut <= index) start = cut;
    else {
      end = m.index + 1;
      break;
    }
  }
  let sentence = line.slice(start, end).trim();
  if (sentence.length > max) {
    const from = Math.max(start, index - Math.floor(max / 2));
    sentence = `${from > start ? "…" : ""}${line.slice(from, from + max).trim()}…`;
  }
  return sentence;
}

/** Numbers with a unit in visible text, each with the sentence around it. */
export function findNumbers(text, { max = 20 } = {}) {
  const results = [];
  const seen = new Set();
  for (const rawLine of String(text ?? "").split(/\n+/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) continue;
    for (const m of line.matchAll(NUMBER_PATTERN)) {
      const raw = m[0].trim();
      const parsed = /^([+±])?\s?(\d[\d.,]*)\s*(.*)$/.exec(raw);
      if (!parsed) continue;
      const [, sign, digits, rest] = parsed;
      const unit = rest.trim() || (sign ? "+" : "");
      const before = line.slice(Math.max(0, m.index - 4), m.index);
      if (/\$|R\$|US\$|€/.test(before)) continue; // a price, handled apart
      if (!unit) continue;
      const plain = digits.replace(/[.,]/g, "");
      if (plain.length >= 8) continue; // a phone or a document number
      if (!sign && !rest.trim() && /^(19|20)\d{2}$/.test(plain)) continue; // a year
      const context = sentenceAround(line, m.index);
      const key = `${raw}|${context}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ text: raw, value: numericValue(digits, unit), unit, context });
      if (results.length >= max) return results;
    }
  }
  return results;
}

export const PRICE_PATTERN = /R\$\s?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|R\$\s?\d+(?:,\d{1,2})?/g;

/** "R$ 1.299,90" → 1299.9; "R$199" → 199. */
export function parsePrice(text) {
  const m = /R\$\s?([\d.]+)(?:,(\d{1,2}))?/.exec(String(text ?? ""));
  if (!m) return null;
  const whole = Number(m[1].replace(/\./g, ""));
  if (!Number.isFinite(whole)) return null;
  const cents = m[2] ? Number(m[2].padEnd(2, "0")) / 100 : 0;
  return round(whole + cents, 2);
}

const fold = (text) => String(text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const SECTORS = {
  saúde: ["clinica", "saude", "medic", "paciente", "consulta", "tratamento", "exame", "terap", "hospital", "psicolog", "nutri", "fisioterap"],
  odontologia: ["dent", "odont", "sorriso", "implante", "clareamento", "ortodont", "aparelho", "alinhador"],
  advocacia: ["advoca", "advogad", "juridic", "direito", "oab", "processo", "escritorio de advocacia"],
  apostas: ["aposta", "bet", "cassino", "casino", "odds", "bonus de boas-vindas", "palpite"],
  política: ["candidat", "vereador", "deputad", "prefeit", "senador", "partido", "eleicao", "eleitor", "mandato"],
  infantil: ["infantil", "crianca", "kids", "bebe", "brinquedo", "escolinha", "pediatr"],
  educação: ["curso", "aula", "alun", "professor", "mentoria", "escola", "faculdade", "turma", "certificado", "treinamento"],
  varejo: ["loja", "frete", "carrinho", "produto", "desconto", "compre", "oferta", "estoque", "cupom"],
  alimentação: ["restaurante", "cardapio", "delivery", "lanche", "pizza", "hamburguer", "comida", "sabor", "chef", "receita"],
  beleza: ["beleza", "estetica", "cabelo", "salao", "maquiagem", "unha", "skincare", "sobrancelha", "barbearia"],
  fitness: ["academia", "treino", "personal", "musculacao", "crossfit", "emagrec", "pilates", "yoga", "corrida"],
  imobiliário: ["imove", "imobili", "apartamento", "aluguel", "alugar", "corretor", "condominio", "lancamento"],
  software: ["software", "plataforma", "app", "aplicativo", "saas", "api", "integracao", "automacao", "dashboard", "login", "assinatura"],
};

/** Which sectors the text hints at, strongest first (score = keyword hits, each capped). */
export function sectorCues(text, { min = 2, max = 4 } = {}) {
  const folded = fold(text);
  const list = [];
  for (const [sector, keywords] of Object.entries(SECTORS)) {
    let score = 0;
    const hits = [];
    for (const keyword of keywords) {
      const re = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g");
      const count = (folded.match(re) ?? []).length;
      if (!count) continue;
      score += Math.min(count, 8);
      hits.push(keyword);
    }
    if (score >= min) list.push({ sector, score, keywords: hits });
  }
  return list.sort((a, b) => b.score - a.score).slice(0, max);
}

const LANGUAGE_WORDS = {
  pt: ["você", "não", "com", "para", "mais", "nossa", "nosso", "também", "seu", "sua", "uma", "dos", "das", "aqui", "agende", "conheça"],
  en: ["the", "and", "with", "your", "for", "our", "you", "from", "that", "this", "get", "learn", "more"],
  es: ["usted", "nuestro", "nuestra", "también", "para", "con", "los", "las", "una", "más", "aquí", "conoce"],
};

/** The declared language plus what the words suggest. */
export function languageCues(text, declared = null) {
  const words = String(text ?? "").toLowerCase().match(/[\p{L}]+/gu) ?? [];
  const counts = {};
  for (const [language, list] of Object.entries(LANGUAGE_WORDS)) {
    const set = new Set(list);
    counts[language] = words.reduce((total, word) => total + (set.has(word) ? 1 : 0), 0);
  }
  // "para" and "com" exist in both Portuguese and Spanish: tilt by the unique markers
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const detected = sorted[0][1] >= 3 && (sorted[0][1] > (sorted[1]?.[1] ?? 0) * 1.2 || sorted[0][0] === "pt") ? sorted[0][0] : null;
  return { declared: declared || null, detected, counts };
}

/** Words in a text. */
export const wordCount = (text) => (String(text ?? "").match(/\S+/g) ?? []).length;

// ---------------------------------------------------------------------------------------------
// Links: social networks, contacts, login area
// ---------------------------------------------------------------------------------------------

const SOCIAL_HOSTS = [
  ["instagram", /(^|\.)instagram\.com$/],
  ["youtube", /(^|\.)(youtube\.com|youtu\.be)$/],
  ["tiktok", /(^|\.)tiktok\.com$/],
  ["linkedin", /(^|\.)linkedin\.com$/],
  ["facebook", /(^|\.)(facebook\.com|fb\.com|fb\.me)$/],
  ["x", /(^|\.)(x\.com|twitter\.com)$/],
  ["whatsapp", /(^|\.)(wa\.me|whatsapp\.com)$/],
  ["telegram", /(^|\.)(t\.me|telegram\.me)$/],
];

/** Which network a link points to, and whether it is a profile, a post or a share button. */
export function classifySocial(href) {
  if (!href) return null;
  if (/^whatsapp:/i.test(href)) return { network: "whatsapp", url: href, kind: "profile" };
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
  const match = SOCIAL_HOSTS.find(([, pattern]) => pattern.test(host));
  if (!match) return null;
  const [network] = match;
  const path = url.pathname.toLowerCase();
  if (/sharer|\/share\b|\/intent\/|\/dialog\/|share\.php/.test(path) || (network === "x" && /\/intent/.test(path))) return { network, url: href, kind: "share" };
  const post = (network === "instagram" && /^\/(p|reel|reels|tv|stories)\//.test(path))
    || (network === "youtube" && (/^\/(watch|shorts|embed|live|playlist)/.test(path) || host === "youtu.be"))
    || (network === "tiktok" && /\/video\//.test(path))
    || (network === "facebook" && /\/(posts|videos|photos|events)\//.test(path))
    || (network === "x" && /\/status\//.test(path))
    || (network === "linkedin" && /^\/(posts|feed|pulse)\//.test(path));
  return { network, url: href, kind: post ? "post" : "profile" };
}

/** One link per network, profiles before posts, share buttons ignored. */
export function collectSocial(links) {
  const best = {};
  for (const link of links ?? []) {
    const found = classifySocial(link.href ?? link);
    if (!found || found.kind === "share") continue;
    const current = best[found.network];
    if (!current || (current.kind === "post" && found.kind === "profile")) best[found.network] = found;
  }
  return Object.fromEntries(Object.entries(best).map(([network, found]) => [network, found.url]));
}

/** E-mails, phones and WhatsApp numbers from mailto:, tel: and wa.me links. */
export function collectContacts(links) {
  const emails = new Set();
  const phones = new Set();
  const whatsapp = new Set();
  for (const link of links ?? []) {
    const href = String(link.href ?? link ?? "");
    let m = /^mailto:([^?]+)/i.exec(href);
    if (m) {
      const email = decodeURIComponent(m[1]).trim().toLowerCase();
      if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) emails.add(email);
      continue;
    }
    m = /^tel:(.+)/i.exec(href);
    if (m) {
      const digits = decodeURIComponent(m[1]).replace(/[^\d+]/g, "");
      if (digits.replace(/\D/g, "").length >= 8) phones.add(digits);
      continue;
    }
    m = /^https?:\/\/(?:www\.)?wa\.me\/(\d{8,15})/i.exec(href) ?? /^https?:\/\/(?:api\.|web\.)?whatsapp\.com\/send\/?\?(?:.*&)?phone=(\d{8,15})/i.exec(href);
    if (m) whatsapp.add(m[1]);
  }
  return { emails: [...emails].slice(0, 5), phones: [...phones].slice(0, 5), whatsapp: [...whatsapp].slice(0, 3) };
}

/** Whether the site has a login, member or app area. */
export function hasLoginArea(links) {
  return (links ?? []).some((link) => {
    const href = String(link.href ?? "");
    const text = String(link.text ?? "");
    if (/^(mailto|tel):/i.test(href)) return false;
    // no \b before "área": accented letters are not word characters for the regex engine
    return /login|entrar|minha conta|app\./i.test(`${href} ${text}`) || /(^|\s)(área|area|portal) d[oa] (paciente|cliente|aluno|aluna|membro|assinante|parceiro)/i.test(text) || /\/(signin|sign-in|account|conta|painel|dashboard)\b/i.test(href);
  });
}

// ---------------------------------------------------------------------------------------------
// JSON-LD, names, fonts, logos
// ---------------------------------------------------------------------------------------------

const ORG_TYPES = /Organization|LocalBusiness|Business|Store|Dentist|Clinic|Physician|Restaurant|Brand|Corporation|School|Agency|Service|Hotel|Gym|Salon|Shop|Attorney|Hospital/i;

/** Flattens JSON-LD blocks into what a video needs: the organization, products with prices, the site. */
export function summarizeJsonLd(blocks) {
  const items = [];
  const push = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(push);
    if (Array.isArray(node["@graph"])) node["@graph"].forEach(push);
    if (node["@type"]) items.push(node);
  };
  (blocks ?? []).forEach(push);
  const typesOf = (item) => [].concat(item["@type"] ?? []).filter((t) => typeof t === "string");
  const types = [...new Set(items.flatMap(typesOf))];
  const urlOf = (value) => {
    const v = Array.isArray(value) ? value[0] : value;
    if (typeof v === "string") return v;
    if (v && typeof v === "object") return v.url ?? v.contentUrl ?? v["@id"] ?? null;
    return null;
  };
  const text = (value) => {
    const v = Array.isArray(value) ? value[0] : value;
    if (typeof v === "string") return v.trim() || null;
    if (typeof v === "number") return String(v);
    if (v && typeof v === "object" && typeof v.name === "string") return v.name.trim() || null;
    return null;
  };
  const addressText = (address) => {
    if (!address) return null;
    if (typeof address === "string") return address.trim();
    if (Array.isArray(address)) return addressText(address[0]);
    return [address.streetAddress, address.addressLocality, address.addressRegion, address.postalCode, address.addressCountry].map(text).filter(Boolean).join(", ") || null;
  };
  const orgLike = items.find((item) => typesOf(item).some((t) => ORG_TYPES.test(t))) ?? items.find((item) => item.name && (item.logo || item.sameAs || item.address || item.telephone));
  const organization = orgLike
    ? {
        type: typesOf(orgLike).join(", ") || null,
        name: text(orgLike.name),
        legal_name: text(orgLike.legalName),
        description: text(orgLike.description),
        logo: urlOf(orgLike.logo),
        image: urlOf(orgLike.image),
        url: urlOf(orgLike.url),
        same_as: [].concat(orgLike.sameAs ?? []).filter((s) => typeof s === "string"),
        telephone: text(orgLike.telephone),
        email: text(orgLike.email),
        address: addressText(orgLike.address),
        price_range: text(orgLike.priceRange),
      }
    : null;
  const products = items
    .filter((item) => typesOf(item).some((t) => /^(Product|Service|Course|Event|SoftwareApplication|Offer)$/i.test(t)))
    .slice(0, 10)
    .map((item) => {
      const offers = [].concat(item.offers ?? (typesOf(item).includes("Offer") ? [item] : [])).filter((o) => o && typeof o === "object");
      const offer = offers[0] ?? null;
      const price = offer ? Number(offer.price ?? offer.lowPrice ?? NaN) : NaN;
      return { type: typesOf(item).join(", "), name: text(item.name), description: text(item.description)?.slice(0, 200) ?? null, image: urlOf(item.image), price: Number.isFinite(price) ? price : null, currency: offer?.priceCurrency ?? null };
    });
  const site = items.find((item) => typesOf(item).includes("WebSite"));
  const website = site ? { name: text(site.name), url: urlOf(site.url), has_search: Boolean(site.potentialAction) } : null;
  return { types, organization, products, website, same_as: organization?.same_as ?? [] };
}

/** The brand name hidden in a title: the shortest segment of "Brand | Tagline" or "Tagline - Brand". */
export function titleBrand(title) {
  const segments = String(title ?? "").split(/\s+[|–—\-:·»«›]\s+/).map((s) => s.trim()).filter((s) => s.length >= 2);
  if (!segments.length) return null;
  if (segments.length === 1) return segments[0].length <= 60 ? segments[0] : null;
  return segments.reduce((best, s) => (s.length < best.length ? s : best));
}

export function siteName({ ogSiteName = null, jsonldName = null, title = null } = {}) {
  return ogSiteName?.trim() || jsonldName?.trim() || titleBrand(title) || null;
}

/** `"Marca Display", Georgia, serif` → "Marca Display". */
export function firstFamily(fontFamily) {
  const first = String(fontFamily ?? "").split(",")[0]?.trim().replace(/^["']|["']$/g, "");
  return first || null;
}

/** Ranks logo candidates: header placement, a "logo" hint, the home link and SVG count; favicons come last. */
export function rankLogos(candidates) {
  return (candidates ?? [])
    .map((c, index) => {
      let score = 0;
      const hint = `${c.src ?? ""} ${c.alt ?? ""} ${c.class ?? ""} ${c.id ?? ""} ${c.hint ?? ""}`.toLowerCase();
      if (/logo|marca|brand/.test(hint)) score += 3;
      if (c.in_header) score += 3;
      if (c.home_link) score += 2;
      if (c.kind === "svg" || /\.svg(\?|#|$)/i.test(c.src ?? "") || /^data:image\/svg/i.test(c.src ?? "")) score += 1;
      const area = (c.width ?? c.w ?? 0) * (c.height ?? c.h ?? 0);
      if (area >= 400 && area <= 120000) score += 1;
      else if (area > 120000) score -= 1;
      if (c.visible === false) score -= 2;
      if (c.source === "icon") score -= 2;
      if (c.source === "jsonld" || c.source === "og") score += 1;
      return { ...c, score, order: c.order ?? index };
    })
    .sort((a, b) => b.score - a.score || a.order - b.order);
}

/** Logo candidates from every source the page offers, deduplicated by address. */
export function logoCandidates(raw) {
  const list = [];
  const seen = new Set();
  const add = (candidate) => {
    const key = candidate.markup ? `markup:${candidate.markup.slice(0, 200)}` : candidate.src;
    if (!key || seen.has(key)) return;
    seen.add(key);
    list.push(candidate);
  };
  for (const logo of raw.logos ?? []) add({ ...logo, source: "dom" });
  const ld = summarizeJsonLd(raw.jsonld ?? []);
  if (ld.organization?.logo) add({ kind: "img", src: ld.organization.logo, source: "jsonld", hint: "logo", in_header: false, home_link: false });
  if (raw.document?.og?.logo) add({ kind: "img", src: raw.document.og.logo, source: "og", hint: "logo", in_header: false, home_link: false });
  const icons = [...(raw.icons ?? [])].sort((a, b) => iconSize(b) - iconSize(a));
  for (const icon of icons.slice(0, 2)) add({ kind: "img", src: icon.href, source: "icon", hint: icon.rel, in_header: false, home_link: false, width: iconSize(icon), height: iconSize(icon) });
  return list;
}

/** The largest size an icon declares ("32x32 16x16" → 32), 0 when unknown. */
export function iconSize(icon) {
  const sizes = String(icon?.sizes ?? "").toLowerCase();
  if (sizes === "any") return 512;
  let best = 0;
  for (const m of sizes.matchAll(/(\d+)x(\d+)/g)) best = Math.max(best, Number(m[1]));
  if (!best && /apple-touch-icon/.test(icon?.rel ?? "")) return 180;
  return best;
}

// ---------------------------------------------------------------------------------------------
// URLs, names, files
// ---------------------------------------------------------------------------------------------

/** A page file the capture opens from disk: HTML, or a page saved by the browser as MHTML. */
const LOCAL_PAGE = /\.(?:html?|mhtml|mht)$/i;

/** Accepts "https://site.com", "site.com" and local pages (.html, .htm, .mhtml, .mht); everything else is invalid_url. */
export function normalizeUrl(input, { cwd = process.cwd() } = {}) {
  const text = String(input ?? "").trim();
  if (!text) throw new AppError("invalid_url", "Informe o endereço do site.", "Exemplo: capture https://www.exemplo.com.br --json");
  // A local page: "pagina.html", "site\index.html", "C:\...\index.html" (a drive letter is not a scheme) or a
  // page the member saved in the browser ("pagina.mhtml"), the way into a page that only opens after a login.
  if (LOCAL_PAGE.test(text) && !/^[a-z][a-z0-9+.-]*:\/\//i.test(text) && !/^file:/i.test(text)) {
    const local = resolve(cwd, text);
    if (isFile(local)) return fileUrl(local);
    if (!/^[\w.-]+\.[a-z]{2,}\//i.test(text)) throw new AppError("invalid_url", `Não encontrei o arquivo ${text}.`, "Confira o caminho do arquivo .html ou da página salva .mhtml, ou passe o endereço do site.");
  }
  let candidate = text;
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?(?:[/?#]|$)/i.test(candidate)) {
    candidate = `http://${candidate}`; // a local development server, almost never https
  } else if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate) && !/^file:/i.test(candidate)) {
    if (!/^[\w.-]+\.[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i.test(candidate)) {
      throw new AppError("invalid_url", `Não reconheci o endereço: ${text}.`, "Use um endereço completo, como https://www.exemplo.com.br, o caminho de um arquivo .html ou o de uma página salva .mhtml.");
    }
    candidate = `https://${candidate}`;
  }
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new AppError("invalid_url", `Endereço inválido: ${text}.`, "Use um endereço completo, como https://www.exemplo.com.br.");
  }
  if (!["http:", "https:", "file:"].includes(url.protocol)) {
    throw new AppError("invalid_url", `Só capturo endereços http, https ou arquivos locais (recebi ${url.protocol}).`, "Use um endereço completo, como https://www.exemplo.com.br.");
  }
  return url.href;
}

/** What the capture opened: `url` (a site), `html` (a page file) or `mhtml` (a page saved by the browser). */
export function inputKind(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return "url";
  }
  if (parsed.protocol !== "file:") return "url";
  return /\.(?:mhtml|mht)$/i.test(decodeURIComponent(parsed.pathname)) ? "mhtml" : "html";
}

/** "https://www.Clinica-Sorriso.com.br/planos" → "clinica-sorriso-com-br"; a local file → its name. */
export function hostSlug(url) {
  try {
    const u = new URL(url);
    if (u.protocol === "file:") {
      const name = basename(decodeURIComponent(u.pathname), extname(u.pathname));
      return slugify(name || "pagina-local", 40);
    }
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return host ? slugify(host.replace(/\./g, "-"), 60) : "site";
  } catch {
    return "site";
  }
}

/** What the member calls the site: the host without www, or the file name. */
export function siteLabel(url) {
  try {
    const u = new URL(url);
    if (u.protocol === "file:") return basename(decodeURIComponent(u.pathname));
    return u.hostname.replace(/^www\./, "");
  } catch {
    return String(url);
  }
}

const IMAGE_TYPES = {
  "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg",
  "image/x-icon": "ico", "image/vnd.microsoft.icon": "ico", "image/avif": "avif", "image/bmp": "bmp",
};
const IMAGE_EXTENSIONS = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".avif": "image/avif", ".bmp": "image/bmp" };

/** The image type the bytes really are, or null when they are not an image we keep. */
export function sniffImage(bytes) {
  if (!bytes || bytes.length < 12) return null;
  const head = bytes.subarray(0, 12);
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return "image/png";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head.toString("latin1", 0, 4) === "GIF8") return "image/gif";
  if (head.toString("latin1", 0, 4) === "RIFF" && head.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  if (head[0] === 0 && head[1] === 0 && head[2] === 1 && head[3] === 0) return "image/x-icon";
  if (head.toString("latin1", 4, 8) === "ftyp" && /avif|avis/.test(head.toString("latin1", 8, 12))) return "image/avif";
  if (head[0] === 0x42 && head[1] === 0x4d) return "image/bmp";
  const text = bytes.subarray(0, Math.min(bytes.length, 2000)).toString("utf8").replace(/^﻿/, "").trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(text)) return "image/svg+xml";
  return null;
}

/** ASCII-only file name for an asset: role, index and a hint from the address. */
export function assetFileName({ role, index = null, url = null, type }) {
  const ext = IMAGE_TYPES[type] ?? "bin";
  let hint = "";
  if (url && !/^data:/i.test(url)) {
    try {
      const path = decodeURIComponent(new URL(url).pathname);
      const name = basename(path, extname(path));
      const slug = slugify(name, 24);
      if (slug && slug !== "video" && !/^(logo|favicon|icon|apple-touch-icon|og-image)$/.test(slug) && !/^[0-9a-f-]{16,}$/.test(slug)) hint = `-${slug}`;
    } catch {
      // no hint
    }
  }
  return `${role}${index ? `-${index}` : ""}${hint}.${ext}`;
}

/** Width and height of a PNG from its header. */
export function pngSize(bytes) {
  if (!bytes || bytes.length < 24 || bytes[0] !== 0x89 || bytes.toString("latin1", 1, 4) !== "PNG") return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

// ---------------------------------------------------------------------------------------------
// Bot walls, scrolling
// ---------------------------------------------------------------------------------------------

const WALL_TITLES = /just a moment|attention required|access denied|checking your browser|verify you are human|are you a robot|security check|bot verification|ddos|403 forbidden|cloudflare|captcha|service unavailable|too many requests|request unsuccessful|error 1020|blocked|please wait|um momento|acesso negado|verificação de segurança/i;
const WALL_TEXTS = /verify (that )?you are (a )?human|enable javascript and cookies to continue|checking (if the site connection is|your browser)|performance & security by cloudflare|access denied|has been blocked|complete the captcha|unusual traffic|request unsuccessful|error code 1020|incapsula|perimeterx|please turn javascript on|ray id|confirme que você não é um robô|verifique que você é humano|acesso negado/i;
const BLOCK_STATUSES = new Set([401, 403, 407, 429, 503]);

/** Whether the page the browser got is a bot wall or an HTTP error page instead of the site. */
export function isBotWall({ title = "", text = "", status = null } = {}) {
  const reasons = [];
  if (WALL_TITLES.test(title ?? "")) reasons.push(`título "${String(title).trim().slice(0, 60)}"`);
  if (WALL_TEXTS.test(String(text ?? "").slice(0, 4000))) reasons.push("texto de verificação ou bloqueio");
  if (status !== null && status !== undefined && BLOCK_STATUSES.has(Number(status))) reasons.push(`HTTP ${status}`);
  const httpError = status !== null && status !== undefined && Number(status) >= 400;
  return { blocked: reasons.length > 0, http_error: httpError, status: status ?? null, reasons };
}

// A domain with no site yet answers with someone else's page: the registrar's parking page,
// the server's default page or a "coming soon". The first two carry the provider's logo and
// colors, never the brand's.
const PARKED = /parked domain|domain (name )?(is )?parked|this domain (name )?(is|has been) (parked|registered)|parked free|hostinger dns system|(this|the) domain (name )?(is |may be )?for sale|buy this domain|the owner of this domain|domínio (está )?(estacionado|à venda)|este domínio (está|pode estar|foi) (à venda|registrado|estacionado)|\bsedoparking\b|\bparkingcrew\b|\bbodis\b|\bafternic\b|\bhugedomains\b|\bdan\.com\b/i;
const DEFAULT_PAGE = /apache2? (ubuntu |debian )?default page|welcome to nginx|^\s*it works!?\s*$|iis windows server|default web site page|web server'?s default page|future home of something quite cool|^\s*index of \//i;
const COMING_SOON = /coming soon|em breve|under construction|em constru[çc][ãa]o|launching soon|em manuten[çc][ãa]o|under maintenance|maintenance mode|we'?ll be back soon|voltamos (logo|em breve)/i;
const PARKING_HOSTS = /(^|\.)(sedo\.com|dan\.com|afternic\.com|hugedomains\.com|bodis\.com|parkingcrew\.net|above\.com|undeveloped\.com|uniregistry\.com|domainmarket\.com|sav\.com)$/i;
const PLACEHOLDER_KINDS = {
  parked: "o domínio está estacionado no provedor, sem site publicado",
  default_page: "é a página padrão do servidor, sem site publicado",
  coming_soon: "a página é provisória (em breve ou em construção)",
};

/**
 * Whether the page is a placeholder instead of the brand's site: `parked` (a registrar's
 * parking or for-sale page), `default_page` (a web server's default page) or `coming_soon`.
 * Body text counts only on short pages, so a real site that mentions "em breve" is not one.
 */
export function placeholderPage({ title = "", text = "", words = null, url = null, finalUrl = null } = {}) {
  const head = String(title ?? "").trim();
  const body = String(text ?? "").slice(0, 4000);
  const count = Number.isFinite(words) ? words : (body.match(/\S+/g) ?? []).length;
  const hostOf = (value) => {
    try {
      return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return null;
    }
  };
  const asked = hostOf(url);
  const landed = hostOf(finalUrl);
  const found = (kind, evidence) => ({ kind, label: PLACEHOLDER_KINDS[kind], evidence });
  if (asked && landed && asked !== landed && PARKING_HOSTS.test(landed)) return found("parked", `levou a ${landed}`);
  if (PARKED.test(head)) return found("parked", `título "${head.slice(0, 60)}"`);
  if (count < 400 && PARKED.test(body)) return found("parked", "texto de domínio estacionado ou à venda");
  if (DEFAULT_PAGE.test(head)) return found("default_page", `título "${head.slice(0, 60)}"`);
  if (count < 150 && DEFAULT_PAGE.test(body)) return found("default_page", "texto de página padrão do servidor");
  if (COMING_SOON.test(head)) return found("coming_soon", `título "${head.slice(0, 60)}"`);
  if (count < 80 && COMING_SOON.test(body)) return found("coming_soon", "texto de página provisória");
  return null;
}

export const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

/** Scroll positions of a recording: eased from the top to `maxScroll`, one per frame. */
export function scrollPlan(frames, maxScroll) {
  const n = Math.max(1, Math.round(frames));
  if (n === 1) return [0];
  return Array.from({ length: n }, (_, i) => Math.round(easeInOutCubic(i / (n - 1)) * Math.max(0, maxScroll)));
}

// ---------------------------------------------------------------------------------------------
// The page's anatomy (pure): what an audit of an offer page reads from captura.json
// ---------------------------------------------------------------------------------------------

export const ANATOMY_FORMAT_VERSION = 1;
/** Characters of the whole page text kept for texto.md. */
export const PAGE_TEXT_MAX = 60000;
/** Characters of each section's text in captura.json (texto.md keeps the whole text). */
export const SECTION_TEXT_MAX = 4000;
/** Fixed and sticky elements kept per pass (desktop and mobile): 20 in all. */
export const FIXED_PER_PASS = 10;
const ANATOMY_LIMITS = { maxText: PAGE_TEXT_MAX, maxSections: 120, maxCtas: 200, maxFixed: FIXED_PER_PASS, maxForms: 100, maxPrices: 100, maxAnimations: 200, maxTimers: 40, maxElements: 60000 };
/** Below this, text counts as small: the size the Lighthouse legibility audit used (retired in Lighthouse 13), checked on 2026-11-08. */
const SMALL_TEXT_PX = 12;
/** From this many words on, a block of text is read, not seen at a glance. */
const READ_BLOCK_WORDS = 8;
const MAX_CARDS = 80;
const FAQ_TITLE_PATTERN = /perguntas|duvidas|faq|frequent/;
/** A band of the page in the no-letters sheet, in CSS pixels: about one screen on each device. */
const NO_LETTERS_BAND = { desktop: 1100, mobile: 1200 };
/** How far down the no-letters sheet goes. It is one image, so a longer page is cut and says so. */
const NO_LETTERS_MAX = { desktop: 16000, mobile: 9600 };
/**
 * Paints no text and keeps everything else: the color stays, so icons that use currentColor stay too.
 * What is left is what a person sees before reading anything.
 */
const NO_LETTERS_CSS = "*, *::before, *::after { -webkit-text-fill-color: transparent !important; text-shadow: none !important; text-decoration-color: transparent !important; caret-color: transparent !important; transition: none !important; } *::placeholder { -webkit-text-fill-color: transparent !important; color: transparent !important; } svg text { fill: transparent !important; stroke: transparent !important; }";
/** WCAG 2.2, 2.5.8, level AA: the minimum target, checked on 2026-11-08. */
const MIN_TARGET_PX = 24;
/** WCAG 2.2, 1.4.3: large text is 18 pt, or 14 pt in bold (24 px and 18.66 px at 96 dpi). */
const CONTRAST_LARGE_PX = 24;
const CONTRAST_LARGE_BOLD_PX = 18.66;
/** Below this ratio the reading doubts itself instead of failing the text: see contrastFrom. */
const CONTRAST_DOUBT = 1.5;
/** The app's own criteria for images on the phone, not a market rule. */
const HEAVY_IMAGE_BYTES = 500 * 1024;
const OVERSIZE_RATIO = 2;
const HEAVY_OVERSIZE_BYTES = 100 * 1024;
/** Words that say a scene's data is an example, read from the scene and from what surrounds it. */
const DEMO_LABEL_PATTERN = /exemplo|ficticio|ilustrativ|simulac|sample|example|fictional|illustrative/;
/** Two reads of the timers this far apart: a countdown changes between them, a clock time does not. */
const TIMER_GAP_MS = 1200;
/** Time for scroll handlers and transitions to settle after a jump to the end of the page. */
const SCROLL_SETTLE_MS = 500;
const TEXT_CUT_MARK = "[texto cortado em 60.000 caracteres]";

/** The accept button of a cookie banner: the banner dismissal clicks it, the anatomy leaves its banner out. */
export const COOKIE_ACCEPT_PATTERN = /^(aceitar|aceito|concordo|ok|entendi|accept( all)?|agree|got it|allow( all)?|permitir|continuar)/i;
/** Where the dismissal looks for the banner around an accept button. */
const COOKIE_HINT_PATTERN = /cookie|consent|lgpd|gdpr|privac|aviso|banner/i;
/** The name (id, class, label) of a cookie or consent banner; narrower than the hint above, because a promo "banner" is not one. */
export const COOKIE_NAME_PATTERN = /cookie|consent|lgpd|gdpr|onetrust|cookiebot|didomi|usercentrics/i;
/** The text of a cookie or consent banner. */
export const COOKIE_TEXT_PATTERN = /cookie|lgpd|gdpr|consentimento|(?<![a-z])consent(?![a-z])/i;
/**
 * A link that declines or skips an offer, read on lowercase text without accents. Such a link
 * counts as a call to action even when it does not look like a button: an audit has to find it.
 */
export const DECLINE_PATTERN = /(?:^|[^a-z])(?:nao,? obrigad[oa]|nao quero|nao tenho interesse|prefiro nao|agora nao|pular|dispensar|recusar|continuar sem|talvez depois|no,? thanks?|skip|not now|decline|maybe later)(?:[^a-z]|$)/;
/** An accessibility link that jumps to the content: never the refusal of an offer. */
export const SKIP_LINK_PATTERN = /(?:pular|ir|skip|jump) (?:para o|para a|para|ao|to the|to) (?:conteudo|conteudo principal|main|content|menu|navegacao|navigation|rodape|footer)/;
/** A timer on the page: 00:12:34, 12:34, 2d 14h 33m, "02 dias 14 horas", "33 min 12 s". */
export const TIMER_PATTERN = /(?<!\d)\d{1,2}(?:\s?:\s?\d{2}){1,3}(?!\d)|(?<![\p{L}\d])\d{1,3}\s?(?:d|dias?|days?|h|hs|hrs?|horas?|hours?|m|min|mins|minutos?|minutes?|s|seg|segs|segundos?|secs?|seconds?)(?!\p{L})\s*[:,]?\s*\d{1,2}\s?(?:d|dias?|days?|h|hs|hrs?|horas?|hours?|m|min|mins|minutos?|minutes?|s|seg|segs|segundos?|secs?|seconds?)(?!\p{L})/iu;

const foldedLine = (text) => fold(text).replace(/\s+/g, " ").trim();

/** Whether a link text declines or skips an offer ("Não, obrigado", "Pular oferta", "No thanks"), skip-to-content links aside. */
export function isDeclineText(text) {
  const folded = foldedLine(text);
  return Boolean(folded) && !SKIP_LINK_PATTERN.test(folded) && DECLINE_PATTERN.test(folded);
}

/** Whether a short text reads as a timer; the capture also demands that it changed between two reads. */
export function looksLikeTimer(text) {
  return TIMER_PATTERN.test(String(text ?? ""));
}

/** Seen in the first screen without scrolling: the element's vertical center is above the fold. Null without a viewport. */
export function aboveFold(box, viewportHeight) {
  if (!box || !Number.isFinite(viewportHeight) || viewportHeight <= 0) return null;
  const y = Number(box.y);
  const height = Math.max(0, Number(box.height) || 0);
  if (!Number.isFinite(y)) return null;
  return y + height > 0 && y + height / 2 <= viewportHeight;
}

/**
 * Where a fixed or sticky element sits on the screen: `top` or `bottom` when it touches that
 * edge (within 10% of the screen), `other` when it touches both (an overlay) or neither (a
 * floating button in the middle of the side).
 */
export function fixedEdge(box, viewportHeight) {
  if (!box || !Number.isFinite(viewportHeight) || viewportHeight <= 0) return "other";
  const margin = Math.max(8, viewportHeight * 0.1);
  const nearTop = Number(box.top) <= margin;
  const nearBottom = Number(box.bottom) >= viewportHeight - margin;
  if (nearTop && !nearBottom) return "top";
  if (nearBottom && !nearTop) return "bottom";
  return "other";
}

/**
 * `above_fold.mobile` for each desktop call to action; null when the phone does not show it, or
 * when there was no mobile reading at all. First the same element: the same path in the document
 * and the same text (no case, no accents), which holds when the site hides and shows with CSS, so
 * a menu button hidden on the phone does not take the place of the button of the same text in the
 * page. Then, for what is left (a site that builds the phone page differently), the mobile call
 * with the same text in the same order of appearance.
 */
export function matchMobileCtas(desktop, mobile, viewportHeight) {
  const list = Array.isArray(desktop) ? desktop : [];
  if (!Array.isArray(mobile)) return list.map(() => null);
  const result = list.map(() => null);
  const paired = new Set();
  const byPath = new Map();
  mobile.forEach((cta, i) => {
    if (cta?.path && !byPath.has(cta.path)) byPath.set(cta.path, i);
  });
  list.forEach((cta, index) => {
    const i = cta?.path ? byPath.get(cta.path) : undefined;
    if (i === undefined || paired.has(i) || foldedLine(mobile[i]?.text) !== foldedLine(cta?.text)) return;
    paired.add(i);
    result[index] = aboveFold(mobile[i], viewportHeight);
  });
  const pools = new Map();
  mobile.forEach((cta, i) => {
    if (paired.has(i)) return;
    const key = foldedLine(cta?.text);
    if (!pools.has(key)) pools.set(key, []);
    pools.get(key).push(cta);
  });
  const used = new Map();
  list.forEach((cta, index) => {
    if (result[index] !== null) return;
    const key = foldedLine(cta?.text);
    const nth = used.get(key) ?? 0;
    const match = pools.get(key)?.[nth];
    if (!match) return;
    used.set(key, nth + 1);
    result[index] = aboveFold(match, viewportHeight);
  });
  return result;
}

/**
 * The fixed and sticky elements of one pass: those read at the top of the page, then those that
 * showed up only after the scroll to the end. Elements are matched by the id the page reading gave
 * them. `arrival` is the reading made on arrival, before the warm-up scroll: with it,
 * `appeared_after_scroll` means "was not on screen when the page opened", so a window that a
 * scroll opens during the warm-up is not taken for one that covers the page on arrival.
 */
export function mergeFixed(top, end, { pass, viewportHeight, max = FIXED_PER_PASS, arrival = null } = {}) {
  const describe = (item, appeared) => ({
    pass,
    position: item.position === "sticky" ? "sticky" : "fixed",
    edge: fixedEdge(item, viewportHeight),
    text: String(item.text ?? "").slice(0, 280),
    height: Math.round(Number(item.height) || 0),
    ctas: Array.isArray(item.ctas) ? item.ctas : [],
    appeared_after_scroll: appeared,
  });
  const first = Array.isArray(top) ? top : [];
  const seen = new Set(first.map((item) => item.id));
  const onArrival = Array.isArray(arrival) ? new Set(arrival.map((item) => item.id)) : null;
  const appeared = (item, fallback) => (onArrival ? !onArrival.has(item.id) : fallback);
  const list = first.map((item) => describe(item, appeared(item, false)));
  for (const item of Array.isArray(end) ? end : []) if (!seen.has(item.id)) list.push(describe(item, appeared(item, true)));
  return list.slice(0, max);
}

/**
 * The windows that a scroll opened during the warm-up and that were still open in the photos:
 * read at the top after the warm-up, absent on arrival, covering most of the screen.
 */
export function windowsOpenedByWarmUp(top, arrival, viewportHeight) {
  if (!Array.isArray(top) || !Array.isArray(arrival) || !viewportHeight) return [];
  const onArrival = new Set(arrival.map((item) => item.id));
  return top.filter((item) => !onArrival.has(item.id) && fixedEdge(item, viewportHeight) === "other" && Number(item.height) >= viewportHeight * 0.6);
}

/** The video service behind an iframe: youtube, vimeo or other. */
export function iframeProvider(src) {
  let host;
  try {
    host = new URL(src).hostname.toLowerCase();
  } catch {
    return "other";
  }
  if (/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/.test(host)) return "youtube";
  if (/(^|\.)vimeo\.com$/.test(host)) return "vimeo";
  return "other";
}

/** The timers whose text changed between two reads and still reads as a timer: the countdowns. */
export function countdownsFrom(first, second, { max = 20 } = {}) {
  const now = new Map((Array.isArray(second) ? second : []).map((item) => [item.id, item.text]));
  const list = [];
  for (const item of Array.isArray(first) ? first : []) {
    const text = now.get(item.id);
    if (!text || text === item.text || !looksLikeTimer(text)) continue;
    list.push({ text, section: item.section ?? null });
    if (list.length >= max) break;
  }
  return list;
}

/** The sentence around a price, at most 120 characters, from the text of the block that holds it. */
export function priceContext(block, at) {
  const line = String(block ?? "").replace(/\s+/g, " ").trim();
  if (!line) return null;
  return sentenceAround(line, Math.max(0, Number(at) || 0), { max: 118 });
}

/**
 * texto.md: the page text in order, each section under its heading (`## heading`), at most
 * `max` characters; a cut text ends with a line that says so.
 */
export function pageText(sections, { max = PAGE_TEXT_MAX, truncated = false } = {}) {
  const parts = [];
  for (const section of Array.isArray(sections) ? sections : []) {
    const body = String(section?.text ?? "").trim();
    const heading = String(section?.heading?.text ?? "").trim();
    if (heading) parts.push(body ? `## ${heading}\n\n${body}` : `## ${heading}`);
    else if (body) parts.push(body);
  }
  let text = parts.join("\n\n");
  let cut = Boolean(truncated);
  if (text.length + 1 > max) cut = true; // the file ends with a line break
  if (cut) {
    const room = Math.max(0, max - TEXT_CUT_MARK.length - 3);
    if (text.length > room) {
      const slice = text.slice(0, room);
      const edge = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf(" "));
      text = (edge > room * 0.8 ? slice.slice(0, edge) : slice).trimEnd();
    }
    text = `${text}\n\n${TEXT_CUT_MARK}`;
  }
  return { text: text ? `${text}\n` : "", truncated: cut };
}

/** The anatomy assembled from the page readings (see anatomyInPage): the shape documented in references/interface.md. */
export function buildAnatomy({ desktop, mobile = null, viewports = {} }) {
  const top = desktop?.top ?? {};
  const end = desktop?.end ?? {};
  const size = (measured, fallback) => ({ width: measured?.width ?? fallback?.width ?? null, height: measured?.height ?? fallback?.height ?? null });
  const desktopSize = size(top.viewport, viewports.desktop);
  const mobileSize = size(mobile?.top?.viewport, viewports.mobile);

  const sections = (top.sections?.list ?? []).map((section) => ({
    index: section.index,
    heading: section.heading ? { tag: section.heading.tag, text: section.heading.text } : null,
    y: section.y,
    height: section.height,
    text: String(section.text ?? "").slice(0, SECTION_TEXT_MAX),
    words: section.words,
  }));

  const desktopCtas = top.ctas ?? [];
  const mobileFold = matchMobileCtas(desktopCtas, mobile ? mobile.top?.cta_positions ?? [] : null, mobileSize.height);
  const ctas = desktopCtas.map((cta, index) => ({
    index,
    kind: cta.kind,
    text: cta.text,
    href: cta.href ?? null,
    x: cta.x,
    y: cta.y,
    width: cta.width,
    height: cta.height,
    above_fold: { desktop: aboveFold(cta, desktopSize.height), mobile: mobileFold[index] },
    in_fixed: Boolean(cta.in_fixed),
    section: cta.section ?? null,
    disabled: Boolean(cta.disabled),
  }));

  const fixed = [
    ...mergeFixed(top.fixed, end.fixed, { pass: "desktop", viewportHeight: desktopSize.height, arrival: desktop?.arrival ?? null }),
    ...(mobile ? mergeFixed(mobile.top?.fixed, mobile.end?.fixed, { pass: "mobile", viewportHeight: mobileSize.height, arrival: mobile.arrival ?? null }) : []),
  ];

  const forms = (top.forms ?? []).map((item) => ({
    type: item.type === "radio" ? "radio" : "checkbox",
    label: item.label ?? "",
    checked: Boolean(item.checked),
    required: Boolean(item.required),
    name: item.name ?? null,
    price_text: item.price_text ?? null,
    section: item.section ?? null,
    y: item.y,
  }));

  const prices = (top.prices ?? []).map((item) => ({
    text: item.text,
    value: parsePrice(item.text),
    struck: Boolean(item.struck),
    context: priceContext(item.block, item.at),
    section: item.section ?? null,
    y: item.y,
  }));

  const media = top.media ?? {};
  const motion = top.motion ?? {};
  return {
    format_version: ANATOMY_FORMAT_VERSION,
    viewports: { desktop: desktopSize, mobile: mobileSize },
    sections,
    ctas,
    fixed,
    forms,
    prices,
    media: {
      videos: media.videos ?? [],
      iframes: (media.iframes ?? []).map((frame) => ({ src: frame.src, provider: iframeProvider(frame.src), section: frame.section ?? null })),
      images: { count: media.images?.count ?? 0, without_alt: media.images?.without_alt ?? 0 },
    },
    motion: {
      running: end.running ?? [],
      keyframes: motion.keyframes ?? [],
      transitions: motion.transitions ?? 0,
      reduced_motion_rules: motion.reduced_motion_rules ?? 0,
      smooth_scroll: Boolean(motion.smooth_scroll),
      scroll_snap: motion.scroll_snap ?? 0,
      stylesheets_unread: motion.stylesheets_unread ?? 0,
    },
    countdowns: countdownsFrom(top.timers, desktop?.again?.timer_texts),
    quality: buildQuality({ desktop: desktop?.quality ?? null, mobile: mobile?.quality ?? null, weight: mobile?.weight ?? null }),
  };
}

// ---------------------------------------------------------------------------------------------
// The measurements of the finished page (pure)
// ---------------------------------------------------------------------------------------------

/** How much of a color shows: 1 for a solid one, 0 for a color that does not paint. */
export function alphaOf(color) {
  if (typeof color !== "string") return 0;
  const text = color.trim().toLowerCase();
  if (!text || text === "transparent") return 0;
  const hex = /^#(?:[0-9a-f]{3}([0-9a-f])|[0-9a-f]{6}([0-9a-f]{2}))$/.exec(text);
  if (hex) return hex[1] ? parseInt(hex[1] + hex[1], 16) / 255 : hex[2] ? parseInt(hex[2], 16) / 255 : 1;
  const slash = /\/\s*([\d.]+%?)\s*\)$/.exec(text);
  if (slash) return parseAlpha(slash[1]);
  const legacy = /^(?:rgba|hsla)\([^,)]*,[^,)]*,[^,)]*,\s*([\d.]+%?)\s*\)$/.exec(text);
  return legacy ? parseAlpha(legacy[1]) : 1;
}

function rgbOf(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? "");
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

/** The color on screen of `top` (with its transparency) over the solid color `under`. */
function over(top, alpha, under) {
  return top.map((value, index) => value * alpha + under[index] * (1 - alpha));
}

/** The final color of a stack of backgrounds, topmost first, over the white page. */
export function compositeStack(stack) {
  let under = [255, 255, 255];
  for (const color of [...(stack ?? [])].reverse()) {
    const rgb = rgbOf(toHex(color));
    if (rgb) under = over(rgb, alphaOf(color), under);
  }
  return under;
}

/** The WCAG contrast ratio between two colors given as [r, g, b]. */
export function contrastRatio(a, b) {
  const luminance = (rgb) => {
    const [r, g, bl] = rgb.map((value) => {
      const c = value / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const hexFromRgb = (rgb) => `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

/** The pairs of text and background the page reading brought, judged by WCAG 2.2, 1.4.3. */
export function contrastFrom(read) {
  if (!Array.isArray(read?.samples)) return null;
  const failing = [];
  const unknown = {};
  let checked = 0;
  for (const sample of read.samples) {
    if (sample.unknown) {
      unknown[sample.unknown] = (unknown[sample.unknown] ?? 0) + 1;
      continue;
    }
    const textHex = toHex(sample.color);
    if (!textHex) {
      unknown.cor = (unknown.cor ?? 0) + 1;
      continue;
    }
    const background = compositeStack(sample.stack);
    const text = over(rgbOf(textHex), alphaOf(sample.color), background);
    const ratio = contrastRatio(text, background);
    // Text a person cannot see at all is rare on a page that is live; below this, the background that
    // was read is most likely not the one painted under the text (a layer the reading cannot see).
    if (ratio < CONTRAST_DOUBT) {
      unknown.camada = (unknown.camada ?? 0) + 1;
      continue;
    }
    checked += 1;
    const large = sample.font_px >= CONTRAST_LARGE_PX || (sample.bold && sample.font_px >= CONTRAST_LARGE_BOLD_PX);
    const required = large ? 3 : 4.5;
    if (ratio < required) failing.push({ role: sample.role, text: sample.text, ratio: round(ratio, 2), required, color: hexFromRgb(text), background: hexFromRgb(background), font_px: sample.font_px });
  }
  const order = { title: 0, cta: 1, heading: 2, text: 3 };
  failing.sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9) || a.ratio - b.ratio);
  return { checked, unknown, failing: failing.slice(0, 10) };
}

/** What the phone downloaded, by kind of resource. Responses still in flight count as zero. */
export function pageWeight(resources) {
  const entries = resources instanceof Map ? [...resources.values()] : [];
  const byType = {};
  let total = 0;
  for (const entry of entries) {
    const bytes = entry.bytes ?? 0;
    total += bytes;
    byType[entry.type] = (byType[entry.type] ?? 0) + bytes;
  }
  const images = entries.filter((entry) => entry.type === "Image" && entry.bytes > 0).map((entry) => ({ url: String(entry.url ?? "").slice(0, 300), bytes: entry.bytes }));
  return { total_bytes: total, by_type: byType, images };
}

/** The images of the phone pass with their weight: the heaviest first, and those served far larger than they appear. */
export function imagesFrom(read, weight) {
  if (!Array.isArray(read?.list)) return null;
  const scale = Number(read.scale) || 1;
  const bytesOf = new Map((weight?.images ?? []).map((image) => [image.url, image.bytes]));
  const items = read.list.map((image) => ({
    src: image.src,
    natural_width: image.natural_width,
    shown_width: image.shown_width,
    oversize: round(image.natural_width / Math.max(1, image.shown_width * scale), 2),
    bytes: bytesOf.get(image.src) ?? null,
  }));
  const heavy = items.filter((image) => (image.bytes ?? 0) >= HEAVY_IMAGE_BYTES).sort((a, b) => b.bytes - a.bytes).slice(0, 5);
  // A drawing in vector weighs the same at any size, so its natural width says nothing.
  const raster = items.filter((image) => !/^data:image\/svg|\.svg(?:[?#]|$)/i.test(image.src ?? ""));
  const oversized = raster.filter((image) => image.oversize >= OVERSIZE_RATIO && (image.bytes ?? HEAVY_OVERSIZE_BYTES) >= HEAVY_OVERSIZE_BYTES).sort((a, b) => b.oversize - a.oversize).slice(0, 5);
  return { count: items.length, heavy, oversized };
}

/** The `quality` block of the anatomy. A measurement that did not run stays null, so nobody takes it for a clean page. */
export function buildQuality({ desktop = null, mobile = null, weight = null } = {}) {
  const smallText = mobile?.small_text ? { ...mobile.small_text, share: mobile.small_text.total_chars ? round(mobile.small_text.small_chars / mobile.small_text.total_chars, 3) : 0 } : null;
  return {
    desktop: desktop
      ? { contrast: contrastFrom(desktop.contrast), controls: desktop.controls ?? null, demos: desktop.demos ?? null, defaults: desktop.defaults ?? null, figures: desktop.figures ?? null, cards: desktop.cards ?? null, errors: desktop.errors ?? [] }
      : null,
    mobile: mobile
      ? { overflow: mobile.overflow ?? null, small_text: smallText, tap_targets: mobile.tap_targets ?? null, controls: mobile.controls ?? null, images: imagesFrom(mobile.images, weight), weight: weight ? { total_bytes: weight.total_bytes, by_type: weight.by_type } : null, errors: mobile.errors ?? [] }
      : null,
  };
}

/**
 * The anatomy and texto.md from what the page readings returned. Any reading that failed makes
 * the whole anatomy null, with a warning: an audit must never take a missing read for a page
 * without the thing. texto.md comes from the sections when they were read, else from the text
 * of the brand reading.
 */
export function finishAnatomy({ desktop = null, mobile = null, failure = null, rawText = null, viewports = {} } = {}) {
  const warnings = [];
  const errors = [desktop?.top, desktop?.end, desktop?.again, mobile?.top, mobile?.end].filter(Boolean).flatMap((read) => read.errors ?? []);
  let reason = failure ? String(failure) : null;
  if (!reason && !desktop) reason = "a leitura não chegou a rodar";
  if (!reason && desktop && !mobile) reason = "faltou a leitura do celular";
  if (!reason && errors.length) reason = errors.slice(0, 3).join(" | ");
  let anatomy = null;
  if (!reason) {
    try {
      anatomy = buildAnatomy({ desktop, mobile, viewports });
    } catch (error) {
      reason = String(error?.message ?? error);
    }
  }
  if (!anatomy) warnings.push(`A leitura da anatomia da página falhou (${reason}): o resto da captura está completo, e o campo anatomy de captura.json ficou nulo.`);
  const opened = [
    ...(windowsOpenedByWarmUp(desktop?.top?.fixed, desktop?.arrival, desktop?.top?.viewport?.height ?? viewports.desktop?.height).length ? ["computador"] : []),
    ...(windowsOpenedByWarmUp(mobile?.top?.fixed, mobile?.arrival, mobile?.top?.viewport?.height ?? viewports.mobile?.height).length ? ["celular"] : []),
  ];
  if (opened.length) warnings.push(`Uma janela que abre com a rolagem estava aberta nas fotos do ${opened.join(" e do ")}: as fotos da tela mostram a janela por cima da página, e a anatomia a marca como aparecida depois da rolagem.`);

  const sections = desktop?.top?.sections;
  let text = null;
  if (Array.isArray(sections?.list)) text = pageText(sections.list, { truncated: Boolean(sections.truncated) });
  else if (rawText) text = pageText([{ heading: null, text: rawText }], { truncated: rawText.length >= PAGE_TEXT_MAX });
  if (text && !text.text) text = null;
  if (text?.truncated) warnings.push("O texto da página passa de 60.000 caracteres: texto.md traz o começo dele.");
  return { anatomy, text, warnings };
}

/** The anatomy's sizes for the command's answer; the anatomy itself stays in captura.json. */
export function anatomyCounts(anatomy) {
  if (!anatomy) return null;
  return {
    sections: anatomy.sections?.length ?? 0,
    ctas: anatomy.ctas?.length ?? 0,
    fixed: anatomy.fixed?.length ?? 0,
    forms: anatomy.forms?.length ?? 0,
    prices: anatomy.prices?.length ?? 0,
    videos: anatomy.media?.videos?.length ?? 0,
    animations: anatomy.motion?.running?.length ?? 0,
  };
}

// ---------------------------------------------------------------------------------------------
// In-page functions (serialized with toString(); DOM only, nothing from this module)
// ---------------------------------------------------------------------------------------------

/* eslint-disable no-undef */
function dismissCookieBannerInPage(patterns) {
  const re = new RegExp(patterns.accept.source, patterns.accept.flags);
  const cookieish = new RegExp(patterns.hint.source, patterns.hint.flags);
  const isShown = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    return r.bottom > 0 && r.top < innerHeight;
  };
  const textOf = (el) => ((el.innerText || el.value || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " "));
  const inBanner = (el) => {
    let node = el;
    for (let depth = 0; node && depth < 8; depth++) {
      const s = getComputedStyle(node);
      const id = `${node.id || ""} ${typeof node.className === "string" ? node.className : ""} ${node.getAttribute("aria-label") || ""} ${node.getAttribute("role") || ""}`;
      if (cookieish.test(id) || s.position === "fixed" || s.position === "sticky") return true;
      node = node.parentElement;
    }
    return false;
  };
  const buttons = Array.from(document.querySelectorAll("button, [role='button'], a[href], input[type='button'], input[type='submit']"));
  const matching = buttons.filter((el) => {
    const text = textOf(el);
    return text && text.length <= 40 && re.test(text) && isShown(el);
  });
  const mentionsCookies = /cookie/i.test(document.body ? document.body.innerText.slice(0, 20000) : "");
  const target = matching.find(inBanner) || (mentionsCookies ? matching[0] : null);
  if (!target) return { clicked: false, candidates: matching.length };
  window.__flyeeCookieButton = target;
  target.click();
  return { clicked: true, text: textOf(target), tag: target.tagName.toLowerCase(), candidates: matching.length };
}

function cookieButtonHiddenInPage() {
  const el = window.__flyeeCookieButton;
  if (!el) return null;
  if (!document.contains(el)) return true;
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return !(r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0);
}

function pageStateInPage() {
  const body = document.body;
  const text = body ? body.innerText || "" : "";
  return {
    url: location.href,
    title: document.title || "",
    ready_state: document.readyState,
    text: text.slice(0, 4000),
    words: (text.match(/\S+/g) || []).length,
    scroll_height: Math.max(document.documentElement.scrollHeight, body ? body.scrollHeight : 0),
    inner_height: innerHeight,
    inner_width: innerWidth,
  };
}

/**
 * Where each visible heading sits on the page, in CSS px from the top of the document, so
 * an app can scroll a screenshot of the whole page to the section a scene talks about.
 */
function headingPositionsInPage() {
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const headings = [];
  for (const el of document.querySelectorAll("h1, h2, h3")) {
    const text = clean(el.innerText);
    if (!text || text.length > 140) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) continue;
    headings.push({ tag: el.tagName.toLowerCase(), text, y: Math.round(r.top + scrollY), height: Math.round(r.height) });
    if (headings.length >= 60) break;
  }
  return { scroll_height: Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0), inner_height: innerHeight, headings };
}

/** The headings of the mobile pass with their place in the full-page screenshot (0 = top, 1 = end). */
export function mobileLayout(positions, { fullHeight, viewportHeight }) {
  if (!positions || !Array.isArray(positions.headings) || !fullHeight) return null;
  const headings = positions.headings
    .filter((heading) => heading.y >= 0 && heading.y < fullHeight)
    .map((heading) => ({ ...heading, fraction: round(heading.y / fullHeight, 4) }));
  return { full_height: fullHeight, viewport_height: viewportHeight, headings };
}

function extractInPage(limits) {
  const out = { errors: [] };
  const attempt = (name, fn) => {
    try {
      out[name] = fn();
    } catch (error) {
      out[name] = null;
      out.errors.push(`${name}: ${error && error.message ? error.message : error}`);
    }
  };
  const clean = (text) => String(text || "").replace(/\s+/g, " ").trim();
  const abs = (href, base) => {
    if (!href) return null;
    try {
      return new URL(href, base || location.href).href;
    } catch {
      return null;
    }
  };
  const meta = (selector) => {
    const el = document.querySelector(selector);
    return el ? clean(el.getAttribute("content")) || null : null;
  };
  const isTransparent = (c) => !c || c === "transparent" || /^rgba\([^)]*,\s*0(\.0+)?\s*\)$/.test(c) || /\/\s*0(\.0+)?\s*\)$/.test(c);
  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), width: Math.round(r.width), height: Math.round(r.height) };
  };
  const isShown = (el, style) => {
    const s = style || getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const isSvgInner = (el) => el instanceof SVGElement && el.tagName.toLowerCase() !== "svg";
  const headerLike = (el) => Boolean(el.closest("header, nav, [role='banner'], [class*='header' i], [class*='navbar' i], [class*='topbar' i], [id*='header' i], [class*='menu' i]"));
  const homeLink = (el) => {
    const a = el.closest("a[href]");
    if (!a) return false;
    const href = (a.getAttribute("href") || "").trim();
    if (["/", "#", "./", "index.html", "./index.html", ""].includes(href)) return true;
    try {
      const u = new URL(href, location.href);
      return u.origin === location.origin && (u.pathname === "/" || u.pathname === "/index.html") && !u.search;
    } catch {
      return false;
    }
  };
  const SVG_NS = "http://www.w3.org/2000/svg";
  const serializeSvg = (svg) => {
    const clone = svg.cloneNode(true);
    if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", SVG_NS);
    clone.removeAttribute("class");
    const computed = getComputedStyle(svg);
    clone.setAttribute("style", `color:${computed.color};${clone.getAttribute("style") || ""}`);
    for (const use of clone.querySelectorAll("use")) {
      const ref = use.getAttribute("href") || use.getAttributeNS("http://www.w3.org/1999/xlink", "href") || "";
      if (!ref.startsWith("#")) continue;
      const id = ref.slice(1);
      const target = document.getElementById(id);
      if (!target || clone.querySelector(`#${CSS.escape(id)}`)) continue;
      let defs = clone.querySelector("defs");
      if (!defs) {
        defs = document.createElementNS(SVG_NS, "defs");
        clone.insertBefore(defs, clone.firstChild);
      }
      defs.appendChild(target.cloneNode(true));
    }
    const r = svg.getBoundingClientRect();
    if (!clone.getAttribute("viewBox") && r.width && r.height) clone.setAttribute("viewBox", `0 0 ${Math.round(r.width)} ${Math.round(r.height)}`);
    if (!clone.getAttribute("width") && r.width) clone.setAttribute("width", String(Math.round(r.width)));
    if (!clone.getAttribute("height") && r.height) clone.setAttribute("height", String(Math.round(r.height)));
    const markup = new XMLSerializer().serializeToString(clone);
    return markup.length <= 200000 ? markup : null;
  };
  const everything = Array.from(document.querySelectorAll("body *")).filter((el) => !el.closest("script, style, noscript, template"));
  const sample = everything.slice(0, limits.maxElements);

  const canonical = document.querySelector('link[rel="canonical" i]');
  attempt("document", () => ({
    url: location.href,
    title: clean(document.title) || null,
    lang: document.documentElement.getAttribute("lang") || null,
    description: meta('meta[name="description" i]'),
    canonical: canonical ? abs(canonical.getAttribute("href")) : null,
    og: {
      title: meta('meta[property="og:title"]'),
      description: meta('meta[property="og:description"]'),
      image: abs(meta('meta[property="og:image"]') || meta('meta[property="og:image:url"]') || meta('meta[name="twitter:image"]')),
      site_name: meta('meta[property="og:site_name"]'),
      type: meta('meta[property="og:type"]'),
      logo: abs(meta('meta[property="og:logo"]')),
    },
    theme_color: meta('meta[name="theme-color" i]'),
    viewport_meta: meta('meta[name="viewport" i]'),
    generator: meta('meta[name="generator" i]'),
    ready_state: document.readyState,
  }));

  attempt("icons", () =>
    Array.from(document.querySelectorAll('link[rel~="icon" i], link[rel~="apple-touch-icon" i], link[rel~="apple-touch-icon-precomposed" i], link[rel="mask-icon" i]'))
      .map((link) => ({ rel: clean(link.getAttribute("rel")).toLowerCase(), href: abs(link.getAttribute("href")), sizes: link.getAttribute("sizes") || null, type: link.getAttribute("type") || null }))
      .filter((icon) => icon.href)
      .slice(0, 12));

  attempt("jsonld", () =>
    Array.from(document.querySelectorAll('script[type="application/ld+json" i]'))
      .slice(0, 20)
      .map((script) => {
        try {
          return JSON.parse(script.textContent);
        } catch {
          return null;
        }
      })
      .filter(Boolean));

  attempt("logos", () => {
    const list = [];
    let order = 0;
    const hintOf = (el) => {
      const a = el.closest("a");
      return clean([el.getAttribute("src"), el.getAttribute("alt"), el.getAttribute("class"), el.id, el.getAttribute("aria-label"), el.getAttribute("title"), a && a.getAttribute("aria-label"), a && a.getAttribute("class"), a && a.getAttribute("title")].filter(Boolean).join(" "));
    };
    for (const el of document.querySelectorAll("img, svg, [role='img']")) {
      if (isSvgInner(el)) continue;
      const tag = el.tagName.toLowerCase();
      const rect = rectOf(el);
      const inHeader = headerLike(el) || rect.y < 160;
      const hint = hintOf(el).toLowerCase();
      const home = homeLink(el);
      const named = /logo|marca|brand/.test(hint);
      const sized = rect.width >= 40 && rect.height >= 16 && rect.width <= 600 && rect.height <= 220;
      if (!named && !(inHeader && home) && !(inHeader && sized)) continue;
      const entry = {
        kind: tag === "svg" ? "svg" : "img",
        src: null,
        markup: null,
        alt: clean(el.getAttribute("alt") || el.getAttribute("aria-label")) || null,
        class: clean(el.getAttribute("class")) || null,
        id: el.id || null,
        hint,
        in_header: inHeader,
        home_link: home,
        visible: isShown(el),
        ...rect,
        order: order++,
      };
      if (tag === "svg") {
        entry.markup = serializeSvg(el);
        if (!entry.markup) continue;
      } else {
        entry.src = abs(el.currentSrc || el.getAttribute("src") || el.getAttribute("data-src") || el.getAttribute("data-lazy-src"));
        if (!entry.src) continue;
        entry.natural_width = el.naturalWidth || null;
        entry.natural_height = el.naturalHeight || null;
      }
      list.push(entry);
      if (list.length >= 12) break;
    }
    for (const el of document.querySelectorAll("[class*='logo' i], [id*='logo' i]")) {
      if (list.length >= 16) break;
      const m = /url\(["']?([^"')]+)["']?\)/.exec(getComputedStyle(el).backgroundImage || "");
      if (!m) continue;
      const rect = rectOf(el);
      list.push({ kind: "background", src: abs(m[1]), markup: null, alt: null, class: clean(el.getAttribute("class")) || null, id: el.id || null, hint: "logo", in_header: headerLike(el) || rect.y < 160, home_link: homeLink(el), visible: isShown(el), ...rect, order: order++ });
    }
    return list;
  });

  attempt("headings", () => {
    const h1 = Array.from(document.querySelectorAll("h1")).map((el) => clean(el.innerText)).filter(Boolean).slice(0, 3);
    const h2 = Array.from(document.querySelectorAll("h2")).map((el) => clean(el.innerText)).filter(Boolean).slice(0, 12);
    let largest = null;
    for (const el of sample) {
      if (isSvgInner(el) || el.closest("a, button, nav, header, footer")) continue;
      const own = clean(Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" "));
      if (own.length < 3 || own.length > 160) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.top + scrollY > 1200) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (!largest || size > largest.size) largest = { text: own, size };
    }
    const bodySize = document.body ? parseFloat(getComputedStyle(document.body).fontSize) : 16;
    return { h1, h2, largest: largest ? largest.text : null, largest_size: largest ? largest.size : null, body_size: bodySize };
  });

  attempt("cta", () => {
    const list = [];
    const seen = new Set();
    for (const el of document.querySelectorAll("a[href], button, input[type='submit'], input[type='button'], [role='button']")) {
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 16 || r.top + scrollY > 2000) continue;
      const style = getComputedStyle(el);
      if (!isShown(el, style)) continue;
      const text = clean(el.innerText || el.value || el.getAttribute("aria-label") || "");
      if (!text || text.length > 60) continue;
      const background = style.backgroundColor;
      const hasBackground = !isTransparent(background);
      const bordered = parseFloat(style.borderTopWidth) > 0 && !isTransparent(style.borderTopColor) && style.borderTopStyle !== "none";
      if (el.tagName === "A" && !hasBackground && !bordered) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({
        text,
        href: el.tagName === "A" ? abs(el.getAttribute("href")) : null,
        tag: el.tagName.toLowerCase(),
        background: hasBackground ? background : null,
        color: style.color,
        border: bordered ? style.borderTopColor : null,
        radius: style.borderTopLeftRadius,
        font_size: parseFloat(style.fontSize),
        ...rectOf(el),
      });
      if (list.length >= 12) break;
    }
    return list;
  });

  attempt("colors", () => {
    const pick = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const s = getComputedStyle(el);
      return { background: s.backgroundColor, color: s.color };
    };
    const elements = {
      html: pick("html"),
      body: pick("body"),
      header: pick("header, [role='banner']"),
      nav: pick("nav"),
      footer: pick("footer, [role='contentinfo']"),
      h1: pick("h1"),
      button: pick("button, [role='button'], input[type='submit']"),
      link: pick("main a[href], section a[href], a[href]"),
    };
    const backgrounds = new Map();
    const texts = new Map();
    const cap = innerWidth * innerHeight * 1.5;
    let scanned = 0;
    // The canvas itself: html and body are not among "body *", yet they paint most of the page
    // (white when both are transparent).
    const htmlBackground = getComputedStyle(document.documentElement).backgroundColor;
    const bodyBackground = document.body ? getComputedStyle(document.body).backgroundColor : null;
    const canvas = !isTransparent(bodyBackground) ? bodyBackground : !isTransparent(htmlBackground) ? htmlBackground : "rgb(255, 255, 255)";
    backgrounds.set(canvas, cap);
    for (const el of sample) {
      if (isSvgInner(el)) continue;
      const r = el.getBoundingClientRect();
      const area = r.width * r.height;
      if (area <= 2000) continue;
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) < 0.1) continue;
      scanned++;
      const weight = Math.min(area, cap);
      if (!isTransparent(s.backgroundColor) && s.backgroundImage === "none") backgrounds.set(s.backgroundColor, (backgrounds.get(s.backgroundColor) || 0) + weight);
      const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
      if (hasText) texts.set(s.color, (texts.get(s.color) || 0) + weight);
    }
    const top = (map) => Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([color, area]) => ({ color, area: Math.round(area) }));
    return { elements, backgrounds: top(backgrounds), texts: top(texts), scanned };
  });

  attempt("fonts", () => {
    const family = (selector) => {
      const el = document.querySelector(selector);
      return el ? getComputedStyle(el).fontFamily : null;
    };
    const loaded = [];
    const seen = new Set();
    try {
      for (const face of document.fonts) {
        const key = `${face.family}|${face.weight}|${face.style}`;
        if (seen.has(key)) continue;
        seen.add(key);
        loaded.push({ family: face.family.replace(/^["']|["']$/g, ""), weight: face.weight, style: face.style, status: face.status });
        if (loaded.length >= 40) break;
      }
    } catch {
      // document.fonts unavailable
    }
    const faces = [];
    const walk = (sheet, depth) => {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        return; // a stylesheet from another origin
      }
      if (!rules) return;
      for (const rule of rules) {
        if (faces.length >= 40) return;
        if (rule.type === 5) {
          const src = rule.style.getPropertyValue("src");
          const urls = [];
          const re = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
          let m;
          while ((m = re.exec(src))) urls.push(abs(m[1], sheet.href || location.href));
          faces.push({ family: rule.style.getPropertyValue("font-family").replace(/^["']|["']$/g, "").trim(), weight: rule.style.getPropertyValue("font-weight") || null, style: rule.style.getPropertyValue("font-style") || null, src: urls.filter(Boolean).slice(0, 4) });
        } else if (rule.type === 3 && rule.styleSheet && depth < 3) walk(rule.styleSheet, depth + 1);
      }
    };
    for (const sheet of document.styleSheets) walk(sheet, 0);
    return { body: family("body"), h1: family("h1"), h2: family("h2"), button: family("button, [role='button'], a[class*='btn' i], a[class*='button' i]"), nav: family("nav a, header a"), loaded, faces };
  });

  attempt("prices", () => {
    const re = /R\$\s?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|R\$\s?\d+(?:,\d{1,2})?/g;
    const has = /R\$\s?\d/;
    const list = [];
    const seen = new Set();
    const headingOf = (el) => {
      let node = el;
      for (let depth = 0; node && depth < 6; depth++) {
        node = node.parentElement;
        if (!node) break;
        let best = null;
        for (const h of node.querySelectorAll("h1, h2, h3, h4, h5, [class*='title' i], [class*='name' i]")) {
          if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) best = h;
        }
        if (best) {
          const t = clean(best.innerText);
          if (t && t.length <= 80 && !has.test(t)) return t;
        }
      }
      return null;
    };
    for (const el of sample) {
      if (isSvgInner(el)) continue;
      const text = el.textContent;
      if (!text || text.length > 600 || !has.test(text)) continue;
      if (Array.from(el.children).some((child) => has.test(child.textContent))) continue; // the deepest element wins
      if (!isShown(el)) continue;
      const line = clean(text);
      for (const m of line.matchAll(re)) {
        const key = `${m[0]}|${line}`;
        if (seen.has(key)) continue;
        seen.add(key);
        list.push({ text: m[0], context: line.slice(0, 160), product: headingOf(el) });
        if (list.length >= 12) return list;
      }
    }
    return list;
  });

  attempt("links", () => {
    const list = [];
    const seen = new Set();
    for (const a of document.querySelectorAll("a[href]")) {
      const href = (a.getAttribute("href") || "").trim();
      if (!href) continue;
      const url = /^(mailto|tel|whatsapp|sms):/i.test(href) ? href : abs(href);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      list.push({ href: url, text: clean(a.innerText || a.getAttribute("aria-label") || a.title || "").slice(0, 80), header: headerLike(a) });
      if (list.length >= 400) break;
    }
    return list;
  });

  attempt("nav", () => {
    const items = [];
    const seen = new Set();
    for (const a of document.querySelectorAll("nav a[href], header a[href], [role='navigation'] a[href]")) {
      const text = clean(a.innerText);
      if (!text || text.length > 30 || seen.has(text.toLowerCase())) continue;
      seen.add(text.toLowerCase());
      items.push({ text, href: abs(a.getAttribute("href")) });
      if (items.length >= 15) break;
    }
    return items;
  });

  attempt("text", () => (document.body ? document.body.innerText : "").replace(/[ \t ]+/g, " ").replace(/\n\s*\n+/g, "\n").trim().slice(0, limits.maxText));

  attempt("layout", () => ({
    scroll_height: document.documentElement.scrollHeight,
    scroll_width: document.documentElement.scrollWidth,
    inner_width: innerWidth,
    inner_height: innerHeight,
    elements: everything.length,
    images: document.images.length,
    videos: document.querySelectorAll("video").length,
    iframes: document.querySelectorAll("iframe").length,
    forms: document.forms.length,
  }));

  return out;
}

/**
 * The page's anatomy for an audit of an offer page; `options.parts` says which reads run:
 * sections split at h1 to h3, calls to action, fixed and sticky elements, checkboxes and radios,
 * prices, media, motion and timers. One function holds every read so its helpers exist once;
 * an element read in one call is found again in the next through ids kept in a page global.
 * It never waits: in a page saved as .mhtml the page's own timers never fire, so every pause
 * happens in Node, between two calls.
 */
function anatomyInPage(options) {
  const out = { errors: [], viewport: { width: innerWidth, height: innerHeight, scroll_y: Math.round(scrollY) } };
  const want = new Set(options.parts || []);
  const attempt = (name, fn) => {
    if (!want.has(name)) return;
    try {
      out[name] = fn();
    } catch (error) {
      out[name] = null;
      out.errors.push(`${name}: ${error && error.message ? error.message : error}`);
    }
  };
  const store = window.__flyeeAnatomy || (window.__flyeeAnatomy = { next: 1, ids: new WeakMap(), elements: new Map() });
  const idOf = (el) => {
    let id = store.ids.get(el);
    if (!id) {
      id = store.next++;
      store.ids.set(el, id);
      store.elements.set(id, el);
    }
    return id;
  };
  const re = (pattern, extra = "") => new RegExp(pattern.source, pattern.flags + extra);
  const clean = (text) => String(text || "").replace(/\s+/g, " ").trim();
  const fold = (text) => clean(text).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  // "R$ 49 ,99" from split elements becomes "R$ 49,99"
  const joinCents = (text) => text.replace(/(\d)\s+,(\d{2})(?!\d)/g, "$1,$2");
  const abs = (href) => {
    if (!href) return null;
    try {
      return new URL(href, location.href).href;
    } catch {
      return null;
    }
  };
  const boxOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), width: Math.round(r.width), height: Math.round(r.height) };
  };
  const isTransparent = (c) => !c || c === "transparent" || /^rgba\([^)]*,\s*0(\.0+)?\s*\)$/.test(c) || /\/\s*0(\.0+)?\s*\)$/.test(c);
  // Rendered with a size. Opacity counts only when asked: content that fades in on scroll is still content.
  const shown = (el, withOpacity = false) => {
    if (!el || el.nodeType !== 1) return false;
    if (typeof el.checkVisibility === "function") {
      if (!el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true, checkOpacity: withOpacity, opacityProperty: withOpacity })) return false;
    } else {
      for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
        const s = getComputedStyle(node);
        if (s.display === "none" || (withOpacity && Number(s.opacity) === 0)) return false;
        if (node === el && s.visibility !== "visible") return false;
      }
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const pinned = (el) => {
    const position = getComputedStyle(el).position;
    return position === "fixed" || position === "sticky";
  };

  // Sections: the visible h1, h2 and h3 in document order; section 0 is what comes before the first one.
  let headingList = null;
  const headings = () => {
    if (headingList) return headingList;
    headingList = [];
    for (const el of document.querySelectorAll("h1, h2, h3")) {
      if (headingList.length >= options.maxSections - 1) break;
      if (clean(el.innerText || el.textContent) && shown(el)) headingList.push(el);
    }
    return headingList;
  };
  const sectionOf = (el) => {
    if (!el || !document.documentElement.contains(el)) return null;
    const list = headings();
    let lo = 0;
    let hi = list.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const heading = list[mid];
      if (heading === el || (heading.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found + 1;
  };

  // Calls to action and the cookie banner the anatomy leaves out
  const CTA = "a[href], button, input[type='submit' i], input[type='button' i], input[type='image' i], [role='button']";
  const DECLINE = re(options.decline);
  const SKIP_LINK = re(options.skipLink);
  const ACCEPT = re(options.cookieAccept);
  const COOKIE_NAME = re(options.cookieName);
  const COOKIE_TEXT = re(options.cookieText);
  const ctaText = (el) => clean(el.innerText || (el.localName === "input" ? el.value : "") || el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("alt") || "");
  const declining = (text) => {
    const folded = fold(text);
    return !SKIP_LINK.test(folded) && DECLINE.test(folded);
  };
  const styledAsButton = (style) => !isTransparent(style.backgroundColor) || /gradient\(/.test(style.backgroundImage || "") || (parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== "none" && !isTransparent(style.borderTopColor));
  const verdicts = new Map();
  const cookieBanner = (node) => {
    if (verdicts.has(node)) return verdicts.get(node);
    const clicked = window.__flyeeCookieButton;
    let verdict = Boolean(clicked && node.contains(clicked));
    if (!verdict) verdict = COOKIE_NAME.test(`${node.id || ""} ${typeof node.className === "string" ? node.className : ""} ${node.getAttribute("aria-label") || ""}`);
    if (!verdict && COOKIE_TEXT.test(clean(node.innerText).slice(0, 3000))) verdict = Array.from(node.querySelectorAll(CTA)).some((button) => ACCEPT.test(ctaText(button)));
    verdicts.set(node, verdict);
    return verdict;
  };
  const inCookieBanner = (el) => {
    for (let node = el; node && node.nodeType === 1 && node !== document.body && node !== document.documentElement; node = node.parentElement) {
      if (pinned(node) && cookieBanner(node)) return true;
    }
    return false;
  };
  const inFixed = (el) => {
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) if (pinned(node)) return true;
    return false;
  };
  const kindOf = (el) => {
    if (el.localName === "a") return "link";
    if (el.localName === "input") return /^(submit|image)$/i.test(el.type) ? "submit" : "button";
    if (el.localName === "button") return el.type === "submit" && el.form ? "submit" : "button";
    return "button";
  };
  // Buttons, submit inputs, role=button and links that look like buttons (the brand reading's test),
  // plus any link that declines or skips the offer; the outermost of nested candidates wins.
  const ctaRead = (root, limit) => {
    const found = [];
    const accepted = new Set();
    const candidates = root === document ? Array.from(document.querySelectorAll(CTA)) : [...(root.matches(CTA) ? [root] : []), ...root.querySelectorAll(CTA)];
    for (const el of candidates) {
      if (found.length >= limit) break;
      let nested = false;
      for (let node = el.parentElement; node && !nested; node = node.parentElement) nested = accepted.has(node);
      if (nested || !shown(el)) continue;
      const text = ctaText(el);
      if (!text || text.length > 120) continue;
      const r = el.getBoundingClientRect();
      if (r.right + scrollX <= 0 || r.bottom + scrollY <= 0) continue; // parked outside the page, like a skip link
      if (!declining(text)) {
        if (r.width < 24 || r.height < 16) continue;
        if (el.localName === "a" && el.getAttribute("role") !== "button" && !styledAsButton(getComputedStyle(el))) continue;
      }
      if (inCookieBanner(el)) continue;
      accepted.add(el);
      found.push({ el, text });
    }
    return found;
  };

  attempt("sections", () => {
    const list = headings();
    const place = new Map(list.map((el, index) => [el, index + 1]));
    const buckets = [null, ...list].map((heading) => ({ heading, chunks: [], extra: 0 }));
    const words = (text) => (String(text).match(/\S+/g) || []).length;
    const SKIP = /^(script|style|noscript|template|head|title|meta|link|svg|math|iframe|object|embed|canvas|video|audio|img|picture|select|datalist|textarea|input)$/;
    let current = 0;
    let total = 0;
    const push = (text) => {
      if (!text) return;
      const bucket = buckets[current];
      if (!/\S/.test(text)) {
        bucket.chunks.push(text.includes("\n") ? "\n" : " ");
        return;
      }
      const room = options.maxText - total;
      if (room <= 0) {
        bucket.extra += words(text);
        return;
      }
      const piece = text.slice(0, room);
      bucket.chunks.push(piece);
      total += piece.length;
      if (piece.length < text.length) bucket.extra += words(text.slice(piece.length));
    };
    // A small innerText of our own, so each piece of text knows its section: hidden subtrees are
    // skipped, blocks start a new line, and open shadow roots and slots are followed.
    const visit = (node, depth, inherited) => {
      if (depth > 400) return;
      if (node.nodeType === 3) {
        if (!inherited.visible || !node.nodeValue) return;
        push(inherited.pre ? node.nodeValue.replace(/\r\n?/g, "\n") : node.nodeValue.replace(/\s+/g, " "));
        return;
      }
      if (node.nodeType !== 1) return;
      const name = node.localName;
      if (SKIP.test(name)) return;
      if (place.has(node)) {
        current = place.get(node);
        return;
      }
      const style = getComputedStyle(node);
      const display = style.display;
      if (display === "none") return;
      if (name === "br") {
        push("\n");
        return;
      }
      const cell = display === "table-cell";
      const block = !cell && !/^(inline|contents|ruby)/.test(display);
      if (block) push("\n");
      else if (cell) push(" ");
      const assigned = name === "slot" && typeof node.assignedNodes === "function" ? node.assignedNodes({ flatten: true }) : [];
      const kids = node.shadowRoot ? node.shadowRoot.childNodes : assigned.length ? assigned : node.childNodes;
      const next = { visible: style.visibility === "visible", pre: /^(pre|pre-wrap|pre-line|break-spaces)$/.test(style.whiteSpace) };
      for (const child of kids) visit(child, depth + 1, next);
      if (block) push("\n");
    };
    if (document.body) visit(document.body, 0, { visible: true, pre: false });
    const tidy = (text) => text.split("\n").map((line) => line.replace(/[ \t ]+/g, " ").trim()).filter(Boolean).join("\n");
    const pageHeight = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
    const tops = buckets.map((bucket) => (bucket.heading ? Math.round(bucket.heading.getBoundingClientRect().top + scrollY) : 0));
    return {
      list: buckets.map((bucket, index) => {
        const text = tidy(bucket.chunks.join(""));
        const next = index + 1 < tops.length ? tops[index + 1] : pageHeight;
        return {
          index,
          heading: bucket.heading ? { tag: bucket.heading.localName, text: clean(bucket.heading.innerText || bucket.heading.textContent).slice(0, 200) } : null,
          y: tops[index],
          height: Math.max(0, next - tops[index]),
          text,
          words: words(text) + bucket.extra,
        };
      }),
      truncated: total >= options.maxText,
    };
  });

  // Where an element sits in the document: tag and position among its siblings, from the body down.
  // A site that hides and shows with CSS keeps the same element, at the same path, on the phone.
  const pathOf = (el) => {
    const parts = [];
    for (let node = el; node && node !== document.body && parts.length < 60; node = node.parentElement) {
      let nth = 1;
      for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) if (sibling.localName === node.localName) nth += 1;
      parts.push(`${node.localName}:${nth}`);
    }
    return parts.reverse().join(">");
  };

  attempt("ctas", () =>
    ctaRead(document, options.maxCtas).map(({ el, text }) => ({
      path: pathOf(el),
      kind: kindOf(el),
      text,
      href: el.localName === "a" ? abs(el.getAttribute("href")) : null,
      ...boxOf(el),
      in_fixed: inFixed(el),
      section: sectionOf(el),
      disabled: el.disabled === true || el.getAttribute("aria-disabled") === "true",
    })));

  // The mobile pass needs only where each call sits, to say whether it is in the first screen.
  attempt("cta_positions", () =>
    ctaRead(document, options.maxCtas).map(({ el, text }) => {
      const box = boxOf(el);
      return { path: pathOf(el), text, y: box.y, height: box.height };
    }));

  // Fixed or sticky elements on screen now: bars (half the width or more) or anything holding a call.
  attempt("fixed", () => {
    const list = [];
    const kept = new Set();
    const all = document.querySelectorAll("body *");
    for (let i = 0; i < all.length && i < options.maxElements && list.length < options.maxFixed; i++) {
      const el = all[i];
      if (!pinned(el)) continue;
      let inside = false;
      for (let node = el.parentElement; node && !inside; node = node.parentElement) inside = kept.has(node);
      if (inside || !shown(el, true)) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
      if (inCookieBanner(el)) continue;
      const ctas = ctaRead(el, 10).map((cta) => cta.text.slice(0, 80));
      if (r.width < innerWidth * 0.5 && !ctas.length) continue;
      kept.add(el);
      list.push({ id: idOf(el), position: getComputedStyle(el).position, top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), text: clean(el.innerText).slice(0, 280), ctas });
    }
    return list;
  });

  attempt("forms", () => {
    const PRICE = re(options.price);
    const list = [];
    const controls = document.querySelectorAll("input[type='checkbox' i], input[type='radio' i], [role='checkbox'], [role='radio'], [role='switch'], [role='menuitemcheckbox'], [role='menuitemradio']");
    for (const el of controls) {
      if (list.length >= options.maxForms) break;
      const native = el.localName === "input";
      const label = native && el.labels ? Array.from(el.labels).find((candidate) => shown(candidate)) || null : null;
      const visible = shown(el);
      // a styled control often hides the native box and shows its label instead
      if ((!visible && !label) || inCookieBanner(el)) continue;
      let text = label ? clean(label.innerText) : "";
      if (!text) text = clean(el.getAttribute("aria-label"));
      if (!text) {
        const ids = (el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
        text = clean(ids.map((id) => {
          const target = document.getElementById(id);
          return target ? target.innerText || target.textContent : "";
        }).join(" "));
      }
      if (!text && !native) text = clean(el.innerText);
      for (let node = el.parentElement, depth = 0; !text && node && node !== document.body && depth < 3; node = node.parentElement, depth++) {
        const around = clean(node.innerText);
        if (around.length > 300) break;
        text = around;
      }
      text = text.slice(0, 200);
      const role = el.getAttribute("role") || "";
      const price = PRICE.exec(joinCents(text));
      list.push({
        type: native ? (String(el.type).toLowerCase() === "radio" ? "radio" : "checkbox") : /radio/.test(role) ? "radio" : "checkbox",
        label: text,
        checked: native ? el.checked === true : el.getAttribute("aria-checked") === "true",
        required: native ? el.required === true : el.getAttribute("aria-required") === "true",
        name: (native && el.name) || null,
        price_text: price ? price[0] : null,
        section: sectionOf(el),
        y: boxOf(visible ? el : label).y,
      });
    }
    return list;
  });

  // Prices from the text nodes, so "De <del>R$ 49,99</del> por R$ 19,99" gives two prices; a price
  // split across elements (<span>R$</span><span>49</span><sup>,99</sup>) is read on through the next nodes.
  attempt("prices", () => {
    const PRICE = re(options.price, "g");
    const list = [];
    if (!document.body) return list;
    const blocks = new Map();
    // "R$29,99" and "R$ 29,99" are the same price when looking for it in a block's text.
    const spaced = (text) => text.replace(/R\$\s*/g, () => "R$ ");
    const textOf = (node) => spaced(joinCents(clean(node.innerText || node.textContent)));
    // The text around a price: up from the element to the first box that holds the whole price and
    // some words besides it, past inline elements. A price split in pieces (<span>R$</span><span>29</span>)
    // climbs until the pieces meet; a button "Quero por R$ 19,99" is the context by itself.
    const blockText = (el, price) => {
      let node = el;
      for (let depth = 0; depth < 8 && node.parentElement && node !== document.body; depth++) {
        const text = textOf(node);
        const display = getComputedStyle(node).display;
        if (text.includes(price) && text.length > price.length + 4 && display !== "inline" && display !== "contents") break;
        node = node.parentElement;
      }
      if (!blocks.has(node)) blocks.set(node, textOf(node));
      return blocks.get(node);
    };
    const struck = (el) => {
      for (let node = el, depth = 0; node && node.nodeType === 1 && node !== document.body && depth < 8; node = node.parentElement, depth++) {
        if (/^(del|s|strike)$/.test(node.localName)) return true;
        if (String(getComputedStyle(node).textDecorationLine || "").includes("line-through")) return true;
      }
      return false;
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node && list.length < options.maxPrices; node = walker.nextNode()) {
      if (!node.nodeValue || node.nodeValue.indexOf("R$") < 0) continue;
      const parent = node.parentElement;
      if (!parent || parent.closest("script, style, noscript, template, textarea, select, option, title") || !shown(parent)) continue;
      const own = joinCents(clean(node.nodeValue));
      let joined = clean(node.nodeValue);
      const peek = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      peek.currentNode = node;
      for (let i = 0, next = peek.nextNode(); i < 3 && next && joined.length < own.length + 24; i++, next = peek.nextNode()) {
        const more = clean(next.nodeValue);
        if (more) joined += ` ${more}`;
      }
      for (const match of joinCents(joined).matchAll(PRICE)) {
        if (match.index >= own.length || list.length >= options.maxPrices) break;
        const price = spaced(match[0]);
        const block = blockText(parent, price);
        const at = block.indexOf(price);
        const from = Math.max(0, at - 300);
        list.push({ text: match[0], struck: struck(parent), block: block.slice(from, from + 700), at: at < 0 ? -1 : at - from, section: sectionOf(parent), y: boxOf(parent).y });
      }
    }
    return list;
  });

  attempt("media", () => {
    const videos = Array.from(document.querySelectorAll("video")).slice(0, 50).map((video) => {
      const source = video.querySelector("source[src]");
      const r = video.getBoundingClientRect();
      return {
        src: abs(video.currentSrc || video.getAttribute("src") || (source ? source.getAttribute("src") : "")),
        poster: abs(video.getAttribute("poster")),
        autoplay: video.autoplay === true || video.hasAttribute("autoplay"),
        muted: video.muted === true || video.hasAttribute("muted"),
        loop: video.loop === true || video.hasAttribute("loop"),
        playsinline: video.playsInline === true || video.hasAttribute("playsinline") || video.hasAttribute("webkit-playsinline"),
        controls: video.controls === true || video.hasAttribute("controls"),
        width: Math.round(r.width),
        height: Math.round(r.height),
        duration_s: Number.isFinite(video.duration) && video.duration > 0 ? Math.round(video.duration * 100) / 100 : null,
        section: sectionOf(video),
      };
    });
    const iframes = [];
    for (const frame of document.querySelectorAll("iframe")) {
      if (iframes.length >= 50) break;
      const src = abs(frame.getAttribute("src") || frame.getAttribute("data-src"));
      if (src && !/^about:/i.test(src)) iframes.push({ src, section: sectionOf(frame) });
    }
    const images = Array.from(document.images);
    return { videos, iframes, images: { count: images.length, without_alt: images.filter((img) => !img.hasAttribute("alt")).length } };
  });

  // What the style sheets declare; a sheet from another origin cannot be read and is only counted.
  attempt("motion", () => {
    const keyframes = new Set();
    const seen = new Set();
    let transitions = 0;
    let reduced = 0;
    let unread = 0;
    const declaresTransition = (style) => {
      const duration = style.getPropertyValue("transition-duration");
      if (duration) return style.getPropertyValue("transition-property").trim() !== "none" && (/var\(/.test(duration) || duration.split(",").some((part) => parseFloat(part) > 0));
      const shorthand = style.getPropertyValue("transition").trim();
      return Boolean(shorthand) && !/^(none|initial|unset|inherit|revert)$/i.test(shorthand);
    };
    const walkRules = (rules, depth) => {
      if (!rules || depth > 8) return;
      for (const rule of rules) {
        if (typeof CSSKeyframesRule !== "undefined" && rule instanceof CSSKeyframesRule) {
          if (keyframes.size < 100) keyframes.add(rule.name);
          continue;
        }
        if (typeof CSSImportRule !== "undefined" && rule instanceof CSSImportRule) {
          walkSheet(rule.styleSheet, depth + 1);
          continue;
        }
        if (typeof CSSMediaRule !== "undefined" && rule instanceof CSSMediaRule && /prefers-reduced-motion/i.test(rule.conditionText || (rule.media && rule.media.mediaText) || "")) reduced++;
        if (rule.style && declaresTransition(rule.style)) transitions++;
        if (rule.cssRules) walkRules(rule.cssRules, depth + 1);
      }
    };
    const walkSheet = (sheet, depth) => {
      if (!sheet || seen.has(sheet)) return;
      seen.add(sheet);
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        unread++;
        return;
      }
      walkRules(rules, depth);
    };
    for (const sheet of document.styleSheets) walkSheet(sheet, 0);
    for (const sheet of document.adoptedStyleSheets || []) walkSheet(sheet, 0);
    let snap = 0;
    const all = [document.documentElement, ...document.querySelectorAll("body, body *")];
    for (let i = 0; i < all.length && i < options.maxElements; i++) {
      const type = getComputedStyle(all[i]).scrollSnapType;
      if (type && type !== "none") snap++;
    }
    const smooth = getComputedStyle(document.documentElement).scrollBehavior === "smooth" || Boolean(document.body && getComputedStyle(document.body).scrollBehavior === "smooth");
    return { keyframes: Array.from(keyframes), transitions, reduced_motion_rules: reduced, smooth_scroll: smooth, scroll_snap: snap, stylesheets_unread: unread };
  });

  attempt("running", () => {
    const list = [];
    if (typeof document.getAnimations !== "function") return list;
    for (const animation of document.getAnimations()) {
      if (list.length >= options.maxAnimations) break;
      if (animation.playState !== "running") continue;
      const effect = animation.effect;
      const timing = effect && typeof effect.getComputedTiming === "function" ? effect.getComputedTiming() : {};
      const target = effect ? effect.target : null;
      const kind = typeof CSSAnimation !== "undefined" && animation instanceof CSSAnimation ? "css-animation" : typeof CSSTransition !== "undefined" && animation instanceof CSSTransition ? "css-transition" : "web-animation";
      const name = kind === "css-animation" ? animation.animationName : kind === "css-transition" ? animation.transitionProperty : animation.id;
      list.push({
        kind,
        name: name || null,
        duration_ms: Number.isFinite(timing.duration) ? Math.round(timing.duration) : 0,
        iterations: timing.iterations === Infinity ? "infinite" : Number.isFinite(timing.iterations) ? timing.iterations : 1,
        target: target ? `${target.localName}${target.classList && target.classList.length ? `.${target.classList[0]}` : ""}${effect.pseudoElement || ""}` : null,
      });
    }
    return list;
  });

  // Timers: the deepest short element (80 characters at most) whose text reads as a timer. Node reads
  // them again 1.2 s later; only those that changed are countdowns.
  attempt("timers", () => {
    const TIMER = re(options.timer);
    const list = [];
    const seen = new Set();
    if (!document.body) return list;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node && list.length < options.maxTimers; node = walker.nextNode()) {
      if (!/\d/.test(node.nodeValue || "")) continue;
      for (let el = node.parentElement, depth = 0; el && el !== document.body && depth < 4; el = el.parentElement, depth++) {
        const raw = el.textContent || "";
        if (raw.length > 2000) break;
        const text = clean(raw);
        if (text.length > 80) break;
        if (!TIMER.test(text)) continue;
        if (!seen.has(el) && !/^(script|style|noscript|template|textarea|select|option)$/.test(el.localName) && shown(el)) {
          seen.add(el);
          list.push({ id: idOf(el), text, section: sectionOf(el) });
        }
        break;
      }
    }
    return list;
  });

  attempt("timer_texts", () =>
    (options.ids || []).map((id) => {
      const el = store.elements.get(id);
      return { id, text: el && el.isConnected ? clean(el.textContent) : null };
    }));

  // ----- Measurements of the finished page. The caller reads them apart: a failure here leaves one
  // measurement empty and never takes the anatomy down.

  const NOT_TEXT = "script, style, noscript, template, textarea, select, option, title, svg";
  const eachText = (limit, visit) => {
    if (!document.body) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let seen = 0;
    for (let node = walker.nextNode(); node && seen < limit; node = walker.nextNode()) {
      const text = clean(node.nodeValue);
      if (!text) continue;
      const parent = node.parentElement;
      if (!parent || parent.closest(NOT_TEXT) || !shown(parent)) continue;
      seen++;
      visit(text, parent);
    }
  };
  const ownText = (el) => Array.from(el.childNodes).some((node) => node.nodeType === 3 && /\S/.test(node.nodeValue));

  // What passes the width of the phone: the page scrolling sideways, or content cut by the page's
  // edge. Anything inside its own scrolling or clipping box (a carousel, a ticker) is that box's business.
  attempt("overflow", () => {
    const width = options.viewportWidth || innerWidth;
    const insideBox = (el) => {
      for (let node = el.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
        if (getComputedStyle(node).overflowX !== "visible") return true;
      }
      return false;
    };
    const offenders = [];
    let cut = 0;
    const all = document.querySelectorAll("body *");
    for (let i = 0; i < all.length && i < options.maxElements; i++) {
      const el = all[i];
      if (!ownText(el) && !/^(img|video|table|pre|button|input|canvas|iframe)$/.test(el.localName)) continue;
      if (el.closest("script, style, noscript, template") || !shown(el, true)) continue;
      const r = el.getBoundingClientRect();
      if (r.right <= width + 2 || r.left >= width || insideBox(el)) continue;
      cut++;
      if (offenders.length < 5) offenders.push({ tag: el.localName, text: clean(el.innerText || el.getAttribute("alt") || "").slice(0, 60), right: Math.round(r.right), width: Math.round(r.width) });
    }
    return { viewport_width: width, inner_width: innerWidth, scroll_width: Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0), cut, offenders };
  });

  // The share of the text below the legible size, and any price or call to action below it.
  attempt("small_text", () => {
    const limit = options.smallTextPx || 12;
    const PRICE = re(options.price);
    const sizes = new Map();
    const samples = [];
    const key = [];
    let total = 0;
    let small = 0;
    let min = null;
    eachText(options.maxElements, (text, parent) => {
      let px = sizes.get(parent);
      if (px === undefined) {
        px = parseFloat(getComputedStyle(parent).fontSize) || 0;
        sizes.set(parent, px);
      }
      if (!px) return;
      total += text.length;
      if (min === null || px < min) min = px;
      if (px >= limit) return;
      small += text.length;
      const entry = { text: text.slice(0, 60), px: Math.round(px * 10) / 10 };
      if (samples.length < 5) samples.push(entry);
      // A price or a call to action is named by its whole text, once: "Até 40% OFF", not "Até".
      const cta = parent.closest(CTA);
      if (key.length < 5 && (cta || PRICE.test(joinCents(text)))) {
        const whole = cta ? ctaText(cta).slice(0, 60) : entry.text;
        if (!key.some((known) => known.text === whole)) key.push({ text: whole, px: entry.px });
      }
    });
    return { total_chars: total, small_chars: small, min_px: min, samples, key };
  });

  // WCAG 2.2, 2.5.8: 24 by 24 CSS pixels, with its exceptions for a link inside a sentence and for
  // spacing (a 24 px circle centered on the target touches no other target and no other such circle).
  attempt("tap_targets", () => {
    const min = options.minTarget || 24;
    const SEL = "a[href], button, input:not([type='hidden' i]), select, textarea, summary, [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='tab']";
    const inSentence = (el) => {
      if (el.localName !== "a" || getComputedStyle(el).display !== "inline" || !el.parentElement) return false;
      return clean(el.parentElement.innerText).length > clean(el.innerText).length + 20;
    };
    const targets = [];
    for (const el of document.querySelectorAll(SEL)) {
      if (targets.length >= 400) break;
      if (el.parentElement && el.parentElement.closest(SEL)) continue;
      const label = el.labels && el.labels.length ? Array.from(el.labels).find((candidate) => shown(candidate)) || null : null;
      if (!label && !shown(el, true)) continue;
      const own = el.getBoundingClientRect();
      const box = label ? label.getBoundingClientRect() : own;
      const left = label ? Math.min(own.left, box.left) : own.left;
      const top = label ? Math.min(own.top, box.top) : own.top;
      const right = label ? Math.max(own.right, box.right) : own.right;
      const bottom = label ? Math.max(own.bottom, box.bottom) : own.bottom;
      if (right - left <= 0 || bottom - top <= 0 || right + scrollX <= 0 || bottom + scrollY <= 0) continue;
      if (inCookieBanner(el) || inSentence(el)) continue;
      // A target with no name stays with an empty text: that it has no name is part of the finding.
      targets.push({ left: left + scrollX, top: top + scrollY, right: right + scrollX, bottom: bottom + scrollY, width: right - left, height: bottom - top, text: ctaText(el) || (label ? clean(label.innerText) : "") || clean(el.getAttribute("placeholder")) || "" });
    }
    const isSmall = (target) => Math.min(target.width, target.height) < min;
    const center = (target) => ({ x: (target.left + target.right) / 2, y: (target.top + target.bottom) / 2 });
    const crowded = (target) => {
      const c = center(target);
      return targets.some((other) => {
        if (other === target) return false;
        if (isSmall(other)) {
          const d = center(other);
          return Math.hypot(c.x - d.x, c.y - d.y) < min;
        }
        const dx = Math.max(other.left - c.x, 0, c.x - other.right);
        const dy = Math.max(other.top - c.y, 0, c.y - other.bottom);
        return Math.hypot(dx, dy) < min / 2;
      });
    };
    const small = targets.filter(isSmall);
    const undersized = small.filter(crowded);
    return { checked: targets.length, small: small.length, undersized: undersized.length, samples: undersized.slice(0, 6).map((target) => ({ text: String(target.text).slice(0, 60), width: Math.round(target.width), height: Math.round(target.height) })) };
  });

  // A button whose label does not fit: cut by its box, spilling past it, or touching one side. Only
  // the label counts: a badge or a shine placed on top of the button, and text hidden for screen
  // readers, are left out, because they sit outside the label on purpose.
  attempt("controls", () => {
    const problems = [];
    let checked = 0;
    const range = document.createRange();
    const offLabel = (node, root) => {
      for (let up = node; up && up !== root; up = up.parentElement) {
        const s = getComputedStyle(up);
        if (s.position === "absolute" || s.position === "fixed") return true;
        if ((s.clipPath && s.clipPath !== "none") || (s.clip && s.clip !== "auto")) return true;
      }
      return false;
    };
    for (const { el, text } of ctaRead(document, options.maxCtas)) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const style = getComputedStyle(el);
      const box = {
        left: r.left + (parseFloat(style.borderLeftWidth) || 0),
        right: r.right - (parseFloat(style.borderRightWidth) || 0),
        top: r.top + (parseFloat(style.borderTopWidth) || 0),
        bottom: r.bottom - (parseFloat(style.borderBottomWidth) || 0),
      };
      let t = null;
      let clips = false;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!/\S/.test(node.nodeValue || "") || !node.parentElement || offLabel(node.parentElement, el)) continue;
        range.selectNodeContents(node);
        const b = range.getBoundingClientRect();
        if (!b.width || !b.height) continue;
        t = t ? { left: Math.min(t.left, b.left), right: Math.max(t.right, b.right), top: Math.min(t.top, b.top), bottom: Math.max(t.bottom, b.bottom) } : { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
        for (let up = node.parentElement; up && !clips; up = up === el ? null : up.parentElement) {
          const s = getComputedStyle(up);
          clips = s.overflowX !== "visible" || s.overflowY !== "visible";
        }
      }
      if (!t) continue;
      checked++;
      const button = styledAsButton(style);
      const outside = t.left < box.left - 1 || t.right > box.right + 1 || t.top < box.top - 1 || t.bottom > box.bottom + 1;
      let reason = null;
      if (outside && clips) reason = "cortado";
      else if (outside && button) reason = "vaza";
      else if (button) {
        const left = t.left - box.left;
        const right = box.right - t.right;
        if ((left <= 2 && right >= 5) || (right <= 2 && left >= 5)) reason = "colado";
      }
      if (reason && problems.length < 8) problems.push({ text: text.slice(0, 60), reason, width: Math.round(r.width), height: Math.round(r.height) });
    }
    return { checked, problems };
  });

  attempt("images", () => {
    const list = [];
    for (const img of document.images) {
      if (list.length >= 200) break;
      if (!img.complete || !img.naturalWidth || !shown(img)) continue;
      const r = img.getBoundingClientRect();
      if (r.width < 2) continue;
      list.push({ src: String(abs(img.currentSrc || img.getAttribute("src")) || "").slice(0, 300), natural_width: img.naturalWidth, shown_width: Math.round(r.width) });
    }
    return { scale: devicePixelRatio, list };
  });

  // The text colors of the page and what is painted under them. The colors go back as the browser
  // reports them, for Node to compose. Each distinct pair is scrolled to and read where it is on
  // screen, because a text placed over an image or over another box has neither as an ancestor.
  // While it reads, every element answers the hit test, so a background layer that ignores the
  // pointer is seen too; the page is put back as it was at the end.
  attempt("contrast", () => {
    const startY = scrollY;
    const unlock = document.createElement("style");
    unlock.textContent = "* { pointer-events: auto !important; }";
    document.head.appendChild(unlock);
    try {
      return contrastRead();
    } finally {
      unlock.remove();
      window.scrollTo({ top: startY, left: 0, behavior: "instant" });
    }
  });

  function contrastRead() {
    const opaque = (color) => !/\/\s*(?:0?\.\d+|0)\s*\)$/.test(color) && !/^rgba\([^)]*,\s*(?:0?\.\d+|0)\s*\)$/.test(color);
    // A ::before or ::after that paints a background can sit under the text, and the hit test never returns it.
    const paintedPseudo = (node) => ["::before", "::after"].some((which) => {
      const s = getComputedStyle(node, which);
      if (!s.content || s.content === "none" || s.content === "normal") return false;
      return !isTransparent(s.backgroundColor) || (s.backgroundImage && s.backgroundImage !== "none");
    });
    const paints = (style) => !isTransparent(style.backgroundColor) || (style.backgroundImage && style.backgroundImage !== "none");
    const nearestBackground = (el) => {
      for (let node = el; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.backgroundImage && style.backgroundImage !== "none") return "imagem";
        if (!isTransparent(style.backgroundColor)) return style.backgroundColor;
      }
      return "";
    };
    const firstTextParent = (el) => {
      if (ownText(el)) return el;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) if (/\S/.test(node.nodeValue || "") && node.parentElement) return node.parentElement;
      return el;
    };
    const pairs = new Map();
    // Text marked aria-hidden is decoration by the page's own word: WCAG leaves it out of 1.4.3.
    const decorative = (el) => Boolean(el.closest("[aria-hidden='true']"));
    const add = (el, role, chars, text) => {
      if (!el || decorative(el)) return;
      const style = getComputedStyle(el);
      const key = `${role}|${style.color}|${nearestBackground(el)}|${Math.round(parseFloat(style.fontSize))}`;
      const known = pairs.get(key);
      if (known) known.chars += chars;
      else if (pairs.size < (options.maxContrast || 60)) pairs.set(key, { el, role, chars, text: clean(text).slice(0, 60) });
    };
    for (const heading of headings()) add(firstTextParent(heading), heading.localName === "h1" ? "title" : "heading", clean(heading.innerText).length, heading.innerText);
    // A disabled control is an inactive component, which WCAG 1.4.3 leaves out.
    for (const { el, text } of ctaRead(document, 40)) if (!(el.disabled === true || el.getAttribute("aria-disabled") === "true")) add(firstTextParent(el), "cta", text.length, text);
    eachText(3000, (text, parent) => {
      if (text.length >= 20) add(parent, "text", text.length, text);
    });
    const read = ({ el, role, chars, text }) => {
      const style = getComputedStyle(el);
      const sample = { role, text, chars, color: style.color, font_px: parseFloat(style.fontSize) || 0, bold: (parseInt(style.fontWeight, 10) || 400) >= 700, stack: [], unknown: null };
      const clip = style.webkitBackgroundClip || style.backgroundClip;
      if (clip === "text" || isTransparent(style.webkitTextFillColor || "") && style.webkitTextFillColor) {
        sample.unknown = "degrade";
        return sample;
      }
      for (let node = el; node; node = node.parentElement) {
        if (Number(getComputedStyle(node).opacity) < 1) {
          sample.unknown = "opacidade";
          return sample;
        }
      }
      el.scrollIntoView({ block: "center", behavior: "instant" });
      const r = el.getBoundingClientRect();
      const x = Math.max(1, Math.min(innerWidth - 2, r.left + Math.min(r.width / 2, 60)));
      const y = Math.max(1, Math.min(innerHeight - 2, r.top + r.height / 2));
      let started = false;
      for (const node of document.elementsFromPoint(x, y)) {
        const related = node === el || node.contains(el) || el.contains(node);
        if (!started && !related) {
          // A window or a bar that stays on screen is not what the text sits on, and a box that paints
          // nothing covers nothing; anything else covers the text.
          let pinnedAbove = false;
          for (let up = node; up && !pinnedAbove; up = up.parentElement) pinnedAbove = getComputedStyle(up).position === "fixed";
          if (pinnedAbove) continue;
          const coverStyle = getComputedStyle(node);
          if (!paints(coverStyle) && !paintedPseudo(node) && !/^(img|video|canvas|picture|iframe|svg)$/.test(node.localName)) continue;
          sample.unknown = "coberto";
          return sample;
        }
        started = true;
        if (el.contains(node) && node !== el) continue;
        if (/^(img|video|canvas|picture|iframe|svg)$/.test(node.localName)) {
          sample.unknown = "imagem";
          return sample;
        }
        if (paintedPseudo(node)) {
          sample.unknown = "camada";
          return sample;
        }
        const nodeStyle = getComputedStyle(node);
        if (nodeStyle.backgroundImage && nodeStyle.backgroundImage !== "none") {
          sample.unknown = "imagem";
          return sample;
        }
        if (!isTransparent(nodeStyle.backgroundColor)) {
          sample.stack.push(nodeStyle.backgroundColor);
          if (opaque(nodeStyle.backgroundColor)) break;
        }
      }
      if (!started) sample.unknown = "coberto";
      return sample;
    };
    return { samples: Array.from(pairs.values()).map(read) };
  }

  // The product scenes the page marks with data-demo.
  attempt("demos", () => {
    const LABEL = re(options.demoLabel);
    return Array.from(document.querySelectorAll("[data-demo]")).slice(0, 10).map((el) => {
      const around = clean(`${el.innerText || ""} ${el.parentElement ? el.parentElement.innerText || "" : ""}`).slice(0, 1500);
      const named = clean(el.getAttribute("aria-label")) || (el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean).map((id) => clean((document.getElementById(id) || {}).textContent)).join(" ");
      return {
        name: el.getAttribute("data-demo") || null,
        ...boxOf(el),
        section: sectionOf(el),
        headings: el.querySelectorAll("h1, h2, h3, h4, h5, h6").length,
        has_name: Boolean(named),
        label_near: LABEL.test(fold(around)),
      };
    });
  });

  // What there is to read inside an element, block by block: short labels are seen, sentences are read.
  const wordCount = (text) => (String(text).match(/[\p{L}\p{N}][\p{L}\p{N}.,:/-]*/gu) || []).length;
  const readingOf = (root) => {
    const blocks = new Map();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!/\S/.test(node.nodeValue)) continue;
      const parent = node.parentElement;
      if (!parent || parent.closest("script, style, noscript, template") || !shown(parent)) continue;
      const box = parent.getBoundingClientRect();
      if (box.width <= 2 || box.height <= 2) continue; // text kept for screen readers only
      let block = parent;
      while (block !== root && block.parentElement && /^(inline|contents|ruby)/.test(getComputedStyle(block).display)) block = block.parentElement;
      blocks.set(block, `${blocks.get(block) || ""} ${node.nodeValue}`);
    }
    const counts = Array.from(blocks.values()).map(wordCount).filter(Boolean);
    return {
      words: counts.reduce((sum, count) => sum + count, 0),
      read_words: counts.filter((count) => count >= options.readBlockWords).reduce((sum, count) => sum + count, 0),
      longest: counts.length ? Math.max(...counts) : 0,
      blocks: counts.length,
    };
  };
  const PICTURE = "img, video, canvas, svg, picture";
  const pictureShare = (root) => {
    const own = root.getBoundingClientRect();
    if (!own.width || !own.height) return 0;
    const covered = Array.from(root.querySelectorAll(PICTURE))
      .filter((el) => shown(el))
      .map((el) => el.getBoundingClientRect())
      .filter((box) => box.width >= 48 && box.height >= 48)
      .reduce((sum, box) => sum + box.width * box.height, 0);
    return Math.round(Math.min(1, covered / (own.width * own.height)) * 100) / 100;
  };

  // The figures a page marks, with what they ask to be read. A figure is looked at; a sentence inside it is not.
  attempt("figures", () => {
    const list = [];
    for (const el of document.querySelectorAll("[data-figura], [data-demo]")) {
      if (list.length >= 30 || !shown(el)) continue;
      list.push({
        name: el.getAttribute("data-figura") || el.getAttribute("data-demo") || null,
        mark: el.hasAttribute("data-figura") ? "figura" : "demo",
        ...boxOf(el),
        section: sectionOf(el),
        ...readingOf(el),
        picture_share: pictureShare(el),
      });
    }
    return list;
  });

  // Boxes side by side that hold text: how much each asks to be read, and the tallest empty stretch inside it.
  attempt("cards", () => {
    const boxed = (el) => {
      const style = getComputedStyle(el);
      const border = parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== "none" && !isTransparent(style.borderTopColor);
      return border || !isTransparent(style.backgroundColor) || style.boxShadow !== "none";
    };
    const FAQ_TITLE = re(options.faqTitle);
    const QUOTE = /[“”"«][^\s]/;
    const RATING = /(?<![a-z])(avaliacao|estrelas|stars?)(?![a-z])/;
    const PRICE = re(options.price);
    const cardKind = (el, text) => {
      if (el.querySelector("input, textarea, select")) return "form";
      if (el.querySelector("pre, code")) return "code";
      if (el.matches("details, [aria-expanded]") || el.querySelector("details, [aria-expanded]")) return "faq";
      const section = headings()[(sectionOf(el) || 1) - 1];
      if (section && FAQ_TITLE.test(fold(section.innerText))) return "faq";
      if (PRICE.test(joinCents(text))) return "priced";
      if (el.querySelector("blockquote, q, cite") || QUOTE.test(text.slice(0, 120)) || RATING.test(fold(text.slice(0, 40)))) return "quote";
      return "card";
    };
    const holeOf = (el) => {
      const own = el.getBoundingClientRect();
      if (!own.height) return 0;
      const spans = [];
      for (const node of el.querySelectorAll("*")) {
        const solid = /^(img|video|canvas|svg|input|button|picture)$/.test(node.localName);
        if (node.closest("svg") && node.localName !== "svg") continue;
        if (!solid && node.children.length) continue;
        if (!shown(node)) continue;
        const box = node.getBoundingClientRect();
        if (box.height >= own.height * 0.8) continue; // a layer behind the content
        spans.push([box.top, box.bottom]);
      }
      spans.sort((a, b) => a[0] - b[0]);
      let cursor = own.top;
      let gap = 0;
      for (const [top, bottom] of spans) {
        if (top > cursor) gap = Math.max(gap, top - cursor);
        cursor = Math.max(cursor, bottom);
      }
      return Math.round((Math.max(gap, own.bottom - cursor) / own.height) * 100) / 100;
    };
    const seen = new Set();
    const list = [];
    const all = document.querySelectorAll("body *");
    for (let i = 0; i < all.length && i < options.maxElements && list.length < options.maxCards; i++) {
      const parent = all[i];
      if (parent.closest("nav, header, footer, script, style, noscript, template") || !shown(parent) || inFixed(parent)) continue;
      const kids = Array.from(parent.children).filter((kid) => !seen.has(kid) && shown(kid) && boxed(kid));
      const cards = kids.filter((kid) => {
        const box = kid.getBoundingClientRect();
        return box.width >= 160 && box.height >= 80 && box.width < innerWidth * 0.9;
      });
      if (cards.length < 2) continue;
      for (const card of cards) {
        const text = clean(card.innerText);
        const reading = readingOf(card);
        if (reading.words < 3) continue;
        seen.add(card);
        list.push({ text: text.slice(0, 60), kind: cardKind(card, text), ...boxOf(card), section: sectionOf(card), ...reading, hole: holeOf(card), picture_share: pictureShare(card) });
      }
    }
    return list;
  });

  // The defaults a model reaches for that a page shows in its styles. Each comes with a few examples.
  attempt("defaults", () => {
    const found = { gradient_text: [], glass: [], glow: [], blobs: [], equal_cards: [], status_dots: [] };
    const counts = { gradient_text: 0, glass: 0, glow: 0, blobs: 0, equal_cards: 0, status_dots: 0 };
    const note = (kind, text) => {
      counts[kind]++;
      if (found[kind].length < 4) found[kind].push(clean(text).slice(0, 60));
    };
    const coloredGlow = (shadow) => {
      if (!shadow || shadow === "none") return false;
      return shadow.split(/,(?![^(]*\))/).some((part) => {
        const color = /(?:rgba?|oklch|oklab|lab|lch|hsla?|color)\([^)]*\)|#[0-9a-f]{3,8}/i.exec(part);
        const numbers = part.replace(color ? color[0] : "", " ").match(/-?\d*\.?\d+px/g) || [];
        const [x, y, blur] = numbers.map((value) => parseFloat(value));
        if (x !== 0 || y !== 0 || !(blur >= 20) || !color) return false;
        const rgb = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(color[0]);
        if (!rgb) return true;
        return Math.max(+rgb[1], +rgb[2], +rgb[3]) - Math.min(+rgb[1], +rgb[2], +rgb[3]) > 30;
      });
    };
    const runningOn = new Map();
    if (typeof document.getAnimations === "function") {
      for (const animation of document.getAnimations()) {
        const timing = animation.effect && animation.effect.getComputedTiming ? animation.effect.getComputedTiming() : {};
        if (animation.playState === "running" && timing.iterations === Infinity && animation.effect.target) runningOn.set(animation.effect.target, true);
      }
    }
    const all = document.querySelectorAll("body *");
    for (let i = 0; i < all.length && i < options.maxElements; i++) {
      const el = all[i];
      if (el.closest("script, style, noscript, template") || !shown(el)) continue;
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const words = clean(el.innerText).slice(0, 60);
      if ((style.webkitBackgroundClip === "text" || style.backgroundClip === "text") && words) note("gradient_text", words);
      if (style.backdropFilter && /blur/.test(style.backdropFilter) && r.width >= 120 && r.height >= 40) note("glass", words || el.localName);
      if (coloredGlow(style.boxShadow) || (words && coloredGlow(style.textShadow))) note("glow", words || el.localName);
      const positioned = style.position === "absolute" || style.position === "fixed";
      if (positioned && !words && r.width >= 150 && r.height >= 150) {
        const blur = /blur\(\s*(\d*\.?\d+)px/.exec(style.filter || "");
        const fading = /radial-gradient\([^)]*(?:transparent|rgba\([^)]*,\s*0(?:\.0+)?\))/.test(style.backgroundImage || "");
        if ((blur && parseFloat(blur[1]) >= 30) || fading) note("blobs", el.className && typeof el.className === "string" ? el.className : el.localName);
      }
      if (runningOn.has(el) && r.width <= 14 && r.height <= 14 && r.width > 0 && parseFloat(style.borderTopLeftRadius) >= r.width / 2 - 1) note("status_dots", clean(el.parentElement ? el.parentElement.innerText : "") || el.localName);
      const kids = Array.from(el.children).filter((kid) => shown(kid));
      if (kids.length === 3 && kids.every((kid) => kid.localName === kids[0].localName && kid.className === kids[0].className)) {
        const boxes = kids.map((kid) => kid.getBoundingClientRect());
        const same = boxes.every((box) => Math.abs(box.width - boxes[0].width) <= 2 && Math.abs(box.top - boxes[0].top) <= 2 && Math.abs(box.height - boxes[0].height) <= 2);
        if (same && boxes[0].width >= 200 && boxes[0].height >= 100 && kids.every((kid) => clean(kid.innerText).length >= 20) && !kids.some((kid) => re(options.price).test(joinCents(clean(kid.innerText))))) {
          const section = headings()[(sectionOf(el) || 1) - 1];
          note("equal_cards", section ? section.innerText : clean(kids[0].innerText));
        }
      }
    }
    let total = 0;
    let mono = 0;
    const fonts = new Map();
    eachText(options.maxElements, (text, parent) => {
      total += text.length;
      if (parent.closest("code, pre, kbd, samp")) return;
      let family = fonts.get(parent);
      if (family === undefined) {
        family = getComputedStyle(parent).fontFamily || "";
        fonts.set(parent, family);
      }
      if (/mono|courier|consolas|menlo|monaco/i.test(family)) mono += text.length;
    });
    return { found, counts, mono_share: total ? Math.round((mono / total) * 1000) / 1000 : 0 };
  });

  return out;
}
/* eslint-enable no-undef */

const inPage = (fn, arg) => `(${fn.toString()})(${arg === undefined ? "" : JSON.stringify(arg)})`;
/** A regular expression as data a page function rebuilds with `new RegExp(source, flags)`, without the global flag. */
const asPattern = (regex) => ({ source: regex.source, flags: regex.flags.replace("g", "") });

// ---------------------------------------------------------------------------------------------
// Brand assembly (pure)
// ---------------------------------------------------------------------------------------------

/** The brand sheet other apps read, built from the raw extraction and the assets that were saved. */
export function buildBrand(raw, assets = []) {
  const doc = raw.document ?? {};
  const ld = summarizeJsonLd(raw.jsonld ?? []);
  const text = raw.text ?? "";
  const name = siteName({ ogSiteName: doc.og?.site_name, jsonldName: ld.organization?.name, title: doc.title });
  // Without an h1, a text clearly bigger than the body copy is the headline; else the share
  // title or the document title (a page of same-size paragraphs has no headline of its own).
  const headings = raw.headings ?? {};
  const bigger = headings.largest && headings.largest_size >= (headings.body_size || 16) * 1.3 ? headings.largest : null;
  const headline = headings.h1?.[0] ?? bigger ?? doc.og?.title ?? doc.title ?? null;
  const description = doc.description ?? doc.og?.description ?? ld.organization?.description ?? null;

  const backgrounds = colorTally(raw.colors?.backgrounds ?? []);
  const texts = colorTally(raw.colors?.texts ?? []);
  // shares are per kind (backgrounds, texts); the order across kinds goes by painted area
  const palette = [...backgrounds.map((e) => ({ ...e, source: "background" })), ...texts.map((e) => ({ ...e, source: "text" }))].sort((a, b) => b.area - a.area).slice(0, 10);
  const elements = raw.colors?.elements ?? {};
  const ctaColors = (raw.cta ?? []).map((c) => toHex(c.background)).filter(Boolean);
  const linkColors = [toHex(elements.link?.color), toHex(elements.button?.background)].filter(Boolean);
  const primary = pickPrimary({ cta: ctaColors, links: linkColors, themeColor: toHex(doc.theme_color), palette });
  const background = toHex(elements.body?.background) ?? toHex(elements.html?.background) ?? "#FFFFFF";
  const textColor = toHex(elements.body?.color) ?? texts[0]?.hex ?? "#000000";

  const fonts = raw.fonts ?? {};
  const faces = new Map();
  for (const face of fonts.faces ?? []) {
    if (!face.family) continue;
    const entry = faces.get(face.family) ?? { family: face.family, weights: [], loaded: false, src: [] };
    if (face.weight && !entry.weights.includes(face.weight)) entry.weights.push(face.weight);
    for (const src of face.src ?? []) if (!entry.src.includes(src)) entry.src.push(src);
    faces.set(face.family, entry);
  }
  for (const face of fonts.loaded ?? []) {
    if (!face.family) continue;
    const entry = faces.get(face.family) ?? { family: face.family, weights: [], loaded: false, src: [] };
    if (face.weight && !entry.weights.includes(face.weight)) entry.weights.push(face.weight);
    if (face.status === "loaded") entry.loaded = true;
    faces.set(face.family, entry);
  }

  const savedLogos = assets.filter((a) => a.saved && a.role === "logo");
  const savedIcon = assets.find((a) => a.saved && (a.role === "apple-touch-icon" || a.role === "favicon"));
  const logo = savedLogos.length
    ? { file: savedLogos[0].file, source: savedLogos[0].source ?? "dom", kind: savedLogos[0].kind ?? null, width: savedLogos[0].width ?? null, height: savedLogos[0].height ?? null, alternatives: savedLogos.slice(1).map((a) => a.file) }
    : savedIcon
      ? { file: savedIcon.file, source: "icon", kind: "img", width: null, height: null, alternatives: [] }
      : null;

  const links = raw.links ?? [];
  const social = collectSocial([...links, ...ld.same_as.map((href) => ({ href }))]);
  const contacts = collectContacts(links);
  if (ld.organization?.telephone && !contacts.phones.length) contacts.phones.push(ld.organization.telephone);
  if (ld.organization?.email && !contacts.emails.length) contacts.emails.push(ld.organization.email);

  return {
    name,
    title: doc.title ?? null,
    headline,
    description,
    logo,
    colors: { primary, background, text: textColor, palette },
    fonts: {
      headline: firstFamily(fonts.h1) ?? firstFamily(fonts.body),
      body: firstFamily(fonts.body),
      ui: firstFamily(fonts.button) ?? firstFamily(fonts.nav) ?? firstFamily(fonts.body),
      faces: [...faces.values()].slice(0, 20),
    },
    cta: (raw.cta ?? []).map((c) => ({ text: c.text, href: c.href ?? null, background: toHex(c.background), color: toHex(c.color) })),
    numbers: findNumbers(text),
    prices: (raw.prices ?? []).map((p) => ({ text: p.text, value: parsePrice(p.text), currency: "BRL", product: p.product ?? null, context: p.context ?? null })),
    products: ld.products,
    social,
    contacts,
    nav: (raw.nav ?? []).map((item) => item.text),
    sector_cues: sectorCues(text),
    language: languageCues(text, doc.lang),
    has_login_area: hasLoginArea(links),
    word_count: wordCount(text),
    jsonld_types: ld.types,
    address: ld.organization?.address ?? null,
  };
}

// ---------------------------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------------------------

function decodeDataUrl(url, maxBytes) {
  const m = /^data:([^;,]+)?((?:;[^;,]+)*),(.*)$/is.exec(url);
  if (!m) throw new Error("data: malformado");
  const type = (m[1] ?? "text/plain").toLowerCase();
  if (!type.startsWith("image/")) throw new Error(`não é imagem (${type})`);
  const base64 = /;base64/i.test(m[2] ?? "");
  const bytes = base64 ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3]), "utf8");
  if (bytes.length > maxBytes) throw new Error("maior que 10 MB");
  return { bytes, contentType: type };
}

/**
 * Bytes of one image: inline SVG markup, a data: URL, a local file (only when the page itself
 * is local) or an http(s) download with timeout, size cap and content-type check. Never runs
 * anything and never keeps what is not an image.
 */
export async function fetchImage(source, { timeoutMs = ASSET_TIMEOUT_MS, maxBytes = ASSET_MAX_BYTES, allowFile = false, userAgent = DESKTOP_USER_AGENT, referer = null } = {}) {
  if (source.markup) return { bytes: Buffer.from(source.markup, "utf8"), contentType: "image/svg+xml" };
  let url;
  try {
    url = new URL(source.url);
  } catch {
    throw new Error("endereço inválido");
  }
  if (url.protocol === "data:") return decodeDataUrl(source.url, maxBytes);
  if (url.protocol === "file:") {
    if (!allowFile) throw new Error("arquivo local fora de uma página local");
    const path = fileURLToPath(url);
    const type = IMAGE_EXTENSIONS[extname(path).toLowerCase()];
    if (!type) throw new Error("extensão que não é de imagem");
    if (statSync(path).size > maxBytes) throw new Error("maior que 10 MB");
    return { bytes: readFileSync(path), contentType: type };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`protocolo ${url.protocol} não permitido`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { accept: "image/avif,image/webp,image/svg+xml,image/*;q=0.9,*/*;q=0.5", "user-agent": userAgent, "accept-language": ACCEPT_LANGUAGE };
    if (referer) headers.referer = referer;
    const response = await fetch(url, { signal: controller.signal, redirect: "follow", headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const svgByName = /\.svg$/i.test(url.pathname) && /^(text\/xml|application\/xml|text\/plain|application\/octet-stream)$/.test(type);
    if (!type.startsWith("image/") && !svgByName) throw new Error(`não é imagem (${type || "sem tipo"})`);
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > maxBytes) throw new Error("maior que 10 MB");
    const chunks = [];
    let total = 0;
    for await (const chunk of response.body) {
      total += chunk.length;
      if (total > maxBytes) {
        controller.abort();
        throw new Error("maior que 10 MB");
      }
      chunks.push(chunk);
    }
    return { bytes: Buffer.concat(chunks), contentType: type.startsWith("image/") ? type : "image/svg+xml" };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`demorou mais de ${Math.round(timeoutMs / 1000)} s`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** The download list: the best logos, the icons and the share image, without repeats. */
export function planAssets(raw, ranked) {
  const plan = [];
  const seen = new Set();
  const add = (entry) => {
    const key = entry.markup ? `markup:${entry.markup.slice(0, 200)}` : entry.url;
    if (!key || seen.has(key)) return;
    seen.add(key);
    plan.push(entry);
  };
  let index = 0;
  for (const candidate of ranked) {
    if (index >= MAX_LOGO_DOWNLOADS) break;
    if (!candidate.src && !candidate.markup) continue;
    if (candidate.source === "icon") continue; // icons come under their own roles below
    index++;
    add({ role: "logo", index, url: candidate.src ?? null, markup: candidate.markup ?? null, source: candidate.source, kind: candidate.kind, width: candidate.width ?? null, height: candidate.height ?? null, score: candidate.score });
  }
  const icons = [...(raw.icons ?? [])];
  const apple = icons.filter((i) => /apple-touch-icon/.test(i.rel)).sort((a, b) => iconSize(b) - iconSize(a))[0];
  const favicon = icons.filter((i) => !/apple-touch-icon|mask-icon/.test(i.rel)).sort((a, b) => iconSize(b) - iconSize(a))[0];
  if (apple) add({ role: "apple-touch-icon", url: apple.href, source: "icon", kind: "img" });
  if (favicon) add({ role: "favicon", url: favicon.href, source: "icon", kind: "img" });
  if (raw.document?.og?.image) add({ role: "og-image", url: raw.document.og.image, source: "og", kind: "img" });
  return plan;
}

async function saveAssets(plan, { dir, allowFile, referer, onProgress }) {
  ensureDir(dir);
  const results = await mapLimit(plan, 3, async (entry) => {
    try {
      const { bytes, contentType } = await fetchImage(entry, { allowFile, referer });
      const type = sniffImage(bytes) ?? (contentType === "image/svg+xml" ? null : contentType);
      if (!type || !IMAGE_TYPES[type]) throw new Error("o conteúdo não parece uma imagem");
      const file = assetFileName({ role: entry.role, index: entry.index, url: entry.url, type });
      writeFileAtomic(join(dir, file), bytes);
      return { ...entry, saved: true, file: `assets/${file}`, bytes: bytes.length, content_type: type, error: null };
    } catch (error) {
      return { ...entry, saved: false, file: null, bytes: 0, content_type: null, error: String(error?.message ?? error) };
    }
  });
  onProgress(`Imagens guardadas: ${results.filter((r) => r.saved).length} de ${plan.length}`);
  return results;
}

// ---------------------------------------------------------------------------------------------
// Browser steps
// ---------------------------------------------------------------------------------------------

/** Counts requests in flight and remembers the main document's response (status, type). */
export function trackNetwork(page, mainFrameId) {
  const state = { inflight: new Set(), document: null, mainFrameId, resources: new Map() };
  const mine = (sessionId) => sessionId === page.sessionId;
  const offs = [
    page.browser.on("Network.requestWillBeSent", (params, sessionId) => {
      if (!mine(sessionId) || params.redirectResponse) return;
      state.inflight.add(params.requestId);
    }),
    page.browser.on("Network.loadingFinished", (params, sessionId) => {
      if (!mine(sessionId)) return;
      state.inflight.delete(params.requestId);
      const resource = state.resources.get(params.requestId);
      if (resource) resource.bytes = params.encodedDataLength ?? 0;
    }),
    page.browser.on("Network.loadingFailed", (params, sessionId) => mine(sessionId) && state.inflight.delete(params.requestId)),
    page.browser.on("Network.responseReceived", (params, sessionId) => {
      if (!mine(sessionId)) return;
      state.resources.set(params.requestId, { url: params.response?.url ?? null, type: params.type ?? "Other", bytes: 0 });
      if (params.type !== "Document") return;
      if (state.mainFrameId && params.frameId && params.frameId !== state.mainFrameId) return;
      state.document = { status: params.response?.status ?? null, mime_type: params.response?.mimeType ?? null, url: params.response?.url ?? null };
    }),
  ];
  state.stop = () => offs.forEach((off) => off());
  state.reset = () => {
    state.inflight.clear();
    state.document = null;
    state.resources.clear();
  };
  return state;
}

export async function waitForNetworkQuiet(state, { idleMs = 400, timeoutMs = NETWORK_QUIET_MS } = {}) {
  const started = Date.now();
  let quietSince = state.inflight.size === 0 ? Date.now() : null;
  while (Date.now() - started < timeoutMs) {
    if (state.inflight.size === 0) {
      quietSince ??= Date.now();
      if (Date.now() - quietSince >= idleMs) return true;
    } else quietSince = null;
    await sleep(50);
  }
  return false;
}

export async function setMetrics(page, { width, height, scale, mobile }) {
  page.width = width;
  page.height = height;
  page.scale = scale;
  await page.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile, screenWidth: width, screenHeight: height });
}

/** Scrolls through the page once so lazy images and sections load before the photos. */
async function warmUp(page) {
  const state = await page.evaluate(inPage(pageStateInPage), { awaitPromise: false });
  const max = Math.min(Math.max(0, state.scroll_height - state.inner_height), MAX_FULL_HEIGHT);
  if (max > 0) {
    const step = Math.max(200, Math.floor(state.inner_height * 0.8));
    for (let y = step; y <= max; y += step) {
      await page.evaluate(`window.scrollTo({ top: ${y}, left: 0, behavior: "instant" }); 0`, { awaitPromise: false });
      await sleep(60);
    }
    await page.evaluate(`window.scrollTo({ top: ${max}, left: 0, behavior: "instant" }); 0`, { awaitPromise: false });
    await sleep(120);
    await page.evaluate('window.scrollTo({ top: 0, left: 0, behavior: "instant" }); 0', { awaitPromise: false });
    await sleep(200);
  }
  return state;
}

export async function dismissCookies(page) {
  const patterns = { accept: asPattern(COOKIE_ACCEPT_PATTERN), hint: asPattern(COOKIE_HINT_PATTERN) };
  const result = await page.evaluate(inPage(dismissCookieBannerInPage, patterns), { awaitPromise: false }).catch((error) => ({ clicked: false, error: error.message }));
  if (!result.clicked) return { dismissed: false, button: null, candidates: result.candidates ?? 0 };
  await sleep(400);
  const hidden = await page.evaluate(inPage(cookieButtonHiddenInPage), { awaitPromise: false }).catch(() => null);
  return { dismissed: true, button: result.text, hidden_after_click: hidden, candidates: result.candidates ?? 0 };
}

const SCROLL_TOP = 'window.scrollTo({ top: 0, left: 0, behavior: "instant" }); 0';
const SCROLL_END = 'window.scrollTo({ top: Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0), left: 0, behavior: "instant" }); 0';

function anatomyOptions(parts, extra = {}) {
  return {
    parts,
    ...ANATOMY_LIMITS,
    smallTextPx: SMALL_TEXT_PX,
    minTarget: MIN_TARGET_PX,
    readBlockWords: READ_BLOCK_WORDS,
    maxCards: MAX_CARDS,
    faqTitle: asPattern(FAQ_TITLE_PATTERN),
    maxContrast: 60,
    demoLabel: asPattern(DEMO_LABEL_PATTERN),
    price: asPattern(PRICE_PATTERN),
    timer: asPattern(TIMER_PATTERN),
    decline: asPattern(DECLINE_PATTERN),
    skipLink: asPattern(SKIP_LINK_PATTERN),
    cookieAccept: asPattern(COOKIE_ACCEPT_PATTERN),
    cookieName: asPattern(COOKIE_NAME_PATTERN),
    cookieText: asPattern(COOKIE_TEXT_PATTERN),
    ...extra,
  };
}

function readAnatomy(page, parts, { extra = {}, timeoutMs = 60000 } = {}) {
  return page.evaluate(inPage(anatomyInPage, anatomyOptions(parts, extra)), { awaitPromise: false, timeoutMs });
}

/**
 * The desktop reading: everything at the top of the page; after a jump to the end, the fixed
 * elements again and the animations running; and the timers once more, 1.2 s after the first
 * read. Leaves the page at the top for the scroll recording.
 */
async function readAnatomyDesktop(page) {
  await page.evaluate(SCROLL_TOP, { awaitPromise: false });
  await sleep(150);
  const top = await readAnatomy(page, ["sections", "ctas", "fixed", "forms", "prices", "media", "motion", "timers"]);
  const firstRead = Date.now();
  await page.evaluate(SCROLL_END, { awaitPromise: false });
  await sleep(SCROLL_SETTLE_MS);
  const end = await readAnatomy(page, ["fixed", "running"], { timeoutMs: 30000 });
  let again = null;
  const timers = Array.isArray(top?.timers) ? top.timers : [];
  if (timers.length) {
    const wait = TIMER_GAP_MS - (Date.now() - firstRead);
    if (wait > 0) await sleep(wait);
    again = await readAnatomy(page, ["timer_texts"], { extra: { ids: timers.map((timer) => timer.id) }, timeoutMs: 30000 });
  }
  await page.evaluate(SCROLL_TOP, { awaitPromise: false });
  await sleep(150);
  return { top, end, again };
}

/** A measurement of the finished page, read apart from the anatomy: what fails here stays null, with the reason in `errors`. */
async function readQuality(page, parts, extra = {}) {
  try {
    await page.evaluate(SCROLL_TOP, { awaitPromise: false });
    return await readAnatomy(page, parts, { extra });
  } catch (error) {
    return { errors: [String(error?.message ?? error)] };
  }
}

/** The mobile reading: where each call to action sits at the top, and the fixed elements at the top and at the end. */
/** The fixed elements on arrival, before the warm-up scroll; null when the reading fails. */
async function readArrival(page) {
  try {
    const read = await readAnatomy(page, ["fixed"], { timeoutMs: 20000 });
    return Array.isArray(read?.fixed) ? read.fixed : null;
  } catch {
    return null;
  }
}

async function readAnatomyMobile(page) {
  await page.evaluate(SCROLL_TOP, { awaitPromise: false });
  await sleep(150);
  const top = await readAnatomy(page, ["cta_positions", "fixed"]);
  await page.evaluate(SCROLL_END, { awaitPromise: false });
  await sleep(SCROLL_SETTLE_MS);
  const end = await readAnatomy(page, ["fixed"], { timeoutMs: 30000 });
  await page.evaluate(SCROLL_TOP, { awaitPromise: false });
  await sleep(150);
  return { top, end };
}

/**
 * The whole page in one PNG. First the browser paints beyond the viewport (100vh sections
 * keep their size); when that is refused or comes back short, the viewport is resized instead.
 */
async function fullPageScreenshot(page, { width, height, scale, mobile }) {
  const metrics = await page.send("Page.getLayoutMetrics");
  const content = Math.ceil(metrics.cssContentSize?.height ?? metrics.contentSize?.height ?? height);
  const limit = Math.min(MAX_FULL_HEIGHT, Math.floor(MAX_DEVICE_HEIGHT / scale));
  const full = clamp(content, height, limit);
  try {
    const { data } = await page.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: full, scale: 1 } }, 60000);
    const png = Buffer.from(data, "base64");
    const size = pngSize(png);
    if (size && size.height >= full * scale - 2) return { png, height: full, content_height: content, truncated: content > limit, method: "beyond_viewport" };
  } catch {
    // fall back to resizing the viewport
  }
  await setMetrics(page, { width, height: full, scale, mobile });
  await sleep(300);
  try {
    const png = await page.screenshot({ format: "png", timeoutMs: 60000 });
    return { png, height: full, content_height: content, truncated: content > limit, method: "resized_viewport" };
  } finally {
    await setMetrics(page, { width, height, scale, mobile });
    await page.evaluate('window.scrollTo({ top: 0, left: 0, behavior: "instant" }); 0', { awaitPromise: false }).catch(() => null);
  }
}

/* eslint-disable no-undef */
function noLettersOnInPage(css) {
  const style = document.createElement("style");
  style.id = "__flyee_no_letters";
  style.textContent = css;
  document.head.append(style);
  // Text painted through its own background (a gradient title) would stay as letters.
  const touched = [];
  for (const el of document.querySelectorAll("body *")) {
    const computed = getComputedStyle(el);
    if (computed.webkitBackgroundClip !== "text" && computed.backgroundClip !== "text") continue;
    touched.push([el, el.style.getPropertyValue("background-image"), el.style.getPropertyPriority("background-image")]);
    el.style.setProperty("background-image", "none", "important");
  }
  window.__flyeeNoLetters = touched;
  return touched.length;
}

function noLettersOffInPage() {
  document.getElementById("__flyee_no_letters")?.remove();
  for (const [el, value, priority] of window.__flyeeNoLetters ?? []) {
    if (value) el.style.setProperty("background-image", value, priority);
    else el.style.removeProperty("background-image");
  }
  window.__flyeeNoLetters = null;
  return true;
}
/* eslint-enable no-undef */

/**
 * The page with no letter on it, in one sheet: what a person sees before reading anything. A figure
 * that is an object still says what it is; a box with a sentence inside becomes an empty box. A photo
 * that fails never fails the capture: the file stays null, with a warning.
 */
async function writeNoLetters({ browser, page, outDir, name, label, width, scale, band, max, warnings }) {
  try {
    await page.evaluate(inPage(noLettersOnInPage, NO_LETTERS_CSS), { awaitPromise: false });
    await sleep(120);
    const metrics = await page.send("Page.getLayoutMetrics");
    const content = Math.ceil(metrics.cssContentSize?.height ?? metrics.contentSize?.height ?? band);
    const full = Math.min(content, max);
    const frames = [];
    for (let top = 0; top < full; top += band) {
      const height = Math.min(band, full - top);
      const { data } = await page.send("Page.captureScreenshot", { format: "jpeg", quality: 72, fromSurface: true, captureBeyondViewport: true, clip: { x: 0, y: top, width, height, scale: 1 / scale } }, 60000);
      frames.push({ bytes: Buffer.from(data, "base64"), label: `${top} px` });
    }
    await writeSheet(browser, frames, { title: `A página sem nenhuma letra, ${label}: ${width} px`, file: join(outDir, name), frameWidth: width });
    if (content > max) warnings.push(`A foto sem letras (${label}) parou em ${max} px de uma página de ${content} px.`);
    return name;
  } catch (error) {
    warnings.push(`A foto sem letras (${label}) falhou: ${error?.message ?? error}`);
    return null;
  } finally {
    await page.evaluate(inPage(noLettersOffInPage), { awaitPromise: false }).catch(() => null);
  }
}

/** A deterministic scroll from the top, eased, photographed frame by frame into an MP4. */
async function recordScroll(page, { ffmpegPath, out, seconds, fps, width, height, scale, maxScroll, label, onProgress }) {
  const plan = scrollPlan(seconds * fps, maxScroll);
  const encoder = startEncoder(ffmpegPath, { out, fps, frameFormat: "jpeg", crf: 18, width: width * scale, height: height * scale });
  try {
    for (let i = 0; i < plan.length; i++) {
      await page.evaluate(`window.scrollTo({ top: ${plan[i]}, left: 0, behavior: "instant" }); window.scrollY`, { awaitPromise: false });
      const frame = await page.screenshot({ format: "jpeg", quality: 90 });
      await encoder.write(frame);
      if (i % 30 === 0 || i === plan.length - 1) onProgress(`${label}: ${i + 1}/${plan.length} quadros`);
    }
    await encoder.end();
  } catch (error) {
    encoder.kill();
    throw error;
  }
  await page.evaluate('window.scrollTo({ top: 0, left: 0, behavior: "instant" }); 0', { awaitPromise: false }).catch(() => null);
  return { frames: plan.length, seconds: round(plan.length / fps, 2), fps, max_scroll: maxScroll, width: width * scale, height: height * scale };
}

function unreachable(url, error) {
  const detail = /\(([^)]+)\)/.exec(error?.message ?? "")?.[1] ?? error?.message ?? "sem resposta";
  const hints = [
    [/NAME_NOT_RESOLVED|DNS/i, "o endereço não existe ou o DNS não respondeu"],
    [/CONNECTION_REFUSED|CONNECTION_RESET|CONNECTION_CLOSED/i, "o servidor recusou a conexão"],
    [/TIMED_OUT/i, "o servidor demorou demais"],
    [/CERT|SSL/i, "o certificado do site é inválido"],
    [/FILE_NOT_FOUND/i, "o arquivo não existe"],
    [/INTERNET_DISCONNECTED|NETWORK_CHANGED/i, "esta máquina está sem internet"],
  ];
  const hint = hints.find(([pattern]) => pattern.test(detail))?.[1];
  return new AppError("site_unreachable", `Não consegui abrir ${url}${hint ? `: ${hint}` : ""} (${detail}).`, "Confira o endereço e a conexão; se o site estiver no ar, tente de novo em instantes.");
}

// ---------------------------------------------------------------------------------------------
// The capture
// ---------------------------------------------------------------------------------------------

/**
 * Visits `url`, photographs it at desktop and phone sizes, records the scroll, reads the brand
 * and saves everything into `outDir` with captura.json. `tools.ffmpeg` is optional: without it
 * the scroll videos are skipped with a warning. Returns the captura.json object.
 */
export async function captureSite({ url: input, outDir, tools = {}, browserPath = null, mobileWidth = 390, desktopWidth = 1440, scrollSeconds = 6, fps = 30, assets = true, noLetters = false, onProgress = () => {} }) {
  const url = normalizeUrl(input);
  const isLocal = url.startsWith("file:");
  const startedAt = Date.now();
  ensureDir(outDir);
  const warnings = [];
  const files = { desktop: null, desktop_full: null, mobile: null, mobile_full: null, scroll_desktop: null, scroll_mobile: null, no_letters_desktop: null, no_letters_mobile: null, capture: "captura.json", text: null, assets: [] };
  const viewports = {
    desktop: { width: desktopWidth, height: DESKTOP_HEIGHT, scale: 1, full_height: null },
    mobile: { width: mobileWidth, height: MOBILE_HEIGHT, scale: MOBILE_SCALE, full_height: null },
  };
  const scroll = { desktop: null, mobile: null };
  const layout = { mobile: null };
  // The anatomy never fails the capture: a reading that breaks leaves anatomy null, with a warning.
  const anatomyReads = { desktop: null, mobile: null };
  let anatomyFailure = null;
  const ffmpegPath = tools?.ffmpeg?.path ?? null;
  const desktopScrollSeconds = scrollSeconds > 0 ? Math.max(2, round(scrollSeconds * (2 / 3), 1)) : 0;
  let raw = null;
  let finalUrl = url;
  let httpStatus = null;
  let cookieBanner = null;
  let mobileCookieBanner = null;
  let pageErrors = [];
  let wall = null;
  let placeholder = null;

  const write = (name, bytes) => {
    writeFileAtomic(join(outDir, name), bytes);
    return name;
  };

  onProgress(`Abrindo ${siteLabel(url)} em tamanho de computador (${desktopWidth} px)…`);
  const browser = await Browser.launch({ path: browserPath, width: desktopWidth, height: DESKTOP_HEIGHT });
  let network = null;
  try {
    const page = await browser.newPage({ width: desktopWidth, height: DESKTOP_HEIGHT, deviceScaleFactor: 1 });
    await page.send("Network.enable");
    const { frameTree } = await page.send("Page.getFrameTree").catch(() => ({ frameTree: null }));
    network = trackNetwork(page, frameTree?.frame?.id ?? null);
    // Headless browsers announce themselves in the user agent and bot walls read it.
    const version = await browser.send("Browser.getVersion").catch(() => ({}));
    const desktopAgent = String(version.userAgent ?? DESKTOP_USER_AGENT).replace(/Headless/g, "");
    await page.send("Emulation.setUserAgentOverride", { userAgent: desktopAgent, acceptLanguage: ACCEPT_LANGUAGE }).catch(() => null);

    try {
      await page.goto(url);
    } catch (error) {
      if (error instanceof AppError && error.code === "page_load_failed") throw unreachable(url, error);
      throw error;
    }
    await waitForNetworkQuiet(network);
    let state = await page.evaluate(inPage(pageStateInPage), { awaitPromise: false });
    finalUrl = state.url;
    httpStatus = network.document?.status ?? null;
    wall = isBotWall({ title: state.title, text: state.text, status: httpStatus });
    if (wall.blocked && state.words < 60) {
      const evidence = await page.screenshot({ format: "png" }).catch(() => null);
      if (evidence) write("bloqueio.png", evidence);
      throw new AppError("site_blocked", `O site não deixou o navegador entrar (${wall.reasons.join(", ")}).`, `Nada útil foi capturado${evidence ? "; bloqueio.png mostra a tela que o site devolveu" : ""}. Peça ao integrante uma captura de tela ou use outro endereço do mesmo site.`);
    }
    if (wall.blocked) warnings.push(`O site mostrou sinais de bloqueio (${wall.reasons.join(", ")}), mas havia conteúdo: confira as telas.`);
    else if (wall.http_error) {
      if (state.words < 30) throw new AppError("site_unreachable", `O endereço respondeu com erro HTTP ${httpStatus} e quase nenhum conteúdo.`, "Confira se o endereço está certo e se a página existe.");
      warnings.push(`O endereço respondeu com HTTP ${httpStatus}; capturei a página de erro que veio.`);
    }
    placeholder = placeholderPage({ title: state.title, text: state.text, words: state.words, url, finalUrl: state.url });
    if (placeholder && placeholder.kind !== "coming_soon") {
      const evidence = await page.screenshot({ format: "png" }).catch(() => null);
      if (evidence) write("sem-site.png", evidence);
      throw new AppError(
        "site_placeholder",
        `${siteLabel(url)} ainda não tem o site da marca: ${placeholder.label} (${placeholder.evidence}).`,
        `O logo, as cores e os textos dessa página são do provedor, não da marca${evidence ? "; sem-site.png mostra o que o endereço devolveu" : ""}. Use outro endereço da marca, ou peça o logo e duas ou três imagens ao integrante.`,
      );
    }
    if (placeholder) warnings.push(`A página parece provisória (${placeholder.evidence}): confira se o logo e as cores são mesmo da marca antes de usá-los.`);

    cookieBanner = await dismissCookies(page);
    if (cookieBanner.dismissed) onProgress(`Aviso de cookies fechado ("${cookieBanner.button}")`);
    const arrivalDesktop = await readArrival(page);
    state = await warmUp(page);
    await waitForNetworkQuiet(network, { timeoutMs: 1500 });

    onProgress("Fotografando a tela e a página inteira (computador)…");
    files.desktop = write("desktop.png", await page.screenshot({ format: "png" }));
    const desktopFull = await fullPageScreenshot(page, { width: desktopWidth, height: DESKTOP_HEIGHT, scale: 1, mobile: false });
    files.desktop_full = write("desktop-full.png", desktopFull.png);
    viewports.desktop.full_height = desktopFull.height;
    viewports.desktop.content_height = desktopFull.content_height;
    if (desktopFull.truncated) warnings.push(`A página tem ${desktopFull.content_height} px de altura; a foto inteira parou em ${desktopFull.height} px.`);
    if (noLetters) files.no_letters_desktop = await writeNoLetters({ browser, page, outDir, name: "sem-letras.jpg", label: "computador", width: desktopWidth, scale: 1, band: NO_LETTERS_BAND.desktop, max: NO_LETTERS_MAX.desktop, warnings });

    onProgress("Lendo a página: marca, cores, fontes, textos e números…");
    raw = await page.evaluate(inPage(extractInPage, { maxElements: 6000, maxText: 60000 }), { timeoutMs: 60000 });
    if (raw.errors?.length) warnings.push(`Parte da leitura falhou: ${raw.errors.slice(0, 3).join(" | ")}`);

    onProgress("Lendo a anatomia da página: seções, chamados, barras fixas, caixas, preços, vídeos e movimento…");
    try {
      anatomyReads.desktop = { ...(await readAnatomyDesktop(page)), arrival: arrivalDesktop };
      onProgress("Medindo a página no computador: contraste, botões e padrões visuais…");
      anatomyReads.desktop.quality = await readQuality(page, ["controls", "contrast", "demos", "defaults", "figures", "cards"]);
    } catch (error) {
      anatomyFailure = error?.message ?? String(error);
    }

    const desktopScrollable = Math.min(Math.max(0, state.scroll_height - state.inner_height), MAX_SCROLL);
    if (desktopScrollSeconds > 0 && ffmpegPath && desktopScrollable >= 100) {
      onProgress("Gravando a rolagem (computador)…");
      scroll.desktop = await recordScroll(page, { ffmpegPath, out: join(outDir, "rolagem-desktop.mp4"), seconds: desktopScrollSeconds, fps, width: desktopWidth, height: DESKTOP_HEIGHT, scale: 1, maxScroll: desktopScrollable, label: "Rolagem (computador)", onProgress });
      files.scroll_desktop = "rolagem-desktop.mp4";
    }

    onProgress(`Abrindo em tamanho de celular (${mobileWidth} px)…`);
    await setMetrics(page, { width: mobileWidth, height: MOBILE_HEIGHT, scale: MOBILE_SCALE, mobile: true });
    await page.send("Emulation.setUserAgentOverride", { userAgent: MOBILE_USER_AGENT, acceptLanguage: ACCEPT_LANGUAGE, platform: "Android" }).catch(() => null);
    await page.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }).catch(() => null);
    network.reset();
    try {
      await page.goto(finalUrl);
    } catch (error) {
      if (error instanceof AppError && error.code === "page_load_failed") throw unreachable(finalUrl, error);
      throw error;
    }
    await waitForNetworkQuiet(network);
    mobileCookieBanner = await dismissCookies(page);
    const arrivalMobile = await readArrival(page);
    const mobileState = await warmUp(page);
    await waitForNetworkQuiet(network, { timeoutMs: 1500 });

    onProgress("Fotografando a tela e a página inteira (celular)…");
    files.mobile = write("mobile.png", await page.screenshot({ format: "png" }));
    const positions = await page.evaluate(inPage(headingPositionsInPage), { awaitPromise: false }).catch(() => null);
    const mobileFull = await fullPageScreenshot(page, { width: mobileWidth, height: MOBILE_HEIGHT, scale: MOBILE_SCALE, mobile: true });
    files.mobile_full = write("mobile-full.png", mobileFull.png);
    viewports.mobile.full_height = mobileFull.height;
    viewports.mobile.content_height = mobileFull.content_height;
    layout.mobile = mobileLayout(positions, { fullHeight: mobileFull.height, viewportHeight: MOBILE_HEIGHT });
    if (noLetters) files.no_letters_mobile = await writeNoLetters({ browser, page, outDir, name: "sem-letras-celular.jpg", label: "celular", width: mobileWidth, scale: MOBILE_SCALE, band: NO_LETTERS_BAND.mobile, max: NO_LETTERS_MAX.mobile, warnings });
    if (anatomyReads.desktop && !anatomyFailure) {
      try {
        anatomyReads.mobile = { ...(await readAnatomyMobile(page)), arrival: arrivalMobile };
        onProgress("Medindo a página no celular: largura, texto, toque e imagens…");
        anatomyReads.mobile.quality = await readQuality(page, ["overflow", "small_text", "tap_targets", "controls", "images"], { viewportWidth: mobileWidth });
        anatomyReads.mobile.weight = pageWeight(network.resources);
      } catch (error) {
        anatomyFailure = error?.message ?? String(error);
      }
    }

    const mobileScrollable = Math.min(Math.max(0, mobileState.scroll_height - mobileState.inner_height), MAX_SCROLL);
    if (scrollSeconds > 0 && ffmpegPath && mobileScrollable >= 100) {
      onProgress("Gravando a rolagem (celular)…");
      scroll.mobile = await recordScroll(page, { ffmpegPath, out: join(outDir, "rolagem-mobile.mp4"), seconds: scrollSeconds, fps, width: mobileWidth, height: MOBILE_HEIGHT, scale: MOBILE_SCALE, maxScroll: mobileScrollable, label: "Rolagem (celular)", onProgress });
      files.scroll_mobile = "rolagem-mobile.mp4";
    }
    if (scrollSeconds > 0 && !ffmpegPath) warnings.push("Sem ffmpeg nesta máquina: as rolagens não foram gravadas. A IA instala com `npx --yes flyee@latest need ffmpeg --yes --json`.");
    else if (scrollSeconds > 0 && mobileScrollable < 100 && desktopScrollable < 100) warnings.push("A página não rola (ou rola só dentro de um contêiner interno): sem vídeo de rolagem.");

    pageErrors = [...new Set([...page.errors, ...page.console])].slice(0, 8);
    await page.close();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("capture_failed", `A captura de ${siteLabel(url)} falhou: ${error?.message ?? error}`, "Tente de novo; se repetir, use --scroll 0 ou --no-assets para isolar o problema.");
  } finally {
    network?.stop();
    await browser.close();
  }

  // Assets (outside the browser: plain downloads, images only)
  const ranked = rankLogos(logoCandidates(raw));
  let saved = [];
  if (assets) {
    const plan = planAssets(raw, ranked);
    if (plan.length) {
      onProgress(`Baixando logo e imagens (${plan.length})…`);
      saved = await saveAssets(plan, { dir: join(outDir, "assets"), allowFile: isLocal, referer: isLocal ? null : finalUrl, onProgress });
      files.assets = saved.filter((a) => a.saved).map((a) => a.file);
      const failed = saved.filter((a) => !a.saved);
      if (failed.length) warnings.push(`Não consegui guardar ${failed.length} imagem(ns): ${failed.slice(0, 3).map((a) => `${a.role} (${a.error})`).join("; ")}.`);
    }
  }

  const brand = buildBrand(raw, saved);
  if (!brand.logo) warnings.push(ranked.length ? "Nenhum candidato a logo pôde ser guardado; veja raw.logos em captura.json." : "Não encontrei um logo na página.");
  if (!brand.colors.primary) warnings.push("Não achei uma cor de destaque saturada; a paleta traz as cores mais usadas.");
  if (pageErrors.length) warnings.push(`A página registrou erros de JavaScript: ${pageErrors.slice(0, 2).join(" | ")}`);

  const finished = finishAnatomy({
    desktop: anatomyReads.desktop,
    mobile: anatomyReads.mobile,
    failure: anatomyFailure,
    rawText: raw?.text ?? null,
    viewports: { desktop: { width: desktopWidth, height: DESKTOP_HEIGHT }, mobile: { width: mobileWidth, height: MOBILE_HEIGHT } },
  });
  warnings.push(...finished.warnings);
  if (finished.text) {
    writeFileAtomic(join(outDir, "texto.md"), finished.text.text);
    files.text = "texto.md";
  }

  const capture = {
    format_version: CAPTURE_FORMAT_VERSION,
    url,
    final_url: finalUrl,
    site: siteLabel(finalUrl),
    input_kind: inputKind(url),
    captured_at: new Date().toISOString(),
    http_status: httpStatus,
    viewports,
    files,
    scroll,
    layout,
    anatomy: finished.anatomy,
    brand,
    cookie_banner: { desktop: cookieBanner, mobile: mobileCookieBanner },
    wall: wall ?? null,
    placeholder,
    assets: saved.map(({ markup, ...rest }) => ({ ...rest, inline_svg: Boolean(markup) })),
    raw: raw ? { ...raw, text: undefined, text_excerpt: (raw.text ?? "").slice(0, 4000), logos: (raw.logos ?? []).map(({ markup, ...rest }) => ({ ...rest, inline_svg: Boolean(markup) })) } : null,
    page_errors: pageErrors,
    elapsed_s: round((Date.now() - startedAt) / 1000, 1),
    warnings,
  };
  writeJson(join(outDir, "captura.json"), capture);
  onProgress(`Captura gravada em ${outDir}`);
  return capture;
}
