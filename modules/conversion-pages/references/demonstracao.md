# As figuras e a demonstração do produto

Este guia é para a IA. Vale para toda figura de uma página que vende: a do topo, a de cada seção, o console da página de API e a demonstração animada, quando há uma.

Quem decide o visual, nesta ordem: o pedido do integrante, o manual de design do projeto, o modelo que ele escolheu e, no que nenhum deles decide, este guia. Se discordarem, siga o que vem primeiro e registre a diferença no plano.

## 1. A figura se entende sem ler

Quem chega não conhece o produto e ainda não decidiu ler nada: olha. Cada figura mostra um objeto que essa pessoa reconhece em três segundos, e ela entende o assunto da seção antes da primeira palavra.

| Funciona | Por quê |
|---|---|
| um telefone com a conversa, o nome de quem fala e o campo de digitar | todo mundo sabe o que é: atendimento pelo celular |
| um calendário com os dias marcados e o último em destaque | prazos, sem ler nada |
| um gráfico, um radar, uma lista com marcas de conferido, um documento assinado | o resultado aparece na forma |
| a janela grande de um sistema, com menu e painéis, e um ou dois cartões soltos por cima | há um produto de verdade, e ele é inteiro |

| Não funciona | Por quê |
|---|---|
| um cartão branco com uma frase dentro | é texto em caixa, e pede leitura |
| um balão de conversa solto, sem telefone | não diz onde a conversa acontece |
| um pedaço da interface que só quem já usa reconhece, como uma barra de etapas ou uma lista de eventos | parece importante e não explica nada |
| uma janela pequena, com texto que ninguém lê nesse tamanho | vira um borrão de interface |
| um cartão branco com uma tabela ou com linhas de texto | sem as letras, é uma caixa com riscos. Uma lista só vira figura com o que a identifica: as marcas de conferido, a nota fiscal, a pasta, o gráfico |

**O teste.** O `audit` grava a página sem nenhuma letra (`files.no_letters`). Olhe cada figura nela e diga o que é. Se a resposta for "uma caixa" ou "uns blocos", a figura falhou, mesmo com o texto certo. Um telefone continua sendo telefone, e um calendário, calendário.

Antes do código, escreva em `pagina.json` (`figures`) o que a pessoa vê em cada seção:

| Campo | O que responde |
|---|---|
| `name` | o nome da figura, igual ao `data-figura` dela na página |
| `section` | a seção |
| `object` | o objeto que se reconhece: "telefone com a conversa", "calendário do mês" |
| `says` | o que quem olha entende sem ler, em uma frase |

Se a resposta de `object` é "cartão" ou "painel", procure de novo. Perguntas frequentes, planos e depoimentos ficam de fora: lá, ler é o objetivo. Uma seção de recurso sem figura ainda não foi pensada.

## 2. De onde vem a imagem

A tela do produto foi feita para quem trabalha nela todo dia, e a figura é para quem nunca a viu. Por isso a ordem é esta, e `demo.kind` registra a escolha da cena principal:

| Ordem | `demo.kind` | O que é | Quando usar |
|---|---|---|---|
| 1 | `replica` | uma versão desenhada para a página, com as cores, a letra e as palavras do produto, e só o objeto em foco | o caminho normal: mostra o que o produto faz e deixa de fora o que confunde quem chegou |
| 2 | `tela` | a tela real, em foto ou gravação | a tela é bonita e, no tamanho da página, passa a ideia de um sistema inteiro |
| 3 | `componentes` | os componentes do produto, importados do projeto, com dados fixos | o componente, naquele tamanho, já é um objeto reconhecível, como um calendário ou um gráfico |

Desenhar a figura não é inventar: o que ela mostra precisa existir no produto (seção 3). Usar o componente de verdade não salva uma figura que não se entende. Numa dúvida entre a verdade do componente e a clareza do desenho, fique com o desenho e confira a verdade em `demo.real_today`.

Com `componentes`:

- passe dados fixos por propriedades ou por um invólucro pequeno. A cena nunca chama um serviço de verdade, nunca lê dado de cliente e funciona sem login;
- o que muda no tempo (digitar, clicar, a resposta chegar) é um roteiro de estados sobre esses componentes, com a biblioteca de animação que o projeto já usa;
- o texto do componente é o do produto, e costuma ser longo para uma figura: corte, ou desenhe.

## 3. A regra que não se quebra

A figura mostra só o que o produto faz hoje. O que a página mostra obriga quem vende (CDC, art. 30), e mostrar um recurso que não existe é publicidade enganosa (art. 37, §1).

- Antes de construir, ache no código onde está cada coisa que a figura mostra, ou pergunte ao integrante, e registre em `demo.real_today`. O que ainda não existe fica de fora.
- Nome de cliente, processo, valor e resultado inventados são dados de exemplo: registre `demo.sample_data: true` e ponha a etiqueta "Exemplo fictício" no canto da figura ou logo abaixo dela, pequena, como no modelo do Juridiq. Uma etiqueta por seção basta.
- Os dados de exemplo contam uma história só: o mesmo sistema tem a mesma permissão, a mesma pessoa tem o mesmo nome e o mesmo número tem o mesmo valor em todas as figuras da página. Duas figuras que se contradizem parecem defeito do produto, justo no que ele vende. O nome de um cliente de verdade nunca entra num exemplo fictício, porque vira um caso que não aconteceu.
- Logo de cliente, número de uso e depoimento dentro da figura só quando forem verdade.
- Nenhuma tela ou ícone de outra empresa como se fosse do produto. A logo de outra empresa entra só como ela é e quando é verdade: a de um cliente que autorizou e a de uma ferramenta com que o produto se integra hoje, com o arquivo oficial dela (seção 15).

## 4. A figura principal, antes do código

A figura do topo, animada ou parada, é a principal. Preencha `demo` em `pagina.json`; o `plan` leva para o plano:

| Campo | O que responde |
|---|---|
| `kind` | de onde vem a imagem (seção 2) |
| `shows` | o objeto em foco: o telefone, o calendário, a janela |
| `action` | a única ação da cena; vazio quando ela é parada |
| `result` | o que muda e fica na tela, ou o que ela mostra quando é parada |
| `left_out` | o que fica de fora |
| `real_today` | onde cada coisa mostrada existe no produto |
| `animated` | `true` quando se mexe, `false` quando é parada |

Se a resposta de `action` tem um "e", são duas cenas: escolha uma. Uma figura parada e clara vence uma cena animada confusa.

## 5. A história

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

## 6. O que está escrito na figura

- **O que é para ler é pouco:** de 3 a 7 textos curtos. São o título, a coisa em que a ação toca, o que é digitado e o resultado.
- **Uma frase dentro de uma figura tem até 15 palavras.** Vale para um balão de conversa: duas ou três mensagens curtas contam melhor do que uma longa.
- **O resto é desenho e pode ser denso.** Os dias do calendário, as linhas de uma tabela e os números de um painel são vistos, não lidos. O limite é do que pede leitura, não de elementos, e barras discretas com larguras diferentes substituem o que ninguém precisa ler.
- Rótulo e valor são os dois em palavras ou os dois em barras.
- Um número grande; os outros são linhas.
- Cada coisa é dita uma vez, e o que o título da seção já disse não volta na figura.
- Mantenha o que identifica o ramo do produto, como capas de álbum numa ferramenta de música, processos num sistema jurídico.
- Tamanho de verdade: texto de 11 a 15 px mostrado sem encolher, no que é para ler.
- Um recurso de IA mostra o que faz: a pergunta, a resposta chegando, a fonte. Estrelinha, varinha e roxo como cor de IA não dizem nada.
- Ícones de um conjunto só, com a mesma espessura e o mesmo tamanho: primeiro os do projeto. Nada desenhado à mão.

## 7. O enquadramento

- **Tamanho.** A figura do topo usa a largura do conteúdo. A figura de um recurso ocupa cerca de metade da largura e pesa mais do que o texto ao lado dela.
- **Peso.** A figura se separa da página: moldura, sombra ou uma placa de cor. Brilho, vidro, uma leve inclinação e cartões flutuantes valem quando fazem parte do manual ou do modelo escolhido.
- **Um objeto principal e no máximo um ou dois menores,** de tipos diferentes: a janela e uma notificação, o telefone e um selo.
- O objeto menor fica sobre a borda do principal, cerca de metade para fora, cobrindo moldura e nunca conteúdo.
- A janela grande pode ficar inteira, com o menu e a moldura, e entrar na seção seguinte, como no modelo do Juridiq. Corte só o que é enchimento: o botão, a ação e o resultado ficam inteiros.
- Nenhum canto vazio sem motivo, nenhum vazio embaixo de uma lista.

## 8. No celular

A figura tem um segundo desenho, na largura da coluna (cerca de 358 px numa tela de 390). Corte mais perto, tire ou empilhe o objeto menor e mantenha a ação e o resultado inteiros. A mesma cena encolhida passa em qualquer conferência de largura e fica ilegível. Um telefone cabe inteiro no celular; uma janela, em geral, não: mostre um painel dela.

## 9. A capa

É o quadro que a maioria vê: antes de carregar, com menos movimento pedido, numa foto da página. Ela conta a história sozinha: o resultado na tela, nunca um quadro no meio de uma mudança. Cubra o movimento e pergunte o que aconteceu; se a capa não responde, escolha outro momento.

## 10. O movimento

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

## 11. Dentro da página

- Marque cada figura com `data-figura="<name>"`, o mesmo nome de `figures`. A figura principal leva `data-demo`, e o seletor dela vai em `demo.selector`. É por essas marcas que a conferência acha as figuras e filma a principal.
- Nenhum `h1` a `h6` dentro da cena: entrariam no sumário da página. O título da tela simulada é um `div`.
- Um texto alternativo diz o que a figura mostra (`role="img"` e `aria-label`), e o resto dela fica de fora do leitor de tela.
- A cena roda só quando está na tela, e para quando sai.
- Com o pedido de menos movimento, ela mostra a capa, parada.
- Quando se mexe por mais de 5 s ao lado de outro conteúdo, tem como pausar (veja `movimento.md`).
- A cena nunca atrasa o título e o botão.
- O CSS fica sob a classe da cena, para não vazar para a página.

## 12. Os erros

| Erro | Como aparece | O que fazer |
|---|---|---|
| Texto em caixa | a figura é uma frase dentro de um cartão; sem as letras, sobra uma caixa | troque por um objeto: o telefone, o calendário, o gráfico |
| Pedaço de interface | um recorte que só quem usa o produto reconhece | mostre a janela inteira, grande, ou desenhe o objeto em foco |
| Demais | frases por toda a figura, números por todo lado | corte o que pede leitura para 3 a 7 textos curtos |
| Encolhida | a janela inteira num tamanho em que nada se distingue | aumente até a largura do conteúdo, ou mostre um objeto só |
| Esqueleto | dois blocos cinza e um botão | mais produto em volta, num tamanho maior |
| Plana | tudo com o mesmo peso, na mesma moldura | um objeto lidera; o olho precisa de onde pousar |
| Genérica | uma janela cinza que serviria a qualquer produto | as cores, a letra, os cantos e o conteúdo deste produto |

## 13. Os recursos da página

O que sustenta uma página de vendas é uma sequência de figuras grandes, cada uma com pouco texto ao lado.

1. **Os recursos principais ganham uma linha cada:** a figura de um lado, com cerca de metade da largura, e do outro um título de até 8 palavras com o resultado e até duas linhas de apoio. Os lados se alternam. Escolha de 3 a 5.
2. **Os recursos menores** terminam a seção em até três cartões curtos, com ícone, título e uma frase.
3. **Cartão é para o que é pequeno:** um título de até 6 palavras e uma frase de até 20. Com mais do que isso, o recurso merece uma linha com figura, ou o texto está sobrando. A conferência aponta o cartão que pede mais de 32 palavras de leitura e o que tem um buraco.
4. **Uma grade de blocos** só quando o integrante, o manual ou o modelo pedirem. Então cada bloco tem figura ou número, nunca título, frase e um vazio; um bloco lidera; a figura de um bloco é um objeto só, sem frase dentro; vizinhos são diferentes, e nenhum texto, avatar ou moldura se repete.
5. No celular, tudo empilha com a figura primeiro, e cada figura ganha o seu desenho.

## 14. Conferir olhando

A conferência automática mede regra. Ela não vê se a página se entende nem se o texto vende: isso é você, olhando. Abra cada foto que o `audit` grava e responda nesta ordem, sem voltar ao código:

1. **Sem letras (`files.no_letters`, no computador e no celular).** O que é cada figura? A resposta precisa ser um objeto. Há uma seção de recurso sem nada para ver? Uma sequência de caixas brancas é a página pedindo para ser lida.
2. **O título (o topo em `files.photos`).** Leia em voz alta. É uma frase que alguém diria? Veja a seção 17 de `principios.md`.
3. **Quem nunca viu.** Olhe a primeira tela como quem chegou agora: o que este produto faz, e para quem? Se a sua ferramenta abre um agente sem contexto, mostre a foto do topo a ele e pergunte isso, sem explicar nada. O que ele responder é o que a página diz.
4. **Antes e depois (`files.before`).** Numa página que já existia, compare a foto sem letras de antes com a de agora. Se agora há menos figura, a página piorou, mesmo com a conferência toda em ok: volte.
5. **A cena (`film.sheets`).** O que está cortado tem texto? Onde o olho pousa primeiro? É o resultado? Algo surge de repente? O fim leva ao começo? Com menos movimento, a capa conta a história?
6. **Uma história só.** Compare os dados de exemplo de uma figura com os das outras: o que o diagrama do topo diz de cada sistema é o que a tabela mais abaixo mostra? Um nome, uma permissão ou um número que muda de uma figura para outra se corrige antes de entregar.
7. **Os ícones sem os nomes.** Na foto sem letras, os ícones ficam sem os nomes: dá para dizer qual recurso cada um é? Algum objeto aparece em dois recursos? Troque o que não passa (seção 15).

Corrija primeiro a maior falha visível e olhe de novo. Pare em duas rodadas de correção e diga ao integrante o que ficou, porque depois disso cada rodada muda pouco.

## 15. Os diagramas, os ícones próprios e as logos reais

Num produto que liga coisas (uma plataforma, uma integração, um fluxo de trabalho), a figura mais clara costuma ser um diagrama desenhado com as peças do próprio produto, como faz a Databricks (`modelos/databricks-pagina-de-produto.md`).

**O diagrama do produto.** Uma das formas abaixo, desenhada para a página (`replica`):

- **as camadas:** faixas empilhadas, do que a pessoa usa em cima ao que sustenta embaixo, cada uma com o nome e os ícones do que vive nela;
- **o fluxo:** cartões com o ícone e o nome de cada peça, setas finas entre eles, cada fluxo com uma cor e o rótulo do lado ("pedidos", "respostas");
- **o centro com raios:** a peça central no alto, com as capacidades em etiquetas, linhas descendo até o que ela conecta, e um último cartão de borda tracejada ("e mais…") só quando há mais de verdade;
- **a órbita:** as ferramentas que o produto aceita em volta, com as palavras do ciclo (construir, usar, medir).

O fundo é a superfície da seção, nunca branco puro; a cor de destaque fica só no fluxo e no que é ação; um brilho suave atrás da peça principal ajuda o olho a pousar nela. Cada peça desenhada existe hoje no produto (seção 3).

O diagrama resume como as peças se ligam, mas não mostra o produto funcionando. Depois dele, cada recurso principal ainda ganha a sua figura numa linha própria (seção 13), nunca escondida numa aba: a tabela de permissões com as chaves, o gráfico do limite, o registro de cada ação.

**A figura mostra o produto agindo.** Num produto que controla alguma coisa (gasto, prazo, permissão), a figura mais clara é a do momento em que ele age: no gráfico, a linha do limite, a barra que passa dela na cor de alerta e o aviso do que o produto fez ("agente pausado ao passar do limite do mês"); no registro, a ação que ele negou e o motivo. Barras sempre abaixo do teto mostram um número; a barra que passa e é parada mostra o recurso.

**Os ícones próprios.** Cada recurso do produto ganha um ícone desenhado para ele, numa família só:

- uma metáfora do resultado, não da tecnologia: uma lâmpada para o assistente que atende pedidos, um giroflex para o alerta;
- a mesma grade e as mesmas duas cores do destaque da marca, em formas cheias e simples; os de conceito, maiores, em traço único;
- o mesmo ícone no menu, nos cartões e dentro dos diagramas, para a pessoa aprender o símbolo uma vez;
- antes de desenhar, faça a lista: cada recurso, o objeto do ícone e por que ele não serve a outro recurso da página. Num sistema de clínica, a agenda é um calendário com o dia marcado, o lembrete é um sino com um relógio, o prontuário é uma pasta com a cruz e o faturamento é um recibo. Uma moeda sozinha serviria ao faturamento, ao preço e ao repasse, então não diz qual é;
- dois recursos nunca dividem o mesmo objeto. Uma pessoa, uma moeda, um gráfico de barras e pontos ligados por linhas servem a qualquer produto: sozinhos, não dizem nada;
- cada ícone passa no teste sem o nome: se ele lembra outra coisa, troque. Um ponto de exclamação ou um X dentro do ícone de um recurso se lê como alerta ou erro;
- os ícones de biblioteca ficam para a interface (busca, setas, fechar), nunca para os recursos do produto.

**As logos reais.** Prova de quem usa ou do que se conecta é a logo, nunca o nome escrito imitando uma:

- o arquivo oficial de cada empresa, tirado do kit de marca dela, com o nome no texto alternativo;
- só a de um cliente que autorizou e a de uma ferramenta com que o produto se integra hoje; registre cada uma em `claims`, com a origem da autorização ou da integração;
- sem o arquivo oficial, a ferramenta aparece pelo nome inteiro e pelo que o produto faz com ela ("Google Agenda: lê os horários livres e marca a consulta"). Uma sigla dentro de um quadrado parece logo improvisada;
- uma legenda que diga o que elas são, com as palavras da autorização ("Empresas que usam o produto e autorizaram mostrar a logo");
- todas inteiras e com a mesma altura: 24 px numa fileira, até 55 px a logo quadrada ou alta;
- poucas logos, as que cabem numa largura de tela, ficam numa fileira parada: nenhuma repetida, nenhuma cortada ou esmaecida na borda;
- a fileira que passa é para quando há mais logos do que a tela mostra: a mesma logo nunca aparece duas vezes na mesma vista, há um botão de pausa e, com menos movimento pedido, ela para;
- numa cor só, apenas com o contraste do texto: preta sobre o claro, branca sobre o escuro, nunca um cinza claro. Poucas logos se leem melhor nas próprias cores. Dentro de um diagrama, a logo da ferramenta mantém as cores dela;
- sem logos autorizadas, a fileira não existe: um número com origem ("usado por 1.200 escritórios") prova melhor que uma fileira de nomes.
