// The time limit of the programs the engine runs: past it, run() ends the program with
// everything it started and fails with tool_timeout; in time, the result is kept as it was.

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
    return true;
  });
  assert.ok(Date.now() - started < 15000, "the call fails right after the limit, not when the program would end");
  const [parent, child] = pids.trim().split(/\s+/).map(Number);
  assert.ok(parent > 0 && child > 0, `the program printed its pids: "${pids}"`);
  assert.ok(await gone(parent), `the program (pid ${parent}) is still running`);
  assert.ok(await gone(child), `the program it started (pid ${child}) is still running`);
});

test("run keeps the result of a program that ends in time", async () => {
  const result = await run(process.execPath, ["-e", "process.stderr.write('aviso'); process.stdout.write('pronto'); process.exitCode = 3"], { timeoutMs: 30000 });
  assert.equal(result.code, 3);
  assert.equal(result.stdout.toString("utf8"), "pronto");
  assert.equal(result.stderr, "aviso");
});

test("the limits grow with the media, never fall below the floor, and read in the member's words", () => {
  assert.equal(mediaLimit(30), LIMITS.media, "30 s of video: the 10 min floor");
  assert.equal(mediaLimit(600), 60 * 60 * 1000, "10 min of video: six times, one hour");
  assert.equal(mediaLimit(null), LIMITS.default, "unknown length: the default");
  assert.equal(mediaLimit(0), LIMITS.default);
  assert.ok(LIMITS.probe < LIMITS.media && LIMITS.media < LIMITS.copy && LIMITS.copy <= LIMITS.default);
  assert.equal(formatLimit(500), "0,5 s");
  assert.equal(formatLimit(LIMITS.probe), "2 min");
  assert.equal(formatLimit(3 * 60 * 60 * 1000), "3 h");
  assert.equal(formatLimit(mediaLimit(25 * 60)), "2,5 h");
  const error = toolTimeout(WINDOWS ? "C:\\ffmpeg\\bin\\ffmpeg.exe" : "/usr/bin/ffmpeg", LIMITS.media);
  assert.equal(error.code, "tool_timeout");
  assert.equal(error.message, "O ffmpeg não terminou em 10 min e foi interrompido.");
});
