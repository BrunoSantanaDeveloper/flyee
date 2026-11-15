// O lado do projeto do contrato com o robô, sem framework: a rota do projeto (Next.js, Express, Nest...)
// monta o pedido, chama handleBotRequest e devolve status e corpo. Toda chamada vem assinada com
// SUPPORT_BOT_SECRET; sem assinatura válida, nada é lido.
//
//   GET  config?account_id=                       a configuração da conta (botConfig de shared/settings.mjs)
//   POST tools/<nome>                              { account_id, conversation_id, inbox_id, contact, input }
//   GET  history?account_id=&conversation_id=&limit=   { messages: [{ role, text, at }] }
//   POST generate                                  a ação (ou as sugestões), quando o provedor de IA é o próprio projeto
//   POST transcribe                                { account_id, conversation_id, kind, mime, seconds, data, part, parts } e volta { ok, text },
//                                                  quando o projeto declara ai.transcription "project"
//   POST events                                    { kind: "handoff", account_id, conversation_id, category, topic, reason, excerpt, at }
//   POST suggestions                               { account_id, conversation_id, suggestions: [{ q, a, why }], at }

import { verifyProjectRequest } from "../shared/signature.mjs";

function header(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === "function") return headers.get(name) ?? undefined;
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * request: { method, pathWithQuery, route, query, rawBody, headers }
 *   pathWithQuery: o caminho completo pedido, com a query, exatamente como chegou (é o que foi assinado);
 *   route: o trecho depois da base das rotas do robô ("config", "tools/consultar_pedido", "history", "generate").
 * handlers: { secret, getConfig(accountId), runTool(name, payload), getHistory(accountId, conversationId, limit),
 *   generate?(payload), transcribe?(payload), saveEvent?(accountId, event), saveSuggestions?(accountId, payload) }
 */
export async function handleBotRequest(request, handlers) {
  const method = String(request.method ?? "GET").toUpperCase();
  const check = verifyProjectRequest({
    secret: handlers.secret,
    method,
    pathWithQuery: request.pathWithQuery,
    body: request.rawBody ?? "",
    timestamp: header(request.headers, "x-support-timestamp"),
    signature: header(request.headers, "x-support-signature"),
    now: handlers.now ? handlers.now() : Date.now(),
  });
  if (!check.ok) return { status: 401, body: { ok: false, code: check.code } };

  const route = String(request.route ?? "").replace(/^\/+|\/+$/g, "");
  const query = request.query ?? {};
  const accountId = Number(query.account_id);
  try {
    if (method === "GET" && route === "config") {
      if (!Number.isInteger(accountId)) return { status: 400, body: { ok: false, code: "account_id_missing" } };
      const config = await handlers.getConfig(accountId);
      return config ? { status: 200, body: config } : { status: 404, body: { ok: false, code: "account_unknown" } };
    }
    if (method === "POST" && route.startsWith("tools/")) {
      const name = decodeURIComponent(route.slice("tools/".length));
      let payload;
      try {
        payload = JSON.parse(request.rawBody || "{}");
      } catch {
        return { status: 400, body: { ok: false, code: "bad_json" } };
      }
      const result = await handlers.runTool(name, payload);
      return { status: 200, body: result ?? { ok: false, code: "empty" } };
    }
    if (method === "GET" && route === "history") {
      const conversationId = Number(query.conversation_id);
      if (!Number.isInteger(accountId) || !Number.isInteger(conversationId)) return { status: 400, body: { ok: false, code: "ids_missing" } };
      const messages = await handlers.getHistory(accountId, conversationId, Number(query.limit) || 20);
      return { status: 200, body: { messages: messages ?? [] } };
    }
    if (method === "POST" && route === "generate" && handlers.generate) {
      const payload = JSON.parse(request.rawBody || "{}");
      return { status: 200, body: await handlers.generate(payload) };
    }
    if (method === "POST" && route === "transcribe") {
      if (!handlers.transcribe) return { status: 404, body: { ok: false, code: "not_enabled" } };
      let payload;
      try {
        payload = JSON.parse(request.rawBody || "{}");
      } catch {
        return { status: 400, body: { ok: false, code: "bad_json" } };
      }
      if (!Number.isInteger(Number(payload?.account_id)) || typeof payload?.data !== "string" || !payload.data) {
        return { status: 400, body: { ok: false, code: "audio_missing" } };
      }
      const result = await handlers.transcribe({ ...payload, account_id: Number(payload.account_id), mime: String(payload.mime ?? "audio/mpeg") });
      // O projeto pode recusar a parte (sem chave da empresa, teto de gasto, grande demais): o áudio vai para a equipe.
      if (result && typeof result === "object" && result.ok === false) return { status: 200, body: { ok: false, code: String(result.code ?? "refused") } };
      return { status: 200, body: { ok: true, text: String(result ?? "").trim() } };
    }
    if (method === "POST" && (route === "events" || route === "suggestions")) {
      const handler = route === "events" ? handlers.saveEvent : handlers.saveSuggestions;
      if (!handler) return { status: 404, body: { ok: false, code: "not_enabled" } };
      let payload;
      try {
        payload = JSON.parse(request.rawBody || "{}");
      } catch {
        return { status: 400, body: { ok: false, code: "bad_json" } };
      }
      const payloadAccount = Number(payload?.account_id);
      if (!Number.isInteger(payloadAccount)) return { status: 400, body: { ok: false, code: "account_id_missing" } };
      await handler(payloadAccount, payload);
      return { status: 200, body: { ok: true } };
    }
    return { status: 404, body: { ok: false, code: "not_found" } };
  } catch (error) {
    return { status: 500, body: { ok: false, code: error?.code ?? "error" } };
  }
}

/**
 * Executor das consultas que o projeto declara. tools: [{ name, description, input_schema, run }].
 * isEnabled(accountId, name) diz se o cliente ligou a consulta na tela do robô; desligada, não roda.
 * run recebe { accountId, conversationId, inboxId, contact, input } e devolve só dados da pessoa da conversa.
 * Conversa de grupo nunca consulta (o contato é o grupo, e todos leem a resposta): devolve group_chat.
 */
export function createToolRunner(tools, { isEnabled = async () => true } = {}) {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  return async (name, payload) => {
    if (/@g\.us$/i.test(String(payload?.contact?.identifier ?? "").trim())) return { ok: false, code: "group_chat" };
    const tool = byName.get(name);
    if (!tool) return { ok: false, code: "tool_unknown" };
    const accountId = Number(payload?.account_id);
    if (!(await isEnabled(accountId, name))) return { ok: false, code: "tool_disabled" };
    return tool.run({
      accountId,
      conversationId: Number(payload?.conversation_id),
      inboxId: payload?.inbox_id ?? null,
      contact: payload?.contact ?? {},
      input: payload?.input ?? {},
    });
  };
}

/**
 * O que a tela do robô sabe sobre ouvir áudio e a fala do vídeo. audio: true quando o robô consegue;
 * false quando não consegue (sem ffmpeg no contêiner, ou sem transcritor nem no contêiner nem no projeto),
 * e então a tela esconde "Ouvir áudios"; null quando não se sabe (o robô não respondeu ou é de uma versão
 * sem o campo), e a tela mostra tudo. ai: o provedor do sistema; health: o corpo do /health do robô.
 */
export function mediaSupportFrom({ ai = {}, health = null } = {}) {
  const media = health && typeof health === "object" ? health.media : null;
  if (media?.ffmpeg === false) return { audio: false };
  if (ai?.transcription === "project") return { audio: true };
  if (!media || typeof media !== "object" || !("transcriber" in media)) return { audio: null };
  return { audio: Boolean(media.transcriber) };
}

/** O /health do robô a partir do endereço público dele (SUPPORT_BOT_PUBLIC_URL, que termina em /chatwoot). */
export function botHealthUrl(botUrl) {
  return new URL("health", String(botUrl ?? "").replace(/\/+$/, "")).toString();
}

/** Pergunta ao /health do robô e devolve mediaSupportFrom. Sem resposta em timeoutMs, audio fica null. */
export async function mediaSupport({ ai = {}, botUrl, fetchImpl = fetch, timeoutMs = 3000 }) {
  let health = null;
  try {
    const response = await fetchImpl(botHealthUrl(botUrl), { signal: AbortSignal.timeout(timeoutMs) });
    if (response.ok) health = await response.json();
  } catch {
    health = null;
  }
  return mediaSupportFrom({ ai, health });
}
