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
  url: "o endereço da página para a conferência",
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

export function renderPlan({ facts, type, checks, models, today }) {
  const rows = Object.entries(FACT_LABELS)
    .filter(([path]) => type.facts.includes(path) || valueAt(facts, path) !== null)
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
    "Os campos em [a decidir] são perguntados numa mensagem só, cada um com uma sugestão.",
    "",
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
