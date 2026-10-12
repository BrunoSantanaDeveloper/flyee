// Finds yt-dlp on the member's machine without relying on an up-to-date PATH.

import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

import { run } from "./util.mjs";

const WINDOWS = process.platform === "win32";

/**
 * Folders where installers usually put the program. An AI started before the
 * install inherits the old PATH; looking here avoids asking for a restart.
 */
function knownFolders() {
  const home = homedir();
  if (!WINDOWS) return ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", join(home, ".local", "bin"), "/snap/bin"];
  const local = process.env.LOCALAPPDATA ?? join(home, "AppData", "Local");
  const folders = [join(local, "Microsoft", "WinGet", "Links"), join(home, "scoop", "shims"), "C:\\ProgramData\\chocolatey\\bin"];
  const packages = join(local, "Microsoft", "WinGet", "Packages");
  try {
    for (const name of readdirSync(packages)) {
      if (/yt-dlp/i.test(name)) folders.push(join(packages, name));
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

/**
 * yt-dlp as a program or, when installed with pip, as a Python module.
 * `version: true` runs it to read the version (for `check`); otherwise the
 * standalone build is only located, because it takes a second to start on Windows.
 */
export async function findYtdlp({ version = false } = {}) {
  const binary = findExecutable("yt-dlp");
  if (binary && !version) return { file: binary, prefix: [], version: null };
  const candidates = binary ? [{ file: binary, prefix: [] }] : [];
  const pythons = WINDOWS ? [["py", ["-3"]], ["python", []], ["python3", []]] : [["python3", []], ["python", []]];
  for (const [name, extra] of pythons) {
    const path = findExecutable(name);
    if (path) candidates.push({ file: path, prefix: [...extra, "-m", "yt_dlp"] });
  }
  for (const candidate of candidates) {
    const line = await firstLine(candidate.file, [...candidate.prefix, "--version"]);
    if (line && /^\d{4}\.\d{2}\.\d{2}/.test(line)) return { ...candidate, version: line };
  }
  return null;
}

/**
 * The commands that install or update yt-dlp, for the AI to run itself: the
 * flyee CLI picks the system's package manager (winget, Homebrew, apt…) and
 * this app finds the program at once, without reopening the AI.
 */
export function installHints() {
  return {
    "yt-dlp": "npx flyee need yt-dlp --yes --json",
    update_ytdlp: "npx flyee need yt-dlp --upgrade --yes --json",
    note: "Rode você mesmo, com tempo limite longo (até 10 minutos), depois de avisar o integrante numa frase. Se o resultado trouxer needs_member, mostre a ele só o passo único indicado.",
  };
}
