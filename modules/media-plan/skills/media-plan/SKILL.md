---
name: media-plan
description: Monta o plano de tráfego pago de uma marca a nível de especialista, antes de qualquer anúncio: olha o que o projeto já sabe, pergunta só o que falta, com sugestão, e entrega quanto um cliente pode custar, funil, oferta, calendário, canais, estrutura, regras e o plano para o seu sim; replaneja pela leitura semanal. Use quando pedirem plano, estratégia, verba, canais ou por onde começar.
---

# Plano de estratégia e mídia

O integrante pede um plano, uma estratégia ou "por onde começar" o tráfego pago; você conduz o olhar sobre o projeto, as perguntas, as contas e o plano escrito, e ele aprova. Os comandos partem da raiz do projeto, a pasta que contém `.flyee/` (o script fica em `../../scripts/plan.mjs` a partir desta pasta):

```
node .flyee/modules/media-plan/scripts/plan.mjs <comando> [opções] --json
```

Só o JSON vai para o stdout; o progresso vai para o stderr. Em erro, `ok` é `false` e `error` traz `code`, `message` e `fix`. **Todo resultado traz `next_step`**: `action`, `command` (o comando exato, quando há um) e `say`. Siga o `next_step`; ao retomar um plano, comece por `status <plano> --json`.

Os guias desta pasta: `../../references/situacao.md` (como ler a situação, a ordem das perguntas e a narrativa), `../../references/oferta.md` (as formas de oferta e as linhas do consumidor), `../../references/pagina.md` (o briefing da página de destino), `../../references/voz-do-cliente.md` (o questionário e as conversas), `../../references/estrutura-meta.md` e `../../references/estrutura-google.md` (o porquê de cada escolha da estrutura), `../../references/regras.md` (as regras de decisão), `../../references/conformidade.md` (política da Meta, consumidor e proteção de dados, como método), `../../references/lancamento.md` (as peças do lançamento fora dos anúncios), `../../references/interface.md` (o que os outros apps leem do plano).

## Regras que não se quebram

- **Os números são do script.** Custo permitido, funil, cenários, fase de aprendizado, frequência, datas, verba por conjunto, limiares de pausa e escala: tudo sai de `funnel`, `offer`, `calendar`, `channels`, `structure` e `rules`. Você cita; nunca calcula de cabeça nem inventa um número plausível.
- **Um canal nunca entra por ser novo.** O veredito de cada canal vem de `channels`, com a lente que decidiu e o que o viraria; você explica em linguagem de negócio e não acrescenta canal por conta própria.
- **Nenhuma promessa de resultado.** Um cenário é aritmética sobre suposições rotuladas, nunca uma previsão. O script recusa uma narrativa que promete.
- **Toda sugestão é rotulada e pendente.** O que você propõe entra em `premissas.json` com `source: sugerido-pendente` e `if_different`, e vira `confirmado` só quando o integrante disser que sim. Uma sugestão nunca inventa fato da marca (preço, margem, tamanho da base): isso você pergunta ou encontra.
- **Olhe antes de perguntar.** O que o projeto já sabe entra como `encontrado`, com o arquivo. Pergunte só o que sobrar: até quatro perguntas, numa mensagem só, cada uma com a sua sugestão e o que muda se a resposta for outra. Rastreamento nunca é pergunta técnica.
- **Chat curto, documento completo.** Na conversa vão as três linhas de `say` e as decisões; o plano inteiro fica em `plano.md`, que você indica numa frase. Quando ele pedir, mostre a seção.
- **Só o integrante aprova.** `approve` recebe a frase dele como ele escreveu; você nunca aprova por ele nem antecipa a aprovação.
- **O app prescreve; o integrante executa o que mexe em dinheiro.** Ninguém aqui cria campanha, sobe público ou envia mensagem.

## Passo 0: conferir

Rode `check --json` uma vez por sessão. `plans` lista os planos do projeto; com um, siga por `status <plano> --json`.

## Passo 1: criar e olhar

1. `new <plano> --brand "<marca>" --target AAAA-MM-DD --json` cria `media-plan/<plano>/` com `premissas.json` e, se faltar, `media-plan/marca.md`. Use um nome curto, como `black-friday-2026`. Sem data alvo, deixe `--target` de fora: o calendário vem depois.
2. `look <plano> --json` inventaria o projeto: `found` traz cada fato com o arquivo de origem, `hints` os agrupa por premissa, `questions` diz o que sobrou. Se `marca.md` acabou de nascer, preencha o que o pedido e o projeto já dizem.
3. Preencha `premissas.json`: o que veio de `hints` entra com `source: encontrado` e `where`; o que você propõe entra com `source: sugerido-pendente` e `if_different`; os campos tipados (`price_brl`, `goal_count`, `total_brl`, `contacts`, `event`, `pixel`…) junto. O guia `situacao.md` diz como ler a situação antes de sugerir.

## Passo 2: perguntar numa mensagem só

Rode `premises <plano> --json`. `questions` traz até quatro, na ordem que decide o plano (produto e oferta, para quem e quantos, meta e data, verba), cada uma com `suggestion` e `if_different` quando você já propôs algo. Escreva uma mensagem com o que o projeto já mostrou (duas ou três linhas) e as perguntas como frases, nunca um formulário. Com as respostas, grave cada premissa como `informado` ou `confirmado` e rode `premises` de novo até `blocking_pending` ficar vazio.

## Passo 3: as contas

1. `funnel <plano> --json`: quanto um cliente pode custar, a meta dividida entre quem conhece e quem não conhece a marca, os leads e as visitas necessárias, os três cenários, a fase de aprendizado do evento escolhido e a frequência que a base veria. Mostre `say` ao integrante como veio: com verba pequena e produto caro, a conta muda a conversa e decide o evento.
2. `offer <plano> --json`: as formas de oferta como opções (`options`), a colisão com a promoção vigente (`collision`) e as linhas do consumidor para confirmar (`checks`). Mostre como opções, nunca como decisão tomada.
3. `calendar <plano> --json`: as fases até a data alvo, as janelas de aprendizado, o ponto de decisão, os prazos que não se discutem e os feriados no caminho. Com `--launch`, a data é um lançamento e não um pico de vendas.

## Passo 3b: os canais, a estrutura e as regras

1. `channels <plano> --json` decide cada canal (Meta, Busca do Google, e-mail, WhatsApp, parceiros, TikTok, LinkedIn, YouTube): `rows[]` traz `verdict` (`run`, `test`, `later`, `no`), `lens` (a lente que decidiu), `reason`, `confidence` (`evidencia` ou `julgamento`), `flip` (o que viraria o veredito) e as horas por semana. Com `--hours <n>`, as horas de quem executa; sem, 6. Um canal que o integrante tirou em `premissas.json` (`channels.<canal>: false`) sai com evidência. Diga os vereditos como negócio: "a Busca entra como teste porque quem procura já quer comprar; vira Run com 30 conversões em 30 dias".
2. `structure <plano> --json` escreve a estrutura dos canais que rodam ou testam: na Meta, o objetivo honesto, um conjunto (ou dois, quando a verba cobre dois pisos), a verba do conjunto contra o piso de aprendizado, público amplo com as exclusões, posicionamentos, o padrão de nomes, o remarketing por etapa e o semelhante; na Busca, as campanhas de marca e de não marca, as palavras, as negativas, o lance e a conversão. Em `structure_invalid` a verba do conjunto fica abaixo do piso: leve ao integrante as três saídas de `details.exits` (um evento mais cedo no funil, a verba até o piso, ou aceitar com `--accept-floor`, sabendo que a semana 1 só compara criativos) e rode de novo com a escolha dele. O porquê de cada escolha está em `estrutura-meta.md` e `estrutura-google.md`.
3. `rules <plano> --json` grava as regras de decisão: o que é dado suficiente (1.000 impressões e 30 cliques por anúncio para gancho e CTR; 30 resultados para custo), os indicadores por fase, quando pausar, escalar e trocar a peça, uma mudança por conjunto por semana, a cadência semanal e o pulso por exceção, e cinco gatilhos com plano B. Os números são os do app de medição, para o plano e a leitura nunca discordarem.

## Passo 4: a narrativa e o rascunho

1. Escreva `media-plan/<plano>/narrativa.json` como `situacao.md` mostra: até três achados com a certeza (`confirmado`, `provavel`, `primeira-leitura`), a história em um parágrafo, o primeiro passo, o que não vamos fazer, o que não conseguimos conferir e as decisões para o integrante. Cite os números do script; não invente.
2. `plan <plano> --json` monta `plano.json` e `plano.md` como rascunho, com as seções Canais, Estrutura e Regras de decisão quando os comandos do passo 3b rodaram. Em `narrative_invalid`, corrija cada item de `details.problems`; em `in_short_long`, encurte os achados até a seção "Em resumo" caber em 150 palavras.
3. Na conversa: as três linhas de `say`, as decisões pendentes e uma frase dizendo onde está o plano. Nada de colar o documento.

## Passo 5: as decisões e o sim

Quando `blocking_pending` estiver vazio, pergunte ao integrante se aprova o plano. Com o sim literal dele, rode `approve <plano> --by "<a frase dele>" --json`: o estado vira `aprovado`, a versão fica congelada em `plano-v<n>.json` e a frase entra em `decisoes.md`. Para mudar um plano aprovado, rode `plan` de novo: a versão seguinte nasce como rascunho.

## Passo 6: o que vem depois

O plano aprovado é o que os outros apps leem (`../../references/interface.md`): os criativos partem da oferta, do evento e da verba da fase; a régua da base parte das datas das fases; a medição parte da regra de link e das regras de decisão. Diga ao integrante o primeiro passo de `moves` e siga nesta conversa com o app que o passo pede. As peças do lançamento fora dos anúncios (a demonstração ao vivo, a gravação para o remarketing, o atendimento no pico) estão em `lancamento.md`; a conferência de política, consumidor e proteção de dados, em `conformidade.md`. Ao terminar, registre o uso com `npx --yes flyee@latest track tool.executed --module media-plan`.

## Passo 7: replanejar pela leitura semanal

Quando o app de medição escrever a leitura semanal (`ads-insights/semanal/<data>.json`), rode `replan <plano> --from ads-insights/semanal/<data>.json --json`. A versão seguinte nasce como rascunho com a seção "O que mudou e por quê" no topo: os achados com a certeza, os movimentos julgados, as propostas da leitura como decisões do integrante, as lacunas, os gatilhos disparados (razão de reivindicação fora de 1,0 a 1,5, meta sem compra) e a premissa da meta atualizada pela planilha de origem. A versão aprovada fica congelada; o replanejamento nunca move verba nem muda a meta em silêncio. Na conversa, as três linhas de `say` e as decisões; com o sim literal, `approve`.

## Problemas comuns

| `code` | O que fazer |
|---|---|
| `premises_invalid` | `details.path` aponta o campo de `premissas.json`; corrija e rode de novo |
| `premises_pending` | a aprovação pediu premissas em aberto: pergunte, grave como `informado` ou `confirmado`, rode `plan` e `approve` de novo |
| `narrative_invalid` | `details.problems` lista cada problema da narrativa |
| `in_short_long` | a seção "Em resumo" passou de 150 palavras: encurte os achados |
| `target_missing` | grave `target_date` em `premissas.json` ou passe `--target` |
| `structure_invalid` | a verba do conjunto fica abaixo do piso: `details.exits` traz as três saídas; o integrante escolhe |
| `weekly_missing`, `weekly_invalid` | o arquivo da leitura semanal não existe ou não é o do app de medição: rode a leitura semanal lá antes |
| `plan_exists`, `plan_missing` | o nome já existe, ou não existe: `list` mostra os planos |
