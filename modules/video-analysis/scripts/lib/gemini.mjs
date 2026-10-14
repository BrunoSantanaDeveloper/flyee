// Minimal Gemini API client: a YouTube video by address, a file through the File API, a JSON reply.
// The key comes only from GEMINI_API_KEY and is never written or printed.

import { createReadStream, statSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

import { AppError } from "./util.mjs";

export const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
/** Google's alias for the latest Flash; changes that break come with two weeks' notice. */
export const DEFAULT_MODEL = "gemini-flash-latest";
export const RESOLUTIONS = { low: "MEDIA_RESOLUTION_LOW", medium: "MEDIA_RESOLUTION_MEDIUM", high: "MEDIA_RESOLUTION_HIGH" };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** HTTP without a total time limit: Gemini can spend minutes watching a long video. */
function request({ method = "GET", url, headers = {}, body, file, idleLimitMs = 15 * 60 * 1000 }) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const send = target.protocol === "http:" ? httpRequest : httpsRequest;
    const req = send(target, { method, headers }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    req.setTimeout(idleLimitMs, () => req.destroy(new Error("no response before the time limit")));
    req.on("error", (error) => reject(new AppError("offline", "Não consegui falar com a API do Gemini.", String(error.message ?? error))));
    if (file) {
      const stream = createReadStream(file);
      stream.on("error", (error) => req.destroy(error));
      stream.pipe(req);
    } else {
      req.end(body);
    }
  });
}

function readError(body) {
  try {
    const data = JSON.parse(body);
    return data.error ?? data[0]?.error ?? {};
  } catch {
    return { message: String(body ?? "").slice(0, 300) };
  }
}

/** A stable code and guidance for each API failure. */
export function classifyGeminiError(status, body) {
  const error = readError(body);
  const message = String(error.message ?? "").slice(0, 400);
  const detail = message ? `Resposta do Gemini: ${message}` : `HTTP ${status}`;
  if (/API key not valid|API_KEY_INVALID|api key expired/i.test(message + JSON.stringify(error.details ?? ""))) {
    return new AppError("gemini_invalid_key", "A chave GEMINI_API_KEY não foi aceita pelo Gemini.", "Confira a chave no Google AI Studio e salve de novo a certa: rode você mesmo npx --yes flyee@latest key set GEMINI_API_KEY --browser --json, que abre a página no navegador do integrante. Se ele usa uma variável de ambiente com esse nome, é ela que vale.");
  }
  if (status === 429) {
    return new AppError("gemini_quota", "O limite de uso da sua chave do Gemini foi atingido.", `O Google limita os pedidos por minuto de cada chave e, no uso comum, as horas de vídeo do YouTube por dia. Espere e tente de novo, ou analise um trecho com --start e --end. ${detail}`);
  }
  if (status === 403) return new AppError("gemini_permission", "A chave não tem permissão para este pedido.", detail);
  if (status === 404) {
    return new AppError("gemini_model_not_found", "O modelo pedido não existe ou não está liberado para a sua chave.", `Tente sem --model, ou com outro modelo. ${detail}`);
  }
  if (status >= 500) return new AppError("gemini_unavailable", "A API do Gemini está instável agora.", `Tente de novo em alguns minutos. ${detail}`);
  if (/token|too long|exceeds|context/i.test(message)) {
    return new AppError("gemini_too_long", "O vídeo é longo demais para uma análise só.", `Analise por partes com --start e --end. ${detail}`);
  }
  if (/youtube|video|file_?uri|fileUri|media|private|unlisted|not accessible|unable to process/i.test(message)) {
    return new AppError(
      "gemini_video_inaccessible",
      "O Gemini não conseguiu abrir o vídeo.",
      `Pelo endereço, o Gemini só lê vídeos públicos do YouTube; vídeos privados ou não listados precisam ser baixados e enviados. ${detail}`,
    );
  }
  return new AppError("gemini_failed", "O Gemini recusou o pedido.", detail);
}

function retryDelaySeconds(body) {
  const info = (readError(body).details ?? []).find((item) => String(item["@type"] ?? "").includes("RetryInfo"));
  const seconds = Number(String(info?.retryDelay ?? "").replace(/s$/, ""));
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

export async function getFile({ key, baseUrl = DEFAULT_BASE_URL, name }) {
  const res = await request({ url: `${baseUrl}/v1beta/${name}`, headers: { "x-goog-api-key": key } });
  if (res.status >= 400) throw classifyGeminiError(res.status, res.body);
  return JSON.parse(res.body);
}

/** Uploads a file through the File API and waits until Gemini has processed it. */
export async function uploadFile({ key, baseUrl = DEFAULT_BASE_URL, path, mime, displayName, onProgress = () => {} }) {
  const size = statSync(path).size;
  const start = await request({
    method: "POST",
    url: `${baseUrl}/upload/v1beta/files`,
    headers: {
      "x-goog-api-key": key,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(size),
      "X-Goog-Upload-Header-Content-Type": mime,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });
  if (start.status >= 400) throw classifyGeminiError(start.status, start.body);
  const uploadUrl = start.headers["x-goog-upload-url"];
  if (!uploadUrl) throw new AppError("gemini_failed", "O Gemini não devolveu o endereço para enviar o arquivo.");
  onProgress(`Enviando ${(size / 1024 / 1024).toFixed(1)} MB ao Gemini…`);
  const sent = await request({
    method: "POST",
    url: uploadUrl,
    headers: { "Content-Length": String(size), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" },
    file: path,
  });
  if (sent.status >= 400) throw classifyGeminiError(sent.status, sent.body);
  let file = JSON.parse(sent.body).file ?? {};
  const deadline = Date.now() + 20 * 60 * 1000;
  while (file.state === "PROCESSING") {
    if (Date.now() > deadline) throw new AppError("gemini_failed", "O Gemini demorou demais para processar o vídeo enviado.");
    await sleep(5000);
    file = await getFile({ key, baseUrl, name: file.name });
  }
  if (file.state !== "ACTIVE") {
    throw new AppError("gemini_failed", "O Gemini não conseguiu processar o vídeo enviado.", file.error?.message ?? `estado: ${file.state ?? "desconhecido"}`);
  }
  return { name: file.name, uri: file.uri, mime: file.mimeType ?? mime, expires_at: file.expirationTime ?? null };
}

/** Is an earlier upload still usable? (Gemini keeps uploaded files for 48 hours) */
export async function uploadStillValid({ key, baseUrl, upload }) {
  if (!upload?.name || !upload?.uri) return false;
  if (upload.expires_at && Date.parse(upload.expires_at) < Date.now() + 15 * 60 * 1000) return false;
  try {
    return (await getFile({ key, baseUrl, name: upload.name })).state === "ACTIVE";
  } catch {
    return false;
  }
}

/** The request part pointing at the video: a YouTube address or an uploaded file, with optional window and fps. */
export function videoPart({ uri, mime, start, end, fps }) {
  const part = { fileData: mime ? { fileUri: uri, mimeType: mime } : { fileUri: uri } };
  const metadata = {};
  if (start !== undefined && start !== null) metadata.startOffset = `${Math.max(0, start).toFixed(1)}s`;
  if (end !== undefined && end !== null) metadata.endOffset = `${end.toFixed(1)}s`;
  if (fps) metadata.fps = fps;
  if (Object.keys(metadata).length) part.videoMetadata = metadata;
  return part;
}

/**
 * Asks for the analysis. Retries on instability (5xx) and once on a
 * per-minute limit; if the API rejects an optional config field, retries without it.
 */
export async function generate({ key, baseUrl = DEFAULT_BASE_URL, model = DEFAULT_MODEL, parts, config = {}, onProgress = () => {} }) {
  const modelName = String(model).replace(/^models\//, "");
  const url = `${baseUrl}/v1beta/models/${encodeURIComponent(modelName)}:generateContent`;
  const generationConfig = { ...config };
  let unstableRetries = 0;
  let waitedForQuota = false;
  for (;;) {
    const body = JSON.stringify({ contents: [{ role: "user", parts }], generationConfig });
    const res = await request({ method: "POST", url, headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body });
    if (res.status === 200) {
      const data = JSON.parse(res.body);
      const candidate = data.candidates?.[0];
      if (!candidate) {
        throw new AppError("gemini_refused", "O Gemini se recusou a analisar este vídeo.", `Motivo informado: ${data.promptFeedback?.blockReason ?? "sem resposta"}.`);
      }
      const text = (candidate.content?.parts ?? [])
        .filter((part) => !part.thought && typeof part.text === "string")
        .map((part) => part.text)
        .join("");
      if (!text.trim()) {
        throw new AppError("gemini_refused", "O Gemini não devolveu texto para este vídeo.", `Motivo do fim: ${candidate.finishReason ?? "desconhecido"}.`);
      }
      return { text, finishReason: candidate.finishReason ?? null, usage: data.usageMetadata ?? null, model: data.modelVersion ?? modelName };
    }
    const message = String(readError(res.body).message ?? "");
    const rejectedField = res.status === 400 && /Unknown name|Cannot find field|Invalid JSON payload/i.test(message);
    const optional = ["responseMimeType", "mediaResolution"].filter((field) => field in generationConfig);
    if (rejectedField && optional.length) {
      for (const field of optional) delete generationConfig[field];
      continue;
    }
    if (res.status >= 500 && unstableRetries < 2) {
      unstableRetries++;
      const wait = unstableRetries === 1 ? 5 : 15;
      onProgress(`O Gemini respondeu ${res.status}; tentando de novo em ${wait} s…`);
      await sleep(wait * 1000);
      continue;
    }
    if (res.status === 429 && !waitedForQuota && !/per ?day|daily|PerDay/i.test(res.body)) {
      const wait = Math.min(retryDelaySeconds(res.body) ?? 20, 60);
      waitedForQuota = true;
      onProgress(`Limite por minuto do Gemini; esperando ${Math.ceil(wait)} s…`);
      await sleep(wait * 1000);
      continue;
    }
    throw classifyGeminiError(res.status, res.body);
  }
}

/** The reply's JSON, even when wrapped in a code block. Null when there is no readable JSON. */
export function parseJsonReply(text) {
  const clean = String(text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(clean);
  } catch {
    const open = clean.indexOf("{");
    const close = clean.lastIndexOf("}");
    if (open >= 0 && close > open) {
      try {
        return JSON.parse(clean.slice(open, close + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
