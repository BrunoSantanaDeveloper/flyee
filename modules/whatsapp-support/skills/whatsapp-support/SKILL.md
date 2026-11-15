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
- quem atende quem: o sistema atende os próprios clientes, como um suporte da plataforma (modelo `plataforma`, uma conta no Chatwoot), ou cada cliente do sistema atende os clientes dele (modelo `por-cliente`, uma conta por cliente);
- quem é o superadmin do sistema e quem administra cada cliente;
- o design system: biblioteca de componentes e o arquivo de tokens (cores, fonte);
- código de WhatsApp que já existe e será substituído;
- se as equipes que vão usar o atendimento trabalham em grupos do WhatsApp (comercial, suporte, contas);
- camada de IA que já existe, com regras de aprovação ou auditoria;
- como o projeto é implantado e em que domínio.

Depois, mande ao desenvolvedor um plano curto: onde o kit vai ficar, o que substitui o quê, a rota de conexão e o modo do robô sugeridos, e a lista do que só ele faz. Pergunte só o que não deu para descobrir, até quatro perguntas numa mensagem, cada uma com a sua sugestão escrita de modo que "sim" a aceite; um "ok" aceita as sugestões da rodada. Uma pergunta que depende de outra ainda em aberto fica para a rodada seguinte: o que cada cliente pode mudar no robô depende do modelo escolhido. Para fechar o que o robô resolve e o que vai para a equipe, proponha um caso concreto do negócio do projeto, como "um cliente pede reembolso às 22 horas: o robô responde ou abre para a equipe?", e grave a decisão.

Para decidir o modelo e quem controla o contexto do robô, leia [references/contexto.md](../../references/contexto.md). O superadmin sempre controla a camada da plataforma; no modelo `por-cliente`, ele decide o que cada cliente pode mudar no robô dele. Para decidir a rota, leia [references/whatsapp.md](../../references/whatsapp.md). Atividade regulada (saúde, jurídico, financeiro) usa a API oficial. Projeto em que toda resposta de IA passa por aprovação humana começa no modo sugestão, ou usa o provedor `project` para gerar a resposta pela IA do próprio projeto.

## Passo 2: instalar a base

Escolha uma pasta dentro do projeto que combine com a estrutura dele (`src/atendimento` num app Next.js, `packages/atendimento` num monorepo) e rode, da raiz do projeto:

```
node .flyee/modules/whatsapp-support/scripts/kit.mjs install <destino> --json
```

Ele cria `<destino>/base/`, `<destino>/modelos/`, `<destino>/escolhas.json`, `<destino>/kit.json` e as pastas `gerado/`, `segredos/` e `conferencia/`.

## Passo 3: ligar ao projeto

Siga [references/contratos.md](../../references/contratos.md) e [references/arquitetura.md](../../references/arquitetura.md).

- **Servidor.** Copie `modelos/next/lib/atendimento.ts` para o código do projeto e implemente o `store` com o banco e a sessão do projeto: o estado de cada cliente (com os tokens cifrados), a camada da plataforma (uma só), a camada de cada cliente, as sugestões pendentes, as passagens para a equipe, a conta do Chatwoot de cada cliente, a lista de quem atende em cada cliente (`listPanelPeople`) e a pessoa logada, com `isSuperadmin`, `canConfigure` e `isSupportStaff` vindos das permissões do projeto. Ajuste os caminhos de import para onde a base ficou.
- **Equipe.** Entra no painel só quem passa em `canEnterPanel` (equipe de atendimento e, no `por-cliente`, quem administra o cliente). Chame `removeFromPanel` no ponto em que o projeto tira a permissão de atendimento, desativa ou apaga uma pessoa, e rode `syncPanelStaff` numa rotina diária do projeto para cada cliente: a sessão do Chatwoot dura até 2 meses, e quem saiu da equipe precisa sair da conta. Se a rotina devolver alguém em `unknown`, conte ao desenvolvedor em vez de tirar.
- **Número.** Implemente `alertWhatsapp` no `store`, com o canal de avisos que o projeto já tem, e rode `checkWhatsapp` a cada 15 minutos numa rotina do projeto, para cada cliente com atendimento (no modelo `plataforma`, só `PLATFORM_TENANT`). Sem isso, um número que cai só aparece quando um cliente reclama. Quando alguém disser que o WhatsApp parou, rode `verify`, leia o que a conferência achou e siga [references/whatsapp.md](../../references/whatsapp.md): a volta retoma a mesma caixa, pela tela Conectar WhatsApp.
- **Grupos.** Os grupos do WhatsApp só entram pela rota não oficial, e a escolha fica na tela do robô: `fora` (o padrão), `equipe` (o grupo entra no painel e o robô fica calado) ou `chamado` (o robô responde só a quem o chama pelo nome). Rode `syncWhatsappGroups` na mesma rotina de `checkWhatsapp`: ela liga o repasse dos grupos e dá a cada grupo o nome que ele tem no WhatsApp. Se as equipes trabalham em grupos, sugira `equipe` no plano. Leia a seção "Grupos do WhatsApp" de [references/whatsapp.md](../../references/whatsapp.md).
- **Imagem, áudio e vídeo.** O robô lê foto, print, áudio e vídeo e só passa para a equipe quando não consegue: o ffmpeg do contêiner do robô corta e monta a grade do vídeo, e a transcrição usa a chave do Gemini (a mais barata) ou a da OpenAI no ambiente do robô; o projeto que não deixa chave no robô transcreve pela rota `transcribe`, com `ai.transcription: "project"`. Lê também PDF, planilha (XLSX, ODS), CSV e documento de texto (DOCX, ODT, TXT), sem custo de API, com o conteúdo marcado como dado da pessoa, nunca instrução. Implante o robô com o Dockerfile do kit, que traz o ffmpeg e o poppler, e confira `robo_midia` no `verify`. Leia "Imagem, áudio e vídeo" em [references/contexto.md](../../references/contexto.md).
- **Grupos da equipe.** Para conversar fora de um atendimento, a equipe usa grupos dentro do painel: cada grupo é uma caixa interna, vista só por quem está nele, criada na tela `GruposEquipe` pelo superadmin (modelo `plataforma`) ou por quem administra o cliente (`por-cliente`). Implemente `teamPeople` no `store`, copie a rota `grupos` e a tela, e rode `syncTeamGroupsFor` na mesma rotina de `checkWhatsapp`. Leia a seção "Grupos da equipe" de [references/chatwoot.md](../../references/chatwoot.md).
- **Quem responde assume.** Quando alguém da equipe responde, pelo painel ou pelo celular do número, o robô abre a conversa para a equipe e não escreve mais nela. O que é respondido pelo celular aparece no painel como "Celular do WhatsApp", com a etiqueta `celular` e uma nota pedindo para registrar quem respondeu, porque o celular não diz quem digitou. Recomende ao desenvolvedor que a equipe responda pelo painel, onde fica o nome de quem atendeu.
- **Rotas.** Copie `modelos/next/app/api/atendimento/` para o app. Em outro framework ou linguagem, porte as mesmas rotas usando `base/server/*.mjs` ou os contratos.
- **Consultas do robô.** Troque o exemplo `consultar_pedido` pelas consultas reais. Cada uma devolve só dados da pessoa da conversa e é o projeto que confere quem ela é ([references/seguranca.md](../../references/seguranca.md)).
- **Telas.** Copie `modelos/react/`. Adapte só `primitives.tsx` aos componentes do design system; as telas usam apenas ele.
  - Na área do superadmin: `RoboAtendimento` com `escopo="plataforma"`, `SugestoesConhecimento` e `LacunasRobo` com o mesmo escopo e, no modelo `plataforma`, `ConectarWhatsApp`.
  - No modelo `por-cliente`, na área de configurações de cada cliente: `RoboAtendimento`, `SugestoesConhecimento` e `LacunasRobo` com `escopo="cliente"` (mostram só o que a plataforma liberou) e `ConectarWhatsApp`.
  - O botão "Atendimento" na navegação de quem passa em `canEnterPanel`. Com o modo moldura, `PainelAtendimento` numa página do projeto.
- **IA.** Ajuste `defaultAi`. Com uma camada de IA própria e regra de aprovação, prefira o modo sugestão ou o provedor `project`.

Rode o typecheck e os testes do projeto depois de ligar.

## Passo 4: tema e enxugar o painel

Preencha `<destino>/escolhas.json`: o `modelo` (`plataforma` ou `por-cliente`) e, a partir dos tokens do design system, nome, cor principal (e a do modo escuro, se for outra), fonte, logos, endereços, funções desligadas, o que esconder, links soltos, se o painel abre na moldura e em quantas horas uma conversa parada volta ao robô (`chatwoot.resolver_apos_horas`, 8 se faltar). Regras em [references/tema.md](../../references/tema.md) e [references/enxugar.md](../../references/enxugar.md). Depois gere:

```
node .flyee/modules/whatsapp-support/scripts/kit.mjs theme <destino> --json
```

`gerado/` vai para o git: não tem segredo e a implantação usa.

## Passo 5: preparar a implantação

Leia [references/pre-requisitos.md](../../references/pre-requisitos.md) e confira o que o projeto já tem. Se o servidor já recebe outro sistema com este kit, ou vai receber, use a pilha compartilhada e o proxy da borda de [references/arquitetura.md](../../references/arquitetura.md) ("Mais de um sistema no mesmo servidor"): nunca suba `compose.yml` sozinho num servidor com outra pilha, porque o nome do projeto é fixo e as duas dividiriam o banco. Leve `modelos/implantacao/` para o caminho de implantação do projeto e ajuste lá (Compose, Swarm, outro orquestrador; Caddy, Traefik ou Nginx). Gere os segredos aleatórios num arquivo em `<destino>/segredos/` sem mostrar o conteúdo, e diga ao desenvolvedor que eles precisam ir para o cofre do ambiente de produção. Mantenha `DISABLE_TELEMETRY=true` e a página `/installation` fechada no proxy, liberada só para o IP de quem cria o super administrador ([references/seguranca.md](../../references/seguranca.md), "Na primeira implantação").

Diga ao desenvolvedor, numa lista curta, o que só ele faz: o servidor e o DNS, o super administrador do Chatwoot na primeira abertura, o Platform App e o token dele, a conta da Meta na rota oficial, a chave do provedor de IA, e rodar o serviço `chatwoot-config` uma vez a cada implantação.

## Passo 6: conferir

Com o atendimento no ar, rode as conferências, passando o `.env` do projeto quando as variáveis não estão no ambiente:

```
node .flyee/modules/whatsapp-support/scripts/kit.mjs verify <destino> --env <arquivo .env> --account <id da conta> --json
node .flyee/modules/whatsapp-support/scripts/kit.mjs look <destino> --account <id da conta> --user <id da pessoa de teste> --env <arquivo .env> --json
```

A pessoa de teste é uma atendente criada pelo próprio projeto, por exemplo com `ensureStaffUser` e a chave `conferencia`. `look` salva capturas em `<destino>/conferencia/`; olhe as capturas antes de dizer que o tema e o enxugar estão certos. Cada falha volta com a correção; corrija e rode de novo. `verify` confere cada sessão do OpenWA; o número da rota oficial aparece na tela Conectar WhatsApp e na rotina `checkWhatsapp`. Nenhuma conferência prova a entrega: peça ao desenvolvedor para mandar uma mensagem de outro celular e ver a resposta chegar.

## Atualizar

```
node .flyee/modules/whatsapp-support/scripts/kit.mjs status <destino> --json
node .flyee/modules/whatsapp-support/scripts/kit.mjs update <destino> --json
```

`update` para se o projeto editou algum arquivo da base; leve a edição para fora da base e rode de novo. Depois leia [references/atualizar.md](../../references/atualizar.md) para o que mudou de uma versão para outra, porte os modelos listados em `models_changed`, troque as versões das imagens conforme `kit/versoes.json` do app, gere o tema e rode as conferências.

## O que dizer ao desenvolvedor

Curto: o que ficou pronto, o que falta e é dele (uma lista), e as decisões que só ele toma. Nunca mostre valor de segredo; diga o nome da variável e onde ela fica.
