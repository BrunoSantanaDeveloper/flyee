# Publicação

## Uma versão de app

1. Árvore limpa; `npm run validate` e `npm run pack` verdes. O `pack` regenera `files` no manifesto (os guias em `guides/` entram nele), grava `dist/modules/<slug>-<versão>.zip` e `.sha256`, e imprime o checksum. Faça o commit do manifesto antes da tag: o ZIP sai do conteúdo desse commit.
2. Tag: `git tag <slug>@<versão>` no commit de onde o ZIP saiu. O workflow "Pack app" refaz o ZIP a partir da tag e guarda o artefato; o SHA-256 dele precisa ser igual ao do passo 1.
3. No console da plataforma, `/admin/catalogo/<slug>`: se o módulo não existe, crie-o com o mesmo slug, trilha e tipo do manifesto. Envie o ZIP pelo upload em dois passos. A plataforma recomputa o SHA-256; ele precisa ser igual ao impresso no passo 1.
4. Publique. A primeira versão publicada de um app recebe sozinha a marca de **versão de entrada**: é a que a conta sem compra instala, e ela nunca muda por atualização. Confira no console se é essa versão que deve ficar com a marca; se não for, mova a marca para outra versão publicada (ou tire). A versão marcada não pode ser retirada enquanto tiver a marca. Numa correção, retire a versão anterior só se ela precisar sair do ar, com o motivo.
5. Confira `/verificar/<slug>@<versão>` e a página do app, com a aba Guia: "usar" para todos e "abrir o capô" para o FlyeeClub Pro, lidos de `guides/<pt-BR|en>/<usar|abrir-o-capo>.md` dentro do pacote.
6. Ponta a ponta, numa pasta de teste, com uma conta sem compra e com uma paga: peça à IA para instalar o app (ela roda `npx --yes flyee@latest add <slug> --dry-run --json` e, com o sim, `add <slug> --yes --json`); depois a atualização e o estado (`update --json`, `status --json`). Na conta sem compra, o estado mostra a distância até a versão mais nova.

**Ordem.** Os motores são publicados antes dos apps que dependem deles, porque a skill de um app instala o motor com `add` e a plataforma precisa servi-lo: `video-render` antes de `video-studio` e `motion-carousel`; `video-analysis` e `youtube-research` antes de `youtube-script`.

Quando a plataforma tiver o token de serviço e a importação do índice (fase 10.2 dela, ainda fora do contrato), os passos 3 e 4 passam a ser `npm run index` seguido do envio pela CI; publicar continua sendo um ato deliberado no console.

## A CLI

1. O CI do `main` verde: o workflow `release-cli` roda o mesmo `npm run ci:verify` no Linux antes de publicar. `npm run check:tarball` lista só `dist/**`, `package.json`, `README.md` e `LICENSE`.
2. Suba `version` em `packages/cli/package.json`. A linha é 1.x; a 0.x do pacote `flyee` no npm é de outro projeto e não fala o contrato. Nunca publique uma prerelease como primeira versão: ela viraria o `latest` que todo mundo baixa, e a plataforma conta uma alpha como mais antiga que o piso.
3. Atualize a seção de mudanças de `packages/cli/README.md`.
4. Tag `cli-v<versão>` e push da tag. O workflow `release-cli` confere a tag contra a versão do pacote e publica pela publicação confiável do npm, sem token: no npmjs.com, o pacote `flyee` tem em Settings, Trusted Publisher, o GitHub Actions com usuário `BrunoSantanaDeveloper`, repositório `flyee`, workflow `release-cli.yml` e "Allow npm publish" marcado. Uma configuração nova expira se nenhuma publicação acontecer em 2 dias. O repositório é privado, então o npm não gera proveniência, e o workflow não a pede.
5. Peça ao operador da plataforma para subir `platform_settings.cli.min_cli_version` quando a versão for o novo piso. Na primeira publicação, para `1.0.0`.

## Segredos da CI

| Segredo | Uso |
|---|---|
| nenhum para o npm | a publicação confiável identifica o workflow; tokens que pulam o 2FA deixam de publicar em janeiro de 2027 |
| `FLYEE_SERVICE_TOKEN` | enviar rascunhos e o índice à plataforma, quando existir |
