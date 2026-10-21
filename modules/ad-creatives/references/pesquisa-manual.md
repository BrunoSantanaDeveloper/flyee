# Pesquisa dos anúncios dos concorrentes

Este guia é para a IA. A pesquisa responde a três perguntas antes de qualquer conceito: quem anuncia para o mesmo público, o que cada um mantém no ar (anúncio que fica meses no ar é anúncio que alguém continua pagando) e o que se repete entre eles. Ela tem dois caminhos: com a chave do Apify, `collect` colhe sozinho; sem ela, a pesquisa acontece no navegador do integrante, porque a Biblioteca de Anúncios da Meta recusa quem chega sem navegador. Nos dois, o app nunca usa o login, o cookie ou a conta do integrante.

## 1. Com a chave: a coleta pelo Apify

`collect <campanha>` lê os concorrentes e as palavras de busca do briefing e colhe os anúncios ativos de cada um pelo coletor anotado em `fontes.json`, nesta pasta, que roda sem conta da Meta.

- **Os limites vão em toda coleta.** Cada concorrente rende até 10 anúncios e cada palavra até 30, em no máximo 12 buscas. A execução leva o limite de itens e um teto de gasto de uma vez e meia a estimativa, e o próprio Apify para nesses limites.
- **Acima de US$ 1, o sim vem antes.** Quando a estimativa passa do valor de `cost_warn_usd`, o comando devolve `needs_confirmation` com o valor. Diga o valor ao integrante e só repita com `--confirm-cost` depois do sim; ou tire concorrentes e palavras do briefing.
- **A mesma coleta não é paga duas vezes.** Com as mesmas buscas, uma coleta de menos de 24 horas é reaproveitada (`cached`), sem cobrança. Para colher de novo, use `--refresh`.
- **Tudo fica guardado.** O que o coletor devolveu, como veio, vai para `pesquisa/apify/anuncios-<dia>-<execução>.json`, com a estimativa e o valor cobrado. Diga ao integrante quanto custou (`cost.charged_usd`).
- **Cada anúncio entra com a origem e a data.** O id é `ad-<pagina>-<número da biblioteca>`, a origem é o endereço do anúncio na Biblioteca e a data é o dia da coleta. Entram os 10 primeiros anúncios de cada página, na ordem em que a Biblioteca os devolveu, sem escolha, com a data de início, o número de versões, o texto, o título, o botão e, quando é vídeo, o endereço dele (`data.media_urls`).
- **Os avisos.** Uma busca pelo nome que não trouxe uma página com esse nome volta em `warnings`: confira o nome com o integrante ou use as palavras do nicho. Uma coleta que parou no limite de itens também avisa que pode haver mais.

Sem a chave, `collect` devolve o comando que abre a página para o integrante colar a chave e manda seguir pelos links. Em `apify_unauthorized` ou `apify_no_credit`, siga o `fix`; em `apify_unavailable`, `apify_timeout` ou `apify_actor_failed`, tente mais tarde. Nos dois casos, a pesquisa segue pelos links enquanto isso.

Uma lista de anúncios do mesmo coletor salva pelo integrante também entra com `import <campanha> <arquivo>`; sem data no arquivo, vale o dia em que ele foi salvo.

## 2. Sem a chave: os links

`links <campanha>` monta, a partir do briefing, um link da Biblioteca por concorrente e um por palavra de busca, já filtrados pelo país, só com anúncios ativos e de todos os tipos, e grava tudo em `pesquisa/links.md`. Mande ao integrante os links e as cinco linhas do roteiro (`script` na resposta), do jeito que vieram.

- **Concorrente se descobre por palavra.** Se o integrante não sabe quem são os concorrentes, ou se a busca pelo nome não acha nada, use as palavras do nicho (a profissão, o problema, o produto). Os nomes que aparecem em mais de uma busca entram no briefing como concorrentes, e `links` roda de novo.
- **Busca pelo nome.** O link de um concorrente sem o número da página é uma busca pelo nome: na lista, o integrante clica no nome da página para ver só os anúncios dela.

## 3. A seleção

O integrante fotografa os **10 primeiros cartões ativos** de cada concorrente, na ordem da tela, todos, sem escolher. Escolher os "bons" esconde o que o concorrente realmente paga. O app ordena depois, pelo tempo no ar. A coleta pelo Apify segue a mesma regra.

| Regra | Valor |
|---|---|
| Cartões por concorrente | 10 |
| Anúncio mantido | no ar há 30 dias ou mais |
| Padrão do mercado | a mesma etiqueta em anúncios ativos de 2 concorrentes ou mais |
| Indício | concorrente com menos de 3 anúncios ativos |

## 4. A leitura das capturas

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

## 5. Etiquetas e o que fica de fora

Os padrões do mercado só aparecem com etiquetas. Para etiquetar anúncios que já estão na evidência, colhidos ou lidos, e para tirar da análise o que não é do mesmo público, grave uma leitura de etiquetas e importe:

```json
{
  "version": 1,
  "kind": "tags",
  "items": [
    { "id": "ad-nome-da-pagina-1234567890", "tags": { "hook_family": "contraste", "visual": "tela-do-produto" } },
    { "id": "ad-outra-pagina-20261012-c04", "exclude": true, "note": "Fala com estudante, não com quem atende." },
    { "id": "ad-nome-da-pagina-9876543210", "analysis": "video-analyses/<id>/descriptions/ad-creatives.md" }
  ]
}
```

- **Separar públicos é leitura, não palavra-chave.** Uma busca por palavra traz anunciantes de outros públicos. Leia o texto de cada anúncio, agrupe, mostre os grupos ao integrante e marque com `exclude` o que ele disser que não é concorrente.
- **Uma página pode anunciar dois produtos.** Filtre pelo texto do anúncio, não só pela página.
- **`analysis` liga um anúncio à descrição da Análise de vídeo** (seção 6): o caminho que o `analyze` dela devolveu em `description`, a partir da raiz do projeto. As etiquetas desse anúncio saem do que a descrição diz.

## 6. Os outros apps

Quando estão no projeto (`check` diz em `partners`), três apps trazem evidência que os anúncios não dão. Você roda os comandos deles, como os guias deles mandam, e `import <campanha> <arquivo>` lê o que gravaram; o app reconhece cada arquivo sozinho.

| App | O que você roda | O que entra |
|---|---|---|
| Pesquisa no Instagram | `outliers` com o perfil da marca e os concorrentes, ou `profile` com um perfil | os posts que fizeram 2 vezes o normal do próprio perfil ou mais: até 10 Reels e até 5 posts estáticos, com o normal ao lado e a amostra pequena dita; e os padrões de duração dos Reels com 3 posts ou mais |
| Pesquisa no Instagram | `comments` de um post | os 20 comentários mais curtidos, como fala do público, sem o nome de quem escreveu |
| Pesquisa no YouTube | `comments` de um vídeo do tema | o mesmo, dos comentários do vídeo, sem os do próprio canal |
| Análise de vídeo | `analyze` do anúncio mantido há mais tempo, com o guia `analise-anuncio.md`, nesta pasta | a descrição segundo a segundo, ligada ao anúncio por uma leitura `tags` com `analysis` |

- Reels e posts estáticos nunca dividem um ranking, e números do Instagram nunca são comparados com os da Biblioteca.
- O endereço do vídeo de um anúncio colhido está em `data.media_urls`. Na pesquisa guiada, peça ao integrante o link do anúncio. Se o vídeo não baixar, diga isso e siga sem a análise; não tente outro caminho por conta própria.
- Um arquivo que não trouxe nada para a evidência (um perfil sem post acima do normal, por exemplo) volta como `reading_invalid`, com o motivo.

## 7. O que o integrante diz

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

Os números vão como texto (`plays_text`, `value_text`), e o app calcula o multiplicador. Um perfil pequeno dá multiplicador alto com poucos plays: o resumo mostra o número absoluto ao lado e chama de indício. Uma duração vai como aparece ("6 s", "1 min 5 s", "0:06"), e o app a converte em segundos. O resultado dos Reels de teste entra assim, como resultado próprio (`reels-de-teste.md`, nesta pasta).

## 8. O resumo

`evidence <campanha>` grava `evidencias.md` e devolve, por concorrente, os anúncios ativos, os mantidos, o maior tempo no ar e as versões; os anúncios mantidos de todos; os padrões do mercado; o orgânico, a fala do público e os resultados próprios; e os avisos (concorrente sem anúncio ativo, indício, anúncios sem etiqueta). Leia o resumo antes de escrever os conceitos.

Se um concorrente não tem nenhum anúncio ativo, diga isso ao integrante: o que ele mostra é história, não o que paga hoje.
