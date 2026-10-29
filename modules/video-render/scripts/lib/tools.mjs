// Finds ffmpeg, ffprobe and a browser on the member's machine without relying on an up-to-date PATH.

import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";

import { isFile, LIMITS, MAC, run, WINDOWS } from "./util.mjs";

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

/** The programs the flyee CLI already located (`~/.flyee/programs.json`), when the file exists. */
function cliLocated(binary) {
  try {
    const data = JSON.parse(readFileSync(join(homedir(), ".flyee", "programs.json"), "utf8").replace(/^\uFEFF/, ""));
    for (const program of Object.values(data?.programs ?? data ?? {})) {
      const path = program?.binaries?.[binary];
      if (typeof path === "string" && isFile(path)) return path;
    }
  } catch {
    // no file, or another format
  }
  return null;
}

/** Absolute path of an executable, or null. On Windows only `.exe`: a `.cmd` would need a shell. */
export function findExecutable(name) {
  const fromPath = (process.env.PATH ?? "").split(delimiter).map((folder) => folder.replace(/^"|"$/g, "")).filter(Boolean);
  const file = WINDOWS ? `${name}.exe` : name;
  for (const folder of [...fromPath, ...knownFolders()]) {
    const path = join(folder, file);
    if (isFile(path)) return path;
  }
  return cliLocated(name);
}

async function firstLine(file, args) {
  try {
    const { code, stdout } = await run(file, args, { timeoutMs: LIMITS.probe });
    if (code !== 0) return null;
    return stdout.toString("utf8").split(/\r?\n/)[0].trim() || null;
  } catch {
    return null;
  }
}

/**
 * Candidate browsers, best first: Edge ships with Windows, so it never needs
 * an install there; Chrome and Chromium come next. `FLYEE_BROWSER` overrides.
 */
export function browserCandidates() {
  const override = process.env.FLYEE_BROWSER;
  const list = [];
  if (override) list.push({ name: "custom", path: override });
  if (WINDOWS) {
    const roots = [process.env["ProgramFiles(x86)"], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean);
    for (const root of roots) {
      list.push({ name: "msedge", path: join(root, "Microsoft", "Edge", "Application", "msedge.exe") });
      list.push({ name: "chrome", path: join(root, "Google", "Chrome", "Application", "chrome.exe") });
      list.push({ name: "chromium", path: join(root, "Chromium", "Application", "chrome.exe") });
      list.push({ name: "brave", path: join(root, "BraveSoftware", "Brave-Browser", "Application", "brave.exe") });
    }
  } else if (MAC) {
    list.push({ name: "chrome", path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
    list.push({ name: "msedge", path: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" });
    list.push({ name: "chromium", path: "/Applications/Chromium.app/Contents/MacOS/Chromium" });
    list.push({ name: "brave", path: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" });
    list.push({ name: "chrome", path: join(homedir(), "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome") });
  } else {
    for (const name of ["google-chrome", "google-chrome-stable", "microsoft-edge", "microsoft-edge-stable", "chromium", "chromium-browser", "brave-browser"]) {
      const path = findExecutable(name);
      if (path) list.push({ name: name.replace(/-.*$/, "").replace("google", "chrome"), path });
    }
    list.push({ name: "chromium", path: "/snap/bin/chromium" });
  }
  return list;
}

/** The first browser that exists on disk, or null. */
export function findBrowser() {
  return browserCandidates().find((candidate) => isFile(candidate.path)) ?? null;
}

/** ffmpeg, ffprobe and the browser; `versions` also runs them (for `check`). */
export async function checkTools({ versions = false } = {}) {
  const ffmpeg = findExecutable("ffmpeg");
  let ffprobe = findExecutable("ffprobe");
  if (!ffprobe && ffmpeg) {
    const sibling = join(dirname(ffmpeg), WINDOWS ? "ffprobe.exe" : "ffprobe");
    if (isFile(sibling)) ffprobe = sibling;
  }
  const browser = findBrowser();
  const version = async (path) => {
    const line = await firstLine(path, ["-hide_banner", "-version"]);
    return line ? (/version (\S+)/.exec(line)?.[1] ?? line) : null;
  };
  const [ffmpegVersion, ffprobeVersion] = await Promise.all([ffmpeg && versions ? version(ffmpeg) : null, ffprobe && versions ? version(ffprobe) : null]);
  return {
    ffmpeg: ffmpeg ? { path: ffmpeg, version: ffmpegVersion } : null,
    ffprobe: ffprobe ? { path: ffprobe, version: ffprobeVersion } : null,
    browser,
  };
}

/** The ffmpeg filters this build has (drawtext needs a font library that some builds lack). */
export async function ffmpegFilters(ffmpegPath) {
  try {
    const { stdout } = await run(ffmpegPath, ["-hide_banner", "-filters"], { timeoutMs: LIMITS.probe });
    return new Set(stdout.toString("utf8").split(/\r?\n/).map((line) => line.trim().split(/\s+/)[1]).filter(Boolean));
  } catch {
    return new Set();
  }
}

/** The encoders this ffmpeg build has (libx264, prores_ks, libvpx-vp9, aac, libopus…). */
export async function ffmpegEncoders(ffmpegPath) {
  try {
    const { stdout } = await run(ffmpegPath, ["-hide_banner", "-encoders"], { timeoutMs: LIMITS.probe });
    return new Set(stdout.toString("utf8").split(/\r?\n/).map((line) => line.trim().split(/\s+/)[1]).filter(Boolean));
  } catch {
    return new Set();
  }
}

/** A font file for ffmpeg's drawtext (time stamps on contact sheets). */
export function findFont() {
  const candidates = WINDOWS
    ? ["C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/tahoma.ttf"]
    : MAC
      ? ["/System/Library/Fonts/Supplemental/Arial.ttf", "/Library/Fonts/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"]
      : [
          "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
          "/usr/share/fonts/TTF/DejaVuSans.ttf",
          "/usr/share/fonts/dejavu/DejaVuSans.ttf",
          "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        ];
  return candidates.find((path) => isFile(path)) ?? null;
}

/**
 * The commands that install the programs, for the AI to run itself: the flyee
 * CLI picks the system's package manager and installs without questions. The
 * member never receives an install command to type.
 */
export function installHints() {
  const browser = WINDOWS
    ? null
    : MAC
      ? "npx --yes flyee@latest need chromium --brew chromium --yes --json"
      : "npx --yes flyee@latest need chromium --apt chromium --yes --json";
  return {
    ffmpeg: "npx --yes flyee@latest need ffmpeg --yes --json",
    browser,
    note: "Rode você mesmo, com tempo limite longo (até 10 minutos), depois de avisar o integrante numa frase. Se o resultado trouxer needs_member, mostre a ele só o passo único indicado.",
  };
}
