# Carrossel animado

Transforma um tema em um carrossel para o Instagram em que cada slide é um vídeo curto em loop, com movimento e som na batida e, se você quiser, fotos. Você diz o assunto; a sua IA escreve o roteiro, desenha e anima cada slide, gera a trilha, confere as regras do feed e entrega os MP4 prontos para postar, com uma prévia de como fica no celular.

## O que ele faz

Um carrossel comum é uma sequência de imagens paradas. Neste, cada slide é um vídeo de poucos segundos (em geral 6 ou 8) que se repete sem emenda: as frases entram uma por batida, um número conta, uma bola quica, os cartões aparecem um a um, o título sai e volta com impacto, o botão da chamada estoura de novo, e tudo termina exatamente como começou. A música é uma só, cortada nos compassos: o slide seguinte começa a trilha onde o anterior parou.

O carrossel segue uma estrutura simples: um **gancho** (a frase que faz a pessoa parar), os **pontos** (uma ideia por slide) e uma **chamada final** (o que você quer que a pessoa faça; em geral, comentar uma palavra). O padrão são 5 slides; o app aceita de 2 a 20, e de 3 a 7 é o que costuma caber numa ideia. O formato é o 4:5 (1080×1350), o recomendado para o feed; o 3:4 (1080×1440) também é aceito.

Os slides podem ser só tipografia, formas e cor, o estilo gráfico, que não depende de nada, ou levar **fotos**: um fundo que ocupa o quadro, um objeto ou uma pessoa recortada por cima e o texto sobre um degradê. As camadas mexem em profundidade (o fundo devagar, o recorte mais) e voltam ao lugar no fim, para o loop fechar.

O trabalho da sua IA:

1. Conversa com você sobre o tema, para quem é, o que a pessoa leva e o tom, decide com você se o carrossel leva fotos e escreve o briefing.
2. Com fotos, consegue as imagens na ordem de "Com fotos", logo abaixo, e olha cada uma antes de usar.
3. Monta cada slide a partir de modelos prontos (gancho, ponto, foto, chamada) e escreve o roteiro, com os efeitos sonoros nas batidas de cada gesto.
4. Fotografa os quadros de cada slide e olha um por um antes de dizer que ficou bom.
5. Confere cada slide: o primeiro quadro já é uma capa pronta e legível, o texto fica dentro da margem e longe do contador "1/5" e do botão de som, nenhuma letra é pequena demais e o último quadro emenda no primeiro.
6. Gera uma prévia com som e abre no seu navegador uma página que imita o celular, para você deslizar e ouvir.
7. Renderiza a versão final, confere de novo (agora também se algum trecho ficou parado e se o volume está certo) e entrega os arquivos com uma sugestão de legenda.

Depois de pronto, você pede mudanças slide por slide ("troque a frase do slide 3", "quero outra trilha", "troque a foto do fundo") e só o que mudou é refeito.

## O que você precisa

- Uma IA que leia imagens, como o Claude Code: ela precisa olhar os quadros para julgar os slides.
- O app **Motor de vídeo** (`video-render`), que renderiza, gera o som e confere os slides. Se ele faltar, a sua IA conta numa frase o que ele faz e o que acessa e, com o seu sim, o instala com `npx --yes flyee@latest add video-render`.
- O **ffmpeg** e um navegador para fotografar os quadros sem abrir janela. No Windows, o Microsoft Edge já vem instalado; no Mac e no Linux servem o Chrome, o Edge ou o Chromium. Você não instala nada: a sua IA avisa numa frase e instala o que faltar na primeira vez.
- Para fotos, nada obrigatório: servem as suas fotos, uma IA que gera imagens, o Codex conectado à sua conta do ChatGPT ou a chave do Gemini, que o Google não cobra no uso comum.

Nenhuma chave é obrigatória: o carrossel é renderizado no seu computador, e a música é gerada ali mesmo.

## Peça assim

> "Faça um carrossel animado sobre por que as pessoas desistem da academia em fevereiro, tema noir, 5 slides."

Outros pedidos:

> "Crie um carrossel em vídeo para o lançamento do meu curso de fotografia com celular: 4 slides, visual azul, terminando com 'comente FOTO'."

> "Faça um carrossel animado com fotos sobre treinar em casa com um peso só: 3 slides, clima de academia escura ao amanhecer."

> "Use as fotos da minha loja num carrossel sobre a reabertura. Vou te passar os arquivos."

> "Refaça o slide 3 do carrossel da academia com outra frase: 'Dor sem placar não vira hábito'."

## Com fotos

Cada imagem vem do primeiro caminho desta lista que existir no seu computador. A sua IA confere sozinha e só desce um degrau quando o de cima não atende:

1. **A sua própria IA,** quando ela gera imagens na conversa.
2. **O Codex,** se ele está no seu computador e conectado à sua conta do ChatGPT: as imagens contam no seu plano, sem chave nenhuma. Se o seu Codex entra com uma chave da OpenAI, a IA avisa antes que cada imagem será cobrada nela.
3. **A chave do Gemini,** se você quiser criá-la (veja "Sem a chave").
4. **As suas fotos:** você passa os arquivos, e a IA os coloca na pasta do carrossel.
5. **Sem fotos:** o estilo gráfico, que fica bom e não depende de nada.

Pelo Codex, cada imagem leva por volta de um minuto e meio; pelo Gemini, uns 15 segundos. A sua IA olha cada imagem antes de usá-la e pede de novo quando algo sai torto: uma moldura, um texto que ninguém pediu, uma mão deformada. O recorte (o objeto sem o fundo, pronto para ficar por cima da foto) é automático. Uma pessoa recortada pede a sua foto já sem fundo, que muitos celulares fazem em um toque: o app não recorta a foto de uma pessoa real.

## Sem a chave

Tudo funciona sem chave nenhuma: os slides de tipografia, formas e cor, a trilha gerada no seu computador, a prévia, a conferência e a entrega. Com fotos também: as suas, e as que a sua própria IA ou o Codex com a sua conta do ChatGPT geram. A chave do Gemini só acrescenta uma coisa: imagens geradas quando nenhuma IA sua faz isso.

Se quiser usá-la, a chave se cria com a sua conta Google, no Google AI Studio, e o Google não cobra por ela no uso comum. A sua IA abre uma página no seu navegador, onde você cola a chave e clica em Salvar. Ela fica guardada só no seu computador, fora de qualquer projeto, e não passa pela conversa. Nunca cole a chave no chat; se colar, apague-a no Google AI Studio e crie outra.

## Como fica no Instagram

- **Você posta.** O app não publica nada: você posta pelo aplicativo do Instagram, escolhendo os arquivos de `out/` na ordem (`01.mp4`, `02.mp4`, …), como um só carrossel. A sua IA sugere a legenda e a palavra da chamada final.
- **Todos os slides têm o mesmo formato.** O Instagram mostra todos os itens de um carrossel na proporção do primeiro; como todos saem em 4:5, nada é cortado.
- **O primeiro quadro é a capa.** É o que aparece em cada slide até o vídeo começar a tocar. Por isso todo slide já nasce pronto no primeiro quadro, com o texto no lugar.
- **Os dois cantos ficam livres.** O feed mostra o contador "1/N" no alto à direita e o botão de som embaixo à direita: nenhum texto passa por ali.
- **O som é um extra.** Ele só toca depois que a pessoa liga o áudio. O movimento conta a história sozinho, e o som a reforça para quem ouve.

## O que ele grava

Tudo fica em `carrosseis/<nome>/` dentro do seu projeto, uma pasta por carrossel:

| Caminho | Conteúdo |
|---|---|
| `brief.md` | o briefing: tema, para quem, promessa, tom, estrutura dos slides e chamada final; com fotos, também as imagens e os pedidos que as geraram |
| `storyboard.json` | o roteiro: o formato, o andamento, a trilha, a ordem dos slides, os compassos e os efeitos sonoros de cada um |
| `slides/01.html` … | a página que desenha cada slide (a sua IA escreve e ajusta) |
| `out/01.mp4` … | **os slides finais, com som, prontos para postar** |
| `preview.html` | a prévia: um celular na tela, com o carrossel para deslizar, o contador e o botão de som; "Grade" mostra todos os slides lado a lado e "Som" liga o áudio |
| `previa/` | as prévias rápidas, em metade do tamanho, e as folhas de quadros que a IA olhou |
| `audio/` | a trilha (`music.wav`), as batidas dela (`music.beats.json`) e os efeitos de cada slide |
| `renders/` | os slides finais ainda sem som |
| `relatorio.json` | o resultado da última conferência, slide por slide e do conjunto |
| `carousel.json` | o registro do que já foi renderizado, para não refazer o que não mudou |
| `assets/` | as imagens dos slides (as suas fotos e as geradas, cada gerada com um `.json` ao lado que guarda o pedido), um logo, a sua música |
| `motion.js`, `carousel.js` | as duas bibliotecas que os slides usam |

## Cuidados

- **Leva alguns minutos.** Cada slide é fotografado quadro a quadro: conte algo como meio minuto por slide na prévia e um minuto por slide na versão final, mais o tempo das imagens geradas; um computador ocupado leva mais.
- **A conferência mede, você decide.** Ela mede o que dá para medir: a capa legível, o texto dentro da margem e fora dos dois cantos, o tamanho da letra, a emenda do loop e, no vídeo final, piscadas, trechos parados e o volume. Gostar do resultado é com você: olhe a prévia antes de postar.
- **A música é gerada no seu computador, sem música de terceiros.** Se preferir a sua, deixe o arquivo na pasta do carrossel e peça à IA para usá-la: ela mede o andamento e ajusta os slides a ele. Só use música que você tem o direito de usar no post.
- **Imagem gerada não é foto.** A IA não apresenta uma imagem gerada como foto sua, do seu produto ou de um cliente; em anúncio, depoimento e antes-e-depois, use fotos de verdade. Ela também não gera o rosto de pessoas reais nem logos e produtos de outras marcas. Pessoas reais só entram com a foto e a autorização delas.
- **As imagens geradas usam o seu plano.** As do Codex contam no limite do seu plano do ChatGPT (ou são cobradas na chave da OpenAI, se o seu Codex usa uma); as do Gemini, no limite da sua chave. A IA gera o que o carrossel precisa, sem variações à toa.
- **As letras vêm do seu computador.** O app usa a fonte Inter quando ela está instalada e, sem ela, a fonte do sistema. Em outro computador o mesmo slide pode quebrar as linhas em outro ponto.
- **Nenhum número inventado.** A IA só põe num slide os números que você deu ou a fonte que você indicou, e não promete alcance nem engajamento.
- **Quase nada sai do seu computador.** O app não publica, não envia os seus arquivos a lugar nenhum e não usa a internet para renderizar. Só quando o Codex ou o Gemini geram uma imagem, a descrição dela (e a imagem de referência, quando há uma) vai para quem a gera.

## O que há de novo

- 1.1.2: quando o Motor de vídeo ainda não está no projeto, a sua IA diz numa frase que vai instalá-lo e instala na hora, sem pedir confirmação.
- 1.1.1: antes do render, a sua IA revisa o texto dos slides para ele não soar como texto de IA, mantendo o tom que você pediu; a sugestão de legenda passa pela mesma revisão. A conferência mostra cada item com um nome em português.
- 1.1.0: slides com fotos. Um fundo que ocupa o quadro, um objeto ou uma pessoa recortada por cima e paralaxe em 2.5D, com o texto sobre um degradê. As imagens vêm, nesta ordem, da sua própria IA, do Codex com a sua conta do ChatGPT, da chave opcional do Gemini ou das suas fotos; o recorte do fundo é automático. Novo modelo de slide com foto e um exemplo completo com fotos.
- 1.0.0: primeira versão. Carrosséis de 2 a 20 slides em vídeo 4:5 ou 3:4, em loop, com movimento e som na batida; briefing e roteiro; modelos de slide por papel e um exemplo completo; cinco temas visuais e cinco estilos de trilha gerada no computador, ou a sua própria música; prévia que imita o celular; conferência de cada slide e do conjunto; refazer um slide sem refazer os outros.
