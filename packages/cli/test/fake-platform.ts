import { createHash, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { zipSync, type Zippable } from "fflate";

/**
 * The subset of the platform the CLI talks to (CLI-CONTRACT.md), in memory:
 * device authorization, token exchange and rotation, revocation, /me,
 * /installs, /catalog, /modules, /download with a storage URL, /recipes and
 * /events. Entitlement and device rules follow the contract's gate order.
 */

export type FakeVersion = { version: string; bytes: Uint8Array; sha256: string; permissions?: unknown[]; changelog?: string };
export type FakeModule = {
  slug: string;
  trail: string;
  type: string;
  name: string;
  summary: string;
  entitled: boolean;
  is_free_sample?: boolean;
  external_credentials?: unknown[];
  versions: FakeVersion[];
  /** Planned contract field: the newest version for any account, when it differs from `latest`. */
  newest?: string;
};
export type FakeRecipe = { slug: string; name: string; entitled: boolean; workflow: string | null; modules: string[] };
export type FakeOptions = {
  tier?: string | null;
  /** What /me says the access is called (CLI-CONTRACT.md 4.1); by default the name the panel shows for the tier. */
  tierName?: string | null;
  minCliVersion?: string;
  links?: Record<string, string>;
  deprecations?: string[];
  modules?: FakeModule[];
  recipes?: FakeRecipe[];
  deviceLimit?: number;
  /** The account's cloud places (`plans.limits.cloud_sessions`, 4.2); 1 by default, 0 counts a cloud session as a computer. */
  cloudSessions?: number;
  /** What /me says of the account (CLI-CONTRACT.md 4.1): an inactive account answers /me and nothing else. */
  accessActive?: boolean;
  suspended?: boolean;
  locale?: string;
  accessTtlSeconds?: number;
  /** Serve bytes that do not match the announced checksum. */
  corruptDownload?: boolean;
};

type TokenRecord = { access: string; refresh: string; family: string; deviceId: string | null; accessExpiresAt: number; refreshExpiresAt: number; used: boolean; revoked: boolean };

export type FakeState = {
  installs: Record<string, unknown>[];
  events: Record<string, unknown>[];
  revoked: string[];
  refreshes: number;
  downloads: string[];
  requests: { method: string; path: string }[];
  /** The forms of POST /api/oauth/device, as they came (2.2). */
  deviceRequests: Record<string, string>[];
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** A module package the way `npm run pack` would build it. */
export function buildModuleZip(input: {
  slug: string;
  version: string;
  trail?: string;
  type?: string;
  /** The app's name per language, as the store shows it; the slug by default. */
  title?: Record<string, string>;
  skills?: { name: string; description: string; body?: string }[];
  readme?: string;
  files?: Record<string, string>;
  permissions?: unknown[];
  external_credentials?: unknown[];
  entry?: string;
  rawEntries?: Record<string, string>;
  omitFromFiles?: string[];
}): FakeVersion & { manifest: Record<string, unknown> } {
  const skills = input.skills ?? [{ name: input.slug, description: `Skill de ${input.slug}. Use quando pedirem ${input.slug}.` }];
  const files: Record<string, string> = { "README.md": input.readme ?? `# ${input.slug}\n\nGuia.\n`, ...(input.files ?? {}) };
  for (const skill of skills) {
    files[`skills/${skill.name}/SKILL.md`] = `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.body ?? `# ${skill.name}\n`}`;
  }
  const list = Object.keys(files).sort().filter((file) => !(input.omitFromFiles ?? []).includes(file));
  const manifest = {
    manifest_version: 1,
    name: input.slug,
    version: input.version,
    type: input.type ?? "skill",
    trail: input.trail ?? "divulgar",
    title: input.title ?? { "pt-BR": input.slug },
    summary: { "pt-BR": `Resumo de ${input.slug}.` },
    compatible_ais: ["claude_code", "codex"],
    entry: input.entry ?? `skills/${skills[0].name}/SKILL.md`,
    files: list,
    external_credentials: input.external_credentials ?? [],
    permissions: input.permissions ?? [],
    changelog: { "pt-BR": `Versão ${input.version}.` },
    license: "member",
  };
  const entries: Zippable = { "flyee.module.json": new TextEncoder().encode(JSON.stringify(manifest, null, 2)) };
  for (const [path, content] of Object.entries(files)) entries[path] = new TextEncoder().encode(content);
  for (const [path, content] of Object.entries(input.rawEntries ?? {})) entries[path] = new TextEncoder().encode(content);
  const bytes = zipSync(entries, { level: 6 });
  return { version: input.version, bytes, sha256: sha256(bytes), permissions: input.permissions ?? [], manifest };
}

export class FakePlatform {
  baseUrl = "";
  options: FakeOptions;
  state: FakeState = { installs: [], events: [], revoked: [], refreshes: 0, downloads: [], requests: [], deviceRequests: [] };
  /** The account's one cloud place (4.2): the device holding it, outside the computers' limit. */
  private cloudDevice: string | null = null;
  private server: Server | null = null;
  private tokens = new Map<string, TokenRecord>();
  private refreshIndex = new Map<string, TokenRecord>();
  private deviceCodes = new Map<string, { deviceId: string | null }>();
  private devices = new Set<string>();
  private revokedDevices = new Set<string>();
  /** The token family a revoked computer had: a login with a newer family brings it back (4.2). */
  private revokedFamilies = new Map<string, string>();

  constructor(options: FakeOptions) {
    this.options = { tier: "kit", minCliVersion: "0.1.0", modules: [], recipes: [], deviceLimit: 3, locale: "pt-BR", ...options };
  }

  async start(): Promise<void> {
    this.server = createServer((request, response) => {
      this.handle(request, response).catch((error) => {
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "unavailable", message: String(error) }));
      });
    });
    // Idle connections stay open past any pause of a test: with Node's 5 s default, a CLI child slowed by a busy
    // machine reused a socket the server had just closed and failed with ECONNRESET.
    this.server.keepAliveTimeout = 60_000;
    await new Promise<void>((resolve) => this.server!.listen(0, "127.0.0.1", () => resolve()));
    const address = this.server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    this.baseUrl = `http://127.0.0.1:${port}`;
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
  }

  tierName(): string | null {
    if (this.options.tierName !== undefined) return this.options.tierName;
    return this.options.tier ? (this.options.tier === "pro" ? "FlyeeClub Pro" : "FlyeeClub") : null;
  }

  module(slug: string): FakeModule | undefined {
    return this.options.modules!.find((module) => module.slug === slug);
  }

  publish(slug: string, version: FakeVersion): void {
    const module = this.module(slug);
    if (!module) throw new Error(`no module ${slug}`);
    module.versions.push(version);
  }

  private latest(module: FakeModule): FakeVersion | null {
    return module.versions[module.versions.length - 1] ?? null;
  }

  private versionView(module: FakeModule, version: FakeVersion, entitled: boolean) {
    return {
      version: version.version,
      is_stable: false,
      sha256: version.sha256,
      size_bytes: version.bytes.byteLength,
      published_at: "2026-10-06T00:00:00Z",
      min_core_version: null,
      permissions: version.permissions ?? [],
      changelog: version.changelog ?? `Versão ${version.version}.`,
      status: "published",
      entitled,
      verify_url: `${this.baseUrl}/verificar/${module.slug}%40${version.version}`,
    };
  }

  private moduleView(module: FakeModule) {
    const entitled = module.entitled || Boolean(module.is_free_sample);
    const latest = this.latest(module);
    return {
      slug: module.slug,
      type: module.type,
      trail: module.trail,
      icon: null,
      name: module.name,
      summary: module.summary,
      compatible_ais: ["claude_code", "codex"],
      external_credentials: module.external_credentials ?? [],
      is_free_sample: Boolean(module.is_free_sample),
      entitlement_key: "catalog_access",
      entitled,
      latest: latest ? this.versionView(module, latest, entitled) : null,
      ...(module.newest ? { newest: { ...this.versionView(module, latest!, entitled), version: module.newest, entitled: false } } : {}),
      lessons: [],
    };
  }

  private json(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
    response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers });
    response.end(JSON.stringify(body));
  }

  private deny(response: ServerResponse, status: number, error: string, extra: Record<string, unknown> = {}): void {
    this.json(response, status, { error, message: `fake: ${error}`, ...extra });
  }

  private mint(deviceId: string | null, family?: string): TokenRecord {
    const record: TokenRecord = {
      access: `mcat_${randomBytes(12).toString("hex")}`,
      refresh: `mcrt_${randomBytes(12).toString("hex")}`,
      family: family ?? randomBytes(6).toString("hex"),
      deviceId,
      accessExpiresAt: Date.now() + (this.options.accessTtlSeconds ?? 3600) * 1000,
      refreshExpiresAt: Date.now() + 30 * 86_400_000,
      used: false,
      revoked: false,
    };
    this.tokens.set(record.access, record);
    this.refreshIndex.set(record.refresh, record);
    return record;
  }

  private tokenResponse(record: TokenRecord) {
    return {
      access_token: record.access,
      token_type: "Bearer",
      expires_in: this.options.accessTtlSeconds ?? 3600,
      refresh_token: record.refresh,
      refresh_token_expires_in: 30 * 86_400,
      scope: "profile:read catalog:read modules:download telemetry:write",
    };
  }

  private async readBody(request: IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      let raw = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => (raw += chunk));
      request.on("end", () => resolve(raw));
    });
  }

  private authenticate(request: IncomingMessage, response: ServerResponse): TokenRecord | null {
    const header = request.headers.authorization ?? "";
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    const record = match ? this.tokens.get(match[1]) : undefined;
    if (!record || record.revoked || record.accessExpiresAt <= Date.now()) {
      this.json(response, 401, { error: "invalid_token", message: "fake: invalid_token" }, { "WWW-Authenticate": 'Bearer error="invalid_token"' });
      return null;
    }
    return record;
  }

  /** The member disconnects a computer in the panel: it and its token family stop working (4.2, migration 0044). */
  revokeDevice(deviceId: string): void {
    const family = [...this.tokens.values()].find((token) => token.deviceId === deviceId)?.family;
    for (const token of this.tokens.values()) if (token.deviceId === deviceId) token.revoked = true;
    this.devices.delete(deviceId);
    this.revokedDevices.add(deviceId);
    if (family) this.revokedFamilies.set(deviceId, family);
  }

  private gateDevice(request: IncomingMessage, response: ServerResponse, record: TokenRecord, required: boolean, allowRevoked = false): boolean {
    const header = (request.headers["x-flyee-device"] as string | undefined)?.trim() || null;
    if (record.deviceId && header && header !== record.deviceId) {
      this.deny(response, 403, "device_mismatch");
      return false;
    }
    if (header && this.revokedDevices.has(header) && !allowRevoked) {
      this.deny(response, 403, "device_revoked");
      return false;
    }
    if (required) {
      if (!header) {
        this.deny(response, 400, "device_required");
        return false;
      }
      if (!this.devices.has(header)) {
        this.deny(response, 403, "device_unknown");
        return false;
      }
    }
    return true;
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", this.baseUrl);
    const path = url.pathname;
    const method = request.method ?? "GET";
    this.state.requests.push({ method, path });

    if (path === "/api/cli/version" && method === "GET") {
      return this.json(response, 200, {
        min_cli_version: this.options.minCliVersion,
        latest_core_version: null,
        deprecations: this.options.deprecations ?? [],
        ...(this.options.links ? { links: this.options.links } : {}),
      });
    }

    if (path === "/api/oauth/device" && method === "POST") {
      const form = new URLSearchParams(await this.readBody(request));
      this.state.deviceRequests.push(Object.fromEntries(form));
      if (form.has("cloud") && form.get("cloud") !== "claude_code") return this.deny(response, 400, "invalid_request");
      const deviceCode = `mcdc_${randomBytes(8).toString("hex")}`;
      this.deviceCodes.set(deviceCode, { deviceId: form.get("device_id") });
      return this.json(response, 200, {
        device_code: deviceCode,
        user_code: "ABCD-EFGH",
        verification_uri: `${this.baseUrl}/ativar`,
        verification_uri_complete: `${this.baseUrl}/ativar?code=ABCD-EFGH`,
        expires_in: 600,
        interval: 1,
      });
    }

    if (path === "/api/oauth/token" && method === "POST") {
      const form = new URLSearchParams(await this.readBody(request));
      const grant = form.get("grant_type");
      if (grant === "urn:ietf:params:oauth:grant-type:device_code") {
        const pending = this.deviceCodes.get(form.get("device_code") ?? "");
        if (!pending) return this.json(response, 400, { error: "invalid_grant" });
        this.deviceCodes.delete(form.get("device_code") ?? "");
        return this.json(response, 200, this.tokenResponse(this.mint(pending.deviceId)));
      }
      if (grant === "refresh_token") {
        const record = this.refreshIndex.get(form.get("refresh_token") ?? "");
        if (!record || record.revoked || record.used || record.refreshExpiresAt <= Date.now()) {
          if (record?.used) for (const candidate of this.tokens.values()) if (candidate.family === record.family) candidate.revoked = true;
          return this.json(response, 400, { error: "invalid_grant", error_uri: `${this.baseUrl}/revalidar?d=${record?.deviceId ?? ""}` });
        }
        record.used = true;
        record.revoked = true;
        this.state.refreshes += 1;
        return this.json(response, 200, this.tokenResponse(this.mint(record.deviceId, record.family)));
      }
      return this.json(response, 400, { error: "unsupported_grant_type" });
    }

    if (path === "/api/oauth/revoke" && method === "POST") {
      const form = new URLSearchParams(await this.readBody(request));
      const token = form.get("token") ?? "";
      const record = this.tokens.get(token) ?? this.refreshIndex.get(token);
      if (record) for (const candidate of this.tokens.values()) if (candidate.family === record.family) candidate.revoked = true;
      this.state.revoked.push(token);
      return this.json(response, 200, {});
    }

    if (path.startsWith("/storage/") && method === "GET") {
      const file = path.slice("/storage/".length);
      for (const module of this.options.modules!) {
        for (const version of module.versions) {
          if (file === `${module.slug}-${version.version}.zip`) {
            const bytes = this.options.corruptDownload ? new Uint8Array([...version.bytes.slice(0, -1), version.bytes[version.bytes.length - 1] ^ 0xff]) : version.bytes;
            response.writeHead(200, { "Content-Type": "application/zip", "Content-Length": String(bytes.byteLength) });
            return void response.end(Buffer.from(bytes));
          }
        }
      }
      response.writeHead(404);
      return void response.end();
    }

    if (!path.startsWith("/api/cli/")) {
      response.writeHead(404);
      return void response.end();
    }

    const record = this.authenticate(request, response);
    if (!record) return;
    const deviceHeader = (request.headers["x-flyee-device"] as string | undefined)?.trim() || record.deviceId;

    if (path === "/api/cli/me" && method === "GET") {
      if (!this.gateDevice(request, response, record, false)) return;
      return this.json(response, 200, {
        member: { id: "m1", name: "Ana", segment: "dev", ai_tool: "claude_code", locale: this.options.locale },
        workspace: { id: "w1", name: "Ana" },
        access: { active: this.options.accessActive ?? true, suspended: this.options.suspended ?? false, tier: this.options.tier, tier_name: this.tierName(), limits: { catalog_access: this.options.tier ? 1 : 0, devices: this.options.deviceLimit } },
        token: { family_id: record.family, refresh_expires_at: new Date(record.refreshExpiresAt).toISOString(), days_until_revalidation: 30 },
        device: deviceHeader ? { device_id: deviceHeader, name: "fake", registered: this.devices.has(deviceHeader), last_update_at: null } : null,
        cli: { min_cli_version: this.options.minCliVersion, latest_core_version: null, deprecations: this.options.deprecations ?? [], ...(this.options.links ? { links: this.options.links } : {}) },
        revalidate_url: `${this.baseUrl}/revalidar?d=${deviceHeader ?? ""}`,
        links: { billing: `${this.baseUrl}/settings/billing?source=cli`, devices: `${this.baseUrl}/settings/devices` },
      });
    }

    if (path === "/api/cli/installs" && method === "POST") {
      // The one route that takes a revoked computer (allowRevokedDevice): a newer token family revives it.
      if (!this.gateDevice(request, response, record, false, true)) return;
      const body = JSON.parse((await this.readBody(request)) || "{}") as { device_id?: string; cloud?: unknown };
      if (!body.device_id) return this.deny(response, 400, "invalid_request");
      if (this.revokedDevices.has(body.device_id)) {
        if (this.revokedFamilies.get(body.device_id) === record.family) return this.deny(response, 403, "device_revoked");
        this.revokedDevices.delete(body.device_id);
        this.revokedFamilies.delete(body.device_id);
      }
      if (body.cloud !== undefined && body.cloud !== "claude_code") return this.deny(response, 400, "invalid_request");
      const created = !this.devices.has(body.device_id);
      // 4.2: a cloud session holds the account's one cloud place, outside the computers' limit; a newer one replaces it.
      const cloud = created ? body.cloud === "claude_code" && (this.options.cloudSessions ?? 1) > 0 : this.cloudDevice === body.device_id;
      const computers = () => this.devices.size - (this.cloudDevice ? 1 : 0);
      if (created && cloud) {
        if (this.cloudDevice) {
          this.devices.delete(this.cloudDevice);
          this.revokedDevices.add(this.cloudDevice);
        }
        this.cloudDevice = body.device_id;
      } else if (created && computers() >= (this.options.deviceLimit ?? 3)) {
        return this.deny(response, 409, "device_limit_reached", { limit: this.options.deviceLimit, live_devices: computers(), action_url: `${this.baseUrl}/settings/devices` });
      }
      this.devices.add(body.device_id);
      if (!record.deviceId) record.deviceId = body.device_id;
      this.state.installs.push(body);
      return this.json(response, created ? 201 : 200, { status: created ? "created" : "updated", device: { device_id: body.device_id, cloud: cloud ? "claude_code" : null }, limit: this.options.deviceLimit, live_devices: computers() });
    }

    if (path === "/api/cli/catalog" && method === "GET") {
      if (!this.gateDevice(request, response, record, true)) return;
      return this.json(response, 200, {
        locale: this.options.locale,
        channel: this.options.tier ? "latest" : "free",
        trails: [{ slug: "divulgar", name: "Divulgar", description: null, icon: null }],
        modules: this.options.modules!.map((module) => this.moduleView(module)),
        recipes: this.options.recipes!.map((recipe) => ({ slug: recipe.slug, name: recipe.name, summary: null, icon: null, modules: recipe.modules })),
      });
    }

    const download = /^\/api\/cli\/modules\/([^/]+)\/versions\/([^/]+)\/download$/.exec(path);
    if (download && method === "GET") {
      if (!this.gateDevice(request, response, record, true)) return;
      const module = this.module(decodeURIComponent(download[1]));
      const version = module?.versions.find((candidate) => candidate.version === decodeURIComponent(download[2]));
      if (!module || !version) return this.deny(response, 404, "not_found");
      if (!(module.entitled || module.is_free_sample)) {
        return this.deny(response, 403, "denied_entitlement", { action_url: `${this.baseUrl}/settings/billing?source=cli` });
      }
      this.state.downloads.push(`${module.slug}@${version.version}`);
      return this.json(response, 200, {
        slug: module.slug,
        version: version.version,
        url: `${this.baseUrl}/storage/${module.slug}-${version.version}.zip`,
        expires_in: 300,
        sha256: version.sha256,
        size_bytes: version.bytes.byteLength,
        manifest: {},
        verify_url: `${this.baseUrl}/verificar/${module.slug}%40${version.version}`,
      });
    }

    const detail = /^\/api\/cli\/modules\/([^/]+)$/.exec(path);
    if (detail && method === "GET") {
      if (!this.gateDevice(request, response, record, false)) return;
      const module = this.module(decodeURIComponent(detail[1]));
      if (!module) return this.deny(response, 404, "not_found");
      const view = this.moduleView(module);
      return this.json(response, 200, { ...view, versions: module.versions.map((version) => this.versionView(module, version, view.entitled)).reverse() });
    }

    const recipe = /^\/api\/cli\/recipes\/([^/]+)$/.exec(path);
    if (recipe && method === "GET") {
      if (!this.gateDevice(request, response, record, false)) return;
      const found = this.options.recipes!.find((candidate) => candidate.slug === decodeURIComponent(recipe[1]));
      if (!found) return this.deny(response, 404, "not_found");
      return this.json(response, 200, {
        slug: found.slug,
        name: found.name,
        summary: null,
        entitled: found.entitled,
        workflow: found.entitled ? found.workflow : null,
        ...(found.entitled ? {} : { upgrade_url: `${this.baseUrl}/settings/billing?source=cli` }),
        modules: found.modules.map((slug) => this.moduleView(this.module(slug)!)),
      });
    }

    if (path === "/api/cli/events" && method === "POST") {
      if (!this.gateDevice(request, response, record, true)) return;
      const body = JSON.parse((await this.readBody(request)) || "{}") as { events?: Record<string, unknown>[] };
      if (!Array.isArray(body.events) || body.events.length === 0 || body.events.length > 50) return this.deny(response, 400, "invalid_request");
      this.state.events.push(...body.events);
      return this.json(response, 200, { accepted: body.events.length, dropped: 0 });
    }

    this.deny(response, 404, "not_found");
  }
}

export async function startFakePlatform(options: FakeOptions = {}): Promise<FakePlatform> {
  const platform = new FakePlatform(options);
  await platform.start();
  return platform;
}
