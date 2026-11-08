# Página de obrigado: o fim do pedido

**O que é.** A página que confirma a compra. É a primeira experiência do cliente depois de pagar, e ela pesa para que ele chegue a usar o que comprou.

**A regra que não se quebra.** Ela confirma o que foi comprado e mostra o primeiro passo para usar. Nada nela pode parecer uma nova cobrança.

## As seções, na ordem

1. **A confirmação:** "Pedido concluído", o número do pedido, o que foi comprado (inclusive o que foi acrescentado no upsell ou no order bump) e o valor.
2. **O que acontece agora:** o recibo no e-mail, quando o acesso chega, onde entrar.
3. **O primeiro passo:** um botão para começar a usar, como "Acesse o painel" ou "Comece o curso".
4. **Ajuda:** o contato do suporte e o caminho para cancelar ou pedir o arrependimento.
5. **Um item para depois**, opcional (`cross-sell.md`), abaixo do primeiro passo.

## A mecânica

- A compra é medida aqui, uma vez só. Recarregar a página não conta outra venda.
- Se a pessoa aceitou um upsell, uma linha diz o que foi adicionado. A Hostinger escreve: "Um agente da Hostinger foi adicionado ao seu pedido."

## Medição

O evento `purchase` sai com valor, moeda e uma identificação única do pedido, que permite descartar a duplicata entre navegador e servidor. O `activation_click` sai no primeiro passo.

## Linhas legais

- A confirmação da compra chega na hora, e o contrato fica disponível para guardar (Decreto 7.962/2013, art. 4, III e IV).
- O caminho do arrependimento aparece de forma clara (art. 5).

## O que a conferência olha

`thank_you_basics`, `cta_first_screen`, `legal_lines`, `placeholder_data`, `video_autoplay_ok`, `reduced_motion`, `mobile_fits`, `text_legible`, `tap_targets`, `contrast_ok`, `controls_fit`, `images_light`, `images_alt`.

## Modelos

- `../modelos/hostinger-agente-pos-compra.md`: a página de pedido concluído.
