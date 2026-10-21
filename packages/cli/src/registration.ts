import { Client } from "./api/client.ts";
import { CLOUD_MARK, isCloudSession } from "./api/network.ts";
import type { InstallsPayload, InstallsResponse } from "./api/types.ts";
import type { Context } from "./context.ts";
import type { CoreAssets } from "./core-assets.ts";
import { detectedToolDetail, detectTools, reportedAiTool } from "./install/adapters.ts";
import { ensureConfig } from "./state/config.ts";
import { nextBatch, writeQueue } from "./state/events.ts";
import { readLock } from "./state/lock.ts";
import { installedAcrossProjects, rememberProject } from "./state/projects.ts";
import { contractOs, osVersion } from "./util/os.ts";
import { CLI_VERSION } from "./version.ts";

/** CLI-CONTRACT.md 4.2: what the CLI reports about this machine after a login and after every update. */
export function buildInstallsPayload(ctx: Context, assets: CoreAssets, options: { updated?: boolean; kind?: "own" | "client" } = {}): InstallsPayload {
  const config = ensureConfig(ctx);
  const lock = readLock(ctx);
  const detected = detectTools(ctx, assets.tools.tools);
  const payload: InstallsPayload = {
    device_id: config.device_id,
    name: config.device_name,
    os: contractOs(),
    os_version: osVersion().trim().slice(0, 40),
    ai_tool: reportedAiTool(detected),
    cli_version: CLI_VERSION,
    core_version: assets.core.version,
    installed_modules: installedAcrossProjects(ctx, lock),
  };
  const detail = detectedToolDetail(detected);
  if (payload.ai_tool === "other" && detail) payload.ai_tool_detail = detail;
  const kind = options.kind ?? lock?.project_kind;
  if (kind) payload.project_kind = kind;
  if (options.updated) payload.updated = true;
  // A cloud session takes the account's cloud place, outside the plan's computers, and a newer one replaces it (4.2).
  if (isCloudSession(ctx)) payload.cloud = CLOUD_MARK;
  return payload;
}

export async function registerMachine(ctx: Context, client: Client, assets: CoreAssets, options: { updated?: boolean; kind?: "own" | "client" } = {}): Promise<InstallsResponse> {
  rememberProject(ctx, options.kind ?? readLock(ctx)?.project_kind);
  return client.installs(buildInstallsPayload(ctx, assets, options));
}

/** Sends what is queued, at most 50 per call, and keeps what the server did not take. Never throws. */
export async function flushEvents(ctx: Context, client: Client): Promise<{ accepted: number; dropped: number; remaining: number }> {
  if (!client.hasCredentials()) return { accepted: 0, dropped: 0, remaining: 0 };
  const { batch, rest, dropped } = nextBatch(ctx);
  if (batch.length === 0) {
    if (dropped) writeQueue(ctx, rest);
    return { accepted: 0, dropped, remaining: rest.length };
  }
  try {
    const response = await client.events(batch);
    writeQueue(ctx, rest);
    return { accepted: response.accepted ?? batch.length, dropped: dropped + (response.dropped ?? 0), remaining: rest.length };
  } catch {
    return { accepted: 0, dropped, remaining: batch.length + rest.length };
  }
}
