# Abrir o capô

Este guia mostra como a Pesquisa no Instagram chega a cada número, por que ela mede assim e o que fica guardado no seu projeto. Serve para conferir a conta, ajustar uma pesquisa ou entender um resultado estranho.

## Como ele trabalha

Uma pesquisa passa por cinco etapas: juntar os posts de cada perfil, separar Reels de posts estáticos, medir o normal de cada perfil, comparar cada post com esse normal e ordenar. Os comentários de um post, os traços das legendas e o vídeo de um Reels são pedidos à parte, feitos sobre uma pesquisa pronta.

### 1. Juntar os posts

Para cada perfil, o app procura primeiro o que o projeto já tem: uma coleta de menos de 24 horas com pelo menos o número de posts pedido, ou uma leitura das suas capturas de tela. Só o que falta é colhido. Assim, repetir uma pesquisa no mesmo dia não cobra de novo, e um perfil que você leu à mão não vira coleta paga sem você pedir.

Com a chave do Apify, os perfis que faltam vão numa coleta só, pelo coletor de posts do Instagram do Apify, que lê as páginas públicas sem login. O padrão são os últimos 30 posts de cada perfil, sem os fixados. Antes de rodar, o app calcula o custo pelo preço de tabela mais alto do coletor. Acima de US$ 1, ele para e devolve o valor para a IA perguntar a você. Toda coleta vai com dois limites que o próprio Apify respeita: o número máximo de posts e o gasto máximo, uma vez e meia a estimativa, nunca menos de US$ 0,05.

Sem a chave, a IA pede capturas da aba de Reels e escreve o que lê, número por número, num arquivo de leitura. O app converte cada texto ("12,3 mil", "1,2 mi", "987", "12.3K") e recusa o que não entende, dizendo o campo exato. A IA nunca converte um número por conta própria: assim, um erro de leitura aparece como erro, e não como um número plausível no meio da conta.

### 2. Separar Reels de posts estáticos

Reels são medidos por plays. Fotos e carrosséis não têm plays: são medidos por curtidas mais comentários. As duas escalas não se comparam, então cada tipo tem o seu normal e o seu ranking. Um carrossel com 300 curtidas e um Reels com 3 mil plays nunca disputam o mesmo lugar.

Quando o perfil esconde as curtidas, o Instagram devolve um número que não vale. O app guarda essas curtidas como desconhecidas, nunca como zero, e marca o post com "curtidas ocultas".

### 3. Medir o normal de cada perfil

O normal é a mediana do número de cada tipo nos posts colhidos. É mediana, e não média, porque um único post viral puxaria a média para cima e esconderia justamente o que você quer enxergar. Os fixados ficam de fora: costumam ser os maiores do perfil e entortariam a régua.

Com 5 posts ou mais, o normal é medido. Com 3 ou 4, é indício, e cada post desse perfil sai com o aviso. Com menos de 3, o perfil fica sem normal para aquele tipo, e os multiplicadores ficam vazios.

### 4. Comparar cada post com o normal

O multiplicador é o número do post dividido pelo normal do perfil. Ele cai numa faixa: explosivo a partir de 10×, outlier a partir de 3×, acima a partir de 1,5×, normal a partir de 0,5× e fraco abaixo disso.

Cada post também recebe avisos:

- **pede comentário**: 20 comentários ou mais, e mais de um comentário para cada duas curtidas. É o "comente EU e eu te mando", que infla o número com pedido, não com interesse.
- **parceria paga**: o post é marcado como parceria paga no Instagram.
- **menos de 7 dias** e **mais de 1 ano**: o número ainda vai mudar, ou foi comparado com o normal de hoje de um perfil que pode ter mudado.

Os Reels com duração conhecida entram em três faixas (até 20 s, de 21 a 60 s, acima de 60 s), cada uma com a mediana de plays e de multiplicador. Para comparar faixas, olhe o multiplicador, porque cada perfil tem o seu tamanho.

### 5. Ordenar

A ordem padrão é um índice: o multiplicador, com teto de 25 para que um perfil minúsculo não domine, vezes três pesos.

| Peso | Valor |
|---|---|
| engajamento (curtidas mais comentários sobre plays) | de 1,00 a 1,50, saturando em 10% |
| frescor | 1,25 até 30 dias, 1,10 até 90, 1,00 até 365, 0,85 depois |
| confiança no normal | 1 medido, 0,8 indício |

O índice só ordena. Para explicar um post, a IA cita os plays, o multiplicador e o normal do perfil. Você pode pedir a ordem pelo multiplicador puro ou pelo número bruto.

### Os comentários

Com a chave, o app colhe os comentários de um post pelo coletor de comentários do Instagram do Apify, até 100 por padrão e no máximo 500, e grava só o texto, as curtidas, as respostas e a data, do mais curtido ao menos curtido. O nome de quem escreveu não é gravado. Os comentários ficam guardados por 7 dias.

### As legendas

Desde a versão 1.1.0, a legenda de cada post fica inteira, como o autor escreveu: as quebras de linha, as hashtags e o pedido do fim. Antes, o app guardava só os primeiros 300 caracteres, numa linha só, e o fim da legenda se perdia. Os relatórios mostram só o começo de cada legenda, numa linha; o `.json` e a planilha guardam o texto todo.

Sobre uma pesquisa pronta, o app mede os traços das legendas, com o mesmo método da Pesquisa no YouTube para os títulos. Para cada traço, ele separa os posts em dois grupos, os que têm e os que não têm, e calcula a mediana do multiplicador de cada grupo e quantos posts há nele. Os traços são:

| Traço | O que o app procura |
|---|---|
| pergunta | um ponto de interrogação na legenda |
| número na primeira linha | um número no texto até a primeira quebra de linha |
| primeira pessoa | "eu", "meu", "minha", "comigo", verbos como "testei" e "fiz", e em inglês "I", "my" |
| lista em linhas | 3 ou mais linhas que começam com número ("1."), marcador ou emoji |
| hashtags no fim, hashtags no meio | onde as hashtags estão em relação ao texto |
| pedido ao público | comentar, salvar, compartilhar ou marcar alguém, ir ao link da bio, chamar no direct; cada um em separado e todos juntos |

Além dos traços, o tamanho da primeira linha (até 40 caracteres, de 41 a 80, de 81 a 125, acima de 125), o da legenda inteira e o número de hashtags entram em faixas, com a mediana do multiplicador e o número de posts de cada faixa, e com a mediana desses tamanhos nos outliers.

Os cuidados da conta:

- **Reels e posts estáticos ficam em tabelas separadas**, porque um multiplicador mede plays e o outro, curtidas mais comentários.
- **Parcerias pagas ficam fora**, porque parte do alcance foi comprada. Você pode tirar também os posts fora do tema.
- **Grupo pequeno é indício.** Com menos de 5 posts num dos lados (você pode pedir outro mínimo), o relatório marca o traço. Com menos de 30 legendas no total, a pesquisa toda é indício.
- **As regras leem português e inglês**, sem os links, as hashtags e as menções, e cada rótulo do relatório diz o que foi procurado. Letras estilizadas, como o negrito feito com símbolos, são lidas como letras comuns. Um pedido escrito de outro jeito fica de fora: o app não adivinha.
- **Andar junto não é causa.** O relatório diz isso no fim, e a IA também.

### O vídeo de um Reels

A coleta pelo Apify traz, em cada Reels, o link do vídeo nos servidores de mídia do Instagram. Esse link é assinado e traz escrita a hora em que deixa de valer; a assinatura impede mudar essa hora. O app lê essa hora no próprio link e a mostra em cada Reels, e por isso a IA oferece assistir logo depois da coleta.

Quando você pede para assistir, o app baixa o vídeo dos Reels escolhidos, de 1 a 5 por vez, nunca a coleta inteira. Antes de baixar, ele confere se o link ainda vale; um link vencido nem é chamado. O download vem só dos servidores de mídia do Instagram, sem a sua conta e sem a chave do Apify, com um teto de tamanho por vídeo (100 MB, ou mais, até 500 MB, se você pedir). O arquivo é gravado inteiro ou não fica: um download interrompido, grande demais ou que não seja um vídeo MP4 é apagado. Ao lado do vídeo, `video.json` guarda de qual coleta veio o link, quando ela foi feita e quando o vídeo foi baixado. Depois, o app Análise de vídeo assiste ao arquivo do seu projeto.

## Os arquivos por dentro

Tudo fica em `instagram-research/`, na raiz do projeto.

| Arquivo | O que guarda |
|---|---|
| `profiles/<perfil>/profile.json` | o resultado completo do perfil: fonte, normais, todos os posts com as métricas e os avisos |
| `profiles/<perfil>/profile.md` e `profile.csv` | o relatório e a planilha |
| `profiles/<perfil>/raw.json` | a coleta bruta do Apify, com a data e o número de posts pedido |
| `profiles/<perfil>/leitura.json` | a sua leitura por captura, como foi importada |
| `outliers/<pesquisa>/` | o ranking de vários perfis em `.json`, `.md` e `.csv` |
| `outliers/<pesquisa>/legendas.md` e `legendas.json` | os traços das legendas: as duas medianas e o tamanho de cada grupo, as faixas de tamanho e o que ficou fora da conta |
| `profiles/<perfil>/legendas.md` e `legendas.json` | o mesmo, para um perfil só |
| `posts/<código do post>/comments.json` e `comments.md` | os comentários de um post |
| `posts/<código do post>/video.mp4` e `video.json` | o vídeo de um Reels e a origem dele; o vídeo fica fora do git |
| `leituras/` | as leituras que a IA escreve antes de importar |

A planilha usa ponto e vírgula e vírgula decimal, como o Excel em português espera. Um texto que começa com `=`, `+`, `-` ou `@` ganha um apóstrofo na frente, para que nenhuma legenda vire fórmula ao abrir.

Você pode apagar qualquer pasta: o app colhe ou lê de novo quando precisar. Apagar `raw.json` faz a próxima pesquisa colher aquele perfil outra vez, com custo.

## Pedidos avançados

- "Pesquise 50 posts de cada perfil, não 30." Mais posts dão um normal mais estável, com custo maior.
- "Colha de novo, mesmo que seja de hoje." A IA pede uma coleta nova, sem reaproveitar.
- "Use só as minhas leituras, sem colher nada." A IA usa apenas o que você trouxe em capturas.
- "Ordene pelo multiplicador, sem o índice."
- "Meça também os carrosséis desse perfil, abrindo post por post." Sem a chave, cada post precisa ser aberto para ler as curtidas; a IA pergunta antes se vale o trabalho.
- "Junte a minha leitura do @perfil com a coleta dos outros." Uma pesquisa de vários perfis aceita perfis colhidos e lidos juntos, e o relatório diz a fonte de cada um.
- "Meça as legendas de novo sem estes dois posts, que são de outro assunto." Os posts tirados voltam no relatório, na parte do que ficou fora da conta.
- "Meça as legendas só do meu perfil." Com um perfil só, os grupos ficam pequenos, e quase tudo sai como indício.
- "Baixe o vídeo daquele Reels mesmo que seja grande." O teto sobe até 500 MB.

## As conferências

- **Leitura.** O app confere a versão, o tipo, o @, a data, a origem da captura e cada número. Qualquer problema volta com o caminho do campo, e nada é importado pela metade.
- **Custo.** Nenhuma coleta roda sem limite de posts e de gasto. Acima de US$ 1 estimado, nada roda sem o seu sim.
- **Perfil que não existe.** Volta como aviso, e os outros perfis da pesquisa seguem. Um perfil sem posts ou privado também.
- **Coleta incompleta.** Se vierem menos posts do que o pedido, o relatório diz quantos vieram.
- **Normal baixo.** Abaixo de 200 plays, o relatório avisa que poucos plays já viram multiplicador alto.
- **Legenda cortada.** Numa leitura por captura, uma legenda que termina cortada no "mais" é recusada, porque o fim dela, onde ficam as hashtags e o pedido, falta.
- **Pesquisa antiga.** Os traços de legenda de uma pesquisa feita antes da versão 1.1.0 saem com o aviso de que só o começo de cada legenda foi guardado.
- **Vídeo.** Link vencido, servidor que não é do Instagram, arquivo acima do teto ou que não é um vídeo: cada caso volta com o motivo, sem derrubar os outros vídeos do mesmo pedido.

## Quando um número parece estranho

- **Um multiplicador enorme num perfil pequeno.** Confira o normal: com 50 plays de normal, um Reels de 2 mil plays dá 40×. O sinal é real, mas a base é pequena.
- **Um post com muitos comentários e poucas curtidas.** Procure o aviso "pede comentário".
- **Um perfil sem multiplicadores.** Menos de 3 posts com o número: o normal não existe.
- **Plays diferentes do que você vê no app do Instagram.** O número muda com o tempo, e a captura mostra o valor arredondado. Para a mediana, a diferença não pesa.

## Com outros apps

Outros apps do flyee.club usam este por baixo para buscar prova do que funciona no Instagram: o normal de um perfil, os outliers de um nicho, os traços das legendas que foram bem e as dúvidas do público nos comentários. Se um app pedir a pesquisa e este não estiver instalado, a IA oferece instalar, e o outro app segue sem esses dados, dizendo o que ficou de fora.

Este app também usa outro: para assistir a um Reels, ele passa o vídeo baixado ao app Análise de vídeo. Se ela não estiver no projeto, a IA diz numa frase que vai instalá-la e instala; se não der, a pesquisa segue sem assistir, e o motivo da subida fica como hipótese.

## Privacidade

- O app nunca usa a sua conta do Instagram, nunca pede senha e nunca abre o Instagram por você.
- A chave do Apify fica só no seu computador, fora dos projetos, e vai apenas para o endereço da API do Apify, no cabeçalho da conexão. O app recusa enviá-la a qualquer outro lugar.
- Para o Apify vão só os @ dos perfis e os endereços dos posts que você pesquisa.
- Para baixar um vídeo, o app só chama os servidores de mídia do Instagram, pelo link da coleta, sem a sua conta e sem a chave do Apify. O vídeo fica no seu projeto, e só vai para outro lugar se você concordar, por exemplo quando a Análise de vídeo pergunta se pode enviá-lo ao Gemini.
- Os comentários são gravados sem o nome de quem escreveu.
- As capturas de tela ficam no seu projeto e só a sua IA as lê.
