// The preview page: the app's runtime/preview.html with the carousel's data injected where the
// `/*__CAROUSEL__*/` token sits, so the member sees the slides inside a phone mock.

import { readFileSync } from "node:fs";

import { FORMATS } from "./storyboard.mjs";
import { AppError, writeFileAtomic } from "./util.mjs";

export const PREVIEW_TOKEN = "/*__CAROUSEL__*/";
/** The token, plus a `null` or `{}` stand-in the page may keep after it so it also runs untouched. */
const TOKEN_PATTERN = /\/\*__CAROUSEL__\*\/\s*(?:null|\{\})?/g;
/** Line and paragraph separators (U+2028, U+2029) end a JavaScript line; built from char codes so an editor never turns them into the real characters here. */
const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), "g");
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), "g");
const CLOSING_TAG = /<\//g;
export const INSTALL_SELF = "npx --yes flyee@latest add motion-carousel --yes --json";

/**
 * What the preview page receives. `files` maps a slide number to `{ file, rendered }`, with `file`
 * relative to the carousel folder (where preview.html lives), forward slashes.
 */
export function previewData({ storyboard, times, mode, files = {} }) {
  const size = FORMATS[storyboard.format];
  return {
    title: storyboard.title,
    format: { name: storyboard.format, width: size.width, height: size.height },
    slides: storyboard.slides.map((slide) => {
      const slot = times.slides.find((entry) => entry.n === slide.n);
      const info = files[slide.n] ?? {};
      return {
        n: slide.n,
        file: info.file ?? `${mode === "previa" ? "previa" : "out"}/${String(slide.n).padStart(2, "0")}.mp4`,
        duration: slot ? slot.duration : null,
        role: slide.role,
        title: slide.title,
        rendered: Boolean(info.rendered),
      };
    }),
    mode,
    bpm: storyboard.bpm,
  };
}

/** The page with the JSON in place; safe inside a <script> (no `</` sequence or line separator survives). */
export function injectPreview(template, data) {
  if (!template.includes(PREVIEW_TOKEN)) {
    throw new AppError("runtime_missing", "A página de prévia do app não tem o marcador /*__CAROUSEL__*/.", `Reinstale o app Carrossel animado: ${INSTALL_SELF}, depois repita.`);
  }
  const json = JSON.stringify(data).replace(CLOSING_TAG, "<\\/").replace(LINE_SEPARATOR, "\\u2028").replace(PARAGRAPH_SEPARATOR, "\\u2029");
  return template.replace(TOKEN_PATTERN, () => json);
}

export function writePreview({ template, out, data }) {
  const html = injectPreview(readFileSync(template, "utf8"), data);
  writeFileAtomic(out, html);
  return out;
}
