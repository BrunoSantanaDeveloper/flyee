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

// What the page states as a fact: usage numbers, ratings, scarcity and founding years. A price, a date,
// a discount or a plan's limit ("10.000 créditos por mês", "Você + 9 usuários") has its own check or is
// the product itself. Each claim must have an origin in pagina.json (claims).
const SCALE = String.raw`(?:\s?(?:mi|mil|milh[õo]es|bi|bilh[õo]es|k|M)(?![\p{L}\p{N}]))?`;
const BIG = String.raw`(?:\d{1,3}(?:\.\d{3})+|\d{3,}|\d{1,3}(?:,\d{1,2})?\s?(?:mi|mil|milh[õo]es|bi|bilh[õo]es)(?![\p{L}\p{N}]))`;
const PEOPLE = String.raw`(?:clientes|usu[áa]rios|escrit[óo]rios|empresas|pessoas|alunos|advogad[oa]s|lojas|neg[óo]cios|profissionais|downloads|avalia[çc][õo]es|instala[çc][õo]es|customers|users|companies|teams|businesses)`;
// `offer` says where to look for the words of an offer condition: "near" is the line and the ones
// around it (a badge breaks "40%" and "OFF no PIX" over two lines), "line" is the line alone.
const CLAIM_PATTERNS = [
  // "+1.500" and "1.500+": the plus written against the number says "more than". With a space, it adds.
  { re: new RegExp(String.raw`(?<![\d.,\p{L}])\+\d[\d.,]*${SCALE}`, "gu"), offer: "line" },
  { re: new RegExp(String.raw`(?<![\d.,])\d[\d.,]*${SCALE}\+`, "gu"), offer: "line" },
  { re: new RegExp(String.raw`(?<![\p{L}\p{N}])(?:mais de|over|more than)\s+\d[\d.,]*${SCALE}`, "giu"), offer: "line" },
  // Percentages under 100: "100%" is an intensifier ("100% online"), not a measurement.
  { re: /(?<![\d.,/])\d{1,2}(?:[.,]\d{1,3})?\s?%/gu, offer: "near" },
  { re: /(?<![\p{L}\d.,])\d{1,3}(?:,\d)?\s?x(?![\p{L}\d])/giu, offer: "near" },
  // A big number of people or businesses, unless it is a plan's limit ("até 1.000 clientes").
  { re: new RegExp(String.raw`(?<![\d.,/])${BIG}\s+${PEOPLE}(?![\p{L}])`, "giu"), limit: true },
  { re: /(?<![\d.,])\d,\d\s?(?:\/\s?5|de 5|estrelas|stars)/giu },
  { re: /(?<![\p{L}\p{N}])(?:[úu]ltimas? (?:vagas?|unidades?)|vagas limitadas|(?:s[óo]|apenas|restam?) \d+ (?:vagas?|unidades?|lugares?|hor[áa]rios?)|\d+ pessoas? (?:vendo|comprando|online)|only \d+ left|\d+ people (?:viewing|watching))(?![\p{L}\p{N}])/giu },
  { re: /(?<![\p{L}\p{N}])(?:desde|since|fundad[ao] em|estd\.?)\s+(?:19|20)\d{2}(?!\d)/giu },
];
/** A percentage or a multiple in these words, on its line or the next one, is a condition of the offer: `discount_math` and the plans read those. */
const CLAIM_NOT = /desconto|off(?![\p{L}])|economi|juros|parcel|cart[ãa]o|pix|sem custo|por cento do|imposto|taxa de|anual|mensal|no plano|na assinatura|primeiro (?:m[êe]s|ano)/iu;
const LIMIT_BEFORE = /(?:at[ée]|up to|limite de|m[áa]ximo de)\s*$/iu;
/** Lines the page must not read claims from: an address, a registration number or a telephone. */
const CLAIM_LINE_NOT = /cnpj|cep|cpf|telefone|whatsapp|\(\d{2}\)|\+\d{2}\s?\(?\d{2}\)?\s?\d{4,5}/iu;

const PLACEHOLDER = edge("lorem ipsum|dolor sit amet|john doe|jane doe|jane smith|fulano de tal|ciclano|beltrano|acme(?: inc| corp)?|empresa x|seu nome aqui|your name here|exemplo@|@example\\.com|example\\.com|placeholder");
const FILLER_VERBS = edge("revolucione|revolucionar|eleve|elevate|turbine|turbinar|potencialize|potencializar|desbloqueie|desbloquear|unleash|supercharge|seamless|empower|next-?gen|game-?changing|(?:leve|levar) (?:\\p{L}+ )?ao pr[óo]ximo n[íi]vel|sem esfor[çc]o");
const SECTION_NUMBER = /^[ \t]*0\d{1,2}[ \t]*(?:[/·.:][ \t]*)?\p{L}/mu;
const SCROLL_CUE = /^[ \t]*(?:role(?: para (?:baixo|ver|continuar))?|deslize(?: para (?:baixo|ver))?|scroll(?: down| to explore)?)[ \t]*$/imu;
const MONO_SHARE = 0.25;
const NO_MEASURE = "A captura não trouxe esta medição: atualize o Motor de vídeo e rode audit de novo.";
/** A title that opens with the shelf the product sits on, and never speaks to whoever arrived. Runs on folded text. */
const CATEGORY_TITLE = /^(?:(?:a|o|uma|um) )?(?:melhor )?(?:automacao|automacoes|gestao|plataforma|sistema|software|solucao|solucoes|ferramenta|ferramentas|tecnologia|inteligencia|servico|servicos|consultoria|assessoria|aplicativo)(?![a-z])/;
const READER_WORD = /(?<![a-z])(?:voce|voces|seu|sua|seus|suas)(?![a-z])/;
// Measured on the Juridiq and JuriChat pages and on a page people found hard to read (2026-11-08): among
// cards that are neither a quote, a question nor a plan, the models stop at 25 and 31 words to read, and at
// no hole in a tall card; the hard page reached 55 and 40 words, and holes of 46% and 31%.
const CARD_READ_WORDS = 32;
const CARD_HOLE = 0.3;
const CARD_TALL_PX = 200;
const CARD_HAS_PICTURE = 0.3;
const FIGURE_SENTENCE_WORDS = 15;
const FIGURE_READ_WORDS = 30;
const GENERIC_FONT = /^(?:system-ui|ui-sans-serif|ui-serif|ui-monospace|sans-serif|serif|monospace|arial|helvetica|times new roman|-apple-system|blinkmacsystemfont|segoe ui|roboto)$/i;

const kb = (bytes) => `${Math.round((bytes ?? 0) / 1024)} KB`;
const quoted = (list, size = 40) => list.map((text) => `"${clip(text, size)}"`).join(", ");
const percent = (share) => `${Math.round(share * 100)}%`;

/** The numbers, scarcity and years the page states, each once, with the line it came from. */
export function findClaims(text) {
  const found = new Map();
  const lines = String(text ?? "").split("\n");
  lines.forEach((line, index) => {
    if (CLAIM_LINE_NOT.test(line)) return;
    // One claim per stretch of text: "+10.000 clientes" is "+10.000", not that and "10.000 clientes".
    const taken = [];
    for (const { re, limit, offer } of CLAIM_PATTERNS) {
      for (const match of line.matchAll(re)) {
        const start = match.index;
        const end = start + match[0].length;
        if (taken.some(([from, to]) => start < to && end > from)) continue;
        const before = line.slice(0, start);
        if (/R\$\s*$/.test(before)) continue;
        const around = line.slice(Math.max(0, start - 30), end + 30);
        if (offer === "line" && CLAIM_NOT.test(around)) continue;
        if (offer === "near" && CLAIM_NOT.test(`${lines[index - 1] ?? ""} ${around} ${lines[index + 1] ?? ""}`)) continue;
        if (limit && LIMIT_BEFORE.test(before)) continue;
        taken.push([start, end]);
        const claim = match[0].trim();
        // "0+" is a counter read before its animation, which numbers_not_zero already points at.
        if (/^\+?0+\s?\+?$/.test(claim)) continue;
        if (!found.has(fold(claim))) found.set(fold(claim), claim);
      }
    }
  });
  return [...found.values()];
}

/** Whether a stated claim is among the ones pagina.json gives an origin for. */
export function claimHasOrigin(claim, claims) {
  const wanted = fold(claim).replace(/\s+/g, "");
  return (Array.isArray(claims) ? claims : []).some((entry) => String(entry?.origin ?? "").trim() && fold(entry?.text ?? "").replace(/\s+/g, "").includes(wanted));
}

function rgbFromHex(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex ?? "").trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

/** White, black and grays go with any brand: only a color with a hue can be off it. */
function isNeutral(rgb) {
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  return max - min <= 24 || max <= 30 || min >= 240;
}

const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= 40;

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

  title_promises({ anatomy }) {
    const h1 = (anatomy.sections ?? []).find((s) => s.heading?.tag === "h1");
    if (!h1) return ["nao_conferido", "A página não tem um título principal marcado para ler."];
    const title = fold(h1.heading.text);
    if (CATEGORY_TITLE.test(title) && !READER_WORD.test(title)) return ["atencao", `"${clip(h1.heading.text, 90)}" abre com o nome da categoria e não fala com quem chegou.`];
    return ["ok", "O título não abre com o nome da categoria. Leia em voz alta: só um ouvido diz se alguém falaria assim."];
  },

  figures_seen({ anatomy, facts }) {
    const figures = anatomy.quality?.desktop?.figures;
    if (!Array.isArray(figures)) return ["nao_conferido", NO_MEASURE];
    const planned = (Array.isArray(facts?.figures) ? facts.figures : []).map((figure) => figure?.name).filter(Boolean);
    if (!planned.length && !figures.length) return ["nao_conferido", "Registre em pagina.json (figures) o objeto que cada seção mostra, e marque cada figura com data-figura."];
    const problems = [];
    const marked = new Set(figures.map((figure) => figure.name));
    const absent = planned.filter((name) => !marked.has(name));
    if (absent.length) problems.push(`o plano traz ${quoted(absent.slice(0, 4))}, e a página não marca ${absent.length === 1 ? "essa figura" : "essas figuras"} com data-figura`);
    const reading = figures.filter((figure) => figure.longest > FIGURE_SENTENCE_WORDS || figure.read_words > FIGURE_READ_WORDS).sort((a, b) => b.read_words - a.read_words);
    if (reading.length) problems.push(`a figura "${clip(reading[0].name ?? "sem nome", 30)}" pede a leitura de ${reading[0].read_words} palavras, com uma frase de ${reading[0].longest}${reading.length > 1 ? `, e mais ${reading.length - 1} também pede${reading.length > 2 ? "m" : ""} leitura` : ""}`);
    if (problems.length) return ["atencao", `${problems.join("; ")}.`];
    return ["ok", "Nenhuma figura pede leitura longa. Abra a página sem letras: só o olho diz se cada uma ainda é um objeto."];
  },

  cards_short({ anatomy }) {
    const cards = anatomy.quality?.desktop?.cards;
    if (!Array.isArray(cards)) return ["nao_conferido", NO_MEASURE];
    const plain = cards.filter((card) => card.kind === "card");
    if (!plain.length) return null;
    const long = plain.filter((card) => card.read_words > CARD_READ_WORDS && (card.picture_share ?? 0) < CARD_HAS_PICTURE).sort((a, b) => b.read_words - a.read_words);
    if (!long.length) return ["ok", `Os ${plain.length} cartões pedem até ${CARD_READ_WORDS} palavras de leitura.`];
    return ["atencao", `O cartão "${clip(long[0].text, 50)}" pede a leitura de ${long[0].read_words} palavras${long.length > 1 ? `, e mais ${long.length - 1} passa${long.length > 2 ? "m" : ""} de ${CARD_READ_WORDS}` : ""}.`];
  },

  cards_no_holes({ anatomy }) {
    const cards = anatomy.quality?.desktop?.cards;
    if (!Array.isArray(cards)) return ["nao_conferido", NO_MEASURE];
    const plain = cards.filter((card) => card.kind === "card");
    if (!plain.length) return null;
    const holes = plain.filter((card) => card.height >= CARD_TALL_PX && card.hole >= CARD_HOLE && (card.picture_share ?? 0) < CARD_HAS_PICTURE).sort((a, b) => b.hole - a.hole);
    if (!holes.length) return ["ok", "Nenhum cartão alto tem um buraco no meio."];
    return ["atencao", `O cartão "${clip(holes[0].text, 50)}" tem ${percent(holes[0].hole)} da altura vazia${holes.length > 1 ? `, e mais ${holes.length - 1} também tem um buraco` : ""}.`];
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

  // ----- what the page states, and what the finished page measures -----

  claims_have_origin({ text, facts }) {
    const stated = findClaims(text);
    if (!stated.length) return null;
    const open = stated.filter((claim) => !claimHasOrigin(claim, facts?.claims));
    if (!open.length) return ["ok", stated.length === 1 ? "O número da página tem a origem registrada." : `Os ${stated.length} números e urgências da página têm a origem registrada.`];
    return ["atencao", `Sem origem registrada em pagina.json: ${quoted(open.slice(0, 6), 30)}${open.length > 6 ? ` e mais ${open.length - 6}` : ""}.`];
  },

  placeholder_data({ text, facts }) {
    const match = PLACEHOLDER.exec(text);
    if (!match) return ["ok", "Nenhum dado de exemplo esquecido no texto da página."];
    if (facts?.product?.name && fold(facts.product.name).includes(fold(match[0]))) return ["ok", "Nenhum dado de exemplo esquecido no texto da página."];
    return ["atencao", `A página traz "${clip(match[0], 30)}", que parece dado de exemplo esquecido.`];
  },

  demo_honest({ anatomy, facts }) {
    const demo = facts?.demo ?? {};
    const demos = anatomy.quality?.desktop?.demos;
    if (!Array.isArray(demos)) return demo.kind ? ["nao_conferido", NO_MEASURE] : null;
    if (!demos.length) return demo.kind ? ["atencao", "O plano registra uma demonstração, e nenhum elemento da página está marcado com data-demo."] : null;
    const problems = [];
    if (demos.some((scene) => scene.headings > 0)) problems.push("há título (h1 a h6) dentro da cena, e ele entra no sumário da página");
    if (demos.some((scene) => !scene.has_name)) problems.push("a cena não tem um texto alternativo");
    if (demo.sample_data === true && demos.some((scene) => !scene.label_near)) problems.push("os dados são de exemplo, e não há etiqueta perto da cena");
    if (demo.sample_data !== true && demo.sample_data !== false) problems.push("pagina.json não diz se os dados da cena são inventados (demo.sample_data)");
    if (problems.length) return ["atencao", `${problems.join("; ")}.`];
    return ["ok", demo.sample_data ? "A cena está marcada, com texto alternativo e a etiqueta de exemplo." : "A cena está marcada e com texto alternativo."];
  },

  demo_film({ facts, film, context }) {
    const demo = facts?.demo ?? {};
    if (!demo.kind && !demo.selector) return null;
    if (!demo.selector) return ["nao_conferido", "A cena não foi filmada: registre o seletor dela em pagina.json (demo.selector)."];
    if (context.savedPage) return ["nao_conferido", "Numa página salva, a cena não roda: filme o endereço da página."];
    if (!film?.passes) return ["nao_conferido", film?.error ?? "A cena não foi filmada nesta conferência."];
    const { desktop, mobile, reduced } = film.passes;
    const problems = [];
    if (mobile && !mobile.visible) problems.push("a cena não aparece no celular");
    if (desktop && !desktop.visible) problems.push("a cena não aparece no computador");
    if (reduced?.visible && reduced.changes > 0) problems.push("com o pedido de menos movimento, a cena continua se mexendo");
    if (demo.animated !== false && desktop?.visible && desktop.changes === 0) problems.push(`a cena não se mexeu nos ${desktop.frames} quadros filmados`);
    if (problems.length) return ["atencao", `${problems.join("; ")}.`];
    return ["ok", "A cena foi filmada no computador e no celular, e fica parada com menos movimento. Abra as folhas de quadros para ler o resto."];
  },

  ai_defaults({ anatomy, facts, text }) {
    const defaults = anatomy.quality?.desktop?.defaults;
    if (!defaults) return ["nao_conferido", NO_MEASURE];
    const chosen = new Set((Array.isArray(facts?.visual?.chosen) ? facts.visual.chosen : []).map((name) => String(name).trim()));
    const counts = defaults.counts ?? {};
    const found = defaults.found ?? {};
    const infinite = (anatomy.motion?.running ?? []).filter((animation) => animation.iterations === "infinite").length;
    const filler = FILLER_VERBS.exec(text);
    const seen = [
      ["texto_degrade", "título com degradê", counts.gradient_text, found.gradient_text],
      ["vidro", "painel de vidro", counts.glass, found.glass],
      ["brilho", "brilho colorido", counts.glow, found.glow],
      ["mancha_desfocada", "mancha desfocada", counts.blobs, null],
      ["tres_cartoes_iguais", "três cartões iguais", counts.equal_cards, found.equal_cards],
      ["ponto_de_status", "ponto de status", counts.status_dots, found.status_dots],
      ["movimento_sem_fim", "animação sem fim", infinite - (counts.status_dots ?? 0), null],
      ["tudo_mono", "letra monoespaçada fora de código", (defaults.mono_share ?? 0) >= MONO_SHARE ? 1 : 0, null],
      ["numero_na_secao", "número antes do título da seção", SECTION_NUMBER.test(text) ? 1 : 0, [SECTION_NUMBER.exec(text)?.[0]?.trim()].filter(Boolean)],
      ["aviso_de_rolagem", "aviso de rolagem", SCROLL_CUE.test(text) ? 1 : 0, null],
      ["verbos_de_enchimento", "verbo de enchimento", filler ? 1 : 0, filler ? [filler[0]] : null],
    ].filter(([name, , count]) => count > 0 && !chosen.has(name));
    if (!seen.length) return ["ok", chosen.size ? "Só aparecem os padrões escolhidos de propósito." : "Nenhum vício visível na página pronta."];
    const list = seen.map(([name, label, , examples]) => `${label} (${name})${examples?.length ? `: "${clip(examples[0], 40)}"` : ""}`);
    return ["atencao", `Apareceram, sem estarem escolhidos: ${list.join("; ")}.`];
  },

  cta_consistent({ anatomy, pageUrl }) {
    const priced = new Set((anatomy.prices ?? []).map((price) => price.section).filter(Number.isInteger));
    const labels = new Map();
    for (const cta of anatomy.ctas ?? []) {
      const label = String(cta.text ?? "").trim();
      if (!label || cta.in_fixed && MENU.test(label)) continue;
      if (MENU.test(label) || DECLINE.test(label) || DOCS.test(label) || priced.has(cta.section) || !(ACCEPT.test(label) || LEAD.test(label))) continue;
      if (isAnchorOnly(cta.href, pageUrl) && labels.has(fold(label))) continue;
      labels.set(fold(label), label);
    }
    if (labels.size <= 2) return ["ok", labels.size ? `Os chamados da página têm ${labels.size === 1 ? "um texto" : "dois textos"}.` : "A página não tem chamados com o mesmo pedido."];
    return ["atencao", `A página pede a mesma coisa com ${labels.size} textos: ${quoted([...labels.values()].slice(0, 5))}.`];
  },

  off_brand({ capture, facts }) {
    const colors = (Array.isArray(facts?.brand?.colors) ? facts.brand.colors : []).map(rgbFromHex).filter(Boolean);
    const fonts = (Array.isArray(facts?.brand?.fonts) ? facts.brand.fonts : []).map((font) => fold(font)).filter(Boolean);
    if (!colors.length && !fonts.length) return ["nao_conferido", "Registre as cores e as letras da marca em pagina.json (brand)."];
    const page = capture?.brand;
    if (!page) return ["nao_conferido", NO_MEASURE];
    const problems = [];
    if (colors.length) {
      const painted = (page.colors?.palette ?? []).filter((entry) => (entry.share ?? 0) >= 0.03).map((entry) => entry.hex);
      const used = [...new Set([page.colors?.primary, ...painted].filter(Boolean))];
      const off = used.filter((hex) => {
        const rgb = rgbFromHex(hex);
        return rgb && !isNeutral(rgb) && !colors.some((color) => near(rgb, color));
      });
      if (off.length) problems.push(`as cores ${off.slice(0, 4).join(", ")} não estão na marca`);
    }
    if (fonts.length) {
      const used = [...new Set([page.fonts?.headline, page.fonts?.body].filter(Boolean))];
      const off = used.filter((font) => !GENERIC_FONT.test(String(font).trim()) && !fonts.some((known) => fold(font).includes(known) || known.includes(fold(font))));
      if (off.length) problems.push(`a letra ${off.join(", ")} não está na marca`);
    }
    if (problems.length) return ["atencao", `Na página, ${problems.join(" e ")}.`];
    return ["ok", "As cores com matiz e as letras da página estão na marca."];
  },

  mobile_fits({ anatomy }) {
    const overflow = anatomy.quality?.mobile?.overflow;
    if (!overflow) return ["nao_conferido", NO_MEASURE];
    const width = overflow.viewport_width;
    const first = overflow.offenders?.[0];
    if (overflow.cut > 0 && first) return ["atencao", `No celular, "${clip(first.text || first.tag, 50)}" vai até ${first.right} px numa tela de ${width} px${overflow.cut > 1 ? `, e mais ${overflow.cut - 1} elementos passam da largura` : ""}.`];
    if (overflow.scroll_width > width + 1 || overflow.inner_width > width + 1) return ["atencao", `No celular, a página tem ${Math.max(overflow.scroll_width, overflow.inner_width)} px de largura numa tela de ${width} px e rola de lado.`];
    return ["ok", "Nada passa da largura do celular."];
  },

  text_legible({ anatomy }) {
    const small = anatomy.quality?.mobile?.small_text;
    if (!small) return ["nao_conferido", NO_MEASURE];
    if (!small.total_chars) return ["nao_conferido", "A leitura do celular não achou texto para medir."];
    if (small.key?.length) return ["atencao", `No celular, "${clip(small.key[0].text, 50)}" aparece com ${small.key[0].px} px: preço ou botão abaixo de 12 px.`];
    if ((small.share ?? 0) >= 0.4) return ["atencao", `No celular, ${percent(small.share)} do texto fica abaixo de 12 px, como "${clip(small.samples?.[0]?.text, 50)}".`];
    return ["ok", small.small_chars ? `No celular, ${percent(small.share)} do texto fica abaixo de 12 px, e nenhum preço ou botão.` : "No celular, todo o texto tem 12 px ou mais."];
  },

  tap_targets({ anatomy }) {
    const targets = anatomy.quality?.mobile?.tap_targets;
    if (!targets) return ["nao_conferido", NO_MEASURE];
    if (!targets.undersized) return ["ok", `Os ${targets.checked} alvos de toque têm ao menos 24 px, ou espaço em volta.`];
    const first = targets.samples?.[0];
    const named = first?.text ? `"${clip(first.text, 40)}"` : "um botão sem nome, que o leitor de tela também não anuncia";
    return ["atencao", `${targets.undersized === 1 ? "Um alvo de toque tem" : `${targets.undersized} alvos de toque têm`} menos de 24 px e fica${targets.undersized === 1 ? "" : "m"} perto de outro, como ${named} (${first?.width} por ${first?.height} px).`];
  },

  contrast_ok({ anatomy }) {
    const contrast = anatomy.quality?.desktop?.contrast;
    if (!contrast) return ["nao_conferido", NO_MEASURE];
    const unknown = Object.values(contrast.unknown ?? {}).reduce((sum, count) => sum + count, 0);
    if (!contrast.checked) return ["nao_conferido", "Nenhum par de texto e fundo pôde ser medido: confira nas fotos."];
    const first = contrast.failing?.[0];
    if (first) return ["atencao", `"${clip(first.text, 50)}" tem contraste de ${String(first.ratio).replace(".", ",")} para 1 (${first.color} sobre ${first.background}), e o mínimo é ${String(first.required).replace(".", ",")} para 1${contrast.failing.length > 1 ? `. Mais ${contrast.failing.length - 1} pares ficam abaixo` : ""}.`];
    return ["ok", `Os ${contrast.checked} pares de texto e fundo medidos passam${unknown ? `. ${unknown} ficaram de fora por estarem sobre imagem ou degradê: olhe nas fotos` : ""}.`];
  },

  controls_fit({ anatomy }) {
    const desktop = anatomy.quality?.desktop?.controls;
    const mobile = anatomy.quality?.mobile?.controls;
    if (!desktop && !mobile) return ["nao_conferido", NO_MEASURE];
    const words = { cortado: "é cortado", vaza: "passa do botão", colado: "encosta num lado do botão" };
    const seen = new Map();
    for (const [where, read] of [["no celular", mobile], ["no computador", desktop]]) {
      for (const problem of read?.problems ?? []) if (!seen.has(problem.text)) seen.set(problem.text, { ...problem, where });
    }
    if (!seen.size) return ["ok", "O texto cabe em todos os botões, no computador e no celular."];
    const first = [...seen.values()][0];
    return ["atencao", `O texto "${clip(first.text, 40)}" ${words[first.reason] ?? "não cabe"} ${first.where}${seen.size > 1 ? `, e mais ${seen.size - 1} botões têm o mesmo problema` : ""}.`];
  },

  images_light({ anatomy }) {
    const images = anatomy.quality?.mobile?.images;
    if (!images) return ["nao_conferido", NO_MEASURE];
    if (!images.count) return null;
    const name = (src) => clip(String(src ?? "").split(/[?#]/)[0].split("/").pop() || "uma imagem", 40);
    if (images.heavy?.length) return ["atencao", `No celular, ${name(images.heavy[0].src)} pesa ${kb(images.heavy[0].bytes)}${images.heavy.length > 1 ? `, e mais ${images.heavy.length - 1} imagens passam de 500 KB` : ""}.`];
    if (images.oversized?.length) return ["atencao", `No celular, ${name(images.oversized[0].src)} tem ${images.oversized[0].natural_width} px e aparece com ${images.oversized[0].shown_width} px${images.oversized.length > 1 ? `, e mais ${images.oversized.length - 1} imagens vêm maiores do que aparecem` : ""}.`];
    return ["ok", "As imagens vêm no tamanho em que aparecem e pesam menos de 500 KB."];
  },
};

export const RULE_IDS = Object.keys(RULES);

/**
 * Evaluates the checks of one page type. `capture` is captura.json; `facts` is pagina.json;
 * `definitions` is references/checks.json; `text` is texto.md of the capture (the whole page text,
 * footer included), else the text of the anatomy's sections is used; `film` is filme.json of the
 * Video engine, when the scene was filmed. Returns the items, the summary and the lines to say.
 */
export function audit({ type, capture, facts, definitions, text = null, film = null }) {
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
    else outcome = rule({ anatomy, capture, facts: facts ?? {}, context, pageUrl, text: fullText, film });
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
