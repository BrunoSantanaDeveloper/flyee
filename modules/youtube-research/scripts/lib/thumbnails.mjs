// The thumbnail of a YouTube video as YouTube serves it: the largest of its
// fixed sizes that exists, as a JPG the AI can look at. Dependency-free
// (global fetch, Node 20+).

import { AppError } from "./util.mjs";

const HOST = "https://i.ytimg.com/vi";

/**
 * YouTube's fixed sizes, largest first. A custom thumbnail sent below 1280
 * pixels has no maxresdefault; the two last are 4:3, with black bands above and
 * below a 16:9 image.
 */
export const SIZES = [
  { name: "maxresdefault", width: 1280, height: 720, letterboxed: false },
  { name: "hq720", width: 1280, height: 720, letterboxed: false },
  { name: "sddefault", width: 640, height: 480, letterboxed: true },
  { name: "hqdefault", width: 480, height: 360, letterboxed: true },
];

// Below this is YouTube's gray placeholder, never a thumbnail; above it, something else.
const MIN_BYTES = 1000;
const MAX_BYTES = 8 * 1024 * 1024;
export const THUMBNAIL_TIMEOUT_MS = 20_000;

function networkError(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") {
    return new AppError("offline", "O YouTube não entregou a thumbnail a tempo.", "Tente de novo em alguns minutos.");
  }
  return new AppError("offline", "Não consegui baixar a thumbnail do YouTube.", "Confira a conexão com a internet e tente de novo.");
}

/**
 * Downloads the largest thumbnail of a video. A size YouTube does not have
 * answers 404 and the next one is tried; none at all is `not_found`.
 */
export async function downloadThumbnail(id, { fetchImpl = fetch, timeoutMs = THUMBNAIL_TIMEOUT_MS } = {}) {
  for (const size of SIZES) {
    const url = `${HOST}/${id}/${size.name}.jpg`;
    let response;
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "image/jpeg, image/*;q=0.8" } });
    } catch (error) {
      throw networkError(error);
    }
    if (response.status === 404) {
      await response.body?.cancel?.().catch(() => {});
      continue;
    }
    if (response.status === 429) {
      await response.body?.cancel?.().catch(() => {});
      throw new AppError("rate_limited", "O YouTube limitou os pedidos desta conexão por um tempo.", "Espere alguns minutos e tente de novo, com menos vídeos.");
    }
    if (!response.ok) {
      await response.body?.cancel?.().catch(() => {});
      throw new AppError("offline", `O YouTube recusou a thumbnail (HTTP ${response.status}).`, "Tente de novo em alguns minutos.");
    }
    let bytes;
    try {
      bytes = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      throw networkError(error);
    }
    const type = response.headers.get("content-type") ?? "";
    if (!/^image\//i.test(type) || bytes.length < MIN_BYTES || bytes.length > MAX_BYTES) continue;
    return { bytes, url, quality: size.name, width: size.width, height: size.height, letterboxed: size.letterboxed };
  }
  throw new AppError("not_found", "O YouTube não tem thumbnail para este vídeo.", "Confira o endereço do vídeo abrindo-o no navegador.");
}

const PROXY_VARIABLES = ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"];

/** Whether this Node's fetch honors NODE_USE_ENV_PROXY: 22.21 or later on the 22 line, and every 24 or later. */
export function nodeHonorsEnvProxy(version = process.versions.node) {
  const [major, minor] = version.split(".").map(Number);
  return major >= 24 || (major === 22 && minor >= 21);
}

/**
 * The environment to run the download again with, when a proxy is set and
 * Node's fetch would go around it; null otherwise. yt-dlp reads HTTPS_PROXY on
 * its own, but Node's fetch only with NODE_USE_ENV_PROXY=1, so in a cloud
 * session, where every request goes through a proxy, the thumbnail would fail
 * as if there were no network. Never over a NODE_USE_ENV_PROXY already set, on
 * a Node that ignores it, or with a proxy that is not an http(s) address (Node
 * stops at start on `127.0.0.1:7890` or `socks5h://…`).
 */
export function proxyRelaunchEnv(env = process.env, version = process.versions.node) {
  const values = PROXY_VARIABLES.map((name) => env[name]).filter(Boolean);
  if (!values.length || env.NODE_USE_ENV_PROXY !== undefined || !nodeHonorsEnvProxy(version)) return null;
  for (const value of values) {
    try {
      if (!["http:", "https:"].includes(new URL(value).protocol)) return null;
    } catch {
      return null;
    }
  }
  return { ...env, NODE_USE_ENV_PROXY: "1" };
}
