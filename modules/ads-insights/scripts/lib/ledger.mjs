// The origin ledger: one line per lead, sign-up, activation or purchase, with the source that
// travelled with it and a pseudonym in place of the person. No name, no e-mail, no phone ever
// reaches this file; the e-mail is hashed with a salt kept in medicao.json and thrown away.

import { createHash } from "node:crypto";
import { AppError, fold, parseDay, round2 } from "./util.mjs";
import { csvLine, parseNumber, parseTable } from "./csv.mjs";

export const COLUMNS = ["data", "etapa", "origem", "meio", "campanha", "conteudo", "parceiro", "valor_brl", "qualificado", "pseudonimo"];
export const STAGES = ["lead", "cadastro", "ativacao", "inicio_pagamento", "compra"];
const PERSONAL = ["nome", "name", "sobrenome", "telefone", "phone", "celular", "whatsapp", "cpf", "endereco", "address", "email", "e-mail", "email address", "e-mail address", "mail"];

/** Columns an import may carry, by what they mean. The e-mail becomes the pseudonym; names and phones are dropped. */
const IMPORT_MAP = {
  email: ["email", "e-mail", "email address", "e-mail address", "mail"],
  data: ["data", "date", "criado em", "created", "created at", "timestamp", "data de criacao"],
  etapa: ["etapa", "stage", "status", "evento", "event"],
  origem: ["origem", "utm_source", "source", "fonte"],
  meio: ["meio", "utm_medium", "medium"],
  campanha: ["campanha", "utm_campaign", "campaign"],
  conteudo: ["conteudo", "utm_content", "content", "anuncio", "ad"],
  parceiro: ["parceiro", "partner", "utm_term", "term"],
  valor_brl: ["valor", "valor_brl", "value", "amount", "total", "receita"],
  qualificado: ["qualificado", "qualified", "sql", "qualificado?"],
};

export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

/** sha256(salt:email), 16 hex characters: enough to tell people apart, impossible to read back. */
export function pseudonym(email, salt) {
  const clean = normalizeEmail(email);
  if (!clean) return "";
  if (!salt) throw new AppError("contract_missing", "O contrato de medição não tem o sal dos pseudônimos.", "Rode contract antes de gravar na planilha de origem.");
  return createHash("sha256").update(`${salt}:${clean}`).digest("hex").slice(0, 16);
}

export function ledgerHeader() {
  return csvLine(COLUMNS);
}

export function readLedger(text) {
  const table = parseTable(text ?? "");
  if (!table.header.length) return [];
  const header = table.header.map((name) => fold(name));
  const missing = COLUMNS.filter((column) => !header.includes(column));
  if (missing.length) throw new AppError("ledger_invalid", `origens.csv não tem as colunas ${missing.join(", ")}.`, "Crie a planilha de novo com ledger init, ou acrescente as colunas que faltam.");
  return table.records.map((record) => {
    const row = {};
    for (const column of COLUMNS) row[column] = record[table.header[header.indexOf(column)]] ?? "";
    row.valor_brl = parseNumber(row.valor_brl);
    row.qualificado = /^(sim|s|yes|y|true|1)$/i.test(row.qualificado) ? true : /^(nao|não|n|no|false|0)$/i.test(row.qualificado) ? false : null;
    return row;
  });
}

function stageOf(text) {
  const clean = fold(text).replace(/\s+/g, "_");
  if (STAGES.includes(clean)) return clean;
  if (/^(lead|contato|inscri)/.test(clean)) return "lead";
  if (/^(cadastro|signup|sign_up|registro|conta)/.test(clean)) return "cadastro";
  if (/^(ativ|activ|onboard)/.test(clean)) return "ativacao";
  if (/^(checkout|inicio|pagamento_iniciado|initiate)/.test(clean)) return "inicio_pagamento";
  if (/^(compra|purchase|venda|pago|paid|assin|subscri|won|fechado)/.test(clean)) return "compra";
  return null;
}

/** One ledger row from what the AI passes; refuses what is not a stage, a date or a number. */
export function rowFrom({ date, stage, source, medium, campaign, content, partner, value, qualified, email }, salt) {
  const day = String(date ?? "").trim();
  if (!parseDay(day)) throw new AppError("ledger_invalid", `Data inválida: ${day || "vazia"}.`, "Use AAAA-MM-DD.", { path: "data" });
  const etapa = stageOf(stage);
  if (!etapa) throw new AppError("ledger_invalid", `Etapa desconhecida: ${stage}.`, `As etapas são ${STAGES.join(", ")}.`, { path: "etapa" });
  const valor = value === undefined || value === null || value === "" ? null : parseNumber(value);
  if (value !== undefined && value !== null && value !== "" && valor === null) throw new AppError("ledger_invalid", `Valor inválido: ${value}.`, "Um número em reais, como 149 ou 1490,00.", { path: "valor_brl" });
  const qualificado = qualified === undefined || qualified === null || qualified === "" ? "" : /^(sim|s|yes|y|true|1)$/i.test(String(qualified)) ? "sim" : "nao";
  return {
    data: day,
    etapa,
    origem: fold(source ?? "").replace(/\s+/g, "-") || "desconhecida",
    meio: fold(medium ?? "").replace(/\s+/g, "-"),
    campanha: fold(campaign ?? "").replace(/\s+/g, "-"),
    conteudo: String(content ?? "").trim(),
    parceiro: fold(partner ?? "").replace(/\s+/g, "-"),
    valor_brl: valor === null ? "" : valor,
    qualificado,
    pseudonimo: pseudonym(email, salt),
  };
}

export function ledgerLines(rows) {
  return rows.map((row) => csvLine(COLUMNS.map((column) => row[column])));
}

/**
 * Reads a CSV the member exported from a form, a CRM or a billing tool and turns each line into
 * a ledger row. Only the columns in IMPORT_MAP are read; names, phones and the e-mail itself are
 * dropped and listed in `dropped_columns`, so the AI can say what did not enter.
 */
export function importRows(text, { salt, defaultStage = "lead", defaults = {} }) {
  const table = parseTable(text);
  if (!table.header.length) throw new AppError("import_invalid", "O arquivo está vazio ou não é um CSV.", "Exporte a lista de novo, com uma coluna de e-mail e, se houver, as de origem.");
  const folded = table.header.map((name) => fold(name));
  const column = (key) => {
    for (const name of IMPORT_MAP[key]) {
      const index = folded.indexOf(name);
      if (index !== -1) return table.header[index];
    }
    return null;
  };
  const columns = Object.fromEntries(Object.keys(IMPORT_MAP).map((key) => [key, column(key)]));
  if (!columns.email) throw new AppError("import_invalid", "O arquivo não tem uma coluna de e-mail: sem ela não há pseudônimo, e sem pseudônimo a mesma pessoa contaria duas vezes.", "Exporte com a coluna de e-mail; ela é transformada em pseudônimo e nunca gravada.", { columns: table.header });
  const used = new Set(Object.values(columns).filter(Boolean));
  const dropped = table.header.filter((name) => !used.has(name));
  const rows = [];
  const problems = [];
  table.records.forEach((record, index) => {
    const email = record[columns.email];
    if (!normalizeEmail(email)) {
      problems.push({ line: index + 2, problem: "sem e-mail" });
      return;
    }
    const rawDate = columns.data ? record[columns.data] : "";
    const date = parseDay(rawDate) ? rawDate : /^(\d{4}-\d{2}-\d{2})/.exec(rawDate)?.[1] ?? (/^(\d{2})\/(\d{2})\/(\d{4})/.exec(rawDate) ? `${rawDate.slice(6, 10)}-${rawDate.slice(3, 5)}-${rawDate.slice(0, 2)}` : null) ?? defaults.date ?? null;
    if (!date) {
      problems.push({ line: index + 2, problem: "sem data legível" });
      return;
    }
    try {
      rows.push(
        rowFrom(
          {
            date,
            stage: columns.etapa ? stageOf(record[columns.etapa]) ?? defaultStage : defaultStage,
            source: columns.origem ? record[columns.origem] || defaults.source : defaults.source,
            medium: columns.meio ? record[columns.meio] || defaults.medium : defaults.medium,
            campaign: columns.campanha ? record[columns.campanha] || defaults.campaign : defaults.campaign,
            content: columns.conteudo ? record[columns.conteudo] : "",
            partner: columns.parceiro ? record[columns.parceiro] : "",
            value: columns.valor_brl ? record[columns.valor_brl] : "",
            qualified: columns.qualificado ? record[columns.qualificado] : "",
            email,
          },
          salt,
        ),
      );
    } catch (error) {
      problems.push({ line: index + 2, problem: error.message });
    }
  });
  return { rows, columns, dropped_columns: dropped, personal_columns_dropped: dropped.filter((name) => PERSONAL.includes(fold(name))), problems };
}

/** Counts by origin and stage, the stage-to-stage rates by origin, revenue, and the claim ratio. */
export function summarize(rows, { claimedPurchases = null, claimedLeads = null } = {}) {
  const byOrigin = {};
  const byStage = Object.fromEntries(STAGES.map((stage) => [stage, 0]));
  const people = new Set();
  let revenue = 0;
  for (const row of rows) {
    const origin = row.origem || "desconhecida";
    byOrigin[origin] ??= Object.fromEntries([...STAGES.map((stage) => [stage, 0]), ["valor_brl", 0], ["qualificados", 0]]);
    if (STAGES.includes(row.etapa)) {
      byOrigin[origin][row.etapa] += 1;
      byStage[row.etapa] += 1;
    }
    if (typeof row.valor_brl === "number") {
      byOrigin[origin].valor_brl = round2(byOrigin[origin].valor_brl + row.valor_brl);
      revenue = round2(revenue + row.valor_brl);
    }
    if (row.qualificado === true) byOrigin[origin].qualificados += 1;
    if (row.pseudonimo) people.add(row.pseudonimo);
  }
  // Lead to purchase by person: of the pseudonyms that entered as a lead from this origin, how many bought later.
  const buyers = new Set(rows.filter((row) => row.etapa === "compra" && row.pseudonimo).map((row) => row.pseudonimo));
  const rates = {};
  for (const [origin, counts] of Object.entries(byOrigin)) {
    const leads = new Set(rows.filter((row) => row.etapa === "lead" && (row.origem || "desconhecida") === origin && row.pseudonimo).map((row) => row.pseudonimo));
    const converted = [...leads].filter((person) => buyers.has(person)).length;
    rates[origin] = { lead_to_compra_pct: leads.size ? round2((converted / leads.size) * 100) : null, qualificado_pct: counts.lead ? round2((counts.qualificados / counts.lead) * 100) : null };
  }
  const realPurchases = byStage.compra;
  const claim = claimedPurchases !== null && realPurchases > 0 ? round2(claimedPurchases / realPurchases) : null;
  const leadClaim = claimedLeads !== null && byStage.lead > 0 ? round2(claimedLeads / byStage.lead) : null;
  return {
    lines: rows.length,
    people: people.size,
    by_stage: byStage,
    by_origin: byOrigin,
    rates,
    revenue_brl: revenue,
    claimed_purchases: claimedPurchases,
    claim_ratio: claim,
    claimed_leads: claimedLeads,
    lead_claim_ratio: leadClaim,
    say: `${rows.length} linha(s), ${people.size} pessoa(s): ${STAGES.filter((stage) => byStage[stage]).map((stage) => `${byStage[stage]} ${stage.replace("_", " ")}`).join(", ") || "nenhuma etapa"}${revenue ? `, ${revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} de receita` : ""}.${claim !== null ? ` As plataformas reivindicam ${String(claim).replace(".", ",")} compra(s) para cada compra real${claim > 1.5 ? ": acima do normal de 1,2 a 1,4, alguém conta duas vezes" : claim < 1 ? ": abaixo de 1, o rastreamento perde conversões" : ", dentro do normal"}.` : ""}`,
  };
}
