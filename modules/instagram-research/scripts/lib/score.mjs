// Outlier math for Instagram, in one place so every number is auditable.
// A post is an outlier when it did far above its OWN profile's normal, not when it has a big number.
// Reels are measured by plays against the median of the profile's Reels; static posts and carousels
// by interactions against the median of the profile's static posts. The two never share a ranking.
// See references/metodologia.md.

/** The multiplier enters the index capped, so one tiny profile does not dominate. */
export const MULTIPLIER_CAP = 25;
/** A median from at least this many posts is a measured normal. */
export const MIN_BASELINE = 5;
/** From this many up to MIN_BASELINE it is only an indication. */
export const MIN_INDICATION = 3;
/** comments ÷ likes above this, with at least DM_BAIT_MIN_COMMENTS comments: "comment X and I send you". */
export const DM_BAIT_RATIO = 0.5;
export const DM_BAIT_MIN_COMMENTS = 20;
export const MATURING_DAYS = 7;
export const OLD_DAYS = 365;

const BANDS = [[10, "explosive"], [3, "outlier"], [1.5, "above"], [0.5, "normal"]];
export const DURATION_BUCKETS = [
  { id: "up_to_20s", label: "até 20 s", test: (s) => s <= 20 },
  { id: "21_to_60s", label: "de 21 a 60 s", test: (s) => s > 20 && s <= 60 },
  { id: "over_60s", label: "acima de 60 s", test: (s) => s > 60 },
];

const finite = (value) => typeof value === "number" && Number.isFinite(value);
const round = (value, digits = 2) => (finite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null);

export function median(values) {
  const sorted = values.filter(finite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** explosive, outlier, above, normal or weak; null without a multiplier. */
export function band(multiplier) {
  if (!finite(multiplier)) return null;
  for (const [floor, name] of BANDS) if (multiplier >= floor) return name;
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

/** From 1.00 to 1.50, saturating at 10% (likes + comments) / plays; 1 when unknown. */
export function engagementWeight(rate) {
  if (!finite(rate)) return 1;
  return 1 + 0.5 * Math.min(Math.max(rate, 0) / 0.1, 1);
}

/** What a post is measured by: plays for a Reels, likes plus comments for the rest (unknown with hidden likes). */
export function metricOf(post) {
  if (post.kind === "reel") return finite(post.plays) ? post.plays : null;
  return finite(post.likes) ? post.likes + (finite(post.comments) ? post.comments : 0) : null;
}

/** A profile's normal: the median of the metric over the posts that have it. */
export function baselineOf(posts) {
  const values = posts.map(metricOf).filter(finite);
  const value = values.length >= MIN_INDICATION ? median(values) : null;
  const status = values.length >= MIN_BASELINE ? "measured" : value !== null ? "indication" : "none";
  return { value: value !== null && value > 0 ? round(value, 1) : null, n: values.length, status: value !== null && value > 0 ? status : "none" };
}

/** Every metric and flag of one post against its profile's normal. */
export function scorePost(post, baseline) {
  const metric = metricOf(post);
  const base = baseline?.value ?? null;
  const multiplier = finite(metric) && finite(base) && base > 0 ? metric / base : null;
  const reactions = (finite(post.likes) ? post.likes : 0) + (finite(post.comments) ? post.comments : 0);
  const engagement = post.kind === "reel" && finite(post.plays) && post.plays > 0 && !post.hidden_likes && (finite(post.likes) || finite(post.comments)) ? reactions / post.plays : null;
  const confidence = baseline?.status === "measured" ? 1 : baseline?.status === "indication" ? 0.8 : null;
  const index = multiplier === null ? null : Math.min(multiplier, MULTIPLIER_CAP) * engagementWeight(engagement) * freshnessWeight(post.age_days) * confidence;
  const flags = [];
  if (!baseline || baseline.status === "none") flags.push("no_baseline");
  if (baseline?.status === "indication") flags.push("indication");
  if (post.hidden_likes) flags.push("hidden_likes");
  if (finite(post.comments) && post.comments >= DM_BAIT_MIN_COMMENTS && finite(post.likes) && post.comments / Math.max(post.likes, 1) > DM_BAIT_RATIO) flags.push("dm_bait");
  if (post.ad) flags.push("ad");
  if (finite(post.age_days) && post.age_days < MATURING_DAYS) flags.push("maturing");
  if (finite(post.age_days) && post.age_days > OLD_DAYS) flags.push("old");
  return { ...post, metric, multiplier: round(multiplier), band: band(multiplier), engagement: round(engagement, 4), index: round(index), flags };
}

const SORT_KEYS = { index: (item) => item.index, multiplier: (item) => item.multiplier, metric: (item) => item.metric };
export const RANKS = Object.keys(SORT_KEYS);

/** Sorted copy, highest first; items without the measure go last, by their raw metric. */
export function rank(items, by = "index") {
  const key = SORT_KEYS[by] ?? SORT_KEYS.index;
  return [...items].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (finite(ka) && finite(kb) && ka !== kb) return kb - ka;
    if (finite(ka) !== finite(kb)) return finite(ka) ? -1 : 1;
    return (b.metric ?? 0) - (a.metric ?? 0);
  });
}

/** Reels by duration: how many, the median plays and the median multiplier of each bucket. */
export function durationBuckets(reels) {
  return DURATION_BUCKETS.map((bucket) => {
    const inside = reels.filter((reel) => finite(reel.duration_s) && bucket.test(reel.duration_s));
    return { id: bucket.id, label: bucket.label, n: inside.length, median_plays: round(median(inside.map((reel) => reel.plays)), 0), median_multiplier: round(median(inside.map((reel) => reel.multiplier))) };
  });
}

/** One profile measured: its two normals, its posts scored and ranked, the Reels by duration. */
export function measureProfile(posts, { rankBy = "index" } = {}) {
  const reels = posts.filter((post) => post.kind === "reel");
  const statics = posts.filter((post) => post.kind !== "reel");
  const baseline = { reels: baselineOf(reels), static: baselineOf(statics) };
  const scoredReels = rank(reels.map((post) => scorePost(post, baseline.reels)), rankBy);
  const scoredStatics = rank(statics.map((post) => scorePost(post, baseline.static)), rankBy);
  const bandsOf = (items) => items.reduce((acc, item) => ((acc[item.band ?? "none"] = (acc[item.band ?? "none"] ?? 0) + 1), acc), {});
  return {
    baseline,
    reels: scoredReels,
    static: scoredStatics,
    durations: durationBuckets(scoredReels),
    sample: { posts: posts.length, reels: reels.length, static: statics.length, by_band: { reels: bandsOf(scoredReels), static: bandsOf(scoredStatics) } },
  };
}
