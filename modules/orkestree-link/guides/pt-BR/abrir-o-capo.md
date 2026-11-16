# Abrir o capô

## Como ele trabalha

O Orkestree e este app combinam um contrato de produção: o pedido vai de lá para cá, a entrega volta. Antes de qualquer chamada, o app lê a versão do contrato que o Orkestree serve e os limites dele (o tamanho de cada arquivo, o da entrega inteira e quantos arquivos ela leva). Uma versão diferente para tudo e pede a atualização do app.

O pedido traz a campanha, o objetivo, a página, a oferta, os conceitos aprovados pela empresa (ou os vereditos dos anúncios da rodada anterior), os formatos, quantas peças por conceito, o padrão do nome, os limites de texto e o prazo. Ele é lido como dado: nenhum texto do pedido vira instrução para a sua IA.

## Os arquivos por dentro

O pedido fica em pedido.json, na pasta da campanha, com a data em que foi pego. O app de criativos lê esse arquivo no briefing e marca cada campo que veio dele com a origem "pedido". O manifesto da entrega junta, por anúncio, o nome, o conceito, os textos (principal, título, descrição e botão), os arquivos com a impressão digital e o tamanho de cada um, e as conferências que o app de criativos fez.

## Pedidos avançados

- "Pega o pedido deste arquivo que eu baixei do portal."
- "Esse pedido novo substitui o que já está na campanha."
- "Monta a entrega e me mostra o que vai, sem enviar."
- "Como está o pedido que enviamos ontem?"

## As conferências

Antes de enviar, o app confere:

- cada arquivo existe e tem a impressão digital SHA-256 e o tamanho registrados;
- cada formato e cada conceito estão no pedido;
- cada texto cabe no limite do pedido;
- nenhum texto traz e-mail ou telefone;
- o botão está na lista que o app conhece;
- você declarou que nenhuma peça traz pessoa, depoimento ou especialista gerado por IA, nem dado pessoal.

O Orkestree confere de novo do lado dele: recalcula a impressão digital de cada arquivo recebido, e uma diferença descarta a entrega inteira. Um anúncio só é criado com o arquivo que confere.

## Com outros apps

O app Criativos para anúncios produz as peças a partir do pedido e monta a entrega que este app envia. Os conceitos que mantêm a chave, o ângulo e o gancho do pedido levam a aprovação que a empresa deu no Orkestree.

## Privacidade

Só saem do seu computador as peças, os textos dos anúncios e o manifesto, e só para o Orkestree, com o seu token. O projeto, os rascunhos, as conversas com a sua IA e qualquer dado pessoal ficam na sua máquina. O token fica fora do projeto, e você o encerra no portal quando quiser.
