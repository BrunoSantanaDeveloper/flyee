// The member's literal request, read without any AI: word lists and patterns, accent-insensitive,
// that turn "Faz um vídeo de 15 segundos da lojax.com.br para o Reels" into fields with the words
// that justify each one. The same request always gives the same fields, in every AI. What the
// request does not say stays out: the questions and the defaults fill it later (lib/intake.mjs).

export const FIELDS = ["brand", "objective", "subject", "destinations", "duration", "template", "points", "hook", "proof", "tone", "style", "music", "closing", "skip_preview"];
export const OBJECTIVES = ["apresentar", "vender", "lancar", "explicar", "portfolio"];
export const TONES = ["confianca", "vontade", "surpresa", "proximidade"];
export const STYLES = ["interface-narra", "interface-que-se-transforma", "limpo", "tipografia-cinetica", "vitrine"];
export const DESTINATIONS = ["reels", "tiktok", "shorts"];
export const TEMPLATES = ["lancamento", "interface", "oferta", "lista"];
export const UNSUPPORTED = ["edit", "generated", "format", "reference_study", "long"];
export const DURATION = { min: 6, max: 20 };
export const LIMITS = { hook_words: 6, closing_words: 6, points: 5, states: 10, point_words: 8 };

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/** Lowercase without accents, character for character: an index in the result is the same index in the text. */
export function fold(text) {
  const src = String(text ?? "");
  let out = "";
  for (let i = 0; i < src.length; i++) {
    const code = src.charCodeAt(i);
    if (code < 128) {
      out += code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : src[i];
      continue;
    }
    if (code === 0xa0) {
      out += " ";
      continue;
    }
    const base = src[i].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    out += base.length === 1 ? base : base.length > 1 ? base[0] : " ";
  }
  return out;
}

export const clean = (text) => String(text ?? "").replace(/\s+/g, " ").trim();

export const words = (text) => clean(text).split(" ").filter(Boolean);

export const wordCount = (text) => words(text).length;

/** A short quote of the member's own words, for `evidence`. */
export function clip(text, max = 90) {
  const flat = clean(text);
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

export const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

const blank = (text, index, length) => (length > 0 ? text.slice(0, index) + " ".repeat(length) + text.slice(index + length) : text);

const SMALL_WORDS = new Set(["a", "o", "as", "os", "um", "uma", "de", "da", "do", "das", "dos", "e", "ou", "em", "no", "na", "nos", "nas", "para", "pra", "por", "com", "sem", "que", "seu", "sua", "seus", "suas", "ao", "aos", "the", "of", "and", "to", "for", "with", "mais", "muito", "como", "se"]);

/**
 * At most `max` whole words, never half a word. A break the text already has (a full stop, a
 * colon, a dash) inside the limit wins; otherwise the cut drops the loose little words at the end.
 */
export function shortenWords(text, max = LIMITS.hook_words) {
  const flat = clean(text).replace(/^["“”'‘’«»\s]+|["“”'‘’«»\s]+$/g, "");
  const list = words(flat);
  if (list.length <= max) return flat.replace(/[.,;:–—-]+$/, "").trim() || flat;
  const head = list.slice(0, max);
  const cut = (i) => head.slice(0, i + 1).join(" ").replace(/[.,;:–—|-]+$/, "").trim();
  for (let i = head.length - 1; i >= 1; i--) if (/[.!?:;–—|]$/.test(head[i])) return cut(i);
  for (let i = head.length - 1; i >= 2; i--) if (/,$/.test(head[i])) return cut(i);
  let end = head.length;
  while (end > 2 && SMALL_WORDS.has(fold(head[end - 1]).replace(/[^a-z]/g, ""))) end -= 1;
  return head.slice(0, end).join(" ").replace(/[.,;:–—|-]+$/, "").trim();
}

/** "a, b e c" → ["a", "b", "c"]; a comma between digits (R$ 9,90) is not a separator. */
export function splitList(text) {
  const raw = String(text ?? "");
  const flat = clean(raw).replace(/[.;]+$/, "");
  if (!flat) return [];
  const pieces = /[;\n]/.test(raw.trim()) ? raw.split(/[;\n]+/) : flat.split(/(?<!\d),|,(?!\d)/);
  const items = pieces.map(clean).filter(Boolean);
  const last = items.pop();
  if (last !== undefined) {
    const tail = last.split(/\s+(?:e|and)\s+/i);
    if (tail.length === 2 && tail.every((piece) => clean(piece))) items.push(...tail.map(clean));
    else items.push(last);
  }
  return items.map((item) => item.replace(/^(?:e|and)\s+/i, "").replace(/^["“‘'«]+|["”’'»]+$/g, "").replace(/[.;,]+$/, "").trim()).filter(Boolean);
}

const NUMBER_WORDS = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15,
  dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, noventa: 90,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, ten: 10, fifteen: 15, twenty: 20, thirty: 30, sixty: 60,
};
const NUMBER_WORD_PATTERN = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join("|");

const countOf = (token) => (/^\d+$/.test(token) ? Number(token) : (NUMBER_WORDS[token] ?? null));

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

const TRACKING = /^(utm_.+|fbclid|gclid|gbraid|wbraid|dclid|msclkid|yclid|twclid|ttclid|li_fat_id|igshid|igsh|mc_cid|mc_eid|_hsenc|_hsmi|mkt_tok|srsltid|ref|ref_src|ref_url|referrer|si|feature|pp|spm|scid|cmpid|trk|is_from_webapp|sender_device|_r|_t)$/i;
const TRACKING_ON_X = /^(s|t)$/i;

const BARE_ENDINGS = "com|net|org|io|app|dev|tech|store|shop|club|site|online|blog|tv|ai|xyz|info|pt|uk|fr|mx|edu|gov|vc|cc|ly|gg|fm|so|me|co|us|ar|cl|ca|eu|la|ws|sh|am|design|studio|digital|agency|media|live|life|world|today|bio|link|page|space|website|vip|biz|cloud|software|academy|school|health|clinic|law|eco|mobi|games|food|beauty|style|fashion";
const ADDRESS_CHARS = "[^\\s<>\"'“”‘’«»()\\[\\]{}]";
const ADDRESS = new RegExp(
  `(?<![\\p{L}\\p{N}])https?:\\/\\/${ADDRESS_CHARS}+|(?<![\\p{L}\\p{N}@.\\/-])www\\.${ADDRESS_CHARS}+|(?<![\\p{L}\\p{N}@.\\/_-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?:(?:[a-z]{2,5}\\.)?br|${BARE_ENDINGS})(?![\\p{L}\\p{N}_-])(?:\\/${ADDRESS_CHARS}*)?`,
  "giu",
);

/** A full address without the tracking a share button adds; null when the text is not an address. */
export function normalizeUrl(input) {
  let text = String(input ?? "").trim().replace(/[.,;:!?…]+$/, "");
  if (!text || /\s/.test(text)) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `${/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(text) ? "http" : "https"}://${text}`;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol) || !url.hostname) return null;
  const onX = /^(www\.)?(x|twitter)\.com$/i.test(url.hostname);
  for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key) || (onX && TRACKING_ON_X.test(key))) url.searchParams.delete(key);
  url.hash = "";
  const out = url.toString();
  return url.pathname === "/" && !url.search ? out.replace(/\/$/, "") : out;
}

/** "https://www.lojax.com.br/planos" → "lojax.com.br" (with the port when it is not the usual one). */
export function hostOf(address) {
  try {
    return new URL(String(address ?? "")).host.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** What an address is: a video to watch, a profile on a network, a contact link, a reference board, a shared file or a site. */
export function classifyUrl(address) {
  let url;
  try {
    url = new URL(address);
  } catch {
    return "site";
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
  const path = url.pathname;
  if (host === "youtu.be" || host === "fb.watch") return "video";
  if (/(^|\.)youtube\.com$/.test(host)) return /^\/(watch|shorts\/|embed\/|live\/|v\/|playlist|clip\/)/.test(path) ? "video" : "profile";
  if (/(^|\.)vimeo\.com$/.test(host)) return /\/\d{5,}/.test(path) ? "video" : "profile";
  if (/(^|\.)instagram\.com$/.test(host)) return /^\/(reel|reels|p|tv)\//.test(path) ? "video" : "profile";
  if (/(^|\.)tiktok\.com$/.test(host)) return /\/video\/\d+/.test(path) || /^(vm|vt)\./.test(url.hostname) || /^\/t\//.test(path) ? "video" : "profile";
  if (/^(x|twitter)\.com$/.test(host)) return /\/status\/\d+/.test(path) ? "video" : "profile";
  if (/(^|\.)facebook\.com$/.test(host)) return /\/(watch|videos|reel)\b/.test(path) ? "video" : "profile";
  if (/(^|\.)(dailymotion\.com|twitch\.tv|kwai\.com|loom\.com)$/.test(host)) return "video";
  if (/(^|\.)(linkedin\.com|threads\.net|pinterest\.com)$/.test(host)) return "profile";
  if (host === "wa.me" || /(^|\.)whatsapp\.com$/.test(host) || host === "t.me") return "contact";
  if (/(^|\.)(behance\.net|dribbble\.com)$/.test(host)) return "reference";
  if (/(^|\.)(drive\.google\.com|docs\.google\.com|dropbox\.com|wetransfer\.com|we\.tl|onedrive\.live\.com|1drv\.ms)$/.test(host)) return "file";
  return "site";
}

/** The @ of a profile address on Instagram, TikTok or YouTube. */
export function handleOfUrl(address) {
  try {
    const url = new URL(address);
    const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
    if (/(^|\.)instagram\.com$/.test(host)) {
      const match = /^\/(?!p\/|reel\/|reels\/|tv\/|stories\/|explore\/|accounts\/)([A-Za-z0-9._]{2,30})\/?$/.exec(url.pathname);
      return match ? `@${match[1]}` : null;
    }
    if (/(^|\.)(tiktok|youtube)\.com$/.test(host)) {
      const match = /^\/@([A-Za-z0-9._-]{2,40})/.exec(url.pathname);
      return match ? `@${match[1]}` : null;
    }
  } catch {
    // not an address
  }
  return null;
}

/** Every address in a text, in order: `{ raw, index, url, host, kind }`. */
export function findUrls(text) {
  const src = String(text ?? "");
  const found = [];
  for (const match of src.matchAll(ADDRESS)) {
    const raw = match[0].replace(/[.,;:!?…*_]+$/, "");
    const url = normalizeUrl(raw);
    if (!url) continue;
    found.push({ raw, index: match.index, url, host: hostOf(url), kind: classifyUrl(url) });
  }
  return found;
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const HANDLE = /(?<![\w@./])@([A-Za-z0-9_](?:[A-Za-z0-9_.]{0,28}[A-Za-z0-9_])?)/g;

/** A text with its addresses and e-mails replaced by spaces, so that words inside them are never read as words of the request. */
function withoutAddresses(text, urls = findUrls(text)) {
  let masked = String(text ?? "");
  for (const url of urls) masked = blank(masked, url.index, url.raw.length);
  for (const match of masked.matchAll(EMAIL)) masked = blank(masked, match.index, match[0].length);
  return masked;
}

/** Every @ in a text. Addresses and e-mails are left out. */
export function findHandles(text) {
  const list = [];
  for (const match of withoutAddresses(text).matchAll(HANDLE)) if (!list.includes(`@${match[1]}`)) list.push(`@${match[1]}`);
  return list;
}

// ---------------------------------------------------------------------------
// Detectors: each one reads the folded text and answers { value, evidence } or null
// ---------------------------------------------------------------------------

const NEGATED = /(?:\bsem(?:\s+cara\s+de|\s+parecer)?|\bnao\s+(?:e|quero|precisa(?:\s+de)?|tem|tenho|ha)|\bnada\s+de|\bnem)\s+(?:um\s+|uma\s+|o\s+|a\s+)?$/;
const isNegated = (low, index) => NEGATED.test(low.slice(Math.max(0, index - 24), index));

const OBJECTIVE_PATTERNS = [
  ["vender", /\b(?:anuncio|anuncios|anunciar|propaganda|promocao|promocoes|promo|oferta|ofertas|vender|venda|vendas|desconto|descontos|liquidacao|cupom|black friday|ads?|advertisement|sale|sales|offer|discount)\b/],
  ["lancar", /\b(?:lancamento|lancamentos|lancar|lancando|novidade|novidades|inauguracao|estreia|pre-venda|launch|launching)\b/],
  ["explicar", /\b(?:tutorial|como funciona|como usar|como fazer|explicar|explica|explicando|explicativo|passo a passo|ensinar|ensina|aprenda|how to|how it works|explain|explainer)\b/],
  ["portfolio", /\b(?:portfolio|meu trabalho|meus trabalhos|meus projetos|nossos projetos|nossos trabalhos|showreel|my work)\b/],
  ["apresentar", /\b(?:apresentar|apresenta|apresentando|apresentacao|institucional|quem somos|conheca|introduce|introducing)\b/],
];
/** "com a energia do showreel", "como se fosse o seu showreel de portfólio": a comparison, not the goal. */
const COMPARISON = /(?:(?:energia|estilo|cara|pegada|jeito|clima)\s+d[eo]s?\s+(?:um\s+|seu\s+)?|como\s+(?:se\s+fosse\s+)?(?:o\s+|um\s+)?(?:seu\s+|meu\s+)?|\b(?:tipo|igual\s+a[o]?)\s+(?:um\s+)?)(?:showreel\s+(?:de|pra|para)\s+(?:um\s+)?)?$/;

/** What the video is for, by the first word of the request that says it. */
export function detectObjective(low, src = low) {
  let best = null;
  for (const [id, pattern] of OBJECTIVE_PATTERNS) {
    for (const match of low.matchAll(new RegExp(pattern.source, "g"))) {
      if (isNegated(low, match.index)) continue;
      if (id === "portfolio" && COMPARISON.test(low.slice(Math.max(0, match.index - 48), match.index))) continue;
      if (!best || match.index < best.index) best = { id, index: match.index, length: match[0].length };
      break;
    }
  }
  return best ? { value: best.id, evidence: clip(src.slice(best.index, best.index + best.length)), index: best.index } : null;
}

const NETWORK = "reels?|instagram|insta|tik\\s?tok|youtube|shorts";

/** Where the video will be published: Reels, TikTok and Shorts are what this version makes. */
export function detectDestinations(low, src = low) {
  const found = new Set();
  const evidence = [];
  const note = (index, length) => {
    const text = clean(src.slice(index, index + length));
    if (text && !evidence.some((item) => fold(item) === fold(text))) evidence.push(text);
  };
  for (const match of low.matchAll(/\b(?:reels?|instagram|insta|ig)\b/g)) {
    // "o reel abre com…" speaks of the piece itself; "um reel", "para reel" name the network
    if (match[0] === "reel" && !/\b(?:um|uns|para|pro|pra|no|de|em|como)\s+$/.test(low.slice(Math.max(0, match.index - 8), match.index))) continue;
    found.add("reels");
    note(match.index, match[0].length);
  }
  for (const match of low.matchAll(/\btik\s?tok\b/g)) {
    found.add("tiktok");
    note(match.index, match[0].length);
  }
  for (const match of low.matchAll(/\bshorts\b/g)) {
    const before = low.slice(Math.max(0, match.index - 40), match.index);
    const after = low.slice(match.index + match[0].length, match.index + match[0].length + 20);
    const capital = /^[A-Z]/.test(src.slice(match.index, match.index + 1));
    const nearNetwork = new RegExp(`\\b(?:${NETWORK})\\b`).test(before) || new RegExp(`^\\s*(?:d[oe]\\s+youtube|,|e\\s+(?:${NETWORK}))`).test(after);
    const clothing = /\b(?:os|uns|dos|aos|nossos|novos|meus|seus|de)\s+$/.test(before) && !nearNetwork;
    if (nearNetwork || (capital && !clothing)) {
      found.add("shorts");
      note(match.index, match[0].length);
    }
  }
  let everywhere = false;
  for (const match of low.matchAll(/\b(?:redes sociais|todas as redes|nas redes|stories|story|kwai)\b/g)) {
    everywhere = true;
    note(match.index, match[0].length);
  }
  if (everywhere) for (const id of DESTINATIONS) found.add(id);
  if (!found.size) return null;
  const stories = /stor(?:y|ies)|kwai/.test(fold(evidence.join(" ")));
  return { value: DESTINATIONS.filter((id) => found.has(id)), evidence: `${evidence.join(", ")}${stories ? " (vertical: o mesmo vídeo serve)" : ""}` };
}

const SECONDS = "(?:s|seg|segs|segundos?|sec|secs|seconds?)";
const MINUTES = "(?:min|mins|minutos?|minutes?)";
const PER_SCENE_AFTER = /^\s*(?:cada\b|por\s+(?:cena|batida|momento|slide|plano|corte|tela|item|ponto)|de\s+(?:intervalo|pausa))/;
const PER_SCENE_BEFORE = /(?:\ba\s+cada|\bprimeir[oa]s?|\bultim[oa]s?|\bapos|\bdepois\s+de|\bnos|\baos|\bmenos\s+de|\bdurante|\bpausa\s+de|\bespera\s+de)\s+(?:os\s+|as\s+)?$/;
const NOT_THE_VIDEO = /(?:\bem|\bha|\bfaz|\bleva|\blevar|\blevou|\bdemora|\bdemorar|\bdemorou|\bespera|\bapos|\bdepois\s+de|\ba\s+cada|\buns|\bumas|\bmenos\s+de|\bmais\s+de|\bcerca\s+de)\s+$/;

/**
 * The duration the request asks for, in whole seconds inside the limits of this version.
 * `long` says the request asked for more than the maximum; `short`, for less than the minimum.
 */
export function detectDuration(low, src = low) {
  const candidates = [];
  const around = (index, length) => ({ before: low.slice(Math.max(0, index - 28), index), after: low.slice(index + length, index + length + 24) });
  const taken = [];
  const overlaps = (index) => taken.some(([from, to]) => index >= from && index < to);

  const ranges = new RegExp(`(?:\\bde\\s+(\\d{1,3})\\s+a\\s+(\\d{1,3})|\\bentre\\s+(\\d{1,3})\\s+e\\s+(\\d{1,3})|(?<![\\d.,:x])(\\d{1,3})\\s*(?:a|ate|to|-|\\u2013|\\u2014)\\s*(\\d{1,3}))\\s*${SECONDS}\\b`, "g");
  for (const match of low.matchAll(ranges)) {
    const from = Number(match[1] ?? match[3] ?? match[5]);
    const to = Number(match[2] ?? match[4] ?? match[6]);
    taken.push([match.index, match.index + match[0].length]);
    const { before, after } = around(match.index, match[0].length);
    if (PER_SCENE_AFTER.test(after) || PER_SCENE_BEFORE.test(before)) continue;
    candidates.push({ index: match.index, seconds: Math.min(from, to), text: src.slice(match.index, match.index + match[0].length), range: [Math.min(from, to), Math.max(from, to)] });
  }

  const minutes = new RegExp(`\\b(\\d{1,2}(?:[.,]\\d)?|um|uma|dois|duas|tres|meio|one|two|half a)\\s*${MINUTES}\\b(\\s+e\\s+meio)?`, "g");
  for (const match of low.matchAll(minutes)) {
    if (overlaps(match.index)) continue;
    const { before } = around(match.index, match[0].length);
    if (NOT_THE_VIDEO.test(before)) continue;
    const token = match[1];
    const amount = token === "meio" || token === "half a" ? 0.5 : (NUMBER_WORDS[token] ?? Number(token.replace(",", ".")));
    if (!Number.isFinite(amount)) continue;
    taken.push([match.index, match.index + match[0].length]);
    candidates.push({ index: match.index, seconds: Math.round((amount + (match[2] ? 0.5 : 0)) * 60), text: src.slice(match.index, match.index + match[0].length) });
  }

  const seconds = new RegExp(`(?:(?<![\\d.,:x])(\\d{1,3}(?:[.,]\\d)?)|\\b(${NUMBER_WORD_PATTERN}))\\s*${SECONDS}\\b`, "g");
  for (const match of low.matchAll(seconds)) {
    if (overlaps(match.index)) continue;
    const { before, after } = around(match.index, match[0].length);
    if (PER_SCENE_AFTER.test(after) || PER_SCENE_BEFORE.test(before)) continue;
    const amount = match[1] !== undefined ? Number(match[1].replace(",", ".")) : NUMBER_WORDS[match[2]];
    if (!Number.isFinite(amount) || amount < 5) continue;
    candidates.push({ index: match.index, seconds: Math.round(amount), text: src.slice(match.index, match.index + match[0].length) });
  }

  let chosen = candidates.sort((a, b) => a.index - b.index)[0] ?? null;
  if (!chosen) {
    const bars = /\b(\d{1,2})\s*compassos\b/.exec(low);
    const tempo = /\b(\d{2,3})\s*bpm\b/.exec(low);
    if (bars && tempo && Number(tempo[1]) >= 60) {
      const total = (Number(bars[1]) * 240) / Number(tempo[1]);
      if (total >= 3) chosen = { index: bars.index, seconds: Math.round(total), text: `${bars[1]} compassos a ${tempo[1]} BPM`, bars: true };
    }
  }
  if (!chosen) return null;

  const asked = chosen.seconds;
  const value = Math.min(DURATION.max, Math.max(DURATION.min, asked));
  let evidence = clip(chosen.text);
  if (asked > DURATION.max) evidence += ` (${chosen.range ? "" : `${asked} s; `}nesta versão, até ${DURATION.max} s)`;
  else if (asked < DURATION.min) evidence += ` (o mínimo é ${DURATION.min} s)`;
  else if (chosen.range) evidence += ` (usei ${value})`;
  else if (chosen.bars) evidence += ` (${value} s)`;
  return { value, evidence, asked, long: asked > DURATION.max, short: asked < DURATION.min };
}

const TEMPLATE_PATTERNS = [
  ["interface", /\b(?:lista de estados|estados da interface|interface que se transforma|mud(?:a|ando) de estado|mesmo elemento|nunca corta|um unico elemento|morph(?:ing)?)\b/],
  ["lista", new RegExp(`\\b(?:\\d{1,2}|${NUMBER_WORD_PATTERN})\\s+(?:dicas|erros|passos|motivos|razoes|mitos|segredos|sinais|ideias|truques|habitos|perguntas|maneiras|jeitos|formas|verdades|licoes|regras|tips|mistakes|steps|reasons)\\b|\\b(?:em lista|top \\d|passo a passo)\\b`)],
  ["oferta", /\b(?:preco|precos|promocao|promocoes|promo|desconto|descontos|oferta|ofertas|liquidacao|cupom|black friday)\b|\d\s?% ?off\b|\bpor r\$|r\$ ?\d/],
  ["lancamento", new RegExp(`\\b(?:lancamento|o produto aparece|produto aparece|produto se monta\\w*|(?:\\d|${NUMBER_WORD_PATTERN}) recursos|recursos um a um)\\b`)],
];

/** The story the request names, by its own words: a list of states, "3 dicas", a price, a launch. */
export function detectTemplate(low, src = low) {
  for (const [id, pattern] of TEMPLATE_PATTERNS) {
    for (const match of low.matchAll(new RegExp(pattern.source, "g"))) {
      if (isNegated(low, match.index)) continue;
      // "frete grátis acima de R$ 199" is a condition, not the price of an offer
      if (id === "oferta" && /\b(?:acima|abaixo|alem)\s+de\s*$/.test(low.slice(Math.max(0, match.index - 12), match.index))) continue;
      return { value: id, evidence: clip(src.slice(match.index, match.index + match[0].length)), index: match.index };
    }
  }
  return null;
}

const TONE_PATTERNS = [
  ["confianca", /\b(?:seri[oa]|profissional|profissionais|confiavel|confianca|credibilidade|sobri[oa]|elegante|institucional|trustworthy|professional|serious)\b/],
  ["vontade", /\b(?:vontade|desejo|irresistivel|urgencia|urgente|compre agora|quero (?:isso )?agora|que vend[ae]|vendedor|comprar)\b/],
  ["surpresa", /\b(?:impressionante|impressionar|uau|wow|surpreend\w+|surpresa|impactante|de cair o queixo|incrivel|ousad[oa]|vai com tudo|capriche)\b/],
  ["proximidade", /\b(?:leve(?!\s+(?:o|a|os|as|ao|aos|para|pro|pra|ate)\b)|divertid[oa]|descontraid[oa]|proximidade|amigavel|acolhedor[a]?|simpatic[oa]|bem-humorad[oa]|engracad[oa]|casual|informal|friendly)\b/],
];

/** The feeling the request asks for, by the first word that says it. */
export function detectTone(low, src = low) {
  let best = null;
  for (const [id, pattern] of TONE_PATTERNS) {
    for (const match of low.matchAll(new RegExp(pattern.source, "g"))) {
      if (isNegated(low, match.index)) continue;
      if (!best || match.index < best.index) best = { id, index: match.index, length: match[0].length };
      break;
    }
  }
  return best ? { value: best.id, evidence: clip(src.slice(best.index, best.index + best.length)) } : null;
}

/** Per style: phrases that name it (two points each) and loose words that hint at it (one point each). */
const STYLE_PATTERNS = [
  ["interface-que-se-transforma", /\b(?:morph(?:ing)?|que se transforma|se transformando|muda de forma|mud(?:a|ando) de estado|nunca corta|mesmo elemento|um unico elemento)\b/, null],
  ["limpo", /\b(?:estilo (?:da )?apple|sem exagero)\b/, /\b(?:limp[oa]s?|minimalistas?|minimal|clean|discret[oa]s?)\b/],
  ["tipografia-cinetica", /\b(?:tipografia cinetica|texto grande|textos grandes|letras grandes|letras enormes|letras em movimento|kinetic typography)\b/, /\b(?:tipografi\w+)\b/],
  ["vitrine", /\b(?:vitrine|catalogo|cardapio|showcase)\b/, /\b(?:produtos|pecas|colecao)\b/],
  ["interface-narra", /\b(?:a interface conta|telas reais|interface real)\b/, /\b(?:interface|telas|tela do (?:app|site|sistema)|screens|prints)\b/],
];

/** The named style the words point at: the one with more weight; a tie goes to the first mentioned. */
export function detectStyle(low, src = low) {
  let best = null;
  for (const [id, strong, weak] of STYLE_PATTERNS) {
    const hits = [];
    for (const [pattern, weight] of [[strong, 2], [weak, 1]]) {
      if (!pattern) continue;
      for (const match of low.matchAll(new RegExp(pattern.source, "g"))) {
        if (isNegated(low, match.index)) continue;
        // a loose word inside a phrase that already counted is the same mention
        if (hits.some((hit) => match.index >= hit.index && match.index < hit.index + hit.length)) continue;
        hits.push({ index: match.index, length: match[0].length, weight });
      }
    }
    if (!hits.length) continue;
    hits.sort((a, b) => a.index - b.index);
    const entry = { id, score: hits.reduce((sum, hit) => sum + hit.weight, 0), index: hits[0].index, length: hits[0].length };
    if (!best || entry.score > best.score || (entry.score === best.score && entry.index < best.index)) best = entry;
  }
  return best ? { value: best.id, evidence: clip(src.slice(best.index, best.index + best.length)) } : null;
}

const AUDIO_FILE = /[\w\-.]*[\w-]\.(?:mp3|wav|m4a|aac|ogg|flac)\b/i;
const MUSIC_WORD = "(?:musica|trilha|batida|som)";
const MUSIC_STYLE_PATTERNS = [
  ["energetic", "animad[oa]|energetic[oa]|agitad[oa]|empolgante|vibrante|pra cima|upbeat"],
  ["warm", "calm[oa]|suave|tranquil[oa]|lo-?fi|relaxante|aconchegante"],
  ["minimal", "minimalista|discret[oa]|sutil|bem leve"],
  ["cinematic", "epic[oa]|cinematografic[oa]|de trailer|dramatic[oa]|grandios[oa]"],
  ["playful", "divertid[oa]|alegre|brincalhon[a]?"],
];

/**
 * The sound the request asks for: silence, only effects, the member's own track, a loop, or an
 * original track (with its character, when the words say it). `audioFile` is a music file the
 * request names.
 */
export function detectMusic(low, src = low, audioFile = null) {
  const pick = (pattern) => {
    const match = pattern.exec(low);
    return match ? { index: match.index, text: clip(src.slice(match.index, match.index + match[0].length)) } : null;
  };
  const silent = pick(/\b(?:sem som|sem audio|video mudo|silencios[oa]|no sound)\b/);
  if (silent) return { value: { mode: "none", style: null, file: null, effects: false }, evidence: silent.text };
  const none = pick(/\b(?:sem musica(?! de terceiros| com direitos| comercial| famosa| conhecida)|sem trilha|so (?:os )?efeitos|apenas (?:os )?efeitos|somente (?:os )?efeitos|no music|sfx only)\b/);
  if (none) return { value: { mode: "none", style: null, file: null, effects: true }, evidence: none.text };
  const own = pick(/\b(?:minha (?:propria )?musica|minha trilha|musica propria|trilha propria|tenho (?:uma|a) (?:musica|trilha)|(?:a|uma) musica que (?:eu )?(?:tenho|mandei|enviei|comprei)|my own music|my music)\b/);
  if (own || audioFile) return { value: { mode: "file", style: null, file: audioFile, effects: true }, evidence: own ? own.text : audioFile };
  let style = null;
  for (const [id, adjectives] of MUSIC_STYLE_PATTERNS) {
    const match = new RegExp(`\\b${MUSIC_WORD}\\b[^.\\n,;]{0,24}?\\b(?:${adjectives})\\b|\\b(?:${adjectives})\\b[^.\\n,;]{0,12}?\\b${MUSIC_WORD}\\b`).exec(low);
    if (match && (!style || match.index < style.index)) style = { id, index: match.index, text: clip(src.slice(match.index, match.index + match[0].length)) };
  }
  const loop = pick(/\b(?:(?:trilha|musica|som) em loop|em loop|loop infinito|looping)\b/);
  if (loop) return { value: { mode: "synth", style: null, file: null, effects: true }, evidence: loop.text };
  const original = pick(/\b(?:musica original|trilha original|trilha na batida|musica na batida|trilha sonora original|original (?:music|track|soundtrack))\b/);
  if (original || style) return { value: { mode: "music", style: style?.id ?? null, file: null, effects: true }, evidence: [original?.text, style?.text].filter(Boolean).join(" · ") };
  return null;
}

/** "faz direto", "não precisa me mostrar", a request that starts with /goal: no stop at the preview. */
export function detectSkipPreview(low, src = low) {
  if (/^\s*\/goal\b/.test(low)) return { value: true, evidence: "/goal" };
  const match = /\b(?:faz direto|faca direto|pode fazer direto|direto (?:pro|para o|no) final|sem previa|nao precisa (?:me )?mostrar|nao precisa de previa|sem me (?:mostrar|perguntar)|nao me mostr[ae]|no preview|skip the preview|don'?t show me)\b/.exec(low);
  return match ? { value: true, evidence: clip(src.slice(match.index, match.index + match[0].length)) } : null;
}

// ---------------------------------------------------------------------------
// Numbers that prove something
// ---------------------------------------------------------------------------

const PROOF_NOUNS =
  "clientes|alunos|alunas|pacientes|pedidos|vendas|usuarios|downloads|avaliacoes|lojas|unidades|cidades|paises|entregas|projetos|empresas|seguidores|inscritos|assinantes|membros|atendimentos|familias|pessoas|marcas|casos|obras|eventos|imoveis|consultas|cirurgias|sorrisos|profissionais|parceiros|franquias|customers|users|clients|students|orders|reviews";
const PROOF_TAIL = "atendid\\w+|satisfeit\\w+|formad\\w+|vendid\\w+|entregues?|realizad\\w+|ativ[oa]s|felizes|cadastrad\\w+";
const SCALE = { mil: 1e3, k: 1e3, milhao: 1e6, milhoes: 1e6, mi: 1e6, bilhao: 1e9, bilhoes: 1e9, bi: 1e9 };

/** "2.000" → 2000, "1,5" → 1.5, "1.299,90" → 1299.9. */
export function digitsValue(digits) {
  let text = String(digits ?? "").trim().replace(/\s/g, "").replace(/[.,]$/, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) text = text.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replace(/,/g, "");
  else text = text.replace(",", ".");
  const value = Number(text);
  return text && Number.isFinite(value) ? value : null;
}

/** The first number of a phrase with its scale: "+12 mil clientes" → 12000, "97% de aprovação" → 97. */
export function numberIn(text) {
  const low = fold(text);
  const match = /(\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)\s*(%|mil\b|k\b|milhao\b|milhoes\b|mi\b|bilhao\b|bilhoes\b|bi\b)?/.exec(low);
  if (!match) return null;
  const base = digitsValue(match[1]);
  if (base === null) return null;
  const scale = match[2] && match[2] !== "%" ? (SCALE[match[2]] ?? 1) : 1;
  return Math.round(base * scale * 1e4) / 1e4;
}

/**
 * A number the member states as a result: "+12 mil clientes", "97% de satisfação", "nota 4,9".
 * Prices, durations, counts of scenes and tempos are not proof and are left alone.
 */
export function detectProof(low, src = low) {
  const none = /\b(?:sem numeros?|nao mostr[ae]r? numeros?|nada de numeros?|sem dados|no numbers)\b/.exec(low);
  if (none) return { value: null, evidence: clip(src.slice(none.index, none.index + none[0].length)), none: true };
  const build = (index, length) => {
    const text = clean(src.slice(index, index + length)).replace(/[.,;:]+$/, "");
    const value = numberIn(text);
    return value === null ? null : { value: { text, value, source: "informado no pedido" }, evidence: clip(text) };
  };
  const counted = new RegExp(`(?:\\+\\s?|mais de\\s+|quase\\s+|acima de\\s+|over\\s+)?(?<![\\d.,:x$])(?:\\d{1,3}(?:[.\\s]\\d{3})+|\\d+(?:[.,]\\d+)?)\\s*(?:mil\\b|k\\b|milhao\\b|milhoes\\b|mi\\b|bilhao\\b|bilhoes\\b|bi\\b)?\\+?\\s*(?:de\\s+)?(?:${PROOF_NOUNS})\\b(?:\\s+(?:${PROOF_TAIL}))?`, "g");
  for (const match of low.matchAll(counted)) {
    const found = build(match.index, match[0].length);
    if (found && found.value.value >= 10) return found;
  }
  const years = /(?:\+\s?|mais de\s+)?\d{1,3}\s+anos\s+de\s+(?:mercado|experiencia|historia|estrada|tradicao|atuacao)/.exec(low);
  if (years) return build(years.index, years[0].length);
  const percent = /\d{1,3}(?:[.,]\d+)?\s?%\s+(?:de\s+|dos\s+|das\s+)?(?:satisfacao|aprovacao|recompra|clientes satisfeitos|clientes|pacientes|alunos|retorno|recomendam|indicam|indicariam|crescimento|economia|aumento)/.exec(low);
  if (percent) return build(percent.index, percent[0].length);
  const rating = /(?:nota|avaliacao|media)\s+(?:de\s+)?\d(?:[.,]\d)?(?:\s+(?:estrelas|no google|de 5))?|\d(?:[.,]\d)?\s+estrelas/.exec(low);
  if (rating) return build(rating.index, rating[0].length);
  const labelled = /\b(?:um\s+)?(?:numero|dado|resultado|prova)\s*:\s*([^\n.;]*\d[^\n.;]*)/.exec(low);
  if (labelled) return build(labelled.index + labelled[0].length - labelled[1].length, labelled[1].length);
  return null;
}

// ---------------------------------------------------------------------------
// Lists, quotes and the lines of a story
// ---------------------------------------------------------------------------

const QUOTED = /"([^"\n]{1,200})"|“([^”\n]{1,200})”|«([^»\n]{1,200})»|‘([^’\n]{1,200})’|(?<![\p{L}\p{N}])'([^'\n]{1,200})'(?![\p{L}\p{N}])/gu;

/** Every quoted piece of a text: `{ text, index, length }` (index of the opening quote). */
export function findQuoted(text) {
  const list = [];
  for (const match of String(text ?? "").matchAll(QUOTED)) {
    const inner = match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5];
    if (clean(inner)) list.push({ text: clean(inner), index: match.index, length: match[0].length });
  }
  return list;
}

/** Numbered and bulleted lines, also "1. … 2. … 3. …" written in one paragraph: `{ text, index, n }`. */
export function findListItems(text) {
  const src = String(text ?? "");
  const items = [];
  let offset = 0;
  let expected = 1;
  for (const line of src.split("\n")) {
    const numbered = /^(\s*)(\d{1,2})\s*(?:[.)\]]|\s[-–]|º)\s+(\S.*)$/.exec(line);
    const bullet = numbered ? null : /^(\s*)[-–—•*·▪◦►]\s+(\S.*)$/.exec(line);
    if (numbered && (Number(numbered[2]) === expected || Number(numbered[2]) === 1)) {
      expected = Number(numbered[2]) + 1;
      items.push({ text: clean(numbered[3]), index: offset + line.lastIndexOf(numbered[3]), n: Number(numbered[2]) });
    } else if (bullet) items.push({ text: clean(bullet[2]), index: offset + line.lastIndexOf(bullet[2]), n: null });
    else if (!numbered) {
      const marks = [...line.matchAll(/(?:^|[\s:;.(])(\d{1,2})[.)]\s+(?=\S)/g)].map((match) => ({ n: Number(match[1]), start: match.index, end: match.index + match[0].length }));
      const run = [];
      for (const mark of marks) {
        if (mark.n === run.length + 1) run.push(mark);
        else if (run.length) break;
      }
      if (run.length >= 2) {
        run.forEach((mark, i) => {
          const end = i + 1 < run.length ? run[i + 1].start : line.length;
          const piece = clean(line.slice(mark.end, end));
          if (piece) items.push({ text: piece, index: offset + mark.end, n: mark.n });
        });
      }
    }
    offset += line.length + 1;
  }
  return items;
}

const ARROW = "\\s*(?:→|->|=>|➜|➔|⇒)\\s*";

/** "logo → a → b → c → logo": the steps between the arrows, without the logo at the ends. */
export function findArrowChain(text) {
  const picked = [];
  for (const line of String(text ?? "").split("\n")) {
    if (new RegExp(ARROW).test(line)) picked.push(line);
    else if (picked.length) break;
  }
  if (!picked.length) return [];
  const pieces = picked.join(" ").split(new RegExp(ARROW, "g")).map((piece) => clean(piece));
  if (pieces.length && /:/.test(pieces[0]) && !/^[[(]/.test(pieces[0])) pieces[0] = clean(pieces[0].slice(pieces[0].lastIndexOf(":") + 1));
  const unwrap = (piece) => {
    const flat = piece.replace(/[.;]+$/, "").trim();
    if ((flat.startsWith("[") && flat.endsWith("]")) || (flat.startsWith("(") && flat.endsWith(")"))) return flat.slice(1, -1).trim();
    return flat;
  };
  const steps = pieces.map(unwrap).filter(Boolean);
  const isLogo = (step) => /^(?:o\s+)?logo(?:tipo)?$/i.test(step);
  while (steps.length && isLogo(steps[0])) steps.shift();
  while (steps.length && isLogo(steps[steps.length - 1])) steps.pop();
  // "gancho → produto → recursos → fechamento" is an outline of the story, not what happens on screen
  if (steps.filter((step) => storyRole(step) !== null).length * 2 >= steps.length) return [];
  return steps.length >= 3 ? steps : [];
}

const INSTRUCTION =
  /^(?:usa|use|usar|gera|gere|gerar|anima|anime|animar|transcrev\w+|deixa|deixe|prioriza|priorize|segue|siga|quando|se|grava|grave|cria|crie|faz|faca|inclui|inclua|poe|ponha|coloca|coloque|adiciona|adicione|corta|corte|renderiza|renderize|salva|salve|escreve|escreva|baixa|baixe|descobre|descubra|transforma|transforme|testa|teste|visita|visite|pega|pegue|nunca|sempre|antes|depois|sem|todo|toda|cada|me mostra|confere|confira|mede|meca|divide|divida|constroi|construa|entrega|entregue)\b/;
// What a line of the request's list is in the story. A label is a beat only when it labels something
// ("Abertura: …", "Assinatura com o logo", "Fechamento"), so "Abertura de conta em 5 minutos",
// "Assinatura mensal" and "Fechamento de caixa automático" stay things to show.
const OPENING_LINE =
  /^(?:gancho|abertura|hook|opening)\s*(?::|–|—|-|\(|com\b|$)|^gancho\s+(?:forte|inicial|de abertura)\b|^primeir[ao]s?\s+(?:cena|frase|tela|imagem)\b|^(?:abr[ae]|abrir|abrindo|comec[ae]|comecar|comecando|inici[ae]|iniciar|iniciando|opens?|starts?)\s+(?:o video\s+)?(?:com|mostrando|digitando|pelo|pela|no|na|with)\b|\bcomo\s+(?:abertura|gancho)\b/;
const CLOSING_LINE =
  /^(?:fechamento|assinatura|encerramento|final|fim|closing|ending)\s*(?::|–|—|-|\(|com\b|$)|^(?:chamada final|cta|call to action)\b|^(?:assinatura|final|fim)\s+(?:da marca|no logo|com o logo)\b|^ultim[ao]s?\s+(?:cena|frase|tela|imagem)\b|^(?:fech[ae]|fechar|fechando|termin[ae]|terminar|terminando|encerr[ae]|encerrar|encerrando|finaliz[ae]|finalizar|finalizando|ends?)\s+(?:o video\s+)?(?:com|mostrando|no|na|pelo|pela|with)\b|\bcomo\s+(?:fechamento|assinatura|chamada final|encerramento)\b/;
const STRUCTURE_LINE =
  /^(?:(?:o|a|os|as)\s+)?(?:produto|interface|marca|loja|tela|telas|app|aplicativo|site|logo)\s+(?:aparece|aparecem|se monta|se montam|surge|surgem|entra|entram)\b|^(?:(?:um|o)\s+)?(?:numero|resultado|dado)s?\s+que\s+prov|^(?:a\s+)?prova(?:\s+social)?\s*(?::|–|—|-|\(|com\b|de que\b|$)|^(?:cena|ato|plano)\s+\d|^(?:\d+|dois|duas|tres|quatro|cinco)\s+recursos\b|\bcada um\b|^(?:som|formato|musica|materiais|historia|referencia|duracao|estilo|tom)\s*:/;

/**
 * What a line of the request's list is in the story: "hook" (it describes the opening: "Gancho: …",
 * "Abre com …"), "closing" (the ending: "Fecha com …", "Assinatura com o logo"), "structure" (a
 * scene of the template: "O produto aparece", "Um número que prova") or null for a thing to show.
 */
export function storyRole(text) {
  const low = fold(clean(text)).replace(/^[\s"“”'‘’«»(]+/, "");
  if (!low) return null;
  if (OPENING_LINE.test(low)) return "hook";
  if (CLOSING_LINE.test(low)) return "closing";
  if (STRUCTURE_LINE.test(low)) return "structure";
  return null;
}

/** A list line that is a thing to show ("frete grátis"), not an instruction ("usa o logo real") nor a part of the story ("Gancho: …", "Fecha com …"). */
export function isContentItem(text) {
  const low = fold(clean(text));
  if (!low || wordCount(low) > LIMITS.point_words) return false;
  return !INSTRUCTION.test(low) && storyRole(text) === null;
}

const POINT_NOUNS = "recursos|pontos|coisas|itens|beneficios|vantagens|diferenciais|dicas|motivos|passos|erros|produtos|servicos|momentos|funcoes|funcionalidades|destaques|novidades|razoes|topicos|features|points|benefits";

// ---------------------------------------------------------------------------
// The brand
// ---------------------------------------------------------------------------

/** Words that follow "para o" or "da" in a request and are a network, a tool, a date or a place: never the brand. */
const NOT_A_BRAND = new Set([
  "reels", "reel", "tiktok", "instagram", "insta", "youtube", "shorts", "short", "stories", "story", "kwai", "facebook", "linkedin", "whatsapp", "twitter", "pinterest", "telegram", "google", "threads", "feed",
  "ia", "ai", "higgsfield", "seedance", "whisper", "chatgpt", "gpt", "canva", "capcut", "premiere", "photoshop",
  "black", "natal", "pascoa", "carnaval", "dia", "ano", "reveillon", "cyber", "semana", "halloween", "copa", "verao", "inverno", "primavera", "outono",
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  "segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo",
  "brasil", "brazil", "portugal", "rio", "sao", "minas", "bahia", "nordeste",
  "mp4", "mov", "hd", "4k", "pdf", "png", "jpg", "url", "cta", "ui", "ux", "api", "bpm", "lufs", "fps", "srt", "html", "css",
  "voce", "eu", "nos", "mim", "ele", "ela", "deus", "the", "my", "our", "your",
  "site", "link", "endereco", "referencia", "fonte", "video", "pagina", "formato", "som", "musica", "historia", "materiais",
]);

/** The kinds of business a name usually starts with, and the article each one takes. */
export const BUSINESS_NOUNS = {
  loja: "a", marca: "a", empresa: "a", clinica: "a", padaria: "a", academia: "a", escola: "a", agencia: "a", barbearia: "a", pizzaria: "a", hamburgueria: "a", confeitaria: "a", farmacia: "a", oficina: "a",
  imobiliaria: "a", livraria: "a", cafeteria: "a", sorveteria: "a", otica: "a", pousada: "a", consultoria: "a", casa: "a", boutique: "a", floricultura: "a", lanchonete: "a", doceria: "a", plataforma: "a", startup: "a",
  estudio: "o", studio: "o", restaurante: "o", salao: "o", mercado: "o", instituto: "o", escritorio: "o", consultorio: "o", atelie: "o", espaco: "o", bar: "o", cafe: "o", hotel: "o", app: "o", aplicativo: "o",
  curso: "o", canal: "o", petshop: "o", brecho: "o", emporio: "o", grupo: "o", laboratorio: "o", centro: "o", negocio: "o", site: "o", sistema: "o", produto: "o", servico: "o", projeto: "o", podcast: "o", ebook: "o", livro: "o",
};
const BUSINESS_PATTERN = Object.keys(BUSINESS_NOUNS).sort((a, b) => b.length - a.length).join("|");
/** Nouns that mean the business itself: "apresentando a minha loja" promotes the brand as a whole. */
const THE_BUSINESS = new Set(["loja", "marca", "empresa", "clinica", "padaria", "academia", "escola", "agencia", "barbearia", "pizzaria", "hamburgueria", "confeitaria", "farmacia", "oficina", "imobiliaria", "livraria", "cafeteria", "sorveteria", "otica", "pousada", "consultoria", "casa", "boutique", "floricultura", "lanchonete", "doceria", "startup", "estudio", "studio", "restaurante", "salao", "mercado", "instituto", "escritorio", "consultorio", "atelie", "espaco", "bar", "cafe", "hotel", "petshop", "brecho", "emporio", "grupo", "laboratorio", "centro", "negocio", "site", "canal"]);

const BRAND_PREFIX = /(?<![\p{L}\p{N}_])(?:(?<de>d[ao]s?)|(?<pro>pr[oa]s?)|(?<para>para|pra|for)(?:\s+(?<art>[oa]s?|the))?|(?<about>sobre|about)\s+(?<art2>[oa]s?|the)|(?<label>marca|empresa|cliente|produto|loja|brand|company|product|client)\s*:)\s+/giu;
/** "no estilo da Apple", "do jeito da Nike", "igual ao do Nubank": a reference, not the brand of the video. */
const STYLE_LEAD = /\b(?:estilo|jeito|cara|pegada|vibe|clima|igual|parecid[oa]|tipo|inspirad[oa]|referencia)\s+(?:(?:a|o|ao|aos|as|os|n[oa]s?|d[aoe]s?)\s+)?$/;
const NAME_TOKEN = /^\p{Lu}[\p{L}\p{N}'’&-]*$|^\p{N}+[\p{L}\p{N}]*$/u;
const NAME_JOINER = /^(?:de|da|do|das|dos|e|&|di|del|la)$/i;

/** Walks the capitalised words after a preposition: "Loja X", "Casa do Pão", "Studio 54". */
function readName(tail) {
  const tokens = [];
  const pattern = /\s*([^\s,.;:!?()[\]{}"“”«»]+)/gu;
  let cursor = 0;
  let end = 0;
  let joiner = null;
  while (tokens.length < 5) {
    pattern.lastIndex = cursor;
    const match = pattern.exec(tail);
    if (!match || match.index !== cursor) break;
    const token = match[1];
    if (tokens.length && !joiner && NAME_JOINER.test(token)) {
      joiner = token;
      cursor = pattern.lastIndex;
      continue;
    }
    const ok = tokens.length ? NAME_TOKEN.test(token) : /^\p{Lu}/u.test(token) && NAME_TOKEN.test(token);
    if (!ok || NOT_A_BRAND.has(fold(token))) break;
    if (joiner) tokens.push(joiner);
    joiner = null;
    tokens.push(token);
    cursor = pattern.lastIndex;
    end = cursor;
  }
  if (!tokens.length) return null;
  const name = tokens.join(" ").replace(/['’&-]+$/, "");
  return name.length >= 2 ? { name, length: end } : null;
}

/**
 * The brand's name as the request says it: capitalised words after "da", "do", "para a", "para o",
 * "para", "sobre a", "sobre o" (a bare "sobre" introduces a topic), "Marca:" or "minha loja". Also
 * the article the member used ("da Loja X" → "a"), so the app can speak of the brand the same way.
 * "no estilo da Apple" is a reference, never the brand.
 */
export function detectBrandName(masked) {
  const text = String(masked ?? "");
  const low = fold(text);
  for (const match of text.matchAll(BRAND_PREFIX)) {
    const groups = match.groups ?? {};
    if (STYLE_LEAD.test(low.slice(Math.max(0, match.index - 24), match.index))) continue;
    let start = match.index + match[0].length;
    let article = null;
    if (groups.de) article = /^da/i.test(groups.de) ? "a" : "o";
    else if (groups.pro) article = /^pro/i.test(groups.pro) ? "o" : null;
    else if ((groups.art ?? groups.art2) && /^[oa]s?$/i.test(groups.art ?? groups.art2)) article = /^a/i.test(groups.art ?? groups.art2) ? "a" : "o";
    let noun = null;
    const possessive = /^(?:minha|nossa|meu|nosso|my|our)\s+/iu.exec(text.slice(start, start + 12));
    if (possessive) start += possessive[0].length;
    if (!/^\p{Lu}/u.test(text.slice(start, start + 1))) {
      const business = new RegExp(`^(${BUSINESS_PATTERN})\\b\\s*,?\\s*(?:(?:a|o|chamad[ao]|que se chama|se chama)\\s+)?`).exec(low.slice(start, start + 60));
      if (!business) continue;
      noun = business[1];
      start += business[0].length;
      article = BUSINESS_NOUNS[noun] ?? article;
    } else if (possessive) continue;
    const found = readName(text.slice(start, start + 140));
    if (!found) continue;
    if (!noun) {
      const head = fold(found.name.split(" ")[0]);
      if (BUSINESS_NOUNS[head]) {
        noun = head;
        article = article ?? BUSINESS_NOUNS[head];
      }
    }
    return { name: found.name, article, noun, index: match.index, evidence: clip(text.slice(match.index, start + found.length)) };
  }
  return null;
}

/** "Loja X (lojax.com.br)": the capitalised words right before an address in brackets or after a colon. */
function nameBeforeAddress(masked, index) {
  const before = masked.slice(Math.max(0, index - 60), index);
  const match = /(?:^|[\s.,;:!?])(\p{Lu}[\p{L}\p{N}'’&-]*(?:\s+(?:d[aeo]s?\s+)?[\p{Lu}\p{N}][\p{L}\p{N}'’&-]*){0,3})\s*[(:–—-]\s*$/u.exec(before);
  if (!match) return null;
  const name = match[1].trim();
  const head = fold(name.split(" ")[0]);
  if (NOT_A_BRAND.has(head) || (name.split(" ").length === 1 && BUSINESS_NOUNS[head])) return null;
  const noun = BUSINESS_NOUNS[head] ? head : null;
  return { name, article: noun ? BUSINESS_NOUNS[noun] : null, noun, evidence: name };
}

// ---------------------------------------------------------------------------
// What the video promotes
// ---------------------------------------------------------------------------

const SUBJECT_NOUNS = "colecao|linha|produto|servico|curso|promocao|oferta|liquidacao|lancamento|novidade|campanha|evento|plano|pacote|kit|cardapio|aplicativo|app|ebook|e-book|livro|mentoria|aula|workshop|webinar|black friday|desconto|combo|menu|catalogo|temporada|edicao|sorteio";
const OFFER_NOUNS = "promocao|oferta|desconto|liquidacao|cupom|combo|sorteio";
const LIST_NOUNS = "dicas|erros|passos|motivos|razoes|mitos|segredos|sinais|ideias|truques|habitos|perguntas|maneiras|jeitos|formas|verdades|licoes|regras";
const SUBJECT_STOP = /,(?!\d)|\s+para\s+(?:(?:o|a|os|as)\s+)?(?:reels?|instagram|tiktok|shorts|youtube|stories|redes)\b|\s+(?:no|nos|pro|pra|em)\s+(?:reels?|instagram|tiktok|shorts|youtube|stories)\b|\.(?:\s|$)|[;\n(]|\s+[-–—]\s+/;
const VIDEO_HEAD = /\b(?:video|videos|anuncio|anuncios|reels?|animacao|animado|peca|filme|post|conteudo|divulgacao|campanha|teaser|trailer|comercial|motion|shorts|tiktok|stor(?:y|ies)|segundos|seg|s|minutos?|vertical)\b[^.\n]*$/;

const untilStop = (low, from, max = 110) => {
  const rest = low.slice(from, from + max);
  const stop = SUBJECT_STOP.exec(rest);
  return stop ? stop.index : rest.length;
};

/**
 * What the video is about, when the request says it: a collection, a product, a promotion with
 * price and date, the theme of a list. "A minha loja" means the brand as a whole.
 */
export function detectSubject(low, src = low) {
  const candidates = [];
  const take = (start, length) => {
    const text = clean(src.slice(start, start + length)).replace(/[.,;:]+$/, "");
    if (text) candidates.push({ value: text, evidence: clip(text), index: start });
  };
  let general = null;
  const owned = new RegExp(`\\b(?:d[ao]|apresent\\w+|mostr\\w+|divulg\\w+|sobre|para|pra|(?:tema|assunto)\\s+e)\\s+(?:a\\s+|o\\s+)?((?:minha|nossa|meu|nosso)\\s+(${BUSINESS_PATTERN}))\\b`, "g");
  for (const match of low.matchAll(owned)) {
    const start = match.index + match[0].length - match[1].length;
    if (THE_BUSINESS.has(match[2])) {
      general = general ?? { value: "marca em geral", evidence: clip(src.slice(start, start + match[1].length)), index: start, general: true };
      continue;
    }
    take(start, untilStop(low, start));
    break;
  }
  for (const match of low.matchAll(new RegExp(`\\b(d[ao]s?|sobre\\s+[oa]s?|divulg\\w+\\s+[oa]s?|promov\\w+\\s+[oa]s?)\\s+((?:nov[oa]s?\\s+)?(?:${SUBJECT_NOUNS})\\b)`, "g"))) {
    if (/^d[ao]s?$/.test(match[1]) && !VIDEO_HEAD.test(low.slice(Math.max(0, match.index - 70), match.index))) continue;
    const start = match.index + match[0].length - match[2].length;
    take(start, untilStop(low, start));
    break;
  }
  const offer = new RegExp(`\\bcom\\s+(?:a\\s+|o\\s+|uma\\s+|um\\s+)?((?:${OFFER_NOUNS})\\b)`).exec(low);
  if (offer) {
    const start = offer.index + offer[0].length - offer[1].length;
    take(start, untilStop(low, start));
  }
  const things = /\b(?:com|mostrando|mostra|mostrar|divulgando|divulgar|promovendo)\s+((?:as|os)\s+)?((?:pecas|produtos|itens|pratos|modelos|looks|servicos|imoveis|cursos|planos|sabores|novidades)\b)/.exec(low);
  if (things) {
    const start = things.index + things[0].length - things[2].length - (things[1] ? things[1].length : 0);
    take(start, untilStop(low, start));
  }
  const list = new RegExp(`\\b(?:\\d{1,2}|${NUMBER_WORD_PATTERN})\\s+((?:${LIST_NOUNS})\\s+(?:de|para|pra|sobre|que)\\s+[^.,;:\\n]{3,60})`).exec(low);
  if (list) take(list.index + list[0].length - list[1].length, list[1].length);
  const how = /\bcomo\s+(?:funciona|usar|fazer)\s+((?:o|a|os|as|um|uma)\s+[^.,;:\n]{3,60})/.exec(low);
  if (how) {
    const start = how.index + how[0].length - how[1].length;
    take(start, Math.min(how[1].length, untilStop(low, start)));
  }
  const topic = /\bsobre\s+(?!(?:[oa]s?|isso|isto|ele|ela|eles|elas|mim|nos|voce|aquilo|tudo)\b)([a-z][^\n.;,(]{2,60})/.exec(low);
  if (topic) {
    const start = topic.index + topic[0].length - topic[1].length;
    if (!/^\p{Lu}/u.test(src.slice(start, start + 1))) take(start, untilStop(low, start, 70));
  }
  if (candidates.length) return candidates.sort((a, b) => a.index - b.index)[0];
  if (general) return general;
  const price = /r\$\s?\d[\d.,]*/.exec(low);
  if (price) {
    const before = low.slice(0, price.index);
    const from = Math.max(before.lastIndexOf(". ") + 2, before.lastIndexOf("\n") + 1, before.lastIndexOf(": ") + 2, 0);
    const lead = /^(?:(?:quero|faz|faca|cria|crie|preciso de)\s+(?:um|uma)\s+\S+\s+(?:de\s+\d+\s*\w+\s+)?(?:d[ao]s?\s+)?|(?:vend[ae]r?|anunci[ae]r?|divulg[ae]r?|promov[ae]r?|mostr[ae]r?|oferec[ae]r?)\s+)/.exec(low.slice(from));
    const start = from + (lead ? lead[0].length : 0);
    take(start, untilStop(low, start, 140));
    if (candidates.length) return candidates[0];
  }
  return null;
}

// ---------------------------------------------------------------------------
// The opening and the ending
// ---------------------------------------------------------------------------

const HOOK_CUE = /\b(?:abr[ae]|abrir|abrindo|comec[ae]|comecar|comecando|inici[ae]|gancho|abertura|primeira frase|primeiro texto|opens?|hook|starts?)\b/g;
const TEXT_CUE = /\b(?:a frase|o texto|escrito|dizendo|o titulo)\b/g;
const CLOSING_CUE = /\b(?:fech[ae]|fechar|fechando|termin[ae]|terminar|encerr[ae]|finaliz[ae]|assinatura|no final|ao final|no fim|cta|chamada final|ends?|closing)\b/g;
const DIRECTION = /\b(?:palavras?|tipografi\w+|problema|pergunta|frase|texto|cena|imagem|logo|produto|tela|interface|animacao|numero|dado)\b/;

const lastOf = (text, pattern) => {
  let last = -1;
  for (const match of text.matchAll(pattern)) last = match.index;
  return last;
};

/** Which cue comes last before a quote, on the same line: the opening, the ending, or neither. */
function cueBefore(low, index) {
  const from = Math.max(low.lastIndexOf("\n", index - 1) + 1, index - 80);
  const before = low.slice(from, index);
  const hook = lastOf(before, HOOK_CUE);
  const closing = lastOf(before, CLOSING_CUE);
  const plain = lastOf(before, TEXT_CUE);
  if (closing >= 0 && closing > hook) return { kind: "closing", index: from + closing };
  if (hook >= 0) return { kind: "hook", index: from + hook };
  if (plain >= 0) return { kind: "hook", index: from + plain };
  return null;
}

function closingFromText(text) {
  const low = fold(text);
  if (/\blink (?:na|da) bio\b|link in bio/.test(low)) return { kind: "bio", text: "Link na bio" };
  if (/\b(?:whatsapp|whats|zap|wpp)\b/.test(low)) return { kind: "whatsapp", text: wordCount(text) <= LIMITS.closing_words ? capitalize(clean(text).replace(/\b(?:whats(?:app)?|zap|wpp)\b/i, "WhatsApp")) : "Chama no WhatsApp" };
  const handle = findHandles(text)[0];
  if (handle) return { kind: "perfil", text: handle };
  const address = findUrls(text)[0];
  if (address && address.kind === "site") return { kind: "site", text: address.host };
  const phrase = shortenWords(text, LIMITS.closing_words);
  return phrase ? { kind: "frase", text: capitalize(phrase) } : null;
}

/** How the video ends, when the request says it. `low` and `src` are the whole text, addresses included. */
export function detectClosing(low, src, { quoted = [], urls = [] } = {}) {
  for (const match of low.matchAll(CLOSING_CUE)) {
    const end = match.index + match[0].length;
    const stop = /[.\n]/.exec(low.slice(end, end + 110).replace(/\.(?=[a-z0-9])/g, " "));
    const length = stop ? stop.index : Math.min(110, low.length - end);
    const segment = src.slice(end, end + length);
    const evidence = clip(src.slice(match.index, end + length));
    const quote = quoted.find((item) => item.index >= end && item.index < end + length + 2);
    if (quote) {
      const found = closingFromText(quote.text);
      if (found) return { value: found, evidence };
    }
    const address = urls.find((item) => item.index >= end && item.index <= end + length);
    if (address && address.kind === "site") return { value: { kind: "site", text: address.host }, evidence };
    const lowSegment = fold(segment);
    if (/\blink (?:na|da) bio\b|link in bio/.test(lowSegment)) return { value: { kind: "bio", text: "Link na bio" }, evidence };
    if (/\b(?:whatsapp|whats|zap|wpp)\b/.test(lowSegment)) return { value: { kind: "whatsapp", text: "Chama no WhatsApp" }, evidence };
    const handle = findHandles(segment)[0];
    if (handle) return { value: { kind: "perfil", text: handle }, evidence };
    const comment = /\bcoment[ae]\s+["“'‘]?([\p{L}\p{N}]{2,20})/iu.exec(segment);
    if (comment) return { value: { kind: "frase", text: `Comente ${comment[1].toUpperCase()}` }, evidence };
    if (/\b(?:o endereco|o site|o link do site|endereco do site|the url|the website)\b/.test(lowSegment)) return { value: { kind: "site", text: null }, evidence };
    if (/\b(?:o @|o perfil|o instagram|o arroba)\b/.test(lowSegment)) return { value: { kind: "perfil", text: null }, evidence };
  }
  const bio = /\blink (?:na|da) bio\b|link in bio/.exec(low);
  if (bio) return { value: { kind: "bio", text: "Link na bio" }, evidence: clip(src.slice(bio.index, bio.index + bio[0].length)) };
  const whats = /\b(?:cham[ae]|chamar|fal[ae]|falar|mand[ae]|pec[ae])\w*\s+(?:no|pelo|la no|a gente no)\s+(?:whatsapp|whats|zap|wpp)\b/.exec(low);
  if (whats) return { value: { kind: "whatsapp", text: "Chama no WhatsApp" }, evidence: clip(src.slice(whats.index, whats.index + whats[0].length)) };
  const comment = /\bcoment[ae]\s+["“'‘]?(\p{Lu}[\p{Lu}\p{N}]{1,19})(?![\p{Ll}])/u.exec(src);
  if (comment) return { value: { kind: "frase", text: `Comente ${comment[1]}` }, evidence: clip(comment[0]) };
  return null;
}

function hookValue(text, evidence) {
  const flat = clean(text).replace(/[.]+$/, "");
  const result = { value: shortenWords(flat, LIMITS.hook_words), evidence: clip(evidence) };
  if (wordCount(flat) > LIMITS.hook_words) result.note = `A frase pedida tem ${wordCount(flat)} palavras (“${clip(flat, 120)}”); na tela cabem ${LIMITS.hook_words}.`;
  return result;
}

/**
 * The opening line when the request writes it ({ value }), or the way it should be when the
 * request only describes it ({ direction }). `low` and `src` are the whole text.
 */
export function detectHook(low, src, { quoted = [] } = {}) {
  for (const quote of quoted) {
    const cue = cueBefore(low, quote.index);
    if (cue?.kind === "hook") return hookValue(quote.text, src.slice(cue.index, quote.index + quote.length));
  }
  for (const pattern of [/\bgancho\s*:\s*([^\n.;]+)/, /\b(?:abr[ae]|comec[ae]|inici[ae])\s+(?:o video\s+)?com\s*:?\s*([^\n.;,]+)/, /\babertura\s*:\s*([^\n.;]+)/]) {
    const match = pattern.exec(low);
    if (!match) continue;
    const start = match.index + match[0].length - match[1].length;
    const text = clean(src.slice(start, start + match[1].length));
    if (/^["“«'‘]/.test(text)) continue;
    const lowText = fold(text);
    if (wordCount(text) > LIMITS.hook_words || DIRECTION.test(lowText) || /^(?:o|a|os|as|um|uma)\s/.test(lowText)) return { direction: clip(text, 140) };
    return hookValue(text, src.slice(match.index, start + match[1].length));
  }
  return /\bgancho\b/.test(low) ? { direction: "um gancho, sem a frase escrita" } : null;
}

// ---------------------------------------------------------------------------
// What this version does not do
// ---------------------------------------------------------------------------

const MEDIA_FILE = /[\w\-./\\]*[\w-]\.(?:mp4|mov|mkv|avi|webm|m4v|mts)\b/gi;
const ANY_FILE = /[\w\-./\\]*[\w-]\.(?:mp4|mov|mkv|avi|webm|m4v|mts|mp3|wav|m4a|aac|ogg|flac|png|jpe?g|gif|svg|webp|pdf|md|json|html?|txt|srt|py|mjs|js|css)\b/gi;
const OUTPUT_BEFORE = /(?:\bsalv\w+|\bexport\w+|\brenderiz\w+|\bgrav[ae]\b|\bentreg\w+|\bsaida\b|\boutput\b|\bsave\b)[^\n]{0,60}$/;

function detectUnsupported(low, src, { urls = [], duration = null } = {}) {
  const list = [];
  const quote = (index, length) => clip(src.slice(index, index + length));

  // a recording to edit
  let edit = null;
  const editing = /\bedit(?:e|a|ar|ando|em)\b[^.\n]{0,60}?\b(?:video|videos|gravacao|gravacoes|aula|aulas|live|podcast|arquivo|material|filmagem|cortes?|takes?|bruto|footage|recording)\b(?:-?[\w-]*\.(?:mp4|mov|mkv|avi|webm|m4v))?|\bedit (?:this|my|the) (?:video|recording|footage)\b/.exec(low);
  if (editing) edit = quote(editing.index, editing[0].length);
  if (!edit) {
    for (const match of src.matchAll(MEDIA_FILE)) {
      if (OUTPUT_BEFORE.test(low.slice(Math.max(0, match.index - 70), match.index))) continue;
      edit = match[0];
      break;
    }
  }
  if (!edit) {
    for (const match of low.matchAll(/\b(?:gravacao|gravacoes|gravei|filmagem|filmei|video bruto|material bruto|my recording)\b/g)) {
      if (isNegated(low, match.index)) continue;
      edit = quote(match.index, match[0].length);
      break;
    }
  }
  if (!edit) {
    const captions = /\b(?:legendas?|legendar)\b[^.\n]{0,28}\b(?:fala|falas|voz|audio|que eu falo|palavra por palavra)\b|\btranscrev\w+|\btranscricao\b|\b(?:cort[ae]r?|tir[ae]r?|remov[ae]r?)\s+(?:as\s+|os\s+)?(?:pausas|silencios|erros de fala)\b|\bcaptions on (?:my|the) speech\b/.exec(low);
    if (captions) edit = quote(captions.index, captions[0].length);
  }
  if (edit) list.push({ kind: "edit", evidence: edit });

  // scenes made by a generator
  const generated =
    /\b(?:higgsfield|seedance|midjourney|kling|dall-?e|gpt image|nano banana|stable diffusion|heygen)\b/.exec(low) ??
    /\bcenas?\s+gerad[ao]s?\b|\b(?:imagens?|fotos?|cenas?|pessoas|modelos|personagens)\s+(?:gerad[ao]s?|criad[ao]s?|feit[ao]s?)\s+(?:com|por|pela|pelo|na|no)\s+(?:ia|inteligencia artificial)\b/.exec(low) ??
    /\bger(?:a|e|ar|ando|em)\s+(?:(?:os|uns|novos)\s+)?videos?\s+(?:de|com)\s+(?:pessoas|modelos|atores|atrizes|gente|clientes|alguem)\b/.exec(low) ??
    /\bger(?:a|e|ar|ando|em)\s+(?:(?:as|os|umas?|uns|novas?|algumas?)\s+)?(?:imagens?|cenas?|fotos?|pessoas|modelos|personagens|avatar(?:es)?)\b/.exec(low) ??
    /\bpessoas reais\b|\bmodelos? (?:reais|humanos|masculinos|femininos)\b|\b(?:avatar|deepfake|clone de voz|voz clonada|narracao (?:de|com|por) ia|locucao (?:de|com|por) ia)\b/.exec(low) ??
    /\b(?:cenas?|imagens?|fotos?|pessoas)\b[^.\n]{0,30}\b(?:com|de|por)\s+(?:ia|inteligencia artificial)\b|\b(?:generate|generated|ai-generated)\s+(?:images?|scenes?|people|footage)\b/.exec(low);
  if (generated) list.push({ kind: "generated", evidence: quote(generated.index, generated[0].length) });

  // another shape of screen
  const formats = [];
  const addFormat = (text) => {
    if (text && !formats.some((item) => fold(item) === fold(text))) formats.push(text);
  };
  for (const match of low.matchAll(/(?<![\d:])(?:16\s?[:x]\s?9|1\s?[:x]\s?1|4\s?[:x]\s?5)(?![\d:])/g)) addFormat(match[0].replace(/\s/g, "").replace("x", ":"));
  for (const match of low.matchAll(/\b(?:horizontal|deitad[oa]|paisagem|landscape|widescreen|quadrad[oa]|square)\b/g)) addFormat(quote(match.index, match[0].length));
  if (!formats.length) for (const match of low.matchAll(/\b(?:1920\s?x\s?1080|1080\s?x\s?1080|1080\s?x\s?1350)\b/g)) addFormat(match[0].replace(/\s/g, ""));
  for (const match of low.matchAll(/\b(?:para o|pro|no|pra|para|em|canal (?:do|no))\s+youtube\b(?!\s*shorts)/g)) {
    if (/\bshorts\s+(?:d[oe]|n[oa])\s+youtube/.test(low.slice(Math.max(0, match.index - 10), match.index + match[0].length))) continue;
    addFormat("YouTube");
  }
  for (const match of low.matchAll(/\blinkedin\b/g)) addFormat(quote(match.index, match[0].length));
  if (formats.length) list.push({ kind: "format", evidence: formats.join(", ") });

  // a reference to study
  if (!edit) {
    const video = urls.find((url) => url.kind === "video");
    const study =
      /\b(?:analis[ae]r?|estud[ae]r?|assist[ae]r?)\b[^.\n]{0,25}\b(?:(?:n?este|n?esse|n?aquele)\s+(?:video|reels?|filme|comercial|anuncio)|(?:o|ao)\s+video de referencia)\b/.exec(low) ??
      /\b(?:no estilo|no mesmo estilo|no jeito|no ritmo|igual a[o]?|inspirad[oa] n[oa]|basead[oa] n[oa])\s+(?:d?(?:este|esse|aquele)\s+)?(?:video|reels?|filme)\b|\b(?:analy[sz]e|study|watch) this video\b|\blike this video\b/.exec(low);
    if (video || study) list.push({ kind: "reference_study", evidence: video ? video.url : quote(study.index, study[0].length) });
  }

  if (duration?.long) list.push({ kind: "long", evidence: duration.evidence });
  return list;
}

// ---------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------

/**
 * Reads a request. `fields` holds only what the words say, each with `source: "pedido"` and the
 * words as `evidence`; `unsupported` lists what this version does not do; `signals` keeps the raw
 * finds (addresses, @, quotes, list lines, video links) and what the request describes without
 * writing it out (`directions`: an opening it wants, a count of points, a proof to look for).
 */
export function parseRequest(text) {
  const src = String(text ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").normalize("NFC");
  const fields = {};
  const set = (name, value, evidence, extra = {}) => {
    fields[name] = { value, source: "pedido", evidence: clip(evidence), ...extra };
  };

  // Four views of the same text, all with the same length, so an index means the same place in
  // each: without addresses (names, @), without what is inside quotes (a quoted line is content,
  // not a wish), without file names (a path is not a sentence) and flat, for words broken by a line end.
  const urls = findUrls(src);
  const masked = withoutAddresses(src, urls);
  const quoted = findQuoted(src);
  let unquoted = masked;
  for (const quote of quoted) unquoted = blank(unquoted, quote.index + 1, quote.length - 2);
  let bare = unquoted;
  for (const match of unquoted.matchAll(ANY_FILE)) bare = blank(bare, match.index, match[0].length);
  const low = fold(bare);
  const flat = low.replace(/\n/g, " ");
  const lowFull = fold(src);

  const sites = urls.filter((url) => url.kind === "site");
  const videos = urls.filter((url) => url.kind === "video");
  const profiles = urls.filter((url) => url.kind === "profile");
  const handles = [];
  for (const match of masked.matchAll(HANDLE)) if (!handles.includes(`@${match[1]}`)) handles.push(`@${match[1]}`);
  for (const profile of profiles) {
    const handle = handleOfUrl(profile.url);
    if (handle && !handles.includes(handle)) handles.push(handle);
  }
  const listItems = findListItems(src);
  const chain = findArrowChain(masked);

  // the duration first: asking for a long piece is also something this version does not do
  const duration = detectDuration(flat, bare);
  const unsupported = detectUnsupported(fold(unquoted), unquoted, { urls, duration });
  const isEdit = unsupported.some((item) => item.kind === "edit");

  // the brand: a site, an @, a name; or the request says there is none
  const site = sites[0] ?? null;
  const named = detectBrandName(masked) ?? (site ? nameBeforeAddress(masked, site.index) : null);
  if (site || handles.length || named) {
    let article = named?.article ?? null;
    if (!article && site) {
      const before = /\b(d[ao])s?\s+$/.exec(lowFull.slice(Math.max(0, site.index - 6), site.index));
      if (before) article = before[1] === "da" ? "a" : "o";
    }
    const value = { name: named?.name ?? null, site: site?.url ?? null, handle: handles[0] ?? null };
    if (article) value.article = article;
    if (named?.noun) value.noun = named.noun;
    set("brand", value, [named?.evidence, site?.raw, !site && !named ? handles[0] : null].filter(Boolean).join(" · "));
  } else {
    const none = /\b(?:sem (?:nenhuma )?marca|nao (?:tem|tenho|e de) (?:nenhuma )?marca|video neutro)\b/.exec(flat);
    if (none) set("brand", { name: null, site: null, handle: null }, bare.slice(none.index, none.index + none[0].length));
  }

  const objective = detectObjective(flat, bare);
  if (objective) set("objective", objective.value, objective.evidence);

  const subject = detectSubject(low, bare);
  if (subject) set("subject", subject.value, subject.evidence);

  const destinations = detectDestinations(flat, bare);
  if (destinations) set("destinations", destinations.value, destinations.evidence);

  if (duration) set("duration", duration.value, duration.evidence);

  const template = detectTemplate(flat, bare);
  if (template) set("template", template.value, template.evidence);
  else if (chain.length >= 4) set("template", "interface", `uma sequência de ${chain.length} estados com setas`);

  // the points: the steps of an arrow chain, the things of a list, or "três recursos: a, b e c"
  const directions = {};
  const contentItems = listItems.filter((item) => isContentItem(item.text));
  let points = null;
  if (chain.length) points = { items: chain.slice(0, LIMITS.states), total: chain.length, evidence: chain.join(" → ") };
  if (!points && contentItems.length >= 2) points = { items: contentItems.slice(0, LIMITS.points).map((item) => item.text.replace(/[.;,]+$/, "")), total: contentItems.length, evidence: contentItems.map((item) => item.text).join(" · ") };
  if (!points) {
    const lowMasked = fold(masked);
    const inline = new RegExp(`\\b(?:(?:\\d{1,2}|${NUMBER_WORD_PATTERN})\\s+)?(?:${POINT_NOUNS})\\b[^:\\n.;]{0,40}:\\s*([^\\n.;]+)`, "g");
    const shown = /\b(?:mostr[ae]r?|mostrando|destac[ae]r?|destacando|show(?:s|ing)?)\s*:\s*([^\n.;]+)/g;
    const loose = /\bmostrando\s+(?!que\b)([^\n.;:]+)/g;
    search: for (const [pattern, minimum, strict] of [[inline, 2, false], [shown, 2, false], [loose, 3, true]]) {
      for (const match of lowMasked.matchAll(pattern)) {
        const start = match.index + match[0].length - match[1].length;
        const piece = masked.slice(start, start + match[1].length);
        if (strict && !/,[^,]*\s(?:e|and)\s+[^,]+$/i.test(piece)) continue;
        const items = splitList(piece).filter((item) => storyRole(item) === null);
        if (items.length < minimum || items.some((item) => wordCount(item) > LIMITS.point_words)) continue;
        points = { items: items.slice(0, LIMITS.points), total: items.length, evidence: masked.slice(match.index, start + match[1].length) };
        break search;
      }
    }
  }
  if (points) {
    const extra = points.total > points.items.length ? ` (usei ${points.items.length} de ${points.total})` : "";
    set("points", points.items, `${clip(points.evidence, 80)}${extra}`);
  } else {
    const counted = new RegExp(`\\b(\\d{1,2}|${NUMBER_WORD_PATTERN})\\s+(?:${POINT_NOUNS})\\b`).exec(flat);
    const count = counted ? countOf(counted[1]) : null;
    if (count && count >= 2 && count <= LIMITS.states) directions.points = { count, evidence: clip(bare.slice(counted.index, counted.index + counted[0].length)) };
  }

  const hook = detectHook(lowFull, src, { quoted });
  if (hook?.value) set("hook", hook.value, hook.evidence, hook.note ? { note: hook.note } : {});
  else if (hook?.direction) directions.hook = hook.direction;

  const proof = detectProof(low, bare);
  if (proof) set("proof", proof.value, proof.evidence);
  else {
    const wanted = /\b(?:numero que prov\w+|prova social|que prov[ae] que funciona|da resultado|dao resultado|resultados? reais|numero publicado)\b/.exec(flat);
    if (wanted) directions.proof = clip(bare.slice(wanted.index, wanted.index + wanted[0].length));
  }

  const tone = detectTone(flat, bare);
  if (tone) set("tone", tone.value, tone.evidence);

  const namedStyle = detectStyle(flat, bare);
  if (videos.length && !isEdit) {
    const value = { reference: videos[0].url, description: null };
    if (namedStyle) value.base = namedStyle.value;
    set("style", value, videos[0].raw);
  } else if (namedStyle) set("style", namedStyle.value, namedStyle.evidence);

  const audioFile = AUDIO_FILE.exec(unquoted);
  const music = detectMusic(flat, bare, audioFile ? audioFile[0] : null);
  if (music) set("music", music.value, music.evidence);

  const closing = detectClosing(lowFull, src, { quoted, urls });
  if (closing) set("closing", closing.value, closing.evidence);

  // a line of the list that describes the opening or the ending is not a point: its words in quotes
  // are the opening or the ending, when the request did not already say them
  for (const item of listItems) {
    const role = storyRole(item.text);
    if (role !== "hook" && role !== "closing") continue;
    const said = findQuoted(item.text)[0];
    if (!said) continue;
    if (role === "hook" && !fields.hook) {
      const opening = hookValue(said.text, item.text);
      set("hook", opening.value, opening.evidence, opening.note ? { note: opening.note } : {});
    } else if (role === "closing" && !fields.closing?.value?.text) {
      const ending = closingFromText(said.text);
      if (ending) set("closing", ending, item.text);
    }
  }

  const skip = detectSkipPreview(flat, bare);
  if (skip) set("skip_preview", true, skip.evidence);

  const tempo = /\b(\d{2,3})\s*bpm\b/.exec(flat);
  return {
    fields,
    unsupported,
    signals: {
      urls: urls.map((url) => url.url),
      handles,
      quoted: quoted.map((quote) => quote.text),
      numbered_lines: listItems.map((item) => item.text),
      video_links: videos.map((url) => url.url),
      sites: sites.map((url) => url.url),
      profiles: profiles.map((url) => url.url),
      arrow_steps: chain,
      directions,
      bpm: tempo ? Number(tempo[1]) : null,
    },
  };
}
