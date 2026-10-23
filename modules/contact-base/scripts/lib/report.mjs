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
  const groups = GROUPS.filter((group) => store.groups[group]);
  if (!groups.length) lines.push("Nenhuma régua ainda.");
  for (const group of groups) {
    const sequence = store.groups[group];
    lines.push(`## ${GROUP_LABELS[group]}`, "", `Estado: **${sequence.state}**${sequence.pending_why ? ` (${sequence.pending_why})` : ""}. Ancorada ${sequence.anchors.source === "plano" ? `no plano ${sequence.anchors.plan}` : `na data alvo ${brDay(sequence.anchors.target_date, true)}`}: aquecimento de ${brDay(sequence.anchors.aquecimento.start)} a ${brDay(sequence.anchors.aquecimento.end)}, pico de ${brDay(sequence.anchors.pico.start)} a ${brDay(sequence.anchors.pico.end)}.${sequence.counts ? ` ${num(sequence.counts.marketable)} pessoa(s) podem receber; ${num(sequence.counts.stale)} começam pela repermissão.` : ""}`, "");
    lines.push("| Data | Dia | Mensagem | Para quem | Trabalho | Assunto | Chamado |", "|---|---|---|---|---|---|---|");
    for (const step of sequence.steps) lines.push(`| ${brDay(step.date)} | ${step.weekday} | ${step.label} | ${step.audience} | ${step.job} | ${step.subject} | ${step.cta} |`);
    lines.push("", "Links (a regra única, um por mensagem):", "", ...sequence.steps.map((step) => `- ${step.label}: ${step.link}`), "");
    if (sequence.warnings.length) lines.push("Avisos:", "", ...sequence.warnings.map((warning) => `- ${warning.text}`), "");
    lines.push("Regras desta régua:", "", ...Object.values(sequence.rules).map((rule) => `- ${rule}`), "");
  }
  lines.push("## O rodapé de toda mensagem", "", "Quem escreve (nome e marca), de onde veio o contato (como a pessoa entrou) e como sair com um clique. Sem isso, a mensagem não sai.");
  return `${lines.join("\n").trimEnd()}\n`;
}
