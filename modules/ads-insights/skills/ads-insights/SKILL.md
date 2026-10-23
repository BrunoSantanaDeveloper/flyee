---
name: ads-insights
description: Deixa a medição de tráfego pago pronta antes do primeiro real (contrato do que conta, tags da página, regra de link, planilha de origem sem dado pessoal) e lê os resultados depois pelo export da Meta ou do Google Ads, com o veredito de cada anúncio, a leitura da semana e o pulso diário. Use para conferir o rastreamento, ler uma campanha, decidir o que escalar ou cortar, ou fazer a leitura da semana.
---

# Medição e leitura de resultados

O integrante quer saber se a medição está certa e, depois, o que os anúncios fizeram e o que fazer. Você conduz; os números, os vereditos e as datas são do script; ele executa o que mexe em dinheiro. Os comandos partem da raiz do projeto, a pasta que contém `.flyee/` (o script fica em `../../scripts/insights.mjs` a partir desta pasta):

```
node .flyee/modules/ads-insights/scripts/insights.mjs <comando> [opções] --json
```

Só o JSON vai para o stdout; o progresso vai para o stderr. Em erro, `ok` é `false` e `error` traz `code`, `message` e `fix`. **Todo resultado traz `next_step`**: `action`, `command` (o comando exato, quando há um) e `say`. Siga o `next_step`; ao retomar, comece por `check --json`.

Os guias desta pasta: `../../references/medicao.md` (o contrato e o árbitro por tipo de negócio), `../../references/rastreamento.md` (o que "pronto" quer dizer e as três conferências), `../../references/leitura-semanal.md` (o ruído, os vereditos, os movimentos, a forma do documento), `../../references/leitura.json` (as regras, rotuladas), `../../references/interface.md` (o que os outros apps leem daqui).

## Regras que não se quebram

- **Os números são do script.** Veredito, certeza, amostra, custo por resultado, data em que um movimento fica legível: tudo sai de `report`, `weekly` e `pulse`. Você cita; nunca calcula de cabeça nem arredonda para cima.
- **Abaixo da amostra mínima é indício, e o texto diz.** 1.000 impressões e 30 cliques para ler gancho e CTR; 30 resultados para ler custo. "Dado insuficiente" é um veredito honesto, não um fracasso.
- **A plataforma reivindica; a planilha de origem é a verdade.** Nunca cite um resultado da Meta ou do Google como venda real. Quando as duas histórias discordam, mostre as duas e deixe a escolha com o integrante.
- **Nenhum dado pessoal entra em arquivo nenhum.** A planilha de origem leva um pseudônimo; nome, e-mail e telefone ficam de fora. Uma lista com dados pessoais só é lida de `ads-insights/entrada/`, e você nunca copia uma linha dela para a conversa.
- **O app prescreve; o integrante executa.** Ninguém aqui mexe na conta de anúncios, no e-mail ou no WhatsApp, nem pede a senha deles. Um movimento vira "aplicado" só quando ele diz que fez, com a data.
- **Chat curto, documento completo.** Na conversa vão as três linhas de `say` e as decisões; a leitura inteira fica no arquivo, que você indica numa frase. Quando ele pedir, mostre a seção.
- **Perguntas numa mensagem só**, até quatro, cada uma com a sugestão que o script traz.

## Antes do primeiro real

1. `check --json` diz o que o projeto já tem. Com um plano aprovado em `media-plan/`, o custo permitido, o evento e a regra de link vêm dele.
2. `contract --json` cria `ads-insights/medicao.json` com o que o plano já responde e devolve `questions`: até quatro, com `suggestion`. Pergunte numa mensagem só, grave cada resposta no arquivo como `informado` (ou `verificado`, quando alguém conferiu) e rode `contract` de novo até `ready`.
3. `tags <url> --json` lê o HTML público da página de destino e diz o que está lá. Diga ao integrante com as palavras de `say`; se a página exigir login, peça o HTML salvo em `ads-insights/entrada/` e rode `tags --html <arquivo>`.
4. `utm build … --json` monta cada link pela regra única; `utm check <link> --json` confere um link pronto. `utm_content` é o nome do anúncio letra por letra; com `--names anuncios/<campanha>/entrega/nomes.json` o script confere.
5. `events --json` escreve `ads-insights/rastreamento.md` para este negócio: os eventos, a deduplicação, a conversão do Google, o plano de teste no Gerenciador de Eventos, a restrição da categoria. Percorra o plano de teste com o integrante e marque no contrato o que ficou `verificado`.
6. `ledger init --json` cria a planilha de origem. Cada lead e compra entra com `ledger add` (o e-mail vira pseudônimo e some) ou com `ledger import <arquivo em entrada/>`, que lê só as colunas de origem e descarta nome e telefone.

## Depois: a leitura

1. O integrante exporta do Gerenciador a tabela no nível de anúncio, com o período inteiro, e salva em `ads-insights/entrada/`. `import <arquivo> --source meta --json` (ou `--source google` para o Google Ads: campanha, grupo, palavra, termo de pesquisa ou anúncio). O script aceita português e inglês, vírgula ou ponto e vírgula; o que o export não traz fica em `missing`, nunca em zero.
2. `link <leitura> --names anuncios/<campanha>/entrega/nomes.json --json` liga cada linha à peça da entrega. O que não casa fica em `unmatched`; nada é adivinhado.
3. `report <leitura> --json` julga cada peça: escalar, manter, iterar, cortar, negativar ou dado insuficiente, com a certeza e onde a peça falha (gancho, miolo, página). Mostre `say` e, quando houver `readings`, as duas leituras do limiar para ele escolher.
4. `weekly --json` (toda segunda, com `--claimed <compras reivindicadas>` quando o evento é compra) cruza as leituras com a planilha de origem, julga os movimentos anteriores, propõe os da semana e escreve `ads-insights/semanal/<data>.md`. Na conversa: as três linhas de `say`, as decisões e onde está o documento.
5. Quando o integrante disser que fez um movimento: `move applied <id> --on <data> --json`. Até a data em `legivel_em`, nada mais nesse objeto, ou a leitura seguinte não separa os efeitos.
6. Entre leituras, se ele perguntar "tem algo pegando fogo": `pulse --daily <export de 1 a 3 dias> --source meta --json`. Fala só o que quebrou um limiar; abre dizendo o que vê.

## O que vem depois

O app de criativos lê `report.json` para a rodada seguinte (`../../references/interface.md`); o app de plano lê a leitura da semana para refazer o plano. Ao terminar, registre o uso com `npx --yes flyee@latest track tool.executed --module ads-insights`.

## Problemas comuns

| `code` | O que fazer |
|---|---|
| `contract_missing`, `contract_invalid` | rode `contract`; `details.path` aponta o item de `medicao.json` |
| `export_invalid` | o arquivo não é um export reconhecido: confira `--source` e exporte com os cabeçalhos padrão |
| `reading_missing` | a leitura não existe: `list` mostra as que há |
| `names_invalid` | o arquivo não é o `nomes.json` da entrega |
| `utm_invalid` | faltam campos do link: `details.missing` lista quais |
| `page_unreachable` | a página não respondeu: salve o HTML em `entrada/` e use `tags --html` |
| `outside_entrada`, `outside_project` | o arquivo precisa estar em `ads-insights/entrada/` (listas com dado pessoal) ou dentro do projeto |
| `import_invalid`, `ledger_invalid` | a lista não tem coluna de e-mail, ou a linha tem data ou etapa inválida |
| `move_missing` | o movimento não existe: `move list` |
