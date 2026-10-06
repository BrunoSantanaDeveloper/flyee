// Reads captions (json3, srt, vtt) into timed speech segments: { start_s, end_s, text }.

import { readFileSync } from "node:fs";
import { extname } from "node:path";

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " " };

function clean(text) {
  return String(text)
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}

function parseTimestamp(text) {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/.exec(text.trim());
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, "0")) / 1000;
}

/** YouTube json3: events with `tStartMs`, `dDurationMs` and `segs`. */
export function parseJson3(text) {
  const data = JSON.parse(text);
  const segments = [];
  for (const event of data.events ?? []) {
    if (!Array.isArray(event.segs)) continue;
    const sentence = clean(event.segs.map((seg) => seg.utf8 ?? "").join(""));
    if (!sentence) continue;
    const start = (event.tStartMs ?? 0) / 1000;
    segments.push({ start_s: start, end_s: start + (event.dDurationMs ?? 0) / 1000, text: sentence });
  }
  return segments;
}

/** Cues headed by "00:00:01,000 --> 00:00:04,000" (srt) or "00:01.000 --> 00:04.000" (vtt). */
function parseCues(text) {
  const cues = [];
  let current = null;
  for (const line of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const timing = /^\s*([\d:.,]+)\s+-->\s+([\d:.,]+)/.exec(line);
    if (timing) {
      const start = parseTimestamp(timing[1]);
      const end = parseTimestamp(timing[2]);
      current = start === null || end === null ? null : { start, end, lines: [] };
      if (current) cues.push(current);
    } else if (line.length === 0) {
      // Only an empty line closes a cue: YouTube's automatic VTT has single-space lines inside cues.
      current = null;
    } else if (current) {
      current.lines.push(line);
    }
  }
  return cues;
}

export function parseSrt(text) {
  return parseCues(text)
    .map((cue) => ({ start_s: cue.start, end_s: cue.end, text: clean(cue.lines.join(" ")) }))
    .filter((segment) => segment.text);
}

/**
 * VTT, including YouTube's automatic captions, where every cue repeats the
 * previous line and adds a new one: only new lines are kept.
 */
export function parseVtt(text) {
  const segments = [];
  let last = "";
  for (const cue of parseCues(text)) {
    for (const line of cue.lines) {
      const sentence = clean(line);
      if (!sentence || sentence === last) continue;
      segments.push({ start_s: cue.start, end_s: cue.end, text: sentence });
      last = sentence;
    }
  }
  for (let i = 0; i < segments.length - 1; i++) {
    segments[i].end_s = Math.max(segments[i].start_s, Math.min(segments[i].end_s, segments[i + 1].start_s));
  }
  return segments;
}

export function readCaptions(path) {
  const text = readFileSync(path, "utf8");
  const extension = extname(path).toLowerCase();
  if (extension === ".json3") return parseJson3(text);
  if (extension === ".srt") return parseSrt(text);
  if (extension === ".vtt") return parseVtt(text);
  throw new Error(`no reader for caption format ${extension}`);
}

/** Joins short lines into reading blocks: up to ~12 s or ~280 characters, ending on punctuation when possible. */
export function groupSpeech(segments, { maxSeconds = 12, maxChars = 280 } = {}) {
  const blocks = [];
  let current = null;
  for (const segment of segments) {
    if (!current) {
      current = { ...segment };
      continue;
    }
    const tooLong = segment.end_s - current.start_s > maxSeconds || current.text.length + segment.text.length > maxChars;
    const sentenceEnds = /[.!?…]["')\]]?$/.test(current.text) && segment.start_s - current.start_s > maxSeconds / 2;
    if (tooLong || sentenceEnds) {
      blocks.push(current);
      current = { ...segment };
    } else {
      current.text = `${current.text} ${segment.text}`;
      current.end_s = Math.max(current.end_s, segment.end_s);
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

/** The speech that starts inside [start, end). */
export function speechBetween(segments, start, end) {
  return segments
    .filter((segment) => segment.start_s >= start - 0.01 && segment.start_s < end)
    .map((segment) => segment.text)
    .join(" ")
    .trim();
}
