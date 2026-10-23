#!/usr/bin/env node
// Plano de estratégia e mídia: the member's AI runs this script from the project root.
// Only JSON goes to stdout (with --json); progress goes to stderr. Every result carries
// `next_step`, so the AI knows what comes next without guessing.

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildCalendar } from "./lib/calendar.mjs";
import { computeEconomics } from "./lib/economics.mjs";
import { brandTemplate, fileDay, lookProject } from "./lib/look.mjs";
import { assessOffer } from "./lib/offer.mjs";
import { PREMISES, premisesTemplate, questionsFor, validatePremises } from "./lib/premises.mjs";
import { buildPlan, checkNarrative, IN_SHORT_MAX_WORDS } from "./lib/report.mjs";
import { AppError, brDay, isoDay, parseArgs, parseDay, projectRoot, readJson, readText, slugify, toPosix, writeFileAtomic, writeJson } from "./lib/util.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(SCRIPTS_DIR, "..");
const ROOT = projectRoot(SCRIPTS_DIR);
const PLANS_DIR = join(ROOT, "media-plan");
const INTERFACE_VERSION = 1;
const APP = { name: "media-plan", version: readJson(join(APP_DIR, "flyee.module.json"))?.version ?? "0.0.0" };
const REFS = readJson(join(APP_DIR, "references", "referencias.json"));
const HOLIDAYS = readJson(join(APP_DIR, "references", "feriados.json"));

const ARG_SPEC = { flags: ["json", "peak", "launch"], options: ["today", "target", "brand", "narrative", "by", "days"] };

const HELP = `Plano de estratégia e mídia (interface ${INTERFACE_VERSION})

  check                         o app está pronto; os planos deste projeto
  new <plano> [--brand] [--target AAAA-MM-DD]
                                cria media-plan/<plano>/ com premissas.json e, se faltar, media-plan/marca.md
  look <plano>                  o que o projeto já sabe, e as perguntas que sobram
  premises <plano>              confere premissas.json: o que está fechado, o que está pendente
  funnel <plano>                a conta: custo permitido, funil ao contrário, cenários, fase de aprendizado
  offer <plano>                 as formas de oferta, a colisão com a promoção de agora, as linhas do consumidor
  calendar <plano> [--today]    as fases até a data alvo, os prazos, os feriados
  plan <plano> [--narrative <arquivo>]
                                monta plano.json e plano.md como rascunho
  approve <plano> --by "<a frase do integrante>"
                                aprova o rascunho quando as premissas que bloqueiam estão fechadas
  status <plano> · list · help

Todos aceitam --json. Os comandos partem da raiz do projeto (a pasta que contém .flyee/).`;

const command = (text) => `node .flyee/modules/media-plan/scripts/plan.mjs ${text} --json`;
const rel = (path) => toPosix(ROOT, path);

function base(name) {
  return { ok: true, command: name, interface_version: INTERFACE_VERSION, app: APP };
}

function usage(message, fix = "Rode help para ver os comandos.") {
  return new AppError("usage", message, fix);
}

function planOf(slug) {
  if (!slug) throw usage("Informe o plano: <comando> <plano>.", `Veja os planos com ${command("list")}.`);
  const clean = slugify(slug);
  const dir = join(PLANS_DIR, clean);
  const paths = {
    dir,
    premises: join(dir, "premissas.json"),
    scenarios: join(dir, "cenarios.json"),
    offer: join(dir, "oferta.json"),
    calendar: join(dir, "calendario.json"),
    plan: join(dir, "plano.json"),
    markdown: join(dir, "plano.md"),
    decisions: join(dir, "decisoes.md"),
    narrative: join(dir, "narrativa.json"),
  };
  if (!existsSync(paths.premises)) throw new AppError("plan_missing", `O plano ${clean} não existe neste projeto.`, `Crie com ${command(`new ${clean}`)}.`);
  const data = readJson(paths.premises);
  if (!data) throw new AppError("premises_invalid", "premissas.json não é um JSON válido.", "Corrija o arquivo e rode de novo.");
  return { slug: clean, paths, data };
}

function todayOf(values, data) {
  const today = values.today ?? data?.today ?? isoDay();
  if (!parseDay(today)) throw usage(`Data inválida em --today: ${today}. Use AAAA-MM-DD.`);
  return today;
}

function targetOf(values, data) {
  const target = values.target ?? data?.target_date ?? null;
  if (target && !parseDay(target)) throw usage(`Data inválida: ${target}. Use AAAA-MM-DD.`);
  return target;
}

function planVersion(paths) {
  const current = readJson(paths.plan);
  return current?.version ?? 1;
}

// ---------------------------------------------------------------- commands

function checkCommand() {
  const plans = listPlans();
  return {
    ...base("check"),
    node: process.versions.node,
    project: ROOT,
    ready: Boolean(REFS && HOLIDAYS),
    brand_file: existsSync(join(PLANS_DIR, "marca.md")),
    plans: plans.map((plan) => plan.plan),
    refs_checked_on: REFS?.checked_on ?? null,
    next_step: plans.length
      ? { action: "status", command: command(`status ${plans[0].plan}`), say: "Há plano neste projeto: veja em que etapa ele está." }
      : { action: "new", command: command("new <plano> --target AAAA-MM-DD"), say: "Nenhum plano ainda. Crie um com o nome da campanha e a data alvo, se ela existir." },
  };
}

function newCommand(positionals, values) {
  const name = positionals[0];
  if (!name) throw usage("Informe o nome do plano: new <plano>.", "Um nome curto, como black-friday-2026 ou lancamento-marco.");
  const slug = slugify(name);
  const dir = join(PLANS_DIR, slug);
  const premisesPath = join(dir, "premissas.json");
  if (existsSync(premisesPath)) throw new AppError("plan_exists", `O plano ${slug} já existe.`, `Siga com ${command(`status ${slug}`)}.`);
  const target = targetOf(values, null);
  mkdirSync(dir, { recursive: true });
  const template = premisesTemplate(slug, values.brand ?? "");
  template.target_date = target;
  writeJson(premisesPath, template);
  writeFileAtomic(join(dir, "decisoes.md"), `# Decisões do plano ${slug}\n\nUma linha por decisão do integrante, com a data e a frase dele. O app acrescenta; ninguém apaga.\n`);
  let brandCreated = false;
  if (!existsSync(join(PLANS_DIR, "marca.md"))) {
    writeFileAtomic(join(PLANS_DIR, "marca.md"), brandTemplate());
    brandCreated = true;
  }
  return {
    ...base("new"),
    plan: slug,
    dir: rel(dir),
    files: { premises: rel(premisesPath), decisions: rel(join(dir, "decisoes.md")), brand: rel(join(PLANS_DIR, "marca.md")) },
    brand_file_created: brandCreated,
    target_date: target,
    next_step: { action: "look", command: command(`look ${slug}`), say: "Antes de perguntar qualquer coisa, veja o que o projeto já sabe." },
  };
}

function lookCommand(positionals) {
  const { slug, paths, data } = planOf(positionals[0]);
  const look = lookProject(ROOT);
  const { questions, more_pending } = questionsFor(data, 4);
  // What the project already answers, premise by premise, so the AI fills `encontrado` with the file.
  const hints = {};
  for (const fact of look.found) {
    if (!PREMISES.some((premise) => premise.key === fact.premise)) continue;
    (hints[fact.premise] ??= []).push({ value: fact.value, where: fact.where, ...(fact.price_brl !== undefined ? { price_brl: fact.price_brl } : {}), ...(fact.daily_brl !== undefined ? { daily_brl: fact.daily_brl } : {}), ...(fact.cost_brl !== undefined ? { cost_brl: fact.cost_brl } : {}) });
  }
  const answered = questions.filter((question) => hints[question.key]);
  const open = questions.filter((question) => !hints[question.key]);
  return {
    ...base("look"),
    plan: slug,
    found: look.found,
    hints,
    looked: look.looked,
    questions: open,
    answered_by_project: answered.map((question) => question.key),
    more_pending,
    brand_file: look.has_brand_file ? rel(join(PLANS_DIR, "marca.md")) : null,
    next_step: {
      action: "fill_premises",
      command: command(`premises ${slug}`),
      say: `Preencha ${rel(paths.premises)} com o que o projeto já responde (origem encontrado, com o arquivo) e com as suas sugestões rotuladas (sugerido-pendente, com o que muda se a resposta for outra). Depois pergunte ao integrante, numa mensagem só, o que sobrou: ${open.length} pergunta(s).`,
    },
  };
}

function premisesCommand(positionals) {
  const { slug, paths, data } = planOf(positionals[0]);
  const result = validatePremises(data);
  const { questions, more_pending } = questionsFor(data, 4);
  const suggestions = questions.filter((question) => question.suggestion);
  const next = result.blocking_pending.length
    ? { action: "ask", command: null, say: `Pergunte ao integrante numa mensagem só${suggestions.length ? ", cada pergunta com a sua sugestão e o que muda se a resposta for outra" : ""}; com as respostas, grave as premissas como informado ou confirmado e rode premises de novo.` }
    : { action: "funnel", command: command(`funnel ${slug}`), say: "As premissas que bloqueiam estão fechadas: faça a conta." };
  return { ...base("premises"), plan: slug, ...result, questions, more_pending, file: rel(paths.premises), target_date: data.target_date ?? null, next_step: next };
}

function calendarFor(data, values, paths) {
  const target = targetOf(values, data);
  if (!target) return null;
  const peak = values.launch ? false : true;
  return buildCalendar({ today: todayOf(values, data), targetDate: target, holidays: HOLIDAYS, peak });
}

function paidDays(calendar) {
  if (!calendar?.phases) return null;
  return calendar.phases.filter((phase) => ["testes", "escala", "aquecimento", "pico"].includes(phase.id)).reduce((sum, phase) => sum + phase.days, 0) || null;
}

function funnelCommand(positionals, values) {
  const { slug, paths, data } = planOf(positionals[0]);
  validatePremises(data);
  const calendar = calendarFor(data, values, paths);
  const days = values.days ? Number(values.days) : paidDays(calendar);
  const economics = computeEconomics(data, REFS, { days: Number.isFinite(days) && days > 0 ? days : null, peak: Boolean(calendar?.peak) });
  writeJson(paths.scenarios, { ...economics, plan: slug, generated_at: new Date().toISOString() });
  const say = [economics.economics?.say, economics.funnel?.say, economics.learning_floor?.say].filter(Boolean).join(" ");
  return { ...base("funnel"), plan: slug, file: rel(paths.scenarios), ...economics, say: say || "Sem preço e sem meta não há conta a fazer: feche essas premissas primeiro.", next_step: { action: "offer", command: command(`offer ${slug}`), say: "Mostre a conta ao integrante com as palavras de say, e siga para a oferta." } };
}

function offerCommand(positionals, values) {
  const { slug, paths, data } = planOf(positionals[0]);
  validatePremises(data);
  const offer = assessOffer(data, { targetDate: targetOf(values, data) });
  writeJson(paths.offer, { ...offer, plan: slug, generated_at: new Date().toISOString() });
  return { ...base("offer"), plan: slug, file: rel(paths.offer), ...offer, next_step: { action: "calendar", command: command(`calendar ${slug}`), say: "Mostre as formas de oferta como opções, nunca como decisão tomada, e siga para o calendário." } };
}

function calendarCommand(positionals, values) {
  const { slug, paths, data } = planOf(positionals[0]);
  const target = targetOf(values, data);
  if (!target) throw new AppError("target_missing", "O plano não tem data alvo.", `Grave target_date em ${rel(paths.premises)} ou passe --target AAAA-MM-DD.`);
  const calendar = calendarFor(data, values, paths);
  writeJson(paths.calendar, { ...calendar, plan: slug, generated_at: new Date().toISOString() });
  return { ...base("calendar"), plan: slug, file: rel(paths.calendar), ...calendar, next_step: { action: "plan", command: command(`plan ${slug}`), say: "Com as três contas feitas, monte o rascunho do plano." } };
}

function planCommand(positionals, values) {
  const { slug, paths, data } = planOf(positionals[0]);
  const validity = validatePremises(data);
  const calendar = calendarFor(data, values, paths);
  const economics = computeEconomics(data, REFS, { days: paidDays(calendar), peak: Boolean(calendar?.peak) });
  const offer = assessOffer(data, { targetDate: calendar?.target_date ?? null });
  let narrative = null;
  const narrativePath = values.narrative ? resolve(ROOT, values.narrative) : existsSync(paths.narrative) ? paths.narrative : null;
  if (narrativePath) {
    narrative = readJson(narrativePath);
    if (!narrative) throw new AppError("narrative_invalid", `${rel(narrativePath)} não é um JSON válido.`, "Escreva narrativa.json como o guia da skill mostra.");
    const problems = checkNarrative(narrative);
    if (problems.length) throw new AppError("narrative_invalid", `A narrativa tem ${problems.length} problema(s).`, "Corrija cada item apontado e rode plan de novo.", { problems });
  }
  const current = readJson(paths.plan);
  const version = current?.state === "aprovado" ? (current.version ?? 1) + 1 : (current?.version ?? 1);
  const built = buildPlan({ data, economics, offer, calendar, narrative, generatedAt: new Date().toISOString(), version, state: "rascunho", refs: REFS });
  const tooLong = built.warnings.find((warning) => warning.code === "in_short_long");
  if (tooLong) throw new AppError("in_short_long", tooLong.text, `Encurte os achados em narrativa.json até a seção caber em ${IN_SHORT_MAX_WORDS} palavras.`, { words: tooLong.words });
  writeJson(paths.scenarios, { ...economics, plan: slug, generated_at: built.plan.generated_at });
  writeJson(paths.offer, { ...offer, plan: slug, generated_at: built.plan.generated_at });
  if (calendar) writeJson(paths.calendar, { ...calendar, plan: slug, generated_at: built.plan.generated_at });
  writeJson(paths.plan, built.plan);
  writeFileAtomic(paths.markdown, `${built.markdown}\n`);
  const next = validity.blocking_pending.length
    ? { action: "ask", command: command(`premises ${slug}`), say: `O rascunho está em ${rel(paths.markdown)}. Faltam ${validity.blocking_pending.length} premissa(s) que bloqueiam a aprovação: ${validity.blocking_pending.join(", ")}. Pergunte numa mensagem só, grave as respostas e rode plan de novo.` }
    : { action: "approve", command: command(`approve ${slug} --by "<a frase do integrante>"`), say: `O rascunho está em ${rel(paths.markdown)}. Mostre as três linhas de say e as decisões; com o sim literal do integrante, aprove com a frase dele.` };
  return { ...base("plan"), plan: slug, version, state: "rascunho", files: { plan: rel(paths.plan), markdown: rel(paths.markdown), scenarios: rel(paths.scenarios), offer: rel(paths.offer), calendar: calendar ? rel(paths.calendar) : null }, say: built.say, in_short_words: built.in_short_words, blocking_pending: validity.blocking_pending, pending: validity.pending, warnings: [...built.warnings, ...economics.warnings, ...offer.warnings, ...(calendar?.warnings ?? [])], next_step: next };
}

function approveCommand(positionals, values) {
  const { slug, paths, data } = planOf(positionals[0]);
  const phrase = typeof values.by === "string" ? values.by.trim() : "";
  if (!phrase) throw usage('Informe a frase do integrante: approve <plano> --by "...".', "Só o integrante aprova: copie a frase dele como ele escreveu.");
  const current = readJson(paths.plan);
  if (!current) throw new AppError("plan_not_built", "O plano ainda não foi montado.", `Rode ${command(`plan ${slug}`)} antes.`);
  if (current.state === "aprovado") throw new AppError("already_approved", `A versão ${current.version} já está aprovada.`, `Para mudar o plano, rode ${command(`plan ${slug}`)}: ele cria a versão seguinte como rascunho.`);
  const validity = validatePremises(data);
  if (validity.blocking_pending.length) {
    throw new AppError("premises_pending", `Faltam premissas que bloqueiam a aprovação: ${validity.blocking_pending.join(", ")}.`, "Pergunte ao integrante numa mensagem só, grave as respostas como informado ou confirmado e rode plan e approve de novo.", { pending: validity.blocking_pending });
  }
  const approvedAt = new Date().toISOString();
  const approved = { ...current, state: "aprovado", approved_at: approvedAt, approved_by: phrase };
  writeJson(paths.plan, approved);
  const markdown = readText(paths.markdown) ?? "";
  writeFileAtomic(paths.markdown, markdown.replace(/, rascunho, gerado em/, `, aprovado em ${approvedAt.slice(0, 10)}, gerado em`));
  const versionJson = join(paths.dir, `plano-v${approved.version}.json`);
  writeJson(versionJson, approved);
  writeFileAtomic(join(paths.dir, `plano-v${approved.version}.md`), readText(paths.markdown) ?? "");
  const decisions = readText(paths.decisions) ?? `# Decisões do plano ${slug}\n`;
  writeFileAtomic(paths.decisions, `${decisions.trimEnd()}\n\n- ${approvedAt.slice(0, 10)}: versão ${approved.version} aprovada. Frase do integrante: "${phrase}".\n`);
  return {
    ...base("approve"),
    plan: slug,
    version: approved.version,
    state: "aprovado",
    approved_at: approvedAt,
    files: { plan: rel(paths.plan), markdown: rel(paths.markdown), frozen: rel(versionJson), decisions: rel(paths.decisions) },
    next_step: { action: "handoff", command: null, say: "O plano aprovado é o que os outros apps leem: os criativos partem da oferta, do evento e da verba dele; a régua da base parte das datas das fases. Diga ao integrante o primeiro passo e siga nesta conversa." },
  };
}

function stageOf(paths, data) {
  const plan = readJson(paths.plan);
  if (plan?.state === "aprovado") return { stage: "aprovado", next: { action: "handoff", command: null, say: "Plano aprovado. Para mudar algo, rode plan de novo: a versão seguinte nasce como rascunho." } };
  if (plan) {
    const validity = validatePremises(data);
    return validity.blocking_pending.length
      ? { stage: "rascunho", next: { action: "ask", command: command(`premises ${data.plan}`), say: `Rascunho pronto; faltam ${validity.blocking_pending.join(", ")}.` } }
      : { stage: "pronto", next: { action: "approve", command: command(`approve ${data.plan} --by "<a frase do integrante>"`), say: "Rascunho completo: falta o sim do integrante." } };
  }
  if (existsSync(paths.calendar) || existsSync(paths.scenarios)) return { stage: "contas", next: { action: "plan", command: command(`plan ${data.plan}`), say: "As contas estão feitas: monte o rascunho." } };
  const filled = PREMISES.filter((premise) => typeof data.premises?.[premise.key]?.value === "string" && data.premises[premise.key].value.trim()).length;
  if (filled) return { stage: "premissas", next: { action: "premises", command: command(`premises ${data.plan}`), say: `${filled} de ${PREMISES.length} premissas preenchidas: confira e pergunte o que falta.` } };
  return { stage: "novo", next: { action: "look", command: command(`look ${data.plan}`), say: "Comece olhando o que o projeto já sabe." } };
}

function statusCommand(positionals) {
  const { slug, paths, data } = planOf(positionals[0]);
  const { stage, next } = stageOf(paths, data);
  const plan = readJson(paths.plan);
  return { ...base("status"), plan: slug, stage, version: plan?.version ?? null, state: plan?.state ?? null, target_date: data.target_date ?? null, brand: data.brand || null, files: { premises: rel(paths.premises), plan: existsSync(paths.plan) ? rel(paths.plan) : null, markdown: existsSync(paths.markdown) ? rel(paths.markdown) : null }, updated: fileDay(paths.plan) ?? fileDay(paths.premises), next_step: next };
}

function listPlans() {
  if (!existsSync(PLANS_DIR)) return [];
  return readdirSync(PLANS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(PLANS_DIR, entry.name, "premissas.json")))
    .map((entry) => {
      const paths = { plan: join(PLANS_DIR, entry.name, "plano.json"), premises: join(PLANS_DIR, entry.name, "premissas.json") };
      const data = readJson(paths.premises) ?? {};
      const plan = readJson(paths.plan);
      return { plan: entry.name, target_date: data.target_date ?? null, state: plan?.state ?? "premissas", version: plan?.version ?? null, updated: fileDay(paths.plan) ?? fileDay(paths.premises) };
    })
    .sort((a, b) => a.plan.localeCompare(b.plan));
}

function listCommand() {
  const plans = listPlans();
  return { ...base("list"), plans, next_step: plans.length ? { action: "status", command: command(`status ${plans[0].plan}`), say: `${plans.length} plano(s) neste projeto.` } : { action: "new", command: command("new <plano>"), say: "Nenhum plano ainda." } };
}

// ---------------------------------------------------------------- output

function renderText(result) {
  const next = result.next_step?.say ? [`Próximo passo: ${result.next_step.say}`] : [];
  let body;
  switch (result.command) {
    case "help":
      return result.text;
    case "check":
      body = [`Plano de estratégia e mídia ${result.app.version} · Node ${result.node}`, `Planos: ${result.plans.length ? result.plans.join(", ") : "nenhum"}`];
      break;
    case "look":
      body = [`${result.found.length} fato(s) encontrado(s) no projeto; ${result.questions.length} pergunta(s) sobram.`];
      break;
    case "premises":
      body = [`Fechadas: ${result.settled.length}. Pendentes: ${result.pending.length}${result.blocking_pending.length ? ` (bloqueiam: ${result.blocking_pending.join(", ")})` : ""}.`];
      break;
    case "plan":
      body = result.say;
      break;
    case "calendar":
    case "funnel":
    case "offer":
      body = [result.say];
      break;
    case "approve":
      body = [`Versão ${result.version} aprovada em ${brDay(result.approved_at.slice(0, 10), true)}.`];
      break;
    case "status":
      body = [`Plano ${result.plan}: etapa ${result.stage}${result.target_date ? `, data alvo ${brDay(result.target_date, true)}` : ""}.`];
      break;
    case "list":
      body = result.plans.length ? result.plans.map((plan) => `${plan.plan}: ${plan.state}${plan.target_date ? `, até ${brDay(plan.target_date, true)}` : ""}`) : ["Nenhum plano ainda."];
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
    case "new":
      return newCommand(positionals, values);
    case "look":
      return lookCommand(positionals);
    case "premises":
      return premisesCommand(positionals);
    case "funnel":
      return funnelCommand(positionals, values);
    case "offer":
      return offerCommand(positionals, values);
    case "calendar":
      return calendarCommand(positionals, values);
    case "plan":
      return planCommand(positionals, values);
    case "approve":
      return approveCommand(positionals, values);
    case "status":
      return statusCommand(positionals);
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
