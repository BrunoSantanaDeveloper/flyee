# Downsell: a segunda oferta depois da recusa

**O que é.** Uma oferta mostrada uma vez, logo depois que a pessoa recusou o upsell. Ela muda o que provavelmente pesou na recusa: o preço, o compromisso ou o tamanho.

**Quando usar.** Quando existe uma versão menor, mais barata ou com menos compromisso do que a oferta recusada: um plano mais simples, um período menor, um desconto maior no primeiro período, um teste.

**A regra que não se quebra.** O downsell é de fato diferente da oferta recusada e aparece uma vez só. Depois dele, a pessoa segue para o obrigado, aceite ou recuse.

## A oferta

- Mude uma coisa e diga qual: o mesmo pacote com um desconto maior no primeiro mês, só uma parte do pacote, um mês sem compromisso.
- Nunca repita a mesma oferta com outro título.

## As seções, na ordem

1. Um aviso no topo de que o pedido está confirmado. A Hostinger usa "Seu pedido foi confirmado."
2. O título com o que mudou. No modelo: "Toda a equipe de IA." seguido do desconto.
3. Uma frase com o preço do primeiro período e a renovação.
4. Três itens: o que inclui, por quanto tempo e como cancelar.
5. O botão, a nota sobre o pagamento, a garantia e a recusa.

A página é curta: uma tela no computador, duas no celular.

## A mecânica

É a mesma do upsell (`upsell.md`): um clique, com o valor confirmado antes de cobrar. Recusar leva ao obrigado.

## Medição

Os eventos são `downsell_view`, `downsell_accept` e `downsell_decline`. A taxa de aceite do downsell conta só sobre quem recusou o upsell.

## Linhas legais

As mesmas do upsell (`upsell.md`).

## O que a conferência olha

`cta_first_screen`, `decline_visible`, `decline_honest`, `price_shown`, `reference_price_true`, `renewal_shown`, `guarantee_near_cta`, `charge_clear`, `countdown_real`, `video_autoplay_ok`, `reduced_motion`, `legal_lines`, `images_alt`.

## Modelos

- `../modelos/hostinger-agente-pos-compra.md`: a página de última chance.
