// The next round: the measurement app's report becomes the campaign's own results (the
// strongest evidence a concept can have), and the proposal of the round after: what to keep,
// what to iterate and where, what is cut and never comes back the same, and the names that end
// in the next version.

import { adName } from "./concepts.mjs";

const slug = (text) => String(text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36);
const brl = (value) => (typeof value === "number" ? `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null);
const pct = (value) => (typeof value === "number" ? `${String(value).replace(".", ",")}%` : null);

/** The verdict words of the measurement app, as this app reads them. */
export const VERDICTS = ["escalar", "manter", "iterar", "cortar", "negativar", "dado_insuficiente"];

/**
 * Turns report.json into a `declared` reading of own results, one item per ad that matched a
 * concept. The id carries the reading and the ad, so the concept cites a result, never a number.
 */
export function reportToOwnResults(report, { concepts }) {
  if (!report || report.interface_version !== 1 || !Array.isArray(report.rows)) throw Object.assign(new Error("O arquivo não é um report.json do app de medição (interface 1 com rows)."), { code: "report_invalid" });
  const byName = new Map(concepts.map((concept) => [concept.ad_name, concept]));
  const items = [];
  for (const row of report.rows) {
    const concept = byName.get(row.name) ?? (row.concept ? concepts.find((item) => item.key === row.concept) : null);
    if (!concept) continue;
    const metrics = [];
    if (typeof row.metrics?.results === "number") metrics.push({ name: "resultados", value_text: String(row.metrics.results) });
    if (typeof row.metrics?.cost_per_result_brl === "number") metrics.push({ name: "custo_por_resultado", value_text: brl(row.metrics.cost_per_result_brl) });
    if (typeof row.metrics?.link_ctr_pct === "number") metrics.push({ name: "ctr_link", value_text: pct(row.metrics.link_ctr_pct) });
    if (typeof row.metrics?.hook_rate === "number") metrics.push({ name: "gancho", value_text: pct(Math.round(row.metrics.hook_rate * 1000) / 10) });
    if (typeof row.metrics?.spend === "number") metrics.push({ name: "gasto", value_text: brl(row.metrics.spend) });
    const period = report.period ? ` em ${report.period.start} a ${report.period.end}` : "";
    items.push({
      kind: "own_result",
      ad_name: row.name,
      id: `${report.reading}-${slug(row.name)}`,
      who: "integrante",
      text: `O anúncio ${row.name} (conceito ${concept.key}) teve veredito ${row.verdict.replace("_", " ")}, ${row.certainty.replace("-", " ")}${period}: ${row.reasons?.[0] ?? ""}`.trim(),
      where: `leitura ${report.reading} do app de medição`,
      metrics,
      verdict: row.verdict,
      where_it_fails: row.where_it_fails ?? null,
      concept: concept.key,
    });
  }
  return { version: 1, kind: "declared", collected_at: report.period?.end ?? report.generated_at?.slice(0, 10), source: { type: "declared", ref: `leitura ${report.reading} do app de medição (${report.source}, ${report.allowable_source ?? "sem custo permitido"})` }, items };
}

/**
 * Proposes the next round from the report and the current concepts: keep, iterate (and where),
 * cut (never back the same), the number of new concepts the round needs, and the next names.
 */
export function proposeNextRound(report, { concepts, brief, round = 1, resultIds = {} }) {
  const byName = new Map(concepts.map((concept) => [concept.ad_name, concept]));
  const pattern = brief?.padrao ?? "<conceito>-<formato>-<gancho>-v<n>";
  const nextVersion = round + 1;
  const keep = [];
  const iterate = [];
  const cut = [];
  const unread = [];
  for (const row of report.rows) {
    const concept = byName.get(row.name) ?? (row.concept ? concepts.find((item) => item.key === row.concept) : null);
    if (!concept) continue;
    const result = `${report.reading}-${slug(row.name)}`;
    const next = adName(pattern, { concept: { ...concept, version: nextVersion }, placement: "vertical", version: nextVersion });
    const entry = { concept: concept.key, ad_name: row.name, result_id: resultIds[row.name] ?? `res-${result}`, verdict: row.verdict, certainty: row.certainty, next_name: next };
    if (row.verdict === "escalar" || row.verdict === "manter") keep.push({ ...entry, do: row.verdict === "escalar" ? "manter a peça e fazer duas variações do mesmo gancho (os 3 primeiros segundos mudam, o resto fica)" : "manter como está até a leitura seguinte" });
    else if (row.verdict === "iterar") iterate.push({ ...entry, where_it_fails: row.where_it_fails, do: row.where_it_fails === "gancho" ? "trocar só os 3 primeiros segundos; miolo e chamada ficam" : row.where_it_fails === "miolo" ? "trocar o miolo e a chamada; o gancho fica" : "a página de destino, não a peça: continuidade e primeiro chamado" });
    else if (row.verdict === "cortar") cut.push({ ...entry, rule: "um conceito cortado não volta igual: o ângulo sai da leva, ou volta com outra barreira ou motivador, outro gancho e outra prova" });
    else unread.push({ ...entry, do: "segurar; a leitura seguinte decide" });
  }
  const newNeeded = Math.max(0, 3 - keep.length - iterate.length);
  return {
    version: 1,
    reading: report.reading,
    period: report.period ?? null,
    round: nextVersion,
    keep,
    iterate,
    cut,
    unread,
    new_concepts_needed: newNeeded,
    rules: ["o resultado próprio é a evidência mais forte: cada ficha da rodada cita o id do resultado (res-…)", "um conceito cortado não volta igual", `os nomes da rodada terminam em -v${nextVersion}`, "2 a 3 conceitos novos em teste toda semana, para o criativo não cansar"],
    say: `Rodada ${nextVersion}: ${keep.length} para manter, ${iterate.length} para iterar, ${cut.length} cortado(s), ${unread.length} sem veredito; ${newNeeded} conceito(s) novo(s) para a leva.`,
  };
}

const VERDICT_WORDS = { escalar: "escalar", manter: "manter", iterar: "iterar", cortar: "cortar", negativar: "negativar", dado_insuficiente: "dado insuficiente" };

/** rodada.md: the proposal of the next round, for the member and the AI that writes the concepts. */
export function roundMarkdown(proposal, { campaign, report }) {
  const lines = [`# A rodada ${proposal.round}: ${campaign}`, "", `Da leitura ${proposal.reading} do app de medição${proposal.period ? ` (${proposal.period.start} a ${proposal.period.end})` : ""}, lida de ${report}. ${proposal.say}`, ""];
  lines.push("| Conceito | Anúncio | Veredito | Certeza | O que fazer | Próximo nome |", "|---|---|---|---|---|---|");
  for (const entry of [...proposal.keep, ...proposal.iterate, ...proposal.cut, ...proposal.unread]) lines.push(`| ${entry.concept} | ${entry.ad_name} | ${VERDICT_WORDS[entry.verdict] ?? entry.verdict} | ${String(entry.certainty).replace("-", " ")} | ${entry.do ?? entry.rule} | ${entry.verdict === "cortar" ? "não volta igual" : entry.next_name} |`);
  lines.push("", `Conceitos novos para a leva: ${proposal.new_concepts_needed}.`, "", "Regras desta rodada:", "", ...proposal.rules.map((rule) => `- ${rule.charAt(0).toUpperCase()}${rule.slice(1)}.`), "", "Cada ficha da rodada cita o id do resultado próprio (res-…) que a sustenta; o resultado próprio é a evidência mais forte que um conceito pode ter.");
  return `${lines.join("\n").trimEnd()}\n`;
}
