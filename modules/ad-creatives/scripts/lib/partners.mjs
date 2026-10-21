// The other flyee apps this one calls when they are installed: the measured organic content and
// the comments of a post (Pesquisa no Instagram), the comments of YouTube videos of the theme
// (Pesquisa no YouTube) and the reading of a reference ad (Análise de vídeo). This app never imports
// their code: the AI runs their commands, and `import` reads the files they save.

import { join } from "node:path";

import { isFile } from "./files.mjs";
import { readJson, slugify } from "./util.mjs";

export const PARTNERS = {
  "instagram-research": { title: "Pesquisa no Instagram", entry: "scripts/research.mjs", gives: "o orgânico medido do perfil da marca e dos concorrentes, e os comentários de um post" },
  "youtube-research": { title: "Pesquisa no YouTube", entry: "scripts/research.mjs", gives: "a fala do público nos comentários de vídeos do tema" },
  "video-analysis": { title: "Análise de vídeo", entry: "scripts/video.mjs", gives: "o que acontece, segundo a segundo, num anúncio de referência" },
};

/** Which partner apps are in the project, by their files: nothing of theirs is loaded. */
export function partnerApps(root) {
  return Object.fromEntries(
    Object.entries(PARTNERS).map(([slug, partner]) => {
      const dir = join(root, ".flyee", "modules", slug);
      const installed = isFile(join(dir, partner.entry));
      return [slug, { installed, title: partner.title, gives: partner.gives, version: installed ? readJson(join(dir, "flyee.module.json"), {})?.version ?? null : null, install: `npx --yes flyee@latest add ${slug} --yes --json` }];
    }),
  );
}

/** Which partner output a JSON file is, or null. */
export function partnerKind(data) {
  if (data?.app?.name === "instagram-research" && ["profile", "outliers"].includes(data.command)) return "instagram_posts";
  if (data?.app?.name === "instagram-research" && data.command === "comments") return "instagram_comments";
  if (data?.format_version === 1 && Array.isArray(data.comments) && /youtu/i.test(String(data.url ?? ""))) return "youtube_comments";
  return null;
}

const day = (value) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null);
const decimal = (value) => String(Math.round(value * 100) / 100).replace(".", ",");
const MIN_MULTIPLIER = 2;

/**
 * The posts that passed their own profile's normal (2 times or more), as organic evidence: the
 * Reels and the static posts apart, never in one ranking, each with the normal beside the
 * multiplier and the small sample said. Plus the Reels length buckets with 3 posts or more.
 */
export function instagramPostsToItems(data, { file, today }) {
  const profiles = data.command === "profile" ? [{ id: data.id, source: data.source, baseline: data.baseline }] : (data.profiles ?? []);
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  const items = [];
  const add = (posts, kind, max) => {
    const kept = (posts ?? []).filter((post) => typeof post.multiplier === "number" && post.multiplier >= MIN_MULTIPLIER).slice(0, max);
    for (const post of kept) {
      const owner = post.profile ?? data.id;
      const profile = byId.get(owner) ?? {};
      const baseline = profile.baseline?.[kind === "reel" ? "reels" : "static"] ?? {};
      items.push({
        id: `org-${slugify(owner, 30)}-${slugify(post.id ?? post.url ?? String(items.length + 1), 24)}`,
        kind: "organic_post",
        source: { type: profile.source?.type ?? "apify", ref: post.url ?? profile.source?.ref ?? file, collected_at: day(profile.source?.collected_at) ?? today, reading: file },
        who: `@${owner}`,
        data: {
          url: post.url ?? null,
          post_kind: kind,
          plays: kind === "reel" ? (post.plays ?? post.metric ?? null) : null,
          metric: post.metric ?? null,
          metric_name: kind === "reel" ? "plays" : "curtidas e comentários",
          baseline: typeof baseline.value === "number" ? baseline.value : null,
          multiplier: post.multiplier,
          duration_s: post.duration_s ?? null,
          small_sample: baseline.status !== "measured",
          text: typeof post.caption === "string" ? post.caption.slice(0, 300) : null,
        },
        tags: {},
        group: null,
        excluded: false,
      });
    }
  };
  add(data.reels ?? data.top_reels, "reel", 10);
  add(data.static ?? data.top_static, "static", 5);
  const who = data.command === "profile" ? `@${data.id}` : `${profiles.length} perfis comparados`;
  for (const bucket of data.durations ?? []) {
    if (!(bucket.n >= 3) || typeof bucket.median_multiplier !== "number") continue;
    items.push({
      id: `pad-${slugify(data.id ?? "comparacao", 30)}-${slugify(bucket.id, 16)}`,
      kind: "organic_pattern",
      source: { type: profiles[0]?.source?.type ?? "apify", ref: file, collected_at: day(profiles[0]?.source?.collected_at) ?? today, reading: file },
      who,
      data: { text: `Reels ${bucket.label ?? bucket.id}: mediana de ${decimal(bucket.median_multiplier)} vezes o normal do perfil`, n: bucket.n, median_multiplier: bucket.median_multiplier },
      tags: {},
      group: null,
      excluded: false,
    });
  }
  return items;
}

/** The most liked comments of a post or video as the audience's words, never who wrote them. */
export function commentsToItems(data, kind, { file, today }) {
  const youtube = kind === "youtube_comments";
  const list = (data.comments ?? [])
    .filter((comment) => comment && typeof comment.text === "string" && comment.text.trim() && !comment.by_creator)
    .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
    .slice(0, 20);
  const where = data.title ?? data.url ?? null;
  return list.map((comment, index) => ({
    id: `fala-${youtube ? "yt" : "ig"}-${slugify(data.id ?? where ?? "post", 20)}-${index + 1}`,
    kind: "audience_comment",
    source: { type: youtube ? "export" : "apify", ref: data.url ?? file, collected_at: day(data.collected_at ?? data.fetched_at) ?? today, reading: file },
    who: youtube ? "público no YouTube" : "público no Instagram",
    data: { text: comment.text.replace(/\s+/g, " ").trim().slice(0, 400), likes: typeof comment.likes === "number" ? comment.likes : null, where },
    tags: {},
    group: null,
    excluded: false,
  }));
}
