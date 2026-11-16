// The method a call is read with: the question bank and the weights the app ships,
// and the playbook of the member's business, which lives in the project folder.

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { AppError, readJson, readJsonStrict } from "./util.mjs";

export const DATA_DIR = "copiloto-de-vendas";

const BUSINESS = [
  {
    key: "offer",
    kind: "find",
    ask: "O que você vende, em uma frase?",
    how: "Procure no projeto antes de perguntar: o site, o que outros apps gravaram, o pedido do integrante. Diga de onde veio.",
  },
  {
    key: "price",
    kind: "fact",
    ask: "Qual é o preço que você diz na call, e em que condições?",
    how: "Só o integrante sabe: pergunte sem propor um valor. Se ele não souber ou não quiser dizer, grave unknown: true e as frases de preço ficam sem número.",
  },
  {
    key: "next_step",
    kind: "decision",
    ask: "No fim de uma call sem decisão, o próximo passo que você propõe é uma segunda conversa com dia e hora marcados?",
    suggestion: "Uma segunda conversa com dia e hora marcados.",
    how: "Um sim aceita a sugestão.",
  },
  {
    key: "alternatives",
    kind: "fact",
    ask: "Com o que os clientes costumam comparar você: outro fornecedor, fazer por conta própria, não fazer nada?",
    how: "Só o integrante sabe: pergunte sem propor a resposta. Um não sei fecha a pergunta com unknown: true.",
  },
];

/** Loads the bank, the weights (the project's copy wins) and the playbook (the project's, or the model). */
export function loadMethod(appDir, root) {
  const bank = readJson(join(appDir, "references", "perguntas.json"));
  const defaults = readJson(join(appDir, "references", "pesos.json"));
  if (!bank || !defaults) throw new AppError("unexpected", "Os arquivos do app estão incompletos.", "Rode npx --yes flyee@latest update e repita.");
  const ownWeights = join(root, DATA_DIR, "pesos.json");
  let weights = defaults;
  let weightsFrom = "app";
  if (existsSync(ownWeights)) {
    const own = readJsonStrict(ownWeights, "O arquivo de pesos do projeto");
    weights = {
      ...defaults,
      ...own,
      base_by_stage: { ...defaults.base_by_stage, ...(own.base_by_stage ?? {}) },
      weights: { ...defaults.weights, ...(own.weights ?? {}) },
      labels: { ...defaults.labels, ...(own.labels ?? {}) },
      thresholds: { ...defaults.thresholds, ...(own.thresholds ?? {}) },
    };
    weightsFrom = "project";
    for (const [id, weight] of Object.entries(weights.weights)) {
      if (!weight || typeof weight.points !== "number" || !Number.isFinite(weight.points) || !defaults.weights[id]) {
        throw new AppError("invalid_weights", `${DATA_DIR}/pesos.json: weights.${id} precisa ser um peso que o app conhece, com points numérico.`, "Corrija o arquivo, ou apague-o para voltar aos pesos do app.");
      }
      weights.weights[id] = { ...defaults.weights[id], points: weight.points };
    }
  }
  const ownPlaybook = join(root, DATA_DIR, "playbook.json");
  const own = existsSync(ownPlaybook);
  const playbook = own ? readJsonStrict(ownPlaybook, "O playbook do projeto") : readJson(join(appDir, "references", "playbook-modelo.json"));
  return { bank, weights, weightsFrom, playbook, playbookFrom: own ? "project" : "model" };
}

/** Copies the model into the project, once. */
export function initPlaybook(appDir, root) {
  const target = join(root, DATA_DIR, "playbook.json");
  if (existsSync(target)) return { created: false, path: target };
  mkdirSync(join(root, DATA_DIR), { recursive: true });
  copyFileSync(join(appDir, "references", "playbook-modelo.json"), target);
  return { created: true, path: target };
}

const isText = (value) => typeof value === "string" && value.trim().length > 0;
const numbersIn = (text) => String(text).match(/\d+(?:[.,]\d+)*/g) ?? [];

/**
 * Checks the playbook: its shape, that every id it names exists, and that no line carries a
 * number the member did not give (a price in a sentence has to be in `business`).
 */
export function checkPlaybook(playbook, bank) {
  const problems = [];
  const problem = (path, message) => problems.push({ path, message });
  if (!playbook || typeof playbook !== "object") return { problems: [{ path: "playbook", message: "esperado um objeto." }], questions: [], waiting: [] };

  const moves = Array.isArray(playbook.moves) ? playbook.moves : [];
  if (!moves.length) problem("moves", "o playbook precisa de pelo menos uma jogada.");
  const seen = new Set();
  moves.forEach((move, index) => {
    const path = `moves[${index}]`;
    if (!isText(move?.id) || !/^[a-z][a-z0-9_]{1,59}$/.test(move.id)) problem(`${path}.id`, "esperado um id em minúsculas, com letras, números e sublinhado.");
    else if (seen.has(move.id)) problem(`${path}.id`, `o id ${move.id} aparece duas vezes.`);
    else seen.add(move.id);
    for (const field of ["title", "explain", "when", "not_when"]) if (!isText(move?.[field])) problem(`${path}.${field}`, "falta o texto.");
    if (!Array.isArray(move?.lines) || !move.lines.length || !move.lines.every(isText)) problem(`${path}.lines`, "esperada uma lista com pelo menos uma frase.");
  });

  const facts = new Set([...bank.facts.map((fact) => fact.id), "next_step_set"]);
  const signals = new Set(bank.signals.map((signal) => signal.id));
  const stages = new Set(bank.stages.map((stage) => stage.id));
  (Array.isArray(playbook.roadmap) ? playbook.roadmap : []).forEach((part, index) => {
    const path = `roadmap[${index}]`;
    if (!isText(part?.title)) problem(`${path}.title`, "falta o título.");
    (Array.isArray(part?.checks) ? part.checks : []).forEach((check, at) => {
      const where = `${path}.checks[${at}]`;
      if (!isText(check?.label)) problem(`${where}.label`, "falta o nome do item.");
      if (!isText(check?.ask)) problem(`${where}.ask`, "falta a pergunta sugerida.");
      const kinds = ["fact", "seen", "stage_seen", "objections_clear"].filter((kind) => check?.[kind] !== undefined);
      if (kinds.length !== 1) problem(where, "cada item usa exatamente um destes: fact, seen, stage_seen, objections_clear.");
      if (check?.fact !== undefined && !facts.has(check.fact)) problem(`${where}.fact`, `fato desconhecido: ${check.fact}.`);
      if (check?.seen !== undefined && !signals.has(check.seen)) problem(`${where}.seen`, `sinal desconhecido: ${check.seen}.`);
      if (check?.stage_seen !== undefined && !(Array.isArray(check.stage_seen) && check.stage_seen.every((stage) => stages.has(stage)))) problem(`${where}.stage_seen`, "esperada uma lista de etapas conhecidas.");
    });
  });

  const business = playbook.business ?? {};
  const given = BUSINESS.map((item) => business[item.key]?.value).filter(isText).join(" ");
  const allowed = new Set(numbersIn(given));
  const checkNumbers = (text, path) => {
    for (const number of numbersIn(text ?? "")) {
      if (!allowed.has(number)) problem(path, `a frase traz o número ${number}, que não está em business. Um número só entra numa frase quando o integrante o informou.`);
    }
  };
  moves.forEach((move, index) => (Array.isArray(move?.lines) ? move.lines : []).forEach((line, at) => checkNumbers(line, `moves[${index}].lines[${at}]`)));
  (Array.isArray(playbook.roadmap) ? playbook.roadmap : []).forEach((part, index) =>
    (Array.isArray(part?.checks) ? part.checks : []).forEach((check, at) => checkNumbers(check?.ask, `roadmap[${index}].checks[${at}].ask`)),
  );

  for (const item of BUSINESS) {
    const entry = business[item.key];
    if (isText(entry?.value) && !isText(entry?.origin)) problem(`business.${item.key}.origin`, "falta de onde veio a informação (o integrante disse, o site, um arquivo do projeto).");
  }

  const open = BUSINESS.filter((item) => !isText(business[item.key]?.value) && business[item.key]?.unknown !== true);
  const questions = open.slice(0, 4).map(({ key, kind, ask, suggestion, how }) => ({ key, kind, ask, ...(suggestion ? { suggestion } : {}), how, write: `business.${key}` }));
  return { problems, questions, waiting: [] };
}

/** The method ready to read a call; a playbook with a problem is refused with the first one. */
export function requireMethod(appDir, root) {
  const method = loadMethod(appDir, root);
  const { problems } = checkPlaybook(method.playbook, method.bank);
  if (problems.length) {
    throw new AppError(
      "invalid_playbook",
      `O playbook tem um problema em ${problems[0].path}: ${problems[0].message}`,
      `Corrija ${DATA_DIR}/playbook.json e rode playbook check. Ao todo são ${problems.length} problema(s).`,
      { problems },
    );
  }
  return method;
}
