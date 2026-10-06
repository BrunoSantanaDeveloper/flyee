/**
 * The YAML subset a SKILL.md frontmatter uses: `key: value`, quoted values and
 * block scalars (`|`, `>`). Enough to carry `name` and `description` into a
 * bridge file; the canonical skill keeps its original frontmatter untouched.
 */
export type Frontmatter = { data: Record<string, string>; keys: string[] };

export function parseFrontmatter(content: string): Frontmatter | null {
  const text = content.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---", 4);
  if (end < 0) return null;
  const lines = text.slice(4, end).split("\n");
  const data: Record<string, string> = {};
  const keys: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) {
      index += 1;
      continue;
    }
    const key = match[1];
    let value = match[2].trim();
    keys.push(key);
    index += 1;
    const block = /^([|>])([+-]?)\s*$/.exec(value);
    if (block || value === "") {
      const collected: string[] = [];
      while (index < lines.length && (/^\s/.test(lines[index]) || lines[index].trim() === "")) {
        collected.push(lines[index]);
        index += 1;
      }
      while (collected.length && collected[collected.length - 1].trim() === "") collected.pop();
      const indent = collected.reduce((min, l) => (l.trim() ? Math.min(min, l.length - l.trimStart().length) : min), Number.POSITIVE_INFINITY);
      const dedented = collected.map((l) => (l.trim() ? l.slice(Number.isFinite(indent) ? indent : 0) : ""));
      value = block && block[1] === ">" ? dedented.join("\n").replace(/([^\n])\n(?!\n)/g, "$1 ").trim() : dedented.join("\n").trim();
    } else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1).replace(/''/g, "'").replace(/\\"/g, '"');
    }
    data[key] = value;
  }
  return { data, keys };
}
