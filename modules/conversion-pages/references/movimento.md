# Movimento e mídia nas páginas que vendem

Este guia é para a IA. Numa página que vende, o movimento tem duas funções: mostrar o produto funcionando e levar o olho até a decisão. Todo o resto fica parado. As seções de 1 a 5 vêm da oferta da Hostinger; a seção 6, das páginas de vendas do Juridiq e do JuriChat.

## 1. A demonstração em vídeo

No topo do modelo da Hostinger há um vídeo de motion design de cerca de 22 s, sem som e em loop, que simula o uso do produto em três cenas. Cada cena segue o mesmo ritmo:

1. o pedido é digitado letra a letra num campo de chat, em cerca de 2 s;
2. o resultado se monta atrás do campo, em cerca de 1,5 s: primeiro um painel vazio de vidro fosco, depois o conteúdo;
3. uma prova aparece na tela: uma nota que sobe de 72 para 84, riscos marcados num contrato;
4. a cena fica parada para leitura por cerca de 2 s e se dissolve em cerca de 0,5 s.

O último quadro é igual ao primeiro, então o loop não tem emenda.

Regras para o vídeo na página:

- `autoplay`, `muted`, `loop` e `playsinline`, os quatro juntos. Sem `muted`, o navegador não deixa o vídeo começar sozinho; sem `playsinline`, o iPhone o abre em tela cheia.
- Uma capa (`poster`) no idioma da página. É ela que aparece antes de o vídeo carregar e para quem pediu menos movimento. Na Hostinger, a capa está em inglês numa página em português.
- Nenhuma faixa de áudio.
- Um botão discreto de pausar e tocar por cima do vídeo.
- Arquivo leve. O vídeo do topo da Hostinger tem 1,1 MB para 22,7 s, em 1100 por 720 e a 30 quadros por segundo. Os vídeos curtos de detalhe ficam abaixo de 250 KB.
- Os textos dentro do vídeo no idioma da página. Na Hostinger, os vídeos dos especialistas estão em inglês.

## 2. Vídeos curtos que entram junto com um item

Num acordeão de recursos, cada item aberto mostra um vídeo de 5 s. A conversa aparece parada e, entre 0,3 s e 0,8 s, um cartão de resultado sobe de baixo e ganha cor aos poucos, desacelerando no fim. Trocar de item recomeça o vídeo, e essa entrada faz o papel de transição.

## 3. O que se mexe em CSS

| Elemento | Movimento | Como |
|---|---|---|
| Acordeão | abre e fecha em 0,3 s | `grid-template-rows` de `0fr` para `1fr`, com `transition` |
| Carrossel | rola um cartão ou uma tela por vez, com encaixe | `scroll-snap-type: x mandatory` e rolagem suave |
| Pontos do carrossel | o ponto ativo vira uma pílula mais larga | `transition` da largura em 0,25 s |
| Depoimentos | uma faixa rola sozinha, uma volta a cada 65 s, só no computador | `@keyframes` com `translateX`, e a lista repetida duas vezes para não ter emenda |
| Barra fixa | sobe do pé da tela em 0,25 s | aparece quando o cartão da oferta sai da tela pelo topo |

Numa página de oferta, nenhuma seção precisa entrar com animação ao rolar a página. O modelo não usa, e a página fica mais rápida.

## 4. Menos movimento

Com `prefers-reduced-motion: reduce` ligado no sistema:

- os vídeos não começam sozinhos, e fica a capa;
- a faixa de depoimentos fica parada;
- o acordeão e a barra fixa mudam sem transição.

Toda página com animação ou vídeo que começa sozinho traz essa regra.

## 5. O que evitar

- Movimento sem função: contador piscando, botão tremendo, confete.
- Vídeo com som que começa sozinho.
- Animação de entrada que atrasa o preço e o botão.

## 6. Nas páginas de vendas

O Juridiq e o JuriChat mostram o produto funcionando sem nenhum vídeo: tudo é feito com animações da própria página. O que foi medido e vale levar:

| Elemento | Movimento | Como fazer certo |
|---|---|---|
| Letreiro da promoção | corre sem parar, uma volta a cada 40 s a 50 s | parar com o pedido de menos movimento, como os modelos fazem, e ter um botão de pausa |
| Contador | atualiza a cada segundo | só com prazo real, o mesmo escrito na regra da promoção |
| Radar de monitoramento | o ponteiro dá a volta em cerca de 1,5 s, e o cartão troca a cada 9 s | o Juridiq tem um botão de pausa para a troca automática e marca os dados como fictícios |
| Digitação de exemplo | cada pergunta é digitada em cerca de 1,5 s, fica 2 s parada e é apagada em meio segundo | um texto escondido lista todas as perguntas para o leitor de tela, como no Juridiq |
| Números da prova | contam do zero até o valor em cerca de 2 s quando a seção aparece | o valor final já escrito no HTML, e parado com menos movimento; o Juridiq mostra "0+" antes da contagem e conta mesmo com menos movimento |
| História de uso | a conversa fica presa ao lado, a 80 px do topo, e as mensagens surgem conforme cada passo entra na tela | as mensagens surgem no ritmo da rolagem, nunca sozinhas; com menos movimento, a conversa aparece inteira |
| Pontos de "ao vivo" | um ponto pulsa ao lado de "respondendo agora" | um só, perto do produto; nunca no preço nem no botão |

Regras que valem para todas:

- **O que se mexe sozinho por mais de 5 s, junto de outro conteúdo, tem como pausar, parar ou esconder.** É o critério 2.2.2 das diretrizes de acessibilidade do W3C (WCAG 2.2, nível A). O letreiro e a troca automática de cartões entram nessa regra.
- **Uma entrada ao rolar** cabe quando conta uma história, como a conversa do JuriChat. Nunca atrasa o preço nem o botão.
- **A janela da promoção não é movimento de enfeite:** ela segue o princípio 12 de `principios.md`.
