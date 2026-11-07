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
  ssoUrl,
  whatsappStatus,
} from "../kit/base/server/provision.mjs";
import { brPhoneVariants, contactPhone, phoneDigits, samePhone } from "../kit/base/shared/phone.mjs";
import { botConfig, defaultSettings, validateSettings } from "../kit/base/shared/settings.mjs";
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

// ---------- configurações, telefones, assinatura ----------

test("configurações: padrões válidos, erros por campo e montagem da configuração do robô", () => {
  assert.deepEqual(validateSettings(defaultSettings("Loja")), []);
  const bad = { ...defaultSettings("Loja"), mode: "x", knowledge: [{ q: "", a: "" }], tools_enabled: ["apagar_tudo"], handoff: { keywords: null, max_bot_turns: 0, team_id: null } };
  bad.hours = { ...bad.hours, days: { ...bad.hours.days, seg: [["18:00", "08:00"]] } };
  const fields = validateSettings(bad, { declaredTools: ["consultar_pedido"] }).map((problem) => problem.field);
  for (const field of ["mode", "knowledge.0", "tools_enabled", "handoff.max_bot_turns", "hours.days.seg.0"]) assert.ok(fields.includes(field), field);

  const config = botConfig({
    settings: { ...defaultSettings("Loja"), tools_enabled: ["consultar_pedido"] },
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
  let nextId = 100;
  const fetchImpl = async (url, init = {}) => {
    const target = new URL(url);
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    const path = target.pathname;
    calls.push({ host: target.host, method, path, body });
    if (target.host === "chat.test") {
      if (method === "POST" && path === "/platform/api/v1/accounts") return json(200, { id: 3, name: body.name, features: body.features });
      if (method === "PATCH" && /^\/platform\/api\/v1\/accounts\/\d+$/.test(path)) return json(200, { id: 3 });
      if (method === "POST" && path === "/platform/api/v1/users") {
        if (!users.has(body.email)) users.set(body.email, nextId++);
        return json(200, { id: users.get(body.email), email: body.email });
      }
      if (method === "GET" && /^\/platform\/api\/v1\/users\/\d+$/.test(path)) return json(200, { id: Number(path.split("/").pop()), access_token: `token-${path.split("/").pop()}` });
      if (method === "PATCH" && /^\/platform\/api\/v1\/users\/\d+$/.test(path)) return json(200, {});
      if (method === "POST" && path === "/platform/api/v1/accounts/3/account_users") return json(200, { user_id: body.user_id, role: body.role });
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
