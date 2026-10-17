# Pesquisa no Instagram para outros apps

Este guia é para a IA que está executando outro app do flyee.club e precisa de dados do Instagram: o normal de um perfil, os posts que passaram muito desse normal em vários perfis ou o que o público diz nos comentários de um post. Com a chave do Apify a coleta é automática; sem ela, a IA lê capturas de tela que o integrante traz.

Versão da interface: **1**. Os comandos partem da raiz do projeto (a pasta que contém `.flyee/`) e todos aceitam `--json`. O progresso sai no stderr; o stdout tem só o JSON. Toda resposta traz `interface_version`.

```
node .flyee/modules/instagram-research/scripts/research.mjs <comando> [opções] --json
```

## 1. O app está instalado?

Se `.flyee/modules/instagram-research/scripts/research.mjs` não existir, diga ao integrante que os dados vêm do app Pesquisa no Instagram e ofereça instalá-lo: com o sim, rode você mesmo `npx --yes flyee@latest add instagram-research --yes --json`. Sem ele, siga o seu app sem esses dados, dizendo o que fica de fora (por exemplo: "os conceitos saem sem a prova do que funciona no perfil").

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

Cada post traz `id` (o código do post), `url`, `profile`, `kind` (`reel` ou `static`), `type`, `plays`, `likes`, `comments`, `hidden_likes`, `duration_s`, `posted_at`, `age_days`, `caption` (até 300 caracteres), `ad` (parceria paga), `metric` (plays para Reels, curtidas mais comentários para os outros), `multiplier`, `band`, `engagement`, `index` e `flags`. O que não se sabe vem `null`, nunca zero. As métricas, faixas e avisos estão em `metodologia.md`, nesta mesma pasta: leia antes de interpretar.

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
| `items[].duration_text`, `posted_at`, `url`, `caption`, `ad` | opcionais: "0:15", `AAAA-MM-DD`, o endereço do post, a legenda, `true` para parceria paga |

A IA escreve o texto como vê, e o script converte. Um texto que o script não entende é recusado com `reading_invalid`, e a mensagem lista cada campo com o caminho (`items[3].plays_text`) para corrigir só ele. A leitura fica em `instagram-research/profiles/<perfil>/leitura.json`, e `profile` e `outliers` passam a usá-la.

Resposta: `kind` (`reading` ou `apify_file`) e `profiles[]`, cada um no formato da resposta de `profile`.

## 5. Comentários de um post

```
node .flyee/modules/instagram-research/scripts/research.mjs comments <endereço do post ou Reels | código do post> --max 100 --json
```

`--max N` de 10 a 500 (padrão 100). Só com a chave; custa o preço de `prices.comments_usd_each` por comentário e pede confirmação acima do limite. Devolve `count`, `comments[]` (`text`, `likes`, `replies`, `posted_at`, do mais curtido ao menos curtido, sem o nome de quem escreveu), `cost`, `files` (`md`, `json`) e `warnings`. Fica guardado por 7 dias em `instagram-research/posts/<código>/`.

Sem a chave, vem `mode: "manual"` e `next_step.paste`: o integrante cola os comentários num arquivo de texto, e a IA o lê.

## 6. O que já existe

`list --json` devolve `profiles[]` (`id`, `source`, `collected_at`, `reels_normal`, `md`), `outliers[]` (`id`, `profiles`, `created_at`, `md`) e `posts[]` (`id`, `comments`) já pesquisados neste projeto.

## 7. Erros

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
| `offline`, `not_found`, `unexpected` | repasse `message` e `fix` |
| `usage` | uma opção errada: corrija o comando |

Quando a coleta falha, nunca tente por conta própria outro caminho para o mesmo dado (outro site, a página do Instagram aberta no navegador, a conta do integrante). Diga o que falhou e ofereça o modo manual.

## 8. O que não muda

Dentro da interface 1, comandos, opções, campos e códigos deste guia continuam valendo; campos novos podem aparecer. Uma mudança que quebre algo vira interface 2 e uma versão maior do app.

## 9. Exemplo: um app de anúncios buscando prova orgânica

```
node .flyee/modules/instagram-research/scripts/research.mjs profile @perfil.da.marca --json
node .flyee/modules/instagram-research/scripts/research.mjs outliers @perfil.da.marca @concorrente.a @concorrente.b @referencia.c --name anuncios-rodada-1 --json
node .flyee/modules/instagram-research/scripts/research.mjs comments <endereço do maior outlier> --max 100 --json
```

O app lê `outliers.md`, guarda como evidência os posts com faixa `outlier` ou `explosive` (com `id`, `plays`, o normal do perfil e `multiplier`), descarta os marcados com `dm_bait` e `ad` e procura nos comentários as dúvidas e objeções que viram ângulo de anúncio.
