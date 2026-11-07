// Instalar, conferir e atualizar o kit dentro do projeto.
//   <destino>/base/      cópia de kit/base: o projeto nunca edita; a atualização troca
//   <destino>/modelos/   cópia de kit/modelos na primeira vez: a IA leva para o código do projeto e adapta
//   <destino>/kit.json   versão instalada, versões travadas e o hash de cada arquivo copiado
// Atualizar nunca sobrescreve um arquivo da base que o projeto editou: para e lista.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { AppError, readJson, sha256, toPosix, writeFileAtomic, writeJson } from "./util.mjs";

export const KIT_FILE = "kit.json";

export function listFiles(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) out.push(toPosix(relative(dir, path)));
    }
  };
  if (existsSync(dir)) walk(dir);
  return out.sort();
}

function hashFile(path) {
  return sha256(readFileSync(path));
}

function hashTree(dir) {
  return Object.fromEntries(listFiles(dir).map((file) => [file, hashFile(join(dir, file))]));
}

function copy(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

const GITIGNORE_LINES = ["segredos/", "conferencia/", "*.projeto"];

function ensureGitignore(dest) {
  const path = join(dest, ".gitignore");
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  const missing = GITIGNORE_LINES.filter((line) => !current.split(/\r?\n/).includes(line));
  if (!missing.length) return false;
  const header = current ? "" : "# Kit de atendimento: segredos e capturas nunca vão para o git.\n";
  writeFileAtomic(path, `${current}${current && !current.endsWith("\n") ? "\n" : ""}${header}${missing.join("\n")}\n`);
  return true;
}

/** Instala o kit em dest. Recusa se já existe um kit.json ali (use update). */
export function install({ appDir, dest, appVersion, versions, now = new Date() }) {
  if (existsSync(join(dest, KIT_FILE))) {
    throw new AppError("already_installed", `Já existe um kit instalado em ${dest}.`, "Rode status para ver a versão e update para atualizar.");
  }
  const baseSource = join(appDir, "kit", "base");
  const modelSource = join(appDir, "kit", "modelos");
  const baseFiles = listFiles(baseSource);
  const existing = baseFiles.filter((file) => existsSync(join(dest, "base", file)));
  if (existing.length) {
    throw new AppError("base_exists", `Já há arquivos em ${join(dest, "base")} que o kit escreveria (${existing.slice(0, 3).join(", ")}).`, "Escolha outra pasta de destino ou mova a pasta base existente.");
  }
  for (const file of baseFiles) copy(join(baseSource, file), join(dest, "base", file));
  const modelFiles = listFiles(modelSource);
  const copiedModels = [];
  for (const file of modelFiles) {
    const target = join(dest, "modelos", file);
    if (existsSync(target)) continue;
    copy(join(modelSource, file), target);
    copiedModels.push(file);
  }
  const escolhas = join(dest, "escolhas.json");
  const createdChoices = !existsSync(escolhas);
  if (createdChoices) copy(join(appDir, "references", "escolhas.exemplo.json"), escolhas);
  for (const folder of ["gerado", "segredos", "conferencia"]) mkdirSync(join(dest, folder), { recursive: true });
  const gitignore = ensureGitignore(dest);
  const record = {
    app: "whatsapp-support",
    version: appVersion,
    installed_at: now.toISOString(),
    updated_at: now.toISOString(),
    versions,
    base: hashTree(baseSource),
    modelos: hashTree(modelSource),
  };
  writeJson(join(dest, KIT_FILE), record);
  return { base: baseFiles.length, modelos: copiedModels.length, escolhas: createdChoices, gitignore };
}

/** O que mudou na base desde a instalação ou a última atualização. */
export function status({ dest, appVersion, versions }) {
  const record = readJson(join(dest, KIT_FILE));
  if (!record) throw new AppError("not_installed", `Não há kit instalado em ${dest}.`, "Rode install com a pasta de destino escolhida.");
  const modified = [];
  const missing = [];
  for (const [file, hash] of Object.entries(record.base ?? {})) {
    const path = join(dest, "base", file);
    if (!existsSync(path)) missing.push(file);
    else if (hashFile(path) !== hash) modified.push(file);
  }
  const pinned = Object.entries(versions ?? {})
    .filter(([key, value]) => record.versions?.[key] !== value)
    .map(([key, value]) => ({ name: key, installed: record.versions?.[key] ?? null, kit: value }));
  return {
    installed: record.version,
    available: appVersion,
    update_available: record.version !== appVersion,
    modified,
    missing,
    versions_changed: pinned,
    choices: existsSync(join(dest, "escolhas.json")),
  };
}

/**
 * Atualiza a base para a versão do app. Arquivo da base editado pelo projeto: sem force, nada muda e a
 * lista volta; com force, a versão do projeto fica em <arquivo>.projeto e a do kit entra no lugar.
 * Modelos: só entram os que faltam; os que mudaram no kit voltam na lista models_changed para a IA portar.
 */
export function update({ appDir, dest, appVersion, versions, force = false, now = new Date() }) {
  const record = readJson(join(dest, KIT_FILE));
  if (!record) throw new AppError("not_installed", `Não há kit instalado em ${dest}.`, "Rode install com a pasta de destino escolhida.");
  const baseSource = join(appDir, "kit", "base");
  const next = hashTree(baseSource);
  const old = record.base ?? {};
  const conflicts = [];
  for (const [file, hash] of Object.entries(old)) {
    const path = join(dest, "base", file);
    if (existsSync(path) && hashFile(path) !== hash && next[file] !== hashFile(path)) conflicts.push(file);
  }
  for (const file of Object.keys(next)) {
    if (!(file in old) && existsSync(join(dest, "base", file)) && hashFile(join(dest, "base", file)) !== next[file]) conflicts.push(file);
  }
  if (conflicts.length && !force) {
    return { updated: false, conflicts, from: record.version, to: appVersion };
  }
  const written = [];
  const removed = [];
  const kept = [];
  for (const [file, hash] of Object.entries(next)) {
    const target = join(dest, "base", file);
    if (existsSync(target) && hashFile(target) === hash) continue;
    if (conflicts.includes(file)) copy(target, `${target}.projeto`);
    copy(join(baseSource, file), target);
    written.push(file);
  }
  for (const [file, hash] of Object.entries(old)) {
    if (file in next) continue;
    const target = join(dest, "base", file);
    if (!existsSync(target)) continue;
    if (hashFile(target) === hash) {
      rmSync(target);
      removed.push(file);
    } else kept.push(file);
  }
  const modelSource = join(appDir, "kit", "modelos");
  const models = hashTree(modelSource);
  const modelsAdded = [];
  const modelsChanged = [];
  for (const [file, hash] of Object.entries(models)) {
    const target = join(dest, "modelos", file);
    if (!existsSync(target)) {
      copy(join(modelSource, file), target);
      modelsAdded.push(file);
    } else if (record.modelos?.[file] && record.modelos[file] !== hash) modelsChanged.push(file);
  }
  writeJson(join(dest, KIT_FILE), {
    ...record,
    version: appVersion,
    updated_at: now.toISOString(),
    previous_version: record.version,
    versions,
    base: next,
    modelos: models,
  });
  return { updated: true, from: record.version, to: appVersion, written, removed, kept, conflicts, models_added: modelsAdded, models_changed: modelsChanged };
}

/** Procura kit.json do kit dentro do projeto (até 4 níveis), para quando o destino não foi dito. */
export function findInstalls(root, depth = 4) {
  const found = [];
  const skip = new Set(["node_modules", ".git", ".next", "dist", "build", ".flyee", "vendor"]);
  const walk = (dir, level) => {
    if (level > depth) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isFile() && entry.name === KIT_FILE) {
        const record = readJson(join(dir, entry.name));
        if (record?.app === "whatsapp-support") found.push(toPosix(relative(root, dir)) || ".");
      } else if (entry.isDirectory() && !skip.has(entry.name) && !entry.name.startsWith(".")) {
        walk(join(dir, entry.name), level + 1);
      }
    }
  };
  if (existsSync(root) && statSync(root).isDirectory()) walk(root, 0);
  return found;
}
