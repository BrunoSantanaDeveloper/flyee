import type { Context } from "../context.ts";
import { compareSemver, isSemver } from "../semver.ts";
import { ensureConfig } from "../state/config.ts";
import { accessExpired, type Credentials, readCredentials, writeCredentials } from "../state/credentials.ts";
import { CLI_VERSION } from "../version.ts";
import { ApiError, CliError } from "./errors.ts";
import { reach, readBody } from "./network.ts";
import { refreshTokens, withRefreshLock } from "./oauth.ts";
import type {
  Catalog,
  DownloadInfo,
  ErrorBody,
  EventsResponse,
  InstallsPayload,
  InstallsResponse,
  Me,
  ModuleDetail,
  Recipe,
  TokenResponse,
  VersionInfo,
} from "./types.ts";

export const DEVICE_HEADER = "X-Flyee-Device";

/**
 * The contract client. Every `/api/cli/*` call carries the bearer token and the
 * device header (CLI-CONTRACT.md, section 3). A 401 triggers one refresh and
 * one retry; `device_unknown` registers the machine and retries once.
 */
export class Client {
  ctx: Context;
  private versionInfo: VersionInfo | null = null;
  private registerDevice: (() => Promise<void>) | null = null;

  constructor(ctx: Context) {
    this.ctx = ctx;
  }

  /** What `installs` should send when the server says it does not know this machine. */
  onDeviceUnknown(register: () => Promise<void>): void {
    this.registerDevice = register;
  }

  get deviceId(): string {
    return ensureConfig(this.ctx).device_id;
  }

  credentials(): Credentials | null {
    return readCredentials(this.ctx);
  }

  hasCredentials(): boolean {
    return this.credentials() !== null;
  }

  storeTokens(tokens: TokenResponse): Credentials {
    const now = this.ctx.now();
    const credentials: Credentials = {
      base_url: this.ctx.baseUrl,
      access_token: tokens.access_token,
      access_expires_at: new Date(now + tokens.expires_in * 1000).toISOString(),
      refresh_token: tokens.refresh_token,
      refresh_expires_at: new Date(now + tokens.refresh_token_expires_in * 1000).toISOString(),
      scope: tokens.scope,
      obtained_at: new Date(now).toISOString(),
    };
    writeCredentials(this.ctx, credentials);
    return credentials;
  }

  /** CLI-CONTRACT.md 4.9: public; a CLI below `min_cli_version` must stop before any other call. */
  async version(): Promise<VersionInfo> {
    if (this.versionInfo) return this.versionInfo;
    const url = `${this.ctx.baseUrl}/api/cli/version`;
    const response = await reach(this.ctx, url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new CliError("network", `HTTP ${response.status} from /api/cli/version`);
    const info = (await readBody(url, () => response.json())) as VersionInfo;
    this.versionInfo = {
      min_cli_version: typeof info.min_cli_version === "string" ? info.min_cli_version : "0.0.0",
      latest_core_version: typeof info.latest_core_version === "string" ? info.latest_core_version : null,
      deprecations: Array.isArray(info.deprecations) ? info.deprecations : [],
      links: info.links && typeof info.links === "object" ? info.links : undefined,
    };
    return this.versionInfo;
  }

  async ensureMinVersion(): Promise<VersionInfo> {
    const info = await this.version();
    if (isSemver(info.min_cli_version) && isSemver(CLI_VERSION) && compareSemver(CLI_VERSION, info.min_cli_version) < 0) {
      throw new CliError("cli_outdated", info.min_cli_version);
    }
    return info;
  }

  /** Renews the pair; the old refresh token dies with the response (CLI-CONTRACT.md 2.3). */
  async refresh(): Promise<Credentials> {
    return withRefreshLock(this.ctx, async () => {
      const current = this.credentials();
      if (!current) throw new CliError("not_logged", "no credentials");
      try {
        const tokens = await refreshTokens(this.ctx, current.refresh_token);
        return this.storeTokens(tokens);
      } catch (error) {
        if (error instanceof ApiError && error.code === "invalid_grant") {
          throw new CliError("relogin", error.message, error.actionUrl);
        }
        throw error;
      }
    });
  }

  private async accessToken(): Promise<string> {
    const credentials = this.credentials();
    if (!credentials) throw new CliError("not_logged", "no credentials");
    if (accessExpired(credentials, this.ctx.now())) return (await this.refresh()).access_token;
    return credentials.access_token;
  }

  private async request<T>(
    path: string,
    init: { method?: string; body?: unknown; device?: boolean } = {},
    attempt = 0,
  ): Promise<T> {
    const token = await this.accessToken();
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    if (init.device !== false) headers[DEVICE_HEADER] = this.deviceId;
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    const url = `${this.ctx.baseUrl}${path}`;
    const response = await reach(this.ctx, url, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await readBody(url, () => response.text());
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (response.ok) return json as T;

    const body = (json ?? {}) as ErrorBody;
    const code = body.error ?? `http_${response.status}`;
    if (response.status === 401 && attempt === 0) {
      await this.refresh();
      return this.request<T>(path, init, attempt + 1);
    }
    if (code === "device_unknown" && attempt === 0 && this.registerDevice) {
      await this.registerDevice();
      return this.request<T>(path, init, attempt + 1);
    }
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new ApiError({
      code,
      status: response.status,
      message: body.message ?? body.error_description ?? code,
      actionUrl: body.action_url ?? body.error_uri,
      retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
      extra: body,
    });
  }

  me(): Promise<Me> {
    return this.request<Me>("/api/cli/me");
  }

  catalog(locale?: string): Promise<Catalog> {
    const query = locale ? `?locale=${encodeURIComponent(locale)}` : "";
    return this.request<Catalog>(`/api/cli/catalog${query}`);
  }

  module(slug: string): Promise<ModuleDetail> {
    return this.request<ModuleDetail>(`/api/cli/modules/${encodeURIComponent(slug)}`);
  }

  download(slug: string, version: string): Promise<DownloadInfo> {
    return this.request<DownloadInfo>(
      `/api/cli/modules/${encodeURIComponent(slug)}/versions/${encodeURIComponent(version)}/download`,
    );
  }

  recipe(slug: string): Promise<Recipe> {
    return this.request<Recipe>(`/api/cli/recipes/${encodeURIComponent(slug)}`);
  }

  installs(payload: InstallsPayload): Promise<InstallsResponse> {
    return this.request<InstallsResponse>("/api/cli/installs", { method: "POST", body: payload });
  }

  events(events: { name: string; properties: Record<string, string>; occurred_at: string }[]): Promise<EventsResponse> {
    return this.request<EventsResponse>("/api/cli/events", { method: "POST", body: { events } });
  }
}
