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

// Pages that sell a demonstration, a trial or a plan (landing, planos, api): their main call to action
// asks for the next step, so these words count as accepting there.
export const LEAD = edge("agend(?:ar|e)|test(?:ar|e)|experiment(?:ar|e)|come[çc](?:ar|e)|cri(?:ar|e) (?:a |minha |sua )?conta|cadastr(?:ar|e)|inscrev(?:er|a)|baix(?:ar|e)|fal(?:ar|e) com|solicit(?:ar|e)|inici(?:ar|e)|ativ(?:ar|e)|contrat(?:ar|e)|book|try|start|sign ?up|get started|request");
const MENU = /^(?:(?:abrir|fechar|open|close|toggle)\s+)?(?:o\s+)?(?:menu|navega[çc][ãa]o|navigation)$|^(?:fechar|close|×)$/iu;
export const CLOSE = edge("fechar|close|sair|voltar|dispensar");
export const PROMO = edge("\\d{1,2}\\s?% ?(?:off|de desconto)|black ?friday|promo[çc][ãa]o|oferta (?:especial|rel[âa]mpago|por tempo limitado)|cupom|desconto exclusivo");
export const VALIDITY = edge("(?:v[áa]lid[ao]s?|vale|termina|encerra|acaba|at[ée])\\s+(?:at[ée]\\s+)?(?:o dia\\s+|dia\\s+)?\\d{1,2}(?:\\/\\d{1,2}|\\s+de\\s+(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))");
export const TRIAL = edge("test(?:e|ar) (?:gr[áa]tis|gratuitamente|gratuito|sem custo|sem pagar)|per[íi]odo (?:de teste|gratuito)|comece gr[áa]tis|gr[áa]tis por \\d{1,3} dias|free trial|try (?:it )?(?:for )?free");
const TRIAL_DAYS = /(\d{1,3})\s+dias?\s+(?:gr[áa]tis|de teste|gratuitos?|sem custo|free)|(?:test[ea]\p{L}*|gr[áa]tis|gratuit\p{L}*|trial)[^.\n]{0,40}?(?:por|durante|de|for)\s+(\d{1,3})\s+(?:dias?|days?)/iu;
export const CANCEL = edge("cancel(?:e|ar|amento)|fidelidade|fideliza[çc][ãa]o|sem multa|multa de cancelamento|cancel(?:lation)?|no (?:commitment|contract)");
const SAVING = edge("economi[zs]e|economia de|voc[êe] economiza|poupe|save");
const PERCENT_OFF = /(\d{1,2})\s?%\s?(?:off|de desconto|desconto)/i;
const MONTHLY_AVERAGE = /m[ée]dia mensal|por m[êe]s no (?:plano )?anual|\/\s?m[êe]s,? cobrado anualmente/i;
const ANNUAL = /\/\s?ano|por ano|ao ano|anual|no ano(?!\p{L})/iu;
const CNPJ = /CNPJ[:\s]*\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|(?<!\d)\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}(?!\d)|CPF[:\s]*\d{3}\.?\d{3}\.?\d{3}-?\d{2}/i;
const ADDRESS = edge("rua|avenida|av\\.?|alameda|travessa|rodovia|pra[çc]a|estrada|largo|quadra|setor|cep");
const CONTACT = edge("contato|fale conosco|central de ajuda|suporte|atendimento|whatsapp|e-?mail|sac|contact|support");
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
export const RECOMMENDED = edge("recomendado|mais popular|mais escolhido|mais vendido|melhor escolha|mais assinado|favorito|most popular|recommended|best value");
const DOCS = edge("documenta[çc][ãa]o|docs|refer[êe]ncia da api|api reference|documentation");
const CODE_SAMPLE = /\bcurl\s+(?:-\w+\s+)*["']?https?:|fetch\(\s*["'`]https?:|requests\.(?:get|post)\(|Authorization:?\s*["'`]?Bearer|\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/[\w{}/.-]+/;
const RATE_LIMIT = /\d[\d.,]*\s*(?:mil\s+)?(?:requisi[çc][õo]es|chamadas|requests|req)\s*(?:\/|por|per|a cada)\s*(?:segundo|minuto|min|hora|dia|m[êe]s|second|minute|hour|day|month|s|m|h)(?!\p{L})|limite de \d|rate limit(?: de| of)? \d/iu;
const ZERO_COUNTER = /(?:^|\n)[ \t]*0 ?(?:\+|h|k|x|mil\+?)[ \t]*(?=\n|$)/;
const POSITION_BAND = 24;

const brl = (value) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

/**
 * The page's main call to action: the declared text when there is one, else the first accept-like
 * button. In "lead" mode (a sales page, a plans page, an API page) a button that asks for the next
 * step, like scheduling a demonstration or starting a trial, counts as accepting. Buttons side by
 * side share a band: the first of them is the main one, preferring one the phone also shows.
 */
export function mainCta(anatomy, facts, pageUrl = null, mode = "accept") {
  const all = anatomy?.ctas ?? [];
  const candidates = all.filter((c) => !c.in_fixed && !DECLINE.test(c.text ?? "") && !isAnchorOnly(c.href, pageUrl));
  if (facts?.cta_text) {
    const wanted = fold(facts.cta_text);
    const hit = candidates.find((c) => fold(c.text).includes(wanted)) ?? all.find((c) => fold(c.text).includes(wanted));
    if (hit) return hit;
  }
  const wants = (text) => ACCEPT.test(text ?? "") || (mode === "lead" && LEAD.test(text ?? ""));
  const accepting = candidates.filter((c) => wants(c.text));
  const pool = accepting.length ? accepting : candidates;
  const band = (c) => Math.floor((c.y ?? 0) / POSITION_BAND);
  const unseen = (c) => (c.above_fold?.mobile === null || c.above_fold?.mobile === undefined ? 1 : 0);
  return pool.slice().sort((a, b) => band(a) - band(b) || unseen(a) - unseen(b) || (a.index ?? 0) - (b.index ?? 0))[0] ?? null;
}

/** The windows that cover most of the screen and carry a call to action (a promotion, a coupon). */
function overlays(anatomy, context) {
  return (anatomy.fixed ?? []).filter((f) => {
    if (f.edge !== "other" || !(f.ctas ?? []).length) return false;
    const screen = f.pass === "mobile" ? context.mobileViewportHeight : context.desktopViewportHeight;
    return !screen || (f.height ?? 0) >= screen * 0.6;
  });
}

/** The prices of one plan card: from its struck price to the next one, in page order. */
function cardOf(prices, index) {
  let start = index;
  while (start > 0 && !prices[start].struck) start -= 1;
  let end = index + 1;
  while (end < prices.length && !prices[end].struck) end += 1;
  return prices.slice(start, end);
}

const RULES = {
  cta_first_screen({ anatomy, facts, pageUrl, context }) {
    const cta = mainCta(anatomy, facts, pageUrl, context.mode);
    if (!cta) return ["atencao", "Não achei o botão principal da oferta. Registre o texto do botão em pagina.json (cta_text)."];
    const mobile = cta.above_fold?.mobile;
    if (mobile === true) return ["ok", `"${clip(cta.text, 60)}" aparece na primeira tela do celular.`];
    if (mobile === false) return ["atencao", `"${clip(cta.text, 60)}" só aparece depois de rolar a tela do celular.`];
    return ["nao_conferido", `A leitura do celular não achou "${clip(cta.text, 60)}".`];
  },

  single_offer({ anatomy, facts, pageUrl, context }) {
    const main = mainCta(anatomy, facts, pageUrl, context.mode);
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

  guarantee_near_cta({ anatomy, facts, pageUrl, context }) {
    const anywhere = GUARANTEE.test(pageText(anatomy));
    const days = facts?.offer?.guarantee_days;
    if (!anywhere && !days) return null;
    const cta = mainCta(anatomy, facts, pageUrl, context.mode);
    if (cta && GUARANTEE.test(sectionText(anatomy, cta.section))) return ["ok", "A garantia aparece na mesma seção do botão."];
    if (anywhere) return ["atencao", "A garantia aparece na página, mas longe do botão principal."];
    return ["atencao", `A garantia de ${days} dias não aparece na página.`];
  },

  charge_clear({ anatomy, facts, pageUrl, context }) {
    const oneClick = facts?.payment?.one_click;
    if (oneClick === false) return null;
    if (oneClick !== true) return ["nao_conferido", "Registre em pagina.json se o aceite cobra com um clique (payment.one_click)."];
    const cta = mainCta(anatomy, facts, pageUrl, context.mode);
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
    // A bar holds a call to action at an edge of the screen: a menu button alone, or a window that
    // covers the screen, is not one.
    const actions = (f) => (f.ctas ?? []).filter((t) => !MENU.test(String(t).trim()));
    const bars = (anatomy.fixed ?? []).filter((f) => f.edge !== "other" && actions(f).length > 0);
    const mobile = bars.filter((f) => f.pass === "mobile").sort((a, b) => (a.edge === "bottom" ? 0 : 1) - (b.edge === "bottom" ? 0 : 1));
    if (mobile.length) {
      const bar = mobile[0];
      return ["ok", `Há uma barra fixa com "${clip(actions(bar)[0], 40)}"${bar.appeared_after_scroll ? ", que aparece depois de rolar" : ""}.`];
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

  // ----- pages that sell a product, a plan or an API (1.1.0) -----

  h1_present({ anatomy }) {
    const h1 = (anatomy.sections ?? []).find((s) => s.heading?.tag === "h1");
    if (h1) return ["ok", `O título principal está marcado: "${clip(h1.heading.text, 70)}".`];
    return ["atencao", "A página não tem um título principal marcado como h1."];
  },

  numbers_not_zero({ text }) {
    const match = ZERO_COUNTER.exec(text);
    if (!match) return null;
    const label = text.slice(match.index + match[0].length).split("\n").find((line) => line.trim()) ?? "";
    return ["atencao", `Um número aparece como "${match[0].trim()}" na leitura da página${label ? ` (${clip(label, 50)})` : ""}. É a contagem animada antes de começar, e é o que leem o buscador e quem usa leitor de tela.`];
  },

  trial_terms({ text, facts }) {
    if (!TRIAL.test(text)) return null;
    const match = TRIAL_DAYS.exec(text);
    const days = match ? Number(match[1] ?? match[2]) : null;
    const declared = Number(facts?.offer?.trial_days) || null;
    if (declared && days !== null && declared !== days) return ["atencao", `A página fala em ${days} dias de teste, e pagina.json registra ${declared}.`];
    if (days !== null) return ["ok", `O teste grátis diz quanto dura: ${days} dias.`];
    return ["atencao", "A página oferece teste grátis e não diz quantos dias ele dura."];
  },

  promo_terms_shown({ anatomy, text }) {
    const promo = (anatomy.countdowns ?? []).length > 0 || PROMO.test(text);
    if (!promo) return null;
    const validity = VALIDITY.exec(text);
    if (validity) return ["ok", `A promoção diz até quando vale: "${clip(validity[0], 40)}".`];
    return ["atencao", "A página anuncia uma promoção ou um contador e não escreve a data em que a oferta termina."];
  },

  discount_math({ anatomy }) {
    const prices = (anatomy.prices ?? []).filter((p) => typeof p.value === "number");
    if (!prices.some((p) => p.struck)) return null;
    const problems = [];
    let checked = 0;
    prices.forEach((price, index) => {
      if (price.struck) return;
      // A plan card: the struck price and what follows it in the same section (a comparison table
      // further down repeats the prices, and is not part of the last card).
      const sameSection = (other) => !Number.isInteger(price.section) || other.section === price.section;
      const card = cardOf(prices, index).filter(sameSection);
      const reference = card[0]?.struck ? card[0] : null;
      if (!reference) return;
      const context = String(price.context ?? "");
      const others = card.filter((other) => !other.struck && other !== price);
      if (SAVING.test(context)) {
        const paid = others.filter((other) => prices.indexOf(other) < index);
        if (!paid.length) return;
        checked += 1;
        if (!paid.some((other) => samePrice(reference.value - other.value, price.value))) problems.push(`a economia de ${clip(price.text, 20)} não é a diferença entre ${clip(reference.text, 20)} e nenhum preço do mesmo plano`);
        return;
      }
      const percent = PERCENT_OFF.exec(context);
      if (percent) {
        checked += 1;
        const expected = reference.value * (1 - Number(percent[1]) / 100);
        if (Math.abs(expected - price.value) > Math.max(0.05, reference.value * 0.006)) problems.push(`${percent[1]}% de desconto sobre ${clip(reference.text, 20)} dá ${brl(expected)}, e a página mostra ${clip(price.text, 20)}`);
        return;
      }
      if (MONTHLY_AVERAGE.test(context)) {
        const yearly = others.filter((other) => ANNUAL.test(String(other.context ?? "")) && !SAVING.test(String(other.context ?? "")));
        if (!yearly.length) return;
        checked += 1;
        if (!yearly.some((other) => Math.abs(other.value / 12 - price.value) < 0.006)) problems.push(`a média mensal de ${clip(price.text, 20)} não é nenhum preço anual do mesmo plano dividido por 12`);
      }
    });
    if (!checked) return null;
    if (!problems.length) return ["ok", checked === 1 ? "A conta do desconto bate com o preço riscado." : `As ${checked} contas de desconto, economia e média mensal batem com os preços da página.`];
    return ["atencao", `A conta não bate: ${problems[0]}.`];
  },

  popup_dismissable({ anatomy, context }) {
    const windows = overlays(anatomy, context);
    if (!windows.length) return null;
    const stuck = windows.find((w) => !(w.ctas ?? []).some((t) => DECLINE.test(t) || CLOSE.test(t)));
    if (stuck) return ["atencao", `A janela "${clip(stuck.text, 60)}" não tem um botão de fechar ou de recusar com nome.`];
    const exit = windows[0].ctas.find((t) => DECLINE.test(t) || CLOSE.test(t));
    return ["ok", `A janela tem uma saída visível: "${clip(exit, 30)}".`];
  },

  popup_on_arrival({ anatomy, context }) {
    const windows = overlays(anatomy, context);
    if (!windows.length) return null;
    const early = windows.filter((w) => w.appeared_after_scroll === false);
    if (early.length) return ["atencao", `A janela "${clip(early[0].text, 50)}" cobre a página ${early[0].pass === "mobile" ? "no celular" : "no computador"} logo na chegada, antes de a pessoa rolar.`];
    return ["ok", "A janela só aparece depois que a pessoa rola a página."];
  },

  supplier_identified({ text }) {
    const missing = [];
    if (!CNPJ.test(text)) missing.push("o CNPJ ou o CPF de quem vende");
    if (!ADDRESS.test(text)) missing.push("o endereço físico");
    if (!EMAIL.test(text) && !CONTACT.test(text)) missing.push("um e-mail ou canal de contato");
    if (!missing.length) return ["ok", "A página diz quem vende: CNPJ, endereço e contato."];
    return ["atencao", `Não achei na página: ${missing.join(", ")}.`];
  },

  cancel_terms_shown({ anatomy, text }) {
    if (!(anatomy.prices ?? []).some((p) => !p.struck)) return null;
    if (CANCEL.test(text)) return ["ok", "A página diz como cancelar ou se há fidelidade."];
    return ["atencao", "A página mostra preços e não diz como cancelar nem se há fidelidade ou multa."];
  },

  plan_highlighted({ anatomy }) {
    const prices = (anatomy.prices ?? []).filter((p) => !p.struck && Number.isInteger(p.section));
    if (prices.length < 2) return null;
    const near = new Set(prices.flatMap((p) => [p.section, p.section - 1]));
    const text = (anatomy.sections ?? []).filter((s) => near.has(s.index)).map((s) => `${s.heading?.text ?? ""}\n${s.text ?? ""}`).join("\n");
    const badge = RECOMMENDED.exec(text);
    if (badge) return ["ok", `Um plano aparece em destaque ("${clip(badge[0], 30)}").`];
    return ["atencao", "Nenhum plano aparece em destaque, como recomendado ou mais escolhido."];
  },

  prices_first_screen({ anatomy, context }) {
    const first = (anatomy.prices ?? []).filter((p) => !p.struck && typeof p.y === "number").sort((a, b) => a.y - b.y)[0];
    const screen = context.desktopViewportHeight;
    if (!first) return ["atencao", "Não achei nenhum preço em reais na página."];
    if (!screen) return ["nao_conferido", "A captura não trouxe a altura da tela do computador."];
    if (first.y < screen) return ["ok", `O primeiro preço (${clip(first.text, 20)}) aparece na primeira tela do computador.`];
    return ["atencao", `O primeiro preço (${clip(first.text, 20)}) só aparece depois de rolar, a ${Math.round(first.y)} px do topo.`];
  },

  docs_first_screen({ anatomy }) {
    const docs = (anatomy.ctas ?? []).filter((c) => DOCS.test(c.text ?? ""));
    if (!docs.length) return ["atencao", "Não achei um chamado para a documentação."];
    const seen = docs.find((c) => c.above_fold?.desktop || c.above_fold?.mobile);
    if (seen) return ["ok", `"${clip(seen.text, 40)}" aparece na primeira tela.`];
    return ["atencao", `"${clip(docs[0].text, 40)}" só aparece depois de rolar.`];
  },

  code_sample({ text }) {
    if (CODE_SAMPLE.test(text)) return ["ok", "A página mostra um exemplo de chamada."];
    return ["atencao", "A página não mostra um exemplo de chamada, como um curl com a autenticação."];
  },

  rate_limits_shown({ text }) {
    if (RATE_LIMIT.test(text)) return ["ok", "Os limites de uso aparecem em número."];
    return ["atencao", "Os limites de uso não aparecem em número, como requisições por minuto ou por mês."];
  },
};

export const RULE_IDS = Object.keys(RULES);

/**
 * Evaluates the checks of one page type. `capture` is captura.json; `facts` is pagina.json;
 * `definitions` is references/checks.json; `text` is texto.md of the capture (the whole page text,
 * footer included), else the text of the anatomy's sections is used. Returns the items, the
 * summary and the lines to say.
 */
export function audit({ type, capture, facts, definitions, text = null }) {
  const anatomy = capture?.anatomy ?? null;
  const weights = definitions.weights ?? [];
  const context = {
    mobileFullHeight: capture?.viewports?.mobile?.full_height ?? null,
    mobileViewportHeight: capture?.viewports?.mobile?.height ?? anatomy?.viewports?.mobile?.height ?? null,
    desktopViewportHeight: capture?.viewports?.desktop?.height ?? anatomy?.viewports?.desktop?.height ?? null,
    savedPage: capture?.input_kind === "mhtml",
    mode: type.cta === "lead" ? "lead" : "accept",
  };
  const pageUrl = capture?.final_url ?? capture?.url ?? null;
  const fullText = typeof text === "string" && text.trim() ? text : pageText(anatomy);
  const items = [];
  for (const id of type.checks) {
    const definition = definitions.checks[id];
    const rule = RULES[id];
    if (!definition || !rule) continue;
    let outcome;
    if (!anatomy) outcome = ["nao_conferido", "A captura não trouxe a leitura completa da página: ela vem no Motor de vídeo 1.1.0 ou mais novo."];
    else outcome = rule({ anatomy, facts: facts ?? {}, context, pageUrl, text: fullText });
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
