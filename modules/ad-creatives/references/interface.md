# Interface para outros apps (versão 1)

O que este app grava e outros apps leem, e o que ele lê dos outros. Tudo aqui só cresce: campos novos entram, os existentes não mudam de nome nem de significado.

## O que este app lê

| De | Arquivo | Para quê |
|---|---|---|
| app de plano | `media-plan/<plano>/plano.json` (aprovado, ou o mais novo) | `brief` preenche o briefing com a oferta, o preço, o evento, a verba da fase, o público, as datas, a regra de link e o custo permitido, cada campo com `source: plano` |
| app de plano | `media-plan/<plano>/pagina.md` | `page brief` escreve o briefing da página de destino |
| Motor de vídeo | `capturas/<site>/captura.json` | `capture` traz o logo, as cores e as telas; `page audit` confere a página viva |
| app de medição | `ads-insights/leituras/<leitura>/report.json` | a rodada seguinte (na versão 1.3.0): o resultado próprio de cada anúncio |

## O que este app grava para os outros

### `anuncios/<campanha>/entrega/nomes.json`

A lista dos anúncios entregues, pela qual a medição liga cada linha do export à peça:

```json
{
  "version": 1,
  "campaign": "black-friday-2026",
  "generated_at": "2026-10-29T12:00:00.000Z",
  "name_pattern": "<angulo>-<formato>-<gancho>-v<n>",
  "site_reads_name": true,
  "ads": [
    { "ad_name": "presenca-reels-lembra-v1", "concept": "presenca", "angle": "presenca", "files": [{ "file": "anuncios/black-friday-2026/entrega/presenca-reels-lembra-v1.mp4", "placement": "vertical", "format": "9:16", "kind": "video" }] }
  ]
}
```

`ad_name` é o nome exato que vai no Gerenciador e em `utm_content`; `concept` e `angle` ligam a peça à ficha. Um app que lê o export compara o nome letra por letra e lista o que não casa, sem adivinhar.

### `anuncios/<campanha>/estado.json`

`stage` diz onde a campanha está (`briefing`, `pesquisa`, `conceitos`, `pecas`, `textos`, `entrega`, `lancada`); `approvals` guarda o sim do integrante aos conceitos e às prévias; `zones_source` diz em qual zona do Motor as peças de feed foram conferidas (`ads_meta_feed` ou `feed`).

### `anuncios/<campanha>/matriz.json` e `matriz.md`

A matriz da primeira leva: `angles` (3 a 4, com `driver`, `hook_family`, `visual`, `promise`) e `pieces` (8 a 12, com `angle`, `format`, `hook`, `needs_recording`). O formato está em `matriz.md` deste app.

### `anuncios/<campanha>/busca-conferida.json`

Os anúncios de texto da Busca do Google conferidos: `campaigns[].ad_groups[].ads[]` com `headlines`, `descriptions`, `path1`, `path2`, `final_url`; `problems` e `warnings` da conferência.

### `anuncios/<campanha>/relatorio.json` e `diario.json`

O relatório da rodada (conceitos, confiança, peças, aprovações) e o diário (`created`, `round`, `launched`, `note` e `results`, a leitura do app de medição com o veredito de cada anúncio e o id do resultado próprio).

### `anuncios/<campanha>/rodada.json` e `rodada.md`

A proposta da rodada seguinte, escrita por `round next`: `round`, `reading`, `period`, `keep[]`, `iterate[]` (com `where_it_fails`), `cut[]`, `unread[]` (cada um com `concept`, `ad_name`, `result_id`, `verdict`, `certainty`, `next_name`), `new_concepts_needed` e `rules`. O app de plano lê `round` e `cut` para o replanejamento.

### `anuncios/<campanha>/sequencia.json` e `sequencia.md`

As quatro peças da data alvo, escritas por `sequence`: `target_date`, `deadline`, `pieces[]` (`id`, `label`, `date`, `schedule_on`, `copy`, `copy_check`, `formats` com a rede de cada formato, `offer` com o preço, o prazo e as linhas do consumidor, `audience`). O app de base lê as datas para a régua dizer a mesma coisa no mesmo dia.

## O resultado próprio

Um resultado do próprio integrante (de uma rodada anterior, de Reels de teste, de uma leitura do app de medição) entra na evidência por uma leitura `declared` com `kind: "own_result"`:

```json
{ "version": 1, "kind": "declared", "entries": [{ "kind": "own_result", "id": "meta-testes-presenca-cena-01", "text": "O anúncio presenca-reels-lembra-v1 fez 36 leads a R$ 14,44, dentro do permitido, em 30/10 a 12/11.", "metrics": [{ "name": "custo_por_lead", "value": 14.44, "unit": "BRL" }], "source": { "what": "leitura meta-testes do app de medição", "collected_at": "2026-11-13" } }] }
```

O id vira `res-<id>` em `evidencias.json`, e a família `resultado` é a evidência mais forte de um conceito. `round next <campanha>` faz isso sozinho a partir do `report.json` do app de medição (`ads-insights/leituras/<leitura>/report.json`, interface 1 com `rows[]`): cada linha cujo `name` é o nome de um anúncio desta campanha (ou cujo `concept` é um conceito dela) vira um item `own_result` com o veredito, a certeza e as métricas; as linhas sem conceito ficam de fora, e um relatório em que nenhuma casa é `report_unmatched`.
