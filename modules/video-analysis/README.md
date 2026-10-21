# Análise de vídeo

Assiste a vídeos por você, com imagem e som, e entrega uma descrição com tempos: o que aparece na tela, o que é dito, os textos, os cortes e o estilo. Funciona com vídeos do YouTube, de outros sites e com arquivos do seu computador.

## O que ele faz

A transcrição de um vídeo só traz o que é falado. Ficam de fora a demonstração na tela, o gráfico que ninguém leu em voz alta, o texto que aparece por dois segundos, a reação de quem está no vídeo, o jeito como foi editado. Este app olha a imagem e entrega uma descrição em que cada ponto tem o seu tempo, com uma seção só para o que a imagem mostra e a fala não diz.

O vídeo pode ser assistido de dois jeitos:

- **Modo local, sem chave.** O app baixa o vídeo, tira frames a cada mudança de cena, mede os cortes e os silêncios e monta grades de imagens com o tempo de cada frame. A sua IA olha as grades, lê a fala e escreve a descrição. Usa um pouco do seu plano de IA: algumas imagens por vídeo.
- **Modo Gemini, com uma chave do Google.** O Gemini assiste ao vídeo inteiro, com som, e o app escreve a descrição no mesmo formato. Vídeos públicos do YouTube são lidos direto do YouTube, sem baixar nada.

Com a chave configurada, o app usa o Gemini para o YouTube e o modo local para o resto, sozinho. Se o Gemini falhar, ele segue no modo local e avisa.

A descrição tem três focos: **geral** (o que o vídeo mostra e diz), **edição** (gancho, ritmo de cortes, enquadramentos, legendas, transições, música) e **conteúdo** (slides, código, diagramas e o passo a passo de aulas e tutoriais). Depois da descrição, pergunte o que quiser sobre o vídeo: a IA responde citando os tempos e, se precisar, puxa o frame exato.

Outros apps do flyee.club usam este para entender vídeos. O Roteiro para YouTube, por exemplo, usa para ler um vídeo sem legenda e para escrever a narração em cima da sua gravação de tela. Vídeo já analisado não é analisado de novo: a descrição fica guardada no projeto e serve para qualquer app.

## O que você precisa

- Uma IA que leia imagens, como o Claude Code.
- Para o modo local: o **ffmpeg** e, para endereços da internet, o **yt-dlp**. Você não instala nada: a sua IA instala os dois na primeira vez que o app precisar, depois de avisar.
- Para o modo Gemini (opcional): uma chave da API do Gemini, criada com a sua conta Google. O Google não cobra por ela no uso comum. O passo a passo está logo abaixo.

Na dúvida, peça à IA: "confira o que falta para a análise de vídeo". Ela verifica a máquina e resolve o que faltar.

## Como ligar o modo Gemini

A chave nunca passa pelo chat: nem a IA nem o app pedem que você a cole na conversa. Você a salva uma vez no seu computador, e todos os apps do flyee.club que usam a mesma chave a encontram.

1. Peça à IA: "ligue o modo Gemini da análise de vídeo". Ela mostra o endereço do Google AI Studio, onde você cria a chave com a sua conta Google.
2. A IA abre uma página no seu navegador. Cole a chave lá e clique em Salvar. Ela fica guardada só neste computador, fora dos seus projetos.
3. Pronto: o app enxerga a chave na hora, sem reabrir a IA, e a IA confirma que a chave foi encontrada, sem nunca mostrar o valor.

Para ver ou apagar as chaves salvas, peça à IA, por exemplo "quais chaves eu tenho salvas?". Quem prefere variável de ambiente pode definir `GEMINI_API_KEY`; ela tem prioridade sobre a chave salva.

Colou a chave no chat por engano? Ela ficou no histórico da conversa: apague-a no Google AI Studio e crie outra.

## Peça assim

> "Analise este vídeo e me diga o que aparece na tela além do que é falado: https://www.youtube.com/watch?v=…"

Outros pedidos:

> "Estude a edição deste vídeo de referência: ritmo de cortes, legendas, transições e música."

> "Extraia os slides e o código mostrados nesta aula: aulas/modulo-3.mp4"

> "No vídeo que você analisou, o que estava escrito na tela por volta de 2 minutos?"

## O que ele grava

Tudo fica numa pasta do seu projeto, uma subpasta por vídeo:

| Caminho | Conteúdo |
|---|---|
| `video-analyses/<vídeo>/descriptions/` | as descrições, uma por foco ou pergunta |
| `video-analyses/<vídeo>/transcript.md` | a fala com tempos, quando o vídeo tem legenda |
| `video-analyses/<vídeo>/index.md` | o roteiro que a IA segue no modo local |
| `video-analyses/<vídeo>/analysis.json` | os dados medidos: cortes, planos, silêncios, frames |
| `video-analyses/<vídeo>/media/` | frames e grades de imagens (fora do git) |

O vídeo baixado é apagado ao final; ele só fica se você pedir para manter.

## Sem a chave

Tudo funciona no modo local: descrição, os três focos, perguntas, frames extras e as medições de cortes e silêncios. A chave do Gemini acrescenta a análise do vídeo inteiro com som (música e efeitos, não só a fala), a leitura de vídeos públicos do YouTube sem baixar e economiza o seu plano de IA. Também serve de saída quando o YouTube recusa o download.

## Com a chave: limites e privacidade

- O Google limita o uso de cada chave: os pedidos por minuto e, no uso comum, as horas de vídeo do YouTube por dia. Quando o limite acaba, o app avisa e segue no modo local.
- Pelo endereço, o Gemini só lê vídeos **públicos** do YouTube. Vídeos não listados são baixados e enviados.
- Um arquivo do seu computador só vai para o Google com a sua autorização. A IA pergunta antes. O Google apaga o arquivo enviado em até 48 horas. Arquivos grandes são reduzidos para 720p antes do envio.
- A chave fica só no seu computador, salva pelo flyee fora dos projetos (ou na variável de ambiente, se você preferir); o app nunca a grava nem a mostra.

## Cuidados

- Use as análises para estudar e se inspirar; não republique o conteúdo de terceiros.
- Baixar vídeos do YouTube pode contrariar os Termos de Serviço do YouTube. Prefira analisar vídeos que você tem direito de usar, ou o modo Gemini, que lê o vídeo público direto do YouTube.
- Às vezes o YouTube recusa downloads automáticos. A sua IA atualiza o yt-dlp, o que costuma resolver; senão, use o modo Gemini ou o arquivo do vídeo.

## O que há de novo

- 1.0.1: quando outro app precisa da Análise de vídeo e ela ainda não está no projeto, a sua IA diz numa frase que vai instalá-la e instala na hora, sem pedir confirmação.
- 1.0.0: primeira versão. Modo local e modo Gemini, focos geral, edição e conteúdo, perguntas sobre o vídeo, frames extras sob demanda e uso por outros apps.
