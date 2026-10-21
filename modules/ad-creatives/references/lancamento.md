# Lançamento: a estrutura, a verba e o que não mexer

Este guia é para a IA. O app prescreve; quem cria a campanha no Gerenciador de Anúncios é o integrante. Você nunca entra na conta de anúncios, nunca pede o login nem um token dela e nunca promete ou prevê resultado.

## 1. A estrutura

- Uma campanha, um conjunto, três anúncios, um por conceito.
- Em cada anúncio, o vídeo vertical vai para Stories e Reels, e o vídeo 4:5 ou a imagem vai para o feed, pela opção de personalizar a peça por posicionamento do Gerenciador. Os arquivos da entrega trazem o posicionamento no nome (`reels`, `feed`, `imagem`, `quadrado`), e `nomes.json` liga cada um ao anúncio.
- Se o Gerenciador não deixar misturar as peças no mesmo anúncio, o integrante usa só o vídeo vertical e confere na prévia do Gerenciador como ele aparece no feed.
- O vídeo 4:5 e as imagens foram conferidos na zona do feed do Instagram, porque a tabela de redes do Motor de vídeo ainda não tem a zona de anúncio do feed. `lancamento.md` diz isso e pede a prévia do Gerenciador antes de publicar.
- Um conjunto só, e não um por conceito: a fase de aprendizado conta eventos por conjunto, e a verba dividida não ensina nenhum.

Depois que o integrante montar a campanha, registre com `journal <campanha> --kind launched --note "…"` se a estrutura coube no Gerenciador e o que ele precisou mudar.

## 2. A conta da verba

A Meta diz que o aprendizado de um conjunto se estabiliza com pelo menos 50 eventos de otimização em 7 dias (Meta, conferido em 2026-10-21). Daí sai a conta que `budget <campanha>` faz com os números do briefing:

| Conta | Fórmula |
|---|---|
| O custo máximo de um evento para sair do aprendizado | verba diária × 7 ÷ 50 |
| O piso diário de um conjunto | custo por evento × 50 ÷ 7, arredondado para cima |
| Quantos conjuntos a verba paga | verba diária ÷ piso, sem a fração |

Exemplos: com R$ 45 por evento e R$ 500 por dia, o piso é R$ 322 e a verba paga 1 conjunto. Com R$ 50 por dia, só um evento que custe até R$ 7 tira o conjunto do aprendizado.

Mostre a conta logo depois do briefing, antes da pesquisa e das peças: com verba pequena e produto caro, ela muda a conversa. Quando a conta não fecha, o app devolve três saídas, e a escolha é do integrante:

1. otimizar por um evento mais cedo no funil, que acontece mais vezes e custa menos;
2. aumentar a verba até o piso;
3. começar assim, sabendo que o conjunto não sai do aprendizado e que a primeira semana serve para comparar os criativos entre si.

O custo por evento vem do integrante (quanto ele aceita pagar, ou quanto custou antes). Sem ele, o app mostra só o custo máximo e pergunta. Nunca chute um custo.

## 3. Antes de ligar

`deliver` grava `lancamento.md` na pasta da campanha com a lista para o integrante conferir: os nomes exatos dos anúncios, os parâmetros de URL, o pixel e a API de Conversões com um evento de teste, nenhum aviso de restrição de categoria no evento escolhido e, quando o site lê o nome do anúncio, cada endereço de conferência mostrando o ângulo certo.

## 4. Enquanto aprende

Pela Meta, trocar o público, o criativo ou o evento de otimização, acrescentar um anúncio ao conjunto, pausar o conjunto e mudar muito o lance ou o orçamento de uma vez podem reiniciar o aprendizado. Na primeira semana, o melhor é não tocar.

## 5. Quando e o que ler

Depois de 7 dias, o integrante exporta do Gerenciador a tabela no nível de anúncio, com o período inteiro: nome do anúncio, valor usado, impressões, alcance, reproduções de vídeo de 3 segundos, ThruPlays, cliques no link, CTR do link, visualizações da página de destino, o evento de otimização e o passo antes dele. O nome do anúncio liga cada linha à peça de `entrega/nomes.json`.

Com verba pequena, o que dá para comparar é quem para no gancho (reproduções de 3 segundos ÷ impressões), quem clica e quanto custa cada visita à página. Para o evento final, a resposta mais provável na primeira semana é dado insuficiente, e isso não é fracasso da peça.

## 6. Antes de pagar

Os vídeos verticais podem sair antes como Reels de teste, que o Instagram mostra só para quem não segue o perfil. O passo a passo está em `reels-de-teste.md`, nesta pasta: o resultado volta como resultado próprio, a evidência mais forte da próxima rodada.
