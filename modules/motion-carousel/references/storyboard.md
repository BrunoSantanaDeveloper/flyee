# O roteiro: `storyboard.json`

O roteiro é o arquivo que descreve o carrossel inteiro: o formato, o andamento, a trilha, a ordem dos slides, quantos compassos cada um dura e os efeitos sonoros de cada um. Fica em `carrosseis/<nome>/storyboard.json`. O comando `new` o grava; você o edita; `render` e `accept` o leem e o validam a cada execução, e recusam um roteiro inválido com o código `storyboard_invalid` e o campo errado na mensagem (`storyboard.json: slides[1].bars …`).

O roteiro guarda a estrutura e o som. Os textos, as posições e o movimento ficam na página de cada slide (`slide-page.md`), e os dois precisam concordar: `bars` e `bpm` do roteiro são os mesmos do bloco `SLIDE` da página.

## 1. O formato

O começo do roteiro do exemplo, com o primeiro slide:

```json
{
  "version": 1,
  "title": "Por que todo mundo desiste da academia em fevereiro",
  "format": "4:5",
  "fps": 30,
  "bpm": 120,
  "beats_per_bar": 4,
  "sound": { "style": "noir", "seed": 7, "intro_bars": 0, "file": null },
  "theme": "noir",
  "seed": 7,
  "slides": [
    {
      "n": 1,
      "role": "hook",
      "bars": 3,
      "file": "slides/01.html",
      "title": "Fevereiro mata academias.",
      "events": [
        { "beat": 0.5, "type": "whoosh", "direction": "out", "gain_db": -10 },
        { "beat": 2, "type": "tick" },
        { "beat": 3, "type": "tick", "pitch": 1.12 },
        { "beat": 4, "type": "tick", "pitch": 1.25 },
        { "beat": 7, "type": "whoosh", "direction": "out" },
        { "beat": 9, "type": "impact" }
      ],
      "notes": "Capa: título em três linhas, a primeira em dourado. As três linhas de apoio saem na batida 0,5 e voltam uma por batida (2, 3 e 4), cada uma com um tique. O título some na batida 7 e volta com impacto na 9."
    }
  ]
}
```

| Campo | Valor | Padrão | Para quê |
|---|---|---|---|
| `version` | `1` | `1` | a versão deste formato |
| `title` | texto de até 200 caracteres, obrigatório | sem padrão | o título do carrossel; aparece na prévia |
| `format` | `"4:5"`, `"3:4"`, `"1:1"`, `"9:16"` | `"4:5"` | o tamanho de todos os slides: 1080×1350, 1080×1440, 1080×1080, 1080×1920 |
| `fps` | inteiro de 1 a 120 | `30` | quadros por segundo |
| `bpm` | número de 60 a 200 | `120` | o andamento: define a duração da batida e do compasso |
| `beats_per_bar` | `4` ou `3` | `4` | tempos por compasso; o `new` o copia para as páginas (`beatsPerBar`) |
| `sound.style` | `clean`, `noir`, `upbeat`, `lofi`, `pulse` | `noir` | o caráter da trilha gerada (`sound.md`) |
| `sound.seed` | inteiro | o `seed` do roteiro | a mesma semente dá a mesma trilha |
| `sound.intro_bars` | inteiro de 0 a 8, menor que o total de compassos | `0` | quantos compassos iniciais tocam sem bateria |
| `sound.file` | caminho dentro da pasta do carrossel, ou `null` | `null` | a música do integrante no lugar da trilha gerada (seção 6) |
| `theme` | um dos cinco temas, ou `{ bg, ink, muted, accent }` em hexadecimal de seis dígitos (com `accent2` e `grain` opcionais) | `noir` | o tema que o `new` grava nas páginas, nome ou objeto |
| `seed` | inteiro | `7` | a semente que o `new` grava nas páginas |
| `slides` | lista de 2 a 20 | sem padrão | um item por slide, na ordem de postagem |
| `slides[].n` | a posição na lista | a posição | opcional; quando existe, tem de ser a posição |
| `slides[].role` | `hook`, `point`, `photo`, `cta` | sem padrão | o papel (seção 3) |
| `slides[].bars` | inteiro de 1 a 16 | sem padrão | os compassos do slide; a duração tem de ficar entre 3 e 60 s |
| `slides[].file` | caminho `.html` dentro da pasta do carrossel | `slides/NN.html` | a página do slide; nenhum arquivo se repete |
| `slides[].title` | texto de até 300 caracteres | vazio | a frase principal do slide, para o relatório e para quem lê o roteiro |
| `slides[].events` | lista | vazia | os efeitos sonoros (seção 4) |
| `slides[].notes` | texto de até 2.000 caracteres | vazio | o que acontece no slide e quando |

Só `title` e `slides` (com `role` e `bars` em cada item) são obrigatórios. Campos desconhecidos são ignorados.

`theme`, `seed` e `slides[].title` valem no momento do `new`, que os copia para as páginas. Depois disso quem pinta é a página: mudar o tema, a semente ou uma frase é editar o bloco `SLIDE` de cada slide (mantenha o roteiro em dia, como registro). `format`, `fps`, `bpm`, `beats_per_bar`, `sound`, `bars`, `file` e `events` são lidos pelo `render` a cada execução; `bpm`, `beats_per_bar` e `bars` também estão nas páginas e mudam nos dois lugares juntos.

No `new`, um `\n` digitado no `--title` quebra a linha no título do gancho (em `slides[0].title` e na página); o `title` do carrossel, o briefing e a prévia ficam numa linha só.

## 2. Batidas e compassos

Uma batida dura `60 / bpm` segundos; um compasso, `beats_per_bar` batidas; um slide, `bars` compassos. A 120 BPM com 4 tempos, a batida dura 0,5 s e o compasso, 2 s:

| Compassos | Duração a 120 BPM | Serve para |
|---|---|---|
| 2 | 4 s | um ponto muito curto: uma palavra, um número |
| 3 | 6 s | o gancho e a maioria dos pontos |
| 4 | 8 s | a chamada final; um ponto com mais coisa para ler |

As batidas de um slide são contadas de 0, no primeiro quadro. Num slide de 3 compassos elas vão de 0 a 11 (12 batidas; a 12 já é o reinício do loop), e as cabeças de compasso são 0, 4 e 8. Meias batidas valem (`8.5`).

Os limites:

- Cada slide dura de 3 a 60 s, o que o Instagram aceita num item de vídeo. A 120 BPM isso dá de 2 a 16 compassos; a 200 BPM, de 3 a 16; a 60 BPM, de 1 a 15.
- A trilha gerada tem no máximo 64 compassos no carrossel inteiro (128 s a 120 BPM). Acima disso a validação recusa o roteiro: corte compassos ou slides, ou use uma música do integrante em `sound.file`, que não tem esse limite.
- Acima de 90 s no total, a conferência avisa (`total_duration`).

Mantenha 120 BPM a não ser que o tom peça outra coisa: a 30 quadros por segundo, cada batida cai em 15 quadros inteiros. 100 BPM (18 quadros) e 90 BPM (20 quadros) também caem certo.

## 3. Os papéis dos slides

| Papel | Onde | O que tem |
|---|---|---|
| `hook` | o primeiro | a capa do carrossel: uma frase de 2 a 8 palavras em até 3 linhas, pronta no quadro 0 |
| `point` | os do meio | uma ideia: um rótulo, um título e um recurso que a prova (um contador, um gráfico, cartões, frases que entram por batida, a bola) |
| `photo` | os do meio | uma ideia com foto: a foto de fundo que preenche o quadro, um assunto recortado por cima e o texto num degradê |
| `cta` | o último | o pedido, o que a pessoa ganha e o botão com a palavra a comentar; sem dica de deslizar |

O papel decide o modelo que o `new` usa para a página e aparece na prévia e no relatório. A ordem padrão do `new` é `hook`, os `point` e `cta` (cinco slides: `hook, point, point, point, cta`); `--roles` aceita outra, como `hook,photo,point,cta`. Um `photo` conta como um ponto na numeração dos textos de amostra. A validação não confere a ordem dos papéis; a conferência avisa quando o último slide não é `cta` (`cta_present`) e trata o primeiro quadro do slide 1 como a capa do carrossel (`hook_first_frame`), seja qual for o papel dele.

Foto não é exclusividade do papel `photo`: o gancho e a chamada também podem levar uma foto de fundo, escrita na página com os helpers de imagem, como no exemplo com fotos (`new <nome> --from-photo-example`, papéis `hook, photo, cta`). O papel só escolhe o modelo de partida. As imagens moram em `assets/`, fora do roteiro: de onde vêm está em `images.md`.

## 4. Os eventos sonoros

Cada evento é um efeito curto no instante de um gesto visível. O roteiro guarda a lista; o `render` a converte em segundos, pede os efeitos ao Motor de vídeo e os mixa no slide. O `new` cria os slides sem eventos: escreva-os depois de decidir o movimento de cada página.

| Campo | Valor | |
|---|---|---|
| `beat` | de 0 até antes do fim do slide | obrigatório; a batida em que o som começa, contada do início do slide |
| `type` | um dos 13 tipos abaixo | obrigatório |
| `gain_db` | de −40 a 12 | soma ao nível de fábrica do tipo; negativo abaixa |
| `pan` | de −1 (esquerda) a 1 (direita) | acompanha a posição do elemento na tela |
| `length` | de 0,01 a 10 segundos | a duração do som, no lugar da de fábrica |
| `pitch` | de 0,1 a 8 | multiplica a altura: `1.25` mais agudo, `0.8` mais grave |
| `direction` | `"in"` (padrão) ou `"out"` | em `whoosh` e `swish`: o som sobe (algo entra) ou desce (algo sai) |

| `type` | Como soa | Dura | Nível de fábrica | Quando usar |
|---|---|---|---|---|
| `impact` | bumbo grave com rajada de ruído e cauda | 0,9 s | 0 dB, o mais alto | o `slam` do título; no máximo dois por slide |
| `kick` | uma queda de tom rápida e seca | 0,35 s | −4 dB | uma entrada forte, sem o peso do impacto |
| `thump` | mais grave e mais longo que o `kick` | 0,5 s | −4 dB | algo que pousa: a bola no chão, um cartão grande |
| `whoosh` | ruído que varre do grave ao agudo (`in`) ou do agudo ao grave (`out`) | 0,35 s | −7 dB | um bloco grande entrando ou saindo |
| `swish` | um `whoosh` curto e mais agudo | 0,15 s | −10 dB | uma passagem leve |
| `riser` | ruído e tom que sobem até o fim | 1 s | −7 dB | a subida antes de um impacto |
| `click` | um estalo seco | curtíssimo | −12 dB | um botão, uma troca de estado |
| `tick` | um estalo mais fino e mais agudo | curtíssimo | −15 dB, o mais baixo | cada passo de um contador, cada linha que volta |
| `pop` | um blip curto que sobe de tom | 0,08 s | −9 dB | um elemento pequeno que aparece: um cartão, uma barra |
| `ding` | um sino agudo com cauda longa | 1,2 s | −9 dB | uma confirmação, o fim de uma contagem |
| `shutter` | dois cliques e um sopro | 0,09 s | −9 dB | uma foto, uma captura |
| `pluck` | uma corda beliscada | 0,5 s | −9 dB | uma nota para um destaque |
| `blip` | um bipe curto | 0,06 s | −12 dB | um dado que chega, uma troca de número |

Todo som começa na batida do evento. Duas consequências:

- O `riser` começa em `beat` e termina `length` segundos depois. Para ele terminar numa batida forte, recue: a 120 BPM, um `riser` de 1 s que termina na batida 8 tem `"beat": 6`.
- Um som não passa do fim do slide: a cauda é cortada ali. Um `ding` (1,2 s) ou um `impact` (0,9 s) precisam caber antes do fim.

Do gesto ao evento, como no exemplo:

| O que a página faz | Evento |
|---|---|
| as frases de apoio saem logo (`out: 0.5`) | `{ "beat": 0.5, "type": "whoosh", "direction": "out", "gain_db": -10 }` |
| e voltam uma por batida (`perLine: 1`, `back: 2`) | um `tick` em 2, 3 e 4, subindo o `pitch` (1, 1.12, 1.25) |
| o título sai (`out: 7`) | `{ "beat": 7, "type": "whoosh", "direction": "out" }` |
| o título volta com `slam` (`back: 9`) | `{ "beat": 9, "type": "impact" }` |
| um contador conta de `back: 4` por 4 batidas | um `tick` por batida (4, 5, 6, 7) e um `ding` com `"gain_db": -10` na chegada (8) |
| barras crescem uma por batida a partir de 4,5 | um `pop` com `"gain_db": -6` em 4.5, 5.5, 6.5 e 7.5 |
| cartões voltam a cada batida e meia a partir da 3 | um `pop` em 3, 4.5 e 6, subindo o `pitch` (1, 1.12, 1.25) |
| a bola pousa | um `thump` em cada pouso, cada um mais fraco (`-4`, `-8`, `-12`) |
| um título secundário sai perto do fim (o do slide 4, na 7) | um `whoosh` com `"direction": "out"` e `"gain_db": -8` |
| algo volta sem peso (esse título e a frase de fecho, na 9) | um `whoosh` com `"direction": "in"` e `"gain_db"` de −8 a −10 |
| o botão da chamada estoura de novo (`back: 13`) | um `ding` com `"gain_db": -8` na 13 |

Regras: um evento por gesto visível, e nenhum som sem imagem que o justifique; o som principal do slide no volume de fábrica e os secundários abaixados com `gain_db` (de −6 a −12); de 3 a 12 eventos por slide; nada na última batida que precise de cauda.

## 5. Como o `render` usa o roteiro

Para cada slide escolhido, o `render` faz três coisas e reaproveita o que não mudou:

| Etapa | Arquivo | É refeita quando mudou |
|---|---|---|
| a trilha (uma só para o carrossel) | `audio/music.wav` e `audio/music.beats.json` | `bpm`, `beats_per_bar`, o total de compassos, `sound.style`, `sound.seed`, `sound.intro_bars`, `sound.file` ou o arquivo de música |
| o vídeo mudo do slide | `renders/NN.mp4` (ou `previa/NN-video.mp4`, em metade do tamanho) | o arquivo da página, um arquivo de `assets/` que ela cita, `format`, `fps` ou a opção `--sub` |
| os efeitos e a mixagem | `audio/NN-sfx.wav` e `out/NN.mp4` (ou `previa/NN.mp4`) | o vídeo, os `events` do slide, a trilha, ou a posição e a duração do slide na trilha |

Ou seja: trocar um evento refaz só o som daquele slide; editar uma página, ou um logo que ela carrega de `assets/`, refaz o vídeo e o som dela; trocar o estilo da trilha refaz a trilha e todas as mixagens, sem renderizar nenhum quadro. Nada disso pede `--refresh`. A opção `--refresh` refaz tudo e serve para o que o `render` não enxerga, como uma fonte instalada depois.

O que o `render` não faz é reescrever as páginas. Ao mudar `bars` de um slide, mude também `bars` no bloco `SLIDE` dele e `totalBars` e `offsetBars` nos outros; ao mudar `bpm` ou `beats_per_bar`, mude `bpm` ou `beatsPerBar` em todas as páginas. Quando a página e o roteiro discordam na duração, o `render` avisa em `warnings` e a conferência reprova em `whole_bars`.

A música de cada slide começa em `music_offset`: a soma dos compassos dos slides anteriores vezes a duração do compasso. Num carrossel `3, 3, 3, 3, 4` a 120 BPM, o slide 3 toca a trilha de 12 s a 18 s.

Com `--slides` (`1,3` ou `2-4`), só os slides pedidos são feitos. Os outros voltam como estavam (`status` `kept`, com `stale: true` se a página ou o som mudaram desde então) ou como `missing`; os que faltam e os que mudaram entram em `pending`.

O `render` grava o progresso em `carousel.json` slide a slide, com `partial: true` até o fim da execução. Uma execução interrompida guarda todo slide que terminou, e o slide que estava sendo feito nunca conta como pronto: o mesmo comando, de novo, reaproveita o que ficou pronto e continua dali.

## 6. A trilha: gerada ou do integrante

**Gerada (padrão).** Com `sound.file` em `null`, o Motor sintetiza uma trilha com exatamente a soma dos compassos do carrossel, no `bpm` do roteiro, no estilo e com a semente de `sound`. Os estilos e quando usar cada um estão em `sound.md`.

**Do integrante.** Com `sound.file` apontando para um arquivo dentro da pasta do carrossel (`"assets/trilha.mp3"`), a trilha gerada não é usada. O `render` mede o andamento da música e o compara com o `bpm` do roteiro: se combinarem, alinha as batidas a ele; se não, avisa com o andamento medido, para você pô-lo no roteiro e nas páginas. O passo a passo está em `sound.md`, seção 5. Um `sound.file` que não existe é o erro `file_not_found` no `render`.

## 7. O que a validação recusa

`storyboard_invalid`, com o caminho do campo na mensagem:

- `version` diferente de 1; `title` ausente, vazio ou com mais de 200 caracteres.
- `format` fora dos quatro; `fps` que não é inteiro de 1 a 120; `bpm` fora de 60 a 200; `beats_per_bar` diferente de 3 e de 4.
- `sound.style` desconhecido; `sound.seed` que não é inteiro; `sound.intro_bars` fora de 0 a 8, ou igual ou maior que o total de compassos do carrossel; `sound.file` com caminho absoluto, com letra de unidade ou com `..`.
- `theme` que não é um dos cinco nomes nem um objeto com `bg`, `ink`, `muted` e `accent` em hexadecimal de seis dígitos.
- Menos de 2 ou mais de 20 slides; `n` diferente da posição; `role` fora de `hook`, `point`, `photo`, `cta`; `bars` que não é inteiro de 1 a 16, ou que dá menos de 3 s ou mais de 60 s (a mensagem diz quantos compassos cabem naquele `bpm`).
- Mais de 64 compassos somados com a trilha gerada (o erro aparece em `slides`).
- `file` que não termina em `.html`, que sai da pasta do carrossel ou que repete o de outro slide.
- Num evento: `type` desconhecido; `beat` negativo, ou igual ou maior que o total de batidas do slide; `pan` fora de −1 a 1; `direction` diferente de `in` e `out`; `gain_db` fora de −40 a 12; `length` fora de 0,01 a 10; `pitch` fora de 0,1 a 8.

Um arquivo que não é JSON válido é o erro `invalid_json`. O que passa pela validação e só para no `render` é um arquivo que não existe: uma página ou a música de `sound.file` (`file_not_found`).

## 8. O que a conferência lê do roteiro

O `accept` confere cada página com o `format` e a grade do `bpm` do roteiro (cada slide começa numa cabeça de compasso da trilha, então dentro dele as batidas contam de zero) e, quando `out/NN.mp4` existe, o vídeo final. Do roteiro saem os itens do conjunto:

| Item | Passa quando | Senão |
|---|---|---|
| `slide_count` | há de 2 a 20 slides | reprova |
| `durations` | cada slide dura de 3 a 60 s | reprova |
| `whole_bars` | a duração de cada página conferida é a dos compassos do roteiro (tolerância de um quadro) | reprova, dizendo o slide e as duas durações |
| `same_format` | toda página conferida tem o tamanho do `format` | reprova |
| `hook_first_frame` | o quadro 0 do slide 1 tem um texto legível | reprova; `skip` quando o slide 1 não entrou na rodada |
| `cta_present` | o último slide tem o papel `cta` | avisa |
| `total_duration` | o carrossel tem até 90 s | avisa |
