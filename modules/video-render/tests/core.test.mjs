import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import vm from "node:vm";

import { profileInUse, sweepStaleProfiles } from "../scripts/lib/browser.mjs";
import { codecFor } from "../scripts/lib/ffmpeg.mjs";
import { FORMATS, parseFormat, renderPage } from "../scripts/lib/renderer.mjs";
import { checkTools, findBrowser } from "../scripts/lib/tools.mjs";
import { AppError, fileUrl, parseArgs, parseList, parseNumber, parseTime, seededRandom, slugify } from "../scripts/lib/util.mjs";

const APP_DIR = join(import.meta.dirname, "..");
const SCRATCH = join(tmpdir(), "flyee-video-render-tests");
mkdirSync(SCRATCH, { recursive: true });

test("parseArgs reads flags, options and positionals", () => {
  const { positionals, values } = parseArgs(["page.html", "--out", "a.mp4", "--alpha", "--fps=60"], { flags: ["alpha"], options: ["out", "fps"] });
  assert.deepEqual(positionals, ["page.html"]);
  assert.deepEqual(values, { out: "a.mp4", alpha: true, fps: "60" });
  assert.throws(() => parseArgs(["--nope"], {}), (error) => error instanceof AppError && error.code === "usage");
});

test("parseTime, parseNumber and parseList", () => {
  assert.equal(parseTime("1:30"), 90);
  assert.equal(parseTime("2.5"), 2.5);
  assert.equal(parseTime("1m05s"), 65);
  assert.equal(parseNumber("0.5", { name: "scale", min: 0.1, max: 1 }), 0.5);
  assert.equal(parseNumber(undefined, { name: "fps", fallback: 30 }), 30);
  assert.throws(() => parseNumber("3", { name: "scale", min: 0.1, max: 1 }), (error) => error.code === "usage");
  assert.throws(() => parseNumber("1.5", { name: "sub", min: 1, max: 8, integer: true }), (error) => error.code === "usage");
  assert.deepEqual(parseList(" a, b,,c "), ["a", "b", "c"]);
});

test("slugify, fileUrl and seededRandom are stable", () => {
  assert.equal(slugify("Loja X: Verão & Praia!"), "loja-x-verao-praia");
  const url = fileUrl("C:\\pasta com espaço\\pagina.html");
  assert.ok(url.startsWith("file:///"));
  assert.ok(url.includes("pasta%20com%20espa"));
  const a = seededRandom(7);
  const b = seededRandom(7);
  assert.equal(a(), b());
  assert.notEqual(seededRandom(8)(), seededRandom(9)());
});

test("formats: named, custom and invalid", () => {
  assert.deepEqual(parseFormat("9:16"), { name: "9:16", ...FORMATS["9:16"] });
  assert.deepEqual(parseFormat("720x1280"), { name: "720x1280", width: 720, height: 1280 });
  assert.equal(parseFormat(undefined), null);
  assert.throws(() => parseFormat("3:2"), (error) => error.code === "usage");
});

test("codecFor picks the encoder by extension and refuses alpha in mp4", () => {
  assert.equal(codecFor("a.mp4").name, "h264");
  assert.equal(codecFor("a.mov", { alpha: true }).name, "prores4444");
  assert.equal(codecFor("a.webm", { alpha: true }).name, "vp9");
  assert.throws(() => codecFor("a.mp4", { alpha: true }), (error) => error.code === "alpha_needs_mov");
  assert.throws(() => codecFor("a.avi"), (error) => error.code === "output_format");
});

test("motion.js: springs, tracks and the beat grid are pure functions of time", () => {
  const context = { window: {} };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(readFileSync(join(APP_DIR, "runtime", "motion.js"), "utf8"), context);
  const Motion = context.window.Motion;
  assert.ok(Motion, "motion.js define window.Motion");
  assert.equal(Motion.spring(0), 0);
  assert.ok(Math.abs(Motion.spring(2) - 1) < 1e-3, "a mola assenta em 1");
  assert.ok(Motion.spring(0.1, 200, 14) > Motion.spring(0.1, 90, 20), "mola mais rígida sobe mais rápido");
  const keys = [[0, 100], [1, 300], [2, 200]];
  assert.equal(Motion.track(0, keys), 100);
  assert.equal(Motion.track(0.99, keys), 100, "a mudança só começa no seu tempo");
  assert.ok(Math.abs(Motion.track(1.99, keys) - 300) < 3, "assenta no alvo antes da próxima mudança");
  assert.ok(Math.abs(Motion.track(5, keys) - 200) < 1e-3);
  const grid = Motion.beatGrid(120);
  assert.equal(grid.beat(4), 2);
  assert.equal(grid.bar(1, 2), 3);
  assert.equal(grid.nearest(1.3), 1.5);
  assert.equal(Motion.loopT(6.5, 6), 0.5);
  assert.equal(Motion.toFrame(1.004, 30), 1);
  const rng = Motion.rng(7);
  const first = rng();
  assert.equal(Motion.rng(7)(), first);
  const safe = Motion.safeArea("9:16");
  assert.ok(safe.x > 0 && safe.y > 0 && safe.w < 1080 && safe.h < 1920);
  const calls = [];
  const ctx = new Proxy({}, { get: (_target, name) => (...args) => calls.push([name, ...args]) });
  Motion.roundRect(ctx, 0, 0, -20, 40, 12);
  Motion.roundRect(ctx, 0, 0, 30, 0, 12);
  assert.deepEqual(calls.map((call) => call[0]), ["beginPath", "closePath", "beginPath", "closePath"], "uma forma que encolheu a nada não desenha nem quebra");
  calls.length = 0;
  Motion.roundRect(ctx, 0, 0, 30, 40, -5);
  assert.ok(calls.filter((call) => call[0] === "arcTo").every((call) => call[5] === 0), "raio negativo vira canto reto");
});

test("sweepStaleProfiles removes old idle browser profiles and keeps recent, in-use and unrelated folders", async () => {
  const { mkdtempSync, mkdirSync: mk, utimesSync, writeFileSync: write, existsSync: exists } = await import("node:fs");
  const root = mkdtempSync(join(tmpdir(), "flyee-sweep-test-"));
  const make = (name, hoursAgo, lock = null) => {
    const dir = join(root, name);
    mk(join(dir, "Crashpad"), { recursive: true });
    if (lock) write(join(dir, lock), "");
    const when = new Date(Date.now() - hoursAgo * 3600 * 1000);
    utimesSync(dir, when, when);
    return dir;
  };
  const old = make("flyee-browser-old", 3);
  const idleLock = make("flyee-browser-idle-lock", 1, "lockfile");
  const recent = make("flyee-browser-recent", 0.1);
  const busy = make("flyee-browser-busy", 3, "lockfile");
  const unrelated = make("other-profile", 30);
  try {
    // a running browser is simulated through the injected check; the real one is tested below
    const result = sweepStaleProfiles({ dir: root, inUse: (path) => path === busy });
    assert.equal(exists(old), false, "an old idle profile goes");
    assert.equal(exists(idleLock), false, "a lock file nobody holds does not keep a profile");
    assert.ok(exists(recent), "a profile younger than the age limit may belong to a render that is starting");
    assert.ok(exists(busy), "a profile a browser is using stays");
    assert.ok(exists(unrelated), "folders of other programs are never touched");
    assert.equal(result.removed, 2);
    assert.equal(sweepStaleProfiles({ dir: root, limit: 0 }).removed, 0, "the limit caps the work of one launch");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("profileInUse: a lock nobody holds is not use; on Linux and macOS a SingletonLock link is, for a day", async () => {
  const { mkdtempSync, writeFileSync: write, symlinkSync } = await import("node:fs");
  const root = mkdtempSync(join(tmpdir(), "flyee-inuse-test-"));
  try {
    assert.equal(profileInUse(root, 0), false, "an empty profile is idle");
    write(join(root, "lockfile"), "");
    if (process.platform === "win32") {
      assert.equal(profileInUse(root, 0), false, "a lockfile no browser holds can be deleted, so it is idle");
    } else {
      symlinkSync("host-123", join(root, "SingletonLock"));
      assert.equal(profileInUse(root, 3600 * 1000), true, "a recent SingletonLock means a browser may be running");
      assert.equal(profileInUse(root, 30 * 3600 * 1000), false, "a day-old SingletonLock is a crash leftover");
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the starter page renders two identical tiny videos (needs ffmpeg and a browser)", { timeout: 180000 }, async (t) => {
  const tools = await checkTools();
  if (!tools.ffmpeg || !tools.ffprobe || !findBrowser()) {
    t.skip("sem ffmpeg ou navegador nesta máquina");
    return;
  }
  const page = join(APP_DIR, "runtime", "exemplo.html");
  const outA = join(SCRATCH, "a.mp4");
  const outB = join(SCRATCH, "b.mp4");
  rmSync(outA, { force: true });
  rmSync(outB, { force: true });
  const a = await renderPage({ pagePath: page, out: outA, tools, fps: 10, end: 1, scale: 0.25, frameFormat: "png", parallel: 1 });
  const b = await renderPage({ pagePath: page, out: outB, tools, fps: 10, end: 1, scale: 0.25, frameFormat: "png", parallel: 1 });
  assert.equal(a.frames, 10);
  assert.equal(a.width, 270);
  assert.equal(a.height, 480);
  assert.equal(a.frames_hash, b.frames_hash, "o mesmo render dá os mesmos quadros");
  assert.ok(existsSync(outA) && existsSync(outB));
  assert.equal(a.film.duration, 6);
  assert.deepEqual(a.warnings.filter((w) => w.includes("erros")), []);
});

test("a page without seek is refused with a stable code (needs a browser)", { timeout: 60000 }, async (t) => {
  const tools = await checkTools();
  if (!tools.ffmpeg || !findBrowser()) {
    t.skip("sem ffmpeg ou navegador nesta máquina");
    return;
  }
  const { writeFileSync } = await import("node:fs");
  const bad = join(SCRATCH, "ruim.html");
  writeFileSync(bad, "<!doctype html><body>nada</body>");
  await assert.rejects(renderPage({ pagePath: bad, out: join(SCRATCH, "ruim.mp4"), tools, end: 1 }), (error) => error.code === "page_no_seek");
});

test("a font used only on the canvas is loaded before the frame that first draws it (needs a browser and two system fonts)", { timeout: 120000 }, async (t) => {
  const tools = await checkTools();
  const candidates = [
    "C:/Windows/Fonts/georgiaz.ttf",
    "C:/Windows/Fonts/consola.ttf",
    "/System/Library/Fonts/Supplemental/Georgia Bold Italic.ttf",
    "/System/Library/Fonts/Supplemental/Courier New.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-BoldItalic.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
  ].filter((path) => existsSync(path));
  if (!findBrowser() || candidates.length < 2) {
    t.skip("sem navegador ou sem duas fontes do sistema para o teste");
    return;
  }
  const { writeFileSync } = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const { captureFrames } = await import("../scripts/lib/renderer.mjs");
  const [heavy, light] = candidates.map((path) => fileUrl(path));
  const page = join(SCRATCH, "fonte-no-canvas.html");
  writeFileSync(
    page,
    `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: "Teste"; src: url("${heavy}"); font-weight: 800; }
@font-face { font-family: "Teste"; src: url("${light}"); font-weight: 400; }
html, body { margin: 0; background: #111 }
</style><canvas id="c" width="400" height="200"></canvas><script>
window.film = { title: "fonte", duration: 2, width: 400, height: 200 };
const ctx = document.getElementById("c").getContext("2d");
window.seek = (t) => {
  ctx.fillStyle = "#111"; ctx.fillRect(0, 0, 400, 200); ctx.fillStyle = "#fff";
  ctx.font = "800 60px Teste"; ctx.fillText("Agora", 20, 80);
  if (t >= 1) { ctx.font = "400 40px Teste"; ctx.fillText("depois", 20, 160); }
};
</script>`,
  );
  const times = [0, 0.5, 0, 1, 1.5, 1];
  const result = await captureFrames({ pagePath: page, times, tools });
  const hashes = result.frames.map((frame) => createHash("sha256").update(frame.data).digest("hex"));
  assert.equal(hashes[0], hashes[2], "o primeiro quadro já sai com a fonte da página");
  assert.equal(hashes[3], hashes[5], "o quadro em que um peso novo aparece já sai com ele");
});

test("parseFrameStats reads the tiny differences ffmpeg prints in scientific notation", async () => {
  const { parseFrameStats } = await import("../scripts/lib/ffmpeg.mjs");
  const printed = [
    "frame:0    pts:0       pts_time:0",
    "lavfi.signalstats.YDIF=0",
    "frame:1    pts:512     pts_time:0.0333333",
    "lavfi.signalstats.YDIF=3.63512e-05",
    "frame:2    pts:1024    pts_time:0.0666667",
    "lavfi.signalstats.YDIF=1.2E+01",
    "frame:0    pts:0       pts_time:0",
    "lavfi.signalstats.YAVG=64.5",
    "frame:1    pts:512     pts_time:0.0333333",
    "lavfi.signalstats.YAVG=6.4e+01",
    "frame:2    pts:1024    pts_time:0.0666667",
    "lavfi.signalstats.YAVG=70",
  ].join("\r\n");
  const frames = parseFrameStats(printed);
  assert.deepEqual(
    frames.map((frame) => [frame.n, frame.time, frame.ydif, frame.yavg]),
    [
      [0, 0, 0, 64.5],
      [1, 0.0333333, 3.63512e-5, 64],
      [2, 0.0666667, 12, 70],
    ],
  );
});
