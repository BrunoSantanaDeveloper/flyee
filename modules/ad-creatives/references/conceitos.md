# Conceitos e fichas

Este guia é para a IA. Um conceito é uma aposta: uma barreira ou um motivador de quem compra, um ângulo, um gancho, uma prova e um jeito de mostrar. A campanha testa **três**, um por barreira ou motivador, os três anúncios no mesmo conjunto: com a verba dividida em mais conjuntos, nenhum aprende.

## 1. De onde vêm os três

Leia o resumo da evidência (`evidence <campanha>`) e procure:

- **O que o mercado mantém.** Anúncios no ar há 30 dias ou mais são os que alguém continua pagando. Um ângulo que aparece em dois concorrentes ou mais é validado e também disputado: entrar nele pede um gancho que só a marca do integrante tem.
- **O que ninguém diz.** Uma lacuna (nenhum concorrente fala daquilo) é uma oportunidade, mas lacuna não é demanda. Sem outra fonte, o conceito sai com confiança baixa ou como aposta, e a ficha diz isso.
- **O orgânico medido.** Um post que fez muitas vezes o normal do próprio perfil mostra um assunto e um gancho que o público já escolheu sem verba. Reels e posts estáticos contam separados, e um perfil pequeno é indício.
- **A fala do público e o resultado próprio.** Uma frase de cliente e um resultado da própria marca valem mais que qualquer opinião: cite pelo id.
- **A execução dominante.** Se os anúncios mantidos do mercado são uma pessoa falando para a câmera, diga isso ao integrante: este app entrega peças animadas, e uma versão com uma pessoa real fica como roteiro para ele gravar.

Cada conceito aponta para um ângulo que a página de destino já tem, para a promessa do anúncio ser a mesma da página. Quando o site lê o nome do anúncio, o ângulo precisa estar na lista do briefing.

## 2. O arquivo

Grave os conceitos em `anuncios/<campanha>/conceitos.json` e rode `concepts <campanha>`:

```json
{
  "version": 1,
  "concepts": [
    {
      "key": "memoria",
      "driver": { "type": "barreira", "text": "Para registrar, ela digita durante a consulta, e digitando não ouve direito." },
      "angle": "memoria",
      "hook": { "family": "pergunta", "text": "Ela contou no começo da consulta. No fim, você ainda lembrava?", "tag": "lembra" },
      "proof": { "type": "demonstracao", "text": "A conversa vira anamnese, com o trecho de onde veio cada campo." },
      "structure": "problema-mecanismo",
      "visual": "frase-que-some",
      "template": "problema-mecanismo",
      "formats": ["vertical", "feed", "imagem"],
      "evidence": ["ad-nome-da-pagina-1234567890", "fala-fio-da-conversa"],
      "against": [],
      "copy": { "primary_text": "…", "headline": "…", "description": "…", "cta": "Assinar" },
      "success_criterion": "Entre os anúncios, a maior taxa de quem passa dos 3 primeiros segundos e o menor custo por resultado na primeira semana."
    }
  ]
}
```

| Campo | Regra |
|---|---|
| `key` | curta, minúsculas sem acento e hífens; é a pasta da peça |
| `driver` | `type` barreira ou motivador; `text` numa frase, nas palavras do público |
| `angle` | a ideia que o anúncio vende, numa palavra; entra no nome do anúncio |
| `hook` | `family` (de `etiquetas.json`), `text` (o que aparece nos 3 primeiros segundos) e `tag` (até 16 caracteres, vai no nome do anúncio) |
| `proof` | `type` de `etiquetas.json` e `text`; `depoimento`, `antes-depois` e `pessoa-real` exigem `material`, um arquivo do integrante em `materiais/`; `numero` exige `source` |
| `structure`, `visual` | valores de `etiquetas.json` |
| `template` | o modelo da página: `problema-mecanismo`, `produto-em-uso` (com uma tela do produto) ou `lista` (o gancho é uma lista curta, como "Língua. Pulso. Pontos.") |
| `formats` | as peças do anúncio: `vertical` (o vídeo 9:16 para Stories e Reels, sempre presente), `feed` (o mesmo vídeo em 4:5), `imagem` (a imagem 4:5 do feed) e `quadrado` (a imagem 1:1 do feed e da coluna da direita); sem o campo, `vertical`, `feed` e `imagem` |
| `evidence`, `against` | ids de `evidencias.json` a favor e contra; um id que não existe é recusado |
| `copy` | o texto do anúncio: `primary_text`, `headline`, `description` (opcional) e `cta`, um botão da lista da Meta |
| `success_criterion` | como o integrante vai comparar os anúncios; sem ele, o app usa o critério padrão |

Nunca escreva a confiança: o app a calcula e sobrescreve qualquer valor do arquivo.

## 3. A confiança

| Tipos de fonte a favor | Confiança |
|---|---|
| nenhum | aposta |
| 1 | baixa |
| 2 | média |
| 3 ou 4 | alta |

Os tipos são anúncio de concorrente, orgânico medido, fala do público e resultado próprio. Três anúncios do mesmo tipo contam como um tipo só. A confiança ordena apostas; ela não prevê resultado, e a ficha nunca diz que um conceito vai vender.

Quando chega evidência nova depois do sim do integrante, `concepts` recalcula a confiança e devolve o que mudou (`confidence_changes`): conte ao integrante, sem pedir o sim de novo. Mudar o conteúdo de um conceito aprovado (o gancho, o texto, a prova) pede o sim de novo.

## 4. O que o app recusa

- Um id de evidência que não existe.
- Uma prova de depoimento, antes e depois ou pessoa real sem o arquivo do integrante. Nada de pessoa, rosto ou depoimento gerado.
- Dois conceitos com o mesmo estilo visual e a mesma família de gancho: o teste não separaria um do outro.
- Mais de três conceitos.
- Uma promessa de resultado em qualquer texto da ficha (venda garantida, retorno, "vai vender"). Um número de resultado só entra como prova, com a fonte.
- Um ângulo que o site não lê, quando o site escolhe a página pelo nome do anúncio.

## 5. O nome do anúncio

O nome sai do padrão do briefing: o do site, quando o site lê o nome que chega no link (`utm_content`), ou `<conceito>-<formato>-<gancho>-v<n>`. Fica em minúsculas sem acento, com hífens e até 64 caracteres. Com um site que lê o nome, o primeiro trecho é o ângulo, e o app confere.

O nome do anúncio é o do vídeo vertical, com o formato `reels`. As outras peças do mesmo anúncio saem na entrega com o próprio formato no nome do arquivo (`feed`, `imagem`, `quadrado`), para o integrante pôr cada uma no posicionamento certo; `nomes.json` liga todas ao nome do anúncio.

## 6. As fichas

`concepts` grava `conceitos.md`: por conceito, a barreira ou o motivador, o gancho, a prova, a confiança e a base dela, cada evidência a favor e contra com a origem e a data, o texto do anúncio, o nome e o critério de sucesso. Mostre as fichas ao integrante e pergunte se aprova os três. Com o sim, rode `approve <campanha> concepts`.
