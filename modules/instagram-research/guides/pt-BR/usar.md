# Como usar

A Pesquisa no Instagram mostra quais Reels e posts fizeram muito mais do que o normal do próprio perfil, e quantas vezes mais. Serve para quem publica ou anuncia no Instagram e quer escolher o próximo post, ou o próximo anúncio, pelo que já funcionou com o público, com números, em vez de palpite.

Um Reels com 500 mil plays num perfil que sempre faz 500 mil diz pouco. Um Reels com 40 mil num perfil que costuma fazer 4 mil diz bastante: o tema ou o gancho levaram o post para além do público de sempre. Esses são os outliers. O app os encontra no seu perfil e nos perfis do seu nicho, e a sua IA explica por que cada um provavelmente subiu e o que se repete entre eles, inclusive nas legendas. Com a coleta automática, ela também pode assistir aos Reels que você escolher.

Você pode pedir a pesquisa direto à sua IA. Outros apps do flyee.club também usam este por baixo, por exemplo para buscar prova do que funciona antes de propor um anúncio.

## Peça assim

- "Analise o meu perfil @meuperfil no Instagram: qual é o meu normal e quais Reels passaram dele?"
- "Compare estes perfis e me mostre os Reels que mais passaram do normal: @perfil1, @perfil2, @perfil3."
- "O que as legendas dos posts que mais passaram do normal têm em comum?"
- "Assista aos dois Reels que mais passaram do normal e me diga qual foi o gancho de cada um."
- "O que os meus concorrentes postam que dá mais resultado?"
- "Que duração de Reels funciona melhor nesse nicho?"
- "O que o público pergunta nos comentários deste Reels?", com o endereço do post logo depois.

Bastam os perfis. Se faltar alguma coisa, a IA pergunta. O app não procura perfis por tema: se você pedir sugestões, a IA propõe uma lista e confirma com você antes de pesquisar.

## Dois jeitos de colher os números

**Sem chave, pelas suas capturas de tela.** Você abre a aba de Reels de cada perfil, no celular ou no computador, e tira duas ou três capturas de tela rolando a página. Cada miniatura mostra quantas vezes o vídeo foi visto. Você salva as imagens numa pasta do projeto e diz à IA onde estão. Ela lê os números como aparecem na tela, e o app faz a conta. Se um número estiver ilegível, a IA pede uma captura mais nítida, em vez de chutar.

**Com a chave do Apify, automático.** O Apify é um serviço que colhe dados públicos do Instagram sem usar a sua conta, e cobra pelo uso, do crédito que você tem lá. Com a chave, a IA colhe sozinha os últimos 30 posts de cada perfil, com plays, curtidas, comentários, duração, data, a legenda inteira e parceria paga, o link do vídeo de cada Reels e também os comentários de um post.

Para ligar a coleta automática, peça à IA: "ligue a coleta automática da pesquisa no Instagram". Ela mostra onde criar a conta e o token no Apify e abre uma página no seu navegador, onde você cola o token e clica em Salvar. A chave nunca passa pelo chat e fica guardada só neste computador, fora dos seus projetos. Numa sessão do Claude Code na nuvem, onde essa página não abre, a chave fica como segredo de rede do ambiente da sessão, que a sessão usa sem ver; a IA diz onde guardá-la.

## Quanto custa a coleta automática

Pela tabela do Apify de outubro de 2026:

| Coleta | Custo aproximado |
|---|---|
| um perfil, 30 posts | US$ 0,08 |
| dez perfis, 30 posts cada | US$ 0,81 |
| 100 comentários de um post | US$ 0,26 |

Antes de qualquer coleta acima de US$ 1, a IA diz o valor e espera o seu sim. Toda coleta tem um teto, e o que já foi colhido nas últimas 24 horas é reaproveitado, sem cobrar de novo.

## O que acontece

1. **A conferência.** A IA vê se a chave do Apify está salva. Sem ela, segue pelo modo das capturas.
2. **O pedido.** A IA confere os perfis e o que você quer decidir: o que publicar, o que anunciar, que formato usar.
3. **A coleta.** Com a chave, leva de um a alguns minutos. Sem ela, a IA pede as capturas e lê cada uma.
4. **A leitura.** No chat vem a leitura, não a tabela: os 5 a 8 posts que mais importam, com plays, multiplicador e o motivo provável da subida; os padrões que aparecem em dois ou mais outliers; o que as legendas que foram bem têm em comum, com o tamanho de cada grupo; a duração que funciona; as ressalvas da amostra.
5. **Mais fundo, se você quiser.** Os comentários dos maiores outliers, agrupados em dúvidas, objeções e pedidos. E os vídeos dos maiores outliers, assistidos pelo app Análise de vídeo, que confirmam ou derrubam o motivo provável da subida.

## O que você recebe

Tudo fica na pasta `instagram-research/` do seu projeto.

| Arquivo | O que tem |
|---|---|
| `profiles/<perfil>/profile.md` | o normal do perfil e os posts contra esse normal |
| `profiles/<perfil>/profile.csv` | a planilha com todos os posts, que abre no Excel e no Google Planilhas |
| `outliers/<pesquisa>/outliers.md` | o ranking de vários perfis, com faixas, avisos e ressalvas |
| `outliers/<pesquisa>/outliers.csv` | a planilha da pesquisa |
| `outliers/<pesquisa>/legendas.md` | o que as legendas têm em comum com os posts que foram bem, traço por traço |
| `posts/<post>/comments.md` | os comentários de um post, sem o nome de quem escreveu |
| `posts/<post>/video.mp4` | o vídeo de um Reels que você pediu para assistir |
| `leituras/` | as leituras das suas capturas de tela |

## Como ler um outlier

O número que importa é o **multiplicador**: os plays do Reels divididos pelo normal do perfil. O normal é a mediana dos últimos posts do perfil, sem os fixados. Um Reels de 40 mil plays num perfil de normal 4 mil tem multiplicador 10×. Posts de foto e carrosséis não têm plays: são medidos por curtidas mais comentários, contra o normal deles, num ranking à parte.

| Multiplicador | Faixa | O que quer dizer |
|---|---|---|
| 10× ou mais | explosivo | muito acima do perfil; vale estudar a fundo |
| 3× ou mais | outlier | sinal forte, que dá para repetir |
| 1,5× ou mais | acima | funcionou, mas pode ter sido a execução, e não o tema |
| 0,5× ou mais | normal | dentro do esperado; ensina pouco |
| abaixo de 0,5× | fraco | o tema não puxou o público, ou a execução falhou |

Alguns avisos evitam conclusões erradas:

- **pede comentário**: o post pediu um comentário em troca de algo, e o número mede o pedido, não o interesse pelo tema.
- **parceria paga**: parte do alcance foi comprada.
- **menos de 7 dias**: o número ainda vai mudar.
- **normal com poucos posts**: o perfil tem 3 ou 4 posts com o número; vale como indício.
- **curtidas ocultas**: o perfil esconde as curtidas, e o engajamento fica de fora.

A ordem do relatório segue um índice que pesa também o engajamento e a idade do post. O índice só ordena: para explicar um post, a IA cita plays, multiplicador e o normal do perfil. Um padrão só conta quando aparece em dois ou mais outliers. Em um post só, é aposta, e a IA diz isso.

## O que as legendas têm em comum

Para cada traço de legenda, o app separa os posts em dois grupos, os que têm o traço e os que não têm, e compara o multiplicador do meio de cada grupo. Os traços são: uma pergunta, um número na primeira linha, a primeira pessoa, uma lista em linhas, as hashtags no fim ou no meio do texto, e o pedido ao público, seja para comentar, salvar, compartilhar, ir ao link da bio ou chamar no direct. O tamanho da primeira linha, o da legenda inteira e o número de hashtags também entram, em faixas.

Um resultado assim, "pede para salvar: 2,1× com 14 posts, contra 1,0× com 60 posts", quer dizer que, nesta pesquisa, os posts que pediam para salvar fizeram, no meio do grupo, duas vezes o normal do próprio perfil, e os outros ficaram no normal.

Andar junto não é causa: um traço pode vir com um tema que puxa público, então use o resultado como ideia para testar no próximo post. Com menos de 5 posts num dos lados, o relatório marca o traço e a IA diz que é indício. Reels e posts de foto ficam em tabelas separadas, e as parcerias pagas ficam fora da conta, porque parte do alcance foi comprada.

As legendas vêm da coleta automática. Pelas capturas da aba de Reels, elas não aparecem.

## Assistir aos Reels

Cada Reels colhido pelo Apify traz o link do vídeo, e esse link só vale por um tempo depois da coleta. Por isso, logo depois da pesquisa, a IA oferece assistir aos dois ou três maiores outliers, ou aos que você escolher. Com o seu sim, ela baixa esses vídeos para o projeto e passa cada um ao app Análise de vídeo, que descreve o gancho dos primeiros segundos, o que aparece, o que é dito e como foi editado. Se a Análise de vídeo ainda não estiver no projeto, a IA diz numa frase que vai instalá-la e instala.

Se o link já tiver vencido, assistir pede uma coleta nova daquele perfil, e a IA diz o custo antes. Sem a chave, os vídeos só entram se você tiver o arquivo.

## Dicas

- Meça o seu perfil primeiro. Saber o seu normal mostra o que é um bom resultado para você.
- Compare com perfis do seu tamanho. Um perfil gigante impressiona pelo número e ensina pouco pelo multiplicador.
- De 5 a 15 perfis do nicho dão uma leitura melhor do que 2 ou 3.
- Leve o mecanismo, nunca a cópia: o gancho e o formato, do seu jeito.
- Peça os comentários dos maiores outliers. Uma dúvida que se repete e ninguém respondeu é pauta, e às vezes é o anúncio.

## Limites

- Só perfis públicos. O app nunca usa a sua conta do Instagram e nunca pede a sua senha.
- Pelas capturas de tela vêm só as visualizações dos Reels. A duração, as curtidas, a data, as legendas, os comentários e os vídeos precisam da coleta automática ou de abrir post por post.
- Sem assistir ao vídeo, o motivo de um post ter subido é uma hipótese a partir da legenda, da duração e do que você contar. A IA só assiste aos Reels que você escolher, com a coleta automática e o app Análise de vídeo, ou com o arquivo do vídeo.
- Os traços de legenda são achados por regras de texto em português e em inglês. Um pedido escrito de outro jeito, ou noutra língua, fica de fora.
- Com menos de 5 perfis ou menos de 60 Reels no total, os padrões são indício, e o relatório avisa.
- Colher dados do Instagram com ferramentas automáticas pode contrariar os termos de uso da Meta, mesmo quando os dados são públicos. Use a pesquisa para estudar o que funciona, nunca para copiar posts de outros perfis.
- O app não publica nada e não mexe na sua conta de anúncios.
