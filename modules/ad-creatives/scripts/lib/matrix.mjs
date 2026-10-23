// The creative matrix: angles crossed with formats, so the first wave tests ideas and not
// variations of one idea. Three to four angles, eight to twelve pieces; two angles that differ
// in one dimension only are one angle tested twice, and the matrix refuses them.

import { AppError } from "./util.mjs";

export const MATRIX_VERSION = 1;
export const ANGLES = { min: 3, max: 4 };
export const PIECES = { min: 8, max: 12 };
/** The dimensions an angle has; two angles sharing all but one are too close. */
export const ANGLE_DIMENSIONS = ["driver", "hook_family", "visual"];

export const FORMATS = {
  reels: { label: "Vídeo 9:16 com tela real (Reels e Stories)", kind: "video", placement: "vertical", needs_recording: false },
  "video-4-5": { label: "Vídeo 4:5 para o feed", kind: "video", placement: "feed", needs_recording: false },
  imagem: { label: "Imagem 4:5 ou 1:1", kind: "image", placement: "imagem", needs_recording: false },
  carrossel: { label: "Carrossel estático", kind: "image", placement: "carrossel", needs_recording: false },
  depoimento: { label: "Depoimento (roteiro e plano de cena; o integrante grava)", kind: "recording", placement: "vertical", needs_recording: true },
  fundador: { label: "Fundador falando (roteiro e plano de cena; o integrante grava)", kind: "recording", placement: "vertical", needs_recording: true },
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function invalid(path, why, fix = "Corrija o campo apontado em matriz.json e rode matrix de novo.") {
  return Object.assign(new AppError("matrix_invalid", `matriz.json, ${path}: ${why}`, fix), { details: { path } });
}

/** The matrix the three concepts of a campaign imply: one angle per concept, its formats as pieces. */
export function matrixFromConcepts(concepts, labels) {
  const map = { vertical: "reels", feed: "video-4-5", imagem: "imagem", quadrado: "imagem" };
  const angles = concepts.map((concept) => ({ key: concept.key, driver: concept.driver?.type ?? null, hook_family: concept.hook?.family ?? null, visual: concept.visual ?? null, promise: concept.hook?.text ?? "", concept: concept.key }));
  const pieces = [];
  for (const concept of concepts) {
    const formats = [...new Set((concept.formats ?? ["vertical", "feed", "imagem"]).map((format) => map[format]).filter(Boolean))];
    for (const format of formats) pieces.push({ angle: concept.key, format, hook: concept.hook?.text ?? "", concept: concept.key });
  }
  // Three concepts in one format only are not a first wave: the matrix proposes the default
  // placements for each concept, marked as proposals the AI confirms with the member.
  if (pieces.length < PIECES.min) {
    for (const concept of concepts) {
      for (const format of ["reels", "video-4-5", "imagem"]) {
        if (!pieces.some((piece) => piece.angle === concept.key && piece.format === format)) pieces.push({ angle: concept.key, format, hook: concept.hook?.text ?? "", concept: concept.key, proposed: true });
      }
    }
  }
  return { version: MATRIX_VERSION, from_concepts: true, angles, pieces, labels_checked_on: labels?.checked_on ?? null };
}

/**
 * Checks matriz.json. Returns { angles, pieces, counts, warnings } with `needs_recording` on the
 * pieces whose format is a person on camera. Throws `matrix_invalid` with the path.
 */
export function checkMatrix(data, { labels }) {
  if (!data || typeof data !== "object") throw invalid("(raiz)", "o arquivo não é um objeto JSON.");
  if (data.version !== MATRIX_VERSION) throw invalid("version", `a versão precisa ser ${MATRIX_VERSION}.`);
  if (!Array.isArray(data.angles)) throw invalid("angles", "é a lista de ângulos.");
  if (data.angles.length < ANGLES.min || data.angles.length > ANGLES.max) throw invalid("angles", `${data.angles.length} ângulo(s): a primeira leva testa de ${ANGLES.min} a ${ANGLES.max} ideias diferentes.`, data.angles.length < ANGLES.min ? "Acrescente um ângulo que venda outra ideia (outra barreira ou motivador)." : "Tire o ângulo mais parecido com outro; o que sobrar entra na leva seguinte.");
  const dims = labels?.dimensions ?? {};
  const keys = new Set();
  const angles = data.angles.map((angle, index) => {
    const at = (field) => `angles[${index}].${field}`;
    if (!angle || typeof angle !== "object") throw invalid(`angles[${index}]`, "cada ângulo é um objeto.");
    if (typeof angle.key !== "string" || !SLUG.test(angle.key) || angle.key.length > 30) throw invalid(at("key"), "a chave é curta, em minúsculas sem acento e hífens, como presenca.");
    if (keys.has(angle.key)) throw invalid(at("key"), `a chave "${angle.key}" se repete.`);
    keys.add(angle.key);
    if (dims.driver?.values && !Object.hasOwn(dims.driver.values, angle.driver)) throw invalid(at("driver"), `o tipo é ${Object.keys(dims.driver.values).join(" ou ")}.`);
    if (dims.hook_family?.values && !Object.hasOwn(dims.hook_family.values, angle.hook_family)) throw invalid(at("hook_family"), `a família de gancho precisa ser uma de: ${Object.keys(dims.hook_family.values).join(", ")}.`);
    if (dims.visual?.values && !Object.hasOwn(dims.visual.values, angle.visual)) throw invalid(at("visual"), `o estilo visual precisa ser um de: ${Object.keys(dims.visual.values).join(", ")}.`);
    if (typeof angle.promise !== "string" || !angle.promise.trim()) throw invalid(at("promise"), "falta a promessa do ângulo, em uma frase, nas palavras do público.");
    return { key: angle.key, driver: angle.driver, hook_family: angle.hook_family, visual: angle.visual, promise: angle.promise.trim(), concept: typeof angle.concept === "string" ? angle.concept : null };
  });
  for (let a = 0; a < angles.length; a++) {
    for (let b = a + 1; b < angles.length; b++) {
      const differ = ANGLE_DIMENSIONS.filter((dimension) => angles[a][dimension] !== angles[b][dimension]);
      if (differ.length <= 1) {
        throw invalid(`angles[${b}]`, `${angles[b].key} e ${angles[a].key} diferem só em ${differ.length ? differ[0] : "nada"}: são uma ideia testada duas vezes, e a leitura não separaria uma da outra.`, "Mude duas dimensões (barreira ou motivador, família de gancho, estilo visual) ou troque o ângulo por outra ideia.");
      }
    }
  }
  if (!Array.isArray(data.pieces)) throw invalid("pieces", "é a lista de peças.");
  if (data.pieces.length < PIECES.min || data.pieces.length > PIECES.max) throw invalid("pieces", `${data.pieces.length} peça(s): a primeira leva tem de ${PIECES.min} a ${PIECES.max}, para cada ângulo aparecer em mais de um formato sem dividir a verba demais.`, data.pieces.length < PIECES.min ? "Acrescente formatos aos ângulos (o vídeo 4:5, a imagem, o carrossel)." : "Tire as peças que repetem ângulo e formato; elas entram na leva seguinte.");
  const pieces = data.pieces.map((piece, index) => {
    const at = (field) => `pieces[${index}].${field}`;
    if (!piece || typeof piece !== "object") throw invalid(`pieces[${index}]`, "cada peça é um objeto.");
    if (!keys.has(piece.angle)) throw invalid(at("angle"), `o ângulo "${piece.angle}" não está em angles.`);
    if (!Object.hasOwn(FORMATS, piece.format)) throw invalid(at("format"), `o formato precisa ser um de: ${Object.keys(FORMATS).join(", ")}.`);
    const format = FORMATS[piece.format];
    return { angle: piece.angle, format: piece.format, label: format.label, kind: format.kind, placement: format.placement, hook: typeof piece.hook === "string" ? piece.hook.trim() : "", concept: typeof piece.concept === "string" ? piece.concept : angles.find((angle) => angle.key === piece.angle)?.concept ?? null, needs_recording: format.needs_recording, script_only: format.needs_recording, proposed: Boolean(piece.proposed) };
  });
  const seen = new Set();
  pieces.forEach((piece, index) => {
    const key = `${piece.angle}|${piece.format}|${piece.hook}`;
    if (seen.has(key)) throw invalid(`pieces[${index}]`, `a peça ${piece.angle} em ${piece.format} com o mesmo gancho se repete.`, "Dê a ela outro gancho, ou tire a repetição.");
    seen.add(key);
  });
  const warnings = [];
  const byAngle = Object.fromEntries(angles.map((angle) => [angle.key, pieces.filter((piece) => piece.angle === angle.key).length]));
  for (const [angle, count] of Object.entries(byAngle)) {
    if (count === 0) warnings.push(`O ângulo ${angle} não tem peça: ele não entra no teste.`);
    else if (count === 1) warnings.push(`O ângulo ${angle} tem uma peça só: se ela falhar no gancho, a ideia morre sem ter sido testada.`);
  }
  if (!pieces.some((piece) => piece.format === "reels")) warnings.push("Nenhuma peça em vídeo 9:16: os Reels e os Stories ficam de fora da primeira leva.");
  const recordings = pieces.filter((piece) => piece.needs_recording);
  if (recordings.length) warnings.push(`${recordings.length} peça(s) pedem gravação (depoimento ou fundador): o app entrega o roteiro e o plano de cena; quem grava é o integrante, com autorização de quem aparece.`);
  const byFormat = Object.fromEntries(Object.keys(FORMATS).map((format) => [format, pieces.filter((piece) => piece.format === format).length]));
  return { angles, pieces, counts: { angles: angles.length, pieces: pieces.length, by_angle: byAngle, by_format: byFormat, needs_recording: recordings.length }, warnings };
}

/** matriz.md: the matrix as a table the member reads. */
export function matrixMarkdown(checked, { campaign }) {
  const lines = [`# Matriz de criativos: ${campaign}`, "", `${checked.counts.angles} ângulos, ${checked.counts.pieces} peças na primeira leva. Cada linha é uma ideia; cada coluna, um jeito de mostrá-la. O teste compara ideias; variações de uma ideia só entram depois que ela vence.`, ""];
  const formats = Object.keys(FORMATS).filter((format) => checked.counts.by_format[format] > 0);
  lines.push(`| Ângulo | Promessa | ${formats.map((format) => FORMATS[format].label.split(" (")[0]).join(" | ")} |`, `|---|---|${formats.map(() => "---").join("|")}|`);
  for (const angle of checked.angles) {
    const cells = formats.map((format) => {
      const n = checked.pieces.filter((piece) => piece.angle === angle.key && piece.format === format).length;
      return n ? `${n}${FORMATS[format].needs_recording ? " (gravar)" : ""}` : "";
    });
    lines.push(`| ${angle.key} | ${angle.promise} | ${cells.join(" | ")} |`);
  }
  if (checked.counts.needs_recording) lines.push("", "Peças marcadas com (gravar) saem como roteiro e plano de cena: quem grava é você, com a autorização de quem aparece. Nada de pessoa ou depoimento gerado.");
  if (checked.warnings.length) lines.push("", "Avisos:", ...checked.warnings.map((warning) => `- ${warning}`));
  return `${lines.join("\n").trimEnd()}\n`;
}
