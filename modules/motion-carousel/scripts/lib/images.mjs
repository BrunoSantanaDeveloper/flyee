// Images for the slides, by whoever the member already pays for. The order is fixed:
// the Codex CLI with a ChatGPT login (no key, the member's plan), then the Gemini API with the
// optional key the member saved. The member's own AI, when it generates images by itself, comes
// before both and never calls this file: the skill says so. Nothing here asks for, prints or
// writes a key, and nothing opens another program's credentials.

import { spawn } from "node:child_process";
import { copyFileSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, delimiter, dirname, extname, join } from "node:path";

import { AppError, ensureDir, isDir, isFile, readJson, removeDir, round, sha256File, sha256Text, tempDir, WINDOWS, writeJson } from "./util.mjs";

export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
export const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image";
export const GEMINI_KEY_URL = "https://aistudio.google.com/apikey";
export const ASPECTS = ["4:5", "3:4", "1:1", "9:16", "16:9", "3:2", "2:3", "4:3", "5:4", "21:9"];
export const PROVIDERS = ["auto", "codex", "gemini"];
export const OUTPUT_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];
export const KEY_DEFAULTS = { color: "00FF00", similarity: 0.35, blend: 0.1, mode: "colorkey" };

/** Image models like to frame a "photograph" as a print with a white border: every full picture asks against it. */
export const FULL_BLEED_EN = "Full-bleed: the picture fills the whole frame edge to edge, with no border, no frame and no margins.";

const IMAGE_FILE = /\.(png|jpe?g|webp)$/i;
const MIME_BY_EXTENSION = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

// ---------------------------------------------------------------------------
// Running programs
// ---------------------------------------------------------------------------

// ffprobe reads an image's header in a second: two minutes is only reached by a hang
const PROBE_LIMIT_MS = 2 * 60 * 1000;
// ffmpeg converts, cuts out or measures one image in seconds: ten minutes is only reached by a hang
const IMAGE_LIMIT_MS = 10 * 60 * 1000;

/**
 * Ends a program that passed its limit. On Windows taskkill ends it with every process it
 * started; elsewhere it is ended alone, which is all of it for ffmpeg and ffprobe.
 */
function killTree(child) {
  const alone = () => {
    try {
      child.kill("SIGKILL");
    } catch {
      // already gone
    }
  };
  if (!WINDOWS) {
    alone();
    return;
  }
  try {
    const taskkill = spawn(join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe"), ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    taskkill.once("error", alone);
    taskkill.once("exit", (code) => {
      if (code !== 0) alone();
    });
  } catch {
    alone();
  }
}

/** The error of a program that passed its limit: which one and for how long, and what the AI does next. */
export function toolTimeout(file, timeoutMs) {
  const name = basename(String(file)).replace(/\.(exe|com|cmd|bat)$/i, "");
  const seconds = timeoutMs / 1000;
  const limit = seconds < 120 ? `${String(Math.round(seconds * 10) / 10).replace(".", ",")} s` : `${Math.round(seconds / 60)} min`;
  return new AppError("tool_timeout", `O ${name} não terminou em ${limit} e foi interrompido.`, "Tente de novo uma vez. Se travar de novo, use uma imagem menor ou outra imagem.");
}

/** ffmpeg or ffprobe on one image: past `timeoutMs` the program is ended and the call fails with tool_timeout. */
export async function runTool(file, args, timeoutMs) {
  const result = await run(file, args, { timeoutMs });
  if (result.timedOut) throw toolTimeout(file, timeoutMs);
  return result;
}

/**
 * Runs a program without a shell; resolves with the exit code and the output, never rejects on a
 * non-zero exit. Past `timeoutMs` the program is ended (with what it started, on Windows) and the
 * result comes back with `timedOut`.
 */
export function run(file, args, { cwd, env, timeoutMs = 0, input } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(file, args, { cwd, env, windowsHide: true, stdio: [input !== undefined ? "pipe" : "ignore", "pipe", "pipe"] });
    } catch (error) {
      reject(error);
      return;
    }
    const out = [];
    let err = "";
    let timedOut = false;
    const timer = timeoutMs > 0 ? setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs) : null;
    child.stdout.on("data", (chunk) => out.push(chunk));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      err = (err + chunk).slice(-64 * 1024);
    });
    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code, stdout: Buffer.concat(out), stderr: err, timedOut });
    });
    if (input !== undefined) {
      child.stdin.on("error", () => {});
      child.stdin.end(input);
    }
  });
}

/** Folders where installers put programs; an AI opened before an install still has the old PATH. */
function knownFolders() {
  const home = homedir();
  if (!WINDOWS) return ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", join(home, ".local", "bin"), "/snap/bin"];
  const local = process.env.LOCALAPPDATA ?? join(home, "AppData", "Local");
  const folders = [join(local, "Microsoft", "WinGet", "Links"), join(home, "scoop", "shims"), "C:\\ProgramData\\chocolatey\\bin", "C:\\ffmpeg\\bin"];
  try {
    const packages = join(local, "Microsoft", "WinGet", "Packages");
    for (const name of readdirSync(packages)) {
      if (!/ffmpeg/i.test(name)) continue;
      const root = join(packages, name);
      folders.push(root);
      for (const sub of readdirSync(root)) folders.push(join(root, sub, "bin"));
    }
  } catch {
    // no winget, or no packages
  }
  return folders;
}

const pathFolders = (env = process.env) => (env.PATH ?? env.Path ?? "").split(delimiter).map((folder) => folder.replace(/^"|"$/g, "")).filter(Boolean);

/** The absolute path of a program (`.exe` on Windows), from the PATH and the usual install folders, or null. */
export function findExecutable(name, env = process.env) {
  const file = WINDOWS ? `${name}.exe` : name;
  for (const folder of [...pathFolders(env), ...knownFolders()]) {
    const path = join(folder, file);
    if (isFile(path)) return path;
  }
  return null;
}

/** ffmpeg and ffprobe, which the Motor de vídeo already needs on this machine. */
export function findFfmpeg(env = process.env) {
  const ffmpeg = findExecutable("ffmpeg", env);
  let ffprobe = findExecutable("ffprobe", env);
  if (!ffprobe && ffmpeg) {
    const sibling = join(dirname(ffmpeg), WINDOWS ? "ffprobe.exe" : "ffprobe");
    if (isFile(sibling)) ffprobe = sibling;
  }
  return { ffmpeg, ffprobe };
}

function requireFfmpeg(env = process.env) {
  const tools = findFfmpeg(env);
  if (!tools.ffmpeg || !tools.ffprobe) {
    throw new AppError("tools_missing", "Falta o ffmpeg nesta máquina para tratar a imagem.", "Avise o integrante numa frase e rode você mesmo, com tempo limite de 10 minutos: npx --yes flyee@latest need ffmpeg --yes --json, depois repita.");
  }
  return tools;
}

// ---------------------------------------------------------------------------
// The Gemini key (the flyee rule for app keys)
// ---------------------------------------------------------------------------

export function keyStorePath(home = homedir()) {
  return join(home, ".flyee", "keys.json");
}

export function readSavedKey(name, path = keyStorePath()) {
  try {
    const value = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""))?.keys?.[name];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

/**
 * The environment variable first (one that exists but is empty means "no key" and stops the
 * search), then the key saved through the page `npx --yes flyee@latest key set --browser` opens. Read on every run. Never printed.
 */
export function geminiKey(env = process.env, path = keyStorePath()) {
  const fromEnvironment = env.GEMINI_API_KEY;
  if (fromEnvironment !== undefined) return fromEnvironment.trim() ? { key: fromEnvironment.trim(), from: "environment" } : { key: null, from: null };
  const saved = readSavedKey("GEMINI_API_KEY", path);
  return saved ? { key: saved, from: "flyee" } : { key: null, from: null };
}

export const KEY_SET_COMMAND = "npx --yes flyee@latest key set GEMINI_API_KEY --browser --json";

export function keySetup() {
  return {
    key_url: GEMINI_KEY_URL,
    command: KEY_SET_COMMAND,
    how: "Rode você mesmo: o comando volta na hora e abre uma página no navegador do integrante, onde ele cola a chave e clica em Salvar. Ela não passa pela conversa nem pelo terminal.",
    after: "Quando ele disser que salvou, rode check --json de novo: o app enxerga a chave na hora, sem reabrir a IA.",
  };
}

// ---------------------------------------------------------------------------
// The Codex CLI (the member's ChatGPT plan, no key)
// ---------------------------------------------------------------------------

/**
 * How to start the Codex CLI without a shell: a real binary on the PATH, or, when npm installed
 * it on Windows (a `.cmd` shim), the JavaScript entry beside the shim, run with this Node.
 */
export function findCodex(env = process.env) {
  const binary = findExecutable("codex", env);
  if (binary) return { file: binary, prefix: [], path: binary };
  if (WINDOWS) {
    const folders = [...pathFolders(env), join(env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "npm")];
    for (const folder of folders) {
      if (!isFile(join(folder, "codex.cmd"))) continue;
      const entry = join(folder, "node_modules", "@openai", "codex", "bin", "codex.js");
      if (isFile(entry)) return { file: process.execPath, prefix: [entry], path: entry };
    }
  }
  // the Codex app keeps its own copy of the command-line program here, off the PATH
  const bundled = join(codexHome(env), ".sandbox-bin", WINDOWS ? "codex.exe" : "codex");
  if (isFile(bundled)) return { file: bundled, prefix: [], path: bundled };
  return null;
}

/** Installed and logged in? Never throws: a machine without Codex is the common case. */
export async function codexStatus(env = process.env) {
  const codex = findCodex(env);
  if (!codex) return { installed: false, logged_in: false, auth: null, path: null, detail: null };
  try {
    const result = await run(codex.file, [...codex.prefix, "login", "status"], { env, timeoutMs: 20000 });
    const text = `${result.stdout.toString("utf8")}\n${result.stderr}`.trim();
    const loggedIn = result.code === 0 && /logged in/i.test(text) && !/not logged in/i.test(text);
    // with the ChatGPT account the images come from the member's plan; with an API key, from that key's billing
    const auth = !loggedIn ? null : /chatgpt/i.test(text) ? "chatgpt" : /api key/i.test(text) ? "api_key" : "other";
    return { installed: true, logged_in: loggedIn, auth, path: codex.path, detail: text.split(/\r?\n/)[0]?.slice(0, 160) ?? null };
  } catch (error) {
    return { installed: true, logged_in: false, auth: null, path: codex.path, detail: String(error?.message ?? error).slice(0, 160) };
  }
}

export function codexHome(env = process.env) {
  return env.CODEX_HOME?.trim() || join(homedir(), ".codex");
}

/**
 * The request the Codex agent receives: one image from its own tool and nothing else. The tool
 * saves the file in Codex's folder of generated images, where this app picks it up; asking the
 * agent to copy it fails on systems where its sandbox declines the copy.
 */
export function codexPrompt({ prompt, aspect, cutout, reference = false }) {
  const [w, h] = aspect.split(":").map(Number);
  const shape = w === h ? "square" : w < h ? "portrait" : "landscape";
  return [
    "$imagegen Generate exactly ONE image with your built-in image generation tool.",
    `Image: ${prompt}`,
    `Aspect ratio ${aspect} (${shape}).`,
    cutout
      ? "Transparent background: a PNG with a real alpha channel, the whole subject visible with a margin around it, no floor, no shadow on the background."
      : `${FULL_BLEED_EN} No text, no logos, no watermark unless the description asks for them.`,
    reference ? "Use the attached image as the visual reference for subject and style." : "",
    "Do not run shell commands and do not create, copy, move, edit or delete any file yourself: the image tool saves its own file and that is all that is needed.",
    "When the image exists, reply with the single word: done.",
  ].filter(Boolean).join("\n");
}

/** Why a Codex run left no image, from the tail of its output. */
export function classifyCodexFailure(tail, { timedOut = false } = {}) {
  if (timedOut) return new AppError("codex_failed", "O Codex não devolveu a imagem a tempo.", "Tente de novo, ou use --provider gemini.");
  if (/not logged in|login required|unauthorized|\b401\b/i.test(tail)) {
    return new AppError("codex_not_logged_in", "O Codex está instalado, mas sem a conta do ChatGPT conectada.", "O integrante entra na conta dele no Codex; enquanto isso, use --provider gemini ou as fotos dele.");
  }
  if (/usage limit|rate limit|quota|\b429\b/i.test(tail)) return new AppError("codex_quota", "O plano do ChatGPT do integrante atingiu o limite por agora.", "Tente mais tarde, ou use --provider gemini.");
  return new AppError("codex_failed", "O Codex terminou sem gerar a imagem (nesta instalação a ferramenta de imagem dele pode não estar disponível).", tail ? `Última saída do Codex: ${tail}` : "Use --provider gemini, ou peça as fotos ao integrante.");
}

/** A model or configuration the installed Codex does not accept: worth one more try without the member's own configuration. */
export const codexConfigRejected = (tail) => /model is not supported|invalid_request_error|unknown model|unsupported model|failed to (load|parse) config/i.test(tail);

/** Image files changed at or after `since` (ms) under a folder, newest first. */
export function newImages(dir, since, depth = 3) {
  const found = [];
  const walk = (folder, level) => {
    let names;
    try {
      names = readdirSync(folder);
    } catch {
      return;
    }
    for (const name of names) {
      const path = join(folder, name);
      let info;
      try {
        info = statSync(path);
      } catch {
        continue;
      }
      if (info.isDirectory()) {
        if (level < depth) walk(path, level + 1);
      } else if (IMAGE_FILE.test(name) && info.mtimeMs >= since - 1000 && info.size > 1024) found.push({ path, mtime: info.mtimeMs, size: info.size });
    }
  };
  walk(dir, 0);
  return found.sort((a, b) => b.mtime - a.mtime);
}

/**
 * Asks the Codex CLI for one image and returns a copy of the file its image tool left in Codex's
 * own folder of generated images. The agent runs read-only in an empty temporary folder. When
 * the member's Codex configuration names a model this Codex does not accept, one more try runs
 * without that configuration (the login is kept).
 */
export async function generateWithCodex({ prompt, aspect, cutout = false, reference = null, auth = null, env = process.env, timeoutMs = 10 * 60 * 1000, onProgress = () => {} }) {
  const codex = findCodex(env);
  if (!codex) throw new AppError("codex_missing", "O Codex não está instalado nesta máquina.", "Use --provider gemini com a chave do Gemini, ou peça as fotos ao integrante.");
  const work = tempDir("flyee-carousel-codex-");
  const images = join(codexHome(env), "generated_images");
  const request = codexPrompt({ prompt, aspect, cutout, reference: Boolean(reference) });
  try {
    let failure = null;
    for (const ignoreConfig of [false, true]) {
      const started = Date.now();
      const args = [...codex.prefix, "exec", ...(ignoreConfig ? ["--ignore-user-config"] : []), "--skip-git-repo-check", "--sandbox", "read-only", "--cd", work];
      if (reference) args.push("--image", reference);
      args.push(request);
      const billing = auth === "api_key" ? "cobrada na chave de API da OpenAI conectada ao Codex" : auth === "chatgpt" ? "usa o plano do ChatGPT do integrante" : "usa a conta do Codex do integrante";
      onProgress(ignoreConfig ? "O Codex recusou o modelo da configuração do integrante; tentando com o modelo padrão dele…" : `Pedindo a imagem ao Codex (${billing}; pode levar alguns minutos)…`);
      const result = await run(codex.file, args, { cwd: work, env, timeoutMs });
      const candidates = [...newImages(images, started, 3), ...newImages(work, started, 2)];
      if (candidates.length) {
        const kept = join(tempDir("flyee-carousel-image-"), `codex${extname(candidates[0].path).toLowerCase() || ".png"}`);
        copyFileSync(candidates[0].path, kept);
        return { file: kept, mime: MIME_BY_EXTENSION[extname(kept).toLowerCase()] ?? "image/png", provider: "codex", model: null, usage: null, cleanup: dirname(kept), ignored_config: ignoreConfig };
      }
      const output = `${result.stderr}\n${result.stdout.toString("utf8")}`;
      const tail = output.trim().split(/\r?\n/).filter((line) => line.trim() && !/failed to renew cache TTL/.test(line)).slice(-3).join(" | ").slice(0, 400);
      failure = classifyCodexFailure(tail, { timedOut: result.timedOut });
      if (ignoreConfig || result.timedOut || failure.code !== "codex_failed" || !codexConfigRejected(output)) break;
    }
    throw failure;
  } finally {
    removeDir(work);
  }
}

// ---------------------------------------------------------------------------
// The Gemini API (the member's optional key)
// ---------------------------------------------------------------------------

/** The cut-out suffix: a flat studio background of the key colour, which ffmpeg removes afterwards. */
export function cutoutSuffix(color = KEY_DEFAULTS.color) {
  const named = color.toUpperCase() === "00FF00" ? "pure green" : color.toUpperCase() === "0000FF" ? "pure blue" : "solid";
  return `, isolated on a flat ${named} (#${color.toUpperCase()}) studio background, no floor, no contact shadow, no reflections, the whole subject visible with margins around it, even studio light`;
}

export function geminiRequest({ prompt, aspect, model = GEMINI_IMAGE_MODEL, reference = null, cutout = false, keyColor = KEY_DEFAULTS.color, baseUrl = GEMINI_BASE_URL }) {
  const parts = [{ text: cutout ? `${prompt}${cutoutSuffix(keyColor)}` : `${prompt}. ${FULL_BLEED_EN}` }];
  if (reference) parts.push({ inlineData: { mimeType: reference.mime, data: reference.data } });
  return {
    url: `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    body: { contents: [{ parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: aspect } } },
  };
}

function readError(body) {
  try {
    const data = typeof body === "string" ? JSON.parse(body) : body;
    return data?.error ?? data?.[0]?.error ?? {};
  } catch {
    return { message: String(body ?? "").slice(0, 300) };
  }
}

/** A stable code and guidance for each API failure. The key never appears in a message. */
export function classifyGeminiError(status, body) {
  const error = readError(body);
  const message = String(error.message ?? "").slice(0, 300);
  const detail = message ? `Resposta do Gemini: ${message}` : `HTTP ${status}`;
  if (/API key not valid|API_KEY_INVALID|api key expired/i.test(message + JSON.stringify(error.details ?? ""))) {
    return new AppError("gemini_invalid_key", "A chave do Gemini não foi aceita.", `O integrante confere a chave no Google AI Studio e a salva de novo pela página que \`${KEY_SET_COMMAND}\` abre.`);
  }
  if (status === 429) return new AppError("gemini_quota", "O limite de uso da chave do Gemini foi atingido por agora.", `Espere e tente de novo, ou use as fotos do integrante. ${detail}`);
  if (status === 403) return new AppError("gemini_permission", "A chave do Gemini não tem permissão para gerar imagens.", detail);
  if (status === 404) return new AppError("gemini_model_not_found", "O modelo de imagem pedido não existe ou não está liberado para esta chave.", `Tente sem --model. ${detail}`);
  if (status >= 500) return new AppError("gemini_unavailable", "A API do Gemini está instável agora.", `Tente de novo em alguns minutos. ${detail}`);
  return new AppError("gemini_failed", "O Gemini recusou o pedido da imagem.", detail);
}

/** The image of a `generateContent` answer: the first part with inline data, among text and thought parts. */
export function parseGeminiImage(json) {
  const candidate = json?.candidates?.[0];
  const part = (candidate?.content?.parts ?? []).find((item) => item?.inlineData?.data);
  if (!part) {
    const reason = json?.promptFeedback?.blockReason ?? candidate?.finishReason ?? "sem imagem";
    const said = (candidate?.content?.parts ?? []).map((item) => item?.text).filter(Boolean).join(" ").slice(0, 200);
    throw new AppError("gemini_refused", "O Gemini não devolveu uma imagem para este pedido.", `Reescreva a descrição (motivo: ${reason}${said ? `; ele disse: ${said}` : ""}).`);
  }
  const usage = json.usageMetadata ? { input_tokens: json.usageMetadata.promptTokenCount ?? null, output_tokens: json.usageMetadata.candidatesTokenCount ?? null } : null;
  return { bytes: Buffer.from(part.inlineData.data, "base64"), mime: part.inlineData.mimeType ?? "image/jpeg", usage };
}

export async function generateWithGemini({ key, prompt, aspect, model = GEMINI_IMAGE_MODEL, reference = null, cutout = false, keyColor = KEY_DEFAULTS.color, baseUrl = GEMINI_BASE_URL, timeoutMs = 3 * 60 * 1000, onProgress = () => {}, fetchImpl = fetch }) {
  if (!key) throw new AppError("no_gemini_key", "Sem a chave do Gemini, o app não gera imagens por este caminho.", `Salve a chave pela página que \`${KEY_SET_COMMAND}\` abre, ou use as fotos do integrante.`);
  const referencePart = reference ? { mime: MIME_BY_EXTENSION[extname(reference).toLowerCase()] ?? "image/png", data: readFileSync(reference).toString("base64") } : null;
  const request = geminiRequest({ prompt, aspect, model, reference: referencePart, cutout, keyColor, baseUrl });
  onProgress(`Pedindo a imagem ao Gemini (${model})…`);
  let response;
  try {
    response = await fetchImpl(request.url, { method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify(request.body), signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw new AppError("offline", "Não consegui falar com a API do Gemini.", String(error?.message ?? error).slice(0, 200));
  }
  const text = await response.text();
  if (response.status >= 400) throw classifyGeminiError(response.status, text);
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AppError("gemini_failed", "O Gemini devolveu uma resposta que não consegui ler.", text.slice(0, 200));
  }
  const image = parseGeminiImage(json);
  const dir = tempDir("flyee-carousel-image-");
  const file = join(dir, `gemini${image.mime === "image/png" ? ".png" : image.mime === "image/webp" ? ".webp" : ".jpg"}`);
  writeFileSync(file, image.bytes);
  return { file, mime: image.mime, provider: "gemini", model, usage: image.usage, cleanup: dir };
}

// ---------------------------------------------------------------------------
// Treating the image: size, format, cut-out
// ---------------------------------------------------------------------------

export async function probeImage(ffprobe, file) {
  const result = await runTool(ffprobe, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,pix_fmt", "-of", "json", file], PROBE_LIMIT_MS);
  if (result.code !== 0) throw new AppError("unreadable_image", `Não consegui ler a imagem ${basename(file)}.`, result.stderr.trim().split(/\r?\n/).slice(-2).join(" "));
  const stream = JSON.parse(result.stdout.toString("utf8") || "{}").streams?.[0] ?? {};
  return { width: stream.width ?? null, height: stream.height ?? null, has_alpha: /yuva|rgba|argb|bgra|gbrap|ya8|pal8/.test(stream.pix_fmt ?? "") };
}

/** Mean of the alpha plane (0–255) through ffmpeg; 255 when the image has no alpha. */
export async function alphaMean(ffmpeg, file) {
  const result = await runTool(ffmpeg, ["-hide_banner", "-i", file, "-vf", "format=rgba,alphaextract,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-", "-frames:v", "1", "-f", "null", "-"], IMAGE_LIMIT_MS);
  // ffmpeg prints small numbers in scientific notation: an almost empty cut-out is 3.2e-05, not 3.2
  const match = /YAVG=([\d.]+(?:e[-+]?\d+)?)/i.exec(`${result.stdout.toString("utf8")}\n${result.stderr}`);
  return match ? Number(match[1]) : null;
}

export function keyFilter({ color = KEY_DEFAULTS.color, similarity = KEY_DEFAULTS.similarity, blend = KEY_DEFAULTS.blend, mode = KEY_DEFAULTS.mode, despill = true } = {}) {
  const key = mode === "chromakey" ? `chromakey=0x${color}:${similarity}:${blend}` : `format=rgba,colorkey=0x${color}:${similarity}:${blend}`;
  return despill ? `${key},despill=type=${color.toUpperCase() === "0000FF" ? "blue" : "green"}` : key;
}

const encoderArgs = (out) => {
  const ext = extname(out).toLowerCase();
  if (ext === ".webp") return ["-c:v", "libwebp", "-q:v", "82"];
  if (ext === ".png") return ["-c:v", "png"];
  return ["-q:v", "3"];
};

/** Writes `out` from `input`: converts the format and, with `key`, removes the flat background first. */
export async function writeImage({ ffmpeg, input, out, key = null }) {
  ensureDir(dirname(out));
  const attempt = async (filter) => runTool(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", input, ...(filter ? ["-vf", filter] : []), "-frames:v", "1", ...encoderArgs(out), out], IMAGE_LIMIT_MS);
  const warnings = [];
  let result = await attempt(key ? keyFilter(key) : null);
  if (result.code !== 0 && key) {
    result = await attempt(keyFilter({ ...key, despill: false }));
    if (result.code === 0) warnings.push("Este ffmpeg não tem o filtro de limpeza da cor do fundo: pode sobrar um contorno esverdeado no recorte.");
  }
  if (result.code !== 0) throw new AppError("ffmpeg_failed", "O ffmpeg não conseguiu gravar a imagem.", result.stderr.trim().split(/\r?\n/).slice(-2).join(" "));
  return warnings;
}

// ---------------------------------------------------------------------------
// The whole request
// ---------------------------------------------------------------------------

/** Which provider `auto` picks, and what to tell the AI when none is available. */
export function pickProvider(requested, { codex, gemini }) {
  if (requested === "codex") return codex.installed && codex.logged_in ? ["codex"] : [];
  if (requested === "gemini") return gemini ? ["gemini"] : [];
  const order = [];
  // the automatic order uses Codex through the member's ChatGPT plan; logged in with an API key it
  // would bill each image to that key, so it is used only when asked for by name (--provider codex)
  if (codex.installed && codex.logged_in && codex.auth !== "api_key") order.push("codex");
  if (gemini) order.push("gemini");
  return order;
}

export function noProviderError(requested, { codex }) {
  if (requested === "codex") {
    return codex.installed
      ? new AppError("codex_not_logged_in", "O Codex está instalado, mas sem a conta do ChatGPT conectada.", "O integrante entra na conta dele no Codex; ou use --provider gemini, ou as fotos dele.")
      : new AppError("codex_missing", "O Codex não está instalado nesta máquina.", "Use --provider gemini com a chave do Gemini, ou as fotos do integrante.");
  }
  if (requested === "gemini") {
    return new AppError("no_gemini_key", "Sem a chave do Gemini, o app não gera imagens por este caminho.", `A chave é opcional, se cria com a conta Google do integrante em ${GEMINI_KEY_URL}, e o Google não cobra por ela no uso comum. Rode você mesmo: ${KEY_SET_COMMAND}, que volta na hora e abre uma página no navegador do integrante para ele colar a chave; quando ele disser que salvou, repita.`);
  }
  return new AppError(
    "no_image_provider",
    "Nesta máquina o app não tem como gerar imagens: não há Codex com a conta do ChatGPT conectada nem chave do Gemini salva.",
    `Siga a ordem: (1) se você mesmo gera imagens, gere e salve o arquivo em assets/ do carrossel; (2) se o integrante quiser, rode você mesmo ${KEY_SET_COMMAND} (abre uma página no navegador dele; a chave se cria em ${GEMINI_KEY_URL}, e o Google não cobra por ela no uso comum) e repita quando ele disser que salvou; (3) peça as fotos dele e salve em assets/; (4) ou siga no estilo gráfico, sem fotos.`,
  );
}

export function sidecarPath(out) {
  return `${out}.json`;
}

export function requestHash({ prompt, aspect, cutout, provider, model, reference, key }) {
  return sha256Text(JSON.stringify({ prompt, aspect, cutout: Boolean(cutout), provider, model: model ?? null, reference: reference && isFile(reference) ? sha256File(reference) : null, key: cutout ? key : null }));
}

/**
 * Generates one image into `out` (a path inside the carousel folder). Returns what happened;
 * the same request is served from the file already there unless `refresh`.
 */
export async function generateImage({ out, prompt, aspect = "4:5", provider = "auto", model = null, reference = null, cutout = false, key = KEY_DEFAULTS, refresh = false, env = process.env, onProgress = () => {}, deps = {} }) {
  const ext = extname(out).toLowerCase();
  if (!OUTPUT_EXTENSIONS.includes(ext)) throw new AppError("usage", `A saída precisa ser .png, .jpg ou .webp: ${basename(out)}.`, "Recortes pedem .png ou .webp, que guardam transparência.");
  if (cutout && ![".png", ".webp"].includes(ext)) throw new AppError("usage", "Um recorte precisa de transparência: use .png ou .webp na saída.", `Por exemplo: --out assets/${basename(out, ext)}.png.`);
  if (!ASPECTS.includes(aspect)) throw new AppError("usage", `Proporção desconhecida: ${aspect}.`, `Use ${ASPECTS.join(", ")}.`);
  if (!PROVIDERS.includes(provider)) throw new AppError("usage", `Provedor desconhecido: ${provider}.`, `Use ${PROVIDERS.join(", ")}.`);
  if (reference && !isFile(reference)) throw new AppError("file_not_found", `Não encontrei a imagem de referência: ${reference}.`);

  const hash = requestHash({ prompt, aspect, cutout, provider, model, reference, key });
  const sidecar = sidecarPath(out);
  const previous = readJson(sidecar, null);
  const tools = (deps.requireFfmpeg ?? requireFfmpeg)(env);
  if (!refresh && previous?.hash === hash && isFile(out)) {
    const info = await probeImage(tools.ffprobe, out);
    return { ...previous.result, width: info.width, height: info.height, cached: true, warnings: [] };
  }

  const status = { codex: await (deps.codexStatus ?? codexStatus)(env), gemini: Boolean(geminiKey(env, deps.keyStore).key) };
  const order = pickProvider(provider, status);
  if (!order.length) throw noProviderError(provider, status);

  const warnings = [];
  let made = null;
  let lastError = null;
  for (const name of order) {
    try {
      made = name === "codex"
        ? await (deps.generateWithCodex ?? generateWithCodex)({ prompt, aspect, cutout, reference, auth: status.codex.auth ?? null, env, onProgress })
        : await (deps.generateWithGemini ?? generateWithGemini)({ key: geminiKey(env, deps.keyStore).key, prompt, aspect, model: model ?? GEMINI_IMAGE_MODEL, reference, cutout, keyColor: key.color, onProgress });
      break;
    } catch (error) {
      lastError = error;
      if (!(error instanceof AppError)) throw error;
      if (order.indexOf(name) < order.length - 1) warnings.push(`O ${name === "codex" ? "Codex" : "Gemini"} não gerou a imagem (${error.message}); segui para o próximo caminho.`);
    }
  }
  if (!made) throw lastError;

  try {
    // Codex is asked for a real alpha channel; Gemini paints a flat key colour that is removed here
    const keyed = cutout && made.provider === "gemini";
    warnings.push(...(await writeImage({ ffmpeg: tools.ffmpeg, input: made.file, out, key: keyed ? key : null })));
  } finally {
    if (made.cleanup) removeDir(made.cleanup);
  }
  const info = await probeImage(tools.ffprobe, out);
  let cut = null;
  if (cutout) {
    const mean = await alphaMean(tools.ffmpeg, out);
    const ratio = mean === null ? null : round(1 - mean / 255, 3);
    cut = { method: made.provider === "gemini" ? key.mode : "alpha", color: made.provider === "gemini" ? key.color : null, similarity: made.provider === "gemini" ? key.similarity : null, blend: made.provider === "gemini" ? key.blend : null, alpha_mean: mean === null ? null : round(mean, 2), transparent_ratio: ratio };
    if (ratio !== null && ratio < 0.3) warnings.push(`O recorte ficou com pouca transparência (${Math.round(ratio * 100)}% do quadro): o fundo não saiu. Olhe a imagem e repita com --refresh${made.provider === "gemini" ? " (ou aumente --key-similarity)" : ""}.`);
    if (ratio !== null && ratio > 0.97) warnings.push("O recorte ficou quase todo transparente: o assunto pode ter sido apagado junto com o fundo. Olhe a imagem e repita com --refresh.");
  }
  const result = { provider: made.provider, model: made.model, mime: MIME_BY_EXTENSION[ext], aspect, width: info.width, height: info.height, cutout: cut, usage: made.usage };
  writeJson(sidecar, { hash, prompt, aspect, provider: made.provider, model: made.model, cutout: Boolean(cutout), generated_at: new Date().toISOString(), result });
  return { ...result, cached: false, warnings };
}

/** What `check` says about images: who can generate them here, in the order the app uses. */
export async function imageStatus(env = process.env, deps = {}) {
  const codex = await (deps.codexStatus ?? codexStatus)(env);
  const key = geminiKey(env, deps.keyStore);
  const order = pickProvider("auto", { codex, gemini: Boolean(key.key) });
  return {
    order: ["a própria IA, quando ela gera imagens", "codex", "gemini", "fotos do integrante", "sem fotos"],
    codex: { installed: codex.installed, logged_in: codex.logged_in, auth: codex.auth ?? null },
    gemini_key: Boolean(key.key),
    gemini_key_from: key.from,
    gemini_setup: key.key ? null : keySetup(),
    available: order,
    model_default: GEMINI_IMAGE_MODEL,
    assets_hint: isDir ? "As fotos e imagens de um carrossel ficam em carrosseis/<nome>/assets/." : null,
  };
}
