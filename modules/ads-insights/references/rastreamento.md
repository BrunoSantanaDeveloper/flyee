# Rastreamento: o método

O comando `events` escreve `ads-insights/rastreamento.md` para o negócio do integrante a partir do contrato. Este arquivo é o método por trás dele, para a IA conduzir a conferência.

## O que "pronto" quer dizer

Rastreamento pronto é: a tag na página e disparando no teste da plataforma; o evento de otimização disparando uma vez por ação, não duas; a compra com valor e moeda; a deduplicação ativa quando navegador e servidor mandam o mesmo evento; a origem gravada no cadastro; os links de todos os anúncios na regra única. Nada pago sobe antes disto, porque uma medição errada é pior do que nenhuma: ela ensina o leilão a otimizar pela coisa errada e cada decisão seguinte herda o erro.

## As três conferências

1. **As tags no HTML servido.** `tags <url>` lê a página pública e diz o que está lá: Pixel da Meta, GA4, gtag, Tag Manager, tag do Google Ads, TikTok, LinkedIn, aviso de cookies. Ele não diz se a tag dispara nem com qual evento; isso é o passo 2. Uma página que injeta as tags depois do aceite de cookies é dita como tal: parte das visitas fica fora da medição, e a razão de reivindicação cai.
2. **O teste da plataforma.** O Gerenciador de Eventos da Meta (Testar eventos), o DebugView do GA4 e o Tag Assistant do Google mostram cada evento chegando. O integrante navega como cliente, preenche o formulário com um e-mail de teste, faz uma compra de teste. Cada passo aparece uma vez.
3. **Os links.** `utm check <link>` confere os cinco campos da regra única; `utm build` monta um link certo. `utm_content` é o nome do anúncio letra por letra, porque é ele que liga o clique à peça na leitura.

## Deduplicação

Quando o mesmo evento sai do navegador (Pixel) e do servidor (API de Conversões), os dois levam o mesmo `event_id`. Sem isso, cada compra vira duas, o custo por resultado aparece pela metade e a razão de reivindicação sobe acima de 1,5. O Gerenciador de Eventos mostra a taxa de deduplicação por evento.

## A conversão do Google Ads

Uma ação de conversão primária, a do evento de otimização, pela tag do Google Ads ou importada do GA4; as outras entram como secundárias, para leitura. O lance inteligente do Google aprende com cerca de 30 conversões em 30 dias: a conversão primária precisa ser um evento que acontece nessa quantidade.

## A categoria do negócio

Saúde, finanças e outras categorias sensíveis têm eventos restritos na Meta. Só eventos padrão, nenhum termo clínico, diagnóstico ou dado da pessoa em URL, nome de evento ou parâmetro. O aviso aparece no Gerenciador de Eventos ao montar a campanha; quando aparecer, o evento de otimização passa para o passo mais cedo do funil que a categoria permite, e o contrato registra.

## A origem que viaja com a conta

A plataforma lembra de um clique por dias; o negócio precisa lembrar por meses. O formulário de cadastro guarda `utm_source`, `utm_medium`, `utm_campaign` e `utm_content` num campo escondido; a pergunta "como você conheceu" entra no primeiro acesso. É essa coluna que a planilha de origem lê, e é ela que diz, em dezembro, qual anúncio de outubro trouxe o cliente.

## Quando a medição não existe por desenho

Um formulário que não grava origem, um app sem ferramenta de atribuição: isso não é nota de rodapé, é o primeiro achado da leitura, com os passos de instalação, quem faz e qual decisão fica travada até lá.
