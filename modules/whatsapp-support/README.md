# Atendimento no WhatsApp com IA e equipe

Para quem desenvolve um sistema e quer dar aos clientes dele atendimento pelo WhatsApp: um robô de IA responde o que sabe e passa para a equipe o que precisa de gente, e a equipe atende num painel completo, entrando com o mesmo login do sistema.

O app não instala nada em servidor. Ele traz a base pronta e a sua IA, aberta no projeto, leva essa base para o código, adapta às telas e às cores do sistema e diz o que só você faz.

## O que o seu cliente ganha

- **Atender no painel do Chatwoot**, com o nome, o logo e as cores do seu sistema, sem outro login: o botão "Atendimento" do sistema abre o painel já logado. Conversas, notas internas, etiquetas, respostas prontas, modelos da Meta e relatórios vêm prontos.
- **Conectar o número numa tela do sistema**: pela API oficial do WhatsApp (credenciais da Meta) ou pelo WhatsApp Web, lendo um QR, com o aviso de risco antes.
- **Configurar o robô numa tela do sistema**: como ele se apresenta, o que ele sabe, o horário da equipe, quando passa a conversa e quais dados do sistema ele pode consultar.
- **Escolher como o robô trabalha**: responde sozinho, só sugere a resposta numa nota interna para alguém da equipe enviar, ou fica desligado.

## Como o robô se comporta

- Responde só sobre o negócio do cliente, com o que está nas instruções, no conhecimento e nas consultas que o sistema liberou.
- Consulta dados do sistema só pelas consultas que você escreve, e só da própria pessoa da conversa.
- Passa para a equipe quando a pessoa pede, quando não tem certeza, quando o assunto pede decisão humana e quando algo falha.
- Funciona com a IA que você escolher: Claude, OpenAI e serviços compatíveis, Gemini, ou a IA do próprio sistema.

## O que você precisa ter

Um servidor com Docker, o domínio do sistema, o Platform App do Chatwoot (criado no primeiro acesso ao painel), a chave do provedor de IA e, na API oficial, a conta do cliente na Meta. A sua IA confere cada item no projeto e lista o que falta e é seu.

## Peça assim

> Implante o atendimento pelo WhatsApp com IA e equipe neste sistema, usando a API oficial, com o robô sugerindo as respostas para a equipe aprovar.

Outros pedidos: "Atualize o atendimento pelo WhatsApp para a versão nova do app", "Confira se o painel de atendimento está com as cores do sistema", "Esconda as campanhas e a central de ajuda do painel de atendimento".

## O que ele grava e onde

Numa pasta que a sua IA escolhe dentro do projeto, por exemplo `src/atendimento`:

- `base/`: o robô, a ligação com o Chatwoot e o OpenWA e o script de configuração do painel. Não se edita; a atualização troca.
- `modelos/`: as telas, as rotas e os arquivos de implantação, que a sua IA leva para o código do sistema e adapta.
- `escolhas.json`: a marca, o que esconder e o que acrescentar no painel.
- `gerado/`: o tema do painel, gerado das escolhas.
- `segredos/` e `conferencia/`: fora do git; os segredos vão para o cofre do ambiente de produção.
- `kit.json`: a versão instalada, que a atualização usa.

## Atualizar

Cada sistema atualiza quando você quiser. A sua IA confere o que mudou, troca a base, mostra o que mudou nas telas de modelo e roda as conferências de novo.

## Usa outros apps

Nenhum. O app conversa com o Chatwoot e o OpenWA que o seu sistema implanta.
