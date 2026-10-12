// The site capture: pure helpers without a browser, then the fixture site through the real
// browser (skipped when none is installed), then the command as the member's AI runs it.
// Outputs go to FLYEE_TEST_OUT when set, else to the system's temporary folder.
//   node --test modules/video-render/tests/capture.test.mjs

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  assetFileName,
  buildBrand,
  classifySocial,
  collectContacts,
  collectSocial,
  colorTally,
  easeInOutCubic,
  findNumbers,
  hasLoginArea,
  hostSlug,
  hslOf,
  isAccent,
  isBotWall,
  languageCues,
  normalizeUrl,
  numericValue,
  parsePrice,
  pickPrimary,
  pngSize,
  rankLogos,
  scrollPlan,
  sectorCues,
  siteName,
  sniffImage,
  summarizeJsonLd,
  titleBrand,
  toHex,
  captureSite,
  mobileLayout,
  placeholderPage,
} from "../scripts/lib/capture.mjs";
import { checkTools, findBrowser } from "../scripts/lib/tools.mjs";
import { fileUrl } from "../scripts/lib/util.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/render.mjs", import.meta.url));
const FIXTURE = fileURLToPath(new URL("./fixtures/site/index.html", import.meta.url));
const OUT_ROOT = process.env.FLYEE_TEST_OUT ? resolve(process.env.FLYEE_TEST_OUT) : join(tmpdir(), "flyee-video-render-tests", "capture");
const browser = findBrowser();
const noBrowser = browser ? false : "no browser (Edge, Chrome or Chromium) on this machine";
const tools = await checkTools();

function fresh(name) {
  const dir = join(OUT_ROOT, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Runs render.mjs as the member's AI would: from the repo root, with --json. */
function cli(args, { cwd = resolve(fileURLToPath(new URL("../../..", import.meta.url))) } = {}) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [SCRIPT, ...args, "--json"], { cwd, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => {
      let json = null;
      try {
        json = JSON.parse(stdout);
      } catch {
        // not JSON: the assertion shows stdout and stderr
      }
      done({ code, json, stdout, stderr });
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------------------------

test("toHex converts every color form the browser reports and drops transparent ones", () => {
  assert.equal(toHex("rgb(255, 0, 0)"), "#FF0000");
  assert.equal(toHex("rgb(124, 58, 237)"), "#7C3AED");
  assert.equal(toHex("rgba(16, 32, 48, 0.5)"), "#102030");
  assert.equal(toHex("rgba(0, 0, 0, 0)"), null);
  assert.equal(toHex("rgb(255 255 255 / 0)"), null);
  assert.equal(toHex("transparent"), null);
  assert.equal(toHex("#abc"), "#AABBCC");
  assert.equal(toHex("#7c3aed"), "#7C3AED");
  assert.equal(toHex("#7c3aed00"), null);
  assert.equal(toHex("#7c3aedff"), "#7C3AED");
  assert.equal(toHex("hsl(0, 100%, 50%)"), "#FF0000");
  assert.equal(toHex("color(srgb 1 0 0)"), "#FF0000");
  assert.equal(toHex("white"), "#FFFFFF");
  assert.equal(toHex(null), null);
  assert.equal(toHex("garbage"), null);
  const green = toHex("oklch(0.72 0.19 150)");
  assert.match(green, /^#[0-9A-F]{6}$/);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(green.slice(i, i + 2), 16));
  assert.ok(g > r && g > b, `oklch green came out as ${green}`);
  assert.equal(toHex("oklch(1 0 0)"), "#FFFFFF");
  assert.equal(toHex("oklab(0 0 0)"), "#000000");
  assert.match(toHex("lab(50 0 0)"), /^#(7|8)[0-9A-F]\1[0-9A-F]\1[0-9A-F]$/);
  assert.equal(toHex("color(display-p3 1 1 1)"), "#FFFFFF");
});

test("hslOf, isAccent and pickPrimary prefer the saturated button color", () => {
  assert.deepEqual(hslOf("#FF0000"), { h: 0, s: 1, l: 0.5 });
  assert.equal(isAccent("#7C3AED"), true);
  assert.equal(isAccent("#FFFFFF"), false);
  assert.equal(isAccent("#111827"), false);
  assert.equal(isAccent("#808080"), false);
  const palette = [{ hex: "#FFFFFF", share: 0.6 }, { hex: "#111827", share: 0.3 }, { hex: "#25D366", share: 0.05 }];
  assert.equal(pickPrimary({ cta: ["#7C3AED", "#7C3AED", "#25D366"], links: ["#7C3AED"], palette }), "#7C3AED");
  assert.equal(pickPrimary({ cta: [], links: [], palette }), "#25D366");
  assert.equal(pickPrimary({ cta: [], links: [], palette: [{ hex: "#FFFFFF", share: 1 }] }), null);
  assert.equal(pickPrimary({ cta: [], links: [], themeColor: "#E63946", palette: [] }), "#E63946");
});

test("colorTally merges equal colors written differently and computes shares", () => {
  const tally = colorTally([
    { color: "rgb(255, 255, 255)", area: 600 },
    { color: "#fff", area: 200 },
    { color: "rgba(17, 24, 39, 1)", area: 200 },
    { color: "rgba(0, 0, 0, 0)", area: 9999 },
  ]);
  assert.deepEqual(tally, [
    { hex: "#FFFFFF", area: 800, share: 0.8 },
    { hex: "#111827", area: 200, share: 0.2 },
  ]);
});

test("findNumbers keeps numbers with a unit and skips years, phones and prices", () => {
  const text = [
    "+2.000 clientes atendidos em Curitiba",
    "97% de aprovação nas avaliações. 15 anos de experiência clínica.",
    "Fundada em 2009. Telefone (41) 99999-8888.",
    "R$ 199 sessão única",
    "Mais de 5 mil alunos e 10k seguidores",
    "+ 300 projetos entregues",
  ].join("\n");
  const found = findNumbers(text);
  const texts = found.map((n) => n.text);
  assert.ok(texts.includes("+2.000 clientes"), texts.join(" | "));
  assert.ok(texts.includes("97%"));
  assert.ok(texts.includes("15 anos"));
  assert.ok(texts.includes("5 mil"));
  assert.ok(texts.includes("10k"));
  assert.ok(texts.some((t) => /^\+ ?300 projetos$/.test(t)));
  assert.ok(!texts.some((t) => /2009|8888|199/.test(t)), texts.join(" | "));
  const clients = found.find((n) => n.text === "+2.000 clientes");
  assert.equal(clients.value, 2000);
  assert.equal(clients.unit, "clientes");
  assert.equal(clients.context, "+2.000 clientes atendidos em Curitiba");
  const approval = found.find((n) => n.text === "97%");
  assert.equal(approval.context, "97% de aprovação nas avaliações.");
  assert.equal(found.find((n) => n.text === "5 mil").value, 5000);
  assert.equal(numericValue("1.299,90"), 1299.9);
  assert.equal(numericValue("2,000"), 2000);
  assert.equal(numericValue("1,5", "mil"), 1500);
});

test("parsePrice reads Brazilian prices", () => {
  assert.equal(parsePrice("R$ 1.299,90"), 1299.9);
  assert.equal(parsePrice("R$199"), 199);
  assert.equal(parsePrice("R$ 89,90 por mês"), 89.9);
  assert.equal(parsePrice("R$ 49,9"), 49.9);
  assert.equal(parsePrice("sem preço"), null);
});

test("classifySocial, collectSocial and collectContacts", () => {
  assert.equal(classifySocial("https://www.instagram.com/sorrisopleno").network, "instagram");
  assert.equal(classifySocial("https://www.instagram.com/p/abc123/").kind, "post");
  assert.equal(classifySocial("https://wa.me/5541999998888").network, "whatsapp");
  assert.equal(classifySocial("https://api.whatsapp.com/send?phone=5541999998888").network, "whatsapp");
  assert.equal(classifySocial("https://x.com/flyee").network, "x");
  assert.equal(classifySocial("https://twitter.com/intent/tweet?text=oi").kind, "share");
  assert.equal(classifySocial("https://www.facebook.com/sharer/sharer.php?u=x").kind, "share");
  assert.equal(classifySocial("https://t.me/canal").network, "telegram");
  assert.equal(classifySocial("https://www.youtube.com/@canal").kind, "profile");
  assert.equal(classifySocial("https://youtu.be/dQw4w9WgXcQ").kind, "post");
  assert.equal(classifySocial("https://www.tiktok.com/@marca").network, "tiktok");
  assert.equal(classifySocial("https://www.linkedin.com/company/marca").network, "linkedin");
  assert.equal(classifySocial("https://exemplo.com"), null);
  assert.equal(classifySocial("mailto:a@b.co"), null);
  const social = collectSocial([
    { href: "https://www.youtube.com/watch?v=abc" },
    { href: "https://www.youtube.com/@canal" },
    { href: "https://www.facebook.com/sharer/sharer.php?u=x" },
    { href: "https://www.instagram.com/marca" },
    { href: "https://www.instagram.com/outra" },
  ]);
  assert.deepEqual(social, { youtube: "https://www.youtube.com/@canal", instagram: "https://www.instagram.com/marca" });
  const contacts = collectContacts([
    { href: "mailto:Contato@Marca.com.br?subject=Oi" },
    { href: "tel:+55 (41) 3333-4444" },
    { href: "https://wa.me/5541999998888?text=Oi" },
    { href: "https://api.whatsapp.com/send?phone=5541988887777" },
  ]);
  assert.deepEqual(contacts, { emails: ["contato@marca.com.br"], phones: ["+554133334444"], whatsapp: ["5541999998888", "5541988887777"] });
  assert.equal(hasLoginArea([{ href: "https://x.com/login", text: "Entrar" }]), true);
  assert.equal(hasLoginArea([{ href: "/#planos", text: "Área do paciente" }]), true);
  assert.equal(hasLoginArea([{ href: "mailto:login@x.com", text: "" }, { href: "/sobre", text: "Sobre" }]), false);
});

test("sectorCues and languageCues read the cues of a dental clinic", () => {
  const text = "Clínica odontológica em Curitiba: implantes dentários, clareamento a laser e alinhadores invisíveis. Agende sua consulta com nossos dentistas; mais de 2.000 pacientes já fizeram o tratamento. Você merece esse sorriso.";
  const cues = sectorCues(text);
  assert.equal(cues[0].sector, "odontologia", JSON.stringify(cues));
  assert.ok(cues.some((c) => c.sector === "saúde"));
  assert.ok(cues[0].keywords.includes("dent"));
  assert.equal(sectorCues("nada a ver com setor algum").length, 0);
  const language = languageCues("Você não precisa de mais nada para o seu sorriso com a nossa equipe também aqui", "pt-BR");
  assert.equal(language.declared, "pt-BR");
  assert.equal(language.detected, "pt");
  assert.equal(languageCues("The best clinic for your smile and your family with our team").detected, "en");
});

test("summarizeJsonLd, siteName and titleBrand", () => {
  const blocks = [
    { "@context": "https://schema.org", "@type": "Dentist", name: "Sorriso Pleno", logo: "https://x/logo.svg", sameAs: ["https://www.instagram.com/sorrisopleno"], telephone: "+55 41 3333-4444", address: { "@type": "PostalAddress", streetAddress: "Rua das Flores, 100", addressLocality: "Curitiba" } },
    { "@context": "https://schema.org", "@graph": [{ "@type": "WebSite", name: "Sorriso Pleno", url: "https://x/" }, { "@type": "Product", name: "Clareamento", offers: { "@type": "Offer", price: "199.00", priceCurrency: "BRL" } }] },
  ];
  const ld = summarizeJsonLd(blocks);
  assert.deepEqual(ld.types.sort(), ["Dentist", "Product", "WebSite"]);
  assert.equal(ld.organization.name, "Sorriso Pleno");
  assert.equal(ld.organization.logo, "https://x/logo.svg");
  assert.equal(ld.organization.address, "Rua das Flores, 100, Curitiba");
  assert.deepEqual(ld.same_as, ["https://www.instagram.com/sorrisopleno"]);
  assert.equal(ld.products[0].price, 199);
  assert.equal(ld.products[0].currency, "BRL");
  assert.equal(ld.website.url, "https://x/");
  assert.equal(summarizeJsonLd([]).organization, null);
  assert.equal(titleBrand("Sorriso Pleno | Clínica odontológica em Curitiba"), "Sorriso Pleno");
  assert.equal(titleBrand("Clínica odontológica em Curitiba - Sorriso Pleno"), "Sorriso Pleno");
  assert.equal(titleBrand("Exemplo"), "Exemplo");
  assert.equal(siteName({ ogSiteName: null, jsonldName: null, title: "Ab | B muito maior" }), "Ab");
  assert.equal(siteName({ ogSiteName: "Marca", title: "Outra" }), "Marca");
});

test("rankLogos puts the header logo first and favicons last", () => {
  const ranked = rankLogos([
    { kind: "img", src: "https://x/banner.jpg", in_header: false, home_link: false, width: 1200, height: 600, visible: true, source: "dom" },
    { kind: "img", src: "https://x/favicon.ico", source: "icon", width: 32, height: 32 },
    { kind: "svg", markup: "<svg/>", class: "logo", in_header: true, home_link: true, width: 44, height: 44, visible: true, source: "dom" },
    { kind: "img", src: "https://x/marca.png", alt: "Marca logo", in_header: true, home_link: true, width: 140, height: 32, visible: true, source: "dom" },
  ]);
  assert.equal(ranked[0].kind, "svg");
  assert.equal(ranked[1].src, "https://x/marca.png");
  assert.equal(ranked[ranked.length - 1].source, "icon");
});

test("normalizeUrl, hostSlug and assetFileName", () => {
  assert.equal(normalizeUrl("https://www.Exemplo.com.br/planos"), "https://www.exemplo.com.br/planos");
  assert.equal(normalizeUrl("exemplo.com.br"), "https://exemplo.com.br/");
  assert.equal(normalizeUrl("localhost:3000"), "http://localhost:3000/");
  assert.equal(normalizeUrl("127.0.0.1:8080/loja"), "http://127.0.0.1:8080/loja");
  assert.equal(normalizeUrl("http://localhost:3000/x"), "http://localhost:3000/x");
  assert.match(normalizeUrl(FIXTURE), /^file:\/\/\/.*index\.html$/);
  for (const bad of ["", "ftp://x.com", "javascript:alert(1)", "só texto", "data:text/html,oi"]) {
    assert.throws(() => normalizeUrl(bad), (error) => error.code === "invalid_url", bad);
  }
  assert.equal(hostSlug("https://www.Clinica-Sorriso.com.br/planos?x=1"), "clinica-sorriso-com-br");
  assert.equal(hostSlug("https://example.com"), "example-com");
  assert.equal(hostSlug(fileUrl(FIXTURE)), "index");
  assert.equal(hostSlug("nada"), "site");
  assert.equal(assetFileName({ role: "logo", index: 1, url: "https://x/img/Marca Branca.svg?v=2", type: "image/svg+xml" }), "logo-1-marca-branca.svg");
  assert.equal(assetFileName({ role: "logo", index: 2, url: "data:image/png;base64,AAAA", type: "image/png" }), "logo-2.png");
  assert.equal(assetFileName({ role: "favicon", url: "https://x/favicon.ico", type: "image/x-icon" }), "favicon.ico");
  assert.equal(assetFileName({ role: "og-image", url: "https://x/a/b.jpg", type: "image/jpeg" }), "og-image-b.jpg");
  assert.equal(assetFileName({ role: "logo", index: 3, url: "https://x/3f2a9c1b7e4d5a6f8b9c0d1e.png", type: "image/png" }), "logo-3.png");
});

test("sniffImage and pngSize read the bytes, not the headers", () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mN8+/btfwYGBgYGADSkBRyMz/vUAAAAAElFTkSuQmCC", "base64");
  assert.equal(sniffImage(png), "image/png");
  assert.deepEqual(pngSize(png), { width: 2, height: 2 });
  assert.equal(sniffImage(Buffer.from("<?xml version=\"1.0\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>")), "image/svg+xml");
  assert.equal(sniffImage(Buffer.from("<!doctype html><html><body>not an image</body></html>")), null);
  assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), "image/jpeg");
  assert.equal(pngSize(Buffer.from("nope")), null);
});

test("mobileLayout turns heading positions into fractions of the full page and drops what the image does not show", () => {
  const positions = { scroll_height: 5000, inner_height: 844, headings: [{ tag: "h1", text: "Topo", y: 100, height: 60 }, { tag: "h2", text: "Meio", y: 2000, height: 40 }, { tag: "h2", text: "Além do recorte", y: 4500, height: 40 }] };
  const layout = mobileLayout(positions, { fullHeight: 4000, viewportHeight: 844 });
  assert.deepEqual(layout.headings.map((h) => [h.text, h.fraction]), [["Topo", 0.025], ["Meio", 0.5]]);
  assert.equal(layout.full_height, 4000);
  assert.equal(layout.viewport_height, 844);
  assert.equal(mobileLayout(null, { fullHeight: 4000 }), null);
  assert.equal(mobileLayout(positions, { fullHeight: 0 }), null);
});

test("isBotWall, easeInOutCubic and scrollPlan", () => {
  assert.equal(isBotWall({ title: "Just a moment...", text: "", status: 403 }).blocked, true);
  assert.equal(isBotWall({ title: "Attention Required! | Cloudflare" }).blocked, true);
  assert.equal(isBotWall({ title: "Minha loja", text: "Verify you are human by completing the action below." }).blocked, true);
  assert.deepEqual(isBotWall({ title: "Sorriso Pleno", text: "Seu sorriso novo", status: 200 }), { blocked: false, http_error: false, status: 200, reasons: [] });
  assert.equal(isBotWall({ title: "Página não encontrada", status: 404 }).http_error, true);
  assert.equal(isBotWall({ title: "Página não encontrada", status: 404 }).blocked, false);
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.equal(easeInOutCubic(0.5), 0.5);
  assert.deepEqual(scrollPlan(1, 1000), [0]);
  const plan = scrollPlan(5, 1000);
  assert.equal(plan.length, 5);
  assert.equal(plan[0], 0);
  assert.equal(plan[4], 1000);
  assert.ok(plan.every((y, i) => i === 0 || y >= plan[i - 1]));
  assert.ok(plan[1] < 250 && plan[3] > 750, String(plan));
});

test("placeholderPage tells a parked domain, a server's default page and a coming-soon page from a real site", () => {
  const hostinger = placeholderPage({ title: "Parked Domain name on Hostinger DNS system", text: "Start your online journey. Build your website today", words: 220, url: "https://flyee.club/", finalUrl: "https://flyee.club/" });
  assert.equal(hostinger.kind, "parked");
  assert.match(hostinger.evidence, /Parked Domain/);
  assert.match(hostinger.label, /estacionado/);
  assert.equal(placeholderPage({ title: "minhaloja.com.br", text: "minhaloja.com.br. Parked free, courtesy of GoDaddy.com." }).kind, "parked");
  assert.equal(placeholderPage({ title: "Domínio à venda", text: "" }).kind, "parked");
  assert.equal(placeholderPage({ title: "minhaloja.com", text: "", url: "https://minhaloja.com/", finalUrl: "https://sedo.com/search/details/?domain=minhaloja.com" }).kind, "parked", "a redirect to a domain marketplace");
  assert.equal(placeholderPage({ title: "Apache2 Ubuntu Default Page: It works", text: "" }).kind, "default_page");
  assert.equal(placeholderPage({ title: "", text: "It works!", words: 2 }).kind, "default_page");
  assert.equal(placeholderPage({ title: "Welcome to nginx!", text: "" }).kind, "default_page");
  assert.equal(placeholderPage({ title: "Ateliê Flor | Em breve", text: "Nossa loja abre em novembro" }).kind, "coming_soon");
  assert.equal(placeholderPage({ title: "Ateliê Flor", text: "Site em construção. Volte logo!", words: 6 }).kind, "coming_soon");
  const realText = `${"Coleção de verão com peças feitas à mão em Curitiba. ".repeat(20)}Em breve: nova coleção de inverno.`;
  assert.equal(placeholderPage({ title: "Ateliê Flor | Moda autoral", text: realText }), null, "a real site that announces something em breve is not a placeholder");
  assert.equal(placeholderPage({ title: "Jordan Imóveis", text: "Visite jordan.com para ver os imóveis", words: 7 }), null, "dan.com only as a whole host");
  assert.equal(placeholderPage({ title: "Sorriso Pleno", text: "Seu sorriso novo em 90 dias", words: 6, url: "https://sorrisopleno.com.br/", finalUrl: "https://www.sorrisopleno.com.br/" }), null);
});

test("captureSite refuses a parked domain with a stable code and leaves the screen it got", { skip: noBrowser, timeout: 120000 }, async () => {
  const dir = fresh("parked");
  const { writeFileSync } = await import("node:fs");
  const page = join(dir, "estacionado.html");
  writeFileSync(page, '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Parked Domain name on Hostinger DNS system</title></head><body style="font-family:sans-serif;background:#673de6;color:#fff"><h1>Start your online journey</h1><p>Get Web hosting</p></body></html>');
  const out = join(dir, "captura");
  await assert.rejects(
    captureSite({ url: fileUrl(page), outDir: out, tools, scrollSeconds: 0, assets: false }),
    (error) => error.code === "site_placeholder" && /estacionado/.test(error.message) && /provedor/.test(error.fix ?? ""),
  );
  assert.ok(existsSync(join(out, "sem-site.png")), "the screen the address answered with is kept");
  assert.ok(!existsSync(join(out, "captura.json")), "nothing is saved as the brand");
});

test("buildBrand assembles the sheet from a raw extraction", () => {
  const raw = {
    document: { title: "Sorriso Pleno | Clínica", lang: "pt-BR", description: "Implantes e clareamento.", og: { site_name: null, title: "OG", image: null }, theme_color: "#7C3AED" },
    jsonld: [{ "@type": "Dentist", name: "Sorriso Pleno", telephone: "+55 41 3333-4444" }],
    headings: { h1: ["Seu sorriso novo em 90 dias"], h2: ["Implantes"], largest: "x" },
    cta: [{ text: "Agendar", href: "https://x/#a", background: "rgb(124, 58, 237)", color: "rgb(255, 255, 255)" }],
    colors: { elements: { body: { background: "rgba(0, 0, 0, 0)", color: "rgb(31, 41, 55)" }, html: { background: "rgb(255, 255, 255)", color: "rgb(0, 0, 0)" }, link: { color: "rgb(124, 58, 237)" } }, backgrounds: [{ color: "rgb(255, 255, 255)", area: 900 }, { color: "rgb(17, 24, 39)", area: 100 }], texts: [{ color: "rgb(31, 41, 55)", area: 500 }] },
    fonts: { body: '"Inter", Arial, sans-serif', h1: '"Marca Display", Georgia, serif', button: null, nav: "Inter", loaded: [{ family: "Inter", weight: "400", style: "normal", status: "loaded" }], faces: [{ family: "Marca Display", weight: "700", style: "normal", src: ["https://x/marca.woff2"] }] },
    prices: [{ text: "R$ 199", context: "R$ 199 sessão única", product: "Clareamento a laser" }],
    links: [{ href: "https://www.instagram.com/sorrisopleno", text: "Instagram" }, { href: "mailto:oi@x.com", text: "" }, { href: "https://x/login", text: "Área do paciente" }],
    nav: [{ text: "Planos", href: "https://x/#planos" }],
    text: "Seu sorriso novo em 90 dias. +2.000 clientes atendidos. Clínica odontológica com dentistas e implantes dentários. Você agenda aqui com a nossa equipe.",
  };
  const brand = buildBrand(raw, [{ role: "logo", saved: true, file: "assets/logo-1.svg", source: "dom", kind: "svg", width: 44, height: 44 }, { role: "logo", saved: true, file: "assets/logo-2.png" }, { role: "favicon", saved: false }]);
  assert.equal(brand.name, "Sorriso Pleno");
  assert.equal(brand.headline, "Seu sorriso novo em 90 dias");
  assert.equal(brand.description, "Implantes e clareamento.");
  assert.equal(brand.logo.file, "assets/logo-1.svg");
  assert.deepEqual(brand.logo.alternatives, ["assets/logo-2.png"]);
  assert.equal(brand.colors.primary, "#7C3AED");
  assert.equal(brand.colors.background, "#FFFFFF");
  assert.equal(brand.colors.text, "#1F2937");
  assert.equal(brand.colors.palette[0].hex, "#FFFFFF");
  assert.equal(brand.fonts.headline, "Marca Display");
  assert.equal(brand.fonts.body, "Inter");
  assert.equal(brand.fonts.ui, "Inter");
  assert.ok(brand.fonts.faces.some((f) => f.family === "Marca Display" && f.src[0] === "https://x/marca.woff2"));
  assert.ok(brand.fonts.faces.some((f) => f.family === "Inter" && f.loaded));
  assert.deepEqual(brand.cta, [{ text: "Agendar", href: "https://x/#a", background: "#7C3AED", color: "#FFFFFF" }]);
  assert.equal(brand.numbers[0].text, "+2.000 clientes");
  assert.deepEqual(brand.prices, [{ text: "R$ 199", value: 199, currency: "BRL", product: "Clareamento a laser", context: "R$ 199 sessão única" }]);
  assert.equal(brand.social.instagram, "https://www.instagram.com/sorrisopleno");
  assert.deepEqual(brand.contacts.emails, ["oi@x.com"]);
  assert.deepEqual(brand.contacts.phones, ["+55 41 3333-4444"]);
  assert.equal(brand.sector_cues[0].sector, "odontologia");
  assert.equal(brand.has_login_area, true);
  assert.equal(brand.language.declared, "pt-BR");
  assert.deepEqual(brand.nav, ["Planos"]);
  const bare = buildBrand({}, []);
  assert.equal(bare.name, null);
  assert.equal(bare.logo, null);
  assert.equal(bare.colors.background, "#FFFFFF");
  assert.deepEqual(bare.numbers, []);
});

// ---------------------------------------------------------------------------------------------
// The fixture site through the real browser
// ---------------------------------------------------------------------------------------------

test("captureSite reads the fixture site: brand, screens, scroll and assets", { skip: noBrowser, timeout: 240000 }, async () => {
  const dir = fresh("fixture");
  const messages = [];
  const capture = await captureSite({ url: fileUrl(FIXTURE), outDir: dir, tools, scrollSeconds: 2, fps: 15, onProgress: (text) => messages.push(text) });

  // files
  assert.ok(existsSync(join(dir, "captura.json")), "captura.json");
  assert.ok(existsSync(join(dir, "desktop.png")), "desktop.png");
  assert.ok(existsSync(join(dir, "desktop-full.png")), "desktop-full.png");
  assert.ok(existsSync(join(dir, "mobile.png")), "mobile.png");
  assert.ok(existsSync(join(dir, "mobile-full.png")), "mobile-full.png");
  const saved = JSON.parse(readFileSync(join(dir, "captura.json"), "utf8"));
  assert.equal(saved.format_version, 1);
  assert.equal(saved.brand.headline, capture.brand.headline);
  assert.equal(pngSize(readFileSync(join(dir, "desktop.png"))).width, 1440);
  assert.equal(pngSize(readFileSync(join(dir, "desktop.png"))).height, 900);
  const desktopFull = pngSize(readFileSync(join(dir, "desktop-full.png")));
  assert.ok(desktopFull.height > 900 * 1.5, `the full page is taller than the viewport (${desktopFull.height})`);
  assert.equal(capture.viewports.desktop.full_height, desktopFull.height);
  const mobile = pngSize(readFileSync(join(dir, "mobile.png")));
  assert.deepEqual(mobile, { width: 780, height: 1688 });
  const mobileFull = pngSize(readFileSync(join(dir, "mobile-full.png")));
  assert.ok(mobileFull.height > 1688 * 1.5, `the full mobile page is taller than the viewport (${mobileFull.height})`);

  // where each heading sits in the full mobile page, so a scene can scroll to its section
  const layout = capture.layout.mobile;
  assert.ok(layout, "layout.mobile");
  assert.equal(layout.full_height, capture.viewports.mobile.full_height);
  assert.equal(layout.full_height * 2, mobileFull.height, "positions are CSS px of the mobile page, the image is at 2×");
  const texts = layout.headings.map((h) => h.text);
  for (const wanted of ["Seu sorriso novo em 90 dias", "Implantes dentários", "Clareamento a laser", "Alinhadores invisíveis", "Planos e valores"]) assert.ok(texts.includes(wanted), `${wanted} in ${texts.join(" | ")}`);
  const at = (text) => layout.headings.find((h) => h.text === text);
  assert.ok(at("Seu sorriso novo em 90 dias").fraction < at("Implantes dentários").fraction, "the hero comes first");
  assert.ok(at("Implantes dentários").fraction < at("Alinhadores invisíveis").fraction && at("Alinhadores invisíveis").fraction < at("Planos e valores").fraction, "headings in page order");
  for (const heading of layout.headings) assert.ok(heading.fraction >= 0 && heading.fraction < 1 && heading.y === Math.round(heading.fraction * layout.full_height) || Math.abs(heading.y - heading.fraction * layout.full_height) <= 1, JSON.stringify(heading));
  assert.deepEqual(saved.layout, capture.layout, "captura.json carries the layout");

  // the extraction
  const { brand, raw } = capture;
  assert.equal(brand.name, "Sorriso Pleno");
  assert.equal(brand.headline, "Seu sorriso novo em 90 dias");
  assert.equal(brand.description, "Implantes, clareamento e alinhadores invisíveis com avaliação gratuita. Mais de 2.000 pacientes atendidos em Curitiba.");
  assert.ok(raw.logos.length >= 2, `logo candidates: ${JSON.stringify(raw.logos)}`);
  assert.ok(raw.logos.some((l) => l.kind === "svg" && l.in_header && l.home_link), "the inline SVG logo in the header");
  assert.ok(raw.logos.some((l) => l.kind === "img" && /Sorriso Pleno logo/.test(l.alt)), "the <img> logo");
  assert.ok(brand.logo, "a logo was saved");
  assert.ok(existsSync(join(dir, brand.logo.file)), brand.logo.file);
  assert.match(brand.logo.file, /^assets\/logo-1.*\.svg$/);
  assert.ok(brand.logo.alternatives.length >= 1, "alternative logos");
  assert.ok(capture.files.assets.includes("assets/favicon.svg"), `favicon saved: ${capture.files.assets}`);
  assert.ok(capture.files.assets.includes("assets/apple-touch-icon.png"), "apple-touch-icon saved");
  assert.ok(capture.files.assets.includes("assets/og-image.png"), "og image saved");
  assert.ok(!capture.files.assets.some((f) => /^assets\/logo-\d+-/.test(f)), "data: logos carry no name hint");
  for (const file of capture.files.assets) assert.ok(statSync(join(dir, file)).size > 0, file);
  const svg = readFileSync(join(dir, brand.logo.file), "utf8");
  assert.match(svg, /^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /#7C3AED/i);

  assert.equal(brand.colors.primary, "#7C3AED");
  assert.equal(brand.colors.background, "#FFFFFF");
  assert.equal(brand.colors.text, "#1F2937");
  assert.ok(brand.colors.palette.length >= 4, JSON.stringify(brand.colors.palette));
  assert.ok(brand.colors.palette.some((c) => c.hex === "#111827" && c.source === "background"), "the dark sections");
  assert.ok(brand.colors.palette.some((c) => c.hex === "#F5F3FF"), "the light hero");

  assert.equal(brand.fonts.headline, "Marca Display");
  assert.equal(brand.fonts.body, "Inter");
  assert.ok(brand.fonts.faces.some((f) => f.family === "Marca Display" && /fonts\/marca-display\.woff2$/.test(f.src[0] ?? "")), JSON.stringify(brand.fonts.faces));

  const ctaTexts = brand.cta.map((c) => c.text);
  assert.ok(ctaTexts.includes("Agendar avaliação"), ctaTexts.join(" | "));
  assert.ok(ctaTexts.includes("Falar no WhatsApp"));
  assert.ok(!ctaTexts.includes("Aceitar"), "the cookie button is not a CTA once dismissed");
  const agendar = brand.cta.find((c) => c.text === "Agendar avaliação");
  assert.equal(agendar.background, "#7C3AED");
  assert.equal(agendar.color, "#FFFFFF");

  assert.ok(brand.numbers.some((n) => n.text === "+2.000" || n.text === "+2.000 clientes"), JSON.stringify(brand.numbers));
  assert.ok(brand.numbers.some((n) => n.text === "97%"), "97%");
  assert.ok(brand.numbers.some((n) => n.text === "15 anos"), "15 anos");

  assert.ok(brand.prices.length >= 2, JSON.stringify(brand.prices));
  const laser = brand.prices.find((p) => p.value === 199);
  assert.ok(laser, "R$ 199");
  assert.equal(laser.product, "Clareamento a laser");
  assert.ok(brand.prices.some((p) => p.value === 89.9 && p.product === "Plano família"), JSON.stringify(brand.prices));

  assert.equal(brand.social.instagram, "https://www.instagram.com/sorrisopleno");
  assert.equal(brand.social.youtube, "https://www.youtube.com/@sorrisopleno");
  assert.match(brand.social.whatsapp, /wa\.me\/5541999998888/);
  assert.equal(brand.social.facebook, undefined, "the share link is not a profile");
  assert.deepEqual(brand.contacts.emails, ["contato@sorrisopleno.com.br"]);
  assert.deepEqual(brand.contacts.phones, ["+554133334444"]);
  assert.deepEqual(brand.contacts.whatsapp, ["5541999998888"]);

  assert.equal(brand.sector_cues[0].sector, "odontologia", JSON.stringify(brand.sector_cues));
  assert.equal(brand.language.declared, "pt-BR");
  assert.equal(brand.language.detected, "pt");
  assert.equal(brand.has_login_area, true);
  assert.ok(brand.nav.includes("Tratamentos") && brand.nav.includes("Planos"), brand.nav.join(" | "));
  assert.ok(brand.word_count > 150, String(brand.word_count));
  assert.deepEqual(brand.jsonld_types, ["Dentist"]);
  assert.equal(brand.address, "Rua das Flores, 100, Curitiba, PR");

  // the cookie banner
  assert.equal(capture.cookie_banner.desktop.dismissed, true);
  assert.equal(capture.cookie_banner.desktop.button, "Aceitar");
  assert.equal(capture.cookie_banner.desktop.hidden_after_click, true);
  assert.ok([null, 200].includes(capture.http_status), `a local file has no real HTTP status (${capture.http_status})`);
  assert.equal(capture.wall.blocked, false);

  // the scroll recordings need ffmpeg
  if (tools.ffmpeg) {
    assert.equal(capture.files.scroll_mobile, "rolagem-mobile.mp4");
    assert.equal(capture.files.scroll_desktop, "rolagem-desktop.mp4");
    assert.ok(statSync(join(dir, "rolagem-mobile.mp4")).size > 1000);
    assert.ok(statSync(join(dir, "rolagem-desktop.mp4")).size > 1000);
    assert.equal(capture.scroll.mobile.frames, 30);
    assert.equal(capture.scroll.mobile.fps, 15);
    assert.equal(capture.scroll.desktop.frames, 30);
    assert.ok(capture.scroll.mobile.max_scroll >= 1000, String(capture.scroll.mobile.max_scroll));
  } else {
    assert.equal(capture.files.scroll_mobile, null);
    assert.ok(capture.warnings.some((w) => /ffmpeg/.test(w)));
  }
  assert.ok(messages.some((m) => /Lendo a página/.test(m)), messages.join("\n"));
  assert.ok(!capture.warnings.some((w) => /Parte da leitura falhou/.test(w)), capture.warnings.join("\n"));
});

test("captureSite reports unreachable sites and invalid addresses with stable codes", { skip: noBrowser, timeout: 120000 }, async () => {
  const dir = fresh("unreachable");
  await assert.rejects(
    captureSite({ url: "https://nao-existe-de-jeito-nenhum-flyee.invalid/", outDir: dir, tools, scrollSeconds: 0, assets: false }),
    (error) => error.code === "site_unreachable" && /nao-existe-de-jeito-nenhum-flyee\.invalid/.test(error.message),
  );
  await assert.rejects(captureSite({ url: "ftp://x.com", outDir: dir, tools }), (error) => error.code === "invalid_url");
  await assert.rejects(
    captureSite({ url: fileUrl(join(dir, "nao-existe.html")), outDir: dir, tools, scrollSeconds: 0, assets: false }),
    (error) => error.code === "site_unreachable" && /arquivo não existe/.test(error.message),
  );
});

// ---------------------------------------------------------------------------------------------
// The command, as the member's AI runs it
// ---------------------------------------------------------------------------------------------

test("capture command: the fixture through render.mjs with --json", { skip: noBrowser, timeout: 240000 }, async () => {
  const dir = fresh("command");
  const result = await cli(["capture", fileUrl(FIXTURE), "--out", dir, "--scroll", "1", "--fps", "10"]);
  assert.equal(result.code, 0, result.stdout + result.stderr);
  const r = result.json;
  assert.equal(r.ok, true);
  assert.equal(r.command, "capture");
  assert.equal(r.interface_version, 1);
  assert.equal(r.app.name, "video-render");
  assert.equal(r.site, "index.html");
  assert.equal(r.brand.name, "Sorriso Pleno");
  assert.equal(r.brand.colors.primary, "#7C3AED");
  assert.ok(existsSync(join(dir, "captura.json")));
  assert.ok(existsSync(join(dir, "desktop.png")));
  assert.equal(r.files.desktop, "desktop.png");
  assert.equal(r.cookie_banner, "Aceitar");
  assert.ok(r.dir.endsWith("command"), r.dir);
  if (tools.ffmpeg) {
    assert.equal(r.scroll.mobile.frames, 10);
    assert.equal(r.scroll.desktop.frames, 20);
  }
  // stdout carried only the JSON; progress went to stderr
  assert.match(result.stderr, /Lendo a página/);

  const usage = await cli(["capture"]);
  assert.equal(usage.code, 2);
  assert.equal(usage.json.error.code, "usage");
  const invalid = await cli(["capture", "ftp://x.com", "--out", dir]);
  assert.equal(invalid.code, 1);
  assert.equal(invalid.json.error.code, "invalid_url");
  const badOption = await cli(["capture", "https://example.com", "--scroll", "99", "--out", dir]);
  assert.equal(badOption.json.error.code, "usage");
});

test("capture command against https://example.com (reported, not required: the network may be off)", { skip: noBrowser, timeout: 120000 }, async (t) => {
  const dir = fresh("example");
  const result = await cli(["capture", "https://example.com", "--out", dir, "--scroll", "0", "--no-assets"]);
  if (!result.json?.ok) {
    t.diagnostic(`example.com not captured: ${result.json?.error?.code ?? result.code} ${result.json?.error?.message ?? result.stderr.slice(-300)}`);
    assert.ok(result.json && ["site_unreachable", "site_blocked", "capture_failed", "browser_timeout"].includes(result.json.error.code), result.stdout + result.stderr);
    return;
  }
  const r = result.json;
  assert.equal(r.brand.headline, "Example Domain");
  assert.equal(r.http_status, 200);
  assert.equal(r.files.scroll_mobile, null);
  assert.deepEqual(r.files.assets, []);
  assert.ok(existsSync(join(dir, "desktop.png")));
  assert.ok(existsSync(join(dir, "mobile-full.png")));
  t.diagnostic(`example.com captured in ${r.elapsed_s} s: ${JSON.stringify(r.brand.colors)}`);
});
