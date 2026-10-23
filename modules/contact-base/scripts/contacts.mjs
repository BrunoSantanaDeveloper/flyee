#!/usr/bin/env node
// Base de contatos e CRM: the member's AI runs this script from the project root. Only JSON goes
// to stdout (with --json); progress goes to stderr. Every result carries `next_step`. The base
// stays in the project folder; no name, e-mail or phone ever leaves it in a count or a report.

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildInventory, cleanHeader, cleanLines, GROUPS, readClean, readExport } from "./lib/inventory.mjs";
import { GROUP_LABELS, legalQuestions, legalTemplate, parseLegal } from "./lib/legal.mjs";
import { inventorySay, renderSequences } from "./lib/report.mjs";
import { segmentBase } from "./lib/segments.mjs";
import { anchorsFor, buildSequence, DEFAULT_UTM_RULE } from "./lib/sequence.mjs";
import { AppError, isoDay, parseArgs, parseDay, projectRoot, readJson, readText, slugify, toPosix, writeFileAtomic, writeJson } from "./lib/util.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(SCRIPTS_DIR, "..");
const ROOT = projectRoot(SCRIPTS_DIR);
const DIR = join(ROOT, "contatos");
const INTERFACE_VERSION = 1;
const APP = { name: "contact-base", version: readJson(join(APP_DIR, "flyee.module.json"))?.version ?? "0.0.0" };
const THRESHOLDS = readJson(join(APP_DIR, "references", "limiares.json"));

const PATHS = {
  dir: DIR,
  inventory: join(DIR, "inventario.json"),
  clean: join(DIR, "base-limpa.csv"),
  legal: join(DIR, "base-legal.md"),
  segments: join(DIR, "segmentos.json"),
  sequences: join(DIR, "regua.json"),
  sequencesMd: join(DIR, "regua.md"),
};

const ARG_SPEC = { flags: ["json"], options: ["today", "target", "first", "campaign", "group", "plan"] };

const HELP = `Base de contatos e CRM (interface ${INTERFACE_VERSION})

  check                                  o app está pronto; o que o projeto já tem
  inventory <csv…>                       lê os exports de usuários e contatos, limpa, agrupa e conta (só contagens em inventario.json)
  legal [--group <grupo>]                cria ou confere base-legal.md: a base legal de cada grupo
  segments                               os segmentos da base limpa, o teto de mensagens e a escada de ofertas
  sequence <grupo> [--target AAAA-MM-DD] [--first <mensagem>] [--campaign <nome>]
                                         a régua do grupo, ancorada no plano ou na data alvo
  status · help

Grupos: ${GROUPS.join(", ")}. Todos aceitam --json. Os comandos partem da raiz do projeto (a pasta que contém .flyee/).`;

const command = (text) => `node .flyee/modules/contact-base/scripts/contacts.mjs ${text} --json`;
const rel = (path) => toPosix(ROOT, path);
const base = (name) => ({ ok: true, command: name, interface_version: INTERFACE_VERSION, app: APP });
const usage = (message, fix = "Rode help para ver os comandos.") => new AppError("usage", message, fix);

function ensureDir() {
  mkdirSync(PATHS.dir, { recursive: true });
}

function todayOf(values) {
  const today = values.today ?? isoDay();
  if (!parseDay(today)) throw usage(`Data inválida em --today: ${today}. Use AAAA-MM-DD.`);
  return today;
}

function insideProject(path) {
  const file = resolve(ROOT, path);
  const relPath = relative(ROOT, file);
  if (relPath.startsWith("..") || resolve(file) !== file) throw new AppError("outside_project", `${path} está fora do projeto.`, "Copie o export para a pasta contatos/entrada/ do projeto e importe de lá: a base não sai da pasta da marca.");
  return file;
}

/** The approved plan of the project, or the newest one. */
function findPlan(slug = null) {
  const dir = join(ROOT, "media-plan");
  if (!existsSync(dir)) return null;
  const plans = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, "plano.json")))
    .map((entry) => ({ slug: entry.name, file: join(dir, entry.name, "plano.json"), data: readJson(join(dir, entry.name, "plano.json")) }))
    .filter((plan) => plan.data);
  if (!plans.length) return null;
  if (slug) return plans.find((plan) => plan.slug === slugify(slug)) ?? null;
  const approved = plans.filter((plan) => plan.data.state === "aprovado").sort((a, b) => String(b.data.approved_at ?? "").localeCompare(String(a.data.approved_at ?? "")));
  return approved[0] ?? plans.sort((a, b) => String(b.data.generated_at ?? "").localeCompare(String(a.data.generated_at ?? "")))[0];
}

function loadInventory({ required = true } = {}) {
  const inventory = readJson(PATHS.inventory);
  if (!inventory && required) throw new AppError("inventory_missing", "Ainda não há inventário da base neste projeto.", `Rode ${command("inventory <export.csv>")} com os exports de usuários e contatos.`);
  return inventory;
}

function loadLegal({ inventory = null, today, create = false }) {
  let text = readText(PATHS.legal);
  let created = false;
  if (text === null && create) {
    text = legalTemplate({ inventory, today });
    writeFileAtomic(PATHS.legal, text);
    created = true;
  }
  return { parsed: text === null ? null : parseLegal(text), created, exists: text !== null };
}

// ---------------------------------------------------------------- commands

function checkCommand(values) {
  ensureDir();
  const today = todayOf(values);
  const inventory = loadInventory({ required: false });
  const { parsed } = loadLegal({ inventory, today });
  const plan = findPlan();
  const sequences = readJson(PATHS.sequences);
  const legalStatus = parsed ? Object.fromEntries(GROUPS.map((group) => [group, parsed[group]?.status ?? "pendente"])) : null;
  const next = !inventory
    ? { action: "inventory", command: command("inventory contatos/entrada/<export.csv>"), say: "Comece pelo inventário: o export de usuários e contatos entra, a base limpa e as contagens saem." }
    : !parsed || Object.values(legalStatus).some((status) => status !== "completo")
      ? { action: "legal", command: command("legal"), say: "Falta a base legal de um ou mais grupos: sem ela a régua fica pendente." }
      : { action: "sequence", command: command("sequence clientes"), say: "Base e base legal prontas: monte a régua de cada grupo." };
  return {
    ...base("check"),
    node: process.versions.node,
    project: ROOT,
    ready: Boolean(THRESHOLDS),
    dir: rel(PATHS.dir),
    inventory: inventory ? { file: rel(PATHS.inventory), total: inventory.counts.total, valid: inventory.counts.valid, generated_at: inventory.generated_at } : null,
    legal: legalStatus ? { file: rel(PATHS.legal), groups: legalStatus } : null,
    segments: existsSync(PATHS.segments) ? rel(PATHS.segments) : null,
    sequences: sequences ? Object.fromEntries(Object.entries(sequences.groups ?? {}).map(([group, sequence]) => [group, sequence.state])) : null,
    plan: plan ? { plan: plan.slug, state: plan.data.state, file: rel(plan.file) } : null,
    thresholds_checked_on: THRESHOLDS.checked_on,
    next_step: next,
  };
}

function inventoryCommand(positionals, values) {
  ensureDir();
  const today = todayOf(values);
  if (!positionals.length) throw usage("Informe ao menos um export: inventory <export.csv> [outro.csv…].", "Exporte a lista de usuários ou contatos da sua ferramenta, em CSV, e salve em contatos/entrada/.");
  const exports = positionals.map((path) => {
    const file = insideProject(path);
    const text = readText(file);
    if (text === null) throw usage(`Arquivo não encontrado: ${path}.`);
    const data = readExport(text, { file: rel(file) });
    return { ...data, file: rel(file) };
  });
  const { clean, inventory, problems } = buildInventory(exports, { today, thresholds: THRESHOLDS });
  writeFileAtomic(PATHS.clean, `${cleanHeader()}\n${cleanLines(clean).join("\n")}\n`);
  writeJson(PATHS.inventory, inventory);
  const say = inventorySay(inventory);
  const sensitive = exports.flatMap((data) => data.sensitive);
  return {
    ...base("inventory"),
    files: { inventory: rel(PATHS.inventory), clean: rel(PATHS.clean) },
    counts: inventory.counts,
    groups: inventory.groups,
    activity: inventory.activity,
    by_source: inventory.by_source,
    columns: exports.map((data) => ({ file: data.file, used: data.map, dropped: data.dropped, sensitive_dropped: data.sensitive })),
    problems: problems.slice(0, 50),
    problems_total: problems.length,
    say,
    next_step: { action: "legal", command: command("legal"), say: `${say[0]} ${sensitive.length ? `Colunas como ${sensitive.join(", ")} ficaram de fora da base limpa: não são necessárias para escrever a ninguém. ` : ""}Agora a base legal de cada grupo.` },
  };
}

function legalCommand(values) {
  ensureDir();
  const today = todayOf(values);
  const inventory = loadInventory({ required: false });
  const { parsed, created } = loadLegal({ inventory, today, create: true });
  const groups = values.group ? [values.group] : GROUPS;
  for (const group of groups) if (!GROUPS.includes(group)) throw new AppError("group_unknown", `O grupo ${group} não existe.`, `Os grupos são ${GROUPS.join(", ")}.`);
  const status = Object.fromEntries(groups.map((group) => [group, { label: GROUP_LABELS[group], status: parsed[group].status, basis: parsed[group].basis, missing: parsed[group].missing, marketing_allowed: parsed[group].marketing_allowed, counts: inventory?.groups?.[group] ?? null }]));
  const pending = groups.filter((group) => parsed[group].status !== "completo");
  const questions = pending.flatMap((group) => legalQuestions(parsed, group)).slice(0, 4);
  return {
    ...base("legal"),
    file: rel(PATHS.legal),
    created,
    groups: status,
    pending,
    questions,
    next_step: pending.length
      ? { action: "ask", command: command("legal"), say: `${created ? `Criei ${rel(PATHS.legal)} com uma seção por grupo. ` : ""}${pending.length} grupo(s) com a base legal pendente. Pergunte ao integrante numa mensagem só (até quatro perguntas, cada uma com a sugestão), grave as respostas nas linhas do arquivo e rode legal de novo. Isto é método, não parecer jurídico.` }
      : { action: "segments", command: command("segments"), say: "Base legal completa em todos os grupos. Monte os segmentos e a régua." },
  };
}

function segmentsCommand(values) {
  ensureDir();
  const today = todayOf(values);
  loadInventory();
  const text = readText(PATHS.clean);
  if (text === null) throw new AppError("inventory_missing", "A base limpa não existe.", `Rode ${command("inventory <export.csv>")} de novo.`);
  const clean = readClean(text);
  const plan = findPlan(values.plan ?? null);
  const { summary } = segmentBase(clean, { today, thresholds: THRESHOLDS, plan: plan?.data ?? null });
  writeJson(PATHS.segments, { ...summary, plan: plan?.slug ?? null });
  return { ...base("segments"), file: rel(PATHS.segments), plan: plan?.slug ?? null, ...summary, next_step: { action: "sequence", command: command("sequence clientes"), say: `${summary.say} Monte a régua por grupo.` } };
}

function sequenceCommand(positionals, values) {
  ensureDir();
  const today = todayOf(values);
  const group = positionals[0];
  if (!group) throw usage(`Informe o grupo: sequence <grupo>. Os grupos são ${GROUPS.join(", ")}.`);
  if (!GROUPS.includes(group)) throw new AppError("group_unknown", `O grupo ${group} não existe.`, `Os grupos são ${GROUPS.join(", ")}.`);
  const inventory = loadInventory();
  const { parsed } = loadLegal({ inventory, today, create: true });
  const plan = findPlan(values.plan ?? null);
  const anchors = anchorsFor({ plan, target: values.target ?? null, today });
  const premises = plan?.data?.premises ?? {};
  const page = /https?:\/\/[^\s);,]+/i.exec(premises.prontidao?.value ?? "")?.[0] ?? plan?.data?.page_url ?? null;
  const sequence = buildSequence(group, { anchors, legal: parsed[group], counts: inventory.groups[group], thresholds: THRESHOLDS, plan: plan?.data ?? null, brand: plan?.data?.brand ?? null, page, utmRule: plan?.data?.tracking?.utm_rule ?? DEFAULT_UTM_RULE, campaign: values.campaign ?? plan?.slug ?? null, today, first: values.first ?? null });
  const store = readJson(PATHS.sequences) ?? { version: 1, groups: {} };
  store.groups[group] = sequence;
  store.updated_at = today;
  writeJson(PATHS.sequences, store);
  writeFileAtomic(PATHS.sequencesMd, renderSequences(store, { brand: plan?.data?.brand ?? null }));
  const questions = sequence.state === "pendente" ? legalQuestions(parsed, group) : [];
  return {
    ...base("sequence"),
    group,
    files: { json: rel(PATHS.sequences), markdown: rel(PATHS.sequencesMd), legal: rel(PATHS.legal) },
    ...sequence,
    questions,
    next_step:
      sequence.state === "pendente"
        ? { action: "ask", command: command("legal"), say: `A régua de ${group} está escrita em ${rel(PATHS.sequencesMd)}, mas pendente: ${sequence.pending_why}. Pergunte ao integrante numa mensagem só o que falta, grave em base-legal.md e rode sequence de novo.` }
        : { action: "write", command: null, say: `A régua de ${group} está pronta em ${rel(PATHS.sequencesMd)}: ${sequence.steps.length} mensagens. Escreva o corpo de cada uma com o guia de texto da régua, revise com a skill texto-natural e entregue ao integrante; quem envia é ele, pela ferramenta dele.` },
  };
}

function statusCommand(values) {
  return checkCommand(values);
}

// ---------------------------------------------------------------- output

function renderText(result) {
  const next = result.next_step?.say ? [`Próximo passo: ${result.next_step.say}`] : [];
  let body;
  switch (result.command) {
    case "help":
      return result.text;
    case "check":
      body = [`Base de contatos e CRM ${result.app.version} · Node ${result.node}`, `Inventário: ${result.inventory ? `${result.inventory.total} pessoa(s), ${result.inventory.valid} podem receber` : "não existe"}; base legal: ${result.legal ? Object.entries(result.legal.groups).map(([group, status]) => `${group} ${status}`).join(", ") : "não existe"}.`];
      break;
    case "inventory":
      body = result.say;
      break;
    case "legal":
      body = Object.entries(result.groups).map(([group, entry]) => `${group}: ${entry.status}${entry.missing.length ? ` (faltam ${entry.missing.join(", ")})` : ""}`);
      break;
    case "segments":
    case "sequence":
      body = [result.say];
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
      return checkCommand(values);
    case "inventory":
      return inventoryCommand(positionals, values);
    case "legal":
      return legalCommand(values);
    case "segments":
      return segmentsCommand(values);
    case "sequence":
      return sequenceCommand(positionals, values);
    case "status":
      return statusCommand(values);
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
