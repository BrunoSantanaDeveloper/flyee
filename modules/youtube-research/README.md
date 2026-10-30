# Pesquisa no YouTube

Mostra, com números de verdade, quais vídeos de um tema fizeram muito mais do que o normal do próprio canal, e por quê. Assim você decide o que gravar pela demanda real, não pelo achismo.

## O que ele faz

Um vídeo com 1 milhão de views num canal que sempre faz 1 milhão não ensina nada. Um vídeo com 80 mil num canal que costuma fazer 8 mil mostra que o tema, o ângulo ou o título puxaram um público que não viria sozinho. Este app encontra esses vídeos: busca o seu tema no YouTube com várias palavras, mede o normal de cada canal pelos últimos envios dele e calcula quantas vezes cada vídeo passou desse normal.

A sua IA lê o resultado e entrega a leitura: os vídeos que importam e por que subiram, os padrões que se repetem, o que está saturado e as lacunas que ninguém cobriu. Você também pode pedir a fala de um vídeo (pela legenda, sem baixar nada), os comentários mais relevantes, com as dúvidas e objeções do público, e o normal de qualquer canal, inclusive o seu.

Para títulos, o app analisa os de alta performance: lista os que mais passaram do normal e os que ficaram abaixo, cada um com o que tem (o gatilho, a forma, as palavras), e mede cada traço e cada palavra que se repete contra o normal de cada canal. Pode fazer o mesmo só com os vídeos do seu canal, para ver o que o seu público já respondeu.

Para thumbnails, o app baixa as imagens dos vídeos que você indicar ou dos envios mais recentes de um canal, com o quanto cada vídeo passou do normal, e monta uma página com todas lado a lado. A sua IA olha as imagens e diz o padrão visual do seu canal e o que se repete nas que foram bem.

Tudo é público e lido sem chave e sem login. O relatório fica numa pasta do seu projeto, com uma planilha que abre no Excel e no Google Planilhas.

## O que você precisa

- Uma das IAs em que o app foi testado.
- O yt-dlp, um programa de código aberto que lê o YouTube. A sua IA o instala na primeira vez, sem você digitar nada.
- Nenhuma chave e nenhuma conta no YouTube.

## Peça assim

> "Pesquise o que está funcionando no YouTube sobre finanças para autônomos e me diga que vídeo eu deveria gravar."

Outros pedidos:

- "Quais vídeos sobre airfryer bombaram no último mês?"
- "Analise o meu canal @meucanal: qual é o meu normal e quais vídeos passaram dele?"
- "Pegue a transcrição deste vídeo e me mostre como ele abre: <endereço>"
- "O que o público pergunta nos comentários destes vídeos?"
- "Que tipo de título funciona nesse tema? Me mostre com números."
- "Quais títulos do meu canal foram melhor que o meu normal, e o que eles têm em comum?"
- "Olhe as thumbnails do meu canal: qual é o meu padrão e o que as que foram bem têm em comum?"

## O que ele grava

| Caminho | Conteúdo |
|---|---|
| `youtube-research/outliers/<pesquisa>/outliers.md` | o relatório: o ranking, as faixas e as ressalvas |
| `youtube-research/outliers/<pesquisa>/outliers.csv` | a planilha com todos os vídeos e métricas |
| `youtube-research/outliers/<pesquisa>/outliers.json` e `raw.json` | os dados completos e a coleta bruta |
| `youtube-research/outliers/<pesquisa>/titulos.md` | os títulos de alta performance do tema: a lista, os gatilhos, a forma e as palavras, medidos contra o normal de cada canal |
| `youtube-research/channels/<canal>/` | os últimos envios de um canal, com o normal dele, e, quando você pede, a análise dos títulos e a página das thumbnails (`thumbnails.md`) |
| `youtube-research/videos/<id>/` | os dados, a transcrição, os comentários e a thumbnail de cada vídeo |

O que já foi lido é reaproveitado: os canais e as thumbnails por uma semana, os dados de vídeo por um dia e as transcrições para sempre. Assim, uma nova pesquisa no mesmo tema sai bem mais rápido.

## Bom saber

- Os comentários vêm sem o nome de quem escreveu.
- Uma pesquisa leva de um a dez minutos, conforme o número de buscas e de canais a medir. A sua IA avisa antes de começar.
- Se o YouTube recusar por um tempo, a sua IA atualiza o yt-dlp e tenta de novo com menos buscas.

## O que há de novo

- 1.2.0: a análise de títulos mede cinco gatilhos novos, os que dão um motivo para clicar além de dizer do que o vídeo trata: o que está em jogo, extremo ou contraste, bastidor, chamado direto e transformação. E o app baixa as thumbnails de vídeos ou dos envios recentes de um canal, com o quanto cada vídeo passou do normal, numa página que mostra todas lado a lado.
- 1.1.0: a análise dos títulos de alta performance. Além dos traços, lista os títulos que mais passaram do normal e os que ficaram abaixo, cada um com os traços que tem; mede os gatilhos de título (resultado, curiosidade, busca direta, contrário, erro, experimento, lista, comparação), a forma ("você", ano, superlativo, duas partes, emoji) e as palavras que se repetem; e faz a mesma análise nos vídeos de um canal, contra o normal dele. Uma leitura do YouTube que trava passa a ser interrompida em 10 minutos, com um aviso, em vez de deixar a sua IA esperando.
- 1.0.2: quando outro app precisa da Pesquisa no YouTube e ela ainda não está no projeto, a sua IA diz numa frase que vai instalá-la e instala na hora, sem pedir confirmação.
- 1.0.1: quando o YouTube recusa ou limita a entrega da legenda, a sua IA fica sabendo e tenta de novo depois, em vez de concluir que o vídeo não tem legenda.
- 1.0.0: primeira versão. Outliers de um tema medidos contra o normal de cada canal, com faixas, avisos, relatório e planilha. Também os traços de título que andam junto com os vídeos que foram bem, o normal de um canal, a fala de vídeos com o ritmo em palavras por minuto, os comentários mais relevantes e uma interface para outros apps.
