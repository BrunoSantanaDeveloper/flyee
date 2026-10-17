import { CliError } from "../api/errors.ts";
import { reach, readBody } from "../api/network.ts";
import type { Context } from "../context.ts";

/** CLI-CONTRACT.md 4.5: the signed URL lives five minutes and takes no token. */
export async function downloadBytes(ctx: Context, url: string): Promise<Uint8Array> {
  const response = await reach(ctx, url);
  if (!response.ok) throw new CliError("download_failed", `HTTP ${response.status} while downloading the package`);
  return new Uint8Array(await readBody(url, () => response.arrayBuffer()));
}
