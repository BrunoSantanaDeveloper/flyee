// The concepts of a campaign (conceitos.json, version 1). The AI writes the concepts; this
// module checks them against the evidence and the labels, computes the confidence (D11) and the
// ad names (D21), and refuses what would mislead: a cited id that does not exist, a testimonial
// without the member's material, two concepts that would look the same.

import { isAbsolute, relative, resolve, sep } from "node:path";

import { normalizePattern } from "./campaign.mjs";
import { promiseIn } from "./copy.mjs";
import { SOURCE_FAMILY } from "./evidence.mjs";
import { isFile } from "./files.mjs";
import { AppError, slugify } from "./util.mjs";

export const CONCEPTS_VERSION = 1;
/** D9: three concepts, one per barrier or motivator, the three ads in the same ad set. */
export const CONCEPT_COUNT = 3;
/** D11: the confidence of a concept by the number of independent kinds of source behind it. */
export const CONFIDENCE = ["aposta", "baixa", "media", "alta"];
export const CONFIDENCE_LABELS = { aposta: "aposta", baixa: "baixa", media: "média", alta: "alta" };
export const TEMPLATES = ["problema-mecanismo", "produto-em-uso", "lista"];
export const DEFAULT_SUCCESS = "Entre os anúncios, a maior taxa de quem passa dos 3 primeiros segundos e o menor custo por resultado na primeira semana.";

/**
 * The pieces a concept can have, one per placement of the same ad (D9). `token` is what the file
 * name carries for that piece; the ad's own name is the vertical video's.
 */
export const PLACEMENTS = {
  vertical: { id: "vertical", label: "Vídeo vertical 9:16 (Stories e Reels)", format: "9:16", kind: "video", token: "reels" },
  feed: { id: "feed", label: "Vídeo 4:5 (feed)", format: "4:5", kind: "video", token: "feed" },
  imagem: { id: "imagem", label: "Imagem 4:5 (feed)", format: "4:5", kind: "image", token: "imagem" },
  quadrado: { id: "quadrado", label: "Imagem 1:1 (feed e coluna da direita)", format: "1:1", kind: "image", token: "quadrado" },
};
export const ENABLED_PLACEMENTS = ["vertical", "feed", "imagem", "quadrado"];
export const DEFAULT_PLACEMENTS = ["vertical", "feed", "imagem"];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const invalid = (path, problem, fix) => new AppError("concepts_invalid", `conceitos.json tem um problema em ${path}: ${problem}`, fix ?? "Corrija o conceitos.json e rode concepts de novo.");

export function confidenceOf(families) {
  return CONFIDENCE[Math.min(families.length, CONFIDENCE.length - 1)];
}

/** "<angulo>-<formato>-<gancho>-v<n>" with the concept's values. */
export function adName(pattern, { concept, placement, version = 1 }) {
  const values = {
    angulo: concept.angle,
    conceito: concept.key,
    formato: PLACEMENTS[placement]?.token ?? placement,
    gancho: concept.hook?.tag ?? concept.hook?.family,
    n: String(version),
  };
  return pattern.replace(/<([a-z]+)>/g, (_, token) => values[token] ?? "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/** The content of a concept that the member approves: change it and the approval no longer holds. */
export function approvalContent(concept) {
  const { key, driver, angle, hook, proof, structure, visual, template, formats, copy, version } = concept;
  return { key, driver, angle, hook, proof, structure, visual, template, formats, copy, version: version ?? 1 };
}

/**
 * Checks conceitos.json and returns the concepts with what the script computes: `confidence`
 * (overwriting any value written in the file), `confidence_basis` and `ad_names`.
 */
export function checkConcepts(data, { evidence, labels, brief, root, campaignDir, enabled = ENABLED_PLACEMENTS }) {
  if (!data || typeof data !== "object") throw invalid("(raiz)", "o arquivo não é um objeto JSON.");
  if (data.version !== CONCEPTS_VERSION) throw invalid("version", `a versão precisa ser ${CONCEPTS_VERSION}.`);
  if (!Array.isArray(data.concepts) || !data.concepts.length) throw invalid("concepts", "a lista de conceitos está vazia.");
  if (data.concepts.length > CONCEPT_COUNT) throw invalid("concepts", `${data.concepts.length} conceitos: a campanha testa no máximo ${CONCEPT_COUNT}, um por barreira ou motivador, para a verba não se dividir.`);
  const byId = new Map(evidence.items.map((item) => [item.id, item]));
  const dims = labels.dimensions;
  const needsMaterial = new Set(labels.requires_member_material ?? []);
  const keys = new Set();
  const warnings = [];
  const pattern = brief.padrao ?? "<conceito>-<formato>-<gancho>-v<n>";
  const checkedPattern = normalizePattern(pattern);
  if (!checkedPattern.ok) throw invalid("briefing", `o padrão do nome do anúncio não é válido: ${checkedPattern.problem}`, "Corrija o padrão do nome no briefing.md.");
  const concepts = data.concepts.map((concept, index) => {
    const at = (field) => `concepts[${index}].${field}`;
    if (!concept || typeof concept !== "object") throw invalid(`concepts[${index}]`, "cada conceito é um objeto.");
    if (typeof concept.key !== "string" || !SLUG.test(concept.key) || concept.key.length > 30) throw invalid(at("key"), "a chave é curta, em minúsculas sem acento e hífens, como memoria.");
    if (keys.has(concept.key)) throw invalid(at("key"), `a chave "${concept.key}" se repete.`);
    keys.add(concept.key);
    if (!concept.driver || !Object.hasOwn(dims.driver.values, concept.driver.type)) throw invalid(at("driver.type"), `o tipo é ${Object.keys(dims.driver.values).join(" ou ")}.`);
    if (!nonEmpty(concept.driver.text)) throw invalid(at("driver.text"), "falta a barreira ou o motivador, em uma frase.");
    if (typeof concept.angle !== "string" || !SLUG.test(concept.angle)) throw invalid(at("angle"), "o ângulo é uma palavra em minúsculas sem acento, como presenca.");
    if (brief.le_nome && brief.angulos_site?.length && !brief.angulos_site.map((angle) => slugify(angle, 30)).includes(concept.angle)) {
      throw invalid(at("angle"), `o site lê o nome do anúncio e conhece só estes ângulos: ${brief.angulos_site.join(", ")}. Com "${concept.angle}", a página mostraria a manchete padrão.`, "Use um ângulo que o site conhece, ou peça ao integrante para incluir o novo no site antes de lançar.");
    }
    if (!concept.hook || !Object.hasOwn(dims.hook_family.values, concept.hook.family)) throw invalid(at("hook.family"), `a família de gancho precisa ser uma de: ${Object.keys(dims.hook_family.values).join(", ")}.`);
    if (!nonEmpty(concept.hook.text)) throw invalid(at("hook.text"), "falta o texto do gancho, o que aparece nos 3 primeiros segundos.");
    if (concept.hook.tag !== undefined && (typeof concept.hook.tag !== "string" || !SLUG.test(concept.hook.tag) || concept.hook.tag.length > 16)) {
      throw invalid(at("hook.tag"), "a etiqueta do gancho vai no nome do anúncio: até 16 caracteres, minúsculas sem acento e hífens.");
    }
    if (!concept.proof || !Object.hasOwn(dims.proof.values, concept.proof.type)) throw invalid(at("proof.type"), `o tipo de prova precisa ser um de: ${Object.keys(dims.proof.values).join(", ")}.`);
    if (needsMaterial.has(concept.proof.type)) {
      const material = memberMaterial(root, campaignDir, concept.proof.material);
      if (!material) {
        throw invalid(at("proof.material"), `uma prova do tipo ${concept.proof.type} só entra com um arquivo do integrante em materiais/ (o depoimento, a foto, o vídeo, com a autorização dele).`, "Peça o material ao integrante e aponte o arquivo em proof.material, ou troque a prova por demonstracao, numero ou nenhuma. Nada de pessoa ou depoimento gerado.");
      }
      concept.proof.material = material;
    }
    if (concept.proof.type === "numero" && !nonEmpty(concept.proof.source)) throw invalid(at("proof.source"), "um número na prova precisa da fonte (de onde ele vem).");
    for (const [field, dimension] of [["structure", "structure"], ["visual", "visual"]]) {
      if (!Object.hasOwn(dims[dimension].values, concept[field])) throw invalid(at(field), `precisa ser um de: ${Object.keys(dims[dimension].values).join(", ")}.`);
    }
    const template = concept.template ?? (TEMPLATES.includes(concept.structure) ? concept.structure : "problema-mecanismo");
    if (!TEMPLATES.includes(template)) throw invalid(at("template"), `o modelo de página precisa ser um de: ${TEMPLATES.join(", ")}.`);
    const formats = concept.formats ?? DEFAULT_PLACEMENTS;
    if (!Array.isArray(formats) || !formats.length) throw invalid(at("formats"), `as peças são uma lista com ${enabled.join(", ")}.`);
    formats.forEach((format, formatIndex) => {
      if (!enabled.includes(format)) throw invalid(at(`formats[${formatIndex}]`), `"${format}" não é uma peça desta versão do app. As peças são: ${enabled.join(", ")}.`);
    });
    if (!formats.includes("vertical")) throw invalid(at("formats"), "todo conceito tem o vídeo vertical: é ele que dá o nome do anúncio.");
    for (const list of ["evidence", "against"]) {
      const ids = concept[list] ?? [];
      if (!Array.isArray(ids)) throw invalid(at(list), "é uma lista de ids de evidencias.json.");
      ids.forEach((id, idIndex) => {
        if (!byId.has(id)) throw invalid(at(`${list}[${idIndex}]`), `o id "${id}" não existe em evidencias.json.`, "Use os ids que o comando evidence mostra; um conceito sem evidência fica como aposta.");
        if (byId.get(id).excluded) warnings.push(`${concept.key}: "${id}" está fora da análise (exclude) e não conta para a confiança.`);
      });
    }
    if (!concept.copy || !nonEmpty(concept.copy.primary_text) || !nonEmpty(concept.copy.headline)) throw invalid(at("copy"), "o texto do anúncio precisa de primary_text e headline.");
    const version = concept.version ?? 1;
    if (!Number.isInteger(version) || version < 1 || version > 99) throw invalid(at("version"), "a versão é um número inteiro de 1 a 99.");
    // the card orders bets: it never promises a result (invariant 2)
    const sourcedNumber = concept.proof.type === "numero" && nonEmpty(concept.proof.source);
    for (const [field, text] of [["driver.text", concept.driver.text], ["hook.text", concept.hook.text], ["proof.text", concept.proof.text], ["success_criterion", concept.success_criterion]]) {
      const promise = promiseIn(text);
      if (promise && !(promise.rule === "result_number" && sourcedNumber)) {
        throw invalid(at(field), `o texto ${promise.say}: "${promise.quote}". A ficha ordena apostas e não promete resultado.`, "Reescreva sem prometer venda, retorno ou número de resultado; um número só entra como prova, com a fonte.");
      }
    }

    // D11: what the script counts, never what the file says
    const cited = (concept.evidence ?? []).map((id) => byId.get(id)).filter((item) => item && !item.excluded);
    const families = [...new Set(cited.map((item) => SOURCE_FAMILY[item.kind]).filter(Boolean))].sort();
    const confidence = confidenceOf(families);
    // the ad is named once, after its vertical video; a pattern without <formato> names every piece
    // alike, so the file of each other piece carries its placement after the ad's name
    const nameOf = (placement) => adName(checkedPattern.pattern, { concept, placement, version });
    const mainName = nameOf("vertical");
    const names = Object.fromEntries(formats.map((placement) => {
      const name = nameOf(placement);
      return [placement, placement === "vertical" || name !== mainName ? name : `${mainName}-${PLACEMENTS[placement].token}`];
    }));
    for (const [placement, name] of Object.entries(names)) {
      if (!SLUG.test(name)) throw invalid(at("formats"), `o nome do anúncio "${name}" (${placement}) tem caracteres que o site não lê: só minúsculas sem acento, números e hífens.`, "Confira o ângulo, a etiqueta do gancho e o padrão do nome.");
      if (placement === "vertical" && name.length > 64) throw invalid(at("formats"), `o nome do anúncio "${name}" passa de 64 caracteres.`, "Encurte o ângulo ou a etiqueta do gancho.");
      if (brief.le_nome && name.split("-")[0] !== concept.angle && checkedPattern.pattern.startsWith("<angulo>")) {
        throw invalid(at("angle"), `o nome "${name}" não começa pelo ângulo ${concept.angle}: o site escolheria a manchete errada.`);
      }
    }
    if (!families.length) warnings.push(`${concept.key}: sem evidência, sai como aposta.`);
    return {
      ...concept,
      template,
      formats,
      version,
      success_criterion: nonEmpty(concept.success_criterion) ? concept.success_criterion : DEFAULT_SUCCESS,
      confidence,
      confidence_basis: { families, items: cited.length },
      ad_name: names.vertical,
      ad_names: names,
    };
  });
  // two concepts that would look and open the same are one concept tested twice
  for (let a = 0; a < concepts.length; a++) {
    for (let b = a + 1; b < concepts.length; b++) {
      if (concepts[a].visual === concepts[b].visual && concepts[a].hook.family === concepts[b].hook.family) {
        throw invalid(`concepts[${b}]`, `${concepts[b].key} tem o mesmo estilo visual (${concepts[b].visual}) e a mesma família de gancho (${concepts[b].hook.family}) de ${concepts[a].key}: o teste não separaria um do outro.`, "Mude o estilo visual ou a família de gancho de um deles.");
      }
    }
  }
  const allNames = concepts.flatMap((concept) => Object.values(concept.ad_names));
  const repeated = allNames.find((name, index) => allNames.indexOf(name) !== index);
  if (repeated) throw invalid("concepts", `o nome de anúncio "${repeated}" se repete.`, "Mude o ângulo, a etiqueta do gancho ou a versão de um dos conceitos.");
  const angles = concepts.map((concept) => concept.angle);
  const sameAngle = angles.find((angle, index) => angles.indexOf(angle) !== index);
  if (sameAngle) warnings.push(`Dois conceitos usam o ângulo ${sameAngle}: o teste compara ideias, e duas iguais dividem a verba.`);
  if (concepts.length < CONCEPT_COUNT) warnings.push(`${concepts.length} conceito(s): o conjunto foi pensado para ${CONCEPT_COUNT}, um por barreira ou motivador.`);
  return { concepts, warnings };
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/** A file of the member in the campaign's materiais/ folder, as a path from the project root. */
function memberMaterial(root, campaignDir, path) {
  if (typeof path !== "string" || !path.trim()) return null;
  const materials = resolve(campaignDir, "materiais");
  for (const base of [campaignDir, root]) {
    const full = resolve(base, path);
    const inside = relative(materials, full);
    if (!inside || inside.startsWith("..") || isAbsolute(inside)) continue;
    if (isFile(full)) return relative(root, full).split(sep).join("/");
  }
  return null;
}

/** What changed in the computed confidence since the concepts were approved (rule: evidence that arrives later). */
export function confidenceChanges(concepts, approved) {
  if (!approved?.confidence) return [];
  return concepts
    .filter((concept) => approved.confidence[concept.key] && approved.confidence[concept.key] !== concept.confidence)
    .map((concept) => ({ key: concept.key, from: approved.confidence[concept.key], to: concept.confidence }));
}
