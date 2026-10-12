// The `capture` command: visits a site and saves its screens, scroll recordings and brand sheet.
// Loaded by render.mjs as a command group; the capture itself lives in ../lib/capture.mjs.

import { join, resolve } from "node:path";

import { captureSite, hostSlug, normalizeUrl } from "../lib/capture.mjs";
import { checkTools } from "../lib/tools.mjs";
import { parseNumber, round, usage } from "../lib/util.mjs";

export const argSpec = {
  flags: ["no-assets"],
  options: ["mobile", "desktop", "scroll"],
};

export const help = `Opções de capture
  --out <pasta>                  Onde gravar (padrão: capturas/<site>/ na raiz do projeto).
  --mobile <px> --desktop <px>   Larguras do celular (390) e do computador (1440).
  --scroll <s>                   Segundos da rolagem gravada no celular (padrão: 6; 0 desliga); o computador grava dois terços disso.
  --fps <n>                      Quadros por segundo das rolagens (padrão: 30).
  --no-assets                    Não guarda logo, ícones e imagem de compartilhamento em assets/.
  --browser <caminho>            Outro navegador (Edge, Chrome ou Chromium).`;

function describeScroll(scroll) {
  const parts = [];
  if (scroll?.mobile) parts.push(`celular ${scroll.mobile.seconds} s`);
  if (scroll?.desktop) parts.push(`computador ${scroll.desktop.seconds} s`);
  return parts.length ? `rolagem (${parts.join(", ")})` : "sem rolagem";
}

export const commands = {
  capture: {
    summary: "Visita um site e guarda telas, rolagem, logo, cores, fontes, textos e números em capturas/<site>/.",
    help,
    async run(positionals, values, ctx) {
      if (positionals.length !== 1) throw usage("Informe o endereço: capture <url> [--out <pasta>].");
      const url = normalizeUrl(positionals[0]);
      const mobileWidth = parseNumber(values.mobile, { name: "mobile", min: 280, max: 1080, integer: true, fallback: 390 });
      const desktopWidth = parseNumber(values.desktop, { name: "desktop", min: 800, max: 3840, integer: true, fallback: 1440 });
      const scrollSeconds = parseNumber(values.scroll, { name: "scroll", min: 0, max: 30, fallback: 6 });
      const fps = parseNumber(values.fps, { name: "fps", min: 5, max: 60, integer: true, fallback: 30 });
      const outDir = values.out ? resolve(process.cwd(), values.out) : join(ctx.root, "capturas", hostSlug(url));
      // ffmpeg is optional here (only the scroll videos need it); the browser is required and
      // Browser.launch reports browser_missing with the install step when there is none.
      const tools = await checkTools();
      const started = Date.now();
      const capture = await captureSite({
        url,
        outDir,
        tools,
        browserPath: values.browser ?? null,
        mobileWidth,
        desktopWidth,
        scrollSeconds,
        fps,
        assets: !values["no-assets"],
        onProgress: ctx.progress,
      });
      return {
        url: capture.url,
        final_url: capture.final_url,
        site: capture.site,
        http_status: capture.http_status,
        dir: ctx.rel(outDir),
        capture_file: ctx.rel(join(outDir, "captura.json")),
        files: capture.files,
        viewports: capture.viewports,
        scroll: capture.scroll,
        brand: capture.brand,
        cookie_banner: capture.cookie_banner?.desktop?.dismissed ? capture.cookie_banner.desktop.button : null,
        elapsed_s: round((Date.now() - started) / 1000, 1),
        warnings: capture.warnings,
      };
    },
    text(result) {
      const brand = result.brand ?? {};
      const screens = ["desktop", "desktop_full", "mobile", "mobile_full"].filter((key) => result.files?.[key]).length;
      const networks = Object.keys(brand.social ?? {});
      const parts = [
        brand.logo ? `logo (${brand.logo.file})` : "sem logo",
        `${brand.colors?.palette?.length ?? 0} cores${brand.colors?.primary ? ` (principal ${brand.colors.primary})` : ""}`,
        `${screens} telas`,
        describeScroll(result.scroll),
        `${brand.numbers?.length ?? 0} números`,
        `${brand.prices?.length ?? 0} preços`,
        `redes: ${networks.length ? networks.join(", ") : "nenhuma"}`,
      ];
      const lines = [
        `Capturei ${result.site}${brand.name ? ` (${brand.name})` : ""}: ${parts.join(", ")}.`,
        brand.headline ? `Título: ${brand.headline}` : null,
        brand.fonts?.headline || brand.fonts?.body ? `Fontes: ${[brand.fonts.headline, brand.fonts.body].filter(Boolean).join(" / ")}` : null,
        `Pasta: ${result.dir} (tudo em ${result.capture_file}) em ${result.elapsed_s} s.`,
        ...(result.warnings ?? []).map((warning) => `Aviso: ${warning}`),
      ];
      return lines.filter(Boolean).join("\n");
    },
  },
};
