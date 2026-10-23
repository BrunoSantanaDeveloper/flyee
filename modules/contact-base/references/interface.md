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

Uma régua por grupo, cada uma com `state` (`pronta` ou `pendente`), `channel` (`email` ou `whatsapp`), `anchors`, `steps[]` (`id`, `date`, `job`, `subject`, `cta`, `link`, `utm_content` e, no WhatsApp, `template_category`, `approve_by`, `max_chars`) e `rules`. A régua por WhatsApp de um grupo fica na chave `<grupo>@whatsapp` (1.1.0). O app de medição liga cada envio ao `utm_content` da mensagem (`utm_source` diz o canal); o app de plano lê as datas para conferir a fase.

### `contatos/entregabilidade.json` (1.1.0)

A conferência do domínio de envio: `domain`, `overall` (`ok`, `atencao`, `bloqueado`), `items[]` (`id` entre `spf`, `dmarc`, `dkim`, `unsubscribe_one_click`, `legal_footer`, `complaint_rate`, `hard_bounce_rate`, `unsubscribe_rate`; `status` entre `ok`, `missing`, `attention`, `unknown`; `text`, `fix`), `thresholds` e `batches`. O app de plano lê `overall` para o gatilho da base; o app de medição, os `thresholds`.

### `contatos/publicos/<segmento>.json` e `.csv` (1.1.0)

O público para a Meta: o `.json` traz `counts` (`people`, `included`, `unsubscribed`, `no_legal_basis`, `no_reach`, `exclusion_list`), `estimate.matched` (`low`, `mid`, `high`) e `warnings`; o `.csv` tem as colunas `email`, `phone` e `country`, com os dois primeiros em SHA-256, como a Meta pede. `exclusao-clientes.csv` é a lista de exclusão dos clientes atuais, no mesmo formato. O app de criativos e o plano citam as contagens; nenhum deles lê o `.csv`.

### `contatos/voz-leitura.json` (1.1.0)

A voz do cliente como leitura declarada para o app de criativos: `kind: "declared"`, `collected_at`, `source` e `items[]` do tipo `audience_comment` (`id`, `who` com o primeiro nome ou a profissão, `text` como foi dito, `where`). Importa-se como qualquer leitura declarada.

### `contatos/base-legal.md`

A base legal de cada grupo, nos oito campos; o estado de cada grupo é lido por `legal` e por `sequence`.
