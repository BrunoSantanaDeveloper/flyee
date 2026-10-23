# As regras de decisão do plano

Este guia é para a IA. `rules <plano>` grava `plano.json.rules` e `triggers`, com os mesmos números que o app de medição aplica, para o plano e a leitura nunca discordarem. Este texto é o porquê.

## Dado suficiente

Conversões se comportam como contagem de Poisson: a incerteza relativa é cerca de 1 dividido pela raiz de n. Com 10 resultados, 32%; com 30, 18%. Por isso: gancho e CTR legíveis com 1.000 impressões e 30 cliques por anúncio; custo por resultado legível com 30 resultados. Abaixo disso é indício, e o texto diz. Um anúncio com menos de uma vez o custo permitido gasto não tem veredito.

## Indicadores por fase

- Preparação: rastreamento conferido, página no ar com a oferta e as regras, base legal registrada. Nada pago antes.
- Testes: quem passa dos 3 segundos, CTR do link, custo por visita, conversão da página. A semana 1 não julga vendas.
- Escala: custo por resultado contra o permitido, frequência semanal, tamanho da lista.
- Aquecimento: entradas na lista, resposta da base, custo por resultado.
- Pico: custo por resultado, ritmo de gasto contra o plano, reprovações, respostas do atendimento.
- Depois: implantação de quem entrou, razão de reivindicação, o que vira campanha sempre ativa.

## Quando pausar, escalar e trocar

Pausar: zero resultados depois de 3 vezes o custo permitido gasto; custo acima de 2 vezes o permitido depois de 3 vezes gasto com 10 resultados ou mais; página fora do ar, oferta encerrada ainda anunciada, anúncio reprovado. Escalar: 30 resultados ou mais dentro do permitido e a planilha de origem concorda, 20 a 30% por semana, nunca o dobro. Trocar: CTR caindo 35% entre duas leituras com a verba parada, ou frequência acima de 3 em público frio. Uma mudança significativa por conjunto por semana.

## A cadência

Toda segunda, a leitura semanal: o export da Meta (e do Google) com os 14 dias anteriores, a planilha de origem da semana, os movimentos. Entre leituras, o pulso diário só por exceção. O ponto de decisão do calendário redistribui a verba pelo que leu melhor.

## Os gatilhos e o plano B

Cada risco tem um sinal, onde ele é lido e o plano B: custo (evento sobe no funil, peça trocada, verba ao piso), conta (recurso com a política em mãos, frase trocada, a base e os parceiros enquanto isso), base (promoções param, só os engajados por duas semanas, autenticação do domínio conferida), produto (anúncios pausados na hora, página ou oferta corrigida), rastreamento (nenhuma decisão de verba pela plataforma até conferir o evento). Um gatilho disparado é a primeira linha da leitura seguinte e pede o replanejamento da parte afetada, nunca do plano inteiro.
