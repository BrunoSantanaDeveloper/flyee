# modules/

Um diretório por app. O nome do diretório é o `name` do manifesto e o slug no catálogo da plataforma. `_template` é o ponto de partida de um app novo e é ignorado pelas ferramentas.

Tudo o que está aqui, menos `tests/`, `.dev/` e `*.dev.md`, chega ao integrante dentro do ZIP do app. Referência: `docs/COMO-CRIAR-UM-APP.md`. Procedimento: skill `app-author`.

```bash
npm run validate          # todos os apps
npm run validate radar    # um app
npm run pack radar        # regenera `files`, valida e gera dist/modules/radar-<versão>.zip
```
