// The `film` command: films one part of a live page, in real time, as sheets of frames. Loaded by
// render.mjs as a command group; the filming itself lives in ../lib/film.mjs.

import { join, resolve } from "node:path";

import { hostSlug, normalizeUrl } from "../lib/capture.mjs";
import { filmPage } from "../lib/film.mjs";
import { parseNumber, round, usage } from "../lib/util.mjs";

export const argSpec = {
  flags: [],
  options: ["select", "count"],
};

export const help = `Opções de film
  <endereço>                     Uma página rodando (http://localhost:3000, https://www.exemplo.com.br) ou um arquivo .html.
  --select <seletor>             O elemento filmado, como [data-demo]. Sem ele, a primeira tela.
  --every <s>                    Segundos entre dois quadros (padrão: 1; mínimo: 0,25).
  --count <n>                    Quadros no computador e no celular (padrão: 16; máximo: 60). Com menos movimento, 3.
  --out <pasta>                  Onde gravar (padrão: filmes/<site>/ na raiz do projeto).
  --browser <caminho>            Outro navegador (Edge, Chrome ou Chromium).`;

export const commands = {
  film: {
    summary: "Filma uma parte de uma página rodando, em tempo real, no computador, no celular e com menos movimento, e monta uma folha de quadros de cada.",
    help,
    async run(positionals, values, ctx) {
      if (positionals.length !== 1) throw usage("Informe o endereço: film <url> [--select <seletor>] [--out <pasta>].");
      const url = normalizeUrl(positionals[0]);
      const everySeconds = parseNumber(values.every, { name: "every", min: 0.25, max: 10, fallback: 1 });
      const count = parseNumber(values.count, { name: "count", min: 1, max: 60, integer: true, fallback: 16 });
      const outDir = values.out ? resolve(process.cwd(), values.out) : join(ctx.root, "filmes", hostSlug(url));
      const started = Date.now();
      const film = await filmPage({ input: positionals[0], select: values.select ?? null, everySeconds, count, outDir, browserPath: values.browser ?? null, onProgress: ctx.progress });
      return {
        url: film.url,
        select: film.select,
        mode: film.mode,
        every_s: film.every_s,
        dir: ctx.rel(outDir),
        film_file: ctx.rel(join(outDir, "filme.json")),
        sheets: film.sheets.map((sheet) => ctx.rel(join(outDir, sheet))),
        passes: film.passes,
        elapsed_s: round((Date.now() - started) / 1000, 1),
        warnings: film.warnings,
      };
    },
    text(result) {
      const lines = Object.values(result.passes).map((pass) => (pass.visible ? `${pass.label}: ${pass.frames} quadros, ${pass.changes} mudanças, parado por até ${String(pass.longest_still_s).replace(".", ",")} s.` : `${pass.label}: a cena não aparece.`));
      return [...lines, `Folhas: ${result.sheets.join(", ")}`, ...(result.warnings ?? []).map((warning) => `Aviso: ${warning}`)].join("\n");
    },
  },
};
