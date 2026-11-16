// The order the Orkestree sends and the delivery that goes back, both checked here before any
// call: an order is read as data, never as instructions, and a delivery leaves this machine only
// when every file has its SHA-256, every text fits the order's limits, nothing asks for what the
// order did not ask, and the member declared that no piece carries a person made by AI.

import { existsSync } from "node:fs";
import { basename, isAbsolute, join, resolve, sep } from "node:path";

import { AppError, fileDigest, readJson, safeCampaign } from "./util.mjs";

const fold = (text) => String(text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
const isText = (value) => typeof value === "string" && value.trim().length > 0;

/** Checks the shape of an order (contract section 5) and returns it; throws `order_invalid` with the field. */
export function checkOrder(order) {
  const bad = (field, why) => new AppError("order_invalid", `O pedido não tem a forma esperada: ${field} ${why}.`, "Pegue o pedido de novo; se repetir, mostre esta mensagem ao integrante.", { field });
  if (!order || typeof order !== "object") throw bad("order", "não veio");
  if (order.version !== 1) throw bad("version", "não é 1");
  if (!isText(order.id)) throw bad("id", "está vazio");
  if (!safeCampaign(order.campaign)) throw bad("campaign", "não é um nome de pasta seguro");
  if (order.kind !== "anuncios") throw bad("kind", `é ${JSON.stringify(order.kind)}, e esta versão do app produz só pedidos de anúncios`);
  if (!Array.isArray(order.formats) || !order.formats.length || !order.formats.every((item) => isText(item?.placement) && isText(item?.format))) throw bad("formats", "precisa de ao menos um formato com placement e format");
  const hasConcepts = Array.isArray(order.concepts) && order.concepts.length > 0;
  const hasVerdicts = Boolean(order.from_verdicts && Array.isArray(order.from_verdicts.rows) && order.from_verdicts.rows.length);
  if (hasConcepts === hasVerdicts) throw bad("concepts", "e from_verdicts não podem vir juntos nem faltar os dois");
  if (hasConcepts && !order.concepts.every((concept) => isText(concept?.key))) throw bad("concepts", "precisa de key em cada conceito");
  if (!Number.isInteger(order.per_concept) || order.per_concept < 1) throw bad("per_concept", "precisa ser um número inteiro");
  return order;
}

/** The concept keys the order allows: its own concepts, or those of the ads it judged. */
export function orderConcepts(order) {
  if (Array.isArray(order.concepts) && order.concepts.length) return new Set(order.concepts.map((concept) => concept.key));
  return new Set((order.from_verdicts?.rows ?? []).map((row) => row.concept).filter(Boolean));
}

/** The ad names a returned order wants again, or null when the whole order is open. */
export function returnedNames(order) {
  if (order.state !== "returned" || !Array.isArray(order.returned?.reasons)) return null;
  return new Set(order.returned.reasons.map((reason) => reason.ad_name).filter(Boolean));
}

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/u;
const PHONE = /(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[\s.-]?\d{4}/;

/**
 * Builds the delivery manifest (contract section 6) from what the ad creatives app delivered:
 * entrega/nomes.json, the concept cards in conceitos.json and, when present, each piece's final
 * acceptance. Returns { manifest, uploads, problems }: `problems` lists every reason the
 * delivery cannot go, each with the ad and the field.
 */
export async function buildDelivery({ root, campaignDir, order, buttons, producer, declared }) {
  const problems = [];
  const names = readJson(join(campaignDir, "entrega", "nomes.json"));
  if (!names || !Array.isArray(names.ads)) throw new AppError("delivery_missing", "A entrega do app de criativos ainda não existe nesta campanha (entrega/nomes.json).", "Termine a produção com o app de criativos: o último passo dele monta a entrega.");
  const cards = readJson(join(campaignDir, "conceitos.json"));
  const byKey = new Map((cards?.concepts ?? []).map((concept) => [concept.key, concept]));
  const allowed = orderConcepts(order);
  const wanted = returnedNames(order);
  const formats = order.formats;
  const limits = order.text_limits ?? {};
  const seen = new Set();
  const ads = [];
  const uploads = [];

  for (const ad of names.ads) {
    if (wanted && !wanted.has(ad.ad_name)) continue;
    const where = (field) => ({ ad_name: ad.ad_name, field });
    if (!isText(ad.ad_name)) {
      problems.push({ ...where("ad_name"), code: "outside_order", say: "Um anúncio da entrega está sem nome." });
      continue;
    }
    if (!allowed.has(ad.concept)) problems.push({ ...where("concept"), code: "outside_order", say: `O conceito ${ad.concept} não está no pedido.` });
    const card = byKey.get(ad.concept);
    const copy = card?.copy ?? {};
    const button = copy.cta ? buttons[fold(copy.cta)] ?? null : buttons["saiba mais"];
    if (copy.cta && !button) problems.push({ ...where("button"), code: "button_unknown", say: `O botão "${copy.cta}" não está na lista que o app conhece. Escolha outro da lista do app de criativos.` });
    const texts = { primary: String(copy.primary_text ?? "").trim(), headline: String(copy.headline ?? "").trim(), description: String(copy.description ?? "").trim(), button };
    if (!texts.primary || !texts.headline) problems.push({ ...where("texts"), code: "texts_missing", say: "O anúncio está sem texto principal ou sem título na ficha do conceito." });
    for (const field of ["primary", "headline", "description"]) {
      const max = limits[field];
      if (typeof max === "number" && texts[field].length > max) problems.push({ ...where(`texts.${field}`), code: "text_limit", say: `O ${field === "primary" ? "texto principal" : field === "headline" ? "título" : "texto da descrição"} tem ${texts[field].length} caracteres e o pedido aceita até ${max}.` });
    }
    for (const field of ["primary", "headline", "description"]) if (EMAIL.test(texts[field]) || PHONE.test(texts[field])) problems.push({ ...where(`texts.${field}`), code: "personal_data", say: "O texto parece trazer um e-mail ou um telefone." });

    const files = [];
    for (const item of ad.files ?? []) {
      const path = isAbsolute(item.file ?? "") ? null : String(item.file ?? "").includes("/") ? resolve(root, item.file) : resolve(campaignDir, "entrega", item.file ?? "");
      if (!path || !path.startsWith(resolve(root) + sep) || !existsSync(path)) {
        problems.push({ ...where("files"), code: "file_missing", say: `O arquivo ${item.file} não está na pasta da entrega.` });
        continue;
      }
      const target = formats.find((format) => format.format === item.format);
      if (!target) {
        problems.push({ ...where("files"), code: "outside_order", say: `O formato ${item.format} de ${item.file} não está no pedido, que pede ${formats.map((format) => format.format).join(", ")}.` });
        continue;
      }
      const name = basename(path);
      if (seen.has(name)) {
        problems.push({ ...where("files"), code: "file_twice", say: `Dois arquivos da entrega têm o mesmo nome, ${name}.` });
        continue;
      }
      seen.add(name);
      const digest = await fileDigest(path);
      files.push({ file: name, placement: target.placement, format: item.format, kind: item.kind ?? (/\.(png|jpe?g|webp)$/i.test(name) ? "image" : "video"), sha256: digest.sha256, bytes: digest.bytes });
      uploads.push({ file: name, path, bytes: digest.bytes });
    }
    if (!files.length) problems.push({ ...where("files"), code: "file_missing", say: "O anúncio está sem nenhum arquivo." });
    const accept = readJson(join(campaignDir, "pecas", ad.concept ?? "", "final", "aceite.json"));
    const checks = Array.isArray(accept?.delivery_checks) ? accept.delivery_checks.filter((check) => check && isText(check.name ?? check.id)).map((check) => ({ name: String(check.name ?? check.id), ok: Boolean(check.ok ?? check.passed), ...(check.value !== undefined ? { value: String(check.value) } : {}) })) : accept ? [{ name: "aceite", ok: Boolean(accept.passed) }] : [];
    ads.push({ ad_name: ad.ad_name, concept: ad.concept, angle: ad.angle ?? card?.angle ?? null, texts, files, checks });
  }
  if (wanted) for (const name of wanted) if (!ads.some((ad) => ad.ad_name === name)) problems.push({ ad_name: name, field: "ad_name", code: "returned_missing", say: `O anúncio devolvido ${name} não está na entrega nova.` });
  if (!ads.length) problems.push({ ad_name: null, field: "ads", code: "delivery_missing", say: "A entrega não tem nenhum anúncio deste pedido." });
  if (!declared) problems.push({ ad_name: null, field: "declares", code: "declaration_missing", say: "Falta o sim do integrante: nenhuma peça traz pessoa, depoimento ou especialista gerado por IA, e nenhuma traz dado pessoal." });

  const manifest = { version: 1, producer, declares: { no_synthetic_people: Boolean(declared), no_personal_data: Boolean(declared) }, ads };
  return { manifest, uploads, problems };
}
