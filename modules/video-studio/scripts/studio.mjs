#!/usr/bin/env node
// Estúdio de vídeo: the commands the member's AI runs.
//   node .flyee/modules/video-studio/scripts/studio.mjs <command> [options] [--json]
// This script keeps the video's state (pedido.json), asks the brief's own logic (lib/intake.mjs)
// what to ask and what comes next, keeps the brand kit, writes the roteiro and the page, and asks
// the Motor de vídeo (video-render) to capture the site, compose the sound, render, mix and check.
// Only JSON goes to stdout with --json; progress goes to stderr; every failure is an error with a
// stable code; every result carries `next_step` with the exact next command.

import { spawn } from "node:child_process";
import { copyFileSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { brandSlug, findKit, findProjectSite, hostOf, hostSlug, KIT_MAX_AGE_DAYS, kitAgeDays, kitFile, kitFromCapture, kitSummary, listKits, NEUTRAL_PALETTE, readKit, sameBrandName, writeKit } from "./lib/brand.mjs";
import { CAPTURE_ERRORS, DRY_RUN_VIDEO_RENDER, engineArgs, engineSupports, findVideoRender, INSTALL_VIDEO_RENDER, requireVideoRender, runEngine } from "./lib/engine.mjs";
import {
  adoptAssets,
  buildPage,
  contentHash,
  copyAssets,
  createVideo,
  fileHash,
  freeSlug,
  hashJson,
  INSTALL_SELF,
  isVideo,
  layout,
  listVideos,
  missingRuntime,
  notesMarkdown,
  requireRuntime,
  requireVideo,
  scanMaterials,
  slugOf,
  STUDIO_DIR,
  suggestPost,
  videoDir,
  writeBriefing,
  writeState,
} from "./lib/project.mjs";
import { assetTargets, beatGrid, draftRoteiro, eventsFile, FORMAT, LIMITS, MUSIC_STYLES, onScreenTexts, sceneSummary, solveTiming as localSolveTiming, STYLE_IDS, SYNTH_FOR, SYNTH_STYLES, timeline, trimWords, validateRoteiro } from "./lib/roteiro.mjs";
import { AppError, displayPath, ensureDir, isDir, isFile, MAC, parseArgs, progress, projectRoot, readJson, removeDir, requireJson, resolveInput, round, sha256File, toPosix, usage, WINDOWS, writeFileAtomic, writeJson } from "./lib/util.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(SCRIPTS_DIR, "..");
const ROOT = projectRoot(SCRIPTS_DIR);
const MANIFEST = readJson(join(APP_DIR, "flyee.module.json"), {});
const APP = { name: MANIFEST.name ?? "video-studio", version: MANIFEST.version ?? "0.0.0" };
const INTERFACE_VERSION = 1;
const SCRIPT_COMMAND = `node ${toPosix(ROOT, join(SCRIPTS_DIR, "studio.mjs"))}`;
const ARG_SPEC = {
  flags: ["json", "force", "decide", "decide-all", "refresh", "direct"],
  options: ["request", "slug", "file", "url", "note"],
};
const TEMPLATE_IDS = ["lancamento", "interface", "oferta", "lista", "passos"];
const FEATURES = [
  "motion_video", "vertical_9x16", "duration_6_20", "reels_tiktok_shorts", "measured_brief", "guided_rounds", "brand_capture", "brand_kit",
  "five_roteiros", "five_styles", "original_music", "own_music_file", "effects_on_beat", "preview_before_final", "network_checks", "cover", "delivery_notes",
];
const REGULATED = {
  "saúde": "saúde", odontologia: "odontologia", advocacia: "advocacia", apostas: "apostas", "política": "propaganda política", infantil: "público infantil",
};
const MARKS = { pass: "✓", fail: "✗", warn: "△", skip: "○" };
/** The Motor's checks and this app's own, as the member reads them in the delivery notes. */
const CHECK_LABELS = {
  page: "A página do vídeo",
  first_frame_readable: "Capa legível (o primeiro quadro)",
  safe_area: "Texto e logo longe dos botões das redes",
  text_size: "Tamanho do texto",
  cuts_on_beat: "Cortes na batida",
  loop_seamless: "Emenda do loop",
  flashes: "Piscadas",
  dead_time: "Tempo parado",
  video_size: "Tamanho do vídeo",
  video_duration: "Duração do arquivo",
  duration: "Duração aceita pelas redes",
  format_supported: "Formato aceito pelas redes",
  has_audio: "Som",
  loudness: "Volume",
};
const NETWORK_LABELS = { reels: "Reels", tiktok: "TikTok", shorts: "Shorts" };
const ORIGIN_LABELS = {
  pedido: "do pedido", resposta: "resposta do integrante", captura: "do site da marca", marca: "da marca", projeto: "do projeto", inferido: "deduzido do pedido", padrao: "padrão",
};
const BOM = String.fromCharCode(0xfeff);

const rel = (path) => displayPath(ROOT, path);
const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const foldText = (value) => clean(value).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const nowIso = () => new Date().toISOString();
const engineCall = (engine, args) => runEngine(engine, args, { root: ROOT });
const command = (text) => `${SCRIPT_COMMAND} ${text} --json`;
const fail = (code, message, fix, extra = null) => Object.assign(new AppError(code, message, fix), { extra });
const decimal = (value, digits = 1) => String(round(value, digits)).replace(".", ",");
/** A guide this app ships in references/, as a path from the project root (null when absent). */
const guidePath = (name) => (isFile(join(APP_DIR, "references", name)) ? toPosix(ROOT, join(APP_DIR, "references", name)) : null);

// ---------------------------------------------------------------------------
// The brief's own logic (lib/intake.mjs) and its questions
// ---------------------------------------------------------------------------

let intakeModule = null;

/** The module that makes every intake decision. A broken install says so instead of crashing. */
async function loadIntake() {
  if (intakeModule) return intakeModule;
  requireRuntime(APP_DIR, { parts: ["intake"] });
  let loaded;
  try {
    loaded = await import(pathToFileURL(join(SCRIPTS_DIR, "lib", "intake.mjs")).href);
  } catch (error) {
    throw new AppError("runtime_missing", `O app Estúdio de vídeo não conseguiu carregar a lógica do briefing: ${error?.message ?? error}`, `Reinstale o app: ${INSTALL_SELF}, depois repita.`);
  }
  const needed = ["loadBank", "loadTemplates", "newState", "assess", "planRound", "questionFor", "applyAnswers", "decideRound", "fillDefaults", "mergeKit", "linha", "echo", "nextStep", "slugFor"];
  const absent = needed.filter((name) => typeof loaded[name] !== "function");
  if (absent.length) throw new AppError("runtime_missing", `A lógica do briefing do app Estúdio de vídeo está incompleta (falta ${absent.join(", ")}).`, `Reinstale o app: ${INSTALL_SELF}, depois repita.`);
  intakeModule = loaded;
  return intakeModule;
}

/**
 * A question of the bank ready to ask outside the rounds (the brand to confirm, the yes to the
 * preview, the opening, the paid partnership, the points), rendered by the brief's own logic
 * (`questionFor`), which fills every name the text mentions; `vars` brings the ones only this
 * script knows. Plus the exact command that records the answer.
 */
function askQuestion(intake, bank, id, { slug, state = {}, kit = null, templates = null, vars = {}, warnings = [] } = {}) {
  const question = intake.questionFor(bank, id, { state, kit, templates, vars });
  if (!question) {
    warnings.push(`A pergunta ${id} não está no banco de perguntas deste app; reinstale o app (${INSTALL_SELF}) se ela fizer falta.`);
    return null;
  }
  // the yes to the brief and to the preview is recorded with approve, never with answer
  const approves = { aprovar_briefing: "brief", previa_ok: "preview" }[id];
  return approves ? { ...question, id, approve_command: command(`approve ${slug} ${approves}`) } : { ...question, id, answer_command: command(`answer ${slug} ${id} <value>`) };
}

// ---------------------------------------------------------------------------
// The state of a video
// ---------------------------------------------------------------------------

const fieldValue = (state, name) => state?.fields?.[name]?.value;
const fieldSource = (state, name) => state?.fields?.[name]?.source ?? null;
const fieldValues = (state) => Object.fromEntries(Object.entries(state?.fields ?? {}).map(([name, field]) => [name, field?.value ?? null]));
const kitOf = (state) => (state?.brand?.kit ? readKit(ROOT, state.brand.kit) : null);
const brandOf = (state) => {
  const value = fieldValue(state, "brand");
  return value && typeof value === "object" ? value : {};
};
const shownFields = (state) => Object.fromEntries(Object.entries(state?.fields ?? {}).map(([name, field]) => [name, { value: field?.value ?? null, source: field?.source ?? null, ...(field?.evidence ? { evidence: field.evidence } : {}) }]));

/** The member's own music: the file the brief names, or the first audio file in materiais/. */
function memberMusic(dir, file) {
  if (file) {
    const candidates = isAbsolute(file) ? [file] : [resolve(dir, file), resolve(dir, "materiais", file), resolve(ROOT, file)];
    return candidates.find((candidate) => isFile(candidate)) ?? null;
  }
  return scanMaterials(dir).audio[0] ?? null;
}

/** The brief with every default in, without touching the state: what the echo shows and what a draft is written from. */
function filledBrief(state, intake, templates, kit) {
  try {
    return intake.fillDefaults(structuredClone(state), templates, { kit }) ?? state;
  } catch {
    return state;
  }
}

/** What the brief decides once every default is in: what an approval of the brief approves. */
function briefId(state, intake, templates, kit) {
  return hashJson(fieldValues(filledBrief(state, intake, templates, kit)));
}

/** What a first draft of the roteiro is written from: the brief, the brand kit, the member's files and music. */
function draftInputs(ctx, filled, kit) {
  const materials = scanMaterials(ctx.dir);
  const files = [materials.logo, ...materials.screens, ...materials.images].filter(Boolean).map((file) => `${rel(file)}:${sha256File(file)}`);
  const musicField = fieldValue(filled, "music");
  const music = musicField?.mode === "file" ? memberMusic(ctx.dir, musicField.file) : null;
  const { confirmed, found_by, decisions, warnings, ...brand } = kit ?? {};
  return hashJson({ fields: fieldValues(filled), kit: kit ? brand : null, materials: files, music: music ? sha256File(music) : null, bpm: Number(filled?.signals?.bpm) || null });
}

/** What a preview or a final shows and sounds like: the page with its roteiro and images, plus the member's music. */
function videoId(paths, state, engine) {
  if (!isFile(paths.page) || !isFile(paths.roteiro)) return null;
  const roteiro = readJson(paths.roteiro, null);
  let music = null;
  if (roteiro?.music?.mode === "file") {
    const file = memberMusic(paths.dir, roteiro.music.file);
    music = file ? sha256File(file) : null;
  }
  return hashJson({ content: contentHash(paths.dir, { engineVersion: engine.version }), roteiro: fileHash(paths.roteiro), music });
}

/**
 * Looks at the disk and tells the brief's logic what exists (`state.files`), dropping an
 * approval that no longer matches what it approved: a brief that changed, a preview of an older
 * roteiro. Returns what was found, for the commands.
 */
function sync(ctx, intake, templates) {
  const { state, paths } = ctx;
  const engine = findVideoRender(ROOT);
  const kit = kitOf(state);
  const filled = filledBrief(state, intake, templates, kit);
  const roteiroHash = fileHash(paths.roteiro);
  // a roteiro is current when it is the one the page was built from and, if nobody adjusted it by
  // hand, when the brief it was drafted from has not changed
  const written = Boolean(roteiroHash && isFile(paths.page) && state.build?.roteiro_hash === roteiroHash);
  const built = written && (Boolean(state.build.edited) || state.build.inputs_hash === draftInputs(ctx, filled, kit));
  const id = written ? videoId(paths, state, engine) : null;
  if (!state.approvals || typeof state.approvals !== "object") state.approvals = { brief: null, preview: null };
  const brief = hashJson(fieldValues(filled));
  // the yes to the brief stays once given: later changes come from the member's own answers (or a new
  // visit to the site) and the preview shows them; the yes to a preview holds only for that preview
  const stale = { brief: Boolean(state.approvals.brief && state.approvals.brief_id && state.approvals.brief_id !== brief), preview: false };
  if (state.approvals.preview && state.approvals.preview_id !== id) {
    state.approvals.preview = null;
    stale.preview = true;
  }
  state.files = {
    kit: Boolean(kit) || Boolean(state.capture?.failed),
    roteiro: built,
    preview: Boolean(built && id && state.preview?.id === id && isFile(paths.preview)),
    final: Boolean(built && id && state.delivery?.id === id && isFile(paths.final)),
  };
  return { engine, kit, filled, written, built, id, brief, stale };
}

/**
 * Keeps the record of the rounds in step with what the brief's logic says is pending: the round
 * to ask now is recorded as open, and every other round is closed (answered, decided, or filled
 * by the defaults when the video was built without waiting).
 */
function recordRound(state, plan, now) {
  if (!Array.isArray(state.rounds)) state.rounds = [];
  if (!Array.isArray(state.asked)) state.asked = [];
  for (const entry of state.rounds) if (entry && !entry.answered && (!plan || entry.n !== plan.n)) entry.answered = true;
  if (!plan) return;
  const ids = (plan.questions ?? []).map((question) => question.id).filter(Boolean);
  const current = state.rounds.find((entry) => entry?.n === plan.n);
  if (!current) state.rounds.push({ n: plan.n, ids, at: now, answered: false });
  else {
    current.answered = false;
    current.ids = [...new Set([...(current.ids ?? []), ...ids])];
  }
  for (const id of ids) if (!state.asked.includes(id)) state.asked.push(id);
}

/** The question that confirms a captured brand, with the name the site gives itself. */
function confirmQuestion(ctx, intake, { bank, templates, kit, warnings = [] }) {
  return askQuestion(intake, bank, "conferir_marca", {
    slug: ctx.slug,
    state: ctx.state,
    kit,
    templates,
    vars: { nome: kit?.name ?? brandOf(ctx.state).name ?? "", site: kit?.host ?? hostOf(brandOf(ctx.state).site) ?? "" },
    warnings,
  });
}

/** The round to ask now (or null), the next step and the state on disk: what every command ends with. */
function conclude(ctx, intake, { bank, templates, now, step = null, note = "", save = true }) {
  const found = sync(ctx, intake, templates);
  const plan = intake.planRound(ctx.state, bank, { kit: found.kit, templates }) ?? null;
  recordRound(ctx.state, plan, now);
  let next = intake.nextStep(ctx.state, { scriptCommand: SCRIPT_COMMAND, bank, kit: found.kit }) ?? { action: "done", command: null, say: "" };
  // a captured site that calls itself by another name waits for the member's yes, like a brand found by search
  if (found.kit && ctx.state.brand?.kit && ctx.state.brand.confirmed === false && !["ask", "capture", "confirm_brand"].includes(next.action)) {
    const question = confirmQuestion(ctx, intake, { bank, templates, kit: found.kit });
    next = { action: "confirm_brand", command: null, say: question?.text ?? "Preciso confirmar se encontrei a marca certa.", answer_command: command(`answer ${ctx.slug} conferir_marca <valor>`) };
  }
  ctx.state.next_step = next;
  if (save) writeState(ctx.dir, ctx.state, { now, step, note });
  return { round: plan, next_step: next, found };
}

const brandState = (state) => ({
  name: brandOf(state).name ?? null,
  site: brandOf(state).site ?? null,
  handle: brandOf(state).handle ?? null,
  slug: state.brand?.slug ?? null,
  kit: state.brand?.kit ?? null,
  found_by: state.brand?.found_by ?? null,
  confirmed: Boolean(state.brand?.confirmed),
});

const minutesFor = (state) => {
  const seconds = Number(fieldValue(state, "duration")) || 15;
  return Math.min(15, Math.max(8, Math.round(5 + seconds / 3)));
};

/** Reads a text file the AI wrote: UTF-8 with or without a mark, and the two-byte encodings Windows tools write. */
function readText(file) {
  const bytes = readFileSync(file);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.subarray(2).toString("utf16le");
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return Buffer.from(bytes.subarray(2)).swap16().toString("utf16le");
  const text = bytes.toString("utf8");
  return text.startsWith(BOM) ? text.slice(1) : text;
}

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

async function checkCommand() {
  const engine = findVideoRender(ROOT);
  const warnings = [];
  let check = null;
  if (engine.installed) {
    try {
      check = await engineCall(engine, engineArgs.check());
    } catch (error) {
      warnings.push(`O Motor de vídeo não respondeu ao check: ${error.message}${error.fix ? ` ${error.fix}` : ""}`);
    }
  }
  const missing = missingRuntime(APP_DIR, { parts: ["intake", "studio"], templates: TEMPLATE_IDS });
  if (missing.length) warnings.push(`Faltam arquivos do app Estúdio de vídeo: ${missing.join(", ")}. Reinstale: ${INSTALL_SELF}.`);
  const install = { ...(check?.install ?? {}) };
  const render = Boolean(engine.installed && check?.modes?.render && !missing.length);
  const analysis = isFile(join(ROOT, ".flyee", "modules", "video-analysis", "scripts", "video.mjs"));
  let next;
  // another app: first what it declares, told to the member in one sentence, then the install with the member's yes
  if (!engine.installed) next = { action: "install", command: DRY_RUN_VIDEO_RENDER, say: "O render vem do app Motor de vídeo, que ainda não está neste projeto; vou ver o que ele declara e te conto antes de instalar.", after_yes: INSTALL_VIDEO_RENDER };
  else if (missing.length) next = { action: "install", command: INSTALL_SELF, say: "Faltam arquivos do Estúdio de vídeo; vou reinstalar o app." };
  else if (Object.keys(install).length) next = { action: "install", command: Object.values(install)[0], say: "Falta um programa que o vídeo usa; vou instalá-lo agora, pode levar alguns minutos." };
  else if (!render) next = { action: "check", command: command("check"), say: "O Motor de vídeo ainda não consegue renderizar nesta máquina; vou conferir de novo." };
  else next = { action: "intake", command: command("intake --request estudio-de-video/pedido.txt"), say: "Tudo pronto. Vou anotar o seu pedido e começar." };
  return {
    version: APP.version,
    project: ROOT,
    features: FEATURES,
    limits: {
      format: FORMAT.name,
      width: FORMAT.width,
      height: FORMAT.height,
      duration: LIMITS.duration,
      destinations: Object.keys(NETWORK_LABELS),
      roteiros: TEMPLATE_IDS,
      styles: STYLE_IDS,
      music_styles: MUSIC_STYLES,
    },
    video_render: { installed: engine.installed, path: engine.installed ? rel(engine.script) : null, version: engine.version, dry_run: DRY_RUN_VIDEO_RENDER, install: INSTALL_VIDEO_RENDER },
    engine: check ? { interface_version: check.interface_version ?? null, tools: check.tools ?? null, modes: check.modes ?? null, formats: check.formats ?? null, runtime: check.runtime ?? null, guides: check.guides ?? null } : null,
    modes: { render, capture: Boolean(engine.installed && check?.tools?.browser), sound: Boolean(engine.installed && check?.modes?.sheets) },
    install,
    install_note: check?.install_note ?? null,
    video_analysis: { installed: analysis, note: "Nesta versão um vídeo de referência não é assistido; o app de análise de vídeo entra numa versão futura." },
    runtime: { complete: missing.length === 0, missing },
    guides: {
      roteiros: guidePath("roteiros.md"),
      estilos: guidePath("estilos.md"),
      pagina: guidePath("pagina-do-video.md"),
      perguntas: guidePath("perguntas.json"),
      roteiros_json: guidePath("roteiros.json"),
      motor_pagina: check?.guides?.page ?? null,
      motor_interface: check?.guides?.interface ?? null,
    },
    warnings,
    next_step: next,
  };
}

// ---------------------------------------------------------------------------
// intake and answer
// ---------------------------------------------------------------------------

/** The saved kit of the brand a state names, when it is fresh enough to use without a new capture. */
function attachSavedKit(state, intake, now) {
  const brand = brandOf(state);
  if (!brand.site && !brand.name && !state.brand?.slug) return null;
  const kit = findKit(ROOT, { site: brand.site, name: brand.site ? null : brand.name, slug: brand.site ? null : state.brand?.slug });
  if (!kit || !kit.confirmed || kitAgeDays(kit, now) >= KIT_MAX_AGE_DAYS) return null;
  const merged = intake.mergeKit(state, kit) ?? state;
  merged.brand = {
    ...(merged.brand ?? {}),
    slug: kit.slug,
    kit: toPosix(ROOT, kitFile(ROOT, kit.slug)),
    found_by: merged.brand?.found_by ?? kit.found_by ?? null,
    confirmed: true,
  };
  return merged;
}

/** What `intake`, `answer` and `status` return about the brief. */
function briefResult(ctx, intake, concluded, { bank, templates }) {
  const { state } = ctx;
  const assessment = intake.assess(state) ?? {};
  return {
    slug: ctx.slug,
    dir: rel(ctx.dir),
    status: state.status ?? null,
    sufficiency: state.sufficiency ?? assessment.sufficiency ?? null,
    mode: state.mode ?? assessment.mode ?? null,
    fields: shownFields(state),
    missing: assessment.missing ?? [],
    unsupported: state.unsupported ?? [],
    brand: brandState(state),
    linha: intake.linha(state, { minutes: minutesFor(state), bank, templates, kit: concluded.found.kit }),
    round: concluded.round,
    next_step: concluded.next_step,
  };
}

async function intakeCommand(values) {
  if (!values.request) {
    throw usage("Informe o arquivo do pedido: intake --request <arquivo>.", "Grave o pedido do integrante, palavra por palavra, num arquivo de texto (por exemplo estudio-de-video/pedido.txt) e passe o caminho.");
  }
  const file = resolveInput(ROOT, values.request, { what: "o arquivo do pedido" });
  if (!isFile(file)) throw new AppError("file_not_found", `O pedido precisa ser um arquivo de texto: ${values.request}.`, "Grave o pedido do integrante num arquivo de texto e passe o caminho dele.");
  const request = readText(file).replace(/\r\n?/g, "\n").trim();
  if (!request) {
    throw new AppError("request_empty", `O arquivo do pedido está vazio: ${rel(file)}.`, "Grave nele o que o integrante escreveu, palavra por palavra, e repita.");
  }
  const intake = await loadIntake();
  const bank = intake.loadBank(APP_DIR);
  const templates = intake.loadTemplates(APP_DIR);
  const now = nowIso();
  const explicit = values.slug ? slugOf(values.slug) : null;
  const project = { site: findProjectSite(ROOT), kits: listKits(ROOT).filter((kit) => kit.confirmed).map(({ slug, name, site }) => ({ slug, name, site })) };
  let state = intake.newState({ request, slug: explicit, appVersion: APP.version, now, project });
  const warnings = [];
  let slug = explicit;
  if (explicit) {
    if (isVideo(videoDir(ROOT, explicit)) && !values.force) {
      throw new AppError("exists", `Já existe o vídeo "${explicit}" em ${rel(videoDir(ROOT, explicit))}.`, `Use outro nome em --slug, continue esse vídeo (${command(`status ${explicit}`)}) ou, com o sim do integrante, recomece por cima com --force.`);
    }
  } else slug = freeSlug(ROOT, slugOf(intake.slugFor(state) || "video"));
  state.format_version ??= 1;
  state.app = { name: APP.name, version: APP.version };
  state.slug = slug;
  state.created_at ??= now;
  state.request ??= request;
  state.route ??= "motion";
  state.approvals ??= { brief: null, preview: null };
  state.status = "intake";
  state = attachSavedKit(state, intake, now) ?? state;
  const dir = videoDir(ROOT, slug);
  createVideo(dir, { force: Boolean(values.force) });
  const ctx = { slug, dir, paths: layout(dir, slug), state };
  const concluded = conclude(ctx, intake, { bank, templates, now, step: "intake", note: `pedido de ${rel(file)}` });
  if (state.brand?.kit) warnings.push(`A marca já estava guardada (${state.brand.kit}): nada sobre ela é perguntado de novo.`);
  return { ...briefResult(ctx, intake, concluded, { bank, templates }), request_file: rel(file), project, warnings };
}

async function answerCommand(positionals, values) {
  const ctx = requireVideo(ROOT, positionals[0], { scriptCommand: SCRIPT_COMMAND });
  const intake = await loadIntake();
  const bank = intake.loadBank(APP_DIR);
  const templates = intake.loadTemplates(APP_DIR);
  const now = nowIso();
  const before = { site: hostOf(brandOf(ctx.state).site), kit: kitOf(ctx.state), confirmed: Boolean(ctx.state.brand?.confirmed) };
  const answers = {};
  if (values.file) {
    const data = requireJson(resolveInput(ROOT, values.file, { what: "o arquivo de respostas" }), "o arquivo de respostas");
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new AppError("invalid_json", "O arquivo de respostas precisa ser um objeto { \"id\": \"valor\" }.", "Use o id de cada pergunta como chave e o value da opção (ou o texto livre) como valor.");
    for (const [id, value] of Object.entries(data)) answers[id] = Array.isArray(value) ? value.join(",") : String(value ?? "");
  }
  // "--decide all" (the member said "o resto decide você"): every later round is decided too
  const decideAll = Boolean(values["decide-all"]);
  if (decideAll) values.decide = true;
  if (positionals.length >= 3) answers[positionals[1]] = positionals.slice(2).join(" ");
  else if (positionals.length === 2 && !values.decide && !values.file) {
    throw usage(`Falta o valor da resposta: answer ${ctx.slug} ${positionals[1]} <valor>.`, "O valor é o value da opção escolhida ou o texto livre do integrante.");
  } else if (positionals.length === 2) throw usage("Com --file ou --decide, informe só o vídeo, ou o id seguido do valor.");
  if (!Object.keys(answers).length && !values.decide) {
    throw usage(`Informe a resposta: answer ${ctx.slug} <id> <valor>, answer ${ctx.slug} --file <respostas.json> ou answer ${ctx.slug} --decide.`);
  }
  let state = ctx.state;
  const kit = before.kit;
  const asked = intake.planRound(state, bank, { kit, templates });
  if (Object.keys(answers).length) {
    const applied = intake.applyAnswers(state, answers, bank, { kit, now, templates }) ?? {};
    const errors = Array.isArray(applied.errors) ? applied.errors : [];
    if (errors.length) {
      const pending = asked;
      const valid = (pending?.questions ?? []).map((question) => `${question.id}${Array.isArray(question.options) && question.options.length ? ` (${question.options.map((option) => option.value).join(", ")}${question.free_text ? ", ou texto livre" : ""})` : " (texto livre)"}`);
      const first = errors[0];
      throw fail(
        ["question_unknown", "answer_invalid"].includes(first.code) ? first.code : "answer_invalid",
        errors.map((error) => error.message ?? `${error.id}: resposta inválida.`).join(" "),
        valid.length ? `Nada foi gravado. Perguntas desta rodada e os valores aceitos: ${valid.join("; ")}.` : "Nada foi gravado. Use o id de uma pergunta do banco e um dos seus valores.",
        { errors },
      );
    }
    state = applied.state ?? state;
  }
  // "decida por mim" closes the round that was being asked, never the next one; "--decide all" closes them all
  if (decideAll) state = intake.decideRound(state, bank, { kit, now, templates, all: true }) ?? state;
  else if (values.decide) {
    const pending = intake.planRound(state, bank, { kit, templates });
    if (pending && (!asked || pending.n === asked.n)) state = intake.decideRound(state, bank, { kit, now, templates }) ?? state;
  }
  ctx.state = state;
  const warnings = [];
  // the brand changed: its kit goes with it (the kit stays in marcas/, for whoever uses it)
  const after = hostOf(brandOf(state).site);
  if (before.kit && before.site !== after && (after || !brandOf(state).name)) {
    state.brand = { ...(state.brand ?? {}), slug: null, kit: null };
    delete state.capture;
    warnings.push("A marca mudou: o que tinha sido capturado da anterior saiu deste vídeo.");
  } else if (!before.kit && before.site !== after) delete state.capture;
  if (!state.brand?.kit) {
    const attached = attachSavedKit(state, intake, now);
    if (attached) {
      ctx.state = attached;
      state = attached;
      warnings.push(`A marca já estava guardada (${state.brand.kit}): nada sobre ela é perguntado de novo.`);
    }
  }
  // a brand found by search that the member has just confirmed: the kit remembers it
  const current = kitOf(state);
  if (current && state.brand?.confirmed && !current.confirmed) writeKit(ROOT, { ...current, confirmed: true });
  if (!["build", "preview", "final", "delivered"].includes(state.status)) state.status = state.status ?? "intake";
  // an answer after the yes to the brief is the member's own change: briefing.md follows it and the yes stays
  if (state.approvals?.brief && state.approvals.brief_id) {
    const kitNow = kitOf(state);
    const filledNow = filledBrief(state, intake, templates, kitNow);
    const idNow = hashJson(fieldValues(filledNow));
    if (idNow !== state.approvals.brief_id) {
      const echoed = intake.echo(filledNow, templates, { minutes: minutesFor(filledNow), bank }) ?? {};
      writeBriefing(ctx.dir, echoed.markdown ?? echoed.text ?? "");
      state.briefing = { at: now, id: idNow };
      state.approvals.brief_id = idNow;
      warnings.push(`O briefing foi atualizado com esta resposta (${rel(ctx.paths.brief)}); o sim ao briefing continua valendo, e a próxima prévia mostra a mudança.`);
    }
  }
  const decidedWhat = decideAll ? "padrões de todas as rodadas" : "padrões da rodada";
  const noted = values.decide && !Object.keys(answers).length ? decidedWhat : Object.keys(answers).join(", ") + (values.decide ? ` e ${decidedWhat}` : "");
  const concluded = conclude(ctx, intake, { bank, templates, now, step: "answer", note: noted });
  if (state.build?.edited && state.build.inputs_hash !== draftInputs(ctx, concluded.found.filled, concluded.found.kit)) {
    warnings.push(`O roteiro.json deste vídeo foi ajustado à mão: esta resposta não muda o vídeo sozinha. Mude o roteiro, ou reescreva-o a partir do briefing com ${command(`build ${ctx.slug} --force`)}.`);
  }
  return { ...briefResult(ctx, intake, concluded, { bank, templates }), answered: Object.keys(answers), decided: decideAll ? "all" : Boolean(values.decide), warnings };
}

// ---------------------------------------------------------------------------
// capture
// ---------------------------------------------------------------------------

async function captureCommand(positionals, values) {
  const ctx = requireVideo(ROOT, positionals[0], { scriptCommand: SCRIPT_COMMAND });
  const intake = await loadIntake();
  const bank = intake.loadBank(APP_DIR);
  const templates = intake.loadTemplates(APP_DIR);
  const now = nowIso();
  let state = ctx.state;
  const brand = brandOf(state);
  const given = values.url ? clean(values.url) : null;
  const address = given ?? brand.site ?? null;
  if (!address) {
    const who = brand.name ? ` (${brand.name})` : brand.handle ? ` (${brand.handle})` : "";
    throw new AppError(
      "brand_unknown",
      `Não sei o site da marca deste vídeo${who}.`,
      `Pergunte o endereço ao integrante (ou procure o site oficial e confirme com ele) e registre: ${command(`answer ${ctx.slug} marca <endereço>`)}. Para capturar um endereço achado por busca, ainda sem o sim dele: ${command(`capture ${ctx.slug} --url <endereço>`)}.`,
    );
  }
  const warnings = [];
  const searched = Boolean(given) && hostOf(given) !== hostOf(brand.site);
  const sourceOfBrand = { pedido: "pedido", projeto: "projeto", resposta: "resposta" }[fieldSource(state, "brand")] ?? null;
  const foundBy = searched ? "busca" : (state.brand?.found_by ?? sourceOfBrand ?? "pedido");
  const host = hostOf(address);
  const local = !host;
  const slug = state.brand?.slug ?? brandSlug({ name: brand.name, host }) ?? "marca";
  const saved = findKit(ROOT, { site: local ? null : address, slug: local ? slug : null });
  let kit = null;
  let reused = false;
  let captureDir = null;
  let provisional = null;
  if (saved && !values.refresh && kitAgeDays(saved, now) < KIT_MAX_AGE_DAYS) {
    kit = saved;
    reused = true;
    captureDir = saved.capture_dir ?? null;
    progress(`Marca já guardada há ${decimal(kitAgeDays(saved, now), 0)} dia(s): ${toPosix(ROOT, kitFile(ROOT, saved.slug))}`);
  } else {
    const engine = requireVideoRender(ROOT);
    const out = join(ROOT, "capturas", local ? slug : hostSlug(address));
    progress(`Visitando ${address}`);
    let result;
    try {
      result = await engineCall(engine, engineArgs.capture({ url: address, out: rel(out) }));
    } catch (error) {
      if (!(error instanceof AppError) || !CAPTURE_ERRORS.includes(error.code)) throw error;
      // the site did not let the capture in: the video goes on with a neutral look, and says so
      state.capture = { at: now, url: address, failed: true, code: error.code, message: error.message };
      state.status = "capture";
      const lost = "Sem a captura, o vídeo usa um visual neutro: sem o logo, as cores, as telas e os números do site.";
      const ask = `Peça ao integrante o logo e duas ou três imagens na pasta ${rel(ctx.paths.materiais)} (${command(`open ${ctx.slug} materiais`)} abre a pasta).`;
      const retry = {
        invalid_url: ` Se o endereço estiver errado, registre o certo: ${command(`answer ${ctx.slug} marca <endereço>`)}.`,
        site_placeholder: ` Se a marca tiver o site em outro endereço, registre-o: ${command(`answer ${ctx.slug} marca <endereço>`)}.`,
      }[error.code] ?? ` Para tentar de novo depois: ${command(`capture ${ctx.slug} --refresh`)}.`;
      const concluded = conclude(ctx, intake, { bank, templates, now, step: "capture", note: `falhou: ${error.code}` });
      throw fail(error.code, error.message, `${error.fix ? `${error.fix} ` : ""}${lost} ${ask}${retry}`, {
        slug: ctx.slug,
        captured: false,
        brand: brandState(state),
        round: concluded.round,
        next_step: concluded.next_step,
        warnings: [`O site ${address} não foi capturado (${error.code}). ${lost}`],
      });
    }
    captureDir = result.dir ? (isAbsolute(result.dir) ? result.dir : resolve(ROOT, result.dir)) : out;
    const capturaFile = result.capture_file ? (isAbsolute(result.capture_file) ? result.capture_file : resolve(ROOT, result.capture_file)) : join(captureDir, "captura.json");
    const captura = readJson(capturaFile, null);
    if (!captura || typeof captura !== "object") {
      throw new AppError("video_render_failed", `O Motor de vídeo não gravou a captura em ${rel(capturaFile)}.`, `Rode de novo: ${command(`capture ${ctx.slug} --refresh`)}; se repetir, mostre esta mensagem ao integrante.`);
    }
    // a "coming soon" page may carry the brand's logo or only the builder's: the member says which
    provisional = captura.placeholder ?? null;
    for (const warning of result.warnings ?? []) if (!provisional || !/provisória/.test(warning)) warnings.push(`Captura: ${warning}`);
    kit = kitFromCapture(captura, { foundBy, now, root: ROOT, captureDir, slug: saved?.slug ?? slug, name: brand.name, site: local ? null : address });
    if (saved?.decisions && Object.keys(saved.decisions).length) kit.decisions = saved.decisions;
  }
  // a name found by search, or a page that calls itself something else, waits for the member's yes
  const namedAs = clean(brand.name);
  const weak = !searched && !reused && (!sameBrandName(namedAs, kit.name) || Boolean(provisional));
  const confirmed = reused ? Boolean(kit.confirmed) : !searched && !weak && ["pedido", "projeto", "resposta"].includes(foundBy);
  if (!reused) {
    kit.found_by = foundBy;
    kit.confirmed = confirmed;
    writeKit(ROOT, kit);
  }
  state = intake.mergeKit(state, kit) ?? state;
  state.brand = { ...(state.brand ?? {}), slug: kit.slug, kit: toPosix(ROOT, kitFile(ROOT, kit.slug)), found_by: reused ? (state.brand?.found_by ?? kit.found_by ?? foundBy) : foundBy, confirmed };
  state.capture = { at: now, url: address, dir: captureDir ? rel(captureDir) : null, failed: false, reused };
  state.status = "capture";
  ctx.state = state;
  for (const warning of kit.warnings ?? []) warnings.push(warning);
  let confirm = null;
  if (!confirmed) {
    confirm = confirmQuestion(ctx, intake, { bank, templates, kit, warnings });
    if (provisional) warnings.push(`A página de ${kit.host ?? address} parece provisória (${provisional.evidence}): confirme com o integrante que o logo e as cores são da marca antes de seguir.`);
    else warnings.push(weak ? `O site se apresenta como "${kit.name}", e o pedido diz "${namedAs}": confirme a marca com o integrante antes de seguir.` : "A marca foi encontrada por busca: confirme com o integrante antes de seguir.");
  }
  const concluded = conclude(ctx, intake, { bank, templates, now, step: "capture", note: reused ? `marca guardada: ${kit.slug}` : `capturado: ${kit.host ?? address}` });
  return {
    slug: ctx.slug,
    captured: true,
    reused,
    brand: kitSummary(kit),
    kit: state.brand.kit,
    capture_dir: captureDir ? rel(captureDir) : null,
    confirm,
    round: concluded.round,
    next_step: concluded.next_step,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// brief and approve
// ---------------------------------------------------------------------------

async function briefCommand(positionals) {
  const ctx = requireVideo(ROOT, positionals[0], { scriptCommand: SCRIPT_COMMAND });
  const intake = await loadIntake();
  const bank = intake.loadBank(APP_DIR);
  const templates = intake.loadTemplates(APP_DIR);
  const now = nowIso();
  const kit = kitOf(ctx.state);
  // the echo shows the whole plan, with every default; the defaults are only written into the state by build
  const filled = filledBrief(ctx.state, intake, templates, kit);
  const echo = intake.echo(filled, templates, { minutes: minutesFor(filled), bank }) ?? {};
  const text = echo.text ?? (Array.isArray(echo.lines) ? echo.lines.join("\n") : "");
  const briefing = writeBriefing(ctx.dir, echo.markdown ?? text);
  ctx.state.briefing = { at: now, id: hashJson(fieldValues(filled)) };
  if (!["build", "preview", "final", "delivered"].includes(ctx.state.status)) ctx.state.status = "brief";
  const concluded = conclude(ctx, intake, { bank, templates, now, step: "brief", note: "briefing mostrado" });
  const warnings = [];
  if (concluded.round) warnings.push("Ainda há perguntas sem resposta: o briefing mostra os padrões no lugar delas.");
  const question = echo.question ? { ...echo.question, approve_command: command(`approve ${ctx.slug} brief`) } : null;
  return { slug: ctx.slug, echo: text, lines: echo.lines ?? text.split("\n"), briefing: rel(briefing), question, mode: ctx.state.mode ?? null, next_step: concluded.next_step, warnings };
}

async function approveCommand(positionals, values) {
  const what = positionals[1];
  if (!["brief", "preview"].includes(what)) throw usage(`Informe o que foi aprovado: approve ${positionals[0] ?? "<vídeo>"} brief ou approve ${positionals[0] ?? "<vídeo>"} preview.`);
  const ctx = requireVideo(ROOT, positionals[0], { scriptCommand: SCRIPT_COMMAND });
  const intake = await loadIntake();
  const bank = intake.loadBank(APP_DIR);
  const templates = intake.loadTemplates(APP_DIR);
  const now = nowIso();
  const found = sync(ctx, intake, templates);
  const note = values.note ? clean(values.note).slice(0, 300) : null;
  if (what === "brief") {
    if (!isFile(ctx.paths.brief) || !ctx.state.briefing) {
      throw fail("file_not_found", `Ainda não existe o briefing do vídeo "${ctx.slug}" para aprovar.`, `Rode ${command(`brief ${ctx.slug}`)}, mostre o resultado ao integrante e só então registre o sim.`, { next_step: ctx.state.next_step ?? null });
    }
    if (ctx.state.briefing.id !== found.brief) {
      throw fail("brief_not_approved", "O briefing mudou depois que foi mostrado: o sim do integrante foi para a versão anterior.", `Rode ${command(`brief ${ctx.slug}`)}, mostre o briefing de novo e registre o sim.`, { next_step: { action: "echo", command: command(`brief ${ctx.slug}`), say: "Mudei o briefing; vou mostrar como ficou." } });
    }
    ctx.state.approvals.brief = now;
    ctx.state.approvals.brief_id = found.brief;
    ctx.state.approvals.brief_note = note;
  } else {
    if (!found.written || !isFile(ctx.paths.preview) || !ctx.state.preview) {
      throw fail("file_not_found", `Ainda não existe a prévia do vídeo "${ctx.slug}" para aprovar.`, `Rode ${command(`preview ${ctx.slug}`)}, olhe a folha de quadros, mostre a prévia ao integrante e só então registre o sim.`, { next_step: ctx.state.next_step ?? null });
    }
    if (ctx.state.preview.id !== found.id || !found.built) {
      throw fail("preview_not_approved", "O vídeo mudou depois da última prévia: o sim do integrante precisa ser para a prévia atual.", `Rode ${command(`preview ${ctx.slug}`)}, mostre a prévia nova e registre o sim.`, { next_step: { action: "preview", command: command(`preview ${ctx.slug}`), say: "O vídeo mudou; vou refazer a prévia." } });
    }
    ctx.state.approvals.preview = now;
    ctx.state.approvals.preview_id = found.id;
    ctx.state.approvals.preview_note = note;
  }
  const concluded = conclude(ctx, intake, { bank, templates, now, step: `approve_${what}`, note: note ?? "" });
  return { slug: ctx.slug, approved: what, approvals: { brief: ctx.state.approvals.brief ?? null, preview: ctx.state.approvals.preview ?? null }, note, next_step: concluded.next_step, warnings: [] };
}

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------

/** The tempo of the member's own music, measured once by the Motor: the cuts follow it. */
async function measureMusic(ctx, engine, file, warnings) {
  const { state, paths } = ctx;
  const sha = sha256File(file);
  const previous = state.audio?.member;
  if (previous?.sha === sha && isFile(paths.musicBeats)) return previous;
  progress(`Trilha do integrante: medindo as batidas de ${rel(file)}`);
  const result = await engineCall(engine, engineArgs.beats({ input: rel(file), out: rel(paths.musicBeats) }));
  const grid = readJson(paths.musicBeats, null) ?? result;
  const measured = Number(grid.bpm ?? result.bpm) || null;
  // the page's grid stays between 80 and 160 BPM: half or double time of a slow or a fast song still lands on its beats
  let bpm = measured;
  while (bpm && bpm < 80) bpm *= 2;
  while (bpm && bpm > 160) bpm /= 2;
  const member = {
    file: rel(file),
    sha,
    bpm_measured: measured,
    bpm: bpm ? round(bpm, 2) : null,
    confidence: grid.confidence ?? result.confidence ?? null,
    start: round(Number(grid.downbeats?.[0] ?? grid.offset ?? 0) || 0, 4),
    duration: Number(grid.duration ?? result.duration) || null,
    beats_file: rel(paths.musicBeats),
  };
  if (member.confidence !== null && member.confidence < 0.5) warnings.push(`A batida da música ${member.file} não é clara (confiança ${member.confidence}): os cortes podem não cair no tempo dela. Confira na prévia ou escolha outra música.`);
  state.audio = { ...(state.audio ?? {}), member };
  return member;
}

/**
 * Writes (or keeps) roteiro.json, copies the brand files, writes the page and the effects list.
 * Used by `build` and, when the roteiro changed since the last build, by `preview`.
 */
async function buildVideo(ctx, intake, { bank, templates, now, force = false }) {
  const { paths, dir, slug } = ctx;
  let state = ctx.state;
  const engine = requireVideoRender(ROOT);
  requireRuntime(APP_DIR, { parts: ["studio"] });
  const warnings = [];
  const kit = kitOf(state);
  state = intake.fillDefaults(state, templates, { kit }) ?? state;
  ctx.state = state;
  if (state.capture?.failed) warnings.push(`O site ${state.capture.url} não foi capturado (${state.capture.code}): o vídeo usa um visual neutro. Logo e imagens podem ir na pasta ${rel(paths.materiais)}.`);
  ensureDir(paths.assets);
  ensureDir(paths.audio);
  const materials = scanMaterials(dir);
  const plan = assetTargets({ kit, materials });
  const copied = copyAssets({ root: ROOT, dir, plan });
  for (const item of copied.missing) warnings.push(`O arquivo ${item.source} (${item.key}) não existe mais: a cena é desenhada sem ele. Rode ${command(`capture ${slug} --refresh`)} para capturar de novo.`);
  const available = plan.filter((item) => copied.copied.some((done) => done.key === item.key));
  if (materials.logo) warnings.push(`O logo de ${rel(materials.logo)} substitui o que veio do site.`);

  // the music the member brought decides the tempo
  const musicField = fieldValue(state, "music");
  let member = null;
  if (musicField?.mode === "file") {
    const file = memberMusic(dir, musicField.file);
    if (!file) {
      throw new AppError(
        "file_not_found",
        musicField.file ? `Não encontrei a música do integrante: ${musicField.file}.` : `O briefing pede a música do integrante e não há nenhuma em ${rel(paths.materiais)}.`,
        `Peça ao integrante para colocar o arquivo (MP3, WAV ou M4A) em ${rel(paths.materiais)} e repita; ou troque a trilha respondendo de novo a pergunta do som: ${command(`answer ${slug} som <value>`)}.`,
      );
    }
    member = await measureMusic(ctx, engine, file, warnings);
  }

  const inputs = draftInputs(ctx, state, kit);
  const existing = isFile(paths.roteiro);
  const untouched = existing && Boolean(state.build) && state.build.roteiro_hash === fileHash(paths.roteiro) && !state.build.edited;
  const notes = [];
  let origins = state.build?.origins ?? [];
  let roteiro;
  let kept = false;
  if (!existing || force || untouched) {
    if (existing && !untouched) {
      copyFileSync(paths.roteiro, paths.previous);
      warnings.push(`O roteiro foi reescrito a partir do briefing; o que estava ajustado à mão ficou guardado em ${rel(paths.previous)}.`);
    }
    origins = [];
    const requestedBpm = Number(state.signals?.bpm ?? musicField?.bpm) || null;
    let draft;
    try {
      draft = draftRoteiro(state, kit, templates, {
        warnings,
        origins,
        assets: available,
        solveTiming: typeof intake.solveTiming === "function" ? intake.solveTiming : localSolveTiming,
        bpm: member?.bpm && (member.confidence === null || member.confidence >= 0.5) ? member.bpm : null,
        preferBpm: requestedBpm,
      });
    } catch (error) {
      // the brief cannot fill the story: the member is asked the one question that is missing
      if (error instanceof AppError && error.ask) {
        const question = askQuestion(intake, bank, error.ask, { slug, state, kit, templates });
        error.extra = {
          question,
          next_step: { action: "ask", command: null, say: question?.text ?? "Preciso saber o que o vídeo deve mostrar.", answer_command: command(`answer ${slug} ${error.ask} <valor>`) },
        };
      }
      throw error;
    }
    if (member && draft.music.mode === "file") draft.music.file = member.file;
    roteiro = validateRoteiro(draft, templates, { notes });
  } else {
    kept = true;
    roteiro = validateRoteiro(requireJson(paths.roteiro, "o roteiro.json"), templates, { notes });
    if (state.build?.inputs_hash && state.build.inputs_hash !== inputs) {
      warnings.push(`O briefing ou a marca mudaram desde que o roteiro foi escrito, e o roteiro.json ajustado à mão foi mantido. Para reescrevê-lo a partir do briefing: ${command(`build ${slug} --force`)} (o atual fica guardado em roteiro.anterior.json).`);
    }
  }
  for (const note of notes) warnings.push(`roteiro.json: ${note}`);
  const adopted = adoptAssets({ root: ROOT, dir, roteiro });
  roteiro = adopted.roteiro;
  const serialized = `${JSON.stringify(roteiro, null, 2)}\n`;
  if (!existing || readFileSync(paths.roteiro, "utf8") !== serialized) writeJson(paths.roteiro, roteiro);

  // the page is always written from the model and the roteiro: a change made by hand lasts until the next build
  const handMade = isFile(paths.page) && Boolean(state.build?.page_hash) && state.build.page_hash !== fileHash(paths.page);
  buildPage({ dir, appDir: APP_DIR, engine, roteiro });
  if (handMade) warnings.push(`A página tinha mudanças feitas à mão depois do último build e foi reescrita a partir do roteiro. Se elas devem continuar, cole o trecho de novo no fim do script da página (${guidePath("pagina-do-video.md") ?? "guia da página do vídeo"}, seção 6) e refaça a prévia.`);
  writeJson(paths.events, eventsFile(roteiro));
  writeJson(paths.grid, beatGrid(roteiro));

  state.build = {
    at: now,
    template: roteiro.template,
    roteiro_hash: fileHash(paths.roteiro),
    page_hash: fileHash(paths.page),
    inputs_hash: kept ? (state.build?.inputs_hash ?? inputs) : inputs,
    edited: kept,
    origins,
    engine: engine.version,
  };
  state.status = "build";
  return {
    roteiro,
    engine,
    warnings,
    result: {
      slug,
      roteiro: rel(paths.roteiro),
      page: rel(paths.page),
      template: roteiro.template,
      style: roteiro.style,
      title: roteiro.title,
      scenes: sceneSummary(roteiro),
      duration: roteiro.duration,
      bpm: roteiro.bpm,
      bars: roteiro.bars,
      music: roteiro.music,
      palette: roteiro.palette,
      events: rel(paths.events),
      assets: [...copied.copied.map((item) => ({ file: `${rel(dir)}/${item.target}`, from: item.source })), ...adopted.adopted.map((item) => ({ file: `${rel(dir)}/${item.target}`, from: item.source }))],
      kept: { roteiro: kept },
    },
  };
}

function requireBriefApproval(ctx, found) {
  if (ctx.state.mode !== "guided" || ctx.state.approvals?.brief) return;
  const shown = Boolean(ctx.state.briefing) && ctx.state.briefing.id === found.brief && isFile(ctx.paths.brief);
  throw fail(
    "brief_not_approved",
    "Falta o sim do integrante ao briefing antes de construir o vídeo.",
    shown ? `Mostre o briefing (${rel(ctx.paths.brief)}) e, com o sim dele, rode ${command(`approve ${ctx.slug} brief`)}.` : `Rode ${command(`brief ${ctx.slug}`)}, mostre o resultado e, com o sim dele, rode ${command(`approve ${ctx.slug} brief`)}.`,
    { next_step: shown ? { action: "approve_brief", command: null, say: "Posso construir o vídeo assim?" } : { action: "echo", command: command(`brief ${ctx.slug}`), say: "Vou mostrar o briefing completo antes de construir." } },
  );
}

async function buildCommand(positionals, values) {
  const ctx = requireVideo(ROOT, positionals[0], { scriptCommand: SCRIPT_COMMAND });
  const intake = await loadIntake();
  const bank = intake.loadBank(APP_DIR);
  const templates = intake.loadTemplates(APP_DIR);
  const now = nowIso();
  const found = sync(ctx, intake, templates);
  requireBriefApproval(ctx, found);
  const pending = intake.planRound(ctx.state, bank, { kit: found.kit, templates });
  const built = await buildVideo(ctx, intake, { bank, templates, now, force: Boolean(values.force) });
  if (pending?.questions?.length) built.warnings.push(`Havia perguntas sem resposta (${pending.questions.map((question) => question.id).join(", ")}): usei os padrões.`);
  // defaults written by build must not undo the approval of the same brief
  if (ctx.state.approvals?.brief) ctx.state.approvals.brief_id = briefId(ctx.state, intake, templates, kitOf(ctx.state));
  const concluded = conclude(ctx, intake, { bank, templates, now, step: "build", note: `${built.roteiro.template}, ${built.roteiro.bars} compassos a ${built.roteiro.bpm} BPM` });
  return { ...built.result, next_step: concluded.next_step, warnings: built.warnings };
}

// ---------------------------------------------------------------------------
// The sound, shared by preview and final
// ---------------------------------------------------------------------------

async function ensureMusic(ctx, engine, roteiro, { refresh, warnings }) {
  const { state, paths, dir } = ctx;
  const music = roteiro.music;
  const times = timeline(roteiro);
  const previous = state.audio?.music ?? null;
  if (music.mode === "none") {
    state.audio = { ...(state.audio ?? {}), music: { mode: "none", file: null, hash: "none" } };
    return { mode: "none", file: null, offset: 0, hash: "none", reused: true };
  }
  if (music.mode === "file") {
    const file = memberMusic(dir, music.file);
    if (!file) {
      throw new AppError("file_not_found", `Não encontrei a música do roteiro (music.file): ${music.file ?? "nenhum arquivo de áudio em materiais/"}.`, `Coloque o arquivo em ${rel(paths.materiais)}, ou troque music.mode no roteiro.json para "music" (a trilha original) e rode ${command(`build ${ctx.slug}`)}.`);
    }
    const member = await measureMusic(ctx, engine, file, warnings);
    if (member.bpm && Math.abs(member.bpm - roteiro.bpm) / roteiro.bpm > 0.01) {
      warnings.push(`A música tem ${decimal(member.bpm, 1)} BPM e o roteiro está em ${decimal(roteiro.bpm, 1)}: os cortes vão sair da batida. Mude bpm no roteiro.json para ${member.bpm} (ou rode ${command(`build ${ctx.slug} --force`)}) e refaça a prévia.`);
    }
    if (member.duration && member.duration < member.start + times.duration - 0.05) {
      warnings.push(`A música tem ${decimal(member.duration)} s e o vídeo ${decimal(times.duration)} s a partir de ${decimal(member.start, 2)} s dela: o fim do vídeo fica sem trilha.`);
    }
    const hash = hashJson({ mode: "file", sha: member.sha, start: member.start });
    state.audio = { ...(state.audio ?? {}), music: { mode: "file", file: member.file, beats_file: member.beats_file, offset: member.start, bpm: member.bpm, hash } };
    return { mode: "file", file: member.file, offset: member.start, hash, reused: previous?.hash === hash, source: "file" };
  }
  const synth = music.mode === "synth";
  const style = synth ? (SYNTH_STYLES.includes(music.style) && !MUSIC_STYLES.includes(music.style) ? music.style : (SYNTH_FOR[music.style] ?? "clean")) : music.style;
  const bars = Math.max(1, Math.ceil(times.bars - 1e-6));
  const hash = hashJson({ mode: music.mode, style, seed: music.seed, bpm: roteiro.bpm, duration: times.duration, bars: synth ? bars : null, loop: Boolean(roteiro.loop), engine: engine.version });
  const fresh = !refresh && previous?.hash === hash && isFile(paths.music);
  let result = null;
  if (!fresh) {
    if (synth) {
      progress(`Trilha: ${bars} compassos em loop a ${roteiro.bpm} BPM (${style}, semente ${music.seed})`);
      result = await engineCall(engine, engineArgs.synth({ out: rel(paths.music), bpm: roteiro.bpm, bars, style, seed: music.seed }));
      if (bars !== times.bars) warnings.push(`A trilha em loop tem ${bars} compassos inteiros e o vídeo ${decimal(times.bars, 2)}: ela é cortada no fim do vídeo.`);
    } else {
      progress(`Trilha: compondo ${decimal(times.duration)} s a ${roteiro.bpm} BPM (${style}, semente ${music.seed})`);
      result = await engineCall(engine, engineArgs.music({ out: rel(paths.music), duration: times.duration, bpm: roteiro.bpm, style, seed: music.seed, arc: "auto", loop: Boolean(roteiro.loop) }));
    }
    for (const warning of result.warnings ?? []) warnings.push(`Trilha: ${warning}`);
    if (!isFile(paths.music)) throw new AppError("video_render_failed", `O Motor de vídeo não gravou a trilha em ${rel(paths.music)}.`, "Rode de novo com --refresh; se repetir, mostre esta mensagem ao integrante.");
  }
  const entry = {
    mode: music.mode,
    file: rel(paths.music),
    beats_file: isFile(paths.musicBeats) ? rel(paths.musicBeats) : null,
    offset: 0,
    bpm: roteiro.bpm,
    style,
    seed: music.seed,
    key: result?.key ?? previous?.key ?? null,
    hash,
  };
  state.audio = { ...(state.audio ?? {}), music: entry };
  return { ...entry, reused: fresh, source: music.mode };
}

async function ensureEffects(ctx, engine, roteiro, { refresh, warnings }) {
  const { state, paths } = ctx;
  const events = eventsFile(roteiro);
  writeJson(paths.events, events);
  writeJson(paths.grid, beatGrid(roteiro));
  if (!events.events.length) {
    state.audio = { ...(state.audio ?? {}), sfx: { file: null, events: 0, hash: "none" } };
    return { file: null, events: 0, hash: "none", reused: true };
  }
  const hash = hashJson({ events, engine: engine.version });
  const previous = state.audio?.sfx ?? null;
  const fresh = !refresh && previous?.hash === hash && isFile(paths.sfx);
  if (!fresh) {
    progress(`Efeitos: ${events.events.length} na batida`);
    const result = await engineCall(engine, engineArgs.sfx({ out: rel(paths.sfx), events: rel(paths.events), duration: events.duration }));
    for (const warning of result.warnings ?? []) warnings.push(`Efeitos: ${warning}`);
  }
  const entry = { file: rel(paths.sfx), events: events.events.length, hash };
  state.audio = { ...(state.audio ?? {}), sfx: entry };
  return { ...entry, reused: fresh };
}

/** The Motor's conference of a page and its video, with the networks when the installed Motor takes them. */
async function runAccept(ctx, engine, roteiro, video, warnings) {
  const { paths } = ctx;
  const wanted = (Array.isArray(fieldValue(ctx.state, "destinations")) ? fieldValue(ctx.state, "destinations") : Object.keys(NETWORK_LABELS)).filter((id) => NETWORK_LABELS[id]);
  const networks = wanted.length ? wanted : Object.keys(NETWORK_LABELS);
  const base = { page: rel(paths.page), format: roteiro.format, beats: rel(paths.grid), video: rel(video) };
  if (await engineSupports(engine, "--networks", { root: ROOT })) {
    try {
      return { result: await engineCall(engine, engineArgs.accept({ ...base, networks })), networks };
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "usage") throw error;
      warnings.push("O Motor de vídeo instalado não aceitou a conferência por rede; conferi pela zona segura comum às três.");
    }
  }
  return { result: await engineCall(engine, engineArgs.accept(base)), networks: null };
}

function acceptSummary(result, report) {
  const checks = Array.isArray(result?.checks) ? result.checks : [];
  const failed = checks.filter((item) => item.status === "fail").map((item) => ({ name: item.name ?? item.id, summary: item.summary ?? "", fix: item.fix ?? null }));
  const warned = checks.filter((item) => item.status === "warn").map((item) => ({ name: item.name ?? item.id, summary: item.summary ?? "" }));
  return {
    passed: result?.passed !== undefined && result?.passed !== null ? Boolean(result.passed) && !failed.length : failed.length === 0,
    failed,
    warned,
    checks,
    safe: result?.safe ?? null,
    networks: result?.networks ?? null,
    report,
  };
}

function textsOf(roteiro, origins = []) {
  return onScreenTexts(roteiro).map((item) => {
    const origin = origins.find((entry) => entry.scene === item.n && entry.field === item.field);
    const raw = roteiro.scenes[item.n - 1]?.[item.field];
    const from = origin && String(raw) === origin.text ? (ORIGIN_LABELS[origin.source] ?? origin.source ?? null) : item.field === "brand" ? ORIGIN_LABELS.marca : "ajustado no roteiro";
    return { n: item.n, role: item.role, start: item.start, end: item.end, text: item.text, from, source: item.source };
  });
}

/** The roteiro and the page of a video, rebuilt first when the roteiro or the brief changed since the last build. */
async function currentVideo(ctx, intake, found, { bank, templates, now, warnings }) {
  const { paths } = ctx;
  if (!found.built) {
    requireBriefApproval(ctx, found);
    const had = isFile(paths.roteiro) && isFile(paths.page);
    const built = await buildVideo(ctx, intake, { bank, templates, now });
    warnings.push(...built.warnings);
    if (had) warnings.push(found.written ? "O briefing mudou desde o último build: o roteiro e a página foram refeitos antes de renderizar." : "O roteiro.json mudou desde o último build: a página foi refeita antes de renderizar.");
    return built.roteiro;
  }
  return validateRoteiro(requireJson(paths.roteiro, "o roteiro.json"), templates);
}

// ---------------------------------------------------------------------------
// preview
// ---------------------------------------------------------------------------

const PARTNERSHIP = /(?<![\p{L}\p{N}])(?:publi|publipost|publicidade paga|parceria|parceira|patroc[ií]n\w*|permuta|recebid[oa]s? de presente|ganhei d[aeo]|collab|#ad|conteúdo pago|pago por)(?![\p{L}\p{N}])/iu;

/**
 * The questions asked together with the preview, besides its yes: the opening, when it did not
 * come from the member and there are other real openings to offer; the paid partnership, when the
 * request speaks of one. Each is rendered by the brief's own logic and answered with `answer`.
 */
function previewQuestions(ctx, intake, { bank, templates, kit, roteiro }) {
  const { state, slug } = ctx;
  const list = [];
  const answered = new Set((state.answers ?? []).map((answer) => answer?.id));
  const decided = { ...(kit?.decisions ?? {}), ...(state.decisions ?? {}) };
  const hook = roteiro.scenes.find((scene) => scene.role === "gancho");
  const hookEntry = state.fields?.hook;
  const fromMember = ["pedido", "resposta"].includes(hookEntry?.by ?? hookEntry?.source);
  if (hook?.text && !fromMember && !answered.has("abertura") && !state.build?.edited) {
    const seen = new Set([foldText(hook.text)]);
    const subject = fieldSource(state, "subject") === "padrao" ? "" : clean(fieldValue(state, "subject"));
    const firstSentence = clean(String(kit?.description ?? "").split(/(?<=[.!?])\s/)[0]);
    const others = [];
    for (const candidate of [kit?.headline, subject, firstSentence]) {
      const text = clean(candidate);
      if (!text) continue;
      const short = trimWords(text, 6).text.replace(/[.!?]+$/, "");
      if (short.split(" ").length < 3 || seen.has(foldText(short))) continue;
      seen.add(foldText(short));
      others.push(short.charAt(0).toUpperCase() + short.slice(1));
    }
    if (others.length) {
      const question = askQuestion(intake, bank, "abertura", { slug, state, kit, templates, vars: { "gancho 1": hook.text, "gancho 2": others[0], "gancho 3": others[1] ?? "" } });
      if (question) list.push(question);
    }
  }
  if (!decided.publi && !answered.has("publi") && PARTNERSHIP.test(String(state.request ?? ""))) {
    const question = askQuestion(intake, bank, "publi", { slug, state, kit, templates });
    if (question) list.push(question);
  }
  return list;
}

async function previewCommand(positionals, values) {
  const started = Date.now();
  const ctx = requireVideo(ROOT, positionals[0], { scriptCommand: SCRIPT_COMMAND });
  const intake = await loadIntake();
  const bank = intake.loadBank(APP_DIR);
  const templates = intake.loadTemplates(APP_DIR);
  const now = nowIso();
  const refresh = Boolean(values.refresh);
  const warnings = [];
  const before = sync(ctx, intake, templates);
  const engine = requireVideoRender(ROOT);
  const roteiro = await currentVideo(ctx, intake, before, { bank, templates, now, warnings });
  const { state, paths } = ctx;
  const times = timeline(roteiro);
  for (const name of ["render", "previa"]) ensureDir(paths[name]);
  const music = await ensureMusic(ctx, engine, roteiro, { refresh, warnings });
  const effects = await ensureEffects(ctx, engine, roteiro, { refresh, warnings });
  const content = contentHash(paths.dir, { engineVersion: engine.version });
  const previous = state.preview ?? {};
  const reused = [];

  // the silent render, half size
  const renderHash = hashJson({ content, format: roteiro.format, fps: roteiro.fps, scale: 0.5 });
  let render = previous.render ?? null;
  if (!refresh && render?.hash === renderHash && isFile(paths.previewSilent)) reused.push("render");
  else {
    progress(`Prévia: renderizando ${rel(paths.page)} em tamanho de celular (${decimal(times.duration)} s)`);
    const result = await engineCall(engine, engineArgs.preview({ page: rel(paths.page), out: rel(paths.previewSilent), format: roteiro.format, fps: roteiro.fps }));
    for (const warning of result.warnings ?? []) warnings.push(`Página: ${warning}`);
    const declared = Number(result.film?.duration ?? result.duration);
    if (Number.isFinite(declared) && Math.abs(declared - times.duration) > 2 / roteiro.fps) {
      warnings.push(`A página dura ${decimal(declared, 2)} s e o roteiro diz ${decimal(times.duration, 2)} s: rode ${command(`build ${ctx.slug}`)} para reescrevê-la a partir do roteiro (um trecho colado à mão na página precisa ser colado de novo depois).`);
    }
    render = { hash: renderHash, frames_hash: result.frames_hash ?? null, width: result.width ?? null, height: result.height ?? null, frames: result.frames ?? null };
  }

  // the sound under it
  const fadeOut = roteiro.loop ? 0 : 0.4;
  const mixHash = hashJson({ render: renderHash, music: music.hash, sfx: effects.hash, fadeOut });
  let mix = previous.mix ?? null;
  const silent = !music.file && !effects.file;
  if (!refresh && mix?.hash === mixHash && isFile(paths.preview)) reused.push("mix");
  else if (silent) {
    copyFileSync(paths.previewSilent, paths.preview);
    mix = { hash: mixHash, loudness: null };
    warnings.push("O roteiro não tem trilha nem efeitos: a prévia saiu sem som.");
  } else {
    progress(`Prévia: mixando ${music.file ? "a trilha" : "os efeitos"}${music.file && effects.file ? " e os efeitos" : ""}`);
    const result = await engineCall(engine, engineArgs.mix({ video: rel(paths.previewSilent), out: rel(paths.preview), music: music.file, musicOffset: music.offset ?? 0, sfx: effects.file, fadeOut }));
    for (const warning of result.warnings ?? []) warnings.push(`Som: ${warning}`);
    mix = { hash: mixHash, loudness: result.loudness ?? null };
  }

  // one frame per beat, for the AI to look at before saying anything
  const framesHash = hashJson({ content, grid: fileHash(paths.grid) });
  let frames = previous.frames ?? null;
  if (!refresh && frames?.hash === framesHash && isFile(paths.sheet)) reused.push("frames");
  else {
    progress("Prévia: um quadro por batida");
    const result = await engineCall(engine, engineArgs.frames({ page: rel(paths.page), out: rel(paths.frames), beats: rel(paths.grid), scale: 0.5, format: roteiro.format }));
    for (const warning of result.warnings ?? []) warnings.push(`Quadros: ${warning}`);
    frames = { hash: framesHash, sheet: result.sheet ?? rel(paths.sheet), dir: result.dir ?? rel(paths.frames), list: (result.frames ?? []).map((frame) => ({ time: frame.time, file: frame.file })) };
  }

  // the conference
  const acceptHash = hashJson({ content, mix: mixHash, grid: fileHash(paths.grid), destinations: fieldValue(state, "destinations") ?? null, networks: await engineSupports(engine, "--networks", { root: ROOT }) });
  let accept = previous.accept ?? null;
  if (!refresh && accept?.hash === acceptHash && isFile(paths.previewReport)) reused.push("accept");
  else {
    progress("Prévia: conferindo capa, zona segura, texto, cortes e ritmo");
    const { result, networks } = await runAccept(ctx, engine, roteiro, paths.preview, warnings);
    for (const warning of result.warnings ?? []) warnings.push(`Conferência: ${warning}`);
    writeJson(paths.previewReport, { app: APP, command: "preview", generated_at: now, slug: ctx.slug, video: rel(paths.preview), networks, ...result });
    accept = { hash: acceptHash, ...acceptSummary(result, rel(paths.previewReport)) };
  }
  const id = videoId(paths, state, engine);
  state.preview = { at: now, id, file: rel(paths.preview), sheet: frames.sheet, render, mix, frames, accept };
  state.status = "preview";
  const concluded = conclude(ctx, intake, { bank, templates, now, step: "preview", note: accept.passed ? "prévia conferida" : `prévia com ${accept.failed.length} item(ns) reprovado(s)` });
  if (!accept.passed) warnings.push(`A conferência reprovou: ${accept.failed.map((item) => item.name).join(", ")}. Corrija o roteiro ou a página e refaça a prévia antes de mostrar.`);
  const question = askQuestion(intake, bank, "previa_ok", { slug: ctx.slug, state, kit: kitOf(state), templates, warnings });
  const questions = previewQuestions(ctx, intake, { bank, templates, kit: kitOf(state), roteiro });
  const { hash: _a, ...acceptShown } = accept;
  return {
    slug: ctx.slug,
    preview: rel(paths.preview),
    width: render.width ?? FORMAT.width / 2,
    height: render.height ?? FORMAT.height / 2,
    duration: times.duration,
    bpm: roteiro.bpm,
    bars: times.bars,
    sheet: frames.sheet,
    frames: frames.list,
    music: { mode: music.mode, file: music.file, style: music.style ?? null, seed: music.seed ?? null, offset: music.offset ?? 0 },
    effects: { file: effects.file, events: effects.events },
    loudness: mix.loudness,
    accept: acceptShown,
    texts: textsOf(roteiro, state.build?.origins ?? []),
    question,
    questions,
    open_command: command(`open ${ctx.slug} previa`),
    reused,
    next_step: concluded.next_step,
    warnings,
    elapsed_s: round((Date.now() - started) / 1000, 1),
  };
}

// ---------------------------------------------------------------------------
// final
// ---------------------------------------------------------------------------

/** What is still the member's to decide or confirm before the video goes out. */
function pendingDecisions({ state, kit, roteiro, music }) {
  const list = [];
  if (music.mode === "file") list.push(`A música é um arquivo seu (${music.file}): confirme que você tem o direito de usá-la em publicações e em anúncios; sem isso, a rede pode tirar o som ou o vídeo.`);
  if (kit && !kit.confirmed) list.push(`A marca ${kit.name ?? kit.host ?? ""} foi encontrada por busca e ainda não foi confirmada: confira o logo, as cores e as telas antes de publicar.`);
  if (state.capture?.failed) {
    // without the site, the brand is only what the member gave: a logo in materiais, colours set while building
    const ownLogo = Boolean(roteiro.brand?.logo);
    const neutral = Object.keys(NEUTRAL_PALETTE).every((key) => String(roteiro.palette?.[key] ?? "").toUpperCase() === NEUTRAL_PALETTE[key].toUpperCase());
    const lacking = [ownLogo ? null : "o logo", neutral ? "as cores" : null].filter(Boolean);
    list.push(
      lacking.length
        ? `O site da marca não pôde ser capturado: o vídeo não usa ${lacking.join(" nem ")} da marca${ownLogo ? " (o logo veio dos seus arquivos)" : ""}. Confira se é isso mesmo que você quer publicar.`
        : "O site da marca não pôde ser capturado: o logo veio dos seus arquivos e as cores foram definidas na montagem do vídeo. Confira os dois antes de publicar.",
    );
  }
  const proof = roteiro.scenes.find((scene) => scene.role === "prova");
  if (proof) list.push(`O número mostrado (${proof.prefix ?? ""}${proof.value}${proof.suffix ?? ""} ${proof.text ?? ""}) veio de: ${proof.source}. Confirme que continua valendo no dia da publicação.`);
  const price = roteiro.scenes.find((scene) => scene.role === "preco");
  if (price) list.push("O preço e o prazo do vídeo precisam valer no dia da publicação e durante o impulsionamento.");
  // what the member already decided (answers to the rights questions) replaces the reminder
  const decided = { ...(kit?.decisions ?? {}), ...(state.decisions ?? {}) };
  const said = (id) => {
    const entry = decided[id];
    return entry && typeof entry === "object" ? entry.value : (entry ?? null);
  };
  const sectors = (kit?.sector_cues ?? []).filter((cue) => REGULATED[cue]).map((cue) => REGULATED[cue]);
  if (sectors.length && !said("setor")) list.push(`O site indica um setor com regras próprias de publicidade (${[...new Set(sectors)].join(", ")}): confira as regras do seu conselho ou do setor antes de publicar e de impulsionar.`);
  if (said("outra_marca") === "mostrar") list.push("O vídeo mostra a marca de outra empresa: a autorização de uso é sua.");
  if (said("publi") === "sim") list.push("Este vídeo é publicidade paga por outra marca: ligue o rótulo de parceria paga da rede e diga isso no texto do post (por exemplo, #publi).");
  else if (said("publi") !== "nao") list.push("Se o vídeo for pago por outra marca, ou divulgar algo recebido de graça, ligue o rótulo de parceria paga da rede e diga isso no texto do post.");
  list.push("As redes pedem um rótulo para cenas realistas feitas ou alteradas por IA. Este vídeo é animação gráfica (texto, telas e formas); se você acrescentar fotos ou vozes geradas, ligue o rótulo.");
  return list;
}

async function finalCommand(positionals, values) {
  const started = Date.now();
  const ctx = requireVideo(ROOT, positionals[0], { scriptCommand: SCRIPT_COMMAND });
  const intake = await loadIntake();
  const bank = intake.loadBank(APP_DIR);
  const templates = intake.loadTemplates(APP_DIR);
  const now = nowIso();
  const warnings = [];
  const before = sync(ctx, intake, templates);
  const skip = Boolean(values.direct) || fieldValue(ctx.state, "skip_preview") === true;
  if (!skip && (!ctx.state.approvals?.preview || !before.built)) {
    const made = before.built && ctx.state.files.preview;
    const changed = before.stale.preview || Boolean(ctx.state.approvals?.preview) || (Boolean(ctx.state.preview) && !made);
    throw fail(
      "preview_not_approved",
      changed ? "O vídeo mudou depois da prévia que o integrante viu: ele precisa ver a prévia atual antes do vídeo final." : "Falta o sim do integrante à prévia antes do vídeo final.",
      made ? `Mostre a prévia (${command(`open ${ctx.slug} previa`)}) e, com o sim dele, rode ${command(`approve ${ctx.slug} preview`)}.` : `Rode ${command(`preview ${ctx.slug}`)}, olhe a folha de quadros, mostre a prévia e, com o sim dele, rode ${command(`approve ${ctx.slug} preview`)}.`,
      { next_step: made ? { action: "approve_preview", command: null, say: "A prévia está pronta. Posso fazer o vídeo final?" } : { action: "preview", command: command(`preview ${ctx.slug}`), say: "Vou fazer a prévia para você ver antes do vídeo final." } },
    );
  }
  const engine = requireVideoRender(ROOT);
  const roteiro = await currentVideo(ctx, intake, before, { bank, templates, now, warnings });
  const { state, paths } = ctx;
  const times = timeline(roteiro);
  for (const name of ["render", "entrega"]) ensureDir(paths[name]);
  const music = await ensureMusic(ctx, engine, roteiro, { refresh: false, warnings });
  const effects = await ensureEffects(ctx, engine, roteiro, { refresh: false, warnings });

  progress(`Final: renderizando ${rel(paths.page)} em ${FORMAT.width}×${FORMAT.height} com desfoque de movimento (${decimal(times.duration)} s)`);
  const rendered = await engineCall(engine, engineArgs.render({ page: rel(paths.page), out: rel(paths.finalSilent), format: roteiro.format, fps: roteiro.fps, sub: 2 }));
  for (const warning of rendered.warnings ?? []) warnings.push(`Página: ${warning}`);

  const fadeOut = roteiro.loop ? 0 : 0.4;
  let loudness = null;
  if (!music.file && !effects.file) {
    copyFileSync(paths.finalSilent, paths.final);
    warnings.push("O roteiro não tem trilha nem efeitos: o vídeo final saiu sem som.");
  } else {
    progress("Final: mixando o som no volume das redes");
    const mixed = await engineCall(engine, engineArgs.mix({ video: rel(paths.finalSilent), out: rel(paths.final), music: music.file, musicOffset: music.offset ?? 0, sfx: effects.file, fadeOut }));
    for (const warning of mixed.warnings ?? []) warnings.push(`Som: ${warning}`);
    loudness = mixed.loudness ?? null;
  }

  progress("Final: a capa (o primeiro quadro)");
  removeDir(paths.coverFrames);
  const cover = await engineCall(engine, engineArgs.frames({ page: rel(paths.page), out: rel(paths.coverFrames), times: [0], format: roteiro.format }));
  const first = cover.frames?.[0]?.file ? resolve(ROOT, cover.frames[0].file) : join(paths.coverFrames, "quadro-0001.png");
  if (isFile(first)) {
    copyFileSync(first, paths.cover);
    removeDir(paths.coverFrames);
  } else warnings.push("O Motor de vídeo não devolveu o quadro da capa; use o primeiro quadro do vídeo como capa.");

  progress("Final: conferindo o vídeo");
  const { result: accepted, networks } = await runAccept(ctx, engine, roteiro, paths.final, warnings);
  for (const warning of accepted.warnings ?? []) warnings.push(`Conferência: ${warning}`);
  let info = null;
  try {
    info = await engineCall(engine, engineArgs.probe({ file: rel(paths.final) }));
  } catch (error) {
    warnings.push(`Não consegui medir o arquivo final: ${error.message}`);
  }
  // what only the delivered file can tell
  const delivery = [];
  const item = (name, status, summary) => delivery.push({ name, status, summary, details: [] });
  if (info) {
    const size = info.width === FORMAT.width && info.height === FORMAT.height;
    item("video_size", size ? "pass" : "fail", size ? `O vídeo tem ${info.width}×${info.height}.` : `O vídeo tem ${info.width}×${info.height}; o esperado é ${FORMAT.width}×${FORMAT.height}.`);
    const drift = Math.abs(Number(info.duration) - times.duration);
    item("video_duration", drift <= 0.15 ? "pass" : "warn", `O vídeo dura ${decimal(info.duration, 2)} s; o roteiro, ${decimal(times.duration, 2)} s.`);
    const wantsSound = Boolean(music.file || effects.file);
    item("has_audio", !wantsSound ? "skip" : info.has_audio ? "pass" : "fail", !wantsSound ? "O roteiro não tem som." : info.has_audio ? "O vídeo tem som." : "O vídeo saiu sem som.");
  }
  // the volume, measured here only when the Motor's own conference did not measure it
  const measuredByMotor = (accepted.checks ?? []).some((check) => (check.name ?? check.id) === "loudness");
  if (!measuredByMotor && loudness && Number.isFinite(loudness.integrated_lufs)) {
    const ok = Math.abs(loudness.integrated_lufs + 14) <= 1.5 && (loudness.true_peak_dbtp ?? -1) <= -1;
    item("loudness", ok ? "pass" : "warn", `Volume de ${decimal(loudness.integrated_lufs)} LUFS, pico real de ${decimal(loudness.true_peak_dbtp ?? 0)} dBTP (o alvo das redes é −14 LUFS e −1 dBTP).`);
  }
  const summary = acceptSummary(accepted, rel(paths.report));
  for (const check of delivery.filter((entry) => entry.status === "fail")) summary.failed.push({ name: check.name, summary: check.summary, fix: null });
  summary.passed = summary.passed && !delivery.some((entry) => entry.status === "fail");
  summary.checks = [...summary.checks, ...delivery];

  const kit = kitOf(state);
  const id = videoId(paths, state, engine);
  const texts = textsOf(roteiro, state.build?.origins ?? []);
  const pending = pendingDecisions({ state, kit, roteiro, music });
  const musicNote =
    music.mode === "file" ? `Música do integrante: ${music.file}. Só publique e impulsione com o direito de uso confirmado.`
    : music.mode === "none" ? (effects.file ? "Sem trilha; só os efeitos, gerados aqui e livres para usar e impulsionar." : "Vídeo sem som.")
    : `trilha original gerada aqui; livre para usar e impulsionar. (${music.style}, ${decimal(roteiro.bpm, 1)} BPM, semente ${music.seed})`;
  const scenesByRole = (role) => roteiro.scenes.filter((scene) => scene.role === role).map((scene) => scene.text).filter(Boolean);
  const post = suggestPost({
    hook: scenesByRole("gancho")[0] ?? clean(fieldValue(state, "hook")),
    points: [...scenesByRole("ponto"), ...scenesByRole("item"), ...scenesByRole("passo")],
    closing: scenesByRole("fechamento")[0] ?? "",
    brand: roteiro.brand?.name,
  });
  const notes = notesMarkdown({
    title: roteiro.title,
    files: { video: rel(paths.final), cover: isFile(paths.cover) ? rel(paths.cover) : null, report: rel(paths.report) },
    info: { width: info?.width ?? FORMAT.width, height: info?.height ?? FORMAT.height, duration: info?.duration ?? times.duration, lufs: loudness?.integrated_lufs ?? null },
    destinations: Array.isArray(fieldValue(state, "destinations")) ? fieldValue(state, "destinations") : Object.keys(NETWORK_LABELS),
    post,
    music: musicNote,
    checks: summary.checks.map((entry) => ({ ...entry, label: CHECK_LABELS[entry.name ?? entry.id] ?? entry.name ?? entry.id })),
    passed: summary.passed,
    pending,
    warnings,
    generatedAt: now,
  });
  ensureDir(paths.entrega);
  writeJson(paths.report, {
    app: APP,
    command: "final",
    generated_at: now,
    slug: ctx.slug,
    file: rel(paths.final),
    cover: isFile(paths.cover) ? rel(paths.cover) : null,
    passed: summary.passed,
    failed: summary.failed,
    networks,
    accept: accepted,
    delivery_checks: delivery,
    loudness,
    media: info ? { width: info.width, height: info.height, duration: info.duration, fps: info.fps ?? null, has_audio: info.has_audio ?? null, video_codec: info.video_codec ?? null, audio_codec: info.audio_codec ?? null, size: info.size ?? null } : null,
    frames_hash: rendered.frames_hash ?? null,
    roteiro: { template: roteiro.template, style: roteiro.style, duration: times.duration, bpm: roteiro.bpm, bars: times.bars, music: roteiro.music },
    texts,
    pending,
    warnings,
  });
  writeFileAtomic(paths.notes, notes);
  state.delivery = { at: now, id, file: rel(paths.final), cover: isFile(paths.cover) ? rel(paths.cover) : null, notes: rel(paths.notes), report: rel(paths.report), passed: summary.passed, failed: summary.failed.map((entry) => entry.name), loudness, frames_hash: rendered.frames_hash ?? null, direct: Boolean(values.direct) };
  state.status = "final";
  const concluded = conclude(ctx, intake, { bank, templates, now, step: "final", note: summary.passed ? "vídeo final conferido" : `vídeo final com ${summary.failed.length} item(ns) reprovado(s)` });
  if (!summary.passed) warnings.push(`A conferência reprovou: ${summary.failed.map((entry) => entry.name).join(", ")}. Corrija e gere de novo, ou conte ao integrante exatamente o que ficou assim.`);
  return {
    slug: ctx.slug,
    file: rel(paths.final),
    width: info?.width ?? FORMAT.width,
    height: info?.height ?? FORMAT.height,
    duration: info?.duration ?? times.duration,
    cover: isFile(paths.cover) ? rel(paths.cover) : null,
    notes: rel(paths.notes),
    notes_text: notes,
    report: rel(paths.report),
    accept: summary,
    loudness,
    texts,
    pending,
    open_command: command(`open ${ctx.slug} final`),
    next_step: concluded.next_step,
    warnings,
    elapsed_s: round((Date.now() - started) / 1000, 1),
  };
}

// ---------------------------------------------------------------------------
// status, list and open
// ---------------------------------------------------------------------------

async function statusCommand(positionals) {
  const ctx = requireVideo(ROOT, positionals[0], { scriptCommand: SCRIPT_COMMAND });
  const intake = await loadIntake();
  const bank = intake.loadBank(APP_DIR);
  const templates = intake.loadTemplates(APP_DIR);
  const concluded = conclude(ctx, intake, { bank, templates, now: nowIso(), save: false });
  const { state, paths } = ctx;
  const warnings = [];
  if (concluded.found.stale.brief) warnings.push(`O briefing mudou depois do sim do integrante (por exemplo, numa nova visita ao site): ${command(`brief ${ctx.slug}`)} mostra a versão atual; a próxima prévia já sai com ela.`);
  if (concluded.found.stale.preview) warnings.push("O vídeo mudou depois da prévia aprovada: refaça a prévia e peça o sim de novo.");
  if (isFile(paths.roteiro) && !concluded.found.written) warnings.push(`O roteiro.json mudou desde o último build: rode ${command(`build ${ctx.slug}`)}.`);
  else if (concluded.found.written && !concluded.found.built) warnings.push(`O briefing mudou desde o último build: rode ${command(`build ${ctx.slug}`)} para reescrever o roteiro.`);
  if (state.build?.edited && state.build.inputs_hash !== draftInputs(ctx, concluded.found.filled, concluded.found.kit)) {
    warnings.push(`O briefing mudou e o roteiro.json ajustado à mão foi mantido: mude o roteiro, ou reescreva-o com ${command(`build ${ctx.slug} --force`)}.`);
  }
  if (state.capture?.failed) warnings.push(`O site ${state.capture.url} não foi capturado (${state.capture.code}): o vídeo usa um visual neutro.`);
  return {
    ...briefResult(ctx, intake, concluded, { bank, templates }),
    title: readJson(paths.roteiro, null)?.title ?? null,
    approvals: { brief: state.approvals?.brief ?? null, preview: state.approvals?.preview ?? null },
    files: {
      ...state.files,
      briefing: isFile(paths.brief) ? rel(paths.brief) : null,
      roteiro_file: isFile(paths.roteiro) ? rel(paths.roteiro) : null,
      page: isFile(paths.page) ? rel(paths.page) : null,
      preview_file: isFile(paths.preview) ? rel(paths.preview) : null,
      sheet: isFile(paths.sheet) ? rel(paths.sheet) : null,
      final_file: isFile(paths.final) ? rel(paths.final) : null,
      cover: isFile(paths.cover) ? rel(paths.cover) : null,
      notes: isFile(paths.notes) ? rel(paths.notes) : null,
    },
    preview: state.preview ? { at: state.preview.at, current: state.files.preview, passed: state.preview.accept?.passed ?? null, failed: (state.preview.accept?.failed ?? []).map((item) => item.name) } : null,
    final: state.delivery ? { at: state.delivery.at, current: state.files.final, passed: state.delivery.passed ?? null, failed: state.delivery.failed ?? [] } : null,
    created_at: state.created_at ?? null,
    updated_at: state.updated_at ?? null,
    history: (state.history ?? []).slice(-6),
    warnings,
  };
}

async function listCommand() {
  const videos = listVideos(ROOT);
  let intake = null;
  let templates = null;
  let bank = null;
  if (videos.length) {
    intake = await loadIntake();
    bank = intake.loadBank(APP_DIR);
    templates = intake.loadTemplates(APP_DIR);
  }
  const list = videos.map(({ slug, dir, state }) => {
    const ctx = { slug, dir, paths: layout(dir, slug), state };
    const concluded = conclude(ctx, intake, { bank, templates, now: nowIso(), save: false });
    return {
      slug,
      dir: rel(dir),
      brand: brandOf(state).name ?? state.brand?.slug ?? null,
      title: readJson(ctx.paths.roteiro, null)?.title ?? null,
      status: state.status ?? null,
      mode: state.mode ?? null,
      updated_at: state.updated_at ?? null,
      next_step: concluded.next_step,
      status_command: command(`status ${slug}`),
    };
  });
  const next = list.length
    ? { action: "status", command: list.length === 1 ? list[0].status_command : null, say: list.length === 1 ? `Há um vídeo neste projeto: ${list[0].slug}.` : `Há ${list.length} vídeos neste projeto; diga qual você quer continuar.` }
    : { action: "intake", command: command("intake --request estudio-de-video/pedido.txt"), say: "Ainda não há vídeos neste projeto. Diga o que você quer divulgar e eu começo." };
  return { dir: STUDIO_DIR, videos: list, brands: listKits(ROOT), next_step: next, warnings: [] };
}

async function openCommand(positionals) {
  const ctx = requireVideo(ROOT, positionals[0], { scriptCommand: SCRIPT_COMMAND });
  const { paths, slug } = ctx;
  const targets = {
    previa: { file: paths.preview, what: "a prévia", make: `preview ${slug}` },
    final: { file: paths.final, what: "o vídeo final", make: `final ${slug}` },
    folha: { file: paths.sheet, what: "a folha de quadros", make: `preview ${slug}` },
    briefing: { file: paths.brief, what: "o briefing", make: `brief ${slug}` },
    capa: { file: paths.cover, what: "a capa", make: `final ${slug}` },
    notas: { file: paths.notes, what: "as notas de entrega", make: `final ${slug}` },
    pasta: { file: paths.dir, what: "a pasta do vídeo", folder: true },
    materiais: { file: paths.materiais, what: "a pasta de materiais", folder: true },
  };
  const wanted = positionals[1] ?? (isFile(paths.final) ? "final" : isFile(paths.preview) ? "previa" : "pasta");
  const target = targets[wanted];
  if (!target) throw usage(`Não sei abrir "${wanted}".`, `Use um de: ${Object.keys(targets).join(", ")}.`);
  if (target.folder ? !isDir(target.file) : !isFile(target.file)) {
    throw new AppError("file_not_found", `Ainda não existe ${target.what} do vídeo "${slug}" (${rel(target.file)}).`, target.make ? `Rode ${command(target.make)} e depois open de novo.` : "Confira o nome do vídeo com o comando list.");
  }
  // FLYEE_NO_OPEN=1 keeps windows closed where there is no one to look (tests, a machine without a screen)
  const opened = process.env.FLYEE_NO_OPEN !== "1";
  if (opened) {
    const child = WINDOWS
      ? spawn("cmd", ["/c", "start", "", target.file], { detached: true, stdio: "ignore", windowsHide: true })
      : spawn(MAC ? "open" : "xdg-open", [target.file], { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  }
  let next = ctx.state.next_step ?? null;
  if (wanted === "final") {
    const intake = await loadIntake();
    const bank = intake.loadBank(APP_DIR);
    const templates = intake.loadTemplates(APP_DIR);
    sync(ctx, intake, templates);
    if (ctx.state.files.final && ctx.state.status !== "delivered") {
      ctx.state.status = "delivered";
      next = conclude(ctx, intake, { bank, templates, now: nowIso(), step: "deliver", note: "vídeo final aberto para o integrante" }).next_step;
    }
  }
  return { slug, target: wanted, file: rel(target.file), opened, next_step: next, warnings: [] };
}

// ---------------------------------------------------------------------------
// help, text and main
// ---------------------------------------------------------------------------

const HELP = `Estúdio de vídeo: vídeos animados na vertical para Reels, TikTok e Shorts, do pedido ao arquivo conferido.

Uso: ${SCRIPT_COMMAND} <comando> [opções] [--json]

Comandos
  check                              O que esta máquina tem (o Motor de vídeo, o ffmpeg, o navegador) e o que esta versão faz.
  intake --request <arquivo>         Lê o pedido do integrante, mede o que falta e cria estudio-de-video/<vídeo>/.
  answer <vídeo> <id> <valor…>       Registra a resposta de uma pergunta (o value da opção, ou o texto livre).
  answer <vídeo> --file <json>       Registra várias respostas de uma vez: { "id": "valor" }.
  answer <vídeo> --decide            Preenche o que ficou sem resposta na rodada com os padrões.
  answer <vídeo> --decide all        O mesmo para esta rodada e as seguintes ("o resto decide você").
  capture <vídeo>                    Visita o site da marca e guarda logo, cores, fontes, telas, textos e números.
  brief <vídeo>                      Escreve o briefing completo (briefing.md) para o integrante dizer sim.
  approve <vídeo> brief|preview      Registra o sim do integrante ao briefing ou à prévia.
  build <vídeo>                      Escreve o roteiro (roteiro.json) e a página do vídeo (pagina.html).
  preview <vídeo>                    Compõe a trilha e os efeitos, renderiza em tamanho de celular, mixa e confere.
  final <vídeo>                      Renderiza em 1080×1920, mixa no volume das redes, grava a capa, as notas e o relatório.
  status <vídeo>                     Onde o vídeo está e qual é o próximo passo (para retomar depois de uma pausa).
  list                               Os vídeos e as marcas deste projeto.
  open <vídeo> [o quê]               Abre para o integrante: previa, final, folha, briefing, capa, notas, pasta ou materiais.
  help                               Esta ajuda.

Opções
  intake   --slug <nome>             O nome da pasta do vídeo (padrão: a marca e o tipo do vídeo; um nome ocupado ganha -2, -3).
           --force                   Recomeça por cima de um vídeo que já existe com esse --slug (os materiais do integrante ficam).
  capture  --url <endereço>          Captura este endereço (um site achado por busca fica esperando o sim do integrante).
           --refresh                 Captura de novo mesmo com a marca guardada há menos de ${KIT_MAX_AGE_DAYS} dias.
  approve  --note "…"                Uma observação do integrante junto com o sim.
  build    --force                   Reescreve o roteiro a partir do briefing (o atual vai para roteiro.anterior.json). A página é sempre reescrita a partir do roteiro.
  preview  --refresh                 Refaz tudo, inclusive a trilha e o que não mudou.
  final    --direct                  Faz o vídeo final sem o sim à prévia (só quando o integrante pediu para fazer direto).

Todo resultado traz next_step: action (o que vem agora), command (o comando exato) e say (uma frase para o integrante).
O vídeo tem de ${LIMITS.duration[0]} a ${LIMITS.duration[1]} s, em ${FORMAT.name} (${FORMAT.width}×${FORMAT.height}); cada cena dura compassos da trilha, e todo corte cai na batida.`;

function checkLines(accept) {
  return (accept?.checks ?? []).map((item) => `  ${MARKS[item.status] ?? "?"} ${CHECK_LABELS[item.name ?? item.id] ?? item.name ?? item.id}: ${item.summary ?? ""}`);
}

function roundLines(plan) {
  if (!plan) return [];
  return plan.chat_text ? [plan.chat_text] : (plan.questions ?? []).map((question, index) => `${index + 1}. ${question.text}`);
}

function humanText(result) {
  if (!result.ok) {
    const lines = [`Erro (${result.error.code}): ${result.error.message}`, result.error.fix && `Como resolver: ${result.error.fix}`];
    if (result.next_step?.command) lines.push(`Próximo passo: ${result.next_step.command}`);
    return lines.filter(Boolean).join("\n");
  }
  const warnings = (result.warnings ?? []).map((warning) => `Aviso: ${warning}`);
  const next = result.next_step ? [result.next_step.say && `Agora: ${result.next_step.say}`, result.next_step.command && `Próximo passo: ${result.next_step.command}`].filter(Boolean) : [];
  switch (result.command) {
    case "help":
      return result.text;
    case "check": {
      const engine = result.video_render;
      const lines = [`Estúdio de vídeo ${result.version}`];
      if (engine.installed) {
        lines.push(`Motor de vídeo ${engine.version ?? "?"}: instalado (${engine.path}) · render ${result.modes.render ? "disponível" : "indisponível"}`);
        const tools = result.engine?.tools;
        if (tools) lines.push(`ffmpeg: ${tools.ffmpeg ?? "não encontrado"} · navegador: ${tools.browser ? `${tools.browser.name} (${tools.browser.path})` : "não encontrado"}`);
      } else lines.push(`Motor de vídeo: não instalado. Rode você mesmo ${engine.dry_run}, diga ao integrante o que ele declara e, com o sim dele, rode ${engine.install}`);
      for (const [name, line] of Object.entries(result.install)) lines.push(`Instalar ${name}: ${line}`);
      if (result.install_note) lines.push(result.install_note);
      lines.push(`Guias: ${Object.values(result.guides).filter(Boolean).join(" · ") || "nenhum"}`);
      return [...lines, ...warnings, ...next].join("\n");
    }
    case "intake":
    case "answer":
    case "status": {
      const lines = [`Vídeo ${result.slug} (${result.dir}) · pedido ${result.sufficiency ?? "?"} · modo ${result.mode ?? "?"} · etapa ${result.status ?? "?"}`];
      if (result.linha) lines.push(result.linha);
      if (result.unsupported?.length) lines.push(`Fora desta versão: ${result.unsupported.map((item) => `${item.kind} (${item.evidence})`).join("; ")}`);
      lines.push(...roundLines(result.round));
      return [...lines, ...warnings, ...next].join("\n");
    }
    case "capture": {
      const brand = result.brand ?? {};
      const lines = [
        `Marca ${brand.name ?? "?"} (${brand.host ?? brand.site ?? "?"})${result.reused ? ", já guardada" : " capturada"}: logo ${brand.logo ? brand.logo.file : "não encontrado"} · destaque ${brand.colors?.primary ?? "não encontrado"} · ${Object.keys(brand.screens ?? {}).length} telas · ${(brand.numbers ?? []).length} números.`,
        `Guardada em ${result.kit}.`,
      ];
      if (result.confirm) lines.push(`Confirme com o integrante: ${result.confirm.text}`);
      lines.push(...roundLines(result.round));
      return [...lines, ...warnings, ...next].join("\n");
    }
    case "brief":
      return [result.echo, result.question?.text, `Briefing: ${result.briefing}`, ...warnings, ...next].filter(Boolean).join("\n");
    case "approve":
      return [`Registrado o sim do integrante: ${result.approved === "brief" ? "briefing" : "prévia"}.`, ...warnings, ...next].join("\n");
    case "build": {
      const lines = [`"${result.title}": roteiro ${result.template}, ${result.scenes.length} cenas, ${decimal(result.duration)} s (${decimal(result.bars, 2)} compassos a ${decimal(result.bpm, 1)} BPM).`];
      for (const scene of result.scenes) lines.push(`  ${String(scene.n).padStart(2)} ${String(scene.role).padEnd(10)} ${String(decimal(scene.start, 2)).padStart(6)} s  ${scene.text ?? ""}`);
      lines.push(`Roteiro: ${result.roteiro} · página: ${result.page}`);
      return [...lines, ...warnings, ...next].join("\n");
    }
    case "preview": {
      const lines = [
        `Prévia: ${result.preview} (${result.width}×${result.height}, ${decimal(result.duration)} s) em ${result.elapsed_s} s${result.reused.length ? ` · reaproveitado: ${result.reused.join(", ")}` : ""}.`,
        `Folha de quadros (um por batida): ${result.sheet}`,
        `Conferência: ${result.accept.passed ? "APROVADO" : "REPROVADO"}`,
        ...checkLines(result.accept),
        "Textos na tela:",
        ...result.texts.map((item) => `  ${String(decimal(item.start, 1)).padStart(5)} s  ${item.text}${item.source ? ` (fonte: ${item.source})` : ""}`),
      ];
      if (result.question?.text) lines.push(result.question.text);
      for (const extra of result.questions ?? []) if (extra?.text) lines.push(extra.text);
      return [...lines, ...warnings, ...next].join("\n");
    }
    case "final": {
      const lines = [
        `Vídeo final: ${result.file} (${result.width}×${result.height}, ${decimal(result.duration)} s${result.loudness ? `, ${decimal(result.loudness.integrated_lufs)} LUFS` : ""}) em ${result.elapsed_s} s.`,
        result.cover && `Capa: ${result.cover}`,
        `Notas de entrega: ${result.notes} · relatório: ${result.report}`,
        `Conferência: ${result.accept.passed ? "APROVADO" : "REPROVADO"}`,
        ...checkLines(result.accept),
      ].filter(Boolean);
      return [...lines, ...warnings, ...next].join("\n");
    }
    case "list": {
      const lines = result.videos.length ? result.videos.map((video) => `  ${video.slug.padEnd(40)} ${String(video.status ?? "?").padEnd(10)} ${video.next_step?.action ?? ""}`) : ["  (nenhum vídeo ainda)"];
      return [`Vídeos em ${result.dir}/:`, ...lines, result.brands.length ? `Marcas guardadas: ${result.brands.map((brand) => brand.slug).join(", ")}` : null, ...next].filter(Boolean).join("\n");
    }
    case "open":
      return [`${result.opened ? "Aberto" : "Pronto para abrir"}: ${result.file}`, ...next].join("\n");
    default:
      return JSON.stringify(result, null, 2);
  }
}

async function main(argv) {
  const [name, ...given] = argv;
  // "--decide all" and "--decide=all" decide every round that is left; a plain "--decide", only the pending one
  const rest = [];
  for (let i = 0; i < given.length; i++) {
    const arg = given[i];
    const all = /^(?:all|tudo|todas|todos)$/i;
    if (arg === "--decide" && all.test(given[i + 1] ?? "")) {
      rest.push("--decide-all");
      i++;
    } else if (arg.startsWith("--decide=")) rest.push(all.test(arg.slice("--decide=".length)) ? "--decide-all" : "--decide");
    else rest.push(arg);
  }
  if (!name || ["help", "--help", "-h"].includes(name)) {
    return { ok: true, command: "help", interface_version: INTERFACE_VERSION, app: APP, text: HELP, next_step: { action: "check", command: command("check"), say: "" } };
  }
  const { positionals, values } = parseArgs(rest, ARG_SPEC);
  const one = (text) => {
    if (positionals.length !== 1) throw usage(text, "O comando list mostra os vídeos do projeto.");
  };
  let result;
  switch (name) {
    case "check":
      result = await checkCommand();
      break;
    case "intake":
      if (positionals.length) throw usage("O intake não recebe o nome do vídeo: use intake --request <arquivo> [--slug <nome>].");
      result = await intakeCommand(values);
      break;
    case "answer":
      if (!positionals.length) throw usage("Informe o vídeo: answer <vídeo> <id> <valor>, answer <vídeo> --file <json> ou answer <vídeo> --decide.");
      result = await answerCommand(positionals, values);
      break;
    case "capture":
      one("Informe o vídeo: capture <vídeo> [--url <endereço>] [--refresh].");
      result = await captureCommand(positionals, values);
      break;
    case "brief":
      one("Informe o vídeo: brief <vídeo>.");
      result = await briefCommand(positionals);
      break;
    case "approve":
      if (positionals.length !== 2) throw usage("Informe o vídeo e o que foi aprovado: approve <vídeo> brief ou approve <vídeo> preview.");
      result = await approveCommand(positionals, values);
      break;
    case "build":
      one("Informe o vídeo: build <vídeo> [--force].");
      result = await buildCommand(positionals, values);
      break;
    case "preview":
      one("Informe o vídeo: preview <vídeo> [--refresh].");
      result = await previewCommand(positionals, values);
      break;
    case "final":
      one("Informe o vídeo: final <vídeo> [--direct].");
      result = await finalCommand(positionals, values);
      break;
    case "status":
      one("Informe o vídeo: status <vídeo>.");
      result = await statusCommand(positionals);
      break;
    case "list":
      if (positionals.length) throw usage("O comando list não recebe argumentos.");
      result = await listCommand();
      break;
    case "open":
      if (positionals.length < 1 || positionals.length > 2) throw usage("Informe o vídeo e, se quiser, o que abrir: open <vídeo> [previa|final|folha|briefing|capa|notas|pasta|materiais].");
      result = await openCommand(positionals);
      break;
    default:
      throw usage(`Comando desconhecido: ${name}.`, "Comandos: check, intake, answer, capture, brief, approve, build, preview, final, status, list, open, help.");
  }
  return { ok: true, command: name, interface_version: INTERFACE_VERSION, app: APP, ...result };
}

const json = process.argv.includes("--json");
main(process.argv.slice(2))
  .then((result) => process.stdout.write(`${json ? JSON.stringify(result, null, 2) : humanText(result)}\n`))
  .catch((error) => {
    const known = error instanceof AppError;
    const result = {
      ok: false,
      command: process.argv[2] ?? null,
      interface_version: INTERFACE_VERSION,
      app: APP,
      error: {
        code: known ? error.code : "unexpected",
        message: known ? error.message : `Erro inesperado: ${error?.message ?? error}`,
        fix: known ? error.fix : "Tente de novo; se repetir, mostre esta mensagem ao integrante.",
      },
      ...(known && error.extra ? error.extra : {}),
    };
    process.stdout.write(`${json ? JSON.stringify(result, null, 2) : humanText(result)}\n`);
    // The exit code, and the process ends on its own: on Windows with Node 24, process.exit() after an
    // HTTPS fetch aborts Node ("UV_HANDLE_CLOSING", exit 127). The timer only fires if something keeps it alive.
    process.exitCode = result.error.code === "usage" ? 2 : 1;
    setTimeout(() => process.exit(process.exitCode), 3000).unref();
  });
