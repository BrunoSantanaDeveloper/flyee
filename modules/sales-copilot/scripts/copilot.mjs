#!/usr/bin/env node
// Sales copilot: the commands the member's AI and other apps run.
//   node .flyee/modules/sales-copilot/scripts/copilot.mjs <command> [options] --json
// The full interface is in references/interface.md.

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { isShortReply, parseAiAnswer, readCall, snapshot, SPEAKERS } from "./lib/engine.mjs";
import { GEMINI_KEY_NAME, KEY_NAME, modelName } from "./lib/judge.mjs";
import { liveServe, liveStart, liveStatus, liveStop } from "./lib/live.mjs";
import { checkPlaybook, DATA_DIR, initPlaybook, loadMethod, requireMethod } from "./lib/playbook.mjs";
import { chatSummary, compareOutcomes, renderReport } from "./lib/report.mjs";
import { callDir, createCall, findCall, listCalls, saveCall } from "./lib/store.mjs";
import { assignRoles, mergeTurns, parseTranscript, speakersOf } from "./lib/transcript.mjs";
import { AppError, appKey, parseArgs, readJson, readJsonStrict, round, today, toPosix, usage, projectRoot, writeFileAtomic, writeJson } from "./lib/util.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(SCRIPTS_DIR, "..");
const ROOT = projectRoot(SCRIPTS_DIR);
const MANIFEST = readJson(join(APP_DIR, "flyee.module.json"), {});
const APP = { name: MANIFEST.name ?? "sales-copilot", version: MANIFEST.version ?? "0.0.0" };
const INTERFACE_VERSION = 1;
const SCRIPT = `node ${toPosix(ROOT, join(SCRIPTS_DIR, "copilot.mjs"))}`;
const KEY_COMMAND = `npx --yes flyee@latest key set ${KEY_NAME} --browser --json`;
const ARG_SPEC = {
  flags: ["json", "practice", "no-open"],
  options: ["name", "seller", "date", "file", "batch", "minutes", "max-usd", "port", "token", "id"],
};

const rel = (path) => toPosix(ROOT, path);

function inputFile(path, what) {
  if (!path) throw usage(`Falta o arquivo de ${what}.`);
  const found = [resolve(process.cwd(), path), resolve(ROOT, path)].find((candidate) => existsSync(candidate));
  if (!found) throw new AppError("file_not_found", `Não encontrei o arquivo ${path}.`, "Confira o caminho, a partir da raiz do projeto.");
  return found;
}

function keySetup(name = KEY_NAME) {
  const credential = (MANIFEST.external_credentials ?? []).find((item) => item.env === name);
  return {
    key_url: credential?.url ?? null,
    command: KEY_COMMAND.replace(KEY_NAME, name),
    how: "Rode você mesmo o comando: ele volta na hora e abre uma página no navegador do integrante, onde ele cola a chave e clica em Salvar.",
    after: "Quando ele disser que salvou, rode check de novo e confirme openrouter_key: true.",
  };
}

/** The turns still waiting for answers: every turn without one that is not a short reply. */
function pendingTurns(call, weights) {
  return call.turns.filter((turn) => !call.answers[turn.i] && !isShortReply(turn, weights));
}

function compute(call, method) {
  return readCall({ turns: call.turns, answers: call.answers, bank: method.bank, weights: method.weights, playbook: method.playbook });
}

/** Computes the reading, writes the reading file and the member's document, and returns what the chat needs. */
function finishReading(call, method) {
  const reading = compute(call, method);
  const dir = callDir(ROOT, call.id);
  writeJson(join(dir, "leitura.json"), {
    format_version: 1,
    id: call.id,
    generated_at: new Date().toISOString(),
    weights: { from: method.weightsFrom, label: method.weights.label, source: method.weights.source, checked_on: method.weights.checked_on },
    playbook: method.playbookFrom,
    summary: reading.summary,
    steps: reading.steps.map((step) => ({ i: step.i, judged: step.judged, signal: round(step.signal), stage: step.stage, move: step.move, line: step.line, movers: step.movers, objection: step.objection, talk_share: step.talk_share, flags: step.flags })),
  });
  writeFileAtomic(join(dir, "relatorio.md"), renderReport(call, reading, method));
  call.final_signal = reading.summary.signal.final;
  saveCall(ROOT, call);
  const chat = chatSummary(call, reading);
  return {
    id: call.id,
    signal: reading.summary.signal.final,
    coverage: reading.summary.coverage,
    pending: reading.summary.pending,
    notes: reading.summary.notes.map((item) => item.text),
    files: { report: rel(join(dir, "relatorio.md")), reading: rel(join(dir, "leitura.json")), call: rel(join(dir, "call.json")) },
    say: chat.say,
    decisions: chat.decisions,
    playbook_from: method.playbookFrom,
  };
}

const answerFormat = {
  turns: [
    { i: 3, stage: "discovery", signals: { open_question: 0.9 } },
    { i: 4, stage: "discovery", facts: { problem_named: 0.9 }, scores: { tone: 1, participation: 2, urgency: 1 }, move: "size_the_impact" },
    { i: 9, stage: "price", signals: { objection: 0.9 }, objection_kind: "price", scores: { tone: 1, participation: 1, urgency: 1 }, move: "answer_price_objection" },
  ],
};

const commands = {
  check() {
    const method = loadMethod(APP_DIR, ROOT);
    const key = appKey(KEY_NAME) !== null;
    const gemini = appKey(GEMINI_KEY_NAME) !== null;
    const { problems, questions } = checkPlaybook(method.playbook, method.bank);
    return {
      app: APP,
      interface_version: INTERFACE_VERSION,
      folder: DATA_DIR,
      playbook: { from: method.playbookFrom, problems: problems.length, open_questions: questions.length },
      weights: { from: method.weightsFrom, label: method.weights.label, checked_on: method.weights.checked_on },
      modes: { review: true, practice: true, live: key },
      openrouter_key: key,
      openrouter_key_from: key ? (process.env[KEY_NAME] !== undefined ? "environment" : "flyee") : null,
      ...(key ? {} : { openrouter_setup: keySetup() }),
      live_model: modelName(),
      gemini_key: gemini,
      live_audio: gemini ? "gemini" : key ? "openrouter" : null,
      ...(gemini ? {} : { gemini_setup: { ...keySetup(GEMINI_KEY_NAME), after: "Quando ele disser que salvou, rode check de novo e confirme gemini_key: true." } }),
      calls: listCalls(ROOT).length,
    };
  },

  playbook({ positionals }) {
    const action = positionals[0];
    if (action === "init") {
      const { created, path } = initPlaybook(APP_DIR, ROOT);
      const method = loadMethod(APP_DIR, ROOT);
      const { problems, questions, waiting } = checkPlaybook(method.playbook, method.bank);
      return { created, file: rel(path), moves: method.playbook.moves.length, problems, questions, waiting, ready: !problems.length };
    }
    if (action === "check") {
      const method = loadMethod(APP_DIR, ROOT);
      const { problems, questions, waiting } = checkPlaybook(method.playbook, method.bank);
      return {
        from: method.playbookFrom,
        file: method.playbookFrom === "project" ? `${DATA_DIR}/playbook.json` : null,
        moves: (method.playbook.moves ?? []).map((move) => ({ id: move.id, title: move.title, lines: move.lines?.length ?? 0 })),
        problems,
        questions,
        waiting,
        ready: !problems.length,
      };
    }
    throw usage("Use playbook init ou playbook check.");
  },

  call({ positionals, values }) {
    const [action, target, extra] = positionals;
    if (action === "new") {
      const file = inputFile(target, "transcrição");
      const pieces = parseTranscript(readFileSync(file, "utf8"), basename(file));
      const roles = assignRoles(pieces, values.seller ?? null);
      if (!roles) {
        return {
          created: false,
          needs: "seller",
          speakers: speakersOf(pieces),
          ask: "Quem é o vendedor nesta call?",
          then: `${SCRIPT} call new ${target} --seller "<nome como aparece na transcrição>" --json`,
        };
      }
      if (values.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(values.date)) throw usage(`Data inválida: ${values.date}.`, "Use o formato AAAA-MM-DD.");
      const method = requireMethod(APP_DIR, ROOT);
      const turns = mergeTurns(pieces, roles);
      const call = createCall(ROOT, {
        name: values.name ?? basename(file).replace(/\.[^.]+$/, ""),
        mode: "review",
        judge: "ai",
        turns,
        date: values.date ?? today(),
        source: { origin: "transcrição trazida pelo integrante", file: basename(file), date: today(), call_date_from: values.date ? "informada" : "data do registro" },
      });
      return {
        created: true,
        id: call.id,
        turns: turns.length,
        speakers: speakersOf(pieces).map((speaker) => ({ ...speaker, role: roles.get(speaker.label.toLowerCase()) })),
        to_read: pendingTurns(call, method.weights).length,
        playbook_from: method.playbookFrom,
        then: `${SCRIPT} call questions ${call.id} --json`,
      };
    }
    if (action === "list") {
      return { calls: listCalls(ROOT).map((call) => ({ id: call.id, name: call.name, mode: call.mode, date: call.date, turns: call.turns.length, signal: call.final_signal ?? null, outcome: call.outcome })) };
    }

    const call = findCall(ROOT, target);
    const method = requireMethod(APP_DIR, ROOT);

    if (action === "questions") {
      const size = values.batch !== undefined ? Number(values.batch) : 30;
      if (!Number.isInteger(size) || size < 1 || size > 80) throw usage("--batch vai de 1 a 80.");
      const pending = pendingTurns(call, method.weights);
      if (!pending.length) return { id: call.id, pending: 0, done: true, then: `${SCRIPT} call report ${call.id} --json` };
      const batch = pending.slice(0, size);
      const first = batch[0].i;
      const last = batch[batch.length - 1].i;
      const say = (turn) => ({ i: turn.i, speaker: turn.speaker, ...(turn.t !== null && turn.t !== undefined ? { t: turn.t } : {}), text: turn.text });
      const write = `${DATA_DIR}/calls/${call.id}/respostas.json`;
      return {
        id: call.id,
        pending: pending.length,
        done: false,
        guide: rel(join(APP_DIR, "references", "perguntas.json")),
        how: [
          "Leia o guia: os sinais, os fatos, as notas, as etapas e os tipos de objeção, com o que conta como sim e como não.",
          "Para cada fala de `batch`, responda só com valores, no formato de `format`. Um sinal ou um fato que você não listar conta como não.",
          "Toda fala leva `stage`. Fala do cliente leva também as três notas em `scores` (níveis 0, 1 ou 2) e `move`, o id da jogada que o vendedor deveria fazer em seguida. Com `signals.objection` de 0.6 para cima, diga `objection_kind`.",
          "Um fato entra em `facts` na fala em que fica estabelecido; depois disso o app o mantém sozinho.",
          "As falas de `context` e de `optional` servem para entender a conversa. Uma fala curta de `optional` só entra se mudar a leitura, como um sim que fecha a venda.",
          "Você não calcula nada e não escreve avaliação: a conta e o documento são do app.",
        ],
        context: call.turns.slice(Math.max(0, first - 6), first).map(say),
        batch: batch.map((turn) => ({ ...say(turn), needs: turn.speaker === "client" ? ["stage", "scores", "move"] : ["stage"] })),
        optional: call.turns.filter((turn) => turn.i > first && turn.i < last && !call.answers[turn.i] && isShortReply(turn, method.weights)).map(say),
        moves: method.playbook.moves.map((move) => ({ id: move.id, title: move.title, when: move.when, not_when: move.not_when })),
        format: answerFormat,
        write,
        then: `${SCRIPT} call answer ${call.id} --file ${write} --json`,
      };
    }

    if (action === "answer") {
      const data = readJsonStrict(inputFile(values.file, "respostas"), "O arquivo de respostas");
      if (!Array.isArray(data?.turns) || !data.turns.length) throw new AppError("invalid_answer", "turns: esperada uma lista com as respostas de cada fala.", "Siga o formato que call questions devolve em format.");
      const parsed = {};
      const ignored = [];
      data.turns.forEach((raw, position) => {
        const turn = Number.isInteger(raw?.i) ? call.turns[raw.i] : null;
        if (!turn) throw new AppError("invalid_answer", `turns[${position}].i: não existe a fala ${JSON.stringify(raw?.i)} nesta call (as falas vão de 0 a ${call.turns.length - 1}).`, "Corrija o índice e repita o comando.");
        if (parsed[turn.i]) throw new AppError("invalid_answer", `turns[${position}].i: a fala ${turn.i} aparece duas vezes.`, "Deixe uma resposta por fala.");
        parsed[turn.i] = parseAiAnswer(raw, turn, method, `turns[${position}]`);
        if (parsed[turn.i].ignored.length) ignored.push({ i: turn.i, ignored: parsed[turn.i].ignored });
        delete parsed[turn.i].ignored;
      });
      Object.assign(call.answers, parsed);
      if (call.judge === "model") call.judge = "mixed";
      saveCall(ROOT, call);
      const pending = pendingTurns(call, method.weights);
      if (pending.length) return { id: call.id, saved: Object.keys(parsed).length, pending: pending.length, done: false, ignored, then: `${SCRIPT} call questions ${call.id} --json` };
      return { saved: Object.keys(parsed).length, done: true, ignored, ...finishReading(call, method) };
    }

    if (action === "report") {
      const pending = pendingTurns(call, method.weights);
      return { ...finishReading(call, method), unread_turns: pending.length, ...(pending.length ? { then: `${SCRIPT} call questions ${call.id} --json` } : {}) };
    }

    if (action === "outcome") {
      if (!["won", "lost"].includes(extra)) throw usage("Use call outcome <id> won ou call outcome <id> lost.");
      call.outcome = extra;
      call.outcome_recorded_on = today();
      saveCall(ROOT, call);
      return { id: call.id, outcome: extra };
    }
    throw usage("Use call new, list, questions, answer, report ou outcome.");
  },

  practice({ positionals, values }) {
    const [action, target] = positionals;
    const method = requireMethod(APP_DIR, ROOT);
    if (action === "start") {
      const call = createCall(ROOT, { name: values.name ?? "treino", mode: "practice", judge: "ai", turns: [], source: { origin: "treino digitado na conversa", date: today() } });
      const write = `${DATA_DIR}/calls/${call.id}/rodada.json`;
      return {
        id: call.id,
        guide: rel(join(APP_DIR, "references", "perguntas.json")),
        how: [
          "Você faz o cliente; o integrante escreve as falas do vendedor na conversa.",
          "A cada rodada, grave em `write` a fala do vendedor e a sua resposta como cliente, cada uma com as respostas do guia, no formato de `format`, e rode `then`.",
          "Mostre ao integrante só o que `say` trouxer, e continue como cliente.",
        ],
        moves: method.playbook.moves.map((move) => ({ id: move.id, title: move.title, when: move.when, not_when: move.not_when })),
        format: {
          turns: [
            { speaker: "seller", text: "Me conta como funciona hoje o seu atendimento.", stage: "discovery", signals: { open_question: 0.9 } },
            { speaker: "client", text: "Hoje é tudo por mensagem, e eu respondo quando dá.", stage: "discovery", facts: { situation_known: 0.9 }, scores: { tone: 1, participation: 2, urgency: 1 }, move: "size_the_impact" },
          ],
        },
        write,
        then: `${SCRIPT} practice add ${call.id} --file ${write} --json`,
        end: `${SCRIPT} practice end ${call.id} --json`,
      };
    }
    const call = findCall(ROOT, target);
    if (call.mode !== "practice") throw new AppError("usage", "Esta call não é um treino.", "Use call questions e call answer numa call trazida por transcrição.");
    if (action === "add") {
      const data = readJsonStrict(inputFile(values.file, "rodada"), "O arquivo da rodada");
      if (!Array.isArray(data?.turns) || !data.turns.length) throw new AppError("invalid_answer", "turns: esperada uma lista com as falas da rodada.", "Siga o formato que practice start devolve em format.");
      const turns = [...call.turns];
      const answers = { ...call.answers };
      data.turns.forEach((raw, position) => {
        const path = `turns[${position}]`;
        if (!SPEAKERS.includes(raw?.speaker)) throw new AppError("invalid_answer", `${path}.speaker: esperado seller ou client.`, "Corrija o arquivo e repita o comando.");
        if (typeof raw.text !== "string" || !raw.text.trim()) throw new AppError("invalid_answer", `${path}.text: falta a fala.`, "Corrija o arquivo e repita o comando.");
        const turn = { i: turns.length, speaker: raw.speaker, name: raw.speaker === "seller" ? "Vendedor" : "Cliente", text: raw.text.trim(), t: null };
        const { speaker, text, ...given } = raw;
        const parsed = parseAiAnswer(given, turn, method, path);
        delete parsed.ignored;
        turns.push(turn);
        answers[turn.i] = parsed;
      });
      call.turns = turns;
      call.answers = answers;
      saveCall(ROOT, call);
      const reading = compute(call, method);
      const now = snapshot(reading, call.turns, method.playbook);
      const say = [`Sinal: ${String(now.signal).replace(".", ",")} de 100 (${now.change >= 0 ? "+" : ""}${String(now.change).replace(".", ",")} nesta rodada).`];
      if (now.objection) say.push(`Objeção em aberto: ${now.objection.label}.`);
      if (now.move) say.push(`Jogada indicada: ${now.move.title}.${now.move.line ? ` Uma frase: "${now.move.line}"` : ""}`);
      else if (now.next_ask) say.push(`Falta no roteiro: ${now.next_ask.label}. Uma pergunta: "${now.next_ask.ask}"`);
      return { id: call.id, turns: call.turns.length, now, say };
    }
    if (action === "end") {
      if (!call.turns.length) throw new AppError("usage", "O treino ainda não tem falas.", "Grave uma rodada com practice add antes de encerrar.");
      return finishReading(call, method);
    }
    throw usage("Use practice start, add ou end.");
  },

  summary() {
    const method = loadMethod(APP_DIR, ROOT);
    const calls = listCalls(ROOT).filter((call) => call.mode !== "practice");
    return {
      calls: calls.length,
      with_outcome: calls.filter((call) => call.outcome).length,
      comparison: compareOutcomes(calls, method.weights.thresholds.min_sample_calls),
      weights: { label: method.weights.label, source: method.weights.source, checked_on: method.weights.checked_on },
    };
  },

  async live({ positionals, values }) {
    const action = positionals[0];
    const context = { root: ROOT, appDir: APP_DIR, script: join(SCRIPTS_DIR, "copilot.mjs"), scriptCommand: SCRIPT, keySetup, finishReading };
    if (action === "start") return liveStart(context, values);
    if (action === "status") return liveStatus(context);
    if (action === "stop") return liveStop(context);
    if (action === "serve") return liveServe(context, values);
    throw usage("Use live start, live status ou live stop.");
  },

  help() {
    return {
      app: APP,
      interface_version: INTERFACE_VERSION,
      commands: [
        "check",
        "playbook init | playbook check",
        "call new <transcrição> [--seller <nome>] [--name <nome>] [--date AAAA-MM-DD]",
        "call questions <id> [--batch 30] | call answer <id> --file <respostas.json>",
        "call report <id> | call outcome <id> won|lost | call list",
        "practice start [--name <nome>] | practice add <id> --file <rodada.json> | practice end <id>",
        "live start [--name <nome>] [--minutes 120] [--max-usd 0.50] | live status | live stop",
        "summary",
      ],
      note: "Todo comando aceita --json. O id de uma call pode ser last, para a mais recente.",
    };
  },
};

async function main() {
  const [command = "help", ...rest] = process.argv.slice(2);
  const json = rest.includes("--json");
  try {
    const handler = commands[command];
    if (!handler) throw usage(`Comando desconhecido: ${command}.`);
    const result = await handler(parseArgs(rest, ARG_SPEC));
    if (result === undefined) return; // a command that keeps running (the live server) prints by itself
    const output = { ok: true, ...result };
    if (json) process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    else process.stdout.write(`${(output.say ?? [JSON.stringify(output, null, 2)]).join("\n")}\n`);
  } catch (error) {
    const known = error instanceof AppError;
    const failure = {
      ok: false,
      error: {
        code: known ? error.code : "unexpected",
        message: known ? error.message : `Erro inesperado: ${error?.message ?? error}`,
        fix: known ? error.fix : "Repita o comando. Se o erro continuar, rode npx --yes flyee@latest doctor.",
        ...(known ? error.extra : {}),
      },
    };
    if (json) process.stdout.write(`${JSON.stringify(failure, null, 2)}\n`);
    else process.stderr.write(`${failure.error.message}${failure.error.fix ? `\n${failure.error.fix}` : ""}\n`);
    process.exitCode = known && error.code === "usage" ? 2 : 1;
  }
}

main();
