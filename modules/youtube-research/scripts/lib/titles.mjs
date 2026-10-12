// Title traits measured against the multiplier of a research sample: for each
// trait, the median multiplier of the titles that have it and of those that
// don't. It describes this sample; it proves no cause.

import { median } from "./score.mjs";

const FIRST_PERSON_WORDS = /(?<!\p{L})(eu|meu|minha|meus|minhas|comigo|testei|fiz|criei|usei|ganhei|perdi|aprendi|descobri|comprei|tentei|montei|deixei|pedi|gastei|transformei|constru[íi]|larguei|parei|comecei|estudei|vendi|troquei|mudei|fui|my|me|i'm|i've)(?!\p{L})/iu;
const FIRST_PERSON_I = /(?<!\p{L})I(?!\p{L})/u;
const RESULT = /(R\$|US\$|\$|€)\s?\d|\d+(?:[.,]\d+)?\s?(%|k(?!\p{L})|mil(?!\p{L})|mi(?!\p{L})|milh|reais|d[óo]lares|dollars|minutos?|minutes?|min(?!\p{L})|horas?|hours?|h(?!\p{L})|dias?|days?|semanas?|weeks?|meses|months?|anos?|years?|vezes|times|x(?!\p{L})|views|visualiza|seguidores|followers|inscritos|subscribers|clientes|clients|vendas|sales|kg|quilos)/iu;

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

export const TRAITS = [
  { key: "number", label: "tem número", test: (title) => /\d/.test(title) },
  { key: "tool", label: "nome de ferramenta ou marca", test: (title, ctx) => (ctx.tools ? ctx.tools.test(title) : null) },
  { key: "brackets", label: "parênteses ou colchetes", test: (title) => /[()[\]]/.test(title) },
  { key: "starts_how", label: "começa com \"Como\"", test: (title) => /^\s*(como|how)(?!\p{L})/iu.test(title) },
  { key: "question", label: "é uma pergunta", test: (title) => title.includes("?") },
  { key: "first_person", label: "primeira pessoa", test: (title) => FIRST_PERSON_WORDS.test(title) || FIRST_PERSON_I.test(title) },
  { key: "without", label: "\"sem X\"", test: (title) => /(?<!\p{L})(sem|without)\s+\p{L}/iu.test(title) },
  { key: "concrete_result", label: "resultado concreto (dinheiro, tempo, número com unidade)", test: (title) => RESULT.test(title) },
  { key: "caps_word", label: "uma palavra em caixa alta", test: capsWord },
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

/**
 * The trait table for the items of an outliers.json. Only items with a
 * multiplier count; `base: "channel"` keeps only those measured against the
 * channel's own median.
 */
export function traitTable(items, { tools = [], minN = 5, base = "any" } = {}) {
  const measured = items.filter((item) => typeof item.multiplier === "number" && item.title && (base === "any" || item.base?.kind === base));
  const ctx = { tools: toolPattern(tools) };
  const rows = TRAITS.map((trait) => {
    if (trait.key === "tool" && !ctx.tools) {
      return { trait: trait.key, label: trait.label, skipped: true, note: "passe --tools com os nomes das ferramentas ou marcas do tema" };
    }
    const withTrait = measured.filter((item) => trait.test(item.title, ctx));
    const without = measured.filter((item) => !trait.test(item.title, ctx));
    const withMedian = median(withTrait.map((item) => item.multiplier));
    const withoutMedian = median(without.map((item) => item.multiplier));
    return {
      trait: trait.key,
      label: trait.label,
      with: { n: withTrait.length, median: round(withMedian) },
      without: { n: without.length, median: round(withoutMedian) },
      ratio: withMedian && withoutMedian ? round(withMedian / withoutMedian) : null,
      small_n: withTrait.length < minN || without.length < minN,
    };
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

const decimal = (value) => (typeof value === "number" ? `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}×` : "—");

export function titlesMarkdown(result) {
  const lines = [
    `# Traços de título: ${result.queries.join(" · ")}`,
    "",
    `${result.sample.measured} títulos com multiplicador (de ${result.sample.items} na pesquisa${result.excluded?.length ? `, depois de tirar ${result.excluded.length} fora do tema` : ""}${result.sample.base === "channel" ? ", só os medidos pela mediana do canal" : ""}). O multiplicador é quantas vezes o vídeo fez o normal do próprio canal. A tabela compara a mediana dos títulos que têm o traço com a dos que não têm.`,
    "",
    "| Traço | Com o traço | Sem o traço | Aviso |",
    "|---|---|---|---|",
  ];
  for (const row of result.traits) {
    if (row.skipped) {
      lines.push(`| ${row.label} | — | — | ${row.note} |`);
      continue;
    }
    lines.push(`| ${row.label} | ${decimal(row.with.median)} (n=${row.with.n}) | ${decimal(row.without.median)} (n=${row.without.n}) | ${row.small_n ? `grupo pequeno (menos de ${result.min_n}): indício` : ""} |`);
  }
  const length = result.length;
  lines.push(
    "",
    `Tamanho: mediana de ${length.median_all ?? "—"} caracteres na amostra${length.median_outliers ? ` e de ${length.median_outliers} nos outliers (n=${length.outliers_n})` : ""}. O limite da plataforma é de 100 caracteres.`,
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
  );
  return `${lines.join("\n")}\n`;
}
