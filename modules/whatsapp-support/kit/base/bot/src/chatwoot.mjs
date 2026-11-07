// Cliente da API de contas do Chatwoot com o token do robô da conta. O Chatwoot só deixa um robô
// chamar estas rotas (app/controllers/concerns/access_token_auth_helper.rb, BOT_ACCESSIBLE_ENDPOINTS):
// conversa (ver, mudar estado, digitação, prioridade, atributos), mensagem (criar), atribuição (criar)
// e etiquetas (ler e gravar).

import { requestJson } from "./http.mjs";

export function chatwootClient({ baseUrl, token, fetchImpl = fetch, timeoutMs = 15000 }) {
  const root = String(baseUrl ?? "").replace(/\/+$/, "");
  const call = (method, path, body) =>
    requestJson(`${root}/api/v1/accounts/${path}`, {
      method,
      // Os dois cabeçalhos: proxies como o Nginx descartam por padrão nomes com sublinhado.
      headers: { authorization: `Bearer ${token}`, api_access_token: token },
      body,
      timeoutMs,
      retries: 2,
      fetchImpl,
    }).then((response) => response.json);
  const conversation = (accountId, conversationId) => `${Number(accountId)}/conversations/${Number(conversationId)}`;

  return {
    /** A conversa como o Chatwoot a vê agora (o estado pode ter mudado durante a espera). */
    show: (accountId, conversationId) => call("GET", conversation(accountId, conversationId)),

    /** Mensagem para o cliente (privateNote false) ou nota interna para a equipe (privateNote true). */
    send: (accountId, conversationId, { content, privateNote = false }) =>
      call("POST", `${conversation(accountId, conversationId)}/messages`, {
        content,
        message_type: "outgoing",
        private: Boolean(privateNote),
      }),

    /** Passa a conversa pendente para a equipe: o Chatwoot faz o bot_handoff quando é o robô quem abre. */
    handoff: (accountId, conversationId) =>
      call("POST", `${conversation(accountId, conversationId)}/toggle_status`, { status: "open" }),

    typing: (accountId, conversationId, on) =>
      call("POST", `${conversation(accountId, conversationId)}/toggle_typing_status`, { typing_status: on ? "on" : "off" }),

    labels: async (accountId, conversationId) => {
      const result = await call("GET", `${conversation(accountId, conversationId)}/labels`);
      return Array.isArray(result?.payload) ? result.payload : [];
    },

    setLabels: (accountId, conversationId, labels) =>
      call("POST", `${conversation(accountId, conversationId)}/labels`, { labels }),

    assignTeam: (accountId, conversationId, teamId) =>
      call("POST", `${conversation(accountId, conversationId)}/assignments`, { team_id: teamId }),
  };
}
