# Criativos para anúncios: por dentro

Este guia abre o app: o que acontece em cada etapa, onde fica cada arquivo, as regras que a sua IA não quebra e como pedir mudanças finas.

## A campanha é uma pasta

Tudo fica em `anuncios/<campanha>/` dentro do seu projeto. Uma campanha por pasta, e cada marca no próprio projeto: o que o app aprende de uma marca não vai para a outra.

| Arquivo | O que guarda |
|---|---|
| `briefing.md` | a oferta, a página, o evento, a verba, o público, o padrão do nome dos anúncios e o que não pode ser dito |
| `verba.json` | a conta da verba, com a fonte da Meta e a data da conferência |
| `pesquisa/links.md` | os links da Biblioteca de Anúncios e o roteiro da coleta |
| `pesquisa/capturas/` | as suas capturas, uma pasta por concorrente |
| `pesquisa/leituras/` | o que a IA leu em cada captura, com o texto como aparece |
| `evidencias.json` e `evidencias.md` | cada dado com a origem (captura, link, o que você disse) e a data |
| `conceitos.json` e `conceitos.md` | os conceitos e as fichas |
| `pecas/<conceito>/` | o `peca.json` (as cenas), a página, a prévia e o vídeo final |
| `textos.json` | a conferência dos textos dos anúncios |
| `entrega/` | os vídeos nomeados, as capas, `nomes.json` e `textos.md` |
| `lancamento.md` e `relatorio.json` | as notas de lançamento e tudo o que foi conferido |
| `diario.json` | as aprovações, as rodadas e as hipóteses de cada conceito |

## A pesquisa sem login

A Biblioteca de Anúncios da Meta é pública, mas recusa quem chega sem navegador. Por isso você abre os links e salva as capturas, e a IA lê cada uma. O app nunca usa o seu login, o seu cookie ou a sua sessão da Meta.

A regra da coleta é fotografar os 10 primeiros anúncios ativos de cada concorrente, na ordem da tela, sem escolher. Escolher os bonitos esconde o que o concorrente realmente paga. O app ordena depois, pelo tempo no ar:

- **anúncio mantido**: no ar há 30 dias ou mais, pago mês após mês;
- **padrão do mercado**: a mesma escolha (ângulo, gancho, prova, estilo) em dois concorrentes ou mais;
- **indício**: um concorrente com menos de 3 anúncios ativos não forma padrão sozinho.

A IA copia as datas e os números como aparecem na tela ("Veiculação iniciada em 3 de jul de 2026", "3 anúncios usam esse criativo e esse texto"), e o app os converte. Uma captura que falta derruba o cartão: dado sem origem não entra.

## Os conceitos e a confiança

Cada conceito parte de uma barreira (o que impede a compra) ou de um motivador (o que puxa a compra), com um ângulo, um gancho nos 3 primeiros segundos, uma prova e um estilo visual. A campanha testa três, os três no mesmo conjunto.

A confiança é contada pelo app, nunca escrita à mão: nenhum tipo de fonte a favor é aposta, um é baixa, dois é média, três ou mais é alta. Os tipos são anúncio de concorrente, orgânico medido, fala do público e resultado próprio. A ficha também mostra a evidência contra, quando há. Evidência que chega depois do seu sim muda a confiança, e a IA conta o que mudou; mudar o texto de um conceito aprovado pede o sim de novo.

O app recusa dois conceitos com o mesmo estilo visual e a mesma família de gancho (o teste não os separaria), uma prova com pessoa real sem o seu material e qualquer promessa de resultado na ficha.

## A conta da verba

A Meta diz que o aprendizado de um conjunto se estabiliza com pelo menos 50 eventos de otimização em 7 dias. Com a sua verba diária e o custo de cada evento, o app calcula o piso diário de um conjunto (custo × 50 ÷ 7) e o custo máximo que um evento pode ter (verba × 7 ÷ 50). Sem o custo por evento, ele mostra só o máximo e pergunta. Quando a conta não fecha, as três saídas são suas: um evento mais cedo no funil, mais verba, ou começar sabendo que a primeira semana serve para comparar os criativos.

## As peças

Cada peça é uma página que o app Motor de vídeo renderiza quadro a quadro. Ela mora só na faixa que a interface dos anúncios não cobre: no vertical de Stories e Reels, a Meta ocupa 14% de cima, 35% de baixo e 6% de cada lado, e a zona livre é de 875 por 978 px. As palavras entram uma a uma, o destaque ganha um sublinhado que corre, a tela do produto desce, e o botão é tocado antes do fim, para nenhuma cena ficar parada.

A conferência do Motor mede, na prévia e no vídeo final: a capa (o quadro 0 com texto legível), a área segura, o tamanho do texto (44 px no mínimo), os cortes na batida, piscadas, tempo parado e o volume (−14 LUFS). Uma página sem as caixas de texto e logo nunca conta como conferida.

A trilha e os efeitos são gerados no seu computador e são livres para usar em anúncio.

## Os textos e os nomes

A conferência dos textos (`copy`) bloqueia promessa de resultado (venda garantida, retorno, "vai vender"), os termos que você proibiu no briefing e frases que afirmam uma condição de quem vê, como "Você sofre de…", que a política de atributos pessoais da Meta recusa. Ela avisa, sem bloquear, quando o texto passa dos limites do Guia de Anúncios da Meta: 125 caracteres antes do ver mais no feed, 44 visíveis nos Reels e 27 no título.

O nome de cada anúncio segue o padrão do seu site, quando ele escolhe a página pelo `utm_content`, ou `<conceito>-<formato>-<gancho>-v<n>`. O `nomes.json` liga cada nome a cada arquivo: é por ele que o resultado de cada peça volta para a próxima rodada.

## Pedidos avançados

- "Mostre a evidência contra o segundo conceito."
- "Use o modelo produto em uso no conceito de confiança, com a tela que está em materiais."
- "Troque a trilha do terceiro vídeo por uma mais calma e refaça a prévia."
- "Refaça a conta da verba com R$ 45 por evento."
- "Registre no diário que a campanha começou hoje e que a estrutura coube."

## Privacidade

As capturas, as leituras e as peças ficam no seu projeto. A única conexão do app é a visita ao site da sua marca, para copiar o logo, as cores e as telas. Nenhum dado de cliente ou paciente entra nas peças: as telas recriadas usam dados fictícios.
