/** A refusal the platform answered, as the contract shapes it (CLI-CONTRACT.md, section 3). */
export class ApiError extends Error {
  code: string;
  status: number;
  actionUrl: string | undefined;
  retryAfter: number | undefined;
  extra: Record<string, unknown>;

  constructor(input: {
    code: string;
    status: number;
    message?: string;
    actionUrl?: string;
    retryAfter?: number;
    extra?: Record<string, unknown>;
  }) {
    super(input.message ?? input.code);
    this.name = "ApiError";
    this.code = input.code;
    this.status = input.status;
    this.actionUrl = input.actionUrl;
    this.retryAfter = input.retryAfter;
    this.extra = input.extra ?? {};
  }
}

/**
 * An error, its causes and an AggregateError's members, at most 8 deep. Node's
 * fetch nests the reason: a proxy that refused the tunnel sits two causes below
 * "fetch failed" (measured on Node 22.21, 22.23 and 24).
 */
export function* causeChain(value: unknown, depth = 0, seen = new Set<unknown>()): Generator<{ code?: unknown; message?: unknown }> {
  if (value === null || typeof value !== "object" || seen.has(value) || depth > 8) return;
  seen.add(value);
  yield value as { code?: unknown; message?: unknown };
  yield* causeChain((value as { cause?: unknown }).cause, depth + 1, seen);
  const members = (value as { errors?: unknown }).errors;
  if (Array.isArray(members)) for (const member of members) yield* causeChain(member, depth + 1, seen);
}

/**
 * Why a fetch failed. Node says only "fetch failed" and keeps the reason in its
 * causes: a name that does not resolve (ENOTFOUND), a proxy that asked for
 * credentials (`Proxy response (407)`), or a certificate this machine does not
 * trust (UNABLE_TO_GET_ISSUER_CERT_LOCALLY). Without them nobody can tell those
 * apart, least of all the member's AI in a cloud session.
 */
export function fetchFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const seen = [message];
  const links: string[] = [];
  for (const link of causeChain(error)) {
    if (link === error) continue;
    const parts = [link.code, link.message].filter((part): part is string => typeof part === "string" && part.length > 0 && !seen.some((text) => text.includes(part)));
    seen.push(...parts);
    if (parts.length) links.push(parts.join(": "));
  }
  return links.length ? `${message} (${links.join("; ")})`.slice(0, 300) : message;
}

/** A failure the CLI itself detected: a package that does not check out, no connection, a bad argument. */
export class CliError extends Error {
  code: string;
  actionUrl: string | undefined;
  /** Fields the result carries besides `error` and `message`, such as the host a network refused. */
  extra: Record<string, unknown>;

  constructor(code: string, message: string, actionUrl?: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.actionUrl = actionUrl;
    this.extra = extra;
  }
}
