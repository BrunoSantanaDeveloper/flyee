// OpenAI e qualquer serviço compatível com /chat/completions (OpenRouter, Groq, um servidor local):
// base_url troca o endereço, key_env troca o nome da variável da chave, json escolhe como pedir JSON
// ("schema" com o esquema estrito, "object" para serviços que só aceitam json_object, "none" para nenhum).

import { requestJson } from "../http.mjs";
import { AiError, providerKey } from "./errors.mjs";

export async function generate({ ai, system, messages, schema, keys, fetchImpl, timeoutMs = 60000 }) {
  if (!ai.model) throw new AiError("ai_model_missing", "falta ai.model para este provedor");
  const key = providerKey(keys, ai.key_env || "OPENAI_API_KEY");
  if (!key && !ai.base_url) throw new AiError("ai_key_missing", "falta a chave da OpenAI no ambiente do robô");
  const body = { model: ai.model, messages: [{ role: "system", content: system }, ...messages] };
  if (ai.json === "schema") body.response_format = { type: "json_schema", json_schema: { name: "acao", strict: true, schema } };
  else if (ai.json === "object") body.response_format = { type: "json_object" };
  const headers = key ? { authorization: `Bearer ${key}` } : {};
  const base = (ai.base_url || "https://api.openai.com/v1").replace(/\/+$/, "");
  const { json } = await requestJson(`${base}/chat/completions`, { method: "POST", headers, body, timeoutMs, retries: 2, fetchImpl });
  const choice = json?.choices?.[0];
  if (choice?.message?.refusal) throw new AiError("ai_refused", "o modelo recusou o pedido");
  if (choice?.finish_reason === "length") throw new AiError("ai_truncated", "a resposta passou do limite de tokens");
  if (choice?.finish_reason === "content_filter") throw new AiError("ai_refused", "o filtro do provedor bloqueou a resposta");
  const text = typeof choice?.message?.content === "string" ? choice.message.content : "";
  if (!text.trim()) throw new AiError("ai_empty", "a resposta veio sem texto");
  return { text, model: json?.model ?? ai.model };
}
