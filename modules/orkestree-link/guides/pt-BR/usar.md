# Como usar

Quando a sua empresa usa o Orkestree para gerir os anúncios, ele encomenda as peças de cada campanha. Este app traz o pedido até o seu projeto, a sua IA produz as peças com o app de criativos no seu plano de IA, e a entrega volta conferida, arquivo por arquivo, para uma pessoa da empresa aprovar antes de ir ao ar.

## Peça assim

- "Tem pedido do Orkestree para mim?"
- "Pode produzir o pedido da campanha de novembro."
- "As peças ficaram prontas. Envia a entrega para o Orkestree."
- "O Orkestree devolveu algum anúncio? Refaz só os devolvidos."

## O que acontece

1. Na primeira vez, a sua IA abre uma página no navegador para você colar o token de produção que você criou no portal do Orkestree.
2. Ela mostra os pedidos abertos, cada um numa frase: a campanha, quantas peças e o prazo. Nada é produzido antes do seu sim.
3. Com o sim, o pedido vai para a pasta da campanha. O app de criativos lê dele a página, o evento, a oferta, as datas e o padrão do nome, e pergunta só o que o pedido não traz, numa mensagem. Os conceitos já vêm aprovados pela empresa.
4. Você vê a prévia de cada peça, como sempre.
5. Antes de enviar, ela pergunta uma coisa só: nenhuma peça traz pessoa, depoimento ou especialista gerado por IA, nem dado pessoal? Com o sim, confere a entrega contra o pedido e envia.
6. Uma pessoa da empresa lê e aprova no Orkestree. Se ela devolver um anúncio, o pedido volta com o motivo, e a sua IA refaz só aquele.

## O que você recebe

| Arquivo | O que é |
|---|---|
| anuncios/(campanha)/pedido.json | o pedido como o Orkestree mandou |
| anuncios/(campanha)/entrega/manifesto.json | a entrega conferida, com os textos e a impressão digital de cada arquivo |
| anuncios/(campanha)/entrega/envio.json | quando foi enviada e o estado do pedido |

## Dicas

- Sem o token, peça à sua IA para pegar o pedido do arquivo que o portal dá. A entrega conferida fica na pasta, e você sobe o manifesto e os arquivos na tela de entrega do pedido.
- Se um texto passar do limite do pedido, a sua IA diz qual e em quantos caracteres: encurte com o app de criativos e envie de novo.

## Limites

- O app não mexe na conta de anúncios. Quem cria o anúncio é o Orkestree, depois da aprovação da empresa.
- Nesta versão, só pedidos de anúncios. Pedidos de conteúdo para as redes chegam numa versão seguinte.
- A sua IA nunca produz sozinha, por agenda: o pedido espera você.
