// The live call: a page on 127.0.0.1 that receives each turn (typed, or as audio it has
// transcribed), asks the decisions model and shows the reading. One call at a time per project.
// The server ends by itself: when the member ends the call, on `live stop`, or at the time limit.

import { spawn } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { closeSync, openSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";

import { isShortReply, parseModelAnswer, readCall, snapshot, SPEAKERS } from "./engine.mjs";
import { askModel, buildQuestions, buildState, GEMINI_KEY_NAME, KEY_NAME, modelName, sttModelName, transcribe, transcribeWithGemini } from "./judge.mjs";
import { DATA_DIR, requireMethod } from "./playbook.mjs";
import { callDir, createCall, findCall, saveCall } from "./store.mjs";
import { AppError, appKey, decimal, readJson, round, toPosix, usage, writeJson } from "./util.mjs";

const HOST = "127.0.0.1";
const MAX_BODY = 12 * 1024 * 1024; // one stretch of speech, base64
const MAX_TURNS = 1500;
const STOP_JUDGING = new Set(["invalid_key", "no_credit", "model_not_found", "model_refused_request"]);
const GEMINI_GIVE_UP = new Set(["gemini_invalid_key", "gemini_permission", "gemini_model_not_found"]);
const AUDIO_FORMATS = new Set(["webm", "m4a", "mp3", "wav", "ogg"]);

const stateFile = (root) => join(root, DATA_DIR, ".ao-vivo.json");

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function readState(root) {
  const state = readJson(stateFile(root));
  if (!state?.pid || !state.port || !state.token) return null;
  if (!alive(state.pid)) {
    rmSync(stateFile(root), { force: true });
    return null;
  }
  return state;
}

const urlOf = (state) => `http://${HOST}:${state.port}/c/${state.token}/`;

async function post(state, path) {
  const response = await fetch(`${urlOf(state)}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(20_000) });
  return response.json();
}

function openBrowser(url) {
  try {
    const [file, args] =
      process.platform === "win32"
        ? [join(process.env.SystemRoot ?? "C:\\Windows", "System32", "rundll32.exe"), ["url.dll,FileProtocolHandler", url]]
        : process.platform === "darwin"
          ? ["open", [url]]
          : ["xdg-open", [url]];
    const child = spawn(file, args, { detached: true, stdio: "ignore", windowsHide: true });
    child.once("error", () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function numberOption(value, fallback, low, high, name) {
  if (value === undefined) return fallback;
  const number = Number(String(value).replace(",", "."));
  if (!Number.isFinite(number) || number < low || number > high) throw usage(`--${name} vai de ${low} a ${high}.`);
  return number;
}

// ---- the commands the member's AI runs ----

export async function liveStart(context, values) {
  const { root, appDir, script, keySetup } = context;
  if (appKey(KEY_NAME) === null) {
    throw new AppError("no_openrouter_key", "O modo ao vivo usa a chave do OpenRouter, que ainda não foi salva neste computador.", "Siga openrouter_setup: você roda o comando e o integrante cola a chave na página que abre. A revisão e o treino funcionam sem a chave.", {
      openrouter_setup: keySetup(),
    });
  }
  requireMethod(appDir, root);
  const running = readState(root);
  if (running) {
    throw new AppError("live_running", "Já há uma call ao vivo aberta neste projeto.", "Use a página que já está aberta, ou encerre com live stop antes de começar outra.", { url: urlOf(running), id: running.id });
  }
  const minutes = numberOption(values.minutes, 120, 5, 300, "minutes");
  const maxUsd = numberOption(values["max-usd"], 0.5, 0.05, 5, "max-usd");
  const port = values.port !== undefined ? numberOption(values.port, 0, 1024, 65535, "port") : 0;

  const call = createCall(root, { name: values.name ?? "ao vivo", mode: "live", judge: "model", turns: [], source: { origin: "falas captadas ou digitadas na página da call ao vivo", date: new Date().toISOString().slice(0, 10) } });
  const token = randomBytes(18).toString("base64url");
  const log = openSync(join(callDir(root, call.id), "ao-vivo.log"), "a");
  const child = spawn(process.execPath, [script, "live", "serve", "--id", call.id, "--token", token, "--minutes", String(minutes), "--max-usd", String(maxUsd), "--port", String(port)], {
    cwd: root,
    detached: true,
    stdio: ["ignore", log, log],
    windowsHide: true,
  });
  child.once("error", () => {});
  child.unref();
  closeSync(log);

  let state = null;
  for (let waited = 0; waited < 15_000 && !state; waited += 150) {
    await new Promise((done) => setTimeout(done, 150));
    const found = readJson(stateFile(root));
    if (found?.id === call.id && found.ready) state = found;
  }
  if (!state) {
    rmSync(callDir(root, call.id), { recursive: true, force: true });
    throw new AppError("live_failed", "A página da call ao vivo não abriu em 15 segundos.", "Tente de novo. Se continuar, rode npx --yes flyee@latest doctor.");
  }
  const url = urlOf(state);
  const opened = values["no-open"] ? false : openBrowser(url);
  return {
    id: call.id,
    url,
    opened,
    minutes,
    max_usd: maxUsd,
    model: modelName(),
    audio: appKey(GEMINI_KEY_NAME) !== null ? "gemini" : "openrouter",
    say: [
      opened ? "Abri a página da call ao vivo no navegador." : "A página da call ao vivo está pronta neste endereço do seu computador.",
      `Ela fica aberta por até ${minutes} minutos e gasta no máximo US$ ${decimal(maxUsd)} do crédito do OpenRouter nesta call.`,
      "Na página: ligue o seu microfone, compartilhe o áudio da aba da reunião para ouvir o cliente, e clique em Encerrar no fim.",
    ],
    rights_question: "O cliente foi avisado de que a conversa será transcrita?",
    then: `${context.scriptCommand} live status --json`,
  };
}

export async function liveStatus({ root }) {
  const state = readState(root);
  if (!state) return { running: false };
  try {
    const now = await (await fetch(`${urlOf(state)}state`, { signal: AbortSignal.timeout(5_000) })).json();
    return { running: true, id: state.id, url: urlOf(state), turns: now.now?.turns ?? 0, signal: now.now?.signal ?? null, spent_usd: now.meta?.spent_usd ?? null, capped: now.meta?.capped ?? false, minutes_left: now.meta?.minutes_left ?? null, last_error: now.meta?.last_error ?? null };
  } catch {
    return { running: true, id: state.id, url: urlOf(state), reachable: false };
  }
}

export async function liveStop({ root }) {
  const state = readState(root);
  if (!state) return { running: false, say: ["Não há call ao vivo aberta neste projeto."] };
  try {
    const result = await post(state, "end");
    return { running: false, ...result };
  } catch {
    throw new AppError("live_unreachable", "A página da call ao vivo não respondeu ao pedido de encerrar.", "Espere alguns segundos e rode live status. O que foi lido até aqui já está gravado na pasta da call.");
  }
}

// ---- the server itself (started by liveStart, in its own process) ----

export async function liveServe(context, values) {
  const { root, appDir, finishReading } = context;
  const key = appKey(KEY_NAME);
  const geminiKey = appKey(GEMINI_KEY_NAME);
  const method = requireMethod(appDir, root);
  const call = findCall(root, values.id);
  const token = String(values.token ?? "");
  const minutes = Number(values.minutes) || 120;
  const maxUsd = Number(values["max-usd"]) || 0.5;
  const startedAt = Date.now();
  const endsAt = startedAt + minutes * 60_000;
  const page = readFileSync(join(appDir, "scripts", "live", "page.html"), "utf8");
  const meta = { spent_usd: 0, cost_estimated: false, capped: false, errors: 0, last_error: null, judging: true, audio: true, transcriber: geminiKey ? "gemini" : "openrouter", audio_seconds: 0, ended: false };
  let queue = Promise.resolve();
  let reading = null;
  let port = 0;

  const compute = () => {
    reading = readCall({ turns: call.turns, answers: call.answers, bank: method.bank, weights: method.weights, playbook: method.playbook });
    return reading;
  };
  const view = () => ({
    now: snapshot(reading ?? compute(), call.turns, method.playbook),
    meta: { ...meta, spent_usd: round(meta.spent_usd, 4), max_usd: maxUsd, minutes_left: Math.max(0, Math.round((endsAt - Date.now()) / 60_000)), name: call.name, model: modelName() },
  });
  const spend = (cost) => {
    if (typeof cost === "number") meta.spent_usd += cost;
    if (meta.spent_usd >= maxUsd) meta.capped = true;
  };
  const failed = (error) => {
    meta.errors += 1;
    meta.last_error = { code: error.code ?? "unexpected", message: error.message, fix: error.fix ?? "" };
    return meta.last_error;
  };

  /** Records one turn and, when it is worth judging and the ceiling allows, asks the model about it. */
  async function addTurn(speaker, text) {
    if (call.turns.length >= MAX_TURNS) throw new AppError("too_many_turns", `A call passou de ${MAX_TURNS} falas.`, "Encerre esta call e comece outra.");
    const turn = { i: call.turns.length, speaker, name: speaker === "seller" ? "Vendedor" : "Cliente", text, t: Math.round((Date.now() - startedAt) / 1000) };
    call.turns.push(turn);
    let error = null;
    if (meta.judging && !meta.capped && !isShortReply(turn, method.weights)) {
      try {
        const before = reading ?? compute();
        const result = await askModel({ key, state: buildState(call.turns, turn.i, before, method), questions: buildQuestions(turn, before, method), sessionId: call.id });
        const parsed = parseModelAnswer(result.answers, turn, method);
        delete parsed.ignored;
        call.answers[turn.i] = parsed;
        spend(result.cost_usd);
      } catch (problem) {
        error = failed(problem);
        if (STOP_JUDGING.has(problem.code)) meta.judging = false;
      }
    }
    call.usage = { spent_usd: round(meta.spent_usd, 6), max_usd: maxUsd, model: modelName(), errors: meta.errors, transcriber: meta.transcriber, audio_seconds: meta.audio_seconds };
    saveCall(root, call);
    compute();
    return { turn, error, ...view() };
  }

  const routes = {
    "GET ": () => ({ html: page }),
    "GET state": () => ({ ...view(), turns: call.turns.map(({ i, speaker, text, t }) => ({ i, speaker, text, t })) }),
    "POST turn": async (body) => {
      if (!SPEAKERS.includes(body?.speaker)) throw new AppError("usage", "speaker: esperado seller ou client.");
      const text = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim().slice(0, 4000) : "";
      if (!text) throw new AppError("usage", "text: falta a fala.");
      return addTurn(body.speaker, text);
    },
    "POST audio": async (body) => {
      if (!SPEAKERS.includes(body?.speaker)) throw new AppError("usage", "speaker: esperado seller ou client.");
      if (!AUDIO_FORMATS.has(body.format) || typeof body.data !== "string" || !body.data) throw new AppError("usage", "Áudio em formato não aceito.");
      const language = body.language === "en" || body.language === "es" ? body.language : "pt";
      const seconds = Number.isFinite(body.seconds) && body.seconds > 0 ? Math.min(60, body.seconds) : 0;
      if (meta.transcriber === "gemini") {
        // Gemini hears with its own key and its own account: nothing here counts against the OpenRouter ceiling
        let said;
        try {
          said = await transcribeWithGemini({ key: geminiKey, data: body.data, format: body.format, language });
        } catch (problem) {
          const error = failed(problem);
          // a key or a model that will not start working: the next stretches go through OpenRouter
          if (GEMINI_GIVE_UP.has(problem.code)) meta.transcriber = "openrouter";
          return { skipped: "error", error, ...view() };
        }
        meta.audio_seconds = round(meta.audio_seconds + seconds, 1);
        if (!said.text) return { skipped: "silence", ...view() };
        return addTurn(body.speaker, said.text.slice(0, 4000));
      }
      if (!meta.audio) throw new AppError("audio_off", meta.last_error?.message ?? "A transcrição de áudio está desligada nesta call.", meta.last_error?.fix ?? "");
      if (meta.capped) return { skipped: "capped", ...view() };
      let heard;
      try {
        heard = await transcribe({ key, data: body.data, format: body.format, language, model: sttModelName() });
      } catch (problem) {
        const error = failed(problem);
        if (STOP_JUDGING.has(problem.code) || problem.code === "audio_needs_credit") meta.audio = false;
        return { skipped: "error", error, ...view() };
      }
      if (heard.cost_usd !== null) spend(heard.cost_usd);
      else if (seconds > 0) {
        // the response carried no cost: count the stretch at the default model's listed price per second
        spend(seconds * 0.0000611);
        meta.cost_estimated = true;
      }
      if (!heard.text) return { skipped: "silence", ...view() };
      return addTurn(body.speaker, heard.text.slice(0, 4000));
    },
    "POST flip": async () => {
      // the last turn was credited to the wrong person: switch it and read it again
      const last = call.turns.pop();
      if (!last) throw new AppError("usage", "Ainda não há falas.");
      delete call.answers[last.i];
      reading = null;
      return addTurn(last.speaker === "seller" ? "client" : "seller", last.text);
    },
    "POST end": async () => finish("ended"),
  };

  async function finish(reason) {
    if (meta.ended) return { ended: true };
    meta.ended = true;
    clearTimeout(limit);
    rmSync(stateFile(root), { force: true });
    let result;
    if (!call.turns.length) {
      rmSync(callDir(root, call.id), { recursive: true, force: true });
      result = { ended: true, reason, turns: 0, say: ["A call terminou sem nenhuma fala, e nada foi gravado."] };
    } else {
      const unread = call.turns.filter((turn) => !call.answers[turn.i] && !isShortReply(turn, method.weights)).length;
      const done = finishReading(call, method);
      result = {
        ended: true,
        reason,
        turns: call.turns.length,
        spent_usd: round(meta.spent_usd, 4),
        unread_turns: unread,
        ...done,
        ...(unread ? { then: `${context.scriptCommand} call questions ${call.id} --json` } : {}),
      };
    }
    setTimeout(() => {
      server.close();
      server.closeAllConnections?.();
    }, 300);
    return result;
  }

  const send = (res, status, payload) => {
    const html = typeof payload?.html === "string";
    const body = html ? payload.html : JSON.stringify(payload);
    res.writeHead(status, {
      "Content-Type": html ? "text/html; charset=utf-8" : "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...(html ? { "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; media-src 'self' blob:; img-src data:; base-uri 'none'; form-action 'none'" } : {}),
    });
    res.end(body);
  };

  const sameToken = (given) => {
    const a = Buffer.from(String(given));
    const b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  };

  const server = createServer((req, res) => {
    // only this machine, only the address this server gave out, only with the one-use path
    const hostOk = req.headers.host === `${HOST}:${port}` || req.headers.host === `localhost:${port}`;
    const match = /^\/c\/([^/]+)\/([a-z]*)$/.exec(String(req.url).split("?")[0]);
    if (!hostOk || !match || !sameToken(match[1])) return send(res, 404, { ok: false });
    const origin = req.headers.origin;
    if (origin && origin !== `http://${HOST}:${port}` && origin !== `http://localhost:${port}`) return send(res, 403, { ok: false });
    const handler = routes[`${req.method} ${match[2]}`];
    if (!handler) return send(res, 404, { ok: false });
    if (req.method === "GET") return send(res, 200, handler());
    if (!String(req.headers["content-type"] ?? "").startsWith("application/json")) return send(res, 415, { ok: false });
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) req.destroy();
      else chunks.push(chunk);
    });
    req.on("end", () => {
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      } catch {
        return send(res, 400, { ok: false, error: { code: "usage", message: "Pedido inválido." } });
      }
      // one turn at a time: each reading depends on the one before it
      queue = queue
        .then(() => (meta.ended && match[2] !== "end" ? { ended: true } : handler(body)))
        .then((result) => send(res, 200, { ok: true, ...result }))
        .catch((error) => send(res, 200, { ok: false, error: { code: error.code ?? "unexpected", message: error.message, fix: error.fix ?? "" }, ...view() }));
    });
  });

  const limit = setTimeout(() => {
    queue = queue.then(() => finish("time_limit")).catch(() => {});
  }, minutes * 60_000);

  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(Number(values.port) || 0, HOST, resolvePromise);
  });
  port = server.address().port;
  compute();
  writeJson(stateFile(root), { id: call.id, pid: process.pid, port, token, ready: true, started_at: new Date(startedAt).toISOString(), ends_at: new Date(endsAt).toISOString(), dir: toPosix(root, dirname(join(callDir(root, call.id), "call.json"))) });
  return undefined;
}
