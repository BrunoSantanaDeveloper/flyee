# The platform contract

- The only dependency on the platform is `flyee-club/docs/CLI-CONTRACT.md` and the manifest JSON Schema pinned in `schemas/flyee.module.schema.json`. Never import code from `C:\AppsProjects\flyee-club`; re-implement rules here with tests (semver as the database orders it, safe package paths, manifest cross-field checks).
- Every `/api/cli/*` call sends `Authorization: Bearer <access>` and `X-Flyee-Device: <device_id>`. The CLI refreshes on 401 once, registers the machine on `device_unknown` and retries once, re-logins on `device_revoked`/`device_mismatch`, and prints the server's `message` and `action_url` as they come. It never builds a platform URL; the only address it knows is the base URL.
- Before any other call the CLI compares its version with `min_cli_version` from `GET /api/cli/version` and refuses to continue below it. `deprecations` are printed as they come.
- Refresh tokens rotate on every use and two concurrent refreshes revoke the family: the CLI serializes refreshes with a lock file under `~/.flyee`.
- Contract section 9 (planned, not served) is read defensively: `newest`, per-version `entitled`, `links.module_page`, `license`, `ai_tool_detail`, `trigger`, manifest v2. The CLI works without any of them.
- Telemetry: only `module.installed`, `module.activated`, `module.updated`, `tool.executed`, `recipe.installed`, with property keys from the allowlist; values are short tokens, never content.
