# A página de um slide

Cada slide do carrossel é uma página HTML em `carrosseis/<nome>/slides/NN.html` que sabe desenhar qualquer instante do próprio loop. O Motor de vídeo abre a página num navegador sem janela, chama `window.seek(t)` para cada quadro e fotografa o canvas. A página carrega duas bibliotecas que o comando `new` copia para a pasta do carrossel: `../motion.js` (do Motor: molas, curvas, grade de batidas, ruído com semente) e `../carousel.js` (deste app: os elementos de um slide). Este guia é a referência completa de `carousel.js`.

Tudo é função pura do tempo: o mesmo `t` dá sempre o mesmo quadro, e o quadro 100 sai certo sem os 99 anteriores. Os tempos dos elementos são contados em **batidas** a partir do início do slide.

Os comentários no topo das páginas citam este guia e o exemplo pelo caminho no projeto: `.flyee/modules/motion-carousel/references/`.

## 1. O esqueleto

É o modelo do gancho, como o `new` o grava (os outros dois mudam só o bloco `SLIDE` e o que há dentro de `seek`):

```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Slide 1 · gancho</title>
<style>
  html, body { margin: 0; background: #0C0C0E; }
  canvas { display: block; }
</style>
</head>
<body>
<canvas id="c" width="1080" height="1350"></canvas>
<script src="../motion.js"></script>
<script src="../carousel.js"></script>
<script>
  window.SLIDE = {
    n: 1, total: 5,
    label: "",
    title: "Fevereiro\nmata\nacademias.",
    text: "Lotada em janeiro.\nVazia em março.\nE não é falta de vontade.",
    theme: "noir", format: "4:5",
    bars: 3, beatsPerBar: 4, bpm: 120, seed: 7,
    totalBars: 16, offsetBars: 0,
    textOut: 0.5, textBack: 2,
    out: null, back: null,
  };
  const S = window.SLIDE;
  const BEATS = S.bars * S.beatsPerBar;
  const OUT = S.out === null ? BEATS - 5 : S.out;
  const BACK = S.back === null ? BEATS - 3 : S.back;
  const C = Carousel.setup({ bars: S.bars, beatsPerBar: S.beatsPerBar, bpm: S.bpm, format: S.format, theme: S.theme, seed: S.seed, title: "Slide " + S.n + " · gancho" });

  window.seek = (t) => {
    C.begin(t);
    C.glow({ x: 0.82, y: 0.18, alpha: 0.08 });
    C.pulseBg(0.03);
    let y = 176;
    if (S.label) C.label(S.label, { y: 96, size: 44 });
    const title = C.headline(S.title, { y, size: 176, colors: S.title.indexOf("\n") >= 0 ? ["accent"] : null, out: OUT, outStyle: "rise", back: BACK, in: "slam" });
    y = title.bottom + 52;
    C.shape({ kind: "line", x: 72, y, x2: 292, y2: y, lineWidth: 8, out: S.textOut, back: S.textBack - 0.5, in: "draw" });
    if (S.text) C.body(S.text, { y: y + 44, size: 58, lineHeight: 1.2, maxWidth: 900, perLine: 1, out: S.textOut, back: S.textBack });
    C.ruler({ y: 1140, totalBars: S.totalBars, offsetBars: S.offsetBars, bars: S.bars });
    C.progress({ step: S.n, total: S.total });
    if (S.n < S.total) C.swipeHint({});
    return C.end();
  };
</script>
</body>
</html>
```

A página tem três partes: o bloco `SLIDE` (os textos e os momentos, o que muda de um slide para outro), o `Carousel.setup` (declara o filme) e o `window.seek` (desenha o quadro do instante `t`, sempre entre `C.begin(t)` e `return C.end()`). Dentro de `seek`, a ordem das chamadas é a ordem das camadas: o que vem depois fica por cima.

O bloco `SLIDE` é só um objeto da página: crie nele os campos de que o slide precisar (o exemplo usa `counter`, `chart`, `lines`, `ball`, `cards`). Os campos que o `new` preenche a partir do roteiro:

| Campo | De onde vem | Quando muda |
|---|---|---|
| `n`, `total` | a posição do slide e o total de slides | ao acrescentar ou tirar um slide: `total` em todos, `n` nos seguintes |
| `title`, `text` | o título do slide no roteiro e um texto de amostra | sempre: troque todo texto de amostra pelo conteúdo real |
| `theme` | o `theme` do roteiro: um nome entre aspas, ou o objeto do tema próprio | ao trocar o tema, em todas as páginas |
| `format`, `bpm`, `seed` | `format`, `bpm` e `seed` do roteiro | ao mudar um deles no roteiro, mude em todos os slides (o `render` não reescreve as páginas) |
| `bars`, `beatsPerBar` | os compassos deste slide e o `beats_per_bar` do roteiro | junto com o roteiro; os dois precisam concordar |
| `totalBars`, `offsetBars` | a soma dos compassos do carrossel e a soma dos compassos dos slides anteriores | ao mudar compassos ou a ordem: a régua de continuidade usa os dois |

Os modelos calculam as batidas do slide como `BEATS = S.bars * S.beatsPerBar` e passam `beatsPerBar` ao `Carousel.setup`: um roteiro em 3 tempos (`beats_per_bar: 3`) funciona igual, com `beatsPerBar: 3` em cada página.

## 2. `Carousel.setup` e o objeto `C`

```js
const C = Carousel.setup({ bars: 3, bpm: 120, beatsPerBar: 4, fps: 30, format: "4:5", theme: "noir", seed: 7, title: "01 · gancho" });
```

| Opção | Padrão | O que é |
|---|---|---|
| `bars` | `3` | os compassos do slide |
| `bpm` | `120` | o andamento, igual ao do roteiro |
| `beatsPerBar` | `4` | tempos por compasso |
| `fps` | `30` | quadros por segundo |
| `format` | `"4:5"` | `"4:5"` (1080×1350), `"3:4"` (1080×1440), `"1:1"` (1080×1080) ou `"9:16"` (1080×1920) |
| `theme` | `"noir"` | um dos cinco temas (seção 6) ou um objeto `{ bg, ink, muted, accent }` |
| `seed` | `1` | a semente do grão e do ruído |
| `title` | `"slide"` | o nome do filme |
| `canvas` | o elemento de id `c` | outro canvas |

O `setup` ajusta o tamanho do canvas, declara o filme para o Motor (`window.film`, com a duração `bars × beatsPerBar × 60 / bpm`, o tamanho, o `fps` e a cor de fundo do tema), define `window.setFormat` (o Motor a chama quando o render pede outro formato: o canvas e a área segura são recompostos) e define `window.boxes` (seção 10). Um tema desconhecido interrompe a página nessa linha.

O que `C` traz:

| Campo | O que é |
|---|---|
| `W`, `H` | a largura e a altura em pixels |
| `T`, `totalBeats`, `beatS` | a duração em segundos, o total de batidas e os segundos de uma batida |
| `bpm`, `beatsPerBar`, `fps`, `seed`, `format` | o que foi declarado |
| `t`, `b` | depois de `begin`: o instante em segundos e em batidas |
| `safe` | a área segura (seção 3) |
| `theme` | as cores em uso: `bg`, `ink`, `muted`, `accent`, `accent2`, `surface` (a cor dos cartões), `line`, mais `name`, `light` (fundo claro) e `grain` |
| `fonts` | `family`, `display`, `text`, `displayWeight` (800) e `textWeight` (500) |
| `canvas`, `g` | o canvas e o contexto 2D, para desenhar o que os helpers não cobrem |
| `film` | o filme declarado: `duration`, `width`, `height`, `fps`, `background`, `title` |
| `grid` | a grade de batidas do Motor: `beat(n)`, `bar(compasso, tempo)`, `index(t)`, `nearest(t)`, `phaseInBeat(t)`, `pulse(t)` |
| `noise(x)` | ruído suave com semente, função pura de `x` |
| `rng` | um gerador com semente que avança a cada chamada: dentro de `seek`, crie um novo a cada quadro (`Motion.rng(S.seed)`), senão o quadro passa a depender dos anteriores |

Atenção ao nome: `C.bars(...)` é o gráfico de barras. Os compassos do slide ficam em `S.bars` (ou `C.totalBeats / C.beatsPerBar`).

## 3. Posições, cores e a área segura

**Posições.** Um número de 0 a 1 é uma fração da largura (em `x`, `w`, `x2`, `r`, `maxWidth`) ou da altura (em `y`, `h`, `y2`, `height`) do quadro inteiro; acima de 1 são pixels. `y: 0.7` é 70% da altura; `y: 176` são 176 px. O exemplo usa pixels para o texto e uma fração para o botão.

**Cores.** Onde um helper aceita cor, valem os nomes do tema (`"bg"`, `"ink"`, `"muted"`, `"accent"`, `"accent2"`, `"surface"`) ou qualquer cor de canvas (`"#E6C15A"`, `C.rgba(C.theme.ink, 0.25)`). Sem a opção, cada helper usa a cor do tema indicada na tabela dele.

**Área segura.** `C.safe` é `{ x, y, w, h, margin, corners: { counter, sound } }`: a margem de 72 px e as duas faixas que o Instagram cobre já descontadas. É de onde saem os padrões de posição e de largura dos helpers.

| Formato | `C.safe` (x, y, largura, altura) | Vai até |
|---|---|---|
| 4:5 | 72, 80, 936, 1170 | x 1008, y 1250 |
| 3:4 | 72, 80, 936, 1260 | x 1008, y 1340 |
| 1:1 | 72, 80, 936, 900 | x 1008, y 980 |
| 9:16 | 72, 250, 828, 1170 | x 900, y 1420 |

Os dois cantos reservados, a 1080 px de largura: o contador "1/N" (170×80 px no alto, à direita) e o botão de som (100×100 px embaixo, à direita). A conferência é um pouco mais larga que `C.safe`: ela aceita texto e logo dentro da margem de 72 px em todos os lados (no 4:5, de 72 a 1008 na largura e de 72 a 1278 na altura), desde que não toquem esses dois cantos.

Os modelos e o exemplo foram compostos em pixels para o 4:5 e servem ao 3:4, que só ganha espaço embaixo. No 1:1 e no 9:16 as mesmas posições não funcionam (a régua em `y: 1140` cai fora do quadro quadrado e o botão encosta no texto): reposicione a partir de `C.safe` e de frações, deixe a régua sem `y` e olhe os quadros.

## 4. O tempo: batidas, entrada, saída e volta

As opções de tempo são as mesmas em texto, cartão, forma, contador, botão e dica de deslizar. Todas em batidas, com frações (`2.5`).

| Opção | Padrão | O que faz |
|---|---|---|
| `at` | `0` | a batida em que o elemento entra; `0` significa já assentado no quadro 0, sem entrada |
| `in` | depende do helper | o estilo da entrada e da volta |
| `inBeats` | `1` (`slam`: 0,5; `type`: 0,1 por caractere, no mínimo 0,5) | quanto dura a entrada |
| `out` | não sai (com `at > 0`: sai sozinho no fim) | a batida em que o elemento sai |
| `outStyle` | `"fade"` | o estilo da saída |
| `outBeats` | `0.5` | quanto dura a saída |
| `back` | não volta | a batida em que ele volta, com o estilo de `in` |
| `spring` | depende do helper | a mola da entrada: `"heavy"`, `"type"`, `"snappy"`, `"default"` ou `"playful"` (a única que rebate; nunca em texto) |
| `perLine` | `0` | só em texto: o atraso, em batidas, entre uma linha e a seguinte na entrada e na volta |

**Regra 1: `at: 0`, o padrão, é a capa.** Um elemento sem `at` está assentado no quadro 0: no lugar, no tamanho final, sem nenhuma entrada tocando em `t = 0`. Ele pode sair em `out` e voltar em `back`, e no fim do slide está idêntico ao quadro 0. Por isso o quadro 0 é uma capa terminada e o loop fecha sem salto. `at: 0` + `out` + `back` é o padrão canônico de movimento: é como todos os slides do exemplo se mexem.

**Regra 2: `at > 0` entra depois e sai sozinho.** Um elemento com `at` maior que zero não existe no quadro 0. Ele entra na batida `at` com o estilo `in`, fica, e sai em `out`; sem `out`, sai sozinho na última meia batida do slide, porque precisa ter sumido quando o loop recomeça. Use para o que não faz parte da capa; nunca para o título.

O que quebra o loop, e a conferência acusa em `loop_seamless`:

- `at: 0` com `out` e sem `back`: o elemento some e reaparece de uma vez quando o loop recomeça.
- `at > 0` com `out` e `back`: ele volta, fica até o fim e some de uma vez no reinício (sem `out`, o `back` não tem efeito).
- Uma volta que não cabe: `back + (linhas − 1) × perLine` precisa ficar antes do fim do slide, e convém sobrar a duração da entrada (`inBeats`). Quando sobra menos, a biblioteca comprime a entrada para terminar no último quadro, e o gesto fica brusco.
- No contador e na bola, `back + beats` precisa caber no slide: o número tem de ter chegado a `to`, e a bola, a `from`.

Estilos de entrada (`in`):

| `in` | O gesto |
|---|---|
| `rise` | sobe até o lugar enquanto aparece |
| `drop` | desce até o lugar enquanto aparece |
| `pop` | cresce de 60% ao tamanho final |
| `slam` | chega 35% maior e assenta rápido: o impacto do título |
| `wipe` | é revelado da esquerda para a direita |
| `draw` | o mesmo recorte; numa linha, numa seta ou num anel, o traço é desenhado |
| `type` | aparece letra por letra |
| `grow` | cresce do zero |
| `fade` | só aparece |
| `none` | aparece de uma vez |

Estilos de saída (`outStyle`): `fade` (apaga descendo um pouco), `rise` (sobe e apaga), `drop` (desce e apaga), `shrink` (encolhe), `grow` (cresce e apaga), `none` (some de uma vez).

Durante uma entrada ou uma saída o elemento está deslocado ou maior do que o normal. Ponha `out` e `back` em batidas inteiras ou em meias batidas e deixe folga entre o que anima e as margens: um `slam` de título que encosta na borda pode ser lido fora da área segura no meio do gesto.

## 5. Os helpers

Todo helper desenha no instante atual e registra a caixa do que desenhou (seção 10). Os de texto, cartão, contador, gráfico e botão devolvem a geometria mesmo quando o elemento está escondido: é com ela que se empilha o resto.

### `C.begin(t)` e `C.end()`

`begin` leva `t` para dentro do loop (`seek(T)` é igual a `seek(0)`), pinta o fundo do tema, aplica o grão quando o tema tem e zera as caixas. `end` fecha o quadro; devolva o resultado dele em `seek`.

### Texto: `C.headline`, `C.body`, `C.label`

```js
const title = C.headline("Fevereiro\nmata\nacademias.", { y: 176, size: 176, colors: ["accent", "ink", "ink"], out: 7, outStyle: "rise", back: 9, in: "slam" });
C.body("Lotada em janeiro.\nVazia em março.", { y: title.bottom + 96, size: 58, lineHeight: 1.2, maxWidth: 900, perLine: 1, out: 0.5, back: 2 });
C.label("Todo ano a mesma cena", { y: 96, size: 44 });
```

| | `headline` | `body` | `label` |
|---|---|---|---|
| `size` | 120 | 52 | 36 |
| peso | 800 | 500 | 700 |
| `lineHeight` | 1.0 | 1.25 | 1.2 |
| `color` | `ink` | `ink` | `muted` |
| `in` / `spring` | `rise` / `heavy` | `rise` / `type` | `rise` / `snappy` |
| outros | | | caixa alta e letras espaçadas |

O rótulo nasce com 36 px, abaixo dos 44 px que a conferência pede: passe `size: 44`, como os modelos.

| Opção | Padrão | O que faz |
|---|---|---|
| `x`, `y` | a borda esquerda e o topo de `C.safe` | o ponto de ancoragem |
| `align` | `"left"` | `"left"`, `"center"` (o `x` padrão vira o centro do quadro) ou `"right"` (a borda direita de `C.safe`) |
| `valign` | `"top"` | `"top"`, `"middle"` ou `"bottom"`: o que o `y` marca no bloco |
| `maxWidth` | do `x` até a borda de `C.safe` | a largura em que o texto quebra |
| `maxHeight` | do `y` até o fim de `C.safe` | a altura em que o bloco tem de caber |
| `maxLines` | sem limite | o máximo de linhas |
| `size`, `minSize` | a tabela acima; `minSize` é 60% de `size` | o tamanho pedido e o menor a que ele pode chegar |
| `lineHeight`, `weight`, `tracking`, `uppercase` | a tabela acima | entrelinha, peso, espaço entre letras (fração do tamanho) e caixa alta |
| `color` | a tabela acima | a cor do bloco |
| `colors` | nenhuma | uma cor por linha, na ordem (`["accent", "ink"]`): a palavra-herói muda de cor sem quebrar o bloco; linhas além da lista usam `color` |
| `role` | `"text"` | o papel da caixa na conferência |

O texto quebra em `\n` e, depois, por palavras em `maxWidth`. Se não couber na largura, na altura ou em `maxLines`, o tamanho desce de 2 em 2 px até `minSize` e para aí: um texto longo demais pode vazar mesmo no tamanho mínimo, e a conferência acusa. `perLine` atrasa cada linha desenhada na entrada (`at > 0`) e na volta (`back`), inclusive as linhas que a largura quebrou sozinha; a saída é de todas juntas.

Devolve `{ x, y, w, h, bottom, right, size, lines, lineHeight }`. `size` é o tamanho de fato usado: menor que o pedido quer dizer que a frase é longa.

### `C.card(opções)`

Um retângulo arredondado: o fundo de um item de lista, com o texto por cima.

| Opção | Padrão | |
|---|---|---|
| `x`, `y`, `w`, `h` | o canto e a largura de `C.safe`; `h` 200 | o retângulo |
| `radius` | 28 | o raio dos cantos |
| `color` | `surface` | o preenchimento |
| `stroke`, `lineWidth` | sem contorno; 2 | a cor e a espessura do contorno (`stroke: C.theme.line`) |
| `shadow` | `false` | `true` acrescenta uma sombra suave |
| `in`, `spring` | `rise`, `default` | estilos úteis: `rise`, `drop`, `pop`, `wipe`, `fade`, `none` |
| `role` | `"ui"` | o papel da caixa |

Devolve `{ x, y, w, h, bottom, right }`.

### `C.shape(opções)`

| `kind` | Usa | Entrada padrão |
|---|---|---|
| `"rect"` (padrão) | `x`, `y` (o canto), `w`, `h` (200), `radius` (0) | `pop` |
| `"circle"` | `x`, `y` (o centro), `r` (60) | `pop` |
| `"ring"` | `x`, `y` (o centro), `r`, `lineWidth` | `draw`: o arco se fecha |
| `"line"` | `x`, `y` até `x2`, `y2`, `lineWidth` | `draw`: o traço cresce do começo ao fim |
| `"arrow"` | como a linha, mais `head` (o tamanho da ponta) | `draw` |

Padrões: `x`, `y` no centro do quadro; `x2` 200 px à direita de `x`; `y2` igual a `y`; `lineWidth` 6; `color` `accent`; `spring` `default`; `role` `"ui"`. Devolve a caixa desenhada `{ x, y, w, h }`, ou `null` quando escondida. Serve para o risco sob o título, uma linha de chão, um destaque em anel, uma seta.

### `C.counter(opções)`

Um número animado, no formato brasileiro (1.234,5), desenhado como um título.

| Opção | Padrão | |
|---|---|---|
| `from`, `to` | 0 | de onde e até onde conta |
| `beats` | 4 | quanto dura a contagem |
| `ease` | `"outCubic"` | a curva (`"linear"`, `"outQuad"`, `"outExpo"`, `"inOutCubic"`…) |
| `prefix`, `suffix`, `decimals` | vazio, vazio, 0 | `"R$ "`, `"%"`, casas decimais |
| `size`, `color` | 200, `accent` | o tamanho e a cor |
| `in`, `inBeats`, `spring` | `pop`, 0,5, `snappy` | a entrada |

Aceita também as opções de texto (`x`, `y`, `align`, `maxWidth`…) e de tempo. Com `at: 0`, o quadro 0 mostra `to`: a capa já traz o resultado. Com `out` e `back`, o número sai, volta em `back` contando de `from` e chega exatamente a `to` depois de `beats` batidas. Com `at > 0`, aparece em `at` contando de `from` a `to` e sai sozinho no fim. Devolve a geometria do texto.

### `C.bars(opções)`

Um gráfico de barras que crescem uma depois da outra.

| Opção | Padrão | |
|---|---|---|
| `values` | vazia, sem barras | a lista de números |
| `labels` | nenhum | um texto embaixo de cada barra |
| `x`, `y`, `w`, `h` | o canto e a largura de `C.safe`; `h` 320 | a área do gráfico, já com os rótulos |
| `max` | o maior valor | o valor que enche a altura |
| `gap` | 0.28 | a fração de cada coluna que fica vazia |
| `perBar` | 0.5 | batidas entre uma barra e a seguinte |
| `inBeats` | 1 | quanto cada barra leva para crescer |
| `at`, `out`, `outBeats`, `back`, `spring` | como na seção 4 | com `at: 0`, o quadro 0 mostra as barras cheias; depois de `out`, elas voltam a crescer a partir de `back` |
| `color`, `radius` | `accent`; até 12 | a cor e o canto das barras |
| `labelSize`, `labelColor` | 44, `muted` | os rótulos |
| `valueLabels`, `decimals`, `suffix` | `false` | `true` escreve o valor acima de cada barra depois que ela cresce |

Uma barra de valor zero deixa só a linha de base. Devolve `{ x, y, w, h, bottom, right }`.

### `C.ball(opções)`

Uma bola com peso (esmaga e estica) que vai de um ponto a outro e volta. Está sempre visível: descansa em `from`, parte em `at`, descansa em `to` e volta a partir de `back`.

| Opção | Padrão | |
|---|---|---|
| `from`, `to` | `[0.2, 0.7]`, `[0.8, 0.7]` | os dois pontos, `[x, y]` |
| `path` | nenhum | uma lista de pontos no lugar da reta; um caminho fechado (o último ponto igual ao primeiro) dá a volta completa e não retorna |
| `radius` | 40 | o raio, em pixels |
| `at`, `beats` | 0, 4 | quando parte e quanto dura a ida (a volta dura o mesmo) |
| `back` | o total de batidas menos `beats` | quando começa a voltar; o padrão a faz pousar em `from` no último quadro |
| `ease` | `"bounce"` | `"bounce"` (pula), `"linear"`, `"out"` (desacelera) ou `"spring"` |
| `hops` | 3 | só no `bounce`: quantos pulos (cada um com 60% da duração do anterior) ou a lista das durações relativas, como `[2, 1.25, 0.75]` |
| `height` | 5 raios | só no `bounce`: a altura do primeiro pulo; os seguintes diminuem com o quadrado da duração |
| `squash` | `true` | `false` desliga o esmaga e estica |
| `color`, `role` | `accent`, `"ui"` | |

No `bounce`, `from` e `to` são o centro da bola em repouso: o chão fica um raio abaixo. Com `hops: [2, 1.25, 0.75]`, `at: 2` e `beats: 4`, a bola pousa nas batidas 4, 5,25 e 6; na volta a partir de `back: 7`, em 9, 10,25 e 11: são as batidas dos efeitos de pouso no roteiro. Devolve `{ x, y, r, p, dir, moving }`.

### `C.ruler(opções)`

A régua de compassos do carrossel inteiro, igual em todos os slides: um traço por batida, o número de cada compasso, o trecho deste slide em destaque e um cursor que o varre.

| Opção | Padrão | |
|---|---|---|
| `totalBars` | os compassos deste slide | os compassos do carrossel inteiro (`S.totalBars`) |
| `offsetBars` | 0 | os compassos dos slides anteriores (`S.offsetBars`) |
| `bars` | os compassos deste slide | |
| `x`, `w` | a largura de `C.safe` | |
| `y` | 110 px acima do fim de `C.safe` (1140 no 4:5) | a linha da régua |
| `color`, `accent` | a tinta a 35%, `accent` | os traços, e o trecho e o cursor |
| `numbers`, `numberSize` | `true`, 22 | os números dos compassos |

Não tem opções de tempo: está sempre lá. Devolve `{ x, y, w, unit, head }`.

### `C.progress(opções)`

As pílulas de progresso: a do slide atual é larga e acesa. `step` e `total` (padrão 1), `x` (a borda esquerda de `C.safe`), `y` (o fim de `C.safe`: 1245 no 4:5), `size` (10), `gap` (12), `color` (`accent`), `muted` (a tinta a 25%). Sempre visível. Devolve `{ x, y, w, h }`.

### `C.cta(texto, opções)`

O botão em pílula da chamada final. O texto sai como foi escrito (ponha a palavra em maiúsculas você mesmo).

| Opção | Padrão | |
|---|---|---|
| `x`, `y` | o centro do quadro; 72% da altura de `C.safe` | o **centro** do botão |
| `size` | 48 | o tamanho do texto |
| `paddingX`, `w`, `h` | 60; o texto mais as folgas; 2,3 vezes `size` | as medidas |
| `radius` | meia altura | os cantos |
| `color`, `textColor` | `accent`, `bg` | |
| `pulse`, `pulseAmount` | `true`, 0.03 | o botão respira 3% em cada cabeça de compasso; `pulse: false` desliga |
| `in`, `spring` | `pop`, `snappy` | |

Com `out` e `back`, o botão some e volta: `outStyle: "shrink"` com `in: "pop"` o faz encolher e estourar de novo, como na chamada do exemplo. Devolve `{ x, y, w, h, bottom }`. O pulso acontece só nas cabeças de compasso (a cada 2 s a 120 BPM): sozinho, ele não impede o aviso de tempo parado.

### `C.swipeHint(opções)`

Uma seta pequena que cutuca a cada batida: "deslize". Por padrão fica na linha das pílulas de progresso, à direita, à esquerda do canto do botão de som (no 4:5, em x 889 e y 1245); `x` e `y` mudam o lugar. `side` (`"right"`; `"left"` inverte), `size` (26), `color` (`muted`), `lineWidth` (5), `in` (`fade`), mais `at`, `out` e `back`. Nunca no último slide.

### Fundo: `C.pulseBg`, `C.glow`, `C.grain`

- `C.pulseBg(quanto)`: um pulso de brilho do fundo em cada cabeça de compasso, de no máximo 3% (`0.03`, o padrão e o teto). Chame logo depois de `begin`, antes do conteúdo.
- `C.glow({ x, y, r, color, alpha, drift })`: uma luz suave que deriva num círculo fechado ao longo do slide e volta ao lugar no fim. Padrões: `x` 0.75, `y` 0.3, `r` 0.8, `color` `accent`, `alpha` 0.1, `drift` 0.03.
- `C.grain(alpha)`: o grão com semente sobre o quadro. O tema `noir` já o aplica em `begin`; chame à mão só em outro tema.

### Pulsos e contas

| Função | Devolve |
|---|---|
| `C.beat(n)` (ou `C.beats(n)`) | os segundos da batida `n` |
| `C.bar(n, tempo)` | os segundos do tempo `tempo` do compasso `n` |
| `C.loopT(t)` | `t` dentro da duração do slide |
| `C.beatPulse(decay)` | 1 em cada batida, caindo em seguida (padrão 6) |
| `C.downbeat(decay)` | 1 em cada cabeça de compasso, caindo em seguida (padrão 5) |
| `C.downbeatBump(sigma)` | uma respiração simétrica em volta de cada cabeça de compasso (padrão 0.14 batida): sobe antes, desce depois, e por isso fecha o loop; prefira esta para o que é grande |
| `C.rgba(cor, alfa)`, `C.mix(a, b, t)` | uma cor hexadecimal com transparência; a mistura de duas |
| `C.formatNumber(valor, casas)` | o número no formato brasileiro |

Para um elemento desenhado à mão com `C.g`, o mesmo relógio está disponível: `C.life({ at, out, back }, inBeats, outBeats, mola)` devolve `{ visible, p, q, settled }` (o progresso da entrada e da saída, de 0 a 1), `C.pose(estilo, p, q, estiloDeSaída, deslocamento)` devolve `{ alpha, dx, dy, scale, wipe, chars }`, e `C.entrance(x, mola)` é a curva de uma entrada.

`Carousel` traz ainda `THEMES`, `FORMATS`, `FONTS`, `MARGIN` (72), `CORNERS`, `safeRect(largura, altura, formato)` e `resolveTheme(tema)`.

## 6. Temas e fontes

| Tema | `bg` (fundo) | `ink` (texto) | `muted` (rótulos) | `accent` | |
|---|---|---|---|---|---|
| `noir` | `#0C0C0E` | `#F3F1EA` | `#8A8781` | `#E6C15A` | com grão |
| `cobalt` | `#0A3DD6` | `#FFFFFF` | `#9DB6FF` | `#FF7A1A` | |
| `paper` | `#F4F1EA` | `#141413` | `#8E8A80` | `#D97757` | fundo claro |
| `forest` | `#0F2A1E` | `#ECF3E8` | `#7FA18E` | `#C7F25E` | |
| `mono` | `#111111` | `#FAFAFA` | `#777777` | `#FFFFFF` | o acento é o branco |

Um tema próprio é um objeto `{ bg, ink, muted, accent }`, com `accent2` e `grain` opcionais, em cores hexadecimais de seis dígitos. Ele vale para o carrossel inteiro: escrito no `theme` do roteiro antes do `new`, ele é copiado para o bloco `SLIDE` de cada página; trocado depois, troque-o no roteiro e em todas as páginas. As cores derivadas (`surface`, `line`) saem de `bg` e `ink`.

A família é `"Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`, com peso 800 nos títulos e 500 no texto. A fonte vem da máquina que renderiza: o resultado é estável nela, e a largura das palavras muda de uma máquina para outra. Quantas letras cabem numa linha só se sabe olhando o quadro.

## 7. Empilhar com a geometria

Não chute o `y` do que vem depois de um texto: use o que o helper devolveu. O título pode ter duas ou três linhas, e tudo abaixo dele acompanha.

```js
const title = C.headline(S.title, { y: 176, size: 140 });
const number = C.counter(Object.assign({ x: 72, y: title.bottom + 36, size: 300 }, S.counter));
C.body(S.text, { y: number.bottom + 20, size: 48, maxWidth: 900, out: 2, back: 8.5 });
```

Numa lista, some a altura de cada item a um `y` que anda:

```js
let y = title.bottom + 44;
S.cards.forEach((card, i) => {
  const k = { out: S.out, back: S.back + i * S.step, in: "rise" };
  C.card(Object.assign({ x: 72, y, w: 936, h: 150, radius: 24 }, k));
  C.headline(card.n, Object.assign({ x: 112, y: y + 40, size: 64, color: "accent" }, k));
  C.body(card.text, Object.assign({ x: 232, y: y + 48, size: 50, maxWidth: 740 }, k));
  y += 174;
});
```

O cartão e os textos dele recebem os mesmos tempos (`k`), para entrarem e saírem juntos; `S.step` é a distância, em batidas, entre a volta de um cartão e a do seguinte (1,5 no exemplo).

## 8. Os três modelos e o exemplo

O `new` grava um modelo por papel. Todos têm o rótulo opcional em `y: 96`, o título em `y: 176`, a luz de fundo, o pulso do fundo, a régua em `y: 1140` e as pílulas. E os três seguem a mesma ideia de movimento: o texto de apoio sai logo no começo (`textOut`, batida 0,5) e volta uma linha por batida a partir de `textBack` (batida 2), e mais um gesto acontece perto do fim. Os momentos deixados em `null` no bloco `SLIDE` são calculados a partir das batidas do slide (`BEATS`).

| Modelo | O gesto perto do fim | O que editar |
|---|---|---|
| gancho (`hook`) | o título (176 px; a primeira linha em `accent` quando há `\n`) sai 5 batidas antes do fim e volta com `slam` 3 batidas antes do fim: num slide de 3 compassos, sai na 7 e volta na 9 | `title` em até 3 linhas; `text`, que o `new` deixa vazio, com até três frases curtas, uma por linha; `label` |
| ponto (`point`) | o título (140 px) sai 5 batidas antes do fim e volta subindo (`rise`) 3 antes | `label`, `title`, `text` (60 px); troque o texto pelo recurso do slide copiando do exemplo |
| chamada (`cta`) | o título (150 px) sai uma batida antes da metade do slide (na batida 4, no mínimo) e volta com `slam` 2 batidas depois; o botão some encolhendo 4 batidas antes do fim e estoura de volta (`pop`) na batida seguinte. Num slide de 4 compassos: título na 7 e na 9, botão na 12 e na 13. O botão pulsa nas cabeças de compasso; não há dica de deslizar | `title`; `text` (54 px), o que a pessoa ganha; `button`, com a palavra em maiúsculas |

No gancho e no ponto, o risco sob o título sai com o texto e volta meia batida antes dele. Os textos de amostra que o `new` grava ("Ponto 1: uma ideia só", "Duas linhas curtas que explicam a ideia.", "Comente PALAVRA e eu te mando", "Salve para rever depois.", "Comente AQUI") são sempre para trocar.

O exemplo completo (cinco slides, tema `noir`) fica em `.flyee/modules/motion-carousel/references/exemplo/`; `new <nome> --from-example` o copia inteiro para um carrossel. Copie dele o padrão de que o slide precisa:

| Padrão | Onde | O essencial |
|---|---|---|
| frases de apoio que voltam uma por batida; título que sai e volta com impacto | `slides/01.html` | texto com `perLine: 1, out: S.textOut, back: S.textBack`; título com `out: 7, outStyle: "rise", back: 9, in: "slam"` |
| contador e gráfico de barras | `slides/02.html` | `C.counter` com `out: 2, back: 4, beats: 4`; `C.bars` com `out: 2, back: 4.5, perBar: 1` |
| a bola que pula e perde impulso | `slides/03.html` | `C.ball` com `at: 2, beats: 4, back: 7, hops: [2, 1.25, 0.75]`; a linha de chão é um `C.shape` com `in: "none"` |
| cartões que voltam um a um | `slides/04.html` | o laço da seção 7: cartões de volta na 3, na 4,5 e na 6; perto do fim, o título sai na 7 e volta na 9 (`outStyle: "rise"`, `in: "rise"`), junto com a frase de fecho |
| chamada final com o botão que estoura de novo | `slides/05.html` | `C.cta(S.button, { y: 0.7, size: 58, pulse: true, out: 12, outStyle: "shrink", back: 13, in: "pop" })` |

## 9. Um logo ou uma imagem do integrante

A biblioteca não tem helper de imagem. Um arquivo que o integrante deixou em `assets/` entra pelo canvas: ponha um `<img>` escondido na página, para o navegador carregá-lo antes do primeiro quadro, e desenhe-o em `seek`. Um cartão transparente no mesmo retângulo, com `role: "logo"`, registra a caixa para a conferência.

```html
<canvas id="c" width="1080" height="1350"></canvas>
<img id="logo" src="../assets/logo.png" alt="" style="display: none">
```

```js
const logo = document.getElementById("logo");
if (logo.naturalWidth) {
  C.g.drawImage(logo, 72, 820, 240, 120);
  C.card({ x: 72, y: 820, w: 240, h: 120, color: "rgba(0,0,0,0)", role: "logo", in: "none" });
}
```

Mantenha a proporção do arquivo (`logo.naturalWidth` e `logo.naturalHeight`). O `render` guarda a assinatura de cada arquivo de `assets/` que a página cita (`assets/<nome>`): trocar o logo refaz esse slide no próximo `render`, sem `--refresh`.

## 10. As caixas e a conferência

Cada helper registra, enquanto o elemento está visível, uma caixa `{ role, x, y, w, h, size, text }` com a medida real do que desenhou. Textos e rótulos de gráfico entram com `role: "text"` e o tamanho da fonte em `size`; cartões, formas, régua, pílulas, bola e o fundo do botão, com `role: "ui"`. `window.boxes(t)` devolve a lista do instante pedido.

A conferência (`accept`) abre a página, lê as caixas a cada 0,25 s, em cada batida e no último quadro, e mede:

| Item | O que exige |
|---|---|
| `first_frame_readable` | no quadro 0, pelo menos um texto com 44 px ou mais |
| `safe_area` | toda caixa `text` ou `logo`, em todo instante lido, dentro da margem de 72 px e fora dos dois cantos; as caixas `ui` não entram |
| `text_size` | o menor texto: reprova abaixo de 26,4 px, avisa abaixo de 44 |
| `loop_seamless` | o último quadro igual ao primeiro (semelhança de 0,985 para passar; avisa a partir de 0,95) |

Quando o vídeo final do slide existe (`out/NN.mp4`), a conferência mede também, no vídeo, as piscadas (`flashes`), os trechos parados (`dead_time`) e o volume (`loudness`); o que fazer com cada um está em `design-rules.md`, seção 5, e em `sound.md`, seção 4.

Sem caixas não há o que medir: por isso todo texto passa pelos helpers. O que você escreve com `C.g.fillText` não é visto, e pode estar pequeno ou fora da área segura sem que nada acuse. Os números da régua e os valores acima das barras são os únicos textos sem caixa própria.

Os slides não declaram cortes, e o item `cuts_on_beat` fica como `skip`. Para a conferência medir os gestos principais contra as batidas, declare-os depois do `setup`: `C.film.cuts = [C.beat(8), C.beat(10)];`. Só vale com a trilha gerada: com a música do integrante a grade do arquivo não começa em zero.

## 11. Olhar um slide sozinho

Não é preciso renderizar para ver. O comando `frames` do Motor fotografa a página nos instantes pedidos e monta uma folha de contato; funciona logo depois do `new`.

```
node .flyee/modules/video-render/scripts/render.mjs frames carrosseis/<nome>/slides/02.html --every 0.5 --format 4:5 --out carrosseis/<nome>/previa/quadros-02 --json
```

`--every` é a duração de uma batida em segundos (`60 / bpm`: 0,5 a 120 BPM), o que dá um quadro por batida; `--format` é o `format` do roteiro. O resultado traz `sheet` (a folha, `folha.png` na pasta de `--out`, 6 quadros por linha, na ordem do tempo), `frames[]` (cada `file` é um PNG em tamanho real, com o `time`) e `warnings` (erros que a página registrou). Abra a folha e olhe. Os detalhes pequenos não se leem na folha: abra o `quadro-0001.png` (a capa) em tamanho real.

Instantes exatos no lugar de `--every`: `--times 0,5.967` fotografa a capa e o último quadro de um slide de 6 s (a duração menos um quadro), para comparar a emenda do loop. `--tile-width 540 --cols 4` monta uma folha com quadros maiores.

Aberta num navegador comum, a página toca sozinha, sem som: espaço pausa, as setas andam um quadro, Home volta ao começo.

## 12. O que nunca fazer

- `setTimeout`, `setInterval`, `requestAnimationFrame`, `Date.now()`, `performance.now()`: o tempo é só o `t` de `seek`.
- `Math.random`: use `C.noise(x)` ou um `Motion.rng(S.seed)` criado dentro de `seek`.
- `transition` e `animation` no CSS, ou elementos do DOM com texto: tudo é desenhado no canvas, pelos helpers.
- Guardar estado entre quadros (um contador que soma a cada `seek`).
- Um título com `at > 0`: a capa fica sem ele.
- `out` sem `back` num elemento da capa, ou `out` e `back` num elemento com `at > 0`: o loop salta.
- Mudar o tamanho do canvas, a duração ou o `fps` fora do `setup`.
- Texto por `C.g.fillText`, ou abaixo de 44 px.
- Texto de amostra dos modelos esquecido na página ("Ponto 1: uma ideia só", "Comente AQUI").
