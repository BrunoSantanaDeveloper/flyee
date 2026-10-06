import { CliError } from "../api/errors.ts";
import type { Context } from "../context.ts";

/** CLI-CONTRACT.md 4.5: the signed URL lives five minutes and takes no token. */
export async function downloadBytes(ctx: Context, url: string): Promise<Uint8Array> {
  let response: Response;
  try {
    response = await ctx.fetch(url);
  } catch (error) {
    throw new CliError("network", (error as Error).message);
  }
  if (!response.ok) throw new CliError("download_failed", `HTTP ${response.status} while downloading the package`);
  return new Uint8Array(await response.arrayBuffer());
}
