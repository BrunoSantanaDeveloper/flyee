# Reels de teste: comparar as peças antes de pagar

Este guia é para a IA. O Instagram deixa publicar um Reels como teste: ele aparece só para quem não segue o perfil, não entra na grade e não vai para quem já segue. Dá para comparar as peças da campanha com público frio antes de gastar a verba, e o resultado vira a evidência mais forte da próxima rodada: um resultado próprio.

Nem toda conta tem o recurso. Se o integrante não encontrar a opção de teste ao publicar, siga sem ela e diga isso numa frase.

## 1. Publicar

O integrante publica os vídeos verticais da entrega, um por dia ou os três no mesmo dia, como Reels de teste, com a mesma legenda curta nos três (o texto principal de cada anúncio, sem link). Ele publica; você não entra na conta dele.

## 2. Esperar

Compare só depois de 72 horas de cada Reels no ar: antes disso, o alcance ainda está crescendo, e um vídeo publicado de manhã parece melhor que um publicado à noite.

## 3. Ler os números

Peça ao integrante uma captura da tela de estatísticas de cada Reels de teste. Leia e grave numa leitura `declared`, com o texto como aparece, uma linha por peça:

```json
{
  "version": 1,
  "kind": "declared",
  "collected_at": "2026-10-24",
  "source": { "type": "screenshot", "ref": "pesquisa/reels-de-teste/" },
  "items": [
    {
      "id": "teste memoria-reels-lembra-v1",
      "kind": "own_result",
      "text": "Reels de teste memoria-reels-lembra-v1, 72 horas no ar",
      "capture": "pesquisa/reels-de-teste/memoria.png",
      "metrics": [
        { "name": "contas alcançadas", "value_text": "1.204" },
        { "name": "reproduções", "value_text": "1.530" },
        { "name": "tempo médio de visualização", "value_text": "6 s" }
      ]
    }
  ]
}
```

Rode `import <campanha> <leitura>`. Os números vão como aparecem; o app converte.

## 4. Comparar

- Compare as peças entre si, nunca com outro perfil ou outra rede.
- A métrica que mais diz sobre o gancho é quanto do vídeo as pessoas veem: o tempo médio de visualização contra a duração.
- Com poucas centenas de contas alcançadas, uma diferença pequena é indício, não resultado. Diga isso ao integrante.

O resultado entra na evidência como resultado próprio e conta como um tipo de fonte a mais na confiança de cada conceito. Registre no diário (`journal <campanha> --note "…"`) o que o teste mostrou.
