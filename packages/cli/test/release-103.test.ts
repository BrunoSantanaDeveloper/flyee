import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadCoreAssets } from "../src/core-assets.ts";
import { t } from "../src/i18n.ts";
import { compareSemver } from "../src/semver.ts";

/**
 * CLI 1.0.3, from the operator's test as a member in a Claude Code cloud
 * session (2026-10-21): the install worked from start to end, but the AI told a
 * beginner which files, folders, fields and versions flyee wrote and checked,
 * Claude Code's auto mode refused a flyee command and the commit of the flyee
 * files, and two messages the AI shows as they came spoke of "a pessoa" to the
 * person reading them.
 */

describe("messages the AI shows as they came speak to the member", () => {
  for (const locale of ["pt-BR", "en"] as const) {
    it(`in ${locale}, the cloud's device limit and the refused host`, () => {
      const limit = t({ locale }, "login.device_limit_cloud");
      const host = t({ locale }, "error.host_not_allowed_cloud", { host: "flyee.club" });
      for (const message of [limit, host]) {
        assert.doesNotMatch(message, /\ba pessoa\b|à pessoa|the person/, message);
        assert.match(message, locale === "en" ? /say so in the conversation/ : /avise na conversa/, message);
      }
    });
  }
});

describe("the core tells the AI to keep it simple and to ask when its tool refuses", () => {
  const assets = loadCoreAssets();

  it("is a new core version, so members receive it on update", () => {
    assert.ok(compareSemver(assets.core.version, "1.7.0") >= 0, assets.core.version);
  });

  for (const locale of ["pt-BR", "en"] as const) {
    it(`in ${locale}, in the AGENTS.md block and in the /flyee skill`, () => {
      const block = assets.agentsTemplate(locale);
      const skill = assets.flyeeSkill(locale);
      const simple = locale === "en" ? /Keep it simple/ : /Fale simples/;
      const noDetail = locale === "en" ? /do not describe commands, files, folders, JSON fields, versions/i : /não descreva comandos, arquivos, pastas, campos do JSON, versões/i;
      const refusal = locale === "en" ? /refuses a flyee command through its own permission system/ : /recusar um comando do flyee pelo próprio sistema de permissões/;
      for (const text of [block, skill]) {
        assert.match(text, simple);
        assert.match(text, noDetail);
        assert.match(text, refusal);
      }
      // The commit of the flyee files in a cloud session: one ask, the mode switch, no file inspection.
      assert.match(block, locale === "en" ? /ask the member once to switch the mode/ : /peça uma vez que o integrante troque o modo/);
      assert.match(block, locale === "en" ? /no need to open them to check/ : /não precisa abri-los para conferir/);
    });
  }
});
