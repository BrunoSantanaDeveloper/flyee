// The files the member reads: evidencias.md, conceitos.md (the cards), entrega/textos.md and
// lancamento.md. Every number in them comes from the evidence, the briefing or the script.

import { brl, LEARNING } from "./budget.mjs";
import { CONFIDENCE_LABELS, PLACEMENTS } from "./concepts.mjs";
import { FAMILY_LABELS, SOURCE_FAMILY } from "./evidence.mjs";

const SOURCE_LABELS = { apify: "coleta automática", link: "link do anúncio", screenshot: "captura de tela", export: "exportação", declared: "dito pelo integrante" };
const number = (value) => (typeof value === "number" ? String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".").replace(/\.(\d{1,2})$/, ",$1") : "");
const decimal = (value) => (typeof value === "number" ? String(Math.round(value * 100) / 100).replace(".", ",") : "");
const quote = (text) => (text ? `"${String(text).replace(/\s+/g, " ").trim()}"` : "");
const day = (iso) => String(iso ?? "").slice(0, 10);

function labelOf(labels, dimension, value) {
  const spec = labels?.dimensions?.[dimension];
  if (!spec || spec.free) return value;
  return String(value).replace(/-/g, " ");
}

/** One line about one item of evidence: who, the number, the origin and the date. */
export function describeItem(item) {
  const origin = `${SOURCE_LABELS[item.source?.type] ?? item.source?.type ?? "origem desconhecida"}, ${day(item.source?.collected_at)}`;
  const data = item.data ?? {};
  switch (item.kind) {
    case "competitor_ad": {
      const time = typeof data.days_active === "number" ? `no ar há ${data.days_active} dias` : "sem data de início";
      const versions = data.variations > 1 ? `, ${data.variations} versões` : "";
      const state = data.active === false ? ", encerrado" : "";
      return `${item.who}, ${time}${versions}${state}${data.text ? `: ${quote(shorten(data.text, 110))}` : ""} (${origin})`;
    }
    case "organic_post": {
      const plays = typeof data.plays === "number" ? `${number(data.plays)} plays` : "";
      const times = typeof data.multiplier === "number" ? `, ${decimal(data.multiplier)} vezes o normal do perfil${typeof data.baseline === "number" ? ` (${number(data.baseline)})` : ""}` : "";
      const caution = data.small_sample ? ", indício: o normal do perfil saiu de poucos posts" : typeof data.baseline === "number" && data.baseline < 200 ? ", indício: perfil com normal baixo" : "";
      return `${item.who}: ${plays}${times}${caution}${data.text ? `, ${quote(shorten(data.text, 90))}` : ""} (${origin})`;
    }
    case "organic_pattern":
      return `${item.who}: ${shorten(data.text, 140)}${data.n ? ` (${data.n} posts)` : ""} (${origin})`;
    case "audience_comment":
      return `${item.who}: ${quote(shorten(data.text, 140))}${data.where ? `, em ${data.where}` : ""} (${origin})`;
    case "own_result":
      return `${shorten(data.text, 140)}${(data.metrics ?? []).length ? `: ${data.metrics.map((metric) => `${metric.name} ${metric.value_text}`).join(", ")}` : ""} (${origin})`;
    default:
      return `${item.id} (${origin})`;
  }
}

export function shorten(text, max) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

// ---------------------------------------------------------------- evidencias.md

export function evidenceMarkdown(summary, { campaign, labels, updatedAt }) {
  const lines = [`# Evidência: ${campaign}`, ""];
  lines.push(`Atualizada em ${day(updatedAt)}. ${summary.counts.used} item(ns) na análise${summary.counts.excluded ? `, ${summary.counts.excluded} fora dela` : ""}. Cada número veio de uma coleta ou do que o integrante disse, com a origem e a data ao lado; nenhum é estimativa.`, "");
  lines.push("## Concorrentes", "");
  if (!summary.competitors.length) lines.push("Nenhum anúncio de concorrente ainda.", "");
  else {
    lines.push(`Ordem: quem mantém mais anúncios no ar há ${summary.rules.kept_days} dias ou mais. Anúncio mantido tanto tempo é anúncio que alguém continua pagando.`, "");
    lines.push("| Concorrente | Anúncios ativos | No ar há 30 dias ou mais | Mais tempo no ar | Versões | Lido de |", "|---|---|---|---|---|---|");
    for (const competitor of summary.competitors) {
      const source = competitor.sources.map((type) => SOURCE_LABELS[type] ?? type).join(", ");
      lines.push(`| ${competitor.who}${competitor.indication ? " (indício)" : ""} | ${competitor.active} | ${competitor.kept} | ${competitor.max_days === null ? "sem data" : `${competitor.max_days} dias`} | ${competitor.variations} | ${source}, ${day(competitor.collected_at)} |`);
    }
    lines.push("");
  }
  if (summary.kept.length) {
    lines.push(`## Anúncios no ar há ${summary.rules.kept_days} dias ou mais`, "");
    for (const ad of summary.kept.slice(0, 15)) lines.push(`- ${ad.who}, ${ad.days_active} dias${ad.variations > 1 ? `, ${ad.variations} versões` : ""}: ${quote(ad.text)} (\`${ad.id}\`)`);
    lines.push("");
  }
  lines.push(`## Padrões do mercado (em ${summary.rules.pattern_min_competitors} concorrentes ou mais)`, "");
  if (!summary.patterns.length) lines.push(summary.untagged.length ? "Ainda sem padrão: faltam as etiquetas dos anúncios." : "Nenhum padrão: cada escolha aparece em um concorrente só.", "");
  else {
    for (const pattern of summary.patterns) lines.push(`- ${labels?.dimensions?.[pattern.dimension]?.label ?? pattern.dimension}: ${labelOf(labels, pattern.dimension, pattern.value)}, em ${pattern.competitors.join(", ")} (${pattern.ads.length} anúncios)`);
    lines.push("");
  }
  if (summary.organic.length) {
    lines.push("## Orgânico", "", "Multiplicador alto em perfil pequeno é indício: o número absoluto vai ao lado.", "");
    for (const item of summary.organic) {
      if (item.kind === "organic_pattern") lines.push(`- ${item.who}: ${item.text}${item.n ? ` (${item.n} posts)` : ""} (\`${item.id}\`)`);
      else lines.push(`- ${item.who}: ${item.plays === null ? "" : `${number(item.plays)} plays`}${item.multiplier === null ? "" : `, ${decimal(item.multiplier)} vezes o normal${item.baseline === null ? "" : ` (${number(item.baseline)})`}`}${item.small_sample ? ", indício" : ""} (\`${item.id}\`)`);
    }
    lines.push("");
  }
  if (summary.audience.length) {
    lines.push("## Fala do público", "");
    for (const item of summary.audience.slice(0, 20)) lines.push(`- ${quote(item.text)} (\`${item.id}\`)`);
    lines.push("");
  }
  if (summary.own_results.length) {
    lines.push("## Resultados próprios", "");
    for (const item of summary.own_results) lines.push(`- ${item.text}${item.metrics.length ? `: ${item.metrics.map((metric) => `${metric.name} ${metric.value_text}`).join(", ")}` : ""} (\`${item.id}\`)`);
    lines.push("");
  }
  if (summary.warnings.length) {
    lines.push("## Avisos", "");
    for (const warning of summary.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

// ---------------------------------------------------------------- conceitos.md (the cards)

export function conceptsMarkdown(concepts, { campaign, evidence, labels, approval, warnings = [] }) {
  const byId = new Map(evidence.items.map((item) => [item.id, item]));
  const lines = [`# Conceitos: ${campaign}`, ""];
  lines.push("A confiança de cada conceito é calculada pelo app, pelo número de tipos de fonte que o apoiam: nenhum é aposta, um é baixa, dois é média, três ou mais é alta. Os tipos são anúncio de concorrente, orgânico medido, fala do público e resultado próprio. Ninguém escreve a confiança à mão, e ela ordena apostas: não é previsão de resultado.", "");
  lines.push(approval ? `Aprovados pelo integrante em ${day(approval.at)}.` : "Ainda não aprovados pelo integrante.", "");
  concepts.forEach((concept, index) => {
    lines.push(`## ${index + 1}. ${concept.key} · confiança ${CONFIDENCE_LABELS[concept.confidence]}`, "");
    lines.push(`- ${concept.driver.type === "barreira" ? "Barreira" : "Motivador"}: ${concept.driver.text}`);
    lines.push(`- Ângulo: ${concept.angle}`);
    lines.push(`- Gancho (${labelOf(labels, "hook_family", concept.hook.family)}): ${quote(concept.hook.text)}`);
    lines.push(`- Prova (${labelOf(labels, "proof", concept.proof.type)}): ${concept.proof.text ?? ""}${concept.proof.material ? ` · material: ${concept.proof.material}` : ""}${concept.proof.source ? ` · fonte: ${concept.proof.source}` : ""}`);
    lines.push(`- Estrutura: ${labelOf(labels, "structure", concept.structure)} · estilo visual: ${labelOf(labels, "visual", concept.visual)}`);
    lines.push(`- Peças: ${concept.formats.map((placement) => PLACEMENTS[placement]?.label ?? placement).join("; ")}`);
    lines.push(`- Nome do anúncio: \`${concept.ad_name}\``);
    const families = concept.confidence_basis.families.map((family) => FAMILY_LABELS[family]).join(", ");
    lines.push(`- Base da confiança: ${families || "nenhuma fonte"}`);
    lines.push("- A favor:");
    if (!(concept.evidence ?? []).length) lines.push("  - nenhuma evidência: é uma aposta, e a ficha diz isso.");
    for (const id of concept.evidence ?? []) {
      const item = byId.get(id);
      lines.push(`  - ${FAMILY_LABELS[SOURCE_FAMILY[item?.kind]] ?? "item"}: ${item ? describeItem(item) : id}${item?.excluded ? " (fora da análise)" : ""}`);
    }
    if ((concept.against ?? []).length) {
      lines.push("- Contra:");
      for (const id of concept.against) {
        const item = byId.get(id);
        lines.push(`  - ${item ? describeItem(item) : id}`);
      }
    }
    lines.push(`- Texto do anúncio: ${quote(concept.copy.primary_text)}`);
    lines.push(`- Título: ${quote(concept.copy.headline)}${concept.copy.description ? ` · descrição: ${quote(concept.copy.description)}` : ""} · botão: ${concept.copy.cta ?? "Saiba mais"}`);
    lines.push(`- Critério de sucesso: ${concept.success_criterion}`);
    lines.push("");
  });
  if (warnings.length) {
    lines.push("## Avisos", "");
    for (const warning of warnings) lines.push(`- ${warning}`);
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

// ---------------------------------------------------------------- entrega/textos.md

export const DEFAULT_URL_PARAMS = "utm_source=meta&utm_medium=pago&utm_campaign={{campaign.name}}&utm_content={{ad.name}}";

export function textsMarkdown(concepts, { campaign, brief, files }) {
  const lines = [`# Textos, nomes e link: ${campaign}`, ""];
  lines.push(brief.le_nome ? "O nome de cada anúncio precisa ser exatamente o da tabela: o seu site lê o nome que chega no link para escolher o que mostrar." : "Use no Gerenciador o nome de cada anúncio exatamente como na tabela: é por ele que o resultado de cada peça volta para a próxima rodada.", "");
  lines.push("| Conceito | Nome do anúncio | Arquivo | Onde entra |", "|---|---|---|---|");
  for (const concept of concepts) {
    for (const entry of files.filter((file) => file.concept === concept.key)) {
      lines.push(`| ${concept.key} | \`${concept.ad_name}\` | \`${entry.file}\` | ${PLACEMENTS[entry.placement]?.label ?? entry.placement} |`);
    }
  }
  lines.push("", "## Textos", "");
  for (const concept of concepts) {
    lines.push(`**${concept.key}** (\`${concept.ad_name}\`)`);
    lines.push(`- Texto principal: ${concept.copy.primary_text}`);
    lines.push(`- Título: ${concept.copy.headline}`);
    if (concept.copy.description) lines.push(`- Descrição: ${concept.copy.description}`);
    lines.push(`- Botão: ${concept.copy.cta ?? "Saiba mais"}`, "");
  }
  const params = brief.parametros_url || DEFAULT_URL_PARAMS;
  lines.push("## Link", "");
  if (brief.pagina) lines.push(`- Página de destino: ${brief.pagina}`);
  lines.push("- Parâmetros de URL, no campo próprio do anúncio no Gerenciador:", "", "```", params, "```", "");
  lines.push("O Gerenciador troca {{ad.name}} pelo nome do anúncio e {{campaign.name}} pelo da campanha.");
  if (brief.le_nome && brief.pagina) {
    const base = /^https?:\/\//i.test(brief.pagina) ? brief.pagina : `https://${brief.pagina}`;
    const joiner = base.includes("?") ? "&" : "?";
    lines.push("", "Para conferir antes de publicar, abra cada endereço e veja se a página mostra o ângulo certo:", "");
    for (const concept of concepts) lines.push(`- ${base}${joiner}utm_content=${concept.ad_name}`);
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

// ---------------------------------------------------------------- lancamento.md

export function launchMarkdown(concepts, { campaign, brief, budget, pending = [], generatedAt }) {
  const names = concepts.map((concept) => `\`${concept.ad_name}\``).join(", ");
  const lines = [`# Notas de lançamento: ${campaign}`, ""];
  lines.push(`Escritas em ${day(generatedAt)}. O app não cria a campanha nem mexe na conta de anúncios: quem monta é você. Nada aqui é previsão de resultado.`, "");
  lines.push("## Estrutura", "");
  lines.push(`- Uma campanha, um conjunto, ${concepts.length} anúncio(s): ${names}.`);
  lines.push("- Em cada anúncio, o vídeo vertical vai para Stories e Reels.");
  lines.push("- Um conjunto só, e não um por conceito: com a verba dividida, nenhum conjunto aprende.", "");
  lines.push("## A conta da verba", "");
  if (!budget) lines.push("A verba diária não está no briefing: sem ela, não há conta.", "");
  else {
    lines.push(budget.say, "");
    lines.push(`- Verba diária: ${brl(budget.daily)}; em 7 dias: ${brl(budget.week_budget)}.`);
    lines.push(`- Evento de otimização: ${budget.event ?? "não informado"}.`);
    lines.push(`- Para chegar a ${LEARNING.events} eventos em ${LEARNING.days} dias com essa verba, cada evento precisa custar até ${brl(budget.max_cost_per_event)}.`);
    if (budget.cost_per_event) lines.push(`- Com ${brl(budget.cost_per_event)} por evento, o piso diário de um conjunto é ${brl(budget.floor_per_set)}.`);
    lines.push(`- Fonte: Meta, ${LEARNING.events} eventos em ${LEARNING.days} dias por conjunto (conferido em ${LEARNING.checked_on}).`, "");
    if (budget.exits.length) {
      lines.push("Com essa conta, a campanha fica em aprendizado limitado. As saídas, para você escolher:", "");
      budget.exits.forEach((exit, index) => lines.push(`${index + 1}. ${exit.text}`));
      lines.push("");
    }
  }
  lines.push("## Antes de ligar", "");
  lines.push("- [ ] Os nomes dos anúncios exatamente como em entrega/textos.md.");
  lines.push("- [ ] Os parâmetros de URL colados em cada anúncio.");
  lines.push("- [ ] O pixel e a API de Conversões ativos, com um evento de teste aparecendo no Gerenciador de Eventos.");
  lines.push("- [ ] Nenhum aviso de restrição de categoria sobre o evento escolhido, no Gerenciador de Eventos.");
  if (brief.le_nome) lines.push("- [ ] Cada endereço de conferência de entrega/textos.md mostrando o ângulo certo.");
  for (const item of pending) lines.push(`- [ ] ${item}`);
  lines.push("", "## Enquanto aprende", "");
  lines.push("Pela Meta, estas mudanças podem reiniciar a fase de aprendizado do conjunto:", "");
  lines.push("- trocar o público, o criativo ou o evento de otimização;");
  lines.push("- acrescentar um anúncio novo ao conjunto;");
  lines.push("- pausar o conjunto;");
  lines.push("- mudar o lance ou o orçamento de uma vez, conforme o tamanho da mudança.", "");
  lines.push("Na primeira semana, o melhor é não tocar.", "");
  lines.push("## Quando e o que ler", "");
  lines.push("Depois de 7 dias, exporte do Gerenciador a tabela no nível de anúncio, com o período inteiro. Os nomes das colunas podem variar um pouco:", "");
  lines.push("- nome do anúncio, valor usado, impressões e alcance;");
  lines.push("- reproduções de vídeo de 3 segundos e ThruPlays;");
  lines.push("- cliques no link e CTR do link;");
  lines.push("- visualizações da página de destino;");
  lines.push(`- o evento de otimização (${brief.evento ?? "o escolhido"}) e o passo que vem antes dele no funil.`, "");
  lines.push("Com uma semana de verba pequena, o que dá para comparar entre os anúncios é quem para no gancho (reproduções de 3 segundos ÷ impressões), quem clica e quanto custa cada visita à página. Para o evento final, a resposta mais provável é dado insuficiente, e isso não é fracasso da peça.", "");
  const criteria = [...new Set(concepts.map((concept) => concept.success_criterion))];
  lines.push(`Critério combinado: ${criteria.join(" ")}`);
  return `${lines.join("\n").trimEnd()}\n`;
}
