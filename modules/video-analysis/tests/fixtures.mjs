// Operator-only: generates a short "lesson" video (three text slides, a tone with a
// silence) plus a sidecar .srt, for the e2e test and the eval cases.
//   node modules/video-analysis/tests/fixtures.mjs <folder>

import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { escapeFilterPath } from "../scripts/lib/frames.mjs";
import { checkTools, gridFont } from "../scripts/lib/tools.mjs";
import { run } from "../scripts/lib/util.mjs";

const SLIDES = [
  { color: "0x1e3a8a", text: "Passo 1 - abra o menu Arquivo" },
  { color: "0x065f46", text: "Passo 2 - escolha Exportar" },
  { color: "0x7c2d12", text: "Resultado - video.mp4 em 1080p" },
];

const SRT = `1
00:00:00,500 --> 00:00:03,500
Hoje vamos exportar um vídeo.

2
00:00:04,000 --> 00:00:07,500
Primeiro, o menu certo.

3
00:00:12,000 --> 00:00:14,500
E pronto, terminou.
`;

/** Writes aula.mp4 (15 s: 3 slides of 5 s, silence from 8 s to 11 s) and aula.srt into `dir`. */
export async function makeLesson(dir) {
  const tools = await checkTools({ ytdlp: false });
  if (!tools.ffmpeg) throw new Error("ffmpeg not found");
  const font = await gridFont(tools);
  const args = ["-hide_banner", "-loglevel", "error", "-nostdin", "-y"];
  SLIDES.forEach((slide) => args.push("-f", "lavfi", "-t", "5", "-i", `color=c=${slide.color}:s=960x540:r=25`));
  args.push("-f", "lavfi", "-t", "15", "-i", "sine=frequency=330:sample_rate=44100");
  const chains = SLIDES.map((slide, index) => {
    const text = font ? `,drawtext=fontfile='${escapeFilterPath(font)}':text='${slide.text}':x=(w-tw)/2:y=(h-th)/2:fontsize=40:fontcolor=white` : "";
    return `[${index}:v]format=yuv420p${text}[s${index}]`;
  });
  const graph = [...chains, `${SLIDES.map((_, index) => `[s${index}]`).join("")}concat=n=${SLIDES.length}:v=1:a=0[v]`, `[${SLIDES.length}:a]volume=enable='between(t,8,11)':volume=0[a]`];
  const video = join(dir, "aula.mp4");
  args.push("-filter_complex", graph.join(";"), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", video);
  const { code, stderr } = await run(tools.ffmpeg.path, args);
  if (code !== 0) throw new Error(`ffmpeg failed: ${stderr}`);
  writeFileSync(join(dir, "aula.srt"), SRT);
  return { video, captions: join(dir, "aula.srt"), labeled: Boolean(font) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const dir = resolve(process.argv[2] ?? ".");
  const made = await makeLesson(dir);
  process.stdout.write(`${made.video}\n${made.captions}\n`);
}
