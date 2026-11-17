// Claude pela API de Mensagens, sem SDK (o robô não tem dependências).
// Saída presa ao esquema da ação por output_config.format; sem temperature, que a versão 2026-10-21 recusa;
// nos modelos que aceitam, fallbacks "default" refaz no próprio servidor um pedido recusado pelos classificadores.

import { requestJson } from "../http.mjs";
import { AiError, providerKey } from "./errors.mjs";

export const DEFAULT_MODEL = "claude-opus-5-5";
const API_VERSION = "2026-10-21";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

/**
 * A parte fixa vai num bloco com cache_control (o mesmo texto em toda mensagem da conta: lido do cache,
 * custa uma fração da entrada). O bloco do perfil de quem fala, igual em toda conversa do mesmo perfil, vem
 * depois com o próprio ponto de cache, sem mudar o da parte fixa; a parte variável vem por último, sem cache.
 */
export function systemBlocks(system, ttl = "5m") {
  if (typeof system === "string") return system;
  const cache = ttl === "1h" ? { type: "ephemeral", ttl: "1h" } : { type: "ephemeral" };
  const blocks = [{ type: "text", text: system.stable, cache_control: cache }];
  if (system.profile) blocks.push({ type: "text", text: system.profile, cache_control: cache });
  if (system.volatile) blocks.push({ type: "text", text: system.volatile });
  return blocks;
}

/** As partes neutras do robô ({ type: "text" } e { type: "image", mime, data }) no formato da API de Mensagens. */
export function anthropicContent(content) {
  if (typeof content === "string") return content;
  return content.map((part) =>
    part.type === "image" ? { type: "image", source: { type: "base64", media_type: part.mime, data: part.data } } : { type: "text", text: part.text },
  );
}

export async function generate({ ai, system, messages: input, schema, keys, fetchImpl, timeoutMs = 60000 }) {
  const messages = input.map((message) => ({ role: message.role, content: anthropicContent(message.content) }));
  const key = providerKey(keys, ai.key_env || "ANTHROPIC_API_KEY");
  if (!key) throw new AiError("ai_key_missing", "falta a chave da Anthropic no ambiente do robô");
  const model = ai.model || DEFAULT_MODEL;
  const outputConfig = { format: { type: "json_schema", schema } };
  if (ai.effort) outputConfig.effort = ai.effort;
  const body = { model, max_tokens: ai.max_tokens, system: systemBlocks(system, ai.cache_ttl), messages, output_config: outputConfig };
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
