// The bridge to the Motor de vídeo (video-render): where it is installed, the exact command lines
// this app sends it, how it is run and how its answers and errors come back. This app never
// imports the Motor's code: it only runs `render.mjs <command> --json` from the project root.
// Copied from the Estúdio de vídeo (video-studio), with `networks` added.

import { spawn } from "node:child_process";
import { join } from "node:path";

import { isFile } from "./files.mjs";
import { AppError, progress, readJson, toPosix } from "./util.mjs";

export const VIDEO_RENDER = "video-render";
export const INSTALL_VIDEO_RENDER = "npx --yes flyee@latest add video-render --yes --json";
/** The `fix` of a missing Motor: one plain sentence to the member, then the install (the core's rule since 1.8.0). */
export const INSTALL_VIDEO_RENDER_FIX = `Diga ao integrante numa frase que vai instalar o app Motor de vídeo, que renderiza e confere as peças, e rode você mesmo ${INSTALL_VIDEO_RENDER} com tempo limite de 10 minutos; depois repita.`;

/** The Motor's capture failures that leave the video without the real brand, but do not stop it. */
export const CAPTURE_ERRORS = ["site_blocked", "site_unreachable", "site_placeholder", "invalid_url", "capture_failed"];

/** Where the Motor lives in the member's project, and whether it is there. */
export function findVideoRender(root) {
  const dir = join(root, ".flyee", "modules", VIDEO_RENDER);
  const script = join(dir, "scripts", "render.mjs");
  const runtime = join(dir, "runtime", "motion.js");
  const installed = isFile(script);
  const manifest = installed ? readJson(join(dir, "flyee.module.json"), {}) : null;
  return {
    installed,
    dir,
    script,
    runtime,
    version: manifest?.version ?? null,
    command: `node ${toPosix(root, script)}`,
  };
}

export function requireVideoRender(root) {
  const engine = findVideoRender(root);
  if (!engine.installed) {
    throw new AppError("video_render_missing", "O Motor de vídeo não está instalado.", INSTALL_VIDEO_RENDER_FIX);
  }
  if (!isFile(engine.runtime)) {
    throw new AppError("video_render_missing", "O Motor de vídeo está incompleto: falta runtime/motion.js.", INSTALL_VIDEO_RENDER_FIX);
  }
  return engine;
}

const text = (value) => String(value);

/**
 * The command lines this app sends the Motor, one builder per command. Paths are given as they
 * should appear on the command line (relative to the project root, with forward slashes).
 */
export const engineArgs = {
  check: () => ["check"],
  help: () => ["help"],
  networks: () => ["networks"],
  capture: ({ url, out }) => ["capture", url, "--out", out],
  music: ({ out, duration, bpm, style, seed, arc = "auto", loop = false }) => [
    "music", "--out", out, "--duration", text(duration), "--bpm", text(bpm), "--style", style, "--seed", text(seed), "--arc", arc,
    ...(loop ? ["--loop"] : []),
  ],
  synth: ({ out, bpm, bars, style, seed }) => ["synth", "--out", out, "--bpm", text(bpm), "--bars", text(bars), "--style", style, "--seed", text(seed)],
  beats: ({ input, out }) => ["beats", input, "--out", out],
  sfx: ({ out, events, duration }) => ["sfx", "--out", out, "--events", events, "--duration", text(duration)],
  preview: ({ page, out, format, fps }) => ["preview", page, "--out", out, "--format", format, "--fps", text(fps), "--scale", "0.5"],
  render: ({ page, out, format, fps, sub = 1 }) => [
    "render", page, "--out", out, "--format", format, "--fps", text(fps),
    ...(sub > 1 ? ["--sub", text(sub)] : []),
  ],
  frames: ({ page, out, beats = null, times = null, scale = 1, format }) => [
    "frames", page, "--out", out, "--format", format,
    ...(beats ? ["--beats", beats] : ["--times", (times ?? [0]).map(text).join(",")]),
    ...(scale && scale !== 1 ? ["--scale", text(scale)] : []),
  ],
  mix: ({ video, out, music = null, musicOffset = 0, sfx = null, fadeOut = 0 }) => [
    "mix", "--video", video, "--out", out,
    ...(music ? ["--music", music] : []),
    ...(music && musicOffset > 0 ? ["--music-offset", text(musicOffset)] : []),
    ...(sfx ? ["--sfx", sfx] : []),
    // the limiter aims half a decibel under the networks' -1 dBTP: the AAC encoder adds a little overshoot
    "--fade-out", text(fadeOut), "--tp", "-1.5",
  ],
  // With the destinations, the safe area is the strictest union of their zones; without them, the format's own zone.
  accept: ({ page, format, beats = null, bpm = null, video = null, networks = null }) => [
    "accept", page, "--format", format, "--safe", networks && networks.length ? "networks" : "instagram-feed",
    ...(beats ? ["--beats", beats] : bpm ? ["--bpm", text(bpm)] : []),
    ...(video ? ["--video", video] : []),
    ...(networks && networks.length ? ["--networks", networks.join(",")] : []),
  ],
  probe: ({ file }) => ["probe", file],
};

/** The JSON the Motor printed, or a stable error when it printed none or answered `ok: false`. */
export function parseEngineOutput(stdout, stderr, { code = 0, command = "?" } = {}) {
  const textOut = String(stdout ?? "");
  const start = textOut.indexOf("{");
  let data = null;
  if (start >= 0) {
    try {
      data = JSON.parse(textOut.slice(start));
    } catch {
      data = null;
    }
  }
  if (!data || typeof data !== "object") {
    const tail = String(stderr ?? "").trim().split(/\r?\n/).filter(Boolean).slice(-3).join(" | ");
    throw new AppError(
      "video_render_failed",
      `O Motor de vídeo não respondeu ao comando ${command} (saída ${code}).`,
      tail ? `Última saída do Motor: ${tail}` : "Rode o check e tente de novo; se repetir, mostre esta mensagem ao integrante.",
    );
  }
  if (data.ok === false) {
    const error = data.error ?? {};
    throw new AppError(error.code ?? "video_render_failed", error.message ?? "O Motor de vídeo devolveu um erro sem mensagem.", error.fix ?? "");
  }
  return data;
}

/**
 * Runs one Motor command from the project root: `node render.mjs <args> --json`, without a
 * shell. Its progress lines (stderr) pass through `onLine` as they come; its JSON (stdout) is
 * the result; an `ok: false` answer becomes an AppError with the Motor's own code, message and fix.
 */
export function runEngine(engine, args, { root = process.cwd(), onLine = progress } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(process.execPath, [engine.script, ...args, "--json"], { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      reject(new AppError("video_render_failed", "Não consegui iniciar o Motor de vídeo.", String(error?.message ?? error)));
      return;
    }
    const stdout = [];
    let stderrTail = "";
    let pending = "";
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderrTail = (stderrTail + chunk).slice(-64 * 1024);
      pending += chunk;
      const lines = pending.split(/\r?\n|\r/);
      pending = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) onLine(line);
    });
    child.on("error", (error) => reject(new AppError("video_render_failed", "Não consegui iniciar o Motor de vídeo.", String(error?.message ?? error))));
    child.on("close", (code) => {
      if (pending.trim()) onLine(pending);
      try {
        resolve(parseEngineOutput(Buffer.concat(stdout).toString("utf8"), stderrTail, { code, command: args[0] }));
      } catch (error) {
        reject(error);
      }
    });
  });
}

const helpTexts = new Map();

/** The Motor's own help text, read once per run; empty when it cannot be read. */
export function engineHelp(engine, { root = process.cwd() } = {}) {
  if (!helpTexts.has(engine.script)) {
    helpTexts.set(
      engine.script,
      runEngine(engine, engineArgs.help(), { root, onLine: () => {} }).then(
        (result) => String(result.text ?? ""),
        () => "",
      ),
    );
  }
  return helpTexts.get(engine.script);
}

/**
 * Whether the installed Motor knows an option such as `--networks`: its help text names every
 * option it takes, so an option that is not there is left out of the command line.
 */
export async function engineSupports(engine, option, { root = process.cwd() } = {}) {
  const help = await engineHelp(engine, { root });
  const escaped = option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\w-])${escaped}(?![\\w-])`).test(help);
}
