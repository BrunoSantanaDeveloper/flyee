// Cliente das rotas que o projeto expõe para o robô, todas assinadas com SUPPORT_BOT_SECRET:
//   GET  <base>/config?account_id=           a configuração da conta (robô, IA, horário, ferramentas, tokens)
//   POST <base>/tools/<nome>                  uma consulta declarada pelo projeto, que aplica a restrição
//   GET  <base>/history?account_id=&conversation_id=&limit=   as últimas mensagens, quando o robô reinicia
//   POST <base>/generate                      a próxima ação, quando o provedor de IA é o próprio projeto

import { requestJson } from "./http.mjs";
import { signProjectRequest } from "./signature.mjs";

export function projectClient({ baseUrl, secret, fetchImpl = fetch, timeoutMs = 10000 }) {
  const root = new URL(String(baseUrl ?? "").replace(/\/+$/, "") + "/");

  const call = async (method, relativePath, { query, body, timeout = timeoutMs } = {}) => {
    const url = new URL(relativePath, root);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    const rawBody = body === undefined ? "" : JSON.stringify(body);
    const headers = signProjectRequest({ secret, method, pathWithQuery: `${url.pathname}${url.search}`, body: rawBody });
    const response = await requestJson(url.toString(), {
      method,
      headers,
      rawBody: body === undefined ? undefined : rawBody,
      timeoutMs: timeout,
      retries: method === "GET" ? 1 : 0,
      fetchImpl,
    });
    return response.json;
  };

  return {
    config: (accountId, { timeout } = {}) => call("GET", "config", { query: { account_id: accountId }, timeout }),
    tool: (name, payload) => call("POST", `tools/${encodeURIComponent(name)}`, { body: payload }),
    history: (accountId, conversationId, limit = 20) =>
      call("GET", "history", { query: { account_id: accountId, conversation_id: conversationId, limit } }),
    generate: (payload, { timeout = 60000 } = {}) => call("POST", "generate", { body: payload, timeout }),
  };
}
