// Regras que não precisam de IA: a configuração com os padrões, o horário de atendimento,
// as palavras que chamam a equipe e o modo do robô.

export const MODES = ["auto", "sugestao", "desligado"];

export const DEFAULT_MESSAGES = {
  handoff: "Vou chamar alguém da equipe para continuar com você por aqui.",
  handoff_fora_do_horario: "A equipe está fora do horário agora. A sua mensagem ficou registrada e alguém responde por aqui assim que voltar.",
  erro: "Tive um problema para responder agora. Vou chamar alguém da equipe para continuar com você.",
  anexo: "Recebi o seu arquivo. Vou chamar alguém da equipe para olhar.",
  desligado: "",
};

// Comparadas sem acento e sem maiúsculas, como palavra ou expressão inteira.
export const DEFAULT_KEYWORDS = ["atendente", "humano", "atendimento humano", "falar com uma pessoa", "falar com alguem", "gerente"];

const DAY_KEYS = { Sun: "dom", Mon: "seg", Tue: "ter", Wed: "qua", Thu: "qui", Fri: "sex", Sat: "sab" };

export class ConfigError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** A configuração que o projeto devolve, com os padrões preenchidos. Falta de token do robô é erro. */
export function normalizeConfig(raw) {
  if (!raw || typeof raw !== "object") throw new ConfigError("config_invalid", "a configuração não é um objeto");
  const chatwoot = raw.chatwoot ?? {};
  if (!chatwoot.bot_token || !chatwoot.bot_secret) throw new ConfigError("config_invalid", "faltam chatwoot.bot_token ou chatwoot.bot_secret");
  const mode = raw.enabled === false ? "desligado" : MODES.includes(raw.mode) ? raw.mode : "auto";
  const handoff = raw.handoff ?? {};
  const ai = raw.ai ?? {};
  return {
    mode,
    brand: String(raw.brand ?? "").trim() || "a empresa",
    chatwoot: { bot_token: String(chatwoot.bot_token), bot_secret: String(chatwoot.bot_secret) },
    ai: {
      provider: String(ai.provider ?? "anthropic"),
      model: ai.model ? String(ai.model) : null,
      effort: ai.effort === null ? null : String(ai.effort ?? "low"),
      base_url: ai.base_url ? String(ai.base_url) : null,
      key_env: ai.key_env ? String(ai.key_env) : null,
      json: ["schema", "object", "none"].includes(ai.json) ? ai.json : "schema",
      fallbacks: ai.fallbacks !== false,
      max_tokens: Number.isInteger(ai.max_tokens) && ai.max_tokens > 0 ? ai.max_tokens : 16000,
      cache_ttl: ai.cache_ttl === "1h" ? "1h" : "5m",
    },
    persona: String(raw.persona ?? "").trim(),
    platform_instructions: String(raw.platform_instructions ?? "").trim(),
    instructions: String(raw.instructions ?? "").trim(),
    platform_knowledge: raw.platform_knowledge ?? [],
    knowledge: raw.knowledge ?? [],
    learning: { enabled: raw.learning?.enabled === true },
    report: { enabled: raw.report?.enabled === true },
    hours: raw.hours ?? null,
    messages: { ...DEFAULT_MESSAGES, ...(raw.messages ?? {}) },
    handoff: {
      keywords: Array.isArray(handoff.keywords) ? handoff.keywords.map(String) : DEFAULT_KEYWORDS,
      max_bot_turns: Number.isInteger(handoff.max_bot_turns) && handoff.max_bot_turns > 0 ? handoff.max_bot_turns : 8,
      labels: Array.isArray(handoff.labels) ? handoff.labels.map(String) : ["robo-passou"],
      team_id: Number.isInteger(handoff.team_id) ? handoff.team_id : null,
    },
    tools: Array.isArray(raw.tools) ? raw.tools.filter((tool) => tool && /^[a-z0-9_]{1,64}$/.test(tool.name)) : [],
    suggest_on_open: raw.suggest_on_open !== false,
    history_from_project: raw.history_from_project !== false,
    share_contact_name: raw.privacy?.share_contact_name !== false,
  };
}

function minutes(text) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(text ?? ""));
  if (!match) return null;
  const value = Number(match[1]) * 60 + Number(match[2]);
  return value <= 24 * 60 ? value : null;
}

/** Dia, data e minuto do dia no fuso do atendimento. */
export function localParts(date, timeZone = "America/Sao_Paulo") {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return {
    day: DAY_KEYS[parts.weekday],
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
    time: `${parts.hour}:${parts.minute}`,
  };
}

/** Sem horário configurado, a equipe conta como disponível sempre. */
export function teamAvailable(hours, date = new Date()) {
  if (!hours || typeof hours !== "object" || !hours.days) return true;
  const { day, date: today, minute } = localParts(date, hours.timezone || "America/Sao_Paulo");
  if (Array.isArray(hours.holidays) && hours.holidays.includes(today)) return false;
  const ranges = hours.days[day];
  if (!Array.isArray(ranges)) return false;
  return ranges.some((range) => {
    const start = minutes(range?.[0]);
    const end = minutes(range?.[1]);
    return start !== null && end !== null && minute >= start && minute < end;
  });
}

export function normalizeText(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** A pessoa pediu a equipe com uma das palavras configuradas (palavra ou expressão inteira). */
export function asksForTeam(text, keywords) {
  const haystack = ` ${normalizeText(text)} `;
  return (keywords ?? []).some((keyword) => {
    const needle = normalizeText(keyword);
    return needle && haystack.includes(` ${needle} `);
  });
}
