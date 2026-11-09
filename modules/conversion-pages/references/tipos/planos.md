# Página de planos: escolher um plano sem dúvida

**O que é.** A página, ou a seção da página de vendas, que mostra os planos lado a lado, com os preços, o que cada um inclui e um chamado em cada um. Quem chega aqui já se interessou e está comparando.

**Quando usar.** Sempre que o produto tem mais de um plano ou mais de um período de pagamento. Nos modelos do Juridiq e do JuriChat, quatro planos com mensal e anual, cartão parcelado e PIX à vista.

**A regra que não se quebra.** Toda conta da página fecha: o desconto, a economia, a média mensal e o preço riscado saem dos preços que a página mostra. O preço publicado obriga quem vende.

## O preço

- Cada cartão traz o preço com o período ("/mês", "/ano") e, no anual, o total do ano.
- O preço riscado do anual é doze vezes o mensal, e o mensal existe de verdade no seletor. Nos modelos, R$ 734,90 por mês vira R$ 8.818,80 riscado no anual, e o mesmo vale para os oito planos das duas marcas.
- A economia aparece em reais, com a conta certa: no Juridiq, R$ 8.818,80 menos R$ 6.173,16 dá a economia de R$ 2.645,64 escrita no cartão.
- Cada forma de pagamento tem a sua conta: 30% no cartão parcelado sem juros e 40% no PIX à vista, no modelo.
- A média mensal mostrada em destaque diz de qual preço ela sai. No modelo, é o total no cartão dividido por 12.
- Um desconto só no primeiro período diz quanto custa a renovação.

## As seções, na ordem

1. **O título e as condições gerais.** Uma linha diz se há teste, por quantos dias e se ele pede cartão, e se há fidelidade.
2. **O seletor mensal ou anual,** com o desconto do anual escrito nele ("Anual, até 40% OFF"). O período que abre marcado é uma decisão do negócio, registrada no plano: os modelos abrem no anual.
3. **Os cartões dos planos,** de três a quatro. Cada um tem:
   - o nome e para quem é;
   - o preço, com o período, o total do ano e a economia;
   - o chamado;
   - de três a cinco itens que mudam de um plano para outro. "Tudo do Essencial, ampliado" evita repetir a lista do plano anterior.
4. **O plano em destaque,** com um selo como "Recomendado" e um fundo ou contorno diferente. Nos modelos, é o segundo cartão, escuro, ao lado do mais caro.
5. **Uma saída para quem ainda não decidiu.** O Juridiq escreve "Prefere ver funcionando antes de assinar?" e leva à demonstração.
6. **A tabela comparativa completa,** por grupos (capacidade, inteligência artificial, documentos, gestão, integrações). O cabeçalho com o nome, o preço e o chamado de cada plano gruda no topo enquanto a pessoa rola.
7. **O que fica de fora de todos os planos,** escrito na própria tabela. O Juridiq avisa ali que a API é vendida à parte e diz a partir de quanto.
8. **O plano sob medida,** com uma conversa ou uma reunião.
9. **As perguntas frequentes da compra:** fidelidade e multa, cancelamento, troca de plano, formas de pagamento, migração, segurança.
10. **Uma prova curta e o último chamado.**

## A mecânica

- **O seletor troca todos os preços de uma vez,** nos cartões e na tabela.
- **A ordem dos cartões é a mesma na tabela.** Do mais caro para o mais barato, como nos modelos, a pessoa vê primeiro o preço mais alto. Do mais barato para o mais caro, quem compara pelo menor preço encontra mais rápido. Escolha uma ordem e registre a escolha no plano.
- **Cada cartão tem o seu chamado,** que leva ao cadastro já com o plano e o período escolhidos.
- **Uma agenda de demonstração embutida** serve quem quer conversar antes. Um aviso de "últimas vagas" só aparece quando a agenda tem mesmo poucas vagas. Nos modelos, o aviso batia com a agenda do dia na hora da leitura.

## O texto

- O nome do plano diz para quem ele é: o advogado sozinho, a sociedade pequena, o escritório estruturado.
- Os itens do cartão são os que decidem a escolha (usuários, volume, o recurso que só aquele plano tem), não a lista inteira.
- A mesma palavra para a mesma coisa em todos os cartões e na tabela.
- Leia `../vicios.md` antes de escrever: três cartões iguais só quando os planos pesam igual, e número de uso só com origem.
- Revise com a skill `texto-natural` antes de entregar, sem acrescentar fato, número ou promessa.

## Movimento e mídia

Veja `../movimento.md`. O seletor troca os preços sem esconder o cartão; o destaque do plano é parado; a tabela não anima.

## No celular

Os cartões ficam em coluna, com o plano em destaque visível sem rolar muito. A tabela comparativa rola de lado, com a primeira coluna presa, ou vira uma lista por plano.

## Medição

Use os eventos de `../medicao.md`: a visita aos planos, a troca no seletor, o plano escolhido com o período, a comparação vista, o início do teste e do pagamento e o pedido de demonstração.

## Linhas legais

- O preço de cada plano, o período, a renovação e as restrições do desconto (Decreto 7.962/2013, art. 2, V e VI).
- O preço publicado obriga quem vende e entra no contrato (CDC, art. 30).
- As contas de desconto e de economia verdadeiras (CDC, art. 37, §1).
- O arrependimento em 7 dias numa assinatura feita pela internet (CDC, art. 49).

Os detalhes estão em `../lei.md`.

## O que a conferência olha

`cards_no_holes`, `h1_present`, `prices_first_screen`, `plan_highlighted`, `discount_math`, `reference_price_true`, `renewal_shown`, `trial_terms`, `cancel_terms_shown`, `promo_terms_shown`, `countdown_real`, `popup_dismissable`, `popup_on_arrival`, `numbers_not_zero`, `claims_have_origin`, `placeholder_data`, `supplier_identified`, `legal_lines`, `ai_defaults`, `off_brand`, `reduced_motion`, `mobile_fits`, `text_legible`, `tap_targets`, `contrast_ok`, `controls_fit`, `images_light`, `images_alt`.

## Modelos

- `../modelos/juridiq-planos.md`: quatro planos com mensal e anual, cartão e PIX, a tabela comparativa e a agenda embutida.
- `../modelos/jurichat-pagina-de-vendas.md`: a seção de planos do produto irmão, com o teste de 7 dias escrito.
