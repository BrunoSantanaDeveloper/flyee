import { existsSync } from "node:fs";
import { join } from "node:path";

import { Client } from "../api/client.ts";
import { describeFailure } from "../failure.ts";
import type { Context } from "../context.ts";
import { loadCoreAssets } from "../core-assets.ts";
import { t } from "../i18n.ts";
import { detectTools } from "../install/adapters.ts";
import { cloudNetwork } from "../install/hosts.ts";
import { isCloudSession } from "../api/network.ts";
import { type KeySource, keySource } from "../state/keys.ts";
import { moduleDir, readLock } from "../state/lock.ts";
import { readText, sha256File } from "../util/fs.ts";
import { CLI_VERSION } from "../version.ts";
import { isPresent, specsForApp } from "./need.ts";
import type { Result } from "./types.ts";

/**
 * `flyee doctor`: the facts a support conversation would ask for, in one
 * screen. Nothing here changes the machine.
 */
export async function runDoctor(ctx: Context): Promise<Result> {
  const assets = loadCoreAssets();
  const client = new Client(ctx);
  const lock = readLock(ctx);
  const markers = assets.core.markers;

  ctx.io.out(t(ctx, "doctor.node", { version: process.versions.node }));
  const tools = detectTools(ctx, assets.tools.tools);
  const detected = tools.filter((tool) => tool.detected);
  ctx.io.out(detected.length ? t(ctx, "doctor.tools", { list: detected.map((tool) => tool.label).join(", ") }) : t(ctx, "doctor.tools_none"));

  const adapters: Record<string, boolean> = {};
  const agents = readText(join(ctx.cwd, assets.tools.always.canonical));
  adapters[assets.tools.always.canonical] = Boolean(agents && agents.includes(markers.begin));
  for (const tool of assets.tools.tools) {
    if (tool.instructions.mode === "pointer" && tool.instructions.file && tool.instructions.pointer) {
      const content = readText(join(ctx.cwd, tool.instructions.file));
      adapters[tool.instructions.file] = Boolean(content && content.split(/\r?\n/).some((line) => line.trim() === tool.instructions.pointer));
    }
  }
  for (const skill of assets.coreSkills(ctx.locale)) {
    for (const dir of assets.tools.always.skillDirs) adapters[`${dir}/${skill.name}`] = existsSync(join(ctx.cwd, ...dir.split("/"), skill.name, "SKILL.md"));
  }
  ctx.io.out(t(ctx, "doctor.adapters", { list: Object.entries(adapters).map(([name, ok]) => `${name} ${ok ? "ok" : "missing"}`).join(", ") }));

  const integrity: Record<string, { intact: number; changed: string[] }> = {};
  const credentials: { slug: string; env: string; name: string; set: boolean; source: KeySource | null; required: boolean; may_be_network_secret?: boolean }[] = [];
  const cloud = isCloudSession(ctx);
  const programs: { slug: string; name: string; present: boolean }[] = [];
  for (const [slug, module] of Object.entries(lock?.modules ?? {})) {
    const changed: string[] = [];
    for (const file of module.files) {
      const actual = sha256File(join(moduleDir(ctx, slug), ...file.path.split("/")));
      if (actual !== file.sha256) changed.push(file.path);
    }
    for (const bridge of module.bridges) if (!existsSync(join(ctx.cwd, ...bridge.split("/")))) changed.push(bridge);
    integrity[slug] = { intact: module.files.length - changed.filter((path) => !module.bridges.includes(path)).length, changed };
    ctx.io.out(
      changed.length
        ? t(ctx, "doctor.integrity_fail", { slug, count: changed.length, list: changed.slice(0, 5).join(", ") })
        : t(ctx, "doctor.integrity_ok", { slug, count: module.files.length }),
    );
    for (const spec of specsForApp(assets, module.programs)) {
      const present = isPresent(ctx, spec);
      programs.push({ slug, name: spec.name, present });
      ctx.io.out(present ? t(ctx, "doctor.program_ok", { slug, label: spec.label }) : t(ctx, "doctor.program_missing", { slug, label: spec.label, name: spec.name }));
    }
    for (const credential of module.external_credentials) {
      const source = keySource(ctx, credential.env);
      // In a cloud session a key may be a network secret of the environment, which never reaches this machine.
      const secret = !source && cloud;
      credentials.push({ slug, env: credential.env, name: credential.name, set: source !== null, source, required: credential.required, ...(secret ? { may_be_network_secret: true } : {}) });
      const where = source === "environment" ? t(ctx, "key.where_environment") : t(ctx, "key.where_saved");
      ctx.io.out(source ? t(ctx, "doctor.env_ok", { slug, env: credential.env, where }) : t(ctx, secret ? "doctor.env_cloud" : "doctor.env_missing", { slug, env: credential.env, name: credential.name }));
    }
  }

  // The reason travels with the answer: a host the network refused (with the one-time step of a cloud
  // session), a certificate this machine does not trust and a name that does not resolve call for different fixes.
  let platform: { reachable: boolean; min_cli_version?: string; error?: string; message?: string; host?: string } = { reachable: false };
  try {
    const info = await client.version();
    platform = { reachable: true, min_cli_version: info.min_cli_version };
    ctx.io.out(t(ctx, "doctor.platform_ok", { base: ctx.baseUrl, min: info.min_cli_version }));
  } catch (error) {
    const failure = describeFailure(ctx, error);
    platform = { reachable: false, error: failure.error, message: failure.message, ...(typeof failure.host === "string" ? { host: failure.host } : {}) };
    ctx.io.out(t(ctx, "doctor.platform_fail", { base: ctx.baseUrl, detail: failure.message }));
  }

  // In a cloud session, what the installed apps need from the network and this session does not reach.
  const network = await cloudNetwork(ctx, Object.keys(lock?.modules ?? {}));

  return {
    ok: true,
    cli_version: CLI_VERSION,
    node: process.versions.node,
    connected: client.hasCredentials(),
    tools: tools.map((tool) => ({ id: tool.id, label: tool.label, tier: tool.tier, detected: tool.detected, reasons: tool.reasons })),
    adapters,
    integrity,
    programs,
    credentials,
    platform,
    ...(network ? { network } : {}),
  };
}
