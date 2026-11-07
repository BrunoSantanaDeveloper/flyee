# Por dentro do atendimento no WhatsApp

## As peças

- **Chatwoot**, na edição comunitária: a caixa de entrada e o painel da equipe. O app trava uma versão e não muda o código dele.
- **Robô de atendimento**: um serviço pequeno, sem banco e sem dependências, que recebe os avisos do Chatwoot, pergunta ao seu sistema e à IA e responde ou passa para a equipe.
- **OpenWA**, só na conexão pelo WhatsApp Web, com o plugin que o liga ao Chatwoot.
- **O seu sistema**: cria a conta de cada cliente no Chatwoot, as pessoas da equipe como atendentes, o robô de cada conta, o login único, as telas de conectar e de configurar, e as consultas que o robô pode fazer.

## Um login só

A pessoa clica em "Atendimento" no seu sistema. O servidor do sistema pede ao Chatwoot um link de entrada que vale cinco minutos e uma vez só, e o painel abre já logado. Quem entra é sempre atendente: as configurações de caixa, robô e integrações ficam com a conta de serviço que o sistema criou e que ninguém usa para entrar. Com o modo moldura, o painel abre dentro de uma página do seu sistema, com o menu dele em volta.

## O painel com a sua marca

O app grava no Chatwoot o nome, os logos e os endereços do seu sistema, e um tema gerado das suas escolhas: a cor principal vira uma escala de doze tons nos modos claro e escuro, e cada ponto em que o Chatwoot escreveu a cor dele fixa recebe uma regra própria. Funções que o cliente não usa somem do menu pela própria configuração do Chatwoot; o resto que precisar sumir sai por CSS, sempre escondendo e nunca apagando. Uma conferência no navegador entra com uma pessoa de teste, abre as telas, confirma a cor e o que foi escondido e salva capturas.

## O robô por dentro

- Responde ao Chatwoot na hora e pensa depois, porque o Chatwoot só espera cinco segundos. Se o robô não responde, o próprio Chatwoot passa a conversa para a equipe.
- Junta as mensagens que o cliente manda em sequência antes de responder.
- Conversa com a IA num formato fixo: responder, consultar ou passar para a equipe. Até três consultas por mensagem.
- Busca a configuração de cada cliente no seu sistema a cada minuto, com assinatura nas duas pontas. As chaves de IA ficam no ambiente do robô, nunca na configuração.
- Não guarda conteúdo em log: só identificadores, tempos e códigos.

## As consultas aos dados do sistema

São funções que você escreve no seu sistema, uma para cada pergunta que o robô pode responder com dados (situação de um pedido, próxima consulta, segunda via). Cada uma recebe o contato da conversa e devolve só o que é dele. O cliente liga ou desliga cada consulta na tela do robô.

## WhatsApp oficial e não oficial

Na API oficial, o Chatwoot fala direto com a Meta, com as credenciais do cliente. Na conexão pelo WhatsApp Web, o OpenWA mantém o número conectado e o plugin leva as mensagens para o Chatwoot e as respostas de volta; notas internas nunca saem. A conexão pelo WhatsApp Web tem risco de banimento e não serve para atividade regulada: a tela mostra o aviso e pede o aceite.

## Privacidade

Tokens e chaves ficam no cofre do seu ambiente e no banco do seu sistema, cifrados, nunca em arquivo versionado. A IA recebe as mensagens, o conhecimento configurado, o primeiro nome do contato (dá para desligar) e o resultado das consultas; o telefone fica só entre o robô e o seu sistema.

## Atualizar sem retrabalho

A base do app fica numa pasta que o projeto não edita, com o hash de cada arquivo guardado. Atualizar troca essa pasta, para se algum arquivo dela foi mexido, e mostra o que mudou nas telas de modelo que você adaptou. Depois, o tema e as conferências rodam de novo.
