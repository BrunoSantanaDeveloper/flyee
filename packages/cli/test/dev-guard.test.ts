import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { productRepoAbove } from "../src/commands/dev.ts";
import { createContext } from "../src/context.ts";
import { parseArgs, runCommand } from "../src/main.ts";

let sandbox: string;

before(() => {
  sandbox = mkdtempSync(join(tmpdir(), "flyee-guard-"));
});
after(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe("dev link never writes the member harness into the product repository", () => {
  it("finds the product repository from any folder inside it", () => {
    const repo = join(sandbox, "flyee");
    mkdirSync(join(repo, "modules", "radar"), { recursive: true });
    writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "flyee-product" }));
    writeFileSync(join(repo, "modules", "package.json"), JSON.stringify({ name: "something-else" }));
    assert.equal(productRepoAbove(join(repo, "modules", "radar")), repo);
    assert.equal(productRepoAbove(join(sandbox)), null);
  });

  it("refuses inside it and writes nothing", async () => {
    const repo = join(sandbox, "flyee");
    const output: string[] = [];
    const ctx = createContext({
      cwd: repo,
      homeDir: join(sandbox, "home"),
      env: { PATH: "" },
      dev: true,
      locale: "pt-BR",
      io: { out: (line) => output.push(line), err: (line) => output.push(line) },
    });
    const result = await runCommand(ctx, parseArgs(["dev", "link", join(repo, "modules", "radar")]));
    assert.equal(result.ok, false);
    assert.equal(result.error, "inside_product_repo");
    assert.ok(output.some((line) => line.includes("npm run apps -- link")));
    assert.equal(existsSync(join(repo, "AGENTS.md")), false);
    assert.equal(existsSync(join(repo, ".flyee")), false);
  });
});
