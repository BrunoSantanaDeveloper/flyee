// The replan: the next version of the plan from the measurement app's weekly read, with "what
// changed and why" on top. It never moves money (the moves are the member's), never changes the
// goal in silence (a missed goal goes back to the member), and keeps the approved version frozen.

import { AppError, brDay } from "./util.mjs";

const MOVE_WORDS = { funcionou: "funcionou", nao_funcionou: "não funcionou", cedo: "cedo para ler", nao_da_para_dizer: "não dá para dizer" };

/** Reads semanal/<data>.json of the measurement app; refuses anything else. */
export function readWeekly(data, file) {
  if (!data || data.interface_version !== 1 || !Array.isArray(data.findings) || !data.week_of) throw new AppError("weekly_invalid", `${file} não é a leitura semanal do app de medição (interface 1, com week_of e findings).`, "Passe o arquivo semanal/<data>.json que o app de medição escreveu.");
  return data;
}

/**
 * What changed and why, from the weekly read against the current plan. Returns { changes,
 * triggers_fired, premise_updates, moves } for the new version.
 */
export function changesFrom(weekly, { plan, economics }) {
  const changes = [];
  const triggers = [];
  const premiseUpdates = [];
  const allowable = plan?.funnel?.allowable_cpl_brl ?? plan?.economics?.allowable_cac_brl ?? null;

  for (const finding of weekly.findings ?? []) changes.push({ kind: "achado", text: finding.text, certainty: finding.certainty, source: finding.source });
  for (const line of weekly.since_last_time ?? []) if (line.verdict) changes.push({ kind: "movimento", text: `${line.text}`, verdict: MOVE_WORDS[line.verdict] ?? line.verdict });

  const ratio = weekly.ledger?.claim_ratio ?? null;
  if (ratio !== null && (ratio > 1.5 || ratio < 1)) triggers.push({ id: "rastreamento", text: ratio < 1 ? `A razão de reivindicação é ${String(ratio).replace(".", ",")}: as plataformas contam menos compras do que a planilha. Nenhuma decisão de verba pela plataforma até conferir o evento.` : `A razão de reivindicação é ${String(ratio).replace(".", ",")}: alguém conta a mesma compra duas vezes. Conferir a deduplicação antes de ler custo.` });
  const stage = weekly.ledger?.by_stage ?? null;
  const goal = plan?.funnel?.goal ?? null;
  if (stage && goal) {
    const done = stage.compra ?? 0;
    premiseUpdates.push({ key: "meta_data", text: `${done} de ${goal} ${plan?.funnel?.goal_unit ?? "resultados"} até ${brDay(weekly.week_of, true)}, pela planilha de origem.`, source: "encontrado", where: `ads-insights/semanal/${weekly.week_of}.json` });
    if (done === 0 && weekly.findings?.length) triggers.push({ id: "meta", text: "Nenhuma compra registrada na planilha até agora: a meta volta para o integrante como decisão, nunca muda em silêncio." });
  }
  const proposed = weekly.proposed ?? [];
  const moves = proposed.map((id) => ({ id, text: `movimento ${id} proposto pela leitura; aplicar é decisão do integrante, e o efeito é lido 14 dias depois` }));
  if (proposed.length) changes.push({ kind: "proposta", text: `${proposed.length} movimento(s) propostos pela leitura (${proposed.join(", ")}): entram no plano como decisões, não como verba movida.` });
  if (weekly.not_checked?.length) changes.push({ kind: "lacuna", text: `Não medido nesta semana: ${weekly.not_checked.map((item) => item.split(":")[0]).join(", ")}.` });
  if (!changes.length) changes.push({ kind: "nada", text: "A leitura não trouxe achado nem movimento julgado: o plano segue igual, com a versão nova só para registrar a data." });
  return { changes, triggers_fired: triggers, premise_updates: premiseUpdates, moves, read: { week_of: weekly.week_of, readings: weekly.readings ?? null }, allowable_brl: allowable };
}

/** The "O que mudou e por quê" section for the top of plano-v<n>.md. */
export function changesMarkdown(replan, { version, from }) {
  const lines = [`## O que mudou e por quê (versão ${version}, da leitura de ${brDay(replan.read.week_of, true)})`, "", `Lida de ${from}. A versão anterior fica guardada; esta nasce como rascunho até o sim do integrante.`, ""];
  for (const change of replan.changes) lines.push(`- ${change.kind === "achado" ? "Achado" : change.kind === "movimento" ? "Movimento" : change.kind === "proposta" ? "Proposta" : change.kind === "lacuna" ? "Lacuna" : "Sem mudança"}: ${change.text}${change.certainty ? ` (${change.certainty.replace("-", " ")})` : ""}`);
  if (replan.triggers_fired.length) lines.push("", "Gatilhos disparados:", ...replan.triggers_fired.map((trigger) => `- ${trigger.id}: ${trigger.text}`));
  if (replan.premise_updates.length) lines.push("", "Premissas atualizadas pela leitura:", ...replan.premise_updates.map((update) => `- ${update.key}: ${update.text}`));
  lines.push("", "O que o replanejamento não faz: mover verba (os movimentos são decisão do integrante) e mudar a meta em silêncio.");
  return lines.join("\n");
}
