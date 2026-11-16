// An order of the Orkestree in the campaign folder: the briefing takes from it what it says and
// asks only the rest, the budget and the research are not asked, and the cards that keep the
// order's key, angle and hook carry the approval a person of the company gave there.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { checkBriefing } from "../scripts/lib/campaign.mjs";
import { briefFromOrder, orderApproval, readOrder } from "../scripts/lib/order.mjs";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(TESTS_DIR, "..");
const CAMPAIGN = "cafe-aurora-novembro";

/** The order of the contract's example, for a fictional brand. */
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
  concepts: [{ key: "manha", angle: "manha", barrier_or_motivator: "falta de tempo de manhã", hook: "O café chega antes de você acordar", evidence: ["pesquisa com 40 assinantes, 2026-10"], approved: { at: "2026-11-16T11:40:00.000Z", by: "gestor", where: "orkestree" } }],
  from_verdicts: null,
  formats: [{ placement: "reels", format: "9:16" }],
  per_concept: 1,
  name_pattern: "<angulo>-<formato>-<gancho>-v<n>",
  text_limits: { primary: 125, headline: 27, description: 27 },
  returned: null,
  taken_at: "2026-11-16T12:05:00.000Z",
};

test("the order's brand, product, audience and forbidden terms fill the briefing when they come", () => {
  const fields = briefFromOrder({ ...ORDER, brand: "Café Aurora", product: "Assinatura de café em grão.", audience: "Quem trabalha cedo", forbidden_terms: [] });
  assert.equal(fields.marca, "Café Aurora");
  assert.equal(fields.produto, "Assinatura de café em grão");
  assert.equal(fields.publico, "Quem trabalha cedo");
  assert.equal(fields.termos_proibidos, "nenhum", "an empty list is an answer: nothing forbidden");
  assert.equal(briefFromOrder({ ...ORDER, forbidden_terms: ["garantido", "milagre"] }).termos_proibidos, "garantido, milagre");
  assert.equal(briefFromOrder(ORDER).marca, undefined, "a field that did not come stays for the member");
});

test("the order answers the page, the event, the offer, the dates and the name pattern", () => {
  const fields = briefFromOrder(ORDER);
  assert.equal(fields.pagina, "https://cafeaurora.example/assinatura");
  assert.equal(fields.evento, "Compra");
  assert.equal(fields.preco, "R$ 59");
  assert.equal(fields.oferta, "R$ 59, por mês");
  assert.equal(fields.datas, "de 24/11 a 30/11");
  assert.equal(fields.padrao_nome, "<angulo>-<formato>-<gancho>-v<n>");
  assert.match(fields.nome_lido, /^sim/);
  assert.equal(fields.verba, undefined, "the budget is the Orkestree's");
});

test("with an order, the briefing asks neither the budget nor the competitors", () => {
  const text = "# Briefing\n\n- Marca: Café Aurora\n- Produto: assinatura de café\n- Oferta: R$ 59, por mês\n- Página de destino: https://cafeaurora.example/assinatura\n- Evento de otimização: Compra\n- Público: quem trabalha cedo\n- O site lê o nome do anúncio: sim\n- Padrão do nome: <angulo>-<formato>-<gancho>-v<n>\n- Termos proibidos: nenhum\n";
  assert.deepEqual(checkBriefing(text, { order: true }).missing, []);
  assert.deepEqual(checkBriefing(text).missing.map((entry) => entry.field).sort(), ["concorrentes", "verba"]);
});

test("the approval holds while the cards keep the order's key, angle and hook", () => {
  const card = { key: "manha", angle: "manha", hook: { text: "O café chega antes de você acordar" } };
  assert.deepEqual(orderApproval(ORDER, [card]), { at: "2026-11-16T11:40:00.000Z", by: "orkestree", order: "po-7" });
  assert.equal(orderApproval(ORDER, [{ ...card, hook: { text: "Outro gancho" } }]), null, "a new hook needs a new yes");
  assert.equal(orderApproval(ORDER, [{ ...card, key: "noite" }]), null, "a concept the order did not ask for needs a yes");
  assert.equal(orderApproval({ ...ORDER, concepts: null }, [card]), null);
});

test("an order of another kind or version is not read as one", () => {
  const dir = mkdtempSync(join(tmpdir(), "pedido-"));
  writeFileSync(join(dir, "pedido.json"), JSON.stringify({ ...ORDER, kind: "conteudo" }));
  assert.equal(readOrder(dir), null);
  writeFileSync(join(dir, "pedido.json"), JSON.stringify(ORDER));
  assert.equal(readOrder(dir).id, "po-7");
  rmSync(dir, { recursive: true, force: true });
});

function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const source = join(from, entry);
    if (statSync(source).isDirectory()) copyDir(source, join(to, entry));
    else copyFileSync(source, join(to, entry));
  }
}

function run(root, script, args) {
  return new Promise((done) => {
    const home = join(root, "home");
    mkdirSync(home, { recursive: true });
    const child = spawn(process.execPath, [script, ...args, "--json"], { cwd: root, env: { ...process.env, HOME: home, USERPROFILE: home, APIFY_TOKEN: "" }, windowsHide: true });
    let stdout = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.on("close", () => done(JSON.parse(stdout)));
  });
}

test("brief with an order fills what it says, asks only the rest and skips the budget and the research", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "anuncios-pedido-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const appDir = join(root, ".flyee", "modules", "ad-creatives");
  for (const dir of ["scripts", "runtime", "references"]) copyDir(join(APP_DIR, dir), join(appDir, dir));
  copyFileSync(join(APP_DIR, "flyee.module.json"), join(appDir, "flyee.module.json"));
  const script = join(appDir, "scripts", "ads.mjs");
  mkdirSync(join(root, "anuncios", CAMPAIGN), { recursive: true });
  writeFileSync(join(root, "anuncios", CAMPAIGN, "pedido.json"), JSON.stringify(ORDER));

  const created = await run(root, script, ["new", CAMPAIGN]);
  assert.equal(created.ok, true, JSON.stringify(created));
  const first = await run(root, script, ["brief", CAMPAIGN]);
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(first.order.id, "po-7");
  assert.deepEqual([...first.filled_from_order].sort(), ["datas", "evento", "nome_lido", "oferta", "padrao_nome", "pagina", "preco"]);
  const asked = first.missing.map((entry) => entry.field).sort();
  assert.deepEqual(asked, ["marca", "produto", "publico", "termos_proibidos"], "only what the order does not carry");
  assert.match(first.next_step.say, /não voltam como pergunta/);

  // The member answers the four in one message; the AI writes them in the briefing.
  const path = join(root, "anuncios", CAMPAIGN, "briefing.md");
  const fill = (text, label, value) => text.replace(new RegExp(`^(\\s*[-*]\\s*${label}(?:\\s*\\([^)]*\\))?\\s*:).*$`, "m"), `$1 ${value}`);
  let answered = readFileSync(path, "utf8");
  answered = fill(answered, "Marca", "Café Aurora");
  answered = fill(answered, "Produto", "Assinatura de café em grão");
  answered = fill(answered, "Público", "Quem trabalha cedo e não tem tempo de passar café");
  answered = fill(answered, "Termos proibidos", "nenhum");
  writeFileSync(path, answered);
  const second = await run(root, script, ["brief", CAMPAIGN]);
  assert.equal(second.complete, true, JSON.stringify(second.missing));
  assert.equal(second.next_step.action, "capture", "the brand's site comes first; no budget sum and no research with an order");
  const status = await run(root, script, ["status", CAMPAIGN]);
  assert.equal(status.stage, "conceitos");

  // An order that carries the four leaves nothing to ask.
  const full = "cafe-aurora-dezembro";
  mkdirSync(join(root, "anuncios", full), { recursive: true });
  writeFileSync(join(root, "anuncios", full, "pedido.json"), JSON.stringify({ ...ORDER, id: "po-8", campaign: full, brand: "Café Aurora", product: "Assinatura de café em grão", audience: "Quem trabalha cedo", forbidden_terms: [] }));
  await run(root, script, ["new", full]);
  const complete = await run(root, script, ["brief", full]);
  assert.deepEqual(complete.missing, [], "nothing the order says comes back as a question");
  assert.equal(complete.complete, true);
});
