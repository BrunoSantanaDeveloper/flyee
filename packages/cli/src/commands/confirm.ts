import type { Context } from "../context.ts";
import { t } from "../i18n.ts";
import type { Fail, ParsedArgs } from "./types.ts";

/** Flags that never go into a command written back for the AI to run. */
const NOT_REPEATED = new Set(["json", "yes", "dry-run"]);

/** The command as typed, minus --json, --yes and --dry-run, for a message that says how to run it again. */
export function commandLine(args: ParsedArgs): string {
  const quote = (value: string) => (/^[\w@:./,=-]+$/.test(value) ? value : `"${value.replace(/"/g, '\\"')}"`);
  const parts = [args.command ?? "", ...args.positionals.map(quote)];
  for (const [name, value] of Object.entries(args.flags)) {
    if (NOT_REPEATED.has(name)) continue;
    parts.push(value === true ? `--${name}` : `--${name} ${quote(String(value))}`);
  }
  return parts.filter(Boolean).join(" ");
}

/**
 * Asks before a change. True goes on and false is the person's no; without a
 * terminal to ask on (the member's AI ran the command) nothing can answer, so
 * the result says how the confirmation comes instead: show the plan with
 * --dry-run, then run again with --yes after the member's yes. Its own error
 * code, `confirmation_required`, keeps it apart from a "no".
 */
export async function askOrExplain(ctx: Context, question: string, args: ParsedArgs, options: { plan?: boolean } = {}): Promise<boolean | Fail> {
  if (ctx.yes) return true;
  const answer = await ctx.io.confirm(question);
  if (answer !== null) return answer;
  const run = `npx --yes flyee@latest ${commandLine(args)}`;
  const yes = `${run} --yes --json`;
  const plan = options.plan === false ? null : `${run} --dry-run --json`;
  const message = plan ? t(ctx, "confirm.no_terminal_plan", { plan, yes }) : t(ctx, "confirm.no_terminal", { yes });
  ctx.io.out(message);
  return { ok: false, error: "confirmation_required", message, confirm_with: yes, ...(plan ? { plan_with: plan } : {}) };
}
