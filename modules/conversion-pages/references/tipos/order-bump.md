# Order bump: a caixa antes de pagar

**O que é.** Um item pequeno oferecido dentro do checkout, numa caixa que a pessoa marca antes de pagar. Ele entra no mesmo pagamento, sem outra tela.

**Quando usar.** Quando há um complemento barato, perto do produto principal, que quase todo comprador acharia útil: um módulo extra, uma versão estendida, um acesso a mais, uma garantia estendida, algo que a pessoa recebe na hora.

**A regra que não se quebra.** A caixa vem desmarcada, e só a pessoa marca. Um item cobrado sem pedido é produto não solicitado. A lei o equipara a uma amostra, sem obrigação de pagamento (CDC, art. 39, III e parágrafo único), e isso vira estorno e reclamação.

## A oferta

- Um item só, ligado ao principal e bem mais barato do que ele.
- O preço do item escrito na própria caixa. O total do pedido muda na hora em que a caixa é marcada.
- Se o item for uma assinatura, a renovação aparece na própria caixa.

## Onde fica e como funciona

1. Dentro do checkout, logo acima do botão de pagar, depois dos dados de pagamento.
2. Numa caixa com moldura que se destaca do formulário (borda tracejada ou fundo de cor), sem esconder os campos.
3. Com um título que começa pela ação ("Sim, quero também o checklist de lançamento"), uma ou duas linhas sobre o que é e por que vale levar agora, e o preço.
4. Marcar a caixa atualiza o resumo do pedido e o valor escrito no botão de pagar.

## O texto

- O título diz, em poucas palavras, o que a pessoa ganha.
- A descrição diz o que é o item e como e quando ela o recebe.
- Nada de "oferta única" nem de contador, a não ser que seja verdade.

## No celular

A caixa aparece antes do botão de pagar, sem ser preciso rolar a tela inteira. Tocar em qualquer ponto da caixa marca a opção, não só no quadradinho.

## Medição

Os eventos são `bump_view` quando a caixa aparece, `bump_add` e `bump_remove` ao marcar e desmarcar, e a compra com o item listado separado do principal. A taxa de aceite é o número de compras com o item dividido pelo total de compras.

## Linhas legais

- A caixa começa desmarcada (CDC, art. 39, III).
- O item aparece descrito e o preço aparece separado (Decreto 7.962/2013, art. 2).
- Quem desiste do pedido desfaz o item junto (art. 5, §2).

## O que a conferência olha

`no_prechecked`, `bump_near_pay`, `price_shown`, `reference_price_true`, `discount_math`, `renewal_shown`, `countdown_real`, `placeholder_data`, `video_autoplay_ok`, `reduced_motion`, `legal_lines`, `mobile_fits`, `text_legible`, `tap_targets`, `contrast_ok`, `controls_fit`, `images_light`, `images_alt`.

## Modelos

Nenhum ainda.
