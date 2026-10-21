// The Apify key and the Apify client: one actor run with a hard item limit and a hard charge
// ceiling, waited for, its dataset read. Dependency-free (global fetch, Node 20+).

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { AppError, progress } from "./util.mjs";

export const KEY_NAME = "APIFY_TOKEN";
export const KEY_URL = "https://console.apify.com/settings/integrations";
export const DEFAULT_API = "https://api.apify.com/v2";
/** Only a fake on this machine may replace the Apify address (tests), so the key never goes anywhere else. */
const LOOPBACK = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/;

/** The Apify API address: the real one, or a loopback fake passed with --apify-url. */
export function apifyApi(override) {
  if (override === undefined || override === null || override === "") return DEFAULT_API;
  const url = String(override).trim().replace(/\/+$/, "");
  if (!LOOPBACK.test(url)) throw new AppError("usage", "--apify-url aceita só um endereço desta máquina (127.0.0.1 ou localhost).", "Tire a opção: o app fala com o Apify sozinho.");
  return url;
}

/** Where `npx --yes flyee@latest key set` saves the member's keys: one file per machine, outside every project. */
export function keyStorePath(home = homedir()) {
  return join(home, ".flyee", "keys.json");
}

/** A key saved with `key set` ({ "version": 1, "keys": { "NAME": "value" } }), or null. */
export function readSavedKey(name, path = keyStorePath()) {
  try {
    const value = JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""))?.keys?.[name];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

/**
 * The Apify key by the flyee rule for app keys: the environment variable first (one that exists
 * but is empty means "no key" and stops the search), then the key saved with `key set`. Read on
 * every run, so a key saved after the AI was opened works at once. Never printed or written.
 */
export function apifyKey(env = process.env, path = keyStorePath()) {
  const fromEnvironment = env[KEY_NAME];
  if (fromEnvironment !== undefined) return fromEnvironment.trim() ? { key: fromEnvironment.trim(), from: "environment" } : { key: null, from: null };
  const saved = readSavedKey(KEY_NAME, path);
  return saved ? { key: saved, from: "flyee" } : { key: null, from: null };
}

/** How the key gets saved: the member's AI runs one command and the member pastes the key in the page it opens. */
export function keySetup() {
  return {
    command: `npx --yes flyee@latest key set ${KEY_NAME} --browser --json`,
    key_url: KEY_URL,
    how: "Rode você mesmo: o comando abre uma página no navegador do integrante, onde ele cola a chave do Apify. Ela não passa pela conversa nem pelo terminal.",
    after: "Quando ele disser que salvou, rode check --json de novo: o app enxerga a chave na hora.",
  };
}

const TERMINAL = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]);
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

/** An HTTP answer of the Apify API as a stable error. */
export function classifyApifyError(status, body = "") {
  const text = typeof body === "string" ? body : JSON.stringify(body ?? "");
  if (status === 401) {
    return new AppError("apify_unauthorized", "O Apify recusou a chave.", `A chave pode ter sido trocada ou apagada. Gere outra em ${KEY_URL} e salve com npx --yes flyee@latest key set ${KEY_NAME} --browser --json.`);
  }
  if (status === 402 || /not[- ]enough|insufficient|usage limit|monthly usage|exceeded/i.test(text)) {
    return new AppError("apify_no_credit", "O crédito do Apify deste mês acabou.", "O integrante pode esperar o crédito renovar ou trocar de plano no Apify. Enquanto isso, a pesquisa segue pelo modo manual (import).");
  }
  if (status === 403) {
    return new AppError("apify_unauthorized", "A chave do Apify não tem permissão para rodar este coletor.", `Confira a chave em ${KEY_URL}.`);
  }
  if (status === 404) {
    return new AppError("apify_actor_missing", "O coletor do Apify que este app usa não foi encontrado.", "O coletor pode ter mudado de nome. Siga pelo modo manual (import); uma versão nova do app traz o nome atual.");
  }
  if (status === 429) return new AppError("rate_limited", "O Apify pediu para esperar um pouco.", "Tente de novo em alguns minutos.");
  return new AppError("apify_unavailable", `O Apify respondeu com erro ${status}.`, "Tente de novo em alguns minutos; se repetir, siga pelo modo manual (import).");
}

async function call(fetchImpl, url, { token, method = "GET", body = null, timeoutMs = 60000 } = {}) {
  let response;
  try {
    response = await fetchImpl(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error?.name === "TimeoutError") throw new AppError("apify_timeout", "O Apify demorou demais para responder.", "Tente de novo em alguns minutos.");
    throw new AppError("offline", "Não consegui falar com o Apify.", "Confira a conexão com a internet e tente de novo.");
  }
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) throw classifyApifyError(response.status, data);
  return data;
}

/**
 * Runs one actor and returns its dataset. `maxItems` and `maxChargeUsd` go to Apify as hard
 * limits on the run: an actor never collects past them, whatever its own input says.
 */
export async function runActor({ actor, input, token, maxItems, maxChargeUsd, api = DEFAULT_API, fetchImpl = fetch, pollMs = 3000, timeoutMs = 8 * 60 * 1000, label = "coleta" }) {
  const id = actor.replace("/", "~");
  const query = `maxItems=${Math.max(1, Math.round(maxItems))}&maxTotalChargeUsd=${Number(maxChargeUsd).toFixed(2)}`;
  const started = Date.now();
  const run = (await call(fetchImpl, `${api}/acts/${id}/runs?${query}`, { token, method: "POST", body: input }))?.data;
  if (!run?.id) throw new AppError("apify_unavailable", "O Apify não devolveu a execução.", "Tente de novo em alguns minutos.");
  progress(`Apify: ${label} iniciada.`);
  let state = run;
  while (!TERMINAL.has(state.status)) {
    if (Date.now() - started > timeoutMs) {
      await call(fetchImpl, `${api}/actor-runs/${run.id}/abort`, { token, method: "POST" }).catch(() => {});
      throw new AppError("apify_timeout", "A coleta no Apify passou do tempo e foi interrompida.", "Tente de novo com menos posts ou menos perfis.");
    }
    await sleep(pollMs);
    state = (await call(fetchImpl, `${api}/actor-runs/${run.id}`, { token }))?.data ?? state;
    progress(`Apify: ${label} em andamento (${Math.round((Date.now() - started) / 1000)} s).`);
  }
  if (state.status !== "SUCCEEDED") {
    throw new AppError("apify_actor_failed", `A coleta no Apify terminou como ${state.status}.`, "Tente de novo em alguns minutos; se repetir, siga pelo modo manual (import).");
  }
  const items = state.defaultDatasetId ? await call(fetchImpl, `${api}/datasets/${state.defaultDatasetId}/items?clean=true&format=json`, { token }) : [];
  // Apify books the charges some seconds after the run ends: read the run again, a few times, for the real cost.
  let final = state;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const fresh = (await call(fetchImpl, `${api}/actor-runs/${run.id}`, { token }).catch(() => null))?.data;
    if (!fresh) break;
    final = fresh;
    if (!Array.isArray(items) || !items.length || chargedUsd(fresh) > 0) break;
    await sleep(Math.min(pollMs, 2000));
  }
  return {
    items: Array.isArray(items) ? items : [],
    run: {
      id: run.id,
      actor,
      status: state.status,
      seconds: Math.round((Date.now() - started) / 1000),
      usage_usd: chargedUsd(final),
    },
  };
}

/** What a run cost: the larger of Apify's total and the charged events times their prices; null when neither is known. */
export function chargedUsd(run) {
  const prices = run?.pricingInfo?.pricingPerEvent?.actorChargeEvents ?? {};
  const counts = run?.chargedEventCounts ?? {};
  const events = Object.entries(counts).reduce((sum, [event, count]) => sum + (Number(count) || 0) * (prices[event]?.eventPriceUsd ?? 0), 0);
  const total = typeof run?.usageTotalUsd === "number" ? run.usageTotalUsd : null;
  if (total === null && !Object.keys(counts).length) return null;
  return Math.round(Math.max(total ?? 0, events) * 10000) / 10000;
}

/** The upper estimate of a collection, from the prices in references/fontes.json. */
export function estimateUsd(source, items) {
  return Math.round(((source.usd_per_item ?? 0) * items + (source.usd_per_run ?? 0)) * 10000) / 10000;
}

/** The ceiling sent with the run: room above the estimate, never unbounded. */
export function chargeCeiling(estimate) {
  return Math.max(0.05, Math.round(estimate * 1.5 * 100) / 100);
}
