// Servidor com mais de um sistema (D27): a pilha compartilhada e o proxy da borda. O Docker Compose não roda
// nestes testes; eles conferem a estrutura que separa as pilhas, sobre o texto dos arquivos de modelo.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const DIR = join(import.meta.dirname, "..", "kit", "modelos", "implantacao");
const read = (...parts) => readFileSync(join(DIR, ...parts), "utf8");

/** Os blocos de primeiro nível dentro de uma seção (services:, networks:) de um YAML com recuo de dois espaços. */
function blocks(yaml, section) {
  const lines = yaml.split("\n");
  const start = lines.findIndex((line) => line === `${section}:`);
  if (start < 0) return {};
  const result = {};
  let current = null;
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const match = /^ {2}([a-z0-9-]+):\s*(.*)$/.exec(line);
    if (match) {
      current = match[1];
      result[current] = match[2] ? `${match[2]}\n` : "";
    } else if (current) result[current] += `${line}\n`;
  }
  return result;
}

const base = read("compose.yml");
const shared = read("compose.compartilhado.yml");
const edge = read("borda", "compose.yml");
const site = read("borda", "sites", "pilha.caddy.exemplo");
const envExample = read("compartilhado.env.example");

test("pilha compartilhada: nome do projeto obrigatório por pilha e nenhuma porta no servidor", () => {
  assert.match(base, /^name: atendimento$/m, "o modelo de servidor único continua com o nome fixo");
  assert.match(base, /compose\.compartilhado\.yml/, "e avisa que dois sistemas usam a variante compartilhada");
  assert.match(shared, /^name: atendimento-\$\{PILHA:\?[^}]+\}$/m, "sem PILHA, o Compose para em vez de juntar duas pilhas");
  assert.doesNotMatch(shared, /^\s+ports:/m, "só o proxy da borda abre portas");
  const env = Object.fromEntries(envExample.split("\n").filter((line) => /^[A-Z_]+=/.test(line)).map((line) => line.split(/=(.*)/s).slice(0, 2)));
  assert.equal(env.COMPOSE_PROJECT_NAME, `atendimento-${env.PILHA}`, "o .env dá ao projeto o mesmo nome do arquivo");
  assert.equal(env.COMPOSE_FILE, "compose.yml:compose.compartilhado.yml");
  assert.match(env.PILHA, /^[a-z0-9-]+$/);
});

test("pilha compartilhada: teto de memória e CPU em todo serviço que fica no ar", () => {
  const baseServices = blocks(base, "services");
  const sharedServices = blocks(shared, "services");
  const running = Object.keys(baseServices).filter((name) => !/profiles: \["(config|proxy)"\]/.test(baseServices[name]));
  assert.deepEqual(running.sort(), ["chatwoot-rails", "chatwoot-sidekiq", "openwa", "postgres", "redis", "robo"]);
  for (const name of running) {
    assert.match(sharedServices[name] ?? "", /mem_limit: \$\{LIMITE_[A-Z_]+:-\d+[mg]\}/, `${name} sem teto de memória`);
    assert.match(sharedServices[name] ?? "", /cpus: \$\{CPU_[A-Z_]+:-[\d.]+\}/, `${name} sem teto de CPU`);
  }
  const megabytes = [...shared.matchAll(/mem_limit: \$\{LIMITE_[A-Z_]+:-(\d+)([mg])\}/g)].reduce((sum, [, value, unit]) => sum + Number(value) * (unit === "g" ? 1024 : 1), 0);
  assert.ok(megabytes * 2 + 1024 <= 16 * 1024, `duas pilhas com os tetos padrão (${megabytes} MB cada) cabem em 16 GB com 1 GB livre`);
});

test("pilha compartilhada: a borda alcança só o painel, o robô e o OpenWA, pela rede da própria pilha", () => {
  const sharedServices = blocks(shared, "services");
  const exposed = Object.entries(sharedServices).filter(([, text]) => /borda:/.test(text)).map(([name]) => name).sort();
  assert.deepEqual(exposed, ["chatwoot-rails", "openwa", "robo"], "postgres, redis e sidekiq ficam só na rede interna");
  const networks = blocks(shared, "networks");
  assert.match(networks.borda, /name: borda-\$\{PILHA:\?[^}]+\}/);
  assert.match(networks.borda, /external: true/);
  const aliases = Object.fromEntries(exposed.map((name) => [name, /- \$\{PILHA:\?[^}]+\}-([a-z]+)/.exec(sharedServices[name])?.[1]]));
  assert.deepEqual(aliases, { "chatwoot-rails": "chatwoot", openwa: "openwa", robo: "robo" });
});

test("proxy da borda: dono das portas, uma rede por pilha, e o modelo de site aponta para os nomes certos", () => {
  assert.match(edge, /- "80:80"/);
  assert.match(edge, /- "443:443"/);
  assert.match(edge, /\.\/sites:\/etc\/caddy\/sites:ro/);
  const edgeNetworks = Object.keys(blocks(edge, "networks"));
  assert.ok(edgeNetworks.length >= 2 && edgeNetworks.every((name) => name.startsWith("borda-")), "uma rede borda-<pilha> para cada pilha");
  assert.match(read("borda", "Caddyfile"), /^import sites\/\*\.caddy$/m);
  // A porta de cada serviço no modelo de site é a que compose.yml expõe.
  const ports = { chatwoot: /chatwoot-rails:[\s\S]*?expose:\s*\n\s*- "(\d+)"/.exec(base)[1], robo: /robo:[\s\S]*?expose:\s*\n\s*- "(\d+)"/.exec(base)[1], openwa: /openwa:[\s\S]*?expose:\s*\n\s*- "(\d+)"/.exec(base)[1] };
  for (const [suffix, port] of Object.entries(ports)) assert.match(site, new RegExp(`reverse_proxy sistema-a-${suffix}:${port}\\b`), `${suffix} na porta ${port}`);
  assert.match(site, /handle_path \/robo\/\*/);
  assert.match(site, /@api path \/api\/\*/, "do OpenWA, só a API");
});

// Achado da Atrupe, confirmado no Orkestree (2026-11-11): o Caddy 2.11.4 em diante descarta cabeçalhos com
// sublinhado, e o adaptador do OpenWA manda o token do Chatwoot em api_access_token.
test("proxy: o api_access_token do adaptador passa, e a imagem do Caddy é a fixada no kit", () => {
  const pinned = JSON.parse(readFileSync(join(DIR, "..", "..", "versoes.json"), "utf8")).caddy_image;
  assert.match(pinned, /^caddy:\d+\.\d+\.\d+$/, "versão exata, não caddy:2");
  for (const parts of [["Caddyfile"], ["borda", "Caddyfile"]]) {
    const global = /^\{\n([\s\S]*?)\n\}/m.exec(read(...parts))?.[1] ?? "";
    assert.match(global, /servers \{[\s\S]*expected_underscore_headers api_access_token[\s\S]*\}/, `${parts.join("/")} no bloco global`);
  }
  for (const parts of [["compose.yml"], ["borda", "compose.yml"]]) {
    const images = [...read(...parts).matchAll(/image: (caddy:\S+)/g)].map((match) => match[1]);
    assert.deepEqual(images, [pinned], parts.join("/"));
  }
});

// Achados da primeira implantação real (Orkestree, 2026-11-11).
test("implantação real: telemetria desligada, um nome só para o banco e o $$ que o Compose exige", () => {
  const env = read("chatwoot.env.example");
  assert.match(env, /^DISABLE_TELEMETRY=true$/m, "sem ela, o Chatwoot manda contagens ao fornecedor");
  const database = /^POSTGRES_DATABASE=(\S+)$/m.exec(env)?.[1];
  assert.equal(database, "chatwoot_production", "o banco que o Rails usa em produção");
  assert.ok(base.includes(`POSTGRES_DB: ${database}\n`), "o Postgres cria o mesmo banco");
  assert.ok(base.includes(`pg_isready -U $$POSTGRES_USER -d ${database}"`), "o healthcheck confere o mesmo banco, com a variável do contêiner");
});

test("implantação real: a página que cria o super administrador fica fechada no proxy", () => {
  const files = [
    [["Caddyfile"], "INSTALACAO_IPS"],
    [["borda", "sites", "pilha.caddy.exemplo"], "SISTEMA_A_INSTALACAO_IPS"],
  ];
  for (const [parts, variable] of files) {
    const text = read(...parts);
    assert.match(text, /@instalacao \{\s*path \/installation \/installation\/\*\s*not remote_ip \{\$[A-Z_]+:127\.0\.0\.1\/32\}\s*\}/, parts.join("/"));
    assert.match(text, /handle @instalacao \{\s*respond 404\s*\}/);
    assert.ok(text.includes(`{$${variable}:`), `${parts.join("/")} lê ${variable}`);
  }
  assert.match(read("proxy.env.example"), /^INSTALACAO_IPS=/m);
  assert.match(read("borda", "borda.env.example"), /^SISTEMA_A_INSTALACAO_IPS=/m);
});
