// Grupos do WhatsApp (D23 do plano): configuração em camadas, repasse no OpenWA, nomes no painel,
// etiquetas da conta e a recusa de consulta numa conversa de grupo.

import assert from "node:assert/strict";
import { test } from "node:test";

import { createToolRunner } from "../kit/base/server/bot-contract.mjs";
import { KIT_LABELS, RELAY_NAME, autoResolveMinutes, groupContactName, provisionAccount, syncOpenWAGroups } from "../kit/base/server/provision.mjs";
import {
  applyClientEdits,
  botConfig,
  clientPermissions,
  defaultPlatformSettings,
  defaultSettings,
  editableGroups,
  groupSettings,
  validateSettings,
} from "../kit/base/shared/settings.mjs";

const json = (status, value) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

test("configuração: grupos ficam fora por padrão e a plataforma decide se o cliente pode mudar", () => {
  assert.deepEqual(defaultSettings("Loja").groups, { mode: "fora", call_words: [], team_id: null });
  const platform = defaultPlatformSettings("Sistema");
  assert.equal(platform.client_permissions.grupos, false);
  assert.ok(editableGroups("plataforma", "por-cliente", platform).includes("grupos"));
  assert.equal(editableGroups("cliente", "por-cliente", platform).includes("grupos"), false);
  const allowed = { ...platform, client_permissions: { ...platform.client_permissions, grupos: true } };
  assert.ok(editableGroups("cliente", "por-cliente", allowed).includes("grupos"));
  assert.equal(clientPermissions("plataforma", allowed).grupos, false, "no modelo plataforma o cliente nunca muda");
});

test("configuração: validação dos grupos", () => {
  const base = defaultSettings("Loja");
  const fields = (groups) => validateSettings({ ...base, groups }).map((problem) => problem.field);
  assert.deepEqual(fields({ mode: "equipe", call_words: [], team_id: null }), []);
  assert.deepEqual(fields({ mode: "chamado", call_words: ["Ana"], team_id: 2 }), []);
  assert.deepEqual(fields({ mode: "todos", call_words: [], team_id: null }), ["groups.mode"]);
  assert.deepEqual(fields({ mode: "chamado", call_words: [], team_id: null }), ["groups.call_words"]);
  assert.deepEqual(fields({ mode: "chamado", call_words: Array.from({ length: 21 }, (_, index) => `p${index}`), team_id: null }), ["groups.call_words"]);
  assert.deepEqual(fields({ mode: "chamado", call_words: [" "], team_id: null }), ["groups.call_words"]);
  assert.deepEqual(fields({ mode: "equipe", call_words: [], team_id: "vendas" }), ["groups.team_id"]);
  assert.deepEqual(validateSettings({ ...base, groups: undefined }), [], "camada gravada antes dos grupos continua válida");
});

test("configuração: o cliente só muda os grupos com a permissão, e o que vale segue as camadas", () => {
  const platform = { ...defaultPlatformSettings("Sistema"), groups: { mode: "equipe", call_words: [], team_id: 3 } };
  const client = { ...defaultSettings("Loja"), groups: { mode: "chamado", call_words: ["Ana"], team_id: null } };
  const blocked = applyClientEdits(defaultSettings("Loja"), { groups: client.groups }, clientPermissions("por-cliente", platform));
  assert.deepEqual(blocked.groups, { mode: "fora", call_words: [], team_id: null }, "sem a permissão o servidor descarta");
  assert.deepEqual(groupSettings({ model: "por-cliente", platform, client }), { mode: "equipe", call_words: [], team_id: 3 });
  const allowed = { ...platform, client_permissions: { ...platform.client_permissions, grupos: true } };
  assert.deepEqual(applyClientEdits(defaultSettings("Loja"), { groups: client.groups }, clientPermissions("por-cliente", allowed)).groups, client.groups);
  assert.deepEqual(groupSettings({ model: "por-cliente", platform: allowed, client }), { mode: "chamado", call_words: ["Ana"], team_id: null });
  assert.deepEqual(groupSettings({ model: "plataforma", platform: allowed, client }), { mode: "equipe", call_words: [], team_id: 3 });
  assert.deepEqual(groupSettings({ model: "por-cliente", platform: allowed, client: { ...client, groups: undefined } }).mode, "equipe", "cliente que nunca escolheu fica com a plataforma");
  assert.deepEqual(botConfig({ model: "por-cliente", platform: allowed, client, state: {}, tools: [] }).groups, { mode: "chamado", call_words: ["Ana"], team_id: null });
  assert.deepEqual(botConfig({ model: "plataforma", platform: defaultPlatformSettings("S"), state: {} }).groups.mode, "fora");
});

test("consultas: conversa de grupo é recusada pelo projeto sem rodar a consulta", async () => {
  let ran = 0;
  const run = createToolRunner([{ name: "consultar_pedido", description: "", input_schema: {}, run: async () => ((ran += 1), { ok: true }) }]);
  assert.deepEqual(await run("consultar_pedido", { account_id: 3, contact: { identifier: "120363021234567890@g.us" }, input: {} }), { ok: false, code: "group_chat" });
  assert.equal(ran, 0);
  assert.deepEqual(await run("consultar_pedido", { account_id: 3, contact: { identifier: "5511999990000@c.us" }, input: {} }), { ok: true });
  assert.equal(ran, 1);
});

function fakeLabelsChatwoot({ existing = [], failLabels = false, failUser = false, failSettings = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const target = new URL(url);
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method, path: target.pathname, body });
    if (target.pathname === "/api/v1/accounts/3/labels") {
      if (failLabels) return json(500, {});
      if (method === "GET") return json(200, { payload: existing.map((title, index) => ({ id: index + 1, title })) });
      return json(200, { id: 50, ...body.label });
    }
    if (method === "PATCH" && target.pathname.startsWith("/platform/api/v1/accounts/")) return json(200, { id: 3 });
    if (method === "PATCH" && /^\/platform\/api\/v1\/users\/\d+$/.test(target.pathname)) return failUser ? json(500, {}) : json(200, { id: Number(target.pathname.split("/").pop()), ...body });
    if (method === "PATCH" && target.pathname.startsWith("/api/v1/accounts/3/agent_bots/")) return json(200, {});
    if (method === "PATCH" && target.pathname === "/api/v1/accounts/3") return failSettings ? json(500, {}) : json(200, { id: 3, settings: body });
    return json(404, {});
  };
  return { calls, fetchImpl };
}

const READY = { account_id: 3, service_user_id: 5, service_token: "svc", bot_id: 7, bot_token: "t", bot_secret: "s" };

test("provisionamento: cria na conta as etiquetas que o robô usa, uma vez só", async () => {
  const { calls, fetchImpl } = fakeLabelsChatwoot({ existing: ["robo-passou"] });
  const state = await provisionAccount({ chatwootUrl: "https://chat.test", platformToken: "p", state: READY, input: { botUrl: "https://robo.test/chatwoot" }, fetchImpl });
  const created = calls.filter((call) => call.method === "POST" && call.path.endsWith("/labels")).map((call) => call.body.label);
  assert.deepEqual(created.map((label) => label.title), ["grupo", "celular"], "a que já existe não é criada de novo");
  assert.equal(created[0].show_on_sidebar, true);
  assert.deepEqual(state.labels.sort(), KIT_LABELS.map((label) => label.title).sort());

  const again = fakeLabelsChatwoot();
  await provisionAccount({ chatwootUrl: "https://chat.test", platformToken: "p", state, input: { botUrl: "https://robo.test/chatwoot" }, fetchImpl: again.fetchImpl });
  assert.equal(again.calls.some((call) => call.path.endsWith("/labels")), false, "conta já conferida não pergunta de novo");

  const failing = fakeLabelsChatwoot({ failLabels: true });
  const kept = await provisionAccount({ chatwootUrl: "https://chat.test", platformToken: "p", state: READY, input: { botUrl: "https://robo.test/chatwoot" }, fetchImpl: failing.fetchImpl });
  assert.equal(kept.labels, undefined, "falha nas etiquetas não derruba o provisionamento e tenta de novo depois");
  assert.equal(kept.bot_id, 7);
});

/** OpenWA e Chatwoot falsos para a sincronia dos grupos. */
function fakeGroupStack({ relayGroups = false, groups = null, contacts = [], groupsFail = false } = {}) {
  const calls = [];
  let instanceConfig = { baseUrl: "https://chat.test", apiToken: "****", accountId: 3, inboxId: 12, ...(relayGroups === null ? {} : { relayGroups }), relayMedia: true };
  const fetchImpl = async (url, init = {}) => {
    const target = new URL(url);
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    const path = target.pathname;
    calls.push({ host: target.host, method, path, body, query: Object.fromEntries(target.searchParams) });
    if (target.host === "wa.test") {
      if (path === "/api/integration/plugins/chatwoot-adapter/instances/atendimento-loja") {
        if (method === "GET") return json(200, { instanceId: "atendimento-loja", config: instanceConfig });
        instanceConfig = body.config;
        return json(200, { instanceId: "atendimento-loja", config: instanceConfig });
      }
      if (path === "/api/sessions/sess-1/groups") return groupsFail ? json(503, { message: "session not ready" }) : json(200, groups ?? []);
    }
    if (target.host === "chat.test") {
      if (method === "GET" && path === "/api/v1/accounts/3/contacts/search") {
        const page = Number(target.searchParams.get("page"));
        const slice = contacts.slice((page - 1) * 15, page * 15);
        return json(200, { meta: { has_more: contacts.length > page * 15 }, payload: slice });
      }
      if (method === "PUT" && /^\/api\/v1\/accounts\/3\/contacts\/\d+$/.test(path)) return json(200, { id: Number(path.split("/").pop()), ...body });
    }
    return json(404, { error: `rota falsa ausente ${method} ${path}` });
  };
  return { calls, fetchImpl, config: () => instanceConfig };
}

const STATE = { account_id: 3, service_token: "svc", inboxes: [{ id: 12, route: "nao_oficial", session_id: "sess-1", instance_id: "atendimento-loja" }] };
const SYNC = { chatwootUrl: "https://chat.test", state: STATE, openwaUrl: "https://wa.test", openwaApiKey: "k" };

test("sincronia: ligar os grupos muda só o repasse no adaptador e dá aos grupos o nome do WhatsApp", async () => {
  const contacts = Array.from({ length: 16 }, (_, index) => ({ id: 200 + index, name: `Group 1203630${index}@g.us`, identifier: `1203630${index}@g.us` }));
  contacts.push({ id: 300, name: groupContactName("Diretoria"), identifier: "999@g.us" });
  const stack = fakeGroupStack({
    relayGroups: false,
    groups: [{ id: "12036300@g.us", name: "Vendas" }, { id: "120363015@g.us", name: "Suporte VIP" }, { id: "999@g.us", name: "Diretoria" }],
    contacts,
  });
  const result = await syncOpenWAGroups({ ...SYNC, relay: true, fetchImpl: stack.fetchImpl });
  assert.deepEqual(result, { sessions: 1, changed: 1, renamed: 2, unread: 0 });
  const patch = stack.calls.find((call) => call.method === "PATCH");
  assert.equal(patch.body.config.relayGroups, true);
  assert.equal(patch.body.config.apiToken, "****", "o segredo mascarado volta como veio, e o OpenWA o restaura");
  assert.equal(patch.body.config.relayMedia, true, "o resto da configuração fica igual");
  const renamed = stack.calls.filter((call) => call.method === "PUT").map((call) => [call.path.split("/").pop(), call.body.name]);
  assert.deepEqual(renamed, [["200", "Grupo: Vendas"], ["215", "Grupo: Suporte VIP"]], "duas páginas lidas; quem já tem o nome fica");
  assert.deepEqual(stack.calls.filter((call) => call.path.endsWith("/contacts/search")).map((call) => call.query.q), ["@g.us", "@g.us"]);

  const again = await syncOpenWAGroups({ ...SYNC, relay: true, fetchImpl: fakeGroupStack({ relayGroups: true, groups: [], contacts }).fetchImpl });
  assert.equal(again.changed, 0, "repasse já ligado não muda");
});

test("sincronia: o adaptador sem o campo conta como repasse ligado; desligar não lê grupos nem contatos", async () => {
  const stack = fakeGroupStack({ relayGroups: null, groups: [{ id: "1@g.us", name: "Vendas" }] });
  const result = await syncOpenWAGroups({ ...SYNC, relay: false, fetchImpl: stack.fetchImpl });
  assert.equal(result.changed, 1);
  assert.equal(stack.config().relayGroups, false);
  assert.equal(stack.calls.some((call) => call.path.endsWith("/groups") || call.path.includes("/contacts")), false);
});

test("sincronia: sessão que não lista os grupos fica para depois, sem desfazer o repasse", async () => {
  const stack = fakeGroupStack({ relayGroups: false, groupsFail: true });
  const result = await syncOpenWAGroups({ ...SYNC, relay: true, fetchImpl: stack.fetchImpl });
  assert.deepEqual(result, { sessions: 1, changed: 1, renamed: 0, unread: 1 });
  assert.equal(stack.config().relayGroups, true);
});

test("sincronia: conta só com a rota oficial não chama o OpenWA", async () => {
  const stack = fakeGroupStack();
  const result = await syncOpenWAGroups({ ...SYNC, state: { account_id: 3, inboxes: [{ id: 11, route: "oficial" }] }, relay: true, fetchImpl: stack.fetchImpl });
  assert.deepEqual(result, { sessions: 0, changed: 0, renamed: 0, unread: 0 });
  assert.equal(stack.calls.length, 0);
});

test("provisionamento: a pessoa de repasse de quem implantou antes passa a se chamar Celular do WhatsApp, uma vez só", async () => {
  const before = { ...READY, relay_user_id: 41, relay_token: "relay", labels: KIT_LABELS.map((label) => label.title) };
  const { calls, fetchImpl } = fakeLabelsChatwoot();
  const state = await provisionAccount({ chatwootUrl: "https://chat.test", platformToken: "p", state: before, input: { botUrl: "https://robo.test/chatwoot" }, fetchImpl });
  const rename = calls.find((call) => call.method === "PATCH" && call.path === "/platform/api/v1/users/41");
  assert.deepEqual(rename.body, { name: RELAY_NAME, display_name: RELAY_NAME });
  assert.equal(state.relay_name, RELAY_NAME);

  const again = fakeLabelsChatwoot();
  await provisionAccount({ chatwootUrl: "https://chat.test", platformToken: "p", state, input: { botUrl: "https://robo.test/chatwoot" }, fetchImpl: again.fetchImpl });
  assert.equal(again.calls.some((call) => call.path.startsWith("/platform/api/v1/users/")), false);

  const failing = fakeLabelsChatwoot({ failUser: true });
  const kept = await provisionAccount({ chatwootUrl: "https://chat.test", platformToken: "p", state: before, input: { botUrl: "https://robo.test/chatwoot" }, fetchImpl: failing.fetchImpl });
  assert.equal(kept.relay_name, undefined, "o nome é ajuda: a falha não derruba o provisionamento e tenta de novo depois");
});

// Resolução automática (D25): conversa aberta e parada volta ao robô na próxima mensagem do cliente.
const settingsCall = (calls) => calls.find((call) => call.method === "PATCH" && call.path === "/api/v1/accounts/3");
const PROVISION = { chatwootUrl: "https://chat.test", platformToken: "p" };

test("resolução automática: 8 horas por padrão, sem resolver quem espera resposta e sem mensagem ao cliente, uma vez só", async () => {
  const { calls, fetchImpl } = fakeLabelsChatwoot();
  const state = await provisionAccount({ ...PROVISION, state: READY, input: { botUrl: "https://robo.test/chatwoot" }, fetchImpl });
  assert.deepEqual(settingsCall(calls).body, { auto_resolve_after: 480, auto_resolve_ignore_waiting: true, auto_resolve_message: "" });
  assert.equal(state.auto_resolve_after, 480);

  const again = fakeLabelsChatwoot();
  await provisionAccount({ ...PROVISION, state, input: { botUrl: "https://robo.test/chatwoot" }, fetchImpl: again.fetchImpl });
  assert.equal(settingsCall(again.calls), undefined, "conta já ajustada não muda de novo");

  const changed = fakeLabelsChatwoot();
  await provisionAccount({ ...PROVISION, state, input: { botUrl: "https://robo.test/chatwoot", autoResolveHours: 12 }, fetchImpl: changed.fetchImpl });
  assert.equal(settingsCall(changed.calls).body.auto_resolve_after, 720, "outra escolha em escolhas.json chega à conta");
});

test("resolução automática: 0 desliga, valor fora de 1 a 720 horas é recusado antes de criar qualquer coisa", async () => {
  assert.equal(autoResolveMinutes(), 480);
  assert.equal(autoResolveMinutes(null), 480);
  assert.equal(autoResolveMinutes(0), null);
  assert.equal(autoResolveMinutes(1.5), 90);
  const off = fakeLabelsChatwoot();
  const state = await provisionAccount({ ...PROVISION, state: READY, input: { botUrl: "https://robo.test/chatwoot", autoResolveHours: 0 }, fetchImpl: off.fetchImpl });
  assert.equal(settingsCall(off.calls).body.auto_resolve_after, null);
  assert.equal(state.auto_resolve_after, null);
  for (const hours of [0.5, 721, "oito"]) {
    const bad = fakeLabelsChatwoot();
    await assert.rejects(provisionAccount({ ...PROVISION, state: {}, input: { name: "Loja", autoResolveHours: hours }, fetchImpl: bad.fetchImpl }), (error) => error.code === "auto_resolve_invalid");
    assert.equal(bad.calls.length, 0);
  }
});

test("resolução automática: falha do Chatwoot não derruba o provisionamento e tenta de novo depois", async () => {
  const failing = fakeLabelsChatwoot({ failSettings: true });
  const state = await provisionAccount({ ...PROVISION, state: READY, input: { botUrl: "https://robo.test/chatwoot" }, fetchImpl: failing.fetchImpl });
  assert.equal(state.auto_resolve_after, undefined);
  assert.equal(state.bot_id, 7);
});
