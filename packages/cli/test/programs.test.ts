import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { createContext, type SystemAccess } from "../src/context.ts";
import { loadCoreAssets } from "../src/core-assets.ts";
import { parseArgs, runCommand } from "../src/main.ts";
import { ensureProgram, isProgramFile, programsDeclared, type ProgramSpec, type RunResult } from "../src/programs.ts";
import { readLock } from "../src/state/lock.ts";

let sandbox: string;
const registry = loadCoreAssets().programs;
const ffmpeg = registry.get("ffmpeg")!;
const ytdlp = registry.get("yt-dlp")!;

/** A machine where programs appear once their package manager installs them. */
function fakeMachine(initial: Record<string, string>, options: { failWith?: RunResult; afterInstall?: Record<string, string> } = {}) {
  const found = new Map(Object.entries(initial));
  const calls: { file: string; args: string[] }[] = [];
  const system: SystemAccess = {
    find: (binary) => found.get(binary) ?? null,
    run: (file, args) => {
      calls.push({ file, args });
      if (options.failWith) return options.failWith;
      // winget names the package after --id; apt (through sudo) and brew end with it. indexOf() is -1 for
      // them, and args[0] read "-n" on Linux: the program never "appeared" and the test failed only in CI.
      const at = args.indexOf("--id");
      const id = at >= 0 ? args[at + 1] : args[args.length - 1];
      const installs: Record<string, string[]> = { "Gyan.FFmpeg": ["ffmpeg", "ffprobe"], ffmpeg: ["ffmpeg", "ffprobe"], "yt-dlp.yt-dlp": ["yt-dlp"], "yt-dlp": ["yt-dlp"] };
      for (const binary of installs[id] ?? []) found.set(binary, `C:/links/${binary}.exe`);
      for (const [binary, path] of Object.entries(options.afterInstall ?? {})) found.set(binary, path);
      return { status: 0, stdout: "Successfully installed", stderr: "" };
    },
  };
  return { system, calls, found };
}

before(() => {
  sandbox = mkdtempSync(join(tmpdir(), "flyee-programs-"));
});
after(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe("programs an app declares", () => {
  it("are read from the scope of its shell permissions, as whole words", () => {
    const permissions = [
      { kind: "shell", scope: "node .flyee/modules/video-analysis/scripts/video.mjs" },
      { kind: "shell", scope: "ffmpeg, ffprobe" },
      { kind: "shell", scope: "yt-dlp" },
      { kind: "network", scope: "ffmpeg.org" },
      { kind: "shell", scope: "ffmpegx --tool" },
    ];
    assert.deepEqual(programsDeclared(registry, permissions), ["ffmpeg", "yt-dlp"]);
    assert.deepEqual(programsDeclared(registry, [{ kind: "shell", scope: "ffprobe -v error" }]), ["ffmpeg"]);
    assert.deepEqual(programsDeclared(registry, undefined), []);
  });
});

describe("finding programs", () => {
  it("accepts a link to a program, the way Windows exposes winget, and refuses a folder", () => {
    const dir = join(sandbox, "bin");
    mkdirSync(join(dir, "pasta"), { recursive: true });
    writeFileSync(join(dir, "real.exe"), "x");
    assert.equal(isProgramFile(join(dir, "real.exe")), true);
    assert.equal(isProgramFile(join(dir, "pasta")), false);
    assert.equal(isProgramFile(join(dir, "nao-existe.exe")), false);
    try {
      symlinkSync(join(dir, "real.exe"), join(dir, "alias.exe"));
    } catch {
      return; // creating links needs a privilege some Windows accounts lack; the real alias is covered by hand
    }
    assert.equal(isProgramFile(join(dir, "alias.exe")), true);
  });
});

describe("installing a program without the member", () => {
  it("does nothing when it is already there", () => {
    const machine = fakeMachine({ ffmpeg: "/usr/bin/ffmpeg", ffprobe: "/usr/bin/ffprobe" });
    const result = ensureProgram(ffmpeg, { os: "linux", ...machine.system });
    assert.equal(result.status, "present");
    assert.equal(machine.calls.length, 0);
  });

  it("installs through winget, silently and accepting the agreements, and finds it at once", () => {
    const machine = fakeMachine({ winget: "C:/WindowsApps/winget.exe" });
    const result = ensureProgram(ffmpeg, { os: "windows", ...machine.system });
    assert.equal(result.status, "installed");
    assert.equal(result.manager, "winget");
    assert.deepEqual(result.binaries, { ffmpeg: "C:/links/ffmpeg.exe", ffprobe: "C:/links/ffprobe.exe" });
    const args = machine.calls[0].args;
    for (const flag of ["install", "--id", "Gyan.FFmpeg", "-e", "--silent", "--accept-source-agreements", "--accept-package-agreements", "--disable-interactivity"]) {
      assert.ok(args.includes(flag), `${flag} missing in ${args.join(" ")}`);
    }
  });

  it("installs through apt behind sudo -n, and through Homebrew, whatever system runs the tests", () => {
    const linux = fakeMachine({ "apt-get": "/usr/bin/apt-get", sudo: "/usr/bin/sudo" });
    const onLinux = ensureProgram(ffmpeg, { os: "linux", ...linux.system });
    assert.equal(onLinux.status, "installed", JSON.stringify(onLinux));
    assert.deepEqual(linux.calls[0].args.slice(0, 2), ["-n", "/usr/bin/apt-get"]);
    const mac = fakeMachine({ brew: "/opt/homebrew/bin/brew" });
    const onMac = ensureProgram(ytdlp, { os: "macos", ...mac.system });
    assert.equal(onMac.status, "installed", JSON.stringify(onMac));
    assert.equal(mac.calls[0].args[0], "install");
  });

  it("returns the one step left to the member when the system asks for a password", () => {
    const machine = fakeMachine({ "apt-get": "/usr/bin/apt-get", sudo: "/usr/bin/sudo" }, { failWith: { status: 1, stdout: "", stderr: "sudo: a password is required" } });
    const result = ensureProgram(ffmpeg, { os: "linux", ...machine.system });
    assert.equal(result.status, "needs_member");
    assert.equal(result.reason, "admin_password");
    assert.equal(result.member_step, "sudo sh -c 'apt-get update && apt-get install -y ffmpeg'", "the step refreshes the lists, which may never have been downloaded");
    assert.deepEqual(machine.calls[0].args.slice(0, 2), ["-n", "/usr/bin/apt-get"], "sudo never prompts");
  });

  it("names Homebrew when a Mac has no package manager", () => {
    const machine = fakeMachine({});
    const result = ensureProgram(ytdlp, { os: "macos", ...machine.system });
    assert.equal(result.status, "needs_member");
    assert.equal(result.reason, "homebrew_missing");
    assert.ok(result.member_step?.includes("Homebrew/install"));
  });

  it("treats a program winget says is current as present when upgrading", () => {
    const machine = fakeMachine({ winget: "C:/w.exe", "yt-dlp": "C:/links/yt-dlp.exe" }, { failWith: { status: 1, stdout: "No available upgrade found.", stderr: "" } });
    const result = ensureProgram(ytdlp, { os: "windows", upgrade: true, ...machine.system });
    assert.equal(result.status, "present");
    assert.equal(machine.calls[0].args[0], "upgrade");
  });
});

describe("npx flyee need", () => {
  const context = (system: SystemAccess, options: { yes?: boolean; confirm?: boolean } = {}) => {
    const output: string[] = [];
    const ctx = createContext({
      cwd: join(sandbox, "project"),
      homeDir: join(sandbox, "home"),
      env: { PATH: "" },
      locale: "pt-BR",
      yes: options.yes ?? true,
      system,
      io: { out: (line) => output.push(line), confirm: async () => options.confirm ?? false },
    });
    return { ctx, output };
  };

  it("installs what is missing and records where each program is", async () => {
    const machine = fakeMachine({ winget: "C:/w.exe", "yt-dlp": "C:/links/yt-dlp.exe" });
    const { ctx, output } = context(machine.system);
    const result = await runCommand(ctx, parseArgs(["need", "ffprobe", "yt-dlp"]));
    // On this test machine the OS may not be Windows; the fake answers for any manager it is asked about.
    const statuses = (result.programs as { name: string; status: string }[]).map(({ name, status }) => `${name}:${status}`);
    assert.ok(statuses.includes("yt-dlp:present"), statuses.join(", "));
    assert.equal(statuses.length, 2, "ffprobe resolves to ffmpeg");
    assert.ok(output.some((line) => line.includes("yt-dlp: já instalado")));
    const recorded = JSON.parse(readFileSync(join(sandbox, "home", ".flyee", "programs.json"), "utf8"));
    assert.equal(recorded.programs["yt-dlp"].binaries["yt-dlp"], "C:/links/yt-dlp.exe");
  });

  it("asks first without --yes and installs nothing when the answer is no", async () => {
    const machine = fakeMachine({ winget: "C:/w.exe" });
    const { ctx } = context(machine.system, { yes: false, confirm: false });
    const result = await runCommand(ctx, parseArgs(["need", "ffmpeg"]));
    assert.equal(result.error, "cancelled");
    assert.equal(machine.calls.length, 0);
  });

  it("refuses an unknown program and accepts one with its recipe", async () => {
    const machine = fakeMachine({ winget: "C:/w.exe", brew: "/b/brew", "apt-get": "/a", sudo: "/s" }, { afterInstall: { "meu-prog": "C:/links/meu-prog.exe" } });
    const { ctx } = context(machine.system);
    const unknown = await runCommand(ctx, parseArgs(["need", "meu-prog"]));
    assert.equal(unknown.error, "unknown_program");
    const recipe = await runCommand(ctx, parseArgs(["need", "meu-prog", "--winget", "Eu.MeuProg", "--brew", "meu-prog", "--apt", "meu-prog"]));
    assert.equal(recipe.ok, true, JSON.stringify(recipe));
    assert.equal((recipe.programs as { status: string }[])[0].status, "installed");
  });
});

describe("apps install their programs", () => {
  it("dev link installs what the app declares and the lock remembers it", async () => {
    const dir = join(sandbox, "src", "editor");
    mkdirSync(join(dir, "skills", "editor"), { recursive: true });
    writeFileSync(
      join(dir, "flyee.module.json"),
      JSON.stringify({
        manifest_version: 1, name: "editor", version: "0.1.0", type: "tool", trail: "divulgar",
        title: { "pt-BR": "Editor" }, summary: { "pt-BR": "Edita." }, compatible_ais: ["claude_code"],
        entry: "skills/editor/SKILL.md", files: [], changelog: { "pt-BR": "x" },
        permissions: [{ kind: "shell", scope: "ffmpeg, ffprobe", reason: { "pt-BR": "Corta o vídeo." } }],
      }),
    );
    writeFileSync(join(dir, "README.md"), "# Editor\n");
    writeFileSync(join(dir, "skills", "editor", "SKILL.md"), "---\nname: editor\ndescription: Edita vídeo.\n---\n# x\n");
    const machine = fakeMachine({ winget: "C:/w.exe", brew: "/b/brew", "apt-get": "/a", sudo: "/s" });
    const project = join(sandbox, "workspace");
    mkdirSync(project, { recursive: true });
    const ctx = createContext({ cwd: project, homeDir: join(sandbox, "home2"), env: { PATH: "" }, dev: true, yes: true, system: machine.system, io: { out: () => undefined } });
    const result = await runCommand(ctx, parseArgs(["dev", "link", dir]));
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(readLock(ctx)!.modules.editor.programs, ["ffmpeg"]);
    assert.equal((result.programs as { status: string }[])[0].status, "installed");
    assert.ok(machine.calls.length >= 1);
  });
});

// Keep the spec type in use for readers of this file.
export type { ProgramSpec };
