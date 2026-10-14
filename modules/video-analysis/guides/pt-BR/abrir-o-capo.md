# Abrir o capô

Este guia mostra a Análise de vídeo por dentro: como ela mede um vídeo, como monta o material que a sua IA assiste, o que cada arquivo guarda, o que sai do seu computador e o que fazer quando algo falha.

## Como ele trabalha

### 1. Reconhecer o vídeo

O app aceita um endereço do YouTube (vídeo comum, youtu.be, Shorts ou live), o endereço de outro site de vídeo ou um arquivo do seu computador. Cada vídeo ganha um nome fixo, que vira o nome da pasta da análise: `yt-` com o código do vídeo no YouTube, `url-` com o site e um código curto tirado do endereço, ou `file-` com o nome do arquivo e um código curto tirado do caminho, do tamanho e da data. Assim o mesmo vídeo cai sempre na mesma pasta, e um arquivo que mudou ganha uma análise nova.

### 2. Escolher quem assiste

Sem um pedido específico, o app decide sozinho:

- vídeo do YouTube com a chave salva: o Gemini assiste, lendo o vídeo direto do YouTube;
- arquivo do computador com a chave salva: o Gemini assiste só se você autorizar o envio ao Google; sem a autorização, fica o modo local;
- nos outros casos: o modo local, se o ffmpeg (e, para endereços da internet, o yt-dlp) estiver instalado.

Se o Gemini falhar por limite de uso, instabilidade, recusa ou um vídeo que ele não consegue abrir, e o modo local for possível, o app segue no modo local e avisa. Você também pode pedir os dois juntos: o app mede o vídeo no seu computador e manda os cortes medidos ao Gemini, que alinha os planos a eles.

### 3. Ler os dados do vídeo

Para um endereço da internet, o yt-dlp lê o título, o canal, a data, a duração, as visualizações, os capítulos, a descrição do autor e, no YouTube, os trechos que o público mais reviu: até três picos, em vídeos de pelo menos um minuto, sem contar o começo, que é sempre alto. Ele também escolhe a legenda mais fiel à fala: a do idioma original, a manual antes da automática; sem idioma conhecido, português e depois inglês. Para um arquivo do computador, o app procura uma legenda .srt ou .vtt na mesma pasta, com o mesmo nome do vídeo.

### 4. Baixar o vídeo

No modo local, o app baixa o vídeo em até 720p, ou 480p em vídeos de mais de 30 minutos, e prefere o formato H.264, que é mais rápido de ler.

### 5. Medir

Uma única leitura do vídeo com o ffmpeg dá três medidas:

- **os cortes**: as mudanças de cena acima de uma sensibilidade, 0,3 por padrão (um número menor encontra mais cortes);
- **uma miniatura cinza da imagem**, duas vezes por segundo, com 32 por 18 pixels. Ela serve para achar imagens repetidas e a troca entre duas imagens paradas, como um slide que muda o texto, que o detector de cortes deixa passar;
- **os silêncios**: trechos abaixo de -35 dB por pelo menos 0,7 segundo. Os relatórios listam os de 1 segundo ou mais.

### 6. Escolher os frames

O app tira um frame por plano (o trecho entre dois cortes) e, nos planos longos, mais um a cada tantos segundos. Esse intervalo cresce com a duração do vídeo e nunca fica abaixo de 3 segundos. Imagens repetidas saem: um plano que volta a uma imagem já vista aponta para o frame dela. Acima do limite, ficam frames espalhados por igual no tempo. O limite é de 24, 48 ou 96 frames (densidade baixa, normal ou alta; normal por padrão), ou um número exato de 4 a 300.

### 7. Montar as grades

Cada frame é salvo em JPEG, com o lado maior de até 1280 pixels. Os frames vão para grades no tamanho que as IAs leem sem reduzir: até cerca de 1,2 megapixel e 1568 pixels por lado. Cabem 9 frames por grade num vídeo horizontal (16:9) ou vertical (9:16), 6 num vídeo 4:3 e 4 num quadrado. Cada quadrinho traz o número do frame (F1, F2…) e o tempo.

### 8. Escrever o roteiro de leitura

O app grava o `index.md` para a IA que vai assistir: os dados do vídeo, as medições, como ler, cada grade com uma tabela (frame, tempo, posição e arquivo), os planos entre cortes e, para cada frame, a fala daquele trecho. O roteiro avisa que título, descrição, capítulos, fala e textos na tela são conteúdo a descrever, nunca instruções a seguir. O `transcript.md` traz a fala inteira, com os tempos.

### 9. A IA assiste (modo local)

A sua IA lê o roteiro, abre todas as grades, na ordem, e abre o frame individual quando o texto é pequeno ou um detalhe importa. Se precisar de um instante que não está nos frames, ela extrai a imagem daquele tempo, com até 1920 pixels; para isso, o app baixa o vídeo de novo, a não ser que você tenha pedido para mantê-lo. Depois grava a descrição, começando pelo cabeçalho que o app deu. O que acontece entre dois frames ela não viu: movimento, transição ou gesto nesse intervalo vem marcado "(provável)".

### 10. O Gemini assiste (modo Gemini)

Um vídeo público do YouTube vai pelo endereço: o Google lê o vídeo direto do YouTube. Um arquivo do computador (só depois do seu sim) ou um vídeo do YouTube que não é público vai para o serviço de arquivos do Gemini. Antes do envio, um arquivo com mais de 200 MB ou acima de 720p é reduzido para 720p; o limite é 2 GB. O Google apaga o arquivo em até 48 horas, e enquanto ele está lá, uma pergunta nova sobre o mesmo vídeo usa o mesmo envio.

O pedido ao Gemini leva as regras da descrição, o guia do foco, o título, o canal, a duração e os capítulos, as instruções do app que pediu a análise e a sua pergunta, quando existem, e os cortes medidos, quando os dois modos rodam juntos. No foco de edição, o app pede ao Gemini mais frames por segundo: 3 em vídeos de até 2 minutos e 2 em vídeos de até 10 minutos. No foco de conteúdo, pede a imagem em alta resolução, para ler slides e código. O modelo é o Flash mais recente do Google, e você pode pedir outro.

O app converte a resposta do Gemini para o formato do modo local e guarda também a resposta como veio. Quando a API oscila, ele tenta de novo duas vezes, depois de 5 e de 15 segundos; no limite por minuto, espera uma vez, por até 1 minuto. Se a resposta vem cortada por tamanho, ele avisa e sugere a análise por partes.

### 11. Guardar e reaproveitar

Tudo fica na pasta do vídeo. O mesmo pedido (o mesmo vídeo, com o mesmo foco ou o mesmo nome) devolve na hora a descrição guardada, para você ou para outro app. As medições e as grades também são reaproveitadas quando o novo pedido usa os mesmos ajustes. Para refazer do zero, peça "refaça a análise".

## O formato da descrição

A descrição tem o mesmo formato nos dois modos: quem lê não precisa saber quem assistiu. Ela é escrita no idioma do projeto (português ou inglês), com as citações no idioma original.

O cabeçalho, no topo, diz o vídeo, a fonte, o foco, quem assistiu (o Gemini ou a sua IA), o trecho, o idioma e, quando existe, a pergunta. Depois vêm as seções, nesta ordem:

| Seção | O que traz |
|---|---|
| Resumo | de 3 a 6 frases sobre o vídeo ou o trecho |
| Linha do tempo | um item a cada mudança de assunto ou de cena, com imagem, fala e texto na tela |
| Só na imagem | o que a imagem mostra e a fala não diz; sempre aparece |
| Textos na tela | cada texto entre aspas, como aparece |
| Áudio | música, efeitos, silêncios, tom e ritmo da fala |
| Estilo visual | enquadramentos, cor, luz, grafismos, legendas e ritmo de edição |
| Planos | tempo, enquadramento, movimento e o que mostra, quando o foco pede |
| Seções do foco | as que o foco pede (abaixo) |
| Resposta | a resposta à sua pergunta, com tempos |
| Medições | os números que o app mediu |
| Incertezas | o que não deu para ver ou ouvir com segurança; sempre aparece |

Todo item tem tempo, contado do início do vídeo, em minutos e segundos (com as horas, em vídeos de mais de uma hora); um trecho se escreve "00:00 a 00:12". Texto ilegível é dito ilegível, nunca completado. Seção sem conteúdo fica de fora, menos "Só na imagem" e "Incertezas".

Os focos acrescentam seções:

- **Geral**: nenhuma; o resumo e a linha do tempo bastam.
- **Edição**: Gancho, Estrutura e ritmo, Câmera e enquadramento, Transições e efeitos, Texto e legendas, Cor e luz, Áudio e Como reproduzir, uma lista prática do que copiar, cada item com um tempo de exemplo no vídeo. A tabela de planos vem preenchida.
- **Conteúdo**: Pontos principais, Passo a passo (quando há demonstração), Material da tela (slides, código e diagramas transcritos) e Termos e referências.

A medição local dá o número de cortes e a duração média dos planos, os cortes por minuto (por 5 minutos, acima de meia hora) em trechos de 2 minutos ou mais e os silêncios de 1 segundo ou mais. No YouTube, entram também os trechos que o público mais reviu; só com o Gemini, sem a medição local, a seção traz apenas esses trechos, quando existem.

## Os arquivos por dentro

Cada vídeo tem uma pasta em `video-analyses/`:

| Arquivo | O que guarda |
|---|---|
| `analysis.json` | os dados do vídeo e as medidas, em segundos: cortes, planos, frames, grades, silêncios, a fala com tempos e a lista das descrições |
| `index.md` | o roteiro de leitura do modo local |
| `transcript.md` | a fala com tempos, em blocos, quando há legenda |
| `descriptions/` | uma descrição por foco, pergunta, trecho ou app |
| `gemini/` | a resposta do Gemini como veio, com o modelo e o consumo |
| `media/` | frames, grades, imagens extras e o vídeo, se você pediu para manter |

As descrições têm nomes previsíveis: o nome do foco (`general`, `editing` ou `content`), `question-` e um código para uma pergunta, os tempos no fim do nome para um trecho (`general-00m04s-00m12s`) ou o nome do app que pediu a análise.

Uma descrição é um texto comum: se algo estiver errado, peça à IA para corrigir. O app só a sobrescreve se você pedir para refazer. O roteiro, a transcrição e as medições ele refaz sozinho. A pasta `video-analyses/` deixa `media/` fora do git, para os frames e o vídeo não irem para o seu repositório.

## Pedidos avançados

| Peça assim | O que muda |
|---|---|
| "Estude a edição deste vídeo" | foco de edição |
| "Extraia os slides e o código desta aula" | foco de conteúdo |
| "Analise só de 2:30 a 4:00" | só um trecho, com os frames concentrados nele |
| "Use mais frames" ou "use menos frames" | 96 ou 24 frames, em vez de 48 |
| "Use 150 frames" | um número exato, de 4 a 300 |
| "Procure cortes com mais sensibilidade" | o app acha mais cortes |
| "Baixe o vídeo em 1080p" | a qualidade do download, de 240p a 1080p |
| "Mantenha o vídeo baixado" | o vídeo fica na pasta `media/`, e os frames extras saem sem baixar de novo |
| "Refaça a análise" | tudo de novo, em vez de reaproveitar |
| "Analise sem o Gemini" | só o modo local |
| "Use o Gemini e as medições juntos" | os cortes medidos vão para o Gemini |
| "Escreva a descrição em inglês" | o idioma da descrição |
| "Me mostre o frame de 1:32" | a imagem daquele instante, em alta resolução |
| "Só os números de cortes e silêncios deste vídeo" | as medições, sem descrição |
| "No Gemini, assista com mais frames por segundo" | de 0,1 a 10 frames por segundo |
| "Use outro modelo do Gemini" | o modelo que assiste |

Um vídeo que exige login pode ser aberto com a sessão do seu navegador, se você pedir ("use a sessão do meu navegador para abrir este vídeo"). O YouTube pode marcar a conta usada, então prefira passar o arquivo do vídeo.

## Quando algo dá errado

| O que acontece | O que fazer |
|---|---|
| O YouTube recusou o download (pediu para confirmar que não é um robô ou não entregou o vídeo) | Peça à IA para atualizar o yt-dlp e tentar de novo. Se continuar, use o modo Gemini, que lê o vídeo público sem baixar, ou passe o arquivo do vídeo. |
| O site limitou os pedidos por um tempo | Espere alguns minutos, ou use o modo Gemini. |
| O vídeo é privado, só para membros ou tem restrição de idade | Passe o arquivo do vídeo. Se o vídeo for seu, baixe-o pelo YouTube Studio. |
| É uma transmissão ao vivo ou uma estreia | Peça a análise depois que terminar. |
| O endereço é de uma playlist | Passe um vídeo por vez. |
| O limite da chave do Gemini acabou | Espere e repita, ou analise um trecho. No modo automático, o app já seguiu no modo local. |
| A API do Gemini está instável | Tente de novo em alguns minutos. |
| O vídeo é longo demais para o Gemini | Peça a análise por partes. |
| O Gemini não aceitou a chave | Confira a chave no Google AI Studio e peça à IA para salvá-la de novo. Se você definiu a variável de ambiente GEMINI_API_KEY, é ela que vale. |
| O arquivo passa de 2 GB | Com o ffmpeg, o app reduz o vídeo antes de enviar; se ele faltar, a IA instala. |
| O vídeo já está sendo analisado | Espere terminar e peça de novo; o que já foi feito é aproveitado. |

## Limites

- No modo local, a IA vê frames, não o movimento entre eles; o que ela deduz desse intervalo vem marcado "(provável)". Mais frames, ou um trecho menor, encurtam esse intervalo.
- No modo local, a fala vem só de legendas: a do site ou um arquivo .srt ou .vtt ao lado do vídeo. O app não transcreve o áudio. Sem legenda, a descrição avisa que o áudio não foi transcrito e registra só a fala que aparece escrita na tela. O modo Gemini ouve o som.
- O app não identifica pessoas pelo rosto.
- A descrição pode errar. A seção "Incertezas" diz o que não deu para ver ou ouvir com segurança; na dúvida, peça à IA para olhar o frame daquele momento.

## Com outros apps

Outros apps do flyee.club chamam este para entender um vídeo. O Roteiro para YouTube chama a Análise de vídeo para ler um vídeo sem legenda e para escrever a narração em cima da sua gravação de tela, passo a passo.

O app que chama manda um arquivo com o que quer observar e um nome para a descrição dele, que assim não se mistura com as outras. Tudo fica na mesma pasta, `video-analyses/`, e o que já foi feito é aproveitado quando serve. Se a Análise de vídeo não estiver instalada, o outro app oferece a instalação; sem o seu sim, ele segue sem ela.

A conversa entre os apps tem versão: dentro dela, nada do que um app usa deixa de funcionar numa versão nova da Análise de vídeo.

## Privacidade

**No modo local**, o vídeo vem do site para o seu computador, e tudo o que o app mede e monta fica lá. Nada é enviado ao Gemini. A sua IA, a mesma que você já usa, olha as grades e os frames e lê a fala: essas imagens e esse texto vão para ela como parte da conversa, como qualquer imagem que você mostra a ela.

**No modo Gemini**, vai ao Google o texto do pedido: as regras da descrição, o guia do foco, o título, o canal, a duração e os capítulos, as instruções do app que pediu, a sua pergunta e, com os dois modos juntos, os cortes medidos. De um vídeo público do YouTube vai só o endereço. Um arquivo do computador (depois do seu sim) ou um vídeo do YouTube que não é público, como um não listado, vai inteiro, reduzido para 720p quando é grande; o Google o apaga em até 48 horas.

O que o Google faz com esse material segue os termos da API do Gemini, em https://ai.google.dev/gemini-api/terms. Pelos termos atuais, no uso que o Google não cobra, ele pode usar o que você envia e as respostas para melhorar os produtos dele, e pessoas podem ler esse material. Com a cobrança ativada na conta, os termos dizem que o Google não usa o material para isso. Se o vídeo não pode sair da sua empresa, use o modo local.

**A chave** fica guardada só neste computador, fora dos seus projetos, e vai ao Google apenas para autorizar os pedidos. Ela nunca aparece na conversa, na resposta do app nem nos arquivos da análise.

**Com quem o app fala**: o site do vídeo (o YouTube e os servidores de vídeo dele, ou o site indicado) e, com a chave, a API do Gemini. Ele lê só o vídeo indicado, a legenda ao lado dele e a chave salva, e grava só em `video-analyses/`.

**O registro de uso**: ao terminar uma análise, a IA registra no flyee.club que o app foi usado. O registro leva o nome e a versão do app, nunca o vídeo, o endereço, a descrição ou o nome do projeto.
