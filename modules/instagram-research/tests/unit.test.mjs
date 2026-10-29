import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { existsSync, readFileSync } from "node:fs";

import { apifyAccess, apifyApi, apifyKey, canCollect, chargeCeiling, chargedUsd, classifyApifyError, DEFAULT_API, estimateUsd, keySetup, runActor } from "../scripts/lib/apify.mjs";
import { captionsMarkdown, captionTable, readCaption, TRAITS } from "../scripts/lib/captions.mjs";
import { actorFailure, fullCaption, linkExpiry, normalizeComment, normalizePost, parseCount, parsePost, parseProfile } from "../scripts/lib/instagram.mjs";
import { readingToPosts } from "../scripts/lib/reading.mjs";
import { csvValue, excerpt, postsCsv, profileMarkdown } from "../scripts/lib/report.mjs";
import { baselineOf, measureProfile, scorePost } from "../scripts/lib/score.mjs";
import { downloadVideo, mediaLinkAllowed } from "../scripts/lib/video.mjs";
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

test("the access: the key first, then, only in a cloud session, the environment's network secret", async () => {
  const none = join(mkdtempSync(join(tmpdir(), "ig-access-")), "nao-existe.json");
  let probes = 0;
  const answer = (status) => async (url, init) => {
    probes++;
    assert.equal(url, `${DEFAULT_API}/users/me`);
    assert.equal(init?.headers?.Authorization, undefined, "the probe never carries a key");
    return new Response("{}", { status });
  };
  assert.deepEqual(await apifyAccess({ env: { APIFY_TOKEN: "do-ambiente", CLAUDE_CODE_REMOTE: "true" }, path: none, fetchImpl: answer(200) }), { key: "do-ambiente", from: "environment" });
  assert.deepEqual(await apifyAccess({ env: { APIFY_TOKEN: "", CLAUDE_CODE_REMOTE: "true" }, path: none, fetchImpl: answer(200) }), { key: null, from: null }, "an empty variable still means no key");
  assert.deepEqual(await apifyAccess({ env: {}, path: none, fetchImpl: answer(200) }), { key: null, from: null }, "a computer has no environment secret");
  assert.equal(probes, 0);
  assert.deepEqual(await apifyAccess({ env: { CLAUDE_CODE_REMOTE: "true" }, path: none, fetchImpl: answer(200) }), { key: null, from: "cloud_secret" });
  assert.deepEqual(await apifyAccess({ env: { CLAUDE_CODE_REMOTE: "true" }, path: none, fetchImpl: answer(401) }), { key: null, from: null });
  const refused = async () => {
    throw new TypeError("fetch failed");
  };
  assert.deepEqual(await apifyAccess({ env: { CLAUDE_CODE_REMOTE: "true" }, path: none, fetchImpl: refused }), { key: null, from: null });
  assert.equal(canCollect({ key: null, from: "cloud_secret" }), true);
  assert.equal(canCollect({ key: "k", from: "flyee" }), true);
  assert.equal(canCollect({ key: null, from: null }), false);
});

test("with the environment's secret, every request goes without a key, and the key request names the environment", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push(init?.headers?.Authorization ?? null);
    if (url.includes("/runs?")) return new Response(JSON.stringify({ data: { id: "r1", status: "SUCCEEDED", defaultDatasetId: "d1", usageTotalUsd: 0.01 } }), { status: 201 });
    return new Response("[]", { status: 200 });
  };
  await runActor({ actor: "apify/instagram-post-scraper", input: {}, token: null, maxItems: 1, maxChargeUsd: 0.1, fetchImpl, pollMs: 1 });
  assert.ok(seen.length >= 2);
  assert.ok(seen.every((value) => value === null));
  const cloud = keySetup({ CLAUDE_CODE_REMOTE: "true" });
  assert.equal(cloud.cloud, true);
  assert.equal(cloud.command, undefined);
  assert.match(cloud.how, /segredo de rede/);
  assert.equal(keySetup({}).command, "npx --yes flyee@latest key set APIFY_TOKEN --browser --json");
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

// ---------------------------------------------------------------- 1.1.0: whole captions

const LONG_CAPTION = `Primeira linha com o gancho\r\n\r\n${"Uma frase do meio da legenda. ".repeat(12)}\r\nComente PÃO que eu te mando.\r\n\r\n#pao #receita`;

test("the caption arrives whole: every line, the hashtags and the request at the end", () => {
  assert.equal(fullCaption("  linha 1\r\nlinha 2\n\n#tag  "), "linha 1\nlinha 2\n\n#tag");
  assert.equal(fullCaption(undefined), null);
  assert.equal(fullCaption(""), "");
  const post = normalizePost({ type: "Video", shortCode: "LONG01", videoPlayCount: 10, caption: LONG_CAPTION }, { collectedAt: COLLECTED_AT });
  assert.ok(post.caption.length > 300, "no cut at 300 characters");
  assert.ok(post.caption.startsWith("Primeira linha com o gancho\n\n"));
  assert.ok(post.caption.endsWith("Comente PÃO que eu te mando.\n\n#pao #receita"));
});

test("the expiry of a Reels' video link is read from the link itself, never guessed", () => {
  const link = (oe) => `https://scontent-gru2-1.cdninstagram.com/o1/v/t16/f2/m86/video.mp4?efg=x&oh=00_abc&oe=${oe}&_nc_sid=1`;
  assert.equal(linkExpiry(link("6AC401A9")), "2026-10-05T19:59:37.000Z");
  for (const missing of [link(""), link("zz12"), link("1"), "https://x.cdninstagram.com/v.mp4", "não é um link", null]) assert.equal(linkExpiry(missing), null, String(missing));
  const reel = normalizePost({ type: "Video", shortCode: "VID001", videoPlayCount: 10, videoUrl: link("6AC401A9") }, { collectedAt: COLLECTED_AT });
  assert.equal(reel.video_expires_at, "2026-10-05T19:59:37.000Z");
  assert.equal(JSON.stringify(reel).includes("cdninstagram"), false, "the post carries the expiry, not the link");
  assert.equal(normalizePost({ type: "Image", shortCode: "IMG001", likesCount: 3, videoUrl: link("6AC401A9") }, { collectedAt: COLLECTED_AT }).video_expires_at, null);
});

test("a reading keeps the whole caption it was given, and refuses one cut at \"mais\"", () => {
  const reading = (caption) => ({ version: 1, kind: "posts", profile: "@perfil.c", collected_at: COLLECTED_AT, source: { type: "screenshot", ref: "capturas/post.png" }, items: [{ type: "reel", plays_text: "1.234", caption }] });
  const [post] = readingToPosts(reading(`Gancho\n\n${"texto ".repeat(80)}\n#tag`)).posts;
  assert.ok(post.caption.length > 300);
  assert.ok(post.caption.includes("\n"));
  for (const cut of ["Gancho da legenda… mais", "Gancho da legenda... mais", "Hook of the caption… more"]) {
    assert.throws(() => readingToPosts(reading(cut)), (error) => error.code === "reading_invalid" && error.problems.some((problem) => problem.path === "items[0].caption"), cut);
  }
  assert.equal(readingToPosts(reading("Quero mais")).posts[0].caption, "Quero mais");
});

test("a report shows one line of the caption, so a line break never splits a table row", () => {
  assert.equal(excerpt("Linha 1\n\nLinha 2", 70), "Linha 1 Linha 2");
  assert.equal(excerpt("abcdefghij", 5), "abcd…");
  assert.equal([...excerpt("🍞".repeat(10), 4)].length, 4, "an emoji is never cut in half");
  const measured = measureProfile([normalizePost({ type: "Video", shortCode: "ROW001", videoPlayCount: 10, caption: "Linha 1\nLinha 2 | com barra\n#tag" }, { collectedAt: COLLECTED_AT })]);
  const md = profileMarkdown({ id: "perfil", source: { type: "apify", collected_at: COLLECTED_AT }, warnings: [], ...measured });
  const row = md.split("\n").find((line) => line.includes("ROW001"));
  assert.match(row, /^\| 1 \|.*\[Linha 1 Linha 2 \/ com barra #tag\]\(https:\/\/www\.instagram\.com\/p\/ROW001\/\)/);
  assert.equal(postsCsv(measured.reels).includes('"Linha 1\nLinha 2 | com barra\n#tag"'), true, "the spreadsheet keeps the whole caption in one quoted cell");
});

// ---------------------------------------------------------------- 1.1.0: caption traits

const traitsOf = (caption) => TRAITS.filter((trait) => trait.test(readCaption(caption))).map((trait) => trait.key);

test("each caption trait is found in Portuguese and English, accents included", () => {
  const cases = [
    ["Qual você prefere?", ["question"]],
    ["5 pães para o café da manhã", ["first_line_number"]],
    ["Eu testei por um mês", ["first_person"]],
    ["I tried it for a month", ["first_person"]],
    ["Lista\n1. farinha\n2. água\n3. sal", ["list_format"]],
    ["Lista\n✅ farinha\n✅ água\n✅ sal", ["list_format"]],
    ["Receita do dia\n\n#pao #receita", ["hashtags_end"]],
    ["Hoje tem #pao no café", ["hashtags_inline"]],
    ["Me conta nos comentários", ["cta_any", "cta_comment"]],
    ["Comment BREAD below", ["cta_any", "cta_comment"]],
    ["Salva esse post pra depois", ["cta_any", "cta_save"]],
    ["Save this for later", ["cta_any", "cta_save"]],
    ["Marque alguém que precisa ver", ["cta_any", "cta_share"]],
    ["Tag a friend who bakes", ["cta_any", "cta_share"]],
    ["A receita está no link da bio", ["cta_any", "cta_link_bio"]],
    ["Full recipe: link in bio", ["cta_any", "cta_link_bio"]],
    ["Me chama no direct", ["cta_any", "cta_dm"]],
    ["DM me for the recipe", ["cta_any", "cta_dm"]],
  ];
  for (const [caption, expected] of cases) assert.deepEqual(traitsOf(caption), expected, caption);
  const keys = TRAITS.map((trait) => trait.key);
  assert.deepEqual(keys, ["question", "first_line_number", "first_person", "list_format", "hashtags_end", "hashtags_inline", "cta_any", "cta_comment", "cta_save", "cta_share", "cta_link_bio", "cta_dm"]);
});

test("caption traits stay off where the words mean something else", () => {
  const offTarget = [
    ["Salve, galera. Hoje tem live.", "cta_save"],
    ["Ela comenta que o pão ficou bom.", "cta_comment"],
    ["Diabetes: DM tipo 2 pede cuidado.", "cta_dm"],
    ["Atendo em hospital privado.", "cta_dm"],
    ["1.000 pessoas\n2.500 seguidores\n10:30 da manhã", "list_format"],
    ["Fale com @meu.perfil", "first_person"],
    ["Use #meusegredo", "first_person"],
    ["Veja https://site.com/?q=1", "question"],
    ["O top10 do ano", "first_line_number"],
  ];
  for (const [caption, trait] of offTarget) assert.equal(traitsOf(caption).includes(trait), false, `${trait}: ${caption}`);
  assert.deepEqual(traitsOf("Salve, galera. Hoje tem live."), [], "a greeting is not a request");
  const hashtags = readCaption("Texto com #meio e mais texto\n\n#fim1 #fim2 @parceiro");
  assert.deepEqual(hashtags.hashtags, { count: 3, inline: 1, end: 2 });
  assert.equal(readCaption("𝗘𝘂 testei").folded.startsWith("eu"), true, "styled letters read as plain ones");
  assert.equal(readCaption("Pão 🍞 quente\nsegunda linha").first_line_length, 12, "an emoji counts as one character");
});

test("captionTable measures each trait against the multiplier, with the size of each group", () => {
  let next = 0;
  const post = (caption, multiplier) => ({ id: `p${(next += 1)}`, kind: "reel", caption, multiplier, band: typeof multiplier === "number" && multiplier >= 3 ? "outlier" : "normal" });
  const posts = [
    post("Qual você prefere?\nComente aqui.\n#pao #receita", 4),
    post("3 erros no pão\n1. Sova\n2. Fermento\n3. Forno\nSalva esse post.", 6),
    post("Pão simples #pao de todo dia", 1),
    post("Eu fiz pão por 30 dias", 2),
    post("Link na bio", 0.5),
    post("", 1),
    post(null, 3),
    post("Sem multiplicador", null),
  ];
  const table = captionTable(posts, { minN: 2 });
  assert.deepEqual(table.sample, { posts: 8, measured: 6, no_caption: 1, no_multiplier: 1 });
  const row = (key) => table.traits.find((trait) => trait.trait === key);
  assert.deepEqual(row("question").with, { n: 1, median: 4 });
  assert.deepEqual(row("question").without, { n: 5, median: 1 });
  assert.equal(row("question").ratio, 4);
  assert.equal(row("question").small_n, true);
  assert.deepEqual([row("first_line_number").with, row("first_line_number").without], [{ n: 2, median: 4 }, { n: 4, median: 1 }]);
  assert.deepEqual([row("cta_any").with, row("cta_any").without, row("cta_any").small_n], [{ n: 3, median: 4 }, { n: 3, median: 1 }, false]);
  assert.deepEqual(["list_format", "hashtags_end", "hashtags_inline", "cta_comment", "cta_save", "cta_link_bio", "first_person"].map((key) => row(key).with.n), [1, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(table.first_line.buckets.map((bucket) => bucket.n), [6, 0, 0, 0]);
  assert.equal(table.first_line.median_outliers, 16);
  assert.equal(table.first_line.outliers_n, 2);
  assert.deepEqual(table.hashtags.buckets.map((bucket) => [bucket.range, bucket.n]), [["nenhuma", 4], ["1 a 3", 2], ["4 a 10", 0], ["acima de 10", 0]]);
  assert.equal(table.total.buckets[0].n, 6);
  assert.equal(captionTable([], { minN: 5 }).traits.every((trait) => trait.with.n === 0 && trait.with.median === null && trait.small_n), true);
});

test("legendas.md cites every group with its size and says what the data does not prove", () => {
  const empty = captionTable([], { minN: 5 });
  const md = captionsMarkdown({ id: "teste", scope: "outliers", profiles: ["a", "b"], created_at: "2026-10-29T12:00:00Z", min_n: 5, reels: captionTable([{ id: "x", kind: "reel", caption: "Qual?", multiplier: 2, band: "above" }], { minN: 5 }), static: empty, excluded: [{ id: "y", profile: "a", reason: "paid_partnership" }], warnings: ["Só 1 legendas de Reels com multiplicador: trate tudo como indício."] });
  assert.doesNotMatch(md, /[–—]/u);
  assert.match(md, /\| faz uma pergunta \("\?"\) \| 2× \(n=1\) \| \(n=0\) \| grupo pequeno \(menos de 5\): indício \|/);
  assert.match(md, /não a causa/);
  assert.match(md, /- y \(@a\): parceria paga\./);
  assert.match(md, /## Posts estáticos e carrosséis\n\nNenhum post com multiplicador e legenda nesta pesquisa\./);
});

// ---------------------------------------------------------------- 1.1.0: a Reels' video

test("a video comes only from Instagram's media servers over https, or a fake on this machine", () => {
  for (const ok of ["https://scontent-gru2-1.cdninstagram.com/o1/v.mp4?oe=1", "https://instagram.fgru5-1.fna.fbcdn.net/v.mp4", "http://127.0.0.1:4000/cdn/v.mp4"]) assert.equal(mediaLinkAllowed(ok), true, ok);
  for (const refused of ["http://scontent.cdninstagram.com/v.mp4", "https://cdninstagram.com.outro-site.com/v.mp4", "https://outrocdninstagram.com/v.mp4", "https://api.apify.com/v.mp4", "https://user:pass@scontent.cdninstagram.com/v.mp4", "file:///etc/passwd", "não é link"]) {
    assert.equal(mediaLinkAllowed(refused), false, refused);
  }
});

const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(500, 7)]);
const LINK = "https://scontent-gru2-1.cdninstagram.com/o1/v/t16/video.mp4?oh=00_a&oe=6AC401A9";
const BEFORE_EXPIRY = Date.parse("2026-10-04T00:00:00Z");
const answer = (body, init = {}) => async () => new Response(body, { status: 200, headers: { "content-type": "video/mp4" }, ...init });

test("downloadVideo saves the file, and refuses an expired link before any request", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ig-video-"));
  const target = join(dir, "posts", "VID001", "video.mp4");
  const saved = await downloadVideo({ link: LINK, target, maxBytes: 1024 * 1024, fetchImpl: answer(MP4), now: BEFORE_EXPIRY });
  assert.deepEqual(saved, { bytes: MP4.length, expires_at: "2026-10-05T19:59:37.000Z" });
  assert.equal(readFileSync(target).subarray(4, 8).toString(), "ftyp");
  let calls = 0;
  await assert.rejects(downloadVideo({ link: LINK, target, maxBytes: 1024, fetchImpl: async () => (calls += 1), now: Date.parse("2026-10-06T00:00:00Z") }), { code: "video_link_expired" });
  assert.equal(calls, 0, "an expired link makes no request");
});

test("downloadVideo turns refusals into stable codes and never leaves half a file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ig-video-"));
  const target = join(dir, "video.mp4");
  const attempt = (fetchImpl, maxBytes = 1024 * 1024) => downloadVideo({ link: LINK, target, maxBytes, fetchImpl, now: BEFORE_EXPIRY });
  await assert.rejects(attempt(answer("", { status: 403 })), { code: "video_link_expired" });
  await assert.rejects(attempt(answer("", { status: 404 })), { code: "video_unavailable" });
  await assert.rejects(attempt(answer("", { status: 500 })), { code: "video_download_failed" });
  await assert.rejects(attempt(answer("<html></html>", { headers: { "content-type": "text/html" } })), { code: "video_download_failed" });
  await assert.rejects(attempt(answer(MP4, { headers: { "content-type": "video/mp4", "content-length": String(10 * 1024 * 1024) } })), { code: "video_too_large" });
  await assert.rejects(attempt(answer(Buffer.alloc(4096, 1)), 1024), { code: "video_too_large" }, "the ceiling also holds without a declared size");
  await assert.rejects(attempt(answer(Buffer.from("isto não é um vídeo"))), { code: "video_download_failed" });
  await assert.rejects(attempt(async () => new Response(null, { status: 302, headers: { location: "https://outro-site.com/v.mp4" } })), { code: "video_link_invalid" });
  await assert.rejects(attempt(async () => { throw new TypeError("fetch failed"); }), { code: "offline" });
  assert.equal(existsSync(target), false);
  const redirected = await attempt(async (url) => (url === LINK ? new Response(null, { status: 302, headers: { location: "https://instagram.fgru5-1.fna.fbcdn.net/v.mp4" } }) : new Response(MP4, { status: 200 })));
  assert.equal(redirected.bytes, MP4.length, "a redirect to another Instagram server is followed");
});
