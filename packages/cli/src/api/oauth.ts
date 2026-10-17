import { createHash, randomBytes } from "node:crypto";
import { closeSync, openSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

import type { Context } from "../context.ts";
import { t } from "../i18n.ts";
import { ensureDir } from "../util/fs.ts";
import { ApiError, CliError, fetchFailure } from "./errors.ts";
import type { DeviceAuthorization, ErrorBody, TokenResponse } from "./types.ts";

/**
 * OAuth 2.1 as the contract fixes it (CLI-CONTRACT.md, section 2): public
 * client `flyee-cli`, PKCE S256, loopback redirect on any port, device
 * authorization for machines without a browser, rotating refresh tokens.
 */
export const CLIENT_ID = "flyee-cli";
export const SCOPES = "profile:read catalog:read modules:download telemetry:write";
const LOGIN_TIMEOUT_MS = 5 * 60_000;

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

async function postForm<T>(ctx: Context, path: string, body: Record<string, string>): Promise<T> {
  let response: Response;
  try {
    response = await ctx.fetch(`${ctx.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams(body).toString(),
    });
  } catch (error) {
    throw new CliError("network", fetchFailure(error));
  }
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    const error = (json ?? {}) as ErrorBody;
    throw new ApiError({
      code: error.error ?? `http_${response.status}`,
      status: response.status,
      message: error.error_description ?? error.message ?? error.error ?? `HTTP ${response.status}`,
      actionUrl: error.error_uri ?? error.action_url,
      extra: error,
    });
  }
  return json as T;
}

export function exchangeCode(ctx: Context, code: string, verifier: string, redirectUri: string): Promise<TokenResponse> {
  return postForm<TokenResponse>(ctx, "/api/oauth/token", {
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
  });
}

export function refreshTokens(ctx: Context, refreshToken: string): Promise<TokenResponse> {
  return postForm<TokenResponse>(ctx, "/api/oauth/token", {
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
  });
}

export async function revokeToken(ctx: Context, token: string): Promise<void> {
  try {
    await postForm(ctx, "/api/oauth/revoke", { client_id: CLIENT_ID, token });
  } catch {
    // The contract answers 200 even for an unknown token; a network failure must not keep the member "connected" locally.
  }
}

export function buildAuthorizeUrl(ctx: Context, input: { redirectUri: string; challenge: string; state: string; deviceId: string }): string {
  const url = new URL("/oauth/authorize", `${ctx.baseUrl}/`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("device_id", input.deviceId);
  return url.toString();
}

/**
 * CLI-CONTRACT.md 2.1: a loopback server on a free port receives the code; the state must match.
 * `onUrl` answers false when no browser opened: nobody would come back to the loopback, so the
 * login ends at once with `no_browser` instead of waiting out its 5 minutes.
 */
export async function loginWithBrowser(ctx: Context, deviceId: string, onUrl: (url: string) => Promise<boolean>): Promise<TokenResponse> {
  const { verifier, challenge } = pkcePair();
  const state = base64url(randomBytes(16));

  return new Promise<TokenResponse>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close();
      fn();
    };
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname !== "/callback") {
        response.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      const error = url.searchParams.get("error");
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (error || !code || returnedState !== state) {
        response.end(`<!doctype html><meta charset="utf-8"><p>${t(ctx, "login.page_failed")}</p>`);
        finish(() => reject(new CliError("login_denied", error ?? "invalid_state")));
        return;
      }
      response.end(`<!doctype html><meta charset="utf-8"><p>${t(ctx, "login.page_done")}</p>`);
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      exchangeCode(ctx, code, verifier, `http://127.0.0.1:${port}/callback`).then(
        (tokens) => finish(() => resolve(tokens)),
        (cause) => finish(() => reject(cause)),
      );
    });
    const timer = setTimeout(() => finish(() => reject(new CliError("login_timeout", "login timed out"))), LOGIN_TIMEOUT_MS);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const redirectUri = `http://127.0.0.1:${port}/callback`;
      onUrl(buildAuthorizeUrl(ctx, { redirectUri, challenge, state, deviceId })).then(
        (opened) => {
          if (!opened) finish(() => reject(new CliError("no_browser", "the browser did not open")));
        },
        () => undefined,
      );
    });
    server.on("error", (cause) => finish(() => reject(cause)));
  });
}

/** CLI-CONTRACT.md 2.2 (RFC 8628): show the code, poll until approved, denied or expired. */
export async function loginWithDeviceCode(
  ctx: Context,
  deviceId: string,
  onCode: (authorization: DeviceAuthorization) => void | Promise<void>,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<TokenResponse> {
  const authorization = await postForm<DeviceAuthorization>(ctx, "/api/oauth/device", {
    client_id: CLIENT_ID,
    scope: SCOPES,
    device_id: deviceId,
  });
  // Awaited: the address and the code are flushed before the first poll starts the wait.
  await onCode(authorization);
  let interval = Math.max(1, authorization.interval) * 1000;
  const deadline = ctx.now() + authorization.expires_in * 1000;
  while (ctx.now() < deadline) {
    await sleep(interval);
    try {
      return await postForm<TokenResponse>(ctx, "/api/oauth/token", {
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        client_id: CLIENT_ID,
        device_code: authorization.device_code,
      });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.code === "authorization_pending") continue;
      if (error.code === "slow_down") {
        interval += 5000;
        continue;
      }
      throw error;
    }
  }
  throw new CliError("login_timeout", "device code expired");
}

/**
 * CLI-CONTRACT.md 2.3: two simultaneous refreshes revoke the whole family, so
 * every refresh on this machine goes through one lock file. A lock older than
 * 60 seconds is considered abandoned.
 */
export async function withRefreshLock<T>(ctx: Context, fn: () => Promise<T>): Promise<T> {
  ensureDir(ctx.flyeeHome);
  const lockFile = join(ctx.flyeeHome, "refresh.lock");
  const started = Date.now();
  for (;;) {
    try {
      const fd = openSync(lockFile, "wx");
      closeSync(fd);
      break;
    } catch {
      try {
        if (Date.now() - statSync(lockFile).mtimeMs > 60_000) rmSync(lockFile, { force: true });
      } catch {
        // the other process finished between the two calls
      }
      if (Date.now() - started > 65_000) throw new CliError("refresh_locked", "another flyee process is renewing the connection");
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  try {
    return await fn();
  } finally {
    rmSync(lockFile, { force: true });
  }
}
