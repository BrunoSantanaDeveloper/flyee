---
name: conversion-pages
description: Monta e confere páginas que vendem pelo tipo (landing page, planos e preços, API, order bump, upsell, downsell, cross-sell e obrigado), com a estratégia de mercado e modelos reais analisados (Juridiq, JuriChat, Hostinger). Use quando pedirem uma dessas páginas, uma página no estilo de um desses modelos ou a revisão de uma delas. A continuidade entre anúncio e página é do ad-landing-page.
---

# Páginas que vendem

Esta skill constrói páginas que vendem pelo tipo, seguindo o roteiro de mercado de cada uma e os modelos reais analisados, e confere a página pronta. Os comandos partem da raiz do projeto aberto. A partir desta pasta, o script fica em `../../scripts/pages.mjs`:

```
node .flyee/modules/conversion-pages/scripts/pages.mjs <comando> --json
```

Só o JSON vai para o stdout. Em erro, `ok` vem `false` e `error` traz `code`, `message` e `fix`. **Todo resultado traz `next_step`.**

## Regras que não se quebram

1. Nenhuma caixa paga vem marcada, nenhum aceite cobra sem mostrar o valor antes e nenhuma recusa fica escondida ou constrange. A lei trata o item que a pessoa não pediu como amostra, que ela não é obrigada a pagar (`../../references/lei.md`).
2. Preço riscado só se for o preço praticado, e contador só com prazo real. Sem a confirmação do integrante, os dois saem da página. Toda conta de desconto, economia e média mensal fecha com os preços da página.
3. Numa oferta, uma oferta por página. Numa página de vendas, de planos ou de API, um chamado principal e no máximo um secundário. O botão principal tem o mesmo texto onde quer que apareça, e a recusa de uma oferta está sempre visível.
4. A prova fala do produto oferecido, e todo número que a página promete aparece nela, com a origem.
5. Você não inventa fato do negócio, como preço, garantia, prazo, duração do teste ou provedor de pagamento: procura no projeto ou pergunta.
6. Nenhuma taxa de mercado sem fonte. A taxa de aceite do integrante vem da medição dele.
7. Promoção e teste grátis com as regras escritas: até quando, para quem, a que se aplica, quantos dias. Uma janela de promoção nunca cobre a página na chegada.
8. Os modelos já trazem a análise de cada página, inclusive o visual descrito em palavras: use os arquivos do app e não abra o site original para construir. Ele pode ter mudado desde a análise, e a página do integrante segue a marca dele. Do modelo, leve a estrutura, a mecânica e o efeito visual. Nunca copie texto, imagem, logo, cores ou código de outra empresa, ainda mais de uma concorrente do integrante. Se ele pedir para ver o site como está hoje, abra só para ler.

## Passo 0: o tipo de página

Rode `check` uma vez por sessão e depois `types`. Reconheça o tipo pelo pedido:

| Pedido | Tipo |
|---|---|
| página de vendas, landing page, LP, página inicial do produto | `landing` |
| página de planos, de preços, tabela de preços, mensal e anual | `planos` |
| página da API, para desenvolvedores, de integração, do servidor MCP | `api` |
| caixa antes de pagar, item a mais no checkout | `order-bump` |
| oferta depois da compra, oferta de um clique, upgrade depois de pagar | `upsell` |
| oferta para quem recusou, última chance | `downsell` |
| produtos relacionados, combina com, quem comprou também levou | `cross-sell` |
| página de obrigado, pedido concluído | `obrigado` |

Um pedido "no estilo de" um modelo, como "a landing page no estilo do Juridiq", é um pedido do tipo desse modelo, com ele como referência principal: a estrutura, a mecânica e o efeito visual, traduzidos para a marca do projeto.

Quando a página de vendas é o destino de uma campanha paga, construa-a como `landing`. A skill `ad-landing-page`, do app de criativos para anúncios, escreve o briefing a partir da campanha e confere a continuidade entre o anúncio e a página: use-a antes e depois, quando estiver instalada. Sem ela, avise que essa conferência ficou de fora.

Um pedido que cobre um fluxo inteiro vira uma página por tipo, na ordem do fluxo: order bump, upsell, downsell e obrigado. Um site com página de vendas, planos e API também vira uma página por tipo, com o mesmo cabeçalho, a mesma faixa e o mesmo rodapé.

Antes de planejar, leia:
- `../../references/principios.md`;
- o roteiro do tipo, em `../../references/tipos/<tipo>.md`;
- os modelos que `models --type <tipo>` listar, em `../../references/modelos/`.

## Passo 1: o que o projeto já tem

Antes de perguntar, olhe o projeto:
- o framework e onde ficam as páginas: package.json, as rotas, os componentes;
- o visual da marca: cores, fontes e os componentes de botão e de cartão que já existem;
- o fluxo de compra: o checkout, a página de obrigado, o provedor de pagamento e se ele guarda o meio de pagamento para cobrar com um clique;
- os preços, os planos, o teste, a garantia e os textos que já estão no código.

Rode `new <pagina> --type <tipo>`. Ele cria `pagina.json` e `plano.md` em `paginas/<pagina>/`, ou em `docs/paginas/<pagina>/` quando o projeto já tem `docs/`. Preencha `pagina.json` com o que encontrou. O que ainda faltar (`missing`) vai ao integrante numa mensagem só, com até quatro perguntas, cada uma com uma sugestão escrita de modo que "sim" a aceite; um "ok" aceita as sugestões da rodada. Um fato do negócio (preço, garantia, prazo) vai sem sugestão e pede a resposta dele. Uma pergunta que depende de outra ainda em aberto fica para a rodada seguinte.

## Passo 2: o plano

Com os fatos fechados, rode `plan <pagina>`. O `plano.md` traz as seções na ordem, a mecânica, a medição, as linhas legais e a lista do que conferir à mão. No chat, resuma em três linhas e traga só as decisões; o plano completo fica no arquivo.

## Passo 3: construir

- Use a tecnologia e os componentes do projeto. Comece pelo celular e siga o plano seção por seção.
- Se o projeto tem as próprias skills de página, como um manual de design ou uma verificação visual, siga-as na construção e no visual. Esta skill cuida da estratégia do tipo de página e da conferência do que o tipo exige; as duas valem juntas.
- Movimento e mídia seguem `../../references/movimento.md`:
  - vídeo de demonstração sem som, em loop, com capa no idioma da página;
  - barra fixa quando o cartão da oferta ou o botão do topo sai da tela;
  - pausa para o que troca sozinho, e números animados já escritos no HTML com o valor final;
  - a regra de menos movimento.
- A medição segue `../../references/medicao.md`: os eventos do tipo e uma identificação por posição de chamado.
- Escreva o texto na voz da marca e revise com a skill `texto-natural` antes de entregar: ela não acrescenta fato, número ou promessa.

## Passo 4: conferir

Com a página rodando, rode `audit <pagina> --url <endereço>`. O endereço é `http://localhost:<porta>/<caminho>` durante o desenvolvimento, e o endereço publicado depois. Se a página só abre com login ou no meio de um pedido, peça ao integrante, numa frase, que salve a página no navegador como página da Web em arquivo único. Depois passe o arquivo `.mhtml` em `--url`.

O `audit` usa o Motor de vídeo (`.flyee/modules/video-render/scripts/render.mjs capture`). Se ele não estiver instalado:
1. Diga numa frase: "Vou instalar o Motor de vídeo, que captura a página para a conferência".
2. Rode `npx --yes flyee@latest add video-render --yes --json`, com tempo limite de 10 minutos.
3. Se a instalação falhar, confira lendo o código com a lista do plano, e avise que a conferência automática ficou de fora.

Cada item volta `ok`, `atencao` ou `nao_conferido`. O que a captura não trouxe nunca é dado como reprovado. Corrija o que está em `atencao` e rode `audit` de novo. Confira também, lendo o código, a lista do que conferir à mão no plano.

## Passo 5: entregar

Resuma em três linhas: a página feita, o que a conferência apontou e o que ficou para o integrante decidir. Fale só do que está em `atencao` e em `nao_conferido`, usando as frases de `say`. No fim, registre o uso com `npx --yes flyee@latest track tool.executed --module conversion-pages`.
