# A medição das páginas de oferta

Este guia é para a IA. Sem medir cada oferta, não dá para saber o que vende.

## 1. Os eventos

| Página | Eventos |
|---|---|
| Order bump | `bump_view`, `bump_add`, `bump_remove`; a compra com o item listado separado do principal |
| Upsell | `offer_view`, `offer_accept`, `offer_decline`, `offer_payment_error` |
| Downsell | `downsell_view`, `downsell_accept`, `downsell_decline` |
| Cross-sell | `cross_sell_view`, `cross_sell_add`, com a posição: produto, carrinho ou obrigado |
| Obrigado | `purchase` com valor, moeda e a identificação do pedido; `activation_click` |

Cada evento leva a identificação do pedido. Nunca leva o nome ou o e-mail da pessoa.

## 2. Uma identificação por posição de chamado

O mesmo botão aparece no topo, no cartão da oferta e na barra fixa. Cada posição leva a sua identificação: a Hostinger usa um `data-click-id` para o botão do cartão e outro para o da barra fixa. Com isso, a leitura dos resultados mostra qual posição converte.

## 3. As seções vistas

Registrar quando cada seção entra na tela mostra até onde as pessoas leem antes de decidir. A Hostinger registra cada seção uma vez, quando ela passa da metade da tela. Para isso usa um `IntersectionObserver` com `rootMargin: 0px 0px -50% 0px`.

## 4. As contas

- **Aceite do order bump:** compras com o item divididas pelo total de compras.
- **Aceite do upsell:** aceites divididos pelas vezes que a oferta foi vista.
- **Aceite do downsell:** aceites divididos pelas recusas do upsell.
- **Receita por pedido:** o total pago no pedido, já com o que foi acrescentado.
- **Estornos e arrependimentos das ofertas,** contados separados dos do produto principal.

As taxas vêm dos números do próprio negócio. Este app não traz taxas de mercado: um número sem fonte não serve para decidir.

## 5. A compra conta uma vez

O evento de compra sai uma vez por pedido, com a mesma identificação no navegador e no servidor, para a plataforma de anúncios descartar a duplicata. Recarregar a página de obrigado não pode contar outra venda.
