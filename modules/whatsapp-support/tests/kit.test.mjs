import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { signProjectRequest as botSign } from "../kit/base/bot/src/signature.mjs";
import { createToolRunner, handleBotRequest } from "../kit/base/server/bot-contract.mjs";
import { adapterIngressUrl } from "../kit/base/server/openwa.mjs";
import {
  connectCloudApi,
  connectOpenWA,
  conversationHistory,
  ensureDashboardApp,
  ensureStaffUser,
  featureMap,
  NEVER_OFF,
  provisionAccount,
  removeStaffUser,
  ssoUrl,
  syncStaff,
  whatsappStatus,
} from "../kit/base/server/provision.mjs";
import { brPhoneVariants, contactPhone, phoneDigits, samePhone } from "../kit/base/shared/phone.mjs";
import { summarizeGaps } from "../kit/base/shared/report.mjs";
import {
  applyClientEdits,
  botConfig,
  canEnterPanel,
  clientPermissions,
  defaultPlatformSettings,
  defaultSettings,
  editableGroups,
  knowledgeOwner,
  validateSettings,
} from "../kit/base/shared/settings.mjs";
import { signProjectRequest as sharedSign } from "../kit/base/shared/signature.mjs";
import { connectReducer, initialConnectState, pollingDelay, validateOfficial } from "../kit/base/ui/connect.mjs";
import { buildScale, parseHex, rgbToOklch } from "../scripts/lib/color.mjs";
import { parseDotenv } from "../scripts/lib/env.mjs";
import { install, status, update } from "../scripts/lib/files.mjs";
import { judge } from "../scripts/lib/look.mjs";
import { brandRule, buildTheme } from "../scripts/lib/theme.mjs";
import { verify } from "../scripts/lib/verify.mjs";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NBRAND = JSON.parse(readFileSync(join(APP_DIR, "references", "n-brand.json"), "utf8"));
const CHOICES = JSON.parse(readFileSync(join(APP_DIR, "references", "escolhas.exemplo.json"), "utf8"));
const json = (status, value) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

function choices(patch = {}) {
  const value = structuredClone(CHOICES);
  value.marca.nome = "ONE";
  value.marca.cor_principal = "#0B5FFF";
  return { ...value, ...patch };
}

// ---------- tema ----------

test("tema: tom 9 igual à cor principal nos dois modos e regra para cada classe com o azul fixo", () => {
  const theme = buildTheme({ escolhas: choices(), nbrand: NBRAND, appVersion: "1.0.0" });
  assert.match(theme.html, /:root \{[^}]*--blue-9: 11 95 255 !important;/s);
  assert.match(theme.html, /\.dark \{[^}]*--blue-9: 11 95 255 !important;/s);
  assert.equal(theme.summary.skipped.length, 0, `classes sem regra: ${theme.summary.skipped.join(", ")}`);
  for (const token of NBRAND.classes) assert.ok(brandRule(token), token);
  assert.match(theme.html, /data-kit="whatsapp-support@1\.0\.0" data-kit-theme="[0-9a-f]{16}"/);
  assert.match(theme.marcaEnv, /^KIT_BRAND_NAME=ONE$/m);
  assert.doesNotMatch(theme.html, /—|–/);
});

test("tema: variantes do Tailwind viram seletores certos", () => {
  assert.equal(brandRule("hover:bg-n-brand/90"), ".hover\\:bg-n-brand\\/90:hover { background-color: rgb(var(--blue-9) / 0.9) !important; }");
  assert.match(brandRule("dark:focus:outline-n-brand"), /^\.dark \.dark\\:focus\\:outline-n-brand:focus \{/);
  assert.match(brandRule("group-hover:text-n-brand"), /^\.group:hover \.group-hover\\:text-n-brand \{/);
  assert.match(brandRule("before:bg-n-brand"), /::before \{/);
  assert.equal(brandRule("algo:bg-n-brand"), null);
});

test("tema: recusa cor, seletor e link inválidos", () => {
  assert.throws(() => buildTheme({ escolhas: choices({ marca: { ...choices().marca, cor_principal: "azul" } }), nbrand: NBRAND, appVersion: "1" }), (error) => error.code === "color_invalid");
  assert.throws(() => buildTheme({ escolhas: choices({ chatwoot: { ...CHOICES.chatwoot, esconder: [{ seletor: "a { color: red }" }] } }), nbrand: NBRAND, appVersion: "1" }), (error) => error.code === "selector_invalid");
  assert.throws(
    () => buildTheme({ escolhas: choices({ acrescentar: { links: [{ rotulo: "x", url: "http://inseguro", posicao: "inferior-esquerda" }] } }), nbrand: NBRAND, appVersion: "1" }),
    (error) => error.code === "link_invalid",
  );
});

test("tema: rótulo de link não fecha a tag script", () => {
  const theme = buildTheme({ escolhas: choices({ acrescentar: { links: [{ rotulo: "</script><b>", url: "https://app.test", posicao: "superior-direita" }] } }), nbrand: NBRAND, appVersion: "1" });
  assert.equal(theme.html.split("</script>").length, 2);
});

test("cores: escala de 12 tons, ordenada em claridade no modo claro", () => {
  const scale = buildScale(parseHex("#0B5FFF"), "light");
  assert.equal(scale.length, 12);
  assert.equal(scale[8], "11 95 255");
  const lightness = scale.map((value) => rgbToOklch(value.split(" ").map(Number)).l);
  for (let index = 1; index < 8; index++) assert.ok(lightness[index] <= lightness[index - 1] + 0.001, `tom ${index + 1}`);
  assert.equal(parseHex("#abc").join(","), "170,187,204");
});

// ---------- instalar e atualizar ----------

test("instalar, editar a base e atualizar: recusa sem force e guarda a versão do projeto com force", () => {
  const project = mkdtempSync(join(tmpdir(), "kit-teste-"));
  try {
    const dest = join(project, "atendimento");
    const result = install({ appDir: APP_DIR, dest, appVersion: "1.0.0", versions: { chatwoot: "4.19.1" } });
    assert.ok(result.base > 20);
    assert.ok(result.escolhas);
    assert.throws(() => install({ appDir: APP_DIR, dest, appVersion: "1.0.0", versions: {} }), (error) => error.code === "already_installed");
    assert.match(readFileSync(join(dest, ".gitignore"), "utf8"), /segredos\//);

    const edited = join(dest, "base", "bot", "src", "policy.mjs");
    writeFileSync(edited, `${readFileSync(edited, "utf8")}\n// mudança do projeto\n`);
    const report = status({ dest, appVersion: "1.1.0", versions: { chatwoot: "4.20.0" } });
    assert.deepEqual(report.modified, ["bot/src/policy.mjs"]);
    assert.equal(report.update_available, true);
    assert.equal(report.versions_changed[0].kit, "4.20.0");

    const refused = update({ appDir: APP_DIR, dest, appVersion: "1.1.0", versions: {} });
    assert.equal(refused.updated, false);
    assert.deepEqual(refused.conflicts, ["bot/src/policy.mjs"]);

    const forced = update({ appDir: APP_DIR, dest, appVersion: "1.1.0", versions: {}, force: true });
    assert.equal(forced.updated, true);
    assert.match(readFileSync(`${edited}.projeto`, "utf8"), /mudança do projeto/);
    assert.doesNotMatch(readFileSync(edited, "utf8"), /mudança do projeto/);
    assert.equal(JSON.parse(readFileSync(join(dest, "kit.json"), "utf8")).version, "1.1.0");
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});

test("status: base diferente com o mesmo número de versão ainda é atualização", () => {
  const project = mkdtempSync(join(tmpdir(), "kit-teste-"));
  try {
    const dest = join(project, "atendimento");
    install({ appDir: APP_DIR, dest, appVersion: "1.0.0", versions: {} });
    const fresh = status({ appDir: APP_DIR, dest, appVersion: "1.0.0", versions: {} });
    assert.equal(fresh.update_available, false);
    assert.equal(fresh.base_changed, false);

    // Um kit instalado de uma montagem anterior da mesma versão: a base gravada é outra.
    const recordPath = join(dest, "kit.json");
    const record = JSON.parse(readFileSync(recordPath, "utf8"));
    record.base["bot/src/prompt.mjs"] = "0".repeat(64);
    delete record.base["bot/src/privacy.mjs"];
    writeFileSync(recordPath, JSON.stringify(record));
    const older = status({ appDir: APP_DIR, dest, appVersion: "1.0.0", versions: {} });
    assert.equal(older.update_available, true);
    assert.equal(older.base_changed, true);
    // Sem appDir, só o número de versão conta.
    assert.equal(status({ dest, appVersion: "1.0.0", versions: {} }).update_available, false);

    const updated = update({ appDir: APP_DIR, dest, appVersion: "1.0.0", versions: {} });
    assert.equal(updated.updated, true);
    assert.equal(status({ appDir: APP_DIR, dest, appVersion: "1.0.0", versions: {} }).update_available, false);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});

// ---------- configurações, telefones, assinatura ----------

test("configurações: padrões válidos, erros por campo e montagem da configuração do robô", () => {
  assert.deepEqual(validateSettings(defaultSettings("Loja")), []);
  const bad = { ...defaultSettings("Loja"), mode: "x", knowledge: [{ q: "", a: "" }], tools_enabled: ["apagar_tudo"], handoff: { keywords: null, max_bot_turns: 0, team_id: null } };
  bad.hours = { ...bad.hours, days: { ...bad.hours.days, seg: [["18:00", "08:00"]] } };
  const fields = validateSettings(bad, { declaredTools: ["consultar_pedido"] }).map((problem) => problem.field);
  for (const field of ["mode", "knowledge.0", "tools_enabled", "handoff.max_bot_turns", "hours.days.seg.0"]) assert.ok(fields.includes(field), field);

  const config = botConfig({
    platform: defaultPlatformSettings("Plataforma"),
    client: { ...defaultSettings("Loja"), tools_enabled: ["consultar_pedido"] },
    state: { bot_token: "t", bot_secret: "s" },
    tools: [{ name: "consultar_pedido", description: "d", input_schema: {}, run() {} }, { name: "outra", description: "", input_schema: {} }],
    ai: { provider: "anthropic" },
  });
  assert.deepEqual(config.chatwoot, { bot_token: "t", bot_secret: "s" });
  assert.deepEqual(config.tools.map((tool) => tool.name), ["consultar_pedido"]);
  assert.equal("run" in config.tools[0], false);
  assert.deepEqual(config.handoff.labels, ["robo-passou"]);
});

test("telefones: E.164, identificador do WhatsApp, @lid e o nono dígito", () => {
  assert.equal(phoneDigits("+55 (11) 99999-0000"), "5511999990000");
  assert.equal(phoneDigits("5511999990000@c.us"), "5511999990000");
  assert.equal(phoneDigits("123456789@lid"), null);
  assert.deepEqual(brPhoneVariants("+5511999990000").sort(), ["551199990000", "5511999990000"].sort());
  assert.ok(samePhone("5511999990000@c.us", "+55 11 9999-0000"));
  assert.equal(contactPhone({ phone_number: null, identifier: "5511999990000@c.us" }), "5511999990000");
});

test("a assinatura do projeto é a mesma no robô e no servidor", () => {
  const input = { secret: "s", method: "POST", pathWithQuery: "/a/tools/x", body: "{}", now: 1_700_000_000_000 };
  assert.deepEqual(sharedSign(input), botSign(input));
});

// ---------- contrato do robô no projeto ----------

test("contrato: sem assinatura é 401; config, consulta e histórico respondem", async () => {
  const secret = "segredo";
  const runTool = createToolRunner(
    [{ name: "consultar_pedido", description: "", input_schema: {}, run: async ({ contact, input }) => ({ ok: true, phone: contact.phone_number, numero: input.numero }) }],
    { isEnabled: async (accountId, name) => accountId === 3 && name === "consultar_pedido" },
  );
  const handlers = {
    secret,
    getConfig: async (accountId) => (accountId === 3 ? { mode: "auto" } : null),
    runTool,
    getHistory: async () => [{ role: "cliente", text: "oi", at: "x" }],
  };
  const request = (method, path, route, query, body = "") => ({
    method,
    pathWithQuery: path,
    route,
    query,
    rawBody: body,
    headers: Object.fromEntries(Object.entries(sharedSign({ secret, method, pathWithQuery: path, body })).map(([key, value]) => [key.toLowerCase(), value])),
  });

  assert.equal((await handleBotRequest({ method: "GET", pathWithQuery: "/r/config?account_id=3", route: "config", query: { account_id: "3" }, rawBody: "", headers: {} }, handlers)).status, 401);
  assert.deepEqual((await handleBotRequest(request("GET", "/r/config?account_id=3", "config", { account_id: "3" }), handlers)).body, { mode: "auto" });
  assert.equal((await handleBotRequest(request("GET", "/r/config?account_id=9", "config", { account_id: "9" }), handlers)).status, 404);
  const body = JSON.stringify({ account_id: 3, contact: { phone_number: "+55" }, input: { numero: "7" } });
  const tool = await handleBotRequest(request("POST", "/r/tools/consultar_pedido", "tools/consultar_pedido", {}, body), handlers);
  assert.deepEqual(tool.body, { ok: true, phone: "+55", numero: "7" });
  const disabled = JSON.stringify({ account_id: 4, input: {} });
  assert.equal((await handleBotRequest(request("POST", "/r/tools/consultar_pedido", "tools/consultar_pedido", {}, disabled), handlers)).body.code, "tool_disabled");
  const history = await handleBotRequest(request("GET", "/r/history?account_id=3&conversation_id=8", "history", { account_id: "3", conversation_id: "8" }), handlers);
  assert.equal(history.body.messages[0].text, "oi");
});

// ---------- provisionamento contra Chatwoot e OpenWA falsos ----------

function fakeServices() {
  const calls = [];
  const users = new Map();
  const members = new Map();
  let nextId = 100;
  const fetchImpl = async (url, init = {}) => {
    const target = new URL(url);
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    const path = target.pathname;
    const query = Object.fromEntries(target.searchParams);
    calls.push({ host: target.host, method, path, body, query });
    if (target.host === "chat.test") {
      if (method === "POST" && path === "/platform/api/v1/accounts") return json(200, { id: 3, name: body.name, features: body.features });
      if (method === "PATCH" && /^\/platform\/api\/v1\/accounts\/\d+$/.test(path)) return json(200, { id: 3 });
      if (method === "POST" && path === "/platform/api/v1/users") {
        if (!users.has(body.email)) users.set(body.email, nextId++);
        return json(200, { id: users.get(body.email), email: body.email });
      }
      if (method === "GET" && /^\/platform\/api\/v1\/users\/\d+$/.test(path)) return json(200, { id: Number(path.split("/").pop()), access_token: `token-${path.split("/").pop()}` });
      if (method === "PATCH" && /^\/platform\/api\/v1\/users\/\d+$/.test(path)) return json(200, {});
      if (method === "POST" && path === "/platform/api/v1/accounts/3/account_users") {
        members.set(Number(body.user_id), body.role);
        return json(200, { user_id: body.user_id, role: body.role });
      }
      if (method === "GET" && path === "/platform/api/v1/accounts/3/account_users") {
        return json(200, [...members].map(([user_id, role]) => ({ account_id: 3, user_id, role })));
      }
      if (method === "DELETE" && path === "/platform/api/v1/accounts/3/account_users") {
        // Como o Chatwoot: find_by(...)&.destroy! e head :ok, mesmo sem a pessoa na conta.
        members.delete(Number(query.user_id));
        return new Response(null, { status: 200 });
      }
      if (method === "GET" && /\/login$/.test(path)) return json(200, { url: "https://chat.test/app/login?sso_auth_token=abc" });
      if (method === "POST" && path === "/api/v1/accounts/3/agent_bots") return json(200, { id: 7, access_token: "bot-token", secret: "bot-secret" });
      if (method === "PATCH" && path.startsWith("/api/v1/accounts/3/agent_bots/")) return json(200, {});
      if (method === "POST" && path === "/api/v1/accounts/3/inboxes") {
        const whatsapp = body.channel.type === "whatsapp";
        return json(200, { id: whatsapp ? 11 : 12, callback_webhook_url: whatsapp ? "https://chat.test/webhooks/whatsapp/+5511999990000" : null, provider_config: whatsapp ? { webhook_verify_token: "verif" } : undefined });
      }
      if (method === "POST" && /\/inboxes\/\d+\/set_agent_bot$/.test(path)) return json(200, {});
      if (method === "POST" && path === "/api/v1/accounts/3/inbox_members") return json(200, { payload: [] });
      if (method === "POST" && path === "/api/v1/accounts/3/webhooks") return json(200, { payload: { webhook: { id: 21, url: body.webhook.url, secret: "webhook-secret" } } });
      if (method === "PATCH" && path === "/api/v1/accounts/3/webhooks/21") return json(200, { payload: { webhook: { id: 21 } } });
      if (path === "/api/v1/profile") return json(200, { ui_settings: { color_scheme: "auto" } });
      if (method === "GET" && path === "/api/v1/accounts/3/conversations/8/messages") {
        return json(200, {
          payload: [
            { content: "Oi", message_type: 0, private: false, created_at: 1_700_000_000, sender: { type: "contact" } },
            { content: "nota", message_type: 1, private: true, created_at: 1_700_000_001, sender: { type: "user" } },
            { content: "Olá, posso ajudar", message_type: 1, private: false, created_at: 1_700_000_002, sender: { type: "agent_bot" } },
            { content: "entrou na conversa", message_type: 2, private: false, created_at: 1_700_000_003, sender: null },
          ],
        });
      }
    }
    if (target.host === "wa-interno.test") {
      if (method === "GET" && path === "/api/plugins") return json(200, []);
      if (method === "GET" && path === "/api/plugins/catalog") return json(200, [{ id: "chatwoot-adapter", download: "https://github.test/chatwoot-adapter.zip#sha256=abc" }]);
      if (method === "POST" && path === "/api/plugins/install-url") return json(201, { id: "chatwoot-adapter" });
      if (method === "POST" && path === "/api/plugins/chatwoot-adapter/enable") return json(200, {});
      if (method === "POST" && path === "/api/sessions") return json(201, { id: "sess-1", name: body.name, status: "created" });
      if (method === "POST" && path === "/api/sessions/sess-1/start") return json(200, {});
      if (method === "POST" && path === "/api/integration/plugins/chatwoot-adapter/instances") {
        return json(201, { instanceId: body.instanceId, ingressUrls: [{ route: "chatwoot", url: adapterIngressUrl("https://wa.test", body.instanceId) }] });
      }
      if (method === "GET" && path === "/api/sessions/sess-1") return json(200, { id: "sess-1", status: "qr_ready" });
      if (method === "GET" && path === "/api/sessions/sess-1/qr") return json(200, { qrCode: "data:image/png;base64,AAA", status: "qr_ready" });
    }
    return json(404, { error: `rota falsa ausente ${method} ${path}` });
  };
  return { calls, fetchImpl };
}

test("funções: as do atendimento nunca se desligam", () => {
  assert.throws(() => featureMap(["campaigns", "api_and_webhooks"]), (error) => error.code === "feature_required");
  const map = featureMap(["campaigns"]);
  assert.equal(map.campaigns, false);
  for (const name of NEVER_OFF) assert.equal(map[name], true);
});

test("provisionamento: conta, conta de serviço administradora e robô; rodar de novo não duplica", async () => {
  const { calls, fetchImpl } = fakeServices();
  const input = { name: "Cliente A", featuresOff: ["campaigns"], serviceEmail: "atendimento+a@one.test", botUrl: "https://chat.test/robo/chatwoot" };
  const state = await provisionAccount({ chatwootUrl: "https://chat.test", platformToken: "p", input, fetchImpl });
  assert.equal(state.account_id, 3);
  assert.equal(state.bot_secret, "bot-secret");
  const admin = calls.find((call) => call.path.endsWith("/account_users"));
  assert.equal(admin.body.role, "administrator");
  const created = calls.length;
  const again = await provisionAccount({ chatwootUrl: "https://chat.test", platformToken: "p", state, input, fetchImpl });
  assert.deepEqual({ ...again, features_off: undefined }, { ...state, features_off: undefined });
  assert.equal(calls.slice(created).some((call) => call.method === "POST"), false, "a segunda vez não cria nada");
});

test("equipe: sempre atendente, membro das caixas, com as preferências do painel", async () => {
  const { calls, fetchImpl } = fakeServices();
  const state = { account_id: 3, service_user_id: 1, service_token: "svc", bot_id: 7, inboxes: [{ id: 11, route: "oficial" }], staff: {} };
  const { state: next, userId } = await ensureStaffUser({ chatwootUrl: "https://chat.test", platformToken: "p", state, person: { key: "u1", email: "ana@cliente.test", name: "Ana" }, fetchImpl });
  assert.equal(next.staff.u1, userId);
  assert.equal(calls.find((call) => call.path.endsWith("/account_users")).body.role, "agent");
  assert.deepEqual(calls.find((call) => call.path.endsWith("/inbox_members")).body, { inbox_id: 11, user_ids: [userId] });
  const profile = calls.find((call) => call.method === "PUT" && call.path === "/api/v1/profile");
  assert.equal(profile.body.profile.ui_settings.color_scheme, "auto", "mantém o que a pessoa já tinha");
  assert.equal(profile.body.profile.ui_settings.is_macro_open, false);
  assert.match(await ssoUrl({ chatwootUrl: "https://chat.test", platformToken: "p", userId, fetchImpl }), /sso_auth_token/);
});

test("quem entra no painel: equipe e superadmin na plataforma; equipe e administrador em cada cliente", () => {
  const nobody = { isSuperadmin: false, canConfigure: false, isSupportStaff: false };
  assert.equal(canEnterPanel("plataforma", { ...nobody, isSupportStaff: true }), true);
  assert.equal(canEnterPanel("plataforma", { ...nobody, isSuperadmin: true }), true);
  assert.equal(canEnterPanel("plataforma", { ...nobody, canConfigure: true }), false, "o administrador de um cliente da plataforma não é a equipe dela");
  assert.equal(canEnterPanel("por-cliente", { ...nobody, isSupportStaff: true }), true);
  assert.equal(canEnterPanel("por-cliente", { ...nobody, canConfigure: true }), true);
  assert.equal(canEnterPanel("por-cliente", { ...nobody, isSuperadmin: true }), false, "o superadmin não entra no painel dos clientes");
  assert.equal(canEnterPanel("por-cliente", nobody), false);
  assert.equal(canEnterPanel("por-cliente", null), false);
});

test("tirar da equipe: sai da conta e do estado, sem apagar a pessoa; serviço e repasse nunca saem", async () => {
  const { calls, fetchImpl } = fakeServices();
  const base = { chatwootUrl: "https://chat.test", platformToken: "p", fetchImpl };
  let state = { account_id: 3, service_user_id: 1, service_token: "svc", relay_user_id: 2, bot_id: 7, inboxes: [{ id: 11, route: "oficial" }], staff: {} };
  state = (await ensureStaffUser({ ...base, state, person: { key: "ana", email: "ana@cliente.test", name: "Ana" }, uiSettings: null })).state;
  const anaId = state.staff.ana;

  const result = await removeStaffUser({ ...base, state, personKey: "ana" });
  assert.equal(result.removed, anaId);
  assert.deepEqual(result.state.staff, {});
  const removal = calls.find((call) => call.method === "DELETE");
  assert.equal(removal.path, "/platform/api/v1/accounts/3/account_users");
  assert.equal(removal.query.user_id, String(anaId));
  assert.equal(calls.some((call) => call.method === "DELETE" && call.path.startsWith("/platform/api/v1/users")), false, "a pessoa continua no Chatwoot");

  const again = await removeStaffUser({ ...base, state: result.state, personKey: "ana" });
  assert.equal(again.removed, null, "tirar de novo não chama o Chatwoot");
  assert.equal(calls.filter((call) => call.method === "DELETE").length, 1);

  await assert.rejects(
    removeStaffUser({ ...base, state: { ...state, staff: { robo: 1 } }, personKey: "robo" }),
    (error) => error.code === "reserved_user",
  );
});

test("conferência da equipe: tira só quem o kit pôs e saiu da lista; lista vazia não tira ninguém", async () => {
  const { calls, fetchImpl } = fakeServices();
  const base = { chatwootUrl: "https://chat.test", platformToken: "p", fetchImpl };
  let state = { account_id: 3, service_user_id: 1, service_token: "svc", relay_user_id: 2, bot_id: 7, inboxes: [], staff: {} };
  for (const [key, name] of [["ana", "Ana"], ["bia", "Bia"], ["caio", "Caio"]]) {
    state = (await ensureStaffUser({ ...base, state, person: { key, email: `${key}@cliente.test`, name }, uiSettings: null })).state;
  }
  // Quem já estava na conta: a conta de serviço, a pessoa de repasse e alguém que o kit não pôs.
  for (const [user_id, role] of [[1, "administrator"], [2, "agent"], [999, "agent"]]) {
    await fetchImpl("https://chat.test/platform/api/v1/accounts/3/account_users", { method: "POST", body: JSON.stringify({ user_id, role }) });
  }

  const empty = await syncStaff({ ...base, state, keepKeys: [] });
  assert.equal(empty.skipped, "empty_list");
  assert.equal(calls.some((call) => call.method === "DELETE"), false);

  const result = await syncStaff({ ...base, state, keepKeys: ["ana", "caio"] });
  assert.deepEqual(result.removed, [{ key: "bia", user_id: state.staff.bia }]);
  assert.deepEqual(Object.keys(result.state.staff).sort(), ["ana", "caio"]);
  assert.deepEqual(result.unknown, [{ user_id: 999, role: "agent" }], "quem o kit não pôs só aparece, não sai");
  const removedIds = calls.filter((call) => call.method === "DELETE").map((call) => Number(call.query.user_id));
  assert.deepEqual(removedIds, [state.staff.bia]);

  const cleared = await syncStaff({ ...base, state: result.state, keepKeys: [], allowEmpty: true });
  assert.equal(cleared.removed.length, 2);
  assert.deepEqual(cleared.state.staff, {});
  assert.equal(cleared.state.service_user_id, 1);

  await assert.rejects(syncStaff({ ...base, state, keepKeys: null }), (error) => error.code === "staff_list_invalid");
  assert.equal((await syncStaff({ ...base, state: {}, keepKeys: [] })).skipped, "no_account");
});

test("rota oficial: caixa WhatsApp Cloud com o robô e o retorno para a Meta", async () => {
  const { calls, fetchImpl } = fakeServices();
  const state = { account_id: 3, service_token: "svc", bot_id: 7, staff: { u1: 101 } };
  const result = await connectCloudApi({ chatwootUrl: "https://chat.test", state, cloud: { phoneNumber: "+5511999990000", phoneNumberId: "123456", businessAccountId: "654321", apiKey: "x".repeat(30) }, fetchImpl });
  assert.equal(result.metaWebhook.verifyToken, "verif");
  const inbox = calls.find((call) => call.path === "/api/v1/accounts/3/inboxes");
  assert.equal(inbox.body.channel.provider, "whatsapp_cloud");
  assert.ok(calls.some((call) => call.path.endsWith("/set_agent_bot") && call.body.agent_bot === 7));
  assert.equal(result.state.inboxes[0].route, "oficial");
});

test("rota não oficial: webhook antes da instância, o mesmo segredo dos dois lados, adaptador instalado pelo catálogo", async () => {
  const { calls, fetchImpl } = fakeServices();
  const state = { account_id: 3, service_token: "svc", bot_id: 7, staff: {} };
  const result = await connectOpenWA({
    chatwootUrl: "https://chat.test",
    platformToken: "p",
    state,
    input: {
      sessionName: "cliente-a",
      relayEmail: "repasse+a@one.test",
      chatwootPublicUrl: "https://chat.test",
      openwaUrl: "https://wa-interno.test",
      openwaPublicUrl: "https://wa.test",
      openwaApiKey: "k",
    },
    fetchImpl,
  });
  const order = calls.map((call) => `${call.method} ${call.path}`);
  const webhookAt = order.indexOf("POST /api/v1/accounts/3/webhooks");
  const instanceAt = order.indexOf("POST /api/integration/plugins/chatwoot-adapter/instances");
  assert.ok(webhookAt >= 0 && instanceAt > webhookAt);
  const webhook = calls[webhookAt].body.webhook;
  assert.equal(webhook.url, "https://wa.test/api/ingress/chatwoot-adapter/cliente-a/chatwoot");
  const instance = calls[instanceAt].body;
  assert.equal(instance.secret, "webhook-secret");
  assert.equal(instance.config.apiToken, `token-${result.state.relay_user_id}`, "o adaptador usa a pessoa de repasse, não a conta de serviço");
  assert.ok(order.includes("POST /api/plugins/install-url"));
  assert.equal(calls.find((call) => call.path === "/api/v1/accounts/3/inboxes").body.channel.type, "api");
  const status = await whatsappStatus({ openwaUrl: "https://wa-interno.test", openwaApiKey: "k", sessionId: result.sessionId, fetchImpl });
  assert.equal(status.qrCode, "data:image/png;base64,AAA");
});

test("rota não oficial: recusa endereço sem https", async () => {
  await assert.rejects(
    connectOpenWA({ chatwootUrl: "x", platformToken: "p", state: {}, input: { sessionName: "cliente-a", chatwootPublicUrl: "http://chat", openwaPublicUrl: "https://wa" } }),
    (error) => error.code === "public_https_required",
  );
});

test("aba do projeto na conversa: cria uma vez, no formato frame, e recusa endereço sem https", async () => {
  const created = [];
  const fetchImpl = async (url, init = {}) => {
    const path = new URL(url).pathname;
    if ((init.method ?? "GET") === "GET" && path.endsWith("/dashboard_apps")) return json(200, created);
    if (init.method === "POST" && path.endsWith("/dashboard_apps")) {
      const body = JSON.parse(init.body);
      created.push({ id: 1, title: body.dashboard_app.title, content: body.dashboard_app.content });
      return json(200, created[0]);
    }
    return json(404, {});
  };
  const state = { account_id: 3, service_token: "svc" };
  await ensureDashboardApp({ chatwootUrl: "https://chat.test", state, title: "Ficha do cliente", url: "https://app.test/ficha", fetchImpl });
  await ensureDashboardApp({ chatwootUrl: "https://chat.test", state, title: "Ficha do cliente", url: "https://app.test/ficha", fetchImpl });
  assert.equal(created.length, 1);
  assert.deepEqual(created[0].content, [{ type: "frame", url: "https://app.test/ficha" }]);
  await assert.rejects(ensureDashboardApp({ chatwootUrl: "x", state, title: "t", url: "http://inseguro", fetchImpl }), (error) => error.code === "dashboard_app_url");
});

test("histórico para o robô: sem notas privadas nem atividades, com os papéis certos", async () => {
  const { fetchImpl } = fakeServices();
  const history = await conversationHistory({ chatwootUrl: "https://chat.test", state: { account_id: 3, service_token: "svc" }, conversationId: 8, fetchImpl });
  assert.deepEqual(history.map((item) => [item.role, item.text]), [["cliente", "Oi"], ["robo", "Olá, posso ajudar"]]);
});

// ---------- telas ----------

test("tela de conectar: passos, aviso de risco e QR", () => {
  let state = connectReducer(initialConnectState, { type: "escolher_rota", route: "nao_oficial" });
  assert.equal(state.step, "aviso_nao_oficial");
  state = connectReducer(state, { type: "aceitar_risco" });
  assert.equal(state.step, "pronto_para_criar");
  state = connectReducer(state, { type: "criou_sessao" });
  assert.equal(pollingDelay(state.step), 3000);
  state = connectReducer(state, { type: "estado", status: "qr_ready", qrCode: "data:x" });
  assert.equal(state.step, "mostrar_qr");
  state = connectReducer(state, { type: "estado", status: "ready" });
  assert.equal(state.step, "conectado");
  assert.equal(pollingDelay(state.step), null);
  assert.deepEqual(Object.keys(validateOfficial({ phoneNumber: "11999", phoneNumberId: "abc", businessAccountId: "1", apiKey: "curto" })).sort(), ["apiKey", "businessAccountId", "phoneNumber", "phoneNumberId"]);
});

// ---------- conferências ----------

test("verify: aponta tema ausente, moldura fechada e assinatura recusada, com a correção", async () => {
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname;
    if (path === "/api") return json(200, { version: "4.19.1" });
    if (path === "/app/login") return new Response("<html><head><title>\n ONE \n</title></head></html>", { status: 200, headers: { "x-frame-options": "SAMEORIGIN" } });
    if (path === "/robo/health") return json(200, { ok: true, version: "1.0.0" });
    if (path.endsWith("/config")) return json(401, { ok: false });
    return json(404, {});
  };
  const result = await verify({
    env: { CHATWOOT_PUBLIC_URL: "https://chat.test", SUPPORT_BOT_PUBLIC_URL: "https://chat.test/robo/chatwoot", PROJECT_URL: "https://app.test/api/atendimento/robo", SUPPORT_BOT_SECRET: "s" },
    expected: { chatwootVersion: "4.19.1", brand: "ONE", themeHash: "abc", frame: true, projectOrigin: "https://app.test", featuresOff: [], neverOff: [] },
    fetchImpl,
  });
  const byName = Object.fromEntries(result.checks.map((check) => [check.name, check]));
  assert.equal(byName.chatwoot_versao.ok, true);
  assert.equal(byName.marca_no_titulo.ok, true);
  assert.equal(byName.tema_aplicado.ok, false);
  assert.equal(byName.moldura.ok, false);
  assert.equal(byName.robo_no_ar.ok, true);
  assert.equal(byName.assinatura_robo_projeto.ok, false);
  assert.ok(byName.assinatura_robo_projeto.fix.length > 0);
  assert.equal(result.ok, false);
});

test("look: julga tema, cor, o que devia sumir e links do Chatwoot", () => {
  const summary = { hash: "h1", primary: "11 95 255", primary_dark: "11 95 255", brand: "ONE", hides: ["#x"] };
  const good = { theme: "h1", blue9: "11 95 255", dark: false, hides: [{ selector: "#x", visible: 0 }], brandSample: { name: "bg-n-brand", color: "rgb(11, 95, 255)" }, chatwootLinks: 0, title: "ONE" };
  assert.deepEqual(judge(good, { summary, scheme: "claro" }), []);
  const bad = { ...good, theme: "h0", hides: [{ selector: "#x", visible: 2 }], brandSample: { name: "bg-n-brand", color: "rgb(39, 129, 246)" }, chatwootLinks: 1 };
  assert.equal(judge(bad, { summary, scheme: "claro" }).length, 4);
  assert.equal(judge({ ...good }, { summary, scheme: "escuro" }).length, 1, "pediu escuro e o painel ficou claro");
});

test("arquivo .env: aspas, comentários e export", () => {
  assert.deepEqual(parseDotenv('export A=1\nB="dois # nao"\nC=tres # comentario\n# D=4\nE=\'cinco\''), { A: "1", B: "dois # nao", C: "tres", E: "cinco" });
});

// ---------- contexto em camadas, controlado pela plataforma ----------

const DECLARED = [
  { name: "consultar_pedido", description: "pedido", input_schema: {} },
  { name: "segunda_via", description: "boleto", input_schema: {} },
];

test("modelo plataforma (como um suporte da própria plataforma): só a camada do superadmin vale", () => {
  const platform = { ...defaultPlatformSettings("Atrupe"), instructions: "Regras da Atrupe.", knowledge: [{ q: "Planos?", a: "Três planos." }], tools_enabled: ["segunda_via"] };
  const client = { ...defaultSettings("Cliente X"), instructions: "Tentativa do cliente.", knowledge: [{ q: "x", a: "y" }], tools_enabled: ["consultar_pedido"], mode: "desligado" };
  const config = botConfig({ model: "plataforma", platform, client, state: { bot_token: "t", bot_secret: "s" }, tools: DECLARED });
  assert.equal(config.brand, "Atrupe");
  assert.equal(config.instructions, "Regras da Atrupe.");
  assert.equal(config.platform_instructions, "");
  assert.deepEqual(config.knowledge, [{ q: "Planos?", a: "Três planos." }]);
  assert.deepEqual(config.tools.map((tool) => tool.name), ["segunda_via"]);
  assert.equal(config.mode, "auto");
  assert.deepEqual(editableGroups("cliente", "plataforma", platform), [], "no modelo plataforma o cliente não edita nada");
  assert.equal(knowledgeOwner("plataforma", platform), "plataforma");
});

test("modelo por cliente: regras da plataforma sempre, e o cliente só no que foi liberado", () => {
  const platform = {
    ...defaultPlatformSettings("ONE"),
    mode: "sugestao",
    instructions: "Pergunta jurídica vai para um advogado.",
    knowledge: [{ q: "O que é o ONE?", a: "Sistema para escritórios." }],
    client_permissions: { apresentacao: true, instrucoes: true, conhecimento: false, horario: true, mensagens: false, transferencia: false, consultas: true, modo: false },
    tools_available: ["consultar_pedido"],
    tools_enabled: [],
  };
  const client = { ...defaultSettings("Escritório Silva"), mode: "auto", instructions: "Atendemos de segunda a sexta.", knowledge: [{ q: "proibido", a: "não entra" }], tools_enabled: ["consultar_pedido", "segunda_via"] };
  const config = botConfig({ model: "por-cliente", platform, client, state: {}, tools: DECLARED });
  assert.equal(config.brand, "Escritório Silva");
  assert.equal(config.platform_instructions, "Pergunta jurídica vai para um advogado.");
  assert.equal(config.instructions, "Atendemos de segunda a sexta.");
  assert.deepEqual(config.platform_knowledge.map((item) => item.q), ["O que é o ONE?"]);
  assert.deepEqual(config.knowledge, [], "conhecimento do cliente não liberado não entra");
  assert.equal(config.mode, "sugestao", "o modo fica com a plataforma quando não é liberado");
  assert.deepEqual(config.tools.map((tool) => tool.name), ["consultar_pedido"], "o cliente só liga o que a plataforma oferece");
  assert.equal(knowledgeOwner("por-cliente", platform), "plataforma", "sem permissão de conhecimento, quem aprova sugestões é o superadmin");
});

test("plataforma desligada desliga o robô de todos os clientes", () => {
  const platform = { ...defaultPlatformSettings("P"), mode: "desligado", client_permissions: { ...defaultPlatformSettings().client_permissions, modo: true } };
  const config = botConfig({ model: "por-cliente", platform, client: { ...defaultSettings("C"), mode: "auto" }, state: {}, tools: [] });
  assert.equal(config.mode, "desligado");
  assert.equal(config.enabled, false);
});

test("cliente que nunca salvou herda tudo da plataforma", () => {
  const platform = { ...defaultPlatformSettings("P"), persona: "Você é a Bia.", hours: { timezone: "America/Manaus", days: { seg: [["09:00", "17:00"]] }, holidays: [] } };
  const config = botConfig({ model: "por-cliente", platform, client: null, state: {}, tools: [], tenantName: "Loja Y" });
  assert.equal(config.persona, "Você é a Bia.");
  assert.equal(config.hours.timezone, "America/Manaus");
  assert.equal(config.brand, "P", "sem camada do cliente, o nome vem da plataforma");
});

test("o servidor grava do cliente só os grupos liberados", () => {
  const permissions = clientPermissions("por-cliente", { client_permissions: { conhecimento: true } });
  const current = { ...defaultSettings("Loja"), instructions: "antigas" };
  const next = applyClientEdits(current, { instructions: "novas", knowledge: [{ q: "a", a: "b" }], mode: "desligado" }, permissions);
  assert.equal(next.instructions, "antigas");
  assert.deepEqual(next.knowledge, [{ q: "a", a: "b" }]);
  assert.equal(next.mode, "auto");
  assert.deepEqual(editableGroups("cliente", "por-cliente", { client_permissions: { conhecimento: true } }), ["conhecimento"]);
  assert.ok(editableGroups("plataforma", "por-cliente", null).includes("permissoes"));
});

test("validação da camada da plataforma: consultas oferecidas e permissões", () => {
  const platform = { ...defaultPlatformSettings("P"), tools_available: ["nao_existe"], client_permissions: { conhecimento: "sim" } };
  const fields = validateSettings(platform, { declaredTools: ["consultar_pedido"], scope: "plataforma" }).map((problem) => problem.field);
  assert.ok(fields.includes("tools_available"));
  assert.ok(fields.includes("client_permissions"));
});

test("relatório das lacunas: agrupa por assunto sem acento, conta e guarda exemplos", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");
  const events = [
    { kind: "handoff", category: "nao_sei", topic: "Troca de produto", excerpt: "Posso trocar?", at: "2026-11-19T10:00:00Z" },
    { kind: "handoff", category: "nao_sei", topic: "troca de PRODUTO", excerpt: "Como troco?", at: "2026-11-18T10:00:00Z" },
    { kind: "handoff", category: "pedido_da_pessoa", topic: "", excerpt: "atendente", at: "2026-11-18T09:00:00Z" },
    { kind: "handoff", category: "nao_sei", topic: "frete", excerpt: "frete?", at: "2026-09-01T10:00:00Z" },
  ];
  const groups = summarizeGaps(events, { days: 30, now });
  assert.equal(groups[0].count, 2);
  assert.deepEqual(groups[0].examples, ["Posso trocar?", "Como troco?"]);
  assert.equal(groups.some((group) => group.topic === "frete"), false, "fora da janela");
  assert.deepEqual(summarizeGaps(events, { days: 30, now, onlyUnknown: true }).map((group) => group.count), [2]);
});

test("contrato: eventos e sugestões chegam ao projeto assinados; sem tratador, 404", async () => {
  const secret = "segredo";
  const saved = [];
  const handlers = {
    secret,
    getConfig: async () => null,
    runTool: async () => null,
    getHistory: async () => [],
    saveEvent: async (accountId, event) => saved.push(["evento", accountId, event.topic]),
    saveSuggestions: async (accountId, payload) => saved.push(["sugestoes", accountId, payload.suggestions.length]),
  };
  const post = (route, body) => {
    const raw = JSON.stringify(body);
    const path = `/r/${route}`;
    const headers = Object.fromEntries(Object.entries(sharedSign({ secret, method: "POST", pathWithQuery: path, body: raw })).map(([key, value]) => [key.toLowerCase(), value]));
    return { method: "POST", pathWithQuery: path, route, query: {}, rawBody: raw, headers };
  };
  assert.equal((await handleBotRequest(post("events", { account_id: 3, topic: "frete" }), handlers)).status, 200);
  assert.equal((await handleBotRequest(post("suggestions", { account_id: 3, suggestions: [{ q: "a", a: "b" }] }), handlers)).status, 200);
  assert.deepEqual(saved, [["evento", 3, "frete"], ["sugestoes", 3, 1]]);
  assert.equal((await handleBotRequest(post("events", { account_id: 3 }), { ...handlers, saveEvent: undefined })).status, 404);
  assert.equal((await handleBotRequest(post("events", { topic: "sem conta" }), handlers)).status, 400);
});
