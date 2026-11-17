// A bateria de conversas: casos escritos por quem aprova o atendimento rodam com a configuração de produção
// (a rota config assinada, a mesma que o robô lê), o mesmo prompt, o mesmo agente e o mesmo provedor do robô,
// carregados da base instalada no projeto. O perfil e os dados de cada caso entram como se a rota contact
// tivesse respondido; as consultas devolvem o resultado simulado do caso, sem chamar o projeto; nada vai para
// o Chatwoot. Nenhum segredo vai para a saída: nem a chave da IA, nem SUPPORT_BOT_SECRET, nem os tokens da conta.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { AppError } from "./util.mjs";

const BOT_FILES = { policy: "policy.mjs", conversation: "conversation.mjs", prompt: "prompt.mjs", agent: "agent.mjs", project: "project.mjs", ai: "ai/index.mjs" };
const ROLES = ["cliente", "robo", "equipe"];
const ACTIONS = { responder: "reply", transferir: "handoff" };
const NO_RESULT = { ok: false, code: "sem_resultado_no_caso" };

/** Os módulos do robô da base do projeto (<destino>/base/bot/src): o que roda para os clientes. */
export async function loadBot(srcDir) {
  const missing = Object.values(BOT_FILES).filter((file) => !existsSync(join(srcDir, ...file.split("/"))));
  if (missing.length) {
    throw new AppError("base_outdated", `A base do robô em ${srcDir} não tem ${missing.join(", ")}.`, "Atualize a base com update (references/atualizar.md) e rode a bateria de novo.");
  }
  const modules = {};
  for (const [name, file] of Object.entries(BOT_FILES)) modules[name] = await import(pathToFileURL(join(srcDir, ...file.split("/"))).href);
  const { policy, conversation, prompt, agent, project, ai } = modules;
  return {
    normalizeConfig: policy.normalizeConfig,
    localParts: policy.localParts,
    weekdays: policy.WEEKDAY_NAMES,
    contactProfile: conversation.contactProfile,
    conversationConfig: conversation.conversationConfig,
    ruleHandoff: conversation.ruleHandoff,
    handoffMessage: conversation.handoffMessage,
    handoffSummary: conversation.handoffSummary,
    buildSystemPrompt: prompt.buildSystemPrompt,
    toMessages: prompt.toMessages,
    runAgent: agent.runAgent,
    projectClient: project.projectClient,
    providerFor: ai.providerFor,
  };
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isTextList = (value) => Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim());

/** O arquivo de casos, conferido antes de gastar uma chamada à IA. Devolve { conta, casos }. */
export function readCases(raw) {
  if (!isObject(raw) || !Array.isArray(raw.casos) || !raw.casos.length) {
    throw new AppError("cases_invalid", "O arquivo de casos precisa de uma lista casos com pelo menos um caso.", "Veja o formato em references/bateria.md.");
  }
  const problems = [];
  const casos = raw.casos.map((item, index) => {
    const nome = String(item?.nome ?? "").trim() || `caso ${index + 1}`;
    const add = (text) => problems.push(`${nome}: ${text}`);
    if (!isObject(item)) {
      add("o caso precisa ser um objeto");
      return null;
    }
    if (!String(item.mensagem ?? "").trim()) add("falta a mensagem do cliente");
    if (item.perfil !== undefined && item.perfil !== null && typeof item.perfil !== "string") add("perfil é a chave de um perfil, em texto");
    if (item.facts !== undefined && !isObject(item.facts)) add("facts é um objeto com os dados da pessoa");
    if (item.ferramentas !== undefined && !isObject(item.ferramentas)) add("ferramentas é um objeto com o resultado simulado de cada consulta");
    const historico = item.historico ?? [];
    if (!Array.isArray(historico) || historico.some((entry) => !ROLES.includes(entry?.papel) || typeof entry?.texto !== "string")) {
      add("cada item do histórico tem papel (cliente, robo ou equipe) e texto");
    }
    const espera = item.espera ?? {};
    if (!isObject(espera)) add("espera é um objeto");
    else {
      if (espera.acao !== undefined && !ACTIONS[espera.acao]) add("espera.acao é responder ou transferir");
      for (const field of ["contem", "nao_contem"]) if (espera[field] !== undefined && !isTextList(espera[field])) add(`espera.${field} é uma lista de textos`);
      if (espera.ferramenta !== undefined && (typeof espera.ferramenta !== "string" || !espera.ferramenta.trim())) add("espera.ferramenta é o nome de uma consulta");
      if (![espera.acao, espera.contem, espera.nao_contem, espera.ferramenta].some((value) => value !== undefined)) {
        add("espera precisa de pelo menos uma checagem: acao, contem, nao_contem ou ferramenta");
      }
    }
    return {
      nome,
      perfil: typeof item.perfil === "string" ? item.perfil.trim() : null,
      facts: isObject(item.facts) ? item.facts : {},
      ferramentas: isObject(item.ferramentas) ? item.ferramentas : {},
      historico: Array.isArray(historico) ? historico : [],
      mensagem: String(item.mensagem ?? "").trim(),
      espera: isObject(espera) ? espera : {},
    };
  });
  if (problems.length) {
    throw new AppError("cases_invalid", `O arquivo de casos tem problemas: ${problems.join("; ")}.`, "Corrija os casos; o formato está em references/bateria.md.");
  }
  return { conta: raw.conta ?? null, casos };
}

/** Sem acento e sem maiúsculas, para conferir o texto do robô. */
const fold = (text) => String(text ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function checksFor(espera, result) {
  const checks = [];
  if (espera.acao) checks.push({ checagem: `a ação é ${espera.acao}`, ok: result.acao === espera.acao, visto: result.acao });
  for (const term of espera.contem ?? []) checks.push({ checagem: `o texto contém "${term}"`, ok: fold(result.texto).includes(fold(term)) });
  for (const term of espera.nao_contem ?? []) checks.push({ checagem: `o texto não contém "${term}"`, ok: !fold(result.texto).includes(fold(term)) });
  if (espera.ferramenta) {
    const names = result.ferramentas.map((call) => call.nome);
    checks.push({ checagem: `consultou ${espera.ferramenta}`, ok: names.includes(espera.ferramenta), visto: names.join(", ") || "nenhuma consulta" });
  }
  return checks;
}

async function runCase({ bot, config, caso, project, keys, accountId, fetchImpl, now }) {
  const info = bot.contactProfile({ profile: caso.perfil, facts: caso.facts });
  const cfg = bot.conversationConfig(config, info);
  const result = {
    nome: caso.nome,
    perfil: info.key,
    mensagem: caso.mensagem,
    modo: cfg.mode,
    acao: null,
    regra: null,
    texto: "",
    nota: "",
    motivo: "",
    ferramentas: [],
    avisos: [],
    checagens: [],
    ok: false,
    erro: null,
  };
  if (caso.perfil && !info.key) result.avisos.push(`A chave ${caso.perfil} não é uma chave de perfil válida: o caso rodou sem perfil.`);
  if (info.key && !config.profiles?.[info.key]) result.avisos.push(`O perfil ${info.key} não tem bloco na configuração da conta: valeu o padrão.`);
  try {
    // As mesmas regras que o robô aplica antes da IA: modo desligado, palavras que chamam a equipe e limite.
    const turns = caso.historico.filter((entry) => entry.papel === "robo").length;
    const rule = bot.ruleHandoff(cfg, { text: caso.mensagem, turns });
    let action;
    if (rule) action = { action: "handoff", text: "", reason: rule.reason, summary: {} };
    else {
      const transcript = [...caso.historico.map((entry) => ({ role: entry.papel, text: entry.texto })), { role: "cliente", text: caso.mensagem }];
      const generateWith = bot.providerFor(cfg.ai.provider);
      const generate = ({ system, messages, schema }) =>
        generateWith({ ai: cfg.ai, system, messages, schema, keys, fetchImpl, project, ids: { account: accountId, conversation: 0 }, tools: cfg.tools, purpose: "acao" });
      const callTool = async (name, input) => {
        result.ferramentas.push({ nome: name, entrada: input });
        return Object.hasOwn(caso.ferramentas, name) ? caso.ferramentas[name] : NO_RESULT;
      };
      action = await bot.runAgent({ generate, system: bot.buildSystemPrompt(cfg, { now }), messages: bot.toMessages(transcript), tools: cfg.tools, callTool });
    }
    result.acao = action.action === "reply" ? "responder" : "transferir";
    result.regra = rule?.code ?? null;
    result.motivo = action.reason ?? "";
    if (action.action === "reply") result.texto = action.text;
    else {
      result.texto = bot.handoffMessage(cfg, { text: action.text, code: rule?.code ?? "", now });
      result.nota = bot.handoffSummary(cfg, { ai: action.summary ?? {}, need: caso.mensagem, done: rule?.done ?? "" });
    }
  } catch (error) {
    result.erro = error?.code ?? "unexpected";
  }
  result.checagens = result.erro ? [{ checagem: "o robô chegou a uma ação", ok: false, visto: `falhou (${result.erro})` }] : checksFor(caso.espera, result);
  result.ok = result.checagens.every((check) => check.ok);
  return result;
}

/**
 * Roda os casos. projectUrl e secret: PROJECT_URL e SUPPORT_BOT_SECRET, como no robô; keys: as variáveis
 * terminadas em _API_KEY. Devolve o resultado sem nenhum segredo, pronto para resultado.json.
 */
export async function runBattery({ bot, cases, projectUrl, secret, keys = {}, accountId, fetchImpl = fetch, now = new Date(), kitVersion = null }) {
  const project = bot.projectClient({ baseUrl: projectUrl, secret, fetchImpl });
  let config;
  try {
    config = bot.normalizeConfig(await project.config(accountId));
  } catch (error) {
    throw new AppError(
      "config_failed",
      `A rota config do projeto não devolveu a configuração da conta ${accountId} (${error?.code ?? "erro"}).`,
      "Confira PROJECT_URL, SUPPORT_BOT_SECRET e o número da conta: é a mesma rota que o robô lê.",
    );
  }
  const casos = [];
  for (const caso of cases) casos.push(await runCase({ bot, config, caso, project, keys, accountId, fetchImpl, now }));
  const timeZone = config.hours?.timezone || "America/Sao_Paulo";
  const local = bot.localParts(now, timeZone);
  const passed = casos.filter((item) => item.ok).length;
  return {
    ok: passed === casos.length,
    quando: `${bot.weekdays[local.day]}, ${local.date} ${local.time} (${timeZone})`,
    conta: accountId,
    marca: config.brand,
    ia: { provedor: config.ai.provider, modelo: config.ai.model },
    modo: config.mode,
    perfis: Object.keys(config.profiles ?? {}),
    kit: kitVersion,
    total: casos.length,
    passaram: passed,
    falharam: casos.length - passed,
    casos,
  };
}

const quote = (text) =>
  String(text ?? "")
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
const cell = (text) => String(text ?? "").replace(/\|/g, "/").replace(/\s+/g, " ").trim();

/** O relatório para quem aprova: o resumo no topo e, para cada caso, o que entrou, o que o robô fez e cada checagem. */
export function batteryReport(result) {
  const lines = [
    "# Bateria de conversas",
    "",
    `Rodada em ${result.quando}, conta ${result.conta} (${result.marca}), com ${result.ia.provedor}${result.ia.modelo ? ` ${result.ia.modelo}` : ""}${result.kit ? ` e a base do kit ${result.kit}` : ""}. Modo da conta: ${result.modo}.`,
    "",
    `**Resultado: ${result.passaram} de ${result.total} casos passaram${result.falharam ? `; ${result.falharam} ${result.falharam === 1 ? "falhou" : "falharam"}` : ""}.**`,
    "",
    "| Caso | Perfil | Ação | Resultado |",
    "|---|---|---|---|",
    ...result.casos.map((item, index) => `| ${index + 1}. ${cell(item.nome)} | ${item.perfil ?? "sem perfil"} | ${item.acao ?? "nenhuma"} | ${item.ok ? "ok" : "FALHOU"} |`),
  ];
  result.casos.forEach((item, index) => {
    lines.push("", `## ${index + 1}. ${item.nome}: ${item.ok ? "ok" : "FALHOU"}`, "");
    lines.push(`Perfil: ${item.perfil ?? "sem perfil"}. Modo nesta conversa: ${item.modo}.`, "", "Mensagem do cliente:", "", quote(item.mensagem), "");
    if (item.erro) lines.push(`O robô não chegou a uma ação: falhou com o código ${item.erro}. Na conversa de verdade, ele passaria para a equipe.`, "");
    else {
      const how = item.regra ? ` (pela regra ${item.regra}, sem chamar a IA)` : "";
      lines.push(`Ação: ${item.acao}${how}.`, "");
      if (item.acao === "transferir" && item.motivo) lines.push(`Motivo para o relatório das lacunas: ${item.motivo}.`, "");
      lines.push(item.texto ? "Texto para a pessoa:" : "Texto para a pessoa: nenhum.", "");
      if (item.texto) lines.push(quote(item.texto), "");
      if (item.modo === "sugestao") lines.push("No modo sugestão, o texto vira uma nota interna que a equipe revisa antes de enviar.", "");
      if (item.nota) lines.push("Nota para a equipe:", "", quote(item.nota), "");
      lines.push(
        item.ferramentas.length
          ? `Consultas: ${item.ferramentas.map((call) => `${call.nome} ${JSON.stringify(call.entrada)}`).join("; ")}.`
          : "Consultas: nenhuma.",
        "",
      );
    }
    for (const aviso of item.avisos) lines.push(`Aviso: ${aviso}`, "");
    lines.push("Checagens:", "", ...item.checagens.map((check) => `- ${check.ok ? "ok" : "falhou"}: ${check.checagem}${check.visto && !check.ok ? ` (veio: ${check.visto})` : ""}`));
  });
  return `${lines.join("\n")}\n`;
}
