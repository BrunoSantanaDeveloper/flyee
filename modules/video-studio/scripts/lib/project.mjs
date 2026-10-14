// A video in the member's project: the folder layout under estudio-de-video/<slug>/, the state
// file (pedido.json), the member's materials, the page built from a template and the roteiro, the
// copies of the brand files the page uses, and the delivery notes. Everything this app writes
// stays under estudio-de-video/; the member's own files are read where they are and never changed.

import { copyFileSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { basename, extname, isAbsolute, join, resolve } from "node:path";

import { AppError, displayPath, ensureDir, isDir, isFile, readJson, requireJson, sha256File, shortHash, slugify, toPosix, usage, writeFileAtomic, writeJson } from "./util.mjs";

export const STUDIO_DIR = "estudio-de-video";
export const BRANDS_DIR = "marcas";
export const INSTALL_SELF = "npx --yes flyee@latest add video-studio --yes --json";
export const STATE_VERSION = 1;
export const FILES = {
  state: "pedido.json",
  brief: "briefing.md",
  roteiro: "roteiro.json",
  previous: "roteiro.anterior.json",
  page: "pagina.html",
  motion: "motion.js",
  studio: "studio.js",
};
export const DIRS = ["assets", "materiais", "audio", "render", "previa", "entrega"];
/** What `intake --force` removes: everything the script made, never the member's materials. */
const GENERATED = ["briefing.md", "roteiro.json", "roteiro.anterior.json", "pagina.html", "motion.js", "studio.js", "assets", "audio", "render", "previa", "entrega"];
export const ROTEIRO_TOKEN = "__ROTEIRO__";
const HISTORY_LIMIT = 200;

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".avif"];
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"];

export const hashText = (text) => shortHash(text, 64);
export const hashJson = (value) => hashText(JSON.stringify(value));
const fold = (text) => String(text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// ---------------------------------------------------------------------------
// Folders and names
// ---------------------------------------------------------------------------

export function studioDir(root) {
  return join(root, STUDIO_DIR);
}

/** "estudio-de-video/Loja X — lançamento/" → "loja-x-lancamento". */
export function slugOf(arg) {
  if (typeof arg !== "string" || !arg.trim()) throw usage("Informe o nome do vídeo.", "É o nome da pasta em estudio-de-video/; o comando list mostra os vídeos do projeto.");
  const slug = slugify(basename(arg.trim().replace(/[\\/]+$/, "")), 40);
  if (slug === BRANDS_DIR) throw usage(`"${BRANDS_DIR}" é a pasta das marcas guardadas, não um vídeo.`, "Escolha outro nome para o vídeo.");
  return slug;
}

export function videoDir(root, slug) {
  return join(root, STUDIO_DIR, slug);
}

/** Every path of a video folder. */
export function layout(dir, slug = basename(dir)) {
  const paths = { dir, slug };
  for (const [key, name] of Object.entries(FILES)) paths[key] = join(dir, name);
  for (const name of DIRS) paths[name] = join(dir, name);
  return {
    ...paths,
    readme: join(dir, "materiais", "LEIA-ME.txt"),
    music: join(dir, "audio", "trilha.wav"),
    musicBeats: join(dir, "audio", "trilha.beats.json"),
    grid: join(dir, "audio", "batidas.json"),
    events: join(dir, "audio", "eventos.json"),
    sfx: join(dir, "audio", "efeitos.wav"),
    previewSilent: join(dir, "render", "previa-sem-som.mp4"),
    finalSilent: join(dir, "render", "final-sem-som.mp4"),
    preview: join(dir, "previa", "previa.mp4"),
    frames: join(dir, "previa", "quadros"),
    sheet: join(dir, "previa", "quadros", "folha.png"),
    previewReport: join(dir, "previa", "aceite.json"),
    final: join(dir, "entrega", `${slug}.mp4`),
    cover: join(dir, "entrega", "capa.png"),
    coverFrames: join(dir, "entrega", "capa-quadro"),
    notes: join(dir, "entrega", "notas.md"),
    report: join(dir, "entrega", "relatorio.json"),
  };
}

export const isVideo = (dir) => isFile(join(dir, FILES.state));

/** The first free name: the base, then base-2, base-3… (a folder without pedido.json is not a video yet). */
export function freeSlug(root, base) {
  const clean = slugify(base, 40);
  const start = clean === BRANDS_DIR ? `${clean}-video` : clean;
  for (let n = 1; n < 1000; n++) {
    const suffix = n === 1 ? "" : `-${n}`;
    const candidate = `${start.slice(0, 40 - suffix.length).replace(/-+$/, "")}${suffix}`;
    if (!isVideo(videoDir(root, candidate))) return candidate;
  }
  throw new AppError("exists", `Já existem vídeos demais com o nome "${start}".`, "Escolha outro nome com --slug.");
}

/** The videos of the project, newest first. */
export function listVideos(root) {
  const base = studioDir(root);
  if (!isDir(base)) return [];
  const list = [];
  for (const name of readdirSync(base).sort()) {
    if (name === BRANDS_DIR) continue;
    const dir = join(base, name);
    if (!isVideo(dir)) continue;
    const state = readJson(join(dir, FILES.state), null);
    if (state && typeof state === "object") list.push({ slug: name, dir, state });
  }
  return list.sort((a, b) => String(b.state.updated_at ?? "").localeCompare(String(a.state.updated_at ?? "")) || a.slug.localeCompare(b.slug));
}

// ---------------------------------------------------------------------------
// The state (pedido.json)
// ---------------------------------------------------------------------------

export function readState(dir) {
  const state = readJson(join(dir, FILES.state), null);
  return state && typeof state === "object" && !Array.isArray(state) ? state : null;
}

/** The video's folder, paths and state; `video_not_found` when it does not exist. */
export function requireVideo(root, arg, { scriptCommand = "" } = {}) {
  const slug = slugOf(arg);
  const dir = videoDir(root, slug);
  const paths = layout(dir, slug);
  if (!isFile(paths.state)) {
    const list = scriptCommand ? `${scriptCommand} list --json` : "o comando list";
    const start = scriptCommand ? `${scriptCommand} intake --request <arquivo do pedido> --json` : "o comando intake";
    throw new AppError("video_not_found", `Não encontrei o vídeo "${slug}": não existe ${displayPath(root, paths.state)}.`, `Confira o nome com ${list}, ou comece um vídeo novo com ${start}.`);
  }
  const state = requireJson(paths.state, "o pedido.json do vídeo");
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new AppError("invalid_json", `O pedido.json do vídeo "${slug}" não é um objeto JSON.`, "Esse arquivo é do script: não o edite à mão. Comece o vídeo de novo com intake --force se ele estiver corrompido.");
  }
  return { slug, dir, paths, state };
}

/** Writes pedido.json through a temporary file, stamping `updated_at` and appending to `history`. */
export function writeState(dir, state, { now = new Date().toISOString(), step = null, note = "" } = {}) {
  state.updated_at = now;
  if (!Array.isArray(state.history)) state.history = [];
  if (step) {
    state.history.push({ at: now, step, note: String(note ?? "").slice(0, 200) });
    if (state.history.length > HISTORY_LIMIT) state.history = state.history.slice(-HISTORY_LIMIT);
  }
  writeJson(join(dir, FILES.state), state);
  return state;
}

/** Creates the folder of a new video (or clears what the script made in an existing one). */
export function createVideo(dir, { force = false } = {}) {
  ensureDir(dir);
  if (force) for (const name of GENERATED) rmSync(join(dir, name), { recursive: true, force: true });
  ensureDir(join(dir, "materiais"));
  writeReadme(dir);
  return layout(dir);
}

export const README_TEXT = `Materiais deste vídeo
=====================

Coloque nesta pasta os seus arquivos que devem aparecer no vídeo. Tudo aqui é opcional: sem eles, o vídeo usa o que foi encontrado no site da marca.

O que pode entrar
- O logo, em PNG ou SVG, de preferência com fundo transparente. Ponha "logo" no nome do arquivo, por exemplo logo.png.
- Fotos de produto, em PNG, JPG ou WebP. Elas entram na ordem dos nomes: 1-casaco.jpg, 2-bota.jpg.
- Prints de telas que só aparecem depois do login. Ponha "tela" ou "print" no nome, por exemplo tela-agenda.png.
- Uma música sua, em MP3, WAV ou M4A, só se você tiver o direito de usá-la em publicações e anúncios.

Como funciona
- Os arquivos são lidos onde estão e nunca são alterados nem apagados. O vídeo usa cópias, guardadas na pasta do próprio vídeo.
- Depois de colocar ou trocar um arquivo, peça à sua IA para refazer o vídeo.
- Nunca coloque aqui senhas, documentos ou qualquer coisa que não deva aparecer no vídeo.
`;

/** materiais/LEIA-ME.txt: what the member may drop in the folder. Written once, never overwritten. */
export function writeReadme(dir) {
  const file = join(dir, "materiais", "LEIA-ME.txt");
  if (!isFile(file)) writeFileAtomic(file, README_TEXT);
  return file;
}

export function writeBriefing(dir, markdown) {
  const file = join(dir, FILES.brief);
  writeFileAtomic(file, String(markdown ?? "").replace(/\s*$/, "\n"));
  return file;
}

// ---------------------------------------------------------------------------
// This app's own files
// ---------------------------------------------------------------------------

/** The files this app ships that the commands read, copy or fill. */
export function runtimeFiles(appDir) {
  return {
    intake: join(appDir, "scripts", "lib", "intake.mjs"),
    request: join(appDir, "scripts", "lib", "request.mjs"),
    questions: join(appDir, "references", "perguntas.json"),
    roteiros: join(appDir, "references", "roteiros.json"),
    studio: join(appDir, "runtime", "studio.js"),
    template: (id) => join(appDir, "runtime", "templates", `${id}.html`),
  };
}

/** Which of the app's own files are missing, by part: intake, studio, and the templates named. */
export function missingRuntime(appDir, { parts = ["intake", "studio"], templates = [] } = {}) {
  const files = runtimeFiles(appDir);
  const wanted = [];
  if (parts.includes("intake")) wanted.push(files.intake, files.request, files.questions, files.roteiros);
  if (parts.includes("roteiros")) wanted.push(files.roteiros);
  if (parts.includes("studio")) wanted.push(files.studio);
  for (const id of templates) wanted.push(files.template(id));
  return [...new Set(wanted)].filter((file) => !isFile(file)).map((file) => toPosix(appDir, file));
}

export function requireRuntime(appDir, options) {
  const missing = missingRuntime(appDir, options);
  if (missing.length) {
    throw new AppError("runtime_missing", `Faltam arquivos do app Estúdio de vídeo: ${missing.join(", ")}.`, `Reinstale o app: ${INSTALL_SELF}, depois repita.`);
  }
}

// ---------------------------------------------------------------------------
// The member's materials and the page's assets
// ---------------------------------------------------------------------------

/**
 * What the member left in materiais/: the logo (a file with "logo" in its name), screenshots
 * ("tela", "print", "screen" or "captura" in the name), product photos (every other image) and
 * music. Sorted by name, so the same folder always gives the same video. Paths are absolute.
 */
export function scanMaterials(dir) {
  const folder = join(dir, "materiais");
  const found = { dir: folder, logo: null, screens: [], images: [], audio: [], ignored: [] };
  if (!isDir(folder)) return found;
  const names = readdirSync(folder).filter((name) => isFile(join(folder, name))).sort((a, b) => (fold(a) < fold(b) ? -1 : fold(a) > fold(b) ? 1 : a < b ? -1 : a > b ? 1 : 0));
  for (const name of names) {
    const file = join(folder, name);
    const ext = extname(name).toLowerCase();
    const plain = fold(basename(name, extname(name)));
    if (AUDIO_EXTENSIONS.includes(ext)) found.audio.push(file);
    else if (IMAGE_EXTENSIONS.includes(ext)) {
      if (!found.logo && /logo/.test(plain)) found.logo = file;
      else if (/tela|print|screen|captura/.test(plain)) found.screens.push(file);
      else found.images.push(file);
    } else if (name !== "LEIA-ME.txt") found.ignored.push(file);
  }
  return found;
}

const sameFile = (a, b) => {
  try {
    return statSync(a).size === statSync(b).size && sha256File(a) === sha256File(b);
  } catch {
    return false;
  }
};

/** Copies a file only when the destination differs, so an unchanged asset keeps its date. */
function copyIfChanged(source, target) {
  if (isFile(target) && sameFile(source, target)) return false;
  ensureDir(resolve(target, ".."));
  copyFileSync(source, target);
  return true;
}

/** Where a path of the project or of the video folder really is; null when it does not exist. */
function locate(file, { root, dir }) {
  if (!file) return null;
  const candidates = isAbsolute(file) ? [file] : [resolve(dir, file), resolve(root, file)];
  return candidates.find((candidate) => isFile(candidate)) ?? null;
}

/**
 * Copies the planned assets (`[{ key, source, target }]`, targets as `assets/<name>`) into the
 * video folder. A source that no longer exists is reported, never invented.
 */
export function copyAssets({ root, dir, plan }) {
  const copied = [];
  const missing = [];
  for (const item of plan ?? []) {
    const source = locate(item.source, { root, dir });
    if (!source) {
      missing.push({ key: item.key, source: item.source, target: item.target });
      continue;
    }
    copyIfChanged(source, join(dir, item.target));
    copied.push({ key: item.key, source: displayPath(root, source), target: item.target, from: item.from ?? null });
  }
  return { copied, missing };
}

/** An ASCII file name for a copy in assets/, unique among `taken`. */
function assetName(file, taken) {
  const ext = extname(file).toLowerCase();
  const base = slugify(basename(file, extname(file)), 40);
  for (let n = 1; n < 1000; n++) {
    const name = `${base}${n === 1 ? "" : `-${n}`}${ext}`;
    if (!taken.has(name)) return name;
  }
  return `${base}-${shortHash(file)}${ext}`;
}

/**
 * The asset paths of a roteiro the AI edited: `brand.logo` and every scene's `screen` and
 * `image`. A path outside assets/ (a file in materiais/, in capturas/, anywhere in the project)
 * is copied into assets/ under an ASCII name and the roteiro is rewritten to point at the copy.
 * A path that leads nowhere is an error that names the scene and the field.
 */
export function adoptAssets({ root, dir, roteiro }) {
  const assetsDir = join(dir, "assets");
  const taken = new Set(isDir(assetsDir) ? readdirSync(assetsDir) : []);
  const adopted = [];
  const adopt = (value, path) => {
    if (value === undefined || value === null || value === "") return value;
    const clean = String(value).replace(/\\/g, "/");
    if (/^assets\/[^/]+$/.test(clean)) {
      if (!isFile(join(dir, clean))) {
        throw new AppError("file_not_found", `roteiro.json: ${path} aponta para ${clean}, que não existe na pasta do vídeo.`, "Use um arquivo que exista (os de assets/, os de materiais/ ou os de capturas/), ou apague o campo: a cena é desenhada sem a imagem.");
      }
      return clean;
    }
    const source = locate(value, { root, dir });
    if (!source) {
      throw new AppError("file_not_found", `roteiro.json: ${path} aponta para um arquivo que não existe: ${value}.`, "Confira o caminho (relativo à pasta do vídeo ou à raiz do projeto), ou apague o campo: a cena é desenhada sem a imagem.");
    }
    if (!IMAGE_EXTENSIONS.includes(extname(source).toLowerCase())) {
      throw new AppError("file_not_found", `roteiro.json: ${path} precisa ser uma imagem (${IMAGE_EXTENSIONS.join(", ")}): ${value}.`, "Troque por uma imagem, ou apague o campo.");
    }
    const existing = [...taken].find((name) => sameFile(source, join(assetsDir, name)));
    const name = existing ?? assetName(source, taken);
    taken.add(name);
    copyIfChanged(source, join(assetsDir, name));
    adopted.push({ field: path, source: displayPath(root, source), target: `assets/${name}` });
    return `assets/${name}`;
  };
  const copy = { ...roteiro, brand: { ...(roteiro.brand ?? {}) }, scenes: (roteiro.scenes ?? []).map((scene) => ({ ...scene })) };
  if (copy.brand.logo) copy.brand.logo = adopt(copy.brand.logo, "brand.logo");
  copy.scenes.forEach((scene, index) => {
    for (const field of ["screen", "image"]) if (scene[field]) scene[field] = adopt(scene[field], `scenes[${index}].${field}`);
  });
  return { roteiro: copy, adopted };
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

/** The roteiro as it goes inside the page's data block: JSON that cannot close the script element. */
export function roteiroJson(roteiro) {
  return JSON.stringify(roteiro, null, 2).replace(/<\//g, "<\\/").replace(/<!--/g, "\\u003c!--");
}

/** A template with its `__ROTEIRO__` token replaced by the roteiro. */
export function injectRoteiro(template, roteiro) {
  if (!template.includes(ROTEIRO_TOKEN)) {
    throw new AppError("runtime_missing", "O modelo da página não tem o lugar do roteiro.", `Reinstale o app: ${INSTALL_SELF}, depois repita.`);
  }
  return template.split(ROTEIRO_TOKEN).join(roteiroJson(roteiro));
}

const ROTEIRO_BLOCK = /(<script\b[^>]*\bid\s*=\s*["']roteiro["'][^>]*>)([\s\S]*?)(<\/script>)/i;

/** The roteiro a page carries, or null when the block is missing or broken. */
export function readRoteiroBlock(html) {
  const found = ROTEIRO_BLOCK.exec(html);
  if (!found) return null;
  try {
    return JSON.parse(found[2]);
  } catch {
    return null;
  }
}

/**
 * Writes the video page: `pagina.html` from the template of the roteiro (always: a change made by
 * hand to the page lasts until the next build, as the page guide says), `motion.js` copied from the
 * Motor and `studio.js` from this app. `changed` says whether the page on disk was different.
 */
export function buildPage({ dir, appDir, engine, roteiro }) {
  const paths = layout(dir);
  requireRuntime(appDir, { parts: ["studio"], templates: [roteiro.template] });
  const files = runtimeFiles(appDir);
  ensureDir(dir);
  copyIfChanged(engine.runtime, paths.motion);
  copyIfChanged(files.studio, paths.studio);
  const html = injectRoteiro(readFileSync(files.template(roteiro.template), "utf8"), roteiro);
  const changed = !isFile(paths.page) || readFileSync(paths.page, "utf8") !== html;
  if (changed) writeFileAtomic(paths.page, html);
  return { page: paths.page, motion: paths.motion, studio: paths.studio, changed, hash: hashText(html) };
}

/** What decides every frame of the video: the page, the two libraries and the images beside it. */
export function contentHash(dir, { engineVersion = null } = {}) {
  const paths = layout(dir);
  const parts = { engine: engineVersion, files: {} };
  for (const file of [paths.page, paths.motion, paths.studio]) parts.files[basename(file)] = isFile(file) ? sha256File(file) : null;
  if (isDir(paths.assets)) {
    for (const name of readdirSync(paths.assets).sort()) {
      const file = join(paths.assets, name);
      if (isFile(file)) parts.files[`assets/${name}`] = sha256File(file);
    }
  }
  return hashJson(parts);
}

export const fileHash = (file) => (isFile(file) ? sha256File(file) : null);

// ---------------------------------------------------------------------------
// The delivery notes
// ---------------------------------------------------------------------------

const NETWORK_NOTES = {
  reels: { label: "Instagram Reels", how: "publique como Reel e escolha a capa.png como capa. Na grade do perfil a capa aparece cortada no centro." },
  tiktok: { label: "TikTok", how: "envie o mesmo arquivo. O texto do post vai na descrição; a capa pode ser o primeiro quadro." },
  shorts: { label: "YouTube Shorts", how: "envie o mesmo arquivo: vertical e com menos de 3 minutos, o YouTube publica como Short. O título é o texto do post." },
};
const MARKS = { pass: "✓", fail: "✗", warn: "△", skip: "○" };

const decimal = (value, digits = 1) => String(Math.round(Number(value) * 10 ** digits) / 10 ** digits).replace(".", ",");

/** A post text from what the brief already says: the hook, the points and the closing. Nothing new is claimed. */
export function suggestPost({ hook = "", points = [], closing = "", brand = "" } = {}) {
  const lines = [];
  const first = String(hook ?? "").trim();
  if (first) lines.push(/[.!?…]$/.test(first) ? first : `${first}.`);
  const list = (points ?? []).map((point) => String(point ?? "").trim()).filter(Boolean);
  if (list.length) lines.push(list.join(" · "));
  const last = String(closing ?? "").trim() || String(brand ?? "").trim();
  if (last) lines.push(last);
  return lines.join("\n\n");
}

/**
 * entrega/notas.md: which file goes to which network, a suggested post text, where the music
 * came from, what the checks said and what is still the member's decision before publishing.
 */
export function notesMarkdown({ title, files, info = {}, destinations = [], post = "", music = "", checks = [], passed = true, pending = [], warnings = [], generatedAt = null }) {
  const size = info.width && info.height ? `${info.width}×${info.height}` : "1080×1920";
  const lines = [`# ${title}: notas de entrega`, ""];
  if (generatedAt) lines.push(`Gerado em ${String(generatedAt).slice(0, 10)}.`, "");
  lines.push("## Os arquivos", "");
  lines.push(`- Vídeo: \`${files.video}\` (${size}${info.duration ? `, ${decimal(info.duration)} s` : ""}${info.lufs !== null && info.lufs !== undefined ? `, som em ${decimal(info.lufs)} LUFS` : ""})`);
  if (files.cover) lines.push(`- Capa: \`${files.cover}\` (o primeiro quadro do vídeo)`);
  if (files.report) lines.push(`- Relatório da conferência: \`${files.report}\``);
  lines.push("", "## Onde postar", "");
  const networks = (destinations ?? []).filter((id) => NETWORK_NOTES[id]);
  if (!networks.length) lines.push("- O mesmo arquivo serve para Reels, TikTok e Shorts.");
  for (const id of networks) lines.push(`- **${NETWORK_NOTES[id].label}:** ${NETWORK_NOTES[id].how}`);
  lines.push("- O app não publica: você posta pelo aplicativo de cada rede.");
  lines.push("", "## Texto sugerido para o post", "");
  lines.push(post ? post : "Escreva uma frase com o que o vídeo mostra e o que a pessoa deve fazer depois de assistir.");
  lines.push("", "É uma sugestão montada com o que está no briefing; ajuste ao seu jeito de escrever.");
  lines.push("", "## A música", "", music || "Vídeo sem trilha.");
  lines.push("", "## O que a conferência disse", "");
  lines.push(passed ? "Nenhum item reprovado." : "**Há item reprovado.** Corrija e gere o vídeo de novo, ou publique sabendo o que ficou assim:");
  lines.push("");
  for (const item of checks ?? []) lines.push(`- ${MARKS[item.status] ?? "?"} ${item.label ?? item.name}: ${item.summary ?? ""}`.trimEnd());
  if (!(checks ?? []).length) lines.push("- A conferência não devolveu itens.");
  lines.push("", "Legenda: ✓ passou · ✗ reprovou · △ aviso · ○ não medido.");
  if ((warnings ?? []).length) {
    lines.push("", "## Avisos", "");
    for (const warning of warnings) lines.push(`- ${warning}`);
  }
  lines.push("", "## Antes de publicar", "");
  for (const item of pending ?? []) lines.push(`- ${item}`);
  if (!(pending ?? []).length) lines.push("- Nada pendente.");
  lines.push("");
  return lines.join("\n");
}

export { AUDIO_EXTENSIONS, IMAGE_EXTENSIONS };
