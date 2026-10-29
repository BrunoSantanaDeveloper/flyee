# Abrir o capô

Este guia mostra como a Pesquisa no YouTube chega a cada número, por que ela mede assim e o que fica guardado no seu projeto. Serve para conferir a conta, ajustar uma pesquisa ou entender um resultado estranho.

## Como ele trabalha

Uma pesquisa de tema passa por seis etapas: buscar, filtrar, medir o normal de cada canal, calcular o multiplicador, ler os detalhes dos vídeos do topo e ordenar. A fala, os comentários, o normal de um canal e a medição de títulos são pedidos à parte, que reaproveitam o que já foi lido.

### 1. Buscar

A sua IA transforma o tema em 3 a 6 buscas, e o app aceita até 8 numa pesquisa. Uma busca só enviesa a amostra: o termo técnico encontra um público, o termo do dia a dia encontra outro e a pergunta que a pessoa digitaria encontra um terceiro.

Cada busca traz até 40 vídeos (de 5 a 100, se você pedir), com os filtros do próprio YouTube: o período de publicação (última semana, último mês, último ano ou sem filtro), só vídeos, sem canais nem playlists, e, numa pesquisa de Shorts, a duração curta. A ordem é a de relevância do YouTube, a não ser que você peça os mais vistos ou os mais recentes. Lives em andamento e estreias agendadas ficam de fora. As buscas rodam três de cada vez, e cada vídeo guarda a lista das buscas que o encontraram.

### 2. Filtrar

- **Idioma.** A busca do YouTube mistura idiomas. O app adivinha o idioma pelo título (português, espanhol ou inglês) e fica só com o do seu projeto. Títulos curtos demais para dizer o idioma ficam. Os vídeos do topo passam por uma segunda conferência, pelo idioma que o próprio vídeo declara, porque a busca mostra títulos estrangeiros já traduzidos. Um vídeo de outro idioma descoberto aí sai, e o próximo da fila entra no lugar.
- **Formato.** Por padrão, só vídeos longos, com mais de 3 minutos. Numa pesquisa de Shorts, só os de até 3 minutos. Um vídeo sem duração conhecida fica.
- **Views mínimas.** Vídeos com menos de 500 views saem.

A coleta inteira, antes dos filtros, fica gravada para conferência.

### 3. Medir o normal de cada canal

Para cada canal que sobrou, o app abre a página de envios do canal, na aba de vídeos ou na de Shorts, conforme o vídeo encontrado, e lê os últimos 30 envios. O normal é a mediana das views desses envios. É mediana, e não média, porque um único vídeo viral puxaria a média para cima e esconderia justamente o que você quer enxergar.

A página do canal mostra as views arredondadas ("6,4 mil"), e para uma mediana isso basta. O app lê essa página em inglês, porque é a versão em que os números arredondados chegam sem erro de leitura. Um canal precisa de pelo menos 5 envios com views para ter um normal.

São medidos até 60 canais por pesquisa (até 150, se você pedir), começando pelos que têm mais vídeos na amostra, quatro de cada vez. O normal de cada canal fica guardado por 7 dias, e a próxima pesquisa que encontrar o mesmo canal não precisa abrir a página de novo.

### 4. Escolher a base e calcular o multiplicador

O multiplicador é a divisão das views do vídeo pela base. A base é escolhida nesta ordem:

| Base | De onde vem | Peso de confiança |
|---|---|---|
| mediana do canal | os últimos 30 envios da mesma aba | 1,0 |
| mediana na amostra | os vídeos do mesmo canal nesta pesquisa, quando são 3 ou mais | 0,9 |
| inscritos | o número de inscritos do canal, nunca menos de 500 | 0,6 |

Sem nenhuma das três, o vídeo fica sem multiplicador. Os inscritos são uma aproximação fraca: um canal com 1 milhão de inscritos pode ter normal de 20 mil views. Por isso, medido por inscritos, as faixas mudam (explosivo a partir de 10×, outlier a partir de 5×, acima a partir de 1× e normal a partir de 0,1×), e o vídeo recebe o aviso "sem a mediana do canal". O piso de 500 inscritos evita multiplicadores absurdos em canais minúsculos.

Medido pelo canal ou pela amostra, as faixas são: explosivo a partir de 10×, outlier a partir de 3×, acima a partir de 1,5×, normal a partir de 0,5× e fraco abaixo disso.

### 5. Ler os detalhes do topo

A busca traz views, duração e canal, mas não traz data, curtidas, comentários nem inscritos. Para isso o app abre a página de cada vídeo, o que é bem mais lento, e por isso só faz isso com os vídeos do topo: 15 por padrão (de 0 a 50), escolhidos pelos maiores multiplicadores. Até um terço dessas vagas vai para os vídeos mais vistos que ficaram sem base, para que os inscritos deles sirvam ao menos de aproximação.

Dessas páginas saem também os capítulos, até 15 tags, o começo da descrição, se há legenda e os trechos mais revistos: até três picos do gráfico de trechos mais repetidos do YouTube, distantes entre si, sem contar o começo do vídeo, que sempre aparece alto.

### 6. Ordenar

O ranking segue um índice:

**índice = multiplicador (no máximo 25) × peso do engajamento × peso do frescor × peso de confiança da base**

- **Engajamento** é a soma de curtidas e comentários dividida pelas views. O peso vai de 1,00 a 1,50 e chega ao máximo com 10% de engajamento.
- **Frescor** vale 1,25 até 30 dias, 1,10 até 90 dias, 1,00 até um ano e 0,85 depois disso.
- **O teto de 25** impede que um canal minúsculo, com um vídeo de 300×, domine o ranking sozinho.

O índice só ordena. Ao explicar um vídeo, a IA cita as views, o multiplicador e a base. Você pode pedir outra ordem: pelo multiplicador, pelas views por dia ou pelas views. As views por dia são as views divididas pelos dias desde a publicação, e separam o vídeo que explodiu do que juntou views ao longo de anos.

Cada vídeo pode trazer avisos: canal pequeno (menos de 5 mil inscritos), menos de 7 dias, mais de 1 ano, Short (até 3 minutos) e sem a mediana do canal. A pesquisa traz ressalvas quando a amostra tem menos de 60 vídeos, quando canais ficaram sem medição, quando uma busca ou a leitura de detalhes falhou, quando vídeos de outros idiomas saíram e quando não há filtro de data.

### A fala de um vídeo

A transcrição vem da legenda, sem baixar o vídeo. O app escolhe a legenda mais fiel à fala: a do idioma original do vídeo, primeiro a escrita pelo canal e, se não houver, a automática do YouTube. Ele evita a legenda traduzida automaticamente, que costuma falhar. Sem saber o idioma original, tenta português e depois inglês.

O texto vira blocos de leitura de até uns 12 segundos, cada um com o tempo de início. O app conta as palavras faladas, sem as marcas de som como "[Música]", e calcula o ritmo em palavras por minuto quando há pelo menos 30 segundos de fala. Esse é o ritmo real daquele criador.

### Os comentários

O app lê os comentários principais, sem as respostas: por padrão os 100 mais relevantes, na ordem do YouTube. Você pode pedir de 10 a 500, ou os mais novos. De cada comentário ficam o texto, as curtidas, se está fixado, se foi escrito pelo próprio canal e há quanto tempo foi publicado. O nome de quem escreveu nunca é guardado.

### Os títulos

Sobre uma pesquisa já feita, o app analisa os títulos de alta performance em quatro partes.

1. **A lista.** Os títulos que mais passaram do normal do próprio canal, do maior para o menor, e os que ficaram abaixo do normal, cada um com os traços que tem. É por ela que a leitura começa: mostra o mecanismo que as tabelas resumem.
2. **Os gatilhos.** Oito formas de puxar o clique, contadas pelas palavras que as marcam:
   - resultado: dinheiro, tempo, número com unidade;
   - curiosidade: "isso", "esse", "o segredo", "por que", "o X que";
   - busca direta: "como", "passo a passo", "tutorial", "iniciantes";
   - contrário: "pare de", "não faça", "mito", "ninguém conta";
   - custo ou erro: "erro", "evite", "perdendo", "jogando fora";
   - experimento: "testei", "por 30 dias", "desafio";
   - lista: "5 dicas", "top 10";
   - comparação: "vs", "X x Y", "melhor que", "qual escolher".

   Um título de curiosidade sem nenhuma dessas palavras fica fora da conta, então o número é um piso.
3. **A forma.** Ter número; nome de ferramenta ou marca, quando os nomes do tema são informados; parênteses ou colchetes; começar com "Como"; ser uma pergunta; primeira pessoa; "sem X"; uma palavra em caixa alta; falar com "você"; superlativo; um ano; duas partes separadas por dois pontos, barra ou traço; emoji. E o tamanho: a mediana de caracteres na amostra e nos outliers, e o multiplicador em quatro faixas (até 40, 41 a 60, 61 a 80 e acima de 80 caracteres).
4. **As palavras.** As palavras e os pares de palavras que aparecem em pelo menos 5 títulos, sem as palavras das buscas, que estão em todos. Qualquer número conta como N, então "7 dias" e "30 dias" somam juntos.

Para cada traço e cada palavra, o app compara a mediana do multiplicador dos títulos que têm o traço com a dos que não têm, e mostra quantos títulos há em cada grupo. Um grupo com menos de 5 títulos aparece como indício.

A mesma análise vale para o seu canal: depois de ler os seus últimos envios, o app mede os seus títulos contra o seu próprio normal. Mostra o que o seu público já respondeu. Com uns 30 vídeos, quase todo grupo é pequeno, e as views da aba do canal vêm arredondadas pelo YouTube.

O app sugere nomes que parecem ferramentas ou marcas nos títulos, para você e a IA confirmarem antes de usar, e deixa tirar da conta os vídeos fora do tema. A busca pega palavras com outro sentido e nichos vizinhos, e eles distorcem os traços.

O resultado mostra o que anda junto com os títulos que foram bem nesta amostra. Ele não prova causa, e outro tema ou outro período dão outros números. Com tantos traços e palavras medidos de uma vez, algum parece forte por acaso: vale mais o que aparece no tema e no seu canal ao mesmo tempo.

## Os arquivos por dentro

Tudo fica na pasta `youtube-research/` do seu projeto.

| Arquivo | O que guarda |
|---|---|
| `outliers/<pesquisa>/outliers.md` | o relatório para ler: os 30 primeiros do ranking, as ressalvas e como ler |
| `outliers/<pesquisa>/outliers.csv` | todos os vídeos, com ponto e vírgula entre as colunas e vírgula decimal, para abrir direto numa planilha em português |
| `outliers/<pesquisa>/outliers.json` | tudo: as buscas, as opções usadas, a amostra, as ressalvas e cada vídeo com todas as métricas |
| `outliers/<pesquisa>/raw.json` | a coleta das buscas antes dos filtros |
| `outliers/<pesquisa>/titulos.md` e `titulos.json` | a análise dos títulos do tema; cada nova análise grava por cima da anterior |
| `channels/<canal>/channel.md` e `channel.json` | o normal de um canal e os últimos envios, com multiplicador e faixa |
| `channels/<canal>/titulos.md` e `titulos.json` | a análise dos títulos do canal, contra o normal dele |
| `videos/<id>/video.json` | os dados públicos de um vídeo |
| `videos/<id>/transcript.md` e `transcript.json` | a fala em blocos com tempo, para ler, e os trechos com início e fim, para outros apps |
| `videos/<id>/comments.md` e `comments.json` | os comentários numerados, com as curtidas |
| `cache/channels/` | o normal de cada canal já medido, por aba |

A pasta de cada pesquisa leva o nome da primeira busca e a data, ou o nome que você pedir. Uma nova pesquisa com a mesma primeira busca, no mesmo dia, grava por cima da anterior.

No relatório, uma célula vazia é dado que o app não leu ou que o YouTube não mostrou: data, views por dia e engajamento só existem nos vídeos lidos em detalhe, e um vídeo sem faixa e sem multiplicador ficou sem base de comparação.

O app reaproveita o que já leu: o normal de um canal por 7 dias, os dados de um vídeo por 1 dia (as views continuam subindo), os comentários por 7 dias e a transcrição para sempre. Os arquivos são seus: você pode abrir, copiar e apagar. Apagar a pasta `cache/` ou a pasta de um vídeo só faz o app ler tudo de novo na próxima vez. Para ignorar o que já foi lido sem apagar nada, peça para refazer a pesquisa do zero.

## Pedidos avançados

| Para | Peça assim |
|---|---|
| o período | "Pesquise só o que saiu na última semana." ou "Pesquise sem filtro de data." |
| Shorts | "Faça a mesma pesquisa só com Shorts." |
| outro idioma | "Faça uma pesquisa separada em inglês sobre o mesmo tema." ou "Não filtre por idioma." |
| uma amostra maior | "Use 6 buscas, traga até 80 vídeos por busca e meça até 100 canais." |
| mais detalhes | "Leia data, curtidas e comentários dos 30 primeiros." |
| um corte de views | "Ignore vídeos com menos de 10 mil views." |
| a ordem | "Ordene pelas views por dia." ou "Busque pelos vídeos mais vistos do YouTube." |
| o nome e os dados | "Salve esta pesquisa como airfryer-outubro." ou "Refaça sem aproveitar o que já foi lido." |
| um canal a fundo | "Leia os últimos 60 envios do meu canal." ou "Meça os Shorts do canal @exemplo." |
| mais comentários | "Traga os 300 comentários mais relevantes deste vídeo." ou "Quero os mais novos." |
| títulos | "Meça os títulos considerando Airfryer, Mondial e Philco como marcas e sem os vídeos fora do tema." |
| títulos mais rigorosos | "Use só os vídeos medidos pelo próprio canal e trate como indício todo grupo com menos de 10 títulos." |
| os títulos do seu canal | "Analise os títulos do meu canal @meucanal: quais passaram do meu normal e o que eles têm em comum?" |
| uma lista maior | "Liste os 30 títulos que mais passaram do normal." |
| vários vídeos | "Pegue a fala destes 5 vídeos." Cabem até 20 por pedido. |
| o histórico | "O que eu já pesquisei neste projeto?" |

Sem filtro de data, vídeos antigos são comparados com o normal de hoje do canal: confira as views por dia antes de concluir. Shorts e vídeos longos na mesma pesquisa distorcem o ranking, então prefira duas pesquisas separadas.

## Quando algo dá errado

| O que aparece | O que houve | O que a IA faz |
|---|---|---|
| falta o yt-dlp | o programa não está no computador | avisa numa frase e instala depois do seu sim; se a instalação pedir algo seu, mostra o passo único |
| o YouTube pediu para confirmar que não é um robô, ou limitou os pedidos | uma recusa temporária de consultas automáticas | atualiza o yt-dlp, espera alguns minutos e repete com menos buscas, canais ou vídeos |
| uma busca falhou | as outras seguem | entrega o resultado e diz qual busca falhou |
| canais sem medição | o limite de canais ou uma falha ao abrir a página | usa a mediana na amostra ou os inscritos, e a ressalva diz quantos foram |
| sem legenda | o vídeo não tem, ou o YouTube não a entregou naquela hora | oferece três caminhos: você colar a transcrição num arquivo, o app Análise de vídeo ouvir o áudio ou seguir sem aquele vídeo |
| vídeo privado, só para membros, com restrição de idade ou removido | o app só lê o que é público, sem login | segue sem aquele vídeo |
| o canal não tem essa aba | por exemplo, nunca publicou Shorts | usa a outra aba |
| sem conexão | o app não falou com o YouTube | pede para você conferir a internet e tenta de novo |

Quando a leitura de um vídeo falha, a IA não tenta outro caminho por conta própria, como outro site ou outra ferramenta. Ela diz o que falhou e você escolhe. Um erro novo do yt-dlp costuma se resolver com a atualização dele.

## Quando um número parece estranho

- **Multiplicador enorme, de 300× ou 3.000×.** Quase sempre é canal pequeno ou base por inscritos. Olhe a base e as views. No ranking, o multiplicador conta no máximo 25.
- **Views altíssimas e engajamento baixíssimo.** Pode ser audiência comprada ou um viral fora do nicho. Não tome como padrão.
- **Vídeo antigo no topo.** Confira o aviso "mais de 1 ano" e as views por dia: views juntadas em anos não são demanda de hoje.
- **Vídeo de outro idioma na lista.** O filtro reconhece português, espanhol e inglês pelo título. Peça para tirá-lo da leitura.
- **O normal do seu canal parece baixo.** Os vídeos mais recentes ainda estão juntando views. A lista do canal vem do mais novo para o mais antigo, então os primeiros ainda vão crescer.
- **A pesquisa demorou.** O tempo vai quase todo na medição dos canais. A próxima pesquisa no mesmo tema reaproveita o que já foi medido, e você pode pedir menos buscas ou menos canais.

## Com outros apps

O app **Roteiro para YouTube** chama este para provar a demanda de uma pauta, medir os títulos que funcionaram no tema antes de propor os seus, ler a fala de vídeos de referência e dos seus próprios vídeos (para conhecer a sua voz) e achar nos comentários as dúvidas que ninguém respondeu. Sem este app instalado, o Roteiro para YouTube segue funcionando, mas a pauta sai sem a prova de demanda.

Outros apps usam as mesmas funções que a sua IA usa, e o resultado vai para a mesma pasta `youtube-research/`, com o nome do app no começo do nome da pesquisa. Assim tudo o que foi pesquisado fica num lugar só, e um app aproveita o que outro já leu.

Quando um vídeo não tem legenda, este app não tenta ouvir o áudio. Para isso existe o app **Análise de vídeo**, que assiste ao vídeo com imagem e som.

## Privacidade

- O app lê só páginas públicas do YouTube: a busca, a página de envios de um canal, a página de cada vídeo, as legendas e os comentários. É o mesmo que qualquer visitante vê sem entrar numa conta.
- Ele nunca entra numa conta do YouTube, não usa o login do seu navegador e não usa chave.
- Ele nunca baixa o vídeo. A legenda passa por uma pasta temporária, apagada logo em seguida.
- Os pedidos vão do seu computador direto para o YouTube, como uma visita ao site, e o YouTube os vê vindo da sua conexão.
- O nome de quem comentou nunca é guardado.
- Tudo o que o app grava fica na pasta `youtube-research/` do seu projeto. Nada disso vai para o flyee.club.
- Ao terminar, a IA registra no flyee.club que o app foi usado, com o nome, a versão e a trilha do app e dados técnicos, como as versões do flyee. O tema, as buscas, os vídeos e os resultados nunca vão nesse registro.
