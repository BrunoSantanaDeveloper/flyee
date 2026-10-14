# Som na batida

Metade do soco é o som. Neste método a música vem **antes** da animação: a grade de batidas da trilha decide onde cada corte, entrada e soco pousam, e os efeitos marcam cada gesto da interface. Este guia é o método; as opções completas dos comandos (`music`, `synth`, `beats`, `sfx`, `mix`, `loudness`) estão em `interface.md`, e a física das transições que o som acompanha está em `motion.md`.

## 1. Música primeiro

Nunca anime antes de ter a grade. Três caminhos:

- **Trilha original com arco, para um filme que começa e termina.** `music --out <pasta>/trilha.wav --duration 15 --bpm 120 --style energetic --beats-out <pasta>/beats.json --json` compõe uma trilha com a duração do filme, o andamento e o caráter pedidos (`clean`, `energetic`, `warm`, `minimal`, `cinematic`, `playful`), com arco (`--arc auto`: introdução, crescimento, ponto alto e uma pancada final no último tempo forte; `--arc flat` é uma cama constante). Devolve `file`, `beats_file`, `bpm`, `duration`, `style`, `sections` e `drop`, e grava o `beats.json` exato, porque uma trilha gerada conhece a própria grade. A mesma `--seed` dá a mesma trilha: anote-a nas notas da entrega para poder refazer. É o caminho padrão de um Reels: sem licença a resolver, drop onde o filme pede.
- **Trilha em loop, para o que se repete.** `synth --out <pasta>/trilha.wav --bpm 120 --bars 8 --style clean --json` gera exatamente `bars` compassos que emendam sem clique (`clean`, `noir`, `upbeat`, `lofi`, `pulse`; `--intro-bars 1` deixa o primeiro compasso mais leve; `--beats-per-bar 3` para compasso ternário). É o caminho de slides de carrossel e de qualquer vídeo que roda em repetição; o `beats.json` vem ao lado, com a batida 0 em `t = 0`.
- **Música do integrante.** `beats <áudio> --out <pasta>/beats.json --json` mede qualquer áudio e devolve `bpm`, `offset`, `confidence`, `beats`, `downbeats` e `hits`. Com `confidence` abaixo de 0,5, não confie na grade: pergunte o BPM ao integrante ou escolha outra música. Só entra música licenciada para o uso (seção 8).

Escolha pela medição, não pelo gosto. Uma trilha boa para filme curto tem **arco** (intro mais baixa → entrada → cheio → uma parada → final), **bumbo legível** (graves alternando forte e fraco a cada tempo: é o que torna a grade confiável) e **fim limpo** (cauda curta). Uma trilha chapada, sem arco, reprova: o filme precisa de silêncio e rajada também no som. Entre duas trilhas geradas, fique com a que tem o `drop` perto de onde o filme precisa da maior mudança de enquadramento.

## 2. O `beats.json`

Tempos em segundos, contados do começo do arquivo de áudio. A página lê este arquivo (ou os números dele colados no código) e monta a grade com `Motion.beatGrid(bpm, offset)`; `frames --beats` e `accept --beats` leem o mesmo arquivo.

| Campo | Conteúdo | Para quê |
|---|---|---|
| `bpm` | o andamento | `Motion.beatGrid(bpm, offset)`; 1 tempo = 60 / bpm |
| `offset` | o instante da batida 0 | a fase da grade; `grid.beat(n)` parte daqui |
| `beats_per_bar`, `bars` | tempos por compasso (4, ou 3 no ternário) e quantos compassos inteiros a trilha tem | `Motion.beatGrid(bpm, offset, beats_per_bar)`; cenas e slides em compassos inteiros |
| `beats` | todos os tempos | mudanças de estado, entradas, cortes curtos |
| `downbeats` | o tempo 1 de cada compasso | as grandes mudanças: troca de mundo, nascer de capítulo, soco |
| `hits` | os acentos mais fortes | o corte principal; efeitos que precisam bater com a música |
| `sections` | as seções da trilha com seus tempos (intro, crescimento, ponto alto, saída) | o arco do filme segue o arco da trilha |
| `drop` | o instante do ponto alto | a maior mudança de enquadramento do filme |
| `confidence` | 0 a 1, só em música medida | abaixo de 0,5, confirme o BPM antes de animar |

`sections` e `drop` vêm da trilha gerada pelo `music`. Numa música medida podem não existir: escolha o drop à mão, no `hit` mais forte da primeira metade ou no primeiro `downbeat` em que a música "abre", e anote a escolha.

```js
const grid = Motion.beatGrid(beats.bpm, beats.offset);     // b = 60/bpm; beat(n), bar(compasso, tempo), nearest(t), pulse(t)
const DROP = Motion.toFrame(beats.drop ?? grid.bar(2, 0), film.fps);
const SOCO = Motion.toFrame(grid.bar(6, 0), film.fps);    // o tempo 1 do último compasso inteiro de 15 s a 120 BPM
```

Escreva a tabela de momentos do filme em **compasso.tempo** ("3.1 = drop"), nunca em segundos soltos: se a trilha mudar, a grade muda e o filme continua na batida.

## 3. Endireitar a grade

Corte que cai entre dois quadros tropeça. A 30 fps, estes andamentos dão tempos em quadros inteiros:

| Quadros por tempo | BPM | 1 tempo | 1 compasso |
|---|---|---|---|
| 12 | 150 | 0,400 s | 1,60 s |
| 13 | 138,46 | 0,433 s | 1,73 s |
| 14 | 128,57 | 0,467 s | 1,87 s |
| 15 | **120** | 0,500 s | 2,00 s |
| 16 | 112,5 | 0,533 s | 2,13 s |
| 18 | 100 | 0,600 s | 2,40 s |
| 20 | 90 | 0,667 s | 2,67 s |

- Ao gerar com `music`, peça um destes BPM. 120 é o padrão de filme curto: 15 s = 7,5 compassos = 30 tempos; cada colcheia tem 7,5 quadros, então alterne 7 e 8 quadros nos cortes de meio tempo.
- Quando a duração pedida não fecha em compassos inteiros num desses andamentos (15 s exatos pedem 8 compassos a 128 BPM), use o andamento que fecha e arredonde cada corte ao quadro com `Motion.toFrame(t, film.fps)`.
- Com música medida, arredonde cada evento ao quadro do mesmo jeito: o erro fica em até meio quadro (17 ms a 30 fps), dentro da tolerância de 1 quadro que o `accept` dá aos cortes declarados pela página. Se o BPM medido estiver a menos de 3% de um valor da tabela, considere gerar uma trilha original nesse BPM em vez de montar o filme numa grade quebrada.

## 4. Onde cada coisa pousa

| Evento visual | Onde na grade | Som |
|---|---|---|
| palavras do gancho | colcheias ou semínimas da intro | `typing` (ou um `tick` por palavra) |
| sair da tela de texto (T1 de `motion.md`) | o tempo 1 da entrada da bateria | `whoosh` |
| nascer da etiqueta (T2) | 1 tempo antes da rajada | `click`, e `tick` a cada passo do caça-níquel |
| **a maior mudança de enquadramento** (T3) | **o drop** | `riser` terminando no drop + `impact` |
| cortes da rajada | tempos e `hits`; durações 1, 1, ½, ½, 1, 2 tempos | nada extra: a música corta |
| troca de mundo (T4, T6) | o tempo 1 de um compasso | `whoosh` |
| cartão que pousa, tela que vira cartão | o tempo em que assenta | `thump` |
| a frase antes do soco (T8) | a parada da música (ou crie uma, segurando) | silêncio |
| **soco final** | o tempo 1 depois da parada | `impact` + `click` |
| confirmação, marca de certo, "feito" | na batida em que aparece | `success` |
| fecho | o último tempo 1; segura até o fim | a cauda da trilha |

Segure 1 a 2 tempos de quase-parada antes do drop e antes do soco. O soco cai a até 1 quadro da batida: a 30 fps são 33 ms de tolerância, e o `accept` mede isso pelos `film.cuts` da página, em que todos os cortes precisam cair na batida.

## 5. Efeitos: o `cues.json`

`sfx <cues.json> --out <pasta>/efeitos.wav --duration 15 --json` sintetiza os efeitos de uma lista de deixas e grava uma faixa só de efeitos, do tamanho do filme (`--cues "0.5:click,1.2:whoosh"` é a mesma lista em linha). Cada deixa marca o instante do evento visual, e o som é alinhado a ele. O `sfx` também aceita a forma de eventos (`--events eventos.json` ou `--event tipo@tempo`), com sons de interface como `shutter`, `pluck` e `blip`; os campos dela estão em `interface.md`.

```json
[
  { "t": 0.5, "type": "typing", "gain": -4 },
  { "t": 2.0, "type": "whoosh", "pan": -0.4 },
  { "t": 2.5, "type": "click" },
  { "t": 2.6, "type": "tick", "gain": -6 },
  { "t": 3.0, "type": "riser", "duration": 1 },
  { "t": 4.0, "type": "impact" },
  { "t": 13.5, "type": "success", "pan": 0.2 }
]
```

| Campo | Valor |
|---|---|
| `t` | segundos; use os mesmos `T` da página (`grid.beat(n)`, arredondados com `Motion.toFrame`) |
| `type` | um dos tipos abaixo |
| `gain` | opcional, em dB; negativo abaixa, positivo sobe; sem ele, o nível padrão do tipo |
| `pan` | opcional, de -1 (esquerda) a 1 (direita); acompanha a posição do elemento na tela |

| `type` | Quando | Nível |
|---|---|---|
| `impact` | o drop e o soco final; no máximo três num filme de 15 s | o mais alto |
| `riser` | a subida antes do drop: começa no `t` e dura `duration` (padrão 1 s; na forma de eventos, `length`), então, para terminar no drop, use `t = drop − duração` | abaixo do `impact` |
| `whoosh` | todo chicote, zoom e passagem rápida de um elemento grande (T1, T4, T6, T7) | 4 a 6 dB abaixo do `impact` |
| `thump` | um cartão que pousa, uma tela que assenta: peso sem estrondo | 4 a 6 dB abaixo do `impact` |
| `click` | toda etiqueta ou botão apertado, toda troca de estado | 6 a 8 dB abaixo |
| `success` | confirmações: a marca de certo, o botão que vira "feito", o fecho | 6 a 8 dB abaixo |
| `ding` | um sino neutro de notificação (um aviso, um sino, um alerta na tela) | 6 a 8 dB abaixo |
| `notify` | uma notificação discreta: a mensagem que chega, o balão que aparece | 8 a 10 dB abaixo |
| `swoosh` | uma passagem leve: o cartão que desliza um passo, a etiqueta que entra | 8 a 10 dB abaixo |
| `pop` | um elemento pequeno que aparece: um selo, um ponto, um balão | 8 a 10 dB abaixo |
| `typing` | texto digitado letra a letra, palavras do gancho que se montam | 8 a 10 dB abaixo |
| `tick` | cada passo de um contador que rola, de um caça-níquel, de uma lista que passa | o mais baixo, 12 dB abaixo |

Regras: uma deixa por gesto visível e nenhum som sem imagem que o justifique; `tick` e `click` nunca na mesma deixa; `riser` sempre terminando num `impact` (o `t` do riser é o do impact menos a `duration`); um filme de 15 s tem entre 8 e 25 deixas. Ajuste os níveis ouvindo a mixagem, não a faixa de efeitos sozinha.

## 6. Mixagem

`mix --out <nome>-final.mp4 --video <nome>.mp4 --music <pasta>/trilha.wav --sfx <pasta>/efeitos.wav --lufs -14 --tp -1 --json` junta tudo ao vídeo mudo do render e normaliza; devolve `loudness` com `integrated_lufs`, `true_peak_dbtp` e `range_lu`. `--music-gain`, `--sfx-gain` e `--voice-gain` ajustam cada faixa em dB antes da normalização. Metas:

| Medida | Meta |
|---|---|
| Volume integrado | −14 LUFS (o `accept` aceita 1,5 LU de folga) |
| Pico real | −1 dBTP |
| Música | parte em `--music-gain -3`; sob cada `impact` ela cede por um instante, e o impacto é que soa |
| Efeitos | de 6 a 12 dB abaixo dos picos da música: comece em `--sfx-gain -6` e ajuste ouvindo |
| Voz | sempre por cima: a música abaixa sob a voz (`--duck`, padrão 10 dB) e volta quando ela para |
| Fade-out | `--fade-out` só quando a peça não é um loop; o fade é curto (meio segundo é o teto). Um loop termina seco, com a trilha feita com `music --loop` |

Depois do `mix`, confira o arquivo: `probe <final> --json` mostra `has_audio` e a duração; `loudness <final> --json` mede de novo quando algo mudou. Nunca "aumente o volume" subindo ganhos: o alvo é o LUFS, e o pico também precisa caber.

## 7. Peças com voz

Quando há fala (a câmera do integrante, uma narração), a fala manda. Duas opções: só efeitos, sem música; ou uma cama musical baixa, de 12 a 18 dB abaixo da voz (`--music-gain -10 --duck 12` é um ponto de partida), sem bateria marcada sob a fala. Nunca música e voz no mesmo nível. Os cortes seguem as pausas da fala, não a grade; os efeitos marcam só as mudanças de tela, e o `impact` fica para o fecho, depois da última frase.

## 8. Direitos

- A trilha e os efeitos gerados pelo Motor são originais: podem ir em posts impulsionados e em anúncios.
- Uma música do integrante só entra com licença para o uso (anúncio, post de marca): peça a confirmação antes e anote-a nas notas da entrega.
- Músicas das bibliotecas das redes não podem ir em arquivos exportados; valem só dentro da rede, aplicadas lá. Por isso toda entrega inclui a versão sem música (`formatos.md`).

## 9. Conferir no fim

- Declare os cortes em `film.cuts` e rode `accept <final> --page <pagina.html> --beats <beats.json> --json`: o item `cuts_on_beat` exige que todos os cortes declarados caiam a até 1 quadro de uma batida (33 ms a 30 fps) e lista os que ficaram fora; sem a página, valem os cortes que o `accept` acha no vídeo, com 2 quadros de folga e 70% na batida. O item `loudness` confere o volume (−14 LUFS com 1,5 LU de folga, pico real até −1 dBTP).
- Olhe o som com a imagem: a tira de quadros em volta do drop (`sheet <final> --strip <drop> --json`) mostra se o quadro da maior mudança é o mesmo instante do `impact`.
