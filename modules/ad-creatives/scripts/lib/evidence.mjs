// The evidence of a campaign (evidencias.json, version 1): every item carries its origin and its
// date, and every number in it was converted here from the text the AI copied, never by the AI.
// Readings come in through `import`; the summary (`evidence`) applies the thresholds of D12.

import { existsSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { isFile } from "./files.mjs";
import { AppError, readJson, slugify } from "./util.mjs";

export const EVIDENCE_VERSION = 1;
export const KINDS = ["competitor_ad", "organic_post", "organic_pattern", "audience_comment", "own_result"];
export const SOURCE_TYPES = ["apify", "link", "screenshot", "export", "declared"];
/** D11: the independent kinds of source a concept can stand on. */
export const SOURCE_FAMILY = { competitor_ad: "anuncio", organic_post: "organico", organic_pattern: "organico", audience_comment: "publico", own_result: "resultado" };
export const FAMILY_LABELS = { anuncio: "anúncio de concorrente", organico: "orgânico medido", publico: "fala do público", resultado: "resultado próprio" };

/** D12: the reading of competitors' ads. */
export const RULES = {
  cards_per_competitor: 10,
  kept_days: 30,
  pattern_min_competitors: 2,
  indication_below_active: 3,
};

const MONTHS = {
  jan: 1, janeiro: 1, january: 1,
  fev: 2, fevereiro: 2, feb: 2, february: 2,
  mar: 3, marco: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4,
  mai: 5, maio: 5, may: 5,
  jun: 6, junho: 6, june: 6,
  jul: 7, julho: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8,
  set: 9, setembro: 9, sep: 9, sept: 9, september: 9,
  out: 10, outubro: 10, oct: 10, october: 10,
  nov: 11, novembro: 11, november: 11,
  dez: 12, dezembro: 12, dec: 12, december: 12,
};

const foldText = (text) => String(text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const pad = (value) => String(value).padStart(2, "0");
const isoOf = (year, month, day) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
};

/** Every date written in a text, in order: "3 de jul de 2026", "Jul 3, 2026", "03/07/2026", "2026-07-03". */
export function datesIn(text) {
  const source = foldText(text).replace(/\./g, " ");
  const found = [];
  const patterns = [
    [/(\d{1,2})\s*(?:de\s+)?([a-z]{3,9})\s*(?:de\s+)?(\d{4})/g, (m) => isoOf(Number(m[3]), MONTHS[m[2]], Number(m[1])), (m) => MONTHS[m[2]]],
    [/([a-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/g, (m) => isoOf(Number(m[3]), MONTHS[m[1]], Number(m[2])), (m) => MONTHS[m[1]]],
    [/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, (m) => isoOf(Number(m[3]), Number(m[2]), Number(m[1])), () => true],
    [/(\d{4})-(\d{2})-(\d{2})/g, (m) => isoOf(Number(m[1]), Number(m[2]), Number(m[3])), () => true],
  ];
  for (const [pattern, toIso, known] of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (!known(match)) continue;
      const iso = toIso(match);
      if (iso) found.push({ index: match.index, iso });
    }
  }
  return found.sort((a, b) => a.index - b.index).map((entry) => entry.iso);
}

/**
 * "Veiculação iniciada em 3 de jul de 2026" → { start, end: null }; "Veiculado de 3 de jul de 2026
 * a 10 de ago de 2026" → { start, end }. Null when no full date (with the year) is there.
 */
export function parseRunDates(text) {
  const dates = [...new Set(datesIn(text))];
  if (!dates.length) return null;
  return { start: dates[0], end: dates.length > 1 ? dates[dates.length - 1] : null };
}

/** "3 anúncios usam esse criativo e esse texto" → 3. Null when the text has no count. */
export function parseVariations(text) {
  const folded = foldText(text);
  const match =
    /(\d+)\s+(?:anuncios?|ads?)\s+(?:usam|use|uses)/.exec(folded) ??
    /(\d+)\s+(?:versoes|versao|versions?|variacoes|variacao)/.exec(folded) ??
    /^\s*(\d+)\s*$/.exec(folded);
  return match ? Number(match[1]) : null;
}

/** "Ativo" → true, "Inativo" → false, anything else → null. */
export function parseStatus(text) {
  const folded = foldText(text).trim();
  if (/^(?:inativo|inactive|encerrado|ended)/.test(folded)) return false;
  if (/^(?:ativo|active|em veiculacao)/.test(folded)) return true;
  return null;
}

/** "12,3 mil" → 12300, "1,2 mi" → 1200000, "4.512" → 4512, "1.2K" → 1200. Null when not a number. */
export function parseCount(text) {
  if (typeof text === "number") return Number.isFinite(text) ? text : null;
  const folded = foldText(text).replace(/\s+/g, " ").trim();
  const match = /^(\d+(?:[.,]\d+)*)\s*(mil|mi|milhoes|milhao|bi|k|m|b)?\b/.exec(folded.replace(/\s*(?:visualizacoes|views|plays|reproducoes|curtidas|likes)$/, ""));
  if (!match) return null;
  const [, digits, unit] = match;
  let value;
  if (unit) value = Number(digits.replace(",", "."));
  else if (/^\d{1,3}(?:\.\d{3})+$/.test(digits) || /^\d{1,3}(?:,\d{3})+$/.test(digits)) value = Number(digits.replace(/[.,]/g, ""));
  else value = Number(digits.replace(",", "."));
  if (!Number.isFinite(value)) return null;
  const factor = { mil: 1e3, k: 1e3, mi: 1e6, m: 1e6, milhao: 1e6, milhoes: 1e6, bi: 1e9, b: 1e9 }[unit] ?? 1;
  return Math.round(value * factor);
}

/** Whole days between two ISO days (YYYY-MM-DD). */
export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const invalid = (file, path, problem, fix) =>
  new AppError("reading_invalid", `A leitura ${file} tem um problema em ${path}: ${problem}`, fix ?? "Copie o texto exatamente como aparece na tela e grave de novo; o app converte datas e números, você não.");

// ---------------------------------------------------------------- the file

export function readEvidence(path, campaign) {
  const data = readJson(path, null);
  if (data && Array.isArray(data.items)) return data;
  return { version: EVIDENCE_VERSION, campaign, updated_at: null, items: [] };
}

/** Puts items in the evidence, replacing those with the same id. Returns the ids added and replaced. */
export function mergeItems(evidence, items) {
  const added = [];
  const replaced = [];
  for (const item of items) {
    const index = evidence.items.findIndex((existing) => existing.id === item.id);
    if (index >= 0) {
      // the AI's tags and exclusions survive a new reading of the same ad
      const previous = evidence.items[index];
      evidence.items[index] = { ...item, tags: { ...(previous.tags ?? {}), ...(item.tags ?? {}) }, group: item.group ?? previous.group ?? null, excluded: item.excluded ?? previous.excluded ?? false };
      replaced.push(item.id);
    } else {
      evidence.items.push(item);
      added.push(item.id);
    }
  }
  evidence.updated_at = new Date().toISOString();
  return { added, replaced };
}

// ---------------------------------------------------------------- readings

/** A file the reading cites, inside the project: relative to the campaign folder or to the root. */
function projectFile(root, campaignDir, path) {
  if (typeof path !== "string" || !path.trim()) return null;
  for (const base of [campaignDir, root]) {
    const full = resolve(base, path);
    const inside = relative(root, full);
    if (inside.startsWith("..") || isAbsolute(inside)) continue;
    if (isFile(full)) return inside.split(sep).join("/");
  }
  return null;
}

function checkCollected(file, value, today) {
  if (typeof value !== "string" || !ISO_DAY.test(value)) throw invalid(file, "collected_at", "falta a data da coleta, no formato AAAA-MM-DD.", "Grave a data em que a captura foi feita (collected_at), como 2026-10-12.");
  if (value > today) throw invalid(file, "collected_at", `a data ${value} ainda não chegou.`, "Use a data em que a captura foi feita.");
  return value;
}

function checkTags(file, path, tags, labels) {
  if (tags === undefined || tags === null) return {};
  if (typeof tags !== "object" || Array.isArray(tags)) throw invalid(file, path, "as etiquetas precisam ser um objeto { dimensão: valor }.");
  const out = {};
  for (const [dimension, value] of Object.entries(tags)) {
    const spec = labels?.dimensions?.[dimension];
    if (!spec) throw invalid(file, `${path}.${dimension}`, `a dimensão "${dimension}" não existe. As dimensões são: ${Object.keys(labels?.dimensions ?? {}).join(", ")}.`, "Use as dimensões e os valores de references/etiquetas.json.");
    if (spec.free) {
      if (typeof value !== "string" || !new RegExp(spec.pattern ?? "^[a-z0-9-]+$").test(value)) throw invalid(file, `${path}.${dimension}`, `"${value}" não é um valor válido: use minúsculas sem acento e hífens.`);
    } else if (!Object.hasOwn(spec.values ?? {}, value)) {
      throw invalid(file, `${path}.${dimension}`, `"${value}" não está na lista. Os valores são: ${Object.keys(spec.values ?? {}).join(", ")}.`, "Use os valores de references/etiquetas.json.");
    }
    out[dimension] = value;
  }
  return out;
}

const MEDIA = { video: "video", vídeo: "video", imagem: "image", image: "image", foto: "image", carrossel: "carousel", carousel: "carousel" };

/**
 * A reading of competitors' ad cards (kind "ad_cards"): screenshots the member brought or links
 * of ads, with the texts copied as they appear. Becomes `competitor_ad` items.
 */
export function adCardsToItems(reading, { file, root, campaignDir, labels, today }) {
  const competitor = typeof reading.competitor === "string" ? reading.competitor.trim() : "";
  if (!competitor) throw invalid(file, "competitor", "falta o nome do concorrente, como aparece na página.");
  const collected = checkCollected(file, reading.collected_at, today);
  const sourceType = reading.source?.type;
  if (!["screenshot", "link"].includes(sourceType)) throw invalid(file, "source.type", 'a origem de uma leitura de anúncios é "screenshot" (capturas de tela) ou "link" (links dos anúncios).');
  if (!Array.isArray(reading.items) || !reading.items.length) throw invalid(file, "items", "a leitura não tem nenhum cartão.");
  if (reading.items.length > 30) throw invalid(file, "items", `${reading.items.length} cartões: o máximo por leitura é 30.`);
  const readingCapture = projectFile(root, campaignDir, reading.source?.ref);
  const slug = slugify(competitor, 30);
  return reading.items.map((card, index) => {
    const path = `items[${index}]`;
    if (!card || typeof card !== "object") throw invalid(file, path, "cada cartão é um objeto.");
    const capture = card.capture !== undefined ? projectFile(root, campaignDir, card.capture) : readingCapture;
    if (sourceType === "screenshot" && !capture) {
      throw invalid(file, `${path}.capture`, card.capture ? `não encontrei a captura ${card.capture} no projeto.` : "falta a captura de origem deste cartão.", "Cada cartão aponta a captura de onde foi lido (capture), salva em pesquisa/capturas/<concorrente>/. Sem a captura, o cartão não entra.");
    }
    const url = typeof card.url === "string" && /^https?:\/\//.test(card.url) ? card.url : null;
    if (sourceType === "link" && !url) throw invalid(file, `${path}.url`, "um cartão lido por link precisa do endereço do anúncio.");
    let run = null;
    if (card.started_text !== undefined && card.started_text !== null && card.started_text !== "") {
      run = parseRunDates(card.started_text);
      if (!run) throw invalid(file, `${path}.started_text`, `não entendi a data em "${card.started_text}".`, 'Copie a linha da data exatamente como aparece, com o ano, como "Veiculação iniciada em 3 de jul de 2026".');
      if (run.start > collected) throw invalid(file, `${path}.started_text`, `a data ${run.start} é depois da coleta (${collected}).`);
    }
    let variations = 1;
    if (card.variations_text !== undefined && card.variations_text !== null && card.variations_text !== "") {
      variations = parseVariations(card.variations_text);
      if (variations === null) throw invalid(file, `${path}.variations_text`, `não entendi o número de versões em "${card.variations_text}".`, 'Copie a linha como aparece, como "3 anúncios usam esse criativo e esse texto".');
    }
    let active = card.status_text !== undefined ? parseStatus(card.status_text) : null;
    if (card.status_text !== undefined && active === null) throw invalid(file, `${path}.status_text`, `não entendi o estado em "${card.status_text}" (Ativo ou Inativo).`);
    if (active === null) active = run?.end ? false : true;
    const end = run?.end && !active ? run.end : null;
    const libraryId = /(\d{6,20})/.exec(String(card.library_id ?? card.library_id_text ?? url ?? ""))?.[1] ?? null;
    const media = card.media === undefined ? null : MEDIA[foldText(card.media).trim()] ?? null;
    if (card.media !== undefined && !media) throw invalid(file, `${path}.media`, `"${card.media}" não é um tipo de mídia conhecido (video, imagem ou carrossel).`);
    return {
      // without the library's id, the position on the screen of that day's collection names the card
      id: `ad-${slug}-${libraryId ?? `${collected.replace(/-/g, "")}-c${String(index + 1).padStart(2, "0")}`}`,
      kind: "competitor_ad",
      source: { type: sourceType, ref: capture ?? url, collected_at: collected, reading: file },
      who: competitor,
      data: {
        library_id: libraryId,
        position: index + 1,
        started_at: run?.start ?? null,
        ended_at: end,
        active,
        days_active: run?.start ? daysBetween(run.start, end ?? collected) : null,
        variations,
        text: typeof card.text === "string" ? card.text.trim() : null,
        headline: typeof card.headline === "string" ? card.headline.trim() : null,
        cta: typeof card.cta === "string" ? card.cta.trim() : null,
        media,
        platforms: typeof card.platforms_text === "string" ? card.platforms_text.split(/[,;]/).map((item) => item.trim()).filter(Boolean) : [],
        url,
      },
      tags: checkTags(file, `${path}.tags`, card.tags, labels),
      group: typeof card.group === "string" ? card.group : null,
      excluded: false,
    };
  });
}

/** What the member says (kind "declared"): the audience's words, own results, organic numbers. */
export function declaredToItems(reading, { file, root, campaignDir, labels, today }) {
  const collected = checkCollected(file, reading.collected_at, today);
  if (!Array.isArray(reading.items) || !reading.items.length) throw invalid(file, "items", "a leitura não tem nenhum item.");
  const sourceType = SOURCE_TYPES.includes(reading.source?.type) ? reading.source.type : "declared";
  const ref = typeof reading.source?.ref === "string" ? reading.source.ref : "conversa com o integrante";
  return reading.items.map((entry, index) => {
    const path = `items[${index}]`;
    const kind = entry?.kind;
    if (!KINDS.includes(kind) || kind === "competitor_ad") throw invalid(file, `${path}.kind`, `o tipo precisa ser audience_comment, own_result, organic_post ou organic_pattern (veio "${kind}").`, "Anúncios de concorrentes entram por uma leitura ad_cards.");
    const text = typeof entry.text === "string" ? entry.text.trim() : "";
    if (!text) throw invalid(file, `${path}.text`, "falta o texto do item, como o integrante disse ou como aparece.");
    const capture = entry.capture !== undefined ? projectFile(root, campaignDir, entry.capture) : null;
    if (entry.capture !== undefined && !capture) throw invalid(file, `${path}.capture`, `não encontrei ${entry.capture} no projeto.`);
    const data = { text };
    if (kind === "organic_post") {
      data.url = typeof entry.url === "string" ? entry.url : null;
      data.plays = entry.plays_text !== undefined ? parseCount(entry.plays_text) : null;
      if (entry.plays_text !== undefined && data.plays === null) throw invalid(file, `${path}.plays_text`, `não entendi o número em "${entry.plays_text}".`);
      data.baseline = entry.baseline_text !== undefined ? parseCount(entry.baseline_text) : null;
      if (entry.baseline_text !== undefined && data.baseline === null) throw invalid(file, `${path}.baseline_text`, `não entendi o número em "${entry.baseline_text}".`);
      data.multiplier = data.plays && data.baseline ? Math.round((data.plays / data.baseline) * 100) / 100 : null;
      data.duration_s = typeof entry.duration_s === "number" ? entry.duration_s : null;
    }
    if (kind === "organic_pattern") {
      data.n = Number.isInteger(entry.n) && entry.n > 0 ? entry.n : null;
      if (data.n === null) throw invalid(file, `${path}.n`, "um padrão precisa de n, quantos posts o sustentam.");
    }
    if (kind === "own_result" || kind === "audience_comment") {
      data.where = typeof entry.where === "string" ? entry.where.trim() : null;
      if (entry.metrics !== undefined) {
        if (!Array.isArray(entry.metrics)) throw invalid(file, `${path}.metrics`, "metrics é uma lista de { name, value_text }.");
        data.metrics = entry.metrics.map((metric, metricIndex) => {
          const value = parseMetric(metric?.value_text);
          if (!metric?.name || value === null) throw invalid(file, `${path}.metrics[${metricIndex}]`, `não entendi a métrica "${metric?.name ?? ""}: ${metric?.value_text ?? ""}".`);
          return { name: String(metric.name), value_text: String(metric.value_text), value };
        });
      }
    }
    const who = typeof entry.who === "string" && entry.who.trim() ? entry.who.trim() : kind === "audience_comment" ? "público" : "integrante";
    return {
      id: `${{ audience_comment: "fala", own_result: "res", organic_post: "org", organic_pattern: "pad" }[kind]}-${slugify(entry.id ?? `${who} ${text}`, 36)}`,
      kind,
      source: { type: sourceType, ref: capture ?? ref, collected_at: collected, reading: file },
      who,
      data,
      tags: checkTags(file, `${path}.tags`, entry.tags, labels),
      group: null,
      excluded: false,
    };
  });
}

/** "1,2%" → 1.2, "R$ 45,90" → 45.9, "12,3 mil" → 12300. */
export function parseMetric(text) {
  if (typeof text === "number") return Number.isFinite(text) ? text : null;
  const folded = foldText(text).replace(/r\$|%/g, "").trim();
  if (/^\d{1,3}(?:\.\d{3})*,\d+$|^\d+,\d+$/.test(folded)) return Number(folded.replace(/\./g, "").replace(",", "."));
  return parseCount(folded);
}

/** Tags, groups and exclusions the AI sets on items that already exist (kind "tags"). */
export function applyTags(reading, evidence, { file, labels }) {
  if (!Array.isArray(reading.items) || !reading.items.length) throw invalid(file, "items", "a leitura de etiquetas não tem itens.");
  const changed = [];
  reading.items.forEach((entry, index) => {
    const path = `items[${index}]`;
    const item = evidence.items.find((candidate) => candidate.id === entry?.id);
    if (!item) throw invalid(file, `${path}.id`, `o item "${entry?.id}" não existe em evidencias.json.`, "Use os ids que o comando evidence mostra.");
    const tags = checkTags(file, `${path}.tags`, entry.tags, labels);
    item.tags = { ...(item.tags ?? {}), ...tags };
    if (entry.group !== undefined) item.group = entry.group === null ? null : String(entry.group);
    if (entry.exclude !== undefined) item.excluded = Boolean(entry.exclude);
    if (typeof entry.note === "string") item.note = entry.note;
    changed.push(item.id);
  });
  evidence.updated_at = new Date().toISOString();
  return changed;
}

/** Which reading a JSON is, and the items it brings. */
export function readingKind(data) {
  if (Array.isArray(data)) return "list";
  if (data && typeof data === "object" && data.version === 1 && typeof data.kind === "string") return data.kind;
  return null;
}

// ---------------------------------------------------------------- the summary (D12)

const median = (values) => {
  const list = values.filter((value) => typeof value === "number").sort((a, b) => a - b);
  if (!list.length) return null;
  const middle = Math.floor(list.length / 2);
  return list.length % 2 ? list[middle] : Math.round(((list[middle - 1] + list[middle]) / 2) * 10) / 10;
};

/**
 * The reading of the evidence: per competitor, the ads by time running (the ones kept 30 days
 * or more are paid for with money, month after month), the versions, the market's patterns (a
 * tag in two competitors or more), what is only an indication, and the rest of the evidence.
 */
export function summarize(evidence, { labels = null } = {}) {
  const items = evidence.items.filter((item) => !item.excluded);
  const ads = items.filter((item) => item.kind === "competitor_ad");
  const competitors = new Map();
  for (const ad of ads) {
    const list = competitors.get(ad.who) ?? [];
    list.push(ad);
    competitors.set(ad.who, list);
  }
  const byCompetitor = [...competitors].map(([who, list]) => {
    const active = list.filter((ad) => ad.data.active);
    const sorted = [...list].sort((a, b) => (b.data.days_active ?? -1) - (a.data.days_active ?? -1));
    const kept = active.filter((ad) => (ad.data.days_active ?? 0) >= RULES.kept_days);
    return {
      who,
      ads: list.length,
      active: active.length,
      kept: kept.length,
      max_days: sorted[0]?.data.days_active ?? null,
      median_days: median(active.map((ad) => ad.data.days_active)),
      variations: list.reduce((sum, ad) => sum + (ad.data.variations ?? 1), 0),
      media: countBy(list.map((ad) => ad.data.media ?? "desconhecida")),
      indication: active.length < RULES.indication_below_active,
      collected_at: [...new Set(list.map((ad) => ad.source.collected_at))].sort().pop() ?? null,
      sources: [...new Set(list.map((ad) => ad.source.type))],
      top: sorted.slice(0, 5).map((ad) => ({ id: ad.id, days_active: ad.data.days_active, variations: ad.data.variations, active: ad.data.active, text: shorten(ad.data.text, 140), tags: ad.tags })),
    };
  });
  byCompetitor.sort((a, b) => b.kept - a.kept || (b.max_days ?? -1) - (a.max_days ?? -1));

  // a pattern of the market: the same tag value in active ads of two competitors or more
  const patterns = [];
  const dimensions = Object.keys(labels?.dimensions ?? {});
  for (const dimension of dimensions) {
    const owners = new Map();
    for (const ad of ads.filter((candidate) => candidate.data.active && candidate.tags?.[dimension])) {
      const value = ad.tags[dimension];
      const entry = owners.get(value) ?? { competitors: new Set(), ads: [] };
      entry.competitors.add(ad.who);
      entry.ads.push(ad.id);
      owners.set(value, entry);
    }
    for (const [value, entry] of owners) {
      patterns.push({ dimension, value, competitors: [...entry.competitors].sort(), ads: entry.ads, market: entry.competitors.size >= RULES.pattern_min_competitors });
    }
  }
  patterns.sort((a, b) => Number(b.market) - Number(a.market) || b.competitors.length - a.competitors.length || b.ads.length - a.ads.length);

  const kept = ads
    .filter((ad) => ad.data.active && (ad.data.days_active ?? 0) >= RULES.kept_days)
    .sort((a, b) => b.data.days_active - a.data.days_active)
    .map((ad) => ({ id: ad.id, who: ad.who, days_active: ad.data.days_active, variations: ad.data.variations, text: shorten(ad.data.text, 140) }));
  const untagged = ads.filter((ad) => ad.data.active && !Object.keys(ad.tags ?? {}).length).map((ad) => ad.id);
  const organic = items
    .filter((item) => item.kind === "organic_post" || item.kind === "organic_pattern")
    .map((item) => ({ id: item.id, kind: item.kind, who: item.who, plays: item.data.plays ?? null, baseline: item.data.baseline ?? null, multiplier: item.data.multiplier ?? null, n: item.data.n ?? null, small_sample: item.data.small_sample ?? null, text: shorten(item.data.text ?? item.data.caption, 140), collected_at: item.source.collected_at }));
  const audience = items.filter((item) => item.kind === "audience_comment").map((item) => ({ id: item.id, who: item.who, text: shorten(item.data.text, 200), likes: item.data.likes ?? null }));
  const own = items.filter((item) => item.kind === "own_result").map((item) => ({ id: item.id, text: shorten(item.data.text, 200), metrics: item.data.metrics ?? [] }));
  const families = [...new Set(items.map((item) => SOURCE_FAMILY[item.kind]).filter(Boolean))];

  const warnings = [];
  for (const competitor of byCompetitor) {
    if (competitor.active === 0) warnings.push(`${competitor.who} não tem anúncio ativo na leitura: o que ele mostra é história, não o que paga hoje.`);
    else if (competitor.indication) warnings.push(`${competitor.who} tem só ${competitor.active} anúncio(s) ativo(s): o que vem dele é indício, não padrão.`);
  }
  if (untagged.length) warnings.push(`${untagged.length} anúncio(s) ativo(s) sem etiquetas: sem elas, os padrões do mercado não aparecem.`);
  if (!ads.length) warnings.push("Nenhum anúncio de concorrente na evidência ainda.");
  return {
    counts: { items: evidence.items.length, used: items.length, excluded: evidence.items.length - items.length, competitor_ads: ads.length, competitors: byCompetitor.length, organic: organic.length, audience: audience.length, own_results: own.length },
    families,
    competitors: byCompetitor,
    kept,
    patterns: patterns.filter((pattern) => pattern.market),
    singles: patterns.filter((pattern) => !pattern.market),
    organic,
    audience,
    own_results: own,
    untagged,
    rules: RULES,
    warnings,
  };
}

function countBy(values) {
  const out = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return out;
}

export function shorten(text, max) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Whether a reading file lives where readings go (only to name it in messages). */
export function readingsHint(campaignDir) {
  return existsSync(join(campaignDir, "pesquisa", "leituras")) ? "pesquisa/leituras/" : "pesquisa/leituras/ (crie a pasta)";
}
