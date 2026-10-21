# Pesquisa dos anúncios dos concorrentes

Este guia é para a IA. A pesquisa responde a três perguntas antes de qualquer conceito: quem anuncia para o mesmo público, o que cada um mantém no ar (anúncio que fica meses no ar é anúncio que alguém continua pagando) e o que se repete entre eles. Ela acontece no navegador do integrante: a Biblioteca de Anúncios da Meta recusa quem chega sem navegador, e o app nunca usa o login, o cookie ou a conta do integrante.

## 1. Os links

`links <campanha>` monta, a partir do briefing, um link da Biblioteca por concorrente e um por palavra de busca, já filtrados pelo país, só com anúncios ativos e de todos os tipos, e grava tudo em `pesquisa/links.md`. Mande ao integrante os links e as cinco linhas do roteiro (`script` na resposta), do jeito que vieram.

- **Concorrente se descobre por palavra.** Se o integrante não sabe quem são os concorrentes, ou se a busca pelo nome não acha nada, use as palavras do nicho (a profissão, o problema, o produto). Os nomes que aparecem em mais de uma busca entram no briefing como concorrentes, e `links` roda de novo.
- **Busca pelo nome.** O link de um concorrente sem o número da página é uma busca pelo nome: na lista, o integrante clica no nome da página para ver só os anúncios dela.

## 2. A seleção

O integrante fotografa os **10 primeiros cartões ativos** de cada concorrente, na ordem da tela, todos, sem escolher. Escolher os "bons" esconde o que o concorrente realmente paga. O app ordena depois, pelo tempo no ar.

| Regra | Valor |
|---|---|
| Cartões por concorrente | 10 |
| Anúncio mantido | no ar há 30 dias ou mais |
| Padrão do mercado | a mesma etiqueta em anúncios ativos de 2 concorrentes ou mais |
| Indício | concorrente com menos de 3 anúncios ativos |

## 3. A leitura das capturas

As capturas ficam em `pesquisa/capturas/<concorrente>/`, numeradas na ordem da tela. Leia cada cartão e grave em `pesquisa/leituras/<concorrente>.json` o texto **como aparece**: a data, o número de versões e o estado vão como texto, e o app os converte. Você nunca converte data ou número.

```json
{
  "version": 1,
  "kind": "ad_cards",
  "competitor": "Nome da página, como aparece",
  "collected_at": "2026-10-12",
  "source": { "type": "screenshot", "ref": "pesquisa/capturas/nome-da-pagina/" },
  "items": [
    {
      "capture": "pesquisa/capturas/nome-da-pagina/01.png",
      "library_id": "Identificação da biblioteca: 1234567890",
      "status_text": "Ativo",
      "started_text": "Veiculação iniciada em 3 de jul de 2026",
      "variations_text": "3 anúncios usam esse criativo e esse texto",
      "text": "o texto do anúncio, como aparece",
      "headline": "o título, quando há",
      "cta": "Saiba mais",
      "media": "video",
      "tags": { "angle": "presenca", "hook_family": "pergunta", "proof": "demonstracao", "structure": "problema-mecanismo", "visual": "pessoa-falando" }
    }
  ]
}
```

| Campo | Regra |
|---|---|
| `collected_at` | o dia em que as capturas foram feitas, AAAA-MM-DD |
| `source.type` | `screenshot` (capturas) ou `link` (só os links dos anúncios; cada cartão leva `url`) |
| `capture` | a captura de onde o cartão foi lido; **sem ela o cartão não entra** |
| `started_text` | a linha da data inteira, com o ano: "Veiculação iniciada em 3 de jul de 2026"; um anúncio encerrado traz as duas datas |
| `variations_text` | a linha das versões, quando aparece; sem ela, o anúncio conta como uma versão |
| `status_text` | "Ativo" ou "Inativo", quando aparece |
| `media` | `video`, `imagem` ou `carrossel` |
| `tags` | as etiquetas de `etiquetas.json`, nesta pasta; dá para deixar para depois |

Rode `import <campanha> pesquisa/leituras/<concorrente>.json`. Uma leitura que o app não entende volta como `reading_invalid`, com o campo exato (`items[2].started_text`): corrija o texto copiado e importe de novo. A mesma leitura importada duas vezes substitui, nunca duplica.

## 4. Etiquetas e o que fica de fora

Os padrões do mercado só aparecem com etiquetas. Para etiquetar anúncios que já estão na evidência, e para tirar da análise o que não é do mesmo público, grave uma leitura de etiquetas e importe:

```json
{
  "version": 1,
  "kind": "tags",
  "items": [
    { "id": "ad-nome-da-pagina-1234567890", "tags": { "hook_family": "contraste", "visual": "tela-do-produto" } },
    { "id": "ad-outra-pagina-20261012-c04", "exclude": true, "note": "Fala com estudante, não com quem atende." }
  ]
}
```

- **Separar públicos é leitura, não palavra-chave.** Uma busca por palavra traz anunciantes de outros públicos. Leia o texto de cada anúncio, agrupe, mostre os grupos ao integrante e marque com `exclude` o que ele disser que não é concorrente.
- **Uma página pode anunciar dois produtos.** Filtre pelo texto do anúncio, não só pela página.

## 5. O que o integrante diz

O que o integrante sabe e não está na Biblioteca entra como uma leitura `declared`, com a origem e a data:

```json
{
  "version": 1,
  "kind": "declared",
  "collected_at": "2026-10-12",
  "source": { "type": "declared", "ref": "conversa com o integrante" },
  "items": [
    { "kind": "audience_comment", "who": "cliente no WhatsApp", "text": "a frase como a pessoa escreveu" },
    { "kind": "organic_post", "who": "@perfil", "text": "o post", "plays_text": "12,3 mil", "baseline_text": "1,1 mil", "url": "https://www.instagram.com/reel/…" },
    { "kind": "organic_pattern", "who": "nicho", "text": "o padrão, numa frase", "n": 40 },
    { "kind": "own_result", "text": "o anúncio de março", "metrics": [{ "name": "CTR do link", "value_text": "1,2%" }] }
  ]
}
```

Os números vão como texto (`plays_text`, `value_text`), e o app calcula o multiplicador. Um perfil pequeno dá multiplicador alto com poucos plays: o resumo mostra o número absoluto ao lado e chama de indício.

## 6. O resumo

`evidence <campanha>` grava `evidencias.md` e devolve, por concorrente, os anúncios ativos, os mantidos, o maior tempo no ar e as versões; os anúncios mantidos de todos; os padrões do mercado; o orgânico, a fala do público e os resultados próprios; e os avisos (concorrente sem anúncio ativo, indício, anúncios sem etiqueta). Leia o resumo antes de escrever os conceitos.

Se um concorrente não tem nenhum anúncio ativo, diga isso ao integrante: o que ele mostra é história, não o que paga hoje.
