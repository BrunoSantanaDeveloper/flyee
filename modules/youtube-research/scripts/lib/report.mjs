// Renders the research for people: Markdown for reading, CSV for a spreadsheet.

import { groupSpeech } from "./captions.mjs";
import { formatTime, isoDay } from "./util.mjs";

export const BAND_LABELS = { explosive: "explosivo", outlier: "outlier", above: "acima", normal: "normal", weak: "fraco" };
export const BASE_LABELS = { channel: "mediana do canal", sample: "mediana na amostra", subscribers: "inscritos (aproximação)" };
export const FLAG_LABELS = {
  no_baseline: "sem a mediana do canal",
  small_channel: "canal pequeno",
  maturing: "menos de 7 dias",
  old: "mais de 1 ano",
  short: "Short",
};

/** 1234567 → "1,2 mi"; 6400 → "6,4 mil"; 950 → "950". */
export function compact(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const format = (n) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (value >= 1e6) return `${format(value / 1e6)} mi`;
  if (value >= 1e3) return `${format(value / 1e3)} mil`;
  return format(Math.round(value));
}

const decimal = (value, digits = 1) => (typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("pt-BR", { maximumFractionDigits: digits }) : "—");
const percent = (value) => (typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—");
const cell = (text) => String(text ?? "—").replace(/\|/g, "/").replace(/\s+/g, " ").trim();
const duration = (seconds) => (typeof seconds === "number" ? formatTime(seconds) : "—");
const flags = (list) => (list?.length ? list.map((flag) => FLAG_LABELS[flag] ?? flag).join(", ") : "");

export function outliersMarkdown(result, { top = 30 } = {}) {
  const { params, sample, items } = result;
  const lines = [
    `# Pesquisa no YouTube: ${result.queries.join(" · ")}`,
    "",
    `Feita em ${isoDay(new Date(result.created_at))}. Janela: ${params.window === "all" ? "sem filtro de data" : `último(a) ${{ week: "semana", month: "mês", year: "ano" }[params.window]}`}. Formato: ${{ long: "vídeos longos", short: "Shorts", any: "todos" }[params.format]}. Ordem: ${params.rank}.`,
    "",
    `Amostra: ${sample.collected} vídeos encontrados, ${sample.kept} analisados, ${sample.channels} canais, ${sample.channels_measured} com o normal medido, ${sample.detailed} com detalhes.`,
    "",
    "O multiplicador diz quantas vezes o vídeo fez o normal do próprio canal (a mediana de views dos últimos envios). É ele que mostra tema, ângulo ou título puxando público, não o total de views.",
    "",
    "| # | Faixa | Mult. | Views | Views/dia | Engaj. | Título | Canal | Duração | Publicado | Avisos |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  items.slice(0, top).forEach((item, i) => {
    lines.push(
      `| ${i + 1} | ${BAND_LABELS[item.band] ?? "—"} | ${item.multiplier === null ? "—" : `${decimal(item.multiplier)}×`} | ${compact(item.views)} | ${compact(item.views_per_day)} | ${percent(item.engagement)} | [${cell(item.title)}](${item.url}) | ${cell(item.channel)} | ${duration(item.duration_s)} | ${item.published_at ?? "—"} | ${flags(item.flags)} |`,
    );
  });
  if (result.warnings?.length) lines.push("", "## Ressalvas", "", ...result.warnings.map((warning) => `- ${warning}`));
  lines.push(
    "",
    "## Como ler",
    "",
    "- Faixas, com a mediana do canal: explosivo a partir de 10×, outlier a partir de 3×, acima a partir de 1,5×, normal a partir de 0,5×, fraco abaixo disso. Medido por inscritos, as faixas são outras e valem como indício.",
    "- Um padrão (ângulo, promessa do título, formato) só conta quando aparece em dois ou mais outliers. Copie o mecanismo, nunca o título.",
    "- Views/dia separa o que explodiu do que acumulou em anos. \"menos de 7 dias\" ainda vai mudar; \"mais de 1 ano\" foi comparado com o normal de hoje do canal.",
    "",
    `Dados completos: outliers.json e outliers.csv nesta pasta.`,
  );
  return `${lines.join("\n")}\n`;
}

const CSV_COLUMNS = [
  ["rank", "#"], ["band", "Faixa"], ["multiplier", "Multiplicador"], ["index", "Índice"], ["title", "Título"], ["channel", "Canal"],
  ["views", "Views"], ["base_value", "Normal do canal"], ["base_kind", "Base"], ["views_per_day", "Views/dia"], ["engagement", "Engajamento"],
  ["likes", "Curtidas"], ["comments", "Comentários"], ["subscribers", "Inscritos"], ["duration", "Duração"], ["published_at", "Publicado"],
  ["queries", "Buscas"], ["flags", "Avisos"], ["url", "Endereço"],
];

function csvValue(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "number" ? String(value).replace(".", ",") : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Semicolons and decimal commas, with a BOM: opens right in a spreadsheet in Portuguese. */
export function outliersCsv(items) {
  const rows = [CSV_COLUMNS.map(([, label]) => label).join(";")];
  items.forEach((item, i) => {
    const row = {
      ...item,
      rank: i + 1,
      band: BAND_LABELS[item.band] ?? "",
      base_value: item.base?.value ?? null,
      base_kind: item.base ? BASE_LABELS[item.base.kind] : "",
      duration: typeof item.duration_s === "number" ? formatTime(item.duration_s) : "",
      queries: (item.queries ?? []).join(" | "),
      flags: flags(item.flags),
    };
    rows.push(CSV_COLUMNS.map(([key]) => csvValue(row[key])).join(";"));
  });
  return `﻿${rows.join("\r\n")}\r\n`;
}

export function channelMarkdown(result) {
  const { channel, items } = result;
  const lines = [
    `# Canal: ${channel.name ?? channel.url}`,
    "",
    `${channel.url}${channel.subscribers ? ` · ${compact(channel.subscribers)} inscritos` : ""} · aba ${result.tab} · últimos ${result.sample} envios · normal (mediana): ${compact(result.median_views)} views. Lido em ${isoDay(new Date(result.created_at))}; as views da aba vêm arredondadas pelo YouTube.`,
    "",
    "| # | Mult. | Faixa | Views | Duração | Título |",
    "|---|---|---|---|---|---|",
  ];
  items.forEach((item, i) => {
    lines.push(`| ${i + 1} | ${item.multiplier === null ? "—" : `${decimal(item.multiplier)}×`} | ${BAND_LABELS[item.band] ?? "—"} | ${compact(item.views)} | ${duration(item.duration_s)} | [${cell(item.title)}](${item.url}) |`);
  });
  lines.push("", "A ordem é a do canal, do mais novo para o mais antigo. Os vídeos mais recentes ainda estão acumulando views.");
  return `${lines.join("\n")}\n`;
}

export function transcriptMarkdown(video, transcript) {
  const header = [
    `# Transcrição: ${video.title ?? video.id}`,
    "",
    `${video.channel ?? ""} · ${video.url}`,
    `Origem: legenda ${transcript.origin === "manual" ? "escrita pelo canal" : "automática do YouTube"} (${transcript.track}). ${transcript.words} palavras, cerca de ${transcript.words_per_minute ?? "—"} palavras por minuto. Tempos em MM:SS.`,
    "",
  ];
  const blocks = groupSpeech(transcript.segments).map((block) => `**${formatTime(block.start_s)}** ${block.text}\n`);
  return `${header.join("\n")}\n${blocks.join("\n")}`;
}

export function commentsMarkdown(video, comments, sort) {
  const lines = [
    `# Comentários: ${video.title ?? video.id}`,
    "",
    `${video.url} · ${comments.length} comentários (${sort === "new" ? "os mais novos" : "os mais relevantes"}), sem as respostas e sem o nome de quem escreveu. Comentários são opinião do público, não fatos.`,
    "",
  ];
  comments.forEach((comment, i) => {
    const marks = [comment.pinned && "fixado", comment.by_creator && "do canal"].filter(Boolean).join(", ");
    lines.push(`${i + 1}. (${comment.likes ?? 0} curtidas${marks ? `; ${marks}` : ""}) ${comment.text.replace(/\s*\n\s*/g, " / ")}`);
  });
  return `${lines.join("\n")}\n`;
}
