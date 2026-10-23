// The approved plan of the project (the plan app's plano.json): what the briefing can take from
// it instead of asking the member. Every value that comes from the plan carries `source: plano`,
// so the AI shows where it came from and never invents an offer, a price or a budget.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { BRIEF_FIELDS, fold } from "./campaign.mjs";

const PLANS_DIR = "media-plan";

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** The approved plan, else the newest one; null when the project has no plan. */
export function findPlan(root, slug = null) {
  const dir = join(root, PLANS_DIR);
  if (!existsSync(dir)) return null;
  const plans = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, "plano.json")))
    .map((entry) => ({ slug: entry.name, file: join(dir, entry.name, "plano.json"), data: readJson(join(dir, entry.name, "plano.json")) }))
    .filter((plan) => plan.data && typeof plan.data === "object");
  if (!plans.length) return null;
  if (slug) return plans.find((plan) => plan.slug === slug) ?? null;
  const approved = plans.filter((plan) => plan.data.state === "aprovado").sort((a, b) => String(b.data.approved_at ?? "").localeCompare(String(a.data.approved_at ?? "")));
  return approved[0] ?? plans.sort((a, b) => String(b.data.generated_at ?? "").localeCompare(String(a.data.generated_at ?? "")))[0];
}

const brl = (value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })}`;
const brDay = (day) => (day ? `${day.slice(8, 10)}/${day.slice(5, 7)}` : "");
const URL_IN = /https?:\/\/[^\s);,]+/i;

function firstSentence(text) {
  const clean = String(text ?? "").trim();
  const match = /^(.+?[.!?])(?:\s|$)/.exec(clean);
  return (match ? match[1] : clean).replace(/[.!?]$/, "");
}

/** The phase whose budget the campaign runs on: the one that holds today, else the first paid one. */
export function phaseFor(plan, today) {
  const phases = plan?.budget?.by_phase ?? [];
  return phases.find((phase) => phase.start <= today && today <= phase.end) ?? phases[0] ?? null;
}

/**
 * What the plan answers of the briefing, field by field. Returns { fields, sources, plan } where
 * every key of `fields` is a briefing field and `sources[key]` is "plano".
 */
export function briefFromPlan(plan, { today }) {
  if (!plan?.data) return { fields: {}, sources: {}, plan: null };
  const data = plan.data;
  const premises = data.premises ?? {};
  const fields = {};
  const value = (key) => (typeof premises[key]?.value === "string" && premises[key].value.trim() ? premises[key].value.trim() : null);

  if (data.brand) fields.marca = String(data.brand);
  const product = value("produto_oferta");
  if (product) {
    const parts = product.split(/oferta(?: do pico)?\s*:/i);
    fields.produto = firstSentence(parts[0]);
    const offer = parts[1]?.trim();
    fields.oferta = offer ? offer.replace(/\.$/, "") : product.replace(/\.$/, "");
  }
  const economics = data.economics ?? {};
  if (typeof economics.price_brl === "number") fields.preco = `${brl(economics.price_brl)}${economics.billing === "mensal" ? " por mês" : economics.billing === "anual" ? " por ano" : ""}`;
  const readiness = value("prontidao");
  const url = URL_IN.exec(readiness ?? "")?.[0] ?? (typeof data.page_url === "string" ? data.page_url : null);
  if (url) fields.pagina = url;
  const event = premises.evento?.event ?? (value("evento") ? firstSentence(value("evento")).split(/[:,]/)[0] : null);
  if (event) fields.evento = String(event).trim();
  const phase = phaseFor(data, today);
  // The budget line carries only the amount (the briefing parser reads a number); the phase goes in `datas`.
  if (phase && typeof phase.daily_brl === "number") fields.verba = brl(phase.daily_brl);
  const isLead = /lead|cadastro|registration|inscri/i.test(fields.evento ?? "");
  const allowable = isLead ? (data.funnel?.allowable_cpl_brl ?? null) : (economics.allowable_cac_brl ?? data.funnel?.allowable_cpl_brl ?? null);
  if (typeof allowable === "number") fields.custo_evento = brl(allowable);
  const audience = value("publico");
  if (audience) fields.publico = audience.replace(/\.$/, "");
  const phases = (data.calendar?.phases ?? []).filter((item) => item.id !== "depois");
  if (phases.length) fields.datas = phases.map((item) => `${item.id} de ${brDay(item.start)} a ${brDay(item.end)}`).join("; ");
  if (typeof data.tracking?.utm_rule === "string") fields.parametros_url = data.tracking.utm_rule;
  if (Array.isArray(data.rules?.forbidden_terms) && data.rules.forbidden_terms.length) fields.termos_proibidos = data.rules.forbidden_terms.join(", ");
  if (typeof data.naming?.pattern === "string") fields.padrao_nome = data.naming.pattern;

  const sources = Object.fromEntries(Object.keys(fields).map((key) => [key, "plano"]));
  return { fields, sources, plan: { plan: plan.slug, version: data.version ?? null, state: data.state ?? null, file: plan.file } };
}

/**
 * Fills the empty lines of briefing.md with the plan's values; lines the member already filled
 * stay as they are. Returns { text, filled } with the keys that were written.
 */
export function applyPlanToBriefing(text, fields) {
  const filled = [];
  const lines = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
  const seen = new Set();
  const out = lines.map((raw) => {
    const match = /^(\s*[-*]\s*)([^:]+?)(\s*:\s*)(.*)$/.exec(raw);
    if (!match) return raw;
    const label = fold(match[2].replace(/\([^)]*\)/g, "")).replace(/[*_]/g, "").trim();
    const field = BRIEF_FIELDS.find((candidate) => candidate.labels.includes(label));
    if (!field) return raw;
    seen.add(field.key);
    const current = match[4].trim();
    if (current && !/^(?:\.\.\.|…|\?|\(.*\))$/.test(current)) return raw;
    if (fields[field.key] === undefined) return raw;
    filled.push(field.key);
    return `${match[1]}${match[2].trimEnd()}: ${fields[field.key]}`;
  });
  // A field the template did not have a line for (datas, in briefings created by older versions).
  for (const key of Object.keys(fields)) {
    if (seen.has(key)) continue;
    const field = BRIEF_FIELDS.find((candidate) => candidate.key === key);
    if (!field) continue;
    const label = field.labels[0].replace(/\b\p{L}/u, (char) => char.toUpperCase());
    const index = out.findIndex((line) => /^## Campanha/.test(line));
    const insertAt = index === -1 ? out.length : out.findIndex((line, i) => i > index && /^## /.test(line));
    out.splice(insertAt === -1 ? out.length : insertAt, 0, `- ${label}: ${fields[key]}`);
    filled.push(key);
  }
  return { text: out.join("\n"), filled };
}
