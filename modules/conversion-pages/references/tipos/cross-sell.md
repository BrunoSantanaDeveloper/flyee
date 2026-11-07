# Cross-sell: o que combina com o que a pessoa leva

**O que é.** Produtos relacionados, oferecidos ao lado do que a pessoa está comprando ou acabou de comprar: na página do produto, no carrinho, na página de obrigado ou no e-mail depois da compra.

**Quando usar.** Quando há itens que costumam ser comprados juntos, ou que completam o uso do produto principal.

**A regra que não se quebra.** Relevância antes de quantidade: de um a três itens, ligados ao que está no carrinho, e nunca entre a pessoa e o botão de pagar.

## Onde

- **Página do produto:** abaixo do botão de comprar, os itens que combinam, com o preço. Um kit com desconto, quando faz sentido.
- **Carrinho:** um ou dois itens que completam o que já está lá. Adicionar leva um toque e não tira a pessoa do carrinho.
- **Página de obrigado:** um item para a próxima etapa do uso (veja `obrigado.md`). O pedido já está pago, então não há pressa.
- **No pagamento, não.** Ali o lugar é do order bump (`order-bump.md`), não de uma vitrine.

## O texto

Escreva "quem comprou X também levou Y" só quando for dado real da loja. Fora isso, diga para que o item serve junto com o principal.

## Medição

Os eventos são `cross_sell_view` e `cross_sell_add`, com o item e a posição (produto, carrinho ou obrigado). Compare a receita por pedido com e sem o item.

## Linhas legais

- Nada vem pré-selecionado no carrinho (CDC, art. 39, III).
- O preço do item e o total atualizado ficam à vista (Decreto 7.962/2013, art. 2).

## O que a conferência olha

`no_prechecked`, `price_shown`, `reference_price_true`, `proof_about_offer`, `countdown_real`, `video_autoplay_ok`, `reduced_motion`, `legal_lines`, `images_alt`.

## Modelos

Nenhum ainda.
