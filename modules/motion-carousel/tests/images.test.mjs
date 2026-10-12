// Images for the slides: who generates them and in which order, the two request shapes, the
// failures by code, and the treatment of the file (format, cut-out, transparency). No network:
// the providers are stood in for by small files made with ffmpeg.

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import {
  alphaMean,
  ASPECTS,
  classifyCodexFailure,
  classifyGeminiError,
  codexConfigRejected,
  codexPrompt,
  cutoutSuffix,
  findFfmpeg,
  FULL_BLEED_EN,
  geminiKey,
  geminiRequest,
  generateImage,
  GEMINI_IMAGE_MODEL,
  imageStatus,
  keyFilter,
  keySetup,
  newImages,
  noProviderError,
  parseGeminiImage,
  pickProvider,
  requestHash,
  run,
  sidecarPath,
} from "../scripts/lib/images.mjs";
import { AppError } from "../scripts/lib/util.mjs";

function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), "flyee-carousel-images-"));
  t.after(() => {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {
      // the system cleans its temporary folder
    }
  });
  return dir;
}

const NO_CODEX = { installed: false, logged_in: false };
const CODEX_READY = { installed: true, logged_in: true };

test("the order: Codex with a ChatGPT login first, then the Gemini key; a named provider is taken alone", () => {
  assert.deepEqual(pickProvider("auto", { codex: CODEX_READY, gemini: true }), ["codex", "gemini"]);
  assert.deepEqual(pickProvider("auto", { codex: NO_CODEX, gemini: true }), ["gemini"]);
  assert.deepEqual(pickProvider("auto", { codex: { installed: true, logged_in: false }, gemini: true }), ["gemini"]);
  assert.deepEqual(pickProvider("auto", { codex: CODEX_READY, gemini: false }), ["codex"]);
  assert.deepEqual(pickProvider("auto", { codex: NO_CODEX, gemini: false }), []);
  assert.deepEqual(pickProvider("codex", { codex: CODEX_READY, gemini: true }), ["codex"]);
  assert.deepEqual(pickProvider("codex", { codex: NO_CODEX, gemini: true }), []);
  assert.deepEqual(pickProvider("gemini", { codex: CODEX_READY, gemini: false }), []);
  // logged in with an API key, Codex would bill each image to that key: only by name
  const byKey = { installed: true, logged_in: true, auth: "api_key" };
  assert.deepEqual(pickProvider("auto", { codex: byKey, gemini: true }), ["gemini"]);
  assert.deepEqual(pickProvider("auto", { codex: byKey, gemini: false }), []);
  assert.deepEqual(pickProvider("codex", { codex: byKey, gemini: false }), ["codex"]);
  assert.deepEqual(pickProvider("auto", { codex: { ...byKey, auth: "chatgpt" }, gemini: true }), ["codex", "gemini"]);
});

test("with nobody to generate, the error says what to do next and never asks for a key in the chat", () => {
  const none = noProviderError("auto", { codex: NO_CODEX });
  assert.equal(none.code, "no_image_provider");
  assert.match(none.fix, /npx flyee key set GEMINI_API_KEY --json/);
  assert.match(none.fix, /assets\//);
  assert.doesNotMatch(`${none.message} ${none.fix}`, /cole a chave (aqui|no chat)/i);
  assert.equal(noProviderError("gemini", { codex: NO_CODEX }).code, "no_gemini_key");
  assert.equal(noProviderError("codex", { codex: NO_CODEX }).code, "codex_missing");
  assert.equal(noProviderError("codex", { codex: { installed: true, logged_in: false } }).code, "codex_not_logged_in");
});

test("the Gemini key: the environment first (an empty one means no key), then the saved file", (t) => {
  const dir = scratch(t);
  const store = join(dir, "keys.json");
  writeFileSync(store, JSON.stringify({ version: 1, keys: { GEMINI_API_KEY: " saved-key " } }));
  assert.deepEqual(geminiKey({}, store), { key: "saved-key", from: "flyee" });
  assert.deepEqual(geminiKey({ GEMINI_API_KEY: "env-key" }, store), { key: "env-key", from: "environment" });
  assert.deepEqual(geminiKey({ GEMINI_API_KEY: "  " }, store), { key: null, from: null });
  assert.deepEqual(geminiKey({}, join(dir, "missing.json")), { key: null, from: null });
  const setup = keySetup();
  assert.equal(setup.command, "npx flyee key set GEMINI_API_KEY --json");
  assert.match(setup.key_url, /^https:\/\/aistudio\.google\.com\//);
});

test("the Codex request: one image from its own tool, no shell and no file work, the aspect in words", () => {
  const plain = codexPrompt({ prompt: "an empty gym at dawn", aspect: "4:5", cutout: false });
  assert.match(plain, /^\$imagegen /);
  assert.match(plain, /an empty gym at dawn/);
  assert.match(plain, /Aspect ratio 4:5 \(portrait\)/);
  assert.ok(plain.includes(FULL_BLEED_EN));
  assert.match(plain, /Do not run shell commands/);
  assert.doesNotMatch(plain, /Transparent background/);
  const cut = codexPrompt({ prompt: "a kettlebell", aspect: "1:1", cutout: true, reference: true });
  assert.match(cut, /Aspect ratio 1:1 \(square\)/);
  assert.match(cut, /Transparent background/);
  assert.match(cut, /attached image/);
  assert.ok(!cut.includes(FULL_BLEED_EN));
  assert.match(codexPrompt({ prompt: "x", aspect: "16:9", cutout: false }), /\(landscape\)/);
});

test("a Codex run without an image is classified; a rejected model asks for one more try without the member's configuration", () => {
  assert.equal(classifyCodexFailure("", { timedOut: true }).code, "codex_failed");
  assert.equal(classifyCodexFailure("ERROR: Not logged in. Run codex login").code, "codex_not_logged_in");
  assert.equal(classifyCodexFailure("You've hit your usage limit").code, "codex_quota");
  const failed = classifyCodexFailure("tool image_gen unavailable");
  assert.equal(failed.code, "codex_failed");
  assert.match(failed.fix, /image_gen unavailable/);
  assert.equal(codexConfigRejected(`ERROR: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'x' model is not supported when using Codex with a ChatGPT account."}}`), true);
  assert.equal(codexConfigRejected("the image tool is not available in this session"), false);
});

test("newImages finds what changed after a moment, newest first, and ignores the rest", (t) => {
  const dir = scratch(t);
  mkdirSync(join(dir, "a", "b"), { recursive: true });
  const big = Buffer.alloc(4096, 1);
  const old = join(dir, "old.png");
  const fresh = join(dir, "a", "b", "fresh.png");
  const newer = join(dir, "a", "newer.webp");
  for (const file of [old, fresh, newer]) writeFileSync(file, big);
  writeFileSync(join(dir, "note.txt"), big);
  writeFileSync(join(dir, "tiny.png"), Buffer.alloc(10));
  const base = Date.now();
  utimesSync(old, new Date(base - 60000), new Date(base - 60000));
  utimesSync(fresh, new Date(base + 2000), new Date(base + 2000));
  utimesSync(newer, new Date(base + 5000), new Date(base + 5000));
  const found = newImages(dir, base, 3).map((item) => item.path);
  assert.deepEqual(found, [newer, fresh]);
  assert.deepEqual(newImages(join(dir, "missing"), base), []);
});

test("the Gemini request: generateContent with the aspect, a full-bleed sentence, the key colour for cut-outs, a reference as inline data", () => {
  const plain = geminiRequest({ prompt: "an empty gym", aspect: "4:5" });
  assert.equal(plain.url, `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`);
  assert.deepEqual(plain.body.generationConfig, { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "4:5" } });
  assert.equal(plain.body.contents[0].parts.length, 1);
  assert.ok(plain.body.contents[0].parts[0].text.startsWith("an empty gym. "));
  assert.ok(plain.body.contents[0].parts[0].text.includes(FULL_BLEED_EN));
  const cut = geminiRequest({ prompt: "a kettlebell", aspect: "1:1", cutout: true, reference: { mime: "image/png", data: "QUJD" }, model: "outro-modelo" });
  assert.match(cut.url, /models\/outro-modelo:generateContent$/);
  assert.equal(cut.body.contents[0].parts[0].text, `a kettlebell${cutoutSuffix("00FF00")}`);
  assert.match(cut.body.contents[0].parts[0].text, /pure green \(#00FF00\)/);
  assert.deepEqual(cut.body.contents[0].parts[1], { inlineData: { mimeType: "image/png", data: "QUJD" } });
  assert.match(cutoutSuffix("0000FF"), /pure blue \(#0000FF\)/);
  assert.ok(ASPECTS.includes("4:5") && ASPECTS.includes("3:4"));
});

test("the Gemini answer: the image part is found among text and thought parts; a refusal is an error with the reason", () => {
  const bytes = Buffer.from("fake-jpeg-bytes");
  const answer = {
    candidates: [{ content: { parts: [{ text: "here it is" }, { inlineData: { mimeType: "image/jpeg", data: bytes.toString("base64") }, thoughtSignature: "zzz" }] }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 1500 },
  };
  const image = parseGeminiImage(answer);
  assert.equal(Buffer.compare(image.bytes, bytes), 0);
  assert.equal(image.mime, "image/jpeg");
  assert.deepEqual(image.usage, { input_tokens: 30, output_tokens: 1500 });
  assert.throws(() => parseGeminiImage({ candidates: [{ content: { parts: [{ text: "I cannot draw that." }] }, finishReason: "SAFETY" }] }), (error) => error.code === "gemini_refused" && /SAFETY/.test(error.fix) && /cannot draw/.test(error.fix));
  assert.throws(() => parseGeminiImage({ promptFeedback: { blockReason: "PROHIBITED_CONTENT" } }), (error) => error.code === "gemini_refused" && /PROHIBITED_CONTENT/.test(error.fix));
});

test("Gemini failures by code; the message never carries a key", () => {
  const body = (message, extra = {}) => JSON.stringify({ error: { message, ...extra } });
  assert.equal(classifyGeminiError(400, body("API key not valid. Please pass a valid API key.")).code, "gemini_invalid_key");
  assert.equal(classifyGeminiError(429, body("Resource has been exhausted")).code, "gemini_quota");
  assert.equal(classifyGeminiError(403, body("Permission denied")).code, "gemini_permission");
  assert.equal(classifyGeminiError(404, body("models/x is not found")).code, "gemini_model_not_found");
  assert.equal(classifyGeminiError(503, body("overloaded")).code, "gemini_unavailable");
  assert.equal(classifyGeminiError(400, "not json at all").code, "gemini_failed");
  for (const status of [400, 403, 404, 429, 500]) assert.ok(classifyGeminiError(status, body("x")) instanceof AppError);
});

test("the key filter: colorkey with despill by default, chromakey on request, blue screens despill blue", () => {
  assert.equal(keyFilter(), "format=rgba,colorkey=0x00FF00:0.35:0.1,despill=type=green");
  assert.equal(keyFilter({ color: "0000FF", similarity: 0.3, blend: 0.05, mode: "colorkey" }), "format=rgba,colorkey=0x0000FF:0.3:0.05,despill=type=blue");
  assert.equal(keyFilter({ mode: "chromakey", similarity: 0.25, blend: 0.1, color: "00FF00" }), "chromakey=0x00FF00:0.25:0.1,despill=type=green");
  assert.equal(keyFilter({ despill: false }), "format=rgba,colorkey=0x00FF00:0.35:0.1");
});

test("the same request has the same hash; any change that matters gives another", () => {
  const base = { prompt: "a", aspect: "4:5", cutout: false, provider: "auto", model: null, reference: null, key: { color: "00FF00" } };
  assert.equal(requestHash(base), requestHash({ ...base }));
  assert.notEqual(requestHash(base), requestHash({ ...base, prompt: "b" }));
  assert.notEqual(requestHash(base), requestHash({ ...base, aspect: "1:1" }));
  assert.notEqual(requestHash(base), requestHash({ ...base, cutout: true }));
  assert.notEqual(requestHash(base), requestHash({ ...base, provider: "gemini" }));
  assert.equal(requestHash(base), requestHash({ ...base, key: { color: "0000FF" } }), "the key colour only matters for a cut-out");
  assert.equal(sidecarPath("assets/fundo.jpg"), "assets/fundo.jpg.json");
});

test("bad requests are usage errors before anything is generated", async (t) => {
  const dir = scratch(t);
  const deps = { requireFfmpeg: () => ({ ffmpeg: "x", ffprobe: "x" }), codexStatus: async () => NO_CODEX, keyStore: join(dir, "none.json") };
  const env = {};
  await assert.rejects(generateImage({ out: join(dir, "a.gif"), prompt: "x", env, deps }), (error) => error.code === "usage" && /\.png, \.jpg ou \.webp/.test(error.message));
  await assert.rejects(generateImage({ out: join(dir, "a.jpg"), prompt: "x", cutout: true, env, deps }), (error) => error.code === "usage" && /transparência/.test(error.message));
  await assert.rejects(generateImage({ out: join(dir, "a.png"), prompt: "x", aspect: "7:3", env, deps }), (error) => error.code === "usage");
  await assert.rejects(generateImage({ out: join(dir, "a.png"), prompt: "x", provider: "dall-e", env, deps }), (error) => error.code === "usage");
  await assert.rejects(generateImage({ out: join(dir, "a.png"), prompt: "x", reference: join(dir, "nope.png"), env, deps }), (error) => error.code === "file_not_found");
  await assert.rejects(generateImage({ out: join(dir, "a.png"), prompt: "x", env, deps }), (error) => error.code === "no_image_provider");
});

test("imageStatus tells who can generate here, in order, without showing the key", async (t) => {
  const dir = scratch(t);
  const store = join(dir, "keys.json");
  writeFileSync(store, JSON.stringify({ version: 1, keys: { GEMINI_API_KEY: "secret-value" } }));
  const withBoth = await imageStatus({}, { codexStatus: async () => CODEX_READY, keyStore: store });
  assert.deepEqual(withBoth.available, ["codex", "gemini"]);
  assert.equal(withBoth.gemini_key, true);
  assert.equal(withBoth.gemini_key_from, "flyee");
  assert.equal(withBoth.gemini_setup, null);
  assert.doesNotMatch(JSON.stringify(withBoth), /secret-value/);
  const none = await imageStatus({}, { codexStatus: async () => NO_CODEX, keyStore: join(dir, "missing.json") });
  assert.deepEqual(none.available, []);
  assert.equal(none.gemini_setup.command, "npx flyee key set GEMINI_API_KEY --json");
});

test("alphaMean reads the small numbers ffmpeg prints in scientific notation (needs ffmpeg)", { timeout: 60000 }, async (t) => {
  const tools = findFfmpeg();
  if (!tools.ffmpeg) {
    t.skip("sem ffmpeg nesta máquina");
    return;
  }
  const dir = scratch(t);
  // one opaque pixel in 2000×2000: the alpha mean is 6.4e-05, which a plain decimal pattern reads as 6.4
  const file = join(dir, "quase-vazio.png");
  const made = await run(tools.ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=black:s=2000x2000,format=rgba,geq=r=0:g=0:b=0:a='if(eq(X\\,0)*eq(Y\\,0)\\,255\\,0)'", "-frames:v", "1", file]);
  assert.equal(made.code, 0, made.stderr);
  const mean = await alphaMean(tools.ffmpeg, file);
  assert.ok(mean !== null && mean < 0.001, `mediu ${mean}`);
});

test("the whole request with stand-in providers: fallback to the next one, the cut-out, the cache (needs ffmpeg)", { timeout: 120000 }, async (t) => {
  const tools = findFfmpeg();
  if (!tools.ffmpeg || !tools.ffprobe) {
    t.skip("sem ffmpeg nesta máquina");
    return;
  }
  const dir = scratch(t);
  const make = async (file, source) => {
    mkdirSync(dirname(file), { recursive: true });
    const result = await run(tools.ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", source, "-frames:v", "1", file]);
    assert.equal(result.code, 0, result.stderr);
    return file;
  };
  const calls = [];
  const deps = {
    codexStatus: async () => CODEX_READY,
    keyStore: join(dir, "keys.json"),
    // Codex fails here, as on an installation without the image tool
    generateWithCodex: async () => {
      calls.push("codex");
      throw new AppError("codex_failed", "O Codex terminou sem gerar a imagem.", "");
    },
    // Gemini "paints" a red square on the flat green key colour
    generateWithGemini: async ({ cutout }) => {
      calls.push("gemini");
      const work = mkdtempSync(join(dir, "gemini-"));
      const file = await make(join(work, "gemini.png"), cutout ? "color=c=0x00FF00:s=200x250,drawbox=x=50:y=75:w=100:h=100:color=red:t=fill" : "color=c=0x334455:s=200x250");
      return { file, mime: "image/png", provider: "gemini", model: GEMINI_IMAGE_MODEL, usage: { input_tokens: 1, output_tokens: 2 }, cleanup: work };
    },
  };
  writeFileSync(deps.keyStore, JSON.stringify({ version: 1, keys: { GEMINI_API_KEY: "k" } }));
  const env = {};

  // 1. a plain picture: Codex fails, Gemini delivers, and the answer says so
  const plain = join(dir, "carrossel", "assets", "fundo.jpg");
  const first = await generateImage({ out: plain, prompt: "um fundo", env, deps });
  assert.deepEqual(calls, ["codex", "gemini"]);
  assert.equal(first.provider, "gemini");
  assert.equal(first.cached, false);
  assert.equal(first.cutout, null);
  assert.deepEqual([first.width, first.height], [200, 250]);
  assert.equal(first.mime, "image/jpeg");
  assert.equal(first.warnings.length, 1);
  assert.match(first.warnings[0], /Codex não gerou a imagem/);
  assert.ok(existsSync(plain) && existsSync(sidecarPath(plain)));
  assert.equal(JSON.parse(readFileSync(sidecarPath(plain), "utf8")).prompt, "um fundo");

  // 2. the same request again: served from the file, nobody is called
  calls.length = 0;
  const again = await generateImage({ out: plain, prompt: "um fundo", env, deps });
  assert.equal(again.cached, true);
  assert.deepEqual(calls, []);
  const refreshed = await generateImage({ out: plain, prompt: "um fundo", refresh: true, provider: "gemini", env, deps });
  assert.equal(refreshed.cached, false);
  assert.deepEqual(calls, ["gemini"]);

  // 3. a cut-out through Gemini: the green goes away, the square stays (a fifth of the frame)
  const cut = join(dir, "carrossel", "assets", "assunto.png");
  const keyed = await generateImage({ out: cut, prompt: "um quadrado", cutout: true, provider: "gemini", env, deps });
  assert.equal(keyed.cutout.method, "colorkey");
  assert.ok(Math.abs(keyed.cutout.transparent_ratio - 0.8) < 0.03, `transparent ${keyed.cutout.transparent_ratio}`);
  assert.deepEqual(keyed.warnings, []);

  // 4. a cut-out that came back without transparency is flagged
  const flat = join(dir, "carrossel", "assets", "chapado.webp");
  const opaque = await generateImage({
    out: flat,
    prompt: "sem recorte",
    cutout: true,
    provider: "codex",
    env,
    deps: { ...deps, generateWithCodex: async () => ({ file: await make(join(mkdtempSync(join(dir, "codex-")), "codex.png"), "color=c=0x334455:s=200x250"), mime: "image/png", provider: "codex", model: null, usage: null, cleanup: null }) },
  });
  assert.equal(opaque.provider, "codex");
  assert.equal(opaque.cutout.method, "alpha");
  assert.ok(opaque.cutout.transparent_ratio < 0.05);
  assert.ok(opaque.warnings.some((warning) => /pouca transparência/.test(warning)));

  // 5. when every provider fails, the last error comes out with its own code
  await assert.rejects(
    generateImage({ out: join(dir, "x.png"), prompt: "nada", env, deps: { ...deps, generateWithGemini: async () => { throw new AppError("gemini_quota", "limite", ""); } } }),
    (error) => error.code === "gemini_quota",
  );
});
