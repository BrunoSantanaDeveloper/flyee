# Enxugar e acrescentar no painel

Da forma mais segura para a mais frágil. Use a primeira que resolver.

## 1. Chaves do próprio Chatwoot (sobrevivem às atualizações)

**Funções da conta** (`chatwoot.features_off` em escolhas.json, aplicadas pelo provisionamento). O menu lateral e a busca de comandos escondem a área de cada função desligada.

| Desligar quando não usa | Função |
|---|---|
| campanhas | `campaigns` |
| central de ajuda | `help_center` |
| empresas | `companies` |
| contatos e segmentos | `crm` |
| macros | `macros` |
| automações | `automations` |
| integrações (some também a tela das Dashboard Apps, que o projeto cria pela API) | `integrations` |
| respostas prontas | `canned_responses` |
| gravador de voz | `voice_recorder` |
| relatórios | `reports` |
| canais que não são WhatsApp | `channel_email`, `channel_facebook`, `channel_website`, `channel_instagram`, `channel_tiktok`, `inbound_emails` |

Nunca desligue: `api_and_webhooks` (sem ela, toda chamada por token falha, robô e projeto juntos), `agent_bots`, `inbox_management`, `agent_management`, `labels`. O provisionamento recusa (`feature_required`).

O exemplo de escolhas.json já desliga campanhas, central de ajuda, empresas e os canais que não são WhatsApp. Respostas prontas, macros e o gravador de voz costumam ajudar a equipe; desligue só se o cliente pedir.

**Papel de atendente.** Tira quase toda a área de configurações. Atendente só vê conversas das caixas de que é membro.

**Nome da instalação, `DISABLE_USER_PROFILE_UPDATE` e `LOGOUT_REDIRECT_LINK`.** Gravados pelo `apply-config.rb` (chatwoot.md).

**Preferências do painel lateral da conversa.** Quais seções começam abertas: o kit grava um padrão enxuto para cada pessoa (`DEFAULT_UI_SETTINGS` em `server/provision.mjs`); a pessoa pode mudar depois.

## 2. CSS para esconder o resto (pode quebrar a cada versão)

`chatwoot.esconder` em escolhas.json: lista de `{ "seletor": "...", "motivo": "..." }`, aplicada com `display: none`. O painel quase não tem nomes estáveis: no menu lateral, só `#sidebar-account-switcher` e `#mobile-sidebar-launcher` são fixos, mais alguns `data-test-id`. O resto são classes do Tailwind, que mudam entre versões.

- Esconda com CSS; nunca apague com JavaScript. O painel é Vue, e um pedaço removido por fora quebra a tela quando o Vue o atualiza.
- Prefira seletores com `id`, `data-test-id`, `name` ou `aria-label`.
- Depois de cada mudança, rode `kit.mjs look`: ele confere que cada seletor não mostra nada e salva as capturas. Um seletor que parou de valer numa versão nova aparece ali.

## 3. Acrescentar coisas do projeto

**Pelo Chatwoot, sem esse risco:**

- Dashboard Apps: uma página do projeto vira aba na conversa e recebe a conversa, o contato e o atendente (`ensureDashboardApp`). Bom para a ficha do cliente, abrir pedido, criar tarefa.
- Atributos personalizados do contato e da conversa: o projeto grava dados (plano, número do processo) pela API e eles aparecem no painel lateral.
- Macros e respostas prontas criadas pelo projeto pela API.
- Webhooks da conta: eventos do Chatwoot chegam ao projeto.

**Pelo tema:** links soltos por cima do painel (`acrescentar.links`), cada um com `rotulo`, `url` https, `posicao` (`superior-direita`, `superior-esquerda`, `inferior-direita` ou `inferior-esquerda`) e `distancia` em pixels. Ficam fora da estrutura do Chatwoot e quase não quebram; confira nas capturas que não cobrem nada.

**Pela moldura:** com `chatwoot.moldura` ligado e o proxy ajustado, o painel abre dentro de uma página do sistema (`PainelAtendimento`), com o menu e o cabeçalho do projeto em volta.

Não faça fork do Chatwoot: cada atualização viraria uma fusão de código.
