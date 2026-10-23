# A voz do cliente

Este guia é para a IA. Antes de escrever anúncios e e-mails, ouça quem já usou o produto: cinco a dez conversas e um questionário curto mudam o ângulo mais do que qualquer referência. O resultado entra no app de criativos como leitura `declared` e no plano como achado.

## 1. O questionário curto

Até cinco perguntas, por e-mail ou mensagem, para quem já usou:

1. O que você fazia antes de usar, e o que te fez procurar?
2. O que quase te impediu de assinar ou de continuar?
3. O que mudou no seu dia depois que começou?
4. Se fosse explicar o produto a um colega em uma frase, como diria?
5. O que falta?

Copie as respostas como vieram, sem corrigir o texto: a frase da pessoa é o gancho do anúncio.

## 2. As conversas

Cinco a dez conversas de 15 minutos, com quem pagou e com quem cancelou. Quem cancelou é a fonte mais forte: diz onde o produto perde. Pergunte o que aconteceu na primeira semana, o que esperava e não achou, o que faria voltar.

## 3. O que anotar

Para cada frase que vale um anúncio, anote quem disse (sem o nome, só o papel: "cliente há 8 meses", "cancelou no segundo mês"), a frase como foi dita e a data. Agrupe por barreira (o que impede) e por motivador (o que faz querer). Três frases no mesmo grupo viram um padrão.

## 4. Como entra nos outros apps

No app de criativos, cada frase vira um item `audience_comment` de uma leitura `declared`, com a origem e a data:

```json
{
  "version": 1,
  "kind": "declared",
  "collected_at": "AAAA-MM-DD",
  "source": { "type": "declared", "ref": "conversas com clientes" },
  "items": [
    { "kind": "audience_comment", "who": "cliente há 8 meses", "text": "a frase como a pessoa disse" }
  ]
}
```

No plano, os padrões entram como achados da narrativa, com a certeza `provavel` quando vêm de três frases ou mais e `primeira-leitura` com menos.

## 5. O que nunca fazer

Nenhum nome, telefone ou e-mail sai das conversas para um arquivo do projeto. Depoimento só com consentimento escrito e datado, e nunca gerado.
