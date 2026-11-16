// The late cookie window: a consent window that a script opens seconds after the load is found on a
// fast machine too, and a page that never opens one costs at most the waiting window.

import assert from "node:assert/strict";
import test from "node:test";

import { dismissLateCookies, LATE_COOKIE_WINDOW_MS } from "../scripts/lib/capture.mjs";

/** A page whose consent window opens `opensAfterMs` after `loadedAt`, or never. */
function fakePage({ loadedAt, opensAfterMs = null }) {
  let looks = 0;
  return {
    looks: () => looks,
    async evaluate(source) {
      // dismissCookies first asks for a click, then whether the button is gone.
      if (/cookieButtonHiddenInPage/.test(String(source))) return true;
      looks += 1;
      const open = opensAfterMs !== null && Date.now() - loadedAt >= opensAfterMs;
      return open ? { clicked: true, text: "Aceitar todos", candidates: 1 } : { clicked: false, candidates: 0 };
    },
  };
}

test("a window that opens 1.5 s after the load is closed even when the capture is already past its warm-up", async () => {
  const loadedAt = Date.now();
  const page = fakePage({ loadedAt, opensAfterMs: 1500 });
  const result = await dismissLateCookies(page, { dismissed: false, button: null, candidates: 0 }, () => {}, { loadedAt });
  assert.equal(result.dismissed, true);
  assert.equal(result.late, true);
  assert.equal(result.button, "Aceitar todos");
  assert.ok(Date.now() - loadedAt >= 1500);
  assert.ok(page.looks() > 1, "it kept looking instead of giving up after one try");
});

test("a page with no window waits only until the end of the window, then answers what the first look found", async () => {
  const loadedAt = Date.now() - (LATE_COOKIE_WINDOW_MS - 600);
  const first = { dismissed: false, button: null, candidates: 0 };
  const started = Date.now();
  const result = await dismissLateCookies(fakePage({ loadedAt }), first, () => {}, { loadedAt });
  const waited = Date.now() - started;
  assert.equal(result, first);
  assert.ok(waited >= 500 && waited < 2500, `waited ${waited} ms`);
});

test("past the window, one look and no wait; a window already closed is kept as it was", async () => {
  const loadedAt = Date.now() - LATE_COOKIE_WINDOW_MS - 1000;
  const page = fakePage({ loadedAt });
  const started = Date.now();
  await dismissLateCookies(page, null, () => {}, { loadedAt });
  assert.equal(page.looks(), 1);
  assert.ok(Date.now() - started < 400);
  const closed = { dismissed: true, button: "Aceitar", candidates: 1 };
  assert.equal(await dismissLateCookies(fakePage({ loadedAt }), closed), closed);
  // Without the load time, the old behavior: one more look.
  const once = fakePage({ loadedAt: Date.now() });
  await dismissLateCookies(once, null);
  assert.equal(once.looks(), 1);
});
