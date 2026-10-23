// The moves: what the reading proposes, what the member says they applied, and the verdict of
// each earlier move read against its own before and after windows. A move without an applied
// date never gets a verdict; a second move on the same object inside the window makes both
// unreadable, and the text says so.

import { addDays, brDay, brl, daysBetween, round2 } from "./util.mjs";

export const KINDS = { subir_verba: "Subir a verba", pausar: "Pausar", nova_versao: "Fazer uma nova versão", negativar: "Negativar o termo", segurar: "Segurar", conferir_rastreamento: "Conferir o rastreamento" };
export const MOVE_VERDICTS = ["funcionou", "nao_funcionou", "cedo", "nao_da_para_dizer"];

/** A move is open until it gets a final verdict; "cedo" (too early) keeps it open. */
export function isOpen(move) {
  return !move.veredito || move.veredito === "cedo";
}

export function emptyMoves() {
  return { version: 1, moves: [] };
}

function nextId(moves) {
  const max = moves.reduce((acc, move) => Math.max(acc, Number(String(move.id).replace(/^M/, "")) || 0), 0);
  return `M${max + 1}`;
}

/**
 * Proposes moves from a judged table. Open moves (no verdict yet) of the same kind on the same
 * object are not proposed again. Returns { moves (all), proposed (new ones) }.
 */
export function proposeMoves(store, table, { today, rules, allowable = null, reading = null, claimRatio = null }) {
  const moves = [...store.moves];
  const proposed = [];
  const open = (kind, object) => moves.some((move) => move.tipo === kind && move.objeto === object && isOpen(move));
  const push = (move) => {
    if (open(move.tipo, move.objeto)) return;
    const full = { id: nextId(moves), proposto_em: today, leitura: reading, aplicado_em: null, legivel_em: null, veredito: null, veredito_em: null, ...move };
    moves.push(full);
    proposed.push(full);
  };
  const recheck = addDays(today, rules.moves.recheck_days);
  for (const row of table.rows) {
    const object = row.name;
    const nivel = table.level ?? "ad";
    const metrics = row.metrics;
    if (row.verdict === "escalar") {
      push({ tipo: "subir_verba", objeto: row.adset ?? object, nivel: row.adset ? "adset" : nivel, texto: `${KINDS.subir_verba} do conjunto de "${object}" em ${rules.scale.step_pct[0]} a ${rules.scale.step_pct[1]}%, uma vez por semana enquanto o custo segurar.`, porque: row.reasons.join(" "), certeza: row.certainty, conferir_em: recheck, gatilho: allowable ? `se o custo por resultado passar de ${brl(round2(allowable * rules.hold.cost_multiple_max))} em 7 dias, voltar a verba.` : null, antes: snapshot(metrics) });
    } else if (row.verdict === "cortar") {
      push({ tipo: "pausar", objeto: object, nivel, texto: `${KINDS.pausar} "${object}". A verba dela vai para os outros anúncios do conjunto; só economiza se a verba do conjunto também baixar.`, porque: row.reasons.join(" "), certeza: row.certainty, conferir_em: recheck, gatilho: null, antes: snapshot(metrics) });
    } else if (row.verdict === "iterar") {
      const where = row.where_it_fails;
      push({ tipo: "nova_versao", objeto: object, nivel, texto: `${KINDS.nova_versao} de "${object}" mudando ${where === "gancho" ? "os 3 primeiros segundos" : where === "miolo" ? "o miolo e a chamada" : where === "anuncio" ? "o texto do anúncio ou a palavra" : "a página de destino"}; o resto fica igual, para a comparação valer.`, porque: row.reasons.join(" "), certeza: row.certainty, onde_falha: where, conferir_em: addDays(today, rules.moves.legible_days), gatilho: null, antes: snapshot(metrics) });
    } else if (row.verdict === "negativar") {
      push({ tipo: "negativar", objeto: object, nivel: "search_term", texto: `${KINDS.negativar} "${object}" na campanha${row.campaign ? ` ${row.campaign}` : ""}.`, porque: row.reasons.join(" "), certeza: row.certainty, conferir_em: recheck, gatilho: null, antes: snapshot(metrics) });
    } else if (row.verdict === "manter" && row.readings) {
      push({ tipo: "segurar", objeto: object, nivel, texto: `${KINDS.segurar} "${object}" por 7 dias: a leitura está no limiar, e a escolha é do integrante.`, porque: `${row.readings.change} ${row.readings.hold}`, certeza: row.certainty, decisao_do_integrante: true, conferir_em: recheck, gatilho: allowable ? `se passar de ${brl(round2(allowable * 1.5))} por resultado com ${rules.sample.results} resultados, pausar.` : null, antes: snapshot(metrics) });
    } else if (row.verdict === "dado_insuficiente" && ["ad", "adset"].includes(nivel) && allowable && typeof metrics.spend === "number" && metrics.spend >= allowable) {
      push({ tipo: "segurar", objeto: object, nivel, texto: `${KINDS.segurar} "${object}": ainda sem amostra para julgar.`, porque: row.reasons.join(" "), certeza: "primeira-leitura", conferir_em: recheck, gatilho: allowable ? `se passar de ${brl(round2(allowable * rules.cut.zero_results_spend_multiple))} gastos sem resultado, pausar.` : null, antes: snapshot(metrics) });
    }
  }
  if (claimRatio !== null && (claimRatio > 1.5 || claimRatio < 1)) {
    push({ tipo: "conferir_rastreamento", objeto: "rastreamento", nivel: "conta", texto: claimRatio < 1 ? "Conferir o rastreamento: as plataformas contam menos compras do que a planilha de origem registra, então o evento de compra não está disparando em parte das vendas." : "Conferir o rastreamento: as plataformas reivindicam mais de 1,5 compra para cada compra real; o Pixel e a API de Conversões podem estar contando a mesma compra duas vezes.", porque: `razão de reivindicação ${claimRatio}; o normal fica entre 1,2 e 1,4.`, certeza: "provavel", conferir_em: recheck, gatilho: null, antes: null });
  }
  return { moves, proposed };
}

function snapshot(metrics) {
  if (!metrics) return null;
  return { spend: metrics.spend ?? null, results: metrics.results ?? null, cost_per_result_brl: metrics.cost_per_result_brl ?? null, link_ctr_pct: metrics.link_ctr_pct ?? metrics.ctr_pct ?? null, hook_rate: metrics.hook_rate ?? null };
}

/** The member said they applied a move: stamps the date and the day it becomes readable. */
export function applyMove(store, id, on, rules) {
  const move = store.moves.find((item) => item.id === id);
  if (!move) return null;
  move.aplicado_em = on;
  move.legivel_em = addDays(on, rules.moves.legible_days);
  move.veredito = null;
  move.veredito_em = null;
  return move;
}

/** Readings as the weekly read needs them: id, source, period, and the judged rows by name. */
function windowFor(readings, object, { from, to }) {
  // A reading whose period lies inside [from, to] and carries the object.
  const candidates = readings.filter((reading) => reading.period && daysBetween(from, reading.period.start) >= 0 && daysBetween(reading.period.end, to) >= 0);
  for (const reading of candidates.sort((a, b) => b.period.end.localeCompare(a.period.end))) {
    const row = reading.rows.find((item) => item.name === object || item.adset === object);
    if (row) return { reading: reading.id, period: reading.period, row };
  }
  return null;
}

function perDay(row, period) {
  const days = Math.max(1, daysBetween(period.start, period.end) + 1);
  return { results_per_day: round2((row.metrics.results ?? 0) / days), spend_per_day: round2((row.metrics.spend ?? 0) / days), cost: row.metrics.cost_per_result_brl ?? null, ctr: row.metrics.link_ctr_pct ?? row.metrics.ctr_pct ?? null };
}

/**
 * Judges every applied move that has no final verdict. `readings` are the normalized, judged
 * readings available in the project. Returns the lines for "Desde a última vez".
 */
export function judgeMoves(store, readings, { today, rules, allowable = null }) {
  const lines = [];
  for (const move of store.moves) {
    if (!move.aplicado_em) {
      if (move.proposto_em && daysBetween(move.proposto_em, today) > rules.moves.recheck_days) lines.push({ id: move.id, verdict: null, text: `${move.texto} Proposto em ${brDay(move.proposto_em)}; o integrante ainda não disse se fez.` });
      continue;
    }
    if (move.veredito && move.veredito !== "cedo") continue;
    if (daysBetween(today, move.legivel_em) > 0) {
      move.veredito = "cedo";
      move.veredito_em = today;
      lines.push({ id: move.id, verdict: "cedo", text: `${move.texto} Aplicado em ${brDay(move.aplicado_em)}: cedo para ler, fica legível em ${brDay(move.legivel_em)}.` });
      continue;
    }
    const collision = store.moves.find((other) => other.id !== move.id && other.objeto === move.objeto && other.aplicado_em && Math.abs(daysBetween(move.aplicado_em, other.aplicado_em)) <= rules.moves.legible_days);
    if (collision) {
      move.veredito = "nao_da_para_dizer";
      move.veredito_em = today;
      move.motivo = `outro movimento no mesmo objeto em ${brDay(collision.aplicado_em)} (${collision.id})`;
      lines.push({ id: move.id, verdict: "nao_da_para_dizer", text: `${move.texto} Não dá para dizer: ${move.motivo}; os dois efeitos se misturam.` });
      continue;
    }
    if (move.tipo === "conferir_rastreamento" || move.tipo === "negativar" || move.tipo === "segurar") {
      move.veredito = "nao_da_para_dizer";
      move.veredito_em = today;
      move.motivo = "este tipo de movimento não tem um antes e depois numérico próprio; a leitura semanal mostra o efeito no conjunto";
      lines.push({ id: move.id, verdict: "nao_da_para_dizer", text: `${move.texto} Sem veredito numérico próprio; o efeito aparece na tabela da semana.` });
      continue;
    }
    const before = windowFor(readings, move.objeto, { from: addDays(move.aplicado_em, -rules.moves.window_days - rules.moves.maturity_days - 7), to: addDays(move.aplicado_em, -1) });
    const after = windowFor(readings, move.objeto, { from: addDays(move.aplicado_em, 1), to: today });
    if (!before || !after) {
      move.veredito = "nao_da_para_dizer";
      move.veredito_em = today;
      move.motivo = !before ? "não há leitura dos dias anteriores ao movimento" : "não há leitura dos dias posteriores ao movimento com a maturação de 3 dias";
      lines.push({ id: move.id, verdict: "nao_da_para_dizer", text: `${move.texto} Não dá para dizer: ${move.motivo}. Importe o export que cobre esses dias e rode a leitura semanal de novo.` });
      continue;
    }
    const a = perDay(before.row, before.period);
    const b = perDay(after.row, after.period);
    let worked = null;
    let evidence = "";
    if (move.tipo === "subir_verba") {
      worked = b.results_per_day > a.results_per_day && (allowable === null || (b.cost !== null && b.cost <= allowable * rules.hold.cost_multiple_max));
      evidence = `de ${a.results_per_day} para ${b.results_per_day} resultados por dia; custo de ${a.cost === null ? "sem resultado" : brl(a.cost)} para ${b.cost === null ? "sem resultado" : brl(b.cost)}${allowable ? ` contra ${brl(allowable)} permitidos` : ""}`;
    } else if (move.tipo === "pausar") {
      worked = b.spend_per_day <= a.spend_per_day * 0.2;
      evidence = `gasto diário da peça de ${brl(a.spend_per_day)} para ${brl(b.spend_per_day)}`;
    } else if (move.tipo === "nova_versao") {
      worked = b.ctr !== null && a.ctr !== null ? b.ctr > a.ctr : null;
      evidence = `CTR de ${a.ctr ?? "sem dado"} para ${b.ctr ?? "sem dado"}`;
    }
    move.veredito = worked === null ? "nao_da_para_dizer" : worked ? "funcionou" : "nao_funcionou";
    move.veredito_em = today;
    move.evidencia = { antes: { ...a, leitura: before.reading, periodo: before.period }, depois: { ...b, leitura: after.reading, periodo: after.period } };
    lines.push({ id: move.id, verdict: move.veredito, text: `${move.texto} ${move.veredito === "funcionou" ? "Funcionou" : move.veredito === "nao_funcionou" ? "Não funcionou" : "Não dá para dizer"}: ${evidence} (${brDay(before.period.start)} a ${brDay(before.period.end)} contra ${brDay(after.period.start)} a ${brDay(after.period.end)}, pela contagem da plataforma).` });
  }
  return lines;
}
