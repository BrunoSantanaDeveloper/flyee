---
name: meu-app
description: "[PREENCHER] O que esta skill faz e quando usar, em uma ou duas frases com os pedidos típicos do usuário entre aspas. Abaixo de 400 caracteres."
---

# Meu app

## Regra que não se quebra

[PREENCHER] A regra de honestidade do app, por exemplo: todo número vem de coleta real; nunca estimar.

## Passo 0: entender o pedido

[PREENCHER] O que perguntar uma vez, o que inferir do projeto.

## Passo 1: produzir

[PREENCHER] Os passos, com os scripts e as referências relativas a esta pasta (`references/…`, `scripts/…`). Para usar outro app do flyee.club, siga o guia dele em `.flyee/modules/<app>/references/interface.md`; se ele não estiver instalado, rode `npx --yes flyee@latest add <app> --dry-run --json`, diga numa frase o que ele declara e, depois do sim, rode você mesmo `npx --yes flyee@latest add <app> --yes --json` com tempo limite de 10 minutos. Programa que falta, instale com `npx --yes flyee@latest need <programa> --yes --json`; chave que falta, `npx --yes flyee@latest key set <NOME> --browser --json` abre a página do navegador. O integrante nunca abre o terminal.

## Passo 2: entregar

[PREENCHER] Onde gravar e o que mostrar ao usuário. No fim, registre o uso com `npx --yes flyee@latest track tool.executed --module meu-app`.
