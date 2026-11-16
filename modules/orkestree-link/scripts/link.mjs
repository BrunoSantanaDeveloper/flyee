#!/usr/bin/env node
// Ligação com o Orkestree: the member's AI runs this script from the project root, in the
// member's own session. It lists the orders the Orkestree made, writes an order into the
// campaign folder for the ad creatives app, and sends the delivery back, every file with its
// SHA-256. Only JSON goes to stdout (with --json); every result carries `next_step`. Nothing here
// touches an ad account: the Orkestree creates the ads, after a person of the company says yes.

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { baseUrl, call, CONTRACT, putFile } from "./lib/client.mjs";
import { buildDelivery, checkOrder, returnedNames } from "./lib/manifest.mjs";
import { AppError, KEY_NAME, orkestreeToken, parseArgs, projectRoot, readJson, safeCampaign, toPosix, writeJson } from "./lib/util.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(SCRIPTS_DIR, "..");
const ROOT = projectRoot(SCRIPTS_DIR);
const INTERFACE_VERSION = 1;
const APP = { name: "orkestree-link", version: readJson(join(APP_DIR, "flyee.module.json"))?.version ?? "0.0.0" };
const BUTTONS = readJson(join(APP_DIR, "references", "botoes.json"))?.buttons ?? {};

const ARG_SPEC = { flags: ["json", "declare", "dry-run", "replace"], options: ["url", "file"] };

const HELP = `Ligação com o Orkestree (interface ${INTERFACE_VERSION}, contrato de produção ${CONTRACT})

  check                                   o token, a versão do contrato e os limites do Orkestree
  orders                                  os pedidos abertos da empresa
  take <pedido> [--replace]               grava o pedido em anuncios/<campanha>/pedido.json
  take --file <arquivo do pedido>         o mesmo, a partir do arquivo que o portal deu, sem o token
  order <pedido>                          o estado de um pedido
  deliver <campanha> --declare [--dry-run]  monta a entrega conferida e envia ao Orkestree

Todos aceitam --json. Os comandos partem da raiz do projeto (a pasta que contém .flyee/).`;

const command = (text) => `node .flyee/modules/orkestree-link/scripts/link.mjs ${text} --json`;
const rel = (path) => toPosix(ROOT, path);
const base = (name) => ({ ok: true, command: name, interface_version: INTERFACE_VERSION, app: APP });
const usage = (message, fix = "Rode help para ver os comandos.") => new AppError("usage", message, fix);
const keyStep = { action: "key", command: `npx --yes flyee@latest key set ${KEY_NAME} --browser --json`, say: "Abra a página do navegador para o integrante colar o token de produção que o portal do Orkestree deu. Sem o token, o pedido vem pelo arquivo que o portal entrega." };

function tokenOrStop() {
  const { token } = orkestreeToken();
  if (!token) throw new AppError("needs_member", "Falta o token de produção do Orkestree nesta máquina.", "O integrante cria o token no portal do Orkestree e cola na página que a sua IA abre.", { next_step: keyStep });
  return token;
}

async function contractLimits(url) {
  const version = await call(url, null, "GET", "/api/production/version");
  if (version.contract !== CONTRACT) throw new AppError("contract_unsupported", `O Orkestree serve a versão ${version.contract} do contrato de produção, e este app fala a ${CONTRACT}.`, "Atualize o app com npx --yes flyee@latest update orkestree-link --yes --json.");
  return version.limits ?? {};
}

const campaignDir = (campaign) => join(ROOT, "anuncios", campaign);
const orderFile = (campaign) => join(campaignDir(campaign), "pedido.json");

// ---------------------------------------------------------------- commands

async function checkCommand(values) {
  const url = baseUrl(values.url);
  const { token, from } = orkestreeToken();
  let limits = null;
  let reachable = false;
  try {
    limits = await contractLimits(url);
    reachable = true;
  } catch (error) {
    if (error.code === "contract_unsupported") throw error;
  }
  const next = !token ? keyStep : { action: "orders", command: command("orders"), say: "Veja os pedidos abertos da empresa." };
  return { ...base("check"), project: ROOT, contract: CONTRACT, token: Boolean(token), token_from: from, orkestree: { reachable, limits }, next_step: next };
}

async function ordersCommand(values) {
  const url = baseUrl(values.url);
  const token = tokenOrStop();
  await contractLimits(url);
  const listed = await call(url, token, "GET", "/api/production/orders");
  const orders = (Array.isArray(listed.orders) ? listed.orders : []).map((order) => ({ id: order.id, campaign: order.campaign, kind: order.kind, state: order.state, issued_at: order.issued_at, due: order.due, pieces: order.pieces, taken: safeCampaign(order.campaign) && existsSync(orderFile(order.campaign)) && readJson(orderFile(order.campaign))?.id === order.id }));
  const next = orders.length
    ? { action: "offer", command: command(`take ${orders[0].id}`), say: `Diga ao integrante, numa frase por pedido, o que o Orkestree pediu (campanha, peças, prazo) e pergunte se pode produzir agora. Com o sim, pegue o pedido.` }
    : { action: "none", command: null, say: "Nenhum pedido aberto." };
  return { ...base("orders"), orders, next_step: next };
}

async function takeCommand(positionals, values) {
  let order;
  let source;
  if (values.file) {
    const file = resolve(ROOT, values.file);
    if (!file.startsWith(resolve(ROOT) + sep)) throw new AppError("outside_project", `${values.file} está fora do projeto.`, "Salve o arquivo do pedido dentro da pasta do projeto e rode de novo.");
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""));
    } catch {
      throw new AppError("order_invalid", `${values.file} não é um pedido em JSON.`, "Baixe de novo o arquivo do pedido no portal do Orkestree.");
    }
    order = parsed?.order ?? parsed;
    source = { from: "arquivo", file: toPosix(ROOT, file) };
  } else {
    const id = positionals[0];
    if (!id) throw usage("Informe o pedido: take <pedido>, ou take --file <arquivo>.");
    const url = baseUrl(values.url);
    const token = tokenOrStop();
    await contractLimits(url);
    order = (await call(url, token, "GET", `/api/production/orders/${encodeURIComponent(id)}`)).order;
    source = { from: "orkestree" };
  }
  checkOrder(order);
  if (!["open", "returned"].includes(order.state ?? "open")) throw new AppError("order_closed", `O pedido ${order.id} está ${order.state}: não espera entrega.`, "Veja os pedidos abertos com orders.");
  const target = orderFile(order.campaign);
  const current = readJson(target);
  if (current && current.id !== order.id && !values.replace) throw new AppError("order_conflict", `A campanha ${order.campaign} já tem o pedido ${current.id} na pasta.`, "Pergunte ao integrante se o pedido novo substitui o anterior; com o sim, rode take de novo com --replace.");
  mkdirSync(campaignDir(order.campaign), { recursive: true });
  writeJson(target, { ...order, taken_at: new Date().toISOString(), taken_by: { app: APP.name, app_version: APP.version, ...source } });
  const wanted = returnedNames(order);
  const pieces = (order.concepts?.length ?? new Set(order.from_verdicts.rows.map((row) => row.concept)).size) * order.per_concept;
  return {
    ...base("take"),
    order: { id: order.id, campaign: order.campaign, state: order.state ?? "open", due: order.due ?? null, concepts: order.concepts?.map((concept) => concept.key) ?? null, from_verdicts: Boolean(order.from_verdicts), formats: order.formats, per_concept: order.per_concept, pieces, returned: wanted ? [...wanted] : null },
    file: rel(target),
    next_step: { action: "produce", command: `node .flyee/modules/ad-creatives/scripts/ads.mjs new ${order.campaign} --json`, say: `O pedido está em ${rel(target)}. Produza com o app de criativos: new e depois brief, que lê o pedido; o que o pedido diz não volta como pergunta ao integrante.${wanted ? ` Só os anúncios devolvidos: ${[...wanted].join(", ")}.` : ""} Ao terminar a entrega dele, rode deliver.` },
  };
}

async function orderCommand(positionals, values) {
  const id = positionals[0];
  if (!id) throw usage("Informe o pedido: order <pedido>.");
  const url = baseUrl(values.url);
  const token = tokenOrStop();
  await contractLimits(url);
  const order = (await call(url, token, "GET", `/api/production/orders/${encodeURIComponent(id)}`)).order ?? {};
  const say = { open: "O pedido espera a entrega.", delivered: "A entrega chegou e espera a leitura de uma pessoa da empresa.", returned: "Uma pessoa da empresa devolveu anúncios, com o motivo de cada um.", accepted: "A entrega foi aceita.", cancelled: "O pedido foi cancelado.", expired: "O pedido passou do prazo sem entrega." }[order.state] ?? `O pedido está ${order.state}.`;
  return { ...base("order"), order: { id: order.id, campaign: order.campaign, state: order.state, due: order.due ?? null, returned: order.returned ?? null }, say, next_step: order.state === "returned" ? { action: "take", command: command(`take ${order.id} --replace`), say: "Pegue o pedido de novo e refaça só os anúncios devolvidos." } : { action: "none", command: null, say } };
}

async function deliverCommand(positionals, values) {
  const campaign = positionals[0];
  if (!campaign) throw usage("Informe a campanha: deliver <campanha> --declare.");
  const order = readJson(orderFile(campaign));
  if (!order) throw new AppError("order_missing", `A campanha ${campaign} não tem pedido do Orkestree na pasta.`, `Pegue o pedido antes: ${command("orders")}.`);
  checkOrder(order);
  const producer = { client: APP.name, client_version: APP.version, app: "ad-creatives", app_version: readJson(join(ROOT, ".flyee", "modules", "ad-creatives", "flyee.module.json"))?.version ?? null };
  const { manifest, uploads, problems } = await buildDelivery({ root: ROOT, campaignDir: campaignDir(campaign), order, buttons: BUTTONS, producer, declared: Boolean(values.declare) });
  const manifestPath = join(campaignDir(campaign), "entrega", "manifesto.json");
  writeJson(manifestPath, { order: order.id, ...manifest });
  if (problems.length) {
    const onlyDeclaration = problems.every((problem) => problem.code === "declaration_missing");
    return { ...base("deliver"), ok: false, sent: false, file: rel(manifestPath), problems, next_step: onlyDeclaration ? { action: "ask", command: null, say: "Pergunte ao integrante, numa pergunta só para isso: nenhuma peça mostra pessoa, depoimento ou especialista gerado por IA, e nenhuma traz dado pessoal? Com o sim dele, rode deliver de novo com --declare." } : { action: "fix", command: null, say: `${problems.length} ponto(s) impedem a entrega; cada um diz o anúncio e o campo. Corrija com o app de criativos e rode deliver de novo.` } };
  }
  const { token } = orkestreeToken();
  if (values["dry-run"] || !token) {
    return { ...base("deliver"), sent: false, file: rel(manifestPath), ads: manifest.ads.length, files: uploads.length, bytes: uploads.reduce((sum, item) => sum + item.bytes, 0), next_step: token ? { action: "deliver", command: command(`deliver ${campaign} --declare`), say: "A entrega está conferida. Rode sem --dry-run para enviar." } : { action: "portal", command: null, say: `A entrega está conferida em ${rel(manifestPath)}, com os arquivos na pasta entrega. Sem o token, o integrante sobe o manifesto e os arquivos na tela de entrega do pedido, no portal do Orkestree.` } };
  }
  const url = baseUrl(values.url);
  const limits = await contractLimits(url);
  const total = uploads.reduce((sum, item) => sum + item.bytes, 0);
  const tooBig = uploads.filter((item) => typeof limits.file_max_bytes === "number" && item.bytes > limits.file_max_bytes).map((item) => item.file);
  if (tooBig.length || (typeof limits.delivery_max_bytes === "number" && total > limits.delivery_max_bytes) || (typeof limits.files_max === "number" && uploads.length > limits.files_max)) throw new AppError("delivery_too_large", `A entrega passa dos limites do Orkestree${tooBig.length ? `: ${tooBig.join(", ")}` : ""}.`, "Gere versões menores das peças com o app de criativos e monte a entrega de novo.", { limits, files: tooBig });
  const opened = await call(url, token, "POST", `/api/production/orders/${encodeURIComponent(order.id)}/deliveries`, manifest);
  const delivery = opened.delivery ?? {};
  for (const upload of delivery.uploads ?? []) {
    const local = uploads.find((item) => item.file === upload.file);
    if (!local) throw new AppError("outside_order", `O Orkestree pediu o arquivo ${upload.file}, que não está no manifesto.`, "Monte a entrega de novo; se repetir, mostre esta mensagem ao integrante.");
    process.stderr.write(`Enviando ${upload.file}\n`);
    await putFile(upload.url, local.path, { contentType: upload.file.endsWith(".mp4") ? "video/mp4" : upload.file.endsWith(".png") ? "image/png" : upload.file.match(/\.jpe?g$/) ? "image/jpeg" : "application/octet-stream" });
  }
  const closed = await call(url, token, "POST", `/api/production/orders/${encodeURIComponent(order.id)}/deliveries/${encodeURIComponent(delivery.id)}/complete`);
  const record = { order: order.id, delivery: delivery.id, sent_at: new Date().toISOString(), state: closed.delivery?.state ?? null, order_state: closed.order?.state ?? null, files: manifest.ads.flatMap((ad) => ad.files.map((file) => ({ file: file.file, sha256: file.sha256, bytes: file.bytes }))) };
  writeJson(join(campaignDir(campaign), "entrega", "envio.json"), record);
  return { ...base("deliver"), sent: true, file: rel(manifestPath), delivery: { id: delivery.id, state: record.state }, order: { id: order.id, state: record.order_state }, ads: manifest.ads.length, files: uploads.length, next_step: { action: "tell", command: command(`order ${order.id}`), say: "A entrega chegou ao Orkestree, conferida arquivo por arquivo. Uma pessoa da empresa lê e aprova antes de qualquer anúncio ir ao ar; se ela devolver algum, o pedido volta com o motivo." } };
}

// ---------------------------------------------------------------- output

function renderText(result) {
  if (result.command === "help") return result.text;
  const lines = [];
  if (result.command === "orders") for (const order of result.orders) lines.push(`- ${order.id}: ${order.campaign}, ${order.pieces} peça(s), até ${order.due ?? "sem prazo"} (${order.state})`);
  if (result.problems) for (const problem of result.problems) lines.push(`- ${problem.ad_name ? `${problem.ad_name}: ` : ""}${problem.say}`);
  if (result.say) lines.push(result.say);
  if (result.next_step?.say) lines.push(`Próximo passo: ${result.next_step.say}`);
  return lines.join("\n") || JSON.stringify(result, null, 2);
}

async function main(argv) {
  const [name, ...rest] = argv;
  if (!name || ["help", "--help", "-h"].includes(name)) return { ...base("help"), text: HELP };
  const { positionals, values } = parseArgs(rest, ARG_SPEC);
  switch (name) {
    case "check":
      return checkCommand(values);
    case "orders":
      return ordersCommand(values);
    case "take":
      return takeCommand(positionals, values);
    case "order":
      return orderCommand(positionals, values);
    case "deliver":
      return deliverCommand(positionals, values);
    default:
      throw usage(`Comando desconhecido: ${name}.`);
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const json = process.argv.includes("--json");
  main(process.argv.slice(2))
    .then((result) => {
      process.stdout.write(json ? `${JSON.stringify(result)}\n` : `${renderText(result)}\n`);
      if (result.ok === false) process.exitCode = 1;
    })
    .catch((error) => {
      const known = error instanceof AppError;
      const failure = { ok: false, command: process.argv[2] ?? null, interface_version: INTERFACE_VERSION, app: APP, error: { code: known ? error.code : "unexpected", message: error.message, fix: known ? error.fix : "Rode de novo; se repetir, mostre esta mensagem ao integrante.", ...(error.details ? { details: error.details } : {}) } };
      if (known && error.details?.next_step) failure.next_step = error.details.next_step;
      process.stdout.write(json ? `${JSON.stringify(failure)}\n` : `Erro (${failure.error.code}): ${failure.error.message}\n${failure.error.fix}\n`);
      // process.exitCode, never process.exit: on Windows, exiting right after an HTTPS fetch aborts Node.
      process.exitCode = 1;
    });
}
