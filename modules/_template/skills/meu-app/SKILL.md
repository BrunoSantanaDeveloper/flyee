---
name: meu-app
description: "[PREENCHER] O que esta skill faz e quando usar, em uma ou duas frases com os pedidos típicos do usuário entre aspas. Abaixo de 400 caracteres."
---

# Meu app

## Regra que não se quebra

[PREENCHER] A regra de honestidade do app, por exemplo: todo número vem de coleta real; nunca estimar.

## Passo 0: entender o pedido

[PREENCHER] O que você descobre sozinho (no pedido, no projeto, no site, nos arquivos de outros apps) e o que só o integrante responde.

## Como perguntar

Uma rodada por vez, até quatro perguntas numa mensagem só, e só o que já dá para responder: uma pergunta que depende de outra ainda em aberto fica para a rodada seguinte. Numa decisão, escreva a sua sugestão na própria pergunta, de modo que "sim" a aceite; um "ok" aceita as sugestões da rodada. Um fato que só o integrante sabe vai sem sugestão, e uma decisão de direitos pede resposta própria. O que é igual para vários itens é perguntado uma vez. Quando a resposta está com outra pessoa, use a skill `questionario`.

## Passo 1: produzir

[PREENCHER] Os passos, com os scripts e as referências relativas a esta pasta (`references/…`, `scripts/…`). Para usar outro app do flyee.club, siga o guia dele em `.flyee/modules/<app>/references/interface.md`; se ele não estiver instalado, diga numa frase simples qual app vai instalar e o que ele faz e rode você mesmo `npx --yes flyee@latest add <app> --yes --json` com tempo limite de 10 minutos, sem esperar resposta. Programa que falta, instale com `npx --yes flyee@latest need <programa> --yes --json`; chave que falta, `npx --yes flyee@latest key set <NOME> --browser --json` abre a página do navegador. O integrante nunca abre o terminal.

## Passo 2: entregar

[PREENCHER] Onde gravar e o que mostrar ao usuário. No fim, registre o uso com `npx --yes flyee@latest track tool.executed --module meu-app`.
