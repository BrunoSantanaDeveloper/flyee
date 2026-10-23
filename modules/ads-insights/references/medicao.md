# O contrato de medição

O contrato é a lista do que conta, escrita uma vez, antes do primeiro real. Discutir no meio da campanha o que é um cliente novo, qual semana vale ou se a Meta conta certo é o que mata a confiança num relatório. O arquivo é `ads-insights/medicao.json`; cada item tem um valor e um estado: `verificado` (alguém conferiu, com o teste ou o documento), `informado` (o integrante disse) ou `desconhecido`.

## O árbitro, por tipo de negócio

O árbitro é o número do negócio contra o qual as plataformas são julgadas. Nem sempre é a receita.

| Tipo | Árbitro (a verdade) | De onde vem | Como ordenar os criativos |
|---|---|---|---|
| Software por assinatura | contas pagas novas e cadastros ativados, por origem | a cobrança, o produto, o campo de origem do cadastro | custo por cadastro ativado e por conta paga; o custo por cadastro é sinal antecipado |
| Serviço | leads qualificados, reuniões, contratos, por origem | o CRM ou a agenda | custo por lead qualificado; o custo por lead sozinho não decide |
| Loja | receita líquida e pedidos de cliente novo | a loja | custo por compra confirmado pela loja |
| App | instalações por origem, ativações, quem continua em 7 dias | as lojas de app e a análise do produto | custo por usuário ativado; o custo por instalação nunca vence sozinho |
| Negócio local | agendamentos, ligações, visitas | a agenda, o telefone | custo por agendamento |
| Infoproduto | vendas e inscrições pagas | a plataforma de pagamento | custo por venda confirmado pelo pagamento |

Quando o árbitro do tipo falta, a leitura roda em modo reivindicação: todo resultado vem marcado como contagem da plataforma, não há razão de reivindicação nem custo por cliente real, e nenhum veredito passa de primeira leitura. A primeira frase diz isso e pede o export que falta.

## Os itens

- **Tipo de negócio e árbitro**: os dois acima.
- **A meta que o marketing deve**: um número e uma data, do plano.
- **Semana e fuso**: segunda a domingo, America/Sao_Paulo, salvo pedido.
- **Receita líquida**: o preço pago menos reembolsos e descontos, sem impostos; renovações não são receita nova.
- **Cliente novo**: o primeiro pagamento de uma pessoa, identificada pelo e-mail.
- **O campo de origem que viaja com a conta**: onde `utm_source`, `utm_medium`, `utm_campaign` e `utm_content` ficam gravados quando alguém se cadastra, e a pergunta "como você conheceu". Sem isso, a compra de daqui a três semanas não tem dono.
- **Evento de otimização**: o do plano. A campanha otimiza por ele; os outros são lidos.
- **Evento de ativação**: o primeiro resultado útil que a pessoa tem no produto.
- **Custo permitido por resultado**: do plano. Todo veredito de custo parte dele.
- **Margem e MER de equilíbrio**: a margem antes dos anúncios e 1 dividido por ela: a receita por real gasto que empata. Receita sem margem engana qualquer decisão.
- **Atribuição**: o padrão das plataformas (Meta, 7 dias após o clique e 1 dia após a visualização). É reivindicação; comparar leituras com atribuições diferentes não vale.
- **Canais**: os que rodam. Um canal usado sem número aparece como "usado, não medido", nunca como "não usado".
- **A história pela qual o negócio decide**: a planilha de origem manda; a plataforma explica o que acontece dentro dela. Quando as duas discordam, a leitura mostra as duas e o integrante escolhe, uma vez, e a escolha fica registrada.
- **Os exports de cada semana**: o que chega e quem manda. Pedir tudo numa mensagem só, uma vez; o que não chegar fica "não conferido nesta semana".
- **Sal**: gerado pelo app, para os pseudônimos. Nunca sai do projeto.

## Emendar

Quando o negócio muda (um canal novo, a cobrança troca de ferramenta), a mudança entra em `amended` com a data e o que mudou, e o item muda de valor. O histórico fica.
