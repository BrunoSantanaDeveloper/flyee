---
name: questionario
description: Transforma o que o integrante não sabe responder sozinho num questionário para outra pessoa preencher: o jurídico, o contador, quem cuida do site, o cliente da agência. Use quando uma pergunta de um app depender de alguém de fora da conversa, ou quando pedirem um questionário ou um briefing para enviar a alguém.
---

# Questionário

O integrante precisa de uma resposta que está com outra pessoa. Você escreve um documento para ele mandar a ela, ou para os dois preencherem numa conversa. Com o integrante, pergunte só sobre o envio, que ele sempre sabe responder: para quem vai e o que precisa voltar. As perguntas do documento miram o que a outra pessoa sabe e ele não sabe.

## Passo 1: o envio

Numa mensagem só, pergunte o que a conversa ainda não disse:

1. **Para quem vai:** a função da pessoa e o quanto ela entende do assunto. Isso define o tom e quanto contexto o documento precisa levar.
2. **O que precisa voltar:** as decisões ou os fatos que ele não fecha sozinho.

Quando o pedido vem de um app, as perguntas em aberto já são essa lista. Sugira para quem mandar, como "quem cuida do jurídico da marca", e um "sim" do integrante basta.

Este passo termina quando você sabe quem recebe e tem a lista do que precisa voltar.

## Passo 2: escrever

Grave em `questionarios/<assunto>.md`, na pasta do projeto, no idioma de quem vai responder, com este modelo:

```markdown
# <Título do questionário>

**Para que serve:** por que este questionário existe e a decisão que depende dele.

**De:** <integrante>. **Para:** <pessoa>. **Como as respostas serão usadas:** <onde entram>.

## Contexto

Um parágrafo para quem não acompanhou a conversa: o suficiente para responder bem.

## Como responder

O prazo e o tempo que leva. "Não sei" é uma resposta útil: marque o que for incerto em vez de pular.

## <Tema>

### <Uma pergunta só, a mais importante primeiro>

_Por que importa: o que esta resposta decide._

>

## Faltou algo?

O que não perguntamos e deveríamos saber?
```

- Uma ideia por pergunta, da mais importante para a menos importante, porque a pessoa pode responder uma vez só.
- Agrupe por tema quando houver mais de cinco perguntas.
- "Por que importa" entra só onde a pergunta pode ser mal entendida ou receber uma resposta qualquer.
- O documento sai do projeto, então leva só o que a pessoa precisa para responder. Lista de contatos, nome de cliente da marca, chave e senha ficam de fora.
- Revise o texto com a skill `texto-natural`.

Este passo termina quando o arquivo existe e cada item da lista do passo 1 tem uma pergunta.

## Passo 3: enviar e receber

Diga ao integrante, numa frase, onde está o arquivo e para quem mandar. Quem envia é ele.

Quando a resposta voltar, leia o arquivo ou o que ele colar e grave cada resposta no lugar de onde a pergunta veio, dizendo quem respondeu e em que data. "Não sei" continua em aberto: leve de volta ao integrante só o que ainda decide algo.

Baseado no to-questionnaire de mattpocock/skills (licença MIT, copyright 2026 Matt Pocock; veja `LICENSE`).
