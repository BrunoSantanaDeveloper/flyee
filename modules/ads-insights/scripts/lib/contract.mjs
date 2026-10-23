// The measurement contract (medicao.json): the definitions agreed once, each one marked as
// verified, informed or unknown, so no report argues about what a customer or a week is.

import { randomBytes } from "node:crypto";
import { AppError, round2 } from "./util.mjs";

export const STATUS = ["verificado", "informado", "desconhecido"];
export const BUSINESS_TYPES = ["saas", "servico", "loja", "app", "local", "infoproduto"];

/** The referee by business type: the number the platforms are judged against. */
export const REFEREE = {
  saas: { arbitro: "contas pagas novas e cadastros ativados, por origem", ranking: "custo por cadastro ativado e por conta paga; o custo por cadastro é só sinal antecipado" },
  servico: { arbitro: "leads qualificados, reuniões e contratos fechados, por origem", ranking: "custo por lead qualificado; o custo por lead sozinho não decide" },
  loja: { arbitro: "receita líquida e pedidos de cliente novo, pela loja", ranking: "custo por compra, confirmado pela loja" },
  app: { arbitro: "instalações por origem, ativações e quem continua em 7 dias", ranking: "custo por usuário ativado; o custo por instalação nunca vence sozinho" },
  local: { arbitro: "agendamentos, ligações e visitas", ranking: "custo por agendamento" },
  infoproduto: { arbitro: "vendas e inscrições pagas, pela plataforma de pagamento", ranking: "custo por venda, confirmado pelo pagamento" },
};

export const ITEMS = [
  { key: "tipo_negocio", label: "Tipo de negócio", ask: "Que tipo de negócio é: software por assinatura, serviço, loja, app, negócio local ou infoproduto?", required: true },
  { key: "arbitro", label: "O árbitro (a verdade do negócio)", ask: "Qual número do negócio julga os anúncios: contas pagas, contratos, pedidos, agendamentos?", required: true },
  { key: "meta", label: "A meta que o marketing deve", ask: "Qual é a meta e até quando?", required: true },
  { key: "semana", label: "Semana de reporte", ask: null, required: false },
  { key: "fuso", label: "Fuso horário", ask: null, required: false },
  { key: "receita_liquida", label: "Receita líquida", ask: "A receita conta reembolsos, descontos e impostos como?", required: false },
  { key: "cliente_novo", label: "Cliente novo", ask: "O que é um cliente novo: o primeiro pagamento, pelo e-mail?", required: false },
  { key: "campo_origem", label: "O campo de origem que viaja com a conta", ask: "Onde a origem fica gravada quando alguém se cadastra ou compra: um campo no formulário, no CRM, na cobrança?", required: true },
  { key: "evento_otimizacao", label: "Evento de otimização", ask: "Por qual evento a campanha otimiza: lead, cadastro, compra?", required: true },
  { key: "evento_ativacao", label: "Evento de ativação", ask: "O que é a ativação, o primeiro resultado útil que a pessoa tem no produto?", required: false },
  { key: "custo_permitido_brl", label: "Custo permitido por resultado", ask: "Quanto um resultado do evento de otimização pode custar?", required: true },
  { key: "margem_pct", label: "Margem de contribuição", ask: "Qual é a margem antes dos anúncios, em porcentagem?", required: false },
  { key: "mer_equilibrio", label: "MER de equilíbrio (receita por real gasto que empata)", ask: null, required: false },
  { key: "atribuicao", label: "Atribuição das plataformas", ask: null, required: false },
  { key: "canais", label: "Os canais que rodam", ask: "Quais canais rodam: Meta, Busca do Google, e-mail, WhatsApp, parceiros?", required: false },
  { key: "historia", label: "A história pela qual o negócio decide", ask: null, required: false },
  { key: "exports_semanais", label: "Os exports de cada semana e quem manda", ask: null, required: false },
  { key: "sal", label: "O sal dos pseudônimos", ask: null, required: false, hidden: true },
];

const item = (value, status, note = undefined) => ({ value, status, ...(note ? { note } : {}) });

/** The template, filled from the approved plan when there is one. */
export function contractTemplate({ plan = null, planData = null, today }) {
  const allowable = planData?.funnel?.allowable_cpl_brl ?? planData?.economics?.allowable_cac_brl ?? null;
  const margin = planData?.economics?.margin_pct ?? null;
  const event = planData?.premises?.evento?.value ?? null;
  const goal = planData?.premises?.meta_data?.value ?? null;
  const fromPlan = (value) => item(value, value === null || value === undefined ? "desconhecido" : "informado", value === null || value === undefined ? undefined : `do plano ${plan}`);
  return {
    version: 1,
    generated_at: today,
    plan,
    agreed_on: null,
    amended: [],
    items: {
      tipo_negocio: item(null, "desconhecido"),
      arbitro: item(null, "desconhecido"),
      meta: fromPlan(goal),
      semana: item("segunda a domingo", "informado", "padrão do app"),
      fuso: item("America/Sao_Paulo", "informado", "padrão do app"),
      receita_liquida: item("o preço pago menos reembolsos e descontos, sem impostos; renovações não contam como receita nova", "informado", "padrão do app"),
      cliente_novo: item("o primeiro pagamento de uma pessoa, identificada pelo e-mail", "informado", "padrão do app"),
      campo_origem: item(null, "desconhecido"),
      evento_otimizacao: fromPlan(event),
      evento_ativacao: item(null, "desconhecido"),
      custo_permitido_brl: fromPlan(allowable),
      margem_pct: fromPlan(margin),
      mer_equilibrio: item(margin ? round2(100 / margin) : null, margin ? "informado" : "desconhecido", margin ? "1 dividido pela margem" : undefined),
      atribuicao: item("o padrão da Meta (7 dias após o clique, 1 dia após a visualização) e o do Google Ads; as duas contagens são reivindicação, nunca verdade", "informado", "padrão do app"),
      canais: fromPlan(planData?.channels ? Object.entries(planData.channels).filter(([, on]) => on).map(([channel]) => channel) : null),
      historia: item("a planilha de origem (o que o negócio registrou) manda; a plataforma explica o que acontece dentro dela", "informado", "padrão do app"),
      exports_semanais: item("toda segunda: o export da Meta no nível de anúncio com os 14 dias anteriores; o do Google Ads por campanha e por termo de pesquisa quando a Busca roda; a lista de leads e compras da semana com a origem", "informado", "padrão do app"),
      sal: item(randomBytes(16).toString("hex"), "verificado", "gerado pelo app; nunca sai do projeto"),
    },
  };
}

/** Checks the shape and the statuses; returns the unknown items and the questions, at most four. */
export function validateContract(data) {
  if (!data || typeof data !== "object" || data.version !== 1 || !data.items || typeof data.items !== "object") throw new AppError("contract_invalid", "medicao.json não tem a forma esperada (version 1 e items).", "Rode contract de novo para criar o arquivo, ou corrija o que foi editado.");
  const known = new Set(ITEMS.map((entry) => entry.key));
  for (const key of Object.keys(data.items)) if (!known.has(key)) throw new AppError("contract_invalid", `medicao.json, items.${key}: item desconhecido.`, "Apague o item ou use um dos itens do contrato.", { path: `items.${key}` });
  const unknown = [];
  const settled = [];
  for (const entry of ITEMS) {
    const value = data.items[entry.key];
    if (!value || typeof value !== "object") throw new AppError("contract_invalid", `medicao.json, items.${entry.key}: falta o item.`, "Cada item é { value, status }.", { path: `items.${entry.key}` });
    if (!STATUS.includes(value.status)) throw new AppError("contract_invalid", `medicao.json, items.${entry.key}.status: aceita ${STATUS.join(", ")}.`, "Marque o item como verificado, informado ou desconhecido.", { path: `items.${entry.key}.status` });
    if (value.status !== "desconhecido" && (value.value === null || value.value === undefined || value.value === "")) throw new AppError("contract_invalid", `medicao.json, items.${entry.key}: está ${value.status} mas sem valor.`, "Preencha o valor ou marque como desconhecido.", { path: `items.${entry.key}.value` });
    if (entry.key === "custo_permitido_brl" && value.status !== "desconhecido" && typeof value.value !== "number") throw new AppError("contract_invalid", "medicao.json, items.custo_permitido_brl.value: precisa ser um número em reais.", "Um número, como 40 ou 214.56.", { path: "items.custo_permitido_brl.value" });
    if (entry.key === "tipo_negocio" && value.status !== "desconhecido" && !BUSINESS_TYPES.includes(value.value)) throw new AppError("contract_invalid", `medicao.json, items.tipo_negocio.value: aceita ${BUSINESS_TYPES.join(", ")}.`, "Escolha o tipo mais próximo.", { path: "items.tipo_negocio.value" });
    (value.status === "desconhecido" ? unknown : settled).push(entry.key);
  }
  const requiredUnknown = ITEMS.filter((entry) => entry.required && unknown.includes(entry.key)).map((entry) => entry.key);
  const questions = ITEMS.filter((entry) => unknown.includes(entry.key) && entry.ask)
    .sort((a, b) => Number(b.required) - Number(a.required))
    .slice(0, 4)
    .map((entry) => ({ key: entry.key, label: entry.label, question: entry.ask, required: entry.required, suggestion: suggestionFor(entry.key, data) }));
  return { settled, unknown, required_unknown: requiredUnknown, questions, ready: requiredUnknown.length === 0 };
}

function suggestionFor(key, data) {
  const type = data.items.tipo_negocio?.value;
  if (key === "arbitro" && type && REFEREE[type]) return REFEREE[type].arbitro;
  if (key === "campo_origem") return "gravar utm_source, utm_medium, utm_campaign e utm_content no cadastro, num campo escondido do formulário, e perguntar 'como você conheceu' no primeiro acesso";
  if (key === "evento_ativacao" && type === "saas") return "o primeiro uso real do produto (o primeiro registro criado, a primeira agenda preenchida)";
  if (key === "custo_permitido_brl") return "o custo permitido do plano, quando existir; senão a margem de 12 meses de um cliente dividida pela conversão de lead em cliente";
  return null;
}

/** The allowable cost and the event, as the other commands read them. */
export function contractValues(data) {
  const items = data?.items ?? {};
  const value = (key) => (items[key] && items[key].status !== "desconhecido" ? items[key].value : null);
  return { allowable: typeof value("custo_permitido_brl") === "number" ? value("custo_permitido_brl") : null, event: value("evento_otimizacao"), type: value("tipo_negocio"), salt: items.sal?.value ?? null, margin: value("margem_pct"), channels: value("canais"), referee: value("arbitro"), goal: value("meta") };
}
