# Chatwoot: o que o kit usa e por quê

Fatos lidos no código do Chatwoot na tag `v4.19.1`, em 2026-11-07. Ao trocar de versão, confira de novo os que o kit usa (lista em atualizar.md).

## Imagem `-ce`

A cada versão o Chatwoot publica a imagem `chatwoot/chatwoot:<versão>-ce`, construída sem a pasta `enterprise` (`.github/workflows/publish_foss_docker.yml`). Na imagem comum, no plano comunitário, um serviço devolve nome, logos e links ao padrão do Chatwoot (`enterprise/app/services/internal/reconcile_plan_config_service.rb`); na `-ce` esse serviço não existe, e a marca que o kit grava fica. A marca no banco na `-ce` ainda não foi testada num Chatwoot no ar: `kit.mjs verify` confere o título da página de login.

## Configurações que o kit grava (InstallationConfig)

O `base/deploy/apply-config.rb` grava, a cada implantação:

| Chave | Valor | Efeito |
|---|---|---|
| `INSTALLATION_NAME`, `BRAND_NAME` | o nome do sistema | título da aba e textos; com nome diferente de "Chatwoot", o painel esconde os links da documentação e do changelog do Chatwoot (`isACustomBrandedInstance`) |
| `LOGO`, `LOGO_DARK`, `LOGO_THUMBNAIL` | endereços dos logos | o logo do menu lateral usa `LOGO_THUMBNAIL` |
| `BRAND_URL`, `WIDGET_BRAND_URL`, `TERMS_URL`, `PRIVACY_URL` | endereços do sistema | links da marca |
| `LOGOUT_REDIRECT_LINK` | página do sistema | quem sai do painel volta ao sistema |
| `DISABLE_USER_PROFILE_UPDATE` | `true` | some a edição de perfil e de e-mail; quem gerencia a pessoa é o projeto |
| `DISPLAY_MANIFEST` | `false` | some os ícones, o manifesto e a cor de tema do Chatwoot |
| `ENABLE_ACCOUNT_SIGNUP` | `false` | ninguém cria conta pelo painel |
| `DASHBOARD_SCRIPTS` | o `gerado/painel.html` | o tema e os links soltos; entra no fim de toda tela do painel, inclusive no login, menos na troca de senha |

`DASHBOARD_SCRIPTS` não tem tela na edição comunitária (a tela fica no console pago), por isso vai pelo banco. O painel não tem política de segurança de conteúdo ativa (`config/initializers/content_security_policy.rb` está todo comentado), então o `<style>` e o `<script>` do tema rodam.

## API de plataforma

Autentica com o token do Platform App (`Authorization: Bearer` ou `api_access_token`). Só mexe no que o próprio Platform App criou.

- `POST /platform/api/v1/accounts` com `name`, `locale` e `features` (mapa nome para verdadeiro ou falso).
- `PATCH /platform/api/v1/accounts/:id` com `features`.
- `POST /platform/api/v1/users`: devolve a pessoa que já existe com o mesmo e-mail.
- `GET /platform/api/v1/users/:id`: traz o `access_token` da pessoa.
- `POST /platform/api/v1/accounts/:id/account_users` com `user_id` e `role` (`administrator` ou `agent`); chamar de novo troca o papel.
- `GET /platform/api/v1/accounts/:id/account_users`: quem está na conta, com o papel.
- `DELETE /platform/api/v1/accounts/:id/account_users?user_id=`: tira a pessoa da conta, sem apagá-la (ela pode estar na conta de outro cliente). O Chatwoot a tira das caixas e das equipes e devolve à fila as conversas atribuídas a ela (`Agents::DestroyJob`). Responde 200 mesmo se ela já não estava.
- `GET /platform/api/v1/users/:id/login`: o link de entrada. O token dele vale 5 minutos e deixa de valer no primeiro uso (`app/models/concerns/sso_authenticatable.rb`); peça na hora de abrir o painel.

O token do Platform App não acessa a API das contas. Por isso o kit cria em cada conta uma conta de serviço administradora e usa o token dela para caixas, robô e webhooks.

## Robô da conta (Agent Bot)

- Criado com o token da conta de serviço em `POST /api/v1/accounts/:id/agent_bots`; para administradores, a resposta traz `access_token` e `secret`.
- Ligado a uma caixa com `POST /api/v1/accounts/:id/inboxes/:inbox_id/set_agent_bot`.
- Com o robô ligado, conversa nova nasce `pending` e o robô recebe todo `message_created` da caixa, assinado com `X-Chatwoot-Signature` (`sha256=` mais o HMAC de `"<timestamp>.<corpo>"`) e `X-Chatwoot-Timestamp`.
- O token do robô só alcança: ver, mudar estado, digitação, prioridade e atributos da conversa; criar mensagem; atribuir; ler e gravar etiquetas (`BOT_ACCESSIBLE_ENDPOINTS`). Não lista mensagens: o histórico vem do projeto, pela rota `history`.
- Passar para a equipe: `POST .../conversations/:id/toggle_status` com `status: open`, feito pelo robô numa conversa pendente (`bot_handoff!`).
- O Chatwoot espera 5 segundos pela resposta do aviso (`WEBHOOK_TIMEOUT`). Se o aviso falha numa conversa pendente, ele abre a conversa e registra a falha.

## Funções da conta

As funções (`config/features.yml`) se ligam e desligam por conta na API de plataforma. O menu lateral e a busca de comandos escondem a área de cada função desligada. Lista do que desligar e do que nunca desligar em enxugar.md. Toda chamada por token exige `api_and_webhooks` ligado (`validate_token_api_access`).

## Papéis

A edição comunitária tem só administrador e atendente; papel sob medida é pago (`enterprise/app/models/custom_role.rb`). A equipe do cliente é atendente: não vê configurações de caixa, robô e webhooks. Atendente só vê conversas das caixas de que é membro, por isso o kit põe cada pessoa em todas as caixas da conta. Cada conta é separada: quem está numa conta não vê nada de outra. A mesma pessoa (o mesmo e-mail) em dois clientes entra nas duas contas e alterna entre elas no painel.

A sessão do painel dura até 2 meses (`token_lifespan` em `config/initializers/devise_token_auth.rb`). Por isso quem sai da equipe precisa sair da conta: sem isso, continua abrindo o painel num navegador em que já entrou.

## Painel dentro do sistema

O painel manda `X-Frame-Options: SAMEORIGIN` (só o widget e os portais liberam). O modo moldura troca isso no proxy por `frame-ancestors` com a origem do sistema. Funciona quando painel e sistema são do mesmo site (subdomínios do mesmo domínio).

## Dashboard Apps

Uma página do projeto vira aba dentro da conversa (`ConversationBox.vue`) e recebe por `postMessage` a conversa, o contato e o atendente (`DashboardApp/Frame.vue`). Criadas com o token da conta de serviço em `POST /api/v1/accounts/:id/dashboard_apps`, com o corpo `{ "dashboard_app": { "title": "...", "content": [{ "type": "frame", "url": "https://..." }] } }` (o único tipo aceito é `frame`); a base traz `ensureDashboardApp` em `server/provision.mjs`. Não dependem de função ligada.

## O que fica de fora

- O app de celular do Chatwoot pede e-mail e senha; as pessoas criadas pelo projeto não têm senha conhecida. Nesta versão, o atendimento é pelo navegador.
- Os e-mails de aviso aos atendentes seguem o modelo do Chatwoot e não passam pelo tema.
- O Captain (IA do Chatwoot) é pago; o robô do kit faz esse papel.
