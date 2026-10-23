// The verdict of each piece, computed by the script and never written by the AI: the metrics a
// week of data allows, the sample guard (D28), the verdict words and how sure each one is.
// Below the minimum sample everything is an indication, and the text says so.

import { brl, pct, round2 } from "./util.mjs";

export const VERDICTS = ["escalar", "manter", "iterar", "cortar", "negativar", "dado_insuficiente"];
export const CERTAINTY = ["confirmado", "provavel", "primeira-leitura"];
export const RESULT_FIELDS = { lead: "leads", leads: "leads", compra: "purchases", purchase: "purchases", cadastro: "registrations", registration: "registrations", inicio_pagamento: "initiate_checkout", checkout: "initiate_checkout" };

/** "3,75 vezes", "1 vez", "0,8 vez". */
export const times = (value) => `${String(value).replace(".", ",")} ${Math.abs(value - 1) < 1e-9 ? "vez" : value < 1 ? "vez" : "vezes"}`;
const ratio = (a, b) => (typeof a === "number" && typeof b === "number" && b > 0 ? a / b : null);
const r2 = (value) => (value === null || value === undefined ? null : round2(value));
const median = (values) => {
  const sorted = values.filter((value) => typeof value === "number").sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Which column holds the results: the export's own, or the event's column when it exists. */
export function resultsOf(row, { source, event = null, fields = [] }) {
  if (source === "google") return { value: row.conversions ?? null, from: fields.includes("conversions") ? "conversions" : null };
  const eventField = event ? RESULT_FIELDS[String(event).toLowerCase()] ?? null : null;
  if (eventField && fields.includes(eventField)) return { value: row[eventField] ?? null, from: eventField };
  if (fields.includes("results")) return { value: row.results ?? null, from: "results" };
  return { value: null, from: null };
}

/** The metrics of one row, with null wherever the export does not carry the counts. */
export function metricsOf(row, { source, event = null, fields = [] }) {
  const results = resultsOf(row, { source, event, fields });
  const spend = row.spend ?? null;
  if (source === "google") {
    return {
      spend,
      impressions: row.impressions ?? null,
      clicks: row.clicks ?? null,
      ctr_pct: r2(ratio(row.clicks, row.impressions) === null ? null : ratio(row.clicks, row.impressions) * 100),
      avg_cpc_brl: r2(ratio(spend, row.clicks)),
      results: results.value,
      results_from: results.from,
      cost_per_result_brl: results.value ? round2(spend / results.value) : null,
      conversion_rate_pct: results.value !== null && row.clicks ? round2((results.value / row.clicks) * 100) : null,
    };
  }
  const visits = row.landing_page_views ?? null;
  const clicks = row.link_clicks ?? null;
  const visitsUsed = visits ?? clicks;
  return {
    spend,
    impressions: row.impressions ?? null,
    reach: row.reach ?? null,
    frequency: row.frequency ?? (row.reach ? r2(ratio(row.impressions, row.reach)) : null),
    hook_rate: r2(ratio(row.video_plays_3s, row.impressions)),
    thruplay_rate: r2(ratio(row.thruplays ?? row.video_plays_100, row.video_plays_3s)),
    link_clicks: clicks,
    link_ctr_pct: r2(ratio(clicks, row.impressions) === null ? null : ratio(clicks, row.impressions) * 100),
    visits,
    visits_from: visits !== null ? "landing_page_views" : clicks !== null ? "link_clicks" : null,
    cost_per_visit_brl: visitsUsed ? round2(spend / visitsUsed) : null,
    results: results.value,
    results_from: results.from,
    cost_per_result_brl: results.value ? round2(spend / results.value) : null,
    visit_to_result_pct: results.value !== null && visitsUsed ? round2((results.value / visitsUsed) * 100) : null,
  };
}

function fails(metrics, rules, medianConversion, source) {
  if (source === "google") return metrics.ctr_pct !== null && metrics.ctr_pct < rules.floors.search_ctr_pct ? "anuncio" : "pagina";
  if (metrics.hook_rate !== null && metrics.hook_rate < rules.floors.hook_rate) return "gancho";
  if (metrics.link_ctr_pct !== null && metrics.link_ctr_pct < rules.floors.link_ctr_pct) return "miolo";
  if (medianConversion && metrics.visit_to_result_pct !== null && metrics.visit_to_result_pct < medianConversion * rules.floors.page_conversion_fraction_of_median) return "pagina";
  return null;
}

/**
 * Judges one row. `allowable` is the allowable cost per result (null when the plan has none);
 * `medianConversion` is the table's median visit→result rate, for the page floor.
 */
export function judgeRow(row, { source, level, event = null, fields = [], allowable = null, rules, medianConversion = null }) {
  const metrics = metricsOf(row, { source, event, fields });
  const reasons = [];
  const clicks = source === "google" ? metrics.clicks : metrics.link_clicks;
  const legible = {
    hook_ctr: metrics.impressions !== null && clicks !== null && metrics.impressions >= rules.sample.impressions && clicks >= rules.sample.link_clicks,
    cost: metrics.results !== null && metrics.results >= rules.sample.results,
    visits: source === "meta" && metrics.visits !== null && metrics.visits >= rules.sample.visits,
  };
  const spendMultiple = allowable && metrics.spend !== null ? round2(metrics.spend / allowable) : null;
  const costMultiple = allowable && metrics.cost_per_result_brl !== null ? round2(metrics.cost_per_result_brl / allowable) : null;
  const where = fails(metrics, rules, medianConversion, source);
  const noise = metrics.results ? round2((1 / Math.sqrt(metrics.results)) * 100) : null;

  let verdict = "dado_insuficiente";
  let certainty = "primeira-leitura";
  let readings = null;

  if (level === "search_term") {
    if (allowable && clicks !== null && clicks >= rules.search.negative.min_clicks && metrics.results === 0 && spendMultiple !== null && spendMultiple >= rules.search.negative.spend_multiple_min) {
      verdict = "negativar";
      certainty = "provavel";
      reasons.push(`${clicks} cliques, nenhuma conversão e ${brl(metrics.spend)} gastos (${times(spendMultiple)} o custo permitido): o termo não é o seu comprador.`);
    } else {
      reasons.push(allowable ? `um termo vira negativa com ${rules.search.negative.min_clicks} cliques ou mais, nenhuma conversão e ao menos ${brl(allowable)} gastos.` : "sem o custo permitido no contrato, o app não julga termos.");
    }
  } else if (!allowable) {
    reasons.push("sem o custo permitido por resultado no contrato de medição, só o gancho e o CTR podem ser lidos.");
    if (legible.hook_ctr && where && where !== "pagina") {
      verdict = "iterar";
      certainty = "provavel";
      reasons.push(where === "gancho" ? `só ${pct((metrics.hook_rate ?? 0) * 100)} das impressões passam dos 3 segundos; o piso é ${pct(rules.floors.hook_rate * 100)}.` : `CTR do link de ${pct(metrics.link_ctr_pct ?? 0)}; o piso é ${pct(rules.floors.link_ctr_pct)}.`);
    }
  } else if (metrics.spend !== null && metrics.results === 0 && spendMultiple >= rules.cut.zero_results_spend_multiple) {
    verdict = "cortar";
    certainty = "provavel";
    reasons.push(`${brl(metrics.spend)} gastos, ${times(spendMultiple)} o custo permitido, e nenhum resultado.`);
  } else if (metrics.results !== null && metrics.results >= rules.cut.min_results && spendMultiple >= rules.cut.spend_multiple && costMultiple !== null && costMultiple >= rules.cut.cost_multiple) {
    verdict = "cortar";
    certainty = legible.cost ? "confirmado" : "provavel";
    reasons.push(`${brl(metrics.cost_per_result_brl)} por resultado, ${times(costMultiple)} o permitido, depois de ${brl(metrics.spend)} gastos.`);
  } else if (legible.cost && costMultiple !== null && costMultiple <= rules.scale.cost_multiple_max) {
    verdict = "escalar";
    certainty = "confirmado";
    reasons.push(`${metrics.results} resultados a ${brl(metrics.cost_per_result_brl)} cada, dentro do permitido de ${brl(allowable)}, pela contagem da plataforma; a planilha de origem confirma antes de subir a verba.`);
  } else if (legible.hook_ctr && where) {
    verdict = "iterar";
    certainty = legible.cost ? "confirmado" : "provavel";
    reasons.push(where === "gancho" ? `só ${pct((metrics.hook_rate ?? 0) * 100)} das impressões passam dos 3 segundos; o piso é ${pct(rules.floors.hook_rate * 100)}.` : where === "miolo" ? `CTR do link de ${pct(metrics.link_ctr_pct ?? 0)}; o piso é ${pct(rules.floors.link_ctr_pct)}.` : where === "anuncio" ? `CTR de ${pct(metrics.ctr_pct ?? 0)} na Busca; o piso é ${pct(rules.floors.search_ctr_pct)}.` : `a página converte ${pct(metrics.visit_to_result_pct ?? 0)} das visitas; a mediana da tabela é ${pct(medianConversion ?? 0)}.`);
  } else if (metrics.results !== null && metrics.results >= rules.cut.min_results && costMultiple !== null && costMultiple <= rules.hold.cost_multiple_max) {
    verdict = "manter";
    certainty = legible.cost ? "confirmado" : "provavel";
    reasons.push(`${brl(metrics.cost_per_result_brl)} por resultado (${times(costMultiple)} o permitido) em ${metrics.results} resultados.`);
    if (costMultiple >= rules.hold.near_threshold[0] && costMultiple <= rules.hold.near_threshold[1] && !legible.cost) {
      readings = {
        change: `${costMultiple > 1 ? "Cortar" : "Escalar"}: ${brl(metrics.cost_per_result_brl)} por resultado contra ${brl(allowable)} permitidos, ${times(costMultiple)}.`,
        hold: `Manter: com ${metrics.results} resultados a incerteza é de cerca de ${pct(noise)}, então o custo real pode estar de ${brl(round2(metrics.cost_per_result_brl * (1 - noise / 100)))} a ${brl(round2(metrics.cost_per_result_brl * (1 + noise / 100)))}; a leitura fica firme com ${rules.sample.results} resultados.`,
      };
    }
  } else {
    if (spendMultiple !== null && spendMultiple < rules.new.spend_multiple_min) reasons.push(`${brl(metrics.spend ?? 0)} gastos, menos de uma vez o custo permitido: cedo para qualquer veredito.`);
    else if (metrics.results !== null && metrics.results < rules.cut.min_results) reasons.push(`${metrics.results} resultado(s): a leitura do custo começa com ${rules.cut.min_results} e fica firme com ${rules.sample.results}.`);
    else if (!legible.hook_ctr) reasons.push(`${metrics.impressions ?? 0} impressões e ${clicks ?? 0} cliques: o gancho e o CTR ficam legíveis com ${rules.sample.impressions} e ${rules.sample.link_clicks}.`);
    else if (metrics.results === null) reasons.push("o export não traz a coluna de resultados do evento escolhido.");
    else reasons.push("os números não cruzam nenhum limiar das regras.");
  }

  const legibleWhen = [];
  if (!legible.hook_ctr) legibleWhen.push(`${rules.sample.impressions} impressões e ${rules.sample.link_clicks} cliques`);
  if (!legible.cost) legibleWhen.push(`${rules.sample.results} resultados`);

  return { verdict, certainty, where_it_fails: ["iterar", "cortar"].includes(verdict) ? where : null, reasons, readings, metrics, legible, spend_multiple: spendMultiple, cost_multiple: costMultiple, noise_pct: noise, legible_when: legibleWhen };
}

/**
 * Judges a whole normalized table: ranks by spend first (a tiny spend never floats to the top),
 * computes the median page conversion for the page floor, and returns rows with verdicts plus
 * the counts by verdict.
 */
export function judgeTable(normalized, { event = null, allowable = null, rules }) {
  const { source, level, fields } = normalized;
  const metricsList = normalized.rows.map((row) => metricsOf(row, { source, event, fields }));
  const medianConversion = source === "meta" ? median(metricsList.filter((m) => m.visits !== null && m.visits >= rules.sample.visits).map((m) => m.visit_to_result_pct)) : null;
  const judged = normalized.rows
    .map((row) => ({ name: row.name, ...(row.concept ? { concept: row.concept, angle: row.angle ?? null } : {}), adset: row.adset_name ?? null, campaign: row.campaign_name ?? null, ...judgeRow(row, { source, level, event, fields, allowable, rules, medianConversion }) }))
    .sort((a, b) => (b.metrics.spend ?? 0) - (a.metrics.spend ?? 0));
  const counts = Object.fromEntries(VERDICTS.map((verdict) => [verdict, judged.filter((row) => row.verdict === verdict).length]));
  return { rows: judged, counts, median_visit_to_result_pct: medianConversion, allowable_brl: allowable, event, rules_checked_on: rules.checked_on };
}

/** How many ads can be read at all, in one sentence. */
export function tableSay(table) {
  const total = table.rows.length;
  const readable = table.rows.filter((row) => row.verdict !== "dado_insuficiente").length;
  const parts = Object.entries(table.counts).filter(([, n]) => n > 0).map(([verdict, n]) => `${n} ${verdict.replace("_", " ")}`);
  return `${total} peça(s) lidas, ${readable} com veredito: ${parts.join(", ")}.${table.allowable_brl ? "" : " Sem custo permitido no contrato, só o gancho e o CTR entram."}`;
}
