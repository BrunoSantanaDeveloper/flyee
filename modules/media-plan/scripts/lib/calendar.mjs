// The calendar: the phases of a plan worked backwards from the target date, the fixed lead
// times, how many 7-day learning windows fit, the decision point and the national holidays
// inside the window. Dates only; what happens in each phase is the plan's text.

import { addDays, brDay, daysBetween, parseDay, weekday } from "./util.mjs";

/** Lead times a plan does not get to argue with (rules of thumb, written in references/situacao.md). */
export const DEADLINES = [
  { id: "regua_escrita", offset: -14, text: "A régua de e-mail e mensagens está escrita e revisada." },
  { id: "pagina_pronta", offset: -10, text: "A página de destino está no ar com a oferta, o prazo e as regras." },
  { id: "rastreamento_e_oferta", offset: -7, text: "Rastreamento conferido (eventos, UTMs) e a oferta ao vivo na página. Nada pago sobe antes disto." },
  { id: "criativos_em_revisao", offset: -3, text: "Os anúncios do pico enviados para a revisão da plataforma, que leva de 1 a 2 dias." },
  { id: "subida_programada", offset: -2, text: "A subida dos anúncios do pico programada com data, para passar pela revisão antes do dia." },
];

export const PHASES = ["preparacao", "testes", "escala", "aquecimento", "pico", "depois"];

const PHASE_TEXT = {
  preparacao: "Preparação: contas, rastreamento, página, oferta e os primeiros criativos. Nada pago ainda.",
  testes: "Testes: a primeira verba compara ângulos e criativos entre si e mede o custo por lead e a conversão da página; a semana 1 não julga vendas.",
  escala: "Escala e captação: o que leu melhor recebe a verba; a lista cresce e os públicos de remarketing se formam.",
  aquecimento: "Aquecimento: a base e a lista recebem o acesso antecipado; o frio reduz, porque o CPM do pico é mais caro.",
  pico: "Pico: a oferta no ar, remarketing e a base; leitura diária por exceção.",
  depois: "Depois: implantação de quem entrou, a leitura do que aprendemos e o que vira campanha sempre ativa.",
};

function holidaysBetween(refs, from, to) {
  const start = parseDay(from);
  const end = parseDay(to);
  const found = [];
  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year++) {
    for (const fixed of refs.fixed) {
      const day = `${year}-${String(fixed.month).padStart(2, "0")}-${String(fixed.day).padStart(2, "0")}`;
      if (daysBetween(from, day) >= 0 && daysBetween(day, to) >= 0) found.push({ date: day, name: fixed.name, weekday: weekday(day) });
    }
  }
  for (const dated of refs.dated ?? []) if (daysBetween(from, dated.date) >= 0 && daysBetween(dated.date, to) >= 0) found.push({ date: dated.date, name: dated.name, weekday: weekday(dated.date) });
  return found.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Builds calendario.json for a target date. `peak` means the date is a selling peak (the
 * phases end in a pico of a few days); otherwise the target is a launch day.
 */
export function buildCalendar({ today, targetDate, holidays, peak = true, peakDays = 4 }) {
  const total = daysBetween(today, targetDate);
  if (total < 0) return { version: 1, today, target_date: targetDate, total_days: total, error: "target_past", say: "A data alvo já passou: escolha outra para o plano ter um calendário." };
  const warnings = [];
  const phases = [];
  const push = (id, start, end) => {
    if (daysBetween(start, end) < 0) return;
    phases.push({ id, start, end, days: daysBetween(start, end) + 1, text: PHASE_TEXT[id] });
  };

  const peakEnd = peak ? addDays(targetDate, peakDays - 1) : targetDate;
  const short = total < 22;
  if (short) warnings.push({ code: "short_window", text: `Faltam ${total} dias até a data alvo: não cabe uma fase de testes inteira antes do aquecimento. O plano encurta a preparação e tira a fase de escala; o que não der para aprender agora fica para depois do pico.` });

  if (total >= 8) {
    const prepEnd = short ? addDays(today, 2) : addDays(today, Math.min(6, Math.max(2, total - 16)));
    push("preparacao", today, prepEnd);
    const warmStart = addDays(targetDate, -7);
    const testsEnd = short ? addDays(warmStart, -1) : addDays(targetDate, -15);
    push("testes", addDays(prepEnd, 1), testsEnd);
    if (!short) push("escala", addDays(targetDate, -14), addDays(warmStart, -1));
    push("aquecimento", warmStart, addDays(targetDate, -1));
  } else {
    warnings.push({ code: "no_runway", text: `Faltam ${total} dias: só cabe preparar e aquecer. A verba paga rende mais no pico e no remarketing; o aprendizado fica para a campanha seguinte.` });
    push("preparacao", today, addDays(targetDate, -Math.min(4, total)));
    push("aquecimento", addDays(targetDate, -Math.min(3, total)), addDays(targetDate, -1));
  }
  push("pico", targetDate, peakEnd);
  push("depois", addDays(peakEnd, 1), addDays(peakEnd, 14));

  const tests = phases.find((phase) => phase.id === "testes");
  const learningWindows = tests ? Math.floor(tests.days / 7) : 0;
  if (tests && learningWindows === 0) warnings.push({ code: "no_learning_window", text: "A fase de testes tem menos de 7 dias: nenhum conjunto chega a sair da fase de aprendizado antes do aquecimento." });

  const decisionPoint = addDays(targetDate, -14);
  const deadlines = DEADLINES.map((deadline) => {
    const day = addDays(targetDate, deadline.offset);
    const past = daysBetween(today, day) < 0;
    if (past) warnings.push({ code: "deadline_past", text: `O prazo "${deadline.text}" caía em ${brDay(day)}, que já passou: entra como o primeiro passo, não como data.` });
    return { ...deadline, date: day, weekday: weekday(day), past };
  });

  const inWindow = holidaysBetween(holidays, today, peakEnd);
  for (const holiday of inWindow) {
    const phase = phases.find((item) => daysBetween(item.start, holiday.date) >= 0 && daysBetween(holiday.date, item.end) >= 0);
    holiday.phase = phase?.id ?? null;
    if (phase && (phase.id === "aquecimento" || phase.id === "pico")) warnings.push({ code: "holiday_in_peak", text: `${holiday.name} (${brDay(holiday.date)}, ${holiday.weekday}) cai no ${phase.id}: atendimento e envios precisam de alguém de plantão, e o CPM do dia costuma mudar.` });
  }

  const say = `${total} dias até ${brDay(targetDate)} (${weekday(targetDate)}): ${phases.map((phase) => `${phase.id} de ${brDay(phase.start)} a ${brDay(phase.end)}`).join(", ")}. ${learningWindows} janela(s) de 7 dias para aprender antes do aquecimento; ponto de decisão em ${brDay(decisionPoint)}${inWindow.length ? `; feriados no caminho: ${inWindow.map((holiday) => `${holiday.name} (${brDay(holiday.date)})`).join(", ")}` : ""}.`;

  return {
    version: 1,
    today,
    target_date: targetDate,
    target_weekday: weekday(targetDate),
    total_days: total,
    peak,
    short,
    phases,
    learning_windows: learningWindows,
    decision_point: { date: decisionPoint, weekday: weekday(decisionPoint), text: "Redistribuir a verba pelo que leu melhor; a última chance de trocar o ângulo antes do aquecimento." },
    deadlines,
    holidays: inWindow,
    holidays_checked_on: holidays.checked_on,
    warnings,
    say,
  };
}
