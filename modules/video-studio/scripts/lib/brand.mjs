// The brand kit: what the Motor de vídeo captured from the brand's site (captura.json) turned
// into the one file this app keeps per brand, estudio-de-video/marcas/<marca>/marca.json. Also
// where the brand is looked for in the member's own project, and the palette and fonts a video
// takes from the kit. Only what was really captured is used: a missing colour or logo is said
// in `warnings` and replaced by a neutral one, never by a "similar" guess.

import { copyFileSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { basename, extname, isAbsolute, join, resolve } from "node:path";

import { BRANDS_DIR, STUDIO_DIR } from "./project.mjs";
import { ensureDir, isDir, isFile, readJson, round, slugify, toPosix, writeJson } from "./util.mjs";

export const KIT_VERSION = 1;
export const KIT_FILE = "marca.json";
export const KIT_MAX_AGE_DAYS = 90;

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const words = (value) => clean(value).split(" ").filter(Boolean);
const fold = (value) => String(value ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const HEX = /^#[0-9a-f]{6}$/i;
const hexOf = (value) => (typeof value === "string" && HEX.test(value.trim()) ? value.trim().toUpperCase() : null);

// ---------------------------------------------------------------------------
// Addresses and names
// ---------------------------------------------------------------------------

/** "lojax.com.br/planos" or "https://www.Loja-X.com.br/" → a full address; null when it is not one. */
export function siteUrl(input) {
  const text = String(input ?? "").trim();
  if (!text) return null;
  if (/^file:/i.test(text)) return text;
  const bare = text.replace(/^\/+/, "");
  const scheme = /^(localhost|127\.0\.0\.1)(:\d+)?([/?#]|$)/i.test(bare) ? "http" : "https";
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `${scheme}://${bare}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  if (!/^[\w-]+(\.[\w-]+)*\.[a-z]{2,}$/i.test(url.hostname) && !/^(localhost|\d{1,3}(\.\d{1,3}){3})$/i.test(url.hostname)) return null;
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}${url.search}`;
}

/** The host a brand is known by: lowercase, without "www.". Null for a local file or a bad address. */
export function hostOf(input) {
  const address = siteUrl(input);
  if (!address || /^file:/i.test(address)) return null;
  try {
    return new URL(address).hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** The folder name of a capture under capturas/: the host with dashes, or the name of a local file. */
export function hostSlug(input) {
  const text = String(input ?? "").trim();
  const host = hostOf(text);
  if (host) return slugify(host.replace(/\./g, "-"), 60);
  const local = /^file:/i.test(text) ? decodeURIComponent(text.replace(/^file:\/+/i, "").split(/[?#]/)[0]) : text;
  return slugify(basename(local, extname(local)) || "pagina-local", 40);
}

const SECOND_LEVEL = /^(com|net|org|gov|edu|co|art|blog|eco|ind|adv|eng|med|odo|psc|tur|inf|imb|far|vet|esp)$/;

/** The folder name of a brand: the host without its ending ("lojax.com.br" → "lojax"), else the name. */
export function brandSlug({ name = null, host = null } = {}) {
  const domain = hostOf(host);
  if (domain) {
    const parts = domain.split(".").filter(Boolean);
    if (parts.length >= 2) {
      parts.pop();
      if (parts.length >= 2 && SECOND_LEVEL.test(parts[parts.length - 1])) parts.pop();
      const slug = slugify(parts.join("-"), 40);
      if (slug && slug !== "video") return slug;
    }
  }
  const fromName = clean(name);
  return fromName ? slugify(fromName, 40) : null;
}

/** "sorrisopleno" → "Sorrisopleno": the last resort for a brand name, read from its address. */
function nameFromHost(host) {
  const slug = brandSlug({ host });
  if (!slug) return null;
  return slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

/**
 * Whether the name the member said and the name the site gives itself are the same brand:
 * "Loja X" and "Lojax", "Insider" and "Insider Store", "Sorriso Pleno" and "Sorriso Pleno
 * Odontologia" are; "Padaria Estrela" and "Padaria Doze" are not (a shared generic word is not enough).
 */
export function sameBrandName(said, found) {
  const a = slugify(said ?? "", 60);
  const b = slugify(found ?? "", 60);
  if (!clean(said) || !clean(found) || a === "video" || b === "video") return true;
  const tightA = a.replace(/-/g, "");
  const tightB = b.replace(/-/g, "");
  if (tightA.includes(tightB) || tightB.includes(tightA)) return true;
  const [shorter, longer] = a.split("-").length <= b.split("-").length ? [a, tightB] : [b, tightA];
  const words = shorter.split("-").filter((word) => word.length >= 3);
  return words.length > 0 && words.every((word) => longer.includes(word));
}

/** "https://www.instagram.com/lojax/" → "@lojax". */
export function handleFrom(social = {}) {
  const pick = (address, pattern) => {
    try {
      const url = new URL(String(address ?? ""));
      const match = pattern.exec(url.pathname);
      return match ? `@${match[1]}` : null;
    } catch {
      return null;
    }
  };
  return (
    pick(social.instagram, /^\/(?!p\/|reel\/|reels\/|tv\/|stories\/|explore\/|accounts\/)([A-Za-z0-9._]{2,30})\/?$/) ??
    pick(social.tiktok, /^\/@([A-Za-z0-9._]{2,30})\/?$/) ??
    null
  );
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

const MULTIPLIERS = [
  [/^(mil)\b/i, 1e3],
  [/^(k)\b/i, 1e3],
  [/^(milh(?:ão|ao|ões|oes)|mi)\b/i, 1e6],
  [/^(bilh(?:ão|ao|ões|oes)|bi)\b/i, 1e9],
];

/** "2.000" → 2000 (pt-BR thousands), "1,5" → 1.5, "1.299,90" → 1299.9, "4.9" → 4.9. */
function digitsValue(digits) {
  let s = String(digits ?? "").trim().replace(/[.,]$/, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * The number inside a published phrase: "+2.000 clientes" → { value: 2000, prefix: "+", suffix: "",
 * label: "clientes" }; "12 mil" → 12000; "97% de aprovação" → { value: 97, suffix: "%" }.
 * `prefix` and `suffix` are what stays glued to the figure on screen; `label` is what it counts.
 * Null when the text has no number.
 */
export function parseNumberText(text) {
  const phrase = clean(text);
  const match = /([+±]\s?)?(\d[\d.,]*)/.exec(phrase);
  if (!match) return null;
  const base = digitsValue(match[2]);
  if (base === null) return null;
  let rest = phrase.slice(match.index + match[0].length);
  let value = base;
  let suffix = "";
  const glued = rest.replace(/^\s+/, "");
  if (glued.startsWith("%")) {
    suffix = "%";
    rest = glued.slice(1);
  } else {
    const multiplier = MULTIPLIERS.find(([pattern]) => pattern.test(glued));
    if (multiplier) {
      value = base * multiplier[1];
      rest = glued.replace(multiplier[0], "");
    }
    if (/^\s*\+/.test(rest)) {
      suffix = "+";
      rest = rest.replace(/^\s*\+/, "");
    }
  }
  return {
    value: round(value, 4),
    prefix: match[1] ? match[1].trim() : "",
    suffix,
    label: clean(rest.replace(/^[\s:–—-]+/, "")),
    before: clean(phrase.slice(0, match.index)),
    raw: clean(match[0] + (suffix === "%" ? "%" : "")),
  };
}

/** A few words around a number that sits inside a sentence, without crossing punctuation. */
function around(sentence, raw, { before = 2, after = 4 } = {}) {
  const index = sentence.indexOf(raw);
  if (index < 0) return raw;
  const left = sentence.slice(0, index).split(/[.,;:!?()–—]/).pop() ?? "";
  const right = sentence.slice(index + raw.length).split(/[.,;:!?()–—]/)[0] ?? "";
  return clean([...words(left).slice(-before), raw, ...words(right).slice(0, after)].join(" "));
}

/** The phrase a published number is shown with: its own line plus the caption under it, or the words around it. */
function numberPhrase(number, lines) {
  const raw = clean(number?.text);
  if (!raw) return null;
  const context = clean(number?.context);
  if (context && context !== raw) return around(context, raw);
  const index = lines.indexOf(raw);
  const next = index >= 0 ? lines[index + 1] : null;
  if (next && next.length <= 60 && words(next).length <= 8 && !/^[+±]?\s?\d/.test(next) && !/R\$/.test(next)) return `${raw} ${next}`;
  return raw;
}

/** "página inicial" for the address that was captured, or the path of an inner page. */
function pageLabel(address) {
  try {
    const url = new URL(String(address ?? ""));
    if (url.protocol === "file:") return "página inicial";
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, "");
    return path && path !== "/index.html" ? `página ${path}` : "página inicial";
  } catch {
    return "página inicial";
  }
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

const rgbOf = (hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
const toHex = (channels) => `#${channels.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

/** Relative luminance (0 black, 1 white). */
export function luminance(hex) {
  const [r, g, b] = rgbOf(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two colours (1 to 21). */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `a` moved `t` of the way to `b`: a tint made only of the two colours given. */
export function mixColors(a, b, t) {
  const [x, y] = [rgbOf(a), rgbOf(b)];
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

const ROLE_ORDER = ["botões", "fundo", "texto", "outro"];

function mapColors(brand) {
  const colors = brand?.colors ?? {};
  const buttons = new Set((brand?.cta ?? []).map((item) => hexOf(item?.background)).filter(Boolean));
  const seen = new Map();
  for (const entry of Array.isArray(colors.palette) ? colors.palette : []) {
    const hex = hexOf(entry?.hex);
    if (!hex) continue;
    const role = buttons.has(hex) ? "botões" : entry.source === "background" ? "fundo" : entry.source === "text" ? "texto" : "outro";
    const share = Number.isFinite(entry.share) ? round(entry.share, 3) : null;
    const current = seen.get(hex);
    if (!current) seen.set(hex, { hex, role, share });
    else {
      if (ROLE_ORDER.indexOf(role) < ROLE_ORDER.indexOf(current.role)) current.role = role;
      if ((share ?? 0) > (current.share ?? 0)) current.share = share;
    }
  }
  const primary = hexOf(colors.primary);
  if (primary && !seen.has(primary)) seen.set(primary, { hex: primary, role: "botões", share: null });
  return { primary, background: hexOf(colors.background), text: hexOf(colors.text), palette: [...seen.values()] };
}

// ---------------------------------------------------------------------------
// The kit
// ---------------------------------------------------------------------------

const LOGO_SOURCES = {
  dom: "página do site",
  header: "cabeçalho do site",
  jsonld: "dados que o site publica sobre a marca",
  og: "imagem de compartilhamento do site",
  icon: "ícone do site",
};

/** Width and height of a PNG from its header; null for other formats. */
function pngSize(file) {
  try {
    const bytes = readFileSync(file).subarray(0, 24);
    if (bytes.length < 24 || bytes[0] !== 0x89 || bytes.toString("latin1", 1, 4) !== "PNG") return null;
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  } catch {
    return null;
  }
}

/** A font stack as the site declares it, safe to drop into a canvas font string. */
function fontStack(value) {
  const stack = String(value ?? "")
    .split(",")
    .map((family) => family.trim().replace(/^["']|["']$/g, "").replace(/[^\p{L}\p{N} ._-]/gu, "").trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((family) => (/\s/.test(family) ? `'${family}'` : family));
  return stack.length ? stack.join(", ") : null;
}

const unique = (list, key = (item) => fold(item)) => {
  const seen = new Set();
  return list.filter((item) => {
    const id = key(item);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

export function kitsDir(root) {
  return join(root, STUDIO_DIR, BRANDS_DIR);
}

export function kitFile(root, slug) {
  return join(kitsDir(root), slug, KIT_FILE);
}

/**
 * The brand kit from the Motor's captura.json. `captureDir` is the folder of the capture (absolute,
 * or relative to `root`); with a `root`, the best logo is copied into
 * estudio-de-video/marcas/<marca>/assets/ and the kit points at the copy. `name`, `site` and
 * `slug` are what the request already said, used when the page does not say it.
 */
export function kitFromCapture(captura, { foundBy = null, confirmed = null, now = new Date().toISOString(), root = null, captureDir = null, slug = null, name = null, site = null } = {}) {
  const brand = captura?.brand ?? {};
  const raw = captura?.raw ?? {};
  const warnings = [];
  const captured = captura?.final_url ?? captura?.url ?? null;
  const local = /^file:/i.test(String(captured ?? ""));
  const address = (local ? siteUrl(raw.document?.canonical) : null) ?? (local ? null : siteUrl(captured)) ?? siteUrl(site) ?? (local ? captured : null);
  const host = hostOf(address);
  const origin = host && address ? new URL(address).origin : address;
  const brandName = clean(brand.name) || clean(name) || nameFromHost(host) || null;
  const kitSlug = slug ?? brandSlug({ name: brandName, host }) ?? "marca";
  // the capture folder as the kit names it: relative to the project root when there is one, else as given
  const dirAbs = captureDir && (root || isAbsolute(captureDir)) ? resolve(root ?? "", captureDir) : null;
  const dirShown = captureDir ? (dirAbs ? (root ? toPosix(root, dirAbs) : dirAbs.replace(/\\/g, "/")) : String(captureDir).replace(/\\/g, "/").replace(/\/+$/, "")) : null;
  const shown = (file) => {
    if (!file) return null;
    const plain = String(file).replace(/\\/g, "/");
    return dirShown ? `${dirShown}/${plain}` : plain;
  };

  // the logo: the Motor's best candidate, copied next to the kit so a new capture never breaks an old video
  let logo = null;
  if (brand.logo?.file) {
    const asset = (captura.assets ?? []).find((item) => item?.file === brand.logo.file) ?? {};
    const kind = brand.logo.source ?? asset.source ?? "dom";
    const inHeader = kind === "dom" && (raw.logos ?? []).some((item) => item?.in_header);
    logo = {
      file: shown(brand.logo.file),
      source: LOGO_SOURCES[inHeader ? "header" : kind] ?? LOGO_SOURCES.dom,
      width: brand.logo.width ?? null,
      height: brand.logo.height ?? null,
      alternatives: (brand.logo.alternatives ?? []).map(shown).filter(Boolean),
    };
    const source = dirAbs ? join(dirAbs, brand.logo.file) : null;
    if (root && source && isFile(source)) {
      const assetsDir = join(kitsDir(root), kitSlug, "assets");
      ensureDir(assetsDir);
      for (const old of readdirSync(assetsDir)) if (/^logo\.[a-z0-9]+$/i.test(old)) rmSync(join(assetsDir, old), { force: true });
      const target = join(assetsDir, `logo${extname(source).toLowerCase() || ".png"}`);
      copyFileSync(source, target);
      logo.file = toPosix(root, target);
      const size = pngSize(target);
      if (size && size.width < 200 && size.height < 200) {
        warnings.push(`O logo capturado é pequeno (${size.width}×${size.height} px) e pode ficar serrilhado no vídeo; se houver o arquivo original, ele vai na pasta de materiais do vídeo.`);
      }
    } else if (root && source) warnings.push("A captura cita um logo, mas o arquivo não está na pasta da captura.");
    if (kind === "icon") warnings.push("Só o ícone do site foi encontrado como logo; o logo em PNG ou SVG pode ir na pasta de materiais do vídeo.");
  } else warnings.push("Nenhum logo foi encontrado no site: o vídeo escreve o nome da marca no lugar. O logo em PNG ou SVG pode ir na pasta de materiais do vídeo.");

  const colors = mapColors(brand);
  if (!colors.primary) warnings.push("O site não tem uma cor de destaque clara: o vídeo usa um cinza neutro no lugar, sem inventar uma cor da marca.");

  const files = captura?.files ?? {};
  const screens = {};
  for (const key of ["mobile", "mobile_full", "desktop", "desktop_full"]) if (files[key]) screens[key] = shown(files[key]);

  const lines = String(raw.text_excerpt ?? "").split(/\n+/).map(clean).filter(Boolean);
  const page = pageLabel(captured);
  const numbers = unique(
    (Array.isArray(brand.numbers) ? brand.numbers : [])
      .map((number) => {
        const text = numberPhrase(number, lines);
        if (!text) return null;
        const value = Number.isFinite(number.value) ? number.value : (parseNumberText(text)?.value ?? null);
        return { text, value, page, context: clean(number.context) || null };
      })
      .filter(Boolean),
    (number) => fold(number.text),
  ).slice(0, 8);

  const headings = unique((Array.isArray(raw.headings?.h2) ? raw.headings.h2 : []).map(clean).filter((heading) => heading && heading.length <= 60));
  const sections = (headings.length ? headings : unique((Array.isArray(brand.nav) ? brand.nav : []).map(clean).filter((item) => item && item.length <= 40))).slice(0, 12);
  // where each heading sits in the full mobile page (0 = top, 1 = end), so a scene can scroll to its section
  const mobileLayout = captura?.layout?.mobile;
  const layout =
    mobileLayout && Array.isArray(mobileLayout.headings) && Number(mobileLayout.full_height) > 0
      ? {
          full_height: Number(mobileLayout.full_height),
          viewport_height: Number(mobileLayout.viewport_height) || 844,
          headings: mobileLayout.headings
            .filter((heading) => clean(heading?.text) && Number.isFinite(Number(heading.y)))
            .map((heading) => ({ text: clean(heading.text), y: Number(heading.y), fraction: Number(heading.fraction) }))
            .slice(0, 60),
        }
      : null;

  const formatPrice = (value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2, maximumFractionDigits: 2 })}`;
  const products = unique(
    [
      ...(Array.isArray(brand.prices) ? brand.prices : []).filter((item) => clean(item?.product)).map((item) => ({ name: clean(item.product), price: clean(item.text) || null, value: Number.isFinite(item.value) ? item.value : null })),
      ...(Array.isArray(brand.products) ? brand.products : []).filter((item) => clean(item?.name)).map((item) => ({ name: clean(item.name), price: Number.isFinite(item.price) && (!item.currency || item.currency === "BRL") ? formatPrice(item.price) : null, value: Number.isFinite(item.price) ? item.price : null })),
    ],
    (product) => fold(product.name),
  ).slice(0, 12);

  const social = { instagram: null, whatsapp: null };
  for (const [network, link] of Object.entries(brand.social ?? {})) if (typeof link === "string" && link) social[network] = link;
  const phone = (brand.contacts?.whatsapp ?? [])[0];
  if (phone) social.whatsapp = `https://wa.me/${phone}`;
  else if (social.whatsapp) social.whatsapp = social.whatsapp.split("?")[0];

  for (const warning of Array.isArray(captura?.warnings) ? captura.warnings.slice(0, 4) : []) {
    if (typeof warning === "string" && !/logo|cor de destaque/i.test(warning)) warnings.push(warning);
  }
  if (brand.has_login_area) warnings.push("O site tem uma área com login: as telas de dentro só entram no vídeo se o integrante puser prints na pasta de materiais.");

  return {
    format_version: KIT_VERSION,
    slug: kitSlug,
    name: brandName,
    site: origin ?? null,
    host,
    handle: handleFrom(brand.social ?? {}),
    captured_at: Number.isFinite(Date.parse(captura?.captured_at ?? "")) ? captura.captured_at : now,
    capture_dir: dirShown,
    found_by: foundBy,
    confirmed: confirmed ?? ["pedido", "projeto", "resposta"].includes(foundBy),
    headline: clean(brand.headline) || null,
    description: clean(brand.description) || null,
    colors,
    fonts: {
      headline: clean(brand.fonts?.headline) || null,
      body: clean(brand.fonts?.body) || null,
      headline_stack: fontStack(raw.fonts?.h1),
      body_stack: fontStack(raw.fonts?.body),
    },
    logo,
    screens,
    sections,
    layout,
    products,
    numbers,
    cta: unique((Array.isArray(brand.cta) ? brand.cta : []).map((item) => clean(item?.text)).filter(Boolean)).slice(0, 6),
    social,
    sector_cues: (Array.isArray(brand.sector_cues) ? brand.sector_cues : []).map((cue) => (typeof cue === "string" ? cue : cue?.sector)).filter(Boolean),
    has_login_area: Boolean(brand.has_login_area),
    decisions: {},
    warnings,
  };
}

/** A kit by its folder name or by the path of its marca.json; null when it is not there. */
export function readKit(root, ref) {
  if (!ref) return null;
  const text = String(ref);
  const file = /[\\/]|\.json$/i.test(text) ? (isAbsolute(text) ? text : resolve(root, text)) : kitFile(root, text);
  const kit = readJson(file, null);
  return kit && typeof kit === "object" && !Array.isArray(kit) ? kit : null;
}

/** Writes the kit into estudio-de-video/marcas/<marca>/marca.json and returns that path. */
export function writeKit(root, kit) {
  const file = kitFile(root, kit.slug);
  writeJson(file, kit);
  return file;
}

/** The brands this project already keeps, by folder name. */
export function listKits(root) {
  const base = kitsDir(root);
  if (!isDir(base)) return [];
  const list = [];
  for (const slug of readdirSync(base).sort()) {
    const kit = readKit(root, slug);
    if (!kit) continue;
    list.push({
      slug,
      name: kit.name ?? null,
      site: kit.site ?? null,
      host: kit.host ?? null,
      handle: kit.handle ?? null,
      captured_at: kit.captured_at ?? null,
      confirmed: Boolean(kit.confirmed),
      file: toPosix(root, kitFile(root, slug)),
    });
  }
  return list;
}

/** The saved kit of a brand: by its site first, then by its folder name, then by its name. */
export function findKit(root, { site = null, slug = null, name = null } = {}) {
  const kits = listKits(root);
  const host = hostOf(site);
  const wanted = clean(name) ? slugify(name, 40) : null;
  const found =
    (host && kits.find((kit) => kit.host === host)) ||
    (slug && kits.find((kit) => kit.slug === slug)) ||
    (wanted && kits.find((kit) => kit.slug === wanted || (kit.name && slugify(kit.name, 40) === wanted))) ||
    null;
  return found ? readKit(root, found.slug) : null;
}

/** How old a kit is, in days; Infinity when it carries no capture date. */
export function kitAgeDays(kit, now = new Date().toISOString()) {
  const at = Date.parse(kit?.captured_at ?? "");
  const reference = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(at) || !Number.isFinite(reference)) return Infinity;
  return round(Math.max(0, reference - at) / 86400000, 1);
}

// ---------------------------------------------------------------------------
// The brand in the member's own project
// ---------------------------------------------------------------------------

/** Hosts a README links to that are tools, badges, code hosting or social networks, never the project's own site. */
const NOT_A_SITE = new RegExp(
  "(^|\\.)(" +
    [
      "github\\.com", "githubusercontent\\.com", "githubassets\\.com", "gitlab\\.com", "bitbucket\\.org", "npmjs\\.(com|org)", "npm\\.im", "yarnpkg\\.com", "pnpm\\.io", "bun\\.sh", "unpkg\\.com", "jsdelivr\\.net",
      "shields\\.io", "badge\\.fury\\.io", "badgen\\.net", "travis-ci\\.(org|com)", "circleci\\.com", "codecov\\.io", "coveralls\\.io", "codeclimate\\.com", "snyk\\.io", "opensource\\.org", "creativecommons\\.org", "choosealicense\\.com",
      "nodejs\\.org", "nextjs\\.org", "vercel\\.com", "vercel\\.app", "netlify\\.com", "react\\.dev", "reactjs\\.org", "reactnative\\.dev", "expo\\.dev", "vitejs\\.dev", "vite\\.dev", "vuejs\\.org", "nuxt\\.com", "svelte\\.dev", "angular\\.(io|dev)", "astro\\.build", "remix\\.run",
      "tailwindcss\\.com", "getbootstrap\\.com", "typescriptlang\\.org", "mozilla\\.org", "eslint\\.org", "prettier\\.io", "jestjs\\.io", "vitest\\.dev", "cypress\\.io", "docker\\.com", "supabase\\.com", "firebase\\.google\\.com", "prisma\\.io",
      "python\\.org", "djangoproject\\.com", "laravel\\.com", "rubyonrails\\.org", "wordpress\\.org", "w3\\.org", "wikipedia\\.org", "stackoverflow\\.com", "medium\\.com", "dev\\.to", "google\\.com", "googleapis\\.com", "gstatic\\.com", "microsoft\\.com", "apple\\.com", "amazon\\.com", "amazonaws\\.com",
      "youtube\\.com", "youtu\\.be", "instagram\\.com", "facebook\\.com", "tiktok\\.com", "twitter\\.com", "x\\.com", "linkedin\\.com", "discord\\.(gg|com)", "slack\\.com", "t\\.me", "wa\\.me", "whatsapp\\.com",
      "flyee\\.club", "example\\.(com|org|net)", "localhost",
    ].join("|") +
    ")$",
  "i",
);

function projectAddress(candidate) {
  const text = String(candidate ?? "").trim().replace(/[.,;:!?)\]}>'"*_`]+$/, "");
  if (!/^https:\/\//i.test(text)) return null;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (!/\./.test(url.hostname) || NOT_A_SITE.test(url.hostname)) return null;
  if (/\.(png|jpe?g|gif|svg|webp|ico|mp4|pdf|zip)$/i.test(url.pathname)) return null;
  return url.origin;
}

/**
 * The site of the member's own project: the first https address in README.md that is not a
 * badge, a code host, a package registry, a tool's site or a social network; else `homepage`
 * of package.json. Null when the project does not say it.
 */
export function findProjectSite(root) {
  let readme = null;
  try {
    const name = readdirSync(root).find((entry) => /^readme(\.md|\.markdown|\.txt)?$/i.test(entry) && isFile(join(root, entry)));
    if (name) readme = readFileSync(join(root, name), "utf8").slice(0, 200000);
  } catch {
    readme = null;
  }
  if (readme) {
    const text = readme.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/<img\b[^>]*>/gi, " ");
    for (const match of text.matchAll(/https:\/\/[^\s<>()[\]"'`]+/gi)) {
      const address = projectAddress(match[0]);
      if (address) return address;
    }
  }
  const homepage = readJson(join(root, "package.json"), null)?.homepage;
  return typeof homepage === "string" ? projectAddress(homepage) : null;
}

// ---------------------------------------------------------------------------
// The look a video takes from the kit
// ---------------------------------------------------------------------------

/** The neutral look of a video without a captured brand: dark, with no hue of its own. */
export const NEUTRAL_PALETTE = { background: "#0F0F10", surface: "#1B1B1E", text: "#F4F1EA", accent: "#C9C5BB", muted: "#9A9AA0" };
const NEUTRAL_DARK_TEXT = "#111111";
const NEUTRAL_LIGHT_TEXT = "#F4F1EA";
export const DEFAULT_FONT = "Inter, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

/**
 * The roteiro's palette (background, surface, text, accent, muted) from the brand's own colours.
 * `style` is kept for the page: in this version every style uses the same brand palette. A colour
 * the capture did not find is replaced by a neutral one (never by a "similar" brand colour) and
 * the replacement is said in `warnings`.
 */
export function paletteFor(kit, style = null) {
  const warnings = [];
  const colors = kit?.colors ?? {};
  let background = hexOf(colors.background);
  let text = hexOf(colors.text);
  let accent = hexOf(colors.primary);
  if (!background && !text && !accent) {
    warnings.push("Sem as cores da marca (o site não foi capturado, ou não trouxe cores), o vídeo usa um visual neutro escuro. As cores entram quando o site for capturado ou quando o integrante disser os códigos.");
    return { palette: { ...NEUTRAL_PALETTE }, warnings, neutral: true, style };
  }
  if (!background) {
    background = text && luminance(text) > 0.5 ? NEUTRAL_PALETTE.background : "#FFFFFF";
    warnings.push(`A captura não trouxe a cor de fundo da marca: usei ${background}, neutra.`);
  }
  if (!text) {
    text = luminance(background) > 0.5 ? NEUTRAL_DARK_TEXT : NEUTRAL_LIGHT_TEXT;
    warnings.push(`A captura não trouxe a cor do texto da marca: usei ${text}, neutra.`);
  } else if (contrast(text, background) < 4.5) {
    const readable = contrast(NEUTRAL_DARK_TEXT, background) >= contrast(NEUTRAL_LIGHT_TEXT, background) ? NEUTRAL_DARK_TEXT : NEUTRAL_LIGHT_TEXT;
    warnings.push(`A cor de texto capturada (${text}) não se lê sobre o fundo ${background}: usei ${readable}, neutra.`);
    text = readable;
  }
  if (!accent) {
    accent = luminance(background) > 0.5 ? "#3A3A3F" : NEUTRAL_PALETTE.accent;
    warnings.push(`O site não tem uma cor de destaque: usei um cinza neutro (${accent}), sem inventar uma cor da marca. Se a marca tem uma cor, peça o código ao integrante e troque palette.accent no roteiro.`);
  } else if (contrast(accent, background) < 1.5) {
    warnings.push(`A cor de destaque da marca (${accent}) é quase igual ao fundo (${background}): os destaques podem sumir. Confira na folha de quadros.`);
  }
  const tints = (Array.isArray(colors.palette) ? colors.palette : [])
    .filter((entry) => entry?.role === "fundo" && hexOf(entry.hex) && hexOf(entry.hex) !== background)
    .map((entry) => ({ hex: hexOf(entry.hex), share: entry.share ?? 0 }))
    .filter((entry) => contrast(entry.hex, background) <= 1.35 && contrast(entry.hex, text) >= 4.5)
    .sort((a, b) => b.share - a.share);
  const surface = tints[0]?.hex ?? mixColors(background, text, 0.06);
  const muted = [0.4, 0.3, 0.2].map((t) => mixColors(text, background, t)).find((hex) => contrast(hex, background) >= 3) ?? text;
  return { palette: { background, surface, text, accent, muted }, warnings, neutral: false, style };
}

/** The roteiro's fonts: the brand's own families first, then fonts every machine has. */
export function fontsFor(kit) {
  const stack = (family, declared) => {
    const first = clean(family);
    if (declared) return /sans-serif|serif|monospace/.test(declared) ? declared : `${declared}, 'Segoe UI', Arial, sans-serif`;
    if (!first) return DEFAULT_FONT;
    const safe = first.replace(/[^\p{L}\p{N} ._-]/gu, "").trim();
    if (!safe) return DEFAULT_FONT;
    return `${/\s/.test(safe) ? `'${safe}'` : safe}, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;
  };
  const fonts = kit?.fonts ?? {};
  return {
    headline: stack(fonts.headline, fonts.headline_stack),
    body: stack(fonts.body ?? fonts.headline, fonts.body_stack ?? (fonts.body ? null : fonts.headline_stack)),
  };
}

/** What the result of a command shows of a kit: enough for the AI to tell the member what was found. */
export function kitSummary(kit) {
  if (!kit) return null;
  return {
    slug: kit.slug ?? null,
    name: kit.name ?? null,
    site: kit.site ?? null,
    host: kit.host ?? null,
    handle: kit.handle ?? null,
    found_by: kit.found_by ?? null,
    confirmed: Boolean(kit.confirmed),
    captured_at: kit.captured_at ?? null,
    headline: kit.headline ?? null,
    colors: { primary: kit.colors?.primary ?? null, background: kit.colors?.background ?? null, text: kit.colors?.text ?? null },
    fonts: { headline: kit.fonts?.headline ?? null, body: kit.fonts?.body ?? null },
    logo: kit.logo ? { file: kit.logo.file, source: kit.logo.source } : null,
    screens: kit.screens ?? {},
    sections: kit.sections ?? [],
    products: kit.products ?? [],
    numbers: (kit.numbers ?? []).map((number) => ({ text: number.text, value: number.value, page: number.page })),
    cta: kit.cta ?? [],
    social: kit.social ?? {},
    sector_cues: kit.sector_cues ?? [],
    has_login_area: Boolean(kit.has_login_area),
  };
}
