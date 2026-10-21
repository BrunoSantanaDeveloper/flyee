// A campaign is one folder in the member's project: ./anuncios/<campanha>/. This module knows
// its layout, the briefing the member fills (and reads it back), the state the script keeps
// (estado.json) and the journal the member and the next round read (diario.json).

import { join } from "node:path";

import { isFile } from "./files.mjs";
import { AppError, readJson, slugify, writeJson } from "./util.mjs";

export const ADS_DIR = "anuncios";
export const STATE_VERSION = 1;

/** Every path of a campaign, from the project root. */
export function layout(root, slug) {
  const dir = join(root, ADS_DIR, slug);
  return {
    dir,
    briefing: join(dir, "briefing.md"),
    materials: join(dir, "materiais"),
    research: join(dir, "pesquisa"),
    captures: join(dir, "pesquisa", "capturas"),
    readings: join(dir, "pesquisa", "leituras"),
    links: join(dir, "pesquisa", "links.md"),
    evidence: join(dir, "evidencias.json"),
    evidenceMd: join(dir, "evidencias.md"),
    concepts: join(dir, "conceitos.json"),
    conceptsMd: join(dir, "conceitos.md"),
    budget: join(dir, "verba.json"),
    copy: join(dir, "textos.json"),
    pieces: join(dir, "pecas"),
    delivery: join(dir, "entrega"),
    launch: join(dir, "lancamento.md"),
    report: join(dir, "relatorio.json"),
    journal: join(dir, "diario.json"),
    state: join(dir, "estado.json"),
  };
}

/** A campaign name as a folder: lowercase ASCII with hyphens. */
export function campaignSlug(text) {
  const slug = slugify(String(text ?? ""), 50);
  return slug === "pesquisa" && !/pesquisa/i.test(String(text ?? "")) ? "" : slug;
}

export function requireCampaign(root, name, { scriptCommand }) {
  if (!name) throw new AppError("usage", "Informe a campanha: <comando> <campanha>.", `Para ver as campanhas deste projeto, rode ${scriptCommand} list --json.`);
  const slug = campaignSlug(name);
  const paths = layout(root, slug);
  if (!slug || !isFile(paths.briefing)) {
    throw new AppError("campaign_not_found", `Não encontrei a campanha "${name}" em ${ADS_DIR}/.`, `Crie com ${scriptCommand} new <campanha> --json, ou rode list --json para ver as que existem.`);
  }
  return { slug, paths };
}

// ---------------------------------------------------------------- state and journal

export function readState(paths, slug) {
  const state = readJson(paths.state, null);
  if (state && state.version === STATE_VERSION) return state;
  return { version: STATE_VERSION, campaign: slug, created_at: null, round: 0, approvals: { concepts: null, previews: {} }, pieces: {}, copy: null, delivered: null };
}

export function writeState(paths, state) {
  writeJson(paths.state, state);
}

export function readJournal(paths, slug) {
  const journal = readJson(paths.journal, null);
  if (journal && Array.isArray(journal.entries)) return journal;
  return { version: 1, campaign: slug, entries: [] };
}

/** Appends one entry to diario.json and returns it. */
export function addJournal(paths, slug, entry) {
  const journal = readJournal(paths, slug);
  const full = { at: new Date().toISOString(), ...entry };
  journal.entries.push(full);
  writeJson(paths.journal, journal);
  return full;
}

// ---------------------------------------------------------------- the briefing

/**
 * The fields of briefing.md: `key`, the labels the parser accepts (folded, without accents),
 * whether `brief` asks for it, and the question it asks when the field is empty.
 */
export const BRIEF_FIELDS = [
  { key: "marca", labels: ["marca", "nome da marca"], required: true, ask: "Qual é o nome da marca, como aparece no anúncio?" },
  { key: "produto", labels: ["produto"], required: true, ask: "Qual é o produto ou serviço que a campanha vende, numa frase?" },
  { key: "oferta", labels: ["oferta", "o que a campanha vende"], required: true, ask: "Qual é a oferta para quem ainda não conhece a marca (o plano, o pacote, a condição)? Não invento oferta nem preço." },
  { key: "preco", labels: ["preco"], required: false, ask: "Qual é o preço que aparece na oferta, se ele entra no anúncio?" },
  { key: "pagina", labels: ["pagina de destino", "destino", "link de destino"], required: true, ask: "Para qual página o anúncio leva (o endereço completo)?" },
  { key: "site", labels: ["site da marca", "site"], required: false, ask: "Qual é o site da marca, para eu copiar o logo, as cores e as telas?" },
  { key: "botao", labels: ["botao", "chamada", "botao do anuncio"], required: false, ask: "Qual botão o anúncio usa (Saiba mais, Assinar, Comprar agora…)?" },
  { key: "evento", labels: ["evento de otimizacao", "evento"], required: true, ask: "Por qual evento a campanha vai otimizar (compra, início de checkout, cadastro, mensagem…)?" },
  { key: "verba", labels: ["verba diaria", "verba", "orcamento diario"], required: true, ask: "Qual é a verba por dia, em reais?" },
  { key: "custo_evento", labels: ["custo por evento", "custo por resultado"], required: false, ask: "Quanto você aceita pagar por evento, ou quanto ele custou em campanhas anteriores? Se não souber, faço a conta ao contrário." },
  { key: "publico", labels: ["publico"], required: true, ask: "Para quem é o anúncio (quem compra, em que momento, com que dor)?" },
  { key: "nome_lido", labels: ["o site le o nome do anuncio", "site le o nome do anuncio", "o site le o nome"], required: true, ask: "O seu site escolhe algo pelo nome do anúncio que chega no link (utm_content)? Se sim, qual é o padrão do nome?" },
  { key: "padrao_nome", labels: ["padrao do nome", "nome dos anuncios", "padrao do nome do anuncio"], required: false, ask: "Qual é o padrão do nome do anúncio que o site lê (por exemplo <ângulo>-<formato>-<gancho>-v<n>)?" },
  { key: "angulos_site", labels: ["angulos que o site le", "angulos do site", "angulos"], required: false, ask: "Quais ângulos o site reconhece no nome do anúncio?" },
  { key: "termos_proibidos", labels: ["termos proibidos", "palavras proibidas"], required: true, ask: "Há palavras ou promessas que não podem aparecer (por regra do seu conselho, da marca ou da lei)? Se não houver, escrevo nenhum." },
  { key: "regras", labels: ["regras", "o que nao pode ser dito"], required: false, ask: "Há regras sobre o que não pode ser dito, além das palavras?" },
  { key: "prova", labels: ["prova autorizada", "prova"], required: false, ask: "Que prova você autoriza (telas do produto, depoimento com autorização, números com fonte)?" },
  { key: "concorrentes", labels: ["concorrentes"], required: false, ask: "Quais são de 3 a 5 concorrentes que anunciam para o mesmo público (nome da página ou do perfil)?" },
  { key: "palavras_busca", labels: ["palavras de busca", "busca", "palavras-chave"], required: false, ask: "Que palavras o seu público ou os seus concorrentes usam nos anúncios (a profissão, o problema, o produto)?" },
  { key: "perfis", labels: ["perfis de instagram", "perfis"], required: false, ask: "Quais são os perfis de Instagram da marca?" },
  { key: "pais", labels: ["pais"], required: false, ask: "Em que país a campanha roda?" },
  { key: "parametros_url", labels: ["parametros de url", "parametros"], required: false, ask: "O site usa parâmetros de URL próprios no link do anúncio?" },
];

const LIST_FIELDS = new Set(["concorrentes", "palavras_busca", "perfis", "termos_proibidos", "angulos_site"]);
const EMPTY = /^(?:|\.\.\.|…|\?|\(.*\))$/;

export const fold = (text) =>
  String(text ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** The briefing a new campaign starts with. The member's AI fills it in with the member. */
export function briefingTemplate(name) {
  return `# Briefing: ${name}

Preencha com o integrante. O app lê cada linha "Campo: valor"; o texto entre parênteses explica o campo. Nada aqui é inventado: o que o integrante não souber fica em branco.

## Oferta

- Marca (o nome, como aparece no anúncio):
- Produto (o que a marca vende, numa frase):
- Oferta (o que o anúncio oferece a quem ainda não conhece a marca):
- Preço (só se entrar no anúncio):
- Página de destino (o endereço completo para onde o anúncio leva):
- Site da marca (de onde vêm o logo, as cores e as telas, se for outro):
- Botão (Saiba mais, Assinar, Comprar agora…):

## Campanha

- Evento de otimização (compra, início de checkout, cadastro, mensagem…):
- Verba diária (em reais):
- Custo por evento (quanto o integrante aceita pagar, ou quanto custou antes; pode ficar em branco):
- Público (quem compra, em que momento, com que dor):
- País (padrão: Brasil):

## Nome dos anúncios

- O site lê o nome do anúncio (sim ou não):
- Padrão do nome (por exemplo <ângulo>-<formato>-<gancho>-v<n>):
- Ângulos que o site lê (separados por vírgula):
- Parâmetros de URL (se o site usa os próprios):

## O que não pode ser dito

- Termos proibidos (palavras e promessas, separadas por vírgula; ou nenhum):
- Regras (o que não pode ser dito, em frases):

## Prova

- Prova autorizada (telas do produto, depoimento com autorização, número com fonte):

## Concorrentes e pesquisa

- Concorrentes (de 3 a 5 nomes de página, separados por vírgula):
- Palavras de busca (as palavras do nicho, separadas por vírgula):
- Perfis de Instagram (da marca):
`;
}

/** Reads briefing.md: every "- Campo: valor" line whose label is a known field. */
export function parseBriefing(text) {
  const fields = {};
  const unknown = [];
  for (const raw of String(text ?? "").replace(/\r\n/g, "\n").split("\n")) {
    const match = /^\s*[-*]\s*(?:\*\*)?([^:]+?)(?:\*\*)?\s*:\s*(.*)$/.exec(raw);
    if (!match) continue;
    const label = fold(match[1].replace(/\([^)]*\)/g, "")).replace(/[*_]/g, "").trim();
    const value = match[2].replace(/^\*\*\s*/, "").trim();
    const field = BRIEF_FIELDS.find((candidate) => candidate.labels.includes(label));
    if (!field) {
      if (value) unknown.push(label);
      continue;
    }
    if (EMPTY.test(value)) continue;
    fields[field.key] = LIST_FIELDS.has(field.key) ? splitList(value) : value;
  }
  return { fields, unknown };
}

export function splitList(value) {
  return String(value)
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** "R$ 1.500,00", "50 reais", "R$50", "1500.5" → a number; null when it is not one. */
export function parseMoney(text) {
  if (typeof text === "number") return Number.isFinite(text) ? text : null;
  const clean = String(text ?? "")
    .replace(/r\$|reais|real|brl|por dia|\/dia|ao dia/gi, "")
    .replace(/\s+/g, "")
    .trim();
  if (!/^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$|^\d+(?:[.,]\d{1,2})?$/.test(clean)) return null;
  const normalized = /,\d{1,2}$/.test(clean) || /^\d{1,3}(?:\.\d{3})+$/.test(clean) ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const YES = /^(?:sim|s|yes|le|lê)\b/i;
const NO = /^(?:nao|não|n|no)\b/i;

/** The name tokens a pattern can use (D21). */
export const NAME_TOKENS = ["angulo", "conceito", "formato", "gancho", "n"];
export const DEFAULT_NAME_PATTERN = "<conceito>-<formato>-<gancho>-v<n>";

/**
 * The briefing as the script uses it, and what is missing. `missing` lists the fields to ask
 * for, each with its question; `problems` the values that are there but cannot be read.
 */
export function checkBriefing(text) {
  const { fields, unknown } = parseBriefing(text);
  const problems = [];
  const missing = [];
  for (const field of BRIEF_FIELDS.filter((candidate) => candidate.required)) {
    const value = fields[field.key];
    if (value === undefined || (Array.isArray(value) && !value.length)) missing.push({ field: field.key, question: field.ask });
  }
  if (!fields.concorrentes?.length && !fields.palavras_busca?.length) {
    missing.push({ field: "concorrentes", question: BRIEF_FIELDS.find((field) => field.key === "concorrentes").ask });
  }
  const budget = fields.verba === undefined ? null : parseMoney(fields.verba);
  if (fields.verba !== undefined && !(budget > 0)) problems.push({ field: "verba", value: fields.verba, problem: "Não entendi a verba diária: escreva só o valor em reais, como R$ 50." });
  const cost = fields.custo_evento === undefined ? null : parseMoney(fields.custo_evento);
  if (fields.custo_evento !== undefined && !(cost > 0)) problems.push({ field: "custo_evento", value: fields.custo_evento, problem: "Não entendi o custo por evento: escreva só o valor em reais, como R$ 45." });
  if (fields.pagina !== undefined && !/^(?:https?:\/\/)?[\w-]+(?:\.[\w-]+)+(?:[/?#].*)?$/i.test(fields.pagina)) {
    problems.push({ field: "pagina", value: fields.pagina, problem: "A página de destino precisa ser um endereço, como https://www.exemplo.com.br/oferta." });
  }
  let readsName = null;
  if (fields.nome_lido !== undefined) {
    readsName = YES.test(fold(fields.nome_lido)) ? true : NO.test(fold(fields.nome_lido)) ? false : null;
    if (readsName === null) problems.push({ field: "nome_lido", value: fields.nome_lido, problem: "Responda sim ou não: o site lê o nome do anúncio?" });
  }
  if (readsName && !fields.padrao_nome) missing.push({ field: "padrao_nome", question: BRIEF_FIELDS.find((field) => field.key === "padrao_nome").ask });
  const pattern = fields.padrao_nome ? normalizePattern(fields.padrao_nome) : null;
  if (fields.padrao_nome && !pattern.ok) problems.push({ field: "padrao_nome", value: fields.padrao_nome, problem: pattern.problem });
  const forbidden = (fields.termos_proibidos ?? []).filter((term) => !/^(?:nenhum|nenhuma|nada|nao ha|não há)$/i.test(fold(term)));
  const brief = {
    ...fields,
    verba_diaria: budget,
    custo_por_evento: cost,
    le_nome: readsName,
    padrao: readsName && pattern?.ok ? pattern.pattern : DEFAULT_NAME_PATTERN,
    termos: forbidden,
    pais: countryCode(fields.pais),
  };
  return { brief, missing, problems, unknown, complete: !missing.length && !problems.length };
}

/** "<Ângulo>-<formato>-<gancho>-v<n>" → "<angulo>-<formato>-<gancho>-v<n>", with every token known. */
export function normalizePattern(text) {
  const pattern = fold(text).replace(/\s+/g, "");
  const tokens = [...pattern.matchAll(/<([^>]+)>/g)].map((match) => match[1]);
  const unknownToken = tokens.find((token) => !NAME_TOKENS.includes(token));
  if (!tokens.length) return { ok: false, problem: "O padrão precisa de partes entre < e >, como <ângulo>-<formato>-v<n>." };
  if (unknownToken) return { ok: false, problem: `Não conheço a parte <${unknownToken}>. As partes são: <ângulo>, <conceito>, <formato>, <gancho> e <n> (o número da versão).` };
  if (!/^[a-z0-9<>-]+$/.test(pattern)) return { ok: false, problem: "O padrão só pode ter letras sem acento, números, hífens e as partes entre < e >." };
  return { ok: true, pattern };
}

const COUNTRIES = { brasil: "BR", br: "BR", portugal: "PT", pt: "PT", "estados unidos": "US", eua: "US", us: "US", mexico: "MX", mx: "MX", argentina: "AR", ar: "AR", angola: "AO", mocambique: "MZ" };

export function countryCode(text) {
  if (!text) return "BR";
  const folded = fold(text);
  if (COUNTRIES[folded]) return COUNTRIES[folded];
  return /^[a-z]{2}$/.test(folded) ? folded.toUpperCase() : "BR";
}

/** The host of an address ("https://www.exemplo.com.br/oferta" → "exemplo.com.br"), or null. */
export function hostOf(address) {
  if (!address) return null;
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(address) ? address : `https://${address}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
