# A peça: peca.json e a página

Este guia é para a IA. `piece <campanha> <conceito>` escreve `anuncios/<campanha>/pecas/<conceito>/peca.json` a partir do modelo do conceito e monta a página que o Motor de vídeo renderiza e, quando o conceito tem imagem, a `imagem.html`. Você melhora a peça editando só o `peca.json`; as páginas, o `ad.js` e o `ad.css` são refeitos pelo app a cada `piece` e a cada `preview`. Nunca edite a `pagina.html` nem a `imagem.html` à mão.

## 1. A zona do anúncio

Nos anúncios de Stories e Reels, a interface da Meta cobre 14% de cima, 35% de baixo e 6% de cada lado. No vertical de 1080 por 1920, a zona livre é a faixa do meio, de 875 por 978 px, e toda cena mora nela: texto, logo, telas e botão. O app lê essa zona da tabela das redes do Motor de vídeo e a grava na página; a conferência usa a mesma zona. O que fica fora dela some atrás dos botões da Meta.

- O texto encolhe para caber na zona, mas nunca abaixo de 44 px, o menor que a conferência aceita. Um texto que não cabe nem assim reprova na área segura: encurte.
- Nenhuma animação passa do tamanho do próprio item: a escala nasce menor e para em 1. Não peça pulso, zoom para fora ou balanço.
- Nenhuma cena fica parada: as palavras de cada texto entram uma a uma, o trecho em destaque ganha um sublinhado que corre depois delas, a tela do produto desce, os campos do cartão se digitam e o botão é tocado antes do fim. A conferência avisa quando a tela fica 1,5 s sem mudar; se avisar, ponha um item a mais na cena ou divida um texto em duas linhas.
- Entre uma cena e outra, a anterior sai cruzando o corte, sem quadro vazio.

**O vídeo 4:5 e as imagens.** A mesma página se recompõe em 4:5 para o vídeo do feed: as cenas, os tempos e a trilha são os mesmos, e cada item se reposiciona na zona do formato. A tabela das redes do Motor ainda não tem a zona de anúncio do feed, então o vídeo 4:5 e as imagens usam a zona do feed do Instagram: no 4:5 de 1080 por 1350, 120 px em cima, 200 embaixo e 72 de cada lado; no 1:1, 80, 120 e 60. A entrega diz isso ao integrante.

## 2. O arquivo

```json
{
  "version": 1,
  "concept": "memoria",
  "title": "memoria-reels-lembra-v1",
  "template": "problema-mecanismo",
  "format": "9:16",
  "duration": 15,
  "bpm": 120,
  "music": { "style": "clean", "seed": 3 },
  "brand": { "name": "Marca", "logo": "imagens/logo.svg", "colors": { "background": "#F6F4EE", "text": "#1E1D1B", "accent": "#1F6F78", "surface": "#FFFFFF", "muted": "#5E5A53" }, "fonts": [] },
  "scenes": [
    { "from": 0, "to": 3, "role": "gancho", "items": [{ "type": "title", "text": "Ela contou no começo da consulta.", "at": -1 }, { "type": "title", "text": "No fim, você ainda lembrava?", "at": 1.5, "accent": true }] },
    { "from": 3, "to": 7, "role": "problema", "items": [{ "type": "caption", "text": "Digitando, você não ouve direito.", "at": 3.2 }] },
    { "from": 7, "to": 12, "role": "mecanismo", "items": [{ "type": "caption", "text": "A conversa vira anamnese.", "at": 7 }, { "type": "card", "title": "Anamnese", "at": 7.3, "fields": [{ "label": "Sono", "value": "Acorda toda noite na mesma hora", "chip": "Relato da paciente" }] }] },
    { "from": 12, "to": 15, "role": "chamada", "align": "center", "items": [{ "type": "logo", "at": 12 }, { "type": "title", "text": "O que ela contou fica.", "at": 12.2, "accent": true }, { "type": "pill", "text": "Assinar", "at": 12.8 }] }
  ]
}
```

| Campo | Regra |
|---|---|
| `duration` | de 6 a 15 s, num múltiplo da batida (0,5 s a 120 BPM); a Meta recomenda até 15 s nos Reels e nos Stories |
| `bpm` | de 80 a 160; a trilha e os cortes seguem ele |
| `music.style` | `clean`, `energetic`, `warm`, `minimal`, `cinematic` ou `playful`; `seed` muda a melodia |
| `brand.colors` | cores em hexadecimal; o app as tira do site capturado e troca a que não daria leitura |
| `scenes` | de 2 a 6, em sequência, da 0 até a duração, sem buraco; cada corte (o `from` de uma cena) cai numa batida |
| `at` | o segundo em que o item entra; ele fica até o fim da cena. Só a primeira cena aceita `at` negativo |
| `align` | `start` (padrão, à esquerda) ou `center` |

**A capa é o quadro 0.** A primeira cena tem pelo menos um texto com `"at": -1`, visível no primeiro quadro: é ele que aparece parado no feed e na miniatura.

## 3. Os itens

| `type` | Campos | Limite |
|---|---|---|
| `title` | `text`, `accent` (true, ou o trecho em destaque), `sweep_at` (quando o sublinhado corre), `big` | 90 caracteres |
| `caption` | `text`, `accent`, `sweep_at` | 140 caracteres |
| `quote` | `text`, `when` (como "14h02 · paciente") | 120 e 30 |
| `list` | `items` (de 2 a 6 partes), `times` (um instante por parte), `accent_last` | 28 por parte |
| `card` | `title`, `fields` (de 1 a 4: `label`, `value`, `chip`, `blank`, `at`) | 28 e 48 |
| `screen` | `src` (uma imagem em `imagens/`), `motion` (`zoom`, `rolar` ou `parado`), `height` (de 0,25 a 0,8 da zona) | |
| `stamp` | `text` (um selo com ✓) | 40 |
| `pill` | `text` (o botão), `tap_at` (quando ele é tocado) | 30 |
| `logo` | (o logo da marca; sem logo, o nome em texto) | |

- O cartão (`card`) é uma tela do produto recriada: os nomes dos campos são os do produto do integrante, e os valores são dados fictícios. Nunca dado real de cliente ou paciente.
- `blank: true` mostra um campo em branco, tracejado, com o valor como aviso ("não informado").
- A tela (`screen`) mostra uma imagem do integrante (`materiais/tela…`) ou a tela do site capturado. `rolar` desce por uma captura longa; `zoom` aproxima devagar.
- Nada de pessoa, rosto ou depoimento gerado. Uma prova com pessoa real só entra com o material do integrante.

## 4. A imagem do feed

Quando o conceito tem `imagem` ou `quadrado`, a `imagem.html` mostra tudo de uma vez, parado. Sem nada escrito, o app a compõe a partir das cenas:

- o gancho: os títulos da primeira cena, ou a lista dela numa linha só, com a última parte em destaque;
- a prova do mecanismo: a tela do produto, parada, ou os dois primeiros campos do cartão; sem nenhum dos dois, a frase do meio;
- o logo e o botão da chamada.

Para mudar a imagem, escreva `poster` no `peca.json`, com uma cena só:

```json
"poster": {
  "format": "4:5",
  "scenes": [{ "items": [
    { "type": "title", "text": "No fim da consulta, você ainda lembrava?", "accent": "ainda lembrava?" },
    { "type": "screen", "src": "imagens/tela-agenda.png", "motion": "parado", "height": 0.42 },
    { "type": "logo" },
    { "type": "pill", "text": "Assinar" }
  ] }]
}
```

- `format` é `4:5` ou `1:1`; a mesma página faz as duas imagens, cada uma na zona do seu formato.
- A cena tem de 1 a 6 itens, com os tipos e os limites do vídeo, e pelo menos um texto: a imagem é lida parada no feed.
- Nada se mexe: cada item aparece inteiro, e `at` não muda nada.

## 5. Os modelos

| Modelo | Cenas |
|---|---|
| `problema-mecanismo` | o gancho (0 a 3 s), a barreira (3 a 7 s), como o produto resolve (7 a 12 s), a chamada com a marca (12 a 15 s) |
| `produto-em-uso` | o gancho (0 a 3 s), a tela do produto com a prova (3 a 11 s), a chamada (11 a 15 s) |
| `lista` | o gancho como lista, uma parte por batida (0 a 4 s), o contraste (4 a 7 s), o mecanismo (7 a 12 s), a chamada (12 a 15 s) |

O modelo só põe os textos do conceito e as imagens do integrante. O que ele não sabe, como os campos reais de uma tela do produto, volta em `todo` na resposta do `piece`: escreva no `peca.json` com o que o integrante disse ou mostrou, nunca inventado.

## 6. O som

A trilha é composta pelo Motor de vídeo para a duração da peça, com os cortes na batida. Os efeitos entram sozinhos: uma varredura em cada corte, um impacto na chamada, um clique em cada campo do cartão, um estalo em cada parte da lista. Tudo é gerado no computador do integrante e livre para usar em anúncio.

## 7. Mudar e refazer

1. Edite o `peca.json`.
2. Rode `preview <campanha> <conceito>`: o app refaz as páginas, a prévia de cada peça e a conferência.
3. Mostre a prévia nova ao integrante. Um sim dado a uma prévia antiga não vale para a nova.

Para recomeçar do modelo, rode `piece <campanha> <conceito> --force`, que reescreve o `peca.json` (as suas edições se perdem), ou `--template <modelo>` para trocar de modelo.
