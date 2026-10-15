# Como usar

O Carrossel animado faz carrosséis para o Instagram em que cada slide é um vídeo curto que se repete sem emenda. As frases entram na batida, um número conta, os cartões aparecem um a um, e a música continua de um slide para o outro. Você diz o tema. A sua IA escreve, desenha, anima, gera a trilha, confere e entrega os vídeos prontos para postar, com uma prévia de como fica no celular.

Serve para quem posta no feed e quer um carrossel que se mexe: quem ensina, quem lança um curso ou um produto, quem tem uma opinião para defender. Você não precisa saber editar vídeo nem ter fotos: os slides são feitos de letras, formas e cor.

## Peça assim

- "Faça um carrossel animado sobre organizar a semana no domingo."
- "Faça um carrossel animado sobre por que as pessoas desistem da academia em fevereiro, tema noir, 5 slides."
- "Crie um carrossel em vídeo para o lançamento do meu curso de fotografia com celular: 4 slides, visual azul, terminando com 'comente FOTO'."
- "Refaça o slide 3 do carrossel da academia com outra frase: 'Dor sem placar não vira hábito'."

## O que acontece

1. **A IA confere o seu computador.** Na primeira vez, ela vê se tem tudo o que o app usa. O render vem de outro app do flyee.club, o Motor de vídeo: se ele faltar, a IA conta numa frase o que ele faz e o que acessa, e só o instala com o seu sim. Se faltar o ffmpeg (o programa que monta os vídeos) ou um navegador para fotografar os quadros, ela avisa numa frase e instala. No Windows, o Microsoft Edge já vem com o sistema. Você não digita nada. Só quando a instalação pede algo que só você pode dar, como a senha de administrador, a IA mostra esse passo e espera.
2. **Ela pergunta o que falta, de uma vez.** O tema, para quem é, o que a pessoa leva ao chegar no último slide, o tom, a palavra que a pessoa vai comentar no fim e o que ela recebe ao comentar. O resto ela decide e diz: quantos slides (5 é o padrão), as cores, o estilo da trilha e quanto dura cada slide. Qualquer escolha dela pode ser trocada.
3. **Ela escreve e desenha os slides.** Um gancho que faz a pessoa parar, os pontos (uma ideia por slide) e a chamada final. Antes de gastar tempo com vídeo, a IA fotografa cada slide batida por batida, olha as imagens e confere as medidas do feed. O que reprova, ela corrige.
4. **Você vê a prévia.** A IA gera uma versão rápida, em metade do tamanho, e abre no seu navegador uma página que imita o celular. Você desliza os slides, vê o contador "1/5" e liga o som no botão "Som": a prévia começa muda, como o feed. O botão "Grade" mostra todos os slides lado a lado, tocando juntos. A IA conta o que viu nos quadros e pergunta o que mudar antes da versão final.
5. **Ela faz a versão final.** Renderiza em tamanho cheio e confere tudo de novo, agora também os trechos parados, as piscadas e o volume. Faz ainda um teste de leitura no tamanho de um celular. Depois entrega a pasta, os vídeos na ordem, como postar, o resultado da conferência item por item e uma sugestão de legenda com a palavra da chamada.

**Quanto tempo leva.** Cada slide é fotografado quadro a quadro. Conte uns trinta segundos por slide na prévia e um minuto por slide na versão final, mais as conferências. Um computador ocupado leva mais. Se o trabalho for interrompido, peça para continuar: os slides prontos são aproveitados.

## Sem chave e sem conta

Tudo roda no seu computador: os slides, a trilha gerada ali mesmo, a prévia, a conferência e a entrega. Nada depende de chave nem de conta, e o render não usa a internet.

Os slides são feitos de letras, formas e cor, num dos cinco temas visuais ou nas cores da sua marca. Um logo seu pode entrar: você passa o arquivo, e a IA o coloca na pasta do carrossel. Esta versão não usa fotos nem imagens geradas.

## O que você recebe

Cada carrossel ganha uma pasta dentro do seu projeto:

| Onde | O que é |
|---|---|
| `carrosseis/<nome>/out/` | os slides finais (`01.mp4`, `02.mp4` e assim por diante), com som, prontos para postar |
| `carrosseis/<nome>/preview.html` | a prévia que imita o celular; abra no navegador quando quiser |
| `carrosseis/<nome>/brief.md` | o briefing: tema, para quem, promessa, tom, os slides e a chamada final |
| `carrosseis/<nome>/relatorio.json` | o resultado da última conferência, slide por slide |
| `carrosseis/<nome>/assets/` | o que você trouxer: um logo, a sua música |

Os outros arquivos da pasta (o roteiro, as páginas dos slides, a trilha, as prévias rápidas) são o material de trabalho: é com eles que a IA refaz só o que mudou.

**Para postar**, abra o aplicativo do Instagram, escolha os arquivos de `out/` na ordem e publique como um só carrossel. O app não publica nada por você.

## Dicas e mudanças

- **Diga para quem é e o que a pessoa leva.** Com público e promessa claros, o gancho sai mais forte do que a partir de um tema solto.
- **Dê os números, se houver.** A IA só põe num slide os números que você deu ou a fonte que você indicou, e não promete alcance nem engajamento.
- **Peça mudanças slide por slide.** "Troque a frase do slide 3", "quero outra trilha", "deixe o slide 2 mais longo". Só o que mudou é refeito.
- **Use a sua música, se quiser.** Deixe o arquivo na pasta do carrossel e diga que pode usar. A IA mede o andamento e ajusta os slides a ele. Use só música que você tem o direito de usar no post.
- **Traga a sua marca.** Diga as cores (fundo, texto e destaque) e passe o logo em PNG com fundo transparente.
- **Olhe a prévia com som.** A conferência mede o que dá para medir. Gostar do resultado é com você.

## Limites

- O app não publica: quem posta é você, pelo aplicativo do Instagram.
- Um carrossel tem de 2 a 20 slides, e cada slide dura de 3 a 60 segundos. De 3 a 7 slides é o que costuma caber numa ideia.
- O formato é o 4:5 (1080×1350), o recomendado para o feed. O 3:4 (1080×1440) também serve.
- O movimento é desenhado: o app não gera vídeo por IA.
- Sem fotos e sem imagens geradas nesta versão: os slides são de letras, formas e cor, com o seu logo quando você quiser.
- As letras vêm do seu computador: a fonte Inter, quando está instalada, ou a do sistema. Em outro computador, o mesmo slide pode quebrar as linhas em outro ponto.
- O som só toca depois que a pessoa liga o áudio no feed. O movimento precisa contar a história sozinho.
- A IA precisa ler imagens para julgar os slides, como o Claude Code faz.
