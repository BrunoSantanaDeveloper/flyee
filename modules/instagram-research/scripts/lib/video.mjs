// The video of a collected Reels, saved in the project so the video analysis app can watch it.
// The collection brings a signed link that stops working at the time written in it (linkExpiry),
// so the download happens soon after the collection, only for the Reels someone picked, with a
// size ceiling and only from Instagram's media servers, the hosts the manifest declares.

import { closeSync, mkdirSync, openSync, renameSync, rmSync, writeSync } from "node:fs";
import { dirname } from "node:path";

import { isCloudSession } from "./apify.mjs";
import { linkExpiry } from "./instagram.mjs";
import { AppError } from "./util.mjs";

/** Reels per command: the outliers worth watching, never a whole collection. */
export const MAX_VIDEOS = 5;
export const DEFAULT_MAX_MB = 100;
export const MAX_MB = 500;
const MB = 1024 * 1024;
const MAX_HOPS = 3;
const MEDIA_HOST = /^(?:[a-z0-9-]+\.)*(?:cdninstagram\.com|fbcdn\.net)$/;
/** Only a fake on this machine may stand in for Instagram's servers (tests). */
const LOOPBACK = /^(?:127\.0\.0\.1|localhost)$/;

/** Whether a link points at Instagram's media servers over https (or at a fake on this machine). */
export function mediaLinkAllowed(link) {
  let url;
  try {
    url = new URL(link);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  if (url.protocol === "https:" && MEDIA_HOST.test(url.hostname)) return true;
  return url.protocol === "http:" && LOOPBACK.test(url.hostname);
}

const day = (iso) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} (UTC)`;
const REFRESH_FIX = "O link só vale por um tempo depois da coleta. Para baixar, colha o perfil de novo com profile <@perfil> --refresh, que é uma coleta paga: diga o custo ao integrante antes. Ou peça o arquivo do vídeo a ele.";

export function expiredLink(expiresAt) {
  return new AppError("video_link_expired", expiresAt ? `O link do vídeo venceu em ${day(expiresAt)}.` : "O Instagram recusou o link do vídeo: ele venceu ou foi trocado.", REFRESH_FIX);
}

function tooLarge(maxBytes, size) {
  const known = typeof size === "number" && Number.isFinite(size) ? ` (tem ${Math.ceil(size / MB)} MB)` : "";
  return new AppError("video_too_large", `O vídeo passa do limite de ${Math.round(maxBytes / MB)} MB${known}.`, `Se valer a pena, repita com --max-mb maior, até ${MAX_MB}; ou peça o arquivo do vídeo ao integrante.`);
}

function failed(message) {
  return new AppError("video_download_failed", message, "Tente de novo em alguns minutos; se repetir, peça o arquivo do vídeo ao integrante.");
}

function networkError(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return failed("O download do vídeo passou do tempo e foi interrompido.");
  const fix = isCloudSession()
    ? "Numa sessão do Claude Code na nuvem, a rede do ambiente precisa liberar cdninstagram.com e fbcdn.net: rode npx --yes flyee@latest doctor --json, que devolve o passo para o integrante."
    : "Confira a conexão com a internet e tente de novo.";
  return new AppError("offline", "Não consegui falar com o servidor de vídeos do Instagram.", fix);
}

function statusError(status) {
  if (status === 403 || status === 410) return expiredLink(null);
  if (status === 404) return new AppError("video_unavailable", "O vídeo não está mais no servidor do Instagram: o post pode ter sido apagado.", "Confira o post com o integrante.");
  if (status === 429) return new AppError("rate_limited", "O servidor de vídeos do Instagram pediu para esperar um pouco.", "Tente de novo em alguns minutos.");
  return failed(`O servidor de vídeos do Instagram respondeu com erro ${status}.`);
}

const cancel = (response) => response.body?.cancel().catch(() => {});

/** Writes the whole chunk: a write may take fewer bytes than it was given. */
function writeAll(fd, chunk) {
  let offset = 0;
  while (offset < chunk.byteLength) offset += writeSync(fd, chunk, offset, chunk.byteLength - offset);
}

/**
 * Saves the video at `link` into `target` (an .mp4) through a temporary file renamed at the end,
 * so a half download never looks like a video. Refuses before any request when the link has
 * expired, before following a server that is not Instagram's, and as soon as the size passes
 * `maxBytes`. Nothing but the link goes out: no key, no cookie, no login.
 */
export async function downloadVideo({ link, target, maxBytes, fetchImpl = fetch, now = Date.now(), timeoutMs = 5 * 60 * 1000 }) {
  const expiresAt = linkExpiry(link);
  if (expiresAt && Date.parse(expiresAt) <= now) throw expiredLink(expiresAt);
  const signal = AbortSignal.timeout(timeoutMs);
  let url = link;
  let response;
  for (let hop = 0; ; hop += 1) {
    if (!mediaLinkAllowed(url)) {
      throw new AppError("video_link_invalid", "O link do vídeo não leva a um servidor de mídia do Instagram.", "Colha o perfil de novo com --refresh; se repetir, peça o arquivo do vídeo ao integrante.");
    }
    try {
      response = await fetchImpl(url, { redirect: "manual", signal, headers: { Accept: "video/*, */*;q=0.5" } });
    } catch (error) {
      throw networkError(error);
    }
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location && hop < MAX_HOPS) {
      await cancel(response);
      url = new URL(location, url).href;
      continue;
    }
    break;
  }
  if (!response.ok) {
    await cancel(response);
    throw statusError(response.status);
  }
  const type = String(response.headers.get("content-type") ?? "").toLowerCase();
  if (type && !/^(?:video\/|application\/octet-stream|binary\/octet-stream)/.test(type)) {
    await cancel(response);
    throw failed(`O servidor não devolveu um vídeo (veio ${type.split(";")[0].trim()}).`);
  }
  const declared = Number(response.headers.get("content-length") ?? Number.NaN);
  if (Number.isFinite(declared) && declared > maxBytes) {
    await cancel(response);
    throw tooLarge(maxBytes, declared);
  }
  mkdirSync(dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.tmp`;
  let fd = openSync(temp, "w");
  let bytes = 0;
  const head = [];
  try {
    for await (const chunk of response.body ?? []) {
      bytes += chunk.byteLength;
      if (bytes > maxBytes) throw tooLarge(maxBytes, null);
      if (head.length < 12) head.push(...chunk.subarray(0, 12 - head.length));
      writeAll(fd, chunk);
    }
    closeSync(fd);
    fd = null;
    // An MP4 opens with its "ftyp" box at the fifth byte; anything else is not a video to analyze.
    if (!bytes || String.fromCharCode(...head.slice(4, 8)) !== "ftyp") throw failed("O arquivo que veio não é um vídeo MP4.");
    renameSync(temp, target);
  } catch (error) {
    if (fd !== null) closeSync(fd);
    rmSync(temp, { force: true });
    throw error instanceof AppError ? error : networkError(error);
  }
  return { bytes, expires_at: expiresAt };
}
