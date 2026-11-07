// Clientes do Chatwoot para o servidor do projeto.
// chatwootPlatform: a API de plataforma, com o token do Platform App (contas, pessoas, papéis, login único).
// chatwootAccount: a API de uma conta, com o token da conta de serviço (administradora): caixas, robô, webhooks.
// chatwootProfile: o perfil de uma pessoa, com o token dela (preferências do painel).

import { chatwootAuth, requestJson } from "./request.mjs";

const trim = (url) => String(url ?? "").replace(/\/+$/, "");

export function chatwootPlatform({ url, token, fetchImpl = fetch }) {
  const root = trim(url);
  const call = (method, path, body) => requestJson(`${root}/platform/api/v1/${path}`, { method, headers: chatwootAuth(token), body, fetchImpl, service: "chatwoot" });
  return {
    createAccount: ({ name, locale = "pt_BR", features }) => call("POST", "accounts", { name, locale, ...(features ? { features } : {}) }),
    account: (id) => call("GET", `accounts/${Number(id)}`),
    updateAccount: (id, fields) => call("PATCH", `accounts/${Number(id)}`, fields),
    /** O Chatwoot devolve a pessoa que já existe com o mesmo e-mail (User.from_email). */
    createUser: ({ name, email, password, display_name }) => call("POST", "users", { name, email, password, ...(display_name ? { display_name } : {}) }),
    user: (id) => call("GET", `users/${Number(id)}`),
    updateUser: (id, fields) => call("PATCH", `users/${Number(id)}`, fields),
    accountUsers: (accountId) => call("GET", `accounts/${Number(accountId)}/account_users`),
    addAccountUser: (accountId, { user_id, role }) => call("POST", `accounts/${Number(accountId)}/account_users`, { user_id, role }),
    /** Link de entrada no painel: vale 5 minutos e uma vez só (app/models/concerns/sso_authenticatable.rb). */
    ssoLink: async (userId) => {
      const result = await call("GET", `users/${Number(userId)}/login`);
      return result?.url ?? null;
    },
  };
}

export function chatwootAccount({ url, token, accountId, fetchImpl = fetch }) {
  const root = `${trim(url)}/api/v1/accounts/${Number(accountId)}`;
  const call = (method, path, body) => requestJson(`${root}/${path}`, { method, headers: chatwootAuth(token), body, fetchImpl, service: "chatwoot" });
  return {
    inboxes: async () => (await call("GET", "inboxes"))?.payload ?? [],
    createInbox: ({ name, channel }) => call("POST", "inboxes", { name, channel }),
    setAgentBot: (inboxId, botId) => call("POST", `inboxes/${Number(inboxId)}/set_agent_bot`, { agent_bot: botId }),
    agentBots: async () => (await call("GET", "agent_bots")) ?? [],
    createAgentBot: ({ name, description, outgoing_url }) => call("POST", "agent_bots", { name, description, outgoing_url, bot_type: "webhook" }),
    updateAgentBot: (id, fields) => call("PATCH", `agent_bots/${Number(id)}`, fields),
    addInboxMembers: async (inboxId, userIds) => (await call("POST", "inbox_members", { inbox_id: inboxId, user_ids: userIds }))?.payload ?? [],
    webhooks: async () => (await call("GET", "webhooks"))?.payload?.webhooks ?? [],
    createWebhook: async ({ url: target, subscriptions }) => (await call("POST", "webhooks", { webhook: { url: target, subscriptions } }))?.payload?.webhook ?? null,
    updateWebhook: async (id, fields) => (await call("PATCH", `webhooks/${Number(id)}`, { webhook: fields }))?.payload?.webhook ?? null,
    dashboardApps: async () => (await call("GET", "dashboard_apps")) ?? [],
    /** Página do projeto como aba da conversa; o único tipo aceito é frame. */
    createDashboardApp: ({ title, url: target }) => call("POST", "dashboard_apps", { dashboard_app: { title, content: [{ type: "frame", url: target }] } }),
    /** Mensagens de uma conversa (message_type numérico: 0 recebida, 1 enviada, 2 atividade, 3 modelo). */
    messages: async (conversationId) => (await call("GET", `conversations/${Number(conversationId)}/messages`))?.payload ?? [],
  };
}

export function chatwootProfile({ url, userToken, fetchImpl = fetch }) {
  const root = `${trim(url)}/api/v1/profile`;
  return {
    get: () => requestJson(root, { headers: chatwootAuth(userToken), fetchImpl, service: "chatwoot" }),
    /** Junta as preferências novas às que a pessoa já tem; o Chatwoot grava o objeto inteiro. */
    mergeUiSettings: async (uiSettings) => {
      const current = (await requestJson(root, { headers: chatwootAuth(userToken), fetchImpl, service: "chatwoot" }))?.ui_settings ?? {};
      return requestJson(root, {
        method: "PUT",
        headers: chatwootAuth(userToken),
        body: { profile: { ui_settings: { ...current, ...uiSettings } } },
        fetchImpl,
        service: "chatwoot",
      });
    },
  };
}
