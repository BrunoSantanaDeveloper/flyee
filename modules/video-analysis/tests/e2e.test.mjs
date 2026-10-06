// End-to-end: runs scripts/video.mjs as the member's AI would, in a scratch folder.
// Local mode needs ffmpeg (skipped without it). Gemini mode talks to a fake API on 127.0.0.1.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { checkTools } from "../scripts/lib/tools.mjs";
import { makeLesson } from "./fixtures.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/video.mjs", import.meta.url));
const tools = await checkTools({ ytdlp: false });
const noFfmpeg = !tools.ffmpeg || !tools.ffprobe ? "ffmpeg is not installed" : false;

function cli(args, { cwd, env = {} }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args, "--json"], { cwd, env: { ...process.env, GEMINI_API_KEY: "", ...env }, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => {
      let json = null;
      try {
        json = JSON.parse(stdout);
      } catch {
        // not JSON: the assertion below shows stdout and stderr
      }
      resolve({ code, json, stdout, stderr });
    });
  });
}

function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), "va-e2e-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("local mode: prepares a lesson, waits for the AI, then serves it from cache", { skip: noFfmpeg }, async (t) => {
  const dir = scratch(t);
  await makeLesson(dir);

  const first = await cli(["analyze", "aula.mp4", "--focus", "content"], { cwd: dir });
  assert.equal(first.code, 0, first.stdout + first.stderr);
  const r = first.json;
  assert.equal(r.ok, true);
  assert.equal(r.mode, "local");
  assert.equal(r.ready, false);
  assert.match(r.id, /^file-aula-[0-9a-f]{8}$/);
  assert.equal(r.next_step.write, `video-analyses/${r.id}/descriptions/content.md`);
  assert.match(r.next_step.header, /focus: "content"/);
  assert.match(r.next_step.header, /mode: "local-ai"/);
  for (const grid of r.next_step.grids) assert.ok(existsSync(join(dir, grid)), grid);

  const analysis = JSON.parse(readFileSync(join(dir, r.files.analysis), "utf8"));
  assert.equal(analysis.format_version, 1);
  assert.equal(analysis.cuts_s.length, 2);
  // Slides with similar brightness: found by the still-change detector, to the nearest quarter second.
  assert.ok(Math.abs(analysis.cuts_s[0] - 5) <= 0.3 && Math.abs(analysis.cuts_s[1] - 10) <= 0.3, String(analysis.cuts_s));
  assert.ok(analysis.silences.some((silence) => Math.abs(silence.start_s - 8) < 0.3 && Math.abs(silence.end_s - 11) < 0.3), JSON.stringify(analysis.silences));
  assert.equal(analysis.transcript.origin, "sidecar");
  assert.equal(analysis.transcript.segments.length, 3);
  assert.equal(analysis.shots.length, 3);
  const index = readFileSync(join(dir, r.files.index), "utf8");
  assert.match(index, /Cortes detectados: 2 em 00:15/);
  assert.match(index, /Silêncios de 1 s ou mais: 00:08–00:11/);
  assert.match(index, /Hoje vamos exportar um vídeo\./);
  assert.ok(existsSync(join(dir, "video-analyses", ".gitignore")));

  // The member's AI writes the description; from then on every app gets it at once.
  writeFileSync(join(dir, r.next_step.write), `${r.next_step.header}\n# Aula\n\n## Resumo\n\nTrês slides sobre exportar um vídeo.\n`);
  const again = await cli(["analyze", "aula.mp4", "--focus", "content"], { cwd: dir });
  assert.equal(again.json.ready, true);
  assert.equal(again.json.cached, true);
  assert.equal(again.json.description, r.next_step.write);

  const frame = await cli(["frame", r.id, "0:07", "12"], { cwd: dir });
  assert.equal(frame.code, 0, frame.stdout + frame.stderr);
  assert.deepEqual(frame.json.frames.map((item) => item.time), ["00:07", "00:12"]);
  for (const item of frame.json.frames) assert.ok(existsSync(join(dir, item.file)));

  const shown = await cli(["show", r.id], { cwd: dir });
  assert.equal(shown.json.descriptions[0].focus, "content");
  const listed = await cli(["list"], { cwd: dir });
  assert.deepEqual(listed.json.analyses.map((item) => item.id), [r.id]);

  const prepared = await cli(["prepare", "aula.mp4", "--max-frames", "6"], { cwd: dir });
  assert.equal(prepared.json.ok, true);
  assert.ok(prepared.json.measurements.some((line) => line.includes("Cortes detectados: 2")));

  const wrong = await cli(["analyze", "aula.mp4", "--focus", "nada"], { cwd: dir });
  assert.equal(wrong.code, 2);
  assert.equal(wrong.json.error.code, "usage");
});

function fakeGemini(reply, { failWith = null } = {}) {
  const requests = [];
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const base = `http://127.0.0.1:${server.address().port}`;
      requests.push({ method: req.method, url: req.url, headers: req.headers, bytes: body.length, json: req.url.includes("generateContent") || req.url === "/upload/v1beta/files" ? JSON.parse(body.toString("utf8")) : null });
      if (req.headers["x-goog-api-key"] === undefined && !req.url.startsWith("/session")) {
        res.writeHead(401).end();
      } else if (req.url === "/upload/v1beta/files") {
        res.writeHead(200, { "x-goog-upload-url": `${base}/session/1` }).end("{}");
      } else if (req.url === "/session/1") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ file: { name: "files/abc", uri: `${base}/v1beta/files/abc`, mimeType: "video/mp4", state: "ACTIVE", expirationTime: new Date(Date.now() + 48 * 3600 * 1000).toISOString() } }));
      } else if (req.url === "/v1beta/files/abc") {
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ name: "files/abc", uri: `${base}/v1beta/files/abc`, state: "ACTIVE" }));
      } else if (req.url.includes(":generateContent") && failWith) {
        res.writeHead(failWith.status, { "content-type": "application/json" }).end(JSON.stringify({ error: { message: failWith.message } }));
      } else if (req.url.includes(":generateContent")) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 1234, candidatesTokenCount: 321 }, modelVersion: "gemini-fake" }));
      } else {
        res.writeHead(404).end();
      }
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, requests, url: `http://127.0.0.1:${server.address().port}` })));
}

const REPLY = {
  summary: "Uma aula em três slides sobre exportar um vídeo.",
  timeline: [{ start: "00:00", end: "00:05", visual: "Slide azul", speech: "Hoje vamos exportar um vídeo.", on_screen_text: "Passo 1 - abra o menu Arquivo" }],
  visual_only: [{ time: "00:10", description: "O resultado em 1080p aparece só na tela." }],
  on_screen_text: [{ time: "00:00", text: "Passo 1 - abra o menu Arquivo" }],
  audio: "Um tom contínuo com silêncio entre 00:08 e 00:11.",
  visual_style: "Slides de cor sólida com texto branco centralizado.",
  shots: [],
  focus_sections: [{ title: "Passo a passo", content: "1. Abrir o menu Arquivo (00:00)." }],
  answer: "",
  uncertainties: [],
};

test("gemini mode: asks before uploading, uploads, describes and reuses", async (t) => {
  const dir = scratch(t);
  const fake = await fakeGemini(REPLY);
  t.after(() => fake.server.close());
  let file = "aula.mp4";
  if (noFfmpeg) writeFileSync(join(dir, file), Buffer.alloc(2048, 1));
  else await makeLesson(dir);
  const env = { GEMINI_API_KEY: "test-key" };
  const common = ["--gemini-url", fake.url, "--focus", "content"];

  const refused = await cli(["analyze", file, "--mode", "gemini", ...common], { cwd: dir, env });
  assert.equal(refused.code, 1);
  assert.equal(refused.json.error.code, "upload_consent_required");
  assert.equal(fake.requests.length, 0);

  const done = await cli(["analyze", file, "--mode", "gemini", "--allow-upload", ...common], { cwd: dir, env });
  assert.equal(done.code, 0, done.stdout + done.stderr);
  assert.equal(done.json.ready, true);
  assert.equal(done.json.mode, "gemini");
  assert.deepEqual(done.json.gemini, { model: "gemini-fake", input_tokens: 1234, output_tokens: 321, thinking_tokens: null });
  const description = readFileSync(join(dir, done.json.description), "utf8");
  assert.match(description, /mode: "gemini"/);
  assert.match(description, /## Só na imagem\n\n- \*\*00:10\*\* — O resultado em 1080p aparece só na tela\./);
  assert.match(description, /## Passo a passo/);
  const generate = fake.requests.find((request) => request.url.includes(":generateContent"));
  assert.equal(generate.headers["x-goog-api-key"], "test-key");
  assert.equal(generate.json.contents[0].parts[0].fileData.fileUri, `${fake.url}/v1beta/files/abc`);
  assert.match(generate.json.contents[0].parts[1].text, /# Foco: conteúdo/);
  assert.equal(generate.json.generationConfig.mediaResolution, "MEDIA_RESOLUTION_HIGH");
  assert.ok(!description.includes("test-key"));

  const before = fake.requests.length;
  const reused = await cli(["analyze", file, "--mode", "gemini", "--allow-upload", ...common], { cwd: dir, env });
  assert.equal(reused.json.cached, true);
  assert.equal(fake.requests.length, before);

  const asked = await cli(["analyze", file, "--mode", "gemini", "--allow-upload", "--question", "O que diz o último slide?", ...common], { cwd: dir, env });
  assert.match(asked.json.name, /^question-[0-9a-f]{6}$/);
  assert.ok(!fake.requests.slice(before).some((request) => request.url === "/upload/v1beta/files"), "the earlier upload is reused");
});

test("both mode: the measured cuts go into the request to Gemini", { skip: noFfmpeg }, async (t) => {
  const dir = scratch(t);
  const fake = await fakeGemini(REPLY);
  t.after(() => fake.server.close());
  await makeLesson(dir);
  const result = await cli(["analyze", "aula.mp4", "--mode", "both", "--allow-upload", "--focus", "editing", "--gemini-url", fake.url], { cwd: dir, env: { GEMINI_API_KEY: "test-key" } });
  assert.equal(result.code, 0, result.stdout + result.stderr);
  assert.equal(result.json.mode, "both");
  assert.equal(result.json.ready, true);
  assert.ok(result.json.files.index);
  const prompt = fake.requests.find((request) => request.url.includes(":generateContent")).json.contents[0].parts[1].text;
  assert.match(prompt, /Scene changes detected \(seconds from the start\): (4|5)\.\d\d, (9|10)\.\d\d\./);
  assert.match(prompt, /# Foco: edição/);
  // A 15 s editing reference is watched at 3 frames per second.
  assert.equal(fake.requests.find((request) => request.url.includes(":generateContent")).json.contents[0].parts[0].videoMetadata.fps, 3);
  const description = readFileSync(join(dir, result.json.description), "utf8");
  assert.match(description, /## Medições\n\n- Cortes detectados: 2 em 00:15/);
});

test("auto mode falls back to the local half when Gemini's quota is over", { skip: noFfmpeg }, async (t) => {
  const dir = scratch(t);
  const fake = await fakeGemini(REPLY, { failWith: { status: 429, message: "Quota exceeded for requests per day" } });
  t.after(() => fake.server.close());
  await makeLesson(dir);
  const result = await cli(["analyze", "aula.mp4", "--allow-upload", "--gemini-url", fake.url], { cwd: dir, env: { GEMINI_API_KEY: "test-key" } });
  assert.equal(result.code, 0, result.stdout + result.stderr);
  assert.equal(result.json.mode, "local");
  assert.equal(result.json.ready, false);
  assert.ok(result.json.next_step.grids.length > 0);
  assert.match(result.json.warnings[0], /gemini_quota/);
});

test("local mode: a window gets its own name, and an id answers a follow-up question", { skip: noFfmpeg }, async (t) => {
  const dir = scratch(t);
  await makeLesson(dir);
  const windowed = await cli(["analyze", "aula.mp4", "--start", "4", "--end", "0:12"], { cwd: dir });
  assert.equal(windowed.code, 0, windowed.stdout + windowed.stderr);
  assert.equal(windowed.json.name, "general-00m04s-00m12s");
  const analysis = JSON.parse(readFileSync(join(dir, windowed.json.files.analysis), "utf8"));
  assert.deepEqual(analysis.preparation.window, { start_s: 4, end_s: 12 });
  assert.ok(analysis.frames.every((frame) => frame.time_s >= 4 && frame.time_s <= 12));
  assert.match(readFileSync(join(dir, windowed.json.files.index), "utf8"), /Trecho preparado: 00:04–00:12/);
  assert.match(windowed.json.next_step.header, /window: "00:04-00:12"/);

  const followUp = await cli(["analyze", windowed.json.id, "--question", "Qual é o último passo?"], { cwd: dir });
  assert.equal(followUp.code, 0, followUp.stdout + followUp.stderr);
  assert.match(followUp.json.name, /^question-[0-9a-f]{6}$/);
  assert.match(followUp.json.next_step.header, /question: "Qual é o último passo\?"/);
});

test("gemini mode: a large or high-resolution file is reduced before the upload", { skip: noFfmpeg }, async (t) => {
  const dir = scratch(t);
  const fake = await fakeGemini(REPLY);
  t.after(() => fake.server.close());
  const big = join(dir, "grande.mp4");
  const made = await new Promise((resolve) => {
    const child = spawn(tools.ffmpeg.path, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-t", "2", "-i", "testsrc2=s=1920x1080:r=25", "-c:v", "libx264", "-preset", "ultrafast", "-qp", "0", big]);
    child.on("close", resolve);
  });
  assert.equal(made, 0);
  const result = await cli(["analyze", "grande.mp4", "--mode", "gemini", "--allow-upload", "--gemini-url", fake.url], { cwd: dir, env: { GEMINI_API_KEY: "test-key" } });
  assert.equal(result.code, 0, result.stdout + result.stderr);
  const upload = fake.requests.find((request) => request.url === "/session/1");
  assert.ok(upload.bytes > 0 && upload.bytes < readFileSync(big).length, `${upload.bytes} bytes sent`);
  assert.ok(!existsSync(join(dir, result.json.dir, "media", "upload.mp4")), "the reduced copy is removed");
});

test("auto mode sends a public YouTube address to Gemini without downloading", async (t) => {
  const dir = scratch(t);
  const fake = await fakeGemini(REPLY);
  t.after(() => fake.server.close());
  // Only ffmpeg on the PATH: without yt-dlp the app goes straight to Gemini and says so.
  const pathWithoutYtdlp = tools.ffmpeg ? join(tools.ffmpeg.path, "..") : "";
  const result = await cli(["analyze", "https://youtu.be/jNQXAC9IVRw", "--gemini-url", fake.url], { cwd: dir, env: { GEMINI_API_KEY: "test-key", PATH: pathWithoutYtdlp } });
  assert.equal(result.code, 0, result.stdout + result.stderr);
  assert.equal(result.json.mode, "gemini");
  assert.equal(result.json.ready, true);
  const generate = fake.requests.find((request) => request.url.includes(":generateContent"));
  assert.equal(generate.json.contents[0].parts[0].fileData.fileUri, "https://www.youtube.com/watch?v=jNQXAC9IVRw");
  assert.ok(!fake.requests.some((request) => request.url.startsWith("/upload")));
});
