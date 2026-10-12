// A stand-in Motor de vídeo for the tests of the Estúdio de vídeo: it speaks the Motor's command
// lines (references/interface.md of video-render), writes stand-in files where the real ones
// would go, answers with result-shaped JSON and logs every call into calls.json beside its own
// folder (never into the member's project). It renders nothing and opens no browser.
//
// How the tests steer it:
//   fake.json (in the module folder): { "networks": true }   → `accept` takes --networks and help says so
//                                     { "render": false, "install": { "ffmpeg": "…" } } → what `check` reports
//   capture of an address with "bloqueado", "fora-do-ar", "estacionado", "nao-e-endereco" or "captura-quebrada" fails like the real one;
//   with "em-breve" it succeeds with a "coming soon" placeholder
//   a page with QUEBRA fails to render; with SEM_CAPA or FORA_DA_ZONA it fails a check
//   an audio file named like "trilha-97bpm.mp3" is measured at 97 BPM; "confusa" in the name gives a low confidence

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
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
  "safe", "margin", "min-text", "mobile", "desktop", "scroll",
  ...(SETTINGS.networks ? ["networks"] : []),
]);
const SFX_TYPES = ["kick", "thump", "impact", "click", "tick", "pop", "whoosh", "swish", "riser", "ding", "shutter", "pluck", "blip"];
const MUSIC_STYLES = ["clean", "energetic", "warm", "minimal", "cinematic", "playful"];
const SYNTH_STYLES = ["clean", "noir", "upbeat", "lofi", "pulse"];
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

/** The roteiro a page of the Estúdio de vídeo carries, and the film it would declare. */
function pageOf(file) {
  existing(file, "a página HTML");
  if (extname(file).toLowerCase() !== ".html") fail("usage", `A página precisa ser um arquivo .html: ${file}.`);
  const html = readFileSync(file, "utf8");
  const block = /<script\b[^>]*\bid=["']roteiro["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  let roteiro = null;
  try {
    roteiro = block ? JSON.parse(block[1]) : null;
  } catch {
    roteiro = null;
  }
  const bpm = Number(roteiro?.bpm) || 120;
  const bars = (roteiro?.scenes ?? []).reduce((total, scene) => total + Number(scene.bars || 0), 0) || Number(roteiro?.bars) || 3;
  const beat = 60 / bpm;
  const duration = round(bars * 4 * beat);
  let offset = 0;
  const cuts = [];
  (roteiro?.scenes ?? []).forEach((scene, index) => {
    if (index > 0) cuts.push(round(offset * 4 * beat));
    offset += Number(scene.bars || 0);
  });
  return { html, roteiro, duration, bpm, cuts, fps: Number(roteiro?.fps) || 30 };
}

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
  case "help": {
    const lines = [
      "Motor de vídeo (de teste).",
      "Comandos: check, capture, music, synth, sfx, beats, preview, render, frames, mix, accept, probe, open, help.",
      "Opções de accept",
      "  --format 9:16|4:5|3:4|1:1|16:9|WxH  --safe instagram-carousel|instagram-feed|margin|none",
      "  --beats <beats.json> | --bpm <n>  --video <video.mp4>  --loop",
    ];
    if (SETTINGS.networks) lines.push("  --networks reels,tiktok,shorts    Confere pela zona segura de cada rede.");
    done({ text: lines.join("\n") });
    break;
  }
  case "check":
    done({
      project: ROOT,
      node: process.version,
      cores: 4,
      tools: { ffmpeg: "fake", ffprobe: "fake", browser: { name: "fake", path: "fake" }, drawtext: true, encoders: { h264: true, prores: true, vp9: true } },
      modes: { render: SETTINGS.render !== false, alpha: SETTINGS.render !== false, sheets: true },
      formats: { "9:16": "1080x1920", "1:1": "1080x1080", "16:9": "1920x1080", "4:5": "1080x1350", "3:4": "1080x1440" },
      install: SETTINGS.install ?? {},
      install_note: SETTINGS.install ? "Rode você mesmo cada comando de install, com tempo limite longo." : null,
      runtime: rel(join(MODULE_DIR, "runtime", "motion.js")),
      guides: { page: rel(join(MODULE_DIR, "references", "pagina.md")), interface: rel(join(MODULE_DIR, "references", "interface.md")) },
    });
    break;
  case "capture": {
    if (positionals.length !== 1) fail("usage", "Informe o endereço: capture <url> [--out <pasta>].");
    const input = positionals[0];
    const low = input.toLowerCase();
    if (low.includes("nao-e-endereco")) fail("invalid_url", `Não reconheci o endereço: ${input}.`, "Use um endereço completo, como https://www.exemplo.com.br, ou o caminho de um arquivo .html.");
    if (low.includes("bloqueado")) fail("site_blocked", "O site não deixou o navegador entrar (HTTP 403).", "Nada útil foi capturado. Peça ao integrante uma captura de tela ou use outro endereço do mesmo site.");
    if (low.includes("fora-do-ar")) fail("site_unreachable", `Não consegui abrir ${input}: o endereço não existe ou o DNS não respondeu (ERR_NAME_NOT_RESOLVED).`, "Confira o endereço e a conexão; se o site estiver no ar, tente de novo em instantes.");
    if (low.includes("estacionado")) fail("site_placeholder", `${input.replace(/^[a-z]+:\/\//i, "").replace(/^www\./, "").replace(/\/.*$/, "")} ainda não tem o site da marca: o domínio está estacionado no provedor, sem site publicado (título "Parked Domain name").`, "O logo, as cores e os textos dessa página são do provedor, não da marca; sem-site.png mostra o que o endereço devolveu. Use outro endereço da marca, ou peça o logo e duas ou três imagens ao integrante.");
    if (low.includes("captura-quebrada")) fail("capture_failed", `A captura de ${input} falhou: o navegador fechou.`, "Tente de novo; se repetir, use --scroll 0 ou --no-assets para isolar o problema.");
    const url = /^[a-z]+:\/\//i.test(input) ? input : `https://${input}`;
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const out = values.out ? resolve(ROOT, values.out) : join(ROOT, "capturas", host.replace(/\./g, "-"));
    const captura = JSON.parse(readFileSync(join(HERE, "captura.json"), "utf8"));
    captura.url = url;
    captura.final_url = parsed.href;
    captura.site = host;
    captura.captured_at = new Date().toISOString();
    if (!host.includes("sorrisopleno")) {
      const label = host.split(".")[0];
      const name = label.charAt(0).toUpperCase() + label.slice(1);
      captura.brand.name = name;
      captura.brand.title = `${name} | Loja oficial`;
      captura.brand.social = { instagram: `https://www.instagram.com/${label}` };
      captura.brand.contacts = { emails: [], phones: [], whatsapp: [] };
      captura.raw.document.canonical = `${parsed.origin}/`;
      captura.raw.document.og.site_name = name;
    }
    if (low.includes("sem-logo")) {
      captura.brand.logo = null;
      captura.assets = [];
      captura.files.assets = [];
      captura.warnings.push("Não encontrei um logo na página.");
    }
    if (low.includes("em-breve")) {
      captura.placeholder = { kind: "coming_soon", label: "a página é provisória (em breve ou em construção)", evidence: `título "${captura.brand.name} | Em breve"` };
      captura.warnings.push(`A página parece provisória (${captura.placeholder.evidence}): confira se o logo e as cores são mesmo da marca antes de usá-los.`);
    }
    if (low.includes("sem-cor")) {
      captura.brand.colors.primary = null;
      captura.warnings.push("Não achei uma cor de destaque saturada; a paleta traz as cores mais usadas.");
    }
    for (const name of ["desktop.png", "desktop-full.png", "mobile.png", "mobile-full.png"]) write(join(out, name), PNG);
    if (captura.brand.logo) write(join(out, "assets", "logo-1.svg"), SVG);
    write(join(out, "captura.json"), `${JSON.stringify(captura, null, 2)}\n`);
    done({
      url: captura.url,
      final_url: captura.final_url,
      site: captura.site,
      http_status: 200,
      dir: rel(out),
      capture_file: rel(join(out, "captura.json")),
      files: captura.files,
      viewports: captura.viewports,
      scroll: captura.scroll,
      brand: captura.brand,
      cookie_banner: null,
      elapsed_s: 0.1,
      warnings: captura.warnings,
    });
    break;
  }
  case "music": {
    if (positionals.length) fail("usage", "O comando music não recebe arquivo de entrada.");
    const out = need("out");
    const duration = Number(need("duration"));
    const bpm = Number(values.bpm ?? 120);
    const style = values.style ?? "clean";
    if (!MUSIC_STYLES.includes(style)) fail("usage", `Estilo desconhecido: ${style}.`, `Estilos: ${MUSIC_STYLES.join(", ")}.`);
    if (!["auto", "flat"].includes(values.arc ?? "auto")) fail("usage", `Arco desconhecido: ${values.arc}.`, "Use auto ou flat.");
    const beat = 60 / bpm;
    const hit = Math.max(0, Math.floor((duration - 1e-6) / (beat * 4)) * beat * 4);
    const beats = [];
    for (let k = 0; ; k++) {
      const t = round(k * beat);
      if (values.loop ? t >= duration - 1e-6 : t > hit + 1e-6) break;
      beats.push(t);
    }
    const grid = { format_version: 1, source: "synthesized", bpm, offset: 0, duration, beats, downbeats: beats.filter((_, index) => index % 4 === 0), hits: [round(hit)], sections: [{ name: "intro", start: 0, end: round(duration) }], drop: null };
    write(out, `RIFF fake music ${style} ${bpm} ${duration} ${values.seed ?? 1}`);
    const beatsFile = out.replace(/\.wav$/i, ".beats.json");
    write(beatsFile, JSON.stringify(grid, null, 2));
    done({ file: rel(resolve(out)), beats_file: rel(resolve(beatsFile)), bpm, duration, style, seed: Number(values.seed ?? 1), key: "Am", arc: values.arc ?? "auto", loop: Boolean(values.loop), progression: "i-VI-III-VII", sections: grid.sections, drop: null, hits: grid.hits, beat_count: beats.length, peak_dbfs: -3, warnings: [] });
    break;
  }
  case "synth": {
    const out = need("out");
    const bpm = Number(need("bpm"));
    const bars = Number(need("bars"));
    const style = values.style ?? "clean";
    if (!Number.isInteger(bars) || bars < 1 || bars > 64) fail("usage", `Valor inválido para --bars: ${values.bars}.`, "Use um número inteiro entre 1 e 64.");
    if (!SYNTH_STYLES.includes(style)) fail("usage", `Estilo desconhecido: ${style}.`, `Estilos: ${SYNTH_STYLES.join(", ")}.`);
    const beat = 60 / bpm;
    const beats = Array.from({ length: bars * 4 }, (_, index) => round(index * beat));
    const downbeats = beats.filter((_, index) => index % 4 === 0);
    const duration = round(bars * 4 * beat);
    write(out, `RIFF fake synth ${style} ${bpm} ${bars} ${values.seed ?? 1}`);
    const beatsFile = out.replace(/\.wav$/i, ".beats.json");
    write(beatsFile, JSON.stringify({ bpm, offset: 0, beats_per_bar: 4, bars, duration, beats, downbeats, source: "synth", style, seed: Number(values.seed ?? 1) }, null, 2));
    done({ file: rel(resolve(out)), beats_file: rel(resolve(beatsFile)), bpm, bars, beats_per_bar: 4, beat_s: round(beat), bar_s: round(beat * 4), duration, style, seed: Number(values.seed ?? 1), intro_bars: 0, sample_rate: 48000, channels: 2, lufs: -16, true_peak_dbtp: -1.2, beats, downbeats, warnings: [] });
    break;
  }
  case "beats": {
    if (positionals.length !== 1) fail("usage", "Informe um arquivo: beats <audio> [--out grade.json].");
    const file = existing(positionals[0], "o áudio");
    const named = /(\d{2,3})\s*bpm/i.exec(basename(file));
    const bpm = named ? Number(named[1]) : 120;
    const beat = 60 / bpm;
    const offset = 0.25;
    const duration = 60;
    const beats = [];
    for (let t = offset; t < duration; t += beat) beats.push(round(t, 3));
    const downbeats = beats.filter((_, index) => index % 4 === 0);
    const grid = { format_version: 1, source: "analysis", file: rel(resolve(file)), bpm, offset, confidence: /confusa/i.test(file) ? 0.3 : 0.9, duration, beats, downbeats, beats_per_bar: 4, bars: downbeats.length, hits: [], method: "fake" };
    const out = values.out ?? file.replace(/\.[^.]+$/, ".beats.json");
    write(out, JSON.stringify(grid, null, 2));
    done({ ...grid, beats_file: rel(resolve(out)), beat_count: beats.length, candidates: [bpm] });
    break;
  }
  case "sfx": {
    const out = need("out");
    const eventsFile = existing(values.events, "o arquivo de eventos");
    const data = JSON.parse(readFileSync(eventsFile, "utf8"));
    if (!Array.isArray(data.events) || !data.events.length) fail("usage", "A lista de eventos está vazia.");
    for (const [index, event] of data.events.entries()) {
      if (!SFX_TYPES.includes(event.type)) fail("usage", `Tipo desconhecido no evento ${index + 1}: ${event.type}.`, `Tipos: ${SFX_TYPES.join(", ")}.`);
      if (typeof event.t !== "number" || event.t < 0) fail("usage", `O evento ${index + 1} precisa de um tempo t em segundos.`);
    }
    const duration = values.duration !== undefined ? Number(values.duration) : Number(data.duration);
    write(out, `RIFF fake sfx ${data.events.length}`);
    write(`${out}.received.json`, JSON.stringify({ duration, ...data }, null, 2));
    done({ file: rel(resolve(out)), duration, events: data.events.length, types: [...new Set(data.events.map((event) => event.type))], peak_dbfs: -6, warnings: [] });
    break;
  }
  case "preview":
  case "render": {
    if (positionals.length !== 1) fail("usage", `Informe uma página: ${command} <pagina.html> --out <video>.`);
    const page = pageOf(positionals[0]);
    if (page.html.includes("QUEBRA")) fail("page_error", "A página deu erro ao carregar: ReferenceError: quebra is not defined", "Corrija o JavaScript da página e renderize de novo.");
    const out = need("out");
    const preview = command === "preview";
    const scale = Number(values.scale ?? (preview ? 0.5 : 1));
    const fps = Number(values.fps ?? page.fps);
    const sub = preview ? 1 : Number(values.sub ?? 1);
    const width = Math.round(1080 * scale);
    const height = Math.round(1920 * scale);
    write(out, stubVideo({ kind: command, width, height, duration: page.duration, fps, sub, audio: false, page: rel(resolve(positionals[0])) }));
    done({
      page: rel(resolve(positionals[0])),
      file: rel(resolve(out)),
      width,
      height,
      fps,
      subframes: sub,
      frames: Math.round(page.duration * fps),
      duration: page.duration,
      start: 0,
      end: page.duration,
      format: values.format ?? "9:16",
      alpha: false,
      audio: null,
      size_bytes: 1234,
      workers: 1,
      elapsed_s: 0.1,
      frames_hash: createHash("sha256").update(`${page.html}|${scale}|${fps}|${sub}`).digest("hex"),
      film: { duration: page.duration, width: 1080, height: 1920, fps: page.fps, background: page.roteiro?.palette?.background ?? "#000000", cuts: page.cuts, title: page.roteiro?.title ?? null, has_seek: true, has_set_format: true, has_boxes: true },
      warnings: [],
    });
    break;
  }
  case "frames": {
    if (positionals.length !== 1) fail("usage", "Informe uma página: frames <pagina.html> [--times …].");
    const page = pageOf(positionals[0]);
    const out = values.out ? resolve(ROOT, values.out) : join(dirname(resolve(positionals[0])), "quadros");
    let times;
    if (values.times) times = values.times.split(",").map(Number);
    else if (values.beats) {
      const grid = JSON.parse(readFileSync(existing(values.beats, "o beats.json"), "utf8"));
      times = (grid.beats ?? []).filter((t) => t < page.duration);
      if (!times.length) fail("usage", "O beats.json não tem batidas.");
    } else times = Array.from({ length: Math.ceil(page.duration / 0.5) }, (_, index) => index * 0.5);
    const scale = Number(values.scale ?? 1);
    const frames = times.map((time, index) => {
      const file = join(out, `quadro-${String(index + 1).padStart(4, "0")}.png`);
      write(file, PNG);
      const seconds = Math.floor(time);
      return { time: round(time, 3), label: `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`, file: rel(file) };
    });
    const sheet = values.sheet ? resolve(ROOT, values.sheet) : join(out, "folha.png");
    write(sheet, PNG);
    done({ page: rel(resolve(positionals[0])), dir: rel(out), width: Math.round(1080 * scale), height: Math.round(1920 * scale), frames, sheet: rel(sheet), sheet_cols: 6, warnings: [] });
    break;
  }
  case "mix": {
    if (positionals.length) fail("usage", "O comando mix só recebe opções.");
    const out = need("out");
    const video = values.video ? existing(values.video, "o arquivo de --video") : null;
    const music = values.music ? existing(values.music, "o arquivo de --music") : null;
    const sfx = values.sfx ? existing(values.sfx, "o arquivo de --sfx") : null;
    if (!music && !sfx && !values.voice) fail("usage", "Informe pelo menos uma fonte: --music, --sfx ou --voice.");
    const source = video ? readStub(video) : null;
    const duration = source?.duration ?? Number(values.duration ?? 6);
    write(out, stubVideo({ kind: "mix", width: source?.width ?? 1080, height: source?.height ?? 1920, duration, fps: source?.fps ?? 30, audio: true, music: music ? rel(resolve(music)) : null, music_offset: Number(values["music-offset"] ?? 0), sfx: sfx ? rel(resolve(sfx)) : null, fade_out: Number(values["fade-out"] ?? 0) }));
    done({
      file: rel(resolve(out)),
      duration,
      loudness: { integrated_lufs: -14.1, true_peak_dbtp: -1.2, range_lu: 4.2 },
      inputs: { video: video ? rel(resolve(video)) : null, music: music ? rel(resolve(music)) : null, sfx: sfx ? rel(resolve(sfx)) : null, voice: null },
      sources: { music: music ? rel(resolve(music)) : null, music_offset: Number(values["music-offset"] ?? 0), music_gain_db: 0, sfx: sfx ? rel(resolve(sfx)) : null, sfx_gain_db: 0, voice: null, voice_gain_db: 0 },
      settings: { lufs: -14, tp: -1, fade_out: Number(values["fade-out"] ?? 0), music_offset: Number(values["music-offset"] ?? 0) },
      warnings: [],
    });
    break;
  }
  case "accept": {
    if (positionals.length !== 1) fail("usage", "Informe uma página: accept <pagina.html> [--format 9:16] [--safe instagram-feed] [--beats beats.json | --bpm 120] [--video video.mp4].");
    const page = pageOf(positionals[0]);
    if (values.beats !== undefined && values.bpm !== undefined) fail("usage", "Use --beats ou --bpm, não os dois.");
    const grid = values.beats ? JSON.parse(readFileSync(existing(values.beats, "o beats.json"), "utf8")) : null;
    const video = values.video ? existing(values.video, "o vídeo") : null;
    const beats = grid?.beats ?? (values.bpm ? Array.from({ length: Math.ceil((page.duration * Number(values.bpm)) / 60) }, (_, index) => round((index * 60) / Number(values.bpm))) : null);
    const off = beats ? page.cuts.filter((cut) => !beats.some((beat) => Math.abs(beat - cut) <= 1 / page.fps + 1e-6)) : [];
    const check = (name, status, summary, details = []) => ({ name, status, summary, details });
    const checks = [
      check("page", "pass", `Carrega, define seek(t) e dura ${page.duration} s, com ${page.cuts.length} corte(s) declarado(s).`),
      page.html.includes("SEM_CAPA") ? check("first_frame_readable", "fail", "O quadro 0 não tem texto: a capa precisa ser lida parada.") : check("first_frame_readable", "pass", "Texto de 96 px no quadro 0 (mínimo 44 px)."),
      page.html.includes("FORA_DA_ZONA") ? check("safe_area", "fail", "1 caixa(s) fora da área segura instagram-feed em 4 de 60 instantes; pior: texto em 2 s (40 px embaixo).") : check("safe_area", "pass", "Texto, logo e rosto dentro da área segura."),
      check("text_size", "pass", "Menor texto: 52 px (mínimo 44 px)."),
      !page.cuts.length ? check("cuts_on_beat", "skip", "A página não declara cortes (film.cuts).") : !beats ? check("cuts_on_beat", "skip", "Sem batidas: passe --beats beats.json ou --bpm para conferir os cortes.") : off.length ? check("cuts_on_beat", "fail", `${off.length} de ${page.cuts.length} corte(s) fora da batida.`, off) : check("cuts_on_beat", "pass", `${page.cuts.length} de ${page.cuts.length} corte(s) caem numa batida.`),
      check("loop_seamless", "skip", "Não pedido; passe --loop num vídeo que repete."),
      video ? check("flashes", "pass", "Nenhuma mudança brusca de luz.") : check("flashes", "skip", "Sem --video: passe o vídeo renderizado para medir."),
      video ? check("dead_time", "pass", "A tela muda em todos os quadros.") : check("dead_time", "skip", "Sem --video: passe o vídeo renderizado para medir."),
    ];
    const networks = values.networks ? values.networks.split(",") : null;
    const counts = { pass: 0, fail: 0, warn: 0, skip: 0 };
    for (const item of checks) counts[item.status]++;
    done({
      page: rel(resolve(positionals[0])),
      format: values.format ?? "9:16",
      width: 1080,
      height: 1920,
      duration: page.duration,
      fps: page.fps,
      safe: { preset: values.safe ?? "instagram-feed", rect: { x: 70, y: 250, w: 830, h: 1170 }, corners: [], margin: null },
      min_text: Number(values["min-text"] ?? 44),
      beats: beats ? { source: grid ? "file" : "bpm", file: values.beats ?? null, bpm: values.bpm ? Number(values.bpm) : null, count: beats.length } : null,
      samples: 60,
      cuts: page.cuts.length,
      video: video ? rel(resolve(video)) : null,
      ...(networks ? { networks } : {}),
      passed: counts.fail === 0,
      counts,
      checks,
      warnings: [],
      report: null,
    });
    break;
  }
  case "probe": {
    if (positionals.length !== 1) fail("usage", "Informe um arquivo: probe <arquivo>.");
    const file = existing(positionals[0], "o arquivo");
    const stub = readStub(file);
    if (!stub) fail("unreadable_media", `Não consegui ler ${positionals[0]} como mídia.`, "Confira o caminho do arquivo.");
    done({ file: rel(resolve(file)), duration: stub.duration, size: 1234, width: stub.width, height: stub.height, fps: stub.fps ?? 30, frames: Math.round(stub.duration * (stub.fps ?? 30)), video_codec: "h264", pixel_format: "yuv420p", has_alpha: false, audio_codec: stub.audio ? "aac" : null, audio_channels: stub.audio ? 2 : null, audio_rate: stub.audio ? 48000 : null, has_audio: Boolean(stub.audio) });
    break;
  }
  case "open":
    done({ file: rel(resolve(existing(positionals[0], "o arquivo"))) });
    break;
  default:
    fail("usage", `Comando desconhecido: ${command}.`, "Comandos: check, capture, music, synth, sfx, beats, preview, render, frames, mix, accept, probe, open, help.");
}
