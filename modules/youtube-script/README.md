# Roteiro para YouTube

Escreve com você roteiros que prendem do primeiro segundo ao fim, a partir do que já funciona no seu tema: título e thumbnail medidos, o fluxo de um vídeo de referência, gancho forte, o texto na sua voz e revisão antes de gravar.

## O que ele faz

Pedir um roteiro inteiro para uma IA costuma dar um texto genérico, que soa como robô, presume coisas que não aconteceram e vira propaganda quando o vídeo mostra algo seu. Este app faz diferente: a sua IA escreve **com** você, nas etapas em que os bons roteiristas trabalham, e você decide nos pontos que importam.

1. **O perfil do seu canal**, uma vez só: para quem você fala, o que promete e como você fala. A voz sai dos seus textos, dos seus vídeos ou, num canal novo, do jeito de falar de criadores que você indicar, sempre com a pergunta "você fala assim?". As suas regras ("nunca diga isso", "nunca faça aquilo") valem para todo vídeo, e as suas histórias e opiniões (como você começou, o que você defende, o que te incomoda no jeito comum) entram nos roteiros no lugar de qualquer coisa inventada.
2. **A ficha de verdade** de tudo que aparece no vídeo: o que a ferramenta ou o produto faz de verdade, os limites, o que custa e o que fica fora da fala. Nenhuma frase passa disso.
3. **O que já funciona no tema, com dados**: os vídeos que fizeram muito mais do que o normal do próprio canal, os títulos de alta performance (os que mais subiram, com o gatilho, a forma e as palavras de cada um, no tema e no seu canal), como os melhores abrem e o que o público pergunta.
4. **Um vídeo de referência**, até de outro país: o mapa batida a batida do que ele faz, trazido para o seu público (a moeda, os programas, as buscas) e sem o que não vale aqui.
5. **Título e thumbnail primeiro, para vender e não só descrever**: cinco títulos de gatilhos diferentes (o resultado, a lacuna, o erro, o que está em jogo, o contraste, o bastidor, o chamado direto, a transformação e outros), cada um dizendo de que dado veio, com a regra de exagerar no interesse e nunca no fato. As thumbnails fazem uma pergunta que só o vídeo responde, seguem o padrão visual do seu canal, lido das suas thumbnails, e saem com as variantes de título e thumbnail prontas para o teste A/B do YouTube.
6. **Gancho e estrutura**: o seu texto como gancho quando você escreve um, blocos com nome de resultado, a melhor parte guardada para o fim e um esqueleto para vídeos de "como eu uso X para Y".
7. **Primeiro acontece, depois se escreve**: num vídeo que mostra fazer ou testar algo, você recebe antes o roteiro de gravação, e a fala vem em cima do que aconteceu. O que só o resultado responde fica marcado para preencher.
8. **Conferência e crítica**: um verificador acha aberturas que espantam o público, frases longas demais, cara de texto de IA, números sem fonte, "ninguém faz isso" sem a busca, frase de anúncio, as palavras que você nunca diz, um título que só descreve o vídeo, um título cuja promessa a fala não paga e uma descrição que o YouTube recusaria. Depois, uma crítica com olhos novos dá notas, inclusive para a força do título e da thumbnail, e aponta o que é obrigatório mudar.
9. **Pronto para gravar**: o checklist do que fazer, preencher, conferir e responder ao publicar, o documento completo para ler e compartilhar, o teleprompter, o roteiro em Word e a descrição com "tudo que eu usei" e os capítulos.

Se algo que aparece no vídeo é seu, o roteiro fica sem cara de anúncio: uma frase de transparência, nada de plano ou preço na fala, e o link na descrição.

## O que você precisa

- Uma das IAs em que o app foi testado.
- Para os dados, os títulos medidos, a referência e a voz tirada de vídeos: o app **Pesquisa no YouTube**, que não usa chave nem conta paga. A sua IA o instala com o seu sim.
- Para ler um vídeo sem legenda ou escrever a narração em cima de uma gravação de tela: o app **Análise de vídeo**. A sua IA o instala com o seu sim.
- Sem esses dois, o app funciona do mesmo jeito, só sem os dados e sem a leitura dos vídeos.

## Peça assim

> "Quero gravar um vídeo de uns 10 minutos sobre como fazer o primeiro orçamento como freelancer. Me ajuda com o roteiro?"

Outros pedidos:

- "Quero um vídeo mostrando a planilha de orçamento que eu criei, no estilo deste vídeo em inglês: <endereço>"
- "O que eu gravo esta semana no meu canal?"
- "Melhora este roteiro: <cole o texto ou indique o arquivo>"
- "Vou testar dormir 8 horas por 7 dias. Me dá o roteiro."
- "Me dá títulos e ideias de thumbnail para um vídeo sobre airfryer."

## O que ele grava

| Caminho | Conteúdo |
|---|---|
| `roteiros/canal.md` | o perfil do canal, a sua voz, as suas histórias e opiniões e as suas regras, usados em todos os roteiros |
| `roteiros/pautas-<data>.md` | as pautas, quando você pergunta o que gravar |
| `roteiros/<vídeo>/briefing.md` | o que o vídeo é, o que precisa provar e o que fica fora da fala |
| `roteiros/<vídeo>/verdade.md` | a ficha de verdade do que aparece no vídeo |
| `roteiros/<vídeo>/pesquisa.md` | os dados do tema, os títulos medidos, a lacuna e os fatos com fonte |
| `roteiros/<vídeo>/referencia.md` | o mapa do vídeo de referência, adaptado ao seu público |
| `roteiros/<vídeo>/embalagem.md` | os títulos, as thumbnails, as variantes do teste A/B e a promessa |
| `roteiros/<vídeo>/estrutura.md` | os ganchos, os blocos com tempo e os pontos de retenção |
| `roteiros/<vídeo>/gravacao.md` | num tutorial, o mapa da sua gravação de tela |
| `roteiros/<vídeo>/roteiro.md` e `roteiro.docx` | o roteiro |
| `roteiros/<vídeo>/revisao.md` | o que a revisão achou e o que mudou |
| `roteiros/<vídeo>/descricao.md` | a descrição com "tudo que eu usei" e os capítulos |
| `roteiros/<vídeo>/checklist.md` | o que fazer antes, o que preencher e o que conferir antes de publicar |
| `roteiros/<vídeo>/roteiro-completo.md` | tudo junto, para ler e compartilhar |
| `roteiros/<vídeo>/teleprompter.txt` | só a fala, para ler gravando |

A pesquisa e a leitura de vídeos ficam nas pastas dos apps parceiros (`youtube-research/` e `video-analyses/`).

## Bom saber

- A duração é estimada pelo seu ritmo de fala. Até o app conhecer o seu, ele usa 180 palavras por minuto, um ritmo comum de vídeo editado. Com os seus vídeos, ele mede o real.
- Os tempos dos capítulos são estimados. Confira no vídeo editado antes de publicar.
- Se o YouTube não entregar a fala de um vídeo, a sua IA avisa e pede que você cole o texto, ou usa a Análise de vídeo, ou segue sem ele. Ela não tenta outro caminho por conta própria.
- A sua gravação de tela só vai para o Google (para o Gemini assistir) se você disser que sim. Sem isso, ela é lida no seu computador.

## O que há de novo

- 1.3.0: o título e a thumbnail passam a vender, não só dizer do que o vídeo trata. Cinco gatilhos novos (o que está em jogo, extremo ou contraste, bastidor, chamado direto, transformação), a regra de exagerar no interesse e nunca no fato, e um teste do clique que reprova o par que só descreve. A thumbnail vira uma pergunta visual (emoção, contraste, mistério ou escala), pode juntar elementos do vídeo e segue o padrão visual do seu canal, lido das suas thumbnails e comparado com as dos vídeos que mais subiram no tema. A conferência avisa quando o título escolhido só descreve e quando os cinco títulos repetem o gatilho, e a crítica ganha uma nota para a força da embalagem.
- 1.2.0: os títulos partem dos de alta performance do tema e do seu canal, com o gatilho e as palavras medidos; o teste A/B do YouTube, que agora compara títulos também, ganha as variantes de título; as regras da thumbnail ganham o canto da duração, o tamanho e o arquivo certos; a conferência avisa quando a fala não paga um número ou um nome do título escolhido e quando o texto da thumbnail passa de quatro palavras ou repete o título, e bloqueia a descrição acima do limite do YouTube; o checklist lembra o que responder ao publicar (público, uso de IA, promoção paga, teste A/B).
- 1.1.1: quando a pesquisa ou a leitura de um vídeo precisa de outro app que ainda não está no projeto, a sua IA diz numa frase qual vai instalar e instala na hora, sem pedir confirmação.
- 1.1.0: pesquisa com dados antes do roteiro e títulos medidos contra o normal de cada canal; o mapa batida a batida de um vídeo de referência, até de outro país, adaptado ao seu público; a voz tirada dos seus vídeos ou de criadores que você indicar; pautas para "o que eu gravo?"; narração em cima da gravação de tela; o documento completo e o roteiro em Word.
- 1.0.0: primeira versão. Perfil do canal com a sua voz, as suas histórias e opiniões e as suas regras; ficha de verdade do que aparece no vídeo; vídeo do que é seu sem cara de anúncio; primeiro acontece, depois se escreve; título e thumbnail antes do roteiro, com variantes para o teste de miniaturas; ganchos de famílias diferentes, com o seu texto em primeiro lugar; esqueleto para "como eu uso X para Y"; escrita bloco a bloco; conferência automática e crítica com nota mínima; checklist, teleprompter e descrição com capítulos.
