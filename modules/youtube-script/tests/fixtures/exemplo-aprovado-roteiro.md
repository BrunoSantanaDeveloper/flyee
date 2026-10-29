# Como eu uso o Claude Code pra criar carrosséis ANIMADOS


## Gancho
[TELA: o carrossel 1 passando, com som]
Se liga nesse carrossel. Cada slide é um vídeo, com música. E antes que você pense que eu passei a tarde num editor de vídeo: não abri editor nenhum. Foi o Claude Code! Eu pedi numa frase e respondi umas perguntas dele. Vou te mostrar do zero como foi.

## A lacuna e a promessa
[CÂMERA]
Antes de gravar, eu fui no YouTube procurar isso em português. Tem muito vídeo de carrossel com IA. Tem vídeo de motion design. Mas carrossel em que todo slide é animado, com a música na batida, eu achei [CONFIRMAR: quantos].

Então hoje eu vou te mostrar dois: um só com design, sem nenhuma imagem, e um com foto. Vou explicar rapidinho como motion design funciona, pra você entender por que fica bom. E tudo que eu usei tá com link na descrição.

## De onde veio
[CÂMERA]
E de onde veio isso? [CONFIRMAR: a sua história real. Ex.: 'Eu tava montando um jeito de o Claude Code animar os meus próprios vídeos.'] Aí caiu a ficha: o Instagram aceita vídeo dentro do carrossel. Então por que todo carrossel que eu vejo é imagem parada? Sentei, montei, e virou esse app.

Fica até o final, por dois motivos. Primeiro, porque são as regras que eu vou te mostrar que fazem um carrossel animado ficar bonito em vez de ficar com cara de IA. E segundo, porque esse é o primeiro vídeo do canal, e isso ajuda demais.

## Por que carrossel
[CÂMERA], com corte para o feed rolando
Por que carrossel? Porque no Instagram cada arrastada é mais tempo da pessoa no seu post. E carrossel bom a pessoa salva e manda pra alguém.

Só que o feed hoje tá cheio de Reels, tudo se mexendo. No meio disso, uma imagem parada é a coisa mais fácil de passar reto.
[TEXTO: o feed rolando e um carrossel parado passando batido]

## O jeito que muita gente tenta
[CÂMERA]
Tem gente que já percebeu isso e faz assim: pega a imagem do carrossel e joga num gerador de vídeo com IA pra ela se mexer. Às vezes fica bom. Mas você paga crédito por clipe, quase sempre em dólar. Você não escolhe o que mexe nem quando. Às vezes o texto derrete ou o rosto muda. E ele não sabe que música colocar.

O que eu fiz é outra coisa. Nada aqui vem de gerador de vídeo. O texto fica nítido, cada movimento cai numa batida, e se eu não gosto de alguma coisa, eu peço pra mudar e ele refaz.

## Como funciona
[TELA] um esquema simples: página, fotos dos quadros, ffmpeg, MP4
Rapidinho, como funciona. Motion design é design gráfico que se mexe: texto, forma, uma bolinha. Não é filme, não é personagem falando.

E o Claude não faz vídeo. Ele só escreve código. Então ele escreve uma página que sabe exatamente como a tela tem que estar em cada instante. Um navegador escondido tira foto de cada quadro, e um programa gratuito chamado ffmpeg junta tudo num MP4. A música e os efeitos ele gera ali mesmo, no computador.

Mas o código é a parte fácil. O que faz um motion ficar bonito ou com cara de barato são umas regras. E o primeiro carrossel ensina justamente elas.

## Exemplo 1: só design, e as regras
[TELA]
O primeiro é só design, nenhuma imagem: [CONFIRMAR: quantos slides, as cores e o que mais chama atenção]. Vou calar a boca e você assiste.
[TELA] o carrossel inteiro tocando, com som, uns 30 segundos sem fala
Agora as regras que tão aí dentro.

Um: o primeiro quadro é a capa. O Instagram mostra ele antes de o vídeo começar, então ele já nasce pronto, com o texto no lugar.

Dois: mexe logo e não para. No primeiro segundo já tem coisa acontecendo, e nada fica parado mais de um segundo e pouco.

Três, a que você não vê, mas ouve: ritmo. Tudo a 120 batidas por minuto, uma batida a cada meio segundo. Cada frase entra numa batida, e cada slide dura exatamente três compassos, seis segundos. Por quê? Porque no Instagram o vídeo do carrossel fica em loop. Se a música não fecha certinho, você ouve o pulo toda vez. Aqui você nem percebe onde começa.

Quatro: o texto fica longe dos cantos, porque lá em cima tem o contador dos slides e lá embaixo o botão de som.

Cinco: uma cor principal e um destaque. Só.

E seis: o som é bônus. Muita gente assiste sem som, então o movimento tem que contar a história sozinho.
[TEXTO: o número e o nome de cada regra, sobre o slide que mostra ela]

## Exemplo 2: com foto
[TELA]
O segundo é com foto. E aqui tem um truque. Se você só entrega uma foto, ele não consegue fazer muita coisa, porque tá tudo grudado. Então ele separa em camadas: o fundo, o objeto recortado por cima, o texto. Com cada coisa na sua camada, cada uma mexe de um jeito, e aparece essa profundidade.
[TELA] o carrossel 2 tocando, com som
As imagens vieram [CONFIRMAR: das minhas fotos, do Codex na minha conta do ChatGPT ou da chave do Gemini]. E repara na música: quando você arrasta, o slide seguinte continua de onde o outro parou. Parece uma música só.

E fora o plano do Claude, que eu já pago, a música, os efeitos e o render não custaram nada: roda tudo aqui no computador. [CONFIRMAR: a sua máquina.] [Se as imagens vieram do Codex: 'As imagens contam no meu plano do ChatGPT.']

## Qual usar
[CÂMERA]
Qual usar? Se você não tem foto, ou quer um visual limpo da sua marca, vai no primeiro: não precisa gerar nada. Se você tem fotos, ou já usa o ChatGPT, vai no segundo e usa o que você já tem.

## Como o app funciona
[TELA] a conversa com a IA acelerada, com o relógio no canto
E como funciona na prática. Você pede pra sua IA instalar, e ela instala sozinha o que faltar, até o ffmpeg. [CONFIRMAR, se for Windows: 'No Windows ele usa o Edge, que já vem instalado.']

Aí você dá um tema. Ele pergunta o que falta: pra quem é, o que a pessoa leva no último slide, o tom. Planeja cada slide: o gancho, os pontos, a chamada. Decide o que mexe, quando e em qual batida. Faz a música e os efeitos. Confere a capa, as margens, os cantos e o loop. E abre essa prévia aqui, que imita o celular.

Não gostou de alguma coisa? 'Troca a frase do slide 3.' Ele refaz só esse. Aí é só postar os vídeos na ordem, como carrossel.

E tudo que eu aprendi apanhando já tá lá dentro. [CONFIRMAR: o erro que mais te custou. Ex.: 'Slide com o tempo quebrado faz o loop pular, então ele sempre fecha o compasso.']

Esse primeiro levou [CONFIRMAR: o tempo do relógio] do pedido até os arquivos prontos.
[TEXTO: a prévia que imita o celular e a pasta com os MP4 em ordem]

## A minha opinião e o fecho
[CÂMERA]
A minha opinião: carrossel parado não morreu. Mas quase ninguém tá fazendo isso ainda. E quando o feed inteiro parece igual, o que se mexe chama atenção. Você não precisa saber After Effects nem ser motion designer: precisa entender essas regras, e o Claude faz o resto.

Tá perfeito? Não. [CONFIRMAR: o que você ainda mudaria.]

Tudo que eu usei tá com link na descrição. Me conta aqui nos comentários: qual você usaria, o só design ou o com foto? E valeu por ficar até o final. No primeiro vídeo do canal, isso ajuda demais.
[TEXTO: nos últimos 20 segundos, a tela final do YouTube]
