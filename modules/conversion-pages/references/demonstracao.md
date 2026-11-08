# A demonstração do produto na página

Este guia é para a IA. Vale para o topo da página de vendas, a seção "o produto funcionando", o console da página de API e a demonstração do upsell. A cena é curta: uma coisa acontece, e quem olha entende o que mudou.

Quando o projeto tem um manual de design, o manual decide o visual. Estas regras valem no que ele não decide. Se os dois discordarem, siga o manual e registre a diferença no plano.

## 1. De onde vem a imagem

Escolha nesta ordem e registre em `pagina.json` (`demo.kind`):

| Ordem | `demo.kind` | O que é | Quando usar |
|---|---|---|---|
| 1 | `componentes` | os componentes de verdade do produto, importados do código do projeto, com dados fixos | o código do produto está neste projeto |
| 2 | `tela` | a tela real do produto, em foto ou gravação | o produto existe, e os componentes dependem demais do sistema para rodar fora dele |
| 3 | `replica` | uma versão simplificada, feita para a página | não há código nem tela para usar, ou a tela real fica ilegível no tamanho da página |

Com `componentes`:

- passe dados fixos por propriedades ou por um invólucro pequeno. A cena nunca chama um serviço de verdade, nunca lê dado de cliente e funciona sem login;
- o que muda no tempo (digitar, clicar, a resposta chegar) é um roteiro de estados sobre esses componentes, com a biblioteca de animação que o projeto já usa;
- o projeto continua sendo a fonte: quando o componente mudar, a cena muda junto.

Uma tela inteira no tamanho do topo costuma ficar confusa. Corte até o painel em que a cena acontece (seção 6).

## 2. A regra que não se quebra

A cena mostra só o que o produto faz hoje. O que a página mostra obriga quem vende (CDC, art. 30), e mostrar um recurso que não existe é publicidade enganosa (art. 37, §1).

- Antes de construir, ache no código onde está cada coisa que a cena mostra, ou pergunte ao integrante, e registre em `demo.real_today`. O que ainda não existe fica de fora.
- Nome de cliente, processo, valor e resultado inventados para a cena são dados de exemplo: registre `demo.sample_data: true` e ponha a etiqueta "Exemplo fictício" junto da cena, como no modelo do Juridiq.
- Logo de cliente, número de uso e depoimento dentro da cena só quando forem verdade.
- Nenhuma tela, logo ou ícone de outra empresa.

## 3. Antes do código

A maior parte da qualidade se decide aqui. Preencha `demo` em `pagina.json`; o `plan` leva para o plano:

| Campo | O que responde |
|---|---|
| `shows` | o objeto em foco: a tela, o painel ou o cartão onde a cena acontece |
| `action` | a única ação da cena |
| `result` | o que muda e fica na tela |
| `left_out` | o que fica de fora |
| `real_today` | onde cada coisa mostrada existe no produto |

Se a resposta de `action` tem um "e", são duas cenas: escolha uma.

## 4. A história

Escolha a forma pelo que o produto tem de melhor:

- **Como é usar:** o gesto é a história. Um cursor faz uma coisa, e o resultado aparece sob ele.
- **Um fluxo:** algumas telas contadas como um objeto só, com o resultado na última.
- **O que o sistema faz sozinho:** a consequência aparece em outro lugar, sem cursor, e a ligação fica visível.

As medidas:

- de 3 a 5 momentos e um resultado, em 10 a 16 s;
- a cena abre numa tela pronta, que funciona parada, nunca num vazio;
- o resultado fica parado por cerca de 2 s, e nada mais fica parado por mais de 3 s;
- em menos de 1 s depois da saída, a próxima ação já começou.

Entre uma história mais rica e um quadro mais calmo, fique com o quadro.

No loop:

- o que a cena acrescentou sai junto, num movimento só, ou com uma causa visível, como um botão de limpar;
- um número nunca volta atrás à vista;
- o último quadro leva ao primeiro sem emenda.

## 5. A tela

- Conte os textos reais: em geral, de 3 a 7. São o título, a coisa em que a ação toca, o que é digitado e o resultado. Numa `replica`, o resto vira barras discretas, com larguras diferentes; com `componentes`, use poucas linhas de dados curtos.
- O limite é de textos, não de elementos: um calendário precisa de uma semana cheia, e uma busca precisa de resultados.
- Barra só nas bordas. Onde o olho pousa, há palavras.
- Rótulo e valor são os dois em palavras ou os dois em barras.
- Um número grande; os outros são linhas.
- Cada coisa é dita uma vez.
- Mantenha o que identifica o ramo do produto, como capas de álbum numa ferramenta de música, processos num sistema jurídico.
- Tamanho de verdade: texto de 11 a 15 px mostrado sem encolher. Escala que deixa o texto abaixo de 10 px pede outro corte.
- Um recurso de IA mostra o que faz: a pergunta, a resposta chegando, a fonte. Estrelinha, varinha e roxo como cor de IA não dizem nada.
- Ícones de um conjunto só, com a mesma espessura e o mesmo tamanho: primeiro os do projeto. Nada desenhado à mão.

## 6. O enquadramento

- Um objeto principal e no máximo um ou dois menores, de tipos diferentes: um cartão e uma notificação, nunca dois cartões iguais.
- O objeto menor fica sobre a borda do principal, cerca de metade para fora, cobrindo moldura e nunca conteúdo.
- Corte só o que é enchimento. O botão, a ação e o resultado ficam inteiros. O principal pode sair por uma ou duas bordas, de 10% a 40% para fora.
- A página é o fundo: sem placa colorida atrás da janela. Uma janela inteira, flutuando com a mesma margem nos quatro lados, parece captura colada.
- De frente e reta. Inclinação, só depois de comparar com a versão reta no tamanho final.
- Uma margem só: toda distância até a borda da cena é igual, ou claramente maior.
- Nenhum canto vazio sem motivo, nenhum vazio embaixo de uma lista.

## 7. No celular

A cena tem um segundo desenho, na largura da coluna (cerca de 358 px numa tela de 390). Corte mais perto, tire ou empilhe o objeto menor e mantenha a ação e o resultado inteiros. A mesma cena encolhida passa em qualquer conferência de largura e fica ilegível. Nenhum texto abaixo de 10 px.

## 8. A capa

É o quadro que a maioria vê: antes de carregar, com menos movimento pedido, numa foto da página. Ela conta a história sozinha: o resultado na tela, nunca um quadro no meio de uma mudança. Cubra o movimento e pergunte o que aconteceu; se a capa não responde, escolha outro momento.

## 9. O movimento

- Todo movimento tem causa. Se a história fica mais clara sem ele, corte.
- O que entra tem entrada, e o que sai tem saída. Nada surge de um quadro para o outro.
- O que chega abre o espaço junto: a linha nova leva as de baixo, em vez de empurrá-las de repente.
- Um cartão chega inteiro, com o conteúdo, nunca vazio primeiro.
- Um texto que muda muda só na parte que mudou. Um botão que muda de texto muda nele mesmo, sem trocar de elemento.
- Os números rolam na direção certa e assentam uma vez.
- A resposta a um clique é rápida como no produto. Só o movimento que conta a história é mais lento.
- Duas curvas bastam: `cubic-bezier(0.45, 0, 0.1, 1)` para viajar e `cubic-bezier(0.25, 0.8, 0.25, 1)`, em cerca de 0,8 a 1 s, para chegar.
- Elementos em sequência entram de 40 a 80 ms um depois do outro.

O cursor, quando há:

- cada movimento leva à próxima ação;
- ele nunca cobre o texto em que clica;
- descansa em área vazia, perto do próximo passo;
- muda de forma conforme o que está embaixo.

## 10. Dentro da página

- Marque o elemento da cena com `data-demo` e registre o seletor em `demo.selector`. É por ele que a conferência acha e filma a cena.
- Nenhum `h1` a `h6` dentro da cena: entrariam no sumário da página. O título da tela simulada é um `div`.
- Um texto alternativo diz o que a cena mostra (`role="img"` e `aria-label`), e o resto da cena fica de fora do leitor de tela.
- A cena roda só quando está na tela, e para quando sai.
- Com o pedido de menos movimento, ela mostra a capa, parada.
- Quando se mexe por mais de 5 s ao lado de outro conteúdo, tem como pausar (veja `movimento.md`).
- A cena nunca atrasa o título e o botão.
- O CSS fica sob a classe da cena, para não vazar para a página.

## 11. Os cinco erros

| Erro | Como aparece | O que fazer |
|---|---|---|
| Demais | texto real em toda linha, números por todo lado | corte para 3 a 7 textos |
| Esqueleto | dois blocos cinza e um botão | mais produto em volta, num tamanho maior |
| Encaixotada | a janela inteira encolhida num cartão, com margens iguais | corte até o painel e deixe sair pela borda |
| Plana | tudo com o mesmo peso, na mesma moldura | um objeto lidera; o olho precisa de onde pousar |
| Genérica | uma janela cinza que serviria a qualquer produto | as cores, a letra, os cantos e o conteúdo deste produto |

## 12. A grade de recursos

Quando a seção de recursos vira uma grade de blocos, ela é uma figura só, e não cinco demonstrações lado a lado.

1. Um bloco lidera: maior, com a ideia principal.
2. De um terço à metade dos blocos mostra tela. Os outros são um número, uma frase grande, um objeto, um diagrama, uma coleção de marcas ou uma foto real.
3. Um bloco de tela mostra uma coisa só: o controle, em tamanho real ou maior. Moldura de janela aparece no máximo uma vez.
4. Vizinhos diferentes: figura ao lado de número, denso ao lado de calmo. Dois recortes de janela nunca ficam lado a lado.
5. Um bloco de número traz um número verdadeiro, com origem, e um rótulo curto, com número e unidade na mesma linha.
6. O texto é curto e fica fora da figura: de 1 a 4 palavras no título e no máximo uma frase de apoio, no tamanho do texto da página.
7. Os blocos têm o mesmo raio e o mesmo espaço, com o texto sempre no mesmo lugar.
8. Nenhum texto, avatar ou moldura se repete de um bloco para outro.
9. Só um lidera o movimento. Os outros fazem uma coisa pequena ao entrar, uma vez, com 80 a 120 ms entre eles.
10. Conte os itens antes de escolher a grade, para nenhum bloco sobrar vazio.
11. No celular, a grade empilha com o líder primeiro, e cada figura ganha o seu desenho.

## 13. Conferir olhando

O `audit` filma a cena marcada no computador, no celular e com menos movimento, e grava as folhas de quadros em `filme/` na pasta da página. Abra as três e responda olhando para os quadros, nunca para o código, nesta ordem:

1. **O enquadramento:** o que está cortado tem texto? Sobra canto vazio? Há placa atrás da janela?
2. **A hierarquia:** onde o olho pousa primeiro? É o resultado? Esta cena podia ser de qualquer produto do ramo?
3. **O movimento:** algo surge de repente? O fim leva ao começo? Com menos movimento, a capa conta a história?
4. **O acabamento:** os textos cabem? O espaço está igual? Os ícones combinam?

Corrija primeiro a maior falha visível e filme de novo. Pare em duas rodadas de correção e diga ao integrante o que ficou, porque depois disso cada rodada muda pouco.
