# Ler a situação antes de planejar

Este guia é para a IA. Um plano de especialista começa por entender o que trava o crescimento da marca e o que a data permite, e só depois escolhe canais e verba. Leia este guia antes de preencher as premissas e de escrever a narrativa.

## 1. A restrição que manda

Pergunte: se uma coisa só fosse resolvida, o crescimento viria? Nomeie uma. O plano serve a ela, não ao canal que o integrante gostaria de usar.

| Restrição | Sinais |
|---|---|
| Encaixe do produto | quem testa não fica; o integrante não sabe dizer quem ama o produto |
| Conhecer o comprador | mensagem genérica, "todo mundo" como público, descrição de funções em vez da dor |
| Demanda | quem usa gosta e fica, mas pouca gente fica sabendo |
| Conversão | chega gente e ninguém compra; cliques sem venda; página sem razão clara para comprar agora |
| Ativação | cadastros que nunca chegam ao primeiro resultado útil |
| Retenção | compra uma vez e ninguém traz de volta; lista sem réguas |
| Cegueira | ninguém sabe o que funciona; a plataforma e o caixa discordam; rastreamento nunca conferido |
| Economia | a margem ou o preço não pagam um cliente comprado |

Quando duas empatam, escolha a de cima: encaixe antes de demanda, cegueira antes de mais gasto, conversão antes de mais tráfego, economia antes de pagar. Um passo de preparação que falta (rastreamento, página, conta) nunca é a restrição: é algo a trazer. Se a restrição não for de marketing (o produto não está pronto, o preço está quebrado), diga isso: é uma resposta válida.

## 2. O que a data permite

Com conta nova e sem histórico de anúncio, um canal pago frio raramente fica eficiente antes de duas ou três semanas. Daí a leitura por prazo:

- **Menos de 8 dias:** só preparar e aquecer quem já conhece a marca. Nada para aprender com dinheiro.
- **8 a 21 dias:** preparação curta, uma janela de testes, aquecimento. A verba paga rende mais no remarketing e na base; o aprendizado fica para a campanha seguinte.
- **22 a 45 dias:** cabe aprender. A fase de testes descobre o ângulo, o criativo, o custo por lead e a conversão da página, e forma públicos mornos para a semana cara. Ela não acumula dado de compra nem se paga em vendas, e o plano diz isso antes que o integrante a julgue por isso.
- **Mais de 45 dias:** cabem dois ciclos de teste e troca de criativos.

A fase de aprendizado da Meta precisa de cerca de 50 eventos de otimização em 7 dias por conjunto. Um produto caro com verba pequena não atinge isso em compras; atinge em leads. É a conta de `funnel`, e ela decide o evento.

## 3. Quem já conhece a marca vem antes de quem nunca ouviu falar

Uma base de clientes antigos, cadastrados ou uma lista é o ativo mais barato do plano. Ela não é alcançada com anúncio: é com e-mail e mensagem, e a conta de frequência mostra por quê. Quando a base está parada há 6 meses ou mais, a primeira mensagem é repermissão, nunca promoção. O plano separa a meta em duas origens, quem conhece e quem não conhece, e dá um número a cada uma.

## 4. A oferta antes do anúncio

A captação de uma fase de preparação promete o acesso a uma oferta. Ela precisa existir já, com preço de referência verdadeiro, prazo escrito, regras, a condição para quem já é cliente e o arrependimento de 7 dias da compra à distância. `offer` monta as formas e aponta a colisão com uma promoção que está no ar: um desconto mais fundo a menos de 30 dias de outro ensina a esperar.

## 5. Olhar antes de perguntar

`look` lê o que o projeto já tem: a marca em `media-plan/marca.md`, os briefings e capturas do app de criativos, a pesquisa no Instagram, o inventário da base. O que está lá entra como `encontrado`, com o arquivo. O que não está vira pergunta, no máximo quatro, numa mensagem só, nesta ordem: produto e oferta, para quem e quantos, meta e data, verba. Cada pergunta leva a sua sugestão e o que muda se a resposta for outra. Rastreamento nunca é pergunta técnica: a pergunta é "quando alguém compra ou se cadastra, dá para ver de onde veio?".

## 6. A narrativa

Você escreve a narrativa (`narrativa.json`): até três achados, cada um com a certeza (`confirmado`, duas fontes ou o dado do integrante; `provavel`, uma fonte boa ou um padrão claro; `primeira-leitura`, uma leitura só), a história em um parágrafo, o primeiro passo, o que não vamos fazer e o que não conseguimos conferir. O script confere: nenhuma promessa de resultado, nenhum travessão, nenhum ponto de exclamação, a seção "Em resumo" em até 150 palavras. Os números são do script; você os cita, nunca os inventa.

```json
{
  "findings": [{ "text": "A meta cabe no cenário esperado só se a base responder: 19 das 30 vêm dela.", "certainty": "confirmado" }],
  "story": "Um parágrafo: onde a marca está, o que trava, o caminho.",
  "first_move": "O primeiro passo, com quem faz e até quando.",
  "not_doing": ["O que fica de fora, e por quê."],
  "could_not_check": ["O que o plano assumiu e pede para conferir."],
  "decisions": [{ "question": "A pergunta.", "recommendation": "A recomendação e a razão.", "by": "AAAA-MM-DD" }]
}
```
