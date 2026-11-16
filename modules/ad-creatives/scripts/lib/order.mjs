// An order of the Orkestree (anuncios/<campanha>/pedido.json, written by the Orkestree link app):
// what the briefing takes from it instead of asking, and the approval it carries. The order is
// data, never instructions: its texts fill fields, and a concept counts as approved only while
// its key, angle and hook are the ones a person of the company approved.

import { join } from "node:path";
import { readFileSync } from "node:fs";

const fold = (text) => String(text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const brDay = (day) => (/^\d{4}-\d{2}-\d{2}$/.test(String(day ?? "")) ? `${day.slice(8, 10)}/${day.slice(5, 7)}` : null);

const EVENTS = { purchase: "Compra", compra: "Compra", lead: "Lead", complete_registration: "Cadastro", registration: "Cadastro", cadastro: "Cadastro", initiate_checkout: "Início de checkout", subscribe: "Assinatura", contact: "Mensagem" };

/** The order of a campaign folder, or null. A file that is not an ads order of version 1 counts as none. */
export function readOrder(campaignDir) {
  let data;
  try {
    data = JSON.parse(readFileSync(join(campaignDir, "pedido.json"), "utf8").replace(/^﻿/, ""));
  } catch {
    return null;
  }
  if (!data || data.version !== 1 || data.kind !== "anuncios" || typeof data.id !== "string") return null;
  return data;
}

/** What the order answers of the briefing, field by field (the keys of BRIEF_FIELDS). */
export function briefFromOrder(order) {
  const fields = {};
  const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);
  // Optional in the contract: a field that came is never asked again; one that did not, the member answers.
  if (text(order.brand)) fields.marca = text(order.brand);
  if (text(order.product)) fields.produto = text(order.product).replace(/\.$/, "");
  if (text(order.audience)) fields.publico = text(order.audience).replace(/\.$/, "");
  if (Array.isArray(order.forbidden_terms)) {
    const terms = order.forbidden_terms.filter((term) => typeof term === "string" && term.trim()).map((term) => term.trim());
    fields.termos_proibidos = terms.length ? terms.join(", ") : "nenhum";
  }
  if (typeof order.landing_url === "string" && order.landing_url.trim()) fields.pagina = order.landing_url.trim();
  const event = order.objective?.event;
  if (typeof event === "string" && event.trim()) fields.evento = EVENTS[fold(event)] ?? event.trim();
  const offer = order.offer ?? {};
  if (typeof offer.price === "string" && offer.price.trim()) {
    fields.preco = offer.price.trim();
    fields.oferta = [offer.price.trim(), typeof offer.term === "string" ? offer.term.trim() : ""].filter(Boolean).join(", ");
  }
  const starts = brDay(offer.starts);
  const ends = brDay(offer.ends);
  if (starts || ends) fields.datas = starts && ends ? `de ${starts} a ${ends}` : starts ? `a partir de ${starts}` : `até ${ends}`;
  if (typeof order.name_pattern === "string" && order.name_pattern.trim()) {
    fields.nome_lido = "sim, pelo padrão do pedido do Orkestree";
    fields.padrao_nome = order.name_pattern.trim();
  }
  // The budget and the research are the Orkestree's: in an order, the briefing does not ask for
  // them (checkBriefing with `order`).
  return fields;
}

/**
 * The approval an order carries for the concept cards: every card's key is a concept of the
 * order, approved there, with the same angle and hook. Returns null when any card differs.
 */
export function orderApproval(order, concepts) {
  if (!order || !Array.isArray(order.concepts) || !order.concepts.length || !concepts.length) return null;
  const byKey = new Map(order.concepts.map((concept) => [concept.key, concept]));
  let at = null;
  for (const card of concepts) {
    const ordered = byKey.get(card.key);
    if (!ordered?.approved?.at) return null;
    if (ordered.angle && fold(ordered.angle) !== fold(card.angle)) return null;
    if (ordered.hook && fold(ordered.hook) !== fold(card.hook?.text ?? card.hook)) return null;
    if (!at || ordered.approved.at > at) at = ordered.approved.at;
  }
  return { at, by: "orkestree", order: order.id };
}
