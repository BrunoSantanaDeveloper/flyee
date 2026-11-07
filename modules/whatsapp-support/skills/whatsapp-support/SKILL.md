---
name: whatsapp-support
description: Monta num projeto de código o atendimento pelo WhatsApp com robô de IA e equipe, sobre o Chatwoot, com base pronta, telas no design system do projeto, login único, API oficial ou não oficial, tema e atualização. Use quando pedirem chatbot ou atendimento por WhatsApp num sistema, ou para atualizar ou conferir esse atendimento.
---

# Atendimento no WhatsApp com IA e equipe

Você está num projeto de código (um sistema que o desenvolvedor mantém). Este app traz a base pronta do atendimento: o robô, a ligação com o Chatwoot e com o OpenWA, as telas de modelo, os arquivos de implantação de referência, o tema do painel e as conferências. Você leva a base para o projeto, adapta ao jeito dele e diz ao desenvolvedor só o que depende dele.

## A regra que não quebra

1. **Nada roda em servidor por você.** Não use SSH, Docker remoto nem API de provedor de nuvem. Você prepara arquivos no projeto; quem implanta é o caminho de implantação que o desenvolvedor já usa (pipeline, painel do orquestrador, o que for).
2. **Segredo não aparece.** Token, chave e senha nunca vão para o chat, para `escolhas.json`, para `kit.json`, para log ou para commit. Ficam no cofre de segredos do projeto ou em `<destino>/segredos/`, que o kit põe no `.gitignore`.
3. **A base não se edita.** Tudo em `<destino>/base/` é do kit e a atualização troca. Adaptação vai para o código do projeto, a partir de `<destino>/modelos/`.
4. **Equipe do cliente é atendente.** Administrador no Chatwoot é só a conta de serviço que o projeto cria.

## Passo 1: entender o projeto

Leia antes de propor qualquer coisa:

- framework e linguagem do servidor, sessão e login, banco e ORM;
- o que é um cliente no projeto (empresa, escritório, loja): cada cliente vira uma conta no Chatwoot;
- o design system: biblioteca de componentes e o arquivo de tokens (cores, fonte);
- código de WhatsApp que já existe e será substituído;
- camada de IA que já existe, com regras de aprovação ou auditoria;
- como o projeto é implantado e em que domínio.

Depois, mande ao desenvolvedor um plano curto: onde o kit vai ficar, o que substitui o quê, a rota de conexão e o modo do robô sugeridos, e a lista do que só ele faz. Pergunte só o que não deu para descobrir, até quatro perguntas numa mensagem, cada uma com a sua sugestão.

Para decidir a rota, leia [references/whatsapp.md](../../references/whatsapp.md). Atividade regulada (saúde, jurídico, financeiro) usa a API oficial. Projeto em que toda resposta de IA passa por aprovação humana começa no modo sugestão, ou usa o provedor `project` para gerar a resposta pela IA do próprio projeto.

## Passo 2: instalar a base

Escolha uma pasta dentro do projeto que combine com a estrutura dele (`src/atendimento` num app Next.js, `packages/atendimento` num monorepo) e rode, da raiz do projeto:

```
node .flyee/modules/whatsapp-support/scripts/kit.mjs install <destino> --json
```

Ele cria `<destino>/base/`, `<destino>/modelos/`, `<destino>/escolhas.json`, `<destino>/kit.json` e as pastas `gerado/`, `segredos/` e `conferencia/`.

## Passo 3: ligar ao projeto

Siga [references/contratos.md](../../references/contratos.md) e [references/arquitetura.md](../../references/arquitetura.md).

- **Servidor.** Copie `modelos/next/lib/atendimento.ts` para o código do projeto e implemente o `store` com o banco e a sessão do projeto: o estado de cada cliente (com os tokens cifrados), as configurações do robô, a conta do Chatwoot de cada cliente e a pessoa logada. Ajuste os caminhos de import para onde a base ficou.
- **Rotas.** Copie `modelos/next/app/api/atendimento/` para o app. Em outro framework ou linguagem, porte as mesmas rotas usando `base/server/*.mjs` ou os contratos.
- **Consultas do robô.** Troque o exemplo `consultar_pedido` pelas consultas reais. Cada uma devolve só dados da pessoa da conversa e é o projeto que confere quem ela é ([references/seguranca.md](../../references/seguranca.md)).
- **Telas.** Copie `modelos/react/`. Adapte só `primitives.tsx` aos componentes do design system; as telas usam apenas ele. Ponha "Robô de atendimento" e "Conectar WhatsApp" na área de configurações do cliente e o botão "Atendimento" na navegação. Com o modo moldura, use `PainelAtendimento` numa página do projeto.
- **IA.** Ajuste `defaultAi`. Com uma camada de IA própria e regra de aprovação, prefira o modo sugestão ou o provedor `project`.

Rode o typecheck e os testes do projeto depois de ligar.

## Passo 4: tema e enxugar o painel

Preencha `<destino>/escolhas.json` a partir dos tokens do design system: nome, cor principal (e a do modo escuro, se for outra), fonte, logos, endereços, funções desligadas, o que esconder, links soltos e se o painel abre na moldura. Regras em [references/tema.md](../../references/tema.md) e [references/enxugar.md](../../references/enxugar.md). Depois gere:

```
node .flyee/modules/whatsapp-support/scripts/kit.mjs theme <destino> --json
```

`gerado/` vai para o git: não tem segredo e a implantação usa.

## Passo 5: preparar a implantação

Leia [references/pre-requisitos.md](../../references/pre-requisitos.md) e confira o que o projeto já tem. Leve `modelos/implantacao/` para o caminho de implantação do projeto e ajuste lá (Compose, Swarm, outro orquestrador; Caddy, Traefik ou Nginx). Gere os segredos aleatórios num arquivo em `<destino>/segredos/` sem mostrar o conteúdo, e diga ao desenvolvedor que eles precisam ir para o cofre do ambiente de produção.

Diga ao desenvolvedor, numa lista curta, o que só ele faz: o servidor e o DNS, o super administrador do Chatwoot na primeira abertura, o Platform App e o token dele, a conta da Meta na rota oficial, a chave do provedor de IA, e rodar o serviço `chatwoot-config` uma vez a cada implantação.

## Passo 6: conferir

Com o atendimento no ar, rode as conferências, passando o `.env` do projeto quando as variáveis não estão no ambiente:

```
node .flyee/modules/whatsapp-support/scripts/kit.mjs verify <destino> --env <arquivo .env> --account <id da conta> --json
node .flyee/modules/whatsapp-support/scripts/kit.mjs look <destino> --account <id da conta> --user <id da pessoa de teste> --env <arquivo .env> --json
```

A pessoa de teste é uma atendente criada pelo próprio projeto, por exemplo com `ensureStaffUser` e a chave `conferencia`. `look` salva capturas em `<destino>/conferencia/`; olhe as capturas antes de dizer que o tema e o enxugar estão certos. Cada falha volta com a correção; corrija e rode de novo.

## Atualizar

```
node .flyee/modules/whatsapp-support/scripts/kit.mjs status <destino> --json
node .flyee/modules/whatsapp-support/scripts/kit.mjs update <destino> --json
```

`update` para se o projeto editou algum arquivo da base; leve a edição para fora da base e rode de novo. Depois leia [references/atualizar.md](../../references/atualizar.md) para o que mudou de uma versão para outra, porte os modelos listados em `models_changed`, troque as versões das imagens conforme `kit/versoes.json` do app, gere o tema e rode as conferências.

## O que dizer ao desenvolvedor

Curto: o que ficou pronto, o que falta e é dele (uma lista), e as decisões que só ele toma. Nunca mostre valor de segredo; diga o nome da variável e onde ela fica.
