---
name: app-release
description: Procedure to publish a version of an app or a release of the CLI — pack and checksum, console upload as draft, publish, check the entry-version mark, verify page and guides, end-to-end check with an account without purchase and a paid one; engines before the apps that use them; CLI tag and npm publish through CI. Use when asked to "publish", "release", "subir uma versão" or "lançar o app".
---

# Release

Follow `docs/RELEASE.md`; this is the checklist. Creating and pushing tags and publishing are the operator's acts: prepare everything, then hand over the exact tags with the commit and the SHA-256 of each package.

## An app version

1. `npm run validate` and `npm run pack` on a clean tree; commit the manifest that `pack` rewrote (its `files` lists the guides). Note the ZIP path and the SHA-256 printed. To prove the ZIP comes from the commit, pack again from an export of that commit (`git archive <commit> modules/<slug>`) and compare the checksum.
2. The tag is `<slug>@<version>` on that commit. The "Pack app" workflow rebuilds the ZIP from the tag; its checksum must match step 1.
3. Upload the ZIP in the platform console `/admin/catalogo/<slug>` (two-step upload). The platform recomputes the checksum; it must equal the one printed in step 1.
4. Publish in the console. The first published version of an app gets the **entry version** mark by itself (what an account without purchase installs, never changed by an update); check that it belongs there, or move it to another published version. A marked version cannot be yanked while it has the mark. On a fix, write the yank reason for the previous version only if it must be withdrawn.
5. Check the public page `/verificar/<slug>@<version>` and the app page with its Guide tab (`guides/<pt-BR|en>/usar.md` for every member, `abrir-o-capo.md` for FlyeeClub Pro).
6. End to end, in a scratch project, with an account without purchase and a paid one: the AI installs with `npx --yes flyee@latest add <slug> --dry-run --json` and then `--yes --json`; `update --json` on both; `status --json` shows the distance on the one without purchase.

Engines first: `video-render` before `video-studio` and `motion-carousel`; `video-analysis` and `youtube-research` before `youtube-script`. A dependent app's skill installs its engine with `add`, which needs the engine published.

## The CLI

1. `main` green in CI (the `release-cli` workflow runs the same `npm run ci:verify` on Linux before it publishes); `npm run check:tarball` lists only `dist/**`, `README.md`, `LICENSE` and `package.json`.
2. Bump `version` in `packages/cli/package.json` (1.x; never 0.x, that line belongs to another project; never a prerelease as the first published version) and the changes section of `packages/cli/README.md`.
3. The tag is `cli-v<version>`; once pushed, the `release-cli` workflow checks it against the package version and publishes with `NPM_TOKEN`.
4. Ask the platform operator to raise `platform_settings.cli.min_cli_version` when a release is the new floor (`1.0.0` on the first one).
