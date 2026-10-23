# Conformidade: política da Meta, código do consumidor e proteção de dados

Este guia é para a IA. É método, não parecer jurídico: na dúvida, quem responde é quem cuida do jurídico da marca. O que está aqui é o que um plano de especialista confere antes do primeiro real.

## A política da Meta

- **Atributos pessoais.** Nenhum anúncio afirma ou sugere um traço de quem vê: saúde, corpo, idade, dinheiro, religião, orientação. Fala-se da situação ("para quem atende o dia inteiro"), não da pessoa ("você está esgotada"). O app de criativos confere em código os casos mais comuns.
- **Saúde.** Produtos ligados à saúde têm eventos de conversão restritos: só eventos padrão, nenhum termo clínico em URL, nome de evento ou parâmetro; nada que soe como diagnóstico ou tratamento. O aviso aparece no Gerenciador de Eventos ao montar a campanha; quando aparecer, o evento sobe no funil.
- **Antes e depois, pessoa real.** Só com material do integrante e autorização escrita; nada gerado.
- **Enganoso.** Sem botão falso, sem urgência inventada, sem "frete grátis" sem a condição. Uma oferta diz as condições que mudam o sentido e a data de fim.
- **Categorias especiais.** Moradia, emprego, crédito e temas sociais pedem a marcação da campanha e limitam o público.

## O código do consumidor

- O preço de referência (o "de") é o preço praticado, não um preço inflado para a promoção.
- O prazo da oferta está escrito, com data e hora, na página e no anúncio; sem prorrogação silenciosa.
- As regras estão escritas: quem pode, quantas vagas, o que acontece na renovação.
- A compra à distância tem 7 dias de arrependimento com devolução do valor; dizer isso antes vira argumento.
- Quem já é cliente nunca paga mais do que quem entra agora; há uma condição para ele.
- Uma promoção vigente que termina a menos de 30 dias de uma mais funda ensina a esperar: a de agora vira acesso antecipado, ou a do pico muda de forma.

## A proteção de dados

- A base da marca fica na pasta do projeto; nenhum nome, e-mail ou telefone entra em relatório, contagem ou outro app.
- Cada grupo da base tem uma base legal registrada (consentimento, legítimo interesse ou execução de contrato); a régua fica pendente enquanto faltar.
- Quem não ouve da marca há seis meses ou mais recebe primeiro a repermissão.
- Quem pediu para sair não recebe marketing em nenhum canal.
- O público personalizado para a Meta sobe em hash; a lista crua nunca sai da máquina.
- Toda mensagem diz quem escreve, de onde veio o contato e como sair com um clique.
- Produtos que guardam dados de clientes ou pacientes dizem na página onde os dados ficam, quem acessa e o que acontece ao cancelar.

## O que o plano registra

Em `plano.json`, as linhas de oferta conferidas (`offer.checks`), a restrição de categoria quando houver (`rules.category`) e os termos proibidos (`rules.forbidden_terms`), que o app de criativos lê no briefing.
