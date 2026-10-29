// Instagram addresses, counts as the app shows them, and one post in the shape the score reads.

import { AppError } from "./util.mjs";

const USERNAME = /^[a-z0-9._]{1,30}$/i;
const POST_PATH = /(?:^|\/)(?:p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})/;
const RESERVED = new Set(["p", "reel", "reels", "tv", "stories", "explore", "accounts", "direct"]);

/** "@perfil", "perfil" or a profile address → "perfil" (lowercase). A post address is refused. */
export function parseProfile(input) {
  const raw = String(input ?? "").trim();
  if (!raw) throw new AppError("usage", "Informe um perfil: @perfil ou o endereço dele.");
  if (POST_PATH.test(raw)) throw new AppError("usage", `"${raw}" é o endereço de um post, não de um perfil.`, "Passe o @ do perfil ou o endereço instagram.com/perfil.");
  let name = raw.replace(/^@/, "");
  const url = /instagram\.com\/([^/?#]+)/i.exec(raw);
  if (url) name = url[1];
  name = name.replace(/\/+$/, "").toLowerCase();
  if (!USERNAME.test(name) || RESERVED.has(name)) throw new AppError("usage", `"${raw}" não parece um perfil do Instagram.`, "Use o @ do perfil, com letras, números, ponto e sublinhado.");
  return name;
}

/** A post or reel address (or its short code) → { shortcode, url }. */
export function parsePost(input) {
  const raw = String(input ?? "").trim();
  const match = POST_PATH.exec(raw);
  const shortcode = match ? match[1] : /^[A-Za-z0-9_-]{5,}$/.test(raw) ? raw : null;
  if (!shortcode) throw new AppError("usage", `"${raw}" não parece o endereço de um post ou Reels.`, "Passe o endereço instagram.com/p/... ou instagram.com/reel/...");
  return { shortcode, url: `https://www.instagram.com/p/${shortcode}/` };
}

const UNITS = { mil: 1e3, k: 1e3, mi: 1e6, "milhão": 1e6, "milhões": 1e6, m: 1e6, bi: 1e9, b: 1e9 };

/**
 * A count as the Instagram app writes it, in Portuguese or English: "987", "12.345", "12,3 mil",
 * "1,2 mi", "12.3K", "1M". Words around it ("visualizações", "views", "curtidas") are dropped.
 * Returns a whole number, or null when the text is not a count: the reading is then refused,
 * never guessed.
 */
export function parseCount(text) {
  if (typeof text === "number") return Number.isFinite(text) && text >= 0 ? Math.round(text) : null;
  const cleaned = String(text ?? "")
    .toLowerCase()
    .replace(/visualiza[çc][õo]es|reprodu[çc][õo]es|views|plays|curtidas|likes|coment[áa]rios|comments/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const match = /^(\d[\d.,\s]*?)\s*(mil|milh[ãa]o|milh[õo]es|mi|bi|k|m|b)?\.?$/.exec(cleaned);
  if (!match) return null;
  const digits = match[1].replace(/\s/g, "");
  const unit = match[2] ? UNITS[match[2].replace("milhao", "milhão").replace("milhoes", "milhões")] ?? UNITS[match[2]] : null;
  if (unit) {
    // With a unit the separator is a decimal one: "12,3 mil", "12.3K".
    if (!/^\d+(?:[.,]\d+)?$/.test(digits)) return null;
    return Math.round(Number(digits.replace(",", ".")) * unit);
  }
  // Without a unit a count is whole: "12.345" or "12,345" are thousands; "12,3" is not a count.
  if (/^\d+$/.test(digits)) return Number(digits);
  if (/^\d{1,3}(?:([.,])\d{3})(?:\1\d{3})*$/.test(digits)) return Number(digits.replace(/[.,]/g, ""));
  return null;
}

const dayMs = 24 * 60 * 60 * 1000;

/** Whole days between a post's date and the collection day, or null without a date. */
export function ageDays(postedAt, collectedAt) {
  const posted = Date.parse(postedAt ?? "");
  const collected = Date.parse(collectedAt ?? "");
  if (!Number.isFinite(posted) || !Number.isFinite(collected)) return null;
  return Math.max(0, Math.floor((collected - posted) / dayMs));
}

/**
 * A caption as its author wrote it: every line, the hashtags and the call to action at the end.
 * Only the line ends are made the same and the edges trimmed; null when there is no caption text.
 */
export function fullCaption(text) {
  return typeof text === "string" ? text.replace(/\r\n?/g, "\n").trim() : null;
}

/**
 * When a signed Instagram media link stops working, as an ISO time: its `oe` parameter is a Unix
 * time in hexadecimal, and the link's signature covers it, so it cannot be pushed forward. Null
 * when the link carries no readable expiry; the time is then unknown, never guessed.
 */
export function linkExpiry(link) {
  if (typeof link !== "string" || !link) return null;
  let oe;
  try {
    oe = new URL(link).searchParams.get("oe");
  } catch {
    return null;
  }
  if (!oe || !/^[0-9a-f]{6,10}$/i.test(oe)) return null;
  const seconds = Number.parseInt(oe, 16);
  // A plausible moment, from 2020 to 2100; anything else is not an expiry.
  if (!(seconds > 1577836800 && seconds < 4102444800)) return null;
  return new Date(seconds * 1000).toISOString();
}

/** The short code of a raw item of the collector, from its own field or its address. */
export function itemShortcode(item) {
  return item?.shortCode ?? (POST_PATH.exec(item?.url ?? "") ?? [])[1] ?? null;
}

/** The failure an actor reported instead of posts ({ error: "not_found" }), or null. */
export function actorFailure(items) {
  const failed = items.find((item) => item && typeof item.error === "string");
  if (!failed || items.some((item) => item && !item.error)) return null;
  return { code: failed.error, description: failed.errorDescription ?? null, username: failed.username ?? null };
}

/**
 * One post collected by apify/instagram-post-scraper, in the app's shape. Reels are measured by
 * plays (videoPlayCount: Instagram plus Facebook when crossposted); static posts and carousels by
 * interactions. likesCount of -1 means the author hid the likes: the count is unknown, not zero.
 * The caption stays whole; the Reels' video link stays in raw.json, and the post carries only the
 * time that link stops working.
 */
export function normalizePost(raw, { collectedAt }) {
  const isVideo = raw.type === "Video";
  const hidden = typeof raw.likesCount === "number" && raw.likesCount < 0;
  const likes = typeof raw.likesCount === "number" && raw.likesCount >= 0 ? raw.likesCount : null;
  const comments = typeof raw.commentsCount === "number" && raw.commentsCount >= 0 ? raw.commentsCount : null;
  const plays = isVideo ? (typeof raw.videoPlayCount === "number" ? raw.videoPlayCount : typeof raw.videoViewCount === "number" ? raw.videoViewCount : null) : null;
  const shortcode = itemShortcode(raw);
  return {
    id: shortcode,
    url: shortcode ? `https://www.instagram.com/p/${shortcode}/` : raw.url ?? null,
    profile: String(raw.ownerUsername ?? "").toLowerCase() || null,
    kind: isVideo ? "reel" : "static",
    type: raw.type ?? null,
    plays,
    likes,
    comments,
    hidden_likes: hidden,
    duration_s: typeof raw.videoDuration === "number" ? Math.round(raw.videoDuration * 10) / 10 : null,
    posted_at: raw.timestamp ?? null,
    age_days: ageDays(raw.timestamp, collectedAt),
    caption: fullCaption(raw.caption),
    ad: Boolean(raw.paidPartnership || raw.isSponsored),
    video_expires_at: isVideo ? linkExpiry(raw.videoUrl) : null,
  };
}

/** One comment from apify/instagram-comment-scraper, without the name of whoever wrote it. */
export function normalizeComment(raw) {
  return {
    text: typeof raw.text === "string" ? raw.text.replace(/\s+/g, " ").trim() : "",
    likes: typeof raw.likesCount === "number" ? raw.likesCount : null,
    replies: typeof raw.repliesCount === "number" ? raw.repliesCount : null,
    posted_at: raw.timestamp ?? null,
  };
}
