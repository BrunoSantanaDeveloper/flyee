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
| `pesquisa/apify/` | o que o Apify colheu, como veio, com o custo de cada coleta |
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

## A coleta pelo Apify

Com a chave do Apify, o app faz a mesma pesquisa sozinho: um coletor público lê a Biblioteca de Anúncios, sem a sua conta da Meta, e devolve cada anúncio com a data de início, as versões, o texto e o endereço do vídeo. O app guarda o que veio em `pesquisa/apify/` e põe cada anúncio na evidência com a origem e a data. Toda coleta vai com um limite de itens e um teto de gasto que o próprio Apify respeita; acima de US$ 1 de custo estimado, a IA pergunta antes. Repetir a mesma coleta em menos de 24 horas não custa de novo. O coletor cobra por anúncio colhido, do crédito da sua conta no Apify; o preço conferido fica no app, com a data.

## Os outros apps

Três apps trazem mais evidência, e cada uma entra com a origem e a data. Quando a pesquisa precisa de um deles e ele ainda não está no projeto, a IA o instala na hora:

- a **Pesquisa no Instagram** mede o seu perfil e o dos concorrentes: entram os posts que passaram muito o normal do próprio perfil, com o normal ao lado, Reels e posts estáticos sempre separados;
- as **Pesquisas no Instagram e no YouTube** trazem os comentários mais curtidos de posts e vídeos do tema, sem o nome de quem escreveu: a fala do público;
- a **Análise de vídeo** destrincha o anúncio que um concorrente mantém há mais tempo: o gancho, a prova, a estrutura e as frases, segundo a segundo.

## Os conceitos e a confiança

Cada conceito parte de uma barreira (o que impede a compra) ou de um motivador (o que puxa a compra), com um ângulo, um gancho nos 3 primeiros segundos, uma prova e um estilo visual. A campanha testa três, os três no mesmo conjunto.

A confiança é contada pelo app, nunca escrita à mão: nenhum tipo de fonte a favor é aposta, um é baixa, dois é média, três ou mais é alta. Os tipos são anúncio de concorrente, orgânico medido, fala do público e resultado próprio. A ficha também mostra a evidência contra, quando há. Evidência que chega depois do seu sim muda a confiança, e a IA conta o que mudou; mudar o texto de um conceito aprovado pede o sim de novo.

O app recusa dois conceitos com o mesmo estilo visual e a mesma família de gancho (o teste não os separaria), uma prova com pessoa real sem o seu material e qualquer promessa de resultado na ficha.

## A conta da verba

A Meta diz que o aprendizado de um conjunto se estabiliza com pelo menos 50 eventos de otimização em 7 dias. Com a sua verba diária e o custo de cada evento, o app calcula o piso diário de um conjunto (custo × 50 ÷ 7) e o custo máximo que um evento pode ter (verba × 7 ÷ 50). Sem o custo por evento, ele mostra só o máximo e pergunta. Quando a conta não fecha, as três saídas são suas: um evento mais cedo no funil, mais verba, ou começar sabendo que a primeira semana serve para comparar os criativos.

## As peças

Cada peça é uma página que o app Motor de vídeo renderiza quadro a quadro. Ela mora só na faixa que a interface dos anúncios não cobre: no vertical de Stories e Reels, a Meta ocupa 14% de cima, 35% de baixo e 6% de cada lado, e a zona livre é de 875 por 978 px. As palavras entram uma a uma, o destaque ganha um sublinhado que corre, a tela do produto desce, e o botão é tocado antes do fim, para nenhuma cena ficar parada.

A conferência do Motor mede, na prévia e no vídeo final: a capa (o quadro 0 com texto legível), a área segura, o tamanho do texto (44 px no mínimo), os cortes na batida, piscadas, tempo parado e o volume (−14 LUFS). Uma página sem as caixas de texto e logo nunca conta como conferida.

A mesma página se recompõe em 4:5 para o vídeo do feed, e a imagem do feed (4:5 ou 1:1) junta o gancho, a tela do produto, o logo e o botão. As duas são conferidas na zona do feed do Instagram: a tabela de redes do Motor ainda não tem a zona de anúncio do feed, e a entrega diz isso.

A trilha e os efeitos são gerados no seu computador e são livres para usar em anúncio.

## Os textos e os nomes

A conferência dos textos (`copy`) bloqueia promessa de resultado (venda garantida, retorno, "vai vender"), os termos que você proibiu no briefing e frases que afirmam uma condição de quem vê, como "Você sofre de…", que a política de atributos pessoais da Meta recusa. Ela avisa, sem bloquear, quando o texto passa dos limites do Guia de Anúncios da Meta: 125 caracteres antes do ver mais no feed, 44 visíveis nos Reels e 27 no título.

O nome de cada anúncio segue o padrão do seu site, quando ele escolhe a página pelo `utm_content`, ou `<conceito>-<formato>-<gancho>-v<n>`. O `nomes.json` liga cada nome a cada arquivo: é por ele que o resultado de cada peça volta para a próxima rodada.

## Reels de teste

Antes de pagar, os vídeos verticais podem sair como Reels de teste, que o Instagram mostra só para quem não segue o perfil. Depois de 72 horas, a IA lê a captura das estatísticas de cada um e grava o resultado como resultado próprio, o tipo de evidência mais forte da próxima rodada. Com poucas centenas de contas alcançadas, uma diferença pequena é indício, e ela diz isso.

## Pedidos avançados

- "Mostre a evidência contra o segundo conceito."
- "Use o modelo produto em uso no conceito de confiança, com a tela que está em materiais."
- "Troque a trilha do terceiro vídeo por uma mais calma e refaça a prévia."
- "Refaça a conta da verba com R$ 45 por evento."
- "Registre no diário que a campanha começou hoje e que a estrutura coube."

## Privacidade

As capturas, as leituras e as peças ficam no seu projeto. O app se conecta só ao site da sua marca, para copiar o logo, as cores e as telas, e ao Apify, quando você salvou a chave. A chave fica no seu computador, fora de todo projeto, e nunca passa pela conversa. Nenhum dado de cliente ou paciente entra nas peças: as telas recriadas usam dados fictícios.

## O plano, a matriz, a página e a Busca

O briefing lê o plano aprovado do projeto e preenche o que o plano responde, guardando a origem de cada campo: na resposta, cada campo diz se veio do plano ou de você. O que o plano não sabe continua sendo pergunta, e nada é inventado.

A matriz da primeira leva tem de 3 a 4 ângulos, cada um com três dimensões (barreira ou motivador, família de gancho, estilo visual), cruzados com formatos, 8 a 12 peças. Dois ângulos que diferem numa dimensão só são a mesma ideia testada duas vezes, e a leitura de resultados não separaria um do outro: o app recusa. Os formatos de depoimento e de fundador saem como roteiro e plano de cena, para você gravar com quem autorizou aparecer.

A página de destino tem o seu briefing (a primeira frase por ângulo, o que mostrar, as objeções, as linhas da lei, o que a página faz por dentro) e a sua conferência pela captura do site: a posição do primeiro chamado contra a altura da tela, as palavras do título em comum com o anúncio, os preços e o prazo contra o plano, as linhas legais no texto capturado. O que a captura não trouxe sai como não conferido, nunca como reprovado.

Os anúncios de texto da Busca do Google seguem os limites do Google (até 15 títulos de 30 caracteres, 4 descrições de 90, caminhos de 15, as extensões) e os mesmos verificadores de promessa, atributo pessoal e termos proibidos dos anúncios da Meta. O resultado é a lista como você cola no Google Ads; quem cria a campanha é você.

As peças de feed (o vídeo 4:5 e as imagens) são conferidas na zona de anúncio do feed da Meta quando o Motor de vídeo a tem; com um Motor antigo, na zona do feed do Instagram, e a entrega diz isso.

## A rodada seguinte e a sequência da data alvo

O relatório do app de medição entra como leitura declarada de resultados próprios: cada linha que casa com um anúncio da campanha vira um item com o veredito (escalar, manter, iterar, cortar, dado insuficiente), a certeza e as métricas como texto, e o id do resultado é o que a ficha do conceito seguinte cita. A proposta da rodada aplica três regras: o que escalou pede variações do mesmo gancho, o que recebeu iterar muda só a parte que a leitura apontou, e um conceito cortado não volta igual (o ângulo sai, ou volta com outra barreira, outro gancho e outra prova). Os nomes da rodada terminam na versão seguinte, para a leitura ligar cada peça à sua rodada.

A sequência da data alvo lê as fases do plano: a lista abre dois dias antes do aquecimento, a oferta no primeiro dia do pico, a contagem regressiva no meio e o último dia no fim, com o preço da oferta do plano, o prazo com hora e as linhas do código do consumidor. Cada texto passa pelas mesmas conferências dos anúncios (promessa, atributo pessoal, termos proibidos, limites de caracteres), o vertical é conferido na zona dos anúncios e o feed na zona de anúncio do feed, e cada peça sobe programada dois dias antes para passar pela revisão.
