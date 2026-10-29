// A headless browser driven through the DevTools protocol over its debugging pipe:
// no network port, no extra packages. One Browser holds pages; a Page seeks and screenshots.

import { spawn } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { findBrowser, installHints } from "./tools.mjs";
import { AppError, LIMITS, removeDir, run, sleep, tempDir, WINDOWS } from "./util.mjs";

const DEFAULT_TIMEOUT = 20000;
const PROFILE_PREFIX = "flyee-browser-";
const HOUR = 60 * 60 * 1000;

/** Where the browser's crash handler keeps its database: one shared folder, never inside a profile. */
export function crashDumpsDir(dir = tmpdir()) {
  return join(dir, "flyee-crashpad");
}

/**
 * Whether a browser is still using this profile. On Windows a running browser holds
 * `lockfile` open without delete sharing, so deleting it fails exactly when the profile
 * is in use (and succeeding is harmless: the folder is about to go). Elsewhere a running
 * browser leaves the `SingletonLock` link, which a crash can also leave behind, so it
 * counts as "in use" only for a day.
 */
export function profileInUse(path, age) {
  if (WINDOWS) {
    const lock = join(path, "lockfile");
    if (!existsSync(lock)) return false;
    try {
      rmSync(lock, { force: true, maxRetries: 0 });
      return false;
    } catch {
      return true;
    }
  }
  try {
    lstatSync(join(path, "SingletonLock"));
    return age < 24 * HOUR;
  } catch {
    return false;
  }
}

/**
 * Profile folders that earlier runs left behind. Removes those older than `maxAgeMs`
 * that no browser is using, at most `limit` per call so a launch never stalls on a big
 * backlog. A folder that still cannot be deleted is counted in `failed` and left alone.
 */
export function sweepStaleProfiles({ now = Date.now(), maxAgeMs = 15 * 60 * 1000, limit = 25, dir = tmpdir(), inUse = profileInUse } = {}) {
  const result = { removed: 0, kept: 0, failed: 0 };
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return result;
  }
  for (const name of names) {
    if (!name.startsWith(PROFILE_PREFIX)) continue;
    if (result.removed >= limit) break;
    const path = join(dir, name);
    let age;
    try {
      const stat = statSync(path);
      if (!stat.isDirectory()) continue;
      age = now - stat.mtimeMs;
    } catch {
      continue;
    }
    if (age < maxAgeMs || inUse(path, age)) {
      result.kept++;
      continue;
    }
    try {
      rmSync(path, { recursive: true, force: true, maxRetries: 0 });
      result.removed++;
    } catch {
      result.failed++;
    }
  }
  return result;
}

/**
 * Ends the browser together with every process it started. On Windows the crash
 * handler outlives the browser and keeps the profile folder locked; its parent is the
 * browser, so the tree has to be ended while the browser itself is still alive.
 */
export async function killProcessTree(pid) {
  if (!pid) return;
  if (WINDOWS) {
    const taskkill = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe");
    try {
      await run(taskkill, ["/PID", String(pid), "/T", "/F"], { timeoutMs: LIMITS.probe });
    } catch {
      // already gone, or taskkill unavailable: the caller still kills the main process
    }
    return;
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // already gone
  }
}

let sweptThisProcess = false;

function launchFlags({ userDataDir, width, height, extra = [] }) {
  return [
    "--headless=new",
    "--remote-debugging-pipe",
    "--disable-gpu",
    "--hide-scrollbars",
    "--mute-audio",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-sync",
    "--disable-breakpad",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-features=Translate,msEdgeSidebarV2,msSmartScreenProtection",
    "--allow-file-access-from-files",
    "--autoplay-policy=no-user-gesture-required",
    "--force-color-profile=srgb",
    "--font-render-hinting=none",
    "--enable-font-antialiasing",
    `--user-data-dir=${userDataDir}`,
    `--crash-dumps-dir=${crashDumpsDir()}`,
    `--window-size=${width},${height}`,
    ...extra,
    "about:blank",
  ];
}

export class Browser {
  constructor(child, userDataDir, info) {
    this.child = child;
    this.userDataDir = userDataDir;
    this.info = info;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.closed = false;
    this.stderrTail = "";
    this.buffer = Buffer.alloc(0);
    this.exitedFlag = false;
    this.exited = new Promise((resolve) => child.once("exit", () => {
      this.exitedFlag = true;
      resolve(true);
    }));
    const fromBrowser = child.stdio[4];
    fromBrowser.on("data", (chunk) => this.#onData(chunk));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (text) => {
      this.stderrTail = (this.stderrTail + text).slice(-8000);
    });
    child.on("exit", (code, signal) => {
      this.closed = true;
      const error = new AppError("browser_exited", `O navegador fechou sozinho (${signal ?? code}).`, "Tente de novo; se repetir, atualize o navegador.");
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer);
        reject(error);
      }
      this.pending.clear();
    });
  }

  /** Starts the browser found on this machine (or the one given). */
  static async launch({ path, width = 1080, height = 1920, extraFlags = [] } = {}) {
    const found = path ? { name: "custom", path } : findBrowser();
    if (!found) {
      const hint = installHints().browser;
      throw new AppError(
        "browser_missing",
        "Não encontrei um navegador para renderizar (Edge, Chrome ou Chromium).",
        WINDOWS ? "O Microsoft Edge vem com o Windows; confira se ele está instalado." : `Instale um navegador: ${hint}. ${installHints().note}`,
      );
    }
    if (!sweptThisProcess) {
      sweptThisProcess = true;
      sweepStaleProfiles();
      try {
        mkdirSync(crashDumpsDir(), { recursive: true });
      } catch {
        // the browser falls back to its own place
      }
    }
    const userDataDir = tempDir(PROFILE_PREFIX);
    let child;
    try {
      child = spawn(found.path, launchFlags({ userDataDir, width, height, extra: extraFlags }), {
        stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      removeDir(userDataDir);
      throw new AppError("browser_failed", `Não consegui abrir o navegador em ${found.path}.`, String(error.message));
    }
    const browser = new Browser(child, userDataDir, found);
    try {
      const version = await browser.send("Browser.getVersion", {}, null, 30000);
      browser.info = { ...found, product: version.product, protocol: version.protocolVersion };
    } catch (error) {
      await browser.close();
      throw new AppError("browser_failed", "O navegador abriu mas não respondeu ao protocolo de automação.", `${error.message}\n${browser.stderrTail.slice(-600)}`);
    }
    return browser;
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
      if (message.id !== undefined && this.pending.has(message.id)) {
        const { resolve, reject, timer, method } = this.pending.get(message.id);
        clearTimeout(timer);
        this.pending.delete(message.id);
        if (message.error) reject(new AppError("browser_protocol", `${method}: ${message.error.message}`, message.error.data ?? ""));
        else resolve(message.result ?? {});
      } else if (message.method) {
        for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {}, message.sessionId ?? null);
      }
    }
  }

  send(method, params = {}, sessionId = null, timeoutMs = DEFAULT_TIMEOUT) {
    if (this.closed) return Promise.reject(new AppError("browser_exited", "O navegador já fechou."));
    const id = ++this.nextId;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new AppError("browser_timeout", `O navegador não respondeu a ${method} em ${Math.round(timeoutMs / 1000)} s.`, "A página pode estar presa num loop ou esperando um vídeo. Confira se seek(t) termina sozinho."));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, method });
      this.child.stdio[3].write(`${JSON.stringify(message)}\0`);
    });
  }

  on(method, listener) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set());
    this.listeners.get(method).add(listener);
    return () => this.listeners.get(method)?.delete(listener);
  }

  async newPage({ width = 1080, height = 1920, deviceScaleFactor = 1 } = {}) {
    const { targetId } = await this.send("Target.createTarget", { url: "about:blank", width, height, newWindow: true });
    const { sessionId } = await this.send("Target.attachToTarget", { targetId, flatten: true });
    const page = new Page(this, targetId, sessionId);
    await page.init();
    await page.setViewport(width, height, deviceScaleFactor);
    return page;
  }

  /** Resolves true when the browser process has exited, false after `ms`; leaves no timer behind. */
  waitExit(ms) {
    if (this.exitedFlag) return Promise.resolve(true);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), ms);
      this.exited.then(() => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  }

  /** Lets this Node process end even if the browser lingers: no listener, pipe or child handle keeps it alive. */
  release() {
    for (const stream of [this.child.stdio[2], this.child.stdio[3], this.child.stdio[4]]) {
      if (!stream) continue;
      try {
        stream.removeAllListeners("data");
        stream.destroy();
      } catch {
        // already closed
      }
    }
    try {
      this.child.unref();
    } catch {
      // nothing to release
    }
  }

  /**
   * Closes the browser and deletes its profile folder. On Windows the whole process tree
   * is ended at once (a graceful close would leave the crash handler holding the folder);
   * elsewhere the browser is asked to close. Then this waits for the exit (a few seconds
   * at most, then kills it), lets go of the process and its pipes, and retries the delete
   * while the folder is still held. A folder that still cannot go is left for the sweep
   * of a later launch instead of keeping the command waiting.
   */
  async close() {
    if (!this.exitedFlag) {
      if (WINDOWS) {
        this.closed = true;
        await killProcessTree(this.child.pid);
      } else if (!this.closed) {
        try {
          await this.send("Browser.close", {}, null, 3000);
        } catch {
          // it may already be gone
        }
      }
    }
    this.closed = true;
    if (!(await this.waitExit(4000))) {
      try {
        this.child.kill("SIGKILL");
      } catch {
        // already dead
      }
      await this.waitExit(3000);
    }
    this.release();
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        removeDir(this.userDataDir);
        return;
      } catch {
        await sleep(250 * (attempt + 1));
      }
    }
  }
}

export class Page {
  constructor(browser, targetId, sessionId) {
    this.browser = browser;
    this.targetId = targetId;
    this.sessionId = sessionId;
    this.errors = [];
    this.console = [];
    this.loaded = false;
  }

  send(method, params = {}, timeoutMs = DEFAULT_TIMEOUT) {
    return this.browser.send(method, params, this.sessionId, timeoutMs);
  }

  async init() {
    await this.send("Page.enable");
    await this.send("Runtime.enable");
    this.browser.on("Runtime.exceptionThrown", (params, sessionId) => {
      if (sessionId !== this.sessionId) return;
      const detail = params.exceptionDetails ?? {};
      const text = detail.exception?.description ?? detail.text ?? "erro na página";
      this.errors.push(text.split("\n")[0].slice(0, 300));
    });
    this.browser.on("Runtime.consoleAPICalled", (params, sessionId) => {
      if (sessionId !== this.sessionId) return;
      if (!["error", "warning", "assert"].includes(params.type)) return;
      const text = (params.args ?? []).map((arg) => arg.value ?? arg.description ?? "").join(" ");
      if (text) this.console.push(`${params.type}: ${text.slice(0, 300)}`);
    });
    this.browser.on("Page.loadEventFired", (_params, sessionId) => {
      if (sessionId === this.sessionId) this.loaded = true;
    });
  }

  /** The CSS viewport stays at the film size; a fractional scale gives a smaller screenshot with the same layout. */
  async setViewport(width, height, deviceScaleFactor = 1) {
    this.width = width;
    this.height = height;
    this.scale = deviceScaleFactor;
    await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor, mobile: false, screenWidth: width, screenHeight: height });
  }

  /** A transparent canvas behind the page, for overlay layers (the page's own background must be transparent too). */
  async setTransparent(on) {
    if (on) await this.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
    else await this.send("Emulation.setDefaultBackgroundColorOverride", {});
  }

  /** Runs before every document of this page: the render flag and the seek wrapper. */
  async addInitScript(source) {
    await this.send("Page.addScriptToEvaluateOnNewDocument", { source });
  }

  async goto(url, { timeoutMs = 30000 } = {}) {
    this.loaded = false;
    const result = await this.send("Page.navigate", { url }, timeoutMs);
    if (result.errorText) throw new AppError("page_load_failed", `Não consegui abrir a página (${result.errorText}).`, "Confira o caminho do arquivo HTML.");
    const started = Date.now();
    while (!this.loaded && Date.now() - started < timeoutMs) {
      const state = await this.evaluate("document.readyState", { awaitPromise: false });
      if (state === "complete") break;
      await sleep(25);
    }
    await this.evaluate("document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true", { timeoutMs: 15000 }).catch(() => null);
  }

  /** Evaluates an expression and returns its value; a thrown exception becomes an AppError with the page's message. */
  async evaluate(expression, { awaitPromise = true, timeoutMs = DEFAULT_TIMEOUT } = {}) {
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true, userGesture: true }, timeoutMs);
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails;
      const text = detail.exception?.description ?? detail.text ?? "erro na página";
      throw new AppError("page_error", `A página deu erro: ${text.split("\n")[0].slice(0, 300)}`, "Corrija o JavaScript da página e renderize de novo.");
    }
    return result.result?.value;
  }

  /** PNG or JPEG bytes of the current frame. */
  async screenshot({ format = "png", quality = 92, timeoutMs = DEFAULT_TIMEOUT } = {}) {
    const params = { format, fromSurface: true, captureBeyondViewport: false, optimizeForSpeed: true };
    if (format === "jpeg") params.quality = quality;
    const { data } = await this.send("Page.captureScreenshot", params, timeoutMs);
    return Buffer.from(data, "base64");
  }

  async close() {
    try {
      await this.browser.send("Target.closeTarget", { targetId: this.targetId }, null, 5000);
    } catch {
      // the browser may be closing
    }
  }
}
