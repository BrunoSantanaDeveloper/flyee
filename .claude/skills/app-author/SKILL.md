---
name: app-author
description: Procedure to create or change an app of the flyee.club catalog under modules/<slug> — first the catalog review (apps to call, apps that help build it, overlaps), then manifest, README as the member's guide, skills with Agent Skills frontmatter, permissions and credentials, eval cases, changelog and the free-version rule. Use BEFORE writing or editing anything under modules/, and when asked to "create an app", "add a skill to an app" or "release a new version".
---

# Author an app

The reference is `docs/COMO-CRIAR-UM-APP.md`; read it once per session. This skill is the procedure; the `apps` skill is the console that runs the commands. The boundary rule applies throughout: everything you write under `modules/<slug>/` except `tests/`, `.dev/` and `*.dev.md` ships to members and is read by their AIs.

## 0. Start from what exists (new apps, and changes that add capabilities)

The apps catalog is in your context (`.claude/rules/catalogo.md`); `docs/CATALOGO.md` has every skill's description and every interface. Read the requested app against it and sort the existing apps into four groups:

| Group | What it means | What you do |
|---|---|---|
| **Call at runtime** | An app that ships `references/interface.md` and does a step the new app needs (example: `video-analysis` for anything that must understand a video) | The new app calls it through its interface instead of reimplementing it. Read that `interface.md` now and design against its commands and output fields. The README tells the member the dependency and `npx flyee add <app>`; the skill handles its absence (§10 of the reference). |
| **Use while building** | An app that helps you make this one now: study reference material, research, analyze examples | Link it into the workspace and run it from there (`apps` skill). Keep its outputs in the workspace; distill what the new app must carry into `references/`. |
| **Overlap** | An app that already does part of the job | Prefer extending it: a new version or a new skill in it. A second app that repeats a skill confuses the member's AI, and skill names must be unique. |
| **Missing tool** | A capability the new app needs that more than one app would use (a downloader, a transcriber, a renderer) | Propose a separate `tool` app with an interface, built first, instead of burying it inside this app. |

Present the four groups to the operator in a short table, with your recommendation and the resulting plan (which apps, in which order). Do not create files before the operator agrees.

## 1. Decide the shape

- `type`: `skill` (instructions the AI follows), `workflow` (a pipeline with steps, state and, when scheduled, an automatic half without approvals), `tool` (scripts the AI runs; needs `shell` in permissions), `framework` (a scaffold that creates a new folder; never installs into an existing project).
- `trail`: one of `planejar`, `construir`, `publicar`, `divulgar`, `vender`, `escalar`, `manter`.
- Which AIs you will test (`compatible_ais`); the rest is "compatible by the standard" and needs no declaration.
- **The member never opens a terminal** (§4 of the reference): their AI runs every command. Nothing the app ships tells the member to install, type or run anything; `validate` refuses install commands and "no seu terminal" in its `.md` files.
- Which programs the app runs (ffmpeg, yt-dlp…): name each one in the scope of a `shell` permission (`"scope": "ffmpeg, ffprobe"`); `add`, `update` and `dev link` install them through the system's package manager. When the app finds one missing at run time, its skill has the AI run `npx flyee need <program> --yes --json` with a long time limit. A program the CLI does not know yet goes into `packages/core/assets/programs.json`.
- Which external keys the member supplies (`external_credentials`) and what the app still does without them. The AI runs `npx flyee key set <ENV> --json`, which opens a page in the member's browser to paste the key; scripts read the environment variable first (an empty one means no key), then `~/.flyee/keys.json` (`docs/COMO-CRIAR-UM-APP.md` §5 has the reader). Declare `env` and `fs:read ~/.flyee/keys.json`; never ask for, print or write a key.
- If the app will serve others, plan its `references/interface.md` from the start (§10 of the reference).

## 2. Create or open the directory

- New app: `npm run apps -- new <slug> --type <type> --trail <trail> --title "<nome>" --summary "<frase>"`. It copies `modules/_template`, fills names, type and trail, and leaves `[PREENCHER]` wherever you still have to write; `validate` refuses the app until none is left.
- Existing app whose current version is tagged (released): `npm run apps -- bump <slug> <patch|minor|major>`, which raises the version and turns the changelog into `[PREENCHER]`. A released version is immutable.
- An app other apps use (catalog "Used by"): keep the interface compatible, or raise `interface_version` and the major version and update the consumers.

## 3. Write for the member

- `README.md`: what the app does, what it needs (programs, keys, other flyee apps) said as what the AI takes care of ("a sua IA instala o ffmpeg na primeira vez", "a IA abre uma página para você colar a chave"), how to use it with one example prompt ("Peça assim: …"), what it writes and where, and the "sem a chave" section when there are credentials. This text becomes the app page on the platform.
- `skills/<name>/SKILL.md`: frontmatter `name` (equals the folder) and `description` (what and when, under 400 characters); body with the steps, the rule that never breaks, and relative references to `references/` and `scripts/` resolved from the skill's own folder. Calls to other apps go through `.flyee/modules/<other>/…` exactly as their interface says.
- Declare `permissions` for everything touched (`fs:read`, `fs:write`, `network`, `shell`, `env`) with a reason the member understands, including the commands of other apps the skill runs.

## 4. Write for yourself

- `tests/eval.json`: at least one case with `prompt`, `assertions` the runner can check and a `rubric` for a judge. Turn every support failure into a case.
- `.dev/` notes if needed. Never reference them from shipped files.

## 5. Verify

1. `npm run validate <slug>` must pass: no `[PREENCHER]` left, every app it calls exists, the README names its dependencies. `npm run pack <slug>` regenerates `files` and produces `dist/modules/<slug>-<version>.zip` with its checksum.
2. `npm run apps -- link <slug> <apps it uses>`, then run the skill and the eval cases from the workspace (the `apps` skill shows how).
3. For a first version of a flagship app, confirm the reduced 1.0 and the complete 1.1 are both ready before the launch video.

## 6. Hand over

Report the slug, the version, the trail, the apps it calls and the apps that call it, the permissions and credentials declared, the eval cases, and the console steps that remain for the operator (`docs/RELEASE.md`).
