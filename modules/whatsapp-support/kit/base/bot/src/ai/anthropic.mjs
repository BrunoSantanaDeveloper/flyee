// Claude pela API de Mensagens, sem SDK (o robô não tem dependências).
// Saída presa ao esquema da ação por output_config.format; sem temperature, que a versão 2026-10-21 recusa;
// nos modelos que aceitam, fallbacks "default" refaz no próprio servidor um pedido recusado pelos classificadores.

import { requestJson } from "../http.mjs";
import { AiError, providerKey } from "./errors.mjs";

export const DEFAULT_MODEL = "claude-opus-5-5";
const API_VERSION = "2026-10-21";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

export async function generate({ ai, system, messages, schema, keys, fetchImpl, timeoutMs = 60000 }) {
  const key = providerKey(keys, ai.key_env || "ANTHROPIC_API_KEY");
  if (!key) throw new AiError("ai_key_missing", "falta a chave da Anthropic no ambiente do robô");
  const model = ai.model || DEFAULT_MODEL;
  const outputConfig = { format: { type: "json_schema", schema } };
  if (ai.effort) outputConfig.effort = ai.effort;
  const body = { model, max_tokens: ai.max_tokens, system, messages, output_config: outputConfig };
  const headers = { "x-api-key": key, "anthropic-version": API_VERSION };
  if (ai.fallbacks && FALLBACK_MODELS.has(model)) {
    body.fallbacks = "default";
    headers["anthropic-beta"] = FALLBACK_BETA;
  }
  const base = (ai.base_url || "https://api.anthropic.com").replace(/\/+$/, "");
  const { json } = await requestJson(`${base}/v1/messages`, { method: "POST", headers, body, timeoutMs, retries: 2, fetchImpl });
  if (json?.stop_reason === "refusal") throw new AiError("ai_refused", "o modelo recusou o pedido");
  if (json?.stop_reason === "max_tokens") throw new AiError("ai_truncated", "a resposta passou do limite de tokens");
  const text = (json?.content ?? [])
    .filter((block) => block?.type === "text")
    .map((block) => block.text)
    .join("");
  if (!text.trim()) throw new AiError("ai_empty", "a resposta veio sem texto");
  return { text, model: json?.model ?? model };
}
