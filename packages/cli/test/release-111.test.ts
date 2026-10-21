import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { type Context, createContext } from "../src/context.ts";
import { parseArgs, runCommand } from "../src/main.ts";
import { type FakePlatform, startFakePlatform } from "./fake-platform.ts";

/**
 * CLI 1.1.1: the cloud place of an account (CLI-CONTRACT.md 2.2 and 4.2, since
 * 2026-10-21). In the operator's cloud test, a plan with one computer and the
 * PC connected refused the cloud session after the approval, and the member
 * disconnected the PC to go on. A Claude Code cloud session now says what it is,
 * holds the account's one cloud place outside the computers' limit, and a newer
 * session takes the place of the older one.
 */

let sandbox: string;
let platform: FakePlatform;

function context(name: string, env: Record<string, string> = {}): Context {
  const cwd = join(sandbox, name, "projeto");
  mkdirSync(cwd, { recursive: true });
  return createContext({
    baseUrl: platform.baseUrl,
    homeDir: join(sandbox, name, "home"),
    cwd,
    yes: true,
    locale: "pt-BR",
    env: { PATH: "", ...env },
    io: { out: () => undefined, err: () => undefined, confirm: async () => true, openBrowser: async () => true },
  });
}

const login = (ctx: Context) => runCommand(ctx, parseArgs(["login", "--device", "--json"]));

before(async () => {
  sandbox = mkdtempSync(join(tmpdir(), "flyee-111-"));
  platform = await startFakePlatform({ tier: null, deviceLimit: 1, modules: [], recipes: [] });
});

after(async () => {
  await platform.close();
  rmSync(sandbox, { recursive: true, force: true });
});

describe("a Claude Code cloud session has its own place, outside the plan's computers", () => {
  it("a computer says nothing about the cloud, and fills a plan with one computer", async () => {
    const result = await login(context("pc"));
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(platform.state.deviceRequests.at(-1)?.cloud, undefined);
    assert.equal(platform.state.installs.at(-1)?.cloud, undefined);
  });

  it("a cloud session says so when it asks for the code and when it registers, and connects with the PC still there", async () => {
    const result = await login(context("nuvem-1", { CLAUDE_CODE_REMOTE: "true" }));
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(platform.state.deviceRequests.at(-1)?.cloud, "claude_code");
    assert.equal(platform.state.installs.at(-1)?.cloud, "claude_code");
  });

  it("a newer cloud session takes the place of the older one, and the PC stays connected", async () => {
    const older = context("nuvem-1", { CLAUDE_CODE_REMOTE: "true" });
    const result = await login(context("nuvem-2", { CLAUDE_CODE_REMOTE: "true" }));
    assert.equal(result.ok, true, JSON.stringify(result));
    const status = await runCommand(older, parseArgs(["status", "--json"]));
    assert.equal(status.connected, false, "the older cloud session was replaced");
    const pc = await runCommand(context("pc"), parseArgs(["status", "--json"]));
    assert.equal(pc.connected, true, JSON.stringify(pc));
  });

  it("a second computer still meets the plan's limit", async () => {
    const result = await login(context("notebook"));
    assert.equal(result.ok, false);
    assert.equal(result.error, "device_limit_reached");
  });
});
