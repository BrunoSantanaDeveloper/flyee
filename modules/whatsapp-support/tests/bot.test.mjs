import assert from "node:assert/strict";
import { test } from "node:test";

import { createBot } from "../kit/base/bot/src/bot.mjs";
import { generate as anthropicGenerate, systemBlocks } from "../kit/base/bot/src/ai/anthropic.mjs";
import { scrub } from "../kit/base/bot/src/privacy.mjs";
import { generate as geminiGenerate, geminiSchema } from "../kit/base/bot/src/ai/gemini.mjs";
import { generate as openaiGenerate } from "../kit/base/bot/src/ai/openai.mjs";
import { waitFor } from "../kit/base/bot/src/http.mjs";
import { createLogger } from "../kit/base/bot/src/log.mjs";
import { asksForTeam, normalizeConfig, teamAvailable } from "../kit/base/bot/src/policy.mjs";
import { ACTION_SCHEMA, buildSystemPrompt, parseAction, toMessages } from "../kit/base/bot/src/prompt.mjs";
import { createConversationQueue } from "../kit/base/bot/src/queue.mjs";
import { hmacHex, signProjectRequest, verifyChatwoot, verifyProjectRequest } from "../kit/base/bot/src/signature.mjs";

const BOT_SECRET = "segredo-do-robo-da-conta";
const SHARED = "segredo-entre-robo-e-projeto";
const NOW = Date.parse("2026-11-09T14:00:00Z"); // segunda-feira, 11:00 em São Paulo

function chatwootHeaders(rawBody, { secret = BOT_SECRET, at = NOW, delivery = `d-${Math.random()}` } = {}) {
  const timestamp = String(Math.floor(at / 1000));
  return {
    "x-chatwoot-timestamp": timestamp,
    "x-chatwoot-signature": `sha256=${hmacHex(secret, `${timestamp}.${rawBody}`)}`,
    "x-chatwoot-delivery": delivery,
  };
}

function incoming({ content = "Oi, quero saber do meu pedido", status = "pending", conversation = 7, id = Math.floor(Math.random() * 1e9), attachments } = {}) {
  return {
    event: "message_created",
    id,
    account: { id: 3, name: "Cliente" },
    content,
    message_type: "incoming",
    private: false,
    sender: { id: 99, name: "Maria Souza", phone_number: "+5511999990000", identifier: null, email: null },
    inbox: { id: 5, name: "WhatsApp" },
    conversation: { id: conversation, status, inbox_id: 5 },
    ...(attachments ? { attachments } : {}),
  };
}

function baseConfig(overrides = {}) {
  return {
    brand: "Loja Exemplo",
    mode: "auto",
    chatwoot: { bot_token: "token-do-robo", bot_secret: BOT_SECRET },
    ai: { provider: "fake" },
    instructions: "Responda sobre pedidos.",
    knowledge: [{ q: "Qual o prazo?", a: "Cinco dias úteis." }],
    tools: [{ name: "consultar_pedido", description: "Status do pedido da pessoa.", input_schema: { type: "object", properties: { numero: { type: "string" } } } }],
    handoff: { labels: ["robo-passou"] },
    ...overrides,
  };
}

/** Um mundo falso: o Chatwoot, o projeto e a IA respondem pelo mesmo fetch. */
function world({ config = baseConfig(), aiReplies = [], toolResult = { ok: true, data: { status: "enviado" } }, conversationStatus = "pending", history = [] } = {}) {
  const calls = { chatwoot: [], project: [], ai: [] };
  const replies = [...aiReplies];
  const fetchImpl = async (url, init = {}) => {
    const target = new URL(url);
    const body = init.body ? JSON.parse(init.body) : null;
    const json = (status, value) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
    if (target.host === "projeto.test") {
      const check = verifyProjectRequest({
        secret: SHARED,
        method: init.method ?? "GET",
        pathWithQuery: `${target.pathname}${target.search}`,
        body: init.body ?? "",
        timestamp: init.headers["X-Support-Timestamp"],
        signature: init.headers["X-Support-Signature"],
      });
      calls.project.push({ path: target.pathname, query: Object.fromEntries(target.searchParams), body, signed: check.ok });
      if (!check.ok) return json(401, { ok: false });
      if (target.pathname.endsWith("/config")) return json(200, config);
      if (target.pathname.endsWith("/history")) return json(200, { messages: history });
      if (target.pathname.includes("/tools/")) return json(200, toolResult);
      if (target.pathname.endsWith("/generate")) return json(200, JSON.parse(replies.shift() ?? "{}"));
      if (target.pathname.endsWith("/events") || target.pathname.endsWith("/suggestions")) return json(200, { ok: true });
      return json(404, {});
    }
    if (target.host === "chatwoot.test") {
      calls.chatwoot.push({ method: init.method ?? "GET", path: target.pathname, body, auth: init.headers?.authorization });
      if ((init.method ?? "GET") === "GET" && /\/conversations\/\d+$/.test(target.pathname)) return json(200, { id: 7, status: conversationStatus });
      if (target.pathname.endsWith("/labels") && (init.method ?? "GET") === "GET") return json(200, { payload: ["vip"] });
      if (target.pathname.endsWith("/messages")) return json(200, { id: 1000 + calls.chatwoot.length, ...body });
      return json(200, {});
    }
    if (target.host === "ia.test") {
      calls.ai.push({ body });
      const next = replies.shift();
      if (next instanceof Error) throw next;
      return json(200, { choices: [{ message: { content: next ?? "" }, finish_reason: "stop" }], model: "fake" });
    }
    throw new Error(`rota inesperada ${url}`);
  };
  return { calls, fetchImpl };
}

function makeBot(fetchImpl, envOverrides = {}) {
  return createBot({
    env: {
      chatwootUrl: "https://chatwoot.test",
      projectUrl: "https://projeto.test/api/atendimento/robo",
      secret: SHARED,
      debounceMs: 5,
      configTtlMs: 60000,
      configStaleMs: 600000,
      keys: { OPENAI_API_KEY: "chave-falsa" },
      ...envOverrides,
    },
    fetchImpl,
    now: () => NOW,
  });
}

function fakeProviderConfig(overrides = {}) {
  return baseConfig({ ai: { provider: "openai", model: "modelo-falso", base_url: "https://ia.test/v1" }, ...overrides });
}

const reply = (text) => JSON.stringify({ action: "reply", text, tool: "", input: "", reason: "" });
const lookup = (tool, input) => JSON.stringify({ action: "lookup", text: "", tool, input: JSON.stringify(input), reason: "" });
const handoff = (reason, text = "", category = "nao_sei", topic = "") => JSON.stringify({ action: "handoff", text, tool: "", input: "", reason, category, topic });

test("assinatura do Chatwoot: válida, errada, vencida e sem cabeçalho", () => {
  const raw = '{"a":1}';
  const headers = chatwootHeaders(raw);
  const base = { secret: BOT_SECRET, rawBody: raw, now: NOW };
  assert.deepEqual(verifyChatwoot({ ...base, timestamp: headers["x-chatwoot-timestamp"], signature: headers["x-chatwoot-signature"] }), { ok: true });
  assert.equal(verifyChatwoot({ ...base, timestamp: headers["x-chatwoot-timestamp"], signature: "sha256=00" }).code, "bad_signature");
  assert.equal(verifyChatwoot({ ...base, now: NOW + 301000, timestamp: headers["x-chatwoot-timestamp"], signature: headers["x-chatwoot-signature"] }).code, "stale");
  assert.equal(verifyChatwoot({ ...base, timestamp: null, signature: null }).code, "no_signature");
});

test("assinatura entre robô e projeto cobre método e caminho", () => {
  const signed = signProjectRequest({ secret: SHARED, method: "GET", pathWithQuery: "/robo/config?account_id=3", now: NOW });
  const ok = verifyProjectRequest({ secret: SHARED, method: "GET", pathWithQuery: "/robo/config?account_id=3", timestamp: signed["X-Support-Timestamp"], signature: signed["X-Support-Signature"], now: NOW });
  const otherPath = verifyProjectRequest({ secret: SHARED, method: "GET", pathWithQuery: "/robo/config?account_id=4", timestamp: signed["X-Support-Timestamp"], signature: signed["X-Support-Signature"], now: NOW });
  assert.equal(ok.ok, true);
  assert.equal(otherPath.code, "bad_signature");
});

test("recusa aviso sem assinatura válida e não processa", async () => {
  const { calls, fetchImpl } = world({ config: fakeProviderConfig(), aiReplies: [reply("Olá")] });
  const bot = makeBot(fetchImpl);
  const raw = JSON.stringify(incoming());
  const result = await bot.receive({ rawBody: raw, headers: chatwootHeaders(raw, { secret: "outro" }) });
  assert.equal(result.status, 401);
  await bot.idle();
  assert.equal(calls.ai.length, 0);
});

test("entrega repetida é ignorada", async () => {
  const { calls, fetchImpl } = world({ config: fakeProviderConfig(), aiReplies: [reply("Olá"), reply("de novo")] });
  const bot = makeBot(fetchImpl);
  const raw = JSON.stringify(incoming());
  const headers = chatwootHeaders(raw, { delivery: "mesma" });
  assert.equal((await bot.receive({ rawBody: raw, headers })).status, 200);
  const second = await bot.receive({ rawBody: raw, headers });
  assert.equal(second.body.ignored, "duplicate");
  await bot.idle();
  assert.equal(calls.ai.length, 1);
});

test("modo auto: junta mensagens seguidas, responde em público e conta o turno", async () => {
  const { calls, fetchImpl } = world({ config: fakeProviderConfig(), aiReplies: [reply("Seu pedido sai em cinco dias úteis.")] });
  const bot = makeBot(fetchImpl);
  for (const content of ["Oi", "quero saber do prazo"]) {
    const raw = JSON.stringify(incoming({ content }));
    await bot.receive({ rawBody: raw, headers: chatwootHeaders(raw) });
  }
  await bot.idle();
  assert.equal(calls.ai.length, 1, "duas mensagens seguidas viram uma chamada à IA");
  const userTurns = calls.ai[0].body.messages.filter((message) => message.role === "user").map((message) => message.content);
  assert.deepEqual(userTurns, ["Oi", "quero saber do prazo"]);
  const sent = calls.chatwoot.filter((call) => call.path.endsWith("/messages"));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.private, false);
  assert.equal(sent[0].body.content, "Seu pedido sai em cinco dias úteis.");
  assert.ok(sent[0].auth.startsWith("Bearer "));
  assert.equal(calls.chatwoot.some((call) => call.path.endsWith("/toggle_status")), false);
});

test("modo sugestão: só nota privada e a conversa vai para a equipe", async () => {
  const { calls, fetchImpl } = world({ config: fakeProviderConfig({ mode: "sugestao" }), aiReplies: [reply("Seu pedido sai em cinco dias úteis.")] });
  const bot = makeBot(fetchImpl);
  const raw = JSON.stringify(incoming());
  await bot.receive({ rawBody: raw, headers: chatwootHeaders(raw) });
  await bot.idle();
  const sent = calls.chatwoot.filter((call) => call.path.endsWith("/messages"));
  assert.ok(sent.length >= 1);
  assert.ok(sent.every((call) => call.body.private === true), "nenhuma mensagem pública no modo sugestão");
  assert.match(sent[0].body.content, /^Sugestão do robô/);
  const toggle = calls.chatwoot.find((call) => call.path.endsWith("/toggle_status"));
  assert.deepEqual(toggle.body, { status: "open" });
});

test("consulta ao projeto vai assinada, com o contato, e o resultado volta à IA", async () => {
  const { calls, fetchImpl } = world({
    config: fakeProviderConfig(),
    aiReplies: [lookup("consultar_pedido", { numero: "123" }), reply("O pedido 123 já foi enviado.")],
  });
  const bot = makeBot(fetchImpl);
  const raw = JSON.stringify(incoming({ content: "Cadê o pedido 123?" }));
  await bot.receive({ rawBody: raw, headers: chatwootHeaders(raw) });
  await bot.idle();
  const toolCall = calls.project.find((call) => call.path.includes("/tools/consultar_pedido"));
  assert.ok(toolCall.signed);
  assert.equal(toolCall.body.account_id, 3);
  assert.equal(toolCall.body.contact.phone_number, "+5511999990000");
  assert.deepEqual(toolCall.body.input, { numero: "123" });
  const secondCall = calls.ai[1].body.messages;
  assert.match(secondCall[secondCall.length - 1].content, /Resultado da consulta consultar_pedido/);
});

test("pedido de atendente passa para a equipe sem chamar a IA, com etiqueta somada", async () => {
  const { calls, fetchImpl } = world({ config: fakeProviderConfig(), aiReplies: [reply("não devia")] });
  const bot = makeBot(fetchImpl);
  const raw = JSON.stringify(incoming({ content: "Quero falar com um ATENDENTE" }));
  await bot.receive({ rawBody: raw, headers: chatwootHeaders(raw) });
  await bot.idle();
  assert.equal(calls.ai.length, 0);
  assert.ok(calls.chatwoot.some((call) => call.path.endsWith("/toggle_status")));
  const labels = calls.chatwoot.find((call) => call.method === "POST" && call.path.endsWith("/labels"));
  assert.deepEqual(labels.body.labels.sort(), ["robo-passou", "vip"]);
});

test("falha da IA vira passagem para a equipe com mensagem educada", async () => {
  const { calls, fetchImpl } = world({ config: fakeProviderConfig(), aiReplies: [new Error("caiu"), new Error("caiu"), new Error("caiu")] });
  const bot = makeBot(fetchImpl);
  const raw = JSON.stringify(incoming());
  await bot.receive({ rawBody: raw, headers: chatwootHeaders(raw) });
  await bot.idle();
  const publicMessages = calls.chatwoot.filter((call) => call.path.endsWith("/messages") && call.body.private === false);
  assert.equal(publicMessages[0].body.content, normalizeConfig(baseConfig()).messages.erro);
  assert.ok(calls.chatwoot.some((call) => call.path.endsWith("/toggle_status")));
});

test("conversa que a equipe já assumiu não recebe resposta do robô", async () => {
  const { calls, fetchImpl } = world({ config: fakeProviderConfig(), aiReplies: [reply("tarde demais")], conversationStatus: "open" });
  const bot = makeBot(fetchImpl);
  const raw = JSON.stringify(incoming());
  await bot.receive({ rawBody: raw, headers: chatwootHeaders(raw) });
  await bot.idle();
  assert.equal(calls.ai.length, 0);
  assert.equal(calls.chatwoot.filter((call) => call.path.endsWith("/messages")).length, 0);
});

test("só arquivo, sem texto: passa para a equipe com a mensagem de anexo", async () => {
  const { calls, fetchImpl } = world({ config: fakeProviderConfig() });
  const bot = makeBot(fetchImpl);
  const raw = JSON.stringify(incoming({ content: "", attachments: [{ file_type: "audio" }] }));
  await bot.receive({ rawBody: raw, headers: chatwootHeaders(raw) });
  await bot.idle();
  const first = calls.chatwoot.find((call) => call.path.endsWith("/messages"));
  assert.equal(first.body.content, normalizeConfig(baseConfig()).messages.anexo);
});

test("histórico do projeto entra antes da mensagem nova", async () => {
  const { calls, fetchImpl } = world({
    config: fakeProviderConfig(),
    aiReplies: [reply("Certo.")],
    history: [
      { role: "cliente", text: "Comprei ontem" },
      { role: "robo", text: "Obrigado pela compra." },
    ],
  });
  const bot = makeBot(fetchImpl);
  const raw = JSON.stringify(incoming({ content: "E o prazo?" }));
  await bot.receive({ rawBody: raw, headers: chatwootHeaders(raw) });
  await bot.idle();
  const contents = calls.ai[0].body.messages.slice(1).map((message) => message.content);
  assert.deepEqual(contents, ["Comprei ontem", "Obrigado pela compra.", "E o prazo?"]);
});

test("provedor project: o projeto gera a ação", async () => {
  const { calls, fetchImpl } = world({ config: baseConfig({ ai: { provider: "project" } }), aiReplies: [reply("Resposta do projeto.")] });
  const bot = makeBot(fetchImpl);
  const raw = JSON.stringify(incoming());
  await bot.receive({ rawBody: raw, headers: chatwootHeaders(raw) });
  await bot.idle();
  assert.ok(calls.project.some((call) => call.path.endsWith("/generate") && call.signed));
  const sent = calls.chatwoot.find((call) => call.path.endsWith("/messages"));
  assert.equal(sent.body.content, "Resposta do projeto.");
});

test("adaptador da Anthropic: cabeçalhos, esquema, sem temperature e fallbacks no modelo que aceita", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, headers: init.headers, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ model: "claude-opus-5-5", stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }, { type: "text", text: reply("oi") }] }), { status: 200 });
  };
  const ai = normalizeConfig(baseConfig({ ai: { provider: "anthropic" } })).ai;
  const result = await anthropicGenerate({ ai, system: "s", messages: [{ role: "user", content: "oi" }], schema: ACTION_SCHEMA, keys: { ANTHROPIC_API_KEY: "k" }, fetchImpl });
  assert.equal(seen.url, "https://api.anthropic.com/v1/messages");
  assert.equal(seen.headers["anthropic-version"], "2026-10-21");
  assert.equal(seen.headers["anthropic-beta"], "server-side-fallback-2026-07-01");
  assert.equal(seen.body.model, "claude-opus-5-5");
  assert.equal(seen.body.fallbacks, "default");
  assert.equal(seen.body.output_config.effort, "low");
  assert.deepEqual(seen.body.output_config.format, { type: "json_schema", schema: ACTION_SCHEMA });
  assert.equal("temperature" in seen.body, false);
  assert.equal(parseAction(result.text).text, "oi");
});

test("adaptador da Anthropic: recusa vira ai_refused; modelo sem fallback não manda o cabeçalho", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { headers: init.headers, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ stop_reason: "refusal", content: [] }), { status: 200 });
  };
  const ai = normalizeConfig(baseConfig({ ai: { provider: "anthropic", model: "claude-haiku-5-5" } })).ai;
  await assert.rejects(
    anthropicGenerate({ ai, system: "s", messages: [{ role: "user", content: "oi" }], schema: ACTION_SCHEMA, keys: { ANTHROPIC_API_KEY: "k" }, fetchImpl }),
    (error) => error.code === "ai_refused",
  );
  assert.equal(seen.headers["anthropic-beta"], undefined);
  assert.equal(seen.body.fallbacks, undefined);
});

test("adaptador OpenAI compatível: base_url, key_env e json_object", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, headers: init.headers, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ choices: [{ message: { content: reply("ok") }, finish_reason: "stop" }] }), { status: 200 });
  };
  const ai = normalizeConfig(baseConfig({ ai: { provider: "openai", model: "m", base_url: "https://openrouter.test/api/v1", key_env: "OPENROUTER_API_KEY", json: "object" } })).ai;
  await openaiGenerate({ ai, system: "s", messages: [{ role: "user", content: "oi" }], schema: ACTION_SCHEMA, keys: { OPENROUTER_API_KEY: "or" }, fetchImpl });
  assert.equal(seen.url, "https://openrouter.test/api/v1/chat/completions");
  assert.equal(seen.headers.authorization, "Bearer or");
  assert.deepEqual(seen.body.response_format, { type: "json_object" });
  assert.equal(seen.body.messages[0].role, "system");
});

test("key_env só aceita nomes terminados em _API_KEY", async () => {
  const ai = normalizeConfig(baseConfig({ ai: { provider: "openai", model: "m", key_env: "SUPPORT_BOT_SECRET" } })).ai;
  await assert.rejects(
    openaiGenerate({ ai, system: "s", messages: [], schema: ACTION_SCHEMA, keys: { SUPPORT_BOT_SECRET: "x" }, fetchImpl: async () => new Response("{}") }),
    (error) => error.code === "ai_key_missing",
  );
});

test("adaptador Gemini: esquema sem additionalProperties e papéis user e model", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, headers: init.headers, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: reply("ok") }] }, finishReason: "STOP" }] }), { status: 200 });
  };
  const ai = normalizeConfig(baseConfig({ ai: { provider: "gemini", model: "gemini-modelo" } })).ai;
  await geminiGenerate({ ai, system: "s", messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }], schema: ACTION_SCHEMA, keys: { GEMINI_API_KEY: "g" }, fetchImpl });
  assert.match(seen.url, /models\/gemini-modelo:generateContent$/);
  assert.equal(seen.headers["x-goog-api-key"], "g");
  assert.deepEqual(seen.body.contents.map((content) => content.role), ["user", "model"]);
  assert.equal(JSON.stringify(seen.body.generationConfig.responseSchema).includes("additionalProperties"), false);
  assert.deepEqual(geminiSchema({ a: { additionalProperties: false, b: 1 } }), { a: { b: 1 } });
});

test("horário de atendimento no fuso e feriado", () => {
  const hours = { timezone: "America/Sao_Paulo", days: { seg: [["08:00", "18:00"]] }, holidays: ["2026-11-16"] };
  assert.equal(teamAvailable(hours, new Date("2026-11-09T14:00:00Z")), true); // segunda 11:00
  assert.equal(teamAvailable(hours, new Date("2026-11-09T22:30:00Z")), false); // segunda 19:30
  assert.equal(teamAvailable(hours, new Date("2026-11-10T14:00:00Z")), false); // terça sem faixa
  assert.equal(teamAvailable(hours, new Date("2026-11-16T14:00:00Z")), false); // feriado
  assert.equal(teamAvailable(null), true);
});

test("palavras que chamam a equipe: sem acento, inteiras", () => {
  assert.equal(asksForTeam("Quero falar com alguém por favor", ["falar com alguem"]), true);
  assert.equal(asksForTeam("O atendimento humano demora?", ["humano"]), true);
  assert.equal(asksForTeam("humanoide", ["humano"]), false);
});

test("configuração: tokens obrigatórios e padrões preenchidos", () => {
  assert.throws(() => normalizeConfig({ chatwoot: {} }), (error) => error.code === "config_invalid");
  const config = normalizeConfig(baseConfig({ enabled: false }));
  assert.equal(config.mode, "desligado");
  assert.equal(config.ai.max_tokens, 16000);
  assert.equal(config.handoff.max_bot_turns, 8);
});

test("prompt: parte fixa com regras, conhecimento e protocolo; data e nome só na parte variável", () => {
  const config = normalizeConfig(baseConfig());
  const { stable, volatile } = buildSystemPrompt(config, { now: new Date(NOW), contactName: "Maria" });
  assert.match(stable, /assistente virtual de atendimento de Loja Exemplo/);
  assert.match(stable, /Pergunta: Qual o prazo\?/);
  assert.match(stable, /consultar_pedido/);
  assert.match(stable, /category: em handoff/);
  assert.doesNotMatch(stable, /Agora:|Maria/, "o que muda a cada mensagem fica fora da parte que vai para o cache");
  assert.match(volatile, /Agora: 2026-11-09 11:00/);
  assert.match(volatile, /Nome da pessoa no WhatsApp: Maria/);
  const again = buildSystemPrompt(config, { now: new Date(NOW + 3600000), contactName: "João" });
  assert.equal(again.stable, stable, "a parte fixa é igual entre mensagens");
  const prompt = `${stable}\n${volatile}`;
  assert.doesNotMatch(prompt, /—|–/);
  assert.deepEqual(toMessages([{ role: "equipe", text: "Olá" }, { role: "cliente", text: "Oi" }]), [{ role: "user", content: "Oi" }]);
});

test("parseAction aceita JSON cercado de texto e recusa ação desconhecida", () => {
  assert.equal(parseAction(`aqui: ${reply("ok")} fim`).text, "ok");
  assert.throws(() => parseAction('{"action":"apagar"}'), (error) => error.code === "ai_bad_action");
  assert.throws(() => parseAction("sem json"), (error) => error.code === "ai_bad_json");
});

test("registro descarta campos fora da lista", () => {
  const lines = [];
  const logger = createLogger({ write: (line) => lines.push(line), clock: () => new Date(NOW) });
  logger.info({ event: "x", account: 1, content: "texto do cliente", phone_number: "+55" });
  const record = JSON.parse(lines[0]);
  assert.equal(record.event, "x");
  assert.equal("content" in record, false);
  assert.equal("phone_number" in record, false);
});

test("espera entre tentativas: retry-after manda; sem ele, a espera cresce", () => {
  assert.equal(waitFor(0, null), 500);
  assert.equal(waitFor(1, undefined), 1000);
  assert.equal(waitFor(0, ""), 500);
  assert.equal(waitFor(0, "2"), 2000);
  assert.equal(waitFor(0, "99"), 10000);
});

test("fila: conversas diferentes andam em paralelo, a mesma em ordem", async () => {
  const order = [];
  const queue = createConversationQueue({
    debounceMs: 1,
    run: async (key, items) => {
      order.push(`${key}:${items.length}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
    },
  });
  queue.push("a", 1);
  queue.push("a", 2);
  queue.push("b", 1);
  await queue.idle();
  assert.deepEqual(order.sort(), ["a:2", "b:1"]);
});

// ---------- camadas, cache, relatório e aprendizado ----------

test("prompt: regras da plataforma vêm antes e valem acima das da empresa", () => {
  const config = normalizeConfig(baseConfig({
    platform_instructions: "Nunca dê parecer jurídico; passe para um advogado.",
    platform_knowledge: [{ q: "Quem é a plataforma?", a: "Um sistema para escritórios." }],
  }));
  const { stable } = buildSystemPrompt(config, { now: new Date(NOW) });
  assert.match(stable, /9\. As regras e o conhecimento da plataforma valem acima/);
  const rules = stable.indexOf("Regras da plataforma:");
  const company = stable.indexOf("Instruções de Loja Exemplo:");
  assert.ok(rules > 0 && company > rules);
  assert.ok(stable.indexOf("Conhecimento da plataforma:") < stable.indexOf("Conhecimento de Loja Exemplo:"));
  const plain = buildSystemPrompt(normalizeConfig(baseConfig()), { now: new Date(NOW) }).stable;
  assert.doesNotMatch(plain, /Regras da plataforma|9\. As regras/);
});

test("Anthropic: a parte fixa vai num bloco com cache e a variável depois", () => {
  assert.deepEqual(systemBlocks({ stable: "fixo", volatile: "agora" }), [
    { type: "text", text: "fixo", cache_control: { type: "ephemeral" } },
    { type: "text", text: "agora" },
  ]);
  assert.deepEqual(systemBlocks({ stable: "fixo", volatile: "" }, "1h")[0].cache_control, { type: "ephemeral", ttl: "1h" });
  assert.equal(systemBlocks("texto"), "texto");
});

test("OpenAI: parte fixa no começo da mensagem de sistema, para o cache por prefixo", async () => {
  let seen;
  const fetchImpl = async (_url, init) => {
    seen = JSON.parse(init.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: reply("ok") }, finish_reason: "stop" }] }), { status: 200 });
  };
  const ai = normalizeConfig(baseConfig({ ai: { provider: "openai", model: "m" } })).ai;
  await openaiGenerate({ ai, system: { stable: "FIXO", volatile: "AGORA" }, messages: [{ role: "user", content: "oi" }], schema: ACTION_SCHEMA, keys: { OPENAI_API_KEY: "k" }, fetchImpl });
  assert.equal(seen.messages[0].content, "FIXO\n\nAGORA");
});

test("limpeza: tira e-mail, telefone, CPF, CNPJ, processo e cartão; mantém o resto", () => {
  const text = "Sou a Ana, ana@exemplo.com, (11) 99999-0000, CPF 123.456.789-09, CNPJ 12.345.678/0001-90, processo 0001234-56.2024.8.26.0100, cartão 4111 1111 1111 1111, pedido de 3 itens";
  const clean = scrub(text, 1000);
  for (const leaked of ["ana@exemplo.com", "99999-0000", "123.456.789-09", "12.345.678/0001-90", "0001234-56.2024.8.26.0100", "4111 1111"]) {
    assert.ok(!clean.includes(leaked), `vazou ${leaked}`);
  }
  assert.match(clean, /Sou a Ana/);
  assert.match(clean, /pedido de 3 itens/);
  assert.equal(scrub("a".repeat(500), 10), `${"a".repeat(10)}...`);
});

test("passagem decidida pela IA vai para o relatório com categoria, assunto e trecho limpo", async () => {
  const { calls, fetchImpl } = world({
    config: fakeProviderConfig({ report: { enabled: true } }),
    aiReplies: [handoff("não sei a política de troca", "", "nao_sei", "troca de produto")],
  });
  const bot = makeBot(fetchImpl);
  const raw = JSON.stringify(incoming({ content: "Posso trocar? Meu telefone é 11 98888-7777" }));
  await bot.receive({ rawBody: raw, headers: chatwootHeaders(raw) });
  await bot.idle();
  const event = calls.project.find((call) => call.path.endsWith("/events"));
  assert.ok(event?.signed);
  assert.equal(event.body.category, "nao_sei");
  assert.equal(event.body.topic, "troca de produto");
  assert.doesNotMatch(event.body.excerpt, /98888/);
  assert.equal(event.body.account_id, 3);
});

test("relatório desligado: nenhuma passagem vai para o sistema", async () => {
  const { calls, fetchImpl } = world({ config: fakeProviderConfig(), aiReplies: [] });
  const bot = makeBot(fetchImpl);
  const raw = JSON.stringify(incoming({ content: "quero falar com um atendente" }));
  await bot.receive({ rawBody: raw, headers: chatwootHeaders(raw) });
  await bot.idle();
  assert.equal(calls.project.some((call) => call.path.endsWith("/events")), false);
});

function resolved({ labels = ["robo-passou"], id = 7 } = {}) {
  return { event: "conversation_resolved", id, status: "resolved", labels, account: { id: 3, name: "Cliente" }, inbox_id: 5, meta: {}, messages: [] };
}

test("conversa passada e resolvida pela equipe vira sugestão de conhecimento, sem dado pessoal", async () => {
  const { calls, fetchImpl } = world({
    config: fakeProviderConfig({ learning: { enabled: true } }),
    history: [
      { role: "cliente", text: "Vocês entregam no sábado? meu email é ana@exemplo.com" },
      { role: "robo", text: "Vou chamar alguém da equipe." },
      { role: "equipe", text: "Entregamos aos sábados até as 14h, sem custo extra." },
    ],
    aiReplies: [JSON.stringify({ suggestions: [{ q: "Vocês entregam no sábado?", a: "Sim, aos sábados até as 14h, sem custo extra. Dúvidas: ana@exemplo.com", why: "pergunta comum" }] })],
  });
  const bot = makeBot(fetchImpl);
  const raw = JSON.stringify(resolved());
  assert.equal((await bot.receive({ rawBody: raw, headers: chatwootHeaders(raw) })).body.queued, true);
  await bot.idle();
  const transcript = calls.ai[0].body.messages.at(-1).content;
  assert.match(transcript, /Equipe: Entregamos aos sábados/);
  assert.doesNotMatch(transcript, /ana@exemplo\.com/, "a conversa vai para a IA já sem dado pessoal");
  const sent = calls.project.find((call) => call.path.endsWith("/suggestions"));
  assert.ok(sent?.signed);
  assert.equal(sent.body.suggestions.length, 1);
  assert.doesNotMatch(sent.body.suggestions[0].a, /ana@exemplo\.com/);
  assert.equal(calls.chatwoot.length, 0, "aprender não mexe na conversa");
});

test("sem etiqueta do robô, sem resposta da equipe ou com o aprendizado desligado, não há sugestão", async () => {
  const cases = [
    { config: fakeProviderConfig({ learning: { enabled: true } }), payload: resolved({ labels: ["vip"] }), history: [] },
    { config: fakeProviderConfig({ learning: { enabled: true } }), payload: resolved(), history: [{ role: "cliente", text: "oi" }, { role: "robo", text: "olá" }] },
    { config: fakeProviderConfig(), payload: resolved(), history: [{ role: "equipe", text: "resposta" }] },
  ];
  for (const item of cases) {
    const { calls, fetchImpl } = world({ config: item.config, history: item.history, aiReplies: [JSON.stringify({ suggestions: [{ q: "x", a: "y", why: "z" }] })] });
    const bot = makeBot(fetchImpl);
    const raw = JSON.stringify(item.payload);
    await bot.receive({ rawBody: raw, headers: chatwootHeaders(raw) });
    await bot.idle();
    assert.equal(calls.ai.length, 0);
    assert.equal(calls.project.some((call) => call.path.endsWith("/suggestions")), false);
  }
});
