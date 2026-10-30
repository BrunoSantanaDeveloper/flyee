import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { downloadThumbnail, nodeHonorsEnvProxy, proxyRelaunchEnv } from "../scripts/lib/thumbnails.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/research.mjs", import.meta.url));

/** A fetch that answers by the size in the address: `sizes` maps a size name to [status, type, bytes]. */
function fakeFetch(sizes, calls = []) {
  return async (url) => {
    calls.push(url);
    const name = /\/([a-z0-9]+)\.jpg$/.exec(url)[1];
    const [status, type, bytes] = sizes[name] ?? [404, "text/html", 10];
    return new Response(new Uint8Array(bytes), { status, headers: { "content-type": type } });
  };
}

test("the thumbnail comes in the largest size YouTube has; a missing size is skipped", async () => {
  const calls = [];
  const got = await downloadThumbnail("abcdefghijk", { fetchImpl: fakeFetch({ sddefault: [200, "image/jpeg", 4000] }, calls) });
  assert.deepEqual(calls.map((url) => url.split("/").pop()), ["maxresdefault.jpg", "hq720.jpg", "sddefault.jpg"]);
  assert.equal(got.quality, "sddefault");
  assert.equal(got.letterboxed, true, "a 4:3 size has bands above and below");
  assert.equal(got.bytes.length, 4000);
  assert.equal(got.url, "https://i.ytimg.com/vi/abcdefghijk/sddefault.jpg");
  const big = await downloadThumbnail("abcdefghijk", { fetchImpl: fakeFetch({ maxresdefault: [200, "image/jpeg", 50000] }) });
  assert.deepEqual([big.quality, big.width, big.height, big.letterboxed], ["maxresdefault", 1280, 720, false]);
  const placeholder = await downloadThumbnail("abcdefghijk", { fetchImpl: fakeFetch({ maxresdefault: [200, "image/jpeg", 500], hqdefault: [200, "image/jpeg", 9000] }) });
  assert.equal(placeholder.quality, "hqdefault", "a tiny gray image is YouTube's placeholder, not a thumbnail");
  const page = await downloadThumbnail("abcdefghijk", { fetchImpl: fakeFetch({ maxresdefault: [200, "text/html", 9000], hq720: [200, "image/jpeg", 9000] }) });
  assert.equal(page.quality, "hq720", "an answer that is not an image is skipped");
});

test("a thumbnail that does not come says why, with the codes other apps already read", async () => {
  await assert.rejects(downloadThumbnail("abcdefghijk", { fetchImpl: fakeFetch({}) }), (error) => error.code === "not_found");
  await assert.rejects(downloadThumbnail("abcdefghijk", { fetchImpl: fakeFetch({ maxresdefault: [429, "text/html", 10] }) }), (error) => error.code === "rate_limited");
  await assert.rejects(downloadThumbnail("abcdefghijk", { fetchImpl: fakeFetch({ maxresdefault: [500, "text/html", 10] }) }), (error) => error.code === "offline" && /HTTP 500/.test(error.message));
  const down = async () => {
    throw new TypeError("fetch failed");
  };
  await assert.rejects(downloadThumbnail("abcdefghijk", { fetchImpl: down }), (error) => error.code === "offline" && Boolean(error.fix));
  const slow = async () => {
    throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
  };
  await assert.rejects(downloadThumbnail("abcdefghijk", { fetchImpl: slow }), (error) => error.code === "offline" && /a tempo/.test(error.message));
});

test("behind an http(s) proxy the download runs again with NODE_USE_ENV_PROXY, never in a loop", () => {
  assert.equal(proxyRelaunchEnv({}, "24.1.0"), null);
  assert.equal(proxyRelaunchEnv({ HTTPS_PROXY: "http://proxy:3128" }, "24.1.0").NODE_USE_ENV_PROXY, "1");
  assert.equal(proxyRelaunchEnv({ https_proxy: "http://proxy:3128", NODE_USE_ENV_PROXY: "1" }, "24.1.0"), null, "the second run does not start a third");
  assert.equal(proxyRelaunchEnv({ HTTPS_PROXY: "http://proxy:3128" }, "22.20.0"), null, "a Node that ignores the variable gains nothing");
  assert.ok(proxyRelaunchEnv({ HTTP_PROXY: "http://proxy:3128" }, "22.21.0"));
  assert.equal(proxyRelaunchEnv({ HTTPS_PROXY: "socks5h://proxy:1080" }, "24.1.0"), null);
  assert.equal(proxyRelaunchEnv({ HTTPS_PROXY: "127.0.0.1:7890" }, "24.1.0"), null);
  assert.deepEqual([nodeHonorsEnvProxy("20.18.0"), nodeHonorsEnvProxy("22.21.0"), nodeHonorsEnvProxy("25.0.0")], [false, true, true]);
});

/** The environment of this process without a proxy, so the command runs here and reads only the saved images. */
function plainEnv() {
  const env = { ...process.env };
  for (const name of ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "NODE_USE_ENV_PROXY"]) delete env[name];
  return env;
}

test("thumbnails --channel brings the latest uploads of a channel already read, with each multiplier, and a page side by side", () => {
  const root = mkdtempSync(join(tmpdir(), "yr-thumbs-"));
  try {
    const channel = join(root, "youtube-research", "channels", "meucanal");
    mkdirSync(channel, { recursive: true });
    const items = [
      ["a1aaaaaaaaa", "Testei 5 panelas por 30 dias", 3.1],
      ["a2aaaaaaaaa", "O erro que estraga o arroz", 0.6],
      ["a3aaaaaaaaa", "Minha rotina de domingo", 0.9],
    ].map(([id, title, multiplier]) => ({ id, url: `https://youtu.be/${id}`, title, views: 1000, multiplier, band: multiplier >= 3 ? "outlier" : "normal" }));
    writeFileSync(join(channel, "channel.json"), JSON.stringify({ ok: true, command: "channel", created_at: new Date().toISOString(), channel: { name: "Meu Canal", handle: "@meucanal" }, median_views: 1000, items }));
    for (const { id } of items.slice(0, 2)) {
      const dir = join(root, "youtube-research", "videos", id);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "thumbnail.jpg"), Buffer.alloc(2000, 1));
      writeFileSync(join(dir, "thumbnail.json"), JSON.stringify({ quality: "maxresdefault", width: 1280, height: 720, letterboxed: false, url: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, fetched_at: new Date().toISOString() }));
    }
    const out = JSON.parse(execFileSync(process.execPath, [SCRIPT, "thumbnails", "--channel", "@meucanal", "--limit", "2", "--json"], { cwd: root, encoding: "utf8", env: plainEnv() }));
    assert.equal(out.source, "channel");
    assert.equal(out.channel.name, "Meu Canal");
    assert.deepEqual(out.items.map((item) => [item.ok, item.id, item.multiplier, item.cached]), [[true, "a1aaaaaaaaa", 3.1, true], [true, "a2aaaaaaaaa", 0.6, true]]);
    assert.equal(out.items[0].file.replace(/\\/g, "/"), "youtube-research/videos/a1aaaaaaaaa/thumbnail.jpg");
    assert.equal(out.items[0].title, "Testei 5 panelas por 30 dias");
    assert.equal(out.files.md.replace(/\\/g, "/"), "youtube-research/channels/meucanal/thumbnails.md");
    const md = readFileSync(join(channel, "thumbnails.md"), "utf8");
    assert.match(md, /^# Thumbnails: Meu Canal\n/);
    assert.match(md, /\| !\[\]\(\.\.\/\.\.\/videos\/a1aaaaaaaaa\/thumbnail\.jpg\) \| 3,1× \| Testei 5 panelas por 30 dias \|/);
    assert.match(md, /não a causa/);
    assert.doesNotMatch(md, /[–—]/u);
    const both = () => execFileSync(process.execPath, [SCRIPT, "thumbnails", "a1aaaaaaaaa", "--channel", "@meucanal", "--json"], { cwd: root, encoding: "utf8", stdio: "pipe", env: plainEnv() });
    assert.throws(both, (error) => error.status === 2 && JSON.parse(error.stdout).error.code === "usage");
    const none = () => execFileSync(process.execPath, [SCRIPT, "thumbnails", "--json"], { cwd: root, encoding: "utf8", stdio: "pipe", env: plainEnv() });
    assert.throws(none, (error) => error.status === 2 && JSON.parse(error.stdout).error.code === "usage");
    const wrong = () => execFileSync(process.execPath, [SCRIPT, "thumbnails", "isto-nao-e-video", "--json"], { cwd: root, encoding: "utf8", stdio: "pipe", env: plainEnv() });
    assert.throws(wrong, (error) => error.status === 1 && JSON.parse(error.stdout).error.code === "not_youtube");
    const listed = JSON.parse(execFileSync(process.execPath, [SCRIPT, "list", "--json"], { cwd: root, encoding: "utf8", env: plainEnv() }));
    assert.ok(listed.videos.find((video) => video.id === "a1aaaaaaaaa").thumbnail);
    assert.ok(!existsSync(join(root, "youtube-research", "videos", "a3aaaaaaaaa")), "--limit 2 leaves the third upload alone");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
