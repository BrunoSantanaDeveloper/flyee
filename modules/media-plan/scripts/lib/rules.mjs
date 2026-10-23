// The decision rules of the plan (plano.json.rules): what counts as enough data, the indicators
// of each phase, when to pause, scale and swap, the weekly and daily cadence; and the triggers
// with the plan B of each risk. The numbers are the same labelled rules of thumb the measurement
// app applies, so a plan and its read never disagree.

import { brl, round2 } from "./util.mjs";

export function buildRules(data, { refs, economics, calendar }) {
  const sample = refs.reading.sample;
  const allowable = economics?.funnel?.allowable_cpl_brl ?? economics?.economics?.allowable_cac_brl ?? null;
  const floor = economics?.learning_floor?.floor_daily_brl ?? null;
  const rules = {
    version: 1,
    checked_on: refs.reading.checked_on,
    source: refs.reading.source,
    sample: { impressions: sample.impressions, link_clicks: sample.link_clicks, results: sample.results, label: sample.label },
    allowable_cost_brl: allowable,
    learning_floor_daily_brl: floor,
    indicators_by_phase: {
      preparacao: ["rastreamento conferido (eventos, links)", "página no ar com a oferta, o prazo e as regras", "base legal da base registrada"],
      testes: ["quem passa dos 3 segundos (gancho)", "CTR do link", "custo por visita", "conversão da página"],
      escala: ["custo por resultado contra o permitido", "frequência semanal", "tamanho da lista"],
      aquecimento: ["entradas na lista", "resposta da base (repermissão e acesso antecipado)", "custo por resultado"],
      pico: ["custo por resultado contra o permitido", "ritmo de gasto contra o plano", "reprovações", "respostas do atendimento"],
      depois: ["implantação de quem entrou", "razão de reivindicação", "o que vira campanha sempre ativa"],
    },
    pause_when: [
      `zero resultados depois de ${refs.reading.cut.zero_results_spend_multiple} vezes o custo permitido gasto${allowable ? ` (${brl(round2(allowable * refs.reading.cut.zero_results_spend_multiple))})` : ""}`,
      `custo por resultado acima de ${refs.reading.cut.cost_multiple} vezes o permitido depois de ${refs.reading.cut.spend_multiple} vezes gasto, com ${refs.reading.cut.min_results} resultados ou mais`,
      "página fora do ar, oferta encerrada ainda anunciada ou anúncio reprovado",
    ],
    scale_when: [`${sample.results} resultados ou mais a custo dentro do permitido, e a planilha de origem concorda: ${refs.reading.scale.step_pct[0]} a ${refs.reading.scale.step_pct[1]}% por semana, nunca o dobro de uma vez`],
    swap_when: [`CTR caindo ${Math.round(refs.reading.fatigue.ctr_drop_fraction * 100)}% entre duas leituras com a verba parada, ou frequência semanal acima de ${refs.reading.fatigue.frequency_prospecting} em público frio`],
    one_edit_per_set_per_week: "um conjunto recebe no máximo uma mudança significativa por semana (verba, público, criativo novo); a seguinte espera a leitura",
    cadence: {
      weekly: "toda segunda: o export da Meta (e do Google, quando roda) com os 14 dias anteriores, a planilha de origem da semana, a leitura semanal e os movimentos",
      daily: "só por exceção: o pulso diário fala quando um limiar quebra (ritmo de gasto, reprovação, zero conversões, custo acima do permitido em dado maduro)",
      decision_point: calendar?.decision_point ? `${calendar.decision_point.date}: redistribuir a verba pelo que leu melhor` : null,
    },
  };
  const triggers = [
    { id: "custo", risk: "o custo por resultado passa de 2 vezes o permitido com 10 resultados ou mais", read_in: "a leitura semanal e o pulso do app de medição", plan_b: "subir o evento no funil (lead em vez de compra), trocar a peça que falha e, se seguir, baixar a verba ao piso do teste" },
    { id: "conta", risk: "a conta de anúncios é restrita ou a peça reprovada", read_in: "o pulso do dia (reprovações) e a conta", plan_b: "recorrer com a política em mãos, trocar a frase apontada e, enquanto isso, a base por e-mail e os parceiros" },
    { id: "base", risk: "a base responde mal (reclamação acima de 0,1% ou descadastro acima de 0,3% por envio) ou a entrega cai", read_in: "o relatório da ferramenta de e-mail e a conferência de entregabilidade", plan_b: "parar as promoções, mandar só para quem usou nos últimos 30 dias por duas semanas, conferir a autenticação do domínio" },
    { id: "produto", risk: "a página cai, a oferta muda ou o produto não entrega o que o anúncio promete", read_in: "a conferência da página e o atendimento", plan_b: "pausar os anúncios na hora, corrigir a página ou a oferta e voltar com a prévia conferida" },
    { id: "rastreamento", risk: "a razão de reivindicação sai de 1,0 a 1,5 ou as conversões zeram com gasto normal", read_in: "a leitura semanal (encanamento)", plan_b: "nenhuma decisão de verba pela plataforma até conferir o evento no Gerenciador de Eventos; a planilha de origem manda" },
  ];
  return { rules, triggers, say: `Dado suficiente: ${sample.impressions} impressões e ${sample.link_clicks} cliques para gancho e CTR, ${sample.results} resultados para custo. Pausa com zero resultados depois de ${refs.reading.cut.zero_results_spend_multiple} vezes o permitido; escala com ${sample.results} resultados dentro do permitido, ${refs.reading.scale.step_pct[0]} a ${refs.reading.scale.step_pct[1]}% por semana. ${triggers.length} gatilhos com plano B.` };
}
