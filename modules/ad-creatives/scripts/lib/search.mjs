// The text ads of Google Search (busca.json): the responsive search ads with their headlines,
// descriptions, paths, pins and extensions, checked against the platform's limits and the same
// promise, personal-attribute and forbidden-term rules as the Meta copy.

import { AppError } from "./util.mjs";
import { forbiddenIn, personalIn, promiseIn } from "./copy.mjs";

export const SEARCH_VERSION = 1;
const fold = (text) => String(text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function invalid(path, why, fix = "Corrija o campo apontado em busca.json e rode search de novo.") {
  return Object.assign(new AppError("search_invalid", `busca.json, ${path}: ${why}`, fix), { details: { path } });
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function capsFraction(text) {
  const words = String(text ?? "").split(/\s+/).filter((word) => /\p{L}{3,}/u.test(word));
  if (!words.length) return 0;
  const caps = words.filter((word) => word === word.toUpperCase() && /\p{L}/u.test(word)).length;
  return caps / words.length;
}

/**
 * Checks busca.json. `limits` is references/google-busca.json; `terms` the briefing's forbidden
 * terms; `numberSourced` whether a number in the texts has a source. Returns { passed, campaigns,
 * problems, warnings, counts }. Problems block; warnings only reduce delivery or approval.
 */
export function checkSearch(data, { limits, terms = [], numberSourced = false }) {
  if (!data || typeof data !== "object") throw invalid("(raiz)", "o arquivo não é um objeto JSON.");
  if (data.version !== SEARCH_VERSION) throw invalid("version", `a versão precisa ser ${SEARCH_VERSION}.`);
  if (!Array.isArray(data.campaigns) || !data.campaigns.length) throw invalid("campaigns", "a lista de campanhas está vazia; a primeira é a de marca, a segunda a de não marca.");
  const problems = [];
  const warnings = [];
  const counts = { campaigns: 0, ad_groups: 0, keywords: 0, negatives: 0, ads: 0, headlines: 0, descriptions: 0 };
  const push = (list, path, rule, say, quote = null) => list.push({ path, rule, say, ...(quote ? { quote } : {}) });

  const checkText = (path, text, { maxChars, noExclamation = false }) => {
    if (!nonEmpty(text)) return problems.push({ path, rule: "empty", say: "falta o texto." });
    const clean = text.trim();
    if (clean.length > maxChars) push(problems, path, "too_long", `"${clean}" tem ${clean.length} caracteres; o limite é ${maxChars}.`, clean);
    const promise = promiseIn(clean);
    if (promise && !(promise.rule === "result_number" && numberSourced)) push(problems, path, promise.rule, `o texto ${promise.say}: "${promise.quote}". O app não promete nem prevê resultado.`, promise.quote);
    const personal = personalIn(clean);
    if (personal) push(problems, path, personal.rule, `o texto ${personal.say}: "${personal.quote}". Fale da situação, não da pessoa.`, personal.quote);
    const term = forbiddenIn(clean, terms);
    if (term) push(problems, path, "forbidden_term", `"${term}" está entre os termos que o briefing proíbe.`, term);
    if (noExclamation && clean.includes("!")) push(problems, path, "exclamation", "o Google recusa ponto de exclamação no título.", clean);
    if (capsFraction(clean) > (limits.style?.max_caps_words_fraction ?? 0.3)) push(warnings, path, "caps", `"${clean}" tem palavras inteiras em maiúsculas; o Google reduz a aprovação de texto assim, salvo siglas.`, clean);
  };

  const campaigns = data.campaigns.map((campaign, ci) => {
    const atC = (field) => `campaigns[${ci}].${field}`;
    if (!campaign || typeof campaign !== "object") throw invalid(`campaigns[${ci}]`, "cada campanha é um objeto.");
    if (!nonEmpty(campaign.name)) throw invalid(atC("name"), "falta o nome da campanha.");
    if (!["marca", "nao-marca", "concorrente"].includes(campaign.kind)) throw invalid(atC("kind"), "o tipo é marca, nao-marca ou concorrente.");
    if (!Array.isArray(campaign.ad_groups) || !campaign.ad_groups.length) throw invalid(atC("ad_groups"), "a campanha precisa de ao menos um grupo de anúncios.");
    counts.campaigns += 1;
    const negatives = Array.isArray(campaign.negatives) ? campaign.negatives.filter(nonEmpty) : [];
    counts.negatives += negatives.length;
    if (campaign.kind === "nao-marca" && !negatives.length) push(warnings, atC("negatives"), "no_negatives", "a campanha de não marca não tem negativas: sem o nome da marca entre elas, ela rouba os cliques baratos da campanha de marca.");
    const groups = campaign.ad_groups.map((group, gi) => {
      const atG = (field) => `${atC(`ad_groups[${gi}]`)}.${field}`;
      if (!group || typeof group !== "object") throw invalid(atC(`ad_groups[${gi}]`), "cada grupo é um objeto.");
      if (!nonEmpty(group.name)) throw invalid(atG("name"), "falta o nome do grupo.");
      if (!Array.isArray(group.keywords) || !group.keywords.length) throw invalid(atG("keywords"), "o grupo precisa de palavras-chave.");
      counts.ad_groups += 1;
      const keywords = group.keywords.map((keyword, ki) => {
        const at = `${atG(`keywords[${ki}]`)}`;
        if (!keyword || typeof keyword !== "object" || !nonEmpty(keyword.text)) throw invalid(at, "cada palavra é { text, match }.");
        if (!(limits.match_types ?? ["ampla", "frase", "exata"]).includes(keyword.match)) throw invalid(`${at}.match`, `a correspondência é ${(limits.match_types ?? ["ampla", "frase", "exata"]).join(", ")}.`);
        counts.keywords += 1;
        return { text: keyword.text.trim(), match: keyword.match };
      });
      if (!Array.isArray(group.ads) || !group.ads.length) throw invalid(atG("ads"), "o grupo precisa de ao menos um anúncio.");
      const ads = group.ads.map((ad, ai) => {
        const atA = (field) => `${atG(`ads[${ai}]`)}.${field}`;
        if (!ad || typeof ad !== "object") throw invalid(atG(`ads[${ai}]`), "cada anúncio é um objeto.");
        const headlines = Array.isArray(ad.headlines) ? ad.headlines : null;
        if (!headlines) throw invalid(atA("headlines"), "a lista de títulos falta.");
        if (headlines.length < limits.headline.min_count || headlines.length > limits.headline.max_count) push(problems, atA("headlines"), "headline_count", `${headlines.length} título(s): o anúncio pede de ${limits.headline.min_count} a ${limits.headline.max_count}.`);
        else if (headlines.length < (limits.headline.recommended_count ?? 10)) push(warnings, atA("headlines"), "headline_few", `${headlines.length} títulos: com ${limits.headline.recommended_count ?? 10} ou mais o Google combina melhor.`);
        const descriptions = Array.isArray(ad.descriptions) ? ad.descriptions : null;
        if (!descriptions) throw invalid(atA("descriptions"), "a lista de descrições falta.");
        if (descriptions.length < limits.description.min_count || descriptions.length > limits.description.max_count) push(problems, atA("descriptions"), "description_count", `${descriptions.length} descrição(ões): o anúncio pede de ${limits.description.min_count} a ${limits.description.max_count}.`);
        const pinned = {};
        headlines.forEach((headline, hi) => {
          const text = typeof headline === "string" ? headline : headline?.text;
          checkText(atA(`headlines[${hi}]`), text, { maxChars: limits.headline.max_chars, noExclamation: Boolean(limits.style?.no_exclamation_in_headline) });
          const pin = typeof headline === "object" && headline?.pin !== undefined ? headline.pin : null;
          if (pin !== null) {
            if (!(limits.pins?.positions ?? [1, 2, 3]).includes(pin)) push(problems, atA(`headlines[${hi}].pin`), "pin_position", `a fixação é 1, 2 ou 3.`);
            else (pinned[pin] ??= []).push(hi);
          }
          counts.headlines += 1;
        });
        for (const [position, list] of Object.entries(pinned)) if (list.length === 1 && headlines.length > 3) push(warnings, atA(`headlines[${list[0]}].pin`), "single_pin", `só um título fixado na posição ${position}: ele aparece sempre, e o Google avalia o anúncio como menos forte. Fixe dois ou três na mesma posição, ou nenhum.`);
        descriptions.forEach((description, di) => {
          const text = typeof description === "string" ? description : description?.text;
          checkText(atA(`descriptions[${di}]`), text, { maxChars: limits.description.max_chars });
          counts.descriptions += 1;
        });
        for (const [index, path] of [["path1", ad.path1], ["path2", ad.path2]]) {
          if (path === undefined || path === null || path === "") continue;
          if (String(path).length > limits.path.max_chars) push(problems, atA(index), "path_long", `"${path}" tem ${String(path).length} caracteres; o caminho aceita ${limits.path.max_chars}.`);
          if (/\s/.test(String(path))) push(problems, atA(index), "path_space", "o caminho não leva espaço.");
        }
        if (!nonEmpty(ad.final_url) || !/^https?:\/\//i.test(ad.final_url)) push(problems, atA("final_url"), "final_url", "a página de destino precisa ser um endereço completo, com https://.");
        else if (!/utm_source=/.test(ad.final_url) && !/\{/.test(ad.final_url)) push(warnings, atA("final_url"), "no_utm", "o endereço não traz os parâmetros da regra única de link; use o modelo de acompanhamento da campanha ou o link montado pelo app de medição.");
        counts.ads += 1;
        return { headlines: headlines.map((headline) => (typeof headline === "string" ? { text: headline, pin: null } : { text: headline.text, pin: headline.pin ?? null })), descriptions: descriptions.map((description) => (typeof description === "string" ? { text: description, pin: null } : { text: description.text, pin: description.pin ?? null })), path1: ad.path1 ?? null, path2: ad.path2 ?? null, final_url: ad.final_url ?? null };
      });
      return { name: group.name.trim(), keywords, ads };
    });
    const extensions = campaign.extensions ?? {};
    const sitelinks = Array.isArray(extensions.sitelinks) ? extensions.sitelinks : [];
    sitelinks.forEach((sitelink, si) => {
      const at = atC(`extensions.sitelinks[${si}]`);
      checkText(`${at}.text`, sitelink?.text, { maxChars: limits.sitelink.text_max_chars });
      for (const [field, text] of [["description1", sitelink?.description1], ["description2", sitelink?.description2]]) if (nonEmpty(text)) checkText(`${at}.${field}`, text, { maxChars: limits.sitelink.description_max_chars });
      if (!nonEmpty(sitelink?.url) || !/^https?:\/\//i.test(sitelink.url)) push(problems, `${at}.url`, "sitelink_url", "o sitelink precisa de um endereço completo.");
    });
    if (sitelinks.length && sitelinks.length < limits.sitelink.min_count) push(warnings, atC("extensions.sitelinks"), "sitelinks_few", `${sitelinks.length} sitelink: o Google mostra a partir de ${limits.sitelink.min_count}.`);
    const callouts = Array.isArray(extensions.callouts) ? extensions.callouts : [];
    callouts.forEach((callout, i) => checkText(atC(`extensions.callouts[${i}]`), callout, { maxChars: limits.callout.max_chars }));
    const snippet = extensions.snippet ?? null;
    if (snippet) {
      if (!(limits.snippet.header_values ?? []).some((header) => fold(header) === fold(snippet.header))) push(problems, atC("extensions.snippet.header"), "snippet_header", `o cabeçalho precisa ser um dos que o Google oferece: ${(limits.snippet.header_values ?? []).slice(0, 6).join(", ")} e outros.`);
      const values = Array.isArray(snippet.values) ? snippet.values : [];
      if (values.length < limits.snippet.min_values) push(problems, atC("extensions.snippet.values"), "snippet_values", `${values.length} valor(es): o snippet pede ao menos ${limits.snippet.min_values}.`);
      values.forEach((value, i) => checkText(atC(`extensions.snippet.values[${i}]`), value, { maxChars: limits.snippet.value_max_chars }));
    }
    return { name: campaign.name.trim(), kind: campaign.kind, negatives, ad_groups: groups, extensions: { sitelinks, callouts, snippet } };
  });
  if (!campaigns.some((campaign) => campaign.kind === "marca")) push(warnings, "campaigns", "no_brand_campaign", "não há campanha de marca: quem já procura o nome da marca é o clique mais barato e mais certo da Busca.");
  return { passed: problems.length === 0, campaigns, problems, warnings, counts, limits_checked_on: limits.checked_on ?? null };
}

/** busca.md: the ads as the member pastes them into Google Ads. */
export function searchMarkdown(checked, { campaign }) {
  const lines = [`# Anúncios da Busca do Google: ${campaign}`, "", `${checked.counts.campaigns} campanha(s), ${checked.counts.ad_groups} grupo(s), ${checked.counts.keywords} palavra(s), ${checked.counts.ads} anúncio(s). Limites conferidos em ${checked.limits_checked_on}. Quem cria a campanha no Google Ads é você; o app não entra na conta.`, ""];
  for (const campaign of checked.campaigns) {
    lines.push(`## ${campaign.name} (${campaign.kind === "marca" ? "marca" : campaign.kind === "nao-marca" ? "não marca" : "concorrente"})`, "");
    if (campaign.negatives.length) lines.push(`Negativas da campanha: ${campaign.negatives.join(", ")}`, "");
    for (const group of campaign.ad_groups) {
      lines.push(`### Grupo ${group.name}`, "", `Palavras: ${group.keywords.map((keyword) => `${keyword.match === "exata" ? `[${keyword.text}]` : keyword.match === "frase" ? `"${keyword.text}"` : keyword.text}`).join(", ")}`, "");
      group.ads.forEach((ad, index) => {
        lines.push(`Anúncio ${index + 1}, destino ${ad.final_url ?? "(sem endereço)"}${ad.path1 ? `, caminho /${ad.path1}${ad.path2 ? `/${ad.path2}` : ""}` : ""}`, "", "| Título | Caracteres | Fixado |", "|---|---|---|");
        for (const headline of ad.headlines) lines.push(`| ${headline.text} | ${headline.text.length} | ${headline.pin ?? ""} |`);
        lines.push("", "| Descrição | Caracteres |", "|---|---|");
        for (const description of ad.descriptions) lines.push(`| ${description.text} | ${description.text.length} |`);
        lines.push("");
      });
    }
    if (campaign.extensions.sitelinks.length) lines.push("Sitelinks:", ...campaign.extensions.sitelinks.map((sitelink) => `- ${sitelink.text} (${sitelink.url})${sitelink.description1 ? `: ${sitelink.description1}${sitelink.description2 ? ` ${sitelink.description2}` : ""}` : ""}`), "");
    if (campaign.extensions.callouts.length) lines.push(`Frases de destaque: ${campaign.extensions.callouts.join(" · ")}`, "");
    if (campaign.extensions.snippet) lines.push(`Snippet ${campaign.extensions.snippet.header}: ${(campaign.extensions.snippet.values ?? []).join(", ")}`, "");
  }
  if (checked.warnings.length) lines.push("## Avisos", "", ...checked.warnings.map((warning) => `- ${warning.say}`), "");
  return `${lines.join("\n").trimEnd()}\n`;
}
