#!/usr/bin/env node
// Medição e leitura de resultados: the member's AI runs this script from the project root.
// Only JSON goes to stdout (with --json); progress goes to stderr. Every result carries
// `next_step`. The app prescribes; nobody here touches an ad account.

import { existsSync, mkdirSync, readdirSync, appendFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { contractTemplate, contractValues, validateContract } from "./lib/contract.mjs";
import { aggregateByName, normalizeExport } from "./lib/exports.mjs";
import { importRows, ledgerHeader, ledgerLines, readLedger, rowFrom, summarize } from "./lib/ledger.mjs";
import { applyMove, emptyMoves, isOpen, judgeMoves, proposeMoves } from "./lib/moves.mjs";
import { renderPulse, renderReading, renderTracking, renderWeekly } from "./lib/report.mjs";
import { detectTags, fetchHtml } from "./lib/tags.mjs";
import { AppError, brDay, brl, fold, isoDay, parseArgs, parseDay, projectRoot, readJson, readText, slugify, toPosix, writeFileAtomic, writeJson } from "./lib/util.mjs";
import { buildUtm, checkUtm, DEFAULT_RULE } from "./lib/utm.mjs";
import { judgeTable, tableSay } from "./lib/verdict.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(SCRIPTS_DIR, "..");
const ROOT = projectRoot(SCRIPTS_DIR);
const DIR = join(ROOT, "ads-insights");
const INTERFACE_VERSION = 1;
const APP = { name: "ads-insights", version: readJson(join(APP_DIR, "flyee.module.json"))?.version ?? "0.0.0" };
const RULES = readJson(join(APP_DIR, "references", "leitura.json"));
const COLUMNS = readJson(join(APP_DIR, "references", "colunas.json"));

const PATHS = {
  dir: DIR,
  contract: join(DIR, "medicao.json"),
  ledger: join(DIR, "origens.csv"),
  tracking: join(DIR, "rastreamento.md"),
  inbox: join(DIR, "entrada"),
  readings: join(DIR, "leituras"),
  weekly: join(DIR, "semanal"),
  pulse: join(DIR, "pulso"),
  tags: join(DIR, "tags"),
  moves: join(DIR, "movimentos.json"),
};

const ARG_SPEC = {
  flags: ["json", "launch"],
  options: ["today", "plan", "html", "source", "medium", "campaign", "content", "term", "url", "names", "name", "event", "period", "level", "allowable", "stage", "partner", "value", "qualified", "email", "date", "claimed", "claimed-leads", "reading", "google", "on", "daily", "rule"],
};

const HELP = `Medição e leitura de resultados (interface ${INTERFACE_VERSION})

  check                                  o app está pronto; o que o projeto já tem
  contract [--plan <plano>]              cria ou confere medicao.json, o contrato de medição
  tags <url> | tags --html <arquivo>     o que está no HTML servido: Pixel, GA4, GTM, Google Ads, aviso de cookies
  utm build --source --medium --campaign --content [--term] [--url] [--names <nomes.json>]
  utm check <link> [--names <nomes.json>]
  events                                 escreve ads-insights/rastreamento.md para este negócio
  ledger init | add --date --stage --source [--medium --campaign --content --partner --value --qualified --email]
  ledger import <arquivo em entrada/> [--stage lead] [--source ...]
  ledger summary [--claimed <compras reivindicadas>] [--claimed-leads <n>]
  import <export.csv> --source meta|google [--name <leitura>] [--event <evento>] [--period AAAA-MM-DD..AAAA-MM-DD]
  link <leitura> --names anuncios/<campanha>/entrega/nomes.json
  report <leitura> [--allowable <reais>] [--event <evento>]
  weekly [--today] [--reading <leitura da Meta>] [--google <leitura do Google>] [--claimed <n>]
  move applied <id> --on AAAA-MM-DD · move list
  pulse --daily <export de 1 a 3 dias> --source meta|google [--today]
  list · help

Todos aceitam --json. Os comandos partem da raiz do projeto (a pasta que contém .flyee/).`;

const command = (text) => `node .flyee/modules/ads-insights/scripts/insights.mjs ${text} --json`;
const rel = (path) => toPosix(ROOT, path);
const base = (name) => ({ ok: true, command: name, interface_version: INTERFACE_VERSION, app: APP });
const usage = (message, fix = "Rode help para ver os comandos.") => new AppError("usage", message, fix);

function ensureDir() {
  for (const dir of [PATHS.dir, PATHS.inbox, PATHS.readings, PATHS.weekly, PATHS.pulse]) mkdirSync(dir, { recursive: true });
}

function todayOf(values) {
  const today = values.today ?? isoDay();
  if (!parseDay(today)) throw usage(`Data inválida em --today: ${today}. Use AAAA-MM-DD.`);
  return today;
}

/** The approved plan of the project, or the newest one, as plano.json. */
function findPlan(slug = null) {
  const dir = join(ROOT, "media-plan");
  if (!existsSync(dir)) return null;
  const plans = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, "plano.json")))
    .map((entry) => ({ slug: entry.name, data: readJson(join(dir, entry.name, "plano.json")), path: join(dir, entry.name, "plano.json") }))
    .filter((plan) => plan.data);
  if (!plans.length) return null;
  if (slug) {
    const found = plans.find((plan) => plan.slug === slugify(slug));
    if (!found) throw new AppError("plan_missing", `O plano ${slug} não existe neste projeto.`, "Veja os planos em media-plan/.");
    return found;
  }
  const approved = plans.filter((plan) => plan.data.state === "aprovado").sort((a, b) => String(b.data.approved_at ?? "").localeCompare(String(a.data.approved_at ?? "")));
  return approved[0] ?? plans.sort((a, b) => String(b.data.generated_at ?? "").localeCompare(String(a.data.generated_at ?? "")))[0];
}

function rulesOf(plan) {
  const own = plan?.data?.rules;
  if (!own || typeof own !== "object") return RULES;
  const merged = structuredClone(RULES);
  for (const [key, value] of Object.entries(own)) merged[key] = typeof value === "object" && value && !Array.isArray(value) ? { ...merged[key], ...value } : value;
  return merged;
}

function loadContract({ required = true } = {}) {
  const data = readJson(PATHS.contract);
  if (!data) {
    if (required) throw new AppError("contract_missing", "O contrato de medição ainda não existe.", `Rode ${command("contract")} antes.`);
    return null;
  }
  const validity = validateContract(data);
  return { data, validity, values: contractValues(data) };
}

function utmRuleOf(plan) {
  return plan?.data?.tracking?.utm_rule ?? DEFAULT_RULE;
}

function readNames(path) {
  if (!path) return null;
  const file = resolve(ROOT, path);
  const data = readJson(file);
  if (!data || !Array.isArray(data.ads)) throw new AppError("names_invalid", `${rel(file)} não é o nomes.json da entrega (precisa de ads[]).`, "Passe o arquivo entrega/nomes.json que o app de criativos escreveu.");
  return { file, data, names: data.ads.map((ad) => ad.ad_name).filter(Boolean) };
}

function insideProject(path) {
  const file = resolve(ROOT, path);
  const relPath = relative(ROOT, file);
  if (relPath.startsWith("..") || resolve(file) !== file) throw new AppError("outside_project", `${path} está fora do projeto.`, "Copie o arquivo para ads-insights/entrada/ e importe de lá.");
  return file;
}

function readingOf(id) {
  if (!id) throw usage("Informe a leitura: <comando> <leitura>.", `Veja as leituras com ${command("list")}.`);
  const clean = slugify(id, 60);
  const dir = join(PATHS.readings, clean);
  const table = readJson(join(dir, "tabela.json"));
  if (!table) throw new AppError("reading_missing", `A leitura ${clean} não existe.`, `Importe um export com ${command("import <arquivo> --source meta")}.`);
  return { id: clean, dir, table, report: readJson(join(dir, "report.json")) };
}

function listReadings() {
  if (!existsSync(PATHS.readings)) return [];
  return readdirSync(PATHS.readings, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(PATHS.readings, entry.name, "tabela.json")))
    .map((entry) => {
      const table = readJson(join(PATHS.readings, entry.name, "tabela.json"));
      const report = readJson(join(PATHS.readings, entry.name, "report.json"));
      return { id: entry.name, source: table.source, level: table.level, period: table.period, rows: table.rows.length, judged: Boolean(report), generated_at: table.generated_at };
    })
    .sort((a, b) => String(b.generated_at).localeCompare(String(a.generated_at)));
}

// ---------------------------------------------------------------- commands

function checkCommand() {
  ensureDir();
  const contract = loadContract({ required: false });
  const plan = findPlan();
  const readings = listReadings();
  const ledgerRows = existsSync(PATHS.ledger) ? readLedger(readText(PATHS.ledger)) : [];
  const moves = readJson(PATHS.moves) ?? emptyMoves();
  const next = !contract
    ? { action: "contract", command: command("contract"), say: "Comece pelo contrato de medição: as definições que o relatório não discute depois." }
    : !contract.validity.ready
      ? { action: "ask", command: command("contract"), say: `Faltam itens do contrato que a leitura precisa: ${contract.validity.required_unknown.join(", ")}. Pergunte numa mensagem só.` }
      : !readings.length
        ? { action: "import", command: command("import ads-insights/entrada/<export.csv> --source meta"), say: "Com o contrato fechado, a próxima leitura começa quando o integrante trouxer o export do Gerenciador." }
        : { action: "weekly", command: command("weekly"), say: "Há leituras: monte a leitura da semana." };
  return {
    ...base("check"),
    node: process.versions.node,
    project: ROOT,
    ready: Boolean(RULES && COLUMNS),
    dir: rel(PATHS.dir),
    contract: contract ? { file: rel(PATHS.contract), ready: contract.validity.ready, required_unknown: contract.validity.required_unknown, unknown: contract.validity.unknown } : null,
    plan: plan ? { plan: plan.slug, state: plan.data.state, version: plan.data.version, file: rel(plan.path) } : null,
    readings,
    ledger: { file: rel(PATHS.ledger), lines: ledgerRows.length },
    moves: { open: moves.moves.filter((move) => isOpen(move)).length, total: moves.moves.length },
    rules_checked_on: RULES.checked_on,
    next_step: next,
  };
}

function contractCommand(values) {
  ensureDir();
  const today = todayOf(values);
  const plan = findPlan(values.plan ?? null);
  let created = false;
  if (!existsSync(PATHS.contract)) {
    writeJson(PATHS.contract, contractTemplate({ plan: plan?.slug ?? null, planData: plan?.data ?? null, today }));
    created = true;
  }
  const { data, validity } = loadContract();
  const next = validity.ready
    ? { action: "tags", command: command("tags <url da página de destino>"), say: "Contrato fechado. Confira as tags da página e os links antes do primeiro real." }
    : { action: "ask", command: null, say: `Pergunte ao integrante numa mensagem só o que o contrato não sabe (${validity.questions.length} pergunta(s), cada uma com a sugestão); grave as respostas em ${rel(PATHS.contract)} como informado e rode contract de novo.` };
  return { ...base("contract"), file: rel(PATHS.contract), created, plan: plan ? { plan: plan.slug, state: plan.data.state } : null, agreed_on: data.agreed_on ?? null, ...validity, items: Object.fromEntries(Object.entries(data.items).filter(([key]) => key !== "sal").map(([key, value]) => [key, { value: value.value, status: value.status }])), next_step: next };
}

async function tagsCommand(positionals, values) {
  ensureDir();
  let html;
  let origin;
  if (values.html) {
    const file = insideProject(values.html);
    html = readText(file);
    if (html === null) throw usage(`Arquivo não encontrado: ${values.html}.`);
    origin = { file: rel(file) };
  } else {
    const url = positionals[0];
    if (!url) throw usage("Informe a página: tags <url>, ou tags --html <arquivo>.");
    try {
      const page = await fetchHtml(url);
      html = page.html;
      origin = { url, final_url: page.final_url, status: page.status };
    } catch (error) {
      throw new AppError(error.code ?? "page_unreachable", error.message, "Confira o endereço; se a página exige login ou bloqueia robôs, salve o HTML (Ctrl+U no navegador, salvar) em ads-insights/entrada/ e rode tags --html <arquivo>.");
    }
  }
  const result = detectTags(html);
  const host = origin.url ? new URL(origin.final_url ?? origin.url).hostname : slugify(origin.file.split("/").pop() ?? "html");
  mkdirSync(PATHS.tags, { recursive: true });
  const file = join(PATHS.tags, `${slugify(host, 60)}.json`);
  writeJson(file, { version: 1, checked_at: new Date().toISOString(), ...origin, ...result });
  return { ...base("tags"), ...origin, ...result, file: rel(file), next_step: { action: "utm", command: command("utm check <link de um anúncio>"), say: "Diga ao integrante o que está na página com as palavras de say, e confira os links dos anúncios." } };
}

function utmCommand(positionals, values) {
  const sub = positionals[0];
  const plan = findPlan();
  const rule = values.rule ?? utmRuleOf(plan);
  const names = readNames(values.names);
  if (sub === "build") {
    const built = buildUtm({ source: values.source, medium: values.medium, campaign: values.campaign ?? plan?.slug, content: values.content, term: values.term ?? values.source, url: values.url ?? null, rule });
    const warnings = [];
    if (names && !names.names.includes(built.values.utm_content)) warnings.push({ code: "content_not_an_ad_name", text: "utm_content não é o nome de nenhum anúncio da entrega." });
    return { ...base("utm"), sub, ...built, rule_from: plan?.data?.tracking?.utm_rule ? `plano ${plan.slug}` : "padrão do app", warnings, next_step: { action: "use", command: null, say: "Use o link exatamente como veio; a plataforma compara o nome do anúncio letra por letra." } };
  }
  if (sub === "check") {
    const url = positionals[1];
    if (!url) throw usage("Informe o link: utm check <link>.");
    const checked = checkUtm(url, { rule, names: names?.names ?? null });
    return { ...base("utm"), sub, ...checked, rule_from: plan?.data?.tracking?.utm_rule ? `plano ${plan.slug}` : "padrão do app", next_step: checked.valid ? { action: "ok", command: null, say: "O link segue a regra única." } : { action: "fix", command: command(`utm build --source <canal> --medium <meio> --campaign <plano> --content "<nome do anúncio>" --url <página>`), say: `Faltam ${checked.missing.join(", ")}: monte o link de novo pela regra.` } };
  }
  throw usage("utm build ou utm check.");
}

function eventsCommand() {
  ensureDir();
  const { data } = loadContract();
  const plan = findPlan();
  const markdown = renderTracking({ contract: data, plan: plan ? { plan: plan.slug } : null, utmRule: utmRuleOf(plan) });
  writeFileAtomic(PATHS.tracking, markdown);
  return { ...base("events"), file: rel(PATHS.tracking), next_step: { action: "verify", command: command("tags <url>"), say: `O plano de rastreamento está em ${rel(PATHS.tracking)}. Percorra o plano de teste com o integrante e marque cada item do contrato como verificado.` } };
}

function ledgerCommand(positionals, values) {
  ensureDir();
  const sub = positionals[0];
  if (sub === "init") {
    if (existsSync(PATHS.ledger)) return { ...base("ledger"), sub, file: rel(PATHS.ledger), created: false, lines: readLedger(readText(PATHS.ledger)).length, next_step: { action: "add", command: command('ledger add --date AAAA-MM-DD --stage lead --source meta --campaign <plano> --content "<nome do anúncio>" --email <e-mail>'), say: "A planilha já existe." } };
    writeFileAtomic(PATHS.ledger, `${ledgerHeader()}\n`);
    return { ...base("ledger"), sub, file: rel(PATHS.ledger), created: true, lines: 0, next_step: { action: "add", command: command('ledger add --date AAAA-MM-DD --stage lead --source meta --campaign <plano> --content "<nome do anúncio>" --email <e-mail>'), say: "Planilha criada, sem dado pessoal: cada linha leva um pseudônimo no lugar da pessoa." } };
  }
  const { values: contract } = loadContract();
  if (sub === "add") {
    if (!existsSync(PATHS.ledger)) writeFileAtomic(PATHS.ledger, `${ledgerHeader()}\n`);
    const row = rowFrom({ date: values.date, stage: values.stage, source: values.source, medium: values.medium, campaign: values.campaign, content: values.content, partner: values.partner, value: values.value, qualified: values.qualified, email: values.email }, contract.salt);
    appendFileSync(PATHS.ledger, `${ledgerLines([row])[0]}\n`);
    return { ...base("ledger"), sub, file: rel(PATHS.ledger), row, next_step: { action: "summary", command: command("ledger summary"), say: "Linha gravada com pseudônimo." } };
  }
  if (sub === "import") {
    const path = positionals[1];
    if (!path) throw usage("Informe o arquivo: ledger import <arquivo em ads-insights/entrada/>.");
    const file = resolve(ROOT, path);
    if (!file.startsWith(PATHS.inbox)) throw new AppError("outside_entrada", `${path} não está em ${rel(PATHS.inbox)}.`, "Uma lista com dados pessoais só é lida de ads-insights/entrada/: copie o arquivo para lá e importe de novo.");
    const text = readText(file);
    if (text === null) throw usage(`Arquivo não encontrado: ${path}.`);
    const result = importRows(text, { salt: contract.salt, defaultStage: values.stage ?? "lead", defaults: { source: values.source ?? "desconhecida", medium: values.medium ?? "", campaign: values.campaign ?? "", date: values.date ?? null } });
    if (!existsSync(PATHS.ledger)) writeFileAtomic(PATHS.ledger, `${ledgerHeader()}\n`);
    const existing = readLedger(readText(PATHS.ledger));
    const known = new Set(existing.map((row) => `${row.pseudonimo}|${row.etapa}|${row.data}`));
    const fresh = result.rows.filter((row) => {
      const key = `${row.pseudonimo}|${row.etapa}|${row.data}`;
      if (known.has(key)) return false;
      known.add(key);
      return true;
    });
    if (fresh.length) appendFileSync(PATHS.ledger, `${ledgerLines(fresh).join("\n")}\n`);
    return { ...base("ledger"), sub, file: rel(PATHS.ledger), source_file: rel(file), imported: fresh.length, duplicates: result.rows.length - fresh.length, columns_used: result.columns, dropped_columns: result.dropped_columns, personal_columns_dropped: result.personal_columns_dropped, problems: result.problems, next_step: { action: "summary", command: command("ledger summary"), say: `${fresh.length} linha(s) entraram com pseudônimo; nome, e-mail e telefone ficaram de fora. ${result.problems.length ? `${result.problems.length} linha(s) ficaram de fora por falta de e-mail ou data.` : ""}`.trim() } };
  }
  if (sub === "summary") {
    const rows = existsSync(PATHS.ledger) ? readLedger(readText(PATHS.ledger)) : [];
    const claimed = values.claimed !== undefined ? Number(values.claimed) : null;
    const claimedLeads = values["claimed-leads"] !== undefined ? Number(values["claimed-leads"]) : null;
    if (claimed !== null && !Number.isFinite(claimed)) throw usage("--claimed precisa ser um número.");
    const summary = summarize(rows, { claimedPurchases: claimed, claimedLeads: Number.isFinite(claimedLeads) ? claimedLeads : null });
    return { ...base("ledger"), sub, file: rel(PATHS.ledger), ...summary, next_step: { action: "weekly", command: command("weekly"), say: "Mostre o resumo com as palavras de say; a leitura semanal cruza isto com os exports." } };
  }
  throw usage("ledger init, add, import ou summary.");
}

function periodOf(values) {
  if (!values.period) return null;
  const [start, end] = String(values.period).split("..");
  if (!parseDay(start) || !parseDay(end)) throw usage(`Período inválido: ${values.period}. Use AAAA-MM-DD..AAAA-MM-DD.`);
  return { start, end };
}

function importCommand(positionals, values) {
  ensureDir();
  const path = positionals[0];
  if (!path) throw usage("Informe o arquivo: import <export.csv> --source meta|google.");
  if (!values.source) throw usage("Informe a origem: --source meta ou --source google.");
  const file = insideProject(path);
  const text = readText(file);
  if (text === null) throw usage(`Arquivo não encontrado: ${path}.`);
  const normalized = normalizeExport(text, { source: values.source, columns: COLUMNS, level: values.level ?? null });
  const rows = aggregateByName(normalized.rows);
  const period = periodOf(values) ?? normalized.period;
  const id = slugify(values.name ?? `${values.source}-${period?.end ?? isoDay()}${values.level ? `-${values.level}` : ""}`, 60);
  const dir = join(PATHS.readings, id);
  mkdirSync(dir, { recursive: true });
  const table = { version: 1, id, generated_at: new Date().toISOString(), source_file: rel(file), source: normalized.source, level: normalized.level, name_field: normalized.name_field, fields: normalized.fields, columns_matched: normalized.columns_matched, missing: normalized.missing, unknown_columns: normalized.unknown_columns, period, totals: normalized.totals, event: values.event ?? null, rows };
  writeJson(join(dir, "tabela.json"), table);
  return {
    ...base("import"),
    reading: id,
    file: rel(join(dir, "tabela.json")),
    source: normalized.source,
    level: normalized.level,
    period,
    rows: rows.length,
    daily_lines_merged: normalized.rows.length - rows.length,
    fields: normalized.fields,
    missing: normalized.missing,
    unknown_columns: normalized.unknown_columns,
    totals: normalized.totals,
    next_step: normalized.level === "ad" && normalized.source === "meta" ? { action: "link", command: command(`link ${id} --names anuncios/<campanha>/entrega/nomes.json`), say: `${rows.length} peça(s) lidas${normalized.missing.length ? `; o export não traz ${normalized.missing.join(", ")}` : ""}. Ligue cada linha ao nome da entrega e julgue.` } : { action: "report", command: command(`report ${id}`), say: `${rows.length} linha(s) lidas. Julgue a tabela.` },
  };
}

function linkCommand(positionals, values) {
  const reading = readingOf(positionals[0]);
  const names = readNames(values.names);
  if (!names) throw usage("Informe a lista de nomes: link <leitura> --names anuncios/<campanha>/entrega/nomes.json");
  const byName = new Map(names.data.ads.map((ad) => [ad.ad_name, ad]));
  const byFold = new Map(names.data.ads.map((ad) => [fold(ad.ad_name), ad]));
  const matched = [];
  const unmatched = [];
  for (const row of reading.table.rows) {
    const ad = byName.get(row.name) ?? byFold.get(fold(row.name)) ?? null;
    if (ad) {
      row.concept = ad.concept ?? null;
      row.angle = ad.angle ?? null;
      row.match = byName.has(row.name) ? "exact" : "case_differs";
      matched.push(row.name);
    } else {
      delete row.concept;
      delete row.angle;
      row.match = null;
      unmatched.push(row.name);
    }
  }
  reading.table.names_file = rel(names.file);
  reading.table.unmatched = unmatched;
  writeJson(join(reading.dir, "tabela.json"), reading.table);
  const notInExport = names.names.filter((name) => !reading.table.rows.some((row) => row.name === name));
  return { ...base("link"), reading: reading.id, names_file: rel(names.file), matched, unmatched, not_in_export: notInExport, next_step: { action: "report", command: command(`report ${reading.id}`), say: `${matched.length} casaram, ${unmatched.length} não${notInExport.length ? `; ${notInExport.length} nome(s) da entrega não aparecem no export` : ""}. Nada foi adivinhado.` } };
}

function allowableOf(values, contract, plan) {
  if (values.allowable !== undefined) {
    const value = Number(String(values.allowable).replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) throw usage("--allowable precisa ser um valor em reais.");
    return { allowable: value, source: "informado agora" };
  }
  if (contract?.values.allowable) return { allowable: contract.values.allowable, source: "contrato de medição" };
  const planValue = plan?.data?.funnel?.allowable_cpl_brl ?? plan?.data?.economics?.allowable_cac_brl ?? null;
  if (planValue) return { allowable: planValue, source: `plano ${plan.slug}` };
  return { allowable: null, source: null };
}

function judgeReading(reading, { contract, plan, values }) {
  const rules = rulesOf(plan);
  const { allowable, source } = allowableOf(values, contract, plan);
  const event = values.event ?? reading.table.event ?? contract?.values.event ?? null;
  const normalized = { source: reading.table.source, level: reading.table.level, fields: reading.table.fields, rows: reading.table.rows, period: reading.table.period, missing: reading.table.missing, unknown_columns: reading.table.unknown_columns, totals: reading.table.totals };
  const table = { ...judgeTable(normalized, { event, allowable, rules }), source: normalized.source, level: normalized.level, rules_label: rules.sample.label };
  return { normalized, table, allowable, allowableSource: source, event, rules };
}

function reportCommand(positionals, values) {
  const reading = readingOf(positionals[0]);
  const contract = loadContract({ required: false });
  const plan = findPlan();
  const judged = judgeReading(reading, { contract, plan, values });
  const report = { interface_version: INTERFACE_VERSION, app: APP.name, reading: reading.id, generated_at: new Date().toISOString(), source: judged.normalized.source, level: judged.normalized.level, period: judged.normalized.period, event: judged.event, allowable_brl: judged.allowable, allowable_source: judged.allowableSource, totals: judged.normalized.totals, missing: judged.normalized.missing, unmatched: reading.table.unmatched ?? [], counts: judged.table.counts, median_visit_to_result_pct: judged.table.median_visit_to_result_pct, rows: judged.table.rows, rules_checked_on: judged.rules.checked_on };
  writeJson(join(reading.dir, "report.json"), report);
  writeFileAtomic(join(reading.dir, "leitura.md"), renderReading({ id: reading.id, normalized: judged.normalized, table: judged.table, allowableSource: judged.allowableSource, unmatched: reading.table.unmatched ?? [] }));
  return { ...base("report"), reading: reading.id, files: { report: rel(join(reading.dir, "report.json")), markdown: rel(join(reading.dir, "leitura.md")) }, allowable_brl: judged.allowable, allowable_source: judged.allowableSource, event: judged.event, counts: judged.table.counts, rows: judged.table.rows.map((row) => ({ name: row.name, verdict: row.verdict, certainty: row.certainty, where_it_fails: row.where_it_fails, spend: row.metrics.spend, results: row.metrics.results, cost_per_result_brl: row.metrics.cost_per_result_brl, readings: row.readings })), say: tableSay(judged.table), next_step: { action: "weekly", command: command(`weekly --reading ${reading.id}`), say: `A leitura está em ${rel(join(reading.dir, "leitura.md"))}. Monte a leitura da semana, que cruza a tabela com a planilha de origem e propõe os movimentos.` } };
}

function latestReading(source, preferred = null) {
  if (preferred) return readingOf(preferred);
  const found = listReadings().find((reading) => reading.source === source && reading.judged);
  return found ? readingOf(found.id) : null;
}

function weeklyCommand(values) {
  ensureDir();
  const today = todayOf(values);
  const contract = loadContract();
  const plan = findPlan();
  const rules = rulesOf(plan);
  const metaReading = latestReading("meta", values.reading ?? null);
  const googleReading = latestReading("google", values.google ?? null);
  if (!metaReading && !googleReading) throw new AppError("reading_missing", "Não há leitura julgada neste projeto.", `Importe um export (${command("import <arquivo> --source meta")}) e julgue (${command("report <leitura>")}) antes da leitura semanal.`);
  const judgedMeta = metaReading ? { id: metaReading.id, ...judgeReading(metaReading, { contract, plan, values: {} }) } : null;
  const judgedGoogle = googleReading ? { id: googleReading.id, ...judgeReading(googleReading, { contract, plan, values: {} }) } : null;
  const ledgerRows = existsSync(PATHS.ledger) ? readLedger(readText(PATHS.ledger)) : [];
  const purchasesClaimed = values.claimed !== undefined ? Number(values.claimed) : [judgedMeta, judgedGoogle].filter(Boolean).some((reading) => /compra|purchase/i.test(String(reading.event ?? ""))) ? [judgedMeta, judgedGoogle].filter(Boolean).reduce((sum, reading) => sum + reading.table.rows.reduce((acc, row) => acc + (row.metrics.results ?? 0), 0), 0) : null;
  const ledger = summarize(ledgerRows, { claimedPurchases: Number.isFinite(purchasesClaimed) ? purchasesClaimed : null });
  const allowable = judgedMeta?.allowable ?? judgedGoogle?.allowable ?? null;

  const store = readJson(PATHS.moves) ?? emptyMoves();
  const readingsForMoves = listReadings()
    .filter((reading) => reading.judged)
    .map((reading) => {
      const full = readingOf(reading.id);
      return { id: reading.id, source: reading.source, period: full.table.period, rows: full.report?.rows ?? [] };
    });
  const moveLines = judgeMoves(store, readingsForMoves, { today, rules, allowable });
  let proposed = [];
  for (const reading of [judgedMeta, judgedGoogle].filter(Boolean)) {
    const result = proposeMoves(store, { ...reading.table, level: reading.normalized.level }, { today, rules, allowable: reading.allowable, reading: reading.id, claimRatio: reading === judgedMeta ? ledger.claim_ratio : null });
    store.moves = result.moves;
    proposed = [...proposed, ...result.proposed];
  }
  store.updated_at = today;
  writeJson(PATHS.moves, store);
  const openMoves = store.moves.filter((move) => isOpen(move) && !proposed.includes(move));

  const channels = Array.isArray(contract.values.channels) ? contract.values.channels : [];
  const coverage = [
    ...(channels.includes("email") || channels.includes("owned") ? [{ label: "E-mail", measured: false, send: "o relatório de envios da ferramenta de e-mail, com cliques por envio" }] : []),
    ...(channels.includes("whatsapp") ? [{ label: "WhatsApp", measured: false, send: "a contagem de mensagens e respostas da semana" }] : []),
  ];
  const notChecked = [...(!judgedMeta ? ["Meta: sem export desta semana."] : []), ...(!judgedGoogle && (channels.includes("google") || channels.includes("google_search")) ? ["Busca do Google: sem export desta semana."] : []), ...(!ledgerRows.length ? ["A planilha de origem está vazia: a verdade do negócio ficou de fora."] : []), ...(judgedMeta?.normalized.missing.length ? [`Colunas ausentes no export da Meta: ${judgedMeta.normalized.missing.join(", ")}.`] : []), ...coverage.filter((item) => !item.measured).map((item) => `${item.label}: usado, não medido (mande ${item.send}).`)];

  const rendered = renderWeekly({ today, contract: contract.values, plan: plan ? { plan: plan.slug, version: plan.data.version, state: plan.data.state } : null, metaReading: judgedMeta, googleReading: judgedGoogle, ledger, claimRatio: ledger.claim_ratio, moveLines, proposed, openMoves, coverage, notChecked });
  const markdownPath = join(PATHS.weekly, `${today}.md`);
  const jsonPath = join(PATHS.weekly, `${today}.json`);
  writeFileAtomic(markdownPath, rendered.markdown);
  writeJson(jsonPath, { interface_version: INTERFACE_VERSION, app: APP.name, week_of: today, plan: plan?.slug ?? null, readings: { meta: judgedMeta?.id ?? null, google: judgedGoogle?.id ?? null }, findings: rendered.findings, ledger: { lines: ledger.lines, by_stage: ledger.by_stage, claim_ratio: ledger.claim_ratio }, since_last_time: moveLines, proposed: proposed.map((move) => move.id), open_moves: openMoves.map((move) => move.id), not_checked: notChecked, in_short_words: rendered.in_short_words });
  const say = [rendered.findings[0]?.text ?? "Sem achado: a semana ainda não tem amostra.", proposed[0] ? `Primeiro passo: ${proposed[0].texto}` : "Nenhum movimento proposto nesta semana.", `${proposed.filter((move) => move.decisao_do_integrante || move.tipo === "subir_verba").length} decisão(ões) para o integrante; ${moveLines.filter((line) => line.verdict).length} movimento(s) anteriores julgados.`];
  return { ...base("weekly"), week_of: today, files: { markdown: rel(markdownPath), json: rel(jsonPath), moves: rel(PATHS.moves) }, readings: { meta: judgedMeta?.id ?? null, google: judgedGoogle?.id ?? null }, findings: rendered.findings, since_last_time: moveLines, proposed, open_moves: openMoves.map((move) => ({ id: move.id, tipo: move.tipo, objeto: move.objeto, proposto_em: move.proposto_em })), claim_ratio: ledger.claim_ratio, not_checked: notChecked, in_short_words: rendered.in_short_words, say, next_step: { action: "tell", command: command("move applied <id> --on AAAA-MM-DD"), say: `A leitura está em ${rel(markdownPath)}. Mostre as três linhas de say e as decisões; quando o integrante disser que fez um movimento, registre a data para a próxima leitura julgar.` } };
}

function moveCommand(positionals, values) {
  ensureDir();
  const sub = positionals[0];
  const store = readJson(PATHS.moves) ?? emptyMoves();
  if (sub === "list") return { ...base("move"), sub, file: rel(PATHS.moves), moves: store.moves, next_step: { action: "weekly", command: command("weekly"), say: `${store.moves.filter((move) => isOpen(move)).length} movimento(s) em aberto.` } };
  if (sub === "applied") {
    const id = positionals[1];
    if (!id) throw usage("Informe o movimento: move applied <id> --on AAAA-MM-DD.");
    const on = values.on ?? isoDay();
    if (!parseDay(on)) throw usage(`Data inválida em --on: ${on}.`);
    const move = applyMove(store, id, on, rulesOf(findPlan()));
    if (!move) throw new AppError("move_missing", `O movimento ${id} não existe.`, `Veja os movimentos com ${command("move list")}.`);
    writeJson(PATHS.moves, store);
    return { ...base("move"), sub, move, next_step: { action: "wait", command: command("weekly"), say: `Registrado: aplicado em ${brDay(on)}, legível em ${brDay(move.legivel_em)}. Até lá, nada mais nesse objeto, ou a leitura não separa os efeitos.` } };
  }
  throw usage("move applied <id> --on <data>, ou move list.");
}

function pulseCommand(values) {
  ensureDir();
  const today = todayOf(values);
  if (!values.daily) throw usage("Informe o export do dia: pulse --daily <arquivo> --source meta|google.");
  if (!values.source) throw usage("Informe a origem: --source meta ou --source google.");
  const file = insideProject(values.daily);
  const text = readText(file);
  if (text === null) throw usage(`Arquivo não encontrado: ${values.daily}.`);
  const contract = loadContract({ required: false });
  const plan = findPlan();
  const rules = rulesOf(plan);
  const { allowable } = allowableOf(values, contract, plan);
  const normalized = normalizeExport(text, { source: values.source, columns: COLUMNS, level: values.level ?? null });
  const rows = aggregateByName(normalized.rows);
  const days = normalized.period ? Math.max(1, Math.round((parseDay(normalized.period.end) - parseDay(normalized.period.start)) / 86400000) + 1) : 1;
  const spend = normalized.totals.spend ?? 0;
  const issues = [];
  const event = values.event ?? contract?.values.event ?? null;
  const judged = judgeTable({ ...normalized, rows }, { event, allowable, rules });

  // Pacing against the plan's phase budget for today.
  const phase = plan?.data?.budget?.by_phase?.find((item) => item.start <= today && today <= item.end) ?? null;
  if (phase && phase.daily_brl) {
    const dailyActual = spend / days;
    const off = (dailyActual - phase.daily_brl) / phase.daily_brl;
    if (Math.abs(off) > rules.pulse.pacing_tolerance) issues.push({ code: "pacing", text: `O gasto está ${off > 0 ? "acima" : "abaixo"} do plano da fase ${phase.phase}: ${brl(dailyActual)} por dia contra ${brl(phase.daily_brl)}.`, evidence: `export ${brDay(normalized.period?.start ?? today)} a ${brDay(normalized.period?.end ?? today)}; plano ${plan.slug}`, action: off > 0 ? "conferir se algum conjunto subiu de verba sem decisão; se não, baixar ao valor da fase." : "conferir se há conjunto pausado ou reprovado; se não, deixar, porque gastar menos não é problema." });
  }
  for (const row of judged.rows) {
    const status = String(normalized.rows.find((item) => item.name === row.name)?.delivery ?? normalized.rows.find((item) => item.name === row.name)?.status ?? "");
    if (/reprov|rejeit|rejected|disapproved|não aprovado|nao aprovado/i.test(status)) issues.push({ code: "rejected", text: `"${row.name}" está reprovado pela plataforma.`, evidence: `coluna de veiculação: ${status}`, action: "ler o motivo no Gerenciador e pedir uma nova versão da peça; nada de verba até lá." });
    if (allowable && row.metrics.results === 0 && (row.metrics.spend ?? 0) >= allowable * rules.pulse.cpa_multiple && days <= 3) issues.push({ code: "zero_results", text: `"${row.name}" gastou ${brl(row.metrics.spend)} sem nenhum resultado em ${days} dia(s).`, evidence: `${brl(row.metrics.spend)} contra ${brl(allowable)} permitidos por resultado`, action: "conferir se o evento está disparando (Gerenciador de Eventos); se dispara, segurar até 3 vezes o permitido e aí pausar." });
    if (allowable && row.legible.cost && row.cost_multiple !== null && row.cost_multiple >= rules.pulse.cpa_multiple) issues.push({ code: "cpa", text: `"${row.name}" custa ${brl(row.metrics.cost_per_result_brl)} por resultado, ${row.cost_multiple} vezes o permitido, com amostra.`, evidence: `${row.metrics.results} resultados, ${brl(row.metrics.spend)}`, action: "pausar e mandar a verba para a peça que segura o custo." });
    if (phase?.daily_brl && (row.metrics.spend ?? 0) / days > phase.daily_brl * rules.pulse.spend_spike_multiple) issues.push({ code: "spend_spike", text: `"${row.name}" gastou ${brl((row.metrics.spend ?? 0) / days)} por dia, acima de ${rules.pulse.spend_spike_multiple} vez a verba diária da fase.`, evidence: `verba da fase ${brl(phase.daily_brl)} por dia`, action: "conferir a verba do conjunto; um salto sem decisão costuma ser uma edição que não devia ter acontecido." });
  }
  const last = latestReading(values.source);
  if (last?.report) {
    for (const row of judged.rows) {
      const before = last.report.rows.find((item) => item.name === row.name);
      const ctrNow = row.metrics.link_ctr_pct ?? row.metrics.ctr_pct ?? null;
      const ctrBefore = before?.metrics?.link_ctr_pct ?? before?.metrics?.ctr_pct ?? null;
      if (ctrNow !== null && ctrBefore && row.legible.hook_ctr && ctrNow < ctrBefore * (1 - rules.pulse.ctr_drop_fraction)) issues.push({ code: "ctr_drop", text: `O CTR de "${row.name}" caiu de ${ctrBefore}% para ${ctrNow}%.`, evidence: `leitura ${last.id} contra o export do dia`, action: "fadiga provável: preparar a troca da peça antes que o custo suba; nada de mexer na verba hoje." });
    }
  }
  const total = normalized.totals.spend ?? 0;
  const coverage = `Vejo o export ${values.source === "meta" ? "da Meta" : "do Google Ads"} de ${brDay(normalized.period?.start ?? today)} a ${brDay(normalized.period?.end ?? today)} (${rows.length} linha(s), ${brl(total)}); nada além dele. Se quiser conferir outro canal, traga o export dele.`;
  const markdownPath = join(PATHS.pulse, `${today}.md`);
  writeFileAtomic(markdownPath, renderPulse({ today, issues, coverage }));
  writeJson(join(PATHS.pulse, `${today}.json`), { version: 1, day: today, source: values.source, period: normalized.period, rows: rows.length, spend: total, issues, coverage });
  return { ...base("pulse"), day: today, file: rel(markdownPath), coverage, issues, say: issues.length ? `${issues.length} ponto(s) quebraram um limiar hoje.` : "Nada precisa de você hoje no que dá para ver.", next_step: issues.length ? { action: "propose", command: null, say: "Leve cada ponto ao integrante com a evidência e a proposta; quem mexe na conta é ele." } : { action: "none", command: null, say: "Nada a fazer hoje." } };
}

function listCommand() {
  const readings = listReadings();
  const weeklies = existsSync(PATHS.weekly) ? readdirSync(PATHS.weekly).filter((name) => name.endsWith(".md")).map((name) => name.replace(/\.md$/, "")).sort().reverse() : [];
  return { ...base("list"), readings, weeklies, next_step: readings.length ? { action: "weekly", command: command("weekly"), say: `${readings.length} leitura(s), ${weeklies.length} semana(s).` } : { action: "import", command: command("import ads-insights/entrada/<export.csv> --source meta"), say: "Nenhuma leitura ainda." } };
}

// ---------------------------------------------------------------- output

function renderText(result) {
  const next = result.next_step?.say ? [`Próximo passo: ${result.next_step.say}`] : [];
  let body;
  switch (result.command) {
    case "help":
      return result.text;
    case "check":
      body = [`Medição e leitura de resultados ${result.app.version} · Node ${result.node}`, `Contrato: ${result.contract ? (result.contract.ready ? "fechado" : `faltam ${result.contract.required_unknown.join(", ")}`) : "não existe"}; leituras: ${result.readings.length}; planilha: ${result.ledger.lines} linha(s).`];
      break;
    case "tags":
    case "report":
    case "ledger":
      body = [result.say ?? ""];
      break;
    case "weekly":
      body = result.say;
      break;
    case "pulse":
      body = [result.coverage, ...(result.issues.length ? result.issues.map((issue) => `- ${issue.text}`) : [result.say])];
      break;
    default:
      return JSON.stringify(result, null, 2);
  }
  return [...body.filter(Boolean), ...next].join("\n");
}

async function main(argv) {
  const [name, ...rest] = argv;
  if (!name || ["help", "--help", "-h"].includes(name)) return { ...base("help"), text: HELP };
  const { positionals, values } = parseArgs(rest, ARG_SPEC);
  switch (name) {
    case "check":
      return checkCommand();
    case "contract":
      return contractCommand(values);
    case "tags":
      return tagsCommand(positionals, values);
    case "utm":
      return utmCommand(positionals, values);
    case "events":
      return eventsCommand();
    case "ledger":
      return ledgerCommand(positionals, values);
    case "import":
      return importCommand(positionals, values);
    case "link":
      return linkCommand(positionals, values);
    case "report":
      return reportCommand(positionals, values);
    case "weekly":
      return weeklyCommand(values);
    case "move":
      return moveCommand(positionals, values);
    case "pulse":
      return pulseCommand(values);
    case "list":
      return listCommand();
    default:
      throw usage(`Comando desconhecido: ${name}.`);
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const json = process.argv.includes("--json");
  main(process.argv.slice(2))
    .then((result) => {
      process.stdout.write(json ? `${JSON.stringify(result)}\n` : `${renderText(result)}\n`);
    })
    .catch((error) => {
      const failure = { ok: false, command: process.argv[2] ?? null, interface_version: INTERFACE_VERSION, app: APP, error: { code: error instanceof AppError ? error.code : "unexpected", message: error.message, fix: error instanceof AppError ? error.fix : "Rode de novo; se repetir, mostre esta mensagem ao integrante.", ...(error.details ? { details: error.details } : {}) } };
      process.stdout.write(json ? `${JSON.stringify(failure)}\n` : `Erro (${failure.error.code}): ${failure.error.message}\n${failure.error.fix}\n`);
      process.exitCode = 1;
    });
}
