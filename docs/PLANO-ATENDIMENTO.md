# Atendimento no WhatsApp com IA e equipe: plano de implementação

**Objetivo:** existe no catálogo o app `whatsapp-support`, um kit que a IA do desenvolvedor usa dentro de um projeto de código para montar ali o atendimento pelo WhatsApp com robô de IA e equipe, com o Chatwoot como motor. O app não instala nada em servidor. Ele traz a base pronta, adaptável ao design system do projeto, as orientações e os pré-requisitos, e o caminho para atualizar cada projeto.

> Auditado contra o código em 2026-11-07: a primeira rodada sobre main em 848b820, com trabalho de outras sessões sem commit na árvore (`conversion-pages`, `video-render` 1.1.0, `user-apps.ts`); a segunda rodada (ÉPICO 9) sobre main em a702826; a conferência do número (ÉPICO 10) em 2026-11-08, sobre main em e859313. Fontes externas lidas no código, em clones rasos na pasta temporária da sessão: Chatwoot na tag `v4.19.1`, OpenWA em 79d7f86 (0.29.1, 2026-11-07) e OpenWA-plugins em 37a94c6 (`chatwoot-adapter` 0.9.15). Legenda: ✅ existe · 🟡 parcial · ⬜ não existe · ⚠️ correção.

As decisões de produto vieram do operador nesta conversa de 2026-11-07 e estão na memória do projeto (`support-app-decisions`). Este plano não as repete além do necessário para executar.

## Estado em 2026-11-08

O app `whatsapp-support` 1.0.0 foi construído em 2026-11-07 em duas rodadas e ganhou uma terceira em 2026-11-08, **sem tag**, e está instalado para o usuário do operador (`npm run apps -- link whatsapp-support --user`) para o teste dele num projeto próprio.

- ⚠️ A primeira rodada (até o ÉPICO 8) entrou no commit a702826 às 13:46, junto com `conversion-pages` e `video-render` 1.1.0, por um commit que esta sessão não fez. A versão antiga deste parágrafo dizia "sem commit".
- ⚠️ A segunda rodada (ÉPICO 9: contexto em camadas, cache, sugestões e lacunas, D19 e D20, e a equipe de cada cliente) entrou no commit 9b986bd, também feito fora desta sessão. Este parágrafo dizia que ela estava sem commit. Continua como 1.0.0, porque nenhuma 1.0.0 tem tag nem chegou à plataforma.
- A terceira rodada (ÉPICO 10: a conferência do número) entrou no commit 9ddcf2a, em 2026-11-08, ainda como 1.0.0.
- Um projeto que instalou o kit da primeira rodada vê a atualização: `kit.mjs status` compara a base gravada com a do kit (`base_changed`), além do número de versão.
- Na mesma tarde, a pedido do operador, a equipe de cada cliente: quem entra no painel (T4.4) e a saída de quem deixa a equipe (T4.5).
- ⚠️ O `README.md` dizia que os relatórios do Chatwoot vinham prontos para o cliente; só administrador os vê (`app/policies/report_policy.rb`), e no kit a equipe é sempre atendente. A frase saiu, e `references/enxugar.md` avisa para não prometer os relatórios.

| Prova | Resultado |
|---|---|
| `node --test "modules/whatsapp-support/tests/*.test.mjs"` | 87 de 87 passam, 19 deles da conferência do número em `tests/health.test.mjs` (robô, adaptadores de IA, provisionamento e conexão contra Chatwoot e OpenWA falsos, contrato, tema, instalar e atualizar, conferências; na segunda rodada, camadas e permissões, cache, lacunas, sugestões, limpeza de dado pessoal, base diferente com a mesma versão, quem entra no painel, a saída da equipe e a conferência da equipe) |
| `npm run validate whatsapp-support` | OK, 92 arquivos, uma skill |
| `npm run pack whatsapp-support` | primeira rodada: 81 arquivos, sha256 `dda03250…`; segunda rodada, com a equipe: 90 arquivos, sha256 `e8ec131e…`; terceira rodada: `dist/modules/whatsapp-support-1.0.0.zip`, 92 arquivos, 170.590 bytes, sha256 `63120edb81e79f9f04e42847d2e3b40d2feb80adc12d937c90c5016750e4bd15` |
| `tsc --strict` dos modelos (`modelos/next`, `modelos/react`) num projeto de rascunho com a mesma estrutura de um app Next.js, com tipos do Node e uma declaração mínima de React | sem erros |
| `look` no Edge contra uma imitação local do painel (variáveis e `n-brand` compiladas como no 4.19.1, tema do kit no fim do body) | passou nos modos claro e escuro: cor do projeto no botão com o azul fixo, seletor escondido invisível, link solto no canto |
| Ensaio da atualização numa cópia dos arquivos versionados de `atendimento/` do projeto Atrupe (`git archive` de `wt/back` em 227e7c65, sem tocar no projeto) | `status` acusa `base_changed`; `update` troca 7 arquivos da base sem conflito e lista 3 modelos em `models_changed` (`lib/atendimento.ts`, a rota `whatsapp`, `ConectarWhatsApp.tsx`); depois, `update_available` é falso |
| `npm run harness:check` | sincronizado; o catálogo gerado já lista o app |

Não rodou: nada contra Chatwoot, OpenWA ou Meta reais (ÉPICO 7 continua aberto, para o teste do operador na Atrupe).

## 0. Decisões

| # | Decisão | Valor | Onde mora |
|---|---|---|---|
| D1 | O app é um kit, nunca um instalador | decidido (operador, 2026-11-07): nada em servidor por SSH ou por outro meio; a IA do projeto copia a base, adapta e orienta o desenvolvedor | regra da `SKILL.md` e invariante 1 |
| D2 | Motor | decidido: Chatwoot, imagem `chatwoot/chatwoot:v4.19.1-ce` (sem a pasta `enterprise`, então sem o serviço que devolve a marca ao Chatwoot) | `kit/modelos/implantacao/compose.yml`, `references/chatwoot.md` |
| D3 | Lado do cliente | decidido: telas do projeto, no design system dele, para conectar o número e configurar o robô; painel do próprio Chatwoot para atender, com o login do projeto (SSO da API de plataforma) num subdomínio do projeto; nenhuma caixa de conversas própria | `references/arquitetura.md`, `kit/base/ui/`, `kit/modelos/react/` |
| D4 | Tema, enxugar e acrescentar | decidido: tema por `DASHBOARD_SCRIPTS`; enxugar por funções da conta (API de plataforma), papel de atendente, `DISABLE_USER_PROFILE_UPDATE`, `LOGOUT_REDIRECT_LINK`, nome da instalação e preferências do painel lateral, e CSS só para o resto; acrescentar por Dashboard Apps, atributos, macros, webhooks, elemento solto por script e moldura do projeto | `escolhas.json` do projeto, `scripts/kit.mjs theme`, `references/tema.md`, `references/enxugar.md` |
| D5 | Papéis | decidido: a equipe do cliente é atendente (`agent`); administrador é só a conta de serviço que o projeto cria | `kit/base/server/provision.mjs` |
| D6 | Instalação fora de um projeto flyee | decidido: o operador usa `npm run apps -- link whatsapp-support --user`; a CLI dos integrantes ganha instalação para o usuário antes de o app ser publicado para eles (ÉPICO 8) | `packages/module-tools/src/user-apps.ts` hoje; `packages/cli` depois |
| D7 | Regra do `validate` para kit de desenvolvedor | decidido: os textos falam com a IA do desenvolvedor, que roda tudo; ver "Onde é errado estar certo" | `packages/module-tools/src/validate.ts:37` |
| D8 | Tipo e trilha | decidido: `workflow`, trilha `construir` | manifesto |
| D9 | Nome | decidido (o operador concordou com a sugestão, 2026-11-07): slug `whatsapp-support`, título "Atendimento no WhatsApp com IA e equipe" | manifesto |
| D10 | Versão de entrada | decidido (o operador concordou com a sugestão, 2026-11-07): a 1.0.0 fica completa como foi construída; a divisão em 1.0 reduzida (sem o robô) e 1.1 completa no mesmo dia só entra se, antes de publicar, o app for tratado como principal | manifesto e marca no console da plataforma |
| D11 | Robô sem estado e agnóstico | decidido: configuração, ferramentas e histórico vêm do projeto por HTTP assinado; as chaves de IA ficam no ambiente do robô; o provedor é escolhido por conta (`openai`, compatível com OpenAI por `base_url`, `anthropic`, `gemini` ou `project`, em que o próprio projeto gera a resposta) | `kit/base/bot/`, `references/contratos.md` |
| D12 | Resposta imediata | decidido pelo código: o robô responde 200 antes de pensar e trabalha em segundo plano | invariante 5 |
| D13 | Rota não oficial | decidido: OpenWA `ghcr.io/rmyndharis/openwa:0.29.1` com o plugin `chatwoot-adapter` 0.9.15, motor `whatsapp-web.js` por padrão | `kit/modelos/implantacao/compose.yml`, `references/whatsapp.md` |
| D14 | Rota oficial | proposto: caixa WhatsApp Cloud nativa do Chatwoot com as credenciais do cliente; o cadastro incorporado da Meta fica fora da 1.0, porque exige que o projeto seja Tech Provider | `references/whatsapp.md` |
| D15 | Avisos do Chatwoot | proposto: robô e OpenWA recebem avisos por URL pública https com assinatura; `SAFE_FETCH_ALLOW_PRIVATE_NETWORK` fica desligado | `kit/modelos/implantacao/`, invariante 12 |
| D16 | Modo sugestão | decidido: o robô escreve nota privada e passa a conversa para a equipe; é o padrão em projeto com regra de aprovação humana (ONE) | `kit/base/bot/src/bot.mjs` |
| D17 | Onde o kit mora no projeto | proposto: `<destino>/base/` com os arquivos do kit, que o projeto nunca edita; `<destino>/escolhas.json` com as escolhas; `<destino>/kit.json` com a versão e o hash de cada arquivo da base. A IA escolhe o destino pela estrutura do projeto | `scripts/kit.mjs install` |
| D18 | Versões travadas na 1.0.0 | proposto: Chatwoot `v4.19.1-ce`, `pgvector/pgvector:pg16`, `redis:7-alpine`, OpenWA `0.29.1`, adaptador `0.9.15`, `caddy:2`, `node:22-alpine` para o robô | `kit/versoes.json`, `references/atualizar.md` |
| D19 | Contexto da empresa | decidido (o operador concordou com a proposta, 2026-11-07) e feito no ÉPICO 9, dentro da 1.0.0 sem tag. Nenhum treino de modelo: o robô lê, a cada mensagem, o conhecimento escrito, as consultas ao vivo e o histórico curto. Até 200.000 caracteres de conhecimento somados (`MAX_KNOWLEDGE_CHARS`), com a parte fixa separada para o cache do provedor; sugestões de pergunta e resposta tiradas das conversas que a equipe resolveu, só com aprovação de quem cuida do conhecimento; relatório das lacunas por assunto. A base de documentos com busca (trechos e pgvector no banco do projeto) fica para quando algum cliente precisar | `kit/base/shared/settings.mjs`, `kit/base/bot/src/prompt.mjs`, `kit/base/shared/report.mjs`, `references/contexto.md` |
| D20 | Quem controla o contexto | decidido (operador, 2026-11-07: "em outros projetos preciso que o contexto seja controlado via superadmin", com a Atrupe de exemplo, que vai usar o app no suporte aos clientes da própria plataforma). Dois modelos: `plataforma` (uma conta, só a camada do superadmin, os clientes não editam nada) e `por-cliente` (as regras da plataforma valem acima das de cada cliente, que edita só os grupos que o superadmin liberar; o servidor descarta o resto e só oferece as consultas que o superadmin liberou) | `escolhas.json` (`modelo`), `kit/base/shared/settings.mjs` (`botConfig`, `applyClientEdits`, `knowledgeOwner`), `kit/modelos/next/lib/atendimento.ts` |
| D21 | wacli (`openclaw/wacli`) | decidido (operador, 2026-11-08: "não vou usar o wacli agora"): não entra agora. Não substitui o OpenWA (D13). O papel que ele poderia ter, o de cliente de teste, está no backlog como opção | seção "Backlog: um cliente de teste com o wacli" |
| D22 | Conferência do número | decidido (operador, 2026-11-08: "faça a conferência"; os valores são propostos): rotina a cada 15 minutos, lembrete a cada 24 horas enquanto o número estiver fora, e aviso só na segunda conferência para o que costuma passar sozinho | `kit/modelos/next/lib/atendimento.ts` (`checkWhatsapp`), `kit/base/server/health.mjs` (`remindHours`, `PASSING`) |

## 0.5 Convenções do repositório que este trabalho toca

- **Fronteira.** Tudo em `modules/whatsapp-support/` sai no pacote, menos `tests/`, `.dev/` e `*.dev.md`. A pasta `kit/` é código que vai para o projeto do desenvolvedor. Nomes de pasta que nunca saem (`tests`, `dist`, `node_modules`, `.cache`, `packages/module-tools/src/files.ts:7`) não podem ser usados dentro do kit.
- **Regra de texto.** Todo `.md` do pacote, os textos do manifesto e toda string dos `.mjs` seguem a regra da plataforma: nenhum travessão, exclamação, emoji ou palavra proibida (`validate.ts`, `script-text.ts`). Arquivos `.ts`, `.tsx`, `.rb`, `.yml` não passam pela conferência, mas seguem a mesma regra quando têm texto para pessoas.
- **Comandos.** Comando do flyee num texto é `npx --yes flyee@latest <comando>`. Instalar programa na máquina do desenvolvedor passa por `need`; o `validate` recusa `winget install`, `brew install`, `apt install` e `pip install` em `.md` (`validate.ts:37`).
- **O projeto é a pasta.** Instalado para o usuário, o script grava no projeto aberto na sessão, nunca na pasta de apps (padrão de `modules/conversion-pages/scripts/lib/util.mjs:125`).
- **Segredos do projeto não são chaves do flyee.** Os tokens do Chatwoot, do OpenWA, da Meta e do provedor de IA são segredos do projeto: moram no cofre ou no `.env` do projeto, nunca em `~/.flyee/keys.json`, no chat, em `escolhas.json` ou em `kit.json`.
- **Windows primeiro.** Os scripts do app rodam no Windows do desenvolvedor; o que roda em contêiner usa caminhos POSIX.

## Invariantes

1. **O app nunca executa nada num servidor.** Nem SSH, nem Docker remoto, nem API de provedor de nuvem. Quem implanta é o caminho de implantação do projeto, que o desenvolvedor controla (D1).
2. **Nenhum segredo vai para arquivo versionado, log ou conversa.** Um token em `escolhas.json` ou num log do robô vaza para todo mundo que lê o repositório ou o servidor.
3. **`api_and_webhooks` nunca é desligado numa conta.** Toda chamada por token (robô, projeto, ponte do OpenWA) passa por `validate_token_api_access` (`app/controllers/api/v1/accounts/base_controller.rb`); desligar a função derruba o atendimento inteiro sem aviso na tela.
4. **O robô nunca envia mensagem pública no modo sugestão.** A regra de aprovação humana de projetos como o ONE depende disso; a ponte do OpenWA só repassa mensagem com `private === false` (`chatwoot-adapter/filters.ts:78`).
5. **O robô responde ao Chatwoot antes de pensar.** O Chatwoot espera 5 s (`WEBHOOK_TIMEOUT`, `lib/webhooks/trigger.rb`) e, quando o aviso falha numa conversa pendente, abre a conversa para a equipe (`update_conversation_status`).
6. **O robô nunca registra conteúdo, telefone ou nome em log.** Só identificadores, tipos de evento, tempos e códigos de erro.
7. **Atualizar nunca sobrescreve arquivo da base que o projeto editou.** O hash diferente do `kit.json` para a atualização e lista o arquivo.
8. **O CSS injetado esconde, nunca remove nó controlado pelo Vue.** Um nó removido por fora quebra a tela quando o Vue tenta atualizá-lo.
9. **A equipe do cliente nunca recebe papel de administrador.** Administrador vê e apaga caixas, robô e webhooks; a edição gratuita não tem papel sob medida (`enterprise/app/models/custom_role.rb`).
10. **A rota não oficial nunca é oferecida sem o aviso de risco.** O README do OpenWA a chama de não oficial e não aprovada para uso regulado; o número pode ser banido.
11. **O robô só consulta dados pelas ferramentas que o projeto declarou, e é o projeto que aplica a restrição.** O robô nunca recebe credencial do banco do projeto.
12. **Aviso sem assinatura válida é recusado.** O Chatwoot assina com `X-Chatwoot-Signature` e `X-Chatwoot-Timestamp` (`lib/webhooks/trigger.rb`); o projeto e o robô assinam entre si do mesmo jeito.

## ÉPICO 1: o pacote do app

**Bloqueia:** tudo; é onde os outros épicos moram.

### T1.1: criar o app pelo console
**Estado: ✅** criado pelo console em 2026-11-07 (`modules/whatsapp-support/flyee.module.json`, workflow, construir); `npm run validate whatsapp-support` OK.
- `npm run apps -- new whatsapp-support --type workflow --trail construir`, com título e resumo.
- **Aceite:** `npm run validate whatsapp-support` passa sem erro.

### T1.2: a skill
**Estado: ✅** `skills/whatsapp-support/SKILL.md`, seis passos e a regra que não quebra; seis casos em `tests/eval.json` (implantar, suporte da própria plataforma com o contexto do superadmin, SSH recusado, clínica na rota não oficial, atualizar com conflito, conferir). Os casos não rodaram num projeto real.
- `skills/whatsapp-support/SKILL.md`: ler o projeto, propor a integração, instalar a base, adaptar telas e rotas, preparar a implantação com o caminho do projeto, conferir e atualizar. A regra que não quebra: nada em servidor.
- **Aceite:** `validate` passa; o caso de `tests/eval.json` cobre "implantar o chatbot no projeto" e "atualizar o kit".

### T1.3: referências
**Estado: ✅** as dez referências (`contexto.md` veio com o ÉPICO 9), `escolhas.exemplo.json` e `n-brand.json` (44 classes extraídas do código do 4.19.1); o `validate` confere os caminhos citados.
- `references/`: `arquitetura.md`, `pre-requisitos.md`, `chatwoot.md`, `whatsapp.md`, `contratos.md`, `contexto.md`, `tema.md`, `enxugar.md`, `atualizar.md`, `seguranca.md`, `escolhas.exemplo.json`, `n-brand.json`.
- **Aceite:** `validate` confere que cada arquivo citado existe no pacote.

### T1.4: README, guias e vitrine
**Estado: ✅** `README.md` com "Peça assim", os quatro guias e `.dev/showcase.json` (pt-BR e en); o `validate` passa nas regras de guia e de loja.
- `README.md` com "Peça assim", os quatro guias e `.dev/showcase.json`.
- **Aceite:** `validate` passa nas regras de guia e de loja.

## ÉPICO 2: a implantação de referência (`kit/base/deploy`, `kit/modelos/implantacao`)

**Bloqueia:** ÉPICO 7.

### T2.1: compose e ambiente
**Estado: 🟡** `kit/modelos/implantacao/compose.yml` e os quatro `*.env.example` existem; `docker compose config` não rodou (Docker parado na máquina).
- `compose.yml`: Chatwoot (web e sidekiq), Postgres com pgvector, Redis, OpenWA (perfil `nao-oficial`), robô e Caddy (perfil `proxy`), com versões travadas; `env.example` com cada variável explicada.
- **Aceite:** `docker compose -f compose.yml --env-file env.example config` termina sem erro, onde houver Docker.

### T2.2: configuração do Chatwoot
**Estado: 🟡** `kit/base/deploy/apply-config.rb` existe, gravando valores booleanos de verdade (o layout testa `DISPLAY_MANIFEST` como booleano do Ruby); nunca rodou num Chatwoot.
- `kit/base/deploy/apply-config.rb`, rodado uma vez pelo caminho de implantação com `rails runner`: nome, logos, links da marca, `DASHBOARD_SCRIPTS`, `LOGOUT_REDIRECT_LINK`, `DISABLE_USER_PROFILE_UPDATE`, `DISPLAY_MANIFEST` e cadastro fechado.
- **Aceite:** no Chatwoot local do ÉPICO 7, `kit.mjs verify` encontra o nome no título e a marca do kit no HTML de `/app/login`.

### T2.3: proxy
**Estado: 🟡** `kit/modelos/implantacao/Caddyfile` com `/robo/*`, o host do OpenWA só com `/api/*` e o modo moldura comentado; Traefik e Nginx em `references/arquitetura.md`; nada rodou.
- `proxy/Caddyfile`: TLS, `atendimento.<domínio>` para o Chatwoot, `/robo/*` para o robô, `wa.<domínio>` para a API do OpenWA, e o modo moldura (`frame-ancestors` do projeto no lugar de `X-Frame-Options`). Traefik e Nginx descritos em `references/arquitetura.md`.
- **Aceite:** no ÉPICO 7, com o modo moldura ligado, a resposta de `/app/login` não traz `X-Frame-Options` e traz `frame-ancestors` com a origem do projeto.

## ÉPICO 3: o robô (`kit/base/bot`)

**Bloqueia:** ÉPICO 7.

### T3.1: receber, conferir e enfileirar
**Estado: ✅** `kit/base/bot/src/` (`bot.mjs`, `signature.mjs`, `queue.mjs`, `memory.mjs`); testes de assinatura válida, errada, vencida, sem cabeçalho e entrega repetida, e de duas mensagens viradas numa chamada (`tests/bot.test.mjs`).
- Servidor HTTP sem dependências: assinatura do Chatwoot, janela de 5 minutos, descarte de entregas repetidas, resposta 200 imediata, fila por conversa com espera curta para juntar mensagens seguidas.
- **Aceite:** `npm run test:apps` cobre assinatura válida, inválida, vencida e repetida, e duas mensagens seguidas viram uma só chamada à IA.

### T3.2: decidir e agir
**Estado: ✅** `agent.mjs`, `policy.mjs`, `prompt.mjs`; testes dos modos auto e sugestão, da consulta assinada, do pedido de atendente, do arquivo sem texto, da falha da IA e da conversa já assumida.
- Protocolo de ação em JSON (`reply`, `lookup`, `handoff`), até três consultas por vez, modos `auto`, `sugestao` e `desligado`, horário de atendimento, palavras que chamam a equipe, limite de turnos, e qualquer falha vira passagem para a equipe com mensagem educada.
- **Aceite:** testes com Chatwoot, projeto e IA falsos: resposta pública no modo `auto`; nota privada e conversa aberta no modo `sugestao`; consulta ao projeto assinada; falha da IA passa para a equipe.

### T3.3: provedores de IA
**Estado: ✅** `ai/anthropic.mjs` (`anthropic-version` 2026-10-21, `output_config.format` com o esquema, sem `temperature`, `fallbacks: "default"` só nos modelos que aceitam), `openai.mjs`, `gemini.mjs`, `project.mjs`; testes com servidores falsos. Nenhuma chamada a provedor real.
- `openai` (e compatíveis por `base_url`), `anthropic`, `gemini` e `project`.
- **Aceite:** testes com servidores falsos conferem o formato de cada pedido e a leitura de cada resposta.

## ÉPICO 4: integração com o projeto (`kit/base/server`, `kit/base/ui`, `kit/modelos`)

### T4.1: provisionamento e login único
**Estado: ✅** `kit/base/server/provision.mjs` e `chatwoot.mjs`; testes contra um Chatwoot falso: segunda execução sem nenhum POST, papel `agent`, preferências somadas às da pessoa, link de SSO.
- Conta, conta de serviço, robô da conta, funções, equipe como atendente e membro das caixas, preferências do painel lateral, link de SSO (`GET /platform/api/v1/users/:id/login`).
- **Aceite:** testes contra um Chatwoot falso: rodar duas vezes não duplica nada; nenhuma pessoa da equipe vira administrador; o link volta do SSO.

### T4.2: conectar o número
**Estado: ✅** `connectCloudApi` e `connectOpenWA`; teste confere webhook antes da instância, o mesmo segredo e o token da pessoa de repasse no adaptador.
- Oficial: caixa WhatsApp Cloud e a URL de retorno para o app da Meta. Não oficial: caixa API, webhook da conta, sessão do OpenWA, instância do adaptador com o segredo do webhook, QR e estado.
- **Aceite:** teste contra Chatwoot e OpenWA falsos confere a ordem (webhook antes da instância, segredo igual nos dois lados) e o QR devolvido.

### T4.3: telas e rotas de referência
**Estado: ✅** `kit/base/ui` (lógica testada), `kit/modelos/react` e `kit/modelos/next`; `tsc --strict` sem erros num projeto de rascunho com a estrutura de um app Next.js.
- `kit/base/ui` (estado das telas, sem framework, testado), `kit/modelos/react` (componentes que usam só `primitives.tsx`) e `kit/modelos/next` (rotas do App Router que chamam `kit/server`).
- **Aceite:** testes da lógica; os componentes compilam com `tsc` contra uma declaração mínima de React.

### T4.4: quem entra no painel em cada modelo
**Estado: ✅** antes, `enterPanel` conferia `isSupportStaff` só no modelo `plataforma`, e no `por-cliente` qualquer pessoa logada do cliente entrava (achado na conversa de 2026-11-07 sobre a equipe de cada cliente do ONE). Agora `canEnterPanel` (`kit/base/shared/settings.mjs`) decide: na plataforma, equipe de suporte e superadmin; em cada cliente, `isSupportStaff` ou `canConfigure`, e o superadmin não entra no painel dos clientes. A rota `entrar` recusa com 403 `not_support_staff`.
- **Aceite:** teste "quem entra no painel" em `tests/kit.test.mjs`; `tsc --strict` dos modelos.

### T4.5: tirar a pessoa do Chatwoot
**Estado: ✅** `removeStaffUser` e `syncStaff` (`kit/base/server/provision.mjs`) sobre `DELETE /platform/api/v1/accounts/:id/account_users` (`destroy` em `app/controllers/platform/api/v1/account_users_controller.rb` do 4.19.1; o `Agents::DestroyJob` tira a pessoa das caixas e equipes e devolve as conversas dela à fila). No modelo de ligação: `removeFromPanel`, para o projeto chamar onde tira a permissão; `syncPanelStaff`, para uma rotina diária com `listPanelPeople`; e `enterPanel`, que tira quem perdeu a permissão e tenta entrar. Motivo: a sessão do Chatwoot dura até 2 meses (`token_lifespan = 2.months` em `config/initializers/devise_token_auth.rb`).
- **Aceite:** testes "tirar da equipe" e "conferência da equipe" contra o Chatwoot falso: a pessoa sai da conta e do estado sem ser apagada; a conta de serviço e a de repasse nunca saem; a lista vazia não tira ninguém sem `allowEmpty`; quem o kit não pôs só aparece em `unknown`. Não rodou contra um Chatwoot real (ÉPICO 7).

## ÉPICO 5: tema, enxugar e acrescentar

### T5.1: tema gerado das escolhas
**Estado: ✅** `scripts/lib/theme.mjs` e `color.mjs`; testes do tom 9 nos dois modos, de cada classe de `n-brand.json` e das recusas; `look` no Edge confirmou a cor numa imitação do painel.
- `kit.mjs theme`: escala de 12 tons, clara e escura, a partir da cor principal, com o tom 9 igual à cor; regras para as classes `n-brand` da versão travada; fonte; esconder; links soltos. Grava o HTML que vai para `DASHBOARD_SCRIPTS`.
- **Aceite:** teste: para `#0B5FFF`, `--blue-9: 11 95 255` nos dois modos de cor; cada classe de `references/n-brand.json` tem regra; o HTML carrega a marca `data-kit`.

## ÉPICO 6: instalar, atualizar e conferir

### T6.1: instalar e atualizar
**Estado: ✅** `scripts/lib/files.mjs`; teste de instalar, editar `base/bot/src/policy.mjs`, `update` recusar e `--force` guardar `policy.mjs.projeto`.
- `kit.mjs install <destino>`, `status`, `update`, com `kit.json` e hashes.
- **Aceite:** teste: instalar num projeto temporário, editar um arquivo da base, `update` recusa e lista o arquivo; sem edição, atualiza e grava a versão nova.

### T6.2: conferir
**Estado: 🟡** `verify` testado contra servidores falsos; `look` rodou no Edge contra uma imitação local do painel; nenhum dos dois rodou contra um Chatwoot real.
- `kit.mjs verify`: versão do Chatwoot, nome e tema no HTML, cabeçalhos da moldura, funções da conta, robô e OpenWA de pé. `kit.mjs look`: entra por SSO num navegador sem janela, abre as telas, confirma o que foi escondido e a cor aplicada, e salva capturas no projeto.
- **Aceite:** `verify` contra servidores falsos aponta cada falha com a correção; `look` roda no ÉPICO 7.

## ÉPICO 7: prova contra serviços reais

**Estado: ⬜** nada rodou contra um Chatwoot, um OpenWA ou a Meta de verdade.
- Sem número de WhatsApp, num Chatwoot local: SSO, marca no `-ce`, tema por `DASHBOARD_SCRIPTS`, funções desligadas pela API, cabeçalhos da moldura, nota privada do robô numa caixa API, `look` acusando um seletor quebrado de propósito.
- Com número real, no teste do operador num projeto dele: QR do OpenWA, resposta do robô saindo pelo WhatsApp, passagem para a equipe. Depois, tirar o aparelho conectado no celular de propósito e ver o aviso, o "Ler o QR de novo" na mesma caixa e o aviso da volta (ÉPICO 10).
- **Aceite:** o relatório de `kit.mjs verify` e as capturas de `kit.mjs look`, guardados no projeto de teste.

## ÉPICO 9: contexto em camadas, cache, aprender com a equipe e lacunas (D19, D20)

### T9.1: camadas e permissões
**Estado: ✅** `kit/base/shared/settings.mjs`: `defaultPlatformSettings`, `clientPermissions`, `editableGroups`, `applyClientEdits`, `botConfig` com `model` e `knowledgeOwner`. Na ligação de modelo (`kit/modelos/next/lib/atendimento.ts`), a pessoa traz `isSuperadmin`, `canConfigure` e `isSupportStaff`, e no modelo `plataforma` só a equipe de suporte e o superadmin entram no painel. A tela `RoboAtendimento` recebe o escopo.
- **Aceite:** testes do modelo `plataforma` (a camada do cliente não entra) e do modelo `por-cliente` (regras da plataforma sempre, cliente só no liberado, consultas só entre as oferecidas); da plataforma desligada e do cliente que nunca salvou; do servidor que descarta grupo não liberado. `tsc --strict` dos modelos.

### T9.2: texto fixo grande com cache
**Estado: ✅** `buildSystemPrompt` devolve `{ stable, volatile }`: a data, o horário e o nome do contato ficam fora da parte fixa. Até 200.000 caracteres de conhecimento somados. Na Anthropic, a parte fixa vai com `cache_control` (`ai.cache_ttl`, 5 minutos ou 1 hora); na OpenAI e no Gemini, a parte fixa vai no começo do texto.
- **Aceite:** testes de que a parte fixa é igual entre mensagens e do bloco com `cache_control`. Não houve medição de acerto de cache contra um provedor real.

### T9.3: aprender com a equipe, com aprovação
**Estado: ✅** ao receber `conversation_resolved` de uma conversa com `robo-passou`, o robô pede o histórico, limpa dado pessoal (`kit/base/bot/src/privacy.mjs`) e manda até 3 sugestões à rota `suggestions`. A tela `SugestoesConhecimento` e as rotas `sugestoes` aprovam, editam ou descartam; aprovar acrescenta a pergunta e a resposta à camada de quem cuida do conhecimento.
- **Aceite:** testes do fluxo completo com IA falsa, e dos casos sem a etiqueta, sem resposta da equipe e com o aprendizado desligado. A qualidade das sugestões de uma IA real não foi medida.

### T9.4: relatório das lacunas
**Estado: ✅** a ação de passar para a equipe ganhou `category` e `topic`; cada passagem vai à rota `events` com o trecho limpo. `summarizeGaps` (`kit/base/shared/report.mjs`) agrupa por assunto; a tela é `LacunasRobo` e a rota é `lacunas`.
- **Aceite:** testes do evento com trecho limpo, do relatório desligado que não envia nada e do agrupamento por assunto, por janela de dias e só do que o robô não sabia.

## ÉPICO 10: conferência do número (D22)

**Origem:** a avaliação do wacli (D21) mostrou que nada avisava quando o número caía. `verify` via só se o OpenWA respondia e se o adaptador estava ligado, e o estado da sessão (`whatsappStatus`) só a tela lia.

### T10.1: a conferência
**Estado: ✅** `kit/base/server/health.mjs`: `classifySession` (os estados do OpenWA 0.29.1, `engineLoaded` e `restriction`, em `docs/06-api-specification.md` do OpenWA), `classifyCloudHealth` (`GET inboxes/:id/health` do Chatwoot 4.19.1, `app/services/whatsapp/health_service.rb`) e `checkWhatsappHealth`, que olha a última caixa e não lança.
- **Aceite:** testes "sessão do OpenWA", "restrições do WhatsApp", "saúde da Meta" e "conferência, rota oficial/não oficial" em `tests/health.test.mjs`. Serviço fora do ar vira achado, com `fixBy: "tecnico"`. Não rodou contra serviço real (ÉPICO 7).

### T10.2: os avisos
**Estado: ✅** `healthAlerts` guarda a memória em `state.health` e devolve `title` e `text` prontos, sem segredo. O modelo `checkWhatsapp` avisa antes de gravar a memória, e `store.alertWhatsapp` é o canal do projeto.
- **Aceite:** testes "avisos": número bom não avisa nem muda a memória; parou avisa uma vez, lembra depois de 24 horas e avisa a volta; o que passa sozinho só avisa se continuar; quem foi avisado da queda fica sabendo da volta; o texto não leva token nem chave.

### T10.3: os caminhos de volta na mesma caixa
**Estado: ✅** `reconnectOpenWA` (o modelo `reconnectWhatsapp`, a rota com `acao: "reconectar"`, `api.reconnect`) e `updateCloudApi` (o modelo `connectWhatsapp` escolhe pelo telefone). A tela `ConectarWhatsApp` mostra o que a conferência viu e oferece o caminho.
- ⚠️ Antes, conectar de novo criava outra caixa e outra sessão na rota não oficial, e na oficial falhava, porque o Chatwoot aceita cada número uma vez só (`validates :phone_number, uniqueness`, `app/models/channel/whatsapp.rb`). `references/contratos.md` já avisava que conectar criava caixa nova, sem dizer como voltar.
- **Aceite:** testes "ler o QR de novo" (sessão parada recebe o início; motor carregado não; não cria sessão) e "trocar o token da Meta" (mesma caixa, `webhook_verify_token` mantido, recusa com `meta_rejected`). `tsc --strict` dos modelos sem erros.

### T10.4: `verify`
**Estado: ✅** uma linha `numero_conectado_<sessão>` por sessão do OpenWA, e `numero_conectado` quando não há sessão ou a lista falha. O número da rota oficial fica de fora, porque a saúde dele pede o token da conta de serviço, que mora no estado do projeto.
- **Aceite:** testes "verify: cada sessão do OpenWA aparece" e "verify: sem sessão ainda não reprova".

## ÉPICO 8: instalação para o usuário na CLI dos integrantes

**Estado: ⬜** `packages/cli` só instala dentro da pasta de um projeto flyee e grava o `AGENTS.md` dele; a instalação para o usuário existe só no console do operador (`packages/module-tools/src/user-apps.ts`).
**Bloqueia:** publicar o app para integrantes.
- Fora desta entrega; precisa de decisão de contrato antes (o que a CLI grava em `~/.claude/skills` e como `update` encontra o app).

## Backlog: o JuriChat como referência de mercado (2026-11-07)

A sessão das páginas analisou o jurichat.com, atendimento por WhatsApp com IA e equipe para escritórios de advocacia (`modules/conversion-pages/references/modelos/jurichat-pagina-de-vendas.md`, item do `docs/PLANO-PAGINAS.md`, seção 6). Abaixo, cada recurso que a página mostra contra o código do Chatwoot 4.19.1 `-ce`. **Decisão do operador:** quais entram, e em que versão.

| Recurso do JuriChat | Chatwoot `-ce` hoje | O que o kit acrescentaria |
|---|---|---|
| Consulta do processo pelo WhatsApp | não é do Chatwoot | ✅ já é o desenho do kit: uma consulta do projeto, como `consultar_pedido` no modelo, restrita à pessoa da conversa |
| Fila do atendente pelo tempo de espera | ✅ ordem por `waiting_since` (`app/models/concerns/sort_handler.rb:22`) e filtro de não atendidas (`app/models/conversation.rb:95`) | nada, ou essa ordem como padrão de cada atendente |
| Metas de primeira resposta e de atendimento, com "dentro da meta" | ⬜ as metas (SLA) moram só em `enterprise/` (`enterprise/app/models/sla_policy.rb`), que a imagem `-ce` não traz | metas na camada da plataforma (e na do cliente, se liberado) e a conta "dentro da meta" feita pelo projeto com os tempos dos relatórios |
| Alerta de cliente sem resposta há mais de 1 hora | 🟡 o dado existe (`waiting_since`, não atendidas, contagem ao vivo em `app/controllers/api/v2/accounts/live_reports_controller.rb`), o alerta não. Automação com atraso aceita só condição de estado e de caixa (`app/models/automation_rule.rb:168`): não sabe se a pessoa já recebeu resposta | rotina periódica no projeto, porque o robô não tem estado nem agenda: conversa aberta com espera acima da meta ganha prioridade urgente, etiqueta e nota no Chatwoot, e o aviso vai pelo canal de avisos do projeto |
| Visão do gestor (conversão, clientes por área, mensagens por dia, tempos contra a meta) | 🟡 os relatórios existem (por dia, atendente, caixa, etiqueta e equipe; primeira resposta, resolução, satisfação), mas só administrador vê (`app/policies/report_policy.rb`), e no kit nenhuma pessoa é administradora (D5, invariante 9) | tela do gestor no design system do projeto, lida pela conta de serviço na API de relatórios, para quem o projeto marcar como gestor; área do direito e conversão vêm de etiquetas que o robô põe na passagem para a equipe |
| Integrações dentro da conversa (agenda com videochamada, contrato assinado pelo celular, lembrete de audiência) | 🟡 Dashboard Apps (`app/models/dashboard_app.rb`); o kit já cria o seu (`ensureDashboardApp`) | ações do projeto no painel lateral (agendar, enviar contrato); o lembrete semanas depois é mensagem ativa, que na API oficial exige modelo aprovado pela Meta e é cobrada |
| Eventos para outros sistemas (`message.received`, `conversation.resolved`) | ✅ webhooks da conta (`message_created`, `conversation_status_changed` e outros) | nada novo; o projeto assina o próprio webhook pela conta de serviço |

## Backlog: um cliente de teste com o wacli (D21)

O wacli (`github.com/openclaw/wacli`, MIT, Go sobre whatsmeow, 0.26.0 de 2026-11-05) entra num número como aparelho conectado, envia pela linha de comando e lê o que chega. Avaliado em 2026-11-08 pela documentação do repositório, sem rodar.

- **Não substitui o OpenWA:** não tem API HTTP para enviar (o envio passa pelo processo local de `sync --follow`), o aviso por `sync --webhook` não tem novas tentativas (`docs/sync.md`) e conectar é um comando interativo.
- **O papel possível é o de cliente de teste,** num chip só para isso, nunca no número do atendimento: um roteiro de mensagens depois de implantar e de cada atualização, ou um vigia de algumas rodadas por dia em produção. É o que cobre o que o ÉPICO 10 não vê, a mensagem que se perde com tudo dizendo que está bem.
- **Custos:** o chip e o celular usado a cada 14 dias; o wacli não está no winget, e a CLI só instala por gerenciador de pacotes (`packages/cli/src/programs.ts:23`), então a máquina do desenvolvedor pediria baixar o binário da versão publicada com conferência do SHA-256; em produção, um contêiner montado pelo projeto, porque o repositório não publica imagem; cada rodada abre uma conversa, que teria de se resolver sozinha e ficar fora das sugestões e das lacunas; na API oficial, cada resposta sai da mesma cota de 1.000 mensagens de serviço por mês.
- **Decisão do operador:** entra quando um projeto em que o atendimento não pode parar pedir. Antes disso, a prova é uma mensagem mandada de outro celular.

## Onde é errado estar certo

- **D7, regra do `validate`.** O operador aceitou criar uma regra própria para kit de desenvolvedor. A leitura do código mostrou que a 1.0 não precisa dela: o `validate` só recusa comandos de instalação de programa e frases que mandam a pessoa ao terminal (`validate.ts:37` e `:39`), e os textos do kit falam com a IA, que roda `docker compose`, `npm` e o próprio `kit.mjs`. A regra entra quando um texto do kit precisar de algo que o `validate` recusa.
- **D19, versão.** A proposta era levar o contexto maior, as sugestões e as lacunas para uma 1.1. Eles entraram na própria 1.0.0, porque nenhuma 1.0.0 tem tag nem chegou à plataforma; a regra de versão imutável vale a partir da tag. Se o operador quiser a 1.0.0 como estava em a702826 e a 1.1.0 com o ÉPICO 9, o caminho é marcar a702826 com a tag da 1.0.0 e rodar `npm run apps -- bump whatsapp-support minor` sobre a árvore atual.
- **D8, tipo.** A proposta anterior era `framework`. O `app-author` define `framework` como um modelo que cria uma pasta nova e nunca instala em projeto existente (`.claude/skills/app-author/SKILL.md`, seção 1); o kit entra num projeto que já existe e guarda estado (`kit.json`), por isso `workflow`.

## Riscos

| Risco | Primeiro sinal |
|---|---|
| Uma versão nova do Chatwoot renomeia classes ou variáveis e o tema ou o esconder param de valer | `kit.mjs look` acusa seletor sem efeito ou cor errada na troca de versão |
| A marca gravada no banco não vale na imagem `-ce` | ÉPICO 7: título de `/app/login` sem o nome do projeto |
| O servidor não deixa o Chatwoot chamar o próprio domínio público (sem retorno de NAT) | o robô nunca recebe aviso; o Chatwoot registra falha no aviso e abre a conversa |
| O OpenWA, ainda 0.x e com versão a cada duas semanas, muda a API de sessão ou do adaptador | `kit.mjs verify` falha na conferência do OpenWA depois de trocar a versão |
| A Meta muda a regra para IA no WhatsApp | a referência traz a data da leitura; revisar a cada versão do kit |
| O robô reinicia e perde o histórico curto | a conversa segue com o histórico que o projeto devolve em `history` |
| O estado que o OpenWA mostra depois que o celular tira o aparelho conectado não é o que a conferência espera | ÉPICO 7: `checkWhatsapp` não avisa depois de tirar o aparelho de propósito |
| Uma URL de retorno válida fica em outro servidor que repassa ao painel | `meta_aviso_em_outro_endereco` aparece com o atendimento funcionando; por isso esse achado é `atencao`, e não `fora` |

## Cobertura declarada

- Nada rodou contra Chatwoot, OpenWA ou Meta reais; o ÉPICO 7 existe para isso.
- Do Chatwoot foram lidos só os arquivos citados; a pasta `enterprise`, os modelos de e-mail e o app de celular não foram examinados. O app de celular do Chatwoot pede e-mail e senha, e as pessoas criadas pelo projeto não têm senha conhecida: na 1.0 o atendimento é pelo navegador.
- O cadastro incorporado da Meta (Embedded Signup) não foi examinado.
- O ÉPICO 9 rodou só contra provedores e projeto falsos: o acerto do cache, a qualidade das sugestões e a escolha de `category` e `topic` por uma IA real não foram medidos. A limpeza de dado pessoal cobre e-mail, CPF, CNPJ, número de processo, cartão e telefone por padrão de texto; um nome ou endereço escrito por extenso passa, e por isso nada entra no conhecimento sem aprovação.
- O ÉPICO 10 rodou só contra serviços falsos. `checkWhatsapp`, `reconnectWhatsapp`, a rota e a tela passaram no `tsc --strict`, mas não foram executados. O formato de `webhook_configuration` veio do código do Chatwoot (`AccountHealth.vue`), não de uma resposta real da Meta. A regra dos 14 dias dos aparelhos conectados vem de fontes de terceiros.
- O porte do ÉPICO 10 na Atrupe (`wt/back` em NestJS, `wt/web` em Next.js) é da sessão daquele projeto; desta sessão, a Atrupe só foi lida.
- As regras da Meta sobre IA vêm de fontes de imprensa e de fornecedores (memória `whatsapp-business-facts`), não da página da Meta.
