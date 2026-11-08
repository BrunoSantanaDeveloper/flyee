// Chamadas das telas às rotas do próprio projeto (as dos modelos em modelos/next). A sessão do projeto
// vai no cookie, como em qualquer tela dele; nenhum token do Chatwoot passa pelo navegador.
// escopo: "plataforma" (telas do superadmin) ou "cliente" (telas do administrador de cada cliente).

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
  const scoped = (path, escopo, extra = "") => `${path}?escopo=${encodeURIComponent(escopo)}${extra}`;
  return {
    /** Link de entrada no painel, de uso único e válido por 5 minutos: peça na hora de abrir. */
    enter: () => call("POST", "entrar"),
    settings: (escopo = "cliente") => call("GET", scoped("config", escopo)),
    saveSettings: (settings, escopo = "cliente") => call("PUT", scoped("config", escopo), settings),
    whatsappStatus: () => call("GET", "whatsapp"),
    connectOfficial: (values) => call("POST", "whatsapp", { route: "oficial", ...values }),
    connectUnofficial: () => call("POST", "whatsapp", { route: "nao_oficial" }),
    /** Ler o QR de novo: retoma a sessão que a caixa já tem, sem criar outra. */
    reconnect: () => call("POST", "whatsapp", { acao: "reconectar" }),
    /** Perguntas e respostas sugeridas a partir das conversas que a equipe resolveu, esperando aprovação. */
    suggestions: (escopo = "cliente") => call("GET", scoped("sugestoes", escopo)),
    decideSuggestion: (id, decisao, values = {}) => call("POST", `sugestoes/${encodeURIComponent(id)}`, { decisao, ...values }),
    /** O que o robô passou para a equipe, agrupado por assunto. */
    gaps: (escopo = "cliente", dias = 30) => call("GET", scoped("lacunas", escopo, `&dias=${Number(dias) || 30}`)),
  };
}
