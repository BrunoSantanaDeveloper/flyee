// The landing page of the ad: the briefing of what it has to carry (from the plan and from what
// the ads promise) and the audit of the live page through the Motor's capture. What the capture
// did not bring comes back as `nao_conferido`, never as a failure.

import { parseMoney } from "./campaign.mjs";

const fold = (text) => String(text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const STOP = new Set(["para", "com", "sem", "que", "uma", "você", "voce", "seu", "sua", "seus", "suas", "mais", "menos", "como", "por", "dos", "das", "nos", "nas", "pelo", "pela", "este", "esta", "isso", "aqui", "agora", "ainda", "cada", "todo", "toda", "quem", "onde", "quando", "muito", "pouco", "sobre", "entre", "até", "ate", "the", "and", "for", "with", "your"]);
const MONTHS = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function words(text) {
  return [...new Set(fold(text).replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((word) => word.length >= 4 && !STOP.has(word)))];
}

function brl(value) {
  return `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** "2026-11-27" → the forms a page writes: 27/11, 27/11/2026, 27 de novembro. */
function dateForms(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? "")) return [];
  const [year, month, date] = day.split("-");
  const d = String(Number(date));
  return [`${date}/${month}`, `${date}/${month}/${year}`, `${d}/${Number(month)}`, `${d} de ${MONTHS[Number(month) - 1]}`, `${date} de ${MONTHS[Number(month) - 1]}`];
}

/** pagina-briefing.md: what the landing page has to carry, from the plan and the concepts. */
export function pageBriefMarkdown({ campaign, brief, concepts = [], plan = null, planPage = null, generatedAt }) {
  const decide = "[a decidir]";
  const lines = [`# Briefing da página de destino: ${campaign}`, "", `Escrito em ${String(generatedAt ?? "").slice(0, 10)} a partir ${plan ? `do plano ${plan.plan}, ` : ""}do briefing da campanha e dos conceitos. O app não constrói a página; quem constrói lê isto. O que está como ${decide} ainda depende do integrante.`, ""];
  lines.push("## 1. A continuidade", "", "A primeira frase da página continua a frase do anúncio, nas mesmas palavras. Uma primeira frase por ângulo, ou a página lê o nome do anúncio no link e troca a manchete sozinha.", "");
  if (concepts.length) for (const concept of concepts) lines.push(`- Ângulo ${concept.angle} (anúncio ${concept.ad_name ?? concept.key}): gancho "${concept.hook?.text ?? ""}"; título do anúncio "${concept.copy?.headline ?? ""}". Primeira frase da página: ${decide}, com as palavras do gancho.`);
  else lines.push(`- ${decide}: os conceitos ainda não foram escritos; a primeira frase de cada ângulo entra aqui.`);
  if (brief.le_nome) lines.push(`- O site lê o nome do anúncio (padrão ${brief.padrao}): a manchete muda pelo ângulo; os ângulos que o site conhece são ${(brief.angulos_site ?? []).join(", ") || decide}.`);
  lines.push("", "## 2. O que ela mostra", "", `- Telas reais do produto${brief.prova ? ` (prova autorizada: ${brief.prova})` : ""}, com dados fictícios quando o produto guarda dados de pessoas.`, "- Um chamado só, acima da dobra no celular, repetido no fim.", `- Botão: ${brief.botao ?? decide}.`, "");
  lines.push("## 3. As objeções, respondidas em uma linha", "", `- Onde os dados ficam e quem acessa: ${decide}`, `- O que acontece se eu cancelar: ${decide}`, `- Quanto tempo leva para começar: ${decide}`, `- Funciona no celular: ${decide}`, "");
  const price = plan?.economics?.price_brl ?? (brief.preco ? parseMoney(brief.preco) : null);
  const option = plan?.offer?.options?.[0] ?? null;
  lines.push("## 4. As linhas que a lei pede", "", `- Preço de referência verdadeiro: ${price ? brl(price) : decide}${option ? `; a oferta "${option.label}" a ${brl(option.price_brl)}` : ""}.`, `- Prazo com data e hora: ${plan?.target_date ? `até ${plan.target_date.slice(8, 10)}/${plan.target_date.slice(5, 7)}/${plan.target_date.slice(0, 4)}, com a hora` : decide}.`, "- As regras da oferta escritas: quem pode, quantas vagas, o que acontece na renovação; quem já é cliente nunca paga mais do que quem entra agora.", "- Os 7 dias de arrependimento da compra à distância.", "- O aviso de cookies e a política de privacidade, porque a página instala rastreadores.", `- O que não pode ser dito: ${(brief.termos ?? []).join(", ") || "nenhum termo proibido no briefing"}${brief.regras ? `; ${brief.regras}` : ""}.`, "");
  lines.push("## 5. O que a página faz por dentro", "", `- Preserva os parâmetros do link até o cadastro e grava a origem na conta da pessoa${plan?.tracking?.utm_rule ? ` (regra: ${plan.tracking.utm_rule})` : ""}.`, `- Dispara os eventos do funil pelo navegador e pelo servidor, com deduplicação: visita, ${brief.evento ?? "lead ou cadastro"}, início de pagamento, compra com valor.`, "- Carrega rápido no celular: a maior parte dos cliques de anúncio vem dele.", "");
  lines.push("## 6. As perguntas de qualificação", "", `- ${decide}: duas ou três perguntas no formulário que separam quem compra de quem só olha (a profissão, se já atende, quantos clientes por semana, o que usa hoje); elas viajam com o lead até a planilha de origem.`, "");
  lines.push("## 7. Conferir a página viva", "", "Com a captura do site, o comando de conferência olha: o primeiro chamado na primeira tela, as palavras do título em comum com o anúncio, os preços e o prazo contra o plano, as linhas legais no texto. O que a captura não trouxe fica como não conferido.");
  if (planPage) lines.push("", `O plano traz o guia completo da página em ${planPage}.`);
  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Audits the live page through captura.json. Returns { items, counts, say }; each item has
 * `status` ok, atencao or nao_conferido, a text for the member and the evidence used.
 */
export function auditPage({ capture, brief, concepts = [], plan = null }) {
  const items = [];
  const raw = capture?.raw ?? {};
  const brand = capture?.brand ?? {};
  const text = fold(raw.text_excerpt ?? "");

  // 1. the first call above the fold
  const ctas = (Array.isArray(raw.cta) ? raw.cta : []).filter((cta) => typeof cta.y === "number");
  if (ctas.length) {
    const first = [...ctas].sort((a, b) => a.y - b.y)[0];
    const height = capture?.viewports?.desktop?.height ?? null;
    if (height) {
      const above = first.y < height;
      items.push({ id: "chamado_acima_da_dobra", status: above ? "ok" : "atencao", text: above ? `O primeiro chamado ("${first.text}") aparece na primeira tela do computador (${Math.round(first.y)} px de ${height}). No celular a posição não foi medida: confira na prévia.` : `O primeiro chamado ("${first.text}") só aparece a ${Math.round(first.y)} px, abaixo da primeira tela de ${height} px do computador.`, evidence: { cta: first.text, y: first.y, viewport_height: height, viewport: "desktop" } });
    } else items.push({ id: "chamado_acima_da_dobra", status: "nao_conferido", text: "A captura não trouxe a altura da tela: a posição do chamado fica por conferir na prévia.", evidence: null });
  } else items.push({ id: "chamado_acima_da_dobra", status: "nao_conferido", text: "A captura não trouxe a posição dos botões: a posição do chamado fica por conferir na prévia.", evidence: null });

  // 2. words in common between the page headline and each ad
  const headline = brand.headline ?? raw.headings?.h1?.[0] ?? null;
  if (headline && concepts.length) {
    const pageWords = words(headline);
    for (const concept of concepts) {
      const adWords = words(`${concept.copy?.headline ?? ""} ${concept.hook?.text ?? ""}`);
      const common = pageWords.filter((word) => adWords.includes(word));
      items.push({ id: `titulo_em_comum_${concept.key}`, status: common.length ? "ok" : "atencao", text: common.length ? `O título da página ("${headline}") e o anúncio ${concept.ad_name ?? concept.key} têm em comum: ${common.join(", ")}.` : `O título da página ("${headline}") não repete nenhuma palavra do anúncio ${concept.ad_name ?? concept.key}: quem clica na promessa não a encontra em cima.`, evidence: { headline, common } });
    }
  } else items.push({ id: "titulo_em_comum", status: "nao_conferido", text: !headline ? "A captura não trouxe o título da página." : "Sem conceitos escritos, não há anúncio para comparar com o título.", evidence: null });

  // 3. prices against the plan or the briefing
  const pagePrices = (Array.isArray(brand.prices) ? brand.prices : Array.isArray(raw.prices) ? raw.prices : []).map((price) => (typeof price.value === "number" ? price.value : parseMoney(price.text))).filter((value) => typeof value === "number");
  const references = [plan?.economics?.price_brl, ...(plan?.offer?.options ?? []).map((option) => option.price_brl), brief.preco ? parseMoney(brief.preco) : null].filter((value) => typeof value === "number");
  if (pagePrices.length && references.length) {
    const matched = references.filter((reference) => pagePrices.some((value) => Math.abs(value - reference) <= Math.max(1, reference * 0.01)));
    items.push({ id: "precos", status: matched.length ? "ok" : "atencao", text: matched.length ? `A página mostra ${matched.map(brl).join(" e ")}, como o plano.` : `A página mostra ${pagePrices.slice(0, 4).map(brl).join(", ")}; o plano e o briefing falam em ${references.map(brl).join(", ")}. Um dos dois está desatualizado.`, evidence: { page: pagePrices, references } });
  } else items.push({ id: "precos", status: "nao_conferido", text: !pagePrices.length ? "A captura não trouxe preços da página." : "Nem o plano nem o briefing têm um preço para comparar.", evidence: { page: pagePrices, references } });

  // 4. the deadline against the plan's target date
  if (plan?.target_date && text) {
    const forms = dateForms(plan.target_date).map(fold);
    const found = forms.find((form) => text.includes(form));
    const otherDate = /\bat[eé]\s+(?:o\s+dia\s+)?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{1,2}\s+de\s+\p{L}+)/u.exec(text);
    items.push({ id: "prazo", status: found ? "ok" : otherDate ? "atencao" : "nao_conferido", text: found ? `A página traz o prazo do plano (${found}).` : otherDate ? `A página fala em "até ${otherDate[1]}", e o plano termina em ${plan.target_date.slice(8, 10)}/${plan.target_date.slice(5, 7)}: confira qual vale.` : "A página não mostra um prazo no texto capturado; a oferta sem data não pressiona ninguém, e a lei pede a data escrita.", evidence: { target_date: plan.target_date, found: found ?? null, other: otherDate?.[1] ?? null } });
  } else items.push({ id: "prazo", status: "nao_conferido", text: !text ? "A captura não trouxe o texto da página." : "O plano não tem data alvo para comparar.", evidence: null });

  // 5. the legal lines in the captured text
  if (text) {
    const legal = [
      { id: "arrependimento_7_dias", test: /7\s*dias|sete\s*dias|arrependimento|devolu[cç][aã]o do (?:valor|dinheiro)|reembolso/.test(text), text: "os 7 dias de arrependimento" },
      { id: "politica_de_privacidade", test: /privacidade/.test(text), text: "a política de privacidade" },
      { id: "cookies", test: /cookie/.test(text) || Boolean(capture?.cookie_banner?.desktop) || Boolean(capture?.cookie_banner?.mobile), text: "o aviso de cookies" },
      { id: "preco_de_referencia", test: /\bde\s*r\$\s*[\d.,]+\s*(?:por|para)\s*r\$/.test(text), text: "o preço de referência ao lado do preço da oferta" },
    ];
    for (const line of legal) items.push({ id: line.id, status: line.test ? "ok" : "atencao", text: line.test ? `A página traz ${line.text}.` : `Não achei ${line.text} no texto capturado (os primeiros 4.000 caracteres); se estiver mais abaixo, está conferido; se não estiver, falta.`, evidence: { searched: "text_excerpt" } });
  } else items.push({ id: "linhas_legais", status: "nao_conferido", text: "A captura não trouxe o texto da página: as linhas legais ficam por conferir.", evidence: null });

  // 6. what no capture can tell
  items.push({ id: "utm_preservada", status: "nao_conferido", text: "Se a página guarda os parâmetros do link até o cadastro, só um cadastro de teste mostra: faça um com um link montado pela regra única e confira a origem gravada.", evidence: null });

  const counts = { ok: items.filter((item) => item.status === "ok").length, atencao: items.filter((item) => item.status === "atencao").length, nao_conferido: items.filter((item) => item.status === "nao_conferido").length };
  const attention = items.filter((item) => item.status === "atencao");
  const say = `${counts.ok} item(ns) conferidos, ${counts.atencao} pedem atenção, ${counts.nao_conferido} não deu para conferir pela captura.${attention.length ? ` Atenção: ${attention.map((item) => item.text).join(" ")}` : ""}`;
  return { items, counts, say, captured_at: capture?.captured_at ?? null, url: capture?.final_url ?? capture?.url ?? null };
}
