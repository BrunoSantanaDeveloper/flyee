---
name: ad-creatives
description: Prepara os criativos de uma campanha de tráfego pago na Meta (Instagram e Facebook): pesquisa os anúncios dos concorrentes, propõe três conceitos com a evidência de cada um, produz os vídeos e as imagens conferidos e entrega textos, nomes e a conta da verba. Use quando pedirem criativos, anúncios ou a primeira campanha paga. Para um vídeo animado avulso, use o Estúdio de vídeo.
---

# Criativos para anúncios

O integrante pede os criativos de uma campanha paga; você conduz o briefing, a pesquisa dos concorrentes, os conceitos, as peças e a entrega. Os comandos partem da raiz do projeto, a pasta que contém `.flyee/` (o script fica em `../../scripts/ads.mjs` a partir desta pasta):

```
node .flyee/modules/ad-creatives/scripts/ads.mjs <comando> [opções] --json
```

Só o JSON vai para o stdout; o progresso vai para o stderr. Em erro, `ok` é `false` e `error` traz `code`, `message` e `fix`. **Todo resultado traz `next_step`**: `action`, `command` (o comando exato, quando há um) e `say`. Siga o `next_step`; ao retomar uma campanha, comece por `status <campanha> --json`.

Os guias desta pasta: `../../references/pesquisa-manual.md` (a coleta e o formato das leituras), `../../references/conceitos.md` (os conceitos, a confiança e os nomes), `../../references/pagina-anuncio.md` (a peça, a imagem e o `peca.json`), `../../references/lancamento.md` (a estrutura e a conta da verba), `../../references/reels-de-teste.md` (comparar as peças antes de pagar), `../../references/analise-anuncio.md` (o que observar num anúncio de referência), `../../references/etiquetas.json`, `../../references/meta-anuncios.json` (os limites de texto e os botões da Meta) e `../../references/fontes.json` (o coletor do Apify e o preço dele).

**Pedido de um vídeo só.** Se o integrante quer um vídeo animado avulso, sem campanha, o trabalho é do app Estúdio de vídeo: use a skill dele.

## Regras que não se quebram

- **Nenhum número sai de estimativa.** Tempo no ar, versões, plays, custo e verba vêm de uma coleta, do briefing ou do script. Você copia o texto como aparece e o app converte; um número plausível inventado é o erro que o integrante não consegue perceber.
- **O app não promete nem prevê resultado.** A evidência ordena apostas. Nenhuma ficha, texto ou nota diz que um anúncio vai vender, e a confiança é calculada pelo script, nunca escrita por você.
- **Todo dado carrega origem e data.** Conceito sem evidência sai como aposta, e a ficha diz isso.
- **Nunca use o login, o cookie ou a sessão do integrante para colher dado da Meta, e nunca entre na conta de anúncios dele nem peça a credencial dela.** Ele abre a Biblioteca de Anúncios no navegador, ou o Apify colhe sem a conta dele; ele cria a campanha.
- **Nenhuma coleta paga sem limite, e acima do teto só com o sim.** O `collect` já manda o limite de itens e o teto de gasto; quando ele devolver `needs_confirmation`, diga o valor ao integrante e só repita com `--confirm-cost` depois do sim.
- **A chave não passa pela conversa.** Nunca a peça em texto, nunca a ponha num comando e nunca abra o arquivo onde ela fica.
- **Depoimento, antes e depois e pessoa real só com material que o integrante forneceu.** Nada de pessoa, rosto ou depoimento gerado.
- **Leitura que falha vira pedido ao integrante, com as opções.** Não tente outro caminho por conta própria para o mesmo conteúdo.
- **Reels e post estático nunca dividem um ranking, e números de redes diferentes nunca são comparados. Amostra pequena é indício, e o texto diz isso.**
- **Nunca diga que uma peça ficou boa sem ter olhado os quadros, e nunca chame de pronta uma peça com item reprovado.**
- **O integrante não usa o terminal.** Você roda tudo. Fale simples: diga só o que ele precisa fazer ou decidir e o resultado.

## Passo 0: conferir a máquina

Rode `check --json` uma vez por sessão.

- `engine.installed` falso: as peças usam o app Motor de vídeo. Diga numa frase que vai instalá-lo e o que ele faz, e rode você mesmo `npx --yes flyee@latest add video-render --yes --json` (tempo limite de 10 minutos). A pesquisa e os conceitos não precisam dele.
- `install` com comandos (ffmpeg, navegador): avise numa frase e rode cada um, com tempo limite longo; mostre ao integrante só um passo que volte como `needs_member`.
- `apify_key` falso: a pesquisa é a guiada, pelos links. A chave é opcional; se o integrante quiser a coleta automática, rode você mesmo o comando de `apify_setup`, que abre uma página no navegador dele para colar a chave, e rode `check` de novo quando ele disser que salvou.
- `partners`: os apps que trazem mais evidência. Quando um faltar e a campanha ganharia com ele, diga numa frase o que ele traz (`gives`) e pergunte se pode instalar; com o sim, rode o `install` dele (tempo limite de 10 minutos). Sem ele, siga, dizendo o que fica de fora.

## Passo 1: o briefing

1. `new <campanha> --json` cria `anuncios/<campanha>/` com o `briefing.md`. Use um nome curto, como `lancamento-outubro`.
2. Preencha o briefing com o que o pedido e o projeto já dizem. Rode `brief <campanha> --json` e pergunte ao integrante, numa mensagem só, o que vier em `questions`. Nunca invente oferta, preço, custo ou concorrente: o que ele não souber fica em branco.
3. Com o site no briefing, `capture <campanha> --json` copia o logo, as cores e as telas. Se a captura falhar, peça o logo e de duas a três telas do produto, salvos em `materiais/` com nomes que comecem por `logo` e `tela`.
4. `budget <campanha> --json` faz a conta da verba. Mostre a conta ao integrante já agora, com as palavras de `say`: com verba pequena e produto caro, ela muda a conversa. Quando `viable` é falso, mostre as três saídas (`exits`) e deixe a escolha com ele; com `ask`, pergunte quanto ele aceita pagar por evento.

## Passo 2: a evidência

**Os anúncios dos concorrentes.**

- Com a chave: `collect <campanha> --json` colhe pelo Apify, com limite de itens e teto de gasto, e põe cada anúncio na evidência com a origem e a data. Diga ao integrante quanto custou (`cost`). Em `needs_confirmation`, diga o valor e espere o sim.
- Sem a chave: `links <campanha> --json` monta os links da Biblioteca de Anúncios e o roteiro de cinco linhas. Mande os dois ao integrante, como vieram. Quando ele trouxer as capturas, leia cada cartão e grave a leitura em `pesquisa/leituras/<concorrente>.json` (`../../references/pesquisa-manual.md`), com o texto como aparece e a captura de origem de cada cartão, e rode `import <campanha> <leitura> --json`. Em `reading_invalid`, corrija o campo apontado e importe de novo.
- Nos dois casos, etiquete os anúncios ativos e tire da análise o que não é do mesmo público, numa leitura `tags`: separar públicos é leitura do texto, e o integrante aprova os grupos.

**O orgânico, com a Pesquisa no Instagram.** Meça o perfil da marca e compare com os concorrentes: `node .flyee/modules/instagram-research/scripts/research.mjs outliers @marca @concorrente … --name anuncios-<campanha> --json` (sem a chave, ele lê capturas da aba de Reels; siga o guia dele). Depois rode `import <campanha> instagram-research/outliers/anuncios-<campanha>/outliers.json --json`: entram os posts que passaram o normal do próprio perfil, Reels e posts estáticos separados.

**A fala do público.** Os comentários de um post (`node .flyee/modules/instagram-research/scripts/research.mjs comments <post> --json`) ou de vídeos do tema no YouTube (`node .flyee/modules/youtube-research/scripts/research.mjs comments <vídeo> --json`) entram com `import <campanha> <arquivo comments.json> --json`. O que o integrante sabe de clientes entra numa leitura `declared`.

**Um anúncio de referência.** Para o anúncio mantido há mais tempo, peça à Análise de vídeo que o destrinche: `node .flyee/modules/video-analysis/scripts/video.mjs analyze <endereço do vídeo> --focus editing --instructions .flyee/modules/ad-creatives/references/analise-anuncio.md --name ad-creatives --json`. O endereço do vídeo vem em `data.media_urls` do anúncio colhido pelo Apify; na pesquisa guiada, peça ao integrante o link do anúncio. Os erros dela e o que fazer estão em `.flyee/modules/video-analysis/references/interface.md`. Se o vídeo não baixar, diga isso ao integrante e siga sem a análise; não tente outro caminho por conta própria. Ligue a descrição ao anúncio numa leitura `tags`, com `analysis` apontando o arquivo gravado.

Por fim, `evidence <campanha> --json` resume: anúncios mantidos há 30 dias ou mais, padrões em dois concorrentes ou mais, o orgânico, a fala do público e os indícios. Conte ao integrante, em poucas frases, o que o mercado mostra.

## Passo 3: os conceitos

1. Escreva três conceitos em `conceitos.json`, um por barreira ou motivador, cada um citando os ids da evidência a favor e contra, com as peças em `formats` (`vertical`, `feed`, `imagem` ou `quadrado`; o padrão é o vídeo vertical, o vídeo 4:5 e a imagem 4:5), como em `../../references/conceitos.md`.
2. `concepts <campanha> --json` confere, calcula a confiança e grava as fichas em `conceitos.md`. Em `concepts_invalid`, corrija o campo apontado.
3. Mostre as fichas ao integrante: o conceito, a confiança e a base dela, o que é aposta. Pergunte se aprova os três. Com o sim, rode `approve <campanha> concepts --json`.

## Passo 4: as peças

Para cada conceito:

1. `piece <campanha> <conceito> --json` escreve o `peca.json` a partir do modelo e monta a página na zona segura dos anúncios, e a imagem quando o conceito tem uma. Resolva o que vier em `todo` com o que o integrante disse ou mostrou (`../../references/pagina-anuncio.md`).
2. `preview <campanha> <conceito> --json` compõe a trilha e os efeitos, faz a prévia e confere o vídeo vertical, o vídeo 4:5 e a imagem. **Abra a folha de quadros de `sheet`, a de cada peça de `placements` e a imagem, e olhe antes de dizer qualquer coisa**: o primeiro quadro já é uma capa legível? O texto cabe e fica longe das bordas? Cada cena diz uma coisa só? Corrija o `peca.json` e rode `preview` de novo até a conferência passar (`passed`) e os quadros estarem bons.
3. Mostre a prévia e a imagem ao integrante, com os textos da tela. Com o sim, rode `approve <campanha> preview <conceito> --json`.
4. `final <campanha> <conceito> --json` faz cada peça em tamanho final e confere de novo. Peça reprovada: corrija e refaça a prévia.

## Passo 5: o texto dos anúncios

Revise o texto principal, o título e a descrição de cada conceito com a skill `texto-natural`, que vem com o flyee, para tirar o que soa como texto de IA, sem acrescentar fato, número ou promessa. Depois rode `copy <campanha> --json`, que confere a promessa de resultado, os termos proibidos do briefing, a frase que afirma uma condição de quem vê (a Meta recusa) e os limites de texto da Meta. Reescreva o que estiver em `problems`; conte ao integrante os avisos (`warnings`), como o corte do ver mais.

## Passo 6: a entrega

`deliver <campanha> --json` confere o conjunto e monta `entrega/` com as peças nomeadas como anúncios, a capa do vídeo vertical, `nomes.json` e `textos.md`, e grava `lancamento.md` e `relatorio.json`. Em `deliver_blocked`, siga `details.blockers` na ordem. Diga ao integrante onde estão os arquivos, o que conferir antes de ligar a campanha (`lancamento.md`) e o que ainda é decisão dele (`pending`). Ele cria a campanha no Gerenciador de Anúncios; você não.

Antes de pagar, ofereça os Reels de teste (`../../references/reels-de-teste.md`): o resultado volta como evidência própria, a mais forte da próxima rodada.

## Passo 7: o diário

Rode `journal <campanha> --json`, que registra a rodada no `diario.json`: as peças, as hipóteses e a confiança de cada conceito. Depois registre o uso com `npx --yes flyee@latest track tool.executed --module ad-creatives`. Quando o integrante disser que montou a campanha, registre com `journal <campanha> --kind launched --note "…" --json` se a estrutura coube no Gerenciador.

## Problemas comuns

| `code` | O que fazer |
|---|---|
| `brief_incomplete` | pergunte ao integrante o que `details.missing` aponta e grave no `briefing.md` |
| `reading_invalid` | a mensagem diz o arquivo e o campo: corrija o texto copiado ou a captura de origem e importe de novo |
| `needs_confirmation` | diga o valor ao integrante; com o sim, repita com `--confirm-cost` |
| `apify_unauthorized`, `apify_no_credit` | siga o `fix`; enquanto isso, a pesquisa segue pelos links |
| `apify_unavailable`, `apify_timeout`, `apify_actor_failed` | tente de novo mais tarde; enquanto isso, a pesquisa segue pelos links |
| `download_failed`, `video_unavailable` e outros da Análise de vídeo | o anúncio de referência não abriu: diga isso numa frase e siga sem a análise; os outros códigos estão no guia dela |
| `concepts_invalid` | corrija o campo apontado no `conceitos.json` |
| `concepts_not_approved` | mostre as fichas e peça o sim; uma mudança num conceito aprovado pede o sim de novo |
| `preview_not_approved`, `preview_outdated` | refaça a prévia, mostre e peça o sim |
| `piece_invalid` | corrija o campo apontado no `peca.json` |
| `video_render_missing`, `video_render_outdated` | siga o `fix`: ele diz a frase e o comando |
| `deliver_blocked` | siga `details.blockers` na ordem |
| outros códigos do Motor | siga a tabela de `.flyee/modules/video-render/references/interface.md`; em todos, `message` e `fix` dizem o que fazer |
