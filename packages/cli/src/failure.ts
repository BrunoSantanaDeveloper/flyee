import { ApiError, CliError } from "./api/errors.ts";
import { proxyIgnored } from "./api/network.ts";
import type { Fail } from "./commands/types.ts";
import type { Context } from "./context.ts";
import { t } from "./i18n.ts";
import { CLI_VERSION } from "./version.ts";

/** Codes of a host out of reach, where a proxy this Node goes around may be the reason. */
const NETWORK_CODES = new Set(["network", "host_not_allowed", "certificate"]);

/**
 * Turns any failure into the contract's shape and a line the member can act on.
 * A host a network refused (api/network.ts) names the host and, in a Claude Code
 * cloud session, the one-time step on the session's environment, so the member's
 * AI asks for exactly that instead of guessing.
 */
export function describeFailure(ctx: Context, error: unknown): Fail {
  if (error instanceof ApiError) {
    return { ok: false, error: error.code, message: error.message, action_url: error.actionUrl, status: error.status, ...error.extra };
  }
  if (error instanceof CliError) {
    const host = typeof error.extra.host === "string" ? error.extra.host : "";
    let message: string;
    if (error.code === "cli_outdated") message = t(ctx, "error.min_version", { current: CLI_VERSION, min: error.message });
    else if (error.code === "not_logged") message = t(ctx, "error.not_logged");
    else if (error.code === "relogin" || error.code === "login_denied") message = t(ctx, "error.relogin");
    else if (error.code === "login_timeout") message = t(ctx, "login.timeout");
    else if (error.code === "host_not_allowed") message = t(ctx, error.extra.cloud === true ? "error.host_not_allowed_cloud" : "error.host_not_allowed", { host });
    else if (error.code === "certificate") {
      const cause = error.extra.cause === "clock" ? "error.certificate_clock" : error.extra.cause === "name" ? "error.certificate_name" : "error.certificate";
      message = t(ctx, cause, { host, code: String(error.extra.code ?? "") });
    } else if (error.code === "network") {
      const detail = error.extra.reason === "no_answer" ? t(ctx, "error.no_answer", { host, seconds: Number(error.extra.seconds ?? 30) }) : error.message;
      message = t(ctx, "error.network", { detail });
    } else if (error.code.startsWith("package_") || error.code === "download_failed") message = t(ctx, "error.package", { detail: error.message });
    else message = error.message;
    // A proxy is set and this Node goes around it: the likeliest reason for any of these, and nothing else says it.
    const ignored = NETWORK_CODES.has(error.code) && proxyIgnored(ctx.env);
    if (ignored) message = `${message} ${t(ctx, "error.proxy_ignored", { version: process.versions.node })}`;
    return { ok: false, error: error.code, message, action_url: error.actionUrl, ...error.extra, ...(ignored ? { proxy_ignored: true } : {}) };
  }
  return { ok: false, error: "unexpected", message: t(ctx, "error.unknown", { detail: error instanceof Error ? error.message : String(error) }) };
}
