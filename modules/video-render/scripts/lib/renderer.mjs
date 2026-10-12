// The frame loop: open the page, seek each instant, screenshot it, pipe it to the encoder.
// Deterministic by construction: the same page and the same options give the same frames.

import { createHash } from "node:crypto";
import { copyFileSync } from "node:fs";
import { cpus } from "node:os";
import { join } from "node:path";

import { Browser } from "./browser.mjs";
import { concatSegments, muxAudio, startEncoder } from "./ffmpeg.mjs";
import { AppError, clamp, fileUrl, removeDir, round, tempDir } from "./util.mjs";

/** Named formats and their pixel sizes; a custom "WxH" also works. */
export const FORMATS = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "3:4": { width: 1080, height: 1440 },
};

export function parseFormat(text) {
  if (!text) return null;
  if (FORMATS[text]) return { name: text, ...FORMATS[text] };
  const m = /^(\d{2,5})x(\d{2,5})$/i.exec(String(text).trim());
  if (m) return { name: `${m[1]}x${m[2]}`, width: Number(m[1]), height: Number(m[2]) };
  throw new AppError("usage", `Formato desconhecido: ${text}.`, `Use ${Object.keys(FORMATS).join(", ")} ou LARGURAxALTURA.`);
}

/**
 * Injected before the page's own scripts: the render flag and a safe seek wrapper.
 * The screenshot that follows each seek forces layout and paint, so nothing waits on
 * the browser's own frame clock. A font used only on a canvas starts loading on the
 * first draw that asks for it and that draw falls back to another font, so a frame
 * that left a font loading is drawn again once it arrives.
 */
const INIT_SCRIPT = `
window.__FLYEE_RENDER__ = true;
window.__flyee = {
  async seek(t) {
    if (typeof window.seek !== "function") throw new Error("a página não define window.seek(t)");
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = window.seek(t);
      if (result && typeof result.then === "function") await result;
      if (!document.fonts || document.fonts.status !== "loading") break;
      await document.fonts.ready;
    }
    return true;
  },
  film() {
    const f = window.film || {};
    return {
      duration: Number(f.duration) || null,
      width: Number(f.width) || null,
      height: Number(f.height) || null,
      fps: Number(f.fps) || null,
      background: f.background || null,
      formats: Array.isArray(f.formats) ? f.formats : null,
      cuts: Array.isArray(f.cuts) ? f.cuts : null,
      has_seek: typeof window.seek === "function",
      has_set_format: typeof window.setFormat === "function",
      has_boxes: typeof window.boxes === "function",
      title: f.title || null,
    };
  },
};
`;

/** Reads window.film and checks the page can be rendered. */
export async function inspectPage(page, url) {
  await page.addInitScript(INIT_SCRIPT);
  await page.goto(url);
  const film = await page.evaluate("window.__flyee.film()");
  if (!film.has_seek) throw new AppError("page_no_seek", "A página não define window.seek(t).", "Toda página renderizável desenha o quadro do instante t em window.seek(t); veja o guia da página.");
  if (page.errors.length) throw new AppError("page_error", `A página deu erro ao carregar: ${page.errors[0]}`, "Corrija o JavaScript da página e renderize de novo.");
  return film;
}

async function openPage(browser, { url, width, height, scale, transparent, format }) {
  const page = await browser.newPage({ width, height, deviceScaleFactor: scale });
  if (transparent) await page.setTransparent(true);
  const film = await inspectPage(page, url);
  if (format && needsSetFormat(film, format)) {
    if (film.has_set_format) {
      await page.evaluate(`window.setFormat(${JSON.stringify({ name: format.name, width: format.width, height: format.height })})`);
    } else if (film.width && film.height) {
      throw new AppError("format_unsupported", `A página não aceita o formato ${format.name}.`, "Defina window.setFormat({ name, width, height }) na página, ou renderize no tamanho dela.");
    }
    // a page that declares no size and has no setFormat is drawn at the requested size as it is
  }
  return { page, film };
}

/** setFormat is called only when the requested size differs from the one the page declares. */
export function needsSetFormat(film, format) {
  if (!format) return false;
  return !(film.width === format.width && film.height === format.height);
}

/** A browser only to read the film declaration; closed by the caller. */
async function probeFilm({ url, format, browserPath }) {
  const browser = await Browser.launch({ path: browserPath, width: format?.width ?? 1080, height: format?.height ?? 1920 });
  try {
    const page = await browser.newPage({ width: format?.width ?? 1080, height: format?.height ?? 1920 });
    const film = await inspectPage(page, url);
    await page.close();
    return { browser, film };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

function workerCount(requested, frames) {
  if (requested) return Math.max(1, Math.min(8, requested));
  const cores = cpus().length || 2;
  if (frames < 120 || cores < 4) return 1;
  return Math.min(4, cores - 1, Math.ceil(frames / 90));
}

const digest = (buffer) => createHash("sha256").update(buffer).digest();

/**
 * Renders a page to a video file. Options: fps, sub (subframes blended for motion
 * blur), start/end seconds, format (named or WxH), scale (0.1–1 of the pixel size),
 * alpha (transparent layer; .mov or .webm), frameFormat png|jpeg, crf, parallel,
 * audio (a file muxed at the end), browserPath, onProgress(done, total).
 */
export async function renderPage({ pagePath, out, tools, fps = 30, sub = 1, start = 0, end = null, format = null, scale = 1, alpha = false, frameFormat = "png", quality = 92, crf = 16, parallel = null, audio = null, browserPath = null, onProgress = () => {} }) {
  const url = fileUrl(pagePath);
  const startedAt = Date.now();
  const { browser: probeBrowser, film } = await probeFilm({ url, format, browserPath });
  const width = format?.width ?? film.width ?? 1080;
  const height = format?.height ?? film.height ?? 1920;
  const duration = film.duration ?? end;
  if (!duration) {
    await probeBrowser.close();
    throw new AppError("page_no_duration", "A página não diz a duração (window.film.duration) e nenhum --end foi dado.", "Defina window.film = { duration, width, height } ou passe --end.");
  }
  const stop = end !== null ? Math.min(end, duration) : duration;
  if (stop <= start) {
    await probeBrowser.close();
    throw new AppError("usage", "O fim do trecho precisa vir depois do início.");
  }
  const frameFps = fps || film.fps || 30;
  const total = Math.max(1, Math.round((stop - start) * frameFps));
  const workers = workerCount(parallel, total);
  const pixelWidth = Math.round(width * scale);
  const pixelHeight = Math.round(height * scale);
  const temp = tempDir("flyee-render-");
  const warnings = [];
  const pageErrors = [];
  const frameDigests = new Array(total * sub);
  let done = 0;

  const renderRange = async (from, to, outFile, existingBrowser = null) => {
    const browser = existingBrowser ?? (await Browser.launch({ path: browserPath, width: pixelWidth, height: pixelHeight }));
    try {
      const { page } = await openPage(browser, { url, width, height, scale, transparent: alpha, format });
      const encoder = startEncoder(tools.ffmpeg.path, { out: outFile, fps: frameFps, sub, frameFormat, alpha, crf, width: pixelWidth, height: pixelHeight });
      try {
        for (let f = from; f < to; f++) {
          for (let s = 0; s < sub; s++) {
            const t = round(start + (f + s / sub) / frameFps, 6);
            await page.evaluate(`window.__flyee.seek(${t})`, { timeoutMs: 30000 });
            const frame = await page.screenshot({ format: frameFormat, quality });
            frameDigests[f * sub + s] = digest(frame);
            await encoder.write(frame);
          }
          done++;
          onProgress(done, total);
        }
        await encoder.end();
      } catch (error) {
        encoder.kill();
        throw error;
      }
      if (page.errors.length) pageErrors.push(...page.errors);
      if (page.console.length) pageErrors.push(...page.console.slice(0, 5));
      await page.close();
    } finally {
      await browser.close();
    }
  };

  try {
    if (workers === 1) {
      await renderRange(0, total, out, probeBrowser);
    } else {
      await probeBrowser.close();
      const per = Math.ceil(total / workers);
      const segments = [];
      const jobs = [];
      for (let w = 0; w < workers; w++) {
        const from = w * per;
        const to = Math.min(total, from + per);
        if (from >= to) break;
        const segment = join(temp, `segment-${String(w).padStart(2, "0")}${out.slice(out.lastIndexOf("."))}`);
        segments.push(segment);
        jobs.push(renderRange(from, to, segment));
      }
      await Promise.all(jobs);
      await concatSegments(tools.ffmpeg.path, segments, out, join(temp, "segments.txt"));
    }
    if (audio) {
      const muxed = join(temp, `muxed${out.slice(out.lastIndexOf("."))}`);
      await muxAudio(tools.ffmpeg.path, out, audio, muxed);
      copyFileSync(muxed, out);
    }
  } finally {
    removeDir(temp);
  }
  const hash = createHash("sha256");
  for (const d of frameDigests) if (d) hash.update(d);
  if (pageErrors.length) warnings.push(`A página registrou erros durante o render: ${[...new Set(pageErrors)].slice(0, 3).join(" | ")}`);
  if (scale !== 1) warnings.push(`Render em ${Math.round(scale * 100)}% do tamanho (${pixelWidth}×${pixelHeight}).`);
  return {
    file: out,
    width: pixelWidth,
    height: pixelHeight,
    fps: frameFps,
    subframes: sub,
    frames: total,
    duration: round(total / frameFps),
    start,
    end: stop,
    format: format?.name ?? `${width}x${height}`,
    alpha,
    workers,
    elapsed_ms: Date.now() - startedAt,
    frames_hash: hash.digest("hex"),
    film,
    warnings,
  };
}

/** Screenshots of a page at the given instants; returns PNG buffers in order. */
export async function captureFrames({ pagePath, times, tools, format = null, scale = 1, alpha = false, browserPath = null, frameFormat = "png" }) {
  const url = fileUrl(pagePath);
  const { browser, film } = await probeFilm({ url, format, browserPath });
  try {
    const width = format?.width ?? film.width ?? 1080;
    const height = format?.height ?? film.height ?? 1920;
    const { page } = await openPage(browser, { url, width, height, scale: clamp(scale, 0.1, 1), transparent: alpha, format });
    const frames = [];
    for (const t of times) {
      await page.evaluate(`window.__flyee.seek(${round(t, 6)})`, { timeoutMs: 30000 });
      frames.push({ time: t, data: await page.screenshot({ format: frameFormat }) });
    }
    return { film, width: Math.round(width * scale), height: Math.round(height * scale), frames, errors: page.errors };
  } finally {
    await browser.close();
  }
}

/** The boxes the page declares (text, logo, face…) at the given instants, for the acceptance checks. */
export async function sampleBoxes({ pagePath, times, format = null, browserPath = null }) {
  const url = fileUrl(pagePath);
  const { browser, film } = await probeFilm({ url, format, browserPath });
  try {
    if (!film.has_boxes) return { film, samples: null };
    const width = format?.width ?? film.width ?? 1080;
    const height = format?.height ?? film.height ?? 1920;
    const { page } = await openPage(browser, { url, width, height, scale: 1, transparent: false, format });
    const samples = [];
    for (const t of times) {
      await page.evaluate(`window.__flyee.seek(${round(t, 6)})`, { timeoutMs: 30000 });
      const boxes = await page.evaluate(`JSON.parse(JSON.stringify(window.boxes(${round(t, 6)}) || []))`);
      samples.push({ time: t, boxes: Array.isArray(boxes) ? boxes : [] });
    }
    return { film, width, height, samples };
  } finally {
    await browser.close();
  }
}
