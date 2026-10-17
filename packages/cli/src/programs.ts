import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

import type { Context } from "./context.ts";
import { readJson, writeJsonAtomic } from "./util/fs.ts";
import { contractOs, isProgramFile, type ContractOs } from "./util/os.ts";

export { isProgramFile };

/**
 * Programs apps need (ffmpeg, yt-dlp…), installed by the CLI itself so the
 * member never opens a terminal: the member's AI runs `npx flyee need`, and
 * `add`, `update` and `dev link` install what an app declares. Only the
 * system's package manager is used (winget, Homebrew, apt/dnf/pacman,
 * pipx/pip), never a binary downloaded from elsewhere, and always without
 * questions. What cannot be done without the member (an administrator
 * password, a missing package manager) comes back as `needs_member` with the
 * single step to take.
 */

export type Manager = "winget" | "brew" | "apt" | "dnf" | "pacman" | "pipx" | "pip";
export type InstallStep = { manager: Manager; id: string };
export type ProgramSpec = {
  name: string;
  label: string;
  binaries: string[];
  url?: string;
  install: Partial<Record<ContractOs, InstallStep[]>>;
};
export type ProgramsRegistry = { programs: Record<string, Omit<ProgramSpec, "name">> };

export type ProgramStatus = "present" | "installed" | "upgraded" | "needs_member" | "failed";
export type ProgramResult = {
  name: string;
  label: string;
  status: ProgramStatus;
  binaries: Record<string, string | null>;
  manager?: Manager;
  /** The one step the member must take, when the CLI cannot. */
  member_step?: string;
  reason?: string;
  url?: string;
  detail?: string;
};

export type RunResult = { status: number | null; stdout: string; stderr: string };
export type Runner = (file: string, args: string[], env?: Record<string, string>) => RunResult;
export type Finder = (binary: string) => string | null;

const WINDOWS_EXT = [".exe", ".cmd", ".bat"];

/** Folders where package managers put programs; an AI opened before the install inherits the old PATH. */
export function knownFolders(platform: NodeJS.Platform = process.platform, env: Record<string, string | undefined> = process.env): string[] {
  const home = homedir();
  if (platform !== "win32") return ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", join(home, ".local", "bin"), "/snap/bin"];
  const local = env.LOCALAPPDATA ?? join(home, "AppData", "Local");
  const folders = [
    join(local, "Microsoft", "WinGet", "Links"),
    join(local, "Microsoft", "WindowsApps"),
    join(home, "scoop", "shims"),
    "C:\\ProgramData\\chocolatey\\bin",
  ];
  const packages = join(local, "Microsoft", "WinGet", "Packages");
  try {
    for (const name of readdirSync(packages)) {
      const root = join(packages, name);
      folders.push(root);
      try {
        for (const sub of readdirSync(root)) folders.push(join(root, sub), join(root, sub, "bin"));
      } catch {
        // not a folder
      }
    }
  } catch {
    // no winget packages
  }
  return folders;
}

const isFile = isProgramFile;

/** Absolute path of a program on PATH or in the package managers' folders, or null. */
export function findProgram(binary: string, env: Record<string, string | undefined> = process.env, platform: NodeJS.Platform = process.platform): string | null {
  const pathValue = env.PATH ?? env.Path ?? "";
  const folders = [...pathValue.split(delimiter).map((folder) => folder.replace(/^"|"$/g, "")).filter(Boolean), ...knownFolders(platform, env)];
  const names = platform === "win32" ? WINDOWS_EXT.map((ext) => `${binary}${ext}`) : [binary];
  for (const folder of folders) {
    for (const name of names) {
      const path = join(folder, name);
      if (isFile(path)) return path;
    }
  }
  return null;
}

export const defaultRunner: Runner = (file, args, env) => {
  const result = spawnSync(file, args, {
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout: 15 * 60_000,
    windowsHide: true,
    shell: process.platform === "win32" && /\.(cmd|bat)$/i.test(file),
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? (result.error ? String(result.error.message) : "") };
};

export function programsRegistry(raw: ProgramsRegistry): Map<string, ProgramSpec> {
  const map = new Map<string, ProgramSpec>();
  for (const [name, spec] of Object.entries(raw.programs ?? {})) map.set(name, { name, ...spec });
  return map;
}

/** The registry entry that ships a binary (`ffprobe` → ffmpeg), or the program by name. */
export function specFor(registry: Map<string, ProgramSpec>, nameOrBinary: string): ProgramSpec | null {
  if (registry.has(nameOrBinary)) return registry.get(nameOrBinary)!;
  for (const spec of registry.values()) if (spec.binaries.includes(nameOrBinary)) return spec;
  return null;
}

/**
 * The programs an app declares: registry programs whose binaries appear, as
 * whole words, in the scope of one of its `shell` permissions.
 */
export function programsDeclared(registry: Map<string, ProgramSpec>, permissions: { kind: string; scope: string }[] | undefined): string[] {
  const found = new Set<string>();
  for (const permission of permissions ?? []) {
    if (permission.kind !== "shell") continue;
    for (const spec of registry.values()) {
      if (spec.binaries.some((binary) => new RegExp(`(^|[^A-Za-z0-9_.-])${binary.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}([^A-Za-z0-9_-]|$)`).test(permission.scope))) {
        found.add(spec.name);
      }
    }
  }
  return [...found].sort();
}

function binariesOf(spec: ProgramSpec, find: Finder): Record<string, string | null> {
  return Object.fromEntries(spec.binaries.map((binary) => [binary, find(binary)]));
}

const allFound = (binaries: Record<string, string | null>) => Object.values(binaries).every(Boolean);

function isRoot(): boolean {
  return typeof process.getuid === "function" && process.getuid() === 0;
}

type Planned = { file: string; args: string[]; env?: Record<string, string>; display: string } | { missing: true };

/**
 * What apt answers when its package lists are missing or old: a package it
 * does not know (a fresh image never downloaded them) or archives that moved.
 * apt runs with LC_ALL=C, so these are the words it prints in any locale.
 */
const APT_LISTS_STALE = /Unable to locate package|has no installation candidate|maybe run apt-get update/i;

/** The command for one step, or `missing` when that package manager is not on this machine. */
function plan(step: InstallStep, upgrade: boolean, find: Finder): Planned {
  const id = step.id;
  switch (step.manager) {
    case "winget": {
      const winget = find("winget");
      if (!winget) return { missing: true };
      const args = [upgrade ? "upgrade" : "install", "--id", id, "-e", "--silent", "--accept-source-agreements", "--accept-package-agreements", "--disable-interactivity"];
      return { file: winget, args, display: `winget ${args.slice(0, 4).join(" ")}` };
    }
    case "brew": {
      const brew = find("brew");
      if (!brew) return { missing: true };
      return { file: brew, args: [upgrade ? "upgrade" : "install", id], env: { NONINTERACTIVE: "1", HOMEBREW_NO_ENV_HINTS: "1" }, display: `brew ${upgrade ? "upgrade" : "install"} ${id}` };
    }
    case "apt":
    case "dnf":
    case "pacman": {
      const tool = step.manager === "apt" ? "apt-get" : step.manager;
      const path = find(tool);
      if (!path) return { missing: true };
      const managerArgs =
        step.manager === "apt" ? ["install", "-y", id] : step.manager === "dnf" ? ["install", "-y", id] : ["-S", "--noconfirm", id];
      const env = step.manager === "apt" ? { DEBIAN_FRONTEND: "noninteractive", LC_ALL: "C" } : undefined;
      if (isRoot()) return { file: path, args: managerArgs, env, display: `${tool} ${managerArgs.join(" ")}` };
      const sudo = find("sudo");
      if (!sudo) return { missing: true };
      // The step left to the member refreshes apt's lists first: where they were never
      // downloaded, the install alone would fail for them the way it failed here.
      const display = step.manager === "apt" ? `sudo sh -c 'apt-get update && apt-get install -y ${id}'` : `sudo ${tool} ${managerArgs.join(" ")}`;
      return { file: sudo, args: ["-n", path, ...managerArgs], env, display };
    }
    case "pipx": {
      const pipx = find("pipx");
      if (!pipx) return { missing: true };
      return { file: pipx, args: [upgrade ? "upgrade" : "install", id], display: `pipx ${upgrade ? "upgrade" : "install"} ${id}` };
    }
    case "pip": {
      const python = find("python3") ?? find("python");
      if (!python) return { missing: true };
      return { file: python, args: ["-m", "pip", "install", "--user", "-U", id], display: `python3 -m pip install --user -U ${id}` };
    }
    default:
      return { missing: true };
  }
}

/** The one step left to the member when no step could run, in their system's words. */
function memberStep(spec: ProgramSpec, os: ContractOs, triedSudo: string | null): { step?: string; reason: string } {
  if (triedSudo) return { step: triedSudo, reason: "admin_password" };
  if (os === "macos") {
    return {
      step: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      reason: "homebrew_missing",
    };
  }
  if (os === "windows") return { reason: "winget_missing", step: "https://apps.microsoft.com/detail/9NBLGGH4NNS1" };
  return { reason: "no_package_manager", step: spec.url };
}

/** Makes sure a program is on this machine; installs (or upgrades) it through the package manager when it is not. */
export function ensureProgram(
  spec: ProgramSpec,
  options: { upgrade?: boolean; os?: ContractOs; find?: Finder; run?: Runner } = {},
): ProgramResult {
  const os = options.os ?? contractOs();
  const find = options.find ?? ((binary: string) => findProgram(binary));
  const run = options.run ?? defaultRunner;
  const before = binariesOf(spec, find);
  const base = { name: spec.name, label: spec.label, url: spec.url };
  if (allFound(before) && !options.upgrade) return { ...base, status: "present", binaries: before };

  let lastFailure: { manager: Manager; detail: string } | null = null;
  let sudoCommand: string | null = null;
  for (const step of spec.install[os] ?? []) {
    const planned = plan(step, Boolean(options.upgrade) && allFound(before), find);
    if ("missing" in planned) continue;
    let result = run(planned.file, planned.args, planned.env);
    let output = `${result.stdout}\n${result.stderr}`;
    // A fresh image (a container, a cloud session) ships with empty package lists, and apt knows no
    // ffmpeg until `apt-get update`: refresh the lists once, the same way (as root or through sudo), and
    // try again. The install runs again even when the refresh failed, since one broken source fails the
    // whole refresh while the others were read; what the refresh refused goes at the end of the detail.
    if (step.manager === "apt" && result.status !== 0 && APT_LISTS_STALE.test(output)) {
      const update = run(planned.file, [...planned.args.slice(0, -3), "update", "-qq"], planned.env);
      const refused = `${update.stdout}\n${update.stderr}`.split(/\r?\n/).filter((line) => line.trim().startsWith("E:")).slice(0, 2);
      result = run(planned.file, planned.args, planned.env);
      output = [result.stdout, result.stderr, ...refused].join("\n");
    }
    // winget answers "no applicable upgrade" with a non-zero code when the program is already current.
    const alreadyCurrent = /No (available|applicable) upgrade|No newer package versions|already installed/i.test(output);
    if (result.status === 0 || alreadyCurrent) {
      const after = binariesOf(spec, find);
      if (allFound(after)) {
        return { ...base, status: allFound(before) ? (alreadyCurrent && result.status !== 0 ? "present" : "upgraded") : "installed", binaries: after, manager: step.manager };
      }
      lastFailure = { manager: step.manager, detail: "installed, but the program was not found afterwards" };
      continue;
    }
    if (planned.display.startsWith("sudo") && /password|a terminal is required|sudo:/i.test(result.stderr)) {
      sudoCommand = planned.display;
      continue;
    }
    lastFailure = { manager: step.manager, detail: output.trim().split(/\r?\n/).filter(Boolean).slice(-3).join(" | ").slice(0, 400) };
  }

  if (allFound(before) && options.upgrade) {
    return { ...base, status: "present", binaries: before, detail: lastFailure?.detail };
  }
  if (lastFailure && !sudoCommand) {
    return { ...base, status: "failed", binaries: binariesOf(spec, find), manager: lastFailure.manager, detail: lastFailure.detail };
  }
  const member = memberStep(spec, os, sudoCommand);
  return { ...base, status: "needs_member", binaries: binariesOf(spec, find), reason: member.reason, member_step: member.step };
}

/** `~/.flyee/programs.json`: where each program was found, for apps that want the absolute path. */
export function recordPrograms(ctx: Context, results: ProgramResult[]): void {
  const path = join(ctx.flyeeHome, "programs.json");
  const current = readJson<{ programs?: Record<string, unknown> }>(path)?.programs ?? {};
  for (const result of results) {
    if (!allFound(result.binaries)) continue;
    current[result.name] = { binaries: result.binaries, manager: result.manager ?? null, checked_at: new Date(ctx.now()).toISOString() };
  }
  if (existsSync(ctx.flyeeHome) || Object.keys(current).length) writeJsonAtomic(path, { version: 1, programs: current });
}
