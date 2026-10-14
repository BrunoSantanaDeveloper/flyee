# Como animar bem

O método por trás de um vídeo que parece caro: a física do movimento, as molas, a gramática das transições, o ritmo, a tipografia, a marca e o loop de crítica. Vale para toda página que o Motor renderiza. O contrato da página está em `pagina.md`; a biblioteca `motion.js` (copiada para a pasta da página pelo `scaffold`) tem todas as funções `Motion.*` usadas aqui. A música e os efeitos estão em `som.md`; os formatos, em `formatos.md`.

Convenções deste guia: quadros ("q") a 30 fps, 1 q = 0,033 s. Nas receitas:

```js
const q = 1 / film.fps;                                  // um quadro
const grid = Motion.beatGrid(beats.bpm, beats.offset);   // a grade da trilha (beats.json, veja som.md)
// T = o instante do evento (o quadro em que a mudança "bate"), sempre vindo da grade: T = grid.beat(n)
```

Toda receita é uma função pura de `t`: `Motion.phase(t, de, até)` dá o progresso 0→1 entre dois instantes, `Motion.ease.*` dá a curva, `Motion.springBy(papel, t - T)` dá a mola. Nada de temporizador, nada de estado entre quadros, nada de `Math.random`.

## 1. As seis leis da física do movimento

1. **Antecipação → rajada → assentamento.** Toda mudança forte tem três partes: de 8 a 10 q de antecipação (um avanço lento, ease-in), de 3 a 4 q de rajada (o que de fato muda) e de 12 a 15 q de assentamento (ease-out exponencial). A rajada é curta; o assentamento é longo. O que desliza de A para B em velocidade constante parece slide, não filme.
2. **Desfoque só na rajada.** Parado é nítido; lento é nítido; só o que atravessa mais de uma largura própria por quadro borra. Renderize a versão final com `--sub 2` (ou `--sub 4` num filme de chicotes muito rápidos): o Motor mistura subquadros e o que corre borra sozinho, enquanto o que está parado continua nítido. Custa duas ou quatro vezes o tempo de render; a prévia dispensa. Rastro desenhado (o "eco" do §3) só em um a três elementos por filme.
3. **Continuidade de vetor.** O que entra na cena nova entra na direção em que a cena velha saiu. Saiu para cima, o próximo entra de baixo; saiu pela esquerda, o próximo vem da direita.
4. **O elemento vira a transição.** Não existe camada de "transição": um elemento da cena muda de papel. O texto vira risco, o cartão vira tela, a tela vira cartão, a etiqueta vira risco. O olho sempre tem um condutor para seguir.
5. **Deriva só nas seguras**, até 3% de escala ao longo da segura. Mantém a quase-parada viva sem subir a energia. Fora das seguras, parado é parado.
6. **O soco pousa na batida**, a até 1 q dela (é o que o `accept` exige de todo corte que a página declara), e o drop da música recebe a maior mudança de enquadramento do filme (um cartão que vira a tela inteira, uma câmera que recua para a parede).

A curva das três partes, em volta do evento `T`:

```js
const ant = Motion.ease.inQuad(Motion.phase(t, T - 14 * q, T - 4 * q));   // 10 q: avança devagar (1,00 → 1,15)
const raj = Motion.ease.inExpo(Motion.phase(t, T - 4 * q, T));            // 4 q: explode
const ass = Motion.ease.outExpo(Motion.phase(t, T, T + 12 * q));          // 12 q: a cena nova pousa
const escala = 1 + 0.15 * ant + 6 * raj;                                  // o que sai
const escalaNova = 0.55 + 0.45 * ass;                                     // o que entra
```

`Motion.anticipate(t - T, duração)` faz o mesmo em uma chamada: recua 8% nos primeiros 30% da duração e dispara em exponencial nos 70% restantes. Serve para uma entrada única; para uma transição com condutor, use as três fases separadas, porque cada uma mexe em coisas diferentes.

## 2. Molas, não curvas

Uma curva fixa vai de A a B no tempo que você mandou. Uma mola tem massa: acelera, passa um fio do alvo (ou não) e assenta. `Motion.spring(t, k, d)` é a mola de forma fechada: `k` é a rigidez, `d` o amortecimento, e o resultado é 0→1 em função só de `t`, calculável em qualquer quadro sem simular os anteriores. Os presets, medidos:

| Preset | k, d | Rebote | Assenta (1%) | Para quê |
|---|---|---|---|---|
| `snappy` | 320, 30 | 0,8%, imperceptível | 7 q (0,24 s) | botões, etiquetas, alternadores, a borda da frente de um indicador |
| `default` | 170, 26 | nenhum | 15 q (0,51 s) | cartões, contêineres, a câmera |
| `type` | 120, 24 | nenhum | 18 q (0,61 s) | tipografia: títulos e rótulos |
| `heavy` | 90, 20 | nenhum | 21 q (0,70 s) | tipografia enorme, objetos 3D, o logo no fecho |
| `playful` | 200, 14 | 17%, visível | 19 q (0,62 s) | mascotes, adesivos, ilustração |

Regras:

- **Rebote por papel.** Interface tem um rebote mínimo; tipografia e logo não rebatem nunca; só mascotes e adesivos rebatem de propósito. `playful` em texto ou logo é o erro mais fácil de ver.
- **Uma mola por mudança.** Um valor com vários alvos (a largura de um contêiner, a posição do cursor, uma aba que muda de lugar) não reinicia a mola: `Motion.track(t, [[tempo, valor], ...], k, d)` soma uma mola por mudança, cada uma a partir do próprio tempo. O movimento fica contínuo, e o quadro 812 sai sem calcular os 811 anteriores.
- **Texto dentro de contêiner que muda** entra depois do começo da mudança e sai antes da próxima: `Motion.swapAlpha(t, tEntrada, tSaída)`. Texto que troca no meio da mudança sobrepõe o anterior por alguns quadros: é o defeito nº 1 que a tira de quadros revela.
- **Indicador que estica.** A borda da frente é mais rígida que a de trás: `Motion.indicator(t, [[tempo, x], ...], largura)` devolve `left` e `right`.
- **Comece a mola no evento**, nunca antes: `Motion.springBy("heavy", t - T)` vale 0 até `T` e assenta 0,7 s depois. Um título que "já estava chegando" quando a cena abriu não tem antecipação.

```js
const s = Motion.springBy("heavy", t - T);                       // o título sobe e pousa (sem rebote)
const y = Motion.lerp(H * 0.62, H * 0.5, s);
const escala = 0.9 + 0.1 * s;

const w = Motion.track(t, [[0, 320], [grid.beat(2), 760], [grid.beat(5), 480]], 170, 26);   // três alvos, zero reinício
g.globalAlpha = Motion.swapAlpha(t, grid.beat(2), grid.beat(5));                            // o rótulo da segunda fase
```

## 3. Gramática de transições

Oito transições cobrem um filme inteiro. Cada uma tem anatomia em quadros, um condutor (o elemento que o olho segue) e um lugar no arco. Nas receitas, a cena nova já está desenhada por baixo da que sai; "corte" é só a cena de cima deixando de ser desenhada em `t >= T`. As funções `desenhaCartao`, `desenhaGrupo` e `desenhaPalavra` são as suas funções de desenho.

| | Nome | Anatomia (q) | Condutor | Use quando |
|---|---|---|---|---|
| T1 | Atravessar o texto | 10 + 4 + 12 | a palavra-chave, cujas bordas viram riscos | sair de uma tela de texto; do gancho para a promessa |
| T2 | Botão que vira etiqueta | 8 + 18 + 3 | o "+" que gira 45° e vira "×" | o nascimento de cada capítulo |
| T3 | Baralho que mergulha | 4 + 22 + 15 | o cartão da frente, que vira a tela inteira | entrar na primeira prova; pousar no drop |
| T4 | Tela que vira cartão | 9 + 12 + 3 | a borda da tela, que ganha raio e sombra | trocar de mundo (do escuro para o claro, ou o contrário); sair de uma rajada |
| T5 | Cortina de antes e depois | 8 + 28 + 19 + 38 | a cortina vertical | mostrar transformação; revelar volume (a parede) |
| T6 | Chicote | 2 a 3 | o grupo inteiro, com rastro | corte de mundo numa batida forte |
| T7 | Etiqueta que vira risco | 1 + 4 + corte | a etiqueta esticando até cobrir a tela | da etiqueta para a rajada de amostras |
| T8 | Vazio → frase → soco | 1 + 10 + 28 + 4 + 1 + 15 | a frase, que encolhe antes do soco | o fecho |

**T1 · Atravessar o texto.** 10 q de antecipação (escala 1,00→1,15), 4 q de rajada (escala ×7; a cena de texto some nos 2 últimos quadros; as bordas da caixa da palavra-chave viram dois riscos finos na cor do acento que atravessam o quadro), 12 q de assentamento da cena nova, que nasce em 0,55.

```js
const ant = Motion.ease.inQuad(Motion.phase(t, T - 14 * q, T - 4 * q));
const raj = Motion.ease.inExpo(Motion.phase(t, T - 4 * q, T));
const escalaA = 1 + 0.15 * ant + 6 * raj;
const alfaA = 1 - Motion.phase(t, T - 2 * q, T);                        // sem borrão parado sobrando
const sB = Motion.ease.outExpo(Motion.phase(t, T - q, T + 11 * q));
const escalaB = 0.55 + 0.45 * sB;                                        // desenhe B antes de A
const risco = Motion.ease.inExpo(Motion.phase(t, T - 4 * q, T));         // nasce na borda da caixa (xCaixa) e sai do quadro
const xRisco = xCaixa - W * 1.5 * risco, wRisco = 40 + W * 3 * risco, alfaRisco = 1 - Motion.phase(t, T, T + 2 * q);
```

**T2 · Botão que vira etiqueta.** Um botão redondo com "+" estica na horizontal em 8 q enquanto o "+" gira 45° e vira "×"; o texto rola na vertical dentro da pílula por 18 q, desacelerando, passa por duas opções e trava na certa; a troca para "selecionado" é seca, em 3 q. Desenhe a pílula com `Motion.roundRect` e recorte (`clip`) a janela do texto: o raio é sempre metade da altura, em qualquer largura.

```js
const abre = Motion.springBy("snappy", t - T);                             // 8 q até quase parar
const largura = Motion.lerp(altura, larguraFinal, abre);
const giro = (Math.PI / 4) * abre;                                         // o "+" vira "×"
const rolo = Motion.ease.outQuart(Motion.phase(t, T + 6 * q, T + 24 * q)); // o caça-níquel
const yRolo = -2 * altura * rolo;                                          // sobe duas linhas; a terceira opção é a certa
const selecionado = Motion.phase(t, T + 24 * q, T + 27 * q);               // inverte fundo e texto
```

**T3 · Baralho que mergulha.** O título explode com eco em 3 a 4 q; um baralho de 8 a 14 cartões entra em perspectiva e gira por 22 q (cada cartão 1 q depois do anterior, menor e mais apagado quanto mais atrás); o cartão da frente endireita e cresce até ocupar o quadro em 15 q e **pousa no drop**. Em canvas, a perspectiva é falsa: escala, deslocamento e alfa por índice.

```js
for (let i = N - 1; i >= 1; i--) {                                          // de trás para a frente
  const entra = Motion.ease.outCubic(Motion.phase(t, T - 30 * q + i * q, T - 14 * q + i * q));
  desenhaCartao(i, Motion.lerp(W * 1.3, W * 0.55 - i * 70, entra), H * 0.5 + i * 24, 0.42 - i * 0.03, 1 - i * 0.08);
}
const mergulho = Motion.ease.inOutCubic(Motion.phase(t, T - 15 * q, T));   // termina exatamente no drop
desenhaCartao(0, Motion.lerp(W * 0.3, 0, mergulho), Motion.lerp(H * 0.45, 0, mergulho),
              Motion.lerp(0.42, 1, mergulho), 1, Motion.lerp(40, 0, mergulho));   // o raio vai a zero
```

**T4 · Tela que vira cartão.** A tela cheia encolhe para 88% em 9 q ganhando raio (32 px) e sombra, e o outro mundo aparece em volta; deriva lateral lenta por 12 q; sai em chicote vertical em 3 q; o próximo elemento entra **no mesmo vetor**, em 12 q.

```js
const encolhe = Motion.ease.outCubic(Motion.phase(t, T, T + 9 * q));
const escala = Motion.lerp(1, 0.88, encolhe), raio = 32 * encolhe, sombra = 0.18 * encolhe;
const x = -48 * Motion.phase(t, T + 9 * q, T + 21 * q);                                // deriva linear
const y = -H * 1.3 * Motion.ease.inExpo(Motion.phase(t, T + 21 * q, T + 24 * q));       // chicote para cima
const entra = Motion.ease.outExpo(Motion.phase(t, T + 22 * q, T + 34 * q));
const yProximo = H * 0.4 * (1 - entra);                                                 // vem de baixo, como a tela saiu
```

**T5 · Cortina de antes e depois → parede.** A tela entra empurrando pela lateral em 8 q; segura 28 q (a versão "antes"); em 19 q encolhe para cartão **enquanto uma cortina vertical revela a versão "depois"**; a câmera recua para uma parede de cartões em 38 q. Desenhe o "antes" inteiro, recorte a faixa `[0, W × cortina]` e desenhe o "depois" por cima.

```js
const empurra = Motion.ease.outQuart(Motion.phase(t, T, T + 8 * q));
const xTela = -W * (1 - empurra);
const cortina = Motion.ease.inOutCubic(Motion.phase(t, T + 36 * q, T + 55 * q));
const escala = Motion.lerp(1, 0.5, cortina);                                            // encolhe junto com a cortina
const recua = Motion.ease.outCubic(Motion.phase(t, T + 42 * q, T + 80 * q));
const escalaParede = Motion.lerp(1.9, 1, recua);                                        // um cartão enchia a tela; agora são 20
```

**T6 · Chicote.** O grupo inteiro atravessa o quadro em 2 a 3 q e o corte acontece em `T`, na batida forte. Com `--sub 2` ou `--sub 4` o borrão direcional vem do próprio render; sem ele, desenhe o eco. Um chicote entre o mundo claro e o escuro é uma piscada: no máximo três por segundo em qualquer trecho (o `accept` avisa acima disso).

```js
const posicao = (tt) => -W * 1.5 * Motion.ease.inExpo(Motion.phase(tt, T - 3 * q, T));
for (const [k, alfa] of [[3, 0.12], [2, 0.25], [1, 0.45]]) desenhaGrupo(posicao(t - k * q), alfa);   // eco: 3 cópias atrasadas
desenhaGrupo(posicao(t), 1);
```

**T7 · Etiqueta que vira risco → corte.** A etiqueta parada estica em X (×1,3) em 1 q, vira um risco de tela inteira (×9 em X, achatando a 55% em Y) em 4 q, e o corte duro acontece atrás do risco, na batida.

```js
const estica = 1 + 0.3 * Motion.phase(t, T - 5 * q, T - 4 * q);
const risco = Motion.ease.inExpo(Motion.phase(t, T - 4 * q, T));
const escalaX = estica + 8 * risco, escalaY = 1 - 0.45 * risco;          // em t >= T a cena nova já está por baixo
```

**T8 · Vazio → frase → soco.** 1 q de fundo vazio; as palavras entram da direita em cascata (10 q cada, 2 q entre elas); a frase segura encolhendo devagar de 1,0 a 0,82 por 28 q; encolhe rápido por 4 q (antecipação) e some; **soco**: a frase final entra a ×1,45 em 1 q, com um risco do acento, e assenta a ×0,9 em 15 q. O soco cai no tempo 1 do último compasso.

```js
palavras.forEach((p, i) => {
  const e = Motion.ease.outExpo(Motion.phase(t, T0 + i * 2 * q, T0 + (10 + i * 2) * q));
  desenhaPalavra(p, xBase + 260 * (1 - e), e);                                          // da direita, com alfa = e
});
const segura = Motion.lerp(1, 0.82, Motion.ease.inOutSine(Motion.phase(t, T0 + 10 * q, T0 + 38 * q)));
const some = Motion.ease.inExpo(Motion.phase(t, SOCO - 4 * q, SOCO));
const escalaFrase = segura * (1 - 0.7 * some), alfaFrase = 1 - some;
const assenta = Motion.ease.outExpo(Motion.phase(t, SOCO + q, SOCO + 16 * q));
const escalaSoco = t < SOCO ? 0 : Motion.lerp(1.45, 0.9, assenta);
```

**Eco (rastro de cópias).** Em vez de desfoque, desenhe o mesmo elemento em `t - 1q`, `t - 2q` e `t - 3q` com alfa 0,45 / 0,25 / 0,12, por baixo do original. É determinístico, barato, tem direção, e dá o "tranco" das entradas fortes. Use em T3, T6 e nas duas ou três entradas mais fortes do filme, não em toda animação.

**Onde cada transição mora:**

| Trecho do arco | Transições |
|---|---|
| gancho → promessa | T1 |
| promessa → capítulo 1 | T2 (nasce a etiqueta) + T3 (mergulho no drop) |
| entre capítulos | T4 (troca de mundo) ou T6 (chicote na batida forte) |
| etiqueta → rajada de amostras | T7 |
| rajada → fecho | T6 ou T4 + 1 q de vazio |
| fecho | T8 (o soco já é a entrada do bloco final) |

## 4. Enquadramentos e variedade

Enquadramentos à disposição: tipografia central · tela cheia · cartão flutuante · par de cartões verticais com a etiqueta no meio · carrossel de verticais · leque ou baralho 3D · parede de cartões com recuo de câmera · grade 2×2 com anotações · plano inclinado (linha do tempo, lista) · a interface da marca em tela cheia.

- **Pelo menos 4 enquadramentos distintos em 15 s.** A variedade é metade da energia.
- **No máximo 1 enquadramento novo por capítulo.** Dois enquadramentos novos no mesmo capítulo viram colagem.
- **O formato prova o conteúdo.** Vídeo vertical em cartão 9:16; vídeo longo em tela cheia; volume em parede; processo em linha do tempo; antes e depois em cortina. O enquadramento é o argumento.
- **O protagonista é grande.** O texto do gancho e o objeto de cada cena atravessam de 40 a 80% da largura. Uma barra inteira com texto de 50 px lê como tela de computador, não como filme.
- **Dois mundos.** Um fundo escuro e um claro (os dois da própria marca, quando ela tem modo escuro e modo claro), um por capítulo. A troca nunca é por fusão: acontece pelo condutor (T4, T6). Fundo nunca chapado: uma forma enorme com 2 a 4% de contraste, derivando devagar com `Motion.noise1d`.

## 5. Ritmo

Um filme bom alterna **rajada e silêncio**. Os vales são interface parada ou em deriva lenta; os picos são chicotes de 2 a 4 quadros. A etiqueta parada por 1 a 2 tempos é o vale antes do soco: sem silêncio não há soco. Metas para 15 s:

| Medida | Meta | O que é |
|---|---|---|
| Amplitude | ≥ 3,7× | energia de pico ÷ energia mediana; energia = quanto a imagem muda de um quadro para o outro, em janelas de 0,5 s |
| Quase-parada | ≥ 30% do filme | janelas em que a imagem quase não muda (interface parada, deriva) |
| Picos | ≥ 2 | janelas em que a imagem muda muito mais que a média (os socos) |
| Cortes duros | ≥ 3 | mudanças de quadro inteiro, sem fusão |
| Cortes na batida | todos | cada corte que a página declara a até 1 q de uma batida da trilha |

O `accept` mede a última linha (com `--beats` e os `film.cuts` da página: todos os cortes declarados a até 1 quadro de uma batida; num vídeo conferido sem a página, os cortes que ele acha na imagem valem com 2 quadros de folga e 70% na batida) e mais duas que cercam o ritmo: tempo parado (1,5 s ou mais sem nenhuma mudança de pixel avisa; a quase-parada deste método não é congelamento, porque a deriva de até 3% mantém a imagem viva) e piscadas (mais de 3 por segundo avisa; veja `aceite.md`). As outras quatro metas você planeja na tabela de momentos e confere na folha de contato de um quadro por batida: conte os cortes duros, conte os chicotes, meça quantas batidas são de interface parada.

Regras:

- **Cortes de duração variada** dentro da rajada: 1, 1, ½, ½, 1, 2 tempos. Cortes todos do mesmo tamanho são a marca registrada do vídeo feito às pressas.
- **Segura antes do soco.** 1 a 2 tempos de quase-parada (a etiqueta, a frase, o cartão parado) imediatamente antes de cada grande mudança.
- **O drop recebe a maior mudança de enquadramento**; o soco final cai no tempo 1 do último compasso; a abertura tem algo acontecendo no primeiro tempo forte.
- **Declare os cortes** em `film.cuts`, arredondados ao quadro, para que o aceite consiga medir.

```js
// 120 BPM: 1 tempo = 0,5 s = 15 q. Cortes com durações 1, 1, ½, ½, 1 e 2 tempos a partir da batida 8.
film.cuts = Motion.cutsAt(grid, [8, 9, 10, 10.5, 11, 12, 14]).map((c) => Motion.toFrame(c, film.fps));
const pulso = grid.pulse(t, 6);                     // 1 na batida, decai até a próxima: um respiro de 1 a 2% de escala, nunca mais
```

## 6. Tipografia e cor

- **Uma família, dois papéis.** Título (negrito ou black, Title Case ou frase normal) e Rótulo (CAIXA ALTA, peso médio, espaçamento de +2 a +4%). Sem itálico, sem texto 3D, sem contorno.
- **Tamanhos**, no tamanho padrão de cada formato:

| | 1080 de largura: 9:16, 4:5, 3:4, 1:1 | 1920×1080 (16:9) no feed | 1920×1080 (16:9) em tela grande |
|---|---|---|---|
| Título | 110 a 190 px (o gancho atravessa de 40 a 80% da largura) | 150 a 260 px | 64 a 100 px |
| Rótulo | 44 a 56 px | 78 a 100 px | 26 a 34 px |
| Mínimo legível | 44 px | 78 px | 26 px |

Um vídeo deitado no feed aparece na largura do celular, então a letra escala com a largura: os 44 px de um quadro de 1080 viram 78 px num de 1920, e é assim que o `accept` mede. Para um vídeo feito para tela grande (o YouTube no computador ou na TV), passe `--min-text 15` ao `accept`.

- **Dois acentos no máximo, com semântica fixa:** A = "selecionando" (a ferramenta, o estado ativo), B = "escolhido" (o CTA, o soco). Mais um sinal de capítulo opcional, usado num capítulo só. A cor de verdade vem do conteúdo (telas, fotos, vídeo); a interface é quase monocromática.
- **Texto nunca nos cantos**, nunca em moldura. Rótulo de canto é a assinatura do vídeo feito por quem não olhou o quadro.
- **Legibilidade de celular:** nada lido abaixo de 44 px num quadro de 1080 de largura e de 78 px no horizontal que vai para o feed; nunca em cima de área movimentada sem um fundo (chapa, sombra ou desfoque do fundo); nunca fora da zona segura (`Motion.safeArea`, `formatos.md`). O texto que cabe vem de `Motion.fitText` e `Motion.wrapText`, nunca de "diminuir até caber".
- Declare cada texto em `window.boxes(t)` com `role: "text"` e `size`: é assim que a conferência de legibilidade encontra o que está pequeno.

## 7. Marca: só o real

- **Telas reais.** Capturas de verdade do produto, recortadas e animadas; nunca uma interface redesenhada de memória nem "tipo app". Um botão genérico no lugar do botão real custa toda a autoridade do filme.
- **O logo oficial**, no tamanho mínimo que a marca define (sem diretriz: pelo menos 100 px de altura em 1080p), com o respiro definido. Movimento permitido no logo: corte, fade, deslocamento e escala uniforme. **Nunca** desfoque, rotação, inclinação, estiramento, recolorir, sombra, contorno ou brilho. O movimento forte fica com os elementos de interface, não com o logo.
- **Fontes.** A fonte da marca entra só se a licença permitir usá-la em vídeo; fonte restrita é trocada por uma livre de desenho parecido, e a troca é anotada nas notas da entrega.
- **Nunca invente telas, números ou depoimentos.** Todo número tem origem (a página do site, a data); sem origem, o número não entra.
- **Capítulo sem prova real não existe.** Se a marca não tem o material que o capítulo pediria (um tipo de conteúdo, um recurso), o capítulo cai; não se fabrica um para "completar a estrutura".
- **Texto de preenchimento** é ilegível de propósito (barras cinzas, texto borrado) ou é dado real. Nunca palavras legíveis que não são do projeto.
- **Tape o logo e olhe a folha:** a marca ainda é óbvia pelos elementos (cores, componentes, telas)? Se não, a tradução de marca falhou.

## 8. Proibições

- Título centralizado sobre gradiente, com tudo entrando em fade. É a cara do vídeo que ninguém dirigiu.
- Rótulos nos cantos e molduras no quadro.
- Brilho (glow) em interface; gradiente em componentes de interface.
- Explosões de partículas, flare, vinheta, grão.
- Fusão (crossfade) entre capítulos.
- Cortes todos do mesmo tamanho.
- Desfoque em movimento lento.
- Mais de dois acentos.
- Quatro capítulos em 15 s (cabem dois, um drop e um soco).
- Todo quadro em movimento: sem silêncio não há soco.
- Rebote visível em texto ou logo; movimento elástico "de desenho animado" em interface.
- Rotação 2D sem motivo, tremor de câmera contínuo, texto 3D extrudado.
- Chamar de pronto um filme que reprovou no aceite sem dizer isso.

## 9. O loop de crítica

Ninguém acerta um filme na primeira passada; o método é olhar os próprios quadros como um diretor severo, não como autor orgulhoso. Antes de qualquer render final:

1. **Fotografe um quadro por batida:** `frames pagina.html --beats beats.json --json` monta a folha (`folha.png`). Para um trecho rápido, a tira de 12 quadros seguidos de um vídeo pronto: `sheet video.mp4 --strip <tempo> --json`; para a leitura de celular, `sheet video.mp4 --phone --json` (360 px de largura, um quadro por segundo).
2. **Meça o que dá para medir:** `accept previa.mp4 --page pagina.html --beats beats.json --json` confere cortes na batida, zona segura, legibilidade, piscadas, tempo parado, volume e duração por rede, e diz em `fix` o que mudar (`aceite.md`). Uma regra reprovada entra na lista de problemas antes de qualquer opinião.
3. **Abra as imagens e olhe de verdade.** Dê nota de 1 a 10 a cada critério: gancho nos primeiros 2 s · legibilidade a 360 px · qualidade do movimento (molas, sem quadros mortos) · variedade (algo novo a cada 2 a 4 s; pelo menos 4 enquadramentos) · precisão de marca · sincronia com o som (cortes e socos na batida).
4. **Liste os 3 piores problemas com os tempos** e conserte só eles. Conserto típico de ritmo: eleja um momento para socar (corte duro, entrada mais curta, objeto maior) e aprofunde as seguras ao redor; não acelere tudo.
5. **Renderize de novo só os segundos afetados** (`preview pagina.html --start <t> --end <t>`) e refaça as notas.
6. **Pelo menos 3 rodadas.** Pare quando todas as notas chegarem a 8 e o `accept` passar, ou declare o teto ("sincronia ficou em 7 porque a trilha não tem bumbo entre 4 e 6 s") em vez de chamar de pronto.

O que caçar nas folhas e tiras: texto sobreposto durante uma troca · algo deslizando em velocidade constante em vez de assentar · rótulo de canto, moldura, título sobre gradiente · texto borrado por escala · uma batida morta, sem nada acontecendo · um tranco na emenda do loop · logo com efeito ou abaixo do mínimo · texto fora da zona segura · duas cenas seguidas com o mesmo enquadramento.

## 10. Loop e formatos

- **O último quadro é igual ao primeiro**, inclusive a posição e a velocidade do cursor e a fase de qualquer deriva. Toda mola precisa ter assentado antes do fim; o fecho segura parado pelo menos 1 tempo. `Motion.loopT(t, film.duration)` embrulha o tempo; a trilha também precisa fechar (`music --loop`, em `som.md`). Confira a emenda fotografando os três últimos e os três primeiros quadros (`frames pagina.html --times 14.9,14.933,14.967,0,0.033,0.067 --json`) e, no vídeo pronto, com `accept video.mp4 --loop --json` (o item `loop_seamless`).
- **Formatos não são recortes.** `window.setFormat({ name, width, height })` recompõe o layout a partir do mesmo tempo: o tipo escala, colunas viram linhas, o cartão de vídeo muda de lugar. Os tempos, os cortes e o som não mudam entre formatos (`formatos.md`).
- **Zonas seguras.** `Motion.safeArea(formato)` devolve `{ x, y, w, h }`, onde texto, logo e rosto ficam longe dos botões e legendas das redes. Tudo o que precisa ser lido fica dentro dela; o fundo e as formas decorativas podem sangrar.
