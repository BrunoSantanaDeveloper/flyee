# Atendimento no WhatsApp com IA e equipe

Para quem desenvolve um sistema e quer dar aos clientes dele atendimento pelo WhatsApp: um robô de IA responde o que sabe e passa para a equipe o que precisa de gente, e a equipe atende num painel completo, entrando com o mesmo login do sistema.

O app não instala nada em servidor. Ele traz a base pronta e a sua IA, aberta no projeto, leva essa base para o código, adapta às telas e às cores do sistema e diz o que só você faz.

## O que o seu cliente ganha

- **Atender no painel do Chatwoot**, com o nome, o logo e as cores do seu sistema, sem outro login: o botão "Atendimento" do sistema abre o painel já logado. Conversas, notas internas, etiquetas, respostas prontas e modelos da Meta vêm prontos. Na nota interna, que o cliente nunca vê, a equipe chama um colega com @ e ele recebe o aviso no painel, na pasta Menções.
- **Grupos da equipe no painel**: a equipe conversa em grupos internos, como Comercial ou Suporte, vistos só por quem está em cada um, com etiquetas e menção com @. Quem cria os grupos é quem administra o atendimento, numa tela do sistema, e nada escrito neles vai para clientes.
- **Uma equipe por cliente**: entra no painel só quem o sistema marca como equipe de atendimento, sem limite de atendentes. Cada cliente tem a conta dele, com o número, as conversas e a equipe dele, separada dos outros. Quem sai da equipe sai do painel, e as conversas dessa pessoa voltam para a fila.
- **Conectar o número numa tela do sistema**: pela API oficial do WhatsApp (credenciais da Meta) ou pelo WhatsApp Web, lendo um QR, com o aviso de risco antes.
- **Configurar o robô numa tela do sistema**: como ele se apresenta, o que ele sabe, o horário da equipe, quando passa a conversa e quais dados do sistema ele pode consultar.
- **Escolher como o robô trabalha**: responde sozinho, só sugere a resposta numa nota interna para alguém da equipe enviar, ou fica desligado.
- **Grupos do WhatsApp para as equipes**: com o número conectado pelo WhatsApp Web, os grupos de que ele participa podem entrar no painel, cada um com o nome dele, para a equipe comercial, de suporte ou de contas atender ali. O robô fica calado no grupo ou responde só quando chamado pelo nome, e num grupo nunca consulta dados de ninguém.
- **Saber quando o número para**: o sistema confere o número a cada 15 minutos e avisa quem cuida dele quando cai, pede atenção ou volta. A tela mostra o que houve e o caminho de volta na mesma caixa, com o QR de novo ou o token novo da Meta, e as conversas continuam lá.

## Quem controla o que o robô sabe

- **Suporte da plataforma.** Quando o seu sistema atende os próprios clientes, há uma conta só, a equipe é a do sistema e tudo o que o robô sabe fica com o superadmin.
- **Atendimento de cada cliente.** Quando cada cliente do sistema atende os clientes dele, o superadmin escreve as regras que valem para todos (e ficam acima do resto) e escolhe o que cada cliente pode mudar no robô dele: apresentação, instruções, perguntas e respostas, horário, consultas, modo e grupos do WhatsApp.

Nada é treinado: o robô lê o contexto a cada mensagem, e uma mudança salva vale em até um minuto.

## Como o robô se comporta

- Responde só sobre o negócio do cliente, com o que está nas instruções, no conhecimento e nas consultas que o sistema liberou.
- Consulta dados do sistema só pelas consultas que você escreve, e só da própria pessoa da conversa.
- Passa para a equipe quando a pessoa pede, quando não tem certeza, quando o assunto pede decisão humana e quando algo falha.
- Lê fotos, prints, áudios, vídeos, também os longos, e arquivos: PDF, planilha, CSV e documento de texto. Só passa para a equipe quando não consegue. A transcrição do que foi falado fica numa nota para quem atende.
- Volta a atender quando a equipe resolve a conversa, ou quando ela fica 8 horas parada: a conversa se resolve sozinha e o robô responde à próxima mensagem do cliente. A conversa em que o cliente espera resposta da equipe continua na fila.
- Sai da conversa quando alguém da equipe responde, pelo painel ou pelo celular do número. O que é respondido pelo celular aparece no painel como "Celular do WhatsApp", com uma nota pedindo para registrar quem respondeu.
- Funciona com a IA que você escolher: Claude, OpenAI e serviços compatíveis, Gemini, ou a IA do próprio sistema.
- Aprende com a equipe, com aprovação: quando a equipe resolve uma conversa que o robô passou adiante, ele sugere uma pergunta e resposta nova, sem dado pessoal, e quem cuida do conhecimento aprova, edita ou descarta.
- Mostra o que não soube responder: um relatório agrupa por assunto as conversas que ele passou para a equipe.

## O que você precisa ter

Um servidor com Docker (dois sistemas podem dividir o mesmo servidor, cada um na sua instalação, separados), o domínio do sistema, o Platform App do Chatwoot (criado no primeiro acesso ao painel), a chave do provedor de IA e, na API oficial, a conta do cliente na Meta. A sua IA confere cada item no projeto e lista o que falta e é seu.

## Peça assim

> Implante o atendimento pelo WhatsApp com IA e equipe neste sistema, usando a API oficial, com o robô sugerindo as respostas para a equipe aprovar.

Para o suporte da própria plataforma:

> Implante o suporte da plataforma pelo WhatsApp, com robô de IA e a nossa equipe, com o contexto do robô controlado só pelo superadmin.

Outros pedidos: "Atualize o atendimento pelo WhatsApp para a versão nova do app", "Confira se o painel de atendimento está com as cores do sistema", "Esconda as campanhas e a central de ajuda do painel de atendimento", "O WhatsApp do atendimento parou de receber mensagens, veja o que houve".

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
