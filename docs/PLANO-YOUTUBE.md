# YouTube: os resultados do canal e a thumbnail de verdade: especificação

**Objetivo:** o integrante passa a ver, com a amostra que cada vídeo tem, como os vídeos dele foram no YouTube (impressões, cliques, tempo assistido) a partir de um export que ele baixa do YouTube Studio, sem chave nem login, e recebe as thumbnails do vídeo como imagens prontas, conferidas no tamanho do celular, em vez de ideias em texto.

> Auditado contra o código em 2026-10-29: commit 2dd73e2 mais as mudanças ainda não commitadas desta rodada (`youtube-research` 1.1.0 e `youtube-script` 1.2.0). Atualizado em 2026-10-30 com a rodada "a embalagem que vende" (`youtube-research` 1.2.0 e `youtube-script` 1.3.0, sobre ae99c03, ainda não commitados). Legenda: ✅ existe · 🟡 parcial · ⬜ não existe · ⚠️ correção.

## Origem

O levantamento de 2026-10-29 comparou o flyee com quatro repositórios: opensquad (sem arquivo de licença, só ideia de método, D31), claude-youtube, tube-assistant e thumbnail-studio (os três MIT com arquivo: texto adaptável com `NOTICE.txt`). Os itens pequenos já entraram nesta rodada. Ficaram para esta especificação os dois que pedem decisão:
- **ler os resultados do próprio canal**, apontado pelos quatro levantamentos;
- **gerar a thumbnail**, apontado pelo claude-youtube e pelo thumbnail-studio.

Os fatos do YouTube citados aqui foram lidos nas páginas oficiais em 2026-10-29. Estão também na memória do operador ("YouTube platform facts").

### A rodada de 2026-10-30: a embalagem que vende

O operador pediu que título e thumbnail despertem interesse com gatilhos fortes, não só digam do que o vídeo trata, e que a thumbnail siga o padrão do canal quando ele existe. Esta rodada já foi feita, mas ainda não foi commitada:

**`youtube-research` 1.2.0**
- Cinco gatilhos medidos: `stakes`, `extreme`, `insider`, `callout` e `transformation` (`scripts/lib/titles.mjs`).
- O comando `thumbnails` (T2.2, abaixo).

**`youtube-script` 1.3.0**
- A regra "exagere no interesse, nunca no fato", com a política "Clickbait malicioso" do YouTube, lida em 2026-10-30 na ajuda em pt-BR, resposta 2801973.
- Treze gatilhos na tabela da embalagem.
- O teste do clique reprova o par título e thumbnail que só descreve.
- A thumbnail como pergunta visual, em que montar vale e inventar não.
- O padrão do canal em `canal.md`.
- A conferência ganha três regras:
  - `title_descriptive`: o título escolhido só tem busca direta;
  - `titles_same_trigger`: cinco títulos com menos de quatro gatilhos;
  - `title_trigger_missing` e `title_trigger_unknown`, que são observações.
- A crítica ganha o critério 10, "Força da embalagem".

**Verificado**
- Os testes dos dois apps passam: 28 e 52, com `tests/thumbnails.test.mjs` e `tests/v13.test.mjs` novos.
- `npm run test:apps` passa (589 de 591, 2 pulados) e `npm run validate` também (11 apps).
- O `lint` da cópia instalada no workspace dá os dois avisos numa embalagem só descritiva.

## 0. Decisões antes do desenvolvimento

O implementador não inventa estes valores. Os que estão em aberto ficam como entradas configuráveis até o operador decidir.

| # | Decisão | Valor | Onde vive |
|---|---|---|---|
| Y1 | Onde mora a leitura do export do Studio | **Aberta.** Recomendado: um comando `studio` no `youtube-research`, que já tem a mediana do canal e é lido pelo `youtube-script`. Alternativas: o `ads-insights` (orgânico e pago num lugar só) ou um app novo | manifesto e `references/interface.md` do app escolhido |
| Y2 | A amostra mínima de um vídeo para ter veredito (impressões e views) | **Aberta.** Nenhuma fonte primária dá esse piso. A única referência com fonte é que metade dos canais e vídeos tem taxa de clique das impressões entre 2% e 10% (ajuda do YouTube, resposta 7628154). O piso é decisão do operador, rotulada como regra de bolso com data (D23) | `references/studio.json` (`sample`, `checked_on`), como `ads-insights/references/leitura.json` |
| Y3 | Que export o integrante baixa e com quais métricas | **Aberta até a T1.1.** Candidato: a tabela "Conteúdo" do modo avançado, com impressões, taxa de cliques das impressões, visualizações, duração média e porcentagem média assistida | `references/studio.json` |
| Y4 | Onde mora a thumbnail | **Aberta.** Recomendado: o motor (`video-render`) ganha a imagem parada e a conferência de thumbnail, que servem também à capa de Reels e às imagens de anúncio; o `youtube-script` ganha a etapa depois da gravação, porque é dono da embalagem | manifestos dos dois apps |
| Y5 | O tamanho do arquivo de thumbnail | **Aberta.** Recomendado: 1920×1080 em JPG de até 2 MB, que sobe também pelo celular, e 3840×2160 como opção para quem sobe pelo computador. O YouTube recomenda 3840×2160 e aceita até 2 MB pelo celular e 50 MB pelo computador (resposta 72431) | opção do comando; padrão em `references/redes.json` |
| Y6 | O canto da duração: o tamanho da área que a thumbnail deixa livre | **Aberta.** O YouTube não publica o tamanho do selo de duração. Vira margem de projeto rotulada, medida em capturas reais com data, como a `ads_meta_feed` do `video-render` 1.0.2 | `video-render/references/redes.json` |
| Y7 | Baixar as thumbnails dos outliers (imagens públicas em `i.ytimg.com`) para a vitrine local | **Implementada antes da decisão, a confirmar pelo operador antes de publicar.** O comando `thumbnails` do `youtube-research` 1.2.0 baixa as imagens de vídeos avulsos ou de um canal já lido, só para leitura no projeto do integrante. Termos de uso lidos em 2026-10-30 (youtube.com/t/terms, "Em vigor a partir de 5 de janeiro de 2022"): não é permitido "fazer download" de "qualquer Conteúdo" sem autorização nem "acessar o Serviço usando qualquer meio automatizado". A mesma cláusula já alcança o que o app faz desde a 1.0.0 com o yt-dlp (busca, legendas, comentários). Se a resposta for não, o comando sai antes de publicar | permissão `network` do `youtube-research` (`i.ytimg.com`) |
| Y8 | Imagem gerada por IA na thumbnail | **Fora da v1.** ⚠️ A regra citada aqui era "quadro real do vídeo"; desde o `youtube-script` 1.3.0 é "montar vale, inventar não": a thumbnail junta elementos que estão no vídeo e nunca mostra cena, tela ou resultado que ele não tem (`youtube-script/references/embalagem.md`, seção "A thumbnail"). Uma versão futura pode aceitar cena conceitual rotulada como ilustração, pelo caminho de imagem que o `motion-carousel` já tem | `embalagem.md` |
| Y9 | Contraste do texto (WCAG, 4,5:1) no `accept` | **Aberta.** Em todo formato ou só na thumbnail. O plano de anúncios falados já prevê `text_over_text` nas mesmas caixas (`docs/PLANO-ANUNCIOS-FALA.md:175`). Decidir junto para não abrir duas regras parecidas | `video-render/references/aceite.md` |

## 0.5 Convenções do repositório que valem aqui

- O integrante não abre terminal. O único passo dele é baixar o export no YouTube Studio, no navegador, como o export da Meta no `ads-insights`. A IA diz o caminho em uma frase e lê o arquivo que ele salvar no projeto.
- Sem chave, sem login, sem OAuth, sem cookies da conta do YouTube.
- Número com rótulo, fonte e data (D23). O veredito, a confiança e a data de leitura saem do script, nunca da IA, e abaixo da amostra mínima o documento diz "indício".
- Os arquivos do motor (`accept`, os comandos de som, `redes.json`) só mudam depois de conferir as sessões ativas (D47). O ÉPICO 12 do plano de anúncios falados mexe em `ffmpeg.mjs`, `render.mjs` e `commands/audio.mjs`: assinaturas preservadas.
- Versões são imutáveis: cada app alterado ganha versão nova com changelog. Interface 1 só cresce: comandos e campos novos, nada renomeado.
- O texto que o integrante lê segue as regras de texto da plataforma (sem travessão, sem exclamação, sem emoji).

## Invariantes que a implementação não pode violar

1. **Nenhum veredito abaixo da amostra mínima (Y2).** Um vídeo com 200 impressões e 8% de cliques parece ótimo e não diz nada. Um veredito errado vira troca de título e thumbnail que piora o canal.
2. **Uma coluna que falta é `missing`, nunca zero.** É o que o `ads-insights` já faz (`scripts/lib/exports.mjs:2`). Um zero inventado vira diagnóstico de "embalagem fraca".
3. **O export nunca sai do projeto.** O app lê o arquivo que o integrante salvou e grava a leitura ao lado. Nada sobe para nenhum servidor.
4. **Nenhum acesso à conta do integrante.** Nada de OAuth, cookie ou sessão. É a mesma regra que tirou a coleta logada dos apps de pesquisa.
5. **A thumbnail usa quadro real do vídeo do integrante ou foto dele.** Montar com esses elementos vale (rosto recortado, objeto ampliado, seta); a thumbnail de outro canal pode estar na vitrine, como referência, e nunca dentro da imagem entregue.
6. **Nunca dizer que conferiu o que não conferiu.** A conferência no tamanho pequeno, em tons de cinza e de contraste sai do script ou não é afirmada (`embalagem.md`, seção "O teste do clique").
7. **O motor muda sem quebrar o ÉPICO 12 do plano de anúncios falados.** Isso vale para as funções `mixAudio`, `muxAudio` e `contactSheet`, para o `sheet` e o `frames`, e para `finalizeMix`.

## ÉPICO 1: ler os resultados do canal

**Bloqueia:** a leitura de títulos pela taxa de cliques (T1.3) e qualquer "o que funcionou no seu canal" que não seja só views.

### T1.1: o export de verdade
**Estado: ⬜**
- A ajuda do YouTube (resposta 9717005, lida em 2026-10-29) diz só "Exportar visualização atual" no modo avançado, com limite de 500 linhas. Não nomeia formatos nem colunas e não fala em exportar a retenção.
- Nenhum app lê um export do Studio. `grep -rli "youtube studio" modules/*/scripts` acha só o texto do checklist do `youtube-script` e uma mensagem do `video-analysis`.

O trabalho:
- O operador baixa do próprio canal a tabela "Conteúdo" do modo avançado com as métricas de Y3, uma vez com o Studio em português e outra em inglês, nos formatos que o Studio oferecer.
- Os arquivos ficam em `modules/<app de Y1>/tests/fixtures/studio/`, que nunca é distribuído. São números agregados do canal do operador, sem dado de pessoa.
- O mapa de colunas vai para `references/studio.json`, com `checked_on`.
- **Aceite:** `studio.json` lista cada coluna nos dois idiomas, e a pergunta "o export traz a curva de retenção segundo a segundo?" tem resposta com o arquivo como prova.

### T1.2: o comando que lê o export
**Estado: ⬜.** O padrão a seguir existe: `ads-insights` lê os exports da Meta e do Google Ads com nomes de coluna nos dois idiomas (`references/colunas.json`) e amostra mínima com fonte (`references/leitura.json`, `checked_on` 2026-10-23).

O trabalho:
- Ler o CSV ou o ZIP que o integrante salvou: separador e idioma detectados, a linha de total separada, cada vídeo com as colunas de `studio.json`.
- Comparar cada vídeo com a mediana do próprio canal na mesma tabela: taxa de cliques das impressões, views e porcentagem média assistida.
- O diagnóstico, calculado pelo script e só acima da amostra de Y2:
  - muitas impressões e poucos cliques: a embalagem não convence;
  - muitos cliques e pouco tempo assistido: a embalagem promete o que o vídeo não paga;
  - poucas impressões e muitos cliques: o alcance é estreito.
- Gravar `<pasta do app>/studio/<data>/leitura.md` e `leitura.json`.
- **Aceite:** com o export da T1.1, `node --test` passa:
  - um vídeo abaixo do piso sai como "indício", sem veredito;
  - uma coluna removida do arquivo aparece em `missing` e nenhuma conta usa zero no lugar;
  - o resultado se repete igual em duas rodadas.

### T1.3: os títulos do canal pela taxa de cliques
**Estado: 🟡** `titles --channel` (`youtube-research` 1.1.0, `scripts/research.mjs`, função `titlesCommand`) mede os títulos do canal pelo multiplicador de views. A taxa de cliques das impressões, que é a medida direta de título e thumbnail, não entra.

O trabalho:
- Uma opção que usa a leitura do export como medida, com a mesma tabela de traços, gatilhos e palavras.
- Só vídeos acima do piso de Y2 entram.
- **Aceite:** com o export da T1.1, a tabela sai com a taxa de cliques no lugar do multiplicador. O `titulos.md` diz qual medida foi usada.

### T1.4: o roteiro usa o que o canal já respondeu
**Estado: 🟡** O `youtube-script` 1.2.0 já lê os títulos do canal por views (`references/pesquisa.md`, "Os títulos do canal dele"; `references/embalagem.md`, "O que funciona no canal dele").

O trabalho:
- Com a leitura do export, a embalagem cita a taxa de cliques do canal.
- Uma etapa opcional "depois de publicar" lê o vídeo que saiu do roteiro, com o diagnóstico da T1.2, e propõe o próximo teste A/B.
- **Aceite:** um caso novo em `tests/eval.json` em que a embalagem cita a taxa de cliques do canal com o n, e diz "indício" quando a amostra não basta.

## ÉPICO 2: a thumbnail de verdade

**Bloqueia:** a vitrine (T2.3) depende da imagem parada (T2.1) e, se Y7 for sim, das thumbnails dos outliers (T2.2).

### T2.1: a imagem parada e a conferência de thumbnail no motor
**Estado: 🟡** O que já existe:
- `frames` fotografa a página em qualquer instante (`video-render/references/interface.md:128`).
- `first_frame_readable` confere o texto do quadro 0 como capa (`interface.md:445`).
- `sheet --phone` mostra o vídeo a 360 px de largura (`interface.md:142`).
- O `youtube` de `redes.json` tem só a área segura do player: em 16:9, 80, 150, 100 e 100 px, com `checked_on` 2026-10-07.

O que falta:
- Nenhuma conferência de contraste: `grep -i "contrast\|wcag"` nos scripts e referências do motor não acha nada. Só a luminância dos flashes, em `scripts/lib/accept.mjs:35`.
- Nenhuma saída de imagem com limite de tamanho de arquivo.

O trabalho, depois de Y4, Y5, Y6 e Y9:
- Uma saída de imagem parada no tamanho de Y5, em JPG que caiba em 2 MB.
- Uma área `youtube_thumbnail` com o canto da duração (Y6).
- Uma conferência para a imagem parada: o corpo do texto medido na largura de 320 px, o canto livre, o contraste (Y9), o tamanho do arquivo e o 16:9.
- **Aceite:**
  - a página de exemplo do motor vira um JPG 16:9 de até 2 MB;
  - o `accept` reprova uma caixa de texto no canto da duração e aprova a mesma caixa fora dele;
  - os testes do motor passam, um app de cada vez.

### T2.2: as thumbnails dos outliers
**Estado: 🟡** (2026-10-30, aguardando Y7). O `youtube-research` 1.2.0 tem o comando `thumbnails`:
- `scripts/research.mjs`, função `thumbnailsCommand`;
- `scripts/lib/thumbnails.mjs`, que baixa o maior tamanho que existe, de `maxresdefault` a `hqdefault`;
- `i.ytimg.com` declarado nas permissões.

Ele recebe até 20 vídeos avulsos, ou `--channel` com um canal já lido; neste caso grava `thumbnails.md`, com as imagens lado a lado e o multiplicador de cada vídeo. Cada imagem fica em `youtube-research/videos/<id>/thumbnail.jpg` por 7 dias. Atrás de um proxy (sessão na nuvem), o comando roda de novo com `NODE_USE_ENV_PROXY=1`, como a CLI.

Verificado:
- `tests/thumbnails.test.mjs`: 4 testes, com o tamanho que falta, o erro de rede, o proxy e o canal com imagens guardadas;
- uma execução real em 2026-10-30 (dois vídeos avulsos e as 6 últimas de um canal público), também a partir da cópia instalada no workspace.

Falta: uma opção que pegue os N primeiros de uma pesquisa e grave o índice dela; hoje a IA passa os ids de `titulos.md`.
- **Aceite do que falta:** com uma pesquisa já feita, `thumbnails --outliers <id> --top N` grava N imagens e o índice, sem refazer a coleta.

### T2.3: a etapa da thumbnail no roteiro
**Estado: 🟡** O `youtube-script` 1.3.0 lê o padrão visual do canal e grava a seção "Thumbnails do canal" em `canal.md` (`references/embalagem.md`, "O padrão do canal"; o formato em `references/formato.md`). Também olha as thumbnails dos outliers do tema (`references/pesquisa.md`, "As thumbnails dos que mais subiram"). As ideias seguem esse padrão, cada uma com uma alavanca visual. A imagem continua em texto: o guia diz "As thumbnails saem como ideias, não como imagens" (`youtube-script/guides/pt-BR/usar.md:63`).

O trabalho:
- Depois da gravação, a IA tira os quadros candidatos do vídeo do criador (folha do motor), e ele escolhe.
- Cada variante (A, B, C) vira uma página com o quadro e o texto da embalagem, renderizada e conferida pela T2.1.
- A vitrine: uma imagem no tamanho de um celular com as variantes ao lado das thumbnails dos outliers (T2.2), para o teste do clique deixar de ser imaginado.
- **Aceite:**
  - num caso de `tests/eval.json` com uma gravação real, saem três JPG conferidos e a vitrine;
  - a IA não afirma nenhuma conferência que o script não fez;
  - nenhuma imagem de outro canal aparece dentro das thumbnails entregues.

### T2.4: textos e casos
**Estado: ⬜.**
- README, guias (`usar.md` e `abrir-o-capo.md`, nos dois idiomas), interface do motor e changelog dos apps alterados.
- **Aceite:** `npm run validate` e `npm run test:apps` passam, e os guias não têm comando nem link relativo.

## Riscos

| Risco | Primeiro sinal |
|---|---|
| O Studio muda nomes de coluna sem aviso | o teste da T1.2 com um export novo falha; os nomes conhecidos ficam em `studio.json` e o que vier diferente sai em `unknown_columns` |
| O integrante otimiza thumbnail só por clique, e o teste A/B do YouTube decide por tempo assistido | a embalagem ou a leitura recomenda uma thumbnail pela taxa de cliques sem olhar a porcentagem assistida |
| Muitos traços medidos numa amostra pequena dão um vencedor por acaso | um traço forte no canal que não aparece no tema; a regra das duas leituras (`youtube-research/references/metodologia.md`, "Títulos de alta performance") |
| O motor muda em paralelo ao ÉPICO 12 do plano de anúncios falados | outra sessão com mudança não commitada em `modules/video-render`; conferir com a lista de sessões antes de cada tarefa |
| Os termos de uso das imagens públicas do YouTube | a T2.2 foi feita antes de Y7 (2026-10-30): se a resposta for não, o comando `thumbnails` sai antes de publicar o `youtube-research` 1.2.0, e a vitrine sai só com as variantes |
| A regra de exagerar no interesse vira promessa que o vídeo não cumpre ("clickbait malicioso" na política do YouTube) | o `lint` dá `title_unpaid` no título escolhido, ou a crítica marca o defeito 2 (promessa não paga) |

## O que esta especificação não cobriu

- Nenhum export real do Studio foi examinado. Tudo da T1.2 depende da T1.1.
- O tamanho do selo de duração não foi medido.
- Os termos de uso foram lidos só na página geral (youtube.com/t/terms, em 2026-10-30). Nenhuma página específica sobre as imagens de `i.ytimg.com` foi achada, e nenhum advogado opinou.
- A força dos gatilhos novos do `youtube-research` 1.2.0 não foi medida numa pesquisa real: os padrões foram conferidos em títulos de exemplo (`tests/unit.test.mjs`).
- O resultado do teste A/B do YouTube (vencedor, preferido, inconclusivo) não tem export documentado. Ficou de fora.
- Thumbnail de Short (9:16, só pelo computador, resposta 72431) ficou de fora.
- Do levantamento, ficaram fora desta especificação:
  - os cortes para Shorts a partir do vídeo longo, que tocam a decisão antiga de deixar formatos curtos de fora;
  - as buscas do autocompletar do YouTube (endereço não oficial, só ordem, sem volume);
  - comparar concorrentes pelo nome;
  - o plano de conteúdo orgânico.
