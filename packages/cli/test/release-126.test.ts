import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadCoreAssets } from "../src/core-assets.ts";
import { compareSemver } from "../src/semver.ts";

/**
 * CLI 1.2.6, core 1.11.0: the writing review never adds a fact. Rewrites with
 * the old skill swapped empty sentences for made-up results in 5 of 6 runs, and
 * the apps that said "adds no fact" at the call were the only ones protected.
 * The block says it now, so a direct request and an older app are covered too.
 * What the skill's own examples may say is checked in module-tools, next to the
 * copy rules (`text-lint.test.ts`).
 */
describe("the core says the writing review adds nothing", () => {
  const assets = loadCoreAssets();

  it("is core 1.11.0 or later", () => {
    assert.ok(compareSemver(assets.core.version, "1.11.0") >= 0, assets.core.version);
  });

  for (const locale of ["pt-BR", "en"] as const) {
    it(`in ${locale}, the block names the review and what it never adds`, () => {
      const block = assets.agentsTemplate(locale);
      assert.match(block, /`texto-natural`/);
      assert.match(block, locale === "en" ? /adds no fact, number or promise/ : /sem acrescentar fato, número ou promessa/);
    });
  }
});
