// Measures the video with ffmpeg: cuts, silences, chosen frames and reading grids.

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { AppError, fileTime, LIMITS, mapLimit, mediaLimit, removeDir, run } from "./util.mjs";

const SIGNATURE_WIDTH = 32;
const SIGNATURE_HEIGHT = 18;
const SIGNATURE_BYTES = SIGNATURE_WIDTH * SIGNATURE_HEIGHT;

function errorTail(stderr) {
  return String(stderr ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-3)
    .join(" | ");
}

const round = (value) => Math.round(value * 1000) / 1000;

/** Duration, display size (already accounting for rotated phone video), fps and audio. */
export async function probe(ffprobe, video) {
  const { code, stdout, stderr } = await run(ffprobe, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", video], { timeoutMs: LIMITS.probe });
  if (code !== 0) throw new AppError("unreadable_video", "O ffprobe não conseguiu ler o vídeo.", errorTail(stderr));
  const data = JSON.parse(stdout.toString("utf8"));
  const streams = data.streams ?? [];
  const videoStreams = streams.filter((stream) => stream.codec_type === "video");
  const main = videoStreams.find((stream) => !stream.disposition?.attached_pic);
  if (!main) throw new AppError("no_video_track", "O arquivo não tem trilha de imagem.");
  const rotation = Number(main.side_data_list?.find((item) => item.rotation !== undefined)?.rotation ?? main.tags?.rotate ?? 0);
  const sideways = Math.abs(rotation) % 180 === 90;
  const [numerator, denominator] = String(main.avg_frame_rate || main.r_frame_rate || "0/1").split("/").map(Number);
  return {
    duration_s: Number(data.format?.duration || main.duration || 0),
    width: sideways ? main.height : main.width,
    height: sideways ? main.width : main.height,
    fps: denominator ? Math.round((numerator / denominator) * 100) / 100 : 0,
    codec: main.codec_name,
    has_audio: streams.some((stream) => stream.codec_type === "audio"),
    video_index: videoStreams.indexOf(main),
    bytes: Number(data.format?.size || 0),
  };
}

/**
 * One decoding pass returns three measures: the cuts (scene changes), a tiny
 * grey signature every 1/rate second (to find repeated frames without decoding
 * JPEG) and the audio silences.
 */
export async function measureSignals({ ffmpeg, video, videoIndex = 0, hasAudio = false, start = 0, duration = 0, threshold = 0.3, rate = 2 }) {
  const args = ["-hide_banner", "-nostats", "-nostdin"];
  if (start > 0) args.push("-ss", start.toFixed(3));
  if (duration > 0) args.push("-t", duration.toFixed(3));
  args.push("-i", video);
  // eq(n,0) lets the first frame through: an output that receives no frame at all (a video
  // without cuts) makes ffmpeg fail. That first "cut" is dropped below.
  const graph = [
    `[0:v:${videoIndex}]scale=256:-2,split=2[a][b]`,
    `[a]select='eq(n,0)+gt(scene,${threshold})',showinfo[cuts]`,
    `[b]fps=${rate},scale=${SIGNATURE_WIDTH}:${SIGNATURE_HEIGHT}:flags=area,format=gray[signature]`,
  ];
  if (hasAudio) graph.push("[0:a:0]silencedetect=noise=-35dB:d=0.7[silence]");
  args.push("-filter_complex", graph.join(";"), "-map", "[cuts]", "-f", "null", "-");
  if (hasAudio) args.push("-map", "[silence]", "-f", "null", "-");
  args.push("-map", "[signature]", "-pix_fmt", "gray", "-f", "rawvideo", "pipe:1");

  const cuts = [];
  const silences = [];
  let silenceStart = null;
  const chunks = [];
  const { code, stderr } = await run(ffmpeg, args, {
    // one pass decodes the whole window: the limit grows with its length (the default for a whole file of unknown length)
    timeoutMs: mediaLimit(duration),
    onStdout: (chunk) => chunks.push(chunk),
    onStderrLine: (line) => {
      const cut = /Parsed_showinfo.*\bpts_time:\s*([\d.]+)/.exec(line);
      if (cut) {
        cuts.push(round(start + Number(cut[1])));
        return;
      }
      const begin = /silence_start:\s*(-?[\d.]+)/.exec(line);
      if (begin) {
        silenceStart = Math.max(0, Number(begin[1]));
        return;
      }
      const end = /silence_end:\s*([\d.]+)/.exec(line);
      if (end && silenceStart !== null) {
        silences.push({ start_s: round(start + silenceStart), end_s: round(start + Number(end[1])) });
        silenceStart = null;
      }
    },
  });
  if (code !== 0) throw new AppError("ffmpeg_failed", "O ffmpeg não conseguiu medir o vídeo.", errorTail(stderr));
  const raw = Buffer.concat(chunks);
  const signatures = [];
  for (let offset = 0; offset + SIGNATURE_BYTES <= raw.length; offset += SIGNATURE_BYTES) {
    signatures.push(raw.subarray(offset, offset + SIGNATURE_BYTES));
  }
  if (silenceStart !== null) {
    silences.push({ start_s: round(start + silenceStart), end_s: round(start + (duration || signatures.length / rate)) });
  }
  return { cuts: cuts.filter((cut) => cut > start + 0.05).sort((a, b) => a - b), signatures, rate, silences };
}

/**
 * Do two signatures show the same picture? Conservative on purpose: it only
 * merges what is practically identical, because a slide with different text
 * barely moves the average and must not be dropped.
 */
export function similar(a, b, { cellDifference = 12, maxChangedFraction = 0.02, maxMean = 3 } = {}) {
  if (!a || !b || a.length !== b.length) return false;
  let sum = 0;
  let changed = 0;
  for (let i = 0; i < a.length; i++) {
    const difference = Math.abs(a[i] - b[i]);
    sum += difference;
    if (difference > cellDifference) changed++;
  }
  return changed / a.length < maxChangedFraction && sum / a.length < maxMean;
}

/**
 * Changes between two still pictures (a slide change, a cut between static
 * shots) that the scene detector misses when the brightness barely moves.
 * A talking head is never still, so it produces none.
 */
export function stillChanges(signatures, rate, start = 0) {
  const changes = [];
  for (let i = 2; i + 1 < signatures.length; i++) {
    const stableBefore = similar(signatures[i - 2], signatures[i - 1]);
    const stableAfter = similar(signatures[i], signatures[i + 1]);
    if (stableBefore && stableAfter && !similar(signatures[i - 1], signatures[i])) changes.push(round(start + (i - 0.5) / rate));
  }
  return changes;
}

/** Scene cuts plus the still changes that are not already near one. */
export function mergeCuts(sceneCuts, changes, tolerance = 0.75) {
  const merged = [...sceneCuts];
  for (const change of changes) if (!sceneCuts.some((cut) => Math.abs(cut - change) <= tolerance)) merged.push(change);
  return merged.sort((a, b) => a - b);
}

/**
 * Picks the frames: one per shot (between two cuts) plus one every `interval`
 * seconds in long shots; drops repeats and, above the budget, keeps frames
 * spread evenly in time.
 */
export function pickFrames({ start = 0, end, cuts = [], signatures = [], rate = 2, maxFrames = 48, minShot = 0.25 }) {
  const cleanCuts = [];
  for (const cut of [...cuts].sort((a, b) => a - b)) {
    if (cut <= start + minShot || cut >= end - minShot) continue;
    if (cleanCuts.length && cut - cleanCuts[cleanCuts.length - 1] < minShot) continue;
    cleanCuts.push(cut);
  }
  const bounds = [start, ...cleanCuts, end];
  const shots = [];
  for (let i = 0; i < bounds.length - 1; i++) shots.push({ n: i + 1, start: bounds[i], end: bounds[i + 1] });

  const interval = Math.max(3, (end - start) / Math.max(1, maxFrames * 1.2));
  const candidates = [];
  for (const shot of shots) {
    const length = shot.end - shot.start;
    const count = Math.max(1, Math.ceil(length / interval));
    for (let j = 0; j < count; j++) candidates.push({ time: shot.start + ((j + 0.5) * length) / count, shot: shot.n });
  }

  const signatureAt = (time) => {
    if (!signatures.length) return null;
    const index = Math.min(signatures.length - 1, Math.max(0, Math.round((time - start) * rate)));
    return signatures[index];
  };
  let kept = [];
  for (const candidate of candidates) {
    candidate.signature = signatureAt(candidate.time);
    const twin = candidate.signature ? kept.find((frame) => similar(frame.signature, candidate.signature)) : null;
    if (twin) candidate.sameAs = twin;
    else kept.push(candidate);
  }
  if (kept.length > maxFrames) {
    const chosen = new Set();
    for (let i = 0; i < maxFrames; i++) chosen.add(Math.round((i * (kept.length - 1)) / Math.max(1, maxFrames - 1)));
    kept = kept.filter((_, index) => chosen.has(index));
  }

  const numberOf = new Map(kept.map((candidate, index) => [candidate, index + 1]));
  const frames = kept.map((candidate, index) => ({ n: index + 1, time_s: round(candidate.time), shot: candidate.shot }));
  const shotList = shots.map((shot) => {
    const own = frames.filter((frame) => frame.shot === shot.n).map((frame) => frame.n);
    const entry = { n: shot.n, start_s: round(shot.start), end_s: round(shot.end), frames: own };
    if (!own.length) {
      const repeat = candidates.find((candidate) => candidate.shot === shot.n && candidate.sameAs && numberOf.has(candidate.sameAs));
      if (repeat) entry.same_as_frame = numberOf.get(repeat.sameAs);
    }
    return entry;
  });
  return { shots: shotList, frames, cuts: cleanCuts.map(round) };
}

/** Extracts each chosen frame as JPEG with the longer side capped. Frames that fail are dropped. */
export async function extractFrames({ ffmpeg, video, videoIndex = 0, frames, dir, maxSide = 1280, landscape = true }) {
  mkdirSync(dir, { recursive: true });
  const scale = landscape ? `scale='min(${maxSide},iw)':-2` : `scale=-2:'min(${maxSide},ih)'`;
  await mapLimit(frames, 4, async (frame) => {
    const name = `${frame.n !== undefined ? `${String(frame.n).padStart(4, "0")}-` : ""}${fileTime(frame.time_s)}.jpg`;
    const target = join(dir, name);
    // Near the end of a file there may be no picture at the exact time: try a little earlier.
    for (const back of [0, 0.5, 1.5]) {
      const time = Math.max(0, frame.time_s - back);
      const { code } = await run(ffmpeg, [
        "-hide_banner", "-loglevel", "error", "-nostdin",
        "-ss", time.toFixed(3), "-i", video,
        "-map", `0:v:${videoIndex}`, "-frames:v", "1", "-vf", scale, "-q:v", "3", "-y", target,
      ], { timeoutMs: LIMITS.media });
      if (code === 0 && existsSync(target)) {
        frame.path = target;
        return;
      }
    }
    frame.path = null;
  });
  return frames.filter((frame) => frame.path);
}

/**
 * How many frames fit in a grid without the image passing ~1.2 megapixels or
 * 1568 px on the longer side, the sizes AIs read without downscaling.
 */
export function gridLayout(width, height, { box = 480, maxSide = 1568, maxArea = 1.2e6 } = {}) {
  const ratio = width > 0 && height > 0 ? width / height : 16 / 9;
  let tileWidth = ratio >= 1 ? box : Math.round(box * ratio);
  let tileHeight = ratio >= 1 ? Math.round(box / ratio) : box;
  tileWidth += tileWidth % 2;
  tileHeight += tileHeight % 2;
  let best = { columns: 1, rows: 1 };
  for (let columns = 1; columns * tileWidth <= maxSide; columns++) {
    for (let rows = 1; rows * tileHeight <= maxSide; rows++) {
      if (columns * rows * tileWidth * tileHeight > maxArea) continue;
      const count = columns * rows;
      const bestCount = best.columns * best.rows;
      const imbalance = Math.abs(columns * tileWidth - rows * tileHeight);
      const bestImbalance = Math.abs(best.columns * tileWidth - best.rows * tileHeight);
      if (count > bestCount || (count === bestCount && imbalance < bestImbalance)) best = { columns, rows };
    }
  }
  return { tileWidth, tileHeight, columns: best.columns, rows: best.rows, perGrid: best.columns * best.rows };
}

/** A file path inside an ffmpeg filter: forward slashes and an escaped ":" (C\:/Windows/...). */
export function escapeFilterPath(path) {
  return String(path).replace(/\\/g, "/").replace(/:/g, "\\:");
}

function tileLabel(frame) {
  return `F${frame.n}  ${fileTime(frame.time_s).replace(/^00m/, "0m")}`;
}

async function buildGrid({ ffmpeg, group, target, layout, font }) {
  const { tileWidth: width, tileHeight: height, columns } = layout;
  const rows = Math.ceil(group.length / columns);
  const total = group.length === 1 ? 1 : columns * rows;
  const args = ["-hide_banner", "-loglevel", "error", "-nostdin"];
  for (const frame of group) args.push("-i", frame.path);
  for (let i = group.length; i < total; i++) args.push("-f", "lavfi", "-i", `color=c=black:s=${width}x${height}:d=1`);
  const parts = [];
  for (let i = 0; i < total; i++) {
    let chain = `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;
    if (font && i < group.length) {
      const size = Math.max(14, Math.round(height / 11));
      chain += `,drawtext=fontfile='${escapeFilterPath(font)}':text='${tileLabel(group[i])}':x=6:y=6:fontsize=${size}:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=5`;
    }
    parts.push(`${chain}[t${i}]`);
  }
  if (total > 1) {
    const positions = Array.from({ length: total }, (_, i) => `${(i % columns) * width}_${Math.floor(i / columns) * height}`).join("|");
    parts.push(`${Array.from({ length: total }, (_, i) => `[t${i}]`).join("")}xstack=inputs=${total}:layout=${positions}[out]`);
  }
  args.push("-filter_complex", parts.join(";"), "-map", total > 1 ? "[out]" : "[t0]", "-frames:v", "1", "-q:v", "3", "-y", target);
  // the labels need drawtext, which can hang while it reads the system's fonts: a labeled grid
  // that passes the limit counts as failed, and buildGrids makes it again without labels
  const { code, stderr } = await run(ffmpeg, args, { timeoutMs: LIMITS.media }).catch((error) => {
    if (font && error?.code === "tool_timeout") return { code: null, stderr: error.message };
    throw error;
  });
  return { ok: code === 0 && existsSync(target), error: errorTail(stderr) };
}

/**
 * Builds the grids. With a font available, each tile carries the frame number
 * and time; without one (or without ffmpeg's text filter) grids come unlabeled
 * and the index gives each tile's position.
 */
export async function buildGrids({ ffmpeg, frames, dir, layout, font = null }) {
  removeDir(dir);
  mkdirSync(dir, { recursive: true });
  const grids = [];
  let labeled = Boolean(font);
  for (let index = 0; index * layout.perGrid < frames.length; index++) {
    const group = frames.slice(index * layout.perGrid, (index + 1) * layout.perGrid);
    const target = join(dir, `grid-${String(index + 1).padStart(2, "0")}.jpg`);
    let result = await buildGrid({ ffmpeg, group, target, layout, font: labeled ? font : null });
    if (!result.ok && labeled) {
      labeled = false;
      result = await buildGrid({ ffmpeg, group, target, layout, font: null });
    }
    if (!result.ok) throw new AppError("ffmpeg_failed", "O ffmpeg não conseguiu montar as grades de frames.", result.error);
    group.forEach((frame, position) => {
      frame.grid = index + 1;
      frame.position = position + 1;
    });
    const columns = group.length === 1 ? 1 : layout.columns;
    grids.push({ n: index + 1, path: target, columns, rows: Math.ceil(group.length / columns), frames: group.map((frame) => frame.n) });
  }
  return { grids, labeled };
}
