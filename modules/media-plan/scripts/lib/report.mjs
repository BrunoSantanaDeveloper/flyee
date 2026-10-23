// The written plan: plano.json (the contract other apps read) and plano.md (what the member
// reads), assembled from the premises, the arithmetic, the offer and the calendar. The script
// composes every number; the member's AI writes the narrative in narrativa.json, which is
// checked here before it enters.

import { brDay, brl, pct } from "./util.mjs";
import { PREMISES, SETTLED, questionsFor } from "./premises.mjs";

export const IN_SHORT_MAX_WORDS = 150;
export const MOVES_MAX = 6;
export const CERTAINTY = ["confirmado", "provavel", "primeira-leitura"];

/** What a plan never says: a promise of results. */
const PROMISE = /\b(garant(?:e|ido|ida|imos|ia)\b.*\b(?:resultado|venda|retorno|lucro)|resultado garantido|retorno garantido|vai vender|vão vender|lucro certo|dobr(?:ar|a) (?:as |suas )?vendas|sem risco)\b/i;
/** The copy rules of the store, which the member's documents follow too. */
const DASH = /[–—]/;
const EXCLAMATION = /!/;

const UTM_RULE = "utm_source=<canal>&utm_medium=<meio>&utm_campaign=<plano>&utm_content=<nome do anúncio ou do envio>&utm_term=<público ou palavra>";

/** "15%", "R$ 8 a R$ 45 (meio R$ 20)", "12 meses". */
function formatAssumption(assumption) {
  const one = (value) => (assumption.format === "pct" ? pct(value) : assumption.format === "brl" ? brl(value) : assumption.format === "months" ? `${value} meses` : assumption.format === "days" ? `${value} dias` : String(value));
  if (assumption.range) return `${one(assumption.range[0])} a ${one(assumption.range[1])} (meio ${one(assumption.value)})`;
  return one(assumption.value);
}

function words(text) {
  return String(text ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function checkText(path, text, problems) {
  if (typeof text !== "string" || !text.trim()) {
    problems.push(`${path}: falta o texto.`);
    return;
  }
  if (PROMISE.test(text)) problems.push(`${path}: promete resultado ("${text.match(PROMISE)[0]}"); o plano ordena apostas, nunca promete.`);
  if (DASH.test(text)) problems.push(`${path}: traz um travessão; use vírgula, dois-pontos ou ponto.`);
  if (EXCLAMATION.test(text)) problems.push(`${path}: traz um ponto de exclamação.`);
}

/**
 * The narrative the AI writes, checked: findings with a certainty word, the story, the first
 * move, what we are not doing and what we could not check. Returns the problems, if any.
 */
export function checkNarrative(narrative) {
  const problems = [];
  if (!narrative || typeof narrative !== "object") return ["narrativa.json precisa ser um objeto."];
  const allowed = new Set(["findings", "story", "first_move", "not_doing", "could_not_check", "decisions"]);
  for (const key of Object.keys(narrative)) if (!allowed.has(key)) problems.push(`narrativa.json, ${key}: campo desconhecido.`);
  if (!Array.isArray(narrative.findings) || narrative.findings.length < 1 || narrative.findings.length > 3) problems.push("narrativa.json, findings: de 1 a 3 achados.");
  else {
    narrative.findings.forEach((finding, index) => {
      if (!finding || typeof finding !== "object") return problems.push(`findings[${index}]: precisa ser { text, certainty }.`);
      checkText(`findings[${index}].text`, finding.text, problems);
      if (!CERTAINTY.includes(finding.certainty)) problems.push(`findings[${index}].certainty: aceita ${CERTAINTY.join(", ")}.`);
    });
  }
  checkText("story", narrative.story, problems);
  checkText("first_move", narrative.first_move, problems);
  for (const list of ["not_doing", "could_not_check"]) {
    if (narrative[list] !== undefined) {
      if (!Array.isArray(narrative[list])) problems.push(`${list}: precisa ser uma lista de frases.`);
      else narrative[list].forEach((item, index) => checkText(`${list}[${index}]`, item, problems));
    }
  }
  if (narrative.decisions !== undefined) {
    if (!Array.isArray(narrative.decisions)) problems.push("decisions: precisa ser uma lista de { question, recommendation, by }.");
    else narrative.decisions.forEach((decision, index) => {
      checkText(`decisions[${index}].question`, decision?.question, problems);
      checkText(`decisions[${index}].recommendation`, decision?.recommendation, problems);
    });
  }
  return problems;
}

function premiseLine(data, premise) {
  const entry = data.premises[premise.key] ?? {};
  const value = typeof entry.value === "string" && entry.value.trim() ? entry.value.trim() : "em aberto";
  const source = entry.source ?? "pendente";
  return { key: premise.key, label: premise.label, value, source, blocking: premise.blocking, if_different: entry.if_different || null, where: entry.where || null };
}

/** The moves the data itself dictates, before the narrative adds its own. */
function movesFrom({ calendar, economics, offer, pending }) {
  const moves = [];
  for (const deadline of (calendar?.deadlines ?? []).filter((item) => item.past)) moves.push({ what: deadline.text, when: "agora", why: `o prazo caía em ${brDay(deadline.date)} e já passou` });
  if (pending.length) moves.push({ what: `Fechar as premissas pendentes: ${pending.join(", ")}.`, when: "antes de qualquer gasto", why: "o plano é um rascunho enquanto elas estão em aberto" });
  if (economics?.learning_floor?.viable === false) moves.push({ what: "Escolher a saída da conta da fase de aprendizado: um evento mais cedo no funil, mais verba ou começar sabendo que a semana 1 só compara criativos.", when: "antes da fase de testes", why: economics.learning_floor.say });
  if (offer?.collision) moves.push({ what: offer.collision.kind === "colisao" ? "Transformar a promoção de agora no acesso antecipado da oferta do pico, ou mudar a forma da oferta do pico em vez do preço." : "Separar as duas ofertas: a do pico precisa ser diferente da que está no ar.", when: "antes do aquecimento", why: offer.collision.text });
  if (economics?.frequency?.too_high) moves.push({ what: "Alcançar a base por e-mail e mensagem; reservar para ela só a verba de remarketing que a frequência permite.", when: "ao montar a estrutura", why: economics.frequency.say });
  return moves;
}

/**
 * Assembles plano.json and plano.md. `narrative` is optional; without it the plan carries the
 * script's own sentences. Returns { plan, markdown, say, warnings }.
 */
export function buildPlan({ data, economics, offer, calendar, narrative = null, generatedAt, version = 1, state = "rascunho", refs }) {
  const warnings = [];
  const premises = PREMISES.map((premise) => premiseLine(data, premise));
  const pending = premises.filter((line) => !SETTLED.has(line.source) || line.value === "em aberto").map((line) => line.key);
  const blockingPending = premises.filter((line) => line.blocking && pending.includes(line.key)).map((line) => line.key);
  const { questions } = questionsFor(data, 4);
  const phases = calendar?.phases ?? [];
  const expected = economics?.scenarios?.find((scenario) => scenario.id === "esperado") ?? null;

  // The budget per phase: the expected scenario spread over the paid phases, with the peak doubled.
  const paidPhases = phases.filter((phase) => ["testes", "escala", "aquecimento", "pico"].includes(phase.id));
  const total = economics?.budget?.total_brl ?? null;
  let budgetByPhase = [];
  if (total !== null && paidPhases.length) {
    const weight = (phase) => (phase.id === "pico" ? 2 : phase.id === "aquecimento" ? 1.5 : 1) * phase.days;
    const sum = paidPhases.reduce((acc, phase) => acc + weight(phase), 0);
    budgetByPhase = paidPhases.map((phase) => ({ phase: phase.id, start: phase.start, end: phase.end, share_pct: Math.round((weight(phase) / sum) * 1000) / 10, budget_brl: Math.round((total * weight(phase)) / sum), daily_brl: Math.round((total * weight(phase)) / sum / phase.days) }));
  }

  const dataMoves = movesFrom({ calendar, economics, offer, pending });
  const moves = narrative?.first_move ? [{ what: narrative.first_move, when: "primeiro", why: "é o que os achados pedem antes de qualquer gasto" }, ...dataMoves] : dataMoves;
  if (moves.length > MOVES_MAX) warnings.push({ code: "moves_cut", text: `O plano tinha ${moves.length} movimentos e ficou com ${MOVES_MAX}: os outros estão nas seções.` });

  const couldNotCheck = [
    ...(narrative?.could_not_check ?? []),
    ...(economics?.assumptions ?? []).map((assumption) => `${assumption.label}: ${formatAssumption(assumption)} (${assumption.source === "padrão do app" ? "padrão do app" : `regra de bolso, ${refs.checked_on}`}); troque pelo seu número.`),
    ...(offer?.checks ?? []).filter((check) => check.status === "pendente").map((check) => `Oferta, para confirmar: ${check.text}`),
  ];

  const plan = {
    interface_version: 1,
    app: "media-plan",
    plan: data.plan,
    brand: data.brand || null,
    version,
    state,
    generated_at: generatedAt,
    today: calendar?.today ?? data.today ?? null,
    target_date: data.target_date ?? null,
    premises: Object.fromEntries(premises.map((line) => [line.key, { value: line.value, source: line.source, if_different: line.if_different, where: line.where }])),
    pending,
    blocking_pending: blockingPending,
    questions,
    economics: economics?.economics ?? null,
    funnel: economics?.funnel ?? null,
    budget: { ...(economics?.budget ?? {}), by_phase: budgetByPhase },
    scenarios: economics?.scenarios ?? [],
    learning_floor: economics?.learning_floor ?? null,
    frequency: economics?.frequency ?? null,
    offer: offer ? { options: offer.options, collision: offer.collision, checks: offer.checks, never: offer.never } : null,
    calendar: calendar ? { phases, decision_point: calendar.decision_point, deadlines: calendar.deadlines, holidays: calendar.holidays, learning_windows: calendar.learning_windows, short: calendar.short } : null,
    tracking: {
      utm_rule: UTM_RULE,
      events: ["visita (PageView)", "lead ou cadastro (Lead ou CompleteRegistration)", "ativação (o primeiro resultado útil)", "início de pagamento (InitiateCheckout)", "compra com valor (Purchase)"],
      note: "O evento escolhido na premissa é o que a campanha otimiza; os outros são lidos. Quem confere a medição é o app de medição.",
    },
    moves: moves.slice(0, MOVES_MAX),
    not_doing: narrative?.not_doing ?? [],
    could_not_check: couldNotCheck,
    findings: narrative?.findings ?? [],
    decisions: narrative?.decisions ?? [],
    assumptions: economics?.assumptions ?? [],
    sources: [
      { what: "faixas de referência do app", checked_on: refs.checked_on, items: refs.sources.map((source) => ({ what: source.what, url: source.url, checked_on: source.checked_on })) },
      ...(calendar ? [{ what: "feriados nacionais", checked_on: calendar.holidays_checked_on }] : []),
    ],
  };

  const markdown = renderMarkdown(plan, { narrative, economics, offer, calendar, premises });
  const inShort = markdown.split("\n## ")[1] ?? "";
  const inShortWords = words(inShort.replace(/^Em resumo\n/, ""));
  // Only the AI's findings can push the summary over the limit; the script's own sentences are written to fit.
  if (narrative && inShortWords > IN_SHORT_MAX_WORDS) warnings.push({ code: "in_short_long", text: `A seção "Em resumo" tem ${inShortWords} palavras; o limite é ${IN_SHORT_MAX_WORDS}. Encurte os achados em narrativa.json.`, words: inShortWords });

  const say = [
    narrative?.findings?.[0]?.text ?? (economics?.funnel?.say ?? "O plano está em rascunho."),
    moves[0] ? `Primeiro passo: ${moves[0].what}` : "Sem passo definido ainda.",
    blockingPending.length ? `Faltam ${blockingPending.length} premissa(s) para aprovar: ${blockingPending.join(", ")}.` : state === "aprovado" ? "Plano aprovado." : "Todas as premissas estão fechadas: o plano pode ser aprovado.",
  ];

  return { plan, markdown, say, warnings, in_short_words: inShortWords };
}

/**
 * The findings the script writes when the AI has not written a narrative yet: one short sentence
 * each, at most three, so the summary always fits its 150 words and a draft always comes out.
 */
function scriptFindings({ economics, offer }) {
  const out = [];
  const eco = economics?.economics;
  const funnel = economics?.funnel;
  const floor = economics?.learning_floor;
  const frequency = economics?.frequency;
  if (eco && funnel) out.push(`Um cliente pode custar até ${brl(eco.allowable_cac_brl)}; da meta de ${funnel.goal} ${funnel.goal_unit}, ${funnel.from_known} podem vir de quem já conhece a marca e ${funnel.cold_goal} de quem não conhece, o que pede ${funnel.leads_needed} leads.`);
  else if (eco) out.push(`Um cliente pode custar até ${brl(eco.allowable_cac_brl)} (${eco.allowable_cac_label}).`);
  else if (funnel) out.push(`Da meta de ${funnel.goal} ${funnel.goal_unit}, ${funnel.from_known} podem vir de quem já conhece a marca e ${funnel.cold_goal} de quem não conhece.`);
  if (floor?.viable === false) out.push(`Com ${brl(floor.cost_per_event_brl)} por evento, um conjunto precisa de ${brl(floor.floor_daily_brl)} por dia para sair da fase de aprendizado, e a verba é ${brl(floor.daily_brl)} por dia.`);
  else if (floor?.viable === true) out.push(`A verba de ${brl(floor.daily_brl)} por dia tira um conjunto da fase de aprendizado com eventos de até ${brl(floor.max_cost_per_event_brl)}.`);
  if (offer?.collision) out.push(offer.collision.kind === "colisao" ? `A promoção de agora termina ${offer.collision.gap_days} dias antes da data alvo: uma oferta mais funda no pico ensina quem está em dúvida a esperar.` : "A promoção de agora termina depois da data alvo: as duas ofertas se sobrepõem e a do pico precisa ser diferente.");
  if (out.length < 3 && frequency?.too_high) out.push(`Se toda a verba semanal fosse para a base (${frequency.matched} pessoas reconhecidas), cada uma veria o anúncio ${String(frequency.per_person_per_week).replace(".", ",")} vezes por semana: a base vai por e-mail e mensagem.`);
  if (!out.length) out.push("Sem preço, meta e verba fechados, a conta ainda não diz nada: as premissas vêm primeiro.");
  return out.slice(0, 3);
}

function renderMarkdown(plan, { narrative, economics, offer, calendar, premises }) {
  const lines = [];
  const title = `# Plano de estratégia e mídia${plan.brand ? `: ${plan.brand}` : ""}${plan.target_date ? `, até ${brDay(plan.target_date, true)}` : ""}`;
  lines.push(title, "", `Versão ${plan.version}, ${plan.state}, gerado em ${plan.generated_at.slice(0, 10)}.`, "");

  // Em resumo (the 30-second top).
  lines.push("## Em resumo", "");
  const looked = `Olhamos ${premises.filter((line) => line.value !== "em aberto").length} de ${premises.length} premissas${economics?.economics ? ", a conta do cliente" : ""}${offer?.options?.length ? ", a oferta" : ""}${calendar ? ` e o calendário até ${brDay(plan.target_date)}` : "; sem data alvo ainda"}.`;
  lines.push(looked);
  const findings = narrative?.findings?.length
    ? narrative.findings.map((finding, index) => `${index + 1}. ${finding.text} (${finding.certainty.replace("-", " ")})`)
    : scriptFindings({ economics, offer }).map((text, index) => `${index + 1}. ${text} (confirmado pela conta)`);
  lines.push(...findings);
  if (plan.moves[0]) lines.push(`Faça isto primeiro: ${plan.moves[0].what}`);
  lines.push("");

  // Decisões para você.
  lines.push("## Decisões para você", "");
  const pendingLines = premises.filter((line) => plan.pending.includes(line.key));
  if (!pendingLines.length && !(narrative?.decisions?.length)) lines.push("Nenhuma pendente: as premissas estão fechadas.");
  for (const line of pendingLines) lines.push(`- ${line.label}: ${line.value === "em aberto" ? "em aberto" : `sugestão, ${line.value.replace(/.$/, "")}`}${line.if_different ? `. Se for outra: ${line.if_different}` : ""}`);
  for (const decision of narrative?.decisions ?? []) lines.push(`- ${decision.question} Recomendação: ${decision.recommendation}${decision.by ? ` (até ${decision.by})` : ""}`);
  lines.push("");

  // A história.
  lines.push("## A história", "");
  if (narrative?.story) lines.push(narrative.story, "");
  if (economics?.economics) lines.push(economics.economics.say, "");
  if (economics?.funnel) lines.push(economics.funnel.say, "");
  if (economics?.scenarios?.length) {
    lines.push("| Cenário | Custo por lead | Conversão | Verba para a meta | O que a verba compra |", "|---|---|---|---|---|");
    for (const scenario of economics.scenarios) lines.push(`| ${scenario.id} | ${brl(scenario.cost_per_lead_brl)} | ${pct(scenario.lead_to_customer_pct)} | ${brl(scenario.budget_needed_brl)} | ${scenario.customers_bought === null ? "sem verba informada" : `${scenario.customers_bought} ${economics.funnel.goal_unit}${scenario.meets_goal ? ", chega à meta" : ", abaixo da meta"}${scenario.over_capacity ? `, acima da capacidade de ${economics.funnel.capacity_cap}` : ""}`} |`);
    lines.push("");
  }
  if (economics?.learning_floor?.say) lines.push(economics.learning_floor.say, "");
  if (economics?.frequency?.say) lines.push(economics.frequency.say, "");
  if (offer?.options?.length) {
    lines.push("Formas de oferta, para você escolher:", "");
    for (const option of offer.options) lines.push(`- ${option.label}: ${brl(option.price_brl)}${option.equivalent_monthly_brl && option.equivalent_monthly_brl !== option.price_brl ? ` (${brl(option.equivalent_monthly_brl)} por mês)` : ""}. ${option.why.charAt(0).toUpperCase()}${option.why.slice(1)}`);
    lines.push("", "O que a oferta nunca é:", ...offer.never.map((item) => `- ${item.text}`), "");
  }
  if (calendar?.phases?.length) {
    lines.push("Calendário:", "");
    lines.push("| Fase | De | Até | Dias | O que acontece |", "|---|---|---|---|---|");
    for (const phase of calendar.phases) lines.push(`| ${phase.id} | ${brDay(phase.start)} | ${brDay(phase.end)} | ${phase.days} | ${phase.text} |`);
    lines.push("", `Ponto de decisão: ${brDay(calendar.decision_point.date)} (${calendar.decision_point.weekday}). ${calendar.decision_point.text}`, "");
    if (plan.budget.by_phase.length) {
      lines.push("Verba por fase (cenário esperado):", "");
      for (const item of plan.budget.by_phase) lines.push(`- ${item.phase}: ${brl(item.budget_brl)} (${pct(item.share_pct)}), cerca de ${brl(item.daily_brl)} por dia`);
      lines.push("");
    }
    lines.push("Prazos que não se discutem:", "");
    for (const deadline of calendar.deadlines) lines.push(`- ${brDay(deadline.date)} (${deadline.weekday})${deadline.past ? ", já passou" : ""}: ${deadline.text}`);
    if (calendar.holidays.length) lines.push("", `Feriados no caminho: ${calendar.holidays.map((holiday) => `${holiday.name}, ${brDay(holiday.date)} (${holiday.weekday})`).join("; ")}.`);
    lines.push("");
  }
  lines.push(`Medição: um padrão só de link, ${plan.tracking.utm_rule}; os eventos lidos são ${plan.tracking.events.join(", ")}. ${plan.tracking.note}`, "");

  // O que fazer.
  lines.push("## O que fazer", "");
  plan.moves.forEach((move, index) => lines.push(`${index + 1}. ${move.what} Quando: ${move.when}. Por quê: ${move.why}`));
  if (!plan.moves.length) lines.push("Nada ainda: feche as premissas.");
  lines.push("");

  lines.push("## O que não vamos fazer", "");
  lines.push(...(plan.not_doing.length ? plan.not_doing.map((item) => `- ${item}`) : ["- Nada decidido ainda."]), "");

  lines.push("## O que não conseguimos conferir", "");
  lines.push(...(plan.could_not_check.length ? plan.could_not_check.map((item) => `- ${item}`) : ["- Nada em aberto."]), "");

  lines.push("## Premissas", "");
  lines.push("| Premissa | Valor | Origem |", "|---|---|---|");
  for (const line of premises) lines.push(`| ${line.label} | ${line.value} | ${line.source}${line.where ? ` (${line.where})` : ""} |`);
  lines.push("");

  lines.push("## Fontes", "");
  for (const source of plan.sources) {
    lines.push(`- ${source.what}, conferidas em ${source.checked_on}`);
    for (const item of source.items ?? []) lines.push(`  - ${item.what}: ${item.url} (${item.checked_on})`);
  }
  lines.push("", "Viés das fontes: as faixas de referência vêm de guias escritos para outro mercado e valem só como ordem de grandeza; os seus próprios números as substituem assim que existem.", "");
  return lines.join("\n");
}
