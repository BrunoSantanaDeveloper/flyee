# Abrir o capô

Este guia mostra como a Pesquisa no Instagram chega a cada número, por que ela mede assim e o que fica guardado no seu projeto. Serve para conferir a conta, ajustar uma pesquisa ou entender um resultado estranho.

## Como ele trabalha

Uma pesquisa passa por cinco etapas: juntar os posts de cada perfil, separar Reels de posts estáticos, medir o normal de cada perfil, comparar cada post com esse normal e ordenar. Os comentários de um post são um pedido à parte.

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

## Os arquivos por dentro

Tudo fica em `instagram-research/`, na raiz do projeto.

| Arquivo | O que guarda |
|---|---|
| `profiles/<perfil>/profile.json` | o resultado completo do perfil: fonte, normais, todos os posts com as métricas e os avisos |
| `profiles/<perfil>/profile.md` e `profile.csv` | o relatório e a planilha |
| `profiles/<perfil>/raw.json` | a coleta bruta do Apify, com a data e o número de posts pedido |
| `profiles/<perfil>/leitura.json` | a sua leitura por captura, como foi importada |
| `outliers/<pesquisa>/` | o ranking de vários perfis em `.json`, `.md` e `.csv` |
| `posts/<código do post>/comments.json` e `comments.md` | os comentários de um post |
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

## As conferências

- **Leitura.** O app confere a versão, o tipo, o @, a data, a origem da captura e cada número. Qualquer problema volta com o caminho do campo, e nada é importado pela metade.
- **Custo.** Nenhuma coleta roda sem limite de posts e de gasto. Acima de US$ 1 estimado, nada roda sem o seu sim.
- **Perfil que não existe.** Volta como aviso, e os outros perfis da pesquisa seguem. Um perfil sem posts ou privado também.
- **Coleta incompleta.** Se vierem menos posts do que o pedido, o relatório diz quantos vieram.
- **Normal baixo.** Abaixo de 200 plays, o relatório avisa que poucos plays já viram multiplicador alto.

## Quando um número parece estranho

- **Um multiplicador enorme num perfil pequeno.** Confira o normal: com 50 plays de normal, um Reels de 2 mil plays dá 40×. O sinal é real, mas a base é pequena.
- **Um post com muitos comentários e poucas curtidas.** Procure o aviso "pede comentário".
- **Um perfil sem multiplicadores.** Menos de 3 posts com o número: o normal não existe.
- **Plays diferentes do que você vê no app do Instagram.** O número muda com o tempo, e a captura mostra o valor arredondado. Para a mediana, a diferença não pesa.

## Com outros apps

Outros apps do flyee.club usam este por baixo para buscar prova do que funciona no Instagram: o normal de um perfil, os outliers de um nicho e as dúvidas do público nos comentários. Se um app pedir a pesquisa e este não estiver instalado, a IA oferece instalar, e o outro app segue sem esses dados, dizendo o que ficou de fora.

## Privacidade

- O app nunca usa a sua conta do Instagram, nunca pede senha e nunca abre o Instagram por você.
- A chave do Apify fica só no seu computador, fora dos projetos, e vai apenas para o endereço da API do Apify, no cabeçalho da conexão. O app recusa enviá-la a qualquer outro lugar.
- Para o Apify vão só os @ dos perfis e os endereços dos posts que você pesquisa.
- Os comentários são gravados sem o nome de quem escreveu.
- As capturas de tela ficam no seu projeto e só a sua IA as lê.
