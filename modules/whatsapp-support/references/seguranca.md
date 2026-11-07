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
- A pessoa de repasse do OpenWA é atendente e só da caixa API: se o OpenWA fosse comprometido, o token dele não mexe em configuração da conta.
- As telas de configurar o robô e conectar o número ficam no projeto, para quem o projeto deixar (`canConfigure`).

## Dados que vão para a IA

O provedor de IA recebe as mensagens da conversa, o conhecimento e as instruções da conta, o primeiro nome do WhatsApp (dá para desligar em `privacy.share_contact_name`) e o resultado das consultas. O telefone não entra no texto da IA; vai só para o projeto, nas consultas.

- Desenhe cada consulta para devolver o mínimo que responde à pergunta, e só da pessoa da conversa.
- Para dado sensível, exija uma confirmação além do telefone ou passe para a equipe.
- Confira o contrato de tratamento de dados com o provedor de IA escolhido. Quem precisa da IA sob o próprio controle usa o provedor `project`.
- O robô trata o que vem do cliente e das consultas como dado, nunca como ordem (regra 8 do prompt), mas a defesa real é a consulta só devolver o que pode.

## Regras da Meta

Assistente de IA de uso geral é proibido na API do WhatsApp desde 2026-01-15; atendimento da própria empresa é permitido. O robô recusa assuntos fora da empresa. Não ligue o robô para conversa livre.

## LGPD

O kit não decide a base legal do atendimento; o projeto decide e registra. O que o kit garante: dados de clientes ficam no Chatwoot e no banco do projeto, o log do robô não tem conteúdo, e o histórico que o robô guarda some em até 24 horas ou quando ele reinicia.
