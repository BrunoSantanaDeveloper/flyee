# Abrir o capô

Como a leitura é feita por dentro, para quem quer saber por que um anúncio recebeu o veredito que recebeu.

## O contrato antes do número

Nenhum relatório discute no meio da campanha o que é um cliente novo ou qual semana vale. O contrato de medição fixa isso uma vez: o tipo de negócio e o seu árbitro (contas pagas por origem num software; contratos num serviço; pedidos de cliente novo numa loja; agendamentos num negócio local), a meta, a semana, a receita líquida, o cliente novo, o campo onde a origem fica gravada, o evento de otimização, o custo permitido por resultado, a margem e o quanto de receita por real gasto empata. Cada item é verificado, informado ou desconhecido, e a leitura só usa o que não está desconhecido.

## O que a página mostra, e o que não mostra

O app lê o HTML público da página e procura as assinaturas das tags: o Pixel da Meta e o seu número, o Google Analytics 4, a biblioteca do Google, o Tag Manager, a tag do Google Ads, o TikTok, o LinkedIn, e os sinais de um aviso de cookies e de uma trava de consentimento. Ele diz "presente no HTML servido", nunca "dispara": se a tag dispara e com qual evento, só o teste da plataforma mostra, por isso o plano de rastreamento traz o roteiro desse teste. Uma página que só injeta as tags depois do aceite é dita como tal, porque parte das visitas fica fora da medição.

## A regra única de link

Cinco campos em todo link: canal, meio, plano, o nome do anúncio ou do envio e o público ou a palavra. Valores em minúsculas, sem acento e sem espaço, porque relatórios separam as duas grafias; o nome do anúncio é a exceção, letra por letra, porque é ele que liga o clique à peça. Um link sem um dos cinco não passa.

## A planilha de origem

Cada lead, cadastro, ativação e compra é uma linha com data, etapa, origem, meio, campanha, conteúdo, parceiro, valor e um pseudônimo. O pseudônimo nasce do e-mail e de um sal guardado no contrato, por uma função de resumo que não volta atrás; o e-mail some. Uma lista exportada entra só pelas colunas de origem; nome e telefone são descartados e a leitura diz que foram. É o que permite dizer, em dezembro, que uma compra veio de um anúncio de outubro sem guardar quem é a pessoa.

## Ler um export sem inventar

O leitor aceita português e inglês, vírgula ou ponto e vírgula, decimal com vírgula e o marcador de ordem de bytes que o Excel põe no começo. Cada cabeçalho é casado com um campo; o que não casa fica numa lista de colunas ignoradas, e o campo que o export não traz fica em "ausente", nunca em zero. A linha de total do fim é descartada. Linhas do mesmo anúncio em dias diferentes são somadas, e as razões (CTR, CPM, frequência) recalculadas a partir das contagens, porque razões não se somam.

## O ruído e a amostra mínima

Conversões se comportam como uma contagem de Poisson: a incerteza relativa é cerca de 1 dividido pela raiz de n. Com 10 resultados, 32%; com 30, 18%; com 100, 10%. Por isso a amostra mínima: 1.000 impressões e 30 cliques para ler gancho e CTR, 30 resultados para ler custo. Abaixo disso o veredito é "dado insuficiente" e o texto diz com quanto fica legível. As peças são ordenadas por gasto antes de qualquer julgamento, para uma peça de R$ 30 com 2 resultados não parecer melhor do que uma de R$ 900.

## Os vereditos

Cortar: zero resultados depois de 3 vezes o custo permitido gasto, ou custo acima de 2 vezes o permitido depois de 3 vezes gasto com 10 resultados ou mais. Escalar: 30 resultados ou mais dentro do permitido, e a planilha de origem concorda. Iterar: a peça passa de 1.000 impressões e 30 cliques e falha num ponto: menos de 20% passam dos 3 segundos (gancho), CTR do link abaixo de 0,5% (miolo), ou a página converte menos da metade da mediana da tabela (página). Manter: custo entre 1,0 e 1,5 vez o permitido. No limiar, de 0,8 a 1,3 vez com menos de 30 resultados, a leitura mostra as duas interpretações com a faixa do ruído, e a escolha fica com você. Para a Busca do Google, um termo de pesquisa com 10 cliques ou mais, nenhuma conversão e ao menos 1 vez o permitido gasto vira negativa.

Cada limiar é uma regra de bolso rotulada, com a data em que foi conferida. O plano pode trazer regras próprias, e o histórico da conta substitui as regras quando existir.

## Os movimentos e o antes e depois

Cada movimento tem objeto, texto, por quê, certeza, data de conferência e gatilho. Quando você diz que fez, a data entra e o movimento fica legível 14 dias depois: 7 dias de janela depois, 3 de maturação (as conversões atrasadas), contra os 7 dias de antes, pelo export que cobre cada janela. Um segundo movimento no mesmo objeto nesse prazo torna os dois ilegíveis, e a leitura diz "não dá para dizer" e por quê. Um aumento de verba é julgado pelos resultados por dia que vieram a mais e pelo que cada um custou, nunca pela nova média.

## Reivindicação e verdade

Somando o que a Meta, o Google e o e-mail reivindicam, o total passa das vendas reais, porque cada um conta a mesma venda. A razão de reivindicação (compras reivindicadas dividido por compras da planilha) fica normalmente entre 1,2 e 1,4. Acima de 1,5, alguém conta duas vezes; abaixo de 1, o rastreamento perde conversões. Quando a plataforma e a planilha contam histórias diferentes, as duas aparecem lado a lado, nunca a média.
