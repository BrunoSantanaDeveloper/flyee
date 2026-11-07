// Gemini pela API generateContent. O responseSchema do Gemini é um subconjunto do OpenAPI e não
// aceita additionalProperties, então o esquema vai sem esse campo.

import { requestJson } from "../http.mjs";
import { systemText } from "../prompt.mjs";
import { AiError, providerKey } from "./errors.mjs";

export function geminiSchema(schema) {
  if (Array.isArray(schema)) return schema.map(geminiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const copy = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "additionalProperties") continue;
    copy[key] = geminiSchema(value);
  }
  return copy;
}

export async function generate({ ai, system, messages, schema, keys, fetchImpl, timeoutMs = 60000 }) {
  if (!ai.model) throw new AiError("ai_model_missing", "falta ai.model para o Gemini");
  const key = providerKey(keys, ai.key_env || "GEMINI_API_KEY");
  if (!key) throw new AiError("ai_key_missing", "falta a chave do Gemini no ambiente do robô");
  const body = {
    systemInstruction: { parts: [{ text: systemText(system) }] },
    contents: messages.map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })),
    generationConfig: { responseMimeType: "application/json", responseSchema: geminiSchema(schema) },
  };
  const base = (ai.base_url || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
  const url = `${base}/models/${encodeURIComponent(ai.model)}:generateContent`;
  const { json } = await requestJson(url, { method: "POST", headers: { "x-goog-api-key": key }, body, timeoutMs, retries: 2, fetchImpl });
  if (json?.promptFeedback?.blockReason) throw new AiError("ai_refused", "o provedor bloqueou o pedido");
  const candidate = json?.candidates?.[0];
  if (candidate?.finishReason === "SAFETY") throw new AiError("ai_refused", "o provedor bloqueou a resposta");
  if (candidate?.finishReason === "MAX_TOKENS") throw new AiError("ai_truncated", "a resposta passou do limite de tokens");
  const text = (candidate?.content?.parts ?? []).map((part) => part?.text ?? "").join("");
  if (!text.trim()) throw new AiError("ai_empty", "a resposta veio sem texto");
  return { text, model: ai.model };
}
