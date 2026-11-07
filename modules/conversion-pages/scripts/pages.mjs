#!/usr/bin/env node
// Páginas que vendem: the member's AI runs this script from the project root.
// Only JSON goes to stdout (with --json); progress goes to stderr. Every result carries `next_step`.

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { audit } from "./lib/checks.mjs";
import { missingFacts, newFacts, renderPlan, FACT_LABELS } from "./lib/plan.mjs";
import { AppError, findEngine, isoDay, isPageName, parseArgs, progress, projectRoot, readJson, runNode, toPosix, versionAtLeast, writeFileAtomic, writeJson } from "./lib/util.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(SCRIPTS_DIR, "..");
const ROOT = projectRoot(SCRIPTS_DIR);
const INTERFACE_VERSION = 1;
const ENGINE_MIN = "1.1.0";
const CAPTURE_TIMEOUT_MS = 5 * 60 * 1000;
const APP = { name: "conversion-pages", version: readJson(join(APP_DIR, "flyee.module.json"))?.version ?? "0.0.0" };
const TYPES = readJson(join(APP_DIR, "references", "tipos.json"));
const CHECKS = readJson(join(APP_DIR, "references", "checks.json"));
const MODELS = readJson(join(APP_DIR, "references", "modelos.json"));

const ARG_SPEC = { flags: ["json"], options: ["type", "dir", "url", "capture"] };

const HELP = `Páginas que vendem (interface ${INTERFACE_VERSION})

  check                          o app está pronto; o motor de captura; as páginas deste projeto
  types                          os tipos de página que o app conhece
  models [--type <tipo>]         os modelos analisados, por tipo
  new <pagina> --type <tipo> [--dir <pasta>]
                                 cria a pasta da página com pagina.json e plano.md
  plan <pagina>                  refaz plano.md a partir de pagina.json
  audit <pagina> [--url <endereço ou arquivo .mhtml> | --capture <captura.json>]
                                 captura a página pronta e confere os itens do tipo
  status <pagina> · list · help

Todos aceitam --json. Os comandos partem da raiz do projeto aberto.`;

const command = (text) => `node .flyee/modules/conversion-pages/scripts/pages.mjs ${text} --json`;

function typeById(id) {
  return TYPES.types.find((t) => t.id === id) ?? null;
}

function modelsFor(typeId) {
  return MODELS.models.filter((m) => !typeId || m.types.includes(typeId));
}

/** Where new pages go: --dir, else docs/paginas when the project already has docs/, else paginas. */
function pagesBase(dirOption) {
  if (dirOption) return resolve(ROOT, dirOption);
  return existsSync(join(ROOT, "docs")) ? join(ROOT, "docs", "paginas") : join(ROOT, "paginas");
}

function pageDirs() {
  return [join(ROOT, "paginas"), join(ROOT, "docs", "paginas")];
}

function findPage(name, dirOption) {
  if (!isPageName(name)) throw new AppError("invalid_name", `O nome "${name}" não serve para uma página.`, "Use letras minúsculas, números e hífens, como upsell-agente.");
  const bases = dirOption ? [resolve(ROOT, dirOption)] : pageDirs();
  for (const base of bases) {
    const dir = join(base, name);
    if (existsSync(join(dir, "pagina.json"))) return dir;
  }
  throw new AppError("page_not_found", `Não achei a página ${name} neste projeto.`, `Crie com ${command(`new ${name} --type <tipo>`)}.`);
}

function readFacts(dir) {
  const facts = readJson(join(dir, "pagina.json"));
  if (!facts || typeof facts !== "object") throw new AppError("invalid_json", "O arquivo pagina.json não pôde ser lido.", "Confira se ele é um JSON válido.");
  const type = typeById(facts.type);
  if (!type) throw new AppError("unknown_type", `O tipo "${facts.type}" de pagina.json não existe.`, `Use um destes: ${TYPES.types.map((t) => t.id).join(", ")}.`);
  return { facts, type };
}

function listPages() {
  const pages = [];
  for (const base of pageDirs()) {
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const facts = readJson(join(base, entry.name, "pagina.json"));
      if (!facts) continue;
      const result = readJson(join(base, entry.name, "conferencia.json"));
      pages.push({ name: entry.name, type: facts.type, dir: toPosix(ROOT, join(base, entry.name)), audited: result ? result.summary : null });
    }
  }
  return pages;
}

function cmdCheck() {
  const engine = findEngine(ROOT, APP_DIR);
  const engineReady = Boolean(engine && versionAtLeast(engine.version, ENGINE_MIN));
  return {
    ok: true,
    app: APP,
    interface_version: INTERFACE_VERSION,
    project: ROOT,
    types: TYPES.types.map((t) => t.id),
    models: MODELS.models.length,
    engine: engine ? { found: true, version: engine.version, full_reading: engineReady } : { found: false },
    pages: listPages(),
    next_step: engineReady
      ? "Pronto. Reconheça o tipo de página do pedido e rode new."
      : engine
        ? "O Motor de vídeo instalado não traz a leitura completa da página: atualize com npx --yes flyee@latest update video-render --yes --json antes da conferência."
        : "Para a conferência automática, instale o Motor de vídeo com npx --yes flyee@latest add video-render --yes --json. O roteiro e o plano funcionam sem ele.",
  };
}

function cmdTypes() {
  return {
    ok: true,
    types: TYPES.types.map((t) => ({ id: t.id, label: t.label, where: t.where, asks: t.asks, file: `references/${t.file}`, models: t.models })),
    next_step: "Leia o roteiro do tipo em references/ e os princípios em references/principios.md.",
  };
}

function cmdModels(values) {
  if (values.type && !typeById(values.type)) throw new AppError("unknown_type", `O tipo "${values.type}" não existe.`, `Use um destes: ${TYPES.types.map((t) => t.id).join(", ")}.`);
  const models = modelsFor(values.type);
  return {
    ok: true,
    models: models.map((m) => ({ id: m.id, title: m.title, source: m.source, seen_on: m.seen_on, types: m.types, file: `references/${m.file}`, highlights: m.highlights })),
    next_step: models.length ? "Leia os modelos que servem ao pedido antes de planejar." : "Ainda não há modelo deste tipo: siga o roteiro do tipo.",
  };
}

function cmdNew(name, values) {
  if (!isPageName(name)) throw new AppError("invalid_name", `O nome "${name ?? ""}" não serve para uma página.`, "Use letras minúsculas, números e hífens, como upsell-agente.");
  const type = typeById(values.type);
  if (!type) throw new AppError("unknown_type", `Diga o tipo da página com --type.`, `Tipos: ${TYPES.types.map((t) => t.id).join(", ")}.`);
  const dir = join(pagesBase(values.dir), name);
  if (existsSync(join(dir, "pagina.json"))) throw new AppError("page_exists", `A página ${name} já existe.`, `Abra ${toPosix(ROOT, dir)}/pagina.json, ou rode plan para refazer o plano.`);
  mkdirSync(dir, { recursive: true });
  const today = isoDay();
  const facts = newFacts({ name, type: type.id, today });
  writeJson(join(dir, "pagina.json"), facts);
  writeFileAtomic(join(dir, "plano.md"), renderPlan({ facts, type, checks: CHECKS, models: modelsFor(type.id), today }));
  const missing = missingFacts(facts, type);
  return {
    ok: true,
    page: name,
    type: type.id,
    dir: toPosix(ROOT, dir),
    files: { facts: toPosix(ROOT, join(dir, "pagina.json")), plan: toPosix(ROOT, join(dir, "plano.md")) },
    missing: missing.map((path) => ({ field: path, label: FACT_LABELS[path] ?? path })),
    next_step: "Preencha pagina.json com o que achar no projeto, pergunte o resto numa mensagem só, cada pergunta com uma sugestão, e rode plan.",
  };
}

function cmdPlan(name, values) {
  const dir = findPage(name, values.dir);
  const { facts, type } = readFacts(dir);
  const today = isoDay();
  writeFileAtomic(join(dir, "plano.md"), renderPlan({ facts, type, checks: CHECKS, models: modelsFor(type.id), today }));
  const missing = missingFacts(facts, type);
  return {
    ok: true,
    page: name,
    type: type.id,
    files: { plan: toPosix(ROOT, join(dir, "plano.md")) },
    missing: missing.map((path) => ({ field: path, label: FACT_LABELS[path] ?? path })),
    next_step: missing.length
      ? "Ainda faltam fatos: pergunte numa mensagem só e rode plan de novo."
      : "Construa a página seguindo plano.md; com ela rodando, rode audit.",
  };
}

/** The engine's JSON answer: the whole stdout (it may be indented over many lines), else its last line. */
export function parseAnswer(stdout) {
  const text = String(stdout ?? "").trim();
  try {
    return JSON.parse(text);
  } catch {}
  try {
    return JSON.parse(text.split("\n").filter(Boolean).pop() ?? "null");
  } catch {
    return null;
  }
}

function isFilePath(text) {
  return /\.(?:html?|mhtml?|mht)$/i.test(text) && !/^[a-z][a-z0-9+.-]*:\/\//i.test(text);
}

async function cmdAudit(name, values) {
  const dir = findPage(name, values.dir);
  const { facts, type } = readFacts(dir);
  let capture;
  let captureFile;
  if (values.capture) {
    captureFile = isAbsolute(values.capture) ? values.capture : resolve(ROOT, values.capture);
    if (!existsSync(captureFile)) throw new AppError("capture_missing", `Não achei a captura ${values.capture}.`, "Passe o caminho de um captura.json do Motor de vídeo, ou use --url.");
    capture = readJson(captureFile);
    if (!capture) throw new AppError("invalid_json", "A captura não pôde ser lida.", "Capture a página de novo com --url.");
  } else {
    let url = values.url ?? facts.url;
    if (!url) throw new AppError("url_missing", "Falta o endereço da página para a conferência.", "Passe --url com o endereço (localhost, produção) ou o arquivo .mhtml salvo, ou registre url em pagina.json.");
    if (isFilePath(url) && !isAbsolute(url)) url = resolve(ROOT, url);
    const engine = findEngine(ROOT, APP_DIR);
    if (!engine) throw new AppError("video_render_missing", "A conferência usa o Motor de vídeo, que não está instalado.", "Instale com npx --yes flyee@latest add video-render --yes --json e rode audit de novo.");
    const outDir = join(dir, "captura");
    progress(`Capturando ${url} com o Motor de vídeo ${engine.version ?? ""}.`);
    // The audit needs the page reading only: no scroll video (and no ffmpeg) and no logo downloads.
    const run = await runNode(engine.script, ["capture", url, "--out", outDir, "--scroll", "0", "--no-assets", "--json"], { cwd: ROOT, timeoutMs: CAPTURE_TIMEOUT_MS, label: "A captura da página" });
    const answer = parseAnswer(run.stdout);
    if (!answer || answer.ok === false) {
      const error = answer?.error ?? {};
      throw new AppError(error.code ?? "capture_failed", error.message ?? "A captura da página falhou.", error.fix ?? "Confira se a página abre no navegador e tente de novo.");
    }
    captureFile = join(outDir, "captura.json");
    capture = readJson(captureFile);
    if (!capture) throw new AppError("capture_failed", "A captura terminou sem o arquivo captura.json.", "Tente de novo; se repetir, atualize o Motor de vídeo.");
  }
  const result = audit({ type, capture, facts, definitions: CHECKS });
  const report = {
    format_version: 1,
    page: name,
    type: type.id,
    audited_at: new Date().toISOString(),
    url: capture.final_url ?? capture.url ?? null,
    input_kind: capture.input_kind ?? null,
    full_reading: result.anatomy,
    summary: result.summary,
    items: result.items,
  };
  writeJson(join(dir, "conferencia.json"), report);
  return {
    ok: true,
    page: name,
    type: type.id,
    full_reading: result.anatomy,
    summary: result.summary,
    items: result.items.map(({ id, status, detail }) => ({ id, status, detail })),
    say: result.say,
    files: { audit: toPosix(ROOT, join(dir, "conferencia.json")), capture: toPosix(ROOT, captureFile) },
    next_step: !result.anatomy
      ? "A captura veio sem a leitura completa: atualize o Motor de vídeo com npx --yes flyee@latest update video-render --yes --json e rode audit de novo."
      : result.summary.atencao
        ? "Corrija na página o que está em atenção, lendo também a lista de conferir à mão do plano, e rode audit de novo."
        : "Nada em atenção. Confira à mão os itens do plano e entregue o resumo em três linhas.",
  };
}

function cmdStatus(name, values) {
  const dir = findPage(name, values.dir);
  const { facts, type } = readFacts(dir);
  const result = readJson(join(dir, "conferencia.json"));
  return {
    ok: true,
    page: name,
    type: type.id,
    dir: toPosix(ROOT, dir),
    missing: missingFacts(facts, type).map((path) => ({ field: path, label: FACT_LABELS[path] ?? path })),
    plan: existsSync(join(dir, "plano.md")),
    audit: result ? { audited_at: result.audited_at, summary: result.summary } : null,
    next_step: result ? "Releia os itens em atenção de conferencia.json." : "Construa a página e rode audit.",
  };
}

function renderText(result) {
  if (result.say?.length) return [`${result.page}: ${result.summary.ok} ok, ${result.summary.atencao} em atenção, ${result.summary.nao_conferido} não conferidos.`, ...result.say, result.next_step].join("\n");
  return `${JSON.stringify(result, null, 2)}`;
}

async function main(argv) {
  const [name, ...rest] = argv;
  const json = argv.includes("--json");
  try {
    if (!TYPES || !CHECKS || !MODELS) throw new AppError("app_incomplete", "Os arquivos de referência do app não foram encontrados.", "Reinstale o app com npx --yes flyee@latest add conversion-pages --yes --json.");
    const { positionals, values } = parseArgs(rest, ARG_SPEC);
    let result;
    switch (name) {
      case "check": result = cmdCheck(); break;
      case "types": result = cmdTypes(); break;
      case "models": result = cmdModels(values); break;
      case "new": result = cmdNew(positionals[0], values); break;
      case "plan": result = cmdPlan(positionals[0], values); break;
      case "audit": result = await cmdAudit(positionals[0], values); break;
      case "status": result = cmdStatus(positionals[0], values); break;
      case "list": result = { ok: true, pages: listPages(), next_step: "Abra uma página com status <pagina>." }; break;
      case undefined:
      case "help":
      case "--help":
        process.stdout.write(`${HELP}\n`);
        return;
      default:
        throw new AppError("usage", `Comando desconhecido: ${name}.`, "Rode o comando help para ver os comandos.");
    }
    process.stdout.write(json ? `${JSON.stringify(result)}\n` : `${renderText(result)}\n`);
  } catch (error) {
    const failure = { ok: false, error: { code: error.code ?? "unexpected", message: error.message, fix: error.fix ?? "Tente de novo; se repetir, rode check." } };
    process.stdout.write(json ? `${JSON.stringify(failure)}\n` : `Erro (${failure.error.code}): ${failure.error.message}\n${failure.error.fix}\n`);
    process.exitCode = 1;
  }
}

await main(process.argv.slice(2));
