// Films one part of a live page, in real time: photos of the element at a fixed interval, on desktop,
// on a phone and with less motion asked for, each pass in one sheet of frames. It changes nothing in
// the page, so it works on any page, and it does not prove the frames between two photos.

import { createHash } from "node:crypto";
import { join } from "node:path";

import { Browser } from "./browser.mjs";
import { ACCEPT_LANGUAGE, DESKTOP_HEIGHT, dismissCookies, inputKind, MOBILE_HEIGHT, MOBILE_SCALE, MOBILE_USER_AGENT, normalizeUrl, setMetrics, trackNetwork, waitForNetworkQuiet } from "./capture.mjs";
import { AppError, clamp, ensureDir, round, sleep, writeFileAtomic, writeJson } from "./util.mjs";

/** Time for what starts on arrival to begin before the first photo. */
const SETTLE_MS = 400;
/** The widest sheet: wide enough to read a frame, narrow enough to open as one image. */
const SHEET_WIDTH = 1680;
const REDUCED_FRAMES = 3;

export const FILM_PASSES = [
  { id: "desktop", label: "computador", width: 1440, height: DESKTOP_HEIGHT, scale: 1, mobile: false, reduced: false },
  { id: "mobile", label: "celular", width: 390, height: MOBILE_HEIGHT, scale: MOBILE_SCALE, mobile: true, reduced: false },
  { id: "reduced", label: "celular, com menos movimento", width: 390, height: MOBILE_HEIGHT, scale: MOBILE_SCALE, mobile: true, reduced: true },
];

/** What a list of frames says about the scene: how often it changed and how long it stood still. */
export function filmStats(frames, everySeconds) {
  const hashes = frames.map((frame) => frame.hash);
  let changes = 0;
  let longest = hashes.length ? 1 : 0;
  let run = hashes.length ? 1 : 0;
  for (let i = 1; i < hashes.length; i++) {
    if (hashes[i] === hashes[i - 1]) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      changes += 1;
      run = 1;
    }
  }
  const back = hashes.findIndex((hash, index) => index >= 2 && hash === hashes[0] && hashes[index - 1] !== hash);
  return {
    changes,
    distinct: new Set(hashes).size,
    longest_still_s: round(Math.max(0, longest - 1) * everySeconds, 2),
    returns_to_first_at_s: back > 0 ? round(frames[back].t, 2) : null,
  };
}

/** How many frames fit across a sheet, and how wide each is shown. */
export function sheetLayout(frameWidth, count, sheetWidth = SHEET_WIDTH) {
  const cell = Math.min(Math.round(frameWidth), frameWidth > 480 ? 540 : 358);
  const cols = clamp(Math.floor(sheetWidth / (cell + 8)), 1, Math.max(1, count));
  return { cell, cols };
}

/* eslint-disable no-undef */
function placeInPage(selector) {
  const el = selector ? document.querySelector(selector) : null;
  if (selector && !el) return { found: false };
  if (!el) return { found: true, visible: true };
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return { found: true, visible: false };
  el.scrollIntoView({ block: "center", behavior: "instant" });
  return { found: true, visible: true };
}

function clipInPage(selector) {
  const el = selector ? document.querySelector(selector) : null;
  if (!el) return { x: scrollX, y: scrollY, width: innerWidth, height: innerHeight };
  const r = el.getBoundingClientRect();
  const left = Math.max(0, r.left);
  const top = Math.max(0, r.top);
  const right = Math.min(innerWidth, r.right);
  const bottom = Math.min(innerHeight, r.bottom);
  return { x: left + scrollX, y: top + scrollY, width: Math.max(1, right - left), height: Math.max(1, bottom - top), cropped: r.top < 0 || r.left < 0 || r.right > innerWidth || r.bottom > innerHeight };
}

function drawSheetInPage({ title, cell, cols, frames }) {
  document.documentElement.style.background = "#1f2125";
  document.body.style.cssText = "margin:0;padding:12px;background:#1f2125;color:#fff;font:14px/1.3 system-ui,sans-serif;width:max-content";
  document.body.innerHTML = "";
  const head = document.createElement("div");
  head.textContent = title;
  head.style.cssText = "margin:0 0 10px";
  document.body.append(head);
  const grid = document.createElement("div");
  grid.style.cssText = `display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:8px`;
  for (const frame of frames) {
    const box = document.createElement("div");
    box.style.cssText = "position:relative;background:#000";
    const img = document.createElement("img");
    img.src = frame.src;
    img.style.cssText = "display:block;width:100%;height:auto";
    const stamp = document.createElement("div");
    stamp.textContent = frame.label;
    stamp.style.cssText = "position:absolute;left:4px;top:4px;padding:1px 5px;background:#000;font:12px/1.4 ui-monospace,monospace";
    box.append(img, stamp);
    grid.append(box);
  }
  document.body.append(grid);
  return Promise.all(Array.from(document.images).map((img) => (img.decode ? img.decode().catch(() => null) : null))).then(() => {
    const box = document.body.getBoundingClientRect();
    return { width: Math.ceil(box.width), height: Math.ceil(box.height) };
  });
}
/* eslint-enable no-undef */

const inPage = (fn, arg) => `(${fn.toString()})(${JSON.stringify(arg ?? null)})`;

async function writeSheet(browser, frames, { title, file, frameWidth }) {
  const { cell, cols } = sheetLayout(frameWidth, frames.length);
  const page = await browser.newPage({ width: SHEET_WIDTH + 24, height: 900, deviceScaleFactor: 1 });
  try {
    const size = await page.evaluate(inPage(drawSheetInPage, { title, cell, cols, frames: frames.map((frame) => ({ src: `data:image/jpeg;base64,${frame.bytes.toString("base64")}`, label: `${frame.t.toFixed(1).replace(".", ",")} s` })) }), { timeoutMs: 60000 });
    const { data } = await page.send("Page.captureScreenshot", { format: "jpeg", quality: 85, fromSurface: true, captureBeyondViewport: true, clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 } }, 60000);
    writeFileAtomic(file, Buffer.from(data, "base64"));
    return { cols, cell };
  } finally {
    await page.close();
  }
}

async function filmPass(browser, { url, select, pass, everySeconds, count, outDir, onProgress }) {
  const page = await browser.newPage({ width: pass.width, height: pass.height, deviceScaleFactor: pass.scale });
  let network = null;
  try {
    await page.send("Network.enable");
    network = trackNetwork(page, null);
    await setMetrics(page, pass);
    if (pass.mobile) {
      await page.send("Emulation.setUserAgentOverride", { userAgent: MOBILE_USER_AGENT, acceptLanguage: ACCEPT_LANGUAGE, platform: "Android" }).catch(() => null);
      await page.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }).catch(() => null);
    }
    await page.setReducedMotion(pass.reduced);
    await page.goto(url);
    await waitForNetworkQuiet(network);
    await dismissCookies(page);
    const placed = await page.evaluate(inPage(placeInPage, select), { awaitPromise: false });
    const base = { id: pass.id, label: pass.label, width: pass.width, reduced: pass.reduced };
    if (!placed.found || !placed.visible) return { ...base, found: Boolean(placed.found), visible: false, frames: 0, sheet: null, files: [], changes: 0, distinct: 0, longest_still_s: 0, returns_to_first_at_s: null, late: 0 };
    await sleep(SETTLE_MS);

    const frames = [];
    let late = 0;
    let clip = null;
    const started = Date.now();
    for (let i = 0; i < count; i++) {
      const due = started + i * everySeconds * 1000;
      const wait = due - Date.now();
      if (wait > 0) await sleep(wait);
      else if (i > 0 && wait < -everySeconds * 500) late += 1;
      clip = await page.evaluate(inPage(clipInPage, select), { awaitPromise: false });
      const { data } = await page.send("Page.captureScreenshot", { format: "jpeg", quality: 85, fromSurface: true, optimizeForSpeed: true, clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 1 } }, 30000);
      const bytes = Buffer.from(data, "base64");
      const name = `${pass.id}-${String(i + 1).padStart(2, "0")}.jpg`;
      writeFileAtomic(join(outDir, name), bytes);
      frames.push({ t: (Date.now() - started) / 1000, file: name, bytes, hash: createHash("sha1").update(bytes).digest("hex") });
    }
    onProgress(`Filmagem (${pass.label}): ${frames.length} quadros`);
    const sheet = `${pass.id}.jpg`;
    await writeSheet(browser, frames, { title: `${pass.label}: ${pass.width} px, um quadro a cada ${String(everySeconds).replace(".", ",")} s`, file: join(outDir, sheet), frameWidth: clip?.width ?? pass.width });
    return {
      ...base,
      found: true,
      visible: true,
      frames: frames.length,
      sheet,
      files: frames.map((frame) => frame.file),
      size: clip ? { width: Math.round(clip.width), height: Math.round(clip.height), cropped: Boolean(clip.cropped) } : null,
      late,
      ...filmStats(frames, everySeconds),
      page_errors: [...new Set(page.errors)].slice(0, 4),
    };
  } finally {
    network?.stop();
    await page.close();
  }
}

/**
 * Films `select` (or the first screen when there is none) of `input` into `outDir`, writing one sheet
 * per pass and filme.json. A page saved as .mhtml runs no script, so there is nothing to film.
 */
export async function filmPage({ input, select = null, everySeconds = 1, count = 16, outDir, browserPath = null, onProgress = () => {} }) {
  const url = normalizeUrl(input);
  if (inputKind(url) === "mhtml") throw new AppError("film_saved_page", "Uma página salva não roda script, então não há movimento para filmar.", "Filme o endereço da página, no computador ou publicado. Com login, abra um endereço de teste que não peça login.");
  ensureDir(outDir);
  const browser = await Browser.launch({ path: browserPath, width: FILM_PASSES[0].width, height: FILM_PASSES[0].height });
  const passes = {};
  try {
    for (const pass of FILM_PASSES) {
      onProgress(`Filmando no ${pass.label}…`);
      passes[pass.id] = await filmPass(browser, { url, select, pass, everySeconds, count: pass.reduced ? Math.min(count, REDUCED_FRAMES) : count, outDir, onProgress });
    }
  } catch (error) {
    if (error instanceof AppError && error.code === "page_load_failed") throw new AppError("site_unreachable", `Não consegui abrir ${input} (${error.message}).`, "Confira se a página está rodando e se o endereço está certo.");
    throw error;
  } finally {
    await browser.close();
  }
  if (select && !passes.desktop.found && !passes.mobile.found) throw new AppError("film_target_missing", `A página não tem nenhum elemento em ${select}.`, "Marque a cena com data-demo na página, ou confira o seletor.");
  const warnings = [];
  if (select && !passes.mobile.visible) warnings.push(`A cena não aparece no celular (${select}).`);
  if (select && !passes.desktop.visible) warnings.push(`A cena não aparece no computador (${select}).`);
  for (const pass of Object.values(passes)) {
    if (pass.late) warnings.push(`No ${pass.label}, ${pass.late} quadro(s) saíram atrasados: o intervalo não foi cumprido nesses pontos.`);
    if (pass.size?.cropped) warnings.push(`No ${pass.label}, a cena é maior que a tela, e os quadros mostram só a parte visível.`);
  }
  const result = { format_version: 1, url, select, mode: "real_time", every_s: everySeconds, count, filmed_at: new Date().toISOString(), passes, sheets: Object.values(passes).map((pass) => pass.sheet).filter(Boolean), warnings };
  writeJson(join(outDir, "filme.json"), result);
  return result;
}
