import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { apifyApi, apifyKey, chargeCeiling, chargedUsd, classifyApifyError, DEFAULT_API, estimateUsd } from "../scripts/lib/apify.mjs";
import { actorFailure, normalizeComment, normalizePost, parseCount, parsePost, parseProfile } from "../scripts/lib/instagram.mjs";
import { readingToPosts } from "../scripts/lib/reading.mjs";
import { csvValue, postsCsv } from "../scripts/lib/report.mjs";
import { baselineOf, measureProfile, scorePost } from "../scripts/lib/score.mjs";
import { COLLECTED_AT, COMMENTS, profileA, profileB } from "./fixtures/posts.mjs";

const posts = (items) => items.map((item) => normalizePost(item, { collectedAt: COLLECTED_AT }));

test("parseCount reads counts the way the Instagram app writes them, in Portuguese and English", () => {
  const cases = { "987": 987, "12.345": 12345, "12,345": 12345, "12,3 mil": 12300, "1,2 mi": 1200000, "12.3K": 12300, "1M": 1000000, "1 milhão": 1000000, "12,3 mil visualizações": 12300, "4,5 mil plays": 4500 };
  for (const [text, value] of Object.entries(cases)) assert.equal(parseCount(text), value, text);
  for (const text of ["12,3", "abc", "", "1.2.3,4 mil", "-5"]) assert.equal(parseCount(text), null, text);
});

test("parseProfile accepts @, bare names and profile addresses, and refuses posts", () => {
  assert.equal(parseProfile("@Perfil.A"), "perfil.a");
  assert.equal(parseProfile("https://www.instagram.com/perfil_b/?hl=pt"), "perfil_b");
  assert.throws(() => parseProfile("https://www.instagram.com/reel/ABCdef123/"), { code: "usage" });
  assert.throws(() => parseProfile("reels"), { code: "usage" });
  assert.throws(() => parseProfile("nome com espaço"), { code: "usage" });
});

test("parsePost takes post and Reels addresses and short codes", () => {
  assert.deepEqual(parsePost("https://www.instagram.com/reel/ABCdef123/?igsh=x"), { shortcode: "ABCdef123", url: "https://www.instagram.com/p/ABCdef123/" });
  assert.equal(parsePost("ABCdef123").shortcode, "ABCdef123");
  assert.throws(() => parsePost("perfil.a"), { code: "usage" });
});

test("normalizePost keeps hidden likes unknown, marks paid partnerships and splits Reels from static posts", () => {
  const [, , , hidden, , , paid] = posts(profileA());
  assert.equal(hidden.likes, null);
  assert.equal(hidden.hidden_likes, true);
  assert.equal(paid.ad, true);
  const still = posts(profileA())[8];
  assert.equal(still.kind, "static");
  assert.equal(still.plays, null);
  assert.equal(normalizePost({ type: "Video", shortCode: "XXXXX1", videoViewCount: 77 }, { collectedAt: COLLECTED_AT }).plays, 77);
});

test("normalizeComment drops the name of whoever wrote it", () => {
  const comment = normalizeComment(COMMENTS[0]);
  assert.equal(comment.text, "Isso serve para quem atende sozinha?");
  assert.equal(JSON.stringify(comment).includes("alguem"), false);
});

test("baselineOf: measured from 5 posts, indication from 3, none below", () => {
  assert.deepEqual(baselineOf(posts(profileA()).filter((post) => post.kind === "reel")), { value: 107.5, n: 8, status: "measured" });
  assert.equal(baselineOf(posts(profileB())).status, "indication");
  assert.equal(baselineOf(posts(profileB()).slice(0, 2)).status, "none");
});

test("scorePost flags hidden likes, comment bait, paid partnerships, young and old posts", () => {
  const measured = measureProfile(posts(profileA()));
  const byId = new Map(measured.reels.map((reel) => [reel.id, reel]));
  assert.equal(byId.get("AAAAA5").multiplier, 13.95);
  assert.equal(byId.get("AAAAA5").band, "explosive");
  assert.equal(byId.get("AAAAA8").band, "outlier");
  assert.ok(byId.get("AAAAA4").flags.includes("hidden_likes"));
  assert.equal(byId.get("AAAAA4").engagement, null);
  assert.ok(byId.get("AAAAA6").flags.includes("dm_bait"));
  assert.ok(byId.get("AAAAA7").flags.includes("ad"));
  assert.ok(byId.get("AAAAA7").flags.includes("maturing"));
  assert.ok(byId.get("AAAAA8").flags.includes("old"));
  const indication = measureProfile(posts(profileB()));
  assert.ok(indication.reels.every((reel) => reel.flags.includes("indication")));
  assert.equal(scorePost(posts(profileB())[0], { value: null, n: 0, status: "none" }).multiplier, null);
});

test("measureProfile never ranks Reels and static posts together, and buckets Reels by duration", () => {
  const measured = measureProfile(posts(profileA()));
  assert.equal(measured.reels.length, 8);
  assert.equal(measured.static.length, 2);
  assert.ok(measured.reels.every((post) => post.kind === "reel"));
  assert.equal(measured.baseline.static.status, "none");
  const buckets = Object.fromEntries(measured.durations.map((bucket) => [bucket.id, bucket.n]));
  assert.deepEqual(buckets, { up_to_20s: 5, "21_to_60s": 2, over_60s: 1 });
});

test("the spreadsheet neutralizes text that would run as a formula and writes decimal commas", () => {
  assert.equal(csvValue("=SOMA(1;2)"), "\"'=SOMA(1;2)\"");
  assert.equal(csvValue("@perfil"), "'@perfil");
  assert.equal(csvValue(13.95), "13,95");
  const csv = postsCsv(measureProfile(posts(profileA())).reels);
  assert.ok(csv.startsWith("﻿#;Perfil"));
  assert.ok(csv.includes("'=SOMA"));
});

const READING = {
  version: 1,
  kind: "reels_grid",
  profile: "@perfil.c",
  collected_at: COLLECTED_AT,
  source: { type: "screenshot", ref: "capturas/perfil-c.png" },
  items: [{ plays_text: "1.234", pinned: true }, { plays_text: "12,3 mil" }, { plays_text: "980" }, { plays_text: "1,1 mil" }, { plays_text: "870" }, { plays_text: "1.050" }],
};

test("a reading becomes posts, with pinned posts left out of the normal", () => {
  const { profile, posts: read, pinned, source } = readingToPosts(READING);
  assert.equal(profile, "perfil.c");
  assert.equal(pinned, 1);
  assert.deepEqual(read.map((post) => post.plays), [12300, 980, 1100, 870, 1050]);
  assert.equal(source.type, "screenshot");
  assert.equal(baselineOf(read).value, 1050);
});

test("a reading is refused with the path of each field that cannot be read", () => {
  const broken = { ...READING, source: { type: "screenshot" }, items: [{ plays_text: "12,3 mil" }, { plays_text: "muito" }] };
  assert.throws(() => readingToPosts(broken), (error) => {
    assert.equal(error.code, "reading_invalid");
    assert.deepEqual(error.problems.map((problem) => problem.path), ["source.ref", "items[1].plays_text"]);
    return true;
  });
});

test("the key: an empty variable means no key, the saved file comes after the variable", () => {
  const dir = mkdtempSync(join(tmpdir(), "ig-key-"));
  const file = join(dir, "keys.json");
  writeFileSync(file, JSON.stringify({ version: 1, keys: { APIFY_TOKEN: "salva" } }));
  assert.deepEqual(apifyKey({}, file), { key: "salva", from: "flyee" });
  assert.deepEqual(apifyKey({ APIFY_TOKEN: "do-ambiente" }, file), { key: "do-ambiente", from: "environment" });
  assert.deepEqual(apifyKey({ APIFY_TOKEN: "" }, file), { key: null, from: null });
  assert.deepEqual(apifyKey({}, join(dir, "nao-existe.json")), { key: null, from: null });
});

test("Apify answers become stable error codes, and every run has a ceiling", () => {
  assert.equal(classifyApifyError(401).code, "apify_unauthorized");
  assert.equal(classifyApifyError(402).code, "apify_no_credit");
  assert.equal(classifyApifyError(403, { error: { message: "Monthly usage hard limit exceeded" } }).code, "apify_no_credit");
  assert.equal(classifyApifyError(429).code, "rate_limited");
  assert.equal(estimateUsd({ usd_per_item: 0.0027 }, 30), 0.081);
  assert.equal(chargeCeiling(0.081), 0.12);
  assert.equal(chargeCeiling(0.001), 0.05);
});

test("the key only ever goes to Apify or to a fake on this machine", () => {
  assert.equal(apifyApi(undefined), DEFAULT_API);
  assert.equal(apifyApi("http://127.0.0.1:4321/v2/"), "http://127.0.0.1:4321/v2");
  assert.equal(apifyApi("http://localhost:80/v2"), "http://localhost:80/v2");
  for (const url of ["https://outro-site.com/v2", "http://127.0.0.1.outro-site.com/v2", "http://localhost.outro-site.com", "https://api.apify.com.outro-site.com/v2"]) {
    assert.throws(() => apifyApi(url), { code: "usage" }, url);
  }
});

test("the cost of a run comes from the charged events when Apify has not totaled them yet", () => {
  const pricingInfo = { pricingPerEvent: { actorChargeEvents: { post: { eventPriceUsd: 0.0017 }, "post-details": { eventPriceUsd: 0.001 }, "music-data": { eventPriceUsd: 0.007 } } } };
  assert.equal(chargedUsd({ usageTotalUsd: 0, pricingInfo, chargedEventCounts: { post: 30, "post-details": 30, "music-data": 0 } }), 0.081);
  assert.equal(chargedUsd({ usageTotalUsd: 0.081, pricingInfo, chargedEventCounts: { post: 30, "post-details": 30 } }), 0.081);
  assert.equal(chargedUsd({ usageTotalUsd: 0.02 }), 0.02);
  assert.equal(chargedUsd({}), null);
});

test("actorFailure reads a profile the actor could not open", () => {
  assert.deepEqual(actorFailure([{ username: "x", error: "not_found", errorDescription: "Profile does not exist" }]), { code: "not_found", description: "Profile does not exist", username: "x" });
  assert.equal(actorFailure(profileA()), null);
});
