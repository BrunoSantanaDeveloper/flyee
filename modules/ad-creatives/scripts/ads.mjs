#!/usr/bin/env node
// Criativos para anúncios: the commands the member's AI runs.
//   node .flyee/modules/ad-creatives/scripts/ads.mjs <command> [options] [--json]
// A campaign lives in ./anuncios/<campanha>/: the briefing, the research, the evidence, the
// concepts, the pieces, the delivery and the journal. The Motor de vídeo (video-render) captures
// the brand's site, renders, mixes and checks; this script never draws a pixel. Only JSON goes
// to stdout with --json; progress goes to stderr; every failure has a stable code; every result
// carries `next_step` with what comes next.

import { readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { actorInput, adsToItems, collectionSources, looksLikeAdList } from "./lib/adlibrary.mjs";
import { apifyAccess, apifyApi, canCollect, chargeCeiling, estimateUsd, keySetup, runActor } from "./lib/apify.mjs";
import { brl, learningBudget } from "./lib/budget.mjs";
import { ADS_DIR, addJournal, briefingTemplate, campaignSlug, checkBriefing, hostOf, layout, parseMoney, readJournal, readState, requireCampaign, writeState } from "./lib/campaign.mjs";
import { approvalContent, checkConcepts, CONFIDENCE_LABELS, confidenceChanges, ENABLED_PLACEMENTS, PLACEMENTS, TEMPLATES } from "./lib/concepts.mjs";
import { checkCopy } from "./lib/copy.mjs";
import { CAPTURE_ERRORS, engineArgs, findVideoRender, INSTALL_VIDEO_RENDER, INSTALL_VIDEO_RENDER_FIX, requireVideoRender, runEngine } from "./lib/engine.mjs";
import { adCardsToItems, applyTags, declaredToItems, mergeItems, readEvidence, readingKind, summarize } from "./lib/evidence.mjs";
import { copyFile, dirsIn, ensureDir, filesIn, hashJson, isFile, removeDir, sha256File } from "./lib/files.mjs";
import { campaignLinks, linksMarkdown } from "./lib/links.mjs";
import { commentsToItems, instagramPostsToItems, partnerApps, partnerKind } from "./lib/partners.mjs";
import { beatGrid, checkPiece, checkPoster, draftPiece, eventsOf, FONT_FILE, fontWeight, IMAGE_FILE, imageSize, imageTarget, pageHtml, paletteFrom, posterOf, screenTexts } from "./lib/pieces.mjs";
import { conceptsMarkdown, evidenceMarkdown, launchMarkdown, textsMarkdown } from "./lib/report.mjs";
import { AppError, isoDay, parseArgs, progress, projectRoot, readJson, slugify, toPosix, writeFileAtomic, writeJson } from "./lib/util.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(SCRIPTS_DIR, "..");
const ROOT = projectRoot(SCRIPTS_DIR);
const MANIFEST = readJson(join(APP_DIR, "flyee.module.json"), {});
const APP = { name: MANIFEST.name ?? "ad-creatives", version: MANIFEST.version ?? "0.0.0" };
const INTERFACE_VERSION = 1;
const SCRIPT_COMMAND = `node ${toPosix(ROOT, join(SCRIPTS_DIR, "ads.mjs"))}`;
const LABELS = readJson(join(APP_DIR, "references", "etiquetas.json"), { dimensions: {} });
const META = readJson(join(APP_DIR, "references", "meta-anuncios.json"), {});
const SOURCES = readJson(join(APP_DIR, "references", "fontes.json"), {});
const RUNTIME_FILES = ["ad.js", "ad.css"];
const FPS = 30;
/** How long a paid collection stays fresh, in hours: the same search the next day is paid again. */
const FRESH_COLLECTION_HOURS = 24;
const ARG_SPEC = {
  flags: ["json", "force", "refresh", "confirm-cost"],
  options: ["cost", "daily", "event", "note", "kind", "url", "template", "apify-url"],
};

const rel = (path) => toPosix(ROOT, path);
const command = (text) => `${SCRIPT_COMMAND} ${text} --json`;
const usage = (message, fix = "Rode o comando help para ver as opções.") => new AppError("usage", message, fix);
const fail = (code, message, fix, details = null) => Object.assign(new AppError(code, message, fix), { details });
const nowIso = () => new Date().toISOString();
const engineCall = (engine, args) => runEngine(engine, args, { root: ROOT });
const base = (name) => ({ ok: true, command: name, interface_version: INTERFACE_VERSION, app: APP });

function errorOf(error) {
  const known = error instanceof AppError;
  return {
    code: known ? error.code : "unexpected",
    message: known ? error.message : `Erro inesperado: ${error?.message ?? error}`,
    fix: known ? error.fix : "Tente de novo; se repetir, rode o comando check e guarde esta mensagem.",
    ...(error?.details ? { details: error.details } : {}),
  };
}

// ---------------------------------------------------------------- the campaign and its files

function campaignOf(name) {
  const { slug, paths } = requireCampaign(ROOT, name, { scriptCommand: SCRIPT_COMMAND });
  return { slug, paths, state: readState(paths, slug) };
}

function briefOf(ctx) {
  return checkBriefing(readFileSync(ctx.paths.briefing, "utf8"));
}

function requireBrief(ctx, fields, what) {
  const checked = briefOf(ctx);
  const missing = fields.filter((field) => {
    const value = checked.brief[field];
    return value === undefined || value === null || (Array.isArray(value) && !value.length);
  });
  if (missing.length) {
    throw fail("brief_incomplete", `O briefing ainda não tem ${what}.`, `Pergunte ao integrante, grave em ${rel(ctx.paths.briefing)} e rode ${command(`brief ${ctx.slug}`)}.`, { missing });
  }
  return checked.brief;
}

function loadConcepts(ctx, { brief, evidence }) {
  if (!isFile(ctx.paths.concepts)) {
    throw new AppError("concepts_missing", `Ainda não há conceitos em ${rel(ctx.paths.concepts)}.`, `Escreva os conceitos no formato de references/conceitos.md e rode ${command(`concepts ${ctx.slug}`)}.`);
  }
  const data = readJson(ctx.paths.concepts, null);
  if (!data) throw new AppError("concepts_invalid", `${rel(ctx.paths.concepts)} não é um JSON válido.`, "Confira vírgulas e aspas e rode concepts de novo.");
  return checkConcepts(data, { evidence, labels: LABELS, brief, root: ROOT, campaignDir: ctx.paths.dir, enabled: ENABLED_PLACEMENTS });
}

function approvalOf(ctx, concepts) {
  const approved = ctx.state.approvals?.concepts ?? null;
  const hash = hashJson(concepts.map(approvalContent));
  return { approved: Boolean(approved), current: Boolean(approved) && approved.hash === hash, at: approved?.at ?? null, hash, confidence_changes: confidenceChanges(concepts, approved) };
}

function requireApproved(ctx, concepts) {
  const approval = approvalOf(ctx, concepts);
  if (!approval.current) {
    throw new AppError(
      "concepts_not_approved",
      approval.approved ? "Os conceitos mudaram depois do sim do integrante." : "Falta o sim do integrante aos conceitos.",
      `Mostre as fichas (${rel(ctx.paths.conceptsMd)}) e, com o sim dele, rode ${command(`approve ${ctx.slug} concepts`)}.`,
    );
  }
  return approval;
}

function conceptOf(concepts, key, ctx) {
  const concept = concepts.find((candidate) => candidate.key === key);
  if (!concept) throw new AppError("concept_not_found", `Não há o conceito "${key}" em ${rel(ctx.paths.concepts)}.`, `Os conceitos são: ${concepts.map((candidate) => candidate.key).join(", ")}.`);
  return concept;
}

/** Everything a concept's commands need, checked in the same order every time. */
function conceptContext(name, key, { needsApproval = true } = {}) {
  if (!key) throw usage("Informe a campanha e o conceito: <comando> <campanha> <conceito>.");
  const ctx = campaignOf(name);
  const brief = briefOf(ctx).brief;
  const evidence = readEvidence(ctx.paths.evidence, ctx.slug);
  const { concepts } = loadConcepts(ctx, { brief, evidence });
  if (needsApproval) requireApproved(ctx, concepts);
  return { ctx, brief, evidence, concepts, concept: conceptOf(concepts, key, ctx) };
}

// ---------------------------------------------------------------- check, new, list, status

async function checkCommand(values = {}) {
  const engine = findVideoRender(ROOT);
  let motor = null;
  let motorError = null;
  if (engine.installed) {
    try {
      const result = await engineCall(engine, engineArgs.check());
      motor = { render: Boolean(result.modes?.render), ffmpeg: result.tools?.ffmpeg ?? null, browser: result.tools?.browser?.name ?? null, install: result.install ?? {}, install_note: result.install_note ?? null };
    } catch (error) {
      motorError = errorOf(error);
    }
  }
  const campaigns = listCampaigns();
  const install = !engine.installed
    ? { say: "As peças em vídeo usam o app Motor de vídeo, que ainda não está neste projeto.", command: INSTALL_VIDEO_RENDER, how: INSTALL_VIDEO_RENDER_FIX }
    : motor && Object.keys(motor.install).length
      ? { say: "Faltam programas que o Motor de vídeo usa para renderizar.", commands: motor.install, how: motor.install_note ?? "Rode você mesmo cada comando, com tempo limite longo, e repita o check." }
      : null;
  const access = await apifyAccess({ api: apifyApi(values["apify-url"]) });
  const collects = canCollect(access);
  return {
    ...base("check"),
    node: process.versions.node,
    project: ROOT,
    engine: { installed: engine.installed, version: engine.version, ...(motor ?? {}), error: motorError },
    ready: Boolean(motor?.render),
    modes: { research: true, apify: collects, concepts: true, pieces: Boolean(motor?.render) },
    install,
    partners: partnerApps(ROOT),
    apify_key: collects,
    apify_key_from: access.from,
    apify_setup: collects ? null : keySetup(),
    prices: { checked_on: SOURCES.checked_on ?? null, ads_usd_each: SOURCES.ads?.usd_per_item ?? null, confirm_above_usd: SOURCES.cost_warn_usd ?? null },
    placements: ENABLED_PLACEMENTS.map((id) => PLACEMENTS[id]),
    meta_checked_on: META.checked_on ?? null,
    campaigns: campaigns.map((entry) => entry.campaign),
    next_step: install
      ? { action: "install", command: install.command ?? null, say: install.say }
      : campaigns.length
        ? { action: "status", command: command(`status ${campaigns[0].campaign}`), say: "Retome a campanha em andamento ou crie outra." }
        : { action: "new", command: command("new <campanha>"), say: "Crie a campanha com um nome curto." },
  };
}

function newCommand(positionals) {
  const name = positionals.join(" ").trim();
  if (!name) throw usage("Informe o nome da campanha: new <campanha>.", "Use um nome curto, como lancamento-outubro.");
  const slug = campaignSlug(name);
  if (!slug) throw usage(`"${name}" não serve como nome de pasta.`, "Use letras e números, como lancamento-outubro.");
  const paths = layout(ROOT, slug);
  const existed = isFile(paths.briefing);
  for (const dir of [paths.materials, paths.captures, paths.readings, paths.pieces]) ensureDir(dir);
  if (!existed) {
    writeFileAtomic(paths.briefing, briefingTemplate(slug));
    const state = readState(paths, slug);
    state.created_at = nowIso();
    writeState(paths, state);
    addJournal(paths, slug, { type: "created" });
  }
  return {
    ...base("new"),
    campaign: slug,
    created: !existed,
    dir: rel(paths.dir),
    files: { briefing: rel(paths.briefing), materials: rel(paths.materials), captures: rel(paths.captures), readings: rel(paths.readings) },
    next_step: { action: "brief", command: command(`brief ${slug}`), say: existed ? "A campanha já existia: confira o briefing." : "Preencha o briefing com o integrante, perguntando só o que falta, e rode brief." },
  };
}

function listCampaigns() {
  return dirsIn(join(ROOT, ADS_DIR))
    .filter((slug) => isFile(join(ROOT, ADS_DIR, slug, "briefing.md")))
    .map((slug) => {
      const ctx = { slug, paths: layout(ROOT, slug), state: readState(layout(ROOT, slug), slug) };
      const stage = stageOf(ctx);
      return { campaign: slug, dir: rel(ctx.paths.dir), stage: stage.stage, say: stage.say, round: ctx.state.round ?? 0 };
    });
}

function listCommand() {
  return { ...base("list"), dir: `${ADS_DIR}/`, campaigns: listCampaigns() };
}

/** Where a campaign is, and the one command that moves it forward. */
function stageOf(ctx) {
  const step = (stage, say, text) => ({ stage, say, command: text ? command(text) : null });
  const checked = briefOf(ctx);
  if (!checked.complete) return step("briefing", "O briefing tem campos em branco.", `brief ${ctx.slug}`);
  const evidence = readEvidence(ctx.paths.evidence, ctx.slug);
  if (!evidence.items.length) return step("pesquisa", "Falta a pesquisa: os links da Biblioteca de Anúncios e as capturas do integrante.", `links ${ctx.slug}`);
  if (!isFile(ctx.paths.concepts)) return step("conceitos", "Falta escrever os conceitos a partir da evidência.", `evidence ${ctx.slug}`);
  let concepts;
  try {
    concepts = loadConcepts(ctx, { brief: checked.brief, evidence }).concepts;
  } catch (error) {
    return step("conceitos", `Os conceitos têm um problema: ${error.message}`, `concepts ${ctx.slug}`);
  }
  if (!approvalOf(ctx, concepts).current) return step("aprovacao", "Falta o sim do integrante aos conceitos.", `concepts ${ctx.slug}`);
  for (const concept of concepts) {
    const entry = ctx.state.pieces?.[concept.key];
    if (!entry?.page_hash) return step("pecas", `Falta a página da peça ${concept.key}.`, `piece ${ctx.slug} ${concept.key}`);
    if (!entry.preview?.id) return step("previa", `Falta a prévia da peça ${concept.key}.`, `preview ${ctx.slug} ${concept.key}`);
    if (ctx.state.approvals?.previews?.[concept.key]?.id !== entry.preview.id) return step("previa", `Falta o sim do integrante à prévia de ${concept.key}.`, `preview ${ctx.slug} ${concept.key}`);
    if (!entry.final?.passed || entry.final.id !== entry.preview.id) return step("final", `Falta o vídeo final conferido de ${concept.key}.`, `final ${ctx.slug} ${concept.key}`);
  }
  if (!ctx.state.copy?.passed) return step("textos", "Falta a conferência dos textos dos anúncios.", `copy ${ctx.slug}`);
  if (!ctx.state.delivered) return step("entrega", "Tudo conferido: falta montar a entrega.", `deliver ${ctx.slug}`);
  if ((ctx.state.round ?? 0) < (ctx.state.delivered.round ?? 1)) return step("diario", "Falta registrar a rodada no diário.", `journal ${ctx.slug}`);
  return step("pronta", "Rodada entregue e registrada. A próxima começa quando houver resultado da campanha.", null);
}

function statusCommand(positionals) {
  const ctx = campaignOf(positionals[0]);
  const stage = stageOf(ctx);
  const journal = readJournal(ctx.paths, ctx.slug);
  return {
    ...base("status"),
    campaign: ctx.slug,
    dir: rel(ctx.paths.dir),
    stage: stage.stage,
    round: ctx.state.round ?? 0,
    approvals: { concepts: ctx.state.approvals?.concepts?.at ?? null, previews: Object.fromEntries(Object.entries(ctx.state.approvals?.previews ?? {}).map(([key, value]) => [key, value.at])) },
    pieces: Object.fromEntries(Object.entries(ctx.state.pieces ?? {}).map(([key, entry]) => [key, { page: Boolean(entry.page_hash), preview: entry.preview ? { passed: entry.preview.passed, file: entry.preview.file } : null, final: entry.final ? { passed: entry.final.passed, file: entry.final.file } : null }])),
    copy: ctx.state.copy ? { passed: ctx.state.copy.passed, at: ctx.state.copy.at } : null,
    delivered: ctx.state.delivered ?? null,
    journal: { file: rel(ctx.paths.journal), entries: journal.entries.length },
    next_step: { action: stage.stage, command: stage.command, say: stage.say },
  };
}

// ---------------------------------------------------------------- brief, capture, budget

const PUBLIC_FIELDS = ["marca", "produto", "oferta", "preco", "pagina", "site", "botao", "evento", "verba_diaria", "custo_por_evento", "publico", "le_nome", "padrao", "angulos_site", "termos", "regras", "prova", "concorrentes", "palavras_busca", "perfis", "pais", "parametros_url"];

function briefCommand(positionals) {
  const ctx = campaignOf(positionals[0]);
  const checked = briefOf(ctx);
  const brief = checked.brief;
  const fields = Object.fromEntries(PUBLIC_FIELDS.filter((key) => brief[key] !== undefined && brief[key] !== null && !(Array.isArray(brief[key]) && !brief[key].length)).map((key) => [key, brief[key]]));
  const budget = brief.verba_diaria > 0 ? learningBudget({ daily: brief.verba_diaria, cost: brief.custo_por_evento, event: brief.evento ?? null }) : null;
  const capture = ctx.state.capture ?? null;
  const site = brief.site ?? brief.pagina ?? null;
  let next;
  if (!checked.complete) {
    next = { action: "ask", command: null, say: "Pergunte ao integrante, numa mensagem só, o que falta (questions). Grave as respostas no briefing.md, sem inventar oferta, preço ou número, e rode brief de novo." };
  } else if (site && !capture) {
    next = { action: "capture", command: command(`capture ${ctx.slug}`), say: "Copie a marca do site (logo, cores e telas) antes das peças." };
  } else {
    next = { action: "budget", command: command(`budget ${ctx.slug}`), say: "Faça a conta da verba e mostre ao integrante antes da pesquisa: ela pode mudar a conversa." };
  }
  return {
    ...base("brief"),
    campaign: ctx.slug,
    file: rel(ctx.paths.briefing),
    complete: checked.complete,
    missing: checked.missing,
    questions: checked.missing.map((entry) => entry.question),
    problems: checked.problems,
    fields,
    budget: budget ? { viable: budget.viable, max_cost_per_event: budget.max_cost_per_event, floor_per_set: budget.floor_per_set, say: budget.say } : null,
    capture: capture ? { site: capture.site, dir: capture.dir, failed: capture.failed ?? null } : null,
    next_step: next,
  };
}

async function captureCommand(positionals, values) {
  const ctx = campaignOf(positionals[0]);
  const brief = briefOf(ctx).brief;
  const address = values.url ?? brief.site ?? brief.pagina;
  if (!address) throw fail("brief_incomplete", "O briefing não tem o site da marca nem a página de destino.", `Pergunte o endereço ao integrante, grave no briefing.md e rode ${command(`capture ${ctx.slug}`)}.`, { missing: ["site"] });
  const host = hostOf(address);
  if (!host) throw usage(`Não reconheci o endereço ${address}.`, "Use o endereço completo do site, como https://www.exemplo.com.br.");
  const engine = requireVideoRender(ROOT);
  const out = join(ROOT, "capturas", host.replace(/\./g, "-"));
  progress(`Capturando ${host}: logo, cores e telas`);
  try {
    const result = await engineCall(engine, engineArgs.capture({ url: address, out: rel(out) }));
    ctx.state.capture = { at: nowIso(), site: result.site ?? host, dir: rel(out), failed: null };
    writeState(ctx.paths, ctx.state);
    const brand = result.brand ?? {};
    return {
      ...base("capture"),
      campaign: ctx.slug,
      captured: true,
      site: result.site ?? host,
      dir: rel(out),
      brand: { name: brand.name ?? null, logo: Boolean(brand.logo), colors: { primary: brand.colors?.primary ?? null, background: brand.colors?.background ?? null, text: brand.colors?.text ?? null }, headline: brand.headline ?? null },
      warnings: result.warnings ?? [],
      next_step: { action: "budget", command: command(`budget ${ctx.slug}`), say: brand.logo ? "Marca copiada. Siga para a conta da verba." : "O site não tinha um logo que o Motor reconhecesse: peça o arquivo do logo ao integrante e salve em materiais/ com o nome logo." },
    };
  } catch (error) {
    if (!(error instanceof AppError) || !CAPTURE_ERRORS.includes(error.code)) throw error;
    ctx.state.capture = { at: nowIso(), site: host, dir: rel(out), failed: error.code };
    writeState(ctx.paths, ctx.state);
    return {
      ...base("capture"),
      campaign: ctx.slug,
      captured: false,
      site: host,
      error: errorOf(error),
      next_step: { action: "materials", command: command(`budget ${ctx.slug}`), say: "Sem a captura, as peças usam o logo e as telas que o integrante puser em materiais/ e uma paleta neutra. Peça o logo e de duas a três telas do produto." },
    };
  }
}

function budgetCommand(positionals, values) {
  const ctx = campaignOf(positionals[0]);
  const brief = briefOf(ctx).brief;
  const daily = values.daily !== undefined ? parseMoney(values.daily) : brief.verba_diaria;
  if (values.daily !== undefined && !(daily > 0)) throw usage("--daily precisa ser um valor em reais, como 50 ou 1.500.");
  if (!(daily > 0)) throw fail("brief_incomplete", "O briefing ainda não tem a verba diária.", `Pergunte ao integrante, grave no briefing.md e rode ${command(`budget ${ctx.slug}`)}.`, { missing: ["verba"] });
  const cost = values.cost !== undefined ? parseMoney(values.cost) : brief.custo_por_evento;
  if (values.cost !== undefined && !(cost > 0)) throw usage("--cost precisa ser um valor em reais, como 45 ou 45,90.");
  const event = values.event ?? brief.evento ?? null;
  const result = learningBudget({ daily, cost, event });
  const from = { daily: values.daily !== undefined ? "option" : "briefing", cost: values.cost !== undefined ? "option" : cost ? "briefing" : null };
  writeJson(ctx.paths.budget, { ...result, computed_at: nowIso(), from });
  const next =
    result.viable === false
      ? { action: "decide", command: command(`links ${ctx.slug}`), say: "Mostre a conta e as três saídas ao integrante; a escolha é dele, e o app não escolhe. A pesquisa segue igual." }
      : result.viable === null
        ? { action: "ask", command: command(`links ${ctx.slug}`), say: "Mostre o custo máximo por evento e pergunte quanto o integrante aceita pagar; sem esse número, siga para a pesquisa." }
        : { action: "links", command: command(`links ${ctx.slug}`), say: "A verba cabe. Siga para a pesquisa dos concorrentes." };
  return { ...base("budget"), campaign: ctx.slug, ...result, from, file: rel(ctx.paths.budget), next_step: next };
}

// ---------------------------------------------------------------- research: links, import, evidence

const READING_TEMPLATE = {
  version: 1,
  kind: "ad_cards",
  competitor: "Nome da página, como aparece",
  collected_at: "AAAA-MM-DD",
  source: { type: "screenshot", ref: "pesquisa/capturas/<concorrente>/" },
  items: [
    {
      capture: "pesquisa/capturas/<concorrente>/01.png",
      status_text: "Ativo",
      started_text: "Veiculação iniciada em 3 de jul de 2026",
      variations_text: "3 anúncios usam esse criativo e esse texto",
      text: "o texto do anúncio, como aparece",
      cta: "Saiba mais",
      media: "video",
      tags: { angle: "presenca", hook_family: "pergunta", proof: "demonstracao", structure: "problema-mecanismo", visual: "pessoa-falando" },
    },
  ],
};

function linksCommand(positionals) {
  const ctx = campaignOf(positionals[0]);
  const brief = briefOf(ctx).brief;
  if (!brief.concorrentes?.length && !brief.palavras_busca?.length) {
    throw fail("brief_incomplete", "O briefing não tem concorrentes nem palavras de busca.", `Pergunte ao integrante de 3 a 5 concorrentes ou as palavras do nicho, grave no briefing.md e rode ${command(`links ${ctx.slug}`)}.`, { missing: ["concorrentes"] });
  }
  const links = campaignLinks(brief);
  const folders = links.competitors.map((competitor) => {
    const dir = join(ctx.paths.captures, slugify(competitor.who.replace(/^@/, ""), 30));
    ensureDir(dir);
    return { who: competitor.who, dir: rel(dir) };
  });
  writeFileAtomic(ctx.paths.links, linksMarkdown(links, { campaign: ctx.slug, folders }));
  return {
    ...base("links"),
    campaign: ctx.slug,
    file: rel(ctx.paths.links),
    country: links.country,
    competitors: links.competitors.map((competitor, index) => ({ ...competitor, captures: folders[index].dir })),
    searches: links.searches,
    script: links.script,
    readings_dir: rel(ctx.paths.readings),
    reading_template: READING_TEMPLATE,
    next_step: {
      action: "send_links",
      command: null,
      say: "Mande ao integrante os links e as cinco linhas do roteiro. Quando ele trouxer as capturas, leia cada cartão, copie os textos como aparecem em pesquisa/leituras/<concorrente>.json (reading_template) e rode import. Você nunca converte data ou número: o app converte.",
    },
  };
}

const usdText = (value) => `US$ ${Number(value).toFixed(2).replace(".", ",")}`;

/**
 * The same research through Apify, with the member's key: the Ad Library searches of `links`, run
 * by the collector of references/fontes.json with an item limit and a charge ceiling, the raw file
 * kept and every ad turned into evidence with its origin and date. Without the key, the manual
 * research is the way, and the result says so. A collection of less than a day is reused.
 */
async function collectCommand(positionals, values) {
  const ctx = campaignOf(positionals[0]);
  const brief = briefOf(ctx).brief;
  if (!brief.concorrentes?.length && !brief.palavras_busca?.length) {
    throw fail("brief_incomplete", "O briefing não tem concorrentes nem palavras de busca.", `Pergunte ao integrante de 3 a 5 concorrentes ou as palavras do nicho, grave no briefing.md e rode ${command(`collect ${ctx.slug}`)}.`, { missing: ["concorrentes"] });
  }
  const links = campaignLinks(brief);
  const sources = collectionSources(links, { perSearch: SOURCES.per_search ?? 30 }).slice(0, SOURCES.max_sources ?? 12);
  const access = await apifyAccess({ api: apifyApi(values["apify-url"]) });
  if (!canCollect(access)) {
    return {
      ...base("collect"),
      campaign: ctx.slug,
      mode: "manual",
      collected: false,
      key: keySetup(),
      next_step: { action: "manual", command: command(`links ${ctx.slug}`), say: "Sem a chave do Apify, a pesquisa é a guiada: mande os links e o roteiro ao integrante. Se ele quiser a coleta automática, siga o que key diz para guardar a chave e rode collect de novo." },
    };
  }
  const sourcesHash = hashJson(sources.map((source) => [source.url, source.limit]));
  const previous = ctx.state.collect;
  const rawPrevious = previous?.raw ? resolve(ROOT, previous.raw) : null;
  if (!values.refresh && previous?.hash === sourcesHash && rawPrevious && isFile(rawPrevious) && Date.now() - Date.parse(previous.at) < FRESH_COLLECTION_HOURS * 3.6e6) {
    const evidence = readEvidence(ctx.paths.evidence, ctx.slug);
    return { ...base("collect"), campaign: ctx.slug, mode: "apify", collected: false, cached: true, raw: previous.raw, cost: null, counts: summarize(evidence, { labels: LABELS }).counts, next_step: { action: "evidence", command: command(`evidence ${ctx.slug}`), say: "A coleta de hoje já está na evidência; nada foi cobrado de novo. Para colher de novo, use --refresh." } };
  }
  const { total, input } = actorInput(sources, { country: links.country });
  const estimate = estimateUsd(SOURCES.ads ?? {}, total);
  const ceiling = SOURCES.cost_warn_usd ?? 1;
  if (estimate > ceiling && !values["confirm-cost"]) {
    throw new AppError("needs_confirmation", `Colher até ${total} anúncios de ${sources.length} busca(s) deve custar até ${usdText(estimate)} no Apify, acima do limite de ${usdText(ceiling)} que o app pede para confirmar.`, "Diga o valor ao integrante. Com o sim, repita com --confirm-cost; ou tire concorrentes e palavras do briefing.");
  }
  const collected = await runActor({
    actor: SOURCES.ads.actor,
    input,
    token: access.key,
    maxItems: total,
    maxChargeUsd: chargeCeiling(estimate),
    api: apifyApi(values["apify-url"]),
    label: `${sources.length} busca(s) na Biblioteca de Anúncios`,
  });
  const collectedAt = isoDay();
  const raw = join(ctx.paths.research, "apify", `anuncios-${collectedAt}-${slugify(collected.run.id, 24)}.json`);
  writeJson(raw, { format_version: 1, kind: "apify_ads", actor: SOURCES.ads.actor, run_id: collected.run.id, collected_at: collectedAt, sources, cost: { estimate_usd: estimate, charged_usd: collected.run.usage_usd }, items: collected.items });
  const items = adsToItems(collected.items, { collectedAt, actor: SOURCES.ads.actor });
  const evidence = readEvidence(ctx.paths.evidence, ctx.slug);
  const merged = mergeItems(evidence, items);
  const summary = saveEvidence(ctx, evidence);
  ctx.state.collect = { at: nowIso(), hash: sourcesHash, raw: rel(raw), run_id: collected.run.id };
  writeState(ctx.paths, ctx.state);
  const pages = [...new Set(items.map((item) => item.who))];
  const fold = (text) => String(text).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const warnings = [];
  for (const competitor of links.competitors.filter((entry) => entry.kind === "name")) {
    if (!pages.some((page) => fold(page).includes(fold(competitor.who).replace(/^@/, "")))) warnings.push(`A busca por ${competitor.who} não trouxe anúncios de uma página com esse nome: confira o nome com o integrante, ou use as palavras do nicho.`);
  }
  if (collected.items.length >= total) warnings.push(`A coleta parou no limite de ${total} anúncios: pode haver mais.`);
  return {
    ...base("collect"),
    campaign: ctx.slug,
    mode: "apify",
    collected: true,
    sources: sources.map((source) => ({ kind: source.kind, who: source.who, limit: source.limit })),
    ads: items.length,
    pages,
    added: merged.added.length,
    replaced: merged.replaced.length,
    raw: rel(raw),
    cost: { estimate_usd: estimate, charged_usd: collected.run.usage_usd, run_id: collected.run.id },
    counts: summary.counts,
    warnings: [...warnings, ...summary.warnings],
    next_step: { action: "tag", command: command(`evidence ${ctx.slug}`), say: "Leia o texto de cada anúncio, tire da análise (leitura tags, exclude) o que não fala com o mesmo público, etiquete os ativos e rode evidence. Diga ao integrante quanto a coleta custou." },
  };
}

/** A file the member's AI points at, inside the project: from the campaign folder or from the root. */
function projectInput(ctx, path) {
  for (const baseDir of [process.cwd(), ctx.paths.dir, ROOT]) {
    const full = resolve(baseDir, path);
    const inside = relative(ROOT, full);
    if (inside.startsWith("..") || isAbsolute(inside)) continue;
    if (isFile(full)) return full;
  }
  throw new AppError("not_found", `Não encontrei ${path} no projeto.`, "Passe o caminho a partir da raiz do projeto ou da pasta da campanha.");
}

function readInput(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""));
  } catch {
    throw new AppError("reading_invalid", `${rel(file)} não é um JSON válido.`, "Confira vírgulas e aspas; o formato está em references/pesquisa-manual.md.");
  }
}

function saveEvidence(ctx, evidence) {
  evidence.campaign = ctx.slug;
  writeJson(ctx.paths.evidence, evidence);
  const summary = summarize(evidence, { labels: LABELS });
  writeFileAtomic(ctx.paths.evidenceMd, evidenceMarkdown(summary, { campaign: ctx.slug, labels: LABELS, updatedAt: evidence.updated_at ?? nowIso() }));
  return summary;
}

function importCommand(positionals) {
  if (positionals.length !== 2) throw usage("Informe a campanha e o arquivo: import <campanha> <arquivo .json>.");
  const ctx = campaignOf(positionals[0]);
  const file = projectInput(ctx, positionals[1]);
  const data = readInput(file);
  const partner = partnerKind(data);
  const kind = readingKind(data) ?? (data?.kind === "apify_ads" ? "apify_ads" : looksLikeAdList(data) ? "apify_list" : partner);
  const evidence = readEvidence(ctx.paths.evidence, ctx.slug);
  const options = { file: rel(file), root: ROOT, campaignDir: ctx.paths.dir, labels: LABELS, today: isoDay() };
  let merged = { added: [], replaced: [] };
  let tagged = [];
  if (kind === "ad_cards") merged = mergeItems(evidence, adCardsToItems(data, options));
  else if (kind === "declared") merged = mergeItems(evidence, declaredToItems(data, options));
  else if (kind === "tags") tagged = applyTags(data, evidence, options);
  else if (kind === "apify_ads") merged = mergeItems(evidence, adsToItems(data.items ?? [], { collectedAt: data.collected_at ?? isoDay(), actor: data.actor ?? SOURCES.ads?.actor }));
  // a list of the collector's ads saved by hand carries no date: the day the file was saved is the closest one
  else if (kind === "apify_list") merged = mergeItems(evidence, adsToItems(data, { collectedAt: isoDay(statSync(file).mtime), actor: SOURCES.ads?.actor }));
  else if (kind === "instagram_posts") merged = mergeItems(evidence, instagramPostsToItems(data, options));
  else if (kind === "instagram_comments" || kind === "youtube_comments") merged = mergeItems(evidence, commentsToItems(data, kind, options));
  else {
    throw new AppError("reading_invalid", `${rel(file)} não é uma leitura que o app conhece.`, "Uma leitura tem version 1 e kind ad_cards (cartões de anúncios), declared (o que o integrante diz) ou tags (etiquetas); o app também lê a coleta do Apify, um perfil ou uma comparação da Pesquisa no Instagram e os comentários das Pesquisas no Instagram e no YouTube. Os formatos estão em references/pesquisa-manual.md.");
  }
  if (!merged.added.length && !merged.replaced.length && !tagged.length) {
    throw new AppError("reading_invalid", `${rel(file)} não trouxe nenhum item para a evidência.`, "Confira se é o arquivo certo: um perfil sem posts acima do normal, por exemplo, não vira evidência.");
  }
  const summary = saveEvidence(ctx, evidence);
  return {
    ...base("import"),
    campaign: ctx.slug,
    file: rel(file),
    kind,
    added: merged.added,
    replaced: merged.replaced,
    tagged,
    counts: summary.counts,
    evidence: rel(ctx.paths.evidenceMd),
    warnings: summary.warnings,
    next_step: summary.untagged.length
      ? { action: "tag", command: null, say: "Etiquete os anúncios ativos (uma leitura kind tags, com os valores de references/etiquetas.json) e rode import com ela; sem etiquetas, os padrões do mercado não aparecem." }
      : { action: "evidence", command: command(`evidence ${ctx.slug}`), say: "Leia o resumo da evidência antes de escrever os conceitos." },
  };
}

function evidenceCommand(positionals) {
  const ctx = campaignOf(positionals[0]);
  const evidence = readEvidence(ctx.paths.evidence, ctx.slug);
  const summary = saveEvidence(ctx, evidence);
  return {
    ...base("evidence"),
    campaign: ctx.slug,
    file: rel(ctx.paths.evidenceMd),
    ...summary,
    items: evidence.items.filter((item) => !item.excluded).map((item) => ({ id: item.id, kind: item.kind, who: item.who, source: item.source.type, collected_at: item.source.collected_at, days_active: item.data.days_active ?? null, tags: item.tags })),
    next_step: summary.counts.used
      ? { action: "write_concepts", command: command(`concepts ${ctx.slug}`), say: "Escreva três conceitos em conceitos.json, um por barreira ou motivador, cada um citando os ids da evidência que o apoiam (references/conceitos.md) e rode concepts. Sem evidência, o conceito é uma aposta, e a ficha diz isso." }
      : { action: "research", command: command(`links ${ctx.slug}`), say: "Ainda não há evidência: comece pela pesquisa." },
  };
}

// ---------------------------------------------------------------- concepts and approvals

function conceptsCommand(positionals) {
  const ctx = campaignOf(positionals[0]);
  const brief = briefOf(ctx).brief;
  const evidence = readEvidence(ctx.paths.evidence, ctx.slug);
  const { concepts, warnings } = loadConcepts(ctx, { brief, evidence });
  const data = readJson(ctx.paths.concepts, {});
  writeJson(ctx.paths.concepts, { ...data, version: data.version ?? 1, campaign: ctx.slug, checked_at: nowIso(), concepts });
  const approval = approvalOf(ctx, concepts);
  writeFileAtomic(ctx.paths.conceptsMd, conceptsMarkdown(concepts, { campaign: ctx.slug, evidence, labels: LABELS, approval: approval.current ? ctx.state.approvals.concepts : null, warnings }));
  return {
    ...base("concepts"),
    campaign: ctx.slug,
    cards: rel(ctx.paths.conceptsMd),
    file: rel(ctx.paths.concepts),
    concepts: concepts.map((concept) => ({
      key: concept.key,
      angle: concept.angle,
      driver: concept.driver.type,
      hook: concept.hook.text,
      template: concept.template,
      confidence: concept.confidence,
      confidence_label: CONFIDENCE_LABELS[concept.confidence],
      confidence_basis: concept.confidence_basis,
      evidence: (concept.evidence ?? []).length,
      against: (concept.against ?? []).length,
      ad_name: concept.ad_name,
    })),
    approval,
    warnings,
    next_step: approval.current
      ? approval.confidence_changes.length
        ? { action: "tell", command: command(`piece ${ctx.slug} ${concepts[0].key}`), say: "Evidência nova mudou a confiança de um conceito aprovado: diga ao integrante o que mudou (confidence_changes). A aprovação continua valendo." }
        : { action: "piece", command: command(`piece ${ctx.slug} ${concepts[0].key}`), say: "Conceitos aprovados. Faça a peça de cada um." }
      : { action: "approve", command: command(`approve ${ctx.slug} concepts`), say: "Mostre as fichas ao integrante (cards), com a confiança e a evidência de cada conceito, e pergunte se aprova os três. Com o sim, rode approve." },
  };
}

function approveCommand(positionals) {
  const [name, what, key] = positionals;
  const ctx = campaignOf(name);
  if (what === "concepts") {
    const brief = briefOf(ctx).brief;
    const evidence = readEvidence(ctx.paths.evidence, ctx.slug);
    const { concepts, warnings } = loadConcepts(ctx, { brief, evidence });
    const approval = {
      at: nowIso(),
      hash: hashJson(concepts.map(approvalContent)),
      keys: concepts.map((concept) => concept.key),
      confidence: Object.fromEntries(concepts.map((concept) => [concept.key, concept.confidence])),
    };
    ctx.state.approvals = { ...(ctx.state.approvals ?? {}), concepts: approval };
    writeState(ctx.paths, ctx.state);
    addJournal(ctx.paths, ctx.slug, { type: "approval", what: "concepts", keys: approval.keys, confidence: approval.confidence });
    writeFileAtomic(ctx.paths.conceptsMd, conceptsMarkdown(concepts, { campaign: ctx.slug, evidence, labels: LABELS, approval, warnings }));
    return { ...base("approve"), campaign: ctx.slug, approved: "concepts", at: approval.at, keys: approval.keys, next_step: { action: "piece", command: command(`piece ${ctx.slug} ${approval.keys[0]}`), say: "Faça a peça de cada conceito." } };
  }
  if (what === "preview") {
    if (!key) throw usage("Informe o conceito: approve <campanha> preview <conceito>.");
    const entry = ctx.state.pieces?.[key];
    if (!entry?.preview?.id) throw new AppError("preview_missing", `A peça ${key} ainda não tem prévia.`, `Rode ${command(`preview ${ctx.slug} ${key}`)} e mostre ao integrante.`);
    const dir = join(ctx.paths.pieces, key);
    if (entry.preview.page_hash !== pageHash(dir) || entry.peca_hash !== hashJson(readJson(join(dir, "peca.json")))) {
      throw new AppError("preview_outdated", `A peça ${key} mudou depois da prévia que o integrante viu.`, `Refaça a prévia com ${command(`preview ${ctx.slug} ${key}`)} e mostre de novo.`);
    }
    if (!entry.preview.passed) throw new AppError("preview_failed", `A prévia de ${key} reprovou na conferência (${(entry.preview.failed ?? []).join(", ")}).`, "Corrija a peça e refaça a prévia: o sim vale só para uma prévia conferida.");
    ctx.state.approvals = { ...(ctx.state.approvals ?? {}), previews: { ...(ctx.state.approvals?.previews ?? {}), [key]: { at: nowIso(), id: entry.preview.id } } };
    writeState(ctx.paths, ctx.state);
    addJournal(ctx.paths, ctx.slug, { type: "approval", what: "preview", concept: key });
    return { ...base("approve"), campaign: ctx.slug, approved: "preview", concept: key, next_step: { action: "final", command: command(`final ${ctx.slug} ${key}`), say: "Faça o vídeo final." } };
  }
  throw usage("O que o integrante aprovou: approve <campanha> concepts, ou approve <campanha> preview <conceito>.");
}

// ---------------------------------------------------------------- pieces

function pageHash(dir) {
  const sha = (name) => (isFile(join(dir, name)) ? sha256File(join(dir, name)) : null);
  const images = filesIn(join(dir, "imagens")).map((file) => [relative(dir, file).split(sep).join("/"), sha256File(file)]);
  return hashJson({ page: sha("pagina.html"), poster: sha("imagem.html"), ad: sha("ad.js"), css: sha("ad.css"), motion: sha("motion.js"), images });
}

const hasImage = (formats) => (formats ?? []).some((id) => PLACEMENTS[id]?.kind === "image");

/** The safe zones the pieces use, read from the Motor's table of networks: the ad zone in 9:16. */
async function adZones(engine) {
  const result = await engineCall(engine, engineArgs.networks());
  const list = Array.isArray(result.networks) ? result.networks : Object.entries(result.networks ?? {}).map(([id, network]) => ({ id, ...network }));
  const ads = list.find((network) => network.id === "ads_meta");
  if (!ads?.safe_zone?.["9:16"]) {
    throw new AppError("video_render_outdated", "O Motor de vídeo instalado não conhece a zona segura dos anúncios da Meta.", "Rode você mesmo npx --yes flyee@latest update --yes --json, com tempo limite de 10 minutos, e repita.");
  }
  const feedAds = list.find((network) => network.id === "ads_meta_feed");
  const zones = { "9:16": ads.safe_zone["9:16"] };
  for (const format of ["4:5", "1:1"]) zones[format] = feedAds?.safe_zone?.[format] ?? result.formats?.[format]?.safe_zone ?? null;
  return { zones, checked_on: result.checked_on ?? null, source: feedAds ? "ads_meta_feed" : "ads_meta" };
}

/** The capture of the brand's site this campaign uses, if any. */
function findCapture(ctx, brief) {
  const host = hostOf(brief.site) ?? hostOf(brief.pagina);
  const dirs = [];
  if (ctx.state.capture?.dir && !ctx.state.capture.failed) dirs.push(resolve(ROOT, ctx.state.capture.dir));
  if (host) dirs.push(join(ROOT, "capturas", host.replace(/\./g, "-")));
  for (const dir of dirs) {
    const data = readJson(join(dir, "captura.json"), null);
    if (data) return { dir, data };
  }
  return null;
}

/**
 * The brand of the pieces: the member's own files in materiais/ first (logo, fonts, screens named
 * tela, print or screen), then the capture of the site; colours from the capture, else neutral.
 * Copies what the page uses into the piece's imagens/ folder.
 */
function collectAssets(ctx, brief, dir) {
  const imagesDir = join(dir, "imagens");
  removeDir(imagesDir);
  ensureDir(imagesDir);
  const capture = findCapture(ctx, brief);
  const materials = filesIn(ctx.paths.materials);
  const warnings = [];
  const copyInto = (source, prefix, index) => {
    const target = imageTarget(prefix, index, source);
    copyFile(source, join(dir, target));
    return target.split(sep).join("/");
  };
  let logo = null;
  const memberLogo = materials.find((file) => /^logo/i.test(file.split(sep).pop()) && IMAGE_FILE.test(file));
  if (memberLogo) logo = { src: copyInto(memberLogo, "logo", null), from: "materiais" };
  else if (capture?.data?.brand?.logo?.file && isFile(join(capture.dir, capture.data.brand.logo.file))) logo = { src: copyInto(join(capture.dir, capture.data.brand.logo.file), "logo", null), from: "site" };
  const fonts = materials.filter((file) => FONT_FILE.test(file)).slice(0, 2).map((file, index) => ({ file: copyInto(file, "fonte", index), weight: fontWeight(file.split(sep).pop()) }));
  // a portrait screen scrolls inside its frame (rolar); a wide one zooms in
  const scrolls = (file) => {
    const size = imageSize(file);
    return Boolean(size && size.height / size.width > 0.9);
  };
  const screens = materials.filter((file) => /^(?:tela|print|screen|captura)/i.test(file.split(sep).pop()) && /\.(?:png|jpe?g|webp)$/i.test(file));
  const images = screens.slice(0, 4).map((file, index) => ({ src: copyInto(file, "tela", index), from: "materiais", tall: scrolls(file) }));
  if (!images.length && capture) {
    const mobile = capture.data.files?.mobile ? join(capture.dir, capture.data.files.mobile) : join(capture.dir, "mobile.png");
    if (isFile(mobile)) images.push({ src: copyInto(mobile, "tela", 0), from: "site", tall: scrolls(mobile) });
  }
  if (!logo) warnings.push(capture ? "O site capturado não trouxe um logo: a peça mostra o nome da marca em texto. Peça o arquivo do logo e salve em materiais/ com o nome logo." : "Sem logo: a peça mostra o nome da marca em texto. Peça o arquivo do logo e salve em materiais/ com o nome logo.");
  const colors = paletteFrom(capture?.data?.brand?.colors ?? {});
  if (!capture?.data?.brand?.colors?.primary) warnings.push("Sem a cor de destaque da marca: a peça usa a paleta neutra. Capture o site ou peça as cores ao integrante.");
  return {
    brand: { name: brief.marca ?? capture?.data?.brand?.name ?? "", logo: logo?.src ?? null, colors, fonts },
    images,
    sources: { logo: logo?.from ?? null, colors: capture?.data?.brand?.colors?.primary ? "site" : "neutra", screens: images.map((image) => image.from), capture: capture ? rel(capture.dir) : null },
    warnings,
  };
}

/**
 * Checks peca.json, copies the runtime and writes pagina.html, and imagem.html when the concept
 * has an image (the still image of the same piece); remembers what was built.
 */
function buildPage(ctx, key, dir, raw, zones, engine, formats) {
  const piece = checkPiece(raw, { pieceDir: dir });
  for (const file of RUNTIME_FILES) copyFile(join(APP_DIR, "runtime", file), join(dir, file));
  copyFile(engine.runtime, join(dir, "motion.js"));
  writeFileAtomic(join(dir, "pagina.html"), pageHtml(piece, { zones: zones.zones }));
  let poster = null;
  if (hasImage(formats)) {
    poster = checkPoster(posterOf(piece), { pieceDir: dir, brand: piece.brand });
    writeFileAtomic(join(dir, "imagem.html"), pageHtml(poster, { zones: zones.zones }));
  } else removeDir(join(dir, "imagem.html"));
  const entry = ctx.state.pieces?.[key] ?? {};
  ctx.state.pieces = { ...(ctx.state.pieces ?? {}), [key]: { ...entry, zones, formats, peca_hash: hashJson(raw), page_hash: pageHash(dir), built_at: nowIso(), template: piece.template } };
  writeState(ctx.paths, ctx.state);
  return { piece, poster };
}

/** The piece as it is now: rebuilt first when the AI edited peca.json (or the formats changed) since the last build. */
async function currentPiece(ctx, key, dir, engine, warnings, formats) {
  const raw = readJson(join(dir, "peca.json"), null);
  if (!raw) throw new AppError("piece_missing", `A peça ${key} ainda não existe.`, `Rode ${command(`piece ${ctx.slug} ${key}`)}.`);
  const entry = ctx.state.pieces?.[key];
  const sameFormats = JSON.stringify(entry?.formats ?? []) === JSON.stringify(formats);
  if (!entry?.zones || entry.peca_hash !== hashJson(raw) || !sameFormats || !isFile(join(dir, "pagina.html"))) {
    const zones = entry?.zones ?? (await adZones(engine));
    if (entry?.page_hash) warnings.push(sameFormats ? "O peca.json mudou desde a última montagem: a página foi refeita antes de renderizar." : "As peças do conceito mudaram: as páginas foram refeitas antes de renderizar.");
    return buildPage(ctx, key, dir, raw, zones, engine, formats);
  }
  if (entry.page_hash !== pageHash(dir)) {
    warnings.push("A pagina.html ou uma imagem da peça mudou fora do app: a página foi refeita a partir do peca.json.");
    return buildPage(ctx, key, dir, raw, entry.zones, engine, formats);
  }
  const piece = checkPiece(raw, { pieceDir: dir });
  return { piece, poster: hasImage(formats) ? checkPoster(posterOf(piece), { pieceDir: dir, brand: piece.brand }) : null };
}

async function pieceCommand(positionals, values) {
  const [name, key] = positionals;
  const { ctx, brief, concept } = conceptContext(name, key);
  if (values.template !== undefined && !TEMPLATES.includes(values.template)) throw usage(`--template aceita: ${TEMPLATES.join(", ")}.`);
  const engine = requireVideoRender(ROOT);
  const zones = await adZones(engine);
  const dir = join(ctx.paths.pieces, key);
  ensureDir(dir);
  const pecaPath = join(dir, "peca.json");
  let raw = readJson(pecaPath, null);
  let todo = [];
  const warnings = [];
  const drafted = !raw || Boolean(values.force) || values.template !== undefined;
  let sources = null;
  if (drafted) {
    const assets = collectAssets(ctx, brief, dir);
    sources = assets.sources;
    warnings.push(...assets.warnings);
    const draft = draftPiece({ ...concept, template: values.template ?? concept.template }, { brand: assets.brand, images: assets.images, title: concept.ad_name });
    raw = draft.piece;
    todo = draft.todo;
    writeJson(pecaPath, raw);
  }
  const { piece, poster } = buildPage(ctx, key, dir, raw, zones, engine, concept.formats);
  const texts = screenTexts(piece);
  return {
    ...base("piece"),
    campaign: ctx.slug,
    concept: key,
    dir: rel(dir),
    page: rel(join(dir, "pagina.html")),
    image_page: poster ? rel(join(dir, "imagem.html")) : null,
    peca: rel(pecaPath),
    drafted,
    template: piece.template,
    formats: concept.formats,
    duration: piece.duration,
    bpm: piece.bpm,
    scenes: piece.scenes.map((scene, index) => ({ n: index + 1, role: scene.role, from: scene.from, to: scene.to, items: scene.items.map((item) => item.type) })),
    texts,
    image_texts: poster ? screenTexts(poster).map((entry) => entry.text) : [],
    brand: { name: piece.brand.name, logo: piece.brand.logo, colors: piece.brand.colors, sources },
    zone: zones.zones["9:16"],
    todo,
    warnings,
    next_step: todo.length
      ? { action: "edit_piece", command: command(`preview ${ctx.slug} ${key}`), say: "Resolva o que está em todo (no peca.json, com textos e telas reais do integrante) e faça a prévia." }
      : { action: "preview", command: command(`preview ${ctx.slug} ${key}`), say: "Faça a prévia." },
  };
}

// ---------------------------------------------------------------- sound, preview and final

function piecePaths(dir) {
  return {
    page: join(dir, "pagina.html"),
    poster: join(dir, "imagem.html"),
    audio: join(dir, "audio"),
    music: join(dir, "audio", "trilha.wav"),
    events: join(dir, "audio", "efeitos.json"),
    sfx: join(dir, "audio", "efeitos.wav"),
    grid: join(dir, "audio", "grade.json"),
    previewDir: join(dir, "previa"),
    previewSilent: join(dir, "previa", "previa-muda.mp4"),
    preview: join(dir, "previa", "previa.mp4"),
    previewFrames: join(dir, "previa", "quadros"),
    previewReport: join(dir, "previa", "aceite.json"),
    finalDir: join(dir, "final"),
    coverFrames: join(dir, "final", "capa-quadros"),
    finalReport: join(dir, "final", "aceite.json"),
  };
}

/** The music and the effects of a piece, composed by the Motor and kept while nothing changes. */
async function ensureAudio(ctx, key, piece, engine, paths, { refresh, warnings }) {
  ensureDir(paths.audio);
  writeJson(paths.grid, beatGrid(piece));
  const entry = ctx.state.pieces[key];
  const musicHash = hashJson({ style: piece.music.style, seed: piece.music.seed, bpm: piece.bpm, duration: piece.duration, engine: engine.version });
  if (refresh || entry.audio?.music !== musicHash || !isFile(paths.music)) {
    progress(`Trilha: ${piece.duration} s a ${piece.bpm} BPM (${piece.music.style}, semente ${piece.music.seed})`);
    const result = await engineCall(engine, engineArgs.music({ out: rel(paths.music), duration: piece.duration, bpm: piece.bpm, style: piece.music.style, seed: piece.music.seed, arc: "auto", loop: false }));
    for (const warning of result.warnings ?? []) warnings.push(`Trilha: ${warning}`);
  }
  const events = eventsOf(piece);
  writeJson(paths.events, events);
  const sfxHash = hashJson({ events, engine: engine.version });
  let sfx = null;
  if (events.events.length) {
    if (refresh || entry.audio?.sfx !== sfxHash || !isFile(paths.sfx)) {
      progress(`Efeitos: ${events.events.length} nos cortes e nos gestos da tela`);
      const result = await engineCall(engine, engineArgs.sfx({ out: rel(paths.sfx), events: rel(paths.events), duration: events.duration }));
      for (const warning of result.warnings ?? []) warnings.push(`Efeitos: ${warning}`);
    }
    sfx = rel(paths.sfx);
  }
  entry.audio = { music: musicHash, sfx: sfxHash };
  writeState(ctx.paths, ctx.state);
  return { music: rel(paths.music), sfx, music_hash: musicHash, sfx_hash: sfxHash };
}

/**
 * The Motor's verdict as this app reads it. A page that declares no boxes leaves the cover, the
 * safe area and the text size unchecked, and here that is a failure, never a pass (invariant 14).
 */
export function acceptSummary(result, report) {
  const checks = Array.isArray(result?.checks) ? result.checks : [];
  const failed = checks.filter((item) => item.status === "fail").map((item) => ({ name: item.name ?? item.id, summary: item.summary ?? "", fix: item.fix ?? null }));
  const warned = checks.filter((item) => item.status === "warn").map((item) => ({ name: item.name ?? item.id, summary: item.summary ?? "" }));
  const noBoxes =
    (result?.warnings ?? []).some((warning) => /window\.boxes/.test(String(warning))) ||
    checks.some((item) => ["first_frame_readable", "safe_area"].includes(item.name) && item.status === "skip");
  if (noBoxes) failed.push({ name: "boxes", summary: "A página não declarou as caixas de texto e logo: a capa, a área segura e o tamanho do texto ficaram sem conferência.", fix: "Use a página que o app escreve: rode piece de novo, que refaz a página com window.boxes." });
  return { passed: result?.passed !== false && failed.length === 0, failed, warned, checks, safe: result?.safe ?? null, networks: result?.networks ?? null, report };
}

const previewTimes = (piece, step = 1) => Array.from({ length: Math.ceil(piece.duration / step) }, (_, index) => index * step).filter((t) => t < piece.duration);
const shortAccept = (summary) => ({ passed: summary.passed, failed: summary.failed, warned: summary.warned, report: summary.report });

/**
 * The preview of the other placements of the ad: the 4:5 video as a sheet of frames and the
 * page's own check in that format, and the still image as itself with its check (D9).
 */
async function previewPlacements(ctx, key, concept, engine, paths, piece) {
  const results = [];
  for (const id of concept.formats.filter((placement) => placement !== "vertical")) {
    const placement = PLACEMENTS[id];
    const report = join(paths.previewDir, `aceite-${id}.json`);
    if (placement.kind === "video") {
      progress(`Prévia: o vídeo ${placement.format}, um quadro a cada 2 segundos, e a conferência no feed`);
      const frames = await engineCall(engine, engineArgs.frames({ page: rel(paths.page), out: rel(join(paths.previewDir, `quadros-${id}`)), times: previewTimes(piece, 2), scale: 0.5, format: placement.format }));
      const accepted = await engineCall(engine, engineArgs.accept({ page: rel(paths.page), format: placement.format, beats: rel(paths.grid) }));
      writeJson(report, { app: APP, command: "preview", placement: id, generated_at: nowIso(), campaign: ctx.slug, concept: key, ...accepted });
      results.push({ id, format: placement.format, kind: placement.kind, sheet: frames.sheet ?? null, ...shortAccept(acceptSummary(accepted, rel(report))) });
    } else {
      progress(`Prévia: a imagem ${placement.format}`);
      const frames = await engineCall(engine, engineArgs.frames({ page: rel(paths.poster), out: rel(join(paths.previewDir, id)), times: [0.5], format: placement.format }));
      const accepted = await engineCall(engine, engineArgs.accept({ page: rel(paths.poster), format: placement.format }));
      writeJson(report, { app: APP, command: "preview", placement: id, generated_at: nowIso(), campaign: ctx.slug, concept: key, ...accepted });
      results.push({ id, format: placement.format, kind: placement.kind, image: frames.frames?.[0]?.file ?? null, ...shortAccept(acceptSummary(accepted, rel(report))) });
    }
  }
  return results;
}

async function previewCommand(positionals, values) {
  const [name, key] = positionals;
  const started = Date.now();
  const { ctx, concept } = conceptContext(name, key);
  const engine = requireVideoRender(ROOT);
  const dir = join(ctx.paths.pieces, key);
  const warnings = [];
  const { piece } = await currentPiece(ctx, key, dir, engine, warnings, concept.formats);
  const paths = piecePaths(dir);
  ensureDir(paths.previewDir);
  const audio = await ensureAudio(ctx, key, piece, engine, paths, { refresh: Boolean(values.refresh), warnings });
  const entry = ctx.state.pieces[key];
  const id = hashJson({ page: entry.page_hash, music: audio.music_hash, sfx: audio.sfx_hash, formats: concept.formats });
  const reused = !values.refresh && entry.preview?.id === id && isFile(paths.preview) && isFile(paths.previewReport);
  let summary;
  let sheet = entry.preview?.sheet ?? null;
  let loudness = entry.preview?.loudness ?? null;
  let placements = entry.preview?.placements ?? [];
  if (reused) {
    summary = acceptSummary(readJson(paths.previewReport, {}), rel(paths.previewReport));
  } else {
    progress(`Prévia: renderizando ${rel(paths.page)} em tamanho de celular (${piece.duration} s)`);
    const rendered = await engineCall(engine, engineArgs.preview({ page: rel(paths.page), out: rel(paths.previewSilent), format: "9:16", fps: FPS }));
    for (const warning of rendered.warnings ?? []) warnings.push(`Página: ${warning}`);
    progress("Prévia: mixando a trilha e os efeitos");
    const mixed = await engineCall(engine, engineArgs.mix({ video: rel(paths.previewSilent), out: rel(paths.preview), music: audio.music, sfx: audio.sfx, fadeOut: 0.4 }));
    for (const warning of mixed.warnings ?? []) warnings.push(`Som: ${warning}`);
    loudness = mixed.loudness ?? null;
    progress("Prévia: um quadro por segundo");
    const frames = await engineCall(engine, engineArgs.frames({ page: rel(paths.page), out: rel(paths.previewFrames), times: previewTimes(piece), scale: 0.5, format: "9:16" }));
    sheet = frames.sheet ?? null;
    progress("Prévia: conferindo capa, zona segura dos anúncios, texto, cortes e som");
    const accepted = await engineCall(engine, engineArgs.accept({ page: rel(paths.page), format: "9:16", beats: rel(paths.grid), video: rel(paths.preview), networks: ["ads_meta"] }));
    for (const warning of accepted.warnings ?? []) warnings.push(`Conferência: ${warning}`);
    writeJson(paths.previewReport, { app: APP, command: "preview", generated_at: nowIso(), campaign: ctx.slug, concept: key, ...accepted });
    summary = acceptSummary(accepted, rel(paths.previewReport));
    placements = await previewPlacements(ctx, key, concept, engine, paths, piece);
    const failedNames = [...summary.failed.map((item) => item.name), ...placements.flatMap((entryOf) => entryOf.failed.map((item) => `${entryOf.id}:${item.name}`))];
    const allPassed = summary.passed && placements.every((entryOf) => entryOf.passed);
    entry.preview = { id, at: nowIso(), file: rel(paths.preview), sheet, loudness, passed: allPassed, failed: failedNames, report: rel(paths.previewReport), page_hash: entry.page_hash, placements };
    writeState(ctx.paths, ctx.state);
  }
  const passed = summary.passed && placements.every((entryOf) => entryOf.passed);
  if (!summary.passed) warnings.push(`A conferência reprovou: ${summary.failed.map((item) => item.name).join(", ")}. Corrija o peca.json e refaça a prévia antes de mostrar.`);
  for (const entryOf of placements.filter((item) => !item.passed)) warnings.push(`A conferência da peça ${PLACEMENTS[entryOf.id].label} reprovou: ${entryOf.failed.map((item) => item.name).join(", ")}.`);
  const approved = ctx.state.approvals?.previews?.[key]?.id === id;
  return {
    ...base("preview"),
    campaign: ctx.slug,
    concept: key,
    ad_name: concept.ad_name,
    preview: rel(paths.preview),
    sheet,
    duration: piece.duration,
    loudness,
    passed,
    accept: shortAccept(summary),
    placements,
    texts: screenTexts(piece),
    reused,
    approved,
    warnings,
    elapsed_s: Math.round((Date.now() - started) / 100) / 10,
    next_step: !passed
      ? { action: "fix", command: command(`preview ${ctx.slug} ${key}`), say: "Corrija o que reprovou (accept.failed, com o fix de cada item) no peca.json e refaça a prévia." }
      : approved
        ? { action: "final", command: command(`final ${ctx.slug} ${key}`), say: "Prévia já aprovada: faça o vídeo final." }
        : { action: "show_preview", command: command(`approve ${ctx.slug} preview ${key}`), say: "Abra a folha de quadros (sheet) e olhe cada quadro antes de dizer qualquer coisa. Depois mostre a prévia ao integrante, com os textos na tela, e pergunte se pode fazer o final. Com o sim, rode approve." },
  };
}

async function finalCommand(positionals) {
  const [name, key] = positionals;
  const started = Date.now();
  const { ctx, concept } = conceptContext(name, key);
  const engine = requireVideoRender(ROOT);
  const dir = join(ctx.paths.pieces, key);
  const warnings = [];
  const { piece } = await currentPiece(ctx, key, dir, engine, warnings, concept.formats);
  const entry = ctx.state.pieces[key];
  const approval = ctx.state.approvals?.previews?.[key];
  if (!entry.preview?.id || entry.preview.page_hash !== entry.page_hash || !approval || approval.id !== entry.preview.id) {
    const made = entry.preview?.id && entry.preview.page_hash === entry.page_hash;
    throw new AppError(
      "preview_not_approved",
      made ? "Falta o sim do integrante à prévia antes do vídeo final." : "A peça mudou depois da prévia que o integrante viu: ele precisa ver a prévia atual.",
      made ? `Mostre a prévia (${entry.preview.file}) e, com o sim dele, rode ${command(`approve ${ctx.slug} preview ${key}`)}.` : `Rode ${command(`preview ${ctx.slug} ${key}`)}, olhe a folha de quadros, mostre a prévia e, com o sim, rode approve.`,
    );
  }
  const paths = piecePaths(dir);
  const audio = await ensureAudio(ctx, key, piece, engine, paths, { refresh: false, warnings });
  ensureDir(paths.finalDir);
  const name916 = concept.ad_names.vertical;
  const silent = join(paths.finalDir, `${name916}-mudo.mp4`);
  const video = join(paths.finalDir, `${name916}.mp4`);
  const cover = join(paths.finalDir, `${name916}-capa.png`);
  progress(`Final: renderizando ${rel(paths.page)} em 1080×1920 com desfoque de movimento (${piece.duration} s)`);
  const rendered = await engineCall(engine, engineArgs.render({ page: rel(paths.page), out: rel(silent), format: "9:16", fps: FPS, sub: 2 }));
  for (const warning of rendered.warnings ?? []) warnings.push(`Página: ${warning}`);
  progress("Final: mixando o som no volume das redes");
  const mixed = await engineCall(engine, engineArgs.mix({ video: rel(silent), out: rel(video), music: audio.music, sfx: audio.sfx, fadeOut: 0.4 }));
  for (const warning of mixed.warnings ?? []) warnings.push(`Som: ${warning}`);
  progress("Final: a capa (o primeiro quadro)");
  removeDir(paths.coverFrames);
  const frames = await engineCall(engine, engineArgs.frames({ page: rel(paths.page), out: rel(paths.coverFrames), times: [0], format: "9:16" }));
  const first = frames.frames?.[0]?.file ? resolve(ROOT, frames.frames[0].file) : join(paths.coverFrames, "quadro-0001.png");
  if (isFile(first)) copyFile(first, cover);
  else warnings.push("O Motor de vídeo não devolveu o quadro da capa.");
  removeDir(paths.coverFrames);
  progress("Final: conferindo o vídeo na zona segura dos anúncios da Meta");
  const accepted = await engineCall(engine, engineArgs.accept({ page: rel(paths.page), format: "9:16", beats: rel(paths.grid), video: rel(video), networks: ["ads_meta"] }));
  for (const warning of accepted.warnings ?? []) warnings.push(`Conferência: ${warning}`);
  let media = null;
  try {
    media = await engineCall(engine, engineArgs.probe({ file: rel(video) }));
  } catch (error) {
    warnings.push(`Não consegui medir o arquivo final: ${error.message}`);
  }
  const summary = acceptSummary(accepted, rel(paths.finalReport));
  const delivery = [];
  if (media) {
    const size = media.width === 1080 && media.height === 1920;
    delivery.push({ name: "video_size", status: size ? "pass" : "fail", summary: size ? "O vídeo tem 1080×1920." : `O vídeo tem ${media.width}×${media.height}; o esperado é 1080×1920.` });
    const drift = Math.abs(Number(media.duration) - piece.duration);
    delivery.push({ name: "video_duration", status: drift <= 0.15 ? "pass" : "warn", summary: `O vídeo dura ${media.duration} s; a peça, ${piece.duration} s.` });
    delivery.push({ name: "has_audio", status: media.has_audio ? "pass" : "fail", summary: media.has_audio ? "O vídeo tem som." : "O vídeo saiu sem som." });
  }
  for (const check of delivery.filter((item) => item.status === "fail")) summary.failed.push({ name: check.name, summary: check.summary, fix: null });
  summary.passed = summary.passed && !delivery.some((item) => item.status === "fail");
  writeJson(paths.finalReport, { app: APP, command: "final", generated_at: nowIso(), campaign: ctx.slug, concept: key, ad_name: name916, file: rel(video), cover: isFile(cover) ? rel(cover) : null, passed: summary.passed, failed: summary.failed, delivery_checks: delivery, media, accept: accepted });
  const files = [{ placement: "vertical", format: "9:16", kind: "video", file: rel(video), cover: isFile(cover) ? rel(cover) : null, passed: summary.passed, report: rel(paths.finalReport) }];
  for (const id of concept.formats.filter((placement) => placement !== "vertical")) files.push(await finalPlacement(ctx, key, concept, id, { engine, paths, piece, audio, warnings }));
  const passed = files.every((file) => file.passed);
  const failed = [...summary.failed.map((item) => item.name), ...files.slice(1).flatMap((file) => file.failed.map((name) => `${file.placement}:${name}`))];
  entry.final = { at: nowIso(), id: entry.preview.id, page_hash: entry.page_hash, passed, failed, report: rel(paths.finalReport), files };
  writeState(ctx.paths, ctx.state);
  if (!passed) warnings.push(`A conferência reprovou: ${failed.join(", ")}. Corrija e gere de novo, ou conte ao integrante exatamente o que ficou assim.`);
  return {
    ...base("final"),
    campaign: ctx.slug,
    concept: key,
    ad_name: name916,
    passed,
    file: rel(video),
    cover: isFile(cover) ? rel(cover) : null,
    media: media ? { width: media.width, height: media.height, duration: media.duration, has_audio: media.has_audio } : null,
    loudness: mixed.loudness ?? null,
    accept: shortAccept(summary),
    files: files.map(({ placement, format, kind, file, passed: ok, failed: wrong, report }) => ({ placement, format, kind, file, passed: ok, failed: wrong ?? [], report })),
    warnings,
    elapsed_s: Math.round((Date.now() - started) / 100) / 10,
    next_step: passed ? nextAfterFinal(ctx) : { action: "fix", command: command(`preview ${ctx.slug} ${key}`), say: "Corrija o que reprovou e refaça a prévia." },
  };
}

/**
 * One more placement of the same ad: the 4:5 video (rendered in that format, with the same sound,
 * checked against the feed, because the Motor's table has no ad zone for the feed) or the still
 * image (taken from its page and checked as the feed shows it).
 */
async function finalPlacement(ctx, key, concept, id, { engine, paths, piece, audio, warnings }) {
  const placement = PLACEMENTS[id];
  const name = concept.ad_names[id];
  const report = join(paths.finalDir, `aceite-${id}.json`);
  const [width, height] = placement.format === "4:5" ? [1080, 1350] : [1080, 1080];
  if (placement.kind === "video") {
    const silent = join(paths.finalDir, `${name}-mudo.mp4`);
    const video = join(paths.finalDir, `${name}.mp4`);
    progress(`Final: o vídeo ${placement.format} para o feed`);
    const rendered = await engineCall(engine, engineArgs.render({ page: rel(paths.page), out: rel(silent), format: placement.format, fps: FPS, sub: 2 }));
    for (const warning of rendered.warnings ?? []) warnings.push(`Página ${placement.format}: ${warning}`);
    await engineCall(engine, engineArgs.mix({ video: rel(silent), out: rel(video), music: audio.music, sfx: audio.sfx, fadeOut: 0.4 }));
    const accepted = await engineCall(engine, engineArgs.accept({ page: rel(paths.page), format: placement.format, beats: rel(paths.grid), video: rel(video), networks: ["feed"] }));
    let media = null;
    try {
      media = await engineCall(engine, engineArgs.probe({ file: rel(video) }));
    } catch (error) {
      warnings.push(`Não consegui medir o vídeo ${placement.format}: ${error.message}`);
    }
    const summary = acceptSummary(accepted, rel(report));
    if (media && !(media.width === width && media.height === height)) summary.failed.push({ name: "video_size", summary: `O vídeo tem ${media.width}×${media.height}; o esperado é ${width}×${height}.`, fix: null });
    if (media && !media.has_audio) summary.failed.push({ name: "has_audio", summary: "O vídeo saiu sem som.", fix: null });
    const passed = summary.passed && summary.failed.length === 0;
    writeJson(report, { app: APP, command: "final", placement: id, generated_at: nowIso(), campaign: ctx.slug, concept: key, file: rel(video), zone: "feed", zone_note: "Conferido na zona do feed do Instagram: a tabela de redes do Motor de vídeo não tem a zona de anúncio do feed.", passed, failed: summary.failed, media, accept: accepted });
    return { placement: id, format: placement.format, kind: "video", file: rel(video), passed, failed: summary.failed.map((item) => item.name), report: rel(report) };
  }
  progress(`Final: a imagem ${placement.format}`);
  const framesDir = join(paths.finalDir, `${id}-quadros`);
  removeDir(framesDir);
  const frames = await engineCall(engine, engineArgs.frames({ page: rel(paths.poster), out: rel(framesDir), times: [0.5], format: placement.format }));
  const image = join(paths.finalDir, `${name}.png`);
  const first = frames.frames?.[0]?.file ? resolve(ROOT, frames.frames[0].file) : join(framesDir, "quadro-0001.png");
  if (isFile(first)) copyFile(first, image);
  removeDir(framesDir);
  const accepted = await engineCall(engine, engineArgs.accept({ page: rel(paths.poster), format: placement.format }));
  const summary = acceptSummary(accepted, rel(report));
  if (!isFile(image)) summary.failed.push({ name: "image", summary: "O Motor de vídeo não devolveu a imagem.", fix: null });
  const passed = summary.passed && summary.failed.length === 0;
  writeJson(report, { app: APP, command: "final", placement: id, generated_at: nowIso(), campaign: ctx.slug, concept: key, file: rel(image), passed, failed: summary.failed, accept: accepted });
  return { placement: id, format: placement.format, kind: "image", file: rel(image), passed, failed: summary.failed.map((item) => item.name), report: rel(report) };
}

function nextAfterFinal(ctx) {
  const stage = stageOf(ctx);
  return { action: stage.stage, command: stage.command, say: stage.say };
}

// ---------------------------------------------------------------- copy, deliver, journal

/** The texts a piece shows, read from peca.json even when it does not pass the piece check. */
function pieceTexts(dir) {
  const raw = readJson(join(dir, "peca.json"), null);
  if (!raw) return [];
  try {
    const piece = checkPiece(raw, { pieceDir: dir });
    const own = raw.poster ? screenTexts(checkPoster(posterOf(piece), { pieceDir: dir, brand: piece.brand })) : [];
    return [...screenTexts(piece), ...own].filter((entry) => !entry.ui && !entry.logo).map((entry) => entry.text);
  } catch {
    const texts = [];
    for (const scene of raw.scenes ?? []) {
      for (const item of scene.items ?? []) {
        if (typeof item.text === "string") texts.push(item.text);
        if (Array.isArray(item.items)) texts.push(...item.items.filter((text) => typeof text === "string"));
      }
    }
    return texts;
  }
}

function copyHash(ctx, concepts, terms) {
  return hashJson({ copy: concepts.map((concept) => ({ key: concept.key, copy: concept.copy })), texts: concepts.map((concept) => pieceTexts(join(ctx.paths.pieces, concept.key))), terms });
}

function copyCommand(positionals) {
  const ctx = campaignOf(positionals[0]);
  const brief = briefOf(ctx).brief;
  const evidence = readEvidence(ctx.paths.evidence, ctx.slug);
  const { concepts } = loadConcepts(ctx, { brief, evidence });
  const results = concepts.map((concept) => {
    const checked = checkCopy(concept, {
      limits: META,
      terms: brief.termos ?? [],
      screenTexts: pieceTexts(join(ctx.paths.pieces, concept.key)),
      numberSourced: concept.proof.type === "numero" && Boolean(concept.proof.source),
    });
    return { key: concept.key, ad_name: concept.ad_name, ...checked };
  });
  const passed = results.every((result) => result.passed);
  const at = nowIso();
  ctx.state.copy = { at, passed, hash: copyHash(ctx, concepts, brief.termos ?? []) };
  writeState(ctx.paths, ctx.state);
  writeJson(ctx.paths.copy, { app: APP, campaign: ctx.slug, checked_at: at, passed, limits_checked_on: META.checked_on ?? null, results });
  return {
    ...base("copy"),
    campaign: ctx.slug,
    passed,
    file: rel(ctx.paths.copy),
    results,
    next_step: passed
      ? { action: "deliver", command: command(`deliver ${ctx.slug}`), say: "Textos conferidos. Mostre os avisos ao integrante, se houver, e monte a entrega quando os vídeos finais estiverem prontos." }
      : { action: "fix", command: command(`copy ${ctx.slug}`), say: "Reescreva o que reprovou (problems), em conceitos.json ou no peca.json; passe de novo pela skill texto-natural e rode copy de novo." },
  };
}

async function deliverCommand(positionals) {
  const ctx = campaignOf(positionals[0]);
  const brief = briefOf(ctx).brief;
  const evidence = readEvidence(ctx.paths.evidence, ctx.slug);
  const { concepts } = loadConcepts(ctx, { brief, evidence });
  requireApproved(ctx, concepts);
  const blockers = [];
  const copyState = ctx.state.copy;
  if (!copyState) blockers.push({ what: "copy", say: "Os textos ainda não foram conferidos.", command: command(`copy ${ctx.slug}`) });
  else if (!copyState.passed) blockers.push({ what: "copy", say: "A conferência dos textos reprovou.", command: command(`copy ${ctx.slug}`) });
  else if (copyState.hash !== copyHash(ctx, concepts, brief.termos ?? [])) blockers.push({ what: "copy", say: "Os textos mudaram depois da conferência.", command: command(`copy ${ctx.slug}`) });
  for (const concept of concepts) {
    const entry = ctx.state.pieces?.[concept.key];
    const dir = join(ctx.paths.pieces, concept.key);
    if (!entry?.final) blockers.push({ what: concept.key, say: `A peça ${concept.key} não tem vídeo final.`, command: command(`final ${ctx.slug} ${concept.key}`) });
    else if (!entry.final.passed) blockers.push({ what: concept.key, say: `O vídeo final de ${concept.key} reprovou na conferência (${entry.final.failed.join(", ")}).`, command: command(`preview ${ctx.slug} ${concept.key}`) });
    else if (entry.final.page_hash !== pageHash(dir) || entry.final.files.some((file) => !isFile(resolve(ROOT, file.file)))) blockers.push({ what: concept.key, say: `A peça ${concept.key} mudou depois do vídeo final.`, command: command(`preview ${ctx.slug} ${concept.key}`) });
  }
  if (blockers.length) throw fail("deliver_blocked", `A entrega ainda não pode ser montada: ${blockers.map((blocker) => blocker.say).join(" ")}`, `Comece por ${blockers[0].command}.`, { blockers });

  ensureDir(ctx.paths.delivery);
  const files = [];
  for (const concept of concepts) {
    for (const piece of ctx.state.pieces[concept.key].final.files) {
      const name = concept.ad_names[piece.placement];
      const target = join(ctx.paths.delivery, `${name}${piece.kind === "video" ? ".mp4" : ".png"}`);
      copyFile(resolve(ROOT, piece.file), target);
      const entry = { file: rel(target).replace(/^.*\//, ""), path: rel(target), concept: concept.key, angle: concept.angle, placement: piece.placement, format: piece.format, kind: piece.kind, ad_name: concept.ad_name };
      if (piece.cover && isFile(resolve(ROOT, piece.cover))) {
        const coverTarget = join(ctx.paths.delivery, `${name}-capa.png`);
        copyFile(resolve(ROOT, piece.cover), coverTarget);
        entry.cover = rel(coverTarget);
      }
      files.push(entry);
    }
  }
  const generatedAt = nowIso();
  writeJson(join(ctx.paths.delivery, "nomes.json"), {
    version: 1,
    campaign: ctx.slug,
    generated_at: generatedAt,
    name_pattern: brief.padrao,
    site_reads_name: Boolean(brief.le_nome),
    ads: concepts.map((concept) => ({ ad_name: concept.ad_name, concept: concept.key, angle: concept.angle, files: files.filter((file) => file.concept === concept.key).map((file) => ({ file: file.file, placement: file.placement, format: file.format, kind: file.kind })) })),
  });
  writeFileAtomic(join(ctx.paths.delivery, "textos.md"), textsMarkdown(concepts, { campaign: ctx.slug, brief, files }));
  const budget = brief.verba_diaria > 0 ? learningBudget({ daily: brief.verba_diaria, cost: brief.custo_por_evento, event: brief.evento ?? null }) : null;
  const pending = [];
  if (budget?.viable === false) pending.push("Escolher uma das saídas da conta da verba: com a verba e o custo de hoje, o conjunto não sai da fase de aprendizado.");
  if (budget && budget.viable === null) pending.push(`Confirmar o custo por evento: para sair do aprendizado, cada evento precisa custar até ${brl(budget.max_cost_per_event)}.`);
  for (const concept of concepts.filter((item) => item.proof.type === "numero")) pending.push(`Confirmar que o número da prova de ${concept.key} (${concept.proof.source}) continua valendo no dia de publicar.`);
  writeFileAtomic(ctx.paths.launch, launchMarkdown(concepts, { campaign: ctx.slug, brief, budget, pending, generatedAt }));
  const copyReport = readJson(ctx.paths.copy, null);
  writeJson(ctx.paths.report, {
    app: APP,
    campaign: ctx.slug,
    generated_at: generatedAt,
    passed: true,
    concepts: concepts.map((concept) => {
      const final = ctx.state.pieces[concept.key].final;
      return { key: concept.key, ad_name: concept.ad_name, confidence: concept.confidence, confidence_basis: concept.confidence_basis, evidence: concept.evidence ?? [], against: concept.against ?? [], final: { passed: final.passed, report: final.report, files: final.files } };
    }),
    copy: copyReport ? { passed: copyReport.passed, checked_at: copyReport.checked_at, warnings: copyReport.results.flatMap((result) => result.warnings.map((warning) => ({ key: result.key, ...warning }))) } : null,
    budget,
    files,
    pending,
  });
  ctx.state.delivered = { at: generatedAt, round: (ctx.state.round ?? 0) + 1 };
  writeState(ctx.paths, ctx.state);
  return {
    ...base("deliver"),
    campaign: ctx.slug,
    dir: rel(ctx.paths.delivery),
    files,
    names: rel(join(ctx.paths.delivery, "nomes.json")),
    texts: rel(join(ctx.paths.delivery, "textos.md")),
    launch: rel(ctx.paths.launch),
    report: rel(ctx.paths.report),
    budget: budget ? { viable: budget.viable, say: budget.say, exits: budget.exits } : null,
    pending,
    next_step: { action: "journal", command: command(`journal ${ctx.slug}`), say: "Registre a rodada no diário. Depois diga ao integrante onde estão os arquivos, o que fazer antes de ligar (lancamento.md) e o que ainda é decisão dele (pending)." },
  };
}

const JOURNAL_KINDS = ["round", "launched", "note"];

function journalCommand(positionals, values) {
  const ctx = campaignOf(positionals[0]);
  const kind = values.kind ?? (values.note && ctx.state.delivered && (ctx.state.round ?? 0) >= ctx.state.delivered.round ? "note" : "round");
  if (!JOURNAL_KINDS.includes(kind)) throw usage(`--kind aceita: ${JOURNAL_KINDS.join(", ")}.`);
  let entry;
  if (kind === "round") {
    if (!ctx.state.delivered) throw new AppError("not_delivered", "A rodada ainda não foi entregue.", `Monte a entrega com ${command(`deliver ${ctx.slug}`)}.`);
    const names = readJson(join(ctx.paths.delivery, "nomes.json"), { ads: [] });
    const concepts = readJson(ctx.paths.concepts, { concepts: [] }).concepts ?? [];
    const round = ctx.state.delivered.round;
    entry = addJournal(ctx.paths, ctx.slug, {
      type: "round",
      round,
      delivered_at: ctx.state.delivered.at,
      pieces: names.ads,
      hypotheses: concepts.map((concept) => ({ concept: concept.key, ad_name: concept.ad_name, angle: concept.angle, driver: concept.driver, confidence: concept.confidence, evidence: concept.evidence ?? [], success_criterion: concept.success_criterion })),
      note: values.note ?? null,
    });
    ctx.state.round = round;
    writeState(ctx.paths, ctx.state);
  } else if (kind === "launched") {
    entry = addJournal(ctx.paths, ctx.slug, { type: "launched", note: values.note ?? null });
  } else {
    if (!values.note) throw usage('Informe o texto: journal <campanha> --note "...".');
    entry = addJournal(ctx.paths, ctx.slug, { type: "note", note: values.note });
  }
  const journal = readJournal(ctx.paths, ctx.slug);
  return {
    ...base("journal"),
    campaign: ctx.slug,
    file: rel(ctx.paths.journal),
    entry,
    entries: journal.entries.length,
    next_step:
      kind === "round"
        ? { action: "track", command: "npx --yes flyee@latest track tool.executed --module ad-creatives", say: "Registre o uso. Quando o integrante montar a campanha, registre com --kind launched se a estrutura coube no Gerenciador." }
        : null,
  };
}

// ---------------------------------------------------------------- help, output, main

const HELP = `Criativos para anúncios: a campanha de tráfego pago na Meta, da pesquisa à entrega conferida.

Uso: ${SCRIPT_COMMAND} <comando> [opções] [--json]

Comandos
  check                          O Motor de vídeo está instalado? O que dá para fazer nesta máquina.
  new <campanha>                 Cria anuncios/<campanha>/ com o briefing para preencher.
  brief <campanha>               Confere o briefing e devolve as perguntas do que falta.
  capture <campanha>             Copia do site da marca o logo, as cores e as telas (pelo Motor de vídeo).
  budget <campanha>              A conta da verba para a fase de aprendizado.
  links <campanha>               Os links da Biblioteca de Anúncios e o roteiro da coleta.
  collect <campanha>             A mesma pesquisa pelo Apify, com a chave do integrante, com limite de itens e de gasto.
  import <campanha> <arquivo>    Junta à evidência uma leitura de capturas, o que o integrante disse, etiquetas,
                                 a coleta do Apify ou o que a Pesquisa no Instagram e a Pesquisa no YouTube gravaram.
  evidence <campanha>            O resumo da evidência: tempo no ar, versões, padrões, indícios.
  concepts <campanha>            Confere os conceitos, calcula a confiança e grava as fichas.
  approve <campanha> concepts    Registra o sim do integrante aos conceitos.
  piece <campanha> <conceito>    Escreve a página da peça a partir de um modelo.
  preview <campanha> <conceito>  Trilha, efeitos, prévia, folha de quadros e conferência.
  approve <campanha> preview <conceito>   Registra o sim do integrante à prévia.
  final <campanha> <conceito>    O vídeo final conferido na zona segura dos anúncios.
  copy <campanha>                Confere os textos dos anúncios e os textos na tela.
  deliver <campanha>             Monta a entrega: arquivos com os nomes, textos, lançamento e relatório.
  journal <campanha>             Registra a rodada no diário.
  status <campanha>              Onde a campanha está e o próximo comando.
  list                           As campanhas deste projeto.
  help                           Esta ajuda.

Opções
  --cost <reais>                 (budget) Custo por evento, no lugar do briefing.
  --daily <reais>                (budget) Verba diária, no lugar do briefing.
  --event <nome>                 (budget) O evento de otimização, no lugar do briefing.
  --url <endereço>               (capture) Outro endereço do site da marca.
  --template <modelo>            (piece) problema-mecanismo, produto-em-uso ou lista.
  --force                        (piece) Reescreve o peca.json a partir do modelo.
  --refresh                      (preview) Refaz a trilha, os efeitos e a prévia; (collect) colhe de novo.
  --confirm-cost                 (collect) Confirma uma coleta acima do limite de custo, depois do sim do integrante.
  --kind round|launched|note     (journal) O tipo do registro.
  --note "<texto>"               (journal) O texto do registro.
  --json                         Saída em JSON, para a IA.`;

function humanText(result) {
  if (!result.ok) return [`Erro (${result.error.code}): ${result.error.message}`, result.error.fix && `Como resolver: ${result.error.fix}`].filter(Boolean).join("\n");
  const warnings = (result.warnings ?? []).map((warning) => `Aviso: ${typeof warning === "string" ? warning : warning.say ?? ""}`);
  const next = result.next_step?.say ? [`Próximo passo: ${result.next_step.say}${result.next_step.command ? ` (${result.next_step.command})` : ""}`] : [];
  const verdict = (accept) => `Conferência: ${accept.passed ? "APROVADA" : `REPROVADA (${accept.failed.map((item) => item.name).join(", ")})`}`;
  let body;
  switch (result.command) {
    case "help":
      return result.text;
    case "check":
      body = [`Criativos para anúncios ${result.app.version} · Node ${result.node}`, `Motor de vídeo: ${result.engine.installed ? `${result.engine.version ?? ""}, ${result.ready ? "pronto para renderizar" : "sem render nesta máquina"}` : "não instalado"}`, `Campanhas: ${result.campaigns.length ? result.campaigns.join(", ") : "nenhuma"}`];
      break;
    case "new":
      body = [`Campanha ${result.campaign} ${result.created ? "criada" : "já existia"} em ${result.dir}. Briefing: ${result.files.briefing}`];
      break;
    case "brief":
      body = [`Briefing ${result.complete ? "completo" : "incompleto"}: ${result.file}`, ...result.questions.map((question) => `  Falta: ${question}`), ...result.problems.map((problem) => `  Problema: ${problem.problem}`), result.budget ? `Verba: ${result.budget.say}` : ""];
      break;
    case "capture":
      body = [result.captured ? `Marca capturada de ${result.site}: ${result.brand.name ?? "sem nome"}, ${result.brand.logo ? "com logo" : "sem logo"}, destaque ${result.brand.colors.primary ?? "não encontrado"}.` : `A captura de ${result.site} falhou: ${result.error.message}`];
      break;
    case "budget":
      body = [result.say, ...result.exits.map((exit, index) => `  ${index + 1}. ${exit.text}`)];
      break;
    case "links":
      body = [`Links em ${result.file}`, ...result.competitors.map((entry) => `  ${entry.who}: ${entry.url}`), ...result.searches.map((entry) => `  "${entry.query}": ${entry.url}`), "Roteiro:", ...result.script.map((line, index) => `  ${index + 1}. ${line}`)];
      break;
    case "import":
      body = [`Leitura ${result.kind} importada: ${result.added.length} novo(s), ${result.replaced.length} atualizado(s), ${result.tagged.length} etiquetado(s). Evidência: ${result.evidence}`];
      break;
    case "collect":
      body = result.mode === "manual"
        ? ["Sem a chave do Apify: a pesquisa é a guiada, pelos links.", `Chave: ${result.key.command}`]
        : result.cached
          ? [`A coleta de hoje já está na evidência (${result.raw}); nada foi cobrado de novo.`]
          : [`Coleta pelo Apify: ${result.ads} anúncio(s) de ${result.pages.length} página(s), ${result.added} novo(s). Custo: ${result.cost.charged_usd === null ? "ainda não informado" : usdText(result.cost.charged_usd)} (estimativa de até ${usdText(result.cost.estimate_usd)}).`];
      break;
    case "evidence":
      body = [`Evidência: ${result.counts.used} item(ns), ${result.counts.competitor_ads} anúncio(s) de ${result.counts.competitors} concorrente(s). Resumo: ${result.file}`, ...result.competitors.map((entry) => `  ${entry.who}: ${entry.active} ativo(s), ${entry.kept} no ar há 30 dias ou mais${entry.indication ? " (indício)" : ""}`), ...result.patterns.map((pattern) => `  Padrão: ${pattern.dimension} ${pattern.value} em ${pattern.competitors.join(", ")}`)];
      break;
    case "concepts":
      body = [`Fichas: ${result.cards} · ${result.approval.current ? "aprovadas" : "aguardando o sim do integrante"}`, ...result.concepts.map((concept) => `  ${concept.key}: confiança ${concept.confidence_label} · ${concept.ad_name}`)];
      break;
    case "approve":
      body = [`Registrado o sim do integrante: ${result.approved === "concepts" ? "conceitos" : `prévia de ${result.concept}`}.`];
      break;
    case "piece":
      body = [`Peça ${result.concept}: ${result.page} (${result.template}, ${result.duration} s)`, ...result.texts.map((text) => `  ${String(text.t).padStart(5)} s  ${text.text}`), ...result.todo.map((item) => `  A fazer: ${item}`)];
      break;
    case "preview":
      body = [
        `Prévia: ${result.preview} (${result.duration} s)${result.reused ? ", reaproveitada" : ""}`,
        `Folha de quadros: ${result.sheet ?? ""}`,
        verdict(result.accept),
        ...result.placements.map((entry) => `${PLACEMENTS[entry.id].label}: ${entry.sheet ?? entry.image ?? ""} · ${verdict(entry)}`),
      ];
      break;
    case "final":
      body = [
        `Vídeo final: ${result.file}${result.media ? ` (${result.media.width}×${result.media.height}, ${result.media.duration} s)` : ""}`,
        result.cover ? `Capa: ${result.cover}` : "",
        verdict(result.accept),
        ...result.files.slice(1).map((entry) => `${PLACEMENTS[entry.placement].label}: ${entry.file} · ${entry.passed ? "APROVADA" : `REPROVADA (${entry.failed.join(", ")})`}`),
      ];
      break;
    case "copy":
      body = [`Textos: ${result.passed ? "APROVADOS" : "REPROVADOS"} (${result.file})`, ...result.results.flatMap((entry) => [...entry.problems.map((problem) => `  ${entry.key} ✗ ${problem.say}`), ...entry.warnings.map((warning) => `  ${entry.key} △ ${warning.say}`)])];
      break;
    case "deliver":
      body = [`Entrega em ${result.dir}: ${result.files.length} arquivo(s). Textos: ${result.texts} · lançamento: ${result.launch}`, ...result.pending.map((item) => `  Pendente: ${item}`)];
      break;
    case "journal":
      body = [`Diário: ${result.file} (${result.entries} registro(s)). Registrado: ${result.entry.type}.`];
      break;
    case "status":
      body = [`Campanha ${result.campaign} (${result.dir}) · etapa ${result.stage} · rodada ${result.round}`];
      break;
    case "list":
      body = result.campaigns.length ? result.campaigns.map((entry) => `${entry.campaign}: ${entry.stage}, ${entry.say}`) : ["Nenhuma campanha ainda."];
      break;
    default:
      return JSON.stringify(result, null, 2);
  }
  return [...body.filter(Boolean), ...warnings, ...next].join("\n");
}

async function main(argv) {
  const [name, ...rest] = argv;
  if (!name || ["help", "--help", "-h"].includes(name)) return { ...base("help"), text: HELP };
  const { positionals, values } = parseArgs(rest, ARG_SPEC);
  switch (name) {
    case "check":
      return checkCommand(values);
    case "new":
      return newCommand(positionals);
    case "brief":
      return briefCommand(positionals);
    case "capture":
      return captureCommand(positionals, values);
    case "budget":
      return budgetCommand(positionals, values);
    case "links":
      return linksCommand(positionals);
    case "collect":
      return collectCommand(positionals, values);
    case "import":
      return importCommand(positionals);
    case "evidence":
      return evidenceCommand(positionals);
    case "concepts":
      return conceptsCommand(positionals);
    case "approve":
      return approveCommand(positionals);
    case "piece":
      return pieceCommand(positionals, values);
    case "preview":
      return previewCommand(positionals, values);
    case "final":
      return finalCommand(positionals);
    case "copy":
      return copyCommand(positionals);
    case "deliver":
      return deliverCommand(positionals);
    case "journal":
      return journalCommand(positionals, values);
    case "status":
      return statusCommand(positionals);
    case "list":
      return listCommand();
    default:
      throw usage(`Comando desconhecido: ${name}.`, "Rode help para ver os comandos.");
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const json = process.argv.includes("--json");
  main(process.argv.slice(2))
    .then((result) => process.stdout.write(`${json ? JSON.stringify(result, null, 2) : humanText(result)}\n`))
    .catch((error) => {
      const result = { ok: false, command: process.argv[2] ?? null, interface_version: INTERFACE_VERSION, error: errorOf(error) };
      process.stdout.write(`${json ? JSON.stringify(result, null, 2) : humanText(result)}\n`);
      process.exitCode = error instanceof AppError && error.code === "usage" ? 2 : 1;
    });
}
