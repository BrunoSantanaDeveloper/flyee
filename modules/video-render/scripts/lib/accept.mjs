// Acceptance helpers: pure functions over the boxes a page declares, the beats of its music,
// the per-frame numbers ffmpeg measures on a video and the networks table (./networks.mjs).
// ../commands/accept.mjs feeds them from a real page and a real video; tests/accept.test.mjs
// feeds them synthetic data. Nothing here opens a browser or runs a program.

import { formatSize, nearestFormat, safeArea, unionSafeArea } from "./networks.mjs";
import { FORMATS } from "./renderer.mjs";
import { AppError, round } from "./util.mjs";

/** The checks every report carries, in the order it lists them; one that could not be measured is a `skip`. */
export const CHECKS = ["page", "first_frame_readable", "safe_area", "text_size", "cuts_on_beat", "loop_seamless", "flashes", "dead_time", "loudness"];
/** The checks added once per destination network, after the others; each carries `network`. */
export const NETWORK_CHECKS = ["format_supported", "duration"];
export const STATUSES = ["pass", "fail", "warn", "skip"];
/**
 * How dead time is measured. `regions`: a frame is still when neither the whole frame nor any
 * block of it changes, so text being typed or a slow zoom is movement. `mean`: only the mean change
 * of the whole frame counts, so a small element that always moves (an arrow, a marker) does not
 * keep a stretch alive; for pieces whose rule is a big change every few beats, like carousel slides.
 */
export const STILL_BY = ["regions", "mean"];
export const PRESETS = ["instagram-carousel", "instagram-feed", "networks", "margin", "none"];

/** The limits; the command line overrides the ones that name an option. */
export const DEFAULTS = Object.freeze({
  minText: 44, // --min-text: px at 1080 px wide; scales with the width
  every: 0.25, // --every: s between two readings of the boxes
  textFailRatio: 0.6, // below this fraction of the minimum a text fails; between it and 1 it warns
  toleranceFrames: 1, // --tolerance: frames a cut the page declares may sit away from its beat
  minOnBeat: 1, // --min-on-beat: fraction of the declared cuts that must land on a beat
  detectedToleranceFrames: 2, // the same two for cuts ffmpeg finds in a video, which are approximate
  detectedMinOnBeat: 0.7,
  ssimPass: 0.985, // last frame vs first frame
  ssimWarn: 0.95,
  flashYdif: 40, // mean luminance change (0-255) that counts as a flash
  flashWindow: 1, // s
  flashMax: 3, // --max-flashes: flashes per window that still pass
  stillBy: "regions", // --still-by: how dead time is measured (STILL_BY)
  stillYdif: 0.5, // mean frame difference under which nothing moved
  stillLocal: 6, // ...and, with --still-by regions, largest block change (0-255) under which nothing moved: typing or a slow zoom moves blocks, not the mean
  localWidth: 32, // the frame difference is scaled down to this width, so each pixel is the mean change of a block
  stillSeconds: 1.5, // --max-still: a still run at least this long warns
  statsFps: 30, // a faster video is measured at this rate, so the flash and still thresholds above keep their meaning
  lufs: -14, // --lufs: integrated loudness target
  lufsTolerance: 1.5, // LU either way
  truePeak: -1, // dBTP that still passes
  truePeakFail: 0, // dBTP above which the audio clips: a fail instead of a warning
  durationSlack: 0.05, // s of container rounding the duration limits forgive
  tolerancePx: 1, // overflows and overlaps under this are rounding
  maxSamples: 1200,
});

/** An Instagram carousel at 1080 px wide: the margin and the two corners the app draws over. */
export const CAROUSEL = Object.freeze({
  margin: 72,
  corners: {
    counter: { label: "contador 1/N", w: 170, h: 80 }, // top right
    sound: { label: "botão de som", w: 100, h: 100 }, // bottom right
  },
});

export const LABELS = Object.freeze({
  page: "Página",
  first_frame_readable: "Primeiro quadro legível",
  safe_area: "Área segura",
  text_size: "Tamanho do texto",
  cuts_on_beat: "Cortes na batida",
  loop_seamless: "Loop sem emenda",
  flashes: "Piscadas",
  dead_time: "Tempo parado",
  loudness: "Volume",
  format_supported: "Formato",
  duration: "Duração",
});

/** One mark per status in the human output: ✓ passou · ✗ reprovou · △ aviso · ○ não medido. */
export const MARKS = Object.freeze({ pass: "✓", fail: "✗", warn: "△", skip: "○" });

/* ---------- formats and safe areas ---------- */

/** The named format of a frame: by exact size, then by aspect ratio; a custom size is "WxH". */
export function formatName(width, height, tolerance = 0.015) {
  for (const [name, size] of Object.entries(FORMATS)) if (size.width === width && size.height === height) return name;
  const ratio = width / height;
  let best = null;
  for (const [name, size] of Object.entries(FORMATS)) {
    const reference = size.width / size.height;
    const diff = Math.abs(ratio - reference) / reference;
    if (diff <= tolerance && (!best || diff < best.diff)) best = { name, diff };
  }
  return best ? best.name : `${width}x${height}`;
}

/** Whether two frames have the same shape, whatever their pixel sizes. */
export function sameRatio(a, b, tolerance = 0.015) {
  if (!a?.width || !a?.height || !b?.width || !b?.height) return false;
  const reference = b.width / b.height;
  return Math.abs(a.width / a.height - reference) / reference <= tolerance;
}

/**
 * The safe area a piece gets when the caller names none: the strictest zone of the destination
 * networks when there are any, the carousel one for the feed's vertical sizes, the format's own
 * zone for the rest.
 */
export function defaultPreset(format, hasNetworks = false) {
  if (hasNetworks) return "networks";
  return format === "4:5" || format === "3:4" ? "instagram-carousel" : "instagram-feed";
}

const rectOf = (x, y, w, h) => ({ x: round(x, 1), y: round(y, 1), w: round(w, 1), h: round(h, 1) });

const insetsOf = (insets) => ({ top: round(insets.top, 1), bottom: round(insets.bottom, 1), left: round(insets.left, 1), right: round(insets.right, 1) });

/**
 * The safe rectangle and the reserved corners of a preset at a frame size.
 *   instagram-carousel  a margin (72 px at 1080 wide) and the two corners Instagram draws over
 *   instagram-feed      the format's own insets from the networks table (formats[format].safe_zone)
 *   networks            the largest inset on each side among `networks` (ids or resolved entries);
 *                       without networks, the format's own insets
 *   margin              a uniform margin
 *   none                nothing
 * Carousel margins and corners scale with width/1080; table insets scale with the format's
 * reference size. `margin` (px at this size) replaces the carousel's 72 px or defines the
 * `margin` preset. `format` names the table entry to use; by default it is the frame's own
 * format, or the closest ratio for a custom size.
 */
export function safeFor({ preset, width, height, margin = null, networks = [], format = null, table = undefined }) {
  const s = width / 1080;
  const base = { preset, width, height, format: format ?? formatName(width, height), rect: null, corners: [], margin: null, networks: [], insets: null };
  if (preset === "none") return base;
  if (preset === "margin" || preset === "instagram-carousel") {
    const m = margin ?? round(CAROUSEL.margin * s, 1);
    const rect = rectOf(m, m, width - 2 * m, height - 2 * m);
    const corners =
      preset === "margin"
        ? []
        : Object.entries(CAROUSEL.corners).map(([name, corner]) => ({
            name,
            label: corner.label,
            ...rectOf(width - corner.w * s, name === "counter" ? 0 : height - corner.h * s, corner.w * s, corner.h * s),
          }));
    return { ...base, margin: m, rect, corners, insets: insetsOf({ top: m, bottom: m, left: m, right: m }) };
  }
  if (preset === "instagram-feed" || preset === "networks") {
    const key = formatSize(base.format, table) ? base.format : nearestFormat(width, height, table);
    const zones = preset === "networks" ? (networks ?? []).map((network) => safeArea(network, key, width, height, table)).filter(Boolean) : [];
    const area = zones.length ? unionSafeArea(zones, width, height) : safeArea(null, key, width, height, table);
    if (!area) throw new AppError("networks_table_invalid", `A tabela das redes não traz a zona segura do formato ${key}.`, "Reinstale o app Motor de vídeo.");
    const rect = rectOf(area.x, area.y, area.w, area.h);
    return { ...base, format: key, rect, networks: zones.length ? area.networks : [], insets: insetsOf(area.insets) };
  }
  throw new AppError("usage", `Área segura desconhecida: ${preset}.`, `Use ${PRESETS.join(", ")}.`);
}

/** The smallest readable font size for a frame `width` px wide: `base` px at 1080. */
export const minTextFor = (width, base = DEFAULTS.minText) => round((base * width) / 1080, 1);

/* ---------- boxes ---------- */

/** How many pixels a box passes each edge of a rectangle (0 within the tolerance). */
export function overflow(box, rect, tolerance = DEFAULTS.tolerancePx) {
  const raw = {
    left: rect.x - box.x,
    top: rect.y - box.y,
    right: box.x + box.w - (rect.x + rect.w),
    bottom: box.y + box.h - (rect.y + rect.h),
  };
  const out = {};
  for (const [side, px] of Object.entries(raw)) out[side] = px > tolerance ? round(px, 1) : 0;
  return out;
}

export const inside = (box, rect, tolerance = DEFAULTS.tolerancePx) => Object.values(overflow(box, rect, tolerance)).every((px) => px === 0);

/** The rectangle two boxes share, or null. */
export function intersection(a, b) {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.w, b.x + b.w) - x;
  const h = Math.min(a.y + a.h, b.y + b.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}

export function intersects(a, b, tolerance = DEFAULTS.tolerancePx) {
  const shared = intersection(a, b);
  return Boolean(shared && shared.w > tolerance && shared.h > tolerance);
}

/**
 * Boxes of the watched roles that leave the safe rectangle or touch a reserved corner.
 * `samples` = [{ time, boxes: [{ role, x, y, w, h, size, text }] }]. Worst first: the
 * severity is the deepest overflow or corner overlap in pixels.
 */
export function safeAreaViolations(samples, safe, { roles = ["text", "logo", "face"], tolerance = DEFAULTS.tolerancePx } = {}) {
  const out = [];
  if (!safe || (!safe.rect && !safe.corners?.length)) return out;
  for (const sample of samples ?? []) {
    for (const box of sample.boxes ?? []) {
      if (!roles.includes(box.role) || !(box.w > 0) || !(box.h > 0)) continue;
      const over = safe.rect ? overflow(box, safe.rect, tolerance) : { left: 0, top: 0, right: 0, bottom: 0 };
      const edges = Object.keys(over).filter((side) => over[side] > 0);
      const corners = [];
      let depth = 0;
      for (const corner of safe.corners ?? []) {
        if (!intersects(box, corner, tolerance)) continue;
        const shared = intersection(box, corner);
        corners.push(corner.name);
        depth = Math.max(depth, Math.min(shared.w, shared.h));
      }
      if (!edges.length && !corners.length) continue;
      const severity = Math.max(depth, ...edges.map((side) => over[side]));
      out.push({ time: sample.time, role: box.role, text: box.text ?? null, box: rectOf(box.x, box.y, box.w, box.h), edges, corners, overflow: over, severity: round(severity, 1) });
    }
  }
  return out.sort((a, b) => b.severity - a.severity || a.time - b.time);
}

/** The same box seen at several instants becomes one offender: its first time, its last (`until`) and how many `instants`. */
export function groupViolations(violations) {
  const groups = new Map();
  for (const item of violations ?? []) {
    const key = JSON.stringify([item.role, item.text, item.box, item.edges, item.corners]);
    const group = groups.get(key);
    if (!group) groups.set(key, { ...item, until: item.time, instants: 1 });
    else {
      group.time = Math.min(group.time, item.time);
      group.until = Math.max(group.until, item.time);
      group.instants++;
      group.severity = Math.max(group.severity, item.severity);
    }
  }
  return [...groups.values()].sort((a, b) => b.severity - a.severity || a.time - b.time);
}

const sizedTexts = (boxes) => (boxes ?? []).filter((box) => box.role === "text" && Number.isFinite(box.size) && box.size > 0);

/** Whether the boxes of frame 0 carry at least one text of `minText` px or more. */
export function firstFrameReadable(boxes, minText) {
  const texts = sizedTexts(boxes);
  const largest = texts.length ? round(Math.max(...texts.map((box) => box.size)), 1) : null;
  return { readable: largest !== null && largest + 1e-6 >= minText, largest, count: texts.length };
}

/** The smallest text over every sample: fail under `failRatio` × minText, warn under minText, skip without sized texts. */
export function textSizes(samples, minText, { failRatio = DEFAULTS.textFailRatio } = {}) {
  let smallest = null;
  let checked = 0;
  let unsized = 0;
  const small = [];
  for (const sample of samples ?? []) {
    for (const box of sample.boxes ?? []) {
      if (box.role !== "text") continue;
      if (!Number.isFinite(box.size) || box.size <= 0) {
        unsized++;
        continue;
      }
      checked++;
      if (smallest === null || box.size < smallest) smallest = round(box.size, 1);
      if (box.size + 1e-6 < minText) small.push({ time: sample.time, size: round(box.size, 1), text: box.text ?? null });
    }
  }
  small.sort((a, b) => a.size - b.size || a.time - b.time);
  const failBelow = round(minText * failRatio, 1);
  const status = checked === 0 ? "skip" : smallest + 1e-6 < failBelow ? "fail" : smallest + 1e-6 < minText ? "warn" : "pass";
  return { status, smallest, checked, unsized, small, min: minText, fail_below: failBelow };
}

/* ---------- beats and cuts ---------- */

/** Beat instants of a steady tempo from `offset` up to `duration` (inclusive). */
export function beatsFromBpm(bpm, duration, offset = 0) {
  const b = 60 / bpm;
  const out = [];
  for (let n = 0; offset + n * b <= duration + 1e-6; n++) out.push(round(offset + n * b, 4));
  return out;
}

/** The beats of a beats.json ({ beats: [seconds…] }), sorted; empty when the file has none. */
export function beatsFromData(data) {
  const list = Array.isArray(data?.beats) ? data.beats.filter((beat) => beat !== null && beat !== "").map(Number).filter(Number.isFinite) : [];
  return list.sort((a, b) => a - b);
}

/**
 * Each cut against the nearest beat: on when within `frames` frames (frames / fps seconds),
 * off otherwise. `ratio` is the fraction on the beat, null without cuts.
 */
export function cutsOnBeat(cuts, beats, fps = 30, { frames = DEFAULTS.toleranceFrames } = {}) {
  const tolerance = frames / fps;
  const list = (cuts ?? []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const grid = (beats ?? []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const on = [];
  const off = [];
  for (const cut of list) {
    let nearest = null;
    for (const beat of grid) if (nearest === null || Math.abs(beat - cut) < Math.abs(nearest - cut)) nearest = beat;
    const delta = nearest === null ? null : round(cut - nearest, 4);
    if (nearest !== null && Math.abs(cut - nearest) <= tolerance + 1e-6) on.push({ cut, beat: nearest, delta });
    else off.push({ cut, nearest, delta });
  }
  return { tolerance: round(tolerance, 4), frames, total: list.length, on, off, ratio: list.length ? round(on.length / list.length, 3) : null };
}

/** Pass when at least `minOnBeat` of the cuts are on a beat; nothing to judge without cuts. */
export function cutsStatus(result, minOnBeat = DEFAULTS.minOnBeat) {
  if (!result?.total) return "skip";
  return result.ratio + 1e-9 >= minOnBeat ? "pass" : "fail";
}

/* ---------- frames ---------- */

/** The "All:" value of ffmpeg's ssim summary (the last one printed), or null. */
export function parseSsim(text) {
  const matches = [...String(text ?? "").matchAll(/All:\s*([0-9]*\.?[0-9]+)/g)];
  if (!matches.length) return null;
  const value = Number(matches[matches.length - 1][1]);
  return Number.isFinite(value) ? value : null;
}

export function loopStatus(ssim, { pass = DEFAULTS.ssimPass, warn = DEFAULTS.ssimWarn } = {}) {
  if (!Number.isFinite(ssim)) return "skip";
  return ssim >= pass ? "pass" : ssim >= warn ? "warn" : "fail";
}

/** Seconds between consecutive frames, from their times. */
function stepOf(frames) {
  for (let i = 1; i < frames.length; i++) {
    const step = frames[i].time - frames[i - 1].time;
    if (step > 0) return step;
  }
  return 1 / 30;
}

/**
 * Frames whose mean luminance change (YDIF) passes `threshold`, counted in a sliding window
 * of `window` seconds: more than `max` in one window is a strobe. `frames` is what
 * frameStats returns: [{ n, time, yavg, ydif }]. The first frame differs from nothing.
 */
export function flashes(frames, { threshold = DEFAULTS.flashYdif, window = DEFAULTS.flashWindow, max = DEFAULTS.flashMax } = {}) {
  const hits = (frames ?? []).filter((frame, index) => index > 0 && Number.isFinite(frame.ydif) && frame.ydif > threshold).map((frame) => round(frame.time, 3));
  let worst = { at: null, count: 0 };
  const windows = [];
  let start = 0;
  for (let end = 0; end < hits.length; end++) {
    while (hits[end] - hits[start] >= window - 1e-9) start++;
    const count = end - start + 1;
    if (count > worst.count) worst = { at: hits[start], count };
    if (count > max) {
      const last = windows[windows.length - 1];
      if (last && last.at === hits[start]) last.count = Math.max(last.count, count);
      else windows.push({ at: hits[start], count });
    }
  }
  return { transitions: hits.length, worst, over: worst.count > max, windows, threshold, window, max };
}

/**
 * The largest block change of each frame from what ffmpeg prints for the frame differences
 * (`tblend=all_mode=difference,scale=<DEFAULTS.localWidth>:-2:flags=area,signalstats` and the
 * YMAX key of `metadata=print`): [{ time, value }], one per difference, so none for the first frame.
 */
export function parseLocalChange(text) {
  const list = [];
  let time = null;
  for (const line of String(text ?? "").split(/\r?\n/)) {
    // ffmpeg prints small numbers in scientific notation (3.6e-05)
    const header = /pts_time:([\d.]+(?:e[-+]?\d+)?)/i.exec(line);
    if (header) {
      time = Number(header[1]);
      continue;
    }
    const max = /lavfi\.signalstats\.YMAX=([\d.]+(?:e[-+]?\d+)?)/i.exec(line);
    if (max && time !== null) {
      list.push({ time, value: Number(max[1]) });
      time = null;
    }
  }
  return list;
}

/**
 * Puts the largest block change of each frame (`local`) on the frame of the same instant, the
 * nearest one within half a frame. `local` is [{ time, value }]; the frames keep their order.
 */
export function mergeLocalChange(frames, local) {
  const list = frames ?? [];
  const sorted = (Array.isArray(local) ? local : []).filter((entry) => Number.isFinite(entry?.time) && Number.isFinite(entry?.value)).sort((a, b) => a.time - b.time);
  if (!sorted.length) return list;
  const tolerance = stepOf(list) / 2;
  let j = 0;
  return list.map((frame) => {
    while (j + 1 < sorted.length && Math.abs(sorted[j + 1].time - frame.time) <= Math.abs(sorted[j].time - frame.time)) j++;
    return Math.abs(sorted[j].time - frame.time) < tolerance ? { ...frame, local: sorted[j].value } : frame;
  });
}

/**
 * Runs of consecutive frames where nothing moves: the mean change of the whole frame (YDIF) under
 * `threshold` and, when it was measured, the largest block change (`local`) under `localThreshold`.
 * The mean alone misses small, real movement (text being typed, a slow zoom of a title): it moves
 * a few blocks a lot and the whole frame very little. Returns the longest run and every run of at
 * least `min` seconds. A still frame continues a run; the frame before it opens it.
 */
export function deadTime(frames, { threshold = DEFAULTS.stillYdif, localThreshold = DEFAULTS.stillLocal, min = DEFAULTS.stillSeconds, fps = null } = {}) {
  const list = (frames ?? []).filter((frame) => Number.isFinite(frame.ydif) && Number.isFinite(frame.time));
  const step = fps ? 1 / fps : stepOf(list);
  const isStill = (frame) => frame.ydif < threshold && !(Number.isFinite(frame.local) && frame.local >= localThreshold);
  const all = [];
  let start = null;
  let count = 0;
  const close = (lastStill) => {
    if (start !== null) all.push({ from: round(list[start].time, 3), to: round(list[lastStill].time + step, 3), seconds: round(count * step, 3) });
    start = null;
    count = 0;
  };
  for (let i = 0; i < list.length; i++) {
    if (i > 0 && isStill(list[i])) {
      if (start === null) start = i - 1;
      count++;
    } else close(i - 1);
  }
  close(list.length - 1);
  all.sort((a, b) => b.seconds - a.seconds || a.from - b.from);
  const longest = all[0] ?? null;
  const measuredLocal = list.some((frame) => Number.isFinite(frame.local));
  return { longest, runs: all.filter((run) => run.seconds + 1e-9 >= min), over: Boolean(longest && longest.seconds + 1e-9 >= min), threshold, local_threshold: measuredLocal ? localThreshold : null, min };
}

/* ---------- networks and sound ---------- */

/** 90 → "90 s"; 140 → "2 min 20 s"; 180 → "3 min"; 43200 → "12 h". */
export function formatLimit(seconds) {
  if (seconds === null || seconds === undefined) return "sem limite";
  if (seconds < 120) return `${round(seconds, 1)} s`;
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const rest = round(seconds - minutes * 60, 1);
    return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
  }
  return `${round(seconds / 3600, 1)} h`;
}

/**
 * Whether each network takes a format: fail when it does not, warn when it does but another
 * one works better there (or when the frame has no named format), pass when it is the
 * network's own. `networks` are entries of the table with their `id`. One item per network:
 * { network, status, summary, details, fix }.
 */
export function formatSupport(format, networks, { width = null, height = null } = {}) {
  const named = Boolean(FORMATS[format]);
  const size = width && height ? `${width}×${height}` : format;
  return (networks ?? []).map((network) => {
    const accepted = network.formats ?? [];
    const best = network.recommended_format ?? accepted[0] ?? null;
    const item = { network: network.id, status: "pass", summary: `${format} é o formato recomendado de ${network.label}.`, details: [{ format, accepted, recommended: best }], fix: null };
    if (!named) {
      item.status = "warn";
      item.summary = `${size} não é um formato conhecido; ${network.label} usa ${accepted.join(", ")}.`;
      item.fix = `Renderize num formato nomeado (--format ${Object.keys(FORMATS).join(", ")}).`;
    } else if (!accepted.includes(format)) {
      item.status = "fail";
      item.summary = `${format} não serve para ${network.label}, que usa ${accepted.join(", ")}.`;
      item.fix = `Renderize a mesma página em ${best} (render --format ${best}); a página precisa de window.setFormat.`;
    } else if (best !== format) {
      item.status = "warn";
      item.summary = `${format} é aceito em ${network.label}, mas o formato que rende mais é ${best}.`;
      item.fix = `Considere renderizar também em ${best}.`;
    }
    return item;
  });
}

/**
 * The duration against each network's limits: fail above the maximum or below the minimum,
 * warn above the recommended length. A little slack absorbs the container's rounding.
 * One item per network: { network, status, summary, details, fix }.
 */
export function durationCheck(duration, networks, { slack = DEFAULTS.durationSlack } = {}) {
  const seconds = round(duration, 2);
  return (networks ?? []).map((network) => {
    const max = network.max_duration_s ?? null;
    const min = network.min_duration_s ?? null;
    const recommended = network.recommended_duration_s ?? null;
    const item = { network: network.id, status: "pass", summary: `${seconds} s, dentro do limite de ${network.label}${max !== null ? ` (${formatLimit(max)})` : ""}.`, details: [{ duration: round(duration, 3), min, max, recommended }], fix: null };
    if (max !== null && duration > max + slack) {
      item.status = "fail";
      item.summary = `${seconds} s; o máximo de ${network.label} é ${formatLimit(max)}.`;
      item.fix = "Encurte o filme (film.duration e as cenas) ou renderize só um trecho com --start e --end.";
    } else if (min !== null && duration + slack < min) {
      item.status = "fail";
      item.summary = `${seconds} s; ${network.label} pede pelo menos ${formatLimit(min)}.`;
      item.fix = `Alongue o filme até pelo menos ${formatLimit(min)}: uma cena a mais, ou o fecho segurando mais tempos.`;
    } else if (recommended !== null && duration > recommended + slack) {
      item.status = "warn";
      item.summary = `${seconds} s; cabe em ${network.label} (até ${formatLimit(max)}), mas passa dos ${formatLimit(recommended)} recomendados.`;
      item.fix = "Corte o que não segura a atenção; o começo precisa valer sozinho.";
    }
    return item;
  });
}

/**
 * Integrated loudness and true peak against the target. Fail: the loudness is more than
 * `tolerance` LU away from the target, or the peak passes `truePeakFail` (it clips). Warn:
 * the loudness is right and the peak sits between `truePeak` and `truePeakFail`, which is
 * what a lossy encoder gives back of a peak the mix had removed. Skip: nothing to measure.
 * `measure` is what measureLoudness returns: { integrated_lufs, true_peak_dbtp }.
 */
export function loudnessCheck(measure, { target = DEFAULTS.lufs, tolerance = DEFAULTS.lufsTolerance, truePeak = DEFAULTS.truePeak, truePeakFail = DEFAULTS.truePeakFail } = {}) {
  const limits = { target, tolerance, true_peak_limit: truePeak };
  if (!measure || measure.integrated_lufs === null || measure.integrated_lufs === undefined) {
    return { status: "skip", summary: "O áudio é silêncio: não há volume para medir.", integrated: null, true_peak: null, offset: null, ...limits, fix: null };
  }
  const integrated = round(measure.integrated_lufs, 1);
  const peak = measure.true_peak_dbtp === null || measure.true_peak_dbtp === undefined ? null : round(measure.true_peak_dbtp, 1);
  const offset = round(integrated - target, 1);
  const off = Math.abs(offset) > tolerance + 1e-9;
  const hot = peak !== null && peak > truePeak + 0.05;
  const clips = peak !== null && peak > truePeakFail + 0.05;
  const status = off || clips ? "fail" : hot ? "warn" : "pass";
  // what is wrong first, then the other number, so both are always in the sentence
  const parts = [];
  if (off) parts.push(`${integrated} LUFS (${offset > 0 ? "+" : ""}${offset} LU do alvo de ${target})`);
  if (hot) parts.push(`pico real de ${peak} dBTP acima de ${truePeak}`);
  if (off && !hot && peak !== null) parts.push(`pico real de ${peak} dBTP`);
  if (hot && !off) parts.push(`o volume está certo (${integrated} LUFS)`);
  const summary = parts.length
    ? `${parts.join("; ")}.`
    : `${integrated} LUFS, pico real ${peak === null ? "não medido" : `de ${peak} dBTP`} (alvo ${target} ±${tolerance} LU, pico até ${truePeak} dBTP).`;
  const fix = off
    ? `Rode o mix de novo com --lufs ${target} (pico real até ${truePeak} dBTP), ou normalize a trilha antes de juntá-la ao vídeo; subir o ganho não basta, o pico também precisa caber.`
    : hot
      ? `O codificador do áudio devolve parte do pico que o mix tirou: rode o mix de novo com --peak ${round(truePeak - 0.5, 1)}.`
      : null;
  return { status, summary, integrated, true_peak: peak, offset, ...limits, fix };
}

/* ---------- sampling and the report ---------- */

/**
 * When to read the boxes: frame 0, every `every` seconds, every beat and the last frame,
 * within [0, duration − 1/fps]. Above `max` instants the regular grid is thinned (beats stay).
 */
export function sampleTimes({ duration, every = DEFAULTS.every, beats = [], fps = 30, max = DEFAULTS.maxSamples }) {
  const last = round(Math.max(0, duration - 1 / fps), 3);
  const set = new Set([0, last]);
  for (let n = 0; n * every <= last + 1e-9; n++) set.add(round(n * every, 3));
  for (const beat of beats ?? []) if (beat >= 0 && beat <= last + 1e-9) set.add(round(beat, 3));
  const times = [...set].sort((a, b) => a - b);
  if (times.length <= max) return { times, thinned: false };
  const keep = new Set((beats ?? []).map((beat) => round(beat, 3)));
  const stride = Math.ceil(times.length / max);
  return { times: times.filter((t, index) => index === 0 || index === times.length - 1 || keep.has(t) || index % stride === 0), thinned: true };
}

/**
 * One check of the report. `network` (an id of the table) marks a check made once per
 * destination; `fix` only travels with a fail or a warn.
 */
export function makeCheck(name, status, summary, details = [], fix = null, network = null) {
  if (!STATUSES.includes(status)) throw new Error(`unknown status ${status}`);
  const check = { name, status, summary, details };
  if (network) check.network = network;
  if (fix && (status === "fail" || status === "warn")) check.fix = fix;
  return check;
}

/** Passed when nothing failed; warnings and skips do not reprove. */
export function summarize(checks) {
  const counts = { pass: 0, fail: 0, warn: 0, skip: 0 };
  for (const check of checks ?? []) counts[check.status] = (counts[check.status] ?? 0) + 1;
  return { passed: counts.fail === 0, counts };
}

/** The same tally under the names a report reads aloud. */
export function scoreOf(checks) {
  const { counts } = summarize(checks);
  return { passed: counts.pass, failed: counts.fail, warned: counts.warn, skipped: counts.skip };
}

/** The human line of a check: mark, label, the network in parentheses when it is per network, and the summary. */
export function checkLine(check, labels = {}) {
  const network = check.network ? ` (${labels[check.network] ?? check.network})` : "";
  return `${MARKS[check.status] ?? "?"} ${LABELS[check.name] ?? check.name}${network}: ${check.summary}`;
}

/** The line under a failed or warned check that says what to do, or null. */
export function fixLine(check) {
  return check.fix && (check.status === "fail" || check.status === "warn") ? `    Como resolver: ${check.fix}` : null;
}
