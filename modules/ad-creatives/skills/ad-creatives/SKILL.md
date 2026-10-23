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

Os guias desta pasta: `../../references/pesquisa-manual.md` (a coleta e o formato das leituras), `../../references/conceitos.md` (os conceitos, a confiança e os nomes), `../../references/pagina-anuncio.md` (a peça, a imagem e o `peca.json`), `../../references/lancamento.md` (a estrutura e a conta da verba), `../../references/reels-de-teste.md` (comparar as peças antes de pagar), `../../references/analise-anuncio.md` (o que observar num anúncio de referência), `../../references/matriz.md` (a matriz da primeira leva), `../../references/busca.md` e `../../references/google-busca.json` (os anúncios de texto da Busca do Google e os limites deles), `../../references/politica-meta.md` (o que a política da Meta recusa), `../../references/interface.md` (o que este app lê dos outros e grava para eles), `../../references/etiquetas.json`, `../../references/meta-anuncios.json` (os limites de texto e os botões da Meta) e `../../references/fontes.json` (o coletor do Apify e o preço dele). A página de destino tem a sua própria skill, `ad-landing-page`, que vem com este app.

**Pedido de um vídeo só.** Se o integrante quer um vídeo animado avulso, sem campanha, o trabalho é do app Estúdio de vídeo: use a skill dele.

## Regras que não se quebram

- **Nenhum número sai de estimativa.** Tempo no ar, versões, plays, custo e verba vêm de uma coleta, do briefing, do plano aprovado ou do script. Você copia o texto como aparece e o app converte; um número plausível inventado é o erro que o integrante não consegue perceber. Com um plano aprovado no projeto, oferta, preço, evento, verba da fase e custo permitido vêm dele, e você diz de onde vieram; sem plano, você nunca os inventa: oferta, preço e verba são trabalho do app de plano, e você o encaminha para lá.
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
- `apify_key` falso: a pesquisa é a guiada, pelos links. A chave é opcional; se o integrante quiser a coleta automática, rode você mesmo o comando de `apify_setup`, que abre uma página no navegador dele para colar a chave, e rode `check` de novo quando ele disser que salvou. Numa sessão do Claude Code na nuvem, `apify_setup` não traz comando, porque a página não abre ali: passe a ele o `apify_setup.how`, que guarda a chave como segredo de rede do ambiente, e a sessão a usa sem vê-la.
- `partners`: os apps que trazem mais evidência. Quando a pesquisa chegar à etapa de um deles e ele faltar, diga numa frase simples qual app vai instalar e o que ele traz (`gives`) e rode você mesmo o `install` dele, com tempo limite de 10 minutos, sem esperar resposta. Se a instalação falhar, ou se o integrante pedir para não instalar, siga sem ele, dizendo o que fica de fora.

## Passo 1: o briefing

1. `new <campanha> --json` cria `anuncios/<campanha>/` com o `briefing.md`. Use um nome curto, como `lancamento-outubro`.
2. Rode `brief <campanha> --json`. Com um plano aprovado em `media-plan/`, ele preenche sozinho o que o plano responde (oferta, preço, página, evento, verba da fase, custo permitido, público, datas, regra de link) e devolve a origem de cada campo em `sources`; diga ao integrante, numa frase, o que veio do plano. Preencha o resto com o que o pedido e o projeto já dizem e pergunte ao integrante, numa mensagem só, o que vier em `questions`. Nunca invente oferta, preço, custo ou concorrente: o que ele não souber fica em branco.
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
4. `matrix <campanha> --json` mostra a primeira leva como matriz: os ângulos cruzados com os formatos. Sem `matriz.json`, ela sai dos conceitos aprovados (três ângulos em vídeo 9:16, vídeo 4:5 e imagem, nove peças). Para uma leva maior, escreva `matriz.json` como `../../references/matriz.md` mostra: de 3 a 4 ângulos, 8 a 12 peças, e as peças de depoimento ou fundador saem como roteiro para o integrante gravar. Em `matrix_invalid`, corrija o campo apontado. Mostre `matriz.md` ao integrante antes das peças.

## Passo 4: as peças

Para cada conceito:

1. `piece <campanha> <conceito> --json` escreve o `peca.json` a partir do modelo e monta a página na zona segura dos anúncios, e a imagem quando o conceito tem uma. Resolva o que vier em `todo` com o que o integrante disse ou mostrou (`../../references/pagina-anuncio.md`).
2. `preview <campanha> <conceito> --json` compõe a trilha e os efeitos, faz a prévia e confere o vídeo vertical, o vídeo 4:5 e a imagem (as peças de feed na zona de anúncio do feed da Meta quando o Motor de vídeo a tem; com um Motor antigo, na zona do feed do Instagram, e a entrega diz isso). **Abra a folha de quadros de `sheet`, a de cada peça de `placements` e a imagem, e olhe antes de dizer qualquer coisa**: o primeiro quadro já é uma capa legível? O texto cabe e fica longe das bordas? Cada cena diz uma coisa só? Corrija o `peca.json` e rode `preview` de novo até a conferência passar (`passed`) e os quadros estarem bons.
3. Mostre a prévia e a imagem ao integrante, com os textos da tela. Com o sim, rode `approve <campanha> preview <conceito> --json`.
4. `final <campanha> <conceito> --json` faz cada peça em tamanho final e confere de novo. Peça reprovada: corrija e refaça a prévia.

## Passo 5: o texto dos anúncios

Revise o texto principal, o título e a descrição de cada conceito com a skill `texto-natural`, que vem com o flyee, para tirar o que soa como texto de IA, sem acrescentar fato, número ou promessa. Depois rode `copy <campanha> --json`, que confere a promessa de resultado, os termos proibidos do briefing, a frase que afirma uma condição de quem vê (a Meta recusa) e os limites de texto da Meta. Reescreva o que estiver em `problems`; conte ao integrante os avisos (`warnings`), como o corte do ver mais. O que o `copy` não aplica em código está em `../../references/politica-meta.md`: a categoria do negócio, antes e depois, o enganoso, o conteúdo de marca; leia a peça por ele antes de entregar.

**A Busca do Google.** Quando o plano tem a Busca entre os canais, escreva os anúncios de texto em `busca.json` como `../../references/busca.md` mostra (a campanha de marca e a de não marca, os grupos de palavras do plano, até 15 títulos de 30 caracteres e 4 descrições de 90, as extensões) e rode `search <campanha> --json`. Ele aplica os mesmos verificadores do `copy` e os limites do Google; reescreva o que vier em `problems` e entregue `busca.md`, que o integrante cola no Google Ads. Quem cria a campanha é ele.

**A página de destino.** Com a skill `ad-landing-page`: `page brief <campanha> --json` escreve o briefing da página a partir do plano e dos conceitos, e `page audit <campanha> --json` confere a página viva pela captura do site. Faça a conferência antes da entrega: um anúncio que promete uma coisa e uma página que fala de outra paga o clique duas vezes.

## Passo 6: a entrega

`deliver <campanha> --json` confere o conjunto e monta `entrega/` com as peças nomeadas como anúncios, a capa do vídeo vertical, `nomes.json` e `textos.md`, e grava `lancamento.md` e `relatorio.json`. Em `deliver_blocked`, siga `details.blockers` na ordem. Diga ao integrante onde estão os arquivos, o que conferir antes de ligar a campanha (`lancamento.md`) e o que ainda é decisão dele (`pending`). Ele cria a campanha no Gerenciador de Anúncios; você não.

Antes de pagar, ofereça os Reels de teste (`../../references/reels-de-teste.md`): o resultado volta como evidência própria, a mais forte da próxima rodada.

## Passo 7: o diário

Rode `journal <campanha> --json`, que registra a rodada no `diario.json`: as peças, as hipóteses e a confiança de cada conceito. Depois registre o uso com `npx --yes flyee@latest track tool.executed --module ad-creatives`. Quando o integrante disser que montou a campanha, registre com `journal <campanha> --kind launched --note "…" --json` se a estrutura coube no Gerenciador.

## Passo 8: a rodada seguinte e a sequência da data alvo

Quando o app de medição julgar a campanha (`ads-insights/leituras/<leitura>/report.json`), rode `round next <campanha> --json` (ou `--report <arquivo>` para uma leitura específica). Cada linha do relatório que casa com um anúncio desta campanha entra na evidência como resultado próprio (`res-…`), a evidência mais forte que um conceito pode ter, com o veredito, a certeza e as métricas como texto; a leitura entra no diário como `results`; e `rodada.md` traz a proposta da rodada seguinte: o que escalou se mantém e ganha duas variações do mesmo gancho, o que recebeu `iterar` muda só o que `where_it_fails` aponta (gancho, miolo ou página), o que foi cortado não volta igual, e quantos conceitos novos a leva pede. Escreva os conceitos da rodada em `conceitos.json` citando os ids `res-…`, com os nomes terminando em `-v<rodada>`, e siga pelos passos 3 a 7. Em `report_unmatched`, os nomes do export não são os da entrega: ligue as linhas no app de medição (`link --names`) e julgue de novo.

`sequence <campanha> --json` escreve `sequencia.json` e `sequencia.md` com as quatro peças da data alvo datadas pelo plano aprovado: a abertura para a lista (dois dias antes do aquecimento), a oferta no ar (o primeiro dia do pico), a contagem regressiva (o meio do pico) e o último dia (o fim do pico), cada uma com o preço e o prazo da oferta do plano, as linhas do código do consumidor, o texto conferido pelas mesmas regras dos anúncios, e os formatos na rede certa (o 9:16 em `ads_meta`, o 4:5 e o 1:1 em `ads_meta_feed`). Cada peça sobe programada dois dias antes da data, para passar pela revisão. Sem plano, `plan_missing`: a sequência é trabalho do app de plano antes.

## Problemas comuns

| `code` | O que fazer |
|---|---|
| `brief_incomplete` | pergunte ao integrante o que `details.missing` aponta e grave no `briefing.md` |
| `matrix_invalid` | `details.path` aponta o campo de `matriz.json`: 3 a 4 ângulos que diferem em duas dimensões, 8 a 12 peças |
| `search_missing`, `search_invalid` | escreva `busca.json` como o guia mostra; `details.path` aponta o campo |
| `capture_missing` | rode `capture` antes de `page audit` |
| `reading_invalid` | a mensagem diz o arquivo e o campo: corrija o texto copiado ou a captura de origem e importe de novo |
| `needs_confirmation` | diga o valor ao integrante; com o sim, repita com `--confirm-cost` |
| `apify_unauthorized`, `apify_no_credit` | siga o `fix`; enquanto isso, a pesquisa segue pelos links |
| `apify_unavailable`, `apify_timeout`, `apify_actor_failed` | tente de novo mais tarde; enquanto isso, a pesquisa segue pelos links |
| `download_failed`, `video_unavailable` e outros da Análise de vídeo | o anúncio de referência não abriu: diga isso numa frase e siga sem a análise; os outros códigos estão no guia dela |
| `concepts_invalid` | corrija o campo apontado no `conceitos.json` |
| `concepts_not_approved` | mostre as fichas e peça o sim; uma mudança num conceito aprovado pede o sim de novo |
| `preview_not_approved`, `preview_outdated` | refaça a prévia, mostre e peça o sim |
| `report_missing`, `report_invalid`, `report_unmatched` | não há leitura do app de medição, o arquivo não é um `report.json` dele, ou nenhuma linha casou com os anúncios desta campanha |
| `plan_missing`, `plan_incomplete` | a sequência da data alvo precisa do plano aprovado com as fases de aquecimento e pico |
| `piece_invalid` | corrija o campo apontado no `peca.json` |
| `video_render_missing`, `video_render_outdated` | siga o `fix`: ele diz a frase e o comando |
| `deliver_blocked` | siga `details.blockers` na ordem |
| outros códigos do Motor | siga a tabela de `.flyee/modules/video-render/references/interface.md`; em todos, `message` e `fix` dizem o que fazer |
