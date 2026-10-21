---
name: motion-carousel
description: Cria carrosséis animados para o Instagram a partir de um tema: cada slide é um vídeo curto em loop (4:5) com movimento, som na batida e, se quiser, fotos; entrega os MP4 prontos para postar e uma prévia do feed. Use quando pedirem "faça um carrossel animado sobre…", "carrossel em vídeo", "carrossel com fotos" ou para refazer um slide de um carrossel já criado.
---

# Carrossel animado

O integrante dá um tema; você escreve o briefing e o roteiro, desenha cada slide como uma página que o Motor de vídeo renderiza, gera a trilha, confere e entrega os MP4. Os comandos partem da raiz do projeto, a pasta que contém `.flyee/` (a partir desta pasta, o script é `../../scripts/carousel.mjs`):

```
node .flyee/modules/motion-carousel/scripts/carousel.mjs <comando> [opções] --json
```

Comandos: `check`, `new`, `images`, `render`, `accept`, `open` e `help` (lista todas as opções). Só o JSON vai para o stdout; o progresso vai para o stderr. Em erro, `ok` é `false` e `error` traz `code`, `message` e `fix`. Reprovações da conferência não são erro: vêm com `ok: true` e `passed: false`.

Os guias: `../../references/slide-page.md` (como escrever um slide: todos os helpers e opções), `../../references/storyboard.md` (o roteiro e os eventos sonoros), `../../references/design-rules.md` (o estilo da casa), `../../references/sound.md` (a trilha, os efeitos, a música do integrante), `../../references/images.md` (as fotos: de onde vêm, como pedir, como usar), o exemplo completo em `../../references/exemplo/` (briefing, roteiro e cinco slides) e o exemplo com fotos em `../../references/exemplo-foto/` (três slides e as duas imagens dele). Leia `slide-page.md`, `design-rules.md` e os slides do exemplo antes de escrever o primeiro slide.

## Regras que não se quebram

- **Olhe antes de opinar.** Nunca diga que um slide ficou bom sem ter aberto e visto a folha de quadros dele. `ok: true` quer dizer que o arquivo existe, não que está certo.
- **O quadro 0 é a capa.** Todo slide nasce terminado no primeiro quadro: tudo o que faz parte dele tem `at: 0`, nada entrando.
- **E se mexe logo, sem parar.** No primeiro segundo ou dois algo sai e volta, conta, cresce ou viaja; depois, nenhum trecho passa de 1,25 s sem algo saindo, voltando, contando ou estourando; no último quadro tudo está como no primeiro.
- **Texto pelos helpers, com 44 px ou mais,** dentro da margem de 72 px e longe dos dois cantos do Instagram (o contador "1/N" no alto à direita, o botão de som embaixo à direita).
- **A página e o roteiro concordam.** `bars` e `bpm` são os mesmos nos dois; cada slide dura compassos inteiros.
- **Uma cor protagonista e um acento,** os do tema escolhido.
- **Nada inventado.** Todo número num slide vem do integrante ou de uma fonte que ele deu. Nenhuma promessa de alcance ou de engajamento, na arte ou na conversa. Sem o @ dele e sem logo de rede social na arte.
- **O integrante não usa o terminal.** Você roda tudo, inclusive a instalação de programas e de outros apps. O que só ele pode fazer volta como `needs_member`, com um passo único.
- **Nunca peça uma chave na conversa.** A chave do Gemini, opcional, só entra pela página que `npx --yes flyee@latest key set GEMINI_API_KEY --browser --json` abre no navegador do integrante; você nunca a lê, escreve num comando ou grava em arquivo.
- **Nunca edite nada dentro de `.flyee/`.** O trabalho fica em `carrosseis/<nome>/`.

## Passo 0: conferir a máquina (uma vez por sessão)

Rode `check --json`.

- `video_render.installed` falso: o render vem do app Motor de vídeo. Diga ao integrante numa frase simples que vai instalá-lo e o que ele faz ("Vou instalar o app Motor de vídeo, que transforma os slides em vídeo") e rode você mesmo o comando de `video_render.install` (`npx --yes flyee@latest add video-render --yes --json`), com tempo limite de 10 minutos, sem esperar resposta. Não liste permissões, arquivos nem programas. Repita o `check`.
- `modes.render` falso com o Motor instalado: falta o ffmpeg ou o navegador. Avise numa frase e rode você mesmo cada comando de `install` (`install.ffmpeg`, `install.browser`; para o ffmpeg, `npx --yes flyee@latest need ffmpeg --yes --json`), com tempo limite de 10 minutos. Se o resultado trouxer `needs_member`, mostre só o passo único indicado e espere. No Windows o Edge já vem instalado; sem `install.browser` e sem navegador, confira com o integrante se o Edge existe.
- `runtime.complete` falso: faltam arquivos deste app. Rode você mesmo `npx --yes flyee@latest add motion-carousel --yes --json`, com tempo limite de 10 minutos.
- `images` diz quem pode gerar imagens nesta máquina: `images.available` (`codex`, `gemini`, na ordem em que o comando `images` os usa), `images.codex.auth` (`chatgpt`: o plano do ChatGPT do integrante; `api_key`: uma chave da OpenAI, que cobra cada imagem) e `images.gemini_key`. Guarde para o Passo 2.
- Leia `warnings` e guarde `guides`: os caminhos dos guias e dos exemplos a partir da raiz do projeto.

## Passo 1: o briefing (na conversa)

Pergunte de uma vez só o que faltar: o **tema**, **para quem**, a **promessa** (o que a pessoa leva ao chegar ao último slide), o **tom**, a **palavra da chamada final** com o que a pessoa recebe ao comentar e, se o tema pedir, se ele quer **fotos** (as dele ou geradas). O resto você decide e diz:

- **Slides:** 5 é o padrão; de 3 a 7. O primeiro é `hook`, o último é `cta`, os do meio são `point` (ou `photo`, com foto), uma ideia cada.
- **Compassos:** 3 por slide (6 s a 120 BPM) e 4 na chamada final (8 s).
- **Tema visual** (`noir`, `cobalt`, `paper`, `forest`, `mono`) e **estilo da trilha** (`clean`, `noir`, `upbeat`, `lofi`, `pulse`), pelo tom: as tabelas estão em `design-rules.md` e em `sound.md`.
- O integrante quer a própria música? Só com o direito de uso confirmado; siga `sound.md`, seção 5. O `render` mede o andamento dela e avisa quando não combina com o `bpm` do roteiro; medir antes de escrever os slides é opcional e evita refazer a conta dos compassos.

## Passo 2: fotos ou estilo gráfico

O estilo gráfico (tipografia, formas, contadores, barras) é o padrão e não depende de nada. Foto vale quando o tema pede um lugar, um objeto, uma pessoa ou um clima, ou quando o integrante pede. Com fotos, cada imagem vem do primeiro degrau disponível, na ordem de `../../references/images.md`, seção 1, sem pular nenhum:

1. **Você mesmo,** se você gera imagens nesta conversa: gere em 4:5 e grave em `carrosseis/<nome>/assets/`.
2. **O Codex do integrante** (`codex` em `images.available`): o comando `images` usa a conta do ChatGPT dele, sem chave. Conectado por chave da OpenAI (`images.codex.auth` igual a `api_key`), o Codex fica fora da ordem automática, porque cada imagem seria cobrada nessa chave; use `--provider codex` só se ele pedir, depois de avisar numa frase.
3. **A chave do Gemini** (`gemini` em `images.available`): o mesmo comando `images` a usa sozinho.
4. **As fotos do integrante,** quando ele as tem (ele mesmo, o produto, o lugar) ou nenhum degrau acima existe: peça os arquivos e grave em `assets/` (`images.md`, seção 6).
5. **Sem fotos:** o estilo gráfico.

Sem os degraus 1 a 3, ofereça numa frase as três saídas: a chave do Gemini, opcional, que o Google não cobra no uso comum (se ele quiser, rode você mesmo `npx --yes flyee@latest key set GEMINI_API_KEY --browser --json`, que volta na hora e abre uma página no navegador dele para colar a chave, e rode `check --json` de novo quando ele disser que salvou), as fotos dele, ou o estilo gráfico. A chave nunca passa pela conversa.

## Passo 3: criar a pasta e escrever

1. Crie o carrossel:

   ```
   node .flyee/modules/motion-carousel/scripts/carousel.mjs new <nome> --title "…" --slides 5 --theme noir --style noir --json
   ```

   Outras opções: `--roles hook,point,photo,cta` (`photo` é o slide com foto; o gancho e a chamada também recebem foto, pelos helpers de `slide-page.md`, seção 5), `--bars 3`, `--cta-bars 4`, `--bpm 120`, `--format 4:5`, `--seed 7`; `--from-example` e `--from-photo-example` copiam um exemplo inteiro (o com fotos traz as imagens dele). O resultado traz `dir`, `brief`, `storyboard`, `slides[]` (com `n`, `role`, `bars`, `file`), `total_bars`, `total_duration` e `guides`. A pasta `carrosseis/<nome>/` nasce com `brief.md`, `storyboard.json`, `motion.js`, `carousel.js`, `assets/` e uma página por slide em `slides/`, do modelo de cada papel, com textos de amostra. Um `\n` no `--title` quebra a linha no título do gancho (`--title "Fevereiro\nmata\nacademias."`); o título do carrossel fica numa linha só. Erro `exists`: use outro nome, ou `--force` só com o sim do integrante.
2. **Com fotos,** grave as imagens em `assets/` agora, pelo degrau do Passo 2. Pelo comando (`images.md`, seções 2 e 3: descrição em inglês, a mesma luz e o mesmo estilo em todos os pedidos):

   ```
   node .flyee/modules/motion-carousel/scripts/carousel.mjs images <nome> --prompt "…" --out assets/fundo.jpg --json
   ```

   Um recorte leva `--cutout` e sai em `.png` ou `.webp`. Pelo Codex, cada imagem leva por volta de um minuto e meio: avise numa frase, use tempo limite de 10 minutos e rode um pedido por vez. Abra cada imagem e olhe antes de usar (`images.md`, seção 4). O modelo `photo` espera `assets/fundo.jpg` e `assets/assunto.png`: troque os caminhos em `images`, no bloco `SLIDE`, pelos arquivos que você gravou.
3. Preencha `brief.md`: Tema, Para quem, Promessa, Tom, Estrutura dos slides, Chamada final e, com fotos, Imagens (o arquivo, o que é e o pedido usado, como no exemplo com fotos).
4. Escreva cada `slides/NN.html` seguindo `slide-page.md`: edite o bloco `SLIDE` e troque os helpers dentro de `seek`. Troque **todo** texto de amostra. Para um contador, barras, a bola ou cartões, copie o padrão do slide correspondente do exemplo. Aplique `design-rules.md`: título em até 3 linhas com as quebras escolhidas por você, um recurso por slide, movimento desde o primeiro segundo. Com fotos, também a seção 8: uma foto herói por slide, o texto na cor `ink` sobre um degradê do lado em que ele está, nunca sobre um rosto ou o recorte.
5. **A revisão do texto.** Passe o texto de todos os slides pela skill `texto-natural`, que vem com o flyee, para tirar o que ainda soar como texto de IA. O tom do `brief.md` manda sobre ela, e o texto que o integrante escreveu não muda. Dela vale só o que tira cara de IA: ela não acrescenta número, promessa ou fato que ele não deu, e cada título continua cabendo em até 3 linhas. Troque nas páginas o que ela mudou.
6. Escreva o roteiro (`storyboard.md`): em cada slide, o `title`, os `events` (o `new` os deixa vazios: um efeito por gesto, nas mesmas batidas da página) e as `notes`.

## Passo 4: olhar e conferir, antes de renderizar

Os dois comandos abaixo leem só as páginas e levam menos de um minuto por slide. Faça os dois para cada slide antes de gastar tempo com o render.

1. Fotografe um quadro por batida (`--every` é `60 / bpm`; `--format` é o do roteiro):

   ```
   node .flyee/modules/video-render/scripts/render.mjs frames carrosseis/<nome>/slides/01.html --every 0.5 --format 4:5 --out carrosseis/<nome>/previa/quadros-01 --json
   ```

   Abra a imagem de `sheet` (a folha, um quadro por batida, na ordem) e o primeiro arquivo de `frames[]` (a capa, em tamanho real) e julgue como um editor: a capa está terminada e legível? Cada linha quebrou onde devia? O texto cabe, longe das bordas e dos dois cantos? Algo se mexe já no segundo ou terceiro quadro, e nunca há três quadros seguidos iguais? O último quadro é igual ao primeiro? Com fotos: as imagens apareceram (uma que não carregou some, ou vira um retângulo liso, e só o `render` avisa)? Alguma linha cruza uma parte clara da foto, ou o recorte encosta no texto? `warnings` traz os erros que a página registrou.
2. Confira:

   ```
   node .flyee/modules/motion-carousel/scripts/carousel.mjs accept <nome> --json
   ```

   `passed` diz se algo reprovou. Cada item de `slides[].checks` e de `checks` (o conjunto) tem `name`, `status` (`pass`, `fail`, `warn`, `skip`), `summary` e, quando reprova ou avisa, `fix`. Nesta fase valem `page`, `first_frame_readable`, `safe_area`, `text_size` e `loop_seamless`; `flashes`, `dead_time` e `loudness` ficam em `skip` até existir o vídeo final, e `cuts_on_beat` fica em `skip` porque os slides não declaram cortes.
3. Corrija a página, fotografe e confira de novo só o que mudou (`accept <nome> --slides 3 --json`), até não haver `fail` e a folha estar certa.

## Passo 5: a prévia com som

```
node .flyee/modules/motion-carousel/scripts/carousel.mjs render <nome> --preview --json
```

Gera a trilha (`audio/music.wav`), renderiza cada slide em metade do tamanho, sintetiza os efeitos, mixa em `previa/NN.mp4` e monta `preview.html`. Leva cerca de meio minuto por slide: use tempo limite de 10 minutos. Dividir (`--slides 1-3`, depois `--slides 4-7`) é opcional e só serve para ver os primeiros slides antes. Leia `warnings` (o aviso de 50% do tamanho é esperado; os outros, não), `pending` (slides que ficaram sem render) e o `loudness` de cada slide (perto de −14 LUFS).

Mostre ao integrante: `open <nome> --json` abre a prévia no navegador dele, um celular com o carrossel para deslizar, o contador e o botão de som (a prévia começa muda; "Som" liga). Diga o que você viu nos quadros e pergunte o que mudar antes do render final.

## Passo 6: render final, conferência e entrega

1. Renderize a versão final:

   ```
   node .flyee/modules/motion-carousel/scripts/carousel.mjs render <nome> --json
   ```

   Leva cerca de um minuto por slide: use tempo limite de 10 minutos. O progresso fica salvo slide a slide: se o comando for interrompido, rode-o de novo e os slides prontos são reaproveitados; se ele passar do tempo limite e seguir rodando em segundo plano, espere o fim em vez de começar outro. Confira que `pending` veio vazio. Os finais ficam em `out/NN.mp4`. `--sub 2` acrescenta desfoque de movimento quando algo cruza a tela depressa.
2. Confira tudo, agora com os vídeos: `accept <nome> --json`, sem `--slides`, para o `relatorio.json` ficar completo. Entram os itens medidos no vídeo: `flashes`, `dead_time` e `loudness`. `dead_time` avisa a partir de 1,5 s parado e diz o trecho: leve para dentro dele um par `out`/`back` de um elemento grande, como um título, um cartão ou o botão (um traço pequeno não conta; `design-rules.md`, seção 5), renderize esse slide de novo e confira. Um `fail` em `loudness` pede outra mixagem (`sound.md`, seção 4).
3. Olhe o que vai ser postado, slide por slide:

   ```
   node .flyee/modules/video-render/scripts/render.mjs sheet carrosseis/<nome>/out/01.mp4 --phone --out carrosseis/<nome>/previa/folha-01.png --json
   ```

   Abra `sheet` (o vídeo final, com o tempo em cada quadro) e `phone.file` (o teste de leitura no tamanho do celular).
4. `open <nome> --json`, e entregue: a pasta, os arquivos de `out/` na ordem, como postar (pelo aplicativo do Instagram, escolhendo os MP4 na ordem, como um só carrossel), o que a conferência disse item por item e uma sugestão de legenda com a palavra da chamada, que passa pela `texto-natural` antes de ser mostrada. Nunca omita uma reprovação nem um aviso.
5. Depois de uma tarefa real, registre o uso: `npx --yes flyee@latest track tool.executed --module motion-carousel`.

## Mudanças

- **Refazer um slide** ("troque a frase do slide 3"): edite `slides/03.html` (e o `title` e os `events` dele no roteiro), passe a frase nova pela `texto-natural` (o que o integrante ditou fica como ele disse), repita o Passo 4 para ele, depois `render <nome> --slides 3 --json` e a conferência completa. Os outros slides não são refeitos. A prévia mostra os arquivos do último `render`: prévia ou final.
- **Trocar uma imagem:** grave o arquivo novo em `assets/` com o mesmo nome (pelo comando `images`, um pedido diferente gera de novo; o mesmo pedido, só com `--refresh`) e olhe-o; depois `render <nome> --json`: só os slides que citam a imagem são refeitos.
- **Trocar a trilha:** mude `sound.style` ou `sound.seed` no roteiro e rode `render` de novo. Só o som é refeito.
- **Trocar o tema:** mude `theme` no bloco `SLIDE` de todas as páginas (e no roteiro).
- **Mudar compassos ou andamento:** no roteiro e nas páginas (`bars`, `bpm`, `beatsPerBar`, `totalBars`, `offsetBars`), juntos.
- **Acrescentar ou tirar um slide:** ajuste a lista `slides` do roteiro, crie a página a partir de uma do mesmo papel e atualize `n`, `total`, `totalBars` e `offsetBars` em todas.

## Problemas comuns

| `error.code` | O que fazer |
|---|---|
| `video_render_missing` | diga numa frase que vai instalar o app Motor de vídeo e rode você mesmo `npx --yes flyee@latest add video-render --yes --json`, com tempo limite de 10 minutos, sem esperar resposta; depois repita |
| `tools_missing`, `browser_missing` | avise numa frase e rode você mesmo os comandos de `install` do `check` (ou os de `fix`), com tempo limite de 10 minutos; `needs_member`: só o passo único |
| `runtime_missing` | faltam arquivos deste app: rode você mesmo `npx --yes flyee@latest add motion-carousel --yes --json`, com tempo limite de 10 minutos |
| `storyboard_invalid`, `invalid_json` | a mensagem diz o campo: corrija o `storyboard.json` (`storyboard.md`, seção 7), inclusive quando os compassos passam dos 64 da trilha gerada |
| `file_not_found` | uma página ou a música citada no roteiro não existe: corrija o caminho ou escreva a página |
| `carousel_not_found`, `preview_missing`, `exists` | o nome não existe em `carrosseis/`; ainda falta um `render`; a pasta já existe |
| `page_error` | a página tem um erro de JavaScript, e a mensagem diz qual: corrija o slide |
| `page_no_seek` | o script do slide parou antes de definir `seek`: um erro no bloco `SLIDE`, um tema desconhecido, ou `motion.js` e `carousel.js` fora da pasta do carrossel |
| `page_no_duration`, `format_unsupported` | a página perdeu o `Carousel.setup`: compare com um slide do exemplo |
| `browser_timeout`, `page_load_failed` | o `seek` não termina (um laço sem fim), ou a página não abre: corrija o slide |
| `usage` | uma opção ou um valor errado no comando: `help` lista todas |
| `no_image_provider`, `no_gemini_key`, `offline`, `unreadable_image` e os que começam com `codex_` ou `gemini_` | erros do comando `images`: siga `images.md`, seção 8. Sem quem gere imagens, volte ao Passo 2 e ofereça as três saídas; nunca peça a chave na conversa |
| `unreadable_media`, `no_audio_stream`, `audio_too_short`, `silent_audio`, `no_beats` | a música do integrante não abre ou não tem batida que se meça: confira o arquivo com ele, ou use a trilha gerada |
| `ffmpeg_failed`, `browser_failed`, `browser_exited`, `browser_protocol`, `video_render_failed`, `unexpected` | tente de novo uma vez; se repetir, repasse `message` e `fix` ao integrante |

Os demais códigos do Motor estão em `.flyee/modules/video-render/references/interface.md`; em todos, `message` e `fix` dizem o que fazer.
