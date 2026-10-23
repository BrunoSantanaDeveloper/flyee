# A matriz de criativos

Este guia é para a IA. A primeira leva de uma campanha testa ideias, não variações de uma ideia: de 3 a 4 ângulos cruzados com formatos, 8 a 12 peças. Os três conceitos de `conceitos.md` são o caso mínimo (três ângulos, cada um em vídeo 9:16, vídeo 4:5 e imagem, nove peças); a matriz é como se planeja uma leva maior sem perder esse cuidado. Grave em `anuncios/<campanha>/matriz.json` e rode `matrix <campanha>`; sem o arquivo, o comando monta a matriz a partir dos conceitos aprovados.

## 1. O que é um ângulo

Um ângulo é a ideia que o anúncio vende, numa frase nas palavras do público, e tem três dimensões: a barreira ou o motivador (`driver`), a família de gancho (`hook_family`) e o estilo visual (`visual`), com os valores de `etiquetas.json`. Dois ângulos que diferem numa dimensão só são a mesma ideia testada duas vezes, e a leitura não separa uma da outra: o app recusa. Para serem ideias diferentes, mudem duas dimensões ou a promessa inteira.

## 2. Os formatos

| `format` | O que é | Quem produz |
|---|---|---|
| `reels` | o vídeo 9:16 com tela real do produto, para Reels e Stories | o app, pelo Motor de vídeo |
| `video-4-5` | o mesmo vídeo recomposto em 4:5 para o feed | o app |
| `imagem` | a imagem 4:5 ou 1:1 do feed | o app |
| `carrossel` | o carrossel estático, um cartão por passo ou objeção | o app, cartão a cartão |
| `depoimento` | uma pessoa real contando o que mudou | o integrante grava, com a autorização escrita de quem aparece; o app entrega o roteiro e o plano de cena |
| `fundador` | quem fez o produto falando para a câmera | o integrante grava; o app entrega o roteiro e o plano de cena |

As peças `depoimento` e `fundador` saem marcadas `needs_recording`: entram na leva como roteiro, e só viram anúncio quando o vídeo gravado chega em `materiais/`. Nada de pessoa, rosto ou depoimento gerado.

## 3. O arquivo

```json
{
  "version": 1,
  "angles": [
    { "key": "presenca", "driver": "barreira", "hook_family": "cena", "visual": "frase-que-some", "promise": "Olhar para a pessoa, e não para a tela, durante a consulta inteira.", "concept": "presenca" },
    { "key": "tempo", "driver": "motivador", "hook_family": "pergunta", "visual": "tela-em-movimento", "promise": "A anamnese pronta antes de a pessoa sair da sala." },
    { "key": "confianca", "driver": "barreira", "hook_family": "demonstracao", "visual": "cartao", "promise": "O que ela contou fica guardado, do jeito que ela contou." }
  ],
  "pieces": [
    { "angle": "presenca", "format": "reels", "hook": "Ela contou no começo. No fim, você ainda lembrava?", "concept": "presenca" },
    { "angle": "presenca", "format": "video-4-5", "hook": "Ela contou no começo. No fim, você ainda lembrava?", "concept": "presenca" },
    { "angle": "presenca", "format": "imagem", "hook": "Olhe para ela. A agenda anota." },
    { "angle": "tempo", "format": "reels", "hook": "Quanto da sua noite vai em prontuário?" },
    { "angle": "tempo", "format": "video-4-5", "hook": "Quanto da sua noite vai em prontuário?" },
    { "angle": "tempo", "format": "carrossel", "hook": "Três coisas que a agenda faz enquanto você atende." },
    { "angle": "confianca", "format": "reels", "hook": "Isto é o que ela disse. Palavra por palavra." },
    { "angle": "confianca", "format": "imagem", "hook": "Nada se perde entre a consulta e a ficha." },
    { "angle": "confianca", "format": "fundador", "hook": "Por que eu fiz a agenda guardar a fala, não o resumo." }
  ]
}
```

- `angles`: de 3 a 4; `key` curta em minúsculas sem acento; `promise` em uma frase; `concept` liga o ângulo a um conceito de `conceitos.json`, quando existe.
- `pieces`: de 8 a 12; cada uma com `angle` (uma chave de `angles`), `format` (da tabela acima) e `hook` (o que aparece nos 3 primeiros segundos ou no primeiro cartão). A mesma combinação de ângulo, formato e gancho não se repete.

## 4. O que o comando devolve

`matrix <campanha> --json` grava `matriz.md` com a tabela para o integrante e devolve as peças com `needs_recording`, as contagens por ângulo e por formato e os avisos (um ângulo com uma peça só, nenhum vídeo 9:16, peças que pedem gravação). Em `matrix_invalid`, `details.path` aponta o campo.

## 5. Da matriz às peças

Os ângulos com `concept` seguem o caminho de sempre (`piece`, `preview`, `final`). Um ângulo sem conceito pede um conceito novo em `conceitos.json`, com a evidência dele; a matriz não cria conceito. As peças `carrossel` saem como uma sequência de imagens, uma por cartão, pelo mesmo modelo de imagem. As peças que pedem gravação saem como roteiro em `pecas/<conceito>/roteiro.md`, com o plano de cena e a lista do que não pode ser dito.
