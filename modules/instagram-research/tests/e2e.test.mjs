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

import { COLLECTED_AT, COMMENTS, profileA, profileB } from "./fixtures/posts.mjs";

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "research.mjs");
const GOOD = "chave-de-teste";
const calls = [];
const datasets = new Map();
let server;
let api;

function datasetFor(actor, input) {
  if (actor.endsWith("instagram-post-scraper")) {
    const known = { "perfil.a": profileA(), "perfil.b": profileB() };
    return (input.username ?? []).flatMap((user) => known[user]?.slice(0, input.resultsLimit) ?? [{ username: user, error: "not_found", errorDescription: "Profile does not exist" }]);
  }
  if (actor.endsWith("instagram-comment-scraper")) return COMMENTS.map((comment) => ({ ...comment, postUrl: input.directUrls[0] }));
  return [];
}

test.before(async () => {
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      calls.push({ method: request.method, url: request.url });
      const send = (status, data) => {
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(data));
      };
      if (request.headers.authorization !== `Bearer ${GOOD}`) return send(401, { error: { type: "token-not-valid" } });
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
});

test.after(() => server.close());

function project() {
  const root = mkdtempSync(join(tmpdir(), "ig-projeto-"));
  mkdirSync(join(root, "home"), { recursive: true });
  return root;
}

/** Runs the script without blocking this process, which also serves the fake Apify. */
function run(root, args, { key = GOOD } = {}) {
  const env = { ...process.env, HOME: join(root, "home"), USERPROFILE: join(root, "home"), APIFY_TOKEN: key };
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
