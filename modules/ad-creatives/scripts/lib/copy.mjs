// The check of the ad's text (copy): what blocks and what only warns.
// Blocks: a promise of result (sales, return, ROAS, CPA), a term the briefing forbids, and a
// sentence that states a personal condition of whoever sees the ad, which Meta's personal
// attributes policy refuses. Warns: the lengths of Meta's Ads Guide and an unknown button.

const L = "\\p{L}";
const before = `(?<![${L}\\p{N}])`;
const after = `(?![${L}\\p{N}])`;
const word = (body) => new RegExp(`${before}(?:${body})${after}`, "iu");
const words = (max) => `(?:[${L}\\p{N}]+[\\s,]+){0,${max}}?`;

/** A promise of result, with the reason the member reads. */
export const PROMISES = [
  { id: "guaranteed_result", pattern: word(`(?:resultados?|retorno|lucros?|vendas?|faturamento|clientes?|cura|emagrecimento|aprova[çc][ãa]o|sucesso)\\s+garantid[oa]s?`), say: "promete um resultado garantido" },
  { id: "guarantee_verb", pattern: word(`garant(?:o|imos|e|em|ido|ida)\\s+(?:que\\s+)?${words(4)}(?:vend|lucr|fatur|result|retorn|client|cur|emagre|aprov|ganh)[${L}]*`), say: "garante um resultado" },
  { id: "will_sell", pattern: word(`(?:vai|v[ãa]o|ir[áa]|ir[ãa]o)\\s+${words(2)}(?:vender|faturar|lucrar|dobrar|triplicar|multiplicar|bombar|explodir)`), say: "diz que vai vender ou faturar" },
  { id: "grow_sales", pattern: word(`(?:dobre|triplique|multiplique|aumente|turbine|exploda)\\s+${words(2)}(?:vendas|faturamento|lucros?|clientes|resultados?|pacientes|alunos)`), say: "promete aumentar vendas ou resultado" },
  { id: "return_metric", pattern: word(`(?:roas|roi|cpa|cac|cpl)\\s*(?:de\\s+|acima\\s+de\\s+|abaixo\\s+de\\s+|garantid[oa]\\s*|[<>]\\s*)?(?:r\\$\\s*)?\\d+(?:[.,]\\d+)?\\s*(?:x|%|vezes|reais)?`), say: "promete uma métrica de retorno (ROAS, ROI, CPA)" },
  { id: "result_number", pattern: word(`\\d+(?:[.,]\\d+)?\\s*(?:%|vezes|x)\\s+(?:mais\\s+)?(?:vendas|lucro|faturamento|clientes|resultados?|retorno|pacientes|alunos|leads)`), say: "afirma um número de resultado" },
  { id: "no_risk", pattern: word(`100\\s*%\\s*garantid[oa]|risco\\s+zero|sem\\s+nenhum\\s+risco|fique\\s+ric[oa]|renda\\s+garantida|dinheiro\\s+f[áa]cil`), say: "promete ganho sem risco" },
];

/** A sentence that states a personal condition of whoever reads it. */
export const PERSONAL = [
  { id: "suffers_from", pattern: word(`voc[êe]\\s+(?:sofre|sofreu|padece|convive|luta)\\s+(?:de|com)`), say: "afirma que quem vê sofre de algo" },
  { id: "you_are", pattern: word(`voc[êe]\\s+(?:[ée]|est[áa]|anda|vive|ficou)\\s+${words(2)}(?:endividad[oa]s?|obes[oa]s?|gord[oa]s?|acima\\s+do\\s+peso|depressiv[oa]s?|deprimid[oa]s?|ansios[oa]s?|diab[ée]tic[oa]s?|hipertens[oa]s?|calv[oa]s?|careca|inf[ée]rtil|est[ée]ril|divorciad[oa]s?|solteir[oa]s?|desempregad[oa]s?|falid[oa]s?|doente|viciad[oa]s?|alco[óo]latra|gr[áa]vida)`), say: "afirma uma condição pessoal de quem vê" },
  { id: "your_condition", pattern: word(`(?:seu|sua|seus|suas)\\s+(?:diabetes|depress[ãa]o|ansiedade|obesidade|calv[íi]cie|d[íi]vidas?|c[âa]ncer|doen[çc]a|v[íi]cio|infertilidade|hipertens[ãa]o|acne|celulite|queda\\s+de\\s+cabelo|ins[ôo]nia|religi[ãa]o|orienta[çc][ãa]o\\s+sexual)`), say: "fala da condição pessoal de quem vê como fato" },
  { id: "you_have", pattern: word(`voc[êe]\\s+tem\\s+${words(2)}(?:diabetes|depress[ãa]o|ansiedade|d[íi]vidas?|c[âa]ncer|calv[íi]cie|acne|celulite|obesidade|hipertens[ãa]o|ins[ôo]nia|enxaqueca|candid[íi]ase|herpes)`), say: "afirma que quem vê tem uma condição" },
  { id: "others_like_you", pattern: word(`(?:outros|outras)\\s+${words(2)}como\\s+voc[êe]`), say: "agrupa quem vê por uma característica pessoal" },
];

const fold = (text) => String(text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** The first rule of a list that a text breaks, with the quoted part. */
function firstMatch(text, rules) {
  for (const rule of rules) {
    const match = rule.pattern.exec(String(text ?? ""));
    if (match) return { rule: rule.id, quote: match[0], say: rule.say };
  }
  return null;
}

export const promiseIn = (text) => firstMatch(text, PROMISES);
export const personalIn = (text) => firstMatch(text, PERSONAL);

/** A forbidden term of the briefing found in a text (accents and case ignored, whole words). */
export function forbiddenIn(text, terms) {
  const folded = fold(text);
  for (const term of terms ?? []) {
    const clean = fold(term).trim();
    if (!clean) continue;
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    if (new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(folded)) return term;
  }
  return null;
}

const CTA_KEY = (text) => fold(text).replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Checks one concept's ad text and the texts its piece shows on screen. `limits` is
 * references/meta-anuncios.json. Returns { passed, problems, warnings, lengths }.
 */
export function checkCopy(concept, { limits, terms = [], screenTexts = [], numberSourced = false }) {
  const problems = [];
  const warnings = [];
  const copy = concept.copy ?? {};
  const fields = [
    ["primary_text", copy.primary_text],
    ["headline", copy.headline],
    ["description", copy.description],
    ["cta", copy.cta],
    ...screenTexts.map((text, index) => [`tela[${index}]`, text]),
  ];
  for (const [field, text] of fields) {
    if (typeof text !== "string" || !text.trim()) continue;
    const promise = promiseIn(text);
    if (promise && !(promise.rule === "result_number" && numberSourced)) problems.push({ field, rule: promise.rule, quote: promise.quote, say: `${field === "cta" ? "O botão" : "O texto"} ${promise.say}: "${promise.quote}". O app não promete nem prevê resultado; diga o que o produto faz.` });
    else if (promise) warnings.push({ field, rule: promise.rule, say: `"${promise.quote}" é um número de resultado: ele só vale com a fonte que está na prova do conceito. Confira se continua valendo no dia de publicar.` });
    const personal = personalIn(text);
    if (personal) problems.push({ field, rule: personal.rule, quote: personal.quote, say: `O texto ${personal.say}: "${personal.quote}". A Meta recusa anúncio que afirma ou sugere atributo pessoal de quem vê (saúde, finanças, religião, orientação). Fale da situação, não da pessoa: "Para quem atende o dia inteiro" em vez de "Você está esgotada".` });
    const term = forbiddenIn(text, terms);
    if (term) problems.push({ field, rule: "forbidden_term", quote: term, say: `"${term}" está entre os termos que o briefing proíbe.` });
  }
  const primary = String(copy.primary_text ?? "").trim();
  const visible = limits?.text?.primary_text?.visible_chars ?? 125;
  const reels = limits?.text?.primary_text?.reels_visible_chars ?? null;
  if (primary.length > visible) warnings.push({ field: "primary_text", rule: "primary_cut", say: `O texto principal tem ${primary.length} caracteres; o feed mostra ${visible} antes do ver mais e corta em "${primary.slice(0, visible).trim()}". O gancho precisa estar antes do corte.` });
  if (reels && primary.length > reels) warnings.push({ field: "primary_text", rule: "reels_cut", say: `Nos Reels aparecem os primeiros ${reels} caracteres: "${primary.slice(0, reels).trim()}".` });
  const headline = String(copy.headline ?? "").trim();
  const headlineMax = limits?.text?.headline?.max_chars ?? null;
  if (headlineMax && headline.length > headlineMax) warnings.push({ field: "headline", rule: "headline_cut", say: `O título tem ${headline.length} caracteres; o Guia de Anúncios da Meta recomenda até ${headlineMax}, e o resto pode ser cortado no feed do Facebook.` });
  const description = String(copy.description ?? "").trim();
  const descriptionMax = limits?.text?.description?.max_chars ?? null;
  if (descriptionMax && description.length > descriptionMax) warnings.push({ field: "description", rule: "description_cut", say: `A descrição tem ${description.length} caracteres; o limite recomendado é ${descriptionMax}.` });
  if (copy.cta) {
    const known = (limits?.cta ?? []).some((label) => CTA_KEY(label) === CTA_KEY(copy.cta));
    if (!known) warnings.push({ field: "cta", rule: "cta_unknown", say: `"${copy.cta}" não está na lista de botões da Meta: o Gerenciador oferece ${(limits?.cta ?? []).slice(0, 6).join(", ")} e outros. Use um da lista.` });
  } else warnings.push({ field: "cta", rule: "cta_missing", say: "O conceito não diz qual botão o anúncio usa; sem isso, o Gerenciador usa Saiba mais." });
  return { passed: problems.length === 0, problems, warnings, lengths: { primary_text: primary.length, headline: headline.length, description: description.length } };
}
