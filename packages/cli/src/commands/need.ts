import type { Context } from "../context.ts";
import { type CoreAssets, loadCoreAssets } from "../core-assets.ts";
import { type MessageKey, t } from "../i18n.ts";
import { ensureProgram, findProgram, type InstallStep, type Manager, type ProgramResult, type ProgramSpec, recordPrograms, specFor } from "../programs.ts";
import { flag, has, type ParsedArgs, type Result } from "./types.ts";

const MANAGER_FLAGS: Manager[] = ["winget", "brew", "apt", "dnf", "pacman", "pipx", "pip"];

function finder(ctx: Context) {
  return ctx.system?.find ?? ((binary: string) => findProgram(binary, ctx.env));
}

/** Whether every binary of a program is already on this machine. */
export function isPresent(ctx: Context, spec: ProgramSpec): boolean {
  const find = finder(ctx);
  return spec.binaries.every((binary) => Boolean(find(binary)));
}

/**
 * Installs what is missing, one program at a time, printing one line each so
 * the member's AI can relay it. Never throws: a failure is a result.
 */
export function ensurePrograms(ctx: Context, specs: ProgramSpec[], options: { upgrade?: boolean } = {}): ProgramResult[] {
  const results: ProgramResult[] = [];
  for (const spec of specs) {
    const present = isPresent(ctx, spec);
    if (!present || options.upgrade) ctx.io.out(t(ctx, present ? "need.upgrading" : "need.installing", { label: spec.label }));
    const result = ensureProgram(spec, { upgrade: options.upgrade, find: finder(ctx), run: ctx.system?.run });
    const path = Object.values(result.binaries).find(Boolean) ?? "";
    if (result.status === "present") ctx.io.out(t(ctx, "need.present", { label: spec.label }));
    else if (result.status === "installed") ctx.io.out(t(ctx, "need.installed", { label: spec.label, path }));
    else if (result.status === "upgraded") ctx.io.out(t(ctx, "need.upgraded", { label: spec.label }));
    else if (result.status === "needs_member") {
      const reason = t(ctx, `need.reason.${result.reason ?? "no_package_manager"}` as MessageKey);
      ctx.io.out(t(ctx, "need.needs_member", { label: spec.label, reason, step: result.member_step ?? spec.url ?? "" }));
    } else ctx.io.out(t(ctx, "need.failed", { label: spec.label, detail: result.detail ?? "", url: spec.url ?? "" }));
    results.push(result);
  }
  try {
    recordPrograms(ctx, results);
  } catch {
    // the record is a convenience for apps; never a reason to fail
  }
  return results;
}

/** The programs an installed app declares, as registry entries. */
export function specsForApp(assets: CoreAssets, names: string[] | undefined): ProgramSpec[] {
  return (names ?? []).map((name) => assets.programs.get(name)).filter((spec): spec is ProgramSpec => Boolean(spec));
}

/** A program the registry does not know yet, from the recipe flags: `--winget <id> --brew <id> --apt <id>`. */
function adHocSpec(name: string, args: ParsedArgs): ProgramSpec | null {
  const steps: Partial<Record<"windows" | "macos" | "linux", InstallStep[]>> = {};
  for (const manager of MANAGER_FLAGS) {
    const id = flag(args, manager);
    if (!id) continue;
    const os = manager === "winget" ? "windows" : manager === "brew" ? "macos" : "linux";
    (steps[os] ??= []).push({ manager, id });
  }
  if (Object.keys(steps).length === 0) return null;
  return { name, label: name, binaries: [name], install: steps };
}

/**
 * `flyee need <program…> [--upgrade] [--yes]`: makes sure the programs an app
 * uses are on this machine, installing them through the system's package
 * manager. Meant to be run by the member's AI, so the member never opens a
 * terminal; it asks first unless --yes.
 */
export async function runNeed(ctx: Context, args: ParsedArgs): Promise<Result> {
  const names = args.positionals;
  if (names.length === 0) return { ok: false, error: "usage", message: t(ctx, "need.usage") };
  const assets = loadCoreAssets();
  const specs: ProgramSpec[] = [];
  for (const name of names) {
    const spec = specFor(assets.programs, name) ?? (names.length === 1 ? adHocSpec(name, args) : null);
    if (!spec) {
      const message = t(ctx, "need.unknown", { name, list: [...assets.programs.keys()].join(", ") });
      ctx.io.out(message);
      return { ok: false, error: "unknown_program", message };
    }
    if (!specs.some((known) => known.name === spec.name)) specs.push(spec);
  }
  const upgrade = has(args, "upgrade");
  const missing = specs.filter((spec) => !isPresent(ctx, spec));
  const toChange = upgrade ? specs : missing;
  if (toChange.length && !ctx.yes) {
    const list = toChange.map((spec) => spec.label).join(", ");
    if (!(await ctx.io.confirm(t(ctx, "need.confirm", { list })))) {
      ctx.io.out(t(ctx, "need.cancelled"));
      return { ok: false, error: "cancelled", message: t(ctx, "need.cancelled"), missing: missing.map((spec) => spec.name) };
    }
  }
  const programs = ensurePrograms(ctx, specs, { upgrade });
  const blocked = programs.filter((program) => program.status === "needs_member" || program.status === "failed");
  if (blocked.length === 0) return { ok: true, programs };
  return {
    ok: false,
    error: blocked.some((program) => program.status === "needs_member") ? "needs_member" : "install_failed",
    message: t(ctx, "need.blocked"),
    programs,
  };
}
