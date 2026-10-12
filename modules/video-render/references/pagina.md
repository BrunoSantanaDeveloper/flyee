# A página que vira vídeo

O Motor de vídeo não anima nada sozinho: ele abre uma página HTML num navegador sem janela, pede o quadro de cada instante e junta os quadros num vídeo. A página é um programa que desenha o tempo. Este guia é o contrato entre a página e o Motor.

## O contrato em quatro linhas

1. A página declara o filme: `window.film = { duration, width, height, fps, background }`.
2. A página desenha qualquer instante: `window.seek(t)` pinta o quadro do segundo `t` e termina (pode devolver uma promessa quando espera um vídeo ou uma imagem).
3. O mesmo `t` dá sempre o mesmo quadro: sem `setTimeout`, sem `requestAnimationFrame`, sem transições de CSS, sem `Math.random`, sem estado carregado de um quadro para o outro.
4. Durante o render, `window.__FLYEE_RENDER__` é `true`. Qualquer prévia ao vivo da página só roda quando ele não existe.

Inclua `motion.js` (o comando `scaffold` o copia para a pasta da página) e chame `Motion.setup({...})`: ele declara o `film` e, no navegador comum, liga uma prévia ao vivo com espaço para pausar e setas para andar um quadro.

## Esqueleto mínimo

```html
<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<style>html,body{margin:0;background:#141413}canvas{display:block}</style></head>
<body>
<canvas id="c" width="1080" height="1920"></canvas>
<script src="motion.js"></script>
<script>
  const film = Motion.setup({ duration: 15, width: 1080, height: 1920, fps: 30, background: "#141413" });
  const g = document.getElementById("c").getContext("2d");
  window.seek = (t) => {
    g.fillStyle = film.background; g.fillRect(0, 0, 1080, 1920);
    const s = Motion.springBy("heavy", t - 0.2);       // mola de forma fechada, 0→1
    g.fillStyle = "#F0EEE6"; g.font = "800 200px sans-serif"; g.textAlign = "center";
    g.fillText("Olá", 540, 960 + (1 - s) * 200);
    return true;
  };
</script>
</body></html>
```

## O que o Motor lê e chama

| Na página | Para quê |
|---|---|
| `film.duration` (s) | quantos quadros renderizar; `--end` pode encurtar |
| `film.width`, `film.height` (px) | o tamanho do quadro quando nenhum `--format` é dado |
| `film.fps` | a taxa padrão; `--fps` na linha de comando tem prioridade |
| `film.background` | a cor de fundo declarada; `"transparent"` para uma camada com transparência |
| `film.cuts` (array de segundos) | os cortes, para o aceite medir se caem na batida |
| `window.seek(t)` | o quadro do instante `t`; o Motor espera a promessa, se houver |
| `window.setFormat({ name, width, height })` | opcional; chamado antes do primeiro quadro só quando `--format` pede um tamanho diferente do que a página declara; a página recompõe o layout, nunca corta |
| `window.boxes(t)` | opcional; devolve `[{ role, x, y, w, h, size }]` com `role` em `text`, `logo`, `face`, `ui`, para a conferência de zonas seguras e de legibilidade; em páginas DOM, `Motion.domBoxes()` monta a lista dos elementos com `data-role` |

## Canvas ou DOM

- **Canvas** é o caminho mais rápido e previsível: tudo é desenhado em `seek(t)`. Use `Motion.fitText`, `Motion.wrapText` e `Motion.roundRect`.
- **DOM** funciona igual: em `seek(t)` você define `style.transform`, `style.opacity`, texto e classes a partir de `t`. Nunca use `transition` nem `animation` no CSS, porque elas correm no relógio do navegador, não no do filme. Marque os elementos com `data-role="text|logo|face|ui"` e devolva `Motion.domBoxes()` em `window.boxes`.
- Evite `filter: blur()` em áreas grandes e `will-change` no que a câmera aproxima: fica lento e borra o texto.

## Movimento

- **Molas, não curvas fixas.** `Motion.spring(t, k, d)` e os presets `Motion.springBy("snappy" | "default" | "heavy" | "playful" | "type", t)`. UI ágil tem um rebote mínimo; tipografia e logo não rebatem.
- **Vários alvos num valor** (um cursor, a largura de um contêiner): `Motion.track(t, [[tempo, valor], ...])` soma uma mola por mudança; nada reinicia.
- **Antecipação → rajada → assentamento:** `Motion.anticipate(t, duração)`.
- **Grade de batidas:** `Motion.beatGrid(bpm, offset)` devolve `beat(n)`, `bar(compasso, tempo)`, `nearest(t)`, `pulse(t)`. Cortes e entradas caem em `grid.beat(n)`; arredonde ao quadro com `Motion.toFrame(t, fps)`.
- **Ruído com semente:** `Motion.rng(semente)` e `Motion.noise1d(semente)`. Nunca `Math.random`.
- **Loop:** `Motion.loopT(t, duração)`; o último quadro igual ao primeiro, inclusive a posição do cursor.

## Vídeos e imagens dentro da página

- `<video muted playsinline src="arquivo.mp4">`: chame `await Motion.loadVideo(video)` uma vez (no carregamento) e, em `seek(t)`, `await Motion.seekVideo(video, t - inicio)` antes de desenhar ou de deixar o elemento visível. O Motor espera a promessa de `seek`. Caminhos relativos à página funcionam.
- Imagens: carregue antes (`await img.decode()`) e desenhe em `seek`. Fontes locais com `@font-face` são esperadas pelo Motor (`document.fonts.ready`) antes do primeiro quadro.
- A câmera do integrante entra assim: um `<video>` buscado por quadro, recortado com `clip-path` ou desenhado no canvas com máscara (círculo, retrato, lado a lado) e posicionado por molas.

## Camada transparente

Para um vídeo que será composto em outro editor por cima da gravação: `background: "transparent"` no `film`, `html, body { background: transparent }`, nenhum preenchimento de fundo em `seek`, e `render --alpha --out camada.mov` (ProRes 4444) ou `.webm`.

## Formatos

Renderizar a mesma página em 9:16, 4:5, 3:4, 1:1 e 16:9 pede `window.setFormat`: a página recebe o novo tamanho e recompõe (texto maior, colunas que viram linhas), em vez de ser cortada. No tamanho que a própria página declara, `setFormat` não é chamado. `Motion.safeArea(formato)` devolve a área onde texto, logo e rosto ficam longe dos botões das redes; em 4:5 e 3:4 ela já respeita a margem de 72 px do carrossel do Instagram e fica fora dos cantos do contador "1/N" e do botão de som.

## Como o Motor renderiza

- `render pagina.html --out video.mp4 --fps 30` chama `seek(t)` em `t = inicio + n / fps` e fotografa cada quadro. `--sub 2` ou `--sub 4` fotografa subquadros e os mistura em desfoque de movimento.
- `preview` renderiza em metade do tamanho, com quadros JPEG, para conferir rápido.
- `frames` fotografa instantes escolhidos (ou um por batida) e monta a folha de contato.
- Quadros são determinísticos: `frames_hash` igual significa vídeo igual. Erros de JavaScript na página aparecem em `warnings`.
