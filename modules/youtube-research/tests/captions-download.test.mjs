// Why a caption track did not arrive: a block or a limit during the caption download keeps its own code
// and is never reported as a video without captions. A stand-in yt-dlp (a small Node script) plays
// YouTube's answers, so nothing here touches the network.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { captionDownloadError, downloadCaptions } from "../scripts/lib/youtube.mjs";

test("captionDownloadError keeps a refusal's own code and never says the video has no captions", () => {
  assert.equal(captionDownloadError("WARNING: [youtube] x: Unable to download video subtitles for 'pt-orig': HTTP Error 429: Too Many Requests").code, "rate_limited");
  assert.equal(captionDownloadError("ERROR: [youtube] x: Sign in to confirm you're not a bot").code, "youtube_blocked");
  assert.equal(captionDownloadError("ERROR: Unable to download video subtitles for 'pt-orig': HTTP Error 403: Forbidden").code, "youtube_blocked");
  assert.equal(captionDownloadError("WARNING: [youtube] x: subtitles require a PO Token").code, "youtube_blocked");
  assert.equal(captionDownloadError("ERROR: Unable to download webpage: <urlopen error [Errno 11001] getaddrinfo failed>").code, "offline");
  // A 404 on the caption file is not "the video does not exist": the video was just read.
  const missing = captionDownloadError("ERROR: Unable to download video subtitles for 'pt-orig': HTTP Error 404: Not Found");
  assert.equal(missing.code, "captions_unavailable");
  assert.match(missing.fix, /HTTP Error 404/);
  const silent = captionDownloadError("");
  assert.equal(silent.code, "captions_unavailable");
  assert.equal(silent.fix, "Tente de novo em alguns minutos.");
  for (const error of [missing, silent]) assert.notEqual(error.code, "no_captions");
});

/** A yt-dlp stand-in: the first argument says how YouTube answers; `-o` says where the file would go. */
const FAKE_YTDLP = `
const { writeFileSync } = require("node:fs");
const [mode, ...args] = process.argv.slice(2);
const out = args[args.indexOf("-o") + 1];
if (mode === "limited") {
  process.stderr.write("WARNING: [youtube] x: Unable to download video subtitles for 'pt-orig': HTTP Error 429: Too Many Requests\\n");
  process.exit(0);
}
if (mode === "forbidden") {
  process.stderr.write("ERROR: Unable to download video subtitles for 'pt-orig': HTTP Error 403: Forbidden\\n");
  process.exit(1);
}
writeFileSync(out.replace("%(ext)s", "pt-orig.vtt"), "WEBVTT\\n\\n00:00:00.000 --> 00:00:02.000\\nOlá, tudo bem\\n\\n00:00:02.000 --> 00:00:04.000\\nVamos lá\\n");
`;

test("downloadCaptions throws the refusal when the file does not arrive, even when yt-dlp ends with 0", async () => {
  const dir = mkdtempSync(join(tmpdir(), "research-captions-"));
  try {
    const script = join(dir, "fake-ytdlp.cjs");
    writeFileSync(script, FAKE_YTDLP);
    const info = { id: "x", title: "Vídeo" };
    const track = { key: "pt-orig", origin: "auto" };
    const ytdlp = (mode) => ({ file: process.execPath, prefix: [script, mode] });

    await assert.rejects(downloadCaptions(ytdlp("limited"), info, track), (error) => error.code === "rate_limited");
    await assert.rejects(downloadCaptions(ytdlp("forbidden"), info, track), (error) => error.code === "youtube_blocked");
    const segments = await downloadCaptions(ytdlp("ok"), info, track);
    assert.equal(segments.length, 2);
    assert.match(segments[0].text, /Olá/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
