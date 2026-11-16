// The client of the Orkestree production contract, version 1: five routes, a Bearer token, JSON
// both ways, no redirect followed, and the files sent straight to the signed address each one
// gets. It calls only what the contract describes and reads unknown fields without failing.

import { readFileSync } from "node:fs";

import { AppError } from "./util.mjs";

export const CONTRACT = 1;
export const DEFAULT_URL = "https://www.orkestree.com";
/** Only a fake on this machine may replace the Orkestree address (tests), so the token never goes anywhere else. */
const LOOPBACK = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/;
const CALL_TIMEOUT_MS = 30_000;

/** The Orkestree address: the real one, or a loopback fake passed with --url. */
export function baseUrl(override) {
  if (override === undefined || override === null || override === "") return DEFAULT_URL;
  const url = String(override).trim().replace(/\/+$/, "");
  if (!LOOPBACK.test(url)) throw new AppError("usage", "--url aceita só um endereço desta máquina (127.0.0.1 ou localhost).", "Tire a opção: o app fala com o Orkestree sozinho.");
  return url;
}

/** What to do for each error code of the contract, said to the member. */
const FIX = {
  invalid_token: "O token de produção venceu ou foi encerrado no portal. Peça um novo no portal do Orkestree e guarde com a página que a sua IA abre.",
  insufficient_scope: "Esse token não pode fazer isso. No portal do Orkestree, crie um token de produção com leitura e escrita.",
  not_found: "O pedido não existe ou é de outra empresa. Confira o pedido na lista.",
  order_closed: "O pedido já foi aceito, cancelado ou venceu. Veja a lista de pedidos abertos.",
  delivery_too_large: "Um arquivo ou a entrega passam do limite do Orkestree. Diga ao integrante qual e gere uma versão menor.",
  manifest_mismatch: "Um arquivo mudou entre a montagem e o envio. Monte a entrega de novo e envie outra vez.",
  outside_order: "A entrega traz conceito, formato ou nome que o pedido não pediu. Confira a entrega contra o pedido.",
  text_limit: "Um texto passa do limite do pedido. Encurte e monte a entrega de novo.",
  personal_data: "O Orkestree achou o que parece dado pessoal na entrega. Tire e monte de novo.",
  declaration_missing: "Falta a declaração de que nenhuma peça traz pessoa, depoimento ou especialista gerado por IA.",
  invalid_request: "O Orkestree recusou um campo da chamada. Mostre a mensagem ao integrante.",
  rate_limited: "O Orkestree pediu para esperar. Tente de novo em alguns minutos.",
  unavailable: "O Orkestree não respondeu agora. Tente de novo em alguns minutos.",
};

function failure(status, body) {
  const code = typeof body?.error === "string" ? body.error : status === 401 ? "invalid_token" : status === 404 ? "not_found" : status >= 500 ? "unavailable" : "invalid_request";
  const message = typeof body?.message === "string" && body.message ? body.message : `O Orkestree respondeu ${status}.`;
  const details = {};
  if (typeof body?.action_url === "string") details.action_url = body.action_url;
  if (typeof body?.field === "string") details.field = body.field;
  if (Array.isArray(body?.files)) details.files = body.files;
  return new AppError(code, message, FIX[code] ?? "Mostre a mensagem ao integrante.", Object.keys(details).length ? details : undefined);
}

async function send(url, init, { timeoutMs = CALL_TIMEOUT_MS } = {}) {
  try {
    return await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error?.name === "TimeoutError") throw new AppError("timeout", `O Orkestree não respondeu em ${Math.round(timeoutMs / 1000)} segundos.`, "Tente de novo em alguns minutos.");
    throw new AppError("offline", "Não foi possível falar com o Orkestree.", "Confira a internet desta máquina e tente de novo.");
  }
}

/** One call to a route of the contract. Returns the parsed body; throws AppError with the contract's code. */
export async function call(base, token, method, path, body = undefined) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await send(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (response.status >= 300 && response.status < 400) throw new AppError("redirect_refused", "O Orkestree respondeu com um redirecionamento, e o app não segue redirecionamentos.", "Mostre a mensagem ao integrante; o endereço do Orkestree pode ter mudado.");
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) throw failure(response.status, parsed);
  if (parsed === null || typeof parsed !== "object") throw new AppError("unexpected", "O Orkestree respondeu algo que não é JSON.", "Tente de novo; se repetir, mostre esta mensagem ao integrante.");
  return parsed;
}

/** Sends one file to the signed address the delivery gave it: https, or http on this machine. */
export async function putFile(url, path, { contentType = "application/octet-stream", timeoutMs = 600_000 } = {}) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError("invalid_request", "O endereço de envio que o Orkestree deu não é válido.", "Monte a entrega de novo.");
  }
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["127.0.0.1", "localhost"].includes(parsed.hostname))) throw new AppError("invalid_request", "O endereço de envio não é https.", "Monte a entrega de novo; se repetir, mostre esta mensagem ao integrante.");
  const response = await send(url, { method: "PUT", headers: { "Content-Type": contentType }, body: readFileSync(path) }, { timeoutMs });
  if (!response.ok) throw new AppError("upload_failed", `O envio de um arquivo foi recusado (${response.status}).`, "O endereço vale 30 minutos: monte a entrega de novo e envie outra vez.");
}
