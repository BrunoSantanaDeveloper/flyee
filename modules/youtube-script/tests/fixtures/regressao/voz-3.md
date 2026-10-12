# Transcrição: Como Fazer Motion Graphics INSANOS com Opus 5.5

Felipe Borges - Fala IA! · https://www.youtube.com/watch?v=4wk7nTZler4
Origem: legenda automática do YouTube (pt-orig). 4937 palavras, cerca de 201 palavras por minuto. Tempos em MM:SS.

**00:00** Desde que o OP 5.5 foi lançado, as pessoas têm gerado vídeos insanos com esse modelo. Temos vídeos de lançamento de produtos, como esse daqui que você tá vendo, que é do Chain, que ele postou no

**00:10** X, onde ele criou esse avatar aqui animado, mostrando a plataforma, inclusive com dublagem. Então, esse avatar tá explicando como funciona a plataforma que ele tá divulgando e

**00:19** assim, sensacional o design disso daqui. O OP 5. Mostrando muito bem aqui o produto. Isso aqui ficou muito legal. Tem também esse

**00:28** vídeo daqui que é do Drill que ele postou no X. Olha a qualidade disso daqui. Olha a quantidade de detalhes que esse vídeo tem. É realmente

**00:35** impressionante a qualidade do desenvolvimento de vídeos do OPPO 5.5. Inclusive, se você me falasse que isso aqui era possível no começo desse ano,

**00:44** eu ia falar que você tá louco. Olha a quantidade de detalhes. É inacreditável pensar que o modelo hoje consegue chegar nesse nível de resultado. E junto com esses vídeos que a gente vê quase todos

**00:52** os dias nas redes sociais, vem sempre uma frase que às vezes até nos irrita, que é dizendo: "Eu fiz isso com o único prompt. Olha o que eu fiz em apenas 15 minutos. Olha o que eu fiz esse prompt

**01:01** de apenas três linhas. Mas a realidade é que quando você vê um vídeo assim e tenta replicar por conta própria, o que você consegue é um vídeo de A bem ruim e com cara de um vídeo totalmente

**01:11** genérico, que a gente conhece como Ai Slop. Isso acontece porque o prompt é responsável por apenas 10% do resultado.

**01:17** Os outros 90% é a forma com que você executa. Então, nessa aula aqui, nós vamos entender qual é a fórmula por trás desses motion graphics que estão viralizando e o que realmente é verdade

**01:27** sobre esse famoso único prompt e como você pode usar o opus 5. Para chegar muito mais perto desse tipo de nível de resultado. E no final dessa aula, você vai sim ser capaz de criar vídeos que

**01:36** até pouco tempo atrás provavelmente você nem imaginava que seria capaz de produzir, usando apenas o OP 5.5, sem nenhuma extensão, sem nenhuma ferramenta externa. Então, se isso te interessa, já

**01:46** pega o seu café e vamos logo pra aula. Mas antes de qualquer coisa, você precisa entender o funcionamento do OP 5. Para gerar as imagens, você vai ter aqui o seu brief, onde você vai passar

**01:55** um texto e boas referências. E se você já acompanha aqui o canal, você sabe, o tanto que eu bato na tecla, que se você quer ter um design bom, você precisa

**02:02** passar referências. Depois o OP 5. E aí ele pode tomar quatro caminhos diferentes. Isso aqui é importante para você entender que o Opus não vai

**02:10** conseguir escrever algo ali em MP4. Ele não vai te devolver de uma vez o vídeo em MP4. Ele vai precisar passar por esses quatro caminhos. E aí a gente tem

**02:18** essa maneira dele escrever isso tudo através de SVG ou headless Chrome. Além disso, a gente tem também Frameworks.

**02:25** Ele poderia trabalhar com remotion ou hyperframes ou também com um pipeline misto, que seria, por exemplo, imagens mais modelos de vídeo. E aí o Opus vai fazer toda essa composição. Por fim, ele

**02:34** consegue também, a depender do seu prompt editar o seu vídeo. Então ele pode fazer cortes, ele pode colocar legendas, brows, pip e o pip é esse quadradinho igual eu tô aparecendo aqui

**02:44** embaixo. Ficar esse quadradinho do lado da tela. ele consegue fazer tudo isso para você. Já te adianto que para criar os motion graphics, a melhor maneira

**02:51** possível de fazer isso é aqui nessa primeira camada, onde ele não vai utilizar nem o remotion Frames, que são duas bibliotecas que ficaram muito

**03:00** famosas porque elas justamente serviam muito bem para modelos antigos. elas faziam que o resultado ficasse um pouco melhor. Só que isso não é mais verdade.

**03:08** Aqui no Opus 5. A melhor maneira dele trabalhar é ele puro, ele escrevendo esse código do jeito dele. Mas o importante é que depois de um desses

**03:16** quatro caminhos que ele seguir, ele vai fazer o render disso em MP4. E aí sim você vai ter o seu vídeo. Aliás, para gerar todos os resultados que a gente

**03:24** vai ver nesse vídeo, eu usei essa documentação justamente porque eu fiquei com a Pulga atrás da orelha. Eu vi tantos posts de vídeos tão incríveis que eu falei, quero seguir exatamente o que

**03:34** tá dizendo aqui e vamos ver o que de fato funciona. E foi isso que eu fiz. Eu juntei tudo isso e é exatamente dessa maneira que eu vou passar para você. Mas se você tiver curiosidade para ver todo

**03:42** o material, eu vou deixar o link aqui embaixo para você poder acessar e ver a aula completa aqui, todas as explicações e todos os exemplos. E justamente pra gente ver o resultado de você deixar o

**03:51** modelo trabalhar da maneira mais simples possível, a gente tem esse vídeo aqui que foi gerado pelo nosso amigo Tommy de Rossy. E o mais interessante aqui é que ele explica como ele chegou nesse

**04:00** resultado. O OPO 5.5 é realmente incrível, pois coloca todo o código em único arquivo index.html e rederiza usando o playrght quadro a quadro em uma

**04:08** janela sem interface gráfica. Depois usa o FFMPEG para gerar o MP4, que é exatamente aquele primeiro fluxo que a gente acabou de ver, que é a maneira

**04:16** como o Opus mais gosta de trabalhar. E ele mesmo diz isso: "O modelo parece preferir fazer tudo do zero, sem dependências, em vez de usar ferramentas como o remotion, EGAC ou Hyperframes, ou

**04:26** seja, para chegar nos melhores resultados de acordo com ele, de acordo com o que a gente entende como o Opus funciona. Essa daqui é a melhor maneira.

**04:33** Mas a boa notícia é que para você utilizar esse primeiro caminho, basta que você simplesmente envie seu prompt para ele, porque já vai ser a preferência do Oppul 5.5 seguir por

**04:42** aqui. Mas cuidado porque se você tiver o Remotion ou Hyper Frames instalado aí junto com o seu modelo, ele pode já pular direto para esse framework aqui e aí você não vai obter os melhores resultados. E para você ver a diferença

**04:53** de resultado e qualidade que a gente consegue obter, eu mandei esse prompt simples pedindo para ele criar um vídeo de 10 segundos de um app de delivery acompanhando o pedido. O pedido é

**05:02** confirmado, a moto sai do restaurante, atravessa o mapa, enfim, tá tudo aqui. Pedi para ele salvar como teste cru. E eu tive que avisar, não use o Hyper Frames nem nenhuma skill, crie da sua maneira natural, porque como eu disse,

**05:11** eu tenho Hyper Frames aqui. O resultado que ele me entregou foi esse. Dá só uma olhada na qualidade do que ele conseguiu entregar. Isso aqui ficou muito legal, muito dinâmico, o vídeo muito bom mesmo.

**05:21** Agora com um prompt extremamente simples, a gente já chega nesse resultado. Imagina quando a gente melhorar ainda mais esse processo. E para você ver a diferença, se ele tivesse utilizado o Hyper Frames, eu

**05:30** abri o meu GPT6 Astra e pedi para ele criar com o mesmo prompt, a mesma coisa, porém agora usando Hyper Frames, o resultado que ele me entregou foi esse

**05:39** daqui. Particularmente eu preferi muito o do Opus. Olha só, ele também teve essa mesma ideia de mostrar a entrega sendo feita, mas perceba que, por mais que

**05:48** tenha ficado bom, ele ficou mais simples, mas como nosso objetivo é chegar no melhor resultado possível, ainda dentro daquele material que a gente tá seguindo, temos aqui o motion

**05:58** stud rules, que são as regras para melhorar o resultado que ele te entrega. E essas regras elas falam sobre como fazer o render. Então ele tá auxiliando para fazer o render de uma maneira

**06:07** melhor, com mais qualidade. Ele também tem algumas regras de aparência para evitar ali aquele padrão genérico, aquela cara que foi feito por IA, o famoso EA Slop. Ele também tem aqui

**06:17** diretriz falando sobre o som e o principal, fazer um loop antes de mostrar qualquer coisa. Então faz o render, depois dá uma nota de 1 a 10, você depois vai consertar as os três

**06:26** piores problemas, vai repetir isso até com que todos os scores estejam acima de oito só depois. Então ele vai fazer o render total para que você consiga ver todo o vídeo. Assim ele garante que ele

**06:35** vai ficar fazendo render, gastando token e tempo para entregar algo ruim para só depois fazer a correção. Isso daqui ajuda demais a melhorar os seus resultados. E para você ter acesso a

**06:44** isso, óbvio que eu já vou deixar separado também na comunidade. Basta você entrar na nossa comunidade gratuita e já pegar isso aqui prontinho. Só para

**06:51** você vir aqui, copiar, abrir o seu cloud code e colar esse comando. Esse comando você vai pedir para ele criar um

**06:59** cloud.m. aquele documento que sempre que o modelo abre a pasta, ele é obrigado a ler com essas instruções. Ou seja, a partir do momento que você pedir para

**07:07** ele criar um cloud. MD com o que tá escrito aqui, sempre que o modelo for criar qualquer motion design para você, nesta pasta que você instalou, cloud.md, MD, ele vai ler todas essas instruções

**07:17** antes e vai já te entregar um resultado bem melhor. E uma vez que esse documento foi criado, o nosso próximo passo é dar o mesmo prompt para ver o que que ele consegue entregar de maneira diferente.

**07:26** Então, veja que aqui ele é exatamente o mesmo prompt que eu passei anteriormente antes de ter o cloud.m na pasta. A única coisa que eu pedi para ele é avisar que é um projeto novo, para ele salvar tudo

**07:35** isso em uma outra pasta, para que ele não olhe para aquele vídeo que já foi criado antes, que tá dentro dessa mesma pasta, e acabe alterando ele. Enfim, eu quero que ele crie um projeto novo.

**07:43** Então, perceba que aqui não tem nada além da instrução que eu já tinha passado anteriormente, além dessas questões de onde ele vai salvar esse vídeo. E olha a diferença, veja que eu

**07:51** só mandei aquele prompt e olha como o vídeo já melhorou assim absurdamente. Olha esse detalhe como ficou legal.

**07:59** [música] >> [música]

**08:08** >> Pelo amor de Deus, olha como isso aqui ficou bom. Isso aqui é obra de arte pura. Eu adoro fazer isso porque os resultados ficam muito legais. Agora, além daquele vídeo que a gente acabou de ver, eu também fiz outro teste e pedi

**08:19** para ele criar um vídeo de motion graphics dinâmico de 15 segundos que mostre um motion designer incrível que o próprio modelo é, como se fosse o seu show real para um currículo. Vai com

**08:27** tudo, salva isso com esse nome aqui, outras instruções para salvar tudo, para ele não usar também o hyper frames nem nenhuma skill. E aqui a única coisa que eu adicionei foi: "Siga as instruções do cloud.md só para garantir". Mas é um

**08:38** documento que sempre que o modelo entrar na pasta, ele já lê automaticamente. E o resultado que a gente tem é exatamente esse daqui. [música]

**08:53** [música] Olha a qualidade que ele entrega isso daqui. Olha a quantidade de movimento.

**09:03** Olha a quantidade. Olha como o som tá simplesmente sincronizado com cada um desses movimentos. Olha como ele consegue aumentar bastante a complexidade de cada um desses movimentos. Aqui só tem um único

**09:13** problema. E se você olhar, você vai dizer: "Poxa, as cores" é uma cor meio genérica, meio padrão do cloud, certo? Certo. E por mais que a gente tenha

**09:20** passado um cloud.m, isso aqui ainda tá com leve cheiro, talvez de A. Pode ser. Mas aqui, lembra que a gente criou tudo agora sem passar referências? E é lógico

**09:29** que o próximo passo que a gente vai ver para tornar isso aqui ainda melhor é passar boas referências. E dá só uma olhada nesse prompt aqui. Veja que eu já começo passando a referência para ele, o

**09:39** vídeo que eu quero que ele se inspire. E sim, já vou te mostrar com esse vídeo e também já vou te mostrar o ouro escondido que eu encontrei um site com vídeos motion graphics feitos com op

**09:48** 5.5. Então é o ouro que eu vou entregar, mas aguenta aí que eu já te mostro. Depois eu pedi para ele baixar o vídeo e eu pedi também para que ele analisasse o site do Not Show e com base nisso

**09:58** fizesse a adaptação dessa referência, porém mostrando o not, o site, as aplicações, como que funciona o Nion.

**10:05** Então, através dessa referência que eu passei, que por sinal é esse vídeo aqui, veja um vídeo que tá no próprio X que eu peguei como referência. Então eu quero

**10:13** que ele use esses movimentos, esse design, porém explicando o not funciona o aplicativo, ele me entregou em um único prompt também este resultado que

**10:22** você vai ver agora. [música]

**10:37** [música] Ah, isso ficou legal demais, né? Ele já tem dentro dessa pasta aquele cloud.md com todas as instruções e o resultado

**10:46** que ele entregou foi esse. Pode ver com apenas um único prompt e pedindo aqui única coisa de diferente, reforçando para que ele não utilize hyperframes ou nenhuma skill. Ou seja, trabalhe da

**10:55** maneira que você gosta de trabalhar, faça do seu jeito e aí ele é capaz de entregar esse tipo de resultado. Agora, se você tá curtindo tudo que eu tô te mostrando aqui, saiba que a gente ainda

**11:03** tem muita coisa legal para ver. Mas eu já te adianto que tudo isso aqui que você tá vendo e aquilo que você ainda vai ver já virou uma skill e um pacote

**11:12** de instruções que eu estou disponibilizando para quem fizer parte do AI Verso. Se você não sabe o que é o

**11:17** AIO, o AIso é a minha comunidade onde lá dentro eu disponibilizo todas as minhas skills, ferramentas, absolutamente tudo

**11:26** que eu uso para criar sites daqueles com efeito de scroll, como esse daqui, por exemplo, sites que são totalmente interativos. Tudo que eu uso para criar, todos os meus segredos, sem exceção,

**11:34** estão lá dentro, mas também como criar motion graphics, como esses que você tá vendo aqui e os que você tá vendo na própria aula. Além de você ter acesso às duas ferramentas que eu considero as

**11:44** coisas mais legais de dentro do Ai Verso, que é o Design Studio e o Premiere Hey. Premiere Ray para você editar seus vídeos usando o Premiere de uma maneira muito fácil e o Design

**11:52** Studio para você criar justamente suas páginas, seus sites, suas imagens, tudo em um único lugar já otimizado com as minhas skills. Lógico que além disso

**11:59** você também leva um curso completo de Cloud Code, de Google Antigravy, de N8N e também alguns dos meus agentes de atendimento para Instagram, para

**12:08** WhatsApp, tudo isso já incluso na comunidade, além de você poder trocar ideia comigo e fazer parte de uma comunidade onde tá sempre em evolução, sempre que aparece alguma coisa nova,

**12:17** alguma dica, alguma skill nova como essa dessa aula, eu coloco lá na comunidade. Se você se interessou, quer trabalhar de maneira profissional utilizando essas ferramentas, passa o celular no QRC tá aparecendo aqui na tela e vem fazer

**12:26** parte do Everso. Se vai ser muito bem-vinda e muito bem-vindo. Mas voltando aqui pro nosso vídeo, pra gente deixar o negócio ainda mais legal, nós

**12:35** temos aqui este outro prompt que a gente pode simplesmente copiar, colar e só alterar algumas coisas muito específicas

**12:42** aqui, como por exemplo o produto que a gente quer mapear e também a URL. E este prompt vai ajudar justamente a quebrar, por exemplo, no nosso caso aqui, o Notion, entender cada etapa do Notion e

**12:53** gerar um vídeo ainda melhor. E colando esse prompt, já traduzindo ele pro português, o que eu tô pedindo aqui é para fazer um vídeo de motion graphic dinâmico de 20 segundos para o Notion com a energia do show real de um motion

**13:02** design. Vai com tudo, que é o mesmo promp que a gente passou, porém aqui eu tô passando materiais. Visite o site, use captura de telas reais utilizando Playwright, a logo real, as cores, as fontes reais, salva tudo no

**13:12** notion/assets e lista o que você encontrou antes de animar. Aqui ele tá passando exatamente como que eu quero a história do vídeo. Aqui nós temos também o som, como que eu quero música original

**13:21** numa batida de 120 bpm. E aqui o formato, que aqui no caso nós temos dois, o 16x9, que é o vídeo horizontal,

**13:27** e nós temos também o 9x16. Você pode, inclusive colocar nesse promptis, um formato só, vários formatos, você que sabe. Quando a gente utiliza esse

**13:37** prompt, a gente chega num resultado ainda mais legal. E se você tiver dificuldade com isso, você pode pedir pro próprio Cloud te ajudar. por favor, me ajude a criar uma história que fique interessante para esse vídeo. Inclusive, foi isso que eu fiz, tá? Eu pedi para

**13:47** ele me ajudar a criar história numa outra conversa. Depois que ele me gerou, eu colei aqui e fiz essa adaptação. Então, eu não tive trabalho nenhum para fazer. E olha o resultado como ficou legal.

**13:59** [música] Eu

**14:16** não consigo me segurar porque cada resultado fica mais legal que o outro. Bom, não preciso nem dizer que o resultado que a gente chegou aqui já tá sensacional, mas claro, você pode ter

**14:26** sua opinião e pode não ter gostado do exemplo que eu passei, da referência que eu passei para chegar nesse resultado. A boa notícia que eu te trago aqui é essa, este site aqui, o link vai estar

**14:36** disponibilizado também aí sim na comunidade gratuita, onde você pode acessar a parte gratuita desse material e você pode ter acesso a todos esses

**14:44** exemplos de vídeos criados com o OP 5. Eles vão estar aqui embaixo do vídeo para você conseguir acessar também. E assim que você encontrar algo que você

**14:52** goste, por exemplo, esse vídeo aqui, você pode pedir para que ele entenda esse vídeo usando os promets que a gente já viu, quebre ele, entenda e crie algo com base na sua marca ou no produto que

**15:02** você tá querendo criar o seu motion graphic com base nessa estrutura, nesse design. E o mais legal é que todos eles são vídeos que estão postados no X.

**15:10** Inclusive, se você quiser ver a postagem original, basta clicar aqui, original on X. Ele vai abrir o post com quem postou, tudo que fez e assim você também

**15:19** consegue conhecer novos perfis de pessoas que ficam criando esse tipo de vídeo para você pegar ainda mais ideia.

**15:25** Então isso aqui é uma mina infinita de ideias e boas referências para você criar seus motion graphics. E só para você ter uma noção básica aí da capacidade de ganho que você pode ter

**15:34** construindo esse tipo de coisa, olha só que interessante essa postagem desse Tony Dean aqui no X. Apenas um ano atrás eu paguei mais ou menos. 1.000 por um vídeo como esse. Agora eu faço isso no

**15:44** OP 5.5 em menos de 30 minutos. E ele tá mostrando um vídeo aqui institucional dele, mostrando provavelmente a plataforma que ele é dono ou que ele faz ali a propaganda e a divulgação. Então,

**15:53** presta atenção o tanto que isso era difícil, mas também a oportunidade que você tem hoje de criar vídeos como esse e fazer vendas. você consegue

**16:02** literalmente fazer esses vídeos em meia hora e vender por um bom dinheiro ou até mesmo aplicar pro seu negócio, pra sua empresa, pro seu canal, que é o que eu faço aqui no YouTube e que eu faço também para os meus clientes. Agora,

**16:12** tudo isso é muito legal, mas muitas vezes a gente vai precisar de uma constância na nossa produção. Ou seja, imagina que eu criei um vídeo para uma

**16:19** empresa hoje, amanhã eu preciso criar um novo vídeo. Eu preciso que eu tenha todos esses dados salvos no arquivd em

**16:28** MarkD. Então é muito importante, muito importante mesmo que você sempre que termine um trabalho, goste do resultado, peça para que o próprio modelo já salve

**16:38** algumas informações importantes, como logo, tipografia, sistema de design, tudo isso pode ser um arquivo. PMD igual cloud.md é um arquivo em texto, pode ser também com todas essas especificações.

**16:48** Não confundo o cloud.md MD com as instruções que a gente passou com esse outro documento. Esse outro documento vai ser uma próxima fase onde você vai

**16:55** ter construído, aprovado, gostado do design e pede para ele guardar o logo, a tipografia, o design, as cores, para que quando for criar um outro exemplo, mesmo

**17:05** que você passe uma referência, ele vai utilizar a mesma fonte, a mesma cor, a mesma logo e aí com isso você consegue criar ali um padrão de entrega, porém é uma entrega muito boa. Essa é a primeira

**17:15** coisa. A segunda coisa é que se a gente quiser melhorar no nível máximo e não deixar nenhuma brecha pro US talvez cometer algum erro, a gente precisa de

**17:24** um prompt extremamente completo. E esse daqui, de tudo que eu vi, foi onde eu consegui os melhores resultados e onde eu acho que eu consigo garantir mais

**17:33** estabilidade nas entregas. Ou seja, aqui eu consigo passar uma diretriz muito boa, que eu sei mais ou menos conduzir para um resultado que eu quero que ele entregue, sem que eu fique

**17:43** supervisionando muito modelo e aí ele acabe perdendo qualidade. Neste caso, o prompt é esse daqui, ele tá traduzido para português e a ideia é a mesma. A gente vai dar as entradas. Então o

**17:52** produto vai ser o Notion. Usa como a frase do produto o título principal do site, pega logo real, as cores da marcas, as fontes e lembra que se você já tem isso, já fez esse projeto, você

**18:01** vai ter isso numa pasta, a logo real da empresa que você tá trabalhando, as cores da marcas, as fontes. Então é importante a gente passar isso para ele.

**18:07** Ele já tem essa fonte para buscar, que é o próprio site do Notion, e ele também tem a memória dos outros projetos que a gente acabou criando anteriormente. Aqui a gente também tem falando sobre a música, sobre o formato e a gente pode

**18:16** alterar e adicionar formatos aqui. Mas o mais importante de tudo isso e é exatamente a parte que eu mais gosto, é essa parte da direção, onde a gente

**18:24** consegue passar boas especificações. E aqui, novamente, Felipe, não tem uma boa ideia como que eu vou escrever esse prompt, como que eu vou passar um bom direcionamento. Antes de criar este

**18:33** prompt, abre uma outra conversa no cloud e fale com ele. Olha, eu quero criar um vídeo. A ideia do vídeo é XYZ. Eu quero que ele tenha essa batida, essa animação. Vídeo mais animado, mais

**18:42** tristes, mais alegre. Qual é a emoção que você quer passar? Como que você pensa? imaginou esse vídeo que seria legal? Pode inclusive utilizar referências para falar: "Olha, eu quero

**18:50** algo mais ou menos assim". E aí com base nisso, você vai pedir pro cloud te ajudar a criar essa parte aqui. Você pode colar todo o prompt para ele e falar: "Olha, eu preciso definir essa parte da direção para um próximo vídeo

**19:01** que eu tô querendo criar". Aí você explica tudo, como eu acabei de falar, e aí você já consegue montar essa parte da direção. Já essa outra parte aqui que tá começo, me mostra a lista de estados na grade da batida em tabela antes de

**19:12** escrever o código. Quando eu aprovar, renderiza e salvo em resultados. Aqui, tá? o arquivo que eu pedi para ele salvar. O que que são essas batidas? É ele passar justamente todo o vídeo quebrado, já inclusive falando do som,

**19:22** como que vai ser pra gente analisar toda essa tabela. Por quê? Porque se eu não gostar de alguma coisa, eu quiser alterar alguma coisa, fica mais fácil de eu fazer isso daqui do que eu esperar

**19:30** ele renderizar tudo novamente. Então isso aqui ajuda bastante, é uma saída bem interessante. Uma vez então que a gente gosta, a gente pode pedir para ele renderizar, que foi o que eu fiz aqui. E

**19:39** aí ele entregou esse resultado e também a tabela com todas as imagens. Mas dá uma olhada na qualidade que a gente conseguiu obter aqui. [música]

**19:52** [música] [música]

**20:01** Percebe que a gente conseguiu um resultado com um áudio muito mais sincronizado com aquilo que tá acontecendo no vídeo, muito mais sutil, muito mais legal. Isso passa também

**20:11** muito por esse prompt. Esse daqui, como eu disse, é o melhor prompt que eu encontrei. Os melhores resultados que eu tô tendo com esse modelo é utilizando esse prompt bem detalhado, mas como você

**20:20** pode ver, todos funcionam. Eu aconselho que você utilize esse por ser mais completo e a gente conseguir também um resultado bem legal, como a gente acabou de ver. Inclusive, nesse vídeo aqui que

**20:28** a gente tem do Onur Oscan, acho que é assim que se pronuncia, ele fez um vídeo que ficou muito legal e uma das partes que tornou esse vídeo muito legal é justamente o áudio. O vídeo que ele fez

**20:38** foi contando a história do Steve Jobs. E olha como o áudio sincronizado fez toda a diferença pra dinâmica desse vídeo.

**21:02** Além daquele vídeo, a gente tem esse outro que eu gosto bastante e que o áudio também é uma parte fundamental da qualidade desse vídeo. [música] [sino]

**21:15** [música] [música]

**21:23** Agora, se você quer saber até onde o Opus 5. Esse daqui é um dos melhores exemplos que eu posso te mostrar.

**21:32** Já adianto, eu não vou fazer isso. Eu não fiz porque como a gente pode ver, esse cara, o Donald tá dizendo, eu fiz isso com o único comando usando OP 5.5.

**21:41** Falei com o meu computador por 5 minutos, ou seja, um prompt de 5 minutos e o Cloud trabalhou por 12 horas até entregar isso daqui. E aí ele foi dormir e acordou e o resultado tinha sido esse.

**21:50** E antes de eu te mostrar esse vídeo que ficou sensacional, olha o tamanho do prompt que ele mandou. Ele disponibilizou tudo aqui pra gente. E

**21:58** aqui tem inclusive o material que ele utilizou, tá no github dele, se você quiser fazer esse vídeo. Inclusive ele usou esse daqui como referência. E com

**22:07** isso ele chegou nesse resultado aqui, que é uma música que ele criou um estilo um pouco de anime com essa moça cantando essa música. Eu aconselho que você escute essa música porque ficou bem

**22:18** legal. Não foi ele que criou a música, mas foi ele que criou o clipe. E o clipe vai representando tudo aquilo que tá sendo cantado na música. Eu não vou colocar a música inteira aqui por problemas possíveis de direitos

**22:27** autorais. Vou deixar só um trechinho para você ver. [música]

**22:38** E assim o resultado disso aqui ficou impressionante. O exemplo que ele tinha pego era justamente a própria música,

**22:45** que o clipe original teoricamente era esse daqui. Dá uma olhada como é uma arte impressionante já desde o videoclipe original. Ele pegou isso aqui

**22:54** como referência, principalmente pela parte da música, e gerou aí um novo videoclipe. E a gente chegou nesse resultado impressionante. 5 minutos de

**23:03** prompt falado, 12 horas do cloud trabalhando e esse tipo de resultado aqui. Aliás, lembra que eu falei que o Ex é um ótimo lugar para você encontrar não só vídeos, mas como pessoas que

**23:13** produzem esses vídeos. Se você entrar aqui no canal do Donald, ele fica criando várias coisas aqui com IA. Você pode pegar várias boas ideias e boas referências aqui com ele, inclusive o

**23:22** próprio clipe dele, caso você queira aí gastar alguns milhares de reais em tokens para recriar esse videoclipe.

**23:29** Essa aqui foi nossa aula sobre motion design da maneira mais completa possível. Eu estudei todo esse material, eu apliquei e de fato os melhores resultados que eu obtive foi utilizando

**23:38** exatamente esse processo que eu acabei de mostrar para você. Todo o material que eu utilizei como referências e fontes, você pode consultar na comunidade gratuita. E se você quiser o

**23:48** pacote completo de skills que eu utilizei não só para esse vídeo, mas que eu utilizo pro meu próprio canal, pros meus clientes, todas as minhas ferramentas, a minha caixa preta aberta

**23:56** para você ter acesso a tudo aquilo que eu realmente utilizo profissionalmente, você pode então passar a câmera do celular no QCE, tá aparecendo aqui na tela e vi fazer parte do e verso da nossa comunidade. Você vai ser muito

**24:06** bem-vindo e muito bem-vinda. No mais, peço que se você tenha curtido esse vídeo, deixa o like, principalmente deixa o hypar, porque esse vídeo continua sendo entregue para mais pessoas. É um jeito aí de graça de você

**24:15** me ajudar e ajuda demais aqui o canal ao fazer isso. Também peço para você se inscrever porque todas as semanas saem vídeos novos sobre inteligência artificial e inclusive vou te deixar um outro vídeo aqui de indicação para você

**24:25** assistir e continuar aprendendo mais sobre IA. Com isso, eu vou me despedindo de você. Nos vemos no próximo vídeo. Um grande abraço e falou. Mm.
