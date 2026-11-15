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
    /**
     * Tira a pessoa da conta, sem apagá-la: ela pode estar na conta de outro cliente. O Chatwoot a tira das
     * caixas e das equipes e devolve à fila as conversas atribuídas a ela (Agents::DestroyJob). Sem a pessoa
     * na conta, a resposta também é 200.
     */
    removeAccountUser: (accountId, userId) => call("DELETE", `accounts/${Number(accountId)}/account_users?user_id=${Number(userId)}`),
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
    createInbox: ({ name, channel, ...fields }) => call("POST", "inboxes", { name, channel, ...fields }),
    /** provider_config só vem para administradores, como a conta de serviço. */
    inbox: (id) => call("GET", `inboxes/${Number(id)}`),
    updateInbox: (id, fields) => call("PATCH", `inboxes/${Number(id)}`, fields),
    /** Saúde do número na Meta (só caixa WhatsApp Cloud), consultada na hora. Erro da Meta volta como 422, com error.type. */
    inboxHealth: (id) => call("GET", `inboxes/${Number(id)}/health`),
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
    /**
     * Configurações da conta, só para administradores (AccountPolicy#update?). Aceita, entre outras,
     * auto_resolve_after, auto_resolve_message, auto_resolve_ignore_waiting e auto_resolve_label.
     */
    updateSettings: (fields) => requestJson(root, { method: "PATCH", headers: chatwootAuth(token), body: fields, fetchImpl, service: "chatwoot" }),
    /** As etiquetas da conta. O painel só mostra numa conversa a etiqueta que existe aqui (CardLabels.vue). */
    labels: async () => (await call("GET", "labels"))?.payload ?? [],
    createLabel: ({ title, description, color, show_on_sidebar }) => call("POST", "labels", { label: { title, description, color, show_on_sidebar } }),
    /** Busca no nome, e-mail, telefone e identificador, 15 por página; more diz se há outra página. */
    searchContacts: async (q, page = 1) => {
      const result = await call("GET", `contacts/search?q=${encodeURIComponent(q)}&page=${Number(page)}`);
      return { contacts: result?.payload ?? [], more: result?.meta?.has_more === true };
    },
    updateContact: (id, fields) => call("PUT", `contacts/${Number(id)}`, fields),
    /** Contato novo já ligado à caixa (contact_inbox); devolve o contato. */
    createContact: async (fields) => (await call("POST", "contacts", fields))?.payload?.contact ?? null,
    /** Conversa nova entre o contato e a caixa (o Chatwoot cria o contact_inbox se faltar). */
    createConversation: ({ inbox_id, contact_id, status = "open" }) => call("POST", "conversations", { inbox_id, contact_id, status }),
    conversation: (id) => call("GET", `conversations/${Number(id)}`),
    setConversationStatus: (id, status) => call("POST", `conversations/${Number(id)}/toggle_status`, { status }),
    setConversationLabels: (id, labels) => call("POST", `conversations/${Number(id)}/labels`, { labels }),
    /** Troca a lista de quem acompanha a conversa (avisos de mensagem nova). */
    setParticipants: (id, userIds) => call("PATCH", `conversations/${Number(id)}/participants`, { user_ids: userIds }),
    removeParticipants: (id, userIds) => call("DELETE", `conversations/${Number(id)}/participants`, { user_ids: userIds }),
    /** Troca a lista de membros da caixa: quem não está nela não vê a caixa. */
    setInboxMembers: (inboxId, userIds) => call("PATCH", "inbox_members", { inbox_id: inboxId, user_ids: userIds }),
    removeInboxMembers: (inboxId, userIds) => call("DELETE", "inbox_members", { inbox_id: inboxId, user_ids: userIds }),
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
