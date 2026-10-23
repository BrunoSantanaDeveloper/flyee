// The exports of the Meta Ads Manager and of Google Ads, normalized into one table: the same
// field names whatever the language and the separator, a `missing` list for what the export
// does not carry (never a zero), and the level (ad, ad set, campaign; campaign, ad group,
// keyword, search term, ad) read from the columns that are present.

import { AppError, fold, parseDay } from "./util.mjs";
import { parseNumber, parseTable } from "./csv.mjs";

const NUMERIC = new Set(["spend", "impressions", "reach", "frequency", "cpm", "link_clicks", "link_ctr", "clicks_all", "landing_page_views", "video_plays_3s", "thruplays", "video_plays_100", "results", "cost_per_result", "leads", "purchases", "purchase_value", "registrations", "initiate_checkout", "clicks", "ctr", "avg_cpc", "conversions", "cost_per_conversion", "conversion_rate", "conversion_value", "impression_share", "quality_score"]);
const DATE_FIELDS = new Set(["period_start", "period_end", "day"]);

/** "CTR (taxa de cliques no link)" → "ctr (taxa de cliques no link)"; "Impr." stays "impr.". */
function normalizeHeader(name) {
  return fold(name).replace(/\s+/g, " ").trim();
}

/** Builds header → field for one source, from references/colunas.json. */
function headerMap(columns, source) {
  const map = new Map();
  for (const [field, names] of Object.entries(columns[source])) for (const name of names) map.set(normalizeHeader(name), field);
  return map;
}

/** Matches a header to a field: exact, then without the parenthesis, then by prefix. */
function fieldFor(header, map) {
  const clean = normalizeHeader(header);
  if (map.has(clean)) return map.get(clean);
  const noParens = clean.replace(/\s*\(.*\)\s*$/, "").trim();
  if (map.has(noParens)) return map.get(noParens);
  for (const [name, field] of map) if (noParens === name.replace(/\s*\(.*\)\s*$/, "").trim()) return field;
  return null;
}

/** "27/11/2026", "2026-11-27", "11/27/2026" → ISO day, or null. */
export function parseExportDay(text) {
  const clean = String(text ?? "").trim();
  if (!clean) return null;
  if (parseDay(clean)) return clean;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(clean);
  if (br) {
    const [, a, b, year] = br;
    // Brazilian exports write day/month; an English export writes month/day. Day > 12 settles it.
    const [day, month] = Number(a) > 12 ? [a, b] : Number(b) > 12 ? [b, a] : [a, b];
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return parseDay(iso) ? iso : null;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(clean);
  return iso && parseDay(iso[0]) ? iso[0] : null;
}

function levelOf(source, fields) {
  const has = (field) => fields.has(field);
  if (source === "meta") {
    if (has("ad_name")) return "ad";
    if (has("adset_name")) return "adset";
    if (has("campaign_name")) return "campaign";
    return null;
  }
  if (has("search_term")) return "search_term";
  if (has("keyword")) return "keyword";
  if (has("ad_name")) return "ad";
  if (has("adgroup_name")) return "adgroup";
  if (has("campaign_name")) return "campaign";
  return null;
}

const NAME_FIELD = { ad: "ad_name", adset: "adset_name", campaign: "campaign_name", adgroup: "adgroup_name", keyword: "keyword", search_term: "search_term" };

/**
 * Normalizes one export. Returns { source, level, name_field, fields, missing, unknown_columns,
 * rows, period, totals }. Rows carry only the fields the export has; a row's missing numeric
 * cell is null. Throws `export_invalid` when no column is recognized.
 */
export function normalizeExport(text, { source, columns, level = null }) {
  if (!["meta", "google"].includes(source)) throw new AppError("usage", `Origem desconhecida: ${source}.`, "Use --source meta ou --source google.");
  const table = parseTable(text);
  if (!table.header.length) throw new AppError("export_invalid", "O arquivo está vazio ou não é um CSV.", "Exporte de novo a tabela, no nível de anúncio, com o período inteiro.");
  const map = headerMap(columns, source);
  const matched = new Map();
  const unknown = [];
  for (const header of table.header) {
    const field = fieldFor(header, map);
    if (field && !matched.has(field)) matched.set(field, header);
    else if (!field) unknown.push(header);
  }
  if (!matched.size) throw new AppError("export_invalid", "Nenhuma coluna do arquivo foi reconhecida como um export da Meta ou do Google Ads.", "Confira --source e exporte a tabela com os cabeçalhos padrão da plataforma.", { unknown_columns: unknown });
  const fields = new Set(matched.keys());
  const detected = level ?? levelOf(source, fields);
  if (!detected) throw new AppError("export_invalid", "O arquivo não traz a coluna de nome (anúncio, conjunto, campanha, grupo, palavra ou termo).", "Exporte a tabela com a coluna de nome do nível que você quer ler.", { recognized: [...fields] });
  const nameField = NAME_FIELD[detected];
  const expected = columns.fields_by_level[source][detected] ?? [];
  const missing = expected.filter((field) => !fields.has(field));

  const rows = [];
  for (const record of table.records) {
    const row = {};
    for (const [field, header] of matched) {
      const cell = record[header];
      if (NUMERIC.has(field)) row[field] = parseNumber(cell);
      else if (DATE_FIELDS.has(field)) row[field] = parseExportDay(cell);
      else row[field] = cell === undefined ? null : String(cell).trim();
    }
    const name = row[nameField];
    // Meta's exports end with a totals line without a name; Google's with "Total: ...".
    if (!name || /^total/i.test(name)) continue;
    row.name = name;
    rows.push(row);
  }

  const starts = rows.map((row) => row.period_start ?? row.day).filter(Boolean).sort();
  const ends = rows.map((row) => row.period_end ?? row.day).filter(Boolean).sort();
  const period = starts.length ? { start: starts[0], end: ends[ends.length - 1] } : null;
  const sum = (field) => (fields.has(field) ? rows.reduce((acc, row) => acc + (row[field] ?? 0), 0) : null);
  const totals = { spend: sum("spend"), impressions: sum("impressions"), link_clicks: sum("link_clicks"), clicks: sum("clicks"), results: sum("results"), conversions: sum("conversions"), landing_page_views: sum("landing_page_views") };
  return { source, level: detected, name_field: nameField, fields: [...fields], columns_matched: Object.fromEntries(matched), missing, unknown_columns: unknown, rows, period, totals, separator: table.separator };
}

/** Rows that share a name (a daily export, or one line per placement) summed into one. */
export function aggregateByName(rows) {
  const byName = new Map();
  for (const row of rows) {
    const current = byName.get(row.name);
    if (!current) {
      byName.set(row.name, { ...row });
      continue;
    }
    for (const [field, value] of Object.entries(row)) {
      if (NUMERIC.has(field) && typeof value === "number") current[field] = (current[field] ?? 0) + value;
      else if (field === "period_start" || field === "day") current.period_start = [current.period_start ?? current.day, value].filter(Boolean).sort()[0] ?? null;
      else if (field === "period_end") current.period_end = [current.period_end, value].filter(Boolean).sort().pop() ?? null;
    }
  }
  // Ratios cannot be summed: recompute the ones the report uses from the counts.
  for (const row of byName.values()) {
    if (typeof row.impressions === "number" && row.impressions > 0) {
      if (typeof row.link_clicks === "number") row.link_ctr = (row.link_clicks / row.impressions) * 100;
      if (typeof row.clicks === "number") row.ctr = (row.clicks / row.impressions) * 100;
      if (typeof row.spend === "number") row.cpm = (row.spend / row.impressions) * 1000;
      if (typeof row.reach === "number" && row.reach > 0) row.frequency = row.impressions / row.reach;
    }
    if (typeof row.spend === "number") {
      if (typeof row.results === "number") row.cost_per_result = row.results > 0 ? row.spend / row.results : null;
      if (typeof row.conversions === "number") row.cost_per_conversion = row.conversions > 0 ? row.spend / row.conversions : null;
      if (typeof row.clicks === "number") row.avg_cpc = row.clicks > 0 ? row.spend / row.clicks : null;
    }
    if (typeof row.clicks === "number" && row.clicks > 0 && typeof row.conversions === "number") row.conversion_rate = (row.conversions / row.clicks) * 100;
  }
  return [...byName.values()];
}
