// O relatório das lacunas: as passagens para a equipe que o robô registrou (rota events), agrupadas
// por assunto, com quantas vezes e exemplos curtos, sem dado pessoal (o robô já manda o trecho limpo).

export const GAP_CATEGORIES = {
  nao_sei: "o robô não sabia responder",
  pedido_da_pessoa: "a pessoa pediu a equipe",
  decisao_humana: "pedia decisão de alguém da equipe",
  reclamacao: "reclamação",
  risco: "risco ou urgência",
  limite: "o robô chegou ao limite de respostas",
  anexo: "a pessoa mandou um arquivo",
  falha: "o robô falhou",
  outro: "outro motivo",
};

export function topicKey(topic) {
  const text = String(topic ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return text || "sem assunto";
}

/**
 * events: [{ kind: "handoff", category, topic, reason, excerpt, at }].
 * Devolve os assuntos dos últimos `days` dias, do mais frequente ao menos, com as categorias e até
 * `maxExamples` trechos. onlyUnknown deixa só o que o robô não sabia (o que vira conhecimento).
 */
export function summarizeGaps(events, { days = 30, now = Date.now(), onlyUnknown = false, maxExamples = 3 } = {}) {
  const since = now - days * 24 * 60 * 60 * 1000;
  const groups = new Map();
  for (const event of events ?? []) {
    if (event?.kind !== "handoff") continue;
    const at = Date.parse(event.at ?? "");
    if (!Number.isFinite(at) || at < since) continue;
    const category = GAP_CATEGORIES[event.category] ? event.category : "outro";
    if (onlyUnknown && category !== "nao_sei") continue;
    const key = topicKey(event.topic);
    const group = groups.get(key) ?? { topic: String(event.topic ?? "").trim() || "sem assunto", count: 0, categories: {}, examples: [], last_at: null };
    group.count += 1;
    group.categories[category] = (group.categories[category] ?? 0) + 1;
    const excerpt = String(event.excerpt ?? "").trim();
    if (excerpt && group.examples.length < maxExamples && !group.examples.includes(excerpt)) group.examples.push(excerpt);
    if (!group.last_at || at > Date.parse(group.last_at)) group.last_at = new Date(at).toISOString();
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || String(b.last_at).localeCompare(String(a.last_at)));
}
