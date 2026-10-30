# Como usar

A Pesquisa no YouTube mostra quais vídeos de um tema fizeram muito mais do que o normal do próprio canal, e quantas vezes mais. Serve para quem grava ou planeja vídeos para o YouTube e quer escolher o próximo tema pela demanda que já apareceu, com números, em vez de palpite.

Um vídeo com 1 milhão de views num canal que sempre faz 1 milhão diz pouco. Um vídeo com 80 mil views num canal que costuma fazer 8 mil diz bastante: o tema, o ângulo ou o título trouxeram um público que não viria sozinho. Esses são os outliers. O app os encontra, e a sua IA explica por que eles subiram, o que se repete entre eles, o que já está saturado e o que ninguém cobriu bem.

O app traz também a fala de um vídeo (pela legenda, sem baixar o vídeo), os comentários mais relevantes, o normal de qualquer canal, inclusive o seu, e a análise dos títulos de alta performance: os que mais passaram do normal, os gatilhos e as palavras que andam junto com os vídeos que foram bem, no tema ou só no seu canal. Traz ainda as thumbnails dos vídeos e do seu canal, lado a lado e com o quanto cada vídeo passou do normal, para a sua IA ver o seu padrão visual e o que se repete nas que foram bem. Tudo vem de páginas públicas do YouTube, sem chave e sem login.

Você pode pedir a pesquisa direto à sua IA. O app Roteiro para YouTube também usa este por baixo, para pesquisar o tema antes de propor uma pauta, medir títulos e ler a fala de vídeos de referência.

## Peça assim

- "Pesquise o que está funcionando no YouTube sobre finanças para autônomos e me diga que vídeo eu deveria gravar."
- "Quais vídeos sobre airfryer bombaram no último mês?"
- "Qual é o normal do meu canal @meucanal e quais vídeos passaram dele?"
- "Pegue a fala deste vídeo e me mostre como ele prende a atenção no começo", com o endereço do vídeo logo depois.
- "O que o público pergunta nos comentários dos maiores outliers dessa pesquisa?"
- "Que tipo de título funciona nesse tema? Me mostre com números."
- "Quais títulos do meu canal foram melhor que o meu normal, e o que eles têm em comum?"

Basta um tema, um canal ou o endereço de um vídeo. Se faltar alguma coisa, a IA pergunta.

## O que acontece

1. **O leitor do YouTube.** O app lê o YouTube pelo yt-dlp, um programa de código aberto que normalmente é instalado junto com o app. Se ele faltar, a sua IA avisa numa frase e instala depois do seu sim, sem você digitar nada. Se a instalação precisar de algo que só você pode fazer, como a senha de administrador, a IA mostra esse único passo.
2. **O pedido.** A IA confere o tema, o público, o formato (vídeo longo ou Shorts) e o período: o último mês para assunto do momento, o último ano (o padrão) para assunto que vale sempre. Se faltar algo, ela pergunta uma vez, tudo junto.
3. **A pesquisa.** A IA transforma o tema em 3 a 6 buscas (o termo técnico, o do dia a dia, a dor do público, a pergunta que ele digitaria), e o app mede o normal de cada canal encontrado. Leva de um a dez minutos, conforme as buscas e os canais, e a IA avisa antes.
4. **A leitura.** No chat vem a leitura, não a tabela: os 5 a 8 vídeos que mais importam, com views, multiplicador e o motivo provável da subida; os padrões que aparecem em dois ou mais outliers; o que está saturado; as lacunas; as ressalvas da amostra. Antes, a IA tira o que não é do tema e diz quantos vídeos tirou.
5. **Mais fundo, se você quiser.** A fala e os comentários dos maiores outliers, o normal de um canal, a análise dos títulos do tema e do seu canal.

Nenhuma chave, nenhuma conta no YouTube, nenhuma página para aprovar.

## O que você recebe

Tudo fica na pasta `youtube-research/` do seu projeto. Cada pesquisa ganha uma pasta com o nome da primeira busca e a data.

| Arquivo | O que tem |
|---|---|
| `outliers/<pesquisa>/outliers.md` | o relatório: ranking com faixa, multiplicador, views, views por dia, engajamento e avisos, mais as ressalvas |
| `outliers/<pesquisa>/outliers.csv` | a planilha com todos os vídeos, que abre no Excel e no Google Planilhas |
| `outliers/<pesquisa>/titulos.md` | os títulos de alta performance do tema, quando você pede |
| `channels/<canal>/channel.md` | o normal de um canal e os últimos envios |
| `channels/<canal>/titulos.md` | os títulos do canal que passaram do normal dele, quando você pede |
| `videos/<id do vídeo>/transcript.md` | a fala, com o tempo de cada trecho |
| `videos/<id do vídeo>/comments.md` | os comentários mais relevantes, sem o nome de quem escreveu |

## Como ler um outlier

O número que importa é o **multiplicador**: as views do vídeo divididas pelo normal do canal. O normal é a mediana das views dos últimos 30 envios do canal, só vídeos longos ou só Shorts, conforme o vídeo. Um vídeo de 80 mil views num canal de normal 8 mil tem multiplicador 10×.

| Multiplicador | Faixa | O que quer dizer |
|---|---|---|
| 10× ou mais | explosivo | demanda muito acima do canal; vale estudar a fundo |
| 3× ou mais | outlier | sinal forte, que dá para repetir |
| 1,5× ou mais | acima | funcionou, mas pode ter sido o título ou a thumbnail, e não o tema |
| 0,5× ou mais | normal | dentro do esperado; ensina pouco |
| abaixo de 0,5× | fraco | o tema não puxou aquele público, ou a execução falhou |

Olhe também a base. A melhor é o normal do próprio canal. Sem ele, o app compara com os outros vídeos do canal na mesma pesquisa e, em último caso, com os inscritos. Comparado com inscritos, o número vale como indício e vem com o aviso "sem a mediana do canal".

Outros avisos evitam conclusões erradas:

- **canal pequeno**: menos de 5 mil inscritos; o multiplicador sobe fácil, então olhe as views.
- **menos de 7 dias**: o número ainda vai mudar.
- **mais de 1 ano**: comparado com o normal de hoje do canal; olhe as views por dia.
- **Short**: até 3 minutos; não compare com vídeo longo.

A ordem do relatório segue um índice que pesa também o engajamento e a idade do vídeo. O índice só ordena: para explicar um vídeo, a IA cita views, multiplicador e base. E um padrão só conta quando aparece em dois ou mais outliers. Em um vídeo só, é aposta, e a IA diz isso.

## Dicas

- Diga o público e o formato no pedido: "para quem está começando", "só Shorts".
- Se o seu nicho também é forte em inglês, peça uma pesquisa separada em inglês.
- Leve o mecanismo, nunca o título. Copiar o título de um outlier é o erro mais comum; o que vale repetir é o ângulo, a promessa e o formato, do seu jeito.
- Meça o seu canal também. Saber o seu normal mostra o que é um bom resultado para você.
- Peça os comentários dos maiores outliers. Uma dúvida que se repete e ninguém respondeu é pauta.
- Pesquisar de novo no mesmo tema sai mais rápido: o normal de cada canal fica guardado por uma semana.

## Limites

- Só o que é público: vídeos privados, só para membros ou com restrição de idade ficam de fora, porque o app nunca entra numa conta.
- A amostra é o que a busca do YouTube mostra. Com menos de 60 vídeos, os padrões são indício, e o relatório avisa.
- Data, curtidas, comentários e inscritos são lidos só nos vídeos do topo, 15 por padrão.
- As views na página de um canal vêm arredondadas ("6,4 mil"). Para calcular o normal, isso basta.
- O filtro de idioma reconhece português, espanhol e inglês pelo título. Um vídeo em outro idioma ainda pode passar; peça para tirá-lo da leitura.
- A fala vem da legenda. Sem legenda, não há transcrição por aqui, e a IA oferece três caminhos: você colar a transcrição num arquivo, o app Análise de vídeo ouvir o áudio ou seguir sem aquele vídeo.
- A análise de títulos mostra o que anda junto com os títulos que foram bem nesta amostra, não a causa. Os títulos da lista mostram o mecanismo; copiar um deles é o erro mais comum.
- Às vezes o YouTube recusa consultas automáticas por um tempo. A IA atualiza o yt-dlp, espera alguns minutos e tenta de novo com menos buscas.
- O app não baixa vídeos e não publica nada.
