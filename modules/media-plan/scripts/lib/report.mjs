// The written plan: plano.json (the contract other apps read) and plano.md (what the member
// reads), assembled from the premises, the arithmetic, the offer and the calendar. The script
// composes every number; the member's AI writes the narrative in narrativa.json, which is
// checked here before it enters.

import { brDay, brl, pct } from "./util.mjs";
import { PREMISES, SETTLED, questionsFor } from "./premises.mjs";
import { changesMarkdown } from "./replan.mjs";

const VERDICT_WORDS = { run: "roda", test: "testa", later: "depois", no: "não" };
const LENS_WORDS = { publico_intencao: "público e intenção", economia: "economia", prontidao: "prontidão", tempo_ate_sinal: "tempo até sinal", evidencia: "evidência", horas: "horas" };

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
 * The budget per phase: the expected scenario spread over the paid phases, the peak weighing
 * double and the warm-up one and a half. Empty without a total or a calendar.
 */
export function budgetByPhase({ economics, calendar }) {
  const phases = calendar?.phases ?? [];
  const paidPhases = phases.filter((phase) => ["testes", "escala", "aquecimento", "pico"].includes(phase.id));
  const total = economics?.budget?.total_brl ?? null;
  if (total === null || !paidPhases.length) return [];
  const weight = (phase) => (phase.id === "pico" ? 2 : phase.id === "aquecimento" ? 1.5 : 1) * phase.days;
  const sum = paidPhases.reduce((acc, phase) => acc + weight(phase), 0);
  return paidPhases.map((phase) => ({ phase: phase.id, start: phase.start, end: phase.end, share_pct: Math.round((weight(phase) / sum) * 1000) / 10, budget_brl: Math.round((total * weight(phase)) / sum), daily_brl: Math.round((total * weight(phase)) / sum / phase.days) }));
}

/**
 * Assembles plano.json and plano.md. `narrative` is optional; without it the plan carries the
 * script's own sentences. `channels`, `structure`, `rules` and `replan` enter when their
 * commands ran. Returns { plan, markdown, say, warnings }.
 */
export function buildPlan({ data, economics, offer, calendar, narrative = null, generatedAt, version = 1, state = "rascunho", refs, channels = null, structure = null, rules = null, replan = null }) {
  const warnings = [];
  const premises = PREMISES.map((premise) => premiseLine(data, premise));
  const pending = premises.filter((line) => !SETTLED.has(line.source) || line.value === "em aberto").map((line) => line.key);
  const blockingPending = premises.filter((line) => line.blocking && pending.includes(line.key)).map((line) => line.key);
  const { questions } = questionsFor(data, 4);
  const phases = calendar?.phases ?? [];
  const expected = economics?.scenarios?.find((scenario) => scenario.id === "esperado") ?? null;

  const byPhase = budgetByPhase({ economics, calendar });

  const dataMoves = movesFrom({ calendar, economics, offer, pending });
  for (const warning of channels?.warnings ?? []) if (warning.code === "hours") dataMoves.push({ what: warning.text, when: "ao montar a estrutura", why: "as horas de quem executa são uma premissa, não um desejo" });
  for (const move of replan?.moves ?? []) dataMoves.push({ what: `Decidir o movimento ${move.id} proposto pela leitura.`, when: "nesta semana", why: move.text });
  const moves = narrative?.first_move ? [{ what: narrative.first_move, when: "primeiro", why: "é o que os achados pedem antes de qualquer gasto" }, ...dataMoves] : dataMoves;
  if (moves.length > MOVES_MAX) warnings.push({ code: "moves_cut", text: `O plano tinha ${moves.length} movimentos e ficou com ${MOVES_MAX}: os outros estão nas seções.` });

  const couldNotCheck = [
    ...(narrative?.could_not_check ?? []),
    ...(economics?.assumptions ?? []).map((assumption) => `${assumption.label}: ${formatAssumption(assumption)} (${assumption.source === "padrão do app" ? "padrão do app" : `regra de bolso, ${refs.checked_on}`}); troque pelo seu número.`),
    ...(offer?.checks ?? []).filter((check) => check.status === "pendente").map((check) => `Oferta, para confirmar: ${check.text}`),
    ...(structure?.warnings ?? []).map((warning) => warning.text),
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
    budget: { ...(economics?.budget ?? {}), by_phase: byPhase },
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
    channels_decision: channels ? { rows: channels.rows, hours: channels.hours, warnings: channels.warnings ?? [], say: channels.say } : null,
    structure: structure?.channels ?? null,
    rules: rules?.rules ?? null,
    triggers: rules?.triggers ?? [],
    replan: replan ?? null,
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

  const markdown = renderMarkdown(plan, { narrative, economics, offer, calendar, premises, channels, structure, rules, replan });
  const inShort = markdown.split("\n## ").find((section) => section.startsWith("Em resumo")) ?? "";
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

function renderChannels(lines, channels) {
  lines.push("## Canais", "");
  lines.push("| Canal | Veredito | Lente | Por quê | O que vira |", "|---|---|---|---|---|");
  for (const row of channels.rows) lines.push(`| ${row.label} | ${VERDICT_WORDS[row.verdict] ?? row.verdict}${row.confidence === "evidencia" ? " (evidência)" : ""} | ${LENS_WORDS[row.lens] ?? row.lens} | ${row.reason} | ${row.flip ?? ""} |`);
  lines.push("", `Horas por semana: os canais que rodam ou testam pedem ${channels.hours.asked} e há ${channels.hours.available}.${channels.warnings?.length ? ` ${channels.warnings.map((warning) => warning.text).join(" ")}` : ""}`);
  if (channels.rules) lines.push("", `Regras: ${Object.values(channels.rules).join("; ")}.`);
  lines.push("");
}

function renderStructure(lines, structure) {
  lines.push("## Estrutura", "");
  const meta = structure.channels?.meta;
  if (meta) {
    lines.push(`Meta (${VERDICT_WORDS[meta.verdict] ?? meta.verdict}): objetivo ${meta.objective}, otimizando por ${meta.optimization_event}. ${meta.event_note.charAt(0).toUpperCase()}${meta.event_note.slice(1)}.`, "");
    lines.push(`Campanha ${meta.campaign.name}, verba no conjunto, ${brl(meta.campaign.daily_brl)} por dia.`, "");
    for (const set of meta.ad_sets) {
      lines.push(`- Conjunto ${set.name}: ${brl(set.daily_brl)} por dia${set.floor_daily_brl !== null && set.floor_daily_brl !== undefined ? ` contra o piso de ${brl(set.floor_daily_brl)}${set.clears_floor ? ", acima" : ", abaixo, aceito"}` : ", sem piso calculado (falta o custo por evento)"}. Público: ${set.audience}. Exclui: ${set.exclusions.join("; ")}. Posicionamentos: ${set.placements}. ${set.reason.charAt(0).toUpperCase()}${set.reason.slice(1)}. ${set.ads}.`);
    }
    lines.push("", `Nomes: campanha ${meta.naming.campaign}; conjunto ${meta.naming.ad_set}; anúncio: ${meta.naming.ad}.`, "");
    lines.push("Remarketing por etapa (entra na escala, quando os públicos existirem):", "");
    lines.push("| Etapa | Quem | Janela | Mensagem |", "|---|---|---|---|");
    for (const stage of meta.remarketing) lines.push(`| ${stage.stage} | ${stage.audience} (${stage.source}) | ${stage.window_days} dias | ${stage.message} |`);
    lines.push("", meta.remarketing_note.charAt(0).toUpperCase() + meta.remarketing_note.slice(1) + ".");
    if (meta.lookalike) lines.push("", `Semelhante: ${meta.lookalike.source}. ${meta.lookalike.note.charAt(0).toUpperCase()}${meta.lookalike.note.slice(1)}.`);
    if (meta.budget_by_phase?.length) lines.push("", `Verba da Meta por fase: ${meta.budget_by_phase.map((item) => `${item.phase} ${brl(item.daily_brl)} por dia`).join("; ")}.`);
    lines.push("", "Regras de subida:", ...meta.launch_rules.map((rule) => `- ${rule.charAt(0).toUpperCase()}${rule.slice(1)}.`), "");
  }
  const search = structure.channels?.google_search;
  if (search) {
    lines.push(`Busca do Google (${VERDICT_WORDS[search.verdict] ?? search.verdict}): ${brl(search.daily_brl)} por dia${search.clears_minimum === false ? `, abaixo do mínimo de ${brl(search.minimum_daily_brl)}` : ""}.`, "");
    for (const campaign of search.campaigns) lines.push(`- ${campaign.name} (${campaign.kind}): ${campaign.when}. Palavras: ${campaign.keywords.join(", ")}; correspondência ${campaign.match}. Negativas: ${campaign.negatives.join(", ")}. Lance: ${campaign.bid}. ${Math.round(campaign.budget_share * 100)}% da verba da Busca.`);
    lines.push("", `Conversão: ${search.conversion.primary}; secundárias: ${search.conversion.secondary.join(", ")}. Extensões: ${search.extensions.join("; ")}.`, "");
    lines.push("Regras da Busca:", ...search.rules.map((rule) => `- ${rule.charAt(0).toUpperCase()}${rule.slice(1)}.`), "");
  }
  if (structure.channels?.owned?.length) {
    lines.push("Base e parceiros:", ...structure.channels.owned.map((item) => `- ${item.channel}: ${item.what}${item.dates ? ` (${item.dates})` : ""}.`), "");
  }
  if (!meta && !search && !structure.channels?.owned?.length) lines.push("Nenhum canal roda ou testa ainda: a estrutura espera a decisão dos canais.", "");
}

function renderRules(lines, rules) {
  const body = rules.rules;
  lines.push("## Regras de decisão", "");
  lines.push(`Dado suficiente: ${body.sample.label} (regra de bolso, ${body.checked_on}; o histórico da conta substitui).${body.allowable_cost_brl ? ` Custo permitido: ${brl(body.allowable_cost_brl)} por resultado.` : ""}${body.learning_floor_daily_brl ? ` Piso de aprendizado: ${brl(body.learning_floor_daily_brl)} por dia por conjunto.` : ""}`, "");
  lines.push("Indicadores por fase:", ...Object.entries(body.indicators_by_phase).map(([phase, items]) => `- ${phase}: ${items.join("; ")}`), "");
  lines.push("Pausa quando:", ...body.pause_when.map((item) => `- ${item.charAt(0).toUpperCase()}${item.slice(1)}.`), "");
  lines.push("Escala quando:", ...body.scale_when.map((item) => `- ${item.charAt(0).toUpperCase()}${item.slice(1)}.`), "");
  lines.push("Troca a peça quando:", ...body.swap_when.map((item) => `- ${item.charAt(0).toUpperCase()}${item.slice(1)}.`), "");
  lines.push(`${body.one_edit_per_set_per_week.charAt(0).toUpperCase()}${body.one_edit_per_set_per_week.slice(1)}.`, "");
  lines.push(`Cadência: ${body.cadence.weekly}. Diário: ${body.cadence.daily}.${body.cadence.decision_point ? ` Ponto de decisão: ${body.cadence.decision_point}.` : ""}`, "");
  lines.push("Gatilhos e plano B:", "", "| Risco | Onde se lê | Plano B |", "|---|---|---|");
  for (const trigger of rules.triggers ?? []) lines.push(`| ${trigger.risk} | ${trigger.read_in} | ${trigger.plan_b} |`);
  lines.push("");
}

function renderMarkdown(plan, { narrative, economics, offer, calendar, premises, channels = null, structure = null, rules = null, replan = null }) {
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

  // O que mudou e por quê, when this version was born from a weekly read.
  if (replan) lines.push(changesMarkdown(replan, { version: plan.version, from: replan.from ?? "a leitura semanal do app de medição" }), "");

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

  if (channels?.rows?.length) renderChannels(lines, channels);
  if (structure) renderStructure(lines, structure);
  if (rules?.rules) renderRules(lines, rules);

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
