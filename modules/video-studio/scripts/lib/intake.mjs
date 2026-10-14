// The brief of a video, decided without any AI: how complete the request is, which questions are
// still worth asking (and in which round), what each answer changes, the defaults, what the site
// of the brand adds, the one-line plan, the complete brief written back, and the next step of the
// video's life. Every function is pure: the state goes in, a new state or a text comes out; the
// clock comes from the caller and nothing is written to disk. The question texts live in
// references/perguntas.json; the reading of the request lives in lib/request.mjs.

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BUSINESS_NOUNS,
  capitalize,
  clean,
  clip,
  DESTINATIONS,
  detectDestinations,
  detectDuration,
  detectMusic,
  detectObjective,
  detectStyle,
  detectTemplate,
  detectTone,
  DURATION,
  FIELDS,
  findHandles,
  findUrls,
  fold,
  hostOf,
  LIMITS,
  numberIn,
  OBJECTIVES,
  parseRequest,
  shortenWords,
  STYLES,
  TEMPLATES,
  TONES,
  wordCount,
} from "./request.mjs";
import { AppError, isFile, requireJson, round, slugify } from "./util.mjs";

export { DESTINATIONS, FIELDS, OBJECTIVES, STYLES, TEMPLATES, TONES };

/** The command line every `next_step.command` starts with, when the caller does not give another. */
export const SCRIPT_COMMAND = "node .flyee/modules/video-studio/scripts/studio.mjs";
export const STAGES = ["round1", "round2", "round3", "confirm", "brief", "preview"];
export const SOURCES = ["pedido", "resposta", "captura", "marca", "projeto", "inferido", "padrao"];
export const GENERAL_SUBJECT = "marca em geral";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const INSTALL_SELF = "npx --yes flyee@latest add video-studio --yes --json";
const ROUND_STAGES = ["round1", "round2", "round3"];
const FROM_MEMBER = ["pedido", "resposta"];
const TEMPLATE_BY_OBJECTIVE = { apresentar: "lancamento", lancar: "lancamento", portfolio: "lancamento", vender: "oferta", explicar: "lista" };
const OBJECTIVE_BY_TEMPLATE = { lancamento: "apresentar", interface: "explicar", oferta: "vender", lista: "explicar" };
const TONE_BY_OBJECTIVE = { vender: "vontade", portfolio: "surpresa" };
const MUSIC_BY_TONE = { confianca: "clean", vontade: "energetic", surpresa: "energetic", proximidade: "playful" };
const SECOND_LEVEL = /^(com|net|org|gov|edu|co|art|blog|eco|ind|adv|eng|med|odo|psc|tur|inf|imb|far|vet|esp)$/;

const clone = (value) => structuredClone(value);
const lowerFirst = (text) => (text ? text.charAt(0).toLowerCase() + text.slice(1) : text);
const sentence = (text) => {
  const flat = clean(text);
  return flat ? (/[.!?…]$/.test(flat) ? capitalize(flat) : `${capitalize(flat)}.`) : "";
};

// ---------------------------------------------------------------------------
// The app's own data: the question bank and the story templates
// ---------------------------------------------------------------------------

const missingData = (message) => new AppError("runtime_missing", message, `Reinstale o app: ${INSTALL_SELF}, depois repita.`);

function checkBank(bank) {
  const problems = [];
  if (!bank || typeof bank !== "object" || Array.isArray(bank)) return ["o arquivo não é um objeto"];
  if (bank.format_version !== 1) problems.push("format_version precisa ser 1");
  if (!Array.isArray(bank.questions) || !bank.questions.length) return [...problems, "falta a lista questions"];
  if (!Array.isArray(bank.rounds) || !bank.rounds.length) problems.push("falta a lista rounds");
  if (!Array.isArray(bank.partial?.priority)) problems.push("falta partial.priority");
  const seen = new Set();
  for (const question of bank.questions) {
    const id = question?.id;
    if (typeof id !== "string" || !id) {
      problems.push("há uma pergunta sem id");
      continue;
    }
    if (seen.has(id)) problems.push(`a pergunta ${id} aparece duas vezes`);
    seen.add(id);
    if (!STAGES.includes(question.stage)) problems.push(`${id}: stage desconhecido`);
    if (question.field !== null && !FIELDS.includes(question.field)) problems.push(`${id}: field desconhecido`);
    if (typeof question.header !== "string" || !question.header || question.header.length > 12) problems.push(`${id}: header precisa ter de 1 a 12 caracteres`);
    if (typeof question.text !== "string" || !question.text.trim()) problems.push(`${id}: falta o texto`);
    if (!Array.isArray(question.options)) problems.push(`${id}: options precisa ser uma lista`);
    for (const option of [...(question.options ?? []), ...(question.variants ?? []).flatMap((variant) => variant.options ?? [])]) {
      if (!option || typeof option !== "object" || typeof option.label !== "string" || (!option.from && typeof option.value !== "string")) problems.push(`${id}: opção sem label ou sem value`);
    }
  }
  for (const id of bank.partial?.priority ?? []) if (!seen.has(id)) problems.push(`partial.priority cita ${id}, que não existe`);
  return problems;
}

/** Reads and checks references/perguntas.json of the app in `appDir`. */
export function loadBank(appDir = APP_DIR) {
  const file = join(appDir, "references", "perguntas.json");
  if (!isFile(file)) throw missingData("Falta um arquivo do app Estúdio de vídeo: references/perguntas.json.");
  const bank = requireJson(file, "o arquivo de perguntas do app");
  const problems = checkBank(bank);
  if (problems.length) throw missingData(`O arquivo de perguntas do app Estúdio de vídeo está incompleto: ${problems.slice(0, 3).join("; ")}.`);
  return bank;
}

/** Reads references/roteiros.json of the app in `appDir`: the four story templates. */
export function loadTemplates(appDir = APP_DIR) {
  const file = join(appDir, "references", "roteiros.json");
  if (!isFile(file)) throw missingData("Falta um arquivo do app Estúdio de vídeo: references/roteiros.json.");
  const data = requireJson(file, "o arquivo de roteiros do app");
  if (!data || typeof data !== "object" || !data.templates || typeof data.templates !== "object") throw missingData("O arquivo de roteiros do app Estúdio de vídeo está incompleto: falta templates.");
  return data;
}

let ownBankCache = null;
let ownTemplatesCache = null;
/** The bank and the templates that ship next to this file, for the functions the caller does not hand them to. */
const ownBank = () => (ownBankCache ??= loadBank(APP_DIR));
const ownTemplates = () => (ownTemplatesCache ??= loadTemplates(APP_DIR));
const specsOf = (templates) => (templates?.templates && typeof templates.templates === "object" ? templates.templates : (templates ?? ownTemplates().templates));
const questionOf = (bank, id) => bank.questions.find((question) => question.id === id) ?? null;

// ---------------------------------------------------------------------------
// Reading the state
// ---------------------------------------------------------------------------

const entryOf = (state, field) => (field ? (state?.fields?.[field] ?? null) : null);
const valueOf = (state, field) => entryOf(state, field)?.value;
/** Where a field came from. `by` is who chose a value that happens to be the default (the brand as a whole). */
const sourceOf = (state, field) => {
  const entry = entryOf(state, field);
  return entry ? (entry.by ?? entry.source ?? null) : null;
};

function setField(state, field, value, source, evidence = "", extra = {}) {
  state.fields[field] = { value, source, evidence: clip(evidence, 120), ...extra };
}

function shape(state) {
  state.fields = state.fields && typeof state.fields === "object" ? state.fields : {};
  for (const key of ["asked", "rounds", "answers", "unsupported", "history"]) if (!Array.isArray(state[key])) state[key] = [];
  state.brand = { slug: null, kit: null, found_by: null, confirmed: false, ...(state.brand && typeof state.brand === "object" ? state.brand : {}) };
  state.approvals = { brief: null, preview: null, ...(state.approvals && typeof state.approvals === "object" ? state.approvals : {}) };
  return state;
}

const ACCENTED = { clinica: "clínica", agencia: "agência", farmacia: "farmácia", imobiliaria: "imobiliária", otica: "ótica", estudio: "estúdio", salao: "salão", escritorio: "escritório", consultorio: "consultório", atelie: "ateliê", espaco: "espaço", cafe: "café", brecho: "brechó", emporio: "empório", laboratorio: "laboratório", negocio: "negócio", servico: "serviço" };

/** What is known of the brand, from the brief and from the site: names, addresses and how to speak of it. */
function brandOf(state, kit = null) {
  const entry = entryOf(state, "brand");
  const value = entry?.value && typeof entry.value === "object" ? entry.value : {};
  const site = kit ?? state?.candidates ?? null;
  const none = Boolean(entry) && !value.name && !value.site && !value.handle;
  const said = clean(value.name);
  const name = none ? null : (FROM_MEMBER.includes(entry?.source) && said) || clean(site?.name) || said || null;
  const address = none ? null : (value.site ?? site?.site ?? null);
  const host = none ? null : ((address ? hostOf(address) : null) ?? site?.host ?? null);
  const handle = none ? null : (value.handle ?? site?.handle ?? null);
  const head = name ? fold(name.split(" ")[0]) : null;
  const noun = value.noun ?? (head && BUSINESS_NOUNS[head] ? head : null);
  const article = value.article ?? (noun ? BUSINESS_NOUNS[noun] : null);
  return {
    entry,
    none,
    has: !none && Boolean(name || address || handle || host),
    name,
    site: address,
    host,
    handle,
    article,
    noun,
    shown: name ?? host ?? handle ?? null,
  };
}

/** "a loja", "o estúdio", or "a marca" when the name does not say what the business is. */
function businessOf(brand) {
  if (!brand.has) return "o tema";
  if (!brand.noun) return "a marca";
  return `${BUSINESS_NOUNS[brand.noun] ?? "a"} ${ACCENTED[brand.noun] ?? brand.noun}`;
}

/** "da Loja X (lojax.com.br)", "do Notion", "da marca Aurora", "para lojax.com.br". */
function ofBrand(brand, { withHost = true } = {}) {
  if (!brand.has) return "";
  if (brand.name) {
    const lead = brand.article ? `d${brand.article} ${brand.name}` : `da marca ${brand.name}`;
    return withHost && brand.host ? `${lead} (${brand.host})` : lead;
  }
  const address = brand.host ?? brand.handle;
  return brand.article && brand.host ? `d${brand.article} ${address}` : `para ${address}`;
}

const SECOND_PERSON = { meu: "seu", minha: "sua", meus: "seus", minhas: "suas", nosso: "seu", nossa: "sua", nossos: "seus", nossas: "suas" };
/** "meu aplicativo de agenda" → "seu aplicativo de agenda": the app speaks to the member. */
const toSecondPerson = (text) => String(text ?? "").replace(/(?<![\p{L}\p{N}])(meus|minhas|nossos|nossas|meu|minha|nosso|nossa)(?![\p{L}\p{N}])/giu, (match) => SECOND_PERSON[match.toLowerCase()] ?? match);

const SUBJECT_GENDER = { promocao: "a", colecao: "a", linha: "a", oferta: "a", liquidacao: "a", novidade: "a", campanha: "a", mentoria: "a", aula: "a", temporada: "a", edicao: "a", curso: "o", produto: "o", servico: "o", evento: "o", plano: "o", pacote: "o", kit: "o", cardapio: "o", aplicativo: "o", app: "o", ebook: "o", livro: "o", workshop: "o", webinar: "o", desconto: "o", combo: "o", menu: "o", catalogo: "o", sorteio: "o", lancamento: "o" };
const LIST_NOUN = /^(?:dicas|erros|passos|motivos|razoes|mitos|segredos|sinais|ideias|truques|habitos|perguntas|maneiras|jeitos|formas|verdades|licoes|regras)\b/;

/** The subject as the app says it back: in the second person and with the article a noun asks for. */
function subjectPhrase(subject) {
  const text = toSecondPerson(clean(subject)).replace(/[.]+$/, "");
  if (!text) return "";
  const low = fold(text);
  if (/^(?:o|a|os|as|um|uma|seu|sua|seus|suas|este|esta|esse|essa)\s/.test(low) || /^\p{Lu}/u.test(text) || /^\d/.test(text)) return text;
  const gender = SUBJECT_GENDER[low.split(/[\s:]/)[0]];
  return gender ? `${gender} ${text}` : text;
}

const specificSubject = (state) => {
  const value = valueOf(state, "subject");
  return typeof value === "string" && clean(value) && fold(value) !== GENERAL_SUBJECT ? clean(value) : null;
};

/**
 * The style field read one way: `id` is the named style (or null), `reference` the video the member
 * pointed at ({ url, description }) or null. The field holds a named style, or, while a reference is
 * still being described, `{ reference, description, base }`; fillDefaults turns that into the named
 * style it resolves to and keeps the reference beside it.
 */
function styleInfo(entry) {
  if (!entry) return { id: null, reference: null };
  const value = entry.value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { id: STYLES.includes(value.base) ? value.base : null, reference: { url: value.reference ?? null, description: clean(value.description) || null } };
  }
  const reference = entry.reference && typeof entry.reference === "object" ? { url: entry.reference.url ?? null, description: clean(entry.reference.description) || null } : null;
  return { id: STYLES.includes(value) ? value : null, reference };
}

/** The brand has screens to show: a site (or a saved kit), not only a name. */
const hasScreens = (state, kit = null) => Boolean(brandOf(state, kit).host) || hasKit(state, kit);

/** What the brief resolves to before every default is written: the objective, the story, the tone, the time. */
function effective(state, templates = null) {
  const objective = OBJECTIVES.includes(valueOf(state, "objective")) ? valueOf(state, "objective") : "apresentar";
  const template = TEMPLATES.includes(valueOf(state, "template")) ? valueOf(state, "template") : (TEMPLATE_BY_OBJECTIVE[objective] ?? "lancamento");
  const tone = TONES.includes(valueOf(state, "tone")) ? valueOf(state, "tone") : (TONE_BY_OBJECTIVE[objective] ?? "confianca");
  const duration = Number.isFinite(Number(valueOf(state, "duration"))) && valueOf(state, "duration") !== null && valueOf(state, "duration") !== undefined ? Number(valueOf(state, "duration")) : objective === "vender" ? 20 : 15;
  const spec = specsOf(templates)?.[template] ?? {};
  let fallbackStyle = STYLES.includes(spec.default_style) ? spec.default_style : STYLES[0];
  // real screens tell the story only when there is a site to take them from
  if (fallbackStyle === "interface-narra" && !hasScreens(state)) fallbackStyle = "tipografia-cinetica";
  const style = styleInfo(entryOf(state, "style")).id ?? fallbackStyle;
  return { objective, template, tone, duration, style, recommendedStyle: fallbackStyle, spec };
}

const isRouteMismatch = (state) => (state.unsupported ?? []).some((item) => item?.kind === "edit" || item?.kind === "generated");

// ---------------------------------------------------------------------------
// A new video
// ---------------------------------------------------------------------------

/** The folder name of a brand: the address without its ending ("lojax.com.br" → "lojax"), else the name. */
function brandSlug({ name = null, site = null, handle = null } = {}) {
  const host = site ? hostOf(site) : null;
  if (host && /[a-z]/i.test(host) && !/^localhost\b/i.test(host)) {
    const parts = host.replace(/:\d+$/, "").split(".").filter(Boolean);
    if (parts.length >= 2) {
      parts.pop();
      if (parts.length >= 2 && SECOND_LEVEL.test(parts[parts.length - 1])) parts.pop();
      const slug = slugify(parts.join("-"), 40);
      if (slug && slug !== "video") return slug;
    }
  }
  if (clean(name)) return slugify(name, 40);
  if (clean(handle)) return slugify(String(handle).replace(/^@/, ""), 40);
  return null;
}

const sameBrand = (kit, { name = null, site = null } = {}) => {
  const host = site ? hostOf(site) : null;
  const kitHost = kit?.site ? hostOf(kit.site) : null;
  if (host && kitHost) return host === kitHost;
  return Boolean(clean(name)) && Boolean(clean(kit?.name)) && slugify(name, 40) === slugify(kit.name, 40);
};

/** Templates are derived from a stated objective and objectives from a stated story; never one default from another. */
function derive(state) {
  const objective = entryOf(state, "objective");
  const template = entryOf(state, "template");
  const stated = (entry) => Boolean(entry) && FROM_MEMBER.includes(entry.source);
  const open = (entry) => !entry || entry.source === "inferido";
  if (stated(objective) && open(template) && TEMPLATE_BY_OBJECTIVE[objective.value]) {
    setField(state, "template", TEMPLATE_BY_OBJECTIVE[objective.value], "inferido", `pelo objetivo (${objective.evidence || objective.value})`);
  } else if (stated(template) && open(objective) && OBJECTIVE_BY_TEMPLATE[template.value]) {
    setField(state, "objective", OBJECTIVE_BY_TEMPLATE[template.value], "inferido", `pela história pedida (${template.evidence || template.value})`);
  }
}

function measure(state) {
  const present = state.signals?.present ?? { story: [], style: [] };
  const atIntake = (field) => ["pedido", "projeto", "marca", "inferido"].includes(sourceOf(state, field));
  const brand = atIntake("brand");
  const objective = atIntake("objective");
  const subject = atIntake("subject");
  let sufficiency = "vazio";
  if (brand && objective && subject && present.story.length >= 2) sufficiency = "completo";
  else if (brand && (objective || subject) && present.story.length >= 1) sufficiency = "parcial";
  return { sufficiency, mode: { completo: "complete", parcial: "partial", vazio: "guided" }[sufficiency] };
}

/**
 * The state of a new video (the `pedido.json` object) from the literal request. `project` is what
 * the member's own project says about the brand: `{ site, kits: [{ slug, name, site }] }`.
 */
export function newState({ request, slug = null, appVersion = "1.0.0", now = null, project = {} } = {}) {
  const text = String(request ?? "").replace(/^\uFEFF/, "");
  if (!text.trim()) throw new AppError("request_empty", "O pedido está vazio.", "Grave no arquivo do pedido o que o integrante escreveu, palavra por palavra, e repita.");
  const parsed = parseRequest(text);
  const state = shape({
    format_version: 1,
    app: { name: "video-studio", version: appVersion },
    slug: null,
    created_at: now,
    updated_at: now,
    request: text,
    route: "motion",
    unsupported: [],
    signals: parsed.signals,
    sufficiency: "vazio",
    mode: "guided",
    fields: {},
    asked: [],
    rounds: [],
    answers: [],
    brand: { slug: null, kit: null, found_by: null, confirmed: false },
    approvals: { brief: null, preview: null },
    status: "intake",
    next_step: null,
    history: [],
    files: { kit: false, roteiro: false, preview: false, final: false },
  });
  for (const [name, entry] of Object.entries(parsed.fields)) state.fields[name] = { ...entry };
  if (fold(valueOf(state, "subject")) === GENERAL_SUBJECT) state.fields.subject = { ...state.fields.subject, source: "padrao", by: "pedido" };

  // the brand: what the request says first, then what the project already keeps
  const kits = (Array.isArray(project?.kits) ? project.kits : []).filter((kit) => kit && typeof kit === "object");
  const asked = state.fields.brand?.value ?? null;
  if (asked) {
    const none = !asked.name && !asked.site && !asked.handle;
    const kit = none ? null : kits.find((item) => sameBrand(item, asked));
    if (kit && !asked.site && kit.site) asked.site = kit.site;
    state.brand = { slug: kit?.slug ?? brandSlug(asked), kit: null, found_by: none ? null : asked.site ? "pedido" : "busca", confirmed: none || Boolean(asked.site) };
  } else if (kits.length === 1) {
    setField(state, "brand", { name: kits[0].name ?? null, site: kits[0].site ?? null, handle: kits[0].handle ?? null }, "marca", `marca guardada neste projeto: ${kits[0].name ?? kits[0].slug}`);
    state.brand = { slug: kits[0].slug ?? brandSlug(kits[0]), kit: null, found_by: "projeto", confirmed: true };
  } else if (kits.length > 1) {
    const match = project?.site ? kits.find((kit) => sameBrand(kit, { site: project.site })) : null;
    if (match) {
      setField(state, "brand", { name: match.name ?? null, site: match.site ?? null, handle: match.handle ?? null }, "marca", `marca guardada neste projeto: ${match.name ?? match.slug}`);
      state.brand = { slug: match.slug ?? brandSlug(match), kit: null, found_by: "projeto", confirmed: true };
    } else {
      state.brand.candidates = [
        ...kits.slice(0, 3).map((kit) => ({ key: `marca:${kit.slug}`, name: kit.name ?? null, site: kit.site ?? null, slug: kit.slug ?? null, from: "marca" })),
        ...(project?.site && kits.length < 3 ? [{ key: project.site, name: null, site: project.site, slug: null, from: "projeto" }] : []),
      ];
    }
  } else if (project?.site) {
    setField(state, "brand", { name: null, site: project.site, handle: null }, "projeto", `site do seu projeto: ${hostOf(project.site) ?? project.site}`);
    state.brand = { slug: brandSlug({ site: project.site }), kit: null, found_by: "projeto", confirmed: true };
  }

  derive(state);
  // what the request itself brings of the story and of the style, measured once
  const story = [];
  if (parsed.fields.template || state.fields.template?.source === "inferido") story.push("template");
  if (parsed.fields.points || parsed.signals.directions?.points) story.push("points");
  if (parsed.fields.hook || parsed.signals.directions?.hook) story.push("hook");
  state.signals = { ...parsed.signals, present: { story, style: ["tone", "style", "closing"].filter((field) => Boolean(parsed.fields[field])) } };
  // a request that brings its own story and names no product is about the brand as a whole
  if (!state.fields.subject && story.length >= 2 && state.fields.brand && brandOf(state).has) {
    setField(state, "subject", GENERAL_SUBJECT, "padrao", "o pedido já traz a história, sem um produto específico", { by: "inferido" });
  }

  let messages = {};
  try {
    messages = ownBank().unsupported ?? {};
  } catch {
    messages = {};
  }
  state.unsupported = parsed.unsupported.map((item) => (typeof messages[item.kind] === "string" ? { ...item, message: messages[item.kind] } : { ...item }));

  Object.assign(state, measure(state));
  state.slug = clean(slug) ? slugify(slug, 40) : slugFor(state);
  try {
    state.next_step = nextStep(state, { scriptCommand: SCRIPT_COMMAND });
  } catch {
    state.next_step = null;
  }
  return state;
}

/**
 * How complete the request was: `completo` (nothing to ask), `parcial` (a round of at most three
 * questions) or `vazio` (the guided brief). Measured once, when the video is created; `missing`
 * follows the answers.
 */
export function assess(state) {
  const fields = state?.fields ?? {};
  const present = state?.signals?.present ?? {
    story: ["template", "points", "hook"].filter((field) => fields[field]?.source === "pedido" || (field === "template" && fields.template?.source === "inferido" && fields.objective?.source === "pedido")),
    style: ["tone", "style", "closing"].filter((field) => fields[field]?.source === "pedido"),
  };
  const view = state?.signals?.present ? state : { ...state, signals: { ...(state?.signals ?? {}), present } };
  const measured = ["vazio", "parcial", "completo"].includes(state?.sufficiency) && ["guided", "partial", "complete"].includes(state?.mode) ? { sufficiency: state.sufficiency, mode: state.mode } : measure(view);
  return {
    sufficiency: measured.sufficiency,
    mode: measured.mode,
    missing: FIELDS.filter((field) => !fields[field] && field !== "skip_preview" && field !== "proof"),
    story_present: [...present.story],
    style_present: [...present.style],
  };
}

/** The folder name of the video: the brand and the kind of story ("lojax-lancamento"). */
export function slugFor(state) {
  const brand = brandOf(state);
  const who = (brand.has ? (state?.brand?.slug ?? brandSlug({ name: brand.name, site: brand.site, handle: brand.handle })) : null) ?? "video";
  const kind = TEMPLATES.includes(valueOf(state, "template")) ? valueOf(state, "template") : "animado";
  return slugify(`${who} ${kind}`, 40);
}

// ---------------------------------------------------------------------------
// What the site of the brand adds
// ---------------------------------------------------------------------------

const NOT_A_POINT = /^(?:contato|fale conosco|login|entrar|carrinho|minha conta|area d[oe]|blog|sobre(?: nos)?|quem somos|home|inicio|politica|termos|faq|perguntas frequentes|duvidas|depoimentos?|agend[ae]|compr[ae]|cadastr|newsletter|rodape|menu|siga|redes sociais|trabalhe conosco|ajuda|suporte|central de|nossos clientes|clientes)\b/;
const PROOF_LIKE = /clientes|pacientes|alunos|pedidos|usuarios|avaliac|atendid|vendid|entreg|estrelas|nota|satisf|aprova|recomend|%/;
/** A discount, a price or a payment condition is never the proof that something works. */
const NOT_PROOF = /\boff\b|desconto|cupom|frete|parcela|juros|r\$/;
const isProofLike = (text) => PROOF_LIKE.test(fold(text)) && !NOT_PROOF.test(fold(text));

const unique = (list) => {
  const seen = new Set();
  return list.filter((item) => {
    const key = fold(clean(item));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** What a video can show one by one: the headings of the site's sections, then the names of its products. */
function pointCandidates(site) {
  const sections = (Array.isArray(site?.sections) ? site.sections : []).map((item) => clean(item)).filter((item) => item && wordCount(item) <= 6 && !NOT_A_POINT.test(fold(item)));
  const products = (Array.isArray(site?.products) ? site.products : []).map((item) => clean(typeof item === "string" ? item : item?.name)).filter((item) => item && wordCount(item) <= 6);
  return unique([...sections, ...products]);
}

/** The published numbers, the ones that count people or satisfaction first: they are the ones that prove something. */
function numberCandidates(site) {
  const list = (Array.isArray(site?.numbers) ? site.numbers : []).filter((item) => item && clean(item.text) && !/\boff\b|desconto|cupom|r\$/.test(fold(item.text)));
  return [...list.filter((item) => isProofLike(item.text)), ...list.filter((item) => !isProofLike(item.text))];
}

function proofFrom(site, number) {
  const where = site?.host ?? (site?.site ? hostOf(site.site) : null) ?? "site da marca";
  const date = /^\d{4}-\d{2}-\d{2}/.test(String(site?.captured_at ?? "")) ? String(site.captured_at).slice(0, 10) : null;
  const page = clean(number.page) || "página inicial";
  return { text: clean(number.text), value: Number.isFinite(number.value) ? number.value : numberIn(number.text), source: `${where} (${page}${date ? `, ${date}` : ""})`, page };
}

/** Where a number shown in the brief came from, in a few plain words. */
function proofOrigin(proof) {
  if (!proof || /informad/.test(proof.source ?? "")) return "informado por você";
  if (proof.page) return `da ${proof.page} do site`;
  return proof.source ? `publicado em ${proof.source}` : "publicado no site";
}

const productNames = (site) => unique((Array.isArray(site?.products) ? site.products : []).map((item) => clean(typeof item === "string" ? item : item?.name)).filter(Boolean));

function newsOf(site) {
  const products = productNames(site);
  const fresh = unique([...(Array.isArray(site?.sections) ? site.sections : []), ...products].map((item) => clean(item))).find((item) => /\b(?:nov[oa]s?|novidades?|lancamentos?|chegou|estreia)\b/.test(fold(item)) && wordCount(item) <= 8 && fold(item) !== fold(products[0] ?? ""));
  return fresh ?? products[1] ?? null;
}

/** What the brief needs of a brand kit, kept in the state so the questions can be written again without the kit. */
function siteNotes(kit) {
  return {
    name: clean(kit.name) || null,
    site: kit.site ?? null,
    host: kit.host ?? (kit.site ? hostOf(kit.site) : null),
    handle: kit.handle ?? null,
    headline: clean(kit.headline) || null,
    sections: (Array.isArray(kit.sections) ? kit.sections : []).map((item) => clean(item)).filter(Boolean).slice(0, 12),
    products: (Array.isArray(kit.products) ? kit.products : []).filter((item) => item && clean(item.name ?? item)).map((item) => (typeof item === "string" ? { name: clean(item), price: null } : { name: clean(item.name), price: item.price ?? null })).slice(0, 12),
    numbers: (Array.isArray(kit.numbers) ? kit.numbers : []).filter((item) => item && clean(item.text)).map((item) => ({ text: clean(item.text), value: Number.isFinite(item.value) ? item.value : null, page: item.page ?? null })).slice(0, 8),
    social: { whatsapp: kit.social?.whatsapp ?? null, instagram: kit.social?.instagram ?? null },
    captured_at: kit.captured_at ?? null,
  };
}

const pointCount = (state, spec) => {
  const wanted = Number(state.signals?.directions?.points?.count) || 3;
  const repeat = (spec?.scenes ?? []).find((scene) => Array.isArray(scene.repeat))?.repeat ?? [2, LIMITS.points];
  return Math.max(Math.min(wanted, repeat[1], LIMITS.states), Math.min(repeat[0], 3));
};

/**
 * Brings the capture into the brief with source "captura": the name and the addresses of the
 * brand, the opening from the site's headline (at most six whole words), the points from its
 * sections and products, the proof from a published number, the ending from its address. What
 * the member said is never replaced.
 */
export function mergeKit(input, kit) {
  const state = shape(clone(input ?? {}));
  if (!kit || typeof kit !== "object" || Array.isArray(kit)) return state;
  const site = siteNotes(kit);
  state.candidates = site;
  state.files = { roteiro: false, preview: false, final: false, ...(state.files ?? {}), kit: true };
  const loose = (field) => !state.fields[field] || ["captura", "padrao"].includes(state.fields[field].source);

  const brand = state.fields.brand;
  const current = brand?.value && typeof brand.value === "object" ? brand.value : {};
  if (!brand) setField(state, "brand", { name: site.name, site: site.site, handle: site.handle }, "marca", `marca guardada: ${site.name ?? site.host ?? ""}`);
  else if (current.name || current.site || current.handle) brand.value = { ...current, name: current.name ?? site.name, site: current.site ?? site.site, handle: current.handle ?? site.handle };

  if (loose("hook")) {
    if (site.headline) setField(state, "hook", shortenWords(site.headline, LIMITS.hook_words), "captura", `título do site: “${clip(site.headline, 90)}”`);
    else if (state.fields.hook?.source === "captura") delete state.fields.hook;
  }
  if (loose("points")) {
    const points = pointCandidates(site).slice(0, pointCount(state, effective(state).spec));
    if (points.length) setField(state, "points", points, "captura", `seções e produtos de ${site.host ?? "seu site"}`);
    else if (state.fields.points?.source === "captura") delete state.fields.points;
  }
  if (loose("proof")) {
    const number = numberCandidates(site)[0];
    if (number) {
      const proof = proofFrom(site, number);
      setField(state, "proof", proof, "captura", `publicado em ${site.host ?? "seu site"} (${proof.page})`);
    } else if (state.fields.proof?.source === "captura") delete state.fields.proof;
  }
  if (!state.fields.closing || state.fields.closing.source === "captura") {
    if (site.host) setField(state, "closing", { kind: "site", text: site.host }, "captura", `endereço do site: ${site.host}`);
    else if (site.handle) setField(state, "closing", { kind: "perfil", text: site.handle }, "captura", `perfil da marca: ${site.handle}`);
  } else if (state.fields.closing.value && !state.fields.closing.value.text) {
    const text = { site: site.host, perfil: site.handle }[state.fields.closing.value.kind];
    if (text) state.fields.closing.value = { ...state.fields.closing.value, text };
  }
  return state;
}

/** The brand changed: what came from the site of the previous one leaves the brief. */
function dropCapture(state) {
  for (const [field, entry] of Object.entries(state.fields)) if (entry?.source === "captura") delete state.fields[field];
  delete state.candidates;
  if (state.files) state.files = { ...state.files, kit: false };
  state.brand = { ...state.brand, kit: null };
}

/**
 * Gives every empty field its default: "padrao" for a choice of the app, "captura" for what
 * comes from the site. Nothing is invented: without a published number there is no proof, and
 * without a site or a list from the member the points stay empty.
 */
export function fillDefaults(input, templates = null, { kit = null } = {}) {
  const state = shape(clone(input ?? {}));
  const specs = specsOf(templates);
  const site = kit ? siteNotes(kit) : (state.candidates ?? null);
  const empty = (field) => !state.fields[field];

  if (empty("brand") && site && (site.name || site.site)) setField(state, "brand", { name: site.name, site: site.site, handle: site.handle }, "marca", `marca guardada: ${site.name ?? site.host ?? ""}`);
  if (empty("objective")) setField(state, "objective", "apresentar", "padrao", "o objetivo mais comum");
  if (empty("subject")) setField(state, "subject", GENERAL_SUBJECT, "padrao", "sem um produto específico");
  if (empty("destinations")) setField(state, "destinations", [...DESTINATIONS], "padrao", "o mesmo vídeo serve para os três");
  const objective = valueOf(state, "objective");
  if (empty("duration")) setField(state, "duration", objective === "vender" ? 20 : 15, "padrao", objective === "vender" ? "uma oferta pede mais fôlego" : "o tamanho mais comum");
  if (empty("template")) setField(state, "template", TEMPLATE_BY_OBJECTIVE[objective] ?? "lancamento", "padrao", `o roteiro que combina com o objetivo (${objective})`);
  const view = effective(state, templates);
  const spec = specs?.[view.template] ?? {};
  const brand = brandOf(state, kit);

  if (empty("points")) {
    const points = pointCandidates(site).slice(0, pointCount(state, spec));
    if (points.length) setField(state, "points", points, "captura", `seções e produtos de ${site?.host ?? "seu site"}`);
    else setField(state, "points", [], "padrao", "sem o site e sem uma lista sua, os pontos ficam por dizer");
  }
  if (empty("hook")) {
    const subject = specificSubject(state);
    if (site?.headline) setField(state, "hook", shortenWords(site.headline, LIMITS.hook_words), "captura", `título do site: “${clip(site.headline, 90)}”`);
    else if (subject && wordCount(productOf(subject)) <= LIMITS.hook_words) setField(state, "hook", productOf(subject), "padrao", "o assunto do vídeo, por falta de um título");
    else if (brand.name && wordCount(brand.name) <= LIMITS.hook_words) setField(state, "hook", brand.name, "padrao", "o nome da marca, por falta de um título");
  }
  if (empty("proof")) {
    const number = numberCandidates(site)[0];
    if (number) {
      const proof = proofFrom(site, number);
      setField(state, "proof", proof, "captura", `publicado em ${site?.host ?? "seu site"} (${proof.page})`);
    } else setField(state, "proof", null, "padrao", "nenhum número publicado: o vídeo não mostra número");
  }
  if (empty("tone")) setField(state, "tone", TONE_BY_OBJECTIVE[objective] ?? "confianca", "padrao", `o tom que combina com o objetivo (${objective})`);
  const tone = valueOf(state, "tone");
  if (empty("style")) setField(state, "style", view.recommendedStyle, "padrao", `o estilo do roteiro (${spec.label ?? view.template})`);
  else if (!STYLES.includes(valueOf(state, "style"))) {
    const info = styleInfo(state.fields.style);
    state.fields.style = { ...state.fields.style, value: info.id ?? view.recommendedStyle, ...(info.reference ? { reference: info.reference } : {}) };
  }
  const musicStyle = MUSIC_BY_TONE[tone] ?? spec.music_style ?? "clean";
  if (empty("music")) setField(state, "music", { mode: "music", style: musicStyle, file: null, effects: true }, "padrao", "trilha original, feita na batida do vídeo");
  else {
    const music = valueOf(state, "music") && typeof valueOf(state, "music") === "object" ? valueOf(state, "music") : { mode: "music" };
    const mode = ["music", "synth", "file", "none"].includes(music.mode) ? music.mode : "music";
    state.fields.music = { ...state.fields.music, value: { mode, style: mode === "music" || mode === "synth" ? (music.style ?? musicStyle) : null, file: music.file ?? null, effects: music.effects !== false } };
  }
  const fallbackClosing = brand.host ? { kind: "site", text: brand.host } : brand.handle ? { kind: "perfil", text: brand.handle } : { kind: "bio", text: "Link na bio" };
  if (empty("closing")) setField(state, "closing", fallbackClosing, "padrao", brand.host ? "o logo com o endereço do site" : brand.handle ? "o logo com o perfil" : "uma chamada simples");
  else {
    const closing = valueOf(state, "closing") && typeof valueOf(state, "closing") === "object" ? valueOf(state, "closing") : {};
    if (!clean(closing.text)) {
      const text = { site: brand.host, perfil: brand.handle, whatsapp: "Chama no WhatsApp", bio: "Link na bio" }[closing.kind];
      state.fields.closing = { ...state.fields.closing, value: text ? { kind: closing.kind, text } : fallbackClosing };
    }
  }
  if (empty("skip_preview")) setField(state, "skip_preview", false, "padrao", "a prévia é mostrada antes do vídeo final");
  return state;
}

// ---------------------------------------------------------------------------
// The questions
// ---------------------------------------------------------------------------

const NUMBER_NAMES = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"];
const FEMININE_NAMES = { 1: "uma", 2: "duas" };
const LETTERS = "abcdefghijklmnop";

const closedIds = (state) => new Set((state.answers ?? []).map((answer) => answer?.id).filter(Boolean));
const lastAnswer = (state, id) => [...(state.answers ?? [])].reverse().find((answer) => answer?.id === id) ?? null;
const hasKit = (state, kit) => Boolean(kit) || state.files?.kit === true || Boolean(state.candidates);
const captureFailed = (state) => state.capture?.failed === true || state.brand?.capture === "failed";

/** The brand still has a site to visit (or a site to find): what depends on it waits. */
function needsCapture(state, kit = null) {
  const brand = brandOf(state);
  if (!brand.entry || brand.none || hasKit(state, kit) || captureFailed(state)) return false;
  if (brand.site) return true;
  return state.brand?.found_by === "busca";
}

/** A brand found by search and captured, still waiting for the member's yes: the questions built on its site wait too. */
function awaitsConfirmation(state, kit = null) {
  return state.brand?.found_by === "busca" && !state.brand?.confirmed && brandOf(state, kit).has && hasKit(state, kit);
}

/** Questions belong to the brief: once it is approved, or once the video is being made, changes come as answers. */
function isPastBrief(state) {
  return Boolean(state.approvals?.brief) || state.files?.roteiro === true || ["build", "preview", "final", "delivered"].includes(state.status);
}

function isEligible(question, state) {
  const when = question.ask_when ?? {};
  if (Array.isArray(when.story) && !when.story.includes(effective(state).template)) return false;
  if (when.answer && typeof when.answer === "object") {
    for (const [id, values] of Object.entries(when.answer)) {
      const last = lastAnswer(state, id);
      if (!last || !values.includes(last.value)) return false;
    }
  }
  if (when.style === "reference_without_description") {
    const { reference } = styleInfo(entryOf(state, "style"));
    if (!reference || reference.description) return false;
  }
  return true;
}

function isOpen(question, state, mode) {
  if (closedIds(state).has(question.id) || !isEligible(question, state)) return false;
  const sources = Array.isArray(question.skip_when?.sources) ? question.skip_when.sources : FROM_MEMBER;
  const source = sourceOf(state, question.field);
  if (source && (sources.includes(source) || (mode === "partial" && source === "inferido"))) return false;
  return true;
}

/** The round to ask now: `{ n, stage, title, ids }`; `{ wait: "capture" }` when the site comes first; null when nothing is pending. */
function pendingPlan(state, bank, kit = null) {
  const mode = ["guided", "partial", "complete"].includes(state.mode) ? state.mode : assess(state).mode;
  if (mode === "complete" || isPastBrief(state)) return null;
  const limits = { per_round: 4, total: 12, partial: 3, ...(bank.limits ?? {}) };
  const waiting = needsCapture(state, kit) || awaitsConfirmation(state, kit);
  if (mode === "partial") {
    const recorded = (state.rounds ?? []).find((entry) => entry?.n === 1);
    const questions = (recorded ? recorded.ids ?? [] : bank.partial.priority).map((id) => questionOf(bank, id)).filter((question) => question && isOpen(question, state, mode));
    const ids = (recorded ? questions : questions.slice(0, limits.partial)).map((question) => question.id);
    if (!ids.length) return null;
    if (!recorded && waiting && ids.some((id) => questionOf(bank, id).waits_for_capture)) return { wait: "capture", ids };
    return { n: 1, stage: "partial", title: bank.partial.title ?? "Antes de começar", ids };
  }
  const isMain = (id) => {
    const question = questionOf(bank, id);
    return Boolean(question) && ROUND_STAGES.includes(question.stage) && !question.follow_up_of;
  };
  const shown = new Set([...(state.asked ?? []), ...closedIds(state)].filter(isMain));
  for (const round of [...bank.rounds].sort((a, b) => a.n - b.n)) {
    const open = bank.questions.filter((question) => question.stage === round.stage && isOpen(question, state, mode));
    if (!open.length) continue;
    if (round.n > 1 && waiting) return { wait: "capture", ids: open.map((question) => question.id) };
    if (state.decide_all) {
      const context = contextOf(state, bank, { kit });
      const needed = open.filter((question) => question.decide === "keep_open" && !hasDefault(renderQuestion(question, context)));
      if (!needed.length) continue;
      return { n: round.n, stage: round.stage, title: round.title, ids: needed.slice(0, limits.per_round).map((question) => question.id) };
    }
    const main = open.filter((question) => !question.follow_up_of);
    const follow = open.filter((question) => question.follow_up_of);
    const budget = limits.total - [...shown].filter((id) => !main.some((question) => question.id === id)).length;
    const ids = [...main.slice(0, Math.max(0, Math.min(limits.per_round, budget))), ...follow].slice(0, limits.per_round).map((question) => question.id);
    if (!ids.length) continue;
    return { n: round.n, stage: round.stage, title: round.title, ids };
  }
  return null;
}

const hasDefault = (question) => question.default !== null && question.default !== undefined && !(Array.isArray(question.default) && !question.default.length);

function fillText(text, vars) {
  let missing = false;
  const out = String(text ?? "").replace(/\{([^{}]+)\}/g, (match, name) => {
    const value = vars[name.trim()];
    if (value === undefined || value === null || value === "") {
      missing = true;
      return match;
    }
    return String(value);
  });
  return { text: out, missing };
}

/** What the questions may mention: the brand, the site's finds, the recommended story and style. */
function contextOf(state, bank, { kit = null, templates = null, vars = {} } = {}) {
  const site = kit ? siteNotes(kit) : (state.candidates ?? null);
  const brand = brandOf(state, kit);
  const view = effective(state, templates);
  const specs = specsOf(templates) ?? {};
  const styles = bank.styles ?? {};
  const numbers = numberCandidates(site);
  const { reference } = styleInfo(entryOf(state, "style"));
  return {
    state,
    bank,
    site,
    brand,
    view,
    specs,
    styles,
    numbers,
    flags: {
      brand: brand.has,
      no_brand: !brand.has,
      site: Boolean(brand.host),
      handle: Boolean(brand.handle),
      whatsapp: Boolean(site?.social?.whatsapp),
      number: numbers.length > 0,
      reference_without_link: Boolean(reference) && !reference.url,
    },
    vars: {
      nome: brand.name ?? brand.shown ?? "",
      site: brand.host ?? "",
      "@perfil": brand.handle ?? "",
      "número": numbers[0]?.text ?? "",
      "número 2": numbers[1]?.text ?? "",
      "estilo recomendado": lowerFirst(styles[view.recommendedStyle]?.label ?? view.recommendedStyle),
      "descrição do estilo recomendado": styles[view.recommendedStyle]?.description ?? "",
      ...vars,
    },
  };
}

function expandOption(option, context) {
  const { state, bank, site, view, specs, styles, numbers } = context;
  const make = (value, vars) => {
    const label = fillText(option.label, { ...context.vars, ...vars });
    const description = fillText(option.description ?? "", { ...context.vars, ...vars });
    return label.missing ? null : { value, label: label.text, description: description.missing ? "" : description.text, ...(option.free ? { free: true } : {}) };
  };
  const max = Number(option.max) || 4;
  switch (option.from) {
    case "candidates":
      return (state.brand?.candidates ?? []).slice(0, max).map((item) => make(item.key, { candidato: item.name ?? (item.site ? hostOf(item.site) : item.slug) ?? "", "origem do candidato": item.from === "marca" ? "Uma marca que você já usou neste projeto." : "O site que encontrei no seu projeto." }));
    case "kit.products":
      return productNames(site).slice(0, max).map((name) => make(name, { produto: name }));
    case "kit.news": {
      const news = newsOf(site);
      return news ? [make(news, { novidade: news })] : [];
    }
    case "kit.points":
      return pointCandidates(site).slice(0, max).map((point) => make(point, { ponto: point }));
    case "kit.numbers.1":
      return numbers[1] ? [make("numero-2", { "número 2": numbers[1].text })] : [];
    case "stories": {
      const order = bank.story_order?.[view.objective] ?? TEMPLATES;
      const ids = unique([view.template, ...order, ...TEMPLATES]).filter((id) => specs[id]);
      return ids.slice(0, max).map((id) => make(id, { roteiro: specs[id].label ?? id, "descrição do roteiro": sentence(specs[id].description ?? "") }));
    }
    case "styles.others":
      return STYLES.filter((id) => id !== view.recommendedStyle && styles[id]).slice(0, max).map((id) => make(id, { estilo: styles[id].label, "descrição do estilo": styles[id].description ?? "" }));
    default: {
      const value = fillText(option.value, context.vars);
      return value.missing ? [] : [make(value.text, {})];
    }
  }
}

function defaultOf(rule, options, context) {
  const { state, view } = context;
  const real = options.filter((option) => !option.free);
  if (rule && typeof rule === "object" && !Array.isArray(rule)) {
    switch (rule.rule) {
      case "first_candidate":
        return state.brand?.candidates?.[0]?.key ?? null;
      case "duration":
        return String(view.objective === "vender" ? 20 : 15);
      case "general_subject":
        return context.flags.brand ? "marca" : null;
      case "template":
        return view.template;
      case "tone":
        return view.tone;
      case "listed":
        return real.length ? real.map((option) => option.value) : null;
      case "first_option":
        return real[0]?.value ?? null;
      default:
        return null;
    }
  }
  if (Array.isArray(rule)) return rule.filter((value) => options.some((option) => option.value === value));
  if (rule === null || rule === undefined) return null;
  return options.some((option) => option.value === rule) ? rule : null;
}

/** A question of the bank ready to ask: texts filled, options that have real data, the default first. */
function renderQuestion(question, context) {
  const variant = (question.variants ?? []).find((item) => !item.when || context.flags[item.when]) ?? null;
  const source = { ...question, ...(variant ? { text: variant.text ?? question.text, options: variant.options ?? question.options, default: variant.default !== undefined ? variant.default : question.default } : {}) };
  const limit = Number(context.bank.limits?.options) || 4;
  const expanded = [];
  for (const option of source.options ?? []) {
    if (option.when && !context.flags[option.when]) continue;
    for (const made of expandOption(option, context)) {
      if (!made || expanded.some((item) => item.value === made.value)) continue;
      expanded.push({ ...made, fill: Boolean(option.fill) });
    }
  }
  // an option that only fills the list leaves first when there are too many; the one that asks for the member's own text stays last
  let options = expanded;
  while (options.length > limit && options.some((option) => option.fill)) options = options.filter((option, index) => index !== options.findLastIndex((item) => item.fill));
  const free = options.filter((option) => option.free);
  options = [...options.filter((option) => !option.free).slice(0, limit - free.length), ...free].slice(0, limit);
  const fallback = defaultOf(source.default, options, context);
  const isDefault = (option) => (Array.isArray(fallback) ? fallback.includes(option.value) : option.value === fallback);
  options = [...options.filter(isDefault), ...options.filter((option) => !isDefault(option))].map(({ fill, ...option }) => option);
  const textOnly = options.length < 2;
  const round = context.bank.rounds.find((item) => item.stage === question.stage)?.n ?? null;
  return {
    id: question.id,
    field: question.field ?? null,
    round,
    stage: question.stage,
    header: question.header,
    text: fillText(source.text, context.vars).text,
    options: textOnly ? [] : options,
    default: textOnly ? null : fallback,
    multi: Boolean(question.multi),
    free_text: textOnly ? true : Boolean(question.free_text),
    free_text_only: textOnly,
    note: [question.hint, textOnly ? question.free_text_hint : null].filter(Boolean).join(" ") || null,
  };
}

const optionMark = (question, option) => (Array.isArray(question.default) ? question.default.includes(option.value) : option.value === question.default);

function askPayload(question, bank) {
  const mark = bank.chat?.recommended ?? " (recomendado)";
  return {
    question: question.text,
    header: String(question.header ?? question.id).slice(0, 12),
    options: question.options.map((option) => ({ label: `${option.label}${optionMark(question, option) ? mark : ""}`, description: option.description || option.label })),
    multiSelect: question.multi,
  };
}

function chatBlock(question, index, bank, withDescriptions) {
  const mark = bank.chat?.default ?? " (padrão)";
  const lines = [`${index}. ${question.text}`];
  question.options.forEach((option, at) => {
    const detail = withDescriptions && option.description ? `: ${lowerFirst(option.description.replace(/[.]+$/, ""))}` : "";
    lines.push(`   ${LETTERS[at]}) ${option.label}${detail}${optionMark(question, option) ? mark : ""}`);
  });
  if (question.note) lines.push(`   ${question.note}`);
  return lines.join("\n");
}

function chatText(title, questions, bank) {
  const blocks = questions.map((question, index) => chatBlock(question, index + 1, bank, Boolean(questionOf(bank, question.id)?.chat_descriptions)));
  const withOptions = questions.map((question, index) => ({ question, index })).filter((item) => item.question.options.length >= 2);
  const pick = withOptions.find((item) => item.index === 1) ?? withOptions[0];
  const footer = pick ? fillText(bank.chat?.footer ?? 'Responda só o que quiser mudar (por exemplo, {exemplo}) ou "ok" para seguir com os padrões.', { exemplo: `${pick.index + 1}b` }).text : (bank.chat?.footer_text_only ?? 'Responda aqui mesmo, ou diga "ok" para eu decidir pelo que já sei.');
  return [title, "", blocks.join("\n"), "", footer].join("\n");
}

/**
 * The round to ask now, ready for a tool with clickable options (`ask_user_question`, plus
 * `ask_in_text` for what has no options) and for a plain conversation (`chat_text`). Null when
 * nothing is pending, or when the site of the brand has to be visited first.
 */
export function planRound(state, bank = null, { kit = null, templates = null } = {}) {
  const data = bank ?? ownBank();
  const current = shape(clone(state ?? {}));
  const plan = pendingPlan(current, data, kit);
  if (!plan || plan.wait) return null;
  const context = contextOf(current, data, { kit, templates });
  const questions = plan.ids.map((id) => renderQuestion(questionOf(data, id), context));
  const clickable = questions.filter((question) => !question.free_text_only);
  return {
    n: plan.n,
    title: plan.title,
    questions,
    ask_user_question: clickable.map((question) => askPayload(question, data)),
    ask_in_text: questions.filter((question) => question.free_text_only).map((question) => ({ id: question.id, text: question.text, ...(question.note ? { note: question.note } : {}) })),
    chat_text: chatText(plan.title, questions, data),
    note: data.decide_line ?? "Responda só o que quiser; o que ficar sem resposta, eu decido pelo que já sei.",
  };
}

/**
 * One question of the bank ready to ask outside the rounds (the brand to confirm, the brief to
 * approve, the preview, the opening): the same shape as a question of a round, plus its own
 * `ask_user_question` and `chat_text`. `vars` fills the names its text mentions.
 */
export function questionFor(bank, id, { state = {}, kit = null, templates = null, vars = {} } = {}) {
  const data = bank ?? ownBank();
  const question = questionOf(data, id);
  if (!question) return null;
  const rendered = renderQuestion(question, contextOf(shape(clone(state ?? {})), data, { kit, templates, vars }));
  return {
    ...rendered,
    ask_user_question: rendered.free_text_only ? [] : [askPayload(rendered, data)],
    chat_text: [rendered.text, ...rendered.options.map((option, at) => `   ${LETTERS[at]}) ${option.label}${optionMark(rendered, option) ? (data.chat?.default ?? " (padrão)") : ""}`)].join("\n"),
  };
}

// ---------------------------------------------------------------------------
// The answers
// ---------------------------------------------------------------------------

class AnswerError extends Error {}
const refuse = (message) => {
  throw new AnswerError(message);
};

const ACCEPT_DEFAULT = /^(?:ok|okay|sim|pode|pode ser|padrao|o padrao|default|tanto faz|decida|decide|decida por mim|voce decide|voce escolhe|recomendado|o recomendado|a recomendada)$/;
const EVERY_OPTION = /^(?:todas|todos|todas as opcoes|os tres|as tres|os 3|as 3|all)$/;
const tidy = (text) => fold(clean(text)).replace(/["“”'‘’«».,;:!?()]/g, "").replace(/\s+/g, " ").trim();

function matchOption(options, text) {
  const low = fold(clean(text)).replace(/\s*\((?:recomendado|padrao)\)\s*$/, "").trim();
  const byValue = options.find((option) => fold(String(option.value)) === low);
  if (byValue) return byValue;
  const letter = /^([a-p])\)?$/.exec(low);
  if (letter && LETTERS.indexOf(letter[1]) < options.length) return options[LETTERS.indexOf(letter[1])];
  if (/^\d$/.test(low) && Number(low) >= 1 && Number(low) <= options.length) return options[Number(low) - 1];
  const plain = tidy(low);
  return options.find((option) => tidy(option.label) === plain || tidy(`${option.label} ${option.description ?? ""}`) === plain) ?? null;
}

/** What an answer picks: options of the question, free text, or the default ("ok", an empty answer). */
function readAnswer(question, raw) {
  let parts;
  if (Array.isArray(raw)) parts = raw.map((item) => clean(String(item ?? "")));
  else {
    const text = String(raw ?? "").trim();
    if (!question.multi) parts = [clean(text)];
    else if (/[;\n]/.test(text)) parts = text.split(/[;\n]+/).map(clean);
    else parts = text.split(/(?<!\d),|,(?!\d)/).map(clean);
  }
  parts = parts.filter(Boolean);
  const whole = parts.join(", ");
  if (!parts.length || (parts.length === 1 && ACCEPT_DEFAULT.test(tidy(parts[0])) && !matchOption(question.options, parts[0]))) return { useDefault: true, picks: [], texts: [], raw: whole };
  if (question.multi && parts.length === 1 && EVERY_OPTION.test(tidy(parts[0]))) return { useDefault: false, picks: question.options.filter((option) => !option.free), texts: [], raw: whole };
  const picks = [];
  const texts = [];
  for (const part of parts) {
    const option = matchOption(question.options, part);
    if (option && !picks.includes(option)) picks.push(option);
    else if (!option) texts.push(part);
  }
  return { useDefault: false, picks, texts, raw: whole };
}

const optionsHint = (question) => question.options.map((option) => option.value).join(", ");

/** Each question's own way of turning an answer into the brief. Returns the value kept in the answers' log. */
const HANDLERS = {
  marca(state, answer, env) {
    const pick = answer.picks[0];
    if (pick?.value === "sem-marca" || (!pick && /^(?:sem[ -]marca|nenhuma|nao tenho(?: marca)?|nao tem(?: marca)?|sem|neutro|video neutro)$/.test(tidy(answer.raw)))) {
      const changed = brandOf(state).has;
      setField(state, "brand", { name: null, site: null, handle: null }, env.source, env.byDefault ? "sem marca (padrão)" : "sem marca");
      if (changed) dropCapture(state);
      state.brand = { ...state.brand, slug: null, kit: null, found_by: null, confirmed: true };
      delete state.brand.candidates;
      return "sem-marca";
    }
    const before = brandOf(state);
    const candidate = pick ? (state.brand?.candidates ?? []).find((item) => item.key === pick.value) : null;
    let value;
    let foundBy;
    let slug = null;
    if (candidate) {
      value = { name: candidate.name ?? null, site: candidate.site ?? null, handle: null };
      foundBy = env.source === "resposta" ? "resposta" : "projeto";
      slug = candidate.slug;
    } else {
      const text = answer.raw;
      const site = findUrls(text).find((url) => url.kind === "site") ?? null;
      const handle = findHandles(text)[0] ?? null;
      const noSite = /\b(?:sem site|nao tem site|nao tenho site|so (?:o )?instagram|so (?:o )?perfil)\b/.test(fold(text));
      let name = text;
      for (const url of findUrls(text)) name = name.replace(url.raw, " ");
      name = clean(name.replace(/@[A-Za-z0-9_.]+/g, " ").replace(/\((?:[^()]*)\)/g, " "))
        .replace(/,?\s*(?:sem site|n[aã]o tem site|n[aã]o tenho site|s[oó] (?:o )?instagram|s[oó] (?:o )?perfil)\b.*$/i, "")
        .replace(/^(?:[ée]\s+)?(?:a\s+|o\s+)?(?:minha\s+|nossa\s+|meu\s+|nosso\s+)?(?:marca|empresa|loja)\s+(?:[ée]|se chama|chama-se|chamada)\s+/i, "")
        .replace(/^(?:[ÉéEe]\s+[AaOo]\s+|[Ss]e chama\s+|[Cc]hama-se\s+|[Dd][ao]\s+|[AaOo]\s+)(?=\p{Lu})/u, "")
        .replace(/^["“‘'«]+|["”’'»]+$/g, "")
        .replace(/[\s,;:.–—-]+$/, "")
        .trim();
      if (!site && !handle && !name) refuse("Não entendi de qual marca é o vídeo. Mande o site, o @ ou o nome (ou “sem marca”).");
      value = { name: name || null, site: site?.url ?? null, handle };
      const kit = env.kit && sameBrand({ name: env.kit.name, site: env.kit.site }, value) ? env.kit : null;
      const known = kit ?? (state.brand?.candidates ?? []).find((item) => sameBrand(item, value)) ?? null;
      if (known && !value.site && known.site) value.site = known.site;
      foundBy = value.site || noSite ? "resposta" : "busca";
      slug = known?.slug ?? null;
    }
    const head = value.name ? fold(value.name.split(" ")[0]) : null;
    if (head && BUSINESS_NOUNS[head]) {
      value.noun = head;
      value.article = BUSINESS_NOUNS[head];
    }
    const sameSite = (value.site ? hostOf(value.site) : null) === (before.site ? hostOf(before.site) : null);
    if (before.has && !(sameSite && before.site)) dropCapture(state);
    setField(state, "brand", value, env.source, answer.raw || (candidate ? (candidate.name ?? candidate.site ?? "") : ""));
    state.brand = { ...state.brand, slug: slug ?? brandSlug(value), found_by: foundBy, confirmed: foundBy !== "busca" };
    if (!(sameSite && before.site)) state.brand.kit = null;
    delete state.brand.candidates;
    return value.site ?? value.handle ?? value.name;
  },

  objetivo(state, answer, env) {
    let value = answer.picks[0]?.value ?? null;
    let note = null;
    if (!value) {
      const found = detectObjective(fold(answer.raw), answer.raw);
      value = found?.value ?? "apresentar";
      note = clip(answer.raw, 200);
    }
    setField(state, "objective", value, env.source, answer.raw || value, note ? { note } : {});
    return value;
  },

  onde(state, answer, env) {
    const values = new Set(answer.picks.map((option) => option.value));
    for (const text of answer.texts) {
      const found = detectDestinations(fold(text), text);
      if (!found) refuse(`“${text}” não é uma das redes desta versão. Use ${optionsHint(env.question)} (pode ser mais de uma, separadas por vírgula).`);
      for (const id of found.value) values.add(id);
    }
    if (!values.size) refuse(`Diga onde o vídeo vai ser publicado: ${optionsHint(env.question)}.`);
    const list = DESTINATIONS.filter((id) => values.has(id));
    setField(state, "destinations", list, env.source, answer.raw || list.join(", "));
    return list;
  },

  duracao(state, answer, env) {
    let seconds = answer.picks[0] ? Number(answer.picks[0].value) : null;
    let evidence = answer.raw;
    if (seconds === null) {
      const text = answer.raw;
      const found = detectDuration(fold(text), text);
      const plain = /^\d{1,3}(?:[.,]\d)?$/.exec(text.trim());
      const asked = found?.asked ?? (plain ? Number(plain[0].replace(",", ".")) : null);
      if (asked === null || !Number.isFinite(asked)) refuse(`A duração precisa ser um número de segundos entre ${DURATION.min} e ${DURATION.max} (veio “${text}”).`);
      seconds = Math.min(DURATION.max, Math.max(DURATION.min, Math.round(asked)));
      if (asked > DURATION.max) {
        evidence = `${text} (nesta versão, até ${DURATION.max} s)`;
        if (!state.unsupported.some((item) => item.kind === "long")) state.unsupported.push({ kind: "long", evidence, ...(env.bank.unsupported?.long ? { message: env.bank.unsupported.long } : {}) });
      } else if (asked < DURATION.min) evidence = `${text} (o mínimo é ${DURATION.min} s)`;
    }
    setField(state, "duration", seconds, env.source, evidence || String(seconds));
    return String(seconds);
  },

  assunto(state, answer, env) {
    const pick = answer.picks[0];
    if (pick?.value === "marca" || (!pick && /^(?:a marca|marca|a marca em geral|marca em geral|o negocio|em geral)$/.test(tidy(answer.raw)))) {
      setField(state, "subject", GENERAL_SUBJECT, "padrao", env.byDefault ? "sem um produto específico" : "a marca em geral", env.byDefault ? {} : { by: env.source });
      return "marca";
    }
    if (pick && pick.free && !answer.texts.length) refuse("Qual produto ou promoção o vídeo divulga? Escreva o nome, com preço e data se houver.");
    const text = clean(pick && !pick.free ? pick.value : answer.texts.join(", ") || answer.raw);
    if (!text) refuse("Diga o que o vídeo divulga: a marca em geral, um produto ou uma promoção.");
    setField(state, "subject", text, env.source, answer.raw || text);
    return text;
  },

  roteiro(state, answer, env) {
    const pick = answer.picks[0];
    if (pick && !pick.free) {
      setField(state, "template", pick.value, env.source, answer.raw || pick.label);
      return pick.value;
    }
    const idea = clean(answer.texts.join(", "));
    if (!idea) refuse("Conte a sua ideia em uma ou duas frases, ou escolha um dos roteiros.");
    const found = detectTemplate(fold(idea), idea);
    const value = found?.value ?? effective(state, env.templates).template;
    setField(state, "template", value, env.source, idea, { note: clip(idea, 300) });
    return value;
  },

  pontos(state, answer, env) {
    const list = [...answer.picks.filter((option) => !option.free).map((option) => option.value), ...answer.texts.map((text) => text.replace(/[.;]+$/, ""))].filter(Boolean);
    if (!list.length) refuse("Quais coisas o vídeo deve mostrar? Marque as opções ou escreva as suas, separadas por ponto e vírgula.");
    const limit = effective(state, env.templates).template === "interface" ? LIMITS.states : LIMITS.points;
    const kept = unique(list).slice(0, limit);
    const fromSite = env.byDefault;
    setField(state, "points", kept, fromSite ? "captura" : env.source, fromSite ? `seções e produtos de ${env.context.site?.host ?? "seu site"}` : answer.raw, list.length > kept.length ? { note: `Vieram ${list.length}; ficaram os ${kept.length} primeiros.` } : {});
    return kept;
  },

  numero(state, answer, env) {
    const pick = answer.picks[0];
    const numbers = env.context.numbers;
    if (pick?.value === "nenhum" || (!pick && /^(?:nenhum|nao|sem numeros?|nao mostr\w* numeros?|nao tenho)$/.test(tidy(answer.raw)))) {
      setField(state, "proof", null, env.source, env.byDefault ? "sem número: nenhum foi informado" : "sem número");
      return "nenhum";
    }
    if (pick?.value === "mostrar" || pick?.value === "numero-2") {
      const number = numbers[pick.value === "mostrar" ? 0 : 1];
      if (!number) refuse("Não há número publicado para mostrar. Escreva o número e o que ele mede, ou responda “nenhum”.");
      const proof = proofFrom(env.context.site, number);
      setField(state, "proof", proof, "captura", `publicado em ${env.context.site?.host ?? "seu site"} (${proof.page})`);
      return pick.value;
    }
    const text = clean(answer.texts.join(", "));
    if (!text) refuse("Escreva o número e o que ele mede (por exemplo: +2 mil clientes atendidos), ou responda “nenhum”.");
    const value = numberIn(text);
    if (value === null) refuse(`“${text}” não tem um número. Escreva o número e o que ele mede, ou responda “nenhum”.`);
    setField(state, "proof", { text, value, source: "informado por você" }, env.source, text);
    return text;
  },

  sentimento(state, answer, env) {
    let value = answer.picks[0]?.value ?? null;
    if (!value) {
      const found = detectTone(fold(answer.raw), answer.raw);
      if (!found) refuse(`Escolha um dos sentimentos: ${optionsHint(env.question)}.`);
      value = found.value;
    }
    setField(state, "tone", value, env.source, answer.raw || value);
    return value;
  },

  referencia(state, answer, env) {
    const view = effective(state, env.templates);
    const pick = answer.picks[0];
    if (pick?.value === "recomendado") {
      setField(state, "style", view.recommendedStyle, env.source, env.byDefault ? "o estilo do roteiro" : "o estilo recomendado");
      return "recomendado";
    }
    if (pick?.value === "outro") {
      if (state.fields.style && !FROM_MEMBER.includes(state.fields.style.source)) delete state.fields.style;
      return "outro";
    }
    if (pick?.value === "link") {
      setField(state, "style", { reference: null, description: null }, env.source, "tem um vídeo de referência");
      return "link";
    }
    const text = clean(answer.texts.join(", "));
    const link = findUrls(text)[0] ?? null;
    let words = text;
    if (link) words = clean(text.replace(link.raw, " "));
    const named = matchOption(STYLES.map((id) => ({ value: id, label: env.bank.styles?.[id]?.label ?? id })), words) ?? null;
    const guessed = named?.value ?? detectStyle(fold(words), words)?.value ?? null;
    if (!link && guessed) {
      setField(state, "style", guessed, env.source, text);
      return guessed;
    }
    if (!link && !words) refuse("Escolha uma das opções, cole o link do vídeo de referência ou diga o estilo que você quer.");
    setField(state, "style", { reference: link?.url ?? null, description: words || null, ...(guessed ? { base: guessed } : {}) }, env.source, text);
    return link ? "link" : "descricao";
  },

  estilo(state, answer, env) {
    let value = answer.picks[0]?.value ?? null;
    if (!value) {
      const named = matchOption(STYLES.map((id) => ({ value: id, label: env.bank.styles?.[id]?.label ?? id })), answer.raw);
      value = named?.value ?? detectStyle(fold(answer.raw), answer.raw)?.value ?? null;
      if (!value) refuse(`Escolha um dos estilos: ${optionsHint(env.question)}.`);
    }
    setField(state, "style", value, env.source, answer.raw || value);
    return value;
  },

  referencia_descricao(state, answer, env) {
    const text = clean(answer.raw);
    if (!text) refuse("Diga em uma frase o que você gosta no vídeo de referência (o ritmo, as cores, o jeito do texto).");
    const current = entryOf(state, "style");
    const info = styleInfo(current);
    const link = findUrls(text)[0] ?? null;
    const words = link ? clean(text.replace(link.raw, " ")) : text;
    const guessed = detectStyle(fold(words), words)?.value ?? info.id;
    const value = { reference: link?.url ?? info.reference?.url ?? null, description: words || null, ...(guessed ? { base: guessed } : {}) };
    setField(state, "style", value, current && FROM_MEMBER.includes(current.source) ? current.source : env.source, current?.evidence || text);
    return text;
  },

  som(state, answer, env) {
    const pick = answer.picks[0];
    let value = { trilha: { mode: "music", style: null, file: null, effects: true }, efeitos: { mode: "none", style: null, file: null, effects: true }, arquivo: { mode: "file", style: null, file: null, effects: true }, "sem-som": { mode: "none", style: null, file: null, effects: false } }[pick?.value] ?? null;
    if (!value) {
      const file = /[\w\-.]*[\w-]\.(?:mp3|wav|m4a|aac|ogg|flac)\b/i.exec(answer.raw);
      value = detectMusic(fold(answer.raw), answer.raw, file ? file[0] : null)?.value ?? null;
      if (!value) refuse(`Escolha uma das opções do som: ${optionsHint(env.question)}.`);
    }
    setField(state, "music", value, env.source, answer.raw || pick?.label || "");
    return pick?.value ?? value.mode;
  },

  fechamento(state, answer, env) {
    const pick = answer.picks[0];
    const brand = env.context.brand;
    if (pick && !pick.free) {
      const text = { site: brand.host, perfil: brand.handle, whatsapp: "Chama no WhatsApp", bio: "Link na bio" }[pick.value] ?? null;
      setField(state, "closing", { kind: pick.value, text }, env.source, answer.raw || pick.label);
      return pick.value;
    }
    const text = clean(answer.texts.join(", "));
    if (!text) refuse("Escreva a chamada final (até 6 palavras), ou escolha uma das opções.");
    const low = fold(text);
    let value;
    if (/\blink (?:na|da) bio\b/.test(low)) value = { kind: "bio", text: "Link na bio" };
    else if (findHandles(text)[0]) value = { kind: "perfil", text: findHandles(text)[0] };
    else if (findUrls(text).some((url) => url.kind === "site")) value = { kind: "site", text: findUrls(text).find((url) => url.kind === "site").host };
    else if (/\b(?:whatsapp|whats|zap|wpp)\b/.test(low)) value = { kind: "whatsapp", text: wordCount(text) <= LIMITS.closing_words ? capitalize(text.replace(/\b(?:whats(?:app)?|zap|wpp)\b/i, "WhatsApp")) : "Chama no WhatsApp" };
    else value = { kind: "frase", text: capitalize(shortenWords(text, LIMITS.closing_words)) };
    setField(state, "closing", value, env.source, text, wordCount(text) > LIMITS.closing_words && value.kind === "frase" ? { note: `A chamada pedida tem ${wordCount(text)} palavras; na tela cabem ${LIMITS.closing_words}.` } : {});
    return value.text;
  },

  conferir_marca(state, answer, env) {
    const pick = answer.picks[0];
    const site = findUrls(answer.raw).find((url) => url.kind === "site") ?? null;
    if (site) return HANDLERS.marca(state, { picks: [], texts: [site.raw], raw: site.raw }, env);
    if (pick?.value === "sim" || pick?.value === "materiais") {
      state.brand = { ...state.brand, confirmed: true, ...(pick.value === "materiais" ? { materials: true } : {}) };
      return pick.value;
    }
    // "it is not this one" without the right address: the brand is asked again
    dropCapture(state);
    delete state.fields.brand;
    state.brand = { ...state.brand, slug: null, kit: null, found_by: null, confirmed: false };
    state.answers = state.answers.filter((item) => item.id !== "marca");
    return "outro-site";
  },

  abertura(state, answer, env) {
    const pick = answer.picks[0];
    if (pick?.value === "manter") {
      if (state.fields.hook) state.fields.hook = { ...state.fields.hook, by: env.source };
      return "manter";
    }
    const text = clean(pick && !pick.free ? pick.value : answer.texts.join(", "));
    if (!text) refuse("Escreva a abertura que você quer (até 6 palavras), ou responda “manter”.");
    const short = shortenWords(text.replace(/^["“‘'«]+|["”’'»]+$/g, ""), LIMITS.hook_words);
    setField(state, "hook", short, env.source, text, wordCount(text) > LIMITS.hook_words ? { note: `A frase pedida tem ${wordCount(text)} palavras; na tela cabem ${LIMITS.hook_words}.` } : {});
    return short;
  },
};

/** A decision that is not a field of the brief (third-party brand, paid partnership, sector rules): kept as said. */
function keepDecision(state, question, answer, now) {
  const pick = answer.picks[0];
  if (pick?.free && !answer.texts.length) refuse("Escreva como o texto deve sair.");
  const value = pick && !pick.free ? pick.value : clean(answer.texts.join(", "));
  if (!value) refuse(`Escolha uma das opções: ${optionsHint(question)}.`);
  state.decisions = { ...(state.decisions ?? {}), [question.id]: { value, at: now ?? null } };
  return value;
}

function applyOne(state, bank, question, raw, { kit, now, templates, byDefault = false, shown = null }) {
  const context = contextOf(shown ?? state, bank, { kit, templates });
  const rendered = renderQuestion(question, context);
  let answer = readAnswer(rendered, raw);
  const source = byDefault ? "padrao" : "resposta";
  if (answer.useDefault) {
    if (question.explicit && !byDefault) refuse(`“${rendered.text}” é uma decisão que pede resposta própria: ${optionsHint(rendered)}.`);
    const fallback = rendered.default;
    if (fallback === null || fallback === undefined || (Array.isArray(fallback) && !fallback.length)) {
      if (byDefault) return { skipped: true };
      refuse(question.id === "marca" ? "A marca eu não consigo decidir sozinho: mande o site, o @ ou o nome (ou “sem marca”)." : `“${rendered.text}” não tem um padrão: responda com as suas palavras.`);
    }
    answer = readAnswer(rendered, fallback);
    answer.raw = "";
    if (answer.useDefault) refuse(`“${rendered.text}” não tem um padrão: responda com as suas palavras.`);
    return { value: (HANDLERS[question.id] ?? ((s, a) => keepDecision(s, rendered, a, now)))(state, answer, { bank, kit, templates, context, question: rendered, source: "padrao", byDefault: true }) };
  }
  if (!rendered.free_text && answer.texts.length && !["onde", "som"].includes(question.id)) refuse(`“${answer.texts[0]}” não é uma das opções de “${rendered.text}”: ${optionsHint(rendered)}.`);
  const handler = HANDLERS[question.id];
  if (handler) return { value: handler(state, answer, { bank, kit, templates, context, question: rendered, source, byDefault }) };
  return { value: keepDecision(state, rendered, answer, now) };
}

/** The questions of a round left without an answer take their default; what has none stays open. */
function decideOpen(state, bank, ids, { kit, now, templates }) {
  for (const id of ids) {
    const question = questionOf(bank, id);
    if (!question || closedIds(state).has(id) || !isOpen(question, state, state.mode ?? "guided")) continue;
    let applied = { skipped: true };
    try {
      applied = applyOne(state, bank, question, "", { kit, now, templates, byDefault: true });
    } catch (error) {
      if (!(error instanceof AnswerError)) throw error;
    }
    if (applied.skipped && question.decide === "keep_open") continue;
    logAnswer(state, id, applied.skipped ? null : applied.value, now, true);
  }
}

function logAnswer(state, id, value, now, decided = false) {
  state.answers = [...state.answers.filter((answer) => answer.id !== id), { id, value: value ?? null, at: now ?? null, ...(decided ? { decided: true } : {}) }];
  if (!state.asked.includes(id)) state.asked.push(id);
}

/** Rounds are marked as answered when none of their questions is open any more. */
function closeRounds(state, bank, shownPlan, now) {
  const mode = state.mode ?? "guided";
  if (shownPlan && !shownPlan.wait) {
    const entry = state.rounds.find((item) => item?.n === shownPlan.n);
    if (!entry) state.rounds.push({ n: shownPlan.n, ids: [...shownPlan.ids], at: now ?? null, answered: false });
    else entry.ids = unique([...(entry.ids ?? []), ...shownPlan.ids]);
  }
  for (const entry of state.rounds) {
    if (!entry || typeof entry !== "object") continue;
    const stage = bank.rounds.find((round) => round.n === entry.n)?.stage;
    const questions = mode === "partial" ? (entry.ids ?? []).map((id) => questionOf(bank, id)).filter(Boolean) : bank.questions.filter((question) => question.stage === stage);
    entry.answered = !questions.some((question) => isOpen(question, state, mode));
  }
}

function afterChange(state, bank, shownPlan, now) {
  derive(state);
  closeRounds(state, bank, shownPlan, now);
  if (now) state.updated_at = now;
  // a brief that changed has to be shown again before the yes
  if (state.status === "brief") state.status = hasKit(state) || state.capture ? "capture" : "intake";
}

/**
 * Records answers: `{ [questionId]: value }`, where a value is an option's `value`, its number or
 * letter in the round ("1", "a"), its label, free text where the question takes it, or several of
 * those separated by commas or semicolons for a question that takes more than one. "ok" or an
 * empty answer takes the default. Letters and numbers point at the round as the member saw it.
 * The questions of the round left unanswered stay open until decideRound fills them ("o que
 * ficar sem resposta, eu decido"). Returns `{ state, errors }`; with any error nothing is recorded.
 */
export function applyAnswers(input, answers, bank = null, { kit = null, now = null, templates = null } = {}) {
  const data = bank ?? ownBank();
  const state = shape(clone(input ?? {}));
  const seen = shape(clone(input ?? {}));
  const errors = [];
  const shown = pendingPlan(state, data, kit);
  const order = (id) => {
    const at = data.questions.findIndex((question) => question.id === id);
    return at < 0 ? Infinity : at;
  };
  const entries = Object.entries(answers && typeof answers === "object" && !Array.isArray(answers) ? answers : {}).sort((a, b) => order(a[0]) - order(b[0]));
  for (const [id, raw] of entries) {
    const question = questionOf(data, id);
    if (!question) {
      errors.push({ id, code: "question_unknown", message: `Não existe a pergunta “${id}” neste app. As perguntas são: ${data.questions.filter((item) => !String(item.target ?? "").startsWith("approvals.")).map((item) => item.id).join(", ")}.` });
      continue;
    }
    if (String(question.target ?? "").startsWith("approvals.")) {
      const what = question.target === "approvals.brief" ? "brief" : "preview";
      errors.push({ id, code: "question_unknown", message: `“${id}” não se responde com answer: o sim do integrante se registra com o comando approve (approve <vídeo> ${what}); uma mudança, com answer na pergunta do que muda.` });
      continue;
    }
    try {
      const applied = applyOne(state, data, question, raw, { kit, now, templates, shown: seen });
      logAnswer(state, id, applied.value, now);
    } catch (error) {
      if (!(error instanceof AnswerError)) throw error;
      errors.push({ id, code: "answer_invalid", message: error.message });
    }
  }
  if (errors.length) return { state: shape(clone(input ?? {})), errors };
  afterChange(state, data, shown, now);
  return { state, errors };
}

/**
 * "Decida por mim": the questions of the pending round that have no answer take their defaults
 * (source "padrao", or "captura" when the default comes from the site). The brand is the one
 * thing the app cannot decide: its question stays open, and so do the points when there is nothing
 * to choose them from. With `all` ("o resto decide você"), the later rounds count as decided too:
 * their defaults are filled when the brief is written, after the visit to the site, and only a
 * question without any possible default is still asked.
 */
export function decideRound(input, bank = null, { kit = null, now = null, templates = null, all = false } = {}) {
  const data = bank ?? ownBank();
  const state = shape(clone(input ?? {}));
  const first = pendingPlan(state, data, kit);
  if (first && !first.wait) decideOpen(state, data, first.ids, { kit, now, templates });
  // "o resto decide você": the later rounds are decided too, with what the site brings when it comes
  if (all) state.decide_all = true;
  afterChange(state, data, first, now);
  return state;
}

// ---------------------------------------------------------------------------
// The plan in one line and the complete brief
// ---------------------------------------------------------------------------

const NETWORK_NAMES = { reels: "Reels", tiktok: "TikTok", shorts: "Shorts" };
const TONE_PHRASES = { confianca: "confiança de que funciona", vontade: "vontade de comprar", surpresa: "surpresa com o que dá para fazer", proximidade: "proximidade, de gente como a gente" };
const TONE_NAMES = { confianca: "Confiança", vontade: "Vontade", surpresa: "Surpresa", proximidade: "Proximidade" };
const OBJECTIVE_NAMES = { apresentar: "apresentar e levar ao site", vender: "vender", lancar: "lançar uma novidade", explicar: "explicar como funciona", portfolio: "mostrar o seu trabalho" };
const EFFECTS_BY_STYLE = { "interface-narra": "cliques de interface", "interface-que-se-transforma": "cliques de interface", limpo: "efeitos discretos", "tipografia-cinetica": "batidas nas palavras", vitrine: "efeitos nas trocas de produto" };
const SOURCE_NAMES = { pedido: "você disse", resposta: "você respondeu", captura: "achei no site", projeto: "achei no seu projeto", marca: "marca guardada", inferido: "deduzi do que você disse", padrao: "padrão" };
const FIELD_NAMES = { brand: "Marca", objective: "Para que serve", subject: "O que divulga", destinations: "Onde publicar", duration: "Duração", template: "Roteiro", points: "O que mostrar", hook: "Abertura", proof: "Número", tone: "Sentimento", style: "Estilo", music: "Som", closing: "Fechamento", skip_preview: "Prévia" };

const joinList = (items) => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`);
const quote = (text) => `“${clean(text)}”`;
const countName = (n, feminine = false) => (feminine && FEMININE_NAMES[n]) || (NUMBER_NAMES[n] ?? String(n));

/** The brief with every default in, read into the pieces the sentences are made of. */
function briefView(state, templates, bank) {
  const filled = fillDefaults(state, templates);
  const view = effective(filled, templates);
  const brand = brandOf(filled);
  const styles = bank?.styles ?? {};
  const music = valueOf(filled, "music") ?? { mode: "music", effects: true };
  const closing = valueOf(filled, "closing") ?? { kind: "bio", text: "Link na bio" };
  const proof = valueOf(filled, "proof");
  const { reference } = styleInfo(entryOf(filled, "style"));
  return {
    filled,
    view,
    brand,
    spec: view.spec,
    duration: view.duration,
    destinations: DESTINATIONS.filter((id) => (Array.isArray(valueOf(filled, "destinations")) ? valueOf(filled, "destinations") : DESTINATIONS).includes(id)),
    subject: specificSubject(filled),
    points: (Array.isArray(valueOf(filled, "points")) ? valueOf(filled, "points") : []).map((item) => clean(typeof item === "string" ? item : item?.text)).filter(Boolean),
    hook: clean(valueOf(filled, "hook")) || null,
    proof: proof && typeof proof === "object" && clean(proof.text) ? proof : null,
    music,
    closing,
    styleLabel: lowerFirst(styles[view.style]?.label ?? view.style),
    reference,
    screens: hasScreens(filled),
    skip: valueOf(filled, "skip_preview") === true,
  };
}

function goalPhrase(brief) {
  const { view, brand } = brief;
  const subject = brief.subject ? subjectPhrase(brief.subject) : "";
  const toSite = brand.host ? " e levar ao site" : "";
  switch (view.objective) {
    case "vender":
      return subject ? `para vender ${subject}` : "para vender uma oferta";
    case "lancar":
      return subject ? `para lançar ${subject}` : "para anunciar uma novidade";
    case "explicar":
      if (!subject) return "para explicar como funciona";
      return LIST_NOUN.test(fold(subject)) ? `para mostrar ${subject}` : `para explicar ${subject}`;
    case "portfolio":
      return subject ? `para mostrar o seu trabalho, com foco em ${subject.replace(/^(?:o|a|os|as)\s+/i, "")}` : "para mostrar o seu trabalho";
    default:
      if (!brand.has && !subject) return "para passar a sua mensagem";
      return `para apresentar ${subject || businessOf(brand)}${toSite}`;
  }
}

function closingPhrase(brief) {
  const { closing, brand } = brief;
  const text = clean(closing.text) || "Link na bio";
  const shown = ["site", "perfil"].includes(closing.kind) ? text : quote(text);
  if (!brand.has) return `com ${shown}`;
  return brief.screens ? `no logo com ${shown}` : `no nome da marca com ${shown}`;
}

function soundPhrase(brief) {
  const { music, view } = brief;
  const effects = EFFECTS_BY_STYLE[view.style] ?? "efeitos nos movimentos";
  if (music.mode === "none") return music.effects === false ? "sem som" : "sem música: só efeitos sonoros nos movimentos";
  if (music.mode === "file") return `a sua música${music.file ? ` (${music.file})` : ", que você põe na pasta de materiais"}, com os cortes na batida dela`;
  if (music.mode === "synth") return `trilha original em loop, na batida, com ${effects}`;
  return `trilha original na batida, com ${effects}`;
}

const PRICE = /R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|R\$\s?\d+(?:,\d{1,2})?/;
const DEADLINE = /\b(?:s[óo]\s+)?at[ée]\s+(?:amanh[ãa]|hoje|domingo|segunda(?:-feira)?|ter[çc]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|s[áa]bado|o\s+fim\s+d[oa]\s+(?:m[êe]s|semana|ano)|(?:o\s+)?dia\s+\d{1,2}(?:\/\d{1,2})?|\d{1,2}\/\d{1,2})|\bs[óo]\s+(?:hoje|amanh[ãa]|esta\s+semana|neste\s+fim\s+de\s+semana)|\b(?:[úu]ltimos\s+dias|por\s+tempo\s+limitado)/i;

/** What is on offer, without the price and the deadline said with it: "casaco de lã por R$ 199 até domingo" → "Casaco de lã". */
function productOf(subject) {
  const text = clean(String(subject ?? "").replace(new RegExp(`(?:\\b(?:por apenas|por só|por|a partir de|a|de)\\s+)?${PRICE.source}`, "gi"), " ").replace(DEADLINE, " "))
    .replace(/[\s,:;–—-]+$/, "")
    .replace(/\s+(?:por|a|de|com|e)$/i, "");
  return capitalize(toSecondPerson(text || clean(subject)));
}

/** The story, one clause per scene, in the order of the template. */
function storyPhrase(brief) {
  const { view, brand, points, hook, proof } = brief;
  const parts = [];
  const opening = hook ? `abre com ${quote(hook)}` : "abre com uma frase curta";
  const who = brand.has ? businessOf(brand) : "o tema";
  switch (view.template) {
    case "interface":
      parts.push(brand.has ? "abre no logo" : "abre no título");
      parts.push(points.length ? `um único elemento muda de estado a cada batida, em ${countName(points.length)} passos: ${joinList(points.map(quote))}` : "um único elemento muda de estado a cada batida, com os passos tirados do seu site");
      break;
    case "oferta": {
      const texts = [brief.subject ?? "", brief.filled.request ?? ""];
      const price = texts.map((text) => PRICE.exec(text)?.[0]).find(Boolean) ?? null;
      const deadline = texts.map((text) => DEADLINE.exec(text)?.[0]).find(Boolean) ?? null;
      const product = brief.subject ? productOf(brief.subject) : null;
      if (product && hook && fold(product) === fold(hook)) parts.push(`abre com ${quote(hook)} em destaque`);
      else {
        parts.push(opening);
        parts.push(product ? `${quote(product)} em destaque` : `${who} em destaque`);
      }
      parts.push(price ? `o preço ${quote(price.replace(/R\$\s?/, "R$ "))} batendo na tela` : "o preço batendo na tela, o que estiver no site ou o que você me disser");
      if (deadline) parts.push(`o prazo ${quote(clean(deadline))}`);
      break;
    }
    case "lista":
      parts.push(opening);
      parts.push(points.length ? `${countName(points.length)} itens numerados, um por vez: ${joinList(points.map(quote))}` : "de três a cinco itens numerados, um por vez, que você ainda vai me dizer");
      break;
    default:
      parts.push(`${opening} em letras grandes`);
      parts.push(brand.has ? `${who} aparece ${brief.screens ? "com as telas reais do site se montando" : "com o nome em destaque"}` : "a mensagem aparece em destaque");
      parts.push(points.length ? `${countName(points.length)} momento${points.length > 1 ? "s" : ""}: ${joinList(points.map(quote))}` : "os pontos do vídeo, que você ainda vai me dizer");
      if (proof) parts.push(`o número ${quote(proof.text)} (${proofOrigin(proof)})`);
  }
  parts.push(`fecha ${closingPhrase(brief)}`);
  return parts.join("; ");
}

function whatPhrase(brief) {
  const { view, brand, destinations } = brief;
  const kind = view.objective === "vender" ? "um anúncio animado" : "um vídeo animado";
  const whose = ofBrand(brand);
  return `${kind} de ${brief.duration} s${whose ? ` ${whose}` : brand.none ? ", sem marca" : " da sua marca"}, na vertical para ${joinList(destinations.map((id) => NETWORK_NAMES[id]))}`;
}

/**
 * The plan in one sentence, for a request that needs no brief (at most 300 characters). It ends
 * with "Já comecei…" only when nothing is left to ask.
 */
export function linha(state, { minutes = 10, bank = null, templates = null, kit = null } = {}) {
  const data = bank ?? ownBank();
  const current = shape(clone(state ?? {}));
  const brief = briefView(current, templates, data);
  const { brand, music, closing } = brief;
  const searching = needsCapture(current, kit);
  const assets = brand.host || searching ? "com o logo, as cores e as telas reais do site" : brand.has ? "com o nome da marca em destaque" : brand.none ? "em visual neutro" : "com o logo, as cores e as telas reais";
  const sound = music.mode === "none" ? (music.effects === false ? "sem som" : "só efeitos sonoros") : music.mode === "file" ? "a sua música" : music.mode === "synth" ? "trilha original em loop" : "trilha original na batida";
  const endText = clean(closing.text) || "Link na bio";
  const end = `${brand.none ? "" : brand.host || searching || !brand.has ? "o logo com " : "o nome da marca com "}${["site", "perfil"].includes(closing.kind) ? endText : quote(endText)}`;
  const plan = pendingPlan(current, data, kit);
  let tail = " Já comecei; se quiser mudar algo, é só dizer.";
  if (plan?.wait) tail = ` Antes, visito o site e faço ${plan.ids.length === 1 ? "uma pergunta rápida" : `até ${countName(Math.min(plan.ids.length, 4), true)} perguntas rápidas`}.`;
  else if (plan) tail = "";
  else if (current.mode === "guided" || isRouteMismatch(current)) tail = current.approvals?.brief ? "" : " Antes de construir, mostro o plano completo para você aprovar.";
  const preview = ` Prévia em uns ${minutes} minutos.`;
  const head = `Vou fazer ${whatPhrase(brief)}`;
  const candidates = [`${head}, ${assets}, ${sound} e, no fim, ${end}.${preview}${tail}`, `${head}, ${sound} e, no fim, ${end}.${preview}${tail}`, `${head}, ${sound}.${preview}${tail}`, `${head}.${preview}${tail}`, `${head}.${preview}`];
  const fit = candidates.find((text) => text.length <= 300);
  return fit ?? `${candidates[candidates.length - 1].slice(0, 299).trimEnd()}…`;
}

function shownValue(field, brief, specs, bank) {
  const { filled, brand, view } = brief;
  const value = valueOf(filled, field);
  switch (field) {
    case "brand":
      return brand.has ? `${brand.name ?? brand.host ?? brand.handle}${brand.name && brand.host ? ` (${brand.host})` : ""}` : "sem marca: vídeo neutro";
    case "objective":
      return OBJECTIVE_NAMES[view.objective] ?? view.objective;
    case "subject":
      return brief.subject ? toSecondPerson(brief.subject) : "a marca em geral";
    case "destinations":
      return joinList(brief.destinations.map((id) => NETWORK_NAMES[id]));
    case "duration":
      return `${brief.duration} s`;
    case "template":
      return specs?.[view.template]?.label ?? view.template;
    case "points":
      return brief.points.length ? brief.points.join("; ") : "a definir";
    case "hook":
      return brief.hook ? quote(brief.hook) : "a definir";
    case "proof":
      return brief.proof ? `${quote(brief.proof.text)}, ${/informad/.test(brief.proof.source ?? "") ? "informado por você" : `publicado em ${brief.proof.source}`}` : "nenhum número";
    case "tone":
      return TONE_NAMES[view.tone] ?? view.tone;
    case "style":
      return `${capitalize(brief.styleLabel)}${brief.reference?.url ? `; referência guardada: ${brief.reference.url}` : ""}${brief.reference?.description ? `; você gosta de: ${brief.reference.description}` : ""}`;
    case "music":
      return capitalize(soundPhrase(brief));
    case "closing":
      return clean(brief.closing.text) || "Link na bio";
    case "skip_preview":
      return value === true ? "sem parada na prévia: sigo direto para o vídeo final" : "você vê a prévia antes do vídeo final";
    default:
      return String(value ?? "");
  }
}

/**
 * The complete brief written back: `lines` (at most ten, in the order what, story, tone, sound,
 * style, time), `text` (the lines, one per row), `markdown` (the same as a short briefing.md with
 * the origin of every decision) and the question that asks for the yes.
 */
export function echo(state, templates = null, { minutes = 12, bank = null } = {}) {
  const data = bank ?? ownBank();
  const specs = specsOf(templates);
  const current = shape(clone(state ?? {}));
  const brief = briefView(current, templates, data);
  const spec = specs?.[brief.view.template] ?? {};
  const what = `Vou fazer ${whatPhrase(brief)}, ${goalPhrase(brief)}.`;
  const story = `História: ${storyPhrase(brief)}.`;
  const tone = `Tom: ${TONE_PHRASES[brief.view.tone] ?? brief.view.tone}.`;
  const sound = sentence(soundPhrase(brief));
  let style = `Estilo: ${brief.styleLabel}.`;
  if (brief.reference) style += brief.reference.description ? ` Do vídeo de referência, levo o que você descreveu: ${quote(brief.reference.description)}.` : " O vídeo de referência fica guardado; nesta versão eu ainda não assisto a ele.";
  const time = `Prévia em uns ${minutes} minutos.${brief.skip ? " Você pediu para eu seguir direto: faço a prévia, confiro e já renderizo o final." : ""}`;
  const lines = [what, story, tone, sound, style, time];
  const text = lines.join("\n");

  const title = `Briefing: ${brief.brand.shown ?? "vídeo animado"} · ${lowerFirst(spec.label ?? brief.view.template)}`;
  const rows = FIELDS.map((field) => {
    const entry = entryOf(brief.filled, field);
    const origin = SOURCE_NAMES[entry?.by ?? entry?.source] ?? "padrão";
    return `| ${FIELD_NAMES[field]} | ${shownValue(field, brief, specs, data).replace(/\|/g, "/")} | ${origin} |`;
  });
  const notes = FIELDS.map((field) => entryOf(brief.filled, field)?.note).filter(Boolean);
  const markdown = [
    `# ${title}`,
    "",
    `- **O vídeo:** ${whatPhrase(brief).replace(/^um /, "")} (1080×1920).`,
    `- **Para quê:** ${goalPhrase(brief).replace(/^para /, "")}.`,
    `- **A história (${spec.label ?? brief.view.template}):** ${storyPhrase(brief)}.`,
    `- **O tom:** ${TONE_PHRASES[brief.view.tone] ?? brief.view.tone}.`,
    `- **O som:** ${soundPhrase(brief)}.`,
    `- **O estilo:** ${brief.styleLabel}${brief.reference?.description ? `; do vídeo de referência, ${quote(brief.reference.description)}` : ""}.`,
    `- **A prévia:** em uns ${minutes} minutos${brief.skip ? ", sem parada: sigo direto para o vídeo final" : "; o vídeo final só sai depois do seu sim"}.`,
    ...(notes.length ? ["", "## Para conferir", "", ...notes.map((note) => `- ${note}`)] : []),
    "",
    "## De onde veio cada decisão",
    "",
    "| Decisão | Valor | De onde veio |",
    "|---|---|---|",
    ...rows,
    "",
  ].join("\n");

  const question = questionFor(data, "aprovar_briefing", { state: current, templates });
  return { lines, text, markdown, question };
}

// ---------------------------------------------------------------------------
// The next step
// ---------------------------------------------------------------------------

/**
 * What comes now, in the life of a video: `{ action, command, say }`. `command` is the exact
 * command to run, or null when the next move is a question to the member; then `after_yes`,
 * `answer_command` and `decide_command` say what to run once the member has answered.
 */
export function nextStep(state, { scriptCommand = SCRIPT_COMMAND, bank = null, kit = null } = {}) {
  const data = bank ?? ownBank();
  const current = shape(clone(state ?? {}));
  const slug = current.slug ?? "<vídeo>";
  const run = (text) => `${scriptCommand} ${text} --json`;
  const files = current.files ?? {};
  const brand = brandOf(current, kit);
  const plan = pendingPlan(current, data, kit);

  if (plan && !plan.wait) {
    const about = { round1: "sobre o vídeo", round2: "sobre a história", round3: "sobre o jeito do vídeo", partial: "antes de começar" }[plan.stage] ?? "";
    const count = plan.ids.length === 1 ? "uma pergunta rápida" : `${countName(plan.ids.length, true)} perguntas rápidas`;
    const step = { action: "ask", command: null, say: `Tenho ${count} ${about}.`.replace(" .", "."), answer_command: run(`answer ${slug} <id> <valor>`), decide_command: run(`answer ${slug} --decide`) };
    // the member already replied to this round and left some questions out: the round's note promises the defaults
    const recorded = current.rounds.find((entry) => entry?.n === plan.n);
    const replied = (recorded?.ids ?? []).some((id) => current.answers.some((entry) => entry?.id === id && !entry.decided));
    if (replied) step.hint = `Se o integrante já respondeu o que quis desta rodada, rode ${step.decide_command}: o que ficou sem resposta vai pelo padrão, como a rodada promete.`;
    return step;
  }
  if (needsCapture(current, kit)) {
    if (brand.site) return { action: "capture", command: run(`capture ${slug}`), say: `Vou visitar ${brand.host ?? "o site da marca"} para pegar o logo, as cores e as telas reais; leva um ou dois minutos.` };
    const who = ofBrand(brand, { withHost: false }).replace(/^para /, "de ");
    return {
      action: "capture",
      command: run(`capture ${slug} --url <endereço do site>`),
      say: `Vou procurar o site oficial ${who || "da marca"} para pegar o logo, as cores e as telas reais.`,
      hint: `Procure o site oficial e ponha o endereço no lugar de <endereço do site>. A marca não tem site? Registre com ${run(`answer ${slug} marca "${brand.name ?? brand.handle ?? "<nome>"}, sem site"`)} e o vídeo segue com o nome em texto.`,
    };
  }
  if (awaitsConfirmation(current, kit)) {
    const question = questionFor(data, "conferir_marca", { state: current, kit });
    return { action: "confirm_brand", command: null, say: question?.text ?? "Preciso confirmar se encontrei a marca certa.", answer_command: run(`answer ${slug} conferir_marca <valor>`) };
  }
  if ((current.mode === "guided" || isRouteMismatch(current)) && !current.approvals?.brief) {
    if (current.status !== "brief") return { action: "echo", command: run(`brief ${slug}`), say: "Vou escrever o plano completo do vídeo para você conferir antes de eu construir." };
    return { action: "approve_brief", command: null, say: "Posso construir assim?", after_yes: run(`approve ${slug} brief`) };
  }
  if (!files.roteiro) return { action: "build", command: run(`build ${slug}`), say: "Vou escrever o roteiro e montar a página do vídeo." };
  if (!files.preview) return { action: "preview", command: run(`preview ${slug}`), say: "Vou fazer a prévia com som; leva alguns minutos." };
  if (!current.approvals?.preview && valueOf(current, "skip_preview") !== true && !files.final) {
    return { action: "approve_preview", command: null, say: "A prévia está pronta. Posso fazer o vídeo final?", after_yes: run(`approve ${slug} preview`) };
  }
  if (!files.final) return { action: "final", command: run(`final ${slug}`), say: "Vou renderizar o vídeo final em alta qualidade." };
  if (current.status !== "delivered") return { action: "deliver", command: run(`open ${slug} final`), say: "O vídeo final está pronto; vou abrir para você." };
  return { action: "done", command: null, say: "Vídeo entregue." };
}

// ---------------------------------------------------------------------------
// The beat grid of a duration
// ---------------------------------------------------------------------------

/**
 * Whole bars and a tempo between 100 and 140 BPM whose length is the duration asked for (within
 * a hundredth of a second), as close to 120 BPM as it gets; a tie goes to the faster one. When no
 * pair fits, the duration is rounded to the nearest whole bar at 120 BPM and `warning` says so.
 */
export function solveTiming(seconds) {
  const asked = Number(seconds);
  const wanted = Number.isFinite(asked) && asked > 0 ? Math.min(DURATION.max, Math.max(DURATION.min, asked)) : 15;
  let best = null;
  for (let bars = 1; bars <= 16; bars++) {
    const ideal = (bars * 240) / wanted;
    for (const bpm of new Set([Math.floor(ideal), Math.ceil(ideal)])) {
      if (bpm < 100 || bpm > 140) continue;
      if (Math.abs((bars * 240) / bpm - wanted) > 0.01 + 1e-9) continue;
      const distance = Math.abs(bpm - 120);
      if (!best || distance < best.distance || (distance === best.distance && bpm > best.bpm)) best = { bars, bpm, distance };
    }
  }
  let warning = null;
  const seen = (value) => String(round(value, 2)).replace(".", ",");
  if (wanted !== asked) warning = `Nesta versão o vídeo tem de ${DURATION.min} a ${DURATION.max} segundos: usei ${seen(wanted)} s no lugar de ${Number.isFinite(asked) ? seen(asked) : String(seconds)} s.`;
  if (!best) {
    const bars = Math.max(1, Math.round(wanted / 2));
    best = { bars, bpm: 120 };
    warning = `${seen(wanted)} s não fecha em compassos inteiros entre 100 e 140 BPM: usei ${bars} compassos a 120 BPM (${bars * 2} s).`;
  }
  return {
    bars: best.bars,
    bpm: best.bpm,
    duration: round((best.bars * 240) / best.bpm, 4),
    beat_s: round(60 / best.bpm, 6),
    bar_s: round(240 / best.bpm, 6),
    exact: warning === null,
    warning,
  };
}
