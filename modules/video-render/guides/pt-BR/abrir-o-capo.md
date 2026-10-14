# Abrir o capô

O Motor de vídeo por dentro: as etapas de um vídeo e o motivo de cada uma, os arquivos, os pedidos que vão além do básico e as conferências antes da entrega. Tudo roda no seu computador, e quem executa cada passo é a sua IA.

## Como ele trabalha

### 1. Uma página que desenha o tempo

O Motor não anima nada sozinho. A sua IA escreve uma página HTML que sabe desenhar qualquer instante: peça o segundo 3,5 e ela pinta exatamente o que aparece ali. O Motor abre essa página num navegador sem janela, pede um instante de cada vez, fotografa a tela e passa a foto ao ffmpeg, que monta o vídeo.

O motivo é a repetição. Como cada quadro depende só do tempo, renderizar duas vezes dá o mesmo vídeo, e mudar uma linha da página muda só o que essa linha desenha. Por isso a página não usa relógio, sorteio sem semente nem animação própria do navegador; quando um vídeo sai diferente a cada render, a IA corrige a página. Uma assinatura dos quadros prova que dois renders são iguais.

A página também declara onde ficam o texto, o logo e o rosto em cada instante. É com essas caixas que a conferência mede a capa, a área segura e o tamanho da letra.

### 2. O som vem antes da animação

A trilha é composta antes de qualquer movimento, porque a grade de batidas dela decide onde cada corte, entrada e soco caem. Há duas trilhas, feitas em código no seu computador, sem música de terceiros:

| | Trilha com arco | Trilha em loop |
|---|---|---|
| Para | um vídeo que se assiste do começo ao fim, como um Reels de 15 a 20 s ou um anúncio | um loop e os slides de um carrossel |
| Forma | introdução, crescimento, ponto alto e uma pancada final no último tempo forte | compassos inteiros que repetem sem clique na emenda |
| Estilos | limpo, enérgico, quente, mínimo, cinematográfico e brincalhão | limpo, noir, animado, lo-fi e pulso |
| Andamento | de 40 a 220 BPM, de 1 a 600 s | de 60 a 200 BPM, de 1 a 64 compassos |

Cada trilha sai com a sua grade, um arquivo com o instante de cada tempo. Na trilha com arco, a grade marca também o ponto alto (o drop), onde o vídeo põe a maior mudança de cena. A mesma semente refaz a mesma trilha em qualquer computador.

Se você trouxer uma música, o Motor mede o andamento dela e monta a mesma grade. A medição vem com um grau de confiança de 0 a 1; abaixo de 0,5, a IA confirma o BPM com você antes de animar. Os efeitos (impacto, clique, whoosh, sino, digitação, obturador e outros) também são sintetizados, cada um no instante de um gesto que aparece na tela.

### 3. Fotografar, quadro a quadro

O navegador sem janela pode ser o Microsoft Edge, o Google Chrome, o Chromium ou o Brave. Ele abre com um perfil novo e vazio, sem os seus logins, e esse perfil é apagado no fim. Num vídeo com 120 quadros ou mais, num computador com pelo menos 4 núcleos, o Motor divide o trabalho entre até 4 navegadores.

Para o desfoque de movimento, o Motor fotografa 2 ou 4 subquadros por quadro e os mistura: o que corre borra sozinho, o que está parado continua nítido. Isso custa de duas a quatro vezes o tempo do render, por isso fica para o vídeo final.

### 4. Olhar antes de mostrar

A IA nunca descreve um vídeo que não viu. Para olhar, ela tem quatro ferramentas:

- a prévia, um render rápido em metade do tamanho;
- quadros de instantes escolhidos, ou um por batida, reunidos numa folha de contato;
- a tira, com 12 quadros seguidos em volta de uma transição;
- o teste de celular, um quadro por segundo a 360 px de largura.

O trabalho anda em rodadas: a IA dá nota de 1 a 10 ao gancho dos primeiros 2 segundos, à leitura no celular, ao movimento, à variedade, à fidelidade à marca e à sincronia com o som, corrige os três piores problemas e renderiza de novo só os segundos afetados. São pelo menos 3 rodadas, até todas as notas chegarem a 8 e a conferência passar; se não der, a IA diz onde parou e por quê.

### 5. A mixagem

Música, efeitos e voz entram por baixo do vídeo mudo, que é copiado sem perder qualidade. Com voz, a música abaixa quando você fala (10 dB por padrão) e volta quando você para. A mixagem passa duas vezes pelo áudio: a primeira mede, a segunda leva o resultado a −14 LUFS, com pico real de até −1 dBTP. É o volume em que o YouTube e a maioria dos players igualam os vídeos; as outras redes não publicam o alvo delas, e esse valor toca no mesmo volume em todas.

### 6. Conferir e entregar

A conferência roda na página, antes do render final, e de novo no vídeo pronto, depois da mixagem. O relatório fica gravado ao lado do vídeo, que a IA abre no player do seu computador.

## O método de animação

A página segue um método escrito para vídeos curtos de produto:

- **Molas em vez de curvas fixas.** O que entra acelera e assenta com peso; texto e logo nunca quicam.
- **Um elemento vira a transição.** O cartão vira a tela, a etiqueta vira um risco, e o olho sempre tem o que seguir.
- **Rajada e silêncio.** Trechos quase parados se alternam com cortes rápidos, e a maior mudança cai no ponto alto da trilha.
- **Variedade.** Pelo menos 4 enquadramentos em 15 segundos.
- **Fica de fora:** título centralizado sobre degradê com tudo entrando em fade, partículas, reflexo de lente, vinheta, granulado e fusão entre capítulos.

## Os arquivos por dentro

| Arquivo | O que guarda | O que você pode pedir |
|---|---|---|
| `pagina.html` | as cenas, os textos, as cores, os tempos e os cortes do vídeo | qualquer mudança: "troque o título da segunda cena", "segure o logo mais um segundo" |
| `motion.js` | a biblioteca de animação que a página usa, copiada do Motor | nada; ela vem pronta |
| a trilha (`.wav`) e a grade (`.beats.json`) | a música e o instante de cada batida | outro estilo, outro andamento ou outra versão; a grade é refeita junto com a trilha, nunca à mão |
| os efeitos (`.wav`) e a lista deles (`.json`) | os sons e o instante de cada um | mover, tirar ou acrescentar um efeito |
| `previa.mp4` e `quadros/` | a prévia e as fotos de conferência | nada; a rodada seguinte refaz e substitui |
| o vídeo mudo e o vídeo final | o render sem som e o vídeo com a mixagem | um render novo depois de uma mudança na página ou no som |
| `.aceite.json` | o relatório da conferência, item a item, com o que mudar | nada; é a prova do que foi conferido |
| `capturas/`, uma pasta por site | `captura.json` com a marca lida (nome, logo, cores, fontes, botões, números, preços e redes sociais), as telas do computador e do celular, a página inteira, as rolagens gravadas e o logo | corrigir o que veio errado: diga a cor certa ou mande o logo, e a IA usa o que você disse |

Se já existe um arquivo com o nome que o Motor vai gravar, ele é substituído; a IA escolhe os nomes e avisa antes de sobrescrever uma página sua.

## Pedidos avançados

**Formatos**

- "Renderize a mesma página em 9:16, 4:5, 1:1 e 16:9 e me mostre uma folha de cada." A página recompõe o layout em cada formato em vez de ser cortada. Os formatos com nome são 9:16 (1080×1920), 4:5 (1080×1350), 3:4 (1080×1440), 1:1 (1080×1080) e 16:9 (1920×1080); um tamanho sob medida, como 720×1280, também vale.
- "Tire a capa: o quadro do segundo 0 em PNG, no tamanho do Reels." Um 9:16 aparece cortado em 4:5 no feed e em 1:1 na grade do perfil, então o que importa fica no centro.
- "Renderize só do segundo 4 ao segundo 8" ou "a 60 quadros por segundo" (o Motor aceita de 1 a 120).

**Redes**

- "Confira para Reels, TikTok e Shorts." Com várias redes, vale o maior recuo de cada lado entre elas, e o vídeo aprovado cabe nas três.
- "Este vídeo vai para anúncio da Meta." A interface dos anúncios cobre mais que a dos posts, até 672 px embaixo, e a IA desenha com essa área desde o começo.

**Música e efeitos**

- "Trilha com arco, estilo cinematográfico, a 100 BPM, com 20 segundos."
- "Trilha em loop, estilo noir, 8 compassos a 120 BPM, com o primeiro compasso sem bateria."
- "Uma trilha constante, sem ponto alto, para ficar por baixo da minha fala."
- "Outra versão da mesma trilha" ou "uma trilha em lá menor".
- "Um impacto na entrada do título, um whoosh em cada troca de cena e som de digitação enquanto o texto aparece."
- "Use esta música, que eu tenho licença, e ponha os cortes nas batidas dela."

**Voz e volume**

- "Ponha a minha narração por cima e abaixe a música quando eu falo."
- "Abaixe a música 3 dB e suba os efeitos."
- "Termine a música com um fade de meio segundo." Num loop, a trilha termina seca, para emendar no começo.

**Imagem e entrega**

- "Faça uma camada transparente das animações para eu pôr por cima da minha gravação no meu editor." Ela sai em .mov (ProRes 4444) ou .webm (VP9), que guardam a transparência.
- "O arquivo ficou grande para o TikTok: renderize de novo um arquivo menor." A compressão maior encolhe o arquivo quase sem mudar a imagem.

**Captura do site**

- "Capture o site da minha marca sem gravar a rolagem" ou "sem baixar o logo".
- "Capture com o celular a 430 px de largura." O celular vai de 280 a 1080 px (padrão 390); o computador, de 800 a 3840 px (padrão 1440).

## As conferências

A conferência mede o que costuma dar errado sem aparecer na prévia. Cada item volta com uma marca: ✓ passou · ✗ reprovou · △ aviso · ○ não medido. "Não medido" quer dizer que faltou o que o item precisa: a página, o vídeo, a grade de batidas, o pedido de loop ou o som.

| Item | O que mede | Passa | Avisa | Reprova |
|---|---|---|---|---|
| Página | abre, desenha cada instante, declara a duração, aceita o formato e não dá erro | tudo certo | não se aplica | qualquer falha; a conferência para ali |
| Capa | o primeiro quadro tem texto do tamanho mínimo | 44 px ou mais num quadro de 1080 de largura | não se aplica | sem texto, ou com texto menor |
| Área segura | texto, logo e rosto longe dos botões e das legendas da rede | tudo dentro, com 1 px de folga | não se aplica | algo fora, com o instante e quantos pixels |
| Tamanho do texto | o menor texto do vídeo | a partir do mínimo | entre 60% do mínimo e o mínimo | abaixo de 60% (26,4 px quando o mínimo é 44) |
| Cortes na batida | cada corte contra a batida mais próxima | todos a até 1 quadro (33 ms a 30 quadros por segundo); num vídeo sem a página, 70% a até 2 quadros | não se aplica | menos que isso |
| Emenda do loop | a semelhança entre o último quadro e o primeiro | 0,985 ou mais | de 0,95 a 0,985 | abaixo de 0,95 |
| Piscadas | mudanças bruscas de luz em qualquer janela de 1 s | até 3 | mais de 3 | nunca |
| Tempo parado | trechos seguidos sem mudança na imagem | menos de 1,5 s | 1,5 s ou mais | nunca |
| Volume | o volume integrado e o pico real | −14 LUFS, com 1,5 LU de folga, e pico até −1 dBTP | volume certo, pico entre −1 e 0 dBTP | volume fora da faixa, ou pico acima de 0 dBTP |
| Formato, por rede | se a rede aceita o formato | aceita, e é o que ela recomenda | aceita, mas recomenda outro | não aceita |
| Duração, por rede | a duração contra o mínimo, o máximo e o recomendado da rede | dentro do recomendado | acima do recomendado | abaixo do mínimo ou acima do máximo |

Alguns detalhes contam:

- **O mínimo da letra cresce com a largura do quadro.** São 44 px a 1080 de largura e 78 px num 16:9 de 1920, que no feed aparece na largura do celular; para tela grande (YouTube no computador ou na TV), a IA usa 26,7 px a 1920.
- **A área segura muda com o destino.** No Reels, a interface cobre 250 px em cima, 420 embaixo e 180 à direita; no TikTok, 160, 400 e 160; no Shorts, 230, 500 e 170. No carrossel do Instagram, são 72 px de margem e dois cantos reservados: o contador "1/N" (170×80 px, em cima à direita) e o botão de som (100×100 px, embaixo à direita).
- **Piscadas e tempo parado só avisam.** Mais de 3 piscadas por segundo incomodam e, em algumas pessoas, causam crises. Com dois segundos parados num vídeo vertical, o dedo rola para o próximo. Texto sendo digitado e zoom lento contam como movimento.

**Quando algo reprova.** A IA aplica a correção que o item sugere, renderiza de novo e confere de novo. Aviso não reprova: a IA conta o que viu e você decide. Você pode decidir publicar com um item reprovado; a IA entrega dizendo qual item e por quê, e nunca chama de pronto um vídeo reprovado sem avisar.

### As redes conferidas

| Rede | Formato | Duração aceita | Recomendada |
|---|---|---|---|
| Instagram Reels | 9:16 | de 3 s a 3 min | até 90 s |
| Instagram Stories | 9:16 | de 1 a 60 s | até 15 s |
| Instagram feed | 4:5 (também 1:1 e 16:9) | de 3 s a 15 min | até 60 s |
| TikTok | 9:16 | de 3 s a 10 min | até 60 s |
| YouTube Shorts | 9:16 (também 1:1) | de 1 s a 3 min | até 60 s |
| YouTube | 16:9 | de 1 s a 12 h | sem recomendação |
| LinkedIn | 9:16 (também 4:5, 1:1 e 16:9) | de 3 s a 10 min | até 90 s |
| X | 16:9 (também 1:1 e 9:16) | de 0,5 s a 2 min 20 s | até 60 s |
| Status do WhatsApp | 9:16 | de 1 a 60 s | até 30 s |
| Kwai | 9:16 | de 3 a 60 s | até 30 s |
| Anúncios da Meta (Reels e Stories) | 9:16 | de 1 a 60 s | até 15 s |
| Anúncios do TikTok | 9:16 | de 5 a 60 s | até 34 s |

A tabela foi conferida em fontes públicas em 7 de outubro de 2026; onde não deu para confirmar um valor, ela usa o mais cauteloso. Quando o arquivo passa do limite de envio de uma rede, a conferência avisa. Sem você dizer as redes, um vídeo pronto é conferido contra as habituais do formato: 9:16 contra Reels, TikTok e Shorts; 4:5 e 1:1 contra o feed do Instagram; 16:9 contra o YouTube.

## Com outros apps

- **Estúdio de vídeo.** Cria vídeos animados para Reels, TikTok e Shorts a partir do seu pedido. Ele faz as perguntas, escreve a página com a sua marca e usa o Motor para capturar o site, compor a trilha, renderizar e conferir.
- **Carrossel animado.** Faz carrosséis do Instagram com um vídeo curto em loop em cada slide. Usa o Motor para renderizar e conferir cada slide, com a área do carrossel e a emenda do loop, e para gerar uma trilha em loop para o carrossel inteiro, da qual cada slide toca um trecho.

Cada app guarda o que produz na própria pasta do seu projeto, fora da pasta de instalação do Motor, que é trocada a cada atualização; dentro da mesma versão da interface, uma atualização do Motor só acrescenta. Se o Motor faltar, a sua IA conta o que ele vai poder fazer no seu computador e, com o seu sim, instala. Sem ele, o outro app entrega a página e diz o que o Motor faria com ela.

## Privacidade

O Motor roda no seu computador e não envia arquivo nenhum. Ele só usa a internet em três situações:

- **Na captura de um site.** O navegador sem janela visita o endereço que você pediu e baixa só imagens: o logo, os ícones e a imagem de compartilhamento, até 10 MB cada. Nada do seu computador é enviado, e nada do site roda fora do navegador.
- **No render, se a própria página usar algo de fora**, como uma fonte da web.
- **Na instalação dos programas.** O ffmpeg, e o Chromium no Mac e no Linux, vêm do gerenciador de programas do seu sistema.

Depois de uma tarefa, a IA registra no flyee.club que o app foi usado: o nome do evento, o app e a versão dele, as versões do flyee no seu computador e se o projeto é seu ou de um cliente. Arquivos, textos, caminhos e nomes de projeto nunca vão. O registro espera numa fila, num arquivo da pasta do flyee, que a IA pode abrir para você.

Nunca saem do seu computador: as páginas, os vídeos, as trilhas, a sua voz, as capturas e os relatórios.

## Problemas comuns

| O que acontece | O que pedir à IA |
|---|---|
| O vídeo sai diferente a cada render | "Deixe a página previsível: sem relógio, sem sorteio e sem animação do navegador." |
| Quadros vazios, ou a página deu erro | "Mostre os erros da página e corrija." |
| A fonte saiu diferente em outro computador | "Ponha os arquivos da fonte ao lado da página." |
| O site barrou a captura | Mande as telas, ou peça "capture outro endereço do mesmo site". |
| O endereço ainda não tem site | Mande o logo e duas ou três imagens. Uma página de "em breve" é capturada com aviso: confirme que o logo e as cores são seus. |
| A leitura das batidas da sua música ficou incerta | Diga o BPM, se souber, ou "use uma trilha original no lugar". |
| O render demora | Peça a prévia para os ajustes e deixe o desfoque de movimento para o vídeo final. |
| Falta navegador no Windows | O Microsoft Edge vem com o Windows: confira se ele está instalado. |
| A instalação precisa de você (a senha de administrador no Linux, o Homebrew que falta no Mac) | A IA mostra o passo único e espera. Depois, peça "confira de novo o que falta". |
