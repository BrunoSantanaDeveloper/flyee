# Pesquisa no YouTube para outros apps

Este guia é para a IA que está executando outro app do flyee.club e precisa de dados do YouTube: o que performa acima do normal num tema, o normal de um canal, a fala de um vídeo ou o que o público pergunta nos comentários. Tudo é público e lido sem chave, pelo yt-dlp.

Versão da interface: **1**. Os comandos partem da raiz do projeto (a pasta que contém `.flyee/`) e todos aceitam `--json`. O progresso sai no stderr; o stdout tem só o JSON.

```
node .flyee/modules/youtube-research/scripts/research.mjs <comando> [opções] --json
```

## 1. O app está instalado?

Se `.flyee/modules/youtube-research/scripts/research.mjs` não existir, diga ao integrante que os dados vêm do app Pesquisa no YouTube (`npx flyee add youtube-research`) e siga o seu app sem eles, dizendo o que fica de fora (por exemplo: "a pauta sai sem a prova de demanda").

Se existir, rode uma vez por sessão:

```
node .flyee/modules/youtube-research/scripts/research.mjs check --json
```

| Campo | O que diz |
|---|---|
| `interface_version` | a versão da interface instalada |
| `ready` | o yt-dlp existe e a pesquisa funciona |
| `tools["yt-dlp"]` | a versão do yt-dlp |
| `install` | sem o yt-dlp: o comando `npx flyee need yt-dlp --yes --json`, que você roda, com tempo limite longo, depois de avisar o integrante |
| `update_ytdlp` | o comando que atualiza o yt-dlp quando o YouTube passa a recusar |

## 2. Outliers de um tema

```
node .flyee/modules/youtube-research/scripts/research.mjs outliers "busca 1" "busca 2" "busca 3" --name <seu-app>-<tema> --json
```

De 1 a 8 buscas; use de 3 a 6 variações do tema. Leva de 1 a 10 minutos, conforme as buscas e os canais a medir: avise o integrante antes e rode com um tempo limite longo.

| Opção | Para quê |
|---|---|
| `--window week\|month\|year\|all` | janela de publicação (padrão `year`; tema de tendência: `month`) |
| `--format long\|short\|any` | vídeos longos, Shorts (até 3 min) ou todos (padrão `long`) |
| `--per-query N` | vídeos por busca, de 5 a 100 (padrão 40) |
| `--max-channels N` | canais medidos pelos últimos envios (padrão 60) |
| `--details N` | vídeos do topo com data, curtidas, comentários e inscritos (padrão 15) |
| `--min-views N` | ignora vídeos abaixo disso (padrão 500) |
| `--sort relevance\|views\|date` | ordem da busca no YouTube (padrão `relevance`) |
| `--rank index\|multiplier\|velocity\|views` | ordem do resultado (padrão `index`) |
| `--lang pt\|en\|…` | idioma dos vídeos (padrão: o do projeto); a busca do YouTube mistura idiomas e o app deixa só este |
| `--any-language` | mantém os vídeos de todos os idiomas |
| `--name <nome>` | nome da pasta do resultado; use o slug do seu app no começo |
| `--refresh` | ignora o que já foi lido (os canais ficam guardados por 7 dias, os vídeos por 1) |

Resposta:

| Campo | O que é |
|---|---|
| `id`, `dir` | o nome e a pasta da pesquisa (`youtube-research/outliers/<id>/`) |
| `files` | `md` (o relatório para ler), `json` (tudo), `csv` (planilha), `raw` (a coleta bruta) |
| `sample` | `collected`, `kept`, `other_language`, `channels`, `channels_measured`, `detailed`, `by_base`, `by_band` |
| `top[]` | os 10 primeiros: `id`, `title`, `channel`, `views`, `multiplier`, `band`, `base`, `views_per_day`, `published_at`, `flags`, `url` |
| `warnings` | ressalvas para repassar: amostra pequena, canais sem medição, vídeos de outros idiomas, buscas que falharam |

Cada item de `outliers.json` → `items[]` traz ainda `queries` (as buscas que o acharam), `duration_s`, `likes`, `comments`, `subscribers`, `engagement`, `index`, `confidence`, `base` (`kind`, `value`), `detailed`, `has_captions`, `most_replayed` (os trechos mais revistos, em segundos) e `chapters` (quantos capítulos). As métricas, faixas e avisos estão em `metodologia.md`, nesta mesma pasta: leia antes de interpretar.

## 3. Um canal

```
node .flyee/modules/youtube-research/scripts/research.mjs channel <@canal | endereço do canal | endereço de um vídeo dele> --json
```

`--tab videos|shorts` (padrão `videos`) e `--limit N` (padrão 30). Devolve `channel` (`id`, `name`, `handle`, `url`, `subscribers`, `latest_published_at`), `median_views` (o normal do canal), `items[]` do mais novo ao mais antigo (`id`, `title`, `views`, `duration_s`, `multiplier`, `band`, `url`), `top[]` (os 5 mais acima do normal) e `files`. As views da aba vêm arredondadas pelo YouTube (`views_rounded: true`).

Serve para medir o canal do próprio integrante e escolher quais vídeos dele transcrever.

## 4. Vídeos: dados, fala e comentários

Os três aceitam de 1 a 20 vídeos (endereço ou id de 11 caracteres) e devolvem `items[]`, um por vídeo, cada um com `ok`. Um vídeo que falha traz `ok: false` e `error`, sem derrubar os outros.

| Comando | Cada item traz |
|---|---|
| `video <vídeo>…` | `video`: `title`, `channel`, `channel_id`, `subscribers`, `published_at`, `age_days`, `duration_s`, `is_short`, `views`, `likes`, `comments`, `language`, `captions`, `chapters[]`, `most_replayed[]`, `tags[]`, `description` |
| `transcript <vídeo>…` | `language`, `origin` (`manual` ou `auto`), `words`, `speech_s`, `words_per_minute`, `files.md` (a fala com tempos), `files.json` (`segments[]` com `start_s`, `end_s`, `text`) |
| `comments <vídeo>… [--max N] [--sort top\|new]` | `count`, `files.md`, `files.json` (`comments[]` com `text`, `likes`, `pinned`, `by_creator`, `when`; sem o nome de quem escreveu) |

`transcript` lê só a legenda (a escrita pelo canal, senão a automática do YouTube), sem baixar o vídeo. `words_per_minute` é o ritmo real de fala daquele criador. Para ouvir um vídeo sem legenda ou ver a imagem, use o app Análise de vídeo.

Tudo fica em `youtube-research/videos/<id>/` e é reaproveitado: a transcrição sempre, os comentários por 7 dias, os dados por 1 dia.

## 5. Traços de título

```
node .flyee/modules/youtube-research/scripts/research.mjs titles <id da pesquisa de outliers> --tools "Nome A,Nome B" --json
```

Mede, nos títulos de uma pesquisa de `outliers`, cada traço contra o multiplicador: a mediana dos títulos que têm o traço e a dos que não têm, com o tamanho de cada grupo. Grava `titulos.md` e `titulos.json` na pasta da pesquisa.

| Opção | Para quê |
|---|---|
| `--tools "A,B"` | os nomes de ferramentas, produtos ou marcas do tema; sem ela, o traço "ferramenta" fica de fora e `suggested_tools` mostra os nomes que aparecem nos títulos, para você confirmar |
| `--min-n N` | o tamanho mínimo de grupo (padrão 5); abaixo dele, `small_n: true` |
| `--base any\|channel` | `channel` usa só os vídeos medidos pela mediana do próprio canal (padrão `any`) |
| `--exclude id,id` | os vídeos fora do tema (os `id` de `outliers.json`): a busca pega palavras com outro sentido e nichos vizinhos, e eles distorcem os traços. Saem da conta e voltam em `excluded` |

Cada rodada grava `titulos.md` e `titulos.json` por cima da anterior.

Resposta: `sample` (`items`, `measured`, `base`), `traits[]` (`trait`, `label`, `with` e `without` com `n` e `median`, `ratio`, `small_n`; ou `skipped` e `note`), `length` (`median_all`, `median_outliers`, `outliers_n`, `buckets[]` com `range`, `n`, `median`), `suggested_tools[]` (`name`, `titles`), `files` e `warnings`.

Os traços: `number` (número), `tool` (ferramenta ou marca), `brackets` (parênteses ou colchetes), `starts_how` (começa com "Como"), `question` (pergunta), `first_person` (primeira pessoa), `without` ("sem X"), `concrete_result` (dinheiro, tempo, número com unidade), `caps_word` (uma palavra em caixa alta).

O dado é desta amostra: mostra o que anda junto com os títulos que foram bem, nunca a causa. Ao usar, cite o traço e o número ("os títulos com o nome da ferramenta tiveram mediana de 1,9× contra 1,0×, n=40 e 84"). Grupo pequeno é indício.

## 6. O que já existe

`list --json` devolve `outliers[]`, `channels[]` e `videos[]` já pesquisados neste projeto.

## 7. Erros

Em erro do comando, `ok` é `false`, a saída termina com código 1 (2 para uso errado) e vem `error` com `code`, `message` e `fix`. Mostre `message` e `fix` ao integrante; decida pelo `code`.

| `code` | O que fazer |
|---|---|
| `tools_missing` | rode você mesmo o comando de `fix` (tempo limite longo) e repita |
| `youtube_blocked`, `rate_limited` | o YouTube recusou por um tempo: rode `update_ytdlp`, espere alguns minutos, repita com menos buscas, canais ou vídeos |
| `no_captions` | o YouTube não entregou a legenda (ou o vídeo não tem); diga ao integrante numa frase e ofereça três caminhos: ele colar a transcrição num arquivo, o app Análise de vídeo ler imagem e som, ou seguir sem aquele vídeo |

Quando a leitura de um vídeo falha, nunca tente outro caminho por conta própria para o mesmo conteúdo (outro site, outra ferramenta, a página aberta no navegador). Diga o que falhou e deixe o integrante escolher entre os caminhos acima.
| `no_tab` | o canal não tem essa aba; use a outra |
| `not_youtube`, `not_found`, `video_unavailable`, `private_video`, `members_only`, `age_restricted` | o endereço não serve; repasse `fix` |
| `offline`, `ytdlp_failed`, `unexpected` | repasse `message` e `fix` |
| `usage` | uma opção errada: corrija o comando |

## 8. O que não muda

Dentro da interface 1, comandos, opções, campos e códigos deste guia continuam valendo; campos novos podem aparecer. Uma mudança que quebre algo vira interface 2 e uma versão maior do app.

## 9. Exemplo: um app de roteiro validando uma pauta

```
node .flyee/modules/youtube-research/scripts/research.mjs outliers "roteiro para youtube" "como prender a atenção no vídeo" "gancho de vídeo" --name roteiro-gancho --json
node .flyee/modules/youtube-research/scripts/research.mjs transcript <id do 1º outlier> <id do 2º> --json
node .flyee/modules/youtube-research/scripts/research.mjs comments <id do 1º outlier> --max 100 --json
```

O app lê `outliers.md`, extrai os padrões que se repetem em dois ou mais outliers, lê como os melhores abrem e se organizam pelas transcrições e procura nos comentários as dúvidas que nenhum deles respondeu.
