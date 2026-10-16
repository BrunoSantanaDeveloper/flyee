# Como usar

O Estúdio de vídeo faz vídeos animados na vertical para Reels, TikTok e Shorts. Você conta o que quer divulgar, e a sua IA cuida do resto: pergunta só o que falta, busca o logo, as cores e as telas reais da sua marca, escreve o roteiro, compõe uma trilha original e entrega o vídeo pronto para postar, já conferido para as redes.

## Para quem é

Para quem precisa divulgar um produto, um serviço, uma promoção ou um aplicativo e não quer encomendar uma animação a cada post. O resultado é um vídeo de 6 a 20 segundos em 1080×1920, feito de texto em movimento, telas do seu produto, os números que você já publicou e som no ritmo. Cada corte cai na batida da música.

A trilha é composta no seu computador, sem música de terceiros, então o vídeo pode ir para um post comum ou para um anúncio pago.

## Peça assim

Peça do jeito que estiver na sua cabeça. Quanto mais o pedido diz, menos a IA pergunta, e um pedido completo não recebe pergunta nenhuma.

> "Faça um vídeo animado."

> "Quero um Reels de 15 segundos apresentando a minha loja de roupas."

> "Faça uma lista com 5 erros que mancham o sorriso, para o perfil da minha clínica."

> "Faça um passo a passo de como agendar uma consulta pelo nosso app: baixe o app, escolha o horário e confirme com o seu nome."

> "Faça um anúncio de 20 segundos para o Reels da Loja Aurora, lojaaurora.com.br: casaco de lã por R$ 199 até domingo. Abre com 'Frio chegou. A lã também.' e fecha com 'link na bio'."

> "Vídeo de lançamento do meu aplicativo de agenda, meuapp.com.br. Abre com 'Chega de planilha'. Mostra: marcar um horário, lembrete automático e pagamento pelo celular. Fecha com o logo e o endereço."

## O que acontece do seu lado

**A conversa.** Com um pedido completo, a IA diz em uma frase o que vai fazer e começa. Com um pedido quase completo, faz no máximo três perguntas e segue. Com um pedido curto, como "faça um vídeo animado", ela conduz até três rodadas rápidas:

1. O vídeo: de qual marca é, para que serve, onde você vai publicar e quanto tempo dura.
2. A história: o que o vídeo divulga, qual roteiro, quais três coisas mostrar (ou, no passo a passo, quais são os passos) e se há um número que prove.
3. O jeito: o que quem assiste deve sentir, o estilo, o som e como o vídeo termina.

Cada rodada tem no máximo quatro perguntas, com opções prontas para escolher. Responda só o que quiser. "Decida por mim" fecha a rodada com os padrões, e "o resto decide você" vale para todas as rodadas que faltam.

**A visita ao site.** Entre a primeira e a segunda rodada, a IA visita o site da marca e traz o logo, as cores, as fontes, as telas e os números publicados. Leva um ou dois minutos, e por isso as perguntas seguintes já chegam com os seus produtos e os seus textos. Se a marca foi achada só pelo nome, ou se o site se apresenta com outro nome, a IA pergunta se é a certa antes de seguir.

**O plano.** Depois das rodadas, a IA escreve o plano inteiro do vídeo e espera o seu sim para construir. Num pedido completo ou quase completo essa parada não existe: a frase do começo já disse o plano, e você pode mudar qualquer coisa a qualquer momento.

**A prévia.** Você recebe um rascunho do tamanho de um celular, com som, que abre no seu player. Antes de mostrar, a IA olha os quadros do vídeo e corrige o que encontrou de errado. Junto vêm os textos que aparecem na tela, com a origem de cada número. O vídeo final só é feito depois do seu sim. Se você disser "faz direto, não precisa me mostrar", a IA faz a prévia, olha os quadros do mesmo jeito e segue para o final sem parar.

**O vídeo final.** Sai em 1080×1920, com o som no volume que as redes usam, a capa e as notas para postar. A IA abre o vídeo para você e conta o que a conferência disse.

**Os programas.** O app usa o ffmpeg e um navegador que roda sem abrir janela. No Windows, o Microsoft Edge já vem instalado; no Mac e no Linux, a IA instala o Chromium se não houver navegador. O render é feito por outro app do flyee, o Motor de vídeo. Se faltar um programa, a IA avisa numa frase e instala sozinha. Se faltar o Motor de vídeo, ela diz o que ele declara e instala depois do seu sim. Tudo acontece na conversa, e você não digita nenhum comando.

**O tempo.** Conte de 10 a 15 minutos até a prévia de um vídeo de 15 segundos, e mais alguns minutos para o final. A IA diz a estimativa antes de começar. O trabalho usa o seu plano de IA, porque é ela que escreve, olha os quadros e corrige.

## O que você recebe

Tudo fica na pasta `estudio-de-video/` do seu projeto, com uma pasta por vídeo, por exemplo `estudio-de-video/loja-aurora-oferta/`. Dentro dela:

| Pasta ou arquivo | O que tem |
|---|---|
| `entrega/` | o vídeo final em MP4, a capa (`capa.png`), as notas para postar (`notas.md`) e o relatório da conferência |
| `previa/` | a prévia com som e a folha com um quadro por batida |
| `briefing.md` | o plano do vídeo, com a origem de cada decisão (o que você disse, o que veio do site, o que é padrão), escrito quando a IA mostra o plano a você |
| `roteiro.json` | as cenas, os textos e os tempos, que a IA ajusta quando você pede mudanças |
| `materiais/` | os arquivos que você quiser pôr no vídeo |

As notas dizem em qual rede postar e como, trazem um texto sugerido para o post (montado só com o que está no vídeo), contam de onde veio a música e listam o que ainda é decisão sua antes de publicar.

Fora das pastas de vídeo ficam `estudio-de-video/marcas/`, com a marca guardada, e `capturas/`, com as telas copiadas do site. Do segundo vídeo da mesma marca em diante, nada sobre ela é perguntado de novo.

## Dicas para um resultado melhor

- Diga o site da marca, o @ ou só o nome. Se o endereço já está escrito no seu projeto, a IA o encontra sozinha.
- Ponha na pasta de materiais o que o site não mostra. O logo em boa qualidade (SVG, ou PNG com pelo menos 200 px de altura) leva "logo" no nome. Prints de telas que só aparecem depois do login levam "tela" ou "print" no nome. As fotos de produto entram na ordem dos nomes: 1-casaco.jpg, 2-bota.jpg. Peça à IA para abrir a pasta para você.
- Dê os números de verdade. Preço, prazo e resultado só aparecem se você disser ou se estiverem publicados no site. Sem prova real, o vídeo não mostra prova.
- Uma música sua só entra se você tiver o direito de usá-la em publicações e anúncios.
- Nunca ponha senhas ou documentos na pasta de materiais.
- Olhe a prévia com calma. A conferência mede leitura, zona segura, ritmo e volume; se o vídeo ficou bonito, quem decide é você.

## Como pedir mudanças

Fale como falaria com quem editou o vídeo:

> "Troque a abertura por 'Frio chegou. A lã também.'"

> "A cena do preço passa rápido demais. Deixe mais tempo nela."

> "Use o estilo vitrine."

> "Tire a música e deixe só os efeitos."

> "Continua o vídeo da loja."

Toda mudança de texto, de tempo ou de música gera uma prévia nova, que você vê antes do final. Se você mudar uma resposta depois de aprovar o plano, o sim continua valendo e a próxima prévia já mostra a mudança. Para retomar outro dia, basta pedir: a IA continua de onde parou.

## Limites desta versão

- Só vídeo animado na vertical (1080×1920), de 6 a 20 segundos. Um pedido mais longo sai com 20.
- O app não edita gravações suas, não gera cenas nem pessoas e não entrega em outros formatos. Se você pedir, a IA explica e oferece o vídeo animado.
- Um vídeo de referência ainda não é assistido. A IA pede que você diga em uma frase o que gosta nele e escolhe o estilo mais próximo.
- Telas que ficam atrás de login só entram pelos seus prints.
- Precisa de uma IA que leia imagens, porque ela olha os quadros para julgar o vídeo.
- O app não publica. Você posta pelo aplicativo de cada rede.
