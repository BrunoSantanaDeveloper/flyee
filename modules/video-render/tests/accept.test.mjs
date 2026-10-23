// Acceptance group: the pure checks with synthetic data and the networks table, then the real
// commands through render.mjs: pages opened in a browser (skipped without one) and videos
// ffmpeg generates here (skipped without ffmpeg). Nothing here touches the network.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

import {
  beatsFromBpm,
  beatsFromData,
  CAROUSEL,
  CHECKS,
  checkLine,
  cutsOnBeat,
  cutsStatus,
  deadTime,
  defaultPreset,
  durationCheck,
  firstFrameReadable,
  fixLine,
  flashes,
  formatLimit,
  formatName,
  formatSupport,
  groupViolations,
  inside,
  intersects,
  loopStatus,
  loudnessCheck,
  makeCheck,
  MARKS,
  mergeLocalChange,
  minTextFor,
  NETWORK_CHECKS,
  overflow,
  parseLocalChange,
  parseSsim,
  PRESETS,
  safeAreaViolations,
  safeFor,
  sameRatio,
  sampleTimes,
  scoreOf,
  STATUSES,
  summarize,
  textSizes,
} from "../scripts/lib/accept.mjs";
import { commands } from "../scripts/commands/accept.mjs";
import { defaultNetworks, listNetworks, loadNetworks, nearestFormat, networkFor, normalizeNetworkName, resolveNetworks, safeArea, safeInsets, unionSafeArea } from "../scripts/lib/networks.mjs";
import { FORMATS } from "../scripts/lib/renderer.mjs";
import { checkTools } from "../scripts/lib/tools.mjs";
import { AppError } from "../scripts/lib/util.mjs";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(TESTS_DIR, "..");
const SCRIPT = join(APP_DIR, "scripts", "render.mjs");
const EXAMPLE = join(APP_DIR, "runtime", "exemplo.html");
const TABLE = loadNetworks(APP_DIR);

/* ---------- formats and safe areas ---------- */

test("formatName, sameRatio, defaultPreset and minTextFor", () => {
  assert.equal(formatName(1080, 1350), "4:5");
  assert.equal(formatName(1920, 1080), "16:9");
  assert.equal(formatName(1000, 1250), "4:5", "by aspect ratio");
  assert.equal(formatName(540, 676), "4:5", "an even height one pixel off is still 4:5");
  assert.equal(formatName(500, 500), "1:1");
  assert.equal(formatName(800, 500), "800x500");
  assert.ok(sameRatio({ width: 270, height: 480 }, { width: 1080, height: 1920 }));
  assert.ok(!sameRatio({ width: 1080, height: 1350 }, { width: 1080, height: 1920 }));
  assert.ok(!sameRatio(null, { width: 1080, height: 1920 }));
  assert.equal(defaultPreset("4:5"), "instagram-carousel");
  assert.equal(defaultPreset("3:4"), "instagram-carousel");
  assert.equal(defaultPreset("9:16"), "instagram-feed");
  assert.equal(defaultPreset("800x500"), "instagram-feed");
  assert.equal(defaultPreset("4:5", true), "networks", "with destinations, their zones are the default");
  assert.equal(defaultPreset("9:16", true), "networks");
  assert.equal(minTextFor(1080), 44);
  assert.equal(minTextFor(540), 22);
  assert.equal(minTextFor(1920), 78.2, "the minimum scales with the width in every orientation");
  assert.equal(minTextFor(1080, 60), 60);
});

test("the networks table is the one source of the format zones: it mirrors Motion.SAFE and the renderer's formats", () => {
  const context = { window: {} };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(readFileSync(join(APP_DIR, "runtime", "motion.js"), "utf8"), context);
  const motionSafe = JSON.parse(JSON.stringify(context.window.Motion.SAFE));
  const fromTable = Object.fromEntries(Object.entries(TABLE.formats).map(([name, entry]) => [name, { width: entry.width, height: entry.height, ...entry.safe_zone }]));
  assert.deepEqual(fromTable, motionSafe, "references/redes.json and runtime/motion.js carry the same zones");
  assert.deepEqual(Object.fromEntries(Object.entries(TABLE.formats).map(([name, entry]) => [name, { width: entry.width, height: entry.height }])), Object.fromEntries(Object.keys(TABLE.formats).map((name) => [name, FORMATS[name]])));
  assert.deepEqual(Object.keys(TABLE.formats).sort(), Object.keys(FORMATS).sort());
});

test("safeFor: the carousel margin and corners scale with the width", () => {
  const full = safeFor({ preset: "instagram-carousel", width: 1080, height: 1350 });
  assert.deepEqual(full.rect, { x: 72, y: 72, w: 936, h: 1206 });
  assert.equal(full.margin, 72);
  assert.equal(full.format, "4:5");
  assert.deepEqual(full.insets, { top: 72, bottom: 72, left: 72, right: 72 });
  assert.deepEqual(full.networks, []);
  assert.deepEqual(full.corners, [
    { name: "counter", label: CAROUSEL.corners.counter.label, x: 910, y: 0, w: 170, h: 80 },
    { name: "sound", label: CAROUSEL.corners.sound.label, x: 980, y: 1250, w: 100, h: 100 },
  ]);
  const half = safeFor({ preset: "instagram-carousel", width: 540, height: 675 });
  assert.deepEqual(half.rect, { x: 36, y: 36, w: 468, h: 603 });
  assert.deepEqual(half.corners.map(({ name, x, y, w, h }) => [name, x, y, w, h]), [["counter", 455, 0, 85, 40], ["sound", 490, 625, 50, 50]]);
  const custom = safeFor({ preset: "instagram-carousel", width: 1080, height: 1440, margin: 100 });
  assert.deepEqual(custom.rect, { x: 100, y: 100, w: 880, h: 1240 });
  assert.equal(custom.corners.length, 2);
});

test("safeFor: the feed insets come from the table per format and the nearest ratio serves custom sizes", () => {
  const reels = safeFor({ preset: "instagram-feed", width: 1080, height: 1920 });
  assert.deepEqual(reels.rect, { x: 70, y: 250, w: 830, h: 1170 });
  assert.deepEqual(reels.insets, { top: 250, bottom: 500, left: 70, right: 180 });
  assert.deepEqual(reels.insets, safeInsets(null, "9:16", TABLE), "the same numbers the table declares for the format");
  assert.equal(reels.format, "9:16");
  assert.deepEqual(reels.corners, []);
  assert.deepEqual(safeFor({ preset: "instagram-feed", width: 540, height: 960 }).rect, { x: 35, y: 125, w: 415, h: 585 });
  const square = safeFor({ preset: "instagram-feed", width: 1000, height: 1000 });
  assert.equal(square.format, "1:1");
  assert.deepEqual(square.rect, { x: 55.6, y: 74.1, w: 888.9, h: 814.8 });
  const landscape = safeFor({ preset: "instagram-feed", width: 1280, height: 720 });
  assert.equal(landscape.format, "16:9");
  assert.deepEqual(landscape.rect, { x: 66.7, y: 53.3, w: 1146.7, h: 566.7 });
  assert.equal(safeFor({ preset: "instagram-feed", width: 800, height: 1300 }).format, "9:16", "the closest ratio for an odd size");
  assert.deepEqual(safeFor({ preset: "margin", width: 1080, height: 1080, margin: 100 }).rect, { x: 100, y: 100, w: 880, h: 880 });
  assert.equal(safeFor({ preset: "margin", width: 540, height: 540 }).margin, 36);
  assert.deepEqual(safeFor({ preset: "margin", width: 540, height: 540 }).corners, []);
  const none = safeFor({ preset: "none", width: 1080, height: 1350 });
  assert.equal(none.rect, null);
  assert.equal(none.insets, null);
  assert.deepEqual(none.corners, []);
  assert.throws(() => safeFor({ preset: "tiktok", width: 1080, height: 1920 }), (error) => error.code === "usage");
});

test("safeFor: the networks preset keeps the largest inset of each side among the destinations", () => {
  const three = resolveNetworks("reels,tiktok,shorts", "9:16", TABLE);
  const strict = safeFor({ preset: "networks", width: 1080, height: 1920, networks: three });
  assert.deepEqual(strict.rect, { x: 70, y: 250, w: 830, h: 1170 });
  assert.deepEqual(strict.insets, { top: 250, bottom: 500, left: 70, right: 180 });
  assert.deepEqual(strict.networks, ["reels", "tiktok", "shorts"]);
  assert.deepEqual(strict.corners, []);
  assert.deepEqual(safeFor({ preset: "networks", width: 540, height: 960, networks: three }).rect, { x: 35, y: 125, w: 415, h: 585 });
  const stories = safeFor({ preset: "networks", width: 1080, height: 1920, networks: ["stories"] });
  assert.deepEqual(stories.insets, { top: 250, bottom: 340, left: 60, right: 60 }, "ids work as well as resolved entries");
  assert.deepEqual(stories.networks, ["stories"]);
  const alone = safeFor({ preset: "networks", width: 1080, height: 1920, networks: [] });
  assert.deepEqual(alone.rect, { x: 70, y: 250, w: 830, h: 1170 }, "without destinations, the format's own zone");
  assert.deepEqual(alone.networks, []);
  const portrait = safeFor({ preset: "networks", width: 1080, height: 1350, networks: ["reels"] });
  assert.deepEqual(portrait.insets, { top: 120, bottom: 200, left: 72, right: 72 }, "a network that has no zone for the format takes the format's");
  assert.equal(safeFor({ preset: "networks", width: 800, height: 1300, networks: three }).format, "9:16");
  assert.equal(nearestFormat(800, 1300, TABLE), "9:16");
  assert.equal(nearestFormat(1000, 1000, TABLE), "1:1");
  assert.equal(nearestFormat(1600, 1000, TABLE), "16:9");
});

/* ---------- boxes ---------- */

test("overflow, inside and intersects", () => {
  const rect = { x: 72, y: 72, w: 936, h: 1206 };
  assert.deepEqual(overflow({ x: 100, y: 100, w: 500, h: 100 }, rect), { left: 0, top: 0, right: 0, bottom: 0 });
  assert.deepEqual(overflow({ x: 108, y: 100, w: 950, h: 100 }, rect), { left: 0, top: 0, right: 50, bottom: 0 });
  assert.deepEqual(overflow({ x: 71.5, y: 71.5, w: 100, h: 100 }, rect), { left: 0, top: 0, right: 0, bottom: 0 }, "half a pixel is rounding");
  assert.deepEqual(overflow({ x: 0, y: 0, w: 1080, h: 1350 }, rect), { left: 72, top: 72, right: 72, bottom: 72 });
  assert.ok(inside({ x: 72, y: 72, w: 936, h: 1206 }, rect));
  assert.ok(!inside({ x: 0, y: 72, w: 936, h: 1206 }, rect));
  const corner = { x: 910, y: 0, w: 170, h: 80 };
  assert.ok(intersects({ x: 900, y: 40, w: 100, h: 100 }, corner));
  assert.ok(!intersects({ x: 800, y: 100, w: 100, h: 100 }, corner), "below the corner");
  assert.ok(!intersects({ x: 909.5, y: 0, w: 1, h: 80 }, corner), "touching by half a pixel");
});

test("safeAreaViolations keeps the watched roles, names the edges and corners and sorts the worst first", () => {
  const safe = safeFor({ preset: "instagram-carousel", width: 1080, height: 1350 });
  const samples = [
    {
      time: 0,
      boxes: [
        { role: "text", x: 108, y: 500, w: 950, h: 100, size: 90, text: "Título" }, // 50 px past the right edge
        { role: "ui", x: 0, y: 0, w: 1080, h: 60, size: null, text: null }, // never watched
        { role: "face", x: 200, y: 200, w: 400, h: 400, size: null, text: null }, // inside
      ],
    },
    {
      time: 0.5,
      boxes: [
        { role: "logo", x: 900, y: 20, w: 120, h: 40, size: null, text: null }, // top and right edges, on the counter
        { role: "text", x: 950, y: 1260, w: 100, h: 60, size: 40, text: "ok" }, // right and bottom edges, on the sound button
      ],
    },
  ];
  const violations = safeAreaViolations(samples, safe);
  assert.deepEqual(violations.map((item) => [item.time, item.role, item.severity]), [[0.5, "text", 60], [0.5, "logo", 52], [0, "text", 50]]);
  assert.deepEqual(violations[0].edges, ["right", "bottom"]);
  assert.deepEqual(violations[0].corners, ["sound"]);
  assert.deepEqual(violations[0].overflow, { left: 0, top: 0, right: 42, bottom: 42 });
  assert.deepEqual(violations[1].edges, ["top", "right"]);
  assert.deepEqual(violations[1].corners, ["counter"]);
  assert.deepEqual(violations[2].edges, ["right"]);
  assert.deepEqual(violations[2].corners, []);
  assert.equal(violations[2].text, "Título");
  assert.deepEqual(safeAreaViolations(samples, safeFor({ preset: "none", width: 1080, height: 1350 })), []);
  assert.equal(safeAreaViolations(samples, safeFor({ preset: "instagram-feed", width: 1080, height: 1350 })).length, 3);
  assert.equal(safeAreaViolations(samples, safeFor({ preset: "networks", width: 1080, height: 1350, networks: ["feed"] })).length, 3, "the feed's own zone is the format's");
  assert.equal(safeAreaViolations(samples, safe, { roles: ["logo"] }).length, 1, "only the roles asked for");
  assert.deepEqual(safeAreaViolations([{ time: 0, boxes: [{ role: "text", x: 100, y: 100, w: 0, h: 50, size: 50 }] }], safe), [], "empty boxes do not count");
});

test("groupViolations folds the same box seen at several instants into one offender", () => {
  const safe = safeFor({ preset: "instagram-carousel", width: 1080, height: 1350 });
  const title = { role: "text", x: 108, y: 500, w: 950, h: 100, size: 90, text: "Título" };
  const logo = { role: "logo", x: 900, y: 20, w: 120, h: 40, size: null, text: null };
  const samples = [0, 0.25, 0.5, 0.75].map((time) => ({ time, boxes: time < 0.75 ? [title] : [title, logo] }));
  const grouped = groupViolations(safeAreaViolations(samples, safe));
  assert.equal(grouped.length, 2);
  assert.deepEqual(grouped.map((item) => [item.role, item.time, item.until, item.instants, item.severity]), [["logo", 0.75, 0.75, 1, 52], ["text", 0, 0.75, 4, 50]]);
  assert.deepEqual(groupViolations([]), []);
});

test("firstFrameReadable and textSizes", () => {
  assert.deepEqual(firstFrameReadable([{ role: "text", size: 44 }, { role: "text", size: 30 }], 44), { readable: true, largest: 44, count: 2 });
  assert.deepEqual(firstFrameReadable([{ role: "text", size: 30 }], 44), { readable: false, largest: 30, count: 1 });
  assert.deepEqual(firstFrameReadable([{ role: "logo", size: 200 }], 44), { readable: false, largest: null, count: 0 });
  assert.deepEqual(firstFrameReadable([], 44), { readable: false, largest: null, count: 0 });
  const pass = textSizes([{ time: 0, boxes: [{ role: "text", size: 60 }, { role: "text", size: 44 }] }], 44);
  assert.equal(pass.status, "pass");
  assert.equal(pass.smallest, 44);
  assert.deepEqual(pass.small, []);
  const warn = textSizes([{ time: 0, boxes: [{ role: "text", size: 60 }] }, { time: 1, boxes: [{ role: "text", size: 30, text: "nota" }] }], 44);
  assert.equal(warn.status, "warn");
  assert.deepEqual(warn.small, [{ time: 1, size: 30, text: "nota" }]);
  assert.equal(warn.fail_below, 26.4);
  const fail = textSizes([{ time: 2, boxes: [{ role: "text", size: 30 }, { role: "text", size: 20 }] }], 44);
  assert.equal(fail.status, "fail");
  assert.equal(fail.smallest, 20);
  assert.deepEqual(fail.small.map((item) => item.size), [20, 30], "smallest first");
  const skip = textSizes([{ time: 0, boxes: [{ role: "text" }, { role: "ui", size: 10 }] }], 44);
  assert.equal(skip.status, "skip");
  assert.equal(skip.unsized, 1);
  assert.equal(skip.checked, 0);
});

/* ---------- beats and cuts ---------- */

test("beats and cuts: a declared cut is on the beat within one frame; the tolerance and the share can be loosened", () => {
  const beats = beatsFromBpm(120, 6);
  assert.equal(beats.length, 13);
  assert.equal(beats[0], 0);
  assert.equal(beats[3], 1.5);
  assert.equal(beats[12], 6);
  assert.deepEqual(beatsFromBpm(120, 1, 0.1), [0.1, 0.6]);
  assert.deepEqual(beatsFromData({ beats: [1, "0.5", null, 0] }), [0, 0.5, 1]);
  assert.deepEqual(beatsFromData({}), []);
  const result = cutsOnBeat([2, 4.02, 3.3, 0.03], beats, 30);
  assert.equal(result.tolerance, 0.0333);
  assert.equal(result.frames, 1);
  assert.equal(result.total, 4);
  assert.equal(result.ratio, 0.75);
  assert.deepEqual(result.on.map((item) => item.cut), [0.03, 2, 4.02]);
  assert.deepEqual(result.off, [{ cut: 3.3, nearest: 3.5, delta: -0.2 }]);
  assert.equal(cutsStatus(result), "fail", "every declared cut must land on a beat");
  assert.equal(cutsStatus(result, 0.7), "pass", "three of four pass a 70% share");
  assert.equal(cutsStatus(result, 0.8), "fail");
  assert.equal(cutsOnBeat([4.02], beats, 60).off.length, 1, "a tighter frame makes the same cut miss");
  const loose = cutsOnBeat([4.02, 4.06], beats, 60, { frames: 2 });
  assert.equal(loose.tolerance, 0.0333);
  assert.deepEqual(loose.on.map((item) => item.cut), [4.02], "two frames at 60 fps reach 33 ms, not 60");
  assert.equal(cutsOnBeat([1.0666], [1], 30, { frames: 2 }).on.length, 1, "exactly at the tolerance still counts");
  assert.deepEqual(cutsOnBeat([1], [], 30).off, [{ cut: 1, nearest: null, delta: null }]);
  const none = cutsOnBeat([], beats, 30);
  assert.deepEqual(none, { tolerance: 0.0333, frames: 1, total: 0, on: [], off: [], ratio: null });
  assert.equal(cutsStatus(none), "skip", "nothing to judge without cuts");
});

/* ---------- frames ---------- */

test("parseSsim and loopStatus", () => {
  const line = "[Parsed_ssim_0 @ 000001] SSIM Y:0.991234 (20.5) U:0.998 (27.0) V:0.997 (25.1) All:0.993456 (21.8)";
  assert.equal(parseSsim(line), 0.993456);
  assert.equal(parseSsim("All:1.000000 (inf)"), 1);
  assert.equal(parseSsim("nothing here"), null);
  assert.equal(parseSsim(null), null);
  assert.equal(parseSsim("first All:0.5 (1)\nlast All:0.9 (2)"), 0.9, "the last summary wins");
  assert.equal(loopStatus(0.99), "pass");
  assert.equal(loopStatus(0.985), "pass");
  assert.equal(loopStatus(0.97), "warn");
  assert.equal(loopStatus(0.95), "warn");
  assert.equal(loopStatus(0.9), "fail");
  assert.equal(loopStatus(null), "skip");
});

const framesOf = (ydifs) => ydifs.map((ydif, n) => ({ n, time: n / 30, yavg: 100, ydif }));

test("flashes: more than three big luminance changes in one second warn", () => {
  const calm = flashes(framesOf(Array(60).fill(2)));
  assert.equal(calm.over, false);
  assert.equal(calm.transitions, 0);
  assert.deepEqual(calm.worst, { at: null, count: 0 });
  const spread = Array(90).fill(0);
  spread[10] = 80;
  spread[45] = 80;
  spread[80] = 80;
  const three = flashes(framesOf(spread));
  assert.equal(three.transitions, 3);
  assert.equal(three.over, false);
  assert.equal(three.worst.count, 1, "never two in the same second");
  const strobe = Array(60).fill(0);
  for (const n of [5, 10, 15, 20]) strobe[n] = 80;
  const bad = flashes(framesOf(strobe));
  assert.equal(bad.over, true);
  assert.deepEqual(bad.worst, { at: 0.167, count: 4 });
  assert.deepEqual(bad.windows, [{ at: 0.167, count: 4 }]);
  assert.equal(flashes(framesOf([200, 0, 0])).transitions, 0, "the first frame differs from nothing");
  assert.equal(flashes(framesOf(strobe), { max: 4 }).over, false, "--max-flashes moves the limit");
  assert.equal(flashes(framesOf(spread), { max: 0 }).over, true);
});

test("deadTime: a still run of 1.5 s or more warns", () => {
  const still = deadTime(framesOf(Array(60).fill(0)));
  assert.equal(still.over, true);
  assert.deepEqual(still.longest, { from: 0, to: 2, seconds: 1.967 });
  assert.equal(still.runs.length, 1);
  assert.equal(deadTime(framesOf(Array(60).fill(0)), { min: 4 }).over, false, "--max-still moves the limit");
  assert.deepEqual(deadTime(framesOf(Array(60).fill(0)), { min: 4 }).runs, []);
  const moving = deadTime(framesOf(Array(60).fill(5)));
  assert.equal(moving.over, false);
  assert.equal(moving.longest, null);
  assert.deepEqual(moving.runs, []);
  const short = deadTime(framesOf([...Array(30).fill(0), ...Array(30).fill(5)]));
  assert.equal(short.over, false);
  assert.equal(short.longest.seconds, 0.967);
  assert.deepEqual(short.runs, []);
  const two = deadTime(framesOf([...Array(50).fill(0), 5, ...Array(20).fill(0)]));
  assert.equal(two.over, true);
  assert.equal(two.longest.seconds, 1.633);
  assert.equal(two.runs.length, 1);
  assert.equal(deadTime(framesOf(Array(60).fill(0)), { fps: 60 }).longest.seconds, 0.983, "fps overrides the frame step");
  assert.equal(deadTime([]).longest, null);
});

test("deadTime: a frame is still only when the whole frame and every block barely change", () => {
  // text being typed: the mean of the frame stays under 0.5 while a few blocks change a lot
  const typing = framesOf(Array(60).fill(0.08)).map((frame, n) => (n > 0 ? { ...frame, local: 30 } : frame));
  assert.equal(deadTime(framesOf(Array(60).fill(0.08))).over, true, "the mean alone calls it still");
  assert.equal(deadTime(typing).longest, null, "a block that changes is movement");
  assert.equal(deadTime(typing, { localThreshold: 40 }).over, true, "the block limit can be moved");
  // encoder noise moves every block a little: still
  const noise = framesOf(Array(60).fill(0.01)).map((frame) => ({ ...frame, local: 2 }));
  assert.deepEqual(deadTime(noise).longest, { from: 0, to: 2, seconds: 1.967 });
  // frames without a block measure keep the rule of the mean
  const half = framesOf(Array(60).fill(0)).map((frame, n) => (n >= 30 ? { ...frame, local: 12 } : frame));
  assert.equal(deadTime(half).longest.seconds, 0.967);
  assert.equal(deadTime(typing).local_threshold, 6);
  assert.equal(deadTime(framesOf(Array(60).fill(0))).local_threshold, null, "no block measure, no block limit in the result");
});

test("parseLocalChange reads ffmpeg's YMAX lines, scientific notation included, and mergeLocalChange puts them on the frames", () => {
  const printed = [
    "frame:0    pts:512     pts_time:0.0333333",
    "lavfi.signalstats.YMAX=2",
    "frame:1    pts:1024    pts_time:0.0666667",
    "lavfi.signalstats.YMAX=31",
    "frame:2    pts:1536    pts_time:0.1",
    "lavfi.signalstats.YMAX=1.5e+01",
  ].join("\r\n");
  const local = parseLocalChange(printed);
  assert.deepEqual(local, [{ time: 0.0333333, value: 2 }, { time: 0.0666667, value: 31 }, { time: 0.1, value: 15 }]);
  assert.deepEqual(parseLocalChange(""), []);
  const frames = mergeLocalChange(framesOf([0, 0, 0, 0]), local);
  assert.deepEqual(frames.map((frame) => frame.local), [undefined, 2, 31, 15], "the first frame differs from nothing");
  assert.equal(frames[1].ydif, 0, "each frame keeps what it had");
  assert.deepEqual(mergeLocalChange(framesOf([0, 0]), []), framesOf([0, 0]));
  assert.deepEqual(mergeLocalChange(framesOf([0, 0, 0]), [{ time: 5, value: 9 }]).map((frame) => frame.local), [undefined, undefined, undefined], "nothing near, nothing merged");
});

/* ---------- sampling and the report ---------- */

test("sampleTimes: frame 0, the grid, the beats and the last frame; thinning keeps the beats", () => {
  const { times, thinned } = sampleTimes({ duration: 2, every: 0.5, beats: [0.25, 1.75, 2.5], fps: 30 });
  assert.deepEqual(times, [0, 0.25, 0.5, 1, 1.5, 1.75, 1.967]);
  assert.equal(thinned, false);
  assert.deepEqual(sampleTimes({ duration: 0.01, fps: 30 }).times, [0]);
  const long = sampleTimes({ duration: 600, every: 0.25, beats: [100.1], fps: 30, max: 100 });
  assert.equal(long.thinned, true);
  assert.ok(long.times.length <= 110, `${long.times.length} instants`);
  assert.ok(long.times.includes(0) && long.times.includes(100.1) && long.times.includes(599.967));
});

test("makeCheck, summarize, scoreOf, checkLine, fixLine and the constants", () => {
  const fail = makeCheck("safe_area", "fail", "fora", [{ time: 1 }], "conserte");
  assert.deepEqual(fail, { name: "safe_area", status: "fail", summary: "fora", details: [{ time: 1 }], fix: "conserte" });
  const pass = makeCheck("page", "pass", "ok", [], "ignorado");
  assert.deepEqual(pass, { name: "page", status: "pass", summary: "ok", details: [] });
  assert.ok(makeCheck("flashes", "warn", "w", [], "x").fix);
  assert.throws(() => makeCheck("page", "meh", "x"));
  const perNetwork = makeCheck("duration", "warn", "longo", [], "corte", "reels");
  assert.deepEqual(perNetwork, { name: "duration", status: "warn", summary: "longo", details: [], network: "reels", fix: "corte" });
  assert.equal(makeCheck("duration", "pass", "ok", [], null, "tiktok").network, "tiktok");
  const list = [pass, fail, makeCheck("flashes", "warn", "w"), makeCheck("dead_time", "skip", "s")];
  assert.deepEqual(summarize(list), { passed: false, counts: { pass: 1, fail: 1, warn: 1, skip: 1 } });
  assert.deepEqual(scoreOf(list), { passed: 1, failed: 1, warned: 1, skipped: 1 });
  assert.equal(summarize([pass, makeCheck("flashes", "warn", "w")]).passed, true);
  assert.equal(checkLine(fail), "✗ Área segura: fora");
  assert.equal(checkLine(makeCheck("loop_seamless", "skip", "não pedido")), "○ Loop sem emenda: não pedido");
  assert.equal(checkLine(makeCheck("flashes", "warn", "w")), "△ Piscadas: w");
  assert.equal(checkLine(perNetwork, { reels: "Instagram Reels" }), "△ Duração (Instagram Reels): longo");
  assert.equal(checkLine(perNetwork), "△ Duração (reels): longo", "without labels the id stands in");
  assert.deepEqual(MARKS, { pass: "✓", fail: "✗", warn: "△", skip: "○" }, "the marks every flyee.club app prints: passou, reprovou, aviso, não medido");
  assert.equal(checkLine(makeCheck("format_supported", "pass", "ok", [], null, "x"), { x: "X" }), "✓ Formato (X): ok");
  assert.equal(checkLine(makeCheck("loudness", "pass", "ok")), "✓ Volume: ok");
  assert.equal(fixLine(fail), "    Como resolver: conserte");
  assert.equal(fixLine(pass), null);
  assert.equal(fixLine(makeCheck("flashes", "warn", "w")), null, "a check without a fix has no second line");
  assert.deepEqual(CHECKS, ["page", "first_frame_readable", "safe_area", "text_size", "cuts_on_beat", "loop_seamless", "flashes", "dead_time", "loudness"]);
  assert.deepEqual(NETWORK_CHECKS, ["format_supported", "duration"]);
  assert.deepEqual(STATUSES, ["pass", "fail", "warn", "skip"]);
  assert.deepEqual(PRESETS, ["instagram-carousel", "instagram-feed", "networks", "margin", "none"]);
});

/* ---------- the networks table ---------- */

test("redes.json loads, names every required network and is internally consistent", () => {
  assert.equal(TABLE.format_version, 1);
  assert.match(TABLE.checked_on, /^\d{4}-\d{2}-\d{2}$/);
  const required = ["reels", "stories", "feed", "tiktok", "shorts", "youtube", "linkedin", "x", "whatsapp_status", "kwai", "ads_meta", "ads_meta_feed", "ads_tiktok"];
  for (const id of required) assert.ok(TABLE.networks[id], `falta a rede ${id}`);
  for (const [name, size] of Object.entries({ "9:16": [1080, 1920], "4:5": [1080, 1350], "3:4": [1080, 1440], "1:1": [1080, 1080], "16:9": [1920, 1080] })) {
    assert.deepEqual([TABLE.formats[name].width, TABLE.formats[name].height], size, name);
    const zone = TABLE.formats[name].safe_zone;
    assert.ok(zone.top + zone.bottom < size[1] && zone.left + zone.right < size[0], `${name}: recuos maiores que o quadro`);
  }
  for (const [format, ids] of Object.entries(TABLE.defaults_by_format)) {
    assert.ok(TABLE.formats[format], `defaults_by_format: formato desconhecido ${format}`);
    for (const id of ids) assert.ok(TABLE.networks[id].formats.includes(format), `defaults_by_format: ${id} não aceita ${format}`);
  }
  for (const [id, network] of Object.entries(TABLE.networks)) {
    assert.ok(network.label && typeof network.label === "string", `${id}: label`);
    assert.ok(network.formats.length > 0, `${id}: formats`);
    assert.ok(network.formats.includes(network.recommended_format), `${id}: recommended_format fora de formats`);
    for (const format of network.formats) {
      assert.ok(TABLE.formats[format], `${id}: formato desconhecido ${format}`);
      const zone = network.safe_zone[format];
      assert.ok(zone, `${id}: sem safe_zone para ${format}`);
      const size = TABLE.formats[format];
      assert.ok(zone.top + zone.bottom < size.height && zone.left + zone.right < size.width, `${id}/${format}: recuos maiores que o quadro`);
    }
    assert.ok(network.max_duration_s > 0, `${id}: max_duration_s`);
    assert.ok(network.min_duration_s > 0 && network.min_duration_s < network.max_duration_s, `${id}: min_duration_s`);
    if (network.recommended_duration_s !== null) assert.ok(network.recommended_duration_s <= network.max_duration_s, `${id}: recomendado acima do máximo`);
    assert.equal(network.loudness.lufs, -14, `${id}: loudness`);
    assert.ok(Array.isArray(network.notes) && network.notes.length > 0, `${id}: notes`);
    for (const note of network.notes) assert.doesNotMatch(note, /winget|brew install|apt install|no seu terminal/i, `${id}: nota com texto proibido`);
  }
});

test("networkFor accepts ids, aliases, labels in any case and rejects unknown names", () => {
  assert.equal(networkFor("reels", TABLE).id, "reels");
  assert.equal(networkFor("Instagram-Reels", TABLE).id, "reels");
  assert.equal(networkFor("twitter", TABLE).id, "x");
  assert.equal(networkFor("whatsapp-status", TABLE).id, "whatsapp_status");
  assert.equal(networkFor("WHATSAPP_STATUS", TABLE).id, "whatsapp_status");
  assert.equal(normalizeNetworkName(" Anúncios TikTok "), "anuncios-tiktok");
  assert.throws(() => networkFor("myspace", TABLE), (error) => error instanceof AppError && error.code === "unknown_network" && /reels/.test(error.fix));
});

test("resolveNetworks dedupes, flags format support and defaultNetworks follows the format", () => {
  const resolved = resolveNetworks("reels, tiktok,reels,youtube", "9:16", TABLE);
  assert.deepEqual(resolved.map((network) => network.id), ["reels", "tiktok", "youtube"]);
  assert.equal(resolved[0].supports_format, true);
  assert.equal(resolved[2].supports_format, false);
  assert.equal(resolveNetworks(["x"], "1:1", TABLE)[0].recommended_for_format, false);
  assert.equal(resolveNetworks(["x"], null, TABLE)[0].supports_format, null, "without a format the flags stay open");
  assert.deepEqual(resolveNetworks("", null, TABLE), []);
  assert.deepEqual(defaultNetworks("9:16", TABLE).map((network) => network.id), ["reels", "tiktok", "shorts"]);
  assert.deepEqual(defaultNetworks("4:5", TABLE).map((network) => network.id), ["feed"]);
  assert.deepEqual(defaultNetworks("16:9", TABLE).map((network) => network.id), ["youtube"]);
  assert.deepEqual(defaultNetworks("777x333", TABLE), []);
  assert.ok(listNetworks(TABLE).every((network) => network.id && network.label && network.formats.length));
});

test("safeArea scales the insets to the frame size and unionSafeArea keeps the strictest", () => {
  const full = safeArea("reels", "9:16", 1080, 1920, TABLE);
  assert.deepEqual([full.x, full.y, full.w, full.h], [70, 250, 1080 - 70 - 180, 1920 - 250 - 420]);
  const half = safeArea("reels", "9:16", 540, 960, TABLE);
  assert.deepEqual([half.x, half.y, half.w, half.h], [35, 125, 415, 625]);
  assert.equal(half.insets.right, 90);
  assert.equal(safeArea("reels", "16:9", 1920, 1080, TABLE).format, "16:9", "a network without the format falls back to the format's own zone");
  assert.equal(safeArea(null, "4:5", 1080, 1350, TABLE).insets.top, 120);
  assert.equal(safeArea("reels", "777x333", 777, 333, TABLE), null);
  assert.deepEqual(safeInsets("tiktok", "9:16", TABLE), { top: 160, bottom: 400, left: 60, right: 160 });
  const union = unionSafeArea([safeArea("reels", "9:16", 1080, 1920, TABLE), safeArea("tiktok", "9:16", 1080, 1920, TABLE), safeArea("shorts", "9:16", 1080, 1920, TABLE)], 1080, 1920);
  assert.deepEqual(union.insets, { top: 250, bottom: 500, left: 70, right: 180 });
  assert.deepEqual(union.networks, ["reels", "tiktok", "shorts"]);
  assert.equal(unionSafeArea([null, null], 1080, 1920), null);
});

/* ---------- networks and sound ---------- */

test("formatSupport grades each network: fail when it refuses the format, warn when another one works better", () => {
  const items = formatSupport("9:16", resolveNetworks("reels,youtube,x", null, TABLE));
  assert.deepEqual(items.map((item) => [item.network, item.status]), [["reels", "pass"], ["youtube", "fail"], ["x", "warn"]]);
  assert.match(items[0].summary, /9:16 é o formato recomendado de Instagram Reels/);
  assert.equal(items[0].fix, null);
  assert.match(items[1].summary, /9:16 não serve para YouTube, que usa 16:9/);
  assert.match(items[1].fix, /render --format 16:9/);
  assert.match(items[2].summary, /é aceito em X, mas o formato que rende mais é 16:9/);
  assert.deepEqual(items[2].details, [{ format: "9:16", accepted: ["16:9", "1:1", "9:16"], recommended: "16:9" }]);
  const custom = formatSupport("800x500", resolveNetworks("reels", null, TABLE), { width: 800, height: 500 });
  assert.equal(custom[0].status, "warn");
  assert.match(custom[0].summary, /800×500 não é um formato conhecido; Instagram Reels usa 9:16/);
  assert.match(custom[0].fix, /--format/);
  assert.deepEqual(formatSupport("9:16", []), []);
});

test("durationCheck grades each network: fail above the max or below the min, warn above the recommended", () => {
  const networks = resolveNetworks("reels,stories,youtube", "9:16", TABLE);
  const long = durationCheck(95, networks);
  assert.deepEqual(long.map((item) => [item.network, item.status]), [["reels", "warn"], ["stories", "fail"], ["youtube", "pass"]]);
  assert.match(long[1].summary, /máximo de Instagram Stories é 60 s/);
  assert.match(long[0].summary, /passa dos 90 s recomendados/);
  assert.deepEqual(long[0].details, [{ duration: 95, min: 3, max: 180, recommended: 90 }]);
  assert.ok(long[0].fix && long[1].fix);
  assert.equal(long[2].fix, null);
  const short = durationCheck(6, networks);
  assert.ok(short.every((item) => item.status === "pass"));
  assert.match(short[0].summary, /6 s, dentro do limite de Instagram Reels \(3 min\)/);
  const tooShort = durationCheck(2, resolveNetworks("reels", null, TABLE))[0];
  assert.equal(tooShort.status, "fail", "below the 3 s minimum");
  assert.match(tooShort.summary, /pede pelo menos 3 s/);
  assert.match(tooShort.fix, /3 s/);
  assert.equal(durationCheck(90.04, resolveNetworks("reels", null, TABLE))[0].status, "pass", "the container's rounding raises no warning");
  assert.equal(durationCheck(180.2, resolveNetworks("reels", null, TABLE))[0].status, "fail");
  assert.deepEqual([formatLimit(90), formatLimit(140), formatLimit(180), formatLimit(900), formatLimit(43200), formatLimit(null)], ["90 s", "2 min 20 s", "3 min", "15 min", "12 h", "sem limite"]);
  assert.deepEqual(durationCheck(10, []), []);
});

test("loudnessCheck accepts -14 ±1.5 LU with the peak under -1 dBTP, warns on an overshoot and skips silence", () => {
  const fine = loudnessCheck({ integrated_lufs: -14.3, true_peak_dbtp: -1.4 });
  assert.equal(fine.status, "pass");
  assert.equal(fine.fix, null);
  assert.match(fine.summary, /-14\.3 LUFS, pico real de -1\.4 dBTP/);
  assert.equal(loudnessCheck({ integrated_lufs: -15.5, true_peak_dbtp: -1 }).status, "pass", "at the edge of the tolerance");
  const quiet = loudnessCheck({ integrated_lufs: -18.2, true_peak_dbtp: -6 });
  assert.equal(quiet.status, "fail");
  assert.equal(quiet.offset, -4.2);
  assert.match(quiet.summary, /-4\.2 LU do alvo/);
  assert.match(quiet.fix, /--lufs -14/);
  const overshoot = loudnessCheck({ integrated_lufs: -14.1, true_peak_dbtp: -0.8 });
  assert.equal(overshoot.status, "warn", "what the encoder gives back of the peak is a warning, not a fail");
  assert.match(overshoot.summary, /pico real de -0\.8 dBTP acima de -1/);
  assert.match(overshoot.fix, /--peak -1\.5/);
  const clipping = loudnessCheck({ integrated_lufs: -14, true_peak_dbtp: 0.3 });
  assert.equal(clipping.status, "fail", "above 0 dBTP the sound clips");
  assert.match(clipping.summary, /pico real de 0\.3 dBTP/);
  assert.equal(loudnessCheck({ integrated_lufs: -20, true_peak_dbtp: -3 }, { target: -20, tolerance: 1 }).status, "pass", "--lufs moves the target");
  assert.equal(loudnessCheck({ integrated_lufs: -14, true_peak_dbtp: null }).status, "pass", "a peak that was not measured does not reprove");
  assert.equal(loudnessCheck(null).status, "skip");
  assert.equal(loudnessCheck({ integrated_lufs: null }).status, "skip");
  assert.deepEqual([fine.target, fine.tolerance, fine.true_peak_limit], [-14, 1.5, -1]);
});

/* ---------- the commands, through render.mjs ---------- */

const tools = await checkTools();
const canMeasure = Boolean(tools.ffmpeg && tools.ffprobe);
const scratch = mkdtempSync(join(tmpdir(), "flyee-accept-test-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

/** Runs a node script and also says when its answer arrived and how long the process stayed after it. */
function runNode(args, { cwd = APP_DIR, timeoutMs = 180000 } = {}) {
  return new Promise((resolvePromise, reject) => {
    const started = Date.now();
    const child = spawn(process.execPath, args, { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let answeredAt = null;
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      answeredAt ??= Date.now() - started;
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      const endedAt = Date.now() - started;
      resolvePromise({ code, stdout, stderr, answeredAt, endedAt, lingered: answeredAt === null ? null : endedAt - answeredAt });
    });
  });
}

/** render.mjs with these arguments; `json` is the parsed answer (with --json) or null. */
async function cli(args, { json = true, ...options } = {}) {
  const run = await runNode([SCRIPT, ...args, ...(json ? ["--json"] : [])], options);
  let parsed = null;
  if (json) {
    try {
      parsed = JSON.parse(run.stdout);
    } catch {
      // the assertion shows stdout and stderr
    }
  }
  return { ...run, json: parsed };
}

/** Runs `fn` over the items, `limit` at a time, keeping the order. */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function ffmpeg(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(tools.ffmpeg.path, ["-hide_banner", "-loglevel", "error", "-y", ...args], { windowsHide: true, stdio: "ignore" });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolvePromise() : reject(new Error(`ffmpeg saiu com ${code}`))));
  });
}

const H264 = ["-c:v", "libx264", "-pix_fmt", "yuv420p"];
const lavfi = (source) => ["-f", "lavfi", "-i", source];

/** Small videos of one to three seconds, a quarter of the size, made while the first tests run. */
async function makeClips() {
  const file = (name) => join(scratch, name);
  const made = {
    moving: file("movendo.mp4"), // a test pattern that never stops: 9:16, 2 s, silent
    tone: file("tom.mp4"), // the same picture with a quiet 440 Hz tone
    still: file("parado.mp4"), // one gray frame for 2 s
    strobe: file("estrobo.mp4"), // black and white alternating on every frame
    cut: file("corte.mp4"), // black for 1 s, then white: one hard cut at 1 s
    wide: file("deitado.mp4"), // 16:9, 1 s
    tall: file("retrato.mp4"), // 3:4, 1 s: a format without usual networks
    slide: file("slide.mp4"), // 4:5, 3 s of gray: the render of a slide that never moves
    dot: file("ponto.mp4"), // gray for 2 s with a small white square crossing it: little change on average, a lot in its region
  };
  const jobs = [
    [...lavfi("testsrc2=size=270x480:rate=30:duration=2"), ...H264, made.moving],
    [...lavfi("testsrc2=size=270x480:rate=30:duration=2"), ...lavfi("sine=frequency=440:sample_rate=48000:duration=2"), ...H264, "-c:a", "aac", "-shortest", made.tone],
    [...lavfi("color=c=gray:s=270x480:r=30:d=2"), ...H264, made.still],
    [...lavfi("color=c=black:s=270x480:r=30:d=2,format=yuv420p,geq=lum=if(eq(mod(N\\,2)\\,0)\\,16\\,235):cb=128:cr=128"), ...H264, made.strobe],
    [...lavfi("color=c=black:s=270x480:r=30:d=1"), ...lavfi("color=c=white:s=270x480:r=30:d=1"), "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0", ...H264, made.cut],
    [...lavfi("color=c=gray:s=480x270:r=30:d=1"), ...H264, made.wide],
    [...lavfi("color=c=gray:s=270x360:r=30:d=1"), ...H264, made.tall],
    [...lavfi("color=c=gray:s=540x676:r=30:d=3"), ...H264, made.slide],
    [...lavfi("color=c=gray:s=270x480:r=30:d=2,format=yuv420p,geq=lum=if(between(X\\,20+N*3\\,29+N*3)*between(Y\\,200\\,209)\\,235\\,128):cb=128:cr=128"), ...H264, made.dot],
  ];
  await mapLimit(jobs, 4, ffmpeg);
  return made;
}
const clips = canMeasure ? makeClips() : null;
clips?.catch(() => {}); // a failure surfaces in the tests that await the clips

const byName = (result, name, network = null) => result.checks.find((check) => check.name === name && (network === null || check.network === network));
const names = (result) => result.checks.map((check) => (check.network ? `${check.name}:${check.network}` : check.name));
const output = (run) => `saída inesperada: ${run.stdout}\n${run.stderr}`;

test("render.mjs loads the group, lists the networks and refuses bad calls before opening anything", { timeout: 120000 }, async () => {
  const notes = join(scratch, "notas.txt");
  writeFileSync(notes, "nem página nem vídeo");
  const fake = join(scratch, "vazio.mp4");
  writeFileSync(fake, "");
  const calls = {
    help: ["help"],
    noInput: ["accept"],
    badSafe: ["accept", EXAMPLE, "--safe", "tiktok"],
    both: ["accept", EXAMPLE, "--beats", "x.json", "--bpm", "120"],
    missing: ["accept", join(APP_DIR, "runtime", "nao-existe.html")],
    neither: ["accept", notes],
    twoPages: ["accept", EXAMPLE, "--page", EXAMPLE],
    twoVideos: ["accept", fake, "--video", fake],
    notAPage: ["accept", fake, "--page", notes],
    noNetwork: ["accept", EXAMPLE, "--networks", ","],
    unknown: ["accept", EXAMPLE, "--networks", "reels,orkut"],
    badShare: ["accept", EXAMPLE, "--min-on-beat", "2"],
    badStillBy: ["accept", EXAMPLE, "--still-by", "media"],
    listed: ["networks"],
  };
  const entries = Object.entries(calls);
  const runs = await mapLimit(entries, 6, ([, args]) => cli(args));
  const r = Object.fromEntries(entries.map(([key], index) => [key, runs[index]]));
  for (const [key, run] of Object.entries(r)) assert.ok(run.json, `${key}: ${output(run)}`);

  assert.equal(r.help.json.ok, true);
  for (const word of ["accept", "networks", "--safe", "--networks", "--page", "--video", "instagram-carousel", "--tolerance", "--min-on-beat", "--max-flashes", "--max-still", "--still-by", "--lufs"]) assert.ok(r.help.json.text.includes(word), `a ajuda traz ${word}`);
  for (const key of ["noInput", "badSafe", "both", "neither", "twoPages", "twoVideos", "notAPage", "noNetwork", "badShare", "badStillBy"]) {
    assert.equal(r[key].code, 2, key);
    assert.equal(r[key].json.error.code, "usage", key);
  }
  assert.ok(r.badSafe.json.error.fix.includes("instagram-carousel") && r.badSafe.json.error.fix.includes("networks"));
  assert.ok(r.badStillBy.json.error.fix.includes("regions") && r.badStillBy.json.error.fix.includes("mean"));
  assert.match(r.neither.json.error.message, /\.html.*\.mp4/);
  assert.equal(r.missing.json.error.code, "file_not_found");
  assert.equal(r.unknown.code, 1);
  assert.equal(r.unknown.json.error.code, "unknown_network", "an unknown network stops the call before the browser opens");
  assert.match(r.unknown.json.error.fix, /reels \(Instagram Reels\)/);

  const listed = r.listed.json;
  assert.equal(r.listed.code, 0);
  assert.equal(listed.command, "networks");
  assert.equal(listed.checked_on, TABLE.checked_on);
  assert.ok(listed.note && listed.loudness_note);
  assert.deepEqual(listed.formats, TABLE.formats);
  assert.deepEqual(listed.defaults_by_format, TABLE.defaults_by_format);
  assert.deepEqual(listed.networks.map((network) => network.id), Object.keys(TABLE.networks));
  const reels = listed.networks.find((network) => network.id === "reels");
  assert.deepEqual(reels.safe_zone, TABLE.networks.reels.safe_zone);
  assert.equal(reels.label, "Instagram Reels");
  assert.deepEqual([reels.min_duration_s, reels.max_duration_s, reels.recommended_duration_s], [3, 180, 90]);
  assert.ok(reels.aliases.includes("instagram"));
  assert.ok(reels.notes.length > 0);
  assert.equal(listed.table, "references/redes.json");
  assert.equal(listed.guide, "references/aceite.md");
  const human = await cli(["networks"], { json: false });
  assert.match(human.stdout, /Redes conhecidas \(conferidas em \d{4}-\d{2}-\d{2}\):/);
  assert.match(human.stdout, /reels\s+Instagram Reels · 9:16 \(melhor 9:16\) · até 180 s · recomendado 90 s/);
  assert.match(human.stdout, /Tabela: references\/redes\.json · Guia: references\/aceite\.md/);
});

test("releaseBrowser lets the command end while the closed browser is still going away", { timeout: 60000 }, async (t) => {
  // The command used to print its verdict and then stay alive until the killed browser had
  // really gone, which on a busy Windows machine takes from seconds to minutes.
  const script = join(scratch, "solta-navegador.mjs");
  writeFileSync(script, [
    'import { spawn } from "node:child_process";',
    `import { releaseBrowser } from ${JSON.stringify(pathToFileURL(join(APP_DIR, "scripts", "commands", "accept.mjs")).href)};`,
    "// a stand-in for a browser that takes half a minute to go away after it was told to close, with the same pipes",
    'const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"], windowsHide: true });',
    'child.stderr.on("data", () => {});',
    'child.stdio[4].on("data", () => {});',
    "let closed = false;",
    "await releaseBrowser({ child, close: async () => { closed = true; } });",
    "process.stdout.write(JSON.stringify({ closed, running: child.exitCode === null && child.signalCode === null, pid: child.pid }));",
  ].join("\n"));
  const run = await runNode([script], { timeoutMs: 90000 });
  let answer = null;
  try {
    answer = JSON.parse(run.stdout);
  } finally {
    try {
      if (answer?.pid) process.kill(answer.pid);
    } catch {
      // already gone with its parent
    }
  }
  assert.equal(run.code, 0, run.stderr);
  assert.equal(answer.closed, true, "the browser was told to close");
  assert.equal(answer.running, true, "the stand-in was still running when the command finished");
  t.diagnostic(`o processo terminou ${run.endedAt} ms depois de começar, ${run.lingered} ms depois de responder`);
  assert.ok(run.endedAt < 20000, `o processo esperou o navegador sair: ${run.endedAt} ms`);
});

test("accept on the starter page with destinations: the shape of the result, the networks' zone and the per-network checks", { timeout: 240000 }, async (t) => {
  if (!tools.browser) {
    t.skip("sem navegador nesta máquina");
    return;
  }
  const run = await cli(["accept", EXAMPLE, "--format", "9:16", "--networks", "reels,tiktok,shorts", "--bpm", "120", "--loop"]);
  const json = run.json;
  assert.ok(json, output(run));
  assert.equal(run.code, 0);
  assert.equal(json.ok, true);
  assert.equal(json.command, "accept");
  assert.equal(json.interface_version, 1);
  assert.equal(json.mode, "page");
  assert.equal(json.page, "runtime/exemplo.html");
  assert.equal(json.video, null);
  assert.equal(json.media, null);
  assert.equal(json.format, "9:16");
  assert.equal(json.width, 1080);
  assert.equal(json.height, 1920);
  assert.equal(json.duration, 6);
  assert.equal(json.fps, 30);
  assert.equal(json.min_text, 44);
  assert.deepEqual(json.networks, ["reels", "tiktok", "shorts"]);
  assert.deepEqual(json.network_labels, { reels: "Instagram Reels", tiktok: "TikTok", shorts: "YouTube Shorts" });
  assert.equal(json.networks_default, false);
  assert.deepEqual(json.safe, {
    preset: "networks",
    rect: { x: 70, y: 250, w: 830, h: 1170 },
    corners: [],
    margin: null,
    networks: ["reels", "tiktok", "shorts"],
    insets: { top: 250, bottom: 500, left: 70, right: 180 },
  });
  assert.deepEqual(json.beats, { source: "bpm", file: null, bpm: 120, count: 13 });
  assert.equal(json.cuts, 2);
  assert.equal(json.cuts_source, "page");
  assert.ok(json.samples >= 25, `${json.samples} instantes lidos`);
  assert.equal(json.report, null);
  assert.equal(json.guide, "references/aceite.md");
  assert.deepEqual(json.limits, { min_text: 44, tolerance_frames: 1, tolerance_s: 0.0333, min_on_beat: 1, max_flashes: 3, max_still: 1.5, still_by: "regions", still_mean: 0.5, still_local: 6, lufs: -14, lufs_tolerance: 1.5, true_peak: -1 });
  assert.deepEqual(names(json), [...CHECKS, "format_supported:reels", "format_supported:tiktok", "format_supported:shorts", "duration:reels", "duration:tiktok", "duration:shorts"], "every check, in order");
  assert.ok(json.checks.every((check) => STATUSES.includes(check.status) && typeof check.summary === "string" && Array.isArray(check.details)));
  assert.ok(json.checks.filter((check) => check.status === "fail" || check.status === "warn").every((check) => typeof check.fix === "string" && check.fix), "every fail and warn says what to do");
  assert.ok(json.checks.filter((check) => check.status === "pass" || check.status === "skip").every((check) => check.fix === undefined));
  assert.equal(typeof json.passed, "boolean");
  assert.equal(json.passed, json.checks.every((check) => check.status !== "fail"));
  assert.deepEqual(json.score, { passed: json.counts.pass, failed: json.counts.fail, warned: json.counts.warn, skipped: json.counts.skip });
  assert.equal(byName(json, "page").status, "pass");
  assert.equal(byName(json, "first_frame_readable").status, "pass");
  assert.ok(byName(json, "first_frame_readable").details[0].size >= json.min_text, "the cover's title is readable");
  assert.equal(byName(json, "text_size").status, "pass");
  assert.equal(byName(json, "cuts_on_beat").status, "pass");
  assert.deepEqual(byName(json, "cuts_on_beat").details, []);
  const safeArea = byName(json, "safe_area");
  assert.equal(safeArea.status, "pass", safeArea.summary);
  assert.match(safeArea.summary, /Instagram Reels, TikTok, YouTube Shorts/);
  const loop = byName(json, "loop_seamless");
  if (tools.ffmpeg) {
    assert.ok(["pass", "warn", "fail"].includes(loop.status), loop.summary);
    assert.ok(loop.details[0].ssim >= 0 && loop.details[0].ssim <= 1);
    assert.equal(loop.details[0].last, 5.966667);
    assert.equal(loop.details[0].source, "page");
  } else assert.equal(loop.status, "skip");
  for (const name of ["flashes", "dead_time", "loudness"]) {
    assert.equal(byName(json, name).status, "skip");
    assert.match(byName(json, name).summary, /--video/);
  }
  for (const id of json.networks) {
    assert.equal(byName(json, "format_supported", id).status, "pass");
    const duration = byName(json, "duration", id);
    assert.equal(duration.status, "pass", duration.summary);
    assert.equal(duration.details[0].duration, 6, "without a video the duration is the film's");
  }
  assert.deepEqual(json.warnings.filter((warning) => warning.includes("erros")), []);
});

/**
 * A page the test controls: a settled title, a small note and a logo over the "1/N" counter
 * between 1.5 s and 1.95 s, one cut at 1 s, and a last frame identical to the first.
 */
const FIXTURE_PAGE = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><style>html,body{margin:0;background:#101010}canvas{display:block}</style></head>
<body><canvas id="c" width="1080" height="1350"></canvas>
<script>
  const canvas = document.getElementById("c");
  const g = canvas.getContext("2d");
  window.film = { duration: 2, width: 1080, height: 1350, fps: 30, background: "#101010", cuts: [1] };
  window.setFormat = ({ width, height }) => { canvas.width = width; canvas.height = height; window.film.width = width; window.film.height = height; };
  const extrasOn = (t) => t >= 1.5 && t < 1.95;
  window.seek = (t) => {
    const W = canvas.width, H = canvas.height;
    g.fillStyle = "#101010"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#F4F1EA"; g.font = "800 96px sans-serif"; g.textBaseline = "top";
    g.fillText("Título fixo", 100, 300);
    if (extrasOn(t)) {
      g.font = "500 30px sans-serif"; g.fillText("nota pequena", 100, 600);
      g.fillStyle = "#E6C15A"; g.fillRect(930, 10, 120, 50);
    }
    return true;
  };
  window.boxes = (t) => {
    const list = [{ role: "text", x: 100, y: 300, w: 880, h: 200, size: 96, text: "Título fixo" }];
    if (extrasOn(t)) {
      list.push({ role: "text", x: 100, y: 600, w: 400, h: 40, size: 30, text: "nota pequena" });
      list.push({ role: "logo", x: 930, y: 10, w: 120, h: 50 });
    }
    return list;
  };
</script></body></html>`;

test("accept on a carousel slide, page first and video first: every verdict, the same checks both ways and the reports", { timeout: 480000 }, async (t) => {
  if (!tools.browser || !canMeasure) {
    t.skip("sem navegador ou sem ffmpeg nesta máquina");
    return;
  }
  const { slide } = await clips;
  const page = join(scratch, "fixture.html");
  writeFileSync(page, FIXTURE_PAGE);
  const report = join(scratch, "relatorio.json");
  const beatsFile = join(scratch, "beats.json");
  writeFileSync(beatsFile, JSON.stringify({ bpm: 120, offset: 0, beats: [0, 0.5, 1, 1.5], downbeats: [0] }));

  // the call a carousel app makes (the carousel preset at 4:5, a tempo the cut misses, the render
  // of the slide) and, at the same time, the page's own size with a uniform margin and beats from a file
  const carousel = ["--format", "4:5", "--safe", "instagram-carousel", "--loop", "--bpm", "100", "--min-text", "44", "--every", "0.5"];
  const [strict, loose] = await Promise.all([
    cli(["accept", page, ...carousel, "--video", slide, "--out", report]),
    cli(["accept", page, "--margin", "5", "--every", "0.5", "--beats", beatsFile]),
  ]);
  const json = strict.json;
  assert.ok(json, output(strict));
  assert.equal(json.ok, true);
  assert.equal(json.mode, "page");
  assert.equal(json.format, "4:5");
  assert.equal(json.width, 1080);
  assert.equal(json.height, 1350);
  assert.equal(json.duration, 2);
  assert.equal(json.samples, 8, "0, 0.5, 1, 1.5, the beats at 0.6, 1.2 and 1.8, and the last frame");
  assert.equal(json.cuts, 1);
  assert.deepEqual(json.beats, { source: "bpm", file: null, bpm: 100, count: 4 });
  assert.deepEqual(json.networks, [], "a page first names no network by itself");
  assert.deepEqual(json.network_labels, {});
  assert.equal(json.safe.preset, "instagram-carousel");
  assert.equal(json.safe.margin, 72);
  assert.deepEqual(json.safe.rect, { x: 72, y: 72, w: 936, h: 1206 });
  assert.deepEqual(json.safe.corners.map((corner) => corner.name), ["counter", "sound"]);
  assert.deepEqual([json.media.format, json.media.width, json.media.height, json.media.duration, json.media.has_audio], ["4:5", 540, 676, 3, false]);
  assert.deepEqual(names(json), CHECKS);
  assert.equal(byName(json, "page").status, "pass");
  assert.equal(byName(json, "first_frame_readable").status, "pass");
  assert.equal(byName(json, "first_frame_readable").details[0].size, 96);
  const safeArea = byName(json, "safe_area");
  assert.equal(safeArea.status, "fail", safeArea.summary);
  assert.equal(safeArea.details.length, 1, "the title stays inside; only the logo leaves");
  assert.equal(safeArea.details[0].role, "logo");
  assert.equal(safeArea.details[0].time, 1.5);
  assert.equal(safeArea.details[0].until, 1.8);
  assert.equal(safeArea.details[0].instants, 2, "seen at 1.5 s and at the beat 1.8 s");
  assert.deepEqual(safeArea.details[0].edges, ["top", "right"]);
  assert.deepEqual(safeArea.details[0].corners, ["counter"]);
  assert.ok(safeArea.summary.includes("contador 1/N"), safeArea.summary);
  assert.match(safeArea.fix, /contador 1\/N/);
  const textSize = byName(json, "text_size");
  assert.equal(textSize.status, "warn", textSize.summary);
  assert.deepEqual(textSize.details, [{ time: 1.5, size: 30, text: "nota pequena" }, { time: 1.8, size: 30, text: "nota pequena" }]);
  const cuts = byName(json, "cuts_on_beat");
  assert.equal(cuts.status, "fail", cuts.summary);
  assert.deepEqual(cuts.details, [{ cut: 1, nearest: 1.2, delta: -0.2 }]);
  const loop = byName(json, "loop_seamless");
  assert.equal(loop.status, "pass", loop.summary);
  assert.ok(loop.details[0].ssim >= 0.985);
  assert.equal(loop.details[0].last, 1.966667);
  assert.equal(byName(json, "flashes").status, "pass");
  const dead = byName(json, "dead_time");
  assert.equal(dead.status, "warn", dead.summary);
  assert.ok(dead.details[0].seconds >= 1.5);
  assert.ok(dead.fix);
  assert.equal(byName(json, "loudness").status, "skip");
  assert.match(byName(json, "loudness").summary, /não tem áudio/);
  assert.ok(json.warnings.some((warning) => warning.includes("dura")), "a video of another length is flagged");
  assert.equal(json.passed, false);
  assert.deepEqual(json.counts, { pass: 4, fail: 2, warn: 2, skip: 1 });
  assert.deepEqual(json.score, { passed: 4, failed: 2, warned: 2, skipped: 1 });
  assert.equal(json.report, report);
  assert.ok(existsSync(report));
  const saved = JSON.parse(readFileSync(report, "utf8"));
  assert.equal(saved.command, "accept");
  assert.equal(saved.app.name, "video-render");
  assert.equal(saved.interface_version, 1);
  assert.deepEqual(saved.checks, json.checks);
  assert.ok(!existsSync(join(scratch, "slide.aceite.json")), "a page first writes a report only where --out says");

  assert.ok(loose.json, output(loose));
  assert.equal(loose.json.format, "4:5", "the page's own size names the format");
  assert.deepEqual(loose.json.safe, { preset: "margin", rect: { x: 5, y: 5, w: 1070, h: 1340 }, corners: [], margin: 5, networks: [], insets: { top: 5, bottom: 5, left: 5, right: 5 } });
  assert.equal(loose.json.beats.source, "file");
  assert.equal(loose.json.beats.count, 4);
  assert.equal(byName(loose.json, "safe_area").status, "pass", byName(loose.json, "safe_area").summary);
  assert.equal(byName(loose.json, "cuts_on_beat").status, "pass");
  assert.equal(byName(loose.json, "text_size").status, "warn");
  assert.equal(byName(loose.json, "loop_seamless").status, "skip", "not asked");
  for (const name of ["flashes", "dead_time", "loudness"]) assert.equal(byName(loose.json, name).status, "skip");
  assert.equal(loose.json.passed, true, "a warning does not reprove");
  assert.equal(loose.json.report, null);

  // the same piece with the video first: the same checks, plus the destination's, and a report next to the video
  const reversed = await cli(["accept", slide, "--page", page, ...carousel, "--networks", "feed"]);
  const twin = reversed.json;
  assert.ok(twin, output(reversed));
  assert.equal(twin.mode, "video");
  assert.deepEqual([twin.format, twin.width, twin.height, twin.duration, twin.fps], [json.format, json.width, json.height, json.duration, json.fps], "the page's layout names the frame either way");
  assert.deepEqual(twin.safe, json.safe, "an explicit --safe wins over the networks' zone");
  assert.deepEqual(twin.checks.filter((check) => !check.network), json.checks, "page first or video first, the same checks say the same");
  assert.deepEqual(twin.networks, ["feed"]);
  assert.equal(twin.networks_default, false);
  assert.deepEqual(names(twin), [...CHECKS, "format_supported:feed", "duration:feed"]);
  assert.equal(byName(twin, "format_supported", "feed").status, "pass");
  const feedDuration = byName(twin, "duration", "feed");
  assert.equal(feedDuration.status, "pass", feedDuration.summary);
  assert.equal(feedDuration.details[0].duration, 3, "with a video, the duration is the video's");
  assert.equal(twin.report, join(scratch, "slide.aceite.json"));
  assert.deepEqual(JSON.parse(readFileSync(twin.report, "utf8")).checks, twin.checks);
});

test("a page without seek fails the page check at once, stops there, reads as a human line and does not linger", { timeout: 240000 }, async (t) => {
  if (!tools.browser) {
    t.skip("sem navegador nesta máquina");
    return;
  }
  const bad = join(scratch, "sem-seek.html");
  writeFileSync(bad, "<!doctype html><html><body><p>sem seek</p><script>window.film = { duration: 2, width: 1080, height: 1350 };</script></body></html>");
  const run = await cli(["accept", bad, "--safe", "none"]);
  const json = run.json;
  assert.ok(json, output(run));
  assert.equal(run.code, 0);
  assert.equal(json.ok, true, "a failed check is data, not an error");
  assert.equal(json.passed, false);
  assert.equal(json.checks.length, 1);
  assert.equal(json.checks[0].name, "page");
  assert.equal(json.checks[0].status, "fail");
  assert.equal(json.checks[0].details[0].code, "page_no_seek");
  assert.ok(json.checks[0].fix);
  assert.deepEqual(json.counts, { pass: 0, fail: 1, warn: 0, skip: 0 });
  assert.deepEqual(json.score, { passed: 0, failed: 1, warned: 0, skipped: 0 });
  const human = commands.accept.text(json);
  assert.ok(human.includes("REPROVADO"), human);
  assert.ok(human.includes("✗ Página: A página não define window.seek(t)."), human);
  assert.ok(human.includes("    Como resolver: "), human);
  // The verdict is ready as soon as the page has loaded; what used to take minutes was the
  // process staying alive after printing it, until the closed browser had really gone.
  t.diagnostic(`resposta em ${run.answeredAt} ms; o processo terminou ${run.lingered} ms depois`);
  // alone it ends about 1.5 s after answering; with the whole suite starting browsers at once it has
  // taken 21 s. The bug this guards against kept it alive for 2 to 4 minutes.
  assert.ok(run.lingered < 45000, `o comando ficou ${run.lingered} ms vivo depois de responder`);
});

/* ---------- a finished video against the networks ---------- */

test("accept on a finished video: the report next to it, the usual networks of the format and what only the page can tell", { timeout: 300000 }, async (t) => {
  if (!canMeasure) {
    t.skip("sem ffmpeg nesta máquina");
    return;
  }
  const { moving, tall } = await clips;
  const textReport = join(scratch, "movendo-texto.json");
  const namedReport = join(scratch, "nomeadas.json");
  const [run, human, named, unknown, portrait] = await Promise.all([
    cli(["accept", moving]),
    cli(["accept", moving, "--out", textReport], { json: false }),
    cli(["accept", moving, "--networks", "stories,YouTube", "--safe", "instagram-feed", "--out", namedReport]),
    cli(["accept", moving, "--networks", "orkut"]),
    cli(["accept", tall, "--safe", "networks"]),
  ]);
  const json = run.json;
  assert.ok(json, output(run));
  assert.equal(run.code, 0);
  assert.equal(json.ok, true);
  assert.equal(json.command, "accept");
  assert.equal(json.mode, "video");
  assert.equal(json.page, null);
  assert.equal(json.video, moving);
  assert.deepEqual([json.format, json.width, json.height, json.duration, json.fps], ["9:16", 270, 480, 2, 30], "270×480 is 9:16");
  assert.deepEqual([json.media.format, json.media.width, json.media.height, json.media.duration, json.media.has_audio], ["9:16", 270, 480, 2, false]);
  assert.deepEqual(json.networks, ["reels", "tiktok", "shorts"]);
  assert.equal(json.networks_default, true);
  assert.deepEqual(json.network_labels, { reels: "Instagram Reels", tiktok: "TikTok", shorts: "YouTube Shorts" });
  assert.equal(json.safe.preset, "networks");
  assert.deepEqual(json.safe.networks, ["reels", "tiktok", "shorts"]);
  assert.deepEqual(json.safe.rect, { x: 17.5, y: 62.5, w: 207.5, h: 292.5 }, "the networks' zone at a quarter of the size");
  assert.equal(json.min_text, 11);
  assert.equal(json.cuts_source, null);
  assert.deepEqual(names(json), [...CHECKS, "format_supported:reels", "format_supported:tiktok", "format_supported:shorts", "duration:reels", "duration:tiktok", "duration:shorts"]);
  for (const name of ["page", "first_frame_readable", "safe_area", "text_size"]) {
    assert.equal(byName(json, name).status, "skip", `${name} needs the page`);
    assert.match(byName(json, name).summary, /--page/, `${name} says the page was not given`);
  }
  assert.equal(byName(json, "cuts_on_beat").status, "skip");
  assert.match(byName(json, "cuts_on_beat").summary, /--beats.*--page/);
  assert.equal(byName(json, "loop_seamless").status, "skip");
  assert.equal(byName(json, "flashes").status, "pass", byName(json, "flashes").summary);
  assert.equal(byName(json, "dead_time").status, "pass", byName(json, "dead_time").summary);
  assert.equal(byName(json, "loudness").status, "skip");
  assert.match(byName(json, "loudness").summary, /não tem áudio/);
  for (const id of json.networks) assert.equal(byName(json, "format_supported", id).status, "pass");
  assert.deepEqual(["reels", "tiktok", "shorts"].map((id) => byName(json, "duration", id).status), ["fail", "fail", "pass"], "2 s is under the 3 s minimum of Reels and TikTok");
  assert.match(byName(json, "duration", "reels").summary, /Instagram Reels pede pelo menos 3 s/);
  assert.ok(json.checks.filter((check) => check.status === "fail" || check.status === "warn").every((check) => check.fix), "every fail and warn says what to do");
  assert.equal(json.passed, false);
  assert.deepEqual(json.score, { passed: 6, failed: 2, warned: 0, skipped: 7 });
  const reportFile = join(scratch, "movendo.aceite.json");
  assert.equal(json.report, reportFile, "a video first writes <video>.aceite.json next to it");
  const saved = JSON.parse(readFileSync(reportFile, "utf8"));
  assert.equal(saved.command, "accept");
  assert.equal(saved.app.name, "video-render");
  assert.deepEqual(saved.checks, json.checks);
  assert.deepEqual(saved.score, json.score);

  // a human reading: one line per check, the network in parentheses, the fix under what failed
  assert.equal(human.code, 0);
  assert.match(human.stdout, /Aceite de .*movendo\.mp4 \(9:16, 270×480, 2 s, 30 fps\): REPROVADO · 6 ✓ · 2 ✗ · 0 △ · 7 ○/);
  assert.match(human.stdout, /Redes: Instagram Reels, TikTok, YouTube Shorts \(as habituais do formato\)/);
  assert.match(human.stdout, /✗ Duração \(Instagram Reels\): .*\r?\n {4}Como resolver: /);
  assert.match(human.stdout, /✓ Duração \(YouTube Shorts\): /);
  assert.match(human.stdout, /✓ Formato \(TikTok\): /);
  assert.match(human.stdout, /○ Área segura: /);
  assert.match(human.stdout, /Relatório: .*movendo-texto\.json/);

  // networks named by the caller, one of which refuses the format; the report goes where --out says
  assert.ok(named.json, output(named));
  assert.deepEqual(named.json.networks, ["stories", "youtube"], "ids and aliases in any case");
  assert.equal(named.json.networks_default, false);
  assert.equal(named.json.safe.preset, "instagram-feed", "an explicit --safe wins over the networks' zone");
  assert.deepEqual(named.json.safe.networks, []);
  const refused = byName(named.json, "format_supported", "youtube");
  assert.equal(refused.status, "fail", "9:16 does not serve YouTube");
  assert.match(refused.fix, /16:9/);
  assert.equal(byName(named.json, "format_supported", "stories").status, "pass");
  assert.equal(byName(named.json, "duration", "stories").status, "pass");
  assert.equal(named.json.passed, false);
  assert.equal(named.json.report, namedReport);
  assert.ok(existsSync(namedReport));
  assert.equal(unknown.code, 1);
  assert.equal(unknown.json.error.code, "unknown_network");

  // a format without usual networks: nothing per network, and the zone falls back to the format's
  assert.ok(portrait.json, output(portrait));
  assert.equal(portrait.json.format, "3:4");
  assert.deepEqual(portrait.json.networks, []);
  assert.equal(portrait.json.networks_default, true);
  assert.deepEqual(names(portrait.json), CHECKS);
  assert.equal(portrait.json.safe.preset, "networks");
  assert.deepEqual(portrait.json.safe.networks, []);
  assert.deepEqual(portrait.json.safe.insets, { top: 30, bottom: 50, left: 18, right: 18 }, "the 3:4 zone of the table at a quarter of the size");
  assert.ok(portrait.json.warnings.some((warning) => warning.includes("--networks")), JSON.stringify(portrait.json.warnings));
  assert.equal(portrait.json.passed, true);
  assert.ok(existsSync(join(scratch, "retrato.aceite.json")));
});

test("accept measures the sound, the flashes, the dead time, the loop and the cuts of a video", { timeout: 480000 }, async (t) => {
  if (!canMeasure) {
    t.skip("sem ffmpeg nesta máquina");
    return;
  }
  const { tone, still, strobe, cut, wide, dot } = await clips;
  const calls = {
    quiet: [tone],
    frozen: [still, "--loop"],
    patient: [still, "--max-still", "5"],
    flashing: [strobe],
    tolerant: [strobe, "--max-flashes", "60"],
    onBeat: [cut, "--bpm", "60"],
    offBeat: [cut, "--bpm", "80"],
    byChoice: [cut, "--bpm", "80", "--min-on-beat", "0", "--tolerance", "1"],
    noBeats: [cut],
    landscape: [wide],
    dotRegions: [dot],
    dotMean: [dot, "--still-by", "mean"],
  };
  const entries = Object.entries(calls);
  const runs = await mapLimit(entries, 5, ([key, args]) => cli(["accept", ...args, "--out", join(scratch, `medida-${key}.json`)]));
  const r = {};
  entries.forEach(([key], index) => {
    assert.ok(runs[index].json?.ok, `${key}: ${output(runs[index])}`);
    r[key] = runs[index].json;
  });

  // ffmpeg's plain test tone sits far below -14 LUFS; asking for its own level approves it
  const quiet = byName(r.quiet, "loudness");
  assert.equal(r.quiet.media.has_audio, true);
  assert.equal(quiet.status, "fail", JSON.stringify(quiet));
  const measured = quiet.details[0];
  assert.ok(Number.isFinite(measured.integrated_lufs) && Math.abs(measured.integrated_lufs + 14) > 1.5, `o tom mede longe de -14 LUFS, mediu ${measured.integrated_lufs}`);
  assert.deepEqual([measured.target_lufs, measured.tolerance_lu, measured.true_peak_limit_dbtp], [-14, 1.5, -1]);
  assert.match(quiet.fix, /--lufs -14/);
  const own = await cli(["accept", tone, "--lufs", String(Math.round(measured.integrated_lufs)), "--out", join(scratch, "medida-own.json")]);
  assert.ok(own.json?.ok, output(own));
  assert.equal(byName(own.json, "loudness").status, "pass", byName(own.json, "loudness").summary);
  assert.equal(own.json.limits.lufs, Math.round(measured.integrated_lufs));

  // one gray frame for 2 s: nothing moves, and its last frame is its first
  const frozen = byName(r.frozen, "dead_time");
  assert.equal(frozen.status, "warn", frozen.summary);
  assert.ok(frozen.details[0].seconds >= 1.9, `2 s parados, mediu ${frozen.details[0].seconds}`);
  assert.ok(frozen.fix);
  assert.equal(byName(r.frozen, "flashes").status, "pass");
  const seam = byName(r.frozen, "loop_seamless");
  assert.equal(seam.status, "pass", seam.summary);
  assert.equal(seam.details[0].source, "video");
  assert.ok(seam.details[0].ssim >= 0.985);
  assert.equal(r.frozen.passed, false, "2 s is under the minimum of Reels and TikTok");
  assert.equal(byName(r.patient, "dead_time").status, "pass", byName(r.patient, "dead_time").summary);
  assert.equal(r.patient.limits.max_still, 5);

  // black and white on alternate frames is a strobe, not dead time
  const flashing = byName(r.flashing, "flashes");
  assert.equal(flashing.status, "warn", flashing.summary);
  assert.ok(flashing.details[0].count > 3, `estrobo a cada quadro, contou ${flashing.details[0].count}`);
  assert.ok(flashing.fix);
  assert.equal(byName(r.flashing, "dead_time").status, "pass", "a strobe is not dead time");
  // a small square crossing a still frame: movement in its region, nearly nothing in the mean of the frame
  const byRegion = byName(r.dotRegions, "dead_time");
  assert.equal(byRegion.status, "pass", byRegion.summary);
  assert.deepEqual([r.dotRegions.limits.still_by, r.dotRegions.limits.still_local], ["regions", 6]);
  const byMean = byName(r.dotMean, "dead_time");
  assert.equal(byMean.status, "warn", byMean.summary);
  assert.ok(byMean.details[0].seconds >= 1.9, `quase 2 s parados pela média, mediu ${byMean.details[0].seconds}`);
  assert.deepEqual([r.dotMean.limits.still_by, r.dotMean.limits.still_local], ["mean", null]);
  assert.equal(byName(r.tolerant, "flashes").status, "pass", byName(r.tolerant, "flashes").summary);

  // without a page, the cuts are found in the video and judged with the looser defaults
  assert.equal(r.onBeat.cuts, 1);
  assert.equal(r.onBeat.cuts_source, "video");
  assert.deepEqual(r.onBeat.beats, { source: "bpm", file: null, bpm: 60, count: 3 });
  assert.deepEqual([r.onBeat.limits.tolerance_frames, r.onBeat.limits.min_on_beat], [2, 0.7]);
  assert.equal(byName(r.onBeat, "cuts_on_beat").status, "pass", byName(r.onBeat, "cuts_on_beat").summary);
  const offBeat = byName(r.offBeat, "cuts_on_beat");
  assert.equal(offBeat.status, "fail", offBeat.summary);
  assert.deepEqual(offBeat.details, [{ cut: 1, nearest: 0.75, delta: 0.25 }]);
  assert.match(offBeat.fix, /--page/);
  assert.equal(byName(r.byChoice, "cuts_on_beat").status, "pass", "a share of 0 accepts cuts off the beat");
  assert.deepEqual([r.byChoice.limits.tolerance_frames, r.byChoice.limits.min_on_beat], [1, 0]);
  assert.equal(byName(r.noBeats, "cuts_on_beat").status, "skip", "no beats, no judgment");
  assert.equal(r.noBeats.cuts_source, null, "without beats the video is not searched for cuts");

  // a landscape video goes to YouTube
  assert.equal(r.landscape.format, "16:9");
  assert.deepEqual(r.landscape.networks, ["youtube"]);
  assert.equal(byName(r.landscape, "format_supported", "youtube").status, "pass");
  assert.equal(byName(r.landscape, "duration", "youtube").status, "pass");
  assert.equal(r.landscape.min_text, 19.6, "44 px at 1080 wide, scaled to 480");
});

