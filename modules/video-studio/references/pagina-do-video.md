# A página do vídeo

O vídeo é uma página HTML que desenha qualquer instante: o Motor de vídeo abre a página num navegador sem janela, pede o quadro de cada instante e junta os quadros. Este guia mostra como o `roteiro.json` vira a `pagina.html`, o que a biblioteca da página (`studio.js`) oferece, como ajustar uma cena à mão sem quebrar nada e o que mantém a conferência do Motor verde. O contrato geral da página com o Motor está em `.flyee/modules/video-render/references/pagina.md`, e o método de animação, em `.flyee/modules/video-render/references/motion.md`.

## 1. Do roteiro à página

O `build` monta a pasta do vídeo assim:

```
estudio-de-video/<vídeo>/
  roteiro.json      as cenas na grade de batidas (references/roteiros.md)
  pagina.html       o modelo do roteiro com o roteiro.json dentro
  motion.js         a biblioteca de tempo do Motor (molas, grade de batidas, ruído com semente)
  studio.js         a biblioteca deste app (os componentes de vídeo)
  assets/           o logo, as telas e as fotos que o roteiro cita
```

A `pagina.html` é um dos quatro modelos (lançamento, interface, oferta, lista) com um bloco de dados preenchido:

```html
<canvas id="c" width="1080" height="1920"></canvas>
<script src="motion.js"></script>
<script src="studio.js"></script>
<script id="roteiro" type="application/json">{ …o roteiro.json, com "</" escrito como "<\/"… }</script>
<script>
  Studio.load();                                             // lê o roteiro, calcula os tempos, carrega as imagens
  const R = Studio.roteiro, TL = Studio.timeline, ST = Studio.style, Q = Studio.Q;
  const film = Motion.setup({ duration: TL.duration, width: R.width, height: R.height, fps: 30, background: Studio.palette.background });
  film.cuts = TL.cuts;                                       // os inícios das cenas 2…n, todos na batida
  const S = Studio.stage(document.getElementById("c"));
  window.setFormat = S.setFormat;
  window.boxes = S.boxes;
  window.seek = S.seek;
  S.scene("gancho", (c) => { /* o desenho do gancho */ });
  // … um desenho por papel de cena
</script>
```

O que a página entrega ao Motor:

| | O que é |
|---|---|
| `film` | duração (a do roteiro), 1080×1920, 30 quadros por segundo, a cor de fundo |
| `film.cuts` | o início de cada cena depois da primeira: o Motor confere se caem na batida |
| `window.seek(t)` | desenha o instante `t`; antes de as imagens carregarem, devolve a promessa da carga e desenha em seguida |
| `window.setFormat({ name, width, height })` | recompõe para 4:5, 1:1 ou 16:9 (o Estúdio entrega 9:16; os outros formatos ficam dentro da área segura e legíveis) |
| `window.boxes(t)` | as caixas do que está na tela em `t`: cada texto (`role: "text"` com `size` em px), o logo (`logo`) e os elementos de interface (`ui`) |

**O `build` reescreve a `pagina.html` a partir do roteiro.** Tudo o que dá para dizer no roteiro (texto, compassos, sons, destaque, rolagem da tela, estilo, cores, fontes) vai no roteiro. Uma mudança feita à mão na página vale até o próximo `build`: guarde-a num arquivo seu e cole-a de novo depois de cada `build` (seção 6).

## 2. `Studio.load()` e o que ele calcula

`Studio.load()` lê o bloco de dados, calcula tudo o que a página precisa e começa a carregar as imagens. Devolve uma promessa (também em `Studio.loading`) que resolve quando a página pode desenhar; uma imagem que não existe ou não abre também resolve, e o componente desenha a alternativa (um celular na cor da marca, um cartão de cor, o nome da marca no lugar do logo). `Studio.load({ roteiro })` aceita o roteiro como objeto, para testes.

| Campo | O que é |
|---|---|
| `Studio.roteiro` | o roteiro como veio, com `width`, `height`, `fps` e `brand` completados |
| `Studio.timeline` | `{ bpm, beats_per_bar, fps, beat_s, bar_s, bars, duration, cuts, scenes }`; cada cena traz `index`, `start`, `end`, `duration`, `beats` e `events` com o tempo absoluto `t` de cada evento |
| `Studio.style` | o estilo do roteiro (references/estilos.md), com `world`, `type` (`scale`, `weight`, `uppercase`, `tracking`, `lineHeight`, `maxLines`), `emphasis`, `frame`, `visual`, `radius`, `shadow`, `hookExit`, `between`, `echo`, `chips`, `cursor`, `detail`, `drift`, `springs` |
| `Studio.palette` | `background`, `surface`, `text`, `accent`, `muted`, `onAccent`, `accentText`, `line` do mundo principal, e `worlds` |
| `Studio.worlds` | `main` e `alt` (o mundo do estilo e o outro), `native` (o da marca), `inverse`, `light`, `dark` |
| `Studio.fonts` | `headline` e `body`, já com as fontes de reserva |
| `Studio.seed` | a semente das variações (a da música, ou uma tirada do título) |
| `Studio.image(caminho)` | a imagem carregada `{ img, w, h, ok }`, ou `null` |
| `Studio.logoImage` | o logo carregado, ou `null` |
| `Studio.logoNote` | `"pequeno"` quando o arquivo de logo é uma imagem de pixels com menos de 80 px de altura: ele ficaria borrado nos 100 px mínimos, e a página usa o nome da marca |

Um **mundo** é um conjunto de cores com leitura garantida: `bg`, `ink` (texto), `surface` (cartões), `muted` (rótulos), `soft` (texto de apoio), `accent`, `accentText` (o acento quando ele é usado como letra grande), `onAccent` (o texto sobre o acento), `light` (verdadeiro num fundo claro).

## 3. O palco

`const S = Studio.stage(canvas)` liga a página ao canvas. Os desenhos se registram por papel de cena:

| Método | Para quê |
|---|---|
| `S.scene(papel, { lead, tail }, (c) => …)` | o desenho de todas as cenas desse papel; `lead` e `tail` (segundos) desenham um pouco antes ou depois da cena, para uma transição |
| `S.sceneAt(n, { lead, tail }, (c) => …)` | o desenho de uma cena só (o `n` do roteiro), no lugar do desenho do papel |
| `S.under((f) => …)` | uma camada do filme inteiro, desenhada logo depois do fundo (uma tela que atravessa várias cenas) |
| `S.over((f) => …)` | uma camada por cima de tudo (o cursor, um trilho de progresso) |
| `S.worlds({ papel: "alt" })` | em que mundo cada papel acontece (`main` por padrão) |
| `S.group({ scale, about, dx, dy, alpha, report }, () => …)` | desenha dentro de uma transformação (escala por igual, deslocamento, transparência); as caixas acompanham; `report: false` não declara caixas |
| `S.box(role, x, y, w, h, size, texto)` | declara uma caixa para a conferência (os componentes já declaram as suas) |
| `S.room(caixa, [x, y])` | quanto uma caixa ainda pode crescer em volta de um ponto sem sair da área segura |
| `S.px(n)` | `n` pixels no tamanho de 1080 de largura, na escala do formato atual |
| `S.type(n)` | o mesmo, nunca abaixo do mínimo legível do formato |
| `S.W`, `S.H`, `S.safe`, `S.area`, `S.minText`, `S.vertical`, `S.format` | o tamanho do quadro, a área segura, a área útil (a área segura com respiro), o menor texto aceito, se o quadro é em pé |

O desenho de uma cena recebe o contexto `c`:

| Campo | O que é |
|---|---|
| `c.t`, `c.b` | o tempo da cena em segundos e em batidas (0 no início dela) |
| `c.dur`, `c.beats` | quanto a cena dura, em segundos e em batidas |
| `c.beat(n)`, `c.since(n)` | o segundo da batida `n`; os segundos desde a batida `n` (negativo antes dela): o argumento das molas |
| `c.hit(tipo, padrão)`, `c.hits(tipo)` | a batida do primeiro evento daquele tipo (ou o padrão); todas as batidas daquele tipo |
| `c.scene`, `c.prev`, `c.next`, `c.index`, `c.count` | a cena (com os campos do roteiro), as vizinhas e a posição |
| `c.world`, `c.area`, `c.safe`, `c.W`, `c.H` | o mundo da cena, a área útil, a área segura e o quadro |
| `c.top(() => …)` | desenha algo por cima de todas as cenas deste quadro |

As camadas (`S.under`, `S.over`) recebem `f`, com `f.T` (o tempo do filme), `f.index` e `f.scene` (a cena do instante), `f.world` e `f.context(j)` (o contexto da cena `j` no mesmo instante).

## 4. Os componentes

Todos desenham no instante do contexto, são funções do tempo e declaram as suas caixas enquanto estão legíveis. Posições e tamanhos em pixels do quadro; tempos em batidas da cena. Quase todos aceitam `world` (outro mundo) e `measure: true` (só calcula a geometria, sem desenhar). Todos devolvem a geometria do que desenharam (`x`, `y`, `w`, `h`, `bottom`…), para o próximo elemento se apoiar nela.

### Texto

`Studio.text(c, texto, opções)` é a base; `Studio.headline` (título, com destaque ligado), `Studio.body` (apoio, entra suave) e `Studio.label` (rótulo em caixa alta) são atalhos.

| Opção | O que faz |
|---|---|
| `x`, `y`, `w`, `h` | a caixa (padrão: a área útil); o texto encontra o maior tamanho que cabe, em linhas equilibradas |
| `size`, `minSize`, `maxLines` | o maior tamanho tentado, o menor aceito (nunca abaixo do mínimo legível) e o máximo de linhas |
| `align`, `valign` | `left`, `center`, `right`; `top`, `middle`, `bottom` |
| `cover: true` | já pousado no início da cena (o primeiro quadro é a capa) |
| `at`, `by`, `stagger`, `in` | entra na batida `at`, por linha, palavra ou bloco (`line`, `word`, `block`), com um atraso entre elas; `in`: `rise` (sobe por trás de uma máscara), `slam` (entra maior e pousa), `fade` |
| `punch` | a batida de um soco (o bloco pousa com um tranco que nunca sai da área segura) |
| `breathe` | `{ amount, every, from }`: o respiro na batida enquanto o texto segura (padrão 1,5% a cada 2 batidas, a partir da batida `from`); nunca passa da área segura |
| `emphasis` | `{ words, at, style, color }`: a palavra em destaque (`block`, um bloco de cor; `underline`, um traço), que chega na batida `at`; `false` desliga |
| `out` | `{ at, style, dir }`: como sai; `zoom` (a câmera atravessa a palavra-chave, cujas bordas viram riscos), `whip` (chicote na direção `dir`, com rastro), `lift` (cada linha sobe por trás da máscara), `cut` (padrão: some no corte) |
| `color`, `weight`, `uppercase`, `font`, `lineHeight` | aparência; `font: S.numberFont()` dá algarismos alinhados para números grandes |

### Elementos de cena

| Componente | O que desenha | Opções principais |
|---|---|---|
| `Studio.background(c)` | o fundo do mundo com uma forma enorme a 3% de contraste, derivando devagar (o palco já desenha) | `world` |
| `Studio.drift(c, quanto)` | a escala de uma cena parada: de 1 até 1 + `quanto` (até 0,03) ao longo da cena; use num `S.group` | nenhuma |
| `Studio.born(c, batida)` | a escala da cena nova depois de uma travessia (nasce em 55% e pousa em 12 quadros) | nenhuma |
| `Studio.bump(c, every, from)` | o respiro na batida: 1 em cada batida `from`, `from + every`, … e 0 no resto; multiplique por 1 a 3% de escala para manter viva uma cena que segura | nenhuma |
| `Studio.chip(c, texto, o)` | uma etiqueta em pílula que nasce esticando de um círculo | `x`, `y`, `align`, `at`, `size`, `color`, `out: { at, style: "cut" \| "whip" \| "streak" }` (a etiqueta que estica até virar um risco) |
| `Studio.device(c, o)` | uma tela real dentro de um celular (`kind: "phone"`) ou de uma janela (`"window"`), com sombra | `rect` (a tela), `image`, `scroll` (0 a 1, ou uma função para o borrão da rolagem), `blur`, `zoom`, `anchor`, `assemble` (0 a 1: a tela se monta em faixas), `fill` e `monogram` (sem imagem) |
| `Studio.card(c, o)` | um cartão com uma foto recortada, ou de cor | `rect`, `image`, `color`, `zoom` (a deriva entra aqui), `anchor` |
| `Studio.cursor(f, o)` | o cursor que anda por uma trilha e aperta | `keys: [[segundo, x, y], …]`, `presses: [segundo, …]`, `until`, `kind: "arrow" \| "touch"`; os tempos na mesma base de `f.t` |
| `Studio.counter(c, o)` | um número que rola até o valor e fica (dígitos em colunas, ponto no milhar, vírgula nas casas) | `value`, `prefix`, `suffix` (uma palavra sai menor ao lado), `decimals`, `at`, `beats` (padrão 1), `ticks` (um passo por batida da lista), `x`, `y`, `w`, `h`, `size`, `breathe` |
| `Studio.price(c, o)` | o preço: moeda e centavos menores, o valor antigo riscado acima, soco na entrada | `value` e `old` (número ou texto como "R$ 199,90"), `at`, `oldAt`, `x`, `y`, `w`, `h`, `align`, `breathe` |
| `Studio.listItem(c, o)` | um item numa linha: o índice num círculo, o texto e o detalhe | `index`, `text`, `detail`, `x`, `y`, `w`, `at`, `size` |
| `Studio.rail(f, o)` | um trilho de progresso em trechos | `n`, `index`, `fill` (0 a 1 do trecho atual), `x`, `y`, `w`, `h` |
| `Studio.button(c, texto, o)` | um botão na cor de destaque, com a chamada em uma ou duas linhas; aperta nas batidas de `press` | `rect` (para acompanhar um elemento que se transforma), ou `x`, `y`, `w`, `align`; `at`, `press`, `textAlpha`, `breathe` |
| `Studio.logo(c, o)` | o logo, com 100 px de altura ou mais; só corta, aparece, desliza e muda de tamanho por inteiro; um logo de pixels cresce no máximo 25% além do tamanho do arquivo (um SVG cresce à vontade); sem arquivo usável, o nome da marca na fonte do título | `x`, `y`, `w`, `h`, `align`, `valign`, `at`, `in: "cut"`, `plate` (a cor onde ele pousa: ganha uma chapa se sumiria nela) |
| `Studio.lockup(c, o)` | o fecho: o logo e a chamada, parados | `text`, `words` (o destaque), `logo`, `at`, `textAt`, `button`, `press`, `breathe` |
| `Studio.check(c, o)` | um sinal de certo que se desenha | `cx`, `cy`, `r`, `at`, `color`, `width` |
| `Studio.bars(c, o)` | barras que crescem uma a uma (sem valores, um desenho crescente, sem eixo nem número) | `x`, `y`, `w`, `h`, `values`, `at`, `stagger` |
| `Studio.skeleton(c, o)` | barras cinzas no lugar de texto de preenchimento (ilegíveis de propósito) | `x`, `y`, `w`, `rows`, `size`, `at` |

### Transições conduzidas por um elemento

| Função | O que faz |
|---|---|
| `Studio.dive(c, { from, at, frames })` | o mergulho: o retângulo `from` cresce até cobrir o quadro e pousa exatamente na batida `at`; devolve `{ rect, wash }` (desenhe o seu elemento em `rect` e cubra-o com a cor da cena seguinte na transparência `wash`) |
| `Studio.flood(c, { from, color, at })` | o mesmo mergulho para um elemento de cor chapada |
| `Studio.whip(c, { at, dir, distance })` | o chicote: devolve `{ dx, dy, alpha, echoes }`; desenhe o grupo uma vez por eco (por baixo) e uma vez no lugar |
| `out` do texto e da etiqueta | `zoom`, `whip`, `lift` e `streak`, como na tabela de texto |

### Funções puras

`Studio.computeTimeline(roteiro)`, `Studio.derivePalette(cores, "dark" | "light" | "native")`, `Studio.contrast(a, b)`, `Studio.readableOn(fundo, candidatas)`, `Studio.mix`, `Studio.rgba`, `Studio.formatNumber(1234.5)` ("1.234,5"), `Studio.parseAmount("12x de R$ 49,90")`, `Studio.fitText(medir, texto, opções)`, `Studio.pickEmphasis(palavras, pista)`, `Studio.safeRect(largura, altura)`, `Studio.rectAt(t, [[tempo, retângulo], …])` e `Studio.valueAt(t, [[tempo, valor], …], mola)` (um valor com vários alvos, uma mola por mudança), `Studio.frameFor(imagem)` (celular ou janela), `Studio.scrollFor(imagem, tela, posição)`, `Studio.styleFor(id, roteiro)`, `Studio.roundRect`.

## 5. As regras que mantêm a conferência verde

O Motor confere a página com `accept` (`--format 9:16 --safe instagram-feed` e as batidas da trilha). Os modelos passam em tudo; uma mudança à mão precisa manter:

- **O primeiro quadro é a capa.** O texto principal da primeira cena está pousado em `t = 0` (`cover: true`), com 44 px ou mais. O movimento acontece em volta dele: um soco, o destaque que chega, a saída.
- **Nada fora da área segura.** Texto e logo dentro de `c.area` (a área segura com respiro). Fundos, cartões e telas podem sangrar; texto nunca. Um texto que cresce enquanto ainda é lido usa `S.room` para não passar da borda.
- **Texto grande.** Nada abaixo de 44 px no vertical (`S.type(n)` e `minSize` garantem); se não cabe, corte palavras, nunca diminua.
- **Cortes na batida.** `film.cuts` é `Studio.timeline.cuts`; a duração das cenas vem do roteiro. Não mude tempos na página: mude os compassos no roteiro.
- **Toda caixa declarada.** Desenhe texto pelos componentes; um `fillText` solto precisa de `S.box("text", x, y, largura, altura, tamanho, texto)`, senão a conferência não o vê.
- **Sempre algo vivo.** Uma cena que segura usa `Studio.drift` (até 3%) e um respiro na batida (`breathe` ou `Studio.bump`), e algo novo acontece a cada 2 a 4 segundos; a deriva sozinha é lenta demais para a conferência de tempo parado do vídeo.

E o que mantém o vídeo determinístico (o mesmo instante dá sempre o mesmo quadro, e dois renders dão a mesma assinatura `frames_hash`):

- Nada de `Math.random`, `Date`, `setTimeout`, `setInterval`, `requestAnimationFrame` ou animação de CSS. Variação vem de `Motion.rng(Studio.seed)` e `Motion.noise1d(Studio.seed)`.
- Nenhum estado guardado de um quadro para o outro: tudo sai de `c.t`, `c.b` ou `f.T`.
- Imagens só as que o roteiro cita (`screen`, `image`, `brand.logo`), carregadas antes do primeiro quadro; `Studio.image(caminho)` devolve `null` para as outras.

## 6. Ajustar uma cena à mão

Primeiro, tente pelo roteiro: o texto, a palavra em destaque (`emphasis`), a parte da página que a tela mostra (`scroll`), os compassos, os sons (que também marcam a imagem: `impact`, `pop`, `click`, `tick`), o estilo. Depois do `build`, faça a prévia de novo.

Quando o desenho precisa mudar, troque o desenho de uma cena só com `S.sceneAt`, no fim do script da página (depois dos desenhos do modelo), e guarde o trecho num arquivo seu para colar de novo depois de um `build`:

```js
// Cena 4: o recurso vira uma comparação "antes e depois" em dois cartões, sem tirar nada do roteiro.
S.sceneAt(4, { tail: 2 * Q }, (c) => {
  const A = c.area;
  const title = Studio.headline(c, c.scene.text, { x: A.x, y: A.y, w: A.w, h: A.h * 0.3, at: 0, by: "line", stagger: 0.25, out: { at: c.beats, style: "whip", dir: [0, -1] } });
  const top = title.bottom + S.px(60), h = A.y + A.h - top, w = (A.w - S.px(40)) / 2;
  const enter = (n) => Motion.springBy("default", c.since(n));        // cada cartão entra numa batida
  S.group({ dy: (1 - enter(1)) * S.px(200), alpha: Motion.clamp(enter(1) * 2) }, () => {
    Studio.card(c, { rect: { x: A.x, y: top, w, h }, color: c.world.surface });
    Studio.label(c, "Antes", { x: A.x + S.px(30), y: top + S.px(30), w: w - S.px(60), h: S.px(80), cover: true });
  });
  S.group({ dy: (1 - enter(2)) * S.px(200), alpha: Motion.clamp(enter(2) * 2) }, () => {
    Studio.card(c, { rect: { x: A.x + w + S.px(40), y: top, w, h }, color: c.world.accent });
    Studio.label(c, "Depois", { x: A.x + w + S.px(70), y: top + S.px(30), w: w - S.px(60), h: S.px(80), cover: true, color: c.world.onAccent });
  });
});
```

No lançamento, a tela do produto é uma camada do filme inteiro (`S.under`) e continua aparecendo nas cenas de recurso (com a imagem do próprio recurso, ou com a tela do produto quando ele não tem imagem): o desenho trocado à mão fica por cima dela, então deixe a metade de baixo da área útil livre ou cubra a tela de propósito.

O mesmo vale para mudar o desenho de todas as cenas de um papel: `S.scene("ponto", …)` registrado depois do modelo substitui o dele. Para uma camada nova do filme inteiro, `S.under` ou `S.over`.

Não crie papéis novos no roteiro: o `build` só aceita os papéis do modelo. Uma "cena nova" é uma cena do roteiro com o desenho trocado por `S.sceneAt`.

## 7. Conferir

```
node .flyee/modules/video-render/scripts/render.mjs frames estudio-de-video/<vídeo>/pagina.html --every 0.5 --scale 0.5 --json
node .flyee/modules/video-render/scripts/render.mjs accept estudio-de-video/<vídeo>/pagina.html --format 9:16 --safe instagram-feed --bpm <bpm> --json
```

Abra a folha de quadros (`folha.png`) e olhe de verdade antes de dizer qualquer coisa sobre o vídeo; depois rode a conferência. Para ver uma transição de perto, peça os quadros em volta de um corte: `--times` com o instante do corte menos 8 quadros até mais 3 (um quadro = 1/30 s).

## 8. Problemas comuns

| O que aparece | Causa provável | O que fazer |
|---|---|---|
| erro "a página ainda não recebeu o roteiro" | o bloco de dados ficou com o marcador do modelo | rode o `build` de novo |
| erro "o roteiro da página não é um JSON válido" | o roteiro foi colado à mão com um erro, ou com `</` sem a barra invertida | corrija o `roteiro.json` e rode o `build` |
| uma imagem não aparece; no lugar, um celular de cor ou um cartão liso | o caminho em `screen`, `image` ou `brand.logo` não existe em `assets/`, ou o arquivo está corrompido | confira o arquivo em `assets/` e o caminho no roteiro; a alternativa é de propósito, para o vídeo nunca quebrar |
| o logo aparece numa chapa | o logo tem a cor do fundo em que pousa | peça ao integrante a versão do logo para fundo escuro ou claro, ou mantenha a chapa |
| no lugar do logo aparece o nome da marca, mesmo com o arquivo em `assets/` | o arquivo é uma imagem de pixels pequena demais (`Studio.logoNote` é `"pequeno"`) | peça ao integrante o logo em SVG ou em PNG com pelo menos 200 px de altura |
| `first_frame_readable` reprovado | a primeira cena foi trocada por um desenho sem texto pousado em `t = 0` | use `cover: true` no texto principal da primeira cena |
| `safe_area` reprovado | um texto desenhado à mão passou de `c.area`, ou cresce além da borda | posicione dentro de `c.area`; limite crescimentos com `S.room` |
| `text_size` com aviso ou reprovado | texto demais numa caixa pequena | corte palavras (os limites do roteiro existem por isso) ou dê mais altura à caixa |
| `cuts_on_beat` reprovado | o `bpm` da conferência não é o do roteiro, ou um tempo foi mudado na página | passe o `--bpm` do roteiro; mude compassos só no roteiro |
| o render dá `frames_hash` diferente a cada vez | um trecho à mão usa sorteio, relógio ou temporizador | troque por `Motion.rng(Studio.seed)` e por funções de `c.t` |
| `browser_timeout` | um trecho à mão espera algo que nunca chega (uma imagem fora do roteiro, uma promessa) | carregue imagens só pelo roteiro; `seek` precisa terminar sozinho |
| texto sobreposto durante uma troca | o texto novo entra antes de o velho sair | use `Motion.swapAlpha(t, entra, sai)` ou as saídas dos componentes |
| a conferência do vídeo avisa tempo parado | uma cena longa que só deriva (a deriva lenta quase não muda os pixels) | um respiro na batida no protagonista da cena (`breathe`), um elemento que entra numa batida, ou menos compassos |
| números com ponto e vírgula trocados | o número veio como texto num campo que pede número | em `prova`, `value` é número (`12000`); em `preco`, o texto como se escreve ("R$ 199,90") também vale |
