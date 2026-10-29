// Data the member brings, by hand: what the AI read on screenshots of a profile, or a file of posts
// the member already has. The AI writes the text exactly as it appears ("12,3 mil") and this file
// converts it; a text it cannot read is refused with the path of the field, never guessed.

import { ageDays, fullCaption, normalizePost, parseCount, parseProfile } from "./instagram.mjs";
import { AppError } from "./util.mjs";

export const READING_VERSION = 1;
export const READING_KINDS = ["reels_grid", "posts"];
export const SOURCE_TYPES = ["screenshot", "link", "export", "declared"];

const DATE = /^\d{4}-\d{2}-\d{2}/;
/** A caption copied before tapping "mais" ends in an ellipsis and that word: its end is missing. */
const CUT_CAPTION = /(?:…|\.{2,3})\s*(?:mais|more)\s*$/iu;

/** "0:15", "1:02" or "15" (seconds) → seconds; null when absent; NaN when unreadable. */
function durationOf(text) {
  if (text === undefined || text === null || text === "") return null;
  const match = /^(?:(\d+):)?(\d{1,2})$/.exec(String(text).trim());
  return match ? Number(match[1] ?? 0) * 60 + Number(match[2]) : Number.NaN;
}

/**
 * Checks one reading and turns it into posts. Throws `reading_invalid` listing every problem with
 * the path of the field (`items[3].plays_text`), so the AI fixes the file instead of the numbers.
 */
export function readingToPosts(reading) {
  const problems = [];
  const need = (condition, path, message) => {
    if (!condition) problems.push({ path, message });
  };
  if (!reading || typeof reading !== "object") throw new AppError("reading_invalid", "A leitura não é um objeto JSON.", "Use o formato de leitura de references/interface.md.");
  need(reading.version === READING_VERSION, "version", `precisa ser ${READING_VERSION}`);
  need(READING_KINDS.includes(reading.kind), "kind", `precisa ser ${READING_KINDS.join(" ou ")}`);
  let profile = null;
  try {
    profile = parseProfile(reading.profile);
  } catch {
    problems.push({ path: "profile", message: "precisa ser o @ do perfil lido" });
  }
  need(typeof reading.collected_at === "string" && DATE.test(reading.collected_at), "collected_at", "precisa ser a data da leitura, AAAA-MM-DD");
  const source = reading.source ?? {};
  need(SOURCE_TYPES.includes(source.type), "source.type", `precisa ser ${SOURCE_TYPES.join(", ")}`);
  need(source.type === "declared" || (typeof source.ref === "string" && source.ref.trim()), "source.ref", "precisa dizer de onde veio: o arquivo da captura, o endereço ou o arquivo exportado");
  need(Array.isArray(reading.items) && reading.items.length > 0, "items", "precisa ter ao menos um post");

  const posts = [];
  let pinned = 0;
  (Array.isArray(reading.items) ? reading.items : []).forEach((item, index) => {
    const at = `items[${index}]`;
    if (!item || typeof item !== "object") return problems.push({ path: at, message: "precisa ser um objeto" });
    if (item.pinned === true) {
      pinned += 1;
      return undefined;
    }
    const kind = reading.kind === "reels_grid" ? "reel" : item.type;
    if (reading.kind === "posts") need(kind === "reel" || kind === "static", `${at}.type`, "precisa ser reel ou static");
    const plays = kind === "reel" ? parseCount(item.plays_text) : null;
    if (kind === "reel") need(plays !== null, `${at}.plays_text`, `não consegui ler "${item.plays_text ?? ""}" como número`);
    const likes = item.likes_text === undefined ? null : parseCount(item.likes_text);
    if (item.likes_text !== undefined && item.likes_text !== "oculto") need(likes !== null, `${at}.likes_text`, `não consegui ler "${item.likes_text}" como número`);
    const comments = item.comments_text === undefined ? null : parseCount(item.comments_text);
    if (item.comments_text !== undefined) need(comments !== null, `${at}.comments_text`, `não consegui ler "${item.comments_text}" como número`);
    if (kind === "static") need(item.likes_text !== undefined, `${at}.likes_text`, "um post estático é medido pelas curtidas: traga o número, ou \"oculto\"");
    const duration = durationOf(item.duration_text);
    need(!Number.isNaN(duration), `${at}.duration_text`, `não consegui ler "${item.duration_text}" como duração (0:15)`);
    if (item.posted_at !== undefined) need(typeof item.posted_at === "string" && DATE.test(item.posted_at), `${at}.posted_at`, "precisa ser AAAA-MM-DD");
    if (typeof item.caption === "string") need(!CUT_CAPTION.test(item.caption.trim()), `${at}.caption`, "a legenda parece cortada no \"mais\": abra a legenda inteira e copie tudo, com as quebras de linha, ou tire o campo");
    const shortcode = /(?:p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})/.exec(item.url ?? "")?.[1] ?? null;
    posts.push({
      id: shortcode ?? `${profile ?? "perfil"}-${index + 1}`,
      url: shortcode ? `https://www.instagram.com/p/${shortcode}/` : null,
      profile,
      kind,
      type: kind === "reel" ? "Video" : null,
      plays,
      likes: item.likes_text === "oculto" ? null : likes,
      comments,
      hidden_likes: item.likes_text === "oculto",
      duration_s: Number.isNaN(duration) ? null : duration,
      posted_at: item.posted_at ?? null,
      age_days: ageDays(item.posted_at, reading.collected_at),
      caption: fullCaption(item.caption),
      ad: item.ad === true,
      video_expires_at: null,
    });
  });
  if (problems.length) {
    const list = problems.slice(0, 12).map((problem) => `${problem.path}: ${problem.message}`).join("; ");
    const error = new AppError("reading_invalid", `A leitura tem ${problems.length} problema(s): ${list}.`, "Corrija esses campos no arquivo de leitura e rode import de novo. Escreva o número como aparece na tela; o app converte.");
    error.problems = problems;
    throw error;
  }
  return { profile, posts, pinned, source: { type: source.type, ref: source.ref ?? null, collected_at: reading.collected_at } };
}

/** A raw dataset of apify/instagram-post-scraper the member already has, imported as is. */
export function apifyFileToPosts(items, { collectedAt, ref }) {
  const posts = items.filter((item) => item && !item.error).map((item) => normalizePost(item, { collectedAt }));
  const profiles = [...new Set(posts.map((post) => post.profile).filter(Boolean))];
  return { profiles, posts, source: { type: "export", ref, collected_at: collectedAt } };
}
