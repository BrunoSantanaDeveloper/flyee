// What a reading asks before it starts, and after: one message with at most three questions,
// built by the script so the AI never writes its own list. A reading of a campaign that already
// ran needs the export as it comes and, when the event is a sale or a sign-up, two numbers from
// the member's own system. Columns are asked only when their absence changes a verdict.

import { normalizeExport } from "./exports.mjs";
import { brl, fold } from "./util.mjs";
import { RESULT_FIELDS, resultsOf } from "./verdict.mjs";

export const STAGE_WORDS = {
  compra: { plural: "vendas (compras ou assinaturas)", one: "uma venda" },
  cadastro: { plural: "cadastros", one: "um cadastro" },
  lead: { plural: "leads", one: "um lead" },
};

/** The stage an optimization event stands for, from a free text such as "Compra da assinatura". */
export function eventStage(event) {
  const text = fold(event ?? "");
  if (!text) return null;
  if (/compra|purchase|venda|assinatura|pagamento|checkout/.test(text)) return "compra";
  if (/cadastro|registr|conta criada|sign ?up/.test(text)) return "cadastro";
  if (/lead|lista de espera|formulario/.test(text)) return "lead";
  return null;
}

/**
 * Reads only the header line of a CSV and says whether it is an ad platform export, and of which
 * level. The rows are never read here: a list in the inbox may carry personal data.
 */
export function exportKind(text, columns) {
  const firstLine = String(text ?? "").replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  if (!firstLine.trim()) return null;
  for (const source of ["meta", "google"]) {
    try {
      const normalized = normalizeExport(firstLine, { source, columns });
      // A sign-up list has a "data" column, which both platforms also call "dia": it only counts
      // as an export when a spend or impressions column is there too.
      if (normalized.fields.includes("spend") || normalized.fields.includes("impressions")) return { source, level: normalized.level, fields: normalized.fields };
    } catch {
      // not this platform
    }
  }
  return null;
}

/** The counts the member gave for a period, the newest that overlaps it. */
export function countsFor(answers, period = null, stage = null) {
  const list = (answers?.counts ?? []).filter((entry) => !stage || entry.stage === stage);
  if (!list.length) return null;
  const overlaps = (entry) => !period || !entry.period || (entry.period.start <= period.end && period.start <= entry.period.end);
  return [...list].filter(overlaps).sort((a, b) => String(b.informed_at).localeCompare(String(a.informed_at)))[0] ?? null;
}

/**
 * The questions of the reading, at most three, in the order the member answers them. Every input
 * is what the script found; a question that is already answered never comes back.
 */
export function intakeQuestions({ exportFound, reading, stage, counts, allowable, allowableSuggestion, period }) {
  const questions = [];
  if (!exportFound && !reading) {
    questions.push({
      key: "export",
      question: "Exporte do Gerenciador de Anúncios a tabela da campanha no nível de anúncio, com o período inteiro, do jeito que ela vier, e salve o arquivo na pasta ads-insights/entrada.",
      where: "No Gerenciador, abra a aba Anúncios, escolha o período da campanha e use o botão Exportar, em CSV. Não precisa mudar as colunas.",
      required: true,
      suggestion: null,
      yes_accepts: false,
    });
  }
  if (stage && !counts) {
    const words = STAGE_WORDS[stage];
    const when = period ? `de ${period.start.split("-").reverse().join("/")} a ${period.end.split("-").reverse().join("/")}` : "no período da campanha";
    questions.push({
      key: "counts",
      question: `Quantos ${words.plural} novos entraram ${when} pelo seu sistema, e quantos deles vieram dos anúncios? Bastam os dois números. Se preferir, a lista do sistema com e-mail, data e origem, salva na mesma pasta, faz o mesmo papel.`,
      why: "A Meta conta o que ela atribui a si mesma. Os seus números dizem se o rastreamento está certo antes de colocar mais verba.",
      required: false,
      suggestion: null,
      yes_accepts: false,
    });
  }
  if (!allowable) {
    const one = STAGE_WORDS[stage ?? ""]?.one ?? "um resultado";
    questions.push({
      key: "allowable",
      question: allowableSuggestion ? `Quanto ${one} pode custar em anúncio? Sugestão: ${brl(allowableSuggestion.value)}, ${allowableSuggestion.label}. Um sim aceita.` : `Quanto ${one} pode custar em anúncio, no máximo?`,
      why: "Sem esse valor a leitura só julga o gancho e o clique; com ele, diz o que cortar e o que escalar.",
      required: false,
      suggestion: allowableSuggestion ? allowableSuggestion.value : null,
      yes_accepts: Boolean(allowableSuggestion),
    });
  }
  return questions.slice(0, 3);
}

const META_LABEL = {
  spend: "Valor usado",
  impressions: "Impressões",
  link_clicks: "Cliques no link",
  video_plays_3s: "Reproduções de vídeo de 3 segundos",
  results: "Resultados",
  purchases: "Compras",
  registrations: "Cadastros concluídos",
  leads: "Leads",
};
const GOOGLE_LABEL = { spend: "Custo", impressions: "Impr.", clicks: "Cliques", conversions: "Conversões" };

/**
 * The columns worth asking for after an import: only the ones whose absence changes a verdict
 * of this table. At most three, in one message, each with where it is in the platform.
 */
export function columnAsks({ source, fields = [], rows = [], event = null }) {
  const has = (field) => fields.includes(field);
  const asks = [];
  const add = (field, because) => {
    const label = (source === "google" ? GOOGLE_LABEL : META_LABEL)[field];
    asks.push({
      field,
      column: label,
      because,
      where: source === "google" ? `No Google Ads, em Colunas, Modificar colunas, marque "${label}" e baixe o relatório de novo.` : `No Gerenciador, em Colunas, Personalizar colunas, marque "${label}" e exporte de novo.`,
    });
  };
  if (source === "google") {
    for (const field of ["spend", "impressions", "clicks", "conversions"]) if (!has(field)) add(field, "sem ela nenhum termo ou anúncio da Busca tem veredito.");
    return asks.slice(0, 3);
  }
  if (!has("spend")) add("spend", "sem o valor usado não há custo de nada.");
  if (!has("impressions")) add("impressions", "sem as impressões o gancho e o clique não têm amostra.");
  const results = resultsOf({}, { source, event, fields });
  if (!results.from) {
    const eventField = event ? RESULT_FIELDS[String(eventStage(event) ?? event).toLowerCase()] ?? null : null;
    add(eventField && META_LABEL[eventField] ? eventField : "results", "sem os resultados nenhuma peça pode ser cortada ou escalada pelo custo.");
  }
  if (!has("link_clicks")) add("link_clicks", "sem os cliques no link o clique de cada peça não tem leitura.");
  const hookMatters = rows.some((row) => row.legible?.hook_ctr && ["iterar", "cortar"].includes(row.verdict));
  if (!has("video_plays_3s") && hookMatters) add("video_plays_3s", "com ela a leitura separa o gancho que não prende do miolo que não convence, e a próxima versão muda só a parte que falha.");
  return asks.slice(0, 3);
}
