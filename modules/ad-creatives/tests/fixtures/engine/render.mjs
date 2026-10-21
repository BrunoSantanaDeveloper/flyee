// A stand-in Motor de vídeo for the tests of Criativos para anúncios: it speaks the Motor's
// command lines (references/interface.md of video-render), writes stand-in files where the real
// ones would go, answers with result-shaped JSON and logs every call into calls.json beside its
// own folder (never into the member's project). It renders nothing and opens no browser.
// Copied from the Estúdio de vídeo's stand-in and adapted to this app's page (the "peca" block).
//
// How the tests steer it:
//   fake.json (in the module folder): { "networks": "old" }  → `networks` has no ads_meta (an outdated Motor)
//                                     { "render": false }    → what `check` reports
//   a page with QUEBRA fails to render; SEM_CAPA or FORA_DA_ZONA fail a check; SEM_CAIXAS has no window.boxes
//   capture of an address with "bloqueado" fails like the real one; with "sem-logo" brings no logo

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_DIR = resolve(HERE, "..");
const ROOT = process.cwd();
const LOG = join(MODULE_DIR, "calls.json");
const SETTINGS = existsSync(join(MODULE_DIR, "fake.json")) ? JSON.parse(readFileSync(join(MODULE_DIR, "fake.json"), "utf8")) : {};
const APP = { name: "video-render", version: "9.9.9" };
const FLAGS = new Set(["json", "loop", "alpha", "force", "phone", "downbeats", "no-assets"]);
const OPTIONS = new Set([
  "out", "fps", "sub", "format", "scale", "start", "end", "times", "every", "beats", "sheet", "cols", "tile-width", "duration", "name",
  "style", "seed", "key", "arc", "bpm", "bars", "events", "event", "music", "music-offset", "music-gain", "sfx", "sfx-gain", "voice", "fade-out", "tp", "video",
  "safe", "margin", "min-text", "mobile", "desktop", "scroll", "networks", "page",
]);
const SIZES = { "9:16": [1080, 1920], "4:5": [1080, 1350], "1:1": [1080, 1080], "16:9": [1920, 1080], "3:4": [1080, 1440] };
const SFX_TYPES = ["kick", "thump", "impact", "click", "tick", "pop", "whoosh", "swish", "riser", "ding", "shutter", "pluck", "blip"];
const MUSIC_STYLES = ["clean", "energetic", "warm", "minimal", "cinematic", "playful"];
// the smallest valid PNG: one transparent pixel
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="#7C3AED"/></svg>';

const [command = "help", ...rest] = process.argv.slice(2);

const round = (value, digits = 4) => Math.round(Number(value) * 10 ** digits) / 10 ** digits;
const rel = (path) => {
  const text = relative(ROOT, path);
  return text.startsWith("..") || isAbsolute(text) ? path : (text || ".").split(sep).join("/");
};
const write = (file, content) => {
  mkdirSync(dirname(resolve(file)), { recursive: true });
  writeFileSync(file, content);
};
const done = (result) => {
  process.stdout.write(`${JSON.stringify({ ok: true, command, interface_version: 1, app: APP, ...result }, null, 2)}\n`);
  process.exit(0);
};
const fail = (code, message, fix = "") => {
  process.stdout.write(`${JSON.stringify({ ok: false, command, error: { code, message, fix } }, null, 2)}\n`);
  process.exit(code === "usage" ? 2 : 1);
};

// the log first: a call that fails is still a call the app made
const calls = existsSync(LOG) ? JSON.parse(readFileSync(LOG, "utf8")) : [];
calls.push([command, ...rest.filter((arg) => arg !== "--json")]);
writeFileSync(LOG, JSON.stringify(calls, null, 2));

const values = {};
const positionals = [];
for (let i = 0; i < rest.length; i++) {
  const arg = rest[i];
  if (!arg.startsWith("--")) {
    positionals.push(arg);
    continue;
  }
  const name = arg.slice(2);
  if (FLAGS.has(name)) values[name] = true;
  else if (OPTIONS.has(name)) {
    if (rest[i + 1] === undefined) fail("usage", `A opção --${name} precisa de um valor.`);
    values[name] = rest[++i];
  } else fail("usage", `Opção desconhecida: --${name}.`, "Rode o comando `help` para ver as opções.");
}

const need = (name) => {
  if (values[name] === undefined) fail("usage", `Informe --${name}.`);
  return values[name];
};
const existing = (file, what) => {
  if (!file || !existsSync(file)) fail("file_not_found", `Não encontrei ${what}: ${file}.`);
  return file;
};

/** The piece a page of this app carries, and the film it declares. */
function pageOf(file) {
  existing(file, "a página HTML");
  if (extname(file).toLowerCase() !== ".html") fail("usage", `A página precisa ser um arquivo .html: ${file}.`);
  const html = readFileSync(file, "utf8");
  const block = /<script\b[^>]*\bid=["']peca["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  let piece = null;
  try {
    piece = block ? JSON.parse(block[1]) : null;
  } catch {
    piece = null;
  }
  const duration = Number(piece?.duration) || 15;
  const cuts = (piece?.scenes ?? []).slice(1).map((scene) => Number(scene.from));
  return { html, piece, duration, bpm: Number(piece?.bpm) || 120, cuts, fps: 30 };
}

const sizeOf = (format, scale = 1) => {
  const [w, h] = SIZES[format ?? "9:16"] ?? SIZES["9:16"];
  return [Math.round(w * scale), Math.round(h * scale)];
};
const stubVideo = (info) => JSON.stringify({ fake: "mp4", ...info });
const readStub = (file) => {
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    return data && data.fake === "mp4" ? data : null;
  } catch {
    return null;
  }
};

process.stderr.write(`Motor de teste: ${command}\n`);

switch (command) {
  case "help":
    done({ text: ["Motor de vídeo (de teste).", "Comandos: check, networks, capture, music, sfx, preview, render, frames, mix, accept, probe, help.", "Opções de accept", "  --format 9:16|4:5|1:1  --safe instagram-carousel|instagram-feed|networks|margin|none", "  --beats <beats.json> | --bpm <n>  --video <video.mp4>  --networks reels,ads_meta"].join("\n") });
    break;
  case "check":
    done({
      project: ROOT,
      node: process.version,
      cores: 4,
      tools: { ffmpeg: "fake", ffprobe: "fake", browser: { name: "fake", path: "fake" }, drawtext: true, encoders: { h264: true } },
      modes: { render: SETTINGS.render !== false, alpha: SETTINGS.render !== false, sheets: true },
      formats: Object.fromEntries(Object.entries(SIZES).map(([name, [w, h]]) => [name, `${w}x${h}`])),
      install: SETTINGS.install ?? {},
      install_note: SETTINGS.install ? "Rode você mesmo cada comando de install, com tempo limite longo." : null,
      runtime: rel(join(MODULE_DIR, "runtime", "motion.js")),
    });
    break;
  case "networks": {
    const networks = [
      { id: "reels", label: "Instagram Reels", formats: ["9:16"], safe_zone: { "9:16": { top: 250, bottom: 420, left: 70, right: 180 } } },
      { id: "feed", label: "Instagram feed", formats: ["4:5", "1:1", "16:9"], safe_zone: { "4:5": { top: 120, bottom: 200, left: 60, right: 60 }, "1:1": { top: 80, bottom: 120, left: 60, right: 60 } } },
    ];
    if (SETTINGS.networks !== "old") networks.push({ id: "ads_meta", label: "Anúncios Meta (Reels e Stories)", formats: ["9:16"], safe_zone: { "9:16": { top: 270, bottom: 672, left: 65, right: 140 } } });
    done({
      checked_on: "2026-10-07",
      formats: { "9:16": { width: 1080, height: 1920, safe_zone: { top: 250, bottom: 500, left: 70, right: 180 } }, "4:5": { width: 1080, height: 1350, safe_zone: { top: 120, bottom: 200, left: 72, right: 72 } }, "1:1": { width: 1080, height: 1080, safe_zone: { top: 80, bottom: 120, left: 60, right: 60 } } },
      defaults_by_format: { "9:16": ["reels", "tiktok", "shorts"], "4:5": ["feed"] },
      networks,
    });
    break;
  }
  case "capture": {
    if (positionals.length !== 1) fail("usage", "Informe o endereço: capture <url> [--out <pasta>].");
    const input = positionals[0];
    if (input.toLowerCase().includes("bloqueado")) fail("site_blocked", "O site não deixou o navegador entrar (HTTP 403).", "Nada útil foi capturado. Peça ao integrante uma captura de tela ou use outro endereço do mesmo site.");
    const url = /^[a-z]+:\/\//i.test(input) ? input : `https://${input}`;
    const host = new URL(url).hostname.replace(/^www\./, "");
    const out = values.out ? resolve(ROOT, values.out) : join(ROOT, "capturas", host.replace(/\./g, "-"));
    const label = host.split(".")[0];
    const name = label.charAt(0).toUpperCase() + label.slice(1);
    const withLogo = !input.toLowerCase().includes("sem-logo");
    for (const file of ["desktop.png", "desktop-full.png", "mobile.png", "mobile-full.png"]) write(join(out, file), PNG);
    if (withLogo) write(join(out, "assets", "logo-1.svg"), SVG);
    const brand = { name, title: `${name} | Site oficial`, headline: `${name} para quem atende`, logo: withLogo ? { file: "assets/logo-1.svg", source: "dom", kind: "svg", width: 44, height: 44 } : null, colors: { primary: "#7C3AED", background: "#FFFFFF", text: "#1A1A1A", palette: [] } };
    const captura = { format_version: 1, url, final_url: url, site: host, captured_at: new Date().toISOString(), brand, files: { desktop: "desktop.png", mobile: "mobile.png", mobile_full: "mobile-full.png", capture: "captura.json", assets: withLogo ? ["assets/logo-1.svg"] : [] }, warnings: withLogo ? [] : ["Não encontrei um logo na página."] };
    write(join(out, "captura.json"), `${JSON.stringify(captura, null, 2)}\n`);
    done({ url, final_url: url, site: host, http_status: 200, dir: rel(out), capture_file: rel(join(out, "captura.json")), files: captura.files, brand, cookie_banner: null, elapsed_s: 0.1, warnings: captura.warnings });
    break;
  }
  case "music": {
    if (positionals.length) fail("usage", "O comando music não recebe arquivo de entrada.");
    const out = need("out");
    const duration = Number(need("duration"));
    const bpm = Number(values.bpm ?? 120);
    const style = values.style ?? "clean";
    if (!MUSIC_STYLES.includes(style)) fail("usage", `Estilo desconhecido: ${style}.`, `Estilos: ${MUSIC_STYLES.join(", ")}.`);
    const beat = 60 / bpm;
    const beats = [];
    for (let k = 0; k * beat < duration - 0.5; k++) beats.push(round(k * beat));
    write(out, `RIFF fake music ${style} ${bpm} ${duration} ${values.seed ?? 1}`);
    write(out.replace(/\.wav$/i, ".beats.json"), JSON.stringify({ format_version: 1, source: "synthesized", bpm, offset: 0, duration, beats }, null, 2));
    done({ file: rel(resolve(out)), bpm, duration, style, seed: Number(values.seed ?? 1), warnings: [] });
    break;
  }
  case "sfx": {
    const out = need("out");
    const data = JSON.parse(readFileSync(existing(values.events, "o arquivo de eventos"), "utf8"));
    if (!Array.isArray(data.events) || !data.events.length) fail("usage", "A lista de eventos está vazia.");
    for (const [index, event] of data.events.entries()) {
      if (!SFX_TYPES.includes(event.type)) fail("usage", `Tipo desconhecido no evento ${index + 1}: ${event.type}.`, `Tipos: ${SFX_TYPES.join(", ")}.`);
      if (typeof event.t !== "number" || event.t < 0) fail("usage", `O evento ${index + 1} precisa de um tempo t em segundos.`);
    }
    write(out, `RIFF fake sfx ${data.events.length}`);
    done({ file: rel(resolve(out)), duration: Number(values.duration ?? data.duration), events: data.events.length, types: [...new Set(data.events.map((event) => event.type))], peak_dbfs: -6, warnings: [] });
    break;
  }
  case "preview":
  case "render": {
    if (positionals.length !== 1) fail("usage", `Informe uma página: ${command} <pagina.html> --out <video>.`);
    const page = pageOf(positionals[0]);
    if (page.html.includes("QUEBRA")) fail("page_error", "A página deu erro ao carregar: ReferenceError: quebra is not defined", "Corrija o JavaScript da página e renderize de novo.");
    const out = need("out");
    const scale = Number(values.scale ?? (command === "preview" ? 0.5 : 1));
    const [width, height] = sizeOf(values.format, scale);
    write(out, stubVideo({ kind: command, width, height, duration: page.duration, fps: 30, audio: false }));
    done({ page: rel(resolve(positionals[0])), file: rel(resolve(out)), width, height, fps: 30, subframes: Number(values.sub ?? 1), frames: page.duration * 30, duration: page.duration, format: values.format ?? "9:16", frames_hash: createHash("sha256").update(`${page.html}|${scale}`).digest("hex"), film: { duration: page.duration, cuts: page.cuts, has_seek: true, has_set_format: true, has_boxes: !page.html.includes("SEM_CAIXAS") }, warnings: [] });
    break;
  }
  case "frames": {
    if (positionals.length !== 1) fail("usage", "Informe uma página: frames <pagina.html> [--times …].");
    const page = pageOf(positionals[0]);
    const out = values.out ? resolve(ROOT, values.out) : join(dirname(resolve(positionals[0])), "quadros");
    const times = values.times ? values.times.split(",").map(Number) : [0];
    const [width, height] = sizeOf(values.format, Number(values.scale ?? 1));
    const frames = times.map((time, index) => {
      const file = join(out, `quadro-${String(index + 1).padStart(4, "0")}.png`);
      write(file, PNG);
      return { time: round(time, 3), label: `00:${String(Math.floor(time)).padStart(2, "0")}`, file: rel(file) };
    });
    write(join(out, "folha.png"), PNG);
    done({ page: rel(resolve(positionals[0])), dir: rel(out), width, height, frames, sheet: rel(join(out, "folha.png")), sheet_cols: 6, warnings: [], duration: page.duration });
    break;
  }
  case "mix": {
    const out = need("out");
    const video = values.video ? existing(values.video, "o arquivo de --video") : null;
    if (values.music) existing(values.music, "o arquivo de --music");
    if (values.sfx) existing(values.sfx, "o arquivo de --sfx");
    if (!values.music && !values.sfx && !values.voice) fail("usage", "Informe pelo menos uma fonte: --music, --sfx ou --voice.");
    const source = video ? readStub(video) : null;
    write(out, stubVideo({ kind: "mix", width: source?.width ?? 1080, height: source?.height ?? 1920, duration: source?.duration ?? 15, fps: 30, audio: true }));
    done({ file: rel(resolve(out)), duration: source?.duration ?? 15, loudness: { integrated_lufs: -14.1, true_peak_dbtp: -1.6, range_lu: 4.2 }, warnings: [] });
    break;
  }
  case "accept": {
    if (positionals.length !== 1) fail("usage", "Informe uma página: accept <pagina.html> [--format 9:16] [--safe instagram-feed] [--beats beats.json] [--video video.mp4].");
    const page = pageOf(positionals[0]);
    const grid = values.beats ? JSON.parse(readFileSync(existing(values.beats, "o beats.json"), "utf8")) : null;
    if (values.video) existing(values.video, "o vídeo");
    const networks = values.networks ? values.networks.split(",") : [];
    const known = ["reels", "feed", "tiktok", "shorts", ...(SETTINGS.networks !== "old" ? ["ads_meta"] : [])];
    const unknown = networks.find((id) => !known.includes(id));
    if (unknown) fail("unknown_network", `Rede desconhecida: ${unknown}.`, "Rode networks para ver as redes.");
    const boxes = !page.html.includes("SEM_CAIXAS");
    const beats = grid?.beats ?? null;
    const off = beats ? page.cuts.filter((cut) => !beats.some((beat) => Math.abs(beat - cut) <= 1 / 30 + 1e-6)) : [];
    const check = (name, status, summary, details = []) => ({ name, status, summary, details });
    const checks = [
      check("page", "pass", `Carrega, define seek(t) e dura ${page.duration} s, com ${page.cuts.length} corte(s) declarado(s).`),
      !boxes ? check("first_frame_readable", "skip", "Sem window.boxes(t) na página.") : page.html.includes("SEM_CAPA") ? check("first_frame_readable", "fail", "O quadro 0 não tem texto: a capa precisa ser lida parada.") : check("first_frame_readable", "pass", "Texto de 84 px no quadro 0 (mínimo 44 px)."),
      !boxes ? check("safe_area", "skip", "Sem window.boxes(t) na página.") : page.html.includes("FORA_DA_ZONA") ? check("safe_area", "fail", "1 caixa(s) fora da área segura em 4 de 60 instantes.") : check("safe_area", "pass", "Texto, logo e rosto dentro da área segura."),
      !boxes ? check("text_size", "skip", "Sem window.boxes(t) na página.") : check("text_size", "pass", "Menor texto: 52 px (mínimo 44 px)."),
      !page.cuts.length ? check("cuts_on_beat", "skip", "A página não declara cortes.") : !beats ? check("cuts_on_beat", "skip", "Sem batidas.") : off.length ? check("cuts_on_beat", "fail", `${off.length} corte(s) fora da batida.`, off) : check("cuts_on_beat", "pass", `${page.cuts.length} de ${page.cuts.length} corte(s) caem numa batida.`),
      values.video ? check("loudness", "pass", "Volume de -14,1 LUFS.") : check("loudness", "skip", "Sem vídeo."),
      ...networks.map((id) => ({ ...check("duration", page.duration <= 60 ? "pass" : "fail", `${page.duration} s dentro do limite de ${id}.`), network: id })),
    ];
    const counts = { pass: 0, fail: 0, warn: 0, skip: 0 };
    for (const item of checks) counts[item.status]++;
    done({
      mode: "page",
      page: rel(resolve(positionals[0])),
      video: values.video ? rel(resolve(values.video)) : null,
      format: values.format ?? "9:16",
      safe: { preset: values.safe ?? "instagram-feed", rect: { x: 65, y: 270, w: 875, h: 978 }, networks },
      networks,
      passed: counts.fail === 0,
      counts,
      checks,
      warnings: boxes ? [] : ["A página não define window.boxes(t): a capa, o tamanho do texto e a área segura não foram conferidos."],
      report: null,
    });
    break;
  }
  case "probe": {
    if (positionals.length !== 1) fail("usage", "Informe um arquivo: probe <arquivo>.");
    const stub = readStub(existing(positionals[0], "o arquivo"));
    if (!stub) fail("unreadable_media", `Não consegui ler ${positionals[0]} como mídia.`, "Confira o caminho do arquivo.");
    done({ file: rel(resolve(positionals[0])), duration: stub.duration, size: 1234, width: stub.width, height: stub.height, fps: 30, video_codec: "h264", has_alpha: false, audio_codec: stub.audio ? "aac" : null, has_audio: Boolean(stub.audio) });
    break;
  }
  default:
    fail("usage", `Comando desconhecido: ${command}.`, "Comandos: check, networks, capture, music, sfx, preview, render, frames, mix, accept, probe, help.");
}
