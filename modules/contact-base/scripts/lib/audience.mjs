// The custom audience for Meta: a CSV whose values are already SHA-256 hashes (e-mail
// normalized, phone with the country code and digits only), only for people whose group has a
// legal basis for marketing and who did not unsubscribe; plus the exclusion list of current
// customers. The raw list never leaves the machine; the member uploads the hashes.

import { createHash } from "node:crypto";
import { csvLine } from "./csv.mjs";

export const META_MIN_AUDIENCE = { upload: 100, recommended: 1000, label: "a Meta aceita um público personalizado a partir de 100 pessoas reconhecidas; abaixo de 1.000 o alcance e o semelhante saem fracos" };
export const MATCH_RATE = { low: 0.4, mid: 0.5, high: 0.6, label: "parte de uma lista de e-mails de consumidor que a Meta reconhece, regra de bolso; a taxa real aparece no Gerenciador depois do upload" };

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/** Meta's normalization: e-mail trimmed and lower-cased; phone digits only with the country code. */
export function hashEmail(email) {
  const clean = String(email ?? "").trim().toLowerCase();
  return clean ? sha256(clean) : "";
}

export function hashPhone(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits ? sha256(digits) : "";
}

/**
 * Builds the audience of one segment. `people` are the clean contacts of the segment; `legal`
 * the parsed base-legal.md; `customers` the clean contacts that are current customers (for the
 * exclusion list). Returns { rows, excluded, counts, estimate, warnings } with hashes only.
 */
export function buildAudience(people, { legal, customers = [], today }) {
  const excluded = { unsubscribed: 0, no_legal_basis: 0, no_reach: 0 };
  const rows = [];
  for (const contact of people) {
    if (contact.unsubscribed) {
      excluded.unsubscribed++;
      continue;
    }
    const entry = legal?.[contact.group];
    if (!entry || !entry.marketing_allowed) {
      excluded.no_legal_basis++;
      continue;
    }
    const email = hashEmail(contact.email);
    const phone = hashPhone(contact.phone);
    if (!email && !phone) {
      excluded.no_reach++;
      continue;
    }
    rows.push({ email, phone, country: "br" });
  }
  const exclusion = customers.filter((contact) => contact.email || contact.phone).map((contact) => ({ email: hashEmail(contact.email), phone: hashPhone(contact.phone), country: "br" }));
  const matched = { low: Math.round(rows.length * MATCH_RATE.low), mid: Math.round(rows.length * MATCH_RATE.mid), high: Math.round(rows.length * MATCH_RATE.high) };
  const warnings = [];
  if (rows.length < META_MIN_AUDIENCE.upload) warnings.push({ code: "too_small", text: `${rows.length} pessoa(s) no público: a Meta aceita a partir de ${META_MIN_AUDIENCE.upload} reconhecidas, e com a taxa de reconhecimento de cerca de ${Math.round(MATCH_RATE.mid * 100)}% este público não sobe. Use a base por e-mail e mensagem.` });
  else if (matched.mid < META_MIN_AUDIENCE.recommended) warnings.push({ code: "small", text: `Cerca de ${matched.mid} pessoas reconhecidas (${Math.round(MATCH_RATE.low * 100)} a ${Math.round(MATCH_RATE.high * 100)}% de ${rows.length}): o público sobe, mas o alcance e o semelhante saem fracos abaixo de ${META_MIN_AUDIENCE.recommended}.` });
  return {
    generated_at: today,
    rows,
    exclusion,
    counts: { people: people.length, included: rows.length, exclusion_list: exclusion.length, ...excluded },
    estimate: { matched, rate: MATCH_RATE },
    minimums: META_MIN_AUDIENCE,
    warnings,
    say: `${rows.length} pessoa(s) entram no público (${excluded.unsubscribed} pediram para sair, ${excluded.no_legal_basis} sem base legal de marketing, ${excluded.no_reach} sem e-mail nem telefone); a Meta deve reconhecer cerca de ${matched.low} a ${matched.high}. Lista de exclusão: ${exclusion.length} cliente(s) atuais.`,
  };
}

/** The CSV Meta's upload accepts: one hashed column per identifier, headers as Meta names them. */
export function audienceCsv(rows) {
  return [csvLine(["email", "phone", "country"]), ...rows.map((row) => csvLine([row.email, row.phone, row.country]))].join("\n") + "\n";
}

/** The steps the member follows in the Ads Manager, in plain words. */
export function uploadSteps({ name, file, exclusionFile }) {
  return [
    `No Gerenciador de Anúncios, abra Públicos e crie um público personalizado a partir de uma lista de clientes.`,
    `Suba o arquivo ${file}: os valores já estão em hash, então marque que a lista está com hash e que o país é o Brasil.`,
    `Dê o nome "${name}" e espere a Meta mostrar a taxa de reconhecimento; ela é o número real, e substitui a estimativa do app.`,
    exclusionFile ? `Suba ${exclusionFile} como o público "clientes atuais" e use-o como exclusão em todo conjunto de prospecção.` : "Sem clientes atuais na base, não há lista de exclusão ainda.",
    "A lista sobe de novo toda semana, com os novos clientes na exclusão e os novos leads no público.",
  ];
}
