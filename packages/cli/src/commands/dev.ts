import { resolve } from "node:path";

import type { Context } from "../context.ts";
import { loadCoreAssets } from "../core-assets.ts";
import { t } from "../i18n.ts";
import { installFromDirectory } from "../install/installer.ts";
import type { ParsedArgs, Result } from "./types.ts";

/** `FLYEE_DEV=1 flyee dev link <dir>`: the operator tries an app from the product repository without the platform. */
export async function runDev(ctx: Context, args: ParsedArgs): Promise<Result> {
  if (!ctx.dev) {
    ctx.io.out(t(ctx, "dev.disabled"));
    return { ok: false, error: "dev_disabled", message: t(ctx, "dev.disabled") };
  }
  const [sub, dir] = args.positionals;
  if (sub !== "link" || !dir) return { ok: false, error: "usage", message: "flyee dev link <dir>" };
  const assets = loadCoreAssets();
  const result = installFromDirectory(ctx, assets, resolve(ctx.cwd, dir));
  ctx.io.out(t(ctx, "dev.linked", { slug: result.slug, version: result.module.version, dir }));
  return { ok: true, slug: result.slug, version: result.module.version, skills: result.module.skills, dev: true };
}
