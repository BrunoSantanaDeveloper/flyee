# Abrir o capô

Este guia mostra o Carrossel animado por dentro: como um tema vira uma sequência de vídeos que se encaixam, por que cada regra existe e o que você pode pedir à sua IA além do pedido simples.

## Como ele trabalha

### 1. O briefing e o roteiro

Tudo começa num briefing curto, combinado na conversa e guardado em `brief.md`: tema, para quem, promessa, tom, estrutura dos slides e chamada final. Dele nasce o roteiro (`storyboard.json`), que descreve o carrossel inteiro: formato, andamento, trilha, ordem dos slides, compassos de cada um e efeitos sonoros.

O andamento padrão é de 120 batidas por minuto: a batida dura meio segundo, e o compasso de 4 tempos, 2 segundos. Um slide comum tem 3 compassos (6 s). A chamada final tem 4 (8 s), para dar tempo de ler e agir. A 30 quadros por segundo, cada batida cai em 15 quadros inteiros; com 100 e com 90 batidas por minuto a conta também fecha.

### 2. Por que compassos inteiros

A trilha é uma só para o carrossel todo, cortada nas cabeças de compasso: se cada slide tem 3 compassos, o slide 3 toca a trilha dos 12 aos 18 segundos. Cada fatia começa e termina num tempo forte, então o loop recomeça na batida e o slide seguinte continua a música de onde o anterior parou. Uma fatia de 6,3 s faria a música tropeçar a cada volta.

### 3. Os papéis dos slides

| Papel | Onde | O que tem |
|---|---|---|
| Gancho | o primeiro | a capa do carrossel: uma frase de 2 a 8 palavras, em até 3 linhas |
| Ponto | os do meio | uma ideia e um recurso que a prova: contador, gráfico de barras, cartões, frases que voltam uma por batida ou uma bola que quica |
| Foto | os do meio | uma ideia com foto: o fundo ocupa o quadro, um recorte vai por cima, o texto fica sobre um degradê |
| Chamada final | o último | o pedido, o que a pessoa ganha e um botão com a palavra a comentar |

O padrão são 5 slides: o gancho, três pontos e a chamada. O gancho e a chamada também podem levar foto. Cada papel tem um modelo de partida, e o app traz dois carrosséis completos de referência: cinco slides sobre a academia em fevereiro e três slides com fotos.

### 4. A capa e o loop

Cada slide é uma página que desenha qualquer instante do próprio loop, sempre igual para o mesmo instante. Por isso o app fotografa o slide quadro a quadro, a 30 quadros por segundo, e refaz um slide sem tocar nos outros.

O Instagram mostra o primeiro quadro de cada vídeo como capa até ele tocar. Então todo slide nasce terminado no primeiro quadro: título, texto e recurso no lugar, nada entrando. O movimento vem de sair e voltar. As frases de apoio saem na primeira meia batida e voltam uma por batida, o título sai perto do fim e volta com impacto, o contador some e volta contando, o botão encolhe e estoura de novo. No último quadro tudo está como no primeiro, e o loop fecha sem salto.

### 5. Movimento sem pausa

Algo se mexe já no primeiro segundo ou dois, e nenhum trecho passa de 1,25 s sem um gesto (duas batidas e meia, a 120). Um gesto de cada vez, sempre na batida, e texto não quica. No vídeo final, a conferência avisa a partir de 1,5 s parado. Ela mede a mudança da tela inteira: a luz do fundo, a régua de compassos e a seta de deslizar se mexem o tempo todo, mas não seguram um trecho. O que segura é um elemento grande saindo e voltando, como o título, um cartão ou o botão.

### 6. Uma cor e um acento

Um tema por carrossel, o mesmo em todos os slides: fundo, texto, um cinza para os rótulos e um único acento. O acento marca só a palavra principal do título, o recurso do slide e as marcas de continuidade, como a régua de compassos e as pílulas de progresso, iguais em todos os slides.

| Tema | As cores | Combina com |
|---|---|---|
| noir | quase preto, texto marfim, acento dourado, grão fino | opinião forte, provocação |
| cobalt | azul, texto branco, acento laranja | lançamento, produto, energia |
| paper | fundo claro, acento terracota | ensino, método, calma |
| forest | verde escuro, acento lima | saúde, natureza, rotina |
| mono | preto e branco | marca que já tem cor demais |

As letras são de uma família só, com dois pesos. Os títulos têm até 3 linhas, e nenhum texto fica abaixo de 44 px.

### 7. A música na batida

A trilha é sintetizada no seu computador, sem música de terceiros, em cinco estilos:

| Estilo | Como soa | Combina com |
|---|---|---|
| clean | bumbo macio, palmas, um arpejo esparso | explicação, tutorial |
| noir | cama escura de sintetizador, baixo longo | opinião forte, provocação |
| upbeat | bumbo em todo tempo, melodia brilhante | lançamento, novidade |
| lofi | batida com balanço, chiado de vinil | rotina, bastidores |
| pulse | um pulso de sintetizador por batida | produto, tecnologia, dados |

A mesma semente dá sempre a mesma trilha; trocar a semente muda o tom e a melodia, não o estilo. Por cima, cada slide ganha os próprios efeitos, um por gesto visível: um impacto quando o título volta, um tique a cada linha, um pop a cada cartão. São 13 tipos, com volumes de fábrica equilibrados. Cada slide é mixado a −14 LUFS, o volume das redes, com pico real de até −1 dBTP e sem fade no fim, porque é um loop.

### 8. Olhar antes de opinar

A IA não diz que um slide ficou bom sem olhar. Antes do render, monta para cada slide uma folha com um quadro por batida e abre a capa em tamanho real. Depois do render final, olha a folha do vídeo pronto e um teste de leitura a 360 px de largura, o tamanho de um celular. E passa o carrossel por uma lista contra o texto genérico: o gancho serviria a qualquer nicho? Algum título começa com "Descubra"? Há número sem origem? Um "sim" é um slide a refazer.

### 9. Refazer só o que mudou

O app guarda uma assinatura de cada parte. Trocar um efeito sonoro refaz só o som daquele slide. Editar um slide, ou uma imagem que ele usa, refaz o vídeo e o som dele. Trocar o estilo ou a semente da trilha refaz a trilha e as mixagens, sem fotografar nenhum quadro. O progresso é salvo slide a slide: um render interrompido continua de onde parou, e um slide pela metade nunca conta como pronto.

## Os arquivos por dentro

Tudo de um carrossel fica em `carrosseis/<nome>/`:

| Arquivo | O que guarda | Mudanças |
|---|---|---|
| `brief.md` | o briefing | peça à vontade |
| `storyboard.json` | o roteiro | peça; a IA acerta as páginas junto |
| `slides/01.html` e seguintes | cada slide: textos, posições, cores e movimento | peça texto, cor, gesto ou recurso |
| `assets/` | as imagens (cada gerada com um `.json` ao lado, com o pedido), o logo, a sua música | troque um arquivo, e só os slides que o usam são refeitos |
| `out/` | os slides finais com som | é o que você posta |
| `audio/`, `previa/`, `renders/` | a trilha e os efeitos, as prévias com as folhas de quadros, os finais sem som | feitos pelo app |
| `preview.html`, `relatorio.json` | a prévia e a última conferência | refeitos a cada render e a cada conferência |
| `carousel.json`, `motion.js`, `carousel.js` | o registro do que já foi renderizado e as bibliotecas dos slides | deixe como estão |

Quem pinta o slide é a página. O tema, a semente e as frases do roteiro são copiados para as páginas quando a pasta é criada; depois, mudar uma cor ou uma frase é mudar a página, e a IA mantém o roteiro em dia. O andamento e os compassos ficam nos dois lugares e mudam juntos.

## Pedidos avançados

- "Use a trilha lofi." Ou: "Troque a semente da trilha, quero outra variação."
- "Deixe o primeiro compasso sem bateria, para o gancho respirar."
- "Use a minha música, trilha.mp3. A música é minha." O app mede o andamento. Se combinar com o roteiro (até 1,5 batida por minuto de diferença, ou o dobro, ou a metade), as batidas se alinham; se não, a IA ajusta o roteiro e as páginas ao andamento medido. Se a música acabar antes do carrossel, os últimos slides ficam sem trilha.
- "Comece a música no refrão, aos 42 segundos."
- "Use as cores da minha marca: fundo #0B1F3A, texto #F5F5F5, rótulos #8FA3BF e destaque #FFB000." Um tema próprio leva essas quatro cores e precisa manter o contraste entre fundo e texto.
- "Ponha o meu logo no alto, no lugar do rótulo." Em PNG com fundo transparente; a conferência o confere como confere o texto.
- "Faça em 3:4." Os modelos foram desenhados no 4:5, e o 3:4 só ganha espaço embaixo.
- "Deixe o slide 2 com 4 compassos." Ou: "Mude o andamento para 100."
- "No slide 2, um contador até 1.234 e um gráfico com estes números." Os números vêm de você.
- "Comece do exemplo pronto, para eu ver como fica." O app copia o exemplo da academia ou o exemplo com fotos.
- "No render final, acrescente desfoque de movimento." Ajuda quando algo cruza a tela depressa.
- "Quero 8 slides." O app aceita até 20; acima de 7, só quando você pede.

## As conferências

No resumo da conferência, ✓ quer dizer que passou, ✗ que reprovou, △ é um aviso e ○ é o que não foi medido.

Em cada slide:

| Item | O que exige | Quando não passa |
|---|---|---|
| Página | o slide abre, desenha cada instante e tem duração | reprova, com o erro na mensagem |
| Primeiro quadro legível | ao menos um texto com 44 px ou mais no primeiro quadro | reprova |
| Área segura | todo texto e todo logo, em todo instante, dentro da margem de 72 px e fora dos dois cantos do Instagram: o contador "1/N" (170×80 px, no alto à direita) e o botão de som (100×100 px, embaixo à direita) | reprova |
| Tamanho do texto | o menor texto do slide | reprova abaixo de 26,4 px; avisa abaixo de 44 px |
| Loop sem emenda | o último quadro igual ao primeiro, com semelhança de 0,985 ou mais | avisa de 0,95 a 0,985; reprova abaixo disso |
| Piscadas | no vídeo final, até 3 mudanças bruscas de luz por segundo | avisa |
| Tempo parado | no vídeo final, nenhum trecho parado de 1,5 s ou mais | avisa e diz o trecho |
| Volume | no vídeo final, −14 LUFS com folga de 1,5 LU e pico real até −1 dBTP | avisa com o pico acima de −1; reprova fora da folga ou com pico acima de 0 |

Antes do render só as páginas são lidas, e piscadas, tempo parado e volume ficam como não medidos. Os cortes na batida também, porque um slide não tem cortes, tem gestos.

No conjunto, reprova: menos de 2 ou mais de 20 slides; um slide com menos de 3 ou mais de 60 s; uma página que não dura os compassos do roteiro (com tolerância de um quadro); slides de tamanhos diferentes; a capa do slide 1 ilegível. Avisa: o último slide não é a chamada; o carrossel passa de 90 s, e poucos chegam ao fim.

**Quando algo reprova**, a IA corrige o slide, fotografa de novo e confere só o que mudou, até não sobrar reprovação. Tempo parado se resolve levando para o trecho quieto um elemento grande que sai e volta; volume reprovado, abaixando os efeitos mais fortes do slide e mixando de novo. Na entrega, a IA relata cada item, inclusive os avisos. A conferência mede; gostar do resultado é com você.

## As imagens

Cada imagem vem do primeiro caminho disponível, nesta ordem:

1. **A sua própria IA**, quando ela gera imagens na conversa.
2. **O Codex conectado à sua conta do ChatGPT.** As imagens contam no seu plano, sem chave, levam por volta de um minuto e meio cada e saem uma de cada vez. Se a configuração do seu Codex pede um modelo que a sua conta não aceita, o app tenta de novo com o modelo padrão, sem mudar as suas configurações, e a espera pode dobrar. Um Codex que entra com chave da OpenAI fica fora da ordem automática, porque cada imagem seria cobrada nessa chave: a IA só o usa se você pedir.
3. **A chave do Gemini**, se você a salvou. Uns 15 segundos por imagem.
4. **As suas fotos**, sempre que o assunto é você, o seu produto ou o seu lugar, ou quando não há caminho acima. JPEG ou PNG, com pelo menos 1080 px no lado menor; fotos na vertical rendem mais no 4:5.
5. **Sem fotos:** o estilo gráfico.

Os pedidos vão em inglês, que os modelos entendem melhor, com as mesmas palavras de luz e de estilo no carrossel inteiro, para as fotos parecerem da mesma sessão. A IA abre cada imagem antes de usar e pede de novo quando vem uma moldura, um texto que ninguém pediu ou uma mão deformada.

**O recorte** de um objeto sai automático. O Codex entrega a imagem com fundo transparente; com o Gemini, ela vem sobre um verde chapado que o app remove (azul, se o objeto é verde). Um recorte inteiro costuma ficar entre 60% e 90% transparente: abaixo de 30%, o fundo não saiu; acima de 97%, o objeto saiu junto, e o app avisa. Uma pessoa recortada só vem de uma foto sua já sem fundo, porque gerar de novo mudaria o rosto.

**No slide**, uma foto principal, sem colagem. O texto vai sobre um degradê ou sobre a foto escurecida, na cor de texto do tema, nunca sobre um rosto nem sobre o recorte. O fundo mexe pouco e o recorte mexe mais, o que dá profundidade, e os dois voltam ao lugar no fim do slide. A IA não gera rosto de pessoa real, logo ou produto de outra marca, nem texto dentro da imagem. Imagens geradas podem levar uma marca d'água invisível que identifica a origem.

## Com outros apps

O Carrossel animado planeja: o roteiro, os tempos, os arquivos. Quem renderiza é o Motor de vídeo, outro app do flyee.club. Slide por slide, ele abre a página num navegador sem janela, fotografa os quadros, codifica o vídeo, sintetiza a trilha e os efeitos, mede as batidas da sua música, mixa no volume das redes e confere o resultado. A biblioteca `motion.js` dos slides vem dele, com a grade de batidas e as molas do movimento. Quando o Motor de vídeo é atualizado, o próximo render refaz os slides e a trilha com a versão nova.

## Privacidade

- **O render acontece no seu computador.** O navegador sem janela, o ffmpeg e a síntese da trilha rodam aí, sem internet. O app não publica nada e não envia os seus arquivos a lugar nenhum.
- **Imagens geradas.** Pelo Codex, a descrição (e a imagem de referência, se houver) vai para a OpenAI, pela sua conta. Pelo Gemini, vai para o Google, com a sua chave. Uma foto sua só sai do computador se for usada como referência para gerar outra imagem.
- **A conversa.** As folhas de quadros e as imagens que a IA abre para julgar os slides entram na conversa com ela, como qualquer arquivo que ela lê.
- **A chave.** Fica só no seu computador, em `~/.flyee/keys.json`, fora de qualquer projeto. Nunca passa pela conversa nem é gravada no projeto. Uma variável de ambiente GEMINI_API_KEY, se você preferir, tem prioridade.
- **O registro de uso.** Ao fim de um carrossel, a IA registra no flyee.club que o app foi usado: o nome do app e a versão, nunca o conteúdo, os textos, as imagens ou os nomes de arquivos.

## Quando algo dá errado

- **Falta o Motor de vídeo.** A IA conta o que ele faz e o que acessa e, com o seu sim, o instala. Sem ele não há render.
- **Falta o ffmpeg ou o navegador.** A IA instala. No Mac sem o Homebrew, ou no Linux quando pede a senha de administrador, ela mostra o único passo que depende de você. No Windows, o navegador é o Microsoft Edge, que vem com o sistema.
- **O render parou no meio.** Peça para continuar: os slides prontos são aproveitados.
- **A prévia está muda.** Ela começa assim, como o feed. Clique em "Som" ou tecle M; as setas passam os slides.
- **A prévia mostra uma versão antiga.** Ela mostra o último render, rápido ou final. Peça um render novo.
- **Uma frase saiu menor que as outras.** A frase está longa: peça para cortar palavras em vez de aceitar a letra menor.
- **A música saiu da batida.** O andamento dela é outro. A IA ajusta o roteiro ao andamento medido, ou você escolhe outra música; se a batida não é clara, ela pergunta o andamento.
- **O recorte ficou com contorno verde ou com buracos.** A IA ajusta a remoção do fundo e gera de novo.
- **O Codex atingiu o limite do plano, ou a chave do Gemini não foi aceita.** Espere, siga pelo outro caminho ou use as suas fotos. Uma chave recusada se confere no Google AI Studio e se salva de novo pela página que a IA abre, que vale por 15 minutos.
- **O slide ficou diferente em outro computador.** As letras vêm do computador que renderiza: faça a prévia e a versão final no mesmo computador.
