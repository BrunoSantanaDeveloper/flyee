// pagina.json (the facts of one page) and plano.md (what that page must have, from its type).

export const FACT_LABELS = {
  "product.name": "o nome do produto oferecido",
  "product.what": "o que ele é, em uma frase",
  audience: "para quem é a página, em uma frase",
  main_purchase: "o que a pessoa acabou de comprar ou está comprando",
  "offer.price": "o preço que vai ser cobrado, como sai no recibo",
  "offer.reference_price": "o preço normal, se a página mostrar um preço riscado",
  "offer.recurrence": "se é assinatura: mensal ou anual, e qual período abre marcado",
  "offer.renewal_price": "o valor da renovação, numa assinatura",
  "offer.guarantee_days": "os dias de garantia ou de cancelamento simples",
  "offer.deadline": "o prazo real da oferta, se houver um",
  "offer.plans": "os planos, com o preço e o período de cada um",
  "offer.recommended_plan": "o plano em destaque",
  "offer.trial_days": "os dias de teste grátis, se houver",
  "offer.cancellation": "como cancelar e se há fidelidade ou multa",
  cta_text: "o texto do botão principal",
  secondary_cta_text: "o texto do segundo chamado, se houver",
  decline_text: "o texto do link de recusa",
  "payment.one_click": "se o aceite cobra com um clique no meio de pagamento do pedido",
  "payment.provider": "o provedor de pagamento",
  "api.docs_url": "o endereço da documentação",
  "api.rate_limit": "os limites de uso: requisições por minuto, por dia ou por mês",
  "visual.direction": "a direção visual, em uma frase que diga o que torna a página deste produto",
  "demo.kind": "de onde vem a demonstração: componentes reais do projeto, tela real ou réplica",
  url: "o endereço da página para a conferência",
};

const DEMO_LABELS = {
  kind: "de onde vem a imagem (componentes, tela ou replica)",
  shows: "o objeto em foco",
  action: "a única ação",
  result: "o que muda e fica na tela",
  left_out: "o que fica de fora",
  real_today: "onde cada coisa mostrada existe no produto",
  sample_data: "os dados são inventados para a cena",
  selector: "o seletor da cena na página",
};

export function newFacts({ name, type, today }) {
  return {
    format_version: 1,
    name,
    type,
    created_at: today,
    url: null,
    language: "pt-BR",
    product: { name: null, what: null },
    audience: null,
    main_purchase: null,
    cta_text: null,
    secondary_cta_text: null,
    decline_text: null,
    offer: { price: null, reference_price: null, recurrence: null, renewal_price: null, guarantee_days: null, deadline: null, plans: null, recommended_plan: null, trial_days: null, cancellation: null },
    payment: { one_click: null, provider: null },
    api: { docs_url: null, rate_limit: null },
    visual: { direction: null, chosen: [] },
    brand: { colors: [], fonts: [], source: null },
    demo: { kind: null, shows: null, action: null, result: null, left_out: null, real_today: null, sample_data: null, animated: null, selector: null },
    claims: [],
    notes: [],
  };
}

function valueAt(facts, path) {
  return path.split(".").reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), facts);
}

/** The facts the type needs that pagina.json does not have yet. */
export function missingFacts(facts, type) {
  return type.facts.filter((path) => {
    const value = valueAt(facts, path);
    return value === null || value === undefined || value === "";
  });
}

function show(value) {
  if (value === null || value === undefined || value === "") return "[a decidir]";
  if (value === true) return "sim";
  if (value === false) return "não";
  return String(value);
}

/** The direction the page's look follows, the brand and what it keeps from the list of defaults on purpose. */
function visualLines(facts) {
  const chosen = Array.isArray(facts.visual?.chosen) ? facts.visual.chosen : [];
  const colors = Array.isArray(facts.brand?.colors) ? facts.brand.colors : [];
  const fonts = Array.isArray(facts.brand?.fonts) ? facts.brand.fonts : [];
  return [
    "## A direção visual",
    "",
    show(facts.visual?.direction),
    "",
    `- A marca: ${colors.length ? colors.join(", ") : "[cores a registrar]"}; ${fonts.length ? fonts.join(", ") : "[letras a registrar]"}${facts.brand?.source ? ` (de ${facts.brand.source})` : ""}.`,
    `- Escolhido de propósito da lista de vícios: ${chosen.length ? chosen.join(", ") : "nada"}.`,
    "",
  ];
}

/** The scene, for the types that show the product working. */
function demoLines(facts) {
  const demo = facts.demo ?? {};
  return [
    "## A demonstração",
    "",
    "| O quê | Valor |",
    "|---|---|",
    ...Object.entries(DEMO_LABELS).map(([key, label]) => `| ${label} | ${show(demo[key])} |`),
    "",
    "A ordem de preferência, as medidas e o que conferir estão no app, em references/demonstracao.md. A cena mostra só o que o produto faz hoje.",
    "",
  ];
}

/** What the page states as a fact, with where each one comes from. */
function claimLines(facts) {
  const claims = Array.isArray(facts.claims) ? facts.claims : [];
  return [
    "## Os números e as urgências",
    "",
    ...(claims.length
      ? ["| O que a página diz | De onde vem |", "|---|---|", ...claims.map((claim) => `| ${show(claim?.text)} | ${show(claim?.origin)} |`)]
      : ["Nenhum registrado ainda. Todo número de uso, escassez ou ano que a página afirmar entra aqui, com a origem."]),
    "",
  ];
}

export function renderPlan({ facts, type, checks, models, today }) {
  const rows = Object.entries(FACT_LABELS)
    .filter(([path]) => type.facts.includes(path) || (valueAt(facts, path) !== null && valueAt(facts, path) !== undefined))
    .map(([path, label]) => `| ${label} | ${show(valueAt(facts, path))} |`);
  const modelLines = models.length
    ? models.map((m) => `- ${m.title} (vista em ${m.seen_on}): ${m.highlights.join("; ")}.`)
    : ["- Ainda não há modelo analisado deste tipo: siga o roteiro."];
  const lines = [
    `# Plano da página ${facts.name}: ${type.label}`,
    "",
    `Escrito em ${today}. Onde fica: ${type.where}. O roteiro completo do tipo está no app, em references/${type.file}.`,
    "",
    "## Os fatos",
    "",
    "| O quê | Valor |",
    "|---|---|",
    ...rows,
    "",
    "Os campos em [a decidir] são perguntados numa mensagem só, cada decisão com uma sugestão que um sim aceita.",
    "",
    ...visualLines(facts),
    ...(type.demo ? demoLines(facts) : []),
    ...claimLines(facts),
    "## As seções, na ordem",
    "",
    ...type.sections.map((s, i) => `${i + 1}. ${s}`),
    "",
    "## A mecânica",
    "",
    ...type.mechanics.map((m) => `- ${m}`),
    "",
    "## A medição",
    "",
    `Eventos: ${type.events.map((e) => `\`${e}\``).join(", ")}. Cada posição de chamado leva a sua identificação.`,
    "",
    "## As linhas legais",
    "",
    ...type.legal.map((l) => `- ${l}`),
    "",
    "## Conferir à mão, lendo o código",
    "",
    ...type.manual.map((m) => `- [ ] ${m}`),
    "",
    "## A conferência automática",
    "",
    ...type.checks.map((id) => `- ${checks.checks[id]?.label ?? id} (\`${id}\`)`),
    "",
    "## Modelos deste tipo",
    "",
    ...modelLines,
    "",
  ];
  return lines.join("\n");
}
