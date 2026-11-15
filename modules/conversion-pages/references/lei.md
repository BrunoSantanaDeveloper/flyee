# As linhas da lei nas páginas que vendem

Este guia é para a IA. É um método para não errar o básico; não é parecer jurídico. Em caso de dúvida, o integrante consulta o advogado dele.

Artigos conferidos em 2026-11-07, no texto publicado pela Presidência da República (planalto.gov.br). Valem para a venda ao consumidor; numa venda só entre empresas, o integrante confirma com o advogado dele o que se aplica.

## Código de Defesa do Consumidor (Lei 8.078/1990)

| Artigo | O que diz | Na página de oferta |
|---|---|---|
| art. 6, III | direito à informação adequada e clara sobre o produto, inclusive o preço | o valor, a renovação e o que está incluído aparecem antes do clique |
| art. 30 | a informação ou publicidade suficientemente precisa obriga quem a divulga e integra o contrato | o preço, o desconto, o prazo e as condições escritos na página são cumpridos; perguntas frequentes, cartões e janela dizem a mesma coisa |
| art. 31 | a oferta traz informação correta, clara, precisa, ostensiva e em português sobre preço, garantia e prazos | preço, garantia e prazo visíveis, em português |
| art. 35 | se quem vende recusa cumprir a oferta, o consumidor pode exigir o cumprimento, aceitar algo equivalente ou desfazer o contrato com a devolução do que pagou | uma promoção anunciada vale como foi escrita |
| art. 37, §1 | é enganosa a informação falsa, mesmo em parte ou por omissão, capaz de induzir em erro sobre preço e características | preço riscado só se for o real; contador só com prazo real; o que a página promete, ela mostra |
| art. 39, I | é prática abusiva condicionar o fornecimento de um produto a outro | o produto principal nunca depende de aceitar a oferta |
| art. 39, III e parágrafo único | é prática abusiva fornecer produto ou serviço sem pedido prévio; o que foi entregue assim equivale a amostra, sem obrigação de pagamento | order bump e itens do carrinho começam desmarcados |
| art. 49 | quem compra fora do estabelecimento, o que inclui a internet, pode desistir em 7 dias e recebe de volta o que pagou, corrigido e na hora | o caminho do arrependimento escrito e fácil de achar |

## Decreto 7.962/2013 (comércio eletrônico)

| Artigo | O que exige |
|---|---|
| art. 2 | em destaque no site: nome empresarial e CNPJ ou CPF, endereço físico e eletrônico, as características essenciais, as despesas extras separadas no preço, as condições integrais da oferta e as restrições a ela |
| art. 4 | um resumo do contrato antes da contratação; ferramentas para corrigir erros antes de concluir; confirmação imediata de que a aceitação chegou; o contrato disponível para guardar; atendimento por meio eletrônico |
| art. 5 | os meios do arrependimento informados com clareza; o arrependimento pela mesma ferramenta usada na compra; ele desfaz os contratos acessórios sem ônus (§2); a desistência comunicada à operadora do cartão, para não cobrar ou estornar (§3) |

O §2 do art. 5 vale para toda oferta acrescentada ao pedido. Quem desiste do pedido principal desfaz também o order bump e o upsell, sem custo.

## O preço à vista e as parcelas

Conferidos em 2026-11-09, no texto publicado pela Presidência da República.

| Norma | O que diz | Na página de oferta |
|---|---|---|
| Lei 10.962/2004, art. 2, III (incluído pela Lei 13.543/2017) | no comércio eletrônico, o preço à vista é divulgado em destaque, junto da imagem ou da descrição, com letra de pelo menos 12 | o preço à vista aparece ao lado das parcelas, e não só no checkout |
| Lei 10.962/2004, art. 5-A (incluído pela Lei 13.455/2017) | o desconto que depende do prazo ou da forma de pagamento é informado em local visível | o desconto no PIX ou à vista aparece na oferta |
| Decreto 5.903/2006, art. 3 | o preço é informado com o total à vista; no parcelamento, também o total a pagar, o número, a periodicidade e o valor das parcelas, os juros e os acréscimos | "R$ 9.720 à vista ou 12x de R$ 810, sem juros, total de R$ 9.720" |
| Decreto 5.903/2006, art. 9, IV | é infração informar o preço só em parcelas, obrigando a pessoa a calcular o total | parcelas sozinhas nunca são o preço |

## O que vira conferência

| O que a conferência olha | Item |
|---|---|
| uma caixa paga que já vem marcada | `no_prechecked` |
| preço riscado sem o preço real registrado | `reference_price_true` |
| contador sem prazo registrado | `countdown_real` |
| assinatura sem a renovação escrita | `renewal_shown` |
| sem política de privacidade, termos ou o caminho do arrependimento | `legal_lines` |
| sem o CNPJ ou o CPF, o endereço e um contato de quem vende (art. 2, I e II) | `supplier_identified` |
| uma promoção sem a data em que termina (art. 2, V e VI) | `promo_terms_shown` |
| um teste grátis sem a duração (art. 31 do CDC; art. 2, V) | `trial_terms` |
| um desconto, uma economia, uma média mensal ou um total de parcelas que não fecha com os preços (art. 37, §1) | `discount_math` |
| parcelas sem o preço à vista nem o total (Decreto 5.903/2006, art. 9, IV) | `cash_price_shown` |
| uma lista de valores cujo total não é a soma dos itens (art. 37, §1) | `stack_sum` |
| preços sem como cancelar e sem dizer se há fidelidade (art. 6, III) | `cancel_terms_shown` |
| um número de uso, uma escassez ou uma data sem origem registrada (art. 37, §1) | `claims_have_origin` |
| um nome ou um texto de exemplo esquecido na página (art. 37, §1) | `placeholder_data` |
| uma demonstração sem a etiqueta de dados de exemplo (art. 30 e art. 37, §1) | `demo_honest` |
