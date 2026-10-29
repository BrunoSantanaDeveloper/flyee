import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { unzipSync } from "fflate";

import { buildCatalog, renderDigest, renderDocument, writeCatalog } from "../src/catalog.ts";
import { parseFrontmatter } from "../src/frontmatter.ts";
import { buildPackage, packModule, writeFilesToManifest } from "../src/pack.ts";
import { repoRoot } from "../src/paths.ts";
import { PLACEHOLDER } from "../src/placeholders.ts";
import { readInterface, referencedApps } from "../src/relations.ts";
import { isSafePackagePath } from "../src/safe-path.ts";
import { bumpApp, copyDir, nextVersion, scaffoldApp } from "../src/scaffold.ts";
import { compareSemver, isSemver, minimumOfRange } from "../src/semver.ts";
import { buildIndex } from "../src/index-build.ts";
import { showcaseErrors } from "../src/showcase.ts";
import { validateAll, validateModule } from "../src/validate.ts";
import { isInsideRepo, workspaceState } from "../src/workspace.ts";

let sandbox: string;
let root: string;

/** Replaces every placeholder of the shipped files and of the eval with real text. */
function fill(dir: string): void {
  const walk = (path: string) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (statSync(full).isFile()) {
        const text = readFileSync(full, "utf8");
        if (text.includes(PLACEHOLDER)) writeFileSync(full, text.split(`${PLACEHOLDER} `).join("").split(PLACEHOLDER).join("texto"));
      }
    }
  };
  walk(dir);
  writeFilesToManifest(dir);
}

/** A complete app built the way the operator builds one: scaffold, then write. */
function makeApp(slug: string, options: { type?: string; trail?: string } = {}): string {
  const result = scaffoldApp({ slug, type: options.type ?? "skill", trail: options.trail ?? "divulgar", title: slug, summary: `Entrega ${slug}.`, root });
  fill(result.dir);
  return result.dir;
}

before(() => {
  sandbox = mkdtempSync(join(tmpdir(), "flyee-tools-"));
  root = join(sandbox, "modules");
  mkdirSync(root, { recursive: true });
  copyDir(join(repoRoot, "modules", "_template"), join(root, "_template"));
});
after(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe("semver, as the catalog orders it", () => {
  it("accepts and refuses what the contract says", () => {
    for (const ok of ["0.0.1", "1.2.3", "1.0.0-beta.1", "99999.0.0"]) assert.equal(isSemver(ok), true, ok);
    for (const bad of ["1.2", "01.2.3", "1.2.3+build", "v1.2.3", "100000.0.0"]) assert.equal(isSemver(bad), false, bad);
  });
  it("orders releases after their prereleases", () => {
    assert.ok(compareSemver("1.0.0-beta.1", "1.0.0") < 0);
    assert.ok(compareSemver("1.2.0", "1.10.0") < 0);
    assert.equal(compareSemver("1.0.0", "1.0.0"), 0);
  });
  it("reads the minimum of a min_core comparator", () => {
    assert.equal(minimumOfRange(">=1.2.0"), "1.2.0");
    assert.equal(minimumOfRange("^1.0.0"), "1.0.0");
    assert.equal(minimumOfRange("x"), null);
  });
});

describe("safe package paths", () => {
  it("refuses escapes", () => {
    for (const bad of ["../x", "a/../b", "/abs", "C:\\x", "a\\b", "", "a/./b"]) assert.equal(isSafePackagePath(bad), false, bad);
    for (const ok of ["SKILL.md", "skills/a/SKILL.md", "scripts/score.py"]) assert.equal(isSafePackagePath(ok), true, ok);
  });
});

describe("frontmatter", () => {
  it("reads plain, quoted and folded values", () => {
    const parsed = parseFrontmatter(`---\nname: radar\ndescription: >\n  Finds outliers.\n  Use when asked.\nlicense: "MIT"\n---\n# Body\n`);
    assert.ok(parsed);
    assert.equal(parsed.data.name, "radar");
    assert.equal(parsed.data.description, "Finds outliers. Use when asked.");
    assert.equal(parsed.data.license, "MIT");
    assert.equal(parsed.body.trim(), "# Body");
  });
  it("returns null without a frontmatter", () => {
    assert.equal(parseFrontmatter("# no frontmatter"), null);
  });
});

describe("creating an app from the chat", () => {
  it("scaffolds a valid structure that validate refuses until every placeholder is written", () => {
    const result = scaffoldApp({ slug: "radar", type: "tool", trail: "divulgar", title: "Radar", root });
    const manifest = JSON.parse(readFileSync(join(result.dir, "flyee.module.json"), "utf8"));
    assert.equal(manifest.name, "radar");
    assert.equal(manifest.type, "tool");
    assert.equal(manifest.entry, "skills/radar/SKILL.md");
    assert.ok(readFileSync(join(result.dir, "skills", "radar", "SKILL.md"), "utf8").includes("name: radar"));
    assert.ok(result.placeholders.includes("manifest.summary.pt-BR"), result.placeholders.join(", "));
    assert.ok(result.placeholders.includes("README.md"));
    const before = validateModule(result.dir);
    assert.ok(before.errors.some((error) => error.includes(PLACEHOLDER) && error.includes("README.md")), before.errors.join("\n"));
    assert.ok(before.errors.some((error) => error.startsWith("tests/eval.json") && error.includes(PLACEHOLDER)));
    fill(result.dir);
    const manifestPath = join(result.dir, "flyee.module.json");
    const filled = JSON.parse(readFileSync(manifestPath, "utf8"));
    filled.summary = { "pt-BR": "Mostra o que funciona." };
    writeFileSync(manifestPath, JSON.stringify(filled, null, 2));
    assert.deepEqual(validateModule(result.dir).errors, []);
  });

  it("refuses a slug that exists, an invalid slug, type or trail", () => {
    assert.throws(() => scaffoldApp({ slug: "radar", type: "skill", trail: "divulgar", root }), /already exists/);
    assert.throws(() => scaffoldApp({ slug: "Radar", type: "skill", trail: "divulgar", root }), /not a valid slug/);
    assert.throws(() => scaffoldApp({ slug: "outro", type: "agent", trail: "divulgar", root }), /type must be/);
    assert.throws(() => scaffoldApp({ slug: "outro", type: "skill", trail: "video", root }), /trail must be/);
  });

  it("bumps a version and blocks it until the changelog is written", () => {
    const dir = makeApp("pauta");
    assert.equal(nextVersion("1.2.3", "patch"), "1.2.4");
    assert.equal(nextVersion("1.2.3", "minor"), "1.3.0");
    assert.equal(nextVersion("1.2.3", "major"), "2.0.0");
    assert.deepEqual(bumpApp("pauta", "minor", root), { from: "1.0.0", to: "1.1.0" });
    assert.throws(() => bumpApp("pauta", "1.0.5", root), /not greater/);
    const report = validateModule(dir);
    assert.ok(report.errors.some((error) => error.includes("manifest.changelog")), report.errors.join("\n"));
  });
});

describe("validate", () => {
  it("accepts a complete app and never ships its tests", () => {
    const report = validateModule(makeApp("copy-social"));
    assert.deepEqual(report.errors, []);
    assert.equal(report.skills.length, 1);
    assert.ok(report.files.includes("README.md"));
    assert.ok(!report.files.some((file) => file.startsWith("tests/")), "tests never ship");
  });

  it("refuses a stale files list, an unsafe entry and a missing eval", () => {
    const dir = makeApp("copy-lp");
    writeFileSync(join(dir, "extra.md"), "novo arquivo");
    rmSync(join(dir, "tests"), { recursive: true });
    const manifestPath = join(dir, "flyee.module.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.entry = "../escape.md";
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const report = validateModule(dir);
    assert.ok(report.errors.some((error) => error.startsWith("files: out of date")), report.errors.join("\n"));
    assert.ok(report.errors.some((error) => error.startsWith("entry:")));
    assert.ok(report.errors.some((error) => error.startsWith("tests/eval.json: missing")));
  });

  it("refuses a manifest that drifts from the schema and a skill whose name differs from its folder", () => {
    const dir = makeApp("roteiro");
    const manifestPath = join(dir, "flyee.module.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.unknown = true;
    writeFileSync(manifestPath, JSON.stringify(manifest));
    let report = validateModule(dir);
    assert.ok(report.errors.some((error) => error.includes('unknown key "unknown"')), report.errors.join("\n"));
    delete manifest.unknown;
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const skillPath = join(dir, "skills", "roteiro", "SKILL.md");
    writeFileSync(skillPath, readFileSync(skillPath, "utf8").replace("name: roteiro", "name: outro"));
    report = validateModule(dir);
    assert.ok(report.errors.some((error) => error.includes("must equal the folder")), report.errors.join("\n"));
  });

  it("refuses the same skill name in two apps", () => {
    const a = makeApp("app-a");
    const b = makeApp("app-b");
    for (const [dir, slug] of [[a, "app-a"], [b, "app-b"]] as const) {
      copyDir(join(dir, "skills", slug), join(dir, "skills", "shared"));
      const shared = join(dir, "skills", "shared", "SKILL.md");
      writeFileSync(shared, readFileSync(shared, "utf8").replace(`name: ${slug}`, "name: shared"));
      writeFilesToManifest(dir);
    }
    for (const report of validateAll([a, b])) {
      assert.ok(report.errors.some((error) => error.includes('"shared" is also used by')), report.errors.join("\n"));
    }
  });
});

describe("relations between apps", () => {
  it("reads who calls whom from what the apps ship, and checks the called app exists", () => {
    const tool = makeApp("video-tool", { type: "tool" });
    mkdirSync(join(tool, "references"), { recursive: true });
    writeFileSync(
      join(tool, "references", "interface.md"),
      "# Interface\n\nVersão da interface: **2**.\n\n```\nnode .flyee/modules/video-tool/scripts/run.mjs check --json\nnode .flyee/modules/video-tool/scripts/run.mjs analyze <x> --json\n```\n",
    );
    // The script the guide runs ships with the tool: a guide that names a missing file is refused.
    mkdirSync(join(tool, "scripts"), { recursive: true });
    writeFileSync(join(tool, "scripts", "run.mjs"), 'console.log("ok");\n');
    writeFilesToManifest(tool);
    const consumer = makeApp("editor");
    const skill = join(consumer, "skills", "editor", "SKILL.md");
    writeFileSync(skill, `${readFileSync(skill, "utf8")}\nRode \`node .flyee/modules/video-tool/scripts/run.mjs analyze <video> --json\`. Exemplo de outro: .flyee/modules/<app>/x.\n`);
    writeFilesToManifest(consumer);

    assert.deepEqual(referencedApps(consumer), ["video-tool"]);
    assert.deepEqual(readInterface(tool), { version: 2, entry: "scripts/run.mjs", commands: ["analyze", "check"] });

    const [toolReport, consumerReport] = validateAll([tool, consumer]);
    assert.deepEqual(toolReport.errors, []);
    assert.deepEqual(consumerReport.errors, []);
    assert.ok(consumerReport.warnings.some((warning) => warning.includes('uses "video-tool"')), consumerReport.warnings.join("\n"));

    writeFileSync(skill, `${readFileSync(skill, "utf8")}\nE também .flyee/modules/nao-existe/run.mjs\n`);
    const broken = validateAll([consumer])[0];
    assert.ok(broken.errors.some((error) => error.includes('no app "nao-existe"')), broken.errors.join("\n"));
    writeFileSync(skill, readFileSync(skill, "utf8").replace("\nE também .flyee/modules/nao-existe/run.mjs\n", "\n"));
  });

  it("builds the catalog with the inverse relation and renders it deterministically", () => {
    const catalog = buildCatalog(root);
    const tool = catalog.find((entry) => entry.slug === "video-tool")!;
    const editor = catalog.find((entry) => entry.slug === "editor")!;
    assert.deepEqual(editor.uses, ["video-tool"]);
    assert.deepEqual(tool.used_by, ["editor"]);
    assert.equal(tool.interface?.version, 2);
    assert.ok(!catalog.some((entry) => entry.slug === "_template"));
    const digest = renderDigest(catalog);
    assert.ok(digest.includes("| `video-tool` 1.0.0 | tool · divulgar |"), digest);
    assert.ok(digest.includes("sim v2 `scripts/run.mjs`"));
    assert.equal(renderDigest(buildCatalog(root)), digest, "deterministic");
    const document = renderDocument(catalog);
    assert.ok(document.includes("## editor") && document.includes("**Usa** `video-tool`"));
  });

  it("writes the catalog files and reports them stale until regenerated", () => {
    // Separate folders, as in the repository: on Windows catalogo.md and CATALOGO.md are one file.
    const digestPath = join(sandbox, "out", "rules", "catalogo.md");
    const documentPath = join(sandbox, "out", "docs", "CATALOGO.md");
    const options = { root, digestPath, documentPath, syncHarness: false };
    assert.equal(writeCatalog({ ...options, check: true }).stale.length, 2);
    assert.equal(writeCatalog(options).written.length, 2);
    assert.equal(writeCatalog({ ...options, check: true }).stale.length, 0);
  });
});

describe("references to package files", () => {
  /** Appends lines to an app's skill and regenerates `files`; returns the 1-based line of each, in order. */
  function appendToSkill(dir: string, slug: string, lines: string[]): number[] {
    const skill = join(dir, "skills", slug, "SKILL.md");
    const before = readFileSync(skill, "utf8").replace(/\n*$/, "\n");
    writeFileSync(skill, `${before}${lines.join("\n")}\n`);
    writeFilesToManifest(dir);
    const start = before.split("\n").length;
    return lines.map((_, index) => start + index);
  }

  /** A tool app with a script and the guide for the apps that call it. */
  function tool(slug: string): string {
    const dir = makeApp(slug, { type: "tool" });
    mkdirSync(join(dir, "scripts"), { recursive: true });
    mkdirSync(join(dir, "references"), { recursive: true });
    writeFileSync(join(dir, "scripts", "mix.mjs"), 'console.log("ok");\n');
    writeFileSync(join(dir, "references", "interface.md"), `# Interface\n\n\`node .flyee/modules/${slug}/scripts/mix.mjs mix --json\`\n`);
    writeFilesToManifest(dir);
    return dir;
  }

  it("accepts references that ship, and skips placeholders, addresses and the member's project", () => {
    const engine = tool("som-tool");
    const app = makeApp("som-app");
    mkdirSync(join(app, "references"), { recursive: true });
    mkdirSync(join(app, "scripts"), { recursive: true });
    // Outside a skill's folder a relative path is the member's project, as beside a slide page.
    writeFileSync(join(app, "references", "guia.md"), "# Guia\n\nA página carrega `../assets/fundo.jpg`, da pasta do integrante.\n");
    writeFileSync(join(app, "scripts", "run.mjs"), 'console.log("ok");\n');
    appendToSkill(app, "som-app", [
      "Leia ../../references/guia.md e ../../references/ e rode `node ../../scripts/run.mjs` ou `node .flyee/modules/som-app/scripts/run.mjs`.",
      "Para mixar, siga `.flyee/modules/som-tool/references/interface.md` e rode `node .flyee/modules/som-tool/scripts/mix.mjs mix --json`.",
      "O foco fica em `../../references/foco/<foco>.md`, e o resultado em `som-app/saidas/<id>/mix.json`, no projeto.",
      "Exemplos: https://example.com/.flyee/modules/som-tool/nada.md, .flyee/modules/<app>/references/interface.md e .flyee/modules/som-tool/${arquivo}.",
      "Fora do pacote: ../../../AGENTS.md.",
    ]);
    const [engineReport, appReport] = validateAll([engine, app]);
    assert.deepEqual(engineReport.errors, []);
    assert.deepEqual(appReport.errors, []);
  });

  it("refuses a path relative to a skill's folder that names a file the package does not ship", () => {
    const app = makeApp("som-relativo");
    const [line] = appendToSkill(app, "som-relativo", ["Leia ../../references/sumiu.md antes de escrever."]);
    assert.deepEqual(validateModule(app).errors, [
      `skills/som-relativo/SKILL.md:${line}: "../../references/sumiu.md" points to references/sumiu.md, which the package does not ship`,
    ]);
  });

  it("refuses an installed path of another app that names a file it does not ship", () => {
    const engine = tool("eco-tool");
    const app = makeApp("eco-app");
    const [line] = appendToSkill(app, "eco-app", ["Rode `node .flyee/modules/eco-tool/scripts/antigo.mjs mix --json`."]);
    const report = validateAll([engine, app])[1];
    assert.deepEqual(report.errors, [
      `skills/eco-app/SKILL.md:${line}: ".flyee/modules/eco-tool/scripts/antigo.mjs" points to scripts/antigo.mjs, which the package of eco-tool does not ship`,
    ]);
  });
});

describe("workspace", () => {
  it("is never inside the repository", () => {
    assert.equal(isInsideRepo(repoRoot), true);
    assert.equal(isInsideRepo(join(repoRoot, "sandbox")), true);
    assert.equal(isInsideRepo(join(repoRoot, "..", "flyee-workspace")), false);
  });

  it("tells a current copy from a stale one", () => {
    const dir = makeApp("ws-app");
    const report = validateModule(dir);
    const files = report.files.map((path) => ({
      path,
      sha256: buildShaOf(join(dir, ...path.split("/"))),
    }));
    const lock = { modules: { "ws-app": { version: "1.0.0", files } } };
    assert.equal(workspaceState(lock, "ws-app", dir), "current");
    assert.equal(workspaceState(lock, "other", dir), "absent");
    writeFileSync(join(dir, "README.md"), "# mudou\n");
    assert.equal(workspaceState(lock, "ws-app", dir), "stale");
  });
});

describe("pack", () => {
  it("is deterministic and matches the manifest in both directions", () => {
    const dir = makeApp("takes");
    const first = buildPackage(dir);
    const second = buildPackage(dir);
    assert.equal(first.sha256, second.sha256);
    const entries = unzipSync(first.bytes);
    const names = Object.keys(entries).filter((name) => !name.endsWith("/")).sort();
    assert.deepEqual(names, ["flyee.module.json", ...first.files].sort());
    const packed = JSON.parse(new TextDecoder().decode(entries["flyee.module.json"]));
    assert.deepEqual(packed.files, first.files);
    assert.ok(!names.some((name) => name.startsWith("tests/")));
  });

  it("writes the zip and the checksum file", () => {
    const dir = makeApp("pesquisa");
    const out = join(sandbox, "dist");
    const result = packModule(dir, out);
    assert.deepEqual(result.report.errors, []);
    assert.ok(result.zipPath?.endsWith("pesquisa-1.0.0.zip"));
    assert.ok(readFileSync(result.shaPath!, "utf8").startsWith(result.built!.sha256));
  });

  it("refuses to pack an app with placeholders left", () => {
    const result = scaffoldApp({ slug: "incompleto", type: "skill", trail: "planejar", root });
    const packed = packModule(result.dir, join(sandbox, "dist"));
    assert.equal(packed.built, undefined);
    assert.ok(packed.report.errors.some((error) => error.includes(PLACEHOLDER)));
  });
});

function buildShaOf(path: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = process.getBuiltinModule("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("the store's example of an app (CLI-CONTRACT.md 10.1)", () => {
  const good = {
    "pt-BR": {
      request: "Quero um roteiro sobre marmita da semana.",
      reply: [{ label: "Título", text: "Marmita da semana em 1 hora" }, { text: "Na quarta você já não aguenta a mesma comida." }],
      saved: "Salvo em roteiros/marmita/estrutura.md",
    },
    en: { request: "I want a script about weekly meal prep.", reply: [{ text: "Weekly meal prep in 1 hour" }] },
  };

  it("takes the contract's shape and refuses what the platform's import would drop", () => {
    assert.deepEqual(showcaseErrors(good), []);
    const broken = (patch: Record<string, unknown>) => showcaseErrors({ "pt-BR": { ...good["pt-BR"], ...patch } });
    assert.ok(broken({ request: "x".repeat(401) }).some((error) => error.includes("limit is 400")));
    assert.ok(broken({ reply: [] }).some((error) => error.includes("1 to 8 lines")));
    assert.ok(broken({ reply: Array.from({ length: 9 }, () => ({ text: "linha" })) }).some((error) => error.includes("1 to 8 lines")));
    assert.ok(broken({ reply: [{ label: "x".repeat(41), text: "ok" }] }).some((error) => error.includes("limit is 40")));
    assert.ok(broken({ saved: "x".repeat(161) }).some((error) => error.includes("limit is 160")));
    assert.ok(broken({ reply: [{ text: "Pronto — agora sim" }] }).some((error) => error.includes("[travessao]")));
    assert.ok(broken({ reply: [{ text: "Pronto!" }] }).some((error) => error.includes("[exclamacao]")));
    assert.ok(broken({ request: "Quero o plano grátis" }).some((error) => error.includes("[gratis]")));
    assert.ok(broken({ reply: [{ text: "Disponível no FlyeeClub Pro" }] }).some((error) => error.includes("[pro]")));
    assert.ok(showcaseErrors({ es: good["pt-BR"] }).some((error) => error.includes("unknown language")));
    assert.ok(broken({ answer: "x" }).some((error) => error.includes('unknown key "answer"')));
  });

  it("goes into the index and never into the package, so released versions keep their checksum", () => {
    const dir = makeApp("vitrine");
    mkdirSync(join(dir, ".dev"), { recursive: true });
    writeFileSync(join(dir, ".dev", "showcase.json"), JSON.stringify(good));
    assert.ok(!buildPackage(dir).files.some((file) => file.includes("showcase")));
    assert.deepEqual(buildIndex([dir]).apps[0].showcase, good);
    assert.deepEqual(validateModule(dir).errors.filter((error) => error.includes("showcase")), []);
    writeFileSync(join(dir, ".dev", "showcase.json"), "{ not json");
    assert.ok(validateModule(dir).errors.some((error) => error.includes("not valid JSON")));
  });

  it("sends null for a language the store must drop, since a language left out keeps the catalog's", () => {
    const dropped = { "pt-BR": good["pt-BR"], en: null };
    assert.deepEqual(showcaseErrors(dropped), []);
    const dir = makeApp("vitrine-pt");
    mkdirSync(join(dir, ".dev"), { recursive: true });
    writeFileSync(join(dir, ".dev", "showcase.json"), JSON.stringify(dropped));
    assert.deepEqual(buildIndex([dir]).apps[0].showcase, dropped);
    assert.ok(JSON.stringify(buildIndex([dir])).includes('"en":null'), "null survives into the index file");
    assert.ok(showcaseErrors({ en: "nada" }).some((error) => error.includes("or null")));
  });
});
