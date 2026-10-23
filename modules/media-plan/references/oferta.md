# A oferta

Este guia é para a IA. `offer <plano>` calcula as formas de oferta a partir do preço do integrante e aponta o que precisa ser confirmado; este texto diz o que cada forma significa e o que nunca entra.

## 1. A escada

Do menor desconto para o maior. Quanto mais fundo, mais razão escrita a oferta precisa.

1. **Bônus sem desconto.** O preço fica; o que muda é o que vem junto: uma sessão de implantação, a migração dos dados, um mês a mais. Custa pouco para a marca e vale muito para quem começa.
2. **Anual pelo preço de 10 meses, parcelado.** Dois meses de bônus em vez de um desconto no preço. A receita do ano entra de uma vez e o preço de tabela fica preservado.
3. **Preço travado.** O desconto no mensal vale enquanto a assinatura durar. É o que faz a pessoa entrar agora em vez de esperar.
4. **Desconto por tempo limitado,** com data e hora de fim, quantas vagas e o que acontece na renovação, tudo escrito.

## 2. O que a oferta nunca é

- **Plano vitalício:** corta a receita recorrente e lota o suporte para sempre.
- **Desconto só no primeiro mês:** atrai quem cancela no segundo.
- **Cupom sobre preço de campanha:** o preço de referência deixa de ser verdadeiro.
- **Desconto mais fundo a menos de 30 dias de outro:** quem comprou antes paga mais do que quem esperou, e quem está em dúvida aprende a esperar. `offer` chama isso de colisão e dá duas saídas: a promoção de agora vira o acesso antecipado da do pico, com o mesmo preço e um bônus a mais; ou a do pico muda de forma (anual, bônus) em vez de baixar mais o preço.

## 3. As linhas do código do consumidor

Uma oferta vendida à distância no Brasil carrega estas linhas. O script as lista como pendentes para o integrante confirmar; isto é método, não parecer jurídico.

- O preço de referência (o "de") é o preço de tabela praticado, não um preço inflado para a promoção.
- O prazo está escrito na página e no anúncio, com data e hora.
- As regras estão escritas: quem pode, quantas vagas, o que acontece na renovação.
- A compra à distância tem 7 dias de arrependimento com devolução do valor. Dizer isso antes vira argumento de venda.
- Quem já é cliente nunca paga mais do que quem entra agora: existe uma condição para ele.

## 4. Capacidade

Uma oferta que vende mais do que o time implanta vira reembolso dentro dos 7 dias e cancelamento no mês seguinte. A premissa de capacidade entra na conta dos cenários: um cenário acima da capacidade aparece marcado, e as vagas da oferta saem dele.
