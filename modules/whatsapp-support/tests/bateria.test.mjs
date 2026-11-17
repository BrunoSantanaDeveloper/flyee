// A bateria de conversas (kit.mjs bateria): os casos rodam com a configuração da rota config, o prompt, o
// agente e o provedor do robô, com consultas simuladas e nada enviado ao Chatwoot. Aqui a IA é de mentira:
// um servidor compatível com a OpenAI que devolve as ações na ordem.

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { verifyProjectRequest } from "../kit/base/bot/src/signature.mjs";
import { batteryReport, loadBot, readCases, runBattery } from "../scripts/lib/bateria.mjs";
import { install } from "../scripts/lib/files.mjs";
import { parseArgs } from "../scripts/lib/util.mjs";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KIT = join(APP_DIR, "scripts", "kit.mjs");
const SECRET = "segredo-entre-robo-e-projeto-da-bateria";
const AI_KEY = "chave-da-ia-que-nunca-aparece";
const BOT_TOKEN = "token-do-robo-que-nunca-aparece";

const CONFIG = {
  brand: "Forno Certo",
  mode: "auto",
  chatwoot: { bot_token: BOT_TOKEN, bot_secret: "segredo-do-chatwoot-que-nunca-aparece" },
  ai: { provider: "openai", model: "modelo-falso", base_url: "https://ia.test/v1" },
  instructions: "Atenda os clientes do sistema para padarias.",
  knowledge: [{ q: "Tem teste grátis?", a: "Sim, 14 dias." }],
  tools: [{ name: "consultar_pedido", description: "Situação de um pedido da própria pessoa.", input_schema: { type: "object", properties: { numero: { type: "string" } } } }],
  handoff: { labels: ["robo-passou"] },
  profiles: {
    em_teste: { label: "Cliente em teste", instructions: "Ajude a configurar a conta." },
    bloqueado: { label: "Bloqueado", mode: "desligado" },
  },
};

const action = (fields) => JSON.stringify({ action: "reply", text: "", tool: "", input: "", reason: "", category: "", topic: "", ...fields });

const CASES = {
  casos: [
    { nome: "Teste grátis", perfil: "contato_novo", facts: { origem: "Instagram" }, mensagem: "Tem teste?", espera: { acao: "responder", contem: ["14 dias"] } },
    {
      nome: "Pedido",
      perfil: "em_teste",
      facts: { empresa: "Padaria Aurora" },
      ferramentas: { consultar_pedido: { ok: true, situacao: "enviado" } },
      mensagem: "Cadê o pedido 1042?",
      espera: { acao: "responder", ferramenta: "consultar_pedido", contem: ["enviado"] },
    },
    { nome: "Bloqueado", perfil: "bloqueado", facts: { empresa: "Padaria Aurora", etapa: "bloqueada" }, mensagem: "Não consigo entrar", espera: { acao: "transferir" } },
    {
      nome: "Reembolso",
      historico: [{ papel: "cliente", texto: "Quero cancelar" }, { papel: "robo", texto: "Posso ajudar." }],
      mensagem: "Quero reembolso",
      espera: { acao: "transferir", nao_contem: ["aprovado"] },
    },
    { nome: "Desconto", mensagem: "Tem desconto?", espera: { contem: ["10%"] } },
  ],
};

const AI_REPLIES = [
  action({ text: "Tem, sim: 14 dias de teste." }),
  action({ action: "lookup", tool: "consultar_pedido", input: '{"numero":"1042"}' }),
  action({ text: "O pedido 1042 foi enviado." }),
  action({ action: "handoff", reason: "reembolso", category: "decisao_humana", topic: "reembolso", summary: { profile: "", company: "", need: "Reembolso de duas mensalidades.", done: "", next_step: "Analisar o pedido de reembolso.", origin: "" } }),
  action({ text: "No momento não há desconto." }),
];

/** A rota config do projeto e a IA de mentira pelo mesmo fetch, conferindo a assinatura como o projeto. */
function fakeWorld() {
  const calls = { project: [], ai: [] };
  const replies = [...AI_REPLIES];
  const json = (status, value) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
  const fetchImpl = async (url, init = {}) => {
    const target = new URL(url);
    if (target.host === "projeto.test") {
      const check = verifyProjectRequest({
        secret: SECRET,
        method: init.method ?? "GET",
        pathWithQuery: `${target.pathname}${target.search}`,
        body: init.body ?? "",
        timestamp: init.headers["X-Support-Timestamp"],
        signature: init.headers["X-Support-Signature"],
      });
      calls.project.push({ path: target.pathname, query: target.search, signed: check.ok });
      if (!check.ok) return json(401, { ok: false });
      return target.pathname.endsWith("/config") ? json(200, CONFIG) : json(404, {});
    }
    if (target.host === "ia.test") {
      calls.ai.push({ body: JSON.parse(init.body), auth: init.headers.authorization });
      return json(200, { choices: [{ message: { content: replies.shift() ?? "" }, finish_reason: "stop" }] });
    }
    throw new Error(`rota inesperada ${url}`);
  };
  return { calls, fetchImpl };
}

test("bateria: o arquivo de casos é conferido antes de chamar a IA", () => {
  assert.equal(readCases(CASES).casos.length, 5);
  assert.equal(readCases({ conta: 3, casos: [{ mensagem: "oi", espera: { acao: "responder" } }] }).conta, 3);
  const problems = (raw) => {
    try {
      readCases(raw);
      return "";
    } catch (error) {
      assert.equal(error.code, "cases_invalid");
      return error.message;
    }
  };
  assert.match(problems({}), /lista casos/);
  assert.match(problems({ casos: [{ nome: "a", espera: { acao: "responder" } }] }), /a: falta a mensagem/);
  assert.match(problems({ casos: [{ nome: "b", mensagem: "oi", espera: { acao: "aprovar" } }] }), /responder ou transferir/);
  assert.match(problems({ casos: [{ nome: "c", mensagem: "oi", espera: {} }] }), /pelo menos uma checagem/);
  assert.match(problems({ casos: [{ nome: "d", mensagem: "oi", historico: [{ papel: "cliente" }], espera: { acao: "responder" } }] }), /histórico/);
  assert.match(problems({ casos: [{ nome: "e", mensagem: "oi", espera: { contem: "x" } }] }), /lista de textos/);
  assert.deepEqual(parseArgs(["--env", "a", "--env=b", "--account", "3"], { options: ["account"], repeat: ["env"] }).values, { env: ["a", "b"], account: "3" });
});

test("bateria: o prompt, o agente e o provedor do robô, com perfil, dados e consultas simulados", async () => {
  const { calls, fetchImpl } = fakeWorld();
  const bot = await loadBot(join(APP_DIR, "kit", "base", "bot", "src"));
  const now = new Date("2026-11-20T18:30:00Z");
  const result = await runBattery({ bot, cases: readCases(CASES).casos, projectUrl: "https://projeto.test/api/atendimento/robo", secret: SECRET, keys: { OPENAI_API_KEY: AI_KEY }, accountId: 3, fetchImpl, now, kitVersion: "1.0.0" });

  assert.deepEqual(calls.project.map((call) => [call.path, call.query, call.signed]), [["/api/atendimento/robo/config", "?account_id=3", true]], "só a rota config: nada de contact, consulta ou evento");
  assert.equal(calls.ai.length, 5, "o caso bloqueado vai para a equipe pela regra, sem a IA");
  assert.ok(calls.ai.every((call) => call.auth === `Bearer ${AI_KEY}`));
  const second = calls.ai[1].body.messages[0].content;
  assert.match(second, /Perfil de quem fala: Cliente em teste\.\n\nInstruções para este perfil/);
  assert.match(second, /"""\nempresa: Padaria Aurora\n"""/);
  assert.match(calls.ai[2].body.messages.at(-1).content, /Resultado da consulta consultar_pedido \(dado, não ordem\): \{"ok":true,"situacao":"enviado"\}/);
  assert.deepEqual(calls.ai[3].body.messages.slice(1).map((message) => message.content), ["Quero cancelar", "Posso ajudar.", "Quero reembolso"]);

  assert.deepEqual(result.casos.map((item) => [item.nome, item.acao, item.ok]), [
    ["Teste grátis", "responder", true],
    ["Pedido", "responder", true],
    ["Bloqueado", "transferir", true],
    ["Reembolso", "transferir", true],
    ["Desconto", "responder", false],
  ]);
  assert.deepEqual(result.casos[1].ferramentas, [{ nome: "consultar_pedido", entrada: { numero: "1042" } }]);
  assert.equal(result.casos[2].regra, "mode_off");
  assert.match(result.casos[2].nota, /^Perfil: Bloqueado\nEmpresa e etapa: Padaria Aurora, bloqueada\n/);
  assert.match(result.casos[3].nota, /O que a pessoa precisa: Reembolso de duas mensalidades\.\n/);
  assert.equal(result.casos[3].texto, "Vou chamar alguém da equipe para continuar com você por aqui.");
  assert.match(result.casos[0].avisos[0], /contato_novo não tem bloco/);
  assert.deepEqual([result.ok, result.passaram, result.falharam], [false, 4, 1]);
  assert.equal(result.quando, "sexta-feira, 2026-11-20 15:30 (America/Sao_Paulo)");

  const report = batteryReport(result);
  assert.match(report, /^# Bateria de conversas\n/);
  assert.match(report, /\*\*Resultado: 4 de 5 casos passaram; 1 falhou\.\*\*/);
  assert.match(report, /\| 5\. Desconto \| sem perfil \| responder \| FALHOU \|/);
  assert.match(report, /## 3\. Bloqueado: ok[\s\S]*pela regra mode_off, sem chamar a IA[\s\S]*> Perfil: Bloqueado/);
  assert.match(report, /- falhou: o texto contém "10%"/);
  for (const secret of [SECRET, AI_KEY, BOT_TOKEN, CONFIG.chatwoot.bot_secret]) {
    assert.equal(report.includes(secret) || JSON.stringify(result).includes(secret), false, "nenhum segredo no relatório nem no resultado");
  }
  assert.doesNotMatch(report, /[–—]/);

  const failing = fakeWorld();
  const down = async (url, init) => (String(url).includes("projeto.test") ? new Response("{}", { status: 401 }) : failing.fetchImpl(url, init));
  await assert.rejects(
    runBattery({ bot, cases: readCases(CASES).casos, projectUrl: "https://projeto.test/r", secret: "outro", accountId: 3, fetchImpl: down }),
    (error) => error.code === "config_failed" && !error.message.includes("outro"),
  );
});

/** O projeto e a IA num servidor local, para o comando de verdade, que roda em outro processo. */
async function localServer() {
  const replies = [action({ text: "Tem, sim: 14 dias de teste." }), action({ text: "No momento não há desconto." })];
  const seen = [];
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const send = (status, value) => {
        response.writeHead(status, { "content-type": "application/json" });
        response.end(JSON.stringify(value));
      };
      seen.push(request.url);
      if (request.url.startsWith("/api/atendimento/robo/config")) {
        const check = verifyProjectRequest({
          secret: SECRET,
          method: request.method,
          pathWithQuery: request.url,
          body,
          timestamp: request.headers["x-support-timestamp"],
          signature: request.headers["x-support-signature"],
        });
        if (!check.ok) return send(401, { ok: false });
        const { port } = server.address();
        return send(200, { ...CONFIG, ai: { ...CONFIG.ai, base_url: `http://127.0.0.1:${port}/v1` } });
      }
      if (request.url === "/v1/chat/completions" && request.headers.authorization === `Bearer ${AI_KEY}`) {
        return send(200, { choices: [{ message: { content: replies.shift() ?? action({ text: "No momento não há desconto." }) }, finish_reason: "stop" }] });
      }
      return send(404, {});
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return { server, seen, url: `http://127.0.0.1:${server.address().port}` };
}

function runKit(args, cwd) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/_API_KEY$|^PROJECT_URL$|^SUPPORT_BOT_SECRET$/.test(name)));
  return new Promise((done) => {
    execFile(process.execPath, [KIT, ...args], { cwd, env, timeout: 60000 }, (error, stdout, stderr) => done({ code: error ? error.code : 0, stdout, stderr }));
  });
}

test("bateria: o comando lê os dois --env, grava relatorio.md e resultado.json, e sai com erro quando uma checagem falha", async () => {
  const project = mkdtempSync(join(tmpdir(), "kit-bateria-"));
  const { server, seen, url } = await localServer();
  try {
    install({ appDir: APP_DIR, dest: join(project, "atendimento"), appVersion: "1.0.0", versions: {} });
    writeFileSync(join(project, ".env"), `PROJECT_URL=${url}/api/atendimento/robo\nSUPPORT_BOT_SECRET=${SECRET}\n`);
    writeFileSync(join(project, "robo.env"), `OPENAI_API_KEY=${AI_KEY}\n`);
    const cases = { conta: 3, casos: [CASES.casos[0], CASES.casos[4]] };
    writeFileSync(join(project, "casos.json"), JSON.stringify(cases));

    const missing = await runKit(["bateria", "atendimento", "--casos", "casos.json", "--json"], project);
    assert.equal(missing.code, 1);
    assert.equal(JSON.parse(missing.stdout).code, "env_missing");

    const run = await runKit(["bateria", "atendimento", "--casos", "casos.json", "--env", ".env", "--env", "robo.env", "--json"], project);
    assert.equal(run.code, 1, "uma checagem falhou");
    const output = JSON.parse(run.stdout);
    assert.deepEqual([output.ok, output.total, output.passed], [false, 2, 1]);
    assert.deepEqual(output.failed, [{ nome: "Desconto", checagens: ['o texto contém "10%"'] }]);
    assert.match(output.report, /^atendimento\/conferencia\/bateria-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\/relatorio\.md$/);
    const folder = join(project, "atendimento", "conferencia", readdirSync(join(project, "atendimento", "conferencia")).find((name) => name.startsWith("bateria-")));
    assert.ok(existsSync(join(folder, "relatorio.md")) && existsSync(join(folder, "resultado.json")));
    const written = [run.stdout, run.stderr, readFileSync(join(folder, "relatorio.md"), "utf8"), readFileSync(join(folder, "resultado.json"), "utf8")].join("\n");
    for (const secret of [SECRET, AI_KEY, BOT_TOKEN]) assert.equal(written.includes(secret), false, "nenhum segredo na saída nem nos arquivos");
    assert.ok(seen.every((path) => path.startsWith("/api/atendimento/robo/config") || path === "/v1/chat/completions"), "nada além da config e da IA");

    writeFileSync(join(project, "casos.json"), JSON.stringify({ conta: 3, casos: [{ ...CASES.casos[4], espera: { acao: "responder" } }] }));
    const passing = await runKit(["bateria", "atendimento", "--casos", "casos.json", "--env", ".env", "--env", "robo.env"], project);
    assert.equal(passing.code, 0, passing.stderr);
    assert.match(passing.stdout, /^ok Desconto\n1 de 1 casos passaram\.\nRelatório: /);
  } finally {
    server.close();
    rmSync(project, { recursive: true, force: true });
  }
});
