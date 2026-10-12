import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { shippableFiles } from "../src/files.ts";
import { repoRoot } from "../src/paths.ts";
import { createProject, isProjectName, listProjects, projectDir, projectsRoot, readProject, withUsedApps } from "../src/projects.ts";

let sandbox: string;
let modules: string;
let env: Record<string, string | undefined>;

/** A minimal app source: enough files for the copy check, which hashes what ships. */
function appSource(slug: string): string {
  const dir = join(modules, slug);
  mkdirSync(join(dir, "skills", slug), { recursive: true });
  writeFileSync(join(dir, "flyee.module.json"), JSON.stringify({ name: slug, version: "1.0.0" }));
  writeFileSync(join(dir, "README.md"), `# ${slug}\n`);
  writeFileSync(join(dir, "skills", slug, "SKILL.md"), `---\nname: ${slug}\ndescription: x\n---\n`);
  return dir;
}

/** Installs an app into a project the way `dev link` records it: the shipped files with their hashes. */
function installInto(project: string, slug: string): void {
  const source = join(modules, slug);
  const files = shippableFiles(source).map((path) => ({ path, sha256: createHash("sha256").update(readFileSync(join(source, ...path.split("/")))).digest("hex") }));
  const lockPath = join(projectsRoot(env), project, ".flyee", "lock.json");
  mkdirSync(join(projectsRoot(env), project, ".flyee"), { recursive: true });
  let lock: { lock_version: number; modules: Record<string, unknown> } = { lock_version: 1, modules: {} };
  try {
    lock = JSON.parse(readFileSync(lockPath, "utf8"));
  } catch {
    // first app of the project
  }
  lock.modules[slug] = { version: "1.0.0", dev: true, files };
  writeFileSync(lockPath, JSON.stringify(lock));
}

before(() => {
  sandbox = mkdtempSync(join(tmpdir(), "flyee-projects-"));
  modules = join(sandbox, "modules");
  env = { FLYEE_PROJECTS: join(sandbox, "conteudo") };
});
after(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe("the operator's projects", () => {
  it("live beside the repository by default, or where FLYEE_PROJECTS says", () => {
    assert.equal(projectsRoot({}), join(repoRoot, "..", "conteudo"));
    assert.equal(projectsRoot(env), join(sandbox, "conteudo"));
  });

  it("take lowercase kebab-case names and never live inside the repository", () => {
    for (const name of ["medchina", "flyee-club", "cliente2"]) assert.equal(isProjectName(name), true, name);
    for (const name of ["MedChina", "../fora", "a b", "-x", "", "x".repeat(41)]) assert.equal(isProjectName(name), false, name);
    assert.throws(() => projectDir("../fora", env), /not a project name/);
    assert.throws(() => projectDir("medchina", { FLYEE_PROJECTS: join(repoRoot, "conteudo") }), /inside the product repository/);
    assert.equal(projectDir("medchina", env), join(sandbox, "conteudo", "medchina"));
  });

  it("are created once", () => {
    assert.deepEqual(createProject("medchina", env), { path: join(sandbox, "conteudo", "medchina"), created: true });
    assert.equal(createProject("medchina", env).created, false);
  });

  it("tell, per app, a current copy from a stale one and from an app that left modules/", () => {
    appSource("video-render");
    appSource("video-studio");
    appSource("antigo");
    installInto("medchina", "video-render");
    installInto("medchina", "video-studio");
    installInto("flyee", "video-render");
    installInto("flyee", "antigo");
    rmSync(join(modules, "antigo"), { recursive: true, force: true });
    writeFileSync(join(modules, "video-studio", "README.md"), "# mudou\n");
    mkdirSync(join(projectsRoot(env), "Nao-E-Projeto"), { recursive: true });

    const projects = listProjects(env, modules);
    assert.deepEqual(projects.map((project) => project.name), ["flyee", "medchina"], "a folder with an invalid name is not a project");
    const states = Object.fromEntries(projects.map((project) => [project.name, Object.fromEntries(project.apps.map((app) => [app.slug, app.state]))]));
    assert.deepEqual(states, { flyee: { antigo: "orphan", "video-render": "current" }, medchina: { "video-render": "current", "video-studio": "stale" } });
    assert.equal(readProject("nenhum", env, modules), null);
  });

  it("list nothing before the folder exists", () => {
    assert.deepEqual(listProjects({ FLYEE_PROJECTS: join(sandbox, "ainda-nao") }, modules), []);
  });
});

describe("the apps an app needs in a project", () => {
  const uses: Record<string, string[]> = {
    "video-studio": ["video-render"],
    "motion-carousel": ["video-render"],
    "youtube-script": ["video-analysis", "youtube-research"],
    "a": ["b"],
    "b": ["a"],
  };
  const of = (slug: string) => uses[slug] ?? [];

  it("come before it, once each", () => {
    assert.deepEqual(withUsedApps(["video-studio", "motion-carousel"], of), ["video-render", "video-studio", "motion-carousel"]);
    assert.deepEqual(withUsedApps(["youtube-script"], of), ["video-analysis", "youtube-research", "youtube-script"]);
    assert.deepEqual(withUsedApps(["video-render", "video-studio"], of), ["video-render", "video-studio"]);
  });

  it("survive a cycle", () => {
    assert.deepEqual(withUsedApps(["a"], of), ["b", "a"]);
  });
});
