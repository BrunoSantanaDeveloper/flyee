# O aceite: o que conferir antes de publicar

Antes de uma peça ir para uma rede, o Motor confere nela o que costuma dar errado e que ninguém vê na prévia: uma capa sem texto legível, um título atrás dos botões da rede ou embaixo do contador do carrossel, uma letra pequena demais no celular, um corte fora da batida, um loop que salta, uma piscada que incomoda, um trecho parado que faz rolar a tela, um som mais baixo que o dos outros vídeos, um formato ou uma duração que a rede recusa. Cada item volta com um veredito e com o que mudar para resolver.

## Dois usos, um comando

**1. A página, antes de publicar.** Um slide de carrossel, um loop, um filme: o primeiro argumento é a página, aberta do mesmo jeito que o render a abre. Com `--video`, o Motor mede também o vídeo renderizado dela. Nenhuma rede entra sem ser pedida (é o caso do carrossel); `--networks` acrescenta as conferências por rede.

```
node .flyee/modules/video-render/scripts/render.mjs accept carrosseis/academia/slides/02.html --format 4:5 --safe instagram-carousel --loop --beats carrosseis/academia/audio/music.beats.json --min-text 44 --video carrosseis/academia/out/02.mp4 --json
```

**2. O vídeo pronto, contra as redes.** O primeiro argumento é o vídeo (`.mp4`, `.mov` ou `.webm`). Sem `--networks`, entram as redes habituais do formato; com `--page`, entram também as conferências que só a página permite (capa, área segura, texto, cortes exatos). O relatório fica gravado ao lado do vídeo, em `<vídeo>.aceite.json`.

```
node .flyee/modules/video-render/scripts/render.mjs accept estudio/lancamento/reel-final.mp4 --page estudio/lancamento/pagina.html --beats estudio/lancamento/beats.json --networks reels,tiktok,shorts --json
```

`accept pagina.html --video video.mp4` e `accept video.mp4 --page pagina.html` fazem as mesmas conferências e chegam aos mesmos vereditos. Só mudam dois padrões: com o vídeo primeiro, entram as redes habituais do formato e o relatório é gravado ao lado dele; com a página primeiro, nenhuma rede entra sem `--networks` e o relatório só é gravado com `--out`.

A página abre no navegador sem janela; o vídeo é medido pelo ffmpeg. Quando falta o que um item precisa (a página, o vídeo, as batidas, um dos dois programas), ele volta como `skip`, e `summary` ou `warnings` dizem o que faltou.

## As opções

| Opção | Para quê |
|---|---|
| `--page <pagina.html>` / `--video <vídeo>` | o outro arquivo da mesma peça, quando o primeiro argumento é o vídeo ou a página |
| `--format 9:16\|4:5\|3:4\|1:1\|16:9\|LxA` | o formato conferido. Padrão: o do vídeo quando há vídeo, senão o da própria página. Outro tamanho pede `window.setFormat` na página |
| `--networks reels,tiktok,…` | as redes de destino (os `id` ou os apelidos da tabela). Padrão: com o vídeo primeiro, as habituais do formato (9:16 → `reels`, `tiktok`, `shorts`; 4:5 e 1:1 → `feed`; 16:9 → `youtube`); com a página primeiro, nenhuma |
| `--safe instagram-carousel\|instagram-feed\|networks\|margin\|none` | a área segura (veja a seção dela). Padrão: `networks` quando há redes; senão `instagram-carousel` em 4:5 e 3:4 e `instagram-feed` nos demais |
| `--margin <px>` | uma margem uniforme: sozinha vira a área `margin`; com `instagram-carousel`, troca os 72 px |
| `--min-text <px>` | o menor texto legível a 1080 px de largura (padrão 44; proporcional à largura: 22 px num quadro de 540). Num 16:9 de 1920 de largura o padrão vira 78 px, o certo para o feed no celular, onde o quadro deitado aparece pequeno; para tela grande (YouTube no computador ou na TV), `--min-text 15` dá 26,7 px a 1920 |
| `--every <s>` | de quanto em quanto as caixas da página são lidas (padrão 0,25), além de cada batida e do último quadro |
| `--beats <beats.json>` ou `--bpm <n>` | a grade de batidas; com `--bpm`, a batida 0 fica em `t = 0` |
| `--tolerance <quadros>` | quanto um corte pode ficar da batida (padrão 1 quadro nos cortes da página; 2 nos achados no vídeo) |
| `--min-on-beat <0 a 1>` | a fração mínima de cortes na batida (padrão 1 nos cortes da página; 0,7 nos achados no vídeo) |
| `--loop` | confere a emenda do último quadro com o primeiro |
| `--max-flashes <n>` | mudanças bruscas de luz toleradas em 1 s (padrão 3) |
| `--max-still <s>` | o trecho parado a partir do qual o item avisa (padrão 1,5) |
| `--still-by regions\|mean` | como o tempo parado é medido (veja `dead_time`): `regions` (padrão) ou `mean` |
| `--lufs <n>` | o volume alvo (padrão −14) |
| `--fps <n>` | a taxa de quadros da tolerância e do último quadro (padrão: a da página, ou a do vídeo) |
| `--out <relatorio.json>` | onde gravar o relatório |
| `--browser <caminho>` | outro navegador (Edge, Chrome ou Chromium) |

## Como ler o resultado

Com `--json`, a resposta traz `ok: true` mesmo quando algum item reprova: as reprovações são dados, em `checks`. Só um pedido quebrado (um arquivo que não existe, uma rede desconhecida) volta como erro.

| Campo | O que é |
|---|---|
| `passed` | `true` quando nenhum item está em `fail`; `warn` e `skip` não reprovam |
| `score` | quantos itens passaram (`passed`), reprovaram (`failed`), avisaram (`warned`) e não foram medidos (`skipped`); `counts` traz os mesmos números como `pass`, `fail`, `warn` e `skip` |
| `checks[]` | um item por conferência: `name`, `status`, `summary` (uma frase), `details[]` (os tempos, as caixas, os cortes, as medidas), `fix` (o que mudar, só em `fail` e `warn`) e, nos itens por rede, `network` (o `id` da rede) |
| `mode` | `page` quando a página veio primeiro, `video` quando o vídeo veio primeiro |
| `page`, `video` | os arquivos conferidos |
| `format`, `width`, `height`, `duration`, `fps` | o quadro conferido: o da página, no formato pedido, quando há página; senão o do vídeo |
| `media` | o vídeo como ele é: `format`, `width`, `height`, `duration`, `fps`, `has_audio` e `size_mb` |
| `safe` | a área segura usada: `preset`, `rect`, `corners` (os cantos reservados), `margin`, `networks` (as redes cuja zona valeu) e `insets` (os recuos de cada lado) |
| `min_text` | o menor texto aceito, já proporcional à largura |
| `beats`, `cuts`, `cuts_source`, `samples` | a grade usada, quantos cortes, de onde vieram (`page` ou `video`) e quantos instantes da página foram lidos |
| `networks`, `network_labels`, `networks_default` | as redes conferidas, o nome de cada uma para mostrar ao integrante e se vieram do formato |
| `limits` | os limites aplicados, já com as opções |
| `report` | o relatório gravado, ou `null` |
| `warnings` | avisos gerais: a página sem `window.boxes`, um vídeo de outra duração que a da página, um arquivo grande demais para uma rede, um programa que falta |

| Status | Significa | O que fazer |
|---|---|---|
| `pass` | dentro do limite | nada |
| `fail` | reprova a peça | aplique o `fix`, renderize de novo e confira de novo |
| `warn` | não reprova, mas costuma render menos ou incomodar | repasse ao integrante e decida com ele |
| `skip` | não deu para medir | `summary` diz o que faltou (a página, o vídeo, as batidas, `--loop`) |

Sem `--json`, a primeira linha traz o veredito (APROVADO ou REPROVADO) e quantos itens ficaram com cada marca; depois vem uma linha por item, com a marca na frente: ✓ passou · ✗ reprovou · △ aviso · ○ não medido (`pass`, `fail`, `warn` e `skip`). Os itens por rede trazem o nome da rede entre parênteses, e embaixo de cada `fail` ou `warn` vem uma linha "Como resolver". Nunca entregue uma peça com item reprovado sem dizer qual e por quê.

## Os itens, um a um

### `page`: a página

**O que mede.** A página abre, define `window.seek(t)`, declara a duração (`film.duration`), aceita o formato pedido (`window.setFormat`) e não dá erro ao carregar.

**Veredito.** `fail` interrompe a conferência: nada mais é medido, porque nada mais seria confiável. `skip` quando o vídeo veio sem `--page`.

**Como resolver.** O `fix` do item traz o passo; o contrato completo da página está em `pagina.md`.

### `first_frame_readable`: a capa

**O que mede.** Se no quadro 0 há pelo menos uma caixa `text` com `size` igual ou maior que o mínimo (`min_text`). O primeiro quadro é a capa do carrossel e a miniatura do vídeo: precisa ser lido parado.

**Veredito.** `fail` quando o quadro 0 não tem texto ou quando o maior texto dele fica abaixo do mínimo. `skip` sem a página ou sem `window.boxes(t)`.

**Como resolver.** Deixe o título já no lugar e no tamanho final em `t = 0`, com pelo menos o mínimo: uma entrada animada que começa no quadro 0 deixa a capa vazia. O que entra depois é enfeite que a capa dispensa.

### `safe_area`: a área segura

**O que mede.** Em cada instante lido (a cada `--every` segundos, em cada batida e no último quadro), se toda caixa `text`, `logo` ou `face` de `window.boxes(t)` fica dentro de `safe.rect` e fora dos cantos reservados. Caixas `ui` não entram; 1 px de folga.

**Veredito.** `fail` lista as piores caixas em `details`: o papel e o texto, de quando a quando aparecem fora (`time`, `until`, `instants`), as bordas que passam com quantos pixels (`edges`, `overflow`) e os cantos que tocam (`corners`: `counter` é o contador "1/N", `sound` é o botão de som). `skip` com `--safe none`, sem a página ou sem `window.boxes(t)`.

**Como resolver.** Posicione texto, logo e rosto dentro de `safe.rect` e, no carrossel, longe dos dois cantos. Numa página de canvas, declare caixas do tamanho real do que foi desenhado (a largura medida do texto, não a tela inteira); numa página DOM, marque os elementos com `data-role` e devolva `Motion.domBoxes()`. Fundo e formas decorativas podem sangrar.

### `text_size`: o tamanho do texto

**O que mede.** O menor `size` entre as caixas `text`, em todos os instantes lidos.

**Veredito.** `pass` a partir do mínimo; `warn` entre 0,6 vez o mínimo e o mínimo; `fail` abaixo de 0,6 vez o mínimo (26,4 px quando o mínimo é 44). `details` lista os textos pequenos, do menor para o maior. `skip` quando as caixas de texto não trazem `size`.

**Como resolver.** Aumente a fonte ou mostre menos texto por vez: `Motion.fitText` encontra o maior tamanho que cabe e `Motion.wrapText` quebra em linhas. Duas linhas curtas leem melhor que uma longa.

### `cuts_on_beat`: os cortes na batida

**O que mede.** Cada corte contra a batida mais próxima. Os cortes vêm da página (`film.cuts`, exatos) quando ela é dada; sem ela, o Motor os acha no vídeo pela mudança de cena. As batidas vêm de `--beats` ou `--bpm`.

**Veredito.** Cortes da página: todos a até 1 quadro de uma batida. Cortes achados no vídeo, que são aproximados: pelo menos 70% a até 2 quadros. `--tolerance` e `--min-on-beat` mudam os dois. `fail` lista em `details` cada corte fora (`cut`), a batida mais próxima (`nearest`) e a diferença (`delta`). `skip` sem cortes ou sem batidas.

**Como resolver.** Declare os cortes a partir da grade: `const grid = Motion.beatGrid(bpm, offset)` e `film.cuts = [grid.beat(4), grid.beat(8)]`, arredondando ao quadro com `Motion.toFrame(t, fps)`, e troque de cena nesses mesmos instantes. Um corte fora da batida por escolha (uma fala, uma pausa) pede `--min-on-beat` menor que 1, e o integrante fica sabendo.

### `loop_seamless`: a emenda do loop (com `--loop`)

**O que mede.** A semelhança (SSIM) entre o quadro de `t = 0` e o último quadro (`t = duração − 1/fps`): fotografados na página quando ela existe, tirados do vídeo quando não.

**Veredito.** `pass` a partir de 0,985; `warn` de 0,95 a 0,985 (quase igual, pode saltar); `fail` abaixo de 0,95. `skip` sem `--loop` ou sem o ffmpeg.

**Como resolver.** Faça o último quadro preparar o primeiro: `Motion.loopT(t, duração)`, toda mola assentada antes do fim e cada elemento de volta à posição de `t = 0`. A trilha também precisa fechar.

### `flashes`: as piscadas (com o vídeo)

**O que mede.** As mudanças bruscas de luz: a diferença média de luminância entre um quadro e o seguinte acima de 40 (numa escala de 0 a 255), contadas em qualquer janela de 1 segundo.

**Veredito.** Mais de 3 numa janela de 1 s avisa (`warn`; `--max-flashes` muda o limite). `details` traz cada janela (`at`, `count`). Mais de três piscadas por segundo causam desconforto e, em algumas pessoas, crises.

**Como resolver.** Sem estrobo: transições pela cor, não pelo branco; um clarão de um quadro vira um fade de quatro; menos alternâncias entre cenas de brilho oposto.

### `dead_time`: o tempo parado (com o vídeo)

**O que mede.** Os trechos de quadros seguidos em que nada muda. Com `--still-by regions` (o padrão), um quadro está parado quando a diferença média do quadro inteiro fica abaixo de 0,5 e nenhuma região dele (um bloco de 1/32 da largura) muda mais que 6 em 255: um texto sendo digitado ou um zoom lento num título mexem pouco no quadro inteiro e muito num pedaço dele, e isso é movimento. Com `--still-by mean`, conta só a diferença média: um enfeite pequeno que se mexe o tempo todo (uma seta, um marcador, um brilho) não segura o trecho, e só uma mudança grande o tira do parado. Use `mean` quando a regra da peça é uma mudança grande a cada poucos tempos, como num slide de carrossel.

**Veredito.** Um trecho de 1,5 s ou mais avisa (`warn`; `--max-still` muda o limite). `details` traz cada trecho (`from`, `to`, `seconds`). Dois segundos parados num vídeo vertical e o dedo rola para o próximo.

**Como resolver.** Dê vida ao trecho: uma deriva lenta de fundo (`Motion.noise1d`), um pulso na batida, um elemento que entra. O movimento precisa mudar pixels de verdade: um texto parado sobre fundo liso mede zero, por mais bonito que seja. Com `mean`, o que resolve é um elemento grande que sai e volta (um título, um cartão, um bloco de texto).

### `loudness`: o volume (com o vídeo, quando ele tem áudio)

**O que mede.** O volume integrado (LUFS) e o pico real (dBTP) do áudio, no padrão que as redes e os players usam para igualar o volume de todos os vídeos.

**Veredito.** `pass` com −14 LUFS e 1,5 LU de folga para cada lado (`--lufs` muda o alvo) e pico real até −1 dBTP. `fail` com o volume fora da faixa ou o pico acima de 0 dBTP, quando o som distorce. `warn` com o volume certo e o pico entre −1 e 0 dBTP, quase sempre o que o codificador do áudio devolve de um pico que a mixagem tinha tirado. `skip` sem vídeo, sem áudio ou com áudio em silêncio. `details` traz as medidas.

**Como resolver.** Mixe de novo com o alvo certo (`mix … --lufs -14`); no aviso de pico, com um pico mais baixo (`--peak -1.5`). Subir o ganho não basta: o pico também precisa caber.

### `format_supported`: o formato, por rede

**O que mede.** Se cada rede de destino aceita o formato da peça e se é o formato que rende mais nela.

**Veredito.** `fail` quando a rede não aceita o formato (um 9:16 no YouTube); `warn` quando aceita mas recomenda outro (um 9:16 no X) ou quando o tamanho não tem nome. Um item por rede, com `network`.

**Como resolver.** Renderize a mesma página no formato da rede (`render pagina.html --format 16:9`); a página precisa de `window.setFormat`, que recompõe o layout em vez de cortar.

### `duration`: a duração, por rede

**O que mede.** A duração da peça (a do vídeo quando há vídeo; senão `film.duration`) contra o mínimo, o máximo e o recomendado de cada rede.

**Veredito.** `fail` abaixo do mínimo ou acima do máximo; `warn` acima do recomendado, porque a rede mostra a peça para menos gente. Um item por rede, com `network`.

**Como resolver.** Encurte o filme (`film.duration` e as cenas) ou renderize só um trecho (`--start`, `--end`); abaixo do mínimo, alongue o fecho ou acrescente uma cena. O começo precisa valer sozinho.

## A área segura

| `--safe` | O retângulo | Padrão quando |
|---|---|---|
| `instagram-carousel` | 72 px de margem nos quatro lados e dois cantos que nenhuma caixa pode tocar: o superior direito, de 170×80 (o contador "1/N" que o Instagram desenha por cima), e o inferior direito, de 100×100 (o botão de som). Tudo a 1080 px de largura, proporcional à largura | 4:5 e 3:4 sem redes de destino: o carrossel |
| `instagram-feed` | os recuos do próprio formato na tabela das redes, os mesmos de `Motion.safeArea(formato)`: 9:16 com 250 px em cima, 500 embaixo, 70 à esquerda e 180 à direita; 4:5 e 3:4 com 120, 200, 72 e 72; 1:1 com 80, 120, 60 e 60; 16:9 com 80, 150, 100 e 100 | os outros formatos sem redes de destino |
| `networks` | o maior recuo de cada lado entre as redes de destino, no formato da peça: uma peça aprovada para `reels,tiktok,shorts` cabe nas três. Uma rede sem zona para o formato usa a do próprio formato | quando há redes de destino |
| `margin` | uma margem uniforme de `--margin` px | quando a peça vai para um lugar sem interface por cima |
| `none` | nenhuma: `safe_area` fica como `skip` | nunca |

Os recuos valem no tamanho de referência do formato e o Motor os escala para o quadro conferido; um tamanho sem nome usa o formato de proporção mais próxima. Um `--safe` explícito sempre vale.

## As redes

O comando `networks` devolve a tabela que as conferências usam, com a data em que ela foi conferida (`checked_on`), as notas, os formatos (tamanho e zona segura), as redes habituais de cada formato (`defaults_by_format`) e cada rede com `id`, `label`, `aliases`, formatos, durações (`min_duration_s`, `max_duration_s`, `recommended_duration_s`), `safe_zone`, legendas, volume, `max_file_mb` e notas. A tabela é o arquivo `references/redes.json` deste app; o resumo abaixo é só para orientar, e quando os dois divergem vale a tabela.

```
node .flyee/modules/video-render/scripts/render.mjs networks --json
```

| Rede | Formatos (melhor) | Duração mínima e máxima | Recomendada | A interface cobre (vertical) |
|---|---|---|---|---|
| `reels` Instagram Reels | 9:16 | 3 s a 3 min | até 90 s | 250 px em cima, 420 embaixo, 180 à direita |
| `stories` Instagram Stories | 9:16 | 1 s a 60 s por story | até 15 s | 250 em cima, 340 embaixo |
| `feed` Instagram feed | 4:5 (1:1, 16:9) | 3 s a 15 min | até 60 s | pouco; os recuos são respiro |
| `tiktok` TikTok | 9:16 | 3 s a 10 min | até 60 s (de 21 a 34 s rendem mais) | 160 em cima, 400 embaixo, 160 à direita |
| `shorts` YouTube Shorts | 9:16 (1:1) | 1 s a 3 min | até 60 s | 230 em cima, 500 embaixo, 170 à direita |
| `youtube` YouTube | 16:9 | 1 s a 12 h | sem recomendação | controles embaixo (150), título em cima (80) |
| `linkedin` LinkedIn | 9:16 (4:5, 1:1, 16:9) | 3 s a 10 min | até 90 s | 200 em cima, 400 embaixo, 150 à direita |
| `x` X | 16:9 (1:1, 9:16) | 0,5 s a 2 min 20 s | até 60 s | 180 em cima, 380 embaixo, 150 à direita |
| `whatsapp_status` Status do WhatsApp | 9:16 | 1 s a 60 s | até 30 s | 200 em cima, 300 embaixo |
| `kwai` Kwai | 9:16 | 3 s a 60 s | até 30 s | como o TikTok |
| `ads_meta` Anúncios Meta | 9:16 | 1 s a 60 s | até 15 s | 270 em cima, 672 embaixo, 140 à direita |
| `ads_tiktok` Anúncios TikTok | 9:16 | 5 s a 60 s | 21 a 34 s | 150 em cima, 480 embaixo, 140 à direita |

Em `--networks`, use os `id` ou os apelidos da tabela (`instagram`, `twitter`, `whatsapp`…), separados por vírgula. Uma rede desconhecida volta como erro `unknown_network`, com a lista das conhecidas. Quando o arquivo passa do limite de upload de uma rede, `warnings` avisa.

## Erros

Em erro, `ok` é `false` e `error` traz `code`, `message` e `fix`. Os do aceite:

| `code` | O que fazer |
|---|---|
| `usage` | uma opção errada, dois arquivos do mesmo tipo (`accept pagina.html --page …`) ou um primeiro argumento que não é `.html` nem vídeo: corrija o pedido |
| `file_not_found`, `invalid_json` | a página, o vídeo ou o `beats.json` não existe ou não é válido: confira o caminho |
| `unknown_network` | a rede não está na tabela: `networks` lista as conhecidas e os apelidos |
| `no_video_stream`, `unreadable_media` | o arquivo não tem imagem ou não é mídia legível: passe o vídeo renderizado |
| `tools_missing`, `browser_missing` | falta o ffmpeg ou o navegador: o `fix` traz o passo, e depois a conferência se repete |
| `networks_table_invalid` | a tabela das redes do app está corrompida: repasse `message` e `fix` ao integrante |

## Um fluxo que funciona

1. Faça a prévia e olhe a folha de contato.
2. Confira a página: `accept pagina.html` com as batidas e, quando o destino já é conhecido, com `--networks`.
3. Para cada `fail`, aplique o `fix` na página; para cada `warn`, decida com o integrante.
4. Renderize o final, mixe o som e confira de novo com o vídeo final (`accept final.mp4 --page pagina.html`): o relatório vai junto com o vídeo, como prova do que foi conferido.
