# O plano para outros apps

Este guia é para a IA que está executando outro app do flyee.club e precisa do que o plano decidiu: a oferta, a página, o evento de otimização, a verba de cada fase, o público, as datas, o padrão de nome e a regra de link. Leia o plano em vez de perguntar de novo ao integrante.

Versão da interface: **1**. Dentro desta versão, campos só se acrescentam; nada do que está aqui muda de nome ou de sentido.

## 1. O plano existe?

O plano fica em `media-plan/<plano>/plano.json`, na raiz do projeto (a pasta que contém `.flyee/`). Para saber quais existem e em que etapa estão:

```
node .flyee/modules/media-plan/scripts/plan.mjs list --json
```

| Campo | O que diz |
|---|---|
| `plans[].plan` | o nome do plano, o nome da pasta |
| `plans[].state` | `premissas` (ainda sem plano montado), `rascunho` ou `aprovado` |
| `plans[].target_date` | a data alvo, ou null |

Se o app não estiver instalado (`.flyee/modules/media-plan/` não existe) e o pedido envolver plano, estratégia, verba por fase ou oferta, diga numa frase simples que vai instalar o app e o que ele faz ("Vou instalar o app Plano de estratégia e mídia, que monta o plano da campanha") e rode você mesmo `npx --yes flyee@latest add media-plan --yes --json`, com tempo limite de 10 minutos. Se o pedido for só o seu trabalho (os criativos, a régua, a leitura), siga sem ele: cada campo abaixo tem o que fazer na falta.

## 2. O que ler em `plano.json`

Use só um plano `aprovado`. Um `rascunho` carrega premissas `sugerido-pendente`, que o integrante ainda não confirmou: nele, pegue só os campos cuja premissa tem `source` igual a `informado`, `encontrado` ou `confirmado`.

| Campo | O que é | Na falta |
|---|---|---|
| `interface_version` | 1 | |
| `state`, `version`, `approved_at` | o estado e a versão; `approved_by` é a frase do integrante | |
| `target_date` | a data alvo (AAAA-MM-DD) | pergunte a data |
| `premises.produto_oferta.value` | o produto e a oferta, numa frase | pergunte a oferta |
| `premises.publico.value` | para quem, e quantos | pergunte o público |
| `premises.evento.value` | o evento de otimização, numa frase; o nome do evento está em `premissas.json` (`premises.evento.event`) | pergunte o evento |
| `premises.verba.value` | a verba, numa frase | |
| `budget.total_brl`, `budget.daily_brl` | a verba total e a média por dia no período pago | |
| `budget.by_phase[]` | por fase: `phase`, `start`, `end`, `budget_brl`, `daily_brl`, `share_pct`; a verba diária de uma campanha é a da fase em que ela roda | use `budget.daily_brl` |
| `economics.allowable_cac_brl` | quanto um cliente pode custar | |
| `funnel.allowable_cpl_brl` | quanto um lead pode custar; `funnel.leads_needed` e `funnel.visits_needed` | |
| `learning_floor` | a conta da fase de aprendizado: `viable`, `floor_daily_brl`, `max_cost_per_event_brl` | faça a própria conta |
| `offer.options[]` | as formas de oferta mostradas ao integrante; a escolhida está em `premises.produto_oferta.value` | |
| `offer.collision` | a colisão com a promoção vigente, ou null | |
| `calendar.phases[]` | `id` (`preparacao`, `testes`, `escala`, `aquecimento`, `pico`, `depois`), `start`, `end`, `days` | |
| `calendar.decision_point.date` | o dia de redistribuir a verba | |
| `calendar.deadlines[]` | `id`, `date`, `text`, `past` | |
| `calendar.holidays[]` | os feriados nacionais no caminho, com `date`, `name`, `weekday` | |
| `tracking.utm_rule` | o padrão único de link do plano | use o seu padrão |
| `tracking.events[]` | os eventos do funil que o plano lê | |
| `moves[]` | o que fazer, em ordem: `what`, `when`, `why` | |
| `could_not_check[]` | o que o plano assumiu e pede para conferir | |
| `channels_decision.rows[]` (1.1.0) | por canal: `channel` (`meta`, `google_search`, `email`, `whatsapp`, `parceiros`, `tiktok`, `linkedin`, `youtube`), `verdict` (`run`, `test`, `later`, `no`), `lens`, `reason`, `confidence`, `flip` | trate só a Meta como decidida |
| `structure.meta` (1.1.0) | `objective`, `optimization_event`, `campaign.daily_brl`, `ad_sets[]` (`name`, `daily_brl`, `floor_daily_brl`, `clears_floor`, `audience`, `exclusions`, `placements`), `naming`, `remarketing[]` (`stage`, `audience`, `window_days`, `message`), `lookalike`, `budget_by_phase[]` | use `budget.by_phase` |
| `structure.google_search` (1.1.0) | `daily_brl`, `campaigns[]` (`name`, `kind` `marca` ou `nao-marca`, `when`, `keywords`, `match`, `negatives`, `bid`), `conversion`, `extensions`, `rules` | a Busca não está no plano |
| `structure.owned[]` (1.1.0) | `channel` (`email`, `whatsapp`, `parceiros`), `what`, `dates` | |
| `rules` (1.1.0) | `sample` (`impressions`, `link_clicks`, `results`), `allowable_cost_brl`, `learning_floor_daily_brl`, `pause_when[]`, `scale_when[]`, `swap_when[]`, `cadence`, `indicators_by_phase` | use as suas regras de bolso rotuladas |
| `triggers[]` (1.1.0) | `id`, `risk`, `read_in`, `plan_b` | |
| `replan` (1.1.0) | quando a versão nasceu de uma leitura semanal: `from`, `read.week_of`, `changes[]` (`kind`, `text`, `certainty`), `triggers_fired[]`, `premise_updates[]`, `moves[]`, `previous_version` | null: a versão não veio de uma leitura |

O que não está no plano, está em `media-plan/<plano>/premissas.json`, com os campos tipados (`price_brl`, `billing`, `contacts`, `months_since_contact`, `pixel`, `capi`, `ga4`, `google_ads`) e a origem de cada um.

## 3. Como os apps do flyee o usam

- **Criativos para anúncios:** o briefing de uma campanha pode nascer do plano: oferta, página (de `premissas.json`, `premises.prontidao.value`), evento, verba diária da fase, público, padrão de nome e a regra de link. Cada campo que vem daqui leva a origem `plano`.
- **Base de contatos e CRM:** as datas da régua vêm de `calendar.phases` (aquecimento e pico) e de `calendar.deadlines`; os segmentos, de `premises.base` e `premises.publico`.
- **Medição e leitura de resultados:** a regra de link vem de `tracking.utm_rule`; o evento otimizado, de `premises.evento`; o custo permitido, de `rules.allowable_cost_brl` (ou `funnel.allowable_cpl_brl`); as regras de decisão, de `rules` e `triggers`. A leitura semanal volta ao plano: `replan <plano> --from ads-insights/semanal/<data>.json --json` cria a versão seguinte como rascunho com o que mudou e por quê; o arquivo precisa ter `interface_version` 1, `week_of` e `findings`.

## 4. Erros

| `code` | O que fazer |
|---|---|
| `plan_missing` | o plano não existe: `list` mostra os que há |
| `premises_invalid` | um campo de `premissas.json` está errado; `details.path` diz qual |
| `premises_pending` | a aprovação pediu uma premissa que ainda está em aberto; `details.pending` lista |
| `narrative_invalid` | a narrativa tem um problema; `details.problems` lista cada um |
| `in_short_long` | a seção "Em resumo" passou de 150 palavras; encurte os achados |
| `target_missing` | o plano não tem data alvo |
| `structure_invalid` | a verba do conjunto da Meta fica abaixo do piso de aprendizado; `details.exits` traz as saídas, e `--accept-floor` aceita |
| `weekly_missing`, `weekly_invalid` | o arquivo passado em `--from` não existe ou não é a leitura semanal do app de medição |
| `usage` | opção ou comando errado |
