# Pesquisa no YouTube para outros apps

Este guia é para a IA que está executando outro app do flyee.club e precisa de dados do YouTube: o que performa acima do normal num tema, o normal de um canal, a fala de um vídeo ou o que o público pergunta nos comentários. Tudo é público e lido sem chave, pelo yt-dlp.

Versão da interface: **1**. Os comandos partem da raiz do projeto (a pasta que contém `.flyee/`) e todos aceitam `--json`. O progresso sai no stderr; o stdout tem só o JSON.

```
node .flyee/modules/youtube-research/scripts/research.mjs <comando> [opções] --json
```

## 1. O app está instalado?

Se `.flyee/modules/youtube-research/scripts/research.mjs` não existir, diga ao integrante numa frase simples que vai instalar o app e o que ele faz ("Vou instalar o app Pesquisa no YouTube, que mostra quais vídeos do tema passaram do normal do canal") e rode você mesmo `npx --yes flyee@latest add youtube-research --yes --json`, com tempo limite de 10 minutos, sem esperar resposta. Se a instalação falhar, ou se o integrante pedir para não instalar, siga o seu app sem esses dados, dizendo o que fica de fora (por exemplo: "a pauta sai sem a prova de demanda").

Se existir, rode uma vez por sessão:

```
node .flyee/modules/youtube-research/scripts/research.mjs check --json
```

| Campo | O que diz |
|---|---|
| `interface_version` | a versão da interface instalada |
| `ready` | o yt-dlp existe e a pesquisa funciona |
| `tools["yt-dlp"]` | a versão do yt-dlp |
| `install` | sem o yt-dlp: o comando `npx --yes flyee@latest need yt-dlp --yes --json`, que você roda com tempo limite de 10 minutos, depois de avisar o integrante |
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

## 5. Títulos de alta performance

```
node .flyee/modules/youtube-research/scripts/research.mjs titles <id da pesquisa de outliers> --tools "Nome A,Nome B" --json
node .flyee/modules/youtube-research/scripts/research.mjs titles --channel <@canal> --json
```

Analisa os títulos de uma pesquisa de `outliers`, ou os envios de um canal já lido por `channel`:
- **a lista:** os títulos que mais passaram do normal e os que ficaram abaixo dele, cada um com os traços que tem;
- **os traços:** a mediana do multiplicador dos títulos que têm cada um e a dos que não têm, com o tamanho de cada grupo;
- **as palavras:** o mesmo para as palavras e pares de palavras que se repetem.

Grava `titulos.md` e `titulos.json` na pasta da pesquisa ou do canal. Cada rodada grava por cima da anterior.

Com `--channel`, o multiplicador de cada vídeo é contra o normal daquele canal: mostra o que o público do canal já respondeu, não o tema. As views da aba vêm arredondadas pelo YouTube, e com uns 30 vídeos quase todo grupo é pequeno.

| Opção | Para quê |
|---|---|
| `--channel <canal>` | mede os envios de um canal já lido: o `@` dele, a pasta que `channel` devolveu em `dir` ou o caminho do `channel.json`. Não vai junto com o id de uma pesquisa |
| `--tools "A,B"` | os nomes de ferramentas, produtos ou marcas do tema; sem ela, o traço "ferramenta" fica de fora e `suggested_tools` mostra os nomes que aparecem nos títulos, para você confirmar |
| `--min-n N` | o tamanho mínimo de grupo (padrão 5); abaixo dele, `small_n: true`. Uma palavra só entra em `terms` se aparecer em N títulos ou mais |
| `--base any\|channel` | `channel` usa só os vídeos medidos pela mediana do próprio canal (padrão `any`) |
| `--exclude id,id` | os vídeos fora do tema (os `id` de `outliers.json` ou de `channel.json`): a busca pega palavras com outro sentido e nichos vizinhos, e eles distorcem os traços. Saem da conta e voltam em `excluded` |
| `--top N` | quantos títulos acima do normal listar, de 5 a 50 (padrão 15) |

Resposta:

| Campo | O que é |
|---|---|
| `source` | `outliers` ou `channel` |
| `id`, `queries` | a pesquisa (com `--channel`, `null` e `[]`) |
| `channel`, `read_at` | com `--channel`: o canal (`name`, `handle`…) e quando foi lido |
| `sample` | `items`, `measured`, `base` |
| `traits[]` | `trait`, `label`, `group` (`gatilho` ou `forma`), `trigger` (o gatilho da embalagem, nos de `group` `gatilho`), `with` e `without` com `n` e `median`, `ratio`, `small_n`; ou `skipped` e `note` |
| `top_titles[]` | os títulos acima do normal (multiplicador maior que 1), do maior para o menor: `id`, `title`, `channel`, `multiplier`, `views`, `band`, `base` (`channel`, `sample`, `subscribers`), `traits` (as chaves dos traços que ele tem) |
| `bottom_titles[]` | os que ficaram abaixo do normal, do menor para cima, com os mesmos campos |
| `terms[]` | `term` (N é qualquer número), `with`, `without`, `ratio`, `small_n`, do maior `ratio` para o menor. As palavras das buscas ficam de fora |
| `length` | `median_all`, `median_outliers`, `outliers_n`, `buckets[]` com `range`, `n`, `median` |
| `suggested_tools[]` | `name`, `titles` |
| `excluded`, `files`, `warnings` | como nos outros comandos |

Os traços (as nove primeiras chaves vêm da primeira versão desta interface e não mudam):

| `trait` | O que procura | `trigger` |
|---|---|---|
| `number` | um número | |
| `tool` | um nome de `--tools` | |
| `brackets` | parênteses ou colchetes | |
| `starts_how` | começa com "Como" | |
| `question` | ponto de interrogação | |
| `first_person` | primeira pessoa ("eu", "testei", "fiz") | |
| `without` | "sem X" | |
| `concrete_result` | dinheiro, tempo, número com unidade | `resultado` |
| `caps_word` | uma palavra em caixa alta | |
| `gap` | "isso", "esse", "o segredo", "por que", "o X que" | `curiosidade` |
| `search` | "como", "passo a passo", "tutorial", "iniciantes" | `busca direta` |
| `contrarian` | "pare de", "não faça", "mito", "ninguém conta" | `contrário` |
| `mistake` | "erro", "evite", "perdendo", "jogando fora" | `custo ou erro` |
| `experiment` | "testei", "por 30 dias", "desafio" | `experimento ou história` |
| `list` | "5 dicas", "3 erros", "top 10" | `lista` |
| `comparison` | "vs", "X x Y", "melhor que", "qual escolher" | `comparação` |
| `you` | "você", "seu", "sua" | |
| `superlative` | "o melhor", "o pior", "mais fácil" | |
| `year` | um ano ("2026") | |
| `two_parts` | dois pontos, barra ou traço separando duas partes | |
| `emoji` | um emoji | |
| `stakes` | "apostei", "gastei R$", "quase perdi", "larguei o emprego" | `o que está em jogo` |
| `extreme` | dois valores em dinheiro, "barato x caro", "do mundo", "nível 100" | `extremo ou contraste` |
| `insider` | "por dentro", "bastidores", "o que o vendedor não mostra" | `bastidor` |
| `callout` | "se você", "para quem", "quem tem", "todo confeiteiro precisa" | `chamado direto` |
| `transformation` | "antes e depois", "de 2 para 9", "do zero a" | `transformação` |

Os gatilhos são o que um script consegue ver nas palavras: um título de curiosidade sem nenhuma dessas palavras não entra na conta. Leia a lista antes das tabelas: ela mostra o mecanismo que os números resumem.

O dado é desta amostra: mostra o que anda junto com os títulos que foram bem, nunca a causa. Ao usar, cite o traço ou a palavra e o número ("os títulos com o nome da ferramenta tiveram mediana de 1,9× contra 1,0×, n=40 e 84"). Grupo pequeno é indício. Com muitos traços e palavras medidos na mesma amostra, algum parece forte por acaso: vale mais o que se repete em duas leituras, como o tema e o canal.

## 6. Thumbnails

```
node .flyee/modules/youtube-research/scripts/research.mjs thumbnails <vídeo> <vídeo>… --json
node .flyee/modules/youtube-research/scripts/research.mjs thumbnails --channel <@canal> --limit 12 --json
```

Baixa a thumbnail de cada vídeo, de 1 a 20, ou dos envios mais recentes de um canal já lido por `channel` (`--limit` de 1 a 30, padrão 12), no maior tamanho que o YouTube tiver, para você olhar as imagens. Cada uma fica em `youtube-research/videos/<id>/thumbnail.jpg` e é reaproveitada por 7 dias (`--refresh` baixa de novo). Com `--channel`, grava também `thumbnails.md` na pasta do canal: as imagens lado a lado, com o multiplicador e o título de cada vídeo.

Resposta: `source` (`videos` ou `channel`), `channel` e `read_at` (com `--channel`), `items[]` e `files.md` (com `--channel`). Cada item traz `ok`, `id`, `file`, `quality` (`maxresdefault`, `hq720`, `sddefault` ou `hqdefault`), `width`, `height`, `letterboxed`, `url`, `cached` e, com `--channel`, `title`, `multiplier` e `band`. Um vídeo que falha traz `ok: false` e `error`, sem derrubar os outros.

- `letterboxed: true` é uma imagem 4:3 com faixas pretas em cima e embaixo: o YouTube não tem dela o tamanho grande. Ignore as faixas ao olhar.
- O multiplicador de `--channel` é o mesmo de `channel`: compare as thumbnails que passaram do normal do canal com as que ficaram abaixo.
- A leitura das imagens é sua, não do script: diga o que se repete (o rosto e a emoção, o texto, as cores, a composição) como observação, nunca como medida.

## 7. O que já existe

`list --json` devolve `outliers[]`, `channels[]` e `videos[]` já pesquisados neste projeto. Cada vídeo diz se tem `transcript`, `comments` e `thumbnail`.

## 8. Erros

Em erro do comando, `ok` é `false`, a saída termina com código 1 (2 para uso errado) e vem `error` com `code`, `message` e `fix`. Mostre `message` e `fix` ao integrante; decida pelo `code`.

| `code` | O que fazer |
|---|---|
| `tools_missing` | rode você mesmo o comando de `fix` (tempo limite de 10 minutos) e repita |
| `youtube_blocked`, `rate_limited` | o YouTube recusou por um tempo, inclusive na hora de entregar uma legenda: rode `update_ytdlp`, espere alguns minutos, repita com menos buscas, canais ou vídeos. Não diga que o vídeo não tem legenda |
| `no_captions` | o vídeo não tem legenda, nem a automática; diga ao integrante numa frase e ofereça três caminhos: ele colar a transcrição num arquivo, o app Análise de vídeo ler imagem e som, ou seguir sem aquele vídeo |
| `captions_unavailable` | o vídeo tem legenda, mas o YouTube não a entregou agora (ou ela veio vazia); espere alguns minutos e tente uma vez de novo; se repetir, ofereça os três caminhos de `no_captions` |
| `no_tab` | o canal não tem essa aba; use a outra |
| `tool_timeout` | o yt-dlp passou de 10 minutos numa chamada e foi interrompido: repita uma vez; se repetir, use menos buscas, canais ou vídeos, ou espere alguns minutos |
| `not_youtube`, `not_found`, `video_unavailable`, `private_video`, `members_only`, `age_restricted` | o endereço não serve; repasse `fix`. Em `thumbnails`, `not_found` é um vídeo sem thumbnail no YouTube |
| `offline`, `ytdlp_failed`, `unexpected` | repasse `message` e `fix`. Em `thumbnails`, `offline` é a imagem que não chegou: tente uma vez de novo |
| `usage` | uma opção errada: corrija o comando |

Quando a leitura de um vídeo falha, nunca tente outro caminho por conta própria para o mesmo conteúdo (outro site, outra ferramenta, a página aberta no navegador). Diga o que falhou e deixe o integrante escolher entre os caminhos da linha `no_captions`. O código `captions_unavailable` chegou na versão 1.0.1, dentro da interface 1; antes dela, o mesmo caso voltava como `no_captions`. O código `tool_timeout`, a opção `--channel` e os campos novos de `titles` chegaram na versão 1.1.0, também dentro da interface 1: com uma versão anterior instalada, `titles` não traz `top_titles`, `terms` nem os traços novos, e `npx --yes flyee@latest update youtube-research --yes --json` atualiza. O comando `thumbnails` e os traços `stakes`, `extreme`, `insider`, `callout` e `transformation` chegaram na versão 1.2.0, dentro da interface 1: com uma versão anterior, `thumbnails` volta com `usage` (comando desconhecido) e o mesmo `update` resolve.

## 9. O que não muda

Dentro da interface 1, comandos, opções, campos e códigos deste guia continuam valendo; campos novos podem aparecer. Uma mudança que quebre algo vira interface 2 e uma versão maior do app.

## 10. Exemplo: um app de roteiro validando uma pauta

```
node .flyee/modules/youtube-research/scripts/research.mjs outliers "roteiro para youtube" "como prender a atenção no vídeo" "gancho de vídeo" --name roteiro-gancho --json
node .flyee/modules/youtube-research/scripts/research.mjs transcript <id do 1º outlier> <id do 2º> --json
node .flyee/modules/youtube-research/scripts/research.mjs comments <id do 1º outlier> --max 100 --json
```

O app lê `outliers.md`, extrai os padrões que se repetem em dois ou mais outliers, lê como os melhores abrem e se organizam pelas transcrições e procura nos comentários as dúvidas que nenhum deles respondeu.
