# Juridiq: a página da API e do servidor MCP

- **Fonte:** Juridiq, juridiq.com.br/api, vista em 2026-11-07.
- **Tipo:** página de API. A página de vendas do produto está em `juridiq-pagina-de-vendas.md`.
- **Como foi lida:** capturada no computador e no celular, com a leitura das seções, dos chamados e dos preços. O console e a conversa do agente foram observados num navegador por 12 s a 15 s cada, para ver se mudam sozinhos. Aqui fica a análise.

## Para quem e o que pede

Escritórios que querem ligar o sistema a outros programas, ou colocar um agente de IA para operar o escritório. A página pede a leitura da documentação, que fica num endereço à parte, e a escolha de um dos dois planos da API.

## A página, na ordem

1. **A faixa da promoção e o menu,** os mesmos da página inicial.
2. **O topo:**
   - um selo com a versão da API e o estado "Operacional";
   - o título (a operação do escritório, agora programável) e uma frase com o que a API expõe;
   - "Ler a documentação" e "Ver planos";
   - a linha REST, JSON, Bearer e HTTPS;
   - à direita, um console com cinco rotas e a resposta em JSON de uma delas, com o tempo de resposta.
3. **A ficha técnica:** o endereço base, o protocolo, a autenticação, o transporte, a codificação e a versão.
4. **As rotas:** seis cartões (processos, prazos e tarefas, publicações, documentos, clientes e financeiro), cada um com o método, a rota e uma linha do que faz.
5. **O servidor MCP:**
   - três cartões: as ferramentas descobertas sozinhas, as ações por linguagem natural, o padrão aberto;
   - uma conversa de exemplo em que o agente chama três ferramentas e responde com o prazo mais urgente e a tarefa já criada.
6. **Os agentes que se conectam** (Claude em destaque, ChatGPT, Gemini e qualquer cliente MCP) e seis casos de uso, cada um com a frase que a pessoa diria.
7. **A documentação em três passos:** gerar a chave, fazer a primeira chamada, receber o JSON. Ao lado, uma reprodução da página de autenticação da documentação, com o exemplo e a resposta.
8. **Os planos da API:**
   - API Base, por R$ 98,90 por mês;
   - API com MCP, por R$ 198,90 por mês, em destaque.

   Cada um tem seis itens e o seu chamado. Embaixo: preços por escritório, sem taxa de implantação e cancelamento quando quiser.
9. **O último chamado,** com um terminal estilizado, "Começar agora" e "Ver a documentação".

## A mecânica que vale levar

- **A documentação como chamado principal,** com os planos ao lado.
- **O console no topo** mostra uma chamada de verdade e a resposta, em vez de uma ilustração.
- **A ficha técnica numa linha,** com o que quem programa procura primeiro.
- **Os planos por escritório, com o plano de agentes em destaque** e as condições numa linha só: sem taxa de implantação e cancelamento quando quiser.
- **A conversa do agente mostra as ferramentas chamadas,** com o resultado de cada uma, antes da resposta final.

## O movimento

Quase nada se mexe: um cursor pisca no terminal, e o console e a conversa do agente ficam parados. A janela da promoção abre com a rolagem, como na página inicial.

## O que não repetir

- **Os limites de uso não estão em número.** A página diz "rate limit pronto para produção", sem quantas requisições por minuto ou por mês.
- **O selo "Operacional" não leva a uma página de status.**
- **A página não diz se a API exige um plano do sistema.** A página de planos diz que a API é vendida à parte; a da API não diz se ela funciona sem uma assinatura.
- **O exemplo de código da página inicial usa outra rota,** em inglês e sem versão.
- **A conversa de exemplo termina com um emoji** numa página que fala com advogados.
