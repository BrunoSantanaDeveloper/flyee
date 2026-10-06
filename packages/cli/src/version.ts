import { readFileSync } from "node:fs";

/**
 * The CLI version comes from package.json, which sits one level above both
 * src/ (tests) and dist/ (the bundle).
 */
export const CLI_VERSION: string = (() => {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();
