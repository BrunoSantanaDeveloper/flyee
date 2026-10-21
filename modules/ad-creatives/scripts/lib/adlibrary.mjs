// The Ad Library through Apify (D6), only with the member's key: the actor's input for the
// campaign's competitors and search words (the same filtered addresses the manual research uses)
// and the actor's items as evidence. The manual research stays the base mode.

import { daysBetween, RULES } from "./evidence.mjs";
import { slugify } from "./util.mjs";

const fold = (text) => String(text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const pad = (value) => String(value).padStart(2, "0");

/** The actor's date (Unix seconds, milliseconds or text) as an ISO day; null when unreadable. */
export function isoDayOf(value) {
  if (value === null || value === undefined || value === "") return null;
  let date;
  if (typeof value === "number") date = new Date(value < 1e11 ? value * 1000 : value);
  else if (/^\d+$/.test(String(value))) date = new Date(Number(value) * 1000);
  else date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** One address per competitor and per search word, with the per-source limit of each (D12 for competitors). */
export function collectionSources(links, { perSearch = 30 } = {}) {
  return [
    ...links.competitors.map((link) => ({ kind: "competitor", who: link.who, url: link.url, limit: RULES.cards_per_competitor })),
    ...links.searches.map((search) => ({ kind: "search", who: search.query, url: search.url, limit: perSearch })),
  ];
}

/** The actor's input. `count` and the run's own item limit are the hard caps; limitPerSource is not one. */
export function actorInput(sources, { country = "BR" } = {}) {
  const total = sources.reduce((sum, source) => sum + source.limit, 0);
  return {
    total,
    input: {
      urls: sources.map((source) => ({ url: source.url })),
      count: total,
      limitPerSource: Math.max(...sources.map((source) => source.limit)),
      scrapeAdDetails: false,
      "scrapePageAds.activeStatus": "active",
      "scrapePageAds.countryCode": country,
    },
  };
}

/** One ad of the actor as an evidence item, with its origin, its date and the address of its video. */
export function adToItem(ad, { collectedAt, actor, position }) {
  const snapshot = ad.snapshot ?? {};
  const cards = Array.isArray(snapshot.cards) ? snapshot.cards : [];
  const page = String(ad.page_name ?? snapshot.page_name ?? "").trim();
  const libraryId = String(ad.ad_archive_id ?? ad.adArchiveID ?? "").trim();
  if (!page || !/^\d{6,20}$/.test(libraryId)) return null;
  const videos = [...(snapshot.videos ?? []), ...cards].map((media) => media?.video_hd_url || media?.video_sd_url).filter(Boolean);
  const images = [...(snapshot.images ?? []), ...cards].map((media) => media?.original_image_url || media?.resized_image_url).filter(Boolean);
  const started = isoDayOf(ad.start_date ?? ad.startDate);
  const ended = isoDayOf(ad.end_date ?? ad.endDate);
  const active = ad.is_active !== false && ad.isActive !== false;
  const text = String(snapshot.body?.text ?? cards[0]?.body ?? "").replace(/\s+/g, " ").trim();
  return {
    id: `ad-${slugify(page, 30)}-${libraryId}`,
    kind: "competitor_ad",
    source: { type: "apify", ref: ad.ad_library_url ?? `https://www.facebook.com/ads/library/?id=${libraryId}`, collected_at: collectedAt, actor },
    who: page,
    data: {
      library_id: libraryId,
      position,
      started_at: started,
      ended_at: active ? null : ended,
      active,
      days_active: started ? daysBetween(started, active ? collectedAt : ended ?? collectedAt) : null,
      variations: Number.isInteger(ad.collation_count) && ad.collation_count > 0 ? ad.collation_count : 1,
      text: text || null,
      headline: snapshot.title ?? cards[0]?.title ?? null,
      cta: snapshot.cta_text ?? null,
      media: videos.length ? "video" : cards.length > 1 ? "carousel" : images.length ? "image" : null,
      platforms: Array.isArray(ad.publisher_platform) ? ad.publisher_platform : [],
      url: snapshot.link_url ?? null,
      media_urls: videos.slice(0, 2),
    },
    tags: {},
    group: null,
    excluded: false,
  };
}

/**
 * The actor's items as evidence: duplicates out, then at most the first 10 ads of each page in the
 * order the Ad Library returned them (D12), every one recorded, none chosen.
 */
export function adsToItems(ads, { collectedAt, actor }) {
  const seen = new Set();
  const perPage = new Map();
  const items = [];
  for (const ad of Array.isArray(ads) ? ads : []) {
    if (!ad || ad.error) continue;
    const page = fold(ad.page_name ?? ad.snapshot?.page_name);
    const count = perPage.get(page) ?? 0;
    if (count >= RULES.cards_per_competitor) continue;
    const item = adToItem(ad, { collectedAt, actor, position: count + 1 });
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    perPage.set(page, count + 1);
    items.push(item);
  }
  return items;
}

/** Whether a JSON file is a list of the actor's ads. */
export function looksLikeAdList(data) {
  return Array.isArray(data) && data.length > 0 && data.slice(0, 5).some((ad) => ad && (ad.ad_archive_id || ad.adArchiveID) && (ad.page_name || ad.snapshot));
}
