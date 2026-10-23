// The premises of a plan: the fixed table, the sources a value may have, the template the
// member's AI fills in with the member, and the checks. The script never fills a value by itself:
// a suggestion is the AI's, labelled `sugerido-pendente` until the member says yes.

import { AppError, parseDay } from "./util.mjs";

/** Where a value came from. A suggestion stays pending until the member confirms it. */
export const SOURCES = ["informado", "encontrado", "sugerido-pendente", "confirmado"];

/** The sources that count as settled: the member said it, or the project already had it. */
export const SETTLED = new Set(["informado", "encontrado", "confirmado"]);

export const BILLING = ["mensal", "anual", "unico"];

/**
 * The table. `blocking` premises hold the plan's approval; the others become labelled
 * assumptions. `fields` are the typed values the arithmetic reads; `value` is the sentence
 * the member reads.
 */
export const PREMISES = [
  {
    key: "produto_oferta",
    label: "Produto e oferta",
    blocking: true,
    fields: {},
    ask: "O que o plano vende, e com que oferta? Se a oferta ainda não existe, digo o que proponho e você escolhe.",
  },
  {
    key: "publico",
    label: "Para quem, e quantos",
    blocking: true,
    fields: { known_people: "boolean", reach: "number" },
    ask: "É para quem nunca ouviu falar da marca, ou para quem já conhece (clientes antigos, cadastrados, lista)? Quantas pessoas dá para alcançar?",
  },
  {
    key: "meta_data",
    label: "Meta e data",
    blocking: true,
    fields: { goal_count: "number", goal_unit: "string" },
    ask: "Qual é a meta, em que unidade (assinaturas, leads, vendas), e até quando?",
  },
  {
    key: "verba",
    label: "Verba",
    blocking: true,
    fields: { total_brl: "number", daily_brl: "number" },
    ask: "Quanto dá para investir, no total ou por dia?",
  },
  {
    key: "preco_planos",
    label: "Preço e planos",
    blocking: false,
    fields: { price_brl: "number", billing: "billing", annual_brl: "number", margin_pct: "number", retention_months: "number" },
    ask: "Qual é o preço, a cobrança (mensal, anual, única), a margem e quanto tempo um cliente costuma ficar?",
  },
  {
    key: "base",
    label: "Base de contatos",
    blocking: false,
    fields: { contacts: "number", months_since_contact: "number" },
    ask: "Existe uma base de contatos (clientes antigos, cadastrados)? Quantos, e há quanto tempo sem contato?",
  },
  {
    key: "prontidao",
    label: "Prontidão do produto e da página",
    blocking: false,
    fields: { ready_by: "date" },
    ask: "O produto e a página de destino estão prontos para receber quem chega? Se não, para quando?",
  },
  {
    key: "evento",
    label: "Evento de otimização",
    blocking: true,
    fields: { event: "string", cost_brl: "number" },
    ask: "Por qual acontecimento a campanha otimiza (lead, cadastro, teste, compra), e quanto você aceita pagar por ele?",
  },
  {
    key: "capacidade",
    label: "Capacidade do time",
    blocking: false,
    fields: { per_week: "number" },
    ask: "Quantos clientes novos o time consegue atender ou implantar por semana?",
  },
  {
    key: "contas_rastreamento",
    label: "Contas e rastreamento",
    blocking: false,
    fields: { pixel: "boolean", capi: "boolean", ga4: "boolean", google_ads: "boolean" },
    ask: "Quando alguém compra ou se cadastra, dá para ver de onde veio? E a Meta e o Google veem esse acontecimento?",
  },
];

export const RATES = ["visit_to_lead_pct", "lead_to_customer_pct", "known_to_customer_pct"];

const TOP_KEYS = new Set(["version", "plan", "brand", "target_date", "today", "premises", "rates", "current_offer", "channels", "notes"]);

/** The file `new` writes, for the member's AI to fill in with the member. */
export function premisesTemplate(plan, brand = "") {
  const premises = {};
  for (const premise of PREMISES) {
    const entry = { value: "", source: null, if_different: "" };
    for (const [field, type] of Object.entries(premise.fields)) entry[field] = type === "string" || type === "billing" ? "" : null;
    premises[premise.key] = entry;
  }
  return {
    version: 1,
    plan,
    brand,
    target_date: null,
    today: null,
    premises,
    rates: Object.fromEntries(RATES.map((rate) => [rate, { value: null, source: null }])),
    current_offer: { price_brl: null, until: null, note: "" },
    channels: { meta: null, google_search: null, owned: null, partners: null },
    notes: "",
  };
}

function invalid(path, why) {
  return new AppError("premises_invalid", `premissas.json, ${path}: ${why}`, "Corrija o campo apontado e rode premises de novo.", { path });
}

function checkField(path, value, type) {
  if (value === null || value === undefined || value === "") return;
  if (type === "number" && (typeof value !== "number" || !Number.isFinite(value))) throw invalid(path, "precisa ser um número, ou null.");
  if (type === "boolean" && typeof value !== "boolean") throw invalid(path, "precisa ser true, false ou null.");
  if (type === "string" && typeof value !== "string") throw invalid(path, "precisa ser um texto.");
  if (type === "date" && !parseDay(value)) throw invalid(path, "precisa ser uma data no formato AAAA-MM-DD, ou null.");
  if (type === "billing" && !BILLING.includes(value)) throw invalid(path, `aceita ${BILLING.join(", ")}.`);
}

/**
 * Checks the shape and the sources. Returns what is settled, what is pending and which
 * blocking premises still hold the approval. Throws `premises_invalid` with the path.
 */
export function validatePremises(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw invalid("raiz", "precisa ser um objeto.");
  for (const key of Object.keys(data)) if (!TOP_KEYS.has(key)) throw invalid(key, "campo desconhecido.");
  if (data.version !== 1) throw invalid("version", "precisa ser 1.");
  if (data.target_date !== null && data.target_date !== undefined && !parseDay(data.target_date)) throw invalid("target_date", "precisa ser uma data no formato AAAA-MM-DD, ou null.");
  if (data.today !== null && data.today !== undefined && !parseDay(data.today)) throw invalid("today", "precisa ser uma data no formato AAAA-MM-DD, ou null.");
  if (!data.premises || typeof data.premises !== "object") throw invalid("premises", "precisa ser um objeto com as dez premissas.");
  const known = new Set(PREMISES.map((premise) => premise.key));
  for (const key of Object.keys(data.premises)) if (!known.has(key)) throw invalid(`premises.${key}`, "premissa desconhecida.");

  const settled = [];
  const pending = [];
  const blockingPending = [];
  for (const premise of PREMISES) {
    const entry = data.premises[premise.key];
    const path = `premises.${premise.key}`;
    if (!entry || typeof entry !== "object") throw invalid(path, "falta a premissa.");
    const allowed = new Set(["value", "source", "if_different", "where", ...Object.keys(premise.fields)]);
    for (const key of Object.keys(entry)) if (!allowed.has(key)) throw invalid(`${path}.${key}`, "campo desconhecido.");
    const value = typeof entry.value === "string" ? entry.value.trim() : "";
    if (entry.value !== undefined && entry.value !== null && typeof entry.value !== "string") throw invalid(`${path}.value`, "precisa ser um texto.");
    if (value) {
      if (!SOURCES.includes(entry.source)) throw invalid(`${path}.source`, `um valor preenchido precisa de origem: ${SOURCES.join(", ")}.`);
      if (entry.source === "sugerido-pendente" && !(typeof entry.if_different === "string" && entry.if_different.trim())) {
        throw invalid(`${path}.if_different`, "uma sugestão diz o que muda no plano se a resposta for outra.");
      }
      if (entry.source === "encontrado" && !(typeof entry.where === "string" && entry.where.trim())) throw invalid(`${path}.where`, "um valor encontrado no projeto diz onde (o arquivo).");
    } else if (entry.source) {
      throw invalid(`${path}.source`, "não há valor para ter origem.");
    }
    for (const [field, type] of Object.entries(premise.fields)) checkField(`${path}.${field}`, entry[field], type);
    if (value && SETTLED.has(entry.source)) settled.push(premise.key);
    else {
      pending.push(premise.key);
      if (premise.blocking) blockingPending.push(premise.key);
    }
  }

  if (data.rates !== undefined) {
    if (!data.rates || typeof data.rates !== "object") throw invalid("rates", "precisa ser um objeto.");
    for (const [rate, entry] of Object.entries(data.rates)) {
      if (!RATES.includes(rate)) throw invalid(`rates.${rate}`, `taxa desconhecida; as taxas são ${RATES.join(", ")}.`);
      if (!entry || typeof entry !== "object") throw invalid(`rates.${rate}`, "precisa ser { value, source }.");
      checkField(`rates.${rate}.value`, entry.value, "number");
      if (entry.value !== null && entry.value !== undefined && !(typeof entry.source === "string" && entry.source.trim())) throw invalid(`rates.${rate}.source`, "uma taxa preenchida diz de onde veio.");
      if (typeof entry.value === "number" && (entry.value < 0 || entry.value > 100)) throw invalid(`rates.${rate}.value`, "é uma porcentagem de 0 a 100.");
    }
  }
  if (data.current_offer !== undefined) {
    const offer = data.current_offer;
    if (!offer || typeof offer !== "object") throw invalid("current_offer", "precisa ser { price_brl, until, note }.");
    checkField("current_offer.price_brl", offer.price_brl, "number");
    checkField("current_offer.until", offer.until, "date");
  }
  return { settled, pending, blocking_pending: blockingPending };
}

/**
 * The questions for the member, in the order that decides the plan's shape, at most `max`,
 * each with the AI's suggestion when there is one. Settled premises never become questions.
 */
export function questionsFor(data, max = 4) {
  const questions = [];
  const ordered = [...PREMISES.filter((premise) => premise.blocking), ...PREMISES.filter((premise) => !premise.blocking)];
  for (const premise of ordered) {
    const entry = data.premises?.[premise.key] ?? {};
    const value = typeof entry.value === "string" ? entry.value.trim() : "";
    if (value && SETTLED.has(entry.source)) continue;
    questions.push({
      key: premise.key,
      label: premise.label,
      blocking: premise.blocking,
      question: premise.ask,
      suggestion: value && entry.source === "sugerido-pendente" ? value : null,
      if_different: typeof entry.if_different === "string" && entry.if_different.trim() ? entry.if_different.trim() : null,
    });
  }
  return { questions: questions.slice(0, max), more_pending: Math.max(0, questions.length - max) };
}

/** A premise's typed field, or null. */
export function field(data, key, name) {
  const value = data?.premises?.[key]?.[name];
  return value === undefined || value === "" ? null : value;
}

/** A rate the member gave, as { value, source }, or null. */
export function rate(data, name) {
  const entry = data?.rates?.[name];
  return entry && typeof entry.value === "number" ? { value: entry.value, source: entry.source } : null;
}
