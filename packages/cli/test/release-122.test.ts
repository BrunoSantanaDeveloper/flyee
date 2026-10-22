import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { type Context, createContext } from "../src/context.ts";
import { t } from "../src/i18n.ts";
import { parseArgs, runCommand } from "../src/main.ts";
import { readConfig } from "../src/state/config.ts";
import { type FakePlatform, startFakePlatform } from "./fake-platform.ts";

/**
 * CLI 1.2.2, from the operator's test in Claude Code on the terminal (2026-10-22): a computer the
 * member had disconnected in the panel (to make room for a cloud session) was approved again in the
 * browser, the page said "computador conectado", and the CLI still failed three times with "Este
 * computador foi desconectado da sua conta". A new login revives a disconnected computer (contract
 * 4.2: a newer token family), but only /installs takes a revoked computer, and the login asked /me first.
 */

let sandbox: string;
let platform: FakePlatform;

function context(name: string): Context {
  const cwd = join(sandbox, name, "projeto");
  mkdirSync(cwd, { recursive: true });
  return createContext({
    baseUrl: platform.baseUrl,
    homeDir: join(sandbox, name, "home"),
    cwd,
    yes: true,
    locale: "pt-BR",
    env: { PATH: "" },
    io: { out: () => undefined, err: () => undefined, confirm: async () => true, openBrowser: async () => true },
  });
}

const login = (ctx: Context) => runCommand(ctx, parseArgs(["login", "--device", "--json"]));

before(async () => {
  sandbox = mkdtempSync(join(tmpdir(), "flyee-122-"));
  platform = await startFakePlatform({ tier: null, deviceLimit: 1, modules: [], recipes: [] });
});

after(async () => {
  await platform.close();
  rmSync(sandbox, { recursive: true, force: true });
});

describe("a computer the member disconnected comes back with a new login", () => {
  it("the login registers it again, instead of looping on 'log in again'", async () => {
    const pc = context("pc");
    assert.equal((await login(pc)).ok, true);
    platform.revokeDevice(readConfig(pc)!.device_id);
    const before = await runCommand(pc, parseArgs(["status", "--json"]));
    assert.equal(before.connected, false, "the old connection no longer works");
    const result = await login(pc);
    assert.equal(result.ok, true, JSON.stringify(result));
    const after = await runCommand(pc, parseArgs(["status", "--json"]));
    assert.equal(after.connected, true, JSON.stringify(after));
  });

  it("with the plan's computers taken, the new login says the limit, not that the computer was disconnected", async () => {
    const pc = context("pc");
    platform.revokeDevice(readConfig(pc)!.device_id);
    assert.equal((await login(context("notebook"))).ok, true, "another computer takes the plan's one place");
    const result = await login(pc);
    assert.equal(result.ok, false);
    assert.equal(result.error, "device_limit_reached", JSON.stringify(result));
  });

  it("the page after the approval says the approval came, since the connection finishes afterwards", () => {
    assert.match(t({ locale: "pt-BR" }, "login.page_done"), /aprovação recebida/);
    assert.doesNotMatch(t({ locale: "pt-BR" }, "login.page_done"), /computador conectado/);
    assert.match(t({ locale: "en" }, "login.page_done"), /approval received/);
  });
});
