# Imagens para os slides

Este guia é para a IA que está montando um carrossel com fotos: de onde vem cada imagem, como pedir, como conferir e como usar no slide. Um carrossel só de tipografia e formas não precisa de nada daqui.

## 1. A ordem que não se quebra

Toda imagem vem do primeiro caminho desta lista que estiver disponível. Só desça um degrau quando o de cima não atender.

| # | De onde | Quando vale | O que você faz |
|---|---|---|---|
| 1 | **Você mesmo** | Você tem uma ferramenta de gerar imagens nesta conversa (o Codex tem; outras IAs têm quando o integrante instalou uma extensão de imagem) | Gere com a sua ferramenta, em 4:5, e grave o arquivo em `carrosseis/<nome>/assets/`. Não rode o comando `images`. |
| 2 | **O Codex do integrante** | Você não gera imagens, mas o integrante tem o Codex neste computador com a conta do ChatGPT dele conectada | Rode o comando `images` (seção 2). Ele usa o plano do ChatGPT do integrante. Não pede chave. |
| 3 | **A chave do Gemini** | Não há Codex conectado, e o integrante salvou a chave do Gemini (o Google não cobra por ela no uso comum) | O mesmo comando `images` usa a chave sozinho. |
| 4 | **As fotos do integrante** | Ele tem fotos próprias, ou nenhum caminho acima existe | Peça os arquivos e grave em `assets/` (seção 6). |
| 5 | **Sem fotos** | Nada acima, ou o tema pede | Faça o carrossel no estilo gráfico: tipografia, formas, contador, barras. Fica bom e não depende de ninguém. |

Uma chave de API só entra quando nenhuma ferramenta de IA que o integrante já tem resolve. Nunca ofereça a chave antes de conferir os degraus 1 e 2.

Para saber em que degrau você está, rode uma vez:

```
node .flyee/modules/motion-carousel/scripts/carousel.mjs check --json
```

O bloco `images` responde:

| Campo | O que diz |
|---|---|
| `images.codex.installed`, `images.codex.logged_in` | o Codex existe neste computador e está com uma conta conectada |
| `images.codex.auth` | que conta: `chatgpt` (as imagens contam no plano do ChatGPT do integrante), `api_key` (o Codex entra com uma chave da OpenAI, e cada imagem é cobrada nela), `other`, ou `null` sem conta conectada |
| `images.gemini_key` | a chave do Gemini foi encontrada (o valor nunca aparece) |
| `images.gemini_key_from` | onde: `flyee` (salva pela página do navegador) ou `environment` (variável de ambiente, que tem prioridade) |
| `images.available` | os caminhos que o comando `images` consegue usar agora, na ordem: `codex`, `gemini` |
| `images.gemini_setup` | sem chave: onde criar (`key_url`), o comando que você roda (`command`) e o que fazer depois (`after`) |

Sem `--json`, o `check` resume o mesmo numa linha que começa com "Imagens:".

Com `images.codex.auth` igual a `api_key`, o Codex fica fora da ordem automática: cada imagem seria cobrada na chave da OpenAI que ele usa, e não no plano do ChatGPT. O comando `images` segue para a chave do Gemini, se houver. Só use `--provider codex` se o integrante disser que quer gerar pela chave da OpenAI dele, depois de você avisar numa frase que cada imagem é cobrada nela.

**A chave, quando o integrante quiser usá-la.** Ela é opcional. Diga onde criar (`images.gemini_setup.key_url`, com a conta Google dele) e rode você mesmo `npx --yes flyee@latest key set GEMINI_API_KEY --browser --json`: o comando volta na hora e abre uma página no navegador dele, onde ele cola a chave e clica em Salvar. A página vale por 15 minutos; quando ele disser que salvou, rode `check --json` de novo. Nunca peça a chave no chat, nunca a escreva num comando e nunca abra `~/.flyee/keys.json`. Se ele colar a chave na conversa, não a use: diga que ela ficou no histórico e que o certo é apagá-la no Google AI Studio e criar outra.

**Vídeo gerado por IA.** Este app não usa: o movimento dos slides é desenhado. Se um dia um slide pedir um trecho de vídeo gerado, vale a mesma ordem: a ferramenta da própria IA, depois outra que o integrante já tenha, e só então uma chave.

## 2. O comando `images`

```
node .flyee/modules/motion-carousel/scripts/carousel.mjs images <nome> --prompt "<descrição>" --out assets/<arquivo> --json
```

| Opção | Para quê |
|---|---|
| `--prompt "…"` | a descrição da imagem, em inglês (os modelos entendem melhor); veja as receitas na seção 3 |
| `--out assets/<arquivo>` | onde gravar, sempre dentro de `assets/` do carrossel: `.jpg` para fundos; `.png` ou `.webp` para recortes |
| `--cutout` | recorte: o assunto sai com fundo transparente, pronto para ficar em cima de outra imagem |
| `--aspect 4:5` | a proporção (padrão: a do carrossel); também `3:4`, `1:1`, `9:16`, `16:9`, `3:2`, `2:3`, `4:3`, `5:4`, `21:9` |
| `--provider auto\|codex\|gemini` | quem gera; `auto` (padrão) segue a ordem da seção 1 e passa ao próximo se o primeiro falhar |
| `--reference <arquivo>` | uma imagem de referência de estilo ou de assunto; deixe-a também em `assets/` |
| `--refresh` | gera de novo; sem isso, o mesmo pedido devolve o arquivo que já existe |
| `--model <nome>` | só no Gemini: outro modelo de imagem (padrão: `gemini-3.1-flash-image`) |
| `--key-similarity 0.35`, `--key-blend 0.1`, `--key-color 00FF00`, `--key-mode colorkey\|chromakey` | ajustes do recorte quando quem gera é o Gemini (seção 4) |

O caminho de `--out` é a partir da pasta do carrossel. Ao lado de cada imagem gerada fica um arquivo com o pedido que a gerou (`assets/fundo.jpg.json`): é por ele que o mesmo pedido devolve o arquivo que já existe.

A resposta:

| Campo | O que é |
|---|---|
| `file` | o arquivo gravado, a partir da raiz do projeto |
| `page_path` | o caminho para usar dentro da página do slide (`../assets/…`) |
| `provider` | quem gerou de fato: `codex` ou `gemini` |
| `model` | o modelo, quando quem gerou foi o Gemini |
| `width`, `height` | o tamanho em pixels |
| `cutout` | num recorte: `transparent_ratio` (a fração transparente do quadro) e como foi feito |
| `cached` | `true` quando o arquivo já existia para o mesmo pedido |
| `warnings` | avisos: um caminho falhou e outro assumiu, o recorte ficou suspeito |

O Codex leva por volta de um minuto e meio por imagem, às vezes mais; o Gemini, uns 15 segundos. Diga ao integrante numa frase antes de começar, e rode com o tempo limite mais longo que puder (10 minutos ou mais). Rode um pedido por vez, nunca dois ao mesmo tempo (pelo Codex, eles podem trocar as imagens entre si), e olhe cada imagem antes de pedir a próxima.

Quando a configuração do Codex do integrante pede um modelo que a conta dele não aceita, o comando tenta uma segunda vez sem essa configuração, com o modelo padrão do Codex e a mesma conta; uma linha de progresso avisa. Isso pode dobrar a espera, e não muda nada nas configurações dele.

## 3. Receitas de pedido

Escreva em inglês, concreto, na ordem: assunto, cenário, luz, estilo. O app já acrescenta sozinho que a imagem preenche o quadro sem moldura e, nos recortes, o fundo certo para recortar.

**Fundo (ocupa o slide inteiro; o texto vai por cima).** Peça espaço vazio onde o texto vai ficar e pouca informação nas bordas.

```
--prompt "Moody photograph of an empty gym at dawn, dark concrete walls, a single warm window light on the left, racks in shadow on the right, cinematic, fine film grain, no people" --out assets/fundo.jpg
```

**Assunto recortado (um objeto ou uma pessoa por cima do fundo).** Um assunto só, inteiro, com margem em volta.

```
--prompt "Product photograph of a single matte black kettlebell with a worn steel handle, three-quarter view, soft rim light from the left, sharp focus" --cutout --out assets/halter.webp
```

**Coerência entre os slides.** Repita as mesmas palavras de luz e de estilo em todos os pedidos do carrossel ("cinematic, fine film grain, warm window light"). Use o mesmo fundo em mais de um slide: a continuidade vem dele.

**O que não pedir.** Texto dentro da imagem (o texto é do slide, nítido e editável), logos e marcas de terceiros, rostos de pessoas reais, celebridades.

## 4. Confira antes de usar

Abra o arquivo e olhe. Não descreva nem use uma imagem que você não viu.

- **Moldura ou margem branca:** repita com `--refresh`.
- **Texto ou logo que ninguém pediu:** repita com `--refresh`, dizendo "no text, no logos" no pedido.
- **Mãos, olhos, objetos deformados:** repita, ou troque o enquadramento ("from behind", "close-up of the hands holding…").
- **Recorte:** `cutout.transparent_ratio` de um assunto inteiro costuma ficar entre 0,6 e 0,9. Abaixo de 0,3 o fundo não saiu; acima de 0,97 o assunto foi apagado junto. O comando avisa nos dois casos. Com o Gemini, um contorno esverdeado pede `--key-similarity` maior (0,40 a 0,45); um assunto com buracos pede menor (0,28 a 0,30). Roupa ou objeto verde pede `--key-color 0000FF`.

## 5. A imagem no slide

Use o modelo de slide com foto (o papel `photo` no comando `new`, por exemplo `--roles hook,photo,cta`) ou os helpers de `slide-page.md`, seção 5:

```js
const ready = C.loadImages({ fundo: "../assets/fundo.jpg", assunto: "../assets/halter.webp" });
window.seek = async (t) => {
  await ready;
  C.begin(t);
  C.image("fundo", { depth: 0.35, dim: 0.3 });           // preenche o quadro, deriva devagar, escurecido
  C.scrim({ side: "top", size: 0.6, alpha: 0.88 });      // degradê para o título ler bem
  C.scrim({ side: "left", size: 0.6, alpha: 0.55 });     // e atrás da coluna das frases
  const title = C.headline(S.title, { y: 176, size: 132 });
  C.body(S.text, { y: title.bottom + 80, size: 56, maxWidth: 520 });
  C.image("assunto", { x: 0.44, y: 0.36, w: 0.52, h: 0.46, fit: "contain", anchor: "bottom-right", depth: 1, shadow: true });
  return C.end();
};
```

- Texto nunca vai direto sobre a foto: sempre com um `scrim` por baixo, do lado do quadro em que ele está, ou com a foto escurecida (`dim` de 0,35 ou mais). E sempre na cor `ink` do tema: o cinza `muted` some na foto.
- Texto nunca cobre um rosto, e o assunto recortado fica fora da área do texto.
- O fundo mexe pouco (`depth` perto de 0,3) e o assunto mexe mais (perto de 1): é o que dá profundidade. Os dois voltam ao lugar no fim do slide, e o loop fecha.
- Uma foto por slide como herói. Cor de acento: uma só, a do tema. As regras de estilo com fotos estão em `design-rules.md`, seção 8.
- Um carrossel completo com fotos está em `.flyee/modules/motion-carousel/references/exemplo-foto/`; `new <nome> --from-photo-example` o copia, com as imagens.

## 6. Fotos do integrante

Peça assim: "Você tem fotos suas para este carrossel? Me passe os arquivos, e eu coloco na pasta do carrossel." Grave em `carrosseis/<nome>/assets/` com nomes simples (`fundo.jpg`, `eu.png`).

- **Formato:** JPEG ou PNG, com pelo menos 1080 px no lado menor. Fotos na vertical rendem mais no 4:5.
- **Foto inteira no slide:** `C.image("foto", { fit: "cover", focusX: 0.5, focusY: 0.3, dim: 0.4 })`, ou um `dim` menor com um `scrim` do lado do texto; `focusX` e `focusY` dizem que parte fica à vista quando a proporção é outra.
- **Foto num quadro:** `C.image("foto", { x: 0.5, y: 0.34, w: 0.42, h: 0.4, radius: 28, role: "face" })`. Não precisa de recorte e fica bem.
- **Pessoa recortada (sem fundo):** peça a foto já sem fundo, em PNG. Muitos celulares e aplicativos de foto fazem isso em um toque. O app não recorta a foto de uma pessoa real: gerar de novo a partir da foto mudaria o rosto dela.
- **Logo do integrante:** PNG com transparência, no lugar do rótulo: `C.image("logo", { x: 72, y: 96, w: 220, h: 80, fit: "contain", anchor: "left", role: "logo" })`.
- Como em qualquer imagem: carregue com `C.loadImages` e espere `await ready` no `seek` (`slide-page.md`, seção 5).

## 7. Cuidados

- **Pessoas reais:** só com a foto e a autorização da própria pessoa. Nunca gere a imagem de alguém que existe.
- **Marcas de terceiros:** não gere nem use logos e produtos de outras empresas.
- **Imagem gerada é imagem gerada:** não a apresente como foto real do integrante, do produto ou de um cliente. Em anúncio, depoimento e antes-e-depois, use foto de verdade.
- **Marca d'água invisível:** imagens geradas podem levar uma marca que identifica a origem. É normal.
- **Uso do plano:** as imagens pelo Codex contam no limite do plano do ChatGPT do integrante (ou são cobradas na chave da OpenAI, quando `images.codex.auth` é `api_key`); as do Gemini, no limite da chave dele. Gere o que o carrossel precisa, não variações à toa.

## 8. Erros do comando

| `error.code` | O que fazer |
|---|---|
| `no_image_provider` | não há Codex conectado nem chave: siga a ordem da seção 1 a partir do degrau 3 (oferecer a chave, pedir fotos, ou seguir sem fotos) |
| `codex_missing`, `codex_not_logged_in` | você pediu `--provider codex` e ele não está disponível: repita com `--provider auto` |
| `codex_failed` | o Codex terminou sem imagem; com `auto`, o Gemini já teria assumido se houvesse chave. Repita, ou siga para o próximo degrau |
| `codex_quota`, `gemini_quota` | o limite do plano ou da chave acabou por agora: espere, ou use as fotos do integrante |
| `no_gemini_key` | você pediu `--provider gemini` sem chave: mostre o passo da chave (seção 1) ou use `auto` |
| `gemini_invalid_key`, `gemini_permission` | a chave não foi aceita: o integrante confere no Google AI Studio e salva de novo pela página |
| `gemini_refused` | o modelo recusou o pedido: reescreva a descrição |
| `gemini_model_not_found` | o modelo de `--model` não existe ou não está liberado para a chave: repita sem `--model` |
| `gemini_failed` | o Gemini recusou ou devolveu algo ilegível: leia `fix` e repita |
| `gemini_unavailable`, `offline` | instabilidade ou sem internet: tente de novo em alguns minutos |
| `tools_missing` | falta o ffmpeg: rode você mesmo o comando de `fix`, com tempo limite longo, e repita |
| `unreadable_image`, `ffmpeg_failed` | a imagem gerada não abriu ou não pôde ser gravada: repita com `--refresh` |
| `carousel_not_found` | o carrossel não existe: crie-o com `new` antes de pedir as imagens |
| `file_not_found` | a imagem de referência não existe no caminho dado |
| `usage` | uma opção errada (a saída fora de `assets/`, um recorte em `.jpg`, uma proporção desconhecida): corrija o comando, `fix` diz como |
