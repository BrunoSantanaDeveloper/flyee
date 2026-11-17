// O que vale numa conversa (perfil por conversa, D30 do plano): o perfil de quem escreve, que o projeto diz
// pela rota contact, os dados da pessoa (facts), a configuração da conta com o bloco do perfil por cima, as
// regras que passam para a equipe sem IA e o resumo que fica para a equipe em toda passagem. Sem perfil
// (rota ausente, 404, profile null), a conversa usa a configuração da conta como sempre.

import { PROFILE_KEY, asksForTeam, teamAvailable } from "./policy.mjs";

export const CONTACT_LIMITS = { label: 80, facts: 30, factKey: 60, factValue: 500, factItems: 20, factsTotal: 4000, summaryField: 300 };

export const NOT_INFORMED = "não informado";

/** A conversa sem perfil: tudo como antes. */
export const NO_PROFILE = Object.freeze({ key: null, label: null, facts: Object.freeze({}) });

/** Uma linha só, sem aspas triplas (que fecham o bloco de dados no prompt). */
function oneLine(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/"{3,}/g, '"')
    .trim();
}

function cleanFacts(raw) {
  const facts = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return facts;
  let total = 0;
  for (const [rawKey, value] of Object.entries(raw)) {
    if (Object.keys(facts).length >= CONTACT_LIMITS.facts) break;
    const key = oneLine(rawKey).slice(0, CONTACT_LIMITS.factKey);
    if (!key) continue;
    let clean;
    if (value === null) clean = null;
    else if (typeof value === "string") clean = oneLine(value).slice(0, CONTACT_LIMITS.factValue);
    else if (typeof value === "number" && Number.isFinite(value)) clean = value;
    else if (typeof value === "boolean") clean = value;
    else if (Array.isArray(value)) {
      clean = value
        .filter((item) => typeof item === "string")
        .slice(0, CONTACT_LIMITS.factItems)
        .map((item) => oneLine(item).slice(0, CONTACT_LIMITS.factValue));
    } else continue;
    total += key.length + JSON.stringify(clean).length;
    if (total > CONTACT_LIMITS.factsTotal) break;
    facts[key] = clean;
  }
  return facts;
}

/**
 * A resposta da rota contact: { profile, label?, facts? }. Uma chave fora do formato, null ou ausente vale
 * como sem perfil, e então os facts também ficam de fora.
 */
export function contactProfile(raw) {
  const key = typeof raw?.profile === "string" ? raw.profile.trim() : "";
  if (!PROFILE_KEY.test(key)) return NO_PROFILE;
  const label = oneLine(raw.label).slice(0, CONTACT_LIMITS.label);
  return { key, label: label || null, facts: cleanFacts(raw.facts) };
}

/**
 * A configuração da conta com o bloco do perfil por cima: o modo, o limite de respostas e o time da
 * passagem do perfil substituem os da conta. O modo desligado da conta vale para todos os perfis: é o que
 * desliga o robô. Em config.profile ficam o perfil e os facts, que o prompt e o resumo usam.
 */
export function conversationConfig(config, profile = NO_PROFILE) {
  const key = profile?.key ?? null;
  const block = key ? config.profiles?.[key] ?? null : null;
  return {
    ...config,
    mode: config.mode === "desligado" ? "desligado" : block?.mode ?? config.mode,
    handoff: {
      ...config.handoff,
      max_bot_turns: block?.max_bot_turns ?? config.handoff.max_bot_turns,
      team_id: block?.team_id ?? config.handoff.team_id,
    },
    profile: {
      key,
      label: key ? block?.label || profile.label || key : null,
      facts: key ? profile.facts ?? {} : {},
      platform_instructions: block?.platform_instructions ?? "",
      instructions: block?.instructions ?? "",
      off: Boolean(key && block?.mode === "desligado" && config.mode !== "desligado"),
    },
  };
}

/**
 * As passagens para a equipe que não precisam de IA, na ordem do robô: o modo desligado, a pessoa que pede
 * a equipe por uma das palavras e o limite de respostas. Devolve null quando o robô segue.
 */
export function ruleHandoff(config, { text = "", turns = 0 } = {}) {
  if (config.mode === "desligado") {
    return {
      code: "mode_off",
      category: "desligado",
      reason: "o robô está desligado",
      done: config.profile?.off ? "O robô está desligado para o perfil desta pessoa e não respondeu." : "O robô está desligado neste atendimento e não respondeu.",
    };
  }
  if (asksForTeam(text, config.handoff.keywords)) {
    return { code: "asked_for_team", category: "pedido_da_pessoa", reason: "a pessoa pediu a equipe", done: "A pessoa pediu para falar com a equipe, e o robô não respondeu." };
  }
  if (turns >= config.handoff.max_bot_turns) {
    return { code: "max_turns", category: "limite", reason: "o robô chegou ao limite de respostas", done: `O robô já respondeu ${turns} vezes, o limite desta conversa.` };
  }
  return null;
}

/** O que a pessoa recebe na passagem: nada no modo sugestão; no desligado, a mensagem dele; senão a da IA ou a do horário. */
export function handoffMessage(config, { text = "", code = "", now = new Date() } = {}) {
  if (config.mode === "sugestao") return "";
  if (code === "mode_off") return config.messages.desligado || "";
  return text || (teamAvailable(config.hours, now) ? config.messages.handoff : config.messages.handoff_fora_do_horario);
}

function factText(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "sim" : "não";
  return String(value);
}

function field(value) {
  const text = oneLine(value);
  if (!text) return NOT_INFORMED;
  return text.length > CONTACT_LIMITS.summaryField ? `${text.slice(0, CONTACT_LIMITS.summaryField)}...` : text;
}

/**
 * A nota interna de toda passagem para a equipe. O perfil, a empresa e a etapa e a origem vêm do sistema
 * (facts empresa, etapa e origem) e, sem eles, do que a IA escreveu; o que a pessoa precisa, o que foi
 * feito e o próximo passo vêm da IA e, numa passagem por regra, do último trecho do cliente e da regra.
 * ai: o summary da ação ({ profile, company, need, done, next_step, origin }).
 */
export function handoffSummary(config, { ai = {}, need = "", done = "", next = "" } = {}) {
  const profile = config.profile ?? {};
  const facts = profile.facts ?? {};
  const company = [factText(facts.empresa), factText(facts.etapa)].map(oneLine).filter(Boolean).join(", ");
  const lines = [
    ["Perfil", profile.label || profile.key || ai.profile],
    ["Empresa e etapa", company || ai.company],
    ["O que a pessoa precisa", ai.need || need],
    ["O que já foi feito ou tentado", ai.done || done],
    ["Próximo passo sugerido", ai.next_step || next],
    ["Origem do contato", factText(facts.origem) || ai.origin],
  ];
  return lines.map(([label, value]) => `${label}: ${field(value)}`).join("\n");
}

/** Os facts no prompt: uma linha por dado, entre aspas triplas, como dado da pessoa. */
export function factsText(facts) {
  return Object.entries(facts ?? {})
    .map(([key, value]) => `${key}: ${value === null ? NOT_INFORMED : factText(value) || NOT_INFORMED}`)
    .join("\n");
}
