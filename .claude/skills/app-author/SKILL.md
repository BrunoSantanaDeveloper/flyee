---
name: app-author
description: Procedure to create or change an app of the flyee.club catalog under modules/<slug> — manifest, README as the member's guide, skills with Agent Skills frontmatter, permissions and credentials, eval cases, changelog and the free-version rule. Use BEFORE writing or editing anything under modules/, and when asked to "create an app", "add a skill to an app" or "release a new version".
---

# Author an app

The reference is `docs/COMO-CRIAR-UM-APP.md`; read it once per session. This skill is the procedure. The boundary rule applies throughout: everything you write under `modules/<slug>/` except `tests/`, `.dev/` and `*.dev.md` ships to members and is read by their AIs.

## 1. Decide the shape

- `type`: `skill` (instructions the AI follows), `workflow` (a pipeline with steps, state and, when scheduled, an automatic half without approvals), `tool` (scripts the AI runs; needs `shell` in permissions), `framework` (a scaffold that creates a new folder; never installs into an existing project).
- `trail`: one of `planejar`, `construir`, `publicar`, `divulgar`, `vender`, `escalar`, `manter`.
- Which AIs you will test (`compatible_ais`); the rest is "compatible by the standard" and needs no declaration.
- Which external keys the member supplies (`external_credentials`) and what the app still does without them.

## 2. Create or open the directory

- New app: copy `modules/_template` to `modules/<slug>` and replace every placeholder; `name` equals the directory.
- Existing app: bump `version` (immutable versions; a fix is a new version) and write the new `changelog` in pt-BR and, if the app is bilingual, in English.

## 3. Write for the member

- `README.md`: what the app does, what it needs, how to use it with one example prompt ("Peça assim: …"), what it writes and where, and the "modo sem chave" when there are credentials. This text becomes the app page on the platform.
- `skills/<name>/SKILL.md`: frontmatter `name` (equals the folder) and `description` (what and when, under 400 characters); body with the steps, the rule that never breaks, and relative references to `references/` and `scripts/` resolved from the skill's own folder.
- Declare `permissions` for everything touched (`fs:read`, `fs:write`, `network`, `shell`, `env`) with a reason the member understands.

## 4. Write for yourself

- `tests/eval.json`: at least one case with `prompt`, `assertions` the runner can check and a `rubric` for a judge. Turn every support failure into a case.
- `.dev/` notes if needed. Never reference them from shipped files.

## 5. Verify

1. `npm run validate` must pass; `npm run pack` regenerates `files` and produces `dist/modules/<slug>-<version>.zip` with its checksum.
2. Install the app from this repo into a scratch project: `FLYEE_DEV=1 flyee dev link ../flyee/modules/<slug>`, then run the skill in the AI and the eval cases.
3. For a first version of a flagship app, confirm the reduced 1.0 and the complete 1.1 are both ready before the launch video.

## 6. Hand over

Report the slug, the version, the trail, the permissions and credentials declared, the eval cases, and the console steps that remain for the operator (`docs/RELEASE.md`).
