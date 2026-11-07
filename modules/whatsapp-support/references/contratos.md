# Contratos entre as peças

Para portar a ligação a outro framework ou linguagem, siga estes contratos. Em Node, use direto `base/server/*.mjs` e `base/shared/*.mjs`, com os tipos `.d.mts` ao lado.

## Assinatura entre o robô e o projeto

Toda chamada do robô ao projeto leva:

- `X-Support-Timestamp`: segundos desde 1970;
- `X-Support-Signature`: `sha256=` mais o HMAC SHA-256, em hexadecimal, com a chave `SUPPORT_BOT_SECRET`, de `"<timestamp>.<MÉTODO>.<caminho completo com a query>.<corpo>"` (corpo vazio no GET).

O projeto recusa com 401 o que vier sem assinatura, com assinatura errada ou com mais de 300 segundos de diferença. O caminho é o que chegou ao servidor do projeto, por exemplo `/api/atendimento/robo/config?account_id=3`; um proxy que reescreve o caminho quebra a assinatura, e `kit.mjs verify` acusa (`assinatura_robo_projeto`). Em Node: `verifyProjectRequest` de `base/shared/signature.mjs`, ou `handleBotRequest` de `base/server/bot-contract.mjs`, que já confere.

## Rotas que o projeto expõe ao robô

Base em `PROJECT_URL` do robô, por exemplo `https://<sistema>/api/atendimento/robo`.

### `GET config?account_id=<id>`

A configuração da conta do Chatwoot. 404 quando a conta não é de nenhum cliente. Monte com `botConfig` de `base/shared/settings.mjs`:

```json
{
  "enabled": true,
  "mode": "auto",
  "brand": "Nome do cliente",
  "chatwoot": { "bot_token": "segredo", "bot_secret": "segredo" },
  "ai": { "provider": "anthropic", "model": "claude-opus-5-5", "effort": "low" },
  "persona": "Você é a Ana, da equipe...",
  "instructions": "Prazos, políticas, o que sempre passa para a equipe...",
  "knowledge": [{ "q": "Qual o prazo de entrega?", "a": "Cinco dias úteis." }],
  "hours": { "timezone": "America/Sao_Paulo", "days": { "seg": [["08:00", "18:00"]] }, "holidays": ["2026-12-25"] },
  "messages": { "handoff": "", "handoff_fora_do_horario": "", "erro": "", "anexo": "" },
  "handoff": { "keywords": ["atendente"], "max_bot_turns": 8, "labels": ["robo-passou"], "team_id": null },
  "tools": [{ "name": "consultar_pedido", "description": "...", "input_schema": { "type": "object", "properties": {} } }],
  "suggest_on_open": true,
  "history_from_project": true,
  "privacy": { "share_contact_name": true }
}
```

- `mode`: `auto` (responde sozinho), `sugestao` (nota privada e passa para a equipe; com `suggest_on_open`, também escreve notas nas conversas que a equipe já abriu) ou `desligado` (passa tudo para a equipe).
- `ai.provider`: `anthropic`, `openai` (e serviços compatíveis, com `base_url` e `key_env`), `gemini` ou `project`. As chaves ficam no ambiente do robô; `key_env` só aceita nomes terminados em `_API_KEY`.
- Mensagens vazias usam o texto padrão do robô. O robô guarda a configuração por 60 segundos.

### `POST tools/<nome>`

Corpo: `{ "account_id", "conversation_id", "inbox_id", "contact": { "id", "name", "phone_number", "identifier", "email" }, "input": { ... } }`. Resposta: o JSON que a consulta devolver, que o robô entrega à IA como dado (até 4.000 caracteres). Em erro, devolva `{ "ok": false, "code": "..." }` com status 200: a IA decide o que dizer ou passa para a equipe.

O projeto aplica a restrição: só dados da pessoa da conversa, achada pelo telefone (`base/shared/phone.mjs` cuida do formato do WhatsApp e do nono dígito) ou por outra confirmação que o projeto exigir. Consulta desligada pelo cliente na tela do robô devolve `tool_disabled` (`createToolRunner` já faz).

### `GET history?account_id=&conversation_id=&limit=`

`{ "messages": [{ "role": "cliente" | "robo" | "equipe", "text": "...", "at": "ISO 8601" }] }`, as últimas mensagens, sem notas privadas. O robô pede quando reinicia e perde a memória. `conversationHistory` de `base/server/provision.mjs` lê do Chatwoot com o token da conta de serviço.

### `POST generate` (só com o provedor `project`)

Corpo: `{ "account_id", "conversation_id", "system", "messages": [{ "role": "user" | "assistant", "content" }], "schema", "tools" }`. Resposta: a ação, no formato abaixo. Serve ao projeto que gera respostas com a própria IA, com aprovação e registro.

## A ação que a IA devolve

```json
{ "action": "reply" | "lookup" | "handoff", "text": "", "tool": "", "input": "", "reason": "" }
```

`reply` responde com `text`; `lookup` pede a consulta `tool` com `input` (um JSON em texto); `handoff` passa para a equipe, com `reason` para a equipe e `text` opcional para o cliente. Até três consultas por mensagem; JSON inválido ganha uma segunda chance; na terceira falha, o robô passa para a equipe.

## Robô e Chatwoot

- Recebe em `POST /chatwoot` o aviso do robô da conta e confere a assinatura com `chatwoot.bot_secret` da configuração. Responde 200 na hora e trabalha depois.
- Age só em `message_created` recebida (`incoming`), não privada, em conversa pendente (e nas abertas no modo sugestão). Junta as mensagens que chegam em sequência (`DEBOUNCE_MS`, padrão 2,5 segundos).
- Chama o Chatwoot com o token do robô da conta, pela rede interna (`CHATWOOT_URL`).
- Registra em log só identificadores, tempos e códigos, nunca conteúdo, telefone ou nome.

## Projeto e Chatwoot (`base/server/provision.mjs`)

| Função | O que faz |
|---|---|
| `provisionAccount` | conta, funções, conta de serviço administradora, robô da conta; devolve o estado para gravar |
| `ensureStaffUser` | pessoa da equipe como atendente, membro de todas as caixas, com as preferências do painel |
| `ssoUrl` | o link de entrada já logado (5 minutos, uso único) |
| `connectCloudApi` | caixa WhatsApp Cloud, robô, equipe; devolve o retorno para a Meta |
| `connectOpenWA` | caixa API, repasse, webhook, adaptador, sessão, instância, robô |
| `whatsappStatus` | estado da sessão do OpenWA e o QR |
| `ensureDashboardApp` | página do projeto como aba da conversa |
| `conversationHistory` | o histórico para a rota `history` |

O estado de cada cliente (`SupportState` em `provision.d.mts`) tem tokens: grave cifrado e nunca em log. Todas as funções podem rodar de novo sem duplicar o que já existe, menos as de conectar número, que criam uma caixa nova a cada chamada.

## Variáveis do servidor do projeto

`CHATWOOT_URL` (o Chatwoot que o servidor alcança), `CHATWOOT_PUBLIC_URL` (https público), `CHATWOOT_PLATFORM_TOKEN`, `SUPPORT_BOT_PUBLIC_URL` (`https://atendimento.<domínio>/robo/chatwoot`), `SUPPORT_BOT_SECRET`, `SUPPORT_SERVICE_EMAIL_DOMAIN` e, na rota não oficial, `OPENWA_URL`, `OPENWA_PUBLIC_URL` e `OPENWA_API_KEY`. Para `kit.mjs verify`, também `PROJECT_URL` e `PROJECT_ORIGIN`.
