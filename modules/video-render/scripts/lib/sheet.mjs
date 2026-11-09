// One sheet of photos, drawn in a blank page of the browser: the frames of a film, or the bands of a
// whole page. It knows nothing about what the photos show.

import { clamp, writeFileAtomic } from "./util.mjs";

/** The widest sheet: wide enough to read a frame, narrow enough to open as one image. */
const SHEET_WIDTH = 1680;

/** How many frames fit across a sheet, and how wide each is shown. */
export function sheetLayout(frameWidth, count, sheetWidth = SHEET_WIDTH) {
  const cell = Math.min(Math.round(frameWidth), frameWidth > 480 ? 540 : 358);
  const cols = clamp(Math.floor(sheetWidth / (cell + 8)), 1, Math.max(1, count));
  return { cell, cols };
}

/* eslint-disable no-undef */
function drawSheetInPage({ title, cell, cols, frames }) {
  document.documentElement.style.background = "#1f2125";
  document.body.style.cssText = "margin:0;padding:12px;background:#1f2125;color:#fff;font:14px/1.3 system-ui,sans-serif;width:max-content";
  document.body.innerHTML = "";
  const head = document.createElement("div");
  head.textContent = title;
  head.style.cssText = "margin:0 0 10px";
  document.body.append(head);
  const grid = document.createElement("div");
  grid.style.cssText = `display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:8px;align-items:start`;
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

/** Writes `frames` ({ bytes, label }, JPEG) into one image at `file`. */
export async function writeSheet(browser, frames, { title, file, frameWidth }) {
  const { cell, cols } = sheetLayout(frameWidth, frames.length);
  const page = await browser.newPage({ width: SHEET_WIDTH + 24, height: 900, deviceScaleFactor: 1 });
  try {
    const size = await page.evaluate(inPage(drawSheetInPage, { title, cell, cols, frames: frames.map((frame) => ({ src: `data:image/jpeg;base64,${frame.bytes.toString("base64")}`, label: frame.label })) }), { timeoutMs: 60000 });
    const { data } = await page.send("Page.captureScreenshot", { format: "jpeg", quality: 85, fromSurface: true, captureBeyondViewport: true, clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 } }, 60000);
    writeFileAtomic(file, Buffer.from(data, "base64"));
    return { cols, cell };
  } finally {
    await page.close();
  }
}
