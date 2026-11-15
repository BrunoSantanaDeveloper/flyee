# Arquitetura do atendimento

Versões travadas nesta versão do kit: as de `kit/versoes.json` do app (Chatwoot 4.19.1 na imagem `-ce`, OpenWA 0.29.1 com o adaptador 0.9.15).

## As peças

| Peça | O que faz | Onde roda | Quem mexe |
|---|---|---|---|
| Chatwoot (web e sidekiq) | caixa de entrada, painel da equipe, API, WhatsApp Cloud nativo | contêiner, imagem `-ce` | só configuração; nunca o código |
| Postgres com pgvector, Redis | dados do Chatwoot | contêineres | a implantação |
| Robô (`base/bot`) | recebe os avisos do Chatwoot, pergunta ao projeto e à IA, responde ou passa para a equipe | contêiner próprio, sem estado | ninguém edita; configura pelo projeto |
| OpenWA (só na rota não oficial) | conexão pelo WhatsApp Web, com o plugin `chatwoot-adapter` | contêiner | a implantação |
| Servidor do projeto | cria contas e pessoas no Chatwoot, conecta o número, guarda a configuração do robô, responde às consultas do robô | o próprio sistema | o projeto, a partir dos modelos |
| Telas do projeto | Atendimento (entrar no painel), Conectar WhatsApp, Robô de atendimento | o próprio sistema | o projeto, a partir dos modelos |
| Proxy com TLS | o painel, o robô e o OpenWA em endereços https | Caddy de modelo, ou o proxy que o servidor já tem | a implantação |

## Endereços públicos

- `https://atendimento.<domínio>`: o painel do Chatwoot. Fica num subdomínio do mesmo domínio do sistema: o modo moldura depende disso, porque o painel dentro do sistema só guarda o login quando os dois são do mesmo site.
- `https://atendimento.<domínio>/robo/chatwoot`: onde o Chatwoot avisa o robô (o proxy tira o `/robo` e entrega em `robo:8080/chatwoot`). O robô também responde `GET /robo/health`.
- `https://wa.<domínio>`: a API do OpenWA, só na rota não oficial. O proxy expõe só `/api/*`; o painel do OpenWA não fica público.
- `https://<sistema>/api/atendimento/robo/...`: as rotas que o robô chama no projeto (config, tools, history).

Os avisos do Chatwoot vão por esses endereços públicos e assinados. `SAFE_FETCH_ALLOW_PRIVATE_NETWORK` fica desligado em produção: ligado, o Chatwoot aceitaria mandar avisos para endereços da rede interna.

## Caminho de uma mensagem

**Rota oficial.** Cliente escreve → Meta → `https://atendimento.<domínio>/webhooks/whatsapp/<número>` → Chatwoot cria ou acha a conversa; com o robô ligado à caixa, ela nasce pendente → o Chatwoot avisa o robô (`message_created`, assinado com o segredo do robô da conta) → o robô responde 200 na hora, espera alguns segundos para juntar mensagens seguidas, busca a configuração da conta no projeto, chama a IA e, se ela pedir, as consultas do projeto → o robô responde na conversa ou passa para a equipe (a conversa vira aberta e aparece para os atendentes) → a resposta pública sai pela Meta.

**Rota não oficial.** Cliente escreve → WhatsApp Web no OpenWA → o adaptador posta a mensagem na caixa API do Chatwoot, com a pessoa de repasse → daqui em diante igual à oficial → a resposta pública do robô ou da equipe gera o aviso `message_created` da conta → o OpenWA confere a assinatura do webhook da conta e o adaptador envia pelo WhatsApp. Nota privada nunca sai: o adaptador só repassa mensagem com `private` igual a `false`.

**Falhas.** Se o robô não responde ao aviso, o Chatwoot abre a conversa para a equipe com uma nota de atividade (`lib/webhooks/trigger.rb`). Se o robô recebe mas falha depois (IA fora, consulta quebrada), ele mesmo passa para a equipe com a mensagem de erro configurada. Uma conversa que continua pendente sem resposta aparece no filtro de pendentes do painel; vale olhar esse filtro no começo da operação.

## Proxy

O `Caddyfile` de modelo faz tudo acima e ainda fecha `/installation`, a página que cria o super administrador, para quem não está em `INSTALACAO_IPS` (seguranca.md). Com Traefik (labels de Docker ou Swarm):

- `chatwoot-rails`: regra `Host(atendimento.<domínio>)`, porta 3000.
- `robo`: regra `Host(atendimento.<domínio>) && PathPrefix(/robo)`, middleware `stripPrefix` com `/robo`, porta 8080, prioridade maior que a do Chatwoot.
- `openwa`: regra `Host(wa.<domínio>) && PathPrefix(/api)`, porta 2785.
- `/installation`: um roteador com `Host(atendimento.<domínio>) && PathPrefix(/installation)` e prioridade maior que a do Chatwoot, com o middleware `ipAllowList` (`sourceRange` com o IP de quem cria o super administrador). Com Nginx, um `location /installation { allow <IP>; deny all; proxy_pass ...; }`.
- Modo moldura: middleware `headers` no roteador do Chatwoot com `customResponseHeaders.X-Frame-Options` vazio (remove) e `contentSecurityPolicy` igual a `frame-ancestors 'self' https://<sistema>`.

Com Nginx: `location /robo/ { proxy_pass http://robo:8080/; }` antes de `location / { proxy_pass http://chatwoot-rails:3000; }`, com os cabeçalhos de WebSocket (`Upgrade`, `Connection`) para `/cable`, e `proxy_hide_header X-Frame-Options;` mais `add_header Content-Security-Policy "frame-ancestors 'self' https://<sistema>";` no modo moldura. O Nginx descarta cabeçalhos com sublinhado por padrão, e o adaptador do OpenWA manda o token do Chatwoot só em `api_access_token`: ponha `underscores_in_headers on;` no bloco do painel, ou as mensagens do WhatsApp levam 401 e nunca viram conversa. O projeto e o robô mandam o token também em `Authorization: Bearer`, que passa.

**Cabeçalho com sublinhado.** O Caddy 2.11.4 em diante também descarta esses cabeçalhos. Os Caddyfiles do kit (o de servidor único e o da borda) trazem `expected_underscore_headers api_access_token` no bloco global, opção da 2.11.6, e a imagem fica fixada em `caddy:2.11.9` (`kit/versoes.json`). O Traefik mantém o cabeçalho. Para testar um token pelo endereço público, use `Authorization: Bearer`.

## Teste local

Para testar na máquina do desenvolvedor, sem domínio público: suba o compose de modelo, ligue `SAFE_FETCH_ALLOW_PRIVATE_NETWORK=true` só nesse ambiente e use `http://robo:8080/chatwoot` como endereço do robô. Uma caixa do tipo API no Chatwoot simula o WhatsApp: mensagens recebidas criadas pela API (`message_type: incoming`) passam pelo robô como as de verdade. A rota não oficial exige endereços públicos https (o adaptador recusa endereço privado); para testá-la, use um túnel com https.

## Tamanho do servidor

Regra de bolso, não medição: o Chatwoot com Postgres e Redis pede ao menos 2 vCPU e 4 GB de RAM para uma operação pequena. Na rota não oficial, cada sessão do OpenWA com `whatsapp-web.js` usa de 300 a 500 MB (Chromium), e com `baileys` de 30 a 80 MB, segundo o README do OpenWA (lido em 2026-11-04). O robô usa pouca memória; o que pesa nele é o tempo de resposta do provedor de IA.

## Mais de um sistema no mesmo servidor

Cada sistema tem a sua instalação do Chatwoot: a marca e o tema que o kit grava (`InstallationConfig`, `DASHBOARD_SCRIPTS`) valem para a instalação inteira, então dois sistemas com marcas diferentes nunca dividem um Chatwoot. Num servidor só, cada sistema sobe a sua pilha, e um proxy só atende as portas 80 e 443.

- **A pilha de cada sistema**: `modelos/implantacao/compose.yml` com `compose.compartilhado.yml` por cima, escolhidos pelo `.env` da pasta (modelo em `compartilhado.env.example`). O `.env` dá a cada pilha o seu `PILHA` e o seu `COMPOSE_PROJECT_NAME`. Sem isso, as duas pilhas teriam o nome fixo de `compose.yml` (`atendimento`) e dividiriam contêineres e volumes, banco incluído; a variante para com erro quando falta `PILHA`.
- **O que fica separado**: contêineres, rede interna, banco, Redis, anexos, sessões do WhatsApp, segredos, domínios e o super administrador do Chatwoot.
- **O proxy da borda** (`modelos/implantacao/borda/`): um Caddy só por servidor, numa pasta que não é de nenhum dos sistemas, dono das portas 80 e 443 e do TLS. Cada pilha entra com um arquivo `sites/<pilha>.caddy` (modelo em `sites/pilha.caddy.exemplo`) e com a rede `borda-<pilha>`, criada antes de subir a pilha e ligada ao proxy em `borda/compose.yml`. Pela rede da borda, o proxy alcança só o painel, o robô e o OpenWA de cada pilha, com os nomes `<pilha>-chatwoot`, `<pilha>-robo` e `<pilha>-openwa`; uma pilha não alcança a outra. Quem já tem Traefik ou Nginx na porta da frente faz o mesmo com as regras da seção "Proxy".
- **Tetos de memória e CPU** em cada serviço, no `.env` de cada pilha, para uma pilha não sufocar a outra. Os padrões somam 6,9 GB por pilha, pensados para duas pilhas numa VPS de 16 GB; o robô tem 768 MB porque o ffmpeg dele trabalha com imagem, áudio e vídeo.

O que continua dividido, e por isso não é igual a dois servidores: o sistema operacional e o disco (uma pane, um disco cheio ou um reinício derruba as duas pilhas), quem tem o acesso de administrador do servidor, o endereço IP (todos os números do WhatsApp Web saem dele; o OpenWA aceita um proxy por sessão) e o backup da máquina, que copia tudo junto. Faça o backup do banco de cada pilha à parte, guardado fora do servidor. Quando uma falha ou uma invasão num sistema não pode alcançar o outro, são dois servidores.

Tamanho, regra de bolso: numa VPS de 16 GB, duas pilhas pequenas e uns 7 GB para os números do WhatsApp Web, de 14 a 20 números somados com `whatsapp-web.js`. O primeiro sinal de aperto é a memória do OpenWA chegando ao teto.

## O ffmpeg do robô

O Dockerfile do robô instala o ffmpeg e o poppler-utils (`apk add ffmpeg poppler-utils`) para imagem, áudio, vídeo e PDF (contexto.md, "Imagem, áudio e vídeo"). O `/robo/health` mostra se eles estão no contêiner (`media.ffmpeg` e `media.pdf`), e `kit.mjs verify` traz a linha `robo_midia`. Sem o ffmpeg, imagem pequena ainda passa, e áudio e vídeo vão para a equipe; sem o poppler, PDF vai para a equipe, e planilha, CSV e documento de texto continuam lidos. Os caminhos mudam por `PDFTOTEXT_PATH` e `PDFTOPPM_PATH`.
