// The sequence (régua) of a group: the messages, each with a date anchored in the plan's phases
// or in a target date, a job, a subject, a call and a link under the single rule. A group that has
// not heard from the brand in six months gets a re-permission first; a group whose legal basis is
// not written gets a sequence marked `pendente` (D30).

import { addDays, AppError, brDay, daysBetween, parseDay, weekday } from "./util.mjs";

export const DEFAULT_UTM_RULE = "utm_source=<canal>&utm_medium=<meio>&utm_campaign=<plano>&utm_content=<nome do anúncio ou do envio>&utm_term=<público ou palavra>";
const SUBJECT_MAX = 45;

const fold = (text) => String(text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const slug = (text) => fold(text).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Where the sequence hangs: the plan's warm-up and peak, or a target date with the app's defaults. */
export function anchorsFor({ plan = null, target = null, today }) {
  const phases = plan?.data?.calendar?.phases ?? plan?.data?.budget?.by_phase?.map((item) => ({ id: item.phase, start: item.start, end: item.end })) ?? [];
  const warm = phases.find((phase) => phase.id === "aquecimento");
  const peak = phases.find((phase) => phase.id === "pico");
  if (warm && peak) return { source: "plano", plan: plan.slug, aquecimento: { start: warm.start, end: warm.end }, pico: { start: peak.start, end: peak.end }, target_date: peak.start };
  if (target) {
    if (!parseDay(target)) throw new AppError("usage", `Data alvo inválida: ${target}.`, "Use AAAA-MM-DD.");
    return { source: "data-alvo", plan: plan?.slug ?? null, aquecimento: { start: addDays(target, -7), end: addDays(target, -1) }, pico: { start: target, end: addDays(target, 3) }, target_date: target };
  }
  throw new AppError("target_missing", "Não há data para ancorar a régua: nem um plano com as fases nem uma data alvo.", "Passe --target AAAA-MM-DD, ou aprove um plano no app de plano.");
}

function subjectFor(step, { brand, deadline, group }) {
  const name = brand && brand.length <= 14 ? brand : "a gente";
  const until = deadline ? brDay(deadline) : "";
  const subjects = {
    repermissao: "Ainda quer receber nossas novidades?",
    novidade: `O que mudou ${name === "a gente" ? "por aqui" : `na ${name}`}`,
    "convite-teste": group === "nunca-ativaram" ? "Vale testar: o primeiro passo decidido" : "Vale testar de novo",
    prova: `Como funciona, na prática`,
    lista: "Quer saber da oferta primeiro?",
    "acesso-antecipado": until ? `Sua oferta abre antes: até ${until}` : "Sua oferta abre antes",
    abertura: until ? `A oferta está aberta até ${until}` : "A oferta está aberta",
    lembrete: "Ficou alguma dúvida?",
    "ultimo-dia": "Último dia: fecha hoje",
  };
  const subject = subjects[step.id] ?? step.label;
  return subject.length > SUBJECT_MAX ? subject.slice(0, SUBJECT_MAX - 1).trim() : subject;
}

/** The link of one message under the single rule: email as the channel, the step as the content, the group as the term. */
export function linkFor({ page, rule, campaign, step, group }) {
  const fields = String(rule ?? DEFAULT_UTM_RULE).split("&").map((part) => part.split("=")[0].trim()).filter(Boolean);
  const values = { utm_source: "email", utm_medium: "email", utm_campaign: slug(campaign || "base"), utm_content: step, utm_term: slug(group) };
  const query = fields.map((field) => `${field}=${encodeURIComponent(values[field] ?? "")}`).join("&");
  if (!page) return { query, url: null };
  try {
    const url = new URL(page);
    for (const field of fields) url.searchParams.set(field, values[field] ?? "");
    return { query, url: url.toString() };
  } catch {
    return { query, url: null };
  }
}

/**
 * Builds the sequence of one group. `legal` is the parsed entry of base-legal.md for the group
 * (or null); `counts` the inventory's group counts; `first` an optional step the AI asked to
 * start with, refused when the group is stale and the step is not the re-permission.
 */
export function buildSequence(group, { anchors, legal = null, counts = null, thresholds, plan = null, brand = null, page = null, utmRule = DEFAULT_UTM_RULE, campaign = null, today, first = null }) {
  const stale = Boolean(counts && counts.stale > 0);
  const allStale = Boolean(counts && counts.marketable > 0 && counts.stale === counts.marketable);
  if (first && stale && first !== "repermissao") {
    throw new AppError("repermission_required", `O grupo ${group} tem ${counts.stale} pessoa(s) sem contato há 6 meses ou mais: a primeira mensagem para elas é a repermissão, não "${first}".`, "Comece pela repermissão; quem responder entra nas mensagens seguintes, quem não responder sai da régua.", { stale: counts.stale, marketable: counts.marketable });
  }
  const warnings = [];
  const deadline = anchors.pico.end;
  const steps = [];
  for (const step of thresholds.sequence.steps) {
    if (step.groups && !step.groups.includes(group)) continue;
    if (step.only_when_stale && !stale) continue;
    const anchor = anchors[step.anchor];
    let date;
    if (step.offset === "middle") date = addDays(anchor.start, Math.floor(daysBetween(anchor.start, anchor.end) / 2));
    else if (step.offset === "end") date = anchor.end;
    else date = addDays(anchor.start, step.offset);
    if (daysBetween(today, date) < 0) {
      warnings.push({ code: "past_date", step: step.id, text: `"${step.label}" caía em ${brDay(date)}, que já passou: entra hoje, e a régua encurta.` });
      date = today;
    }
    const link = linkFor({ page, rule: utmRule, campaign: campaign ?? anchors.plan ?? "base", step: step.id, group });
    steps.push({
      id: step.id,
      label: step.label,
      date,
      weekday: weekday(date),
      anchor: `${step.anchor}${typeof step.offset === "number" ? ` ${step.offset >= 0 ? "+" : ""}${step.offset}` : ` (${step.offset === "middle" ? "meio" : "fim"})`}`,
      audience: step.only_when_stale ? `só quem está sem contato há 6 meses ou mais (${counts?.stale ?? 0})` : stale && !allStale ? `quem respondeu à repermissão e quem já recebia (${counts ? counts.marketable - counts.stale : "?"} direto)` : "o grupo inteiro que pode receber marketing",
      job: step.job,
      subject: subjectFor(step, { brand, deadline, group }),
      cta: step.cta,
      body: "[a escrever]",
      link: link.url ?? `[página]?${link.query}`,
      utm_content: step.id,
    });
  }
  // Re-permission has a second touch and a wait: nobody else writes to the stale slice before it answers.
  const re = steps.find((step) => step.id === "repermissao");
  if (re) {
    const second = { ...re, id: "repermissao-2", label: "Repermissão, segunda vez", date: addDays(re.date, thresholds.repermission.keep_link_days), subject: "Última vez que escrevemos sem resposta", job: `a segunda e última tentativa; quem não clicar em ${thresholds.repermission.keep_link_days} dias sai da régua e fica só na lista de exclusão`, utm_content: "repermissao-2" };
    second.weekday = weekday(second.date);
    second.link = linkFor({ page, rule: utmRule, campaign: campaign ?? anchors.plan ?? "base", step: "repermissao-2", group }).url ?? second.link.replace("utm_content=repermissao", "utm_content=repermissao-2");
    steps.splice(1, 0, second);
  }
  // The cap: never two marketing messages on the same day; shift the later one.
  steps.sort((a, b) => a.date.localeCompare(b.date) || 0);
  for (let i = 1; i < steps.length; i++) {
    if (steps[i].date <= steps[i - 1].date) {
      const moved = addDays(steps[i - 1].date, 1);
      if (daysBetween(moved, deadline) >= 0 || steps[i].id === "ultimo-dia") {
        if (steps[i].id !== "ultimo-dia") {
          warnings.push({ code: "cap_shift", step: steps[i].id, text: `"${steps[i].label}" caía no mesmo dia de "${steps[i - 1].label}": passou para ${brDay(moved)} (uma mensagem de marketing por ${thresholds.cadence.min_hours_between_marketing} horas).` });
          steps[i].date = moved;
          steps[i].weekday = weekday(moved);
        } else {
          // the last day cannot move: the earlier one gives way
          const earlier = addDays(steps[i].date, -1);
          warnings.push({ code: "cap_shift", step: steps[i - 1].id, text: `"${steps[i - 1].label}" caía no último dia: passou para ${brDay(earlier)}.` });
          steps[i - 1].date = earlier;
          steps[i - 1].weekday = weekday(earlier);
        }
      }
    }
  }
  steps.sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 0; i < steps.length; i++) {
    const windowEnd = addDays(steps[i].date, 6);
    const inWeek = steps.filter((step) => step.date >= steps[i].date && step.date <= windowEnd && !step.id.startsWith("repermissao")).length;
    if (inWeek > thresholds.cadence.max_per_week) {
      warnings.push({ code: "cap_week", text: `${inWeek} mensagens de marketing na semana de ${brDay(steps[i].date)}: acima de ${thresholds.cadence.max_per_week}. Tire uma, ou aceite o excesso só nesta semana de pico, com fim marcado.` });
      break;
    }
  }
  const legalStatus = legal?.status ?? "pendente";
  const marketingAllowed = legal?.marketing_allowed ?? false;
  const state = legalStatus === "completo" && marketingAllowed ? "pronta" : "pendente";
  const pendingWhy = legalStatus !== "completo" ? `a base legal do grupo ${group} tem campos vazios em base-legal.md` : !marketingAllowed ? `a base legal do grupo ${group} é execução de contrato: só o transacional pode ir` : null;
  return {
    version: 1,
    group,
    state,
    pending_why: pendingWhy,
    generated_at: today,
    anchors,
    counts: counts ?? null,
    stale,
    channel: "email",
    utm_rule: utmRule,
    steps,
    rules: {
      first_message_when_stale: "repermissão: quem não recebe nada há 6 meses ou mais recebe antes a pergunta se ainda quer receber; nada de promoção antes do sim",
      cap: `até 1 mensagem de marketing por ${thresholds.cadence.min_hours_between_marketing} horas e ${thresholds.cadence.max_per_week} por semana só na semana de pico; ${thresholds.cadence.comfortable_per_week} nas outras`,
      footer: "toda mensagem diz quem escreve, de onde veio o contato e como sair com um clique",
      recent_buyers: `quem comprou nos últimos ${thresholds.cadence.recent_buyer_quiet_days} dias fica fora das promoções`,
    },
    warnings,
    say: `${steps.length} mensagem(ns) para ${group}, de ${brDay(steps[0]?.date ?? today)} a ${brDay(steps[steps.length - 1]?.date ?? today)}, ancoradas ${anchors.source === "plano" ? `no plano ${anchors.plan}` : `na data alvo ${brDay(anchors.target_date)}`}${stale ? `; ${counts.stale} pessoa(s) começam pela repermissão` : ""}. Estado: ${state}${pendingWhy ? ` (${pendingWhy})` : ""}.`,
  };
}
