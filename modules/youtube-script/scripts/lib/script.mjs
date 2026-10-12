// Reads a script (roteiro.md) into sections of spoken text, production marks
// and timing. The format is in references/formato.md:
//   # working title        (not spoken)
//   ## Section             (a block of the video; becomes a chapter)
//   spoken text            (everything else)
//   [TELA 8s: …]           (a production mark; never spoken; "8s" adds silent time)
//   > note                 (a note for the creator; never spoken)

/** The pace when the creator's own is unknown: edited YouTube videos in Portuguese run faster than reading aloud. */
export const DEFAULT_WPM = 180;

const MARK = /\[[^\]]*\]/g;
/** What is still to be written or decided: [CONFIRMAR: …], [ESCOLHER: …], [PREENCHER: …]. */
export const PENDING = /\[\s*(?:confirmar|preencher|escolher)\b[^\]]*\]/gi;
const MARK_SECONDS = /^\[\s*(?:TELA|PAUSA|CONGELAR|B-?ROLL|DEMO|CORTE|C[ÂA]MERA|M[ÚU]SICA|TEXTO)[^\]]*?(\d+(?:[.,]\d+)?)\s*s\b/i;

/** Spoken text of a line: marks and extra spaces removed. */
export function spoken(line) {
  return line.replace(MARK, " ").replace(/\s+/g, " ").trim();
}

export function countWords(text) {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/** Sentences of a spoken paragraph. */
export function sentences(text) {
  return text
    .split(/(?<=[.!?…])["')\]]?\s+(?=\S)/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => countWords(sentence) > 0);
}

/** Seconds of silent action a mark declares ("[TELA 8s: …]", "[PAUSA 2s]"), or 0. */
export function markSeconds(mark) {
  const m = MARK_SECONDS.exec(mark);
  return m ? Number(m[1].replace(",", ".")) : 0;
}

const INTERVAL = /^\[\s*TELA\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:[–—-]|a|até)\s*(\d{1,2}:\d{2}(?::\d{2})?)/i;
const clockSeconds = (text) => text.split(":").map(Number).reduce((total, part) => total * 60 + part, 0);

/** The stretch of a screen recording a mark points at ("[TELA 00:12–00:31: …]"), or null. */
export function markInterval(mark) {
  const m = INTERVAL.exec(mark);
  if (!m) return null;
  const start = clockSeconds(m[1]);
  const end = clockSeconds(m[2]);
  return end > start ? { start_s: start, end_s: end } : null;
}

/**
 * For a narration written over a screen recording: each [TELA mm:ss–mm:ss] mark
 * with the seconds of screen it covers (plus freezes) and the seconds of speech
 * written for it, up to the next such mark or the end of the block.
 */
export function screenSync(script, wpm = DEFAULT_WPM) {
  const stretches = [];
  for (const section of script.sections) {
    let current = null;
    for (const item of section.flow) {
      const interval = item.type === "mark" ? markInterval(item.text) : null;
      if (interval) {
        current = { section: section.title, line: item.line, mark: item.text, screen_s: interval.end_s - interval.start_s, words: 0, shortened: /aceler|cort/i.test(item.text) };
        stretches.push(current);
      } else if (current && item.type === "mark") {
        current.screen_s += markSeconds(item.text);
      } else if (current && item.type === "speech") {
        current.words += item.words;
      }
    }
  }
  return stretches.map((stretch) => ({ ...stretch, speech_s: Math.round((stretch.words / wpm) * 60) }));
}

/**
 * Parses the script. Paragraphs keep the number of each of their lines
 * (1-based) so problems point at the right place.
 */
export function parseScript(text) {
  const lines = String(text).replace(/^﻿/, "").replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, "")).split(/\r?\n/);
  const script = { title: null, sections: [], pending: [] };
  let section = null;
  let paragraph = null;
  const closeParagraph = () => {
    if (paragraph && paragraph.text) section.paragraphs.push(paragraph);
    paragraph = null;
  };
  const ensureSection = (line) => {
    if (!section) {
      section = { title: null, line, paragraphs: [], marks: [], notes: [], flow: [], extra_s: 0 };
      script.sections.push(section);
    }
  };
  lines.forEach((raw, index) => {
    const line = raw.trim();
    const number = index + 1;
    // Every pending mark counts, wherever it is: alone on a line, in a note, in a heading.
    for (const m of line.matchAll(PENDING)) {
      const heading = /^##\s/.test(line) ? line.replace(/^#+\s+/, "").trim() : null;
      // How much speech shares the line with the mark; null in a heading or a note, where no speech is expected.
      const words = /^(#|>)/.test(line) ? null : countWords(spoken(line.replace(/^[-*]\s+/, "")));
      script.pending.push({ line: number, text: m[0], section: heading ?? section?.title ?? null, words });
    }
    if (/^#\s/.test(line)) {
      closeParagraph();
      script.title ??= line.replace(/^#\s+/, "").trim();
      return;
    }
    if (/^##\s/.test(line)) {
      closeParagraph();
      section = { title: line.replace(/^#+\s+/, "").trim(), line: number, paragraphs: [], marks: [], notes: [], flow: [], extra_s: 0 };
      script.sections.push(section);
      return;
    }
    if (/^#{3,}\s/.test(line) || /^(-{3,}|\*{3,}|_{3,})$/.test(line)) return;
    if (!line) {
      closeParagraph();
      return;
    }
    // A note above the first block is for the creator and opens no block.
    if (line.startsWith(">") && !section) return;
    ensureSection(number);
    if (line.startsWith(">")) {
      section.notes.push({ line: number, text: line.replace(/^>\s?/, "") });
      return;
    }
    for (const mark of line.match(MARK) ?? []) {
      section.marks.push({ line: number, text: mark });
      section.flow.push({ type: "mark", line: number, text: mark });
      section.extra_s += markSeconds(mark);
    }
    const said = spoken(line.replace(/^[-*]\s+/, ""));
    if (!said) {
      // A line of marks only ([TELA …], [fonte: …]) belongs to the paragraph around it.
      if (paragraph) {
        paragraph.raw = `${paragraph.raw}\n${line}`;
        paragraph.lines.push({ line: number, raw: line });
      }
      return;
    }
    section.flow.push({ type: "speech", line: number, words: countWords(said) });
    if (!paragraph) paragraph = { line: number, text: "", raw: "", lines: [] };
    paragraph.text = paragraph.text ? `${paragraph.text} ${said}` : said;
    paragraph.raw = paragraph.raw ? `${paragraph.raw}\n${line}` : line;
    paragraph.lines.push({ line: number, raw: line });
  });
  closeParagraph();
  return script;
}

const round = (value) => Math.round(value);

/** Words and estimated seconds per section and in total, at `wpm` words per minute. */
export function timing(script, wpm = DEFAULT_WPM) {
  let start = 0;
  const sections = script.sections.map((section, index) => {
    const words = section.paragraphs.reduce((total, paragraph) => total + countWords(paragraph.text), 0);
    const seconds = (words / wpm) * 60 + section.extra_s;
    const entry = { n: index + 1, title: section.title, line: section.line, words, est_s: round(seconds), start_s: round(start) };
    start += seconds;
    return entry;
  });
  return { words: sections.reduce((total, section) => total + section.words, 0), est_s: round(start), sections };
}

const INTRO = /^(gancho|abertura|contrato|intro(du[çc][ãa]o)?|hook|cold open)\b/i;
const SPONSOR = /^(publi|patroc[íi]nio|an[úu]ncio|parceiro|merchan)/i;
/** Names that mean something to the creator, not to the viewer reading the chapters. */
const INTERNAL = /^(fecho|fechamento|encerramento|final|fim|outro|cta|corpo|bloco \d+|desenvolvimento|virada|pagamento)$/i;

/** "1. Como X" → "Como X"; "Gancho" and friends become "Introdução". */
function chapterTitle(title) {
  return String(title ?? "").replace(/^\s*(cap[íi]tulo\s+)?\d+\s*[.)\-–:]\s*/i, "").trim();
}

/**
 * YouTube chapters from the sections: the opening blocks merge into
 * "Introdução" at 00:00; a sponsor block joins the chapter before it.
 * YouTube needs at least 3 chapters of 10 seconds or more.
 */
export function chapters(timed) {
  const list = [];
  for (const section of timed.sections) {
    const title = chapterTitle(section.title);
    if (!list.length) {
      list.push({ start_s: 0, title: INTRO.test(title) || !title ? "Introdução" : title });
      continue;
    }
    if (INTRO.test(title) && list.length === 1 && list[0].title === "Introdução") continue;
    if (SPONSOR.test(title) || !title) continue;
    list.push({ start_s: section.start_s, title, internal: INTERNAL.test(title) });
  }
  const valid = list.length >= 3 && list.every((chapter, i) => (list[i + 1]?.start_s ?? timed.est_s) - chapter.start_s >= 10);
  return { valid, items: list };
}
