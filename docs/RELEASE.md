# Publicação

## Uma versão de app

1. Árvore limpa; `npm run validate` e `npm run pack` verdes. O `pack` regenera `files` no manifesto, grava `dist/modules/<slug>-<versão>.zip` e `.sha256`, e imprime o checksum.
2. Tag: `git tag <slug>@<versão>`. A primeira tag de um app é a versão grátis.
3. No console da plataforma, `/admin/catalogo/<slug>`: se o módulo não existe, crie-o com o mesmo slug, trilha e tipo do manifesto. Envie o ZIP pelo upload em dois passos. A plataforma recomputa o SHA-256; ele precisa ser igual ao impresso no passo 1.
4. Publique. Na primeira versão, marque-a como grátis. Numa correção, retire a versão anterior só se ela precisar sair do ar, com o motivo.
5. Confira `/verificar/<slug>@<versão>` e a página do app.
6. Ponta a ponta, numa pasta de teste: `npx flyee add <slug>` com uma conta sem compra e com uma paga; `npx flyee update` nas duas; `npx flyee status` mostra a distância na conta sem compra.

Quando a plataforma tiver o token de serviço e a importação do índice (fase 10.2 dela), os passos 3 e 4 passam a ser `npm run index` seguido do envio pela CI; publicar continua sendo um ato deliberado no console.

## A CLI

1. `npm run ci:verify` verde. `npm run check:tarball` lista só `dist/**`, `package.json`, `README.md` e `LICENSE`.
2. Suba `version` em `packages/cli/package.json`. A linha é 1.x; a 0.x do pacote `flyee` no npm é de outro projeto e não fala o contrato.
3. Atualize a seção de mudanças de `packages/cli/README.md`.
4. Tag `cli-v<versão>` e push da tag. O workflow `release-cli` publica com `NPM_TOKEN` e proveniência.
5. Peça ao operador da plataforma para subir `platform_settings.cli.min_cli_version` quando a versão for o novo piso. Na primeira publicação, para `1.0.0`.

## Segredos da CI

| Segredo | Uso |
|---|---|
| `NPM_TOKEN` | publicar o pacote `flyee` (token de automação com 2FA) |
| `FLYEE_SERVICE_TOKEN` | enviar rascunhos e o índice à plataforma, quando existir |
