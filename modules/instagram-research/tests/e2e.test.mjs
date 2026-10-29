// The script as the member's AI runs it, against a fake Apify on 127.0.0.1: what it writes, what it
// answers, and that without a key or above the cost ceiling no call leaves the machine.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { COLLECTED_AT, COMMENTS, profileA, profileB, profileCaptions } from "./fixtures/posts.mjs";

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "research.mjs");
const GOOD = "chave-de-teste";
const calls = [];
const datasets = new Map();
let server;
/** When true, the fake behaves as Apify behind a cloud session's proxy that adds the environment's network secret. */
let proxySecret = false;
let api;
let cdn;
/** The links of the fake collection expire in a week; the expiry is a Unix time in hexadecimal, as Instagram writes it. */
const FUTURE = Math.floor(Date.now() / 1000 + 7 * 24 * 3600).toString(16).toUpperCase();
const PAST = "5F5E1000";
const MP4 = (size) => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(Math.max(0, size - 12), 7)]);
/** A Reels whose video is bigger than one megabyte, for the size ceiling. */
const BIG = "CCCCC2";

function datasetFor(actor, input) {
  if (actor.endsWith("instagram-post-scraper")) {
    const known = { "perfil.a": profileA(), "perfil.b": profileB(), "perfil.legendas": profileCaptions() };
    const withLinks = (items) => items.map((item) => (item.type === "Video" ? { ...item, videoUrl: `${cdn}/cdn/${item.shortCode}.mp4?efg=x&oh=00_teste&oe=${FUTURE}` } : item));
    return (input.username ?? []).flatMap((user) => (known[user] ? withLinks(known[user]).slice(0, input.resultsLimit) : [{ username: user, error: "not_found", errorDescription: "Profile does not exist" }]));
  }
  if (actor.endsWith("instagram-comment-scraper")) return COMMENTS.map((comment) => ({ ...comment, postUrl: input.directUrls[0] }));
  return [];
}

test.before(async () => {
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      calls.push({ method: request.method, url: request.url, auth: request.headers.authorization ?? null });
      const send = (status, data) => {
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(data));
      };
      // Instagram's media server: the video at the signed link, with no key and no login.
      const video = /^\/cdn\/([A-Za-z0-9_-]+)\.mp4/.exec(request.url);
      if (video) {
        const bytes = MP4(video[1] === BIG ? 2 * 1024 * 1024 : 64 * 1024);
        response.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": String(bytes.length) });
        return response.end(bytes);
      }
      const authorized = request.headers.authorization === `Bearer ${GOOD}` || (proxySecret && !request.headers.authorization);
      if (!authorized) return send(401, { error: { type: "token-not-valid" } });
      if (request.url === "/v2/users/me") return send(200, { data: { username: "integrante" } });
      const run = /^\/v2\/acts\/([^/]+)\/runs\?(.*)$/.exec(request.url);
      if (run && request.method === "POST") {
        const id = `run${calls.length}`;
        const query = new URLSearchParams(run[2]);
        datasets.set(id, datasetFor(decodeURIComponent(run[1]), JSON.parse(body)).slice(0, Number(query.get("maxItems"))));
        return send(201, { data: { id, status: "SUCCEEDED", defaultDatasetId: id, usageTotalUsd: 0.02 } });
      }
      const dataset = /^\/v2\/datasets\/([^/]+)\/items/.exec(request.url);
      if (dataset) return send(200, datasets.get(dataset[1]) ?? []);
      return send(404, { error: { type: "not-found" } });
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  api = `http://127.0.0.1:${server.address().port}/v2`;
  cdn = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

function project() {
  const root = mkdtempSync(join(tmpdir(), "ig-projeto-"));
  mkdirSync(join(root, "home"), { recursive: true });
  return root;
}

/** Runs the script without blocking this process, which also serves the fake Apify. */
function run(root, args, { key = GOOD, env: extra = {} } = {}) {
  const env = { ...process.env, HOME: join(root, "home"), USERPROFILE: join(root, "home"), APIFY_TOKEN: key, ...extra };
  if (key === null) delete env.APIFY_TOKEN;
  // A run inside a cloud session would otherwise look for the environment's network secret.
  if (!("CLAUDE_CODE_REMOTE" in extra)) delete env.CLAUDE_CODE_REMOTE;
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [SCRIPT, ...args, "--apify-url", api, "--json"], { cwd: root, env, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", fail);
    child.on("close", (status) => {
      try {
        done({ status, json: JSON.parse(stdout), stderr });
      } catch (error) {
        fail(new Error(`no JSON from ${args.join(" ")}: ${stdout} ${stderr}`));
      }
    });
  });
}

test("check without a key says how to save it and keeps the manual mode", async () => {
  const { status, json } = await run(project(), ["check"], { key: "" });
  assert.equal(status, 0);
  assert.equal(json.apify_key, false);
  assert.deepEqual(json.modes, { manual: true, apify: false });
  assert.equal(json.apify_setup.command, "npx --yes flyee@latest key set APIFY_TOKEN --browser --json");
});

test("profile with the key measures the profile, writes the reports and reuses the collection", async () => {
  const root = project();
  const before = calls.length;
  const { status, json } = await run(root, ["profile", "@perfil.a"]);
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.baseline.reels.value, 107.5);
  assert.equal(json.baseline.reels.status, "measured");
  assert.equal(json.top_reels[0].id, "AAAAA5");
  assert.equal(json.top_reels[0].multiplier, 13.95);
  assert.equal(json.source.type, "apify");
  for (const file of Object.values(json.files)) assert.ok(existsSync(join(root, file)), file);
  assert.ok(existsSync(join(root, "instagram-research", "profiles", "perfil.a", "raw.json")));
  const post = calls.slice(before).find((call) => call.method === "POST");
  assert.match(post.url, /maxItems=30&maxTotalChargeUsd=0\.12/);
  const again = await run(root, ["profile", "perfil.a"]);
  assert.equal(again.json.cached, true);
  assert.equal(calls.slice(before).filter((call) => call.method === "POST").length, 1, "the second run reused the collection");
});

test("without a key, profile hands over the two paths and makes no call", async () => {
  const before = calls.length;
  const { status, json } = await run(project(), ["profile", "perfil.b"], { key: "" });
  assert.equal(status, 0);
  assert.equal(json.mode, "manual");
  assert.equal(json.next_step.key.command, "npx --yes flyee@latest key set APIFY_TOKEN --browser --json");
  assert.equal(json.next_step.reading.template.kind, "reels_grid");
  assert.equal(calls.length, before);
});

test("a refused key and a missing profile come back as stable codes", async () => {
  const refused = await run(project(), ["profile", "perfil.a"], { key: "outra" });
  assert.equal(refused.status, 1);
  assert.equal(refused.json.error.code, "apify_unauthorized");
  const missing = await run(project(), ["profile", "perfil.que.nao.existe"]);
  assert.equal(missing.json.error.code, "profile_not_found");
});

test("a collection above the cost ceiling waits for confirmation and makes no call", async () => {
  const before = calls.length;
  const users = Array.from({ length: 25 }, (_, i) => `perfil.${i}`);
  const { status, json } = await run(project(), ["outliers", ...users, "--posts", "30"]);
  assert.equal(status, 1);
  assert.equal(json.error.code, "needs_confirmation");
  assert.match(json.error.message, /US\$ 2,0\d no Apify/);
  assert.equal(calls.length, before);
});

test("a reading by hand is imported, and outliers combine it with a collected profile", async () => {
  const root = project();
  mkdirSync(join(root, "instagram-research", "leituras"), { recursive: true });
  const reading = { version: 1, kind: "reels_grid", profile: "@perfil.c", collected_at: COLLECTED_AT, source: { type: "screenshot", ref: "capturas/perfil-c.png" }, items: ["1.234", "980", "1,1 mil", "870", "1.050", "12,3 mil"].map((plays_text) => ({ plays_text })) };
  writeFileSync(join(root, "instagram-research", "leituras", "perfil.c.json"), JSON.stringify(reading));
  const imported = await run(root, ["import", "instagram-research/leituras/perfil.c.json"], { key: "" });
  assert.equal(imported.status, 0, JSON.stringify(imported.json));
  assert.equal(imported.json.profiles[0].source.type, "screenshot");
  assert.equal(imported.json.profiles[0].baseline.reels.value, 1075);
  const combined = await run(root, ["outliers", "perfil.a", "perfil.c", "--name", "teste"]);
  assert.equal(combined.status, 0, JSON.stringify(combined.json));
  assert.deepEqual(combined.json.profiles.map((profile) => [profile.id, profile.source.type]).sort(), [["perfil.a", "apify"], ["perfil.c", "screenshot"]]);
  assert.ok(existsSync(join(root, "instagram-research", "outliers", "teste", "outliers.md")));
  const withoutKey = await run(root, ["outliers", "perfil.c", "perfil.d"], { key: "" });
  assert.equal(withoutKey.status, 0);
  assert.deepEqual(withoutKey.json.missing, ["perfil.d"]);
});

test("a file of posts the member already has keeps the day it was saved", async () => {
  const root = project();
  const file = join(root, "posts-perfil-a.json");
  writeFileSync(file, JSON.stringify(profileA()));
  const saved = new Date(2026, 9, 12, 15, 0, 0);
  utimesSync(file, saved, saved);
  const { status, json } = await run(root, ["import", "posts-perfil-a.json"], { key: "" });
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.kind, "apify_file");
  assert.equal(json.profiles[0].source.type, "export");
  assert.equal(json.profiles[0].source.collected_at, "2026-10-12");
  assert.equal(json.profiles[0].baseline.reels.value, 107.5);
});

test("a broken reading is refused with the fields to fix", async () => {
  const root = project();
  writeFileSync(join(root, "leitura.json"), JSON.stringify({ version: 1, kind: "reels_grid", profile: "@perfil.c", collected_at: COLLECTED_AT, source: { type: "screenshot" }, items: [{ plays_text: "muito" }] }));
  const { status, json } = await run(root, ["import", "leitura.json"], { key: "" });
  assert.equal(status, 1);
  assert.equal(json.error.code, "reading_invalid");
  assert.match(json.error.message, /source\.ref/);
  assert.match(json.error.message, /items\[0\]\.plays_text/);
});

test("list shows what the project already has, and help answers with the interface version", async () => {
  const root = project();
  await run(root, ["profile", "perfil.b"]);
  const { status, json } = await run(root, ["list"]);
  assert.equal(status, 0);
  assert.equal(json.interface_version, 1);
  assert.deepEqual(json.profiles.map((profile) => [profile.id, profile.source]), [["perfil.b", "apify"]]);
  assert.equal(json.profiles[0].reels_normal, 300);
  const help = await run(root, ["help"]);
  assert.equal(help.json.interface_version, 1);
  assert.match(help.json.text, /outliers/);
});

test("comments come without the names of whoever wrote them, most liked first", async () => {
  const root = project();
  const { status, json } = await run(root, ["comments", "https://www.instagram.com/reel/AAAAA5/", "--max", "10"]);
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.count, 2);
  assert.equal(json.comments[0].text, "Quanto custa?");
  const saved = readFileSync(join(root, json.files.md), "utf8") + readFileSync(join(root, json.files.json), "utf8");
  assert.equal(/alguem|outra\.pessoa/.test(saved), false);
});

test("in a cloud session, the key kept as the environment's network secret collects, and the app never sends one", async () => {
  const root = project();
  proxySecret = true;
  try {
    const check = await run(root, ["check"], { key: null, env: { CLAUDE_CODE_REMOTE: "true" } });
    assert.equal(check.json.apify_key, true, JSON.stringify(check.json));
    assert.equal(check.json.apify_key_from, "cloud_secret");
    assert.equal(check.json.apify_setup, null);
    const before = calls.length;
    const { status, json } = await run(root, ["profile", "perfil.a"], { key: null, env: { CLAUDE_CODE_REMOTE: "true" } });
    assert.equal(status, 0, JSON.stringify(json));
    const made = calls.slice(before);
    assert.ok(made.some((call) => call.method === "POST" && /\/runs\?/.test(call.url)), "the collection ran");
    assert.ok(made.every((call) => call.auth === null), "the key stays with the proxy, never in the app's requests");
  } finally {
    proxySecret = false;
  }
});

test("in a cloud session with no secret, the key request points to the environment, not to a page", async () => {
  const root = project();
  const { json } = await run(root, ["check"], { key: null, env: { CLAUDE_CODE_REMOTE: "true" } });
  assert.equal(json.apify_key, false);
  assert.equal(json.apify_setup.cloud, true);
  assert.equal(json.apify_setup.command, undefined, "no page opens in a cloud session");
  assert.match(json.apify_setup.how, /segredo de rede/);
  assert.match(json.apify_setup.how, /api\.apify\.com/);
});

// ---------------------------------------------------------------- 1.1.0

test("a collection keeps every caption whole, and a Reels carries the time its video link expires", async () => {
  const root = project();
  const { status, json } = await run(root, ["profile", "perfil.legendas"]);
  assert.equal(status, 0, JSON.stringify(json));
  const saved = JSON.parse(readFileSync(join(root, json.files.json), "utf8"));
  const list = saved.reels.find((reel) => reel.id === "CCCCC2");
  assert.equal(list.caption, "3 erros que deixam o pão solado\n1. Sovar pouco\n2. Fermento velho\n3. Forno frio\n\nSalva esse post pra não esquecer.");
  assert.equal(list.video_expires_at, new Date(Number.parseInt(FUTURE, 16) * 1000).toISOString());
  assert.equal(saved.reels.find((reel) => reel.id === "CCCCD1").caption, null);
  const md = readFileSync(join(root, json.files.md), "utf8");
  assert.ok(md.split("\n").filter((line) => line.startsWith("| ")).every((line) => line.trim().endsWith("|")), "no table row is split by a line break");
});

test("captions measures the traits of an outliers search, writes legendas.md and legendas.json, and leaves paid partnerships out", async () => {
  const root = project();
  const search = await run(root, ["outliers", "perfil.a", "perfil.legendas", "--name", "legendas"]);
  assert.equal(search.status, 0, JSON.stringify(search.json));
  const { status, json } = await run(root, ["captions", "legendas"]);
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.command, "captions");
  assert.equal(json.interface_version, 1);
  assert.equal(json.scope, "outliers");
  assert.deepEqual(json.profiles.sort(), ["perfil.a", "perfil.legendas"]);
  assert.deepEqual(json.files, { json: "instagram-research/outliers/legendas/legendas.json", md: "instagram-research/outliers/legendas/legendas.md" });
  for (const file of Object.values(json.files)) assert.ok(existsSync(join(root, file)), file);
  assert.deepEqual(json.excluded.map((post) => [post.id, post.reason]).sort(), [["AAAAA7", "paid_partnership"], ["CCCCD2", "paid_partnership"]]);
  assert.deepEqual(json.reels.sample, { posts: 17, measured: 16, no_caption: 1, no_multiplier: 0 });
  const row = (key) => json.reels.traits.find((trait) => trait.trait === key);
  assert.equal(json.reels.traits.length, 12);
  assert.deepEqual([row("cta_comment").with.n, row("cta_dm").with.n, row("list_format").with.n, row("cta_link_bio").with.n], [2, 1, 1, 1]);
  assert.ok(json.reels.traits.every((trait) => trait.with.n + trait.without.n === 16));
  assert.ok(json.warnings.some((warning) => /Só 16 legendas de Reels/.test(warning)));
  const md = readFileSync(join(root, json.files.md), "utf8");
  assert.match(md, /^# Traços de legenda: /);
  assert.match(md, /\| pede comentário .* \| .*\(n=2\) \| .*\(n=14\) \| grupo pequeno \(menos de 5\): indício \|/);
  const again = await run(root, ["captions", "legendas", "--exclude", "CCCCC1,NAOEXISTE", "--min-n", "2"]);
  assert.equal(again.json.reels.sample.measured, 15);
  assert.equal(again.json.min_n, 2);
  assert.ok(again.json.excluded.some((post) => post.id === "CCCCC1" && post.reason === "asked"));
  assert.ok(again.json.warnings.some((warning) => /NAOEXISTE/.test(warning)));
  const list = await run(root, ["list"]);
  assert.equal(list.json.outliers.find((search) => search.id === "legendas").captions, true);
});

test("captions also reads one profile, warns about a search made before whole captions, and refuses what does not exist", async () => {
  const root = project();
  await run(root, ["profile", "perfil.legendas"]);
  const one = await run(root, ["captions", "@perfil.legendas"]);
  assert.equal(one.status, 0, JSON.stringify(one.json));
  assert.equal(one.json.scope, "profile");
  assert.equal(one.json.files.md, "instagram-research/profiles/perfil.legendas/legendas.md");
  const old = join(root, "instagram-research", "outliers", "antiga");
  mkdirSync(old, { recursive: true });
  writeFileSync(join(old, "outliers.json"), JSON.stringify({ command: "outliers", app: { name: "instagram-research", version: "1.0.2" }, id: "antiga", profiles: [{ id: "x" }], reels: [], static: [] }));
  const legacy = await run(root, ["captions", "antiga"]);
  assert.equal(legacy.status, 0, JSON.stringify(legacy.json));
  assert.ok(legacy.json.warnings.some((warning) => /300 caracteres/.test(warning)));
  const missing = await run(root, ["captions", "nao-existe"]);
  assert.equal(missing.status, 1);
  assert.equal(missing.json.error.code, "not_found");
  const outside = await run(root, ["captions", "../fora.json"]);
  assert.equal(outside.json.error.code, "not_found", "nothing outside instagram-research/ is read or written");
});

test("video downloads the chosen Reels from the link of the collection, keeps the origin, and never sends the key", async () => {
  const root = project();
  await run(root, ["profile", "perfil.legendas"]);
  const before = calls.length;
  const { status, json } = await run(root, ["video", "CCCCC1", "https://www.instagram.com/reel/CCCCC7/", "CCCCC1"]);
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.command, "video");
  assert.equal(json.items.length, 2, "the same Reels twice is one download");
  for (const item of json.items) {
    assert.equal(item.ok, true, JSON.stringify(item));
    assert.equal(item.profile, "perfil.legendas");
    assert.equal(item.source.type, "apify");
    assert.match(item.source.collected_at, /^\d{4}-\d{2}-\d{2}$/, "the day of the collection the link came from");
    assert.equal(item.source.actor, "apify/instagram-post-scraper");
    assert.match(item.source.ref, /^instagram-research\/profiles\/perfil\.legendas\/raw\.json$/);
    assert.equal(item.link_expires_at, new Date(Number.parseInt(FUTURE, 16) * 1000).toISOString());
    assert.equal(item.files.video, `instagram-research/posts/${item.id}/video.mp4`);
    assert.equal(readFileSync(join(root, item.files.video)).subarray(4, 8).toString(), "ftyp");
    assert.equal(JSON.parse(readFileSync(join(root, item.files.json), "utf8")).id, item.id);
  }
  const downloads = calls.slice(before).filter((call) => call.url.startsWith("/cdn/"));
  assert.equal(downloads.length, 2);
  assert.ok(downloads.every((call) => call.auth === null), "the Apify key never goes to Instagram's servers");
  assert.match(readFileSync(join(root, "instagram-research", "posts", ".gitignore"), "utf8"), /\*\/video\.mp4/);
  const again = await run(root, ["video", "CCCCC1"]);
  assert.equal(again.json.items[0].cached, true);
  assert.equal(calls.slice(before).filter((call) => call.url.startsWith("/cdn/")).length, 2, "a video already in the project is not downloaded again");
  const list = await run(root, ["list"]);
  assert.equal(list.json.posts.find((post) => post.id === "CCCCC1").video, true);
  assert.equal(list.json.posts.some((post) => post.id === ".gitignore"), false);
});

test("video refuses what it cannot fetch, each Reels on its own, and never more than five at once", async () => {
  const root = project();
  await run(root, ["profile", "perfil.legendas"]);
  await run(root, ["profile", "perfil.a"]);
  const stale = join(root, "instagram-research", "profiles", "perfil.velho");
  mkdirSync(stale, { recursive: true });
  writeFileSync(join(stale, "raw.json"), JSON.stringify({ collected_at: "2020-09-01", actor: "apify/instagram-post-scraper", items: [{ type: "Video", shortCode: "VVVVV1", videoUrl: `${cdn}/cdn/VVVVV1.mp4?oh=00_x&oe=${PAST}` }] }));
  mkdirSync(join(root, "instagram-research", "leituras"), { recursive: true });
  const reading = { version: 1, kind: "reels_grid", profile: "@perfil.c", collected_at: COLLECTED_AT, source: { type: "screenshot", ref: "capturas/c.png" }, items: ["1.234", "980", "1,1 mil"].map((plays_text, i) => ({ plays_text, url: `https://www.instagram.com/reel/RRRRR${i + 1}/` })) };
  writeFileSync(join(root, "instagram-research", "leituras", "perfil.c.json"), JSON.stringify(reading));
  await run(root, ["import", "instagram-research/leituras/perfil.c.json"], { key: "" });
  const before = calls.length;
  const { status, json } = await run(root, ["video", "VVVVV1", "AAAAA9", "RRRRR1", "ZZZZZ9", BIG, "--max-mb", "1"]);
  assert.equal(status, 0, JSON.stringify(json));
  const code = Object.fromEntries(json.items.map((item) => [item.id, item.ok ? "ok" : item.error.code]));
  assert.deepEqual(code, { VVVVV1: "video_link_expired", AAAAA9: "not_a_video", RRRRR1: "no_video_link", ZZZZZ9: "no_video_link", [BIG]: "video_too_large" });
  assert.equal(calls.slice(before).some((call) => call.url.startsWith("/cdn/VVVVV1")), false, "an expired link makes no request");
  assert.equal(existsSync(join(root, "instagram-research", "posts", BIG, "video.mp4")), false, "nothing half downloaded stays");
  const many = await run(root, ["video", "A1A1A", "A2A2A", "A3A3A", "A4A4A", "A5A5A", "A6A6A"]);
  assert.equal(many.status, 2);
  assert.equal(many.json.error.code, "usage");
});
