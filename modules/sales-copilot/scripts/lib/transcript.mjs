// Reads a call transcript the member brings: JSON, WebVTT, SRT or plain text with "Name: what was said".
// Text is copied as it appears; a time that cannot be read is left out, never guessed.

import { AppError, parseClock } from "./util.mjs";

const SELLER_WORDS = /^(vendedor|vendedora|seller|rep|representante|consultor|consultora|closer|sdr)$/i;
const CLIENT_WORDS = /^(cliente|client|prospect|lead|comprador|compradora|customer|buyer)$/i;
const LABEL = /^([\p{L}][\p{L}\p{N} .'_-]{0,39}?)\s*(?:[[(](\d{1,2}:\d{2}(?::\d{2})?)[\])])?\s*:\s+(\S.*)$/u;
const TIMED_LABEL = /^[[(]?(\d{1,2}:\d{2}(?::\d{2})?)[\])]?\s*[-·]?\s*([\p{L}][\p{L}\p{N} .'_-]{0,39}?)\s*:\s+(\S.*)$/u;
const ONLY_TIME = /^[[(]?(\d{1,2}:\d{2}(?::\d{2})?)[\])]?$/;
const CUE = /(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d{1,2}:)?\d{2}:\d{2}[.,]\d{1,3}/;

const clean = (text) => String(text).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function fromJson(data) {
  const list = Array.isArray(data) ? data : (data?.turns ?? data?.utterances ?? data?.segments ?? null);
  if (!Array.isArray(list)) return null;
  const turns = [];
  list.forEach((item, index) => {
    const text = clean(item?.text ?? item?.content ?? "");
    if (!text) return;
    const label = String(item?.speaker ?? item?.name ?? item?.who ?? "").trim();
    if (!label) throw new AppError("no_speakers", `turns[${index}]: falta quem falou (campo speaker).`, "Cada fala precisa dizer quem falou.");
    const rawTime = item?.t ?? item?.start ?? item?.start_s ?? item?.time ?? null;
    const t = rawTime === null ? null : typeof rawTime === "number" ? rawTime : parseClock(rawTime);
    turns.push({ label, text, t: Number.isFinite(t) ? t : null });
  });
  return turns;
}

function fromCues(text) {
  const turns = [];
  for (const block of text.split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const at = lines.findIndex((line) => CUE.test(line));
    if (at < 0) continue;
    const m = CUE.exec(lines[at]);
    const t = (m[1] ? Number(m[1].slice(0, -1)) * 3600 : 0) + Number(m[2]) * 60 + Number(m[3]);
    let label = null;
    const said = [];
    for (const line of lines.slice(at + 1)) {
      const voice = /^<v\s+([^>]+)>(.*)$/.exec(line);
      const named = voice ? null : LABEL.exec(line);
      if (voice) {
        label = voice[1].trim();
        said.push(voice[2]);
      } else if (named && !label) {
        label = named[1].trim();
        said.push(named[3]);
      } else {
        said.push(line);
      }
    }
    const content = clean(said.join(" "));
    if (content) turns.push({ label, text: content, t });
  }
  // a cue without a name continues the person of the cue before it
  let current = null;
  for (const turn of turns) {
    if (turn.label) current = turn.label;
    else turn.label = current;
  }
  return turns.filter((turn) => turn.label);
}

function fromLines(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const parsed = lines.map((line) => {
    if (!line) return { blank: true };
    const onlyTime = ONLY_TIME.exec(line);
    if (onlyTime) return { time: parseClock(onlyTime[1]) };
    const timed = TIMED_LABEL.exec(line);
    if (timed) return { label: timed[2].trim(), text: timed[3], t: parseClock(timed[1]) };
    const named = LABEL.exec(line);
    if (named) return { label: named[1].trim(), text: named[3], t: named[2] ? parseClock(named[2]) : null };
    return { text: line };
  });
  // "Então: vamos lá" is not a person: a name seen once, when others repeat, is part of the sentence
  const counts = new Map();
  for (const line of parsed) if (line.label) counts.set(line.label.toLowerCase(), (counts.get(line.label.toLowerCase()) ?? 0) + 1);
  const repeated = [...counts.values()].filter((count) => count >= 2).length;
  const turns = [];
  let clock = null;
  lines.forEach((raw, index) => {
    const line = parsed[index];
    if (line.blank) return;
    if (line.time !== undefined) {
      clock = line.time;
      return;
    }
    const isPerson = line.label && !(repeated >= 2 && counts.get(line.label.toLowerCase()) === 1);
    if (isPerson) {
      turns.push({ label: line.label, text: clean(line.text), t: line.t ?? clock });
      clock = null;
    } else if (turns.length) {
      turns[turns.length - 1].text = clean(`${turns[turns.length - 1].text} ${raw}`);
    }
  });
  return turns;
}

/** The people of a transcript, with how much each one spoke. */
export function speakersOf(turns) {
  const found = new Map();
  for (const turn of turns) {
    const key = turn.label.toLowerCase();
    const entry = found.get(key) ?? { label: turn.label, turns: 0, words: 0 };
    entry.turns += 1;
    entry.words += turn.text.split(/\s+/).length;
    found.set(key, entry);
  }
  return [...found.values()];
}

/**
 * Which side each person is on. `seller` is the name (or names, separated by commas) the member
 * confirmed; without it, only labels that say the role themselves ("Vendedor", "Cliente") are read.
 * Returns null when it cannot tell: the caller asks, it never guesses.
 */
export function assignRoles(turns, seller = null) {
  const speakers = speakersOf(turns);
  const roles = new Map();
  if (seller) {
    const wanted = String(seller).split(",").map((name) => name.trim().toLowerCase()).filter(Boolean);
    const missing = wanted.filter((name) => !speakers.some((speaker) => speaker.label.toLowerCase() === name));
    if (missing.length) {
      throw new AppError("unknown_speaker", `Não há falas de "${missing.join(", ")}" nesta transcrição.`, `As pessoas da transcrição são: ${speakers.map((speaker) => speaker.label).join(", ")}.`);
    }
    for (const speaker of speakers) roles.set(speaker.label.toLowerCase(), wanted.includes(speaker.label.toLowerCase()) ? "seller" : "client");
  } else {
    for (const speaker of speakers) {
      if (SELLER_WORDS.test(speaker.label)) roles.set(speaker.label.toLowerCase(), "seller");
      else if (CLIENT_WORDS.test(speaker.label)) roles.set(speaker.label.toLowerCase(), "client");
    }
    if (roles.size !== speakers.length || ![...roles.values()].includes("seller")) return null;
  }
  if (![...roles.values()].includes("client")) {
    throw new AppError("no_client", "A transcrição só tem falas do vendedor.", "Confira o nome do vendedor ou traga a transcrição com as falas do cliente.");
  }
  return roles;
}

/** Consecutive pieces of the same person become one turn, as captions split a sentence in several cues. */
export function mergeTurns(turns, roles) {
  const merged = [];
  for (const turn of turns) {
    const speaker = roles.get(turn.label.toLowerCase());
    const last = merged[merged.length - 1];
    if (last && last.speaker === speaker && last.name === turn.label) last.text = `${last.text} ${turn.text}`;
    else merged.push({ speaker, name: turn.label, text: turn.text, t: turn.t });
  }
  return merged.map((turn, i) => ({ i, ...turn }));
}

/** Parses the file's text into labelled pieces, by its shape. */
export function parseTranscript(text, fileName = "") {
  const body = String(text).replace(/^﻿/, "");
  let turns = null;
  if (/\.json$/i.test(fileName) || /^\s*[[{]/.test(body)) {
    try {
      turns = fromJson(JSON.parse(body));
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (/\.json$/i.test(fileName)) throw new AppError("invalid_json", `A transcrição não é um JSON válido: ${error.message}.`, "Corrija o arquivo ou traga a transcrição em texto.");
    }
  }
  if (!turns && CUE.test(body)) turns = fromCues(body);
  if (!turns) turns = fromLines(body);
  if (!turns.length) {
    throw new AppError(
      "no_speakers",
      "Não encontrei falas com o nome de quem falou nesta transcrição.",
      'Grave a transcrição num arquivo de texto com uma fala por linha, no formato "Nome: o que foi dito", copiando o texto como está, e repita o comando.',
    );
  }
  return turns;
}
