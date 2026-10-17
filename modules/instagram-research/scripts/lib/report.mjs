// The reports the member opens: Markdown for reading, CSV for a spreadsheet in Portuguese.

export const BAND_LABELS = { explosive: "explosivo", outlier: "outlier", above: "acima", normal: "normal", weak: "fraco" };
export const STATUS_LABELS = { measured: "medido", indication: "indício", none: "sem normal" };
export const FLAG_LABELS = {
  no_baseline: "sem normal",
  indication: "normal com poucos posts",
  hidden_likes: "curtidas ocultas",
  dm_bait: "pede comentário (isca de mensagem)",
  ad: "parceria paga",
  maturing: "menos de 7 dias",
  old: "mais de 1 ano",
};
export const SOURCE_LABELS = { apify: "coleta pelo Apify", screenshot: "captura de tela lida pela IA", link: "links trazidos pelo integrante", export: "arquivo do integrante", declared: "informado pelo integrante" };

const known = (value) => typeof value === "number" && Number.isFinite(value);

/** 1,2 mi · 6,4 mil · 987 */
export function compact(value) {
  if (!known(value)) return "";
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1).replace(".", ",")} mi`;
  if (abs >= 1e4) return `${Math.round(value / 1e3)} mil`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1).replace(".", ",")} mil`;
  return String(Math.round(value));
}
const decimal = (value, digits = 2) => (known(value) ? value.toFixed(digits).replace(".", ",") : "");
const times = (value) => (known(value) ? `${decimal(value)}×` : "");
const percent = (value) => (known(value) ? `${(value * 100).toFixed(1).replace(".", ",")}%` : "");
const flags = (list) => (list ?? []).map((flag) => FLAG_LABELS[flag] ?? flag).join(", ");
const cell = (text) => String(text ?? "").replace(/\|/g, "/").replace(/\]/g, ")").replace(/\[/g, "(");

function normalLine(label, baseline, unit) {
  if (!baseline || baseline.status === "none") return `- ${label}: sem normal (${baseline?.n ?? 0} posts com o número; são precisos ao menos 3).`;
  const note = baseline.status === "indication" ? ", só indício: menos de 5 posts" : "";
  return `- ${label}: mediana de ${compact(baseline.value)} ${unit} em ${baseline.n} posts${note}.`;
}

function postRow(item, index, measure) {
  const what = item.caption ? cell(item.caption.slice(0, 70)) : "(sem legenda)";
  const link = item.url ? `[${what}](${item.url})` : what;
  return `| ${index + 1} | ${BAND_LABELS[item.band] ?? ""} | ${times(item.multiplier)} | ${compact(item.metric)} | ${measure(item)} | ${item.posted_at ? item.posted_at.slice(0, 10) : ""} | ${link} | ${flags(item.flags)} |`;
}

/** The report of one profile. */
export function profileMarkdown(result, { top = 15 } = {}) {
  const lines = [
    `# @${result.id}`,
    "",
    `Fonte: ${SOURCE_LABELS[result.source.type] ?? result.source.type}, em ${result.source.collected_at}. ${result.sample.reels} Reels e ${result.sample.static} posts estáticos ou carrosséis.`,
    "",
    "## O normal do perfil",
    "",
    normalLine("Reels", result.baseline.reels, "plays"),
    normalLine("Posts estáticos e carrosséis", result.baseline.static, "curtidas mais comentários"),
    "",
  ];
  if (result.reels.length) {
    lines.push(
      "## Reels contra o normal do perfil",
      "",
      "| # | Faixa | Multiplicador | Plays | Duração | Data | Post | Avisos |",
      "|---|---|---|---|---|---|---|---|",
      ...result.reels.slice(0, top).map((item, i) => postRow(item, i, (row) => (known(row.duration_s) ? `${Math.round(row.duration_s)} s` : ""))),
      "",
    );
  }
  if (result.static.length) {
    lines.push(
      "## Posts estáticos e carrosséis contra o normal deles",
      "",
      "| # | Faixa | Multiplicador | Interações | Comentários | Data | Post | Avisos |",
      "|---|---|---|---|---|---|---|---|",
      ...result.static.slice(0, top).map((item, i) => postRow(item, i, (row) => compact(row.comments))),
      "",
    );
  }
  lines.push(...durationLines(result.durations), ...warningLines(result.warnings), ...readingNotes());
  return `${lines.join("\n")}\n`;
}

function durationLines(durations) {
  const rows = (durations ?? []).filter((bucket) => bucket.n > 0);
  if (!rows.length) return [];
  return [
    "## Reels por duração",
    "",
    "| Duração | Reels | Mediana de plays | Mediana do multiplicador |",
    "|---|---|---|---|",
    ...rows.map((bucket) => `| ${bucket.label} | ${bucket.n} | ${compact(bucket.median_plays)} | ${times(bucket.median_multiplier)} |`),
    "",
  ];
}

function warningLines(warnings) {
  return warnings?.length ? ["## Ressalvas", "", ...warnings.map((warning) => `- ${warning}`), ""] : [];
}

function readingNotes() {
  return [
    "## Como ler",
    "",
    "- O multiplicador compara o post com a mediana do próprio perfil: 3× é três vezes o normal daquele perfil, não um número absoluto.",
    "- Faixas: explosivo a partir de 10×, outlier a partir de 3×, acima a partir de 1,5×, normal a partir de 0,5×, fraco abaixo.",
    "- Reels são medidos por plays; posts estáticos e carrosséis por curtidas mais comentários. Os dois nunca entram no mesmo ranking.",
    "- Perfil pequeno dá multiplicador grande com pouco número: olhe sempre os plays ao lado.",
    "- \"Pede comentário\" marca posts com muito mais comentários que curtidas, quase sempre um pedido de \"comente X que eu mando\". É tática, não prova de interesse no tema.",
    "",
  ];
}

/** The ranking across several profiles, each post against its own profile. */
export function outliersMarkdown(result, { top = 25 } = {}) {
  const lines = [
    `# Outliers no Instagram: ${result.profiles.map((profile) => `@${profile.id}`).join(", ")}`,
    "",
    `Feito em ${result.created_at.slice(0, 10)}. ${result.sample.reels} Reels de ${result.profiles.length} perfis, cada um comparado com o normal do próprio perfil.`,
    "",
    "## O normal de cada perfil",
    "",
    "| Perfil | Reels | Mediana de plays | Normal | Fonte |",
    "|---|---|---|---|---|",
    ...result.profiles.map((profile) => `| @${profile.id} | ${profile.baseline.reels.n} | ${compact(profile.baseline.reels.value)} | ${STATUS_LABELS[profile.baseline.reels.status]} | ${SOURCE_LABELS[profile.source.type] ?? profile.source.type} |`),
    "",
    "## Reels que mais passaram do normal",
    "",
    "| # | Faixa | Multiplicador | Plays | Perfil | Duração | Post | Avisos |",
    "|---|---|---|---|---|---|---|---|",
    ...result.reels.slice(0, top).map((item, i) => `| ${i + 1} | ${BAND_LABELS[item.band] ?? ""} | ${times(item.multiplier)} | ${compact(item.metric)} | @${item.profile} | ${known(item.duration_s) ? `${Math.round(item.duration_s)} s` : ""} | ${item.url ? `[${cell((item.caption ?? "post").slice(0, 60))}](${item.url})` : cell(item.caption ?? "")} | ${flags(item.flags)} |`),
    "",
  ];
  lines.push(...durationLines(result.durations), ...warningLines(result.warnings), ...readingNotes());
  return `${lines.join("\n")}\n`;
}

const CSV_COLUMNS = [
  ["rank", "#"], ["profile", "Perfil"], ["kind_label", "Tipo"], ["band_label", "Faixa"], ["multiplier", "Multiplicador"], ["index", "Índice"],
  ["metric", "Medida"], ["plays", "Plays"], ["likes", "Curtidas"], ["comments", "Comentários"], ["engagement", "Engajamento"],
  ["duration_s", "Duração (s)"], ["posted_at", "Publicado"], ["flags_label", "Avisos"], ["caption", "Legenda"], ["url", "Endereço"],
];

/**
 * A cell value. A text starting with = + - or @ would run as a formula in a spreadsheet, and
 * captions are other people's text: it gets a leading apostrophe.
 */
export function csvValue(value) {
  if (value === null || value === undefined) return "";
  let text = typeof value === "number" ? String(value).replace(".", ",") : String(value);
  if (typeof value !== "number" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Semicolons and decimal commas, with a BOM: opens right in a spreadsheet in Portuguese. */
export function postsCsv(items) {
  const rows = [CSV_COLUMNS.map(([, label]) => label).join(";")];
  items.forEach((item, i) => {
    const row = { ...item, rank: i + 1, kind_label: item.kind === "reel" ? "Reels" : "estático", band_label: BAND_LABELS[item.band] ?? "", flags_label: flags(item.flags), posted_at: item.posted_at ? item.posted_at.slice(0, 10) : null };
    rows.push(CSV_COLUMNS.map(([key]) => csvValue(row[key])).join(";"));
  });
  return `﻿${rows.join("\r\n")}\r\n`;
}

/** The comments of one post, without names. */
export function commentsMarkdown(result) {
  const lines = [
    `# Comentários de ${result.url}`,
    "",
    `${result.count} comentários, colhidos em ${result.collected_at}, sem o nome de quem escreveu. Mais curtidos primeiro.`,
    "",
    ...result.comments.map((comment) => `- ${comment.text}${known(comment.likes) && comment.likes > 0 ? ` (${comment.likes} curtidas)` : ""}`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}
