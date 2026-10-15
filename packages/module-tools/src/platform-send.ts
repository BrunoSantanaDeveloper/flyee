import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Sends one app to the platform as a DRAFT, with the service token
 * (CLI-CONTRACT.md section 10), in the order of 10.4: the index (10.1), an
 * upload slot (10.2), the ZIP to the slot, the version (10.3). Nothing here
 * publishes: publishing stays a click of the operator in /admin/catalogo.
 *
 * The checksum the platform recomputes must equal the one `npm run pack`
 * wrote; anything else fails the run. A version already in the catalog
 * (409 `version_exists`) is a success, so a rerun of the workflow is harmless.
 * Redirects are never followed: a route that is not live yet answers a
 * redirect to the sign-in page, which is a failure, not an HTML "success".
 */

export type SendInput = {
  slug: string;
  version: string;
  /** The platform, without trailing slash. */
  base: string;
  token: string | undefined;
  /** Where `npm run pack` and `npm run index` wrote: dist/. */
  distDir: string;
  fetch?: typeof fetch;
  log?: (line: string) => void;
  /** GitHub Actions annotations (::warning::, ::error::) when true. */
  actions?: boolean;
};

export type SendResult =
  | { ok: true; outcome: "created" | "exists"; sha256: string; platformSha256: string | null; importSummary: Record<string, number> }
  | { ok: false; step: string; message: string };

type ImportLine = { slug: string; result: string; fields?: string[]; warnings?: string[]; errors?: string[] };

export const MIN_TOKEN_LENGTH = 32;

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text.slice(0, 200) };
  }
}

/** A line for a refused call: the status, the platform's error code, the location of a redirect. */
function refusal(step: string, response: Response, body: unknown): SendResult {
  const location = response.headers.get("location");
  const record = (body ?? {}) as { error?: string; errors?: string[]; raw?: string };
  const detail = location
    ? `redirect to ${location}: the route is not live on this platform yet (deploy the commit that serves section 10)`
    : record.error
      ? `${record.error}${record.errors?.length ? `: ${record.errors.join("; ")}` : ""}`
      : record.raw ?? "no body";
  return { ok: false, step, message: `${step} answered ${response.status}: ${detail}` };
}

export async function sendApp(input: SendInput): Promise<SendResult> {
  const fetchImpl = input.fetch ?? fetch;
  const log = input.log ?? ((line: string) => console.log(line));
  const warn = (line: string) => log(input.actions ? `::warning::${line}` : `warning: ${line}`);
  const token = input.token?.trim() ?? "";
  if (token.length < MIN_TOKEN_LENGTH) {
    return { ok: false, step: "token", message: `FLYEE_SERVICE_TOKEN is missing or shorter than ${MIN_TOKEN_LENGTH} characters; add it to the repository's Actions secrets (the same value the platform has in Vercel)` };
  }
  const auth = { Authorization: `Bearer ${token}` };

  const zipPath = join(input.distDir, "modules", `${input.slug}-${input.version}.zip`);
  const indexPath = join(input.distDir, "index.json");
  if (!existsSync(zipPath)) return { ok: false, step: "package", message: `${zipPath} does not exist; run npm run pack ${input.slug} first` };
  if (!existsSync(indexPath)) return { ok: false, step: "index", message: `${indexPath} does not exist; run npm run index first` };
  const zip = new Uint8Array(readFileSync(zipPath));
  const sha256 = createHash("sha256").update(zip).digest("hex");
  const shaFile = `${zipPath}.sha256`;
  if (existsSync(shaFile) && !readFileSync(shaFile, "utf8").startsWith(sha256)) {
    return { ok: false, step: "package", message: `${shaFile} does not match the ZIP; pack again` };
  }
  log(`Package ${input.slug}@${input.version}: ${zip.byteLength} bytes, sha256 ${sha256}`);

  // 10.1 the index: creates or updates every app's module, never publishes.
  const index = readFileSync(indexPath, "utf8");
  const imported = await fetchImpl(`${input.base}/api/service/catalog/import`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: index,
    redirect: "manual",
  });
  const importBody = (await readJson(imported)) as { apps?: ImportLine[]; summary?: Record<string, number> } | null;
  if (imported.status !== 200) return refusal("import", imported, importBody);
  const summary = importBody?.summary ?? {};
  log(`Import: ${Object.entries(summary).map(([key, count]) => `${count} ${key}`).join(", ") || "no summary"}`);
  for (const line of importBody?.apps ?? []) {
    log(`  ${line.slug}: ${line.result}${line.fields?.length ? ` (${line.fields.join(", ")})` : ""}`);
    for (const warning of line.warnings ?? []) warn(`${line.slug}: ${warning}`);
    for (const error of line.errors ?? []) log(`    error: ${error}`);
  }
  const mine = importBody?.apps?.find((line) => line.slug === input.slug);
  if (mine?.result === "refused") {
    return { ok: false, step: "import", message: `the platform refused ${input.slug}: ${(mine.errors ?? []).join("; ")}` };
  }

  // 10.2 an upload slot.
  const slotResponse = await fetchImpl(`${input.base}/api/service/catalog/uploads`, { method: "POST", headers: auth, redirect: "manual" });
  const slot = (await readJson(slotResponse)) as { staging_path?: string; signed_url?: string; max_bytes?: number } | null;
  if (slotResponse.status !== 200 || !slot?.signed_url || !slot.staging_path) return refusal("uploads", slotResponse, slot);
  if (typeof slot.max_bytes === "number" && zip.byteLength > slot.max_bytes) {
    return { ok: false, step: "uploads", message: `the package has ${zip.byteLength} bytes; the platform takes at most ${slot.max_bytes}` };
  }

  // The ZIP to the slot (a signed address of the storage: no service token there).
  const put = await fetchImpl(slot.signed_url, { method: "PUT", headers: { "Content-Type": "application/zip" }, body: zip, redirect: "manual" });
  if (put.status < 200 || put.status >= 300) return refusal("upload", put, await readJson(put));

  // 10.3 the version, as a draft.
  const finalize = await fetchImpl(`${input.base}/api/service/catalog/versions`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ module: input.slug, staging_path: slot.staging_path }),
    redirect: "manual",
  });
  const finalizeBody = (await readJson(finalize)) as { version?: { sha256?: string; version?: string; status?: string }; error?: string } | null;
  if (finalize.status === 409 && finalizeBody?.error === "version_exists") {
    log(`Version ${input.slug}@${input.version} is already in the catalog: nothing new to send (a rerun is harmless).`);
    return { ok: true, outcome: "exists", sha256, platformSha256: null, importSummary: summary };
  }
  if (finalize.status !== 201) return refusal("versions", finalize, finalizeBody);
  const platformSha256 = finalizeBody?.version?.sha256 ?? null;
  log(`Platform sha256 ${platformSha256 ?? "(none)"}${platformSha256 === sha256 ? ", the same as the pack" : ""}`);
  if (platformSha256 !== sha256) {
    return { ok: false, step: "versions", message: `the platform computed ${platformSha256 ?? "no checksum"} for ${input.slug}@${input.version}; npm run pack wrote ${sha256}` };
  }
  log(`Draft ${input.slug}@${input.version} is in /admin/catalogo/${input.slug}; publishing is the operator's click there.`);
  return { ok: true, outcome: "created", sha256, platformSha256, importSummary: summary };
}
