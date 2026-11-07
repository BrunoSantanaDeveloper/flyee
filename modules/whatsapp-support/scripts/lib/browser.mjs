// Um navegador sem janela (Edge, Chrome ou Chromium da máquina) pelo protocolo DevTools no pipe de
// depuração: sem porta de rede e sem pacotes. Versão curta do motor do app video-render.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AppError } from "./util.mjs";

const WINDOWS = process.platform === "win32";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function windowsCandidates(env) {
  const roots = [env["ProgramFiles(x86)"], env.ProgramFiles, env.LOCALAPPDATA].filter(Boolean);
  const out = [];
  for (const root of roots) {
    out.push(join(root, "Microsoft", "Edge", "Application", "msedge.exe"));
    out.push(join(root, "Google", "Chrome", "Application", "chrome.exe"));
    out.push(join(root, "Chromium", "Application", "chrome.exe"));
  }
  return out;
}

const MAC_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];
const LINUX_NAMES = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"];

export function findBrowser(env = process.env) {
  if (env.KIT_BROWSER && existsSync(env.KIT_BROWSER)) return env.KIT_BROWSER;
  if (WINDOWS) return windowsCandidates(env).find((path) => existsSync(path)) ?? null;
  if (process.platform === "darwin") return MAC_CANDIDATES.find((path) => existsSync(path)) ?? null;
  for (const name of LINUX_NAMES) {
    const found = spawnSync("which", [name], { encoding: "utf8" });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  return null;
}

export class Browser {
  static async launch({ width = 1440, height = 900 } = {}) {
    const path = findBrowser();
    if (!path) {
      throw new AppError(
        "browser_missing",
        "Não encontrei Edge, Chrome ou Chromium nesta máquina.",
        "No Windows o Edge vem com o sistema. No Linux, a IA instala o Chromium com npx --yes flyee@latest need chromium --apt chromium --yes --json. No Mac, use o Chrome ou o Edge. A conferência por HTTP (verify) funciona sem navegador.",
      );
    }
    const profile = mkdtempSync(join(tmpdir(), "kit-atendimento-"));
    const args = [
      "--headless=new",
      "--remote-debugging-pipe",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-sync",
      "--hide-scrollbars",
      "--mute-audio",
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      "about:blank",
    ];
    const child = spawn(path, args, { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"], windowsHide: true });
    const browser = new Browser(child, profile);
    await browser.send("Browser.getVersion", {}, null, 30000);
    return browser;
  }

  constructor(child, profile) {
    this.child = child;
    this.profile = profile;
    this.nextId = 0;
    this.pending = new Map();
    this.buffer = Buffer.alloc(0);
    this.closed = false;
    child.stdio[4].on("data", (chunk) => this.#onData(chunk));
    child.stderr.on("data", () => {});
    child.on("exit", () => {
      this.closed = true;
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer);
        reject(new AppError("browser_exited", "O navegador fechou sozinho.", "Tente de novo."));
      }
      this.pending.clear();
    });
  }

  #onData(chunk) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    let zero;
    while ((zero = this.buffer.indexOf(0)) >= 0) {
      const text = this.buffer.subarray(0, zero).toString("utf8");
      this.buffer = this.buffer.subarray(zero + 1);
      let message;
      try {
        message = JSON.parse(text);
      } catch {
        continue;
      }
      const waiting = message.id !== undefined ? this.pending.get(message.id) : null;
      if (!waiting) continue;
      clearTimeout(waiting.timer);
      this.pending.delete(message.id);
      if (message.error) waiting.reject(new AppError("browser_protocol", `${waiting.method}: ${message.error.message}`));
      else waiting.resolve(message.result ?? {});
    }
  }

  send(method, params = {}, sessionId = null, timeoutMs = 20000) {
    if (this.closed) return Promise.reject(new AppError("browser_exited", "O navegador já fechou."));
    const id = ++this.nextId;
    const message = sessionId ? { id, method, params, sessionId } : { id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new AppError("browser_timeout", `O navegador não respondeu a ${method}.`, "Tente de novo; se repetir, confira se o painel abre no navegador."));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, method });
      this.child.stdio[3].write(`${JSON.stringify(message)}\0`);
    });
  }

  async newPage({ width = 1440, height = 900 } = {}) {
    const { targetId } = await this.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await this.send("Target.attachToTarget", { targetId, flatten: true });
    const page = {
      send: (method, params = {}, timeoutMs) => this.send(method, params, sessionId, timeoutMs),
    };
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    page.evaluate = async (expression, timeoutMs = 20000) => {
      const result = await page.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, timeoutMs);
      if (result.exceptionDetails) throw new AppError("page_error", "A página deu erro ao conferir.", String(result.exceptionDetails.text ?? ""));
      return result.result?.value;
    };
    page.goto = async (url) => {
      const result = await page.send("Page.navigate", { url }, 30000);
      if (result.errorText) throw new AppError("page_load_failed", `Não consegui abrir ${new URL(url).pathname} (${result.errorText}).`, "Confira o endereço do painel.");
    };
    page.waitFor = async (expression, timeoutMs = 30000) => {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        try {
          if (await page.evaluate(expression, 5000)) return true;
        } catch {
          // a página ainda está trocando
        }
        await sleep(300);
      }
      return false;
    };
    page.screenshot = async () => Buffer.from((await page.send("Page.captureScreenshot", { format: "png" }, 30000)).data, "base64");
    page.colorScheme = (scheme) => page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
    return page;
  }

  async close() {
    if (!this.closed) {
      try {
        await this.send("Browser.close", {}, null, 3000);
      } catch {
        // pode já ter fechado
      }
    }
    if (WINDOWS && this.child.pid) spawnSync("taskkill", ["/PID", String(this.child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    try {
      this.child.kill("SIGKILL");
    } catch {
      // já fechou
    }
    for (const stream of [this.child.stdio[2], this.child.stdio[3], this.child.stdio[4]]) stream?.destroy();
    this.child.unref();
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        rmSync(this.profile, { recursive: true, force: true });
        return;
      } catch {
        await sleep(250 * (attempt + 1));
      }
    }
  }
}
