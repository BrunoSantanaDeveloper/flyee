# Como usar

A Análise de vídeo assiste a um vídeo por você, com imagem e som, e entrega uma descrição com tempos: o que aparece na tela, o que é dito, os textos que surgem, os cortes e o estilo de edição. Ela serve para estudar um vídeo de referência, transformar uma aula em anotações ou saber o que um vídeo mostra sem assistir a ele inteiro. Funciona com vídeos do YouTube, de outros sites e com arquivos do seu computador.

A transcrição de um vídeo só traz a fala. Ficam de fora a demonstração na tela, o gráfico que ninguém leu em voz alta, o texto que aparece por dois segundos, a reação de quem está no vídeo. A descrição deste app tem uma seção só para isso, "Só na imagem", e cada ponto vem com o seu tempo.

Você pode usar o app direto, conversando com a sua IA. Outros apps do flyee.club também o usam: o Roteiro para YouTube, por exemplo, chama a Análise de vídeo para ler um vídeo sem legenda e para escrever a narração em cima da sua gravação de tela.

## Peça assim

Cole o link ou diga o nome do arquivo junto com o pedido:

- "Analise este vídeo e me diga o que aparece na tela além do que é falado", com o link do YouTube.
- "Estude a edição deste vídeo de referência: ritmo de cortes, legendas, transições e música."
- "Extraia os slides e o código mostrados nesta aula: aulas/modulo-3.mp4"
- "Analise só o trecho de 10 a 15 minutos deste vídeo."
- "No vídeo que você analisou, o que estava escrito na tela por volta de 2 minutos?"

## O que acontece

1. **A IA confere o computador.** O app usa dois programas: o ffmpeg, que lê o vídeo, e o yt-dlp, que baixa vídeos da internet. Eles costumam ser instalados junto com o app, depois do seu sim. Se faltar algum, a IA avisa numa frase e instala sozinha, o que pode levar alguns minutos. Em casos raros o sistema pede algo que só você pode fazer, como a senha de administrador no Linux; a IA mostra esse único passo.
2. **O vídeo é assistido.** No modo local, o app baixa o vídeo, mede cortes e silêncios e monta grades de imagens; a sua IA olha todas as grades, na ordem, lê a fala e escreve a descrição. No modo Gemini, o Gemini assiste ao vídeo e o app grava a descrição. Se o vídeo é um arquivo do seu computador, a IA pergunta antes se pode enviá-lo ao Google.
3. **Você recebe o resumo.** A IA mostra o resumo, os destaques do que só a imagem mostra e onde a descrição ficou. A partir daí, pergunte o que quiser sobre o vídeo: ela responde citando os tempos e, se precisar, olha a imagem exata daquele instante.

O tempo depende da duração do vídeo e da sua internet. Baixar e medir um vídeo curto é rápido; depois a IA leva mais um pouco para olhar as imagens e escrever. Num vídeo longo, ela pode sugerir a análise por partes.

## O que você recebe

Tudo fica no seu projeto, na pasta `video-analyses/`, com uma subpasta por vídeo:

| Arquivo | O que tem |
|---|---|
| `descriptions/` | as descrições, uma por foco ou pergunta |
| `transcript.md` | a fala com tempos, quando o vídeo tem legenda |
| `index.md` | o roteiro que a IA segue no modo local |
| `analysis.json` | os dados medidos: cortes, planos, silêncios e frames |
| `media/` | os frames e as grades de imagens |

O vídeo baixado é apagado no fim, a não ser que você peça para manter. Um vídeo já analisado não é analisado de novo: o mesmo pedido, seu ou de outro app, recebe na hora a descrição guardada.

## Os dois modos

**Modo local, sem chave.** O app baixa o vídeo, tira frames a cada mudança de cena, mede os cortes e os silêncios e monta grades de imagens com o tempo de cada frame. A sua IA olha as grades, lê a fala e escreve a descrição. Isso gasta um pouco do seu plano de IA: algumas imagens por vídeo.

**Modo Gemini, com a sua chave do Google.** O Gemini assiste ao vídeo inteiro, com som, e o app escreve a descrição no mesmo formato. Vídeos públicos do YouTube são lidos direto do YouTube, sem baixar nada. Com a chave salva, o app escolhe sozinho: Gemini para o YouTube, modo local para o resto. Se o Gemini falhar, ele segue no modo local e avisa.

Sem a chave, tudo funciona no modo local: a descrição, os três focos, as perguntas, os frames extras e as medições de cortes e silêncios. A chave acrescenta o vídeo inteiro com som (música e efeitos, além da fala) e a leitura de vídeos públicos do YouTube sem baixar. Ela também poupa o seu plano de IA e serve de saída quando o YouTube recusa o download.

### Para ligar o modo Gemini

Peça à IA: "ligue o modo Gemini da análise de vídeo". Ela mostra o endereço do Google AI Studio, https://aistudio.google.com/apikey, onde você cria a chave com a sua conta Google. O Google não cobra por ela no uso comum. Depois a IA abre uma página no seu navegador: cole a chave lá e clique em Salvar. A chave fica guardada só neste computador, fora dos seus projetos, e serve a todos os apps do flyee.club que usam a mesma chave. Ela nunca passa pela conversa. Se você colar a chave no chat por engano, apague-a no Google AI Studio e crie outra.

## Dicas

- **Diga o que observar.** "Estude a edição" traz gancho, ritmo de cortes, enquadramentos, legendas, transições, música e uma lista do que reproduzir. "Extraia os slides" ou "o passo a passo desta aula" traz slides, código, diagramas e cada passo mostrado na tela. Sem isso, a descrição é geral: o que o vídeo mostra e diz, momento a momento.
- **Pergunte sobre um momento.** Cite o tempo aproximado. A IA responde a partir da descrição e, se faltar detalhe, olha a imagem daquele instante.
- **Peça um trecho em vídeos longos.** "Só de 10 a 15 minutos" deixa a análise mais detalhada, porque os frames se concentram no trecho.
- **Tem a legenda em arquivo?** Deixe o arquivo .srt ou .vtt na mesma pasta do vídeo, com o mesmo nome. A fala entra na descrição com os tempos.
- **Para refazer do zero**, peça "refaça a análise". Para guardar o vídeo baixado, peça "mantenha o vídeo".

## Limites

- No modo local, a IA vê frames, não o movimento entre eles. O que ela deduz desse intervalo vem marcado "(provável)".
- No modo local, a fala vem da legenda do vídeo ou de um arquivo de legenda ao lado dele. Sem legenda, a descrição avisa que o áudio não foi transcrito. O modo Gemini ouve o som.
- O app não identifica pessoas pelo rosto. Um nome só aparece quando é dito, está escrito no vídeo ou vem do título e do canal.
- Vídeos privados, só para membros ou com restrição de idade pedem login. Nesses casos, passe o arquivo do vídeo.
- Transmissões ao vivo, só depois que terminam. Playlists, um vídeo por vez.
- Pelo endereço, o Gemini só lê vídeos públicos do YouTube. Vídeos não listados são baixados e enviados.
- O Google limita o uso de cada chave: os pedidos por minuto e, no uso comum, as horas de vídeo do YouTube por dia. Quando o limite acaba, o app avisa e segue no modo local.
- Às vezes o YouTube recusa downloads automáticos. A IA atualiza o yt-dlp, o que costuma resolver; senão, use o modo Gemini ou o arquivo do vídeo.
- Baixar vídeos do YouTube pode contrariar os Termos de Serviço do YouTube. Prefira vídeos que você tem direito de usar, ou o modo Gemini. Use as análises para estudar e se inspirar, sem republicar o conteúdo de outras pessoas.
