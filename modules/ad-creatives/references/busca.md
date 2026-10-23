# Os anúncios de texto da Busca do Google

Este guia é para a IA. Quando o plano do integrante tem a Busca do Google entre os canais, a campanha ganha anúncios de texto: quem procura o nome da marca ou o problema que ela resolve. Grave em `anuncios/<campanha>/busca.json` e rode `search <campanha>`; os limites estão em `google-busca.json`, com a data em que foram conferidos.

## 1. A estrutura

- **Marca**: uma campanha com as palavras que trazem o nome da marca, em correspondência exata e de frase. É o clique mais barato e mais certo. Nenhuma palavra do produto entre as negativas.
- **Não marca**: uma campanha com o problema, a categoria e a profissão ("agenda para nutricionista", "prontuário online"), em frase e ampla. Entre as negativas, o nome da marca (para não roubar o clique da campanha de marca) e o que atrai quem não compra ("grátis", "curso", "vaga", "o que é").
- **Concorrente**: só com o sim do integrante e sem o nome do concorrente no texto do anúncio.

Os grupos de palavras vêm do plano, quando ele os tem (`plano.json`, canal `google_search`); sem plano, pergunte ao integrante as palavras que o público usa e confira na pesquisa dos concorrentes.

## 2. O anúncio responsivo

| Parte | Limite | Regra |
|---|---|---|
| Títulos | de 3 a 15, até 30 caracteres cada | ao menos 10 para o Google combinar; a marca num título, o benefício em outro, a oferta com data em outro, a prova em outro, a chamada em outro; cada combinação de três precisa fazer sentido sozinha |
| Descrições | de 2 a 4, até 90 caracteres cada | cada uma fecha uma ideia; nenhuma depende da outra |
| Caminho | dois trechos de até 15 caracteres | o que a pessoa vê depois do domínio: `/nutricionistas/agenda` |
| Fixação | posições 1, 2 e 3 | fixar um título o faz aparecer sempre; fixe só o que a regra pede (a marca na 1, a oferta com data) e, quando fixar, dois ou três na mesma posição |
| Destino | o endereço completo | com os parâmetros da regra única de link, ou o modelo de acompanhamento da campanha |

Sem ponto de exclamação no título, sem palavras inteiras em maiúsculas além de siglas, sem símbolo repetido: o Google recusa ou reduz. As mesmas regras do `copy` valem aqui: nenhuma promessa de resultado, nenhum atributo pessoal de quem procura, nenhum termo que o briefing proíbe.

## 3. As extensões

- **Sitelinks**: de 2 a 6, texto de até 25 caracteres e duas linhas de até 35, cada um para uma página diferente (preços, como funciona, a oferta, quem faz).
- **Frases de destaque**: de 2 a 10, até 25 caracteres, um fato por frase ("Sem cartão para testar", "Dados no Brasil").
- **Snippet estruturado**: um cabeçalho da lista do Google (Serviços, Tipos, Destaques…) e de 3 a 10 valores de até 25 caracteres.

## 4. O arquivo

```json
{
  "version": 1,
  "campaigns": [
    {
      "name": "AL-BF26-marca",
      "kind": "marca",
      "negatives": [],
      "ad_groups": [
        {
          "name": "marca",
          "keywords": [{ "text": "agenda leve", "match": "exata" }, { "text": "agenda leve nutricionista", "match": "frase" }],
          "ads": [
            {
              "headlines": [{ "text": "Agenda Leve", "pin": 1 }, "Agenda com prontuário", "Para nutricionistas", "Anual pelo preço de 10 meses", "Migração dos dados incluída", "Teste sem cartão", "Dados guardados no Brasil", "Comece hoje", "Oferta até 27 de novembro", "Feita para o consultório"],
              "descriptions": ["A agenda que escreve a anamnese enquanto você atende. Anual pelo preço de 10 meses até 27/11.", "Prontuário, agenda e lembretes num lugar só. Migração dos seus dados incluída."],
              "path1": "nutricionistas",
              "path2": "oferta",
              "final_url": "https://exemplo.test/oferta?utm_source=google&utm_medium=cpc&utm_campaign=black-friday-2026&utm_content=marca&utm_term=agenda-leve"
            }
          ]
        }
      ],
      "extensions": {
        "sitelinks": [{ "text": "Preços", "url": "https://exemplo.test/precos", "description1": "Mensal ou anual", "description2": "Sem fidelidade" }, { "text": "Como funciona", "url": "https://exemplo.test/como-funciona" }],
        "callouts": ["Teste sem cartão", "Dados no Brasil", "Suporte por WhatsApp"],
        "snippet": { "header": "Destaques", "values": ["Prontuário", "Agenda", "Lembretes"] }
      }
    }
  ]
}
```

## 5. O que o comando devolve

`search <campanha> --json` confere tudo e grava `busca-conferida.json` e `busca.md`, com os anúncios como o integrante vai colar no Google Ads. `problems` bloqueia (título de 31 caracteres, promessa, atributo pessoal, termo proibido, exclamação no título); `warnings` só avisa (poucos títulos, uma fixação só, sem negativas na campanha de não marca, sem campanha de marca). Quem cria a campanha é o integrante; o app não entra na conta.
