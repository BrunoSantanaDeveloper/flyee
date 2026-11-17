# Atualizar o kit num projeto

Cada projeto guarda a versão que instalou em `<destino>/kit.json`. Atualizar é decisão do desenvolvedor, projeto por projeto.

## Passo a passo

1. `kit.mjs status <destino>`: a versão instalada, a do app, se há atualização (versão nova ou uma base do kit diferente da que o projeto gravou, em `base_changed`), os arquivos da base editados pelo projeto e as versões travadas que mudaram.
2. Se o projeto editou algum arquivo da base, leve a edição para o código do projeto (a base aceita configuração e funções de fora, como o `store` e as consultas) e devolva o arquivo ao original. Só use `update --force` com o sim do desenvolvedor: a versão do projeto fica em `<arquivo>.projeto`.
3. `kit.mjs update <destino>`: troca a base, acrescenta os modelos novos e lista em `models_changed` os modelos que mudaram no kit; esses você porta à mão para as cópias do projeto.
4. Leia abaixo as notas da versão nova e de cada versão no meio do caminho.
5. Se as versões travadas mudaram (`kit/versoes.json` do app), troque as imagens na implantação do projeto. O Chatwoot roda as migrações do banco ao subir a versão nova; faça backup do Postgres antes.
6. `kit.mjs theme <destino>` (a lista de classes do azul fixo pode ter mudado com a versão do Chatwoot), depois o `chatwoot-config` na implantação, depois `verify` e `look`.

## O que o kit confere a cada versão nova do Chatwoot

Antes de travar uma versão nova, o kit confere no código dela:

- as variáveis de cor de `_next-colors.scss` e a cor fixa `n-brand`, e gera de novo `references/n-brand.json`;
- `DASHBOARD_SCRIPTS`, `LOGOUT_REDIRECT_LINK`, `DISABLE_USER_PROFILE_UPDATE` e o layout que os imprime;
- o serviço que devolve a marca (que não pode existir na imagem `-ce`);
- a API de plataforma (contas com `features`, pessoas, papéis, login único);
- as rotas que o token do robô alcança e o formato da assinatura dos avisos;
- os identificadores estáveis do menu lateral usados em `chatwoot.esconder`;
- a rota de saúde da caixa e os estados que ela devolve (`Whatsapp::HealthService`).

A cada versão nova do OpenWA, confere os estados da sessão, os campos `engineLoaded` e `restriction`, e a resposta do início de uma sessão já carregada.

## Notas por versão

### 1.0.0

Primeira versão. Contexto em duas camadas, com os modelos `plataforma` (o sistema atende os próprios clientes; só o superadmin controla o contexto) e `por-cliente` (o superadmin define as regras de todos e o que cada cliente pode mudar); texto fixo de até 200 mil caracteres no prompt, com a parte fixa separada para o cache dos provedores; sugestões de conhecimento tiradas das conversas resolvidas pela equipe, só com aprovação; relatório das lacunas por assunto. Equipe: entra no painel só quem passa em `canEnterPanel`, e quem sai da equipe sai da conta do Chatwoot (`removeFromPanel` e a conferência diária `syncPanelStaff`). Robô sem estado com quatro provedores de IA (OpenAI e compatíveis, Anthropic, Gemini e o próprio projeto), modos responder, sugerir e desligado; provisionamento por conta com conta de serviço, robô da conta, equipe como atendente e login único; rota oficial pela caixa WhatsApp Cloud do Chatwoot e não oficial pelo OpenWA com o adaptador; telas de modelo em React com a camada `primitives.tsx`; rotas de modelo para o Next.js; tema gerado de escolhas.json; conferências por HTTP e no navegador. Versões travadas: Chatwoot 4.19.1 (`-ce`), OpenWA 0.29.1, adaptador 0.9.15.

#### Conferência do número, acrescentada depois na mesma 1.0.0

Quem implantou antes dela vê `base_changed` em `status`, com o mesmo número de versão. Depois do `update`, faça no projeto, nos arquivos que vieram dos modelos, em qualquer framework:

1. No código que veio de `lib/atendimento.ts`, porte do modelo: `alertWhatsapp` no `store` (implemente com o canal de avisos do projeto), `checkWhatsapp`, `whatsapp`, `reconnectWhatsapp` e o trecho oficial de `connectWhatsapp`. Um projeto que carrega a base módulo a módulo acrescenta `server/health.mjs` ao carregador.
2. Porte a rota `app/api/atendimento/whatsapp/route.ts`, que agora aceita `acao: "reconectar"`.
3. Porte a tela `ConectarWhatsApp.tsx`, que mostra o que a conferência viu e retoma a mesma caixa. Se as telas ficam em outro repositório, com cópia própria de `base/ui/client.mjs`, acrescente lá a chamada `reconnect` e os campos `level` e `findings` do estado.
4. Agende `checkWhatsapp` a cada 15 minutos numa rotina do projeto, para cada cliente com atendimento (no modelo `plataforma`, só `PLATFORM_TENANT`). Com mais de uma réplica do servidor, rode em uma só: duas ao mesmo tempo mandam o aviso duas vezes.
5. Rode `verify`, que agora traz uma linha `numero_conectado_<sessão>` para cada sessão do OpenWA, e mande uma mensagem de outro celular para ver a resposta chegar.

Antes dela, a tela criava outra caixa ao conectar de novo. Se um projeto já tem caixas repetidas para o mesmo número, a conferência olha a última; a decisão de apagar as antigas é do desenvolvedor.

#### Grupos do WhatsApp, acrescentados depois na mesma 1.0.0

Quem implantou antes deles também vê `base_changed`. A base nova traz o campo `groups` e a permissão `grupos` nas configurações, o robô que reconhece um grupo, `syncOpenWAGroups` e as etiquetas no provisionamento, e a recusa de consulta de grupo em `createToolRunner`. Nenhum arquivo novo na base: um carregador módulo a módulo continua igual. Depois do `update`:

1. No código que veio de `lib/atendimento.ts`, porte do modelo `groupsFor`, `syncWhatsappGroups`, `applyGroups`, o trecho de `writeSettings` que aplica a mudança nos grupos e devolve `aviso`, e o `relayGroups` de `connectWhatsapp`.
2. Rode `syncWhatsappGroups` na mesma rotina de `checkWhatsapp`, para cada cliente com atendimento.
3. Porte o cartão "Grupos do WhatsApp" de `RoboAtendimento.tsx` e a mensagem `aviso` ao salvar. Se as telas ficam em outro repositório, com cópia própria de `base/shared/settings.mjs` e `base/ui/client.mjs`, leve também o campo `groups`, a permissão `grupos` e o `aviso` de `saveSettings`.
4. Implante de novo o robô (`base/bot`), que mudou: sem ele, o grupo entra no painel e o robô antigo responde como se fosse uma pessoa.
5. Teste com um grupo de teste: ponha o número num grupo, escolha "A equipe atende e o robô fica calado", mande uma mensagem no grupo de outro celular e veja a conversa "Grupo: <nome>" abrir no painel com a etiqueta `grupo`, sem resposta do robô. Depois escolha "O robô responde quando chamado" e escreva a palavra configurada.

Configurações gravadas antes não têm `groups` e valem como `fora`: nada muda até alguém escolher. As etiquetas `robo-passou` e `grupo` nascem na conta na próxima vez que `ensureAccount` rodar.

#### Quem responde assume, acrescentado depois na mesma 1.0.0

Antes, o robô continuava respondendo numa conversa pendente depois que uma pessoa respondia, pelo painel sem abrir a conversa ou pelo celular do número, porque o Chatwoot `-ce` não abre a conversa sozinho nessa hora (chatwoot.md). A base nova faz o robô abrir a conversa para a equipe e marca a resposta pelo celular. Nenhum modelo mudou. Depois do `update`:

1. Implante de novo o robô (`base/bot`). É ele que muda o comportamento.
2. Se a rota `config` do projeto não usa `botConfig`, ponha `relay_user_id` do estado em `chatwoot.relay_user_id`. Sem ele, a resposta pelo celular tira o robô da conversa, mas sem a etiqueta e a nota.
3. Na próxima vez que `ensureAccount` rodar, a pessoa de repasse passa a se chamar "Celular do WhatsApp" e a etiqueta `celular` nasce na conta.
4. A conta passa a resolver sozinha a conversa aberta e parada há 8 horas, que volta ao robô na próxima mensagem do cliente. A que espera resposta da equipe fica na fila. Para outro tempo, ponha `chatwoot.resolver_apos_horas` em escolhas.json; 0 desliga. Vale na próxima vez que `ensureAccount` rodar.
5. Teste: com o robô ligado, mande uma mensagem de outro celular e responda pelo painel sem abrir a conversa; mande outra e veja que o robô não responde. Depois, numa conversa nova, responda pelo celular do número e veja a mensagem como "Celular do WhatsApp", com a etiqueta e a nota.

#### Grupos da equipe, acrescentados depois na mesma 1.0.0

Conversa interna da equipe em grupos dentro do painel (chatwoot.md, "Grupos da equipe"). O robô não muda. Depois do `update`:

1. Implemente `teamPeople` no `store`: as mesmas pessoas de `listPanelPeople`, com chave, nome e e-mail.
2. No código que veio de `lib/atendimento.ts`, porte `canManageGroups`, `teamGroups`, `saveTeamGroupFor`, `archiveTeamGroupFor` e `syncTeamGroupsFor`, e rode `syncTeamGroupsFor` na mesma rotina de `checkWhatsapp`. Um projeto que carrega a base módulo a módulo não precisa de arquivo novo: tudo está em `server/provision.mjs`.
3. Copie a rota `app/api/atendimento/grupos/route.ts` e a tela `GruposEquipe.tsx`, e ponha a tela na área do superadmin (modelo `plataforma`) ou na de quem administra o cliente (`por-cliente`). Se as telas ficam em outro repositório, com cópia própria de `base/ui/client.mjs`, leve as chamadas `teamGroups`, `saveTeamGroup` e `archiveTeamGroup`.
4. Teste: crie um grupo com duas pessoas, entre no painel com cada uma e veja o grupo "Equipe: <nome>" só para elas; escreva no grupo e veja o aviso chegar à outra; entre com uma terceira pessoa e veja que o grupo não aparece.

#### Mais de um sistema no mesmo servidor, acrescentado depois na mesma 1.0.0

Nada a portar para quem tem um sistema por servidor. Quem vai pôr um segundo sistema no mesmo servidor segue a seção "Mais de um sistema no mesmo servidor" de arquitetura.md antes de subir a segunda pilha. Uma pilha que já está no ar com o nome `atendimento` continua com ele: ponha `COMPOSE_PROJECT_NAME=atendimento` no `.env` dela, para os volumes seguirem os mesmos, e dê ao sistema novo um nome diferente.

#### Achados da primeira implantação real, corrigidos depois na mesma 1.0.0

Quem implantou antes destas correções:

1. Acrescente `DISABLE_TELEMETRY=true` e `POSTGRES_DATABASE=chatwoot_production` ao `chatwoot.env`, e suba de novo o Chatwoot. `chatwoot_production` é o banco que o Chatwoot já usava sem a variável; nada muda nos dados.
2. Troque no `compose.yml` o `POSTGRES_DB` e o banco do healthcheck para `chatwoot_production`. O banco `chatwoot` que a versão anterior criou ficou vazio; apagar ou deixar é escolha do desenvolvedor.
3. Feche `/installation` no proxy (o bloco `@instalacao` do `Caddyfile` ou do `sites/<pilha>.caddy`, ou a regra de Traefik e de Nginx em arquitetura.md) e rode `verify`, que traz a linha `instalacao_fechada`.

#### Achados da implantação da Atrupe, corrigidos depois na mesma 1.0.0

Na Atrupe, o número conectava, a tela dizia conectado e nenhuma mensagem chegava ao painel, por dois motivos: o adaptador ligado antes da instância ficava em erro, e o Caddy 2.11.4 em diante descartava o `api_access_token` dele. Quem implantou antes destas correções:

1. Atualize a base e implante de novo o servidor do projeto: `connectOpenWA` agora liga o adaptador depois da instância e exige que fique saudável, a conferência do número lê o `status` e a saúde do adaptador, e `ensureStaffUser` recusa o e-mail do super administrador e grava o filtro de todas as conversas para quem entra na equipe. Quem já está na equipe fica com o filtro que tem.
2. Ponha no bloco global do Caddyfile `servers { expected_underscore_headers api_access_token }` e fixe a imagem em `caddy:2.11.9`. Com Nginx, `underscores_in_headers on;` (arquitetura.md, "Proxy").
3. Rode `verify`: `adaptador_openwa` e `adaptador_saudavel` mostram se a ponte está de pé. Um adaptador que já está em erro volta com o que `startAdapter` faz: a configuração base com os dados da conexão (o `apiToken` é o `relay_token` do estado, nunca o que o OpenWA mostra), ligar e conferir a saúde.
4. Mande uma mensagem de outro celular e veja a conversa chegar ao painel.

Mensagem perdida no passado, achado da Atrupe em produção (2026-11-12): a contagem de mensagens descartadas do adaptador só cresce, e a primeira versão da conferência da saúde a tratava como número parado para sempre. Com a base nova, só descartadas é `atencao`, e `verify` aprova o adaptador que voltou a passar mensagens, mostrando a perda. Zere a contagem desligando e ligando o adaptador depois de corrigir a causa.

#### Imagem, áudio e vídeo, acrescentados depois na mesma 1.0.0

O robô passa a ler foto, print, áudio e vídeo (contexto.md, "Imagem, áudio e vídeo"). Depois do `update`:

1. Implante de novo o robô com o Dockerfile do kit, que agora instala o ffmpeg, e suba o teto de memória dele (768 MB na pilha compartilhada).
2. Ponha `GEMINI_API_KEY` (a transcrição mais barata) ou `OPENAI_API_KEY` no ambiente do robô. Sem nenhuma, áudio continua indo para a equipe.
3. Porte o cartão "Imagens, áudios e vídeos" de `RoboAtendimento.tsx`. Configurações gravadas antes não têm `media` e valem como tudo ligado.
4. Rode `verify` (`robo_midia`) e mande de outro celular uma foto, um áudio e um vídeo: o robô responde sobre os três, e a transcrição aparece como nota interna.

#### Transcrição pelo projeto e a tela que só mostra o que funciona, na mesma 1.0.0

Para quem não deixa chave de IA no contêiner do robô, o próprio projeto pode transcrever (contratos.md, `POST transcribe`). E a tela do robô passa a esconder "Ouvir áudios" quando ninguém transcreve. Depois do `update`:

1. Implante de novo o robô: o `/health` dele passa a mostrar `media.transcriber`.
2. Se o projeto vai transcrever: ponha `transcription: "project"` no provedor de IA do projeto (`defaultAi`), acrescente o tratador `transcribe` em `botHandler` com a IA que o projeto já usa, e confira que a rota do robô aceita corpo de 2 MB.
3. Porte de `next/lib/atendimento.ts` o `media` de `readSettings` (`mediaSupport`) e, de `RoboAtendimento.tsx`, o cartão "Imagens, áudios e vídeos", que esconde "Ouvir áudios" e a nota quando `media.audio` é `false`.
4. Rode `verify`: a linha `robo_midia` diz quem transcreve. Mande um áudio de outro celular: o robô responde, e a transcrição aparece como nota.

#### PDF, planilha, CSV e documento, acrescentados depois na mesma 1.0.0

O robô passa a ler o arquivo que a pessoa manda (contexto.md, "Imagem, áudio e vídeo", em "Arquivos"). Antes, todo arquivo ia para a equipe. Depois do `update`:

1. Implante de novo o robô com o Dockerfile do kit, que agora instala também o poppler-utils. Nenhuma chave nova.
2. Porte de `RoboAtendimento.tsx` a chave "Ler PDFs, planilhas e documentos" do cartão, que agora se chama "Imagens, áudios, vídeos e arquivos". Configurações gravadas antes não têm `media.documents` e valem como ligado.
3. Rode `verify`: a linha `robo_midia` diz "lê PDF". Mande de outro celular um comprovante em PDF e uma planilha: o robô responde sobre os dois sem chamar a equipe.

#### Perfil por conversa, acrescentado depois na mesma 1.0.0

O robô passa a responder conforme quem escreve: o projeto diz o perfil da pessoa (contato novo, cliente em teste, ativo, inadimplente, bloqueado, cancelado) pela rota nova `contact`, e o superadmin diz na tela do robô o que muda em cada perfil (contexto.md, "O perfil de quem escreve"). Junto vieram o resumo em toda passagem para a equipe, o dia da semana e o feriado na linha de data e o campo dos feriados na tela.

**Para quem não implementa nada, nada muda no atendimento.** Sem a rota `contact`, ela responde 404, e o robô continua igual: sem perfil, sem dados da pessoa, com o modo, o limite e o time de sempre. O que muda sozinho, ao implantar o robô novo: a nota interna da passagem para a equipe deixa de ser "O robô passou a conversa para a equipe: motivo" e vira o resumo de seis linhas, com "não informado" no que o robô não sabe; no modo desligado, a conversa ganha essa nota e vai para o time da passagem, quando a conta tem um; e a linha de data diz o dia da semana e o feriado. O motivo continua no relatório das lacunas.

Depois do `update`, para ligar os perfis:

1. Implante de novo o robô (`base/bot`). É ele que pergunta o perfil, monta o prompt com o bloco do perfil e deixa o resumo. Arquivo novo na base do robô: `bot/src/conversation.mjs`; a imagem do Dockerfile do kit já leva a pasta inteira.
2. Implante de novo a API do projeto com a base nova: `handleBotRequest` ganhou a rota `contact`, e `settings.mjs`, o campo `profiles` e a permissão `perfis`. Um projeto que carrega a base módulo a módulo não tem arquivo novo do lado do servidor.
3. Declare os perfis que o projeto sabe dizer: no código que veio de `lib/atendimento.ts`, porte a lista `profiles` (`[{ key, label, description }]`, a chave em letras minúsculas sem acento, números, `_` e `-`) e troque o exemplo pelos perfis reais. Porte também `declaredProfiles: profiles` nas duas chamadas de `validateSettings` em `writeSettings`, `profiles` em `botConfig` de `configFor` e `profiles` na resposta de `readSettings`.
4. Implemente `getContact`: porte o tratador de `botHandler` e implemente `store.contactProfile`, que acha a pessoa pelo telefone (`contactPhone` e `brPhoneVariants`, como nas consultas) e devolve `{ profile, label, facts }`, ou null quando não souber quem é. Ponha em `facts` o que ajuda a atender (plano, dias de teste, valor em aberto) e, se o projeto souber, `empresa`, `etapa` e `origem`, que também vão para o resumo da passagem. Responda rápido: o robô espera 3 segundos e segue sem perfil.
5. Porte de `RoboAtendimento.tsx` o cartão "Perfis" (um bloco por perfil declarado: instruções, limite de respostas, time e modo, vazio vale o padrão), o campo "Feriados" com o botão dos feriados nacionais no cartão do horário e `declaredProfiles` na validação de `salvar`. Se as telas ficam em outro repositório, com cópia própria de `base/shared/settings.mjs` e `base/ui/client.mjs`, leve também o campo `profiles`, a permissão `perfis` e `profiles` em `SettingsResponse`.
6. No modelo `por-cliente`, decida se libera a permissão `perfis` aos clientes; ela nasce desligada, e a plataforma escreve os blocos de todos.
7. Escreva os blocos dos perfis na tela do robô e rode a bateria de conversas (bateria.md) com um caso por perfil, antes de abrir para os clientes. Depois, de outro celular, escreva como um cliente de cada perfil e veja a resposta e, numa passagem, a nota com o resumo.

Configurações gravadas antes não têm `profiles` e valem como sem bloco. O robô novo com um projeto de antes, e o projeto novo com um robô de antes, funcionam: o robô de antes nunca chama `contact`, e a rota `config` com `profiles` é lida só pelo robô novo.

#### Bateria de conversas, acrescentada depois na mesma 1.0.0

O comando `bateria` roda conversas escritas por quem aprova o atendimento com a IA de verdade e a configuração de produção, sem consultar o projeto e sem enviar nada (bateria.md). Nada a portar: depois do `update` e do perfil por conversa, copie `references/bateria.exemplo.json` do app para `<destino>/bateria.json`, troque pelos casos do projeto e rode `bateria` antes de abrir para os clientes. `--env` agora pode vir mais de uma vez, também em `verify` e `look`.
