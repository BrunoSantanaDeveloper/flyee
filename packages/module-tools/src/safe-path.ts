/**
 * A path inside a package: relative, forward slashes, no `.` or `..` segments,
 * no drive letter, no control characters, at most 240 characters. The same
 * rule the platform applies to every ZIP entry (CLI-CONTRACT.md, section 6),
 * so a package can never write outside its folder.
 */
export function isSafePackagePath(value: string): boolean {
  if (!value || value.length > 240) return false;
  if (value.startsWith("/") || value.includes("\\") || value.includes(":")) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  return value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}
