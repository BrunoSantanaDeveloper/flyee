/**
 * The contract as the CLI reads it (CLI-CONTRACT.md v1). Fields the server may
 * add later are optional; the CLI ignores what it does not know.
 */

export type Localized = Record<string, string | undefined>;

export type VersionInfo = {
  min_cli_version: string;
  latest_core_version: string | null;
  deprecations: unknown[];
  /** CLI-CONTRACT.md 4.9 (since 2026-10-08): an app's public page as a template with {slug}, in Portuguese and in English. */
  links?: { module_page?: string; module_page_en?: string; [key: string]: string | undefined };
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
  scope: string;
};

export type DeviceAuthorization = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
};

export type Me = {
  member: { id: string; name: string | null; segment: string | null; ai_tool: string | null; locale: string };
  workspace: { id: string; name: string | null };
  /** `tier` is what the code decides on; `tier_name` is what the CLI shows (CLI-CONTRACT.md 4.1, since 2026-10-08). */
  access: { active: boolean; suspended: boolean; tier: string | null; tier_name?: string | null; limits: Record<string, unknown> };
  token: { family_id: string | null; refresh_expires_at: string | null; days_until_revalidation: number | null };
  device: { device_id: string; name: string | null; registered: boolean; last_update_at: string | null } | null;
  cli: VersionInfo;
  revalidate_url: string;
  links: { billing: string; devices: string };
};

export type CatalogPermission = { kind: string; scope: string; reason: Localized };
export type CatalogCredential = { name: string; env: string; url?: string; required: boolean; purpose?: Localized };

export type CatalogVersion = {
  version: string;
  is_stable: boolean;
  sha256: string;
  size_bytes: number;
  published_at: string | null;
  min_core_version: string | null;
  permissions: CatalogPermission[];
  changelog?: string | null;
  status?: string;
  entitled?: boolean;
  verify_url?: string;
};

export type CatalogModule = {
  slug: string;
  type: string;
  trail: string;
  icon: string | null;
  name: string;
  summary: string | null;
  description?: string | null;
  compatible_ais: string[];
  external_credentials: CatalogCredential[];
  is_free_sample: boolean;
  entitlement_key: string;
  entitled: boolean;
  latest: CatalogVersion | null;
  /** Planned (section 9): the newest published version for any account. */
  newest?: CatalogVersion | null;
  lessons?: unknown[];
};

export type Catalog = {
  locale: string;
  channel: string;
  trails: { slug: string; name: string; description: string | null; icon: string | null }[];
  modules: CatalogModule[];
  recipes: { slug: string; name: string; summary: string | null; icon: string | null; modules: string[] }[];
};

export type ModuleDetail = CatalogModule & { versions: CatalogVersion[] };

export type DownloadInfo = {
  slug: string;
  version: string;
  url: string;
  expires_in: number;
  sha256: string;
  size_bytes: number;
  manifest: Record<string, unknown>;
  verify_url: string;
  /** Planned (section 9). */
  license?: string;
};

export type Recipe = {
  slug: string;
  name: string;
  summary: string | null;
  entitled: boolean;
  workflow: string | null;
  upgrade_url?: string;
  modules: CatalogModule[];
};

export type InstallsPayload = {
  device_id: string;
  name?: string;
  os?: "windows" | "macos" | "linux" | "other";
  os_version?: string;
  ai_tool?: string;
  ai_tool_detail?: string;
  cli_version?: string;
  core_version?: string;
  installed_modules?: { slug: string; version: string }[];
  project_kind?: "own" | "client";
  updated?: boolean;
};

export type InstallsResponse = {
  status: "created" | "updated" | string;
  device: Record<string, unknown>;
  limit: number;
  live_devices: number;
};

export type EventsResponse = { accepted: number; dropped: number };

export type ErrorBody = {
  error: string;
  message?: string;
  action_url?: string;
  error_uri?: string;
  error_description?: string;
  [key: string]: unknown;
};
