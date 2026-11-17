// Variáveis do projeto para as conferências: o ambiente atual e, se a IA indicar, um arquivo .env do
// projeto (KEY=valor). Os valores nunca são impressos; os relatórios só dizem quais nomes faltam.

import { readFileSync } from "node:fs";

import { AppError } from "./util.mjs";

export function parseDotenv(text) {
  const values = {};
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    let value = match[2];
    if (/^"(.*)"$/s.test(value)) value = value.slice(1, -1).replace(/\\n/g, "\n");
    else if (/^'(.*)'$/s.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, "");
    values[match[1]] = value;
  }
  return values;
}

/** O ambiente da conferência: o do processo, com o arquivo .env por cima quando dado. */
export function loadEnv(envFile, base = process.env) {
  if (!envFile) return { ...base };
  let text;
  try {
    text = readFileSync(envFile, "utf8");
  } catch {
    throw new AppError("env_file_missing", `Não consegui ler o arquivo de variáveis ${envFile}.`, "Indique o .env do projeto que tem as variáveis do atendimento.");
  }
  return { ...base, ...parseDotenv(text) };
}

/** O ambiente com vários arquivos .env por cima, na ordem: o último vence. */
export function loadEnvFiles(envFiles = [], base = process.env) {
  return envFiles.reduce((env, file) => loadEnv(file, env), { ...base });
}

export function pick(env, names) {
  const values = {};
  const missing = [];
  for (const name of names) {
    const value = String(env[name] ?? "").trim();
    if (value) values[name] = value;
    else missing.push(name);
  }
  return { values, missing };
}
