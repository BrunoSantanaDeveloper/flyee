#!/usr/bin/env node
// YouTube script: the commands the member's AI runs while writing with the member.
//   node .flyee/modules/youtube-script/scripts/roteiro.mjs <command> [options] [--json]
// The script format is in references/formato.md; the other apps it calls, in references/pesquisa.md
// (youtube-research) and references/tutorial-de-tela.md (video-analysis).

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { scriptDocx } from "./lib/docx.mjs";
import { creatorRules, lint, packagingTitles, PLACEHOLDERS, screenIssues } from "./lib/rules.mjs";
import { chapters, DEFAULT_WPM, parseScript, screenSync, sentences, timing } from "./lib/script.mjs";
import { AppError, choiceOption, formatTime, intOption, parseArgs, projectRoot, readJson, toPosix, writeFileAtomic } from "./lib/util.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(SCRIPTS_DIR, "..");
const ROOT = projectRoot(SCRIPTS_DIR);
const MANIFEST = readJson(join(APP_DIR, "flyee.module.json"), {});
const APP = { name: MANIFEST.name ?? "youtube-script", version: MANIFEST.version ?? "0.0.0" };
const SCRIPTS_FOLDER = "roteiros";
const SCRIPT_COMMAND = `node ${toPosix(ROOT, join(SCRIPTS_DIR, "roteiro.mjs"))}`;
/** The files of a video folder, in the order the work produces them. */
const STAGES = [
  ["briefing.md", "briefing"],
  ["verdade.md", "ficha de verdade"],
  ["pesquisa.md", "pesquisa"],
  ["referencia.md", "mapa da referência"],
  ["gravacao.md", "plano de gravação"],
  ["embalagem.md", "título e thumbnail"],
  ["estrutura.md", "estrutura"],
  ["roteiro.md", "roteiro"],
  ["revisao.md", "revisão"],
  ["teleprompter.txt", "pronto para gravar"],
  ["descricao.md", "pronto para gravar e publicar"],
];
const ARG_SPEC = {
  flags: ["json"],
  options: ["wpm", "target", "format", "out", "dir"],
};

const rel = (path) => toPosix(ROOT, path);
const usage = (message, fix = "Rode o comando `help` para ver as opções.") => new AppError("usage", message, fix);

function scriptsDir(option) {
  return option ? resolve(ROOT, option) : join(ROOT, SCRIPTS_FOLDER);
}

/** The creator's measured pace, written in the channel profile as "Ritmo de fala: 185 palavras por minuto". */
export function profilePace(text) {
  const m = /ritmo[^\n]{0,40}?(\d{2,3})\s*palavras\s+por\s+minuto/i.exec(String(text ?? ""));
  const value = m ? Number(m[1]) : null;
  return value && value >= 90 && value <= 320 ? value : null;
}

/** The lines of the channel profile that the script needs, and their sections. */
const PROFILE_FIELDS = [
  [/^-\s*nicho/im, "nicho e tema"],
  [/^-\s*para quem/im, "para quem"],
  [/^-\s*promessa/im, "promessa do canal"],
  [/^-\s*prova/im, "prova e autoridade"],
  [/^-\s*na primeira pessoa/im, "na primeira pessoa"],
  [/^-\s*teste de miniaturas/im, "teste de miniaturas"],
];

/**
 * What the channel profile still lacks: a field that is missing, empty ("…")
 * or only pending, a voice section without content, and no creator's rules.
 */
export function profileGaps(text) {
  const gaps = [];
  const empty = (value) => !value || /^(…|\.\.\.|-|sim\s*\/\s*n[ãa]o|\[\s*(confirmar|preencher|escolher)\b[^\]]*\])?$/i.test(value.trim());
  for (const [pattern, name] of PROFILE_FIELDS) {
    const line = String(text).split(/\r?\n/).find((candidate) => pattern.test(candidate));
    const value = line?.split(":").slice(1).join(":").replace(/\(.*?\)\s*$/, "");
    if (!line || empty(value)) gaps.push(name);
  }
  const voice = /^##\s+voz\b[^\n]*\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/im.exec(text)?.[1] ?? "";
  if (voice.split(/\r?\n/).filter((line) => line.trim() && !/^</.test(line.trim())).length < 3) gaps.push("voz");
  // The creator's own material: at least one bullet with content under "Histórias e opiniões".
  const stories = /^##\s+hist[óo]rias e opini[õo]es\b[^\n]*\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/im.exec(text)?.[1] ?? "";
  if (!stories.split(/\r?\n/).some((line) => /^\s*[-*]\s+/.test(line) && !empty(line.replace(/^\s*[-*]\s+/, "").replace(/\(.*?\)\s*$/, "")))) gaps.push("histórias e opiniões");
  if (!/^##\s+regras do criador/im.test(text)) gaps.push("regras do criador");
  return gaps;
}

function readProfile(dir) {
  const path = join(dir, "canal.md");
  if (!existsSync(path)) return { path, exists: false, wpm: null, gaps: [] };
  const text = readFileSync(path, "utf8");
  return { path, exists: true, wpm: profilePace(text), gaps: profileGaps(text) };
}

/**
 * A yes/no answer of briefing.md ("O resultado já existe? sim/não: não, …"),
 * as "sim", "não" or null when it is not answered.
 */
export function briefingAnswer(text, question) {
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const m = question.exec(line);
    if (!m) continue;
    let tail = line.slice(m.index + m[0].length);
    const mark = tail.indexOf("?");
    if (mark >= 0) tail = tail.slice(mark + 1);
    tail = tail.replace(/sim\s*\/\s*n[ãa]o/i, "").replace(/^[\s*_:—–-]+/, "");
    const answer = /^(sim|n[ãa]o)(?!\p{L})/iu.exec(tail)?.[1]?.toLowerCase();
    return answer ? (answer === "sim" ? "sim" : "não") : null;
  }
  return null;
}
const OWN_QUESTION = /aparece no v[íi]deo [ée] su[ao]/i;
const RESULT_QUESTION = /resultado j[áa] existe/i;

function briefingOf(file) {
  const path = join(dirname(file), "briefing.md");
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

/** A roteiro.md: a path, or a video folder (or its name under roteiros/) that holds one. */
function resolveScript(input, dirOption) {
  if (!input) throw usage("Informe o roteiro: lint <roteiros/<vídeo>/roteiro.md ou o nome da pasta do vídeo>.");
  const candidates = [resolve(ROOT, input), join(scriptsDir(dirOption), input)];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    if (statSync(candidate).isDirectory()) {
      const file = join(candidate, "roteiro.md");
      if (existsSync(file)) return file;
      continue;
    }
    return candidate;
  }
  throw new AppError("not_found", `Não encontrei o roteiro "${input}".`, "Passe o caminho do roteiro.md ou o nome da pasta do vídeo dentro de roteiros/.");
}

function paceFor(values, file, dirOption) {
  if (values.wpm !== undefined) return { wpm: intOption(values, "wpm", DEFAULT_WPM, 90, 320), from: "option" };
  const nearby = [join(dirname(file), "..", "canal.md"), join(scriptsDir(dirOption), "canal.md")];
  for (const path of nearby) {
    if (!existsSync(path)) continue;
    const wpm = profilePace(readFileSync(path, "utf8"));
    if (wpm) return { wpm, from: "profile" };
  }
  return { wpm: DEFAULT_WPM, from: "default" };
}

/** The creator's rules ("Nunca dizer", "Nunca fazer") from the channel profile next to the script. */
function rulesFor(file, dirOption) {
  const nearby = [join(dirname(file), "..", "canal.md"), join(scriptsDir(dirOption), "canal.md")];
  const path = nearby.find((candidate) => existsSync(candidate));
  return path ? { file: rel(path), ...creatorRules(readFileSync(path, "utf8")) } : { file: null, never_say: [], never_do: [] };
}

/**
 * The titles of embalagem.md next to the script: a title over the platform's
 * 100 characters blocks; the others get their length, and the median length of
 * the outliers when the research measured title traits.
 */
function packagingChecks(file) {
  const path = join(dirname(file), "embalagem.md");
  if (!existsSync(path)) return { titles: null, issues: [] };
  const { titles, unquoted } = packagingTitles(readFileSync(path, "utf8"));
  const issues = [];
  let reference = null;
  const research = join(dirname(file), "pesquisa.md");
  if (existsSync(research)) {
    const id = /youtube-research\/outliers\/([\w.-]+)\//.exec(readFileSync(research, "utf8"))?.[1];
    const measured = id ? readJson(join(ROOT, "youtube-research", "outliers", id, "titulos.json")) : null;
    reference = measured?.length?.median_outliers ?? measured?.length?.median_all ?? null;
  }
  for (const title of titles) {
    const size = [...title].length;
    if (size > 100) issues.push({ rule: "title_too_long", severity: "blocker", excerpt: title, message: `Título com ${size} caracteres: passa do limite de 100 da plataforma.`, fix: "Encurte o título em embalagem.md." });
  }
  if (unquoted) issues.push({ rule: "titles_unreadable", severity: "info", excerpt: "", message: `${unquoted} título(s) de embalagem.md sem aspas: não consegui medir.`, fix: "Escreva cada título entre aspas: 1. \"o título\" · gatilho: …" });
  return { titles: titles.map((title) => ({ title, length: [...title].length })), median_outliers_length: reference, issues };
}

/** "8" or "8:30" or "8min" → seconds. */
function targetSeconds(text) {
  if (text === undefined) return null;
  const t = String(text).trim().toLowerCase().replace(",", ".");
  const clock = /^(\d+):(\d{2})$/.exec(t);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const minutes = /^(\d+(?:\.\d+)?)\s*(min)?$/.exec(t);
  if (minutes) return Math.round(Number(minutes[1]) * 60);
  const seconds = /^(\d+)\s*s$/.exec(t);
  if (seconds) return Number(seconds[1]);
  throw usage(`Duração inválida: "${text}".`, "Use minutos (8, 8.5, 8min), minutos e segundos (8:30) ou segundos (45s).");
}

function lintCommand(positionals, values) {
  const file = resolveScript(positionals[0], values.dir);
  const format = choiceOption(values, "format", "long", ["long", "short"]);
  const pace = paceFor(values, file, values.dir);
  const target_s = targetSeconds(values.target);
  const script = parseScript(readFileSync(file, "utf8"));
  const timed = timing(script, pace.wpm);
  const creator = rulesFor(file, values.dir);
  const own = briefingAnswer(briefingOf(file), OWN_QUESTION) === "sim";
  const checked = lint(script, timed, { target_s, format, banned: creator.never_say, own });
  const packaging = packagingChecks(file);
  const chaptered = chapters(timed);
  const stretches = screenSync(script, pace.wpm);
  for (const issue of screenIssues(stretches)) {
    checked.issues.push(issue);
    checked.summary[issue.severity === "warn" ? "warnings" : "infos"] += 1;
  }
  const note = (issue) => {
    checked.issues.push({ section: null, line: 1, excerpt: "", ...issue });
    checked.summary[{ blocker: "blockers", warn: "warnings", info: "infos" }[issue.severity]] += 1;
  };
  if (format === "long" && !chaptered.valid) {
    note({ rule: "chapters", severity: "info", message: "Os blocos ainda não formam capítulos válidos no YouTube (3 ou mais, de 10 s ou mais).", fix: "Use títulos ## para cada bloco do corpo." });
  }
  for (const issue of packaging.issues) note(issue);
  for (const chapter of chaptered.items.filter((item) => item.internal)) {
    note({ rule: "chapter_name", severity: "info", excerpt: chapter.title, message: `O capítulo "${chapter.title}" tem um nome de trabalho, não um nome para o público.`, fix: "Dê ao bloco um nome que diga o que a pessoa leva ali, como os outros blocos; ele aparece na descrição." });
  }
  // The description ships with the video: nothing pending may go out in it.
  const description = join(dirname(file), "descricao.md");
  if (existsSync(description)) {
    const text = readFileSync(description, "utf8");
    const pending = PLACEHOLDERS.map((pattern) => pattern.exec(text)).find(Boolean);
    if (pending) note({ rule: "description_placeholder", severity: "warn", excerpt: pending[0], message: "A descrição (descricao.md) ainda tem um trecho a completar.", fix: "Peça ao integrante o que falta (um link, um nome) ou avise na entrega que ele completa antes de publicar." });
  }
  const result = {
    ok: true,
    command: "lint",
    file: rel(file),
    title: script.title,
    format,
    wpm: pace.wpm,
    wpm_from: pace.from,
    target_s,
    stats: {
      words: timed.words,
      est_s: timed.est_s,
      est_time: formatTime(timed.est_s),
      sections: timed.sections.length,
      sentences: checked.sentences,
      avg_sentence_words: checked.avg_sentence_words,
    },
    sections: timed.sections.map((section) => ({ ...section, start: formatTime(section.start_s) })),
    chapters: { valid: chaptered.valid, items: chaptered.items.map((chapter) => ({ time: formatTime(chapter.start_s), title: chapter.title })) },
    screen: stretches.length ? { stretches: stretches.length, screen_s: stretches.reduce((total, stretch) => total + stretch.screen_s, 0), items: stretches } : null,
    creator_rules: { file: creator.file, never_say: creator.never_say, never_do: creator.never_do },
    own_product: own,
    pending: script.pending.length,
    titles: packaging.titles,
    median_outliers_title_length: packaging.median_outliers_length ?? null,
    summary: checked.summary,
    ready: checked.summary.blockers === 0,
    issues: checked.issues,
  };
  // A file of the result, for the critic who reads only files.
  if (values.out) {
    const out = resolve(ROOT, values.out);
    writeFileAtomic(out, JSON.stringify(result, null, 2));
    result.saved = rel(out);
  }
  return result;
}

/** Plain text to read on a teleprompter: only what is said, one sentence per line. */
export function teleprompterText(script) {
  const blocks = script.sections
    .filter((section) => section.paragraphs.length)
    .map((section) => section.paragraphs.map((paragraph) => sentences(paragraph.text).join("\n")).join("\n\n"));
  return `${blocks.join("\n\n· · ·\n\n")}\n`;
}

function teleprompterCommand(positionals, values) {
  const file = resolveScript(positionals[0], values.dir);
  const script = parseScript(readFileSync(file, "utf8"));
  if (script.pending.length) {
    const first = script.pending[0];
    throw new AppError("pending_marks", `O roteiro ainda tem ${script.pending.length} marca(s) a preencher, a primeira na linha ${first.line}: ${first.text}.`, "Preencha as marcas com o criador (o checklist lista cada uma), rode o lint de novo e só então gere o teleprompter.");
  }
  const out = values.out ? resolve(ROOT, values.out) : join(dirname(file), "teleprompter.txt");
  const text = teleprompterText(script);
  writeFileAtomic(out, text);
  return { ok: true, command: "teleprompter", file: rel(out), words: timing(script).words };
}

function docxCommand(positionals, values) {
  const file = resolveScript(positionals[0], values.dir);
  const out = values.out ? resolve(ROOT, values.out) : join(dirname(file), "roteiro.docx");
  if (!/\.docx$/i.test(out)) throw usage("O arquivo de saída precisa terminar em .docx.");
  const data = scriptDocx(readFileSync(file, "utf8"));
  writeFileAtomic(out, data);
  return { ok: true, command: "docx", file: rel(out), bytes: data.length };
}

/** Every pending mark ([CONFIRMAR …], [ESCOLHER …]) of a file, with its block and line. */
function pendingMarks(text, source) {
  const items = [];
  let block = null;
  String(text).split(/\r?\n/).forEach((line, index) => {
    if (/^##\s/.test(line.trim())) block = line.trim().replace(/^#+\s+/, "");
    for (const m of line.matchAll(/\[\s*(confirmar|escolher|preencher)\b([^\]]*)\]/gi)) {
      // A bare mark quoted in prose (`[CONFIRMAR]` between backticks) explains the format; it is not a pending item.
      const quoted = (line.slice(0, m.index).match(/`/g) ?? []).length % 2 === 1;
      if (quoted && !/[\p{L}\p{N}]/u.test(m[2])) continue;
      items.push({ source, block, line: index + 1, kind: m[1].toLowerCase(), text: m[0] });
    }
  });
  return items;
}

const ARTICLES = new Set(["o", "a", "os", "as", "um", "uma", "uns", "umas", "meu", "minha", "meus", "minhas"]);

/** The names a video shows (the "## " headings of verdade.md, except the list of what stays out and common objects like "A panela"). */
function toolNames(dir) {
  const path = join(dir, "verdade.md");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => /^##\s/.test(line) && !/fica fora|fora da fala/i.test(line))
    .map((line) => line.replace(/^#+\s+/, "").replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim())
    .filter((name) => {
      if (!name) return false;
      const [first, second = ""] = name.split(/\s+/);
      return !(ARTICLES.has(first.toLowerCase()) && /^\p{Ll}/u.test(second));
    });
}

/**
 * What gravacao.md says to do and record before the speech: the items under
 * its "## O que fazer e gravar antes da fala" (any "## " that speaks of doing,
 * recording or noting, not the map of a finished recording), or else every
 * checkbox of the file.
 */
export function recordingPlan(text) {
  const items = [];
  const boxes = [];
  let inside = false;
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (/^##\s/.test(line)) {
      inside = /fazer|gravar|anotar|antes/i.test(line) && !/mapa/i.test(line);
      continue;
    }
    const m = /^[-*]\s+(\[[ xX]\]\s+)?(.+)$/.exec(line);
    if (!m) continue;
    if (inside) items.push(m[2].trim());
    else if (m[1]) boxes.push(m[2].trim());
  }
  return items.length ? items : boxes;
}

const SHOT = /\[\s*(TELA|B-?ROLL|DEMO|C[ÂA]MERA)\b([^\]]*)\]/gi;
const SHOT_KIND = { TELA: "tela", BROLL: "apoio", "B-ROLL": "apoio", DEMO: "demonstração", CÂMERA: "câmera", CAMERA: "câmera" };

/** The shots the script asks for that still have to be recorded; a [TELA 00:12–00:31] points at a recording that exists. */
function shotsToRecord(script) {
  const seen = new Set();
  const shots = [];
  for (const m of String(script).matchAll(SHOT)) {
    if (/^\s*\d{1,2}:\d{2}/.test(m[2])) continue;
    const description = m[2].replace(/^\s*\d+(?:[.,]\d+)?\s*s(?!\p{L})/iu, "").replace(/^\s*\(estimado\)/i, "").replace(/^\s*:\s*/, "").trim();
    if (!description) continue;
    const key = description.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    shots.push(`${SHOT_KIND[m[1].toUpperCase()] ?? "tela"}: ${description}`);
  }
  return shots;
}

/** The files besides the script and the description whose pending marks the checklist lists. */
const PENDING_SOURCES = [
  ["briefing.md", "briefing"],
  ["verdade.md", "ficha de verdade"],
  ["embalagem.md", "embalagem"],
  ["gravacao.md", "plano de gravação"],
];

/**
 * The checklist in three moments: make and record before writing the speech
 * (when the result does not exist yet), fill every pending mark before the
 * camera, and check what the video exposes before publishing.
 */
export function buildChecklist(dir) {
  const read = (name) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), "utf8") : "");
  const script = read("roteiro.md");
  const resultMissing = briefingAnswer(read("briefing.md"), RESULT_QUESTION) === "não";
  const plan = recordingPlan(read("gravacao.md"));
  // With a recording plan, the shots come from it (the script's marks would repeat them in other words).
  const shots = plan.length ? [] : shotsToRecord(script);
  const inRoteiro = pendingMarks(script, "roteiro");
  const inScript = [...inRoteiro, ...pendingMarks(read("descricao.md"), "descrição")];
  const said = new Set(inScript.map((item) => item.text.toLowerCase()));
  const elsewhere = PENDING_SOURCES.flatMap(([name, source]) => pendingMarks(read(name), source));
  const pending = [...elsewhere.filter((item) => !said.has(item.text.toLowerCase())), ...inScript];
  // The profile's open lines are not needed to record this video: they get their own section.
  const profile = join(dir, "..", "canal.md");
  const profilePending = existsSync(profile) ? pendingMarks(readFileSync(profile, "utf8"), "perfil do canal") : [];
  const tools = toolNames(dir);
  const lines = [`# Checklist: ${basename(dir)}`, ""];
  lines.push("## 1. Fazer e gravar antes da fala", "");
  if (resultMissing && !plan.length) lines.push("- [ ] Fazer o que o vídeo mostra antes de gravar a fala, registrando tudo: gravar, anotar os tempos, as escolhas e o que acontecer de verdade.");
  for (const item of plan.slice(0, 30)) lines.push(`- [ ] ${item}`);
  for (const shot of shots.slice(0, 30)) lines.push(`- [ ] Gravar (${shot})`);
  if (!resultMissing && !plan.length && !shots.length) lines.push("- [x] Nada a fazer antes: o roteiro não depende de uma gravação.");
  lines.push("", "## 2. Antes de gravar a câmera, preencher", "");
  if (!pending.length) lines.push("- [x] Nenhuma marca pendente.");
  for (const item of pending) lines.push(`- [ ] ${item.source}${item.block ? `, bloco "${item.block}"` : ""}, linha ${item.line}: ${item.text}`);
  lines.push(
    "",
    "## 3. Antes de publicar",
    "",
    "- [ ] O que aparece na tela, do computador ou do celular, sem dados pessoais: e-mails, nomes, notificações, conversas, chaves e abas.",
    `- [ ] Legendas automáticas revisadas, com os nomes escritos certo${tools.length ? `: ${tools.join(", ")}` : ""}.`,
    "- [ ] Quadros reais do vídeo nas thumbnails, nunca uma tela montada.",
    "- [ ] Links da descrição abertos e conferidos.",
    "- [ ] Tempos dos capítulos conferidos no vídeo editado.",
  );
  if (profilePending.length) {
    lines.push("", "## Quando puder: o perfil do canal", "");
    for (const item of profilePending) lines.push(`- [ ] ${item.block ? `"${item.block}", ` : ""}linha ${item.line}: ${item.text}`);
  }
  return { text: `${lines.join("\n")}\n`, pending: pending.length, pending_script: inRoteiro.length, pending_other: pending.length - inRoteiro.length, pending_profile: profilePending.length, plan: plan.length, shots: shots.length, result_missing: resultMissing };
}

function videoDirOf(input, dirOption) {
  return dirname(resolveScript(input, dirOption));
}

function checklistCommand(positionals, values) {
  const dir = videoDirOf(positionals[0], values.dir);
  const built = buildChecklist(dir);
  const out = join(dir, "checklist.md");
  writeFileAtomic(out, built.text);
  return { ok: true, command: "checklist", file: rel(out), pending: built.pending, pending_script: built.pending_script, pending_other: built.pending_other, pending_profile: built.pending_profile, plan: built.plan, shots: built.shots, result_missing: built.result_missing };
}

/** One level down for every heading, so a file fits under a section of the full document. */
function demote(text) {
  return String(text)
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line, index) => !(index === 0 && /^#\s/.test(line)))
    .map((line) => (/^#{1,5}\s/.test(line) ? `#${line}` : line))
    .join("\n")
    .trim();
}

const DOCUMENT_SECTIONS = [
  ["briefing.md", "Resumo e premissas"],
  ["verdade.md", "O que aparece no vídeo: a ficha de verdade"],
  ["referencia.md", "O fluxo do vídeo: o mapa da referência"],
  ["embalagem.md", "Título, thumbnail e teste de miniaturas"],
  ["estrutura.md", "Ganchos, estrutura e pontos de retenção"],
  ["gravacao.md", "Plano de gravação"],
  ["roteiro.md", "Roteiro completo"],
  ["descricao.md", "Descrição, capítulos e comentário fixado"],
  ["checklist.md", "Checklist de gravação e publicação"],
  ["revisao.md", "Revisão: as notas da crítica e o que ficou"],
];

/**
 * The whole video in one document, in reading order, for the creator to read,
 * comment and share. With pending marks, it says up front that it is a draft.
 */
export function buildDocument(dir, { pending = 0, other = 0 } = {}) {
  const script = existsSync(join(dir, "roteiro.md")) ? readFileSync(join(dir, "roteiro.md"), "utf8") : "";
  const title = /^#\s+(.+)$/m.exec(script)?.[1]?.trim() ?? basename(dir);
  const parts = [`# Roteiro · ${title}`, ""];
  if (pending || other) parts.push(`> Rascunho: ${pending} marca(s) a preencher no roteiro${other ? ` e ${other} nos outros arquivos` : ""}, antes de gravar. A lista está no checklist, perto do fim.`, "");
  const included = [];
  for (const [name, heading] of DOCUMENT_SECTIONS) {
    const path = join(dir, name);
    if (!existsSync(path)) continue;
    included.push(name);
    parts.push(`## ${heading}`, "", demote(readFileSync(path, "utf8")), "");
  }
  return { text: `${parts.join("\n").trim()}\n`, included };
}

function documentCommand(positionals, values) {
  const dir = videoDirOf(positionals[0], values.dir);
  const checklist = buildChecklist(dir);
  writeFileAtomic(join(dir, "checklist.md"), checklist.text);
  const built = buildDocument(dir, { pending: checklist.pending_script, other: checklist.pending_other });
  const out = values.out ? resolve(ROOT, values.out) : join(dir, "roteiro-completo.md");
  writeFileAtomic(out, built.text);
  return { ok: true, command: "documento", file: rel(out), sections: built.included, pending: checklist.pending };
}

function videoFolders(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const files = readdirSync(join(dir, entry.name));
      const done = STAGES.filter(([file]) => files.includes(file));
      const time = Math.max(0, ...files.map((file) => statSync(join(dir, entry.name, file)).mtimeMs));
      // A file on disk is not the same as done: a script with pending items is not ready to record.
      let blockers = null;
      if (files.includes("roteiro.md")) {
        const script = parseScript(readFileSync(join(dir, entry.name, "roteiro.md"), "utf8"));
        const canal = join(dir, "canal.md");
        const banned = existsSync(canal) ? creatorRules(readFileSync(canal, "utf8")).never_say : [];
        blockers = lint(script, timing(script), { banned }).summary.blockers;
      }
      let stage = done.length ? done[done.length - 1][1] : "vazio";
      if (blockers) stage = `roteiro com ${blockers} pendência(s) antes de gravar`;
      else if (files.includes("roteiro.md") && !files.includes("teleprompter.txt")) stage = files.includes("revisao.md") ? "revisado, falta o teleprompter" : "roteiro escrito, falta a revisão";
      return {
        name: entry.name,
        dir: rel(join(dir, entry.name)),
        stage,
        blockers,
        files: done.map(([file]) => file),
        updated_at: time ? new Date(time).toISOString() : null,
      };
    })
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

/** The other flyee apps this one calls, when installed: research with data and screen recordings. */
function helperApps() {
  const installed = (slug, entry) => existsSync(join(ROOT, ".flyee", "modules", slug, entry));
  return {
    "youtube-research": installed("youtube-research", "scripts/research.mjs"),
    "video-analysis": installed("video-analysis", "scripts/video.mjs"),
  };
}

function checkCommand(values) {
  const dir = scriptsDir(values.dir);
  const profile = readProfile(dir);
  return {
    ok: true,
    command: "check",
    app: APP,
    project: ROOT,
    scripts_dir: rel(dir),
    profile: { file: rel(profile.path), exists: profile.exists, wpm: profile.wpm, gaps: profile.gaps },
    default_wpm: DEFAULT_WPM,
    helpers: helperApps(),
    videos: videoFolders(dir),
  };
}

const HELP = `Roteiro para YouTube: confere o roteiro antes de gravar e prepara o texto para o teleprompter.

Uso: ${SCRIPT_COMMAND} <comando> [opções] [--json]

Comandos
  check                     A pasta dos roteiros, o perfil do canal e em que etapa está cada vídeo.
  lint <roteiro>            Confere o roteiro: abertura, pedidos fora de hora, frases longas, cara de texto de IA,
                            números sem fonte, trechos pendentes, duração por bloco e capítulos.
  teleprompter <roteiro>    Grava o texto falado, uma frase por linha, sem marcações (teleprompter.txt ao lado).
  docx <roteiro>            Grava o roteiro como documento do Word (roteiro.docx ao lado), que também abre no Google Docs.
  checklist <roteiro>       Grava checklist.md: o que fazer e gravar antes, cada [CONFIRMAR] e [ESCOLHER] com o bloco, e o que conferir antes de publicar.
  documento <roteiro>       Junta tudo num documento só (roteiro-completo.md), na ordem de leitura, para ler, comentar e compartilhar.
  help                      Esta ajuda.

<roteiro> é o caminho do roteiro.md ou o nome da pasta do vídeo em ${SCRIPTS_FOLDER}/.

Opções
  --target <duração>        (lint) A duração planejada: 8, 8.5, 8:30 ou 45s; avisa fora de 15% para mais ou menos.
  --format long|short       (lint) Vídeo longo ou Short (padrão: long).
  --wpm N                   (lint) Palavras por minuto; padrão: o do perfil do canal, senão ${DEFAULT_WPM}.
  --out <arquivo>           (teleprompter, docx, documento) Onde gravar; no lint, grava também o resultado em JSON (para a crítica).
  --dir <pasta>             Outra pasta de roteiros (padrão: ${SCRIPTS_FOLDER}).
  --json                    Saída em JSON, para a IA.`;

function humanText(result) {
  if (!result.ok) return [`Erro (${result.error.code}): ${result.error.message}`, result.error.fix && `Como resolver: ${result.error.fix}`].filter(Boolean).join("\n");
  switch (result.command) {
    case "help":
      return result.text;
    case "check":
      return [
        `Roteiro para YouTube ${result.app.version} · roteiros em ${result.scripts_dir}`,
        `Apps parceiros: Pesquisa no YouTube ${result.helpers["youtube-research"] ? "instalado" : "ausente"} · Análise de vídeo ${result.helpers["video-analysis"] ? "instalado" : "ausente"}`,
        `Perfil do canal: ${result.profile.exists ? `${result.profile.file}${result.profile.wpm ? ` (ritmo ${result.profile.wpm} palavras/min)` : ""}${result.profile.gaps.length ? `; falta: ${result.profile.gaps.join(", ")}` : ""}` : "ainda não existe"}`,
        ...result.videos.map((video) => `- ${video.name}: ${video.stage}`),
      ].join("\n");
    case "lint":
      return [
        `${result.file}: ${result.stats.words} palavras, cerca de ${result.stats.est_time} a ${result.wpm} palavras/min. ${result.summary.blockers} bloqueio(s), ${result.summary.warnings} aviso(s), ${result.summary.infos} observação(ões).`,
        ...result.issues.map((issue) => `[${issue.severity}] linha ${issue.line} · ${issue.message}${issue.excerpt ? ` «${issue.excerpt}»` : ""}`),
        `Capítulos: ${result.chapters.items.map((chapter) => `${chapter.time} ${chapter.title}`).join(" · ")}`,
      ].join("\n");
    case "teleprompter":
      return `Texto do teleprompter: ${result.file} (${result.words} palavras).`;
    case "checklist":
      return `Checklist: ${result.file} (${result.pending} marca(s) pendente(s)).`;
    case "documento":
      return `Documento completo: ${result.file} (${result.sections.length} parte(s); ${result.pending} marca(s) pendente(s)).`;
    case "docx":
      return `Documento do Word: ${result.file}.`;
    default:
      return JSON.stringify(result, null, 2);
  }
}

async function main(argv) {
  const [command, ...rest] = argv;
  if (!command || ["help", "--help", "-h"].includes(command)) return { ok: true, command: "help", text: HELP };
  const { positionals, values } = parseArgs(rest, ARG_SPEC);
  switch (command) {
    case "check":
      return checkCommand(values);
    case "lint":
      return lintCommand(positionals, values);
    case "teleprompter":
      return teleprompterCommand(positionals, values);
    case "checklist":
      return checklistCommand(positionals, values);
    case "documento":
      return documentCommand(positionals, values);
    case "docx":
      return docxCommand(positionals, values);
    default:
      throw usage(`Comando desconhecido: ${command}.`, "Comandos: check, lint, teleprompter, docx, checklist, documento, help.");
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const json = process.argv.includes("--json");
  main(process.argv.slice(2))
    .then((result) => process.stdout.write(`${json ? JSON.stringify(result, null, 2) : humanText(result)}\n`))
    .catch((error) => {
      const known = error instanceof AppError;
      const result = {
        ok: false,
        command: process.argv[2] ?? null,
        error: {
          code: known ? error.code : "unexpected",
          message: known ? error.message : `Erro inesperado: ${error?.message ?? error}`,
          fix: known ? error.fix : "Tente de novo; se repetir, guarde esta mensagem.",
        },
      };
      process.stdout.write(`${json ? JSON.stringify(result, null, 2) : humanText(result)}\n`);
      process.exitCode = known && error.code === "usage" ? 2 : 1;
    });
}
