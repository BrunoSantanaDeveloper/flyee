// The documents the app writes for the member: the reading of one export, the weekly read, the
// daily pulse and the tracking plan. Numbers come from the tables; the words are fixed here, so
// a reading never promises and never calls a tiny sample a result.

import { brDay, brl, pct } from "./util.mjs";
import { tableSay } from "./verdict.mjs";
import { KINDS } from "./moves.mjs";

export const IN_SHORT_MAX_WORDS = 150;
const CERTAINTY_WORD = { confirmado: "confirmado", provavel: "provável", "primeira-leitura": "primeira leitura" };
const VERDICT_WORD = { escalar: "escalar", manter: "manter", iterar: "iterar", cortar: "cortar", negativar: "negativar", dado_insuficiente: "dado insuficiente" };
const WHERE_WORD = { gancho: "gancho", miolo: "miolo", pagina: "página", anuncio: "anúncio" };

const num = (value, digits = 0) => (value === null || value === undefined ? "" : Number(value).toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits }));
const money = (value) => (value === null || value === undefined ? "" : brl(value));
const percent = (value) => (value === null || value === undefined ? "" : pct(value));
export const words = (text) => String(text ?? "").trim().split(/\s+/).filter(Boolean).length;

function periodText(period) {
  return period ? `${brDay(period.start)} a ${brDay(period.end, true)}` : "período não informado no export";
}

/** leitura.md: the judged table of one export. */
export function renderReading({ id, normalized, table, allowableSource = null, unmatched = [] }) {
  const lines = [`# Leitura ${id}`, "", `Export ${normalized.source === "meta" ? "da Meta" : "do Google Ads"}, nível ${normalized.level}, ${periodText(normalized.period)}. ${tableSay(table)}`, ""];
  lines.push(table.allowable_brl ? `Custo permitido por resultado: ${brl(table.allowable_brl)}${allowableSource ? ` (${allowableSource})` : ""}. Evento: ${String(table.event ?? "o resultado do export").replace(/.$/, "")}.` : "Sem custo permitido no contrato de medição: os vereditos de custo ficam em aberto.", "");
  lines.push("As contagens são da plataforma, que reivindica; a planilha de origem é a verdade do negócio. Abaixo da amostra mínima a leitura é indício, e a coluna de certeza diz.", "");
  lines.push("## Por peça, em ordem de gasto", "");
  if (normalized.source === "meta") {
    lines.push("| Peça | Gasto | Impressões | Passam dos 3 s | CTR do link | Visitas | Resultados | Custo por resultado | Veredito | Certeza | Onde falha |", "|---|---|---|---|---|---|---|---|---|---|---|");
    for (const row of table.rows) lines.push(`| ${row.name}${row.concept ? ` (${row.concept})` : ""} | ${money(row.metrics.spend)} | ${num(row.metrics.impressions)} | ${row.metrics.hook_rate === null ? "" : percent(row.metrics.hook_rate * 100)} | ${percent(row.metrics.link_ctr_pct)} | ${num(row.metrics.visits)} | ${num(row.metrics.results)} | ${money(row.metrics.cost_per_result_brl)} | ${VERDICT_WORD[row.verdict]} | ${CERTAINTY_WORD[row.certainty]} | ${row.where_it_fails ? WHERE_WORD[row.where_it_fails] : ""} |`);
  } else {
    lines.push("| Item | Gasto | Impressões | Cliques | CTR | CPC médio | Conversões | Custo por conversão | Veredito | Certeza |", "|---|---|---|---|---|---|---|---|---|---|");
    for (const row of table.rows) lines.push(`| ${row.name} | ${money(row.metrics.spend)} | ${num(row.metrics.impressions)} | ${num(row.metrics.clicks)} | ${percent(row.metrics.ctr_pct)} | ${money(row.metrics.avg_cpc_brl)} | ${num(row.metrics.results)} | ${money(row.metrics.cost_per_result_brl)} | ${VERDICT_WORD[row.verdict]} | ${CERTAINTY_WORD[row.certainty]} |`);
  }
  lines.push("");
  lines.push("## Por que cada veredito", "");
  for (const row of table.rows) lines.push(`- ${row.name}: ${VERDICT_WORD[row.verdict]}, ${CERTAINTY_WORD[row.certainty]}. ${row.reasons.join(" ")}${row.legible_when.length ? ` Fica legível com ${row.legible_when.join(" e ")}.` : ""}`);
  const near = table.rows.filter((row) => row.readings);
  if (near.length) {
    lines.push("", "## No limiar: as duas leituras, e a escolha é sua", "");
    for (const row of near) lines.push(`- ${row.name}. ${row.readings.change} ${row.readings.hold}`);
  }
  if (normalized.missing.length) lines.push("", "## O que o export não traz", "", `Colunas ausentes: ${normalized.missing.join(", ")}. O que depende delas ficou em branco, nunca em zero. No próximo export, inclua essas colunas.`);
  if (normalized.unknown_columns.length) lines.push("", `Colunas que o app não reconheceu e ignorou: ${normalized.unknown_columns.join(", ")}.`);
  if (unmatched.length) lines.push("", "## Não casaram com a entrega", "", `${unmatched.length} nome(s) do export não estão na lista de nomes da entrega: ${unmatched.join("; ")}. Nenhum foi adivinhado; peças antigas ou de outra campanha ficam sem conceito.`);
  lines.push("", "## Regras usadas", "", `Amostra mínima: ${table.rules_label ?? "1.000 impressões e 30 cliques para gancho e CTR; 30 resultados para o custo"} (regra de bolso, conferida em ${table.rules_checked_on}). O histórico desta conta, quando existir, substitui as regras.`);
  return `${lines.join("\n").trimEnd()}\n`;
}

/** The three findings of a week, computed from what exists, at most three sentences. */
export function weeklyFindings({ ledger, metaTable, googleTable, contract, claimRatio }) {
  const findings = [];
  const goal = contract?.goal ?? null;
  if (ledger && ledger.lines) {
    const compras = ledger.by_stage.compra;
    const leads = ledger.by_stage.lead;
    findings.push({ text: `A planilha de origem registra ${leads} lead(s) e ${compras} compra(s)${ledger.revenue_brl ? `, ${brl(ledger.revenue_brl)} de receita` : ""}${goal ? `, contra a meta "${String(goal).replace(/\.$/, "")}"` : ""}.`, certainty: "confirmado", source: "planilha de origem" });
  }
  if (claimRatio !== null && claimRatio !== undefined) {
    findings.push({ text: claimRatio > 1.5 ? `As plataformas reivindicam ${String(claimRatio).replace(".", ",")} compra(s) para cada compra real: acima do normal, alguém conta duas vezes.` : claimRatio < 1 ? `As plataformas contam ${String(claimRatio).replace(".", ",")} compra para cada compra real: abaixo de 1, o rastreamento perde conversões.` : `As plataformas reivindicam ${String(claimRatio).replace(".", ",")} compra(s) para cada compra real, dentro do normal de 1,2 a 1,4.`, certainty: "confirmado", source: "export e planilha de origem" });
  }
  for (const table of [metaTable, googleTable].filter(Boolean)) {
    const label = table.source === "meta" ? "na Meta" : "na Busca";
    if (table.counts.cortar) findings.push({ text: `${table.counts.cortar} peça(s) ${label} gastaram acima do limite sem resultado que pague: ${table.rows.filter((row) => row.verdict === "cortar").map((row) => row.name).join(", ")}.`, certainty: "provavel", source: "contagem da plataforma" });
    if (table.counts.escalar) findings.push({ text: `${table.counts.escalar} peça(s) ${label} entregam dentro do custo permitido com amostra: ${table.rows.filter((row) => row.verdict === "escalar").map((row) => row.name).join(", ")}; a planilha de origem confirma antes de subir a verba.`, certainty: "provavel", source: "contagem da plataforma" });
    if (!table.counts.cortar && !table.counts.escalar && table.counts.dado_insuficiente === table.rows.length) findings.push({ text: `Nenhuma peça ${label} chegou à amostra mínima: a semana compara gancho e CTR, não resultados.`, certainty: "confirmado", source: "contagem da plataforma" });
  }
  return findings.slice(0, 3);
}

/** semanal.md: the fixed shape of the weekly read. */
export function renderWeekly({ today, contract, plan, metaReading, googleReading, ledger, claimRatio, moveLines, proposed, openMoves, coverage, notChecked }) {
  const metaTable = metaReading?.table ?? null;
  const googleTable = googleReading?.table ?? null;
  const findings = weeklyFindings({ ledger, metaTable, googleTable, contract, claimRatio });
  const first = proposed[0] ?? null;
  const since = moveLines.filter((line) => line.verdict).slice(0, 2);

  const looked = `Olhamos ${[metaReading ? `o export da Meta (${periodText(metaReading.normalized.period)})` : null, googleReading ? `o export do Google Ads (${periodText(googleReading.normalized.period)})` : null, ledger?.lines ? `a planilha de origem (${ledger.lines} linhas)` : null].filter(Boolean).join(", ") || "nada ainda: não há export nem planilha"}. ${notChecked.length ? `Não medido: ${notChecked.map((item) => item.split(":")[0].trim()).join(", ")}.` : ""}`.trim();
  let inShort = [looked];
  if (since.length) inShort.push(`Desde a última vez: ${since.map((line) => line.text).join(" ")}`);
  inShort.push(...findings.map((finding, index) => `${index + 1}. ${finding.text} (${CERTAINTY_WORD[finding.certainty]}, ${finding.source})`));
  if (first) inShort.push(`Faça isto primeiro: ${first.texto}`);
  // The summary fits its 150 words: drop the "since" line first, then the third finding.
  while (words(inShort.join(" ")) > IN_SHORT_MAX_WORDS && inShort.length > 2) {
    const sinceIndex = inShort.findIndex((line) => line.startsWith("Desde a última vez"));
    if (sinceIndex !== -1) inShort.splice(sinceIndex, 1);
    else if (inShort.length > 3) inShort.splice(inShort.length - 2, 1);
    else break;
  }

  const lines = [`# Leitura da semana, ${brDay(today, true)}${plan ? `: plano ${plan.plan}` : ""}`, "", "## Em resumo", "", ...inShort, ""];

  lines.push("## Decisões para você", "");
  const decisions = proposed.filter((move) => move.decisao_do_integrante || move.tipo === "subir_verba");
  if (decisions.length) for (const move of decisions) lines.push(`- ${move.texto} ${move.porque} Conferir em ${brDay(move.conferir_em)}.`);
  else lines.push("- Nenhuma decisão pendente nesta semana.");
  lines.push("");

  lines.push("## A história", "", "### Desde a última vez", "");
  if (moveLines.length) for (const line of moveLines) lines.push(`- ${line.text}`);
  else lines.push("- Primeira leitura: não há movimento anterior para julgar.");
  lines.push("", "### Encanamento", "");
  if (claimRatio !== null && claimRatio !== undefined) lines.push(claimRatio >= 1 && claimRatio <= 1.5 ? `Nada quebrado à vista: as plataformas reivindicam ${String(claimRatio).replace(".", ",")} compra(s) por compra real, dentro do normal.` : `Atenção: razão de reivindicação ${String(claimRatio).replace(".", ",")}. ${claimRatio < 1 ? "O evento de compra não dispara em parte das vendas." : "Alguém conta a mesma compra duas vezes (Pixel e API de Conversões sem deduplicação, ou duas tags)."} Até conferir, o custo por resultado da plataforma não serve para decidir verba.`);
  else lines.push("Sem compras na planilha de origem ou sem compras reivindicadas, a razão de reivindicação fica em aberto. Grave as compras com a origem e a próxima leitura confere.");
  lines.push("", "### A verdade do negócio (planilha de origem)", "");
  if (ledger?.lines) {
    lines.push("| Origem | Leads | Cadastros | Ativações | Compras | Receita | Lead para compra |", "|---|---|---|---|---|---|---|");
    for (const [origin, counts] of Object.entries(ledger.by_origin)) lines.push(`| ${origin} | ${counts.lead} | ${counts.cadastro} | ${counts.ativacao} | ${counts.compra} | ${money(counts.valor_brl || null)} | ${percent(ledger.rates[origin]?.lead_to_compra_pct)} |`);
  } else lines.push("A planilha de origem está vazia: sem ela a leitura é só a reivindicação das plataformas. Grave cada lead e compra com a origem.");
  lines.push("", "### Por canal (reivindicação das plataformas)", "", "| Canal | Gasto | Resultados | Custo por resultado | Fonte |", "|---|---|---|---|---|");
  for (const reading of [metaReading, googleReading].filter(Boolean)) {
    const totals = reading.normalized.totals;
    const results = reading.table.rows.reduce((sum, row) => sum + (row.metrics.results ?? 0), 0);
    lines.push(`| ${reading.normalized.source === "meta" ? "Meta" : "Busca do Google"} | ${money(totals.spend)} | ${num(results)} | ${results ? money(totals.spend / results) : ""} | export ${reading.id}, ${periodText(reading.normalized.period)} |`);
  }
  for (const channel of coverage.filter((item) => !item.measured)) lines.push(`| ${item(channel)} | | | | usado, não medido: ${channel.send} |`);
  lines.push("");
  for (const reading of [metaReading, googleReading].filter(Boolean)) {
    lines.push(`### Por peça, ${reading.normalized.source === "meta" ? "Meta" : "Busca do Google"}`, "", `${tableSay(reading.table)} A tabela completa está na leitura ${reading.id}.`, "");
    for (const row of reading.table.rows.slice(0, 6)) lines.push(`- ${row.name}: ${money(row.metrics.spend)}, ${num(row.metrics.results)} resultado(s)${row.metrics.cost_per_result_brl ? ` a ${money(row.metrics.cost_per_result_brl)}` : ""}: ${VERDICT_WORD[row.verdict]} (${CERTAINTY_WORD[row.certainty]}).`);
    lines.push("");
  }
  lines.push("## O que fazer nesta semana", "");
  if (proposed.length) proposed.slice(0, 6).forEach((move, index) => lines.push(`${index + 1}. ${move.texto} Por quê: ${move.porque} Certeza: ${CERTAINTY_WORD[move.certeza]}. Conferir em ${brDay(move.conferir_em)}.${move.gatilho ? ` Gatilho: ${move.gatilho}` : ""}`));
  else lines.push("Nenhum movimento: ou a amostra ainda não permite, ou tudo segue dentro do permitido. Próxima decisão na leitura seguinte.");
  if (openMoves.length) lines.push("", `Movimentos em aberto de semanas anteriores: ${openMoves.map((move) => `${move.id} (${KINDS[move.tipo]}, ${move.objeto})`).join("; ")}. Quando fizer um, diga, para a leitura seguinte julgar o efeito.`);
  lines.push("", "## O que não vamos fazer", "");
  const holds = proposed.filter((move) => move.tipo === "segurar");
  lines.push(...(holds.length ? holds.map((move) => `- ${move.texto} ${move.porque}`) : ["- Mexer em verba com menos de 30 resultados por peça: o ruído decidiria no lugar do dado."]));
  lines.push("", "## O que não conseguimos conferir", "");
  lines.push(...(notChecked.length ? notChecked.map((item) => `- ${item}`) : ["- Nada ficou de fora do que o projeto tinha."]));
  lines.push("", "## Fontes", "");
  for (const reading of [metaReading, googleReading].filter(Boolean)) lines.push(`- Export ${reading.id} (${reading.normalized.source}, ${periodText(reading.normalized.period)}), contagem da plataforma.`);
  if (ledger?.lines) lines.push(`- Planilha de origem, ${ledger.lines} linhas, a verdade do negócio.`);
  if (plan) lines.push(`- Plano ${plan.plan}, versão ${plan.version}, ${plan.state}.`);
  lines.push(`- Regras de leitura do app, conferidas em ${metaReading?.table.rules_checked_on ?? googleReading?.table.rules_checked_on ?? "2026-10-23"}.`);
  return { markdown: `${lines.join("\n").trimEnd()}\n`, in_short_words: words(inShort.join(" ")), findings };
}

function item(channel) {
  return channel.label;
}

/** pulso.md: nothing unless a threshold broke. */
export function renderPulse({ today, issues, coverage }) {
  const lines = [`# Pulso de ${brDay(today, true)}`, "", coverage, ""];
  if (!issues.length) lines.push("Nada precisa de você hoje no que dá para ver.");
  else for (const issue of issues) lines.push(`- ${issue.text} Evidência: ${issue.evidence}. Proposta: ${issue.action}`);
  return `${lines.join("\n").trimEnd()}\n`;
}

/** rastreamento.md: the tracking plan rendered for this business. */
export function renderTracking({ contract, plan, utmRule }) {
  const items = contract.items;
  const value = (key, fallback) => (items[key] && items[key].status !== "desconhecido" ? items[key].value : fallback);
  const event = value("evento_otimizacao", "o evento escolhido no plano");
  const activation = value("evento_ativacao", "o primeiro resultado útil no produto");
  const type = value("tipo_negocio", null);
  const channels = Array.isArray(value("canais", null)) ? value("canais", null) : ["meta", "email"];
  const lines = [
    "# Rastreamento: o que precisa estar no lugar antes do primeiro real",
    "",
    `Preparado para ${type ? `um negócio do tipo ${type}` : "este negócio"}${plan ? `, pelo plano ${plan.plan}` : ""}. Cada item abaixo é conferido pela sua IA com você e marcado no contrato de medição como verificado, informado ou desconhecido.`,
    "",
    "## Os eventos do funil, e quem os vê",
    "",
    "| Passo | Evento padrão da Meta | Google Analytics 4 | Quem dispara |",
    "|---|---|---|---|",
    "| Visita à página | PageView | page_view | o navegador, pela tag na página |",
    "| Lead ou cadastro | Lead ou CompleteRegistration | generate_lead ou sign_up | o navegador na página de obrigado, e o servidor pela API de Conversões quando existir |",
    `| Ativação (${activation}) | um evento personalizado, sem termo clínico ou sensível no nome | um evento personalizado | o servidor, quando a pessoa faz a ação dentro do produto |`,
    "| Início de pagamento | InitiateCheckout | begin_checkout | o navegador |",
    "| Compra, com valor e moeda | Purchase, com value e currency | purchase, com value, currency e transaction_id | o servidor pela API de Conversões, e o navegador quando a página de confirmação existe |",
    "",
    `O evento de otimização é **${event}**: é o que a campanha persegue; os outros são lidos, nunca otimizados ao mesmo tempo. Com verba pequena, o evento mais cedo no funil é o que sai da fase de aprendizado.`,
    "",
    "## Deduplicação",
    "",
    "Quando o mesmo evento sai do navegador (Pixel) e do servidor (API de Conversões), os dois levam o mesmo identificador de evento (event_id), e a Meta conta uma vez. Sem isso, cada compra vira duas e o custo por resultado aparece pela metade. O Gerenciador de Eventos mostra a taxa de deduplicação por evento.",
    "",
    "## A conversão do Google Ads",
    "",
    channels.includes("google") || channels.includes("google_search")
      ? "A Busca do Google mede com a tag do Google Ads (AW-) ou importando a conversão do GA4. Uma só ação de conversão primária, a do evento de otimização; as outras entram como secundárias, para leitura. Smart Bidding aprende com cerca de 30 conversões em 30 dias, por isso a conversão primária precisa ser o evento que acontece."
      : "A Busca do Google não roda neste plano. Quando entrar, a conversão primária do Google Ads será o evento de otimização, pela tag do Google Ads ou importada do GA4.",
    "",
    "## A origem que viaja com a conta",
    "",
    `Todo link paga com a regra única do projeto: ${utmRule}. O formulário de cadastro guarda utm_source, utm_medium, utm_campaign e utm_content num campo escondido, e a pergunta "como você conheceu" entra no primeiro acesso. É isso que liga uma compra ao anúncio semanas depois, quando a plataforma já esqueceu; é a coluna de origem da planilha de origem.`,
    "",
    "## O plano de teste no Gerenciador de Eventos",
    "",
    "1. Abra a aba Testar eventos do Gerenciador de Eventos da Meta e navegue na página como um cliente: a visita aparece em segundos.",
    "2. Preencha o formulário com um e-mail de teste: o evento de lead ou cadastro aparece uma vez, não duas.",
    "3. Faça uma compra de teste (ou use o modo de teste do pagamento): a compra aparece com valor e moeda, uma vez.",
    "4. No GA4, o DebugView mostra os mesmos passos; no Google Ads, a ação de conversão muda de 'sem conversões recentes' em até 24 horas.",
    "5. Confira os links de cada anúncio com a regra única antes de subir; um link sem os cinco campos não sobe.",
    "",
    "## O que a categoria do negócio restringe",
    "",
    "Produtos de saúde, finanças e outras categorias sensíveis têm eventos de conversão restritos pela Meta: use só eventos padrão e nunca ponha um termo clínico, um diagnóstico ou um dado da pessoa em URL, nome de evento ou parâmetro. O aviso aparece no Gerenciador de Eventos ao montar a campanha; quando aparecer, otimize pelo evento mais cedo no funil que a categoria permite.",
    "",
    "## Pronto quer dizer",
    "",
    "Pixel ou GA4 na página e disparando no teste; o evento de otimização disparando uma vez por ação; a compra com valor; a deduplicação ativa quando há API de Conversões; a origem gravada no cadastro; os links com a regra única. Nada pago sobe antes disto.",
  ];
  return `${lines.join("\n").trimEnd()}\n`;
}
