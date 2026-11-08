// The legal basis of each group (base-legal.md): how the people came in, what they accepted,
// what data is kept and where, the basis, the contact ceiling and the retention. Method, not
// legal advice: while a group's record has an empty field, its sequence stays `pendente` (D30).
// What is the same for every group is asked once and written in one section; what the inventory
// already knows is written by the script; the basis, a rights decision, is the only field per group.

import { brDay, fold } from "./util.mjs";
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

export const SHARED_HEADING = "Todos os grupos";
const SHARED_INTRO = "O que vale para todos os grupos fica aqui, uma vez só. Um grupo que for diferente preenche a própria linha, e a dele manda. A base legal é sempre de cada grupo.";
const SUGGESTED = { teto_contatos: "até 3 por semana, 1 a cada 16 horas", retencao: "12 meses sem resposta e sai; quem pediu para sair fica só na lista de exclusão" };
/** The order of the rounds. The basis comes last in its round because it depends on how people came in and what they read. */
const ASK_ORDER = ["como_entrou", "texto_aceito", "onde_guardada", "dados_presentes", "ultimo_contato", "teto_contatos", "retencao", "base_legal"];
const ASK_AFTER = { base_legal: ["como_entrou", "texto_aceito"] };
const COLUMN_WORDS = { email: "e-mail", phone: "telefone", name: "nome", created: "data de cadastro", last_active: "último uso", last_contact: "último contato", status: "status ou plano", paid: "se paga", canceled: "data de cancelamento", orders: "pedidos", revenue: "receita", source: "origem", consent: "consentimento", unsubscribed: "descadastro", tags: "etiquetas" };
const isEmpty = (value) => !value || /^(\.\.\.|…|\?)$/.test(value);

/** What the inventory already answers: counts and column names only, never a person. */
export function knownValues(inventory) {
  const out = { shared: {}, groups: {} };
  if (!inventory) return out;
  const used = new Set((inventory.files ?? []).flatMap((file) => Object.keys(file.columns_used ?? {})));
  const present = Object.keys(COLUMN_WORDS).filter((column) => used.has(column)).map((column) => COLUMN_WORDS[column]);
  if (present.length) out.shared.dados_presentes = `${present.join(", ")} (das colunas do export)`;
  if (used.has("last_contact")) {
    for (const group of GROUPS) {
      const counts = inventory.groups?.[group];
      if (!counts?.total) continue;
      const left = used.has("unsubscribed") ? `${counts.unsubscribed ?? 0} pediram para sair` : "o export não diz quem pediu para sair";
      const last = counts.last_contact ? `última mensagem em ${brDay(counts.last_contact, true)}` : "o export não traz data de contato deste grupo";
      out.groups[group] = { ultimo_contato: `${last}; ${left} (do inventário)` };
    }
  }
  return out;
}

function fieldOfLine(raw) {
  const parsed = splitLine(raw);
  if (!parsed) return null;
  const label = fold(parsed.label);
  const field = FIELDS.find((candidate) => fold(candidate.label) === label || fold(candidate.label).startsWith(label));
  return field ? { field, value: parsed.value } : null;
}

/** Writes what the inventory knows on the empty lines. The member's text is never touched. */
function fillKnown(text, inventory) {
  const known = knownValues(inventory);
  let section = null;
  return text
    .split("\n")
    .map((raw) => {
      const heading = /^##\s+(.+)$/.exec(raw);
      if (heading) section = fold(heading[1]) === fold(SHARED_HEADING) ? "shared" : null;
      const chave = /^Chave:\s*([a-z-]+)/.exec(raw);
      if (chave && GROUPS.includes(chave[1])) section = chave[1];
      if (!section) return raw;
      const line = fieldOfLine(raw);
      if (!line || !isEmpty(line.value)) return raw;
      const value = section === "shared" ? known.shared[line.field.key] : known.groups[section]?.[line.field.key];
      return value ? `${raw.trimEnd()} ${value}` : raw;
    })
    .join("\n");
}

function sharedSection() {
  return [`## ${SHARED_HEADING}`, "", SHARED_INTRO, "", ...FIELDS.filter((field) => field.key !== "base_legal").map((field) => `- ${field.label} (${field.help}.):`), ""];
}

/** A file written before this version gains the shared section; every answer stays where it is. */
export function upgradeLegal(text, inventory) {
  let out = String(text ?? "");
  if (!new RegExp(`^##\\s+${SHARED_HEADING}\\s*$`, "m").test(out)) {
    const at = out.search(/^##\s/m);
    const section = `${sharedSection().join("\n")}\n`;
    out = at < 0 ? `${out.trimEnd()}\n\n${section}` : `${out.slice(0, at)}${section}${out.slice(at)}`;
  }
  return fillKnown(out, inventory);
}

/** base-legal.md as it starts: one section per group, every field to fill, the hints in parentheses. */
export function legalTemplate({ inventory = null, today }) {
  const lines = ["# A base legal de cada grupo", "", `Escrito em ${today}. Um campo por linha, no formato "- Campo: valor". A régua de um grupo fica pendente enquanto um campo dele estiver vazio. Isto é método, não parecer jurídico: na dúvida, quem responde é quem cuida do jurídico da marca.`, "", ...sharedSection()];
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
  return fillKnown(`${lines.join("\n").trimEnd()}\n`, inventory);
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
  const shared = {};
  let current = null;
  let inShared = false;
  for (const raw of String(text ?? "").replace(/\r\n/g, "\n").split("\n")) {
    const heading = /^##\s+(.+)$/.exec(raw);
    if (heading) {
      inShared = fold(heading[1]) === fold(SHARED_HEADING);
      const key = inShared ? null : GROUPS.find((group) => fold(heading[1]).includes(fold(GROUP_LABELS[group].split(" (")[0])) || fold(heading[1]) === group);
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
    if (!current && !inShared) continue;
    const line = fieldOfLine(raw);
    if (!line) continue;
    if (inShared) shared[line.field.key] = line.value;
    else groups[current].fields[line.field.key] = line.value;
  }
  for (const group of GROUPS) {
    const entry = (groups[group] ??= { fields: {}, missing: [], status: "pendente" });
    // A group's own line wins; an empty one takes what is written for everyone. The basis is never shared.
    for (const field of FIELDS) if (field.key !== "base_legal" && isEmpty(entry.fields[field.key]) && !isEmpty(shared[field.key])) entry.fields[field.key] = shared[field.key];
    entry.missing = FIELDS.filter((field) => isEmpty(entry.fields[field.key])).map((field) => field.key);
    const basis = fold(entry.fields.base_legal ?? "").replace(/\s+/g, "-").replace(/[íì]/g, "i");
    entry.basis = BASES.find((candidate) => basis.includes(candidate.replace(/-/g, "")) || basis.includes(candidate)) ?? (basis ? "desconhecida" : null);
    if (entry.basis === "desconhecida") entry.missing.push("base_legal:desconhecida");
    entry.status = entry.missing.length ? "pendente" : "completo";
    entry.marketing_allowed = entry.status === "completo" && entry.basis !== "execucao-de-contrato";
  }
  return groups;
}

/**
 * The next round for the member, at most four questions, each asked once for all the groups that
 * lack it. Only what can be answered now: the basis waits for how people came in and what they read.
 * `write_to` says where the answer goes; `own_answer` marks the rights decision a loose "ok" never settles.
 */
export function legalRound(parsed, groups = GROUPS, { max = 4 } = {}) {
  const open = groups.filter((group) => parsed[group] && parsed[group].status !== "completo");
  const lacking = (key) => open.filter((group) => parsed[group].missing.includes(key) || (key === "base_legal" && parsed[group].missing.includes("base_legal:desconhecida")));
  const all = ASK_ORDER.map((key) => ({ key, who: lacking(key), after: (ASK_AFTER[key] ?? []).filter((other) => lacking(other).length) })).filter((entry) => entry.who.length);
  const ready = all.filter((entry) => !entry.after.length);
  const questions = ready.slice(0, max).map(({ key, who }) => {
    const field = FIELDS.find((candidate) => candidate.key === key);
    const one = who.length === 1 ? GROUP_LABELS[who[0]] : null;
    const short = (group) => GROUP_LABELS[group].split(" (")[0];
    if (key === "base_legal") {
      return { key, groups: who, write_to: "a linha Base legal de cada grupo", question: `${one ? `${one}: b` : "B"}ase legal${one ? "" : " de cada grupo"}? (${field.help})`, suggestion: one ? SUGGESTED_BASIS[who[0]] : who.map((group) => `${short(group)}: ${SUGGESTED_BASIS[group]}`).join("; "), yes_accepts: false, own_answer: true };
    }
    const suggestion = SUGGESTED[key] ?? null;
    return { key, groups: who, write_to: one ?? SHARED_HEADING, question: `${one ?? SHARED_HEADING}: ${field.label.toLowerCase()}? (${field.help})${one ? "" : ". Se algum grupo for diferente, diga qual"}`, suggestion, yes_accepts: Boolean(suggestion), own_answer: false };
  });
  return { questions, more_pending: all.length - questions.length, waiting: all.filter((entry) => entry.after.length).map(({ key, after }) => ({ key, after })) };
}

/** The questions about one group only (a pending sequence names its group). */
export function legalQuestions(parsed, group) {
  return legalRound(parsed, [group]).questions;
}
