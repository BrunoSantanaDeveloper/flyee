import { Client } from "../api/client.ts";
import { revokeToken } from "../api/oauth.ts";
import type { Context } from "../context.ts";
import { t } from "../i18n.ts";
import { clearCredentials } from "../state/credentials.ts";
import type { Result } from "./types.ts";

/** `flyee logout`: CLI-CONTRACT.md 2.4, revokes the machine's whole token family. */
export async function runLogout(ctx: Context): Promise<Result> {
  const client = new Client(ctx);
  const credentials = client.credentials();
  if (!credentials) {
    ctx.io.out(t(ctx, "logout.none"));
    return { ok: true, revoked: false };
  }
  await revokeToken(ctx, credentials.refresh_token);
  clearCredentials(ctx);
  ctx.io.out(t(ctx, "logout.done"));
  return { ok: true, revoked: true };
}
