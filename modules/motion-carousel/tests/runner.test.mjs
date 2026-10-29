// The time limit of the programs the images command runs: ffmpeg and ffprobe on one image fail with
// tool_timeout once their limit passes, and the program is gone (with what it started, on Windows).

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

import { run, runTool, toolTimeout } from "../scripts/lib/images.mjs";

const WINDOWS = process.platform === "win32";

// a program that starts another one and then waits a minute
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

test("runTool ends a program that passes its limit and fails with tool_timeout", { timeout: 60000 }, async () => {
  const started = Date.now();
  let pid = null;
  const pending = runTool(process.execPath, ["-e", "process.stdout.write(String(process.pid)); setTimeout(() => {}, 60000)"], 500);
  await assert.rejects(pending, (error) => {
    assert.equal(error.code, "tool_timeout");
    assert.equal(error.message, "O node não terminou em 0,5 s e foi interrompido.");
    assert.match(error.fix, /^Tente de novo uma vez\./);
    return true;
  });
  assert.ok(Date.now() - started < 15000, "the call fails right after the limit, not when the program would end");
  // the same program through run(): the result says it was stopped, and its pid is gone
  const result = await run(process.execPath, ["-e", "process.stdout.write(String(process.pid)); setTimeout(() => {}, 60000)"], { timeoutMs: 500 });
  assert.equal(result.timedOut, true);
  pid = Number(result.stdout.toString("utf8"));
  assert.ok(pid > 0);
  assert.ok(await gone(pid), `the program (pid ${pid}) is still running`);
});

test("on Windows the limit also ends what the program started", { skip: !WINDOWS && "elsewhere ffmpeg and ffprobe start no other process; only the program itself is ended", timeout: 60000 }, async () => {
  const result = await run(process.execPath, ["-e", PARENT], { timeoutMs: 500 });
  assert.equal(result.timedOut, true);
  const [parent, child] = result.stdout.toString("utf8").trim().split(/\s+/).map(Number);
  assert.ok(parent > 0 && child > 0);
  assert.ok(await gone(parent), `the program (pid ${parent}) is still running`);
  assert.ok(await gone(child), `the program it started (pid ${child}) is still running`);
});

test("a program that ends in time keeps its result, and the message reads in the member's words", async () => {
  const result = await runTool(process.execPath, ["-e", "process.stdout.write('pronto'); process.exitCode = 3"], 30000);
  assert.equal(result.code, 3);
  assert.equal(result.timedOut, false);
  assert.equal(result.stdout.toString("utf8"), "pronto");
  assert.equal(toolTimeout(WINDOWS ? "C:\\ffmpeg\\bin\\ffprobe.exe" : "/usr/bin/ffprobe", 2 * 60 * 1000).message, "O ffprobe não terminou em 2 min e foi interrompido.");
});
