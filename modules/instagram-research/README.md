# Pesquisa no Instagram

Mostra, com números de verdade, quais Reels e posts fizeram muito mais do que o normal do próprio perfil, no seu perfil e nos perfis do seu nicho. Assim você decide o que publicar ou anunciar pelo que já funcionou com o público.

## O que ele faz

Um Reels com 500 mil plays num perfil que sempre faz 500 mil não ensina nada. Um Reels com 40 mil num perfil que costuma fazer 4 mil mostra que o tema ou o gancho levaram o post para além do público de sempre. Este app encontra esses posts: mede o normal de cada perfil pelos últimos posts dele e calcula quantas vezes cada post passou desse normal. Reels e posts estáticos são medidos separados, porque um tem plays e o outro não.

A sua IA lê o resultado e entrega a leitura: os posts que importam e o motivo provável de cada um ter subido, os padrões que se repetem entre perfis, a duração que funciona no nicho e as ressalvas. Você também pode pedir os comentários de um post, com as dúvidas e objeções do público.

O relatório fica numa pasta do seu projeto, com uma planilha que abre no Excel e no Google Planilhas.

## O que você precisa

- Uma das IAs em que o app foi testado.
- Para a coleta automática, opcional: uma conta no Apify, um serviço que colhe dados públicos do Instagram e cobra pelo uso.

## Peça assim

> "Analise o meu perfil @meuperfil no Instagram: qual é o meu normal e quais Reels passaram dele?"

Outros pedidos:

- "Compare estes perfis e me mostre os Reels que mais passaram do normal: @perfil1, @perfil2, @perfil3."
- "O que os meus concorrentes postam que dá mais resultado?"
- "Que duração de Reels funciona melhor nesse nicho?"
- "O que o público pergunta nos comentários deste Reels?", com o endereço do post logo depois.

## Sem a chave

O app funciona sem chave nenhuma, pelo modo manual. Você tira duas ou três capturas de tela da aba de Reels de cada perfil, onde aparecem as visualizações de cada vídeo, e salva na pasta do projeto. A sua IA lê os números de cada miniatura como aparecem na tela, e o app faz a conta. Leva uns minutos por perfil.

A aba de Reels mostra só as visualizações. Por isso, sem a chave, ficam de fora a duração, as curtidas, a data e os comentários.

## Com a chave do Apify

A coleta fica automática e mais completa: plays, curtidas, comentários, duração, data, legenda e parceria paga de cada post, e os comentários de um post. A chave nunca passa pelo chat: a sua IA abre uma página no seu navegador, você cola a chave lá uma vez e ela fica guardada só neste computador, fora dos seus projetos.

O Apify cobra pelo que colhe, do crédito da sua conta lá. Pela tabela de outubro de 2026, cada perfil de 30 posts custa cerca de US$ 0,08 e cada 100 comentários, cerca de US$ 0,26. Antes de qualquer coleta acima de US$ 1, a sua IA diz o valor e espera o seu sim. Toda coleta tem um teto, e o app reaproveita o que colheu nas últimas 24 horas.

## O que ele grava

| Caminho | Conteúdo |
|---|---|
| `instagram-research/profiles/<perfil>/profile.md` | o normal do perfil e os posts contra esse normal |
| `instagram-research/profiles/<perfil>/profile.csv` | a planilha com todos os posts e métricas |
| `instagram-research/outliers/<pesquisa>/outliers.md` | o ranking de vários perfis, com as faixas e as ressalvas |
| `instagram-research/outliers/<pesquisa>/outliers.csv` | a planilha da pesquisa |
| `instagram-research/posts/<post>/comments.md` | os comentários de um post, sem o nome de quem escreveu |
| `instagram-research/leituras/` | as leituras das suas capturas de tela |

## Bom saber

- O app nunca usa a sua conta do Instagram e nunca pede a sua senha. A coleta automática roda no Apify, sem login seu.
- Colher dados do Instagram com ferramentas automáticas pode contrariar os termos de uso da Meta, mesmo quando os dados são públicos. Use a pesquisa para estudar o que funciona, nunca para copiar posts de outros perfis.
- Perfis privados ficam de fora.
- Os comentários vêm sem o nome de quem escreveu.

## O que há de novo

- 1.0.1: quando outro app precisa da Pesquisa no Instagram e ela ainda não está no projeto, a sua IA diz numa frase que vai instalá-la e instala na hora, sem pedir confirmação.
- 1.0.0: primeira versão. O normal de um perfil e os outliers de até 25 perfis, com Reels e posts estáticos medidos separados, faixas, avisos de isca de comentário e parceria paga, duração dos Reels, relatório e planilha. Também o modo manual por capturas de tela, os comentários de um post e uma interface para outros apps.
