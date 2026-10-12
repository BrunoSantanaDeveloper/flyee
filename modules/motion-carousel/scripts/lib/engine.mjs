// The bridge to the Motor de vídeo (video-render): where it is installed, the exact command lines
// this app sends it, how it is run and how its answers and errors come back.

import { spawn } from "node:child_process";
import { join } from "node:path";

import { AppError, isFile, progress, readJson, toPosix } from "./util.mjs";

export const VIDEO_RENDER = "video-render";
export const INSTALL_VIDEO_RENDER = "npx flyee add video-render --yes --json";

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
    throw new AppError("video_render_missing", "O Motor de vídeo não está instalado.", `Rode você mesmo: ${INSTALL_VIDEO_RENDER}, depois repita.`);
  }
  if (!isFile(engine.runtime)) {
    throw new AppError("video_render_missing", "O Motor de vídeo está incompleto: falta runtime/motion.js.", `Reinstale o app: ${INSTALL_VIDEO_RENDER}, depois repita.`);
  }
  return engine;
}

/** The command lines this app sends the Motor, one builder per command. Paths are given as they should appear. */
export const engineArgs = {
  check: () => ["check"],
  synth: ({ out, bpm, bars, style, seed, introBars = 0, beatsPerBar = 4 }) => [
    "synth", "--out", out, "--bpm", String(bpm), "--bars", String(bars), "--style", style, "--seed", String(seed), "--intro-bars", String(introBars),
    ...(beatsPerBar !== 4 ? ["--beats-per-bar", String(beatsPerBar)] : []),
  ],
  beats: ({ input, out, bpm = null }) => ["beats", input, "--out", out, ...(bpm ? ["--bpm", String(bpm)] : [])],
  sfx: ({ out, events }) => ["sfx", "--out", out, "--events", events],
  render: ({ page, out, format, fps, sub = 1, preview = false }) => [
    preview ? "preview" : "render", page, "--out", out, "--format", format, "--fps", String(fps),
    ...(!preview && sub > 1 ? ["--sub", String(sub)] : []),
  ],
  mix: ({ video, out, music, musicOffset = 0, sfx = null }) => [
    "mix", "--video", video, "--out", out, "--music", music, "--music-offset", String(musicOffset),
    ...(sfx ? ["--sfx", sfx] : []), "--fade-out", "0",
  ],
  // The dead time of a slide is measured by the mean of the frame: the ruler head, the swipe hint and
  // the glow move all the time and would keep any stretch "alive"; the rule here is a big gesture.
  accept: ({ page, format, beats = null, bpm = null, video = null, minText = 44 }) => [
    "accept", page, "--format", format, "--safe", "instagram-carousel", "--loop",
    ...(beats ? ["--beats", beats] : ["--bpm", String(bpm)]), "--min-text", String(minText),
    ...(video ? ["--video", video, "--still-by", "mean"] : []),
  ],
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
      tail ? `Última saída do Motor: ${tail}` : "Rode o check do Motor de vídeo e tente de novo; se repetir, mostre esta mensagem ao integrante.",
    );
  }
  if (data.ok === false) {
    const error = data.error ?? {};
    throw new AppError(error.code ?? "video_render_failed", error.message ?? "O Motor de vídeo devolveu um erro sem mensagem.", error.fix ?? "");
  }
  return data;
}

/**
 * Runs one Motor command from the project root: `node render.mjs <args> --json`. Its progress
 * lines (stderr) pass through `onLine` as they come; its JSON (stdout) is the result; an
 * `ok: false` answer becomes an AppError with the Motor's own code, message and fix.
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
