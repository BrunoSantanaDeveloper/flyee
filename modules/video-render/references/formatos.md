# Um filme, vários formatos

Um filme é uma linha do tempo; 9:16, 4:5, 1:1 e 16:9 são quatro composições dela. Nunca recorte um 16:9 para fazer o vertical: desenhe a página com uma função de layout, e cada formato recompõe o quadro a partir do mesmo `t`. O método de animação está em `motion.md`; o som, em `som.md`; a tabela das redes, em `redes.json`, ao lado deste guia.

## 1. Uma linha do tempo, uma função de layout

Quando `--format` difere do tamanho da página, o Motor chama `window.setFormat({ name, width, height })` antes do primeiro quadro. A página guarda o formato, e todo desenho pergunta ao layout onde as coisas ficam:

```js
let fmt = "9:16";
window.setFormat = ({ name, width, height }) => {
  fmt = name; canvas.width = width; canvas.height = height; film.width = width; film.height = height;
};
function layout(W, H) {
  const safe = Motion.safeArea(fmt);                                   // onde texto, logo e rosto podem ficar
  const vertical = H > W;
  return {
    safe,
    titulo: vertical ? Math.round(W * 0.14) : Math.round(H * 0.085),   // 150 px no 9:16, 92 px no 16:9
    rotulo: vertical ? 48 : 30,
    colunas: vertical ? 1 : 2,                                         // cartões empilhados em pé, lado a lado deitado
    pip: vertical
      ? { x: safe.x, y: safe.y + safe.h - 560, w: 420, h: 560 }        // a câmera embaixo, à esquerda, acima da legenda da rede
      : { x: safe.x + safe.w - 480, y: safe.y, w: 480, h: 270 },       // a câmera no canto superior direito da área segura
  };
}
window.seek = (t) => { const L = layout(canvas.width, canvas.height); /* desenhe a partir de t e de L */ };
```

| Muda por formato | Nunca muda |
|---|---|
| o tamanho do tipo (`motion.md`, §6: título 110–190 px em pé, 64–100 px deitado) | a duração, a grade de batidas e os cortes (`film.cuts`) |
| o empilhamento: colunas deitado, linhas em pé | o som: música, efeitos e mixagem são os mesmos arquivos |
| a posição e o tamanho da janela de câmera (PiP) e da tela dividida | a ordem das cenas e o condutor de cada transição |
| quanto do fundo sangra fora da zona segura | o texto na tela: as mesmas palavras, nos mesmos instantes |

Renderize cada formato a partir da mesma página: `render pagina.html --format 9:16 --out entrega/reel-9x16.mp4 --json`, depois `--format 4:5`, `--format 1:1` e `--format 16:9`, cada um mixado (`mix`) e conferido (`accept --format`). Confira cada um com `frames pagina.html --format 16:9 --beats beats.json --json` antes do render final: um layout que funciona em pé costuma deixar o título pequeno demais deitado, e um que funciona deitado empilha mal em pé. Os formatos com nome são cinco: 9:16, 4:5, 3:4, 1:1 e 16:9. Um tamanho fora deles (`LxA`, por exemplo `--format 720x1280`) chega em `setFormat` com `name` igual a `"720x1280"`, e `Motion.safeArea` devolve para ele a área do 9:16: calcule a sua a partir de `redes.json`.

## 2. Zonas seguras

As redes põem botões, nome, legenda e barras por cima do vídeo. `Motion.safeArea(formato)` devolve a área livre deles (`{ x, y, w, h }`), no tamanho padrão de cada formato:

| Formato | Tamanho | Área segura | Fora dela |
|---|---|---|---|
| 9:16 | 1080×1920 | x 70, y 250, 830×1170 | 250 px em cima (nome, áudio), 500 px embaixo (legenda, título e curtidas: a faixa mais alta entre Reels, TikTok e Shorts; só os Reels pediriam 420), 180 px à direita (botões) |
| 4:5 | 1080×1350 | x 72, y 120, 936×1030 | 120 px em cima, 200 px embaixo, 72 px nas laterais: a margem do carrossel do Instagram, longe do contador "1/N" e do botão de som |
| 3:4 | 1080×1440 | x 72, y 120, 936×1120 | como o 4:5 |
| 1:1 | 1080×1080 | x 60, y 80, 960×880 | 80 px em cima, 120 px embaixo |
| 16:9 | 1920×1080 | x 100, y 80, 1720×850 | 150 px embaixo (barra de progresso, legendas), 80 px em cima (título) |

Dentro: todo texto, o logo, rostos, o CTA. Fora: fundo, formas decorativas, a parte de uma tela que sangra. Cada rede tem o próprio recuo em `redes.json` (`networks --json` devolve a tabela), e o `accept --networks` usa o mais estrito entre as redes pedidas: um vídeo aprovado para `reels,tiktok,shorts` cabe nas três. Anúncios cobrem mais que posts (até 672 px embaixo nos anúncios de Reels e Stories): quando o destino é anúncio, desenhe com a zona do anúncio desde o começo.

## 3. A capa

A capa é o quadro que aparece na grade do perfil e antes do play. Um 9:16 aparece cortado em 4:5 no feed e em 1:1 na grade: o que importa fica nos 1080×1080 centrais. Escolha um instante em que:

- o protagonista (o título ou o produto) ocupa o centro e sobrevive a esse recorte;
- há texto legível, mas pouco: uma frase, 110 px ou mais no vertical;
- nada importante está no quarto inferior do quadro nem atrás dos botões;
- a imagem não está no meio de uma rajada (sem rastro, sem borrão, sem texto trocando).

Fotografe com `frames pagina.html --times <t> --out entrega/capa --json` (acrescente `--format` para a capa de outro formato) e entregue o PNG no tamanho do formato. Uma capa por formato quando a composição muda.

## 4. Duração por uso

| Uso | Duração | O que cabe |
|---|---|---|
| gancho | os primeiros 2 s | algo acontece no primeiro tempo forte: a frase ou a imagem mais forte do filme; quem avança decide em 2 ou 3 segundos |
| post padrão | 15 s | 2 capítulos, 1 drop, 1 soco; 7,5 compassos a 120 BPM; é a duração que os anúncios de Reels e Stories recomendam e a que rende mais alcance nos Reels (15–30 s) |
| anúncio, vídeo de feed | 20–30 s | 3–4 capítulos; a oferta e o CTA ganham 1 compasso parado; é a faixa de maior engajamento no TikTok (21–34 s) |
| filme de lançamento | 45–60 s | 5–6 capítulos; leva horas de produção, com rodadas de crítica por capítulo: avise o integrante antes de começar |

Em qualquer duração, algo novo acontece a cada 2–4 s e o fecho segura parado pelo menos 1 tempo. Os limites e as durações recomendadas de cada rede estão em `redes.json`; o `accept` reprova acima do máximo e avisa acima do recomendado.

## 5. Legendas

- **Vertical:** legenda palavra a palavra, sincronizada com a fala (cada palavra acende no seu tempo), 44 px ou mais, dentro da zona segura, na metade inferior mas acima da faixa da rede. Até 30 caracteres por linha, no máximo 2 linhas por vez, com fundo chapado ou sombra atrás das palavras.
- **Horizontal:** legenda por frase, até 42 caracteres por linha, acima dos 150 px inferiores. Num vídeo deitado que vai para o feed, ele aparece na largura do celular: a letra precisa de 78 px ou mais (o `accept` mede assim, escalando pela largura os 44 px de um quadro de 1080). Num vídeo para tela grande (o YouTube assistido no computador ou na TV), 26 px bastam: passe `--min-text 15` ao `accept`, porque o mínimo é dado na largura de 1080.
- **SRT sempre:** um arquivo `.srt` por idioma acompanha cada vídeo com fala, para quem assiste sem som e para a rede indexar, mesmo quando a legenda já está gravada no vídeo. Nas redes de vídeo longo a legenda gravada é opcional e o SRT é o principal.
- As legendas são texto da página, desenhadas em `seek(t)` a partir dos tempos da transcrição; declare-as em `window.boxes(t)` com `role: "text"` e `size`, para o `accept` conferir zona segura e legibilidade.

## 6. O que quem publica espera receber

Uma pasta de entrega completa, pronta para agendar:

| Arquivo | Para quê |
|---|---|
| um vídeo por formato pedido (`reel-9x16.mp4`, `feed-4x5.mp4`, `quadrado-1x1.mp4`, `wide-16x9.mp4`) | cada rede recebe o formato nativo, nunca um recorte |
| a versão **sem texto** de cada formato | para legendar na própria rede, traduzir ou reaproveitar |
| a versão **sem música** de cada formato | para usar a biblioteca de músicas da rede, que não pode ir em arquivos exportados |
| a capa (`capa-9x16.png`, …) | a grade do perfil e o quadro antes do play |
| o `.srt` (por idioma) | legendas ocultas e indexação |
| o relatório do `accept` de cada vídeo (`<vídeo>.aceite.json`) | a prova do que foi conferido, com cada regra e o seu veredito |
| `notas.md` | o gancho e todo o texto na tela, a descrição sugerida do post, o CTA, os números usados e a origem de cada um, a trilha (gerada, com a `seed`, ou licenciada) e os formatos entregues, e o que ficou abaixo da meta, se ficou |

A camada transparente (`render --alpha --out camada.mov`) entra quando o integrante vai compor as animações por cima da própria gravação em outro editor.
