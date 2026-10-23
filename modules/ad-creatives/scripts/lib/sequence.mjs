// The sequence of the target date: four dated pieces from the plan's calendar (the list opens,
// the offer is live, the countdown, the last day), each with the price, the deadline and the
// rules of the offer and the consumer-code lines, checked by the same copy rules as every ad,
// and declared on the network each format is checked against.

import { checkCopy } from "./copy.mjs";

const brl = (value) => (typeof value === "number" ? `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}` : null);
const brDay = (day) => (day ? `${day.slice(8, 10)}/${day.slice(5, 7)}` : "");
const addDays = (day, n) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);

export const ZONES = { "9:16": "ads_meta", "4:5": "ads_meta_feed", "1:1": "ads_meta_feed" };
export const CDC_LINES = ["o preço de referência é o praticado, não um preço inflado", "o prazo com data e hora, na peça e na página", "as regras escritas: quem pode, quantas vagas, o que acontece na renovação", "os 7 dias de arrependimento da compra à distância", "quem já é cliente nunca paga mais do que quem entra agora"];

/**
 * Builds the four pieces. `plan` is plano.json (calendar and offer), `brief` the campaign's
 * briefing, `limits` references/meta-anuncios.json. Returns { pieces, warnings, say }.
 */
export function targetSequence({ plan, brief, limits, today = null }) {
  const phases = plan?.calendar?.phases ?? plan?.budget?.by_phase?.map((item) => ({ id: item.phase, start: item.start, end: item.end })) ?? [];
  const warm = phases.find((phase) => phase.id === "aquecimento");
  const peak = phases.find((phase) => phase.id === "pico");
  if (!warm || !peak) throw Object.assign(new Error("O plano não tem as fases de aquecimento e pico para datar a sequência."), { code: "plan_incomplete" });
  const option = plan?.offer?.options?.[0] ?? null;
  const price = option?.price_brl ?? plan?.economics?.price_brl ?? null;
  const deadline = peak.end;
  const brand = brief?.marca ?? plan?.brand ?? "a marca";
  const product = brief?.produto ?? "";
  const offerLabel = option?.label ?? brief?.oferta ?? "a oferta";
  const warnings = [];
  const specs = [
    { id: "abertura-lista", label: "Abertura para a lista", date: addDays(warm.start, -2), headline: "Quer saber da oferta primeiro?", primary: `${brand} abre a oferta para quem entrar na lista antes de todo mundo. ${product ? `${product}. ` : ""}Entre na lista e receba o acesso em ${brDay(warm.start)}.`, cta: "Cadastre-se" },
    { id: "oferta-no-ar", label: "Oferta no ar", date: peak.start, headline: `Até ${brDay(deadline)}: ${offerLabel.length > 20 ? "a oferta do ano" : offerLabel}`, primary: `${offerLabel}${price ? `, ${brl(price)}` : ""}, até ${brDay(deadline)} às 23h59. ${product ? `${product}. ` : ""}Quem já é cliente tem a sua condição; 7 dias para se arrepender com o valor de volta.`, cta: "Assinar" },
    { id: "contagem-regressiva", label: "Contagem regressiva", date: addDays(peak.start, Math.floor(daysBetween(peak.start, peak.end) / 2)), headline: `Faltam ${daysBetween(addDays(peak.start, Math.floor(daysBetween(peak.start, peak.end) / 2)), deadline)} dia(s)`, primary: `A oferta termina em ${brDay(deadline)} às 23h59. ${offerLabel}${price ? `, ${brl(price)}` : ""}. As regras estão na página; o preço de referência é o de tabela.`, cta: "Assinar" },
    { id: "ultimo-dia", label: "Último dia", date: deadline, headline: "Último dia: fecha hoje às 23h59", primary: `Hoje é o último dia da oferta. ${offerLabel}${price ? `, ${brl(price)}` : ""}. Depois das 23h59 o preço volta ao de tabela, sem prorrogação.`, cta: "Assinar" },
  ];
  const pieces = specs.map((spec) => {
    const copy = { primary_text: spec.primary, headline: spec.headline, description: `${brand}: a oferta até ${brDay(deadline)}`, cta: spec.cta };
    const checked = checkCopy({ copy }, { limits, terms: brief?.termos ?? [], numberSourced: true });
    if (!checked.passed) warnings.push({ code: "copy", piece: spec.id, problems: checked.problems.map((problem) => problem.say) });
    return {
      id: spec.id,
      label: spec.label,
      date: spec.date,
      schedule_on: addDays(spec.date, -2),
      schedule_note: `programar a subida em ${brDay(addDays(spec.date, -2))}, dois dias antes, para passar pela revisão antes do dia`,
      copy,
      copy_check: { passed: checked.passed, problems: checked.problems, warnings: checked.warnings },
      formats: { "9:16": { placement: "vertical", network: ZONES["9:16"] }, "4:5": { placement: "feed", network: ZONES["4:5"] }, "1:1": { placement: "quadrado", network: ZONES["1:1"] } },
      offer: { label: offerLabel, price_brl: price, deadline, cdc: CDC_LINES },
      audience: spec.id === "abertura-lista" ? "frio e remarketing de quem visitou" : "remarketing (visitou, cadastrou, viu a oferta) e a base por e-mail no mesmo dia",
      past: today ? daysBetween(today, spec.date) < 0 : false,
    };
  });
  for (const piece of pieces.filter((item) => item.past)) warnings.push({ code: "past_date", piece: piece.id, text: `"${piece.label}" caía em ${brDay(piece.date)}, que já passou.` });
  return { version: 1, plan: plan.plan ?? null, target_date: peak.start, deadline, pieces, warnings, say: `${pieces.length} peças datadas pelo plano: ${pieces.map((piece) => `${piece.label} em ${brDay(piece.date)}`).join(", ")}; o vertical conferido em ${ZONES["9:16"]}, o 4:5 e a imagem em ${ZONES["4:5"]}; cada uma sobe programada dois dias antes.` };
}

/** sequencia.md for the member: the four pieces, the texts and what the law asks on each. */
export function sequenceMarkdown(sequence, { campaign }) {
  const lines = [`# A sequência da data alvo: ${campaign}`, "", `Quatro peças datadas pelo plano${sequence.plan ? ` ${sequence.plan}` : ""}, com a oferta, o prazo e as regras escritos. Cada uma sobe programada dois dias antes da data, para passar pela revisão da plataforma. Quem cria os anúncios no Gerenciador é você.`, ""];
  lines.push("| Data | Peça | Título | Chamado | Subir em | Público |", "|---|---|---|---|---|---|");
  for (const piece of sequence.pieces) lines.push(`| ${brDay(piece.date)} | ${piece.label} | ${piece.copy.headline} | ${piece.copy.cta} | ${brDay(piece.schedule_on)} | ${piece.audience} |`);
  lines.push("");
  for (const piece of sequence.pieces) {
    lines.push(`## ${piece.label} (${brDay(piece.date)})`, "", piece.copy.primary_text, "", `Formatos: 9:16 (${piece.formats["9:16"].network}), 4:5 e 1:1 (${piece.formats["4:5"].network}).`, "");
    if (!piece.copy_check.passed) lines.push("Reprovado na conferência de texto:", ...piece.copy_check.problems.map((problem) => `- ${problem.say}`), "");
  }
  lines.push("## O que a lei pede em cada peça", "", ...CDC_LINES.map((line) => `- ${line}`));
  return `${lines.join("\n").trimEnd()}\n`;
}
