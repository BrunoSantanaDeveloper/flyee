# Análise de vídeo para outros apps

Este guia é para a IA que está executando outro app do flyee.club e precisa entender um vídeo: uma referência de edição, uma aula, um concorrente, o próprio material do integrante. Use este app em vez de analisar só a transcrição: ele vê a imagem e mede cortes e silêncios.

Versão da interface: **1**. Os comandos partem da raiz do projeto (a pasta que contém `.flyee/`) e todos aceitam `--json`.

```
node .flyee/modules/video-analysis/scripts/video.mjs <comando> [opções] --json
```

## 1. O app está instalado?

Se `.flyee/modules/video-analysis/scripts/video.mjs` não existir, diga ao integrante numa frase simples que vai instalar o app e o que ele faz ("Vou instalar o app Análise de vídeo, que assiste ao vídeo e descreve o que aparece e o que é dito") e rode você mesmo `npx --yes flyee@latest add video-analysis --yes --json`, com tempo limite de 10 minutos, sem esperar resposta. Se a instalação falhar, ou se o integrante pedir para não instalar, siga o seu app sem ela, com o que houver (por exemplo, a descrição que o integrante der).

Se existir, rode uma vez por sessão:

```
node .flyee/modules/video-analysis/scripts/video.mjs check --json
```

| Campo | O que diz |
|---|---|
| `interface_version` | a versão da interface instalada; este guia vem junto com o script e descreve sempre a mesma versão |
| `modes.local.files` | o ffmpeg existe: dá para analisar arquivos locais sem chave |
| `modes.local.web` | ffmpeg e yt-dlp existem: dá para analisar endereços sem chave |
| `gemini_key` | a chave do Gemini foi encontrada (o valor nunca aparece) |
| `gemini_key_from` | onde: `flyee` (salva pela página da chave, no navegador) ou `environment` (a variável de ambiente, que tem prioridade) |
| `gemini_setup` | sem a chave: `key_url` (onde criar), `command` (`npx --yes flyee@latest key set GEMINI_API_KEY --browser --json`, que você roda: volta na hora e abre uma página no navegador do integrante para ele colar a chave), `how` e `after` |
| `install` | os comandos `npx --yes flyee@latest need …` que instalam o que falta; rode-os você mesmo, com tempo limite longo (até 10 minutos), depois de avisar o integrante |

O integrante não usa o terminal: os programas, você instala com os comandos de `install`; a chave, ele cola numa página que `npx --yes flyee@latest key set GEMINI_API_KEY --browser --json` abre no navegador dele, e este app a lê sozinho. Ela nunca passa pela conversa nem pelo seu app. Nunca peça a chave em texto e nunca abra `~/.flyee/keys.json`.

## 2. Pedir a análise

```
node .flyee/modules/video-analysis/scripts/video.mjs analyze <vídeo> --focus editing --name <seu-app> --json
```

`<vídeo>` é um endereço do YouTube (`watch`, `youtu.be`, `shorts`, `live`), o endereço de outro site de vídeo ou o caminho de um arquivo local. O `id` de uma análise já feita também serve, por exemplo para uma pergunta nova com `--question`.

| Opção | Para quê |
|---|---|
| `--focus general\|editing\|content` | o que observar: descrição geral, técnica de edição, conhecimento da tela (slides, código) |
| `--instructions <arquivo.md>` | um arquivo do seu app com o que mais observar; entra no pedido ao Gemini e nos guias do modo local |
| `--name <rótulo>` | nome do arquivo da descrição; use o slug do seu app para não colidir com outros |
| `--question "texto"` | uma pergunta; a resposta vem na seção "Resposta", com tempos |
| `--start <tempo> --end <tempo>` | só um trecho (`90`, `1:30`, `01:02:03`, `1m30s`) |
| `--mode auto\|local\|gemini\|both` | quem assiste; `auto` escolhe sozinho (abaixo) |
| `--density low\|normal\|high` ou `--max-frames N` | quantos frames no modo local (24, 48, 96; de 4 a 300) |
| `--threshold <n>` | sensibilidade a cortes, de 0.05 a 0.9 (padrão 0.3; menor encontra mais) |
| `--lang pt-BR\|en` | idioma da descrição (padrão: o do projeto) |
| `--allow-upload` | autoriza enviar um arquivo local ao Gemini; **só depois de o integrante concordar** |
| `--keep-video` | mantém o vídeo baixado na pasta da análise |
| `--refresh` | refaz em vez de reaproveitar |

O modo `auto`: vídeo do YouTube com chave → Gemini (lê o vídeo público sem baixar); arquivo local com chave e `--allow-upload` → Gemini; senão, local, se o ffmpeg (e, para endereços, o yt-dlp) existir. Se o Gemini falhar por limite, instabilidade ou vídeo inacessível e o modo local for possível, o app segue no local e avisa em `warnings`. `both` faz os dois: as medições locais (cortes exatos) entram no pedido ao Gemini.

## 3. Ler a resposta

| Campo | O que é |
|---|---|
| `ok` | `true`; em erro é `false` e vem `error` (seção 6) |
| `id` | id estável do vídeo: `yt-<id>`, `url-<site>-<hash>`, `file-<nome>-<hash>` |
| `dir` | pasta da análise, a partir da raiz do projeto |
| `video` | `title`, `duration_s`, `source` |
| `mode` | `gemini`, `local` ou `both` (o que de fato rodou) |
| `ready` | a descrição existe e pode ser lida |
| `cached` | a descrição já existia e foi reaproveitada |
| `description` | caminho da descrição quando `ready` |
| `files` | `analysis` (dados medidos), `index` (roteiro de leitura), `transcript`, `grids` |
| `next_step` | quando `ready` é `false`: o que a IA precisa fazer (abaixo) |
| `gemini` | modelo e tokens usados, quando o Gemini rodou |
| `warnings` | avisos para repassar ao integrante quando importarem |

**`ready: true`** → leia o arquivo de `description` e siga o seu app.

**`ready: false`** → o modo local preparou o vídeo, e quem assiste é você. Faça exatamente:

1. Leia `next_step.read` (o roteiro de leitura) e os guias de `next_step.guides`.
2. Abra todas as imagens de `next_step.grids`, na ordem. Cada quadrinho traz o número do frame e o tempo.
3. Precisa de detalhe? Abra o frame individual listado no roteiro, ou extraia outro instante (seção 5).
4. Grave `next_step.write` começando pelo texto de `next_step.header`, no formato de `description-format.md`.

A descrição gravada fica no cache: o próximo `analyze` com o mesmo vídeo e o mesmo `--name` devolve `ready: true` na hora, para qualquer app.

## 4. A pasta da análise

```
video-analyses/<id>/
├── analysis.json            dados medidos (formato versionado)
├── index.md                 roteiro de leitura do modo local
├── transcript.md            fala com tempos, quando há legenda
├── descriptions/<nome>.md   as descrições (o cabeçalho diz foco, modo, trecho e idioma)
├── gemini/<nome>.json       resposta bruta do Gemini
└── media/                   frames, grades e extras (fora do git)
```

`analysis.json`, com tempos em segundos e caminhos relativos à pasta da análise:

| Campo | Conteúdo |
|---|---|
| `format_version` | `1` |
| `source` | `type` (`youtube`, `url`, `file`), `input`, `url`, `file` |
| `metadata` | `title`, `channel`, `published_at`, `duration_s`, `views`, `likes`, `language`, `availability`, `chapters[]`, `most_replayed[]`, `width`, `height`, `fps`, `has_audio` |
| `transcript` | `origin` (`manual`, `auto`, `sidecar`), `language`, `segments[]` com `start_s`, `end_s`, `text` |
| `preparation` | `window` (`start_s`, `end_s`): o trecho que os campos abaixo descrevem; `params`; `grid_labels` |
| `cuts_s` | os cortes medidos, em segundos |
| `shots[]` | `n`, `start_s`, `end_s`, `frames[]`, `same_as_frame` quando o plano repete uma imagem anterior |
| `frames[]` | `n`, `time_s`, `file`, `grid`, `position`, `shot` |
| `grids[]` | `n`, `file`, `columns`, `rows`, `frames[]` |
| `silences[]` | `start_s`, `end_s` |
| `descriptions[]` | `name`, `file`, `focus`, `mode`, `window`, `question`, `generated_at` |

`cuts_s`, `shots`, `frames`, `grids` e `silences` descrevem a última preparação local, que pode ter sido de um trecho: confira `preparation.window` antes de usar os números.

Quando o seu app precisa só dos números (ritmo de cortes, duração dos planos, silêncios) e não de uma descrição, use `prepare`: faz a parte local e devolve `files` e `measurements`, sem `next_step`. Sem `--start` e `--end`, os números são do vídeo inteiro.

```
node .flyee/modules/video-analysis/scripts/video.mjs prepare <vídeo> --json
```

## 5. Outros comandos

| Comando | Devolve |
|---|---|
| `frame <vídeo ou id> <tempo> [tempo…]` | `frames[]` com `time`, `time_s` e `file`: imagens em até 1920 px nos instantes pedidos |
| `show <vídeo ou id>` | `files`, `descriptions[]` e `measurements` de uma análise |
| `list` | `analyses[]`: todas as análises do projeto |

## 6. Erros

Em erro, `ok` é `false`, a saída termina com código 1 (2 para uso errado) e vem `error` com `code`, `message` e `fix`. Mostre `message` e `fix` ao integrante; decida pelo `code`.

| `code` | O que fazer |
|---|---|
| `tools_missing` | rode você mesmo os comandos de `fix` e repita |
| `no_gemini_key` | repita com `--mode local`, ou mostre ao integrante o passo a passo de `fix` (o mesmo de `gemini_setup`) para ele salvar a chave |
| `upload_consent_required` | pergunte se pode enviar o arquivo ao Google; com o sim, repita com `--allow-upload`; sem, use `--mode local` |
| `youtube_blocked`, `no_formats`, `rate_limited` | o YouTube recusou o download: tente o modo Gemini, ou peça o arquivo ao integrante |
| `private_video`, `members_only`, `age_restricted`, `video_unavailable`, `live_video`, `playlist_not_supported`, `unsupported_url` | o vídeo não pode ser aberto assim; repasse `fix` |
| `gemini_quota`, `gemini_unavailable`, `gemini_too_long`, `gemini_video_inaccessible`, `gemini_refused`, `gemini_invalid_key`, `gemini_permission`, `gemini_model_not_found` | repasse `fix`; quando possível, repita com `--mode local` |
| `file_not_found`, `file_too_large`, `unreadable_video`, `no_video_track` | confira o arquivo com o integrante |
| `in_progress` | outro comando está analisando o mesmo vídeo; espere e repita |
| `ffmpeg_failed`, `download_failed`, `offline`, `unexpected` | repasse `message` e `fix` |
| `tool_timeout` | o ffmpeg, o ffprobe ou o yt-dlp travou e o app o encerrou ao passar do tempo limite, que é folgado e cresce com a duração do vídeo (o download tem o mais longo; `message` diz qual programa e quanto tempo): tente de novo uma vez; se travar de novo, reduza o trabalho com um trecho mais curto (`--start` e `--end`), menos frames (`--max-frames`) ou, no download, `--quality 480` |
| `usage` | uma opção errada: corrija o comando |

## 7. O que não muda

Dentro da interface 1, comandos, opções, campos e códigos deste guia continuam valendo; campos novos podem aparecer. Uma mudança que quebre algo vira interface 2 e uma versão maior do app.

## 8. Exemplo: um app de edição analisando uma referência

O app de edição guarda em `.flyee/modules/<app-de-edicao>/references/referencia.md` o que quer saber (ritmo, legendas, música) e roda:

```
node .flyee/modules/video-analysis/scripts/video.mjs analyze https://www.youtube.com/watch?v=XXXXXXXXXXX --focus editing --instructions .flyee/modules/<app-de-edicao>/references/referencia.md --name app-de-edicao --json
```

Com `ready: true`, lê a descrição; com `ready: false`, segue o `next_step` e depois lê. Para números exatos de ritmo, lê `cuts_s` e `shots` em `analysis.json`.
