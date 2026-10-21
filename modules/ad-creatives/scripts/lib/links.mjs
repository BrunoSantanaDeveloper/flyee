// The guided manual research: links to Meta's Ad Library already filtered (country, active ads,
// every type) and the short script of what to photograph on each card. The member opens the
// links in the browser; the Ad Library refuses a request without one, so nothing here fetches.

import { RULES } from "./evidence.mjs";

const LIBRARY = "https://www.facebook.com/ads/library/";

/** A keyword search in the Ad Library: the words of the niche find the advertisers. */
export function keywordUrl(query, country = "BR") {
  const params = new URLSearchParams({ active_status: "active", ad_type: "all", country, q: query, search_type: "keyword_unordered", media_type: "all" });
  return `${LIBRARY}?${params.toString()}`;
}

/** All active ads of one page, when its numeric id is known. */
export function pageUrl(pageId, country = "BR") {
  const params = new URLSearchParams({ active_status: "active", ad_type: "all", country, view_all_page_id: String(pageId), search_type: "page", media_type: "all" });
  return `${LIBRARY}?${params.toString()}`;
}

/**
 * The link for one competitor: an Ad Library address the member already has (kept as it is,
 * with the filters added when missing), a page id, or a search by the name.
 */
export function competitorLink(who, country = "BR") {
  const text = String(who ?? "").trim();
  if (/facebook\.com\/ads\/library/i.test(text)) {
    try {
      const url = new URL(text);
      if (!url.searchParams.has("active_status")) url.searchParams.set("active_status", "active");
      if (!url.searchParams.has("country")) url.searchParams.set("country", country);
      const pageId = url.searchParams.get("view_all_page_id");
      return { who: pageId ? `página ${pageId}` : text, kind: "library", url: url.toString(), how: "O endereço que você trouxe, com os filtros de país e de anúncios ativos." };
    } catch {
      // not a parseable address: searched by its text below
    }
  }
  const id = /(?:view_all_page_id=|^)(\d{6,20})$/.exec(text)?.[1];
  if (id) return { who: text, kind: "page", url: pageUrl(id, country), how: "Todos os anúncios ativos desta página." };
  const name = text.replace(/^@/, "").replace(/^https?:\/\/(?:www\.)?(?:facebook|instagram)\.com\//i, "").replace(/\/.*$/, "");
  return { who: text, kind: "name", url: keywordUrl(name, country), how: "Busca pelo nome. Na lista, clique no nome da página do concorrente para ver só os anúncios dela." };
}

/** What the member does on each link: five lines, the same for every competitor (D12). */
export function collectionScript() {
  return [
    "Abra o link: ele já vem filtrado pelo país, só com anúncios ativos e de todos os tipos.",
    `Fotografe os ${RULES.cards_per_competitor} primeiros cartões, na ordem da tela, sem escolher: o que parece fraco também entra.`,
    'Em cada captura, deixe à mostra a linha "Veiculação iniciada em…", a linha "N anúncios usam esse criativo e esse texto" quando houver, o texto do anúncio e o botão.',
    "Se o cartão for um vídeo, copie também o link do anúncio (Ver detalhes do anúncio).",
    "Salve as capturas na pasta pesquisa/capturas/<concorrente>/ da campanha, numeradas na ordem da tela: 01.png, 02.png…",
  ];
}

/** pesquisa/links.md: what the member opens, in order, and where the screenshots go. */
export function linksMarkdown(links, { campaign, folders = [] }) {
  const lines = [`# Pesquisa de anúncios: ${campaign}`, ""];
  lines.push("Cada link abre a Biblioteca de Anúncios da Meta já filtrada. A Biblioteca é pública e não pede login.", "");
  lines.push("## Como colher", "");
  links.script.forEach((line, index) => lines.push(`${index + 1}. ${line}`));
  lines.push("");
  if (links.competitors.length) {
    lines.push("## Concorrentes", "");
    links.competitors.forEach((competitor, index) => {
      lines.push(`- **${competitor.who}**: ${competitor.url}`);
      lines.push(`  ${competitor.how} Capturas em \`${folders[index]?.dir ?? "pesquisa/capturas/"}\`.`);
    });
    lines.push("");
  }
  if (links.searches.length) {
    lines.push("## Buscas por palavra", "", "Servem para achar quem anuncia para o mesmo público. Anote os nomes que aparecem mais de uma vez: eles entram como concorrentes.", "");
    for (const search of links.searches) lines.push(`- **${search.query}**: ${search.url}`);
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

/** The links of a campaign, from the briefing's competitors and search words. */
export function campaignLinks(brief) {
  const country = brief.pais ?? "BR";
  const competitors = (brief.concorrentes ?? []).map((who) => competitorLink(who, country));
  const searches = (brief.palavras_busca ?? []).map((query) => ({ query, url: keywordUrl(query, country), how: "Busca pela palavra: mostra quem anuncia para o mesmo público, inclusive quem você não conhecia." }));
  return { country, competitors, searches, script: collectionScript() };
}
