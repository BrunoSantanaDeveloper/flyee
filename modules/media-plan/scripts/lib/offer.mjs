// The offer: the options the plan may suggest, computed from the member's price, the collision
// between a running promotion and the next one, and the lines of the consumer code that an
// offer sold online has to carry. Method, not legal advice: the member confirms each line.

import { brl, daysBetween, pct, round2 } from "./util.mjs";
import { field } from "./premises.mjs";

/** Discount tiers the plan shows as options; anything deeper needs a stated reason. */
const TIERS = [15, 25, 35];

export function assessOffer(data, { targetDate = null } = {}) {
  const price = field(data, "preco_planos", "price_brl");
  const billing = field(data, "preco_planos", "billing") || "mensal";
  const annual = field(data, "preco_planos", "annual_brl");
  const current = data.current_offer ?? {};
  const options = [];
  const warnings = [];

  if (price !== null && billing === "mensal") {
    options.push({
      id: "anual-10-meses",
      label: "Anual pelo preço de 10 meses, parcelado",
      price_brl: round2(price * 10),
      equivalent_monthly_brl: round2((price * 10) / 12),
      discount_pct: round2((2 / 12) * 100),
      why: "dois meses de bônus em vez de um desconto no preço: a receita do ano entra de uma vez e o preço de tabela fica preservado.",
    });
    options.push({
      id: "anual-com-bonus",
      label: "Anual pelo preço de 12 meses, com um bônus de implantação",
      price_brl: round2(price * 12),
      equivalent_monthly_brl: price,
      discount_pct: 0,
      why: "sem desconto: o que muda é o bônus (uma sessão de implantação, a migração dos dados), que custa pouco e vale muito para quem começa.",
    });
    for (const tier of TIERS) {
      const monthly = round2(price * (1 - tier / 100));
      options.push({
        id: `mensal-${tier}`,
        label: `Mensal com ${tier}% por tempo limitado, preço travado enquanto a assinatura durar`,
        price_brl: monthly,
        equivalent_monthly_brl: monthly,
        discount_pct: tier,
        why: tier >= 35 ? "um desconto fundo pede uma razão escrita (data, vagas) e um fim: sem isso ensina a esperar a próxima." : "o preço travado é o que faz a pessoa entrar agora em vez de esperar.",
      });
    }
  } else if (price !== null && billing === "anual") {
    options.push({ id: "anual-atual", label: "Anual no preço atual, com um bônus de implantação", price_brl: annual ?? price, equivalent_monthly_brl: round2((annual ?? price) / 12), discount_pct: 0, why: "o plano anual já concentra a receita; o bônus substitui o desconto." });
    for (const tier of TIERS) options.push({ id: `anual-${tier}`, label: `Anual com ${tier}% por tempo limitado`, price_brl: round2((annual ?? price) * (1 - tier / 100)), equivalent_monthly_brl: round2(((annual ?? price) * (1 - tier / 100)) / 12), discount_pct: tier, why: "com data de fim escrita." });
  } else if (price !== null) {
    for (const tier of TIERS) options.push({ id: `unico-${tier}`, label: `${tier}% por tempo limitado`, price_brl: round2(price * (1 - tier / 100)), equivalent_monthly_brl: null, discount_pct: tier, why: "com data de fim escrita." });
  } else {
    warnings.push({ code: "no_price", text: "Sem o preço, o plano não monta as opções de oferta." });
  }

  const never = [
    { id: "vitalicio", text: "Plano vitalício: corta a receita recorrente e lota o suporte." },
    { id: "so-primeiro-mes", text: "Desconto só no primeiro mês: atrai quem cancela no segundo." },
    { id: "cupom-empilhado", text: "Cupom sobre preço de campanha: o preço de referência deixa de ser verdadeiro." },
  ];

  // --- collision with the promotion that is running now
  let collision = null;
  if (current.until && targetDate) {
    const gap = daysBetween(current.until, targetDate);
    const currentDiscount = price !== null && typeof current.price_brl === "number" && price > 0 ? round2(((price - current.price_brl) / price) * 100) : null;
    if (gap < 0) {
      collision = { kind: "sobreposicao", gap_days: gap, text: `A promoção de agora termina depois da data alvo (${current.until}): as duas ofertas se sobrepõem, e a do pico precisa ser melhor ou diferente, nunca igual com outro nome.` };
    } else if (gap < 30) {
      collision = {
        kind: "colisao",
        gap_days: gap,
        current_discount_pct: currentDiscount,
        text: `A promoção de agora termina ${gap} dias antes da data alvo. Se a oferta do pico for mais funda, quem comprou agora paga mais do que quem esperou ${gap} dias, e quem está em dúvida aprende a esperar. Saídas: a oferta de agora vira o acesso antecipado à do pico, com o mesmo preço e um bônus a mais; ou a do pico muda de forma (anual, bônus) em vez de baixar mais o preço.`,
      };
    }
    if (collision) warnings.push({ code: collision.kind, text: collision.text });
  }

  // --- the lines an offer sold online carries (consumer code); the member confirms each
  const note = String(current.note ?? "").toLowerCase();
  const checks = [
    { id: "preco_referencia", status: "pendente", text: "O preço de referência (o 'de') é o preço de tabela praticado, não um preço inflado para a promoção." },
    { id: "prazo_escrito", status: "pendente", text: "O prazo da oferta está escrito na página e no anúncio, com data e hora." },
    { id: "regras_escritas", status: "pendente", text: "As regras estão escritas: quem pode, quantas vagas, o que acontece na renovação." },
    { id: "arrependimento_7_dias", status: "pendente", text: "A compra à distância tem 7 dias de arrependimento com devolução do valor; dizer isso antes vira argumento." },
    { id: "cliente_antigo", status: "pendente", text: "Quem já é cliente nunca paga mais do que quem entra agora: há uma condição para ele." },
    { id: "sem_vitalicio", status: /vital[ií]c/.test(note) ? "atencao" : "ok", text: never[0].text },
    { id: "sem_so_primeiro_mes", status: /primeiro m[eê]s/.test(note) ? "atencao" : "ok", text: never[1].text },
  ];

  const say = options.length
    ? `${options.length} formas de oferta a partir de ${brl(price)}${billing === "mensal" ? " por mês" : ""}, do bônus sem desconto ao desconto de ${pct(TIERS[TIERS.length - 1])}; ${collision ? "há uma colisão com a promoção de agora; " : ""}${checks.filter((check) => check.status === "pendente").length} linhas do código do consumidor para você confirmar.`
    : "Sem o preço, não há opções de oferta para mostrar.";

  return { version: 1, price_brl: price, billing, options, never, collision, checks, warnings, say };
}
