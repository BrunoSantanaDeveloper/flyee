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
