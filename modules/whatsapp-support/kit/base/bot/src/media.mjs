// Imagem, áudio e vídeo que a pessoa manda (D28 do plano). O ffmpeg do contêiner faz o que é ferramenta,
// sem custo de API: separa o som, corta em partes, monta a grade de quadros do vídeo e reduz imagem grande.
// A transcrição é de um modelo (o Gemini, mais barato, ou a OpenAI), porque transcrever na CPU de uma VPS
// dividida sai mais lento e pior em português. Quando o projeto declara ai.transcription "project", a
// transcrição vai à rota transcribe dele, para quem não põe chave de IA no contêiner do robô.
// A imagem e a grade vão para a IA que já atende a conversa. PDF, planilha, CSV e documento de texto
// (D29) são lidos por documents.mjs, também sem custo de API.
// Nada aqui lança para o robô: o que não deu certo volta em skipped, com o código.

import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DOCUMENT_EXTENSIONS, DOCUMENT_LIMITS, documentFormat, documentName, readDocument } from "./documents.mjs";
import { requestJson } from "./http.mjs";

/** Tipos de imagem que as três IAs do kit leem direto; os outros viram JPEG pelo ffmpeg. */
export const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export const MEDIA_LIMITS = {
  /** Abaixo dos 5 MB por imagem da API do Claude, com folga; acima, o ffmpeg reduz. */
  imageBytes: 4_500_000,
  /** O lado maior que a IA aproveita; acima disso o provedor reduz e cobra igual. */
  imageSide: 1568,
  /** Partes de áudio de 10 minutos: em MP3 de 32 kbps, cerca de 2,4 MB cada. */
  chunkSeconds: 600,
  /** Para a rota transcribe do projeto, partes de 5 minutos: cerca de 1,6 MB no corpo, em base64. */
  projectChunkSeconds: 300,
  /** Quadros na grade do vídeo, em colunas de 4, cada um com 320 pixels de largura. */
  gridFrames: 12,
  gridColumns: 4,
  tileWidth: 320,
  /** Imagens por mensagem para a IA (fotos, prints e grades). */
  imagesPerTurn: 6,
};

export class MediaError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const EXTENSIONS = {
  image: /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i,
  audio: /\.(ogg|oga|opus|mp3|m4a|aac|wav|amr|flac|weba)$/i,
  video: /\.(mp4|mov|3gp|webm|mkv|avi|m4v)$/i,
  document: DOCUMENT_EXTENSIONS,
};

/**
 * image, audio, video, document ou null, pelo file_type do Chatwoot e, sem ele, pela extensão do endereço.
 * Um arquivo sem extensão nenhuma também é document: o adaptador do OpenWA chama de "file" o documento que
 * chega do WhatsApp sem nome, e o tipo ou os primeiros bytes dizem depois, no download, se é PDF ou planilha.
 */
export function mediaKind(attachment) {
  const type = String(attachment?.file_type ?? "").toLowerCase();
  if (["image", "audio", "video"].includes(type)) return type;
  const path = String(attachment?.data_url ?? "").split("?")[0];
  for (const [kind, pattern] of Object.entries(EXTENSIONS)) if (pattern.test(path) || pattern.test(`.${attachment?.extension ?? ""}`)) return kind;
  const name = path.split("/").pop() ?? "";
  if ((type === "file" || type === "") && path && !/\.[a-z0-9]{1,8}$/i.test(name) && !String(attachment?.extension ?? "").trim()) return "document";
  return null;
}

/** Quem transcreve: o Gemini com a chave dele, que custa menos; senão a OpenAI; sem as duas, ninguém. */
export function transcriberFor(keys, env = {}) {
  if (keys?.GEMINI_API_KEY) return { provider: "gemini", model: env.geminiTranscribeModel || "gemini-3.1-flash-lite", key: keys.GEMINI_API_KEY };
  if (keys?.OPENAI_API_KEY) return { provider: "openai", model: env.openaiTranscribeModel || "gpt-4o-mini-transcribe", key: keys.OPENAI_API_KEY };
  return null;
}

/**
 * O próprio projeto transcreve (ai.transcription "project" na configuração da conta). call manda
 * { mime, data, part, parts } assinado à rota transcribe e devolve { text }.
 */
export const projectTranscriber = (call) => ({ provider: "project", model: "project", call });

/** A grade do vídeo: quantos quadros, de quanto em quanto tempo, em quantas colunas e linhas. */
export function gridPlan(duration) {
  const seconds = Number.isFinite(duration) && duration > 0 ? duration : MEDIA_LIMITS.gridFrames;
  const frames = Math.max(1, Math.min(MEDIA_LIMITS.gridFrames, Math.floor(seconds)));
  const columns = Math.min(MEDIA_LIMITS.gridColumns, frames);
  const rows = Math.ceil(frames / columns);
  return { frames, columns, rows, fps: frames / seconds, interval: seconds / frames };
}

/** O endereço do anexo na rede interna: o robô só baixa do próprio Chatwoot, nunca de outro lugar. */
export function internalUrl(url, chatwootUrl) {
  const base = new URL(chatwootUrl);
  const source = new URL(String(url ?? ""), base);
  if (!/^https?:$/.test(source.protocol)) throw new MediaError("download_refused", "endereço de anexo inválido");
  return new URL(`${source.pathname}${source.search}`, base).href;
}

/**
 * Baixa o anexo pelo Chatwoot interno. O Active Storage responde com redirecionamento: o que volta para
 * /rails/ segue pela rede interna; um endereço assinado de armazenamento externo (S3) só segue em https.
 * Para no limite de tamanho sem ler o resto.
 */
export async function downloadAttachment(url, { chatwootUrl, maxBytes, fetchImpl = fetch, timeoutMs = 60000 }) {
  let target = internalUrl(url, chatwootUrl);
  for (let hop = 0; hop < 4; hop += 1) {
    const response = await fetchImpl(target, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new MediaError("download_failed", "redirecionamento sem destino");
      const next = new URL(location, target);
      if (next.pathname.startsWith("/rails/")) target = internalUrl(next.href, chatwootUrl);
      else if (next.protocol === "https:") target = next.href;
      else throw new MediaError("download_refused", "redirecionamento para fora do Chatwoot sem https");
      continue;
    }
    if (!response.ok) throw new MediaError("download_failed", `resposta ${response.status} ao baixar o anexo`);
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) throw new MediaError("too_large", "o anexo passa do limite de tamanho");
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > maxBytes) throw new MediaError("too_large", "o anexo passa do limite de tamanho");
      chunks.push(chunk);
    }
    const mime = String(response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    return { buffer: Buffer.concat(chunks), mime };
  }
  throw new MediaError("download_failed", "redirecionamentos demais");
}

/**
 * Roda um programa com limite de tempo. Passado o limite, encerra o processo e todos os filhos
 * (taskkill /T no Windows, o grupo de processos nos outros) e falha com tool_timeout.
 */
export function runProgram(command, args, { timeoutMs, stdout = false } = {}) {
  return new Promise((resolve, reject) => {
    const windows = process.platform === "win32";
    let child;
    try {
      child = spawn(command, args, { stdio: ["ignore", stdout ? "pipe" : "ignore", "pipe"], detached: !windows, windowsHide: true });
    } catch {
      reject(new MediaError("tool_missing", `${command} não está instalado no contêiner do robô`));
      return;
    }
    const out = [];
    let err = "";
    child.stdout?.on("data", (chunk) => out.push(chunk));
    child.stderr.on("data", (chunk) => {
      err = `${err}${chunk}`.slice(-2000);
    });
    const timer = setTimeout(() => {
      try {
        if (windows) spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true });
        else process.kill(-child.pid, "SIGKILL");
      } catch {
        // o processo já tinha saído
      }
      reject(new MediaError("tool_timeout", `${command} passou de ${Math.round(timeoutMs / 1000)} segundos`));
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new MediaError(error?.code === "ENOENT" ? "tool_missing" : "tool_failed", `${command} não rodou: ${error?.message ?? "erro"}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(out).toString("utf8"));
      else reject(new MediaError("tool_failed", `${command} saiu com ${code}: ${err.trim().split("\n").pop() ?? ""}`));
    });
  });
}

/** Duração e trilhas do arquivo pelo ffprobe. */
export async function probe(file, { ffprobe = "ffprobe", run = runProgram } = {}) {
  const output = await run(ffprobe, ["-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", file], { timeoutMs: 30000, stdout: true });
  const json = JSON.parse(output || "{}");
  const types = new Set((json.streams ?? []).map((stream) => stream.codec_type));
  const duration = Number(json.format?.duration);
  return { duration: Number.isFinite(duration) ? duration : null, hasAudio: types.has("audio"), hasVideo: types.has("video") };
}

/** Tempo para o ffmpeg trabalhar: cresce com a duração da mídia e nunca é curto demais. */
export const toolTimeout = (duration) => Math.max(60000, Math.ceil((Number(duration) || 60) * 2000));

/** O texto que a transcrição pede ao modelo. */
const TRANSCRIBE_PROMPT =
  "Transcreva a fala deste áudio, palavra por palavra, no idioma falado. Responda só com a transcrição, sem comentários e sem marcar tempos. Se não houver fala, responda com o texto vazio.";

/**
 * Transcreve uma parte de áudio (MP3). Devolve o texto, que pode ser vazio. part e parts contam as partes;
 * kind ("audio" ou "video") e seconds (a duração da parte, null quando não se sabe) vão ao projeto.
 */
export async function transcribe({ transcriber, buffer, fetchImpl = fetch, timeoutMs = 120000, part = 1, parts = 1, kind = "audio", seconds = null }) {
  if (transcriber.provider === "project") {
    const result = await transcriber.call({ kind, mime: "audio/mpeg", seconds, data: buffer.toString("base64"), part, parts });
    if (typeof result?.text !== "string") throw new MediaError(result?.code ?? "project_empty", "o projeto não devolveu a transcrição");
    return result.text.trim();
  }
  if (transcriber.provider === "gemini") {
    const base = (transcriber.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
    const body = {
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/mp3", data: buffer.toString("base64") } }, { text: TRANSCRIBE_PROMPT }] }],
    };
    const { json } = await requestJson(`${base}/models/${encodeURIComponent(transcriber.model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": transcriber.key },
      body,
      timeoutMs,
      retries: 1,
      fetchImpl,
    });
    return (json?.candidates?.[0]?.content?.parts ?? []).map((part) => part?.text ?? "").join("").trim();
  }
  const base = (transcriber.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "audio/mpeg" }), "audio.mp3");
  form.append("model", transcriber.model);
  form.append("response_format", "json");
  const response = await fetchImpl(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { authorization: `Bearer ${transcriber.key}` },
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new MediaError(`http_${response.status}`, `a transcrição respondeu ${response.status}`);
  return String(json?.text ?? "").trim();
}

/** Limita quantas mídias são processadas ao mesmo tempo no contêiner. */
function semaphore(limit) {
  let active = 0;
  const waiting = [];
  return async (task) => {
    if (active >= limit) await new Promise((resolve) => waiting.push(resolve));
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}

const minutes = (seconds) => {
  const total = Math.round(seconds);
  return total < 60 ? `${total} segundos` : `${Math.floor(total / 60)} min ${total % 60} s`;
};

/**
 * env: { chatwootUrl, ffmpegPath, ffprobePath, pdftotextPath, pdftoppmPath, mediaMaxBytes, mediaMaxMinutes,
 * mediaConcurrency, geminiTranscribeModel, openaiTranscribeModel, keys }. run e transcribeImpl trocam nos testes.
 */
export function createMedia({ env, fetchImpl = fetch, run = runProgram, transcribeImpl = transcribe }) {
  const ffmpeg = env.ffmpegPath || "ffmpeg";
  const ffprobe = env.ffprobePath || "ffprobe";
  const pdftotext = env.pdftotextPath || "pdftotext";
  const pdftoppm = env.pdftoppmPath || "pdftoppm";
  const maxBytes = env.mediaMaxBytes || 100 * 1024 * 1024;
  const maxSeconds = (env.mediaMaxMinutes || 30) * 60;
  const limit = semaphore(env.mediaConcurrency || 2);
  let available = null;
  let pdfReady = null;

  async function audioChunks(dir, input, duration, chunkSeconds) {
    const pattern = join(dir, "parte-%03d.mp3");
    const args = ["-v", "error", "-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "32k", "-t", String(maxSeconds)];
    args.push("-f", "segment", "-segment_time", String(chunkSeconds), "-reset_timestamps", "1", pattern);
    await run(ffmpeg, args, { timeoutMs: toolTimeout(Math.min(duration ?? maxSeconds, maxSeconds)) });
    const names = (await readdir(dir)).filter((name) => /^parte-\d{3}\.mp3$/.test(name)).sort();
    return Promise.all(names.map((name) => readFile(join(dir, name))));
  }

  async function transcribeAll(dir, input, duration, transcriber, kind) {
    const size = transcriber.provider === "project" ? MEDIA_LIMITS.projectChunkSeconds : MEDIA_LIMITS.chunkSeconds;
    const chunks = await audioChunks(dir, input, duration, size);
    const total = Number.isFinite(duration) && duration > 0 ? Math.min(duration, maxSeconds) : null;
    const spoken = [];
    for (const [index, chunk] of chunks.entries()) {
      const seconds = total === null ? null : Math.max(0, Math.round(Math.min(size, total - index * size)));
      spoken.push(await transcribeImpl({ transcriber, buffer: chunk, fetchImpl, part: index + 1, parts: chunks.length, kind, seconds }));
    }
    return spoken.filter(Boolean).join(" ").trim();
  }

  async function image(dir, file) {
    if (IMAGE_TYPES.has(file.mime) && file.buffer.length <= MEDIA_LIMITS.imageBytes) return { mime: file.mime, data: file.buffer.toString("base64") };
    const input = join(dir, "entrada");
    const output = join(dir, "imagem.jpg");
    await writeFile(input, file.buffer);
    const side = MEDIA_LIMITS.imageSide;
    await run(ffmpeg, ["-v", "error", "-y", "-i", input, "-frames:v", "1", "-vf", `scale='min(${side},iw)':'min(${side},ih)':force_original_aspect_ratio=decrease`, "-q:v", "4", output], { timeoutMs: 60000 });
    return { mime: "image/jpeg", data: (await readFile(output)).toString("base64") };
  }

  async function video(dir, file, transcriber, wants) {
    const input = join(dir, "entrada");
    await writeFile(input, file.buffer);
    const info = await probe(input, { ffprobe, run });
    const result = { image: null, text: null, note: null };
    if (wants.video && info.hasVideo) {
      const plan = gridPlan(info.duration);
      const output = join(dir, "grade.jpg");
      const filter = `fps=${plan.fps.toFixed(6)},scale=${MEDIA_LIMITS.tileWidth}:-2,tile=${plan.columns}x${plan.rows}`;
      await run(ffmpeg, ["-v", "error", "-y", "-i", input, "-an", "-vf", filter, "-frames:v", "1", "-q:v", "4", output], { timeoutMs: toolTimeout(info.duration) });
      result.image = {
        mime: "image/jpeg",
        data: (await readFile(output)).toString("base64"),
        caption: `Vídeo de ${minutes(info.duration ?? plan.frames)}, mostrado numa grade de ${plan.frames} quadros, da esquerda para a direita e de cima para baixo, um a cada ${minutes(plan.interval)}.`,
        memo: "[a pessoa mandou um vídeo]",
      };
    }
    if (info.hasAudio && transcriber) {
      const spoken = await transcribeAll(dir, input, info.duration, transcriber, "video");
      const cut = info.duration && info.duration > maxSeconds ? ` (só os primeiros ${minutes(maxSeconds)})` : "";
      result.text = spoken ? `Fala do vídeo que a pessoa mandou, transcrita${cut}: "${spoken}"` : "O vídeo que a pessoa mandou não tem fala.";
      if (spoken) result.note = `Transcrição da fala do vídeo${cut}: ${spoken}`;
    }
    return result;
  }

  return {
    /** O ffmpeg está no contêiner? Vai para o /health do robô. */
    async available() {
      if (available === null) available = await run(ffmpeg, ["-version"], { timeoutMs: 10000 }).then(() => true, () => false);
      return available;
    },

    /**
     * O leitor de PDF (pdftotext, do poppler) está no contêiner? Vai para o /health do robô. Ele sai com
     * código diferente de zero ao mostrar a versão em algumas edições: só a falta do programa conta.
     */
    async pdfAvailable() {
      if (pdfReady === null) pdfReady = await run(pdftotext, ["-v"], { timeoutMs: 10000 }).then(() => true, (error) => error?.code !== "tool_missing");
      return pdfReady;
    },

    /** Quem transcreve pelas chaves do contêiner ("gemini", "openai" ou null). Vai para o /health do robô. */
    transcriber() {
      return transcriberFor(env.keys, env)?.provider ?? null;
    },

    /**
     * attachments: os anexos das mensagens que chegaram juntas.
     * wants: { images, audio, video, documents, transcription_note }.
     * transcriber: quem transcreve nesta conta (projectTranscriber); sem ele, as chaves do contêiner.
     * Devolve { images: [{ mime, data, caption?, memo? }], texts: [...], notes: [...], skipped: [{ kind, code }],
     * documents: quantos arquivos foram lidos }.
     */
    async prepare({ attachments, wants, transcriber: chosen = null }) {
      const result = { images: [], texts: [], notes: [], skipped: [], documents: 0 };
      const transcriber = chosen ?? transcriberFor(env.keys, env);
      let documentsTried = 0;
      for (const attachment of attachments) {
        const kind = mediaKind(attachment);
        if (!kind) {
          result.skipped.push({ kind: "arquivo", code: "unsupported" });
          continue;
        }
        if (!attachment?.data_url) {
          result.skipped.push({ kind, code: "no_url" });
          continue;
        }
        const enabled =
          kind === "image" ? wants.images : kind === "audio" ? wants.audio : kind === "document" ? wants.documents !== false : wants.video || wants.audio;
        if (!enabled) {
          result.skipped.push({ kind, code: "disabled" });
          continue;
        }
        if (kind === "document" && documentsTried >= DOCUMENT_LIMITS.perTurn) {
          result.skipped.push({ kind, code: "too_many" });
          continue;
        }
        if (kind === "document") documentsTried += 1;
        if (kind === "audio" && !transcriber) {
          result.skipped.push({ kind, code: "no_transcriber" });
          continue;
        }
        if (kind === "image" && result.images.length >= MEDIA_LIMITS.imagesPerTurn) {
          result.skipped.push({ kind, code: "too_many" });
          continue;
        }
        const dir = await mkdtemp(join(tmpdir(), "robo-midia-"));
        try {
          await limit(async () => {
            const file = await downloadAttachment(attachment.data_url, { chatwootUrl: env.chatwootUrl, maxBytes, fetchImpl });
            if (kind === "image") {
              result.images.push(await image(dir, file));
            } else if (kind === "document") {
              const name = documentName(attachment);
              const format = documentFormat({ name, mime: file.mime, buffer: file.buffer });
              const read = await readDocument({ dir, buffer: file.buffer, name, format, run, pdftotext, pdftoppm, imageSide: MEDIA_LIMITS.imageSide });
              if (read.images) {
                const room = MEDIA_LIMITS.imagesPerTurn - result.images.length;
                if (room <= 0) throw new MediaError("too_many", "imagens demais nesta mensagem");
                result.images.push(...read.images.slice(0, room));
              } else result.texts.push(read.text);
              result.documents += 1;
            } else if (kind === "audio") {
              const input = join(dir, "entrada");
              await writeFile(input, file.buffer);
              const info = await probe(input, { ffprobe, run }).catch(() => ({ duration: null }));
              const spoken = await transcribeAll(dir, input, info.duration, transcriber, "audio");
              const cut = info.duration && info.duration > maxSeconds ? ` (só os primeiros ${minutes(maxSeconds)})` : "";
              result.texts.push(spoken ? `Áudio que a pessoa mandou, transcrito${cut}: "${spoken}"` : "A pessoa mandou um áudio sem fala.");
              if (spoken) result.notes.push(`Transcrição do áudio${cut}: ${spoken}`);
            } else {
              const done = await video(dir, file, transcriber, wants);
              if (done.image && result.images.length < MEDIA_LIMITS.imagesPerTurn) result.images.push(done.image);
              if (done.text) result.texts.push(done.text);
              if (done.note) result.notes.push(done.note);
              if (!done.image && !done.text) result.skipped.push({ kind, code: transcriber ? "empty" : "no_transcriber" });
            }
          });
        } catch (error) {
          result.skipped.push({ kind, code: error?.code ?? "failed" });
        } finally {
          await rm(dir, { recursive: true, force: true }).catch(() => {});
        }
      }
      if (!wants.transcription_note) result.notes = [];
      return result;
    },
  };
}
