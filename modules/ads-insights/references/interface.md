# Interface para outros apps (versão 1)

Este app serve os outros: o app de criativos lê o veredito de cada peça para propor a rodada seguinte, e o app de plano lê a leitura da semana para refazer o plano. Tudo o que está aqui só cresce: campos novos entram, os existentes não mudam de nome nem de significado.

## Onde ficam os arquivos

Na pasta `ads-insights/` da raiz do projeto:

| Arquivo | O que é |
|---|---|
| `medicao.json` | o contrato de medição: cada item com `value` e `status` (`verificado`, `informado`, `desconhecido`) |
| `origens.csv` | a planilha de origem: `data, etapa, origem, meio, campanha, conteudo, parceiro, valor_brl, qualificado, pseudonimo`; nunca um nome, um e-mail ou um telefone |
| `leituras/<id>/tabela.json` | o export normalizado: `source`, `level`, `fields`, `missing`, `period`, `rows[]` com os campos do export |
| `leituras/<id>/report.json` | o veredito por peça, `interface_version` 1 |
| `semanal/<AAAA-MM-DD>.json` | a leitura da semana: achados, movimentos propostos, vereditos dos movimentos anteriores |
| `movimentos.json` | os movimentos: propostos, aplicados e julgados |

## `report.json`

```json
{
  "interface_version": 1,
  "app": "ads-insights",
  "reading": "meta-testes",
  "source": "meta",
  "level": "ad",
  "period": { "start": "2026-10-30", "end": "2026-11-12" },
  "event": "Lead",
  "allowable_brl": 40,
  "allowable_source": "contrato de medição",
  "counts": { "escalar": 1, "manter": 0, "iterar": 2, "cortar": 1, "negativar": 0, "dado_insuficiente": 2 },
  "rows": [
    {
      "name": "AL-BF26-presenca-cena-01",
      "concept": "presenca",
      "angle": "presenca",
      "adset": "AL-BF26-frio-amplo",
      "verdict": "escalar",
      "certainty": "confirmado",
      "where_it_fails": null,
      "reasons": ["36 resultados a R$ 14,44 cada, dentro do permitido de R$ 40..."],
      "readings": null,
      "metrics": { "spend": 520, "impressions": 26000, "hook_rate": 0.3, "link_ctr_pct": 1.5, "visits": 320, "results": 36, "cost_per_result_brl": 14.44 },
      "legible": { "hook_ctr": true, "cost": true, "visits": true },
      "spend_multiple": 13,
      "cost_multiple": 0.36,
      "legible_when": []
    }
  ]
}
```

- `verdict`: `escalar`, `manter`, `iterar`, `cortar`, `negativar` (só termos de pesquisa) ou `dado_insuficiente`.
- `certainty`: `confirmado`, `provavel` ou `primeira-leitura`. Abaixo da amostra mínima a certeza nunca é `confirmado`.
- `where_it_fails`: `gancho`, `miolo`, `pagina` ou `anuncio` quando o veredito é `iterar` ou `cortar`; senão `null`.
- `readings`: quando a leitura está no limiar, as duas interpretações (`change` e `hold`) para o integrante escolher.
- `concept` e `angle` vêm do `nomes.json` da entrega quando a linha casou; uma linha que não casou não os tem.
- `rows` vem em ordem de gasto, do maior para o menor.

## `semanal/<data>.json`

```json
{
  "interface_version": 1,
  "week_of": "2026-11-13",
  "plan": "black-friday-2026",
  "readings": { "meta": "meta-testes", "google": "google-termos" },
  "findings": [{ "text": "...", "certainty": "confirmado", "source": "planilha de origem" }],
  "ledger": { "lines": 12, "by_stage": { "lead": 2, "compra": 10 }, "claim_ratio": 1.3 },
  "since_last_time": [{ "id": "M1", "verdict": "funcionou", "text": "..." }],
  "proposed": ["M3", "M4"],
  "open_moves": ["M1"],
  "not_checked": ["E-mail: usado, não medido"]
}
```

## `movimentos.json`

Cada movimento: `id`, `tipo` (`subir_verba`, `pausar`, `nova_versao`, `negativar`, `segurar`, `conferir_rastreamento`), `objeto`, `nivel`, `texto`, `porque`, `certeza`, `conferir_em`, `gatilho`, `proposto_em`, `aplicado_em`, `legivel_em`, `veredito` (`funcionou`, `nao_funcionou`, `cedo`, `nao_da_para_dizer`) e `evidencia` com o antes e o depois. Um movimento sem `aplicado_em` nunca recebe veredito.

## Como o app de criativos lê a rodada seguinte

1. Pegue a leitura mais recente de `leituras/` com `source: "meta"` e `level: "ad"`.
2. Para cada `row` com `concept`, o resultado próprio do anúncio é a evidência mais forte da rodada: `escalar` mantém o conceito e pede variações do mesmo gancho; `iterar` troca só o que `where_it_fails` aponta; `cortar` tira o conceito da rodada; `dado_insuficiente` segue como está, e o texto diz que ainda não dá para julgar.
3. Cite `reading` e `name` na ficha do conceito novo, nunca o número sozinho.

## Como o app de plano lê o replanejamento

`semanal/<data>.json`: `findings` e `ledger.by_stage` dizem se a meta anda; `ledger.claim_ratio` fora de 1,0 a 1,5 é um gatilho de rastreamento; `since_last_time` diz o que funcionou. O custo por resultado da plataforma nunca substitui a planilha de origem na decisão de verba.
