// O contexto do robô em duas camadas, editadas em telas do sistema:
//   plataforma: o superadmin do sistema. Sempre existe; as regras dela valem acima das do cliente.
//   cliente: o administrador de cada cliente, só no modelo "por-cliente" e só no que a plataforma liberar.
// Modelos: "plataforma" (o sistema atende os próprios clientes, como um suporte da plataforma; só a camada
// da plataforma) e "por-cliente" (cada cliente do sistema atende os clientes dele; as duas camadas).
// Formato, padrões, validação (a mesma na tela e no servidor) e a montagem da configuração que o robô busca.
// Sem dependências: roda no navegador e no Node.

export const MODES = ["auto", "sugestao", "desligado"];
export const MODELS = ["por-cliente", "plataforma"];
export const DAYS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

/** Grupos de campos que a plataforma pode liberar para o cliente editar. */
export const PERMISSION_GROUPS = ["apresentacao", "instrucoes", "conhecimento", "horario", "mensagens", "transferencia", "consultas", "modo"];

export const LIMITS = {
  persona: 2000,
  instructions: 20000,
  knowledgeItems: 1000,
  question: 500,
  answer: 5000,
  knowledgeTotal: 150000,
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

/** A camada da plataforma: a mesma forma, mais o que o cliente pode mudar, as consultas oferecidas e o aprendizado. */
export function defaultPlatformSettings(brand = "") {
  return {
    ...defaultSettings(brand),
    client_permissions: { apresentacao: true, instrucoes: true, conhecimento: true, horario: true, mensagens: true, transferencia: true, consultas: true, modo: false },
    tools_available: null,
    learning: { enabled: true },
    report: { enabled: true },
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

/** As permissões que valem para o cliente: nenhuma no modelo plataforma. */
export function clientPermissions(model, platform) {
  if (model === "plataforma") return Object.fromEntries(PERMISSION_GROUPS.map((group) => [group, false]));
  const given = platform?.client_permissions ?? defaultPlatformSettings().client_permissions;
  return Object.fromEntries(PERMISSION_GROUPS.map((group) => [group, given[group] === true]));
}

/** Os grupos que a pessoa pode editar na tela, conforme a camada. */
export function editableGroups(scope, model, platform) {
  if (scope === "plataforma") return [...PERMISSION_GROUPS, ...(model === "por-cliente" ? ["permissoes"] : []), "aprendizado"];
  const permissions = clientPermissions(model, platform);
  return PERMISSION_GROUPS.filter((group) => permissions[group]);
}

const GROUP_FIELDS = {
  apresentacao: ["brand", "persona"],
  instrucoes: ["instructions"],
  conhecimento: ["knowledge"],
  horario: ["hours"],
  mensagens: ["messages"],
  transferencia: ["handoff", "suggest_on_open", "share_contact_name"],
  consultas: ["tools_enabled"],
  modo: ["mode"],
};

/** Grava do que o cliente mandou só os grupos liberados; o resto fica como estava. */
export function applyClientEdits(current, incoming, permissions) {
  const next = { ...defaultSettings(), ...(current ?? {}) };
  for (const [group, fields] of Object.entries(GROUP_FIELDS)) {
    if (!permissions[group]) continue;
    for (const field of fields) if (incoming && field in incoming) next[field] = incoming[field];
  }
  return next;
}

/**
 * Confere as configurações de uma camada. Devolve a lista de problemas, cada um com o campo e uma frase
 * para a tela; lista vazia quer dizer que pode salvar. declaredTools: os nomes das consultas do sistema.
 */
export function validateSettings(settings, { declaredTools = [], scope = "cliente" } = {}) {
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
  if (scope === "plataforma") {
    for (const name of settings.tools_available ?? []) {
      if (!declaredTools.includes(name)) add("tools_available", `A consulta ${name} não existe neste sistema.`);
    }
    for (const [group, value] of Object.entries(settings.client_permissions ?? {})) {
      if (!PERMISSION_GROUPS.includes(group) || typeof value !== "boolean") add("client_permissions", `Permissão inválida: ${group}.`);
    }
  }
  return problems;
}

const filled = (value) => (Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && String(value).trim() !== "");

/**
 * A configuração que a rota config devolve ao robô, juntando as camadas.
 * model: "por-cliente" ou "plataforma"; platform: a camada da plataforma; client: a do cliente (ignorada no
 * modelo plataforma); state: o que o provisionamento guardou; tools: as consultas que o sistema declara;
 * ai: o provedor padrão do sistema; tenantName: o nome do cliente, quando a camada dele não tem.
 */
export function botConfig({ model = "por-cliente", platform, client, state, tools = [], ai = {}, tenantName = "" }) {
  const base = { ...defaultPlatformSettings(), ...(platform ?? {}) };
  const permissions = clientPermissions(model, base);
  // A camada do cliente como ele salvou, sem padrões: o que ele nunca preencheu vem da plataforma.
  const layer = model === "plataforma" || !client ? null : client;
  const pick = (group, field) => (layer && permissions[group] && filled(layer[field]) ? layer[field] : base[field]);

  const available = new Set(Array.isArray(base.tools_available) ? base.tools_available : tools.map((tool) => tool.name));
  const enabledNames = permissions.consultas && layer && Array.isArray(layer.tools_enabled) ? layer.tools_enabled : base.tools_enabled ?? [];
  const enabled = new Set(enabledNames.filter((name) => available.has(name)));
  const mode = base.mode === "desligado" ? "desligado" : permissions.modo && MODES.includes(layer?.mode) ? layer.mode : base.mode;
  const handoff = (permissions.transferencia && layer?.handoff) || base.handoff || {};
  const messages = Object.fromEntries(
    Object.entries({ ...(base.messages ?? {}), ...(permissions.mensagens && layer ? layer.messages ?? {} : {}) }).filter(([, value]) => String(value ?? "").trim()),
  );

  return {
    enabled: mode !== "desligado",
    mode,
    brand: (model === "plataforma" ? base.brand : pick("apresentacao", "brand")) || tenantName || base.brand,
    chatwoot: { bot_token: state?.bot_token ?? null, bot_secret: state?.bot_secret ?? null },
    ai: { ...ai, ...(base.ai ?? {}) },
    persona: pick("apresentacao", "persona"),
    platform_instructions: model === "plataforma" ? "" : base.instructions,
    instructions: model === "plataforma" ? base.instructions : permissions.instrucoes && layer ? layer.instructions ?? "" : "",
    platform_knowledge: model === "plataforma" ? [] : base.knowledge ?? [],
    knowledge: model === "plataforma" ? base.knowledge ?? [] : permissions.conhecimento && layer ? layer.knowledge ?? [] : [],
    hours: pick("horario", "hours"),
    messages,
    handoff: {
      ...(handoff.keywords ? { keywords: handoff.keywords } : {}),
      max_bot_turns: handoff.max_bot_turns ?? 8,
      team_id: handoff.team_id ?? null,
      labels: ["robo-passou"],
    },
    tools: tools.filter((tool) => enabled.has(tool.name)).map(({ name, description, input_schema }) => ({ name, description, input_schema })),
    suggest_on_open: (permissions.transferencia && layer ? layer.suggest_on_open : base.suggest_on_open) !== false,
    history_from_project: true,
    privacy: { share_contact_name: (permissions.transferencia && layer ? layer.share_contact_name : base.share_contact_name) !== false },
    learning: { enabled: base.learning?.enabled !== false },
    report: { enabled: base.report?.enabled !== false },
  };
}

/** Quem revisa as sugestões de conhecimento de uma conta: a camada que guarda o conhecimento dela. */
export function knowledgeOwner(model, platform) {
  return model === "por-cliente" && clientPermissions(model, platform).conhecimento ? "cliente" : "plataforma";
}

/**
 * Quem entra no painel de atendimento. No modelo plataforma: a equipe de suporte do sistema e o superadmin.
 * No por-cliente: quem o cliente marcou como equipe de atendimento e quem administra o cliente; o
 * superadmin da plataforma não entra no painel dos clientes. Quem não passa aqui também deve sair da
 * equipe no Chatwoot (removeStaffUser e syncStaff em base/server/provision.mjs).
 */
export function canEnterPanel(model, person) {
  if (!person) return false;
  if (model === "plataforma") return person.isSupportStaff === true || person.isSuperadmin === true;
  return person.isSupportStaff === true || person.canConfigure === true;
}
