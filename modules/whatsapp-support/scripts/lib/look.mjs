// Conferência no navegador: entra no painel pelo login único de uma pessoa de teste, abre as telas
// de escolhas.json (conferencia.telas), confirma que o tema está aplicado, que a cor principal chegou
// às variáveis e aos elementos com o azul fixo, que o que foi escondido não aparece e que não sobrou
// link para o site do Chatwoot. Salva uma captura por tela, nos modos claro e escuro.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Browser } from "./browser.mjs";
import { toPosix } from "./util.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const DEFAULT_SCREENS = [
  { nome: "conversas", caminho: "/app/accounts/{conta}/dashboard" },
  { nome: "contatos", caminho: "/app/accounts/{conta}/contacts" },
  { nome: "perfil", caminho: "/app/accounts/{conta}/profile/settings" },
];

/** O script que roda na página e devolve o que a conferência precisa, sem dados de conversa. */
export function probeScript({ hides, brandClasses }) {
  return `(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
    };
    const theme = document.querySelector('style[data-kit^="whatsapp-support@"]');
    const blue9 = getComputedStyle(document.body).getPropertyValue("--blue-9").trim().replace(/\\s+/g, " ");
    const hides = ${JSON.stringify(hides)}.map((selector) => {
      let count = 0;
      try {
        count = [...document.querySelectorAll(selector)].filter(visible).length;
      } catch {
        count = -1;
      }
      return { selector, visible: count };
    });
    let brandSample = null;
    for (const name of ${JSON.stringify(brandClasses)}) {
      const element = [...document.getElementsByClassName(name)].find(visible);
      if (!element) continue;
      const style = getComputedStyle(element);
      brandSample = { name, color: name.startsWith("text-") ? style.color : style.backgroundColor };
      break;
    }
    const chatwootLinks = [...document.querySelectorAll('a[href*="chatwoot.com"]')].filter(visible).length;
    return {
      path: location.pathname,
      title: document.title.trim(),
      theme: theme ? theme.getAttribute("data-kit-theme") : null,
      blue9,
      dark: document.body.classList.contains("dark") || document.documentElement.classList.contains("dark"),
      hides,
      brandSample,
      chatwootLinks,
    };
  })()`;
}

function sameRgb(computed, expected) {
  const numbers = String(computed ?? "").match(/[\d.]+/g)?.slice(0, 3).map((value) => Math.round(Number(value)));
  const target = String(expected ?? "").split(" ").map(Number);
  return Boolean(numbers && numbers.length === 3 && numbers.every((value, index) => Math.abs(value - target[index]) <= 1));
}

/** Avalia o que a página devolveu contra o tema gerado. */
export function judge(probe, { summary, scheme }) {
  const problems = [];
  // O modo de cor segue a preferência da pessoa no painel; vale o que a página mostra.
  const expectedBlue = probe.dark ? summary.primary_dark : summary.primary;
  if (scheme === "escuro" && !probe.dark) problems.push("o painel não entrou no modo escuro: a preferência de aparência da pessoa de teste está fixa em claro");
  if (!probe.theme) problems.push("o tema do kit não está na página");
  else if (probe.theme !== summary.hash) problems.push(`o tema no ar (${probe.theme}) não é o gerado (${summary.hash})`);
  if (!sameRgb(probe.blue9.replace(/ /g, ","), expectedBlue)) problems.push(`--blue-9 é ${probe.blue9 || "vazio"}, esperado ${expectedBlue}`);
  if (probe.brandSample && !sameRgb(probe.brandSample.color, expectedBlue)) problems.push(`${probe.brandSample.name} pinta ${probe.brandSample.color}, esperado rgb(${expectedBlue})`);
  for (const hide of probe.hides) {
    if (hide.visible === -1) problems.push(`seletor inválido no navegador: ${hide.selector}`);
    else if (hide.visible > 0) problems.push(`${hide.visible} elemento(s) visível(is) que deviam sumir: ${hide.selector}`);
  }
  if (probe.chatwootLinks > 0) problems.push(`${probe.chatwootLinks} link(s) visível(is) para o site do Chatwoot`);
  if (summary.brand && probe.title && !probe.title.includes(summary.brand)) problems.push(`o título da aba é "${probe.title}"`);
  return problems;
}

/**
 * ssoUrl: link de entrada de uma pessoa de teste (vale uma vez); chatwootUrl: o endereço público do painel;
 * accountId: a conta da pessoa; screens: as telas; outDir: onde salvar as capturas.
 */
export async function look({ ssoUrl, chatwootUrl, accountId, screens, summary, outDir, schemes = ["claro", "escuro"], root }) {
  mkdirSync(outDir, { recursive: true });
  const browser = await Browser.launch();
  const results = [];
  try {
    const page = await browser.newPage();
    await page.goto(ssoUrl);
    const entered = await page.waitFor(`location.pathname.startsWith("/app/accounts/")`, 45000);
    if (!entered) {
      return { ok: false, entered: false, results, problem: "o login único não levou ao painel; o link vale 5 minutos e uma vez só, peça outro" };
    }
    const brandClasses = ["bg-n-brand", "text-n-brand"];
    for (const scheme of schemes) {
      await page.colorScheme(scheme === "escuro" ? "dark" : "light");
      for (const screen of screens) {
        const url = `${chatwootUrl.replace(/\/+$/, "")}${screen.caminho.replace("{conta}", String(Number(accountId)))}`;
        await page.goto(url);
        await page.waitFor(`document.querySelector("#app") && document.querySelector("#app").children.length > 0`, 30000);
        await sleep(2500);
        const probe = await page.evaluate(probeScript({ hides: summary.hides, brandClasses }));
        const file = join(outDir, `${screen.nome}-${scheme}.png`);
        writeFileSync(file, await page.screenshot());
        const problems = judge(probe, { summary, scheme });
        results.push({ tela: screen.nome, modo: scheme, ok: problems.length === 0, problemas: problems, captura: toPosix(root ? file.slice(root.length + 1) : file) });
      }
    }
  } finally {
    await browser.close();
  }
  return { ok: results.every((result) => result.ok), entered: true, results };
}
