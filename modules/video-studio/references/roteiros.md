# Os roteiros do vídeo

Todo vídeo do Estúdio nasce de um de cinco roteiros: **lançamento**, **interface que se transforma**, **oferta**, **lista** e **passo a passo**. O roteiro diz quais cenas existem, em que ordem, quanto cada uma dura (em compassos da música) e o que cada cena precisa (as lacunas). O `build` escreve o `roteiro.json` a partir do pedido e da marca; você pode ajustar o texto, os tempos, os sons e o destaque de cada cena, e o `build` confere tudo de novo. As regras deste guia são as mesmas que o `build` confere (elas vêm de `roteiros.json`, ao lado deste guia).

## O tempo: compassos e batidas

O vídeo anda numa grade de batidas, a mesma da trilha.

- `bpm` é o andamento, de 100 a 140. Uma batida dura `60 / bpm` segundos; um compasso tem 4 batidas.
- Cada cena dura um número de compassos (`bars`), em múltiplos de 0,25 (uma batida), dentro do intervalo que o roteiro permite para ela.
- A duração do vídeo é a soma dos compassos vezes `4 × 60 / bpm`, e precisa ficar entre 6 e 20 segundos. `bars` (total) e `duration` no `roteiro.json` precisam bater com as cenas.
- Toda mudança de cena cai numa batida, e por isso o corte cai no tempo da música.

| Duração | Compassos e andamento |
|---|---|
| 6 s | 3 compassos a 120: curto demais para os cinco roteiros; o mais curto possível tem 4 compassos (6,9 s a 140) |
| 8,6 s | 5 compassos a 140 |
| 12 s | 6 compassos a 120 |
| 15 s | 8 compassos a 128 |
| 20 s | 10 compassos a 120 |

O menor vídeo de cada roteiro: interface, oferta e passo a passo, 4 compassos (6,9 s a 140); lançamento e lista, 5 compassos (8,6 s a 140).

## Os sons que marcam a imagem

Cada cena pode ter `events`, uma lista de `{ "beat": n, "type": "…" }`: o efeito sonoro que toca na batida `n` da cena (de 0 até a última batida dela; frações como 0,5 valem). A página usa os mesmos eventos para fazer a imagem bater junto com o som:

| Evento | O que a página faz nessa batida |
|---|---|
| `impact` | o soco: o título pousa com um tranco, o preço bate na tela, o logo corta para dentro |
| `pop` | o destaque da palavra-chave chega, o nome do produto sobe, a etiqueta do prazo nasce |
| `click` | o cursor aperta (e a tela ou o botão cede um fio) |
| `tick` | o contador começa a rolar; vários `tick` fazem um passo a cada um |
| `whoosh`, `swish` | a entrada de uma cena que chega em movimento |
| `ding`, `blip`, `thump`, `kick`, `riser`, `pluck`, `shutter` | só o som; use onde algo novo aparece (o sinal de pronto, um resultado, a chapa do preço) |

Sem o evento, a página usa uma batida padrão (dita em cada roteiro abaixo).

## Regras de texto que valem para todos

- Uma ideia por cena. Os limites de palavras são de verdade: um texto maior não cabe grande, e o `build` o recusa.
- Só o que é real: números com origem (a página do site e a data em `source`), preços e prazos que o integrante deu, telas capturadas do site. Sem prova real, a cena de prova sai do roteiro.
- `emphasis` (opcional, em várias cenas) diz qual palavra recebe o destaque; ela precisa existir no texto da cena. Sem ela, a página escolhe sozinha: um número com a unidade ("90 dias", "R$ 199"), senão a última palavra que carrega sentido.
- Endereços de site saem do jeito que são escritos (sem caixa alta e sem destaque).

## Lançamento (`lancamento`)

**Para quê.** Apresentar ou lançar um produto, um serviço, um portfólio: o problema em poucas palavras, o produto se montando na tela, os recursos um a um e a assinatura. Objetivos: apresentar, lançar, portfólio. Estilo padrão: `interface-narra`.

| Cena | Compassos | Lacunas | Som que combina | O que a página faz |
|---|---|---|---|---|
| `gancho` | 1 a 2 | `text` (até 6 palavras), `emphasis`? | `impact` na 0, `pop` na 1 | o texto já está pousado no primeiro quadro (a capa); soco no `impact`; o destaque chega no `pop`; no fim, a câmera atravessa a palavra-chave |
| `produto` | 1 a 2 | `screen`?, `text`? (até 5) | `whoosh` na 0, `click` perto do fim (sem ele, na última batida) | a tela real se monta dentro de um celular (ou de uma janela, se for tela de computador) e o nome sobe na batida 1; o cursor aperta no `click`; sem tela, um celular na cor da marca com a inicial dela |
| `ponto` (2 a 4) | 1 | `text` (até 5), `detail`? (até 10), `image`?, `screen`?, `emphasis`?, `scroll`? | `swish` na 0, `click` na 2 | etiqueta numerada, o nome grande, o detalhe; a tela muda de lugar e rola até `scroll` (0 = topo da página, 1 = fim; sem `scroll`, as cenas se distribuem pela página); `image` vira um cartão de foto; sem nada, a tipografia ocupa a cena e o cursor sublinha a palavra-chave |
| `prova` (opcional) | 1 | `value` (número), `prefix`?, `suffix`?, `text` (até 4), `source` | `tick` na 0, `ding` na 1 | o número rola até o valor em uma batida e fica, no outro mundo da marca; a origem (`source`) não aparece no vídeo: ela vai para as notas da entrega |
| `fechamento` | 1 a 2 | `text` (até 6), `logo`?, `emphasis`? | `impact` na 0 | o logo corta para dentro, o texto sobe uma batida depois e tudo segura até o último quadro; sem arquivo de logo, o nome da marca na fonte do título |

```json
{
  "format_version": 1,
  "title": "Clínica Sorriso · lançamento",
  "template": "lancamento",
  "style": "interface-narra",
  "format": "9:16",
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "bpm": 120,
  "beats_per_bar": 4,
  "bars": 10,
  "duration": 20,
  "music": { "mode": "music", "style": "energetic", "seed": 7, "file": null },
  "palette": { "background": "#FFFFFF", "surface": "#F5F3FF", "text": "#1F2937", "accent": "#7C3AED", "muted": "#4B5563" },
  "fonts": { "headline": "Georgia, serif", "body": "'Segoe UI', Arial, sans-serif" },
  "brand": { "name": "Clínica Sorriso", "site": "clinicasorriso.com.br", "handle": "@clinicasorriso", "logo": "assets/logo.svg" },
  "scenes": [
    { "n": 1, "role": "gancho", "bars": 1, "text": "Seu sorriso novo em 90 dias", "events": [{ "beat": 0, "type": "impact" }, { "beat": 1, "type": "pop" }] },
    { "n": 2, "role": "produto", "bars": 2, "screen": "assets/tela.png", "text": "Clínica Sorriso", "events": [{ "beat": 0, "type": "whoosh" }, { "beat": 6, "type": "click" }] },
    { "n": 3, "role": "ponto", "bars": 1, "text": "Implantes em uma sessão", "detail": "Com planejamento digital", "scroll": 0.3, "events": [{ "beat": 0, "type": "swish" }, { "beat": 2, "type": "click" }] },
    { "n": 4, "role": "ponto", "bars": 1, "text": "Clareamento a laser", "scroll": 0.5, "events": [{ "beat": 0, "type": "swish" }, { "beat": 2, "type": "click" }] },
    { "n": 5, "role": "ponto", "bars": 1, "text": "Alinhadores invisíveis", "detail": "Trocados a cada duas semanas", "image": "assets/produto.png", "events": [{ "beat": 0, "type": "swish" }, { "beat": 2, "type": "click" }] },
    { "n": 6, "role": "ponto", "bars": 1, "text": "Planos para a família", "emphasis": "família", "scroll": 0.8, "events": [{ "beat": 0, "type": "swish" }, { "beat": 2, "type": "click" }] },
    { "n": 7, "role": "prova", "bars": 1, "value": 2000, "prefix": "+", "text": "pacientes atendidos", "source": "clinicasorriso.com.br (página inicial, 2026-10-07)", "events": [{ "beat": 0, "type": "tick" }, { "beat": 1, "type": "ding" }] },
    { "n": 8, "role": "fechamento", "bars": 2, "text": "clinicasorriso.com.br", "logo": true, "events": [{ "beat": 0, "type": "impact" }] }
  ],
  "loop": false
}
```

## Interface que se transforma (`interface`)

**Para quê.** Contar o uso do produto com um único elemento de interface que muda de estado a cada batida: um botão que vira campo, que vira carregando, que vira pronto, que vira um cartão. Nenhum corte: o mesmo elemento atravessa o vídeo, e um cursor aperta cada mudança. Objetivos: explicar, apresentar, lançar. Estilo padrão: `interface-que-se-transforma`.

| Cena | Compassos | Lacunas | Som que combina | O que a página faz |
|---|---|---|---|---|
| `abertura` | 0,5 a 1 | `text`? (até 4), `logo`?, `emphasis`? | `impact` na 0, `pop` na 1 | o elemento nasce como o ícone da marca (o logo, ou a inicial na cor da marca) e o texto fica embaixo; sem texto, o nome da marca; é a capa do vídeo |
| `estado` (4 a 10) | 0,5 a 1 | `kind`, `text` (até 5), `value`?, `detail`? (até 8) | `click` na 0 (cada mudança); `ding` no `sucesso`; `blip` quando a busca mostra o resultado; `tick` no gráfico | o elemento muda de tamanho, raio e cor; o conteúdo troca por dentro; o cursor aperta o estado anterior na batida da mudança |
| `fechamento` | 1 a 2 | `text` (até 6), `logo`?, `emphasis`? | `impact` na 0 | o elemento volta a ser o ícone da marca e o texto sobe embaixo; segura até o último quadro |

Os tipos de estado (`kind`) e o que cada lacuna vira:

| `kind` | O elemento vira | `text` | `detail` | `value` |
|---|---|---|---|---|
| `botao` | um botão na cor de destaque | o rótulo do botão | uma linha embaixo dele | não se aplica |
| `campo` | um campo de formulário | o que é digitado, letra por letra, na grade | o rótulo do campo ("Seu nome") | não se aplica |
| `carregando` | um círculo que se completa | a legenda embaixo | uma linha embaixo da legenda | até onde o círculo enche (1 a 100); sem ele, 100% |
| `sucesso` | um círculo de cor com o sinal de certo, que se desenha | a legenda embaixo | uma linha embaixo da legenda | não se aplica |
| `cartao` | um cartão com uma faixa de cor no alto | o título | uma linha do cartão | um destaque grande ("R$ 70", "4,9") |
| `grafico` | um cartão com barras que crescem | o título | uma linha, quando não há `value` | o número que rola (só número) |
| `lista` | um cartão com três linhas que chegam | o título | até três itens, separados por vírgula ou "e" | não se aplica |
| `aviso` | uma notificação no alto da tela | a mensagem | a segunda linha | não se aplica |
| `busca` | um campo de busca, que cresce para mostrar o resultado | o que é digitado | o resultado que aparece | não se aplica |

Use estados curtos (0,5 compasso) para os passos rápidos (botão, carregando, pronto) e de 1 compasso para o que precisa de leitura (campo, busca, cartão, gráfico).

```json
{
  "format_version": 1,
  "title": "Agenda Fácil · como funciona",
  "template": "interface",
  "style": "interface-que-se-transforma",
  "format": "9:16",
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "bpm": 120,
  "beats_per_bar": 4,
  "bars": 10,
  "duration": 20,
  "music": { "mode": "music", "style": "clean", "seed": 13, "file": null },
  "palette": { "background": "#F6F7FB", "text": "#14161F", "accent": "#3B5BFD" },
  "fonts": { "headline": "'Segoe UI', Arial, sans-serif", "body": "'Segoe UI', Arial, sans-serif" },
  "brand": { "name": "Agenda Fácil", "site": "agendafacil.app", "handle": "@agendafacil", "logo": "assets/logo.svg" },
  "scenes": [
    { "n": 1, "role": "abertura", "bars": 1, "text": "Sua agenda no automático", "logo": true, "events": [{ "beat": 0, "type": "impact" }, { "beat": 1, "type": "pop" }] },
    { "n": 2, "role": "estado", "kind": "busca", "bars": 1, "text": "Corte masculino", "detail": "Barbearia Centro, hoje às 15h", "events": [{ "beat": 0, "type": "click" }, { "beat": 2, "type": "blip" }] },
    { "n": 3, "role": "estado", "kind": "botao", "bars": 0.5, "text": "Reservar horário", "detail": "Sem ligação, sem espera", "events": [{ "beat": 0, "type": "click" }] },
    { "n": 4, "role": "estado", "kind": "campo", "bars": 1, "text": "Mariana Souza", "detail": "Seu nome", "events": [{ "beat": 0, "type": "click" }] },
    { "n": 5, "role": "estado", "kind": "carregando", "bars": 0.5, "text": "Confirmando", "events": [{ "beat": 0, "type": "click" }] },
    { "n": 6, "role": "estado", "kind": "sucesso", "bars": 0.5, "text": "Horário marcado", "events": [{ "beat": 0, "type": "ding" }] },
    { "n": 7, "role": "estado", "kind": "aviso", "bars": 0.5, "text": "Lembrete enviado", "detail": "Amanhã às 14h, pelo WhatsApp", "events": [{ "beat": 0, "type": "pop" }] },
    { "n": 8, "role": "estado", "kind": "cartao", "bars": 1, "text": "Corte e barba", "detail": "Com o Rafael, 45 minutos", "value": "R$ 70", "events": [{ "beat": 0, "type": "click" }] },
    { "n": 9, "role": "estado", "kind": "lista", "bars": 0.5, "text": "Próximos horários", "detail": "Corte, Barba e Sobrancelha", "events": [{ "beat": 0, "type": "click" }] },
    { "n": 10, "role": "estado", "kind": "grafico", "bars": 1, "text": "Agenda da semana", "value": 48, "events": [{ "beat": 0, "type": "click" }, { "beat": 1, "type": "tick" }] },
    { "n": 11, "role": "estado", "kind": "botao", "bars": 0.5, "text": "Começar grátis", "events": [{ "beat": 0, "type": "click" }] },
    { "n": 12, "role": "fechamento", "bars": 2, "text": "agendafacil.app", "logo": true, "events": [{ "beat": 0, "type": "impact" }] }
  ],
  "loop": false
}
```

## Oferta (`oferta`)

**Para quê.** Vender: o gancho, o produto em destaque, o preço batendo na tela, o prazo e a chamada. Objetivo: vender. Estilo padrão: `vitrine`.

| Cena | Compassos | Lacunas | Som que combina | O que a página faz |
|---|---|---|---|---|
| `gancho` | 1 a 2 | `text` (até 6), `emphasis`? | `impact` na 0, `pop` na 1 | como no lançamento: a capa pousada, o soco, o destaque e a travessia |
| `produto` | 1 a 2 | `image`?, `screen`?, `text` (até 5) | `whoosh` na 0, `pop` na 1 | a foto num cartão grande (no estilo vitrine, de lado a lado) com o nome em cima; uma tela dentro de um celular; sem nada, um cartão na cor da marca com o nome dentro |
| `preco` | 1 a 2 | `value`, `old_value`?, `text`? (até 5) | `thump` na 0, `impact` na 2 | o cartão do produto cresce até virar a tela inteira; a chapa do preço sobe; o valor antigo chega e é riscado; o valor novo bate no `impact` (sem ele, na batida 2); o texto (por exemplo "à vista no Pix") aparece uma batida depois |
| `prazo` (opcional) | 1 | `text` (até 6) | `pop` na 0 | uma etiqueta pousa na chapa do preço e uma barra embaixo do preço se esvazia |
| `fechamento` | 1 a 2 | `text` (até 6), `logo`? | `whoosh` na 0, `click` na 2 | a chapa encolhe até virar o botão com o texto da chamada; o logo entra em cima; o cursor aperta no `click` |

`value` e `old_value` aceitam um número (`199.9` vira "199,90") ou o texto como o preço é escrito: `"R$ 199,90"`, `"12x de R$ 49,90"`, `"10% OFF"`. A moeda e os centavos saem menores, o resto do texto sai na linha de cima. Use sempre o preço que o integrante deu ou que o site publica.

```json
{
  "format_version": 1,
  "title": "Loja Aurora · oferta",
  "template": "oferta",
  "style": "vitrine",
  "format": "9:16",
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "bpm": 108,
  "beats_per_bar": 4,
  "bars": 9,
  "duration": 20,
  "music": { "mode": "music", "style": "energetic", "seed": 21, "file": null },
  "palette": { "background": "#FFF8F1", "text": "#2B1D14", "accent": "#C2410C" },
  "fonts": { "headline": "Georgia, serif", "body": "'Segoe UI', Arial, sans-serif" },
  "brand": { "name": "Loja Aurora", "site": "lojaaurora.com.br", "handle": "@lojaaurora", "logo": "assets/logo.svg" },
  "scenes": [
    { "n": 1, "role": "gancho", "bars": 2, "text": "Frio chegou. A lã também.", "emphasis": "lã", "events": [{ "beat": 0, "type": "impact" }, { "beat": 2, "type": "pop" }] },
    { "n": 2, "role": "produto", "bars": 2, "image": "assets/produto.png", "text": "Casaco de lã", "events": [{ "beat": 0, "type": "whoosh" }, { "beat": 1, "type": "pop" }] },
    { "n": 3, "role": "preco", "bars": 2, "value": "R$ 199,90", "old_value": "R$ 289,90", "text": "à vista no Pix", "events": [{ "beat": 0, "type": "thump" }, { "beat": 2, "type": "impact" }] },
    { "n": 4, "role": "prazo", "bars": 1, "text": "Só até domingo", "events": [{ "beat": 0, "type": "pop" }] },
    { "n": 5, "role": "fechamento", "bars": 2, "text": "Compre pelo link da bio", "logo": true, "events": [{ "beat": 0, "type": "whoosh" }, { "beat": 2, "type": "click" }] }
  ],
  "loop": false
}
```

## Lista (`lista`)

**Para quê.** Ensinar ou opinar em itens: um gancho e de três a cinco itens numerados, um por vez, fechando com a chamada. Objetivo: explicar. Estilo padrão: `tipografia-cinetica`.

| Cena | Compassos | Lacunas | Som que combina | O que a página faz |
|---|---|---|---|---|
| `gancho` | 1 a 2 | `text` (até 6), `emphasis`? | `impact` na 0, `pop` na 1 | a capa pousada, o soco, o destaque e a travessia (um número no gancho, como "5 erros", ganha o destaque sozinho) |
| `item` (3 a 5) | 1 a 2 | `text` (até 6), `detail`? (até 10), `emphasis`? | `whoosh` ou `swish` na 0, `pop` na 2 | cada item tem um enquadramento próprio, nesta ordem: o numeral gigante, a etiqueta numerada, o numeral embaixo, o bloco de cor, tudo no centro; o texto sobe linha a linha, o destaque chega no `pop`, o detalhe vem depois; um trilho embaixo mostra em que item estamos |
| `fechamento` | 1 a 2 | `text` (até 6), `logo`?, `emphasis`? | `impact` na 0 | o logo e a chamada, parados até o último quadro, no fundo da marca |

Itens alternando 1 e 2 compassos dão ritmo (cortes do mesmo tamanho cansam); dê 2 compassos ao item com detalhe.

```json
{
  "format_version": 1,
  "title": "Clínica Sorriso · 5 erros",
  "template": "lista",
  "style": "tipografia-cinetica",
  "format": "9:16",
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "bpm": 120,
  "beats_per_bar": 4,
  "bars": 10,
  "duration": 20,
  "music": { "mode": "music", "style": "clean", "seed": 17, "file": null },
  "palette": { "background": "#FFFFFF", "surface": "#F5F3FF", "text": "#1F2937", "accent": "#7C3AED" },
  "fonts": { "headline": "'Segoe UI', Arial, sans-serif", "body": "'Segoe UI', Arial, sans-serif" },
  "brand": { "name": "Clínica Sorriso", "site": "clinicasorriso.com.br", "handle": "@clinicasorriso", "logo": "assets/logo.svg" },
  "scenes": [
    { "n": 1, "role": "gancho", "bars": 1, "text": "5 erros que mancham seu sorriso", "events": [{ "beat": 0, "type": "impact" }, { "beat": 1, "type": "pop" }] },
    { "n": 2, "role": "item", "bars": 2, "text": "Café sem enxaguar a boca", "detail": "Um gole de água depois já ajuda", "events": [{ "beat": 0, "type": "whoosh" }, { "beat": 2, "type": "pop" }] },
    { "n": 3, "role": "item", "bars": 1, "text": "Escovar logo após o suco", "detail": "O ácido amolece o esmalte por 30 minutos", "events": [{ "beat": 0, "type": "swish" }, { "beat": 2, "type": "pop" }] },
    { "n": 4, "role": "item", "bars": 2, "text": "Pular o fio dental", "events": [{ "beat": 0, "type": "whoosh" }, { "beat": 2, "type": "pop" }] },
    { "n": 5, "role": "item", "bars": 1, "text": "Clarear sem avaliação", "detail": "A sensibilidade aparece depois", "events": [{ "beat": 0, "type": "swish" }, { "beat": 2, "type": "pop" }] },
    { "n": 6, "role": "item", "bars": 1, "text": "Escova velha por um ano", "events": [{ "beat": 0, "type": "swish" }, { "beat": 2, "type": "pop" }] },
    { "n": 7, "role": "fechamento", "bars": 2, "text": "Agende sua avaliação", "logo": true, "events": [{ "beat": 0, "type": "impact" }] }
  ],
  "loop": false
}
```

## Passo a passo (`passos`)

**Para quê.** Explicar como algo funciona ou como se faz: um gancho, de dois a cinco passos em ordem e, quando o integrante diz o que a pessoa tem no fim, o resultado, fechando com a chamada. Diferente da lista, os passos dependem um do outro: um caminho no alto liga os passos e avança a cada um. Objetivo: explicar. Estilo padrão: `limpo`.

| Cena | Compassos | Lacunas | Som que combina | O que a página faz |
|---|---|---|---|---|
| `gancho` | 1 a 2 | `text` (até 6), `emphasis`? | `impact` na 0, `pop` na 1 | a capa pousada, o soco, o destaque e a travessia, como na lista |
| `passo` (2 a 5) | 1 a 2 | `text` (até 6), `detail`? (até 10), `emphasis`? | `swish` na 0, `pop` na 2 | no alto, o círculo do passo acende na batida 0 e o trecho do caminho até o próximo enche enquanto o passo dura; quando ele termina, o número vira um sinal de certo; o texto sobe linha a linha, o destaque chega no `pop` e o detalhe vem depois |
| `resultado` (opcional) | 1 a 2 | `text` (até 6), `detail`? (até 10), `emphasis`? | `ding` na 0 | o último certo se desenha, o caminho sai e um círculo grande na cor de destaque pousa com o sinal de certo se desenhando; o texto sobe embaixo |
| `fechamento` | 1 a 2 | `text` (até 6), `logo`?, `emphasis`? | `impact` na 0 | o logo e a chamada, parados até o último quadro, no fundo da marca |

Escreva cada passo começando pelo que a pessoa faz ("Baixe o app", "Escolha o horário"), na ordem em que ela faz. O `build` não escreve a cena `resultado`: ela entra no `roteiro.json` só quando o integrante disse o que a pessoa tem no fim ("horário marcado sem ligação"), com as palavras dele.

```json
{
  "format_version": 1,
  "title": "Agenda Fácil · como agendar",
  "template": "passos",
  "style": "limpo",
  "format": "9:16",
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "bpm": 120,
  "beats_per_bar": 4,
  "bars": 10,
  "duration": 20,
  "music": { "mode": "music", "style": "clean", "seed": 19, "file": null },
  "palette": { "background": "#F6F7FB", "text": "#14161F", "accent": "#3B5BFD" },
  "fonts": { "headline": "'Segoe UI', Arial, sans-serif", "body": "'Segoe UI', Arial, sans-serif" },
  "brand": { "name": "Agenda Fácil", "site": "agendafacil.app", "handle": "@agendafacil", "logo": "assets/logo.svg" },
  "scenes": [
    { "n": 1, "role": "gancho", "bars": 1, "text": "Como marcar seu horário", "emphasis": "horário", "events": [{ "beat": 0, "type": "impact" }, { "beat": 1, "type": "pop" }] },
    { "n": 2, "role": "passo", "bars": 1, "text": "Baixe o app", "detail": "Na loja do seu celular", "events": [{ "beat": 0, "type": "swish" }, { "beat": 2, "type": "pop" }] },
    { "n": 3, "role": "passo", "bars": 1, "text": "Escolha o serviço", "events": [{ "beat": 0, "type": "swish" }, { "beat": 2, "type": "pop" }] },
    { "n": 4, "role": "passo", "bars": 1, "text": "Toque no horário livre", "detail": "Os horários do dia aparecem em verde", "emphasis": "livre", "events": [{ "beat": 0, "type": "swish" }, { "beat": 2, "type": "pop" }] },
    { "n": 5, "role": "passo", "bars": 1, "text": "Confirme com seu nome", "events": [{ "beat": 0, "type": "swish" }, { "beat": 2, "type": "pop" }] },
    { "n": 6, "role": "passo", "bars": 1, "text": "Receba o lembrete", "detail": "Um dia antes, pelo WhatsApp", "events": [{ "beat": 0, "type": "swish" }, { "beat": 2, "type": "pop" }] },
    { "n": 7, "role": "resultado", "bars": 2, "text": "Horário marcado sem ligação", "detail": "E você só aparece na hora", "events": [{ "beat": 0, "type": "ding" }] },
    { "n": 8, "role": "fechamento", "bars": 2, "text": "agendafacil.app", "logo": true, "events": [{ "beat": 0, "type": "impact" }] }
  ],
  "loop": false
}
```

## Como escolher o roteiro

| O integrante quer… | Roteiro |
|---|---|
| vender um produto, anunciar uma promoção, mostrar um preço | oferta |
| lançar ou apresentar um produto, um serviço, o próprio trabalho | lançamento |
| mostrar um elemento da tela que muda de estado sem corte, como um app que se transforma | interface que se transforma |
| explicar como algo funciona ou como se faz, um passo depois do outro | passo a passo |
| dar dicas, listar erros, motivos ou ideias soltas, que não dependem da ordem | lista |

Desempate pelo material que existe: com telas boas do produto, lançamento ou interface; com fotos de produto e preço, oferta; sem imagem nenhuma, passo a passo ou lista (ou lançamento no estilo `tipografia-cinetica`). Pedidos com "estados da interface", "interface que se transforma", "muda de estado" ou "mesmo elemento" pedem a interface; "passo a passo", "3 passos", "4 etapas" pedem o passo a passo, e "como funciona", "como usar", "tutorial", sem outra história, também; "3 dicas", "5 erros", "top 5" pedem a lista; "preço", "promoção", "desconto" pedem a oferta. Para mostrar um app por dentro com uma tela que se transforma, o pedido nomeia a interface.

## O que o vídeo nunca faz

- Inventar uma tela, um número, um preço, um prazo ou um depoimento.
- Usar o logo deformado: o logo só corta, aparece, desliza e muda de tamanho por inteiro; nunca gira, nunca é desfocado, nunca muda de cor.
- Pôr texto fora da área segura (longe dos botões, do nome e da legenda das redes) ou abaixo de 44 px.
- Cortar fora da batida.
