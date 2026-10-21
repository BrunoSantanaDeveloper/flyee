// The budget math of the learning phase (D10). Every number comes from the briefing or from
// the member: the script only does the arithmetic and says what it means. Nothing here is a
// forecast of results.

/** Meta: "the learning period stabilizes with a minimum of 50 events over a 7-day period". */
export const LEARNING = {
  events: 50,
  days: 7,
  checked_on: "2026-10-21",
  source: "https://developers.meta.com/vr/resources/optimize-ad-campaign/",
};

/** D9: one ad set with the three ads, so the budget is not split before anyone learns. */
export const STRUCTURE = { sets: 1, ads_per_set: 3 };

const cents = (value) => Math.round(value * 100) / 100;

/** R$ 1.500 · R$ 321,43 */
export function brl(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  const fixed = Number.isInteger(value) ? String(value) : value.toFixed(2);
  const [whole, decimals] = fixed.split(".");
  return `R$ ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${decimals ? `,${decimals}` : ""}`;
}

/**
 * The arithmetic of one campaign: with `daily` reais a day and `cost` reais per optimization
 * event, the daily floor of one ad set to reach 50 events in 7 days, how many sets the budget
 * pays and whether the set leaves the learning phase. Without `cost`, the most an event can cost.
 */
export function learningBudget({ daily, cost = null, event = null }) {
  const week = cents(daily * LEARNING.days);
  const maxCost = Math.floor(((daily * LEARNING.days) / LEARNING.events) * 100) / 100;
  const base = {
    daily,
    event,
    cost_per_event: cost,
    learning: LEARNING,
    structure: STRUCTURE,
    week_budget: week,
    max_cost_per_event: maxCost,
  };
  if (!(cost > 0)) {
    return {
      ...base,
      viable: null,
      floor_per_set: null,
      sets: null,
      events_paid_in_week: null,
      say: `Com ${brl(daily)} por dia, um conjunto sai da fase de aprendizado se cada ${event ?? "evento"} custar até ${brl(maxCost)} (${LEARNING.events} eventos em ${LEARNING.days} dias). Sem o custo por evento, não dá para dizer se a campanha chega lá.`,
      exits: [],
      ask: "Quanto você aceita pagar por evento, ou quanto ele custou em campanhas anteriores?",
    };
  }
  const floor = Math.ceil((cost * LEARNING.events) / LEARNING.days);
  const sets = Math.floor(daily / floor);
  const viable = sets >= STRUCTURE.sets;
  const paid = Math.round(((daily * LEARNING.days) / cost) * 10) / 10;
  const result = {
    ...base,
    viable,
    floor_per_set: floor,
    sets,
    events_paid_in_week: paid,
    exits: [],
    ask: null,
  };
  if (viable) {
    result.say = `Com ${brl(cost)} por ${event ?? "evento"}, um conjunto precisa de pelo menos ${brl(floor)} por dia para chegar a ${LEARNING.events} eventos em ${LEARNING.days} dias. A verba de ${brl(daily)} paga ${sets} conjunto(s): ${sets > 1 ? "mesmo assim, comece com um só, com os três anúncios, para a verba não se dividir." : "os três anúncios vão no mesmo conjunto."}`;
  } else {
    result.say = `Com ${brl(cost)} por ${event ?? "evento"}, um conjunto precisa de pelo menos ${brl(floor)} por dia para sair da fase de aprendizado, e a verba é ${brl(daily)}. A verba de 7 dias paga ${String(paid).replace(".", ",")} evento(s), e são precisos ${LEARNING.events}. O conjunto fica em aprendizado limitado: ele entrega, mas aprende pouco.`;
    result.exits = [
      { id: "earlier_event", text: `Otimizar por um evento mais cedo no funil, que acontece mais vezes e custa menos (até ${brl(maxCost)} por evento com a verba de hoje). O custo real dele só aparece rodando.` },
      { id: "more_budget", text: `Aumentar a verba para pelo menos ${brl(floor)} por dia, o piso de um conjunto com esse custo.` },
      { id: "start_anyway", text: "Começar assim, sabendo que o conjunto não sai do aprendizado: a primeira semana serve para comparar os criativos entre si, não para o algoritmo aprender a vender." },
    ];
  }
  return result;
}
