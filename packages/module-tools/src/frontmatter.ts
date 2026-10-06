/**
 * The small YAML subset a SKILL.md frontmatter uses: `key: value`, quoted
 * values, and block scalars (`|`, `>`, with optional `-` chomping). Nested
 * maps (such as `metadata:`) are kept as raw text under their key. Anything
 * stranger is a reason to simplify the frontmatter, not to grow this parser.
 */

export type Frontmatter = { data: Record<string, string>; keys: string[]; body: string };

export function parseFrontmatter(content: string): Frontmatter | null {
  const text = content.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---", 4);
  if (end < 0) return null;
  const block = text.slice(4, end);
  const afterEnd = text.indexOf("\n", end + 1);
  const body = afterEnd < 0 ? "" : text.slice(afterEnd + 1);

  const lines = block.split("\n");
  const data: Record<string, string> = {};
  const keys: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith("#")) {
      index += 1;
      continue;
    }
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) {
      index += 1;
      continue;
    }
    const key = match[1];
    let value = match[2].trim();
    keys.push(key);
    index += 1;

    const blockScalar = /^([|>])([+-]?)\s*$/.exec(value);
    if (blockScalar || value === "") {
      const collected: string[] = [];
      while (index < lines.length && (lines[index].startsWith(" ") || lines[index].startsWith("\t") || lines[index].trim() === "")) {
        collected.push(lines[index]);
        index += 1;
      }
      while (collected.length && collected[collected.length - 1].trim() === "") collected.pop();
      const indent = collected.reduce((min, l) => {
        if (!l.trim()) return min;
        const spaces = l.length - l.trimStart().length;
        return Math.min(min, spaces);
      }, Number.POSITIVE_INFINITY);
      const dedented = collected.map((l) => (l.trim() ? l.slice(Number.isFinite(indent) ? indent : 0) : ""));
      if (blockScalar && blockScalar[1] === ">") {
        value = dedented
          .join("\n")
          .replace(/([^\n])\n(?!\n)/g, "$1 ")
          .trim();
      } else {
        value = dedented.join("\n").trim();
      }
    } else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1).replace(/''/g, "'").replace(/\\"/g, '"');
    }
    data[key] = value;
  }
  return { data, keys, body };
}
