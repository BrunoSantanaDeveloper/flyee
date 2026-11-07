// Chamada HTTP com JSON, prazo e novas tentativas só para o que pode passar sozinho:
// 408, 429, 500, 502, 503, 504 e 529 (sobrecarga), além de falha de rede. O cabeçalho retry-after manda na espera.

export class HttpError extends Error {
  constructor(code, message, { status = null, body = null } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.body = body;
  }
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504, 529]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function waitFor(attempt, retryAfter) {
  if (retryAfter !== null && retryAfter !== undefined && String(retryAfter).trim() !== "") {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10000);
  }
  return Math.min(500 * 2 ** attempt, 8000);
}

export async function requestJson(url, { method = "GET", headers = {}, body, timeoutMs = 15000, retries = 0, fetchImpl = fetch, rawBody } = {}) {
  const payload = rawBody ?? (body === undefined ? undefined : JSON.stringify(body));
  let attempt = 0;
  for (;;) {
    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: payload === undefined ? headers : { "content-type": "application/json", ...headers },
        body: payload,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
      if (attempt < retries) {
        await sleep(waitFor(attempt, null));
        attempt += 1;
        continue;
      }
      throw new HttpError(timedOut ? "timeout" : "network", timedOut ? `sem resposta em ${timeoutMs} ms` : "falha de rede");
    }
    const text = await response.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    if (response.ok) return { status: response.status, json, headers: response.headers };
    if (RETRYABLE.has(response.status) && attempt < retries) {
      await sleep(waitFor(attempt, response.headers.get("retry-after")));
      attempt += 1;
      continue;
    }
    throw new HttpError(`http_${response.status}`, `resposta ${response.status}`, { status: response.status, body: json });
  }
}
