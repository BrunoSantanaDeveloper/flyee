# O que vale para toda página que vende

Este guia é para a IA. Vale para todos os tipos de página: as ofertas em volta da compra, a página de vendas, a de planos e a de API. O roteiro de cada tipo, em `tipos/`, diz o que muda.

## 1. Uma decisão por página

A página pede uma coisa só: aceitar ou recusar esta oferta. Há um chamado principal, com o mesmo texto onde quer que apareça (no topo, no cartão da oferta, na barra fixa), e uma recusa visível. Links que levam para fora (menu, blog, outros produtos) saem da página de oferta. Um botão que só rola até a oferta, como `#oferta`, não compete com ela.

Numa página de vendas, de planos ou de API, a regra vira um chamado principal e no máximo um secundário, como a demonstração e o teste, com o mesmo texto em toda a página. O menu leva às páginas derivadas, cada uma com o seu roteiro.

## 2. O preço sem surpresa

- O valor que vai ser cobrado aparece perto do botão, escrito como vai sair no recibo.
- Preço riscado só quando é o preço praticado de verdade, e a diferença, em reais ou em porcentagem, bate com a conta.
- Numa assinatura, o valor depois do primeiro período, a periodicidade e como cancelar ficam na mesma tela.
- Despesas extras, como frete e taxas, aparecem separadas antes do pagamento.
- Os descontos, a economia em reais e a média mensal fecham com os preços que a página mostra. Nas páginas do Juridiq e do JuriChat, todas as contas de cada plano fecham.

## 3. O risco do lado de quem vende

A garantia ou o cancelamento simples aparece perto de cada chamado, sempre com as mesmas palavras. No modelo da Hostinger, o reembolso em 30 dias aparece em quatro lugares, sempre ao lado de uma decisão.

## 4. A prova fala do produto oferecido

Depoimento, número ou demonstração precisam ser sobre o produto da oferta. Um depoimento sobre a empresa em geral (a hospedagem, quando a oferta é o agente de IA) não responde à dúvida de quem está decidindo. O que a página promete em número aparece em número: prometer sete especialistas e mostrar cinco abre uma dúvida justo na hora da decisão.

## 5. Mostrar o produto funcionando

Uma demonstração curta do produto em uso vale mais do que a lista de recursos. Ela mostra o pedido, o resultado e a prova, em vídeo sem som ou animada na própria página, em loop, com a capa no idioma da página (veja `movimento.md`).

Sempre que possível, ela usa o produto de verdade: os componentes reais do projeto com dados fixos, depois a tela real, e uma réplica simplificada só quando não há código nem tela. Mostra só o que o produto faz hoje, e o que for inventado para a cena leva a etiqueta "Exemplo fictício". O guia está em `demonstracao.md`.

## 6. O celular vem primeiro

A maior parte das compras acontece no celular. O chamado principal aparece na primeira tela do celular. Numa página longa, uma barra fixa com o preço e o botão aparece quando o cartão da oferta sai da tela.

## 7. Urgência só quando é verdade

Use contador só com prazo real: ele termina na hora que diz e não recomeça quando a página recarrega. Estoque, vagas e últimas unidades, só quando forem verdade. Urgência falsa é publicidade enganosa (veja `lei.md`).

Uma promoção escreve até quando vale, para quem vale e a que se aplica, com as mesmas palavras em todos os lugares da página. Um teste grátis diz quantos dias dura. Um aviso de "últimas vagas" sai da agenda real.

## 8. Recusar sem constrangimento

A recusa é um link visível, com palavras neutras: "Pular oferta", "Não, obrigado", "Continuar sem". Frases que constrangem, como "não quero economizar" ou "prefiro pagar mais", afastam quem compraria depois e se aproximam da prática abusiva.

## 9. Quem não deve ver a oferta

Defina isso antes de construir: quem já tem o produto, quem chegou por um caminho em que a oferta não faz sentido, quem pagou de um jeito que não permite cobrar com um clique. A Hostinger só prepara a sua oferta quando todas estas condições valem:

- o carrinho tem hospedagem, VPS ou domínio;
- o Agente não está no carrinho;
- a compra não veio de link de afiliado;
- a conta ainda não assina o Agente;
- há um meio de pagamento salvo.

## 10. Medir cada peça

Cada oferta tem a sua taxa de aceite, e cada posição de chamado tem a sua identificação (veja `medicao.md`). Sem isso não dá para saber se quem vende é a oferta, a página ou a barra fixa.

## 11. Quem vende aparece

O rodapé traz o nome da empresa, o CNPJ ou o CPF, o endereço e um contato, como pede o Decreto 7.962/2013, art. 2 (veja `lei.md`). O Juridiq mostra tudo isso; o JuriChat, do mesmo grupo, mostra endereço e contato, mas não o CNPJ.

## 12. Nada cobre a página na chegada

Uma janela de promoção abre depois que a pessoa mostra interesse, como ao passar da metade da página ou ao chegar aos preços, uma vez por visita, com uma recusa visível. No Juridiq, ela abre ao passar de 47% da página, e quem fica no topo não a vê. Uma janela que cobre a página inteira pode piorar o desempenho na busca, segundo a orientação do Google sobre janelas intrusivas, e afasta quem ainda nem leu o título.

## 13. O número que todo mundo lê

Um número contado com animação já está no HTML com o valor final. Sem isso, o buscador, o leitor de tela e quem pediu menos movimento leem "0+", como acontece na página do Juridiq.

## 14. Nada inventado

Número de uso, escassez, ano de fundação, nome de cliente e depoimento vêm do projeto ou do integrante, com a origem registrada em `pagina.json` (`claims`). Sem origem, saem da página. A IA preenche o vazio com o que parece provável, e o que a página afirma obriga quem vende (veja `lei.md`).

## 15. A página tem a cara deste produto

O plano traz a direção visual em uma frase, que diga o que torna a página deste produto, e as cores e as letras da marca. Os padrões que a IA repete sem ninguém pedir estão em `vicios.md`: o que ficar deles é escolha registrada.

Página sem esses vícios fica menos genérica, e só isso. Nenhum dos materiais usados aqui mede venda: quem diz se a página vende é a medição do próprio projeto.

## 16. Olhar a página pronta

Quem constrói sem ver entrega defeitos que só aparecem na tela: um texto cortado, uma lista por cima de uma imagem, uma barra que cobre o botão. Antes de entregar, abra as fotos e as folhas de quadros que a conferência grava, no computador e no celular.
