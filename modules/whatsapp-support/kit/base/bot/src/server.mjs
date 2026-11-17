// Ponto de entrada do contêiner do robô. Rotas: POST /chatwoot (avisos do robô da conta) e GET /health.

import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

import { createBot, VERSION } from "./bot.mjs";
import { createLogger } from "./log.mjs";

const MAX_BODY_BYTES = 1024 * 1024;

export function readEnv(source = process.env) {
  const required = ["CHATWOOT_URL", "PROJECT_URL", "SUPPORT_BOT_SECRET"];
  const missing = required.filter((name) => !String(source[name] ?? "").trim());
  if (missing.length) throw new Error(`faltam variáveis de ambiente: ${missing.join(", ")}`);
  const number = (name, fallback) => {
    const value = Number(source[name]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  };
  const keys = Object.fromEntries(Object.entries(source).filter(([name, value]) => /_API_KEY$/.test(name) && String(value ?? "").trim()));
  return {
    port: number("PORT", 8080),
    chatwootUrl: String(source.CHATWOOT_URL).trim(),
    projectUrl: String(source.PROJECT_URL).trim(),
    secret: String(source.SUPPORT_BOT_SECRET).trim(),
    debounceMs: number("DEBOUNCE_MS", 2500),
    configTtlMs: number("CONFIG_TTL_MS", 60000),
    configStaleMs: number("CONFIG_STALE_MS", 600000),
    // Por quanto tempo o perfil de quem escreve (rota contact) vale numa conversa antes de perguntar de novo.
    profileTtlMs: number("PROFILE_TTL_MS", 300000),
    keys,
    // Imagem, áudio e vídeo (media.mjs). O ffmpeg vem no Dockerfile do robô.
    ffmpegPath: String(source.FFMPEG_PATH ?? "").trim() || "ffmpeg",
    ffprobePath: String(source.FFPROBE_PATH ?? "").trim() || "ffprobe",
    // PDF (documents.mjs). O poppler vem no Dockerfile do robô.
    pdftotextPath: String(source.PDFTOTEXT_PATH ?? "").trim() || "pdftotext",
    pdftoppmPath: String(source.PDFTOPPM_PATH ?? "").trim() || "pdftoppm",
    mediaMaxBytes: number("MEDIA_MAX_MB", 100) * 1024 * 1024,
    mediaMaxMinutes: number("MEDIA_MAX_MINUTES", 30),
    mediaConcurrency: Math.max(1, number("MEDIA_CONCURRENCY", 2)),
    geminiTranscribeModel: String(source.MEDIA_GEMINI_MODEL ?? "").trim() || "gemini-3.1-flash-lite",
    openaiTranscribeModel: String(source.MEDIA_OPENAI_MODEL ?? "").trim() || "gpt-4o-mini-transcribe",
  };
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("corpo grande demais"), { code: "too_large" }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

export function startServer({ env = readEnv(), logger = createLogger(), fetchImpl = fetch } = {}) {
  const bot = createBot({ env, logger, fetchImpl });
  // Sem ffmpeg, imagem pequena ainda passa; áudio e vídeo não. O /health mostra o que foi conferido.
  bot.checkMedia().then(
    (ready) => logger.info({ event: "media", status: `${ready ? "ffmpeg" : "sem_ffmpeg"},${bot.health().media.pdf === false ? "sem_pdf" : "pdf"}` }),
    () => logger.warn({ event: "media", status: "sem_ffmpeg" }),
  );
  const send = (response, status, body) => {
    response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(body));
  };
  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", "http://robo").pathname.replace(/\/+$/, "") || "/";
    try {
      if (request.method === "GET" && path === "/health") return send(response, 200, bot.health());
      if (request.method === "POST" && path === "/chatwoot") {
        const rawBody = await readBody(request);
        const result = await bot.receive({ rawBody, headers: request.headers });
        return send(response, result.status, result.body);
      }
      return send(response, 404, { ok: false, code: "not_found" });
    } catch (error) {
      logger.error({ event: "request_failed", code: error?.code ?? "unexpected" });
      return send(response, error?.code === "too_large" ? 413 : 500, { ok: false, code: error?.code ?? "unexpected" });
    }
  });
  server.listen(env.port, () => logger.info({ event: "started", version: VERSION, port: env.port }));

  const stop = async () => {
    server.close();
    await Promise.race([bot.idle(), new Promise((resolve) => setTimeout(resolve, 10000))]);
    process.exit(0);
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  return { server, bot };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) startServer();
