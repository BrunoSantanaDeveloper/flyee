# Pedido do produto à plataforma: instalar sem burocracia, também na nuvem

**Objetivo:** quem instala o flyee pela IA, no computador ou numa sessão do Claude Code na nuvem, faz no máximo um ajuste, uma vez, e segue na mesma conversa até usar o primeiro app.

> Auditado em 2026-10-17 contra o produto (`7450407`, CLI 1.0.1 no npm, e a 1.0.2 na árvore) e a plataforma (`f2cce77`, só leitura). Decisões do operador em 2026-10-20, com a CLI 1.0.2 no npm (`b6dbc94`) e a plataforma em `e09cf08`, sem mudança nos itens deste pedido desde a auditoria. Legenda: ✅ existe · 🟡 parcial · ⬜ não existe · ⚠️ correção. A pesquisa que embasa este pedido ficou no journal do workflow `wf_043b9490-29f` da sessão do produto (cinco frentes: downloads, computadores, página de instalação, erros do Node, contrato).

## De onde vem

Os dois primeiros testes reais do operador, em 2026-10-17:

- **Claude Code na nuvem (claude.ai/code).** A IA não conseguiu ler `https://flyee.club/instalar.md`. O ambiente padrão da sessão (Trusted) só libera registros de pacotes e o GitHub, e o proxy da sessão recusou o `flyee.club`. A IA concluiu que o site não existia, e a busca na web não ajudou: a página tem `X-Robots-Tag: noindex`.
- **Claude Code no desktop.** O login funcionou, mas a conta sem compra leu "Esta conta ainda não tem acesso aos apps". Isso vem da CLI e foi corrigido na 1.0.2. No fim, o guia mandou abrir uma conversa nova, um passo que o operador considera burocracia desnecessária.

O que o produto resolve sozinho já está na CLI 1.0.2 (o item 3 da conversa com o operador): a conta sem compra lê que instala a versão de entrada de cada app, e a recusa da rede vira `host_not_allowed` com o endereço e o ajuste do ambiente. O resto depende da plataforma, e é este pedido: os itens 1, 2 e 4 que o operador aprovou e o 5, que veio do teste no desktop.

## 0. Decisões do operador antes do código

Todas decididas pelo operador em 2026-10-20.

| # | Decisão | Valor decidido | Onde mora |
|---|---|---|---|
| D1 | Uma sessão do Claude Code na nuvem conta no teto de computadores do plano? | Não. Cada conta tem 1 vaga de nuvem, fora do teto, e a sessão mais nova toma o lugar da anterior. É o último item a fazer. Risco aceito: a marca de nuvem é declarada pela CLI, e quem a simular num segundo PC ganha no máximo uma máquina, trocada a cada sessão real na nuvem e sempre com a aprovação da dona no navegador (veja Riscos) | `PRODUCT.md` (a regra "1 acesso") e `plans.limits.cloud_sessions` |
| D2 | Os pacotes passam a sair do próprio `flyee.club`? | Sim, por uma rota própria que repassa os bytes do Storage, com uma chave para voltar atrás sem deploy. A chave só passa para `platform` depois do aceite do item 2 num preview | `platform_settings.cli` (por exemplo `package_host`: `platform` ou `storage`) |
| D3 | O ambiente que o botão da nuvem pré-seleciona | Nenhum. ⚠️ Mudou em relação à proposta de 2026-10-17 (`flyee`): o integrante não tem um ambiente com esse nome, a documentação não diz o que o botão faz com um nome que não existe, e criar um seria um passo a mais. O botão leva só o `prompt`, e a sessão abre no ambiente que a pessoa já usa, que é onde ela faz o ajuste | nada a guardar: `apps/web/src/lib/install-links.ts` monta a URL sem `environment` |
| D4 | O piso da CLI | ✅ Feito: `GET /api/cli/version` responde `"min_cli_version": "1.0.2"` (conferido em 2026-10-20) | `platform_settings.cli.min_cli_version`, aba Entrega do console |
| D5 | O guia deixa de pedir conversa nova | Sim, e é o primeiro item: a IA lê o bloco novo do `AGENTS.md` e a skill do app e segue na mesma conversa | `apps/web/src/lib/install-guide.ts` |

**Ordem de entrega**, cada etapa útil sozinha:

1. Item 5 e item 1: só texto do guia e o bloco do painel. Valem para todo integrante, no computador e na nuvem. Junto, o item 6, que é pequeno: o exemplo em inglês do `video-studio` sai da loja.
2. Item 2: a rota dos pacotes, atrás da chave da D2. Depois dela, a nuvem pede um endereço só.
3. Item 4: a vaga de nuvem, com migração, campo novo no contrato e a CLI 1.0.3. Até lá, a CLI 1.0.2 explica o limite quando ele aparece.

## 0.5 Regras que este pedido não pode quebrar

- O contrato é a única dependência entre os repositórios (`CLI-CONTRACT.md`). Um campo novo entra na seção 9 (planejado), é servido, passa para o corpo, e só então a CLI o envia. `POST /api/cli/installs` recusa campos desconhecidos.
- A CLI nunca monta um endereço da plataforma: usa a URL que o servidor devolve (contrato 4.5). Por isso o item 2 não pede nada à CLI.
- Todo texto da loja e do guia passa pela regra de texto da plataforma: sem travessão, sem ponto de exclamação, sem emoji, sem as palavras proibidas, sem "grátis" ou "free".
- O integrante nunca abre um terminal. O ajuste da rede é a única coisa que a IA não consegue fazer: pela documentação do Claude Code, só a pessoa muda a rede do ambiente, no próprio ambiente. Nada no pedido, no repositório, num hook, no script de configuração ou num comando muda essa lista (code.claude.com/docs/en/cloud-environments, "Network access").

## Invariantes

1. **Um pacote nunca sai da rota nova com cache.** `Cache-Control: no-store` na rota, nunca o `max-age=3600` que o Storage manda. Um pacote em cache entregaria a outra conta um arquivo que o gate dela recusaria.
2. **A rota nova só serve o que a rota de download assinou.** O token do Storage segue junto e expira em 300 s, como hoje, e caminhos fora de `modules/<slug>/<versão>/<slug>-<versão>.zip` são recusados.
3. **Uma vaga de nuvem nunca derruba um computador.** A substituição só alcança registros de nuvem, e um registro nunca muda de tipo depois de criado.
4. **Nenhum texto manda a pessoa a um terminal**, nem no bloco da nuvem.

## Item 1: o caminho da nuvem no painel e no guia

**Estado: ⬜** No guia (`install-guide.ts`), o login sem navegador aparece para SSH, servidor e contêiner (linhas 73 e 134), mas nada fala da rede de uma sessão na nuvem. `platform.reachable` falso vira só "a plataforma não respondeu" (linhas 103 e 164). No painel, o pedido de instalação existe (`AskAiBlock`), sem um caminho para a nuvem.

- **No guia**, uma seção "Claude Code na nuvem" entre "Antes de começar" e "Passos", em pt-BR e em inglês. Ela diz que a rede da sessão só chega aos endereços liberados no ambiente e que a CLI 1.0.2 responde `host_not_allowed` com o endereço e o ajuste. Também diz que, pedido o ajuste, a IA espera a pessoa confirmar e repete o comando, porque a sessão aberta segue a regra nova em cerca de um minuto, sem conversa nova. O login ali é por código. A chave de um app vai em Environment variables do ambiente, nunca na conversa. A redação proposta está no apêndice A.
- **No guia, linhas 103 e 164:** com `platform.reachable` falso, mostrar `platform.message` como veio. Com `platform.error` igual a `host_not_allowed`, pedir à pessoa o ajuste que a mensagem descreve, esperar e repetir. Desde a CLI 1.0.2, `platform.error` traz o código e `platform.message` o texto.
- **No painel**, um bloco recolhido "Claude Code na nuvem" abaixo do `AskAiBlock` da página inicial e do passo de instalação do onboarding. Ele tem o ajuste único do ambiente, com os endereços para copiar, e um botão que abre `https://claude.ai/code` com o pedido escrito, sem escolher ambiente (D3): a sessão abre no ambiente que a pessoa já usa, e é nele que ela faz o ajuste. A documentação do Claude Code aceita `?prompt=…` e só preenche, sem enviar. O pedido pré-preenchido funciona mesmo antes do ajuste: "Instale o flyee seguindo {url}. Se a página não abrir nesta sessão, rode `npx --yes flyee@latest doctor --json`, que vem pelo npm, e me peça o ajuste que ele descrever." O npm é liberado no ambiente padrão.
- **Os rótulos da tela do Claude.** A documentação só traz os rótulos em inglês (Edit cloud environment, Network access, Custom, Allowed domains, Also include default list of common package managers, Save changes). Confira numa sessão real com o claude.ai em português antes de escrever o bloco. ⚠️ Conferido em 2026-10-20 pelas capturas do operador (plataforma `f2324fc`): a tela em português diz Editar ambiente de nuvem, Acesso à rede, Limitado (e não um equivalente de Custom), Domínios permitidos, Permitir gerenciadores de pacotes e Salvar alterações, e o ambiente (em geral Default) fica no alto da sessão ou ao lado da caixa de mensagem. Os rótulos em inglês do apêndice A vêm da documentação e ninguém os viu na tela; a mensagem da CLI em inglês diz "Custom or Limited".
- **Aceite:** o teste do guia passa a contar seis seções. A seção nomeia `flyee.club` em código e, enquanto o item 2 não sair, o host do Storage. `new URL(href).searchParams.get("prompt")` é o pedido do idioma de quem lê, e `searchParams.has("environment")` é `false`. Numa sessão real com o ambiente padrão, o botão abre o pedido, a IA roda o `doctor`, pede o ajuste e, depois dele, instala sem outra conversa.

## Item 2: os pacotes saem do flyee.club

**Estado: ⬜** A rota de download (`apps/web/src/app/api/cli/modules/[slug]/versions/[version]/download/route.ts:91-116`) devolve uma URL assinada do Supabase Storage (`<NEXT_PUBLIC_SUPABASE_URL>/storage/v1/object/sign/modules/…`, 300 s). Numa sessão na nuvem, isso obriga a liberar um segundo domínio, `<projeto>.supabase.co`. Um redirecionamento não resolve, porque o `fetch` segue o redirecionamento até o host bloqueado.

- Uma rota pública, por exemplo `GET /api/public/packages/<slug>/<versão>/<slug>-<versão>.zip?token=<token>`, que valida slug, versão e nome do arquivo e busca no Storage com `cache: "no-store"`. Ela devolve o corpo em fluxo, com `Content-Type: application/zip`, o `Content-Length` de origem, `Cache-Control: no-store` e `X-Robots-Tag: noindex`, e responde com um código de erro quando o Storage recusa o token.
- A rota de download troca o prefixo do Storage pelo do site e mantém o `?token=`, o `expires_in` de 300, o registro em `module_downloads` e todos os gates, atrás da chave da decisão D2.
- No contrato 4.5, o exemplo da `url` passa a ser `https://flyee.club/api/public/packages/…?token=…`, com uma frase dizendo que o download sai sempre do host da plataforma.
- **A CLI não muda.** Ela baixa a `url` que recebe (`packages/cli/src/install/download.ts`) e confere tamanho e SHA-256 antes de extrair, e a plataforma falsa dos testes já serve pacotes na mesma origem. A 1.0.2 nomeia, numa recusa, o host da URL que pediu: hoje o do Storage, depois o `flyee.club`.
- **Custo medido:** o maior pacote tem 263.132 bytes, e as versões mais novas do catálogo somam 1.086.554 bytes. Em 10.000 downloads por mês, isso dá cerca de 2,6 GB de tráfego.
- **Aceite:** um vitest cobre a troca de URL (token mantido, só caminhos de `modules`), recusa `..` e `%2e%2e` e confere o `no-store`. Num preview, o `curl` da `url` responde 200, `application/zip`, `no-store`, nunca `X-Vercel-Cache: HIT` na segunda vez, com o SHA-256 igual ao do JSON, e falha depois de 300 s. Numa sessão na nuvem com só `flyee.club` liberado (mais a lista padrão), `npx --yes flyee@latest add <app> --yes --json` volta com `ok: true`.

## Item 4: uma vaga de nuvem por conta

**Estado: ⬜** Cada sessão na nuvem começa numa VM nova, sem `~/.flyee`, e registra um `device_id` novo. O registro (`register_member_device`, migração `0036`) conta toda linha não revogada, e o teto é 1 no Gratuito e no FlyeeClub. Na prática, quem tem o PC conectado não consegue usar a nuvem, e a segunda sessão na nuvem já trava. A CLI 1.0.2 explica isso na hora do `device_limit_reached`, mas não pode resolver.

- **Proposta (a opção A da pesquisa):** a coluna `member_devices.cloud` (nula para máquinas, `claude_code` para a nuvem), fixa na criação, e `plans.limits.cloud_sessions = 1` em todo plano. Computadores são contados só onde `cloud` é nulo. Um registro de nuvem além do limite revoga a linha de nuvem mais antiga e a família de tokens dela, com o motivo `replaced`, um evento `device.revoked` e auditoria.
- **Quem é nuvem.** O campo `cloud: "claude_code"` em `POST /api/cli/installs`, primeiro na seção 9 e depois no 4.2. Opcionalmente, o endereço de origem dentro de uma faixa de egresso configurada em `platform_settings.cli`, depois de o operador confirmar a faixa das sessões na nuvem: a documentação a cita para MCP e Claude Tag, não para sessões.
- **Painel:** `/settings/devices` conta os computadores sem as linhas de nuvem e mostra a sessão na nuvem à parte, com o texto "Uma sessão nova do Claude Code na nuvem toma o lugar desta. Os apps instalados nela continuam funcionando."
- **A CLI 1.0.3** envia `cloud: "claude_code"` com `CLAUDE_CODE_REMOTE=true`, só depois que o campo estiver no corpo do contrato.
- **Risco:** duas sessões na nuvem em paralelo se derrubam ao conectar, e cada conexão nova pede a aprovação no navegador. O compartilhamento da conta continua preso à aprovação da dona em `/ativar`.
- **Aceite (pgTAP e vitest):** num FlyeeClub com teto 1 e um PC conectado, um registro de nuvem é criado. Um segundo registro de nuvem revoga o primeiro e os tokens dele. O PC continua conectado, e `live_devices` continua 1. Com `cloud_sessions` em 0, a resposta é o 409 de hoje. O parser aceita `cloud: "claude_code"` e recusa outro valor.

## Item 5: sem conversa nova depois de instalar

**Estado: 🟡** O guia pede conversa nova em três lugares, com o argumento de que "as instruções e as skills novas só valem numa conversa nova": depois de instalar (linha 76, em inglês 137), depois de instalar um app (89, 150) e depois de atualizar (92, 153). Na mesma conversa, a IA pode ler o bloco que a CLI acabou de escrever no `AGENTS.md` e o `SKILL.md` do app em `.flyee/modules/<app>/skills/<skill>/SKILL.md`, e seguir.

- O que a documentação do Claude Code diz (verificado em 2026-10-17):
  - Skills novas numa pasta `.claude/skills/` que já existia valem na hora, sem reiniciar, desde a 2.1.0 (code.claude.com/docs/en/skills, "Live change detection"). Uma pasta criada durante a sessão pede `/reload-skills`, e isso a pessoa teria de digitar.
  - O `CLAUDE.md` e o `AGENTS.md` da raiz são lidos no início da sessão e não são relidos nela; o texto novo entra no próximo `/clear`, `/compact` ou reinício (docs/en/prompt-caching, "Editing CLAUDE.md mid-session"). Nada impede a IA de ler os arquivos e segui-los: o conteúdo entra na conversa quando ela os lê (mesma página).
  - Sobre o Codex, o Gemini CLI e o Cursor, a documentação não diz nada. Ler os arquivos funciona em qualquer IA.
- Por isso, sem conversa nova e sem comando para a pessoa digitar: trocar os três pedidos por "Leia agora o bloco do flyee no `AGENTS.md` e, para usar um app, o `SKILL.md` dele em `.flyee/modules/<app>/skills/<skill>/SKILL.md`, e siga nesta mesma conversa. Depois de uma atualização, leia de novo o bloco e o `SKILL.md`, porque a versão do início da conversa fica para trás." Na conversa seguinte, a IA carrega tudo sozinha.
- **Aceite:** o teste do guia procura "conversa nova" e "new conversation" e não acha. Num teste real no Claude Code desktop, depois de instalar um app, o pedido seguinte da pessoa usa o app na mesma conversa.

## Item 6: tirar um idioma do exemplo da loja

**Estado: ⬜** Pelo contrato 10.1, "um idioma ausente no índice mantém o do catálogo" (`CLI-CONTRACT.md:453`), e a importação junta o que veio com o que havia (`apps/web/src/lib/catalog/index-import.ts:313`, `{ ...current.showcase, ...app.showcase }`). Em 2026-10-20 o produto tirou o `en` do exemplo do `video-studio` (`c9fa08a`): o app pergunta, planeja e escreve as notas em português, e o exemplo traduzido prometia uma conversa em inglês. O "Pack app" do mesmo dia (run 39435557940) respondeu `video-studio: unchanged`, e o exemplo em inglês continua no catálogo. Não há como o produto tirá-lo.

- **Agora:** tirar o `en` de `catalog_modules.showcase` do `video-studio`, só ele.
- **No contrato:** `"en": null` no índice tira esse idioma do catálogo; um idioma ausente continua mantendo o do catálogo. O produto passa a mandar `null` quando o `.dev/showcase.json` de um app disser isso, depois que a regra estiver no corpo do contrato.
- **Aceite:** depois de uma importação, `GET /en/catalog/video-studio` não mostra o exemplo; a de `/catalogo/video-studio` em português continua igual. Um vitest cobre `null` (tira), ausente (mantém) e um idioma com problema (fica de fora, com aviso, e mantém).

## Item 7: instalar sem ruído e sem paradas da ferramenta

**Estado:** teste real do operador como integrante em 2026-10-21, numa sessão do Claude Code na nuvem em modo automático, com o pedido do botão da nuvem e só `flyee.club` liberado. Foi do começo ao fim, com o guia, o `doctor`, o login por código, o `doctor` com tudo `true`, o commit e o envio. Mas houve quatro paradas, e as respostas da IA foram técnicas demais para quem é iniciante:

1. **O login foi recusado pelo filtro do modo automático na primeira tentativa.** Passou depois que a IA perguntou e a pessoa respondeu "pode conectar". O filtro não vê a página do guia (a documentação do Claude Code diz que os resultados de ferramentas não chegam a ele) e só conta como intenção da pessoa um pedido que nomeia a ação. O guia manda confirmar antes de começar ("Antes de começar", 2), e a IA pulou esse passo.
2. **O limite de computadores só apareceu depois da aprovação no navegador.** Com teto 1 e o PC conectado, o login voltou `device_limit_reached`. A pessoa foi ao painel, desconectou um computador, pediu outro login e aprovou um segundo código. A mensagem diz "1 computador(es)".
3. **O commit dos arquivos do flyee foi recusado duas vezes no modo automático.** Na segunda, o filtro o tratou como "instruções plantadas", mesmo depois do sim explícito da pessoa. Só passou quando ela trocou o modo para um que pede aprovação. O hook da sessão que pede commit reapareceu a cada resposta.
4. **As respostas listaram detalhes internos:** arquivos (AGENTS.md, CLAUDE.md, GEMINI.md, as skills, o lock), campos do `doctor`, versões e o que a IA conferiu. Para o operador, isso faz o flyee parecer complicado.

O produto já cuidou da parte dele na CLI 1.0.3 (core 1.7.0): a regra "Fale simples" no bloco do `AGENTS.md` e na skill `/flyee`, a pergunta única quando a ferramenta recusa um comando, o commit da nuvem com um pedido só, e as mensagens que o guia mostra como vieram, que agora falam com o integrante. O guia é lido antes de tudo isso existir no projeto, então precisa das mesmas regras:

- **7.1 Fale simples, no topo do guia** (pt-BR e en, perto de "Antes de começar"): "Fale com a pessoa em poucas frases, só sobre o que ela precisa fazer ou decidir e o resultado. Esta página é para você: não repita a ela comandos, arquivos, pastas, campos do JSON, versões ou o que você leu e conferiu, a menos que ela pergunte."
- **7.2 Sem pergunta repetida** ("Antes de começar", 2): o pedido de instalação já é o sim. "Diga em uma frase o que vai fazer e siga." Pergunte só onde o guia pede um sim: o Node.js, um app com o que ele pede, o commit na nuvem.
- **7.3 O fim da instalação** (passo 4): "Diga em uma frase que o flyee está pronto e o que ela pode pedir agora", no lugar de "Diga à pessoa o que ficou instalado".
- **7.4 O pedido da nuvem nomeia os comandos** (`cloud-prompt`, pt-BR e en), para o filtro do modo automático ver a intenção da pessoa: "Instale o flyee seguindo {url}. Pode rodar `npx --yes flyee@latest doctor --json` e `npx --yes flyee@latest login --device`. Se a página não abrir nesta sessão, rode o doctor e me peça o ajuste que ele descrever." O pedido do computador (`ask-ai-install`) fica curto: no modo padrão, a própria ferramenta pede a aprovação de cada comando.
- **7.5 Uma recusa da ferramenta** ("Quando algo não sai como esperado"): "Se o sistema de permissões da sua ferramenta recusar um comando do flyee (no Claude Code, o modo automático), não procure outro caminho: pergunte numa frase se pode fazer aquilo, dizendo o que é, e repita com o sim."
- **7.6 O commit na nuvem em um passo** (seção "Claude Code na nuvem"):
  - Com o sim da pessoa, faça o commit e envie.
  - O modo automático recusa por cautela gravar no repositório instruções vindas de fora. Na primeira recusa, não tente de novo: peça que a pessoa troque o modo, ao lado da caixa de mensagem, por um que pede aprovação, e aprove o pedido que aparecer.
  - Não abra os arquivos para conferir: eles não guardam chave nem senha, e a conexão fica em `~/.flyee`, fora do projeto.
  - Os nomes dos modos na tela em português ainda não foram vistos. A documentação diz Auto e Accept edits, e a tela em português mostrou "Automático".
- **7.7 O limite de computadores na aprovação** (`/ativar`): com a conta no teto, a página mostra os computadores conectados e deixa a pessoa desconectar um ali, antes de aprovar, para uma aprovação só bastar. Também deixa a mensagem no singular ou no plural ("1 computador", "3 computadores").
- **Aceite:** os testes do guia acham "Fale simples" e "Keep it simple". Também acham `login --device` no `cloud-prompt` dos dois idiomas, e não acham mais "Diga à pessoa o que ficou instalado". Numa sessão real na nuvem em modo automático, com o pedido do botão, o login roda sem recusa, e a IA não lista arquivos nem campos do `doctor`. Com a conta no teto, `/ativar` conecta com uma aprovação só.

## Correções ⚠️ que este pedido encontrou

- **`CLI-CONTRACT.md:6`** promete respostas sem cache, mas `apps/web/src/app/api/cli/version/route.ts:21` manda `public, max-age=300`. Ou o contrato diz que 4.9 tem 5 minutos de cache, ou a rota passa a `no-store`. A decisão de cache em si é da plataforma.
- **`CLI-CONTRACT.md:428`**, a linha da seção 9 sobre `min_cli_version`, ainda diz que o piso "sobe para `1.0.0`", e os exemplos das linhas 188 e 323 mostram `0.1.0`. A plataforma responde `1.0.2` desde 2026-10-20 (D4): a linha 428 sai da seção 9, e os exemplos podem seguir com qualquer valor, desde que o texto diga que o piso atual é `1.0.2`.

## Riscos

- **O proxy da nuvem pode recusar de outro jeito.** A CLI 1.0.2 trata três formas: 403 no túnel, resposta com `x-deny-reason` e certificado trocado. Uma sessão real ainda não foi observada. Sinal: um `doctor` numa sessão real que volte `network` em vez de `host_not_allowed`.
- **A rota de bytes pode bater no limite de corpo das funções da Vercel.** A medição dos pacotes atuais dá folga de sobra; o limite só importa se um pacote passar de alguns MB. Sinal: um 413 ou 500 no preview com o maior pacote.
- **A marca de nuvem é declarada pela CLI (D1).** Com `CLAUDE_CODE_REMOTE=true` num segundo PC, uma conta ganha a vaga de nuvem para ele. O ganho tem limite: é uma vaga só, a próxima sessão real na nuvem a toma, e toda conexão pede a aprovação da dona no navegador. Sinal: uma conta com revogações `replaced` toda semana, que é o desenho de uma conta usada por duas pessoas. A faixa de egresso das sessões na nuvem, se a Anthropic a publicar, fecha esse caminho.

## Apêndice A: a seção "Claude Code na nuvem" do guia

Redação proposta, sem conversa nova e com os códigos da CLI 1.0.2. `<projeto>.supabase.co` é o host do Storage, que a rota do guia lê de `NEXT_PUBLIC_SUPABASE_URL` enquanto o item 2 não sair; depois dele, a lista tem só `flyee.club`.

pt-BR:

```md
## Claude Code na nuvem

Esta parte vale numa sessão do Claude Code na nuvem, aberta em claude.ai/code ou no app do Claude, onde a variável de ambiente `CLAUDE_CODE_REMOTE` é `true`. Fora dela, siga para "Passos".

- A rede da sessão só chega aos endereços que o ambiente dela libera, e o flyee precisa de `flyee.club` e `<projeto>.supabase.co`. Se um comando do flyee responder `error` igual a `host_not_allowed`, mostre a `message` como veio: ela diz o endereço e o ajuste, que se faz uma vez. Se `npx --yes flyee@latest doctor --json` trouxer `platform.reachable` em `false`, mostre `platform.message`. O ajuste:
   1. No alto da sessão, clicar na seta ao lado do título e escolher Edit cloud environment.
   2. Em Network access, escolher Custom e, em Allowed domains, escrever um endereço por linha: `flyee.club` e `<projeto>.supabase.co`.
   3. Deixar marcada a opção Also include default list of common package managers, que mantém o npm, e clicar em Save changes.
- Quando a pessoa disser que fez, repita o comando que falhou, nesta mesma conversa. A sessão segue a regra nova em cerca de 1 minuto: se o comando falhar antes disso, espere e repita uma vez. Se falhar de novo, siga "Quando algo não sai como esperado".
- Para conectar, use o login por código do passo 1: o navegador desta sessão não abre na frente da pessoa.
- A página de uma chave também não abre na frente dela. Diga o nome da chave que falta e que ela pode guardá-la em Environment variables, nesse mesmo ambiente, como `<NOME>=<valor>`, valendo a partir da próxima sessão. Nunca peça a chave na conversa.
- Cada sessão começa num computador novo, com uma cópia nova do repositório, e o que o flyee escreve só chega à próxima sessão pelo repositório. Antes de terminar, e com o sim da pessoa, faça o commit desses arquivos na branch de onde a próxima sessão vai começar, em geral a principal, e envie. Se o repositório for público, diga antes que os apps ficariam à vista de qualquer um.
- Numa sessão em que todos os itens de `adapters` do `doctor` vêm `true`, o flyee já está no projeto, mesmo com `connected` em `false`, e os apps instalados funcionam sem conexão. Conecte só para instalar ou atualizar um app. Se o login trouxer `device_limit_reached`, mostre `message` e `action_url` como vieram.
```

en:

```md
## Claude Code in the cloud

This part applies in a Claude Code session in the cloud, opened at claude.ai/code or in the Claude app, where the environment variable `CLAUDE_CODE_REMOTE` is `true`. Outside one, go on to "Steps".

- The session's network only reaches the addresses its environment allows, and flyee needs `flyee.club` and `<project>.supabase.co`. If a flyee command answers `error` as `host_not_allowed`, show the `message` as it came: it names the address and the change, made once. If `npx --yes flyee@latest doctor --json` brings `platform.reachable` as `false`, show `platform.message`. The change:
   1. At the top of the session, click the arrow next to the title and choose Edit cloud environment.
   2. Under Network access, choose Custom and, under Allowed domains, write one address per line: `flyee.club` and `<project>.supabase.co`.
   3. Leave Also include default list of common package managers checked, which keeps npm, and click Save changes.
- When the person says it is done, repeat the command that failed, in this same conversation. The session follows the new rule within about a minute: if the command fails before that, wait and repeat it once. If it fails again, follow "When something does not go as expected".
- To connect, use the login by code of step 1: this session's browser does not open in front of the person.
- The page for a key does not open in front of them either. Tell them the name of the missing key and that they can keep it in Environment variables, in that same environment, as `<NAME>=<value>`, which applies from the next session on. Never ask for the key in the conversation.
- Each session starts on a new computer, with a new copy of the repository, and what flyee writes only reaches the next session through the repository. Before finishing, and with the person's yes, commit those files on the branch the next session will start from, usually the main one, and push it. If the repository is public, say first that the apps would be in view of anyone.
- In a session where every item of the `doctor`'s `adapters` comes as `true`, flyee is already in the project, even with `connected` as `false`, and the installed apps work without a connection. Connect only to install or update an app. If the login brings `device_limit_reached`, show `message` and `action_url` as they came.
```

## Cobertura declarada

- Não rodou uma sessão real do Claude Code na nuvem. A recusa foi reproduzida com um proxy local e com um squid que nega o `flyee.club`.
- Não foram lidos o banco de produção nem os valores de ambiente da plataforma (o host exato do Storage), por serem só leitura e por segurança.
- Os rótulos da tela do Claude em português foram vistos nas capturas do operador em 2026-10-20; os em inglês, não.
