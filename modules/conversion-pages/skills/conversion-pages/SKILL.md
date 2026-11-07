---
name: conversion-pages
description: Monta e confere páginas de oferta pelo tipo (order bump, upsell, downsell, cross-sell e página de obrigado) com a estratégia de mercado de cada uma e modelos reais analisados. Use quando pedirem uma dessas páginas, uma oferta no checkout ou depois da compra, ou a revisão de uma delas. A página de destino de anúncio fica com o ad-landing-page.
---

# Páginas que vendem

Esta skill constrói páginas de oferta pelo tipo, seguindo o roteiro de mercado de cada uma e os modelos reais analisados, e confere a página pronta. Os comandos partem da raiz do projeto aberto. A partir desta pasta, o script fica em `../../scripts/pages.mjs`:

```
node .flyee/modules/conversion-pages/scripts/pages.mjs <comando> --json
```

Só o JSON vai para o stdout. Em erro, `ok` vem `false` e `error` traz `code`, `message` e `fix`. **Todo resultado traz `next_step`.**

## Regras que não se quebram

1. Nenhuma caixa paga vem marcada, nenhum aceite cobra sem mostrar o valor antes e nenhuma recusa fica escondida ou constrange. A lei trata o item que a pessoa não pediu como amostra, que ela não é obrigada a pagar (`../../references/lei.md`).
2. Preço riscado só se for o preço praticado, e contador só com prazo real. Sem a confirmação do integrante, os dois saem da página.
3. Uma oferta por página. O botão principal tem o mesmo texto onde quer que apareça, e a recusa está sempre visível.
4. A prova fala do produto oferecido, e todo número que a página promete aparece nela.
5. Você não inventa fato do negócio, como preço, garantia, prazo ou provedor de pagamento: procura no projeto ou pergunta.
6. Nenhuma taxa de mercado sem fonte. A taxa de aceite do integrante vem da medição dele.

## Passo 0: o tipo de página

Rode `check` uma vez por sessão e depois `types`. Reconheça o tipo pelo pedido:

| Pedido | Tipo |
|---|---|
| caixa antes de pagar, item a mais no checkout | `order-bump` |
| oferta depois da compra, oferta de um clique, upgrade depois de pagar | `upsell` |
| oferta para quem recusou, última chance | `downsell` |
| produtos relacionados, combina com, quem comprou também levou | `cross-sell` |
| página de obrigado, pedido concluído | `obrigado` |

A página de destino de um anúncio pago fica com a skill `ad-landing-page`, do app de criativos para anúncios; use-a quando estiver instalada. Sem ela, siga `../../references/principios.md` e avise que a conferência entre o anúncio e a página ficou de fora.

Um pedido que cobre um fluxo inteiro (order bump, upsell, downsell e obrigado) vira uma página por tipo, na ordem do fluxo.

Antes de planejar, leia:
- `../../references/principios.md`;
- o roteiro do tipo, em `../../references/tipos/<tipo>.md`;
- os modelos que `models --type <tipo>` listar, em `../../references/modelos/`.

## Passo 1: o que o projeto já tem

Antes de perguntar, olhe o projeto:
- o framework e onde ficam as páginas: package.json, as rotas, os componentes;
- o visual da marca: cores, fontes e os componentes de botão e de cartão que já existem;
- o fluxo de compra: o checkout, a página de obrigado, o provedor de pagamento e se ele guarda o meio de pagamento para cobrar com um clique;
- os preços, a garantia e os textos que já estão no código.

Rode `new <pagina> --type <tipo>`. Ele cria `pagina.json` e `plano.md` em `paginas/<pagina>/`, ou em `docs/paginas/<pagina>/` quando o projeto já tem `docs/`. Preencha `pagina.json` com o que encontrou. O que ainda faltar (`missing`) vai ao integrante numa mensagem só, com até quatro perguntas, cada uma com uma sugestão.

## Passo 2: o plano

Com os fatos fechados, rode `plan <pagina>`. O `plano.md` traz as seções na ordem, a mecânica, a medição, as linhas legais e a lista do que conferir à mão. No chat, resuma em três linhas e traga só as decisões; o plano completo fica no arquivo.

## Passo 3: construir

- Use a tecnologia e os componentes do projeto. Comece pelo celular e siga o plano seção por seção.
- Se o projeto tem as próprias skills de página, como um manual de design ou uma verificação visual, siga-as na construção e no visual. Esta skill cuida da estratégia do tipo de página e da conferência do que o tipo exige; as duas valem juntas.
- Movimento e mídia seguem `../../references/movimento.md`:
  - vídeo de demonstração sem som, em loop, com capa no idioma da página;
  - barra fixa quando o cartão da oferta sai da tela;
  - a regra de menos movimento.
- A medição segue `../../references/medicao.md`: os eventos do tipo e uma identificação por posição de chamado.
- Escreva o texto na voz da marca e revise com a skill `texto-natural` antes de entregar.

## Passo 4: conferir

Com a página rodando, rode `audit <pagina> --url <endereço>`. O endereço é `http://localhost:<porta>/<caminho>` durante o desenvolvimento, e o endereço publicado depois. Se a página só abre com login ou no meio de um pedido, peça ao integrante, numa frase, que salve a página no navegador como página da Web em arquivo único. Depois passe o arquivo `.mhtml` em `--url`.

O `audit` usa o Motor de vídeo (`.flyee/modules/video-render/scripts/render.mjs capture`). Se ele não estiver instalado:
1. Diga numa frase: "Vou instalar o Motor de vídeo, que captura a página para a conferência".
2. Rode `npx --yes flyee@latest add video-render --yes --json`, com tempo limite de 10 minutos.
3. Se a instalação falhar, confira lendo o código com a lista do plano, e avise que a conferência automática ficou de fora.

Cada item volta `ok`, `atencao` ou `nao_conferido`. O que a captura não trouxe nunca é dado como reprovado. Corrija o que está em `atencao` e rode `audit` de novo. Confira também, lendo o código, a lista do que conferir à mão no plano.

## Passo 5: entregar

Resuma em três linhas: a página feita, o que a conferência apontou e o que ficou para o integrante decidir. Fale só do que está em `atencao` e em `nao_conferido`, usando as frases de `say`. No fim, registre o uso com `npx --yes flyee@latest track tool.executed --module conversion-pages`.
