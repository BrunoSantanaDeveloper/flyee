// Synthetic posts in the shape apify/instagram-post-scraper returns. No real profile.

const DAY = 24 * 60 * 60 * 1000;
export const COLLECTED_AT = "2026-10-17";
const at = (daysAgo) => new Date(Date.parse(`${COLLECTED_AT}T12:00:00Z`) - daysAgo * DAY).toISOString();

const reel = (shortCode, plays, extra = {}) => ({
  type: "Video",
  productType: "clips",
  shortCode,
  url: `https://www.instagram.com/p/${shortCode}/`,
  videoPlayCount: plays,
  videoViewCount: Math.round(plays * 0.6),
  likesCount: Math.round(plays * 0.05),
  commentsCount: 2,
  videoDuration: 18,
  timestamp: at(20),
  caption: `Reels ${shortCode}`,
  paidPartnership: false,
  ...extra,
});

const still = (shortCode, likes, comments, extra = {}) => ({
  type: "Image",
  shortCode,
  url: `https://www.instagram.com/p/${shortCode}/`,
  likesCount: likes,
  commentsCount: comments,
  timestamp: at(40),
  caption: `Post ${shortCode}`,
  ...extra,
});

/** perfil.a: 8 Reels (normal 107,5 plays), 2 static posts. */
export function profileA() {
  return [
    reel("AAAAA1", 100, { videoDuration: 15 }),
    reel("AAAAA2", 120, { videoDuration: 35 }),
    reel("AAAAA3", 90, { videoDuration: 70 }),
    reel("AAAAA4", 110, { likesCount: -1 }),
    reel("AAAAA5", 1500, { videoDuration: 12, caption: "=SOMA(1;2) legenda que parece fórmula" }),
    reel("AAAAA6", 95, { commentsCount: 40, likesCount: 30 }),
    reel("AAAAA7", 105, { paidPartnership: true, timestamp: at(3) }),
    reel("AAAAA8", 400, { videoDuration: 25, timestamp: at(400) }),
    still("AAAAA9", 50, 2),
    still("AAAAB1", 60, 3),
  ].map((post) => ({ ...post, ownerUsername: "perfil.a", ownerFullName: "Perfil A" }));
}

/** perfil.b: 3 Reels, a normal that is only an indication. */
export function profileB() {
  return [reel("BBBBB1", 300), reel("BBBBB2", 200), reel("BBBBB3", 900)].map((post) => ({ ...post, ownerUsername: "perfil.b", ownerFullName: "Perfil B" }));
}

export const COMMENTS = [
  { text: "Isso serve para quem atende sozinha?", likesCount: 4, ownerUsername: "alguem", timestamp: at(1), repliesCount: 0 },
  { text: "Quanto custa?", likesCount: 9, ownerUsername: "outra.pessoa", timestamp: at(2), repliesCount: 1 },
];
