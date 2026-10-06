/**
 * Versions as the platform's catalog stores and orders them (CLI-CONTRACT.md,
 * section 6): MAJOR.MINOR.PATCH with no leading zeros and up to five digits
 * each, an optional prerelease of up to 20 characters, no build metadata. A
 * release sorts after its own prereleases. Re-implemented here on purpose: this
 * repository never imports platform code.
 */

export const SEMVER_PATTERN =
  /^(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})(?:-([0-9A-Za-z][0-9A-Za-z.-]{0,19}))?$/;

export function isSemver(value: unknown): value is string {
  return typeof value === "string" && SEMVER_PATTERN.test(value);
}

export function semverKey(value: string): [number, number, number, number] | null {
  const match = SEMVER_PATTERN.exec(value);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : 0];
}

/** Negative when `a` sorts before `b`, positive after, 0 when the catalog considers them equal. */
export function compareSemver(a: string, b: string): number {
  const left = semverKey(a);
  const right = semverKey(b);
  if (!left || !right) return (left ? 1 : 0) - (right ? 1 : 0);
  for (let index = 0; index < 4; index += 1) {
    const difference = left[index] - right[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

/** The lowest version a `min_core` comparator admits: `>=1.0.0`, `^1.0.0`, `~1.0.0`, `=1.0.0`, `1.0.0`. */
export function minimumOfRange(range: string | null | undefined): string | null {
  if (typeof range !== "string") return null;
  const bare = range.trim().replace(/^(?:\^|~|>=|=)\s*/, "");
  return isSemver(bare) ? bare : null;
}
