export class AiError extends Error {
  /**
   * code: ai_key_missing, ai_model_missing, ai_provider_unknown, ai_refused, ai_truncated, ai_empty,
   * ou o código da chamada HTTP (timeout, network, http_401, http_429...).
   */
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Lê a chave do provedor no ambiente do robô. Só aceita nomes terminados em _API_KEY. */
export function providerKey(keys, name) {
  if (!/^[A-Z][A-Z0-9_]*_API_KEY$/.test(String(name ?? ""))) return null;
  const value = keys?.[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
