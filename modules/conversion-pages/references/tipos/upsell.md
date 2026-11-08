# Upsell: a oferta logo depois da compra

**O que é.** Uma segunda oferta mostrada logo depois que o pagamento do pedido foi confirmado, antes da página de obrigado. A pessoa acabou de decidir comprar, e a oferta aproveita esse momento para aumentar o que ela leva.

**Quando usar.** Quando existe um produto que deixa a compra melhor, mais rápida ou mais completa: uma versão superior, um serviço que usa o que foi comprado, um complemento que quase todo cliente acaba querendo. No modelo da Hostinger, quem acabou de comprar hospedagem ou domínio recebe a oferta do agente de IA.

**A regra que não se quebra.** O pedido principal já está confirmado e não depende desta resposta. A pessoa recusa com um clique e segue para o obrigado. Quem aceita vê o valor antes de ser cobrado.

## A oferta

- Um produto só, ligado ao que foi comprado. Duas ofertas na mesma página dividem a decisão.
- Um preço melhor do que o da loja, com uma diferença verdadeira: o primeiro mês pela metade, um desconto que só existe nesta tela, um bônus que não se vende avulso.
- Numa assinatura, o valor da renovação e a periodicidade na mesma frase do preço de agora.
- A garantia ou o cancelamento simples, repetidos perto de cada chamado.

## As seções, na ordem

1. **O progresso do pedido.** As etapas no topo (Pedido recebido, Sua oferta, Pedido concluído) mostram que a compra deu certo e que falta um passo. Isso tira o medo de ter pago duas vezes.
2. **A faixa da oferta.** Uma linha que diz que esta oferta é para quem acabou de comprar.
3. **O topo.** O título traz o resultado que o produto entrega. Uma frase diz o que é, o preço normal e o preço desta tela. Depois vêm a garantia e as ferramentas com que ele funciona. Ao lado, a demonstração do produto em uso.
4. **O cartão da oferta.** De um lado, o produto e o que ele inclui: de quatro a seis itens, cada um com um título e uma linha. Do outro, a compra, nesta ordem:
   - o preço normal riscado, o desconto e o preço de agora;
   - a renovação;
   - o botão;
   - a nota sobre o pagamento e a garantia;
   - a recusa.
5. **A comparação.** O produto contra a alternativa que a pessoa já conhece (na Hostinger, a "IA genérica"), com quatro linhas curtas de cada lado.
6. **O que dá para fazer.** Os recursos ou especialistas, cada um com uma demonstração curta.
7. **Exemplos concretos.** Os pedidos mais comuns, em cartões com imagem.
8. **Com o que se conecta**, quando isso faz parte do valor.
9. **A prova.** Depoimentos sobre o produto oferecido.
10. **Um último chamado e a recusa.**

A barra fixa com o preço e o botão aparece quando o cartão da oferta sai da tela pelo topo, e some quando ele volta.

## A mecânica

- **Um clique, com o valor confirmado.** Quando o provedor de pagamento guarda o meio usado no pedido, o botão aceita a oferta sem formulário. Antes de cobrar, uma janela curta mostra:
  - o produto e o valor do primeiro período;
  - os impostos e o total de hoje;
  - o meio de pagamento, com a opção de trocar;
  - a renovação.

  Os botões da janela são "Confirme e pague R$ X" e "Voltar". Antes disso, a nota do cartão já avisa: usa o mesmo método de pagamento do pedido, sem formulários.
- **Sem o meio de pagamento salvo**, o botão leva a um pagamento curto e já preenchido, nunca a um carrinho do zero.
- **A recusa** leva ao downsell, se existir um de fato diferente, ou ao obrigado.
- **Um erro no pagamento** gera uma mensagem que diz o que aconteceu e oferece tentar de novo ou seguir sem a oferta.
- **Recarregar a página** volta para a mesma etapa. A oferta não aparece duas vezes nem some do nada.

## O texto

- O título fala do resultado para o negócio de quem comprou, não do produto.
- A frase de apoio diz o que é, para quem é e quanto custa, nessa ordem.
- O botão diz a ação, como "Adicionar ao meu pedido", e não algo genérico como "Comprar".
- A recusa usa palavras neutras.
- Antes de entregar, revise o texto com a skill `texto-natural`, mantendo a voz da marca e sem acrescentar fato, número ou promessa.

## Movimento e mídia

Veja `../movimento.md`. Em resumo:

- a demonstração do topo é um vídeo sem som, em loop, com a capa no idioma da página;
- os itens que abrem ao toque abrem em 0,3 s;
- a barra fixa sobe em 0,25 s;
- com menos movimento pedido no sistema, nada se mexe sozinho.

## No celular

O preço e o botão aparecem na primeira tela. A demonstração vem depois do cartão da oferta, ou fica menor. A barra fixa ocupa a largura toda e mostra só o botão.

## Medição

Use os eventos de `../medicao.md`: a oferta vista, aceita e recusada, o erro de pagamento, e a identificação de cada posição de chamado (topo, cartão, barra fixa).

## Linhas legais

- O valor e a renovação aparecem antes do clique (CDC, art. 6, III, e art. 31).
- O resumo da contratação aparece antes de cobrar, e a confirmação logo depois (Decreto 7.962/2013, art. 4).
- O arrependimento em 7 dias desfaz também o que foi comprado junto (art. 5, §2).

Os detalhes estão em `../lei.md`.

## O que a conferência olha

`cta_first_screen`, `single_offer`, `decline_visible`, `decline_honest`, `price_shown`, `reference_price_true`, `renewal_shown`, `guarantee_near_cta`, `charge_clear`, `sticky_cta_long_page`, `proof_about_offer`, `countdown_real`, `video_autoplay_ok`, `reduced_motion`, `legal_lines`, `images_alt`.

## Modelos

- `../modelos/hostinger-agente-pos-compra.md`: a oferta do agente de IA depois da compra de hospedagem ou domínio, com a segunda oferta e o obrigado.
