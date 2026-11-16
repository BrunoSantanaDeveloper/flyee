// The live call against a model that runs on this machine: the page's server, its guards,
// the spending ceiling, the audio path and what is left for the member's AI when the model fails.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, request } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "..");

/** A decisions and transcription service on 127.0.0.1 that answers by what the turn says. */
async function fakeOpenRouter({ cost = 0.0002, status = 200 } = {}) {
  const seen = { decisions: [], audio: [], gemini: [] };
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const reply = (code, data) => {
        res.writeHead(code, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
      };
      if (req.url.startsWith("/gemini/")) {
        seen.gemini.push({ url: req.url, body });
        if (req.headers["x-goog-api-key"] !== "g-key") return reply(400, { error: { code: 400, message: "API key not valid. Please pass a valid API key." } });
        const audio = body.contents[0].parts[0].inline_data;
        return reply(200, { candidates: [{ content: { parts: [{ text: audio.data === "c2lsZW5jaW8=" ? "VAZIO." : "Achei caro, preciso pensar." }] } }], usageMetadata: { promptTokenCount: 225 } });
      }
      if (req.headers.authorization !== "Bearer test-key") return reply(401, { error: { code: 401, message: "No auth" } });
      if (req.url === "/stt") {
        seen.audio.push(body);
        if (body.input_audio.data === "c2lsZW5jaW8=") return reply(200, { text: "" });
        if (body.input_audio.data === "c2VtLXNhbGRv") return reply(402, { error: { code: 402, message: "This request requires at least $0.50 in balance for audio" } });
        return reply(200, { text: "Achei caro, preciso pensar.", usage: { cost: 0.001 } });
      }
      seen.decisions.push(body);
      if (status !== 200) return reply(status, { error: { code: status, message: "refused" } });
      const text = body.state.latest_turn.text;
      const objecting = /caro/i.test(text);
      const answers = {};
      for (const [name, question] of Object.entries(body.questions)) {
        if (question.type === "noul") answers[name] = { type: "noul", noul: name === "s_objection" && objecting ? 0.95 : name === "s_agreement" && /faz sentido/i.test(text) ? 0.9 : 0.02 };
        else if (question.type === "score") answers[name] = { type: "score", score: 1, confidence: 0.8, probabilities: { 0: 0.1, 1: 0.8, 2: 0.1 } };
        else if (name === "stage") answers[name] = { type: "choice", choice: objecting ? "objection" : "discovery", confidence: 0.9 };
        else if (name === "objection_kind") answers[name] = { type: "choice", choice: objecting ? "price" : "none", confidence: 0.9 };
        else if (name === "move") answers[name] = { type: "choice", choice: objecting ? "answer_price_objection" : "ask_how_it_works_today", confidence: 0.9 };
      }
      reply(200, { id: "gen-dec-test", model: "typesafe/jev-test", provider: "Test", answers, usage: { input_tokens: 5000, output_tokens: 0, cost } });
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, seen, close: () => new Promise((done) => server.close(done)) };
}

function project(fake, key = "test-key", gemini = "") {
  const root = mkdtempSync(join(tmpdir(), "sales-copilot-live-"));
  const installed = join(root, ".flyee", "modules", "sales-copilot");
  mkdirSync(installed, { recursive: true });
  for (const part of ["flyee.module.json", "scripts", "references"]) cpSync(join(APP, part), join(installed, part), { recursive: true });
  // an empty GEMINI_API_KEY means "no key": a test never reaches the real service with this machine's key
  const env = { ...process.env, OPENROUTER_API_KEY: key, GEMINI_API_KEY: gemini, SALES_COPILOT_GEMINI_URL: `${fake.base}/gemini`, SALES_COPILOT_DECISIONS_URL: `${fake.base}/decisions`, SALES_COPILOT_STT_URL: `${fake.base}/stt` };
  const run = (...args) => {
    const result = spawnSync(process.execPath, [join(installed, "scripts", "copilot.mjs"), ...args, "--json"], { cwd: root, encoding: "utf8", env, timeout: 60_000 });
    try {
      return JSON.parse(result.stdout);
    } catch {
      throw new Error(`not JSON (${args.join(" ")}): ${result.stdout}\n${result.stderr}`);
    }
  };
  return { root, run };
}

const post = async (url, path, body) => (await fetch(url + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

/** A request with a Host header of our choosing, which fetch does not allow. */
function withHost(url, host) {
  return new Promise((done, fail) => {
    const target = new URL(url);
    const req = request({ host: target.hostname, port: target.port, path: `${target.pathname}state`, headers: { Host: host } }, (res) => {
      res.resume();
      done(res.statusCode);
    });
    req.on("error", fail);
    req.end();
  });
}

async function gone(pid) {
  for (let waited = 0; waited < 8000; waited += 100) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  return false;
}

test("without the key the live mode says how to get one, and nothing starts", async () => {
  const fake = await fakeOpenRouter();
  const { root, run } = project(fake, "");
  try {
    const start = run("live", "start", "--no-open");
    assert.equal(start.ok, false);
    assert.equal(start.error.code, "no_openrouter_key");
    assert.match(start.error.openrouter_setup.command, /key set OPENROUTER_API_KEY --browser --json$/);
    assert.equal(existsSync(join(root, "copiloto-de-vendas")), false);
  } finally {
    await fake.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("a live call: guards, turns, audio, the wrong speaker, the ceiling and the end", async () => {
  const fake = await fakeOpenRouter({ cost: 0.02 });
  const { root, run } = project(fake);
  let pid = null;
  try {
    const start = run("live", "start", "--no-open", "--max-usd", "0.05", "--minutes", "5", "--name", "Clínica ao vivo");
    assert.equal(start.ok, true, JSON.stringify(start));
    assert.match(start.url, /^http:\/\/127\.0\.0\.1:\d+\/c\/[A-Za-z0-9_-]{24}\/$/);
    assert.equal(start.rights_question, "O cliente foi avisado de que a conversa será transcrita?");
    assert.match(start.say[1], /no máximo US\$ 0,05/);
    const state = JSON.parse(readFileSync(join(root, "copiloto-de-vendas", ".ao-vivo.json"), "utf8"));
    pid = state.pid;

    assert.equal(run("live", "start", "--no-open").error.code, "live_running");

    // only this machine, only the address the server gave out
    assert.equal((await fetch(start.url.replace(/\/c\/[^/]+\//, "/c/outro-caminho-qualquer-aqui/") + "state")).status, 404);
    assert.equal(await withHost(start.url, "evil.example:80"), 404);
    assert.equal(await withHost(start.url, `127.0.0.1:${state.port}`), 200);
    const crossSite = await fetch(start.url + "turn", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://evil.example" }, body: "{}" });
    assert.equal(crossSite.status, 403);
    const formPost = await fetch(start.url + "turn", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" });
    assert.equal(formPost.status, 415);

    const page = await fetch(start.url);
    assert.match(page.headers.get("content-security-policy"), /default-src 'none'/);
    const html = await page.text();
    assert.match(html, /Encerrar a call/);
    assert.doesNotMatch(html, /https?:\/\/(?!127\.0\.0\.1)/, "the page loads nothing from outside");

    const one = await post(start.url, "turn", { speaker: "seller", text: "Me conta como funciona hoje a agenda da clínica." });
    assert.equal(one.ok, true);
    assert.equal(one.now.move.id, "ask_how_it_works_today");
    assert.equal(fake.seen.decisions.length, 1);
    assert.equal(fake.seen.decisions[0].state.latest_turn.who, "seller");
    assert.equal(fake.seen.decisions[0].questions.s_objection, undefined, "a seller turn is not asked the client's questions");

    const short = await post(start.url, "turn", { speaker: "client", text: "Claro." });
    assert.equal(short.now.turns, 2);
    assert.equal(fake.seen.decisions.length, 1, "a short reply costs nothing");

    const heard = await post(start.url, "audio", { speaker: "seller", format: "webm", seconds: 3, data: "ZmFsYQ==" });
    assert.equal(heard.turn.text, "Achei caro, preciso pensar.");
    assert.equal(fake.seen.audio[0].language, "pt");
    assert.equal(fake.seen.audio[0].input_audio.format, "webm");
    assert.equal((await post(start.url, "audio", { speaker: "client", format: "webm", seconds: 2, data: "c2lsZW5jaW8=" })).skipped, "silence");
    assert.equal((await post(start.url, "audio", { speaker: "client", format: "exe", data: "eA==" })).error.code, "usage");

    // the microphone credited the client's words to the seller: one click fixes it
    const flipped = await post(start.url, "flip", {});
    assert.equal(flipped.turn.speaker, "client");
    assert.equal(flipped.now.turns, 3);
    assert.equal(flipped.now.objection.label, "preço");
    assert.equal(flipped.now.move.id, "answer_price_objection");

    // three judged turns at 0.02 each passed the 0.05 ceiling: the next ones are kept, not judged
    assert.equal(flipped.meta.capped, true);
    const asked = fake.seen.decisions.length;
    const capped = await post(start.url, "turn", { speaker: "seller", text: "Posso comparar com o que as faltas custam por mês para vocês?" });
    assert.equal(capped.now.turns, 4);
    assert.equal(fake.seen.decisions.length, asked);
    assert.equal((await post(start.url, "audio", { speaker: "client", format: "webm", seconds: 2, data: "ZmFsYQ==" })).skipped, "capped");

    const status = run("live", "status");
    assert.equal(status.running, true);
    assert.equal(status.turns, 4);
    assert.equal(status.capped, true);

    const end = run("live", "stop");
    assert.equal(end.ended, true);
    assert.equal(end.turns, 4);
    assert.equal(end.unread_turns, 1);
    assert.match(end.then, /call questions /);
    assert.ok(existsSync(join(root, end.files.report)));
    assert.ok(await gone(pid), "the server ends by itself");
    assert.equal(existsSync(join(root, "copiloto-de-vendas", ".ao-vivo.json")), false);
    assert.equal(run("live", "status").running, false);

    // what the model did not read, the member's AI reads afterwards
    const left = run("call", "questions", "last");
    assert.deepEqual(left.batch.map((turn) => turn.i), [3]);
    writeFileSync(join(root, left.write), JSON.stringify({ turns: [{ i: 3, stage: "objection", signals: { open_question: 0.8 } }] }));
    const done = run("call", "answer", "last", "--file", left.write);
    assert.equal(done.done, true);
    assert.match(readFileSync(join(root, done.files.report), "utf8"), /o modelo de decisões ao vivo, e a sua IA nas falas que faltaram/);
    const saved = JSON.parse(readFileSync(join(root, done.files.call), "utf8"));
    assert.equal(saved.usage.max_usd, 0.05);
    assert.doesNotMatch(JSON.stringify(saved), /test-key/, "the key is never written");
  } finally {
    if (pid) await gone(pid);
    await fake.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});

test("a key the service refuses stops the questions, keeps the turns, and an empty call leaves nothing", async () => {
  const fake = await fakeOpenRouter({ status: 402 });
  const { root, run } = project(fake);
  const pids = [];
  try {
    const start = run("live", "start", "--no-open");
    pids.push(JSON.parse(readFileSync(join(root, "copiloto-de-vendas", ".ao-vivo.json"), "utf8")).pid);
    const one = await post(start.url, "turn", { speaker: "seller", text: "Me conta como funciona hoje a agenda da clínica." });
    assert.equal(one.error.code, "no_credit");
    assert.equal(one.now.turns, 1);
    await post(start.url, "turn", { speaker: "client", text: "Hoje é tudo no caderno e no telefone mesmo." });
    assert.equal(fake.seen.decisions.length, 1, "after a refusal that will not change, the service is not asked again");
    const noCredit = await post(start.url, "audio", { speaker: "client", format: "webm", seconds: 2, data: "c2VtLXNhbGRv" });
    assert.equal(noCredit.error.code, "audio_needs_credit");
    assert.equal((await post(start.url, "audio", { speaker: "client", format: "webm", seconds: 2, data: "ZmFsYQ==" })).error.code, "audio_off");
    const end = await post(start.url, "end", {});
    assert.equal(end.unread_turns, 2);
    assert.ok(await gone(pids[0]));

    const empty = run("live", "start", "--no-open");
    pids.push(JSON.parse(readFileSync(join(root, "copiloto-de-vendas", ".ao-vivo.json"), "utf8")).pid);
    const nothing = run("live", "stop");
    assert.equal(nothing.turns, 0);
    assert.equal(existsSync(join(root, "copiloto-de-vendas", "calls", empty.id)), false);
    assert.ok(await gone(pids[1]));
  } finally {
    for (const pid of pids) await gone(pid);
    await fake.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});

test("with a Gemini key the audio is heard by Gemini, outside the OpenRouter ceiling", async () => {
  const fake = await fakeOpenRouter({ cost: 0.03 });
  const { root, run } = project(fake, "test-key", "g-key");
  let pid = null;
  try {
    const check = run("check");
    assert.equal(check.gemini_key, true);
    assert.equal(check.live_audio, "gemini");
    const start = run("live", "start", "--no-open", "--max-usd", "0.05");
    assert.equal(start.audio, "gemini");
    pid = JSON.parse(readFileSync(join(root, "copiloto-de-vendas", ".ao-vivo.json"), "utf8")).pid;

    const heard = await post(start.url, "audio", { speaker: "client", format: "webm", seconds: 3, data: "ZmFsYQ==" });
    assert.equal(heard.turn.text, "Achei caro, preciso pensar.");
    assert.equal(heard.meta.transcriber, "gemini");
    assert.equal(heard.now.objection.label, "preço");
    assert.equal(fake.seen.gemini[0].url, "/gemini/models/gemini-flash-lite-latest:generateContent");
    assert.equal(fake.seen.gemini[0].body.contents[0].parts[0].inline_data.mime_type, "audio/webm");
    assert.equal(fake.seen.audio.length, 0, "OpenRouter is not asked to transcribe");
    assert.equal((await post(start.url, "audio", { speaker: "client", format: "webm", seconds: 2, data: "c2lsZW5jaW8=" })).skipped, "silence");

    // two judged turns at 0.03 pass the 0.05 ceiling: the model stops, the hearing goes on
    const second = await post(start.url, "audio", { speaker: "client", format: "webm", seconds: 3, data: "ZmFsYQ==" });
    assert.equal(second.meta.capped, true);
    const third = await post(start.url, "audio", { speaker: "client", format: "webm", seconds: 3, data: "ZmFsYQ==" });
    assert.equal(third.turn.text, "Achei caro, preciso pensar.");
    assert.equal(fake.seen.decisions.length, 2);
    assert.equal(third.meta.audio_seconds, 11);

    const end = run("live", "stop");
    assert.equal(end.unread_turns, 1);
    const saved = JSON.parse(readFileSync(join(root, end.files.call), "utf8"));
    assert.equal(saved.usage.transcriber, "gemini");
    assert.doesNotMatch(JSON.stringify(saved), /g-key|test-key/, "no key is ever written");
    assert.ok(await gone(pid));
  } finally {
    if (pid) await gone(pid);
    await fake.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});

test("a Gemini key the service refuses hands the hearing over to OpenRouter", async () => {
  const fake = await fakeOpenRouter();
  const { root, run } = project(fake, "test-key", "wrong-key");
  let pid = null;
  try {
    const start = run("live", "start", "--no-open");
    pid = JSON.parse(readFileSync(join(root, "copiloto-de-vendas", ".ao-vivo.json"), "utf8")).pid;
    const refused = await post(start.url, "audio", { speaker: "client", format: "webm", seconds: 3, data: "ZmFsYQ==" });
    assert.equal(refused.error.code, "gemini_invalid_key");
    assert.equal(refused.meta.transcriber, "openrouter");
    const next = await post(start.url, "audio", { speaker: "client", format: "webm", seconds: 3, data: "ZmFsYQ==" });
    assert.equal(next.turn.text, "Achei caro, preciso pensar.");
    assert.equal(fake.seen.audio.length, 1);
    await post(start.url, "end", {});
    assert.ok(await gone(pid));
  } finally {
    if (pid) await gone(pid);
    await fake.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
