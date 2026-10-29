# Transcrição: Opus 5.5 Mudou a Edição de Vídeo Para Sempre (skills gratuitas)

Felipe Borges - Fala IA! · https://www.youtube.com/watch?v=PeQNydT-xF8
Origem: legenda automática do YouTube (pt-orig). 4374 palavras, cerca de 215 palavras por minuto. Tempos em MM:SS.

**00:00** Mas recentemente eu comecei a testar o famoso Oppul 5.5 e alguns dos resultados que eu tô conseguindo aqui, sem exagero, são os melhores que eu já tive até

**00:08** agora. Sim, o Opus 5. Fable 5.1 e o GPT6 Astra. Duvida, dá só uma olhada nesse vídeo que ele criou para mim. [música]

**00:27** >> [música] >> Isso aqui foi feito com praticamente um único prompt e o mais interessante não é só o fato dele conseguir montar um vídeo

**00:37** e fazer algumas animações, mas sim o fato de que ele entende contexto, cria motion designs, trabalha o sound design, ou seja, o som, a música que você ouvir no vídeo, ele mesmo que gerou. E também

**00:47** se ele percebe que tá faltando algum material para completar o vídeo, ele mesmo consegue pegar screenshots, gerar imagens e vídeos se for necessário. Ou seja, você não precisa ficar falando exatamente onde vai entrar cada imagem,

**00:57** onde entra uma animação, onde corta, qual efeito ele tem que colocar. Você apenas conversa com ele usando linguagem natural. Então, nesse vídeo, eu quero te mostrar exatamente como eu montei esse

**01:06** processo de criação, como você consegue configurar isso também e começar a editar seus vídeos da mesma forma que eu faço. E você vai perceber também que a parte mais impressionante é justamente

**01:15** que você não precisa aprender nenhuma sequência absurda de comandos. Na maior parte do tempo, você simplesmente explica o que quer e deixa aí a trabalhar. Então, se isso te interessa,

**01:25** já pega o café e vamos logo pro vídeo. Tudo que você acabou de ver agora nessa introdução, nessa abertura, foi 100% criado com OPO 5. E antes que você fale: "Ah, mas deve ter saído caro porque você

**01:34** gerou imagens, utilizou o Hix", eu não gerei nada, foi somente o Oppul 5.5. Detalhe, ainda utilizando seu esforço médium, que criou tudo isso que você

**01:43** acabou de ver. E o trabalho dele é realmente fantástico, porque além dele fazer isso com uma certa velocidade, ele entrega um vídeo numa qualidade muito boa. Olha a beleza disso. Olha a

**01:53** qualidade que ele entrega esses motion graphics na tela, como ele cria tudo isso, como ele deixa isso legível e principalmente bem sincronizado com aquilo que eu tô falando. Mas antes da gente ver os prompts e como a gente pode

**02:03** construir exatamente um vídeo igual ao que eu fiz, você precisa instalar no seu cloud o seu Hyper Frames, que é uma biblioteca que permite o cloud e

**02:12** qualquer, na verdade, modelo de inteligência artificial editar o seu vídeo utilizando HTML. sim, editar o vídeo utilizando códigos. E aí com isso ele vai poder cortar o vídeo, dar zoom,

**02:21** editar, criar motion graphics, colocar esses motion graphics e renderizar tudo, enviar para você, como a gente acabou de ver que ele fez nesse vídeo que a gente assistiu. E para fazer isso, você pode entrar direto no site do Hyperframes,

**02:31** copiar esse código, enviar pro seu modelo e pedir para ele executar. Você também pode aqui ainda no site olhar melhor toda a documentação e tudo que o Hyperframes é capaz de fazer pelo seu

**02:41** vídeo. Você vai ver que é muita coisa. Mas se você quiser ganhar tempo, eu acredito que esse seja o seu caso, você vai entrar aqui no GitHub, vai simplesmente copiar o link desse repositório, passar pro seu cloud code e

**02:50** pedir para ele instalar o Hyperframes para que você possa editar vídeos utilizando o modelo. Vale dizer também que, apesar da gente estar aqui nesse vídeo falando opus 5. Especificamente, esse repositório vale para qualquer modelo que você queira utilizar. Uma vez

**03:01** com o Hyperframe já instalado, o que eu fiz foi pegar aquele trecho de vídeo que ele criou, aqueles Motion Graphics, enviei pro Cloud Code e mandei o seguinte prompt. Eu utilizei a função Go

**03:10** e o que eu mandei foi acima o vídeo que eu preciso que você edite. Preciso que você edite esse vídeo para deixá-lo super envolvente, limpo e com hyper frames. Queremos um estilo Apple com motion graphics e animações extremamente

**03:21** limpos. Ou seja, não quero muita poluição, não quero muito desenho, quero algo mais limpo justamente porque isso ajuda a evitar aquela cara de slop, de vídeo que foi criado com inteligência

**03:30** artificial. O primeiro passo é você transcrever o vídeo. Isso aqui é muito importante. Sempre que a gente for pedir para qualquer modelo editar o nosso vídeo, a gente precisa garantir que ele faça uma transcrição correta daquilo que

**03:40** foi falado, porque é isso que vai fazer sentido quando ele colocar os motion graphics, fazer os cortes, dar os zooms. Então ele precisa fazer essa transcrição. Essa transcrição, você pode fazer de três formas. Você pode usar o 11 Labs, que é uma API que você vai

**03:49** pagar. Ele faz uma transcrição muito boa e mais rápida, só que você vai pagar para isso. Você pode jogar direto aqui nesse modelo já o vídeo e ele vai ser capaz utilizando a ferramenta interna

**03:58** dele que chama Whisper de fazer essa transcrição. Ou você pode usar até um modelo diferente para fazer essa transcrição. Quando eu vou criar Motion Graphics aqui dentro do meu cloud code, eu envio o vídeo mesmo e peço para ele

**04:08** criar. Mas quando eu vou utilizar o cloud design, eu acabo mandando o meu prompt já com o texto transcrito, mas ele também consegue fazer. Mas independente dessas três opções que você

**04:17** tem, qualquer uma vai funcionar. Uma vez que eu pedi então para ele transcrever o vídeo, eu continuo aqui. Depois você irá construir as animações com base nas minhas instruções. Quando eu disser modelos super poderosos, como Fable 5.1

**04:27** e GPT6 Astra, o que eu quero é que as animações apareçam exatamente nos pontos para onde eu estou apontando e dá sua olhada a perfeição com que ele faz isso.

**04:34** Exatamente quando eu falo dos modelos, eles aparecem ali no exato momento. Tudo isso graças à transcrição que ele fez aqui. Eu continuo, peço para que essa animação contenha o logo do Cloud e ele faça depois a mesma coisa pro GPT6

**04:45** Astra. E aqui eu digo que pro restante do vídeo, quando eu tiver falando sobre brolls, screenshots, geração de imagens e geração de vídeos, eu quero que ele crie e coloque elementos visuais entrando pelos lados esquerdos e

**04:55** direitos da tela para ele fazer todo esse preenchimento e não ficar focado em um único lado. No final desse prompt, eu digo que não importa exatamente qual conteúdo que ele vai utilizar, o importante é provar para quem tá assistindo que ele é realmente capaz de

**05:05** fazer essas coisas. O objetivo de tudo isso é que eu tô explicando que o OPPO 5.5 é capaz quando o assunto animar edições de vídeo. E aí ele com base somente nesse prompt

**05:14** aqui para baixo, ele já entregou aquele mesmo vídeo que você viu no começo da aula. Depois daquela breve abertura, o que a gente tem então é esse vídeo aqui que ele criou, que é esse showre do YouTube. E aqui presta atenção, porque

**05:24** além de toda a criação de imagem e edição que ele fez, ele também colocou um áudio que casa certinho com as cenas. Dá só uma olhada. [música]

**05:42** >> [música] >> E para ele conseguir chegar nesse nível e conseguir colocar a música certa, a trilha correta e passar a emoção que eu

**05:52** realmente quero que ele passe nesse vídeo, o que eu fiz foi passar para ele, adivinha só? uma referência, mas não uma referência para ele copiar o design, mas

**06:00** sim uma referência para que ele conseguisse entender muito bem como que funciona a batida, o ritmo, como que tem que ser os cortes, os bits. E para isso, uma das referências que eu passei para ele foi esse vídeo, que você vai ver que

**06:10** não tem nada a ver com aquilo que ele criou. Ele simplesmente utilizou esse vídeo para aprender como colocar a batida certa, como fazer um vídeo dinâmico, interessante, assim como essa referência.

**06:28** >> [música]

**06:45** >> Se você reparar bem, ele traz esses elementos no vídeo, principalmente aqui quando ele tá compilando, olha só, todos os meus vídeos e fazendo essa mudança.

**06:52** Inclusive até passando trechos dos meus vídeos. Essa parte aqui eu achei muito legal porque além dele ter pego todas as minhas thumbnails, entrado no meu canal, ele simplesmente pegou trechos de vídeo

**07:01** e colocou no meio da apresentação. Isso aqui ficou muito legal, deu uma dinâmica muito interessante e assim, particularmente, ficou bem bonito. Então, você percebe que existem algumas semelhanças naquilo que ele fez com a

**07:11** referência que eu passei, mas você percebe que tem um design próprio aqui, porque eu pedi para que fosse desse jeito. E o prompt único que eu passei para ele também foi justamente esse, onde eu passei essa referência que eu

**07:21** acabei de mostrar pra você e pedi pra ele analisar o vídeo que foi criado pelo OP 5.5 e descobrir porque que ele é tão bom em termos de design, ritmo, tipos de enquadramento e energia que ele

**07:30** transmite. Depois pedi para ele criar uma skill baseada nesse tipo de design motion graphic. Em seguida, vamos testar a skill utilizando ela na prática. Cria para mim um real ou show real, que é o

**07:38** nome desse tipo de vídeo de 15 segundos. Baseado nessa skill que criamos sobre o YouTube, faça uma pesquisa sobre YouTube e reunir quaisquer imagem de apoio Birow e quaisquer outros assets, ou seja,

**07:48** recursos necessários. E certifique-se de que todo real tenha uma identidade visual claramente ligada ao YouTube. A tipografia, linguagem visual, cores, branding, todos os elementos que fazem o

**07:57** YouTube ser reconhecido como YouTube devem ser inconfundíveis nesse show real. Para isso, pode usar como exemplo o meu canal. E aí eu passei o link do meu canal. Só veja que toda a forma que

**08:05** ele organizou o conteúdo, colocou as imagens, foi única e exclusivamente da ideia e da cabeça do próprio modelo. E para você ver que é verdade, se a gente continua descendo aqui o scroll, a gente

**08:14** vai descer até chegar na parte do vídeo. E veja que aqui ele tá gerando algumas imagens, porque o que ele faz é gerar essas imagens, depois ele anima essas imagens, joga tudo no Hyperframes e

**08:24** renderiza para nós. Então ele vai gerando algumas imagens antes. O próprio modelo faz isso, até que depois ele junta todas as partes do vídeo e nos devolve o vídeo completo pra gente

**08:33** assistir. E aí é exatamente o mesmo vídeo que você viu lá no começo da aula que eu coloquei. [música] Você viu com prompt extremamente simples. O prompt é absolutamente simples. Claro que a nossa skill ajudou e é óbvio que eu vou

**08:43** disponibilizar esse skill para você também. Então aqui na descrição do vídeo, no primeiro comentário fixado, tem o link pra comunidade gratuita. Na comunidade gratuita você pode fazer o download dessa skill. E para você

**08:53** entender mais no detalhe o que essa skill faz, ela vai analisar toda a estrutura do vídeo. Então olha só, ela vai quebrar o vídeo que você passar como referência em etapas. vai entender exatamente como que funciona o ritmo do

**09:03** vídeo, a velocidade do vídeo, vai entender o design, como ele funciona, o movimento e também vai, lógico, entender como as batidas no vídeo acontecem. Veja aqui que ele coloca em 152 bpm, a batida

**09:13** manda nos cortes. Mas continuando aqui, um outro showre que eu pedi para ele criar foi no começo do vídeo, onde eu tava no cantinho da tela e ele tava mostrando algumas coisas que foi esse

**09:21** show real exatamente aqui. E também de novo, ele ficou muito bom. Dá sua olhada na qualidade disso daqui. Inclusive, se você lembra muito bem no começo do vídeo, ele traz alguns efeitos sonoros

**09:30** que representam exatamente isso que foi criado. E ele fez todos esses show reels também com apenas um único prompt. Única coisa que eu coloquei no prompt diferente até agora que a gente viu é

**09:39** para ele deixar esse terço aqui da página livre para que eu pudesse justamente colocar isso aqui que a gente chama de pip. O resultado que ele entregou foi exatamente esse. Então, a gente pode ver só o motion, mostrar onde

**09:49** ficaria o terço, que é onde eu peço para ele deixar livre quando eu quero fazer esse tipo de efeito. E aí eu vou lá e coloco esse pipo de uma maneira muito fácil. Aliás, aproveitando isso aqui, que é muito importante, muita gente me

**09:58** pergunta como que eu faço essas edições do meu vídeo. E assim, de verdade, eu gasto muito menos tempo do que parece. Por quê? Uma vez que eu gerei esse motion graphic, então o motion graphic que eu me refiro é esse daqui que a

**10:07** gente viu no começo do vídeo, eu quero simplesmente colocar a minha imagem aqui do lado. Poxa, para fazer isso, principalmente utilizando efeitos no Premiere, isso aqui ia levar um certo

**10:17** tempo, ia ser um pouquinho chato de fazer. Por isso eu desenvolvi a nossa ferramenta querida, o Premiere Hey. E o que esse Premiere Hey faz é justamente facilitar esse nosso trabalho, porque

**10:26** olha só, ele consegue identificar aonde nós estamos no vídeo. E o que acontece aqui é que eu tenho essa faixa do vídeo mesmo que sou eu falando, que é só essa

**10:34** faixa aqui. Aqui sou eu falando. E eu tenho o desenho, ou seja, o motion graphic aparecendo embaixo. Então eu tenho minha imagem em cima e o motion graphic embaixo. Só que quando elas

**10:44** estão aqui e eu coloco a minha imagem em cima, veja que não vai aparecer o motion graphic, porque essa imagem tá em cima do motion graphic. Então o que que eu faço? Eu sincronizo os dois. Muito simples, porque o motion graphic ele é criado utilizando o áudio do vídeo,

**10:55** então ele tem exatamente a mesma duração. Só que se eu coloco assim ele não aparece. Aí que entra o nosso queridíssimo Premiere Hey. Olha só o que eu posso fazer de maneira muito simples.

**11:03** Eu seleciono onde eu quero da tela a minha imagem, ou seja, o meu pip. Eu posso também mudar isso livremente, mas para que ele fique respeitando a simetria, eu posso colocar ele

**11:12** exatamente onde eu quero, que é no meio do canto esquerdo. Poderia também mudar o formato do pip, então ele posso deixar ele mais tela inteira e reduzir ali, deixar ele wide, ó. Ele ficaria assim,

**11:23** caso eu queira deixar a minha imagem aqui em cima. Até mesmo tem gente que gosta de deixar ele mais circular. Eu poderia fazer do mesmo jeito. Vou deixar esse aqui circular para você ver esse exemplo diferente do que você viu no

**11:32** começo do vídeo. E aí, de maneira muito simples, eu posiciono onde eu quero que comece esse efeito e com um único clicar no botão, eu venho animar até este

**11:41** estado. Eu aperto esse único botão e aí esse efeito aqui já foi colocado automaticamente. Dá só uma olhada. Isso aqui foi feito com praticamente um único prom e o mais interessante não é só o

**11:51** fato dele conseguir montar um vídeo e fazer algumas animações, mas sim o fato de que ele entende contexto, cria motion designs, trabalha o sound design, ou

**11:59** seja, o som, a música que você ouviu no vídeo, ele mesmo que gerou. E também se ele percebe que tá faltando algum material para completar o vídeo, ele mesmo consegue pegar screenshot. Então imagina que depois disso você não quer

**12:09** mais ficar aqui, você quer mudar o formato, você quer, enfim, simplesmente voltar pra tela inteira, você pode vir aqui finalizar pip e voltar a tela cheia. Por que fazer isso? Porque aí ele vai criar uma animação de entrada e uma

**12:19** animação de saída para não ficar com aquele vídeo com cara de que foi mal acabado. Então, dá sua olhada. Então, a gente viu essa parte. Agora a gente quer voltar pra tela cheia. Ele cria essa animação e também se ele percebe que tá

**12:29** faltando algum material para completar o vídeo, ele mesmo consegue pegar screenshots, gerar imagens e vídeos se forn. E é com o Premiere He que eu faço minhas edições, eu consigo dar zoom na tela, destacar a tela. Então, imagina

**12:39** que eu queira focar aqui agora nesse trecho específico. Então, eu quero dar um destaque para essa minha plaquinha aqui de no ar. Eu posso vir aqui e criar um highlight. Ele vai criar uma animação

**12:48** de highlight para essa plaquinha. E aí, olha só que legal que fica. >> Você ficar falando exatamente onde vai entrar cada imagem. Veja que ele destaca ali bem no cantinho do mar. Com essa ferramenta a gente também pode criar o

**12:58** que eu chamo de popup. Então eu vou remover esse highlight. Veja que ele vai criar toda a animaçãozinha de saída também. Onde vai entrar cada imagem?

**13:05** Onde entra uma animação? Onde >> acabou de desaparecer. Imagina então que eu queiro chamar a atenção para esse ponto aqui e quero aumentar ele na minha

**13:12** tela. Eu posso vir aqui em popup e veja que a minha área de foco, ou seja, aquilo que eu quero focar, continua sendo a plaquinha. E essa área pontilhada é onde eu quero que essa

**13:22** plaquinha apareça. Então ela vai aumentar de tamanho e aparecer mais pro canto. Eu posso, obviamente, movimentar tudo isso. Por exemplo, destino do pop.

**13:29** Então a área de foco, eu quero que continue sendo a plaquinha. O destino do pop, eu quero que seja bem grandão aqui no meio da tela. Posso aumentar o tamanho. E aí, olha que legal esse efeito. Esse aqui é um dos mais legais

**13:39** que tem. Para variar, a gente vem aqui embaixo e põe criar popup. E olha só que legal que fica esse filme, >> cara de slop [limpando a garganta] que é aquele, veja que ele pega aquele trecho, aumenta, coloca como um popup ali. Eu posso colocar ele do tamanho que eu

**13:49** quiser na tela toda. Aqui ele tá embaçado porque a lente da minha câmera embaça o fundo por isso. Mas se você tiver mostrando um texto ou um trecho de alguma coisa que você tá compartilhando na tela, por exemplo, isso aqui é muito útil porque ajuda as pessoas a lerem,

**13:59** conseguirem ver alguma coisinha que talvez você foi mostrar no seu vídeo e ficou ali pequeno. E além de fazer isso, o Premier Re também faz cortes, coloca legenda, enfim, ele é a minha ferramenta de edição completa, onde eu faço toda a

**14:09** edição exatamente desse jeito. crio meus motion graphics, peço pro OP 5.5 me ajudar e eu mesmo finalizo o meu vídeo pedindo para que ele automaticamente faça cortes no meu vídeo de momentos de

**14:18** pausa, momentos que eu errei e também se eu quero dar algum zoom, algum destaque ou colocar o pip, que é minha imagem no cantinho, eu faço tudo isso com o premiere. E se você viu isso e tá se perguntando: "Puxa, eu quero ter acesso

**14:28** ao premiere, como é que eu faço?" É muito simples, você precisa só entrar e fazer parte da nossa comunidade AI verso. E lá dentro você também aprende como criar os sites da maneira que eu

**14:37** crio, motion graphics, como esse que você tá vendo, além que é o que eu falo, de ter acesso à minha caixa preta, todas as minhas ferramentas. Isso inclui o Premiere Hey que você acabou de ver e também o Design Studio. Para fazer

**14:47** parte, basta você passar a câmera do seu celular no QRC code que tá aparecendo aqui na tela, e vir fazer parte da nossa comunidade do Ai Verso. Você vai ser muito bem-vindo ou muito bem-vinda. Mas continuando aqui, eu também criei esse

**14:57** outro show real, na verdade esses outros dois. E o que eu fiz de diferente foi passar uma referência. Então eu peguei, utilizei aquela skill que você pode baixar gratuitamente, que a gente falou

**15:06** agora h pouco, mas eu passei além da skill o site do Ai Verso, que é o site que eu acabei de mostrar para você e pedi para ele fazer essas animações. E olha que legal, quando a gente integra

**15:15** uma skill com uma outra referência, que no caso aqui foi simplesmente o meu site. Olha o resultado que ele consegue entregar.

**15:24** Olha [música]

**15:37** a qualidade disso daqui. Isso aqui é muito legal. Você não tem ideia o tanto que era difícil e demorado e complicado para criar um negócio desse antes desse

**15:44** nosso grande modelo OP 5.5. Aí eu pedi para ele criar uma outra versão com base em uma pequena iteração que eu passei para ele. Pedi para ele corrigir umas

**15:52** coisas e aí o resultado que saiu foi esse daqui.

**15:58** [música]

**16:13** Olha, com poucas interações o que a gente consegue fazer e chegar nesse tipo de qualidade. Mas um outro uso que eu quero mostrar pr você sobre esse show reels é você criar, por exemplo,

**16:22** propagandas para alguma marca. Dá sua olhada que legal que ficou esse vídeo aqui.

**16:38** [música] [música]

**16:49** Isso aqui poderia ser facilmente um vídeo que você mesmo criou para uma marca como a Insider, por exemplo. E mais uma vez dá sua olhada como foi simples o prompt que eu passei para ele.

**16:57** Nesse caso aqui, eu pedi pr ele usar o Higped para criar essas imagens, mas isso aqui é um detalhe. Eu quis fazer para mostrar pessoas correndo, pessoas na praia praticando esporte para fazer

**17:06** propaganda sobre esse tipo de camiseta lá da Insider. E foi exatamente isso que eu pedi. Gostaria que eu fizesse um vídeo de 20 a 25 segundos mostrando algumas peças da Insider, marca de roupa. Veja que aqui eu nem passei o

**17:15** site. E se você olhar conforme foi passando as cenas, ele foi colocando o nome de cada peça no canto inferior esquerdo do vídeo. Ou seja, ele entrou no site, ele fez a pesquisa, ele entendeu qual que era o logo, qual que

**17:25** era a proposta e ele gerou o vídeo com esse prompt extremamente simples. E o mais legal sobre esse vídeo aqui é que veja que ele foi feito nesse formato para Instagram. E sim, todos os vídeos

**17:35** que ele criar, você pode pedir para ele fazer uma versão no formato do Instagram, que ele vai te entregar o mesmo vídeo, com a mesma qualidade nesse formato. E lembra que para você chegar nesse tipo de resultado, é muito

**17:44** importante que você peça pro modelo transcrever cada palavra, porque é ali que ele vai ver onde vai entrar o Motion Graphic, onde vai ser o corte de um vídeo, onde ele vai colocar uma batida diferente da música. Então, a

**17:53** transcrição, ela precisa estar perfeita. Pode confiar na ferramenta de transcrição do próprio cloud, pode fazer isso. Se quiser usar outras, fica à vontade, mas é importante ter a transcrição. Inclusive, reforça isso no

**18:04** promp que você for passar. Por favor, quero que você faça a transcrição com muita atenção, porque é com base nela que você vai fazer cortes, edições, inserções. Sempre reforçar isso no prompt ajuda a melhorar o resultado.

**18:13** Depois, outra parte muito importante, e sim o Hyper Frames faz isso já para você, é cortar o tempo morto, mas é importante que exista esse corte, principalmente para que ele consiga transitar de uma cena para outra e ali

**18:23** ele colocar uma inserção, ali ele mudar a batida da música. Ele entende os cortes como momentos onde ele tem que sincronizar, por exemplo, com o som que tá acontecendo no vídeo. Depois, o próximo passo vai ser justamente

**18:32** planejar os bits. Quanto mais claro combinado, mais perto do que você imaginou. Aqui é mandar um prompt, correto ou usar a nossa skill, porque ele já vai entender, vai saber ali exatamente como ele tem que fazer, que

**18:43** que ele tem que sincronizar, o que que tem que aparecer, como vai sincronizar com a sua fala, como que vai ser o sound design. Então ele já vai conseguir aplicar tudo para você. Depois a gente

**18:51** tem aqui o oito, skills que aprendem. É interessante que você baixa a skill que eu disponibilizei para você e vai pedindo para ele fazer do seu jeito, do jeito que você quer, com o design que

**19:01** você quer, no ritmo que você quer. E aí, conforme você for utilizando, é muito importante que você melhore essa skill. Todo aprendizado que você tiver fazendo seus showreels, peça paraa skill se

**19:10** atualizar e adicionar aqueles aprendizados nela, porque assim você vai ganhar muito mais tempo numa próxima vez, quando você for fazer um novo show, ele já vai entender exatamente qual é o padrão de entrega que você espera. Outra

**19:19** coisa muito importante é o loop de verificação, mas a boa notícia é que você não precisa se preocupar com isso, porque o próprio OP 5.5 faz esse loop de verificação. Você pede para ele

**19:27** entregar, ele vai fazer, ele vai criticar o próprio trabalho e ele só vai te entregar depois que ele fizer as correções que ele mesmo apontar. Então esse loop de verificação é um dos grandes responsáveis pelo ótimo

**19:37** resultado que o Opus entrega. No mais, agora eu quero saber de você, curtiu esse vídeo, te ajudou? Você vai colocar a mão na massa e criar show reels também? Deixa aí nos comentários que eu quero saber. Aproveito também e reforço

**19:47** que se você quer aprender a trabalhar de maneira profissional utilizando as IAS, principalmente para gerar sites, design, show reels, passa a câmera do seu celular no QC tá aparecendo aqui na tela e vem fazer parte do Aniverso. Lembra

**19:56** que lá além de curso, trilhas, você tem todas as minhas ferramentas, skills, toda a minha caixa preta que eu uso para criar as coisas aqui pro meu canal e pros meus clientes. Você vai ser muito bem-vindo e muito bem-vinda. No mais,

**20:06** peço para que você se inscreva aqui no canal, dê o hypar e o curtir no vídeo para ajudar que esse vídeo continue sendo entregue para mais pessoas. Eu vou deixar outro vídeo aqui, acho que é aqui

**20:13** mesmo, para você continuar aprendendo sobre inteligência artificial.
