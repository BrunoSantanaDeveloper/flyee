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

/**
 * perfil.legendas: 11 Reels with whole captions (line breaks, hashtags, calls to action), one of
 * them a paid partnership and one with no caption at all. Normal: 110 plays.
 */
export function profileCaptions() {
  return [
    reel("CCCCC1", 1200, { caption: "Qual erro você comete no pão?\n\nMe conta nos comentários.\n\n#pao #receita #paocaseiro" }),
    reel("CCCCC2", 950, { caption: "3 erros que deixam o pão solado\n1. Sovar pouco\n2. Fermento velho\n3. Forno frio\n\nSalva esse post pra não esquecer." }),
    reel("CCCCC3", 100, { caption: "Pão de todo dia #pao com manteiga" }),
    reel("CCCCC4", 120, { caption: "Eu testei a receita da minha avó" }),
    reel("CCCCC5", 110, { caption: "A receita completa está no link da bio." }),
    reel("CCCCC6", 90, { caption: "Pão de queijo" }),
    reel("CCCCC7", 800, { caption: "5 pães para o café?\nComenta EU que eu te mando a lista no direct." }),
    reel("CCCCC8", 100, { caption: "Compartilhe com quem ama pão." }),
    reel("CCCCC9", 95, { caption: "" }),
    reel("CCCCD1", 105, { caption: undefined }),
    reel("CCCCD2", 3000, { paidPartnership: true, caption: "Parceria com a marca. Link na bio." }),
  ].map((post) => ({ ...post, ownerUsername: "perfil.legendas", ownerFullName: "Perfil Legendas" }));
}

export const COMMENTS = [
  { text: "Isso serve para quem atende sozinha?", likesCount: 4, ownerUsername: "alguem", timestamp: at(1), repliesCount: 0 },
  { text: "Quanto custa?", likesCount: 9, ownerUsername: "outra.pessoa", timestamp: at(2), repliesCount: 1 },
];
