import { Client } from "../api/client.ts";
import type { Context } from "../context.ts";
import { loadCoreAssets } from "../core-assets.ts";
import { listed, t } from "../i18n.ts";
import { removeModule } from "../install/installer.ts";
import { dependentsOf } from "../install/relations.ts";
import { registerMachine } from "../registration.ts";
import { readLock } from "../state/lock.ts";
import { askOrExplain } from "./confirm.ts";
import type { ParsedArgs, Result } from "./types.ts";

/**
 * `flyee remove <slug>`: files, bridges and the lock entry go; the machine's
 * `installed_modules` is reported again (CLI-CONTRACT.md 4.2). An app that other
 * apps of the project use goes only after a yes, because their skills install it
 * again when they need it, undoing the member's choice: the question names them,
 * `--yes` answers it, and with no terminal and no `--yes` the answer is
 * `has_dependents` with the command that confirms. An app no other app uses goes
 * as before, without a question.
 */
export async function runRemove(ctx: Context, args: ParsedArgs): Promise<Result> {
  const slug = args.positionals[0];
  if (!slug) return { ok: false, error: "usage", message: "flyee remove <app>" };
  const lock = readLock(ctx);
  const dependents = lock?.modules[slug] ? dependentsOf(ctx, lock, slug) : [];
  // The member knows an app by its name; the slugs go in `dependents`.
  const named = (app: string) => lock?.modules[app]?.title || app;
  const usedBy = { title: named(slug), apps: listed(ctx, dependents.map(named)) };
  const many = dependents.length > 1;
  if (dependents.length) {
    const effect = t(ctx, many ? "remove.used_by_many" : "remove.used_by_one", usedBy);
    const answer = await askOrExplain(ctx, `${effect} ${t(ctx, "remove.confirm")}`, args, {
      plan: false,
      refusal: { error: "has_dependents", message: (yes) => t(ctx, "remove.has_dependents", { used_by: effect, yes }) },
    });
    if (answer !== true) {
      if (answer !== false) return { ...answer, slug, dependents };
      ctx.io.out(t(ctx, "remove.cancelled"));
      return { ok: false, error: "cancelled", message: t(ctx, "remove.cancelled"), slug, dependents };
    }
  }
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
  if (!dependents.length) return { ok: true, slug, removed: true };
  ctx.io.out(t(ctx, many ? "remove.done_used_by_many" : "remove.done_used_by_one", usedBy));
  return { ok: true, slug, removed: true, dependents };
}
