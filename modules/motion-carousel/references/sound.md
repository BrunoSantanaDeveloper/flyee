# O som do carrossel

Metade do movimento é o som. Num carrossel ele tem um papel a mais: a trilha é uma só para todos os slides, cortada nos compassos, e por isso o slide seguinte começa a música onde o anterior parou. Este guia explica como a trilha e os efeitos são feitos, que estilo e que efeito escolher, e como entra a música do integrante. O comando `render` do app faz tudo sozinho; as linhas do Motor de vídeo estão aqui para você saber o que ele roda e repetir uma etapa quando precisar.

## 1. Uma trilha, cortada nos compassos

- O app soma os compassos de todos os slides e gera **uma** trilha com essa duração. Um carrossel `3, 3, 3, 3, 4` tem 16 compassos: 32 s a 120 BPM.
- Cada slide recebe a fatia que começa no seu `music_offset` (a soma dos compassos anteriores vezes a duração do compasso) e dura o tempo dele. O slide 3 do exemplo toca a trilha de 12 s a 18 s.
- Como toda fatia começa e termina numa cabeça de compasso, o loop do slide recomeça num tempo forte, e o slide seguinte continua a música. É por isso que os slides duram compassos inteiros: uma fatia de 6,3 s faria a música tropeçar a cada volta.
- A mixagem de cada slide não tem fade no fim, porque o slide é um loop.

A duração de um compasso é `beats_per_bar × 60 / bpm`: 2 s a 120 BPM com 4 tempos.

## 2. Os estilos da trilha gerada

A trilha é sintetizada no computador do integrante, sem música de terceiros. Cada estilo é uma frase de 4 compassos que se repete, com pequenas variações tiradas da semente.

| `sound.style` | Como soa | Quando usar |
|---|---|---|
| `clean` | bumbo macio no 1 e no 3, palmas no 2 e no 4, chimbal em colcheias, grave fundo e um arpejo de corda esparso | explicação, método, tutorial; quando nada pede mais |
| `noir` | cama escura de sintetizador, bumbo no 1, aro no 3, chimbal baixinho, ruído de fundo e baixo longo em acordes menores | opinião forte, provocação, frase de tensão; temas `noir` e `mono` |
| `upbeat` | bumbo em todo tempo, chimbal aberto no contratempo, palmas no 2 e no 4, baixo em colcheias e melodia brilhante | lançamento, novidade, energia; tema `cobalt` |
| `lofi` | chimbal com balanço, bumbo e caixa de boom-bap, teclas abafadas, chiado de vinil e agudos suavizados | rotina, bastidores, conversa calma; temas `paper` e `forest` |
| `pulse` | um pulso de sintetizador por batida, com a música "respirando", cama aérea e percussão mínima | produto, tecnologia, dados |

As opções em `sound`, no roteiro:

- `seed`: a mesma semente dá exatamente a mesma trilha. Trocar a semente troca o tom e a frase sem mudar o estilo; anote no `brief.md` a que ficou.
- `intro_bars`: os primeiros compassos tocam só as camadas sustentadas, sem bateria, para o gancho respirar. `1` é um bom valor quando o gancho é uma frase longa. Precisa ser menor que o total de compassos.

O que o `render` roda para um carrossel de 16 compassos:

```
node .flyee/modules/video-render/scripts/render.mjs synth --out carrosseis/<nome>/audio/music.wav --bpm 120 --bars 16 --style noir --seed 7 --intro-bars 0 --json
```

O comando grava `audio/music.wav` (48 kHz, estéreo), feito para repetir sem clique, e `audio/music.beats.json`, a grade de batidas (`bpm`, `offset`, `beats_per_bar`, `bars`, `duration`, `beats`, `downbeats`). A trilha sai perto de −16 LUFS, com pico real de até −1 dBTP; o resultado do `render` traz o que foi medido em `music.lufs` e `music.true_peak_dbtp`. O limite é de 64 compassos por trilha, e a validação do roteiro já recusa um carrossel maior que isso.

Trocar `style`, `seed`, `intro_bars`, `bpm` ou o total de compassos muda a trilha: o próximo `render` a refaz sozinho e remixa todos os slides, sem renderizar nenhum quadro de novo.

## 3. Os efeitos, nas batidas

Cada slide tem a própria faixa de efeitos, `audio/NN-sfx.wav`, feita dos `events` do roteiro (`storyboard.md`, seção 4). O `render` converte cada `beat` em segundos (`beat × 60 / bpm`), grava a lista num arquivo de passagem com a duração do slide e roda:

```
node .flyee/modules/video-render/scripts/render.mjs sfx --out carrosseis/<nome>/audio/01-sfx.wav --events <lista de eventos> --json
```

Os 13 tipos, do mais pesado ao mais leve:

| `type` | Como soa | Dura | Nível de fábrica |
|---|---|---|---|
| `impact` | bumbo grave com rajada de ruído e cauda | 0,9 s | 0 dB |
| `kick` | uma queda de tom rápida e seca | 0,35 s | −4 dB |
| `thump` | mais grave e mais longo que o `kick` | 0,5 s | −4 dB |
| `whoosh` | ruído que varre do grave ao agudo, ou o contrário com `"direction": "out"` | 0,35 s | −7 dB |
| `riser` | ruído e tom que sobem até o fim | 1 s | −7 dB |
| `pop` | um blip curto que sobe de tom | 0,08 s | −9 dB |
| `ding` | um sino agudo com cauda longa | 1,2 s | −9 dB |
| `shutter` | dois cliques e um sopro | 0,09 s | −9 dB |
| `pluck` | uma corda beliscada | 0,5 s | −9 dB |
| `swish` | um `whoosh` curto e mais agudo | 0,15 s | −10 dB |
| `click` | um estalo seco | curtíssimo | −12 dB |
| `blip` | um bipe curto | 0,06 s | −12 dB |
| `tick` | um estalo mais fino e mais agudo | curtíssimo | −15 dB |

**Os níveis já vêm equilibrados.** Cada tipo tem o seu nível de fábrica, e `gain_db` soma a ele: `0` é o padrão, `-6` abaixa, `3` sobe (de −40 a 12). Deixe no padrão o som principal do slide e abaixe os que se repetem ou acompanham: no exemplo, os `pop` das barras estão em `-6`, o `ding` do fim da contagem em `-10`, os pousos da bola em `-4`, `-8` e `-12`, cada um mais fraco.

**Todo som começa na batida do evento.** O `whoosh` atinge o máximo no meio da duração (menos de 0,2 s depois da batida): na batida em que um bloco sai, ele acompanha a saída inteira. O `riser` termina `length` segundos depois de `beat`: para acabar na batida 8 a 120 BPM, com 1 s, comece na 6. Um som não passa do fim do slide: a cauda é cortada ali.

**Variações.** `pitch` multiplica a altura (de 0,1 a 8): uma escada de `tick` com `1`, `1.12`, `1.25`, `1.4` faz a contagem "subir". `length` troca a duração, em segundos. `pan` leva o som de −1 (esquerda) a 1 (direita), acompanhando o elemento na tela.

A regra de sempre: um evento por gesto visível, e nenhum som sem imagem que o justifique. A tabela do gesto ao evento está em `storyboard.md`, seção 4.

## 4. A mixagem e o volume

O Motor mixa cada slide: o vídeo mudo, a fatia da trilha a partir do `music_offset` e a faixa de efeitos, trazidos ao volume das redes.

```
node .flyee/modules/video-render/scripts/render.mjs mix --video carrosseis/<nome>/renders/03.mp4 --out carrosseis/<nome>/out/03.mp4 --music carrosseis/<nome>/audio/music.wav --music-offset 12 --sfx carrosseis/<nome>/audio/03-sfx.wav --fade-out 0 --json
```

| Medida | O que sai |
|---|---|
| volume integrado de cada slide | −14 LUFS |
| pico real | no máximo −1 dBTP |
| música e efeitos | somados sem ganho extra; quem equilibra os efeitos é o `gain_db` de cada evento |
| fade no fim | nenhum |

O resultado do `render` traz, em cada slide, `loudness` com `integrated_lufs`, `true_peak_dbtp` e `range_lu` medidos no arquivo gravado: confira que o volume está perto de −14 e que o pico não passa de −1. Os avisos da mixagem chegam em `warnings`: o pico limitou o volume abaixo do alvo, ou a música acabou antes do fim do slide. Para medir um arquivo de novo:

```
node .flyee/modules/video-render/scripts/render.mjs loudness carrosseis/<nome>/out/03.mp4 --json
```

Depois do render final, a conferência (`accept`) mede o volume de cada `out/NN.mp4` no item `loudness`: passa a até 1,5 LU de −14 LUFS com o pico real até −1 dBTP; avisa com o pico acima de −1; reprova fora dessa folga ou com o pico acima de 0. Na prévia e antes do render, o item fica como `skip`. Um `fail` aqui pede outra mixagem: abaixe os `gain_db` dos efeitos mais fortes do slide e rode o `render` dele de novo.

## 5. A música do integrante

Quando o integrante quer a própria trilha, ela substitui a gerada. Só entra música que ele tem o direito de usar nesse post: confirme com ele e anote no `brief.md`.

1. Deixe o arquivo dentro da pasta do carrossel, por exemplo `carrosseis/<nome>/assets/trilha.mp3`, e aponte `sound.file` para ele no roteiro (`"assets/trilha.mp3"`).
2. Rode o `render`. Ele mede o andamento da música sem palpite e o compara com o `bpm` do roteiro. Combinam quando a diferença é de até 1,5 BPM, ou quando a medida dá o dobro ou a metade (é comum ouvir uma música assim). Nesse caso, uma segunda medida alinha as batidas ao `bpm` do roteiro, e o carrossel começa no primeiro tempo forte, logo no início do arquivo.
3. Leia `music` no resultado: `source` igual a `"file"`, `bpm_detected` (o andamento medido), `tempo_matches` (se combina com o roteiro), `confidence` (de 0 a 1), `start` (o instante da música em que o slide 1 começa) e `duration`.
4. Com `tempo_matches` falso, o aviso diz o andamento medido: os slides sairiam da batida. Ponha esse andamento (o de `bpm_detected`, que pode ter casas decimais) no `bpm` do roteiro e no bloco `SLIDE` de todas as páginas, refaça a conta dos compassos (a duração de cada slide muda) e rode o `render` de novo; ou troque a música.

Os outros avisos: a batida não é clara (`confidence` abaixo de 0,5: pergunte o BPM ao integrante ou proponha outra música) e a música termina antes do carrossel (os últimos slides ficam sem trilha: encurte o carrossel ou use uma música mais longa). A música do integrante não tem o limite de 64 compassos da trilha gerada.

Para escrever os slides já no andamento certo, dá para medir a música antes, sem esperar o `render`:

```
node .flyee/modules/video-render/scripts/render.mjs beats carrosseis/<nome>/assets/trilha.mp3 --out carrosseis/<nome>/audio/medida.beats.json --json
```

O resultado traz `bpm`, `offset` (o instante da primeira batida), `duration` e `confidence`.

Para começar num ponto mais adiante da música (o refrão aos 42 s, por exemplo), corte o trecho com o Motor e aponte `sound.file` para ele:

```
node .flyee/modules/video-render/scripts/render.mjs mix --out carrosseis/<nome>/audio/trecho.wav --music carrosseis/<nome>/assets/trilha.mp3 --music-offset 42 --duration 40 --fade-out 0 --json
```

## 6. Conferir o som sem ouvir

Você não ouve o resultado; confere pela imagem e pelos números.

- **As batidas dos eventos contra os quadros.** Na folha de um quadro por batida (`slide-page.md`, seção 11), o quadro de número `k` é a batida `k − 1`. Cada evento do roteiro tem de cair num quadro em que o gesto dele começa.
- **Os números.** `music` e o `loudness` de cada slide, no resultado do `render`, e o item `loudness` da conferência final.
- **O ouvido do integrante.** A prévia (`preview.html`) começa muda, como o feed; o botão "Som" (ou a tecla M) liga o áudio do slide da vez. É a ele que você pergunta se o estilo serve, oferecendo trocar `style` ou `seed`.
