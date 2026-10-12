import type { Context } from "../context.ts";
import { t } from "../i18n.ts";
import { projectViews } from "../state/projects.ts";
import type { Result } from "./types.ts";

/**
 * `flyee projects`: the folders on this machine that have flyee apps, each
 * with what is installed there. Local state only (`~/.flyee/projects.json`
 * and each project's lock): no call to the platform, nothing sent anywhere.
 */
export async function runProjects(ctx: Context): Promise<Result> {
  const projects = projectViews(ctx);
  if (projects.length === 0) ctx.io.out(t(ctx, "projects.none"));
  else {
    ctx.io.out(t(ctx, "projects.header"));
    for (const project of projects) {
      const apps = project.apps.map((app) => `${app.slug} ${app.version}${app.dev ? " (dev)" : ""}`).join(", ") || "—";
      ctx.io.out(t(ctx, "projects.line", { name: project.name, current: project.current ? t(ctx, "projects.current") : "", apps, path: project.path }));
    }
  }
  ctx.io.out(t(ctx, "projects.hint"));
  return { ok: true, projects };
}
