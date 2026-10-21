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

## 1.1.0, 2026-10-21

**Os testes.** `node --test "modules/ad-creatives/tests/*.test.mjs"`: 53 testes, 52 passam e 1 é pulado sem `ADS_TEST_REAL=1`. Com a variável, o teste do Motor de verdade (`tests/templates.test.mjs`) passa em 4 min: os três modelos em 9:16 na zona `ads_meta` e, na mesma prévia, o vídeo 4:5 e as imagens 4:5 e 1:1 na zona do feed.

**A rodada com o Motor de verdade até o final.** Num projeto de rascunho, com o app e o Motor copiados do repositório, a campanha de teste (`tests/fixtures/campanha.mjs`) foi do `new` ao `final` dos três conceitos: o vídeo vertical, o vídeo 4:5 e a imagem 4:5 em dois deles, e o vídeo vertical, o 4:5 e a imagem 1:1 no terceiro. As nove peças finais passaram em todos os itens, sem aviso. Os vídeos têm 1080 por 1920 e 1080 por 1350, 15 s e som. O vídeo 4:5 foi conferido contra `feed` (formato, duração, área segura, texto, cortes, piscadas, tempo parado e volume), e as imagens com `--safe instagram-feed`. As imagens e as folhas de quadros foram abertas e lidas: o gancho, a tela do produto, o logo e o botão aparecem inteiros. A faixa vazia embaixo das imagens é o recuo de 200 px da zona do feed na tabela do Motor, não um defeito do layout, que centraliza cada cena na zona.

**Os casos novos de `tests/eval.json`.** Rodados no nível do script, como na 1.0.0; a conversa continua sem avaliação (o executor é a fase P7).

| Caso | Resultado | O que o app devolveu |
|---|---|---|
| com chave | coberto pelo teste | `tests/apify.test.mjs`, contra o servidor falso do Apify: uma execução com as 5 buscas, `maxItems` e `maxTotalChargeUsd` na chamada, a chave só no cabeçalho, 13 anúncios na evidência (10 de uma página, D12), o bruto em `pesquisa/apify/`, o custo cobrado relido; a segunda coleta do dia volta `cached`, sem chamada |
| chave vazia | coberto pelo teste | `APIFY_TOKEN` vazio ou só com espaço dá `mode: "manual"` e nenhuma chamada, mesmo com a chave salva em `~/.flyee/keys.json`; sem a variável, a chave salva é usada |
| custo acima do teto | coberto pelo teste | `needs_confirmation` com o valor ("US$ 0,07") e nenhuma chamada; com `--confirm-cost`, a coleta roda |
| parceiro ausente | coberto pelo teste | `check` devolve os três parceiros com `installed: false`, o que cada um traz (`gives`) e o comando de instalar; o resto da campanha não depende deles. A oferta numa frase e o "não" respeitado são conversa |
| anúncio de referência que não baixa | não rodado | depende de um endereço de vídeo expirado no Apify real e da Análise de vídeo; a skill manda dizer numa frase e seguir sem a análise, com os códigos do guia dela |

**Achados desta rodada, já corrigidos na 1.1.0.**

- `parseMetric` lia "0:06" como 0 e "6,4 s" como 6, sem erro: o número vinha do começo do texto. Agora uma duração vira segundos e um relógio que não é duração é recusado (`tests/unit.test.mjs`, "a test Reels' statistics"). A 1.0.0 tem o mesmo leitor; nela, nenhum guia pede duração.
- Um site que lê o nome do anúncio com um padrão sem `<formato>` fazia o `concepts` recusar todo conceito com as três peças da 1.1.0 ("o nome se repete"). Agora o anúncio tem um nome só, o do vídeo vertical, e o arquivo de cada outra peça leva o posicionamento depois dele (teste "a site pattern without <formato>").
- As notas de lançamento só falavam dos Reels de teste quando havia peça de feed; agora sempre.
- Saiu das notas a frase de que, no feed, a Meta mostra o centro do vídeo vertical e que o conteúdo já cabia ali: a conta não fecha (a zona do anúncio começa em 270 px, e o 4:5 central de um 9:16 começa em 285) e não foi conferida na fonte. Ficou o pedido de conferir na prévia do Gerenciador.

**O que não foi verificado.** Uma coleta real pelo app (a T0.3 rodou o coletor em 2026-10-12, fora do app); `collation_count` contra a tela da Biblioteca; o download de um anúncio pela Análise de vídeo, pelo endereço do Apify ou pelo link da Biblioteca. Com o preço de 2026-10-21 (US$ 0,00075 por anúncio) e os limites do app (12 buscas, 10 anúncios por concorrente, 30 por palavra), a maior coleta possível custa US$ 0,27: o pedido de sim acima de US$ 1 só dispara se o preço subir.
