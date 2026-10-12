// Outlier math, in one place so every number is auditable.
// A video is an outlier when it performs far above its OWN channel's normal,
// not when it has many views. See references/metodologia.md.

/** The multiplier enters the index capped, so one tiny channel does not dominate. */
export const MULTIPLIER_CAP = 25;
/** Subscriber proxy floor: avoids absurd multipliers on tiny channels. */
export const SUBSCRIBER_FLOOR = 500;
export const SMALL_CHANNEL = 5000;
/** A channel needs this many videos in the sample for a sample median. */
export const MIN_SAMPLE = 3;
/** A measured median needs this many uploads. */
export const MIN_CHANNEL_SAMPLE = 5;

const BANDS = {
  channel: [[10, "explosive"], [3, "outlier"], [1.5, "above"], [0.5, "normal"]],
  subscribers: [[10, "explosive"], [5, "outlier"], [1, "above"], [0.1, "normal"]],
};
BANDS.sample = BANDS.channel;

export const CONFIDENCE = { channel: 1, sample: 0.9, subscribers: 0.6 };

const finite = (value) => typeof value === "number" && Number.isFinite(value);

export function median(values) {
  const sorted = values.filter(finite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** explosive, outlier, above, normal or weak; null without a multiplier. */
export function band(multiplier, kind) {
  if (!finite(multiplier) || !BANDS[kind]) return null;
  for (const [floor, name] of BANDS[kind]) if (multiplier >= floor) return name;
  return "weak";
}

/** Recent traction counts more: 1.25 up to 30 days, 1.10 to 90, 1.00 to 365, 0.85 after. */
export function freshnessWeight(days) {
  if (!finite(days)) return 1;
  if (days <= 30) return 1.25;
  if (days <= 90) return 1.1;
  if (days <= 365) return 1;
  return 0.85;
}

/** From 1.00 to 1.50, saturating at 10% (likes + comments) / views; 1 when unknown. */
export function engagementWeight(rate) {
  if (!finite(rate)) return 1;
  return 1 + 0.5 * Math.min(Math.max(rate, 0) / 0.1, 1);
}

/** Median views of each channel's videos in the sample, for channels with 3 or more. */
export function sampleMedians(videos) {
  const byChannel = new Map();
  for (const video of videos) {
    if (!video.channel_id || !finite(video.views)) continue;
    if (!byChannel.has(video.channel_id)) byChannel.set(video.channel_id, []);
    byChannel.get(video.channel_id).push(video.views);
  }
  const medians = new Map();
  for (const [id, views] of byChannel) {
    const value = median(views);
    if (views.length >= MIN_SAMPLE && value > 0) medians.set(id, value);
  }
  return medians;
}

/**
 * The base a video is measured against, in order of trust: the channel's
 * measured median, the median of its videos in this sample, its subscribers.
 */
export function chooseBase({ channelMedian = null, sampleMedian = null, subscribers = null } = {}) {
  if (finite(channelMedian) && channelMedian > 0) return { kind: "channel", value: channelMedian };
  if (finite(sampleMedian) && sampleMedian > 0) return { kind: "sample", value: sampleMedian };
  if (finite(subscribers) && subscribers > 0) return { kind: "subscribers", value: Math.max(subscribers, SUBSCRIBER_FLOOR) };
  return null;
}

const round = (value, digits = 2) => (finite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null);

/**
 * Every metric of one video. `video` carries views, and when known likes,
 * comments, age_days, duration_s and subscribers.
 */
export function scoreVideo(video, base, { shortMax = 180 } = {}) {
  const views = finite(video.views) ? video.views : null;
  const multiplier = base && views !== null ? views / base.value : null;
  const ageDays = finite(video.age_days) ? video.age_days : null;
  const viewsPerDay = views !== null && ageDays !== null ? views / Math.max(ageDays, 1) : null;
  const reactions = (finite(video.likes) ? video.likes : 0) + (finite(video.comments) ? video.comments : 0);
  const engagement = views && (finite(video.likes) || finite(video.comments)) ? reactions / views : null;
  const confidence = base ? CONFIDENCE[base.kind] : null;
  const index = multiplier === null ? null : Math.min(multiplier, MULTIPLIER_CAP) * engagementWeight(engagement) * freshnessWeight(ageDays) * confidence;
  const flags = [];
  if (!base || base.kind === "subscribers") flags.push("no_baseline");
  if (finite(video.subscribers) && video.subscribers < SMALL_CHANNEL) flags.push("small_channel");
  if (ageDays !== null && ageDays < 7) flags.push("maturing");
  if (ageDays !== null && ageDays > 365) flags.push("old");
  if (finite(video.duration_s) && video.duration_s <= shortMax) flags.push("short");
  return {
    multiplier: round(multiplier),
    base: base ? { kind: base.kind, value: Math.round(base.value) } : null,
    band: band(multiplier, base?.kind),
    views_per_day: round(viewsPerDay, 1),
    engagement: round(engagement, 4),
    confidence,
    index: round(index),
    flags,
  };
}

const SORT_KEYS = {
  index: (item) => item.index,
  multiplier: (item) => item.multiplier,
  velocity: (item) => item.views_per_day,
  views: (item) => item.views,
};
export const RANKS = Object.keys(SORT_KEYS);

/**
 * Which videos get the slow details pass: mostly the highest multipliers, and
 * up to a third of the places for the most viewed videos without a base, so
 * their subscribers can at least stand in as a proxy.
 */
export function pickForDetails(items, count) {
  const based = rank(items.filter((item) => item.multiplier !== null), "multiplier");
  const unbased = rank(items.filter((item) => item.multiplier === null), "views");
  const reserve = Math.min(unbased.length, Math.floor(count / 3));
  const chosen = based.slice(0, count - reserve);
  return [...chosen, ...unbased.slice(0, count - chosen.length)];
}

/** Sorted copy, highest first; items without the metric go last, by views. */
export function rank(items, by = "index") {
  const key = SORT_KEYS[by];
  return [...items].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (finite(ka) && finite(kb) && ka !== kb) return kb - ka;
    if (finite(ka) !== finite(kb)) return finite(ka) ? -1 : 1;
    return (b.views ?? 0) - (a.views ?? 0);
  });
}
