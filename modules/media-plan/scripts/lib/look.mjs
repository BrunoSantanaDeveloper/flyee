// Look before asking: what the project already knows. The brand file of this app, the
// briefings and site captures of the creatives app, the Instagram research and the contact
// inventory. Each fact says where it came from, so a premise filled from it is `encontrado`.

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { fold, parseMoney, readJson, readText, toPosix } from "./util.mjs";

/** The lines of marca.md and of a creatives briefing the plan reads, by their folded labels. */
const LABELS = {
  marca: ["marca", "nome da marca"],
  produto: ["produto", "o que vende"],
  oferta: ["oferta", "o que a campanha vende"],
  preco: ["preco", "precos", "planos e precos", "planos"],
  pagina: ["pagina de destino", "destino", "pagina", "site"],
  publico: ["publico", "para quem"],
  evento: ["evento de otimizacao", "evento"],
  verba: ["verba diaria", "verba", "orcamento", "orcamento diario"],
  custo_evento: ["custo por evento", "custo por resultado"],
  concorrentes: ["concorrentes"],
  base: ["base", "base de contatos", "contatos"],
  contas: ["contas", "contas e rastreamento", "rastreamento"],
  feriados: ["feriados", "feriados locais"],
  regras: ["o que pode ser dito", "regras", "termos proibidos"],
};

const EMPTY = /^(?:|\.\.\.|…|\?|\(.*\))$/;

/** "- Campo (explicação): valor" lines → { campo: valor }, by the labels above. */
export function parseFacts(text) {
  const facts = {};
  for (const raw of String(text ?? "").replace(/\r\n/g, "\n").split("\n")) {
    const match = /^\s*[-*]\s*(?:\*\*)?([^:]+?)(?:\*\*)?\s*:\s*(.*)$/.exec(raw);
    if (!match) continue;
    const label = fold(match[1].replace(/\([^)]*\)/g, "")).replace(/[*_]/g, "").trim();
    const value = match[2].replace(/^\*\*\s*/, "").trim();
    if (EMPTY.test(value)) continue;
    for (const [key, labels] of Object.entries(LABELS)) if (labels.includes(label) && !(key in facts)) facts[key] = value;
  }
  return facts;
}

function dirs(path) {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * Inventories the project. Returns the facts found, each with the premise it serves and the
 * file it came from, plus what was looked at and found empty.
 */
export function lookProject(root, { brandFile = join(root, "media-plan", "marca.md") } = {}) {
  const found = [];
  const looked = [];
  const add = (premise, key, value, where, extra = {}) => found.push({ premise, key, value, where: toPosix(root, where), ...extra });

  // The brand file of this app.
  const brand = readText(brandFile);
  looked.push({ what: "marca.md", found: Boolean(brand) });
  if (brand) {
    const facts = parseFacts(brand);
    if (facts.marca) add("brand", "marca", facts.marca, brandFile);
    if (facts.produto) add("produto_oferta", "produto", facts.produto, brandFile);
    if (facts.preco) add("preco_planos", "preco", facts.preco, brandFile, { price_brl: parseMoney(facts.preco.split(/[,;]| ou /)[0]) });
    if (facts.publico) add("publico", "publico", facts.publico, brandFile);
    if (facts.base) add("base", "base", facts.base, brandFile);
    if (facts.contas) add("contas_rastreamento", "contas", facts.contas, brandFile);
    if (facts.feriados) add("calendar", "feriados", facts.feriados, brandFile);
    if (facts.regras) add("rules", "regras", facts.regras, brandFile);
    if (facts.pagina) add("prontidao", "pagina", facts.pagina, brandFile);
  }

  // The briefings of the creatives app: one per campaign.
  const adsDir = join(root, "anuncios");
  const campaigns = dirs(adsDir);
  looked.push({ what: "anuncios/*/briefing.md", found: campaigns.length > 0, count: campaigns.length });
  for (const campaign of campaigns) {
    const file = join(adsDir, campaign, "briefing.md");
    const text = readText(file);
    if (!text) continue;
    const facts = parseFacts(text);
    if (facts.oferta) add("produto_oferta", "oferta", facts.oferta, file, { campaign });
    if (facts.produto) add("produto_oferta", "produto", facts.produto, file, { campaign });
    if (facts.preco) add("preco_planos", "preco", facts.preco, file, { campaign, price_brl: parseMoney(facts.preco.split(/ \(| por /)[0]) });
    if (facts.pagina) add("prontidao", "pagina", facts.pagina, file, { campaign });
    if (facts.publico) add("publico", "publico", facts.publico, file, { campaign });
    if (facts.evento) add("evento", "evento", facts.evento, file, { campaign });
    if (facts.verba) add("verba", "verba_diaria", facts.verba, file, { campaign, daily_brl: parseMoney(facts.verba) });
    if (facts.custo_evento) add("evento", "custo_evento", facts.custo_evento, file, { campaign, cost_brl: parseMoney(facts.custo_evento) });
    if (facts.concorrentes) add("market", "concorrentes", facts.concorrentes, file, { campaign });
  }

  // The site captures of the video engine: prices, headings and calls on the live page.
  const capturesDir = join(root, "capturas");
  const captures = dirs(capturesDir);
  looked.push({ what: "capturas/*/captura.json", found: captures.length > 0, count: captures.length });
  for (const capture of captures) {
    const file = join(capturesDir, capture, "captura.json");
    const data = readJson(file);
    if (!data) continue;
    const raw = data.raw ?? data;
    const prices = Array.isArray(raw.prices) ? raw.prices.slice(0, 5) : [];
    const h1 = Array.isArray(raw.headings) ? raw.headings.find((heading) => heading.tag === "h1")?.text : null;
    const url = data.url ?? data.final_url ?? null;
    if (url) add("prontidao", "pagina_capturada", url, file, { prices, h1: h1 ?? null, cta: raw.cta ?? null, captured_at: data.captured_at ?? data.at ?? null });
  }

  // The Instagram research and the contact inventory, as counts.
  const profiles = dirs(join(root, "instagram-research", "profiles"));
  looked.push({ what: "instagram-research/profiles", found: profiles.length > 0, count: profiles.length });
  if (profiles.length) add("market", "perfis_medidos", `${profiles.length} perfil(is) medidos`, join(root, "instagram-research", "profiles"));
  const inventory = readJson(join(root, "contatos", "inventario.json"));
  looked.push({ what: "contatos/inventario.json", found: Boolean(inventory) });
  if (inventory?.counts) add("base", "inventario", `${inventory.counts.total ?? 0} contatos, ${inventory.counts.valid ?? 0} válidos`, join(root, "contatos", "inventario.json"), { counts: inventory.counts });

  const planDir = join(root, "media-plan");
  const plans = existsSync(planDir) ? dirs(planDir).filter((name) => existsSync(join(planDir, name, "premissas.json"))) : [];
  looked.push({ what: "media-plan/*/premissas.json", found: plans.length > 0, count: plans.length });

  return { found, looked, plans, campaigns, has_brand_file: Boolean(brand) };
}

/** The template of marca.md, the stable facts of a brand with a source and a date on each line. */
export function brandTemplate() {
  return `# A marca

Fatos estáveis da marca, um por linha, no formato "Campo: valor (fonte, data)". O plano lê este arquivo antes de perguntar qualquer coisa. O que não se sabe fica em branco.

- Marca:
- Produto (o que vende, numa frase):
- Planos e preços (cada plano com o preço e a cobrança):
- Site (a página principal e a de venda):
- Público (quem compra, em que momento, com que dor):
- Base de contatos (quantos, de onde vieram, há quanto tempo sem contato):
- Contas e rastreamento (conta de anúncios, Pixel, API de Conversões, GA4, Google Ads; o que vê o quê):
- O que pode ser dito (regras do conselho, da marca ou da lei; termos proibidos):
- Feriados locais (os da cidade e do estado, além dos nacionais):
`;
}

/** The mtime of a file, for "as of" lines; null when it does not exist. */
export function fileDay(path) {
  try {
    return statSync(path).mtime.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}
