import { readFileSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";

import type { Context } from "../context.ts";
import { loadCoreAssets } from "../core-assets.ts";
import { t } from "../i18n.ts";
import { installFromDirectory } from "../install/installer.ts";
import type { ParsedArgs, Result } from "./types.ts";

const PRODUCT_REPO = "flyee-product";

/**
 * The product repository the folder belongs to, if any: the nearest
 * package.json named `flyee-product` up the tree. `dev link` there would write
 * the member's AGENTS.md block, pointers and skill bridges over the operator's
 * development harness.
 */
export function productRepoAbove(start: string): string | null {
  let current = resolve(start);
  const root = parse(current).root;
  for (;;) {
    try {
      const pkg = JSON.parse(readFileSync(join(current, "package.json"), "utf8")) as { name?: string };
      if (pkg.name === PRODUCT_REPO) return current;
    } catch {
      // no package.json here, or unreadable
    }
    if (current === root) return null;
    current = dirname(current);
  }
}

/** `FLYEE_DEV=1 flyee dev link <dir>`: the operator tries an app from the product repository without the platform. */
export async function runDev(ctx: Context, args: ParsedArgs): Promise<Result> {
  if (!ctx.dev) {
    ctx.io.out(t(ctx, "dev.disabled"));
    return { ok: false, error: "dev_disabled", message: t(ctx, "dev.disabled") };
  }
  const [sub, dir] = args.positionals;
  if (sub !== "link" || !dir) return { ok: false, error: "usage", message: "flyee dev link <dir>" };
  const repo = productRepoAbove(ctx.cwd);
  if (repo) {
    const message = t(ctx, "dev.inside_repo", { root: repo });
    ctx.io.out(message);
    return { ok: false, error: "inside_product_repo", message };
  }
  const assets = loadCoreAssets();
  const result = installFromDirectory(ctx, assets, resolve(ctx.cwd, dir));
  ctx.io.out(t(ctx, "dev.linked", { slug: result.slug, version: result.module.version, dir }));
  return { ok: true, slug: result.slug, version: result.module.version, skills: result.module.skills, dev: true };
}
