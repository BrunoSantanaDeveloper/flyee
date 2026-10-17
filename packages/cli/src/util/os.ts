import { spawn, type SpawnOptions } from "node:child_process";
import { accessSync, constants, lstatSync, statSync } from "node:fs";
import { release } from "node:os";
import { join } from "node:path";

export type ContractOs = "windows" | "macos" | "linux" | "other";

export function contractOs(platform: NodeJS.Platform = process.platform): ContractOs {
  if (platform === "win32") return "windows";
  if (platform === "darwin") return "macos";
  if (platform === "linux") return "linux";
  return "other";
}

export function osVersion(): string {
  return release().slice(0, 40);
}

/** Linux inside Windows (WSL): Windows programs run from here, and a Windows browser reaches this 127.0.0.1. */
export function isWsl(env: Record<string, string | undefined> = process.env, platform: NodeJS.Platform = process.platform): boolean {
  return platform === "linux" && Boolean(env.WSL_DISTRO_NAME || env.WSL_INTEROP);
}

/**
 * A program file. Windows app execution aliases (winget.exe in WindowsApps)
 * are reparse points that `stat` refuses with EACCES and `lstat` reports as a
 * link; they still run, so a link the process can access counts too.
 */
export function isProgramFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    try {
      if (!lstatSync(path).isSymbolicLink()) return false;
      accessSync(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Whether a binary is reachable on PATH, without running it, by the same rules
 * as `findProgram`: quoted Windows PATH entries count, folders do not. The fs
 * functions are imported, never `require`d: in the published ESM bundle
 * `require` threw, and the lookup silently found nothing.
 */
export function hasBinary(name: string, env: Record<string, string | undefined> = process.env, platform: NodeJS.Platform = process.platform): boolean {
  const pathValue = env.PATH ?? env.Path ?? "";
  const separator = platform === "win32" ? ";" : ":";
  const extensions = platform === "win32" ? (env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";").filter(Boolean) : [""];
  const folders = pathValue
    .split(separator)
    .map((folder) => folder.replace(/^"|"$/g, ""))
    .filter(Boolean);
  for (const dir of folders) {
    for (const ext of extensions) {
      for (const candidate of new Set([`${name}${ext.toLowerCase()}`, `${name}${ext}`])) {
        if (isProgramFile(join(dir, candidate))) return true;
      }
    }
  }
  return false;
}

/**
 * How the browser is started: detached, and never with `windowsHide`. The
 * opener hands its window state to the browser it starts, and a browser that
 * was not open yet came up with its first window hidden.
 */
export const BROWSER_SPAWN_OPTIONS: SpawnOptions = { detached: true, stdio: "ignore" };

/**
 * The command that opens a URL in the default browser. On Windows it is never
 * `cmd /c start`: cmd reads every `&` of the URL as the end of a command, and
 * the login's authorize URL reached the browser cut after its first parameter.
 * rundll32 hands the whole URL, as one argument, to the system's URL handler.
 * In WSL the Windows browser is the one in front of the person: wslview when
 * it is installed, else the same rundll32 through Windows interop.
 */
export function browserCommand(
  url: string,
  platform: NodeJS.Platform = process.platform,
  env: Record<string, string | undefined> = process.env,
): { file: string; args: string[] } {
  if (platform === "win32") return { file: "rundll32", args: ["url.dll,FileProtocolHandler", url] };
  if (platform === "darwin") return { file: "open", args: [url] };
  if (isWsl(env, platform)) {
    return hasBinary("wslview", env, platform) ? { file: "wslview", args: [url] } : { file: "rundll32.exe", args: ["url.dll,FileProtocolHandler", url] };
  }
  return { file: "xdg-open", args: [url] };
}

/**
 * Why no browser can open in front of the person on this machine, or null when
 * one can: a Claude Code cloud session (the VM sets CLAUDE_CODE_REMOTE=true), an
 * SSH session (a browser would open on the far machine) or a Linux with no
 * display (a server or a container). A page on 127.0.0.1 here is out of the
 * person's reach in all three. WSL is not one of them: the Windows browser
 * opens in front of the person and reaches WSL's 127.0.0.1.
 */
export function noBrowserReason(env: Record<string, string | undefined> = process.env, platform: NodeJS.Platform = process.platform): "cloud" | "ssh" | "no_display" | null {
  if (env.CLAUDE_CODE_REMOTE === "true") return "cloud";
  if (env.SSH_CONNECTION || env.SSH_TTY || env.SSH_CLIENT) return "ssh";
  if (isWsl(env, platform)) return null;
  if (platform === "linux" && !env.DISPLAY && !env.WAYLAND_DISPLAY) return "no_display";
  return null;
}

/** Only web addresses are handed to the system's URL handler, which would also run file: and other schemes. */
const WEB_URL = /^https?:\/\//i;

/**
 * Opens a URL with the system's default browser. Never throws; false when it
 * could not: the opener is missing, or it gave up at once (xdg-open with no
 * browser configured exits non-zero within a moment).
 */
export async function openBrowser(url: string): Promise<boolean> {
  if (!WEB_URL.test(url)) return false;
  try {
    const { file, args } = browserCommand(url);
    const child = spawn(file, args, BROWSER_SPAWN_OPTIONS);
    return await new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      child.once("error", () => settle(false));
      child.once("exit", (code) => settle(code === 0 || code === null));
      child.once("spawn", () => {
        child.unref();
        // rundll32 tells nothing through its exit code: on Windows, having started is the answer.
        if (process.platform === "win32") return settle(true);
        // An opener that is still running, or that exited with 0, handed the URL over.
        setTimeout(() => settle(true), 1500).unref();
      });
    });
  } catch {
    return false;
  }
}
