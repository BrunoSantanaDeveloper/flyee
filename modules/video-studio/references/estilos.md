# Os estilos do vídeo

O roteiro diz o que acontece em cada cena; o estilo diz como isso aparece e se move. São cinco estilos com nome, e cada um muda coisas concretas da página: o mundo (fundo escuro ou claro), o tamanho e o peso das letras, o jeito do destaque, o tamanho e a moldura das imagens, as transições entre as cenas, os elementos de apoio (etiqueta numerada, cursor, detalhe) e a deriva das cenas paradas. Todos usam as cores e as fontes da marca que estão no `roteiro.json` (`palette`, `fonts`): o estilo nunca inventa uma cor.

O estilo fica no campo `style` do `roteiro.json`, com um destes ids: `interface-narra`, `interface-que-se-transforma`, `limpo`, `tipografia-cinetica`, `vitrine`. Sem estilo (ou com um estilo descrito por um vídeo de referência), a página usa o estilo padrão do roteiro: `interface-narra` no lançamento, `interface-que-se-transforma` na interface, `vitrine` na oferta e `tipografia-cinetica` na lista.

## Como a página escolhe as cores

- **Dois mundos por marca.** A página monta o mundo da própria marca (o fundo e o texto do site) e o mundo invertido (o texto da marca vira o fundo). O estilo escolhe qual dos dois é o principal: escuro, claro ou o da marca como ela é. O outro mundo aparece em uma ou duas cenas (o número que prova, a assinatura), e a troca acontece por um elemento da cena, nunca por fusão.
- **Um acento só.** A cor de destaque da marca (`accent`) marca uma coisa por cena: a palavra-chave, a etiqueta, o botão, a barra que cresce.
- **Leitura garantida.** Texto corrido sempre com contraste de 4,5:1 ou mais sobre o fundo. Quando a cor de texto da marca não dá leitura no fundo escolhido, a página troca pela tinta que dá (quase preto ou branco) e usa a cor da marca no que não é texto. O texto sobre o acento (o botão, o bloco de destaque) também é conferido.
- **O logo nunca some.** Quando o logo tem a mesma cor do fundo em que vai pousar, ele ganha uma chapa na outra tinta; o logo em si nunca é recolorido.

## `interface-narra`: a interface narra

**Como é.** Mundo escuro. Títulos grandes (peso 800), destaque em bloco de cor sobre a palavra-chave. As telas reais aparecem dentro de um celular (ou de uma janela, para telas de computador), com sombra macia; a câmera muda de lugar a cada recurso e a tela rola até a parte certa. Um cursor de verdade aperta o que importa, na batida. Cada recurso tem uma etiqueta numerada (01, 02…).

**Como se move.** O gancho é atravessado pela câmera: a palavra-chave cresce até virar a passagem, e as bordas dela viram dois riscos. Entre as cenas, chicote para cima com rastro. Molas pesadas no texto, ágeis na interface. Deriva de até 2,5% nas cenas paradas.

**Quando usar.** Aplicativo, site, sistema, curso on-line: tudo que tem tela para mostrar. Lançamentos e apresentações de produto, com o sentimento de confiança ou de surpresa.

**O que muda na página.** `world: dark`, tipo em escala 1, destaque `block`, telas em moldura de aparelho, imagens grandes (peso visual 0,62, a referência), raio 44, sombra forte, travessia no gancho, chicote entre as cenas, rastro, etiquetas, cursor e detalhe ligados.

**O jeito de dizer ao integrante.** "O vídeo vai mostrar as telas de verdade do seu produto dentro de um celular, com um cursor fazendo as ações, em fundo escuro e com cortes rápidos na batida."

## `interface-que-se-transforma`: interface que se transforma

**Como é.** Mundo claro, limpo, com muito respiro. Um único elemento de interface é o protagonista: um botão que vira campo, que vira carregando, que vira um sinal de pronto, que vira um cartão. Texto em peso 700, um pouco menor, com sublinhado de cor na palavra-chave. Sombras suaves.

**Como se move.** O elemento muda de tamanho, de raio e de cor numa mola ágil, sem nenhum corte; o conteúdo dele sai antes de a mudança terminar e o novo entra depois que ela começa. O texto que sai sobe por trás de uma máscara. Deriva de até 2%.

**Quando usar.** Explicar como um produto funciona em poucos passos, mostrar um fluxo (buscar, reservar, pagar, receber), produtos de tecnologia com tom calmo e preciso.

**O que muda na página.** `world: light`, tipo em escala 0,9 e peso 700, destaque `underline`, molduras de aparelho, imagens um pouco menores (peso visual 0,58), raio 56, sombra suave, saída do gancho subindo, troca de cena empurrando para cima, sem rastro e sem etiquetas, cursor e detalhe ligados.

**O jeito de dizer ao integrante.** "Um elemento só da sua interface vai se transformando na batida, de botão em campo, em carregando, em pronto, contando o uso do produto num fundo claro e limpo."

## `limpo`: limpo

**Como é.** O mundo da própria marca (o fundo e a cor de texto do site), pouca coisa por cena, letras médias (peso 700, escala 0,82), sublinhado discreto na palavra-chave. Imagens em cartões com cantos arredondados e sombra leve, menores, com espaço em volta. Sem cursor e sem etiquetas: o produto fala sozinho.

**Como se move.** Devagar e seguro: molas pesadas, textos que entram e saem subindo por trás de máscaras, troca de cena empurrando para cima, nenhum rastro. Deriva de até 1,5%.

**Quando usar.** Marcas premium, saúde, serviços profissionais, institucional; quando o integrante pede algo "elegante", "minimalista" ou "estilo Apple"; sentimento de confiança.

**O que muda na página.** `world: native`, tipo em escala 0,82, destaque `underline`, imagens em cartão, menores e com respiro (peso visual 0,52), raio 36, sombra leve, saída do gancho subindo, troca empurrando, sem rastro, sem etiquetas, sem cursor, detalhe ligado.

**O jeito de dizer ao integrante.** "Um vídeo calmo e elegante, com as cores do seu site, pouca coisa por vez e as imagens com bastante respiro em volta."

## `tipografia-cinetica`: tipografia cinética

**Como é.** Mundo escuro e letras enormes em caixa alta (peso 900, escala 1,22, até cinco linhas empilhadas), com um bloco de cor sobre a palavra-chave. O texto é o protagonista; as imagens, quando existem, ficam menores, em cartões de canto pouco arredondado. Etiquetas numeradas grandes.

**Como se move.** Com energia: palavras e linhas que batem no lugar, numerais que entram com soco, a câmera atravessando o gancho, a etiqueta que estica até virar um risco de tela inteira e corta para a cena seguinte. Rastro nos movimentos mais fortes. Deriva de até 3%.

**Quando usar.** Listas, dicas, erros comuns, opiniões fortes, educação; quando não há telas nem fotos boas; sentimento de surpresa ou de proximidade; quando o integrante pede "texto grande" ou "tipografia".

**O que muda na página.** `world: dark`, tipo em escala 1,22, peso 900 e caixa alta, destaque `block`, imagens em cartão, pequenas: o texto manda (peso visual 0,42; telas de computador nunca viram miniatura), raio 18, sem sombra, travessia no gancho, etiqueta que vira risco entre as cenas, rastro, etiquetas ligadas, sem cursor, sem detalhe nos recursos com imagem (o detalhe aparece quando o recurso é só texto).

**O jeito de dizer ao integrante.** "Um vídeo feito de palavras grandes que batem na tela no ritmo da música, em fundo escuro, com a palavra mais importante de cada cena em destaque."

## `vitrine`: vitrine

**Como é.** Mundo claro e quente, o produto em primeiro lugar: fotos grandes, que sangram de uma borda à outra, e o preço numa chapa por cima da foto. Títulos em peso 800, destaque em bloco de cor. Etiquetas e cursor para a chamada.

**Como se move.** O cartão do produto cresce até virar a tela inteira e pousa na batida em que o preço chega; o preço bate na tela com um soco; a chapa do preço encolhe até virar o botão da chamada, que o cursor aperta. Chicote com rastro entre as cenas. Deriva de até 3%.

**Quando usar.** Loja, produto físico, comida, moda, beleza, ofertas e promoções; sentimento de vontade.

**O que muda na página.** `world: light`, tipo em escala 0,94, destaque `block`, fotos de lado a lado (sem margem e sem raio), imagens maiores (peso visual 0,68), raio 52 nos cartões que não sangram, sombra média, travessia no gancho, chicote entre as cenas, rastro, etiquetas, cursor e detalhe ligados.

**O jeito de dizer ao integrante.** "Um vídeo de vitrine: o seu produto grande na tela, o preço batendo na batida e, no fim, um botão de compra com o seu logo."

## Como escolher

| O integrante quer… | Estilo |
|---|---|
| mostrar um app, um site, um sistema | `interface-narra` |
| explicar um passo a passo de uso | `interface-que-se-transforma` |
| algo elegante, discreto, premium | `limpo` |
| uma lista, dicas, uma opinião, sem telas | `tipografia-cinetica` |
| vender um produto, mostrar uma oferta | `vitrine` |

Quando o integrante descreve um vídeo de referência, escolha o estilo mais perto do que ele disse gostar ("os cortes rápidos" → `interface-narra` ou `tipografia-cinetica`; "a calma, o fundo claro" → `limpo` ou `interface-que-se-transforma`; "o produto bem grande" → `vitrine`) e diga em uma frase qual escolheu e por quê.
