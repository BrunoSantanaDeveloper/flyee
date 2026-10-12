// Guesses the language of a video title (Portuguese, Spanish or English).
// YouTube search mixes languages; search results carry no language, so the
// title is the only clue until the details pass reads the video's own field.

const WORDS = {
  pt: ["de", "do", "da", "dos", "das", "que", "não", "nao", "você", "voce", "vc", "para", "pra", "com", "como", "uma", "um", "seu", "sua", "seus", "suas", "é", "em", "no", "na", "nos", "nas", "os", "as", "isso", "esse", "essa", "este", "esta", "mais", "fazer", "faça", "vídeo", "vídeos", "porque", "sem", "ao", "eu", "meu", "minha", "está", "são", "também", "quando", "jeito", "dicas", "ganhar", "dinheiro", "agora", "melhor", "nunca", "coisa", "aqui", "o", "e", "criar", "aula", "qualquer", "tudo", "sozinho", "ferramenta", "histórias", "aprenda", "sociais", "vendem", "prendem", "passo", "seja", "ser", "foi", "vai", "pelo", "pela", "até", "já"],
  es: ["de", "el", "la", "los", "las", "que", "para", "con", "como", "cómo", "una", "un", "tu", "tus", "su", "sus", "es", "en", "y", "del", "al", "por", "qué", "más", "hacer", "haz", "sin", "mi", "este", "esta", "esto", "porque", "cuando", "también", "vídeo", "historias", "dinero", "trucos", "aprende", "guiones", "ahora", "mejor", "nunca", "aquí"],
  en: ["the", "to", "how", "your", "you", "and", "of", "in", "is", "for", "with", "my", "this", "why", "what", "i", "it", "on", "that", "make", "made", "best", "every", "everyday", "never", "get", "do", "secret", "ways", "tips", "write", "here's", "these", "will"],
};
const SETS = Object.fromEntries(Object.entries(WORDS).map(([language, words]) => [language, new Set(words)]));
const MARKS = [
  ["pt", /[ãõçêôâà]|ões\b|ção\b/u, 2],
  ["es", /[ñ¿¡]|ción\b|ciones\b/u, 2],
];

/** "pt", "es", "en" or null when the title says too little. */
export function titleLanguage(title) {
  const text = String(title ?? "").toLowerCase();
  const tokens = text.split(/[^\p{L}']+/u).filter(Boolean);
  const scores = { pt: 0, es: 0, en: 0 };
  for (const token of tokens) for (const language of Object.keys(SETS)) if (SETS[language].has(token)) scores[language] += 1;
  for (const [language, pattern, weight] of MARKS) if (pattern.test(text)) scores[language] += weight;
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (ranked[0][1] < 1 || ranked[0][1] === ranked[1][1]) return null;
  return ranked[0][0];
}

/** "pt-BR" → "pt"; null stays null. */
export function baseLanguage(language) {
  return language ? String(language).toLowerCase().split(/[-_]/)[0] : null;
}
