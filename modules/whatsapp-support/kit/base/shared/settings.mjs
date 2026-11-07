// As configurações do robô que cada cliente do projeto edita na tela "Robô de atendimento":
// formato, padrões, validação (a mesma na tela e no servidor) e a montagem da configuração
// que o robô busca na rota config. Sem dependências: roda no navegador e no Node.

export const MODES = ["auto", "sugestao", "desligado"];
export const DAYS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
export const LIMITS = {
  persona: 2000,
  instructions: 8000,
  knowledgeItems: 200,
  question: 500,
  answer: 3000,
  knowledgeTotal: 20000,
  message: 500,
  keywords: 30,
  maxBotTurns: 50,
};

export function defaultSettings(brand = "") {
  return {
    mode: "auto",
    brand,
    persona: "",
    instructions: "",
    knowledge: [],
    hours: {
      timezone: "America/Sao_Paulo",
      days: { seg: [["08:00", "18:00"]], ter: [["08:00", "18:00"]], qua: [["08:00", "18:00"]], qui: [["08:00", "18:00"]], sex: [["08:00", "18:00"]], sab: [], dom: [] },
      holidays: [],
    },
    messages: { handoff: "", handoff_fora_do_horario: "", erro: "", anexo: "" },
    handoff: { keywords: null, max_bot_turns: 8, team_id: null },
    tools_enabled: [],
    suggest_on_open: true,
    share_contact_name: true,
  };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validTimeZone(zone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Confere as configurações. Devolve a lista de problemas, cada um com o campo e uma frase para a tela;
 * lista vazia quer dizer que pode salvar. declaredTools: os nomes das consultas que o projeto oferece.
 */
export function validateSettings(settings, { declaredTools = [] } = {}) {
  const problems = [];
  const add = (field, message) => problems.push({ field, message });
  if (!settings || typeof settings !== "object") return [{ field: "", message: "As configurações vieram vazias." }];
  if (!MODES.includes(settings.mode)) add("mode", "Escolha como o robô trabalha: responder, sugerir ou desligado.");
  if (String(settings.persona ?? "").length > LIMITS.persona) add("persona", `A apresentação do robô passa de ${LIMITS.persona} caracteres.`);
  if (String(settings.instructions ?? "").length > LIMITS.instructions) add("instructions", `As instruções passam de ${LIMITS.instructions} caracteres.`);

  const knowledge = Array.isArray(settings.knowledge) ? settings.knowledge : [];
  if (!Array.isArray(settings.knowledge)) add("knowledge", "O conhecimento precisa ser uma lista de perguntas e respostas.");
  if (knowledge.length > LIMITS.knowledgeItems) add("knowledge", `São no máximo ${LIMITS.knowledgeItems} perguntas e respostas.`);
  let total = 0;
  knowledge.forEach((item, index) => {
    const q = String(item?.q ?? "");
    const a = String(item?.a ?? "");
    total += q.length + a.length;
    if (!q.trim() || !a.trim()) add(`knowledge.${index}`, `A pergunta ${index + 1} precisa de pergunta e resposta.`);
    if (q.length > LIMITS.question) add(`knowledge.${index}.q`, `A pergunta ${index + 1} passa de ${LIMITS.question} caracteres.`);
    if (a.length > LIMITS.answer) add(`knowledge.${index}.a`, `A resposta ${index + 1} passa de ${LIMITS.answer} caracteres.`);
  });
  if (total > LIMITS.knowledgeTotal) add("knowledge", `O conhecimento passa de ${LIMITS.knowledgeTotal} caracteres somados; resuma ou tire o que se repete.`);

  const hours = settings.hours;
  if (hours) {
    if (!validTimeZone(hours.timezone)) add("hours.timezone", "O fuso horário não existe.");
    for (const day of DAYS) {
      const ranges = hours.days?.[day] ?? [];
      if (!Array.isArray(ranges)) {
        add(`hours.days.${day}`, "Os horários do dia precisam ser uma lista de faixas.");
        continue;
      }
      ranges.forEach((range, index) => {
        const [start, end] = Array.isArray(range) ? range : [];
        if (!TIME.test(String(start)) || !TIME.test(String(end))) add(`hours.days.${day}.${index}`, "Use horas no formato 08:00.");
        else if (start >= end) add(`hours.days.${day}.${index}`, "A faixa termina antes de começar.");
      });
    }
    for (const holiday of hours.holidays ?? []) {
      if (!DATE.test(String(holiday))) add("hours.holidays", `Data de feriado inválida: ${holiday}. Use AAAA-MM-DD.`);
    }
  }

  for (const [name, value] of Object.entries(settings.messages ?? {})) {
    if (String(value ?? "").length > LIMITS.message) add(`messages.${name}`, `A mensagem passa de ${LIMITS.message} caracteres.`);
  }
  const handoff = settings.handoff ?? {};
  if (handoff.keywords !== null && handoff.keywords !== undefined) {
    if (!Array.isArray(handoff.keywords) || handoff.keywords.length > LIMITS.keywords) add("handoff.keywords", `São no máximo ${LIMITS.keywords} palavras que chamam a equipe.`);
  }
  const turns = handoff.max_bot_turns;
  if (!Number.isInteger(turns) || turns < 1 || turns > LIMITS.maxBotTurns) add("handoff.max_bot_turns", `O limite de respostas do robô vai de 1 a ${LIMITS.maxBotTurns}.`);

  for (const name of settings.tools_enabled ?? []) {
    if (!declaredTools.includes(name)) add("tools_enabled", `A consulta ${name} não existe neste sistema.`);
  }
  return problems;
}

/**
 * A configuração que a rota config devolve ao robô.
 * settings: o que o cliente salvou; state: o que o provisionamento guardou (tokens do robô da conta);
 * tools: as consultas que o projeto declara; ai: o provedor padrão do projeto.
 */
export function botConfig({ settings, state, tools = [], ai = {} }) {
  const merged = { ...defaultSettings(), ...(settings ?? {}) };
  const enabled = new Set(merged.tools_enabled ?? []);
  const messages = Object.fromEntries(Object.entries(merged.messages ?? {}).filter(([, value]) => String(value ?? "").trim()));
  return {
    enabled: merged.mode !== "desligado",
    mode: merged.mode,
    brand: merged.brand,
    chatwoot: { bot_token: state?.bot_token ?? null, bot_secret: state?.bot_secret ?? null },
    ai: { ...ai, ...(merged.ai ?? {}) },
    persona: merged.persona,
    instructions: merged.instructions,
    knowledge: merged.knowledge,
    hours: merged.hours,
    messages,
    handoff: {
      ...(merged.handoff?.keywords ? { keywords: merged.handoff.keywords } : {}),
      max_bot_turns: merged.handoff?.max_bot_turns ?? 8,
      team_id: merged.handoff?.team_id ?? null,
      labels: ["robo-passou"],
    },
    tools: tools.filter((tool) => enabled.has(tool.name)).map(({ name, description, input_schema }) => ({ name, description, input_schema })),
    suggest_on_open: merged.suggest_on_open !== false,
    history_from_project: true,
    privacy: { share_contact_name: merged.share_contact_name !== false },
  };
}
