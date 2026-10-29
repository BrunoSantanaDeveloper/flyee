# Motor de vídeo

Transforma uma página animada em vídeo pronto para publicar. A sua IA escreve uma página que sabe desenhar qualquer instante; o Motor a fotografa quadro a quadro, junta os quadros com trilha e efeitos na batida, confere o que as redes exigem e entrega o vídeo no formato pedido. É também o motor que outros apps do flyee.club usam quando precisam renderizar, sonorizar ou conferir um vídeo: você raramente o chama direto, mas pode ("transforme esta página em vídeo", "faça uma prévia", "confira este vídeo para o Reels").

## O que ele faz

Para o Motor, um vídeo animado é uma página que desenha o tempo: peça o segundo 3,5 e ela pinta exatamente o que aparece nesse instante. A sua IA escreve essa página (o texto que entra em cena, as telas do seu produto, os números que crescem, o logo, a sua câmera recortada) e o Motor a abre num navegador sem janela, pede um quadro de cada vez e transforma a sequência em vídeo. Como cada quadro depende só do tempo, o resultado é sempre igual: renderizar duas vezes dá o mesmo arquivo, e mudar uma linha da página muda só o que essa linha desenha.

Em volta do render, o Motor faz o que deixa um vídeo pronto de verdade:

- **Prévia e quadros.** Um render rápido em metade do tamanho, fotos de instantes escolhidos (ou de cada batida da música) e folhas de contato, para a IA olhar o vídeo antes de você.
- **Duas trilhas feitas em código.** Para um vídeo que se assiste uma vez, como um Reels de 15 segundos, uma música com começo, subida, ponto alto e uma pancada final, no tamanho exato do vídeo (estilos limpo, enérgico, quente, mínimo, cinematográfico e brincalhão). Para um loop ou um carrossel, uma trilha em compassos inteiros que repete sem emenda, da qual cada slide toca um trecho (estilos limpo, noir, animado, lo-fi e pulso). As duas vêm com a grade de batidas, para os cortes caírem no tempo, e nenhuma é música de terceiros: tudo é gerado no seu computador e é seu.
- **Efeitos na hora certa.** Impacto, clique, deslize, subida, sino, obturador, digitação e outros, nos instantes que a IA marcar.
- **Batidas de qualquer música.** Se você preferir a sua própria trilha, o Motor mede o andamento dela, para a animação cair na batida do mesmo jeito.
- **Mixagem no volume certo.** Música (a partir do trecho que você quiser), efeitos e voz juntos, a música abaixando quando a voz entra, no volume que as redes esperam.
- **A marca de verdade.** O Motor visita o site da sua marca e traz logo, cores, fontes, botões, números, preços e telas reais do computador e do celular, para o vídeo usar a sua identidade em vez de inventar uma.
- **Conferência antes de publicar.** A capa legível no primeiro quadro, o texto longe dos botões da rede (no carrossel do Instagram, longe do contador "1/N" e do botão de som), o tamanho mínimo do texto no celular, os cortes na batida, a emenda do loop, as piscadas, o tempo parado e o volume; e, para cada rede de destino (Reels, Stories, feed, TikTok, Shorts, YouTube, LinkedIn, X, Status do WhatsApp, Kwai e anúncios), se ela aceita o formato e a duração. Cada item volta aprovado, reprovado ou com um aviso, com o que corrigir.
- **Vários formatos de uma linha do tempo.** O mesmo vídeo em 9:16, 4:5, 3:4, 1:1, 16:9 ou num tamanho sob medida, com a página recompondo o layout em vez de ser cortada.
- **Camada transparente.** Para quem finaliza em outro editor: as animações saem com fundo transparente, prontas para ir por cima da sua gravação.

## Para quem é

- **Você, direto com a sua IA:** o Reels de um lançamento, a demonstração de uma funcionalidade, uma vinheta, um slide animado, a conferência de um vídeo que você já tem.
- **Outros apps do flyee.club**, como o Carrossel animado e o Estúdio de vídeo: eles escrevem a página e usam o Motor por baixo para renderizar, sonorizar e conferir. Quando um deles precisa do Motor e ele ainda não está instalado, a sua IA avisa e instala.

## O que você precisa

- Uma IA que leia imagens, como o Claude Code: ela olha os quadros para julgar o vídeo.
- O **ffmpeg**, o programa que monta os vídeos. Você não instala nada: na primeira vez que o app precisar, a sua IA avisa numa frase e instala sozinha.
- Um navegador. No Windows, o Microsoft Edge já vem com o sistema; no Mac e no Linux servem o Google Chrome ou o Chromium, e a IA instala o Chromium se não houver nenhum.

Não há chave nem conta externa: tudo roda no seu computador.

## Peça assim

> "Transforme esta página animada em vídeo para o Reels: lancamento/pagina.html"

Outros pedidos:

> "Faça um Reels de 15 segundos sobre o lançamento, com uma trilha original na batida, e confira se passa no Reels e no TikTok."

> "Faça uma prévia desta página e me mostre os quadros antes do render final: lancamento/pagina.html"

> "Coloque uma trilha em loop, estilo noir, a 120 BPM neste slide, com um impacto na entrada do título: slide/01.html"

> "Capture o site da minha marca para pegar logo, cores e telas reais: https://www.minhamarca.com.br"

> "Confira se este vídeo passa nas regras do Reels, do TikTok e do Shorts: final.mp4"

> "Renderize a mesma página em 9:16, 4:5 e 16:9 e me mostre uma folha de cada."

## O que ele grava

Tudo fica no seu computador, na pasta que a sua IA indicar. Por padrão:

| Onde | O quê |
|---|---|
| na pasta que a IA criar | `pagina.html` e `motion.js`, a página inicial para editar |
| ao lado da página | a prévia (`previa.mp4`) e o vídeo com o nome da página (`.mp4`; `.mov` ou `.webm` na camada transparente) |
| `quadros/`, ao lado da página | os quadros fotografados (`quadro-0001.png`…) e a folha de contato (`folha.png`); uma nova rodada substitui os quadros da anterior |
| ao lado de um vídeo pronto | a folha de contato (`<vídeo>-folha.png`), a tira de quadros seguidos, o teste de celular e o relatório da conferência (`<vídeo>.aceite.json`) |
| na pasta que a IA indicar | as trilhas e os efeitos (`.wav`), a grade de batidas ao lado de cada trilha (`.beats.json`) e o vídeo final com som |
| ao lado de uma música sua | a grade de batidas dela (`.beats.json`), quando a IA mede o andamento |
| `capturas/<site>/` | `captura.json` com a marca (nome, logo, cores, fontes, botões, números, preços, redes), as telas do computador e do celular, as gravações de rolagem e os arquivos da marca em `assets/`; quando o site barra a visita, só `bloqueio.png`, com a tela que ele devolveu |
| a pasta temporária do sistema | quadros intermediários e o perfil do navegador sem janela, apagados ao final |

Um arquivo com o mesmo nome de um que o Motor grava é substituído; a IA escolhe os nomes e avisa antes de sobrescrever uma página sua.

## Cuidados

- **A página tem que ser previsível.** O mesmo instante dá sempre o mesmo quadro: transições de CSS, temporizadores e sorteios sem semente saem diferentes a cada render. A sua IA segue o guia da página, e o Motor avisa quando a página dá erro.
- **As fontes vêm do seu computador.** A página usa as fontes instaladas na sua máquina (ou arquivos de fonte ao lado dela); em outro computador, sem as mesmas fontes, o vídeo sai diferente.
- **Renders longos levam minutos.** Um minuto de vídeo a 30 quadros por segundo são 1.800 fotografias, o dobro ou o quádruplo com desfoque de movimento. A prévia existe para errar rápido; o render final é o último passo.
- **Direitos.** A trilha e os efeitos são gerados pelo Motor, sem música de terceiros. Imagens, vídeos, logos, músicas e rostos que você traz de fora precisam de autorização de quem tem os direitos; capture só o site da sua marca ou um que você tenha direito de usar.
- **Nada do seu computador é enviado.** O Motor não manda arquivos a lugar nenhum. Ele só vai à internet na captura, que visita o site que você pedir e baixa as imagens dele, e no render quando a própria página usa algo de fora, como uma fonte da web.
- **A conferência mede, você decide.** Ela confere o que dá para medir: capa, área segura, texto, batidas, loop, piscadas, tempo parado, volume e, por rede, formato e duração. Os limites das redes mudam sem aviso; a tabela do Motor traz a data em que foram conferidos. Publicar continua sendo uma decisão sua, com o relatório na mão.

## O que há de novo

- 1.0.3: um ffmpeg travado não deixa mais a sua IA esperando sem fim. Cada programa que o Motor roda tem um tempo limite folgado, que cresce com a duração do vídeo; passado esse tempo, o programa é encerrado e a sua IA recebe o erro com o que fazer.
- 1.0.2: a tabela das redes ganha a zona de anúncio do feed da Meta (4:5 e 1:1), com a nota do que a Meta publica e do que é respiro de design; os anúncios de feed de outros apps passam a ser conferidos nela.
- 1.0.1: quando outro app precisa do Motor de vídeo e ele ainda não está no projeto, a sua IA diz numa frase que vai instalá-lo e instala na hora, sem pedir confirmação.
- 1.0.0: primeira versão. Render em .mp4, .mov e .webm (com camada transparente) nos formatos 9:16, 4:5, 3:4, 1:1, 16:9 e sob medida; prévia, quadros e folhas de contato; trilha com arco e trilha em loop feitas em código, com a grade de batidas; efeitos na batida; batidas de qualquer música; mixagem no volume das redes; captura da marca a partir do site; conferência de capa, área segura, texto, cortes, loop, piscadas, tempo parado e volume, e de formato e duração em 12 destinos; uso por outros apps.
