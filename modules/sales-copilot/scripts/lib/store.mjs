// Where calls live: copiloto-de-vendas/calls/<id>/ at the project root, one folder per call.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { DATA_DIR } from "./playbook.mjs";
import { AppError, readJson, shortHash, slugify, today, writeJson } from "./util.mjs";

export const callsDir = (root) => join(root, DATA_DIR, "calls");
export const callDir = (root, id) => join(callsDir(root), id);

/** Creates the call's folder and its call.json. `source` says where the turns came from and when. */
export function createCall(root, { name, mode, judge, turns, source, date = today() }) {
  const base = `${date}-${slugify(name || mode)}`;
  let id = `${base}-${shortHash(`${base}|${turns.length}|${turns[0]?.text ?? ""}|${Date.now()}`, 4)}`;
  while (existsSync(callDir(root, id))) id = `${base}-${shortHash(id, 4)}`;
  const call = {
    format_version: 1,
    id,
    name: name || null,
    mode,
    judge,
    date,
    created_at: new Date().toISOString(),
    source,
    outcome: null,
    turns,
    answers: {},
    usage: null,
  };
  saveCall(root, call);
  return call;
}

export function saveCall(root, call) {
  writeJson(join(callDir(root, call.id), "call.json"), call);
}

export function listCalls(root) {
  if (!existsSync(callsDir(root))) return [];
  return readdirSync(callsDir(root), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readJson(join(callsDir(root), entry.name, "call.json")))
    .filter((call) => call?.id)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

/** A call by its id, by the start of its id, or `last` for the newest one. */
export function findCall(root, wanted) {
  const calls = listCalls(root);
  if (!wanted) throw new AppError("usage", "Falta o id da call.", "Rode call list para ver os ids, ou use last para a mais recente.");
  if (wanted === "last") {
    if (!calls.length) throw new AppError("call_not_found", "Ainda não há nenhuma call neste projeto.", "Comece com call new, practice start ou live start.");
    return calls[calls.length - 1];
  }
  const matches = calls.filter((call) => call.id === wanted);
  const found = matches.length ? matches : calls.filter((call) => call.id.startsWith(wanted));
  if (found.length === 1) return found[0];
  if (!found.length) throw new AppError("call_not_found", `Não encontrei a call ${wanted}.`, "Rode call list para ver os ids.");
  throw new AppError("usage", `O id ${wanted} serve a mais de uma call.`, `Use o id inteiro: ${found.map((call) => call.id).join(", ")}.`);
}
