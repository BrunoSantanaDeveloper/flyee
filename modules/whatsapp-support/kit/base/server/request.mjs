// Chamada JSON do servidor do projeto para o Chatwoot e o OpenWA, com prazo e erro com código estável.

export class ServiceError extends Error {
  /** code: timeout, network, http_<status>; service: chatwoot ou openwa. */
  constructor(code, message, { status = null, service = null, body = null } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.service = service;
    this.body = body;
  }
}

export async function requestJson(url, { method = "GET", headers = {}, body, timeoutMs = 20000, fetchImpl = fetch, service = null } = {}) {
  let response;
  try {
    response = await fetchImpl(url, {
      method,
      headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    throw new ServiceError(timedOut ? "timeout" : "network", `${service ?? "serviço"}: ${timedOut ? "sem resposta" : "falha de rede"} em ${method} ${new URL(url).pathname}`, { service });
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
  if (!response.ok) {
    throw new ServiceError(`http_${response.status}`, `${service ?? "serviço"}: resposta ${response.status} em ${method} ${new URL(url).pathname}`, {
      status: response.status,
      service,
      body: json,
    });
  }
  return json;
}

/** Cabeçalhos de um token do Chatwoot: os dois, porque proxies como o Nginx descartam nomes com sublinhado. */
export function chatwootAuth(token) {
  return { authorization: `Bearer ${token}`, api_access_token: token };
}
