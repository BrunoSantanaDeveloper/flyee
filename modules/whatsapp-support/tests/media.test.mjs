// Imagem, áudio e vídeo no robô (D28): o ffmpeg faz o que é ferramenta, a transcrição é de um modelo, e a
// imagem e a grade do vídeo vão para a IA da conversa. Os testes com ffmpeg rodam quando ele está instalado.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { anthropicContent } from "../kit/base/bot/src/ai/anthropic.mjs";
import { geminiParts } from "../kit/base/bot/src/ai/gemini.mjs";
import { openaiContent } from "../kit/base/bot/src/ai/openai.mjs";
import { attachImages } from "../kit/base/bot/src/bot.mjs";
import {
  createMedia,
  downloadAttachment,
  gridPlan,
  internalUrl,
  mediaKind,
  projectTranscriber,
  toolTimeout,
  transcribe,
  transcriberFor,
} from "../kit/base/bot/src/media.mjs";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0 && spawnSync("ffprobe", ["-version"]).status === 0;

test("mídia: o tipo pelo Chatwoot ou pela extensão, e quem transcreve pela chave que existe", () => {
  assert.equal(mediaKind({ file_type: "image" }), "image");
  assert.equal(mediaKind({ file_type: "file", data_url: "https://chat.test/rails/x/voz.ogg?disposition=inline" }), "audio");
  assert.equal(mediaKind({ data_url: "https://chat.test/rails/x/tela.MP4" }), "video");
  assert.equal(mediaKind({ file_type: "location" }), null);
  assert.equal(transcriberFor({ GEMINI_API_KEY: "g", OPENAI_API_KEY: "o" }).provider, "gemini", "o Gemini custa menos e vem primeiro");
  assert.equal(transcriberFor({ GEMINI_API_KEY: "g" }).model, "gemini-3.1-flash-lite");
  assert.deepEqual(transcriberFor({ OPENAI_API_KEY: "o" }, { openaiTranscribeModel: "outro" }), { provider: "openai", model: "outro", key: "o" });
  assert.equal(transcriberFor({}), null);
});

test("mídia: a grade do vídeo e o tempo do ffmpeg crescem com a duração", () => {
  assert.deepEqual(gridPlan(5), { frames: 5, columns: 4, rows: 2, fps: 1, interval: 1 });
  const long = gridPlan(1800);
  assert.equal(long.frames, 12);
  assert.equal(long.interval, 150, "um vídeo de meia hora vira 12 quadros, um a cada 2 min 30 s");
  assert.equal(gridPlan(null).frames, 12);
  assert.equal(toolTimeout(10), 60000, "nunca curto demais");
  assert.equal(toolTimeout(1800), 3600000);
});

test("mídia: o anexo só vem do Chatwoot, pela rede interna, e para no limite de tamanho", async () => {
  assert.equal(internalUrl("https://atendimento.loja.test/rails/active_storage/blobs/redirect/abc/foto.jpg?x=1", "http://chatwoot-rails:3000"), "http://chatwoot-rails:3000/rails/active_storage/blobs/redirect/abc/foto.jpg?x=1");
  assert.equal(internalUrl("/rails/active_storage/blobs/abc/foto.jpg", "http://chatwoot-rails:3000"), "http://chatwoot-rails:3000/rails/active_storage/blobs/abc/foto.jpg");
  assert.throws(() => internalUrl("ftp://outro/arquivo", "http://chatwoot-rails:3000"), (error) => error.code === "download_refused");

  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    const { pathname, host } = new URL(url);
    if (pathname.startsWith("/rails/active_storage/blobs/redirect/")) return new Response(null, { status: 302, headers: { location: "https://atendimento.loja.test/rails/active_storage/disk/xyz/foto.jpg" } });
    if (pathname.startsWith("/rails/active_storage/disk/")) return new Response(Buffer.from("imagem"), { headers: { "content-type": "image/jpeg; charset=binary" } });
    if (pathname === "/externo") return new Response(null, { status: 302, headers: { location: "https://s3.test/bucket/foto.jpg?assinado=1" } });
    if (host === "s3.test") return new Response(Buffer.from("do s3"), { headers: { "content-type": "image/png" } });
    if (pathname === "/inseguro") return new Response(null, { status: 302, headers: { location: "http://outro.test/x" } });
    if (pathname === "/grande") return new Response(Buffer.alloc(2048), { headers: { "content-length": "2048" } });
    return new Response(null, { status: 404 });
  };
  const options = { chatwootUrl: "http://chatwoot-rails:3000", maxBytes: 1024, fetchImpl };
  const file = await downloadAttachment("https://atendimento.loja.test/rails/active_storage/blobs/redirect/abc/foto.jpg", options);
  assert.deepEqual([file.buffer.toString(), file.mime], ["imagem", "image/jpeg"]);
  assert.ok(seen.every((url) => url.startsWith("http://chatwoot-rails:3000/")), "o redirecionamento do disco volta pela rede interna");
  assert.equal((await downloadAttachment("https://atendimento.loja.test/externo", options)).buffer.toString(), "do s3", "armazenamento externo assinado, em https");
  await assert.rejects(downloadAttachment("https://atendimento.loja.test/inseguro", options), (error) => error.code === "download_refused");
  await assert.rejects(downloadAttachment("https://atendimento.loja.test/grande", options), (error) => error.code === "too_large");
});

test("mídia: as partes neutras viram o formato de cada IA, e as imagens entram na última mensagem da pessoa", () => {
  const parts = [{ type: "text", text: "olha" }, { type: "image", mime: "image/png", data: "QUJD" }];
  assert.deepEqual(anthropicContent(parts), [{ type: "text", text: "olha" }, { type: "image", source: { type: "base64", media_type: "image/png", data: "QUJD" } }]);
  assert.deepEqual(openaiContent(parts)[1], { type: "image_url", image_url: { url: "data:image/png;base64,QUJD" } });
  assert.deepEqual(geminiParts(parts), [{ text: "olha" }, { inlineData: { mimeType: "image/png", data: "QUJD" } }]);
  assert.equal(anthropicContent("só texto"), "só texto");

  const messages = [{ role: "user", content: "oi" }, { role: "assistant", content: "olá" }, { role: "user", content: "o erro é este" }];
  attachImages(messages, [{ mime: "image/jpeg", data: "AAA" }, { mime: "image/jpeg", data: "BBB", caption: "Vídeo de 8 segundos" }]);
  assert.equal(messages[0].content, "oi", "as mensagens antigas ficam como estavam");
  assert.deepEqual(messages[2].content, [
    { type: "text", text: "o erro é este" },
    { type: "image", mime: "image/jpeg", data: "AAA" },
    { type: "text", text: "Vídeo de 8 segundos" },
    { type: "image", mime: "image/jpeg", data: "BBB" },
  ]);
});

test("mídia: o pedido de transcrição ao Gemini e à OpenAI", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.includes("generativelanguage")) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: " quero trocar o pedido " }] } }] }), { headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ text: "quero cancelar" }), { headers: { "content-type": "application/json" } });
  };
  const buffer = Buffer.from("mp3");
  assert.equal(await transcribe({ transcriber: { provider: "gemini", model: "gemini-3.1-flash-lite", key: "g" }, buffer, fetchImpl }), "quero trocar o pedido");
  assert.match(calls[0].url, /models\/gemini-3\.1-flash-lite:generateContent$/);
  assert.equal(calls[0].init.headers["x-goog-api-key"], "g");
  const sent = JSON.parse(calls[0].init.body).contents[0].parts;
  assert.deepEqual(sent[0].inlineData, { mimeType: "audio/mp3", data: buffer.toString("base64") });
  assert.match(sent[1].text, /Transcreva a fala/);

  assert.equal(await transcribe({ transcriber: { provider: "openai", model: "gpt-4o-mini-transcribe", key: "o" }, buffer, fetchImpl }), "quero cancelar");
  assert.equal(calls[1].url, "https://api.openai.com/v1/audio/transcriptions");
  assert.equal(calls[1].init.headers.authorization, "Bearer o");
  assert.equal(calls[1].init.body.get("model"), "gpt-4o-mini-transcribe");
  assert.equal(calls[1].init.body.get("file").type, "audio/mpeg");
});

test("mídia: o projeto transcreve pela rota dele, e o /health diz quem transcreve no contêiner", async () => {
  const sent = [];
  const viaProject = projectTranscriber(async (part) => {
    sent.push(part);
    return { ok: true, text: " pode ser amanhã " };
  });
  const buffer = Buffer.from("mp3");
  assert.equal(await transcribe({ transcriber: viaProject, buffer, part: 2, parts: 3, kind: "video", seconds: 300 }), "pode ser amanhã");
  assert.deepEqual(sent, [{ kind: "video", mime: "audio/mpeg", seconds: 300, data: buffer.toString("base64"), part: 2, parts: 3 }]);
  const refused = projectTranscriber(async () => ({ ok: false, code: "ceiling" }));
  await assert.rejects(transcribe({ transcriber: refused, buffer }), (error) => error.code === "ceiling", "o projeto recusou: o áudio volta para a equipe");

  assert.equal(createMedia({ env: { keys: { GEMINI_API_KEY: "g" } } }).transcriber(), "gemini");
  assert.equal(createMedia({ env: { keys: {} } }).transcriber(), null);
});

test("mídia: o superadmin decide, ligado por padrão, e pode liberar a escolha ao cliente", async () => {
  const { botConfig, defaultPlatformSettings, editableGroups } = await import("../kit/base/shared/settings.mjs");
  const platform = defaultPlatformSettings("Sistema");
  assert.equal(platform.client_permissions.midia, false);
  assert.deepEqual(botConfig({ model: "plataforma", platform, state: {} }).media, { images: true, audio: true, video: true, documents: true, transcription_note: true });
  const client = { media: { images: false, audio: true, video: false, transcription_note: true } };
  assert.equal(botConfig({ model: "por-cliente", platform, client, state: {} }).media.images, true, "sem a permissão, vale a plataforma");
  const allowed = { ...platform, client_permissions: { ...platform.client_permissions, midia: true } };
  assert.deepEqual(botConfig({ model: "por-cliente", platform: allowed, client, state: {} }).media, { ...client.media, documents: true }, "configuração salva antes dos arquivos: arquivos ligados");
  assert.ok(editableGroups("cliente", "por-cliente", allowed).includes("midia"));
});

/** Cria um arquivo de teste com o ffmpeg (fontes sintéticas), sem baixar nada. */
function make(dir, name, args) {
  const file = join(dir, name);
  const run = spawnSync("ffmpeg", ["-v", "error", "-y", ...args, file]);
  assert.equal(run.status, 0, String(run.stderr));
  return readFileSync(file);
}

test("mídia com ffmpeg: imagem convertida, áudio longo cortado em partes, vídeo em grade com a fala", { skip: !hasFfmpeg && "ffmpeg ausente" }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "teste-midia-"));
  try {
    const files = {
      "/rails/foto.bmp": { body: make(dir, "foto.bmp", ["-f", "lavfi", "-i", "testsrc=size=800x600", "-frames:v", "1"]), type: "image/bmp" },
      "/rails/voz.mp3": { body: make(dir, "voz.mp3", ["-f", "lavfi", "-i", "sine=frequency=440:duration=1250", "-c:a", "libmp3lame", "-b:a", "16k"]), type: "audio/mpeg" },
      "/rails/tela.mp4": {
        body: make(dir, "tela.mp4", ["-f", "lavfi", "-i", "testsrc=duration=8:size=640x360:rate=10", "-f", "lavfi", "-i", "sine=duration=8", "-shortest", "-pix_fmt", "yuv420p"]),
        type: "video/mp4",
      },
    };
    const fetchImpl = async (url) => {
      const found = files[new URL(url).pathname];
      return found ? new Response(found.body, { headers: { "content-type": found.type } }) : new Response(null, { status: 404 });
    };
    const heard = [];
    const transcribeImpl = async ({ transcriber, buffer }) => {
      heard.push({ provider: transcriber.provider, bytes: buffer.length });
      return `parte ${heard.length}`;
    };
    const media = createMedia({ env: { chatwootUrl: "http://chatwoot-rails:3000", keys: { GEMINI_API_KEY: "g" } }, fetchImpl, transcribeImpl });
    assert.equal(await media.available(), true);
    const wants = { images: true, audio: true, video: true, transcription_note: true };
    const attachments = [
      { file_type: "image", data_url: "https://atendimento.loja.test/rails/foto.bmp" },
      { file_type: "audio", data_url: "https://atendimento.loja.test/rails/voz.mp3" },
      { file_type: "video", data_url: "https://atendimento.loja.test/rails/tela.mp4" },
    ];
    const result = await media.prepare({ attachments, wants });
    assert.deepEqual(result.skipped, []);
    assert.equal(result.images.length, 2, "a foto e a grade do vídeo");
    assert.equal(result.images[0].mime, "image/jpeg", "BMP vira JPEG pelo ffmpeg");
    assert.equal(Buffer.from(result.images[0].data, "base64").subarray(0, 2).toString("hex"), "ffd8");
    assert.equal(Buffer.from(result.images[1].data, "base64").subarray(0, 2).toString("hex"), "ffd8", "a grade é um JPEG");
    assert.match(result.images[1].caption, /grade de 8 quadros/);
    assert.equal(heard.filter((item) => item.provider === "gemini").length, 4, "20 min e 50 s de áudio em 3 partes de até 10 minutos, mais a fala do vídeo");
    assert.match(result.texts[0], /^Áudio que a pessoa mandou, transcrito: "parte 1 parte 2 parte 3"$/);
    assert.match(result.texts[1], /^Fala do vídeo que a pessoa mandou, transcrita: "parte 4"$/);
    assert.equal(result.notes.length, 2, "as transcrições também vão para a equipe");

    const quiet = createMedia({ env: { chatwootUrl: "http://chatwoot-rails:3000", keys: {} }, fetchImpl });
    const without = await quiet.prepare({ attachments: attachments.slice(1), wants: { ...wants, transcription_note: false } });
    assert.deepEqual(without.skipped, [{ kind: "audio", code: "no_transcriber" }], "sem chave de transcrição, o áudio fica para a equipe");
    assert.equal(without.images.length, 1, "o vídeo ainda vira grade");
    assert.deepEqual([without.texts, without.notes], [[], []]);

    // O projeto que transcreve (ai.transcription "project") recebe partes menores, de até 5 minutos.
    const asked = [];
    const viaProject = projectTranscriber(async (part) => {
      asked.push(part);
      return { ok: true, text: `trecho ${part.part} de ${part.parts}` };
    });
    const heardByProject = await quiet.prepare({ attachments: attachments.slice(1, 2), wants, transcriber: viaProject });
    assert.deepEqual(heardByProject.skipped, [], "sem chave no robô, o projeto transcreve");
    assert.deepEqual(asked.map((part) => [part.part, part.parts, part.kind, part.mime]), [1, 2, 3, 4, 5].map((part) => [part, 5, "audio", "audio/mpeg"]), "20 min e 50 s em 5 partes");
    assert.deepEqual(asked.map((part) => part.seconds), [300, 300, 300, 300, 50], "a duração de cada parte, para o teto de gasto do projeto");
    assert.ok(asked.every((part) => Buffer.from(part.data, "base64").length < 1_300_000), "cada parte cabe num corpo de 2 MB");
    assert.match(heardByProject.texts[0], /"trecho 1 de 5 trecho 2 de 5 trecho 3 de 5 trecho 4 de 5 trecho 5 de 5"$/);

    const off = await media.prepare({ attachments: attachments.slice(0, 1), wants: { ...wants, images: false } });
    assert.deepEqual(off.skipped, [{ kind: "image", code: "disabled" }]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
