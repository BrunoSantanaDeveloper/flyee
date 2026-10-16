---
name: motion-video
description: Cria vídeos animados na vertical para Reels, TikTok e Shorts a partir de um pedido. Pergunta só o que falta, usa a marca real (logo, cores e telas do site), põe trilha e efeitos na batida, mostra uma prévia e entrega o vídeo conferido. Use quando pedirem "faça um vídeo animado", "um Reels da minha loja", "vídeo de lançamento", "passo a passo animado", "anúncio animado" ou "vídeo para o TikTok".
---

# Estúdio de vídeo: vídeo animado

O integrante pede um vídeo; você conduz o briefing, busca a marca de verdade, escreve o roteiro e a página, mostra a prévia e entrega o vídeo final. Os comandos partem da raiz do projeto, a pasta que contém `.flyee/` (o script fica em `../../scripts/studio.mjs` a partir desta pasta):

```
node .flyee/modules/video-studio/scripts/studio.mjs <comando> [opções] --json
```

Só o JSON vai para o stdout; o progresso vai para o stderr. Em erro, `ok` é `false` e `error` traz `code`, `message` e `fix`. **Todo resultado traz `next_step`**: `action` (o que vem agora), `command` (o comando exato a rodar, quando há um) e `say` (uma frase para dizer ao integrante). Siga o `next_step`: é ele que mantém a ordem certa, inclusive ao retomar um vídeo depois de uma pausa.

Os guias desta pasta: `../../references/roteiros.md` (os cinco roteiros e as lacunas de cada cena), `../../references/estilos.md` (os estilos e como descrevê-los), `../../references/pagina-do-video.md` (como o roteiro vira a página e como ajustar uma cena) e `../../references/perguntas.json` (o texto de todas as perguntas).

## Regras que não se quebram

- **Nunca diga que o vídeo ficou bom sem ter olhado.** Abra a folha de quadros da prévia antes de qualquer opinião. Texto cortado, pequeno ou fora da zona segura é erro seu, mesmo com `ok: true`.
- **Só o que é real.** Logo, cores, telas e números vêm do site capturado, dos arquivos do integrante ou do que ele disse. Nunca redesenhe uma tela de imaginação, nunca escolha uma cor "parecida", nunca invente um número, um preço ou um prazo. Sem prova real, a cena de prova sai do roteiro.
- **Pergunte com as palavras do app.** As perguntas, as opções e os padrões vêm prontos em `round`; use-os como estão. Não acrescente perguntas suas e não pergunte o que o pedido, o projeto ou o site já respondem.
- **O `pedido.json` é do script.** Nunca o edite à mão: respostas entram por `answer`, aprovações por `approve`. O `roteiro.json` e a `pagina.html` você pode ajustar.
- **Nunca chame de pronto um vídeo com item reprovado na conferência.** Mostre cada `fail` e o que fazer; entregue depois de corrigir, ou quando o integrante decidir publicar assim mesmo, sabendo o quê.
- **O integrante não usa o terminal.** Você roda tudo, inclusive a instalação de programas e de outros apps pela CLI. O que só ele pode fazer volta como `needs_member`, com um passo único.
- **Um "ok" solto aceita os padrões de uma rodada de perguntas, nunca uma decisão de direitos** (marca de terceiros, publicidade, regras do setor): essas pedem resposta própria.

## Passo 0: conferir a máquina (uma vez por sessão)

Rode `check --json`.

- `video_render.installed` falso: o render vem de outro app, o Motor de vídeo. Rode você mesmo o comando de `video_render.dry_run` (`npx --yes flyee@latest add video-render --dry-run --json`) e diga ao integrante, numa frase, o que ele declara (os programas e as permissões). Com o sim dele, rode o comando de `video_render.install` (`npx --yes flyee@latest add video-render --yes --json`, o `after_yes` do `next_step`) com tempo limite de 10 minutos. Depois repita o `check`.
- `modes.render` falso: falta o ffmpeg ou o navegador. Avise numa frase e rode você mesmo cada comando de `install` (a forma é `npx --yes flyee@latest need <programa> --yes --json`), com tempo limite de 10 minutos. A instalação devolveu `needs_member`: mostre só o passo único indicado e espere.
- Guarde `guides` (os caminhos dos guias) e `features` (o que esta versão faz).

## Passo 1: o pedido

1. Grave o pedido do integrante, palavra por palavra, sem resumir nem traduzir, num arquivo de texto em UTF-8: `estudio-de-video/pedido.txt`.
2. Rode `intake --request estudio-de-video/pedido.txt --json`. O resultado traz `slug` (o nome da pasta do vídeo), `sufficiency` (`completo`, `parcial` ou `vazio`), `fields` (o que foi entendido e de onde veio), `linha` (o plano em uma frase), `round` (as perguntas, quando há) e `next_step`.
3. `unsupported` não vem vazio? O pedido inclui algo que esta versão não faz (editar uma gravação, cenas geradas, outro formato, assistir a uma referência, mais de 20 segundos). Diga isso numa frase simples, sem link, e ofereça o vídeo animado na vertical.
4. Sem `round`: mostre a `linha` ao integrante e siga o `next_step` sem esperar. Com `round`: Passo 2.

## Passo 2: as perguntas

Uma rodada por vez, com no máximo quatro perguntas.

- **Sua ferramenta tem perguntas com opções clicáveis?** Use `round.ask_user_question` como está (a primeira opção de cada pergunta é a recomendada). As perguntas de `round.ask_in_text` vão em texto simples, na mesma mensagem.
- **Só conversa em texto?** Envie `round.chat_text` como está.
- Diga a `round.note`: o integrante responde só o que quiser.
- Registre cada resposta: `answer <slug> <id> <valor> --json` (o `value` da opção escolhida, ou o texto livre). Várias de uma vez: grave `{ "id": "valor" }` num arquivo e rode `answer <slug> --file <arquivo> --json`.
- Depois de registrar o que ele respondeu, rode `answer <slug> --decide --json`: o que ficou sem resposta naquela rodada recebe o padrão, como a nota prometeu. "Decida por mim", "tanto faz" ou "ok" para a rodada inteira é o mesmo comando.
- "O resto decide você" (para todas as rodadas que faltam): `answer <slug> --decide all --json`. Só continua sendo perguntado o que não tem padrão possível, como a marca.
- O resultado traz a próxima rodada, ou o `next_step` seguinte (capturar a marca, mostrar o briefing).

## Passo 3: a marca

`next_step.action` é `capture`: avise numa frase que vai visitar o site e rode `capture <slug> --json` (tempo limite de alguns minutos). O resultado traz `brand` (nome, cores, fontes, logo, telas, produtos, números com a página de origem) e `warnings`.

- Veio `confirm` (a marca foi achada só pelo nome, ou a captura ficou incerta)? Faça a pergunta `conferir_marca` antes de seguir e registre com `answer`.
- O site bloqueou ou não abriu? O vídeo segue com visual neutro: diga isso e peça, na pasta `estudio-de-video/<slug>/materiais/`, o logo e duas ou três imagens. `open <slug> pasta` abre a pasta para ele.
- O integrante só tem o nome da marca, sem site? Procure o site oficial na internet, mostre o endereço e registre com `answer <slug> marca <endereço>` depois do sim dele.

## Passo 4: o briefing

`next_step.action` é `echo`: rode `brief <slug> --json` e mostre `echo` ao integrante como está, seguido da pergunta `question` ("Posso construir assim?").

- Sim: `approve <slug> brief --json`.
- Quer mudar algo: registre a mudança com `answer` e rode `brief` de novo.

No pedido completo e no parcial não há esta parada: a `linha` já disse o plano.

## Passo 5: construir, olhar e mostrar a prévia

1. `build <slug> --json` escreve o `roteiro.json` (as cenas na grade de batidas), a `pagina.html` e os efeitos. Aviso em `warnings` que muda o que o integrante pediu (a duração, quando o roteiro não cabe no tempo pedido) vai para ele numa frase, junto com a prévia. Leia `scenes` (cada cena com o texto e os tempos): algum texto ficou longo, trocado ou sem sentido? Ajuste o `roteiro.json` seguindo `../../references/roteiros.md` e rode `build` de novo: ele guarda o roteiro que você editou e reescreve a página a partir dele. Passe também os textos da tela pela skill `texto-natural`, que vem com o flyee, para tirar o que soar como texto de IA: o que o integrante escreveu não muda, ela não acrescenta fato, número ou promessa, e cada texto continua no limite de palavras da cena. No roteiro passo a passo, a cena `resultado` só entra quando o integrante disse o que a pessoa tem no fim. Mudança feita à mão na `pagina.html` some no próximo `build`; ajuste fino que precisa ficar vai no roteiro, ou siga `../../references/pagina-do-video.md`. `build --force` descarta também as suas edições do roteiro e o redesenha do briefing (o anterior fica em `roteiro.anterior.json`).
2. `preview <slug> --json` compõe a trilha, renderiza em tamanho de celular, mixa o som e confere. Leia `warnings` e `accept`.
3. **Olhe antes de mostrar.** Abra a imagem de `sheet` (um quadro por batida) e julgue como um diretor exigente: o primeiro quadro já é uma capa legível? Cada cena tem um protagonista claro? O texto cabe e está longe das bordas? Acontece algo novo a cada 2 a 4 segundos? Dê notas de 1 a 10 para abertura, leitura no celular, movimento, variedade, fidelidade à marca e som, corrija os três piores problemas (no roteiro, ou na página seguindo `../../references/pagina-do-video.md`) e rode `preview` de novo. No mínimo duas rodadas; pare quando tudo for 8 ou mais, ou depois de cinco, dizendo o que ficou abaixo.
4. Item com `status: "fail"` em `accept`: corrija e repita. `warn` é aviso a repassar.
5. Mostre a prévia: `open <slug> previa --json` abre o vídeo no player dele. Na conversa, liste os textos de `texts` (com a origem de cada número) e faça a pergunta `question` (`previa_ok`). Vieram também `questions`? Faça-as na mesma mensagem: `abertura` oferece outras frases de abertura tiradas do site; `publi` pergunta se o vídeo é publicidade paga por outra marca. Registre as respostas com o `answer_command` de cada uma.
   - Sim: `approve <slug> preview --json`.
   - Quer ajustar: mude o roteiro ou a página, rode `preview` de novo e mostre outra vez. Texto, tempo e música mexem na grade de batidas, então sempre pedem uma nova prévia.

O pedido dizia "faz direto" ou "não precisa me mostrar"? O `next_step` pula a aprovação; a prévia é feita do mesmo jeito e você olha a folha do mesmo jeito.

## Passo 6: o vídeo final e a entrega

1. `final <slug> --json` renderiza em 1080×1920 com desfoque de movimento, mixa em −14 LUFS, grava a capa e confere de novo. Sem a aprovação da prévia ele recusa (`preview_not_approved`).
2. Leia `accept`: `passed` falso é vídeo reprovado. Corrija e refaça, ou conte ao integrante exatamente o que reprovou.
3. `open <slug> final --json` abre o vídeo. Entregue: onde está o arquivo, a capa, o que a conferência disse, e o conteúdo de `notes` (em qual rede postar, o texto sugerido, que passa pela `texto-natural` antes de ser mostrado, os lembretes de publicidade quando valem).
4. Depois de uma tarefa real, registre o uso: `npx --yes flyee@latest track tool.executed --module video-studio`.

## Retomar e mudar

- **Retomar** ("continua o vídeo da loja"): `status <slug> --json` devolve o andamento e o `next_step`. `list --json` mostra os vídeos do projeto.
- **Trocar um texto ou uma cena:** edite o `roteiro.json`, depois `build <slug> --json` e `preview <slug> --json`; olhe, mostre e peça o sim de novo antes do `final`.
- **Trocar a trilha ou o andamento:** mude `music` ou `bpm` no roteiro (o `build` valida) e refaça a prévia.
- **Outro vídeo da mesma marca:** um novo `intake`. A marca já está guardada: nada sobre ela é perguntado de novo.

## Problemas comuns

| `error.code` | O que fazer |
|---|---|
| `video_render_missing` | siga o `fix`: rode você mesmo `npx --yes flyee@latest add video-render --dry-run --json`, diga numa frase o que o Motor declara e, com o sim do integrante, rode `npx --yes flyee@latest add video-render --yes --json` com tempo limite de 10 minutos; depois repita |
| `tools_missing`, `browser_missing` | rode você mesmo os comandos de `fix` (ou de `install` no `check`, na forma `npx --yes flyee@latest need <programa> --yes --json`), com tempo limite de 10 minutos; depois repita |
| `runtime_missing` | a instalação deste app está incompleta: rode você mesmo `npx --yes flyee@latest add video-studio --yes --json` (está em `fix`), com tempo limite de 10 minutos; depois repita |
| `request_empty` | o arquivo do pedido está vazio: grave nele o que o integrante escreveu |
| `question_unknown`, `answer_invalid` | o `id` não é da rodada atual ou o valor não é uma das opções: use os `id` e os `value` de `round` |
| `brand_unknown` | falta o site da marca: pergunte ao integrante (ou procure o site oficial e confirme com ele) e registre com `answer <slug> marca <endereço>` |
| `site_blocked`, `site_unreachable`, `invalid_url`, `capture_failed` | o site não deixou o navegador entrar ou o endereço não abre: siga com o visual neutro e peça o logo e as imagens na pasta de materiais |
| `site_placeholder` | o endereço ainda não tem o site da marca (domínio estacionado ou página padrão do provedor): nada dele serve. Pergunte se a marca tem o site em outro endereço; se não tiver, siga com o visual neutro e peça o logo e as imagens na pasta de materiais |
| `brief_not_approved`, `preview_not_approved` | falta o sim do integrante: mostre o briefing ou a prévia e registre com `approve` |
| `roteiro_invalid` | a mensagem diz a cena e o campo: corrija o `roteiro.json` (papéis, compassos e limites de palavras em `../../references/roteiros.md`) |
| `page_error`, `page_no_seek`, `browser_timeout` | a página tem erro de JavaScript ou não termina de desenhar: rode `build <slug> --json`, que a reescreve a partir do roteiro; se o erro continuar, o problema está num valor do roteiro (veja `../../references/roteiros.md`) |
| `exists` | já existe um vídeo com esse nome: use outro `--slug`, ou `--force` só com o sim do integrante |
| `video_not_found` | confira o nome com `list --json` |
| outros códigos do Motor | siga a tabela de `.flyee/modules/video-render/references/interface.md`; em todos, `message` e `fix` dizem o que fazer |
