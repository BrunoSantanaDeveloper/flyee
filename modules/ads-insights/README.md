# Medição e leitura de resultados

Deixa a medição pronta antes do primeiro real e lê os resultados depois, com a honestidade que uma semana de dados permite. Este texto é o guia dentro do projeto; a página do app no flyee.club lê os guias em `guides/`.

## O que ele faz

**Antes de anunciar**, a sua IA fecha com você o contrato de medição: o que é um cliente novo, qual número do negócio julga os anúncios, quanto um resultado pode custar, qual semana vale. Depois confere o que está na sua página (Pixel da Meta, Google Analytics, Tag Manager, tag do Google Ads, aviso de cookies), monta os links de todos os anúncios por uma regra só, escreve o plano de rastreamento do seu negócio com o roteiro de teste e abre a planilha de origem, onde cada lead e cada compra entram com a origem e um pseudônimo no lugar da pessoa.

**Depois**, você exporta do Gerenciador de Anúncios a tabela da campanha e a IA lê: quem passou dos 3 segundos, quem clicou, quanto custou cada visita e cada resultado, e o veredito de cada anúncio, escalar, manter, iterar, cortar ou dado insuficiente, com a certeza que a amostra permite e onde a peça falha (gancho, miolo ou página). Toda semana ela cruza isso com a planilha de origem, diz quanto as plataformas reivindicam a mais do que o negócio vendeu, julga os movimentos da semana anterior e propõe os desta, com data de conferência e gatilho. Entre uma leitura e outra, o pulso diário só fala quando algo quebrou um limiar.

Ela não mexe na sua conta de anúncios: prescreve, você executa, e quando você diz que fez, a leitura seguinte julga o efeito.

## O que você precisa

- Uma das IAs em que o app foi testado.
- O plano aprovado do app de plano, quando houver: o custo permitido, o evento e a regra de link vêm de lá. Sem ele, a IA pergunta.
- Os exports do Gerenciador de Anúncios da Meta e, se a Busca rodar, do Google Ads, em português ou em inglês.
- Nenhuma chave e nenhum programa a mais.

## Peça assim

> "Confere se a medição está pronta antes de eu ligar a campanha. A página é esta: [link]."
>
> "Exportei a tabela da campanha da semana. O que escalar, o que cortar, o que falta para ler?"
>
> "Monta a leitura da semana e me diz o que fazer."

## O que ele grava

| Caminho | Conteúdo |
|---|---|
| `ads-insights/medicao.json` | o contrato de medição, cada item marcado como verificado, informado ou desconhecido |
| `ads-insights/rastreamento.md` | o plano de rastreamento do seu negócio, com o roteiro de teste |
| `ads-insights/origens.csv` | a planilha de origem: data, etapa, origem, valor e um pseudônimo; nunca nome, e-mail ou telefone |
| `ads-insights/entrada/` | onde ficam os exports e as listas que você traz; uma lista com dados pessoais só é lida daqui |
| `ads-insights/leituras/<leitura>/` | o export normalizado, o veredito por peça e a leitura para ler |
| `ads-insights/semanal/<data>.md` | a leitura da semana |
| `ads-insights/movimentos.json` | os movimentos propostos, os que você aplicou e o veredito de cada um |
| `ads-insights/pulso/<data>.md` | o pulso do dia, quando pedido |

## Bom saber

- Abaixo da amostra mínima (1.000 impressões e 30 cliques por anúncio para gancho e CTR; 30 resultados para custo) a leitura é indício, e o texto diz. Isso é a regra, não um defeito do seu anúncio.
- As contagens das plataformas são reivindicação; a planilha de origem é a verdade do negócio. O normal é a Meta e o Google reivindicarem de 1,2 a 1,4 compra para cada compra real.
- Os limiares dos vereditos são regras de bolso rotuladas, com a data em que foram conferidas. O histórico da sua conta substitui as regras quando existir.
- Um movimento aplicado fica legível 14 dias depois; mexer de novo no mesmo conjunto antes disso torna os dois ilegíveis.
- O app lê o HTML público da sua página para dizer quais tags estão lá; se cada tag dispara, só o teste da própria plataforma mostra, e o plano de rastreamento diz como.

## O que há de novo

- 1.0.0: primeira versão, completa. Contrato de medição, tags da página, regra única de link, plano de rastreamento, planilha de origem com pseudônimos, leitura dos exports da Meta e do Google Ads em português e em inglês, veredito por peça com a amostra mínima, leitura da semana com a verdade do negócio e os movimentos, pulso diário por exceção.
