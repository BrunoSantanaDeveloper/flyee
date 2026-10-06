/**
 * Versions as the platform orders them (CLI-CONTRACT.md, section 6). Mirrors
 * the catalog rules on purpose; this package never imports platform code.
 */
export const SEMVER_PATTERN =
  /^(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})(?:-([0-9A-Za-z][0-9A-Za-z.-]{0,19}))?$/;

export function isSemver(value: unknown): value is string {
  return typeof value === "string" && SEMVER_PATTERN.test(value);
}

function key(value: string): [number, number, number, number] | null {
  const match = SEMVER_PATTERN.exec(value);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : 0];
}

/** Negative when `a` sorts before `b`. Prerelease identifiers of the same release compare equal, as in the catalog. */
export function compareSemver(a: string, b: string): number {
  const left = key(a);
  const right = key(b);
  if (!left || !right) return (left ? 1 : 0) - (right ? 1 : 0);
  for (let index = 0; index < 4; index += 1) {
    const difference = left[index] - right[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

/** `>=1.2.0`, `^1.2.0`, `~1.2.0`, `=1.2.0` and `1.2.0` all admit 1.2.0 as their minimum. */
export function minimumOfRange(range: string | null | undefined): string | null {
  if (typeof range !== "string") return null;
  const bare = range.trim().replace(/^(?:\^|~|>=|=)\s*/, "");
  return isSemver(bare) ? bare : null;
}

/** True when `version` is at least the minimum a comparator admits. */
export function satisfiesMinimum(version: string, range: string | null | undefined): boolean {
  const minimum = minimumOfRange(range);
  if (!minimum) return true;
  return compareSemver(version, minimum) >= 0;
}
