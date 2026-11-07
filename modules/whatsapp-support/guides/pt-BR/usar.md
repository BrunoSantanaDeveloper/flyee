# Atendimento no WhatsApp com IA e equipe

Este app é para quem desenvolve um sistema. Ele leva para o seu projeto o atendimento pelo WhatsApp dos seus clientes: um robô de IA que responde o que sabe e uma equipe que atende num painel completo, entrando com o login do seu sistema. A sua IA faz a integração no código; o app nunca instala nada em servidor.

## O que pedir

Abra a sua IA na pasta do sistema e peça:

> Implante o atendimento pelo WhatsApp com IA e equipe neste sistema, usando a API oficial, com o robô sugerindo as respostas para a equipe aprovar.

A IA lê o projeto, propõe um plano curto, pergunta só o que não deu para descobrir e faz a integração. No fim, ela lista o que só você faz: o servidor, o domínio, o primeiro acesso ao painel, a chave da IA e, na API oficial, a parte da Meta.

Para o suporte da própria plataforma, em que o sistema atende os clientes dele:

> Implante o suporte da plataforma pelo WhatsApp, com robô de IA e a nossa equipe, com o contexto do robô controlado só pelo superadmin.

Outros pedidos:

- "Atualize o atendimento pelo WhatsApp para a versão nova do app."
- "Confira se o painel de atendimento está no ar e com as cores do sistema."
- "Esconda as campanhas e a central de ajuda do painel de atendimento."
- "Mude o robô para responder sozinho."

## O que o seu cliente recebe

- O botão "Atendimento" no seu sistema, que abre o painel já logado, com o nome, o logo e as cores do sistema.
- Uma equipe por cliente, sem limite de atendentes: entra no painel só quem o sistema marca como equipe de atendimento, cada cliente vê só o que é dele, e quem sai da equipe sai do painel.
- A tela "Conectar WhatsApp": pela API oficial, com as credenciais da Meta, ou pelo WhatsApp Web, lendo um QR depois de aceitar o aviso de risco.
- A tela "Robô de atendimento": apresentação, instruções, perguntas e respostas, horário da equipe, quando passar para a equipe e quais dados do sistema o robô pode consultar.

## Quem controla o que o robô sabe

- No suporte da própria plataforma, tudo o que o robô sabe fica com o superadmin do sistema.
- Quando cada cliente do sistema atende os clientes dele, o superadmin escreve as regras que valem para todos e escolhe o que cada cliente pode mudar no robô dele.
- Nada é treinado: o robô lê o contexto a cada mensagem, e uma mudança salva vale em até um minuto.

## Como o robô trabalha

- Responde só sobre o negócio do seu cliente, com o que foi configurado e com as consultas que o sistema liberou.
- Vê dados só da própria pessoa da conversa.
- Passa para a equipe quando a pessoa pede, quando não tem certeza ou quando algo falha. Fora do horário, avisa que a equipe responde quando voltar.
- Pode só sugerir as respostas numa nota interna, para alguém da equipe revisar e enviar.
- Usa a IA que você escolher, inclusive a do próprio sistema.
- Aprende com a equipe, com aprovação: o que a equipe respondeu numa conversa que o robô passou adiante vira uma sugestão de pergunta e resposta, sem dado pessoal, que alguém aprova antes de valer.
- Mostra o que não soube responder, agrupado por assunto, para você saber o que acrescentar.

## Atualizar

Cada sistema atualiza quando você pedir. A IA mostra o que mudou e confere tudo de novo.
