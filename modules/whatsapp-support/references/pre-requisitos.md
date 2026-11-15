# Pré-requisitos

Confira cada item no projeto antes de prometer prazo ao desenvolvedor. A coluna "Quem" diz se a IA prepara (arquivos no projeto) ou se só o desenvolvedor faz (fora do projeto, com acesso que a IA não tem).

## Para qualquer rota

| Item | Detalhe | Quem |
|---|---|---|
| Servidor com Docker | 2 vCPU e 4 GB de RAM como ponto de partida (regra de bolso, ver arquitetura.md); disco para os anexos das conversas. Num servidor com outro sistema que usa este kit, a soma das duas pilhas e o proxy da borda (arquitetura.md, "Mais de um sistema no mesmo servidor") | desenvolvedor |
| Domínio do sistema | o painel fica em `atendimento.<domínio>`, subdomínio do mesmo domínio do sistema | desenvolvedor (DNS) |
| TLS | o Caddy de modelo emite sozinho; outro proxy, com o certificado que ele já usa | IA prepara, desenvolvedor aplica |
| Caminho de implantação | onde o compose de modelo vai morar (o compose do projeto, um stack, um painel) | IA prepara |
| Segredos | `SECRET_KEY_BASE`, senhas do Postgres e do Redis, `SUPPORT_BOT_SECRET`, `API_MASTER_KEY` do OpenWA: 64 caracteres aleatórios cada | IA gera em `segredos/`, desenvolvedor leva ao cofre de produção |
| Super administrador do Chatwoot | criado na primeira abertura do painel, em `/installation/onboarding`, a partir do IP liberado em `INSTALACAO_IPS`, com a caixa de novidades desmarcada (seguranca.md, "Na primeira implantação"). O e-mail do super administrador não pode ser de ninguém da equipe: o Chatwoot acha a pessoa pelo e-mail, e ela viraria atendente com o login único caindo na conta da instalação. O kit recusa esse e-mail na equipe (`staff_email_is_admin`) | desenvolvedor |
| Platform App | no console de super administrador do Chatwoot, em Platform Apps; o token vira `CHATWOOT_PLATFORM_TOKEN` no projeto | desenvolvedor |
| Transcrição de áudio e da fala do vídeo | `GEMINI_API_KEY` no ambiente do robô (o mais barato) ou `OPENAI_API_KEY`; ou, sem chave no robô, a rota `transcribe` no projeto com `ai.transcription: "project"`; sem nada disso, áudio vai para a equipe | desenvolvedor |
| Provedor de IA | a chave no ambiente do robô (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` ou outra terminada em `_API_KEY`), ou a IA do próprio projeto pelo provedor `project` | desenvolvedor |
| E-mail das contas de serviço | um domínio do projeto para os e-mails que ninguém usa (`SUPPORT_SERVICE_EMAIL_DOMAIN`) | IA prepara |
| SMTP | opcional; sem ele os avisos aos atendentes ficam no painel e no navegador | desenvolvedor |

## Rota oficial (WhatsApp Cloud API)

| Item | Detalhe | Quem |
|---|---|---|
| Conta empresarial na Meta | verificada para limites maiores de envio | cliente do projeto |
| Conta do WhatsApp Business (WABA) e número | o número não pode estar ativo no aplicativo comum, a menos que use a coexistência | cliente do projeto |
| App da Meta com o produto WhatsApp | onde fica o retorno de mensagens (webhook) | cliente do projeto ou o desenvolvedor |
| Token permanente | de um usuário do sistema, com `whatsapp_business_messaging` e `whatsapp_business_management` | cliente do projeto |
| Phone number ID e WABA ID | no WhatsApp Manager | cliente do projeto |
| Retorno na Meta | URL e token de verificação que a tela "Conectar WhatsApp" mostra; assinar o campo `messages` | cliente do projeto |

O cadastro incorporado da Meta (o cliente conecta o número dentro do sistema, sem copiar IDs) exige que o app da Meta do projeto seja Tech Provider, com verificação da empresa e revisão do app. Fica fora desta versão do kit.

## Rota não oficial (OpenWA)

| Item | Detalhe | Quem |
|---|---|---|
| Endereço público https do OpenWA | `wa.<domínio>`; o adaptador recusa endereço privado | desenvolvedor (DNS) |
| Chatwoot em endereço público https | o adaptador fala com o Chatwoot pelo endereço público | já coberto acima |
| Memória por sessão | 300 a 500 MB por número com `whatsapp-web.js` | desenvolvedor |
| Celular do número | ligado e com internet; aparelhos conectados saem depois de um tempo sem uso do celular | cliente do projeto |
| Aceite do risco | a tela mostra o aviso e pede o aceite antes de gerar o QR | cliente do projeto |

## Para a conferência visual

Edge, Chrome ou Chromium na máquina onde a IA roda. No Windows o Edge vem com o sistema. A conferência por HTTP não precisa de navegador.
