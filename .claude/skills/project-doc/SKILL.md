---
name: project-doc
description: Format for the documents that drive work in this repo — an implementation spec (a plan of tasks, like docs/PLANO*.md), an audit report (findings against the code), or a proposal evaluation (should we build this at all). Use BEFORE writing or substantially editing any planning, audit, RFC or evaluation document under docs/, and before turning one into tasks. It forces state audited against the real code, acceptance another person can check without asking you, and declared gaps.
---

# Project document playbook

A document that drives work is a contract, not a memo. The failure it exists to prevent is a plan that *reads* rigorous and proves nothing: tasks whose state was assumed rather than checked, acceptance only its author can evaluate, and silence where coverage ran out.

This repo already enforces that in code: the harness tests assert real hook output, `check:tarball` inspects what npm would really publish, `validate` refuses an app with `[PREENCHER]` left, the CLI tests run against a fake platform that speaks the contract. These are the same rules, for prose. Adapted from the `project-doc` skill of the brunosantanadev repository.

## The three shapes

| Shape | Answers | When |
|---|---|---|
| **Spec** | "What do we build, in what order, and how do we know each piece is done?" | A plan of work: a CLI phase, an app, a version, an RFC turned into tasks. |
| **Audit** | "What is actually true about the code right now, and what needs a decision or a fix?" | Reviewing an existing subsystem (an app, the installer, the contract client) before trusting or changing it. |
| **Evaluation** | "Should we build this at all, and if so, in what scope?" | A proposal arrives (a new app, a harness piece from another repo) and the answer is not obviously yes. |

Pick one. A document that tries to be all three decides nothing.

## Rules that apply to all three

**1. State is audited, never assumed.** Every claim about what exists cites the file and line (or the test, the command output) that proves it. Use this legend, and put a state line on every task or finding:

- `✅` exists and was verified
- `🟡` partial: say precisely which half
- `⬜` does not exist (say what you grepped for; "grep in the repo = zero" is a finding)
- `⚠️` **correction**: an earlier version of this document, or another document (here or in `flyee-club/docs/`), claims something the code contradicts. Name the file to fix.

The `⚠️` marker is the most valuable one. A plan that silently drops a wrong claim teaches nobody; one that marks it stops the same error being re-derived next month.

**2. Acceptance is verifiable by someone else.** Every task ends with an **Acceptance** line that a different person can check without asking the author. "Works correctly" is not acceptance. "`npx flyee add video-render` on a machine without ffmpeg installs it through winget and `doctor` reports it present" is.

Prefer the acceptance that runs: a command, a test, a request to the fake platform, a rendered frame. If the acceptance can only be judged by opinion, the task is not specified yet.

**3. Declare what you did not cover.** A document that reports only what it found reads as complete coverage. State the boundary: which areas were not reached, which verifier did not finish, which claim is untested (for example "the flow against the real platform did not run: it is not deployed"). Silent truncation is the lie; a named gap is information.

**4. Decisions come before code.** Values the implementer must not invent (prices, limits, channels, which version is free, copy, policy) go in a decisions table at the top, each with **where the value lives**: a manifest field, a core asset, `platform_settings` on the platform, an env var, the platform console. "Configurable" without a location is not a decision. Product decisions live on the platform side (`flyee-club/docs/PRODUCT.md`); a spec here references them and never restates them.

**5. Only what needs a decision or a fix enters.** Do not restate what already works. An audit that lists correct behaviour buries the three things that matter.

**6. Say where it is wrong to be right.** When the implementation deliberately diverges from what the document recommended, record it under that heading with the reasoning. Undocumented divergence is how a document becomes fiction.

## Shape 1: Spec

```md
# <Subject>: implementation spec

**Objective:** one sentence: what is true after this ships.
> Audited against the code on <date> (<commit>). Legend: ✅ exists · 🟡 partial · ⬜ does not exist · ⚠️ correction.

## 0. Decisions needed BEFORE development
The implementer must NOT invent these. Implement them as configurable inputs and ask.

| # | Decision | Value | Where it lives |
|---|---|---|---|
| D1 | … | decided / open | manifest field · core asset · platform console · env var |

## 0.5 Repo conventions (apply to EVERY task below)
The rules this work must not break, pulled from `CLAUDE.md` and `.claude/rules/*`, narrowed
to what this work touches (the boundary, the contract, the no-terminal rule…). Not a copy of the rulebook.

## Invariants the implementation may not violate
Numbered, each with its reason. MANDATORY for a new capability, and the section reviewers read first.

## EPIC 1: <name>
**Blocks:** what cannot start until this lands.

### T1.1: <task>
**State: 🟡** <what exists, citing `packages/cli/src/…:120` or `modules/<slug>/…`>; what does not.
- <the work, in bullets>
- **Acceptance:** <checkable by another person>

## Risks
What could make this plan wrong, and the earliest signal for each.
```

### Invariants

The section that pays for itself. A numbered list of what the implementation may **never** do, each with the reason:

> 3. **A package is never extracted before its SHA-256 matches.** A partial install from unverified bytes is the one failure the member cannot detect.

Write them as prohibitions with consequences, not as goals. "Be careful with X" is not an invariant. They read like `.claude/rules/*` because they are the same thing scoped to one piece of work, and when the work ships, the durable ones graduate into a rules file.

## Shape 2: Audit

```md
# <Subject> audit

**Date:** · **Scope:** the flows, files and questions actually examined.
**Method:** how findings were produced AND how they were falsified. If findings were
verified adversarially, give the arithmetic: "N raw findings, M survived, N−M refuted
against the code and are not listed here."
**Incomplete coverage, declared:** which areas were not reached and why. Findings that
depended on them were discarded; those areas may hold real problems not listed.
**Rule of this document:** only what needs a decision or a fix.

## Implementation state (<date>)
| Finding | Where it was fixed |
|---|---|

**Verification:** what actually ran, and what did not. "typecheck, tests and ci:verify pass;
nothing ran against the real platform" is a complete sentence. Never imply verification that
did not happen.

**Deliberately different from the report:** where implementation diverged, and why.

**Not implemented:** what is still open.

## Findings by severity
Each: what is wrong · how it fails (concrete input → wrong result) · the fix · the cost.

## Decisions only the operator can make
Findings whose resolution is a business call, not an engineering one. Name the trade-off
on each side; do not pick.
```

The arithmetic in **Method** is the point. "We reviewed it carefully" and "32 claims were refuted against the code and are not listed here" are different documents; only the second lets a reader calibrate the first.

## Shape 3: Evaluation

```md
---
document: "<what is being evaluated>"
version: "1.0"
date: "<date>"
status: "Evaluated, awaiting scope decision" | "Decided <date>" | "Rejected <date>"
source_of_truth: "flyee-club/docs/PRODUCT.md + CLAUDE.md"
---

## 1. The proposal, as received
Restate it so its author would recognise it. Steel-man it before judging it.

## 2. Evaluation
Where the diagnosis is right: say this first and mean it.
Where it is wrong, or where it solves a problem we do not have.
What it costs, including what it displaces.

## 3. Scope decision
What we build, what we do not, and the reason for the line. A "no" needs a reason as
concrete as a "yes".

## 4. Architecture in phases
Each phase independently shippable and independently valuable. Phase 1 must survive
phase 2 being cancelled.

## 5. Success metrics
Numbers that would prove this was worth doing, chosen BEFORE building, so the result
cannot be reinterpreted afterwards.
```

## Where documents live

- `docs/*.md`: durable, read by humans and by skills. `ARQUITETURA.md` owns how the product is built, `COMO-CRIAR-UM-APP.md` the authoring reference, `RELEASE.md` the release steps, `PLANO.md` and `PLANO-<tema>.md` the plans. `CATALOGO.md` is generated: never write it.
- Product decisions and the contract belong to the platform: `flyee-club/docs/PRODUCT.md` and `flyee-club/docs/CLI-CONTRACT.md`. A spec here cites them and never copies them.
- A spec whose work has shipped either becomes history (state it at the top) or its durable rules graduate into `.claude/rules/*` and its facts into `CLAUDE.md`. **A shipped spec left describing the future is the next `⚠️` correction.**
- Operator notes about one app (an app's own spec, its contracts) go in `modules/<slug>/.dev/`, which never ships.

## Before finishing

- Every task has a state line with evidence, and an acceptance line another person can check.
- Every value the implementer would otherwise invent is in the decisions table, with a location.
- The coverage boundary is written down.
- Any claim contradicted by the code carries `⚠️` and names the file to fix.
- Prose in the project's language (pt-BR in `docs/`), code and identifiers in English.
