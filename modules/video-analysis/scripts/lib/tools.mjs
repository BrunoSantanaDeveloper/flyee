// Finds ffmpeg, ffprobe and yt-dlp on the member's machine without relying on an up-to-date PATH.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";

import { run } from "./util.mjs";

const WINDOWS = process.platform === "win32";
const MAC = process.platform === "darwin";

/**
 * Folders where installers usually put the programs. An AI started before the
 * install inherits the old PATH; looking here avoids asking for a restart.
 */
function knownFolders() {
  const home = homedir();
  if (!WINDOWS) return ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", join(home, ".local", "bin"), "/snap/bin"];
  const local = process.env.LOCALAPPDATA ?? join(home, "AppData", "Local");
  const folders = [
    join(local, "Microsoft", "WinGet", "Links"),
    join(home, "scoop", "shims"),
    "C:\\ProgramData\\chocolatey\\bin",
    "C:\\ffmpeg\\bin",
    join(process.env.ProgramFiles ?? "C:\\Program Files", "ffmpeg", "bin"),
  ];
  const packages = join(local, "Microsoft", "WinGet", "Packages");
  try {
    for (const name of readdirSync(packages)) {
      if (!/ffmpeg|yt-dlp/i.test(name)) continue;
      const root = join(packages, name);
      folders.push(root);
      for (const sub of readdirSync(root)) folders.push(join(root, sub, "bin"));
    }
  } catch {
    // no winget, or no packages
  }
  return folders;
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** Absolute path of an executable, or null. On Windows only `.exe`: a `.cmd` would need a shell. */
export function findExecutable(name) {
  const fromPath = (process.env.PATH ?? "").split(delimiter).map((folder) => folder.replace(/^"|"$/g, "")).filter(Boolean);
  const file = WINDOWS ? `${name}.exe` : name;
  for (const folder of [...fromPath, ...knownFolders()]) {
    const path = join(folder, file);
    if (isFile(path)) return path;
  }
  return null;
}

async function firstLine(file, args) {
  try {
    const { code, stdout } = await run(file, args);
    if (code !== 0) return null;
    return stdout.toString("utf8").split(/\r?\n/)[0].trim() || null;
  } catch {
    return null;
  }
}

/** yt-dlp as a program or, when installed with pip, as a Python module. */
async function findYtdlp() {
  const candidates = [];
  const binary = findExecutable("yt-dlp");
  if (binary) candidates.push({ file: binary, prefix: [] });
  const pythons = WINDOWS ? [["py", ["-3"]], ["python", []], ["python3", []]] : [["python3", []], ["python", []]];
  for (const [name, extra] of pythons) {
    const path = findExecutable(name);
    if (path) candidates.push({ file: path, prefix: [...extra, "-m", "yt_dlp"] });
  }
  for (const candidate of candidates) {
    const version = await firstLine(candidate.file, [...candidate.prefix, "--version"]);
    if (version && /^\d{4}\.\d{2}\.\d{2}/.test(version)) return { ...candidate, version };
  }
  return null;
}

/** A font to stamp the frame number and time on each grid tile. */
export function findFont() {
  const candidates = WINDOWS
    ? ["C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/tahoma.ttf"]
    : MAC
      ? ["/System/Library/Fonts/Supplemental/Arial.ttf", "/Library/Fonts/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"]
      : [
          "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
          "/usr/share/fonts/TTF/DejaVuSans.ttf",
          "/usr/share/fonts/dejavu/DejaVuSans.ttf",
          "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
          "/usr/share/fonts/liberation-sans/LiberationSans-Regular.ttf",
        ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

/** yt-dlp's standalone build takes a second or two to start on Windows: run it only when needed. */
async function findYtdlpFast() {
  const binary = findExecutable("yt-dlp");
  return binary ? { file: binary, prefix: [], version: null } : findYtdlp();
}

/**
 * What this machine has. By default the programs are only located on disk;
 * `versions` also runs each one (for the `check` command), and `ytdlp: false`
 * skips yt-dlp when the video is a local file.
 */
export async function checkTools({ versions = false, ytdlp = true } = {}) {
  const ffmpeg = findExecutable("ffmpeg");
  let ffprobe = findExecutable("ffprobe");
  if (!ffprobe && ffmpeg) {
    const sibling = join(dirname(ffmpeg), WINDOWS ? "ffprobe.exe" : "ffprobe");
    if (isFile(sibling)) ffprobe = sibling;
  }
  const version = async (path) => {
    const line = await firstLine(path, ["-hide_banner", "-version"]);
    return line ? (/version (\S+)/.exec(line)?.[1] ?? line) : null;
  };
  const [ffmpegVersion, ffprobeVersion, ytdlpFound] = await Promise.all([
    ffmpeg && versions ? version(ffmpeg) : null,
    ffprobe && versions ? version(ffprobe) : null,
    ytdlp ? (versions ? findYtdlp() : findYtdlpFast()) : null,
  ]);
  const tools = {
    ffmpeg: ffmpeg && (!versions || ffmpegVersion) ? { path: ffmpeg, version: ffmpegVersion } : null,
    ffprobe: ffprobe && (!versions || ffprobeVersion) ? { path: ffprobe, version: ffprobeVersion } : null,
    ytdlp: ytdlpFound,
  };
  if (versions) tools.font = await gridFont(tools);
  return tools;
}

/** The font for grid labels, or null when ffmpeg has no text filter or there is no known font. */
export async function gridFont(tools) {
  if (!tools.ffmpeg) return null;
  if (tools.font !== undefined) return tools.font;
  let drawtext = false;
  try {
    const { stdout } = await run(tools.ffmpeg.path, ["-hide_banner", "-filters"]);
    drawtext = /\sdrawtext\s/.test(stdout.toString("utf8"));
  } catch {
    drawtext = false;
  }
  tools.font = drawtext ? findFont() : null;
  return tools.font;
}

/** Where flyee saves the keys the member pastes in the key page: one file per machine, outside every project. */
export function keyStorePath(home = homedir()) {
  return join(home, ".flyee", "keys.json");
}

/** A key saved through the flyee key page ({ "version": 1, "keys": { "NAME": "value" } }), or null. */
export function readSavedKey(name, path = keyStorePath()) {
  try {
    const value = JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""))?.keys?.[name];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

/**
 * The Gemini key, by the flyee rule for app keys: the environment variable
 * first (one that exists but is empty means "no key" and stops the search),
 * then the key saved through the flyee key page. Read on every run, so a key
 * saved after the AI was opened works at once. Never printed or written.
 */
export function geminiKey(env = process.env, path = keyStorePath()) {
  const fromEnvironment = env.GEMINI_API_KEY;
  if (fromEnvironment !== undefined) return fromEnvironment.trim() ? { key: fromEnvironment.trim(), from: "environment" } : { key: null, from: null };
  const saved = readSavedKey("GEMINI_API_KEY", path);
  return saved ? { key: saved, from: "flyee" } : { key: null, from: null };
}

/**
 * How the key gets saved: the member's AI runs one command, the same on every
 * system, and the member pastes the key in the page it opens in their browser.
 * The member never opens a terminal and the key never enters the conversation.
 */
export function keySetup() {
  return {
    command: "npx --yes flyee@latest key set GEMINI_API_KEY --browser --json",
    how: "Rode você mesmo: o comando volta na hora e abre uma página no navegador do integrante, onde ele cola a chave e clica em Salvar. A chave não passa pela conversa nem pelo terminal.",
    after: "Quando ele disser que salvou, rode check --json de novo: o app enxerga a chave na hora, sem reabrir a IA. Se a página expirar antes, rode o comando de novo.",
  };
}

/**
 * The commands that install or update the programs, for the AI to run itself:
 * the flyee CLI picks the system's package manager (winget, Homebrew, apt…),
 * installs without questions, and this app finds the program at once, without
 * reopening the AI. The member never receives an install command to type.
 */
export function installHints() {
  return {
    ffmpeg: "npx --yes flyee@latest need ffmpeg --yes --json",
    "yt-dlp": "npx --yes flyee@latest need yt-dlp --yes --json",
    update_ytdlp: "npx --yes flyee@latest need yt-dlp --upgrade --yes --json",
    note: "Rode você mesmo, com tempo limite longo (até 10 minutos), depois de avisar o integrante numa frase. Se o resultado trouxer needs_member, mostre a ele só o passo único indicado.",
  };
}
