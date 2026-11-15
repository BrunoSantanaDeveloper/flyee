// Grupos da equipe (D26, invariantes 16 e 17): uma caixa interna por grupo, com uma conversa fixa, vista só
// pelos membros, sem robô, sem rodízio e sem caminho para fora do painel.

import assert from "node:assert/strict";
import { test } from "node:test";

import { archiveTeamGroup, saveTeamGroup, syncTeamGroups, teamGroupInput } from "../kit/base/server/provision.mjs";

const json = (status, value) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

function fakeChatwoot({ labels = [], status = "open" } = {}) {
  const calls = [];
  let next = 40;
  const fetchImpl = async (url, init = {}) => {
    const target = new URL(url);
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    const path = target.pathname.replace("/api/v1/accounts/3", "");
    calls.push({ method, path, body });
    if (method === "POST" && path === "/inboxes") return json(200, { id: next++, name: body.name });
    if (method === "PATCH" && /^\/inboxes\/\d+$/.test(path)) return json(200, {});
    if (method === "POST" && path === "/contacts") return json(200, { payload: { contact: { id: next++, name: body.name }, contact_inbox: { source_id: "x" } } });
    if (method === "PUT" && /^\/contacts\/\d+$/.test(path)) return json(200, {});
    if (method === "POST" && path === "/conversations") return json(200, { id: next++, status: body.status });
    if (method === "GET" && /^\/conversations\/\d+$/.test(path)) return json(200, { id: Number(path.split("/").pop()), status });
    if (/^\/conversations\/\d+\/(participants|labels|toggle_status)$/.test(path)) return json(200, {});
    if (path === "/inbox_members") return json(200, { payload: [] });
    if (method === "GET" && path === "/labels") return json(200, { payload: labels.map((title, index) => ({ id: index + 1, title })) });
    if (method === "POST" && path === "/labels") return json(200, { id: 99, ...body.label });
    return json(404, { error: `rota falsa ausente ${method} ${path}` });
  };
  return { calls, fetchImpl };
}

const STATE = {
  account_id: 3,
  service_token: "svc",
  bot_id: 7,
  staff: { ana: 11, bruno: 12, carla: 13 },
  inboxes: [{ id: 12, route: "nao_oficial", session_id: "s", instance_id: "i" }],
};
const BASE = { chatwootUrl: "https://chat.test" };
const find = (calls, method, path) => calls.find((call) => call.method === method && call.path === path);

test("grupos da equipe: cria a caixa sem robô e sem rodízio, a conversa, os membros, os participantes e as etiquetas", async () => {
  const { calls, fetchImpl } = fakeChatwoot({ labels: ["vendas"] });
  const { state, missing } = await saveTeamGroup({
    ...BASE,
    state: STATE,
    group: { key: "g-1", name: "  Comercial ", members: ["ana", "bruno", "zoe"], labels: ["Vendas", "clientes grandes"] },
    fetchImpl,
  });
  assert.deepEqual(find(calls, "POST", "/inboxes").body, { name: "Equipe: Comercial", channel: { type: "api" }, enable_auto_assignment: false });
  assert.equal(calls.some((call) => call.path.endsWith("/set_agent_bot")), false, "nenhum robô na caixa do grupo");
  const contact = find(calls, "POST", "/contacts").body;
  assert.deepEqual(contact, { inbox_id: 40, name: "Equipe: Comercial", identifier: "equipe:g-1" });
  assert.equal("phone_number" in contact || "email" in contact, false, "sem telefone nem e-mail, nada sai do painel");
  assert.deepEqual(find(calls, "POST", "/conversations").body, { inbox_id: 40, contact_id: 41, status: "open" });
  assert.deepEqual(find(calls, "PATCH", "/inbox_members").body, { inbox_id: 40, user_ids: [11, 12] });
  assert.deepEqual(find(calls, "PATCH", "/conversations/42/participants").body, { user_ids: [11, 12] });
  assert.deepEqual(calls.filter((call) => call.method === "POST" && call.path === "/labels").map((call) => call.body.label.title), ["clientes-grandes"]);
  assert.deepEqual(find(calls, "POST", "/conversations/42/labels").body, { labels: ["vendas", "clientes-grandes"] });
  assert.deepEqual(missing, ["zoe"], "quem não está na equipe do painel fica fora e a tela avisa");
  assert.deepEqual(state.team_groups["g-1"], {
    inbox_id: 40,
    contact_id: 41,
    conversation_id: 42,
    name: "Comercial",
    members: ["ana", "bruno"],
    labels: ["vendas", "clientes-grandes"],
    archived: false,
  });
  assert.deepEqual(state.inboxes, STATE.inboxes, "a caixa do grupo não entra na lista das caixas do WhatsApp (invariante 17)");
});

test("grupos da equipe: mudar renomeia e troca os membros na mesma caixa", async () => {
  const created = await saveTeamGroup({ ...BASE, state: STATE, group: { key: "g-1", name: "Comercial", members: ["ana", "bruno"] }, fetchImpl: fakeChatwoot().fetchImpl });
  const { calls, fetchImpl } = fakeChatwoot();
  const { state } = await saveTeamGroup({ ...BASE, state: created.state, group: { key: "g-1", name: "Vendas", members: ["carla"] }, fetchImpl });
  assert.equal(find(calls, "POST", "/inboxes"), undefined, "não cria outra caixa");
  assert.deepEqual(find(calls, "PATCH", "/inboxes/40").body, { name: "Equipe: Vendas" });
  assert.deepEqual(find(calls, "PUT", "/contacts/41").body, { name: "Equipe: Vendas" });
  assert.deepEqual(find(calls, "PATCH", "/inbox_members").body, { inbox_id: 40, user_ids: [13] }, "a lista troca: quem saiu deixa de ver o grupo");
  assert.deepEqual(state.team_groups["g-1"].members, ["carla"]);
});

test("grupos da equipe: chave, nome, etiqueta e membros são conferidos antes de chamar o Chatwoot", async () => {
  const cases = [
    [{ key: "G 1", name: "x", members: ["ana"] }, "team_group_key"],
    [{ key: "g-1", name: "  ", members: ["ana"] }, "team_group_name"],
    [{ key: "g-1", name: "x".repeat(61), members: ["ana"] }, "team_group_name"],
    [{ key: "g-1", name: "x", members: [] }, "team_group_members"],
    [{ key: "g-1", name: "x", members: ["ana"], labels: ["vendas?"] }, "team_group_label"],
    [{ key: "g-1", name: "x", members: ["zoe"] }, "team_group_members"],
  ];
  for (const [group, code] of cases) {
    const { calls, fetchImpl } = fakeChatwoot();
    await assert.rejects(saveTeamGroup({ ...BASE, state: STATE, group, fetchImpl }), (error) => error.code === code && error.fix.length > 0);
    assert.equal(calls.length, 0);
  }
  assert.deepEqual(teamGroupInput({ key: "g-2", name: "Suporte", members: ["ana", "ana"], labels: ["Noite", "noite"] }), {
    key: "g-2",
    name: "Suporte",
    labels: ["noite"],
    members: ["ana"],
  });
});

test("grupos da equipe: arquivar tira todos e guarda o histórico; salvar de novo traz o grupo de volta", async () => {
  const created = await saveTeamGroup({ ...BASE, state: STATE, group: { key: "g-1", name: "Comercial", members: ["ana", "bruno"] }, fetchImpl: fakeChatwoot().fetchImpl });
  const { calls, fetchImpl } = fakeChatwoot();
  const archived = await archiveTeamGroup({ ...BASE, state: created.state, key: "g-1", fetchImpl });
  assert.equal(archived.archived, true);
  assert.deepEqual(find(calls, "DELETE", "/conversations/42/participants").body, { user_ids: [11, 12] });
  assert.deepEqual(find(calls, "DELETE", "/inbox_members").body, { inbox_id: 40, user_ids: [11, 12] });
  assert.deepEqual(find(calls, "POST", "/conversations/42/toggle_status").body, { status: "resolved" });
  assert.equal(calls.some((call) => call.method === "DELETE" && call.path.startsWith("/inboxes")), false, "a caixa e o histórico ficam");
  assert.deepEqual(archived.state.team_groups["g-1"].members, []);
  assert.equal((await archiveTeamGroup({ ...BASE, state: archived.state, key: "g-1", fetchImpl: fakeChatwoot().fetchImpl })).archived, false);

  const back = fakeChatwoot();
  const restored = await saveTeamGroup({ ...BASE, state: archived.state, group: { key: "g-1", name: "Comercial", members: ["carla"] }, fetchImpl: back.fetchImpl });
  assert.deepEqual(find(back.calls, "POST", "/conversations/42/toggle_status").body, { status: "open" });
  assert.equal(restored.state.team_groups["g-1"].archived, false);
});

test("grupos da equipe: a rotina reabre o grupo que a resolução automática fechou e tira quem saiu da equipe", async () => {
  const created = await saveTeamGroup({ ...BASE, state: STATE, group: { key: "g-1", name: "Comercial", members: ["ana", "bruno"] }, fetchImpl: fakeChatwoot().fetchImpl });
  const left = { ...created.state, staff: { ana: 11 } };
  const { calls, fetchImpl } = fakeChatwoot({ status: "resolved" });
  const result = await syncTeamGroups({ ...BASE, state: left, fetchImpl });
  assert.deepEqual(result.reopened, ["g-1"]);
  assert.deepEqual(find(calls, "POST", "/conversations/42/toggle_status").body, { status: "open" });
  assert.deepEqual(result.pruned, ["g-1"]);
  assert.deepEqual(result.state.team_groups["g-1"].members, ["ana"]);

  const open = fakeChatwoot({ status: "open" });
  const quiet = await syncTeamGroups({ ...BASE, state: result.state, fetchImpl: open.fetchImpl });
  assert.deepEqual([quiet.reopened, quiet.pruned], [[], []]);
  assert.equal(open.calls.some((call) => call.method === "POST"), false);

  const archived = await archiveTeamGroup({ ...BASE, state: result.state, key: "g-1", fetchImpl: fakeChatwoot().fetchImpl });
  const skipped = fakeChatwoot({ status: "resolved" });
  await syncTeamGroups({ ...BASE, state: archived.state, fetchImpl: skipped.fetchImpl });
  assert.equal(skipped.calls.length, 0, "grupo arquivado fica fechado");
});
