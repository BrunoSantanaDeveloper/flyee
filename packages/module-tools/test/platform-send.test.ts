import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";

import { sendApp } from "../src/platform-send.ts";

/**
 * The four calls of CLI-CONTRACT.md 10.4 against a stand-in platform: the
 * import, the upload slot, the PUT to the storage's signed address and the
 * version. The platform recomputes the checksum of what it received.
 */

const TOKEN = "t".repeat(40);
let sandbox: string;
let server: Server;
let base = "";
let state: {
  calls: string[];
  stored: Map<string, Buffer>;
  versions: Map<string, string>;
  importAnswer: { status: number; body: unknown; location?: string };
  tamperSha: boolean;
};

const read = (request: IncomingMessage) =>
  new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
  });

before(async () => {
  sandbox = mkdtempSync(join(tmpdir(), "flyee-send-"));
  mkdirSync(join(sandbox, "dist", "modules"), { recursive: true });
  const zip = Buffer.from("PK fake package bytes");
  writeFileSync(join(sandbox, "dist", "modules", "radar-1.0.0.zip"), zip);
  writeFileSync(join(sandbox, "dist", "modules", "radar-1.0.0.zip.sha256"), `${createHash("sha256").update(zip).digest("hex")}  radar-1.0.0.zip\n`);
  writeFileSync(join(sandbox, "dist", "index.json"), JSON.stringify({ generated_at: "x", apps: [{ slug: "radar" }] }));

  server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    state.calls.push(`${request.method} ${url.pathname}`);
    const json = (status: number, body: unknown, headers: Record<string, string> = {}) => {
      response.writeHead(status, { "Content-Type": "application/json", ...headers });
      response.end(JSON.stringify(body));
    };
    if (url.pathname.startsWith("/storage/")) {
      if (request.method !== "PUT" || request.headers["content-type"] !== "application/zip") return json(400, { error: "bad_upload" });
      if (request.headers.authorization) return json(400, { error: "no service token on the storage" });
      state.stored.set(url.pathname, await read(request));
      return json(200, { Key: url.pathname });
    }
    if (request.headers.authorization !== `Bearer ${TOKEN}`) return json(401, { error: "invalid_service_token" });
    if (url.pathname === "/api/service/catalog/import") {
      const body = JSON.parse((await read(request)).toString("utf8"));
      assert.ok(Array.isArray(body.apps), "the index is sent as it is");
      const { status, body: answer, location } = state.importAnswer;
      if (location) {
        response.writeHead(status, { Location: location });
        return response.end();
      }
      return json(status, answer);
    }
    if (url.pathname === "/api/service/catalog/uploads") {
      const path = `/storage/staging/${state.stored.size + 1}.zip`;
      return json(200, { staging_path: path, signed_url: `${base}${path}?token=signed`, token: "signed", max_bytes: 20 * 1024 * 1024 });
    }
    if (url.pathname === "/api/service/catalog/versions") {
      const body = JSON.parse((await read(request)).toString("utf8")) as { module: string; staging_path: string };
      const bytes = state.stored.get(body.staging_path);
      if (!bytes) return json(422, { error: "invalid_package", errors: ["nothing at the staging path"] });
      const key = `${body.module}@1.0.0`;
      if (state.versions.has(key)) return json(409, { error: "version_exists" });
      const sha = state.tamperSha ? "0".repeat(64) : createHash("sha256").update(bytes).digest("hex");
      state.versions.set(key, sha);
      return json(201, { version: { module: body.module, version: "1.0.0", sha256: sha, status: "draft" } });
    }
    return json(404, { error: "not_found" });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

beforeEach(() => {
  state = {
    calls: [],
    stored: new Map(),
    versions: new Map(),
    importAnswer: { status: 200, body: { apps: [{ slug: "radar", result: "updated", fields: ["summary"], warnings: ["description_md: breaks the copy rules (free), left out"] }], summary: { created: 0, updated: 1, unchanged: 0, refused: 0 } } },
    tamperSha: false,
  };
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(sandbox, { recursive: true, force: true });
});

const send = (overrides: Partial<Parameters<typeof sendApp>[0]> = {}) => {
  const lines: string[] = [];
  return sendApp({ slug: "radar", version: "1.0.0", base, token: TOKEN, distDir: join(sandbox, "dist"), log: (line) => lines.push(line), actions: true, ...overrides }).then((result) => ({ result, lines }));
};

describe("sending an app to the platform as a draft", () => {
  it("runs the four calls in the contract's order and checks the checksum the platform computed", async () => {
    const { result, lines } = await send();
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(state.calls.map((call) => call.replace(/\/\d+\.zip$/, "/n.zip")), [
      "POST /api/service/catalog/import",
      "POST /api/service/catalog/uploads",
      "PUT /storage/staging/n.zip",
      "POST /api/service/catalog/versions",
    ]);
    assert.ok(lines.some((line) => line.startsWith("Import: ") && line.includes("1 updated")), lines.join("\n"));
    assert.ok(lines.some((line) => line.startsWith("::warning::radar: description_md")), "warnings become annotations");
    assert.ok(lines.some((line) => /^Platform sha256 [0-9a-f]{64}, the same as the pack$/.test(line)), lines.join("\n"));
    if (result.ok) assert.equal(result.outcome, "created");
  });

  it("treats a version already in the catalog as a success, so a rerun does not fail", async () => {
    await send();
    const again = await send();
    assert.equal(again.result.ok, true, JSON.stringify(again.result));
    if (again.result.ok) assert.equal(again.result.outcome, "exists");
  });

  it("fails when the platform's checksum differs from the pack's", async () => {
    state.tamperSha = true;
    const { result } = await send();
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.step, "versions");
      assert.ok(result.message.includes("npm run pack wrote"));
    }
  });

  it("stops before any call without the token", async () => {
    const { result } = await send({ token: "" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.step, "token");
    assert.deepEqual(state.calls, []);
  });

  it("never follows a redirect: a route that is not live yet sends to the sign-in page", async () => {
    state.importAnswer = { status: 307, body: null, location: "/auth/sign-in?next=%2Fapi%2Fservice%2Fcatalog%2Fimport" };
    const { result } = await send();
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.step, "import");
      assert.ok(result.message.includes("redirect") && result.message.includes("not live"), result.message);
    }
    assert.equal(state.calls.length, 1, "nothing after the import");
  });

  it("stops when the platform refuses this app in the import", async () => {
    state.importAnswer = { status: 200, body: { apps: [{ slug: "radar", result: "refused", errors: ["title.pt-BR: breaks the copy rules (dash), left out"] }], summary: { refused: 1 } } };
    const { result } = await send();
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.message.includes("refused radar"));
  });

  it("says a wrong token is a 401 from the platform", async () => {
    const { result } = await send({ token: "x".repeat(40) });
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.message.includes("401") && result.message.includes("invalid_service_token"), result.message);
  });
});
