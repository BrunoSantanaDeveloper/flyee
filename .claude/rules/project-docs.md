# Project documents: a plan is a contract, not a memo

- Any document that drives work (an implementation spec like `docs/PLANO*.md`, an audit, a proposal evaluation, an app's `.dev/SPEC.md`) follows the `project-doc` skill. Load it BEFORE writing or substantially editing one.
- **State is audited, never assumed.** Every claim about what exists cites the file and line, test or command output that proves it. Legend: `✅` exists · `🟡` partial · `⬜` does not exist · `⚠️` correction (another document claims something the code contradicts; name the file to fix).
- **Acceptance is verifiable by someone else**, without asking the author. Prefer the acceptance that runs: a command, a test, a request to the fake platform, a rendered frame.
- **Declare the coverage boundary.** What was not examined, which verifier did not finish, which claim is untested. Silent truncation reads as complete coverage.
- **Decisions before code.** Values the implementer must not invent go in a table at the top, each with where the value lives (manifest field, core asset, platform console, env var). Product decisions live in `flyee-club/docs/PRODUCT.md`: cite, never restate.
- A shipped spec left describing the future is the next `⚠️`. When work lands, its durable rules graduate into `.claude/rules/*` and its facts into `CLAUDE.md`; the spec becomes history or is deleted.
