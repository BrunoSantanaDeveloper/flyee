// Regras que não precisam de IA: a configuração com os padrões, o horário de atendimento,
// as palavras que chamam a equipe e o modo do robô.

export const MODES = ["auto", "sugestao", "desligado"];
export const GROUP_MODES = ["fora", "equipe", "chamado"];

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
/** O dia da semana por extenso, para a linha de data do prompt. */
export const WEEKDAY_NAMES = { dom: "domingo", seg: "segunda-feira", ter: "terça-feira", qua: "quarta-feira", qui: "quinta-feira", sex: "sexta-feira", sab: "sábado" };

/** A chave de um perfil (rota contact e camada da plataforma): letras minúsculas sem acento, números, _ e -. */
export const PROFILE_KEY = /^[a-z0-9][a-z0-9_-]{0,63}$/;

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
    chatwoot: {
      bot_token: String(chatwoot.bot_token),
      bot_secret: String(chatwoot.bot_secret),
      // A pessoa que o adaptador do OpenWA usa para pôr no painel o que foi escrito no celular do número.
      relay_user_id: Number.isInteger(chatwoot.relay_user_id) && chatwoot.relay_user_id > 0 ? chatwoot.relay_user_id : null,
    },
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
      // "project": o projeto transcreve áudio pela rota transcribe; sem isso, as chaves do contêiner do robô.
      transcription: ai.transcription === "project" ? "project" : null,
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
    groups: normalizeGroups(raw.groups),
    // O bloco de cada perfil de quem escreve (D30); o perfil da conversa vem da rota contact (conversation.mjs).
    profiles: normalizeProfiles(raw.profiles),
    // Imagem, áudio, vídeo (D28) e arquivos (D29): ligados quando a configuração não diz o contrário.
    media: {
      images: raw.media?.images !== false,
      audio: raw.media?.audio !== false,
      video: raw.media?.video !== false,
      documents: raw.media?.documents !== false,
      transcription_note: raw.media?.transcription_note !== false,
    },
    tools: Array.isArray(raw.tools) ? raw.tools.filter((tool) => tool && /^[a-z0-9_]{1,64}$/.test(tool.name)) : [],
    suggest_on_open: raw.suggest_on_open !== false,
    history_from_project: raw.history_from_project !== false,
    share_contact_name: raw.privacy?.share_contact_name !== false,
  };
}

function normalizeGroups(raw) {
  const words = Array.isArray(raw?.call_words) ? raw.call_words.map((word) => String(word).trim()).filter(Boolean) : [];
  const mode = GROUP_MODES.includes(raw?.mode) ? raw.mode : "fora";
  return {
    mode: mode === "chamado" && !words.length ? "equipe" : mode,
    call_words: words,
    team_id: Number.isInteger(raw?.team_id) && raw.team_id > 0 ? raw.team_id : null,
  };
}

/**
 * O bloco de cada perfil, como botConfig manda: label, platform_instructions (só no modelo por-cliente),
 * instructions, max_bot_turns, team_id e mode. Campo ausente ou inválido fica null e vale o global.
 */
export function normalizeProfiles(raw) {
  const profiles = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return profiles;
  for (const [key, block] of Object.entries(raw)) {
    if (!PROFILE_KEY.test(key) || !block || typeof block !== "object" || Array.isArray(block)) continue;
    const label = String(block.label ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    profiles[key] = {
      label: label || null,
      platform_instructions: String(block.platform_instructions ?? "").trim(),
      instructions: String(block.instructions ?? "").trim(),
      max_bot_turns: Number.isInteger(block.max_bot_turns) && block.max_bot_turns > 0 ? block.max_bot_turns : null,
      team_id: Number.isInteger(block.team_id) && block.team_id > 0 ? block.team_id : null,
      mode: MODES.includes(block.mode) ? block.mode : null,
    };
  }
  return profiles;
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

/** O contato que o adaptador do OpenWA cria para um grupo leva o identificador do grupo, terminado em @g.us. */
export function isGroupContact(contact) {
  return /@g\.us$/i.test(String(contact?.identifier ?? "").trim());
}

/** Num grupo, a mensagem chega como "*Nome:* texto"; tira o nome de quem escreveu. */
export function withoutSender(text) {
  return String(text ?? "").replace(/^\*[^*\n]{1,120}:\*\s*/, "");
}

/** A mensagem do grupo chama o robô por uma das palavras configuradas; o nome de quem escreveu não conta. */
export function callsBot(text, words) {
  return asksForTeam(withoutSender(text), words);
}

/** A pessoa pediu a equipe com uma das palavras configuradas (palavra ou expressão inteira). */
export function asksForTeam(text, keywords) {
  const haystack = ` ${normalizeText(text)} `;
  return (keywords ?? []).some((keyword) => {
    const needle = normalizeText(keyword);
    return needle && haystack.includes(` ${needle} `);
  });
}
