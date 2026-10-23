// The arithmetic of a plan: what a customer may cost, the funnel worked backwards from the
// goal, the scenarios, the learning floor of a Meta ad set and the frequency a small audience
// would see. Every number is computed from the member's figures or from a labelled rule of
// thumb (references/referencias.json); nothing here is a forecast of results.

import { brl, pct, round2 } from "./util.mjs";
import { field, rate } from "./premises.mjs";

/** A value and where it came from, so the plan can label it. */
function labelled(value, source, label) {
  return { value, source, label };
}

/** The member's own rate, or the rule of thumb at the middle of its range, labelled as such. */
function rateOrRule(data, name, refs, assumptions) {
  const own = rate(data, name);
  if (own) return labelled(own.value, own.source, "número do integrante");
  const rule = refs.rules_of_thumb[name];
  assumptions.push({ key: name, value: rule.mid, label: rule.label, source: rule.source, range: [rule.low, rule.high], format: "pct" });
  return labelled(rule.mid, "regra de bolso", rule.label);
}

const LEAD_UNITS = /\b(lead|cadastro|inscri|contato|teste)/i;

/**
 * Computes cenarios.json. `days` is the length of the paid window (from the calendar) and
 * `peak` says whether the window ends in a peak week, where CPMs run higher.
 */
export function computeEconomics(data, refs, { days = null, peak = false } = {}) {
  const rules = refs.rules_of_thumb;
  const assumptions = [];
  const warnings = [];
  const p = data.premises;

  // --- the price and what a customer may cost
  const billing = field(data, "preco_planos", "billing") || "mensal";
  const price = field(data, "preco_planos", "price_brl");
  const annual = field(data, "preco_planos", "annual_brl");
  let arpaMonthly = null;
  let firstYear = null;
  if (price !== null) {
    if (billing === "mensal") {
      arpaMonthly = price;
      firstYear = price * 12;
    } else if (billing === "anual") {
      arpaMonthly = (annual ?? price) / 12;
      firstYear = annual ?? price;
    } else {
      arpaMonthly = price;
      firstYear = price;
    }
  }
  let marginPct = field(data, "preco_planos", "margin_pct");
  let marginSource = "informado";
  if (marginPct === null && price !== null) {
    marginPct = rules.margin_pct.mid;
    marginSource = "regra de bolso";
    assumptions.push({ key: "margin_pct", value: marginPct, label: rules.margin_pct.label, source: rules.margin_pct.source, range: [rules.margin_pct.low, rules.margin_pct.high], format: "pct" });
  }
  const retention = field(data, "preco_planos", "retention_months");
  const payback = rules.payback_months.value;
  let economics = null;
  if (price !== null) {
    const margin = marginPct / 100;
    const breakeven = retention ? round2(arpaMonthly * margin * retention) : null;
    const paybackCac = round2(arpaMonthly * margin * Math.min(payback, retention ?? payback));
    const thirdCap = round2(firstYear * rules.first_year_share.value);
    // With the member's own margin and retention, the payback bound is the answer; when one of
    // them is a rule of thumb, the cap of a third of the first year's revenue also holds.
    const bounds = [{ id: "payback", value: paybackCac, label: `${Math.min(payback, retention ?? payback)} meses de payback sobre a margem` }];
    if (!retention || marginSource !== "informado") bounds.push({ id: "terco", value: thirdCap, label: rules.first_year_share.label });
    const binding = bounds.reduce((a, b) => (b.value < a.value ? b : a));
    if (!retention) assumptions.push({ key: "payback_months", value: payback, label: rules.payback_months.label, source: rules.payback_months.source, format: "months" });
    economics = {
      billing,
      price_brl: price,
      arpa_monthly_brl: round2(arpaMonthly),
      first_year_revenue_brl: round2(firstYear),
      margin_pct: marginPct,
      margin_source: marginSource,
      retention_months: retention,
      breakeven_cac_brl: breakeven,
      allowable_cac_brl: binding.value,
      allowable_cac_bound: binding.id,
      allowable_cac_label: binding.label,
      bounds,
      say: `Um cliente pode custar até ${brl(binding.value)} (${binding.label}${marginSource === "regra de bolso" ? `, com margem de ${pct(marginPct)} por regra de bolso` : ""}).${breakeven ? ` O empate, com ${retention} meses de permanência, é ${brl(breakeven)}.` : " Sem o tempo de permanência, o empate fica em aberto."}`,
    };
  } else {
    warnings.push({ code: "no_price", text: "Sem o preço, o plano não calcula quanto um cliente pode custar: a verba e a meta ficam sem referência." });
  }

  // --- the goal, worked backwards
  const goal = field(data, "meta_data", "goal_count");
  const goalUnit = field(data, "meta_data", "goal_unit") || "clientes";
  const goalIsLeads = LEAD_UNITS.test(goalUnit);
  const knownPeople = field(data, "publico", "known_people");
  const reach = field(data, "publico", "reach") ?? field(data, "base", "contacts") ?? 0;
  const knownRate = rateOrRule(data, "known_to_customer_pct", refs, assumptions);
  const leadToCustomer = rateOrRule(data, "lead_to_customer_pct", refs, assumptions);
  const visitToLead = rateOrRule(data, "visit_to_lead_pct", refs, assumptions);
  let funnel = null;
  if (goal !== null) {
    const fromKnown = knownPeople === false || reach <= 0 ? 0 : Math.min(goal, Math.floor((reach * knownRate.value) / 100));
    const coldGoal = goal - fromKnown;
    const leadsNeeded = goalIsLeads ? coldGoal : Math.ceil(coldGoal / (leadToCustomer.value / 100));
    const visitsNeeded = Math.ceil(leadsNeeded / (visitToLead.value / 100));
    const allowableCpl = economics ? round2(economics.allowable_cac_brl * (goalIsLeads ? 1 : leadToCustomer.value / 100)) : null;
    funnel = {
      goal,
      goal_unit: goalUnit,
      goal_is_leads: goalIsLeads,
      reach,
      known_rate: knownRate,
      from_known: fromKnown,
      cold_goal: coldGoal,
      lead_to_customer: leadToCustomer,
      visit_to_lead: visitToLead,
      leads_needed: leadsNeeded,
      visits_needed: visitsNeeded,
      allowable_cpl_brl: allowableCpl,
      say: `Da meta de ${goal} ${goalUnit}, ${fromKnown} podem vir de quem já conhece a marca (${reach} pessoas a ${pct(knownRate.value)}, ${knownRate.source}) e ${coldGoal} de quem nunca ouviu falar: ${leadsNeeded.toLocaleString("pt-BR")} ${goalIsLeads ? goalUnit : "leads"} e ${visitsNeeded.toLocaleString("pt-BR")} visitas à página${allowableCpl ? `, com até ${brl(allowableCpl)} por lead` : ""}.`,
    };
  }

  // --- scenarios: what the goal costs, and what the budget buys
  const total = field(data, "verba", "total_brl");
  const daily = field(data, "verba", "daily_brl");
  const windowDays = days ?? 30;
  if (days === null) assumptions.push({ key: "days", value: windowDays, label: "dias de campanha, até o calendário dizer", source: "padrão do app", format: "days" });
  const totalBudget = total ?? (daily !== null ? round2(daily * windowDays) : null);
  const dailyBudget = daily ?? (total !== null ? round2(total / windowDays) : null);
  const eventCost = field(data, "evento", "cost_brl");
  const cpl = rules.cost_per_lead_brl;
  const scenarios = [];
  const perWeek = field(data, "capacidade", "per_week");
  const capacityCap = perWeek !== null ? Math.floor((perWeek * windowDays) / 7) : null;
  if (funnel) {
    funnel.capacity_cap = capacityCap;
    const mix = [
      { id: "conservador", cpl: eventCost ?? cpl.high, ltc: Math.min(leadToCustomer.value, rules.lead_to_customer_pct.low), label: "custo por lead no alto da faixa e conversão no baixo" },
      { id: "esperado", cpl: eventCost ?? cpl.mid, ltc: leadToCustomer.value, label: "o meio das faixas, ou os seus números" },
      { id: "otimista", cpl: eventCost ?? cpl.low, ltc: Math.max(leadToCustomer.value, rules.lead_to_customer_pct.high), label: "custo por lead no baixo da faixa e conversão no alto" },
    ];
    for (const item of mix) {
      const ltc = funnel.goal_is_leads ? 100 : item.ltc;
      const leadsForGoal = funnel.goal_is_leads ? funnel.cold_goal : Math.ceil(funnel.cold_goal / (ltc / 100));
      const budgetNeeded = round2(leadsForGoal * item.cpl);
      const leadsBought = totalBudget !== null ? Math.floor(totalBudget / item.cpl) : null;
      const customersBought = leadsBought === null ? null : funnel.from_known + Math.floor((leadsBought * ltc) / 100);
      scenarios.push({
        id: item.id,
        label: item.label,
        cost_per_lead_brl: item.cpl,
        lead_to_customer_pct: ltc,
        leads_for_goal: leadsForGoal,
        budget_needed_brl: budgetNeeded,
        leads_bought: leadsBought,
        customers_bought: customersBought,
        meets_goal: customersBought === null ? null : customersBought >= funnel.goal,
        over_capacity: customersBought !== null && capacityCap !== null && customersBought > capacityCap,
      });
    }
    if (eventCost === null) assumptions.push({ key: "cost_per_lead_brl", value: cpl.mid, range: [cpl.low, cpl.high], label: cpl.label, source: cpl.source, format: "brl" });
  }

  // --- the learning floor of one ad set (D10, the same source and date as the creatives app)
  const learning = rules.learning;
  let floor = null;
  if (dailyBudget !== null) {
    // The expected cost per event: the member's, or the middle of the rule of thumb; never the ceiling.
    const cost = eventCost ?? (funnel ? cpl.mid : null);
    const maxCost = Math.floor(((dailyBudget * learning.days) / learning.events) * 100) / 100;
    floor = { daily_brl: dailyBudget, max_cost_per_event_brl: maxCost, events: learning.events, days: learning.days, source: learning.source };
    if (cost) {
      const floorDaily = Math.ceil((cost * learning.events) / learning.days);
      floor.cost_per_event_brl = cost;
      floor.cost_source = eventCost !== null ? "informado" : "custo por lead esperado, regra de bolso";
      floor.floor_daily_brl = floorDaily;
      floor.viable = dailyBudget >= floorDaily;
      floor.say = floor.viable
        ? `Com ${brl(cost)} por evento, um conjunto precisa de ${brl(floorDaily)} por dia para sair da fase de aprendizado; a verba de ${brl(dailyBudget)} por dia chega lá.`
        : `Com ${brl(cost)} por evento, um conjunto precisa de ${brl(floorDaily)} por dia para sair da fase de aprendizado, e a verba é ${brl(dailyBudget)} por dia. Saídas: um evento mais cedo no funil, que custe até ${brl(maxCost)}; subir a verba até o piso; ou começar assim, sabendo que a primeira semana só compara criativos.`;
      if (!floor.viable) warnings.push({ code: "learning_floor", text: floor.say });
    } else {
      floor.say = `Com ${brl(dailyBudget)} por dia, um conjunto sai da fase de aprendizado se cada evento custar até ${brl(maxCost)}.`;
    }
  }

  // --- the frequency a small known audience would see if the whole weekly budget hit it
  let frequency = null;
  if (dailyBudget !== null && reach > 0 && knownPeople !== false) {
    const match = rules.list_match_rate.mid;
    const cpm = rules.cpm_brl.mid * (peak ? rules.peak_cpm_multiplier.low : 1);
    const matched = Math.round(reach * match);
    const weeklyImpressions = Math.round(((dailyBudget * 7) / cpm) * 1000);
    const perPerson = matched > 0 ? round2(weeklyImpressions / matched) : null;
    frequency = {
      reach,
      match_rate: match,
      matched,
      cpm_brl: cpm,
      weekly_impressions: weeklyImpressions,
      per_person_per_week: perPerson,
      cap: rules.weekly_frequency_cap.value,
      too_high: perPerson !== null && perPerson > rules.weekly_frequency_cap.value,
      say: perPerson === null ? "" : `Se toda a verba semanal fosse para quem já conhece a marca (${matched} pessoas reconhecidas de ${reach}), cada uma veria o anúncio ${String(perPerson).replace(".", ",")} vezes por semana${perPerson > rules.weekly_frequency_cap.value ? `, acima das ${rules.weekly_frequency_cap.value} que um público pequeno aguenta: a maior parte da verba vai para gente nova, e a base é alcançada por e-mail e mensagem` : ""}.`,
    };
    assumptions.push({ key: "list_match_rate", value: match * 100, label: rules.list_match_rate.label, source: rules.list_match_rate.source, format: "pct" });
    assumptions.push({ key: "cpm_brl", value: cpm, label: rules.cpm_brl.label + (peak ? ", com o aumento da semana de pico" : ""), source: rules.cpm_brl.source, format: "brl" });
  }

  return {
    version: 1,
    economics,
    funnel,
    budget: { total_brl: totalBudget, daily_brl: dailyBudget, days: windowDays },
    scenarios,
    learning_floor: floor,
    frequency,
    assumptions,
    warnings,
    refs_checked_on: refs.checked_on,
  };
}
