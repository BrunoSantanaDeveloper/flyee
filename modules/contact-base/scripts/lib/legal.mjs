// The legal basis of each group (base-legal.md): how the people came in, what they accepted,
// what data is kept and where, the basis, the contact ceiling and the retention. Method, not
// legal advice: while a group's record has an empty field, its sequence stays `pendente` (D30).

import { fold } from "./util.mjs";
import { GROUPS } from "./inventory.mjs";

export const FIELDS = [
  { key: "como_entrou", label: "Como entrou", help: "o formulário, a compra, o teste, a planilha de evento; quem trouxe" },
  { key: "texto_aceito", label: "Texto aceito", help: "o que a pessoa leu ao entrar, com a frase sobre receber novidades, ou que não havia frase" },
  { key: "dados_presentes", label: "Dados presentes", help: "e-mail, telefone, nome, datas de uso; nada além do necessário para escrever" },
  { key: "ultimo_contato", label: "Último contato e descadastros", help: "quando foi a última mensagem e quantos pediram para sair" },
  { key: "onde_guardada", label: "Onde está guardada", help: "a ferramenta ou a planilha, quem tem acesso" },
  { key: "base_legal", label: "Base legal", help: "consentimento, legítimo interesse (cliente ou quem testou, com a expectativa de receber) ou execução de contrato (só o transacional)" },
  { key: "teto_contatos", label: "Teto de contatos", help: "quantas mensagens de marketing por semana este grupo recebe, no máximo" },
  { key: "retencao", label: "Retenção", help: "por quanto tempo a base fica guardada e o que acontece com quem não responde à repermissão" },
];

export const BASES = ["consentimento", "legitimo-interesse", "execucao-de-contrato"];
export const GROUP_LABELS = { clientes: "Clientes (pagam hoje)", "ex-clientes": "Ex-clientes (pagaram e saíram)", testaram: "Testaram (usaram sem pagar)", "nunca-ativaram": "Nunca ativaram (cadastraram e não usaram)" };

const SUGGESTED_BASIS = { clientes: "legitimo-interesse", "ex-clientes": "legitimo-interesse", testaram: "legitimo-interesse", "nunca-ativaram": "consentimento" };

/** base-legal.md as it starts: one section per group, every field to fill, the hints in parentheses. */
export function legalTemplate({ inventory = null, today }) {
  const lines = ["# A base legal de cada grupo", "", `Escrito em ${today}. Uma seção por grupo, um campo por linha, no formato "- Campo: valor". A régua de um grupo fica pendente enquanto um campo dele estiver vazio. Isto é método, não parecer jurídico: na dúvida, quem responde é quem cuida do jurídico da marca.`, ""];
  for (const group of GROUPS) {
    const counts = inventory?.groups?.[group];
    lines.push(`## ${GROUP_LABELS[group]}`, "", `Chave: ${group}${counts ? `. ${counts.total} contato(s), ${counts.marketable} que podem receber marketing, ${counts.stale} sem contato há 6 meses ou mais.` : "."}`, "");
    for (const field of FIELDS) {
      const suggestion = field.key === "base_legal" ? ` Sugestão: ${SUGGESTED_BASIS[group]}.` : "";
      lines.push(`- ${field.label} (${field.help}.${suggestion}):`);
    }
    lines.push("");
  }
  lines.push("## Vale para todos", "", "- Quem pediu para sair não recebe mais nada de marketing, em nenhum canal.", "- Quem não recebe nada há 6 meses ou mais recebe primeiro a repermissão; quem não responder sai da régua e fica guardado só para não ser contatado de novo.", "- Toda mensagem diz quem escreve, de onde veio o contato e como sair com um clique.", "- A base fica na pasta do projeto, não sai da máquina e não entra em relatório, contagem ou outro app com nome, e-mail ou telefone.");
  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * "- Label (help, with (nested) parentheses and a colon: inside): value" → { label, value }.
 * The label ends at the first "(" or ":"; the help runs to its matching ")"; the value starts
 * after the first ":" that follows the help.
 */
function splitLine(raw) {
  const match = /^\s*[-*]\s*(.*)$/.exec(raw);
  if (!match) return null;
  const rest = match[1];
  let i = 0;
  let label = "";
  while (i < rest.length && rest[i] !== "(" && rest[i] !== ":") label += rest[i++];
  if (i >= rest.length) return null;
  if (rest[i] === "(") {
    let depth = 0;
    for (; i < rest.length; i++) {
      if (rest[i] === "(") depth++;
      else if (rest[i] === ")") {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
    while (i < rest.length && rest[i] !== ":") i++;
    if (i >= rest.length) return null;
  }
  return { label: label.trim(), value: rest.slice(i + 1).trim() };
}

/** Reads base-legal.md: the fields of each group and whether the group is complete. */
export function parseLegal(text) {
  const groups = {};
  let current = null;
  for (const raw of String(text ?? "").replace(/\r\n/g, "\n").split("\n")) {
    const heading = /^##\s+(.+)$/.exec(raw);
    if (heading) {
      const key = GROUPS.find((group) => fold(heading[1]).includes(fold(GROUP_LABELS[group].split(" (")[0])) || fold(heading[1]) === group);
      current = key ?? null;
      if (current) groups[current] ??= { fields: {}, missing: [], status: "pendente" };
      continue;
    }
    const chave = /^Chave:\s*([a-z-]+)/.exec(raw);
    if (chave && GROUPS.includes(chave[1])) {
      current = chave[1];
      groups[current] ??= { fields: {}, missing: [], status: "pendente" };
      continue;
    }
    if (!current) continue;
    const parsed = splitLine(raw);
    if (!parsed) continue;
    const label = fold(parsed.label);
    const field = FIELDS.find((candidate) => fold(candidate.label) === label || fold(candidate.label).startsWith(label));
    if (!field) continue;
    groups[current].fields[field.key] = parsed.value;
  }
  for (const group of GROUPS) {
    const entry = (groups[group] ??= { fields: {}, missing: [], status: "pendente" });
    entry.missing = FIELDS.filter((field) => !entry.fields[field.key] || /^(\.\.\.|…|\?)$/.test(entry.fields[field.key])).map((field) => field.key);
    const basis = fold(entry.fields.base_legal ?? "").replace(/\s+/g, "-").replace(/[íì]/g, "i");
    entry.basis = BASES.find((candidate) => basis.includes(candidate.replace(/-/g, "")) || basis.includes(candidate)) ?? (basis ? "desconhecida" : null);
    if (entry.basis === "desconhecida") entry.missing.push("base_legal:desconhecida");
    entry.status = entry.missing.length ? "pendente" : "completo";
    entry.marketing_allowed = entry.status === "completo" && entry.basis !== "execucao-de-contrato";
  }
  return groups;
}

/** The questions for the member, one per empty field, at most four, the most decisive first. */
export function legalQuestions(parsed, group) {
  const entry = parsed[group];
  if (!entry) return [];
  const order = ["base_legal", "como_entrou", "texto_aceito", "ultimo_contato", "dados_presentes", "onde_guardada", "teto_contatos", "retencao"];
  return order
    .filter((key) => entry.missing.includes(key) || (key === "base_legal" && entry.missing.includes("base_legal:desconhecida")))
    .slice(0, 4)
    .map((key) => {
      const field = FIELDS.find((candidate) => candidate.key === key);
      return { key, question: `${GROUP_LABELS[group]}: ${field.label.toLowerCase()}? (${field.help})`, suggestion: key === "base_legal" ? SUGGESTED_BASIS[group] : key === "teto_contatos" ? "até 3 por semana, 1 a cada 16 horas" : key === "retencao" ? "12 meses sem resposta e sai; quem pediu para sair fica só na lista de exclusão" : null };
    });
}
