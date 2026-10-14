// The description has one format in both modes. In Gemini mode the script asks for JSON and
// writes it as Markdown; in local mode the member's AI writes the same Markdown following
// references/description-format.md. Whoever reads a description never needs to know the mode.

import { formatTime } from "./util.mjs";

const REPLY_SHAPE = `{
  "summary": "3 to 6 sentences about the video (or the requested window)",
  "timeline": [
    { "start": "MM:SS", "end": "MM:SS", "visual": "what is seen", "speech": "what is said, summarized", "on_screen_text": "visible text, verbatim, or empty" }
  ],
  "visual_only": [ { "time": "MM:SS", "description": "information only the picture gives; the speech does not mention it" } ],
  "on_screen_text": [ { "time": "MM:SS", "text": "verbatim transcription" } ],
  "audio": "music, sound effects, silences, tone and pace of speech",
  "visual_style": "framing, color, light, graphics, captions, editing rhythm",
  "shots": [ { "start": "MM:SS", "end": "MM:SS", "framing": "close-up, medium, wide, screen, graphic…", "movement": "static, pan, zoom, handheld…", "description": "what the shot shows" } ],
  "focus_sections": [ { "title": "title of a section the focus asks for", "content": "Markdown text" } ],
  "answer": "answer to the question, with times; empty when there is no question",
  "uncertainties": [ "what could not be seen or heard with confidence" ]
}`;

const isSet = (value) => value !== null && value !== undefined;

/** The text of the request to Gemini. The video goes before it, as a separate part. */
export function buildPrompt({ focusGuide, instructions, question, context = {}, window = {}, lang = "pt-BR", cuts = [] }) {
  const withHours = (context.duration_s ?? 0) >= 3600;
  const lines = [
    "Watch the attached video, picture and sound, and reply with a single valid JSON object only, with no text before or after it.",
    "",
    "## Rules",
    "- Times as MM:SS (H:MM:SS for videos longer than one hour), counted from the start of the original video.",
    "- Describe only what is seen or heard. Anything inferred is marked \"(provável)\" (or \"(likely)\" when writing in English).",
    "- On-screen text is transcribed verbatim, in the language it appears in.",
    "- Pay special attention to what only the picture shows: what appears on screen and the speech does not say.",
    "- What cannot be seen or heard with confidence goes in \"uncertainties\". Never invent.",
    `- Write in ${lang === "en" ? "English" : "Brazilian Portuguese"}, except verbatim quotes.`,
    "- Timeline: one item per change of subject or scene; in long videos, blocks of 30 to 90 seconds.",
  ];
  const about = [
    context.title && `Title: ${context.title}`,
    context.channel && `Channel: ${context.channel}`,
    context.duration_s && `Duration: ${formatTime(context.duration_s, withHours)}`,
    context.chapters?.length && `Chapters: ${context.chapters.map((chapter) => `${formatTime(chapter.start_s, withHours)} ${chapter.title}`).join("; ")}`,
  ].filter(Boolean);
  if (about.length) lines.push("", "## About the video", ...about.map((line) => `- ${line}`));
  if (isSet(window.start) || isSet(window.end)) {
    const from = formatTime(window.start ?? 0, withHours);
    const to = isSet(window.end) ? formatTime(window.end, withHours) : "the end";
    lines.push("", `Analyze only the part from ${from} to ${to}.`);
  }
  if (cuts.length) {
    const list = cuts.slice(0, 400).map((cut) => cut.toFixed(2)).join(", ");
    lines.push("", "## Cuts measured in the file", `Scene changes detected (seconds from the start): ${list}${cuts.length > 400 ? ", …" : ""}. Use them to align the shots.`);
  }
  lines.push("", "## Focus of the analysis (written in Portuguese)", String(focusGuide ?? "").trim());
  if (instructions?.content) lines.push("", "## Instructions from the app that requested this analysis", instructions.content.trim());
  if (question) lines.push("", "## Question", question.trim(), "Answer in the \"answer\" field, citing the times where the answer appears.");
  lines.push("", "## Reply format", "Fill \"shots\" and \"focus_sections\" only when the focus asks for them; otherwise, empty lists.", "```json", REPLY_SHAPE, "```");
  return lines.join("\n");
}

const HEADINGS = {
  "pt-BR": {
    until: "a",
    summary: "Resumo",
    timeline: "Linha do tempo",
    visual: "Imagem",
    speech: "Fala",
    onScreenText: "Texto na tela",
    visualOnly: "Só na imagem",
    nothingVisualOnly: "Nada relevante aparece só na imagem.",
    onScreen: "Textos na tela",
    audio: "Áudio",
    style: "Estilo visual",
    shots: "Planos",
    shotsTable: "| Tempo | Enquadramento | Movimento | O que mostra |",
    answer: "Resposta",
    measurements: "Medições",
    uncertainties: "Incertezas",
    noUncertainties: "Nenhuma registrada.",
    rawReply: "Resposta do modelo",
    rawNote: "A resposta não veio no formato esperado; o texto segue como o Gemini devolveu.",
  },
  en: {
    until: "to",
    summary: "Summary",
    timeline: "Timeline",
    visual: "Picture",
    speech: "Speech",
    onScreenText: "On-screen text",
    visualOnly: "Only in the picture",
    nothingVisualOnly: "Nothing relevant appears only in the picture.",
    onScreen: "On-screen text",
    audio: "Audio",
    style: "Visual style",
    shots: "Shots",
    shotsTable: "| Time | Framing | Movement | What it shows |",
    answer: "Answer",
    measurements: "Measurements",
    uncertainties: "Uncertainties",
    noUncertainties: "None recorded.",
    rawReply: "Model reply",
    rawNote: "The reply did not come in the expected format; the text follows as Gemini returned it.",
  },
};

const asText = (value) => (isSet(value) ? String(value).trim() : "");
const cell = (value) => asText(value).replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
const asList = (value) => (Array.isArray(value) ? value.filter(isSet) : []);

/** The header that opens every description; values are JSON strings, which are also valid YAML. */
export function descriptionHeader(fields) {
  const lines = Object.entries(fields)
    .filter(([, value]) => isSet(value) && value !== "")
    .map(([key, value]) => `${key}: ${JSON.stringify(String(value))}`);
  return `---\n${lines.join("\n")}\n---\n`;
}

/** Reads the header of a description already written (by this script or by the AI). */
export function readHeader(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(String(text ?? ""));
  if (!m) return {};
  const fields = {};
  for (const line of m[1].split(/\r?\n/)) {
    const pair = /^([a-z_]+):\s*(.*)$/.exec(line.trim());
    if (!pair) continue;
    let value = pair[2].trim();
    try {
      value = value.startsWith('"') ? JSON.parse(value) : value;
    } catch {
      // not in the expected shape: keep it as text
    }
    fields[pair[1]] = value;
  }
  return fields;
}

/** Markdown for a description from Gemini's JSON. Without readable JSON, keeps the text as it came. */
export function renderDescription({ data, rawText, header, title, measurements = [], lang = "pt-BR" }) {
  const h = HEADINGS[lang] ?? HEADINGS["pt-BR"];
  const out = [descriptionHeader(header), `# ${title || "Vídeo"}`, ""];
  if (!data || typeof data !== "object") {
    out.push(`## ${h.rawReply}`, "", h.rawNote, "", asText(rawText), "");
    if (measurements.length) out.push(`## ${h.measurements}`, "", ...measurements, "");
    return `${out.join("\n").trim()}\n`;
  }
  // A span reads "00:00 a 00:12" ("00:00 to 00:12" in English), the same notation the AI writes in local mode.
  const span = (start, end) => `${start || "?"} ${h.until} ${end || "?"}`;
  if (asText(data.summary)) out.push(`## ${h.summary}`, "", asText(data.summary), "");

  const timeline = asList(data.timeline);
  if (timeline.length) {
    out.push(`## ${h.timeline}`, "");
    for (const item of timeline) {
      out.push(`### ${span(asText(item.start), asText(item.end))}`);
      if (asText(item.visual)) out.push(`- ${h.visual}: ${asText(item.visual)}`);
      if (asText(item.speech)) out.push(`- ${h.speech}: ${asText(item.speech)}`);
      if (asText(item.on_screen_text)) out.push(`- ${h.onScreenText}: "${asText(item.on_screen_text)}"`);
      out.push("");
    }
  }

  const visualOnly = asList(data.visual_only);
  out.push(`## ${h.visualOnly}`, "");
  if (visualOnly.length) for (const item of visualOnly) out.push(`- **${asText(item.time) || "?"}**: ${asText(item.description)}`);
  else out.push(h.nothingVisualOnly);
  out.push("");

  const onScreen = asList(data.on_screen_text);
  if (onScreen.length) {
    out.push(`## ${h.onScreen}`, "");
    for (const item of onScreen) out.push(`- **${asText(item.time) || "?"}**: "${asText(item.text)}"`);
    out.push("");
  }
  if (asText(data.audio)) out.push(`## ${h.audio}`, "", asText(data.audio), "");
  if (asText(data.visual_style)) out.push(`## ${h.style}`, "", asText(data.visual_style), "");

  const shots = asList(data.shots);
  if (shots.length) {
    out.push(`## ${h.shots}`, "", h.shotsTable, "|---|---|---|---|");
    for (const shot of shots) out.push(`| ${span(cell(shot.start), cell(shot.end))} | ${cell(shot.framing)} | ${cell(shot.movement)} | ${cell(shot.description)} |`);
    out.push("");
  }
  for (const section of asList(data.focus_sections)) {
    if (!asText(section.title) && !asText(section.content)) continue;
    out.push(`## ${asText(section.title) || "Foco"}`, "", asText(section.content), "");
  }
  if (asText(data.answer)) out.push(`## ${h.answer}`, "", asText(data.answer), "");
  if (measurements.length) out.push(`## ${h.measurements}`, "", ...measurements, "");
  const uncertainties = asList(data.uncertainties).map(asText).filter(Boolean);
  out.push(`## ${h.uncertainties}`, "", ...(uncertainties.length ? uncertainties.map((item) => `- ${item}`) : [h.noUncertainties]), "");
  return `${out.join("\n").trim()}\n`;
}
