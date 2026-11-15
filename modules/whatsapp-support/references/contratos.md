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
  "chatwoot": { "bot_token": "segredo", "bot_secret": "segredo", "relay_user_id": 41 },
  "ai": { "provider": "anthropic", "model": "claude-opus-5-5", "effort": "low", "cache_ttl": "5m" },
  "persona": "Você é a Ana, da equipe...",
  "platform_instructions": "Regras do superadmin que valem para todos os clientes...",
  "instructions": "Prazos, políticas, o que sempre passa para a equipe...",
  "platform_knowledge": [{ "q": "O que é a plataforma?", "a": "..." }],
  "knowledge": [{ "q": "Qual o prazo de entrega?", "a": "Cinco dias úteis." }],
  "hours": { "timezone": "America/Sao_Paulo", "days": { "seg": [["08:00", "18:00"]] }, "holidays": ["2026-12-25"] },
  "messages": { "handoff": "", "handoff_fora_do_horario": "", "erro": "", "anexo": "" },
  "handoff": { "keywords": ["atendente"], "max_bot_turns": 8, "labels": ["robo-passou"], "team_id": null },
  "tools": [{ "name": "consultar_pedido", "description": "...", "input_schema": { "type": "object", "properties": {} } }],
  "groups": { "mode": "equipe", "call_words": [], "team_id": null },
  "media": { "images": true, "audio": true, "video": true, "documents": true, "transcription_note": true },
  "suggest_on_open": true,
  "history_from_project": true,
  "privacy": { "share_contact_name": true },
  "learning": { "enabled": true },
  "report": { "enabled": true }
}
```

- `platform_instructions` e `platform_knowledge` vêm da camada da plataforma no modelo `por-cliente` e entram no prompt antes das do cliente, valendo acima delas; no modelo `plataforma` ficam vazios e a camada da plataforma vai em `instructions` e `knowledge` (contexto.md).
- `learning` e `report` ligam as sugestões de conhecimento e o relatório das lacunas; vêm da camada da plataforma.
- `chatwoot.relay_user_id`: a pessoa de repasse do OpenWA (`relay_user_id` do estado; `botConfig` já põe), para o robô marcar o que veio do celular do número. Sem ela, a resposta pelo celular ainda tira o robô da conversa, só sem a marca.
- `groups`: o que fazer com os grupos do WhatsApp (whatsapp.md, "Grupos do WhatsApp"). `mode` é `fora`, `equipe` ou `chamado`; `call_words`, as palavras que chamam o robô no grupo; `team_id`, o time do Chatwoot que recebe as conversas de grupo. Monte com `groupSettings` de `base/shared/settings.mjs` (já está em `botConfig`); `chamado` sem palavra vale como `equipe`.

- `mode`: `auto` (responde sozinho), `sugestao` (nota privada e passa para a equipe; com `suggest_on_open`, também escreve notas nas conversas que a equipe já abriu) ou `desligado` (passa tudo para a equipe).
- `ai.provider`: `anthropic`, `openai` (e serviços compatíveis, com `base_url` e `key_env`), `gemini` ou `project`. As chaves ficam no ambiente do robô; `key_env` só aceita nomes terminados em `_API_KEY`.
- `ai.transcription`: `project` quando o próprio projeto transcreve áudio e a fala do vídeo pela rota `transcribe`, para quem não deixa chave de IA no contêiner do robô; sem o campo, transcreve a chave do Gemini ou da OpenAI do robô (contexto.md, "Imagem, áudio e vídeo"). Declare junto com a rota: com `project` e sem a rota, todo áudio vai para a equipe.
- `media`: o que o robô lê (imagem, áudio, vídeo, e `documents` para PDF, planilha, CSV e documento de texto) e se a transcrição vira nota para a equipe; sem `documents`, numa configuração salva antes, os arquivos valem como ligados. Monte com `botConfig` (vem de `mediaSettings`).
- Mensagens vazias usam o texto padrão do robô. O robô guarda a configuração por 60 segundos.

### `POST tools/<nome>`

Corpo: `{ "account_id", "conversation_id", "inbox_id", "contact": { "id", "name", "phone_number", "identifier", "email" }, "input": { ... } }`. Resposta: o JSON que a consulta devolver, que o robô entrega à IA como dado (até 4.000 caracteres). Em erro, devolva `{ "ok": false, "code": "..." }` com status 200: a IA decide o que dizer ou passa para a equipe.

O projeto aplica a restrição: só dados da pessoa da conversa, achada pelo telefone (`base/shared/phone.mjs` cuida do formato do WhatsApp e do nono dígito) ou por outra confirmação que o projeto exigir. Consulta desligada pelo cliente na tela do robô devolve `tool_disabled`, e consulta de uma conversa de grupo (`contact.identifier` terminado em `@g.us`) devolve `group_chat` sem rodar (`createToolRunner` já faz as duas coisas).

### `GET history?account_id=&conversation_id=&limit=`

`{ "messages": [{ "role": "cliente" | "robo" | "equipe", "text": "...", "at": "ISO 8601" }] }`, as últimas mensagens, sem notas privadas. O robô pede quando reinicia e perde a memória. `conversationHistory` de `base/server/provision.mjs` lê do Chatwoot com o token da conta de serviço.

### `POST generate` (só com o provedor `project`)

Corpo: `{ "purpose", "account_id", "conversation_id", "system", "messages": [{ "role": "user" | "assistant", "content" }], "schema", "tools" }`. `content` é texto ou, quando a pessoa mandou imagem ou vídeo, uma lista de partes `{ "type": "text", "text" }` e `{ "type": "image", "mime", "data" }` (base64), que o projeto converte para a IA dele. Com `purpose: "acao"`, a resposta é a ação, no formato abaixo; com `purpose: "sugestoes"`, é `{ "suggestions": [{ "q", "a", "why" }] }`. Serve ao projeto que gera respostas com a própria IA, com aprovação e registro.

### `POST transcribe` (só com `ai.transcription: "project"`)

Corpo: `{ "account_id", "conversation_id", "kind": "audio" | "video", "mime": "audio/mpeg", "seconds", "data", "part", "parts" }`, uma parte de até 5 minutos de MP3 mono em base64 (por volta de 1,6 MB no corpo; o ffmpeg do robô já cortou). `kind` diz se é um áudio ou a fala de um vídeo; `seconds`, a duração da parte (`null` quando o ffmpeg não soube), para o projeto aplicar o teto de gasto dele. Resposta: `{ "ok": true, "text": "..." }`, o que foi falado, vazio quando não há fala; o robô junta as partes na ordem de `part`. Para recusar (sem a chave da empresa, teto de gasto, grande demais), o tratador devolve `{ "ok": false, "code": "..." }`, que sai com status 200, e o áudio vai para a equipe com esse código no log do robô. Serve ao projeto que não deixa chave de IA no contêiner do robô e transcreve com a IA que já usa. A rota do projeto precisa aceitar corpo de 2 MB: o nginx, por exemplo, limita a 1 MB por padrão (`client_max_body_size`). Sem o tratador `transcribe` em `handleBotRequest`, a rota devolve 404 `not_enabled`, e o áudio vai para a equipe.

### `POST events`

Cada passagem para a equipe: `{ "kind": "handoff", "account_id", "conversation_id", "category", "topic", "reason", "excerpt", "at" }`. O trecho e o assunto chegam sem dado pessoal (o robô limpa antes). O projeto guarda por cliente e monta o relatório com `summarizeGaps` de `base/shared/report.mjs`. Sem essa rota, o robô segue e só registra a falha em log.

### `POST suggestions`

Perguntas e respostas tiradas de uma conversa que a equipe resolveu: `{ "account_id", "conversation_id", "suggestions": [{ "q", "a", "why" }], "at" }`, já sem dado pessoal. O projeto guarda como pendentes para a camada dona do conhecimento da conta (`knowledgeOwner`), que aprova, edita ou descarta. Nada entra no conhecimento sem aprovação.

## A ação que a IA devolve

```json
{ "action": "reply" | "lookup" | "handoff", "text": "", "tool": "", "input": "", "reason": "", "category": "", "topic": "" }
```

`reply` responde com `text`; `lookup` pede a consulta `tool` com `input` (um JSON em texto); `handoff` passa para a equipe, com `reason` para a equipe, `text` opcional para o cliente, `category` (`nao_sei`, `pedido_da_pessoa`, `decisao_humana`, `reclamacao`, `risco`, `outro`) e `topic`, o assunto em poucas palavras, que alimentam o relatório das lacunas. Até três consultas por mensagem; JSON inválido ganha uma segunda chance; na terceira falha, o robô passa para a equipe.

### A tela sabe se o robô ouve

`mediaSupport` de `base/server/bot-contract.mjs` pergunta ao `/health` do robô (`SUPPORT_BOT_PUBLIC_URL` trocando `chatwoot` por `health`) e junta com `ai.transcription`: `{ "audio": false }` quando o robô não tem ffmpeg ou ninguém transcreve, e então a tela esconde "Ouvir áudios" e a nota com a transcrição; `null` quando o robô não respondeu em 3 segundos, e a tela mostra tudo. O modelo devolve isso em `media` na resposta das configurações (`readSettings`). O `/health` do robô mostra `media.transcriber` (`gemini`, `openai` ou `null`), só o nome do provedor, nunca a chave, e `media.pdf`, se o leitor de PDF está no contêiner.

## Robô e Chatwoot

- Recebe em `POST /chatwoot` o aviso do robô da conta e confere a assinatura com `chatwoot.bot_secret` da configuração. Responde 200 na hora e trabalha depois.
- Age só em `message_created` recebida (`incoming`), não privada, em conversa pendente (e nas abertas no modo sugestão).
- Uma mensagem enviada (`outgoing`), não privada, de uma pessoa (`sender.type` `user`, sem automação nem campanha) é a equipe assumindo: numa conversa pendente, o robô a abre para a equipe (`toggle_status` open) sem escrever nada, e as mensagens do cliente que chegaram junto ficam com a pessoa. O Chatwoot `-ce` não faz isso sozinho (chatwoot.md). Vinda da pessoa de repasse (`chatwoot.relay_user_id`), é resposta pelo celular: etiqueta `celular` e, uma vez por conversa, a nota interna pedindo para registrar quem respondeu. Junta as mensagens que chegam em sequência (`DEBOUNCE_MS`, padrão 2,5 segundos).
- Em `conversation_resolved` de uma conversa com a etiqueta `robo-passou`, com `learning` ligado, pede o histórico ao projeto e manda sugestões de conhecimento (contexto.md). Conversa de grupo fica de fora.
- Numa conversa de grupo (o contato tem o identificador `<id>@g.us`), abre a conversa pendente para a equipe sem escrever nada, com a etiqueta `grupo` e o time de `groups.team_id`. No modo `chamado`, responde só à mensagem que traz uma das `call_words` depois do nome de quem escreveu, sem consultas e com as regras do grupo na parte variável do prompt.
- Chama o Chatwoot com o token do robô da conta, pela rede interna (`CHATWOOT_URL`).
- Registra em log só identificadores, tempos e códigos, nunca conteúdo, telefone ou nome.

## Projeto e Chatwoot (`base/server/provision.mjs`)

| Função | O que faz |
|---|---|
| `provisionAccount` | conta, funções, conta de serviço administradora, robô da conta, as etiquetas `robo-passou`, `grupo` e `celular` (o painel só mostra etiqueta que existe na conta) o nome "Celular do WhatsApp" na pessoa de repasse de quem implantou antes e a resolução automática das conversas paradas (`autoResolveHours`, 8 por padrão); devolve o estado para gravar |
| `ensureStaffUser` | pessoa da equipe como atendente, membro de todas as caixas do WhatsApp, com as preferências do painel e, na primeira vez, o filtro de todas as conversas; recusa o e-mail de quem administra outra conta, como o super administrador (`staff_email_is_admin`) |
| `removeStaffUser` | tira a pessoa da conta e do estado, sem apagá-la do Chatwoot; nunca a conta de serviço nem a de repasse |
| `syncStaff` | confere a equipe da conta com a lista do projeto: tira quem o kit pôs e saiu da lista e aponta quem o kit não conhece; lista vazia não tira ninguém sem `allowEmpty` |
| `ssoUrl` | o link de entrada já logado (5 minutos, uso único) |
| `connectCloudApi` | caixa WhatsApp Cloud, robô, equipe; devolve o retorno para a Meta |
| `connectOpenWA` | caixa API, repasse, webhook, adaptador, sessão, instância, adaptador ligado e saudável (`startAdapter`), robô |
| `updateCloudApi` | troca o token de uma caixa oficial que já existe, mantendo o token de verificação do retorno |
| `whatsappStatus` | estado da sessão do OpenWA, o que a conferência acha dele e o QR; com o OpenWA fora do ar, devolve `unknown` com o achado em vez de lançar |
| `reconnectOpenWA` | retoma a sessão que a caixa já tem, sem criar outra; `session_missing` quando ela não existe mais |
| `syncOpenWAGroups` | liga ou desliga o repasse dos grupos (`relay`) no adaptador de cada caixa não oficial e dá aos grupos do painel o nome do WhatsApp; devolve `{ sessions, changed, renamed, unread }` |
| `saveTeamGroup` | cria ou muda um grupo da equipe (caixa interna, conversa, membros, participantes, etiquetas); devolve `{ state, missing }`, com quem ficou fora por não estar na equipe do painel |
| `archiveTeamGroup` | tira todos do grupo e guarda o histórico |
| `syncTeamGroups` | reabre o grupo que a resolução automática fechou e tira da lista quem saiu da equipe; devolve `{ state, reopened, pruned }` |
| `ensureDashboardApp` | página do projeto como aba da conversa |
| `conversationHistory` | o histórico para a rota `history` |

O estado de cada cliente (`SupportState` em `provision.d.mts`) tem tokens: grave cifrado e nunca em log. Todas as funções podem rodar de novo sem duplicar o que já existe, menos `connectCloudApi` e `connectOpenWA`, que criam uma caixa nova a cada chamada. Para o mesmo número, use `updateCloudApi` ou `reconnectOpenWA`; o modelo `connectWhatsapp` já escolhe pelo telefone.

## Conferência do número (`base/server/health.mjs`)

| Função | O que faz |
|---|---|
| `checkWhatsappHealth` | confere o número atual (`currentInbox`) e devolve `{ checked_at, level, inboxes: [{ inbox_id, route, phone, level, findings }] }`; não lança: serviço fora do ar vira achado |
| `classifySession` | os estados e as restrições de uma sessão do OpenWA, em achados |
| `classifyCloudHealth` | a saúde da caixa no Chatwoot, ou o erro dela, em achados |
| `healthAlerts` | compara com a memória (`state.health`) e devolve `{ alerts, health }`: avisa na mudança e na volta, lembra uma vez por dia enquanto estiver fora |

Um achado é `{ level, code, detail, fix, fixBy }`. Um aviso traz `title` e `text` prontos para enviar, sem segredo, além de `kind` (`novo`, `lembrete` ou `voltou`), `level`, `since`, `fixBy` e os achados.

O modelo também traz `syncWhatsappGroups(tenantId)` (grupos do WhatsApp, whatsapp.md), que roda ao salvar a configuração do robô e deve rodar na mesma rotina de `checkWhatsapp`.

No modelo `next/lib/atendimento.ts`, `checkWhatsapp(tenantId)` junta as duas coisas: confere, chama `store.alertWhatsapp` e só então grava a memória. Assim, se o canal do aviso falhar, o aviso volta na próxima conferência. A memória só muda quando algo muda, e a rotina não grava o estado a cada 15 minutos. Com mais de uma réplica do servidor, rode a rotina em uma só: duas ao mesmo tempo mandam o aviso duas vezes.

## Grupos da equipe no modelo (`next/lib/atendimento.ts`)

`teamGroups`, `saveTeamGroupFor` e `archiveTeamGroupFor` atendem a rota `grupos` e a tela `GruposEquipe`; quem usa é o superadmin no modelo `plataforma` e quem administra o cliente no `por-cliente`. Só entra num grupo quem está em `store.teamPeople`, as mesmas pessoas de `listPanelPeople`, com nome e e-mail; quem ainda não entrou no painel entra na equipe do Chatwoot nessa hora. `syncTeamGroupsFor(tenantId)` roda na mesma rotina de `checkWhatsapp`.

## Variáveis do servidor do projeto

`CHATWOOT_URL` (o Chatwoot que o servidor alcança), `CHATWOOT_PUBLIC_URL` (https público), `CHATWOOT_PLATFORM_TOKEN`, `SUPPORT_BOT_PUBLIC_URL` (`https://atendimento.<domínio>/robo/chatwoot`), `SUPPORT_BOT_SECRET`, `SUPPORT_SERVICE_EMAIL_DOMAIN` e, na rota não oficial, `OPENWA_URL`, `OPENWA_PUBLIC_URL` e `OPENWA_API_KEY`. Para `kit.mjs verify`, também `PROJECT_URL` e `PROJECT_ORIGIN`.
