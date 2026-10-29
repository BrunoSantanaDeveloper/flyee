import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, posix } from "node:path";

import { MANIFEST_FILE, shippableFiles } from "./files.ts";

/**
 * The package files an app's shipped text names must exist, so a reference to
 * a renamed or deleted file fails here and never in the member's AI. Two forms,
 * the ones the apps use (a grep of modules/ on 2026-10-29):
 *
 * - a path relative to a skill's folder, the Agent Skills convention, such as
 *   `../../references/x.md` or `../../scripts/x.mjs` in skills/<name>/SKILL.md,
 *   resolved from the file's own folder. Only in the Markdown of a skill's
 *   folder and only climbing (`../`): elsewhere a relative path is the
 *   member's project, like the `../motion.js` and `../assets/` of a slide page
 *   in motion-carousel's references/slide-page.md, or the `src` of an HTML
 *   template copied into a project;
 * - the installed path of this app or another, `.flyee/modules/<slug>/<path>`,
 *   in every shipped text file and in the manifest (its `shell` scopes run
 *   scripts by that path), checked against what modules/<slug> ships.
 *
 * Skipped: a placeholder (`<`, `>`, `…`, `*`, `{`, `}` or `$` in the path), a
 * URL, a path that leaves the package, and an app that does not exist, which
 * `uses:` already reports. A bare path is never read: `youtube-research/outliers/<id>/titulos.json`
 * is a file an app writes in the member's project, and a bare `scripts/research.mjs`
 * in a script can be another app's file.
 */

/** The shipped files read for references: relations.ts's text files, plus the pages and data of a package. */
const TEXT_FILE = /\.(?:md|mjs|cjs|js|ts|py|sh|ps1|json|txt|ya?ml|html?|css|svg)$/i;
/** `.flyee/modules/<slug>/` and the path after it, up to a space, a quote, a bracket or a separator. */
const INSTALLED = /\.flyee\/modules\/([a-z0-9][a-z0-9-]{1,59})\/([^\s`'"()[\]|,;\\]*)/g;
/** A path that starts by climbing out of the file's folder (`../`), never one in the middle of another path. */
const RELATIVE = /(?<![\w./-])(?:\.\.\/)+[^\s`'"()[\]|,;\\]*/g;
const PLACEHOLDER = /[<>…*{}$]/u;
const URL = /[a-z][a-z0-9+.-]*:\/\/[^\s`'"<>()[\]]*/gi;

/** A path as written, without the sentence around it: a final period or colon, an anchor. */
function tidy(path: string): string {
  return path.split(/[?#]/)[0].replace(/[.:!?]+$/, "");
}

type Package = { files: Set<string>; dirs: Set<string> };

function packageOf(files: string[]): Package {
  const dirs = new Set<string>();
  for (const file of files) {
    const segments = file.split("/");
    for (let end = 1; end < segments.length; end += 1) dirs.add(segments.slice(0, end).join("/"));
  }
  return { files: new Set([...files, MANIFEST_FILE]), dirs };
}

/** Whether a package path, a file or a folder (a final `/`), is in the package. The package root always is. */
function ships(pkg: Package, path: string): boolean {
  const bare = path.replace(/\/+$/, "");
  if (!bare) return true;
  return pkg.dirs.has(bare) || (!path.endsWith("/") && pkg.files.has(bare));
}

/** A path inside the package, normalized; null when it leaves it. */
function inside(path: string): string | null {
  const normalized = posix.normalize(path);
  if (normalized === ".." || normalized.startsWith("../")) return null;
  return normalized === "." || normalized === "./" ? "" : normalized;
}

/** `file:line: "<reference>" points to …` for every package file a shipped text names and the package does not ship. */
export function referenceErrors(dir: string, files: string[]): string[] {
  const self = basename(dir);
  const root = dirname(dir);
  const packages = new Map<string, Package | null>([[self, packageOf(files)]]);
  const packageNamed = (slug: string): Package | null => {
    if (!packages.has(slug)) {
      const other = join(root, slug);
      packages.set(slug, existsSync(join(other, MANIFEST_FILE)) ? packageOf(shippableFiles(other)) : null);
    }
    return packages.get(slug)!;
  };
  const errors: string[] = [];
  for (const file of [MANIFEST_FILE, ...files.filter((candidate) => TEXT_FILE.test(candidate))]) {
    let text: string;
    try {
      text = readFileSync(join(dir, ...file.split("/")), "utf8");
    } catch {
      continue;
    }
    const inSkillFolder = /^skills\/[^/]+\/.+\.md$/i.test(file);
    text.split("\n").forEach((line, index) => {
      const urls = [...line.matchAll(URL)].map((match) => [match.index, match.index + match[0].length] as const);
      const inUrl = (at: number) => urls.some(([start, end]) => at >= start && at < end);
      const reported = new Set<string>();
      const report = (reference: string, problem: string) => {
        if (reported.has(reference)) return;
        reported.add(reference);
        errors.push(`${file}:${index + 1}: "${reference}" ${problem}`);
      };
      for (const match of line.matchAll(INSTALLED)) {
        const [, slug, written] = match;
        if (inUrl(match.index) || PLACEHOLDER.test(written)) continue;
        const path = inside(tidy(written));
        const pkg = packageNamed(slug);
        if (!path || !pkg || ships(pkg, path)) continue;
        report(`.flyee/modules/${slug}/${tidy(written)}`, slug === self ? `points to ${path}, which the package does not ship` : `points to ${path}, which the package of ${slug} does not ship`);
      }
      if (!inSkillFolder) return;
      for (const match of line.matchAll(RELATIVE)) {
        if (inUrl(match.index) || PLACEHOLDER.test(match[0])) continue;
        const written = tidy(match[0]);
        const path = inside(posix.join(posix.dirname(file), written));
        if (!path || ships(packages.get(self)!, path)) continue;
        report(written, `points to ${path}, which the package does not ship`);
      }
    });
  }
  return errors;
}
