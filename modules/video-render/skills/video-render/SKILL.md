---
name: video-render
description: Transforma uma página animada (HTML que desenha qualquer instante) em vídeo pronto para as redes, com trilha e efeitos na batida, prévia, captura da marca de um site e conferência antes de publicar. Use quando pedirem "transforme esta página em vídeo", "faça uma prévia", "coloque uma trilha na batida", "confira este vídeo para o Reels" ou quando outro app precisar renderizar.
---

# Motor de vídeo

O integrante descreve o vídeo; você escreve a página que o desenha e o Motor a transforma em vídeo com som, conferido e no formato pedido. Os comandos partem da raiz do projeto, a pasta que contém `.flyee/` (o script é `../../scripts/render.mjs` a partir desta pasta):

```
node .flyee/modules/video-render/scripts/render.mjs <comando> [opções] --json
```

Só o JSON vai para o stdout; o progresso vai para o stderr. Em erro, `ok` é `false` e `error` traz `code`, `message` e `fix`. Todas as opções, padrões e campos estão em `../../references/interface.md`; aqui fica o caminho.

## Regras que não se quebram

- **Nunca descreva um vídeo que você não viu.** Abra a folha de contato ou os quadros antes de dizer que ficou bom: `ok: true` quer dizer que o arquivo existe, não que está certo.
- **Toda página é uma função pura do tempo.** `window.seek(t)` desenha o quadro do instante `t`, e o mesmo `t` dá sempre o mesmo quadro: sem temporizadores, sem `requestAnimationFrame`, sem transições de CSS, sem `Math.random`, sem estado guardado entre quadros. Vídeo diferente a cada render é página errada, nunca o Motor.
- **Nunca chame de pronto um vídeo com item reprovado.** Mostre cada `fail` do `accept` e o que fazer; entregue depois de corrigir, ou quando o integrante decidir publicar assim mesmo, sabendo o quê.
- **Marca de verdade.** Logo, cores, fontes, telas e números vêm da captura do site ou de arquivos do integrante; nunca invente um logo, uma cor "parecida" ou um número.
- **O integrante não usa o terminal.** Você roda tudo, inclusive a instalação dos programas. O que só ele pode fazer volta como `needs_member`, com um passo único.

## Passo 0: a máquina (uma vez por sessão)

```
node .flyee/modules/video-render/scripts/render.mjs check --json
```

- `install` com algum comando: diga numa frase que vai instalar o que falta e rode você mesmo cada comando de `install` (o do ffmpeg é `npx --yes flyee@latest need ffmpeg --yes --json`; no Mac e no Linux, o do navegador vem pronto ali), com tempo limite longo (até 10 minutos). Depois repita o `check`.
- A instalação devolveu `needs_member`: mostre ao integrante só o passo único indicado (a senha de administrador, o Homebrew ausente) e espere.
- No Windows, `tools.browser` nulo: o Microsoft Edge vem com o sistema; confira com o integrante se ele está instalado.

## Passo 1: a página

- Pedido novo: crie a página de exemplo e reescreva as cenas.
  ```
  node .flyee/modules/video-render/scripts/render.mjs scaffold <pasta> --format 9:16 --duration 15 --name "Título" --json
  ```
  Siga `../../references/pagina.md` (o contrato) e `../../references/motion.md` (o método de animação); a biblioteca é `../../runtime/motion.js`. `Motion.setup({...})` declara o filme, tudo é desenhado em `seek(t)`, os cortes ficam em `film.cuts`, `window.setFormat` recompõe o layout (o Motor a exige sempre que recebe `--format`) e `window.boxes(t)` declara texto, logo e rosto para a conferência.
- Página que o integrante já tem: confira `window.seek`, `film.duration` e o determinismo antes de renderizar; corrija o que faltar e diga o que mudou.
- A marca: capture o site dele; logo, cores, fontes, botões, números e telas ficam em `capturas/<site>/captura.json`.
  ```
  node .flyee/modules/video-render/scripts/render.mjs capture https://www.exemplo.com.br --json
  ```
- Vários formatos (9:16, 4:5, 3:4, 1:1, 16:9) saem da mesma página: veja `../../references/formatos.md`.

## Passo 2: o som, antes de animar

- **`music` ou `synth`?** Para um vídeo que se assiste uma vez (um Reels de 15 a 20 s, um anúncio), `music` compõe uma peça com arco na duração do filme: introdução, crescimento, ponto alto (`drop`) e uma pancada final no último tempo 1. Estilos `clean`, `energetic`, `warm`, `minimal`, `cinematic`, `playful`.
  ```
  node .flyee/modules/video-render/scripts/render.mjs music --out <pasta>/trilha.wav --duration 15 --bpm 120 --style energetic --json
  ```
  Para um loop ou um carrossel, `synth` faz compassos inteiros que repetem sem clique; cada slide toca uma fatia da mesma trilha (`mix --music-offset`). Estilos `clean`, `noir`, `upbeat`, `lofi`, `pulse`.
  ```
  node .flyee/modules/video-render/scripts/render.mjs synth --out <pasta>/trilha.wav --bpm 120 --bars 8 --style noir --json
  ```
  As duas gravam ao lado `<pasta>/trilha.beats.json`, a grade exata; a mesma `--seed` refaz a mesma trilha.
- Música que o integrante trouxe (só com direito de uso): meça a grade. Com `confidence` abaixo de 0,5, confirme o BPM com ele e passe `--bpm`.
  ```
  node .flyee/modules/video-render/scripts/render.mjs beats <música> --out <pasta>/beats.json --json
  ```
- Na página, `Motion.beatGrid(bpm, offset)` com os números do `beats.json`: cortes e entradas em `grid.beat(n)`, arredondados com `Motion.toFrame(t, fps)`; a maior mudança no `drop`. O método é `../../references/som.md`.
- Efeitos, uma deixa por gesto visível, numa lista de eventos (`{ "duration": 15, "events": [{ "t": 2, "type": "whoosh" }] }`) ou de deixas: os tipos e campos de cada lista estão em `../../references/interface.md`. Cada som começa no seu `t`: um `riser` que termina no drop vai em drop menos a duração dele.
  ```
  node .flyee/modules/video-render/scripts/render.mjs sfx --out <pasta>/efeitos.wav --events <pasta>/eventos.json --json
  ```

## Passo 3: prévia e olhar

```
node .flyee/modules/video-render/scripts/render.mjs preview pagina.html --json
node .flyee/modules/video-render/scripts/render.mjs frames pagina.html --beats <pasta>/trilha.beats.json --json
```

A prévia sai em metade do tamanho; leia `warnings` (erros de JavaScript da página aparecem ali). O `frames` fotografa um quadro por batida (ou `--every 0.5`, ou `--times 0,0.5,2`) e monta `quadros/folha.png`. Abra a folha e os quadros que importam e olhe de verdade: hierarquia, texto dentro da área segura, leitura no celular, movimento que faz sentido, nada parado sem motivo e o quadro 0 pronto para ser a capa. Corrija a página e repita até a folha estar certa.

## Passo 4: conferir antes do render final

```
node .flyee/modules/video-render/scripts/render.mjs accept pagina.html --beats <pasta>/trilha.beats.json --networks reels,tiktok,shorts --json
```

Num slide de carrossel em loop, troque `--networks …` por `--format 4:5 --safe instagram-carousel --loop`. A página passa por `page`, `first_frame_readable`, `safe_area`, `text_size`, `cuts_on_beat` e, com `--loop`, `loop_seamless`; com `--networks`, cada rede confere `format_supported` e `duration`. `passed: false` é peça reprovada: cada `fail` traz `fix`; corrija a página e confira de novo. `warn` é aviso a repassar; `skip` diz o que faltou para medir. O guia dos itens é `../../references/aceite.md`, e as redes, com formatos, durações e zonas seguras, vêm de `networks --json`.

## Passo 5: render, mixagem, conferência do vídeo e entrega

1. O render final, mudo (`--sub 2` dá desfoque de movimento; `--format` para outro formato; camada transparente com `--alpha --out camada.mov`, nunca `.mp4`):
   ```
   node .flyee/modules/video-render/scripts/render.mjs render pagina.html --out <nome>-mudo.mp4 --json
   ```
2. A mixagem: `--music-offset <s>` pega a fatia de um slide, `--voice voz.wav` põe a voz na frente, `--fade-out 0` num loop. Confira `loudness` no resultado (−14 LUFS, pico real até −1 dBTP).
   ```
   node .flyee/modules/video-render/scripts/render.mjs mix --video <nome>-mudo.mp4 --music <pasta>/trilha.wav --sfx <pasta>/efeitos.wav --out <nome>.mp4 --json
   ```
3. Olhe o vídeo pronto: a folha de contato, com o tempo carimbado, e o teste de leitura no celular (`--strip <tempo>` acrescenta 12 quadros seguidos em volta de uma transição).
   ```
   node .flyee/modules/video-render/scripts/render.mjs sheet <nome>.mp4 --phone --json
   ```
4. A conferência do vídeo pronto, com o vídeo primeiro: entram `flashes`, `dead_time`, `loudness` e, por rede, `format_supported` e `duration` (sem `--networks`, as redes habituais do formato). O relatório fica em `<nome>.aceite.json`.
   ```
   node .flyee/modules/video-render/scripts/render.mjs accept <nome>.mp4 --page pagina.html --beats <pasta>/trilha.beats.json --networks reels,tiktok,shorts --json
   ```
   Num slide de carrossel: `accept pagina.html --format 4:5 --safe instagram-carousel --loop --beats … --video <nome>.mp4 --json`.
5. Mostre o vídeo e diga onde ficou cada arquivo, o que a conferência disse (aprovado ou reprovado, e por quê) e o que você mudou para passar. Nunca omita uma reprovação.
   ```
   node .flyee/modules/video-render/scripts/render.mjs open <nome>.mp4 --json
   ```
6. Depois de uma tarefa real, registre o uso: `npx --yes flyee@latest track tool.executed --module video-render`.

## Quando outro app pede o render

Siga `../../references/interface.md`, o mesmo guia que o outro app lê, e devolva a ele o que ele pediu (`file`, `frames_hash`, o resultado do `accept`). Páginas, trilhas e vídeos de outros apps ficam nas pastas deles, fora de `.flyee/`; nunca edite arquivos do Motor.

## Problemas, por `error.code`

| `error.code` | O que fazer |
|---|---|
| `tools_missing`, `browser_missing` | rode você mesmo os comandos de `fix` (ou de `install` no `check`), com tempo limite longo; depois repita |
| `page_no_seek`, `page_no_duration` | a página não segue o contrato: defina `window.seek(t)` e `window.film.duration` (veja `../../references/pagina.md`) |
| `page_error`, `page_load_failed` | corrija o JavaScript da página ou o caminho do arquivo |
| `browser_timeout` | `seek(t)` não termina: um loop, um vídeo que nunca carrega ou uma promessa pendente; corrija a página |
| `format_unsupported` | a página não tem `window.setFormat`: acrescente-a, ou renderize sem `--format`, no tamanho dela |
| `alpha_needs_mov`, `output_format` | troque a extensão: `.mov` ou `.webm` com `--alpha`; `.mp4`, `.mov` ou `.webm` sem |
| `exists` | a pasta do `scaffold` já tem uma página: use outra pasta, ou `--force` só com o sim do integrante |
| `file_not_found`, `invalid_json`, `unreadable_media` | confira o caminho e o arquivo com o integrante |
| `no_audio_stream`, `audio_too_short`, `silent_audio`, `no_beats` | o arquivo não tem som que dê para medir: peça outra música, ou passe `--bpm` |
| `cues_invalid` | a lista de deixas do `sfx` está errada: `message` diz qual deixa e qual campo |
| `no_video_stream` | o `accept` recebeu um arquivo sem imagem: passe o vídeo renderizado |
| `unknown_network` | a rede não existe na tabela: `networks --json` lista os nomes e os apelidos |
| `networks_table_invalid` | a tabela das redes do app está corrompida: repasse `message` e `fix` ao integrante |
| `site_blocked`, `site_unreachable`, `invalid_url`, `capture_failed` | o site barrou o navegador ou não abre: peça as telas ao integrante ou outro endereço |
| `ffmpeg_failed`, `browser_failed`, `browser_exited`, `browser_protocol`, `unexpected` | tente de novo uma vez; se repetir, repasse `message` e `fix` |
| `tool_timeout` | o ffmpeg travou e foi encerrado ao passar do tempo limite: tente de novo uma vez; se travar de novo, divida o trabalho (um trecho mais curto, menos quadros por vez) |
| `usage` | uma opção ou um valor errado: `fix` e `help --json` mostram o certo |
