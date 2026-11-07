// The audit: reads the page anatomy captured by the Video engine (captura.json, video-render 1.1.0 or newer)
// and the facts the member declared (pagina.json), and answers each check of the page type with
// ok, atencao or nao_conferido. What the capture did not bring is never a failure.

import { clip, fold, parsePrice, samePrice } from "./util.mjs";

const edge = (body) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, "iu");

export const DECLINE = edge("n[ãa]o,? obrigad[oa]|pular(?: (?:a )?oferta)?|agora n[ãa]o|dispensar|continuar sem|recusar|talvez depois|no thanks|skip|not now|maybe later");
export const SHAMING = edge("prefiro (?:pagar|perder|continuar|ficar)|n[ãa]o quero (?:economizar|ganhar|crescer|melhorar|vender|lucrar|resultados?)|n[ãa]o me importo|gosto de (?:perder|pagar)|i (?:don'?t|do not) want to (?:save|grow|win)|i prefer to pay");
export const ACCEPT = edge("adicionar|adicione|quero|comprar|compre|assinar|assine|garantir|garanta|pagar|aceitar|aceito|levar|confirmar|confirme|incluir|sim|add|buy|subscribe|upgrade|claim|yes");
export const PAY = edge("pagar|finalizar|concluir (?:a )?(?:compra|pedido)|comprar agora|confirmar (?:a )?(?:compra|pagamento|pedido)|place order|pay|checkout|complete (?:order|purchase)");
export const GUARANTEE = edge("garantia|reembolso|devolu[çc][ãa]o|arrependimento|cancele (?:quando|a qualquer)|cancelamento|money.?back|refund|guarantee");
export const CHARGE = edge("mesmo (?:m[ée]todo|meio|cart[ãa]o)|ser[áa] cobrad[oa]|sem formul[áa]rios?|sem (?:outra|segunda) finaliza[çc][ãa]o|same payment|one.?click|no forms?");
export const RENEWAL = edge("renova[çc][ãa]o|renova|renovar|por m[êe]s|ao m[êe]s|mensal|por ano|ao ano|anual|per month|monthly|per year|yearly|renews?");
export const TESTIMONIAL = edge("depoimentos?|avalia[çc](?:[ãa]o|[õo]es)|o que (?:dizem|nossos clientes)|quem (?:j[áa] )?usa|n[ãa]o acredite|hist[óo]rias de|clientes dizem|reviews?|testimonials?");
export const PRIVACY = edge("pol[íi]tica de privacidade|privacidade|privacy");
export const TERMS = edge("termos(?: de (?:uso|servi[çc]os?))?|condi[çc][õo]es de uso|terms");
export const WITHDRAWAL = edge("arrependimento|reembolso|devolu[çc][ãa]o|cancelamento|cancelar|cancele|refund|withdrawal");
export const THANKS_CONFIRM = edge("pedido (?:confirmado|recebido|conclu[íi]do|aprovado)|compra (?:confirmada|aprovada|conclu[íi]da|realizada)|obrigad[oa] pela (?:compra|confian[çc]a)|order (?:confirmed|complete)|thank you for your (?:order|purchase)");
export const THANKS_NEXT = edge("e-?mail|acess[ae]|acesso|pr[óo]ximo passo|comece|come[çc]ar|entrar|painel|baixar|download|get started|log ?in");
export const THANKS_HELP = edge("suporte|ajuda|contato|fale (?:com|conosco)|whatsapp|atendimento|support|help|contact");
const PRICE_IN_TEXT = /R\$\s?\d|\d+,\d{2}(?!\d)/;

const STATUS_ORDER = { atencao: 0, nao_conferido: 1, ok: 2 };

export function pageText(anatomy) {
  return (anatomy?.sections ?? []).map((s) => [s.heading?.text, s.text].filter(Boolean).join("\n")).join("\n\n");
}

function sectionText(anatomy, index) {
  const section = Number.isInteger(index) ? anatomy?.sections?.[index] : null;
  return section ? `${section.heading?.text ?? ""}\n${section.text ?? ""}` : "";
}

/** A link that only scrolls inside the same page (#oferta) does not compete with the offer. */
export function isAnchorOnly(href, pageUrl = null) {
  if (typeof href !== "string" || !href) return false;
  if (href.startsWith("#")) return true;
  if (!pageUrl) return false;
  try {
    const target = new URL(href, pageUrl);
    const page = new URL(pageUrl);
    return Boolean(target.hash) && target.origin === page.origin && target.pathname === page.pathname && target.search === page.search;
  } catch {
    return false;
  }
}

/** The page's main call to action: the declared text when there is one, else the first accept-like button. */
export function mainCta(anatomy, facts, pageUrl = null) {
  const all = anatomy?.ctas ?? [];
  const candidates = all.filter((c) => !c.in_fixed && !DECLINE.test(c.text ?? "") && !isAnchorOnly(c.href, pageUrl));
  if (facts?.cta_text) {
    const wanted = fold(facts.cta_text);
    const hit = candidates.find((c) => fold(c.text).includes(wanted)) ?? all.find((c) => fold(c.text).includes(wanted));
    if (hit) return hit;
  }
  const accepting = candidates.filter((c) => ACCEPT.test(c.text ?? ""));
  const pool = accepting.length ? accepting : candidates;
  return pool.slice().sort((a, b) => (a.y ?? 0) - (b.y ?? 0))[0] ?? null;
}

const RULES = {
  cta_first_screen({ anatomy, facts, pageUrl }) {
    const cta = mainCta(anatomy, facts, pageUrl);
    if (!cta) return ["atencao", "Não achei o botão principal da oferta. Registre o texto do botão em pagina.json (cta_text)."];
    const mobile = cta.above_fold?.mobile;
    if (mobile === true) return ["ok", `"${clip(cta.text, 60)}" aparece na primeira tela do celular.`];
    if (mobile === false) return ["atencao", `"${clip(cta.text, 60)}" só aparece depois de rolar a tela do celular.`];
    return ["nao_conferido", `A leitura do celular não achou "${clip(cta.text, 60)}".`];
  },

  single_offer({ anatomy, facts, pageUrl }) {
    const main = mainCta(anatomy, facts, pageUrl);
    const others = new Map();
    for (const c of anatomy.ctas ?? []) {
      const text = (c.text ?? "").trim();
      if (!text || DECLINE.test(text) || isAnchorOnly(c.href, pageUrl) || !ACCEPT.test(text)) continue;
      if (main && fold(text) === fold(main.text)) continue;
      others.set(fold(text), text);
    }
    if (!others.size) return ["ok", "Só uma ação de compra na página."];
    return ["atencao", `Outras ações de compra competem com a oferta: ${[...others.values()].slice(0, 4).map((t) => `"${clip(t, 40)}"`).join(", ")}.`];
  },

  decline_visible({ anatomy, facts }) {
    const wanted = facts?.decline_text ? fold(facts.decline_text) : null;
    const decline = (anatomy.ctas ?? []).find((c) => DECLINE.test(c.text ?? "") || (wanted && fold(c.text).includes(wanted)));
    if (decline) return ["ok", `A recusa aparece: "${clip(decline.text, 50)}".`];
    return ["atencao", "Não achei um link para recusar a oferta."];
  },

  decline_honest({ anatomy, facts }) {
    const wanted = facts?.decline_text ? fold(facts.decline_text) : null;
    const decline = (anatomy.ctas ?? []).find((c) => DECLINE.test(c.text ?? "") || SHAMING.test(c.text ?? "") || (wanted && fold(c.text).includes(wanted)));
    if (!decline) return null;
    if (SHAMING.test(decline.text ?? "")) return ["atencao", `A recusa constrange: "${clip(decline.text, 60)}".`];
    return ["ok", `A recusa usa palavras neutras: "${clip(decline.text, 50)}".`];
  },

  price_shown({ anatomy, facts }) {
    const wanted = parsePrice(facts?.offer?.price);
    if (wanted === null) return ["nao_conferido", "O preço da oferta não está em pagina.json (offer.price)."];
    const found = (anatomy.prices ?? []).some((p) => !p.struck && samePrice(p.value, wanted));
    if (found) return ["ok", `${facts.offer.price} aparece na página.`];
    return ["atencao", `Não achei ${facts.offer.price} no texto da página. Se o preço está dividido em partes no código, confira à mão.`];
  },

  reference_price_true({ anatomy, facts }) {
    const struck = (anatomy.prices ?? []).filter((p) => p.struck && typeof p.value === "number");
    if (!struck.length) return null;
    const reference = parsePrice(facts?.offer?.reference_price);
    const shown = struck.map((p) => clip(p.text, 30)).join(", ");
    if (reference === null) return ["atencao", `A página mostra ${shown} riscado, e o preço de referência não está em pagina.json. Confirme que é o preço praticado de verdade.`];
    if (struck.some((p) => samePrice(p.value, reference))) return ["ok", `O preço riscado (${shown}) bate com o preço de referência registrado.`];
    return ["atencao", `O preço riscado da página (${shown}) não bate com o registrado (${facts.offer.reference_price}).`];
  },

  renewal_shown({ anatomy, facts }) {
    if (!facts?.offer?.recurrence) return null;
    const text = pageText(anatomy);
    const renewal = parsePrice(facts.offer.renewal_price);
    const word = RENEWAL.test(text);
    const value = renewal === null || (anatomy.prices ?? []).some((p) => samePrice(p.value, renewal));
    if (word && value) return ["ok", "A página diz a renovação e a periodicidade."];
    if (!word) return ["atencao", "A página não diz como a assinatura se renova."];
    return ["atencao", `A página fala da renovação, mas não mostra o valor dela (${facts.offer.renewal_price}).`];
  },

  guarantee_near_cta({ anatomy, facts, pageUrl }) {
    const anywhere = GUARANTEE.test(pageText(anatomy));
    const days = facts?.offer?.guarantee_days;
    if (!anywhere && !days) return null;
    const cta = mainCta(anatomy, facts, pageUrl);
    if (cta && GUARANTEE.test(sectionText(anatomy, cta.section))) return ["ok", "A garantia aparece na mesma seção do botão."];
    if (anywhere) return ["atencao", "A garantia aparece na página, mas longe do botão principal."];
    return ["atencao", `A garantia de ${days} dias não aparece na página.`];
  },

  charge_clear({ anatomy, facts, pageUrl }) {
    const oneClick = facts?.payment?.one_click;
    if (oneClick === false) return null;
    if (oneClick !== true) return ["nao_conferido", "Registre em pagina.json se o aceite cobra com um clique (payment.one_click)."];
    const cta = mainCta(anatomy, facts, pageUrl);
    if (!cta) return ["atencao", "Não achei o botão principal para conferir o aviso de cobrança."];
    const around = `${cta.text ?? ""}\n${sectionText(anatomy, cta.section)}`;
    const price = parsePrice(facts?.offer?.price);
    const priceNear = price !== null && (anatomy.prices ?? []).some((p) => !p.struck && samePrice(p.value, price) && p.section === cta.section);
    if (CHARGE.test(around) || priceNear) return ["ok", "Perto do botão a página diz o valor ou que o aceite usa o pagamento do pedido."];
    return ["atencao", "Perto do botão não há aviso de que o aceite cobra no meio de pagamento do pedido."];
  },

  sticky_cta_long_page({ anatomy, context }) {
    const { mobileFullHeight: full, mobileViewportHeight: screen } = context;
    if (!full || !screen) return ["nao_conferido", "A captura não trouxe a altura da página no celular."];
    if (full < screen * 3) return null;
    const bars = (anatomy.fixed ?? []).filter((f) => (f.ctas ?? []).length > 0);
    const mobile = bars.filter((f) => f.pass === "mobile");
    if (mobile.length) {
      const bar = mobile[0];
      return ["ok", `Há uma barra fixa com "${clip(bar.ctas[0], 40)}"${bar.appeared_after_scroll ? ", que aparece depois de rolar" : ""}.`];
    }
    // A saved page runs no script: a bar that a script shows on scroll does not exist in it.
    if (context.savedPage) return ["nao_conferido", "Na página salva, a barra que aparece ao rolar não existe: confira no navegador se ela aparece no celular."];
    if (bars.length) return ["atencao", "A barra fixa com o botão aparece no computador, mas não no celular."];
    return ["atencao", "A página é longa no celular e não tem barra fixa com o botão."];
  },

  proof_about_offer({ anatomy, facts }) {
    const sections = (anatomy.sections ?? []).filter((s) => TESTIMONIAL.test(`${s.heading?.text ?? ""}\n${String(s.text ?? "").slice(0, 400)}`));
    if (!sections.length) return null;
    const name = facts?.product?.name;
    if (!name) return ["nao_conferido", "Registre o nome do produto oferecido em pagina.json (product.name) para conferir os depoimentos."];
    if (sections.some((s) => fold(s.text).includes(fold(name)))) return ["ok", "Os depoimentos citam o produto oferecido."];
    return ["atencao", `A seção de depoimentos não cita ${name}: confira se eles falam do produto da oferta.`];
  },

  countdown_real({ anatomy, facts, context }) {
    const countdowns = anatomy.countdowns ?? [];
    if (!countdowns.length && context.savedPage) return ["nao_conferido", "Na página salva, um contador não corre: confira no navegador se a página tem contador e se o prazo é real."];
    if (!countdowns.length) return null;
    const deadline = facts?.offer?.deadline;
    if (deadline) return ["ok", `Há um contador, e o prazo registrado é ${deadline}. Confirme que ele termina nessa hora e não recomeça ao recarregar.`];
    return ["atencao", `Há um contador na página (${clip(countdowns[0].text, 30)}) e nenhum prazo registrado em pagina.json (offer.deadline).`];
  },

  no_prechecked({ anatomy }) {
    const checked = (anatomy.forms ?? []).filter((f) => f.type === "checkbox" && f.checked);
    const paid = checked.filter((f) => f.price_text || PRICE_IN_TEXT.test(f.label ?? ""));
    if (paid.length) return ["atencao", `A caixa "${clip(paid[0].label, 80)}" já vem marcada.`];
    return ["ok", checked.length ? "Nenhuma caixa com preço vem marcada." : "Nenhuma caixa vem marcada."];
  },

  bump_near_pay({ anatomy, facts }) {
    const bump = (anatomy.forms ?? []).find((f) => f.type === "checkbox" && (f.price_text || PRICE_IN_TEXT.test(f.label ?? "")));
    if (!bump) return ["atencao", "Não achei a caixa do order bump, uma caixa com preço, na página."];
    const wanted = facts?.cta_text ? fold(facts.cta_text) : null;
    const pay = (anatomy.ctas ?? [])
      .filter((c) => PAY.test(c.text ?? "") || (wanted && fold(c.text).includes(wanted)))
      .sort((a, b) => (a.y ?? 0) - (b.y ?? 0))[0];
    if (!pay) return ["nao_conferido", "Não achei o botão de pagar para comparar a posição da caixa."];
    if (typeof bump.y !== "number" || typeof pay.y !== "number") return ["nao_conferido", "A captura não trouxe a posição da caixa."];
    const gap = pay.y - bump.y;
    if (gap > 0 && gap <= 900) return ["ok", "A caixa fica logo acima do botão de pagar."];
    if (gap <= 0) return ["atencao", "A caixa fica abaixo do botão de pagar."];
    return ["atencao", "A caixa fica longe do botão de pagar."];
  },

  video_autoplay_ok({ anatomy }) {
    const autoplay = (anatomy.media?.videos ?? []).filter((v) => v.autoplay);
    if (!autoplay.length) return null;
    for (const video of autoplay) {
      const missing = [];
      if (!video.muted) missing.push("muted");
      if (!video.playsinline) missing.push("playsinline");
      if (!video.poster) missing.push("capa");
      if (missing.length) return ["atencao", `Um vídeo que começa sozinho está sem ${missing.join(", ")}.`];
    }
    return ["ok", autoplay.length === 1 ? "O vídeo que começa sozinho está sem som, com playsinline e capa." : `Os ${autoplay.length} vídeos que começam sozinhos estão sem som, com playsinline e capa.`];
  },

  reduced_motion({ anatomy }) {
    const moving = (anatomy.motion?.running?.length ?? 0) > 0 || (anatomy.media?.videos ?? []).some((v) => v.autoplay);
    if (!moving) return null;
    if ((anatomy.motion?.reduced_motion_rules ?? 0) > 0) return ["ok", "A página tem a regra de menos movimento."];
    if ((anatomy.motion?.stylesheets_unread ?? 0) > 0) return ["nao_conferido", "Há animação ou vídeo automático, e parte do CSS não pôde ser lida para achar a regra de menos movimento."];
    return ["atencao", "Há animação ou vídeo automático e nenhuma regra de menos movimento."];
  },

  legal_lines({ anatomy }) {
    const text = `${pageText(anatomy)}\n${(anatomy.ctas ?? []).map((c) => c.text).join("\n")}`;
    const missing = [];
    if (!PRIVACY.test(text)) missing.push("a política de privacidade");
    if (!TERMS.test(text)) missing.push("os termos");
    if (!WITHDRAWAL.test(text)) missing.push("o caminho do arrependimento ou do reembolso");
    if (!missing.length) return ["ok", "Política de privacidade, termos e arrependimento aparecem na página."];
    return ["atencao", `Não achei na página: ${missing.join(", ")}.`];
  },

  thank_you_basics({ anatomy }) {
    const text = pageText(anatomy);
    const missing = [];
    if (!THANKS_CONFIRM.test(text)) missing.push("a confirmação do pedido");
    if (!THANKS_NEXT.test(text)) missing.push("o próximo passo");
    if (!THANKS_HELP.test(text)) missing.push("onde pedir ajuda");
    if (!missing.length) return ["ok", "A página confirma o pedido, diz o próximo passo e onde pedir ajuda."];
    return ["atencao", `Falta na página: ${missing.join(", ")}.`];
  },

  images_alt({ anatomy }) {
    const count = anatomy.media?.images?.without_alt;
    if (typeof count !== "number") return ["nao_conferido", "A captura não trouxe a contagem das imagens."];
    if (count === 0) return ["ok", "Todas as imagens têm texto alternativo."];
    return ["atencao", count === 1 ? "Uma imagem está sem texto alternativo." : `${count} imagens estão sem texto alternativo.`];
  },
};

export const RULE_IDS = Object.keys(RULES);

/**
 * Evaluates the checks of one page type. `capture` is captura.json; `facts` is pagina.json;
 * `definitions` is references/checks.json. Returns the items, the summary and the lines to say.
 */
export function audit({ type, capture, facts, definitions }) {
  const anatomy = capture?.anatomy ?? null;
  const weights = definitions.weights ?? [];
  const context = {
    mobileFullHeight: capture?.viewports?.mobile?.full_height ?? null,
    mobileViewportHeight: capture?.viewports?.mobile?.height ?? anatomy?.viewports?.mobile?.height ?? null,
    savedPage: capture?.input_kind === "mhtml",
  };
  const pageUrl = capture?.final_url ?? capture?.url ?? null;
  const items = [];
  for (const id of type.checks) {
    const definition = definitions.checks[id];
    const rule = RULES[id];
    if (!definition || !rule) continue;
    let outcome;
    if (!anatomy) outcome = ["nao_conferido", "A captura não trouxe a leitura completa da página: ela vem no Motor de vídeo 1.1.0 ou mais novo."];
    else outcome = rule({ anatomy, facts: facts ?? {}, context, pageUrl });
    if (!outcome) continue;
    const [status, detail] = outcome;
    items.push({ id, label: definition.label, weight: definition.weight, status, detail, fix: status === "ok" ? null : definition.fix });
  }
  items.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || weights.indexOf(a.weight) - weights.indexOf(b.weight));
  const summary = { ok: 0, atencao: 0, nao_conferido: 0 };
  for (const item of items) summary[item.status] += 1;
  const say = items
    .filter((item) => item.status !== "ok")
    .map((item) => (item.status === "atencao" ? `${item.label}: ${item.detail} ${item.fix}` : `${item.label}, não conferido: ${item.detail}`));
  return { anatomy: Boolean(anatomy), items, summary, say };
}
