# Ligação com o Orkestree

Quando a sua empresa usa o Orkestree para gerir os anúncios, ele lê os resultados, decide o que testar e encomenda as peças. Este app traz o pedido até o seu projeto, onde a sua IA produz as peças com o app de criativos, no seu plano de IA, e devolve a entrega conferida. Este texto é o guia dentro do projeto; a página do app no flyee.club lê os guias em `guides/`.

## O que ele faz

A sua IA mostra os pedidos abertos da empresa, cada um numa frase: a campanha, quantas peças e o prazo. Com o seu sim, ela grava o pedido na pasta da campanha. O app de criativos lê o pedido no briefing: a página, o evento, a oferta, as datas e o padrão do nome vêm de lá e não voltam como pergunta, e o sim aos conceitos é o que a empresa deu no Orkestree.

Quando as peças ficam prontas, a sua IA confere a entrega contra o pedido: cada arquivo com a impressão digital e o tamanho, cada texto dentro do limite, nenhum conceito ou formato que o pedido não pediu. Ela pede o seu sim a uma declaração: nenhuma peça traz pessoa, depoimento ou especialista gerado por IA, nem dado pessoal. Aí envia.

O app não mexe na conta de anúncios. Quem cria o anúncio é o Orkestree, e só depois que uma pessoa da empresa lê e aprova a entrega.

## O que você precisa

- Uma das IAs em que o app foi testado.
- O app Criativos para anúncios, que a sua IA instala na primeira vez, se faltar.
- O token de produção, que você cria no portal do Orkestree. A sua IA abre uma página no navegador para você colar. Sem ele, veja abaixo.

## Sem a chave (o token)

O pedido vem pelo arquivo que o portal do Orkestree dá: salve na pasta do projeto e peça à sua IA para pegar o pedido desse arquivo. A entrega conferida fica na pasta da campanha, com o manifesto, e você sobe os dois na tela de entrega do pedido, no portal.

## Peça assim

> "Tem pedido do Orkestree para mim?"
>
> "Pode produzir o pedido da campanha de novembro."
>
> "As peças ficaram prontas. Envia a entrega para o Orkestree."

## O que ele grava

| Caminho | Conteúdo |
|---|---|
| `anuncios/<campanha>/pedido.json` | o pedido como o Orkestree mandou, com a data em que foi pego |
| `anuncios/<campanha>/entrega/manifesto.json` | a entrega conferida: cada anúncio com os textos, os arquivos, a impressão digital e o tamanho de cada um e as conferências |
| `anuncios/<campanha>/entrega/envio.json` | o registro do envio: quando, o número da entrega e o estado do pedido |

## Bom saber

- Um pedido devolvido volta com o motivo de cada anúncio. A sua IA refaz só os devolvidos.
- A sua IA nunca produz sozinha, por agenda: o pedido espera você abrir a sessão e dizer sim.
- O token é seu, da sua empresa. Ele fica na sua máquina, fora do projeto, e você o encerra no portal quando quiser.

## O que há de novo

- 1.0.1: a entrega diz qual versão do app de criativos a produziu, e o app confere antes de enviar o que o Orkestree recusaria: o ângulo de cada anúncio, quantas peças por conceito, nomes repetidos e o nome de cada arquivo.
- 1.0.0: primeira versão. Pedidos de peças de anúncio, entrega conferida com a impressão digital de cada arquivo, modo sem token pelo portal.
