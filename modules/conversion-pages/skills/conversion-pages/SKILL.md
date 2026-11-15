---
name: conversion-pages
description: Monta e confere páginas que vendem pelo tipo (landing page, venda de curso, planos, API, order bump, upsell, downsell, cross-sell, obrigado), com modelos reais analisados (Juridiq, JuriChat, Subido AI, Databricks, Hostinger). Use ao pedirem uma dessas páginas, uma no estilo de um modelo ou a revisão de uma delas. A continuidade entre anúncio e página é do ad-landing-page.
---

# Páginas que vendem

Esta skill constrói páginas que vendem pelo tipo, seguindo o roteiro de mercado de cada uma e os modelos reais analisados, e confere a página pronta. Os comandos partem da raiz do projeto aberto. A partir desta pasta, o script fica em `../../scripts/pages.mjs`:

```
node .flyee/modules/conversion-pages/scripts/pages.mjs <comando> --json
```

Só o JSON vai para o stdout. Em erro, `ok` vem `false` e `error` traz `code`, `message` e `fix`. **Todo resultado traz `next_step`.**

**O caminho tem seis passos, nesta ordem, e nenhum é opcional:** `check` e `types`; `new` e `pagina.json`; `plan`; a construção; `audit` e o olhar; a entrega. Vale para uma página simples, para um arquivo HTML solto (`audit <pagina> --url site/index.html`) e para quando ninguém pode responder: então decida pela sua sugestão, registre em `notes` e siga. Escrever a página direto, sem plano, ou entregar sem ter aberto a foto sem letras é a falha que esta skill existe para evitar: uma página entregue assim não está pronta, mesmo que pareça boa no código.

## Regras que não se quebram

1. Nenhuma caixa paga vem marcada, nenhum aceite cobra sem mostrar o valor antes e nenhuma recusa fica escondida ou constrange. A lei trata o item que a pessoa não pediu como amostra, que ela não é obrigada a pagar (`../../references/lei.md`).
2. Preço riscado só se for o preço praticado, e contador só com prazo real. Sem a confirmação do integrante, os dois saem da página. Toda conta de desconto, economia e média mensal fecha com os preços da página.
3. Numa oferta, uma oferta por página. Numa página de vendas, de planos ou de API, um chamado principal e no máximo um secundário. O botão principal tem o mesmo texto onde quer que apareça, e a recusa de uma oferta está sempre visível.
4. A prova fala do produto oferecido, e todo número que a página promete aparece nela, com a origem.
5. Você não inventa fato do negócio, como preço, garantia, prazo, duração do teste ou provedor de pagamento: procura no projeto ou pergunta.
6. Nenhuma taxa de mercado sem fonte. A taxa de aceite do integrante vem da medição dele.
7. Promoção e teste grátis com as regras escritas: até quando, para quem, a que se aplica, quantos dias. Uma janela de promoção nunca cobre a página na chegada.
8. Os modelos já trazem a análise de cada página, inclusive o visual descrito em palavras: use os arquivos do app e não abra o site original para construir. Ele pode ter mudado desde a análise, e a página do integrante segue a marca dele. Do modelo, leve a estrutura, a mecânica e o efeito visual. Nunca copie texto, imagem, logo, cores ou código de outra empresa, ainda mais de uma concorrente do integrante. Se ele pedir para ver o site como está hoje, abra só para ler.
9. Cada figura se entende sem ler e mostra só o que o produto faz hoje. O que for inventado para ela leva a etiqueta "Exemplo fictício". Fora das figuras, número, escassez, nome e data só entram com a origem registrada em `claims`.
10. Quem manda no visual é o pedido do integrante, depois o manual do projeto, depois o modelo escolhido. Numa página que já existe, nada some sem ele pedir: um padrão da lista de vícios é só um aviso, e uma revisão nunca deixa a página com menos figura do que tinha.
11. Conferência em ok não é página boa. Ela mede regras e não vê se a página se entende nem se o texto vende: isso se responde olhando (passo 4).

## Passo 0: o tipo de página

Rode `check` uma vez por sessão e depois `types`. Reconheça o tipo pelo pedido:

| Pedido | Tipo |
|---|---|
| página de vendas, landing page, LP, página inicial do produto | `landing` |
| página de vendas de curso, mentoria, formação ou comunidade, carta de vendas, página do lançamento, inscrições abertas | `curso` |
| página de planos, de preços, tabela de preços, mensal e anual | `planos` |
| página da API, para desenvolvedores, de integração, do servidor MCP | `api` |
| caixa antes de pagar, item a mais no checkout | `order-bump` |
| oferta depois da compra, oferta de um clique, upgrade depois de pagar | `upsell` |
| oferta para quem recusou, última chance | `downsell` |
| produtos relacionados, combina com, quem comprou também levou | `cross-sell` |
| página de obrigado, pedido concluído | `obrigado` |

Um pedido "no estilo de" um modelo, como "a landing page no estilo do Juridiq", é um pedido do tipo desse modelo, com ele como referência principal: a estrutura, a mecânica e o efeito visual, traduzidos para a marca do projeto.

Quando a pessoa compra direto, lendo a página e se inscrevendo, sem demonstração nem teste, a página é `curso`; quando o próximo passo é marcar uma conversa ou testar, é `landing`. Quando a página de vendas é o destino de uma campanha paga, construa-a pelo tipo dela. A skill `ad-landing-page`, do app de criativos para anúncios, escreve o briefing a partir da campanha e confere a continuidade entre o anúncio e a página: use-a antes e depois, quando estiver instalada. Sem ela, avise que essa conferência ficou de fora.

Um pedido que cobre um fluxo inteiro vira uma página por tipo, na ordem do fluxo: order bump, upsell, downsell e obrigado. Um site com página de vendas, planos e API também vira uma página por tipo, com o mesmo cabeçalho, a mesma faixa e o mesmo rodapé.

Antes de planejar, leia:
- `../../references/principios.md`;
- o roteiro do tipo, em `../../references/tipos/<tipo>.md`;
- os modelos que `models --type <tipo>` listar, em `../../references/modelos/`.

## Passo 1: o que o projeto já tem

Antes de perguntar, olhe o projeto:
- o framework e onde ficam as páginas: package.json, as rotas, os componentes;
- o visual da marca: cores, fontes e os componentes de botão e de cartão que já existem;
- o que o produto faz hoje, para as figuras mostrarem só isso;
- o fluxo de compra: o checkout, a página de obrigado, o provedor de pagamento e se ele guarda o meio de pagamento para cobrar com um clique;
- os preços, os planos, o teste, a garantia e os textos que já estão no código;
- de onde vem cada número de prova que a página vai usar.

Rode `new <pagina> --type <tipo>`. Ele cria `pagina.json` e `plano.md` em `paginas/<pagina>/`, ou em `docs/paginas/<pagina>/` quando o projeto já tem `docs/`.

Numa página que já existe, fotografe antes de mexer: `audit <pagina> --url <endereço> --before`. Abra a foto sem letras que ele grava: o que a página já tem de bom fica.

Preencha `pagina.json` com o que encontrou:
- `brand`: as cores e as letras da marca, tiradas do código do projeto ou da captura do site dele, com a origem em `brand.source`. Nunca as de outra empresa;
- `headline`: numa página de vendas, pelo menos cinco títulos de formas diferentes em `headline.options` e o escolhido em `headline.chosen`, pela seção 17 de `../../references/principios.md`. Um título que a página já tem entra como uma das opções e passa pelos mesmos testes;
- `visual.direction`: a direção visual em uma frase, que diga o que torna a página deste produto. Num projeto com marca, a direção mantém a marca. Num pedido no estilo de um modelo, registre em `visual.chosen` os padrões que o arquivo dele lista;
- `demo`: a figura principal: de onde vem a imagem e o que ela mostra, pela ordem de `../../references/demonstracao.md`, nos tipos que têm demonstração;
- `figures`: numa página de vendas, o objeto que cada seção de recurso mostra e o que se entende sem ler, pela seção 1 do mesmo guia;
- `claims`: cada número, escassez ou data de prova, com a origem.

O que ainda faltar (`missing`) vai ao integrante numa mensagem só, com até quatro perguntas, cada uma com uma sugestão escrita de modo que "sim" a aceite; um "ok" aceita as sugestões da rodada. Um fato do negócio (preço, garantia, prazo) vai sem sugestão e pede a resposta dele. Uma pergunta que depende de outra ainda em aberto fica para a rodada seguinte.

## Passo 2: o plano

Com os fatos fechados, rode `plan <pagina>`. O `plano.md` traz a direção visual, a demonstração, as seções na ordem, a mecânica, a medição, as linhas legais e a lista do que conferir à mão. No chat, resuma em três linhas e traga só as decisões: numa página de vendas, o título sugerido e duas alternativas, de modo que um "sim" aceite o sugerido, e o objeto de cada seção numa lista curta. O plano completo fica no arquivo. O passo termina quando `plan` não devolve nada em `missing`.

## Passo 3: construir

- Comece pelo título e pelas figuras: o texto em volta vem depois e é pouco. Use a tecnologia do projeto, pense primeiro no celular e siga o plano seção por seção.
- Se o projeto tem as próprias skills de página, como um manual de design ou uma verificação visual, siga-as na construção e no visual. Esta skill cuida da estratégia do tipo de página e da conferência do que o tipo exige; as duas valem juntas.
- As figuras e os recursos seguem `../../references/demonstracao.md`. Marque cada figura com `data-figura`, com o nome que ela tem em `figures`, e a figura principal com `data-demo`, com o seletor em `demo.selector`.
- Leia `../../references/vicios.md` antes de escrever o texto e de escolher o layout: a lista evita acrescentar por reflexo. O que veio do pedido, do manual ou do modelo fica, e vai em `visual.chosen`.
- Movimento e mídia seguem `../../references/movimento.md`:
  - vídeo de demonstração sem som, em loop, com capa no idioma da página;
  - barra fixa quando o cartão da oferta ou o botão do topo sai da tela;
  - pausa para o que troca sozinho, e números animados já escritos no HTML com o valor final;
  - a regra de menos movimento.
- A medição segue `../../references/medicao.md`: os eventos do tipo e uma identificação por posição de chamado.
- Escreva o texto na voz da marca e revise com a skill `texto-natural` antes de entregar: ela não acrescenta fato, número ou promessa. O título e os chamados perdem só o vício de escrita e mantêm a força.

## Passo 4: conferir

Com a página rodando, rode `audit <pagina> --url <endereço>`. O endereço é `http://localhost:<porta>/<caminho>` durante o desenvolvimento, e o endereço publicado depois. Se a página só abre com login ou no meio de um pedido, peça ao integrante, numa frase, que salve a página no navegador como página da Web em arquivo único. Depois passe o arquivo `.mhtml` em `--url`.

O `audit` usa o Motor de vídeo (`.flyee/modules/video-render/scripts/render.mjs capture`). Se ele não estiver instalado:
1. Diga numa frase: "Vou instalar o Motor de vídeo, que captura a página para a conferência".
2. Rode `npx --yes flyee@latest add video-render --yes --json`, com tempo limite de 10 minutos.
3. Se a instalação falhar, confira lendo o código com a lista do plano, e avise que a conferência automática ficou de fora.

Cada item volta `ok`, `atencao` ou `nao_conferido`. O que a captura não trouxe nunca é dado como reprovado. Corrija o que está em `atencao` e rode `audit` de novo. Confira também, lendo o código, a lista do que conferir à mão no plano.

Depois, olhe. O `audit` grava a página sem nenhuma letra em `files.no_letters` (numa página longa, várias folhas: abra todas, na ordem), as fotos da página em `files.photos`, a página de antes em `files.before` e, quando `demo.selector` está preenchido, a figura principal filmada em `film.sheets`. Abra cada imagem, nunca o código, e responda às perguntas de "Conferir olhando" em `../../references/demonstracao.md`:

1. Sem as letras, o que é cada figura? A resposta precisa ser um objeto. Uma caixa vazia é uma figura que falhou.
2. Lido em voz alta, o título é uma frase que alguém diria?
3. Olhando a primeira tela como quem nunca viu, dá para dizer o que o produto faz e para quem? Se a sua ferramenta abre um agente sem contexto, mostre a foto do topo a ele e pergunte isso, sem explicar nada.
4. Numa página que já existia, há menos figura do que antes? Então a página piorou, e o caminho é voltar.

Uma figura que falhou pede uma figura nova, e não um ajuste: um cartão branco com linhas continua sendo um cartão branco. Troque por um objeto maior e reconhecível, rode `audit` de novo e abra a foto outra vez.

O passo termina quando nada de `atencao` ficou sem correção ou sem motivo e essas quatro respostas estão boas, ou depois de duas rodadas de correção visual: diga ao integrante o que ficou.

## Passo 5: entregar

Resuma em três linhas: a página feita, o que você viu ao olhar e o que ficou para o integrante decidir. Nunca diga que a página ficou boa porque a conferência passou: quem julga é o olho dele. Fale só do que está em `atencao` e em `nao_conferido`, usando as frases de `say`. No fim, registre o uso com `npx --yes flyee@latest track tool.executed --module conversion-pages`.
