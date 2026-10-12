// Everything that goes through ffmpeg and ffprobe: encoding frames from a pipe, probing media,
// contact sheets, joining segments, muxing and mixing audio, measuring loudness.

import { spawn } from "node:child_process";
import { extname } from "node:path";

import { AppError, run } from "./util.mjs";

/** Reproducible files: no timestamps or encoder banners in the output. */
const BITEXACT = ["-map_metadata", "-1", "-fflags", "+bitexact", "-flags:v", "+bitexact", "-flags:a", "+bitexact"];

/** The video codec by output extension: .mp4 → H.264; .mov → ProRes 4444 (alpha); .webm → VP9 (alpha). */
export function codecFor(outFile, { alpha = false, crf = 16 } = {}) {
  const ext = extname(outFile).toLowerCase();
  if (ext === ".mov") return { name: "prores4444", args: ["-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", alpha ? "yuva444p10le" : "yuv444p10le", "-vendor", "apl0"] };
  if (ext === ".webm") return { name: "vp9", args: ["-c:v", "libvpx-vp9", "-pix_fmt", alpha ? "yuva420p" : "yuv420p", "-b:v", "0", "-crf", String(Math.min(63, crf + 14)), "-row-mt", "1", "-deadline", "good", "-cpu-used", "2"] };
  if (ext === ".mp4" || ext === ".m4v") {
    if (alpha) throw new AppError("alpha_needs_mov", "Um .mp4 não guarda transparência.", "Use a extensão .mov (ProRes 4444) ou .webm para a camada transparente.");
    return { name: "h264", args: ["-c:v", "libx264", "-preset", "medium", "-crf", String(crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-profile:v", "high", "-level", "4.2"] };
  }
  throw new AppError("output_format", `Extensão de saída não suportada: ${ext || "(nenhuma)"}.`, "Use .mp4, .mov ou .webm.");
}

/**
 * An encoder that takes frames (PNG or JPEG bytes) on its stdin. `sub` subframes per
 * output frame are blended with tmix for motion blur. Writes respect backpressure.
 */
export function startEncoder(ffmpegPath, { out, fps, sub = 1, frameFormat = "png", alpha = false, crf = 16, width, height }) {
  const codec = codecFor(out, { alpha, crf });
  const filters = [];
  if (sub > 1) filters.push(`tmix=frames=${sub}`, `select='eq(mod(n\\,${sub})\\,${sub - 1})'`, `setpts=N/${fps}/TB`);
  if (codec.name === "h264" && (width % 2 || height % 2)) filters.push("pad=ceil(iw/2)*2:ceil(ih/2)*2");
  const args = [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "image2pipe", "-framerate", String(fps * sub), "-vcodec", frameFormat === "jpeg" ? "mjpeg" : "png", "-i", "-",
    ...(filters.length ? ["-vf", filters.join(",")] : []),
    "-r", String(fps), "-fps_mode", "cfr", "-an",
    ...codec.args,
    ...BITEXACT,
    out,
  ];
  const child = spawn(ffmpegPath, args, { stdio: ["pipe", "ignore", "pipe"], windowsHide: true });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (text) => {
    stderr = (stderr + text).slice(-4000);
  });
  let failed = null;
  child.on("error", (error) => {
    failed = error;
  });
  child.stdin.on("error", (error) => {
    failed = failed ?? error;
  });
  const done = new Promise((resolve) => child.on("close", (code) => resolve({ code, stderr })));
  return {
    codec: codec.name,
    async write(frame) {
      if (failed) throw new AppError("ffmpeg_failed", "O ffmpeg parou de aceitar quadros.", stderr || String(failed.message));
      if (!child.stdin.write(frame)) await new Promise((resolve) => child.stdin.once("drain", resolve));
    },
    async end() {
      child.stdin.end();
      const result = await done;
      if (result.code !== 0) throw new AppError("ffmpeg_failed", "O ffmpeg não conseguiu codificar o vídeo.", result.stderr.trim().split("\n").slice(-3).join(" "));
      return result;
    },
    kill() {
      try {
        child.kill();
      } catch {
        // already gone
      }
    },
  };
}

async function ffmpeg(ffmpegPath, args, what) {
  const result = await run(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...args]);
  if (result.code !== 0) throw new AppError("ffmpeg_failed", `O ffmpeg falhou ao ${what}.`, result.stderr.trim().split("\n").slice(-3).join(" "));
  return result;
}

/** Duration, size, frame rate, audio and rotation of a media file. */
export async function probe(ffprobePath, file) {
  const result = await run(ffprobePath, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]);
  if (result.code !== 0) throw new AppError("unreadable_media", `Não consegui ler ${file}.`, result.stderr.trim().split("\n").slice(-2).join(" "));
  const data = JSON.parse(result.stdout.toString("utf8") || "{}");
  const video = (data.streams ?? []).find((stream) => stream.codec_type === "video") ?? null;
  const audio = (data.streams ?? []).find((stream) => stream.codec_type === "audio") ?? null;
  const rate = (text) => {
    const [n, d] = String(text ?? "0/1").split("/").map(Number);
    return d ? Math.round((n / d) * 1000) / 1000 : 0;
  };
  const rotation = Number(video?.side_data_list?.find((item) => item.rotation !== undefined)?.rotation ?? video?.tags?.rotate ?? 0);
  const swap = Math.abs(rotation) % 180 === 90;
  return {
    file,
    duration: Number(data.format?.duration ?? video?.duration ?? audio?.duration ?? 0),
    size: Number(data.format?.size ?? 0),
    width: video ? (swap ? video.height : video.width) : null,
    height: video ? (swap ? video.width : video.height) : null,
    fps: video ? rate(video.avg_frame_rate) || rate(video.r_frame_rate) : null,
    frames: video?.nb_frames ? Number(video.nb_frames) : null,
    video_codec: video?.codec_name ?? null,
    pixel_format: video?.pix_fmt ?? null,
    has_alpha: Boolean(video?.pix_fmt && /yuva|rgba|argb|bgra|gbrap/.test(video.pix_fmt)),
    audio_codec: audio?.codec_name ?? null,
    audio_channels: audio?.channels ?? null,
    audio_rate: audio ? Number(audio.sample_rate) : null,
    has_audio: Boolean(audio),
  };
}

/** Joins segments encoded with the same settings, without re-encoding. */
export async function concatSegments(ffmpegPath, segments, out, listFile) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(listFile, segments.map((segment) => `file '${segment.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"));
  await ffmpeg(ffmpegPath, ["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", ...BITEXACT, out], "juntar os trechos");
}

/** Video plus an audio track; the video is copied, the audio becomes AAC (or Opus for .webm). */
export async function muxAudio(ffmpegPath, video, audio, out, { shortest = true } = {}) {
  const webm = extname(out).toLowerCase() === ".webm";
  const audioArgs = webm ? ["-c:a", "libopus", "-b:a", "160k"] : ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"];
  await ffmpeg(ffmpegPath, ["-i", video, "-i", audio, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", ...audioArgs, ...(shortest ? ["-shortest"] : []), ...BITEXACT, out], "juntar o áudio ao vídeo");
}

/** One frame as PNG at a time. */
export async function extractFrame(ffmpegPath, video, time, out, { width = null } = {}) {
  const vf = width ? ["-vf", `scale=${width}:-2`] : [];
  await ffmpeg(ffmpegPath, ["-ss", String(time), "-i", video, "-frames:v", "1", ...vf, out], "extrair o quadro");
}

/**
 * A contact sheet: `fps` frames per second of film, `cols` across, with the time
 * stamped on each tile when the build has drawtext and a font was found.
 */
export async function contactSheet(ffmpegPath, video, out, { fps = 2, cols = 6, tileWidth = 270, font = null, duration = null, start = 0 }) {
  const total = duration ? Math.max(1, Math.ceil((duration - start) * fps)) : null;
  const rows = total ? Math.max(1, Math.ceil(total / cols)) : 5;
  const filters = [`fps=${fps}`, `scale=${tileWidth}:-2`];
  if (font) {
    const fontFile = font.replace(/\\/g, "/").replace(/:/g, "\\:");
    filters.push(`drawtext=fontfile='${fontFile}':text='%{pts\\:hms}':x=6:y=6:fontsize=${Math.max(14, Math.round(tileWidth / 14))}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=4`);
  }
  filters.push(`tile=${cols}x${rows}:padding=4:margin=4:color=0x141413`);
  await ffmpeg(ffmpegPath, [...(start ? ["-ss", String(start)] : []), "-i", video, "-vf", filters.join(","), "-frames:v", "1", out], "montar a folha de contato");
  return { cols, rows, fps, tile_width: tileWidth };
}

/** Consecutive frames around one instant, to catch pops and overlaps. */
export async function frameStrip(ffmpegPath, video, out, { at, count = 12, tileWidth = 320, fps }) {
  const before = Math.max(0, at - (count / 2) / fps);
  await ffmpeg(ffmpegPath, ["-ss", String(before), "-i", video, "-vf", `scale=${tileWidth}:-2,tile=${count}x1:padding=2:margin=2:color=0x141413`, "-frames:v", "1", out], "montar a tira de quadros");
  return { start: before, count };
}

/** How it reads at phone size: one frame per second at 360 px wide. */
export async function phoneSheet(ffmpegPath, video, out, { width = 360, fps = 1, cols = 5, duration = null }) {
  const total = duration ? Math.max(1, Math.ceil(duration * fps)) : 15;
  const rows = Math.max(1, Math.ceil(total / cols));
  await ffmpeg(ffmpegPath, ["-i", video, "-vf", `fps=${fps},scale=${width}:-2,tile=${cols}x${rows}:padding=6:margin=6:color=0x141413`, "-frames:v", "1", out], "montar o teste de celular");
  return { cols, rows };
}

/** Tiles a numbered image sequence (img-0001.png…) into one sheet. */
export async function tileImages(ffmpegPath, pattern, out, { cols, count, tileWidth = 270 }) {
  const rows = Math.max(1, Math.ceil(count / cols));
  await ffmpeg(ffmpegPath, ["-framerate", "1", "-i", pattern, "-vf", `scale=${tileWidth}:-2,tile=${cols}x${rows}:padding=4:margin=4:color=0x141413`, "-frames:v", "1", out], "montar a folha");
  return { cols, rows };
}

/** Integrated loudness, true peak and range (EBU R128) of a file's audio. */
export async function measureLoudness(ffmpegPath, file) {
  const result = await run(ffmpegPath, ["-hide_banner", "-nostats", "-i", file, "-map", "0:a:0", "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"]);
  const text = result.stderr;
  const start = text.lastIndexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) {
    if (/does not contain any stream|matches no streams/i.test(text)) return null;
    throw new AppError("ffmpeg_failed", "Não consegui medir o volume.", text.trim().split("\n").slice(-2).join(" "));
  }
  const data = JSON.parse(text.slice(start, end + 1));
  const num = (value) => (value === undefined || value === "-inf" ? null : Number(value));
  return { integrated_lufs: num(data.input_i), true_peak_dbtp: num(data.input_tp), range_lu: num(data.input_lra), threshold: num(data.input_thresh) };
}

/**
 * Mixes music, effects and voice under a silent video (or into an audio file when
 * `video` is null): music ducks under the voice, the result is normalized to the
 * target loudness and true peak, and fades out at the end when asked. `musicOffset`
 * (seconds) starts the music later in its own file.
 */
export async function mixAudio(ffmpegPath, { video = null, out, music = null, musicGainDb = 0, musicOffset = 0, sfx = null, sfxGainDb = 0, voice = null, voiceGainDb = 0, duckDb = 10, lufs = -14, truePeak = -1, fadeOut = 0, duration = null }) {
  const inputs = [];
  const labels = [];
  let chains = [];
  const add = (file) => {
    inputs.push("-i", file);
    return inputs.length / 2 - 1;
  };
  const videoIndex = video ? add(video) : null;
  const trim = duration ? `,atrim=0:${duration}` : "";
  // the music may start later in its file (one slice of a track per slide): cut before the gain
  const offset = musicOffset > 0 ? `atrim=start=${musicOffset},asetpts=PTS-STARTPTS,` : "";
  if (voice) {
    const i = add(voice);
    chains.push(`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${voiceGainDb}dB${trim}[voice]`);
  }
  if (music) {
    const i = add(music);
    const fade = fadeOut && duration ? `,afade=t=out:st=${Math.max(0, duration - fadeOut)}:d=${fadeOut}` : "";
    if (voice) {
      // the voice drives a compressor on the music: speech stays in front
      chains.push(`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,${offset}volume=${musicGainDb}dB${trim}${fade}[musicraw]`);
      chains.push(`[voice]asplit=2[voice_mix][voice_key]`);
      chains.push(`[musicraw][voice_key]sidechaincompress=threshold=0.05:ratio=${Math.max(2, Math.round(duckDb / 2))}:attack=20:release=400:makeup=1[music]`);
      labels.push("[voice_mix]", "[music]");
    } else {
      chains.push(`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,${offset}volume=${musicGainDb}dB${trim}${fade}[music]`);
      labels.push("[music]");
    }
  } else if (voice) labels.push("[voice]");
  if (sfx) {
    const i = add(sfx);
    chains.push(`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${sfxGainDb}dB${trim}[sfx]`);
    labels.push("[sfx]");
  }
  if (!labels.length) throw new AppError("usage", "Informe pelo menos uma fonte de áudio (--music, --sfx ou --voice).");
  const mixed = labels.length > 1 ? `${labels.join("")}amix=inputs=${labels.length}:duration=longest:normalize=0[mixed]` : `${labels[0]}anull[mixed]`;
  chains.push(mixed);

  // Pass 1 measures the mix; pass 2 applies one linear gain from those numbers (a
  // dynamic single pass would pump the music), then a limiter keeps the true peak under
  // the target with a margin for the lossy encoder's overshoot.
  const measureArgs = [...inputs, "-filter_complex", `${chains.join(";")};[mixed]loudnorm=I=${lufs}:TP=${truePeak}:LRA=11:print_format=json[outa]`, "-map", "[outa]", "-f", "null", "-"];
  const measured = await run(ffmpegPath, ["-hide_banner", "-nostats", "-y", ...measureArgs]);
  const text = measured.stderr;
  const open = text.lastIndexOf("{");
  const close = text.lastIndexOf("}");
  if (measured.code !== 0 || open < 0 || close < open) throw new AppError("ffmpeg_failed", "O ffmpeg falhou ao medir o mix.", text.trim().split("\n").slice(-3).join(" "));
  const stats = JSON.parse(text.slice(open, close + 1));
  const silent = stats.input_i === "-inf" || Number(stats.input_i) < -70;
  const normalize = silent
    ? "anull"
    : `loudnorm=I=${lufs}:TP=${truePeak}:LRA=11:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`;
  const limit = Math.pow(10, (truePeak - 0.5) / 20);
  const final = [...chains, `[mixed]${normalize},alimiter=limit=${limit.toFixed(4)}:attack=5:release=50:level=false[outa]`];

  const webm = out.toLowerCase().endsWith(".webm");
  const audioCodec = video ? (webm ? ["-c:a", "libopus", "-b:a", "160k"] : ["-c:a", "aac", "-b:a", "192k"]) : out.toLowerCase().endsWith(".wav") ? ["-c:a", "pcm_s16le"] : ["-c:a", "aac", "-b:a", "192k"];
  const args = [
    ...inputs,
    "-filter_complex", final.join(";"),
    ...(video ? ["-map", `${videoIndex}:v:0`, "-c:v", "copy"] : []),
    "-map", "[outa]", "-ar", "48000", ...audioCodec,
    ...(video ? ["-shortest"] : []),
    ...BITEXACT,
    out,
  ];
  await ffmpeg(ffmpegPath, args, "mixar o áudio");
  return { measured: { integrated_lufs: silent ? null : Number(stats.input_i), true_peak_dbtp: silent ? null : Number(stats.input_tp), range_lu: silent ? null : Number(stats.input_lra) }, silent };
}

/** Decodes a file's audio to mono float samples at `rate` Hz (for beat detection). */
export async function decodeAudio(ffmpegPath, file, { rate = 22050 } = {}) {
  const result = await run(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-i", file, "-map", "0:a:0", "-ac", "1", "-ar", String(rate), "-f", "f32le", "-"]);
  if (result.code !== 0) throw new AppError("unreadable_media", `Não consegui ler o áudio de ${file}.`, result.stderr.trim().split("\n").slice(-2).join(" "));
  const bytes = result.stdout;
  return { rate, samples: new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.length / 4)) };
}

/** Average luminance (0-255) and frame difference of every frame, for flash and dead-time checks. */
export async function frameStats(ffmpegPath, video, { fps = null } = {}) {
  const vf = `${fps ? `fps=${fps},` : ""}signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-,metadata=print:key=lavfi.signalstats.YDIF:file=-`;
  const result = await run(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-i", video, "-an", "-vf", vf, "-f", "null", "-"]);
  if (result.code !== 0) throw new AppError("ffmpeg_failed", "Não consegui medir os quadros.", result.stderr.trim().split("\n").slice(-2).join(" "));
  return parseFrameStats(result.stdout.toString("utf8"));
}

/**
 * The metadata lines of frameStats as one record per frame. Each metadata filter prints its
 * own block (all YDIF lines, then all YAVG lines on some builds), so entries are merged by
 * frame number.
 */
export function parseFrameStats(text) {
  const byFrame = new Map();
  let current = null;
  for (const line of String(text ?? "").split(/\r?\n/)) {
    // ffmpeg prints tiny values in scientific notation (YDIF=3.63512e-05 on a still frame)
    const header = /^frame:(\d+)\s+pts:\S+\s+pts_time:([-+]?[\d.]+(?:e[-+]?\d+)?)/i.exec(line);
    if (header) {
      const n = Number(header[1]);
      current = byFrame.get(n) ?? { n, time: Number(header[2]) };
      byFrame.set(n, current);
      continue;
    }
    const avg = /lavfi\.signalstats\.YAVG=([-+]?[\d.]+(?:e[-+]?\d+)?)/i.exec(line);
    if (avg && current) current.yavg = Number(avg[1]);
    const dif = /lavfi\.signalstats\.YDIF=([-+]?[\d.]+(?:e[-+]?\d+)?)/i.exec(line);
    if (dif && current) current.ydif = Number(dif[1]);
  }
  return [...byFrame.values()].sort((a, b) => a.n - b.n);
}

/** Scene cuts detected by ffmpeg's scene score, in seconds. */
export async function detectCuts(ffmpegPath, video, { threshold = 0.3 } = {}) {
  const result = await run(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-i", video, "-an", "-vf", `select='gt(scene\\,${threshold})',metadata=print:key=lavfi.scene_score:file=-`, "-fps_mode", "passthrough", "-f", "null", "-"]);
  if (result.code !== 0) throw new AppError("ffmpeg_failed", "Não consegui detectar os cortes.", result.stderr.trim().split("\n").slice(-2).join(" "));
  const cuts = [];
  for (const line of result.stdout.toString("utf8").split(/\r?\n/)) {
    const m = /pts_time:([-+]?[\d.]+(?:e[-+]?\d+)?)/i.exec(line);
    if (m) cuts.push(Number(m[1]));
  }
  return cuts;
}
