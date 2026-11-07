// O tema do painel a partir de escolhas.json: as variáveis de cor do Chatwoot (claro e escuro), regras para
// as classes com o azul fixo, a fonte, o que esconder e os links soltos. Sai o HTML que vai para
// DASHBOARD_SCRIPTS, as variáveis da marca para o apply-config.rb e um resumo para as conferências.

import { buildScale, parseHex } from "./color.mjs";
import { AppError, sha256 } from "./util.mjs";

const PSEUDO = {
  hover: ":hover",
  focus: ":focus",
  "focus-visible": ":focus-visible",
  "focus-within": ":focus-within",
  active: ":active",
  checked: ":checked",
  indeterminate: ":indeterminate",
  enabled: ":enabled",
  disabled: ":disabled",
};
const PSEUDO_ELEMENT = { before: "::before", after: "::after" };
const GROUP = { "group-hover": ":hover", "group-focus-within": ":focus-within", "group-focus": ":focus" };
const PROSE = { "prose-a": " a", "prose-strong": " strong" };

const POSITIONS = {
  "superior-direita": ["top", "right"],
  "superior-esquerda": ["top", "left"],
  "inferior-direita": ["bottom", "right"],
  "inferior-esquerda": ["bottom", "left"],
};

export function escapeClass(name) {
  return name.replace(/([:/.[\]&>()#%,!])/g, "\\$1");
}

function declaration(utility, alpha) {
  const color = (opacityVar) => `rgb(var(--blue-9) / ${alpha ?? `var(${opacityVar}, 1)`})`;
  switch (utility) {
    case "bg":
      return `background-color: ${color("--tw-bg-opacity")} !important;`;
    case "text":
      return `color: ${color("--tw-text-opacity")} !important;`;
    case "border":
      return `border-color: ${color("--tw-border-opacity")} !important;`;
    case "border-t":
      return `border-top-color: ${color("--tw-border-opacity")} !important;`;
    case "outline":
      return `outline-color: ${color("--tw-outline-opacity")} !important;`;
    case "ring":
      return `--tw-ring-color: ${color("--tw-ring-opacity")} !important;`;
    case "from":
      return `--tw-gradient-from: rgb(var(--blue-9) / ${alpha ?? 1}) var(--tw-gradient-from-position) !important; --tw-gradient-to: rgb(var(--blue-9) / 0) var(--tw-gradient-to-position) !important; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important;`;
    default:
      return null;
  }
}

/** A regra CSS de uma classe do Tailwind com n-brand, ou null quando a variante não é conhecida. */
export function brandRule(token) {
  const parts = token.split(":");
  const utilityPart = parts.pop();
  const match = /^(bg|text|border-t|border|outline|ring|from)-n-brand(?:\/(\d{1,3}))?$/.exec(utilityPart);
  if (!match) return null;
  const alpha = match[2] === undefined ? null : String(Number(match[2]) / 100);
  const body = declaration(match[1], alpha);
  if (!body) return null;
  let prefix = "";
  let suffix = "";
  let pseudoElement = "";
  let descendant = "";
  for (const variant of parts) {
    if (variant === "dark") prefix = `.dark ${prefix}`;
    else if (PSEUDO[variant]) suffix += PSEUDO[variant];
    else if (GROUP[variant]) prefix = `${prefix}.group${GROUP[variant]} `;
    else if (PSEUDO_ELEMENT[variant]) pseudoElement = PSEUDO_ELEMENT[variant];
    else if (PROSE[variant]) descendant = PROSE[variant];
    else return null;
  }
  return `${prefix}.${escapeClass(token)}${suffix}${pseudoElement}${descendant} { ${body} }`;
}

function variables(scale) {
  const lines = scale.map((value, index) => `  --blue-${index + 1}: ${value} !important;`);
  lines.push(`  --solid-blue: ${scale[3]} !important;`);
  lines.push(`  --text-blue: ${scale[11]} !important;`);
  lines.push(`  --border-blue-strong: ${scale[11]} !important;`);
  lines.push(`  --border-blue: ${scale[8].split(" ").join(", ")}, 0.5 !important;`);
  return lines.join("\n");
}

const STYLESHEET_PROPERTIES = new Set(["color", "background-color", "outline-color", "border-color"]);

function validUrl(value) {
  return typeof value === "string" && /^https:\/\/[^\s"'<>]+$/.test(value);
}

function linksScript(links) {
  if (!links.length) return "";
  // < vira < para um rótulo nunca fechar a tag script.
  const data = JSON.stringify(links.map((link) => ({ l: link.rotulo, u: link.url, p: link.posicao, x: link.distancia?.x ?? 16, y: link.distancia?.y ?? 16 }))).replace(/</g, "\\u003c");
  return `<script data-kit-links>(function(){var links=${data};function mount(){if(document.querySelector("[data-kit-links-nav]"))return;links.forEach(function(item){var nav=document.createElement("nav");nav.setAttribute("data-kit-links-nav","");var sides=item.p.indexOf("superior")===0?["top"]:["bottom"];sides.push(item.p.indexOf("esquerda")>0?"left":"right");nav.style[sides[0]]=item.y+"px";nav.style[sides[1]]=item.x+"px";var a=document.createElement("a");a.href=item.u;a.target="_top";a.rel="noopener";a.textContent=item.l;nav.appendChild(a);document.body.appendChild(nav);});}if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",mount);}else{mount();}})();</script>`;
}

/**
 * escolhas: o conteúdo de escolhas.json; nbrand: references/n-brand.json; appVersion: a versão do kit.
 * Devolve { html, marcaEnv, summary }.
 */
export function buildTheme({ escolhas, nbrand, appVersion }) {
  const marca = escolhas?.marca ?? {};
  const primary = parseHex(marca.cor_principal);
  if (!primary) throw new AppError("color_invalid", `marca.cor_principal precisa ser uma cor em hexadecimal, como #0B5FFF (veio ${JSON.stringify(marca.cor_principal ?? null)}).`, "Use a cor principal do design system do projeto.");
  const primaryDark = marca.cor_principal_escuro ? parseHex(marca.cor_principal_escuro) : primary;
  if (!primaryDark) throw new AppError("color_invalid", "marca.cor_principal_escuro precisa ser uma cor em hexadecimal ou null.", "Deixe null para usar a mesma cor no modo escuro.");

  const light = buildScale(primary, "light");
  const dark = buildScale(primaryDark, "dark");
  const rules = [];
  const skipped = [];
  for (const token of nbrand.classes ?? []) {
    const rule = brandRule(token);
    if (rule) rules.push(rule);
    else skipped.push(token);
  }
  for (const item of nbrand.stylesheet_rules ?? []) {
    if (!STYLESHEET_PROPERTIES.has(item.property)) continue;
    rules.push(`${item.selector} { ${item.property}: rgb(var(--blue-9)) !important; }`);
  }
  rules.push("ninja-keys { --ninja-accent-color: rgb(var(--blue-9)) !important; }");

  const fontFamily = String(marca.fonte?.familia ?? "").trim();
  if (fontFamily) {
    if (!/^[\p{L}\p{N} _-]{1,60}$/u.test(fontFamily)) throw new AppError("font_invalid", "marca.fonte.familia aceita só o nome da fonte.", "Use, por exemplo, Inter ou Roboto.");
    rules.push(`html, body, .font-inter, .font-interDisplay { font-family: "${fontFamily}", Inter, ui-sans-serif, system-ui, sans-serif !important; }`);
  }
  const fontCss = marca.fonte?.css ?? null;
  if (fontCss && !validUrl(fontCss)) throw new AppError("font_invalid", "marca.fonte.css precisa ser um endereço https.", "Use o endereço do CSS da fonte, no domínio do projeto ou do Google Fonts.");

  const hides = [];
  for (const item of escolhas?.chatwoot?.esconder ?? []) {
    const selector = String(item?.seletor ?? "").trim();
    if (!selector || /[{}<>]/.test(selector)) throw new AppError("selector_invalid", `Seletor inválido em chatwoot.esconder: ${JSON.stringify(item?.seletor ?? null)}.`, "Use um seletor CSS simples, sem chaves.");
    hides.push(selector);
    rules.push(`${selector} { display: none !important; }`);
  }

  const links = [];
  for (const link of escolhas?.acrescentar?.links ?? []) {
    if (!link?.rotulo || !validUrl(link.url) || !POSITIONS[link.posicao]) {
      throw new AppError("link_invalid", `Link inválido em acrescentar.links: ${JSON.stringify(link?.rotulo ?? null)}.`, "Cada link precisa de rotulo, url https e posicao (superior-direita, superior-esquerda, inferior-direita ou inferior-esquerda).");
    }
    links.push(link);
  }
  if (links.length) {
    rules.push("[data-kit-links-nav] { position: fixed; z-index: 60; display: flex; gap: 8px; }");
    rules.push("[data-kit-links-nav] a { background: rgb(var(--blue-9)); color: #fff; padding: 6px 12px; border-radius: 999px; font-size: 13px; text-decoration: none; box-shadow: 0 1px 3px rgb(0 0 0 / 0.2); }");
  }

  const css = [`:root {\n${variables(light)}\n}`, `.dark {\n${variables(dark)}\n}`, ...rules].join("\n");
  const script = linksScript(links);
  const hash = sha256(`${css}\n${script}`).slice(0, 16);
  const marker = `whatsapp-support@${appVersion}`;
  const html = [
    `<!-- ${marker}, gerado de escolhas.json pelo kit; não edite à mão -->`,
    fontCss ? `<link rel="stylesheet" href="${fontCss}" data-kit-font>` : "",
    `<style data-kit="${marker}" data-kit-theme="${hash}">\n${css}\n</style>`,
    script,
  ]
    .filter(Boolean)
    .join("\n");

  const env = {
    KIT_BRAND_NAME: marca.nome,
    KIT_LOGO_URL: marca.logo,
    KIT_LOGO_DARK_URL: marca.logo_escuro ?? marca.logo,
    KIT_LOGO_THUMBNAIL_URL: marca.icone,
    KIT_BRAND_URL: marca.site,
    KIT_TERMS_URL: marca.termos,
    KIT_PRIVACY_URL: marca.privacidade,
    KIT_LOGOUT_URL: marca.saida,
  };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined || value === null || value === "") continue;
    if (key !== "KIT_BRAND_NAME" && !validUrl(value)) throw new AppError("url_invalid", `${key} precisa ser um endereço https (veio de escolhas.json, marca).`, "Use endereços https do domínio do projeto.");
    if (/[\r\n]/.test(String(value))) throw new AppError("value_invalid", `${key} não pode ter quebra de linha.`, "Corrija escolhas.json.");
  }
  if (!String(marca.nome ?? "").trim()) throw new AppError("brand_missing", "Falta marca.nome em escolhas.json.", "Use o nome do sistema que o cliente conhece.");
  const marcaEnv = [
    "# Gerado pelo kit a partir de escolhas.json; não edite à mão.",
    ...Object.entries(env)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => `${key}=${String(value).trim()}`),
    "KIT_DASHBOARD_SCRIPTS_FILE=/kit/gerado/painel.html",
    "",
  ].join("\n");

  return {
    html,
    marcaEnv,
    summary: {
      app: "whatsapp-support",
      version: appVersion,
      chatwoot: nbrand.chatwoot,
      hash,
      primary: light[8],
      primary_dark: dark[8],
      light,
      dark,
      classes: rules.length,
      skipped,
      hides,
      links: links.map((link) => link.rotulo),
      brand: String(marca.nome).trim(),
    },
  };
}
