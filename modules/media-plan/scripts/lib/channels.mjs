// The channel decision: Run, Test, Later or No for each channel, by the six lenses, each verdict
// naming its binding lens, the premise it rests on, its confidence (evidence or judgment), the
// minimum to learn (a labelled rule of thumb) and the condition that would flip it.

import { brl, round2 } from "./util.mjs";
import { field, rate } from "./premises.mjs";

const HOURS_DEFAULT = 6;

/**
 * Decides the channels. `economics` is computeEconomics' result; `calendar` the plan's calendar;
 * `evidence` what the project has ({ instagram_research, campaigns, inventory }).
 */
export function decideChannels(data, { refs, economics, calendar, evidence = {}, hoursPerWeek = null }) {
  const table = refs.channels;
  const daily = economics?.budget?.daily_brl ?? null;
  const total = economics?.budget?.total_brl ?? null;
  const days = calendar ? Math.max(1, calendar.total_days ?? 30) : 30;
  const floor = economics?.learning_floor?.floor_daily_brl ?? null;
  const allowable = economics?.funnel?.allowable_cpl_brl ?? economics?.economics?.allowable_cac_brl ?? null;
  const contacts = field(data, "base", "contacts") ?? field(data, "publico", "reach") ?? 0;
  const wants = data.channels ?? {};
  const audience = String(field(data, "publico", "value") ?? data.premises?.publico?.value ?? "");
  const b2b = /\b(empresa|empresas|b2b|gestor|gerente|diretor|rh|compras|ti\b|clínica|clinica|escritório|escritorio|contador|advogad)/i.test(audience);
  const consumer = /(?<!\p{L})(consumidor(?:es)?|pessoa f[ií]sica|pessoas f[ií]sicas|m[ãa]es?|pais|jovens?|alunos?|pacientes?|cliente final)(?!\p{L})/iu.test(audience);
  const hours = hoursPerWeek ?? field(data, "capacidade", "hours_per_week") ?? HOURS_DEFAULT;
  const rows = [];
  const row = (id, verdict, lens, reason, { evidenceText = null, confidence = "julgamento", flip = null, hours: h = null, minimum = null, supporting = false } = {}) => {
    const channel = table[id];
    rows.push({ channel: id, label: channel.label, kind: channel.kind, verdict, lens, reason, evidence: evidenceText, confidence, flip, hours_per_week: verdict === "run" || verdict === "test" ? (h ?? channel.hours_per_week) : 0, minimum_to_learn: minimum ?? channel.min_to_learn, supporting, creative: channel.creative });
  };

  // Meta
  if (!daily) row("meta", "later", "economia", "sem verba definida não há como saber se um conjunto sai da fase de aprendizado.", { flip: "quando a verba diária estiver na premissa." });
  else if (wants.meta === false) row("meta", "no", "publico_intencao", "o integrante tirou a Meta do plano.", { confidence: "evidencia", evidenceText: "premissa channels.meta" });
  else if (!floor) row("meta", "test", "economia", `sem o custo por evento na premissa, o piso de aprendizado não se calcula: a Meta entra como teste de ${brl(daily)} por dia e a semana 1 compara criativos pelo gancho e pelo CTR.`, { flip: "vira Run quando o custo por evento estiver na premissa e a verba diária cobrir o piso (50 eventos em 7 dias)." });
  else if (daily >= floor) row("meta", "run", "economia", `a verba de ${brl(daily)} por dia cobre o piso de aprendizado de ${brl(floor)} para o evento escolhido.`, { confidence: evidence.campaigns ? "evidencia" : "julgamento", evidenceText: evidence.campaigns ? `${evidence.campaigns} campanha(s) em anuncios/` : null, flip: "se o custo por evento medido passar do permitido por duas semanas, o evento sobe no funil ou a verba desce para o teste." });
  else row("meta", "test", "economia", `a verba de ${brl(daily)} por dia fica abaixo do piso de aprendizado de ${brl(floor)}: a semana 1 compara criativos pelo gancho e pelo CTR, não por resultado.`, { flip: `vira Run com ${brl(floor)} por dia num conjunto só, ou com um evento mais cedo no funil.` });

  // Google Search
  const searchMin = table.google_search.min_to_learn.daily_brl;
  if (wants.google_search === false) row("google_search", "no", "publico_intencao", "o integrante tirou a Busca do plano.", { confidence: "evidencia", evidenceText: "premissa channels.google_search" });
  else if (!daily || daily < searchMin) row("google_search", "later", "economia", `a Busca precisa de ao menos ${brl(searchMin)} por dia para 10 cliques por dia nas palavras principais; a verba inteira é ${daily ? brl(daily) : "indefinida"}.`, { flip: `com ${brl(searchMin)} por dia a mais, ou quando a Meta sair do teste.` });
  else row("google_search", "test", "publico_intencao", `quem procura a categoria ou o problema está em modo de compra; sem histórico, entra como teste de ${brl(Math.min(searchMin, Math.round(daily * 0.3)))} a ${brl(Math.round(daily * 0.3))} por dia na campanha de não marca, e a de marca na semana do pico.`, { confidence: "julgamento", flip: `vira Run com ${table.google_search.min_to_learn.conversions_per_month} conversões em 30 dias; vira Later se 10 cliques por dia não aparecerem em duas semanas.`, minimum: table.google_search.min_to_learn });

  // Owned: e-mail and WhatsApp
  if (contacts > 0) {
    row("email", "run", "economia", `${contacts} contatos conhecem a marca: o público mais barato do plano, pela régua do app de base.`, { confidence: "evidencia", evidenceText: evidence.inventory ? "contatos/inventario.json" : "premissa base", supporting: true, flip: "se a repermissão devolver menos de 10% de sim, a base vira só remarketing." });
    row("whatsapp", wants.whatsapp === false ? "no" : "test", "prontidao", wants.whatsapp === false ? "o integrante tirou o WhatsApp do plano." : "só pela API oficial com modelos aprovados, ou um a um para quem já respondeu por mensagem; sem isso, fica no e-mail.", { confidence: wants.whatsapp === false ? "evidencia" : "julgamento", flip: "vira Run quando a conta da API oficial estiver aprovada com os modelos.", supporting: true });
  } else {
    row("email", "later", "prontidao", "não há lista: o trabalho desta fase é formar uma (a lista de espera da oferta).", { flip: "assim que a lista passar de 100 pessoas." });
    row("whatsapp", "later", "prontidao", "sem lista e sem API oficial, não há a quem escrever.", { flip: "com a lista formada e a conta da API aprovada." });
  }

  // Partners
  if (wants.partners === true) row("parceiros", "test", "evidencia", "o integrante nomeou parceiros: dois ou três com link rastreado dizem se a indicação traz quem compra.", { confidence: "julgamento", flip: "vira Run quando um parceiro trouxer leads a um custo abaixo do permitido por duas semanas." });
  else row("parceiros", "later", "evidencia", "nenhum parceiro nomeado ainda; indicação sem link rastreado não se mede.", { flip: "quando dois parceiros aceitarem um link rastreado." });

  // TikTok
  const tiktokMin = table.tiktok.min_to_learn.daily_brl;
  if (b2b && !consumer) row("tiktok", "no", "publico_intencao", "o público é profissional ou de empresa, e o TikTok fala com consumidor em modo de rolagem.", { confidence: "julgamento" });
  else if (!daily || daily < tiktokMin * 2) row("tiktok", "later", "economia", `o TikTok pede cerca de ${brl(tiktokMin)} por dia e vídeo nativo novo toda semana; com ${daily ? brl(daily) : "verba indefinida"} no total, nenhum canal novo cabe sem tirar da Meta.`, { flip: `com ${brl(tiktokMin * 2)} por dia no total e 3 vídeos nativos por semana.` });
  else row("tiktok", "test", "prontidao", "cabe um teste se houver vídeo nativo novo toda semana; sem isso, o criativo cansa em 7 a 14 dias.", { flip: "vira Run com 50 eventos por semana no grupo." });

  // LinkedIn
  const linkedinMin = table.linkedin.min_to_learn.monthly_brl;
  const monthly = total ? round2((total / days) * 30) : null;
  if (!b2b) row("linkedin", "no", "publico_intencao", "o público não compra por cargo e empresa; o LinkedIn vende por cargo.", { confidence: "julgamento" });
  else if (!monthly || monthly < linkedinMin) row("linkedin", "later", "economia", `o LinkedIn cobra CPM de R$ 150 a R$ 400; abaixo de ${brl(linkedinMin)} por mês pouco se aprende, e o plano tem ${monthly ? brl(monthly) : "verba indefinida"} por mês.`, { flip: `acima de ${brl(linkedinMin)} por mês, com um ticket que pague R$ 400 ou mais por lead.` });
  else row("linkedin", "test", "economia", "o ticket e a verba cabem num teste por cargo e porte.", { flip: "vira Run com custo por lead qualificado abaixo do permitido em 4 semanas." });

  // YouTube
  row("youtube", "later", "tempo_ate_sinal", "o YouTube lê por busca da marca e fase do funil, não por compra direta, e pede um vídeo de 15 a 30 segundos; até a data alvo não há sinal legível.", { flip: "depois do pico, com um vídeo que segure os 5 primeiros segundos e a Meta já lida." });

  // Hours: when the running legs ask more than the team has, the plan says which leg to cut.
  const used = rows.reduce((sum, item) => sum + item.hours_per_week, 0);
  const warnings = [];
  if (used > hours) {
    const cut = rows.filter((item) => item.verdict === "test" && !item.supporting).sort((a, b) => b.hours_per_week - a.hours_per_week)[0];
    warnings.push({ code: "hours", text: `Os canais que rodam pedem ${used} horas por semana e há ${hours}: ${cut ? `o teste de ${cut.label} é o primeiro a sair, ou vira Later` : "corte um canal"}.` });
  }
  const running = rows.filter((item) => item.verdict === "run").map((item) => item.label);
  const testing = rows.filter((item) => item.verdict === "test").map((item) => item.label);
  return {
    version: 1,
    rows,
    hours: { available: hours, asked: used },
    rules: refs.rules,
    warnings,
    say: `Rodam: ${running.join(", ") || "nenhum"}. Testam: ${testing.join(", ") || "nenhum"}. Ficam para depois: ${rows.filter((item) => item.verdict === "later").map((item) => item.label).join(", ") || "nenhum"}.${rows.some((item) => item.verdict === "no") ? ` Fora: ${rows.filter((item) => item.verdict === "no").map((item) => item.label).join(", ")}.` : ""}`,
  };
}
