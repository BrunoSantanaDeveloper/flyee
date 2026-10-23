// One rule of link for the whole project: the plan's rule when there is one, the app's rule
// otherwise. Five fields, always; `utm_content` is the ad's or the send's name, as written.

import { AppError, fold } from "./util.mjs";

export const DEFAULT_RULE = "utm_source=<canal>&utm_medium=<meio>&utm_campaign=<plano>&utm_content=<nome do anúncio ou do envio>&utm_term=<público ou palavra>";
export const REQUIRED = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

/** Channels and media the project uses, with the value each one writes. */
export const CHANNELS = {
  meta: { source: "meta", media: ["cpc", "cpm", "paid_social"], note: "anúncios no Instagram e no Facebook" },
  google: { source: "google", media: ["cpc"], note: "anúncios na Busca do Google" },
  email: { source: "email", media: ["email"], note: "os envios para a base" },
  whatsapp: { source: "whatsapp", media: ["message"], note: "as mensagens para a base" },
  parceiro: { source: "parceiro", media: ["referral"], note: "um parceiro, com o nome dele em utm_term" },
  organico: { source: "instagram", media: ["organic"], note: "um post ou a bio do perfil" },
};

/** Lower case, no accents, no spaces: a value that survives every platform. */
export function utmValue(text) {
  return fold(String(text ?? ""))
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Reads the fields out of a rule string: "utm_source=<canal>&..." → ["utm_source", ...]. */
export function ruleFields(rule) {
  return String(rule ?? DEFAULT_RULE)
    .split("&")
    .map((part) => part.split("=")[0].trim())
    .filter(Boolean);
}

/**
 * Builds the query and, with a URL, the full link. Every required field must come filled.
 * `content` keeps the ad's name as written (the Manager compares names, not slugs), the others
 * are normalized.
 */
export function buildUtm({ source, medium, campaign, content, term, url = null, rule = DEFAULT_RULE }) {
  const values = { utm_source: utmValue(source), utm_medium: utmValue(medium), utm_campaign: utmValue(campaign), utm_content: String(content ?? "").trim(), utm_term: utmValue(term) };
  const fields = ruleFields(rule);
  const missing = fields.filter((field) => !values[field]);
  if (missing.length) throw new AppError("utm_invalid", `Faltam campos do link: ${missing.join(", ")}.`, `A regra do projeto pede ${fields.join(", ")}; preencha cada um.`, { missing, rule });
  const query = fields.map((field) => `${field}=${encodeURIComponent(values[field])}`).join("&");
  let link = null;
  if (url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new AppError("usage", `Endereço inválido: ${url}.`, "Passe a página completa, com https://.");
    }
    for (const field of fields) parsed.searchParams.set(field, values[field]);
    link = parsed.toString();
  }
  return { rule, fields, values, query, url: link };
}

/**
 * Checks a link against the rule: which fields are present, which are missing, whether
 * utm_content equals one of the known ad names (when given), and what is odd (spaces, upper case).
 */
export function checkUtm(url, { rule = DEFAULT_RULE, names = null } = {}) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError("usage", `Endereço inválido: ${url}.`, "Passe o link completo, com https://.");
  }
  const fields = ruleFields(rule);
  const present = {};
  for (const field of fields) {
    const value = parsed.searchParams.get(field);
    if (value !== null && value.trim() !== "") present[field] = value;
  }
  const missing = fields.filter((field) => !(field in present));
  const warnings = [];
  for (const [field, value] of Object.entries(present)) {
    if (field === "utm_content") continue;
    if (value !== utmValue(value)) warnings.push({ code: "value_not_normalized", field, text: `${field}=${value} tem maiúsculas, acentos ou espaços; o padrão é ${utmValue(value)}. Os relatórios separam as duas grafias.` });
  }
  let nameMatch = null;
  if (names && present.utm_content !== undefined) {
    const known = names.map((name) => String(name));
    nameMatch = known.includes(present.utm_content) ? "exact" : known.some((name) => fold(name) === fold(present.utm_content)) ? "case_differs" : "unknown";
    if (nameMatch !== "exact") warnings.push({ code: "content_not_an_ad_name", text: nameMatch === "case_differs" ? "utm_content difere do nome do anúncio só por maiúsculas ou acentos: use o nome exato." : "utm_content não é o nome de nenhum anúncio da entrega: a leitura não vai ligar o clique à peça." });
  }
  return { url, rule, fields, present, missing, valid: missing.length === 0, name_match: nameMatch, warnings };
}
