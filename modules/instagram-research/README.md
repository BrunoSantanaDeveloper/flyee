# Pesquisa no Instagram

Mostra, com números de verdade, quais Reels e posts fizeram muito mais do que o normal do próprio perfil, no seu perfil e nos perfis do seu nicho. Assim você decide o que publicar ou anunciar pelo que já funcionou com o público.

## O que ele faz

Um Reels com 500 mil plays num perfil que sempre faz 500 mil não ensina nada. Um Reels com 40 mil num perfil que costuma fazer 4 mil mostra que o tema ou o gancho levaram o post para além do público de sempre. Este app encontra esses posts: mede o normal de cada perfil pelos últimos posts dele e calcula quantas vezes cada post passou desse normal. Reels e posts estáticos são medidos separados, porque um tem plays e o outro não.

A sua IA lê o resultado e entrega a leitura: os posts que importam e o motivo provável de cada um ter subido, os padrões que se repetem entre perfis, a duração que funciona no nicho e as ressalvas. Você também pode pedir os comentários de um post, com as dúvidas e objeções do público.

O app também olha as legendas. Para cada traço, como uma pergunta, uma lista, as hashtags no fim ou um pedido para salvar, comentar ou chamar no direct, ele compara os posts que têm o traço com os que não têm e diz quantos posts há em cada grupo. Isso mostra o que anda junto com os posts que foram bem, não a causa: um grupo pequeno é só um indício, e a sua IA diz isso.

E, com a coleta automática, a sua IA pode assistir aos Reels que mais passaram do normal: ela baixa o vídeo dos que você escolher, antes que o link da coleta vença, e o app Análise de vídeo descreve o gancho e a edição de cada um. Sem assistir, o motivo da subida é uma hipótese tirada da legenda e da duração.

O relatório fica numa pasta do seu projeto, com uma planilha que abre no Excel e no Google Planilhas.

## O que você precisa

- Uma das IAs em que o app foi testado.
- Para a coleta automática, opcional: uma conta no Apify, um serviço que colhe dados públicos do Instagram e cobra pelo uso.
- Para assistir aos Reels, opcional: o app **Análise de vídeo** (`video-analysis`). Quando você pede para assistir e ele ainda não está no projeto, a sua IA diz numa frase que vai instalá-lo e instala na hora.

## Peça assim

> "Analise o meu perfil @meuperfil no Instagram: qual é o meu normal e quais Reels passaram dele?"

Outros pedidos:

- "Compare estes perfis e me mostre os Reels que mais passaram do normal: @perfil1, @perfil2, @perfil3."
- "O que as legendas dos posts que mais passaram do normal têm em comum?"
- "Assista aos dois Reels que mais passaram do normal e me diga qual foi o gancho de cada um."
- "O que os meus concorrentes postam que dá mais resultado?"
- "Que duração de Reels funciona melhor nesse nicho?"
- "O que o público pergunta nos comentários deste Reels?", com o endereço do post logo depois.

## Sem a chave

O app funciona sem chave nenhuma, pelo modo manual. Você tira duas ou três capturas de tela da aba de Reels de cada perfil, onde aparecem as visualizações de cada vídeo, e salva na pasta do projeto. A sua IA lê os números de cada miniatura como aparecem na tela, e o app faz a conta. Leva uns minutos por perfil.

A aba de Reels mostra só as visualizações. Por isso, sem a chave, ficam de fora a duração, as curtidas, a data, as legendas, os comentários e o vídeo. Se você tiver o arquivo de um vídeo, a sua IA pode passá-lo à Análise de vídeo do mesmo jeito.

## Com a chave do Apify

A coleta fica automática e mais completa: plays, curtidas, comentários, duração, data, a legenda inteira e parceria paga de cada post, o link do vídeo de cada Reels e os comentários de um post. A chave nunca passa pelo chat: a sua IA abre uma página no seu navegador, você cola a chave lá uma vez e ela fica guardada só neste computador, fora dos seus projetos. Numa sessão do Claude Code na nuvem, onde essa página não abre, a chave fica como segredo de rede do ambiente da sessão: a sessão usa a chave sem vê-la, e a sua IA diz onde guardá-la.

O Apify cobra pelo que colhe, do crédito da sua conta lá. Pela tabela de outubro de 2026, cada perfil de 30 posts custa cerca de US$ 0,08 e cada 100 comentários, cerca de US$ 0,26. Antes de qualquer coleta acima de US$ 1, a sua IA diz o valor e espera o seu sim. Toda coleta tem um teto, e o app reaproveita o que colheu nas últimas 24 horas.

## O que ele grava

| Caminho | Conteúdo |
|---|---|
| `instagram-research/profiles/<perfil>/profile.md` | o normal do perfil e os posts contra esse normal |
| `instagram-research/profiles/<perfil>/profile.csv` | a planilha com todos os posts e métricas |
| `instagram-research/outliers/<pesquisa>/outliers.md` | o ranking de vários perfis, com as faixas e as ressalvas |
| `instagram-research/outliers/<pesquisa>/outliers.csv` | a planilha da pesquisa |
| `instagram-research/outliers/<pesquisa>/legendas.md` | os traços das legendas contra o multiplicador, com o tamanho de cada grupo |
| `instagram-research/posts/<post>/comments.md` | os comentários de um post, sem o nome de quem escreveu |
| `instagram-research/posts/<post>/video.mp4` | o vídeo de um Reels que você pediu para assistir, com a origem em `video.json` ao lado; fica fora do git |
| `instagram-research/leituras/` | as leituras das suas capturas de tela |

## Bom saber

- O app nunca usa a sua conta do Instagram e nunca pede a sua senha. A coleta automática roda no Apify, sem login seu.
- Colher dados do Instagram com ferramentas automáticas pode contrariar os termos de uso da Meta, mesmo quando os dados são públicos. Use a pesquisa para estudar o que funciona, nunca para copiar posts de outros perfis.
- Perfis privados ficam de fora.
- Os comentários vêm sem o nome de quem escreveu.
- O vídeo de um Reels vem dos servidores de mídia do Instagram, pelo link da coleta, sem a sua conta, só dos Reels que você escolher e com limite de tamanho.

## O que há de novo

- 1.1.0: a legenda de cada post chega inteira, com as quebras de linha, as hashtags e o pedido do fim. Você pode pedir o que as legendas dos posts que passaram do normal têm em comum, com a mediana e o tamanho de cada grupo. E, com a coleta automática, a sua IA baixa o vídeo dos Reels que você escolher para o app Análise de vídeo assistir.
- 1.0.2: numa sessão do Claude Code na nuvem, o app usa a chave do Apify guardada como segredo de rede do ambiente, que a sessão usa sem ver, e explica esse caminho quando a chave falta.
- 1.0.1: quando outro app precisa da Pesquisa no Instagram e ela ainda não está no projeto, a sua IA diz numa frase que vai instalá-la e instala na hora, sem pedir confirmação.
- 1.0.0: primeira versão. O normal de um perfil e os outliers de até 25 perfis, com Reels e posts estáticos medidos separados, faixas, avisos de isca de comentário e parceria paga, duração dos Reels, relatório e planilha. Também o modo manual por capturas de tela, os comentários de um post e uma interface para outros apps.
