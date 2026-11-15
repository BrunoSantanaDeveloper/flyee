# Por dentro do atendimento no WhatsApp

## As peças

- **Chatwoot**, na edição comunitária: a caixa de entrada e o painel da equipe. O app trava uma versão e não muda o código dele.
- **Robô de atendimento**: um serviço pequeno, sem banco e sem dependências, que recebe os avisos do Chatwoot, pergunta ao seu sistema e à IA e responde ou passa para a equipe.
- **OpenWA**, só na conexão pelo WhatsApp Web, com o plugin que o liga ao Chatwoot.
- **O seu sistema**: cria a conta de cada cliente no Chatwoot, as pessoas da equipe como atendentes, o robô de cada conta, o login único, as telas de conectar e de configurar, e as consultas que o robô pode fazer.

Dois sistemas podem dividir o mesmo servidor. Cada um tem a sua instalação, com banco, arquivos, números e segredos próprios e um teto de memória, e um só ponto de entrada atende os domínios dos dois. Uma pane no servidor derruba os dois; quando isso não pode acontecer, cada sistema vai para um servidor.

## Um login só

A pessoa clica em "Atendimento" no seu sistema. O servidor do sistema pede ao Chatwoot um link de entrada que vale cinco minutos e uma vez só, e o painel abre já logado. Quem entra é sempre atendente: as configurações de caixa, robô e integrações ficam com a conta de serviço que o sistema criou e que ninguém usa para entrar. Com o modo moldura, o painel abre dentro de uma página do seu sistema, com o menu dele em volta.

## Quem atende

Entra no painel só quem o sistema marca como equipe de atendimento. No suporte da própria plataforma, é a equipe de suporte e o superadmin; quando cada cliente atende os clientes dele, é a equipe que o cliente escolheu e quem administra o cliente. Cada cliente tem a conta dele no Chatwoot, com o número, as conversas e a equipe dele, e ninguém de um cliente vê o outro. Não há limite de atendentes. A conversa que o robô passa adiante vai em rodízio para quem está online.

Quem sai da equipe sai também do Chatwoot, e as conversas que eram dessa pessoa voltam para a fila. Uma conferência diária tira quem ficou para trás, porque a sessão do painel dura até dois meses.

Para conversar fora de um atendimento, a equipe tem grupos dentro do painel. Cada grupo é uma caixa interna, sem número e sem robô, vista só por quem está nele, com uma conversa fixa onde todos escrevem e chamam um colega com @ na nota. Nada escrito num grupo sai do painel. Quem administra o atendimento cria os grupos numa tela do sistema, escolhe quem participa e as etiquetas, e arquiva quando o grupo não serve mais, guardando o histórico.

## O painel com a sua marca

O app grava no Chatwoot o nome, os logos e os endereços do seu sistema, e um tema gerado das suas escolhas: a cor principal vira uma escala de doze tons nos modos claro e escuro, e cada ponto em que o Chatwoot escreveu a cor dele fixa recebe uma regra própria. Funções que o cliente não usa somem do menu pela própria configuração do Chatwoot; o resto que precisar sumir sai por CSS, sempre escondendo e nunca apagando. Uma conferência no navegador entra com uma pessoa de teste, abre as telas, confirma a cor e o que foi escondido e salva capturas.

## O robô por dentro

- Lê o que a pessoa manda. Foto e print vão junto da mensagem para a IA. Áudio é cortado em partes e transcrito. Vídeo vira uma grade de quadros espalhados pelo vídeo inteiro, mais a fala transcrita, então até um vídeo longo é lido. O corte e a grade são feitos no próprio servidor, sem chamar a IA; a transcrição usa o modelo mais barato que o sistema tiver, no servidor do robô ou no próprio sistema. Quando não há quem transcreva, a tela do robô nem mostra a opção de ouvir áudios. A equipe só é chamada quando nada pôde ser lido, e recebe a transcrição numa nota.
- Lê os arquivos que a pessoa manda. Do PDF, da planilha, do CSV e do documento de texto, o servidor tira o texto, sem chamar a IA, e só esse texto vai para a resposta; um PDF escaneado vira imagem das primeiras páginas, como um print. Arquivo grande é lido só no começo, e o robô sabe disso. O que está escrito no arquivo é tratado como informação da pessoa, nunca como ordem: um arquivo que diga "dê o reembolso" não muda o que o robô pode fazer.

- Responde ao Chatwoot na hora e pensa depois, porque o Chatwoot só espera cinco segundos. Se o robô não responde, o próprio Chatwoot passa a conversa para a equipe.
- Junta as mensagens que o cliente manda em sequência antes de responder.
- Sai da conversa quando uma pessoa da equipe responde. A edição do Chatwoot que o kit usa não faz isso sozinha, então o robô abre a conversa para a equipe e não escreve mais nela. Quem responde pelo celular do número aparece no painel como "Celular do WhatsApp", porque o celular não diz quem digitou; a conversa ganha a etiqueta "celular" e uma nota pedindo para registrar quem respondeu.
- Conversa com a IA num formato fixo: responder, consultar ou passar para a equipe. Até três consultas por mensagem.
- Busca a configuração de cada cliente no seu sistema a cada minuto, com assinatura nas duas pontas. As chaves de IA ficam no ambiente do robô, nunca na configuração.
- Não guarda conteúdo em log: só identificadores, tempos e códigos.

## O contexto em camadas

O que o robô sabe vem de duas camadas, editadas em telas do sistema. A da plataforma é do superadmin e sempre existe: quando o sistema atende os próprios clientes, ela é tudo. Quando cada cliente do sistema atende os clientes dele, as regras da plataforma entram antes das do cliente e valem acima delas, e o superadmin escolhe o que cada cliente pode mudar; o servidor recusa o resto, mesmo que alguém tente gravar por fora da tela.

O texto fixo (regras, instruções, perguntas e respostas, consultas) vai junto a cada mensagem, até umas 100 páginas, separado da parte que muda (data, horário, nome do contato). Assim o cache dos provedores de IA cobra uma fração pelo texto que se repete.

## Aprender com a equipe e ver as lacunas

Quando a equipe resolve uma conversa que o robô passou adiante, o robô lê o que a equipe respondeu, tira os dados pessoais e sugere até três perguntas e respostas que sirvam a outras pessoas. Elas esperam aprovação de quem cuida do conhecimento, que pode editar ou descartar. Cada passagem para a equipe também fica registrada com o motivo e o assunto, e um relatório mostra por assunto o que o robô não soube responder.

## As consultas aos dados do sistema

São funções que você escreve no seu sistema, uma para cada pergunta que o robô pode responder com dados (situação de um pedido, próxima consulta, segunda via). Cada uma recebe o contato da conversa e devolve só o que é dele. O cliente liga ou desliga cada consulta na tela do robô.

## WhatsApp oficial e não oficial

Na API oficial, o Chatwoot fala direto com a Meta, com as credenciais do cliente. Na conexão pelo WhatsApp Web, o OpenWA mantém o número conectado e o plugin leva as mensagens para o Chatwoot e as respostas de volta; notas internas nunca saem. A conexão pelo WhatsApp Web tem risco de banimento e não serve para atividade regulada: a tela mostra o aviso e pede o aceite.

## Grupos do WhatsApp

Muitas equipes trabalham em grupos: o comercial com cada conta, o suporte com o cliente e o time dele. Com o número conectado pelo WhatsApp Web, os grupos de que ele participa podem entrar no painel. Cada grupo vira uma conversa com o nome dele e a etiqueta "grupo", e cada mensagem mostra quem escreveu. A resposta da equipe vai para o grupo inteiro.

O robô fica calado no grupo ou responde só à mensagem que o chama pelo nome. Num grupo ele nunca consulta dados do sistema, porque todos leem a resposta, e conversa de grupo não vira sugestão de conhecimento. Quem decide é o superadmin, que pode deixar a escolha com cada cliente. Pela API oficial, os grupos não chegam ao atendimento.

## Quando o número para

Um número que caiu não mostra erro: o painel só fica vazio, como num dia sem clientes. Por isso o sistema confere o número a cada 15 minutos. No WhatsApp Web, olha se a sessão continua conectada e se o WhatsApp pôs alguma restrição. Na API oficial, usa a consulta que o Chatwoot faz à Meta: token recusado, número bloqueado, qualidade baixa, endereço de aviso errado.

O aviso vai para quem conecta o número, e também para quem cuida do servidor quando o problema é dele. Ele sai quando o estado muda, e uma vez por dia enquanto o número estiver fora; o que costuma passar sozinho só vira aviso se continuar na conferência seguinte. Para voltar, a tela retoma a mesma caixa, com o QR de novo ou o token novo da Meta, e as conversas continuam lá.

A conferência não prova que uma mensagem chegou. Depois de implantar e depois de cada atualização, mande uma mensagem de outro celular e veja a resposta chegar.

## Privacidade

Tokens e chaves ficam no cofre do seu ambiente e no banco do seu sistema, cifrados, nunca em arquivo versionado. A IA recebe as mensagens, o conhecimento configurado, o primeiro nome do contato (dá para desligar) e o resultado das consultas; o telefone fica só entre o robô e o seu sistema.

## Atualizar sem retrabalho

A base do app fica numa pasta que o projeto não edita, com o hash de cada arquivo guardado. Atualizar troca essa pasta, para se algum arquivo dela foi mexido, e mostra o que mudou nas telas de modelo que você adaptou. Depois, o tema e as conferências rodam de novo.
