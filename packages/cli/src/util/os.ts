import { spawn } from "node:child_process";
import { release } from "node:os";

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

/** Opens a URL with the system's default browser. Never throws; false when it could not. */
export async function openBrowser(url: string): Promise<boolean> {
  try {
    const platform = process.platform;
    const child =
      platform === "win32"
        ? spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true })
        : platform === "darwin"
          ? spawn("open", [url], { detached: true, stdio: "ignore" })
          : spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    return await new Promise<boolean>((resolve) => {
      child.once("error", () => resolve(false));
      child.once("spawn", () => {
        child.unref();
        resolve(true);
      });
    });
  } catch {
    return false;
  }
}

/** Whether a binary is reachable on PATH, without running it. */
export function hasBinary(name: string, env: Record<string, string | undefined> = process.env): boolean {
  const pathValue = env.PATH ?? env.Path ?? "";
  const separator = process.platform === "win32" ? ";" : ":";
  const extensions = process.platform === "win32" ? (env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [""];
  for (const dir of pathValue.split(separator).filter(Boolean)) {
    for (const ext of extensions) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { accessSync, constants } = require("node:fs") as typeof import("node:fs");
        accessSync(`${dir}/${name}${ext.toLowerCase()}`, constants.F_OK);
        return true;
      } catch {
        try {
          const { accessSync, constants } = require("node:fs") as typeof import("node:fs");
          accessSync(`${dir}/${name}${ext}`, constants.F_OK);
          return true;
        } catch {
          // keep looking
        }
      }
    }
  }
  return false;
}
