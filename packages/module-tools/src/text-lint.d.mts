export function proseOf(text: string): string;
export function teachesPatterns(relativePath: string): boolean;
export function lintMemberText(
  text: string,
  options?: { teachesPatterns?: boolean },
): { violations: string[]; advisories: string[]; dashes: number; words: number };
export function isMemberText(relativePath: string): boolean;
