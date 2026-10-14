# Arquitetura do produto

Escrito em 2026-10-06, a partir das decisões registradas na plataforma (`flyee-club/docs/PRODUCT.md`, "Decisões tomadas 2026-10-06", e `PLANO-IMPLEMENTACAO.md`, fases 9 e 10). Este documento diz como o produto é montado aqui e como ele chega à máquina do integrante. O que a plataforma faz está no contrato `flyee-club/docs/CLI-CONTRACT.md`, a única dependência deste repositório.

## 1. As três peças

| Peça | Onde vive | Como chega ao integrante |
|---|---|---|
| CLI `flyee` | `packages/cli` | pacote público no npm, versão 1.x; `npx flyee` baixa sempre a última |
| Core do harness | `packages/core/assets`, copiado para dentro da CLI no build | a CLI o escreve no projeto do integrante em `login`, `add` e `update` |
| Apps | `modules/<slug>/` | ZIP enviado ao servidor de pacotes da plataforma; a CLI baixa com o token, confere o checksum e extrai |

A plataforma nunca executa nada e nunca gasta a IA do integrante. Tudo roda na máquina dele, com o plano de IA dele.

## 2. Fronteira de distribuição

Só duas coisas saem deste repositório: o tarball do npm, restrito a `dist/`, `README.md` e `LICENSE` pelo `files` do `package.json` e conferido por `scripts/check-tarball.mjs`; e o ZIP de cada app, montado por `npm run pack` com todos os arquivos de `modules/<slug>/` menos `tests/`, `.dev/` e `*.dev.md`. Documentação, harness de desenvolvimento, avaliações e ferramentas ficam aqui. O texto que viaja (core e apps) é escrito para o integrante e para a IA dele.

## 3. O que a CLI escreve no projeto do integrante

```
<projeto>/
├── AGENTS.md                      canônico; o bloco entre <!-- flyee:begin --> e <!-- flyee:end --> é gerenciado
├── CLAUDE.md                      ponteiro de uma linha: @AGENTS.md (criado, ou bloco anexado se já existir)
├── GEMINI.md                      ponteiro: @./AGENTS.md
├── .agents/skills/<skill>/SKILL.md      ponte com o frontmatter original (Codex, Gemini CLI, Cursor, Copilot, OpenCode, Antigravity, Kimi)
├── .agents/skills/<skill>/agents/openai.yaml   metadados que o Codex mostra
├── .claude/skills/<skill>/SKILL.md      a mesma ponte para o Claude Code
├── .claude/skills/flyee/SKILL.md        a skill /flyee, menu do clube dentro da IA (e a ponte em .agents/skills/flyee)
└── .flyee/
    ├── lock.json                  core, tipo de projeto, apps instalados com versão, sha256, arquivos e pontes
    ├── modules/<slug>/            o pacote extraído, uma cópia só
    ├── recipes/<slug>/workflow.md o texto de uma receita, quando o plano inclui receitas
    └── licenses/<slug>.jwt        a licença da máquina para o app (quando a plataforma passar a emitir)
```

Ferramentas que só leem arquivo próprio recebem um bloco gerenciado quando são detectadas no projeto: `.windsurfrules` (Windsurf) e `CONVENTIONS.md` (Aider). Nunca sobrescrevemos um arquivo que o integrante escreveu: o bloco é anexado, ou a CLI registra que pulou.

Estado da máquina, fora do projeto:

```
~/.flyee/
├── config.json        device_id, nome da máquina, idioma, base_url
├── credentials.json   tokens (0600 onde o sistema respeita modo; no Windows, a ACL do perfil protege)
├── keys.json          chaves externas dos apps, salvas com `npx flyee key set` (mesma proteção; nunca saem da máquina)
├── refresh.lock       serializa a renovação do refresh token
├── events.jsonl       fila de eventos de telemetria, lotes de até 50
└── projects.json      projetos conhecidos nesta máquina, para montar installed_modules e para `npx flyee projects`; nunca sai da máquina
```

## 4. Fluxos

**`npx flyee login`.** Confere `min_cli_version` em `GET /api/cli/version`. Abre um servidor em `127.0.0.1` numa porta livre e o navegador em `/oauth/authorize` com PKCE; `--device` usa o código de dispositivo e `/ativar`. O endereço (e, com `--device`, o código) sai na hora, em linhas próprias e descarregado, antes da espera de até 5 ou 10 minutos; com `--json`, como uma primeira linha JSON (`event`, `verification_uri`, `verification_uri_complete`, `user_code`, `expires_in`) antes do resultado final, porque a IA lê a saída enquanto espera. Troca o código, guarda os tokens, registra a máquina em `POST /api/cli/installs` (o nome dado em `--name` cortado como a plataforma corta: espaços nas pontas fora, até 80 unidades UTF-16) e mostra o acesso pelo nome que o painel usa (`access.tier_name`) e os dias para revalidar.

**`npx flyee add <app>`.** Sem conexão, mostra que o app faz parte do acesso flyee.club e o link que o servidor devolver em `links.module_page` (ou `links.module_page_en` para quem lê em inglês), ou só o endereço base. Com conexão: `GET /api/cli/catalog`, mostra permissões, credenciais externas e checksum, pede confirmação (`--yes` confirma; `--dry-run` só mostra o plano; sem um terminal para perguntar, nada é instalado e o resultado é `confirmation_required`, com o comando do plano e o da confirmação, igual em `new`, `need` e `key remove`), `GET …/download`, baixa, confere tamanho e SHA-256, confere a lista de arquivos do ZIP contra `files` do manifesto e a segurança de cada caminho, extrai para uma pasta temporária e troca atomicamente, escreve as pontes e o bloco do `AGENTS.md`, atualiza o lock, reporta `installs` e o evento `module.installed`. `add receita:<slug>` usa `GET /api/cli/recipes/<slug>` e instala cada app liberado.

**`npx flyee update`.** Renova o refresh token primeiro, com lock local, porque duas renovações simultâneas revogam a família. Compara o lock com `latest` do catálogo, por app: baixa, confere e troca o que mudou, grava `module.updated` com `from_version` e `to_version`, atualiza o core quando a versão mudou, e chama `installs` com `updated: true`. Quando o catálogo devolver `newest` (planejado), mostra a distância da conta grátis.

**`npx flyee new <pasta>` e `npx flyee projects`.** O projeto é a pasta: os apps, a voz e a marca que eles aprendem e o que entregam ficam nela, então quem cria para várias marcas ou clientes usa uma pasta para cada um. `new` cria outra pasta (um nome sozinho vira pasta ao lado do projeto atual; nunca dentro dele, nem ele dentro dela) com os apps deste projeto, ou só os de `--apps`. Cada app passa de novo pelo catálogo e pelo download conferido, como no `add`; o que a conta não libera hoje fica de fora com aviso e continua funcionando onde já estava, e as permissões de um app que o projeto atual não tem aparecem antes de instalar. A máquina é registrada uma vez no fim. Cópias de desenvolvimento (`dev link`) só vão junto no modo do operador, sem falar com a plataforma. `projects` lê `~/.flyee/projects.json` e o lock de cada pasta e não chama a plataforma.

**`npx flyee status`.** Conexão, dias para revalidar, apps e versões, avisos (`deprecations`). `--quiet` imprime uma linha só quando há algo a fazer, para hooks de início de sessão.

**`npx flyee doctor`.** Node, ferramentas de IA detectadas, adaptadores presentes, integridade dos arquivos instalados pelo sha gravado no lock, chaves das credenciais externas (variável de ambiente ou `keys.json`), alcance da plataforma.

**`npx flyee key set|list|remove`.** As chaves externas que os apps declaram (`external_credentials`). `set <NOME> --browser`, a forma que a IA roda, abre uma página de uso único em `127.0.0.1`, que vale 15 minutos, e volta na hora; o integrante cola a chave ali. Sem `--browser`, numa pessoa diante de um terminal, pede o valor com o eco desligado, e sem terminal abre a mesma página. Nunca aceita a chave como argumento, porque ela ficaria no histórico e à vista da IA; `--stdin` serve para automação. `list` mostra nomes, onde cada chave está e quais apps a usam, nunca o valor. Os apps leem a variável de ambiente de mesmo nome primeiro e depois `~/.flyee/keys.json`. A chave fica fora de todo projeto, onde a IA não lê por acaso, o git não versiona e uma pasta sincronizada não copia.

**Erros.** A CLI imprime `message` e `action_url` como o servidor manda. Em 401 renova uma vez; em `device_unknown` registra a máquina e repete; em `device_revoked` ou `device_mismatch` pede login; em `denied_entitlement` mostra o cadeado com o link de upgrade.

## 5. Ferramentas de IA: registro declarativo

`packages/core/assets/tools.json` é a tabela que o core lê: por ferramenta, como detectar (pastas do projeto e binários), que arquivo de instruções ela lê e como (canônico, ponteiro ou bloco gerenciado), se lê skills no padrão e em que nível está. Dois níveis: `tested`, as IAs declaradas em `compatible_ais` dos apps e cobertas pelos testes (Claude Code, Codex, Gemini CLI, Cursor); `standard`, atendidas por `AGENTS.md` e `.agents/skills` sem promessa, reportadas à plataforma como `other` (GitHub Copilot, OpenCode, Antigravity, Kimi Code, Windsurf, Aider). Adicionar uma ferramenta é uma linha na tabela. A promoção de nível é decidida pela plataforma, por dado: 30 máquinas vivas por 4 semanas.

## 6. Apps

Um app é um diretório com `flyee.module.json` na raiz, `README.md` (o guia do integrante e o texto da página do app), `skills/<nome>/SKILL.md`, `scripts/`, `references/` e `tests/eval.json` (só do operador). A referência de autoria é `docs/COMO-CRIAR-UM-APP.md`.

Tipos e como o core instala: `skill` e `workflow` extraem o pacote e criam uma ponte por skill; `tool` idem, com os scripts rodando de dentro do pacote; `framework` cria uma pasta nova a partir do pacote, nunca dentro de um projeto existente (o `add` recusa quando a pasta atual já tem projeto).

Pipelines: um app `workflow` é uma pipeline empacotada. A metade automática, quando existir, roda sem aprovações pela CLI e por um agendador do sistema (`flyee run`, `flyee schedule`, fase P4); a metade sob demanda roda dentro da sessão da IA, com aprovações. O manifesto v2 trará `automation`, `requires` e `example_prompt` quando o primeiro app assim chegar.

## 7. Versões, canal grátis e proteção

Uma versão publicada é imutável; correção é versão nova com `changelog`. A primeira versão publicada de um app é a que o canal grátis recebe, marcada no console da plataforma; por isso, num app principal, a 1.0 nasce reduzida e a 1.1 sai no mesmo dia. Nada aqui mantém uma cópia "lite".

Proteção (fase 10.6 da plataforma, confirmada): a resposta de download passará a trazer uma licença assinada por conta, máquina, app e versão; a CLI a guarda em `.flyee/licenses/`, escreve uma marca opaca nos arquivos que gera, recusa pipelines, agendamentos e ações do painel para um app cuja licença seja de outra máquina, e nunca instala um pacote que não tenha vindo da plataforma na própria sessão, fora do modo de desenvolvimento do operador (`FLYEE_DEV=1`). Nenhuma skill é criptografada e nenhum app instalado para de funcionar quando o acesso termina.

## 8. O que ainda não existe

`docs/PLANO.md` tem o estado. Em resumo: pipelines e agendamento (P4), painel local `flyee ui` (P5), licença, marcas e servidor MCP local (P6, depende da plataforma), canário e runner de avaliações (P7), promoção de ferramentas por dado (P8).
