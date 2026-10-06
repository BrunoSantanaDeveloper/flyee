# flyee — o produto

Este repositório privado é o **produto** do flyee.club: a CLI pública `flyee` (`npx flyee`), o core do harness que ela instala na máquina do integrante e os apps do catálogo. A **plataforma** (contas, cobrança, token, servidor de pacotes, painel) é outro repositório; este só depende do contrato `docs/CLI-CONTRACT.md` dela e do JSON Schema do manifesto, pinado em `schemas/`.

## O que sai daqui e para onde

| Artefato | Destino | Como |
|---|---|---|
| A CLI `flyee` | npm, público, versão 1.x | `npm run build` em `packages/cli`, publicada pela CI na tag `cli-v*` |
| O core do harness | dentro do pacote da CLI | `packages/core/assets` copiado para `packages/cli/dist/core` no build |
| Cada app | o servidor de pacotes da plataforma, nunca o npm | `npm run pack` gera `dist/modules/<slug>-<versão>.zip` com o checksum; o operador envia pelo console `/admin/catalogo` |
| O índice de apps | a plataforma, para criar e atualizar os módulos | `npm run index` gera `dist/index.json` |

Nada fora de `packages/cli` chega ao integrante: documentação, harness de desenvolvimento, testes dos apps e ferramentas de build ficam aqui. `npm run check:tarball` falha se o pacote publicado carregar qualquer coisa além de `dist/`, `README.md` e `LICENSE`.

## Comandos (na raiz)

```bash
npm install            # sempre na raiz
npm run validate       # valida todos os apps em modules/
npm run pack           # regenera `files`, valida e empacota os apps em dist/modules/
npm run index          # gera dist/index.json
npm run build          # empacota a CLI em packages/cli/dist/flyee.js
npm test               # testes de todos os pacotes
npm run typecheck
npm run ci:verify      # tudo o que a CI roda
```

## Documentos

- `docs/ARQUITETURA.md` — como o produto é montado e como ele chega à máquina do integrante.
- `docs/COMO-CRIAR-UM-APP.md` — a referência para construir um app.
- `docs/RELEASE.md` — como publicar a CLI e uma versão de app.
- `docs/PLANO.md` — fases do produto e o estado de cada uma.
- `CLAUDE.md` — convenções do repositório para pessoas e agentes.
