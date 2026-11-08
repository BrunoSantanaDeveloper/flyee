# WhatsApp: rota oficial ou não oficial

O projeto escolhe por cliente. As duas rotas caem no mesmo painel e no mesmo robô; muda só como o número se conecta.

## Qual escolher

| Situação | Rota |
|---|---|
| Atividade regulada (saúde, jurídico, financeiro), dado sensível, ou número que a empresa não pode perder | oficial |
| Volume alto, mensagens para quem não salvou o contato, modelos de mensagem fora da janela de 24 horas | oficial |
| Teste rápido, operação pequena, cliente que aceita o risco por escrito | não oficial |

Na dúvida, oficial. A tela "Conectar WhatsApp" já mostra a oficial como recomendada e só libera a não oficial depois do aceite do risco.

## Rota oficial: WhatsApp Cloud API pelo Chatwoot

O Chatwoot fala direto com a API da Meta (caixa WhatsApp, provedor `whatsapp_cloud`). O que o cliente traz: número, Phone number ID, WABA ID e um token permanente de usuário do sistema (pre-requisitos.md). O que o kit faz: cria a caixa com essas credenciais (o Chatwoot as confere na Meta ao salvar), liga o robô e a equipe, e devolve a URL de retorno (`/webhooks/whatsapp/<número>`) e o token de verificação para o cliente cadastrar no app da Meta, assinando o campo `messages`.

Regras da Meta que o atendimento sente:

- Fora da janela de 24 horas depois da última mensagem do cliente, só sai modelo aprovado. Os modelos são criados no WhatsApp Manager; o Chatwoot sincroniza e a equipe envia pelo painel. O robô só responde a mensagens do cliente, então trabalha sempre dentro da janela.
- Preço (página de preços da Meta, lida em 2026-11-03): desde 2026-10-01 as mensagens de serviço são cobradas por mensagem, com 1.000 gratuitas por número de empresa por mês, sem acúmulo. Contas do Brasil passam a ser cobradas em reais; contas fora do real deixam de entregar no Brasil em 2027-07-01.
- IA: desde 2026-01-15, os termos da Meta proíbem assistentes de IA de uso geral na API; IA que atende os clientes da própria empresa continua permitida (fontes de imprensa e de fornecedores, não a página da Meta). Por isso o robô do kit recusa assuntos fora da empresa (regra 1 do prompt).

## Rota não oficial: OpenWA

O OpenWA (licença MIT, versão 0.29.1) conecta o número como um aparelho do WhatsApp Web. O plugin `chatwoot-adapter` (0.9.15) liga uma sessão a uma caixa API do Chatwoot nos dois sentidos.

Riscos, que a tela mostra ao cliente:

- O README do OpenWA o chama de não oficial e não aprovado para uso regulado. O número pode ser banido, com mais chance em volume alto ou com mensagens para quem não salvou o contato.
- O celular do número precisa ficar ligado e com internet. Aparelhos conectados saem depois de um tempo sem uso do celular (fontes secundárias falam em 14 dias).
- O OpenWA nunca terá a API oficial: o pedido foi fechado como fora do escopo em 2026-06-13 (issue 90).

Motores: `whatsapp-web.js` (Chromium, 300 a 500 MB por sessão, menor risco segundo o OpenWA) e `baileys` (30 a 80 MB, risco maior). O kit usa `whatsapp-web.js` por padrão.

Como o kit liga as peças, nesta ordem, porque o segredo só nasce no Chatwoot (README do adaptador):

1. cria a caixa API no Chatwoot e a pessoa de repasse (atendente, membro da caixa), cujo token o adaptador usa;
2. cria o webhook da conta, com os eventos `message_created`, `conversation_updated` e `conversation_status_changed`, apontando para `https://wa.<domínio>/api/ingress/chatwoot-adapter/<sessão>/chatwoot`, e lê o segredo que o Chatwoot gerou;
3. instala e liga o adaptador no OpenWA pelo catálogo, se faltar (o endereço do catálogo traz o hash do pacote, que o OpenWA exige em produção);
4. cria e inicia a sessão do OpenWA;
5. cria a instância do adaptador pela API, com o mesmo segredo do passo 2 e a configuração da caixa (a instância criada pelo painel do OpenWA ganha um segredo aleatório que nunca bate);
6. liga o robô na caixa API.

Depois a tela pergunta o estado da sessão a cada 3 segundos e mostra o QR até o número conectar. Grupos ficam fora (`relayGroups` desligado): o atendimento é de pessoa para empresa.

Quando o adaptador vê um atendente assumir a conversa no Chatwoot, ele cala os outros robôs do próprio OpenWA naquela conversa. O robô do kit não é um robô do OpenWA: ele para porque a conversa sai de pendente.

## Quando o número para

Por dentro, um número que caiu não mostra erro: o painel só fica vazio, como num dia sem clientes. A conferência do número (`base/server/health.mjs`) olha o número atual, a última caixa conectada:

| Rota | O que ela lê | O que ela acha |
|---|---|---|
| Não oficial | a sessão no OpenWA, a ponte `chatwoot-adapter` e a caixa no painel | número fora do aparelho conectado (espera um QR), sessão parada ou com falha, restrição do WhatsApp, ponte desligada, OpenWA ou painel fora do ar |
| Oficial | a saúde que o Chatwoot consulta na Meta (chatwoot.md) | token recusado, estado do número (`BANNED`, `DISCONNECTED`, `RESTRICTED`, `FLAGGED`), qualidade amarela ou vermelha, URL de retorno ausente ou em outro endereço, painel fora do ar |

Cada achado traz o nível (`fora`: mensagens não chegam ou não saem; `atencao`: funciona, mas pede um olhar), o que se viu, a correção e quem corrige (`quem_conecta` ou `tecnico`).

Como isso chega às pessoas:

- **A rotina `checkWhatsapp(tenantId)`**, que o projeto roda a cada 15 minutos para cada cliente com atendimento, avisa por `alertWhatsapp` no canal que o projeto já tem. Avisa quando o número para, pede atenção ou volta, e lembra uma vez por dia enquanto estiver fora. O que costuma passar sozinho (o OpenWA tentando de novo, a sessão iniciando, a Meta sem responder) só vira aviso se continuar na conferência seguinte.
- **A tela Conectar WhatsApp** mostra o que a conferência viu e o caminho de volta.
- **`kit.mjs verify`** confere cada sessão do OpenWA. O número da rota oficial fica de fora, porque a saúde dele pede o token da conta de serviço, que mora no estado do projeto.

Os caminhos de volta retomam a mesma caixa, e as conversas continuam nela:

- **Não oficial: "Ler o QR de novo"** (`reconnectOpenWA`). Retoma a sessão que a caixa já tem. Com o motor do OpenWA carregado, ele já está tentando ou já mostra o QR, e o kit só acompanha.
- **Oficial: "Trocar o token da Meta"** (`updateCloudApi`). O formulário com o mesmo número troca o token da caixa, porque o Chatwoot aceita cada número uma vez só. O token de verificação do retorno continua o mesmo.
- **"Conectar outro número"** cria uma caixa nova, e a conferência passa a olhar para ela.

O que a conferência não vê: uma mensagem que se perde no caminho com tudo dizendo que está bem. Só uma mensagem mandada de fora prova a entrega; depois de implantar e depois de cada atualização, peça a alguém para mandar uma mensagem de outro celular.
