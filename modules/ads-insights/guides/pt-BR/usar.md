# Como usar

Antes de gastar o primeiro real, a sua IA deixa a medição pronta: o que conta como resultado, o que está na sua página, os links de todos os anúncios por uma regra só, o roteiro de teste e a planilha onde cada lead e cada compra entram com a origem. Depois, você exporta a tabela do Gerenciador de Anúncios e ela lê: o veredito de cada anúncio, com a certeza que a amostra permite, a leitura da semana e o que fazer.

## Peça assim

- "Confere se a medição está pronta antes de eu ligar a campanha. A página é esta: [link]."
- "Monta os links dos anúncios do jeito certo."
- "Exportei a tabela da campanha. O que escalar, o que cortar, o que ainda não dá para ler?"
- "Monta a leitura da semana."
- "Tem alguma coisa pegando fogo hoje?"

## O que acontece

1. A IA fecha com você o contrato de medição, numa mensagem só: que tipo de negócio é, qual número julga os anúncios, onde a origem fica gravada quando alguém se cadastra. O que o plano já respondeu ela não pergunta.
2. Ela lê a sua página e diz o que está lá: Pixel da Meta, Google Analytics, Tag Manager, tag do Google Ads, aviso de cookies. Diz também o que isso não prova: se a tag dispara, só o teste da plataforma mostra, e ela escreve o roteiro desse teste para o seu negócio.
3. Ela monta os links dos anúncios por uma regra única e confere os que você já tem. Um link sem os cinco campos não sobe.
4. Ela abre a planilha de origem. Cada lead e cada compra entram com data, origem e um pseudônimo no lugar da pessoa; nome, e-mail e telefone nunca são gravados. Uma lista exportada da sua ferramenta entra inteira, só com as colunas de origem.
5. Depois de uma semana de campanha, você exporta do Gerenciador a tabela no nível de anúncio e salva na pasta de entrada. Ela liga cada linha à peça da entrega e julga: escalar, manter, iterar, cortar ou dado insuficiente, com a certeza e onde a peça falha.
6. Toda semana ela cruza a tabela com a planilha de origem, diz quanto as plataformas reivindicam a mais do que você vendeu, julga os movimentos da semana anterior e propõe os desta, cada um com por quê, certeza, data de conferência e gatilho. Na conversa vêm três linhas e as decisões; o documento fica no projeto.
7. Você faz os movimentos na sua conta e diz que fez. Catorze dias depois, a leitura diz se funcionou.

## O que você recebe

| Onde | O quê |
|---|---|
| ads-insights/medicao.json | o contrato de medição, cada item marcado como verificado, informado ou desconhecido |
| ads-insights/rastreamento.md | o plano de rastreamento do seu negócio, com o roteiro de teste |
| ads-insights/origens.csv | a planilha de origem, sem dado pessoal |
| ads-insights/leituras/(leitura)/leitura.md | o veredito de cada anúncio, com os números e o porquê |
| ads-insights/semanal/(data).md | a leitura da semana: achados, decisões, a história, o que fazer, o que não fazer, o que faltou |
| ads-insights/pulso/(data).md | o pulso do dia, só quando algo quebrou um limiar |

## Dicas

- Exporte sempre o período inteiro da campanha, no nível de anúncio, com as colunas de impressões, cliques no link, visualizações da página, reproduções de 3 segundos e resultados. O que faltar fica em branco, nunca em zero.
- Guarde o export em ads-insights/entrada antes de pedir a leitura; uma lista com dados pessoais só é lida de lá.
- Quando a IA mostrar as duas leituras de um anúncio no limiar, a escolha é sua: ela não decide em silêncio.
- Depois de mexer num conjunto, espere a data em que o movimento fica legível antes de mexer de novo.

## Limites

- Abaixo da amostra mínima a leitura é indício, e o texto diz. Com uma semana de verba pequena, a resposta mais comum para o evento final é "dado insuficiente".
- As contagens da Meta e do Google são reivindicação; a verdade é a planilha de origem.
- O app não mexe na sua conta de anúncios, não envia e-mail nem mensagem e não pede a senha de nada.
- Os limiares são regras de bolso rotuladas e datadas; o histórico da sua conta vale mais quando existir.
