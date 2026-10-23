// What the served HTML of a page carries: the Meta Pixel, GA4 and gtag, the Tag Manager, the
// Google Ads tag, TikTok, LinkedIn and a cookie notice. "Present in the HTML" is all this can
// say: whether a tag fires, and with which event, only the platform's own test tool shows.

const TAGS = [
  { id: "meta_pixel", label: "Pixel da Meta", patterns: [/connect\.facebook\.net\/[a-z_A-Z]+\/fbevents\.js/, /\bfbq\s*\(\s*['"]init['"]/], idPattern: /fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{6,20})['"]/g },
  { id: "ga4", label: "Google Analytics 4", patterns: [/googletagmanager\.com\/gtag\/js\?id=G-[A-Z0-9]+/, /gtag\s*\(\s*['"]config['"]\s*,\s*['"]G-[A-Z0-9]+['"]/], idPattern: /\b(G-[A-Z0-9]{4,14})\b/g },
  { id: "gtag", label: "gtag (a biblioteca do Google)", patterns: [/googletagmanager\.com\/gtag\/js/, /\bfunction\s+gtag\s*\(/, /\bgtag\s*\(/] },
  { id: "gtm", label: "Google Tag Manager", patterns: [/googletagmanager\.com\/gtm\.js/, /googletagmanager\.com\/ns\.html\?id=GTM-[A-Z0-9]+/], idPattern: /\b(GTM-[A-Z0-9]{4,10})\b/g },
  { id: "google_ads", label: "Tag do Google Ads", patterns: [/\bAW-\d{6,12}\b/], idPattern: /\b(AW-\d{6,12})\b/g },
  { id: "tiktok", label: "Pixel do TikTok", patterns: [/analytics\.tiktok\.com\/i18n\/pixel/, /\bttq\.load\s*\(/] },
  { id: "linkedin", label: "Insight Tag do LinkedIn", patterns: [/snap\.licdn\.com\/li\.lms-analytics/, /_linkedin_partner_id/] },
];

const COOKIE_NOTICE = [/cookieconsent/i, /onetrust/i, /cookiebot/i, /iubenda/i, /consentmanager/i, /axeptio/i, /termly/i, /aceitar (todos os )?cookies/i, /pol[ií]tica de cookies/i, /aviso de cookies/i, /accept (all )?cookies/i, /cookie (banner|notice|consent)/i, /usamos cookies/i, /we use cookies/i];
const CONSENT_GATE = [/consent\s*mode/i, /gtag\s*\(\s*['"]consent['"]/i, /ad_storage/i, /analytics_storage/i, /data-cookieconsent\s*=\s*["']/i, /type\s*=\s*["']text\/plain["'][^>]*data-(cookiecategory|cookieconsent|category)/i];

function stripNoise(html) {
  // Comments can carry a tag that is not live; keep them apart.
  return String(html ?? "").replace(/<!--[\s\S]*?-->/g, "");
}

/** Detects the tags in a served HTML. Returns one entry per tag with present/absent and ids. */
export function detectTags(html) {
  const text = stripNoise(html);
  const tags = TAGS.map((tag) => {
    const present = tag.patterns.some((pattern) => pattern.test(text));
    const ids = tag.idPattern ? [...new Set([...text.matchAll(tag.idPattern)].map((match) => match[1]))] : [];
    return { id: tag.id, label: tag.label, status: present ? "present" : "absent", ids: present ? ids : [] };
  });
  const cookieNotice = COOKIE_NOTICE.some((pattern) => pattern.test(text));
  const consentGate = CONSENT_GATE.some((pattern) => pattern.test(text));
  const anyPresent = tags.some((tag) => tag.status === "present");
  const notes = ["O resultado diz o que está no HTML servido. Se a tag dispara, e com qual evento, só o teste da própria plataforma mostra (Gerenciador de Eventos da Meta, DebugView do GA4, Tag Assistant do Google)."];
  if (cookieNotice && consentGate) notes.push("A página tem aviso de cookies e condiciona as tags ao aceite: antes do aceite, as tags não disparam, e parte das visitas fica fora da medição.");
  else if (cookieNotice && !anyPresent) notes.push("A página tem aviso de cookies e nenhuma tag no HTML: as tags podem ser injetadas só depois do aceite. Confira com o teste da plataforma depois de aceitar.");
  else if (cookieNotice) notes.push("A página tem aviso de cookies. Confira se as tags respeitam o aceite; se não respeitam, o aviso é só um texto.");
  const summary = tags.filter((tag) => tag.status === "present").map((tag) => tag.label);
  return {
    tags,
    cookie_notice: cookieNotice ? "present" : "absent",
    consent_gate: consentGate ? "present" : "absent",
    notes,
    say: summary.length ? `No HTML servido: ${summary.join(", ")}${cookieNotice ? ", com aviso de cookies" : ""}. Se cada uma dispara, o teste da plataforma diz.` : `Nenhuma tag no HTML servido${cookieNotice ? ", mas há aviso de cookies: elas podem entrar depois do aceite" : ""}. Sem Pixel e sem GA4, nenhum anúncio é medido.`,
  };
}

/** Fetches the public HTML of a page, with a deadline. Only GET, only http(s), no credentials. */
export async function fetchHtml(url, { timeoutMs = 20000 } = {}) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw Object.assign(new Error(`Endereço inválido: ${url}.`), { code: "usage" });
  }
  if (!/^https?:$/.test(parsed.protocol)) throw Object.assign(new Error("Só páginas http ou https."), { code: "usage" });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(parsed.toString(), { redirect: "follow", signal: controller.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; flyee-ads-insights/1.0)", accept: "text/html,application/xhtml+xml" } });
    if (!response.ok) throw Object.assign(new Error(`A página respondeu ${response.status}.`), { code: "page_unreachable", status: response.status });
    const type = response.headers.get("content-type") ?? "";
    if (!/html|xml|text/i.test(type)) throw Object.assign(new Error(`A resposta não é uma página (${type || "sem tipo"}).`), { code: "page_unreachable" });
    return { html: await response.text(), final_url: response.url, status: response.status };
  } catch (error) {
    if (error.code) throw error;
    throw Object.assign(new Error(error.name === "AbortError" ? "A página não respondeu em 20 segundos." : `Não deu para abrir a página: ${error.cause?.code ?? error.message}.`), { code: "page_unreachable" });
  } finally {
    clearTimeout(timer);
  }
}
