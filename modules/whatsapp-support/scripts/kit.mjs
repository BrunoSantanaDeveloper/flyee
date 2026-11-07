#!/usr/bin/env node
// Kit de atendimento no WhatsApp: a IA roda este script a partir da raiz do projeto de código.
// Com --json, só o JSON vai para a saída padrão; o progresso vai para a saída de erro.
// Nunca imprime valor de segredo: os relatórios só dizem o nome do que falta.

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnv, pick } from "./lib/env.mjs";
import { findInstalls, install, status, update } from "./lib/files.mjs";
import { DEFAULT_SCREENS, look } from "./lib/look.mjs";
import { buildTheme } from "./lib/theme.mjs";
import { AppError, insideProject, parseArgs, projectRoot, readJson, toPosix, writeFileAtomic, writeJson } from "./lib/util.mjs";
import { verify } from "./lib/verify.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(SCRIPTS_DIR, "..");
const ROOT = projectRoot(SCRIPTS_DIR);
const APP_VERSION = readJson(join(APP_DIR, "flyee.module.json"))?.version ?? "0.0.0";
const VERSIONS = readJson(join(APP_DIR, "kit", "versoes.json")) ?? {};
const NBRAND = readJson(join(APP_DIR, "references", "n-brand.json")) ?? { classes: [] };
const NEVER_OFF = ["api_and_webhooks", "agent_bots", "inbox_management", "agent_management", "labels"];

const HELP = `Kit de atendimento no WhatsApp ${APP_VERSION}

  check                         o kit está pronto; onde já está instalado neste projeto
  install <destino>             copia a base e os modelos para <destino> e cria escolhas.json
  status [<destino>]            versão instalada, arquivos da base editados, versões travadas
  update <destino> [--force]    troca a base pela versão do kit; para se o projeto editou um arquivo dela
  theme <destino>               gera gerado/painel.html, gerado/marca.env e gerado/tema.json de escolhas.json
  verify <destino> [--env <arquivo>] [--account <id>]
                                confere por HTTP o painel, a marca, o tema, a moldura, as funções, o robô e o OpenWA
  look <destino> --account <id> --user <id> [--env <arquivo>] [--claro]
                                confere no navegador, entrando pelo login único da pessoa <id>, e salva capturas
  help

Todos aceitam --json. <destino> é uma pasta dentro do projeto aberto, por exemplo atendimento ou packages/atendimento.`;

const ARG_SPEC = { flags: ["json", "force", "claro"], options: ["env", "account", "user"] };

let jsonMode = false;
const progress = (text) => {
  if (!jsonMode) process.stderr.write(`${text}\n`);
};

function emit(result, lines = []) {
  if (jsonMode) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else process.stdout.write(`${lines.join("\n")}\n`);
}

function destination(positionals, { required = true } = {}) {
  const value = positionals[1];
  if (!value) {
    if (!required) return null;
    throw new AppError("usage", "Falta a pasta de destino do kit.", "Passe a pasta dentro do projeto, por exemplo atendimento.");
  }
  return insideProject(ROOT, value);
}

const rel = (path) => toPosix(path.slice(ROOT.length + 1)) || ".";

function readChoices(dest) {
  const escolhas = readJson(join(dest, "escolhas.json"));
  if (!escolhas) throw new AppError("choices_missing", `Não encontrei ${rel(join(dest, "escolhas.json"))}.`, "Rode install primeiro; ele cria o arquivo de escolhas.");
  return escolhas;
}

async function main(argv) {
  const { positionals, values } = parseArgs(argv, ARG_SPEC);
  jsonMode = Boolean(values.json);
  const command = positionals[0] ?? "help";
  const base = { ok: true, command, app: { name: "whatsapp-support", version: APP_VERSION }, project: ROOT };

  if (command === "help") return emit({ ...base, help: HELP }, [HELP]);

  if (command === "check") {
    const installs = findInstalls(ROOT);
    return emit({ ...base, installs, versions: VERSIONS }, [
      `Kit ${APP_VERSION}, Chatwoot ${VERSIONS.chatwoot}, OpenWA ${VERSIONS.openwa}.`,
      installs.length ? `Instalado em: ${installs.join(", ")}` : "Ainda não instalado neste projeto.",
    ]);
  }

  if (command === "install") {
    const dest = destination(positionals);
    progress(`Instalando o kit em ${rel(dest)}...`);
    const result = install({ appDir: APP_DIR, dest, appVersion: APP_VERSION, versions: VERSIONS });
    return emit({ ...base, dest: rel(dest), ...result, next_step: "Preencha escolhas.json com a marca do projeto e rode theme." }, [
      `Kit ${APP_VERSION} instalado em ${rel(dest)}: ${result.base} arquivos da base, ${result.modelos} modelos.`,
      result.escolhas ? "escolhas.json criado a partir do exemplo." : "escolhas.json já existia e ficou como estava.",
      "Próximo passo: preencher escolhas.json e rodar theme.",
    ]);
  }

  if (command === "status") {
    const dest = destination(positionals, { required: false });
    const targets = dest ? [dest] : findInstalls(ROOT).map((path) => join(ROOT, path));
    if (!targets.length) throw new AppError("not_installed", "O kit não está instalado neste projeto.", "Rode install com a pasta de destino escolhida.");
    const reports = targets.map((target) => ({ dest: rel(target), ...status({ appDir: APP_DIR, dest: target, appVersion: APP_VERSION, versions: VERSIONS }) }));
    return emit({ ...base, installs: reports }, reports.flatMap((report) => [
      `${report.dest}: instalado ${report.installed}, kit ${report.available}${report.update_available ? " (há atualização)" : ""}.`,
      report.modified.length ? `Arquivos da base editados pelo projeto: ${report.modified.join(", ")}` : "Nenhum arquivo da base editado.",
      ...report.versions_changed.map((item) => `Versão travada mudou: ${item.name} de ${item.installed ?? "nenhuma"} para ${item.kit}.`),
    ]));
  }

  if (command === "update") {
    const dest = destination(positionals);
    progress(`Atualizando o kit em ${rel(dest)}...`);
    const result = update({ appDir: APP_DIR, dest, appVersion: APP_VERSION, versions: VERSIONS, force: Boolean(values.force) });
    if (!result.updated) {
      process.exitCode = 1;
      return emit(
        { ok: false, command, code: "base_edited", message: "O projeto editou arquivos da base; nada foi trocado.", fix: "Leve as edições para fora da base (modelos ou código do projeto) e rode update de novo, ou rode com --force para guardar a versão do projeto em <arquivo>.projeto.", conflicts: result.conflicts },
        [`Nada foi trocado: o projeto editou ${result.conflicts.join(", ")}.`],
      );
    }
    return emit({ ...base, dest: rel(dest), ...result, next_step: "Leia references/atualizar.md para o que muda de uma versão para outra e porte os modelos listados em models_changed." }, [
      `Base atualizada de ${result.from} para ${result.to}: ${result.written.length} arquivos trocados, ${result.removed.length} removidos.`,
      result.models_changed.length ? `Modelos que mudaram no kit (portar à mão): ${result.models_changed.join(", ")}` : "Nenhum modelo mudou.",
    ]);
  }

  if (command === "theme") {
    const dest = destination(positionals);
    const escolhas = readChoices(dest);
    const theme = buildTheme({ escolhas, nbrand: NBRAND, appVersion: APP_VERSION });
    writeFileAtomic(join(dest, "gerado", "painel.html"), `${theme.html}\n`);
    writeFileAtomic(join(dest, "gerado", "marca.env"), theme.marcaEnv);
    writeJson(join(dest, "gerado", "tema.json"), theme.summary);
    return emit({ ...base, dest: rel(dest), theme: theme.summary, files: ["gerado/painel.html", "gerado/marca.env", "gerado/tema.json"], next_step: "Aplique no Chatwoot com o apply-config.rb no caminho de implantação e rode verify." }, [
      `Tema ${theme.summary.hash} gerado: cor ${theme.summary.primary} (claro) e ${theme.summary.primary_dark} (escuro), ${theme.summary.classes} regras, ${theme.summary.hides.length} itens escondidos.`,
      theme.summary.skipped.length ? `Classes sem regra (variante desconhecida): ${theme.summary.skipped.join(", ")}` : "Todas as classes com o azul fixo têm regra.",
    ]);
  }

  if (command === "verify") {
    const dest = destination(positionals);
    const escolhas = readChoices(dest);
    const summary = readJson(join(dest, "gerado", "tema.json"));
    if (!summary) throw new AppError("theme_missing", "Falta gerado/tema.json.", "Rode theme antes de verify.");
    const env = loadEnv(values.env ? insideProject(ROOT, values.env) : null);
    const { missing } = pick(env, ["CHATWOOT_PUBLIC_URL"]);
    progress("Conferindo o atendimento por HTTP...");
    const result = await verify({
      env,
      expected: {
        chatwootVersion: VERSIONS.chatwoot,
        brand: summary.brand,
        themeHash: summary.hash,
        frame: Boolean(escolhas.chatwoot?.moldura),
        projectOrigin: env.PROJECT_ORIGIN ?? null,
        featuresOff: escolhas.chatwoot?.features_off ?? [],
        neverOff: NEVER_OFF,
        accountId: values.account ? Number(values.account) : null,
      },
    });
    if (!result.ok) process.exitCode = 1;
    return emit({ ...base, ok: result.ok, missing_env: missing, checks: result.checks }, [
      ...result.checks.map((check) => `${check.ok ? "ok" : "FALHA"} ${check.name}: ${check.seen}${check.fix ? `. ${check.fix}` : ""}`),
      missing.length ? `Faltam variáveis: ${missing.join(", ")}` : "",
    ].filter(Boolean));
  }

  if (command === "look") {
    const dest = destination(positionals);
    const escolhas = readChoices(dest);
    const summary = readJson(join(dest, "gerado", "tema.json"));
    if (!summary) throw new AppError("theme_missing", "Falta gerado/tema.json.", "Rode theme antes de look.");
    if (!values.account || !values.user) throw new AppError("usage", "look precisa de --account e --user.", "Use a conta e a pessoa de teste (atendente) criadas pelo projeto.");
    const env = loadEnv(values.env ? insideProject(ROOT, values.env) : null);
    const { values: needed, missing } = pick(env, ["CHATWOOT_PUBLIC_URL", "CHATWOOT_PLATFORM_TOKEN"]);
    if (missing.length) throw new AppError("env_missing", `Faltam variáveis: ${missing.join(", ")}.`, "Passe --env com o .env do projeto ou defina as variáveis no ambiente.");
    const chatwoot = needed.CHATWOOT_PUBLIC_URL.replace(/\/+$/, "");
    const response = await fetch(`${chatwoot}/platform/api/v1/users/${Number(values.user)}/login`, {
      headers: { authorization: `Bearer ${needed.CHATWOOT_PLATFORM_TOKEN}`, api_access_token: needed.CHATWOOT_PLATFORM_TOKEN },
      signal: AbortSignal.timeout(15000),
    });
    const sso = response.ok ? (await response.json())?.url : null;
    if (!sso) throw new AppError("sso_failed", `O Chatwoot não devolveu o link de entrada (status ${response.status}).`, "Confira o token do Platform App e se a pessoa foi criada por ele.");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const outDir = join(dest, "conferencia", stamp);
    progress("Abrindo o painel no navegador sem janela...");
    const result = await look({
      ssoUrl: sso,
      chatwootUrl: chatwoot,
      accountId: Number(values.account),
      screens: escolhas.conferencia?.telas?.length ? escolhas.conferencia.telas : DEFAULT_SCREENS,
      summary,
      outDir,
      schemes: values.claro ? ["claro"] : ["claro", "escuro"],
      root: ROOT,
    });
    writeJson(join(outDir, "relatorio.json"), result);
    if (!result.ok) process.exitCode = 1;
    return emit({ ...base, ok: result.ok, report: rel(join(outDir, "relatorio.json")), ...result }, [
      ...(result.results ?? []).map((item) => `${item.ok ? "ok" : "FALHA"} ${item.tela} (${item.modo}): ${item.problemas.join("; ") || "como esperado"}. Captura: ${item.captura}`),
      result.problem ?? "",
      `Relatório: ${rel(join(outDir, "relatorio.json"))}`,
    ].filter(Boolean));
  }

  throw new AppError("usage", `Comando desconhecido: ${command}.`, "Rode help para ver os comandos.");
}

main(process.argv.slice(2)).catch((error) => {
  process.exitCode = 1;
  const result = { ok: false, code: error?.code ?? "unexpected", message: error?.message ?? String(error), fix: error?.fix ?? "" };
  if (jsonMode) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else process.stderr.write(`${result.message}${result.fix ? `\n${result.fix}` : ""}\n`);
});
