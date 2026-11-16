// The reading of a call: pure arithmetic over typed answers, no I/O.
// Whoever answers (the member's AI or a decisions model) only gives values per turn;
// the signal, the open objection, the roadmap and every note are computed here.

import { AppError, clamp, round, wordCount } from "./util.mjs";

export const SPEAKERS = ["seller", "client"];

const ids = (list) => list.map((item) => item.id);
const excerpt = (text, max = 160) => {
  const clean = String(text).replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
};

/** A turn nobody has to judge: two or three words with no question, after the first turn. */
export function isShortReply(turn, weights) {
  return turn.i > 0 && wordCount(turn.text) <= weights.thresholds.short_reply_words && !String(turn.text).includes("?");
}

function probability(value, path) {
  if (value === true) return 1;
  if (value === false || value === null || value === undefined) return 0;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1) return value;
  throw new AppError("invalid_answer", `${path}: esperado true, false ou um número de 0 a 1; veio ${JSON.stringify(value)}.`, "Corrija esse campo no arquivo de respostas e repita o comando.");
}

/**
 * One turn's answer as the member's AI writes it (sparse: a signal or a fact left out means "no"),
 * checked field by field. A wrong field is refused with its path; nothing is guessed.
 */
export function parseAiAnswer(raw, turn, { bank, playbook, weights }, path = `turns[${turn.i}]`) {
  const fail = (field, message) => {
    throw new AppError("invalid_answer", `${path}.${field}: ${message}`, "Corrija esse campo no arquivo de respostas e repita o comando.");
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AppError("invalid_answer", `${path}: esperado um objeto com as respostas da fala ${turn.i}.`, "Corrija o arquivo de respostas e repita o comando.");
  const known = new Set(["i", "stage", "signals", "facts", "scores", "objection_kind", "move"]);
  for (const key of Object.keys(raw)) if (!known.has(key)) fail(key, `campo desconhecido. Os campos são: ${[...known].join(", ")}.`);

  const stages = ids(bank.stages);
  if (!stages.includes(raw.stage)) fail("stage", `esperado um destes: ${stages.join(", ")}; veio ${JSON.stringify(raw.stage)}.`);

  const answer = { stage: raw.stage, signals: {}, facts: {}, scores: {}, objection_kind: null, move: null, ignored: [] };
  const section = (name, list) => {
    const value = raw[name] ?? {};
    if (typeof value !== "object" || Array.isArray(value)) fail(name, "esperado um objeto com o id e o valor de cada item.");
    const valid = new Map(list.map((item) => [item.id, item]));
    for (const [id, given] of Object.entries(value)) {
      if (!valid.has(id)) fail(`${name}.${id}`, `id desconhecido. Os ids são: ${[...valid.keys()].join(", ")}.`);
      const item = valid.get(id);
      const p = probability(given, `${path}.${name}.${id}`);
      if (item.who && item.who !== "any" && item.who !== turn.speaker) {
        if (p > 0) answer.ignored.push(id);
        continue;
      }
      answer[name][id] = p;
    }
  };
  section("signals", bank.signals);
  section("facts", bank.facts);

  const scores = raw.scores ?? {};
  if (typeof scores !== "object" || Array.isArray(scores)) fail("scores", "esperado um objeto com o id e o nível de cada nota.");
  const scoreIds = ids(bank.scores);
  for (const id of Object.keys(scores)) if (!scoreIds.includes(id)) fail(`scores.${id}`, `id desconhecido. Os ids são: ${scoreIds.join(", ")}.`);
  for (const score of bank.scores) {
    const given = scores[score.id];
    const top = score.levels.length - 1;
    if (given === undefined || given === null) {
      if (turn.speaker === "client") fail(`scores.${score.id}`, `falta a nota. Numa fala do cliente, dê um nível de 0 a ${top}.`);
      continue;
    }
    if (!Number.isInteger(given) || given < 0 || given > top) fail(`scores.${score.id}`, `esperado um inteiro de 0 a ${top}; veio ${JSON.stringify(given)}.`);
    if (score.who === "client" && turn.speaker !== "client") continue;
    answer.scores[score.id] = given;
  }

  const kinds = ids(bank.objection_kinds);
  if (raw.objection_kind !== undefined && raw.objection_kind !== null) {
    if (!kinds.includes(raw.objection_kind)) fail("objection_kind", `esperado um destes: ${kinds.join(", ")}; veio ${JSON.stringify(raw.objection_kind)}.`);
    answer.objection_kind = raw.objection_kind;
  }
  if ((answer.signals.objection ?? 0) >= weights.thresholds.objection_open && (!answer.objection_kind || answer.objection_kind === "none")) {
    fail("objection_kind", `a fala levanta uma objeção: diga de que tipo (${kinds.filter((kind) => kind !== "none").join(", ")}).`);
  }

  const moves = ids(playbook.moves);
  if (raw.move !== undefined && raw.move !== null) {
    if (!moves.includes(raw.move)) fail("move", `esperado o id de uma jogada do playbook (${moves.join(", ")}); veio ${JSON.stringify(raw.move)}.`);
    answer.move = raw.move;
  } else if (turn.speaker === "client") {
    fail("move", "falta a jogada que o vendedor deveria fazer depois desta fala do cliente.");
  }
  return answer;
}

/** The answers of a decisions model for one turn (see lib/judge.mjs for the question names). A refusal or a missing answer counts as not answered. */
export function parseModelAnswer(decisions, turn, { bank, playbook }) {
  const answer = { stage: null, signals: {}, facts: {}, scores: {}, objection_kind: null, move: null, ignored: [], unanswered: 0 };
  const get = (name, type) => {
    const found = decisions?.[name];
    if (!found || found.type !== type) {
      answer.unanswered += 1;
      return null;
    }
    return found;
  };
  const number = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  for (const signal of bank.signals) {
    if (signal.who !== "any" && signal.who !== turn.speaker) continue;
    const p = number(get(`s_${signal.id}`, "noul")?.noul);
    if (p !== null) answer.signals[signal.id] = clamp(p);
  }
  for (const fact of bank.facts) {
    const found = decisions?.[`f_${fact.id}`];
    if (found === undefined) continue; // not asked: the fact was already established
    const p = number(get(`f_${fact.id}`, "noul")?.noul);
    if (p !== null) answer.facts[fact.id] = clamp(p);
  }
  for (const score of bank.scores) {
    if (score.who === "client" && turn.speaker !== "client") continue;
    const level = number(get(`c_${score.id}`, "score")?.score);
    if (level !== null) answer.scores[score.id] = clamp(level, 0, score.levels.length - 1);
  }
  const choice = (name, valid) => {
    const found = get(name, "choice");
    if (!found || !valid.includes(found.choice)) return [null, 0];
    return [found.choice, number(found.confidence) ?? 1];
  };
  [answer.stage, answer.stage_confidence] = choice("stage", ids(bank.stages));
  if (turn.speaker === "client") [answer.objection_kind, answer.kind_confidence] = choice("objection_kind", ids(bank.objection_kinds));
  [answer.move, answer.move_confidence] = choice("move", ids(playbook.moves));
  return answer;
}

function labelOf(id, bank, weights) {
  return (
    weights.labels?.[id] ??
    bank.signals.find((item) => item.id === id)?.label ??
    bank.facts.find((item) => item.id === id)?.label ??
    bank.scores.find((item) => item.id === id)?.label ??
    id
  );
}

/**
 * Reads the call turn by turn. `answers` maps a turn index to a parsed answer; a turn
 * without one keeps the previous reading and is counted as not judged.
 */
export function readCall({ turns, answers, bank, weights, playbook }) {
  const thr = weights.thresholds;
  const stageLabel = Object.fromEntries(bank.stages.map((stage) => [stage.id, stage.label]));
  const kindLabel = Object.fromEntries(bank.objection_kinds.map((kind) => [kind.id, kind.label]));
  const movesById = new Map(playbook.moves.map((move) => [move.id, move]));

  const durable = {}; // fact id → turn index where it was established
  const seen = {}; // signal id → first turn index where it showed
  const stageSeen = {}; // stage id → first turn index
  const lastScore = {}; // score id → 0..1
  const objections = [];
  const monologues = [];
  const moveEpisodes = {}; // move id → how many separate times it was suggested
  const steps = [];
  let open = null;
  let value = weights.start;
  let stage = null;
  let previous = null;
  let sellerWords = 0;
  let clientWords = 0;
  let openQuestions = 0;
  let lastMove = null;
  let lastLine = null;

  const closeObjection = (i, how) => {
    open.closed_at = i;
    open.how = how;
    open = null;
  };

  for (const turn of turns) {
    const i = turn.i;
    const words = wordCount(turn.text);
    if (turn.speaker === "seller") sellerWords += words;
    else clientWords += words;
    const share = sellerWords + clientWords > 0 ? sellerWords / (sellerWords + clientWords) : 0;
    if (turn.speaker === "seller" && words > thr.monologue_words) monologues.push({ i, t: turn.t ?? null, words });

    const answer = answers[i] ?? null;
    const flags = [];
    if (turn.speaker === "seller" && words > thr.monologue_words) flags.push("monologue");

    if (!answer) {
      if (open && i - open.touched > thr.objection_max_age_turns) closeObjection(i, "left");
      steps.push({
        ...(previous ?? { signal: value, instant: null, stage, contributions: {}, base: null, move: null, line: null }),
        i,
        judged: false,
        delta: 0,
        signal: value,
        short: isShortReply(turn, weights),
        movers: [],
        objection: open ? { kind: open.kind, since: open.opened_at } : null,
        talk_share: round(share, 2),
        flags,
      });
      previous = steps[steps.length - 1];
      continue;
    }

    if (answer.stage) stage = answer.stage;
    if (stage && stageSeen[stage] === undefined) stageSeen[stage] = i;

    const signal = (id) => answer.signals[id] ?? 0;
    // what closes an open objection: the client agrees, shows interest, commits, or accepts the next step
    const accepts = () => Math.max(signal("agreement"), signal("interest"), signal("commitment"), signal("step_accepted"));
    for (const item of bank.signals) if (signal(item.id) >= thr.on && seen[item.id] === undefined) seen[item.id] = i;
    if (signal("open_question") >= thr.on) openQuestions += 1;

    for (const fact of bank.facts) {
      if (durable[fact.id] === undefined && (answer.facts[fact.id] ?? 0) >= thr.fact) durable[fact.id] = i;
    }
    if (durable.next_step_set === undefined && signal("step_accepted") >= thr.fact) durable.next_step_set = i;

    for (const score of bank.scores) {
      const level = answer.scores[score.id];
      if (level !== undefined && level !== null) lastScore[score.id] = level / (score.levels.length - 1);
    }

    if (turn.speaker === "client") {
      if (signal("objection") >= thr.objection_open) {
        const confident = answer.objection_kind && answer.objection_kind !== "none" && (answer.kind_confidence ?? 1) >= thr.kind_min_confidence;
        const kind = confident ? answer.objection_kind : null;
        // a doubt of another kind: the one before ends here, answered only if this same turn accepts the answer
        if (open && kind && open.kind && kind !== open.kind) closeObjection(i, accepts() >= thr.objection_clear ? "resolved" : "left");
        if (!open) {
          open = { kind, opened_at: i, t: turn.t ?? null, text: excerpt(turn.text), touched: i, closed_at: null, how: "open" };
          objections.push(open);
        } else {
          open.touched = i;
          if (kind && !open.kind) open.kind = kind;
        }
      } else if (open && accepts() >= thr.objection_clear) {
        closeObjection(i, "resolved");
      }
    }
    if (open && i - open.touched > thr.objection_max_age_turns) closeObjection(i, "left");

    const talking = steps.length + 1 >= thr.talk_share_min_turns ? clamp((share - thr.talk_share_warn) / (thr.talk_share_max - thr.talk_share_warn)) : 0;

    const contributions = {};
    for (const [id, weight] of Object.entries(weights.weights)) {
      let x = 0;
      if (weight.kind === "signal") x = signal(id);
      else if (weight.kind === "fact") x = durable[id] !== undefined ? 1 : 0; // a fact counts once it is established, never by halves
      else if (weight.kind === "score") x = ((lastScore[id] ?? 0.5) - 0.5) * 2;
      else if (id === "objection_open") x = open ? 1 : 0;
      else if (id === "seller_talking_too_much") x = talking;
      contributions[id] = weight.points * x;
    }
    const base = weights.base_by_stage[stage] ?? weights.start;
    const instant = clamp(base + Object.values(contributions).reduce((sum, part) => sum + part, 0), weights.floor, weights.ceiling);
    const before = value;
    value = weights.smoothing * instant + (1 - weights.smoothing) * value;

    const movers = [];
    if (previous?.judged !== undefined && previous.base !== null && previous.base !== undefined) {
      const stageShift = base - previous.base;
      if (Math.abs(stageShift) >= 0.5) movers.push({ id: "stage", label: `Etapa: ${stageLabel[stage] ?? stage}`, points: round(stageShift) });
      for (const [id, now] of Object.entries(contributions)) {
        const shift = now - (previous.contributions[id] ?? 0);
        if (Math.abs(shift) >= 0.5) movers.push({ id, label: labelOf(id, bank, weights), points: round(shift) });
      }
      movers.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
      movers.splice(3);
    }

    let move = null;
    let line = null;
    if (answer.move && movesById.has(answer.move) && (answer.move_confidence ?? 1) >= thr.move_min_confidence) {
      move = answer.move;
      if (move !== lastMove) {
        const lines = movesById.get(move).lines ?? [];
        moveEpisodes[move] = (moveEpisodes[move] ?? 0) + 1;
        lastLine = lines.length ? lines[(moveEpisodes[move] - 1) % lines.length] : null;
        lastMove = move;
      }
      line = lastLine;
    } else {
      lastMove = null;
    }

    const step = {
      i,
      judged: true,
      short: false,
      signal: value,
      delta: value - before,
      shift: previous?.instant !== null && previous?.instant !== undefined ? instant - previous.instant : 0,
      instant,
      base,
      stage,
      contributions,
      movers,
      objection: open ? { kind: open.kind, since: open.opened_at } : null,
      move,
      line,
      talk_share: round(share, 2),
      flags,
    };
    steps.push(step);
    previous = step;
  }

  // ---- what the whole call shows ----
  const judged = steps.filter((step) => step.judged);
  const stageTimeline = [];
  for (const step of judged) {
    if (step.stage && stageTimeline[stageTimeline.length - 1]?.stage !== step.stage) {
      stageTimeline.push({ stage: step.stage, label: stageLabel[step.stage], from_turn: step.i, t: turns[step.i].t ?? null });
    }
  }

  const checkDone = (check) => {
    if (check.fact) return durable[check.fact] ?? null;
    if (check.seen) return seen[check.seen] ?? null;
    if (check.stage_seen) {
      const found = check.stage_seen.map((id) => stageSeen[id]).filter((index) => index !== undefined);
      return found.length ? Math.min(...found) : null;
    }
    if (check.objections_clear) {
      if (stageSeen.price === undefined || objections.some((objection) => objection.how !== "resolved")) return null;
      return objections.length ? Math.max(...objections.map((objection) => objection.closed_at)) : stageSeen.price;
    }
    return null;
  };
  const roadmap = (playbook.roadmap ?? []).map((part) => ({
    id: part.id,
    title: part.title,
    goal: part.goal,
    checks: part.checks.map((check) => {
      const at = checkDone(check);
      return { label: check.label, done: at !== null, at_turn: at, ask: check.ask };
    }),
  }));
  const pending = roadmap.flatMap((part) => part.checks.filter((check) => !check.done).map((check) => ({ step: part.title, label: check.label, ask: check.ask })));

  // a moment is a turn whose own reading moved: its movers add up to the points shown
  const moments = judged
    .filter((step) => Math.abs(step.shift) >= 3)
    .map((step) => ({
      i: step.i,
      t: turns[step.i].t ?? null,
      speaker: turns[step.i].speaker,
      text: excerpt(turns[step.i].text),
      points: round(step.shift),
      movers: step.movers.filter((mover) => Math.sign(mover.points) === Math.sign(step.shift)),
      move: step.move ? { id: step.move, title: movesById.get(step.move).title, line: step.line } : null,
    }));
  const drops = moments.filter((moment) => moment.points < 0).sort((a, b) => a.points - b.points).slice(0, 3);
  const rises = moments.filter((moment) => moment.points > 0).sort((a, b) => b.points - a.points).slice(0, 3);

  const share = sellerWords + clientWords > 0 ? sellerWords / (sellerWords + clientWords) : 0;
  const notes = [];
  const note = (code, text, at = null) => notes.push({ code, text, at_turn: at });
  if (stageSeen.price !== undefined && (durable.impact_sized === undefined || durable.impact_sized > stageSeen.price)) {
    note("price_before_impact", "O preço entrou na conversa antes de o cliente dizer quanto o problema custa.", stageSeen.price);
  }
  const left = objections.filter((objection) => objection.how !== "resolved");
  for (const objection of left) {
    note("objection_left", `A objeção de ${kindLabel[objection.kind] ?? "tipo não identificado"} ficou sem resposta que o cliente aceitasse.`, objection.opened_at);
  }
  if (judged.length && durable.next_step_set === undefined && !(seen.commitment !== undefined)) note("no_next_step", "A call terminou sem um próximo passo aceito pelo cliente.");
  if (judged.length && durable.decider_known === undefined && stageSeen.price !== undefined) note("decider_unknown", "O preço foi dito sem saber quem decide a compra.");
  if (judged.length >= thr.talk_share_min_turns && share >= thr.talk_share_warn) {
    note("seller_talked_most", `O vendedor falou ${Math.round(share * 100)} por cento das palavras. Acima de ${Math.round(thr.talk_share_warn * 100)} por cento o sinal perde pontos.`);
  }
  if (monologues.length) note("monologues", monologues.length === 1 ? `Uma fala do vendedor passou de ${thr.monologue_words} palavras seguidas.` : `${monologues.length} falas do vendedor passaram de ${thr.monologue_words} palavras seguidas.`, monologues[0].i);

  const curve = steps.map((step) => round(step.signal));
  const summary = {
    signal: {
      final: curve.length ? curve[curve.length - 1] : weights.start,
      start: weights.start,
      min: curve.length ? Math.min(...curve) : weights.start,
      max: curve.length ? Math.max(...curve) : weights.start,
      curve,
      label: weights.label,
      source: weights.source,
      checked_on: weights.checked_on,
    },
    coverage: {
      turns: turns.length,
      judged: judged.length,
      short: steps.filter((step) => !step.judged && step.short).length,
      not_judged: steps.filter((step) => !step.judged && !step.short).length,
    },
    stage: stage ? { id: stage, label: stageLabel[stage] } : null,
    stages: stageTimeline,
    facts: [...bank.facts.map((fact) => fact.id), "next_step_set"].map((id) => ({ id, label: labelOf(id, bank, weights), at_turn: durable[id] ?? null })),
    roadmap,
    pending,
    objections: objections.map((objection) => ({
      kind: objection.kind,
      label: kindLabel[objection.kind] ?? "tipo não identificado",
      opened_at: objection.opened_at,
      t: objection.t,
      text: objection.text,
      closed_at: objection.closed_at,
      how: objection.how,
    })),
    talk: { seller_share: round(share, 2), seller_words: sellerWords, client_words: clientWords, open_questions: openQuestions, monologues },
    drops,
    rises,
    notes,
  };
  return { steps, summary };
}

/** What a live or practice screen needs after the latest turn. */
export function snapshot({ steps, summary }, turns, playbook) {
  const last = steps[steps.length - 1] ?? null;
  const move = last?.move ? playbook.moves.find((item) => item.id === last.move) : null;
  const openObjection = summary.objections.find((objection) => objection.how === "open") ?? null;
  return {
    turns: turns.length,
    signal: summary.signal.final,
    curve: summary.signal.curve,
    change: last?.judged ? round(last.delta) : 0,
    movers: last?.movers ?? [],
    stage: summary.stage,
    objection: openObjection ? { label: openObjection.label, since_turn: openObjection.opened_at, text: openObjection.text } : null,
    move: move ? { id: move.id, title: move.title, explain: move.explain, line: last.line } : null,
    next_ask: summary.pending[0] ?? null,
    roadmap: summary.roadmap.map((part) => ({ title: part.title, checks: part.checks.map((check) => ({ label: check.label, done: check.done })) })),
    talk_share: summary.talk.seller_share,
    flags: last?.flags ?? [],
  };
}
