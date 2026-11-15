# Páginas que vendem

Monta e confere páginas que vendem pelo tipo, com a estratégia que o mercado usa e modelos reais analisados. Este texto é o guia dentro do projeto; a página do app no flyee.club lê os guias em `guides/`.

## O que ele faz

Você pede uma página que vende: a página de vendas do produto, a de um curso ou mentoria, a de planos e preços, a da API, ou uma oferta em volta da compra (um order bump no checkout, um upsell depois da compra, um downsell para quem recusou, um cross-sell no carrinho ou a página de obrigado). A sua IA:

1. reconhece o tipo de página;
2. segue o roteiro desse tipo: as seções na ordem, a mecânica da compra, o texto, o movimento, a medição e as linhas da lei;
3. usa como referência os modelos reais que o app traz;
4. olha o que o seu projeto já tem e pergunta só o que falta;
5. escreve um título que promete o que muda para quem chegou, e leva o sugerido e duas alternativas para você escolher;
6. desenha cada figura para quem nunca viu o produto, de modo que ela se entenda sem ler, mostrando só o que ele faz hoje.

Depois de construir, a sua IA abre a página pronta num navegador sem janela e confere cada item do tipo, por exemplo:

- o botão na primeira tela do celular e a recusa visível;
- o preço e a renovação escritos, e as contas de desconto e de economia fechando;
- quem vende identificado, o período de teste e a promoção com as regras escritas;
- a janela de promoção com saída e sem cobrir a página na chegada;
- nenhuma caixa paga já marcada;
- a garantia perto do botão e a barra fixa numa página longa;
- o vídeo sem som e com capa, e a regra de menos movimento;
- as linhas legais;
- os números e as urgências da página com origem, e nenhum dado de exemplo esquecido;
- a página no celular: nada passando da largura, texto legível, botões fáceis de tocar, contraste e imagens leves;
- cartões que se leem de relance, sem buraco, e figuras sem frases longas;
- os padrões que a IA costuma repetir sem ninguém pedir, só como aviso: o que você escolheu fica.

A conferência mede regras e não vê se a página se entende. Por isso, a sua IA também olha: abre a página sem nenhuma letra, para ver se cada figura continua dizendo o que é, as fotos da página e, quando há uma demonstração, as folhas de quadros filmadas no computador, no celular e com menos movimento. Numa página que já existe, ela fotografa antes de mexer e compara depois.

Você ouve só o que precisa de atenção.

## O que você precisa

- Uma das IAs em que o app foi testado.
- O Motor de vídeo, outro app do flyee.club, para a conferência automática. A sua IA o instala se faltar. Sem ele, o roteiro e o plano funcionam, e a conferência é feita lendo o código.

## Peça assim

> "Crie a página de upsell que aparece depois do checkout, oferecendo a mentoria em grupo com 50% de desconto no primeiro mês."

> "Monte a página de planos com mensal e anual e a tabela comparativa."

> "Faça a página de vendas da minha mentoria, com a oferta da Black em 12 parcelas e os bônus."

## O que ele grava

| Caminho | Conteúdo |
|---|---|
| `paginas/<pagina>/pagina.json` | os fatos da página: produto, para quem é, preço, planos, período de teste, renovação, garantia, como cancelar, o texto dos botões e o da recusa, a direção visual, a marca, a demonstração e a origem de cada número |
| `paginas/<pagina>/plano.md` | as seções na ordem, a mecânica, a medição, as linhas legais e o que conferir |
| `paginas/<pagina>/conferencia.json` | o resultado de cada item da conferência |
| `paginas/<pagina>/captura/` | as telas e a leitura da página capturada |
| `paginas/<pagina>/filme/` | os quadros e as folhas da demonstração filmada |

Num projeto que já tem uma pasta `docs/`, essas pastas ficam em `docs/paginas/`. A página em si é construída no código do seu projeto, junto das outras.

## O que há de novo

- 1.3.0: a página de vendas de curso, mentoria ou comunidade, com o modelo da Subido AI em duas versões de teste. A conferência passa a pedir o preço à vista junto das parcelas, a somar a lista do que se recebe, a fechar o desconto com o total das parcelas e a ver o que continua se mexendo quando a pessoa pede menos movimento. Numa página longa, a foto sem letras sai em várias folhas, cada parte fotografada depois de aparecer na tela. O modelo das páginas de produto da Databricks traz os diagramas feitos com as peças do produto, os ícones próprios e as logos reais, e o guia das figuras passa a dizer como usar cada um: o gráfico mostra o produto agindo, poucas logos ficam paradas e com a legenda do que são, e os dados de exemplo contam a mesma história em todas as figuras.
- 1.2.0: a página passa a ser construída por figuras que se entendem sem ler, como um telefone, um calendário e a janela grande do sistema. O título passa por testes, e a conferência ganha a foto da página sem nenhuma letra, a foto de antes para comparar e limites de texto nos cartões. A lista de vícios só avisa, e o que você escolheu fica.
- 1.1.0: página de vendas, planos e preços e página de API, com os modelos do Juridiq e do JuriChat. A conferência passa a fechar as contas de desconto e a olhar quem vende, o período de teste, a promoção, o cancelamento, as janelas de promoção e os números animados. O app ganha o guia da demonstração do produto e da grade de recursos, a lista dos padrões que a IA repete, a direção visual no plano e a filmagem da demonstração. A conferência passa a pedir a origem de cada número e a medir a página pronta no celular.
- 1.0.0: primeira versão. Traz order bump, upsell, downsell, cross-sell e página de obrigado, e o modelo da oferta pós-compra da Hostinger.
