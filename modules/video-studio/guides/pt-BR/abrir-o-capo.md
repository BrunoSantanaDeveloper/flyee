# Abrir o capô

Este guia mostra o Estúdio de vídeo por dentro: as etapas de cada vídeo e por que elas existem, os arquivos que ficam no projeto, os pedidos além do básico, as conferências e o que sai do seu computador. Nada disso é necessário para usar o app. Serve para entender o resultado e pedir com mais precisão.

## Como ele trabalha

Todo vídeo passa pelas mesmas etapas: o pedido, as perguntas, a marca, o plano, o roteiro, a prévia e o vídeo final. O app grava o andamento de cada vídeo e sempre diz à IA qual é o próximo passo. Por isso ela retoma de onde parou depois de uma pausa, e nenhuma etapa é pulada: o final é recusado enquanto a prévia atual não tiver o seu sim, a não ser que você tenha pedido para fazer direto.

### 1. O pedido é medido

A IA grava o seu pedido palavra por palavra, e o app procura nele a marca, o objetivo, o assunto e três elementos da história: o tipo de roteiro, os pontos a mostrar e a frase de abertura.

| O pedido traz | O que acontece |
|---|---|
| marca, objetivo, assunto e dois elementos da história | nenhuma pergunta: a IA diz o plano em uma frase e começa |
| marca, objetivo ou assunto, e um elemento da história | uma rodada de no máximo três perguntas; o resto vira padrão |
| menos que isso | até três rodadas guiadas (o vídeo, a história, o jeito), com no máximo quatro perguntas cada, e o plano completo para você aprovar |

Perguntar o que o pedido já disse cansa, e construir um pedido vago sem perguntar dá um vídeo genérico. O app também nunca pergunta o que acha sozinho: o endereço do site escrito no README.md ou no package.json do projeto, e tudo sobre uma marca já guardada.

As perguntas vêm prontas, e a primeira opção de cada uma é a recomendada. O que fica sem resposta recebe o padrão: 15 segundos (20 para vender), as três redes, o sentimento que combina com o objetivo, o estilo do roteiro, a trilha que combina com o sentimento e, no fim, o logo com o site, o @ ou "Link na bio". O plano mostrado fica no `briefing.md`, com a origem de cada decisão.

### 2. A marca de verdade

O Motor de vídeo visita o site com um navegador sem janela e copia o que está publicado: logo, cores, fontes, título, descrição, telas de celular e de computador, produtos com preço, números com a página de origem, chamadas e links das redes. O Estúdio guarda isso como o kit da marca, em `estudio-de-video/marcas/`, e a captura completa fica em `capturas/`.

O app usa só o que capturou ou o que você deu, porque um logo redesenhado de memória, uma cor "parecida" ou um número inventado fazem o vídeo parecer de outra empresa. O que falta vira aviso, nunca palpite: sem cor de destaque clara, o vídeo usa um cinza neutro; sem logo, escreve o nome da marca.

O kit vale por 90 dias. Nesse prazo, um vídeo novo da mesma marca não visita o site de novo, a não ser que você peça. A IA pede a sua confirmação quando a marca foi achada por busca, quando o site se apresenta com outro nome ou quando a página parece provisória. Se o site bloqueia o navegador, não abre ou é só um domínio estacionado, o vídeo segue com visual neutro e a IA pede o logo e duas ou três imagens na pasta de materiais. Um logo seu nessa pasta substitui o do site.

### 3. O roteiro

Todo vídeo nasce de um de cinco roteiros, que definem as cenas, a ordem e quanto cada cena pode durar:

| Roteiro | Para quê | As cenas |
|---|---|---|
| Lançamento | apresentar ou lançar | gancho, o produto se montando na tela, de 2 a 4 recursos, um número que prova (se houver) e assinatura |
| Interface que se transforma | mostrar como um app ou um site funciona | o ícone da marca, de 4 a 10 estados de um mesmo elemento (botão, campo, carregando, pronto, cartão, gráfico, lista, aviso, busca) e assinatura |
| Oferta | vender | gancho, o produto, o preço batendo na tela, o prazo (se houver) e chamada |
| Lista | ensinar ou opinar em itens soltos | gancho, de 3 a 5 itens numerados e chamada |
| Passo a passo | explicar como algo funciona ou como se faz | gancho, de 2 a 5 passos em ordem ligados por um caminho que avança, o resultado (quando você diz qual é) e chamada |

O objetivo escolhe: vender pede a oferta, explicar pede o passo a passo, apresentar e lançar pedem o lançamento. Dicas, erros e motivos que não dependem da ordem vão para a lista. A interface entra quando você a pede ou a escolhe na pergunta sobre a história. O material desempata: telas boas puxam o lançamento ou a interface, fotos com preço puxam a oferta, nenhuma imagem puxa a lista ou o passo a passo. Cada cena aceita de 4 a 6 palavras no texto principal e até 10 no detalhe, porque no celular uma frase longa só cabe pequena. Um texto maior é recusado com o nome da cena e do campo.

O primeiro rascunho sai do plano e da marca, e cada texto guarda a sua origem: é ela que aparece ao lado de cada número na prévia. Antes de renderizar, a IA lê as cenas e corrige o que ficou longo ou sem sentido.

### 4. O estilo

O roteiro diz o que acontece; o estilo diz como aparece e se move.

| Estilo | Como é | Combina com |
|---|---|---|
| A interface conta a história | fundo escuro, as telas reais num celular, um cursor que aperta na batida, cortes rápidos | apps, sites, sistemas, cursos |
| Interface que se transforma | fundo claro, um único elemento que muda de forma a cada batida, sem cortes | explicar um fluxo curto |
| Limpo | as cores do site, pouca coisa por cena, movimento calmo | marcas premium, saúde, serviços profissionais |
| Letras em movimento | fundo escuro, letras enormes em caixa alta batendo na tela | listas, dicas, vídeos sem boas imagens |
| Vitrine | fundo claro e quente, o produto de borda a borda, o preço numa chapa | loja, comida, moda, ofertas |

Todos usam só as cores e as fontes da marca, com contraste de 4,5:1 ou mais em todo texto corrido. Se a cor de texto da marca não dá leitura no fundo, a página usa quase preto ou branco. O logo nunca é recolorido, girado ou desfocado; se ele sumiria no fundo, ganha uma chapa.

### 5. O som na batida

O vídeo anda numa grade de batidas, a mesma da trilha: andamento entre 100 e 140 batidas por minuto, cenas medidas em compassos de quatro batidas e toda troca de cena numa batida. Um vídeo de 15 segundos tem 8 compassos a 128; um de 20, 10 compassos a 120. Corte fora do tempo da música é o defeito mais comum de vídeo feito às pressas, e com a grade ele não acontece.

O Motor compõe a trilha no seu computador, na duração e no andamento exatos, em um de seis estilos (limpa, enérgica, calorosa, mínima, cinematográfica, brincalhona) escolhido pelo sentimento do vídeo. Os efeitos sonoros marcados no roteiro também movem a imagem: no impacto o título pousa com um tranco, no clique o cursor aperta, no tique um contador rola.

Com a sua música, o Motor mede a batida e o vídeo segue esse andamento, lido pela metade ou pelo dobro para ficar entre 80 e 160 batidas por minuto. Uma batida pouco clara gera um aviso, e uma música mais curta que o vídeo deixa o fim sem trilha. O som final é mixado em -14 LUFS, com pico abaixo de -1 dBTP, e some nos 0,4 segundo finais.

### 6. A página e a prévia

O vídeo é uma página da web que desenha qualquer instante dele, escrita a partir do modelo do roteiro e do `roteiro.json`. O Motor a abre num navegador sem janela, fotografa 30 quadros por segundo e junta tudo.

A prévia sai em 540×960, com som, mais uma folha com um quadro por batida. Antes de mostrar, a IA dá a essa folha notas de 1 a 10 (abertura, leitura no celular, movimento, variedade, fidelidade à marca, som), corrige os três piores problemas e refaz. São pelo menos duas rodadas, até tudo chegar a 8 ou até a quinta, quando ela diz o que ficou abaixo. A conferência automática mede tamanho, posição e tempo, mas não percebe uma frase sem sentido; isso quem vê é a IA, e depois você.

Com a prévia vêm os textos da tela com a origem de cada um, às vezes outras aberturas tiradas do site e, se o pedido fala em publi ou parceria, a pergunta se o vídeo é publicidade paga.

### 7. O vídeo final e a entrega

Com o seu sim, o final sai em 1080×1920 com desfoque de movimento e é conferido de novo, agora no arquivo que vai ser publicado. A capa é o primeiro quadro. As notas de entrega dizem onde postar, sugerem o texto do post (só com o que está no vídeo), contam de onde veio a música e listam o que ainda depende de você: o direito de uso de uma música sua, a marca não confirmada, o número de prova e a página de origem, o preço e o prazo, as regras do seu setor (saúde, odontologia, advocacia, apostas, propaganda política, público infantil) e os rótulos de parceria paga e de conteúdo feito com IA, este só se você acrescentar fotos ou vozes geradas. Se o vídeo muda depois do sim, o sim deixa de valer e uma prévia nova vem antes do final.

## Os arquivos por dentro

Cada vídeo tem uma pasta em `estudio-de-video/` com o nome da marca e do roteiro, como `loja-aurora-oferta` (um nome repetido ganha `-2`).

| Arquivo ou pasta | O que guarda | Dá para pedir mudança? |
|---|---|---|
| `pedido.json` | o andamento: respostas, aprovações, histórico | não: só o app escreve nele |
| `briefing.md` | o plano, com a origem de cada decisão | pela conversa |
| `roteiro.json` | cenas, textos, compassos, efeitos, andamento, trilha, cores, fontes e estilo | sim: quase toda mudança passa por aqui, e o app confere de novo |
| `roteiro.anterior.json` | o roteiro ajustado à mão, guardado quando o vídeo foi reescrito a partir do plano | serve para recuperar um ajuste |
| `pagina.html` | a página que desenha o vídeo | para ajuste fino de uma cena; ela é reescrita a cada reconstrução, e a IA cola o ajuste de novo |
| `assets/` | cópias do logo, das telas e das fotos usadas | não: troque o original |
| `materiais/` | os seus arquivos e um LEIA-ME.txt | é a sua pasta; o app só lê |
| `audio/` | a trilha, os efeitos e a grade de batidas | não: muda pelo roteiro |
| `previa/`, `entrega/` | a prévia e a folha de quadros; o vídeo final, a capa, as notas e os relatórios | não: refaça pela conversa |

Na pasta do vídeo ficam ainda `motion.js` e `studio.js`, as bibliotecas da página, e `render/`, com renders intermediários sem som. Fora das pastas de vídeo estão `estudio-de-video/pedido.txt` (o último pedido, palavra por palavra), `estudio-de-video/marcas/` (um `marca.json` por marca, com o que foi capturado, as decisões que você já tomou e a cópia do logo) e `capturas/` (a captura completa de cada site). Para corrigir a marca de vez, peça uma nova visita ao site ou ponha o logo certo nos materiais. As cores de um vídeo ficam no roteiro dele.

## Pedidos avançados

Tudo se pede em palavras. A IA leva o pedido para o roteiro ou para as opções do app e faz uma prévia nova.

| Peça assim | O que muda por dentro |
|---|---|
| "Use o estilo limpo." | o estilo |
| "Faça como lista, com cinco erros comuns." | o roteiro e as cenas |
| "Destaque a palavra 'família' no quarto recurso." | a palavra em destaque da cena |
| "Na terceira cena, mostre a parte de preços do site." | até onde a tela do site rola |
| "Dê mais tempo ao item que tem detalhe." | os compassos da cena |
| "Deixe o vídeo mais rápido." | o andamento e, com ele, a duração |
| "Use uma trilha mais calma." ou "Só efeitos, sem música." | a trilha |
| "Use a minha música, que está nos materiais." | a trilha vira o seu arquivo, e os cortes seguem a batida dele |
| "Use as cores do nosso manual: #1E3A8A e #FFFFFF." | as cores deste vídeo |
| "Na cena 4, mostre um antes e depois em dois cartões." | o desenho da cena, ajustado na página |
| "Visite o site de novo, mudamos o logo." | uma nova captura da marca |
| "Faz direto, não precisa me mostrar." | sem a parada para o seu sim na prévia |
| "Recomece este vídeo do zero." | o vídeo volta ao começo; os seus materiais ficam |

Outros formatos (4:5, 1:1, 16:9) e vídeos acima de 20 segundos ficam fora desta versão. Um projeto pode guardar várias marcas, mas para clientes diferentes o melhor é um projeto para cada um: assim a marca, os vídeos e as capturas de um nunca se misturam com os de outro.

## As conferências

Antes da prévia e de novo no final, o Motor de vídeo confere o que dá para medir. Cada item sai como ✓ passou, ✗ reprovou, △ aviso ou ○ não medido. Os tamanhos valem para um quadro de 1080 de largura.

| Item | O limite |
|---|---|
| A página do vídeo | abre e desenha sem erro; um erro aqui interrompe a conferência |
| Capa legível | o primeiro quadro, que vira a miniatura, já tem texto de 44 px ou mais |
| Texto e logo longe dos botões | nada de texto ou logo nas áreas que as redes escolhidas cobrem com botões, nome e legenda |
| Tamanho do texto | 44 px passa; de 60% a 100% disso é aviso; abaixo de 60% reprova |
| Cortes na batida | todo corte a no máximo 1 quadro da batida |
| Piscadas | mais de 3 mudanças bruscas de luz em 1 segundo é aviso, nunca reprova |
| Tempo parado | 1,5 segundo ou mais sem nada mudar é aviso, nunca reprova |
| Volume | -14 LUFS (com folga de 1,5) e pico até -1 dBTP passa; pico entre -1 e 0 é aviso; o resto reprova |
| Formato e duração, por rede | o que Reels, TikTok e Shorts aceitam e recomendam |
| O arquivo final | fora de 1080×1920, ou mudo quando o roteiro tem som, reprova; duração diferente do roteiro em mais de 0,15 segundo é aviso |

A conferência não sabe se o texto faz sentido, se a cena ficou bonita, se a marca é a certa ou se o preço ainda vale. Isso fica com o olhar da IA e com o seu.

Quando um item reprova, a IA não chama o vídeo de pronto. Cada reprovação vem com o que fazer, e ela corrige, refaz e confere de novo: menos palavras em vez de letra menor, o texto de volta para dentro da área livre, os tempos corrigidos nos compassos do roteiro (nunca na página), o texto da primeira cena já pousado no primeiro quadro. Se você decidir publicar assim mesmo, ela diz exatamente o que ficou reprovado. Os relatórios ficam em `previa/aceite.json` e `entrega/relatorio.json`.

## Com outros apps

O Estúdio divide o trabalho com o Motor de vídeo, outro app do flyee.club, instalado no mesmo projeto. O Estúdio cuida das decisões: as perguntas, o plano, o kit da marca, o roteiro, a página e as notas. O Motor cuida da máquina: a visita ao site, a trilha e os efeitos, a batida da sua música, o render, a mixagem e a conferência, a mesma que outros apps de vídeo do flyee.club usam. Se o Motor faltar, a IA diz o que ele declara e o instala depois do seu sim.

Nesta versão o Estúdio não chama o app de análise de vídeo, e por isso um vídeo de referência não é assistido: a IA pede que você o descreva em uma frase.

## Privacidade

- A única conexão do app é a visita ao site da marca. Quando você só diz o nome, a IA procura o site oficial na internet e mostra o endereço antes de usar.
- O app não envia nada do seu computador. A trilha é composta, e o vídeo é renderizado, mixado e conferido na sua máquina.
- Os seus arquivos são lidos onde estão e nunca são alterados; o vídeo usa cópias.
- Não há chave nem conta externa nesta versão.
- A sua IA lê o pedido, as respostas, os textos e a folha de quadros como lê tudo o que você mostra a ela, dentro do seu plano de IA.
- No fim de um vídeo, a IA registra no flyee.club que o app foi usado: o nome do evento e do app, nunca o pedido, a marca, os textos ou os arquivos.
- Nunca ponha senhas nos materiais: o que está ali pode aparecer no vídeo.

## Problemas comuns

| O que acontece | O que fazer |
|---|---|
| O site bloqueou o navegador, não abriu ou ainda não tem a marca | diga outro endereço, ou ponha o logo e duas ou três imagens na pasta de materiais |
| A IA achou a marca errada | responda que não é essa e diga o site certo |
| O logo saiu serrilhado, ou o nome aparece no lugar dele | ponha nos materiais o logo em SVG, ou em PNG com 200 px de altura ou mais |
| O logo aparece sobre uma chapa de cor | ele tem a cor do fundo; mande a versão para fundo claro ou escuro, ou mantenha a chapa |
| As telas de dentro do sistema não aparecem | o app só vê o que é público; ponha prints com "tela" ou "print" no nome |
| A batida da sua música não é clara | confira os cortes na prévia; se não caírem no tempo, troque a música ou use a trilha original |
| O fim do vídeo ficou sem música | a música é mais curta que o vídeo; use uma mais longa ou peça um vídeo mais curto |
| Um ajuste feito na página sumiu | a página é reescrita a cada reconstrução; peça o ajuste de novo |
