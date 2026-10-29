# Pesquisa no Instagram para outros apps

Este guia é para a IA que está executando outro app do flyee.club e precisa de dados do Instagram: o normal de um perfil, os posts que passaram muito desse normal em vários perfis, o que as legendas deles têm em comum, o que o público diz nos comentários de um post ou o vídeo de um Reels para assistir. Com a chave do Apify a coleta é automática; sem ela, a IA lê capturas de tela que o integrante traz.

Versão da interface: **1**. Os comandos partem da raiz do projeto (a pasta que contém `.flyee/`) e todos aceitam `--json`. O progresso sai no stderr; o stdout tem só o JSON. Toda resposta traz `interface_version`.

```
node .flyee/modules/instagram-research/scripts/research.mjs <comando> [opções] --json
```

## 1. O app está instalado?

Se `.flyee/modules/instagram-research/scripts/research.mjs` não existir, diga ao integrante numa frase simples que vai instalar o app e o que ele faz ("Vou instalar o app Pesquisa no Instagram, que mostra quais posts passaram do normal do perfil") e rode você mesmo `npx --yes flyee@latest add instagram-research --yes --json`, com tempo limite de 10 minutos, sem esperar resposta. Se a instalação falhar, ou se o integrante pedir para não instalar, siga o seu app sem esses dados, dizendo o que fica de fora (por exemplo: "os conceitos saem sem a prova do que funciona no perfil").

Se existir, rode uma vez por sessão:

```
node .flyee/modules/instagram-research/scripts/research.mjs check --json
```

| Campo | O que diz |
|---|---|
| `interface_version` | a versão da interface instalada |
| `modes` | `manual` (sempre `true`) e `apify` (a chave existe) |
| `apify_key`, `apify_key_from` | se a chave existe e de onde veio (`environment` ou `flyee`), nunca o valor |
| `apify_setup` | sem a chave: `command` (`npx --yes flyee@latest key set APIFY_TOKEN --browser --json`, que você roda e que abre a página onde o integrante cola a chave), `key_url` (onde ele cria o token), `how` e `after` |
| `prices` | o preço de tabela por post e por comentário, o limite acima do qual o app pede confirmação e a data em que os preços foram conferidos |

A chave é opcional. Nunca a peça em texto, nunca a ponha num comando e nunca abra o arquivo onde ela fica.

## 2. Um perfil

```
node .flyee/modules/instagram-research/scripts/research.mjs profile <@perfil | perfil | endereço do perfil> --json
```

| Opção | Para quê |
|---|---|
| `--posts N` | posts colhidos, de 5 a 100 (padrão 30); os fixados ficam de fora |
| `--source auto\|apify\|reading` | `auto` (padrão) usa o que o projeto já tem, uma coleta de menos de 24 horas ou uma leitura feita à mão, e só colhe o que falta; `apify` força a coleta; `reading` usa só a leitura |
| `--rank index\|multiplier\|metric` | ordem do resultado (padrão `index`) |
| `--refresh` | colhe de novo, mesmo com uma coleta recente |
| `--confirm-cost` | confirma uma coleta acima do limite, depois do sim do integrante |

Resposta:

| Campo | O que é |
|---|---|
| `id` | o perfil, sem @ |
| `source` | `type` (`apify`, `screenshot`, `link`, `export` ou `declared`), `ref` (de onde veio) e `collected_at` |
| `cached` | `true` quando veio do que o projeto já tinha |
| `baseline` | `reels` e `static`, cada um com `value` (a mediana), `n` (posts com o número) e `status` (`measured` com 5 ou mais, `indication` com 3 ou 4, `none` abaixo) |
| `sample` | `posts`, `reels`, `static` e `by_band` |
| `durations[]` | por faixa de duração dos Reels (`up_to_20s`, `21_to_60s`, `over_60s`): `n`, `median_plays`, `median_multiplier` |
| `top_reels[]`, `top_static[]` | os 10 primeiros Reels e os 5 primeiros posts estáticos, no formato de post abaixo |
| `files` | `md` (o relatório), `json` (tudo, com todos os posts em `reels[]` e `static[]`), `csv` (planilha) |
| `cost` | com coleta nova: `estimate_usd`, `charged_usd`, `run_id`; senão `null` |
| `warnings` | ressalvas para repassar |

Cada post traz `id` (o código do post), `url`, `profile`, `kind` (`reel` ou `static`), `type`, `plays`, `likes`, `comments`, `hidden_likes`, `duration_s`, `posted_at`, `age_days`, `caption`, `ad` (parceria paga), `video_expires_at`, `metric` (plays para Reels, curtidas mais comentários para os outros), `multiplier`, `band`, `engagement`, `index` e `flags`. O que não se sabe vem `null`, nunca zero. As métricas, faixas e avisos estão em `metodologia.md`, nesta mesma pasta: leia antes de interpretar.

- `caption` é a legenda inteira, como o autor escreveu: as quebras de linha (`\n`), as hashtags e o pedido do fim. `""` é um post sem legenda; `null`, uma legenda que não se sabe. Para mostrar, corte você mesmo um trecho; para medir, use `captions` (seção 6).
- `video_expires_at`, só em Reels colhidos pelo Apify, é a hora (ISO, UTC) em que o link do vídeo deixa de valer, lida do próprio link; `null` sem link ou sem hora no link. Para assistir, baixe antes dela com `video` (seção 7).

Sem a chave e sem leitura, a resposta é `ok: true` com `mode: "manual"`, `collected: false`, `missing` e `next_step`: `say` (o que dizer ao integrante), `key` (o mesmo de `apify_setup`) e `reading` (`how`, o roteiro da leitura de capturas, e `template`, um arquivo de leitura para preencher).

## 3. Outliers de vários perfis

```
node .flyee/modules/instagram-research/scripts/research.mjs outliers <@perfil> <@perfil> … --name <seu-app>-<tema> --json
```

De 2 a 25 perfis. Cada post é medido contra o normal do próprio perfil e entra num ranking só de Reels e num só de posts estáticos. Aceita as opções de `profile` e `--name`, o nome da pasta do resultado; use o slug do seu app no começo. A coleta leva de um a alguns minutos: avise o integrante antes e rode com um tempo limite longo.

Resposta: `id`, `profiles[]` (`id`, `source`, `baseline`, `sample`, `files` de cada perfil), `sample` (`profiles`, `reels`, `static`), `durations[]`, `top_reels[]` (os 15 primeiros, cada um com `profile`), `top_static[]` (os 5 primeiros), `missing` (os perfis que ficaram de fora), `cost`, `files` (`md`, `json`, `csv`) e `warnings`. Com todos os perfis de fora, vem `mode: "manual"` e `next_step`, como em `profile`.

Um perfil que o Apify não acha sai em `missing`, com um aviso; os outros seguem.

## 4. Leitura feita à mão

```
node .flyee/modules/instagram-research/scripts/research.mjs import <arquivo .json> --json
```

O arquivo é uma leitura que a IA grava a partir das capturas de tela que o integrante traz, ou a lista de posts que o coletor de posts do Instagram do Apify devolve, quando o integrante já tem esse arquivo. Formato da leitura, versão 1:

```json
{
  "version": 1,
  "kind": "reels_grid",
  "profile": "@perfil",
  "collected_at": "2026-10-17",
  "source": { "type": "screenshot", "ref": "capturas/perfil-reels-1.png" },
  "items": [
    { "plays_text": "12,3 mil", "pinned": true },
    { "plays_text": "987" },
    { "plays_text": "1,2 mi", "url": "https://www.instagram.com/reel/ABCdef123/" }
  ]
}
```

| Campo | Regra |
|---|---|
| `kind` | `reels_grid` (a aba de Reels, só plays) ou `posts` (posts abertos um a um, cada item com `type` `reel` ou `static`) |
| `profile` | o @ do perfil lido |
| `collected_at` | a data da leitura, `AAAA-MM-DD`; a idade dos posts é contada até ela |
| `source` | `type`: `screenshot`, `link`, `export` ou `declared`; `ref`: o arquivo da captura, o endereço ou o arquivo exportado (só `declared` dispensa) |
| `items[].plays_text` | o número de plays como aparece: "987", "12.345", "12,3 mil", "1,2 mi", "12.3K"; obrigatório em Reels |
| `items[].likes_text`, `comments_text` | como aparecem; `"oculto"` quando o perfil esconde as curtidas; obrigatório em post estático |
| `items[].pinned` | `true` para post fixado, que fica fora do normal |
| `items[].duration_text`, `posted_at`, `url`, `ad` | opcionais: "0:15", `AAAA-MM-DD`, o endereço do post, `true` para parceria paga |
| `items[].caption` | opcional: a legenda inteira, como aparece com o "mais" aberto, com as quebras de linha e as hashtags; uma legenda que termina cortada no "mais" é recusada |

A IA escreve o texto como vê, e o script converte. Um texto que o script não entende é recusado com `reading_invalid`, e a mensagem lista cada campo com o caminho (`items[3].plays_text`) para corrigir só ele. A leitura fica em `instagram-research/profiles/<perfil>/leitura.json`, e `profile` e `outliers` passam a usá-la.

Resposta: `kind` (`reading` ou `apify_file`) e `profiles[]`, cada um no formato da resposta de `profile`.

## 5. Comentários de um post

```
node .flyee/modules/instagram-research/scripts/research.mjs comments <endereço do post ou Reels | código do post> --max 100 --json
```

`--max N` de 10 a 500 (padrão 100). Só com a chave; custa o preço de `prices.comments_usd_each` por comentário e pede confirmação acima do limite. Devolve `count`, `comments[]` (`text`, `likes`, `replies`, `posted_at`, do mais curtido ao menos curtido, sem o nome de quem escreveu), `cost`, `files` (`md`, `json`) e `warnings`. Fica guardado por 7 dias em `instagram-research/posts/<código>/`.

Sem a chave, vem `mode: "manual"` e `next_step.paste`: o integrante cola os comentários num arquivo de texto, e a IA o lê.

## 6. Traços de legenda

```
node .flyee/modules/instagram-research/scripts/research.mjs captions <id da pesquisa de outliers | @perfil> --json
```

Mede, nas legendas de uma pesquisa de `outliers` (ou de um perfil de `profile`), cada traço contra o multiplicador: a mediana dos posts cuja legenda tem o traço e a dos que não têm, com o tamanho de cada grupo. É o mesmo método dos traços de título da Pesquisa no YouTube. Grava `legendas.md` e `legendas.json` na pasta da pesquisa (ou do perfil), por cima da rodada anterior. Não colhe nada e não custa nada.

| Opção | Para quê |
|---|---|
| `--min-n N` | o tamanho mínimo de grupo, de 2 a 50 (padrão 5); abaixo dele, `small_n: true` |
| `--exclude id,id` | os posts fora do tema (os `id` do `.json` da pesquisa), que saem da conta e voltam em `excluded` |

Reels e posts estáticos têm multiplicadores que medem coisas diferentes (plays contra interações) e ficam em blocos separados. As parcerias pagas saem da conta sozinhas, porque parte do alcance foi comprada. Só contam os posts com multiplicador e com a legenda conhecida; uma legenda vazia conta como legenda.

Resposta: `id`, `scope` (`outliers` ou `profile`), `profiles[]`, `created_at`, `research` (`made_at`, `app_version`), `min_n`, `reels` e `static`, `excluded[]` (`id`, `profile`, `kind`, `reason`: `paid_partnership` ou `asked`), `files` (`md`, `json`) e `warnings`. Cada um de `reels` e `static` traz:

| Campo | O que é |
|---|---|
| `sample` | `posts` (na pesquisa, depois do que saiu), `measured` (com multiplicador e legenda), `no_caption`, `no_multiplier` |
| `traits[]` | `trait`, `label` (o que foi procurado), `with` e `without` com `n` e `median`, `ratio` (com ÷ sem) e `small_n` |
| `first_line`, `total`, `hashtags` | o tamanho da primeira linha (até a primeira quebra), da legenda inteira e o número de hashtags: `median_all`, `median_outliers` (só faixas `outlier` e `explosive`), `outliers_n` e `buckets[]` com `range`, `n`, `median` e `small_n` |

Os traços, nesta ordem: `question` (tem "?"), `first_line_number` (número na primeira linha), `first_person` ("eu", "meu", "minha", verbos como "testei", "I", "my"), `list_format` (3 ou mais linhas que começam com número, marcador ou emoji), `hashtags_end` (hashtags só no fim), `hashtags_inline` (hashtag no meio do texto), `cta_any` (algum pedido ao público), `cta_comment`, `cta_save`, `cta_share` (compartilhar ou marcar alguém), `cta_link_bio` e `cta_dm` (chamar no direct). As regras leem português e inglês, sem os links, as hashtags e as menções; `label` diz o que cada uma procura.

O dado é desta amostra: mostra o que anda junto com os posts que foram bem, nunca a causa. Ao usar, cite o traço e os números ("pedido para salvar: mediana de 2,1× com n=14, contra 1,0× com n=60"). Grupo pequeno é indício. Uma pesquisa feita antes da versão 1.1.0 do app guardou só o começo de cada legenda, e `warnings` diz isso.

## 7. O vídeo de um Reels

```
node .flyee/modules/instagram-research/scripts/research.mjs video <código ou endereço do Reels> [<outro>…] --json
```

Baixa o vídeo de 1 a 5 Reels colhidos pelo Apify, para outro app assistir, como a Análise de vídeo. O link do vídeo que a coleta traz vence na hora de `video_expires_at`: baixe logo depois da coleta, e só os Reels escolhidos (os maiores outliers ou os que o integrante pediu), nunca a coleta inteira. O download não usa a chave nem conta nenhuma; vem só dos servidores de mídia do Instagram (`cdninstagram.com`, `fbcdn.net`).

| Opção | Para quê |
|---|---|
| `--max-mb N` | o tamanho máximo de cada vídeo, de 1 a 500 MB (padrão 100) |
| `--refresh` | baixa de novo, mesmo com o vídeo já no projeto |

Resposta: `max_mb` e `items[]`, um por Reels, cada um com `ok`. Um item que falha traz `ok: false`, `id` e `error` (`code`, `message`, `fix`), sem derrubar os outros. Um item que deu certo traz `id`, `url`, `profile`, `duration_s`, `bytes`, `cached` (`true` quando o vídeo já estava no projeto), `source` (de onde veio o link: `type` `apify` ou `export`, `actor`, `run_id`, `collected_at`, `ref`), `link_expires_at`, `downloaded_at` e `files` (`video`, o `.mp4`; `json`, a origem). Tudo fica em `instagram-research/posts/<código>/`, e o vídeo fica fora do git.

Para assistir, passe `files.video` como arquivo local à Análise de vídeo (`node .flyee/modules/video-analysis/scripts/video.mjs analyze <files.video> --focus editing --name <seu-app> --json`), seguindo a interface dela. Um Reels que veio de uma leitura de capturas não tem link: o vídeo só entra pelo arquivo que o integrante tiver.

## 8. O que já existe

`list --json` devolve `profiles[]` (`id`, `source`, `collected_at`, `reels_normal`, `md`), `outliers[]` (`id`, `profiles`, `created_at`, `md`, `captions`, que diz se os traços de legenda já foram medidos) e `posts[]` (`id`, `comments`, `video`) já pesquisados neste projeto.

## 9. Erros

Em erro do comando, `ok` é `false`, a saída termina com código 1 (2 para uso errado) e vem `error` com `code`, `message` e `fix`. Mostre `message` e `fix` ao integrante; decida pelo `code`.

| `code` | O que fazer |
|---|---|
| `needs_confirmation` | a coleta passa do limite de custo; diga o valor da mensagem ao integrante e, com o sim, repita com `--confirm-cost`. Sem o sim, peça menos perfis ou menos posts |
| `apify_unauthorized` | o Apify recusou a chave; o integrante gera outra e você roda de novo o comando de `apify_setup` |
| `apify_no_credit` | o crédito do Apify acabou; siga pelo modo manual |
| `profile_not_found` | o perfil não existe ou não abriu; confira o @ com o integrante |
| `reading_invalid` | corrija os campos que a mensagem lista, olhando de novo a captura, e rode `import` de novo |
| `rate_limited`, `apify_timeout`, `apify_unavailable`, `apify_actor_failed` | tente de novo em alguns minutos, com menos perfis; se repetir, siga pelo modo manual |
| `apify_actor_missing` | o coletor mudou de nome; siga pelo modo manual |
| `video_link_expired` | (`video`) o link do vídeo venceu; baixar de novo pede uma coleta nova do perfil (`profile --refresh`, paga: diga o custo antes), ou o arquivo do integrante |
| `no_video_link` | (`video`) o Reels veio de uma leitura de capturas, ou não está nas coletas do projeto; peça o arquivo do vídeo ao integrante |
| `not_a_video` | (`video`) o post é uma foto ou um carrossel |
| `video_too_large` | (`video`) passou de `--max-mb`; repita com um teto maior, se valer a pena |
| `video_unavailable`, `video_link_invalid`, `video_download_failed` | (`video`) repasse `message` e `fix`; se repetir, peça o arquivo ao integrante |
| `offline`, `not_found`, `unexpected` | repasse `message` e `fix` |
| `usage` | uma opção errada: corrija o comando |

Quando a coleta falha, nunca tente por conta própria outro caminho para o mesmo dado (outro site, a página do Instagram aberta no navegador, a conta do integrante). Diga o que falhou e ofereça o modo manual.

## 10. O que não muda

Dentro da interface 1, comandos, opções, campos e códigos deste guia continuam valendo; campos novos podem aparecer. Uma mudança que quebre algo vira interface 2 e uma versão maior do app.

Na versão 1.1.0 do app entraram, dentro da interface 1: `caption` com a legenda inteira (antes, os primeiros 300 caracteres numa linha só), o campo `video_expires_at`, os comandos `captions` (seção 6) e `video` (seção 7), `captions` em `list.outliers[]` e `video` em `list.posts[]`.

## 11. Exemplo: um app de anúncios buscando prova orgânica

```
node .flyee/modules/instagram-research/scripts/research.mjs profile @perfil.da.marca --json
node .flyee/modules/instagram-research/scripts/research.mjs outliers @perfil.da.marca @concorrente.a @concorrente.b @referencia.c --name anuncios-rodada-1 --json
node .flyee/modules/instagram-research/scripts/research.mjs captions anuncios-rodada-1 --json
node .flyee/modules/instagram-research/scripts/research.mjs comments <endereço do maior outlier> --max 100 --json
```

O app lê `outliers.md`, guarda como evidência os posts com faixa `outlier` ou `explosive` (com `id`, `plays`, o normal do perfil e `multiplier`), descarta os marcados com `dm_bait` e `ad`, lê em `legendas.json` os traços de legenda com os grupos que não são `small_n` e procura nos comentários as dúvidas e objeções que viram ângulo de anúncio.
