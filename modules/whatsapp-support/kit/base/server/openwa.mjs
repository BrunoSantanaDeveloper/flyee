// Cliente do OpenWA (rota não oficial), com a chave de administrador no cabeçalho X-API-Key.
// Rotas conferidas na especificação da versão 0.29.1 (docs/06-api-specification.md do OpenWA).

import { requestJson } from "./request.mjs";

export const ADAPTER_ID = "chatwoot-adapter";

export function openwaClient({ url, apiKey, fetchImpl = fetch }) {
  const root = `${String(url ?? "").replace(/\/+$/, "")}/api`;
  const call = (method, path, body, timeoutMs) =>
    requestJson(`${root}/${path}`, { method, headers: { "X-API-Key": apiKey }, body, fetchImpl, service: "openwa", timeoutMs });
  return {
    health: () => call("GET", "health"),
    sessions: async () => (await call("GET", "sessions")) ?? [],
    createSession: (name) => call("POST", "sessions", { name }),
    session: (id) => call("GET", `sessions/${encodeURIComponent(id)}`),
    startSession: (id) => call("POST", `sessions/${encodeURIComponent(id)}/start`),
    /** { qrCode: "data:image/png;base64,...", status }; 400 enquanto o QR não está pronto ou depois de conectado. */
    qr: (id) => call("GET", `sessions/${encodeURIComponent(id)}/qr`),
    plugins: async () => (await call("GET", "plugins")) ?? [],
    catalog: async () => (await call("GET", "plugins/catalog")) ?? [],
    /** O endereço do catálogo traz o hash (#sha256=...), que o OpenWA exige em produção. */
    installFromUrl: (download) => call("POST", "plugins/install-url", { url: download }, 60000),
    enablePlugin: (id) => call("POST", `plugins/${encodeURIComponent(id)}/enable`),
    instances: async (pluginId) => (await call("GET", `integration/plugins/${encodeURIComponent(pluginId)}/instances`)) ?? [],
    /** O segredo e o verifyToken só aparecem nesta resposta. */
    createInstance: (pluginId, body) => call("POST", `integration/plugins/${encodeURIComponent(pluginId)}/instances`, body),
  };
}

/** O endereço que o OpenWA dá à instância do adaptador: {BASE_URL}/api/ingress/chatwoot-adapter/{instanceId}/chatwoot. */
export function adapterIngressUrl(openwaPublicUrl, instanceId) {
  return `${String(openwaPublicUrl ?? "").replace(/\/+$/, "")}/api/ingress/${ADAPTER_ID}/${encodeURIComponent(instanceId)}/chatwoot`;
}
