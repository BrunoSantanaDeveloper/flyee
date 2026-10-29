# Motor de vídeo para outros apps

Este guia é para a IA que executa outro app do flyee.club e precisa transformar uma página animada em vídeo, gerar trilha e efeitos, mixar o som, medir as batidas de uma música, capturar o site de uma marca ou conferir uma peça antes de publicar. Use o Motor em vez de chamar o ffmpeg ou o navegador por conta própria: ele garante o mesmo quadro para o mesmo instante, devolve o que mediu e falha com códigos estáveis.

Versão da interface: **1**. Os comandos partem da raiz do projeto (a pasta que contém `.flyee/`) e todos aceitam `--json`: só o JSON vai para o stdout; o progresso vai para o stderr.

```
node .flyee/modules/video-render/scripts/render.mjs <comando> [opções] --json
```

- Toda resposta de sucesso traz `ok`, `command`, `interface_version` e `app` (`name`, `version`); os demais campos são do comando. Uma resposta de erro traz `ok: false`, `command` e `error` (seção 8). Ignore um campo que você não conhece.
- A saída termina com código 0 quando `ok` é `true`, 1 em erro e 2 em erro de uso (`usage`).
- Opções vêm como `--opção valor` ou `--opção=valor`; uma opção que o Motor não conhece é erro `usage`.
- Um arquivo de entrada é procurado a partir da pasta atual e, se não estiver ali, a partir da raiz do projeto; `--out` vale a partir da pasta atual, por isso rode sempre da raiz. Os caminhos voltam relativos à raiz quando o arquivo está dentro dela, absolutos quando não está.
- Tempos aceitam `90`, `90.5`, `1,5`, `1:30`, `01:02:03`, `1m30s` ou `2h` e voltam em segundos.
- Grave tudo na pasta do seu app, fora de `.flyee/`: a pasta do Motor é trocada a cada atualização.

A ajuda da versão instalada, com todas as opções, vem em `text` (a resposta do `help` traz só `ok`, `command` e `text`); procure nela uma opção antes de depender de algo que uma versão mais antiga talvez não tenha:

```
node .flyee/modules/video-render/scripts/render.mjs help --json
```

## 1. O app está instalado? O que a máquina tem?

Se `.flyee/modules/video-render/scripts/render.mjs` não existir, o render vem do app Motor de vídeo, e você mesmo o instala: diga ao integrante numa frase simples qual app vai instalar e o que ele faz ("Vou instalar o app Motor de vídeo, que transforma a página em vídeo pronto para as redes") e rode `npx --yes flyee@latest add video-render --yes --json`, com tempo limite de 10 minutos, sem esperar resposta. Não liste permissões, arquivos nem programas. Se a instalação falhar, ou se o integrante pedir para não instalar, siga o seu app sem renderizar (entregue a página e diga o que o Motor faria com ela).

Se existir, rode uma vez por sessão:

```
node .flyee/modules/video-render/scripts/render.mjs check --json
```

| Campo | O que diz |
|---|---|
| `interface_version`, `app` | a versão desta interface (1) e o `name` e a `version` do Motor instalado |
| `project`, `node`, `cores` | a raiz do projeto (caminho absoluto), a versão do Node e os núcleos da máquina |
| `tools.ffmpeg`, `tools.ffprobe` | a versão encontrada, ou `null` |
| `tools.browser` | `{ name, path }` do navegador que o Motor abre sem janela (`msedge`, `chrome`, `chromium`, `brave` ou `custom`), ou `null` |
| `tools.drawtext` | o ffmpeg consegue carimbar o tempo nas folhas do `sheet` |
| `tools.encoders` | o codificador de cada extensão: `h264` (.mp4), `prores` (.mov, com transparência), `vp9` (.webm) |
| `modes.render`, `modes.alpha` | ffmpeg e navegador presentes: dá para renderizar, inclusive a camada transparente |
| `modes.sheets` | o ffmpeg está presente: `sheet`, `probe`, `mix` e `loudness` funcionam, mesmo sem navegador |
| `formats` | os formatos com nome e o tamanho de cada um: `9:16` 1080x1920, `1:1` 1080x1080, `16:9` 1920x1080, `4:5` 1080x1350, `3:4` 1080x1440 |
| `install` | um comando por programa que falta: `ffmpeg` e, no Mac e no Linux, `browser`; vazio quando nada falta |
| `install_note` | como rodar a instalação e o que fazer com `needs_member`, ou `null` |
| `runtime` | o caminho do `motion.js`, a biblioteca que a página inclui |
| `guides.page`, `guides.interface` | o contrato da página (`pagina.md`) e este guia |

**Instalar o que falta.** O integrante não usa o terminal: você mesmo roda cada comando de `install` (`npx --yes flyee@latest need ffmpeg --yes --json`; no Mac e no Linux, também o `npx --yes flyee@latest need chromium … --yes --json` do navegador), depois de avisar o integrante numa frase, com tempo limite longo (até 10 minutos), e repete o `check`. Quando o resultado da instalação trouxer `needs_member`, mostre a ele só o passo único indicado (a senha de administrador, o Homebrew ausente) e espere. No Windows o navegador é o Microsoft Edge, que vem com o sistema: `tools.browser` nulo ali pede que você confira com o integrante se o Edge está instalado. Nunca mostre ao integrante um comando para ele digitar.

| Funciona com | Comandos |
|---|---|
| só o Node | `scaffold`, `synth`, `music`, `sfx`, `beats` de um `.wav`, `networks`, `open`, `help` |
| o ffmpeg | `sheet`, `probe`, `mix`, `loudness`, `beats` de outros formatos e a medição de volume do `synth` |
| o ffmpeg e o navegador | `render`, `preview`, `frames` |
| o navegador | `capture` (sem o ffmpeg, sem as gravações de rolagem) e `accept` com a página primeiro (sem o ffmpeg, sem as medições do vídeo e do loop) |
| o ffmpeg, mais o navegador com `--page` | `accept` com o vídeo primeiro |

## 2. A página

O Motor não anima nada sozinho: ele abre uma página HTML num navegador sem janela, pede o quadro de cada instante e junta os quadros. O contrato completo está em `.flyee/modules/video-render/references/pagina.md`, o método de animação em `.flyee/modules/video-render/references/motion.md` e a biblioteca da página em `.flyee/modules/video-render/runtime/motion.js` (molas de forma fechada, trilhas de vários alvos, grade de batidas, ruído com semente, texto que cabe, zonas seguras, vídeo buscado por quadro). Em resumo:

- `window.film = { duration, width, height, fps, background, cuts }` declara o filme; `Motion.setup({...})` faz isso e, fora do render, liga uma prévia ao vivo. `cuts` são os instantes dos cortes, em segundos, que o `accept` confere contra as batidas.
- `window.seek(t)` desenha o quadro do segundo `t` e termina; pode devolver uma promessa, que o Motor espera por até 30 s. O mesmo `t` dá sempre o mesmo quadro: sem temporizadores, sem `requestAnimationFrame`, sem transições nem animações de CSS, sem `Math.random`, sem estado guardado entre quadros.
- `window.setFormat({ name, width, height })` recompõe o layout em outro tamanho. O Motor a chama sempre que recebe `--format`, mesmo quando o tamanho pedido é o da própria página: sem ela, qualquer `--format` dá `format_unsupported` (no `accept`, um `fail` no item `page`). Sem `--format`, a página sai no tamanho dela.
- `window.boxes(t)`, opcional, devolve `[{ role, x, y, w, h, size, text }]` em pixels do quadro, com `role` em `text`, `logo`, `face` ou `ui`, `size` (o corpo da fonte, em px) e `text` (opcional). É com elas que o `accept` confere a capa, a área segura e o tamanho do texto. Numa página DOM, `Motion.domBoxes()` monta a lista a partir dos elementos com `data-role`.
- Durante o render, `window.__FLYEE_RENDER__` é `true`. Fontes locais (`@font-face`) são esperadas antes do primeiro quadro.

O seu app escreve a página na própria pasta, com o `motion.js` ao lado (copie-o do caminho `runtime` do `check`). Para começar de uma página que já segue o contrato:

```
node .flyee/modules/video-render/scripts/render.mjs scaffold <pasta> --format 9:16 --duration 15 --name "Título" --json
```

| Opção | Para quê |
|---|---|
| `--format 9:16\|4:5\|3:4\|1:1\|16:9\|LARGURAxALTURA` | o tamanho do canvas (padrão `9:16`) |
| `--duration <s>` | a duração declarada, de 1 a 600 s (padrão 6) |
| `--name "…"` | o título do filme (padrão "Página inicial") |
| `--force` | sobrescreve a `pagina.html` e o `motion.js` que já existam na pasta; sem ela, erro `exists` |

Devolve `dir`, `page` (`<pasta>/pagina.html`), `runtime` (`<pasta>/motion.js`), `format`, `duration`, `next` (a linha de comando da prévia) e `guide` (o caminho de `pagina.md`). A página de exemplo tem três cenas de 2 s, cortes em 2 e 4 s (a grade de 120 BPM), `window.setFormat` e `window.boxes`; com outra `--duration`, escreva as cenas que faltam.

## 3. Renderizar e olhar

### `render` e `preview`

```
node .flyee/modules/video-render/scripts/render.mjs render <pagina.html> --out <video.mp4> --json
node .flyee/modules/video-render/scripts/render.mjs preview <pagina.html> --out <previa.mp4> --json
```

`preview` é o mesmo render com `--scale 0.5`, quadros JPEG, `--crf 23` e sem subquadros, para conferir rápido. Sem `--out`, o vídeo fica ao lado da página: `previa.mp4` (prévia) ou `<nome da página>.mp4` (render); um arquivo com o mesmo nome é substituído.

| Opção | Para quê |
|---|---|
| `--out <arquivo>` | `.mp4` ou `.m4v` (H.264), `.mov` (ProRes 4444) ou `.webm` (VP9); outra extensão dá `output_format` |
| `--fps <n>` | quadros por segundo, de 1 a 120 (padrão: o `film.fps` da página, senão 30) |
| `--sub <n>` | subquadros misturados em desfoque de movimento, de 1 a 8 (padrão 1; use 2 ou 4, que multiplicam o tempo do render; a prévia ignora) |
| `--format 9:16\|4:5\|3:4\|1:1\|16:9\|LARGURAxALTURA` | outro tamanho de quadro, pela `window.setFormat` da página |
| `--scale <0.1 a 1>` | fração do tamanho em pixels, com o mesmo layout (padrão 1; a prévia usa 0.5) |
| `--start <t>`, `--end <t>` | só um trecho; quando a página não declara `film.duration`, `--end` é a duração |
| `--alpha` | camada transparente: a página sem fundo e `--out` `.mov` ou `.webm` (com `.mp4`, `alpha_needs_mov`) |
| `--frame-format png\|jpeg` | como cada quadro é fotografado (padrão png; a prévia usa jpeg, menos com `--alpha`) |
| `--quality <30 a 100>` | a qualidade dos quadros JPEG (padrão 92) |
| `--crf <0 a 51>` | a qualidade do vídeo, menor é melhor (padrão 16; a prévia 23; no `.webm` vale `crf + 14`; o `.mov` não usa) |
| `--parallel <1 a 8>` | navegadores em paralelo (padrão: um até 120 quadros ou com menos de 4 núcleos; senão até 4) |
| `--audio <arquivo>` | junta este áudio ao vídeo como ele está, cortado no fim do vídeo, sem mixar nem ajustar o volume (para isso, `mix`) |
| `--browser <caminho>` | outro navegador (Edge, Chrome ou Chromium) |

| Campo | O que é |
|---|---|
| `page`, `file` | a página e o vídeo gravado |
| `width`, `height` | o tamanho em pixels do vídeo, já com `--scale` |
| `fps`, `subframes`, `frames` | a taxa, os subquadros por quadro e o total de quadros |
| `duration`, `start`, `end` | a duração renderizada e o trecho, em segundos |
| `format` | o valor de `--format`; sem ele, o tamanho da própria página, como `1080x1920` |
| `alpha`, `audio` | se a saída tem transparência; o áudio juntado, ou `null` |
| `size_bytes`, `workers`, `elapsed_s` | o tamanho do arquivo, os navegadores usados e o tempo gasto |
| `frames_hash` | a assinatura dos quadros: igual quer dizer vídeo igual, quadro a quadro; diferente, algo na página ou nas opções mudou |
| `film` | o que a página declarou ao abrir (antes de `setFormat`): `duration`, `width`, `height`, `fps`, `background`, `formats`, `cuts`, `title`, `has_seek`, `has_set_format`, `has_boxes` |
| `warnings` | erros de JavaScript e avisos de console da página durante o render, e o aviso de tamanho reduzido; repasse ao seu app, porque uma página com erro pode ter quadros vazios |

### `frames`: quadros de instantes escolhidos

```
node .flyee/modules/video-render/scripts/render.mjs frames <pagina.html> --times 0,0.5,2 --json
node .flyee/modules/video-render/scripts/render.mjs frames <pagina.html> --beats <beats.json> --downbeats --json
```

Fotografa a página nos instantes pedidos (até 400) e monta uma folha de contato. Os instantes: `--times` (uma lista), `--every <s>` (de 0,05 a 60; padrão 0,5, até `film.duration`, ou 15 s quando a página não a declara) ou `--beats <beats.json>` (um por batida da lista `beats` do arquivo, até a duração do filme; com `--downbeats`, só o tempo 1 de cada compasso). `--out <pasta>` (padrão `quadros/` ao lado da página; os `quadro-NNNN.png` antigos dessa pasta são apagados), `--sheet <png>` (padrão `folha.png` na pasta), `--cols <1 a 12>` (padrão 6) e `--tile-width <80 a 1080>` (padrão 270); `--format`, `--scale` (padrão 1), `--alpha` e `--browser` como no render.

Devolve `page`, `dir`, `width` e `height` (de cada quadro), `frames[]` com `time`, `label` (`MM:SS`) e `file` (`quadro-0001.png`…), `sheet`, `sheet_cols` e `warnings` (erros da página). A folha do `frames` não carimba o tempo: a ordem dos quadrinhos é a de `frames[]`. Abra a folha antes de dizer qualquer coisa sobre o vídeo.

### `sheet`: a folha de um vídeo pronto

```
node .flyee/modules/video-render/scripts/render.mjs sheet <video> --phone --strip 2.5 --json
```

`--out <png>` (padrão `<vídeo>-folha.png`, ao lado do vídeo), `--fps <0.1 a 30>` (quadros por segundo de vídeo na folha; padrão 2), `--cols <1 a 12>` (padrão 6), `--tile-width <80 a 1080>` (padrão 270). `--strip <tempo>` acrescenta uma tira de 12 quadros seguidos em volta do instante, para ver uma transição (`<folha>-tira-<tempo>.png`, com `_` no lugar do ponto); `--phone` acrescenta o teste de celular, um quadro por segundo a 360 px de largura (`<folha>-celular.png`).

Devolve `video`, `duration`, `sheet`, `sheet_layout` (`cols`, `rows`, `fps`, `tile_width`, `stamped`: o tempo está carimbado em cada quadrinho), `strip` (`file`, `start`, `count`) ou `null` e `phone` (`file`, `cols`, `rows`, `width`) ou `null`.

### `probe`: o que há num arquivo de mídia

```
node .flyee/modules/video-render/scripts/render.mjs probe <arquivo> --json
```

Devolve `file`, `duration`, `size` (bytes), `width`, `height`, `fps`, `frames`, `video_codec`, `pixel_format`, `has_alpha`, `audio_codec`, `audio_channels`, `audio_rate` e `has_audio`; os campos de imagem são `null` num arquivo só de áudio. Use para confirmar o que você entregou (`has_alpha` numa camada transparente, `has_audio` depois do `mix`).

### `open`: mostrar ao integrante

```
node .flyee/modules/video-render/scripts/render.mjs open <arquivo> --json
```

Abre o arquivo no player ou visualizador padrão do computador do integrante, sem esperar, e devolve `file`.

## 4. Som

Duas trilhas existem de propósito. Escolha pela forma do vídeo:

| | `music` | `synth` |
|---|---|---|
| Para | um vídeo que se assiste uma vez, do começo ao fim: um Reels de 15 a 20 s, um anúncio, um lançamento | um loop, e os slides de um carrossel, em que cada slide toca uma fatia de compassos inteiros da mesma trilha |
| Forma | um arco: introdução, crescimento, ponto alto (`drop`) e uma pancada final no último tempo 1, com uma cauda curta até o fim; `--arc flat` faz uma cama constante; `--loop` fecha no começo | compassos inteiros que repetem sem clique; `--intro-bars` deixa os primeiros sem bateria |
| Duração | livre, de 1 a 600 s (`--duration`) | exatamente `bars × beats-per-bar × 60 / bpm` |
| Estilos | `clean`, `energetic`, `warm`, `minimal`, `cinematic`, `playful` | `clean`, `noir`, `upbeat`, `lofi`, `pulse` |
| Grade | `beats.json` com `sections`, `drop` e `hits` | `beats.json` com `bars` e `beats_per_bar` |

Nenhuma das duas usa música de terceiros: tudo é gerado em código, e a mesma semente dá a mesma trilha em qualquer máquina.

### `synth`: uma trilha em loop, em compassos inteiros

```
node .flyee/modules/video-render/scripts/render.mjs synth --out <trilha.wav> --bpm 120 --bars 8 --style noir --seed 7 --json
```

Sintetiza `bars` compassos exatos e grava ao lado `<trilha>.beats.json` (seção 7). A batida 0 cai em `t = 0`. O arquivo é um loop perfeito: o que soaria depois do fim volta para o começo, e tocado em repetição não dá clique na emenda. WAV de 48 kHz, estéreo, 16 bits, perto de −16 LUFS com pico real até −1 dBTP.

| Opção | Para quê |
|---|---|
| `--out <wav>` | obrigatório, terminado em `.wav` |
| `--bpm <n>` | obrigatório, de 60 a 200 (a 120 BPM, uma batida a cada 0,5 s e um compasso a cada 2 s) |
| `--bars <n>` | obrigatório, de 1 a 64 |
| `--style clean\|noir\|upbeat\|lofi\|pulse` | o caráter (padrão `clean`) |
| `--seed <n>` | a semente, um inteiro (padrão 1): a mesma semente, os mesmos bytes |
| `--beats-per-bar 3\|4` | tempos por compasso (padrão 4) |
| `--intro-bars <n>` | os primeiros `n` compassos sem a bateria, só com a cama, para um gancho respirar; de 0 a `bars − 1` (padrão 0) |
| `--gain <dB>` | desloca o volume final, de −20 a 20 (padrão 0) |

| Estilo | Como soa | Para quê |
|---|---|---|
| `clean` | bumbo macio no 1 e no 3, palmas no 2 e no 4, chimbal em colcheias, grave sub e um arpejo de corda esparso | produto, demonstração, tutorial |
| `noir` | pad escuro de serras, bumbo no 1, aro no 3, chimbal baixinho, cama de ruído e baixo longo em acordes menores | tensão, mistério, frases fortes |
| `upbeat` | bumbo em todo tempo, chimbal aberto no contratempo, palmas no 2 e no 4, baixo em colcheias e melodia brilhante | lançamento, energia, celebração |
| `lofi` | chimbal com balanço, bumbo e caixa boom-bap, teclas abafadas com vibrato, chiado de vinil, agudos suaves | conversa, bastidores, calma |
| `pulse` | um pulso de serra filtrada por tempo, com respiração de sidechain, pad aéreo e percussão mínima | tecnologia, dados, ritmo de produto |

Devolve `file`, `beats_file`, `bpm`, `bars`, `beats_per_bar`, `beat_s` (segundos por batida), `bar_s` (segundos por compasso), `duration`, `style`, `seed`, `intro_bars`, `sample_rate` (48000), `channels` (2), `lufs` e `true_peak_dbtp` (medidos pelo ffmpeg; `null`, com aviso, sem ele), `beats[]`, `downbeats[]` e `warnings`. Um slide que começa depois de `k` compassos toca a fatia que começa em `k × bar_s` (`mix --music-offset`).

### `music`: uma trilha com arco

```
node .flyee/modules/video-render/scripts/render.mjs music --out <trilha.wav> --duration 15 --bpm 120 --style energetic --seed 3 --json
```

Compõe uma peça para a duração pedida e grava a grade ao lado (`<trilha>.beats.json`, ou onde `--beats-out` disser). Sem `--loop`, a pancada final cai no último tempo 1 que ainda deixa pelo menos 0,5 s antes do fim, e a cauda morre antes de `--duration`. Com mais de 4 compassos, as seções são `intro`, `build`, `drop` e `outro`, mais a cauda (`tail`), e o ponto alto (`drop`) cai perto de 45% dos compassos numa peça curta e de 60% numa longa, com uma subida que termina nele e uma pancada. Com até 4 compassos, há só `build` e `tail`, e o `drop` é a própria pancada final. `--arc flat` troca o arco por uma cama constante (`bed`) com uma pancada final mais leve. `--loop` tira a pancada final e a cauda: os compassos enchem a duração e o último leva de volta ao primeiro (dê uma duração de compassos inteiros, como 8 s a 120 BPM). Sempre 4 tempos por compasso; WAV de 48 kHz, estéreo, com pico em −3 dBFS.

| Opção | Para quê |
|---|---|
| `--out <wav>` | obrigatório, terminado em `.wav` |
| `--duration <s>` | obrigatório, de 1 a 600 s: a duração do filme |
| `--bpm <n>` | de 40 a 220 (padrão 120) |
| `--style clean\|energetic\|warm\|minimal\|cinematic\|playful` | o caráter (padrão `clean`) |
| `--seed <n>` | a semente (padrão 1): a mesma semente, a mesma música |
| `--key <tom>` | `C`, `Am`, `F#m`, `Bb`, `Ebm`… ou `auto` (padrão: o tom sai da semente) |
| `--arc auto\|flat` | com arco (padrão) ou cama constante |
| `--loop` | o fim leva ao começo, para vídeos em repetição |
| `--beats-out <json>` | onde gravar a grade (padrão `<trilha>.beats.json`) |

| Estilo | Como soa |
|---|---|
| `clean` | filme de interface: bumbo macio, chimbal, grave sub, pad quente e arpejos de corda |
| `energetic` | showreel: bumbo em todo tempo, palmas no 2 e no 4, baixo puxado e acordes de sintetizador |
| `warm` | lo-fi: bateria leve com balanço, acordes macios de piano elétrico e um chiado gentil |
| `minimal` | muito esparso: um pulso, um pad e poucas notas, com bastante ar |
| `cinematic` | trailer: ondas lentas, subida de tensão, pancada grave na virada, sem batida dançante |
| `playful` | leve e saltitante: baixo pulado, melodia de corda brilhante e percussão miúda |

Devolve `file`, `beats_file`, `bpm`, `duration`, `style`, `seed`, `key` (o tom usado, como `Am`), `arc`, `loop`, `progression` (os graus dos acordes, como `vi-IV-I-V`), `sections[]` (`name`, `start`, `end`), `drop` (o instante do ponto alto, ou `null`), `hits[]` (o `drop` e a pancada final), `beat_count`, `peak_dbfs` e `warnings`. Ponha a maior mudança do filme no `drop` e o soco final na última posição de `hits`.

### `sfx`: efeitos nos instantes certos

O `sfx` aceita duas listas, com campos e tipos diferentes; use uma ou outra numa chamada. Nas duas, cada som **começa** no seu `t`: um `riser` cresce de `t` até `t` mais a duração dele, então, para terminar num drop em `T`, ponha o `riser` em `T` menos a duração (com o padrão de 1 s, `T − 1`).

**Lista de deixas** (`cues`): um arquivo como argumento, ou `--cues` em linha.

```
node .flyee/modules/video-render/scripts/render.mjs sfx <deixas.json> --out <efeitos.wav> --duration 15 --json
node .flyee/modules/video-render/scripts/render.mjs sfx --cues "0.5:click,1.2:whoosh" --out <efeitos.wav> --json
```

`deixas.json` é uma lista (ou um objeto com a chave `cues`): `[{ "t": 0.5, "type": "click", "gain": -3, "pitch": 0, "pan": 0 }]`. Em linha, `--cues` leva `segundos:tipo` separados por vírgula.

| Campo | Valor |
|---|---|
| `t` | obrigatório: o instante, em segundos |
| `type` | obrigatório: `click`, `tick`, `pop`, `whoosh`, `swoosh`, `thump`, `impact`, `ding`, `riser`, `typing`, `success` ou `notify` |
| `gain` | dB, de −60 a 12 (padrão 0) |
| `pitch` | semitons, de −24 a 24 (padrão 0) |
| `pan` | de −1 (esquerda) a 1 (direita); no `whoosh` e no `swoosh`, o som atravessa de `−pan` até `pan` |
| `duration` | de 0,05 a 30 s: quanto duram o `riser` (padrão 1 s), o `typing` (padrão 0,08 s por tecla), o `whoosh` (0,32 s) e o `swoosh` (0,2 s) |
| `count`, `text` | só no `typing`: quantas teclas (1 a 400), ou o tamanho de `text` |

| `type` | O som |
|---|---|
| `click` | clique de interface, seco e curto (cerca de 50 ms) |
| `tick` | tique leve, mais fino que o clique |
| `pop` | estouro de bolha, redondo e curto |
| `whoosh` | varredura de ar; o `pan` dá a direção |
| `swoosh` | varredura mais leve e rápida que o `whoosh` |
| `thump` | batida grave e seca |
| `impact` | impacto grande, com grave e ruído |
| `ding` | sino curto e claro |
| `riser` | subida de tensão, ruído e tom subindo ao longo de `duration` |
| `typing` | rajada de teclas suaves ao longo de `duration` |
| `success` | duas notas de sino em acorde maior |
| `notify` | um toque suave de aviso |

`--duration <s>` fixa o tamanho do arquivo e corta o que passar dele; sem ela, o arquivo termina 0,3 s depois do fim do último som. Uma lista inválida dá `cues_invalid`. Devolve `file`, `cues[]` (cada deixa como foi usada: `t`, `type`, `gain`, `pitch`, `pan`, `duration`, `count`), `types[]` (todos os tipos desta lista), `duration` e `peak_dbfs` (medido antes do limitador suave aplicado ao gravar; pode passar um pouco de 0).

**Lista de eventos** (`events`): um arquivo em `--events`, ou `--event` em linha.

```
node .flyee/modules/video-render/scripts/render.mjs sfx --out <efeitos.wav> --events <eventos.json> --json
node .flyee/modules/video-render/scripts/render.mjs sfx --out <efeitos.wav> --event whoosh@0.5,impact@2 --duration 6 --json
```

`eventos.json` é `{ "duration": 6, "events": [{ "t": 0.5, "type": "whoosh", "gain_db": -6, "pan": -0.3, "length": 0.35, "pitch": 1, "direction": "in" }] }` (uma lista solta, ou a chave `cues`, também valem). Em linha, `--event` leva `tipo@segundos` separados por vírgula.

| Campo | Valor |
|---|---|
| `t` | obrigatório: o instante, em segundos |
| `type` | obrigatório: um dos tipos abaixo (`swoosh` vale como `swish`) |
| `gain_db` (ou `gain`) | dB sobre o nível próprio do tipo, de −40 a 12 (padrão 0) |
| `pan` | de −1 a 1 (padrão 0) |
| `length` | a duração do som, de 0,001 a 30 s (padrão: a do tipo) |
| `pitch` | multiplica as frequências, de 0,1 a 8 (padrão 1) |
| `direction` | `in` (padrão: a varredura do `whoosh` e do `swish` sobe) ou `out` (desce) |

| `type` | O som | Duração | Nível |
|---|---|---|---|
| `kick` | queda de tom de 180 a 50 Hz: uma batida marcada | 0,35 s | −4 dB |
| `thump` | mais grave e mais longo que o `kick`: peso sem estrondo | 0,5 s | −4 dB |
| `impact` | bumbo, rajada de ruído e cauda grave: a entrada do título, o soco | 0,9 s | 0 dB |
| `click` | ruído filtrado curtíssimo: um botão, uma troca de estado | 0,004 s | −12 dB |
| `tick` | um clique mais agudo: cada passo de um contador | 0,003 s | −15 dB |
| `pop` | um blip curto com o tom subindo: um selo, um ponto | 0,08 s | −9 dB |
| `whoosh` | varredura de ruído filtrado: algo que atravessa a tela | 0,35 s | −7 dB |
| `swish` | um `whoosh` curto e mais agudo: um cartão que desliza | 0,15 s | −10 dB |
| `riser` | ruído e serra subindo do silêncio: a subida antes de um impacto | 1 s | −7 dB |
| `ding` | sino com harmônicos: uma notificação, um certo | 1,2 s | −9 dB |
| `shutter` | dois cliques e um zumbido: uma foto, uma captura | 0,09 s | −9 dB |
| `pluck` | corda beliscada: uma nota de interface | 0,5 s | −9 dB |
| `blip` | um bipe quadrado: um dado que chega | 0,06 s | −12 dB |

A duração do arquivo é `--duration`, senão a `duration` do arquivo de eventos, senão o fim do último som; eventos a partir dela são descartados com aviso. `--seed <n>` (padrão 1) varia o ruído; o pico fica em até −1 dBFS. Um tipo ou campo inválido dá `usage`, com a lista dos tipos. Devolve `file`, `duration`, `events` (quantos entraram), `types[]` (os tipos usados), `peak_dbfs` e `warnings`.

### `beats`: a grade de uma música

```
node .flyee/modules/video-render/scripts/render.mjs beats <audio-ou-video> --out <beats.json> --json
```

Mede o andamento de qualquer áudio (a música que o integrante trouxe, o som de um vídeo) e grava a grade (seção 7). `--bpm-min` (ou `--min-bpm`) e `--bpm-max` (ou `--max-bpm`), de 30 a 300, limitam a busca (padrão 60 a 200); `--bpm <n>` fixa o andamento (a até 1% dele) e só procura a fase: use-o quando o integrante souber o BPM. Sem `--out`, a grade vai para `<arquivo>.beats.json`, ao lado do áudio. Um `.wav` é lido direto; outros formatos passam pelo ffmpeg. Precisa de pelo menos 1 s de som. Determinístico: o mesmo arquivo dá a mesma grade.

Devolve os campos do arquivo (`format_version`, `source` = `analysis`, `file`, `bpm`, `offset`, `confidence`, `duration`, `beats[]`, `downbeats[]`, `beats_per_bar` = 4, `bars`, `hits[]`, `method`) mais `beats_file`, `beat_count` e `candidates[]` (os andamentos considerados). `downbeats` são uma batida a cada 4, na fase com os acentos mais fortes; `hits` são os acentos que se destacam, bons para o corte principal. Com `confidence` abaixo de 0,5, confirme o BPM com o integrante ou passe `--bpm`; mesmo com confiança alta, uma leitura na metade ou no dobro do andamento acontece (uma trilha com bumbo só no tempo 1 pode sair na metade). Uma trilha do `synth` ou do `music` não precisa deste comando, porque a grade dela já vem exata; medi-la sem `--out` substituiria essa grade.

### `mix`: tudo junto, no volume certo

```
node .flyee/modules/video-render/scripts/render.mjs mix --video <video.mp4> --music <trilha.wav> --music-offset 6 --sfx <efeitos.wav> --fade-out 0 --out <final.mp4> --json
node .flyee/modules/video-render/scripts/render.mjs mix --music <trilha.wav> --voice <voz.wav> --duck 10 --duration 15 --out <mixagem.wav> --json
```

Mistura música, efeitos e voz, leva o resultado ao volume e ao pico pedidos e mede o arquivo gravado. Com `--video` (o vídeo mudo do render), a imagem é copiada como está e o som vai por baixo dela; sem `--video`, a saída é um arquivo de áudio. Pelo menos uma fonte é obrigatória.

| Opção | Para quê |
|---|---|
| `--out <arquivo>` | obrigatório. Com `--video`: `.mp4` ou `.mov` (som AAC) ou `.webm` (Opus), conforme o vídeo; sem: `.wav` (PCM) ou `.m4a` (AAC). Sempre 48 kHz |
| `--video <vídeo>` | o vídeo mudo; a mixagem dura o que ele dura |
| `--music <arquivo>`, `--music-gain <dB>` | a trilha e o ganho dela antes da normalização, de −60 a 24 (padrão 0) |
| `--music-offset <s>` | o instante da trilha em que a mixagem começa (padrão 0): um slide que começa depois de 3 compassos de uma trilha a 120 BPM usa `6` |
| `--sfx <arquivo>`, `--sfx-gain <dB>` | os efeitos e o ganho deles (padrão 0) |
| `--voice <arquivo>`, `--voice-gain <dB>` | a voz e o ganho dela (padrão 0); com voz, a música abaixa sob ela |
| `--duck <dB>` | quanto a música cede à voz, de 0 a 30 (padrão 10) |
| `--lufs <n>` | o volume integrado final, de −30 a −8 (padrão −14, o das redes) |
| `--tp <dBTP>` (ou `--peak`) | o pico real máximo, de −6 a 0 (padrão −1) |
| `--fade-out <s>` | encerra a música suavemente nos últimos segundos, de 0 a 10 (padrão 0, sem fade); num loop, deixe 0 |
| `--duration <s>` | corta as fontes nesse tamanho (padrão: a duração do vídeo, senão a da fonte mais longa) |

Devolve `file`, `duration` (a do arquivo gravado), `loudness` (`integrated_lufs`, `true_peak_dbtp`, `range_lu` e `threshold`, medidos no arquivo gravado), `inputs` (`video`, `music`, `sfx`, `voice`), `sources` (`music`, `music_offset`, `music_gain_db`, `sfx`, `sfx_gain_db`, `voice`, `voice_gain_db`), `settings` (`music_gain`, `sfx_gain`, `voice_gain`, `duck`, `lufs`, `tp`, `music_offset`, `fade_out`) e `warnings` (a música acaba antes do fim quando `music-offset` mais a duração passam do tamanho dela; o pico real limitou o volume abaixo do alvo; o pico do arquivo gravado ficou acima de `--tp`).

### `loudness`: medir um arquivo

```
node .flyee/modules/video-render/scripts/render.mjs loudness <arquivo> --json
```

Devolve `file`, `integrated_lufs`, `true_peak_dbtp`, `range_lu` e `threshold` do áudio do arquivo (EBU R128); num áudio em silêncio, os números vêm `null`. Um arquivo sem áudio dá `no_audio_stream`. A referência das redes é −14 LUFS com pico real até −1 dBTP.

## 5. A marca: `capture`

```
node .flyee/modules/video-render/scripts/render.mjs capture <endereço> --json
```

Abre o site no navegador sem janela em tamanho de computador e de celular, fecha o aviso de cookies quando acha um, fotografa a tela e a página inteira, grava a rolagem, lê a marca na página e guarda tudo numa pasta com `captura.json`. Aceita `https://www.exemplo.com.br`, `exemplo.com.br` (vira https), `localhost:3000` ou `127.0.0.1` (http) e o caminho de um arquivo `.html`. É o único comando do Motor que vai à internet: além de abrir o site, baixa só imagens (o logo, os ícones e a imagem de compartilhamento, até 10 MB cada) e nunca roda nada do site fora do navegador. No render, a internet só entra quando a própria página carrega algo de fora (uma fonte da web, por exemplo).

| Opção | Para quê |
|---|---|
| `--out <pasta>` | onde gravar (padrão `capturas/<site>/` na raiz do projeto, como `capturas/exemplo-com-br/`) |
| `--mobile <px>`, `--desktop <px>` | a largura do celular, de 280 a 1080 (padrão 390), e a do computador, de 800 a 3840 (padrão 1440) |
| `--scroll <s>` | os segundos da rolagem gravada no celular, de 0 a 30 (padrão 6; `0` desliga); o computador grava dois terços disso, pelo menos 2 s |
| `--fps <n>` | quadros por segundo das rolagens, de 5 a 60 (padrão 30) |
| `--no-assets` | não baixa o logo, os ícones nem a imagem de compartilhamento |
| `--browser <caminho>` | outro navegador |

Precisa do navegador; sem o ffmpeg, as rolagens ficam de fora, com aviso. Devolve `url`, `final_url` (depois dos redirecionamentos), `site`, `http_status`, `dir`, `capture_file` (`<dir>/captura.json`), `files` (relativos a `dir`: `desktop`, `desktop_full`, `mobile`, `mobile_full`, `scroll_desktop` e `scroll_mobile` ou `null`, `capture` e `assets[]`), `viewports` (`desktop` e `mobile`: `width`, `height`, `scale`, `full_height`, `content_height`), `scroll` (`desktop` e `mobile`: `frames`, `seconds`, `fps`, `max_scroll`, `width`, `height`, ou `null`), `brand`, `cookie_banner` (o texto do botão fechado, ou `null`), `elapsed_s` e `warnings`.

| `brand` | O que traz |
|---|---|
| `name`, `title`, `headline`, `description` | o nome da marca, o título da página, a frase principal e a descrição, como estão no site |
| `logo` | `file` (em `assets/`, relativo a `dir`), `source` (`dom`, `jsonld`, `og` ou `icon`), `kind`, `width`, `height`, `alternatives[]`; `null` sem logo guardado |
| `colors` | `primary` (a cor de destaque dos botões e links, ou `null`), `background`, `text` e `palette[]` (`hex`, `area`, `share`, `source`: `background` ou `text`) |
| `fonts` | `headline`, `body`, `ui` e `faces[]` (`family`, `weights`, `loaded`, `src`) |
| `cta[]` | os botões principais: `text`, `href`, `background`, `color` |
| `numbers[]`, `prices[]` | os números (`text`, `value`, `unit`, `context`) e os preços (`text`, `value`, `currency`, `product`, `context`) como estão escritos |
| `products[]` | dos dados estruturados do site: `type`, `name`, `description`, `image`, `price`, `currency` |
| `social`, `contacts` | `{ rede: endereço }` (`instagram`, `youtube`, `tiktok`, `linkedin`, `facebook`, `x`, `whatsapp`, `telegram`) e `emails[]`, `phones[]`, `whatsapp[]` |
| `nav[]`, `sector_cues[]`, `language`, `has_login_area` | o menu, as pistas do setor (`sector`, `score`, `keywords`), o idioma (`declared`, `detected`) e se há área de login |
| `word_count`, `jsonld_types`, `address` | quantas palavras, os tipos de dados estruturados e o endereço, quando há |

O `captura.json` traz o mesmo e mais: `format_version` (1), `captured_at`, `cookie_banner` (`desktop` e `mobile`), `wall` (os sinais de bloqueio), `placeholder` (`null`, ou `kind: "coming_soon"` com `label` e `evidence` quando a página parece provisória), `assets[]` (cada download, com `role`, `file`, `saved` e `error`), `page_errors`, `layout` (abaixo) e `raw`, o que foi lido da página: `document` (`title`, `lang`, `description`, `canonical`, `og`), `headings` (`h1`, `h2`), `fonts` (`body`, `h1`, `h2`, `button`, `nav`), `logos[]` (com `in_header`), `cta`, `colors`, `prices`, `links`, `nav`, `layout` e `text_excerpt` (os primeiros 4.000 caracteres do texto).

`layout.mobile` diz onde fica cada título na página inteira de celular, para rolar a imagem `mobile-full.png` até a seção de que uma cena fala. Ele só existe no `captura.json`, não na resposta do comando, e é `null` quando a leitura falhou.

| Campo | O que é |
|---|---|
| `full_height` | a altura da página fotografada, em px CSS (a imagem `mobile-full.png` tem o dobro, porque é feita a 2×) |
| `viewport_height` | a altura da tela do celular, em px CSS |
| `headings[]` | até 60 títulos `h1`, `h2` e `h3` visíveis, de cima para baixo: `tag`, `text` (até 140 caracteres), `y` (px CSS desde o topo da página), `height` e `fraction` (`y / full_height`: 0 é o topo, 1 é o fim da imagem) |

A página fotografada vai até 8.000 px CSS: títulos abaixo disso ficam de fora. Para levar a imagem até um título, use `fraction` vezes a altura da imagem que você desenhar, ou `y × 2` nos pixels de `mobile-full.png`.

Use só o que a captura trouxe. O que ela não encontrou (um logo, uma cor de destaque), peça ao integrante como arquivo, em vez de inventar. Um site que barra o navegador dá `site_blocked` e deixa `bloqueio.png` na pasta: peça as telas ao integrante. Um endereço sem site publicado (domínio estacionado no provedor, página padrão do servidor) dá `site_placeholder` e deixa `sem-site.png`: nada dele é da marca. Uma página provisória ("em breve") é capturada, com aviso e com `placeholder` no `captura.json`: confirme com o integrante que o logo e as cores são dele.

## 6. Conferir: `accept` e `networks`

```
node .flyee/modules/video-render/scripts/render.mjs accept <pagina.html> --format 4:5 --safe instagram-carousel --loop --beats <beats.json> --video <final.mp4> --json
node .flyee/modules/video-render/scripts/render.mjs accept <video.mp4> --page <pagina.html> --beats <beats.json> --networks reels,tiktok,shorts --json
```

O primeiro argumento decide o uso. Uma página (`.html` ou `.htm`): o Motor a abre como no render, lê as caixas de `window.boxes(t)` ao longo do tempo e, com `--video`, mede também o vídeo renderizado dela; é a conferência de um slide de carrossel, de um loop ou de um filme antes de publicar. Um vídeo (`.mp4`, `.m4v`, `.mov`, `.webm`): o Motor o mede contra as redes e, com `--page`, faz também as conferências que só a página permite (capa, área segura, texto, cortes exatos). As duas ordens fazem as mesmas conferências; mudam só dois padrões: com o vídeo primeiro entram as redes habituais do formato e o relatório é gravado em `<vídeo>.aceite.json`, ao lado dele; com a página primeiro nenhuma rede entra sem `--networks` e o relatório só é gravado com `--out`. A página pede o navegador e o vídeo pede o ffmpeg: com o vídeo primeiro, sem o ffmpeg, o erro é `tools_missing`; com a página primeiro, sem o ffmpeg, a página é conferida e as medições do vídeo e do loop ficam `skip`, com aviso. O guia completo dos itens, com o que cada um mede e como resolver, é `.flyee/modules/video-render/references/aceite.md`.

A resposta vem com `ok: true` mesmo quando algum item reprova: as reprovações são dados, em `checks`. Só um pedido quebrado (um arquivo que não existe, uma rede desconhecida, um programa que falta) volta como erro.

| Opção | Para quê |
|---|---|
| `--page <pagina.html>`, `--video <vídeo>` | o outro arquivo da mesma peça; repetir o tipo do primeiro argumento é `usage` |
| `--format 9:16\|4:5\|3:4\|1:1\|16:9\|LARGURAxALTURA` | o tamanho em que a página é conferida e o formato publicado. Padrão: com vídeo, o formato dele, recompondo a página por `window.setFormat` quando a proporção difere; sem vídeo, o tamanho da página. Com `--format`, a página precisa de `window.setFormat` (senão, `fail` no item `page`) |
| `--networks reels,tiktok,…` | as redes de destino, pelos `id` ou apelidos de `networks`. Padrão: com o vídeo primeiro, as habituais do formato (`9:16` → `reels`, `tiktok`, `shorts`; `4:5` e `1:1` → `feed`; `16:9` → `youtube`; `3:4`, nenhuma); com a página primeiro, nenhuma |
| `--safe instagram-carousel\|instagram-feed\|networks\|margin\|none` | a área segura (tabela abaixo). Padrão: `networks` quando há redes; senão `instagram-carousel` em 4:5 e 3:4 e `instagram-feed` nos demais; só `--margin` vira `margin` |
| `--margin <px>` | uma margem uniforme, de 0 a 2000: sozinha vira a área `margin`; com `instagram-carousel`, troca os 72 px |
| `--min-text <px>` | o menor texto aceito a 1080 px de largura, de 8 a 400 (padrão 44); cresce com a largura do quadro: 22 px num quadro de 540, 78,2 px num 16:9 de 1920 (o feed no celular); para um 16:9 visto em tela grande (YouTube no computador ou na TV), `--min-text 15` dá 26,7 px a 1920 |
| `--every <s>` | de quanto em quanto as caixas são lidas, de 0,05 a 60 (padrão 0,25); o quadro 0, cada batida e o último quadro também são lidos, até 1.200 instantes |
| `--beats <beats.json>` ou `--bpm <n>` | a grade de batidas (a lista `beats` do arquivo); com `--bpm`, de 30 a 300, a batida 0 fica em `t = 0`; os dois juntos são `usage` |
| `--tolerance <quadros>` | quanto um corte pode ficar da batida, de 0 a 30 (padrão 1 quadro nos cortes de `film.cuts`; 2 nos achados no vídeo) |
| `--min-on-beat <0 a 1>` | a fração mínima de cortes na batida (padrão 1, todos, nos cortes de `film.cuts`; 0,7 nos achados no vídeo) |
| `--loop` | confere se o último quadro emenda com o primeiro |
| `--max-flashes <n>` | mudanças bruscas de luz toleradas em 1 s, de 0 a 60 (padrão 3) |
| `--max-still <s>` | o trecho parado a partir do qual avisa, de 0,1 a 3600 (padrão 1,5) |
| `--still-by regions\|mean` | como o tempo parado é medido: `regions` (padrão), pela média do quadro e por região; `mean`, só pela média, para peças cuja regra é uma mudança grande a cada poucos tempos (um slide de carrossel, em que setas e marcadores pequenos se mexem sempre) |
| `--lufs <n>` | o volume alvo, de −40 a 0 (padrão −14) |
| `--fps <n>` | a taxa da tolerância e do último quadro, de 1 a 120 (padrão: a da página, senão a do vídeo) |
| `--out <relatorio.json>` | onde gravar o relatório |
| `--browser <caminho>` | outro navegador |

| `--safe` | O retângulo |
|---|---|
| `instagram-carousel` | 72 px de margem nos quatro lados e dois cantos que nenhuma caixa pode tocar: o superior direito, de 170×80 (o contador "1/N"), e o inferior direito, de 100×100 (o botão de som); tudo a 1080 px de largura, proporcional à largura. Nos lados é mais estreito que `Motion.safeArea("4:5")`, que deixa 60 px: num slide, use 72 |
| `instagram-feed` | os recuos do próprio formato na tabela das redes, os mesmos de `Motion.safeArea`: 9:16 com 250 px em cima, 500 embaixo, 70 à esquerda e 180 à direita; 4:5 e 3:4 com 120, 200, 72 e 72; 1:1 com 80, 120, 60 e 60; 16:9 com 80, 150, 100 e 100 |
| `networks` | o maior recuo de cada lado entre as redes de destino, no formato da peça (uma peça aprovada para `reels,tiktok,shorts` cabe nas três); sem redes, os recuos do formato |
| `margin` | uma margem uniforme de `--margin` px |
| `none` | nenhuma: `safe_area` fica `skip` |

| Item (`name`) | O que mede | Veredito |
|---|---|---|
| `page` | a página abre, define `window.seek`, declara `film.duration`, aceita o formato pedido e não dá erro ao carregar | `fail` interrompe a conferência: `checks` traz só este item, com o código do problema em `details`; `skip` sem página |
| `first_frame_readable` | em `t = 0` há pelo menos uma caixa `text` com `size` ≥ `min_text`: o quadro 0 é a capa e a miniatura | `fail` sem texto ou com texto menor; `skip` sem página ou sem `window.boxes` |
| `safe_area` | toda caixa `text`, `logo` ou `face`, em cada instante lido, fica dentro de `safe.rect` e fora dos cantos reservados (1 px de folga; caixas `ui` não entram) | `fail` lista em `details` as piores caixas: `role`, `text`, `time` e `until`, `instants`, `edges` e `overflow` (px por borda) e `corners` (`counter`, `sound`); `skip` com `--safe none`, sem página ou sem `window.boxes` |
| `text_size` | o menor `size` entre as caixas `text` de todos os instantes | `pass` a partir de `min_text`; `warn` entre 0,6 × e 1 ×; `fail` abaixo de 0,6 ×; `details` lista os textos pequenos; `skip` sem caixas de texto com `size` |
| `cuts_on_beat` | cada corte contra a batida mais próxima: os de `film.cuts` quando há página; sem ela, os achados no vídeo pela mudança de cena | `fail` abaixo de `--min-on-beat`, com `cut`, `nearest` e `delta` de cada corte fora em `details`; `skip` sem cortes ou sem batidas |
| `loop_seamless` (com `--loop`) | o SSIM entre o quadro de `t = 0` e o de `t = duração − 1/fps`, fotografados na página ou, sem ela, tirados do vídeo | `pass` a partir de 0,985, `warn` a partir de 0,95, `fail` abaixo; `skip` sem `--loop` ou sem o ffmpeg |
| `flashes` (com vídeo) | as mudanças bruscas de luz (diferença média de luminância acima de 40, numa escala de 0 a 255), contadas em qualquer janela de 1 s | `warn` acima de `--max-flashes`, com cada janela (`at`, `count`) em `details`; nunca `fail` |
| `dead_time` (com vídeo) | os trechos seguidos em que nada muda: a diferença média do quadro abaixo de 0,5 e, com `--still-by regions` (o padrão), a maior mudança de uma região (um bloco de 1/32 da largura) abaixo de 6 em 255, de modo que um texto sendo digitado ou um zoom lento contam como movimento; com `--still-by mean`, só a média | `warn` a partir de `--max-still`, com cada trecho (`from`, `to`, `seconds`); nunca `fail` |
| `loudness` (com vídeo) | o volume integrado e o pico real do áudio | `pass` no alvo ±1,5 LU com pico até −1 dBTP; `warn` com o volume certo e o pico entre −1 e 0 dBTP; `fail` fora da faixa ou com pico acima de 0 dBTP; `skip` sem vídeo, sem áudio ou em silêncio |
| `format_supported`, um por rede | se a rede aceita o formato publicado e se é o que ela recomenda | `fail` quando não aceita; `warn` quando aceita mas recomenda outro, ou num tamanho sem nome |
| `duration`, um por rede | a duração (a do vídeo, senão `film.duration`) contra o mínimo, o máximo e o recomendado da rede | `fail` abaixo do mínimo ou acima do máximo; `warn` acima do recomendado |

| Campo | O que é |
|---|---|
| `mode` | `page` ou `video`: qual arquivo veio primeiro |
| `page`, `video` | os arquivos conferidos (`null` quando faltou um) |
| `format`, `width`, `height`, `duration`, `fps` | o quadro conferido: o layout da página quando há página, senão o vídeo |
| `media` | o vídeo como ele é: `format`, `width`, `height`, `duration`, `fps`, `has_audio`, `size_mb`; `null` sem vídeo ou sem o ffmpeg |
| `safe` | a área usada: `preset`, `rect` (`x`, `y`, `w`, `h`), `corners[]` (`name`, `label`, `x`, `y`, `w`, `h`), `margin`, `networks[]` (as redes cuja zona valeu) e `insets` (`top`, `bottom`, `left`, `right`) |
| `min_text` | o menor texto aceito, já proporcional à largura |
| `beats` | a grade usada (`source`: `file` ou `bpm`, `file`, `bpm`, `count`), ou `null` |
| `samples`, `cuts`, `cuts_source` | quantos instantes da página foram lidos, quantos cortes e de onde vieram (`page`, `video` ou `null`) |
| `networks`, `network_labels`, `networks_default` | os `id` das redes conferidas, o nome de cada uma para mostrar ao integrante e se vieram do formato |
| `limits` | os limites aplicados: `min_text`, `tolerance_frames`, `tolerance_s`, `min_on_beat`, `max_flashes`, `max_still`, `still_by`, `still_mean` e `still_local` (como o tempo parado foi medido e os seus limites; `still_local` é `null` com `mean`), `lufs`, `lufs_tolerance`, `true_peak` |
| `passed` | `true` quando nenhum item está em `fail`; `warn` e `skip` não reprovam |
| `counts`, `score` | quantos itens em cada estado: `pass`, `fail`, `warn`, `skip`, e os mesmos números como `passed`, `failed`, `warned`, `skipped` |
| `checks[]` | um item por conferência, na ordem da tabela acima: `name`, `status` (`pass`, `fail`, `warn`, `skip`), `summary` (uma frase em pt-BR), `details[]`, `fix` (só em `fail` e `warn`) e `network` (o `id` da rede, nos itens por rede) |
| `report` | o relatório gravado (o mesmo resultado, com `app`, `interface_version` e `command`), ou `null` |
| `guide`, `warnings` | o guia dos itens e os avisos gerais: a página sem `window.boxes`, um vídeo de duração diferente da página, um arquivo maior que o limite de envio de uma rede, um programa que falta |

Sem `--json`, a primeira linha traz o veredito e quantos itens ficaram com cada marca; depois vem uma linha por item, com a marca na frente (✓ passou · ✗ reprovou · △ aviso · ○ não medido), o nome da rede entre parênteses nos itens por rede e uma linha "Como resolver" embaixo de cada `fail` ou `warn`. Um `fail` vale mais do que `ok: true` em qualquer outro comando: aplique o `fix`, renderize de novo e confira de novo. Nunca devolva ao integrante um vídeo com item reprovado sem dizer qual.

```
node .flyee/modules/video-render/scripts/render.mjs networks --json
```

Lista as redes que o `accept` conhece, da tabela `.flyee/modules/video-render/references/redes.json`: `checked_on` (a data em que os limites foram conferidos), `note`, `loudness_note`, `formats` (cada formato com `label`, `width`, `height` e `safe_zone`), `defaults_by_format` (as redes habituais de cada formato), `networks[]` e os caminhos `table` e `guide`. Cada rede traz `id`, `label`, `aliases`, `formats`, `recommended_format`, `min_duration_s`, `max_duration_s`, `recommended_duration_s`, `max_file_mb`, `captions` (`burn_in`, `max_chars_per_line`, `lines`, `note`), `loudness` (`lufs`, `true_peak_dbtp`), `notes[]` e `safe_zone` (os recuos por formato). As redes: `reels`, `stories`, `feed`, `tiktok`, `shorts`, `youtube`, `linkedin`, `x`, `whatsapp_status`, `kwai`, `ads_meta`, `ads_tiktok`; em `--networks`, valem os `id` e os apelidos (`instagram`, `twitter`, `whatsapp`…).

## 7. O `beats.json`

Tempos em segundos, contados do começo do arquivo de áudio. Três comandos gravam a grade, cada um com a sua forma; todas trazem `bpm`, `offset` (o instante da batida 0), `duration`, `beats[]`, `downbeats[]` (o tempo 1 de cada compasso) e `source`. É o que os outros leem: `frames --beats` usa `beats` (ou `downbeats`, com `--downbeats`), `accept --beats` usa `beats`, e `Motion.beatGrid(bpm, offset)` monta na página a mesma grade.

| Quem grava | `source` | Os campos |
|---|---|---|
| `synth` | `synth` | `bpm`, `offset` (sempre 0), `beats_per_bar`, `bars`, `duration`, `beats`, `downbeats`, `style`, `seed` |
| `music` | `synthesized` | `format_version` (1), `bpm`, `offset` (0), `duration`, `beats` (até a pancada final; com `--loop`, até o fim), `downbeats` (a cada 4 batidas), `hits` (o `drop` e a pancada final), `sections[]` (`name`, `start`, `end`), `drop` |
| `beats` | `analysis` | `format_version` (1), `file`, `bpm`, `offset`, `confidence`, `duration`, `beats`, `downbeats`, `beats_per_bar` (4), `bars`, `hits` (os acentos medidos), `method` |

```json
{ "bpm": 120, "offset": 0, "beats_per_bar": 4, "bars": 2, "duration": 4, "beats": [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], "downbeats": [0, 2], "source": "synth", "style": "noir", "seed": 7 }
```

Um trecho que começa no meio de uma trilha do `synth` ou do `music` (o slide 2 de um carrossel, depois de 3 compassos) continua com a grade `Motion.beatGrid(bpm)` a partir do `t = 0` da página: um deslocamento de compassos inteiros deixa as batidas no mesmo lugar, o `mix --music-offset` cuida do áudio, e `frames --beats` e `accept --beats` podem receber o `beats.json` da trilha inteira. Numa música medida, a batida 0 cai em `offset`, não em 0: monte a grade da página com `Motion.beatGrid(bpm, offset)` e, para conferir um trecho deslocado, passe `--bpm` ao `accept`.

## 8. Erros

Em erro, `ok` é `false` e vem `error` com `code`, `message` e `fix`. Mostre `message` e `fix` ao integrante; decida pelo `code`.

| `code` | O que fazer |
|---|---|
| `usage` | uma opção, um valor ou uma combinação errada (um `beats.json` sem batidas, uma saída de áudio que não é `.wav`, `--beats` com `--bpm`, um tipo de evento desconhecido): corrija a chamada; `fix` e `help` dizem o certo |
| `file_not_found`, `invalid_json` | um arquivo de entrada não existe ou não é um JSON válido: confira o caminho e o conteúdo |
| `unreadable_media` | o arquivo não é uma mídia que o ffmpeg leia: confira o arquivo com o integrante |
| `no_audio_stream` | `beats` ou `loudness` num arquivo sem som: passe um arquivo com áudio |
| `no_video_stream` | o arquivo passado ao `accept` como vídeo não tem imagem: passe o vídeo renderizado |
| `tools_missing`, `browser_missing` | falta o ffmpeg ou o navegador: rode você mesmo os comandos de `fix` (ou de `install` no `check`), com tempo limite longo, e repita |
| `browser_failed`, `browser_exited`, `browser_protocol` | o navegador não abriu, fechou sozinho ou recusou um comando: tente de novo uma vez; se repetir, repasse `fix` |
| `browser_timeout` | a página não respondeu a tempo (um `seek(t)` que não termina em 30 s, um vídeo que nunca carrega, uma promessa pendente): corrija a página |
| `page_load_failed` | a página não abriu: confira o caminho do HTML |
| `page_error` | a página deu erro de JavaScript: corrija e renderize de novo |
| `page_no_seek`, `page_no_duration` | a página não segue o contrato: defina `window.seek(t)` e `film.duration` (no render, `--end` serve de duração) |
| `format_unsupported` | `--format` numa página sem `window.setFormat`: acrescente-a, ou tire `--format` para sair no tamanho da página |
| `alpha_needs_mov` | transparência num `.mp4`: use `--out` `.mov` ou `.webm` |
| `output_format` | extensão de vídeo desconhecida: use `.mp4`, `.mov` ou `.webm` |
| `ffmpeg_failed` | o ffmpeg não codificou, não juntou ou não mediu: `fix` traz as últimas linhas dele; tente de novo uma vez e, se repetir, repasse |
| `tool_timeout` | o ffmpeg ou o ffprobe travou e o Motor o encerrou ao passar do tempo limite, que é folgado e cresce com a duração do vídeo (`message` diz qual programa e quanto tempo): tente de novo uma vez; se travar de novo, divida o trabalho, com um vídeo ou trecho mais curto ou menos quadros por vez |
| `exists` | `scaffold` numa pasta que já tem `pagina.html`: use outra pasta, ou `--force` só com o sim do integrante |
| `cues_invalid` | a lista de deixas do `sfx` está errada: `message` diz qual deixa e qual campo |
| `audio_too_short`, `silent_audio`, `no_beats` | o `beats` não achou andamento (menos de um segundo de som, silêncio, fala sem ritmo): use um trecho mais longo de música, ou passe `--bpm` |
| `invalid_url` | o endereço do `capture` não é válido ou o arquivo `.html` não existe: confira com o integrante |
| `site_unreachable` | o site não abriu ou respondeu com erro sem conteúdo: confira o endereço e a conexão e tente de novo |
| `site_blocked` | o site barrou o navegador (`bloqueio.png` mostra o que ele devolveu): peça as telas ao integrante ou outro endereço do mesmo site |
| `site_placeholder` | o endereço ainda não tem o site da marca: domínio estacionado ou página padrão do servidor (`sem-site.png` mostra o que veio). Peça outro endereço da marca, ou o logo e duas ou três imagens |
| `capture_failed` | a captura falhou no meio: tente de novo; se repetir, com `--scroll 0` ou `--no-assets` |
| `unknown_network` | uma rede de `--networks` não está na tabela: `networks` lista os `id` e os apelidos |
| `networks_table_invalid` | a tabela das redes do app instalado está corrompida: repasse `message` e `fix` ao integrante |
| `unexpected` | algo fora do previsto: tente de novo; se repetir, mostre `message` ao integrante |

## 9. O que não muda

Dentro da interface 1, os comandos, as opções, os campos e os códigos deste guia continuam valendo; campos novos podem aparecer e devem ser ignorados quando desconhecidos. `frames_hash` é estável: a mesma página, com as mesmas opções, na mesma versão do Motor, dá a mesma assinatura. `synth`, `music` e `sfx` com os mesmos parâmetros dão os mesmos bytes. Uma mudança que quebre algo vira interface 2 e uma versão maior do app.

## 10. Exemplo: um slide de carrossel em loop

O app de carrossel escreveu `carrosseis/academia/slides/02.html` seguindo `pagina.md`: 4:5, 3 compassos a 120 BPM (6 s), `film.cuts` em `[2, 4]` (as batidas 4 e 8), texto a 72 px das bordas, `window.setFormat` e `window.boxes`, com o `motion.js` ao lado. Os cinco slides tocam uma trilha só, de 15 compassos, e o slide 2 começa depois de 3 deles, aos 6 s da trilha.

1. Uma vez por sessão (com `install`, instale e repita):
   `node .flyee/modules/video-render/scripts/render.mjs check --json`
2. A trilha do carrossel inteiro, em compassos exatos, e a grade dela em `music.beats.json`:
   `node .flyee/modules/video-render/scripts/render.mjs synth --out carrosseis/academia/audio/music.wav --bpm 120 --bars 15 --style noir --seed 7 --intro-bars 1 --json`
3. O olhar, um quadro por batida; abra a folha, corrija a página e repita:
   `node .flyee/modules/video-render/scripts/render.mjs frames carrosseis/academia/slides/02.html --format 4:5 --beats carrosseis/academia/audio/music.beats.json --out carrosseis/academia/quadros/02 --json`
4. A conferência da página antes do render final, até `passed` ficar `true`:
   `node .flyee/modules/video-render/scripts/render.mjs accept carrosseis/academia/slides/02.html --format 4:5 --safe instagram-carousel --loop --beats carrosseis/academia/audio/music.beats.json --json`
5. O render mudo:
   `node .flyee/modules/video-render/scripts/render.mjs render carrosseis/academia/slides/02.html --format 4:5 --fps 30 --out carrosseis/academia/renders/02.mp4 --json`
6. Os efeitos do slide, em segundos do slide (batida × 0,5 s), gravados em `carrosseis/academia/audio/02-eventos.json` como `{ "duration": 6, "events": [{ "t": 2, "type": "whoosh" }, { "t": 4, "type": "impact" }] }`:
   `node .flyee/modules/video-render/scripts/render.mjs sfx --out carrosseis/academia/audio/02-sfx.wav --events carrosseis/academia/audio/02-eventos.json --json`
7. A mixagem com a fatia certa da trilha, sem fade, porque é um loop:
   `node .flyee/modules/video-render/scripts/render.mjs mix --video carrosseis/academia/renders/02.mp4 --music carrosseis/academia/audio/music.wav --music-offset 6 --sfx carrosseis/academia/audio/02-sfx.wav --fade-out 0 --out carrosseis/academia/out/02.mp4 --json`
8. A conferência final, com o vídeo pronto (piscadas, tempo parado e volume entram):
   `node .flyee/modules/video-render/scripts/render.mjs accept carrosseis/academia/slides/02.html --format 4:5 --safe instagram-carousel --loop --beats carrosseis/academia/audio/music.beats.json --video carrosseis/academia/out/02.mp4 --json`
9. Ao integrante: `node .flyee/modules/video-render/scripts/render.mjs open carrosseis/academia/out/02.mp4 --json`, o caminho do arquivo, o `frames_hash` e o que a conferência disse.

## 11. Exemplo: um Reels de 15 s

O app de estúdio faz um Reels de 15 s de uma loja, na pasta `estudio/lancamento/`.

1. Uma vez por sessão: `node .flyee/modules/video-render/scripts/render.mjs check --json`.
2. A marca de verdade, em `capturas/exemplo-com-br/captura.json` (logo, cores, fontes, telas, números):
   `node .flyee/modules/video-render/scripts/render.mjs capture https://www.exemplo.com.br --json`
3. A página, a partir do exemplo; o app reescreve as cenas com a marca capturada:
   `node .flyee/modules/video-render/scripts/render.mjs scaffold estudio/lancamento --format 9:16 --duration 15 --name "Lançamento" --json`
4. A trilha com arco, que grava `trilha.beats.json` com `sections`, `drop` e `hits`; a página põe a maior mudança no `drop`, o soco na pancada final (o último de `hits`) e declara os cortes nas batidas:
   `node .flyee/modules/video-render/scripts/render.mjs music --out estudio/lancamento/trilha.wav --duration 15 --bpm 120 --style energetic --seed 3 --json`
5. O olhar: a prévia e um quadro por compasso.
   `node .flyee/modules/video-render/scripts/render.mjs preview estudio/lancamento/pagina.html --json`
   `node .flyee/modules/video-render/scripts/render.mjs frames estudio/lancamento/pagina.html --beats estudio/lancamento/trilha.beats.json --downbeats --json`
6. A conferência da página contra as redes, antes do render final:
   `node .flyee/modules/video-render/scripts/render.mjs accept estudio/lancamento/pagina.html --networks reels,tiktok,shorts --beats estudio/lancamento/trilha.beats.json --json`
7. O render em 9:16, com desfoque de movimento:
   `node .flyee/modules/video-render/scripts/render.mjs render estudio/lancamento/pagina.html --format 9:16 --sub 2 --out estudio/lancamento/reel-mudo.mp4 --json`
8. Os efeitos dos gestos da tela (a trilha já traz a subida e a pancada do `drop`):
   `node .flyee/modules/video-render/scripts/render.mjs sfx --out estudio/lancamento/efeitos.wav --event whoosh@2,click@3,whoosh@10,click@12 --duration 15 --json`
9. A mixagem; sem `--fade-out`, porque a trilha já termina na própria cauda:
   `node .flyee/modules/video-render/scripts/render.mjs mix --video estudio/lancamento/reel-mudo.mp4 --music estudio/lancamento/trilha.wav --sfx estudio/lancamento/efeitos.wav --out estudio/lancamento/reel.mp4 --json`
10. A conferência do vídeo pronto, que grava `estudio/lancamento/reel.aceite.json`:
    `node .flyee/modules/video-render/scripts/render.mjs accept estudio/lancamento/reel.mp4 --page estudio/lancamento/pagina.html --networks reels,tiktok,shorts --beats estudio/lancamento/trilha.beats.json --json`
11. Ao integrante: `node .flyee/modules/video-render/scripts/render.mjs open estudio/lancamento/reel.mp4 --json`, os caminhos, o `frames_hash` do render e o que a conferência disse, rede por rede.
