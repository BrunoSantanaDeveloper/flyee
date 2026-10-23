// The inventory of a contact base: the exports of users and contacts a member brings, read by
// column synonyms in Portuguese and English, cleaned (duplicates, invalid e-mails, phones with
// the country code), grouped by what the person did, and counted. inventario.json carries only
// counts; the clean base stays in the project folder and never leaves the machine (D29).

import { AppError, daysBetween, fold, parseDay } from "./util.mjs";
import { csvLine, parseNumber, parseTable } from "./csv.mjs";

/** What a column may mean, by the names exports use (folded, without accents). */
export const COLUMNS = {
  email: ["email", "e-mail", "email address", "e-mail address", "endereco de email", "mail", "correio"],
  phone: ["telefone", "celular", "whatsapp", "phone", "phone number", "mobile", "fone", "tel"],
  name: ["nome", "name", "first name", "primeiro nome", "nome completo", "full name"],
  created: ["criado em", "cadastro", "data de cadastro", "data do cadastro", "created", "created at", "signup", "signed up", "data de criacao", "inscricao"],
  last_active: ["ultimo acesso", "ultimo uso", "ultima atividade", "ultimo login", "last login", "last active", "last seen", "last activity", "ultima sessao"],
  last_contact: ["ultimo contato", "ultimo envio", "ultimo email", "last contacted", "last email", "last contact", "last sent"],
  status: ["status", "situacao", "plano", "plan", "estado"],
  paid: ["pagante", "paid", "assinante", "subscriber", "cliente", "customer", "is paying", "paga"],
  canceled: ["cancelado em", "cancelamento", "canceled at", "cancelled at", "churned", "churned at", "fim do plano", "ended at"],
  orders: ["pedidos", "orders", "compras", "purchases", "numero de pedidos", "order count"],
  revenue: ["receita", "revenue", "ltv", "total gasto", "total spent", "valor total", "valor"],
  source: ["origem", "source", "utm_source", "como conheceu", "canal", "channel"],
  consent: ["consentimento", "consent", "opt-in", "optin", "aceite", "aceita marketing", "marketing", "marketing consent"],
  unsubscribed: ["descadastrado", "descadastro", "unsubscribed", "opt-out", "optout", "nao quer receber", "unsubscribe"],
  tags: ["tags", "etiquetas", "segmento", "segment", "lista", "list"],
};

/** Columns that name a patient or a third party: the file is refused whole (invariant: never a patient's data). */
export const PATIENT_COLUMNS = ["paciente", "patient", "prontuario", "prontuário", "diagnostico", "diagnóstico", "cid", "anamnese", "queixa", "tratamento", "treatment", "medicamento", "receita medica", "dependente", "dependent", "aluno", "student", "titular", "responsavel", "guardian"];
/** Columns the clean base never keeps: documents and addresses are not needed to write to someone. */
export const DROPPED_COLUMNS = ["cpf", "rg", "cnpj", "endereco", "address", "logradouro", "cep", "zip", "data de nascimento", "nascimento", "birthday", "birth date", "senha", "password", "cartao", "card"];

export const CLEAN_COLUMNS = ["id", "email", "telefone", "nome", "criado_em", "ultimo_uso", "ultimo_contato", "status", "pagante", "cancelado_em", "pedidos", "receita_brl", "origem", "consentimento", "descadastrado", "grupos"];
export const GROUPS = ["clientes", "ex-clientes", "testaram", "nunca-ativaram"];
export const ACTIVITY = ["ativos", "parados", "inativos"];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const YES = /^(sim|s|yes|y|true|1|ativo|active|pagante|paid|assinante|subscriber|aceito|aceita|opt-in|optin)$/i;
const NO = /^(nao|não|n|no|false|0|inativo|inactive|cancelado|canceled|cancelled|churned|gratis|grátis|free|trial)$/i;

export function normalizeEmail(text) {
  const clean = String(text ?? "").trim().toLowerCase();
  return clean && EMAIL.test(clean) ? clean : null;
}

/** "11 99999-0001" → "5511999990001"; "99999-0001" (no area code) → null; "+55 (11) 99999 0001" → ok. */
export function normalizePhone(text) {
  const digits = String(text ?? "").replace(/\D/g, "");
  if (!digits) return { value: null, problem: null };
  if (/^55\d{10,11}$/.test(digits)) return { value: digits, problem: null };
  if (/^\d{10,11}$/.test(digits)) return { value: `55${digits}`, problem: null };
  if (/^0\d{10,11}$/.test(digits)) return { value: `55${digits.slice(1)}`, problem: null };
  if (/^\d{8,9}$/.test(digits)) return { value: null, problem: "sem DDD" };
  return { value: null, problem: "formato desconhecido" };
}

export function parseDate(text) {
  const clean = String(text ?? "").trim();
  if (!clean) return null;
  if (parseDay(clean)) return clean;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(clean);
  if (iso && parseDay(iso[1])) return iso[1];
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(clean);
  if (br) {
    const day = `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
    return parseDay(day) ? day : null;
  }
  const us = /^(\d{1,2})-(\d{1,2})-(\d{4})/.exec(clean);
  if (us) {
    const day = `${us[3]}-${us[2].padStart(2, "0")}-${us[1].padStart(2, "0")}`;
    return parseDay(day) ? day : null;
  }
  return null;
}

function yesNo(text) {
  const clean = String(text ?? "").trim();
  if (!clean) return null;
  if (YES.test(clean)) return true;
  if (NO.test(clean)) return false;
  return null;
}

/** Maps the header of one export to the meanings above; refuses patient or third-party columns. */
export function mapColumns(header) {
  const folded = header.map((name) => fold(name));
  const patient = header.filter((name, index) => PATIENT_COLUMNS.some((bad) => folded[index] === fold(bad) || folded[index].startsWith(`${fold(bad)} `) || folded[index].startsWith(`${fold(bad)}_`)));
  if (patient.length) {
    throw new AppError("patient_data", `O arquivo traz colunas de paciente ou de terceiro (${patient.join(", ")}): o app só lê exports de usuários e contatos da marca.`, "Exporte só a lista de usuários ou contatos, sem dados de pacientes, dependentes ou terceiros, e importe de novo.", { columns: patient });
  }
  const map = {};
  const used = new Set();
  for (const [meaning, names] of Object.entries(COLUMNS)) {
    for (const name of names) {
      const index = folded.indexOf(fold(name));
      if (index !== -1 && !used.has(header[index])) {
        map[meaning] = header[index];
        used.add(header[index]);
        break;
      }
    }
  }
  const dropped = header.filter((name) => !used.has(name));
  const sensitive = dropped.filter((name) => DROPPED_COLUMNS.some((bad) => fold(name).includes(fold(bad))));
  return { map, dropped, sensitive };
}

/** Reads one export into raw contact rows (still with the person's data, for the clean base). */
export function readExport(text, { file = "export" } = {}) {
  const table = parseTable(text);
  if (!table.header.length) throw new AppError("csv_invalid", `${file} está vazio ou não é um CSV.`, "Exporte a lista de usuários ou contatos de novo, em CSV.");
  const { map, dropped, sensitive } = mapColumns(table.header);
  if (!map.email && !map.phone) throw new AppError("csv_invalid", `${file} não tem coluna de e-mail nem de telefone.`, "Sem um dos dois não há como escrever para a pessoa; exporte com a coluna de e-mail.", { columns: table.header });
  const rows = table.records.map((record, index) => {
    const get = (meaning) => (map[meaning] ? String(record[map[meaning]] ?? "").trim() : "");
    const phone = normalizePhone(get("phone"));
    const orders = parseNumber(get("orders"));
    const revenue = parseNumber(get("revenue"));
    const paidFlag = yesNo(get("paid"));
    const status = get("status");
    const statusPaid = status ? (YES.test(status) ? true : NO.test(status) ? false : null) : null;
    return {
      line: index + 2,
      file,
      email_raw: get("email"),
      email: normalizeEmail(get("email")),
      phone: phone.value,
      phone_problem: phone.problem,
      name: get("name") || null,
      created: parseDate(get("created")),
      last_active: parseDate(get("last_active")),
      last_contact: parseDate(get("last_contact")),
      status: status || null,
      paid: paidFlag ?? statusPaid ?? (orders !== null && orders > 0 ? true : null),
      canceled: parseDate(get("canceled")) ?? (get("canceled") ? "sim" : null),
      orders,
      revenue,
      source: get("source") || null,
      consent: yesNo(get("consent")),
      unsubscribed: yesNo(get("unsubscribed")) ?? false,
      tags: get("tags") || null,
    };
  });
  return { rows, map, dropped, sensitive, header: table.header };
}

/** The group a contact belongs to for the legal basis and the sequence (one of GROUPS), and its activity. */
export function classify(contact, { today, thresholds }) {
  const since = (day) => (day ? daysBetween(day, today) : null);
  const activeDays = since(contact.last_active);
  const activity = activeDays === null ? "inativos" : activeDays <= thresholds.groups.active_days ? "ativos" : activeDays <= thresholds.groups.stalled_days ? "parados" : "inativos";
  let group;
  if (contact.paid === true && !contact.canceled) group = "clientes";
  else if (contact.canceled || (contact.paid === false && (contact.orders ?? 0) > 0)) group = "ex-clientes";
  else if (contact.last_active || (contact.orders ?? 0) > 0) group = "testaram";
  else group = "nunca-ativaram";
  const contactDays = since(contact.last_contact);
  const stale = contactDays === null ? true : contactDays >= thresholds.repermission.stale_days;
  return { group, activity, stale, days_since_active: activeDays, days_since_contact: contactDays };
}

/**
 * Builds the clean base and the inventory from one or more exports. Returns { clean (rows with
 * the person's data, for base-limpa.csv), inventory (counts only), problems }.
 */
export function buildInventory(exports, { today, thresholds }) {
  const seenEmail = new Map();
  const seenPhone = new Map();
  const clean = [];
  const problems = [];
  let duplicates = 0;
  let invalidEmails = 0;
  let phonesWithoutArea = 0;
  let noReach = 0;
  for (const data of exports) {
    for (const row of data.rows) {
      if (row.email_raw && !row.email) {
        invalidEmails++;
        problems.push({ file: row.file, line: row.line, problem: "e-mail inválido" });
      }
      if (row.phone_problem) {
        if (row.phone_problem === "sem DDD") phonesWithoutArea++;
        problems.push({ file: row.file, line: row.line, problem: `telefone ${row.phone_problem}` });
      }
      if (!row.email && !row.phone) {
        noReach++;
        continue;
      }
      const existing = (row.email && seenEmail.get(row.email)) ?? (row.phone && seenPhone.get(row.phone)) ?? null;
      if (existing) {
        duplicates++;
        // The duplicate adds what the first row lacked; the most recent dates win.
        for (const field of ["phone", "name", "status", "source", "tags"]) if (!existing[field] && row[field]) existing[field] = row[field];
        for (const field of ["created"]) if (!existing[field] || (row[field] && row[field] < existing[field])) existing[field] = row[field] ?? existing[field];
        for (const field of ["last_active", "last_contact", "canceled"]) if (row[field] && (!existing[field] || row[field] > existing[field])) existing[field] = row[field];
        if (row.paid === true) existing.paid = true;
        if (row.unsubscribed) existing.unsubscribed = true;
        if (row.consent !== null) existing.consent = existing.consent === true || row.consent;
        if ((row.orders ?? 0) > (existing.orders ?? 0)) existing.orders = row.orders;
        if ((row.revenue ?? 0) > (existing.revenue ?? 0)) existing.revenue = row.revenue;
        if (!existing.email && row.email) {
          existing.email = row.email;
          seenEmail.set(row.email, existing);
        }
        if (!existing.phone && row.phone) {
          existing.phone = row.phone;
          seenPhone.set(row.phone, existing);
        }
        continue;
      }
      const contact = { ...row };
      delete contact.email_raw;
      delete contact.phone_problem;
      clean.push(contact);
      if (contact.email) seenEmail.set(contact.email, contact);
      if (contact.phone) seenPhone.set(contact.phone, contact);
    }
  }
  clean.forEach((contact, index) => {
    contact.id = index + 1;
    Object.assign(contact, classify(contact, { today, thresholds }));
  });

  const count = (predicate) => clean.filter(predicate).length;
  const bySource = {};
  for (const contact of clean) {
    const source = contact.source ? fold(contact.source).replace(/\s+/g, "-") : "desconhecida";
    bySource[source] = (bySource[source] ?? 0) + 1;
  }
  const dates = clean.map((contact) => contact.created).filter(Boolean).sort();
  const marketable = (contact) => !contact.unsubscribed && (contact.email || contact.phone);
  const inventory = {
    version: 1,
    generated_at: today,
    files: exports.map((data) => ({ file: data.file ?? null, rows: data.rows.length, columns_used: data.map, columns_dropped: data.dropped, sensitive_columns_dropped: data.sensitive })),
    counts: {
      rows: exports.reduce((sum, data) => sum + data.rows.length, 0),
      total: clean.length,
      duplicates,
      invalid_emails: invalidEmails,
      phones_without_area_code: phonesWithoutArea,
      without_email_or_phone: noReach,
      valid: count(marketable),
      with_email: count((contact) => Boolean(contact.email)),
      with_phone: count((contact) => Boolean(contact.phone)),
      unsubscribed: count((contact) => contact.unsubscribed),
      consent_recorded: count((contact) => contact.consent === true),
      stale_6_months: count((contact) => contact.stale && marketable(contact)),
    },
    groups: Object.fromEntries(GROUPS.map((group) => [group, { total: count((contact) => contact.group === group), marketable: count((contact) => contact.group === group && marketable(contact)), stale: count((contact) => contact.group === group && contact.stale && marketable(contact)) }])),
    activity: Object.fromEntries(ACTIVITY.map((activity) => [activity, count((contact) => contact.activity === activity)])),
    by_source: bySource,
    created_between: dates.length ? { first: dates[0], last: dates[dates.length - 1] } : null,
    thresholds: { active_days: thresholds.groups.active_days, stalled_days: thresholds.groups.stalled_days, stale_days: thresholds.repermission.stale_days, source: thresholds.groups.label },
    note: "Só contagens: nenhum nome, e-mail ou telefone entra aqui. A base limpa fica em contatos/base-limpa.csv, dentro do projeto, e não sai da máquina.",
  };
  return { clean, inventory, problems };
}

export function cleanHeader() {
  return csvLine(CLEAN_COLUMNS);
}

export function cleanLines(clean) {
  return clean.map((contact) => csvLine([contact.id, contact.email ?? "", contact.phone ?? "", contact.name ?? "", contact.created ?? "", contact.last_active ?? "", contact.last_contact ?? "", contact.status ?? "", contact.paid === null ? "" : contact.paid ? "sim" : "nao", contact.canceled ?? "", contact.orders ?? "", contact.revenue ?? "", contact.source ?? "", contact.consent === null ? "" : contact.consent ? "sim" : "nao", contact.unsubscribed ? "sim" : "nao", [contact.group, contact.activity, contact.stale ? "sem-contato-6-meses" : null].filter(Boolean).join(";")]));
}

/** Reads base-limpa.csv back into contacts (for segments and audiences). */
export function readClean(text) {
  const table = parseTable(text ?? "");
  if (!table.header.length) return [];
  const header = table.header.map((name) => fold(name));
  const missing = CLEAN_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length) throw new AppError("clean_invalid", `base-limpa.csv não tem as colunas ${missing.join(", ")}.`, "Rode inventory de novo para refazer a base limpa.");
  return table.records.map((record) => {
    const get = (column) => record[table.header[header.indexOf(column)]] ?? "";
    const groups = get("grupos").split(";").filter(Boolean);
    return {
      id: Number(get("id")),
      email: get("email") || null,
      phone: get("telefone") || null,
      name: get("nome") || null,
      created: get("criado_em") || null,
      last_active: get("ultimo_uso") || null,
      last_contact: get("ultimo_contato") || null,
      status: get("status") || null,
      paid: get("pagante") === "sim" ? true : get("pagante") === "nao" ? false : null,
      canceled: get("cancelado_em") || null,
      orders: parseNumber(get("pedidos")),
      revenue: parseNumber(get("receita_brl")),
      source: get("origem") || null,
      consent: get("consentimento") === "sim" ? true : get("consentimento") === "nao" ? false : null,
      unsubscribed: get("descadastrado") === "sim",
      group: GROUPS.find((group) => groups.includes(group)) ?? "nunca-ativaram",
      activity: ACTIVITY.find((activity) => groups.includes(activity)) ?? "inativos",
      stale: groups.includes("sem-contato-6-meses"),
    };
  });
}
