import type { Context } from "../context.ts";
import { causeChain, CliError, fetchFailure } from "./errors.ts";

/**
 * Every request the CLI makes, to the platform and to a package URL it gave,
 * goes through `reach`. It tells apart the failures a member's AI must act on
 * differently. The shapes were measured on Node 22.21, 22.23 and 24 against a
 * local proxy (2026-10-17):
 *
 * - A network proxy that refuses the host, as the Claude Code cloud proxy does
 *   for a domain the environment does not allow, answers the tunnel with 403.
 *   Node's fetch drops that answer's headers (x-deny-reason included) and keeps
 *   only `Proxy response (403) !== 200 when HTTP Tunneling`, two causes deep.
 * - A proxy that inspects TLS and refuses inside the tunnel answers a Response
 *   that carries `x-deny-reason`, a header the platform never sends.
 * - A proxy that inspects TLS shows its own certificate. The Claude Code docs
 *   say a mismatched certificate in a cloud session means the proxy ended the
 *   connection, not the destination.
 * - A proxy that closes the tunnel without answering makes undici reconnect
 *   without end, thousands of times a second, and the request never settles:
 *   hence a deadline for the response headers, and `releaseNetwork` at the end
 *   of a command whose deadline fired, which stops the reconnecting (measured:
 *   3,124 tunnels in 8 s without it, none after it, and the process ends alone).
 */

/** How long a host has to send the response headers. A long download body is never cut by it. */
export const HEADERS_DEADLINE_MS = 30_000;

const TUNNEL_REFUSED = /^Proxy response \((\d{3})\) !== 200 when HTTP Tunneling$/;

/**
 * Certificate codes, matched by code and never by message (Node 24 appends a
 * hint to the message), in the three causes a member can act on.
 */
const CERTIFICATE_KINDS: Record<string, "clock" | "name" | "untrusted"> = {
  CERT_HAS_EXPIRED: "clock",
  CERT_NOT_YET_VALID: "clock",
  ERR_TLS_CERT_ALTNAME_INVALID: "name",
  HOSTNAME_MISMATCH: "name",
  DEPTH_ZERO_SELF_SIGNED_CERT: "untrusted",
  SELF_SIGNED_CERT_IN_CHAIN: "untrusted",
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: "untrusted",
  UNABLE_TO_GET_ISSUER_CERT: "untrusted",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "untrusted",
  CERT_UNTRUSTED: "untrusted",
  CERT_REJECTED: "untrusted",
  CERT_SIGNATURE_FAILURE: "untrusted",
  CERT_REVOKED: "untrusted",
  INVALID_CA: "untrusted",
};

export type Refusal = { kind: "proxy"; status: number } | { kind: "certificate"; code: string; cause: "clock" | "name" | "untrusted" };

/**
 * What a thrown fetch error says about the network, or null for an ordinary
 * failure (a name that does not resolve, a refused connection, a timeout). Only
 * a tunnel answered 403 is a refusal: 407 asks for credentials, and 502 or 503
 * mean the proxy could not reach the host, so an upstream failure never fires.
 */
export function refusalOf(error: unknown): Refusal | null {
  for (const link of causeChain(error)) {
    const tunnel = typeof link.message === "string" ? TUNNEL_REFUSED.exec(link.message) : null;
    if (tunnel) return Number(tunnel[1]) === 403 ? { kind: "proxy", status: 403 } : null;
    const cause = typeof link.code === "string" ? CERTIFICATE_KINDS[link.code] : undefined;
    if (cause) return { kind: "certificate", code: link.code as string, cause };
  }
  return null;
}

/** The reason a network proxy gave when it wrote a response in place of the platform's, or null. */
export function refusedResponse(response: Pick<Response, "ok" | "headers">): string | null {
  return response.ok ? null : response.headers.get("x-deny-reason");
}

export function isCloudSession(ctx: Pick<Context, "env">): boolean {
  return ctx.env.CLAUDE_CODE_REMOTE === "true";
}

/** Whether this Node's fetch honors NODE_USE_ENV_PROXY: 22.21 or later on the 22 line, and every 24 or later (measured). */
export function nodeHonorsEnvProxy(version: string = process.versions.node): boolean {
  const [major, minor] = version.split(".").map(Number);
  return major >= 24 || (major === 22 && minor >= 21);
}

const PROXY_VARIABLES = ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"] as const;

/**
 * A proxy is set and this Node's fetch goes around it: calls fail as if the
 * network were down, and nothing else would say why (Node before 22.21).
 */
export function proxyIgnored(env: Record<string, string | undefined>, nodeVersion: string = process.versions.node): boolean {
  return PROXY_VARIABLES.some((name) => Boolean(env[name])) && env.NODE_USE_ENV_PROXY === undefined && !nodeHonorsEnvProxy(nodeVersion);
}

/** Hosts that answered for a command: a later silence or certificate from one of them is not the network's allowlist. */
const answeredBy = new WeakMap<object, Set<string>>();
function answered(ctx: Context): Set<string> {
  let hosts = answeredBy.get(ctx);
  if (!hosts) answeredBy.set(ctx, (hosts = new Set()));
  return hosts;
}
/** Whether a deadline fired in this process, leaving undici reconnecting in the background. */
let stalled = false;

/**
 * Ends what a request cut by the deadline left behind. undici keeps opening
 * tunnels for it after the deadline, and the process would only end through a
 * process.exit(), which aborts Node on Windows after a fetch. Destroying the
 * global dispatcher stops it; nothing else can fetch after the command is done.
 */
export async function releaseNetwork(): Promise<void> {
  if (!stalled) return;
  const dispatcher = (globalThis as Record<symbol, unknown>)[Symbol.for("undici.globalDispatcher.1")] as { destroy?: () => Promise<void> } | undefined;
  await dispatcher?.destroy?.().catch(() => undefined);
}

/** The host of a URL, never the URL itself: a package URL carries a signed token. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/**
 * The error the CLI raises when a host was out of reach. `host_not_allowed`
 * carries the host and whether this is a cloud session, so the message can name
 * the one-time step. In a cloud session a replaced certificate or a missing
 * answer count too, because there the proxy stands between the CLI and the host,
 * unless that host already answered in this process; a certificate out of its
 * dates is this computer's clock, everywhere.
 */
function unreachable(ctx: Context, url: string, error: unknown, timedOut: boolean, deadlineMs: number): CliError {
  const host = hostOf(url);
  const cloud = isCloudSession(ctx);
  const refusal = timedOut ? null : refusalOf(error);
  const proxyBetween = cloud && !answered(ctx).has(host);
  if (refusal?.kind === "proxy") return new CliError("host_not_allowed", host, undefined, { host, cloud, reason: "refused" });
  if (proxyBetween && timedOut) return new CliError("host_not_allowed", host, undefined, { host, cloud, reason: "no_answer" });
  if (refusal?.kind === "certificate") {
    if (proxyBetween && refusal.cause !== "clock") return new CliError("host_not_allowed", host, undefined, { host, cloud, reason: refusal.code });
    return new CliError("certificate", `${host}: ${refusal.code}`, undefined, { host, code: refusal.code, cause: refusal.cause, detail: fetchFailure(error) });
  }
  if (timedOut) return new CliError("network", host, undefined, { host, reason: "no_answer", seconds: Math.ceil(deadlineMs / 1000) });
  return new CliError("network", fetchFailure(error), undefined, { host });
}

/**
 * Fetches with a deadline for the response headers, cleared as soon as they
 * arrive, and turns a failure into the CLI's error. A response a network proxy
 * wrote (not ok, with x-deny-reason) becomes `host_not_allowed` when the reason
 * is the host, and a network error with the proxy's reason otherwise.
 */
export async function reach(ctx: Context, url: string, init: RequestInit = {}): Promise<Response> {
  if (!URL.canParse(url)) throw new CliError("network", "invalid address", undefined, { host: "" });
  const deadlineMs = ctx.headersDeadlineMs ?? HEADERS_DEADLINE_MS;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    stalled = true;
    controller.abort();
  }, deadlineMs);
  let response: Response;
  try {
    response = await ctx.fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    throw unreachable(ctx, url, error, timedOut, deadlineMs);
  } finally {
    clearTimeout(timer);
  }
  const host = hostOf(url);
  const denied = refusedResponse(response);
  if (denied === "host_not_allowed") throw new CliError("host_not_allowed", host, undefined, { host, cloud: isCloudSession(ctx), reason: denied });
  if (denied) throw new CliError("network", `${host}: the network refused the request (${denied})`, undefined, { host });
  answered(ctx).add(host);
  return response;
}

/**
 * Reads a response body, turning a connection cut after the headers into the
 * CLI's network error with the host, instead of an unexpected "terminated".
 */
export async function readBody<T>(url: string, read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    throw new CliError("network", fetchFailure(error), undefined, { host: hostOf(url), reason: "cut" });
  }
}
