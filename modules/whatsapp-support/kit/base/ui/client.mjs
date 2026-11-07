// Chamadas das telas às rotas do próprio projeto (as dos modelos em modelos/next). A sessão do projeto
// vai no cookie, como em qualquer tela dele; nenhum token do Chatwoot passa pelo navegador.

export class SupportApiError extends Error {
  constructor(code, message, problems = null) {
    super(message);
    this.code = code;
    this.problems = problems;
  }
}

export function supportApi({ base = "/api/atendimento", fetchImpl = (...args) => fetch(...args) } = {}) {
  const call = async (method, path, body) => {
    const response = await fetchImpl(`${base}/${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) throw new SupportApiError(json?.code ?? `http_${response.status}`, json?.message ?? "Não deu certo. Tente de novo em instantes.", json?.problems ?? null);
    return json;
  };
  return {
    /** Link de entrada no painel, de uso único e válido por 5 minutos: peça na hora de abrir. */
    enter: () => call("POST", "entrar"),
    settings: () => call("GET", "config"),
    saveSettings: (settings) => call("PUT", "config", settings),
    whatsappStatus: () => call("GET", "whatsapp"),
    connectOfficial: (values) => call("POST", "whatsapp", { route: "oficial", ...values }),
    connectUnofficial: () => call("POST", "whatsapp", { route: "nao_oficial" }),
  };
}
