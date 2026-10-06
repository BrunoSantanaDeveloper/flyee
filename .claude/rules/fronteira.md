# Boundary: what ships, what stays

- Two doors only. Members receive (1) the npm package `flyee` built from `packages/cli` plus `packages/core/assets`, and (2) app packages built from `modules/<slug>/` without `tests/`, `.dev/` and `*.dev.md`. Nothing else leaves this repo: no docs, no harness, no evals, no tooling.
- `packages/cli/package.json` keeps `files` at `["dist", "README.md", "LICENSE"]` and zero runtime dependencies. `scripts/check-tarball.mjs` is the gate; never bypass it.
- `modules/*/tests/eval.json` and anything under `modules/*/.dev/` are operator material: prompts, rubrics, notes. Never reference them from a `SKILL.md`, a `README.md` or the manifest, because those files ship.
- Member-facing text (`packages/core/assets/**`, `modules/*/**` outside `tests/`) is written for the member and their AI: pt-BR first, English where the manifest carries it, no internal names, no links the server did not give.
- The free version of an app is an older tag of the same app, marked in the platform console. Never create a parallel reduced copy.
- Licenses and marks (planned, contract section 9) bind the harness runtime to the account and machine; they never stop an installed app from working and never encrypt or obfuscate a skill.
