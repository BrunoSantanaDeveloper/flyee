# O estilo da casa

Um carrossel animado bom parece feito por um estúdio pequeno e seguro de si: pouca coisa na tela, grande, numa cor só com um acento, movendo-se na batida. Este guia é o que você aplica em todo slide e o que confere nos quadros antes de dizer que ficou bom. Os helpers e as opções estão em `slide-page.md`; o roteiro, em `storyboard.md`; o som, em `sound.md`. Os tamanhos e as posições daqui são os dos modelos e do exemplo, no formato 4:5.

## 1. Uma cor protagonista, um acento

Cada tema tem um fundo (a cor protagonista), uma tinta para o texto, um cinza para os rótulos e **um** acento.

| Tema | Fundo | Tinta | Rótulo | Acento | Quando usar |
|---|---|---|---|---|---|
| `noir` | `#0C0C0E` | `#F3F1EA` | `#8A8781` | `#E6C15A` (ouro) | opinião forte, provocação, marca pessoal séria; tem grão |
| `cobalt` | `#0A3DD6` | `#FFFFFF` | `#9DB6FF` | `#FF7A1A` (laranja) | lançamento, produto, energia |
| `paper` | `#F4F1EA` | `#141413` | `#8E8A80` | `#D97757` (terracota) | ensino, método, calma; o único de fundo claro |
| `forest` | `#0F2A1E` | `#ECF3E8` | `#7FA18E` | `#C7F25E` (lima) | saúde, natureza, rotina |
| `mono` | `#111111` | `#FAFAFA` | `#777777` | `#FFFFFF` | quando a marca já tem cor demais; o acento é o próprio branco |

- **Um tema por carrossel**, o mesmo em todos os slides.
- **Um acento, nunca dois.** Ele marca o que importa: a linha-herói do título (`colors: ["accent", "ink", "ink"]`), o recurso do slide (o número do contador, as barras, a bola, os números dos cartões, o botão) e as marcas de continuidade (o risco sob o título, o trecho da régua, a pílula do slide). Nunca no texto corrido, e nunca uma segunda cor de destaque.
- **O fundo é chapado**, com o grão do tema e, no máximo, a luz suave que deriva num canto (`C.glow`, com `alpha` perto de 0,08); ou é uma foto, com as regras da seção 8. Nada de degradê de tela inteira.
- **Tema próprio** (`{ bg, ink, muted, accent }`) só com as cores da marca do integrante, dadas por ele, e com o mesmo contraste entre fundo e tinta.

## 2. Tipografia

Uma família, dois pesos: 800 nos títulos, 500 no texto; rótulos em caixa alta, espaçados. A fonte vem do computador que renderiza (`Inter`, senão `Segoe UI`, `Roboto`, `Helvetica Neue`, `Arial`).

| Elemento | Tamanho nos modelos e no exemplo |
|---|---|
| título do gancho | 176 px |
| título da chamada final | 150 px |
| título de um ponto | 140 px |
| número do contador | 300 px |
| frases de apoio | de 54 a 60 px |
| texto de cartão, frase secundária | de 44 a 50 px |
| rótulo acima do título | 44 px |
| texto do botão | 58 px |

- **Nenhum texto abaixo de 44 px.** A conferência avisa abaixo disso e reprova abaixo de 26,4 px. O helper do rótulo nasce com 36 px: passe `size: 44`.
- **Título em até 3 linhas**, e você decide onde quebrar (`\n`): a quebra automática pode deixar uma palavra sozinha. A 176 px cabem cerca de dez letras por linha; a 140 px, cerca de doze; depende da fonte da máquina, e só o quadro mostra.
- **Texto que encolheu é frase longa.** O helper desce o tamanho até 60% do pedido para caber. O `size` que ele devolve, e que a conferência lista em `first_frame_readable`, diz o tamanho de fato: se for menor que o pedido, corte palavras em vez de aceitar a letra menor.
- **Pouco por slide.** Um título e mais uma coisa: três frases curtas, ou três cartões de uma linha, ou um número com uma legenda. Se precisa de mais, é outro slide.
- Sem itálico, sem contorno, sem sombra em texto, sem texto 3D, sem gradiente em texto.

## 3. O quadro, as margens e os cantos

O formato é o 4:5 (1080×1350), o recomendado para o feed; o 3:4 (1080×1440) também é aceito. Um carrossel tem um formato só, porque o Instagram mostra todos os itens na proporção do primeiro.

- **72 px de margem.** Tudo alinha à esquerda em `x: 72` e vai, no máximo, até 1008.
- **Dois cantos do Instagram sempre livres:** o contador "1/N", no alto à direita (170×80 px), e o botão de som, embaixo à direita (100×100 px). Nenhum texto, logo ou botão os toca. Só o fundo sangra.
- **A grade vertical dos modelos:** o rótulo em `y: 96`; o título em `y: 176`; o recurso do slide logo abaixo, empilhado pela geometria do título; a régua de compassos em `y: 1140`; as pílulas de progresso e a dica de deslizar na última linha, em `y: 1245`. O conteúdo acaba antes da régua.
- **Cantos e traços:** cartões com raio de 24 a 28 px; o botão é uma pílula; as barras têm os cantos arredondados; o risco sob o título tem 8 px; uma linha de chão, 3 px.
- No 1:1 e no 9:16 a grade é outra: recomponha a partir de `C.safe` e olhe os quadros.

## 4. O quadro 0 é a capa

O primeiro quadro de um item de vídeo é a capa dele até o vídeo começar a tocar. Por isso todo slide nasce terminado no quadro 0: o rótulo, o título, o recurso e o texto no lugar, no tamanho final, nada entrando. No slide 1 essa é a capa do carrossel inteiro.

Na prática: tudo o que faz parte do slide tem `at: 0` (o padrão). O que entra depois com `at > 0` é enfeite que a capa dispensa. A conferência exige um texto de 44 px ou mais no quadro 0 de cada slide (`first_frame_readable`) e repete a exigência para o slide 1 no conjunto (`hook_first_frame`).

## 5. Movimento: começa cedo, não para, fecha o loop

A capa está pronta no quadro 0, mas o slide não fica parado nela.

- **Todo slide começa a se mexer no primeiro segundo ou dois.** Algo sai e volta, conta, cresce ou viaja. No exemplo: as frases de apoio do gancho e da chamada saem na batida 0,5 e voltam uma por batida a partir da 2; o contador some na batida 2 e volta contando; a bola parte na 2; os cartões saem na 1,5 e voltam um a um.
- **Nenhum trecho de mais de 1,25 s parado.** A 120 BPM são duas batidas e meia: dentro desse intervalo, algo sai, volta, conta ou estoura, do primeiro ao último compasso. No exemplo, o título do gancho sai na batida 7 e volta com impacto na 9; os cartões voltam a cada batida e meia, e no fim desse slide o título sai na 7 e volta na 9 junto com a frase de fecho; na chamada, o título volta na 9 e o botão some na 12 e estoura de novo na 13.
- **O movimento é sair e voltar.** Como a capa já tem tudo, o gesto canônico é `at: 0` com `out` e `back`: o elemento sai, e a volta dele é a animação (uma frase por batida, um `slam`, uma contagem, um botão que estoura).
- **Um gesto de cada vez, nas batidas.** Saídas e voltas em batidas inteiras ou meias batidas; nunca tudo voltando no mesmo instante.
- **O loop fecha.** No último quadro tudo está como no quadro 0. O que saiu, voltou; a bola está em casa; o contador chegou. A conferência compara os dois quadros (`loop_seamless`).
- **Texto não rebate.** O título volta com `slam` ou `rise`; a mola que rebate (`playful`) fica fora do texto.

**Como conferir.** Na folha de um quadro por batida, três quadros seguidos iguais já são um trecho parado. No vídeo final, a conferência mede o tempo parado (`dead_time`) e avisa a partir de 1,5 s, dizendo de que segundo a que segundo. A correção é levar um par `out`/`back` para dentro do trecho quieto (o título que sai e volta, o botão que some e estoura, a frase que volta mais tarde), renderizar o slide de novo e conferir outra vez.

O `dead_time` mede a mudança média do quadro inteiro: um traço cinza pequeno que se mexe não conta. A cabeça da régua, a luz de fundo e a dica de deslizar se mexem o tempo todo, e o fundo e o botão pulsam nas cabeças de compasso, mas nada disso segura um trecho: um compasso inteiro só com eles dá um aviso de 1,8 s. O que mantém o slide vivo, inclusive perto do fim, é um elemento grande saindo e voltando: um título, um cartão, um bloco de texto, o botão.

## 6. Continuidade entre slides

O carrossel é um filme curto visto em pedaços. O que liga os pedaços:

- **A régua de compassos** (`C.ruler`): a linha do tempo do carrossel inteiro, no mesmo lugar em todos os slides, com o trecho do slide atual no acento e um cursor que o varre. O slide 2 começa onde o 1 terminou.
- **As pílulas de progresso** (`C.progress`) e a **dica de deslizar** (`C.swipeHint`), na mesma linha em todos; no último slide, sem a dica.
- **O mesmo tema, a mesma tipografia, a mesma grade**, sem exceção.
- **A mesma trilha**, que continua de um slide para o outro.

Na prévia (`preview.html`), o botão "Grade" mostra todos os slides lado a lado, tocando juntos a partir do quadro 0: é onde a continuidade se confere.

## 7. Conteúdo por papel

**Gancho.** Uma frase de tensão ou de contraste, de 2 a 8 palavras, no idioma de quem lê: "Fevereiro mata academias." funciona; "Você sabia que…?" não. A palavra-herói numa linha só, na cor de acento. Abaixo, até três frases curtas de apoio, uma por linha: são elas que voltam uma por batida logo no começo. Nada de "Thread:" nem de "Abre o post".

**Ponto.** Uma ideia por slide: um rótulo que a situa ("Motivo 1 de 3"), um título que a enuncia em poucas palavras ("Meta errada.") e um recurso que a prova. O contador serve a um número, as barras a uma comparação, os cartões a uma lista de até três passos, as frases por batida a um raciocínio, a bola a uma metáfora de impulso. Dois recursos só quando contam a mesma coisa, como o número e as barras do slide 2 do exemplo. Todo número vem do integrante ou de uma fonte que ele deu; sem fonte, a frase fica sem número, ou o briefing diz que é uma imagem e não uma estatística.

**Chamada final.** O pedido numa frase, o que a pessoa ganha e uma palavra para comentar, em maiúsculas, no botão: "Comente TREINO". Uma palavra só, fácil de digitar. Sem @, sem "link na bio", sem logo de rede. Quatro compassos, para dar tempo de ler e agir. O botão pulsa nos tempos fortes e, perto do fim, some e estoura de novo: é o último gesto do carrossel.

## 8. Fotos

Um carrossel com fotos segue as mesmas regras, mais estas. De onde vem cada imagem e como pedir está em `images.md`; os helpers, em `slide-page.md`.

- **Uma foto herói por slide.** O fundo ocupa o quadro, e no máximo um assunto recortado vai por cima. Nada de colagem.
- **Texto sempre sobre um degradê ou sobre a foto escurecida.** Um `C.scrim` por baixo do texto, do lado do quadro em que ele está, ou a foto com `dim` de 0,35 ou mais; os modelos usam os dois (`dim` 0,3, um degradê em cima para o título, outro à esquerda para a coluna das frases e outro embaixo). Confira nos quadros: nenhuma linha pode cruzar uma área clara ou cheia de detalhe da foto (uma janela, uma placa, um reflexo).
- **Sobre foto, o texto vai na cor `ink`, nunca no cinza `muted`.** O cinza some na foto, mesmo num texto menor como a frase de fecho. Só fica `muted` o que está na parte mais escura dos degradês de cima e de baixo: o rótulo no alto, a régua e a seta embaixo.
- **Nunca texto sobre um rosto, nem sobre o assunto.** O assunto fica do lado oposto ao texto: nos modelos, o texto à esquerda e o recorte embaixo à direita.
- **A mesma luz e o mesmo estilo em todos os slides.** Repita o mesmo fundo em mais de um slide e as mesmas palavras de luz e de estilo em todos os pedidos de imagem. Fotos que parecem de carrosséis diferentes quebram a continuidade.
- **Profundidade com contenção.** O fundo mexe pouco (`depth` perto de 0,3) e o assunto mais (de 0,7 a 1); os dois voltam ao lugar no fim do slide. A deriva da foto é lenta e não segura um trecho sozinha: os gestos de texto e do recorte continuam valendo (seção 5).
- **O tema continua mandando.** O degradê tem a cor de fundo do tema, o acento é o do tema, e a foto não traz outra cor de destaque: escolha imagens cujas cores combinem com o tema.
- **Sem texto dentro da imagem.** O texto é do slide, nítido e editável. Nada de logos e produtos de terceiros, nem do rosto de uma pessoa real sem a foto e a autorização dela; imagem gerada nunca se passa por foto real.

## 9. Proibições

- Gradiente em texto; texto neon; brilho ou sombra colorida em volta de texto ou de formas; fundo em degradê de tela inteira.
- Uma segunda cor de destaque; dois temas no mesmo carrossel; cores "parecidas" com as da marca no lugar das cores da marca.
- O @ do integrante, logos do Instagram ou de outra rede, ícones de curtir e compartilhar desenhados na arte, moldura de celular dentro do slide.
- Partículas, explosões, confete, emojis como ilustração, texto 3D, rotação sem motivo.
- Rebote em texto; texto que aparece por fusão lenta; tudo entrando ao mesmo tempo.
- Texto nos dois cantos do Instagram, fora da margem ou por baixo de um elemento que se move.
- Texto sobre foto sem degradê e sem escurecer; texto cinza (`muted`) sobre a foto; texto sobre um rosto; duas fotos herói no mesmo slide; imagem gerada apresentada como foto real.
- Mais de uma ideia por slide; mais de 7 slides sem que o integrante peça; texto de amostra dos modelos esquecido.
- Números inventados; "estudos mostram" e "especialistas dizem" sem fonte; qualquer promessa de alcance ou de engajamento.
- Chamar de pronto um slide com item reprovado na conferência, ou sem ter olhado os quadros.

## 10. Lista anti-"IA genérica"

Antes de entregar, passe o carrossel por esta lista. Um "sim" é um slide a refazer.

- O gancho poderia estar em qualquer carrossel de qualquer nicho?
- Algum título começa com "Descubra", "Desvende", "Você sabia", "Em um mundo onde"?
- Há uma lista de três itens genéricos ("foco, disciplina e constância") no lugar de uma ideia concreta?
- Há um número sem origem?
- Dois slides seguidos têm a mesma composição e o mesmo gesto?
- Há uma segunda cor de destaque, ou o acento no texto corrido?
- Algum texto encolheu para caber, ou quebrou deixando uma palavra sozinha?
- Algum slide passa os dois primeiros segundos parado, ou mais de 1,25 s sem um gesto em qualquer ponto?
- Tudo se mexe ao mesmo tempo em algum instante?
- A chamada final pede mais de uma coisa?
- Sobrou texto de amostra em algum slide?
- Alguma foto tem texto por cima sem degradê ou em cinza, ou as fotos parecem de carrosséis diferentes?
- O veredito veio do JSON, sem os quadros terem sido olhados um a um?
