// The collection through Apify as the member's AI runs it, against a fake Apify on 127.0.0.1:
// what becomes evidence, the 10 ads per page of D12, and that without a key, with an empty key or
// above the cost ceiling no call leaves the machine. Also the files the partner apps save.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { adsForUrls } from "./fixtures/biblioteca.mjs";
import { BRIEFING } from "./fixtures/campanha.mjs";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(TESTS_DIR, "..");
const CAMPAIGN = "lotus-rodada-0";
const GOOD = "chave-de-teste";
const calls = [];
const runs = new Map();
let server;
let api;
/** When true, the fake behaves as Apify behind a cloud session's proxy that adds the environment's network secret. */
let proxySecret = false;

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
      const authorized = request.headers.authorization === `Bearer ${GOOD}` || (proxySecret && !request.headers.authorization);
      if (!authorized) return send(401, { error: { type: "token-not-valid" } });
      if (request.url === "/v2/users/me") return send(200, { data: { username: "integrante" } });
      const run = /^\/v2\/acts\/([^/]+)\/runs\?(.*)$/.exec(request.url);
      if (run && request.method === "POST") {
        const id = `run${calls.length}`;
        const query = new URLSearchParams(run[2]);
        const input = JSON.parse(body);
        runs.set(id, { actor: decodeURIComponent(run[1]), query: Object.fromEntries(query), input, items: adsForUrls(input.urls).slice(0, Number(query.get("maxItems"))) });
        return send(201, { data: { id, status: "SUCCEEDED", defaultDatasetId: id, usageTotalUsd: 0.012 } });
      }
      const state = /^\/v2\/actor-runs\/([^/?]+)/.exec(request.url);
      if (state) return send(200, { data: { id: state[1], status: "SUCCEEDED", defaultDatasetId: state[1], usageTotalUsd: 0.012 } });
      const dataset = /^\/v2\/datasets\/([^/]+)\/items/.exec(request.url);
      if (dataset) return send(200, runs.get(dataset[1])?.items ?? []);
      return send(404, { error: { type: "not-found" } });
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  api = `http://127.0.0.1:${server.address().port}/v2`;
});

test.after(() => server.close());

function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const source = join(from, entry);
    if (statSync(source).isDirectory()) copyDir(source, join(to, entry));
    else copyFileSync(source, join(to, entry));
  }
}

function project(t, { sources = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), "anuncios-apify-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const appDir = join(root, ".flyee", "modules", "ad-creatives");
  for (const dir of ["scripts", "runtime", "references"]) copyDir(join(APP_DIR, dir), join(appDir, dir));
  copyFileSync(join(APP_DIR, "flyee.module.json"), join(appDir, "flyee.module.json"));
  if (sources) {
    const path = join(appDir, "references", "fontes.json");
    writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, "utf8")), ...sources }));
  }
  mkdirSync(join(root, "home"), { recursive: true });
  return { root, script: join(appDir, "scripts", "ads.mjs"), dir: join(root, "anuncios", CAMPAIGN) };
}

/** Runs the script without blocking this process, which also serves the fake Apify. `key: null` leaves the variable out. */
function run(p, args, { key = GOOD, url = true, env: extra = {} } = {}) {
  const env = { ...process.env, HOME: join(p.root, "home"), USERPROFILE: join(p.root, "home"), APIFY_TOKEN: key, ...extra };
  if (key === null) delete env.APIFY_TOKEN;
  // A run inside a cloud session would otherwise look for the environment's network secret.
  if (!("CLAUDE_CODE_REMOTE" in extra)) delete env.CLAUDE_CODE_REMOTE;
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [p.script, ...args, ...(url ? ["--apify-url", api] : []), "--json"], { cwd: p.root, env, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", fail);
    child.on("close", (status) => {
      try {
        done({ status, json: JSON.parse(stdout), stderr });
      } catch {
        fail(new Error(`no JSON from ${args.join(" ")}: ${stdout} ${stderr}`));
      }
    });
  });
}

async function campaign(p) {
  await run(p, ["new", CAMPAIGN], { url: false });
  writeFileSync(join(p.dir, "briefing.md"), BRIEFING.replace("Nota Clara", "Pagina Sem Anuncio"));
}

test("with the key: every source in one run, the ads as evidence, 10 per page, the raw file and the cost", async (t) => {
  const p = project(t);
  await campaign(p);
  const before = calls.length;
  const { status, json } = await run(p, ["collect", CAMPAIGN]);
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.mode, "apify");
  assert.equal(json.collected, true);
  const post = calls.slice(before).find((call) => call.method === "POST");
  assert.match(post.url, /^\/v2\/acts\/curious_coder~facebook-ads-library-scraper\/runs\?maxItems=\d+&maxTotalChargeUsd=/);
  assert.ok(calls.slice(before).every((call) => call.auth === `Bearer ${GOOD}` && !call.url.includes(GOOD)), "the key goes in the header, never in the address");
  const sent = [...runs.values()].pop();
  assert.equal(sent.input.urls.length, 5, "3 competitors and 2 search words");
  assert.ok(sent.input.urls.every(({ url }) => url.includes("active_status=active") && url.includes("country=BR")));
  assert.equal(sent.input["scrapePageAds.activeStatus"], "active");
  assert.equal(Number(sent.query.maxItems), 3 * 10 + 2 * 30, "the hard item limit of the run");
  assert.deepEqual(json.pages.sort(), ["Agenda Viva", "Clínica Norte Digital", "Escola Ponto Certo"]);
  assert.equal(json.ads, 13, "10 of the 12 ads of one page (D12), 2 of another, 1 of a third; the repeated ad counted once");
  assert.ok(Math.abs(json.cost.estimate_usd - 0.06755) < 0.0001, `estimate ${json.cost.estimate_usd}: 90 ads at US$ 0.00075 and the start`);
  assert.equal(json.cost.charged_usd, 0.012);
  assert.ok(json.warnings.some((warning) => /Pagina Sem Anuncio/.test(warning)), "a competitor the search did not find is named");
  assert.ok(existsSync(join(p.root, json.raw)));
  const evidence = JSON.parse(readFileSync(join(p.dir, "evidencias.json"), "utf8"));
  const first = evidence.items.find((item) => item.who === "Clínica Norte Digital" && item.data.position === 1);
  assert.equal(first.source.type, "apify");
  assert.equal(first.source.actor, "curious_coder/facebook-ads-library-scraper");
  assert.match(first.source.ref, /^https:\/\/www\.facebook\.com\/ads\/library\/\?id=\d+$/);
  assert.equal(first.data.days_active, 188);
  assert.equal(first.data.variations, 3);
  assert.equal(first.data.media, "video");
  assert.equal(first.data.media_urls.length, 1, "the address of the video, for the Análise de vídeo app");
  const ended = evidence.items.find((item) => item.who === "Agenda Viva" && item.data.active === false);
  assert.equal(ended.data.days_active, 20, "an ended ad counts its days from the start to the end");
  // the same collection on the same day is not paid twice
  const again = await run(p, ["collect", CAMPAIGN]);
  assert.equal(again.json.cached, true);
  assert.equal(calls.filter((call) => call.method === "POST").length, calls.slice(0, before).filter((call) => call.method === "POST").length + 1);
});

test("an empty key: the manual research, even with a key saved in flyee, and no call leaves the machine", async (t) => {
  const p = project(t);
  await campaign(p);
  mkdirSync(join(p.root, "home", ".flyee"), { recursive: true });
  writeFileSync(join(p.root, "home", ".flyee", "keys.json"), JSON.stringify({ version: 1, keys: { APIFY_TOKEN: GOOD } }));
  const before = calls.length;
  for (const key of ["", " "]) {
    const { status, json } = await run(p, ["collect", CAMPAIGN], { key });
    assert.equal(status, 0);
    assert.equal(json.mode, "manual");
    assert.equal(json.key.command, "npx --yes flyee@latest key set APIFY_TOKEN --browser --json");
    assert.equal(json.next_step.command.endsWith(`links ${CAMPAIGN} --json`), true);
  }
  assert.equal(calls.length, before);
  // without the variable, the key saved in flyee is the one used
  const saved = await run(p, ["collect", CAMPAIGN], { key: null });
  assert.equal(saved.json.mode, "apify", JSON.stringify(saved.json));
  assert.equal(saved.json.collected, true);
});

test("in a cloud session, the key kept as the environment's network secret collects, and the app never sends one", async (t) => {
  const p = project(t);
  await campaign(p);
  proxySecret = true;
  t.after(() => {
    proxySecret = false;
  });
  const before = calls.length;
  const check = await run(p, ["check"], { key: null, env: { CLAUDE_CODE_REMOTE: "true" } });
  assert.equal(check.json.apify_key, true, JSON.stringify(check.json));
  assert.equal(check.json.apify_key_from, "cloud_secret");
  const { status, json } = await run(p, ["collect", CAMPAIGN], { key: null, env: { CLAUDE_CODE_REMOTE: "true" } });
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.mode, "apify");
  assert.equal(json.collected, true);
  const made = calls.slice(before);
  assert.ok(made.some((call) => call.method === "POST"), "the collection ran");
  assert.ok(made.every((call) => call.auth === null), "the key stays with the proxy, never in the app's requests");
});

test("in a cloud session with no secret, the research is the guided one and the key request names the environment", async (t) => {
  const p = project(t);
  await campaign(p);
  const { status, json } = await run(p, ["collect", CAMPAIGN], { key: null, env: { CLAUDE_CODE_REMOTE: "true" } });
  assert.equal(status, 0);
  assert.equal(json.mode, "manual");
  assert.equal(json.key.cloud, true);
  assert.equal(json.key.command, undefined, "no page opens in a cloud session");
  assert.match(json.key.how, /segredo de rede/);
});

test("above the cost ceiling: the value to say, no call, and the run only with --confirm-cost", async (t) => {
  const p = project(t, { sources: { cost_warn_usd: 0.01 } });
  await campaign(p);
  const before = calls.length;
  const refused = await run(p, ["collect", CAMPAIGN]);
  assert.equal(refused.status, 1);
  assert.equal(refused.json.error.code, "needs_confirmation");
  assert.match(refused.json.error.message, /US\$ 0,07/);
  assert.equal(calls.length, before, "nothing was sent to Apify");
  const confirmed = await run(p, ["collect", CAMPAIGN, "--confirm-cost"]);
  assert.equal(confirmed.json.collected, true);
});

test("a key Apify refuses, and an address that is not this machine", async (t) => {
  const p = project(t);
  await campaign(p);
  const wrong = await run(p, ["collect", CAMPAIGN], { key: "chave-errada" });
  assert.equal(wrong.json.error.code, "apify_unauthorized");
  assert.match(wrong.json.error.fix, /key set APIFY_TOKEN --browser --json/);
  const env = { ...process.env, HOME: join(p.root, "home"), USERPROFILE: join(p.root, "home"), APIFY_TOKEN: GOOD };
  const outside = await new Promise((done) => {
    const child = spawn(process.execPath, [p.script, "collect", CAMPAIGN, "--apify-url", "https://exemplo.com/v2", "--json"], { cwd: p.root, env, windowsHide: true });
    let stdout = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.on("close", (status) => done({ status, json: JSON.parse(stdout) }));
  });
  assert.equal(outside.json.error.code, "usage", "the key never goes to another address");
});

test("the files the partner apps save become evidence: posts above their normal, apart by kind, and comments", async (t) => {
  const p = project(t);
  await campaign(p);
  const research = join(p.root, "instagram-research", "profiles", "perfil.teste");
  mkdirSync(research, { recursive: true });
  writeFileSync(join(research, "profile.json"), JSON.stringify({
    ok: true,
    command: "profile",
    app: { name: "instagram-research", version: "1.0.0" },
    id: "perfil.teste",
    source: { type: "apify", collected_at: "2026-10-12", ref: "https://www.instagram.com/perfil.teste/" },
    baseline: { reels: { value: 59, n: 27, status: "measured" }, static: { value: 12, n: 3, status: "indication" } },
    durations: [{ id: "up_to_20s", label: "até 20 s", n: 9, median_multiplier: 1.4 }, { id: "over_60s", label: "acima de 60 s", n: 2, median_multiplier: 3 }],
    reels: [
      { id: "AbC1", url: "https://www.instagram.com/reel/AbC1/", kind: "reel", plays: 2645, metric: 2645, multiplier: 44.83, duration_s: 18, caption: "Usar IA não é deixar de saber MTC" },
      { id: "AbC2", url: "https://www.instagram.com/reel/AbC2/", kind: "reel", plays: 60, metric: 60, multiplier: 1.02, duration_s: 30 },
    ],
    static: [{ id: "XyZ1", url: "https://www.instagram.com/p/XyZ1/", kind: "static", plays: null, metric: 40, multiplier: 3.33 }],
  }));
  const organic = await run(p, ["import", CAMPAIGN, "instagram-research/profiles/perfil.teste/profile.json"], { url: false });
  assert.equal(organic.status, 0, JSON.stringify(organic.json));
  assert.equal(organic.json.kind, "instagram_posts");
  const evidence = JSON.parse(readFileSync(join(p.dir, "evidencias.json"), "utf8"));
  const reel = evidence.items.find((item) => item.id === "org-perfil-teste-abc1");
  assert.deepEqual([reel.data.plays, reel.data.baseline, reel.data.multiplier, reel.data.small_sample], [2645, 59, 44.83, false]);
  assert.equal(evidence.items.some((item) => item.id === "org-perfil-teste-abc2"), false, "a post at its normal is not evidence");
  const still = evidence.items.find((item) => item.id === "org-perfil-teste-xyz1");
  assert.deepEqual([still.data.post_kind, still.data.plays, still.data.metric_name, still.data.small_sample], ["static", null, "curtidas e comentários", true]);
  assert.equal(evidence.items.filter((item) => item.kind === "organic_pattern").length, 1, "only a length bucket with 3 Reels or more");

  const youtube = join(p.root, "youtube-research", "videos", "abc123");
  mkdirSync(youtube, { recursive: true });
  writeFileSync(join(youtube, "comments.json"), JSON.stringify({ format_version: 1, id: "abc123", title: "Como organizo a anamnese", url: "https://www.youtube.com/watch?v=abc123", fetched_at: "2026-10-12T10:00:00.000Z", comments: [{ text: "Eu perco o fio quando paro para digitar.", likes: 40 }, { text: "Obrigado pelo vídeo", likes: 2, by_creator: true }] }));
  const words = await run(p, ["import", CAMPAIGN, "youtube-research/videos/abc123/comments.json"], { url: false });
  assert.equal(words.json.kind, "youtube_comments");
  assert.equal(words.json.added.length, 1, "the creator's own answers are not the audience");
  const comment = JSON.parse(readFileSync(join(p.dir, "evidencias.json"), "utf8")).items.find((item) => item.kind === "audience_comment");
  assert.deepEqual([comment.who, comment.data.likes, comment.source.collected_at], ["público no YouTube", 40, "2026-10-12"]);
});
