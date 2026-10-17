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
 * Why a fetch failed. Node says only "fetch failed" and keeps the reason in
 * `cause`: a name that does not resolve (ENOTFOUND), a proxy that refused the
 * tunnel, or a certificate this machine does not trust, as behind a proxy that
 * inspects TLS (UNABLE_TO_GET_ISSUER_CERT_LOCALLY). Without it nobody can tell
 * those apart, least of all the member's AI in a cloud session.
 */
export function fetchFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? (error.cause as { code?: unknown; message?: unknown } | undefined) : undefined;
  const parts = [cause?.code, cause?.message].filter((part): part is string => typeof part === "string" && part.length > 0 && !message.includes(part));
  return parts.length ? `${message} (${[...new Set(parts)].join(": ")})`.slice(0, 300) : message;
}

/** A failure the CLI itself detected: a package that does not check out, no connection, a bad argument. */
export class CliError extends Error {
  code: string;
  actionUrl: string | undefined;

  constructor(code: string, message: string, actionUrl?: string) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.actionUrl = actionUrl;
  }
}
