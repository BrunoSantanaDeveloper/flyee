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

Uma figura que se entende sem ler vale mais do que a lista de recursos. Cada seção mostra um objeto que quem chegou reconhece em três segundos: o telefone com a conversa, o calendário com os dias marcados, a janela grande do sistema. Uma demonstração animada mostra o pedido, o resultado e a prova, sem som, em loop, com a capa no idioma da página (veja `movimento.md`).

A figura é desenhada para quem nunca viu o produto, com as cores, a letra e as palavras dele. A tela real entra quando se entende no tamanho da página. Tudo o que a figura mostra existe no produto hoje, e o que for inventado para ela leva a etiqueta "Exemplo fictício". O guia está em `demonstracao.md`.

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

Vale também para a frase sem número. "Nenhuma ferramenta nova para aprender" e "funciona com tudo" são afirmações, e o próprio produto costuma desmenti-las: ele mesmo é uma ferramenta nova. Escreva o que pode ser conferido ("usa o WhatsApp, o Gmail e o Slack que a equipe já usa").

## 15. A página tem a cara deste produto

O plano traz a direção visual em uma frase, que diga o que torna a página deste produto, e as cores e as letras da marca. Quando o integrante escolheu um modelo, o efeito visual dele faz parte da direção. Os padrões que a IA repete sem ninguém pedir estão em `vicios.md`: a lista evita acrescentar por reflexo, e nunca tira o que o integrante escolheu.

Nenhum dos materiais usados aqui mede venda: quem diz se a página vende é a medição do próprio projeto.

## 16. Olhar a página pronta

Quem constrói sem ver entrega defeitos que só aparecem na tela: um texto cortado, uma lista por cima de uma imagem, uma figura que não se entende. Uma conferência toda em ok só diz que as regras passaram. Antes de entregar, abra as fotos que ela grava, a página sem letras primeiro, e responda às perguntas de "Conferir olhando" em `demonstracao.md`.

Numa página que já existe, fotografe antes de mexer, e compare depois. Uma revisão que deixa a página com menos figura do que tinha piorou a página.

## 17. O título vende, e se diz em voz alta

O título é o que a pessoa leva da página. Ele promete o que muda na vida dela, em palavras que ela usaria. Um nome de categoria não é título: "Automação com IA no contencioso de massa" diz em que prateleira o produto está, e ninguém fala assim.

Antes de escolher, escreva pelo menos cinco, de formas diferentes, e guarde em `headline.options`. Para um sistema de agenda de clínicas, por exemplo:

| A forma | Um exemplo |
|---|---|
| O que a pessoa passa a ter | "Sua agenda cheia, sem ninguém no telefone" |
| O que acaba | "Chega de paciente que marca e não aparece" |
| A frase que o cliente dela repete | "Doutora, ainda tem horário amanhã?" |
| O que o produto faz enquanto ela está em outro lugar | "Enquanto você atende, a agenda se preenche sozinha" |
| O resultado para quem compra | "Menos cadeira vazia no fim do mês" |

Os testes, um por um:

1. **Em voz alta.** Diga a frase a alguém do ramo, numa conversa. Ela soa como conversa, ou como anúncio de folheto?
2. **Trocando o nome.** Com o nome de um concorrente no lugar, ela continua verdadeira? Então não diz nada deste produto.
3. **A palavra de dentro.** Há uma palavra que só quem faz o produto usa? Quem chega entende?
4. **A imagem.** Dá para ver a cena na cabeça? "Prazo perdido" dá; "gestão integrada" não dá.

Exagere o interesse, nunca o fato. O título pode provocar, cutucar uma dor e prometer forte tudo o que o produto entrega de verdade. "Nada inventado" (seção 14) cuida do fato e não pede um título sem graça. Os títulos das seções seguem a mesma regra: o resultado, em até 8 palavras.

A escolha é do integrante: leve a sugerida e duas alternativas, de modo que um "sim" aceite a sugerida. Numa página que já existe, um título que não passa nos testes é apontado mesmo quando ninguém pediu para mexer nele.
