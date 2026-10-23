// A small CSV reader for the exports a member brings: BOM, comma or semicolon, quoted fields,
// decimal comma. Nothing here knows what the columns mean; exports.mjs does.

/** Splits a CSV text into rows of strings. Detects the separator on the header line. */
export function parseCsv(text, { separator = null } = {}) {
  const clean = String(text ?? "").replace(/^﻿/, "");
  const sep = separator ?? detectSeparator(clean);
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (quoted) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === sep) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return { separator: sep, rows };
}

/** The separator the header uses: the one that appears most outside quotes. */
export function detectSeparator(text) {
  const header = text.split(/\r?\n/)[0] ?? "";
  const count = (sep) => {
    let n = 0;
    let quoted = false;
    for (const char of header) {
      if (char === '"') quoted = !quoted;
      else if (!quoted && char === sep) n++;
    }
    return n;
  };
  const candidates = [";", ",", "\t"].map((sep) => ({ sep, n: count(sep) })).sort((a, b) => b.n - a.n);
  return candidates[0].n > 0 ? candidates[0].sep : ",";
}

/** Rows as objects keyed by the header, with the header kept as it came. */
export function parseTable(text) {
  const { separator, rows } = parseCsv(text);
  if (!rows.length) return { separator, header: [], records: [] };
  const header = rows[0].map((cell) => cell.trim());
  const records = rows.slice(1).map((cells) => Object.fromEntries(header.map((name, index) => [name, (cells[index] ?? "").trim()])));
  return { separator, header, records };
}

/**
 * A number as an export writes it: "1.234,56", "1,234.56", "12,5%", "R$ 1.234,56", "—" or "".
 * Returns null when the cell is empty or not a number; never zero for a missing value.
 */
export function parseNumber(cell) {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  let text = String(cell).trim();
  if (!text || /^(-|—|–|n\/a|na|null)$/i.test(text)) return null;
  text = text.replace(/[R$€£\s%]/g, "").replace(/^BRL|USD$/i, "");
  if (!text) return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    // Both present: the later one is the decimal mark.
    text = lastComma > lastDot ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (lastComma !== -1) {
    // Only commas: a decimal mark when it is followed by 1 or 2 digits at the end, else thousands.
    text = /,\d{1,2}$/.test(text) && text.split(",").length === 2 ? text.replace(",", ".") : text.replace(/,/g, "");
  } else if (lastDot !== -1) {
    // Only dots: thousands when the groups are three digits long, otherwise a decimal mark.
    if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** One CSV line, quoting what needs quoting. */
export function csvLine(values, separator = ",") {
  return values
    .map((value) => {
      const text = value === null || value === undefined ? "" : String(value);
      return /[",;\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    })
    .join(separator);
}
