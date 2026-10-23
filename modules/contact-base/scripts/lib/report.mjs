// The documents the app writes for the member: the sequence of each group and the inventory in
// words. Counts and rules only; a person's data never enters a document.

import { brDay } from "./util.mjs";
import { GROUPS } from "./inventory.mjs";
import { GROUP_LABELS } from "./legal.mjs";

const num = (value) => Number(value ?? 0).toLocaleString("pt-BR");

/** The inventory in three lines. */
export function inventorySay(inventory) {
  const c = inventory.counts;
  return [
    `${num(c.rows)} linha(s) lidas, ${num(c.total)} pessoa(s) depois de tirar ${num(c.duplicates)} duplicada(s); ${num(c.valid)} podem receber marketing (${num(c.unsubscribed)} pediram para sair, ${num(c.without_email_or_phone)} sem e-mail nem telefone).`,
    `Por grupo: ${GROUPS.map((group) => `${num(inventory.groups[group].total)} ${group}`).join(", ")}. Uso: ${num(inventory.activity.ativos)} ativos, ${num(inventory.activity.parados)} parados, ${num(inventory.activity.inativos)} inativos.`,
    `${num(c.stale_6_months)} pessoa(s) sem contato há 6 meses ou mais: para elas a primeira mensagem é a repermissão. ${c.invalid_emails ? `${num(c.invalid_emails)} e-mail(s) inválido(s)` : "Nenhum e-mail inválido"}; ${c.phones_without_area_code ? `${num(c.phones_without_area_code)} telefone(s) sem DDD.` : "nenhum telefone sem DDD."}`,
  ];
}

/** regua.md: every group's sequence the project has. */
export function renderSequences(store, { brand = null }) {
  const lines = [`# A régua da base${brand ? `: ${brand}` : ""}`, "", "Uma régua por grupo. Cada mensagem tem um trabalho só, um assunto curto, um chamado e um link pela regra única. O corpo está por escrever: a sua IA escreve com o guia de texto da régua e revisa com a skill de texto natural. Nenhuma mensagem sai enquanto a régua do grupo estiver pendente.", ""];
  const keys = Object.keys(store.groups ?? {});
  const groups = [...GROUPS.filter((group) => keys.includes(group)), ...GROUPS.map((group) => `${group}@whatsapp`).filter((key) => keys.includes(key))];
  if (!groups.length) lines.push("Nenhuma régua ainda.");
  for (const key of groups) {
    const sequence = store.groups[key];
    const group = key.replace(/@whatsapp$/, "");
    lines.push(`## ${GROUP_LABELS[group]}${sequence.channel === "whatsapp" ? ", por WhatsApp" : ""}`, "", `Estado: **${sequence.state}**${sequence.pending_why ? ` (${sequence.pending_why})` : ""}. Ancorada ${sequence.anchors.source === "plano" ? `no plano ${sequence.anchors.plan}` : `na data alvo ${brDay(sequence.anchors.target_date, true)}`}: aquecimento de ${brDay(sequence.anchors.aquecimento.start)} a ${brDay(sequence.anchors.aquecimento.end)}, pico de ${brDay(sequence.anchors.pico.start)} a ${brDay(sequence.anchors.pico.end)}.${sequence.counts ? ` ${num(sequence.counts.marketable)} pessoa(s) podem receber; ${num(sequence.counts.stale)} começam pela repermissão.` : ""}`, "");
    if (sequence.channel === "whatsapp") {
      lines.push("| Data | Dia | Modelo aprovado até | Mensagem | Para quem | Trabalho | Chamado |", "|---|---|---|---|---|---|---|");
      for (const step of sequence.steps) lines.push(`| ${brDay(step.date)} | ${step.weekday} | ${brDay(step.approve_by)} | ${step.label} | ${step.audience} | ${step.job} | ${step.cta} |`);
    } else {
      lines.push("| Data | Dia | Mensagem | Para quem | Trabalho | Assunto | Chamado |", "|---|---|---|---|---|---|---|");
      for (const step of sequence.steps) lines.push(`| ${brDay(step.date)} | ${step.weekday} | ${step.label} | ${step.audience} | ${step.job} | ${step.subject} | ${step.cta} |`);
    }
    lines.push("", "Links (a regra única, um por mensagem):", "", ...sequence.steps.map((step) => `- ${step.label}: ${step.link}`), "");
    if (sequence.warnings.length) lines.push("Avisos:", "", ...sequence.warnings.map((warning) => `- ${warning.text}`), "");
    lines.push("Regras desta régua:", "", ...Object.values(sequence.rules).map((rule) => `- ${rule}`), "");
  }
  lines.push("## O rodapé de toda mensagem", "", "Quem escreve (nome e marca), de onde veio o contato (como a pessoa entrou) e como sair com um clique. Sem isso, a mensagem não sai. No WhatsApp, a saída é a palavra SAIR na resposta, e quem sai não recebe mais nada por nenhum canal.");
  return `${lines.join("\n").trimEnd()}\n`;
}

/** envio.md: the deliverability check of the sending domain, item by item, and the batch plan. */
export function renderDeliverability(result, { today }) {
  const words = { ok: "ok", missing: "falta", attention: "atenção", unknown: "a conferir" };
  const lines = [`# Entrega: o domínio ${result.domain}`, "", `Conferido em ${today} no DNS público, sem chave. ${result.say}`, "", "| Item | Estado | O que vi | O que fazer |", "|---|---|---|---|"];
  for (const item of result.items) lines.push(`| ${item.id} | ${words[item.status] ?? item.status} | ${item.text} | ${item.fix ?? ""} |`);
  lines.push("", "## Os limiares de saúde por envio", "", `- Rejeição dura abaixo de ${String(result.thresholds.hard_bounce_pct_max).replace(".", ",")}%.`, `- Reclamação abaixo de ${String(result.thresholds.complaint_pct_max).replace(".", ",")}%.`, `- Descadastro abaixo de ${String(result.thresholds.unsubscribe_pct_max).replace(".", ",")}%.`, "", "Acima de um deles, só o grupo mais engajado recebe até a próxima leitura limpa.", "");
  lines.push("## Os lotes de uma lista parada", "", result.batches.rule.charAt(0).toUpperCase() + result.batches.rule.slice(1) + ".", "", ...result.batches.steps.map((step) => `- Dia ${step.day}: ${step.share}.`), "", `Para quando: ${result.batches.stop_when}.`);
  return `${lines.join("\n").trimEnd()}\n`;
}

/** publicos/<segmento>.md: what the audience holds, what stays out, and the upload steps. */
export function renderAudience(result, { segment, steps }) {
  const lines = [`# Público para a Meta: ${segment}`, "", `Gerado em ${result.generated_at}. ${result.say}`, "", "O arquivo ao lado tem só hashes (SHA-256) do e-mail e do telefone, como a Meta pede; nenhum dado legível sai daqui. Quem pediu para sair, quem está num grupo sem base legal de marketing e quem não tem e-mail nem telefone ficou de fora.", ""];
  lines.push("| Contagem | Valor |", "|---|---|", `| Pessoas no segmento | ${result.counts.people} |`, `| Entram no público | ${result.counts.included} |`, `| Pediram para sair | ${result.counts.unsubscribed} |`, `| Sem base legal de marketing | ${result.counts.no_legal_basis} |`, `| Sem e-mail nem telefone | ${result.counts.no_reach} |`, `| Lista de exclusão (clientes atuais) | ${result.counts.exclusion_list} |`, "");
  lines.push(`Reconhecimento estimado: ${result.estimate.matched.low} a ${result.estimate.matched.high} pessoas (${result.estimate.rate.label}). ${result.minimums.label.charAt(0).toUpperCase()}${result.minimums.label.slice(1)}.`, "");
  if (result.warnings.length) lines.push("Avisos:", "", ...result.warnings.map((warning) => `- ${warning.text}`), "");
  lines.push("## Como subir", "", ...steps.map((step, index) => `${index + 1}. ${step}`));
  return `${lines.join("\n").trimEnd()}\n`;
}
