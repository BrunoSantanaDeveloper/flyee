# Como usar

O Motor de vídeo transforma uma página animada em vídeo pronto para publicar. Você descreve o vídeo para a sua IA, e ela escreve uma página que desenha cada instante. O Motor fotografa essa página quadro a quadro, põe trilha original e efeitos na batida, confere o que as redes exigem e entrega o arquivo no formato pedido: 9:16 para Reels, TikTok e Shorts, 4:5 para o feed, 16:9 para o YouTube ou outro tamanho.

Serve para quem precisa de vídeos curtos com a cara da marca sem abrir um editor: o Reels de um lançamento, a demonstração de uma funcionalidade, uma vinheta, um slide animado. Também confere um vídeo que você já tem, antes de ele ir para as redes.

## Direto ou por outros apps

Você pode usar o Motor direto, conversando com a sua IA. Outros apps do flyee.club também trabalham com ele por baixo: o **Estúdio de vídeo**, que cria vídeos animados para Reels, TikTok e Shorts a partir do seu pedido, e o **Carrossel animado**, que faz carrosséis do Instagram com um vídeo curto em loop em cada slide. Esses apps escrevem a página e deixam com o Motor o render, o som e a conferência. Se um deles precisar do Motor e ele ainda não estiver instalado, a sua IA conta o que ele vai poder fazer no seu computador e, com o seu sim, instala.

## Peça assim

- "Faça um Reels de 15 segundos sobre o lançamento do meu produto, com trilha original na batida."
- "Capture o site da minha marca e use o logo, as cores e as telas reais no vídeo: minhamarca.com.br"
- "Faça uma prévia e me mostre os quadros antes do vídeo final."
- "Coloque uma trilha em loop, estilo lo-fi, neste slide, com um clique quando o botão aparece."
- "Renderize o mesmo vídeo em 9:16, 4:5 e 16:9."
- "Confira se este vídeo passa no Reels, no TikTok e no Shorts."

## O que acontece

Tudo acontece na conversa com a sua IA. Ela roda cada passo; você responde e decide.

1. **A máquina, na primeira vez.** O Motor precisa do ffmpeg, o programa que monta o vídeo, e de um navegador. Se faltar o ffmpeg, a IA avisa numa frase e instala sozinha, com o seu ok. No Windows, o navegador é o Microsoft Edge, que já vem com o sistema; no Mac e no Linux, a IA instala o Chromium se não houver nenhum. Em casos raros, a instalação precisa de algo que só você pode fazer, como dar a senha de administrador no Linux: a IA mostra esse passo único e espera.
2. **Sem chave.** O Motor não usa conta nem chave de nenhum serviço, então não há página de chave para preencher.
3. **A marca de verdade.** Logo, cores, fontes, telas e números vêm do seu site, que o Motor visita e fotografa, ou dos arquivos que você mandar. O que não estiver em nenhum dos dois, a IA pede a você em vez de inventar.
4. **O som primeiro.** A IA compõe a trilha antes de animar, porque a batida decide onde caem os cortes. Se você trouxer uma música, o Motor mede o andamento dela; quando a leitura fica incerta, a IA pergunta o BPM.
5. **A prévia.** Antes do vídeo final, a IA faz uma prévia em metade do tamanho e fotografa os quadros para conferir o vídeo antes de mostrar a você. Se quiser ver a prévia ou a folha de quadros, peça.
6. **A conferência.** Antes de entregar, o Motor confere a capa, o texto longe dos botões da rede, o tamanho da letra no celular, os cortes na batida, a emenda do loop, as piscadas, o tempo parado, o volume e, para cada rede de destino, o formato e a duração.
7. **A entrega.** A IA abre o vídeo no player do seu computador, diz onde ficou cada arquivo e o que a conferência achou. Cada item vem marcado: ✓ passou · ✗ reprovou · △ aviso · ○ não medido. Quando um item reprova, a IA corrige e confere de novo; publicar assim mesmo é decisão sua, sabendo o que reprovou.

**Quanto tempo leva.** Cada segundo de vídeo a 30 quadros por segundo são 30 fotografias: um Reels de 15 segundos tem 450. O tempo depende do seu computador e do que a página desenha. A prévia sai mais rápido; o vídeo final com desfoque de movimento leva de duas a quatro vezes o tempo de um render comum. Um filme de 45 a 60 segundos é outra escala: leva horas, com rodadas de revisão, e a IA avisa antes de começar.

## O que você recebe

Tudo fica no seu computador, na pasta que a IA escolher para o vídeo:

| Onde | O que fica |
|---|---|
| a pasta do vídeo | `pagina.html`, a página que desenha o vídeo, e `motion.js`, a biblioteca de animação que ela usa |
| ao lado da página | a prévia (`previa.mp4`) e o vídeo final em .mp4, ou em .mov e .webm na camada transparente |
| `quadros/` | as fotos dos instantes conferidos e a folha de contato (`folha.png`) |
| ao lado do vídeo pronto | a folha de contato, o teste de celular e o relatório da conferência (`.aceite.json`) |
| na pasta que a IA indicar | a trilha e os efeitos (`.wav`), com a grade de batidas ao lado de cada trilha (`.beats.json`) |
| `capturas/` | uma pasta por site, com a marca lida (`captura.json`), as telas do computador e do celular, as rolagens gravadas e o logo |

A trilha e os efeitos são gerados no seu computador, sem música de terceiros, e podem ir em posts e anúncios.

## Dicas

- Diga logo para qual rede é o vídeo. O formato, a duração e a área livre dos botões saem disso.
- Dê o endereço do site da marca, ou mande o logo e as imagens. Com material real, o vídeo usa a sua identidade em vez de uma parecida.
- Peça a prévia quando quiser opinar no meio do caminho. Ela serve para errar rápido.
- Para pedir uma mudança, diga o instante e o que muda: "no segundo 3, o título entra maior", "segure o logo um segundo a mais no fim", "troque a trilha por uma mais calma".
- Quer outra trilha no mesmo estilo? Peça "outra versão da mesma trilha". Cada versão tem um número de semente, e a mesma semente refaz a mesma música, então dá para voltar atrás.
- No celular, duas linhas curtas leem melhor que uma longa. Peça menos texto por cena em vez de letra menor.
- Se for usar uma música sua, confirme antes que você tem o direito de usá-la no post ou no anúncio.

## Limites

- O Motor não grava nem cria voz. Ele mistura uma narração que você trouxer, com a música abaixando quando você fala.
- Não cria fotos nem ilustrações. Usa as telas e imagens do seu site ou os arquivos que você mandar.
- Não publica nem agenda. Entrega os arquivos prontos para você subir.
- As fontes vêm do seu computador. Em outra máquina, sem as mesmas fontes, o vídeo sai diferente.
- A conferência mede o que dá para medir. Se o vídeo ficou bom, quem julga é você, com a IA olhando os quadros.
- As redes mudam os limites sem aviso. A tabela do Motor foi conferida em 7 de outubro de 2026.
- Alguns sites barram visitas automáticas. Nesse caso, a IA pede as telas a você. Capture só o site da sua marca ou um que você tenha direito de usar.
- Músicas das bibliotecas das redes não podem ir no arquivo exportado: elas valem só dentro da rede.
