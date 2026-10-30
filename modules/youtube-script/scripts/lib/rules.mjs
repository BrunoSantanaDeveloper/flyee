// The checks a script must pass before recording, in Brazilian Portuguese.
// Deterministic on purpose: the same script always gets the same verdict.
// Severity: "blocker" (fix before recording), "warn" (fix or justify), "info" (look at it).

import { countWords, sentences } from "./script.mjs";

/** Openings that make the viewer leave in the first seconds. */
export const DEAD_OPENERS = [
  [/\b(fala|ol[áa]|oi|e a[íi]),? (galera|pessoal|gente|turma|meu povo|time)\b/i, "saudação de abertura"],
  [/\bsejam? (muito )?bem[- ]vind[oa]s?\b|\bbem[- ]vind[oa]s? (ao|de volta)\b/i, "boas-vindas"],
  [/\b(neste|nesse|no) v[íi]deo( de hoje)?,? (eu )?(vou|vamos|irei|quero)\b|\bhoje (eu )?(vou|vamos|quero) (te |lhe )?(mostrar|falar|ensinar|contar)\b/i, "anúncio do que o vídeo vai fazer"],
  [/\bantes de (come[çc]ar|mais nada)\b/i, "\"antes de começar\""],
  [/\bmeu nome [ée](?!\p{L})|\bpara quem (ainda )?n[ãa]o me conhece\b/iu, "apresentação pessoal"],
  [/\btudo bem com (voc[êe]s|vc)\b|\bcomo voc[êe]s est[ãa]o\b/i, "pergunta de cortesia"],
  [/\bvoc[êe] j[áa] (se perguntou|parou para pensar)\b|\bvoc[êe] sabia que\b/i, "pergunta genérica"],
  [/\bimagin[ea] (um mundo|s[óo](?!\p{L})|que\b)|\be se eu (te|lhe) dissesse\b/iu, "fórmula batida"],
  [/\b(eu )?gostaria de (compartilhar|falar|mostrar|apresentar)\b|\bvou (te |lhe )?contar uma hist[óo]ria\b|(?<!\p{L})[ée] uma honra\b/iu, "anúncio em vez de começar"],
];

/** Asks that belong after the viewer got something, never in the opening. */
export const EARLY_CTA = /\b(inscrev\w*|se inscreve\w*|deix[ae] (o |seu |aquele )?like|ativ[ae] o sininho|curt[ae] (o|esse) v[íi]deo|compartilh\w*)/i;

/** Tics that make a text sound written by an AI, in Portuguese. */
export const AI_TELLS = [
  [/\bn[ãa]o [ée] (s[óo]|apenas|somente) [^.!?]{1,60}[,;—–-] ?(mas )?[ée](?!\p{L})/iu, "\"não é só X, é Y\""],
  [/\bn[ãa]o [ée] sobre [^.!?]{1,60}[,;.—–-] ?(mas )?[ée] sobre\b/iu, "\"não é sobre X, é sobre Y\""],
  [/,\s*e n[ãa]o (?:um |uma |o |a |os |as |de |do |da |pra |para |com |em )?[\p{L}-]+(?: [\p{L}-]+){0,3}[.!?]/iu, "\"X, e não Y\" no fim da frase"],
  [/,\s*e n[ãa]o (?:um|uma|o|a|os|as) [\p{L}-]+(?: [\p{L}-]+){4,7}[.!?]/iu, "\"X, e não Y\" no fim da frase"],
  [/\bn[ãa]o [ée] (?:o|a|os|as) [^.!?]{1,40}\.\s*(?:[ée]|s[ãa]o) (?:o|a|os|as|um|uma|uns|umas)(?!\p{L})/iu, "\"não é o X. É o Y\""],
  [/\bfaz(?:em)? (?:toda a |a )diferen[çc]a\b/iu, "\"faz toda a diferença\""],
  [/\bat[ée] aqui,? (?:voc[êe] )?(?:j[áa] )?(?:viu|vimos)\b/iu, "recapitulação no meio do vídeo"],
  [/\bn[ãa]o se trata (s[óo]|apenas) de\b/i, "\"não se trata apenas de\""],
  [/\bn[ãa]o (?:est[áa]|mora|fica) n[oa]s? [^.!?]{1,50}[.;,]\s*(?:ele |ela )?(?:est[áa]|mora|fica) n[oa]s?(?!\p{L})/iu, "\"não está no X. Está no Y\""],
  [/\bvamos mergulhar\b|\bmergulh(ar|e|amos) (fundo|de cabeça)\b/i, "\"vamos mergulhar\""],
  [/\bno mundo (de hoje|atual|acelerado|moderno|digital)\b|\bnos dias (de hoje|atuais)\b|\bcada vez mais (importante|comum)\b/i, "abertura genérica de época"],
  [/(?<!\p{L})[ée] (importante|fundamental|essencial) (ressaltar|destacar|lembrar|frisar|notar)\b|\bvale (ressaltar|destacar|lembrar|notar) que\b/iu, "\"é importante ressaltar\""],
  [/\bem (suma|resumo)\b|\bsem mais delongas\b|\bresumindo tudo\b/i, "fecho de redação"],
  [/\bdivisor de [áa]guas\b|\bgame[- ]?changer\b|\brevolucion[áa]ri[oa]s?\b|\bdesbloque(ar|ie|ia)\b|\bpotencializ\w*|\balavanc(ar|e|a)\b|\bsinergia\b|\bjornada\b/i, "palavra de marketing gasta"],
  [/\bisso muda tudo\b|\b(muda|mudar|mudou) o jogo\b|\bapertem os cintos\b|\bprepare-se\b/i, "promessa de efeito"],
  [/\be o melhor( de tudo)?\??:/i, "\"e o melhor:\""],
  [/\b(aqui|e aqui) est[áa] (o|a) (pulo do gato|segredo|ponto|quest[ãa]o)\b/i, "\"aqui está o segredo\""],
];

/** A sentence of a course outline: "Aqui você vai ver…", "Você vai entender…", "E vai levar…". */
const SYLLABUS = /^(?:e |aqui |ent[ãa]o |depois |no fim |neste v[íi]deo |nesse v[íi]deo )?,?\s*(?:voc[êe] )?vai (?:ver|entender|aprender|levar|descobrir|conhecer|sair sabendo)(?!\p{L})/iu;

/** Connectors of written text: on camera they sound like reading. */
export const WRITTEN_STYLE = /\b(ademais|outrossim|por conseguinte|destarte|haja vista|tendo em vista|no que tange|no tocante|mediante|cujos?|cujas?|todavia|contudo|entretanto|dessa forma|desse modo|sendo assim)\b/i;

/** Endings that stop on the goodbye instead of the next step. */
export const DEAD_OUTRO = /(?<!\p{L})([ée] isso (a[íi] )?(pessoal|galera|gente)|por hoje [ée] (s[óo]|isso)|obrigad[oa] por (assistir|ter assistido)|at[ée] o pr[óo]ximo v[íi]deo|um abra[çc]o e at[ée](?!\p{L}))/iu;

/** Text still to be written or checked. A source mark with content ([fonte: …]) is not one. */
export const PLACEHOLDERS = [
  /\[\s*(?:confirmar|preencher|escolher)\b[^\]]*\]/i,
  /\[\s*(?:fonte|dado)\s*\??\s*\]/i,
  /\[\s*(?:TODO|XXX)\b[^\]]*\]|\bTODO\b|\bXXX\b|\?\?\?/, // uppercase only: "todo" is a Portuguese word
  /\blorem ipsum\b/i,
];

const SPELLED = "(?:um|uma|dois|duas|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem)";

/**
 * Claims that need a source: statistics, comparisons, averages, "studies show".
 * The creator's own numbers count too: they are marked [fonte: o criador].
 */
export const CLAIMS = [
  new RegExp(String.raw`\b(?:\d+(?:[.,]\d+)?|${SPELLED}(?: e ${SPELLED})?)\s?(?:%|por ?cento\b)`, "iu"),
  new RegExp(String.raw`\b(?:\d+|${SPELLED})\s+(?:em|de) cada\s+(?:\d+|dez|cem|mil)\b`, "iu"),
  /\b\d+(?:[.,]\d+)?\s?(?:vezes\b|x\b|mil\b|milh(?:[ãa]o|[õo]es)\b|bilh(?:[ãa]o|[õo]es)\b)/iu,
  /\b(?:o dobro|o triplo|a metade|a maioria (?:das|dos) |(?:dobr|triplic|quadruplic|multiplic)(?:ou|aram|amos)\b|dobrei\b|tripliquei\b)/iu,
  /\b(?:em m[ée]dia|o mercado (?:paga|cobra)|(?:milhares|centenas|milh[õo]es) de)\b/iu,  /\b(?:estudos|pesquisas|cientistas|especialistas|dados|n[úu]meros) (?:mostram|comprovam|provam|apontam|dizem|indicam|revelam)\b|\bsegundo (?:estudos|pesquisas|especialistas)\b|\bcomprovad[oa] cientificamente\b/iu,
];
export const SOURCE_MARK = /\[\s*fonte\s*:[^\]]+\]/i;

/** A promised result stated as certain: money, weight, health. Never allowed. */
const RESULT = /\b(?:ganh|fatur|lucr|emagrec|perd|cur|elimin|enriquec|dobr|tripl|multiplic)\w*/iu;
const CERTAIN = /\b(?:garantid[oa]s?|com certeza|certeza absoluta|sem erro|sem falha|sem risco|100% (?:garantid\w*|certo|dos casos)|(?:cem|100) por cento (?:garantid\w*|certo))/iu;

/**
 * "Nobody shows this", "there is no video about it": a claim of absence needs
 * the search behind it and its scope ("em português", "nas minhas buscas").
 * "Quase ninguém" is an opinion, not an absence claim.
 */
export const ABSENCE = /(?<!quase\s)(?<!\p{L})(ningu[ée]m (?:mostra|ensina|fala|faz|fez|usa|explica|est[áa] fazendo|t[áa] fazendo)|n[ãa]o existe (?:nenhum|nenhuma|nada)|n[ãa]o (?:tem|h[áa]) (?:nenhum|nenhuma)|nenhum (?:v[íi]deo|canal|criador|tutorial|curso)|[ée] o [úu]nico (?:v[íi]deo|canal|criador|tutorial|curso|app|lugar|jeito|que (?:mostra|ensina|fala|faz|explica|tem))|ningu[ée]m no (?:youtube|brasil|mundo))(?!\p{L})/iu;
export const ABSENCE_SCOPE = /em portugu[êe]s|nas minhas buscas|na minha busca|nas buscas que eu fiz|que eu (?:achei|vi|encontrei|pesquisei)|at[ée] onde eu (?:sei|vi|pesquisei)|\[\s*fonte\s*:|\[\s*confirmar/iu;

/** Words of an ad: they do not belong in the speech outside a sponsor block. */
export const SALES_PITCH = /(?<!\p{L})(cupom|use o c[óo]digo|link com desconto|garanta (?:j[áa]|o seu|a sua)|aproveite (?:a|essa|esta) (?:oferta|promo[çc][ãa]o)|por apenas|s[óo] hoje|vagas limitadas|[úu]ltimas vagas|compre (?:agora|j[áa])|clique e compre|baix[ae] (?:agora|j[áa]))(?!\p{L})/iu;
const SPONSOR_SECTION = /^(publi|patroc[íi]nio|an[úu]ncio|parceiro|merchan)/i;

/**
 * In a video about something of the creator's own (the briefing says so):
 * price, plan, version, "free" and store talk make it sound like an ad.
 * The cost of other tools ("a assinatura do editor, que eu já pago") is not this.
 */
export const OWN_PITCH = /(?<!\p{L})((?:[ée]|fica|sai|t[áa]) (?:totalmente |100% )?(?:gr[áa]tis|gratuit[oa]|de gra[çc]a)|gr[áa]tis at[ée]|plano (?:fam[íi]lia|pro|premium|b[áa]sico|gratuito|pago|anual|mensal|individual)|(?:R\$|US\$)\s?\d|por m[êe]s|ao m[êe]s|mensalidade|vers[ãa]o (?:nova|gr[áa]tis|gratuita|paga|completa|pro|premium|para (?:computador|celular|pc))|nova vers[ãa]o|na (?:loja|app store|play store|google play))(?!\p{L})/iu;

/**
 * The creator's "Nunca dizer" list from canal.md ("## Regras do criador" ›
 * "### Nunca dizer"): one term per bullet, between quotes when it has more
 * than a word; the reason in parentheses is ignored.
 */
export function creatorRules(text) {
  const rules = { never_say: [], never_do: [] };
  let list = null;
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (/^#{2,}\s/.test(line)) {
      list = /nunca dizer/i.test(line) ? "never_say" : /nunca fazer/i.test(line) ? "never_do" : null;
      continue;
    }
    if (!list || !/^[-*]\s+/.test(line)) continue;
    const item = line.replace(/^[-*]\s+/, "");
    if (list === "never_do") {
      rules.never_do.push(item);
      continue;
    }
    const quoted = /^["“”'‘]([^"“”'’]+)["“”'’]/.exec(item);
    const term = (quoted ? quoted[1] : item.split(/\s+[(—–-]\s*|:\s/)[0]).trim();
    if (term) rules.never_say.push(term);
  }
  return rules;
}

function termPattern(term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![\\p{L}\\d])${escaped}(?![\\p{L}\\d])`, "iu");
}

/**
 * The triggers of the packaging guide (embalagem.md), with the short names a
 * title line may use for them. Only "busca direta" says what the video is
 * about; every other one gives a reason to click.
 */
export const TRIGGERS = [
  ["resultado"],
  ["curiosidade", "lacuna"],
  ["busca direta", "busca"],
  ["contrário", "contrario", "contra o senso comum"],
  ["custo ou erro", "erro", "custo"],
  ["experimento ou história", "experimento", "história", "historia"],
  ["lista"],
  ["comparação", "comparacao"],
  ["o que está em jogo", "em jogo", "aposta", "risco"],
  ["extremo ou contraste", "extremo", "contraste"],
  ["bastidor", "bastidores"],
  ["chamado direto", "chamado"],
  ["transformação", "transformacao", "antes e depois"],
];
const SEARCH_TRIGGER = "busca direta";
const plainWords = (text) => String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const TRIGGER_NAMES = new Map(TRIGGERS.flatMap(([name, ...aliases]) => [name, ...aliases].map((alias) => [plainWords(alias), name])));

/** The triggers written after "gatilho:" on a title line: "chamado direto + contrário" gives both; a name outside the table is kept apart. */
function declaredTriggers(line) {
  const m = /gatilhos?\s*:\s*\**([^·|\n]*)/i.exec(line);
  if (!m) return { labeled: false, declared: [], unknown: [] };
  const declared = [];
  const unknown = [];
  for (const part of m[1].replace(/\(.*?\)/g, "").split(/\s*[+,/]\s*/)) {
    const word = plainWords(part.replace(/\*+/g, ""));
    if (!word) continue;
    const name = TRIGGER_NAMES.get(word);
    if (name) {
      if (!declared.includes(name)) declared.push(name);
    } else {
      unknown.push(part.trim());
    }
  }
  return { labeled: true, declared, unknown };
}

/**
 * Titles of embalagem.md: the numbered lines under "## Títulos", each title
 * between quotes, and the triggers written after "gatilho:" on the same line.
 */
export function packagingTitles(text) {
  const titles = [];
  const triggers = [];
  let inside = false;
  let unquoted = 0;
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (/^#{1,6}\s/.test(line)) {
      inside = /^#{1,6}\s+t[íi]tulos\b/i.test(line);
      continue;
    }
    if (!inside || !/^\d+[.)]\s+/.test(line)) continue;
    const m = /["“]([^"“”]+)["”]/.exec(line);
    if (!m) {
      unquoted += 1;
      continue;
    }
    titles.push(m[1].trim());
    triggers.push(declaredTriggers(line.slice(m.index + m[0].length)));
  }
  return { titles, unquoted, triggers };
}

/**
 * The strength of the titles, by the triggers they declare: the chosen title
 * with only "busca direta" says what the video is about and gives no reason to
 * click; five titles with fewer than four triggers are versions of one phrase.
 */
export function triggerIssues(titles, triggers, chosen) {
  const issues = [];
  const unlabeled = triggers.filter((item) => !item.labeled).length;
  if (unlabeled) {
    issues.push({ rule: "title_trigger_missing", severity: "info", excerpt: "", message: `${unlabeled} título(s) de embalagem.md sem o gatilho: não consegui conferir a força deles.`, fix: "Escreva o gatilho da tabela depois do título: 1. \"o título\" · gatilho: curiosidade (dois, com +)." });
  }
  const unknown = [...new Set(triggers.flatMap((item) => item.unknown))];
  if (unknown.length) {
    issues.push({ rule: "title_trigger_unknown", severity: "info", excerpt: unknown.join(", "), message: `Gatilho fora da tabela de embalagem.md: ${unknown.join(", ")}.`, fix: `Use um nome da tabela: ${TRIGGERS.map(([name]) => name).join(", ")}.` });
  }
  const primary = triggers.map((item) => item.declared[0]).filter(Boolean);
  const distinct = new Set(primary);
  if (titles.length >= 5 && primary.length >= 5 && distinct.size < 4) {
    issues.push({ rule: "titles_same_trigger", severity: "warn", excerpt: [...distinct].join(", "), message: `Os ${titles.length} títulos usam só ${distinct.size} gatilho(s) (${[...distinct].join(", ")}): são versões da mesma frase.`, fix: "Troque os repetidos por títulos de outras linhas da tabela de embalagem.md, como o que está em jogo, o contraste, o bastidor, o chamado direto ou a transformação." });
  }
  const index = chosen ? titles.indexOf(chosen) : -1;
  const declared = index >= 0 ? triggers[index]?.declared ?? [] : [];
  if (declared.length && declared.every((name) => name === SEARCH_TRIGGER)) {
    issues.push({ rule: "title_descriptive", severity: "warn", excerpt: chosen, message: "O título escolhido só tem o gatilho busca direta: diz do que o vídeo trata, sem um motivo para clicar.", fix: "Depois das palavras da busca, acrescente uma alavanca que o vídeo paga (o resultado, o erro, o prazo, o \"sem X\"), ou escolha outro título de embalagem.md." });
  }
  return issues;
}

/**
 * Thumbnails of embalagem.md: the lines under "## Thumbnails" that start with
 * a letter ("A. Imagem: … · Texto: "…""), with the on-image text between
 * quotes after "Texto:". A thumbnail without text has `text: null`.
 */
export function packagingThumbnails(text) {
  const items = [];
  let inside = false;
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (/^#{1,6}\s/.test(line)) {
      inside = /^#{1,6}\s+thumbnails?\b/i.test(line);
      continue;
    }
    const m = /^(?:[-*]\s+)?\**([A-E])[.):,]\**\s+(.*)$/.exec(line);
    if (!inside || !m) continue;
    const quoted = /texto\s*:\s*\**\s*["“]([^"“”]+)["”]/i.exec(m[2]);
    items.push({ letter: m[1], text: quoted ? quoted[1].trim() : null });
  }
  return items;
}

/**
 * The title chosen under "## Escolha" of embalagem.md: "Título 2 com a
 * thumbnail A", or one of the titles written out between quotes. Other quoted
 * words there are the reasons ("usa o traço \"sem X\""), never the title.
 */
export function packagingChoice(text, titles = []) {
  const section = /^#{1,6}\s+escolha\b[^\n]*\n([\s\S]*?)(?=^#{1,6}\s|$(?![\s\S]))/im.exec(String(text ?? ""))?.[1] ?? "";
  const number = /t[íi]tulo\s+(\d+)/i.exec(section)?.[1];
  if (number && titles[Number(number) - 1]) return titles[Number(number) - 1];
  const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
  for (const m of section.matchAll(/["“]([^"“”]+)["”]/g)) {
    const title = titles.find((candidate) => same(candidate, m[1]));
    if (title) return title;
  }
  return null;
}

const NUMBER_WORDS = { 1: "um|uma", 2: "dois|duas", 3: "tr[êe]s", 4: "quatro", 5: "cinco", 6: "seis", 7: "sete", 8: "oito", 9: "nove", 10: "dez", 20: "vinte", 30: "trinta", 40: "quarenta", 50: "cinquenta", 60: "sessenta", 90: "noventa", 100: "cem" };
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * What a title names that the speech has to say: its numbers (in digits or
 * words), its words in capitals ("IA", "CLT") and its proper names, a
 * capitalized word that does not open the title or a sentence. A title in
 * Title Case has no telling capitals, so only its numbers and acronyms count.
 */
export function titlePromises(title) {
  const text = String(title ?? "");
  const terms = [];
  const seen = new Set();
  const add = (term, pattern) => {
    if (seen.has(term.toLowerCase())) return;
    seen.add(term.toLowerCase());
    terms.push({ term, pattern });
  };
  for (const m of text.matchAll(/\d+(?:[.,]\d+)?/g)) {
    // A year ("de 2026") promises freshness, not something the speech has to say.
    if (/^(19|20)\d\d$/.test(m[0])) continue;
    const words = NUMBER_WORDS[Number(m[0].replace(",", "."))];
    add(m[0], new RegExp(`(?<![\\p{L}\\d])(?:${escapeRegex(m[0]).replace(/[.,]/g, "[.,]")}${words ? `|${words}` : ""})(?![\\p{L}\\d])`, "iu"));
  }
  // "US$" is money, not an acronym. An acronym ("IA", "MEI") is said as it is; a word
  // in capitals for emphasis ("ANIMADOS") counts by its stem, so "animado" pays it.
  for (const m of text.matchAll(/(?<!\p{L})\p{Lu}{2,}(?![\p{L}$])/gu)) {
    const letters = [...m[0]];
    const stem = letters.length >= 5 ? `${escapeRegex(letters.slice(0, -2).join(""))}\\p{L}*` : letters.length === 4 ? `${escapeRegex(m[0])}\\p{L}{0,2}` : escapeRegex(m[0]);
    add(m[0], new RegExp(`(?<!\\p{L})${stem}(?!\\p{L})`, "iu"));
  }
  const words = text.split(/\s+/).filter(Boolean);
  const capitalized = words.filter((word) => /^[^\p{L}]*\p{Lu}\p{Ll}/u.test(word)).length;
  if (capitalized <= words.length / 2) {
    words.forEach((word, index) => {
      const clean = word.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, "");
      if (index === 0 || /[.:?!|]$/.test(words[index - 1])) return;
      if (!/^\p{Lu}\p{Ll}/u.test(clean) || [...clean].length < 3) return;
      add(clean, new RegExp(`(?<![\\p{L}\\d])${escapeRegex(clean)}(?:e?s)?(?![\\p{L}\\d])`, "iu"));
    });
  }
  return terms;
}

/**
 * The title's promise in the speech: each number, acronym and name of the
 * chosen title, said before the last third of the script (where embalagem.md
 * says the video pays). Returns what is missing there, and whether it comes later.
 */
export function titleCoverage(script, title) {
  const terms = titlePromises(title);
  if (!terms.length) return [];
  const words = script.sections.flatMap((section) => section.paragraphs.map((paragraph) => paragraph.text)).join(" ").split(/\s+/).filter(Boolean);
  const early = words.slice(0, Math.ceil((words.length * 2) / 3)).join(" ");
  const all = words.join(" ");
  return terms.filter((item) => !item.pattern.test(early)).map((item) => ({ term: item.term, later: item.pattern.test(all) }));
}

const THUMB_STOPWORDS = new Set(["como", "para", "pra", "sobre", "mais", "você", "voce", "isso", "esse", "essa", "este", "esta", "quando", "porque", "depois", "antes", "então", "entao", "também", "tambem", "muito", "cada", "todo", "toda", "mesmo", "aqui", "agora", "with", "your", "this", "that", "from"]);
const plain = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function contentWords(text) {
  return String(text ?? "")
    .split(/[^\p{L}\d]+/u)
    .filter((word) => /\d/.test(word) || [...word].length >= 4)
    .map(plain)
    .filter((word) => !THUMB_STOPWORDS.has(word));
}

/**
 * The on-image text of each thumbnail: at most four words, and words of its
 * own. The thumbnail says what the title does not: two words of the chosen
 * title on the image, or a text made only of title words, is a warning; one
 * shared word is a note.
 */
export function thumbnailIssues(thumbnails, chosen) {
  const issues = [];
  const titleWords = new Set(chosen ? contentWords(chosen) : []);
  for (const thumb of thumbnails) {
    if (!thumb.text) continue;
    const count = thumb.text.split(/\s+/).filter((word) => /[\p{L}\d]/u.test(word)).length;
    if (count > 4) {
      issues.push({ rule: "thumbnail_text_long", severity: "warn", excerpt: thumb.text, message: `O texto da thumbnail ${thumb.letter} tem ${count} palavras: no tamanho de um celular, mais de quatro não se lê.`, fix: "Corte o texto para até quatro palavras em embalagem.md, ou deixe a imagem falar sem texto." });
    }
    const own = [...new Set(contentWords(thumb.text))];
    const repeated = own.filter((word) => titleWords.has(word));
    if (repeated.length) {
      const severity = repeated.length >= 2 || repeated.length === own.length ? "warn" : "info";
      issues.push({ rule: "thumbnail_repeats_title", severity, excerpt: thumb.text, message: `O texto da thumbnail ${thumb.letter} repete o título escolhido (${repeated.join(", ")}).`, fix: "A thumbnail diz o que o título não diz: troque a palavra, ou mostre a situação sem texto." });
    }
  }
  return issues;
}

const CTA_ASK = /\b(inscrev\w*|deix[ae] (o |seu )?like|sininho|coment[ae]\w*|link na descri[çc][ãa]o|compartilh\w*|baix[ae]\w*|clique|acesse|entre no|me siga|segue)/gi;

const LONG_SENTENCE = 30;
const LONG_PARAGRAPH = 90;
const SHORT_RUN = 4;
/** Fewer spoken words than this on the line of a pending mark: the mark stands where the speech should be. */
const MARK_ALONE = 3;
/** Fewer spoken words than this per pending mark in a block: the block is left for the creator to write. */
const HOLLOW_BLOCK = 25;

/** The line of the paragraph that holds `fragment` (its first words), or the paragraph's first line. */
function lineOf(paragraph, fragment) {
  const probe = String(fragment ?? "").replace(/\s+/g, " ").trim().slice(0, 24).toLowerCase();
  for (const entry of paragraph.lines ?? []) {
    if (probe && entry.raw.replace(/\s+/g, " ").toLowerCase().includes(probe)) return entry.line;
  }
  return paragraph.line;
}

function excerpt(raw, at = 0, size = 90) {
  const text = raw.replace(/\s+/g, " ");
  const start = Math.max(0, at - 20);
  const piece = text.slice(start, start + size).trim();
  return `${start > 0 ? "…" : ""}${piece}${start + size < text.length ? "…" : ""}`;
}

/**
 * Checks the parsed script. `timed` comes from timing(); options: target_s
 * (the planned length), format ("long" or "short"), banned (the creator's
 * "Nunca dizer"), own (something in the video is the creator's own).
 */
export function lint(script, timed, { target_s = null, format = "long", banned = [], own = false } = {}) {
  const bannedPatterns = banned.map((term) => [term, termPattern(term)]);
  const issues = [];
  const add = (rule, severity, section, line, text, message, fix) =>
    issues.push({ rule, severity, section: section?.title ?? null, line, excerpt: text, message, fix });
  const sections = script.sections;
  const first = sections[0];
  const last = sections[sections.length - 1];

  if (sections.filter((section) => section.paragraphs.length).length < 3 && format === "long") {
    add("structure", "warn", null, 1, "", "O roteiro tem menos de 3 blocos (##).", "Separe gancho, blocos do corpo e fecho com títulos ##; eles viram os capítulos.");
  }

  // The opening: the first sentence, and nothing that asks before it gives.
  if (first?.paragraphs.length) {
    // The first three sentences are the seconds in which viewers decide to stay.
    const opening = first.paragraphs[0];
    const firstSeconds = sentences(first.paragraphs.map((paragraph) => paragraph.text).join(" ")).slice(0, 3).join(" ");
    for (const [pattern, name] of DEAD_OPENERS) {
      const m = pattern.exec(firstSeconds);
      if (m) add("dead_opener", "blocker", first, opening.line, excerpt(firstSeconds, m.index), `Abertura que faz o público sair: ${name}.`, "Comece pela tensão: o resultado, o problema, a afirmação contrária ou a cena. Apresentação e boas-vindas, se ficarem, vão depois do primeiro ganho.");
    }
    for (const paragraph of first.paragraphs) {
      const m = EARLY_CTA.exec(paragraph.text);
      if (m) add("early_cta", "blocker", first, paragraph.line, excerpt(paragraph.text, m.index), "Pedido de inscrição ou like na abertura.", "Peça depois de entregar algo, ou só no fecho.");
    }
    const hook = timed.sections[0];
    const limit = format === "short" ? 5 : 45;
    if (hook.est_s > limit) {
      add("hook_length", "warn", first, first.line, "", `O primeiro bloco dura cerca de ${hook.est_s} s; o gancho deve caber em ${limit} s.`, "Corte o gancho até a tensão e a promessa; o contexto vai para o bloco seguinte.");
    }
  }

  let sentenceCount = 0;
  let wordsInSentences = 0;
  for (const section of sections) {
    const outline = sentences(section.paragraphs.map((paragraph) => paragraph.text).join(" ")).filter((sentence) => SYLLABUS.test(sentence));
    if (outline.length >= 2) {
      const holder = section.paragraphs.find((paragraph) => paragraph.text.includes(outline[0])) ?? section.paragraphs[0];
      add("syllabus", "warn", section, lineOf(holder, outline[0]), excerpt(outline.slice(0, 2).join(" ")), `${outline.length} frases de ementa ("você vai ver", "você vai entender") no mesmo bloco.`, "Diga o que vem como quem conversa: \"hoje eu vou te mostrar dois…\", uma frase só.");
    }
    section.paragraphs.forEach((paragraph, index) => {
      const text = paragraph.text;
      const at = (fragment) => lineOf(paragraph, fragment);
      for (const [term, pattern] of bannedPatterns) {
        const m = pattern.exec(text);
        if (m) add("creator_banned", "blocker", section, at(m[0]), excerpt(text, m.index), `"${term}" está no "Nunca dizer" do perfil do canal.`, "Tire da fala ou troque; a lista está em canal.md, em Regras do criador.");
      }
      if (!SPONSOR_SECTION.test(section.title ?? "")) {
        const pitch = SALES_PITCH.exec(text);
        if (pitch) add("sales_pitch", "warn", section, at(pitch[0]), excerpt(text, pitch.index), "Frase de anúncio fora de um bloco de publi.", "Tire da fala. Se é de um patrocinador, vai no bloco ## Publi; se é algo do próprio criador, o link fica na descrição.");
        const ownPitch = own ? OWN_PITCH.exec(text) : null;
        if (ownPitch) add("own_pitch", "warn", section, at(ownPitch[0]), excerpt(text, ownPitch.index), "Preço, plano, versão, \"grátis\" ou loja num vídeo do que é do criador: soa como anúncio.", "Tire da fala; o link e o que for preciso saber ficam na descrição. Se a frase fala do custo de outra ferramenta, mantenha e anote o motivo na revisão.");
      }
      for (const [pattern, name] of AI_TELLS) {
        const m = pattern.exec(text);
        if (m) add("ai_tell", "warn", section, at(m[0]), excerpt(text, m.index), `Soa como texto de IA: ${name}.`, "Diga a ideia do jeito que você falaria para um amigo, com um exemplo concreto.");
      }
      const written = WRITTEN_STYLE.exec(text);
      if (written) add("written_style", "warn", section, at(written[0]), excerpt(text, written.index), `"${written[0]}" é de texto escrito; falado, soa como leitura.`, "Troque por \"mas\", \"então\", \"por isso\" ou corte.");
      // [CONFIRMAR]/[ESCOLHER] are counted one by one below; here, the other forms of unfinished text.
      const placeholder = PLACEHOLDERS.slice(1).map((pattern) => pattern.exec(paragraph.raw)).find(Boolean);
      if (placeholder) add("placeholder", "blocker", section, at(placeholder[0]), excerpt(paragraph.raw, placeholder.index), "Trecho ainda a escrever ou conferir.", "Complete ou corte antes de gravar.");
      // A source in this paragraph, or in the one just before (a comparison of numbers sourced there), covers the claim.
      const sourced = SOURCE_MARK.test(paragraph.raw) || SOURCE_MARK.test(section.paragraphs[index - 1]?.raw ?? "");
      const claim = CLAIMS.map((pattern) => pattern.exec(text)).find(Boolean);
      if (claim && !sourced) {
        add("unsourced_number", "warn", section, at(claim[0]), excerpt(text, claim.index), "Número, comparação ou \"estudos mostram\" sem fonte marcada.", "Marque a origem no parágrafo: [fonte: …] para um dado de fora, [fonte: o criador] para o que ele viveu ou mediu. Sem origem, troque por algo que ele viveu ou corte.");
      }
      const figures = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
      if (figures.length >= 5) add("number_dense", "info", section, paragraph.line, excerpt(text), `${figures.length} números no mesmo parágrafo: o ouvido guarda um.`, "Deixe na fala o número que importa e ponha os outros na tela, com [TEXTO: …].");
      const words = countWords(text);
      if (words > LONG_PARAGRAPH) add("long_paragraph", "info", section, paragraph.line, excerpt(text), `Parágrafo de ${words} palavras sem respiro.`, "Deixe uma linha em branco onde a ideia muda (as marcas não separam parágrafos), ou abra espaço com um exemplo ou uma pergunta.");
      let run = 0;
      for (const sentence of sentences(text)) {
        const count = countWords(sentence);
        sentenceCount += 1;
        wordsInSentences += count;
        const absence = ABSENCE.exec(sentence);
        // The scope must be in the sentence or on its line (a [fonte: …] right after it); a mark elsewhere in the paragraph does not count.
        const rawLine = paragraph.lines?.find((entry) => entry.line === at(sentence))?.raw ?? "";
        if (absence && !ABSENCE_SCOPE.test(sentence) && !ABSENCE_SCOPE.test(rawLine)) {
          add("absence_unscoped", "warn", section, at(sentence), excerpt(sentence, absence.index), "Afirmação de que algo não existe, sem dizer onde se procurou.", "Diga o escopo e a busca feita (\"em português, nas minhas buscas, achei…\") com o número da busca, ou corte.");
        }
        if (RESULT.test(sentence) && CERTAIN.test(sentence)) {
          add("guarantee", "blocker", section, at(sentence), excerpt(sentence), "Promessa de resultado garantido.", "Ninguém garante ganho, peso ou cura. Diga o que aconteceu com o criador e o que depende de quem assiste.");
        }
        if (count > LONG_SENTENCE) add("long_sentence", "warn", section, at(sentence), excerpt(sentence), `Frase de ${count} palavras: difícil de falar de uma vez.`, "Divida em duas ou três frases curtas.");
        run = count <= 4 ? run + 1 : 0;
        if (run === SHORT_RUN) add("short_run", "info", section, at(sentence), excerpt(sentence), `${SHORT_RUN} frases seguidas de até 4 palavras: soa como tópicos, não como fala.`, "Junte algumas frases com \"e\", \"mas\", \"porque\".");
      }
    });
  }

  timed.sections.forEach((entry, i) => {
    if (format === "long" && i > 0 && entry.est_s > 150) {
      add("long_section", "info", sections[i], sections[i].line, "", `O bloco "${entry.title ?? i + 1}" dura cerca de ${entry.est_s} s sem divisão.`, "Divida em dois blocos ou ponha um novo gancho no meio: uma pergunta, uma promessa do que vem.");
    }
  });

  if (last && last !== first) {
    const ending = last.paragraphs.map((paragraph) => paragraph.text).join(" ");
    const outro = DEAD_OUTRO.exec(ending);
    if (outro) add("dead_outro", "warn", last, last.line, excerpt(ending, outro.index), "O vídeo termina na despedida.", "Termine na próxima ação: o próximo vídeo, o material, a pergunta. A despedida, se houver, é uma frase antes disso.");
    const asks = new Set((ending.match(CTA_ASK) ?? []).map((ask) => ask.toLowerCase().slice(0, 6)));
    if (asks.size > 2) add("cta_count", "warn", last, last.line, "", `O fecho pede ${asks.size} coisas diferentes.`, "Escolha um pedido só, o que mais importa para este vídeo.");
  }

  const pending = script.pending ?? [];
  for (const item of pending) {
    const section = sections.find((candidate) => candidate.title === item.section) ?? null;
    add("placeholder", "blocker", section, item.line, item.text, "Trecho ainda a escrever, conferir ou decidir.", "Preencha com o que o criador disser ou fizer, ou corte antes de gravar.");
    // A mark is a hole in a finished sentence: alone on its line, it leaves the creator to write the speech.
    if (item.words !== null && item.words !== undefined && item.words < MARK_ALONE) {
      add("mark_alone", "warn", section, item.line, item.text, "A marca está no lugar da fala.", "Escreva a frase inteira no jeito dele e deixe em marca só o detalhe: \"levou [CONFIRMAR: quanto tempo]\".");
    }
  }
  timed.sections.forEach((entry, i) => {
    const marks = pending.filter((item) => item.section === entry.title && item.words !== null).length;
    if (marks >= 2 && entry.words / marks < HOLLOW_BLOCK) {
      add("hollow_block", "warn", sections[i], sections[i].line, "", `O bloco "${entry.title ?? i + 1}" tem ${entry.words} palavras de fala para ${marks} marcas: quase todo fica para o criador escrever.`, "Escreva a fala do bloco e deixe em marca só os detalhes que só ele sabe; uma história pedida ganha um exemplo do tamanho e do tom.");
    }
  });

  if (target_s) {
    const ratio = timed.est_s / target_s;
    const minutes = (seconds) => Math.round(seconds / 60 * 10) / 10;
    if (ratio < 0.85 && pending.length) {
      // A script written before the result is short by design: the marks become speech later.
      add("duration", "info", null, 1, "", `Duração estimada de ${minutes(timed.est_s)} min contra ${minutes(target_s)} min planejados, sem contar o que vai entrar no lugar das ${pending.length} marca(s) pendente(s).`, "Confira de novo depois de preencher as marcas; só então aprofunde ou corte.");
    } else if (ratio < 0.85 || ratio > 1.15) {
      add("duration", "warn", null, 1, "", `Duração estimada de ${minutes(timed.est_s)} min contra ${minutes(target_s)} min planejados.`, ratio > 1 ? "Corte: comece pelos parágrafos que repetem ideia e pelos exemplos fracos." : "Aprofunde um bloco com um exemplo ou uma demonstração, não com enchimento.");
    }
  }

  const order = { blocker: 0, warn: 1, info: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity] || a.line - b.line);
  return {
    issues,
    sentences: sentenceCount,
    avg_sentence_words: sentenceCount ? Math.round((wordsInSentences / sentenceCount) * 10) / 10 : 0,
    summary: {
      blockers: issues.filter((issue) => issue.severity === "blocker").length,
      warnings: issues.filter((issue) => issue.severity === "warn").length,
      infos: issues.filter((issue) => issue.severity === "info").length,
    },
  };
}

/**
 * Narration over a screen recording: speech that runs past its stretch of
 * screen, and screen that runs long with nothing said and no cut planned.
 * `stretches` comes from screenSync().
 */
export function screenIssues(stretches) {
  const issues = [];
  for (const stretch of stretches) {
    const base = { section: stretch.section, line: stretch.line, excerpt: stretch.mark };
    if (stretch.speech_s > stretch.screen_s * 1.2 + 2) {
      issues.push({ ...base, rule: "speech_over_screen", severity: "warn", message: `A fala deste trecho dura cerca de ${stretch.speech_s} s e a tela, ${stretch.screen_s} s.`, fix: "Corte a fala, divida em dois trechos de tela ou congele a imagem com [CONGELAR Ns]." });
    } else if (!stretch.shortened && stretch.screen_s > stretch.speech_s + 10) {
      issues.push({ ...base, rule: "idle_screen", severity: "info", message: `${stretch.screen_s - stretch.speech_s} s de tela sem fala neste trecho.`, fix: "Marque \"acelerar\" ou \"cortar\" na marca de tela, ou diga algo que acrescente enquanto a ação acontece." });
    }
  }
  return issues;
}
