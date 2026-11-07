// Assinaturas HMAC-SHA256 no formato do Chatwoot: "sha256=" + hex(HMAC(segredo, "<timestamp>.<corpo>")).
// O Chatwoot assina assim os avisos ao robô (lib/webhooks/trigger.rb); o robô e o projeto usam o mesmo
// formato entre si, acrescentando o método e o caminho para que uma assinatura não sirva em outra rota.

import { createHmac, timingSafeEqual } from "node:crypto";

export const TOLERANCE_SECONDS = 300;

export function hmacHex(secret, content) {
  return createHmac("sha256", secret).update(content).digest("hex");
}

function sameText(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Confere a assinatura de um aviso do Chatwoot.
 * Devolve { ok: true } ou { ok: false, code }, com code em: no_secret, no_signature, stale, bad_signature.
 */
export function verifyChatwoot({ secret, timestamp, signature, rawBody, now = Date.now() }) {
  if (!secret) return { ok: false, code: "no_secret" };
  if (!signature || !timestamp) return { ok: false, code: "no_signature" };
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > TOLERANCE_SECONDS) return { ok: false, code: "stale" };
  const expected = `sha256=${hmacHex(secret, `${timestamp}.${rawBody}`)}`;
  return sameText(expected, signature) ? { ok: true } : { ok: false, code: "bad_signature" };
}

/** Cabeçalhos de uma chamada assinada do robô para o projeto. */
export function signProjectRequest({ secret, method, pathWithQuery, body = "", now = Date.now() }) {
  const timestamp = String(Math.floor(now / 1000));
  const signature = `sha256=${hmacHex(secret, `${timestamp}.${method.toUpperCase()}.${pathWithQuery}.${body}`)}`;
  return { "X-Support-Timestamp": timestamp, "X-Support-Signature": signature };
}

/** O lado do projeto: confere uma chamada assinada do robô. Mesmos códigos de verifyChatwoot. */
export function verifyProjectRequest({ secret, method, pathWithQuery, body = "", timestamp, signature, now = Date.now() }) {
  if (!secret) return { ok: false, code: "no_secret" };
  if (!signature || !timestamp) return { ok: false, code: "no_signature" };
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > TOLERANCE_SECONDS) return { ok: false, code: "stale" };
  const expected = `sha256=${hmacHex(secret, `${timestamp}.${method.toUpperCase()}.${pathWithQuery}.${body}`)}`;
  return sameText(expected, signature) ? { ok: true } : { ok: false, code: "bad_signature" };
}
