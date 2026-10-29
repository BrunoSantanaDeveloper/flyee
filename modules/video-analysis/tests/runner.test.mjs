// The time limit of the programs the analysis runs (ffmpeg, ffprobe, yt-dlp): past it, run()
// ends the program with everything it started and fails with tool_timeout; in time, the result
// is kept as it was.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

import { formatLimit, LIMITS, mediaLimit, run, toolTimeout } from "../scripts/lib/util.mjs";

const WINDOWS = process.platform === "win32";

// a program that starts another one and then waits a minute: both must be gone once the limit passes
const PARENT = [
  "const { spawn } = require('node:child_process');",
  "const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });",
  "process.stdout.write(process.pid + ' ' + child.pid + '\\n');",
  "setTimeout(() => {}, 60000);",
].join("\n");

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

/** On Windows tasklist also has to stop listing the pid (CSV keeps the check free of the system's language). */
function listed(pid) {
  if (!WINDOWS) return false;
  const out = execFileSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], { encoding: "utf8", windowsHide: true });
  return out.includes(`"${pid}"`);
}

async function gone(pid, ms = 5000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (!alive(pid) && !listed(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

test("run ends a program that passes its limit, with what it started, and fails with tool_timeout", { timeout: 60000 }, async () => {
  let pids = "";
  const started = Date.now();
  await assert.rejects(run(process.execPath, ["-e", PARENT], { timeoutMs: 500, onStdout: (chunk) => (pids += chunk) }), (error) => {
    assert.equal(error.code, "tool_timeout");
    assert.equal(error.message, "O node não terminou em 0,5 s e foi interrompido.");
    assert.match(error.fix, /^Tente de novo uma vez\./);
    assert.match(error.fix, /--start e --end/);
    return true;
  });
  assert.ok(Date.now() - started < 15000, "the call fails right after the limit, not when the program would end");
  const [parent, child] = pids.trim().split(/\s+/).map(Number);
  assert.ok(parent > 0 && child > 0, `the program printed its pids: "${pids}"`);
  assert.ok(await gone(parent), `the program (pid ${parent}) is still running`);
  assert.ok(await gone(child), `the program it started (pid ${child}) is still running`);
});

test("run keeps the result of a program that ends in time", async () => {
  const lines = [];
  const result = await run(process.execPath, ["-e", "process.stderr.write('um\\ndois\\n'); process.stdout.write('pronto'); process.exitCode = 3"], {
    timeoutMs: 30000,
    onStderrLine: (line) => lines.push(line),
  });
  assert.equal(result.code, 3);
  assert.equal(result.stdout.toString("utf8"), "pronto");
  assert.deepEqual(lines, ["um", "dois"]);
});

test("the limits grow with the media, the download has the longest, and the message names yt-dlp", () => {
  assert.equal(mediaLimit(30), LIMITS.media, "30 s of video: the 10 min floor");
  assert.equal(mediaLimit(3600), 6 * 60 * 60 * 1000, "one hour of video: six hours");
  assert.equal(mediaLimit(0), LIMITS.default, "a whole file of unknown length: the default");
  assert.ok(LIMITS.probe < LIMITS.media && LIMITS.metadata < LIMITS.download && LIMITS.default < LIMITS.download);
  assert.equal(formatLimit(LIMITS.download), "3 h");
  assert.equal(toolTimeout(WINDOWS ? "C:\\Python\\python.exe" : "/usr/bin/python3", LIMITS.metadata, ["-m", "yt_dlp", "--version"]).message, "O yt-dlp não terminou em 10 min e foi interrompido.");
  assert.equal(toolTimeout(WINDOWS ? "C:\\bin\\yt-dlp.exe" : "/usr/local/bin/yt-dlp", LIMITS.download, ["--no-progress"]).message, "O yt-dlp não terminou em 3 h e foi interrompido.");
  assert.equal(toolTimeout(WINDOWS ? "C:\\ffmpeg\\bin\\ffprobe.exe" : "/usr/bin/ffprobe", LIMITS.probe).message, "O ffprobe não terminou em 2 min e foi interrompido.");
});
