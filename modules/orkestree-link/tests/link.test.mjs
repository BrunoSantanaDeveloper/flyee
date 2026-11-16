// The app against a fake Orkestree on this machine that speaks the production contract
// (orkestree/docs/CONTRATO-PRODUCAO.md, version 1): the five routes, the signed upload address
// per file and the SHA-256 check on complete. The member's own keys never reach the script.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, "..", "scripts", "link.mjs");
const TOKEN = "ork_p_teste";
const CAMPAIGN = "cafe-aurora-novembro";

const ORDER = {
  version: 1,
  id: "po-7",
  state: "open",
  issued_at: "2026-11-16T12:00:00.000Z",
  due: "2026-11-23",
  campaign: CAMPAIGN,
  kind: "anuncios",
  language: "pt-BR",
  objective: { platform: "meta", event: "purchase" },
  landing_url: "https://cafeaurora.example/assinatura",
  offer: { price: "R$ 59", term: "por mês", starts: "2026-11-24", ends: "2026-11-30" },
  concepts: [{ key: "manha", angle: "manha", barrier_or_motivator: "falta de tempo de manhã", hook: "O café chega antes de você acordar", evidence: ["pesquisa com 40 assinantes"], approved: { at: "2026-11-16T11:40:00.000Z", by: "gestor", where: "orkestree" } }],
  from_verdicts: null,
  formats: [{ placement: "reels", format: "9:16" }, { placement: "feed", format: "4:5" }],
  per_concept: 1,
  name_pattern: "<angulo>-<formato>-<gancho>-v<n>",
  text_limits: { primary: 125, headline: 27, description: 27 },
  returned: null,
};

/** The fake Orkestree. `state` records what arrived; `tamper` changes the bytes it stores for one file. */
async function fakeOrkestree({ tamper = null } = {}) {
  const state = { deliveries: [], stored: new Map(), calls: [] };
  const server = createServer((request, response) => {
    let body = [];
    request.on("data", (chunk) => body.push(chunk));
    request.on("end", () => {
      body = Buffer.concat(body);
      const url = new URL(request.url, "http://127.0.0.1");
      state.calls.push(`${request.method} ${url.pathname}`);
      const send = (status, data) => {
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(data));
      };
      if (url.pathname === "/api/production/version") return send(200, { contract: 1, limits: { file_max_bytes: 1_000_000, delivery_max_bytes: 5_000_000, files_max: 20 } });
      if (url.pathname.startsWith("/upload/") && request.method === "PUT") {
        const name = decodeURIComponent(url.pathname.slice("/upload/".length));
        state.stored.set(name, tamper === name ? Buffer.concat([body, Buffer.from("x")]) : body);
        response.writeHead(200);
        return response.end();
      }
      if (request.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: "invalid_token", message: "O token venceu ou foi encerrado." });
      if (url.pathname === "/api/production/orders" && request.method === "GET") return send(200, { orders: [{ id: ORDER.id, campaign: ORDER.campaign, kind: "anuncios", state: "open", issued_at: ORDER.issued_at, due: ORDER.due, pieces: 1 }] });
      if (url.pathname === `/api/production/orders/${ORDER.id}` && request.method === "GET") return send(200, { order: ORDER });
      if (url.pathname === "/api/production/orders/po-404" && request.method === "GET") return send(404, { error: "not_found", message: "O pedido não existe." });
      if (url.pathname === `/api/production/orders/${ORDER.id}/deliveries` && request.method === "POST") {
        const manifest = JSON.parse(body.toString("utf8"));
        if (!manifest.declares?.no_synthetic_people || !manifest.declares?.no_personal_data) return send(422, { error: "declaration_missing", message: "Falta a declaração." });
        const id = `d-${state.deliveries.length + 1}`;
        state.deliveries.push({ id, manifest });
        const port = server.address().port;
        return send(201, { delivery: { id, state: "uploading", uploads: manifest.ads.flatMap((ad) => ad.files.map((file) => ({ file: file.file, url: `http://127.0.0.1:${port}/upload/${encodeURIComponent(file.file)}`, expires_at: "2026-11-16T13:00:00.000Z" }))) } });
      }
      const complete = /^\/api\/production\/orders\/po-7\/deliveries\/(d-\d+)\/complete$/.exec(url.pathname);
      if (complete && request.method === "POST") {
        const delivery = state.deliveries.find((item) => item.id === complete[1]);
        const failed = delivery.manifest.ads.flatMap((ad) => ad.files).filter((file) => {
          const stored = state.stored.get(file.file);
          return !stored || stored.length !== file.bytes || createHash("sha256").update(stored).digest("hex") !== file.sha256;
        });
        if (failed.length) return send(422, { error: "manifest_mismatch", message: "Um arquivo não confere.", files: failed.map((file) => file.file) });
        return send(200, { delivery: { id: delivery.id, state: "received" }, order: { id: ORDER.id, state: "delivered" } });
      }
      return send(404, { error: "not_found", message: "Rota desconhecida." });
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return { url: `http://127.0.0.1:${server.address().port}`, state, close: () => new Promise((done) => server.close(done)) };
}

/** A member's project after the ad creatives app delivered: names, concept cards and the files. */
function project({ headline = "Café antes de acordar" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "orkestree-link-"));
  const campaign = join(root, "anuncios", CAMPAIGN);
  mkdirSync(join(campaign, "entrega"), { recursive: true });
  writeFileSync(join(campaign, "entrega", "manha-reels-cafe-v1.mp4"), Buffer.from("video vertical de teste"));
  writeFileSync(join(campaign, "entrega", "manha-feed-cafe-v1.mp4"), Buffer.from("video de feed de teste"));
  writeFileSync(join(campaign, "entrega", "nomes.json"), JSON.stringify({ version: 1, campaign: CAMPAIGN, ads: [{ ad_name: "manha-reels-cafe-v1", concept: "manha", angle: "manha", files: [{ file: "manha-reels-cafe-v1.mp4", placement: "vertical", format: "9:16", kind: "video" }, { file: "manha-feed-cafe-v1.mp4", placement: "feed", format: "4:5", kind: "video" }] }] }));
  writeFileSync(join(campaign, "conceitos.json"), JSON.stringify({ version: 1, concepts: [{ key: "manha", angle: "manha", hook: { text: "O café chega antes de você acordar" }, copy: { primary_text: "O café chega antes de você acordar. Assinatura a partir de R$ 59 por mês.", headline, description: "Torra fresca", cta: "Assinar" } }] }));
  // The creatives app writes its own name and version in the delivery report.
  writeFileSync(join(campaign, "relatorio.json"), JSON.stringify({ app: { name: "ad-creatives", version: "1.3.0" }, campaign: CAMPAIGN }));
  return root;
}

function run(root, args, { token = TOKEN } = {}) {
  return new Promise((done, fail) => {
    const home = join(root, "home");
    mkdirSync(home, { recursive: true });
    const env = { ...process.env, HOME: home, USERPROFILE: home, ORKESTREE_TOKEN: token ?? "" };
    const child = spawn(process.execPath, [SCRIPT, ...args, "--json"], { cwd: root, env, windowsHide: true });
    let stdout = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.on("error", fail);
    child.on("close", (status) => {
      try {
        done({ status, json: JSON.parse(stdout) });
      } catch {
        fail(new Error(`no JSON from ${args.join(" ")}: ${stdout}`));
      }
    });
  });
}

test("take writes the order into the campaign folder; a second order for the same campaign waits for a yes", async (t) => {
  const fake = await fakeOrkestree();
  t.after(fake.close);
  const root = project();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const noToken = await run(root, ["orders", "--url", fake.url], { token: null });
  assert.equal(noToken.json.error.code, "needs_member");
  assert.match(noToken.json.next_step.command, /key set ORKESTREE_TOKEN --browser --json/);

  const listed = await run(root, ["orders", "--url", fake.url]);
  assert.equal(listed.status, 0, JSON.stringify(listed.json));
  assert.deepEqual(listed.json.orders.map((order) => order.id), ["po-7"]);
  assert.equal(listed.json.next_step.action, "offer", "the member says yes before anything is produced");

  const taken = await run(root, ["take", "po-7", "--url", fake.url]);
  assert.equal(taken.status, 0, JSON.stringify(taken.json));
  const saved = JSON.parse(readFileSync(join(root, "anuncios", CAMPAIGN, "pedido.json"), "utf8"));
  assert.equal(saved.id, "po-7");
  assert.equal(saved.taken_by.app, "orkestree-link");
  assert.match(taken.json.next_step.command, /ad-creatives\/scripts\/ads\.mjs new cafe-aurora-novembro/);

  writeFileSync(join(root, "anuncios", CAMPAIGN, "pedido.json"), JSON.stringify({ ...ORDER, id: "po-6" }));
  const conflict = await run(root, ["take", "po-7", "--url", fake.url]);
  assert.equal(conflict.json.error.code, "order_conflict");
  const replaced = await run(root, ["take", "po-7", "--url", fake.url, "--replace"]);
  assert.equal(replaced.status, 0);

  const missing = await run(root, ["take", "po-404", "--url", fake.url]);
  assert.equal(missing.json.error.code, "not_found");
  const wrongToken = await run(root, ["orders", "--url", fake.url], { token: "ork_p_outro" });
  assert.equal(wrongToken.json.error.code, "invalid_token");
});

test("the delivery waits for the declaration, then goes with every file's SHA-256 and arrives checked", async (t) => {
  const fake = await fakeOrkestree();
  t.after(fake.close);
  const root = project();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  await run(root, ["take", "po-7", "--url", fake.url]);

  const undeclared = await run(root, ["deliver", CAMPAIGN, "--url", fake.url]);
  assert.equal(undeclared.json.ok, false);
  assert.deepEqual(undeclared.json.problems.map((problem) => problem.code), ["declaration_missing"]);
  assert.equal(undeclared.json.next_step.action, "ask");
  assert.equal(fake.state.deliveries.length, 0, "nothing leaves the machine without the yes");

  const sent = await run(root, ["deliver", CAMPAIGN, "--declare", "--url", fake.url]);
  assert.equal(sent.status, 0, JSON.stringify(sent.json));
  assert.equal(sent.json.sent, true);
  assert.equal(sent.json.order.state, "delivered");
  const manifest = fake.state.deliveries[0].manifest;
  assert.deepEqual(manifest.declares, { no_synthetic_people: true, no_personal_data: true });
  assert.equal(manifest.producer.client, "orkestree-link");
  const ad = manifest.ads[0];
  assert.deepEqual(ad.files.map((file) => [file.file, file.placement, file.format]), [["manha-reels-cafe-v1.mp4", "reels", "9:16"], ["manha-feed-cafe-v1.mp4", "feed", "4:5"]], "each file takes the order's placement for its format");
  const bytes = readFileSync(join(root, "anuncios", CAMPAIGN, "entrega", "manha-reels-cafe-v1.mp4"));
  assert.equal(ad.files[0].sha256, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(ad.texts.button, "SUBSCRIBE");
  assert.ok(existsSync(join(root, "anuncios", CAMPAIGN, "entrega", "envio.json")));
});

test("a file changed on the way comes back as manifest_mismatch, and nothing is accepted", async (t) => {
  const fake = await fakeOrkestree({ tamper: "manha-feed-cafe-v1.mp4" });
  t.after(fake.close);
  const root = project();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  await run(root, ["take", "po-7", "--url", fake.url]);
  const sent = await run(root, ["deliver", CAMPAIGN, "--declare", "--url", fake.url]);
  assert.equal(sent.json.error.code, "manifest_mismatch");
  assert.deepEqual(sent.json.error.details.files, ["manha-feed-cafe-v1.mp4"]);
  assert.ok(!existsSync(join(root, "anuncios", CAMPAIGN, "entrega", "envio.json")));
});

test("a text over the order's limit stops the delivery here, with the ad and the field", async (t) => {
  const fake = await fakeOrkestree();
  t.after(fake.close);
  const root = project({ headline: "Um título longo demais para o limite do pedido" });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  await run(root, ["take", "po-7", "--url", fake.url]);
  const sent = await run(root, ["deliver", CAMPAIGN, "--declare", "--url", fake.url]);
  assert.equal(sent.json.ok, false);
  assert.deepEqual(sent.json.problems.map((problem) => [problem.ad_name, problem.field, problem.code]), [["manha-reels-cafe-v1", "texts.headline", "text_limit"]]);
  assert.equal(fake.state.deliveries.length, 0);
});

test("without the token the order comes from the portal's file and the checked delivery stays in the folder", async (t) => {
  const root = project();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "pedido-baixado.json"), JSON.stringify({ order: ORDER }));
  const taken = await run(root, ["take", "--file", "pedido-baixado.json"], { token: null });
  assert.equal(taken.status, 0, JSON.stringify(taken.json));
  const outside = await run(root, ["take", "--file", "../fora.json"], { token: null });
  assert.equal(outside.json.error.code, "outside_project");
  const delivered = await run(root, ["deliver", CAMPAIGN, "--declare"], { token: null });
  assert.equal(delivered.json.sent, false);
  assert.equal(delivered.json.next_step.action, "portal");
  const manifest = JSON.parse(readFileSync(join(root, "anuncios", CAMPAIGN, "entrega", "manifesto.json"), "utf8"));
  assert.equal(manifest.order, "po-7");
  assert.equal(manifest.ads[0].files.length, 2);
});

test("what the Orkestree would refuse stops here first: the producer's version, another angle, more ads than per_concept, a file name it does not accept", async (t) => {
  const fake = await fakeOrkestree();
  t.after(fake.close);
  const root = project();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  await run(root, ["take", "po-7", "--url", fake.url]);
  const campaign = join(root, "anuncios", CAMPAIGN);
  rmSync(join(campaign, "relatorio.json"));
  writeFileSync(join(campaign, "entrega", "Manha Extra.mp4"), Buffer.from("x"));
  writeFileSync(join(campaign, "entrega", "nomes.json"), JSON.stringify({ version: 1, campaign: CAMPAIGN, ads: [
    { ad_name: "manha-reels-cafe-v1", concept: "manha", angle: "noite", files: [{ file: "manha-reels-cafe-v1.mp4", placement: "vertical", format: "9:16", kind: "video" }] },
    { ad_name: "manha-reels-cafe-v2", concept: "manha", angle: "manha", files: [{ file: "Manha Extra.mp4", placement: "vertical", format: "9:16", kind: "video" }] },
  ] }));
  const sent = await run(root, ["deliver", CAMPAIGN, "--declare", "--url", fake.url]);
  assert.equal(sent.json.ok, false);
  const found = sent.json.problems.map((problem) => `${problem.code}:${problem.field}`);
  assert.ok(found.includes("producer_unknown:producer.app_version"), found.join(" "));
  assert.ok(found.includes("outside_order:angle"), found.join(" "));
  assert.ok(found.includes("outside_order:concept"), "per_concept is 1 and the delivery has 2 ads of the concept");
  assert.ok(found.includes("outside_order:files"), "a file name with a space and capitals is refused");
  assert.equal(fake.state.deliveries.length, 0);
});

test("only a fake on this machine may replace the Orkestree address", async (t) => {
  const root = project();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const refused = await run(root, ["orders", "--url", "https://outro.example"]);
  assert.equal(refused.json.error.code, "usage");
});
