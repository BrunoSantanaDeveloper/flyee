// The member's document for one call, and the short version for the chat.
// Every sentence here is built from computed values; nothing is written by whoever answered the questions.

import { formatClock } from "./util.mjs";

const JUDGES = { ai: "a sua IA", model: "o modelo de decisões, ao vivo", mixed: "o modelo de decisões ao vivo, e a sua IA nas falas que faltaram" };
const MODES = { review: "revisão de uma call", practice: "treino", live: "call ao vivo" };
const HOW = { resolved: "respondida, o cliente aceitou", left: "ficou sem resposta aceita", open: "aberta no fim da call" };

const when = (turns, index) => {
  if (index === null || index === undefined) return "";
  const t = turns[index]?.t;
  return t !== null && t !== undefined ? `${formatClock(t)} (fala ${index + 1})` : `fala ${index + 1}`;
};
const signed = (points) => (points > 0 ? `+${String(points).replace(".", ",")}` : String(points).replace(".", ","));
const number = (value) => String(value).replace(".", ",");
const short = (text, max = 110) => (String(text).length > max ? `${String(text).slice(0, max - 1).trimEnd()}…` : String(text));
const cell = (text) => String(text ?? "").replace(/\|/g, "/").replace(/\s+/g, " ");

/** Three lines for the chat and what the member decides next. */
export function chatSummary(call, reading) {
  const { summary } = reading;
  const say = [];
  say.push(`Sinal da call: ${number(summary.signal.final)} de 100 (começou em ${summary.signal.start}, foi de ${number(summary.signal.min)} a ${number(summary.signal.max)}). É uma regra de bolso, não uma previsão.`);
  const moment = (item, lead) => {
    const why = item.movers.filter((mover) => mover.id !== "stage").map((mover) => mover.label.toLowerCase());
    return `${lead}, em ${when(call.turns, item.i)}, foi do ${item.speaker === "seller" ? "vendedor" : "cliente"}: "${short(item.text)}"${why.length ? ` O que contou: ${why.join(", ")}.` : ""}`;
  };
  if (summary.drops[0]) say.push(moment(summary.drops[0], "A fala que mais pesou contra"));
  else if (summary.rises[0]) say.push(moment(summary.rises[0], "A fala que mais ajudou"));
  if (summary.pending.length) say.push(`Faltou no roteiro: ${summary.pending.slice(0, 3).map((item) => item.label).join(", ")}${summary.pending.length > 3 ? ` e mais ${summary.pending.length - 3}` : ""}.`);
  else say.push("O roteiro foi cumprido inteiro.");
  const decisions = [];
  if (call.mode !== "practice" && !call.outcome) decisions.push("Quando souber, diga se esta call virou venda ou não: com os resultados, o app compara o sinal das que fecharam com o das que não fecharam.");
  return { say, decisions };
}

/** The full document, in Markdown. */
export function renderReport(call, reading, method) {
  const { summary } = reading;
  const { turns } = call;
  const lines = [];
  const push = (...text) => lines.push(...text);

  push(`# Leitura da call${call.name ? `: ${call.name}` : ""}`, "");
  push(`- Tipo: ${MODES[call.mode] ?? call.mode}`);
  push(`- Data: ${call.date}`);
  if (call.source?.origin) push(`- Origem das falas: ${call.source.origin}${call.source.file ? ` (${call.source.file})` : ""}`);
  push(`- Quem respondeu às perguntas sobre cada fala: ${JUDGES[call.judge] ?? call.judge}`);
  push(`- Falas: ${summary.coverage.turns} · lidas: ${summary.coverage.judged} · curtas demais para ler: ${summary.coverage.short} · sem leitura: ${summary.coverage.not_judged}`);
  if (call.outcome) push(`- Resultado informado: ${call.outcome === "won" ? "virou venda" : "não virou venda"}`);
  push("");

  push("## Em três linhas", "");
  chatSummary(call, reading).say.forEach((line, index) => push(`${index + 1}. ${line}`));
  push("");

  if (summary.notes.length) {
    push("## O que rever", "");
    for (const item of summary.notes) push(`- ${item.text}${item.at_turn !== null ? ` Em ${when(turns, item.at_turn)}.` : ""}`);
    push("");
  }

  push("## O roteiro", "", "| Etapa | Item | Aconteceu | Pergunta para a próxima call |", "|---|---|---|---|");
  for (const part of summary.roadmap) {
    for (const check of part.checks) {
      push(`| ${cell(part.title)} | ${cell(check.label)} | ${check.done ? `sim, em ${when(turns, check.at_turn)}` : "não"} | ${check.done ? "" : cell(check.ask)} |`);
    }
  }
  push("");

  push("## Objeções", "");
  if (!summary.objections.length) push("Nenhuma objeção foi levantada nas falas lidas.", "");
  else {
    push("| Quando | Tipo | O que o cliente disse | Como terminou |", "|---|---|---|---|");
    for (const objection of summary.objections) {
      const end = objection.how === "resolved" ? `${HOW.resolved}, em ${when(turns, objection.closed_at)}` : HOW[objection.how];
      push(`| ${when(turns, objection.opened_at)} | ${cell(objection.label)} | "${cell(objection.text)}" | ${end} |`);
    }
    push("");
  }

  const moments = (title, list) => {
    if (!list.length) return;
    push(`## ${title}`, "");
    for (const moment of list) {
      push(`**${when(turns, moment.i)} · ${moment.speaker === "seller" ? "vendedor" : "cliente"} · ${signed(moment.points)} pontos na leitura desta fala**`, "");
      push(`> ${moment.text}`, "");
      if (moment.movers.length) push(`O que mexeu: ${moment.movers.map((mover) => `${mover.label} (${signed(mover.points)})`).join(", ")}.`);
      if (moment.move) push(`Jogada indicada a partir daqui: ${moment.move.title}.${moment.move.line ? ` Uma frase do seu playbook: "${moment.move.line}"` : ""}`);
      push("");
    }
  };
  moments("As falas que mais pesaram contra", summary.drops);
  moments("As falas que mais ajudaram", summary.rises);

  push("## Quem falou", "");
  push(`- O vendedor falou ${Math.round(summary.talk.seller_share * 100)} por cento das palavras (${summary.talk.seller_words} do vendedor, ${summary.talk.client_words} do cliente).`);
  push(`- Perguntas abertas do vendedor: ${summary.talk.open_questions}.`);
  if (summary.talk.monologues.length) push(`- Falas longas do vendedor: ${summary.talk.monologues.map((item) => `${when(turns, item.i)}, ${item.words} palavras`).join("; ")}.`);
  push("");

  push("## As etapas da conversa", "");
  for (const stage of summary.stages) push(`- ${when(turns, stage.from_turn)}: ${stage.label}`);
  push("");

  push("## Como ler este documento", "");
  push(`- O sinal vai de 0 a 100 e é uma ${String(method.weights.label).toLowerCase()}: ${method.weights.source} Pesos conferidos em ${method.weights.checked_on}${method.weightsFrom === "project" ? ", com os ajustes do arquivo de pesos deste projeto" : ""}.`);
  push("- O sinal mostrado é uma média que anda aos poucos: cada fala tem a sua leitura, e o sinal caminha na direção dela. Por isso os pontos de uma fala são maiores do que a mudança do sinal naquele instante.");
  push("- Quem lê as falas muda um pouco o número: as notas de clima e de participação dependem do leitor, e duas leituras da mesma call podem diferir em alguns pontos. As objeções e os itens do roteiro variam menos.");
  push("- Uma call sozinha é um indício. A comparação entre calls só vale com os resultados informados de várias delas.");
  push(`- As frases sugeridas vêm do ${method.playbookFrom === "project" ? "playbook deste projeto" : "playbook modelo do app, ainda sem as frases do seu negócio"}.`);
  push("- Os tipos de objeção, as etapas e os itens do roteiro saem das respostas dadas a cada fala; a conta e os avisos são do app.");
  push("");
  return lines.join("\n");
}

/** How the signal of the calls that closed compares with the ones that did not. Below the minimum sample, it is an indication. */
export function compareOutcomes(calls, minSample) {
  const group = (outcome) => {
    const values = calls.filter((call) => call.outcome === outcome && typeof call.final_signal === "number").map((call) => call.final_signal);
    const mean = values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
    return { calls: values.length, mean_signal: mean };
  };
  const won = group("won");
  const lost = group("lost");
  const enough = won.calls >= minSample && lost.calls >= minSample;
  let text;
  if (!won.calls || !lost.calls) text = "Ainda não há calls com resultado informado dos dois lados para comparar.";
  else {
    text = `Nas ${won.calls} call(s) que viraram venda o sinal final médio foi ${number(won.mean_signal)}; nas ${lost.calls} que não viraram, ${number(lost.mean_signal)}.`;
    text += enough ? "" : ` É um indício: a comparação pede pelo menos ${minSample} calls de cada lado.`;
  }
  return { won, lost, min_sample: minSample, confidence: enough ? "amostra mínima atingida" : "indício", text };
}
