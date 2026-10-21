// The three page templates through the real Motor de vídeo: each one, drafted from a concept of
// the synthetic round, has to pass the Motor's own conference in 9:16 against the safe zone of
// Meta ads (accept --networks ads_meta), with the real browser, the real music and the real mix.
// Opt-in, because it takes minutes and opens a headless browser: ADS_TEST_REAL=1. Skipped, saying
// why, when this machine has no ffmpeg or no browser.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { BRIEFING, concepts as conceptsFixture, READING_AGENDA, READING_DECLARED, READING_NORTE, TAGS } from "./fixtures/campanha.mjs";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(TESTS_DIR, "..");
const ENGINE_DIR = join(APP_DIR, "..", "video-render");
const CAMPAIGN = "lotus-rodada-0";
const SKIP = new Set(["tests", ".dev", "node_modules"]);

function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    if (SKIP.has(entry)) continue;
    const source = join(from, entry);
    if (statSync(source).isDirectory()) copyDir(source, join(to, entry));
    else copyFileSync(source, join(to, entry));
  }
}

function cli(root, script, args) {
  // the machine's own Apify key never reaches the test: APIFY_TOKEN empty means no key
  const env = { ...process.env, APIFY_TOKEN: "" };
  return new Promise((done) => {
    const child = spawn(process.execPath, [script, ...args, "--json"], { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => {
      let json = null;
      try {
        json = JSON.parse(stdout);
      } catch {
        // the assertion shows what came out
      }
      done({ code, json, stdout, stderr });
    });
  });
}

test("each template passes the real Motor's conference: 9:16 in the Meta ads zone, the 4:5 video and the images in the feed's", { timeout: 1800000 }, async (t) => {
  if (process.env.ADS_TEST_REAL !== "1") {
    t.skip("leva alguns minutos e usa o navegador: rode com ADS_TEST_REAL=1");
    return;
  }
  const root = mkdtempSync(join(tmpdir(), "anuncios-real-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const appDir = join(root, ".flyee", "modules", "ad-creatives");
  for (const dir of ["scripts", "runtime", "references"]) copyDir(join(APP_DIR, dir), join(appDir, dir));
  copyFileSync(join(APP_DIR, "flyee.module.json"), join(appDir, "flyee.module.json"));
  copyDir(ENGINE_DIR, join(root, ".flyee", "modules", "video-render"));
  const script = join(appDir, "scripts", "ads.mjs");
  const run = async (args) => {
    const result = await cli(root, script, args);
    assert.equal(result.code, 0, `${args.join(" ")} → ${result.stdout}${result.stderr.slice(-2000)}`);
    return result.json;
  };

  const check = await run(["check"]);
  if (!check.ready) {
    t.skip("sem ffmpeg ou navegador nesta máquina");
    return;
  }
  await run(["new", CAMPAIGN]);
  const dir = join(root, "anuncios", CAMPAIGN);
  writeFileSync(join(dir, "briefing.md"), BRIEFING);
  // the brand comes from the Motor's own test site, captured for real
  const site = join(ENGINE_DIR, "tests", "fixtures", "site", "index.html");
  const captured = await run(["capture", CAMPAIGN, "--url", site]);
  assert.equal(captured.captured, true, JSON.stringify(captured.error ?? null));
  const png = readFileSync(join(root, captured.dir, "mobile.png"));
  for (const reading of [READING_NORTE, READING_AGENDA]) {
    for (const item of reading.items) {
      mkdirSync(dirname(join(dir, item.capture)), { recursive: true });
      writeFileSync(join(dir, item.capture), png);
    }
  }
  const readings = { norte: READING_NORTE, agenda: READING_AGENDA, dito: READING_DECLARED, etiquetas: TAGS };
  for (const [name, data] of Object.entries(readings)) {
    writeFileSync(join(dir, "pesquisa", "leituras", `${name}.json`), JSON.stringify(data));
    await run(["import", CAMPAIGN, `pesquisa/leituras/${name}.json`]);
  }
  const data = conceptsFixture();
  // one concept per template: the product in use shows the screen captured from the site; every
  // concept also gets the 4:5 video and the 4:5 image of the feed, and one the 1:1 image
  data.concepts[1].template = "produto-em-uso";
  for (const concept of data.concepts) concept.formats = ["vertical", "feed", "imagem"];
  data.concepts[2].formats = ["vertical", "feed", "quadrado"];
  writeFileSync(join(dir, "conceitos.json"), JSON.stringify(data, null, 2));
  await run(["concepts", CAMPAIGN]);
  await run(["approve", CAMPAIGN, "concepts"]);

  const verdicts = {};
  for (const concept of data.concepts) {
    const piece = await run(["piece", CAMPAIGN, concept.key]);
    assert.equal(piece.template, concept.template ?? concept.structure);
    const preview = await run(["preview", CAMPAIGN, concept.key]);
    const report = JSON.parse(readFileSync(join(root, preview.accept.report), "utf8"));
    verdicts[concept.key] = { passed: preview.accept.passed, failed: preview.accept.failed, checks: report.checks.map((item) => `${item.name}${item.network ? `(${item.network})` : ""}:${item.status}`) };
    assert.equal(preview.accept.passed, true, `${concept.key}: ${JSON.stringify(verdicts[concept.key], null, 2)}`);
    for (const name of ["page", "first_frame_readable", "safe_area", "text_size", "cuts_on_beat"]) {
      assert.equal(report.checks.find((item) => item.name === name)?.status, "pass", `${concept.key}: ${name} → ${JSON.stringify(report.checks.find((item) => item.name === name))}`);
    }
    assert.ok(report.networks.includes("ads_meta"), `${concept.key}: conferido contra os anúncios da Meta`);
    assert.deepEqual(report.safe.insets ?? { top: 270, bottom: 672, left: 65, right: 140 }, { top: 270, bottom: 672, left: 65, right: 140 });
    // the feed: the same page recomposed in 4:5, and the still image
    for (const placement of preview.placements) {
      const placed = JSON.parse(readFileSync(join(root, placement.report), "utf8"));
      verdicts[`${concept.key}:${placement.id}`] = placed.checks.map((item) => `${item.name}:${item.status}`);
      assert.equal(placement.passed, true, `${concept.key} ${placement.id}: ${JSON.stringify(placed.checks.filter((item) => item.status !== "pass"), null, 2)}`);
      for (const name of ["page", "first_frame_readable", "safe_area", "text_size"]) {
        assert.equal(placed.checks.find((item) => item.name === name)?.status, "pass", `${concept.key} ${placement.id}: ${name}`);
      }
    }
  }
  t.diagnostic(JSON.stringify(verdicts));
});
