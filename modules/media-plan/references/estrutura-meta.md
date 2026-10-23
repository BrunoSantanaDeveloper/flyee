# A estrutura na Meta

Este guia é para a IA. `structure <plano>` escreve `estrutura.json` e a seção do plano; este texto é o porquê de cada escolha, para você explicar ao integrante em linguagem de negócio. Quem cria a campanha no Gerenciador é ele.

## O objetivo honesto

A campanha otimiza pelo evento da premissa, e só por ele. Um produto caro com verba pequena não sai da fase de aprendizado otimizando por compra (cerca de 50 compras por semana no conjunto); otimiza por lead, e a compra é lida pela planilha de origem. Dizer "vendas" no objetivo e esperar leads é o erro que a leitura paga depois.

## Um conjunto, com razão

Com a verba dividida em dois conjuntos, nenhum chega aos 50 eventos por semana. Um conjunto só, amplo, com três anúncios (um por conceito), é a estrutura da primeira leva. Dois conjuntos só quando a verba cobre dois pisos; aí o segundo compara interesses do nicho contra o amplo por 14 dias, e o que ler pior sai.

## Amplo contra interesses

O amplo (país, idade de quem compra, sem interesse) deixa a Meta achar quem converte pelo evento, e costuma vencer com criativo que fala com o público certo. Interesses são um teste, não um padrão. Exclusões sempre: os clientes atuais (a lista da base, em hash, atualizada toda semana), quem já converteu no evento nos últimos 30 dias, quem já está na lista de espera.

## Posicionamentos

Advantage+ (todos), com a peça certa por posicionamento: o vídeo 9:16 em Stories e Reels, o vídeo 4:5 e a imagem no feed. Tirar posicionamentos encarece; a personalização por posicionamento resolve o formato.

## A verba contra o piso

O piso de aprendizado é 50 vezes o custo por evento dividido por 7 por dia por conjunto. Um conjunto abaixo do piso roda, mas a semana 1 compara criativos pelo gancho e pelo CTR, não por resultado; o plano registra que aceitou isso. A estrutura recusa um conjunto abaixo do piso sem esse aceite escrito.

## Os nomes

Campanha `<plano>-meta`, conjunto `<plano>-<publico>`, anúncio com o nome que o app de criativos entrega: é o mesmo nome que vai em `utm_content`, e é ele que liga o resultado à peça na leitura.

## Remarketing por etapa

Os públicos nascem vazios e se formam durante os testes; a verba deles entra na fase de escala:

| Etapa | Quem | Fonte | Janela | Mensagem |
|---|---|---|---|---|
| visitou | visitou a página e não cadastrou | PageView | 30 dias | a prova e a objeção respondida |
| cadastrou e não ativou | entrou na lista ou cadastrou e não usou | Lead sem ativação | 30 dias | o primeiro passo decidido |
| ativou e não pagou | usou e não assinou | ativação sem Purchase | 60 dias | a oferta, com o prazo |
| viu a oferta | abriu a página da oferta e não comprou | PageView da oferta ou InitiateCheckout | 14 dias | o lembrete e o último dia |

Frequência acima de 5 por semana cansa um público pequeno: a base é alcançada por e-mail e mensagem, e o remarketing fica com a verba que a frequência permite.

## O semelhante a partir da base

A partir de 1.000 contatos reconhecidos, o público semelhante (1%) da lista de clientes vale um conjunto de teste contra o amplo. Com 100 a 1.000, a Meta aceita, mas o semelhante sai fraco: entre como teste pequeno. Abaixo de 100, não há semelhante. A lista sobe em hash, pelo app de base.

## Antes de ligar

Nenhum anúncio sobe antes do rastreamento conferido e da oferta na página. A subida do pico é programada com data, 2 dias antes, para passar pela revisão. Uma mudança significativa por conjunto por semana: a seguinte espera a leitura.
