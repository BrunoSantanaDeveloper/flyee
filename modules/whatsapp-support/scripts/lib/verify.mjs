// Conferência por HTTP, sem navegador: o painel no ar e na versão travada, a marca e o tema aplicados,
// os cabeçalhos da moldura, as funções da conta, o robô de pé, a assinatura entre robô e projeto
// e o OpenWA com o adaptador. Cada item volta com ok, o que se viu e a correção.

import { createHmac } from "node:crypto";

const CHECK_TIMEOUT = 15000;

async function fetchText(url, { headers = {}, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(url, { headers, redirect: "manual", signal: AbortSignal.timeout(CHECK_TIMEOUT) });
  return { status: response.status, headers: response.headers, text: await response.text() };
}

function jsonOf(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function signed(secret, method, url, body = "") {
  const target = new URL(url);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${method}.${target.pathname}${target.search}.${body}`).digest("hex")}`;
  return { "X-Support-Timestamp": timestamp, "X-Support-Signature": signature };
}

const trim = (url) => String(url ?? "").replace(/\/+$/, "");

/**
 * env: CHATWOOT_PUBLIC_URL, CHATWOOT_PLATFORM_TOKEN, SUPPORT_BOT_PUBLIC_URL, SUPPORT_BOT_SECRET, PROJECT_URL,
 * OPENWA_PUBLIC_URL e OPENWA_API_KEY (os dois últimos só na rota não oficial).
 * expected: { chatwootVersion, brand, themeHash, frame: boolean, projectOrigin, featuresOff, neverOff, accountId }
 */
export async function verify({ env, expected, fetchImpl = fetch }) {
  const checks = [];
  const add = (name, ok, seen, fix = "") => checks.push({ name, ok, seen, fix: ok ? "" : fix });
  const chatwoot = trim(env.CHATWOOT_PUBLIC_URL);

  if (!chatwoot) add("chatwoot_url", false, "CHATWOOT_PUBLIC_URL ausente", "Defina CHATWOOT_PUBLIC_URL no ambiente ou no .env indicado.");
  else {
    try {
      const api = await fetchText(`${chatwoot}/api`, { fetchImpl });
      const version = jsonOf(api.text)?.version ?? null;
      add("chatwoot_no_ar", api.status === 200 && Boolean(version), `status ${api.status}${version ? `, versão ${version}` : ""}`, "Confira se o Chatwoot subiu e se o proxy aponta para ele.");
      if (version) add("chatwoot_versao", version === expected.chatwootVersion, `versão ${version}, kit travado em ${expected.chatwootVersion}`, "Use a imagem da versão travada no kit ou atualize o kit antes de trocar a versão.");
    } catch (error) {
      add("chatwoot_no_ar", false, error?.name === "TimeoutError" ? "sem resposta" : "falha de rede", "Confira o endereço, o DNS e o TLS do painel.");
    }
    try {
      const login = await fetchText(`${chatwoot}/app/login`, { fetchImpl });
      if (login.status >= 300 && login.status < 400) {
        const target = login.headers.get("location") ?? "";
        add(
          "painel_pronto",
          false,
          `redireciona para ${target}`,
          /onboarding/.test(target) ? "Termine a criação do super administrador em /installation/onboarding do painel." : "Confira FRONTEND_URL do Chatwoot e o proxy.",
        );
        return { ok: false, checks };
      }
      const title = /<title>\s*([^<]*?)\s*<\/title>/i.exec(login.text)?.[1] ?? "";
      add("marca_no_titulo", Boolean(expected.brand) && title === expected.brand, `título "${title}"`, "Rode o apply-config.rb (serviço chatwoot-config) depois de gerar o tema.");
      const theme = /data-kit-theme="([0-9a-f]+)"/.exec(login.text)?.[1] ?? null;
      add("tema_aplicado", theme !== null, theme ? `tema ${theme}` : "sem o tema do kit no HTML", "Rode kit.mjs theme e depois o apply-config.rb.");
      if (theme) add("tema_atual", theme === expected.themeHash, `no ar ${theme}, gerado ${expected.themeHash}`, "O tema mudou depois da última aplicação: rode o apply-config.rb de novo.");
      const xfo = login.headers.get("x-frame-options");
      const csp = login.headers.get("content-security-policy") ?? "";
      if (expected.frame) {
        const allows = /frame-ancestors/i.test(csp) && (!expected.projectOrigin || csp.includes(expected.projectOrigin));
        add("moldura", !xfo && allows, `X-Frame-Options ${xfo ?? "ausente"}; frame-ancestors ${allows ? "com a origem do projeto" : "ausente"}`, "Ligue o modo moldura no proxy (as duas linhas header_down do Caddyfile, ou o equivalente).");
      } else {
        add("moldura_desligada", Boolean(xfo) || /frame-ancestors/i.test(csp), `X-Frame-Options ${xfo ?? "ausente"}`, "Sem moldura, o painel deve recusar ser aberto dentro de outro site; confira o proxy.");
      }
    } catch {
      add("marca_no_titulo", false, "não consegui abrir /app/login", "Confira o endereço do painel.");
    }
  }

  if (expected.accountId && env.CHATWOOT_PLATFORM_TOKEN && chatwoot) {
    try {
      const account = await fetchText(`${chatwoot}/platform/api/v1/accounts/${Number(expected.accountId)}`, {
        headers: { authorization: `Bearer ${env.CHATWOOT_PLATFORM_TOKEN}`, api_access_token: env.CHATWOOT_PLATFORM_TOKEN },
        fetchImpl,
      });
      const features = jsonOf(account.text)?.features ?? null;
      if (account.status !== 200 || !features) add("funcoes_da_conta", false, `status ${account.status}`, "Confira CHATWOOT_PLATFORM_TOKEN e se a conta foi criada por este Platform App.");
      else {
        const stillOn = expected.featuresOff.filter((name) => features[name] === true);
        const turnedOff = expected.neverOff.filter((name) => features[name] !== true);
        add("funcoes_desligadas", stillOn.length === 0, stillOn.length ? `ainda ligadas: ${stillOn.join(", ")}` : "como em escolhas.json", "Rode o provisionamento da conta de novo para aplicar features_off.");
        add("funcoes_do_atendimento", turnedOff.length === 0, turnedOff.length ? `desligadas: ${turnedOff.join(", ")}` : "todas ligadas", "Ligue de novo pela API de plataforma; sem elas o robô e o projeto param.");
      }
    } catch {
      add("funcoes_da_conta", false, "falha ao consultar a API de plataforma", "Confira o endereço e o token do Platform App.");
    }
  }

  const botUrl = trim(env.SUPPORT_BOT_PUBLIC_URL);
  if (botUrl) {
    try {
      const health = await fetchText(botUrl.replace(/\/chatwoot$/, "/health"), { fetchImpl });
      const body = jsonOf(health.text);
      add("robo_no_ar", health.status === 200 && body?.ok === true, `status ${health.status}${body?.version ? `, versão ${body.version}` : ""}`, "Confira o contêiner do robô e a rota /robo no proxy.");
    } catch {
      add("robo_no_ar", false, "sem resposta", "Confira o contêiner do robô e a rota /robo no proxy.");
    }
  }

  const projectUrl = trim(env.PROJECT_URL);
  if (projectUrl && env.SUPPORT_BOT_SECRET) {
    try {
      const url = `${projectUrl}/config?account_id=0`;
      const response = await fetchText(url, { headers: signed(env.SUPPORT_BOT_SECRET, "GET", url), fetchImpl });
      add("assinatura_robo_projeto", response.status !== 401, `status ${response.status}`, "O projeto recusou a assinatura: confira se SUPPORT_BOT_SECRET é igual nos dois lados e se a rota recebe o caminho completo pedido.");
    } catch {
      add("assinatura_robo_projeto", false, "sem resposta", "Confira PROJECT_URL e se as rotas do robô estão publicadas no projeto.");
    }
  }

  const openwa = trim(env.OPENWA_PUBLIC_URL);
  if (openwa) {
    try {
      const health = await fetchText(`${openwa}/api/health`, { fetchImpl });
      add("openwa_no_ar", health.status === 200, `status ${health.status}`, "Confira o contêiner do OpenWA e o host wa no proxy.");
      if (env.OPENWA_API_KEY) {
        const plugins = await fetchText(`${openwa}/api/plugins`, { headers: { "X-API-Key": env.OPENWA_API_KEY }, fetchImpl });
        const adapter = (jsonOf(plugins.text) ?? []).find?.((plugin) => plugin.id === "chatwoot-adapter");
        add("adaptador_openwa", Boolean(adapter?.enabled), adapter ? `versão ${adapter.version ?? "?"}, ${adapter.enabled ? "ligado" : "desligado"}` : "não instalado", "A primeira conexão não oficial instala o adaptador; ou instale pelo painel do OpenWA.");
      }
    } catch {
      add("openwa_no_ar", false, "sem resposta", "Confira o contêiner do OpenWA e o host wa no proxy.");
    }
  }

  return { ok: checks.every((check) => check.ok), checks };
}
