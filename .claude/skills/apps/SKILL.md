---
name: apps
description: The operator's console for the flyee apps in this repository and the brand projects that use them: list the catalog with versions, validation, tags and copies; create, change or version an app; link apps into the workspace or into a brand's project (MedChina, flyee, Seenaly) and produce there; validate, pack and hand over for release. Use when the operator types /apps, asks to list, create, change, test, use, version or publish an app, or asks for work for one of the brands.
---

# /apps — manage the catalog from the chat

Everything this skill touches is the operator's material and never ships: the catalog, the workspace, the tooling. Only what `npm run pack` puts in an app's ZIP reaches members (`.claude/rules/fronteira.md`). Answer the operator in pt-BR, short, with the next action.

The catalog is already in your context (`.claude/rules/catalogo.md`, generated). For fresh state (validation, tags, workspace copies), run `npm run apps -- list --json`.

## What the operator says, what you do

| The operator says | You do |
|---|---|
| `/apps`, "quais apps temos?", "como está o app X?" | `npm run apps -- list --json`. Show a short table: app, version, type · trail, valid or errors, last tag (a version without tag was never released), workspace copy (current, stale, absent), uses / used by. Then name what needs attention: invalid, `[PREENCHER]` left, version not tagged, stale workspace copy. |
| "crie um app que …", "preciso de um app para …" | Load `app-author` and run its **step 0** against the catalog before anything else: present which apps the new one should call, which help to build it now, what overlaps, and your recommendation (new app, new skill in an existing app, or a new tool app). Wait for the operator's yes, then `npm run apps -- new <slug> --type <type> --trail <trail> --title "<nome>" --summary "<frase>"` and continue with `app-author`. |
| "mude o app X", "adicione uma skill ao X", "corrija o X" | Load `app-author` (edit path). If X's current version already has a tag (`list` shows it), first `npm run apps -- bump X <patch\|minor\|major>`: a released version is immutable. If X is used by other apps, keep its interface compatible (`docs/COMO-CRIAR-UM-APP.md` §10) or say which consumers must change. |
| "use o app X para …", "analise este vídeo com o X" | `npm run apps -- link X` (it brings the apps X calls). Read `modules/X/skills/<skill>/SKILL.md` and, for a tool app, `modules/X/references/interface.md`, then follow them with the **workspace** as the working directory (`list` prints its path), for example `cd <workspace>; node .flyee/modules/X/scripts/<script> <command> --json`. Results stay in the workspace. |
| "teste o app X" | `npm run validate X`, then `npm run apps -- link X` and run the cases of `modules/X/tests/eval.json` from the workspace. For the member's full experience, the operator opens the AI in the workspace and asks as a member would. |
| "empacote o X" | `npm run pack X` and report the ZIP path and the SHA-256. |
| "publique o X", "suba a versão" | Load `app-release`. |
| "quem usa o X?", "do que o X depende?" | The catalog's Uses / Used by columns; details in `docs/CATALOGO.md`. |
| "tire o X da pasta de trabalho" | `npm run apps -- unlink X` (`--project <nome>` takes it out of a project). |
| "faça um vídeo para o medchina", "trabalhe no projeto X", any real work for a brand | Real work happens in that brand's **project**, never in the workspace: `npm run apps -- project list --json`. If the project does not exist, propose it and, with the operator's yes, `npm run apps -- project new <nome> [slug...]` (without slugs, every app that validates). If the apps needed there are missing or stale, `npm run apps -- link <slug> --project <nome>` or `project sync <nome>`. Then run the app from this chat with the **project folder** as the working directory (as in the row above), or, for the member's experience, the operator opens the AI in that folder. Either way its voice, brand kit and deliveries stay in it. |
| "quais projetos temos?", "o projeto X está em dia?" | `npm run apps -- project list --json`: each project with its apps and whether each copy is current, stale or orphan (its app left modules/). `project sync` relinks the stale ones in every project. |

## Rules

- Never run `flyee dev link` inside this repository; the CLI refuses it. Apps reach the workspace only through `npm run apps -- link`, which also rebuilds the CLI when its sources changed.
- The workspace copy is a copy: after editing an app, link it again before using it (`list` marks it stale).
- Never ask the operator to install anything. `npm run apps -- link` installs the programs an app names in its `shell` permissions; for anything else run the built CLI yourself with a long time limit: `node packages/cli/dist/flyee.js need <program> --yes --json`. Show the operator a step only when the result says `needs_member`. A key an app needs: `node packages/cli/dist/flyee.js key set <ENV> --json` from the workspace opens the browser page for the operator to paste it.
- Never edit `.claude/rules/catalogo.md` or `docs/CATALOGO.md`; a hook regenerates them after every change under `modules/`, and `npm run apps -- catalog` does it by hand.
- **Workspace or project.** The workspace (`C:\AppsProjects\flyee-workspace`) is the test bench: trying apps, eval cases, material for building other apps. A project (`C:\AppsProjects\conteudo\<nome>`, `FLYEE_PROJECTS` overrides the root) is one brand or client the operator produces for: MedChina, flyee, Seenaly. Never produce a brand's real deliveries in the workspace or in another brand's project, and never install apps inside a code repository (its generated `AGENTS.md` would fight the member's harness). `link` without `--project` goes to the workspace.
- What an app produces while you build another one (an analysis, a download, a draft) stays in the workspace. If part of it becomes app material, write the distilled text into `modules/<slug>/references/` on purpose; never copy raw outputs, personal data or anything the member should not receive.
- Commands with flags need `--` after the script name: `npm run apps -- new …`. Prefer `--json` and read the result instead of guessing.
