---
name: cli-dev
description: Working rules for the `flyee` CLI in packages/cli — contract-only client, verification before extraction, adapters and bridges, state files, --json/--yes, Windows-first, fake-platform tests. Use BEFORE editing anything under packages/cli or packages/core, and when debugging a member-facing CLI behavior.
---

# Work on the CLI

Read `.claude/rules/contrato.md` and `.claude/rules/fronteira.md` first. Then:

1. **Find the contract section** in `C:\AppsProjects\flyee-club\docs\CLI-CONTRACT.md` for the behavior you touch and quote it in the code comment. Planned fields (section 9) are optional reads.
2. **Change the fake platform too.** `packages/cli/test/fake-platform.ts` implements the subset the CLI uses; a new endpoint or field lands there with a test in `packages/cli/test/*.test.ts` before the command uses it.
3. **Keep the shape**: commands are functions `(ctx, args) => Promise<Result>`; `ctx` carries base URL, home dir, cwd, io and env so tests inject everything. No globals, no `process.exit` outside `main.ts`.
4. **Member-facing text** goes through `src/i18n.ts` in both languages; server messages are printed as they come.
5. **Core assets** (`packages/core/assets`) are member-facing content, bilingual, with no internal names. Bump `core.json` when they change in a way the member should receive on `update`.
6. **Run** `npm run typecheck -w flyee`, `npm test -w flyee`, `npm run build -w flyee`, `npm run check:tarball`. Try the bundle by hand: `node packages/cli/dist/flyee.js --help`.
7. **Windows**: paths with `path.join`, no symlinks, spawn with `shell: false`, open the browser with the OS command. Then think about macOS and Linux.
