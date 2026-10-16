// Estúdio de vídeo, the script: the pure pieces (the Motor's command lines, the brand kit, the
// roteiro, the project files) with synthetic data; then the commands in scratch projects, as the
// member's AI runs them, against a stand-in Motor de vídeo that speaks the Motor's interface,
// writes stand-in files and logs every call (tests/fixtures/engine); and, when ffmpeg, a browser
// and the app's page templates are all there, one whole video through the real Motor.
//
// The brief's logic (scripts/lib/intake.mjs, references/perguntas.json) and the page templates
// (runtime/) belong to other parts of the app. The commands are tested with the real brief logic
// (the project tests are skipped, saying why, when it is missing); a template or studio.js that is
// missing is replaced in the scratch project by a minimal page, since these tests render nothing.
// The run through the real Motor is opt-in: STUDIO_TEST_REAL=1.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  brandSlug,
  contrast,
  findKit,
  findProjectSite,
  fontsFor,
  handleFrom,
  hostOf,
  hostSlug,
  kitAgeDays,
  kitFromCapture,
  listKits,
  luminance,
  NEUTRAL_PALETTE,
  paletteFor,
  parseNumberText,
  readKit,
  siteUrl,
  writeKit,
} from "../scripts/lib/brand.mjs";
import { engineArgs, engineSupports, findVideoRender, parseEngineOutput, requireVideoRender, runEngine } from "../scripts/lib/engine.mjs";
import { adoptAssets, freeSlug, injectRoteiro, layout, notesMarkdown, readRoteiroBlock, README_TEXT, roteiroJson, scanMaterials, slugOf, suggestPost, writeState } from "../scripts/lib/project.mjs";
import {
  allocateBars,
  assetTargets,
  beatGrid,
  countWords,
  deadlineFrom,
  defaultEvents,
  draftRoteiro,
  eventsFile,
  formatNumber,
  formatPrice,
  kindFor,
  offerFrom,
  onScreenTexts,
  productText,
  sceneSummary,
  scrollToHeading,
  solveTiming,
  timeline,
  trimWords,
  validateRoteiro,
} from "../scripts/lib/roteiro.mjs";
import { AppError } from "../scripts/lib/util.mjs";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(TESTS_DIR, "..");
const MODULES_DIR = resolve(APP_DIR, "..");
const ENGINE_DIR = join(MODULES_DIR, "video-render");
const FIXTURES = join(TESTS_DIR, "fixtures");
const SCRIPT = "node .flyee/modules/video-studio/scripts/studio.mjs";
const TEMPLATE_IDS = ["lancamento", "interface", "oferta", "lista", "passos"];
const REAL_INTAKE =
  existsSync(join(APP_DIR, "scripts", "lib", "intake.mjs")) &&
  existsSync(join(APP_DIR, "scripts", "lib", "request.mjs")) &&
  existsSync(join(APP_DIR, "references", "perguntas.json"));
const REAL_TEMPLATES = TEMPLATE_IDS.filter((id) => existsSync(join(APP_DIR, "runtime", "templates", `${id}.html`)));
const REAL_STUDIO = existsSync(join(APP_DIR, "runtime", "studio.js"));

const TEMPLATES = JSON.parse(readFileSync(join(APP_DIR, "references", "roteiros.json"), "utf8"));
const CAPTURA = JSON.parse(readFileSync(join(FIXTURES, "engine", "captura.json"), "utf8"));

const clone = (value) => structuredClone(value);
const patch = (value, change) => {
  const copy = clone(value);
  change(copy);
  return copy;
};
const readJsonFile = (path) => JSON.parse(readFileSync(path, "utf8"));
const sum = (list) => list.reduce((total, n) => total + n, 0);

/** A scratch folder whose name has a space and accents: every path the script builds must survive it. */
function scratch(t, prefix = "flyee estúdio ação ") {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  // best effort: on Windows a scanner or a child that has just exited can hold the folder for a moment
  t.after(() => {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch {
      // the system cleans its temporary folder
    }
  });
  return dir;
}

/** Copies a folder file by file: fs.cpSync on Node 24 for Windows mangles a destination with accents. */
function copyDir(source, destination, skip = []) {
  mkdirSync(destination, { recursive: true });
  for (const name of readdirSync(source)) {
    if (skip.includes(name)) continue;
    const from = join(source, name);
    const to = join(destination, name);
    if (statSync(from).isDirectory()) copyDir(from, to, skip);
    else copyFileSync(from, to);
  }
}

const listFiles = (dir, base = dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? listFiles(path, base) : [path.slice(base.length + 1).replace(/\\/g, "/")];
      })
    : [];

/* ------------------------------------------------------------------ */
/* Sample data                                                        */
/* ------------------------------------------------------------------ */

const KIT = kitFromCapture(CAPTURA, { foundBy: "pedido", now: "2026-10-07T12:00:00.000Z", captureDir: "capturas/sorrisopleno-com-br" });
const field = (value, source = "pedido") => ({ value, source, evidence: "" });

/** A brief with every field decided, as it reaches `build`. */
function briefState(over = {}) {
  return {
    format_version: 1,
    slug: "sorrisopleno-lancamento",
    request: "Faça um vídeo animado da Sorriso Pleno",
    mode: "complete",
    fields: {
      brand: field({ name: "Sorriso Pleno", site: "https://www.sorrisopleno.com.br", handle: null }),
      objective: field("apresentar"),
      subject: field("marca em geral", "padrao"),
      destinations: field(["reels", "tiktok", "shorts"], "padrao"),
      duration: field(15, "padrao"),
      template: field("lancamento", "padrao"),
      points: field(["Implantes dentários", "Clareamento a laser", "Alinhadores invisíveis"], "captura"),
      hook: field("Seu sorriso novo em 90 dias", "captura"),
      proof: field({ text: "+2.000 clientes atendidos em Curitiba", value: 2000, source: "sorrisopleno.com.br (página inicial, 2026-10-07)" }, "captura"),
      tone: field("confianca", "padrao"),
      style: field("interface-narra", "padrao"),
      music: field({ mode: "music", style: "energetic", file: null }, "padrao"),
      closing: field({ kind: "site", text: "sorrisopleno.com.br" }, "padrao"),
      skip_preview: field(false, "padrao"),
      ...over,
    },
  };
}

const SAMPLE = draftRoteiro(briefState(), KIT, TEMPLATES);

test("scrollToHeading brings each point's section into view, and a point with no heading keeps the default", () => {
  const layoutOf = { full_height: 4000, viewport_height: 844, headings: [{ text: "Seu sorriso novo em 90 dias", y: 120 }, { text: "Implantes dentários", y: 1000 }, { text: "Clareamento a laser", y: 1400 }, { text: "Planos e valores", y: 2600 }, { text: "Clareamento a laser", y: 2800 }] };
  const expected = (y) => Math.round(((y + 0.35 * 844) / 4000) * 1000) / 1000;
  assert.equal(scrollToHeading(layoutOf, "Implantes dentários"), expected(1000));
  assert.equal(scrollToHeading(layoutOf, "Clareamento a laser"), expected(1400), "the first heading with the same words wins: the service, not the price table");
  assert.equal(scrollToHeading(layoutOf, "Implantes"), expected(1000), "the point names the section with fewer words");
  assert.equal(scrollToHeading(layoutOf, "Implantes de alta tecnologia em Curitiba"), null, "one shared word out of four is not the same section");
  assert.equal(scrollToHeading(layoutOf, "Planos e valores do mês"), expected(2600), "most of the words is enough");
  assert.equal(scrollToHeading(layoutOf, "Alinhadores invisíveis"), null);
  assert.equal(scrollToHeading(null, "Implantes dentários"), null);
  assert.equal(scrollToHeading({ full_height: 1000, viewport_height: 844, headings: [{ text: "E aí?", y: 990 }] }, "E aí, tudo certo"), null, "words of one or two letters do not count");
  assert.equal(scrollToHeading({ full_height: 1000, viewport_height: 844, headings: [{ text: "Rodapé final", y: 990 }] }, "Rodapé final"), 1, "never past the end");

  const withLayout = { ...KIT, screens: { ...KIT.screens, mobile_full: "capturas/sorrisopleno-com-br/mobile-full.png" }, layout: layoutOf };
  const draft = draftRoteiro(briefState({ points: field(["Implantes dentários", "Clareamento a laser", "Alinhadores invisíveis"], "captura") }), withLayout, TEMPLATES);
  const points = draft.scenes.filter((scene) => scene.role === "ponto");
  assert.deepEqual(points.map((scene) => scene.scroll ?? null), [expected(1000), expected(1400), null], "the page scrolls to each point's own section");
  assert.equal(validateRoteiro(draft, TEMPLATES).ok ?? true, true);
});

/* ------------------------------------------------------------------ */
/* The bridge to the Motor                                            */
/* ------------------------------------------------------------------ */

test("engineArgs builds the Motor's command lines exactly", () => {
  const page = "estudio-de-video/demo/pagina.html";
  assert.deepEqual(engineArgs.check(), ["check"]);
  assert.deepEqual(engineArgs.help(), ["help"]);
  assert.deepEqual(engineArgs.capture({ url: "https://lojax.com.br", out: "capturas/lojax-com-br" }), ["capture", "https://lojax.com.br", "--out", "capturas/lojax-com-br"]);
  assert.deepEqual(
    engineArgs.music({ out: "estudio-de-video/demo/audio/trilha.wav", duration: 15, bpm: 128, style: "energetic", seed: 7 }),
    ["music", "--out", "estudio-de-video/demo/audio/trilha.wav", "--duration", "15", "--bpm", "128", "--style", "energetic", "--seed", "7", "--arc", "auto"],
  );
  assert.deepEqual(engineArgs.music({ out: "t.wav", duration: 12, bpm: 120, style: "clean", seed: 1, arc: "flat", loop: true }).slice(-3), ["--arc", "flat", "--loop"]);
  assert.deepEqual(engineArgs.synth({ out: "t.wav", bpm: 120, bars: 8, style: "pulse", seed: 3 }), ["synth", "--out", "t.wav", "--bpm", "120", "--bars", "8", "--style", "pulse", "--seed", "3"]);
  assert.deepEqual(engineArgs.beats({ input: "estudio-de-video/demo/materiais/minha música.mp3", out: "estudio-de-video/demo/audio/trilha.beats.json" }), ["beats", "estudio-de-video/demo/materiais/minha música.mp3", "--out", "estudio-de-video/demo/audio/trilha.beats.json"]);
  assert.deepEqual(engineArgs.sfx({ out: "a/efeitos.wav", events: "a/eventos.json", duration: 15 }), ["sfx", "--out", "a/efeitos.wav", "--events", "a/eventos.json", "--duration", "15"]);
  assert.deepEqual(engineArgs.preview({ page, out: "r/previa-sem-som.mp4", format: "9:16", fps: 30 }), ["preview", page, "--out", "r/previa-sem-som.mp4", "--format", "9:16", "--fps", "30", "--scale", "0.5"]);
  assert.deepEqual(engineArgs.render({ page, out: "r/final-sem-som.mp4", format: "9:16", fps: 30, sub: 2 }), ["render", page, "--out", "r/final-sem-som.mp4", "--format", "9:16", "--fps", "30", "--sub", "2"]);
  assert.deepEqual(engineArgs.render({ page, out: "r/x.mp4", format: "9:16", fps: 30 }), ["render", page, "--out", "r/x.mp4", "--format", "9:16", "--fps", "30"]);
  assert.deepEqual(engineArgs.frames({ page, out: "p/quadros", beats: "a/batidas.json", scale: 0.5, format: "9:16" }), ["frames", page, "--out", "p/quadros", "--format", "9:16", "--beats", "a/batidas.json", "--scale", "0.5"]);
  assert.deepEqual(engineArgs.frames({ page, out: "e/capa-quadro", times: [0], format: "9:16" }), ["frames", page, "--out", "e/capa-quadro", "--format", "9:16", "--times", "0"]);
  assert.deepEqual(engineArgs.frames({ page, out: "q", times: [0, 1.5, 3], format: "9:16" }).slice(-2), ["--times", "0,1.5,3"]);
  assert.deepEqual(
    engineArgs.mix({ video: "r/v.mp4", out: "p/previa.mp4", music: "a/trilha.wav", sfx: "a/efeitos.wav", fadeOut: 0.4 }),
    ["mix", "--video", "r/v.mp4", "--out", "p/previa.mp4", "--music", "a/trilha.wav", "--sfx", "a/efeitos.wav", "--fade-out", "0.4", "--tp", "-1.5"],
  );
  assert.deepEqual(engineArgs.mix({ video: "v.mp4", out: "o.mp4", sfx: "s.wav", fadeOut: 0 }), ["mix", "--video", "v.mp4", "--out", "o.mp4", "--sfx", "s.wav", "--fade-out", "0", "--tp", "-1.5"]);
  assert.deepEqual(engineArgs.mix({ video: "v.mp4", out: "o.mp4", music: "m.mp3", musicOffset: 0.25, fadeOut: 0.4 }), ["mix", "--video", "v.mp4", "--out", "o.mp4", "--music", "m.mp3", "--music-offset", "0.25", "--fade-out", "0.4", "--tp", "-1.5"]);
  assert.deepEqual(
    engineArgs.accept({ page, format: "9:16", beats: "a/batidas.json", video: "p/previa.mp4" }),
    ["accept", page, "--format", "9:16", "--safe", "instagram-feed", "--beats", "a/batidas.json", "--video", "p/previa.mp4"],
  );
  assert.deepEqual(engineArgs.accept({ page, format: "9:16", bpm: 128 }), ["accept", page, "--format", "9:16", "--safe", "instagram-feed", "--bpm", "128"]);
  assert.deepEqual(engineArgs.accept({ page, format: "9:16", beats: "b.json", video: "v.mp4", networks: ["reels", "tiktok", "shorts"] }).slice(-2), ["--networks", "reels,tiktok,shorts"]);
  assert.ok(!engineArgs.accept({ page, format: "9:16", beats: "b.json", networks: [] }).includes("--networks"));
  assert.deepEqual(engineArgs.probe({ file: "e/demo.mp4" }), ["probe", "e/demo.mp4"]);
});

test("parseEngineOutput reads the JSON and turns the Motor's failures into AppErrors", () => {
  assert.deepEqual(parseEngineOutput('{"ok":true,"command":"check","modes":{"render":true}}\n', ""), { ok: true, command: "check", modes: { render: true } });
  assert.equal(parseEngineOutput('ruído antes\n{"ok":true,"file":"x"}', "").file, "x", "text before the JSON is ignored");
  assert.throws(
    () => parseEngineOutput('{"ok":false,"command":"capture","error":{"code":"site_blocked","message":"O site não deixou entrar.","fix":"Peça as telas."}}', ""),
    (error) => error instanceof AppError && error.code === "site_blocked" && error.message === "O site não deixou entrar." && error.fix === "Peça as telas.",
  );
  assert.throws(() => parseEngineOutput("", "TypeError: boom\n    at x", { code: 1, command: "music" }), (error) => error.code === "video_render_failed" && /music/.test(error.message) && /boom/.test(error.fix));
  assert.throws(() => parseEngineOutput("{not json", "", { code: 0 }), (error) => error.code === "video_render_failed");
});

test("runEngine runs the Motor without a shell, passes progress through; engineSupports reads the help once", async (t) => {
  const dir = scratch(t);
  const ok = join(dir, "motor ok.mjs");
  writeFileSync(ok, 'import { appendFileSync } from "node:fs"; appendFileSync("chamadas.txt", process.argv[2] + "\\n"); process.stderr.write("Render: 1/2\\nRender: 2/2\\n"); process.stdout.write(JSON.stringify({ ok: true, command: process.argv[2], args: process.argv.slice(3), cwd: process.cwd(), text: "Opções de accept\\n  --networks reels,tiktok  Por rede.\\n  --video <mp4>" }) + "\\n");');
  const lines = [];
  const result = await runEngine({ script: ok }, ["render", "página com espaço.html", "--out", "saída/x.mp4"], { root: dir, onLine: (line) => lines.push(line) });
  assert.deepEqual(result.args, ["página com espaço.html", "--out", "saída/x.mp4", "--json"], "arguments arrive whole, and --json is appended");
  assert.equal(resolve(result.cwd), resolve(dir), "runs from the project root");
  assert.deepEqual(lines, ["Render: 1/2", "Render: 2/2"]);
  assert.equal(await engineSupports({ script: ok }, "--networks", { root: dir }), true);
  assert.equal(await engineSupports({ script: ok }, "--video", { root: dir }), true);
  assert.equal(await engineSupports({ script: ok }, "--network", { root: dir }), false, "a prefix of an option is not the option");
  assert.equal(await engineSupports({ script: ok }, "--captions", { root: dir }), false);
  assert.equal(readFileSync(join(dir, "chamadas.txt"), "utf8").split("\n").filter((line) => line === "help").length, 1, "help is read once per run");
  const bad = join(dir, "bad.mjs");
  writeFileSync(bad, 'process.stdout.write(JSON.stringify({ ok: false, command: "render", error: { code: "page_error", message: "A página deu erro.", fix: "Corrija." } })); process.exit(1);');
  await assert.rejects(runEngine({ script: bad }, ["render"], { root: dir, onLine: () => {} }), (error) => error instanceof AppError && error.code === "page_error" && error.fix === "Corrija.");
  const crash = join(dir, "crash.mjs");
  writeFileSync(crash, 'process.stderr.write("TypeError: boom\\n"); process.exit(1);');
  await assert.rejects(runEngine({ script: crash }, ["check"], { root: dir, onLine: () => {} }), (error) => error.code === "video_render_failed" && /boom/.test(error.fix));
  assert.equal(await engineSupports({ script: crash }, "--networks", { root: dir }), false, "a Motor without help supports nothing extra");
});

/** The Motor is another app: what it declares goes to the member first, the install waits for the yes. */
const ENGINE_DRY_RUN = "npx --yes flyee@latest add video-render --dry-run --json";
const ENGINE_INSTALL = "npx --yes flyee@latest add video-render --yes --json";
const ENGINE_FIX = `Rode você mesmo ${ENGINE_DRY_RUN}, diga ao integrante numa frase o que o Motor de vídeo declara e, com o sim dele, rode ${ENGINE_INSTALL} com tempo limite de 10 minutos; depois repita.`;

test("findVideoRender and requireVideoRender", (t) => {
  const root = scratch(t);
  assert.equal(findVideoRender(root).installed, false);
  assert.throws(() => requireVideoRender(root), (error) => error.code === "video_render_missing" && error.fix === ENGINE_FIX);
  const dir = join(root, ".flyee", "modules", "video-render");
  mkdirSync(join(dir, "scripts"), { recursive: true });
  writeFileSync(join(dir, "scripts", "render.mjs"), "");
  writeFileSync(join(dir, "flyee.module.json"), JSON.stringify({ name: "video-render", version: "1.2.3" }));
  const found = findVideoRender(root);
  assert.equal(found.installed, true);
  assert.equal(found.version, "1.2.3");
  assert.equal(found.command, "node .flyee/modules/video-render/scripts/render.mjs");
  assert.throws(() => requireVideoRender(root), (error) => error.code === "video_render_missing" && /motion\.js/.test(error.message), "an install without the runtime is incomplete");
  mkdirSync(join(dir, "runtime"), { recursive: true });
  writeFileSync(join(dir, "runtime", "motion.js"), "");
  assert.equal(requireVideoRender(root).runtime, join(dir, "runtime", "motion.js"));
});

/* ------------------------------------------------------------------ */
/* The brand kit                                                      */
/* ------------------------------------------------------------------ */

test("kitFromCapture maps a real-shaped captura.json into the brand kit", () => {
  const kit = KIT;
  assert.equal(kit.format_version, 1);
  assert.equal(kit.slug, "sorrisopleno");
  assert.equal(kit.name, "Sorriso Pleno");
  assert.equal(kit.site, "https://www.sorrisopleno.com.br");
  assert.equal(kit.host, "sorrisopleno.com.br");
  assert.equal(kit.handle, "@sorrisopleno", "the handle comes from the Instagram link");
  assert.equal(kit.captured_at, CAPTURA.captured_at);
  assert.equal(kit.capture_dir, "capturas/sorrisopleno-com-br");
  assert.equal(kit.found_by, "pedido");
  assert.equal(kit.confirmed, true);
  assert.equal(kit.headline, "Seu sorriso novo em 90 dias");
  assert.match(kit.description, /^Implantes, clareamento/);
  assert.equal(kit.colors.primary, "#7C3AED");
  assert.equal(kit.colors.background, "#FFFFFF");
  assert.equal(kit.colors.text, "#1F2937");
  assert.deepEqual(kit.colors.palette.find((entry) => entry.hex === "#7C3AED"), { hex: "#7C3AED", role: "botões", share: 0.087 });
  assert.equal(kit.colors.palette.find((entry) => entry.hex === "#FFFFFF").role, "fundo", "one entry per colour, the heavier role wins");
  assert.equal(kit.colors.palette.filter((entry) => entry.hex === "#FFFFFF").length, 1);
  assert.equal(kit.fonts.headline, "Marca Display");
  assert.equal(kit.fonts.body, "Inter");
  assert.deepEqual(kit.logo, { file: "capturas/sorrisopleno-com-br/assets/logo-1.svg", source: "cabeçalho do site", width: 44, height: 44, alternatives: [] });
  assert.deepEqual(kit.screens, {
    mobile: "capturas/sorrisopleno-com-br/mobile.png",
    mobile_full: "capturas/sorrisopleno-com-br/mobile-full.png",
    desktop: "capturas/sorrisopleno-com-br/desktop.png",
    desktop_full: "capturas/sorrisopleno-com-br/desktop-full.png",
  });
  assert.deepEqual(kit.sections, ["Implantes dentários", "Clareamento a laser", "Alinhadores invisíveis", "Planos e valores", "Quem já passou por aqui", "Agende sua avaliação gratuita"], "the sections are the page's h2 list");
  assert.deepEqual(kit.products, [{ name: "Clareamento a laser", price: "R$ 199", value: 199 }, { name: "Plano família", price: "R$ 89,90", value: 89.9 }]);
  assert.deepEqual(
    kit.numbers.map((number) => [number.text, number.value, number.page]),
    [
      ["garantia de 10 anos na peça protética", 10, "página inicial"],
      ["+2.000 clientes atendidos em Curitiba", 2000, "página inicial"],
      ["97% de aprovação nas avaliações", 97, "página inicial"],
      ["15 anos de experiência clínica", 15, "página inicial"],
    ],
    "a number alone on its line takes the caption under it; one inside a sentence keeps a few words around it",
  );
  assert.deepEqual(kit.cta.slice(0, 3), ["Agendar avaliação", "Agendar avaliação gratuita", "Falar no WhatsApp"]);
  assert.equal(kit.social.instagram, "https://www.instagram.com/sorrisopleno");
  assert.equal(kit.social.whatsapp, "https://wa.me/5541999998888", "WhatsApp comes from the wa.me link, without the message");
  assert.deepEqual(kit.sector_cues, ["odontologia", "saúde"]);
  assert.equal(kit.has_login_area, true);
  assert.deepEqual(kit.decisions, {});
  assert.ok(kit.warnings.some((warning) => /área com login/.test(warning)));
  for (const text of [JSON.stringify(kit)]) assert.ok(!/file:\/\//.test(text), "no local address leaks into the kit");
});

test("kitFromCapture copies the best logo beside the kit and says what the capture did not find", (t) => {
  const root = scratch(t);
  const captureDir = join(root, "capturas", "sorrisopleno-com-br");
  mkdirSync(join(captureDir, "assets"), { recursive: true });
  writeFileSync(join(captureDir, "assets", "logo-1.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
  const kit = kitFromCapture(CAPTURA, { foundBy: "busca", now: "2026-10-07T12:00:00.000Z", root, captureDir });
  assert.equal(kit.logo.file, "estudio-de-video/marcas/sorrisopleno/assets/logo.svg");
  assert.ok(existsSync(join(root, kit.logo.file)));
  assert.equal(kit.confirmed, false, "a brand found by search waits for the member's yes");
  assert.equal(kit.found_by, "busca");
  const file = writeKit(root, kit);
  assert.equal(file, join(root, "estudio-de-video", "marcas", "sorrisopleno", "marca.json"));
  assert.deepEqual(readKit(root, "sorrisopleno"), kit);
  assert.deepEqual(readKit(root, "estudio-de-video/marcas/sorrisopleno/marca.json"), kit, "by the path the state keeps");
  assert.equal(readKit(root, "nenhuma"), null);
  assert.deepEqual(listKits(root).map((item) => [item.slug, item.name, item.site, item.confirmed]), [["sorrisopleno", "Sorriso Pleno", "https://www.sorrisopleno.com.br", false]]);
  assert.equal(findKit(root, { site: "sorrisopleno.com.br/planos" }).slug, "sorrisopleno", "by the host of the site");
  assert.equal(findKit(root, { name: "Sorriso Pleno" }).slug, "sorrisopleno", "by the name");
  assert.equal(findKit(root, { site: "https://outra.com.br" }), null);

  const bare = patch(CAPTURA, (captura) => {
    captura.brand.logo = null;
    captura.brand.colors.primary = null;
    captura.brand.name = null;
    captura.brand.social = {};
    captura.brand.contacts = { emails: [], phones: [], whatsapp: [] };
    captura.raw.headings.h2 = [];
    captura.brand.numbers = [{ text: "12 mil", value: null, unit: "mil", context: "12 mil" }];
  });
  const poor = kitFromCapture(bare, { foundBy: "resposta", now: "2026-10-07T12:00:00.000Z", root, captureDir, name: "Clínica Sorriso" });
  assert.equal(poor.logo, null);
  assert.equal(poor.name, "Clínica Sorriso", "the name the member gave fills what the page does not say");
  assert.equal(poor.colors.primary, null);
  assert.equal(poor.handle, null);
  assert.deepEqual(poor.social, { instagram: null, whatsapp: null });
  assert.deepEqual(poor.sections, ["Tratamentos", "Resultados", "Planos", "Depoimentos", "Área do paciente", "Agendar avaliação"], "without h2, the menu");
  assert.equal(poor.numbers[0].value, 12000, "a number without a parsed value is parsed from its text");
  assert.ok(poor.warnings.some((warning) => /Nenhum logo/.test(warning)));
  assert.ok(poor.warnings.some((warning) => /cor de destaque/.test(warning)));
});

test("numbers, addresses and names", () => {
  assert.deepEqual(parseNumberText("+2.000 clientes"), { value: 2000, prefix: "+", suffix: "", label: "clientes", before: "", raw: "+2.000" });
  assert.equal(parseNumberText("12 mil").value, 12000);
  assert.equal(parseNumberText("+12 mil clientes").value, 12000);
  assert.equal(parseNumberText("+12 mil clientes").label, "clientes");
  assert.deepEqual([parseNumberText("97% de aprovação").value, parseNumberText("97% de aprovação").suffix, parseNumberText("97% de aprovação").label], [97, "%", "de aprovação"]);
  assert.equal(parseNumberText("4,9 estrelas").value, 4.9);
  assert.equal(parseNumberText("1.299,90").value, 1299.9);
  assert.equal(parseNumberText("10k seguidores").value, 10000);
  assert.equal(parseNumberText("1,5 milhão de downloads").value, 1500000);
  assert.deepEqual([parseNumberText("300+ lojas").value, parseNumberText("300+ lojas").suffix, parseNumberText("300+ lojas").label], [300, "+", "lojas"]);
  assert.equal(parseNumberText("Mais de 2.000 pacientes atendidos").before, "Mais de");
  assert.equal(parseNumberText("sem número nenhum"), null);

  assert.equal(siteUrl("lojax.com.br"), "https://lojax.com.br");
  assert.equal(siteUrl("https://www.Loja-X.com.br/planos/"), "https://www.loja-x.com.br/planos");
  assert.equal(siteUrl("localhost:3000"), "http://localhost:3000");
  assert.equal(siteUrl("@lojax"), null);
  assert.equal(siteUrl("Loja X"), null);
  assert.equal(siteUrl(""), null);
  assert.equal(hostOf("https://www.Loja-X.com.br/planos"), "loja-x.com.br");
  assert.equal(hostOf("file:///C:/site/index.html"), null);
  assert.equal(hostSlug("https://www.sorrisopleno.com.br/"), "sorrisopleno-com-br");
  assert.equal(hostSlug("file:///C:/meu%20site/index.html"), "index");
  assert.equal(brandSlug({ host: "lojax.com.br" }), "lojax");
  assert.equal(brandSlug({ host: "https://app.lojax.com.br/login" }), "app-lojax");
  assert.equal(brandSlug({ host: "notion.so" }), "notion");
  assert.equal(brandSlug({ host: "insiderstore.com.br", name: "Insider" }), "insiderstore", "the address names the folder before the name does");
  assert.equal(brandSlug({ name: "Loja X — Moda" }), "loja-x-moda");
  assert.equal(brandSlug({}), null);
  assert.equal(handleFrom({ instagram: "https://www.instagram.com/lojax/" }), "@lojax");
  assert.equal(handleFrom({ instagram: "https://www.instagram.com/p/Cabc123/" }), null, "a post is not a profile");
  assert.equal(handleFrom({ tiktok: "https://www.tiktok.com/@lojax" }), "@lojax");
  assert.equal(handleFrom({}), null);

  assert.equal(kitAgeDays({ captured_at: "2026-10-07T12:00:00.000Z" }, "2026-10-17T12:00:00.000Z"), 10);
  assert.equal(kitAgeDays({ captured_at: "2026-07-01T00:00:00.000Z" }, "2026-10-07T00:00:00.000Z"), 98);
  assert.equal(kitAgeDays({}, "2026-10-07T00:00:00.000Z"), Infinity);
});

test("paletteFor and fontsFor: the brand's own colours, neutral where the capture found none", () => {
  const look = paletteFor(KIT, "limpo");
  assert.deepEqual(look.palette, { background: "#FFFFFF", surface: "#F5F3FF", text: "#1F2937", accent: "#7C3AED", muted: "#797F87" }, "the surface is the brand's own tint");
  assert.deepEqual(look.warnings, []);
  assert.equal(look.neutral, false);
  assert.ok(contrast(look.palette.text, look.palette.background) >= 4.5);
  assert.ok(contrast(look.palette.muted, look.palette.background) >= 3);

  const none = paletteFor(null);
  assert.deepEqual(none.palette, NEUTRAL_PALETTE);
  assert.equal(none.neutral, true);
  assert.match(none.warnings[0], /visual neutro/);
  assert.ok(luminance(none.palette.background) < 0.05, "the neutral look is dark");
  assert.deepEqual(paletteFor({ colors: {} }).palette, NEUTRAL_PALETTE);

  const noAccent = paletteFor({ colors: { background: "#FFFFFF", text: "#111111", primary: null, palette: [] } });
  assert.equal(noAccent.palette.accent, "#3A3A3F", "a neutral grey, never a guessed brand colour");
  assert.match(noAccent.warnings.join(" "), /sem inventar uma cor da marca/);
  const darkNoAccent = paletteFor({ colors: { background: "#101010", text: "#FAFAFA" } });
  assert.equal(darkNoAccent.palette.accent, NEUTRAL_PALETTE.accent);

  const unreadable = paletteFor({ colors: { background: "#FFFFFF", text: "#F0F0F0", primary: "#E8473C" } });
  assert.equal(unreadable.palette.text, "#111111");
  assert.match(unreadable.warnings.join(" "), /não se lê sobre o fundo/);
  const onlyAccent = paletteFor({ colors: { primary: "#E8473C" } });
  assert.equal(onlyAccent.palette.accent, "#E8473C");
  assert.equal(onlyAccent.palette.background, "#FFFFFF");
  assert.equal(onlyAccent.warnings.length, 2, "background and text were not captured, and it says so");
  const faint = paletteFor({ colors: { background: "#FFFFFF", text: "#111111", primary: "#FAFAFA" } });
  assert.equal(faint.palette.accent, "#FAFAFA", "the brand's colour is kept even when it is faint");
  assert.match(faint.warnings.join(" "), /quase igual ao fundo/);
  for (const entry of [look, none, noAccent, unreadable, onlyAccent]) for (const hex of Object.values(entry.palette)) assert.match(hex, /^#[0-9A-F]{6}$/);

  assert.deepEqual(fontsFor(KIT), { headline: "'Marca Display', Georgia, serif", body: "Inter, 'Segoe UI', Arial, sans-serif" }, "the site's own font lists");
  assert.equal(fontsFor({ fonts: { headline: "Poppins" } }).headline, "Poppins, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif");
  assert.equal(fontsFor({ fonts: { headline: "Open Sans; drop" } }).headline, "'Open Sans drop', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif", "nothing that could break a font string");
  assert.equal(fontsFor(null).headline, "Inter, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif");
  assert.equal(fontsFor(null).body, fontsFor(null).headline);
});

test("findProjectSite: the first address of README.md that is the project's own, else homepage", (t) => {
  const root = scratch(t);
  assert.equal(findProjectSite(root), null);
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "loja", homepage: "https://lojax.com.br/sobre" }));
  assert.equal(findProjectSite(root), "https://lojax.com.br", "homepage of package.json");
  writeFileSync(join(root, "README.md"), "# Loja X\n\n[![CI](https://img.shields.io/badge/ci-ok-green)](https://github.com/acme/loja/actions) ![logo](https://cdn.lojax.com.br/logo.png)\n\nFeito com [Next.js](https://nextjs.org) e publicado na [Vercel](https://vercel.com). Pacote: https://www.npmjs.com/package/loja\n\nSite: https://www.lojax.com.br/, veja também http://antigo.lojax.com.br.\n");
  assert.equal(findProjectSite(root), "https://www.lojax.com.br", "badges, code hosts, registries, tools and images are skipped");
  writeFileSync(join(root, "README.md"), "# Sem site\n\nVeja https://github.com/acme/loja e https://www.npmjs.com/package/loja.\n");
  assert.equal(findProjectSite(root), "https://lojax.com.br", "nothing usable in the README: homepage again");
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "loja", homepage: "https://github.com/acme/loja#readme" }));
  assert.equal(findProjectSite(root), null, "a repository address is not a site");
});

/* ------------------------------------------------------------------ */
/* The roteiro                                                        */
/* ------------------------------------------------------------------ */

test("solveTiming: whole bars and a tempo for a duration", () => {
  assert.deepEqual(solveTiming(15), { bars: 8, bpm: 128, duration: 15, beat_s: 0.46875, bar_s: 1.875, exact: true });
  assert.deepEqual([solveTiming(20).bars, solveTiming(20).bpm], [10, 120]);
  assert.deepEqual([solveTiming(6).bars, solveTiming(6).bpm], [3, 120]);
  assert.deepEqual([solveTiming(12).bars, solveTiming(12).bpm], [6, 120]);
  for (let seconds = 6; seconds <= 20; seconds++) {
    const timing = solveTiming(seconds);
    assert.ok(Number.isInteger(timing.bars) && Number.isInteger(timing.bpm), `${seconds} s: whole bars and tempo`);
    assert.ok(timing.bpm >= 100 && timing.bpm <= 140, `${seconds} s: ${timing.bpm} BPM`);
    assert.ok(Math.abs(timing.duration - (timing.bars * 240) / timing.bpm) < 1e-3);
    if (timing.exact) assert.ok(Math.abs(timing.duration - seconds) <= 0.011, `${seconds} s: ${timing.duration}`);
    else assert.deepEqual([timing.bpm, timing.duration], [120, timing.bars * 2], `${seconds} s falls back to whole bars at 120`);
  }
  assert.equal(solveTiming(13).exact, false);
});

test("draftRoteiro allocates bars for every template and every duration from 6 to 20 s", () => {
  for (const template of TEMPLATE_IDS) {
    const spec = TEMPLATES.templates[template];
    for (let seconds = 6; seconds <= 20; seconds++) {
      const over = { template: field(template), duration: field(seconds) };
      if (template === "oferta") over.subject = field("Clareamento a laser por R$ 199 até domingo");
      const warnings = [];
      const draft = draftRoteiro(briefState(over), KIT, TEMPLATES, { warnings });
      const label = `${template} ${seconds} s`;
      const roteiro = validateRoteiro(draft, TEMPLATES);
      assert.deepEqual(roteiro, draft, `${label}: a draft is already in its normal form`);
      assert.equal(roteiro.template, template, label);
      assert.equal(sum(roteiro.scenes.map((scene) => scene.bars)), roteiro.bars, `${label}: the scenes add up to the bars`);
      assert.ok(Math.abs(roteiro.duration - (roteiro.bars * 240) / roteiro.bpm) < 1e-3, label);
      assert.ok(roteiro.duration >= 5.5 && roteiro.duration <= 20.5, `${label}: ${roteiro.duration} s`);
      assert.ok(roteiro.bpm >= 100 && roteiro.bpm <= 140, `${label}: ${roteiro.bpm} BPM`);
      for (const scene of roteiro.scenes) {
        const [min, max] = spec.scenes.find((item) => item.role === scene.role).bars;
        assert.ok(scene.bars >= min && scene.bars <= max && Number.isInteger(scene.bars * 4), `${label}: ${scene.role} with ${scene.bars} bars`);
        for (const event of scene.events) assert.ok(event.beat < scene.bars * 4, `${label}: an event after the end of its scene`);
      }
      if (Math.abs(roteiro.duration - seconds) > 0.1) assert.ok(warnings.some((warning) => /em vez de/.test(warning)), `${label}: a different duration is said (${roteiro.duration})`);
      const times = timeline(roteiro);
      const grid = beatGrid(roteiro).beats;
      for (const cut of times.cuts) assert.ok(grid.some((beat) => Math.abs(beat - cut) < 1e-3), `${label}: the cut at ${cut} is on a beat`);
      assert.equal(times.scenes[times.scenes.length - 1].end, roteiro.duration, label);
    }
  }
});

test("allocateBars: whole bars first, repeated scenes alike, extra bars to produto, preco and fechamento", () => {
  const entries = (list) => list.map(([role, min, max, repeat = false, weight = 0]) => ({ role, min, max, repeat, weight }));
  const lancamento = entries([["gancho", 1, 2], ["produto", 1, 2], ["ponto", 1, 1, true], ["ponto", 1, 1, true], ["ponto", 1, 1, true], ["fechamento", 1, 2]]);
  assert.deepEqual(allocateBars(lancamento, 6), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(allocateBars(lancamento, 7), [1, 2, 1, 1, 1, 1], "the first extra bar goes to the product");
  assert.deepEqual(allocateBars(lancamento, 8), [1, 2, 1, 1, 1, 2], "then to the closing");
  assert.deepEqual(allocateBars(lancamento, 9), [2, 2, 1, 1, 1, 2], "then to the hook");
  assert.equal(allocateBars(lancamento, 10), null, "never more than the maximum");
  assert.equal(allocateBars(lancamento, 5), null, "never less than the minimum");
  const oferta = entries([["gancho", 1, 2], ["produto", 1, 2], ["preco", 1, 2], ["fechamento", 1, 2]]);
  assert.deepEqual(allocateBars(oferta, 5), [1, 2, 1, 1]);
  assert.deepEqual(allocateBars(oferta, 6), [1, 2, 2, 1], "product, then price");
  assert.deepEqual(allocateBars(oferta, 7), [1, 2, 2, 2], "then closing");
  const lista = entries([["gancho", 1, 2], ["item", 1, 2, true], ["item", 1, 2, true], ["item", 1, 2, true], ["fechamento", 1, 2]]);
  assert.deepEqual(allocateBars(lista, 6), [1, 1, 1, 1, 2]);
  assert.deepEqual(allocateBars(lista, 7), [2, 1, 1, 1, 2]);
  assert.deepEqual(allocateBars(lista, 8), [1, 2, 2, 2, 1], "the items of a list last the same");
  assert.deepEqual(allocateBars(lista, 10), [2, 2, 2, 2, 2]);
  const states = entries([["abertura", 0.5, 1], ["estado", 0.5, 1, true, 0], ["estado", 0.5, 1, true, 3], ["estado", 0.5, 1, true, 2], ["estado", 0.5, 1, true, 0], ["fechamento", 1, 2]]);
  assert.deepEqual(allocateBars(states, 4), [0.5, 0.5, 1, 0.5, 0.5, 1], "the first extra half bar goes to the state that shows a result");
  assert.deepEqual(allocateBars(states, 5), [0.5, 1, 1, 1, 0.5, 1], "states reach a full bar before the closing grows (heavier kinds first, then in order)");
  assert.deepEqual(allocateBars(states, 7), [1, 1, 1, 1, 1, 2]);
  assert.equal(sum(allocateBars(states, 6.5)), 6.5);
  assert.equal(allocateBars(states, 7.5), null);
});

test("the first draft: scenes in template order, texts within the limits, sound by role", () => {
  const roteiro = SAMPLE;
  assert.equal(roteiro.format_version, 1);
  assert.equal(roteiro.title, "Sorriso Pleno · lançamento");
  assert.deepEqual([roteiro.template, roteiro.style, roteiro.format, roteiro.width, roteiro.height, roteiro.fps], ["lancamento", "interface-narra", "9:16", 1080, 1920, 30]);
  assert.deepEqual([roteiro.bpm, roteiro.beats_per_bar, roteiro.bars, roteiro.duration], [128, 4, 8, 15]);
  assert.deepEqual(roteiro.music, { mode: "music", style: "energetic", seed: roteiro.music.seed, file: null });
  assert.ok(Number.isInteger(roteiro.music.seed) && roteiro.music.seed >= 1);
  assert.equal(draftRoteiro(briefState(), KIT, TEMPLATES).music.seed, roteiro.music.seed, "the same video, the same music");
  assert.notEqual(draftRoteiro({ ...briefState(), slug: "outro-video" }, KIT, TEMPLATES).music.seed, roteiro.music.seed);
  assert.deepEqual(roteiro.palette, paletteFor(KIT).palette);
  assert.deepEqual(roteiro.fonts, fontsFor(KIT));
  assert.deepEqual(roteiro.brand, { name: "Sorriso Pleno", site: "sorrisopleno.com.br", handle: "@sorrisopleno", logo: "assets/logo.svg" });
  assert.deepEqual(roteiro.scenes.map((scene) => [scene.n, scene.role, scene.bars]), [[1, "gancho", 1], [2, "produto", 2], [3, "ponto", 1], [4, "ponto", 1], [5, "ponto", 1], [6, "prova", 1], [7, "fechamento", 1]]);
  assert.deepEqual(roteiro.scenes[0], { n: 1, role: "gancho", bars: 1, text: "Seu sorriso novo em 90 dias", events: [{ beat: 0, type: "impact" }] });
  assert.deepEqual(roteiro.scenes[1], { n: 2, role: "produto", bars: 2, screen: "assets/mobile-full.png", text: "Sorriso Pleno", events: [{ beat: 0, type: "whoosh" }] }, "the whole page of the site, which the page scrolls from point to point");
  assert.deepEqual(roteiro.scenes[2].events, [{ beat: 0, type: "pop" }, { beat: 2, type: "click" }]);
  assert.deepEqual(roteiro.scenes[5], {
    n: 6,
    role: "prova",
    bars: 1,
    value: 2000,
    prefix: "+",
    text: "clientes atendidos em Curitiba",
    source: "sorrisopleno.com.br (página inicial, 2026-10-07)",
    events: [{ beat: 0, type: "tick" }, { beat: 1, type: "tick" }, { beat: 2, type: "tick" }, { beat: 3, type: "impact" }],
  });
  assert.deepEqual(roteiro.scenes[6], { n: 7, role: "fechamento", bars: 1, text: "sorrisopleno.com.br", logo: true, events: [{ beat: 0, type: "impact" }] });
  assert.equal(roteiro.loop, false);

  // texts are cut at word limits, never in the middle of a word, and the cut is said
  const warnings = [];
  const long = draftRoteiro(
    briefState({
      hook: field("Um sorriso novo para você em apenas noventa dias corridos"),
      points: field(["Dente fixo em uma única sessão com planejamento digital", "Clareamento: até oito tons mais claro em uma hora", "Alinhadores invisíveis"]),
    }),
    KIT,
    TEMPLATES,
    { warnings },
  );
  assert.equal(long.scenes[0].text, "Um sorriso novo para você");
  assert.ok(countWords(long.scenes[0].text) <= 6);
  assert.equal(long.scenes[2].text, "Dente fixo em uma única");
  assert.deepEqual([long.scenes[3].text, long.scenes[3].detail], ["Clareamento", "até oito tons mais claro em uma hora"], "a point written as title: detail keeps both");
  assert.ok(warnings.some((warning) => /O gancho passou de 6 palavras/.test(warning)));
  assert.ok(warnings.some((warning) => /O ponto 1 passou de 5 palavras/.test(warning)));
  validateRoteiro(long, TEMPLATES);

  // a proof needs a real source; a number that does not say what it counts stays out
  const noSource = [];
  const withoutProof = draftRoteiro(briefState({ proof: field({ text: "+2.000 clientes", value: 2000, source: "" }, "inferido") }), KIT, TEMPLATES, { warnings: noSource });
  assert.ok(!withoutProof.scenes.some((scene) => scene.role === "prova"));
  assert.match(noSource.join(" "), /não tem origem/);
  const said = draftRoteiro(briefState({ proof: field({ text: "+12 mil clientes", value: 12000, source: "" }, "resposta") }), KIT, TEMPLATES);
  assert.deepEqual((({ value, prefix, text, source }) => [value, prefix, text, source])(said.scenes.find((scene) => scene.role === "prova")), [12000, "+", "clientes", "informado pelo integrante"]);
  const bare = [];
  assert.ok(!draftRoteiro(briefState({ proof: field({ text: "+300", value: 300, source: "site" }) }), KIT, TEMPLATES, { warnings: bare }).scenes.some((scene) => scene.role === "prova"));
  assert.match(bare.join(" "), /não diz o que conta/);
  assert.ok(!draftRoteiro(briefState({ proof: field(null) }), KIT, TEMPLATES).scenes.some((scene) => scene.role === "prova"));

  // closings by kind
  const closing = (value) => draftRoteiro(briefState({ closing: field(value) }), KIT, TEMPLATES).scenes.at(-1).text;
  assert.equal(closing({ kind: "perfil", text: null }), "@sorrisopleno");
  assert.equal(closing({ kind: "bio", text: null }), "Link na bio");
  assert.equal(closing({ kind: "whatsapp", text: null }), "Chama no WhatsApp");
  assert.equal(closing({ kind: "site", text: null }), "sorrisopleno.com.br");
  assert.equal(closing({ kind: "frase", text: "Comente SORRISO" }), "Comente SORRISO");
});

test("the first draft: the look without a brand kit, the member's files, and what each text came from", () => {
  const warnings = [];
  const origins = [];
  const state = briefState({ brand: field({ name: null, site: "https://lojax.com.br", handle: null }), proof: field(null) });
  const neutral = draftRoteiro(state, null, TEMPLATES, { warnings, origins });
  assert.deepEqual(neutral.palette, NEUTRAL_PALETTE);
  assert.deepEqual(neutral.brand, { name: "lojax", site: "lojax.com.br", handle: null, logo: null });
  assert.equal(neutral.scenes[1].screen, undefined, "no capture, no screen: the page draws the device");
  assert.match(warnings.join(" "), /visual neutro/);
  validateRoteiro(neutral, TEMPLATES);
  assert.throws(() => draftRoteiro(briefState({ brand: undefined }), null, TEMPLATES), (error) => error.code === "brand_unknown", "no brand at all is a question to ask");

  // "sem marca": the member chose a neutral video; nothing of a brand is drawn
  const unbranded = draftRoteiro(briefState({ brand: field({ name: null, site: null, handle: null }, "resposta"), closing: field({ kind: "bio", text: "Link na bio" }, "padrao"), proof: field(null), subject: field("três dicas de escovação", "resposta") }), null, TEMPLATES);
  assert.deepEqual(unbranded.brand, { name: null, site: null, handle: null, logo: null });
  assert.deepEqual(unbranded.palette, NEUTRAL_PALETTE);
  assert.equal(unbranded.title, "três dicas de escovação · lançamento");
  assert.equal(unbranded.scenes[1].text, "três dicas de escovação", "the product scene shows the subject");
  assert.deepEqual([unbranded.scenes.at(-1).text, unbranded.scenes.at(-1).logo], ["Link na bio", false]);
  assert.deepEqual(validateRoteiro(unbranded, TEMPLATES).brand.name, null);
  assert.throws(() => validateRoteiro(patch(unbranded, (r) => { r.brand.name = " "; }), TEMPLATES), (error) => /brand\.name está vazio/.test(error.message), "an empty name is a mistake; null is a choice");

  // "sem som": no music and no effects
  const mute = draftRoteiro(briefState({ music: field({ mode: "none", style: null, file: null, effects: false }, "resposta") }), KIT, TEMPLATES);
  assert.equal(mute.music.mode, "none");
  assert.ok(mute.scenes.every((scene) => scene.events.length === 0));
  assert.deepEqual(eventsFile(mute).events, []);

  // a line of the story that slipped into the points is left out, and said
  const said = [];
  const directed = draftRoteiro(briefState({ points: field(['Abre com "Seu sorriso novo em 90 dias"', "Implantes dentários", "Clareamento a laser", "Alinhadores invisíveis", "Fecha com o logo e o site"]) }), KIT, TEMPLATES, { warnings: said });
  assert.deepEqual(directed.scenes.filter((scene) => scene.role === "ponto").map((scene) => scene.text), ["Implantes dentários", "Clareamento a laser", "Alinhadores invisíveis"]);
  assert.match(said.join(" "), /instrução da história, não algo a mostrar: "Abre com "Seu sorriso novo em 90 dias"", "Fecha com o logo e o site"/);

  const materials = { logo: "C:/x/materiais/Logo Oficial.PNG", screens: ["C:/x/materiais/tela agenda.png"], images: ["C:/x/materiais/1-casaco.jpg", "C:/x/materiais/2-bota.webp"], audio: [] };
  assert.deepEqual(
    assetTargets({ kit: KIT, materials }).map((item) => [item.key, item.target, item.from]),
    [["logo", "assets/logo.png", "materiais"], ["mobile", "assets/mobile.png", "captura"], ["mobile-full", "assets/mobile-full.png", "captura"], ["desktop", "assets/desktop.png", "captura"], ["tela-1", "assets/tela-1.png", "materiais"], ["produto-1", "assets/produto-1.jpg", "materiais"], ["produto-2", "assets/produto-2.webp", "materiais"]],
    "the member's logo replaces the captured one; copies get plain names",
  );
  const withFiles = draftRoteiro(briefState(), KIT, TEMPLATES, { materials });
  assert.equal(withFiles.brand.logo, "assets/logo.png");
  assert.deepEqual(withFiles.scenes.filter((scene) => scene.role === "ponto").map((scene) => scene.image ?? null), ["assets/produto-1.jpg", "assets/produto-2.webp", null]);
  assert.equal(draftRoteiro(briefState(), null, TEMPLATES, { materials }).scenes[1].screen, "assets/tela-1.png", "without a capture, the member's own screenshot");
  assert.equal(withFiles.scenes[1].screen, "assets/tela-1.png", "the member's screenshot (the product behind a login) comes before the site's page");
  const screens = draftRoteiro(briefState(), KIT, TEMPLATES, { materials: { ...materials, images: [], screens: ["C:/x/materiais/tela-a.png", "C:/x/materiais/tela-b.png", "C:/x/materiais/tela-c.png"] } });
  assert.deepEqual(screens.scenes.filter((scene) => scene.role === "produto" || scene.role === "ponto").map((scene) => scene.screen ?? null), ["assets/tela-1.png", "assets/tela-2.png", "assets/tela-3.png", null], "each point shows the member's next screen; the last one keeps the product's");

  const sources = [];
  draftRoteiro(briefState(), KIT, TEMPLATES, { origins: sources });
  assert.deepEqual(sources.filter((entry) => entry.field === "text").map((entry) => [entry.scene, entry.source]), [[1, "captura"], [2, "pedido"], [3, "captura"], [4, "captura"], [5, "captura"], [6, "captura"], [7, "padrao"]]);
  const captured = [];
  draftRoteiro(briefState({ brand: field({ name: null, site: "https://www.sorrisopleno.com.br", handle: null }, "resposta") }), KIT, TEMPLATES, { origins: captured });
  assert.equal(captured.find((entry) => entry.scene === 2).source, "captura", "a name the member did not say came from the site");
});

test("the first draft: oferta, lista and interface, and what happens when the brief cannot fill them", () => {
  const offer = draftRoteiro(briefState({ template: field("oferta"), objective: field("vender"), duration: field(20), subject: field("Casaco de lã de R$ 299 por R$ 199,90 à vista, só até domingo") }), KIT, TEMPLATES);
  assert.deepEqual(offer.scenes.map((scene) => scene.role), ["gancho", "produto", "preco", "prazo", "fechamento"]);
  assert.equal(offer.scenes[1].text, "Casaco de lã", "the product, without the price and the deadline said with it");
  assert.deepEqual((({ value, old_value, text }) => [value, old_value, text])(offer.scenes[2]), [199.9, 299, "à vista"]);
  assert.equal(offer.scenes[3].text, "Só até domingo");
  assert.deepEqual([offer.bars, offer.bpm, offer.duration], [9, 108, 20], "20 s in the nine bars an offer can take");
  validateRoteiro(offer, TEMPLATES);

  const fromSite = draftRoteiro(briefState({ template: field("oferta"), subject: field("clareamento a laser") }), KIT, TEMPLATES);
  assert.equal(fromSite.scenes.find((scene) => scene.role === "preco").value, 199, "the site's own price of the product named");
  assert.ok(!fromSite.scenes.some((scene) => scene.role === "prazo"), "a deadline is never made up");
  const noPrice = [];
  const fallback = draftRoteiro(briefState({ template: field("oferta"), subject: field("as peças da coleção") }), KIT, TEMPLATES, { warnings: noPrice });
  assert.equal(fallback.template, "lancamento");
  assert.match(noPrice.join(" "), /O roteiro Oferta precisa de um preço real/);

  const list = draftRoteiro(briefState({ template: field("lista"), points: field(["Escove três vezes ao dia", "Use fio dental", "Troque a escova a cada três meses", "Visite o dentista"], "resposta") }), KIT, TEMPLATES);
  assert.deepEqual(list.scenes.map((scene) => scene.role), ["gancho", "item", "item", "item", "item", "fechamento"]);
  assert.deepEqual(list.scenes.map((scene) => scene.bars), [2, 1, 1, 1, 1, 2]);
  assert.equal(list.style, "interface-narra", "the style of the brief wins over the template's");
  const shortList = [];
  assert.equal(draftRoteiro(briefState({ template: field("lista"), points: field(["Um", "Dois"]) }), KIT, TEMPLATES, { warnings: shortList }).template, "lancamento");
  assert.match(shortList.join(" "), /O roteiro Lista pede de 3 a 5 itens/);
  assert.throws(() => draftRoteiro(briefState({ points: field(["Só um"]) }), KIT, TEMPLATES), (error) => error.code === "roteiro_invalid" && /Faltam os pontos/.test(error.message) && /answer/.test(error.fix) && error.ask === "pontos");

  // the passo a passo: one scene per step, the step's detail after a colon, the path's sounds, no result made up
  const steps = draftRoteiro(briefState({ template: field("passos"), points: field(["Baixe o app", "Crie sua conta: leva um minuto", "Escolha o horário"], "resposta") }), KIT, TEMPLATES);
  assert.deepEqual(steps.scenes.map((scene) => scene.role), ["gancho", "passo", "passo", "passo", "fechamento"]);
  assert.deepEqual([steps.scenes[2].text, steps.scenes[2].detail], ["Crie sua conta", "leva um minuto"]);
  assert.deepEqual(steps.scenes[1].events, [{ beat: 0, type: "swish" }, { beat: 2, type: "pop" }]);
  assert.ok(!steps.scenes.some((scene) => scene.role === "resultado"), "the result is the member's to say, never drafted");
  validateRoteiro(steps, TEMPLATES);
  // "explicar" with no story of its own is the passo a passo
  assert.equal(draftRoteiro(briefState({ template: field(null), objective: field("explicar"), points: field(["Baixe o app", "Escolha o horário"], "resposta") }), KIT, TEMPLATES).template, "passos");
  assert.throws(
    () => draftRoteiro(briefState({ template: field("passos"), points: field(["Só um"], "resposta") }), KIT, TEMPLATES),
    (error) => error.code === "roteiro_invalid" && /Faltam os passos/.test(error.message) && /os passos, na ordem/.test(error.fix) && error.ask === "pontos",
  );
  // a roteiro with the result the member said is fixtures/roteiros/passos-completo.json, validated with every fixture
  const many = [];
  const five = draftRoteiro(briefState({ points: field(["A um", "B dois", "C três", "D quatro", "E cinco"], "resposta"), proof: field(null) }), KIT, TEMPLATES, { warnings: many });
  assert.equal(five.scenes.filter((scene) => scene.role === "ponto").length, 4);
  assert.match(many.join(" "), /mostra até 4 cenas "ponto"; ficou de fora: "E cinco"/);

  const ui = draftRoteiro(
    briefState({ template: field("interface"), style: field(null), points: field(["Clicar no botão Agendar", "Digitar o e-mail", "Carregando a agenda", "Pronto: horário marcado", "Gráfico de resultados", "Lista de tarefas", "Aviso de lembrete", "Buscar um paciente", "Cartão do plano"], "resposta") }),
    KIT,
    TEMPLATES,
  );
  assert.deepEqual(ui.scenes.map((scene) => scene.role), ["abertura", ...Array(9).fill("estado"), "fechamento"]);
  assert.deepEqual(ui.scenes.filter((scene) => scene.role === "estado").map((scene) => scene.kind), ["botao", "campo", "carregando", "sucesso", "grafico", "lista", "aviso", "busca", "cartao"]);
  assert.equal(ui.style, "interface-que-se-transforma", "without a style in the brief, the template's own");
  assert.equal(ui.scenes[0].text, "Sorriso Pleno");
  assert.equal(ui.music.style, "energetic");
  validateRoteiro(ui, TEMPLATES);
  const few = draftRoteiro(briefState({ template: field("interface"), points: field(["Agenda cheia", "Lembrete automático"], "resposta") }), KIT, TEMPLATES);
  assert.deepEqual(few.scenes.filter((scene) => scene.role === "estado").map((scene) => [scene.kind, scene.text]), [["botao", "Agendar avaliação"], ["cartao", "Agenda cheia"], ["aviso", "Lembrete automático"], ["sucesso", "Pronto"]], "the site's own button opens the interface and a result closes it");

  // the member's own music sets the tempo; a tempo asked for becomes the centre of the choice
  const own = draftRoteiro(briefState({ music: field({ mode: "file", style: null, file: "materiais/trilha.mp3" }) }), KIT, TEMPLATES, { bpm: 97 });
  assert.deepEqual([own.bpm, own.bars, own.music.mode, own.music.file], [97, 6, "file", "materiais/trilha.mp3"]);
  assert.ok(Math.abs(own.duration - (6 * 240) / 97) < 1e-3);
  // the brief's own solver: its warning is said when its tempo is the one used, and never when a closer fit was found
  const solver = [];
  draftRoteiro(briefState(), KIT, TEMPLATES, { warnings: solver, solveTiming: () => ({ bars: 8, bpm: 128, duration: 15, beat_s: 0.46875, bar_s: 1.875, exact: false, warning: "AVISO DO SOLVER" }) });
  assert.ok(solver.includes("AVISO DO SOLVER"), JSON.stringify(solver));
  const closer = [];
  const fitted = draftRoteiro(briefState(), KIT, TEMPLATES, { warnings: closer, solveTiming: () => ({ bars: 8, bpm: 120, duration: 16, beat_s: 0.5, bar_s: 2, exact: false, warning: "AVISO DO SOLVER" }) });
  assert.deepEqual([fitted.bars, fitted.bpm, fitted.duration], [8, 128, 15]);
  assert.ok(!closer.includes("AVISO DO SOLVER"), "a warning about another tempo would mislead");
  const clamped = [];
  assert.equal(draftRoteiro(briefState({ duration: field(25) }), KIT, TEMPLATES, { warnings: clamped }).duration, 20);
  assert.match(clamped.join(" "), /de 6 a 20 segundos: usei 20 s no lugar de 25 s/);
  const askedTempo = [];
  const at120 = draftRoteiro(briefState(), KIT, TEMPLATES, { preferBpm: 120, warnings: askedTempo });
  assert.deepEqual([at120.bpm, at120.duration], [128, 15], "the duration asked for wins over the tempo asked for");
  assert.match(askedTempo.join(" "), /O pedido fala em 120 BPM/);
  assert.equal(draftRoteiro(briefState({ music: field({ mode: "synth", style: "warm", file: null }) }), KIT, TEMPLATES).loop, true);
  assert.equal(draftRoteiro(briefState({ music: field({ mode: "none", style: null, file: null }) }), KIT, TEMPLATES).music.mode, "none");
});

test("timeline, the beat grid, the effects list and the texts on screen", () => {
  const times = timeline(SAMPLE);
  assert.deepEqual([times.bpm, times.beats_per_bar, times.beat_s, times.bar_s, times.bars, times.beats, times.duration], [128, 4, 0.46875, 1.875, 8, 32, 15]);
  assert.deepEqual(times.scenes.map((scene) => [scene.start, scene.end]), [[0, 1.875], [1.875, 5.625], [5.625, 7.5], [7.5, 9.375], [9.375, 11.25], [11.25, 13.125], [13.125, 15]]);
  assert.deepEqual(times.cuts, [1.875, 5.625, 7.5, 9.375, 11.25, 13.125], "the cuts are the starts of scenes 2…n");
  assert.deepEqual(times.scenes[5].events.map((event) => event.t), [11.25, 11.7188, 12.1875, 12.6563], "an event sounds at start + beat × beat_s");
  const half = timeline({ bpm: 120, scenes: [{ role: "abertura", bars: 0.5 }, { role: "estado", bars: 0.75, events: [{ beat: 0.5, type: "click" }] }, { role: "fechamento", bars: 1 }] });
  assert.deepEqual([half.cuts, half.duration, half.scenes[1].events[0].t], [[1, 2.5], 4.5, 1.25]);

  const grid = beatGrid(SAMPLE);
  assert.deepEqual([grid.bpm, grid.offset, grid.beats_per_bar, grid.bars, grid.duration, grid.beats.length, grid.downbeats.length], [128, 0, 4, 8, 15, 32, 8]);
  assert.deepEqual(grid.beats.slice(0, 5), [0, 0.4688, 0.9375, 1.4063, 1.875]);
  assert.ok(grid.beats.every((beat) => beat < 15));

  const sound = eventsFile(SAMPLE);
  assert.equal(sound.duration, 15);
  assert.deepEqual(sound.events.slice(0, 4), [{ t: 0, type: "impact" }, { t: 1.875, type: "whoosh" }, { t: 5.625, type: "pop" }, { t: 6.5625, type: "click" }]);
  assert.equal(sound.events.length, 13);
  assert.deepEqual(sound.events.map((event) => event.t), [...sound.events.map((event) => event.t)].sort((a, b) => a - b), "in time order");
  const custom = patch(SAMPLE, (roteiro) => {
    roteiro.scenes[1].events = [{ beat: 7.5, type: "whoosh", direction: "out", gain_db: -6, pan: 0.3, length: 0.4, pitch: 1.2 }];
  });
  assert.deepEqual(eventsFile(validateRoteiro(custom, TEMPLATES)).events[1], { t: 5.3906, type: "whoosh", gain_db: -6, pan: 0.3, length: 0.4, pitch: 1.2, direction: "out" });

  assert.deepEqual(
    onScreenTexts(SAMPLE).map((item) => [item.n, item.role, item.start, item.field, item.text, item.source]),
    [
      [1, "gancho", 0, "text", "Seu sorriso novo em 90 dias", null],
      [2, "produto", 1.875, "text", "Sorriso Pleno", null],
      [3, "ponto", 5.625, "text", "Implantes dentários", null],
      [4, "ponto", 7.5, "text", "Clareamento a laser", null],
      [5, "ponto", 9.375, "text", "Alinhadores invisíveis", null],
      [6, "prova", 11.25, "value", "+2.000", "sorrisopleno.com.br (página inicial, 2026-10-07)"],
      [6, "prova", 11.25, "text", "clientes atendidos em Curitiba", "sorrisopleno.com.br (página inicial, 2026-10-07)"],
      [7, "fechamento", 13.125, "text", "sorrisopleno.com.br", null],
    ],
    "every string with its time, and a number with where it came from",
  );
  const noLogo = patch(SAMPLE, (roteiro) => {
    roteiro.brand.logo = null;
  });
  assert.deepEqual(onScreenTexts(noLogo).at(-1).text, "Sorriso Pleno", "without a logo the closing writes the brand name");
  assert.deepEqual(sceneSummary(SAMPLE)[1], { n: 2, role: "produto", bars: 2, start: 1.875, end: 5.625, text: "Sorriso Pleno", screen: "assets/mobile-full.png" });
  assert.equal(formatNumber(12000), "12.000");
  assert.equal(formatNumber(4.9), "4,9");
  assert.equal(formatPrice(199), "R$ 199");
  assert.equal(formatPrice(1299.9), "R$ 1.299,90");
  assert.equal(formatPrice("12x de R$ 49,90"), "12x de R$ 49,90");
});

test("validateRoteiro names the scene and the field that are wrong, with code roteiro_invalid", () => {
  const cases = [
    [null, /precisa ser um objeto/],
    [{ ...SAMPLE, format_version: 2 }, /^roteiro\.json: format_version/],
    [{ ...SAMPLE, template: "novela" }, /^roteiro\.json: template precisa ser um de lancamento, interface, oferta, lista, passos/],
    [{ ...SAMPLE, style: "neon" }, /^roteiro\.json: style/],
    [{ ...SAMPLE, format: "16:9" }, /^roteiro\.json: format nesta versão o vídeo é sempre 9:16/],
    [{ ...SAMPLE, width: 1920 }, /^roteiro\.json: format/],
    [{ ...SAMPLE, fps: 12 }, /^roteiro\.json: fps/],
    [{ ...SAMPLE, bpm: 300 }, /^roteiro\.json: bpm/],
    [{ ...SAMPLE, bpm: "rápido" }, /^roteiro\.json: bpm/],
    [{ ...SAMPLE, beats_per_bar: 3 }, /^roteiro\.json: beats_per_bar/],
    [patch(SAMPLE, (r) => { r.music.mode = "radio"; }), /^roteiro\.json: music\.mode/],
    [patch(SAMPLE, (r) => { r.music.style = "noir"; }), /^roteiro\.json: music\.style/],
    [patch(SAMPLE, (r) => { r.music.seed = -1; }), /^roteiro\.json: music\.seed/],
    [patch(SAMPLE, (r) => { r.palette.accent = "roxo"; }), /^roteiro\.json: palette\.accent precisa ser uma cor hexadecimal/],
    [patch(SAMPLE, (r) => { delete r.palette; }), /^roteiro\.json: palette/],
    [patch(SAMPLE, (r) => { r.fonts.headline = "Inter; } body {"; }), /^roteiro\.json: fonts\.headline/],
    [patch(SAMPLE, (r) => { r.brand.name = ""; }), /^roteiro\.json: brand\.name está vazio/],
    [patch(SAMPLE, (r) => { r.brand.logo = "../../segredo.png"; }), /^roteiro\.json: brand\.logo não pode sair da pasta/],
    [patch(SAMPLE, (r) => { r.brand.logo = "assets/logo.exe"; }), /^roteiro\.json: brand\.logo precisa ser uma imagem/],
    [{ ...SAMPLE, loop: "sim" }, /^roteiro\.json: loop/],
    [{ ...SAMPLE, scenes: [] }, /^roteiro\.json: scenes precisa ser a lista de cenas/],
    [patch(SAMPLE, (r) => { r.scenes[2].role = "depoimento"; }), /^roteiro\.json: scenes\[2\]\.role precisa ser um de gancho, produto, ponto, prova, fechamento/],
    [patch(SAMPLE, (r) => { r.scenes[0].text = "Um sorriso novo para você em noventa dias"; }), /^roteiro\.json: scenes\[0\]\.text \(cena 1, gancho\) tem 8 palavras e o limite é 6/],
    [patch(SAMPLE, (r) => { r.scenes[3].text = "Clareamento a laser em uma única sessão"; }), /^roteiro\.json: scenes\[3\]\.text \(cena 4, ponto\) tem 7 palavras e o limite é 5/],
    [patch(SAMPLE, (r) => { r.scenes[3].detail = "um dois três quatro cinco seis sete oito nove dez onze"; }), /^roteiro\.json: scenes\[3\]\.detail \(cena 4, ponto\) tem 11 palavras e o limite é 10/],
    [patch(SAMPLE, (r) => { delete r.scenes[0].text; }), /^roteiro\.json: scenes\[0\]\.text \(cena 1, gancho\) está faltando/],
    [patch(SAMPLE, (r) => { r.scenes[1].bars = 3; }), /^roteiro\.json: scenes\[1\]\.bars \(cena 2, produto\) precisa ser de 1 a 2 compassos/],
    [patch(SAMPLE, (r) => { r.scenes[1].bars = 1.3; }), /^roteiro\.json: scenes\[1\]\.bars .*múltiplos de 0,25/],
    [patch(SAMPLE, (r) => { r.scenes[2].bars = 2; }), /^roteiro\.json: scenes\[2\]\.bars \(cena 3, ponto\) precisa ser 1 compasso/],
    [patch(SAMPLE, (r) => { r.scenes[1].screen = "C:/fotos/../tela.png"; }), /^roteiro\.json: scenes\[1\]\.screen/],
    [patch(SAMPLE, (r) => { r.scenes[5].value = "muitos"; }), /^roteiro\.json: scenes\[5\]\.value \(cena 6, prova\) precisa ser um número/],
    [patch(SAMPLE, (r) => { delete r.scenes[5].source; }), /^roteiro\.json: scenes\[5\]\.source \(cena 6, prova\) está faltando/],
    [patch(SAMPLE, (r) => { r.scenes[6].logo = "sim"; }), /^roteiro\.json: scenes\[6\]\.logo/],
    [patch(SAMPLE, (r) => { r.scenes[0].events = [{ beat: 0, type: "boom" }]; }), /^roteiro\.json: scenes\[0\]\.events\[0\]\.type/],
    [patch(SAMPLE, (r) => { r.scenes[0].events = [{ beat: 4, type: "impact" }]; }), /^roteiro\.json: scenes\[0\]\.events\[0\]\.beat precisa ficar antes do fim da cena, que tem 4 tempos/],
    [patch(SAMPLE, (r) => { r.scenes[0].events = [{ beat: 0, type: "whoosh", direction: "up" }]; }), /^roteiro\.json: scenes\[0\]\.events\[0\]\.direction/],
    [patch(SAMPLE, (r) => { r.scenes[0].events = "nenhum"; }), /^roteiro\.json: scenes\[0\]\.events/],
    [patch(SAMPLE, (r) => { r.scenes.splice(1, 1); }), /^roteiro\.json: scenes\[1\]\.role veio "ponto", e nesta posição o roteiro espera "produto"/],
    [patch(SAMPLE, (r) => { r.scenes.splice(3, 2); }), /^roteiro\.json: scenes\[3\]\.role veio "prova".*espera "ponto" \(tem 1, precisa de pelo menos 2\)/],
    [patch(SAMPLE, (r) => { r.scenes.pop(); }), /^roteiro\.json: scenes faltam cenas: o roteiro precisa de uma cena "fechamento"/],
    [patch(SAMPLE, (r) => { r.scenes.push({ role: "gancho", bars: 1, text: "De novo" }); }), /^roteiro\.json: scenes\[7\]\.role o roteiro aceita no máximo 1 cena\(s\) "gancho"/],
    [patch(SAMPLE, (r) => { const [proof] = r.scenes.splice(5, 1); r.scenes.push(proof); }), /^roteiro\.json: scenes\[6\]\.role "prova" não vem nesta posição\. A ordem do roteiro Lançamento é: gancho, produto, ponto \(de 2 a 4\), prova \(opcional\), fechamento/],
    [patch(SAMPLE, (r) => { r.scenes.splice(5, 0, clone(r.scenes[2]), clone(r.scenes[2])); }), /^roteiro\.json: scenes\[6\]\.role o roteiro aceita no máximo 4 cena\(s\) "ponto"/],
    [patch(SAMPLE, (r) => { r.bpm = 60; }), /^roteiro\.json: scenes somam 8 compassos, que a 60 BPM dão 32 s; nesta versão o vídeo tem de 6 a 20 s/],
  ];
  for (const [input, pattern] of cases) {
    assert.throws(
      () => validateRoteiro(input, TEMPLATES),
      (error) => error instanceof AppError && error.code === "roteiro_invalid" && pattern.test(error.message) && error.fix.length > 0,
      `esperava ${pattern} para ${JSON.stringify(input)?.slice(0, 90)}`,
    );
  }
  // the fix of a text that is too long offers a cut that fits
  assert.throws(() => validateRoteiro(patch(SAMPLE, (r) => { r.scenes[0].text = "Um sorriso novo para você em noventa dias"; }), TEMPLATES), (error) => /até 6 palavras \(por exemplo: "Um sorriso novo para você"\)/.test(error.fix));
});

test("validateRoteiro normalizes: scene numbers, bars and duration from the scenes, unknown fields kept", () => {
  const notes = [];
  const edited = patch(SAMPLE, (roteiro) => {
    roteiro.scenes[1].bars = 1;
    roteiro.scenes[6].bars = 2;
    roteiro.scenes[3].n = 99;
    roteiro.bpm = 120;
    roteiro.scenes[0].notes = "abrir mais devagar";
    roteiro.direction = "mais calmo";
    delete roteiro.fps;
    delete roteiro.loop;
    delete roteiro.title;
  });
  const roteiro = validateRoteiro(edited, TEMPLATES, { notes });
  assert.deepEqual([roteiro.bars, roteiro.duration, roteiro.bpm, roteiro.fps, roteiro.loop], [8, 16, 120, 30, false]);
  assert.deepEqual(roteiro.scenes.map((scene) => scene.n), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(roteiro.scenes[0].notes, "abrir mais devagar");
  assert.equal(roteiro.direction, "mais calmo");
  assert.equal(roteiro.title, "Sorriso Pleno · lançamento");
  assert.deepEqual(notes, ["duration passou de 15 para 16 s: 8 compassos a 120 BPM."]);
  const more = [];
  const longer = validateRoteiro(patch(SAMPLE, (r) => { r.scenes[0].bars = 2; }), TEMPLATES, { notes: more });
  assert.deepEqual([longer.bars, longer.duration], [9, 16.875]);
  assert.equal(more.length, 2, "bars and duration are recomputed, and it says so");
  assert.equal(validateRoteiro(patch(SAMPLE, (r) => { r.music = { mode: "synth", style: "lofi" }; }), TEMPLATES).music.style, "lofi", "a looping track takes its own styles too");

  // the optional slots the page reads: the highlighted words and where the screen is scrolled to
  const marked = [];
  const emphasized = validateRoteiro(patch(SAMPLE, (r) => {
    r.scenes[0].emphasis = "90 dias";
    r.scenes[2].emphasis = 1;
    r.scenes[2].scroll = 0.35;
    r.scenes[3].emphasis = false;
    r.scenes[4].emphasis = "sorriso";
  }), TEMPLATES, { notes: marked });
  assert.deepEqual([emphasized.scenes[0].emphasis, emphasized.scenes[2].emphasis, emphasized.scenes[2].scroll, emphasized.scenes[3].emphasis], ["90 dias", 1, 0.35, false]);
  assert.deepEqual(marked, ['scenes[4].emphasis ("sorriso") não está no texto da cena 5 ("Alinhadores invisíveis"): a página destaca outra palavra.']);
  for (const [change, pattern] of [
    [(r) => { r.scenes[0].emphasis = { words: "90" }; }, /scenes\[0\]\.emphasis \(cena 1, gancho\) precisa ser as palavras do texto a destacar/],
    [(r) => { r.scenes[2].scroll = 2; }, /scenes\[2\]\.scroll precisa ser um número entre 0 e 1/],
    [(r) => { r.scenes[2].scroll = "meio"; }, /scenes\[2\]\.scroll/],
  ]) assert.throws(() => validateRoteiro(patch(SAMPLE, change), TEMPLATES), (error) => error.code === "roteiro_invalid" && pattern.test(error.message), String(pattern));
  assert.deepEqual(validateRoteiro(patch(SAMPLE, (r) => { delete r.music; }), TEMPLATES).music, { mode: "music", style: "energetic", seed: 7, file: null });

  // the palette: background, text and accent are the brand's; surface and muted, when absent, are derived by the page
  const shorthand = [];
  const partial = validateRoteiro(patch(SAMPLE, (r) => { r.palette = { background: "#fff", text: "#1F2937", accent: "#7C3AEDFF" }; }), TEMPLATES, { notes: shorthand });
  assert.deepEqual(partial.palette, { background: "#FFFFFF", text: "#1F2937", accent: "#7C3AED" });
  assert.deepEqual(shorthand, ['palette.background passou de "#fff" para #FFFFFF.', 'palette.accent passou de "#7C3AEDFF" para #7C3AED.']);
  assert.throws(() => validateRoteiro(patch(SAMPLE, (r) => { delete r.palette.text; }), TEMPLATES), (error) => error.code === "roteiro_invalid" && /palette\.text precisa ser uma cor hexadecimal/.test(error.message));
  assert.throws(() => validateRoteiro(patch(SAMPLE, (r) => { r.palette.muted = "cinza"; }), TEMPLATES), (error) => error.code === "roteiro_invalid" && /palette\.muted/.test(error.message));
});

test("every roteiro the page templates are tested with passes build's validator as it is", (t) => {
  const dir = join(FIXTURES, "roteiros");
  if (!existsSync(dir)) return t.skip("os roteiros de teste da página ainda não existem");
  const names = readdirSync(dir).filter((name) => name.endsWith(".json"));
  assert.ok(names.length > 0);
  /** Every value the roteiro gives comes back the same (numbers within 0,011, the precision of duration). */
  const changed = (given, normalized, path, out) => {
    if (given && typeof given === "object") {
      if (!normalized || typeof normalized !== "object") out.push(path);
      else for (const key of Object.keys(given)) changed(given[key], normalized[key], `${path}.${key}`, out);
    } else if (!(typeof given === "number" && typeof normalized === "number" && Math.abs(given - normalized) <= 0.011) && given !== normalized) {
      out.push(`${path}: ${JSON.stringify(given)} → ${JSON.stringify(normalized)}`);
    }
    return out;
  };
  for (const name of names) {
    const raw = readJsonFile(join(dir, name));
    const notes = [];
    const valid = validateRoteiro(clone(raw), TEMPLATES, { notes });
    assert.deepEqual(notes, [], `${name}: nothing to normalize`);
    assert.deepEqual(changed(raw, valid, "roteiro", []), [], `${name}: build keeps the roteiro the page draws`);
  }
});

test("draftRoteiro says when the opening only repeats the name the next scene shows", () => {
  const warnings = [];
  const draft = draftRoteiro(briefState({ hook: field(null, "padrao"), subject: field("marca em geral", "padrao") }), null, TEMPLATES, { warnings });
  const [hook, product] = draft.scenes;
  assert.deepEqual([hook.role, product.role], ["gancho", "produto"]);
  assert.equal(hook.text, product.text, "with nothing else to say, both show the name");
  assert.ok(warnings.some((warning) => /A abertura repete o que a cena seguinte mostra \("Sorriso Pleno"\): escreva no roteiro\.json uma abertura de até 6 palavras/.test(warning)), warnings.join(" | "));
  const quiet = [];
  draftRoteiro(briefState(), KIT, TEMPLATES, { warnings: quiet });
  assert.ok(!quiet.some((warning) => /A abertura repete/.test(warning)), "an opening of its own says nothing");
});

test("words, kinds of state, prices and deadlines", () => {
  assert.deepEqual(trimWords("Seu sorriso novo em 90 dias", 6), { text: "Seu sorriso novo em 90 dias", cut: false });
  assert.deepEqual(trimWords("Um sorriso novo para você em apenas noventa dias", 6), { text: "Um sorriso novo para você", cut: true }, "never ends on a dangling preposition");
  assert.deepEqual(trimWords("Frio chegou. A lã também chegou para ficar de vez", 6), { text: "Frio chegou.", cut: true }, "ends at a sentence that closes inside the limit");
  assert.deepEqual(trimWords("Loja X — moda fitness para todo dia e toda hora", 5), { text: "Loja X — moda fitness", cut: true }, "a dash is not a word");
  assert.deepEqual(trimWords("Apps prontos para a sua IA", 5), { text: "Apps prontos para sua IA", cut: true }, "the article before a possessive goes before anything is cut");
  assert.deepEqual(trimWords("A sua IA instala e usa", 5), { text: "Sua IA instala e usa", cut: true }, "and the next word takes the capital");
  assert.deepEqual(trimWords("A sua IA instala, configura e usa", 4), { text: "Sua IA instala", cut: true }, "then the usual cut");
  assert.deepEqual(trimWords("A casa nova da sua família", 3), { text: "A casa nova", cut: true }, "an article before a noun stays");
  assert.equal(countWords("Loja X — moda"), 3);
  assert.equal(kindFor("Clique no botão"), "botao");
  assert.equal(kindFor("Digite seu e-mail"), "campo");
  assert.equal(kindFor("Carregando…"), "carregando");
  assert.equal(kindFor("Pronto!"), "sucesso");
  assert.equal(kindFor("Gráfico de vendas"), "grafico");
  assert.equal(kindFor("Lista de tarefas"), "lista");
  assert.equal(kindFor("Notificação no celular"), "aviso");
  assert.equal(kindFor("Pesquisar cliente"), "busca");
  assert.equal(kindFor("Plano mensal"), "cartao");
  assert.equal(kindFor("Gráfico de vendas", ["botao", "cartao"]), "cartao", "only the kinds the template draws");
  assert.deepEqual(defaultEvents("ponto", 1), [{ beat: 0, type: "pop" }, { beat: 2, type: "click" }]);
  assert.deepEqual(defaultEvents("estado", 0.5, { kind: "sucesso" }), [{ beat: 0, type: "ding" }]);
  assert.deepEqual(defaultEvents("prazo", 0.5), [{ beat: 0, type: "tick" }], "events never fall after the end of a short scene");
  assert.equal(productText("Casaco de lã por R$ 199 até domingo"), "Casaco de lã");
  assert.equal(productText("Kit completo de R$ 299 por R$ 199,90 à vista"), "Kit completo");
  assert.equal(productText("a nova coleção de inverno"), "a nova coleção de inverno");
  assert.deepEqual(offerFrom({ texts: ["Casaco de R$ 299 por R$ 199,90 em até 3x sem juros"] }), { value: 199.9, old_value: 299, terms: "em até 3x sem juros", source: "pedido" });
  assert.deepEqual(offerFrom({ texts: ["", "Bota por R$ 1.299"] }), { value: 1299, old_value: null, terms: null, source: "pedido" });
  assert.equal(offerFrom({ texts: ["um casaco bonito"], subject: "um casaco bonito", kit: KIT }), null);
  assert.equal(offerFrom({ texts: [], subject: "plano família", kit: KIT }).value, 89.9);
  assert.equal(deadlineFrom(["Promoção só até domingo, corre"]), "Só até domingo");
  assert.equal(deadlineFrom(["vale até 30/11"]), "Até 30/11");
  assert.equal(deadlineFrom(["somente hoje"]), "Somente hoje");
  assert.equal(deadlineFrom(["por tempo limitado"]), "Por tempo limitado");
  assert.equal(deadlineFrom(["sem prazo nenhum"]), null);
});

/* ------------------------------------------------------------------ */
/* The project files                                                  */
/* ------------------------------------------------------------------ */

test("slugs, the layout of a video folder and the materials note", (t) => {
  const root = scratch(t);
  assert.equal(slugOf("estudio-de-video/Loja X — lançamento/"), "loja-x-lancamento");
  assert.equal(slugOf("Sorriso Pleno"), "sorriso-pleno");
  assert.throws(() => slugOf(""), (error) => error.code === "usage");
  assert.throws(() => slugOf("marcas"), (error) => error.code === "usage", "the brands folder is not a video");
  assert.equal(freeSlug(root, "lojax-lancamento"), "lojax-lancamento");
  for (const name of ["lojax-lancamento", "lojax-lancamento-2"]) {
    mkdirSync(join(root, "estudio-de-video", name), { recursive: true });
    writeFileSync(join(root, "estudio-de-video", name, "pedido.json"), "{}");
  }
  mkdirSync(join(root, "estudio-de-video", "lojax-lancamento-3"), { recursive: true });
  assert.equal(freeSlug(root, "lojax-lancamento"), "lojax-lancamento-3", "a folder without pedido.json is not a video yet");
  const long = "a".repeat(40);
  mkdirSync(join(root, "estudio-de-video", long), { recursive: true });
  writeFileSync(join(root, "estudio-de-video", long, "pedido.json"), "{}");
  assert.equal(freeSlug(root, long), `${"a".repeat(38)}-2`, "at most 40 characters, the number included");
  assert.equal(freeSlug(root, "marcas"), "marcas-video");

  const paths = layout(join(root, "estudio-de-video", "demo"));
  const names = Object.fromEntries(Object.entries(paths).filter(([, value]) => typeof value === "string" && value.startsWith(root)).map(([key, value]) => [key, value.slice(join(root, "estudio-de-video", "demo").length + 1).replace(/\\/g, "/")]));
  assert.deepEqual(
    [names.state, names.brief, names.roteiro, names.page, names.motion, names.studio, names.readme, names.music, names.musicBeats, names.events, names.sfx, names.preview, names.sheet, names.previewReport, names.final, names.cover, names.notes, names.report],
    ["pedido.json", "briefing.md", "roteiro.json", "pagina.html", "motion.js", "studio.js", "materiais/LEIA-ME.txt", "audio/trilha.wav", "audio/trilha.beats.json", "audio/eventos.json", "audio/efeitos.wav", "previa/previa.mp4", "previa/quadros/folha.png", "previa/aceite.json", "entrega/demo.mp4", "entrega/capa.png", "entrega/notas.md", "entrega/relatorio.json"],
  );
  for (const said of ["PNG ou SVG", "Fotos de produto", "Prints de telas", "depois do login", "direito de usá-la", "nunca são alterados", "senhas"]) assert.ok(README_TEXT.includes(said), said);
  assert.doesNotMatch(README_TEXT, /no seu terminal|winget|brew install|apt install|npm install/i);

  const state = { slug: "demo", history: [] };
  writeState(paths.dir, state, { now: "2026-10-07T12:00:00.000Z", step: "intake", note: "pedido" });
  const saved = readJsonFile(paths.state);
  assert.equal(saved.updated_at, "2026-10-07T12:00:00.000Z");
  assert.deepEqual(saved.history, [{ at: "2026-10-07T12:00:00.000Z", step: "intake", note: "pedido" }]);
  assert.deepEqual(readdirSync(paths.dir), ["pedido.json"], "no temporary file is left behind");
});

test("materials are sorted by name and by what the name says; an edited roteiro adopts the files it points at", (t) => {
  const root = scratch(t);
  const dir = join(root, "estudio-de-video", "demo");
  mkdirSync(join(dir, "materiais"), { recursive: true });
  mkdirSync(join(dir, "assets"), { recursive: true });
  mkdirSync(join(root, "capturas", "site"), { recursive: true });
  for (const name of ["LEIA-ME.txt", "Logo da Marca.svg", "2-bota.jpg", "1-casaco.jpg", "Tela Agenda.png", "print-pagamento.PNG", "minha música.mp3", "contrato.pdf", "Ação.webp"]) writeFileSync(join(dir, "materiais", name), name);
  writeFileSync(join(dir, "assets", "logo.svg"), "logo");
  writeFileSync(join(root, "capturas", "site", "desktop-full.png"), "desktop");
  const found = scanMaterials(dir);
  const base = (file) => file.slice(join(dir, "materiais").length + 1);
  assert.equal(base(found.logo), "Logo da Marca.svg");
  assert.deepEqual(found.screens.map(base), ["print-pagamento.PNG", "Tela Agenda.png"]);
  assert.deepEqual(found.images.map(base), ["1-casaco.jpg", "2-bota.jpg", "Ação.webp"]);
  assert.deepEqual(found.audio.map(base), ["minha música.mp3"]);
  assert.deepEqual(found.ignored.map(base), ["contrato.pdf"]);
  assert.deepEqual(scanMaterials(join(root, "nenhum")).images, []);

  const edited = patch(SAMPLE, (roteiro) => {
    roteiro.scenes[2].image = "materiais/Ação.webp";
    roteiro.scenes[3].image = "capturas/site/desktop-full.png";
    roteiro.scenes[4].image = "materiais/Ação.webp";
    delete roteiro.scenes[1].screen;
  });
  const adopted = adoptAssets({ root, dir, roteiro: edited });
  assert.equal(adopted.roteiro.scenes[2].image, "assets/acao.webp", "the copy gets a plain name");
  assert.equal(adopted.roteiro.scenes[3].image, "assets/desktop-full.png", "a path from the project root works too");
  assert.equal(adopted.roteiro.scenes[4].image, "assets/acao.webp", "the same file is copied once");
  assert.equal(adopted.roteiro.brand.logo, "assets/logo.svg");
  assert.equal(readFileSync(join(dir, "assets", "acao.webp"), "utf8"), "Ação.webp");
  assert.equal(readFileSync(join(dir, "materiais", "Ação.webp"), "utf8"), "Ação.webp", "the member's file stays where it is");
  assert.equal(edited.scenes[2].image, "materiais/Ação.webp", "the roteiro given is not changed");
  assert.deepEqual(adopted.adopted.map((item) => item.field), ["scenes[2].image", "scenes[3].image", "scenes[4].image"]);
  assert.throws(() => adoptAssets({ root, dir, roteiro: patch(SAMPLE, (r) => { r.scenes[2].image = "materiais/sumiu.png"; delete r.scenes[1].screen; }) }), (error) => error.code === "file_not_found" && /scenes\[2\]\.image/.test(error.message));
  assert.throws(() => adoptAssets({ root, dir, roteiro: SAMPLE }), (error) => error.code === "file_not_found" && /scenes\[1\]\.screen aponta para assets\/mobile-full\.png/.test(error.message));
  assert.throws(() => adoptAssets({ root, dir, roteiro: patch(SAMPLE, (r) => { r.scenes[2].image = "materiais/contrato.pdf"; delete r.scenes[1].screen; }) }), (error) => error.code === "file_not_found" && /precisa ser uma imagem/.test(error.message));
});

test("the page: the roteiro goes into the template's data block and cannot close it", () => {
  const template = '<!doctype html><html><body><script src="motion.js"></script><script src="studio.js"></script>\n<script id="roteiro" type="application/json">__ROTEIRO__</script>\n<script>Studio.load();</script></body></html>';
  const tricky = patch(SAMPLE, (roteiro) => {
    roteiro.scenes[0].text = 'Fecha </script><script>alert(1)</script> <!-- e "aspas" $& $1';
  });
  const html = injectRoteiro(template, tricky);
  assert.ok(!html.includes("__ROTEIRO__"));
  assert.equal(html.split("</script>").length, template.split("</script>").length, "the text cannot close the data block");
  assert.ok(!html.includes("<!-- e"), "nor open a comment inside it");
  assert.deepEqual(readRoteiroBlock(html), tricky, "and the page reads back exactly what was written");
  assert.deepEqual(JSON.parse(roteiroJson(tricky)), tricky);
  assert.throws(() => injectRoteiro("<html></html>", SAMPLE), (error) => error.code === "runtime_missing");
  assert.equal(readRoteiroBlock('<script id="roteiro" type="application/json">{quebrado</script>'), null);
});

test("the delivery notes say where each file goes, where the music came from and what failed", () => {
  const post = suggestPost({ hook: "Seu sorriso novo em 90 dias", points: ["Implantes", "Clareamento"], closing: "sorrisopleno.com.br" });
  assert.equal(post, "Seu sorriso novo em 90 dias.\n\nImplantes · Clareamento\n\nsorrisopleno.com.br");
  assert.equal(suggestPost({ hook: "Chegou!", brand: "Loja X" }), "Chegou!\n\nLoja X");
  const notes = notesMarkdown({
    title: "Sorriso Pleno — lançamento",
    files: { video: "estudio-de-video/demo/entrega/demo.mp4", cover: "estudio-de-video/demo/entrega/capa.png", report: "estudio-de-video/demo/entrega/relatorio.json" },
    info: { width: 1080, height: 1920, duration: 15, lufs: -14.1 },
    destinations: ["reels", "shorts"],
    post,
    music: "trilha original gerada aqui; livre para usar e impulsionar.",
    checks: [
      { name: "first_frame_readable", label: "Capa legível", status: "fail", summary: "O quadro 0 não tem texto." },
      { name: "safe_area", status: "pass", summary: "Tudo dentro." },
      { name: "dead_time", label: "Tempo parado", status: "warn", summary: "1,6 s sem mudança." },
      { name: "has_audio", label: "Som", status: "skip", summary: "O roteiro não tem som." },
    ],
    passed: false,
    pending: ["Confirme o direito de uso da música."],
    warnings: ["A prévia saiu sem som."],
    generatedAt: "2026-10-07T12:00:00.000Z",
  });
  for (const said of [
    "# Sorriso Pleno — lançamento: notas de entrega",
    "`estudio-de-video/demo/entrega/demo.mp4` (1080×1920, 15 s, som em -14,1 LUFS)",
    "**Instagram Reels:**",
    "**YouTube Shorts:**",
    "## Texto sugerido para o post",
    "Implantes · Clareamento",
    "trilha original gerada aqui; livre para usar e impulsionar.",
    "**Há item reprovado.**",
    "- ✗ Capa legível: O quadro 0 não tem texto.",
    "- ✓ safe_area: Tudo dentro.",
    "- △ Tempo parado: 1,6 s sem mudança.",
    "- ○ Som: O roteiro não tem som.",
    "Legenda: ✓ passou · ✗ reprovou · △ aviso · ○ não medido.",
    "## Antes de publicar",
    "- Confirme o direito de uso da música.",
    "- A prévia saiu sem som.",
  ]) assert.ok(notes.includes(said), said);
  assert.ok(!notes.includes("TikTok:**"), "only the networks of the brief");
  assert.doesNotMatch(notes, /no seu terminal|winget|brew install|npm install/i);
  assert.ok(notesMarkdown({ title: "T", files: { video: "v.mp4" }, passed: true }).includes("Nenhum item reprovado."));
});

/* ------------------------------------------------------------------ */
/* Scratch projects                                                   */
/* ------------------------------------------------------------------ */

const standInPage = (id) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${id}</title></head>
<body><canvas id="c" width="1080" height="1920"></canvas>
<script src="motion.js"></script>
<script src="studio.js"></script>
<script id="roteiro" type="application/json">__ROTEIRO__</script>
<script>/* página de teste: ${id} */</script>
</body></html>
`;

/**
 * A project as a member would have it: .flyee/modules/video-studio with the app's scripts,
 * references and runtime (a minimal page for a template that does not exist yet) and
 * .flyee/modules/video-render with the stand-in Motor ("fake"), the real one ("real") or nothing ("none").
 */
function makeProject(t, { engine = "fake", runtime = true, settings = null } = {}) {
  const root = scratch(t);
  const modules = join(root, ".flyee", "modules");
  const engineDir = join(modules, "video-render");
  if (engine === "real") copyDir(ENGINE_DIR, engineDir, ["tests", ".dev", "node_modules"]);
  else if (engine === "fake") {
    mkdirSync(join(engineDir, "scripts"), { recursive: true });
    mkdirSync(join(engineDir, "runtime"), { recursive: true });
    copyFileSync(join(FIXTURES, "engine", "render.mjs"), join(engineDir, "scripts", "render.mjs"));
    copyFileSync(join(FIXTURES, "engine", "captura.json"), join(engineDir, "scripts", "captura.json"));
    copyFileSync(join(ENGINE_DIR, "runtime", "motion.js"), join(engineDir, "runtime", "motion.js"));
    writeFileSync(join(engineDir, "flyee.module.json"), JSON.stringify({ name: "video-render", version: "9.9.9" }));
    if (settings) writeFileSync(join(engineDir, "fake.json"), JSON.stringify(settings));
  }
  const appDir = join(modules, "video-studio");
  copyDir(join(APP_DIR, "scripts"), join(appDir, "scripts"));
  copyFileSync(join(APP_DIR, "flyee.module.json"), join(appDir, "flyee.module.json"));
  copyDir(join(APP_DIR, "references"), join(appDir, "references"));
  if (runtime) {
    mkdirSync(join(appDir, "runtime", "templates"), { recursive: true });
    for (const id of TEMPLATE_IDS) {
      const real = join(APP_DIR, "runtime", "templates", `${id}.html`);
      if (existsSync(real)) copyFileSync(real, join(appDir, "runtime", "templates", `${id}.html`));
      else writeFileSync(join(appDir, "runtime", "templates", `${id}.html`), standInPage(id));
    }
    if (REAL_STUDIO) copyFileSync(join(APP_DIR, "runtime", "studio.js"), join(appDir, "runtime", "studio.js"));
    else writeFileSync(join(appDir, "runtime", "studio.js"), "// studio.js de teste\n");
  }
  mkdirSync(join(root, "estudio-de-video"), { recursive: true });
  const log = join(engineDir, "calls.json");
  return {
    root,
    appDir,
    engineDir,
    script: join(appDir, "scripts", "studio.mjs"),
    dirOf: (slug) => join(root, "estudio-de-video", slug),
    calls: () => (existsSync(log) ? readJsonFile(log) : []),
    clearCalls: () => rmSync(log, { force: true }),
    configure: (next) => writeFileSync(join(engineDir, "fake.json"), JSON.stringify(next)),
    /** Writes the member's request as the AI does, and returns the path to pass to intake. */
    request(text, name = "pedido.txt") {
      writeFileSync(join(root, "estudio-de-video", name), text);
      return `estudio-de-video/${name}`;
    },
  };
}

/** Runs the script as the member's AI would, with --json, from the project root. */
function cli(project, args, { json = true } = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [project.script, ...args, ...(json ? ["--json"] : [])], {
      cwd: project.root,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, FLYEE_NO_OPEN: "1" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => {
      let parsed = null;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        // not JSON: the assertions show stdout and stderr
      }
      resolvePromise({ code, json: parsed, stdout, stderr });
    });
  });
}

const ok = async (project, args) => {
  const result = await cli(project, args);
  assert.equal(result.code, 0, `${args.join(" ")} → ${result.stdout}${result.stderr}`);
  assert.equal(result.json?.ok, true, result.stdout);
  return result.json;
};

/** The command line a next_step gives, run exactly as it is written. */
function runLine(project, line) {
  assert.ok(line.startsWith(`${SCRIPT} `) && line.endsWith(" --json"), `next_step.command is a whole command line: ${line}`);
  return cli(project, line.slice(SCRIPT.length + 1, -" --json".length).split(" "));
}

const collapse = (trail) => trail.filter((action, index) => action !== trail[index - 1]);

/**
 * Does what the member's AI does: follows next_step until the video is done. A question round is
 * answered with `answers` (by question id) and the rest is left to the app ("decida por mim").
 * With `resume`, `status` must tell the same next step after every command.
 */
async function follow(project, slug, start, { answers = {}, resume = false, stopAt = null, onStep = null } = {}) {
  const trail = [];
  const results = {};
  let next = start;
  for (let step = 0; step < 40; step++) {
    const action = next?.action ?? null;
    trail.push(action);
    if (!action || action === "done" || action === stopAt) return { trail, results, next };
    let result;
    if (action === "ask") {
      const status = await ok(project, ["status", slug]);
      assert.ok(status.round, "an ask comes with a round");
      const given = Object.fromEntries(status.round.questions.filter((question) => answers[question.id] !== undefined).map((question) => [question.id, answers[question.id]]));
      if (Object.keys(given).length) {
        const file = join(project.root, "estudio-de-video", `respostas-${slug}-${step}.json`);
        writeFileSync(file, JSON.stringify(given));
        result = await cli(project, ["answer", slug, "--file", file, "--decide"]);
      } else result = await cli(project, ["answer", slug, "--decide"]);
    } else if (action === "confirm_brand") result = await cli(project, ["answer", slug, "conferir_marca", "sim"]);
    else if (action === "approve_brief") result = await cli(project, ["approve", slug, "brief"]);
    else if (action === "approve_preview") result = await cli(project, ["approve", slug, "preview"]);
    else result = await runLine(project, next.command);
    assert.equal(result.code, 0, `${action} → ${result.stdout}${result.stderr}`);
    assert.ok(result.json.next_step && typeof result.json.next_step.action === "string" && typeof result.json.next_step.say === "string", `${action}: every result carries next_step`);
    if (resume) {
      const status = await ok(project, ["status", slug]);
      assert.deepEqual(status.next_step, result.json.next_step, `status after ${action} tells the same next step`);
    }
    results[action] = result.json;
    if (onStep) await onStep(action, result.json);
    next = result.json.next_step;
  }
  assert.fail(`the video did not finish in 40 steps: ${trail.join(", ")}`);
}

const R1 = "Faça um vídeo animado";
const R2 = "Faz um vídeo de 15 segundos da lojax.com.br para o Reels";
const R3 = `Crie um vídeo de lançamento da Sorriso Pleno (https://www.sorrisopleno.com.br), com 15 segundos, para o Reels e o TikTok, apresentando a clínica.

A história:
1. Abre com "Seu sorriso novo em 90 dias"
2. Implantes dentários
3. Clareamento a laser
4. Alinhadores invisíveis
5. Fecha com o logo e o site

Música a 120 BPM. Primeiro em 16:9, depois em 9:16.
`;
const R4 = "Quero um anúncio de 20 s da insiderstore.com.br com as peças da coleção, fecha com o link na bio";

/** A video taken up to a step, for the tests that start in the middle. */
async function videoAt(project, { request = R3, until = "preview" } = {}) {
  const intake = await ok(project, ["intake", "--request", project.request(request)]);
  const slug = intake.slug;
  const stops = { capture: "build", build: "preview", preview: "approve_preview" };
  const walked = await follow(project, slug, intake.next_step, { answers: { marca: "sorrisopleno.com.br" }, stopAt: stops[until] ?? until });
  return { slug, dir: project.dirOf(slug), ...walked };
}

describe("the script in a member's project", { concurrency: 4, skip: REAL_INTAKE ? false : "falta a lógica do briefing do app (scripts/lib/intake.mjs, scripts/lib/request.mjs, references/perguntas.json)" }, () => {
  test("check and the commands without the Motor: it says what to install, and exits 2 on bad input", { timeout: 240000 }, async (t) => {
    const project = makeProject(t, { engine: "none" });
    const checked = await ok(project, ["check"]);
    assert.equal(checked.command, "check");
    assert.equal(checked.interface_version, 1);
    assert.deepEqual(checked.app, { name: "video-studio", version: checked.version });
    assert.equal(checked.video_render.installed, false);
    assert.equal(checked.video_render.install, ENGINE_INSTALL);
    assert.equal(checked.video_render.dry_run, ENGINE_DRY_RUN);
    assert.equal(checked.engine, null);
    assert.equal(checked.modes.render, false);
    assert.ok(checked.features.includes("motion_video") && checked.features.includes("brand_capture"));
    assert.deepEqual(checked.limits.duration, [6, 20]);
    assert.deepEqual(checked.limits.roteiros, TEMPLATE_IDS);
    assert.deepEqual(checked.next_step, { action: "install", command: ENGINE_DRY_RUN, say: checked.next_step.say, after_yes: ENGINE_INSTALL }, "what the Motor declares first, the install after the member's yes");
    assert.equal(checked.guides.roteiros_json, ".flyee/modules/video-studio/references/roteiros.json");
    assert.equal(checked.guides.perguntas, ".flyee/modules/video-studio/references/perguntas.json");

    // the brief works without the Motor; what needs it says so
    const intake = await ok(project, ["intake", "--request", project.request(R3)]);
    for (const args of [["capture", intake.slug], ["build", intake.slug], ["preview", intake.slug], ["final", intake.slug, "--direct"]]) {
      const refused = await cli(project, args);
      assert.equal(refused.code, 1, args.join(" "));
      assert.equal(refused.json.error.code, "video_render_missing", args.join(" "));
      assert.equal(refused.json.error.fix, ENGINE_FIX);
    }
    const unknown = await cli(project, ["dance"]);
    assert.equal(unknown.code, 2);
    assert.equal(unknown.json.error.code, "usage");
    assert.equal((await cli(project, ["status"])).code, 2);
    assert.equal((await cli(project, ["approve", intake.slug])).code, 2);
    assert.equal((await cli(project, ["approve", intake.slug, "roteiro"])).json.error.code, "usage");
    assert.equal((await cli(project, ["build", intake.slug, "--rapido"])).json.error.code, "usage");
    const missing = await cli(project, ["status", "nao-existe"]);
    assert.equal(missing.code, 1);
    assert.equal(missing.json.error.code, "video_not_found");
    assert.match(missing.json.error.fix, /list --json/);
    for (const name of ["answer", "capture", "brief", "build", "preview", "final", "open"]) assert.equal((await cli(project, [name, "nao-existe", ...(name === "answer" ? ["marca", "x"] : [])])).json.error.code, "video_not_found", name);
    const help = await ok(project, ["help"]);
    assert.match(help.text, /Comandos/);
    for (const name of ["check", "intake", "answer", "capture", "brief", "approve", "build", "preview", "final", "status", "list", "open"]) assert.match(help.text, new RegExp(`\\n  ${name}\\b`), name);
    assert.doesNotMatch(help.text, /no seu terminal|winget install|brew install|apt install|npm install/i);
    const human = await cli(project, ["status", "nao-existe"], { json: false });
    assert.match(human.stdout, /^Erro \(video_not_found\): /);
    assert.match(human.stdout, /Como resolver: /);
    const empty = await ok(project, ["list"]);
    assert.equal(empty.videos.length, 1);
  });

  test("check with the Motor: its tools and modes, what to install, a missing part of the app", { timeout: 240000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    const checked = await ok(project, ["check"]);
    assert.equal(checked.video_render.installed, true);
    assert.equal(checked.video_render.version, "9.9.9");
    assert.equal(checked.video_render.path, ".flyee/modules/video-render/scripts/render.mjs");
    assert.equal(checked.engine.tools.ffmpeg, "fake");
    assert.deepEqual(checked.modes, { render: true, capture: true, sound: true });
    assert.deepEqual(checked.install, {});
    assert.equal(checked.runtime.complete, true);
    assert.equal(checked.next_step.action, "intake");
    assert.equal(checked.next_step.command, `${SCRIPT} intake --request estudio-de-video/pedido.txt --json`);
    assert.equal(checked.engine.guides.interface, ".flyee/modules/video-render/references/interface.md");
    assert.deepEqual(project.calls(), [["check"]]);
    assert.equal(await cli(project, ["check"], { json: false }).then((run) => /Motor de vídeo 9\.9\.9: instalado/.test(run.stdout)), true);

    project.configure({ render: false, install: { ffmpeg: "npx --yes flyee@latest need ffmpeg --yes --json" } });
    const needs = await ok(project, ["check"]);
    assert.equal(needs.modes.render, false);
    assert.deepEqual(needs.install, { ffmpeg: "npx --yes flyee@latest need ffmpeg --yes --json" });
    assert.equal(needs.next_step.action, "install");
    assert.equal(needs.next_step.command, "npx --yes flyee@latest need ffmpeg --yes --json", "the script never installs: it hands the command to the AI");

    rmSync(join(project.appDir, "runtime", "templates", "lista.html"));
    project.configure({});
    const broken = await ok(project, ["check"]);
    assert.equal(broken.runtime.complete, false);
    assert.deepEqual(broken.runtime.missing, ["runtime/templates/lista.html"]);
    assert.equal(broken.modes.render, false);
    assert.equal(broken.next_step.command, "npx --yes flyee@latest add video-studio --yes --json");
  });

  test("R1, the empty request: the guided brief, the brand, the yes to the brief, the preview, the yes, the final", { timeout: 600000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    const before = listFiles(project.appDir);
    const intake = await ok(project, ["intake", "--request", project.request(R1)]);
    assert.equal(intake.command, "intake");
    assert.equal(intake.sufficiency, "vazio");
    assert.equal(intake.mode, "guided");
    assert.equal(intake.dir, `estudio-de-video/${intake.slug}`);
    assert.match(intake.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(intake.slug.length <= 40);
    assert.deepEqual(intake.unsupported, []);
    assert.equal(typeof intake.linha, "string");
    assert.equal(intake.round.n, 1);
    assert.equal(intake.round.questions.length, 4, "the first round of an empty request has four questions");
    assert.deepEqual(intake.round.questions.map((question) => question.id).sort(), ["duracao", "marca", "objetivo", "onde"]);
    assert.ok(Array.isArray(intake.round.ask_user_question) && typeof intake.round.chat_text === "string");
    assert.deepEqual(intake.next_step.action, "ask");
    assert.equal(intake.next_step.command, null, "a question to the member has no command");
    const dir = project.dirOf(intake.slug);
    assert.deepEqual(listFiles(dir).sort(), ["materiais/LEIA-ME.txt", "pedido.json"]);
    const state = readJsonFile(join(dir, "pedido.json"));
    assert.equal(state.format_version, 1);
    assert.deepEqual(state.app, { name: "video-studio", version: intake.app.version });
    assert.equal(state.request, R1);
    assert.equal(state.slug, intake.slug);
    assert.equal(state.status, "intake");
    assert.deepEqual(state.next_step, intake.next_step);
    assert.equal(state.history.at(-1).step, "intake");
    assert.match(state.updated_at, /^\d{4}-\d{2}-\d{2}T/);

    const seen = {};
    const walked = await follow(project, intake.slug, intake.next_step, {
      answers: { marca: "sorrisopleno.com.br" },
      resume: true,
      onStep: (action, result) => {
        seen[action] = result;
      },
    });
    assert.match(collapse(walked.trail).join(","), /^ask,capture,ask,echo,approve_brief,build,preview,approve_preview,final(,deliver)?,done$/, walked.trail.join(","));
    const questions = walked.trail.filter((action) => action === "ask").length;
    assert.ok(questions <= 3, `at most three rounds (${questions})`);

    // the capture, the brief and the approvals
    assert.equal(seen.capture.captured, true);
    assert.equal(seen.capture.brand.name, "Sorriso Pleno");
    assert.equal(seen.capture.kit, "estudio-de-video/marcas/sorrisopleno/marca.json");
    assert.equal(seen.capture.capture_dir, "capturas/sorrisopleno-com-br");
    assert.equal(seen.capture.confirm, null, "a site the member gave needs no confirmation");
    assert.equal(seen.capture.brand.confirmed, true);
    assert.ok(seen.capture.round, "the story round comes with the capture, its options filled from the site");
    assert.equal(typeof seen.echo.echo, "string");
    assert.ok(seen.echo.echo.length > 40);
    assert.equal(seen.echo.briefing, `estudio-de-video/${intake.slug}/briefing.md`);
    assert.equal(seen.echo.question.id, "aprovar_briefing");
    assert.ok(existsSync(join(dir, "briefing.md")));
    assert.match(seen.approve_brief.approvals.brief, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(seen.approve_brief.approved, "brief");

    // build, preview and final wrote what the layout promises, and nothing else
    assert.equal(seen.build.roteiro, `estudio-de-video/${intake.slug}/roteiro.json`);
    assert.equal(seen.build.page, `estudio-de-video/${intake.slug}/pagina.html`);
    assert.ok(seen.build.scenes.length >= 4);
    assert.deepEqual(Object.keys(seen.build.scenes[0]).slice(0, 6), ["n", "role", "bars", "start", "end", "text"]);
    assert.equal(seen.build.scenes[0].start, 0);
    assert.equal(seen.build.scenes.at(-1).end, seen.build.duration);
    assert.equal(seen.preview.preview, `estudio-de-video/${intake.slug}/previa/previa.mp4`);
    assert.deepEqual([seen.preview.width, seen.preview.height], [540, 960]);
    assert.equal(seen.preview.sheet, `estudio-de-video/${intake.slug}/previa/quadros/folha.png`);
    assert.equal(seen.preview.accept.passed, true);
    assert.equal(seen.preview.accept.report, `estudio-de-video/${intake.slug}/previa/aceite.json`);
    assert.equal(seen.preview.question.id, "previa_ok");
    assert.equal(seen.preview.question.approve_command, `${SCRIPT} approve ${intake.slug} preview --json`);
    assert.ok(seen.preview.texts.length >= 4 && seen.preview.texts.every((item) => typeof item.text === "string" && typeof item.start === "number" && item.from));
    const opening = seen.preview.questions.find((question) => question.id === "abertura");
    assert.ok(opening, "the opening came from the site: the member is offered another real one");
    assert.match(opening.text, /Seu sorriso novo em 90 dias/);
    assert.doesNotMatch(JSON.stringify(opening), /\{gancho/, "every placeholder is filled");
    assert.ok(opening.options.some((option) => option.label.includes("Implantes, clareamento e alinhadores invisíveis")), JSON.stringify(opening.options));
    assert.equal(opening.answer_command, `${SCRIPT} answer ${intake.slug} abertura <value> --json`);
    assert.equal(seen.final.file, `estudio-de-video/${intake.slug}/entrega/${intake.slug}.mp4`);
    assert.deepEqual([seen.final.width, seen.final.height], [1080, 1920]);
    assert.equal(seen.final.cover, `estudio-de-video/${intake.slug}/entrega/capa.png`);
    assert.equal(seen.final.notes, `estudio-de-video/${intake.slug}/entrega/notas.md`);
    assert.equal(seen.final.accept.passed, true);
    assert.equal(seen.final.loudness.integrated_lufs, -14.1);
    assert.deepEqual(readdirSync(join(dir, "entrega")).sort(), ["capa.png", `${intake.slug}.mp4`, "notas.md", "relatorio.json"].sort(), "the delivery folder holds the deliverables only");
    const notes = readFileSync(join(dir, "entrega", "notas.md"), "utf8");
    assert.equal(notes, seen.final.notes_text);
    assert.ok(notes.includes("trilha original gerada aqui; livre para usar e impulsionar."));
    assert.ok(notes.includes("Nenhum item reprovado."));
    assert.match(notes, /odontologia/, "a sector with its own advertising rules is a reminder before publishing");
    const report = readJsonFile(join(dir, "entrega", "relatorio.json"));
    assert.equal(report.passed, true);
    assert.equal(report.file, seen.final.file);
    assert.equal(report.media.width, 1080);
    assert.ok(report.accept.checks.length >= 6);

    // the page carries the roteiro; the libraries sit beside it
    const roteiro = readJsonFile(join(dir, "roteiro.json"));
    const html = readFileSync(join(dir, "pagina.html"), "utf8");
    assert.ok(!html.includes("__ROTEIRO__"));
    assert.deepEqual(readRoteiroBlock(html), roteiro);
    assert.match(html, /<script src="motion\.js"><\/script>/);
    assert.match(html, /<script src="studio\.js"><\/script>/);
    assert.equal(readFileSync(join(dir, "motion.js"), "utf8"), readFileSync(join(ENGINE_DIR, "runtime", "motion.js"), "utf8"), "motion.js comes from the Motor");
    assert.equal(readFileSync(join(dir, "studio.js"), "utf8"), readFileSync(join(project.appDir, "runtime", "studio.js"), "utf8"), "studio.js comes from this app");
    assert.equal(roteiro.brand.name, "Sorriso Pleno");
    assert.equal(roteiro.brand.logo, "assets/logo.svg");
    assert.equal(roteiro.palette.accent, "#7C3AED", "the brand's own colour");
    for (const file of ["assets/logo.svg", "assets/mobile.png", "assets/mobile-full.png", "audio/trilha.wav", "audio/eventos.json", "audio/efeitos.wav", "audio/batidas.json", "previa/aceite.json"]) assert.ok(existsSync(join(dir, file)), file);
    assert.deepEqual(readJsonFile(join(dir, "audio", "eventos.json")), eventsFile(roteiro));
    assert.deepEqual(readJsonFile(join(dir, "audio", "efeitos.wav.received.json")).events, eventsFile(roteiro).events, "the Motor got the effects of the roteiro");

    // nothing outside estudio-de-video/ and capturas/, and nothing inside the installed apps
    assert.deepEqual(readdirSync(project.root).sort(), [".flyee", "capturas", "estudio-de-video"]);
    assert.deepEqual(listFiles(project.appDir), before, "the app's own folder is not written to");
    assert.deepEqual(listFiles(project.engineDir).sort(), ["calls.json", "flyee.module.json", "runtime/motion.js", "scripts/captura.json", "scripts/render.mjs"]);
    assert.deepEqual(readdirSync(join(project.root, "estudio-de-video")).filter((name) => !name.startsWith("respostas-")).sort(), [intake.slug, "marcas", "pedido.txt"].sort());
    assert.ok(listFiles(dir).every((file) => !file.endsWith(".tmp")), "no temporary file is left behind");

    // the state at the end, and the list
    const done = await ok(project, ["status", intake.slug]);
    assert.equal(done.next_step.action, "done");
    assert.deepEqual(done.files.final && done.files.preview && done.files.roteiro && done.files.kit, true);
    assert.equal(done.final.passed, true);
    const listed = await ok(project, ["list"]);
    assert.deepEqual(listed.videos.map((video) => video.slug), [intake.slug]);
    assert.equal(listed.videos[0].next_step.action, "done");
    assert.deepEqual(listed.brands.map((brand) => brand.slug), ["sorrisopleno"]);
  });

  test("R3, the complete request: zero questions, and the exact command lines the Motor receives", { timeout: 600000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    const intake = await ok(project, ["intake", "--request", project.request(R3)]);
    assert.equal(intake.sufficiency, "completo");
    assert.equal(intake.mode, "complete");
    assert.equal(intake.round, null, "a complete request gets no questions");
    assert.ok(intake.unsupported.some((item) => item.kind === "format"), "16:9 is noted as something this version does not do");
    assert.equal(intake.fields.brand.source, "pedido");
    assert.equal(hostOf(intake.fields.brand.value.site), "sorrisopleno.com.br");
    assert.equal(intake.next_step.action, "capture");
    assert.equal(intake.next_step.command, `${SCRIPT} capture ${intake.slug} --json`);
    const slug = intake.slug;
    const dir = project.dirOf(slug);
    const p = `estudio-de-video/${slug}`;
    const seen = {};
    const walked = await follow(project, slug, intake.next_step, { resume: true, onStep: (action, result) => { seen[action] = result; } });
    assert.match(walked.trail.join(","), /^capture,build,preview,approve_preview,final(,deliver)?,done$/, "no question, no stop at the brief");
    assert.ok(!existsSync(join(dir, "briefing.md")) || true);

    const roteiro = readJsonFile(join(dir, "roteiro.json"));
    assert.equal(roteiro.template, "lancamento");
    assert.equal(roteiro.scenes[0].text, "Seu sorriso novo em 90 dias", "the opening the request wrote");
    assert.deepEqual(roteiro.scenes.filter((scene) => scene.role === "ponto").map((scene) => scene.text), ["Implantes dentários", "Clareamento a laser", "Alinhadores invisíveis"]);
    assert.equal(roteiro.scenes.at(-1).text, "sorrisopleno.com.br");
    assert.deepEqual(seen.preview.texts.slice(0, 1).map((item) => [item.text, item.from]), [["Seu sorriso novo em 90 dias", "do pedido"]]);

    const calls = project.calls();
    const music = roteiro.music;
    assert.deepEqual(calls, [
      ["capture", "https://www.sorrisopleno.com.br", "--out", "capturas/sorrisopleno-com-br"],
      ["music", "--out", `${p}/audio/trilha.wav`, "--duration", String(roteiro.duration), "--bpm", String(roteiro.bpm), "--style", music.style, "--seed", String(music.seed), "--arc", "auto"],
      ["sfx", "--out", `${p}/audio/efeitos.wav`, "--events", `${p}/audio/eventos.json`, "--duration", String(roteiro.duration)],
      ["preview", `${p}/pagina.html`, "--out", `${p}/render/previa-sem-som.mp4`, "--format", "9:16", "--fps", "30", "--scale", "0.5"],
      ["mix", "--video", `${p}/render/previa-sem-som.mp4`, "--out", `${p}/previa/previa.mp4`, "--music", `${p}/audio/trilha.wav`, "--sfx", `${p}/audio/efeitos.wav`, "--fade-out", "0.4", "--tp", "-1.5"],
      ["frames", `${p}/pagina.html`, "--out", `${p}/previa/quadros`, "--format", "9:16", "--beats", `${p}/audio/batidas.json`, "--scale", "0.5"],
      ["help"],
      ["accept", `${p}/pagina.html`, "--format", "9:16", "--safe", "instagram-feed", "--beats", `${p}/audio/batidas.json`, "--video", `${p}/previa/previa.mp4`],
      ["render", `${p}/pagina.html`, "--out", `${p}/render/final-sem-som.mp4`, "--format", "9:16", "--fps", "30", "--sub", "2"],
      ["mix", "--video", `${p}/render/final-sem-som.mp4`, "--out", `${p}/entrega/${slug}.mp4`, "--music", `${p}/audio/trilha.wav`, "--sfx", `${p}/audio/efeitos.wav`, "--fade-out", "0.4", "--tp", "-1.5"],
      ["frames", `${p}/pagina.html`, "--out", `${p}/entrega/capa-quadro`, "--format", "9:16", "--times", "0"],
      ["help"],
      ["accept", `${p}/pagina.html`, "--format", "9:16", "--safe", "instagram-feed", "--beats", `${p}/audio/batidas.json`, "--video", `${p}/entrega/${slug}.mp4`],
      ["probe", `${p}/entrega/${slug}.mp4`],
    ], "one line per step, the music composed once and shared by the preview and the final");
    assert.equal(seen.preview.frames.length, roteiro.bars * 4, "one frame per beat");
    assert.deepEqual(readJsonFile(join(dir, "audio", "batidas.json")), beatGrid(roteiro));
  });

  test("R2 and R4: a brand without a story is guided; an almost complete request gets at most three questions and no stop at the brief", { timeout: 600000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    const second = await ok(project, ["intake", "--request", project.request(R2, "pedido-r2.txt")]);
    assert.equal(second.sufficiency, "vazio");
    assert.equal(second.mode, "guided");
    assert.equal(hostOf(second.fields.brand.value.site), "lojax.com.br");
    assert.equal(second.fields.duration.value, 15);
    assert.deepEqual(second.fields.destinations.value, ["reels"]);
    assert.ok(second.round.questions.length >= 1 && second.round.questions.length <= 2, "the brand, the network and the duration are not asked again");
    assert.ok(second.round.questions.every((question) => !["marca", "onde", "duracao"].includes(question.id)));
    assert.match(second.slug, /^lojax/);
    const decided = await ok(project, ["answer", second.slug, "--decide"]);
    assert.equal(decided.decided, true);
    assert.equal(decided.round, null, "the story waits for the capture");
    assert.equal(decided.next_step.action, "capture");
    const captured = await ok(project, ["capture", second.slug]);
    assert.equal(captured.brand.name, "Lojax");
    assert.equal(captured.kit, "estudio-de-video/marcas/lojax/marca.json");
    assert.equal(captured.round.n, 2);

    const fourth = await ok(project, ["intake", "--request", project.request(R4, "pedido-r4.txt")]);
    assert.equal(fourth.sufficiency, "parcial");
    assert.equal(fourth.mode, "partial");
    assert.ok(fourth.round && fourth.round.questions.length >= 1 && fourth.round.questions.length <= 3, "at most three questions");
    assert.equal(fourth.fields.duration.value, 20);
    assert.equal(fourth.fields.closing.value.kind, "bio");
    const walked = await follow(project, fourth.slug, fourth.next_step);
    assert.match(collapse(walked.trail).join(","), /^ask,capture,build,preview,approve_preview,final(,deliver)?,done$/, walked.trail.join(","));
    assert.ok(!existsSync(join(project.dirOf(fourth.slug), "briefing.md")), "no brief to approve on this path");
    const roteiro = readJsonFile(join(project.dirOf(fourth.slug), "roteiro.json"));
    assert.equal(roteiro.scenes.at(-1).text, "Link na bio");
    assert.equal(roteiro.brand.site, "insiderstore.com.br");
    assert.ok(walked.results.build.warnings.some((warning) => /O roteiro Oferta precisa de um preço real/.test(warning)) || roteiro.template !== "lancamento", "an offer without a real price becomes a launch, and says so");
    const listed = await ok(project, ["list"]);
    assert.deepEqual(listed.videos.map((video) => video.slug).sort(), [second.slug, fourth.slug].sort());
    assert.deepEqual(listed.brands.map((brand) => brand.slug).sort(), ["insiderstore", "lojax"]);
    assert.equal(listed.next_step.command, null, "with more than one video the member chooses");
  });

  test("intake: the request file, slugs that are taken, --slug, exists and --force", { timeout: 300000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    const none = await cli(project, ["intake"]);
    assert.equal(none.code, 2);
    const missing = await cli(project, ["intake", "--request", "estudio-de-video/nao-existe.txt"]);
    assert.equal(missing.code, 1);
    assert.equal(missing.json.error.code, "file_not_found");
    const blank = await cli(project, ["intake", "--request", project.request("  \r\n\t", "vazio.txt")]);
    assert.equal(blank.json.error.code, "request_empty");
    assert.match(blank.json.error.fix, /palavra por palavra/);
    assert.deepEqual(readdirSync(join(project.root, "estudio-de-video")).sort(), ["vazio.txt"], "a refused request creates nothing");

    // a mark at the start of the file, and the two-byte encoding Windows tools write
    writeFileSync(join(project.root, "estudio-de-video", "com marca.txt"), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(R2, "utf8")]));
    const marked = await ok(project, ["intake", "--request", "estudio-de-video/com marca.txt"]);
    assert.equal(readJsonFile(join(project.dirOf(marked.slug), "pedido.json")).request, R2, "the mark is not part of the request");
    assert.equal(marked.request_file, "estudio-de-video/com marca.txt");
    writeFileSync(join(project.root, "estudio-de-video", "utf16.txt"), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("Faça um vídeo da lojax.com.br para o Reels, 15 segundos", "utf16le")]));
    const wide = await ok(project, ["intake", "--request", "estudio-de-video/utf16.txt"]);
    assert.equal(readJsonFile(join(project.dirOf(wide.slug), "pedido.json")).request, "Faça um vídeo da lojax.com.br para o Reels, 15 segundos");

    // the same brand and kind again: the name is taken, the next one is numbered
    assert.equal(wide.slug, `${marked.slug}-2`);
    const third = await ok(project, ["intake", "--request", "estudio-de-video/com marca.txt"]);
    assert.equal(third.slug, `${marked.slug}-3`);

    const named = await ok(project, ["intake", "--request", "estudio-de-video/com marca.txt", "--slug", "Vídeo da Lojá"]);
    assert.equal(named.slug, "video-da-loja");
    writeFileSync(join(project.dirOf("video-da-loja"), "materiais", "logo.png"), "logo do integrante");
    writeFileSync(join(project.dirOf("video-da-loja"), "roteiro.json"), "{}");
    const again = await cli(project, ["intake", "--request", "estudio-de-video/com marca.txt", "--slug", "video-da-loja"]);
    assert.equal(again.code, 1);
    assert.equal(again.json.error.code, "exists");
    assert.match(again.json.error.fix, /--force/);
    const forced = await ok(project, ["intake", "--request", project.request(R1, "outro.txt"), "--slug", "video-da-loja", "--force"]);
    assert.equal(forced.slug, "video-da-loja");
    assert.equal(readJsonFile(join(project.dirOf("video-da-loja"), "pedido.json")).request, R1);
    assert.ok(!existsSync(join(project.dirOf("video-da-loja"), "roteiro.json")), "what the script made is cleared");
    assert.equal(readFileSync(join(project.dirOf("video-da-loja"), "materiais", "logo.png"), "utf8"), "logo do integrante", "the member's materials stay");
    assert.equal((await cli(project, ["intake", "--request", "estudio-de-video/outro.txt", "--slug", "marcas"])).json.error.code, "usage");
    assert.equal((await cli(project, ["intake", "video-da-loja", "--request", "estudio-de-video/outro.txt"])).code, 2);
  });

  test("intake finds the brand in the project and in the brands already kept", { timeout: 300000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    writeFileSync(join(project.root, "README.md"), "# Projeto\n\n[![build](https://img.shields.io/badge/build-ok-green)](https://github.com/acme/site)\n\nNo ar em https://www.sorrisopleno.com.br.\n");
    const first = await ok(project, ["intake", "--request", project.request(R1)]);
    assert.equal(first.project.site, "https://www.sorrisopleno.com.br");
    assert.equal(first.fields.brand.source, "projeto", "the site of the project is the brand, without asking");
    assert.equal(hostOf(first.fields.brand.value.site), "sorrisopleno.com.br");
    assert.ok(!first.round.questions.some((question) => question.id === "marca"));
    const walked = await follow(project, first.slug, first.next_step, { stopAt: "echo" });
    assert.ok(walked.trail.includes("capture"));
    assert.deepEqual(project.calls().filter((call) => call[0] === "capture").length, 1);

    // a second video of the same brand: the kit is already there, no capture, nothing asked about the brand
    project.clearCalls();
    const second = await ok(project, ["intake", "--request", project.request("Faz um vídeo de 10 segundos da sorrisopleno.com.br para o TikTok", "segundo.txt")]);
    assert.equal(second.brand.kit, "estudio-de-video/marcas/sorrisopleno/marca.json");
    assert.ok(second.warnings.some((warning) => /já estava guardada/.test(warning)));
    assert.notEqual(second.next_step.action, "capture");
    const status = await ok(project, ["status", second.slug]);
    assert.equal(status.files.kit, true);
    const reused = await ok(project, ["capture", second.slug]);
    assert.equal(reused.reused, true);
    assert.deepEqual(project.calls(), [], "a kit younger than 90 days is not captured again");
    const refreshed = await ok(project, ["capture", second.slug, "--refresh"]);
    assert.equal(refreshed.reused, false);
    assert.deepEqual(project.calls(), [["capture", "https://sorrisopleno.com.br", "--out", "capturas/sorrisopleno-com-br"]]);

    // an old kit is captured again by itself
    const kitFilePath = join(project.root, "estudio-de-video", "marcas", "sorrisopleno", "marca.json");
    const kit = readJsonFile(kitFilePath);
    writeFileSync(kitFilePath, JSON.stringify({ ...kit, captured_at: "2026-01-01T00:00:00.000Z", decisions: { publi: "nao" } }));
    project.clearCalls();
    const third = await ok(project, ["intake", "--request", "estudio-de-video/segundo.txt"]);
    assert.equal(third.brand.kit, null, "a kit older than 90 days is not taken for granted");
    assert.equal(third.next_step.action === "capture" || third.round !== null, true);
    const recaptured = await ok(project, ["capture", third.slug]);
    assert.equal(recaptured.reused, false);
    assert.equal(project.calls().length, 1);
    assert.deepEqual(readJsonFile(kitFilePath).decisions, { publi: "nao" }, "what the member decided about the brand survives a new capture");
  });

  test("answer: one value, a file, --decide, and what is refused", { timeout: 300000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    const intake = await ok(project, ["intake", "--request", project.request(R1)]);
    const slug = intake.slug;
    const objective = intake.round.questions.find((question) => question.id === "objetivo");
    const other = objective.options.find((option) => option.value !== objective.default) ?? objective.options[0];

    assert.equal((await cli(project, ["answer", slug])).code, 2);
    assert.equal((await cli(project, ["answer", slug, "objetivo"])).code, 2);
    const unknown = await cli(project, ["answer", slug, "pergunta_que_nao_existe", "x"]);
    assert.equal(unknown.code, 1);
    assert.equal(unknown.json.error.code, "question_unknown");
    assert.match(unknown.json.error.fix, /Nada foi gravado/);
    assert.match(unknown.json.error.fix, /objetivo \(/, "the fix lists the ids and the values of the round");
    const state = () => readJsonFile(join(project.dirOf(slug), "pedido.json"));
    assert.equal(state().fields.objective, undefined, "a refused answer changes nothing");

    // the value is everything after the id, joined by spaces
    const brand = await ok(project, ["answer", slug, "marca", "sorrisopleno.com.br"]);
    assert.deepEqual(brand.answered, ["marca"]);
    assert.equal(hostOf(brand.fields.brand.value.site), "sorrisopleno.com.br");
    assert.equal(brand.fields.brand.source, "resposta");
    assert.ok(!brand.round.questions.some((question) => question.id === "marca"), "an answered question leaves the round");
    assert.equal(state().answers.at(-1).id, "marca");
    assert.equal(state().history.at(-1).step, "answer");

    const file = join(project.root, "estudio-de-video", "respostas com espaço.json");
    writeFileSync(file, JSON.stringify({ objetivo: other.value, onde: ["reels", "tiktok"] }));
    const many = await ok(project, ["answer", slug, "--file", "estudio-de-video/respostas com espaço.json"]);
    assert.deepEqual(many.answered, ["objetivo", "onde"]);
    assert.equal(many.fields.objective.value, other.value);
    assert.deepEqual(many.fields.destinations.value, ["reels", "tiktok"], "a list in the file is a multiple answer");
    writeFileSync(file, "{ quebrado");
    assert.equal((await cli(project, ["answer", slug, "--file", file])).json.error.code, "invalid_json");
    writeFileSync(file, JSON.stringify({ objetivo: other.value, pergunta_que_nao_existe: "x" }));
    const partial = await cli(project, ["answer", slug, "--file", file]);
    assert.equal(partial.json.error.code, "question_unknown");
    assert.equal((await cli(project, ["answer", slug, "--file", "estudio-de-video/sumiu.json"])).json.error.code, "file_not_found");

    const decided = await ok(project, ["answer", slug, "--decide"]);
    assert.equal(decided.decided, true);
    assert.deepEqual(decided.answered, []);
    assert.equal(decided.round, null);
    assert.equal(decided.next_step.action, "capture", "the round is closed with the defaults");
    assert.ok(decided.fields.duration.value >= 6 && decided.fields.duration.value <= 20);
    assert.equal(decided.fields.duration.source, "padrao");
    const captured = await ok(project, ["capture", slug]);
    assert.ok(captured.round, "plain --decide leaves the next rounds to be asked");

    // "o resto decide você": the pending round and every later one, in one go
    const second = await ok(project, ["intake", "--request", project.request(R1, "outro.txt")]);
    const all = await ok(project, ["answer", second.slug, "marca", "lojax.com.br", "--decide", "all"]);
    assert.equal(all.decided, "all");
    assert.deepEqual(all.answered, ["marca"]);
    assert.equal(all.next_step.action, "capture");
    const afterSite = await ok(project, ["capture", second.slug]);
    assert.equal(afterSite.round, null, "no round is asked after the site: they were all decided");
    assert.equal(afterSite.next_step.action, "echo");
    assert.equal((await ok(project, ["answer", second.slug, "--decide=all"])).decided, "all", "--decide=all is the same");
    assert.equal(readJsonFile(join(project.dirOf(second.slug), "pedido.json")).history.filter((entry) => /todas as rodadas/.test(entry.note)).length, 2);
  });

  test("the gates: no build without the yes to the brief, no final without the yes to the preview", { timeout: 600000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    const video = await videoAt(project, { request: R1, until: "echo" });
    const { slug, dir } = video;
    const p = `estudio-de-video/${slug}`;

    // guided: build waits for the brief to be shown and approved
    const early = await cli(project, ["build", slug]);
    assert.equal(early.code, 1);
    assert.equal(early.json.error.code, "brief_not_approved");
    assert.match(early.json.error.fix, new RegExp(`brief ${slug} --json`));
    assert.equal(early.json.next_step.action, "echo");
    assert.equal((await cli(project, ["preview", slug])).json.error.code, "brief_not_approved", "a preview would have to build first");
    const unseen = await cli(project, ["approve", slug, "brief"]);
    assert.equal(unseen.json.error.code, "file_not_found", "a brief nobody saw cannot be approved");
    assert.ok(!existsSync(join(dir, "roteiro.json")));
    const brief = await ok(project, ["brief", slug]);
    assert.equal(brief.next_step.action, "approve_brief");
    assert.equal(brief.question.approve_command, `${SCRIPT} approve ${slug} brief --json`);
    const shown = await cli(project, ["build", slug]);
    assert.equal(shown.json.error.code, "brief_not_approved");
    assert.equal(shown.json.next_step.action, "approve_brief");
    assert.match(shown.json.error.fix, new RegExp(`${p}/briefing\\.md`));
    const approved = await ok(project, ["approve", slug, "brief", "--note", "pode ir, só não exagera no texto"]);
    assert.equal(approved.note, "pode ir, só não exagera no texto");
    assert.equal(approved.next_step.action, "build");
    assert.equal(readJsonFile(join(dir, "pedido.json")).approvals.brief_note, "pode ir, só não exagera no texto");
    const built = await ok(project, ["build", slug]);
    assert.equal(built.next_step.action, "preview");

    // the final waits for a preview and for the yes to it
    const noPreview = await cli(project, ["final", slug]);
    assert.equal(noPreview.code, 1);
    assert.equal(noPreview.json.error.code, "preview_not_approved");
    assert.equal(noPreview.json.next_step.action, "preview");
    assert.equal((await cli(project, ["approve", slug, "preview"])).json.error.code, "file_not_found", "a preview that does not exist cannot be approved");
    const preview = await ok(project, ["preview", slug]);
    assert.equal(preview.next_step.action, "approve_preview");
    const notYet = await cli(project, ["final", slug]);
    assert.equal(notYet.json.error.code, "preview_not_approved");
    assert.equal(notYet.json.next_step.action, "approve_preview");
    assert.match(notYet.json.error.fix, new RegExp(`approve ${slug} preview --json`));
    assert.ok(!existsSync(join(dir, "entrega")), "a refused final renders nothing");
    assert.equal((await ok(project, ["approve", slug, "preview"])).next_step.action, "final");

    // a change after the yes: the yes was for another video
    const roteiro = readJsonFile(join(dir, "roteiro.json"));
    roteiro.scenes[0].text = "Sorria sem medo";
    writeFileSync(join(dir, "roteiro.json"), JSON.stringify(roteiro, null, 2));
    const stale = await ok(project, ["status", slug]);
    assert.equal(stale.approvals.preview, null, "the approval of an older preview does not count");
    assert.equal(stale.next_step.action, "build");
    assert.ok(stale.warnings.some((warning) => /roteiro\.json mudou/.test(warning)));
    const refused = await cli(project, ["final", slug]);
    assert.equal(refused.json.error.code, "preview_not_approved");
    assert.match(refused.json.error.message, /mudou depois da prévia/);
    project.clearCalls();
    const again = await ok(project, ["preview", slug]);
    assert.ok(again.warnings.some((warning) => /a página foi refeita/.test(warning)), "preview rebuilds a page whose roteiro changed");
    assert.equal(again.texts[0].text, "Sorria sem medo");
    assert.equal(again.texts[0].from, "ajustado no roteiro");
    assert.deepEqual(project.calls().map((call) => call[0]), ["preview", "mix", "frames", "help", "accept"], "the music and the effects did not change and are kept");
    assert.equal((await cli(project, ["final", slug])).json.error.code, "preview_not_approved");
    await ok(project, ["approve", slug, "preview"]);
    const final = await ok(project, ["final", slug]);
    assert.equal(final.accept.passed, true);

    // an answer after the yes to the brief is the member's own change: the yes stays and briefing.md follows
    const briefBefore = readFileSync(join(dir, "briefing.md"), "utf8");
    const longer = await ok(project, ["answer", slug, "duracao", "20"]);
    assert.ok(longer.warnings.some((warning) => /O briefing foi atualizado com esta resposta .*o sim ao briefing continua valendo/.test(warning)), JSON.stringify(longer.warnings));
    assert.ok(longer.warnings.some((warning) => /ajustado à mão/.test(warning)), "and an adjusted roteiro is not rewritten behind the AI's back");
    assert.notEqual(readFileSync(join(dir, "briefing.md"), "utf8"), briefBefore);
    assert.ok(readJsonFile(join(dir, "pedido.json")).approvals.brief, "the yes to the brief stays");
    assert.notEqual(longer.next_step.action, "echo");
    const rebuilt = await ok(project, ["build", slug, "--force"]);
    assert.equal(rebuilt.duration, 20, "the change reaches the video");
  });

  test("the questions that go with the preview: a paid partnership is asked once and needs its own answer", { timeout: 600000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    const intake = await ok(project, ["intake", "--request", project.request(`${R3}\nÉ uma parceria paga com a clínica.`, "publi.txt")]);
    const walked = await follow(project, intake.slug, intake.next_step, { stopAt: "approve_preview" });
    const preview = walked.results.preview;
    assert.deepEqual(preview.questions.map((question) => question.id), ["publi"], "the opening came from the request: no other is offered");
    assert.equal(preview.questions[0].answer_command, `${SCRIPT} answer ${intake.slug} publi <value> --json`);
    assert.equal(preview.question.id, "previa_ok");
    assert.equal(preview.question.approve_command, `${SCRIPT} approve ${intake.slug} preview --json`);
    assert.equal(preview.question.answer_command, undefined, "the yes to the preview is recorded with approve, never with answer");
    const loose = await cli(project, ["answer", intake.slug, "publi", "ok"]);
    assert.equal(loose.json.error.code, "answer_invalid", "a rights decision needs its own answer, never a loose ok");
    await ok(project, ["answer", intake.slug, "publi", "sim"]);
    const again = await ok(project, ["preview", intake.slug]);
    assert.deepEqual(again.questions, [], "a decision is asked once");
    assert.equal(again.next_step.action, "approve_preview", "the decision does not change the video");
    await ok(project, ["approve", intake.slug, "preview"]);
    const final = await ok(project, ["final", intake.slug]);
    assert.ok(final.pending.some((item) => /#publi/.test(item)), JSON.stringify(final.pending));
  });

  test("--direct and a request that says not to wait: the final without the yes to the preview", { timeout: 600000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    const video = await videoAt(project, { request: R3, until: "capture" });
    project.clearCalls();
    const direct = await ok(project, ["final", video.slug, "--direct"]);
    assert.equal(direct.accept.passed, true);
    assert.deepEqual(project.calls().map((call) => call[0]), ["music", "sfx", "render", "mix", "frames", "help", "accept", "probe"], "builds, composes and renders in one go");
    assert.ok(existsSync(join(video.dir, "roteiro.json")));
    assert.equal(readJsonFile(join(video.dir, "pedido.json")).delivery.direct, true);

    const hurry = await ok(project, ["intake", "--request", project.request(`${R3}\nFaz direto, não precisa me mostrar a prévia.`, "direto.txt")]);
    assert.equal(hurry.fields.skip_preview.value, true);
    const walked = await follow(project, hurry.slug, hurry.next_step);
    assert.match(walked.trail.join(","), /^(capture,)?build,preview,final(,deliver)?,done$/, "the preview is still made; only the stop is skipped");
  });

  test("build keeps a roteiro adjusted by hand, always rewrites the page from it, and says exactly what is wrong in an invalid one", { timeout: 600000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    const video = await videoAt(project, { request: R3, until: "build" });
    const { slug, dir } = video;
    const file = join(dir, "roteiro.json");
    const original = readJsonFile(file);
    const again = await ok(project, ["build", slug]);
    assert.deepEqual(again.kept, { roteiro: false }, "an untouched draft is simply written again");
    assert.deepEqual(readJsonFile(file), original, "and the same brief gives the same roteiro");

    // an edit that breaks a rule: the scene and the field are named, and the page is not touched
    const page = readFileSync(join(dir, "pagina.html"), "utf8");
    const broken = patch(original, (roteiro) => {
      roteiro.scenes[2].text = "Implantes dentários fixos em uma única sessão rápida";
    });
    writeFileSync(file, JSON.stringify(broken, null, 2));
    const invalid = await cli(project, ["build", slug]);
    assert.equal(invalid.code, 1);
    assert.equal(invalid.json.error.code, "roteiro_invalid");
    assert.match(invalid.json.error.message, /^roteiro\.json: scenes\[2\]\.text \(cena 3, ponto\) tem 8 palavras e o limite é 5/);
    assert.match(invalid.json.error.fix, /até 5 palavras/);
    assert.equal(readFileSync(join(dir, "pagina.html"), "utf8"), page);
    assert.equal((await cli(project, ["preview", slug])).json.error.code, "roteiro_invalid", "preview validates the roteiro too");
    writeFileSync(file, "{ quebrado");
    assert.equal((await cli(project, ["build", slug])).json.error.code, "invalid_json");
    writeFileSync(file, JSON.stringify(patch(original, (roteiro) => { roteiro.scenes[2].image = "materiais/sumiu.png"; }), null, 2));
    const lost = await cli(project, ["build", slug]);
    assert.equal(lost.json.error.code, "file_not_found");
    assert.match(lost.json.error.message, /scenes\[2\]\.image/);

    // a valid edit is kept, normalized, and reaches the page
    mkdirSync(join(project.root, "fotos da clínica"), { recursive: true });
    writeFileSync(join(project.root, "fotos da clínica", "Foto do Consultório.jpg"), "foto");
    const edited = patch(original, (roteiro) => {
      roteiro.scenes[0].text = "Sorria sem medo";
      roteiro.scenes[2].image = "fotos da clínica/Foto do Consultório.jpg";
      roteiro.scenes[1].bars = roteiro.scenes[1].bars === 2 ? 1 : 2;
      roteiro.bpm = 120;
    });
    const editedBars = sum(edited.scenes.map((scene) => scene.bars));
    assert.notEqual(editedBars, original.bars);
    writeFileSync(file, JSON.stringify(edited, null, 2));
    const kept = await ok(project, ["build", slug]);
    assert.deepEqual(kept.kept, { roteiro: true });
    assert.equal(kept.scenes[0].text, "Sorria sem medo");
    assert.deepEqual([kept.bpm, kept.bars, kept.duration], [120, editedBars, editedBars * 2]);
    assert.ok(kept.warnings.some((warning) => /roteiro\.json: bars passou de/.test(warning)));
    const normalized = readJsonFile(file);
    assert.equal(normalized.scenes[2].image, "assets/foto-do-consultorio.jpg", "a file of the member is copied into assets/ and the roteiro points at the copy");
    assert.equal(readFileSync(join(dir, "assets", "foto-do-consultorio.jpg"), "utf8"), "foto");
    assert.deepEqual(readRoteiroBlock(readFileSync(join(dir, "pagina.html"), "utf8")), normalized);
    assert.equal((await ok(project, ["status", slug])).next_step.action, "preview");

    // --force goes back to the brief, keeping what was adjusted in a file beside it
    const forced = await ok(project, ["build", slug, "--force"]);
    assert.deepEqual(forced.kept, { roteiro: false });
    assert.equal(forced.scenes[0].text, original.scenes[0].text);
    assert.ok(forced.warnings.some((warning) => /roteiro\.anterior\.json/.test(warning)));
    assert.equal(readJsonFile(join(dir, "roteiro.anterior.json")).scenes[0].text, "Sorria sem medo");

    // the page is always written from the roteiro: a change made by hand lasts until the next build, which says so
    writeFileSync(join(dir, "pagina.html"), readFileSync(join(dir, "pagina.html"), "utf8").replace("</body>", "<!-- ajuste da IA -->\n</body>"));
    writeFileSync(file, JSON.stringify(patch(readJsonFile(file), (roteiro) => { roteiro.scenes[0].text = "Sorriso novo, vida nova"; }), null, 2));
    const byHand = await ok(project, ["build", slug]);
    assert.deepEqual(byHand.kept, { roteiro: true });
    assert.ok(byHand.warnings.some((warning) => /mudanças feitas à mão/.test(warning) && /references\/pagina-do-video\.md, seção 6/.test(warning)), "the build says the hand change was replaced and where the guide shows how to keep one");
    const rewritten = readFileSync(join(dir, "pagina.html"), "utf8");
    assert.ok(!rewritten.includes("<!-- ajuste da IA -->"));
    assert.equal(readRoteiroBlock(rewritten).scenes[0].text, "Sorriso novo, vida nova", "the roteiro stays");
    const quiet = await ok(project, ["build", slug]);
    assert.ok(!quiet.warnings.some((warning) => /mudanças feitas à mão/.test(warning)), "a page nobody touched is rewritten without a word");
  });

  test("capture: a site that does not let the capture in, and the video that goes on with a neutral look", { timeout: 600000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    const intake = await ok(project, ["intake", "--request", project.request(R3.replace(/https:\/\/www\.sorrisopleno\.com\.br/, "https://www.sorrisopleno-bloqueado.com.br"))]);
    const slug = intake.slug;
    assert.equal(intake.next_step.action, "capture");
    const blocked = await cli(project, ["capture", slug]);
    assert.equal(blocked.code, 1);
    assert.equal(blocked.json.ok, false);
    assert.equal(blocked.json.error.code, "site_blocked", "the Motor's own code comes through");
    assert.match(blocked.json.error.message, /não deixou o navegador entrar/);
    assert.match(blocked.json.error.fix, /visual neutro/);
    assert.match(blocked.json.error.fix, new RegExp(`estudio-de-video/${slug}/materiais`));
    assert.equal(blocked.json.captured, false);
    assert.ok(blocked.json.warnings.some((warning) => /não foi capturado \(site_blocked\)/.test(warning)));
    assert.equal(blocked.json.next_step.action, "build", "the flow goes on");
    const status = await ok(project, ["status", slug]);
    assert.deepEqual(status.next_step, blocked.json.next_step);
    assert.equal(status.brand.kit, null);
    assert.ok(status.warnings.some((warning) => /visual neutro/.test(warning)));
    assert.deepEqual(listKits(project.root), [], "a capture that failed keeps no brand");

    const built = await ok(project, ["build", slug]);
    assert.deepEqual(built.palette, NEUTRAL_PALETTE);
    assert.ok(built.warnings.some((warning) => /visual neutro/.test(warning)));
    const roteiro = readJsonFile(join(project.dirOf(slug), "roteiro.json"));
    assert.equal(roteiro.brand.logo, null);
    assert.equal(roteiro.brand.name, "Sorriso Pleno", "the name the request gave");
    assert.ok(!roteiro.scenes.some((scene) => scene.role === "prova"), "no captured number, no proof");
    assert.ok(roteiro.scenes.every((scene) => !scene.screen && !scene.image));
    const walked = await follow(project, slug, built.next_step);
    assert.match(walked.trail.join(","), /^preview,approve_preview,final(,deliver)?,done$/);
    assert.match(readFileSync(join(project.dirOf(slug), "entrega", "notas.md"), "utf8"), /não pôde ser capturado: o vídeo não usa o logo nem as cores da marca\. Confira/);

    // the other failures of a capture pass through the same way; anything else is a plain error
    for (const [address, code] of [["https://fora-do-ar.com.br", "site_unreachable"], ["nao-e-endereco", "invalid_url"], ["https://captura-quebrada.com.br", "capture_failed"], ["https://loja-estacionado.com.br", "site_placeholder"]]) {
      const other = await ok(project, ["intake", "--request", project.request(R1, `r-${code}.txt`)]);
      const failed = await cli(project, ["capture", other.slug, "--url", address]);
      assert.equal(failed.json.error.code, code, address);
      assert.ok(failed.json.next_step, code);
      if (code === "invalid_url") assert.match(failed.json.error.fix, new RegExp(`answer ${other.slug} marca`));
      else if (code === "site_placeholder") {
        assert.match(failed.json.error.fix, /provedor, não da marca/, "a parked domain says whose page it is");
        assert.match(failed.json.error.fix, new RegExp(`site em outro endereço, registre-o: .*answer ${other.slug} marca`), "another address of the brand, not the same one again");
        assert.match(failed.json.error.fix, /visual neutro/);
      } else assert.match(failed.json.error.fix, new RegExp(`capture ${other.slug} --refresh`));
    }

    // a second try that works replaces the neutral look
    const retry = await ok(project, ["capture", slug, "--url", "https://www.sorrisopleno.com.br"]);
    assert.equal(retry.captured, true);
    const rebuilt = await ok(project, ["build", slug]);
    assert.equal(rebuilt.palette.accent, "#7C3AED");
  });

  test("capture: a coming-soon page is captured, and its logo and colors wait for the member's yes", { timeout: 300000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    const intake = await ok(project, ["intake", "--request", project.request("Faça um vídeo de lançamento da minha loja, https://www.flor-em-breve.com.br, para o Reels")]);
    assert.equal(intake.next_step.action, "capture");
    const found = await ok(project, ["capture", intake.slug]);
    assert.equal(found.captured, true);
    assert.equal(found.brand.confirmed, false, "the site came from the request, but the page is provisional");
    assert.equal(found.confirm?.id, "conferir_marca");
    const said = found.warnings.filter((warning) => /provisória/.test(warning));
    assert.equal(said.length, 1, `said once: ${said.join(" | ")}`);
    assert.match(said[0], /confirme com o integrante que o logo e as cores são da marca/);
    const yes = await ok(project, ["answer", intake.slug, "conferir_marca", "sim"]);
    assert.notEqual(yes.next_step.action, "confirm_brand");
  });

  test("a story the brief cannot fill: build asks the member for the points, with the question ready", { timeout: 300000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    const intake = await ok(project, ["intake", "--request", project.request('Crie um vídeo de lançamento da Sorriso Pleno (https://www.sorrisopleno-bloqueado.com.br), com 15 segundos, para o Reels, apresentando a clínica. Abre com "Seu sorriso novo".')]);
    const slug = intake.slug;
    assert.equal((await cli(project, ["capture", slug])).json.error.code, "site_blocked");
    const missing = await cli(project, ["build", slug]);
    assert.equal(missing.code, 1);
    assert.equal(missing.json.error.code, "roteiro_invalid");
    assert.match(missing.json.error.message, /Faltam os pontos do vídeo/);
    assert.equal(missing.json.next_step.action, "ask");
    assert.equal(missing.json.next_step.command, null);
    assert.equal(missing.json.next_step.answer_command, `${SCRIPT} answer ${slug} pontos <valor> --json`);
    assert.equal(missing.json.question.id, "pontos");
    assert.ok(missing.json.question.text.length > 10);
    await ok(project, ["answer", slug, "pontos", "Implantes dentários; Clareamento a laser; Alinhadores invisíveis"]);
    const built = await ok(project, ["build", slug]);
    assert.deepEqual(built.scenes.filter((scene) => scene.role === "ponto").map((scene) => scene.text), ["Implantes dentários", "Clareamento a laser", "Alinhadores invisíveis"]);
    assert.deepEqual(built.palette, NEUTRAL_PALETTE, "the site did not let the capture in: a neutral look");
  });

  test("capture: a brand without a site, a site found by search that waits for the member's yes", { timeout: 300000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    const intake = await ok(project, ["intake", "--request", project.request(R1)]);
    const slug = intake.slug;
    const unknown = await cli(project, ["capture", slug]);
    assert.equal(unknown.code, 1);
    assert.equal(unknown.json.error.code, "brand_unknown");
    assert.match(unknown.json.error.fix, new RegExp(`answer ${slug} marca <endereço> --json`));
    assert.match(unknown.json.error.fix, new RegExp(`capture ${slug} --url <endereço> --json`));
    assert.deepEqual(project.calls(), []);

    // the AI searched for the site: it is captured, but the member has not said it is the right one
    const found = await ok(project, ["capture", slug, "--url", "sorrisopleno.com.br"]);
    assert.deepEqual(project.calls(), [["capture", "sorrisopleno.com.br", "--out", "capturas/sorrisopleno-com-br"]]);
    assert.equal(found.brand.found_by, "busca");
    assert.equal(found.brand.confirmed, false);
    assert.equal(found.confirm.id, "conferir_marca");
    assert.match(found.confirm.text, /Sorriso Pleno|sorrisopleno\.com\.br/, "the question names what was found");
    assert.doesNotMatch(found.confirm.text, /\{[a-z]+\}/, "no unfilled placeholder");
    assert.ok(found.confirm.options.length >= 2);
    assert.equal(found.confirm.answer_command, `${SCRIPT} answer ${slug} conferir_marca <value> --json`);
    assert.ok(found.warnings.some((warning) => /encontrada por busca/.test(warning)));
    assert.equal(readKit(project.root, "sorrisopleno").confirmed, false);
    const yes = await ok(project, ["answer", slug, "conferir_marca", "sim"]);
    assert.equal(yes.brand.confirmed, true);
    assert.equal(readKit(project.root, "sorrisopleno").confirmed, true, "the kit remembers the yes");

    // a site that calls itself something else than the member said waits for a yes too
    const other = await ok(project, ["intake", "--request", project.request("Faz um vídeo animado da Padaria Estrela (padariadoze.com.br) para o Reels", "padaria.txt")]);
    assert.equal(other.fields.brand.value.name, "Padaria Estrela");
    const mismatch = await ok(project, ["capture", other.slug]);
    assert.equal(mismatch.brand.name, "Padariadoze");
    assert.equal(mismatch.brand.confirmed, false);
    assert.equal(mismatch.confirm.id, "conferir_marca");
    assert.ok(mismatch.warnings.some((warning) => /se apresenta como "Padariadoze"/.test(warning)));
  });

  test("preview: nothing is done twice, --refresh redoes all, a failed check is told and not hidden", { timeout: 600000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    const video = await videoAt(project, { request: R3, until: "build" });
    const { slug, dir } = video;
    project.clearCalls();
    const first = await ok(project, ["preview", slug]);
    assert.deepEqual(first.reused, []);
    assert.deepEqual(project.calls().map((call) => call[0]), ["music", "sfx", "preview", "mix", "frames", "help", "accept"]);
    assert.equal(typeof first.elapsed_s, "number");
    assert.equal(first.open_command, `${SCRIPT} open ${slug} previa --json`);
    assert.equal(first.loudness.integrated_lufs, -14.1);
    assert.deepEqual(first.accept.failed, []);
    assert.equal(first.accept.checks.find((check) => check.name === "cuts_on_beat").status, "pass");

    project.clearCalls();
    const second = await ok(project, ["preview", slug]);
    assert.deepEqual(second.reused, ["render", "mix", "frames", "accept"]);
    assert.deepEqual(project.calls(), [["help"]], "only the question of what the Motor supports");
    assert.deepEqual(second.accept, first.accept);
    assert.deepEqual(second.texts, first.texts);

    project.clearCalls();
    const refreshed = await ok(project, ["preview", slug, "--refresh"]);
    assert.deepEqual(refreshed.reused, []);
    assert.deepEqual(project.calls().map((call) => call[0]), ["music", "sfx", "preview", "mix", "frames", "help", "accept"]);

    // only the sound changes: the page is the same roteiro plus other effects, so everything follows
    const roteiro = readJsonFile(join(dir, "roteiro.json"));
    roteiro.music.style = "warm";
    writeFileSync(join(dir, "roteiro.json"), JSON.stringify(roteiro, null, 2));
    project.clearCalls();
    await ok(project, ["build", slug]);
    const warm = await ok(project, ["preview", slug]);
    assert.equal(warm.music.style, "warm");
    assert.deepEqual(project.calls().map((call) => call[0]), ["music", "preview", "mix", "frames", "help", "accept"], "the effects are the same and are kept");
    assert.equal(project.calls()[0][project.calls()[0].indexOf("--style") + 1], "warm");

    // a check that fails is data: ok stays true, the result and the report say which one
    writeFileSync(join(dir, "pagina.html"), readFileSync(join(dir, "pagina.html"), "utf8").replace("</body>", "<!-- SEM_CAPA -->\n</body>"));
    const failed = await ok(project, ["preview", slug]);
    assert.equal(failed.accept.passed, false);
    assert.deepEqual(failed.accept.failed.map((item) => item.name), ["first_frame_readable"]);
    assert.ok(failed.warnings.some((warning) => /A conferência reprovou: first_frame_readable/.test(warning)));
    assert.equal(readJsonFile(join(dir, "previa", "aceite.json")).passed, false);
    assert.equal((await ok(project, ["status", slug])).preview.passed, false);
    await ok(project, ["approve", slug, "preview"]);
    const final = await ok(project, ["final", slug]);
    assert.equal(final.ok, true, "the command itself still succeeds");
    assert.equal(final.accept.passed, false);
    assert.deepEqual(final.accept.failed.map((item) => item.name), ["first_frame_readable"]);
    const notes = readFileSync(join(dir, "entrega", "notas.md"), "utf8");
    assert.ok(notes.includes("**Há item reprovado.**"));
    assert.match(notes, /- ✗ Capa legível \(o primeiro quadro\): /);
    assert.equal(readJsonFile(join(dir, "entrega", "relatorio.json")).passed, false);

    // a page the Motor cannot render fails with the Motor's own code, message and fix
    writeFileSync(join(dir, "pagina.html"), readFileSync(join(dir, "pagina.html"), "utf8").replace("SEM_CAPA", "QUEBRA"));
    const broken = await cli(project, ["preview", slug]);
    assert.equal(broken.code, 1);
    assert.equal(broken.json.error.code, "page_error");
    assert.match(broken.json.error.fix, /Corrija o JavaScript/);
    const rebuilt = await ok(project, ["build", slug]);
    assert.ok(rebuilt.warnings.some((warning) => /mudanças feitas à mão/.test(warning)), "build rewrites the page from the roteiro and says the hand change is gone");
    assert.equal((await ok(project, ["preview", slug])).accept.passed, true);
  });

  test("--networks goes to the Motor only when its help offers it", { timeout: 600000 }, async (t) => {
    const project = makeProject(t, { engine: "fake", settings: { networks: true } });
    const video = await videoAt(project, { request: R3, until: "build" });
    const { slug } = video;
    const p = `estudio-de-video/${slug}`;
    project.clearCalls();
    const preview = await ok(project, ["preview", slug]);
    const accept = project.calls().find((call) => call[0] === "accept");
    assert.deepEqual(accept, ["accept", `${p}/pagina.html`, "--format", "9:16", "--safe", "networks", "--beats", `${p}/audio/batidas.json`, "--video", `${p}/previa/previa.mp4`, "--networks", "reels,tiktok"], "the networks of the brief, in its order, with the strictest zone among them");
    assert.deepEqual(preview.accept.networks, ["reels", "tiktok"]);
    assert.deepEqual(readJsonFile(join(video.dir, "previa", "aceite.json")).networks, ["reels", "tiktok"]);

    // the same Motor without the option: the command line goes without it, and nothing fails
    project.configure({});
    project.clearCalls();
    const plain = await ok(project, ["preview", slug]);
    assert.ok(!project.calls().find((call) => call[0] === "accept").includes("--networks"));
    assert.equal(plain.accept.networks, null);
    assert.equal(plain.accept.passed, true);
    assert.ok(!plain.reused.includes("accept"), "what the conference can measure changed, so it is run again");
  });

  test("the member's files: a logo, photos and a song from materiais/, and a video without music", { timeout: 600000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    const video = await videoAt(project, { request: R3, until: "capture" });
    const { slug, dir } = video;
    const p = `estudio-de-video/${slug}`;
    for (const [name, content] of [["Logo Oficial.png", "logo do integrante"], ["1-clínica.jpg", "foto um"], ["2-sorriso.jpg", "foto dois"]]) writeFileSync(join(dir, "materiais", name), content);
    const built = await ok(project, ["build", slug]);
    const roteiro = readJsonFile(join(dir, "roteiro.json"));
    assert.equal(roteiro.brand.logo, "assets/logo.png");
    assert.equal(readFileSync(join(dir, "assets", "logo.png"), "utf8"), "logo do integrante");
    assert.deepEqual(roteiro.scenes.filter((scene) => scene.role === "ponto").map((scene) => scene.image ?? null), ["assets/produto-1.jpg", "assets/produto-2.jpg", null]);
    assert.ok(built.warnings.some((warning) => /substitui o que veio do site/.test(warning)));
    assert.ok(built.assets.some((asset) => asset.file === `${p}/assets/produto-1.jpg` && asset.from === `${p}/materiais/1-clínica.jpg`));
    assert.equal(readFileSync(join(dir, "materiais", "1-clínica.jpg"), "utf8"), "foto um", "the member's files are read where they are");

    // a new file in materiais/ is a reason to build again
    writeFileSync(join(dir, "materiais", "3-equipe.jpg"), "foto três");
    assert.equal((await ok(project, ["status", slug])).next_step.action, "build");
    await ok(project, ["build", slug]);
    assert.equal(readJsonFile(join(dir, "roteiro.json")).scenes.filter((scene) => scene.image).length, 3);

    // the member's own song: measured once, the cuts follow its tempo, the mix starts on its first downbeat
    writeFileSync(join(dir, "materiais", "minha trilha 97bpm.mp3"), "áudio do integrante");
    const edited = readJsonFile(join(dir, "roteiro.json"));
    edited.music = { mode: "file", style: "clean", seed: 7, file: "materiais/minha trilha 97bpm.mp3" };
    writeFileSync(join(dir, "roteiro.json"), JSON.stringify(edited, null, 2));
    project.clearCalls();
    const withSong = await ok(project, ["preview", slug]);
    assert.deepEqual(project.calls()[0], ["beats", `${p}/materiais/minha trilha 97bpm.mp3`, "--out", `${p}/audio/trilha.beats.json`]);
    const mix = project.calls().find((call) => call[0] === "mix");
    assert.deepEqual(mix.slice(mix.indexOf("--music"), mix.indexOf("--music") + 4), ["--music", `${p}/materiais/minha trilha 97bpm.mp3`, "--music-offset", "0.25"]);
    assert.equal(withSong.music.mode, "file");
    assert.ok(withSong.warnings.some((warning) => /A música tem 97 BPM e o roteiro está em/.test(warning)), "a roteiro on another tempo is told how to follow the song");
    assert.ok(!project.calls().some((call) => call[0] === "music"));
    project.clearCalls();
    await ok(project, ["preview", slug]);
    assert.ok(!project.calls().some((call) => call[0] === "beats"), "the song is measured once");
    await ok(project, ["approve", slug, "preview"]);
    const final = await ok(project, ["final", slug]);
    assert.ok(final.pending.some((item) => /direito de usá-la/.test(item)), "the right to use the song is the member's to confirm");
    assert.match(final.notes_text, /Música do integrante: .*minha trilha 97bpm\.mp3/);

    // without music: the effects alone; without effects either: a silent file, and it says so
    const quiet = readJsonFile(join(dir, "roteiro.json"));
    quiet.music = { mode: "none", style: "clean", seed: 7, file: null };
    writeFileSync(join(dir, "roteiro.json"), JSON.stringify(quiet, null, 2));
    project.clearCalls();
    const effectsOnly = await ok(project, ["preview", slug]);
    const quietMix = project.calls().find((call) => call[0] === "mix");
    assert.ok(!quietMix.includes("--music") && quietMix.includes("--sfx"));
    assert.equal(effectsOnly.music.file, null);
    for (const scene of quiet.scenes) scene.events = [];
    writeFileSync(join(dir, "roteiro.json"), JSON.stringify(quiet, null, 2));
    project.clearCalls();
    const silent = await ok(project, ["preview", slug]);
    assert.ok(!project.calls().some((call) => ["mix", "sfx", "music"].includes(call[0])));
    assert.ok(silent.warnings.some((warning) => /saiu sem som/.test(warning)));
    assert.equal(silent.loudness, null);

    // a looping track: whole bars from the Motor's synth, in the style that matches
    const loop = readJsonFile(join(dir, "roteiro.json"));
    loop.music = { mode: "synth", style: "warm", seed: 3, file: null };
    loop.loop = true;
    writeFileSync(join(dir, "roteiro.json"), JSON.stringify(loop, null, 2));
    project.clearCalls();
    await ok(project, ["preview", slug]);
    assert.deepEqual(project.calls()[0], ["synth", "--out", `${p}/audio/trilha.wav`, "--bpm", String(loop.bpm), "--bars", String(loop.bars), "--style", "lofi", "--seed", "3"]);
  });

  test("a brief that asks for the member's song follows its tempo from the first draft", { timeout: 300000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    const video = await videoAt(project, { request: R3, until: "capture" });
    const { slug, dir } = video;
    const state = readJsonFile(join(dir, "pedido.json"));
    state.fields.music = { value: { mode: "file", style: null, file: null }, source: "resposta", evidence: "minha música" };
    writeFileSync(join(dir, "pedido.json"), JSON.stringify(state, null, 2));
    const missing = await cli(project, ["build", slug]);
    assert.equal(missing.json.error.code, "file_not_found");
    assert.match(missing.json.error.fix, new RegExp(`estudio-de-video/${slug}/materiais`));
    writeFileSync(join(dir, "materiais", "tema 100bpm.wav"), "áudio");
    project.clearCalls();
    const built = await ok(project, ["build", slug]);
    assert.deepEqual(project.calls().map((call) => call[0]), ["beats"]);
    assert.equal(built.bpm, 100);
    assert.equal(built.music.file, `estudio-de-video/${slug}/materiais/tema 100bpm.wav`);
    assert.ok(Math.abs(built.duration - (built.bars * 240) / 100) < 1e-3);
    writeFileSync(join(dir, "materiais", "tema 100bpm.wav"), "outro áudio");
    assert.equal((await ok(project, ["status", slug])).next_step.action, "build", "another song is another video");
  });

  test("open: what each word opens, what does not exist yet, and the delivery", { timeout: 600000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    const video = await videoAt(project, { request: R1, until: "preview" });
    const { slug } = video;
    const p = `estudio-de-video/${slug}`;
    const opened = await ok(project, ["open", slug, "previa"]);
    assert.deepEqual([opened.target, opened.file, opened.opened], ["previa", `${p}/previa/previa.mp4`, false], "FLYEE_NO_OPEN keeps windows closed in the tests");
    assert.equal(opened.next_step.action, "approve_preview");
    assert.equal((await ok(project, ["open", slug])).target, "previa", "without a word: the most finished thing there is");
    assert.equal((await ok(project, ["open", slug, "folha"])).file, `${p}/previa/quadros/folha.png`);
    assert.equal((await ok(project, ["open", slug, "briefing"])).file, `${p}/briefing.md`);
    assert.equal((await ok(project, ["open", slug, "pasta"])).file, p);
    assert.equal((await ok(project, ["open", slug, "materiais"])).file, `${p}/materiais`);
    const early = await cli(project, ["open", slug, "final"]);
    assert.equal(early.code, 1);
    assert.equal(early.json.error.code, "file_not_found");
    assert.match(early.json.error.fix, new RegExp(`final ${slug} --json`));
    assert.equal((await cli(project, ["open", slug, "capa"])).json.error.code, "file_not_found");
    assert.equal((await cli(project, ["open", slug, "tudo"])).code, 2);
    await ok(project, ["approve", slug, "preview"]);
    await ok(project, ["final", slug]);
    const delivered = await ok(project, ["open", slug]);
    assert.equal(delivered.target, "final");
    assert.equal(delivered.file, `${p}/entrega/${slug}.mp4`);
    assert.equal(delivered.next_step.action, "done");
    assert.equal(readJsonFile(join(project.dirOf(slug), "pedido.json")).status, "delivered");
    assert.equal((await ok(project, ["open", slug, "notas"])).file, `${p}/entrega/notas.md`);
    assert.equal((await ok(project, ["open", slug, "capa"])).file, `${p}/entrega/capa.png`);
    const human = await cli(project, ["open", slug, "final"], { json: false });
    assert.match(human.stdout, /^Pronto para abrir: /);
  });

  test("a part of the app that is missing is said, with the reinstall command", { timeout: 300000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    const video = await videoAt(project, { request: R3, until: "capture" });
    const template = join(project.appDir, "runtime", "templates", "lancamento.html");
    const saved = readFileSync(template, "utf8");
    rmSync(template);
    const noTemplate = await cli(project, ["build", video.slug]);
    assert.equal(noTemplate.code, 1);
    assert.equal(noTemplate.json.error.code, "runtime_missing");
    assert.match(noTemplate.json.error.message, /runtime\/templates\/lancamento\.html/);
    assert.match(noTemplate.json.error.fix, /npx --yes flyee@latest add video-studio --yes --json/);
    writeFileSync(template, saved.replace("__ROTEIRO__", ""));
    assert.equal((await cli(project, ["build", video.slug])).json.error.code, "runtime_missing", "a template without the place for the roteiro");
    writeFileSync(template, saved);
    rmSync(join(project.appDir, "runtime", "studio.js"));
    assert.equal((await cli(project, ["build", video.slug])).json.error.code, "runtime_missing");
    rmSync(join(project.appDir, "references", "perguntas.json"));
    const noBank = await cli(project, ["status", video.slug]);
    assert.equal(noBank.json.error.code, "runtime_missing");
    assert.match(noBank.json.error.message, /references\/perguntas\.json/);
    assert.equal((await ok(project, ["check"])).runtime.complete, false, "check still answers");
  });

  test("the text a person reads without --json: every command, in plain pt-BR", { timeout: 600000 }, async (t) => {
    const project = makeProject(t, { engine: "fake" });
    const human = async (args) => {
      const run = await cli(project, args, { json: false });
      assert.equal(run.code, 0, `${args.join(" ")} → ${run.stdout}${run.stderr}`);
      assert.throws(() => JSON.parse(run.stdout), "plain text, not JSON");
      assert.doesNotMatch(run.stdout, /undefined|\[object Object\]|NaN/, args.join(" "));
      return run.stdout;
    };
    const intake = await ok(project, ["intake", "--request", project.request(R3)]);
    const slug = intake.slug;
    assert.match(await human(["status", slug]), new RegExp(`^Vídeo ${slug} \\(estudio-de-video/${slug}\\) · pedido completo · modo complete`));
    assert.match(await human(["capture", slug]), /^Marca Sorriso Pleno \(sorrisopleno\.com\.br\) capturada: logo .* · destaque #7C3AED · 4 telas · 4 números\./);
    const built = await human(["build", slug]);
    assert.match(built, /^"Sorriso Pleno · lançamento": roteiro lancamento, \d+ cenas, 15 s \(8 compassos a 128 BPM\)\./);
    assert.match(built, /\n   1 gancho\s+0 s  Seu sorriso novo em 90 dias\n/);
    assert.match(built, /\nPróximo passo: node \.flyee\/modules\/video-studio\/scripts\/studio\.mjs preview /);
    const preview = await human(["preview", slug]);
    assert.match(preview, /^Prévia: estudio-de-video\/.*previa\.mp4 \(540×960, 15 s\)/);
    // the check's name a person reads, never the JSON's (`page`, `loop_seamless`)
    assert.match(preview, /\nConferência: APROVADO\n  ✓ A página do vídeo: /);
    assert.doesNotMatch(preview, /loop_seamless|first_frame_readable/);
    assert.match(preview, /\nTextos na tela:\n\s+0 s  Seu sorriso novo em 90 dias\n/);
    assert.match(await human(["approve", slug, "preview"]), /^Registrado o sim do integrante: prévia\./);
    const final = await human(["final", slug]);
    assert.match(final, /^Vídeo final: estudio-de-video\/.*\.mp4 \(1080×1920, 15 s, -14,1 LUFS\)/);
    assert.match(final, /\nCapa: .*capa\.png\nNotas de entrega: .*notas\.md · relatório: .*relatorio\.json\nConferência: APROVADO\n/);
    assert.match(await human(["list"]), new RegExp(`^Vídeos em estudio-de-video/:\\n  ${slug}\\s+final`));
    assert.match(await human(["help"]), /^Estúdio de vídeo: /);
    const guided = await ok(project, ["intake", "--request", project.request(R1, "r1.txt")]);
    assert.match(await human(["status", guided.slug]), /pedido vazio · modo guided/);
    await ok(project, ["answer", guided.slug, "marca", "sorrisopleno.com.br"]);
    assert.match(await human(["brief", guided.slug]), /\nBriefing: estudio-de-video\/.*briefing\.md/);
  });
});

/* ------------------------------------------------------------------ */
/* One whole video through the real Motor                             */
/* ------------------------------------------------------------------ */

test("integration: intake to final through the real Motor (needs ffmpeg, a browser and the app's own page templates)", { timeout: 1200000 }, async (t) => {
  if (!REAL_INTAKE || !REAL_STUDIO || REAL_TEMPLATES.length < TEMPLATE_IDS.length) {
    t.skip(`faltam partes do app: ${[!REAL_INTAKE && "a lógica do briefing", !REAL_STUDIO && "runtime/studio.js", ...TEMPLATE_IDS.filter((id) => !REAL_TEMPLATES.includes(id)).map((id) => `runtime/templates/${id}.html`)].filter(Boolean).join(", ")}`);
    return;
  }
  if (process.env.STUDIO_TEST_REAL !== "1") {
    t.skip("leva alguns minutos e usa o navegador: rode com STUDIO_TEST_REAL=1");
    return;
  }
  const project = makeProject(t, { engine: "real" });
  const checked = await ok(project, ["check"]);
  if (!checked.modes.render) {
    t.skip("sem ffmpeg ou navegador nesta máquina");
    return;
  }
  const site = join(ENGINE_DIR, "tests", "fixtures", "site", "index.html");
  const intake = await ok(project, ["intake", "--request", project.request(`Crie um vídeo de lançamento da Sorriso Pleno, com 8 segundos, para o Reels, apresentando a clínica.\n1. Abre com "Seu sorriso novo em 90 dias"\n2. Implantes dentários\n3. Clareamento a laser\n4. Fecha com o logo e o site\nFaz direto, não precisa me mostrar.`)]);
  const slug = intake.slug;
  const captured = await ok(project, ["capture", slug, "--url", site]);
  assert.equal(captured.brand.name, "Sorriso Pleno");
  assert.equal(captured.brand.colors.primary, "#7C3AED");
  if (captured.confirm) await ok(project, ["answer", slug, "conferir_marca", captured.confirm.options[0].value]);
  let next = (await ok(project, ["status", slug])).next_step;
  const walked = await follow(project, slug, next, { answers: { marca: "Sorriso Pleno" } });
  assert.ok(walked.trail.includes("final"), walked.trail.join(","));
  const dir = project.dirOf(slug);
  for (const file of ["roteiro.json", "pagina.html", "previa/previa.mp4", "previa/quadros/folha.png", "previa/aceite.json", `entrega/${slug}.mp4`, "entrega/capa.png", "entrega/notas.md", "entrega/relatorio.json"]) assert.ok(existsSync(join(dir, file)), file);
  const report = readJsonFile(join(dir, "entrega", "relatorio.json"));
  assert.deepEqual([report.media.width, report.media.height, report.media.has_audio], [1080, 1920, true]);
  assert.ok(Math.abs(report.loudness.integrated_lufs + 14) <= 1.5, `volume: ${report.loudness.integrated_lufs}`);
  assert.equal(report.accept.checks.find((check) => check.name === "page").status, "pass");
  assert.equal(report.accept.checks.find((check) => check.name === "cuts_on_beat").status, "pass", "every cut of the roteiro is on the beat of the music");
});
