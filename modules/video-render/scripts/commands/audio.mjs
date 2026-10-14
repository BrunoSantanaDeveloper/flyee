// The audio group: synthesized music with its beat grid, interface sounds, the beat
// grid of any audio file, the final mix under a video and loudness measurement.

import { basename, dirname, extname, join, resolve } from "node:path";

import { analyzeBeats } from "../lib/audio/beats.mjs";
import { STYLE_NAMES, STYLES, synthesizeMusic } from "../lib/audio/music.mjs";
import { CUE_TYPES, parseCueList, synthesizeSfx } from "../lib/audio/sfx.mjs";
import { peakDb, readWav, toMono, writeWav } from "../lib/audio/wav.mjs";
import { decodeAudio, measureLoudness, mixAudio, probe } from "../lib/ffmpeg.mjs";
import { STYLE_DESCRIPTIONS, STYLE_NAMES as LOOP_STYLES, synthesizeMusic as synthesizeLoop } from "../lib/audio/styles.mjs";
import { SFX_ALIASES, SFX_TYPE_NAMES, synthesizeSfx as synthesizeEvents } from "../lib/audio/synth.mjs";
import { checkTools } from "../lib/tools.mjs";
import { AppError, parseList, parseNumber, parseTime, readJson, removeDir, requireJson, resolveInput, round, run, tempDir, usage, writeJson } from "../lib/util.mjs";

export const argSpec = {
  flags: ["loop"],
  options: [
    "style", "seed", "key", "arc", "beats-out", "cues", "bpm", "bpm-min", "bpm-max", "music", "music-gain", "sfx", "sfx-gain", "voice", "voice-gain", "duck", "lufs", "tp", "fade-out", "video",
    "bars", "beats-per-bar", "intro-bars", "gain", "events", "event", "music-offset", "peak", "min-bpm", "max-bpm",
  ],
};

const ANALYSIS_RATE = 22050;

function wavOutput(ctx, values, { fallback = null } = {}) {
  const out = ctx.outputPath(values, { required: !fallback, fallback });
  if (extname(out).toLowerCase() !== ".wav") throw usage(`O arquivo de saída precisa ser .wav: ${values.out}.`, "O mix final (comando mix) converte para AAC dentro do vídeo.");
  return out;
}

const sibling = (file, suffix) => join(dirname(file), `${basename(file, extname(file))}${suffix}`);

/** Mono samples at 22.05 kHz: a WAV is read directly; anything else goes through ffmpeg. */
async function monoForAnalysis(file, ctx) {
  if (extname(file).toLowerCase() === ".wav") {
    try {
      const wav = readWav(file);
      const mono = toMono(wav.samples, wav.channels);
      if (wav.rate === ANALYSIS_RATE) return { samples: mono, rate: wav.rate };
      // linear resampling is enough for onset detection
      const length = Math.floor((mono.length * ANALYSIS_RATE) / wav.rate);
      const out = new Float32Array(length);
      const step = wav.rate / ANALYSIS_RATE;
      for (let i = 0; i < length; i++) {
        const x = i * step;
        const j = Math.floor(x);
        const f = x - j;
        out[i] = mono[j] * (1 - f) + (mono[j + 1] ?? mono[j]) * f;
      }
      return { samples: out, rate: ANALYSIS_RATE };
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "unreadable_media") throw error;
      // an unusual WAV: fall through to ffmpeg
    }
  }
  const tools = await ctx.requireTools({ browser: false });
  const info = await probe(tools.ffprobe.path, file);
  if (!info.has_audio) throw new AppError("no_audio_stream", `${ctx.rel(file)} não tem trilha de áudio.`, "Use um arquivo de áudio, ou um vídeo com som.");
  return decodeAudio(tools.ffmpeg.path, file, { rate: ANALYSIS_RATE });
}

const gainOption = (values, name, fallback = 0) => parseNumber(values[name], { name, min: -60, max: 24, fallback });

/**
 * The final encode: the mixed WAV with a linear gain, under the video (stream copied)
 * when there is one. The audio codec follows the extension: PCM for .wav, Opus for
 * .webm, AAC otherwise.
 */
async function finalizeMix(ffmpegPath, { video = null, audio, out, gainDb = 0 }) {
  const ext = extname(out).toLowerCase();
  const codec = ext === ".wav" ? ["-c:a", "pcm_s16le"] : ext === ".webm" ? ["-c:a", "libopus", "-b:a", "160k"] : ["-c:a", "aac", "-b:a", "192k"];
  const args = [
    "-hide_banner", "-loglevel", "error", "-y",
    ...(video ? ["-i", video] : []), "-i", audio,
    ...(video ? ["-map", "0:v:0", "-c:v", "copy", "-map", "1:a:0", "-shortest"] : ["-map", "0:a:0"]),
    "-af", `volume=${gainDb}dB`, ...codec, "-ar", "48000",
    "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact",
    ...([".mp4", ".m4v", ".mov", ".m4a"].includes(ext) ? ["-movflags", "+faststart"] : []),
    out,
  ];
  const result = await run(ffmpegPath, args);
  if (result.code !== 0) throw new AppError("ffmpeg_failed", "O ffmpeg falhou ao gravar o mix final.", result.stderr.trim().split("\n").slice(-3).join(" "));
}

/** `--event whoosh@0.5,impact@2` → events. */
function parseEventList(text) {
  return parseList(text).map((item) => {
    const m = /^([a-z]+)@(.+)$/i.exec(item);
    if (!m) throw usage(`Evento inválido: "${item}".`, "Use tipo@segundos, por exemplo whoosh@0.5,impact@2.");
    return { type: m[1].toLowerCase(), t: parseTime(m[2]) };
  });
}

/** Validates events ({ t, type, gain_db, pan, length, pitch, direction }) from a file or the command line. */
function normalizeEvents(input) {
  const list = Array.isArray(input) ? input : Array.isArray(input?.events) ? input.events : Array.isArray(input?.cues) ? input.cues : null;
  if (!list) throw usage("O arquivo de eventos precisa ter a chave events com uma lista.", 'Exemplo: { "duration": 6, "events": [{ "t": 0.5, "type": "whoosh" }] }.');
  if (!list.length) throw usage("A lista de eventos está vazia.");
  return list.map((event, index) => {
    if (!event || typeof event !== "object") throw usage(`O evento ${index + 1} não é um objeto.`);
    const t = typeof event.t === "number" ? event.t : event.t !== undefined ? parseTime(event.t) : NaN;
    if (!Number.isFinite(t) || t < 0) throw usage(`O evento ${index + 1} precisa de um tempo t em segundos.`);
    const type = SFX_ALIASES[event.type] ?? event.type;
    if (!SFX_TYPE_NAMES.includes(type)) throw usage(`Tipo desconhecido no evento ${index + 1}: ${event.type}.`, `Tipos: ${SFX_TYPE_NAMES.join(", ")}.`);
    const num = (value, name, min, max, fallback) => {
      if (value === undefined || value === null) return fallback;
      const n = Number(value);
      if (!Number.isFinite(n) || n < min || n > max) throw usage(`Valor inválido de ${name} no evento ${index + 1}: ${value}.`, `Use um número entre ${min} e ${max}.`);
      return n;
    };
    const direction = event.direction ?? "in";
    if (!["in", "out"].includes(direction)) throw usage(`A direction do evento ${index + 1} precisa ser in ou out.`);
    return {
      t,
      type,
      gain_db: num(event.gain_db ?? event.gain, "gain_db", -40, 12, 0),
      pan: num(event.pan, "pan", -1, 1, 0),
      length: num(event.length, "length", 0.001, 30, undefined),
      pitch: num(event.pitch, "pitch", 0.1, 8, 1),
      direction,
    };
  });
}

/** `sfx --events <json>` / `--event <list>`: effects placed at event times on one timeline. */
async function runEventSfx(positionals, values, ctx) {
  if (positionals.length) throw usage("Com --events ou --event, o comando sfx não recebe arquivo de entrada.");
  const out = wavOutput(ctx, values);
  const input = values.event !== undefined ? parseEventList(values.event) : requireJson(resolveInput(ctx.root, values.events, { what: "o arquivo de eventos" }), "o arquivo de eventos");
  const fileDuration = !Array.isArray(input) && input?.duration !== undefined ? parseTime(input.duration) : null;
  const events = normalizeEvents(input);
  const duration = values.duration !== undefined ? parseTime(values.duration) : fileDuration;
  if (duration !== null && !(duration > 0 && duration <= 3600)) throw usage(`Duração fora do limite: ${duration}.`, "Use entre 0 e 3600 segundos.");
  const warnings = [];
  const kept = duration === null ? events : events.filter((event) => event.t < duration);
  if (kept.length < events.length) warnings.push(`${events.length - kept.length} evento(s) depois de ${duration} s foram descartados.`);
  if (!kept.length) throw usage("Nenhum evento cabe na duração pedida.");
  const seed = parseNumber(values.seed, { name: "seed", min: 0, max: 2 ** 31, integer: true, fallback: 1 });
  ctx.progress(`Sintetizando ${kept.length} efeito(s) → ${ctx.rel(out)}`);
  const sfx = synthesizeEvents(kept, { duration, seed });
  writeWav(out, sfx.samples, { rate: 48000, channels: 2 });
  return {
    file: ctx.rel(out),
    duration: round(sfx.duration, 4),
    events: kept.length,
    types: [...new Set(kept.map((event) => event.type))],
    peak_dbfs: round(sfx.peak_dbfs, 2),
    warnings,
  };
}

export const commands = {
  synth: {
    summary: "Gera uma trilha em loop na batida (.wav) com a grade ao lado (.beats.json): compassos inteiros, sem clique ao repetir.",
    help: [
      "  synth --out <wav> --bpm <n> --bars <n>   Trilha de exatamente bars × beats-per-bar × 60 / bpm segundos, que repete sem clique.",
      "  --style clean|noir|upbeat|lofi|pulse     Caráter (padrão: clean). --seed <n> varia a frase (mesma seed, mesmos bytes).",
      "  --beats-per-bar 3|4 --intro-bars <n>     Tempos por compasso (padrão: 4); compassos iniciais só com a cama (padrão: 0).",
      "  --gain <dB>                              Desloca o volume final (padrão: cerca de -16 LUFS, pico real até -1 dBTP).",
    ].join("\n"),
    async run(positionals, values, ctx) {
      if (positionals.length) throw usage("O comando synth não recebe arquivo de entrada.", "Use synth --out trilha.wav --bpm 120 --bars 4.");
      const out = wavOutput(ctx, values);
      if (values.bpm === undefined) throw usage("Informe o andamento com --bpm.");
      if (values.bars === undefined) throw usage("Informe quantos compassos com --bars.");
      const bpm = parseNumber(values.bpm, { name: "bpm", min: 60, max: 200 });
      const bars = parseNumber(values.bars, { name: "bars", min: 1, max: 64, integer: true });
      const beatsPerBar = parseNumber(values["beats-per-bar"], { name: "beats-per-bar", min: 3, max: 4, integer: true, fallback: 4 });
      const style = values.style ?? "clean";
      if (!LOOP_STYLES.includes(style)) throw usage(`Estilo desconhecido: ${style}.`, `Estilos: ${LOOP_STYLES.join(", ")}.`);
      const seed = parseNumber(values.seed, { name: "seed", min: 0, max: 2 ** 31, integer: true, fallback: 1 });
      const introBars = parseNumber(values["intro-bars"], { name: "intro-bars", min: 0, max: Math.max(0, bars - 1), integer: true, fallback: 0 });
      const gainDb = parseNumber(values.gain, { name: "gain", min: -20, max: 20, fallback: 0 });
      ctx.progress(`Sintetizando ${style} ${bpm} BPM, ${bars} compasso(s) → ${ctx.rel(out)}`);
      const music = synthesizeLoop({ bpm, bars, beatsPerBar, style, seed, introBars, gainDb });
      writeWav(out, music.samples, { rate: music.rate, channels: 2 });
      const beatsFile = sibling(out, ".beats.json");
      const duration = round(music.duration, 4);
      writeJson(beatsFile, { bpm, offset: 0, beats_per_bar: beatsPerBar, bars, duration, beats: music.beats, downbeats: music.downbeats, source: "synth", style, seed });
      const warnings = [];
      let lufs = null;
      let truePeak = null;
      const tools = await checkTools();
      if (tools.ffmpeg) {
        const measured = await measureLoudness(tools.ffmpeg.path, out).catch(() => null);
        if (measured) {
          lufs = measured.integrated_lufs;
          truePeak = measured.true_peak_dbtp;
        }
      }
      if (lufs === null) warnings.push("Sem ffmpeg nesta máquina o volume não foi medido; a trilha foi gerada perto de -16 LUFS mesmo assim.");
      return {
        file: ctx.rel(out),
        beats_file: ctx.rel(beatsFile),
        bpm,
        bars,
        beats_per_bar: beatsPerBar,
        beat_s: round(music.beat_s, 4),
        bar_s: round(music.bar_s, 4),
        duration,
        style,
        seed,
        intro_bars: introBars,
        sample_rate: 48000,
        channels: 2,
        lufs,
        true_peak_dbtp: truePeak,
        beats: music.beats,
        downbeats: music.downbeats,
        warnings,
      };
    },
    text(result) {
      const loud = result.lufs === null ? "volume não medido" : `${result.lufs} LUFS, pico real ${result.true_peak_dbtp} dBTP`;
      return [
        `Trilha em loop pronta: ${result.file} (${result.style}, ${result.bpm} BPM, ${result.bars} compasso(s) de ${result.beats_per_bar}, ${result.duration} s, seed ${result.seed}; ${loud}).`,
        `Grade: ${result.beats_file} (${result.beats.length} batidas, ${result.downbeats.length} compassos).`,
        ...(result.warnings ?? []).map((warning) => `Aviso: ${warning}`),
      ].join("\n");
    },
  },

  music: {
    summary: "Compõe uma trilha original (.wav) com a grade de batidas ao lado (.beats.json).",
    help: [
      "  --out <wav> --duration <s>     Saída e duração (1 a 600 s). A grade sai em <nome>.beats.json (ou --beats-out).",
      "  --bpm <n> --style <estilo>     Andamento (padrão: 120) e estilo: " + STYLE_NAMES.join(", ") + " (padrão: clean).",
      "  --seed <n> --key <tom>         Variação (mesma seed, mesma música) e tom (C, Am, F#m…; padrão: auto).",
      "  --arc auto|flat --loop         Arco com virada e pancada final (auto) ou cama constante (flat); --loop fecha no início.",
    ].join("\n"),
    async run(positionals, values, ctx) {
      if (positionals.length) throw usage("O comando music não recebe arquivo de entrada.", "Use music --out trilha.wav --duration 12.");
      if (values.duration === undefined) throw usage("Informe a duração com --duration (em segundos).");
      const duration = parseTime(values.duration);
      if (!(duration >= 1 && duration <= 600)) throw usage(`Duração fora do limite: ${values.duration}.`, "Use entre 1 e 600 segundos.");
      const out = wavOutput(ctx, values);
      const options = {
        duration,
        bpm: parseNumber(values.bpm, { name: "bpm", min: 40, max: 220, fallback: 120 }),
        style: values.style ?? "clean",
        seed: parseNumber(values.seed, { name: "seed", min: 0, max: 2 ** 31, integer: true, fallback: 1 }),
        key: values.key ?? "auto",
        arc: values.arc ?? "auto",
        loop: Boolean(values.loop),
      };
      const extraWarnings = [];
      // an arc needs room: two whole bars and the tail before the final hit; anything shorter becomes a flat bed
      const shortest = (2 * 4 * 60) / options.bpm + 0.5;
      if (!options.loop && options.arc !== "flat" && duration < shortest) {
        options.loop = true;
        options.arc = "flat";
        extraWarnings.push(`Com ${duration} s a ${options.bpm} BPM não cabe um arco com pancada final (precisa de ${round(shortest, 2)} s ou mais): a trilha virou uma cama constante que fecha no início.`);
      }
      ctx.progress(`Compondo ${options.style} ${options.bpm} BPM, ${duration} s → ${ctx.rel(out)}`);
      const music = synthesizeMusic(options);
      writeWav(out, music.samples, { rate: music.rate, channels: 2 });
      const beatsFile = values["beats-out"] ? resolve(process.cwd(), values["beats-out"]) : sibling(out, ".beats.json");
      writeJson(beatsFile, music.beats);
      return {
        file: ctx.rel(out),
        beats_file: ctx.rel(beatsFile),
        bpm: music.bpm,
        duration: music.duration,
        style: music.style,
        seed: music.seed,
        key: music.key,
        arc: music.arc,
        loop: music.loop,
        progression: music.progression,
        sections: music.sections,
        drop: music.drop,
        hits: music.beats.hits,
        beat_count: music.beats.beats.length,
        peak_dbfs: music.peak_dbfs,
        warnings: [...extraWarnings, ...(music.warnings ?? [])],
      };
    },
    text(result) {
      const sections = result.sections.map((section) => `${section.name} de ${round(section.start, 2)} a ${round(section.end, 2)} s`).join(", ");
      return [`Trilha pronta: ${result.file} (${result.style}, ${result.bpm} BPM, tom ${result.key}, ${result.duration} s, pico ${result.peak_dbfs} dBFS).`, `Grade: ${result.beats_file} · seções: ${sections}${result.drop !== null ? ` · virada em ${round(result.drop, 2)} s` : ""}.`].join("\n");
    },
  },

  sfx: {
    summary: "Sintetiza sons de interface e movimento (.wav) a partir de uma lista de cues.",
    help: [
      "  sfx <cues.json> --out <wav>    cues.json: [{ \"t\": 0.5, \"type\": \"click\", \"gain\": -3, \"pitch\": 0, \"pan\": 0, \"duration\": 1 }].",
      "  --cues \"0.5:click,1.2:whoosh\" A mesma lista, em linha. --duration <s> fixa o tamanho do arquivo.",
      "  --events <events.json>         Outra forma: { \"duration\": 6, \"events\": [{ \"t\": 0.5, \"type\": \"whoosh\", \"gain_db\": -6, \"pan\": -0.3, \"length\": 0.35, \"pitch\": 1, \"direction\": \"in\" }] }.",
      "  --event whoosh@0.5,impact@2    Eventos em linha (tipo@segundos); --seed <n> varia o ruído. Tipos: " + SFX_TYPE_NAMES.join(", ") + ".",
      "  Tipos: " + CUE_TYPES.map((cue) => cue.type).join(", ") + ".",
      ...CUE_TYPES.map((cue) => `    ${cue.type.padEnd(8)} ${cue.description}`),
    ].join("\n"),
    async run(positionals, values, ctx) {
      if (values.events !== undefined || values.event !== undefined) return runEventSfx(positionals, values, ctx);
      let cues;
      if (values.cues) cues = parseCueList(values.cues);
      else if (positionals[0]) cues = requireJson(resolveInput(ctx.root, positionals[0], { what: "a lista de cues" }), "a lista de cues");
      else throw usage("Informe a lista de cues: sfx <cues.json> --out <wav>, ou --cues \"0.5:click,1.2:whoosh\".");
      const out = wavOutput(ctx, values);
      const duration = values.duration !== undefined ? parseTime(values.duration) : null;
      if (duration !== null && !(duration > 0 && duration <= 3600)) throw usage(`Duração fora do limite: ${values.duration}.`);
      const sfx = synthesizeSfx(cues, { duration });
      writeWav(out, sfx.samples, { rate: sfx.rate, channels: 2 });
      return {
        file: ctx.rel(out),
        cues: sfx.cues.map((cue) => ({ t: round(cue.t, 3), type: cue.type, gain: cue.gain, pitch: cue.pitch, pan: cue.pan, duration: cue.duration, count: cue.count })),
        types: CUE_TYPES.map((cue) => cue.type),
        duration: round(sfx.duration, 3),
        // measured on the written file, after the soft limiter of the WAV writer
        peak_dbfs: round(peakDb(readWav(out).samples), 2),
      };
    },
    text(result) {
      const count = result.cues ? result.cues.length : result.events;
      return [`Efeitos prontos: ${result.file} (${count} evento(s), ${result.duration} s, pico ${result.peak_dbfs} dBFS).`, ...(result.warnings ?? []).map((warning) => `Aviso: ${warning}`)].join("\n");
    },
  },

  beats: {
    summary: "Descobre o andamento e as batidas de um áudio ou vídeo e grava a grade (.beats.json).",
    help: [
      "  beats <audio> [--out <json>]   A grade sai ao lado do arquivo como <nome>.beats.json.",
      "  --bpm-min 60 --bpm-max 200     Faixa de andamento procurada. --bpm <n> fixa o andamento e só acha a fase.",
    ].join("\n"),
    async run(positionals, values, ctx) {
      if (positionals.length !== 1) throw usage("Informe um arquivo: beats <audio> [--out grade.json].");
      const file = resolveInput(ctx.root, positionals[0], { what: "o áudio" });
      const options = {
        bpmMin: parseNumber(values["bpm-min"] ?? values["min-bpm"], { name: "bpm-min", min: 30, max: 300, fallback: 60 }),
        bpmMax: parseNumber(values["bpm-max"] ?? values["max-bpm"], { name: "bpm-max", min: 30, max: 300, fallback: 200 }),
        bpm: parseNumber(values.bpm, { name: "bpm", min: 30, max: 300, fallback: null }),
      };
      if (options.bpmMin >= options.bpmMax) throw usage("--bpm-min precisa ser menor que --bpm-max.");
      ctx.progress(`Ouvindo ${ctx.rel(file)}`);
      const audio = await monoForAnalysis(file, ctx);
      const analysis = analyzeBeats(audio, options);
      const warnings = [];
      let beatsFile = values.out ? resolve(process.cwd(), values.out) : sibling(file, ".beats.json");
      if (!values.out) {
        // the exact grid that synth or music wrote next to its track is worth more than a measurement: keep it
        const existing = readJson(beatsFile, null);
        if (existing && existing.source && existing.source !== "analysis") {
          beatsFile = sibling(file, ".detected.beats.json");
          warnings.push(`${ctx.rel(sibling(file, ".beats.json"))} é a grade exata de quem gerou a trilha e foi mantida; a medição foi para ${ctx.rel(beatsFile)}.`);
        }
      }
      const grid = {
        format_version: 1,
        source: "analysis",
        file: ctx.rel(file),
        bpm: analysis.bpm,
        offset: analysis.offset,
        confidence: analysis.confidence,
        duration: analysis.duration,
        beats: analysis.beats,
        downbeats: analysis.downbeats,
        beats_per_bar: 4,
        bars: analysis.downbeats.length,
        hits: analysis.hits,
        method: analysis.method,
      };
      writeJson(beatsFile, grid);
      return { ...grid, beats_file: ctx.rel(beatsFile), beat_count: analysis.beats.length, candidates: analysis.candidates, warnings };
    },
    text(result) {
      return `${result.file}: ${result.bpm} BPM, primeira batida em ${result.offset} s, confiança ${result.confidence}, ${result.beat_count} batidas, ${result.downbeats.length} compassos, ${result.hits.length} acentos. Grade: ${result.beats_file}`;
    },
  },

  mix: {
    summary: "Mixa música, efeitos e voz (sob um vídeo mudo ou num .wav), normaliza o volume e mede o resultado.",
    help: [
      "  mix --out <arquivo> [--video <video mudo>]   Com --video, a saída é o vídeo com som; sem, um .wav.",
      "  --music <wav> --music-gain -6  --sfx <wav> --sfx-gain 0  --voice <wav> --voice-gain 0 --duck 10",
      "  --music-offset <s>             Começa a música a partir desse instante dela (uma fatia da trilha por slide); --peak vale como --tp.",
      "  --lufs -14 --tp -1             Volume integrado e pico real finais. --fade-out <s> encerra a música suavemente.",
      "  --duration <s>                 Corta as fontes nesse tamanho (padrão: a duração do vídeo, ou da fonte mais longa).",
    ].join("\n"),
    async run(positionals, values, ctx) {
      if (positionals.length) throw usage("O comando mix só recebe opções.", "Use mix --out video-com-som.mp4 --video video.mp4 --music trilha.wav.");
      const out = ctx.outputPath(values, { required: true });
      const source = (name) => (values[name] ? resolveInput(ctx.root, values[name], { what: `o arquivo de --${name}` }) : null);
      const video = source("video");
      const music = source("music");
      const sfx = source("sfx");
      const voice = source("voice");
      if (!music && !sfx && !voice) throw usage("Informe pelo menos uma fonte: --music, --sfx ou --voice.");
      const settings = {
        music_gain: gainOption(values, "music-gain"),
        sfx_gain: gainOption(values, "sfx-gain"),
        voice_gain: gainOption(values, "voice-gain"),
        duck: parseNumber(values.duck, { name: "duck", min: 0, max: 30, fallback: 10 }),
        lufs: parseNumber(values.lufs, { name: "lufs", min: -30, max: -8, fallback: -14 }),
        tp: parseNumber(values.tp ?? values.peak, { name: "tp", min: -6, max: 0, fallback: -1 }),
        music_offset: parseNumber(values["music-offset"], { name: "music-offset", min: 0, max: 36000, fallback: 0 }),
        fade_out: parseNumber(values["fade-out"], { name: "fade-out", min: 0, max: 10, fallback: 0 }),
      };
      const tools = await ctx.requireTools({ browser: false });
      let duration = values.duration !== undefined ? parseTime(values.duration) : null;
      if (duration === null) {
        if (video) duration = (await probe(tools.ffprobe.path, video)).duration || null;
        else {
          const lengths = await Promise.all([music, sfx, voice].filter(Boolean).map((file) => probe(tools.ffprobe.path, file).then((info) => info.duration)));
          duration = Math.max(...lengths) || null;
        }
      }
      ctx.progress(`Mixando → ${ctx.rel(out)}`);
      // pass 1 mixes and normalizes into a WAV; on short pieces the normalizer lands a
      // little off, so pass 2 measures that WAV, trims it linearly onto the target and
      // encodes once (under the video when there is one): a single lossy generation
      const temp = tempDir("flyee-mix-");
      const draft = join(temp, "mix.wav");
      const warnings = [];
      if (music && settings.music_offset > 0 && duration) {
        const musicLength = (await probe(tools.ffprobe.path, music)).duration || 0;
        if (settings.music_offset + duration > musicLength + 0.05) warnings.push(`A música tem ${round(musicLength, 2)} s: a partir de ${settings.music_offset} s ela acaba antes do fim dos ${round(duration, 2)} s.`);
      }
      try {
        await mixAudio(tools.ffmpeg.path, {
          video: null,
          out: draft,
          music,
          musicGainDb: settings.music_gain,
          musicOffset: settings.music_offset,
          sfx,
          sfxGainDb: settings.sfx_gain,
          voice,
          voiceGainDb: settings.voice_gain,
          duckDb: settings.duck,
          lufs: settings.lufs,
          truePeak: settings.tp,
          fadeOut: settings.fade_out,
          duration,
        });
        const measured = await measureLoudness(tools.ffmpeg.path, draft);
        let trim = 0;
        if (measured && measured.integrated_lufs !== null) {
          const wanted = settings.lufs - measured.integrated_lufs;
          // AAC adds a little overshoot on dense material, hence the margin under the true-peak target
          const headroom = measured.true_peak_dbtp === null ? wanted : settings.tp - measured.true_peak_dbtp - 0.3;
          trim = round(Math.min(wanted, Math.max(headroom, 0)), 2);
          if (wanted > 0 && trim < wanted - 0.5) warnings.push(`O pico real limitou o volume em ${round(measured.integrated_lufs + trim, 1)} LUFS; para chegar a ${settings.lufs}, baixe os ganhos das fontes ou aceite um --tp maior.`);
        }
        let gain = Math.abs(trim) >= 0.05 ? trim : 0;
        await finalizeMix(tools.ffmpeg.path, { video, audio: draft, out, gainDb: gain });
        // the lossy encode can still push the true peak over the target: measure the file and, when it
        // overshoots, encode once more from the same draft with the gain lowered by the overshoot
        const encoded = ![".wav"].includes(extname(out).toLowerCase()) ? await measureLoudness(tools.ffmpeg.path, out).catch(() => null) : null;
        if (encoded && encoded.true_peak_dbtp !== null && encoded.true_peak_dbtp > settings.tp + 0.05) {
          gain = round(gain - (encoded.true_peak_dbtp - settings.tp) - 0.15, 2);
          await finalizeMix(tools.ffmpeg.path, { video, audio: draft, out, gainDb: gain });
        }
      } finally {
        removeDir(temp);
      }
      const [loudness, info] = await Promise.all([measureLoudness(tools.ffmpeg.path, out), probe(tools.ffprobe.path, out).catch(() => null)]);
      if (loudness && loudness.true_peak_dbtp !== null && loudness.true_peak_dbtp > settings.tp + 0.05) {
        warnings.push(`O pico real ficou em ${loudness.true_peak_dbtp} dBTP, acima do alvo de ${settings.tp}: baixe o ganho da fonte mais alta e mixe de novo.`);
      }
      return {
        file: ctx.rel(out),
        duration: round(info?.duration ?? duration ?? 0),
        loudness,
        inputs: { video: video && ctx.rel(video), music: music && ctx.rel(music), sfx: sfx && ctx.rel(sfx), voice: voice && ctx.rel(voice) },
        sources: {
          music: music && ctx.rel(music),
          music_offset: settings.music_offset,
          music_gain_db: settings.music_gain,
          sfx: sfx && ctx.rel(sfx),
          sfx_gain_db: settings.sfx_gain,
          voice: voice && ctx.rel(voice),
          voice_gain_db: settings.voice_gain,
        },
        settings,
        warnings,
      };
    },
    text(result) {
      const loud = result.loudness ? `${result.loudness.integrated_lufs} LUFS, pico real ${result.loudness.true_peak_dbtp} dBTP, faixa ${result.loudness.range_lu} LU` : "volume não medido";
      return `Mix pronto: ${result.file} (${result.duration} s; ${loud}).`;
    },
  },

  loudness: {
    summary: "Mede o volume de um áudio ou vídeo (LUFS integrado, pico real e faixa dinâmica).",
    help: "  loudness <arquivo>             Referência para redes: cerca de -14 LUFS e pico real abaixo de -1 dBTP.",
    async run(positionals, values, ctx) {
      if (positionals.length !== 1) throw usage("Informe um arquivo: loudness <arquivo>.");
      const file = resolveInput(ctx.root, positionals[0], { what: "o arquivo" });
      const tools = await ctx.requireTools({ browser: false });
      const loudness = await measureLoudness(tools.ffmpeg.path, file);
      if (!loudness) throw new AppError("no_audio_stream", `${ctx.rel(file)} não tem trilha de áudio.`, "Use um arquivo de áudio, ou um vídeo com som.");
      return { file: ctx.rel(file), ...loudness };
    },
    text(result) {
      return `${result.file}: ${result.integrated_lufs} LUFS integrado, pico real ${result.true_peak_dbtp} dBTP, faixa ${result.range_lu} LU.`;
    },
  },
};

export const help = `Opções de áudio (synth, music, sfx, beats, mix, loudness)
${Object.values(commands).map((command) => command.help).join("\n")}

Estilos de synth (trilha em loop)
${Object.entries(STYLE_DESCRIPTIONS).map(([name, text]) => `  ${name.padEnd(10)} ${text}`).join("\n")}

Estilos de music
${Object.entries(STYLES).map(([name, style]) => `  ${name.padEnd(10)} ${style.description}`).join("\n")}`;
