# Pesquisa: o roteiro começa no dado

Antes de escolher título e gancho, descubra o que o público deste tema já provou que quer. A pesquisa responde a quatro perguntas: o que funcionou, por que funcionou, o que falta e o que é verdade.

Ela usa o app **Pesquisa no YouTube** (`youtube-research`), que lê o YouTube sem chave. Os comandos, os campos e os erros estão no guia dele: `.flyee/modules/youtube-research/references/interface.md`. Como interpretar os números está em `.flyee/modules/youtube-research/references/metodologia.md`. Leia os dois antes da primeira pesquisa.

## 0. O app está instalado?

Se `.flyee/modules/youtube-research/scripts/research.mjs` não existe, diga ao integrante numa frase simples que vai instalar o app e o que ele faz ("Vou instalar o app Pesquisa no YouTube, que mostra quais vídeos do tema passaram do normal do canal") e rode você mesmo `npx --yes flyee@latest add youtube-research --yes --json`, com um tempo limite de 10 minutos, sem esperar resposta. Não liste permissões, arquivos nem programas.

Se a instalação falhar, ou se o integrante pedir para não instalar, siga sem a pesquisa e escreva em `briefing.md`: "sem prova de demanda: a pauta é uma aposta".

Com o app instalado, rode `check --json` dele uma vez por sessão. Se faltar o yt-dlp, avise numa frase e instale você mesmo com `npx --yes flyee@latest need yt-dlp --yes --json`, com um tempo limite de 10 minutos.

## 1. O que funcionou

Se o projeto já tem uma pesquisa do tema (`list --json` da Pesquisa no YouTube), reaproveite ou rode de novo com o mesmo nome: o que já foi lido vem do cache. Senão, traduza o tema em **3 a 6 buscas** (o termo técnico, o do dia a dia, a dor, a pergunta que o público digitaria) e avise que leva de um a dez minutos (rode com um tempo limite longo):

```
node .flyee/modules/youtube-research/scripts/research.mjs outliers "busca 1" "busca 2" "busca 3" --name youtube-script-<vídeo> --json
```

Use `--format short` para Shorts e `--window month` para tema de tendência. Leia o `outliers.md` devolvido e descarte o que não é do tema: a busca pega palavras com outro sentido e nichos vizinhos.

Tire **padrões, não vídeos**. Um padrão é o que se repete em **dois ou mais** outliers:

- o **ângulo**: contrário ao senso comum, bastidor, erro, passo a passo denso, comparação, número concreto;
- a **promessa do título**: o que promete e o custo implícito ("sem X", "em N dias");
- o **formato**: a duração, de frente para a câmera ou tela, lista ou história.

Um padrão de um vídeo só é uma aposta, e você diz isso. Muito vídeo com multiplicador baixo para todo mundo é tema saturado.

**Os títulos de alta performance, com número.** Depois da pesquisa, analise os títulos dela:

```
node .flyee/modules/youtube-research/scripts/research.mjs titles <id da pesquisa> --tools "nomes de ferramentas, produtos ou marcas do tema" --exclude <ids fora do tema> --json
```

O `titulos.md` traz quatro coisas, e a `embalagem.md` usa as quatro ao propor os títulos:

- **a lista** dos títulos que mais passaram do normal e dos que ficaram abaixo, cada um com os traços que tem. Leia primeiro: é o mecanismo dos que subiram (o gatilho, a promessa, a palavra do público), que você adapta ao canal, nunca copia;
- **os gatilhos** medidos: resultado, curiosidade, busca direta, contrário, custo ou erro, experimento, lista e comparação, os mesmos da tabela da embalagem;
- **a forma**: número, ferramenta, parênteses, "Como", pergunta, primeira pessoa, "sem X", caixa alta, "você", superlativo, ano, duas partes, emoji, e o tamanho mediano dos títulos dos outliers;
- **as palavras** que se repetem nos títulos acima e abaixo do normal, sem as das buscas.

Cada linha traz a mediana do multiplicador com e sem o traço e o tamanho de cada grupo. Confira `suggested_tools` antes de passar `--tools`: são nomes que parecem ferramentas, não uma certeza. Os vídeos que você descartou como fora do tema vão em `--exclude` (os `id` de `outliers.json`): sem isso, uma música ou um nicho vizinho com multiplicador enorme decide o traço. Se o `titulos.json` vier sem `top_titles` e sem `terms`, a Pesquisa no YouTube instalada é anterior à 1.1.0: atualize com `npx --yes flyee@latest update youtube-research --yes --json` e rode de novo.

**Os títulos do canal dele.** Quando o canal do criador já foi lido com `channel` (para a voz e o ritmo, em `perfil-de-voz.md`), analise também os títulos dele:

```
node .flyee/modules/youtube-research/scripts/research.mjs titles --channel <@canal do criador> --json
```

A mesma análise, contra o normal do próprio canal: mostra o que o público dele já respondeu. Com uns 30 vídeos quase todo grupo é pequeno. Um gatilho ou uma palavra forte no tema **e** no canal pesa mais do que um forte num só; um forte no tema e fraco no canal é uma aposta, e você diz isso.

## 2. Por que funcionou

Pegue a fala dos 2 ou 3 outliers mais relevantes:

```
node .flyee/modules/youtube-research/scripts/research.mjs transcript <id> <id> <id> --json
```

Para cada um, anote com os tempos:

| O que olhar | Onde |
|---|---|
| Como abre: a primeira frase, a família do gancho, a promessa | o primeiro minuto da transcrição |
| Os blocos e a ordem | a transcrição inteira; os capítulos, se houver (`video <id> --json`) |
| Onde paga a promessa | perto do fim |
| O que prendeu | `most_replayed`, os trechos mais revistos, em `video <id> --json` |
| O que afirma e com que prova | as afirmações e a evidência que ele dá |
| O pedido e o patrocínio | onde entram e como |

Depois compare os vídeos: o que se repete é padrão da categoria; o que só um faz é estilo dele. A legenda automática erra nomes e números: nunca cite um número só porque está na transcrição.

O que se leva é o **mecanismo**. Nunca o título, a frase de abertura ou a ordem exata de um vídeo.

## 3. O que falta

```
node .flyee/modules/youtube-research/scripts/research.mjs comments <id> <id> --max 100 --json
```

Agrupe os comentários em **dúvidas**, **objeções** e **pedidos**. Guarde as palavras exatas do público para a dor: elas valem mais do que o termo técnico. Uma dúvida que se repete e que nenhum vídeo do topo respondeu bem é a melhor ideia central disponível: a lacuna vale mais do que a imitação.

## 4. O criador pode ocupar esse ângulo?

Para cada padrão, pergunte: **o criador tem prova própria** (um sistema, um número, um caso, um erro vivido) que sustente a promessa? Se não tem, a pauta vira conteúdo genérico: descarte ou reposicione para o que a prova dele sustenta. E pergunte o que ele pode dizer que os outliers **não** disseram.

## 5. O que é verdade

Todo fato que entrar no roteiro tem origem:

| De onde vem | No roteiro |
|---|---|
| do próprio criador (viveu, mediu, construiu) | afirma; `[fonte: o criador]` se for um número |
| 3 ou mais fontes independentes que concordam | afirma, com `[fonte: …]` |
| 2 fontes | "segundo …" |
| 1 fonte, ou fontes que se contradizem | diz que há pouco dado, ou corta |
| nenhuma | `[CONFIRMAR: …]` e o roteiro não fica pronto |

- Vá até a fonte de origem e confira se ela diz mesmo aquilo: os números incham de citação em citação. Um número repetido em dez lugares que beberam da mesma origem é **um** dado.
- Anote a data de cada fonte. Fonte velha em tema que muda rápido não serve.
- Se a sua ferramenta pesquisa na internet, use-a para checar. Se não pesquisa, não finja: marque `[CONFIRMAR]`.
- O desempenho de um vídeo não prova que o que ele afirma é verdade.
- O que o vídeo afirma sobre uma ferramenta, um produto ou um serviço que aparece nele sai da ficha de verdade (`verdade.md`), montada com a documentação oficial, o README ou o site dele.

## 6. Um vídeo de referência

Um vídeo que funcionou, sobre o mesmo assunto, muitas vezes de outro país, mostra um fluxo que já prendeu gente. O roteiro do criador pode seguir esse fluxo **batida a batida**, com os fatos e a voz dele. Isso é mecanismo, não cópia: o mapa guarda a função de cada batida, nunca a frase.

**Qual vídeo.** O que o integrante indicar ("um vídeo como este"). Sem indicação, procure entre os outliers do tema o que tem o fluxo mais próximo do vídeo a fazer, inclusive em outro idioma (uma pesquisa com `--lang en`, por exemplo), mostre e confirme com ele antes de usar.

**As entradas aceitas:**

- `transcript <id> --json` lê a fala pela legenda, em qualquer idioma;
- uma transcrição que o integrante cola num arquivo, quando a legenda não vem;
- sem legenda nenhuma, o app Análise de vídeo lê imagem e som (`.flyee/modules/video-analysis/references/interface.md`).

**O que gravar em `referencia.md`:**

```markdown
# Referência: <título do vídeo> (<canal>, <idioma>)

Endereço: … · de onde veio a transcrição: legenda automática / colada pelo integrante / Análise de vídeo

## O mapa
| # | O que a referência faz | Como ela diz | Como entra no nosso |
|---|---|---|---|
| 1 | abre com o resultado rodando | "…" (00:00) | o resultado do criador na tela, com o som, antes da primeira frase |
| 2 | diz que procurou e não achou, com escopo | "…" (00:15) | a busca feita no dia, no idioma do público, com o número `[CONFIRMAR: quantos]` |
| … | | | |

## O que muda no contexto do nosso público
- Moeda e preço: …
- Sistema e programas comuns: …
- Termos de busca e o idioma: …
- Hábitos da plataforma: …
- Exemplos locais: …

## O que fica de fora
- … (exageros, promessas que não valem aqui, links e convites que não são do criador)
```

Regras do mapa:

- **A função de cada batida, nunca a frase.** "Como ela diz" cita a referência entre aspas, com o tempo, só para mostrar a batida; "Como entra no nosso" é escrito do zero, com os fatos do criador. Nenhum argumento, história ou sequência de frases dela vai traduzido para o roteiro. O teste: ponha o trecho da referência, traduzido, ao lado do seu; se a ordem das ideias e a imagem são as mesmas por várias frases, reescreva com um exemplo dele. Uma expressão comum dita do jeito dele e o mesmo fato com outra imagem não são cópia.
- **O contexto do público.** O que é verdade lá e não aqui muda: a moeda (um custo cobrado em dólar pesa diferente, e a fala diz isso no contraste com o jeito comum), os programas que vêm no computador, as palavras que o público busca, o que é comum na plataforma do país.
- **O que fica de fora.** Exagero ("não estou mentindo"), promessa que o criador não pode cumprir (um "de graça" que aqui não é), convite para a comunidade do outro: risque e diga por quê.
- **O teste de cópia já no mapa.** Ao escrever "como entra no nosso", mude a ordem do argumento ou troque a imagem por uma dele; não deixe o teste só para a crítica. O teste é de palavras e de sequência, nunca de ideia: uma ideia comum do ofício entra, dita do jeito dele.
- **A batida que não tem fato do criador** vira `[CONFIRMAR: …]` ou sai. Nunca invente a história de origem, a busca ou o resultado para preencher o mapa.

Mostre o mapa ao integrante antes da estrutura: é ele que decide se o fluxo serve. A estrutura do roteiro segue o mapa aprovado, e o documento completo (`roteiro-completo.md`) traz o mapa na parte "O fluxo do vídeo".

## 6b. Quando a leitura falha

Se `transcript`, `video` ou `comments` falharem (sem legenda, recusa do YouTube, vídeo fora do ar), diga numa frase o que falhou e ofereça três caminhos:

1. o integrante colar a transcrição num arquivo;
2. o app Análise de vídeo ler imagem e som;
3. seguir sem aquele vídeo, dizendo o que fica de fora.

Nunca tente por conta própria outro caminho para um conteúdo que a ferramenta não conseguiu ler: outro site, outra ferramenta, a página aberta no navegador.

Sem resposta dele, ou quando ele delegou: com a Análise de vídeo já instalada, use o caminho 2; sem ela, o 3 (instalar outro app pede o sim dele). Diga na entrega o que ficou de fora.

## 7. Pautas, quando não há tema

Quando o integrante perguntar "o que eu gravo?", pesquise o nicho do perfil do canal (seções 1 a 4) e entregue de **3 a 5 pautas**, ordenadas pelo retorno esperado contra o esforço, não pelo seu gosto. Diga qual é a aposta segura e qual é a de risco.

```markdown
### <pauta>
Origem no dado: <os outliers que sustentam, com views, multiplicador e base>
Ângulo: <o mecanismo, em uma frase>
Promessa: <o que quem assiste leva>
Para quem: <quem, exatamente>
Títulos: <3 variações: uma direta, uma contrária, uma com número>
Thumbnail e gancho: <a ideia visual e os 5 primeiros segundos>
Prova do criador: <o que ele tem que sustenta a promessa>
Esforço e retorno: <baixo, médio ou alto, e por que vale>
```

Antes de entregar, confira: cada pauta tem número real de origem? Algum título é cópia de um outlier? O padrão de um vídeo só foi marcado como aposta? Você disse o que a amostra não cobre? Grave em `roteiros/pautas-<data>.md`. A pauta escolhida vira o briefing de um vídeo.

## O que gravar em pesquisa.md

```markdown
# Pesquisa: <vídeo>

Feita em <data> com as buscas: … · <N> vídeos analisados, <N> canais medidos. Relatório: youtube-research/outliers/<id>/outliers.md

## Outliers que importam
| Vídeo | Canal | Views | Multiplicador (base) | Por que subiu |

## Padrões (em 2 ou mais outliers)
- …
Apostas (em um só): …
Saturado: …

## Títulos de alta performance
Os que mais subiram e o mecanismo de cada um: <de titulos.md, os 5 a 8 do topo, com o multiplicador>
| Gatilho, traço ou palavra | Com | Sem | n |
<de titulos.md; o tamanho mediano dos títulos dos outliers>
No canal dele: <de titles --channel, quando houver; o que coincide com o tema>

## Como os melhores fazem
<por vídeo: abertura, blocos, onde paga, o que prendeu>

## O que o público pergunta
Dúvidas: … · Objeções: … · Pedidos: … · Palavras dele para a dor: "…"

## Lacuna
<o que ninguém respondeu e este criador pode responder, com a prova que ele tem>

## Fatos
| Afirmação | Fonte e data | Confiança |

## Ressalvas
<tamanho da amostra, vídeos sem base, o que a busca não cobriu>
```

## Como a pesquisa entra no resto

- **Embalagem:** os títulos usam os mecanismos que funcionaram (nomeie qual), os gatilhos e traços medidos (com o número), as palavras que se repetem nos que subiram e o que já funciona no canal dele.
- **Gancho:** a dúvida mais repetida dos comentários é candidata a primeira frase.
- **Estrutura:** a lacuna é a ideia central; a objeção mais comum é respondida antes do pedido final.
- **Revisão:** o critério de fatos confere a tabela "Fatos".
