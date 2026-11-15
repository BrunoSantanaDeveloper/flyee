# Segurança e privacidade

## Segredos

| Segredo | Onde fica | Quem usa |
|---|---|---|
| `CHATWOOT_PLATFORM_TOKEN` | cofre do servidor do projeto | o projeto, para contas, pessoas e login único |
| tokens da conta de serviço, do robô e da pessoa de repasse, e o segredo do robô | estado de cada cliente no banco do projeto, cifrado | o projeto; o robô recebe os do robô pela rota config, assinada |
| `SUPPORT_BOT_SECRET` | cofre do projeto e do robô, o mesmo valor | assinatura entre os dois |
| chaves dos provedores de IA | ambiente do robô | o robô |
| `API_MASTER_KEY` do OpenWA | ambiente do OpenWA e cofre do projeto (`OPENWA_API_KEY`) | o projeto |
| token permanente da Meta | dentro da caixa do Chatwoot (o Chatwoot cifra quando a cifragem está configurada) | o Chatwoot |
| `SECRET_KEY_BASE`, senhas do Postgres e do Redis | ambiente do Chatwoot | o Chatwoot |

Nenhum vai para escolhas.json, kit.json, log, chat ou commit. Os scripts do kit nunca imprimem valores; dizem o nome do que falta.

## Assinaturas

- Chatwoot para o robô: HMAC com o segredo do robô da conta, janela de 300 segundos, entregas repetidas descartadas.
- Chatwoot para o OpenWA: HMAC com o segredo do webhook da conta, conferido pelo próprio OpenWA.
- Robô para o projeto: HMAC com `SUPPORT_BOT_SECRET`, cobrindo método e caminho.

Por isso os avisos andam por endereços públicos e `SAFE_FETCH_ALLOW_PRIVATE_NETWORK` fica desligado em produção.

## Quem pode o quê

- A equipe do cliente é atendente. Administrador é só a conta de serviço, que ninguém usa para entrar.
- Um grupo da equipe é visto só pelos membros dele, e nada escrito nele sai do painel (chatwoot.md, "Grupos da equipe"). Quem cria e muda os grupos é o superadmin no modelo `plataforma` e quem administra o cliente no `por-cliente`; o servidor confere.
- Entra no painel só quem passa em `canEnterPanel`: no modelo `plataforma`, a equipe de suporte do sistema e o superadmin; no `por-cliente`, quem o cliente marcou como equipe de atendimento (`isSupportStaff`) e quem administra o cliente (`canConfigure`). O superadmin da plataforma não entra no painel dos clientes. A rota de entrar recusa o resto com 403; mostre o botão "Atendimento" só para quem entra.
- Quem sai da equipe sai do Chatwoot. A sessão do painel dura até 2 meses, então o projeto chama `removeFromPanel` no ponto em que tira a permissão de atendimento, desativa ou apaga a pessoa, e roda `syncPanelStaff` numa rotina diária para cada cliente: ela tira da conta quem o kit pôs e não está mais em `listPanelPeople`, e aponta em `unknown` quem está na conta sem ter sido posto pelo kit. As conversas atribuídas a quem saiu voltam para a fila.
- A pessoa de repasse do OpenWA é atendente e só da caixa API: se o OpenWA fosse comprometido, o token dele não mexe em configuração da conta.
- As telas de configurar o robô e conectar o número ficam no projeto, para quem o projeto deixar (`canConfigure`).

## Dados que vão para a IA

O provedor de IA recebe as mensagens da conversa, o conhecimento e as instruções da conta, o primeiro nome do WhatsApp (dá para desligar em `privacy.share_contact_name`) e o resultado das consultas. Com imagem, áudio e vídeo ligados (contexto.md), recebe também as imagens e a grade de quadros do vídeo, e o modelo de transcrição recebe o som (ou o próprio projeto, com `ai.transcription: "project"`, pela rota assinada `transcribe`); com `media.documents`, recebe o texto de PDF, planilha e documento, ou a imagem das páginas de um PDF escaneado; desligue em `media` o que o negócio não pode mandar a um provedor. O conteúdo de um arquivo chega à IA marcado como dado da pessoa, e o prompt proíbe seguir instrução escrita nele; mesmo que a IA obedecesse, as consultas continuam presas aos dados da pessoa da conversa, porque quem filtra é o projeto. O robô só baixa anexo do próprio Chatwoot (pela rede interna, ou pelo endereço assinado do armazenamento em https), apaga os arquivos depois de cada mídia e não guarda imagem na memória da conversa. O telefone não entra no texto da IA; vai só para o projeto, nas consultas.

- Desenhe cada consulta para devolver o mínimo que responde à pergunta, e só da pessoa da conversa.
- Para dado sensível, exija uma confirmação além do telefone ou passe para a equipe.
- Confira o contrato de tratamento de dados com o provedor de IA escolhido. Quem precisa da IA sob o próprio controle usa o provedor `project`.
- O robô trata o que vem do cliente e das consultas como dado, nunca como ordem (regra 8 do prompt), mas a defesa real é a consulta só devolver o que pode.
- Num grupo do WhatsApp, todos leem o que o robô escreve e ninguém foi identificado: o robô só fala quando chamado, nunca consulta dados, e o projeto recusa consulta de conversa de grupo (`group_chat`). Conversa de grupo também não vira sugestão de conhecimento.

## Quem mexe no contexto

- A camada da plataforma só aceita escrita de quem o projeto marca como superadmin; a de cada cliente, só do administrador daquele cliente e só nos grupos liberados. O servidor descarta o resto (`applyClientEdits`): esconder o campo na tela não é a barreira.
- As regras da plataforma entram no prompt acima das do cliente; um cliente não consegue desligar uma regra da plataforma escrevendo o contrário nas instruções dele.

## Relatório e sugestões

- O trecho de cada passagem para a equipe e as sugestões de conhecimento saem do robô sem e-mail, telefone, CPF, CNPJ, número de processo e cartão (`privacy.mjs`); a conversa que vai para a IA na hora de sugerir também.
- Sugestão nenhuma entra no conhecimento sem alguém aprovar; a tela lembra de conferir se ficou algum dado de uma pessoa.
- O superadmin vê o relatório e as sugestões de todos os clientes; o administrador do cliente, só os dele.

## Regras da Meta

Assistente de IA de uso geral é proibido na API do WhatsApp desde 2026-01-15; atendimento da própria empresa é permitido. O robô recusa assuntos fora da empresa. Não ligue o robô para conversa livre.

## LGPD

O kit não decide a base legal do atendimento; o projeto decide e registra. O que o kit garante: dados de clientes ficam no Chatwoot e no banco do projeto, o log do robô não tem conteúdo, e o histórico que o robô guarda some em até 24 horas ou quando ele reinicia.

## Na primeira implantação

- **A página que cria o super administrador.** Até alguém criar o super administrador, `/installation/onboarding` entrega a instalação a quem chegar primeiro, e o certificado novo do domínio aparece nos registros públicos de certificados minutos depois de emitido. O `Caddyfile` de modelo e o `sites/pilha.caddy.exemplo` da borda fecham `/installation` para quem não está em `INSTALACAO_IPS` (na borda, uma variável por pilha). Ponha ali o IP de quem vai criar o super administrador, crie, e tire o IP. `kit.mjs verify` reprova a página aberta (`instalacao_fechada`).
- **A caixa "receber novidades" do formulário.** Marcada, ela manda o nome, o e-mail e a empresa de quem criou o super administrador ao fornecedor do Chatwoot (`Installation::OnboardingController#finish_onboarding`). Deixe desmarcada.
- **Telemetria.** Sem `DISABLE_TELEMETRY`, o Chatwoot manda ao fornecedor as contagens de contas, pessoas, caixas, conversas e mensagens e os eventos da instalação (`lib/chatwoot_hub.rb`). O `chatwoot.env.example` já traz `DISABLE_TELEMETRY=true`. Basta a variável existir, até com `false`. A conferência de versão continua mandando o identificador e a versão da instalação.
