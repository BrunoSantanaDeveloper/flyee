// The networks table (references/redes.json): which formats and durations each social
// network takes, and where its interface covers the video. Everything the acceptance
// checks know about Reels, TikTok, Shorts and the others comes from here.

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { AppError, parseList, requireJson } from "./util.mjs";

const DEFAULT_APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The table loaded last; `loadNetworks` replaces it, the other functions fall back to it. */
let current = null;

/** Reads references/redes.json of the app (or of `appDir`) and keeps it as the current table. */
export function loadNetworks(appDir = DEFAULT_APP_DIR) {
  const file = join(appDir, "references", "redes.json");
  const table = requireJson(file, "a tabela das redes");
  if (table.format_version !== 1 || !table.networks || typeof table.networks !== "object" || !table.formats) {
    throw new AppError("networks_table_invalid", `A tabela das redes (${file}) está num formato que este Motor não entende.`, "Reinstale o app Motor de vídeo.");
  }
  current = table;
  return table;
}

const tableOf = (table) => table ?? current ?? loadNetworks();

/** "Instagram Reels", "whatsapp-status", " TikTok " → the key the table uses. */
export function normalizeNetworkName(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s_]+/g, "-");
}

export function networkIds(table) {
  return Object.keys(tableOf(table).networks);
}

/** One network by id or alias, with its id attached; an unknown name is a friendly error. */
export function networkFor(name, table) {
  const data = tableOf(table);
  const wanted = normalizeNetworkName(name);
  for (const [id, entry] of Object.entries(data.networks)) {
    const names = [id, ...(entry.aliases ?? [])].map(normalizeNetworkName);
    if (names.includes(wanted)) return { id, ...entry };
  }
  const known = Object.entries(data.networks).map(([id, entry]) => `${id} (${entry.label})`).join(", ");
  throw new AppError("unknown_network", `Não conheço a rede "${name}".`, `Use uma destas: ${known}.`);
}

/** A compact view of every network, for help texts and for the AI to choose from. */
export function listNetworks(table) {
  const data = tableOf(table);
  return Object.entries(data.networks).map(([id, entry]) => ({
    id,
    label: entry.label,
    aliases: entry.aliases ?? [],
    formats: entry.formats,
    recommended_format: entry.recommended_format,
    min_duration_s: entry.min_duration_s ?? null,
    max_duration_s: entry.max_duration_s ?? null,
    recommended_duration_s: entry.recommended_duration_s ?? null,
    max_file_mb: entry.max_file_mb ?? null,
    captions: entry.captions ?? null,
    loudness: entry.loudness ?? null,
    notes: entry.notes ?? [],
  }));
}

/**
 * The networks named in `list` ("reels,tiktok" or an array), each with its id and, when a
 * format is given, whether it takes that format. Unknown names throw `unknown_network`.
 */
export function resolveNetworks(list, format = null, table) {
  const names = Array.isArray(list) ? list : parseList(list);
  const seen = new Set();
  const resolved = [];
  for (const name of names) {
    const network = networkFor(name, table);
    if (seen.has(network.id)) continue;
    seen.add(network.id);
    resolved.push({
      ...network,
      supports_format: format ? network.formats.includes(format) : null,
      recommended_for_format: format ? network.recommended_format === format : null,
    });
  }
  return resolved;
}

/** The networks a video of this format usually goes to, when the caller names none. */
export function defaultNetworks(format, table) {
  const data = tableOf(table);
  const ids = data.defaults_by_format?.[format] ?? [];
  return ids.map((id) => networkFor(id, table));
}

/** The reference pixel size of a named format, or null for a custom one. */
export function formatSize(format, table) {
  const entry = tableOf(table).formats?.[format];
  return entry ? { width: entry.width, height: entry.height } : null;
}

/** The table's format whose aspect ratio is closest to a frame, for sizes that have no name. */
export function nearestFormat(width, height, table) {
  const data = tableOf(table);
  const ratio = width / height;
  let best = null;
  for (const [name, entry] of Object.entries(data.formats ?? {})) {
    const diff = Math.abs(ratio - entry.width / entry.height);
    if (!best || diff < best.diff) best = { name, diff };
  }
  return best ? best.name : null;
}

/** The insets a network (or, without one, the format itself) declares for a format, at the reference size. */
export function safeInsets(network, format, table) {
  const data = tableOf(table);
  const fromNetwork = network ? (typeof network === "string" ? networkFor(network, table) : network).safe_zone?.[format] : null;
  const insets = fromNetwork ?? data.formats?.[format]?.safe_zone ?? null;
  return insets ? { top: insets.top, bottom: insets.bottom, left: insets.left, right: insets.right } : null;
}

/**
 * The safe area of a network for a format, scaled to a video of `width` × `height` pixels:
 * the rectangle where text, logo and faces stay clear of the network's interface.
 * `network` may be an id, a resolved entry or null (the format's own default). Returns null
 * when neither the network nor the table knows the format.
 */
export function safeArea(network, format, width, height, table) {
  const reference = formatSize(format, table);
  const insets = safeInsets(network, format, table);
  if (!reference || !insets) return null;
  const sx = width / reference.width;
  const sy = height / reference.height;
  const scaled = { top: insets.top * sy, bottom: insets.bottom * sy, left: insets.left * sx, right: insets.right * sx };
  return {
    x: scaled.left,
    y: scaled.top,
    w: width - scaled.left - scaled.right,
    h: height - scaled.top - scaled.bottom,
    insets: scaled,
    reference,
    format,
    network: network ? (typeof network === "string" ? network : network.id) : null,
  };
}

/** The strictest rectangle shared by several safe areas (the largest inset on each side). */
export function unionSafeArea(areas, width, height) {
  const valid = areas.filter(Boolean);
  if (!valid.length) return null;
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  for (const area of valid) {
    for (const side of Object.keys(insets)) insets[side] = Math.max(insets[side], area.insets[side]);
  }
  return {
    x: insets.left,
    y: insets.top,
    w: width - insets.left - insets.right,
    h: height - insets.top - insets.bottom,
    insets,
    networks: valid.map((area) => area.network).filter(Boolean),
  };
}
