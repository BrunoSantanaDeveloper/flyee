import { Client } from "../api/client.ts";
import type { Context } from "../context.ts";
import { loadCoreAssets } from "../core-assets.ts";
import { t } from "../i18n.ts";
import { removeModule } from "../install/installer.ts";
import { registerMachine } from "../registration.ts";
import type { ParsedArgs, Result } from "./types.ts";

/** `flyee remove <slug>`: files, bridges and the lock entry go; the machine's `installed_modules` is reported again. */
export async function runRemove(ctx: Context, args: ParsedArgs): Promise<Result> {
  const slug = args.positionals[0];
  if (!slug) return { ok: false, error: "usage", message: "flyee remove <app>" };
  const assets = loadCoreAssets();
  const { removed } = removeModule(ctx, assets, slug);
  if (!removed) {
    ctx.io.out(t(ctx, "remove.missing", { slug }));
    return { ok: false, error: "not_installed", message: t(ctx, "remove.missing", { slug }) };
  }
  const client = new Client(ctx);
  if (client.hasCredentials()) {
    try {
      await registerMachine(ctx, client, assets);
    } catch {
      // Reporting is best effort; the removal itself is done.
    }
  }
  ctx.io.out(t(ctx, "remove.done", { slug }));
  return { ok: true, slug, removed: true };
}
