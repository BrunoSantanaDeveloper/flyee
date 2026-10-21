# Publicação

## Uma versão de app

1. Árvore limpa; `npm run validate` e `npm run pack` verdes. O `pack` regenera `files` no manifesto (os guias em `guides/` entram nele), grava `dist/modules/<slug>-<versão>.zip` e `.sha256`, e imprime o checksum. Faça o commit do manifesto antes da tag: o ZIP sai do conteúdo desse commit.
2. Tag: `git tag <slug>@<versão>` no commit de onde o ZIP saiu, e push dessa tag sozinha (o GitHub não dispara workflow quando chegam mais de três tags num push). O workflow "Pack app" refaz o ZIP a partir da tag, guarda o artefato e envia o app à plataforma como rascunho, com o segredo `FLYEE_SERVICE_TOKEN` (contrato, seção 10): o índice de todos os apps (cria ou atualiza cada módulo), o ZIP e a versão. Ele falha se o SHA-256 que a plataforma calculou for diferente do que o `pack` gravou, e trata uma versão que já existe como sucesso. Para reenviar sem uma tag nova, com o token no ambiente: `npm run pack <slug>`, `npm run index` e `npm run apps -- send <slug>`.
3. No console da plataforma, `/admin/catalogo/<slug>`, a versão aparece como rascunho, com o SHA-256 do passo 1. Sem o token de serviço, o caminho manual continua: crie o módulo com o mesmo slug, trilha e tipo do manifesto, se ele não existe, e envie o ZIP pelo upload em dois passos.
4. Publique. A primeira versão publicada de um app recebe sozinha a marca de **versão de entrada**: é a que a conta sem compra instala, e ela nunca muda por atualização. Confira no console se é essa versão que deve ficar com a marca; se não for, mova a marca para outra versão publicada (ou tire). A versão marcada não pode ser retirada enquanto tiver a marca. Numa correção, retire a versão anterior só se ela precisar sair do ar, com o motivo.
5. Confira `/verificar/<slug>@<versão>` e a página do app, com a aba Guia: "usar" para todos e "abrir o capô" para o FlyeeClub Pro, lidos de `guides/<pt-BR|en>/<usar|abrir-o-capo>.md` dentro do pacote.
6. Ponta a ponta, numa pasta de teste, com uma conta sem compra e com uma paga: peça à IA para instalar o app (ela diz numa frase qual app vai instalar e roda `npx --yes flyee@latest add <slug> --yes --json`, sem esperar o sim); depois a atualização e o estado (`update --json`, `status --json`). Na conta sem compra, o estado mostra a distância até a versão mais nova.

**Ordem.** Os motores são publicados antes dos apps que dependem deles, porque a skill de um app instala o motor com `add` e a plataforma precisa servi-lo: `video-render` antes de `video-studio` e `motion-carousel`; `video-analysis` e `youtube-research` antes de `youtube-script`.

O envio pela CI nunca publica nem retira uma versão: publicar continua sendo um ato deliberado no console.

**Mandar o índice de novo, sem versão nova.** Nome, resumo, trilha e o exemplo da loja (`.dev/showcase.json`) vão à plataforma pelo índice, que todo envio manda inteiro. Para mandar o índice do `main` depois de mudar só isso, dispare o "Pack app" à mão no `main`, com uma tag já enviada cuja versão o `main` ainda carrega: `gh workflow run pack-modules.yml --ref main -f tag=video-render@1.0.0`. A versão volta como `409`, a resposta esperada. Nunca reexecute o run de uma tag antiga para isso: ele manda o índice daquela tag, e foi assim que um resumo antigo voltou ao catálogo. No log, a linha de cada app na importação não pode trazer aviso de `showcase`.

## A CLI

1. O CI do `main` verde: o workflow `release-cli` roda o mesmo `npm run ci:verify` no Linux antes de publicar. `npm run check:tarball` lista só `dist/**`, `package.json`, `README.md` e `LICENSE`. `npm run check:packed` empacota a CLI, instala o pacote numa pasta temporária e a roda pelo `node_modules/.bin/flyee` (o caminho do npx) e pelo bin global, sem proxy, com um proxy em `HTTPS_PROXY` e com um valor que o Node não usa como proxy; a 1.0.0 passou em todos os testes e não fazia nada no macOS e no Linux, onde esse caminho é um link simbólico. O job do Windows na CI roda o mesmo conferidor.
2. Suba `version` em `packages/cli/package.json`. A linha é 1.x; a 0.x do pacote `flyee` no npm é de outro projeto e não fala o contrato. Nunca publique uma prerelease como primeira versão: ela viraria o `latest` que todo mundo baixa, e a plataforma conta uma alpha como mais antiga que o piso.
3. Atualize a seção de mudanças de `packages/cli/README.md`.
4. Tag `cli-v<versão>` e push da tag. O workflow `release-cli` confere a tag contra a versão do pacote e publica pela publicação confiável do npm, sem token: no npmjs.com, o pacote `flyee` tem em Settings, Trusted Publisher, o GitHub Actions com usuário `BrunoSantanaDeveloper`, repositório `flyee`, workflow `release-cli.yml` e "Allow npm publish" marcado. Uma configuração nova expira se nenhuma publicação acontecer em 2 dias. O repositório é privado, então o npm não gera proveniência, e o workflow não a pede.
5. Peça ao operador da plataforma para subir `platform_settings.cli.min_cli_version` quando a versão for o novo piso. Na primeira publicação, para `1.0.0`.
6. Depois da publicação, confira o que o integrante recebe: `npx --yes flyee@latest --version` no Windows e num contêiner Linux (`node:22-bookworm`) imprime a versão nova.

## Segredos da CI

| Segredo | Uso |
|---|---|
| nenhum para o npm | a publicação confiável identifica o workflow; tokens que pulam o 2FA deixam de publicar em janeiro de 2027 |
| `FLYEE_SERVICE_TOKEN` | o workflow "Pack app" envia o índice e o rascunho de cada versão à plataforma; o mesmo valor fica nas variáveis da Vercel, com pelo menos 32 caracteres (`openssl rand -hex 32`) |
