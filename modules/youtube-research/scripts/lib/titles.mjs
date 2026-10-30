// Title traits measured against the multiplier of a research sample: for each
// trait, the median multiplier of the titles that have it and of those that
// don't. It describes this sample; it proves no cause. Beside the traits: the
// titles that went furthest above their channel's normal and those that stayed
// below it, and the words that go with each.

import { median } from "./score.mjs";

const FIRST_PERSON_WORDS = /(?<!\p{L})(eu|meu|minha|meus|minhas|comigo|testei|fiz|criei|usei|ganhei|perdi|aprendi|descobri|comprei|tentei|montei|deixei|pedi|gastei|transformei|constru[íi]|larguei|parei|comecei|estudei|vendi|troquei|mudei|fui|my|me|i'm|i've)(?!\p{L})/iu;
const FIRST_PERSON_I = /(?<!\p{L})I(?!\p{L})/u;
const RESULT = /(R\$|US\$|\$|€)\s?\d|\d+(?:[.,]\d+)?\s?(%|k(?!\p{L})|mil(?!\p{L})|mi(?!\p{L})|milh|reais|d[óo]lares|dollars|minutos?|minutes?|min(?!\p{L})|horas?|hours?|h(?!\p{L})|dias?|days?|semanas?|weeks?|meses|months?|anos?|years?|vezes|times|x(?!\p{L})|views|visualiza|seguidores|followers|inscritos|subscribers|clientes|clients|vendas|sales|kg|quilos)/iu;

// The triggers of the packaging guide, as a script can see them in a title.
// Each label says what was looked for, so nobody reads more into the count.
const GAP = /^\s*(?:por\s*qu[eê]|o\s+que|why|what)(?!\p{L})|^\s*(?:o|a|os|as|the)\s+\p{L}+(?:\s+\p{L}+)?\s+(?:que|that)(?!\p{L})|(?<!\p{L})(?:segredos?|secrets?|o\s+motivo|the\s+reason|isso|esse|essa|esses|essas|this|these|ningu[ée]m|nobody|a\s+verdade|the\s+truth)(?!\p{L})/iu;
const SEARCH = /^\s*(?:como|how\s+to|o\s+que\s+[ée]|what\s+is)(?!\p{L})|(?<!\p{L})(?:passo\s+a\s+passo|tutorial|iniciantes?|guia|do\s+zero|step\s+by\s+step|beginners?|guide|from\s+scratch)(?!\p{L})/iu;
const CONTRARIAN = /(?<!\p{L})(?:pare|parem)\s+de(?!\p{L})|(?<!\p{L})n[ãa]o\s+(?:fa[çc]a|compre|use|estude|coma|acredite|caia|siga)(?!\p{L})|(?<!\p{L})(?:mitos?|mentiras?|superestimad[oa]s?|est[áa]\s+errad[oa]|don'?t|myths?|lies|overrated)(?!\p{L})|(?<!\p{L})stop\s+\p{L}+ing(?!\p{L})|(?<!\p{L})ningu[ée]m\s+(?:te\s+)?(?:conta|fala|diz|ensina)(?!\p{L})|(?<!\p{L})nobody\s+(?:tells|talks|teaches)(?!\p{L})/iu;
const MISTAKE = /(?<!\p{L})(?:erros?|errando|errar|errei|perdendo|perdi|desperd[íi]\p{L}*|evite|evitar|cuidado|arrependi\p{L}*|preju[íi]zos?|estrag\p{L}*|mistakes?|avoid|losing|wasting|regret\p{L}*|ruin\p{L}*)(?!\p{L})|(?<!\p{L})jogando\s+fora(?!\p{L})/iu;
const EXPERIMENT = /(?<!\p{L})(?:testei|tentei|experimentei|fiquei|passei|vivi|desafio|experimento|experiment|challenge|i\s+tried|i\s+tested|i\s+spent)(?!\p{L})|(?<!\p{L})(?:por|durante|for)\s+\d+\s+(?:dias|semanas|meses|horas|days|weeks|months|hours)(?!\p{L})|(?<![\p{L}\d])\d+\s+(?:dias|semanas|meses|days|weeks|months)\s+(?:de|sem|com|usando|of|without|with|using)(?!\p{L})/iu;
const LIST = /(?<![\p{L}\d])(?:top\s*)?\d+\s+(?:dicas|erros|coisas|formas|maneiras|jeitos|ferramentas|passos|motivos|raz[õo]es|sinais|segredos|ideias|truques|apps|aplicativos|sites|h[áa]bitos|regras|perguntas|receitas|tips|mistakes|things|tools|steps|reasons|signs|ideas|tricks|habits|rules|ways|recipes)(?!\p{L})/iu;
const COMPARISON = /(?<!\p{L})(?:vs\.?|versus|comparei|comparando|comparativo|compara[çc][ãa]o|compared|comparison)(?!\p{L})|(?<!\p{L})(?:melhor|pior|better|worse)\s+(?:que|do\s+que|than)(?!\p{L})|\p{L}\s+x\s+\p{L}|(?<!\p{L})qual\s+(?:[ée]\s+)?(?:o\s+|a\s+)?(?:melhor|escolher)(?!\p{L})|(?<!\p{L})which\s+(?:is\s+)?(?:better|one)(?!\p{L})/iu;
const YOU = /(?<!\p{L})(?:voc[êe]|vc|seu|sua|seus|suas|you|your)(?!\p{L})/iu;
const SUPERLATIVE = /(?<!\p{L})(?:melhor|melhores|pior|piores|best|worst|easiest|cheapest|fastest)(?!\p{L})|(?<!\p{L})mais\s+(?:f[áa]cil|barat[oa]s?|r[áa]pid[oa]s?|simples)(?!\p{L})/iu;
const YEAR = /(?<!\d)20[2-3]\d(?!\d)/;
const TWO_PARTS = /[:|]|\s[-–—]\s/u;
const EMOJI = /\p{Extended_Pictographic}/u;
// The levers added in 1.2.0: what the creator put at stake, an extreme or a
// contrast of values, the inside view, a call to whom the video is for, and the
// same thing before and after.
const STAKES = /(?<!\p{L})(?:apostei|arrisquei|investi|coloquei|gastei|torrei)\s+(?:R\$|US\$|\$|€|\d|tudo|todo|toda|minhas?|meus?|o\s+meu|a\s+minha)|(?<!\p{L})quase\s+(?:perdi|desisti|quebrei|fali|larguei|morri)(?!\p{L})|(?<!\p{L})(?:larguei|deixei|abandonei)\s+(?:o\s+|a\s+|meu\s+|minha\s+)?(?:emprego|clt|faculdade|trabalho|carreira)(?!\p{L})|(?<!\p{L})(?:pedi\s+demiss[ãa]o|tudo\s+ou\s+nada|[úu]ltima\s+chance|sem\s+volta|perdi\s+tudo|i\s+(?:bet|risked|quit)|almost\s+(?:lost|quit|died)|all\s+in|last\s+chance|lost\s+everything)(?!\p{L})/iu;
const EXTREME = /(?:R\$|US\$|\$|€)\s?\d[\s\S]*?(?:R\$|US\$|\$|€)\s?\d|(?<!\p{L})(?:barat[oa]s?|car[oa]s?|cheap|expensive)\s+(?:x|vs\.?|versus|contra|ou|or)\s+(?:o\s+|a\s+)?(?:mais\s+)?(?:barat[oa]s?|car[oa]s?|cheap|expensive)(?!\p{L})|(?<!\p{L})(?:do\s+mundo|da\s+hist[óo]ria|de\s+todos\s+os\s+tempos|n[íi]vel\s+\d+|mais\s+car[oa]s?|extrem[oa]s?|in\s+the\s+world|of\s+all\s+time|level\s+\d+|most\s+expensive)(?!\p{L})|(?<![\p{L}\d])\d+\s*(?:x|vezes)\s+mais(?!\p{L})/iu;
const INSIDER = /(?<!\p{L})(?:bastidores?|por\s+dentro|um\s+dia\s+(?:na\s+rotina|na\s+vida|comigo)|behind\s+the\s+scenes|inside|a\s+day\s+in\s+the\s+life)(?!\p{L})|(?<!\p{L})o\s+que\s+(?:\p{L}+\s+){0,5}n[ãa]o\s+(?:te\s+|nos\s+)?(?:mostra|mostram|conta|contam|fala|falam)(?!\p{L})|(?<!\p{L})what\s+(?:\p{L}+\s+){0,5}(?:don'?t|won'?t|doesn'?t)\s+(?:tell|show)(?!\p{L})/iu;
const CALLOUT = /(?<!\p{L})(?:se\s+voc[êe]|voc[êe]\s+que|para\s+quem|pra\s+quem|if\s+you|for\s+(?:people|anyone|those)\s+who|anyone\s+who)(?!\p{L})|(?<!\p{L})quem\s+(?:tem|usa|vende|trabalha|mora|quer|faz|come[çc]ou|come[çc]a|est[áa])(?!\p{L})|(?<!\p{L})(?:tod[oa]s?|every)\s+(?:\p{L}+\s+){1,2}(?:precisa|precisam|deveria|deveriam|should|needs)(?!\p{L})/iu;
const TRANSFORMATION = /(?<!\p{L})(?:antes\s+e\s+depois|transform\p{L}*|do\s+zero\s+(?:a|ao|aos|à|at[ée])|mudou\s+(?:a\s+)?minha|vir(?:ei|ou)\s+(?:outr[oa]|um|uma)|before\s+(?:and|&)\s+after|from\s+(?:zero|scratch)\s+to|glow\s*up|makeover|changed\s+my)(?!\p{L})|(?<![\p{L}\d])de\s+(?:R\$\s?)?\d[\d.,]*\s*(?:k|mil)?\s*\p{L}*\s+(?:para|pra|at[ée])\s+(?:R\$\s?)?\d|(?<!\p{L})from\s+\$?\d[\d.,]*\s*k?\s+to\s+\$?\d/iu;

/** A word of 4+ letters written all in capitals, in a title that is not all capitals. */
function capsWord(title) {
  const letters = title.match(/\p{L}/gu) ?? [];
  const upper = letters.filter((letter) => letter === letter.toUpperCase() && letter !== letter.toLowerCase()).length;
  if (!letters.length || upper / letters.length > 0.5) return false;
  return /(?<!\p{L})\p{Lu}{4,}(?!\p{L})/u.test(title);
}

function toolPattern(tools) {
  const names = tools.map((tool) => tool.trim()).filter(Boolean);
  if (!names.length) return null;
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"));
  return new RegExp(`(?<![\\p{L}\\d])(${escaped.join("|")})(?![\\p{L}\\d])`, "iu");
}

const matches = (pattern) => (title) => pattern.test(title);

/**
 * `group` "gatilho" are the triggers of the packaging guide (`trigger` names
 * which one); "forma" is how the title is written. The first nine keep their
 * order from interface 1.
 */
export const TRAITS = [
  { key: "number", group: "forma", short: "número", label: "tem número", test: (title) => /\d/.test(title) },
  { key: "tool", group: "forma", short: "ferramenta", label: "nome de ferramenta ou marca", test: (title, ctx) => (ctx.tools ? ctx.tools.test(title) : null) },
  { key: "brackets", group: "forma", short: "parênteses", label: "parênteses ou colchetes", test: (title) => /[()[\]]/.test(title) },
  { key: "starts_how", group: "forma", short: "começa com Como", label: "começa com \"Como\"", test: (title) => /^\s*(como|how)(?!\p{L})/iu.test(title) },
  { key: "question", group: "forma", short: "pergunta", label: "é uma pergunta", test: (title) => title.includes("?") },
  { key: "first_person", group: "forma", short: "primeira pessoa", label: "primeira pessoa", test: (title) => FIRST_PERSON_WORDS.test(title) || FIRST_PERSON_I.test(title) },
  { key: "without", group: "forma", short: "sem X", label: "\"sem X\"", test: (title) => /(?<!\p{L})(sem|without)\s+\p{L}/iu.test(title) },
  { key: "concrete_result", group: "gatilho", trigger: "resultado", short: "resultado", label: "resultado concreto (dinheiro, tempo, número com unidade)", test: matches(RESULT) },
  { key: "caps_word", group: "forma", short: "caixa alta", label: "uma palavra em caixa alta", test: capsWord },
  { key: "gap", group: "gatilho", trigger: "curiosidade", short: "lacuna", label: "lacuna (\"isso\", \"esse\", \"o segredo\", \"por que\", \"o X que\")", test: matches(GAP) },
  { key: "search", group: "gatilho", trigger: "busca direta", short: "busca direta", label: "busca direta (\"como\", \"passo a passo\", \"tutorial\", \"iniciantes\")", test: matches(SEARCH) },
  { key: "contrarian", group: "gatilho", trigger: "contrário", short: "contrário", label: "contra o senso comum (\"pare de\", \"não faça\", \"mito\", \"ninguém conta\")", test: matches(CONTRARIAN) },
  { key: "mistake", group: "gatilho", trigger: "custo ou erro", short: "erro", label: "custo ou erro (\"erro\", \"evite\", \"perdendo\", \"jogando fora\")", test: matches(MISTAKE) },
  { key: "experiment", group: "gatilho", trigger: "experimento ou história", short: "experimento", label: "experimento (\"testei\", \"por 30 dias\", \"desafio\")", test: matches(EXPERIMENT) },
  { key: "list", group: "gatilho", trigger: "lista", short: "lista", label: "lista (\"5 dicas\", \"3 erros\", \"top 10\")", test: matches(LIST) },
  { key: "comparison", group: "gatilho", trigger: "comparação", short: "comparação", label: "comparação (\"vs\", \"X x Y\", \"melhor que\", \"qual escolher\")", test: matches(COMPARISON) },
  { key: "you", group: "forma", short: "você", label: "fala com \"você\"", test: matches(YOU) },
  { key: "superlative", group: "forma", short: "superlativo", label: "superlativo (\"o melhor\", \"o pior\", \"mais fácil\")", test: matches(SUPERLATIVE) },
  { key: "year", group: "forma", short: "ano", label: "ano no título (\"2026\")", test: matches(YEAR) },
  { key: "two_parts", group: "forma", short: "duas partes", label: "duas partes (dois pontos, barra ou traço)", test: matches(TWO_PARTS) },
  { key: "emoji", group: "forma", short: "emoji", label: "emoji", test: matches(EMOJI) },
  { key: "stakes", group: "gatilho", trigger: "o que está em jogo", short: "em jogo", label: "o que está em jogo (\"apostei\", \"quase perdi\", \"larguei o emprego\")", test: matches(STAKES) },
  { key: "extreme", group: "gatilho", trigger: "extremo ou contraste", short: "extremo", label: "extremo ou contraste (\"R$ 10 contra R$ 1.000\", \"barato x caro\", \"do mundo\")", test: matches(EXTREME) },
  { key: "insider", group: "gatilho", trigger: "bastidor", short: "bastidor", label: "bastidor (\"por dentro\", \"bastidores\", \"o que o vendedor não mostra\")", test: matches(INSIDER) },
  { key: "callout", group: "gatilho", trigger: "chamado direto", short: "chamado", label: "chamado direto (\"se você\", \"para quem\", \"quem tem\")", test: matches(CALLOUT) },
  { key: "transformation", group: "gatilho", trigger: "transformação", short: "transformação", label: "transformação (\"antes e depois\", \"de 2 para 9\", \"do zero a\")", test: matches(TRANSFORMATION) },
];

/**
 * Names that look like tools or brands in the titles, to confirm before
 * passing them with --tools: a capitalized word after "com", "usando", "no",
 * "with", "using", or a word with a capital inside (ChatGPT) or a digit.
 */
export function suggestTools(titles, min = 2) {
  const counts = new Map();
  const add = (word, title) => {
    const key = word.replace(/[.,:;!?)\]]+$/, "");
    if (key.length < 2) return;
    if (!counts.has(key)) counts.set(key, new Set());
    counts.get(key).add(title);
  };
  for (const title of titles) {
    const found = new Set();
    // after "com", "usando", "usar"… or after an article in the middle of the title ("testei a Airfryer")
    for (const m of title.matchAll(/(?<!\p{L})(?:com|usando|usar|uso|no|na|with|using|use)\s+(?:o\s+|a\s+|the\s+)?(\p{Lu}[\p{L}\d.+-]*)/gu)) found.add(m[1]);
    for (const m of title.matchAll(/\s(?:o|a|the)\s(\p{Lu}[\p{L}\d.+-]*)/gu)) found.add(m[1]);
    // a capital inside the word (ChatGPT) or a version number (GPT-6, Fable 5.1)
    for (const m of title.matchAll(/(?<!\p{L})(\p{L}*\p{Ll}\p{Lu}[\p{L}\d]*|\p{Lu}[\p{L}]*(?:-\d[\d.]*|\s\d+\.\d[\d.]*))(?![\p{L}\d])/gu)) found.add(m[1]);
    for (const word of found) add(word, title);
  }
  return [...counts.entries()]
    .filter(([, set]) => set.size >= min)
    .sort((a, b) => b[1].size - a[1].size)
    .map(([word, set]) => ({ name: word, titles: set.size }));
}

const round = (value, digits = 2) => (typeof value === "number" && Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null);

/** The items that count: a title and a multiplier, and with `base: "channel"` only those measured against the channel's own median. */
function measuredItems(items, base) {
  return items.filter((item) => typeof item.multiplier === "number" && item.title && (base === "any" || item.base?.kind === base));
}

/** Median of each side and their ratio, the shape every table row shares. */
function compare(withItems, without, minN) {
  const withMedian = median(withItems.map((item) => item.multiplier));
  const withoutMedian = median(without.map((item) => item.multiplier));
  return {
    with: { n: withItems.length, median: round(withMedian) },
    without: { n: without.length, median: round(withoutMedian) },
    ratio: withMedian && withoutMedian ? round(withMedian / withoutMedian) : null,
    small_n: withItems.length < minN || without.length < minN,
  };
}

/**
 * The trait table for the items of an outliers.json (or of a channel read).
 * Only items with a multiplier count; `base: "channel"` keeps only those
 * measured against the channel's own median.
 */
export function traitTable(items, { tools = [], minN = 5, base = "any" } = {}) {
  const measured = measuredItems(items, base);
  const ctx = { tools: toolPattern(tools) };
  const rows = TRAITS.map((trait) => {
    const head = { trait: trait.key, label: trait.label, group: trait.group, trigger: trait.trigger ?? null };
    if (trait.key === "tool" && !ctx.tools) {
      return { ...head, skipped: true, note: "passe --tools com os nomes das ferramentas ou marcas do tema" };
    }
    const withTrait = measured.filter((item) => trait.test(item.title, ctx));
    const without = measured.filter((item) => !trait.test(item.title, ctx));
    return { ...head, ...compare(withTrait, without, minN) };
  });
  const lengths = measured.map((item) => [...item.title].length);
  const strong = measured.filter((item) => item.band === "explosive" || item.band === "outlier");
  const buckets = [
    ["até 40", 0, 40],
    ["41 a 60", 41, 60],
    ["61 a 80", 61, 80],
    ["acima de 80", 81, Infinity],
  ].map(([range, low, high]) => {
    const inside = measured.filter((item) => {
      const size = [...item.title].length;
      return size >= low && size <= high;
    });
    return { range, n: inside.length, median: round(median(inside.map((item) => item.multiplier))), small_n: inside.length < minN };
  });
  return {
    sample: { items: items.length, measured: measured.length, base },
    min_n: minN,
    tools: tools.filter(Boolean),
    traits: rows,
    length: {
      median_all: median(lengths),
      median_outliers: strong.length ? median(strong.map((item) => [...item.title].length)) : null,
      outliers_n: strong.length,
      buckets,
    },
  };
}

/**
 * The titles that went furthest above their channel's normal and those that
 * stayed below it, each with the traits it carries: the mechanism behind the
 * numbers, to read, never to copy.
 */
export function rankedTitles(items, { tools = [], base = "any", top = 15, bottom = 8 } = {}) {
  const ctx = { tools: toolPattern(tools) };
  const sorted = [...measuredItems(items, base)].sort((a, b) => b.multiplier - a.multiplier);
  const best = sorted.filter((item) => item.multiplier > 1).slice(0, top);
  const below = sorted.filter((item) => item.multiplier < 1 && !best.includes(item)).slice(-bottom).reverse();
  const describe = (item) => ({
    id: item.id ?? null,
    title: item.title,
    channel: item.channel ?? null,
    multiplier: item.multiplier,
    views: typeof item.views === "number" ? item.views : null,
    band: item.band ?? null,
    base: item.base?.kind ?? null,
    traits: TRAITS.filter((trait) => trait.test(item.title, ctx) === true).map((trait) => trait.key),
  });
  return { top_titles: best.map(describe), bottom_titles: below.map(describe) };
}

// Words that say nothing about the title's choice: articles, prepositions,
// pronouns, common verbs and the words the traits already measure ("como",
// "sem", "você", "eu").
const STOPWORDS = new Set(`
a à ao aos as às o os um uma uns umas de da das do dos d e é em no na nos nas num numa
para pra pro pros por pelo pela pelos pelas com sem que se ou mas mais menos muito muita muitos muitas
já só tão também assim bem como quando onde porque qual quais quem
isso esse essa esses essas este esta estes estas isto aquele aquela aqui ali lá
eu meu minha meus minhas me mim comigo você voce vc vocês seu sua seus suas te ti
nós nosso nossa ele ela eles elas lhe ser são sou foi era vai vão vou vamos tem têm ter
fazer faz faço fiz feito feita fazendo fica ficar ficou ficam pode podem posso está estão estou dá dar deu ver veja olha
the an of to in on at for from into onto about with without and or but than then just
is are was be it its it's this that these those can will get got
my your you you're i i'm i've me we our how what what's why which who vs x
`.split(/\s+/).filter(Boolean));

/** The words of a text, lowercased, with every number as "#". */
function words(text) {
  return String(text)
    .toLowerCase()
    .replace(/\d+(?:[.,]\d+)*/g, " # ")
    .split(/[^\p{L}#'’]+/u)
    .map((word) => word.replace(/^['’]+|['’]+$/g, ""))
    .filter(Boolean);
}

/**
 * Words and pairs of words found in at least `minN` titles, with the median
 * multiplier of the titles that have them and of those that don't. The words
 * of the searches are left out (every title has them), numbers count as "N",
 * and a word whose titles are exactly those of a pair is shown as the pair.
 */
export function termTable(items, { base = "any", minN = 5, queries = [], limit = 100 } = {}) {
  const measured = measuredItems(items, base);
  const searched = new Set(queries.flatMap((query) => words(query)));
  const presence = new Map();
  const note = (term, index) => {
    if (!presence.has(term)) presence.set(term, new Set());
    presence.get(term).add(index);
  };
  // A single letter ("R" of "R$ 400") is not a word; it breaks a pair like a stopword does.
  const empty = (token) => STOPWORDS.has(token) || (token !== "#" && [...token].length < 2);
  measured.forEach((item, index) => {
    const tokens = words(item.title);
    tokens.forEach((token, i) => {
      if (token !== "#" && !empty(token) && !searched.has(token)) note(token, index);
      const next = tokens[i + 1];
      if (!next || empty(token) || empty(next) || (token === "#" && next === "#")) return;
      if (searched.has(token) && searched.has(next)) return;
      note(`${token} ${next}`, index);
    });
  });
  const redundant = new Set();
  for (const [term, indexes] of presence) {
    if (!term.includes(" ") || indexes.size < minN) continue;
    for (const part of term.split(" ")) {
      if (presence.get(part)?.size === indexes.size) redundant.add(part);
    }
  }
  const rows = [];
  for (const [term, indexes] of presence) {
    if (indexes.size < minN || redundant.has(term)) continue;
    const withItems = measured.filter((_, index) => indexes.has(index));
    const without = measured.filter((_, index) => !indexes.has(index));
    rows.push({ term: term.replace(/#/g, "N"), ...compare(withItems, without, minN) });
  }
  return rows
    .sort((a, b) => (b.ratio ?? -1) - (a.ratio ?? -1) || b.with.n - a.with.n || a.term.localeCompare(b.term, "pt"))
    .slice(0, limit);
}

// A missing median (an empty group) leaves the cell with just its size: "(n=0)".
const decimal = (value) => (typeof value === "number" ? `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}×` : "");
const group = (side) => [decimal(side.median), `(n=${side.n})`].filter(Boolean).join(" ");
const cell = (text) => String(text ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const shortName = new Map(TRAITS.map((trait) => [trait.key, trait.short]));

function traitRows(rows, minN) {
  return rows.map((row) => (row.skipped
    ? `| ${row.label} |  |  | ${row.note} |`
    : `| ${row.label} | ${group(row.with)} | ${group(row.without)} | ${row.small_n ? `grupo pequeno (menos de ${minN}): indício` : ""} |`));
}

function titleRows(list) {
  return list.map((item) => {
    const where = [item.channel, item.base === "subscribers" ? "medido por inscritos" : item.base === null ? "sem base" : ""].filter(Boolean).join(", ");
    return `| ${decimal(item.multiplier)} | ${cell(item.title)} | ${cell(where)} | ${item.traits.map((key) => shortName.get(key)).join(", ")} |`;
  });
}

export function titlesMarkdown(result) {
  const fromChannel = result.source === "channel";
  const name = fromChannel ? result.channel?.name ?? result.channel?.handle ?? "o canal" : (result.queries ?? []).join(" · ");
  const sample = fromChannel
    ? `${result.sample.measured} vídeos do canal com multiplicador (de ${result.sample.items} lidos${result.read_at ? ` em ${result.read_at.slice(0, 10)}` : ""}). Aqui o multiplicador é quantas vezes o vídeo fez o normal deste canal, não do tema. As views da aba do canal vêm arredondadas pelo YouTube.`
    : `${result.sample.measured} títulos com multiplicador (de ${result.sample.items} na pesquisa${result.excluded?.length ? `, depois de tirar ${result.excluded.length} fora do tema` : ""}${result.sample.base === "channel" ? ", só os medidos pela mediana do canal" : ""}). O multiplicador é quantas vezes o vídeo fez o normal do próprio canal.`;
  const minN = result.min_n;
  const triggers = result.traits.filter((row) => row.group === "gatilho");
  const forms = result.traits.filter((row) => row.group !== "gatilho");
  const lines = [
    `# Títulos de alta performance: ${name}`,
    "",
    `${sample} As tabelas comparam a mediana dos títulos que têm o traço com a dos que não têm.`,
    "",
    "## Os títulos que mais passaram do normal",
    "",
  ];
  const top = result.top_titles ?? [];
  if (top.length) lines.push("| Multiplicador | Título | Canal | Traços |", "|---|---|---|---|", ...titleRows(top));
  else lines.push("Nenhum título com multiplicador nesta amostra.");
  const bottom = result.bottom_titles ?? [];
  if (bottom.length) {
    lines.push("", "## Os que ficaram abaixo do normal", "", "Para contraste: o que eles têm e os de cima não têm.", "", "| Multiplicador | Título | Canal | Traços |", "|---|---|---|---|", ...titleRows(bottom));
  }
  lines.push(
    "",
    "## Os gatilhos",
    "",
    "Os gatilhos de título como um script consegue ver nas palavras; entre parênteses, o que foi procurado.",
    "",
    "| Gatilho | Com o traço | Sem o traço | Aviso |",
    "|---|---|---|---|",
    ...traitRows(triggers, minN),
    "",
    "## A forma",
    "",
    "| Traço | Com o traço | Sem o traço | Aviso |",
    "|---|---|---|---|",
    ...traitRows(forms, minN),
  );
  const terms = result.terms ?? [];
  const above = terms.filter((row) => row.ratio !== null && row.ratio > 1).slice(0, 12);
  const under = terms.filter((row) => row.ratio !== null && row.ratio < 1).slice(-8).reverse();
  lines.push("", "## As palavras", "");
  if (above.length || under.length) {
    lines.push(
      `Palavras e pares de palavras que aparecem em pelo menos ${minN} títulos${fromChannel ? "" : ", sem as palavras das buscas"}. N é qualquer número.`,
      "",
      "| Palavra | Com a palavra | Sem a palavra | Aviso |",
      "|---|---|---|---|",
      ...[...above, ...under].map((row) => `| ${cell(row.term)} | ${group(row.with)} | ${group(row.without)} | ${row.small_n ? "grupo pequeno: indício" : ""} |`),
    );
  } else {
    lines.push(`Nenhuma palavra aparece em ${minN} títulos ou mais nesta amostra.`);
  }
  const length = result.length;
  const sizes = typeof length.median_all === "number"
    ? `Tamanho: mediana de ${length.median_all} caracteres na amostra${length.median_outliers ? ` e de ${length.median_outliers} nos outliers (n=${length.outliers_n})` : ""}. `
    : "";
  lines.push(
    "",
    "## O tamanho",
    "",
    `${sizes}O limite da plataforma é de 100 caracteres.`,
    "",
    "| Tamanho | Mediana do multiplicador | n |",
    "|---|---|---|",
    ...length.buckets.map((bucket) => `| ${bucket.range} | ${decimal(bucket.median)} | ${bucket.n}${bucket.small_n ? " (pequeno)" : ""} |`),
  );
  if (result.suggested_tools?.length) {
    lines.push("", `Nomes que parecem ferramentas ou marcas nestes títulos (confira antes de usar em --tools): ${result.suggested_tools.map((tool) => `${tool.name} (${tool.titles})`).join(", ")}.`);
  }
  lines.push(
    "",
    "## O que este dado não afirma",
    "",
    "- Descreve esta amostra, não o YouTube inteiro: outro tema ou outra janela dão outros números.",
    "- Mostra o que anda junto com os títulos que foram bem, não a causa. Um traço com mediana alta é uma pista para testar, nunca uma regra.",
    "- Grupo com menos títulos do que o mínimo é indício. Não existe número mágico de título.",
    "- Com muitos traços e palavras medidos na mesma amostra, algum parece forte por acaso. Vale mais o que se repete em duas leituras: duas pesquisas do tema, ou o tema e o canal.",
    "- Os títulos da lista mostram o mecanismo. Copiar um deles é o erro mais comum: o título nasce do canal de quem vai gravar.",
  );
  return `${lines.join("\n")}\n`;
}
