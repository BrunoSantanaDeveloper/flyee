// Identifies what was passed in: a YouTube video, another web address or a local file.

import { statSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

import { AppError, shortHash, slugify } from "./util.mjs";

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
  "www.youtu.be",
]);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** The 11-character id of a YouTube address, or null. */
export function youtubeId(text) {
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;
  if (host.endsWith("youtu.be")) {
    const id = url.pathname.split("/")[1] ?? "";
    return YOUTUBE_ID.test(id) ? id : null;
  }
  const v = url.searchParams.get("v");
  if (v && YOUTUBE_ID.test(v)) return v;
  const [, kind, id] = url.pathname.split("/");
  if (["shorts", "live", "embed", "v", "e"].includes(kind) && YOUTUBE_ID.test(id ?? "")) return id;
  return null;
}

export function canonicalYoutubeUrl(id) {
  return `https://www.youtube.com/watch?v=${id}`;
}

const MIME_BY_EXTENSION = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".wmv": "video/x-ms-wmv",
  ".flv": "video/x-flv",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",
  ".3gp": "video/3gpp",
};

export function videoMime(path) {
  return MIME_BY_EXTENSION[extname(path).toLowerCase()] ?? "video/mp4";
}

/**
 * { type, id, input, url?, youtubeId?, path?, size? }. The id names the
 * analysis folder: the same video always lands in the same folder, so another
 * app reuses what is already there.
 */
export function identifySource(input, { cwd = process.cwd() } = {}) {
  const text = String(input ?? "").trim();
  if (!text) throw new AppError("usage", "Informe o vídeo: um endereço do YouTube, outro endereço ou o caminho de um arquivo.");
  const ytId = youtubeId(text);
  if (ytId) return { type: "youtube", id: `yt-${ytId}`, input: text, url: canonicalYoutubeUrl(ytId), youtubeId: ytId };
  if (/^https?:\/\//i.test(text)) {
    let url;
    try {
      url = new URL(text);
    } catch {
      throw new AppError("usage", `Endereço inválido: ${text}`);
    }
    return { type: "url", id: `url-${slugify(url.hostname.replace(/^www\./, ""), 20)}-${shortHash(url.href)}`, input: text, url: url.href };
  }
  const path = resolve(cwd, text);
  let info;
  try {
    info = statSync(path);
  } catch {
    throw new AppError("file_not_found", `Não encontrei o arquivo ${path}.`, "Confira o caminho; ele é lido a partir da pasta atual.");
  }
  if (!info.isFile()) throw new AppError("file_not_found", `${path} não é um arquivo de vídeo.`);
  const name = basename(path, extname(path));
  // Path, size and date: when the file changes, the old analysis is not reused.
  const id = `file-${slugify(name, 32)}-${shortHash(`${path}|${info.size}|${Math.floor(info.mtimeMs)}`)}`;
  return { type: "file", id, input: text, path, size: info.size };
}

/** An id already analyzed (for example `yt-dQw4w9WgXcQ`) also works as the target of the query commands. */
export function looksLikeId(text) {
  return /^(yt|url|file)-[A-Za-z0-9_-]+$/.test(String(text ?? "").trim());
}
