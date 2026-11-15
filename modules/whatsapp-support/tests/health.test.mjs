// A conferência do número: a sessão do OpenWA, a saúde que o Chatwoot lê da Meta, os avisos e os caminhos de volta.

import assert from "node:assert/strict";
import { test } from "node:test";

import { checkWhatsappHealth, classifyCloudHealth, classifySession, currentInbox, healthAlerts, worstLevel } from "../kit/base/server/health.mjs";
import { connectCloudApi, reconnectOpenWA, updateCloudApi, whatsappStatus } from "../kit/base/server/provision.mjs";
import { verify } from "../scripts/lib/verify.mjs";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const levelOf = (findings) => worstLevel(findings.map((item) => item.level));
const codesOf = (findings) => findings.map((item) => item.code);

test("sessão do OpenWA: cada estado vira um nível, com o que se viu e a correção", () => {
  const cases = [
    [{ status: "ready" }, "ok", []],
    [{ status: "qr_ready" }, "fora", ["numero_desconectado"]],
    [{ status: "created" }, "fora", ["numero_nunca_conectou"]],
    [{ status: "disconnected", engineLoaded: true }, "atencao", ["reconectando"]],
    [{ status: "disconnected", engineLoaded: false }, "fora", ["sessao_parada"]],
    [{ status: "initializing" }, "atencao", ["iniciando"]],
    [{ status: "authenticating" }, "atencao", ["iniciando"]],
    [{ status: "action_required" }, "fora", ["sessao_com_falha"]],
    [{ status: "failed" }, "fora", ["sessao_com_falha"]],
    [{ status: "estado_novo" }, "atencao", ["estado_desconhecido"]],
    [null, "fora", ["sessao_ausente"]],
  ];
  for (const [session, level, codes] of cases) {
    const findings = classifySession(session);
    assert.equal(levelOf(findings), level, JSON.stringify(session));
    assert.deepEqual(codesOf(findings), codes, JSON.stringify(session));
    for (const item of findings) assert.ok(item.detail && item.fix && item.fixBy, item.code);
  }
});

test("restrições do WhatsApp: conversas novas só pedem atenção; banimento e rede recusada param o número", () => {
  const limited = classifySession({ status: "ready", restriction: { kind: "reachout_timelock", code: "BIZ_QUALITY", expiresAt: "2026-11-10T15:00:00.000Z" } });
  assert.equal(levelOf(limited), "atencao");
  assert.match(limited[0].detail, /10\/11\/2026/);
  assert.match(limited[0].detail, /horário de Brasília/);

  const banned = classifySession({ status: "disconnected", engineLoaded: false, restriction: { kind: "tos_block", code: "TOS_BLOCK" } });
  assert.equal(levelOf(banned), "fora");
  assert.ok(codesOf(banned).includes("whatsapp_recusou_numero"));

  const network = classifySession({ status: "disconnected", engineLoaded: true, restriction: { kind: "proxy_block", code: "PROXYBLOCK" } });
  assert.equal(levelOf(network), "fora");
  assert.equal(network[0].fixBy, "tecnico");

  assert.deepEqual(codesOf(classifySession({ status: "ready", restriction: { kind: "outro", code: "X" } })), ["whatsapp_restricao"]);
});

test("saúde da Meta: estado, qualidade e token recusado", () => {
  const cases = [
    [{ health: { status: "CONNECTED", quality_rating: "GREEN" } }, "ok", []],
    [{ health: { status: "BANNED" } }, "fora", ["meta_numero_fora"]],
    [{ health: { status: "DISCONNECTED" } }, "fora", ["meta_numero_fora"]],
    [{ health: { status: "FLAGGED" } }, "atencao", ["meta_numero_limitado"]],
    [{ health: { status: "PENDING" } }, "atencao", ["meta_estado"]],
    [{ health: { status: "CONNECTED", quality_rating: "YELLOW" } }, "atencao", ["meta_qualidade"]],
    [{ error: { type: "authorization", message: "token" } }, "fora", ["meta_recusou_token"]],
    [{ error: { type: "api", message: "fora" } }, "atencao", ["meta_sem_resposta"]],
  ];
  for (const [input, level, codes] of cases) {
    const findings = classifyCloudHealth(input);
    assert.equal(levelOf(findings), level, JSON.stringify(input));
    assert.deepEqual(codesOf(findings), codes, JSON.stringify(input));
  }
});

test("saúde da Meta: o aviso precisa chegar a este painel, mesmo vindo pelo endereço de outro número do mesmo app", () => {
  const expected = "https://chat.test/webhooks/whatsapp/+5511999990000";
  const withWebhook = (webhook_configuration) => classifyCloudHealth({ health: { status: "CONNECTED", expected_webhook_url: expected, webhook_configuration } });
  assert.deepEqual(codesOf(withWebhook({ application: expected })), []);
  assert.deepEqual(codesOf(withWebhook({ application: "https://chat.test/webhooks/whatsapp/+5511888880000" })), [], "o Chatwoot acha o número pelo conteúdo do aviso");
  assert.deepEqual(codesOf(withWebhook({})), ["meta_sem_aviso"]);
  assert.equal(levelOf(withWebhook({})), "fora");
  const elsewhere = withWebhook({ application: "https://outro.test/retorno" });
  assert.deepEqual(codesOf(elsewhere), ["meta_aviso_em_outro_endereco"]);
  assert.equal(levelOf(elsewhere), "atencao", "esse endereço pode repassar ao painel");
  assert.deepEqual(codesOf(withWebhook({ application: "https://outro.test/retorno", phone_number: expected })), [], "o endereço do número vale antes do endereço do app");
  assert.deepEqual(codesOf(classifyCloudHealth({ health: { status: "CONNECTED" } })), [], "sem o dado, não acusa nada");
});

function fakeStack({ session = { status: "ready", phone: "5511999990000", engineLoaded: true }, plugins = [{ id: "chatwoot-adapter", status: "enabled" }], adapterHealth = { healthy: true }, health = { status: "CONNECTED", quality_rating: "GREEN" }, inbox = {}, down = [] } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const target = new URL(url);
    const method = init.method ?? "GET";
    calls.push({ host: target.host, method, path: target.pathname, body: init.body ? JSON.parse(init.body) : null, headers: init.headers });
    if (down.includes(target.host)) throw new TypeError("fetch failed");
    if (target.host === "chat.test") {
      if (target.pathname === "/api/v1/accounts/3/inboxes/11/health") return health instanceof Response ? health : json(200, health);
      if (method === "GET" && target.pathname === "/api/v1/accounts/3/inboxes/11") {
        return inbox instanceof Response ? inbox : json(200, { id: 11, callback_webhook_url: "https://chat.test/webhooks/whatsapp/+5511999990000", provider_config: { api_key: "antigo", webhook_verify_token: "verif", phone_number_id: "123456", business_account_id: "654321" }, ...inbox });
      }
      if (method === "PATCH" && target.pathname === "/api/v1/accounts/3/inboxes/11") return inbox instanceof Response ? inbox : json(200, { id: 11, callback_webhook_url: "https://chat.test/webhooks/whatsapp/+5511999990000" });
      if (method === "POST" && target.pathname === "/api/v1/accounts/3/inboxes") return inbox instanceof Response ? inbox : json(200, { id: 11 });
    }
    if (target.host === "wa.test") {
      if (target.pathname === "/api/sessions/sess-1/start") return session?.startStatus ? json(session.startStatus, {}) : json(200, {});
      if (target.pathname === "/api/sessions/sess-1/qr") return json(200, { qrCode: "data:image/png;base64,AAA" });
      if (target.pathname === "/api/sessions/sess-1") return session ? json(200, session) : json(404, {});
      if (target.pathname === "/api/plugins") return json(200, plugins);
      if (target.pathname === "/api/plugins/chatwoot-adapter/health") return json(200, adapterHealth);
    }
    return json(404, {});
  };
  return { calls, fetchImpl };
}

const STATE = { account_id: 3, service_token: "svc-segredo" };
const OFFICIAL = { ...STATE, inboxes: [{ id: 11, route: "oficial", phone: "+5511999990000" }] };
const UNOFFICIAL = { ...STATE, inboxes: [{ id: 11, route: "nao_oficial", session_id: "sess-1" }] };
const OPENWA = { url: "https://wa.test", apiKey: "chave-segredo" };

test("conferência, rota oficial: lê a saúde com o token da conta de serviço", async () => {
  const { calls, fetchImpl } = fakeStack({ health: { status: "BANNED", quality_rating: "RED" } });
  const report = await checkWhatsappHealth({ chatwootUrl: "https://chat.test", state: OFFICIAL, fetchImpl });
  assert.equal(report.level, "fora");
  assert.equal(report.inboxes[0].phone, "+5511999990000");
  assert.deepEqual(codesOf(report.inboxes[0].findings), ["meta_numero_fora", "meta_qualidade"]);
  assert.equal(calls[0].headers.api_access_token, "svc-segredo");
  assert.equal(calls.length, 1, "a rota oficial não fala com o OpenWA");
});

test("conferência, rota oficial: token recusado pela Meta, caixa apagada e painel fora do ar", async () => {
  const refused = fakeStack({ health: json(422, { error: { type: "authorization", message: "Invalid OAuth", code: 190 } }) });
  const token = await checkWhatsappHealth({ chatwootUrl: "https://chat.test", state: OFFICIAL, fetchImpl: refused.fetchImpl });
  assert.deepEqual(codesOf(token.inboxes[0].findings), ["meta_recusou_token"]);

  const plain = fakeStack({ health: json(422, { error: "Health data not available" }) });
  assert.deepEqual(codesOf((await checkWhatsappHealth({ chatwootUrl: "https://chat.test", state: OFFICIAL, fetchImpl: plain.fetchImpl })).inboxes[0].findings), ["meta_sem_resposta"]);

  const gone = fakeStack({ health: json(404, {}) });
  assert.deepEqual(codesOf((await checkWhatsappHealth({ chatwootUrl: "https://chat.test", state: OFFICIAL, fetchImpl: gone.fetchImpl })).inboxes[0].findings), ["caixa_ausente"]);

  const down = fakeStack({ down: ["chat.test"] });
  const report = await checkWhatsappHealth({ chatwootUrl: "https://chat.test", state: OFFICIAL, fetchImpl: down.fetchImpl });
  assert.deepEqual(codesOf(report.inboxes[0].findings), ["painel_fora_do_ar"]);
  assert.equal(report.inboxes[0].findings[0].fixBy, "tecnico");
});

test("conferência, rota não oficial: número ligado, ponte desligada, OpenWA fora do ar, sessão e caixa apagadas", async () => {
  const check = (options) => {
    const { fetchImpl } = fakeStack(options);
    return checkWhatsappHealth({ chatwootUrl: "https://chat.test", state: UNOFFICIAL, openwa: OPENWA, fetchImpl });
  };
  const healthy = await check({});
  assert.equal(healthy.level, "ok");
  assert.equal(healthy.inboxes[0].phone, "5511999990000");

  assert.deepEqual(codesOf((await check({ session: { status: "qr_ready" } })).inboxes[0].findings), ["numero_desconectado"]);
  assert.deepEqual(codesOf((await check({ plugins: [{ id: "chatwoot-adapter", enabled: false }] })).inboxes[0].findings), ["adaptador_desligado"]);
  assert.deepEqual(codesOf((await check({ plugins: [] })).inboxes[0].findings), ["adaptador_desligado"]);
  // OpenWA 0.29.1: a lista traz status, e enabled não existe. Em erro, o número conecta e nada chega (Atrupe).
  assert.deepEqual(codesOf((await check({ plugins: [{ id: "chatwoot-adapter", status: "error" }] })).inboxes[0].findings), ["adaptador_desligado"]);
  const unhealthy = await check({ adapterHealth: { healthy: false, message: "missing/invalid config: baseUrl" } });
  assert.deepEqual(codesOf(unhealthy.inboxes[0].findings), ["adaptador_com_erro"]);
  assert.equal(unhealthy.level, "fora");
  assert.ok(unhealthy.inboxes[0].findings[0].detail.includes("missing/invalid config"));
  assert.equal(unhealthy.inboxes[0].findings[0].fixBy, "tecnico");
  assert.deepEqual(codesOf((await check({ down: ["wa.test"] })).inboxes[0].findings), ["openwa_fora_do_ar"]);
  assert.deepEqual(codesOf((await check({ session: null })).inboxes[0].findings), ["sessao_ausente"]);
  assert.deepEqual(codesOf((await check({ inbox: json(404, {}) })).inboxes[0].findings), ["caixa_ausente"]);

  const { fetchImpl } = fakeStack({});
  const noConfig = await checkWhatsappHealth({ chatwootUrl: "https://chat.test", state: UNOFFICIAL, fetchImpl });
  assert.deepEqual(codesOf(noConfig.inboxes[0].findings), ["openwa_sem_configuracao"]);
});

test("conferência: olha só o número atual, a última caixa conectada", async () => {
  const state = { ...STATE, inboxes: [{ id: 5, route: "nao_oficial", session_id: "velha" }, { id: 11, route: "oficial", phone: "+5511999990000" }] };
  assert.equal(currentInbox(state).id, 11);
  assert.equal(currentInbox({}), null);
  assert.equal(currentInbox(null), null);
  const { fetchImpl } = fakeStack();
  const report = await checkWhatsappHealth({ chatwootUrl: "https://chat.test", state, fetchImpl });
  assert.deepEqual(report.inboxes.map((inbox) => inbox.inbox_id), [11]);
  assert.deepEqual((await checkWhatsappHealth({ chatwootUrl: "https://chat.test", state: STATE, fetchImpl })).inboxes, []);
});

// ---------- avisos ----------

const reportOf = (findings, phone = "+5511999990000") => ({
  checked_at: "x",
  level: worstLevel(findings.map((item) => item.level)),
  inboxes: [{ inbox_id: 11, route: "oficial", phone, level: worstLevel(findings.map((item) => item.level)), findings }],
});
const DOWN = classifySession({ status: "qr_ready" });
const ATTENTION = classifyCloudHealth({ health: { status: "CONNECTED", quality_rating: "YELLOW" } });
const PASSING = classifySession({ status: "initializing" });
const at = (hours) => new Date(Date.UTC(2026, 10, 8, hours));

test("avisos: número bom não avisa nem grava de novo; parou avisa uma vez, lembra por dia e avisa a volta", () => {
  let result = healthAlerts({ report: reportOf([]), now: at(0) });
  assert.deepEqual(result.alerts, []);
  const healthy = result.health;
  result = healthAlerts({ previous: healthy, report: reportOf([]), now: at(1) });
  assert.deepEqual(result.alerts, []);
  assert.deepEqual(result.health, healthy, "sem mudança, a memória é igual e o projeto não grava");

  result = healthAlerts({ previous: result.health, report: reportOf(DOWN), now: at(2) });
  assert.equal(result.alerts.length, 1);
  assert.equal(result.alerts[0].kind, "novo");
  assert.equal(result.alerts[0].title, "O WhatsApp do atendimento parou");
  assert.match(result.alerts[0].text, /\+5511999990000/);
  assert.match(result.alerts[0].text, /O que fazer: Na tela Conectar WhatsApp/);
  assert.equal(result.alerts[0].fixBy, "quem_conecta");

  const down = result.health;
  result = healthAlerts({ previous: down, report: reportOf(DOWN), now: at(10) });
  assert.deepEqual(result.alerts, [], "dentro de 24 horas, não repete");
  assert.deepEqual(result.health, down);

  result = healthAlerts({ previous: down, report: reportOf(DOWN), now: at(26) });
  assert.equal(result.alerts[0].kind, "lembrete");
  assert.equal(result.alerts[0].title, "O WhatsApp do atendimento continua parado");
  assert.equal(result.alerts[0].since, at(2).toISOString(), "desde quando continua sendo a primeira vez");

  result = healthAlerts({ previous: result.health, report: reportOf([]), now: at(27) });
  assert.equal(result.alerts[0].kind, "voltou");
  assert.equal(result.alerts[0].title, "O WhatsApp do atendimento voltou ao normal");
  assert.equal(result.health["11"].open, false);

  result = healthAlerts({ previous: result.health, report: reportOf([]), now: at(28) });
  assert.deepEqual(result.alerts, [], "a volta é avisada uma vez");
});

test("avisos: pede atenção avisa uma vez, sem lembrete; um problema diferente avisa de novo", () => {
  let result = healthAlerts({ report: reportOf(ATTENTION), now: at(0) });
  assert.equal(result.alerts[0].title, "O WhatsApp do atendimento pede atenção");
  result = healthAlerts({ previous: result.health, report: reportOf(ATTENTION), now: at(30) });
  assert.deepEqual(result.alerts, []);
  result = healthAlerts({ previous: result.health, report: reportOf(DOWN), now: at(31) });
  assert.equal(result.alerts[0].kind, "novo");
  assert.equal(result.alerts[0].level, "fora");
});

test("avisos: o que passa sozinho só avisa se continuar; se passou sem aviso, não há volta para avisar", () => {
  let result = healthAlerts({ report: reportOf([]), now: at(0) });
  result = healthAlerts({ previous: result.health, report: reportOf(PASSING), now: at(1) });
  assert.deepEqual(result.alerts, [], "na primeira conferência, ainda pode passar");
  const seenOnce = result.health;
  const passed = healthAlerts({ previous: seenOnce, report: reportOf([]), now: at(2) });
  assert.deepEqual(passed.alerts, []);

  const stuck = healthAlerts({ previous: seenOnce, report: reportOf(PASSING), now: at(2) });
  assert.equal(stuck.alerts[0].kind, "novo");
  assert.equal(stuck.alerts[0].level, "atencao");
  const after = healthAlerts({ previous: stuck.health, report: reportOf(PASSING), now: at(3) });
  assert.deepEqual(after.alerts, [], "avisa uma vez");
  assert.equal(healthAlerts({ previous: after.health, report: reportOf([]), now: at(4) }).alerts[0].kind, "voltou");
});

test("avisos: quem foi avisado da queda fica sabendo da volta, mesmo passando por um estado que se resolve sozinho", () => {
  let result = healthAlerts({ report: reportOf(DOWN), now: at(0) });
  result = healthAlerts({ previous: result.health, report: reportOf(PASSING), now: at(1) });
  assert.deepEqual(result.alerts, []);
  assert.equal(healthAlerts({ previous: result.health, report: reportOf([]), now: at(2) }).alerts[0].kind, "voltou");
});

test("avisos: problema do servidor vai também para quem cuida dele, e o texto não leva segredo", async () => {
  const { fetchImpl } = fakeStack({ down: ["wa.test"] });
  const report = await checkWhatsappHealth({ chatwootUrl: "https://chat.test", state: UNOFFICIAL, openwa: OPENWA, fetchImpl });
  const { alerts, health } = healthAlerts({ report, now: at(0) });
  assert.equal(alerts[0].fixBy, "tecnico");
  const everything = JSON.stringify({ alerts, health });
  assert.ok(!everything.includes("svc-segredo"));
  assert.ok(!everything.includes("chave-segredo"));
});

test("avisos: caixa que saiu da conferência sai da memória", () => {
  const { health } = healthAlerts({ previous: { 5: { level: "fora", codes: ["x"], since: "y", notified_at: "z", open: true } }, report: reportOf([]), now: at(0) });
  assert.deepEqual(Object.keys(health), ["11"]);
});

// ---------- os caminhos de volta ----------

test("estado para a tela: traz o achado e não derruba a tela com o OpenWA fora do ar", async () => {
  const waiting = fakeStack({ session: { status: "qr_ready" } });
  const status = await whatsappStatus({ openwaUrl: "https://wa.test", openwaApiKey: "k", sessionId: "sess-1", fetchImpl: waiting.fetchImpl });
  assert.equal(status.qrCode, "data:image/png;base64,AAA");
  assert.equal(status.level, "fora");
  assert.deepEqual(codesOf(status.findings), ["numero_desconectado"]);

  const down = fakeStack({ down: ["wa.test"] });
  const offline = await whatsappStatus({ openwaUrl: "https://wa.test", openwaApiKey: "k", sessionId: "sess-1", fetchImpl: down.fetchImpl });
  assert.equal(offline.status, "unknown");
  assert.deepEqual(codesOf(offline.findings), ["openwa_fora_do_ar"]);
});

test("ler o QR de novo: retoma a sessão parada, sem criar outra; não mexe na que já está tentando", async () => {
  const input = { openwaUrl: "https://wa.test", openwaApiKey: "k", sessionId: "sess-1" };
  const started = (calls) => calls.some((call) => call.method === "POST" && call.path === "/api/sessions/sess-1/start");

  const stopped = fakeStack({ session: { status: "disconnected", engineLoaded: false } });
  assert.deepEqual(await reconnectOpenWA({ ...input, fetchImpl: stopped.fetchImpl }), { status: "initializing", started: true });
  assert.ok(started(stopped.calls));
  assert.ok(!stopped.calls.some((call) => call.method === "POST" && call.path === "/api/sessions"), "não cria sessão nova");

  const retrying = fakeStack({ session: { status: "disconnected", engineLoaded: true } });
  assert.deepEqual(await reconnectOpenWA({ ...input, fetchImpl: retrying.fetchImpl }), { status: "disconnected", started: false });
  assert.ok(!started(retrying.calls));

  const ready = fakeStack({ session: { status: "ready" } });
  assert.equal((await reconnectOpenWA({ ...input, fetchImpl: ready.fetchImpl })).started, false);
  assert.ok(!started(ready.calls));

  const refused = fakeStack({ session: { status: "failed", startStatus: 400 } });
  assert.deepEqual(await reconnectOpenWA({ ...input, fetchImpl: refused.fetchImpl }), { status: "failed", started: false }, "o OpenWA recusa o início com o motor carregado");

  const gone = fakeStack({ session: null });
  await assert.rejects(reconnectOpenWA({ ...input, fetchImpl: gone.fetchImpl }), (error) => error.code === "session_missing" && error.fix.length > 0);

  const down = fakeStack({ down: ["wa.test"] });
  await assert.rejects(reconnectOpenWA({ ...input, fetchImpl: down.fetchImpl }), (error) => error.code === "network");
});

test("trocar o token da Meta: mesma caixa, token de verificação mantido, e a recusa diz o que conferir", async () => {
  const { calls, fetchImpl } = fakeStack();
  const result = await updateCloudApi({ chatwootUrl: "https://chat.test", state: OFFICIAL, inboxId: 11, cloud: { apiKey: "novo-token", phoneNumberId: "999999" }, fetchImpl });
  const patch = calls.find((call) => call.method === "PATCH");
  assert.equal(patch.path, "/api/v1/accounts/3/inboxes/11");
  assert.deepEqual(patch.body.channel.provider_config, { api_key: "novo-token", webhook_verify_token: "verif", phone_number_id: "999999", business_account_id: "654321" });
  assert.ok(!calls.some((call) => call.method === "POST"), "não cria outra caixa");
  assert.deepEqual(result.metaWebhook, { callbackUrl: "https://chat.test/webhooks/whatsapp/+5511999990000", verifyToken: "verif" });
  assert.equal(result.state, OFFICIAL, "a lista de caixas não muda");

  const rejected = (inbox) => async (url, init = {}) => {
    if (init.method === "PATCH" || init.method === "POST") return json(422, { message: "Invalid Credentials" });
    return json(200, inbox);
  };
  await assert.rejects(updateCloudApi({ chatwootUrl: "https://chat.test", state: OFFICIAL, inboxId: 11, cloud: { apiKey: "x" }, fetchImpl: rejected({ id: 11 }) }), (error) => error.code === "meta_rejected" && /token/.test(error.fix));
  await assert.rejects(
    connectCloudApi({ chatwootUrl: "https://chat.test", state: STATE, cloud: { phoneNumber: "+5511999990000", phoneNumberId: "1", businessAccountId: "2", apiKey: "x" }, fetchImpl: rejected({}) }),
    (error) => error.code === "meta_rejected",
    "conectar com dados recusados diz o mesmo",
  );
});

// ---------- conferência por HTTP ----------

test("verify: cada sessão do OpenWA aparece, e só o número fora reprova", async () => {
  const fetchImpl = async (url, init = {}) => {
    const path = new URL(url).pathname;
    if (path === "/api/health") return json(200, {});
    if (path === "/api/plugins") return json(200, [{ id: "chatwoot-adapter", enabled: true, version: "0.9.15" }]);
    if (path === "/api/sessions") {
      assert.equal(init.headers["X-API-Key"], "k");
      return json(200, [
        { id: "1", name: "cliente-a", status: "ready" },
        { id: "2", name: "cliente-b", status: "qr_ready" },
        { id: "3", name: "cliente-c", status: "disconnected", engineLoaded: true },
      ]);
    }
    return json(404, {});
  };
  const expected = { featuresOff: [], neverOff: [] };
  const { checks } = await verify({ env: { OPENWA_PUBLIC_URL: "https://wa.test", OPENWA_API_KEY: "k" }, expected, fetchImpl });
  const byName = Object.fromEntries(checks.map((check) => [check.name, check]));
  assert.equal(byName["numero_conectado_cliente-a"].ok, true);
  assert.equal(byName["numero_conectado_cliente-b"].ok, false);
  assert.match(byName["numero_conectado_cliente-b"].fix, /Ler o QR de novo/);
  assert.equal(byName["numero_conectado_cliente-c"].ok, true, "tentando de novo sozinho não reprova");
  assert.match(byName["numero_conectado_cliente-c"].seen, /tentando de novo/);
});

test("verify: sem sessão ainda não reprova; chave recusada e OpenWA fora do ar, sim", async () => {
  const run = (fetchImpl) => verify({ env: { OPENWA_PUBLIC_URL: "https://wa.test", OPENWA_API_KEY: "k" }, expected: { featuresOff: [], neverOff: [] }, fetchImpl });
  const named = (checks) => checks.find((check) => check.name === "numero_conectado");
  const respond = (sessions) => async (url) => (new URL(url).pathname === "/api/sessions" ? sessions : json(200, []));
  assert.equal(named((await run(respond(json(200, [])))).checks).ok, true);
  const refused = named((await run(respond(json(401, {})))).checks);
  assert.equal(refused.ok, false);
  assert.match(refused.seen, /401/);
  const offline = await run(async () => {
    throw new TypeError("fetch failed");
  });
  assert.equal(named(offline.checks).ok, false);
  assert.equal(named(offline.checks).seen, "sem resposta");
});

// Achado da Atrupe (2026-11-12): a contagem de descartadas do chatwoot-adapter só cresce enquanto ele fica
// ligado; uma mensagem perdida no passado não pode virar alarme de número parado para sempre.
test("adaptador: descartadas é atenção com a contagem na chave; perdida antes da fila e fila cheia é fora", async () => {
  const { classifyAdapterHealth, healthAlerts } = await import("../kit/base/server/health.mjs");
  assert.equal(classifyAdapterHealth({ healthy: true }), null);
  const lost = classifyAdapterHealth({ healthy: false, message: "1 dead-lettered after 5 attempts; last error: POST /conversations -> 401" });
  assert.equal(lost.level, "atencao");
  assert.equal(lost.code, "adaptador_mensagens_perdidas");
  assert.equal(lost.key, "adaptador_mensagens_perdidas:1");
  assert.ok(lost.detail.startsWith("Uma mensagem do WhatsApp não chegou"));
  assert.ok(lost.fix.includes("desligue e ligue o adaptador"));
  for (const message of ["2 inbound message(s) pending retry, queue full, dropping oldest", "1 LOST (could not be queued)", "3 dead-lettered after 5 attempts; 1 LOST (could not be queued)", "missing/invalid config: baseUrl", ""]) {
    assert.equal(classifyAdapterHealth({ healthy: false, message }).level, "fora", message || "sem mensagem");
  }

  const report = (finding) => ({ inboxes: [{ inbox_id: 12, route: "nao_oficial", phone: "5511999990000", level: finding.level, findings: [finding] }] });
  const first = healthAlerts({ previous: {}, report: report(lost), now: new Date("2026-11-12T10:00:00Z") });
  assert.deepEqual(first.alerts.map((alert) => alert.kind), ["novo"]);
  const same = healthAlerts({ previous: first.health, report: report(lost), now: new Date("2026-11-13T12:00:00Z") });
  assert.deepEqual(same.alerts, [], "a mesma contagem não avisa de novo, nem um dia depois");
  const more = classifyAdapterHealth({ healthy: false, message: "2 dead-lettered after 5 attempts; last error: timeout" });
  const grew = healthAlerts({ previous: same.health, report: report(more), now: new Date("2026-11-13T12:15:00Z") });
  assert.deepEqual(grew.alerts.map((alert) => alert.kind), ["novo"], "a contagem que cresce avisa de novo");
});
