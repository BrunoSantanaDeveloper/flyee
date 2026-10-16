# Estúdio de vídeo

Transforma um pedido em um vídeo animado para Reels, TikTok e Shorts. Você diz o que quer divulgar; a sua IA pergunta só o que falta, busca o logo, as cores e as telas reais da sua marca, escreve o roteiro, compõe a trilha na batida, mostra uma prévia e entrega o vídeo conferido e pronto para postar.

## O que ele faz

Vídeo animado é aquele feito de texto em movimento, telas do produto, números que crescem e som no ritmo: o tipo de vídeo de lançamento ou de anúncio que costuma custar caro e levar dias. Aqui ele nasce de uma conversa. A sua IA escreve o vídeo como uma página que desenha cada instante, e o app Motor de vídeo transforma essa página em MP4, com trilha, efeitos e conferência.

O que separa um vídeo bom de um vídeo com cara de modelo pronto é o que vem antes do render, e é disso que este app cuida:

- **O pedido vira um briefing.** O app mede o que você escreveu. Um pedido completo não recebe pergunta nenhuma. Um pedido curto, como "faça um vídeo animado", vira uma conversa de até três rodadas rápidas (o vídeo, a história, o jeito), com opções prontas para marcar. Em qualquer rodada você pode dizer "decida por mim". No fim, a IA escreve o briefing inteiro de volta e só constrói com o seu sim.
- **A marca é a de verdade.** A IA visita o seu site e traz o logo, as cores, as fontes, as telas e os números que estão publicados. Nada é redesenhado de imaginação e nenhum número é inventado: se o site não publica um resultado, o vídeo não mostra resultado.
- **Um roteiro que conta uma história.** Cinco roteiros prontos: lançamento (o problema, o produto se montando, os recursos e a assinatura), interface que se transforma (um elemento que muda de estado a cada batida), oferta (produto, preço, prazo e chamada), lista (um gancho e de três a cinco itens) e passo a passo (de dois a cinco passos em ordem, ligados por um caminho que avança a cada um). A IA sugere o que combina com o seu objetivo.
- **Som na batida.** A trilha é composta ali mesmo, sem música de terceiros, e cada corte e cada entrada caem no tempo dela. Pode ir em post e em anúncio.
- **Prévia antes do final.** Você assiste a um rascunho do tamanho de um celular, com som, e lê os textos que aparecem na tela. O vídeo final só é feito depois do seu sim.
- **Conferência.** O app mede o que dá para medir: a primeira imagem já legível, o texto longe dos botões das redes, o tamanho da letra, os cortes na batida e o volume. O que reprovar aparece no relatório, nunca escondido.

## Como é a conversa

Com um pedido completo, a IA diz em uma frase o que vai fazer e começa. Com um pedido curto, ela pergunta em rodadas pequenas:

1. **O vídeo:** de qual marca é, para que serve, onde você vai publicar e quanto tempo dura.
2. **A história:** o que o vídeo divulga, qual roteiro, quais três coisas mostrar e se há um número que prove.
3. **O jeito:** o que quem assiste deve sentir, um estilo (ou um vídeo de referência), o som e como termina.

Entre a primeira e a segunda rodada a IA visita o seu site, e por isso as opções seguintes já vêm com os seus produtos e os seus textos. Depois ela escreve o briefing completo ("Vou fazer assim: …") e espera o seu sim.

## O que você precisa

- Uma IA que leia imagens, como o Claude Code: ela precisa olhar os quadros do vídeo para julgar o resultado.
- O app **Motor de vídeo** (`video-render`), que captura o site, compõe o som, renderiza e confere. Quando ele faltar, a sua IA diz em uma frase o que ele declara e, com o seu sim, o instala (`npx --yes flyee@latest add video-render`).
- O **ffmpeg** e um navegador sem janela. No Windows, o Microsoft Edge já vem instalado; no Mac e no Linux servem o Chrome, o Edge ou o Chromium. Você não instala nada: a sua IA instala o que faltar na primeira vez, depois de avisar.

Não há chave nem conta externa nesta versão.

## O que ter em mãos

- O site da marca, o @ ou só o nome. Se o endereço já está no seu projeto, a IA o encontra sozinha.
- Opcional, na pasta de materiais do vídeo: o logo em boa qualidade, fotos de produto, prints de telas que só aparecem depois do login e uma música sua, com direito de uso. Nunca senhas.

## Peça assim

> "Faça um vídeo animado de 15 segundos para o Reels apresentando a minha loja: https://…"

Outros pedidos:

> "Faça um vídeo animado."

> "Quero um anúncio de 20 segundos da promoção de inverno: casaco de lã por R$ 199 até domingo, fecha com 'link na bio'."

> "Vídeo de lançamento do meu aplicativo de agenda. Abre com 'Chega de planilha'. Mostra: marcar um horário, lembrete automático e pagamento pelo celular. Fecha com o logo e meuapp.com.br."

> "Troque a abertura do vídeo da loja por 'Frio chegou. A lã também.' e refaça a prévia."

## O que ele grava

Tudo fica em `estudio-de-video/` dentro do seu projeto, uma pasta por vídeo:

| Caminho | Conteúdo |
|---|---|
| `estudio-de-video/<vídeo>/briefing.md` | o briefing completo, com a origem de cada decisão (você disse, achei no site, padrão) |
| `estudio-de-video/<vídeo>/roteiro.json` | o roteiro: as cenas, os textos, os compassos de cada uma e os efeitos sonoros |
| `estudio-de-video/<vídeo>/pagina.html` | a página que desenha o vídeo (a sua IA ajusta quando você pede mudanças) |
| `estudio-de-video/<vídeo>/previa/` | a prévia com som, em tamanho de celular, e a folha com um quadro por batida |
| `estudio-de-video/<vídeo>/entrega/` | o vídeo final (1080×1920), a capa, as notas para postar e o relatório da conferência |
| `estudio-de-video/<vídeo>/audio/` | a trilha, as batidas e os efeitos |
| `estudio-de-video/<vídeo>/materiais/` | os seus arquivos: logo, fotos, prints, música |
| `estudio-de-video/<vídeo>/pedido.json` | o andamento do vídeo, para a IA retomar de onde parou |
| `estudio-de-video/marcas/<marca>/` | a marca guardada: do segundo vídeo em diante, nada sobre ela é perguntado de novo |
| `capturas/<site>/` | as telas e os dados capturados do site |

## Cuidados

- **Leva alguns minutos e usa o seu plano de IA.** Conte de 10 a 15 minutos até a prévia de um vídeo de 15 segundos, e mais alguns para o final. A IA avisa o tempo antes de começar.
- **Olhe a prévia.** A conferência mede legibilidade, zona segura, ritmo e volume; gostar do resultado é com você. Mudanças de texto, de tempo ou de música geram uma nova prévia.
- **Só o que é real.** Logo, cores e telas vêm do seu site ou dos seus arquivos; números só os publicados ou os que você informar. Sem prova real, o vídeo não mostra prova.
- **Marca de outra empresa.** Se o vídeo mostrar o logo de terceiros, a IA pergunta antes: as regras de uso de cada marca são de quem publica.
- **Publicidade.** Se o vídeo é pago por outra marca, a IA lembra do aviso de publicidade no texto do post.
- **A música é sua.** A trilha é composta no seu computador, sem terceiros. Uma música sua só entra com o direito de uso confirmado.
- **Nada sai do seu computador.** A única conexão do app é a visita ao site da marca. O app não publica: você posta pelo aplicativo de cada rede.

## Nesta versão

Vídeos animados na vertical (1080×1920), de 6 a 20 segundos, para Reels, TikTok e Shorts. Um vídeo de referência ainda não é assistido: a IA pede que você descreva em uma frase o que gosta nele e escolhe o estilo mais próximo. Editar uma gravação sua, gerar cenas com pessoas e entregar em outros formatos ficam fora desta versão; quando você pedir, a IA explica e oferece o vídeo animado.

## O que há de novo

- 1.1.0: roteiro passo a passo, para mostrar como algo funciona ou como se faz: de dois a cinco passos em ordem, ligados por um caminho no alto que avança a cada passo, e o resultado no fim quando você diz qual é. Pedidos com "passo a passo", "como funciona" ou "tutorial" vão para ele; dicas e erros continuam na lista. Os textos da tela passam pela revisão de texto natural do flyee, e a conferência mostra cada item com um nome em português.
- 1.0.0: primeira versão. Briefing que mede o pedido e pergunta só o que falta; marca real capturada do site; quatro roteiros e cinco estilos; trilha original e efeitos na batida; prévia antes do final; conferência para as redes; capa e notas para postar.
