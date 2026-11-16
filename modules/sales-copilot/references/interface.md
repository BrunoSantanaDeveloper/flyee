# Leitura de call para outros apps

Este guia é para a IA que está executando outro app do flyee.club e precisa da leitura de uma call de vendas: as etapas, as objeções, o que faltou no roteiro e o sinal fala a fala.

Versão da interface: **1**. Os comandos partem da raiz do projeto (a pasta que contém `.flyee/`) e todos aceitam `--json`.

```
node .flyee/modules/sales-copilot/scripts/copilot.mjs <comando> [opções] --json
```

## 1. O app está instalado?

Se `.flyee/modules/sales-copilot/scripts/copilot.mjs` não existir, diga ao integrante numa frase simples que vai instalar o app e o que ele faz ("Vou instalar o app Copiloto de vendas, que lê uma call fala por fala") e rode você mesmo `npx --yes flyee@latest add sales-copilot --yes --json`, com tempo limite de 10 minutos, sem esperar resposta. Se a instalação falhar, ou se o integrante pedir para não instalar, siga o seu app sem a leitura e diga o que fica de fora.

Se existir, rode uma vez por sessão `check --json`:

| Campo | O que diz |
|---|---|
| `interface_version` | a versão da interface instalada |
| `playbook.from` | `project` quando o negócio tem o próprio playbook; `model` quando vale o modelo do app |
| `modes.live` | a chave do OpenRouter existe e a call ao vivo pode abrir |
| `gemini_key`, `live_audio` | quem transcreve o áudio da call ao vivo: `gemini`, `openrouter` ou nulo |
| `calls` | quantas calls este projeto já tem |

## 2. Pedir a leitura de uma transcrição

```
node .flyee/modules/sales-copilot/scripts/copilot.mjs call new <arquivo> --seller "<nome>" --name <rótulo> --json
```

`<arquivo>` é a transcrição: texto com "Nome: fala" por linha, legenda (`.vtt`, `.srt`) ou JSON com `speaker` e `text`. Sem `--seller`, quando os nomes não dizem o papel, a resposta traz `created: false`, `needs: "seller"` e `speakers`: descubra quem vende ou pergunte ao integrante, e repita.

Depois, até `done: true`:

1. `call questions <id> --json` devolve `guide` (o arquivo com as perguntas e o que conta como sim e como não), `batch` (as falas a responder), `format` e `write`.
2. Você grava as respostas em `write` e roda `call answer <id> --file <write> --json`.

Quem responde é a IA que executa o seu app, só com valores. O sinal e os avisos são calculados pelo script.

## 3. Ler o resultado

A resposta final (de `call answer` com `done: true`, ou de `call report <id>`) traz:

| Campo | O que é |
|---|---|
| `id` | o id da call; `last` serve para a mais recente |
| `signal` | o sinal final, de 0 a 100 |
| `coverage` | `turns`, `judged`, `short` (curtas demais para ler), `not_judged` |
| `pending` | os itens do roteiro que faltaram, cada um com `step`, `label` e `ask` |
| `notes` | os avisos calculados, em texto |
| `files.reading` | o caminho de `leitura.json` |
| `files.report` | o documento do integrante |
| `say`, `decisions` | as três linhas para o chat e o que cabe ao integrante decidir |

`leitura.json`, com `format_version: 1`:

| Campo | Conteúdo |
|---|---|
| `weights` | `from` (`app` ou `project`), `label`, `source`, `checked_on` |
| `summary.signal` | `final`, `start`, `min`, `max`, `curve[]` (um valor por fala) |
| `summary.stages[]` | `stage`, `label`, `from_turn`, `t` |
| `summary.facts[]` | `id`, `label`, `at_turn` (nulo quando o fato não apareceu) |
| `summary.roadmap[]` | `title`, `goal`, `checks[]` com `label`, `done`, `at_turn`, `ask` |
| `summary.objections[]` | `kind`, `label`, `opened_at`, `text`, `closed_at`, `how` (`resolved`, `left`, `open`) |
| `summary.talk` | `seller_share`, `seller_words`, `client_words`, `open_questions`, `monologues[]` |
| `summary.drops[]`, `summary.rises[]` | as falas que mais pesaram: `i`, `speaker`, `text`, `points`, `movers[]`, `move` |
| `summary.notes[]` | `code`, `text`, `at_turn` |
| `steps[]` | por fala: `i`, `judged`, `signal`, `stage`, `move`, `line`, `movers[]`, `objection`, `talk_share`, `flags[]` |

Os códigos de `summary.notes[].code`: `price_before_impact`, `objection_left`, `no_next_step`, `decider_unknown`, `seller_talked_most`, `monologues`.

O sinal é uma regra de bolso com os pesos de `weights`. O seu app o repassa com esse rótulo e nunca como previsão de venda.

## 4. Outros comandos

| Comando | Devolve |
|---|---|
| `call list` | `calls[]` com `id`, `name`, `mode` (`review`, `practice`, `live`), `date`, `turns`, `signal`, `outcome` |
| `call outcome <id> won\|lost` | grava o resultado que o integrante informou |
| `summary` | `comparison`: o sinal médio das calls que fecharam e das que não, com `confidence` (`indício` abaixo da amostra mínima) e `text` |
| `playbook check` | `moves[]`, `problems[]`, `questions[]`, `ready` |

## 5. Erros

Em erro, `ok` é `false`, a saída termina com código 1 (2 para uso errado) e vem `error` com `code`, `message` e `fix`.

| `code` | O que fazer |
|---|---|
| `file_not_found`, `invalid_json` | confira o arquivo |
| `no_speakers` | a transcrição não diz quem falou: grave um texto com "Nome: fala" por linha |
| `unknown_speaker`, `no_client` | o nome do vendedor não bate com a transcrição: use um dos nomes de `fix` |
| `invalid_answer` | `message` começa com o caminho do campo errado: corrija só ele |
| `invalid_playbook`, `invalid_weights` | o arquivo do projeto tem um problema: repasse `message` e `fix` |
| `call_not_found` | rode `call list` |
| `usage` | uma opção errada: corrija o comando |

## 6. O que não muda

Dentro da interface 1, comandos, opções, campos e códigos deste guia continuam valendo; campos novos podem aparecer. Uma mudança que quebre algo vira interface 2 e uma versão maior do app.
