// Caption traits measured against the outlier multiplier, by the method of the title traits in the
// YouTube research: for each trait, the median multiplier of the posts whose caption has it and of
// those whose caption does not, with the size of each group; then the caption sizes and the hashtag
// counts in buckets. It describes this sample and proves no cause.
// Every pattern reads Portuguese and English. Words are matched on the text folded to lower case
// without accents, with letter edges written as lookarounds: `\b` is ASCII only in JavaScript, so a
// word ending in an accent would never match it.

import { median } from "./score.mjs";

const round = (value, digits = 2) => (typeof value === "number" && Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null);

/** Lower case without accents ("Comentários" becomes "comentarios"); digits and emoji stay. */
export function fold(text) {
  return String(text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

const LINK = /https?:\/\/\S+/giu;
/** A hashtag has a letter: "#1" in "o #1 erro" is not one. "&#" is an HTML entity, not a hashtag. */
const HASHTAG = /(?<![\p{L}\p{N}_&])#(?=[\p{L}\p{N}_]*\p{L})[\p{L}\p{N}_]+/gu;
const MENTION = /(?<![\p{L}\p{N}_])@[\p{L}\p{N}_](?:[\p{L}\p{N}_.]*[\p{L}\p{N}_])?/gu;
/** A line that opens an item: "1.", "2)", "3º", a keycap number, a bullet, a dash, a check mark or an emoji. */
const LIST_MARKER = /^(?:\d{1,2}\s*[.)º°:](?!\d)|\d️?⃣|[•·▪▫◦‣⁃●○■□►▶→✓✔✗✘*+\-–—]|\p{Extended_Pictographic})/u;
const LAST_TEXT = /[\p{L}\p{N}](?=[^\p{L}\p{N}]*$)/u;

/** Blanks of the same length, so every other position keeps its place. */
const blank = (text, pattern) => text.replace(pattern, (match) => " ".repeat(match.length));

const SEGMENTER = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("pt", { granularity: "grapheme" }) : null;

/** Characters as a person counts them: an emoji with its modifiers counts once. */
export function textLength(text) {
  const value = String(text ?? "");
  if (!value) return 0;
  if (!SEGMENTER) return [...value].length;
  let count = 0;
  for (const _segment of SEGMENTER.segment(value)) count += 1;
  return count;
}

const FIRST_PERSON = /(?<!\p{L})(?:eu|meu|minha|meus|minhas|comigo|testei|fiz|criei|usei|ganhei|perdi|aprendi|descobri|comprei|tentei|montei|deixei|pedi|gastei|transformei|construi|larguei|parei|comecei|estudei|vendi|troquei|mudei|fui|my|mine|i['’](?:m|ve|ll|d))(?!\p{L})/u;
/** The English "I", on the text as written: folded, it would be any "i". */
const FIRST_PERSON_I = /(?<!\p{L})I(?!\p{L})/u;

/** Calls to action, by kind. Each pattern is one way the request is written, on the folded text. */
const CTA = {
  comment: [
    /(?<!\p{L})(?:comente|comentem)(?!\p{L})/u,
    /(?<!\p{L})comenta(?!\p{L})(?!\s+que(?!\p{L}))/u,
    /(?<!\p{L})(?:de|pode|podem)\s+comentar(?!\p{L})/u,
    /(?<!\p{L})(?:nos|nas|aqui\s+nos)\s+comentarios(?!\p{L})/u,
    /(?<!\p{L})deix[ae]m?\s+(?:aqui\s+)?(?:o\s+|um\s+|seu\s+|sua\s+)?comentario(?!\p{L})/u,
    /(?<!\p{L})comment(?=\s+(?:below|down|now|here|your|with|the\s+word|if|and)(?!\p{L})|\s*["'“‘])/u,
    /(?:^|[.!?:]\s+|\n\s*)comment(?!\p{L})/u,
    /(?<!\p{L})(?:in|on)\s+the\s+comments(?!\p{L})/u,
    /(?<!\p{L})(?:drop|leave)\s+(?:a|your|me\s+a)\s+comment(?!\p{L})/u,
    /(?<!\p{L})let\s+me\s+know(?!\p{L})/u,
  ],
  save: [
    /(?<!\p{L})(?:salva|salve|salvem)\s+(?:est|ess|o\s+post|a\s+dica|aqui(?!\p{L})|ai(?!\p{L})|pra(?!\p{L})|para(?!\p{L})|e\s+(?:compartilh|mand|envi))/u,
    /(?<!\p{L})(?:deix[ae]m?\s+salv[oa]|salvar\s+(?:est|ess|o\s+post|pra(?!\p{L})|para(?!\p{L})|depois(?!\p{L}))|(?:de|pode|podem)\s+salvar(?!\p{L}))/u,
    /(?<!\p{L})salva\s*(?:[.!]|$)/mu,
    /(?<!\p{L})(?:save|bookmark)\s+(?:this|it|for\s+later|the\s+post|these)(?!\p{L})/u,
    /(?<!\p{L})(?:hit|tap)\s+(?:the\s+)?save(?!\p{L})/u,
  ],
  share: [
    /(?<!\p{L})(?:compartilhe|compartilhem)(?!\p{L})/u,
    /(?<!\p{L})compartilha\s+(?:com(?!\p{L})|est|ess|pra(?!\p{L})|para(?!\p{L})|o\s+post|aqui(?!\p{L})|ai(?!\p{L}))/u,
    /(?<!\p{L})(?:de|pode|podem)\s+compartilhar(?!\p{L})/u,
    /(?<!\p{L})(?:marque|marca|marquem)\s+(?:alguem|algum|alguma|um\s+amig|uma\s+amig|quem|aquel|o\s+amig|a\s+amig|seu|sua|seus|suas)/u,
    /(?<!\p{L})(?:manda|mande|envia|envie)\s+(?:esse|este|essa|esta)\s+(?:post|video|reels?|carrossel|conteudo)(?!\p{L})/u,
    /(?<!\p{L})(?:manda|mande|envia|envie)\s+(?:pra|para)\s+(?:aquel|alguem|um\s+amig|uma\s+amig|quem|sua|seu|o\s+amig|a\s+amig)/u,
    /(?<!\p{L})share\s+(?:this|it|with)(?!\p{L})/u,
    /(?<!\p{L})send\s+(?:this|it)\s+to(?!\p{L})/u,
    /(?<!\p{L})tag\s+(?:a|your|someone|that|the)(?!\p{L})/u,
  ],
  link_bio: [
    /(?<!\p{L})links?(?!\p{L})[^.\n]{0,25}?(?<!\p{L})(?:bio|perfil|profile)(?!\p{L})/u,
    /(?<!\p{L})(?:na|da|pela)\s+(?:minha\s+)?bio(?!\p{L})/u,
    /(?<!\p{L})in\s+(?:my\s+|the\s+)?bio(?!\p{L})/u,
  ],
  dm: [
    /(?<!\p{L})(?:no|na|pelo|pela|por|via)\s+(?:direct|dm|inbox|privado|pv)(?!\p{L})/u,
    /(?<!\p{L})(?:manda|mande|envia|envie|deixa|deixe)\s+(?:uma\s+|sua\s+)?(?:mensagem|msg|dm|direct)(?!\p{L})/u,
    /(?<!\p{L})(?:me|nos)\s+(?:chama|chame|chamem)(?=\s+(?:no|na|aqui|ai|la)(?!\p{L}))/u,
    /(?<!\p{L})(?:que|e)\s+(?:eu\s+)?(?:te|lhe)\s+(?:mando|envio)(?!\p{L})/u,
    /(?<!\p{L})(?:dm|message)\s+me(?!\p{L})/u,
    /(?<!\p{L})send\s+me\s+(?:a\s+)?(?:dm|message)(?!\p{L})/u,
    /(?<!\p{L})(?:in|to)\s+(?:my|the|your)\s+dms?(?!\p{L})/u,
    /(?<!\p{L})direct\s+message(?!\p{L})/u,
    /(?<!\p{L})dm\s+(?:for|the\s+word|us)(?!\p{L})/u,
    /(?<!\p{L})(?:i['’]?ll|i\s+will|we['’]?ll|we\s+will)\s+(?:dm|message|send)\s+(?:you|it)(?!\p{L})/u,
  ],
};
const asks = (kind) => (c) => CTA[kind].some((pattern) => pattern.test(c.folded));

/**
 * Everything the traits look at in one caption, read once. `words` is the caption without links,
 * hashtags and mentions, in the same positions; a hashtag placed before the last word of that text
 * sits inside the text, and one after it sits at the end.
 */
export function readCaption(caption) {
  const text = String(caption ?? "");
  const lines = text.split("\n");
  // Styled letters (mathematical bold, full width) become plain ones for the patterns; the sizes and
  // the list markers stay on the text as the person sees it.
  const plain = text.normalize("NFKC");
  const noLinks = blank(plain, LINK);
  const tags = [...noLinks.matchAll(HASHTAG)];
  const words = blank(blank(noLinks, HASHTAG), MENTION);
  const lastText = LAST_TEXT.exec(words)?.index ?? -1;
  const inline = tags.filter((tag) => tag.index < lastText).length;
  const firstLine = lines[0].trim();
  return {
    words,
    folded: fold(words),
    first_line: firstLine,
    first_words: words.split("\n")[0],
    first_line_length: textLength(firstLine),
    total_length: textLength(text),
    hashtags: { count: tags.length, inline, end: tags.length - inline },
    list_lines: lines.filter((line) => LIST_MARKER.test(line.trim())).length,
  };
}

/**
 * The traits, each with a label that says what was looked for, so nobody reads more into the
 * count. The order is part of the interface: new traits go at the end.
 */
export const TRAITS = [
  { key: "question", label: "faz uma pergunta (\"?\")", test: (c) => /[?¿]/u.test(c.words) },
  { key: "first_line_number", label: "número na primeira linha", test: (c) => /(?<![\p{L}\p{N}])\d/u.test(c.first_words) },
  { key: "first_person", label: "primeira pessoa (\"eu\", \"meu\", \"minha\", \"testei\", \"I\", \"my\")", test: (c) => FIRST_PERSON.test(c.folded) || FIRST_PERSON_I.test(c.words) },
  { key: "list_format", label: "lista em linhas (3 ou mais linhas que começam com número, marcador ou emoji)", test: (c) => c.list_lines >= 3 },
  { key: "hashtags_end", label: "hashtags só no fim", test: (c) => c.hashtags.count > 0 && c.hashtags.inline === 0 },
  { key: "hashtags_inline", label: "hashtag no meio do texto", test: (c) => c.hashtags.inline > 0 },
  { key: "cta_any", label: "algum pedido ao público (comentar, salvar, compartilhar, link da bio ou direct)", test: (c) => Object.keys(CTA).some((kind) => asks(kind)(c)) },
  { key: "cta_comment", label: "pede comentário (\"comente\", \"me conta nos comentários\", \"comment below\")", test: asks("comment") },
  { key: "cta_save", label: "pede para salvar (\"salva esse post\", \"save this\")", test: asks("save") },
  { key: "cta_share", label: "pede para compartilhar ou marcar alguém (\"compartilhe\", \"marque um amigo\", \"tag a friend\")", test: asks("share") },
  { key: "cta_link_bio", label: "manda para o link da bio (\"link na bio\", \"link in bio\")", test: asks("link_bio") },
  { key: "cta_dm", label: "chama para o direct (\"me chama no direct\", \"te mando no direct\", \"DM me\")", test: asks("dm") },
];

const FIRST_LINE_BUCKETS = [["até 40", 0, 40], ["41 a 80", 41, 80], ["81 a 125", 81, 125], ["acima de 125", 126, Infinity]];
const TOTAL_BUCKETS = [["até 125", 0, 125], ["126 a 400", 126, 400], ["401 a 1.000", 401, 1000], ["acima de 1.000", 1001, Infinity]];
const HASHTAG_BUCKETS = [["nenhuma", 0, 0], ["1 a 3", 1, 3], ["4 a 10", 4, 10], ["acima de 10", 11, Infinity]];

const isStrong = (post) => post.band === "explosive" || post.band === "outlier";

/** Median of each side and their ratio: the shape every trait row shares with the title traits. */
function compare(withPosts, without, minN) {
  const withMedian = median(withPosts.map((post) => post.multiplier));
  const withoutMedian = median(without.map((post) => post.multiplier));
  return {
    with: { n: withPosts.length, median: round(withMedian) },
    without: { n: without.length, median: round(withoutMedian) },
    ratio: withMedian && withoutMedian ? round(withMedian / withoutMedian) : null,
    small_n: withPosts.length < minN || without.length < minN,
  };
}

/** A size measured on every caption: its median in the sample and in the outliers, and the multiplier by bucket. */
function sizeBlock(read, measure, buckets, minN) {
  const strong = read.filter((entry) => isStrong(entry.post));
  return {
    median_all: round(median(read.map((entry) => measure(entry.c))), 1),
    median_outliers: strong.length ? round(median(strong.map((entry) => measure(entry.c))), 1) : null,
    outliers_n: strong.length,
    buckets: buckets.map(([range, low, high]) => {
      const inside = read.filter((entry) => {
        const value = measure(entry.c);
        return value >= low && value <= high;
      });
      return { range, n: inside.length, median: round(median(inside.map((entry) => entry.post.multiplier))), small_n: inside.length < minN };
    }),
  };
}

/**
 * The trait table of one kind of post (Reels, or static posts and carousels: their multipliers
 * measure different things and never share a table). Only posts with a multiplier and a caption
 * count; an empty caption is a caption, an unknown one (null) is not.
 */
export function captionTable(posts, { minN = 5 } = {}) {
  const withMultiplier = posts.filter((post) => typeof post.multiplier === "number" && Number.isFinite(post.multiplier));
  const read = withMultiplier.filter((post) => typeof post.caption === "string").map((post) => ({ post, c: readCaption(post.caption) }));
  const traits = TRAITS.map((trait) => {
    const yes = [];
    const no = [];
    for (const entry of read) (trait.test(entry.c) ? yes : no).push(entry.post);
    return { trait: trait.key, label: trait.label, ...compare(yes, no, minN) };
  });
  return {
    sample: { posts: posts.length, measured: read.length, no_caption: withMultiplier.length - read.length, no_multiplier: posts.length - withMultiplier.length },
    traits,
    first_line: sizeBlock(read, (c) => c.first_line_length, FIRST_LINE_BUCKETS, minN),
    total: sizeBlock(read, (c) => c.total_length, TOTAL_BUCKETS, minN),
    hashtags: sizeBlock(read, (c) => c.hashtags.count, HASHTAG_BUCKETS, minN),
  };
}

// A missing median (an empty group) leaves the cell with just its size: "(n=0)".
const times = (value) => (typeof value === "number" ? `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}×` : "");
const number = (value) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const group = (side) => [times(side.median), `(n=${side.n})`].filter(Boolean).join(" ");

function sizeLines(title, unit, block) {
  const head = typeof block.median_all === "number"
    ? `${title}: mediana de ${number(block.median_all)} ${unit} na amostra${typeof block.median_outliers === "number" ? ` e de ${number(block.median_outliers)} nos outliers (n=${block.outliers_n})` : ""}.`
    : `${title}: sem dado.`;
  return [
    head,
    "",
    `| ${title} | Mediana do multiplicador | n |`,
    "|---|---|---|",
    ...block.buckets.map((bucket) => `| ${bucket.range} | ${times(bucket.median)} | ${bucket.n}${bucket.small_n ? " (pequeno)" : ""} |`),
    "",
  ];
}

function kindLines(title, measure, table, minN) {
  const sample = table.sample;
  const lines = [`## ${title}`, ""];
  if (!sample.measured) {
    const missing = sample.no_caption ? `: ${sample.no_caption} com multiplicador vieram sem a legenda` : "";
    lines.push(`Nenhum post com multiplicador e legenda ${sample.posts ? `entre os ${sample.posts} desta pesquisa` : "nesta pesquisa"}${missing}.`, "");
    return lines;
  }
  const notes = [sample.no_caption ? `${sample.no_caption} sem a legenda` : "", sample.no_multiplier ? `${sample.no_multiplier} sem multiplicador` : ""].filter(Boolean);
  lines.push(
    `${sample.measured} legendas com multiplicador, de ${sample.posts} posts${notes.length ? ` (${notes.join(", ")})` : ""}. ${measure}`,
    "",
    "| Traço | Com o traço | Sem o traço | Aviso |",
    "|---|---|---|---|",
    ...table.traits.map((row) => `| ${row.label} | ${group(row.with)} | ${group(row.without)} | ${row.small_n ? `grupo pequeno (menos de ${minN}): indício` : ""} |`),
    "",
    ...sizeLines("Primeira linha", "caracteres", table.first_line),
    ...sizeLines("Legenda inteira", "caracteres", table.total),
    ...sizeLines("Hashtags", "hashtags por legenda", table.hashtags),
  );
  return lines;
}

const REASONS = { paid_partnership: "parceria paga", asked: "tirado a pedido" };

/** legendas.md: the two tables, what stayed out and what this data does not say. */
export function captionsMarkdown(result) {
  const about = result.scope === "outliers" ? `a pesquisa ${result.id}` : `o perfil @${result.id}`;
  const lines = [
    `# Traços de legenda: ${result.profiles.map((id) => `@${id}`).join(", ")}`,
    "",
    `Feito em ${result.created_at.slice(0, 10)}, sobre ${about}. O multiplicador é quantas vezes o post fez o normal do próprio perfil. Cada tabela compara a mediana dos posts cuja legenda tem o traço com a dos posts cuja legenda não tem, com o tamanho de cada grupo. A primeira linha é o texto até a primeira quebra de linha. Reels e posts estáticos têm normais diferentes e ficam em tabelas separadas.`,
    "",
    ...kindLines("Reels", "O multiplicador de um Reels compara os plays com o normal de plays do próprio perfil.", result.reels, result.min_n),
    ...kindLines("Posts estáticos e carrosséis", "O multiplicador compara as curtidas mais os comentários com o normal deles no próprio perfil.", result.static, result.min_n),
  ];
  if (result.excluded?.length) {
    lines.push("## Fora da conta", "", ...result.excluded.map((post) => `- ${post.id}${post.profile ? ` (@${post.profile})` : ""}: ${REASONS[post.reason] ?? post.reason}.`), "");
  }
  if (result.warnings?.length) lines.push("## Ressalvas", "", ...result.warnings.map((warning) => `- ${warning}`), "");
  lines.push(
    "## O que este dado não afirma",
    "",
    "- Descreve esta amostra, não o Instagram inteiro: outros perfis ou outra época dão outros números.",
    "- Mostra o que anda junto com os posts que foram bem, não a causa. Um traço com mediana alta é uma pista para testar, nunca uma regra.",
    `- Grupo com menos de ${result.min_n} posts é indício.`,
    "- Os traços são achados por regras de texto em português e em inglês, e cada rótulo diz o que foi procurado: um pedido escrito de outro jeito, ou noutra língua, fica de fora.",
    "- Parcerias pagas ficam fora da conta, porque parte do alcance foi comprada.",
    "",
  );
  return `${lines.join("\n")}\n`;
}
