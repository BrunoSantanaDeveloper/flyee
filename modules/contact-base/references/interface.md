# Interface para outros apps (versão 1)

O que este app grava e outros apps leem, e o que ele lê dos outros. Tudo aqui só cresce. **Nenhum arquivo que outro app lê carrega nome, e-mail ou telefone**: a base limpa fica em `contatos/base-limpa.csv`, só para este app, dentro do projeto.

## O que este app lê

| De | Arquivo | Para quê |
|---|---|---|
| app de plano | `media-plan/<plano>/plano.json` (aprovado, ou o mais novo) | as fases (aquecimento e pico) que ancoram a régua, a marca, a página, a regra de link e as formas de oferta |
| app de medição | a regra única de link do plano (`tracking.utm_rule`) | os links de cada mensagem saem com os cinco campos |

## O que este app grava para os outros

### `contatos/inventario.json`

Só contagens. O app de plano lê para saber o tamanho da base e quantos estão sem contato:

```json
{
  "version": 1,
  "generated_at": "2026-10-23",
  "counts": { "rows": 14, "total": 12, "duplicates": 1, "invalid_emails": 2, "phones_without_area_code": 1, "without_email_or_phone": 1, "valid": 10, "with_email": 9, "with_phone": 10, "unsubscribed": 1, "consent_recorded": 7, "stale_6_months": 4 },
  "groups": { "clientes": { "total": 4, "marketable": 4, "stale": 0 }, "ex-clientes": { "total": 3, "marketable": 2, "stale": 2 }, "testaram": { "total": 3, "marketable": 3, "stale": 1 }, "nunca-ativaram": { "total": 2, "marketable": 1, "stale": 1 } },
  "activity": { "ativos": 4, "parados": 3, "inativos": 5 },
  "by_source": { "site": 7, "instagram": 2, "evento": 2, "indicacao": 1 },
  "created_between": { "first": "2024-12-01", "last": "2026-10-15" }
}
```

### `contatos/segmentos.json`

Contagens por segmento (`engajados-30`, `engajados-90`, `engajados-180`, `parados`, `clientes-novos`, `recorrentes`, `vip`, `sem-contato-6-meses`, `compradores-recentes` e os quatro grupos), o resumo do RFM, o teto de mensagens (`caps`), a prioridade e a escada de ofertas (`ladder`).

### `contatos/regua.json`

Uma régua por grupo, cada uma com `state` (`pronta` ou `pendente`), `anchors`, `steps[]` (`id`, `date`, `job`, `subject`, `cta`, `link`, `utm_content`) e `rules`. O app de medição liga cada envio ao `utm_content` da mensagem; o app de plano lê as datas para conferir a fase.

### `contatos/base-legal.md`

A base legal de cada grupo, nos oito campos; o estado de cada grupo é lido por `legal` e por `sequence`.
