# Avaliações do ad-creatives

Material do operador; não sai no pacote.

## 1.0.0, 2026-10-21

**Como rodou.** Cada caso numa pasta isolada em `C:\AppsProjects\flyee-eval\anuncios-<caso>`, com o app instalado por `FLYEE_WORKSPACE=<pasta> npm run apps -- link ad-creatives` (o `dev link` da CLI, que trouxe o `video-render` junto e achou o ffmpeg). Os comandos seguem a ordem do `SKILL.md`, rodados por um script do operador que faz o papel da IA do integrante (`eval-rodada.mjs` e `eval-casos.mjs`, no rascunho da sessão). As fixtures são as de `tests/fixtures/campanha.mjs`, com nomes trocados.

**O que não foi avaliado.** A conversa: se a IA pergunta numa mensagem só, se fala simples, se olha a folha de quadros antes de mostrar e se respeita o sim do integrante. Isso pede uma sessão de IA de verdade na pasta do caso, com alguém no papel do integrante, e fica para o operador (o executor de avaliações é a fase P7 e não existe). Os resultados abaixo provam o que o script devolve à IA em cada situação.

| Caso | Resultado | O que o app devolveu |
|---|---|---|
| rodada zero sem chave | passou | ver abaixo |
| briefing incompleto | passou | 7 perguntas em `questions`; "Verba diária: não sei" vira problema, não número; `budget` recusa com `brief_incomplete` |
| concorrente sem anúncio ativo | passou | 0 ativos; aviso "Nota Clara não tem anúncio ativo na leitura: o que ele mostra é história, não o que paga hoje."; nenhum anúncio encerrado nos padrões |
| conceito sem evidência | passou | `confidence: "aposta"` e o aviso "sem evidência, sai como aposta" |
| pedido de garantia de venda | passou | `copy` reprova com `guarantee_verb` em "É garantido vender o dobro no primeiro mês." |
| termo proibido no texto | passou | `forbidden_term` em "diagnóstico"; `suffers_from` em "Você sofre de insônia?" |
| verba que não sai do aprendizado | passou | R$ 50 por dia e R$ 300 por compra: piso de R$ 2.143, a verba de 7 dias paga 1,2 compra, `viable: false` e as três saídas |
| vídeo avulso vai para o Estúdio | não rodado | depende da escolha da IA entre as skills; a descrição desta skill termina com "Para um vídeo animado avulso, use o Estúdio de vídeo", e o corpo repete a regra |
| site que lê o nome do anúncio | passou | o ângulo "pagamento", fora da lista do site, é recusado em `concepts` com o motivo (a página mostraria a manchete padrão) |
| página com dois produtos | passou | a leitura `tags` com `exclude` tira o anúncio do outro produto; o resumo conta 4 anúncios usados e 1 fora |
| evidência nova depois da aprovação | coberto pelo teste | `tests/commands.test.mjs`: a confiança muda de aposta para baixa em `confidence_changes` e a aprovação continua; mudar o título pede o sim de novo |
| nenhum concorrente achado pelo nome | passou | sem concorrentes no briefing, `links` monta 2 buscas por palavra, filtradas pelo país e só com anúncios ativos |
| leitura que falha | passou | `reading_invalid` em `items[1].started_text` ("28 de set" sem o ano); o app não chuta o ano |

### Rodada zero sem chave, com o Motor de vídeo de verdade

Pasta `C:\AppsProjects\flyee-eval\anuncios-rodada-zero`, campanha `primeira-campanha`, do `check` ao `status`:

- o briefing do modelo devolve 10 perguntas; o preenchido sai completo, com a conta da verba logo de cara (custo máximo de R$ 7 por compra);
- a captura do site de teste do Motor trouxe a marca (nome, logo e o roxo #7C3AED);
- 8 itens de evidência, 1 fora da análise; padrões do mercado: ângulo presenca, gancho contraste e estilo tela-do-produto;
- confiança memoria alta, confianca baixa, mtc aposta;
- as três prévias passaram na conferência do Motor (zona `ads_meta`), sem avisos; os três vídeos finais têm 1080 por 1920, 15 s, com som, e passaram de novo;
- `copy` passou com avisos de corte (o ver mais do feed num texto, os 44 caracteres dos Reels nos três);
- `deliver` montou os três vídeos com os nomes dos anúncios, as capas, `nomes.json`, `textos.md`, `lancamento.md` e `relatorio.json`, com uma pendência (o custo por evento);
- `journal` registrou a rodada 1, e `status` ficou em pronta.

Depois desta rodada, o gancho passou para o tamanho grande de título (a capa ficava pequena); o teste do Motor de verdade rodou de novo com os três modelos e passou em todos os itens, `dead_time` incluído.

**Pacote.** `dist/modules/ad-creatives-1.0.0.zip`, sha256 `0df5d5a9c180bcfb57a1df99bcc74384346661b8b33582e3b8e436c20edd1ff6`. Daqui em diante, o ZIP é a fonte da 1.0.0.
