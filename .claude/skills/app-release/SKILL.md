---
name: app-release
description: Procedure to publish a version of an app or a release of the CLI — pack and checksum, console upload as draft, publish, mark the free version, verify page, end-to-end check with a free and a paid account; CLI tag and npm publish through CI. Use when asked to "publish", "release", "subir uma versão" or "lançar o app".
---

# Release

Follow `docs/RELEASE.md`; this is the checklist.

## An app version

1. `npm run validate` and `npm run pack` on a clean tree. Note the ZIP path and the SHA-256 printed.
2. Tag the version in git: `git tag <slug>@<version>` (the free version of an app is its first tag).
3. Upload the ZIP in the platform console `/admin/catalogo/<slug>` (two-step upload). The platform recomputes the checksum; it must equal the one printed in step 1.
4. Publish in the console. On a first version, mark it as the free version. On a fix, write the yank reason for the previous version only if it must be withdrawn.
5. Check the public page `/verificar/<slug>@<version>` and the app page.
6. End to end: in a scratch project, `npx flyee add <slug>` with an account on the free channel and with a paid one; `npx flyee update` on both; `npx flyee status` shows the distance on the free one.

## The CLI

1. `npm run ci:verify` green; `npm run check:tarball` lists only `dist/**`, `README.md`, `LICENSE` and `package.json`.
2. Bump `version` in `packages/cli/package.json` (1.x; never 0.x, that line belongs to another project) and the `changelog` section of `packages/cli/README.md`.
3. Tag `cli-v<version>` and push the tag; the `release-cli` workflow publishes with `NPM_TOKEN`.
4. Ask the platform operator to raise `platform_settings.cli.min_cli_version` when a release is the new floor.
