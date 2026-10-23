// Segments of the clean base: engagement by orders and last use (never by opens alone), a
// simple RFM, the priority of messages and the global cap, and the ladder of offers by group.
// Only counts and rules leave this file; a person's data never does.

import { daysBetween, round2 } from "./util.mjs";
import { GROUPS } from "./inventory.mjs";

const marketable = (contact) => !contact.unsubscribed && (contact.email || contact.phone);

function quantile(values, share) {
  const sorted = [...values].sort((a, b) => b - a);
  if (!sorted.length) return null;
  return sorted[Math.max(0, Math.ceil(sorted.length * share) - 1)];
}

function score(value, thresholds, { higherIsBetter = true } = {}) {
  // thresholds: 4 cut points from best to worst, giving 5 to 1
  if (value === null || value === undefined) return 1;
  for (let i = 0; i < thresholds.length; i++) {
    if (higherIsBetter ? value >= thresholds[i] : value <= thresholds[i]) return 5 - i;
  }
  return 1;
}

function cuts(values, { higherIsBetter = true } = {}) {
  const sorted = values.filter((value) => typeof value === "number").sort((a, b) => (higherIsBetter ? b - a : a - b));
  if (sorted.length < 5) return null;
  return [0.2, 0.4, 0.6, 0.8].map((share) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))]);
}

/**
 * Computes segmentos.json. Returns counts per segment, the RFM summary, the priority and caps,
 * the ladder, and (for the sequence) the ids of each segment's contacts, which stay in memory.
 */
export function segmentBase(clean, { today, thresholds, plan = null }) {
  const people = clean.filter(marketable);
  const windows = thresholds.engagement.windows_days;
  const since = (day) => (day ? daysBetween(day, today) : null);
  const engaged = Object.fromEntries(windows.map((days) => [`engajados-${days}`, people.filter((contact) => { const d = since(contact.last_active); return d !== null && d <= days; })]));
  const lapsed = people.filter((contact) => { const d = since(contact.last_active); return d === null || d > windows[windows.length - 1]; });
  const newCustomers = people.filter((contact) => contact.group === "clientes" && (contact.orders ?? 1) === 1);
  const repeat = people.filter((contact) => (contact.orders ?? 0) >= 2);
  const revenues = people.map((contact) => contact.revenue).filter((value) => typeof value === "number" && value > 0);
  const vipCut = quantile(revenues, thresholds.rfm.vip_share);
  const vip = vipCut === null ? [] : people.filter((contact) => typeof contact.revenue === "number" && contact.revenue >= vipCut);
  const stale = people.filter((contact) => contact.stale);
  const recentBuyers = people.filter((contact) => { const d = since(contact.last_active); return contact.paid === true && d !== null && d <= thresholds.cadence.recent_buyer_quiet_days; });

  // RFM on the people with any numbers to score
  const recencyCuts = cuts(people.map((contact) => since(contact.last_active)).filter((value) => value !== null), { higherIsBetter: false });
  const frequencyCuts = cuts(people.map((contact) => contact.orders).filter((value) => typeof value === "number"));
  const moneyCuts = cuts(revenues);
  const rfm = { scored: 0, champions: 0, loyal: 0, promising: 0, at_risk: 0, hibernating: 0, note: thresholds.rfm.label };
  if (recencyCuts && frequencyCuts && moneyCuts) {
    for (const contact of people) {
      const r = score(since(contact.last_active), recencyCuts, { higherIsBetter: false });
      const f = score(contact.orders ?? 0, frequencyCuts);
      const m = score(contact.revenue ?? 0, moneyCuts);
      rfm.scored++;
      if (r >= 4 && f >= 4 && m >= 4) rfm.champions++;
      else if (f >= 4) rfm.loyal++;
      else if (r >= 4 && f <= 2) rfm.promising++;
      else if (r <= 2 && (f >= 3 || m >= 3)) rfm.at_risk++;
      else if (r <= 2) rfm.hibernating++;
    }
  } else rfm.note = `${rfm.note}. Sem pedidos ou receita por pessoa na base, o RFM não foi calculado; os segmentos de uso e de grupo bastam para a régua.`;

  const byGroup = Object.fromEntries(GROUPS.map((group) => [group, people.filter((contact) => contact.group === group)]));
  const segments = {
    ...Object.fromEntries(Object.entries(engaged).map(([key, list]) => [key, list])),
    parados: lapsed,
    "clientes-novos": newCustomers,
    recorrentes: repeat,
    vip,
    "sem-contato-6-meses": stale,
    "compradores-recentes": recentBuyers,
    ...byGroup,
  };
  const counts = Object.fromEntries(Object.entries(segments).map(([key, list]) => [key, list.length]));

  const ladder = Object.fromEntries(GROUPS.map((group) => [group, { rule: thresholds.offer_ladder[group], offer: offerFor(group, plan) }]));
  const priority = [
    "Transacional (confirmação, cobrança, acesso) sempre passa na frente do marketing e não conta no teto.",
    "Quem pediu para sair não recebe marketing em nenhum canal.",
    `Quem comprou nos últimos ${thresholds.cadence.recent_buyer_quiet_days} dias fica fora das promoções.`,
    "Quem está sem contato há 6 meses ou mais só recebe a repermissão até responder.",
    `Teto global: até 1 e-mail de marketing por ${thresholds.cadence.min_hours_between_marketing} horas e ${thresholds.cadence.comfortable_per_week} por semana (${thresholds.cadence.max_per_week} numa semana de pico, com fim marcado).`,
  ];
  const summary = {
    version: 1,
    generated_at: today,
    people: people.length,
    excluded: { unsubscribed: clean.filter((contact) => contact.unsubscribed).length, without_reach: clean.filter((contact) => !contact.email && !contact.phone).length },
    counts,
    vip_cut_brl: vipCut,
    rfm,
    caps: { min_hours_between_marketing: thresholds.cadence.min_hours_between_marketing, comfortable_per_week: thresholds.cadence.comfortable_per_week, max_per_week: thresholds.cadence.max_per_week, recent_buyer_quiet_days: thresholds.cadence.recent_buyer_quiet_days, source: thresholds.cadence.label },
    priority,
    ladder,
    engagement_note: thresholds.engagement.label,
    say: `${people.length} pessoa(s) podem receber marketing: ${GROUPS.map((group) => `${counts[group]} ${group}`).join(", ")}; ${counts["sem-contato-6-meses"]} sem contato há 6 meses ou mais (repermissão primeiro); ${counts.vip} entre os de maior valor${vipCut ? ` (a partir de ${round2(vipCut).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})` : ""}.`,
  };
  return { summary, members: Object.fromEntries(Object.entries(segments).map(([key, list]) => [key, list.map((contact) => contact.id)])) };
}

/** The offer a group gets, read from the plan's options when they exist. */
export function offerFor(group, plan) {
  const options = plan?.offer?.options ?? [];
  const peak = options[0] ?? null;
  if (!peak) return null;
  if (group === "clientes") return { label: "Acesso antecipado à oferta do pico, sem desconto a mais; um bônus de quem já é da casa", price_brl: null, from_plan: true };
  if (group === "ex-clientes") return { label: `${peak.label}, com um bônus de volta; nunca mais fundo do que o pico`, price_brl: peak.price_brl ?? null, from_plan: true };
  if (group === "testaram") return { label: peak.label, price_brl: peak.price_brl ?? null, from_plan: true };
  return { label: "Convite para testar antes; a oferta do pico só depois do primeiro uso", price_brl: null, from_plan: true };
}
