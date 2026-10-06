import { createServer, type IncomingMessage, type Server } from "node:http";
import { connect } from "node:net";

import type { Context } from "./context.ts";
import { t } from "./i18n.ts";
import { keysPath, readKeys, writeKeys } from "./state/keys.ts";

/**
 * The key page: the member pastes an app's key in their own browser instead of
 * a terminal. A one-use server on 127.0.0.1 serves a form behind a random
 * token, checks the Host header (no DNS rebinding), saves the key into
 * `~/.flyee/keys.json` and stops. The key never passes through the AI's
 * conversation, a command line or the terminal history.
 */

export type KeyPageInfo = { label?: string; url?: string; apps?: string[] };
export type KeyPageResult = { saved: boolean; length?: number };

export const KEY_PAGE_TTL_MS = 15 * 60_000;
const MAX_BODY = 16 * 1024;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

function page(ctx: Context, title: string, body: string): string {
  return `<!doctype html><html lang="${ctx.locale === "en" ? "en" : "pt-BR"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f6f5f2;color:#1d1d1b;margin:0;padding:24px}
main{max-width:520px;margin:8vh auto;background:#fff;border-radius:14px;padding:28px;box-shadow:0 2px 16px rgba(0,0,0,.08)}
h1{font-size:1.3rem;margin:0 0 12px}p{line-height:1.5}label{display:block;font-weight:600;margin:18px 0 6px}
input{width:100%;box-sizing:border-box;padding:12px;font-size:1rem;border:1px solid #c9c6bf;border-radius:8px;font-family:ui-monospace,monospace}
button{margin-top:16px;padding:12px 20px;font-size:1rem;border:0;border-radius:8px;background:#1d1d1b;color:#fff;cursor:pointer}
small{color:#5c5a55}a{color:#1d1d1b}
@media (prefers-color-scheme:dark){body{background:#151513;color:#eceae4}main{background:#22221f}input{background:#151513;color:#eceae4;border-color:#4a4843}button{background:#eceae4;color:#151513}small{color:#a8a59d}a{color:#eceae4}}
</style></head><body><main>${body}</main></body></html>`;
}

function formPage(ctx: Context, name: string, info: KeyPageInfo): string {
  const where = info.url && /^https:\/\//.test(info.url) ? `<p>${escapeHtml(t(ctx, "keypage.where"))} <a href="${escapeHtml(info.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(info.url)}</a></p>` : "";
  const apps = info.apps?.length ? `<p><small>${escapeHtml(t(ctx, "keypage.used_by", { apps: info.apps.join(", ") }))}</small></p>` : "";
  return page(
    ctx,
    t(ctx, "keypage.title", { name }),
    `<h1>${escapeHtml(t(ctx, "keypage.title", { name }))}</h1>
<p>${escapeHtml(t(ctx, "keypage.intro", { file: keysPath(ctx) }))}</p>${where}${apps}
<form method="post" autocomplete="off"><label for="value">${escapeHtml(info.label ?? name)}</label>
<input id="value" name="value" type="password" autofocus required spellcheck="false" autocapitalize="off">
<button type="submit">${escapeHtml(t(ctx, "keypage.button"))}</button></form>`,
  );
}

async function readBody(request: IncomingMessage): Promise<string | null> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) return null;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Serves the page until the key is saved or the time runs out. `port` 0 picks
 * a free one; `onListening` receives the address to open.
 */
export function serveKeyPage(
  ctx: Context,
  name: string,
  options: { port: number; token: string; info?: KeyPageInfo; timeoutMs?: number; onListening?: (url: string) => void },
): Promise<KeyPageResult> {
  return new Promise((resolve, reject) => {
    let server: Server;
    let port = options.port;
    let finished = false;
    const finish = (result: KeyPageResult) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      setTimeout(() => server.close(), 100).unref();
      resolve(result);
    };
    const headers = {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    };
    server = createServer(async (request, response) => {
      if (request.headers.host !== `127.0.0.1:${port}`) {
        response.writeHead(400).end();
        return;
      }
      if ((request.url ?? "").split("?")[0] !== `/k/${options.token}`) {
        response.writeHead(404).end();
        return;
      }
      if (request.method === "GET") {
        response.writeHead(200, headers).end(formPage(ctx, name, options.info ?? {}));
        return;
      }
      if (request.method !== "POST" || finished) {
        response.writeHead(405).end();
        return;
      }
      const body = await readBody(request);
      const value = body === null ? "" : (new URLSearchParams(body).get("value") ?? "").trim();
      if (!value || /[\r\n]/.test(value) || value.length > 4096) {
        response.writeHead(400, headers).end(page(ctx, t(ctx, "keypage.title", { name }), `<p>${escapeHtml(t(ctx, "keypage.invalid"))}</p>`));
        return;
      }
      const store = readKeys(ctx);
      store.keys[name] = value;
      writeKeys(ctx, store);
      response.writeHead(200, headers).end(page(ctx, t(ctx, "keypage.title", { name }), `<h1>${escapeHtml(t(ctx, "keypage.saved", { name }))}</h1>`));
      finish({ saved: true, length: value.length });
    });
    const timer = setTimeout(() => finish({ saved: false }), options.timeoutMs ?? KEY_PAGE_TTL_MS);
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      port = typeof address === "object" && address ? address.port : port;
      options.onListening?.(`http://127.0.0.1:${port}/k/${options.token}`);
    });
  });
}

/** A port nobody listens on right now, for the detached page process. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

/** Waits until something accepts connections on the port, up to `timeoutMs`. */
export async function waitForPort(port: number, timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const open = await new Promise<boolean>((resolve) => {
      const socket = connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (open) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}
